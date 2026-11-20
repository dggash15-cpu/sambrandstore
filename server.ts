import 'dotenv/config';
import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  db,
  getStoreSettings,
  hashPassword,
  initDatabase,
  logAudit,
  mapAuditRow,
  mapCampaignRow,
  mapFlashSaleRow,
  mapOrderItemRow,
  mapOrderRow,
  mapProductRow,
  mapRoleRow,
  updateStoreSettings,
  verifyPassword,
} from './server/db.ts';
import {
  attachOptionalUser,
  loadUserById,
  requireAuth,
  requirePermission,
  signSessionToken,
  type AuthenticatedRequest,
} from './server/auth.ts';
import type {
  FlashSale,
  Order,
  PermissionKey,
  Product,
  ProductRatingSummary,
  ProductReview,
  RestockNotification,
} from './src/types.ts';

initDatabase();

function mapReviewRow(row: Record<string, unknown>): ProductReview {
  return {
    id: String(row.id),
    productId: String(row.product_id),
    productName: String(row.product_name),
    authorName: String(row.author_name),
    rating: Number(row.rating),
    title: String(row.title),
    comment: String(row.comment),
    verifiedPurchase: Boolean(row.verified_purchase),
    helpfulCount: Number(row.helpful_count),
    createdAt: String(row.created_at),
  };
}

function mapWaitlistRow(row: Record<string, unknown>): RestockNotification {
  return {
    id: String(row.id),
    productId: String(row.product_id),
    productName: String(row.product_name),
    sku: String(row.sku),
    variant: String(row.variant),
    email: String(row.email),
    createdAt: String(row.created_at),
  };
}

function computeRatingSummary(productId: string): ProductRatingSummary {
  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const rows = db.prepare('SELECT rating FROM product_reviews WHERE product_id = ?').all(productId) as Array<{ rating: number }>;
  if (rows.length === 0) {
    return { averageRating: 0, reviewCount: 0, distribution };
  }
  let sum = 0;
  for (const r of rows) {
    const clamped = Math.min(5, Math.max(1, Math.round(r.rating))) as 1 | 2 | 3 | 4 | 5;
    distribution[clamped] += 1;
    sum += clamped;
  }
  return {
    averageRating: Number((sum / rows.length).toFixed(1)),
    reviewCount: rows.length,
    distribution,
  };
}

function getActiveFlashSales(nowMs = Date.now()): FlashSale[] {
  const rows = db
    .prepare('SELECT * FROM flash_sales WHERE active = 1 ORDER BY discount_pct DESC, expires_at ASC')
    .all() as Record<string, unknown>[];
  return rows
    .map(mapFlashSaleRow)
    .filter((sale) => {
      const startMs = new Date(sale.startsAt).getTime();
      const expMs = new Date(sale.expiresAt).getTime();
      return Number.isFinite(expMs) && expMs > nowMs && (!Number.isFinite(startMs) || startMs <= nowMs);
    });
}

function applyFlashSaleToProduct(product: Product, activeSales: FlashSale[]): Product {
  const matching = activeSales.filter(
    (s) => s.targetCategory === 'All' || s.targetCategory === product.category
  );
  if (matching.length === 0) {
    return { ...product, flashSale: null };
  }
  const best = matching.reduce((prev, curr) =>
    curr.discountPct > prev.discountPct ? curr : prev
  );
  const originalPrice = product.price;
  const discountedPrice = Number(
    Math.max(0.01, originalPrice * (1 - best.discountPct / 100)).toFixed(2)
  );
  return {
    ...product,
    price: discountedPrice,
    compareAtPrice:
      product.compareAtPrice && product.compareAtPrice > originalPrice
        ? product.compareAtPrice
        : originalPrice,
    flashSale: {
      id: best.id,
      title: best.title,
      discountPct: best.discountPct,
      expiresAt: best.expiresAt,
      originalPrice,
    },
  };
}

const uploadsDir = path.resolve(process.cwd(), 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  console.warn(
    '\n⚠️  [SECURITY WARNING] SESSION_SECRET is not configured in production environment variables!\n' +
    '   Using an ephemeral fallback secret. Existing user sessions will be invalidated whenever the process restarts.\n' +
    '   Please configure SESSION_SECRET in Hostinger Environment Variables.\n'
  );
}

const app = express();
app.set('trust proxy', 1);

// Production HTTP Security Headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Lightweight Sliding Window Rate Limiter for Authentication Endpoints
const authRateLimitMap = new Map<string, { count: number; resetAt: number }>();
function authRateLimiter(req: express.Request, res: express.Response, next: express.NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15-minute sliding window
  const maxAttempts = 15; // Max 15 attempts per 15 minutes

  const current = authRateLimitMap.get(ip);
  if (!current || now > current.resetAt) {
    authRateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return next();
  }

  if (current.count >= maxAttempts) {
    const retryAfterSec = Math.ceil((current.resetAt - now) / 1000);
    res.setHeader('Retry-After', retryAfterSec);
    res.status(429).json({
      error: `Too many authentication attempts. Please try again in ${Math.ceil(retryAfterSec / 60)} minutes.`,
    });
    return;
  }

  current.count += 1;
  next();
}

app.use(express.json({ limit: '6mb' }));
app.use('/uploads', express.static(uploadsDir, { maxAge: '7d' }));
app.use(attachOptionalUser);

function isValidLuhn(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (shouldDouble) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

function getOrderWithItems(orderId: string): Order | null {
  const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as
    | Record<string, unknown>
    | undefined;
  if (!row) return null;
  const itemRows = db
    .prepare('SELECT * FROM order_items WHERE order_id = ?')
    .all(orderId) as Record<string, unknown>[];
  return mapOrderRow(row, itemRows.map(mapOrderItemRow));
}

function setSessionCookie(res: express.Response, token: string): void {
  res.cookie('sbs_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 7,
    path: '/',
  });
}

// Health check & public store settings
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, store: 'Sam Brand Store', timestamp: new Date().toISOString() });
});

app.get('/api/settings/public', (_req, res) => {
  res.json(getStoreSettings());
});

// ==================== AUTH ====================

app.post('/api/auth/login', authRateLimiter, (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const row = db
    .prepare('SELECT id, password_hash, status FROM users WHERE LOWER(email) = LOWER(?)')
    .get(email.trim()) as { id: string; password_hash: string; status: string } | undefined;

  if (!row || !verifyPassword(password, row.password_hash)) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  if (row.status !== 'active') {
    res.status(403).json({ error: 'Account is suspended. Contact a Store Owner.' });
    return;
  }

  const now = new Date().toISOString();
  db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(now, row.id);

  const user = loadUserById(row.id);
  if (!user) {
    res.status(500).json({ error: 'Failed to load user profile.' });
    return;
  }

  if (user.roleSlug === 'customer') {
    res.status(403).json({
      error:
        'Shoppers do not need an account — checkout directly via WhatsApp. Sign-in is restricted to Store Admin & Employees.',
    });
    return;
  }

  const token = signSessionToken(user.id);
  setSessionCookie(res, token);

  logAudit(user.id, user.name, user.roleName, 'STAFF_LOGIN', 'user', user.id, 'Authenticated into workspace.');

  res.json({ token, user });
});

app.post('/api/auth/register', (_req, res) => {
  res.status(403).json({
    error: 'Public registration is disabled. Store Admin provisions all Employee accounts.',
  });
});

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie('sbs_session', { path: '/' });
  res.json({ ok: true });
});

app.get('/api/auth/me', (req: AuthenticatedRequest, res) => {
  res.json({ user: req.authUser || null });
});

app.post('/api/auth/request-reset', authRateLimiter, (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email?.trim()) {
    res.status(400).json({ error: 'Employee email is required.' });
    return;
  }

  const row = db
    .prepare(
      `
      SELECT u.id, u.name, u.status, r.slug as role_slug, r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE LOWER(u.email) = LOWER(?)
    `
    )
    .get(email.trim()) as
    | { id: string; name: string; status: string; role_slug: string; role_name: string }
    | undefined;

  if (!row || row.role_slug === 'customer' || row.status !== 'active') {
    res.status(404).json({ error: 'No active staff or admin account matched that email.' });
    return;
  }

  const code = String(crypto.randomInt(100000, 999999));
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60_000).toISOString();

  db.prepare('UPDATE password_resets SET used = 1 WHERE user_id = ?').run(row.id);
  db.prepare(
    `
    INSERT INTO password_resets (id, user_id, code, expires_at, used, created_at)
    VALUES (?, ?, ?, ?, 0, ?)
  `
  ).run(`rst_${crypto.randomUUID().slice(0, 10)}`, row.id, code, expiresAt, now.toISOString());

  logAudit(
    row.id,
    row.name,
    row.role_name,
    'PASSWORD_RESET_REQUESTED',
    'user',
    row.id,
    `Generated 15-minute verification reset code for ${email.trim()}`
  );

  // Also log to server console for Hostinger deployment admins without SMTP configured
  console.log(`[SBS Password Reset] ${email.trim()} -> Code: ${code} (expires ${expiresAt})`);

  res.json({
    ok: true,
    message: 'A 6-digit verification code has been generated for your account.',
    demoVerificationCode: process.env.NODE_ENV === 'production' ? undefined : code,
  });
});

app.post('/api/auth/reset-password', authRateLimiter, (req: AuthenticatedRequest, res) => {
  const { email, currentPassword, resetCode, newPassword } = req.body as {
    email?: string;
    currentPassword?: string;
    resetCode?: string;
    newPassword?: string;
  };

  if (!newPassword || newPassword.trim().length < 6) {
    res.status(400).json({ error: 'New password must be at least 6 characters.' });
    return;
  }

  const targetEmail = (email || req.authUser?.email || '').trim();
  if (!targetEmail) {
    res.status(400).json({ error: 'Account email is required.' });
    return;
  }

  const row = db
    .prepare(
      `
      SELECT u.id, u.name, u.password_hash, u.status, r.slug as role_slug, r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE LOWER(u.email) = LOWER(?)
    `
    )
    .get(targetEmail) as
    | {
        id: string;
        name: string;
        password_hash: string;
        status: string;
        role_slug: string;
        role_name: string;
      }
    | undefined;

  if (!row || row.role_slug === 'customer' || row.status !== 'active') {
    res.status(404).json({ error: 'Active staff or admin account not found.' });
    return;
  }

  let authorized = false;

  if (currentPassword) {
    if (!verifyPassword(currentPassword, row.password_hash)) {
      res.status(401).json({ error: 'Current password is incorrect.' });
      return;
    }
    authorized = true;
  } else if (resetCode) {
    const tokenRow = db
      .prepare(
        `
        SELECT id, expires_at FROM password_resets
        WHERE user_id = ? AND code = ? AND used = 0
        ORDER BY created_at DESC LIMIT 1
      `
      )
      .get(row.id, resetCode.trim()) as { id: string; expires_at: string } | undefined;

    if (!tokenRow || new Date(tokenRow.expires_at).getTime() < Date.now()) {
      res.status(400).json({ error: 'Invalid or expired 6-digit verification code.' });
      return;
    }
    db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(tokenRow.id);
    authorized = true;
  }

  if (!authorized) {
    res.status(400).json({
      error: 'Provide your current password or a valid 6-digit reset verification code.',
    });
    return;
  }

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
    hashPassword(newPassword.trim()),
    row.id
  );

  logAudit(
    row.id,
    row.name,
    row.role_name,
    'PASSWORD_RESET',
    'user',
    row.id,
    `Password updated for ${targetEmail}`
  );

  res.json({ ok: true, message: 'Password updated successfully. You can now sign in.' });
});

// ==================== PUBLIC CATALOG & CAMPAIGNS ====================

