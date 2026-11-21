import { spawn, type ChildProcess } from 'child_process';

const TEST_PORT = 3980;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

function record(name: string, passed: boolean, details?: string, error?: string) {
  results.push({ name, passed, details, error });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} - ${name} ${details ? `(${details})` : ''} ${error ? `[ERROR: ${error}]` : ''}`);
}

async function runE2ETestSuite() {
  console.log('====================================================');
  console.log('🚀 SAM BRAND STORE - COMPLETE END-TO-END TEST SUITE');
  console.log('====================================================\n');

  const testDatabaseName = process.env.TEST_DB_NAME || '';
  if (!/(?:^|[_-])(?:test|e2e)$/i.test(testDatabaseName)) {
    throw new Error('Set TEST_DB_NAME to a dedicated database ending in _test or _e2e.');
  }
  for (const key of ['TEST_DB_HOST', 'TEST_DB_USER', 'TEST_DB_PASSWORD'] as const) {
    if (!process.env[key]) {
      throw new Error(`Missing ${key}; E2E tests require an isolated MySQL test database.`);
    }
  }
  process.env.DB_HOST = process.env.TEST_DB_HOST;
  process.env.DB_PORT = process.env.TEST_DB_PORT || '3306';
  process.env.DB_USER = process.env.TEST_DB_USER;
  process.env.DB_PASSWORD = process.env.TEST_DB_PASSWORD;
  process.env.DB_NAME = testDatabaseName;
  process.env.NODE_ENV = 'test';

  const { db, initDatabase } = await import('./server/db.ts');
  await initDatabase();

  // 1. Isolated MySQL test database checks
  console.log('--- 1. DATABASE & PERSISTENCE INTEGRITY ---');
  try {
    const demoCustomer = await db.prepare("SELECT * FROM users WHERE id = 'usr_demo_customer' OR email = 'jordan@example.com'").get();
    record('Placeholder Account Removed', !demoCustomer, demoCustomer ? 'Still present' : 'Verified completely deleted from users');

    const activeStaff = await db.prepare('SELECT id, email, role_id FROM users').all() as Array<{ id: string; email: string; role_id: string }>;
    record('Active Staff Users Count', activeStaff.length === 4, `Found ${activeStaff.length} staff: ${activeStaff.map(s => s.email).join(', ')}`);

    const reviewsCount = Number(((await db.prepare('SELECT count(*) as c FROM product_reviews').get()) as { c: number }).c);
    record('Persistent Product Reviews Table', reviewsCount >= 9, `Found ${reviewsCount} persistent reviews in MySQL`);

    const waitlistCount = Number(((await db.prepare('SELECT count(*) as c FROM stock_waitlist').get()) as { c: number }).c);
    record('Persistent Stock Waitlist Table', waitlistCount >= 0, `Table exists and queryable (${waitlistCount} initial rows)`);
  } catch (err) {
    record('Database Schema Check', false, undefined, (err as Error).message);
  }

  // 2. Start Production Server Process
  console.log('\n--- 2. PRODUCTION SERVER BOOT & HTTP HEALTH ---');
  let serverProcess: ChildProcess | null = null;

  try {
    serverProcess = spawn(process.execPath, ['dist/server.js'], {
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: String(TEST_PORT),
        SESSION_SECRET: 'production-e2e-secret-key-32-chars-long-valid',
        ADMIN_EMAIL: 'sam@sambrandstore.com',
        ADMIN_PASSWORD: 'SamAdmin2026!',
        SMTP_HOST: '127.0.0.1',
        SMTP_PORT: '1',
        SMTP_SECURE: 'true',
        SMTP_USER: 'e2e@example.invalid',
        SMTP_PASS: 'e2e-only-password',
        MAIL_FROM: 'e2e@example.invalid',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    serverProcess.stderr?.on('data', (d) => process.stderr.write(d));

    // Wait for server to start
    await new Promise((r) => setTimeout(r, 2000));

    // Test /api/health
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    const healthJson = await healthRes.json() as { ok: boolean; store: string };
    record('Health Check Endpoint (/api/health)', healthRes.status === 200 && healthJson.ok === true, `Store: ${healthJson.store}`);

    // Test Security Headers
    const secHeaders = {
      'x-content-type-options': healthRes.headers.get('x-content-type-options'),
      'x-frame-options': healthRes.headers.get('x-frame-options'),
      'referrer-policy': healthRes.headers.get('referrer-policy'),
    };
    record(
      'Security Headers (nosniff, SAMEORIGIN)',
      secHeaders['x-content-type-options'] === 'nosniff' && secHeaders['x-frame-options'] === 'SAMEORIGIN',
      JSON.stringify(secHeaders)
    );

    // Test Public Store Settings
    const settingsRes = await fetch(`${BASE_URL}/api/settings/public`);
    const settingsJson = await settingsRes.json() as { whatsappNumber?: string };
    record(
      'Public Store Settings (/api/settings/public)',
      settingsRes.status === 200 && Boolean(settingsJson.whatsappNumber),
      `WhatsApp configured: ${Boolean(settingsJson.whatsappNumber)}`
    );

    // Password reset behavior: unknown accounts stay generic and requests are throttled.
    const requestReset = () =>
      fetch(`${BASE_URL}/api/auth/request-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: `missing_${Date.now()}@invalid.example` }),
      });
    const resetRes = await requestReset();
    const resetJson = await resetRes.json() as { ok?: boolean; message?: string; demoVerificationCode?: string };
    record(
      'Password Reset Does Not Reveal Account or Code',
      resetRes.status === 200 &&
        resetJson.ok === true &&
        resetJson.message === 'If the account exists, a reset code has been sent.' &&
        !('demoVerificationCode' in resetJson),
      'Unknown addresses receive the generic response with no verification code'
    );

    const resetStaff = (await db.prepare(
      `SELECT u.id, u.email
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.status = 'active' AND r.slug <> 'customer'
       LIMIT 1`
    ).get()) as { id: string; email: string } | undefined;
    if (resetStaff) {
      const deliveryFailureRes = await fetch(`${BASE_URL}/api/auth/request-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetStaff.email }),
      });
      const deliveryFailureJson = await deliveryFailureRes.json() as { error?: string; demoVerificationCode?: string };
      const storedReset = (await db.prepare(
        'SELECT code, used FROM password_resets WHERE user_id = ? ORDER BY created_at DESC LIMIT 1'
      ).get(resetStaff.id)) as { code: string; used: number } | undefined;
      record(
        'Password Reset Delivery Failure Is Safe',
        deliveryFailureRes.status === 502 &&
          !('demoVerificationCode' in deliveryFailureJson) &&
          storedReset?.code.length === 64 &&
          Number(storedReset.used) === 1,
        'SMTP failure returns an error, stores only a hash, and invalidates the code'
      );
    } else {
      record('Password Reset Delivery Failure Is Safe', false, undefined, 'No active staff account in the isolated E2E database');
    }

    let rateLimitRes: Response | undefined;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      rateLimitRes = await requestReset();
    }
    record(
      'Password Reset Requests Are Rate Limited',
      rateLimitRes?.status === 429 && Number(rateLimitRes.headers.get('retry-after')) > 0,
      `Final response status: ${rateLimitRes?.status}`
    );

    // 3. Catalog & Products
    console.log('\n--- 3. PRODUCT CATALOG & SEARCH ---');
    const prodsRes = await fetch(`${BASE_URL}/api/products`);
    const prodsJson = await prodsRes.json() as { products: Array<{ id: string; name: string; slug: string; category: string }> };
    record('Catalog Fetch (/api/products)', prodsRes.status === 200 && prodsJson.products.length >= 16, `Loaded ${prodsJson.products.length} products`);

    const singleRes = await fetch(`${BASE_URL}/api/products/playstation-5-pro-2tb`);
    const singleJson = await singleRes.json() as { product: { id: string; name: string } };
    record('Product Lookup by Slug', singleRes.status === 200 && singleJson.product.id === 'prod_ps5_pro', singleJson.product.name);

    // 4. Product Reviews (Persistent MySQL)
    console.log('\n--- 4. CUSTOMER REVIEWS (MYSQL PERSISTENT) ---');
    const revsRes = await fetch(`${BASE_URL}/api/products/prod_ps5_pro/reviews`);
    const revsJson = await revsRes.json() as { reviews: Array<{ id: string; helpfulCount: number }>; summary: { averageRating: number } };
    record('Product Reviews Query', revsRes.status === 200 && revsJson.reviews.length >= 2, `Avg Rating: ${revsJson.summary.averageRating}, Count: ${revsJson.reviews.length}`);

    // Submit new review
    const postRevRes = await fetch(`${BASE_URL}/api/products/prod_ps5_pro/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        authorName: 'Alex Test Shopper',
        authorEmail: 'alex.shopper@test.com',
        rating: 5,
        title: 'Exceptional build quality',
        comment: 'Runs completely silent in 4K 120Hz mode and arrived in pristine condition.',
      }),
    });
    const postRevJson = await postRevRes.json() as { review: { id: string } };
    record('Post New Review', postRevRes.status === 201 && Boolean(postRevJson.review.id), `Created review ID: ${postRevJson.review.id}`);

    // Mark helpful
    const helpfulRes = await fetch(`${BASE_URL}/api/products/prod_ps5_pro/reviews/${postRevJson.review.id}/helpful`, {
      method: 'POST',
    });
    const helpfulJson = await helpfulRes.json() as { ok: boolean; helpfulCount: number };
    record('Mark Review Helpful', helpfulRes.status === 200 && helpfulJson.helpfulCount === 1, `Helpful count: ${helpfulJson.helpfulCount}`);

    // 5. Stock Waitlist (Persistent MySQL)
    console.log('\n--- 5. RESTOCK NOTIFICATION SUBSCRIBER ---');
    const testEmail = `shopper_${Date.now()}@example.com`;
    const notifyRes = await fetch(`${BASE_URL}/api/products/prod_ps5_pro/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, variant: '2TB Standard Edition' }),
    });
    const notifyJson = await notifyRes.json() as { ok: boolean; alreadySubscribed: boolean; totalSubscribers: number };
    record('Subscribe Restock Alert', notifyRes.status === 201 && notifyJson.ok === true && !notifyJson.alreadySubscribed, `Total subscribers: ${notifyJson.totalSubscribers}`);

    // Duplicate check
    const dupNotifyRes = await fetch(`${BASE_URL}/api/products/prod_ps5_pro/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, variant: '2TB Standard Edition' }),
    });
    const dupNotifyJson = await dupNotifyRes.json() as { alreadySubscribed: boolean };
    record('Idempotent Duplicate Subscription', dupNotifyRes.status === 200 && dupNotifyJson.alreadySubscribed === true, 'Detected duplicate gracefully');

    // 6. Campaigns & Flash Sales
    console.log('\n--- 6. CAMPAIGNS & FLASH SALES ---');
    const campRes = await fetch(`${BASE_URL}/api/campaigns`);
    const campJson = await campRes.json() as { campaigns: Array<{ id: string; title: string }> };
    record('Active Marketing Campaigns', campRes.status === 200 && campJson.campaigns.length >= 1, `Count: ${campJson.campaigns.length}`);

    const flashRes = await fetch(`${BASE_URL}/api/flash-sales`);
    const flashJson = await flashRes.json() as { flashSales: Array<{ id: string; title: string; discountPct: number }> };
    record('Active Flash Sales', flashRes.status === 200 && flashJson.flashSales.length >= 1, `Top sale: ${flashJson.flashSales[0]?.title}`);

    // 7. Order Placement & Tracking
    console.log('\n--- 7. GUEST CHECKOUT & ORDER TRACKING ---');
    const newOrderPayload = {
      customerName: 'Samir Khoury',
      customerEmail: 'samir.k@testorder.com',
      customerPhone: '+961 71 123456',
      shippingAddress: 'Hamra Main Street, Bldg 42, 3rd Floor',
      city: 'Beirut',
      postalCode: '1103',
      paymentMethod: 'cod',
      items: [
        {
          productId: 'prod_ps5_pro',
          variant: '2TB Standard Edition',
          quantity: 1,
        },
      ],
    };
    const unsupportedPaymentRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newOrderPayload, paymentMethod: 'card' }),
    });
    record(
      'Unsupported Card Payment Rejected',
      unsupportedPaymentRes.status === 400,
      'Checkout does not claim card payment without a configured processor'
    );

    const orderPostRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newOrderPayload),
    });
    const orderPostJson = await orderPostRes.json() as { order: { id: string; orderNumber: string; total: number; orderStatus: string } };
    record('Guest Order Creation', orderPostRes.status === 201 && Boolean(orderPostJson.order.orderNumber), `Order: ${orderPostJson.order.orderNumber}, Total: $${orderPostJson.order.total}`);

    // Order Tracking Lookup
    const trackRes = await fetch(`${BASE_URL}/api/orders/track?orderNumber=${orderPostJson.order.orderNumber}&email=samir.k@testorder.com`);
    const trackJson = await trackRes.json() as { order: { orderNumber: string; orderStatus: string } };
    record('Order Tracking Lookup', trackRes.status === 200 && trackJson.order.orderNumber === orderPostJson.order.orderNumber, `Status: ${trackJson.order.orderStatus}`);

    // 8. Staff Authentication & RBAC Boundaries
    console.log('\n--- 8. STAFF AUTHENTICATION & RBAC PERMISSIONS ---');

    // Store Owner Login
    const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'sam@sambrandstore.com', password: 'SamAdmin2026!' }),
    });
    const adminCookie = adminLoginRes.headers.get('set-cookie') || '';
    const adminLoginJson = await adminLoginRes.json() as { user: { roleSlug: string; name: string } };
    record('Store Owner Sign-In', adminLoginRes.status === 200 && adminLoginJson.user.roleSlug === 'owner', `User: ${adminLoginJson.user.name}`);

    // Session Cookie Verification (/api/auth/me)
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { cookie: adminCookie },
    });
    const meJson = await meRes.json() as { user: { name: string; roleSlug: string } | null };
    record('Session Token Authorization (/api/auth/me)', meRes.status === 200 && meJson.user?.roleSlug === 'owner', `Authenticated as: ${meJson.user?.name}`);

    // Admin Protected Endpoint (Analytics)
    const analyticsRes = await fetch(`${BASE_URL}/api/admin/analytics`, {
      headers: { cookie: adminCookie },
    });
    record('Admin Analytics Access', analyticsRes.status === 200, 'Owner granted full analytics access');

    // Admin Audit Logs
    const auditRes = await fetch(`${BASE_URL}/api/admin/audit-logs`, {
      headers: { cookie: adminCookie },
    });
    record('Admin Audit Logs Access', auditRes.status === 200, 'Audit trail accessible');

    // Limited Employee Sign-In (Fulfillment Agent)
    const shipLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'liam.ship@sambrandstore.com', password: 'LiamShip2026!' }),
    });
    const shipCookie = shipLoginRes.headers.get('set-cookie') || '';
    const shipLoginJson = await shipLoginRes.json() as { user: { roleSlug: string; name: string } };
    record('Fulfillment Agent Sign-In', shipLoginRes.status === 200 && shipLoginJson.user.roleSlug === 'fulfillment', `User: ${shipLoginJson.user.name}`);

    // RBAC Security Boundary: Fulfillment Agent trying to manage Staff
    const forbiddenRes = await fetch(`${BASE_URL}/api/admin/staff`, {
      headers: { cookie: shipCookie },
    });
    record(
      'RBAC Security Boundary Enforcement',
      forbiddenRes.status === 403,
      `Expected 403 Forbidden for non-permitted action (Got: ${forbiddenRes.status})`
    );

    // 9. Static Assets & SPA Routing
    console.log('\n--- 9. STATIC ASSETS & SINGLE-PAGE APP ROUTING ---');
    const assetRes = await fetch(`${BASE_URL}/src/assets/images/console_ps5_pro.jpg`);
    record(
      'Static Image Asset (/src/assets/images/...)',
      Boolean(assetRes.status === 200 && assetRes.headers.get('content-type')?.includes('image')),
      `Content-Type: ${assetRes.headers.get('content-type')}`
    );

    const spaRootRes = await fetch(`${BASE_URL}/`);
    record(
      'SPA Root HTML Delivery',
      Boolean(spaRootRes.status === 200 && spaRootRes.headers.get('content-type')?.includes('text/html')),
      'Served index.html for client application'
    );

    const spaHiddenAdminRes = await fetch(`${BASE_URL}/sbs-admin`);
    record(
      'SPA Hidden Admin Route Fallback (/sbs-admin)',
      Boolean(spaHiddenAdminRes.status === 200 && spaHiddenAdminRes.headers.get('content-type')?.includes('text/html')),
      'Correctly returns index.html for client SPA router'
    );

    // 10. Rate Limiting Defense
    console.log('\n--- 10. SECURITY: RATE LIMITING DEFENSE ---');
    let hitRateLimit = false;
    for (let i = 0; i < 18; i++) {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'invalid@attacker.com', password: 'badpassword123' }),
      });
      if (res.status === 429) {
        hitRateLimit = true;
        const retry = res.headers.get('retry-after');
        record('Auth Brute-Force Rate Limiting (HTTP 429)', true, `Triggered on attempt #${i + 1}, Retry-After: ${retry}s`);
        break;
      }
    }
    if (!hitRateLimit) {
      record('Auth Brute-Force Rate Limiting', false, undefined, 'Did not trigger 429 after 18 attempts');
    }
  } catch (err) {
    console.error('Fatal test error:', err);
  } finally {
    if (serverProcess) {
      const exited = new Promise<void>((resolve) => serverProcess?.once('exit', () => resolve()));
      serverProcess.kill('SIGTERM');
      await Promise.race([
        exited,
        new Promise<void>((resolve) => setTimeout(resolve, 5000)),
      ]);
      console.log('\nServer process shut down cleanly.');
    }
  }

  // Summary
  console.log('\n====================================================');
  console.log('📊 TEST SUMMARY & SCORECARD');
  console.log('====================================================');
  const total = results.length;
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = total - passedCount;
  console.log(`Total Checks: ${total}`);
  console.log(`Passed:       ${passedCount}`);
  console.log(`Failed:       ${failedCount}`);
  console.log(`Status:       ${failedCount === 0 ? 'PASSED' : 'FAILED — ACTION REQUIRED'}`);
  console.log('====================================================\n');
}

runE2ETestSuite().catch((error) => {
  console.error('E2E test suite could not run safely:', error);
  process.exitCode = 1;
});
