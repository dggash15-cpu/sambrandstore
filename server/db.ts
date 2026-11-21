import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  createPool,
  type Pool,
  type PoolConnection,
  type ResultSetHeader,
  type RowDataPacket,
} from 'mysql2/promise';
import type {
  AuditLog,
  CampaignBanner,
  FlashSale,
  FlashSaleCategory,
  FlashSaleTheme,
  Order,
  OrderItem,
  PermissionKey,
  Product,
  Role,
} from '../src/types.ts';

type SqlValue = string | number | bigint | boolean | Date | Buffer | null;
type SqlClient = Pool | PoolConnection;

class DatabaseSession {
  constructor(private readonly client: SqlClient) {}

  prepare(sql: string) {
    return {
      get: async (...params: SqlValue[]): Promise<Record<string, unknown> | undefined> => {
        const [rows] = await this.client.execute<RowDataPacket[]>(sql, params);
        return rows[0] as Record<string, unknown> | undefined;
      },
      all: async (...params: SqlValue[]): Promise<Array<Record<string, unknown>>> => {
        const [rows] = await this.client.execute<RowDataPacket[]>(sql, params);
        return rows as Array<Record<string, unknown>>;
      },
      run: async (...params: SqlValue[]): Promise<{ changes: number; insertId: number }> => {
        const [result] = await this.client.execute<ResultSetHeader>(sql, params);
        return { changes: result.affectedRows, insertId: result.insertId };
      },
    };
  }

  async exec(sql: string): Promise<void> {
    await this.client.query(sql);
  }
}

function getDatabaseConfig() {
  let url: URL | undefined;
  if (process.env.DATABASE_URL) {
    try {
      url = new URL(process.env.DATABASE_URL);
    } catch {
      throw new Error('DATABASE_URL must be a valid MySQL or MariaDB connection URL.');
    }
    if (url.protocol !== 'mysql:' && url.protocol !== 'mariadb:') {
      throw new Error('DATABASE_URL must use the mysql:// or mariadb:// scheme.');
    }
  }

  const host = process.env.DB_HOST || url?.hostname;
  const user = process.env.DB_USER || (url ? decodeURIComponent(url.username) : '');
  const password = process.env.DB_PASSWORD || (url ? decodeURIComponent(url.password) : '');
  const database = process.env.DB_NAME || (url ? decodeURIComponent(url.pathname.slice(1)) : '');
  const rawPort = process.env.DB_PORT || url?.port || '3306';
  const port = Number(rawPort);

  if (!host || !user || !password || !database) {
    throw new Error(
      'MySQL configuration is incomplete. Set DB_HOST, DB_PORT, DB_USER, DB_NAME, and DB_PASSWORD.'
    );
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('DB_PORT must be an integer between 1 and 65535.');
  }

  return { host, user, password, database, port };
}

const pool = createPool({
  ...getDatabaseConfig(),
  charset: 'utf8mb4',
  connectionLimit: 5,
  waitForConnections: true,
  queueLimit: 0,
  decimalNumbers: true,
  dateStrings: true,
  timezone: 'Z',
});

class MySqlDatabase extends DatabaseSession {
  constructor(private readonly pool: Pool) {
    super(pool);
  }

  async transaction<T>(callback: (tx: DatabaseSession) => Promise<T>): Promise<T> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await callback(new DatabaseSession(connection));
      await connection.commit();
      return result;
    } catch (error) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Failed to roll back MySQL transaction:', rollbackError);
      }
      throw error;
    } finally {
      connection.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export const db = new MySqlDatabase(pool);

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}

async function cleanupDemoData(): Promise<void> {
  const demoProductIds = [
    'prod_ps5_cobalt_ltd', 'prod_rog_oled_32', 'prod_studio_dac_amp', 'prod_carbon_desk_mat',
    'prod_ps5_pro', 'prod_oled_27', 'prod_novapulse_audio', 'prod_tactile75',
    'prod_aerolite_mouse', 'prod_horizon_handheld', 'prod_dualforce_ctrl', 'prod_ultrawide_34',
    'prod_hyperdock', 'prod_echocast_mic', 'prod_xbox_galaxy', 'prod_macro_deck',
  ];
  for (const id of demoProductIds) {
    await db.prepare('DELETE FROM product_reviews WHERE product_id = ?').run(id);
    await db.prepare('DELETE FROM stock_waitlist WHERE product_id = ?').run(id);
  }
  await db.prepare("DELETE FROM order_items WHERE order_id LIKE 'ord_seed_%'").run();
  await db.prepare("DELETE FROM orders WHERE id LIKE 'ord_seed_%'").run();
  await db.prepare("DELETE FROM audit_logs WHERE id LIKE 'aud_seed_%'").run();
  await db.prepare("DELETE FROM product_reviews WHERE id LIKE 'rev_seed_%'").run();
  await db.prepare("DELETE FROM flash_sales WHERE id LIKE 'fs_%'").run();
  await db.prepare("DELETE FROM campaigns WHERE id LIKE 'cmp_%'").run();
  await db.prepare("DELETE FROM users WHERE id IN ('usr_maya_mgr','usr_alex_inv','usr_liam_ship')").run();
  for (const id of demoProductIds) {
    await db.prepare('DELETE FROM order_items WHERE product_id = ?').run(id);
    await db.prepare('DELETE FROM products WHERE id = ?').run(id);
  }
}