app.get('/api/products', (req, res) => {
  const category = typeof req.query.category === 'string' ? req.query.category : '';
  const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';

  let rows = db
    .prepare('SELECT * FROM products WHERE active = 1 ORDER BY featured DESC, created_at ASC')
    .all() as Record<string, unknown>[];

  if (category && category !== 'All') {
    rows = rows.filter((r) => String(r.category).toLowerCase() === category.toLowerCase());
  }
  if (search) {
    rows = rows.filter(
      (r) =>
        String(r.name).toLowerCase().includes(search) ||
        String(r.brand).toLowerCase().includes(search) ||
        String(r.tagline).toLowerCase().includes(search) ||
        String(r.category).toLowerCase().includes(search)
    );
  }

  const activeSales = getActiveFlashSales();

  res.json({
    products: rows.map((row) => {
      const mapped = applyFlashSaleToProduct(mapProductRow(row), activeSales);
      const summary = computeRatingSummary(mapped.id);
      return {
        ...mapped,
        averageRating: summary.averageRating,
        reviewCount: summary.reviewCount,
      };
    }),
  });
});

app.get('/api/products/:slugOrId', (req, res) => {
  const row = db
    .prepare('SELECT * FROM products WHERE (id = ? OR slug = ?) AND active = 1')
    .get(req.params.slugOrId, req.params.slugOrId) as Record<string, unknown> | undefined;

  if (!row) {
    res.status(404).json({ error: 'Product not found.' });
    return;
  }

  const activeSales = getActiveFlashSales();
  const mapped = applyFlashSaleToProduct(mapProductRow(row), activeSales);
  const summary = computeRatingSummary(mapped.id);

  res.json({
    product: {
      ...mapped,
      averageRating: summary.averageRating,
      reviewCount: summary.reviewCount,
    },
  });
});

app.get('/api/products/:id/reviews', (req, res) => {
  const productRow = db
    .prepare('SELECT id, name FROM products WHERE id = ? AND active = 1')
    .get(req.params.id) as { id: string; name: string } | undefined;

  if (!productRow) {
    res.status(404).json({ error: 'Product not found.' });
    return;
  }

  const sort = typeof req.query.sort === 'string' ? req.query.sort : 'recent';
  let orderBy = 'created_at DESC';
  if (sort === 'helpful') orderBy = 'helpful_count DESC, created_at DESC';
  if (sort === 'highest') orderBy = 'rating DESC, created_at DESC';
  if (sort === 'lowest') orderBy = 'rating ASC, created_at DESC';

  const rows = db
    .prepare(`SELECT * FROM product_reviews WHERE product_id = ? ORDER BY ${orderBy}`)
    .all(productRow.id) as Record<string, unknown>[];
  const reviews = rows.map(mapReviewRow);

  res.json({
    summary: computeRatingSummary(productRow.id),
    reviews,
  });
});

app.post('/api/products/:id/reviews', (req: AuthenticatedRequest, res) => {
  const productRow = db
    .prepare('SELECT id, name, sku FROM products WHERE id = ? AND active = 1')
    .get(req.params.id) as { id: string; name: string; sku: string } | undefined;

  if (!productRow) {
    res.status(404).json({ error: 'Product not found.' });
    return;
  }

  const body = req.body as {
    authorName?: string;
    authorEmail?: string;
    rating?: number;
    title?: string;
    comment?: string;
  };

  const authorName = (body.authorName || req.authUser?.name || '').trim();
  const authorEmail = (body.authorEmail || req.authUser?.email || '').trim().toLowerCase();
  const rating = Math.round(Number(body.rating));
  const title = (body.title || '').trim();
  const comment = (body.comment || '').trim();

  if (authorName.length < 2) {
    res.status(400).json({ error: 'Please enter your name (at least 2 characters).' });
    return;
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    res.status(400).json({ error: 'Please select a star rating between 1 and 5.' });
    return;
  }
  if (comment.length < 8) {
    res.status(400).json({ error: 'Please share at least 8 characters of feedback.' });
    return;
  }

  let verifiedPurchase = false;
  if (authorEmail) {
    const orderMatch = db
      .prepare(
        `
        SELECT o.id FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        WHERE LOWER(o.customer_email) = LOWER(?) AND oi.product_id = ? AND o.order_status != 'cancelled'
        LIMIT 1
      `
      )
      .get(authorEmail, productRow.id) as { id: string } | undefined;
    verifiedPurchase = Boolean(orderMatch);
  }

  const review: ProductReview = {
    id: `rev_${crypto.randomUUID().slice(0, 10)}`,
    productId: productRow.id,
    productName: productRow.name,
    authorName: authorName.slice(0, 60),
    rating,
    title: title ? title.slice(0, 100) : `${rating}-Star Hardware Review`,
    comment: comment.slice(0, 800),
    verifiedPurchase,
    helpfulCount: 0,
    createdAt: new Date().toISOString(),
  };

  db.prepare(`
    INSERT INTO product_reviews (id, product_id, product_name, author_name, author_email, rating, title, comment, verified_purchase, helpful_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
  `).run(
    review.id,
    review.productId,
    review.productName,
    review.authorName,
    authorEmail || null,
    review.rating,
    review.title,
    review.comment,
    review.verifiedPurchase ? 1 : 0,
    review.createdAt
  );

  logAudit(
    req.authUser?.id || 'guest_shopper',
    authorName,
    req.authUser?.roleName || 'Customer',
    'PRODUCT_REVIEW_SUBMITTED',
    'product',
    productRow.id,
    `${rating}/5 star review posted on ${productRow.name} (${productRow.sku}) by ${authorName}`
  );

  const updatedRows = db
    .prepare('SELECT * FROM product_reviews WHERE product_id = ? ORDER BY created_at DESC')
    .all(productRow.id) as Record<string, unknown>[];

  res.status(201).json({
    review,
    summary: computeRatingSummary(productRow.id),
    reviews: updatedRows.map(mapReviewRow),
  });
});

app.post('/api/products/:id/reviews/:reviewId/helpful', (req, res) => {
  const row = db
    .prepare('SELECT helpful_count FROM product_reviews WHERE id = ? AND product_id = ?')
    .get(req.params.reviewId, req.params.id) as { helpful_count: number } | undefined;
  if (!row) {
    res.status(404).json({ error: 'Review not found.' });
    return;
  }
  const nextCount = row.helpful_count + 1;
  db.prepare('UPDATE product_reviews SET helpful_count = ? WHERE id = ?').run(nextCount, req.params.reviewId);
  res.json({ ok: true, helpfulCount: nextCount });
});

app.get('/api/campaigns', (_req, res) => {
  const rows = db
    .prepare('SELECT * FROM campaigns WHERE active = 1 ORDER BY sort_order ASC, created_at DESC')
    .all() as Record<string, unknown>[];
  res.json({ campaigns: rows.map(mapCampaignRow) });
});

app.get('/api/flash-sales', (_req, res) => {
  res.json({
    flashSales: getActiveFlashSales(),
    serverTime: new Date().toISOString(),
  });
});

app.post('/api/products/:id/notify', (req, res) => {
  const { email, variant } = req.body as { email?: string; variant?: string };
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    res.status(400).json({ error: 'Please enter a valid email address.' });
    return;
  }

  const row = db
    .prepare('SELECT id, name, sku, stock FROM products WHERE id = ? AND active = 1')
    .get(req.params.id) as { id: string; name: string; sku: string; stock: number } | undefined;

  if (!row) {
    res.status(404).json({ error: 'Product not found.' });
    return;
  }

  const chosenVariant = (variant || 'Standard').trim();
  const existing = db
    .prepare('SELECT * FROM stock_waitlist WHERE product_id = ? AND LOWER(email) = LOWER(?)')
    .get(row.id, cleanEmail) as Record<string, unknown> | undefined;

  const totalSubs = (
    db.prepare('SELECT count(*) as c FROM stock_waitlist WHERE product_id = ?').get(row.id) as {
      c: number;
    }
  ).c;

  if (existing) {
    res.json({
      ok: true,
      alreadySubscribed: true,
      message: `You are already subscribed for ${row.name} restock alerts.`,
      entry: mapWaitlistRow(existing),
      totalSubscribers: totalSubs,
    });
    return;
  }

  const entry: RestockNotification = {
    id: `ntf_${crypto.randomUUID().slice(0, 10)}`,
    productId: row.id,
    productName: row.name,
    sku: row.sku,
    variant: chosenVariant,
    email: cleanEmail,
    createdAt: new Date().toISOString(),
  };

  db.prepare(`
    INSERT INTO stock_waitlist (id, product_id, product_name, sku, variant, email, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(entry.id, entry.productId, entry.productName, entry.sku, entry.variant, entry.email, entry.createdAt);

  logAudit(
    'guest_shopper',
    cleanEmail,
    'Customer',
    'RESTOCK_NOTIFY_SUBSCRIBED',
    'product',
    row.id,
    `Restock alert requested by ${cleanEmail} for ${row.name} (${row.sku})`
  );

  res.status(201).json({
    ok: true,
    alreadySubscribed: false,
    message: `Alert saved! We will notify ${cleanEmail} when ${row.name} is back in stock.`,
    entry,
    totalSubscribers: totalSubs + 1,
  });
});

// ==================== PROMOS & CHECKOUT ====================

function evaluatePromo(codeRaw: string | null | undefined, subtotal: number): {
  valid: boolean;
  code: string | null;
  discountAmount: number;
  freeShipping: boolean;
  label: string;
} {
  const code = (codeRaw || '').trim().toUpperCase();
  if (!code) {
    return { valid: false, code: null, discountAmount: 0, freeShipping: false, label: '' };
  }
  if (code === 'SAM10') {
    return {
      valid: true,
      code,
      discountAmount: Number((subtotal * 0.1).toFixed(2)),
      freeShipping: false,
      label: '10% Storewide Launch Savings',
    };
  }
  if (code === 'PROSETUP') {
    if (subtotal < 500) {
      return { valid: false, code: null, discountAmount: 0, freeShipping: false, label: 'Requires $500+ subtotal' };
    }
    return {
      valid: true,
      code,
      discountAmount: Number((subtotal * 0.15).toFixed(2)),
      freeShipping: true,
      label: '15% Pro Bundle + Free Express Shipping',
    };
  }
  return { valid: false, code: null, discountAmount: 0, freeShipping: false, label: 'Invalid promo code' };
}

app.post('/api/promo/validate', (req, res) => {
  const { code, subtotal } = req.body as { code?: string; subtotal?: number };
  const result = evaluatePromo(code, Number(subtotal || 0));
  if (!result.valid) {
    res.status(400).json({ error: result.label || 'Invalid promo code.' });
    return;
  }
  res.json(result);
});

app.post('/api/orders', (req: AuthenticatedRequest, res) => {
  const body = req.body as {
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    shippingAddress?: string;
    city?: string;
    postalCode?: string;
    paymentMethod?: 'card' | 'cod' | 'wallet';
    cardNumber?: string;
    cardExpiry?: string;
    cardCvc?: string;
    promoCode?: string;
    notes?: string;
    items?: Array<{ productId: string; variant: string; quantity: number }>;
  };

  if (
    !body.customerName?.trim() ||
    !body.customerEmail?.trim() ||
    !body.customerPhone?.trim() ||
    !body.shippingAddress?.trim() ||
    !body.city?.trim() ||
    !body.postalCode?.trim()
  ) {
    res.status(400).json({ error: 'Please complete all shipping and contact fields.' });
    return;
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    res.status(400).json({ error: 'Your shopping bag is empty.' });
    return;
  }

  const paymentMethod = body.paymentMethod || 'card';
  let paymentLast4: string | null = null;

  if (paymentMethod === 'card') {
    const cleanCard = (body.cardNumber || '').replace(/\D/g, '');
    if (!isValidLuhn(cleanCard)) {
      res.status(400).json({ error: 'Card verification failed. Please enter a valid card number.' });
      return;
    }
    if (!body.cardExpiry?.match(/^\d{2}\/\d{2}$/) || !body.cardCvc?.match(/^\d{3,4}$/)) {
      res.status(400).json({ error: 'Please enter a valid expiration date (MM/YY) and security code.' });
      return;
    }
    paymentLast4 = cleanCard.slice(-4);
  } else if (paymentMethod === 'wallet') {
    paymentLast4 = 'PAY1';
  }

  try {
    const createdOrderId = db.transaction(() => {
      let subtotal = 0;
      const resolvedItems: Array<{
        productId: string;
        name: string;
        sku: string;
        variant: string;
        quantity: number;
        unitPrice: number;
      }> = [];

      const selectProd = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1');
      const decrementStock = db.prepare(
        'UPDATE products SET stock = stock - ?, updated_at = ? WHERE id = ? AND stock >= ?'
      );
      const now = new Date().toISOString();

      const activeSales = getActiveFlashSales();
      for (const item of body.items!) {
        const qty = Math.floor(Number(item.quantity));
        if (qty <= 0) throw new Error('Invalid item quantity.');
        const row = selectProd.get(item.productId) as Record<string, unknown> | undefined;
        if (!row) throw new Error(`Product ${item.productId} is no longer available.`);
        const prod = applyFlashSaleToProduct(mapProductRow(row), activeSales);
        if (prod.stock < qty) {
          throw new Error(`Insufficient stock for ${prod.name} (only ${prod.stock} left).`);
        }

        const updateRes = decrementStock.run(qty, now, prod.id, qty);
        if (updateRes.changes === 0) {
          throw new Error(`Stock changed for ${prod.name}. Please retry.`);
        }

        subtotal += prod.price * qty;
        resolvedItems.push({
          productId: prod.id,
          name: prod.name,
          sku: prod.sku,
          variant: item.variant || prod.variants[0] || 'Standard',
          quantity: qty,
          unitPrice: prod.price,
        });
      }

      const promo = evaluatePromo(body.promoCode, subtotal);
      const shippingCost = subtotal >= 250 || promo.freeShipping ? 0 : 18;
      const discountedSubtotal = Math.max(0, subtotal - promo.discountAmount);
      const taxAmount = Number((discountedSubtotal * 0.08).toFixed(2));
      const total = Number((discountedSubtotal + shippingCost + taxAmount).toFixed(2));

      const orderId = `ord_${crypto.randomUUID().slice(0, 12)}`;
      const countRow = db.prepare('SELECT COUNT(*) as c FROM orders').get() as { c: number };
      const orderNumber = `SBS-${1041 + countRow.c}`;
      const transactionRef =
        paymentMethod === 'cod'
          ? `COD-${crypto.randomBytes(4).toString('hex').toUpperCase()}`
          : `TXN-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      const paymentStatus = paymentMethod === 'cod' ? 'pending_cod' : 'paid';

      db.prepare(
        `
        INSERT INTO orders (
          id, order_number, user_id, customer_name, customer_email, customer_phone,
          shipping_address, city, postal_code, payment_method, payment_status,
          payment_last4, transaction_ref, order_status, subtotal, shipping_cost,
          discount_amount, tax_amount, total, promo_code, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        orderId,
        orderNumber,
        req.authUser?.id || null,
        body.customerName!.trim(),
        body.customerEmail!.trim().toLowerCase(),
        body.customerPhone!.trim(),
        body.shippingAddress!.trim(),
        body.city!.trim(),
        body.postalCode!.trim(),
        paymentMethod,
        paymentStatus,
        paymentLast4,
        transactionRef,
        Number(subtotal.toFixed(2)),
        shippingCost,
        promo.discountAmount,
        taxAmount,
        total,
        promo.valid ? promo.code : null,
        body.notes?.trim() || null,
        now,
        now
      );

      const insertOrderItem = db.prepare(`
        INSERT INTO order_items (
          id, order_id, product_id, product_name, sku, variant_label, quantity, unit_price, line_total
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const ri of resolvedItems) {
        insertOrderItem.run(
          `oi_${crypto.randomUUID().slice(0, 10)}`,
          orderId,
          ri.productId,
          ri.name,
          ri.sku,
          ri.variant,
          ri.quantity,
          ri.unitPrice,
          Number((ri.unitPrice * ri.quantity).toFixed(2))
        );
      }

      return orderId;
    })();

    const order = getOrderWithItems(createdOrderId);
    res.status(201).json({ order });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Checkout failed.';
    res.status(400).json({ error: message });
  }
});

