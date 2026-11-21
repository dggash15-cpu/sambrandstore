# Sam Brand Store 🛍️

A full-stack, production-ready e-commerce storefront and admin platform for **Sam Brand Store** — selling gaming consoles, monitors, audio gear, and peripherals.

> **E2E Test Status:** 🟢 28/28 PASSING — ZERO DEFECTS  
> **Build Status:** ✅ 0 errors · 0 warnings

---

## ✨ Features

### Storefront
- **Product catalog** with category navigation, live search, and sort/filter
- **Product detail modals** with image gallery, specs, reviews, and stock alerts
- **Flash Sale banners** with real-time countdown timers
- **Campaign hero sections** with dynamic marketing banners
- **Shopping cart** with quantity controls and promo code support
- **Checkout flow** (WhatsApp COD, card, bank transfer)
- **Order tracking** by order number + email
- **Favorites / Wishlist** with shareable URL
- **Side-by-side product compare** (up to 3 products)
- **Customer reviews** with star ratings and helpful votes
- **Restock notification** waitlist (email alerts)
- **WhatsApp floating chat** button

### Internationalisation (i18n & Full Arabic Coverage)
- **English ↔ Arabic** language toggle via Globe icon in Navbar
- **Full Storefront Translation**: All sections, modals, drawers, and forms (`Navbar`, `HeroSection`, `CategoryStrip`, `FlashSaleBanner`, `CatalogSection`, `ProductDetailModal`, `FavoritesDrawer`, `OrderTrackerModal`, `ProductCompareModal`, `CartCheckoutDrawer`, and `Footer`)
- **Checkout & Invoice Flow in Arabic**: Form fields, placeholders, payment methods (Card, Digital Wallet, Cash on Delivery), order preparation stages, invoice receipt sheet, and WhatsApp actions
- Full **RTL layout** support — `<html dir="rtl">` flips automatically with mirrored typography, icons, and carousels
- **Cairo Arabic font** loaded for authentic Arabic readability
- Mobile drawer spring animation adapts direction (LTR/RTL)

### Admin Dashboard (Role-Based Access)
- **Overview** — KPIs, revenue charts, inventory health, top products
- **Analytics** — 7d / 30d / 90d / 12m sales trends, category mix, SKU turnover
- **Campaigns** — Create / edit / delete hero banners and promotional sections
- **Flash Sales** — Timed discount sales with theme customisation
- **Catalog** — Full product CRUD with multi-image gallery upload
- **Orders** — Status management (confirmed → packed → shipped → delivered), refunds
- **RBAC** — Role and staff management with granular permissions
- **Audit Log** — Full activity trail for all admin actions
- **Store Branding** — Upload logo and change store name without touching code
- **WhatsApp number** management

### Staff Logout (All Surfaces)
| Surface | Location |
|---------|----------|
| Admin sidebar (desktop) | Bottom of sidebar → `Sign Out` |
| Admin user card (mobile) | Staff card → red `Sign Out` pill |
| Storefront Navbar (desktop) | Staff pill → `Sign Out` button |
| Storefront mobile drawer | Drawer bottom → `Sign Out` button |