export async function initDatabase(): Promise<void> {
  const schemaStatements = [
    `CREATE TABLE IF NOT EXISTS roles (
      id VARCHAR(191) NOT NULL,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(191) NOT NULL,
      description TEXT NOT NULL,
      permissions LONGTEXT NOT NULL,
      max_discount_pct INT NOT NULL DEFAULT 0,
      max_refund_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
      is_system TINYINT(1) NOT NULL DEFAULT 0,
      created_at VARCHAR(32) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_roles_slug (slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`,
    `CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(191) NOT NULL,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(254) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role_id VARCHAR(191) NOT NULL,
      custom_permissions LONGTEXT NOT NULL DEFAULT '[]',
      department_scope VARCHAR(255) NOT NULL DEFAULT 'all',
      status VARCHAR(32) NOT NULL DEFAULT 'active',
      created_at VARCHAR(32) NOT NULL,
      last_login_at VARCHAR(32) NULL,
      phone VARCHAR(64) NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_users_email (email),
      KEY idx_users_role_id (role_id),
      CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`,
    `CREATE TABLE IF NOT EXISTS products (
      id VARCHAR(191) NOT NULL,
      sku VARCHAR(64) NOT NULL,
      slug VARCHAR(191) NOT NULL,
      name VARCHAR(255) NOT NULL,
      brand VARCHAR(255) NOT NULL,
      category VARCHAR(100) NOT NULL,
      price DECIMAL(14,2) NOT NULL,
      compare_at_price DECIMAL(14,2) NULL,
      cost_price DECIMAL(14,2) NULL,
      stock INT NOT NULL DEFAULT 0,
      low_stock_threshold INT NOT NULL DEFAULT 5,
      \`condition\` VARCHAR(32) NOT NULL DEFAULT 'New',
      warranty VARCHAR(255) NOT NULL DEFAULT '2-Year Official Sam Brand Warranty',
      weight VARCHAR(128) NULL,
      dimensions VARCHAR(128) NULL,
      whats_in_box LONGTEXT NOT NULL DEFAULT '[]',
      tags LONGTEXT NOT NULL DEFAULT '[]',
      badge VARCHAR(128) NULL,
      tagline TEXT NOT NULL,
      description TEXT NOT NULL,
      specs LONGTEXT NOT NULL,
      variants LONGTEXT NOT NULL,
      visual_key VARCHAR(128) NOT NULL,
      image_url TEXT NULL,
      images LONGTEXT NOT NULL DEFAULT '[]',
      featured TINYINT(1) NOT NULL DEFAULT 0,
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_at VARCHAR(32) NOT NULL,
      updated_at VARCHAR(32) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_products_sku (sku),
      UNIQUE KEY uq_products_slug (slug),
      KEY idx_products_category (category),
      KEY idx_products_active_featured (active, featured)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`,
    `CREATE TABLE IF NOT EXISTS store_categories (
      id VARCHAR(191) NOT NULL,
      name VARCHAR(100) NOT NULL,
      slug VARCHAR(100) NOT NULL,
      subtitle VARCHAR(255) NOT NULL DEFAULT '',
      image_url TEXT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_at VARCHAR(32) NOT NULL,
      updated_at VARCHAR(32) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_store_categories_name (name),
      UNIQUE KEY uq_store_categories_slug (slug),
      KEY idx_store_categories_active_sort (active, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`,
    `CREATE TABLE IF NOT EXISTS password_resets (
      id VARCHAR(191) NOT NULL,
      user_id VARCHAR(191) NOT NULL,
      code VARCHAR(64) NOT NULL,
      expires_at VARCHAR(32) NOT NULL,
      used TINYINT(1) NOT NULL DEFAULT 0,
      created_at VARCHAR(32) NOT NULL,
      PRIMARY KEY (id),
      KEY idx_password_resets_user_created (user_id, created_at),
      CONSTRAINT fk_password_resets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`,
    `CREATE TABLE IF NOT EXISTS orders (
      id VARCHAR(191) NOT NULL,
      order_number VARCHAR(64) NOT NULL,
      user_id VARCHAR(191) NULL,
      customer_name VARCHAR(255) NOT NULL,
      customer_email VARCHAR(254) NOT NULL,
      customer_phone VARCHAR(64) NOT NULL,
      shipping_address TEXT NOT NULL,
      city VARCHAR(128) NOT NULL,
      postal_code VARCHAR(32) NOT NULL,
      payment_method VARCHAR(64) NOT NULL,
      payment_status VARCHAR(64) NOT NULL,
      payment_last4 VARCHAR(8) NULL,
      transaction_ref VARCHAR(191) NOT NULL,
      order_status VARCHAR(64) NOT NULL,
      subtotal DECIMAL(14,2) NOT NULL,
      shipping_cost DECIMAL(14,2) NOT NULL,
      discount_amount DECIMAL(14,2) NOT NULL,
      tax_amount DECIMAL(14,2) NOT NULL,
      total DECIMAL(14,2) NOT NULL,
      promo_code VARCHAR(128) NULL,
      notes TEXT NULL,
      created_at VARCHAR(32) NOT NULL,
      updated_at VARCHAR(32) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_orders_order_number (order_number),
      KEY idx_orders_user_created (user_id, created_at),
      KEY idx_orders_created_at (created_at),
      CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`,
    `CREATE TABLE IF NOT EXISTS order_items (
      id VARCHAR(191) NOT NULL,
      order_id VARCHAR(191) NOT NULL,
      product_id VARCHAR(191) NOT NULL,
      product_name VARCHAR(255) NOT NULL,
      sku VARCHAR(64) NOT NULL,
      variant_label VARCHAR(255) NOT NULL,
      quantity INT NOT NULL,
      unit_price DECIMAL(14,2) NOT NULL,
      line_total DECIMAL(14,2) NOT NULL,
      PRIMARY KEY (id),
      KEY idx_order_items_order_id (order_id),
      KEY idx_order_items_product_id (product_id),
      CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`,
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id VARCHAR(191) NOT NULL,
      actor_id VARCHAR(191) NOT NULL,
      actor_name VARCHAR(255) NOT NULL,
      actor_role VARCHAR(128) NOT NULL,
      action VARCHAR(128) NOT NULL,
      target_type VARCHAR(128) NOT NULL,
      target_id VARCHAR(191) NOT NULL,
      details LONGTEXT NOT NULL,
      created_at VARCHAR(32) NOT NULL,
      PRIMARY KEY (id),
      KEY idx_audit_logs_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`,
    `CREATE TABLE IF NOT EXISTS store_settings (
      \`key\` VARCHAR(191) NOT NULL,
      value LONGTEXT NOT NULL,
      PRIMARY KEY (\`key\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`,
    `CREATE TABLE IF NOT EXISTS campaigns (
      id VARCHAR(191) NOT NULL,
      placement VARCHAR(64) NOT NULL,
      design_theme VARCHAR(64) NOT NULL,
      section_size VARCHAR(64) NOT NULL,
      offer_tag VARCHAR(255) NOT NULL,
      title VARCHAR(255) NOT NULL,
      subtitle TEXT NOT NULL,
      cta_label VARCHAR(255) NOT NULL,
      promo_code VARCHAR(128) NULL,
      target_category VARCHAR(100) NOT NULL,
      desktop_image_url TEXT NULL,
      mobile_image_url TEXT NULL,
      visual_key VARCHAR(128) NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_at VARCHAR(32) NOT NULL,
      updated_at VARCHAR(32) NOT NULL,
      PRIMARY KEY (id),
      KEY idx_campaigns_active_order (active, sort_order, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`,
    `CREATE TABLE IF NOT EXISTS flash_sales (
      id VARCHAR(191) NOT NULL,
      title VARCHAR(255) NOT NULL,
      subtitle TEXT NOT NULL,
      badge_label VARCHAR(128) NOT NULL DEFAULT 'FLASH SALE',
      target_category VARCHAR(100) NOT NULL,
      discount_pct DECIMAL(7,4) NOT NULL,
      design_theme VARCHAR(64) NOT NULL DEFAULT 'crimson',
      starts_at VARCHAR(32) NOT NULL,
      expires_at VARCHAR(32) NOT NULL,
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_by VARCHAR(255) NOT NULL,
      created_at VARCHAR(32) NOT NULL,
      updated_at VARCHAR(32) NOT NULL,
      PRIMARY KEY (id),
      KEY idx_flash_sales_active_expiry (active, expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`,
    `CREATE TABLE IF NOT EXISTS product_reviews (
      id VARCHAR(191) NOT NULL,
      product_id VARCHAR(191) NOT NULL,
      product_name VARCHAR(255) NOT NULL,
      author_name VARCHAR(255) NOT NULL,
      author_email VARCHAR(254) NULL,
      rating INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      comment TEXT NOT NULL,
      verified_purchase TINYINT(1) NOT NULL DEFAULT 0,
      helpful_count INT NOT NULL DEFAULT 0,
      created_at VARCHAR(32) NOT NULL,
      PRIMARY KEY (id),
      KEY idx_product_reviews_pid (product_id),
      CONSTRAINT fk_product_reviews_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`,
    `CREATE TABLE IF NOT EXISTS stock_waitlist (
      id VARCHAR(191) NOT NULL,
      product_id VARCHAR(191) NOT NULL,
      product_name VARCHAR(255) NOT NULL,
      sku VARCHAR(64) NOT NULL,
      variant VARCHAR(255) NOT NULL DEFAULT 'Standard',
      email VARCHAR(254) NOT NULL,
      created_at VARCHAR(32) NOT NULL,
      PRIMARY KEY (id),
      KEY idx_stock_waitlist_pid_email (product_id, email),
      CONSTRAINT fk_stock_waitlist_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`,
  ];

  for (const statement of schemaStatements) {
    await db.exec(statement);
  }

  const categoryColumns = (await db
    .prepare(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'store_categories'`
    )
    .all()) as Array<{ COLUMN_NAME: string }>;
  const existingCategoryColumns = new Set(categoryColumns.map((row) => row.COLUMN_NAME));
  if (!existingCategoryColumns.has('show_in_menu')) {
    await db.exec('ALTER TABLE store_categories ADD COLUMN show_in_menu TINYINT(1) NOT NULL DEFAULT 1');
  }
  if (!existingCategoryColumns.has('menu_label')) {
    await db.exec("ALTER TABLE store_categories ADD COLUMN menu_label VARCHAR(100) NOT NULL DEFAULT ''");
  }

  const resetCodeColumn = (await db
    .prepare(
      `SELECT CHARACTER_MAXIMUM_LENGTH as column_length
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'password_resets'
         AND COLUMN_NAME = 'code'`
    )
    .get()) as { column_length: number | string } | undefined;
  if (resetCodeColumn && Number(resetCodeColumn.column_length) < 64) {
    await db.exec('ALTER TABLE password_resets MODIFY COLUMN code VARCHAR(64) NOT NULL');
  }
  await db
    .prepare('UPDATE password_resets SET used = 1 WHERE used = 0 AND CHAR_LENGTH(code) = 6')
    .run();

  await db.prepare('INSERT IGNORE INTO store_settings (`key`, value) VALUES (?, ?)').run(
    'whatsapp_number',
    process.env.STORE_WHATSAPP_NUMBER || '96171972495'
  );
  await db.prepare(
    "UPDATE store_settings SET value = ? WHERE `key` = 'whatsapp_number' AND value = '15550192834'"
  ).run(process.env.STORE_WHATSAPP_NUMBER || '96171972495');
  await db.prepare('INSERT IGNORE INTO store_settings (`key`, value) VALUES (?, ?)').run(
    'store_name',
    'Sam Brand Store'
  );

  await seedInitialData();
  // Catalog content is owner-managed; demo catalog items are never seeded.
  await cleanupDemoData();
  await db.prepare("UPDATE store_categories SET active = 1 WHERE active = 1").run();
  const existingCategories = (await db
    .prepare('SELECT DISTINCT category FROM products WHERE active = 1 AND category IS NOT NULL AND category <> ?')
    .all('')) as Array<{ category: string }>;
  for (const [index, row] of existingCategories.entries()) {
    const name = row.category.trim();
    if (!name) continue;
    const slug = name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || `category-${index + 1}`;
    const id = `cat_${crypto.createHash('md5').update(name).digest('hex').slice(0, 12)}`;
    const now = new Date().toISOString();
    await db.prepare(
      'INSERT IGNORE INTO store_categories (id, name, slug, subtitle, image_url, sort_order, active, created_at, updated_at) VALUES (?, ?, ?, ?, NULL, ?, 1, ?, ?)'
    ).run(id, name, slug, '', index, now, now);
  }
  await backfillLocalImageAssets();

  // Ensure cmp_offer_2 uses dark navy theme so Hall-Effect title & subtitle render in crisp white
  await db.prepare(
    "UPDATE campaigns SET design_theme = 'navy' WHERE id = 'cmp_offer_2' AND design_theme = 'chalk'"
  ).run();
}

async function seedInitialReviews(): Promise<void> {
  const countRow = await db.prepare('SELECT COUNT(*) as c FROM product_reviews').get();
  const count = Number(countRow?.c ?? 0);
  if (count > 0) return;

  const insert = db.prepare(`
    INSERT INTO product_reviews (
      id, product_id, product_name, author_name, author_email, rating, title, comment, verified_purchase, helpful_count, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const initialReviews = [
    {
      id: 'rev_seed_1',
      productId: 'prod_ps5_pro',
      productName: 'PlayStation 5 Pro 2TB Console',
      authorName: 'Marcus V.',
      rating: 5,
      title: 'Rock-solid 4K 120Hz frame pacing',
      comment: 'Whisper quiet under full ray-tracing load and the 2TB SSD finally fits my entire tournament rotation.',
      verifiedPurchase: 1,
      helpfulCount: 14,
      createdAt: new Date(Date.now() - 8 * 86400_000).toISOString(),
    },
    {
      id: 'rev_seed_2',
      productId: 'prod_ps5_pro',
      productName: 'PlayStation 5 Pro 2TB Console',
      authorName: 'Tariq A.',
      rating: 5,
      title: 'Fast local dispatch & factory sealed',
      comment: 'Arrived same afternoon in Beirut. PSSR upscaling on a 4K OLED looks dramatically sharper than base PS5.',
      verifiedPurchase: 1,
      helpfulCount: 9,
      createdAt: new Date(Date.now() - 3 * 86400_000).toISOString(),
    },
    {
      id: 'rev_seed_3',
      productId: 'prod_rog_oled_32',
      productName: 'ROG Swift 32" 4K QD-OLED 240Hz',
      authorName: 'Nadia Mansour',
      rating: 5,
      title: 'Zero motion blur & calibrated HDR out of the box',
      comment: 'Switched from an IPS panel for color grading and competitive FPS. Text clarity and true blacks are unmatched.',
      verifiedPurchase: 1,
      helpfulCount: 18,
      createdAt: new Date(Date.now() - 10 * 86400_000).toISOString(),
    },
    {
      id: 'rev_seed_4',
      productId: 'prod_rog_oled_32',
      productName: 'ROG Swift 32" 4K QD-OLED 240Hz',
      authorName: 'Elena K.',
      rating: 4,
      title: 'Reference panel, heavy stand footprint',
      comment: 'Image quality is 10/10 at 240Hz. Worth noting the tripod desk legs need a deep desk if not VESA-mounted.',
      verifiedPurchase: 0,
      helpfulCount: 6,
      createdAt: new Date(Date.now() - 5 * 86400_000).toISOString(),
    },
    {
      id: 'rev_seed_5',
      productId: 'prod_novapulse_audio',
      productName: 'NovaPulse Pro Wireless Headset',
      authorName: 'Kieran Patel',
      rating: 5,
      title: 'Zero-latency dongle + studio imaging',
      comment: 'Planar drivers separate footsteps cleanly without bloated sub-bass. Battery comfortably clears a full work + gaming week.',
      verifiedPurchase: 1,
      helpfulCount: 11,
      createdAt: new Date(Date.now() - 14 * 86400_000).toISOString(),
    },
    {
      id: 'rev_seed_6',
      productId: 'prod_tactile75',
      productName: 'Tactile75 CNC Aluminum Keyboard',
      authorName: 'Sofia Lindqvist',
      rating: 5,
      title: 'Rapid trigger feels effortless',
      comment: 'Heavy CNC chassis never shifts on the desk and magnetic Hall-effect actuation makes counter-strafing instant.',
      verifiedPurchase: 1,
      helpfulCount: 13,
      createdAt: new Date(Date.now() - 16 * 86400_000).toISOString(),
    },
    {
      id: 'rev_seed_7',
      productId: 'prod_aerolite_mouse',
      productName: 'AeroLite 49g Wireless Esports Mouse',
      authorName: 'Devon Brooks',
      rating: 5,
      title: '8K wireless without a hitch',
      comment: 'At 49g with zero honeycomb holes, the optical switches feel crisp and coating grips nicely even in long sessions.',
      verifiedPurchase: 1,
      helpfulCount: 7,
      createdAt: new Date(Date.now() - 12 * 86400_000).toISOString(),
    },
    {
      id: 'rev_seed_8',
      productId: 'prod_ultrawide_34',
      productName: 'StudioWave 34" Ultrawide QD-OLED',
      authorName: 'Rami Khoury',
      rating: 5,
      title: 'Ideal timeline + flight sim curve',
      comment: '1800R curvature wraps naturally without distortion on architectural CAD work and sim racing.',
      verifiedPurchase: 1,
      helpfulCount: 5,
      createdAt: new Date(Date.now() - 20 * 86400_000).toISOString(),
    },
    {
      id: 'rev_seed_9',
      productId: 'prod_dualforce_ctrl',
      productName: 'DualForce Edge Pro Controller',
      authorName: 'Marcus V.',
      rating: 4,
      title: 'Replaceable stick modules save the day',
      comment: 'Back paddles and hair-trigger locks are super responsive. Battery life is ~7 hours on wireless.',
      verifiedPurchase: 1,
      helpfulCount: 8,
      createdAt: new Date(Date.now() - 6 * 86400_000).toISOString(),
    },
  ];

  for (const r of initialReviews) {
    await insert.run(
      r.id,
      r.productId,
      r.productName,
      r.authorName,
      null,
      r.rating,
      r.title,
      r.comment,
      r.verifiedPurchase,
      r.helpfulCount,
      r.createdAt
    );
  }
}

async function seedExtendedCatalog(): Promise<void> {
  const now = new Date().toISOString();
  const insertIgnore = db.prepare(`
    INSERT IGNORE INTO products (
      id, sku, slug, name, brand, category, price, compare_at_price, cost_price, stock,
      low_stock_threshold, \`condition\`, warranty, weight, dimensions, whats_in_box, tags,
      badge, tagline, description, specs, variants, visual_key, image_url, images,
      featured, active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `);

  const extraProducts = [
    {
      id: 'prod_ps5_cobalt_ltd',
      sku: 'SBS-CON-013',
      slug: 'ps5-pro-cobalt-tournament-bundle',
      name: 'PS5 Pro Cobalt Tournament Edition',
      brand: 'Sony Interactive',
      category: 'Consoles',
      price: 789,
      compareAtPrice: 849,
      costPrice: 615,
      stock: 0,
      lowStockThreshold: 4,
      condition: 'New',
      warranty: '2-Year Official Sam Brand Warranty',
      weight: '3.9 kg',
      dimensions: '388 x 216 x 89 mm',
      whatsInBox: ['PS5 Pro 2TB Console', 'DualSense Edge Cobalt', 'HDMI 2.1 Braided Cable', 'AC Power Cord'],
      tags: ['console', 'ps5', '4k', 'limited', 'bundle'],
      badge: 'Sold Out Drop',
      tagline: 'Limited numbered tournament console bundle — restock batch arriving soon.',
      description:
        'Collector-grade PlayStation 5 Pro paired with a custom Cobalt DualSense Edge controller and braided HDMI 2.1 cable. Join the restock alert list for priority dispatch.',
      specs: {
        Storage: '2TB Custom NVMe SSD',
        Output: '4K 120Hz / 8K VRR HDMI 2.1',
        Bundle: 'Includes DualSense Edge Controller',
        Warranty: '2-Year Official Sam Brand Warranty',
      },
      variants: ['2TB Cobalt Edition'],
      visualKey: 'console-pro',
      imageUrl: '/src/assets/images/cat_consoles.jpg',
      images: ['/src/assets/images/cat_consoles.jpg', '/src/assets/images/console_ps5_pro.jpg'],
      featured: 1,
    },
    {
      id: 'prod_rog_oled_32',
      sku: 'SBS-MON-014',
      slug: 'rog-swift-32-4k-oled-240hz',
      name: 'ROG Swift 32" 4K QD-OLED 240Hz',
      brand: 'ASUS ROG',
      category: 'Monitors',
      price: 1149,
      compareAtPrice: 1299,
      costPrice: 890,
      stock: 6,
      lowStockThreshold: 3,
      condition: 'New',
      warranty: '3-Year Burn-In & Zero Bright Dot Warranty',
      weight: '8.4 kg',
      dimensions: '718 x 580 x 274 mm',
      whatsInBox: ['ROG Swift 32" Display', 'DisplayPort 1.4 Cable', 'USB-C 90W Cable', 'VESA Mount Adapter'],
      tags: ['4k', 'oled', '240hz', 'asus', 'monitor'],
      badge: '4K OLED',
      tagline: 'True 4K 240Hz QD-OLED clarity with 90W USB-C KVM.',
      description:
        'Flagship 32-inch 4K QD-OLED panel engineered with custom graphene cooling, Dolby Vision HDR, and ultra-low 0.03ms pixel response.',
      specs: {
        Panel: '32" 4K UHD QD-OLED (3840x2160)',
        Refresh: '240Hz · 0.03ms GtG',
        Ports: '2x HDMI 2.1, DP 1.4, USB-C 90W',
        Color: '99% DCI-P3 · Delta E < 1.5',
      },
      variants: ['32" 4K Obsidian'],
      visualKey: 'oled-monitor',
      imageUrl: '/src/assets/images/asus_curved_monitor.jpg',
      images: ['/src/assets/images/asus_curved_monitor.jpg', '/src/assets/images/ultrawide_curved_pro.jpg'],
      featured: 1,
    },
    {
      id: 'prod_studio_dac_amp',
      sku: 'SBS-AUD-015',
      slug: 'audiopulse-desktop-dac-amp',
      name: 'AudioPulse Reference Desktop DAC',
      brand: 'SteelSeries / ESS',
      category: 'Audio',
      price: 279,
      compareAtPrice: 319,
      costPrice: 185,
      stock: 13,
      lowStockThreshold: 4,
      condition: 'New',
      warranty: '2-Year Official Sam Brand Warranty',
      weight: '0.68 kg',
      dimensions: '148 x 110 x 38 mm',
      whatsInBox: ['AudioPulse DAC Unit', 'Braided USB-C to USB-C', 'Optical Toslink Cable'],
      tags: ['dac', 'amp', 'audio', 'hi-res', 'balanced'],
      badge: 'Hi-Res',
      tagline: '32-bit/384kHz balanced headphone amp with tactile OLED volume wheel.',
      description:
        'Reference-grade Sabre DAC built for competitive footsteps and studio mastering, driving up to 600-ohm planar magnetic headphones cleanly.',
      specs: {
        Converter: '32-bit / 384kHz ESS Sabre DAC',
        Output: '4.4mm Balanced + 6.35mm Studio',
        SNR: '124 dB Ultra-Low Noise Floor',
        Chassis: 'Bead-Blasted CNC Aluminum',
      },
      variants: ['Matte Anodized Black'],
      visualKey: 'wireless-headset',
      imageUrl: '/src/assets/images/mic_studio.jpg',
      images: ['/src/assets/images/mic_studio.jpg', '/src/assets/images/headset_pro.jpg'],
      featured: 0,
    },
    {
      id: 'prod_carbon_desk_mat',
      sku: 'SBS-ACC-016',
      slug: 'apex-cordura-xl-desk-mat',
      name: 'Apex Cordura Glass-Weave Desk Mat',
      brand: 'Sam Brand',
      category: 'Accessories',
      price: 59,
      compareAtPrice: 75,
      costPrice: 24,
      stock: 42,
      lowStockThreshold: 10,
      condition: 'New',
      warranty: '2-Year Official Sam Brand Warranty',
      weight: '0.92 kg',
      dimensions: '900 x 400 x 4 mm',
      whatsInBox: ['Apex XL Desk Mat', 'Microfiber Care Cloth'],
      tags: ['mousepad', 'desk', 'cordura', 'accessories'],
      badge: 'Pro Surface',
      tagline: 'Water-repellent micro-weave surface with low-profile stitched edges.',
      description:
        'Balanced speed-and-control surface calibrated for optical esports sensors with a 4mm high-density Poron anti-slip base.',
      specs: {
        Dimensions: '900 x 400 x 4 mm XL',
        Surface: 'Cordura Micro-Weave Speed',
        Base: 'High-Density Anti-Slip Poron',
        Edges: 'Sub-Surface Flat Stitch',
      },
      variants: ['Stealth Charcoal', 'Cobalt Stitch'],
      visualKey: 'thunderbolt-dock',
      imageUrl: '/src/assets/images/cat_accessories.jpg',
      images: ['/src/assets/images/cat_accessories.jpg', '/src/assets/images/dock_tb4.jpg'],
      featured: 0,
    },
  ];

  for (const p of extraProducts) {
    await insertIgnore.run(
      p.id,
      p.sku,
      p.slug,
      p.name,
      p.brand,
      p.category,
      p.price,
      p.compareAtPrice,
      p.costPrice,
      p.stock,
      p.lowStockThreshold,
      p.condition,
      p.warranty,
      p.weight,
      p.dimensions,
      JSON.stringify(p.whatsInBox),
      JSON.stringify(p.tags),
      p.badge,
      p.tagline,
      p.description,
      JSON.stringify(p.specs),
      JSON.stringify(p.variants),
      p.visualKey,
      p.imageUrl,
      JSON.stringify(p.images),
      p.featured,
      now,
      now
    );
  }
}

async function backfillLocalImageAssets(): Promise<void> {
  const productGalleries: Record<string, string[]> = {
    prod_ps5_pro: [
      '/src/assets/images/console_ps5_pro.jpg',
      '/src/assets/images/console_side_ports_1795056138280.jpg',
      '/src/assets/images/controller_dualsense_pro.jpg',
    ],
    prod_oled_27: [
      '/src/assets/images/asus_curved_monitor.jpg',
      '/src/assets/images/monitor_stand_detail_1795056138414.jpg',
      '/src/assets/images/hero_esports_desk.jpg',
    ],
    prod_novapulse_audio: [
      '/src/assets/images/headset_pro.jpg',
      '/src/assets/images/audio_headset_kit_1795056138089.jpg',
      '/src/assets/images/hero_esports_desk.jpg',
    ],
    prod_tactile75: [
      '/src/assets/images/keyboard_cnc.jpg',
      '/src/assets/images/peripherals_macro_switches_1795056138256.jpg',
      '/src/assets/images/hero_esports_desk.jpg',
    ],
    prod_aerolite_mouse: [
      '/src/assets/images/mouse_wireless_pro.jpg',
      '/src/assets/images/peripherals_macro_switches_1795056138256.jpg',
      '/src/assets/images/hero_esports_desk.jpg',
    ],
    prod_horizon_handheld: [
      '/src/assets/images/handheld_oled_pro.jpg',
      '/src/assets/images/console_side_ports_1795056138280.jpg',
      '/src/assets/images/cat_consoles.jpg',
    ],
    prod_dualforce_ctrl: [
      '/src/assets/images/controller_dualsense_pro.jpg',
      '/src/assets/images/console_ps5_pro.jpg',
      '/src/assets/images/cat_accessories.jpg',
    ],
    prod_ultrawide_34: [
      '/src/assets/images/ultrawide_curved_pro.jpg',
      '/src/assets/images/monitor_stand_detail_1795056138414.jpg',
      '/src/assets/images/asus_curved_monitor.jpg',
    ],
    prod_hyperdock: [
      '/src/assets/images/dock_tb4.jpg',
      '/src/assets/images/console_side_ports_1795056138280.jpg',
      '/src/assets/images/cat_accessories.jpg',
    ],
    prod_echocast_mic: [
      '/src/assets/images/mic_studio.jpg',
      '/src/assets/images/audio_headset_kit_1795056138089.jpg',
      '/src/assets/images/headset_pro.jpg',
    ],
    prod_xbox_galaxy: [
      '/src/assets/images/xbox_galaxy_pro.jpg',
      '/src/assets/images/console_side_ports_1795056138280.jpg',
      '/src/assets/images/cat_consoles.jpg',
    ],
    prod_macro_deck: [
      '/src/assets/images/macro_deck.jpg',
      '/src/assets/images/peripherals_macro_switches_1795056138256.jpg',
      '/src/assets/images/keyboard_cnc.jpg',
    ],
    prod_ps5_cobalt_ltd: [
      '/src/assets/images/cat_consoles.jpg',
      '/src/assets/images/console_ps5_pro.jpg',
      '/src/assets/images/console_side_ports_1795056138280.jpg',
    ],
    prod_rog_oled_32: [
      '/src/assets/images/asus_curved_monitor.jpg',
      '/src/assets/images/monitor_stand_detail_1795056138414.jpg',
      '/src/assets/images/ultrawide_curved_pro.jpg',
    ],
    prod_studio_dac_amp: [
      '/src/assets/images/mic_studio.jpg',
      '/src/assets/images/audio_headset_kit_1795056138089.jpg',
      '/src/assets/images/headset_pro.jpg',
    ],
    prod_carbon_desk_mat: [
      '/src/assets/images/cat_accessories.jpg',
      '/src/assets/images/dock_tb4.jpg',
      '/src/assets/images/peripherals_macro_switches_1795056138256.jpg',
    ],
  };

  const selectProd = db.prepare('SELECT id, image_url, images FROM products WHERE id = ?');
  const updateProdGallery = db.prepare(
    'UPDATE products SET image_url = ?, images = ? WHERE id = ?'
  );

  for (const [id, gallery] of Object.entries(productGalleries)) {
    const row = (await selectProd.get(id)) as
      | { id: string; image_url: string | null; images: string }
      | undefined;
    if (!row) continue;
    let existingImages: string[] = [];
    try {
      const parsed = JSON.parse(row.images || '[]');
      if (Array.isArray(parsed)) {
        existingImages = parsed.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
      }
    } catch {
      existingImages = [];
    }
    // Upgrade seeded items with fewer than 3 placeholder gallery angles so every item has multi-image gallery
    if (existingImages.length < 3) {
      const merged = Array.from(new Set([...existingImages, ...gallery])).slice(0, 5);
      await updateProdGallery.run(
        merged[0] || row.image_url || gallery[0],
        JSON.stringify(merged),
        id
      );
    }
  }

  const campaignImages: Record<string, string> = {
    cmp_hero_1: '/src/assets/images/hero_esports_desk.jpg',
    cmp_hero_2: '/src/assets/images/asus_curved_monitor.jpg',
    cmp_offer_1: '/src/assets/images/ultrawide_curved_pro.jpg',
    cmp_offer_2: '/src/assets/images/keyboard_cnc.jpg',
    cmp_offer_3: '/src/assets/images/headset_pro.jpg',
  };

  const updateCampImg = db.prepare(
    "UPDATE campaigns SET desktop_image_url = COALESCE(NULLIF(desktop_image_url, ''), ?), mobile_image_url = COALESCE(NULLIF(mobile_image_url, ''), ?) WHERE id = ?"
  );
  for (const [id, url] of Object.entries(campaignImages)) {
    await updateCampImg.run(url, url, id);
  }
}

async function seedHistoricalAnalyticsOrders(): Promise<void> {
  const existingHist = await db.prepare("SELECT id FROM orders WHERE id = 'ord_hist_1'").get();
  if (existingHist) return;

  const insertOrder = db.prepare(`
    INSERT IGNORE INTO orders (
      id, order_number, user_id, customer_name, customer_email, customer_phone,
      shipping_address, city, postal_code, payment_method, payment_status,
      payment_last4, transaction_ref, order_status, subtotal, shipping_cost,
      discount_amount, tax_amount, total, promo_code, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertItem = db.prepare(`
    INSERT IGNORE INTO order_items (
      id, order_id, product_id, product_name, sku, variant_label, quantity, unit_price, line_total
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const daysAgo = (d: number) => new Date(Date.now() - d * 86400_000).toISOString();

  const historicalOrders = [
    {
      id: 'ord_hist_1',
      orderNumber: 'SBS-1033',
      customerName: 'Nadia Mansour',
      customerEmail: 'nadia.m@studio.co',
      city: 'Beirut',
      paymentMethod: 'card',
      subtotal: 1448,
      taxAmount: 115.84,
      total: 1563.84,
      days: 12,
      items: [
        { id: 'oi_h1', productId: 'prod_rog_oled_32', name: 'ROG Swift 32" 4K QD-OLED 240Hz', sku: 'SBS-MON-014', variant: '32" 4K Obsidian', qty: 1, price: 1149 },
        { id: 'oi_h2', productId: 'prod_dualforce_ctrl', name: 'DualForce Edge Pro Controller', sku: 'SBS-ACC-007', variant: 'Midnight Cobalt', qty: 1, price: 199 },
      ],
    },
    {
      id: 'ord_hist_2',
      orderNumber: 'SBS-1034',
      customerName: 'Devon Brooks',
      customerEmail: 'devon@esports.org',
      city: 'Austin',
      paymentMethod: 'wallet',
      subtotal: 828,
      taxAmount: 66.24,
      total: 894.24,
      days: 19,
      items: [
        { id: 'oi_h3', productId: 'prod_ps5_pro', name: 'PlayStation 5 Pro 2TB Console', sku: 'SBS-CON-001', variant: '2TB Standard Edition', qty: 1, price: 699 },
        { id: 'oi_h4', productId: 'prod_aerolite_mouse', name: 'AeroLite 49g Wireless Esports Mouse', sku: 'SBS-PER-005', variant: 'Matte Black', qty: 1, price: 129 },
      ],
    },
    {
      id: 'ord_hist_3',
      orderNumber: 'SBS-1035',
      customerName: 'Kieran Patel',
      customerEmail: 'kieran@audioforge.io',
      city: 'Chicago',
      paymentMethod: 'card',
      subtotal: 667,
      taxAmount: 53.36,
      total: 720.36,
      days: 26,
      items: [
        { id: 'oi_h5', productId: 'prod_studio_dac_amp', name: 'AudioPulse Reference Desktop DAC', sku: 'SBS-AUD-015', variant: 'Matte Anodized Black', qty: 1, price: 279 },
        { id: 'oi_h6', productId: 'prod_novapulse_audio', name: 'NovaPulse Pro Wireless Headset', sku: 'SBS-AUD-003', variant: 'Graphite Matte', qty: 1, price: 229 },
        { id: 'oi_h7', productId: 'prod_echocast_mic', name: 'EchoCast Studio Dynamic Mic', sku: 'SBS-AUD-010', variant: 'Matte Charcoal', qty: 1, price: 159 },
      ],
    },
    {
      id: 'ord_hist_4',
      orderNumber: 'SBS-1036',
      customerName: 'Sofia Lindqvist',
      customerEmail: 'sofia@nordic.gg',
      city: 'Seattle',
      paymentMethod: 'card',
      subtotal: 1088,
      taxAmount: 87.04,
      total: 1175.04,
      days: 38,
      items: [
        { id: 'oi_h8', productId: 'prod_ultrawide_34', name: 'StudioWave 34" Ultrawide QD-OLED', sku: 'SBS-MON-008', variant: '34" 180Hz Dark Slate', qty: 1, price: 899 },
        { id: 'oi_h9', productId: 'prod_tactile75', name: 'Tactile75 CNC Aluminum Keyboard', sku: 'SBS-PER-004', variant: 'Linear Magnetic Slate', qty: 1, price: 189 },
      ],
    },
    {
      id: 'ord_hist_5',
      orderNumber: 'SBS-1037',
      customerName: 'Rami Khoury',
      customerEmail: 'rami@khourydesign.com',
      city: 'Dubai',
      paymentMethod: 'cod',
      subtotal: 907,
      taxAmount: 72.56,
      total: 979.56,
      days: 54,
      items: [
        { id: 'oi_h10', productId: 'prod_xbox_galaxy', name: 'Xbox Series X 2TB Galaxy Edition', sku: 'SBS-CON-011', variant: '2TB Galaxy Black', qty: 1, price: 599 },
        { id: 'oi_h11', productId: 'prod_hyperdock', name: 'HyperDock Thunderbolt 4 Station', sku: 'SBS-ACC-009', variant: 'Space Gray', qty: 1, price: 249 },
        { id: 'oi_h12', productId: 'prod_carbon_desk_mat', name: 'Apex Cordura Glass-Weave Desk Mat', sku: 'SBS-ACC-016', variant: 'Stealth Charcoal', qty: 1, price: 59 },
      ],
    },
    {
      id: 'ord_hist_6',
      orderNumber: 'SBS-1038',
      customerName: 'Claire Moreau',
      customerEmail: 'claire@prostream.tv',
      city: 'Toronto',
      paymentMethod: 'card',
      subtotal: 1298,
      taxAmount: 103.84,
      total: 1401.84,
      days: 78,
      items: [
        { id: 'oi_h13', productId: 'prod_oled_27', name: 'ApexBlade 27" OLED 240Hz Monitor', sku: 'SBS-MON-002', variant: 'Matte Obsidian', qty: 1, price: 749 },
        { id: 'oi_h14', productId: 'prod_horizon_handheld', name: 'Horizon Pocket OLED Handheld', sku: 'SBS-CON-006', variant: '1TB OLED Matte', qty: 1, price: 549 },
      ],
    },
    {
      id: 'ord_hist_7',
      orderNumber: 'SBS-1039',
      customerName: 'Lucas Meyer',
      customerEmail: 'lucas@meyerlab.de',
      city: 'San Diego',
      paymentMethod: 'wallet',
      subtotal: 699,
      taxAmount: 55.92,
      total: 754.92,
      days: 112,
      items: [
        { id: 'oi_h15', productId: 'prod_ps5_pro', name: 'PlayStation 5 Pro 2TB Console', sku: 'SBS-CON-001', variant: '2TB Standard Edition', qty: 1, price: 699 },
      ],
    },
    {
      id: 'ord_hist_8',
      orderNumber: 'SBS-1040',
      customerName: 'Maya Takahashi',
      customerEmail: 'maya@tokyorigs.jp',
      city: 'San Jose',
      paymentMethod: 'card',
      subtotal: 616,
      taxAmount: 49.28,
      total: 665.28,
      days: 148,
      items: [
        { id: 'oi_h16', productId: 'prod_macro_deck', name: 'StreamDeck 15-Key Macro Console', sku: 'SBS-PER-012', variant: 'Carbon Black', qty: 2, price: 149 },
        { id: 'oi_h17', productId: 'prod_tactile75', name: 'Tactile75 CNC Aluminum Keyboard', sku: 'SBS-PER-004', variant: 'Tactile Obsidian', qty: 1, price: 189 },
        { id: 'oi_h18', productId: 'prod_aerolite_mouse', name: 'AeroLite 49g Wireless Esports Mouse', sku: 'SBS-PER-005', variant: 'Chalk White', qty: 1, price: 129 },
      ],
    },
  ];

  for (const o of historicalOrders) {
    const ts = daysAgo(o.days);
    await insertOrder.run(
      o.id,
      o.orderNumber,
      null,
      o.customerName,
      o.customerEmail,
      '+1 (555) 204-8890',
      '400 Hardware Plaza',
      o.city,
      '94105',
      o.paymentMethod,
      'paid',
      o.paymentMethod === 'cod' ? null : '4242',
      `TXN-HIST-${o.orderNumber}`,
      'delivered',
      o.subtotal,
      0,
      0,
      o.taxAmount,
      o.total,
      null,
      null,
      ts,
      ts
    );
    for (const item of o.items) {
      await insertItem.run(
        item.id,
        o.id,
        item.productId,
        item.name,
        item.sku,
        item.variant,
        item.qty,
        item.price,
        item.qty * item.price
      );
    }
  }
}

async function seedInitialData(): Promise<void> {
  const isProduction = process.env.NODE_ENV === 'production';
  const roleCountRow = await db.prepare('SELECT COUNT(*) as c FROM roles').get();
  const roleCount = Number(roleCountRow?.c ?? 0);
  const now = new Date().toISOString();

  if (roleCount === 0) {
    const insertRole = db.prepare(`
      INSERT INTO roles (id, name, slug, description, permissions, max_discount_pct, max_refund_amount, is_system, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const seedRoles: Array<{
      id: string;
      name: string;
      slug: string;
      description: string;
      permissions: PermissionKey[];
      maxDiscount: number;
      maxRefund: number;
      isSystem: number;
    }> = [
      {
        id: 'role_owner',
        name: 'Store Owner',
        slug: 'owner',
        description: 'Unrestricted access across catalog, marketing, orders, analytics, staff, and RBAC rules.',
        permissions: [
          'products:read',
          'products:write',
          'products:delete',
          'campaigns:manage',
          'orders:read',
          'orders:manage',
          'orders:refund',
          'staff:read',
          'staff:manage',
          'roles:manage',
          'analytics:read',
          'audit:read',
        ],
        maxDiscount: 100,
        maxRefund: 100000,
        isSystem: 1,
      },
      {
        id: 'role_manager',
        name: 'Store Manager',
        slug: 'manager',
        description: 'Operates daily store catalog, marketing banners, pricing, fulfillment, and team visibility.',
        permissions: [
          'products:read',
          'products:write',
          'campaigns:manage',
          'orders:read',
          'orders:manage',
          'orders:refund',
          'staff:read',
          'analytics:read',
          'audit:read',
        ],
        maxDiscount: 25,
        maxRefund: 1500,
        isSystem: 1,
      },
      {
        id: 'role_inventory',
        name: 'Inventory Specialist',
        slug: 'inventory',
        description: 'Creates products, tracks SKU thresholds, and updates live stock levels.',
        permissions: ['products:read', 'products:write', 'analytics:read'],
        maxDiscount: 0,
        maxRefund: 0,
        isSystem: 0,
      },
      {
        id: 'role_fulfillment',
        name: 'Fulfillment Agent',
        slug: 'fulfillment',
        description: 'Packs and dispatches customer orders without access to pricing or refunds.',
        permissions: ['orders:read', 'orders:manage', 'products:read'],
        maxDiscount: 0,
        maxRefund: 0,
        isSystem: 0,
      },
      {
        id: 'role_support',
        name: 'Support Specialist',
        slug: 'support',
        description: 'Assists customers with order lookup and approved partial or full refunds.',
        permissions: ['orders:read', 'orders:refund', 'products:read'],
        maxDiscount: 10,
        maxRefund: 350,
        isSystem: 0,
      },
      {
        id: 'role_customer',
        name: 'Customer',
        slug: 'customer',
        description: 'Standard storefront shopper account.',
        permissions: [],
        maxDiscount: 0,
        maxRefund: 0,
        isSystem: 1,
      },
    ];

    for (const r of seedRoles) {
      await insertRole.run(
        r.id,
        r.name,
        r.slug,
        r.description,
        JSON.stringify(r.permissions),
        r.maxDiscount,
        r.maxRefund,
        r.isSystem,
        now
      );
    }
  }

  const userCountRow = await db.prepare('SELECT COUNT(*) as c FROM users').get();
  const userCount = Number(userCountRow?.c ?? 0);
  if (userCount === 0) {
    const insertUser = db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role_id, custom_permissions, department_scope, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)
    `);
    const isProduction = process.env.NODE_ENV === 'production';
    const configuredOwnerEmail = process.env.ADMIN_EMAIL?.trim();
    const ownerEmail = configuredOwnerEmail || 'sam@sambrandstore.com';
    const ownerPassword = process.env.ADMIN_PASSWORD || 'SamAdmin2026!';
    const knownDefaultPasswords = [
      'SamAdmin2026!',
      'MayaOps2026!',
      'AlexStock2026!',
      'LiamShip2026!',
    ];

    if (
      isProduction &&
      (!configuredOwnerEmail ||
        ownerPassword.length < 16 ||
        knownDefaultPasswords.includes(ownerPassword))
    ) {
      throw new Error(
        'Production database initialization requires a configured ADMIN_EMAIL and a unique ADMIN_PASSWORD of at least 16 characters.'
      );
    }

    await insertUser.run(
      'usr_sam_owner',
      'Sam Vance',
      ownerEmail,
      hashPassword(ownerPassword),
      'role_owner',
      '[]',
      'all',
      now
    );
    if (false) {
      await insertUser.run(
        'usr_maya_mgr',
        'Maya Lin',
        'maya.ops@sambrandstore.com',
        hashPassword('MayaOps2026!'),
        'role_manager',
        '[]',
        'all',
        now
      );
      await insertUser.run(
        'usr_alex_inv',
        'Alex Rivera',
        'alex.stock@sambrandstore.com',
        hashPassword('AlexStock2026!'),
        'role_inventory',
        '[]',
        'Monitors,Peripherals',
        now
      );
      await insertUser.run(
        'usr_liam_ship',
        'Liam Patel',
        'liam.ship@sambrandstore.com',
        hashPassword('LiamShip2026!'),
        'role_fulfillment',
        '[]',
        'all',
        now
      );
    }
  }

  const prodCountRow = await db.prepare('SELECT COUNT(*) as c FROM products').get();
  const prodCount = Number(prodCountRow?.c ?? 0);
  if (false) {
    const insertProd = db.prepare(`
      INSERT INTO products (
        id, sku, slug, name, brand, category, price, compare_at_price, stock,
        low_stock_threshold, badge, tagline, description, specs, variants,
        visual_key, image_url, featured, active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `);

    const seedProducts = [
      {
        id: 'prod_ps5_pro',
        sku: 'SBS-CON-001',
        slug: 'playstation-5-pro-2tb',
        name: 'PlayStation 5 Pro 2TB Console',
        brand: 'Sony Interactive',
        category: 'Consoles',
        price: 699,
        compareAtPrice: 749,
        stock: 18,
        lowStockThreshold: 5,
        badge: 'Flagship',
        tagline: '4K 120Hz ray-traced fidelity with 2TB ultra-fast NVMe storage.',
        description:
          'Engineered for high-frame-rate 4K gaming with AI-upscaled clarity, hardware ray tracing, Wi-Fi 7 connectivity, and DualSense haptic feedback.',
        specs: {
          Storage: '2TB Custom NVMe SSD',
          Output: '4K 120Hz / 8K VRR HDMI 2.1',
          Wireless: 'Wi-Fi 7 & Bluetooth 5.3',
          Warranty: '2-Year Official Sam Brand Warranty',
        },
        variants: ['2TB Standard Edition', '2TB + Extra DualSense'],
        visualKey: 'console-pro',
        featured: 1,
      },
      {
        id: 'prod_oled_27',
        sku: 'SBS-MON-002',
        slug: 'apexblade-27-oled-240hz',
        name: 'ApexBlade 27" OLED 240Hz Monitor',
        brand: 'MSI Gaming',
        category: 'Monitors',
        price: 749,
        compareAtPrice: 829,
        stock: 11,
        lowStockThreshold: 4,
        badge: 'Esports Grade',
        tagline: '0.03ms GtG response time and DisplayHDR True Black 400.',
        description:
          'Self-emissive QD-OLED panel delivering infinite contrast, 240Hz tournament refresh rate, and custom graphene heatsink cooling with zero fan noise.',
        specs: {
          Panel: '27" WQHD QD-OLED (2560x1440)',
          Refresh: '240Hz · 0.03ms GtG',
          Ports: '2x HDMI 2.1, DisplayPort 1.4a, USB-C 90W',
          Color: '99.3% DCI-P3 Factory Calibrated',
        },
        variants: ['Matte Obsidian', 'Silver Aluminum Stand'],
        visualKey: 'oled-monitor',
        featured: 1,
      },
      {
        id: 'prod_novapulse_audio',
        sku: 'SBS-AUD-003',
        slug: 'novapulse-pro-spatial-headset',
        name: 'NovaPulse Pro Wireless Headset',
        brand: 'SteelSeries',
        category: 'Audio',
        price: 229,
        compareAtPrice: 259,
        stock: 26,
        lowStockThreshold: 6,
        badge: 'Best Seller',
        tagline: 'Dual-wireless 2.4GHz lossless audio with active noise cancellation.',
        description:
          'Hear directional cues before enemies turn the corner. Features custom neodymium drivers, hot-swappable dual battery packs, and broadcast-grade retractable mic.',
        specs: {
          Drivers: '40mm Hi-Res Neodymium',
          Battery: '44 Hours (Dual Swappable Cells)',
          Connectivity: '2.4GHz Lossless + Bluetooth 5.3',
          Weight: '312g Anodized Aluminum Frame',
        },
        variants: ['Graphite Matte', 'Arctic White'],
        visualKey: 'wireless-headset',
        featured: 1,
      },
      {
        id: 'prod_tactile75',
        sku: 'SBS-PER-004',
        slug: 'tactile75-cnc-keyboard',
        name: 'Tactile75 CNC Aluminum Keyboard',
        brand: 'Keychron Pro',
        category: 'Peripherals',
        price: 189,
        compareAtPrice: null,
        stock: 14,
        lowStockThreshold: 5,
        badge: 'Limited Run',
        tagline: 'Gasket-mounted 75% hall-effect rapid trigger magnetic switches.',
        description:
          'Milled from solid 6063 aerospace aluminum with adjustable actuation from 0.1mm to 4.0mm, acoustic Poron dampening, and 8000Hz polling over USB-C.',
        specs: {
          Chassis: 'CNC Machined 6063 Aluminum',
          Switches: 'Magnetic Hall-Effect Rapid Trigger',
          Polling: '8000Hz Wired / 1000Hz 2.4GHz',
          Keycaps: 'Double-Shot PBT Cherry Profile',
        },
        variants: ['Linear Magnetic Slate', 'Tactile Obsidian'],
        visualKey: 'mechanical-keyboard',
        featured: 1,
      },
      {
        id: 'prod_aerolite_mouse',
        sku: 'SBS-PER-005',
        slug: 'aerolite-49g-esports-mouse',
        name: 'AeroLite 49g Wireless Esports Mouse',
        brand: 'Logitech G Pro',
        category: 'Peripherals',
        price: 129,
        compareAtPrice: 149,
        stock: 32,
        lowStockThreshold: 8,
        badge: 'In Stock',
        tagline: '49-gram magnesium-composite shell with 30,000 DPI optical sensor.',
        description:
          'Zero-latency wireless precision crafted for competitive FPS players, equipped with optical micro-switches, virgin PTFE skates, and 4KHz wireless receiver.',
        specs: {
          Weight: '49 Grams Ultra-Light',
          Sensor: '30,000 DPI Optical · 750 IPS',
          Battery: '85 Hours Continuous Play',
          Polling: '4000Hz Wireless Dongle Included',
        },
        variants: ['Matte Black', 'Chalk White'],
        visualKey: 'esports-mouse',
        featured: 0,
      },
      {
        id: 'prod_horizon_handheld',
        sku: 'SBS-CON-006',
        slug: 'horizon-pocket-oled-handheld',
        name: 'Horizon Pocket OLED Handheld',
        brand: 'Valve / Steam',
        category: 'Consoles',
        price: 549,
        compareAtPrice: 599,
        stock: 9,
        lowStockThreshold: 4,
        badge: 'New Arrival',
        tagline: '7.4-inch 90Hz HDR OLED portable PC gaming powerhouse.',
        description:
          'Take AAA libraries anywhere with a custom 6nm APU, crisp HDR OLED display, dual trackpads, and a 50Whr battery built for long flights.',
        specs: {
          Display: '7.4" HDR OLED · 90Hz · 1000 nits',
          Storage: '1TB NVMe + MicroSD UHS-II',
          Memory: '16GB LPDDR5 6400MT/s',
          Audio: 'Dual Front Stereo + 3.5mm Hi-Fi',
        },
        variants: ['1TB OLED Matte', '512GB OLED Gloss'],
        visualKey: 'handheld-console',
        featured: 1,
      },
      {
        id: 'prod_dualforce_ctrl',
        sku: 'SBS-ACC-007',
        slug: 'dualforce-edge-pro-controller',
        name: 'DualForce Edge Pro Controller',
        brand: 'Sony Interactive',
        category: 'Accessories',
        price: 199,
        compareAtPrice: null,
        stock: 21,
        lowStockThreshold: 5,
        badge: null,
        tagline: 'Swappable hall-effect stick modules and programmable rear paddles.',
        description:
          'Tournament-tuned wireless controller featuring adjustable trigger hair-locks, braided lockable USB-C cable, and carry case with charging pass-through.',
        specs: {
          Sticks: 'Replaceable Zero-Drift Modules',
          Triggers: '3-Stage Hair-Trigger Locks',
          RearInputs: '4 Magnetic Metal Paddles',
          Battery: 'USB-C Fast Charge + Braided 3m',
        },
        variants: ['Midnight Cobalt', 'Glacier White'],
        visualKey: 'pro-controller',
        featured: 0,
      },
      {
        id: 'prod_ultrawide_34',
        sku: 'SBS-MON-008',
        slug: 'studiowave-34-ultrawide-180hz',
        name: 'StudioWave 34" Ultrawide QD-OLED',
        brand: 'MSI Gaming',
        category: 'Monitors',
        price: 899,
        compareAtPrice: 999,
        stock: 4,
        lowStockThreshold: 5,
        badge: 'Low Stock',
        tagline: '1800R curved 3440x1440 ultrawide immersion at 180Hz.',
        description:
          'Built for sim racing, open-world RPGs, and multitasking studio timelines with built-in KVM switch and 98W USB-C single-cable laptop power.',
        specs: {
          Resolution: '3440 x 1440 (21:9 Curved 1800R)',
          Refresh: '180Hz · FreeSync Premium Pro',
          KVM: 'Integrated Dual-Host KVM Switch',
          PowerDelivery: '98W USB-C DisplayPort Alt Mode',
        },
        variants: ['34" 180Hz Dark Slate'],
        visualKey: 'ultrawide-monitor',
        featured: 0,
      },
      {
        id: 'prod_hyperdock',
        sku: 'SBS-ACC-009',
        slug: 'hyperdock-tb4-pro-station',
        name: 'HyperDock Thunderbolt 4 Station',
        brand: 'CalDigit',
        category: 'Accessories',
        price: 249,
        compareAtPrice: 279,
        stock: 15,
        lowStockThreshold: 4,
        badge: null,
        tagline: '18-port anodized aluminum desk hub with 2.5GbE and dual 4K.',
        description:
          'Clean up desk clutter with one Thunderbolt 4 host cable supplying 98W charging, 2.5 Gigabit Ethernet, SD 4.0 UHS-II, and dual 4K 60Hz display output.',
        specs: {
          Ports: '18 Total (3x TB4, 5x USB-A, 3x USB-C)',
          Network: '2.5GbE Low-Latency Ethernet',
          Power: '98W Host Charging',
          Chassis: 'Finned Passive Aluminum Heatsink',
        },
        variants: ['Space Gray'],
        visualKey: 'thunderbolt-dock',
        featured: 0,
      },
      {
        id: 'prod_echocast_mic',
        sku: 'SBS-AUD-010',
        slug: 'echocast-studio-usb-mic',
        name: 'EchoCast Studio Dynamic Mic',
        brand: 'Shure / Elgato',
        category: 'Audio',
        price: 159,
        compareAtPrice: 179,
        stock: 19,
        lowStockThreshold: 5,
        badge: null,
        tagline: 'Broadcast dynamic capsule rejecting keyboard & room echo.',
        description:
          'Studio-grade voice isolation over USB-C or XLR with onboard capacitive mute, zero-latency headphone monitoring, and steel shock-mount yoke.',
        specs: {
          Capsule: 'Dynamic Cardioid Voice Isolation',
          Output: '24-bit/96kHz USB-C & Balanced XLR',
          Controls: 'Gain Dial + Touch Mute LED Ring',
          Mount: '5/8" & 3/8" Boom Arm Ready',
        },
        variants: ['Matte Charcoal'],
        visualKey: 'studio-mic',
        featured: 0,
      },
      {
        id: 'prod_xbox_galaxy',
        sku: 'SBS-CON-011',
        slug: 'xbox-series-x-2tb-galaxy',
        name: 'Xbox Series X 2TB Galaxy Edition',
        brand: 'Microsoft Xbox',
        category: 'Consoles',
        price: 599,
        compareAtPrice: null,
        stock: 7,
        lowStockThreshold: 4,
        badge: 'Collector Run',
        tagline: '12 teraflops of true 4K HDR power with 2TB internal SSD.',
        description:
          'Quick Resume across multiple games, Dolby Vision gaming, Spatial Sound, and matching Galaxy Black wireless controller right out of the box.',
        specs: {
          Storage: '2TB Custom PCIe Gen 4 SSD',
          GPU: '12 TFLOPS RDNA 2 · 4K 120fps',
          Optical: '4K UHD Blu-ray Drive Included',
          Audio: 'Dolby Atmos & DTS:X',
        },
        variants: ['2TB Galaxy Black'],
        visualKey: 'xbox-console',
        featured: 0,
      },
      {
        id: 'prod_macro_deck',
        sku: 'SBS-PER-012',
        slug: 'streamdeck-macro-console',
        name: 'StreamDeck 15-Key Macro Console',
        brand: 'Elgato',
        category: 'Peripherals',
        price: 149,
        compareAtPrice: 169,
        stock: 3,
        lowStockThreshold: 5,
        badge: 'Low Stock',
        tagline: '15 tactile LCD keys for instant scene switching and workflow macros.',
        description:
          'Automate OBS scenes, Discord audio routing, lighting profiles, and multi-step editing shortcuts with crisp dynamic LCD keycaps.',
        specs: {
          Keys: '15 Customizable LCD Tactile Keys',
          Stand: 'Detachable Weighted Anti-Slip Stand',
          Interface: 'USB-C Braided Cable',
          Compatibility: 'macOS, Windows, OBS, Twitch',
        },
        variants: ['Carbon Black'],
        visualKey: 'macro-deck',
        imageUrl: '/src/assets/images/macro_deck.jpg',
        featured: 0,
      },
    ];

    const seedProductImageMap: Record<string, string> = {
      prod_ps5_pro: '/src/assets/images/console_ps5_pro.jpg',
      prod_oled_27: '/src/assets/images/asus_curved_monitor.jpg',
      prod_novapulse_audio: '/src/assets/images/headset_pro.jpg',
      prod_tactile75: '/src/assets/images/keyboard_cnc.jpg',
      prod_aerolite_mouse: '/src/assets/images/mouse_wireless_pro.jpg',
      prod_horizon_handheld: '/src/assets/images/handheld_oled_pro.jpg',
      prod_dualforce_ctrl: '/src/assets/images/controller_dualsense_pro.jpg',
      prod_ultrawide_34: '/src/assets/images/ultrawide_curved_pro.jpg',
      prod_hyperdock: '/src/assets/images/dock_tb4.jpg',
      prod_echocast_mic: '/src/assets/images/mic_studio.jpg',
      prod_xbox_galaxy: '/src/assets/images/xbox_galaxy_pro.jpg',
      prod_macro_deck: '/src/assets/images/macro_deck.jpg',
    };

    for (const p of seedProducts) {
      await insertProd.run(
        p.id,
        p.sku,
        p.slug,
        p.name,
        p.brand,
        p.category,
        p.price,
        p.compareAtPrice,
        p.stock,
        p.lowStockThreshold,
        p.badge,
        p.tagline,
        p.description,
        JSON.stringify(p.specs),
        JSON.stringify(p.variants),
        p.visualKey,
        seedProductImageMap[p.id] || null,
        p.featured,
        now,
        now
      );
    }
  }

  const orderCountRow = await db.prepare('SELECT COUNT(*) as c FROM orders').get();
  const orderCount = Number(orderCountRow?.c ?? 0);
  if (false) {
    const insertOrder = db.prepare(`
      INSERT INTO orders (
        id, order_number, user_id, customer_name, customer_email, customer_phone,
        shipping_address, city, postal_code, payment_method, payment_status,
        payment_last4, transaction_ref, order_status, subtotal, shipping_cost,
        discount_amount, tax_amount, total, promo_code, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertItem = db.prepare(`
      INSERT INTO order_items (
        id, order_id, product_id, product_name, sku, variant_label, quantity, unit_price, line_total
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const daysAgo = (d: number) => new Date(Date.now() - d * 86400_000).toISOString();

    const sampleOrders = [
      {
        id: 'ord_seed_1',
        orderNumber: 'SBS-1041',
        userId: null,
        customerName: 'Jordan Reyes',
        customerEmail: 'jordan@example.com',
        customerPhone: '+1 (415) 890-2311',
        shippingAddress: '742 Evergreen Terrace, Suite 4B',
        city: 'San Francisco',
        postalCode: '94107',
        paymentMethod: 'card',
        paymentStatus: 'paid',
        paymentLast4: '4242',
        transactionRef: 'TXN-98A41F2C',
        orderStatus: 'delivered',
        subtotal: 928,
        shippingCost: 0,
        discountAmount: 0,
        taxAmount: 74.24,
        total: 1002.24,
        createdAt: daysAgo(5),
        items: [
          {
            id: 'oi_1',
            productId: 'prod_ps5_pro',
            name: 'PlayStation 5 Pro 2TB Console',
            sku: 'SBS-CON-001',
            variant: '2TB Standard Edition',
            qty: 1,
            price: 699,
          },
          {
            id: 'oi_2',
            productId: 'prod_novapulse_audio',
            name: 'NovaPulse Pro Wireless Headset',
            sku: 'SBS-AUD-003',
            variant: 'Graphite Matte',
            qty: 1,
            price: 229,
          },
        ],
      },
      {
        id: 'ord_seed_2',
        orderNumber: 'SBS-1042',
        userId: null,
        customerName: 'Elena Rostova',
        customerEmail: 'elena.r@studio.io',
        customerPhone: '+1 (212) 555-0194',
        shippingAddress: '118 Mercer Street, Floor 3',
        city: 'New York',
        postalCode: '10012',
        paymentMethod: 'card',
        paymentStatus: 'paid',
        paymentLast4: '8819',
        transactionRef: 'TXN-71C92E04',
        orderStatus: 'shipped',
        subtotal: 749,
        shippingCost: 0,
        discountAmount: 74.9,
        taxAmount: 53.93,
        total: 728.03,
        createdAt: daysAgo(3),
        items: [
          {
            id: 'oi_3',
            productId: 'prod_oled_27',
            name: 'ApexBlade 27" OLED 240Hz Monitor',
            sku: 'SBS-MON-002',
            variant: 'Matte Obsidian',
            qty: 1,
            price: 749,
          },
        ],
      },
      {
        id: 'ord_seed_3',
        orderNumber: 'SBS-1043',
        userId: null,
        customerName: 'Marcus Chen',
        customerEmail: 'm.chen@esports.gg',
        customerPhone: '+1 (310) 402-7721',
        shippingAddress: '4500 Wilshire Blvd',
        city: 'Los Angeles',
        postalCode: '90010',
        paymentMethod: 'wallet',
        paymentStatus: 'paid',
        paymentLast4: '9012',
        transactionRef: 'TXN-44B10D91',
        orderStatus: 'packed',
        subtotal: 318,
        shippingCost: 0,
        discountAmount: 0,
        taxAmount: 25.44,
        total: 343.44,
        createdAt: daysAgo(2),
        items: [
          {
            id: 'oi_4',
            productId: 'prod_tactile75',
            name: 'Tactile75 CNC Aluminum Keyboard',
            sku: 'SBS-PER-004',
            variant: 'Linear Magnetic Slate',
            qty: 1,
            price: 189,
          },
          {
            id: 'oi_5',
            productId: 'prod_aerolite_mouse',
            name: 'AeroLite 49g Wireless Esports Mouse',
            sku: 'SBS-PER-005',
            variant: 'Matte Black',
            qty: 1,
            price: 129,
          },
        ],
      },
      {
        id: 'ord_seed_4',
        orderNumber: 'SBS-1044',
        userId: null,
        customerName: 'Tariq Haddad',
        customerEmail: 'tariq.h@techmail.com',
        customerPhone: '+1 (646) 331-9040',
        shippingAddress: '89 Bedford Ave, Apt 2A',
        city: 'Brooklyn',
        postalCode: '11211',
        paymentMethod: 'cod',
        paymentStatus: 'pending_cod',
        paymentLast4: null,
        transactionRef: 'COD-52E81A09',
        orderStatus: 'confirmed',
        subtotal: 549,
        shippingCost: 0,
        discountAmount: 0,
        taxAmount: 43.92,
        total: 592.92,
        createdAt: daysAgo(1),
        items: [
          {
            id: 'oi_6',
            productId: 'prod_horizon_handheld',
            name: 'Horizon Pocket OLED Handheld',
            sku: 'SBS-CON-006',
            variant: '1TB OLED Matte',
            qty: 1,
            price: 549,
          },
        ],
      },
      {
        id: 'ord_seed_5',
        orderNumber: 'SBS-1045',
        userId: null,
        customerName: 'Hannah Brooks',
        customerEmail: 'hannah@brooksdesign.co',
        customerPhone: '+1 (206) 714-5182',
        shippingAddress: '2101 Westlake Ave',
        city: 'Seattle',
        postalCode: '98121',
        paymentMethod: 'card',
        paymentStatus: 'paid',
        paymentLast4: '1104',
        transactionRef: 'TXN-62D73B88',
        orderStatus: 'confirmed',
        subtotal: 899,
        shippingCost: 0,
        discountAmount: 0,
        taxAmount: 71.92,
        total: 970.92,
        createdAt: daysAgo(0),
        items: [
          {
            id: 'oi_7',
            productId: 'prod_ultrawide_34',
            name: 'StudioWave 34" Ultrawide QD-OLED',
            sku: 'SBS-MON-008',
            variant: '34" 180Hz Dark Slate',
            qty: 1,
            price: 899,
          },
        ],
      },
    ];

    for (const o of sampleOrders) {
      await insertOrder.run(
        o.id,
        o.orderNumber,
        o.userId,
        o.customerName,
        o.customerEmail,
        o.customerPhone,
        o.shippingAddress,
        o.city,
        o.postalCode,
        o.paymentMethod,
        o.paymentStatus,
        o.paymentLast4,
        o.transactionRef,
        o.orderStatus,
        o.subtotal,
        o.shippingCost,
        o.discountAmount,
        o.taxAmount,
        o.total,
        null,
        null,
        o.createdAt,
        o.createdAt
      );
      for (const item of o.items) {
        await insertItem.run(
          item.id,
          o.id,
          item.productId,
          item.name,
          item.sku,
          item.variant,
          item.qty,
          item.price,
          item.qty * item.price
        );
      }
    }

    await db.prepare(`
      INSERT INTO audit_logs (id, actor_id, actor_name, actor_role, action, target_type, target_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'aud_seed_1',
      'usr_sam_owner',
      'Sam Vance',
      'Store Owner',
      'SYSTEM_INITIALIZED',
      'store',
      'sam-brand-store',
      'Initialized Sam Brand Store catalog, payment verification, and 6 RBAC roles.',
      daysAgo(5)
    );
  }

  // Ensure existing owner & manager roles get campaigns:manage permission on upgrade
  for (const roleId of ['role_owner', 'role_manager']) {
    const row = (await db.prepare('SELECT permissions FROM roles WHERE id = ?').get(roleId)) as
      | { permissions: string }
      | undefined;
    if (row) {
      const perms = JSON.parse(row.permissions) as PermissionKey[];
      if (!perms.includes('campaigns:manage')) {
        perms.push('campaigns:manage');
        await db.prepare('UPDATE roles SET permissions = ? WHERE id = ?').run(
          JSON.stringify(perms),
          roleId
        );
      }
    }
  }

  const campaignCountRow = await db.prepare('SELECT COUNT(*) as c FROM campaigns').get();
  const campaignCount = Number(campaignCountRow?.c ?? 0);
  if (false) {
    const insertCampaign = db.prepare(`
      INSERT INTO campaigns (
        id, placement, design_theme, section_size, offer_tag, title, subtitle,
        cta_label, promo_code, target_category, desktop_image_url, mobile_image_url,
        visual_key, sort_order, active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `);

    const seedCampaigns = [
      {
        id: 'cmp_hero_1',
        placement: 'hero',
        designTheme: 'navy',
        sectionSize: 'split',
        offerTag: 'Season Launch · Save up to 15%',
        title: 'Next-Gen Consoles & 240Hz OLED Displays',
        subtitle:
          'Tournament-grade gaming hardware with 2-year official warranty and instant WhatsApp express checkout.',
        ctaLabel: 'Shop Flagship Drops',
        promoCode: 'SAM10',
        targetCategory: 'Consoles',
        visualKey: 'console-pro',
        sortOrder: 1,
      },
      {
        id: 'cmp_hero_2',
        placement: 'hero',
        designTheme: 'cobalt',
        sectionSize: 'split',
        offerTag: 'Esports Display Event',
        title: 'ApexBlade 27" QD-OLED at 240Hz',
        subtitle:
          '0.03ms response time and factory color calibration built for competitive frames.',
        ctaLabel: 'Explore Monitors',
        promoCode: 'PROSETUP',
        targetCategory: 'Monitors',
        visualKey: 'oled-monitor',
        sortOrder: 2,
      },
      {
        id: 'cmp_offer_1',
        placement: 'offer_strip',
        designTheme: 'obsidian',
        sectionSize: 'full',
        offerTag: 'Bundle Offer · Code PROSETUP',
        title: 'Save 15% + Free Express Shipping on Orders $500+',
        subtitle:
          'Pair any console, OLED display, and wireless headset for instant bundle pricing at checkout.',
        ctaLabel: 'Claim Bundle Deal',
        promoCode: 'PROSETUP',
        targetCategory: 'All',
        visualKey: 'ultrawide-monitor',
        sortOrder: 3,
      },
      {
        id: 'cmp_offer_2',
        placement: 'banner_grid',
        designTheme: 'navy',
        sectionSize: 'compact',
        offerTag: 'Pro Peripherals',
        title: 'Hall-Effect Rapid Trigger Keyboards & 49g Mice',
        subtitle: 'Precision CNC aluminum chassis and 4000Hz wireless polling.',
        ctaLabel: 'Shop Peripherals',
        promoCode: 'SAM10',
        targetCategory: 'Peripherals',
        visualKey: 'mechanical-keyboard',
        sortOrder: 4,
      },
      {
        id: 'cmp_offer_3',
        placement: 'banner_grid',
        designTheme: 'navy',
        sectionSize: 'compact',
        offerTag: 'Lossless Audio',
        title: 'Studio Mics & Spatial Wireless Headsets',
        subtitle: 'Dual-wireless 2.4GHz clarity with 44-hour hot-swappable battery.',
        ctaLabel: 'Shop Audio Gear',
        promoCode: 'SAM10',
        targetCategory: 'Audio',
        visualKey: 'wireless-headset',
        sortOrder: 5,
      },
    ];

    const seedCampaignImageMap: Record<string, string> = {
      cmp_hero_1: '/src/assets/images/hero_esports_desk.jpg',
      cmp_hero_2: '/src/assets/images/asus_curved_monitor.jpg',
      cmp_offer_1: '/src/assets/images/ultrawide_curved_pro.jpg',
      cmp_offer_2: '/src/assets/images/keyboard_cnc.jpg',
      cmp_offer_3: '/src/assets/images/headset_pro.jpg',
    };

    for (const c of seedCampaigns) {
      const img = seedCampaignImageMap[c.id] || null;
      await insertCampaign.run(
        c.id,
        c.placement,
        c.designTheme,
        c.sectionSize,
        c.offerTag,
        c.title,
        c.subtitle,
        c.ctaLabel,
        c.promoCode,
        c.targetCategory,
        img,
        img,
        c.visualKey,
        c.sortOrder,
        now,
        now
      );
    }
  }

  const activeFlash = await db
    .prepare('SELECT id FROM flash_sales WHERE active = 1 AND expires_at > ?')
    .get(now);
  if (!activeFlash) {
    const expires = new Date(Date.now() + 48 * 3600_000).toISOString();
    const existing = await db
      .prepare('SELECT id FROM flash_sales WHERE id = ?')
      .get('fs_monitors_launch');
    if (existing) {
      await db.prepare(`
        UPDATE flash_sales
        SET starts_at = ?, expires_at = ?, active = 1, updated_at = ?
        WHERE id = ?
      `).run(now, expires, now, 'fs_monitors_launch');
    } else {
      await db.prepare(`
        INSERT INTO flash_sales (
          id, title, subtitle, badge_label, target_category, discount_pct,
          design_theme, starts_at, expires_at, active, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
      `).run(
        'fs_monitors_launch',
        '6-Hour QD-OLED Display Flash Drop',
        'Automatic 15% instant markdown across all 240Hz & ultrawide gaming monitors — prices revert automatically when timer ends.',
        'FLASH SALE',
        'Monitors',
        15,
        'crimson',
        now,
        expires,
        'Maya Lin (Manager)',
        now,
        now
      );
    }
  }
}

export function mapProductRow(row: Record<string, unknown>): Product {
  const rawImageUrl = row.image_url ? String(row.image_url) : null;
  let parsedImages: string[] = [];
  try {
    const arr = JSON.parse(String(row.images || '[]'));
    if (Array.isArray(arr)) {
      parsedImages = arr.filter((u): u is string => typeof u === 'string' && u.trim().length > 0);
    }
  } catch {
    parsedImages = [];
  }
  if (rawImageUrl && !parsedImages.includes(rawImageUrl)) {
    parsedImages = [rawImageUrl, ...parsedImages];
  }
  const primaryImage = parsedImages[0] || rawImageUrl || null;

  let parsedWhatsInBox: string[] = [];
  try {
    const arr = JSON.parse(String(row.whats_in_box || '[]'));
    if (Array.isArray(arr)) {
      parsedWhatsInBox = arr.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
    }
  } catch {
    parsedWhatsInBox = [];
  }

  let parsedTags: string[] = [];
  try {
    const arr = JSON.parse(String(row.tags || '[]'));
    if (Array.isArray(arr)) {
      parsedTags = arr.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
    }
  } catch {
    parsedTags = [];
  }

  const rawCondition = String(row.condition || 'New');
  const condition: Product['condition'] =
    rawCondition === 'Refurbished' || rawCondition === 'Open Box' ? rawCondition : 'New';

  return {
    id: String(row.id),
    sku: String(row.sku),
    slug: String(row.slug),
    name: String(row.name),
    brand: String(row.brand),
    category: row.category as Product['category'],
    price: Number(row.price),
    compareAtPrice: row.compare_at_price !== null ? Number(row.compare_at_price) : null,
    costPrice:
      row.cost_price !== null && row.cost_price !== undefined ? Number(row.cost_price) : null,
    stock: Number(row.stock),
    lowStockThreshold: Number(row.low_stock_threshold),
    condition,
    warranty: row.warranty ? String(row.warranty) : '2-Year Official Sam Brand Warranty',
    weight: row.weight ? String(row.weight) : null,
    dimensions: row.dimensions ? String(row.dimensions) : null,
    whatsInBox: parsedWhatsInBox,
    tags: parsedTags,
    badge: row.badge ? String(row.badge) : null,
    tagline: String(row.tagline),
    description: String(row.description),
    specs: JSON.parse(String(row.specs || '{}')),
    variants: JSON.parse(String(row.variants || '[]')),
    visualKey: String(row.visual_key),
    imageUrl: primaryImage,
    images: parsedImages,
    featured: Boolean(row.featured),
    active: Boolean(row.active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function mapRoleRow(row: Record<string, unknown>): Role {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    description: String(row.description),
    permissions: JSON.parse(String(row.permissions || '[]')),
    maxDiscountPct: Number(row.max_discount_pct),
    maxRefundAmount: Number(row.max_refund_amount),
    isSystem: Boolean(row.is_system),
    createdAt: String(row.created_at),
  };
}

export function mapOrderRow(row: Record<string, unknown>, items: OrderItem[]): Order {
  return {
    id: String(row.id),
    orderNumber: String(row.order_number),
    userId: row.user_id ? String(row.user_id) : null,
    customerName: String(row.customer_name),
    customerEmail: String(row.customer_email),
    customerPhone: String(row.customer_phone),
    shippingAddress: String(row.shipping_address),
    city: String(row.city),
    postalCode: String(row.postal_code),
    paymentMethod: row.payment_method as Order['paymentMethod'],
    paymentStatus: row.payment_status as Order['paymentStatus'],
    paymentLast4: row.payment_last4 ? String(row.payment_last4) : null,
    transactionRef: String(row.transaction_ref),
    orderStatus: row.order_status as Order['orderStatus'],
    subtotal: Number(row.subtotal),
    shippingCost: Number(row.shipping_cost),
    discountAmount: Number(row.discount_amount),
    taxAmount: Number(row.tax_amount),
    total: Number(row.total),
    promoCode: row.promo_code ? String(row.promo_code) : null,
    notes: row.notes ? String(row.notes) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    items,
  };
}

export function mapOrderItemRow(row: Record<string, unknown>): OrderItem {
  return {
    id: String(row.id),
    orderId: String(row.order_id),
    productId: String(row.product_id),
    productName: String(row.product_name),
    sku: String(row.sku),
    variantLabel: String(row.variant_label),
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    lineTotal: Number(row.line_total),
  };
}

export function mapAuditRow(row: Record<string, unknown>): AuditLog {
  return {
    id: String(row.id),
    actorId: String(row.actor_id),
    actorName: String(row.actor_name),
    actorRole: String(row.actor_role),
    action: String(row.action),
    targetType: String(row.target_type),
    targetId: String(row.target_id),
    details: String(row.details),
    createdAt: String(row.created_at),
  };
}

export async function logAudit(
  actorId: string,
  actorName: string,
  actorRole: string,
  action: string,
  targetType: string,
  targetId: string,
  details: string
): Promise<void> {
  await db.prepare(`
    INSERT INTO audit_logs (id, actor_id, actor_name, actor_role, action, target_type, target_id, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    `aud_${crypto.randomUUID().slice(0, 12)}`,
    actorId,
    actorName,
    actorRole,
    action,
    targetType,
    targetId,
    details,
    new Date().toISOString()
  );
}

export async function getStoreSettings(): Promise<{
  whatsappNumber: string;
  storeName: string;
  logoUrl: string;
}> {
  const rows = (await db.prepare('SELECT `key`, value FROM store_settings').all()) as Array<{
    key: string;
    value: string;
  }>;
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    whatsappNumber: map.get('whatsapp_number') || '96171972495',
    storeName: map.get('store_name') || 'Sam Brand Store',
    logoUrl: map.get('logo_url') || '',
  };
}

export async function updateStoreSettings(payload: {
  whatsappNumber?: string;
  storeName?: string;
  logoUrl?: string;
} | string): Promise<{
  whatsappNumber: string;
  storeName: string;
  logoUrl: string;
}> {
  const upsert = db.prepare(
    'INSERT INTO store_settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)'
  );
  if (typeof payload === 'string') {
    const cleaned = payload.replace(/[^\d+]/g, '');
    await upsert.run('whatsapp_number', cleaned);
  } else {
    if (payload.whatsappNumber !== undefined) {
      const cleaned = payload.whatsappNumber.replace(/[^\d+]/g, '');
      await upsert.run('whatsapp_number', cleaned);
    }
    if (payload.storeName !== undefined) {
      await upsert.run('store_name', payload.storeName.trim());
    }
    if (payload.logoUrl !== undefined) {
      await upsert.run('logo_url', payload.logoUrl.trim());
    }
  }
  return await getStoreSettings();
}

export function mapCampaignRow(row: Record<string, unknown>): CampaignBanner {
  return {
    id: String(row.id),
    placement: row.placement as CampaignBanner['placement'],
    designTheme: row.design_theme as CampaignBanner['designTheme'],
    sectionSize: row.section_size as CampaignBanner['sectionSize'],
    offerTag: String(row.offer_tag),
    title: String(row.title),
    subtitle: String(row.subtitle),
    ctaLabel: String(row.cta_label),
    promoCode: row.promo_code ? String(row.promo_code) : null,
    targetCategory: String(row.target_category),
    desktopImageUrl: row.desktop_image_url ? String(row.desktop_image_url) : null,
    mobileImageUrl: row.mobile_image_url ? String(row.mobile_image_url) : null,
    visualKey: String(row.visual_key),
    sortOrder: Number(row.sort_order),
    active: Boolean(row.active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function mapFlashSaleRow(row: Record<string, unknown>): FlashSale {
  const rawTheme = String(row.design_theme || 'crimson');
  const designTheme: FlashSaleTheme =
    rawTheme === 'navy' || rawTheme === 'cobalt' || rawTheme === 'obsidian' ? rawTheme : 'crimson';
  const rawCat = String(row.target_category || 'All');
  const targetCategory: FlashSaleCategory = rawCat || 'All';

  return {
    id: String(row.id),
    title: String(row.title),
    subtitle: String(row.subtitle),
    badgeLabel: String(row.badge_label || 'FLASH SALE'),
    targetCategory,
    discountPct: Number(row.discount_pct),
    designTheme,
    startsAt: String(row.starts_at),
    expiresAt: String(row.expires_at),
    active: Boolean(row.active),
    createdBy: String(row.created_by || 'Store Admin'),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