app.post('/api/orders/track', (req, res) => {
  const { orderNumber, email } = req.body as { orderNumber?: string; email?: string };
  if (!orderNumber || !email) {
    res.status(400).json({ error: 'Order number and email are required.' });
    return;
  }

  const row = db
    .prepare(
      'SELECT id FROM orders WHERE UPPER(order_number) = UPPER(?) AND LOWER(customer_email) = LOWER(?)'
    )
    .get(orderNumber.trim(), email.trim()) as { id: string } | undefined;

  if (!row) {
    res.status(404).json({ error: 'No matching order found for that order number and email.' });
    return;
  }

  res.json({ order: getOrderWithItems(row.id) });
});

app.get('/api/orders/track', (req, res) => {
  const orderNumber = typeof req.query.orderNumber === 'string' ? req.query.orderNumber : '';
  const email = typeof req.query.email === 'string' ? req.query.email : '';
  if (!orderNumber || !email) {
    res.status(400).json({ error: 'Order number and email are required.' });
    return;
  }

  const row = db
    .prepare(
      'SELECT id FROM orders WHERE UPPER(order_number) = UPPER(?) AND LOWER(customer_email) = LOWER(?)'
    )
    .get(orderNumber.trim(), email.trim()) as { id: string } | undefined;

  if (!row) {
    res.status(404).json({ error: 'No matching order found for that order number and email.' });
    return;
  }

  res.json({ order: getOrderWithItems(row.id) });
});

app.get('/api/orders/my', requireAuth, (req: AuthenticatedRequest, res) => {
  const rows = db
    .prepare(
      'SELECT id FROM orders WHERE user_id = ? OR LOWER(customer_email) = LOWER(?) ORDER BY created_at DESC'
    )
    .all(req.authUser!.id, req.authUser!.email) as { id: string }[];

  const orders = rows.map((r) => getOrderWithItems(r.id)).filter(Boolean);
  res.json({ orders });
});

// ==================== ADMIN & RBAC ENDPOINTS ====================

app.get('/api/admin/overview', requirePermission('analytics:read'), (_req, res) => {
  const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all() as Record<
    string,
    unknown
  >[];
  const products = db.prepare('SELECT * FROM products').all() as Record<string, unknown>[];

  const validOrders = orders.filter((o) => o.payment_status !== 'refunded' && o.order_status !== 'cancelled');
  const grossRevenue = validOrders.reduce((sum, o) => sum + Number(o.total), 0);
  const totalOrders = orders.length;
  const avgOrderValue = validOrders.length > 0 ? grossRevenue / validOrders.length : 0;
  const pendingFulfillment = orders.filter(
    (o) => o.order_status === 'confirmed' || o.order_status === 'packed'
  ).length;

  const mappedProducts = products.map(mapProductRow);
  const lowStockProducts = mappedProducts.filter(
    (p) => p.active && p.stock > 0 && p.stock <= p.lowStockThreshold
  );
  const outOfStockProducts = mappedProducts.filter((p) => p.active && p.stock <= 0);
  const activeCatalog = mappedProducts.filter((p) => p.active);
  const totalUnits = activeCatalog.reduce((sum, p) => sum + p.stock, 0);
  const retailValue = activeCatalog.reduce((sum, p) => sum + p.price * p.stock, 0);

  const orderStatusBreakdown = {
    confirmed: orders.filter((o) => o.order_status === 'confirmed').length,
    packed: orders.filter((o) => o.order_status === 'packed').length,
    shipped: orders.filter((o) => o.order_status === 'shipped').length,
    delivered: orders.filter((o) => o.order_status === 'delivered').length,
    cancelled: orders.filter((o) => o.order_status === 'cancelled').length,
  };

  // Build 7-day revenue series
  const dayMap = new Map<string, number>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400_000);
    const key = d.toISOString().slice(0, 10);
    dayMap.set(key, 0);
  }
  for (const o of validOrders) {
    const dayKey = String(o.created_at).slice(0, 10);
    if (dayMap.has(dayKey)) {
      dayMap.set(dayKey, (dayMap.get(dayKey) || 0) + Number(o.total));
    }
  }
  const revenueSeries = Array.from(dayMap.entries()).map(([date, revenue]) => ({
    date,
    label: new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
    revenue: Number(revenue.toFixed(2)),
  }));

  // Category revenue mix
  const catRows = db
    .prepare(
      `
      SELECT p.category, SUM(oi.line_total) as total
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      GROUP BY p.category
      ORDER BY total DESC
    `
    )
    .all() as Array<{ category: string; total: number }>;

  // Top selling products
  const topProducts = db
    .prepare(
      `
      SELECT
        oi.product_id as productId,
        oi.product_name as productName,
        oi.sku as sku,
        SUM(oi.quantity) as unitsSold,
        SUM(oi.line_total) as revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.order_status != 'cancelled' AND o.payment_status != 'refunded'
      GROUP BY oi.product_id
      ORDER BY revenue DESC
      LIMIT 5
    `
    )
    .all() as Array<{
    productId: string;
    productName: string;
    sku: string;
    unitsSold: number;
    revenue: number;
  }>;

  res.json({
    metrics: {
      grossRevenue: Number(grossRevenue.toFixed(2)),
      totalOrders,
      avgOrderValue: Number(avgOrderValue.toFixed(2)),
      pendingFulfillment,
      lowStockCount: lowStockProducts.length + outOfStockProducts.length,
      activeProducts: activeCatalog.length,
    },
    inventorySummary: {
      totalSkus: mappedProducts.length,
      totalUnits,
      retailValue: Number(retailValue.toFixed(2)),
      outOfStockCount: outOfStockProducts.length,
      lowStockCount: lowStockProducts.length,
      waitlistCount: (db.prepare('SELECT count(*) as c FROM stock_waitlist').get() as { c: number }).c,
    },
    orderStatusBreakdown,
    topProducts,
    revenueSeries,
    categoryMix: catRows,
    lowStockProducts: [...outOfStockProducts, ...lowStockProducts],
  });
});