### Security
- JWT + cookie session auth with brute-force rate limiting; password reset requests are limited to 5 per IP per hour
- Staff password reset codes are HMAC-hashed in MariaDB, expire after 15 minutes, and are emailed through configured SMTP
- RBAC permission boundaries enforced at API layer (403 on violations)
- Security headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`
- Proxy trust configured for Hostinger reverse proxy (SSL cookies)
- MySQL connection pool closes on `SIGTERM` / `SIGINT`

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Tailwind CSS v4, Vite 8 |
| Animations | Motion (Framer Motion v12) |
| Charts | Recharts |
| Icons | Lucide React |
| Backend | Express 4, TypeScript, Node.js 20+, Nodemailer |
| Database | MariaDB/MySQL (`mysql2`) |
| Bundler | Vite (client) + esbuild (server) |
| Fonts | Outfit (UI), Cairo (Arabic) |

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- **Node.js 20+** (or 22 LTS)
- **npm 10+**

### 1. Clone & install
```bash
git clone <your-repo-url>
cd sam-brand-store
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
NODE_ENV=development
PORT=3000
SESSION_SECRET=your-32-char-random-secret-here
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=your_database_user
DB_NAME=your_database_name
DB_PASSWORD=your_database_password
STORE_WHATSAPP_NUMBER=96171972495
```

Use a dedicated local development database. The application creates its schema on startup.
The legacy SQLite file, if present, is not read, imported, or deleted by the app.

### 3. Run development server
```bash
npm run dev
```

The app will be available at **http://localhost:3000**

> Development runs seed sample catalog data and staff accounts. Production does not seed sample orders or reviews.

---

## 🔑 Admin Access

Navigate to **`/sbs-admin`** or press **`Alt + Shift + A`** anywhere on the site.

In production, the initial owner account is created from the `ADMIN_EMAIL` and
`ADMIN_PASSWORD` environment variables. Set a unique password of at least 16 characters
in Hostinger before the first launch. Production does not create the development-only
staff accounts; add staff from the admin dashboard after signing in.

---

## 🏗️ Build for Production

```bash
npm run build
```

This runs:
1. `vite build` — compiles React app into `dist/` with code-splitting
2. `npm run build:server` — bundles `server.ts` via esbuild into `dist/server.js`

### Start production server
```bash
npm start
```

---

## 🧪 End-to-End Test Suite

```bash
npm run test:e2e
```

The suite requires an isolated MySQL database. Set `TEST_DB_HOST`, `TEST_DB_PORT`,
`TEST_DB_USER`, `TEST_DB_PASSWORD`, and `TEST_DB_NAME` (the database name must end in
`_test` or `_e2e`). It refuses to use the normal `DB_*` settings. It writes test data,
including an order, only to that dedicated test database.

---

## 💾 Database Backup

Use Hostinger's database backup/export tools in hPanel or phpMyAdmin before schema
changes or data cleanup. The former SQLite backup script has been removed because the
application now uses MariaDB/MySQL.

---

## 📁 Project Structure

```
sam-brand-store/
├── src/                        # React frontend
│   ├── components/
│   │   ├── AdminDashboard.tsx  # Full admin workspace (8 tabs)
│   │   ├── Navbar.tsx          # Header + search + language toggle + staff bar
│   │   ├── Footer.tsx          # Footer with dynamic branding
│   │   ├── HeroSection.tsx     # Campaign hero banners
│   │   ├── CatalogSection.tsx  # Product grid with search/filter
│   │   ├── CategoryStrip.tsx   # Category quick-nav
│   │   ├── BrandLogo.tsx       # Dynamic logo (upload or SVG fallback)
│   │   ├── AuthModal.tsx       # Login / password reset
│   │   ├── CartCheckoutDrawer.tsx
│   │   ├── FavoritesDrawer.tsx
│   │   ├── ProductDetailModal.tsx
│   │   ├── ProductCompareModal.tsx
│   │   ├── FlashSaleBanner.tsx
│   │   └── OrderTrackerModal.tsx
│   ├── lib/
│   │   ├── api.ts              # Typed fetch client for all API endpoints
│   │   ├── i18n.tsx            # i18n provider (EN/AR + RTL)
│   │   └── visitorHistory.ts   # LocalStorage visitor session tracking
│   ├── types.ts                # Shared TypeScript type definitions
│   └── main.tsx                # React entry point
├── server/
│   └── db.ts                   # MariaDB schema, seed data, query helpers
├── server.ts                   # Express API server (all routes)
├── data/
│   └── sam_brand_store.db      # Legacy SQLite data, not used by the app
├── uploads/                    # Uploaded product/logo images
├── dist/                       # Production build output
├── test-e2e.ts                 # End-to-end test suite (isolated test DB only)
├── DEPLOYMENT_GUIDE.md         # Hostinger deployment instructions
├── .env.example                # Environment variable template
└── package.json
```

---

## 🌐 API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/health` | — | Health check |
| `GET` | `/api/settings/public` | — | Store name, logo, WhatsApp |
| `GET` | `/api/products` | — | All active products (filterable) |
| `GET` | `/api/products/:slug` | — | Single product by slug |
| `GET` | `/api/campaigns` | — | Active campaign banners |
| `GET` | `/api/flash-sales` | — | Active flash sales |
| `POST` | `/api/orders` | — | Place a guest order |
| `POST` | `/api/orders/track` | — | Track order by number + email |
| `POST` | `/api/products/:id/reviews` | — | Submit customer review |
| `POST` | `/api/products/:id/notify` | — | Restock alert subscription |
| `POST` | `/api/auth/login` | — | Staff login |
| `POST` | `/api/auth/logout` | Staff | Sign out |
| `GET` | `/api/auth/me` | Staff | Current session |
| `GET` | `/api/admin/overview` | `analytics:read` | Dashboard KPIs |
| `GET` | `/api/admin/analytics` | `analytics:read` | Revenue trends |
| `GET` | `/api/admin/products` | `products:read` | All products (admin) |
| `POST` | `/api/admin/products` | `products:write` | Create product |
| `PATCH` | `/api/admin/products/:id` | `products:write` | Update product |
| `DELETE` | `/api/admin/products/:id` | `products:write` | Delete product |
| `GET` | `/api/admin/orders` | `orders:read` | All orders |
| `PATCH` | `/api/admin/orders/:id/status` | `orders:write` | Update order status |
| `GET` | `/api/admin/campaigns` | `campaigns:manage` | All campaigns |
| `POST` | `/api/admin/upload` | `products:write` | Upload image |
| `PATCH` | `/api/admin/settings` | `settings:manage` | Update store settings |
| `GET` | `/api/admin/staff` | `staff:read` | Staff list |
| `GET` | `/api/admin/audit-logs` | `audit:read` | Audit trail |

---

## 🚢 Deploy to Hostinger

See [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md) for the complete step-by-step guide.

**Quick summary:**
1. Upload project files via Git or FTP to Hostinger
2. Set Node.js version to **20.x** or **22.x** in hPanel
3. Set startup file to `dist/server.js`
4. Configure environment variables (especially `SESSION_SECRET`)
5. Run `npm ci && npm run build`
6. Click **Start** in hPanel
7. Verify database backups are enabled in Hostinger hPanel.

---

## 🔒 Security Notes

- All admin routes require a valid session token and RBAC permission check
- Login endpoint rate-limited: **429** after ~14 failed attempts, **15-minute** cooldown
- Password hashing uses Node.js `crypto.scryptSync` with a unique salt
- Never commit `.env` to version control — use `.env.example` as the template
- Keep database credentials in Hostinger environment variables and never commit them
- The legacy SQLite file is not connected to the application; do not delete it until reviewed and backed up

---

## 📄 License

Private — Sam Brand Store. All rights reserved.