app.get('/api/admin/analytics', requirePermission('analytics:read'), (req, res) => {
  const rawRange = typeof req.query.range === 'string' ? req.query.range.toLowerCase() : '30d';
  const range: '7d' | '30d' | '90d' | '12m' =
    rawRange === '7d' || rawRange === '30d' || rawRange === '90d' || rawRange === '12m'
      ? rawRange
      : '30d';
  const rangeDays =
    range === '7d' ? 7 : range === '90d' ? 90 : range === '12m' ? 365 : 30;
  const nowMs = Date.now();
  const cutoffMs = nowMs - rangeDays * 86400_000;
  const cutoffIso = new Date(cutoffMs).toISOString();

  const orders = db.prepare('SELECT * FROM orders ORDER BY created_at ASC').all() as Array<
    Record<string, unknown>
  >;
  const orderItems = db
    .prepare(
      `
      SELECT oi.order_id, oi.product_id, oi.quantity, oi.line_total, p.category
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
    `
    )
    .all() as Array<{
    order_id: string;
    product_id: string;
    quantity: number;
    line_total: number;
    category: string | null;
  }>;

  const productsRaw = db.prepare('SELECT * FROM products').all() as Array<Record<string, unknown>>;
  const mappedProducts = productsRaw.map(mapProductRow);

  // Map order_id -> items
  const itemsByOrderId = new Map<string, typeof orderItems>();
  for (const item of orderItems) {
    const list = itemsByOrderId.get(item.order_id) || [];
    list.push(item);
    itemsByOrderId.set(item.order_id, list);
  }

  const validPeriodOrders = orders.filter((o) => {
    if (o.payment_status === 'refunded' || o.order_status === 'cancelled') return false;
    const t = new Date(String(o.created_at)).getTime();
    return Number.isFinite(t) && t >= cutoffMs;
  });

  // Build time-series buckets
  type TrendBucket = {
    label: string;
    date: string;
    startMs: number;
    endMs: number;
    revenue: number;
    orders: number;
    units: number;
  };
  const buckets: TrendBucket[] = [];

  if (range === '7d') {
    for (let i = 6; i >= 0; i--) {
      const end = new Date(nowMs - i * 86400_000);
      const dayIso = end.toISOString().slice(0, 10);
      const startMs = new Date(`${dayIso}T00:00:00.000Z`).getTime();
      const endMs = startMs + 86400_000 - 1;
      buckets.push({
        label: new Date(startMs + 43200_000).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        date: dayIso,
        startMs,
        endMs,
        revenue: 0,
        orders: 0,
        units: 0,
      });
    }
  } else if (range === '30d') {
    const stepDays = 3;
    const numBuckets = 10;
    for (let i = numBuckets - 1; i >= 0; i--) {
      const endMs = nowMs - i * stepDays * 86400_000;
      const startMs = endMs - stepDays * 86400_000;
      const midDate = new Date((startMs + endMs) / 2);
      buckets.push({
        label: midDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        date: new Date(endMs).toISOString().slice(0, 10),
        startMs,
        endMs,
        revenue: 0,
        orders: 0,
        units: 0,
      });
    }
  } else if (range === '90d') {
    const stepDays = 7;
    const numBuckets = 13;
    for (let i = numBuckets - 1; i >= 0; i--) {
      const endMs = nowMs - i * stepDays * 86400_000;
      const startMs = endMs - stepDays * 86400_000;
      const startLabel = new Date(startMs).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      buckets.push({
        label: startLabel,
        date: new Date(endMs).toISOString().slice(0, 10),
        startMs,
        endMs,
        revenue: 0,
        orders: 0,
        units: 0,
      });
    }
  } else {
    const base = new Date(nowMs);
    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - i, 1));
      const nextMonthStart = new Date(
        Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - i + 1, 1)
      );
      buckets.push({
        label: monthStart.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        date: monthStart.toISOString().slice(0, 7),
        startMs: monthStart.getTime(),
        endMs: nextMonthStart.getTime() - 1,
        revenue: 0,
        orders: 0,
        units: 0,
      });
    }
  }

  let periodRevenue = 0;
  let periodUnits = 0;

  const categorySalesMap = new Map<
    string,
    { revenue: number; unitsSold: number; orderIds: Set<string> }
  >();
  for (const cat of ALLOWED_PRODUCT_CATEGORIES) {
    categorySalesMap.set(cat, { revenue: 0, unitsSold: 0, orderIds: new Set() });
  }

  const skuUnitsSoldMap = new Map<string, { unitsSold: number; revenue: number }>();

  for (const o of validPeriodOrders) {
    const orderId = String(o.id);
    const createdMs = new Date(String(o.created_at)).getTime();
    const orderTotal = Number(o.total || 0);
    const items = itemsByOrderId.get(orderId) || [];
    const orderUnits = items.reduce((sum, it) => sum + Number(it.quantity || 0), 0);

    periodRevenue += orderTotal;
    periodUnits += orderUnits;

    for (const b of buckets) {
      if (createdMs >= b.startMs && createdMs <= b.endMs) {
        b.revenue += orderTotal;
        b.orders += 1;
        b.units += orderUnits;
        break;
      }
    }

    for (const it of items) {
      const qty = Number(it.quantity || 0);
      const lineTotal = Number(it.line_total || 0);
      const cat = it.category || 'Accessories';

      const catEntry = categorySalesMap.get(cat) || {
        revenue: 0,
        unitsSold: 0,
        orderIds: new Set<string>(),
      };
      catEntry.revenue += lineTotal;
      catEntry.unitsSold += qty;
      catEntry.orderIds.add(orderId);
      categorySalesMap.set(cat, catEntry);

      const prevSku = skuUnitsSoldMap.get(it.product_id) || { unitsSold: 0, revenue: 0 };
      prevSku.unitsSold += qty;
      prevSku.revenue += lineTotal;
      skuUnitsSoldMap.set(it.product_id, prevSku);
    }
  }

  const totalCatRevenue = Array.from(categorySalesMap.values()).reduce(
    (sum, v) => sum + v.revenue,
    0
  );

  const topCategories = Array.from(categorySalesMap.entries())
    .map(([category, stats]) => ({
      category,
      revenue: Number(stats.revenue.toFixed(2)),
      unitsSold: stats.unitsSold,
      ordersCount: stats.orderIds.size,
      sharePct:
        totalCatRevenue > 0 ? Number(((stats.revenue / totalCatRevenue) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const inventoryTurnover = ALLOWED_PRODUCT_CATEGORIES.map((category) => {
    const catProducts = mappedProducts.filter((p) => p.active && p.category === category);
    const currentStock = catProducts.reduce((sum, p) => sum + Math.max(0, p.stock), 0);
    const stockValue = catProducts.reduce((sum, p) => sum + Math.max(0, p.stock) * p.price, 0);
    const unitsSold = categorySalesMap.get(category)?.unitsSold || 0;
    const avgStock = Math.max(1, currentStock + unitsSold / 2);
    const turnoverRate = Number((unitsSold / avgStock).toFixed(2));
    const daysOfSupply =
      unitsSold > 0 ? Math.min(999, Math.round((currentStock / unitsSold) * rangeDays)) : 999;

    return {
      category,
      unitsSold,
      currentStock,
      stockValue: Number(stockValue.toFixed(2)),
      turnoverRate,
      daysOfSupply,
    };
  }).sort((a, b) => b.turnoverRate - a.turnoverRate);

  const skuTurnover = mappedProducts
    .filter((p) => p.active)
    .map((p) => {
      const soldStats = skuUnitsSoldMap.get(p.id) || { unitsSold: 0, revenue: 0 };
      const currentStock = Math.max(0, p.stock);
      const avgStock = Math.max(1, currentStock + soldStats.unitsSold / 2);
      const turnoverRate = Number((soldStats.unitsSold / avgStock).toFixed(2));
      const denom = currentStock + soldStats.unitsSold;
      const sellThroughPct = denom > 0 ? Number(((soldStats.unitsSold / denom) * 100).toFixed(1)) : 0;
      const daysOfSupply =
        soldStats.unitsSold > 0
          ? Math.min(999, Math.round((currentStock / soldStats.unitsSold) * rangeDays))
          : 999;

      const status: 'Fast Mover' | 'Healthy' | 'Slow / Restock' =
        turnoverRate >= 0.25 || sellThroughPct >= 20
          ? 'Fast Mover'
          : currentStock <= p.lowStockThreshold || (soldStats.unitsSold === 0 && currentStock > 10)
          ? 'Slow / Restock'
          : 'Healthy';

      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        category: p.category,
        price: p.price,
        currentStock,
        lowStockThreshold: p.lowStockThreshold,
        unitsSold: soldStats.unitsSold,
        revenue: Number(soldStats.revenue.toFixed(2)),
        turnoverRate,
        sellThroughPct,
        daysOfSupply,
        status,
      };
    })
    .sort((a, b) => b.turnoverRate - a.turnoverRate || b.revenue - a.revenue);

  const totalActiveStock = mappedProducts
    .filter((p) => p.active)
    .reduce((sum, p) => sum + Math.max(0, p.stock), 0);
  const avgStockAll = Math.max(1, totalActiveStock + periodUnits / 2);
  const avgTurnoverRate = Number((periodUnits / avgStockAll).toFixed(2));
  const totalDenom = totalActiveStock + periodUnits;
  const sellThroughPct = totalDenom > 0 ? Number(((periodUnits / totalDenom) * 100).toFixed(1)) : 0;

  res.json({
    range,
    rangeDays,
    cutoffIso,
    summary: {
      periodRevenue: Number(periodRevenue.toFixed(2)),
      periodOrders: validPeriodOrders.length,
      periodUnits,
      avgOrderValue:
        validPeriodOrders.length > 0
          ? Number((periodRevenue / validPeriodOrders.length).toFixed(2))
          : 0,
      avgTurnoverRate,
      sellThroughPct,
      topCategory: topCategories[0]?.category || 'Consoles',
    },
    salesTrend: buckets.map((b) => ({
      label: b.label,
      date: b.date,
      revenue: Number(b.revenue.toFixed(2)),
      orders: b.orders,
      units: b.units,
    })),
    topCategories,
    inventoryTurnover,
    skuTurnover,
  });
});

app.get('/api/admin/restock-waitlist', requirePermission('products:read'), (_req, res) => {
  const rows = db
    .prepare('SELECT * FROM stock_waitlist ORDER BY created_at DESC')
    .all() as Record<string, unknown>[];
  res.json({ waitlist: rows.map(mapWaitlistRow) });
});

app.get('/api/admin/reviews', requirePermission('products:read'), (_req, res) => {
  const rows = db
    .prepare('SELECT * FROM product_reviews ORDER BY created_at DESC')
    .all() as Record<string, unknown>[];
  const reviews = rows.map(mapReviewRow);
  const avg =
    reviews.length > 0
      ? Number((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(2))
      : 0;
  res.json({
    reviews,
    averageRating: avg,
    totalReviews: reviews.length,
  });
});

app.delete('/api/admin/reviews/:id', requirePermission('products:write'), (req: AuthenticatedRequest, res) => {
  const row = db
    .prepare('SELECT id, product_id, product_name, author_name, rating FROM product_reviews WHERE id = ?')
    .get(req.params.id) as { id: string; product_id: string; product_name: string; author_name: string; rating: number } | undefined;

  if (!row) {
    res.status(404).json({ error: 'Review not found.' });
    return;
  }

  db.prepare('DELETE FROM product_reviews WHERE id = ?').run(row.id);

  logAudit(
    req.authUser!.id,
    req.authUser!.name,
    req.authUser!.roleName,
    'REVIEW_REMOVED',
    'product',
    row.product_id,
    `Removed ${row.rating}-star review by ${row.author_name} on ${row.product_name || row.product_id}`
  );
  res.json({ ok: true });
});

app.get('/api/admin/products', requirePermission('products:read'), (_req, res) => {
  const rows = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all() as Record<
    string,
    unknown
  >[];
  res.json({
    products: rows.map((row) => {
      const mapped = mapProductRow(row);
      const summary = computeRatingSummary(mapped.id);
      return {
        ...mapped,
        averageRating: summary.averageRating,
        reviewCount: summary.reviewCount,
      };
    }),
  });
});

const ALLOWED_PRODUCT_CATEGORIES = [
  'Consoles',
  'Monitors',
  'Audio',
  'Peripherals',
  'Accessories',
];

function isValidMediaUrl(url: string): boolean {
  return (
    url.startsWith('/') ||
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('data:image/')
  );
}

app.post('/api/admin/products', requirePermission('products:write'), (req: AuthenticatedRequest, res) => {
  const b = req.body as {
    sku?: string;
    slug?: string;
    name?: string;
    brand?: string;
    category?: string;
    price?: number;
    compareAtPrice?: number | null;
    costPrice?: number | null;
    stock?: number;
    lowStockThreshold?: number;
    condition?: 'New' | 'Refurbished' | 'Open Box';
    warranty?: string;
    weight?: string | null;
    dimensions?: string | null;
    whatsInBox?: string[];
    tags?: string[];
    badge?: string | null;
    tagline?: string;
    description?: string;
    specs?: Record<string, string>;
    variants?: string[];
    visualKey?: string;
    imageUrl?: string | null;
    images?: string[];
    featured?: boolean;
    active?: boolean;
  };

  const cleanSku = (b.sku || '').trim().toUpperCase();
  const cleanName = (b.name || '').trim();
  const cleanBrand = (b.brand || 'Sam Brand').trim();
  const priceNum = Number(b.price);

  if (!cleanSku || !/^[A-Z0-9_-]{3,32}$/.test(cleanSku)) {
    res.status(400).json({ error: 'SKU must be 3-32 characters (letters, numbers, dashes, or underscores).' });
    return;
  }

  if (cleanName.length < 2 || cleanBrand.length < 2) {
    res.status(400).json({ error: 'Product name and brand (min 2 characters each) are required.' });
    return;
  }

  if (!b.category || !ALLOWED_PRODUCT_CATEGORIES.includes(b.category)) {
    res.status(400).json({ error: 'Please select a valid hardware category.' });
    return;
  }

  if (!Number.isFinite(priceNum) || priceNum <= 0) {
    res.status(400).json({ error: 'Sale price must be a positive number greater than $0.' });
    return;
  }

  const stockNum = b.stock !== undefined ? Number(b.stock) : 10;
  if (!Number.isFinite(stockNum) || !Number.isInteger(stockNum) || stockNum < 0) {
    res.status(400).json({ error: 'Stock quantity must be a whole number (0 or greater).' });
    return;
  }

  const thresholdNum = b.lowStockThreshold !== undefined ? Number(b.lowStockThreshold) : 5;
  if (!Number.isFinite(thresholdNum) || !Number.isInteger(thresholdNum) || thresholdNum < 1) {
    res.status(400).json({ error: 'Low stock alert threshold must be a whole number of at least 1.' });
    return;
  }

  const hasCompareAt = b.compareAtPrice !== undefined && b.compareAtPrice !== null && String(b.compareAtPrice) !== '';
  const compareAtNum = hasCompareAt ? Number(b.compareAtPrice) : null;
  if (compareAtNum !== null && (!Number.isFinite(compareAtNum) || compareAtNum <= priceNum)) {
    res.status(400).json({ error: 'Compare-at MSRP must be strictly higher than the sale price.' });
    return;
  }

  const hasCostPrice = b.costPrice !== undefined && b.costPrice !== null && String(b.costPrice) !== '';
  const costPriceNum = hasCostPrice ? Number(b.costPrice) : null;
  if (costPriceNum !== null && (!Number.isFinite(costPriceNum) || costPriceNum < 0)) {
    res.status(400).json({ error: 'Unit cost price must be 0 or greater.' });
    return;
  }

  const scope = req.authUser!.departmentScope;
  if (scope !== 'all' && !scope.split(',').includes(b.category)) {
    res.status(403).json({
      error: `Department rule violation: your account is scoped to [${scope}] and cannot add items to ${b.category}.`,
    });
    return;
  }

  const duplicateSku = db.prepare('SELECT id FROM products WHERE UPPER(sku) = ?').get(cleanSku);
  if (duplicateSku) {
    res.status(409).json({ error: `A product with SKU "${cleanSku}" already exists.` });
    return;
  }

  if (compareAtNum !== null && compareAtNum > priceNum) {
    const markdownPct = Math.round(((compareAtNum - priceNum) / compareAtNum) * 100);
    if (markdownPct > req.authUser!.maxDiscountPct) {
      res.status(403).json({
        error: `Role discount cap exceeded: '${req.authUser!.roleName}' may apply up to ${req.authUser!.maxDiscountPct}% markdown, but this pricing implies ${markdownPct}% off.`,
      });
      return;
    }
  }

  const rawImages = Array.isArray(b.images) ? b.images.map((u) => u.trim()).filter(Boolean) : [];
  const invalidImg = rawImages.find((u) => !isValidMediaUrl(u));
  if (invalidImg) {
    res.status(400).json({ error: 'Every product image must be a valid URL or uploaded path.' });
    return;
  }
  const cleanImages = Array.from(new Set(rawImages)).slice(0, 12);
  const candidatePrimary = b.imageUrl?.trim() || null;
  if (candidatePrimary && !isValidMediaUrl(candidatePrimary)) {
    res.status(400).json({ error: 'Primary image URL is invalid.' });
    return;
  }
  const primaryImage = candidatePrimary || cleanImages[0] || null;
  if (primaryImage && !cleanImages.includes(primaryImage)) {
    cleanImages.unshift(primaryImage);
  }

  const cleanSpecs: Record<string, string> = {};
  if (b.specs && typeof b.specs === 'object') {
    for (const [k, v] of Object.entries(b.specs)) {
      const ck = String(k).trim();
      const cv = String(v).trim();
      if (ck && cv) cleanSpecs[ck] = cv;
    }
  }

  const id = `prod_${crypto.randomUUID().slice(0, 10)}`;
  const rawSlug = (b.slug?.trim() || cleanName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const slug = `${rawSlug || 'product'}-${id.slice(-4)}`;
  const now = new Date().toISOString();
  const condition =
    b.condition === 'Refurbished' || b.condition === 'Open Box' ? b.condition : 'New';

  try {
    db.prepare(
      `
      INSERT INTO products (
        id, sku, slug, name, brand, category, price, compare_at_price, cost_price, stock,
        low_stock_threshold, condition, warranty, weight, dimensions, whats_in_box, tags,
        badge, tagline, description, specs, variants,
        visual_key, image_url, images, featured, active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      id,
      cleanSku,
      slug,
      cleanName,
      cleanBrand,
      b.category,
      priceNum,
      compareAtNum,
      costPriceNum,
      stockNum,
      thresholdNum,
      condition,
      b.warranty?.trim() || '2-Year Official Sam Brand Warranty',
      b.weight?.trim() || null,
      b.dimensions?.trim() || null,
      JSON.stringify(Array.isArray(b.whatsInBox) ? b.whatsInBox.map((x) => x.trim()).filter(Boolean) : []),
      JSON.stringify(Array.isArray(b.tags) ? b.tags.map((x) => x.trim().toLowerCase()).filter(Boolean) : []),
      b.badge?.trim() || null,
      b.tagline?.trim() || 'Precision engineered gaming hardware.',
      b.description?.trim() || 'Curated by Sam Brand Store engineering team.',
      JSON.stringify(
        Object.keys(cleanSpecs).length
          ? cleanSpecs
          : { Warranty: b.warranty?.trim() || '2-Year Official Warranty' }
      ),
      JSON.stringify(
        Array.isArray(b.variants) && b.variants.map((v) => v.trim()).filter(Boolean).length
          ? b.variants.map((v) => v.trim()).filter(Boolean)
          : ['Standard Edition']
      ),
      b.visualKey || 'console-pro',
      primaryImage,
      JSON.stringify(cleanImages.slice(0, 12)),
      b.featured ? 1 : 0,
      b.active === false ? 0 : 1,
      now,
      now
    );

    logAudit(
      req.authUser!.id,
      req.authUser!.name,
      req.authUser!.roleName,
      'PRODUCT_CREATED',
      'product',
      id,
      `Created ${cleanName} (${cleanSku}) at $${priceNum} with ${cleanImages.length} image(s)`
    );

    const created = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as Record<
      string,
      unknown
    >;
    res.status(201).json({ product: mapProductRow(created) });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to create product.' });
  }
});

app.patch('/api/admin/products/:id', requirePermission('products:write'), (req: AuthenticatedRequest, res) => {
  const existingRow = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id) as
    | Record<string, unknown>
    | undefined;
  if (!existingRow) {
    res.status(404).json({ error: 'Product not found.' });
    return;
  }

  const existing = mapProductRow(existingRow);
  const scope = req.authUser!.departmentScope;
  if (scope !== 'all' && !scope.split(',').includes(existing.category)) {
    res.status(403).json({
      error: `Department rule violation: your account is restricted to [${scope}].`,
    });
    return;
  }

  const b = req.body as Partial<{
    name: string;
    brand: string;
    category: string;
    price: number;
    compareAtPrice: number | null;
    costPrice: number | null;
    stock: number;
    lowStockThreshold: number;
    condition: 'New' | 'Refurbished' | 'Open Box';
    warranty: string;
    weight: string | null;
    dimensions: string | null;
    whatsInBox: string[];
    tags: string[];
    badge: string | null;
    tagline: string;
    description: string;
    specs: Record<string, string>;
    variants: string[];
    visualKey: string;
    featured: boolean;
    active: boolean;
    imageUrl: string | null;
    images: string[];
  }>;

  if (b.category !== undefined) {
    if (!ALLOWED_PRODUCT_CATEGORIES.includes(b.category)) {
      res.status(400).json({ error: 'Invalid hardware category selected.' });
      return;
    }
    if (scope !== 'all' && !scope.split(',').includes(b.category)) {
      res.status(403).json({
        error: `Department rule violation: your account is restricted to [${scope}].`,
      });
      return;
    }
  }

  if (b.name !== undefined && b.name.trim().length < 2) {
    res.status(400).json({ error: 'Product name must be at least 2 characters.' });
    return;
  }
  if (b.brand !== undefined && b.brand.trim().length < 2) {
    res.status(400).json({ error: 'Brand name must be at least 2 characters.' });
    return;
  }

  const nextPrice = b.price !== undefined ? Number(b.price) : existing.price;
  if (!Number.isFinite(nextPrice) || nextPrice <= 0) {
    res.status(400).json({ error: 'Sale price must be a positive number greater than $0.' });
    return;
  }

  const nextCompareAt =
    b.compareAtPrice !== undefined
      ? b.compareAtPrice !== null && String(b.compareAtPrice) !== ''
        ? Number(b.compareAtPrice)
        : null
      : existing.compareAtPrice;
  if (nextCompareAt !== null && (!Number.isFinite(nextCompareAt) || nextCompareAt <= nextPrice)) {
    res.status(400).json({ error: 'Compare-at MSRP must be strictly higher than the sale price.' });
    return;
  }

  const nextCostPrice =
    b.costPrice !== undefined
      ? b.costPrice !== null && String(b.costPrice) !== ''
        ? Number(b.costPrice)
        : null
      : existing.costPrice;
  if (nextCostPrice !== null && (!Number.isFinite(nextCostPrice) || nextCostPrice < 0)) {
    res.status(400).json({ error: 'Unit cost price must be 0 or greater.' });
    return;
  }

  const nextStock = b.stock !== undefined ? Number(b.stock) : existing.stock;
  if (!Number.isFinite(nextStock) || !Number.isInteger(nextStock) || nextStock < 0) {
    res.status(400).json({ error: 'Stock quantity must be a whole number (0 or greater).' });
    return;
  }

  const nextThreshold =
    b.lowStockThreshold !== undefined ? Number(b.lowStockThreshold) : existing.lowStockThreshold;
  if (!Number.isFinite(nextThreshold) || !Number.isInteger(nextThreshold) || nextThreshold < 1) {
    res.status(400).json({ error: 'Low stock alert threshold must be a whole number of at least 1.' });
    return;
  }

  if (nextCompareAt && nextCompareAt > nextPrice && (b.price !== undefined || b.compareAtPrice !== undefined)) {
    const markdownPct = Math.round(((nextCompareAt - nextPrice) / nextCompareAt) * 100);
    if (markdownPct > req.authUser!.maxDiscountPct) {
      res.status(403).json({
        error: `Role discount cap exceeded: '${req.authUser!.roleName}' may apply up to ${req.authUser!.maxDiscountPct}% markdown, but this update implies ${markdownPct}% off.`,
      });
      return;
    }
  }

  const nextImages =
    b.images !== undefined
      ? Array.from(new Set(b.images.map((u) => u.trim()).filter(Boolean))).slice(0, 12)
      : [...existing.images];
  if (nextImages.some((u) => !isValidMediaUrl(u))) {
    res.status(400).json({ error: 'Every product image must be a valid URL or uploaded path.' });
    return;
  }
  const nextPrimaryImage =
    b.imageUrl !== undefined
      ? b.imageUrl
      : nextImages[0] ?? existing.imageUrl;
  if (nextPrimaryImage && !isValidMediaUrl(nextPrimaryImage)) {
    res.status(400).json({ error: 'Primary image URL is invalid.' });
    return;
  }
  if (nextPrimaryImage && !nextImages.includes(nextPrimaryImage)) {
    nextImages.unshift(nextPrimaryImage);
  }

  let nextSpecs = existing.specs;
  if (b.specs !== undefined && typeof b.specs === 'object') {
    const cleanSpecs: Record<string, string> = {};
    for (const [k, v] of Object.entries(b.specs)) {
      const ck = String(k).trim();
      const cv = String(v).trim();
      if (ck && cv) cleanSpecs[ck] = cv;
    }
    nextSpecs = Object.keys(cleanSpecs).length ? cleanSpecs : existing.specs;
  }

  const now = new Date().toISOString();
  db.prepare(
    `
    UPDATE products SET
      name = ?, brand = ?, category = ?, price = ?, compare_at_price = ?, cost_price = ?,
      stock = ?, low_stock_threshold = ?, condition = ?, warranty = ?, weight = ?, dimensions = ?,
      whats_in_box = ?, tags = ?, badge = ?, tagline = ?, description = ?,
      specs = ?, variants = ?, visual_key = ?,
      featured = ?, active = ?, image_url = ?, images = ?, updated_at = ?
    WHERE id = ?
  `
  ).run(
    b.name !== undefined ? b.name.trim() : existing.name,
    b.brand !== undefined ? b.brand.trim() : existing.brand,
    b.category !== undefined ? b.category : existing.category,
    nextPrice,
    nextCompareAt,
    nextCostPrice,
    nextStock,
    nextThreshold,
    b.condition !== undefined ? b.condition : existing.condition,
    b.warranty !== undefined ? b.warranty.trim() : existing.warranty,
    b.weight !== undefined ? b.weight : existing.weight,
    b.dimensions !== undefined ? b.dimensions : existing.dimensions,
    JSON.stringify(
      b.whatsInBox !== undefined
        ? b.whatsInBox.map((x) => x.trim()).filter(Boolean)
        : existing.whatsInBox
    ),
    JSON.stringify(
      b.tags !== undefined
        ? b.tags.map((x) => x.trim().toLowerCase()).filter(Boolean)
        : existing.tags
    ),
    b.badge !== undefined ? b.badge : existing.badge,
    b.tagline !== undefined ? b.tagline.trim() : existing.tagline,
    b.description !== undefined ? b.description.trim() : existing.description,
    JSON.stringify(nextSpecs),
    JSON.stringify(
      b.variants !== undefined
        ? b.variants.map((v) => v.trim()).filter(Boolean)
        : existing.variants
    ),
    b.visualKey !== undefined ? b.visualKey : existing.visualKey,
    b.featured !== undefined ? (b.featured ? 1 : 0) : existing.featured ? 1 : 0,
    b.active !== undefined ? (b.active ? 1 : 0) : existing.active ? 1 : 0,
    nextPrimaryImage || null,
    JSON.stringify(nextImages.slice(0, 12)),
    now,
    existing.id
  );

  logAudit(
    req.authUser!.id,
    req.authUser!.name,
    req.authUser!.roleName,
    'PRODUCT_UPDATED',
    'product',
    existing.id,
    `Updated ${existing.sku} (stock: ${nextStock}, price: $${nextPrice})`
  );

  const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(existing.id) as Record<
    string,
    unknown
  >;
  res.json({ product: mapProductRow(updated) });
});

app.delete('/api/admin/products/:id', requirePermission('products:delete'), (req: AuthenticatedRequest, res) => {
  const existing = db.prepare('SELECT id, name, sku FROM products WHERE id = ?').get(req.params.id) as
    | { id: string; name: string; sku: string }
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Product not found.' });
    return;
  }

  db.prepare('DELETE FROM products WHERE id = ?').run(existing.id);
  logAudit(
    req.authUser!.id,
    req.authUser!.name,
    req.authUser!.roleName,
    'PRODUCT_DELETED',
    'product',
    existing.id,
    `Deleted product ${existing.name} (${existing.sku})`
  );
  res.json({ ok: true });
});

app.get('/api/admin/orders', requirePermission('orders:read'), (_req, res) => {
  const rows = db.prepare('SELECT id FROM orders ORDER BY created_at DESC').all() as { id: string }[];
  const orders = rows.map((r) => getOrderWithItems(r.id)).filter(Boolean);
  res.json({ orders });
});

app.patch(
  '/api/admin/orders/:id/status',
  requirePermission('orders:manage'),
  (req: AuthenticatedRequest, res) => {
    const { orderStatus } = req.body as { orderStatus?: string };
    const allowed = ['confirmed', 'packed', 'shipped', 'delivered', 'cancelled'];
    if (!orderStatus || !allowed.includes(orderStatus)) {
      res.status(400).json({ error: 'Invalid order status.' });
      return;
    }

    const existing = getOrderWithItems(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE orders SET order_status = ?, updated_at = ? WHERE id = ?').run(
      orderStatus,
      now,
      existing.id
    );

    logAudit(
      req.authUser!.id,
      req.authUser!.name,
      req.authUser!.roleName,
      'ORDER_STATUS_UPDATED',
      'order',
      existing.orderNumber,
      `Moved order ${existing.orderNumber} from ${existing.orderStatus} to ${orderStatus}`
    );

    res.json({ order: getOrderWithItems(existing.id) });
  }
);

app.post(
  '/api/admin/orders/:id/refund',
  requirePermission('orders:refund'),
  (req: AuthenticatedRequest, res) => {
    const existing = getOrderWithItems(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    if (existing.paymentStatus === 'refunded') {
      res.status(400).json({ error: 'Order has already been refunded.' });
      return;
    }

    const maxAllowed = req.authUser!.maxRefundAmount;
    if (existing.total > maxAllowed) {
      res.status(403).json({
        error: `Role refund cap exceeded: '${req.authUser!.roleName}' may refund up to $${maxAllowed.toFixed(2)}, but order total is $${existing.total.toFixed(2)}.`,
      });
      return;
    }

    const now = new Date().toISOString();
    db.prepare(
      "UPDATE orders SET payment_status = 'refunded', order_status = 'cancelled', updated_at = ? WHERE id = ?"
    ).run(now, existing.id);

    logAudit(
      req.authUser!.id,
      req.authUser!.name,
      req.authUser!.roleName,
      'ORDER_REFUNDED',
      'order',
      existing.orderNumber,
      `Refunded $${existing.total.toFixed(2)} for ${existing.orderNumber} (${existing.transactionRef})`
    );

    res.json({ order: getOrderWithItems(existing.id) });
  }
);

app.get('/api/admin/roles', requireAuth, (req: AuthenticatedRequest, res) => {
  const hasAccess =
    req.authUser!.permissions.includes('staff:read') ||
    req.authUser!.permissions.includes('roles:manage');
  if (!hasAccess) {
    res.status(403).json({ error: 'Insufficient permissions to view roles.' });
    return;
  }
  const rows = db.prepare('SELECT * FROM roles ORDER BY is_system DESC, name ASC').all() as Record<
    string,
    unknown
  >[];
  res.json({ roles: rows.map(mapRoleRow) });
});

app.post('/api/admin/roles', requirePermission('roles:manage'), (req: AuthenticatedRequest, res) => {
  const { name, description, permissions, maxDiscountPct, maxRefundAmount } = req.body as {
    name?: string;
    description?: string;
    permissions?: PermissionKey[];
    maxDiscountPct?: number;
    maxRefundAmount?: number;
  };

  if (!name?.trim()) {
    res.status(400).json({ error: 'Role name is required.' });
    return;
  }

  const id = `role_${crypto.randomUUID().slice(0, 8)}`;
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const now = new Date().toISOString();

  db.prepare(
    `
    INSERT INTO roles (id, name, slug, description, permissions, max_discount_pct, max_refund_amount, is_system, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
  `
  ).run(
    id,
    name.trim(),
    `${slug}-${id.slice(-3)}`,
    description?.trim() || 'Custom employee role.',
    JSON.stringify(Array.isArray(permissions) ? permissions : []),
    Math.min(100, Math.max(0, Number(maxDiscountPct || 0))),
    Math.max(0, Number(maxRefundAmount || 0)),
    now
  );

  logAudit(
    req.authUser!.id,
    req.authUser!.name,
    req.authUser!.roleName,
    'ROLE_CREATED',
    'role',
    id,
    `Created custom role '${name.trim()}' with ${(permissions || []).length} permissions.`
  );

  const row = db.prepare('SELECT * FROM roles WHERE id = ?').get(id) as Record<string, unknown>;
  res.status(201).json({ role: mapRoleRow(row) });
});

app.patch('/api/admin/roles/:id', requirePermission('roles:manage'), (req: AuthenticatedRequest, res) => {
  const existingRow = db.prepare('SELECT * FROM roles WHERE id = ?').get(req.params.id) as
    | Record<string, unknown>
    | undefined;
  if (!existingRow) {
    res.status(404).json({ error: 'Role not found.' });
    return;
  }

  const existing = mapRoleRow(existingRow);
  if (existing.slug === 'owner') {
    res.status(400).json({ error: 'Store Owner master permissions cannot be downgraded.' });
    return;
  }

  const { name, description, permissions, maxDiscountPct, maxRefundAmount } = req.body as {
    name?: string;
    description?: string;
    permissions?: PermissionKey[];
    maxDiscountPct?: number;
    maxRefundAmount?: number;
  };

  db.prepare(
    `
    UPDATE roles SET name = ?, description = ?, permissions = ?, max_discount_pct = ?, max_refund_amount = ?
    WHERE id = ?
  `
  ).run(
    name !== undefined ? name.trim() : existing.name,
    description !== undefined ? description.trim() : existing.description,
    permissions !== undefined ? JSON.stringify(permissions) : JSON.stringify(existing.permissions),
    maxDiscountPct !== undefined ? Math.min(100, Math.max(0, Number(maxDiscountPct))) : existing.maxDiscountPct,
    maxRefundAmount !== undefined ? Math.max(0, Number(maxRefundAmount)) : existing.maxRefundAmount,
    existing.id
  );

  logAudit(
    req.authUser!.id,
    req.authUser!.name,
    req.authUser!.roleName,
    'ROLE_UPDATED',
    'role',
    existing.id,
    `Updated permissions and caps for role '${name || existing.name}'.`
  );

  const updated = db.prepare('SELECT * FROM roles WHERE id = ?').get(existing.id) as Record<
    string,
    unknown
  >;
  res.json({ role: mapRoleRow(updated) });
});

app.get('/api/admin/staff', requirePermission('staff:read'), (_req, res) => {
  const rows = db
    .prepare(
      `
      SELECT
        u.id, u.name, u.email, u.role_id, u.custom_permissions,
        u.department_scope, u.status, u.last_login_at, u.created_at,
        r.name as role_name, r.slug as role_slug, r.permissions as role_permissions,
        r.max_discount_pct, r.max_refund_amount
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE r.slug != 'customer'
      ORDER BY u.created_at ASC
    `
    )
    .all() as Record<string, unknown>[];

  const staff = rows.map((row) => {
    const rolePerms = JSON.parse(String(row.role_permissions || '[]')) as PermissionKey[];
    const customPerms = JSON.parse(String(row.custom_permissions || '[]')) as PermissionKey[];
    return {
      id: String(row.id),
      name: String(row.name),
      email: String(row.email),
      roleId: String(row.role_id),
      roleName: String(row.role_name),
      roleSlug: String(row.role_slug),
      permissions: Array.from(new Set([...rolePerms, ...customPerms])),
      customPermissions: customPerms,
      departmentScope: String(row.department_scope || 'all'),
      maxDiscountPct: Number(row.max_discount_pct || 0),
      maxRefundAmount: Number(row.max_refund_amount || 0),
      status: row.status === 'suspended' ? 'suspended' : 'active',
      lastLoginAt: row.last_login_at ? String(row.last_login_at) : null,
    };
  });

  res.json({ staff });
});

app.post('/api/admin/staff', requirePermission('staff:manage'), (req: AuthenticatedRequest, res) => {
  const { name, email, password, roleId, departmentScope, customPermissions } = req.body as {
    name?: string;
    email?: string;
    password?: string;
    roleId?: string;
    departmentScope?: string;
    customPermissions?: PermissionKey[];
  };

  if (!name?.trim() || !email?.trim() || !password || !roleId) {
    res.status(400).json({ error: 'Name, email, temporary password, and role are required.' });
    return;
  }

  const existing = db
    .prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)')
    .get(email.trim());
  if (existing) {
    res.status(409).json({ error: 'An employee or user with this email already exists.' });
    return;
  }

  const role = db.prepare('SELECT id, name FROM roles WHERE id = ?').get(roleId) as
    | { id: string; name: string }
    | undefined;
  if (!role) {
    res.status(400).json({ error: 'Selected role does not exist.' });
    return;
  }

  const id = `usr_${crypto.randomUUID().slice(0, 10)}`;
  const now = new Date().toISOString();
  db.prepare(
    `
    INSERT INTO users (id, name, email, password_hash, role_id, custom_permissions, department_scope, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)
  `
  ).run(
    id,
    name.trim(),
    email.trim().toLowerCase(),
    hashPassword(password),
    roleId,
    JSON.stringify(Array.isArray(customPermissions) ? customPermissions : []),
    departmentScope?.trim() || 'all',
    now
  );

  logAudit(
    req.authUser!.id,
    req.authUser!.name,
    req.authUser!.roleName,
    'STAFF_CREATED',
    'user',
    id,
    `Added employee ${name.trim()} (${email.trim()}) as ${role.name} [scope: ${departmentScope || 'all'}]`
  );

  res.status(201).json({ user: loadUserById(id) });
});

app.patch('/api/admin/staff/:id', requirePermission('staff:manage'), (req: AuthenticatedRequest, res) => {
  const target = loadUserById(req.params.id);
  if (!target) {
    res.status(404).json({ error: 'Employee not found.' });
    return;
  }
  if (target.id === req.authUser!.id && req.body.status === 'suspended') {
    res.status(400).json({ error: 'You cannot suspend your own active session.' });
    return;
  }

  const { name, password, roleId, status, departmentScope, customPermissions } = req.body as {
    name?: string;
    password?: string;
    roleId?: string;
    status?: 'active' | 'suspended';
    departmentScope?: string;
    customPermissions?: PermissionKey[];
  };

  if (password !== undefined && password.trim().length > 0 && password.trim().length < 6) {
    res.status(400).json({ error: 'New employee password must be at least 6 characters.' });
    return;
  }

  if (password && password.trim().length >= 6) {
    db.prepare(
      `
      UPDATE users SET
        name = ?,
        password_hash = ?,
        role_id = ?,
        status = ?,
        department_scope = ?,
        custom_permissions = ?
      WHERE id = ?
    `
    ).run(
      name?.trim() || target.name,
      hashPassword(password.trim()),
      roleId ?? target.roleId,
      status ?? target.status,
      departmentScope ?? target.departmentScope,
      customPermissions !== undefined
        ? JSON.stringify(customPermissions)
        : JSON.stringify(target.customPermissions),
      target.id
    );
  } else {
    db.prepare(
      `
      UPDATE users SET
        name = ?,
        role_id = ?,
        status = ?,
        department_scope = ?,
        custom_permissions = ?
      WHERE id = ?
    `
    ).run(
      name?.trim() || target.name,
      roleId ?? target.roleId,
      status ?? target.status,
      departmentScope ?? target.departmentScope,
      customPermissions !== undefined
        ? JSON.stringify(customPermissions)
        : JSON.stringify(target.customPermissions),
      target.id
    );
  }

  logAudit(
    req.authUser!.id,
    req.authUser!.name,
    req.authUser!.roleName,
    'STAFF_UPDATED',
    'user',
    target.id,
    `Updated ${name?.trim() || target.name}: role=${roleId ?? target.roleId}, status=${status ?? target.status}, scope=${departmentScope ?? target.departmentScope}${password ? ' (password reset)' : ''}`
  );

  res.json({ user: loadUserById(target.id) });
});

app.delete('/api/admin/staff/:id', requirePermission('staff:manage'), (req: AuthenticatedRequest, res) => {
  const target = loadUserById(req.params.id);
  if (!target) {
    res.status(404).json({ error: 'Employee not found.' });
    return;
  }
  if (target.id === req.authUser!.id) {
    res.status(400).json({ error: 'You cannot delete your own active admin account.' });
    return;
  }
  if (target.roleSlug === 'owner') {
    res.status(403).json({ error: 'Store Owner accounts cannot be deleted.' });
    return;
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(target.id);
  logAudit(
    req.authUser!.id,
    req.authUser!.name,
    req.authUser!.roleName,
    'STAFF_DELETED',
    'user',
    target.id,
    `Removed employee ${target.name} (${target.email})`
  );
  res.json({ ok: true });
});

app.get('/api/admin/audit-logs', requirePermission('audit:read'), (_req, res) => {
  const rows = db
    .prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 60')
    .all() as Record<string, unknown>[];
  res.json({ logs: rows.map(mapAuditRow) });
});

app.get('/api/admin/notifications', requireAuth, (req: AuthenticatedRequest, res) => {
  if (req.authUser!.roleSlug === 'customer') {
    res.status(403).json({ error: 'Staff access required.' });
    return;
  }
  const perms = req.authUser!.permissions;
  const rows = db
    .prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 25')
    .all() as Record<string, unknown>[];

  const mapped = rows.map(mapAuditRow).filter((log) => {
    if (
      log.action.startsWith('PRODUCT_') ||
      log.action.startsWith('CAMPAIGN_') ||
      log.action.startsWith('FLASH_SALE_')
    ) {
      return perms.includes('products:read') || perms.includes('analytics:read') || perms.includes('audit:read');
    }
    if (log.action.startsWith('STAFF_') || log.action.startsWith('ROLE_')) {
      return perms.includes('staff:read') || perms.includes('roles:manage') || perms.includes('audit:read');
    }
    if (log.action.startsWith('ORDER_')) {
      return perms.includes('orders:read') || perms.includes('audit:read');
    }
    return perms.includes('audit:read') || perms.includes('analytics:read');
  });

  res.json({ notifications: mapped });
});

app.patch('/api/admin/settings', requirePermission('roles:manage'), (req: AuthenticatedRequest, res) => {
  const { whatsappNumber, storeName, logoUrl } = req.body as {
    whatsappNumber?: string;
    storeName?: string;
    logoUrl?: string;
  };
  if (whatsappNumber !== undefined && whatsappNumber.replace(/\D/g, '').length < 7) {
    res.status(400).json({ error: 'Please provide a valid WhatsApp phone number with country code.' });
    return;
  }
  const updated = updateStoreSettings({ whatsappNumber, storeName, logoUrl });
  logAudit(
    req.authUser!.id,
    req.authUser!.name,
    req.authUser!.roleName,
    'SETTINGS_UPDATED',
    'store_settings',
    'branding',
    `Updated store settings: whatsapp=${updated.whatsappNumber}, logo=${updated.logoUrl ? 'custom' : 'default'}`
  );
  res.json(updated);
});

// ==================== ADMIN CAMPAIGNS & DUAL-SIZE BANNERS ====================

app.post('/api/admin/upload', requireAuth, (req: AuthenticatedRequest, res) => {
  const hasPerm =
    req.authUser!.permissions.includes('campaigns:manage') ||
    req.authUser!.permissions.includes('products:write') ||
    req.authUser!.permissions.includes('roles:manage');
  if (!hasPerm) {
    res.status(403).json({ error: 'Insufficient permissions to upload assets.' });
    return;
  }

  const { dataUrl, filename } = req.body as { dataUrl?: string; filename?: string };
  if (!dataUrl || typeof dataUrl !== 'string') {
    res.status(400).json({ error: 'Missing image dataUrl.' });
    return;
  }

  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/i);
  if (!match) {
    res.status(400).json({ error: 'Unsupported image format. Use PNG, JPG, or WEBP.' });
    return;
  }

  const ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
  const baseSlug = (filename || 'banner')
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 32);
  const outName = `${baseSlug || 'asset'}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.${ext}`;
  const outPath = path.join(uploadsDir, outName);

  fs.writeFileSync(outPath, Buffer.from(match[2], 'base64'));
  res.status(201).json({ url: `/uploads/${outName}` });
});

app.get('/api/admin/campaigns', requirePermission('campaigns:manage'), (_req, res) => {
  const rows = db
    .prepare('SELECT * FROM campaigns ORDER BY sort_order ASC, created_at DESC')
    .all() as Record<string, unknown>[];
  res.json({ campaigns: rows.map(mapCampaignRow) });
});

app.post('/api/admin/campaigns', requirePermission('campaigns:manage'), (req: AuthenticatedRequest, res) => {
  const b = req.body as {
    placement?: string;
    designTheme?: string;
    sectionSize?: string;
    offerTag?: string;
    title?: string;
    subtitle?: string;
    ctaLabel?: string;
    promoCode?: string | null;
    targetCategory?: string;
    desktopImageUrl?: string | null;
    mobileImageUrl?: string | null;
    visualKey?: string;
    sortOrder?: number;
    active?: boolean;
  };

  if (!b.title?.trim() || !b.ctaLabel?.trim()) {
    res.status(400).json({ error: 'Banner title and CTA button label are required.' });
    return;
  }

  const id = `cmp_${crypto.randomUUID().slice(0, 10)}`;
  const now = new Date().toISOString();
  db.prepare(
    `
    INSERT INTO campaigns (
      id, placement, design_theme, section_size, offer_tag, title, subtitle,
      cta_label, promo_code, target_category, desktop_image_url, mobile_image_url,
      visual_key, sort_order, active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
  ).run(
    id,
    b.placement || 'hero',
    b.designTheme || 'navy',
    b.sectionSize || 'split',
    b.offerTag?.trim() || 'Special Offer',
    b.title.trim(),
    b.subtitle?.trim() || '',
    b.ctaLabel.trim(),
    b.promoCode?.trim() || null,
    b.targetCategory || 'All',
    b.desktopImageUrl?.trim() || null,
    b.mobileImageUrl?.trim() || null,
    b.visualKey || 'console-pro',
    Number(b.sortOrder ?? 1),
    b.active === false ? 0 : 1,
    now,
    now
  );

  logAudit(
    req.authUser!.id,
    req.authUser!.name,
    req.authUser!.roleName,
    'CAMPAIGN_CREATED',
    'campaign',
    id,
    `Created ${b.placement || 'hero'} banner "${b.title.trim()}" (${b.designTheme || 'navy'} / ${b.sectionSize || 'split'})`
  );

  const row = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id) as Record<string, unknown>;
  res.status(201).json({ campaign: mapCampaignRow(row) });
});

app.patch('/api/admin/campaigns/:id', requirePermission('campaigns:manage'), (req: AuthenticatedRequest, res) => {
  const existingRow = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id) as
    | Record<string, unknown>
    | undefined;
  if (!existingRow) {
    res.status(404).json({ error: 'Campaign banner not found.' });
    return;
  }
  const existing = mapCampaignRow(existingRow);
  const b = req.body as Partial<{
    placement: string;
    designTheme: string;
    sectionSize: string;
    offerTag: string;
    title: string;
    subtitle: string;
    ctaLabel: string;
    promoCode: string | null;
    targetCategory: string;
    desktopImageUrl: string | null;
    mobileImageUrl: string | null;
    visualKey: string;
    sortOrder: number;
    active: boolean;
  }>;

  const now = new Date().toISOString();
  db.prepare(
    `
    UPDATE campaigns SET
      placement = ?, design_theme = ?, section_size = ?, offer_tag = ?, title = ?, subtitle = ?,
      cta_label = ?, promo_code = ?, target_category = ?, desktop_image_url = ?, mobile_image_url = ?,
      visual_key = ?, sort_order = ?, active = ?, updated_at = ?
    WHERE id = ?
  `
  ).run(
    b.placement ?? existing.placement,
    b.designTheme ?? existing.designTheme,
    b.sectionSize ?? existing.sectionSize,
    b.offerTag !== undefined ? b.offerTag.trim() : existing.offerTag,
    b.title !== undefined ? b.title.trim() : existing.title,
    b.subtitle !== undefined ? b.subtitle.trim() : existing.subtitle,
    b.ctaLabel !== undefined ? b.ctaLabel.trim() : existing.ctaLabel,
    b.promoCode !== undefined ? b.promoCode : existing.promoCode,
    b.targetCategory ?? existing.targetCategory,
    b.desktopImageUrl !== undefined ? b.desktopImageUrl : existing.desktopImageUrl,
    b.mobileImageUrl !== undefined ? b.mobileImageUrl : existing.mobileImageUrl,
    b.visualKey ?? existing.visualKey,
    b.sortOrder !== undefined ? Number(b.sortOrder) : existing.sortOrder,
    b.active !== undefined ? (b.active ? 1 : 0) : existing.active ? 1 : 0,
    now,
    existing.id
  );

  logAudit(
    req.authUser!.id,
    req.authUser!.name,
    req.authUser!.roleName,
    'CAMPAIGN_UPDATED',
    'campaign',
    existing.id,
    `Updated banner "${b.title ?? existing.title}"`
  );

  const row = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(existing.id) as Record<
    string,
    unknown
  >;
  res.json({ campaign: mapCampaignRow(row) });
});

app.delete('/api/admin/campaigns/:id', requirePermission('campaigns:manage'), (req: AuthenticatedRequest, res) => {
  const existing = db.prepare('SELECT id, title FROM campaigns WHERE id = ?').get(req.params.id) as
    | { id: string; title: string }
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Campaign banner not found.' });
    return;
  }

  db.prepare('DELETE FROM campaigns WHERE id = ?').run(existing.id);
  logAudit(
    req.authUser!.id,
    req.authUser!.name,
    req.authUser!.roleName,
    'CAMPAIGN_DELETED',
    'campaign',
    existing.id,
    `Deleted banner "${existing.title}"`
  );
  res.json({ ok: true });
});

// ==================== ADMIN FLASH SALES (CATEGORY TIME-BOUND DISCOUNTS) ====================

const ALLOWED_FLASH_CATEGORIES = ['All', ...ALLOWED_PRODUCT_CATEGORIES];
const ALLOWED_FLASH_THEMES = ['crimson', 'navy', 'cobalt', 'obsidian'];

app.get('/api/admin/flash-sales', requirePermission('campaigns:manage'), (_req, res) => {
  const rows = db
    .prepare('SELECT * FROM flash_sales ORDER BY active DESC, expires_at DESC')
    .all() as Record<string, unknown>[];
  res.json({
    flashSales: rows.map(mapFlashSaleRow),
    serverTime: new Date().toISOString(),
  });
});

app.post('/api/admin/flash-sales', requirePermission('campaigns:manage'), (req: AuthenticatedRequest, res) => {
  const b = req.body as {
    title?: string;
    subtitle?: string;
    badgeLabel?: string;
    targetCategory?: string;
    discountPct?: number;
    designTheme?: string;
    startsAt?: string;
    expiresAt?: string;
    durationMinutes?: number;
    active?: boolean;
  };

  const title = (b.title || '').trim();
  if (title.length < 3) {
    res.status(400).json({ error: 'Flash sale title must be at least 3 characters.' });
    return;
  }

  const targetCategory = ALLOWED_FLASH_CATEGORIES.includes(String(b.targetCategory))
    ? String(b.targetCategory)
    : '';
  if (!targetCategory) {
    res.status(400).json({ error: 'Please select a valid target category for the flash sale.' });
    return;
  }

  const discountPct = Math.round(Number(b.discountPct));
  if (!Number.isFinite(discountPct) || discountPct < 1 || discountPct > 90) {
    res.status(400).json({ error: 'Flash discount percentage must be between 1% and 90%.' });
    return;
  }

  if (discountPct > req.authUser!.maxDiscountPct) {
    res.status(403).json({
      error: `Role discount cap exceeded: '${req.authUser!.roleName}' may offer up to ${req.authUser!.maxDiscountPct}% off, but requested ${discountPct}%.`,
    });
    return;
  }

  const now = new Date();
  const startsAt =
    b.startsAt && Number.isFinite(new Date(b.startsAt).getTime())
      ? new Date(b.startsAt).toISOString()
      : now.toISOString();

  let expiresDate: Date | null = null;
  if (b.expiresAt && Number.isFinite(new Date(b.expiresAt).getTime())) {
    expiresDate = new Date(b.expiresAt);
  } else if (b.durationMinutes && Number(b.durationMinutes) > 0) {
    expiresDate = new Date(now.getTime() + Number(b.durationMinutes) * 60_000);
  }

  if (!expiresDate || expiresDate.getTime() <= now.getTime()) {
    res.status(400).json({ error: 'Expiration time must be in the future.' });
    return;
  }

  const designTheme = ALLOWED_FLASH_THEMES.includes(String(b.designTheme))
    ? String(b.designTheme)
    : 'crimson';

  const id = `fs_${crypto.randomUUID().slice(0, 10)}`;
  const nowIso = now.toISOString();

  db.prepare(
    `
    INSERT INTO flash_sales (
      id, title, subtitle, badge_label, target_category, discount_pct,
      design_theme, starts_at, expires_at, active, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
  ).run(
    id,
    title,
    (b.subtitle || '').trim() || `Limited-time ${discountPct}% flash discount on ${targetCategory}.`,
    (b.badgeLabel || 'FLASH SALE').trim().toUpperCase().slice(0, 24) || 'FLASH SALE',
    targetCategory,
    discountPct,
    designTheme,
    startsAt,
    expiresDate.toISOString(),
    b.active === false ? 0 : 1,
    `${req.authUser!.name} (${req.authUser!.roleName})`,
    nowIso,
    nowIso
  );

  logAudit(
    req.authUser!.id,
    req.authUser!.name,
    req.authUser!.roleName,
    'FLASH_SALE_CREATED',
    'flash_sale',
    id,
    `Launched ${discountPct}% flash sale on ${targetCategory} ("${title}") expiring ${expiresDate.toISOString()}`
  );

  const row = db.prepare('SELECT * FROM flash_sales WHERE id = ?').get(id) as Record<string, unknown>;
  res.status(201).json({ flashSale: mapFlashSaleRow(row) });
});

app.patch('/api/admin/flash-sales/:id', requirePermission('campaigns:manage'), (req: AuthenticatedRequest, res) => {
  const existingRow = db.prepare('SELECT * FROM flash_sales WHERE id = ?').get(req.params.id) as
    | Record<string, unknown>
    | undefined;
  if (!existingRow) {
    res.status(404).json({ error: 'Flash sale not found.' });
    return;
  }
  const existing = mapFlashSaleRow(existingRow);

  const b = req.body as Partial<{
    title: string;
    subtitle: string;
    badgeLabel: string;
    targetCategory: string;
    discountPct: number;
    designTheme: string;
    expiresAt: string;
    active: boolean;
  }>;

  const nextTitle = b.title !== undefined ? b.title.trim() : existing.title;
  if (nextTitle.length < 3) {
    res.status(400).json({ error: 'Flash sale title must be at least 3 characters.' });
    return;
  }

  const nextCategory =
    b.targetCategory !== undefined
      ? ALLOWED_FLASH_CATEGORIES.includes(b.targetCategory)
        ? b.targetCategory
        : ''
      : existing.targetCategory;
  if (!nextCategory) {
    res.status(400).json({ error: 'Invalid target category selected.' });
    return;
  }

  const nextDiscount =
    b.discountPct !== undefined ? Math.round(Number(b.discountPct)) : existing.discountPct;
  if (!Number.isFinite(nextDiscount) || nextDiscount < 1 || nextDiscount > 90) {
    res.status(400).json({ error: 'Flash discount percentage must be between 1% and 90%.' });
    return;
  }
  if (nextDiscount > req.authUser!.maxDiscountPct) {
    res.status(403).json({
      error: `Role discount cap exceeded: '${req.authUser!.roleName}' may offer up to ${req.authUser!.maxDiscountPct}% off.`,
    });
    return;
  }

  let nextExpiresAt = existing.expiresAt;
  if (b.expiresAt !== undefined) {
    const expMs = new Date(b.expiresAt).getTime();
    if (!Number.isFinite(expMs)) {
      res.status(400).json({ error: 'Invalid expiration timestamp.' });
      return;
    }
    nextExpiresAt = new Date(expMs).toISOString();
  }

  const nextTheme =
    b.designTheme !== undefined && ALLOWED_FLASH_THEMES.includes(b.designTheme)
      ? b.designTheme
      : existing.designTheme;

  const nowIso = new Date().toISOString();
  db.prepare(
    `
    UPDATE flash_sales SET
      title = ?, subtitle = ?, badge_label = ?, target_category = ?, discount_pct = ?,
      design_theme = ?, expires_at = ?, active = ?, updated_at = ?
    WHERE id = ?
  `
  ).run(
    nextTitle,
    b.subtitle !== undefined ? b.subtitle.trim() : existing.subtitle,
    b.badgeLabel !== undefined
      ? b.badgeLabel.trim().toUpperCase().slice(0, 24) || 'FLASH SALE'
      : existing.badgeLabel,
    nextCategory,
    nextDiscount,
    nextTheme,
    nextExpiresAt,
    b.active !== undefined ? (b.active ? 1 : 0) : existing.active ? 1 : 0,
    nowIso,
    existing.id
  );

  logAudit(
    req.authUser!.id,
    req.authUser!.name,
    req.authUser!.roleName,
    'FLASH_SALE_UPDATED',
    'flash_sale',
    existing.id,
    `Updated flash sale "${nextTitle}" (${nextDiscount}% off ${nextCategory}, expires ${nextExpiresAt})`
  );

  const row = db.prepare('SELECT * FROM flash_sales WHERE id = ?').get(existing.id) as Record<
    string,
    unknown
  >;
  res.json({ flashSale: mapFlashSaleRow(row) });
});

app.delete('/api/admin/flash-sales/:id', requirePermission('campaigns:manage'), (req: AuthenticatedRequest, res) => {
  const existing = db.prepare('SELECT id, title, target_category FROM flash_sales WHERE id = ?').get(req.params.id) as
    | { id: string; title: string; target_category: string }
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Flash sale not found.' });
    return;
  }
  db.prepare('DELETE FROM flash_sales WHERE id = ?').run(existing.id);
  logAudit(
    req.authUser!.id,
    req.authUser!.name,
    req.authUser!.roleName,
    'FLASH_SALE_DELETED',
    'flash_sale',
    existing.id,
    `Deleted flash sale "${existing.title}" (${existing.target_category})`
  );
  res.json({ ok: true });
});

// ==================== SERVER STARTUP ====================

async function startServer() {
  const port = Number(process.env.PORT || 3000);
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    const distAssetsDir = path.resolve(distDir, 'src', 'assets');
    const srcAssetsDir = path.resolve(process.cwd(), 'src', 'assets');

    // Ensure database-referenced /src/assets paths resolve reliably in production
    if (fs.existsSync(distAssetsDir)) {
      app.use('/src/assets', express.static(distAssetsDir, { maxAge: '7d' }));
    } else if (fs.existsSync(srcAssetsDir)) {
      app.use('/src/assets', express.static(srcAssetsDir, { maxAge: '7d' }));
    }

    app.use(express.static(distDir, { maxAge: '1d' }));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Production build not found. Run npm run build first.');
      }
    });
  }

  // Global Express Error Handler
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[UNHANDLED EXPRESS ERROR]:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'An unexpected internal server error occurred.' });
    }
  });

  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Sam Brand Store listening on http://localhost:${port}`);
  });

  function handleShutdown(signal: string) {
    console.log(`\nReceived ${signal}. Shutting down cleanly...`);
    server.close(() => {
      try {
        db.pragma('wal_checkpoint(TRUNCATE)');
        db.close();
        console.log('SQLite database closed cleanly.');
      } catch (e) {
        console.error('Error closing SQLite database:', e);
      }
      process.exit(0);
    });
  }

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}

startServer();
