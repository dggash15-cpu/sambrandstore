# 🚀 Hostinger Node.js Production Deployment Guide

Sam Brand Store is built with **Express 4**, **Vite**, **TypeScript**, and **MariaDB/MySQL**.

---

## 📋 1. Hostinger Prerequisites & Configuration

In your Hostinger hPanel:
1. Navigate to **Websites** ➔ **Manage** ➔ **Node.js**.
2. Set up your Node.js application:
   - **Node.js version**: `20.x` or `22.x` (LTS recommended).
   - **Application Mode / Environment**: `production`
   - **Application root**: `sam-brand-store` (or your chosen repository directory).
   - **Build script**: `build`
   - **Application startup file**: `dist/server.js`

---

## ⚙️ 2. Environment Variables

In **hPanel** ➔ **Node.js** ➔ **Environment variables**, set the following:

| Variable | Recommended Value | Notes |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production optimizations, static caching, and security headers |
| `PORT` | `3000` | (Or leave empty if Hostinger sets this automatically) |
| `APP_URL` | `https://your-domain.com` | Your live website domain |
| `SESSION_SECRET` | *32+ random characters* | Example: `openssl rand -hex 32` |
| `ADMIN_EMAIL` | *your owner email* | Used for the first production owner account |
| `ADMIN_PASSWORD` | *unique password, 16+ characters* | Required to initialize a fresh production database |
| `DB_HOST` | Hostinger database host | Use the host shown in hPanel; do not guess between `127.0.0.1` and the assigned hostname |
| `DB_PORT` | `3306` | MariaDB/MySQL port |
| `DB_USER` | Hostinger database username | Use the assigned database user |
| `DB_NAME` | Hostinger database name | Use the assigned database name |
| `DB_PASSWORD` | *database password* | Set only in hPanel; never commit or paste into chat |
| `SMTP_HOST` | `smtp.hostinger.com` | Hostinger SMTP server |
| `SMTP_PORT` | `465` | Use the port for the selected TLS mode |
| `SMTP_SECURE` | `true` | Use `true` for implicit TLS on port 465 |
| `SMTP_USER` | *full mailbox address* | Must be an existing mailbox with SMTP access |
| `SMTP_PASS` | *mailbox password* | Must match `SMTP_USER`; set only in hPanel |
| `MAIL_FROM` | *full mailbox address* | Use the authenticated mailbox address |
| `STORE_WHATSAPP_NUMBER` | `96171972495` | International format without `+` |
| `GEMINI_API_KEY` | *(Optional)* | For AI features |

Set a unique `ADMIN_EMAIL` and `ADMIN_PASSWORD` in Hostinger before the first launch.
Configure all six SMTP variables with a real Hostinger mailbox before enabling staff
password resets. Reset codes are stored only as HMAC hashes, expire after 15 minutes,
and are never returned by the API or written to application logs. If email delivery
fails, the reset code is invalidated and the API returns an error.
The app creates its MySQL tables on startup. It does not import the old SQLite file or
seed demo orders/reviews in production; the old file is left untouched. Do not delete it
until its data has been reviewed and separately backed up.

The checkout currently accepts **cash on delivery only**. Card and wallet checkout remain
disabled until a real payment processor and its verified webhook flow are configured.

---

## 🛠️ 3. Build & Deployment Commands

### If using Hostinger Git Integration (Auto-Deploy on Push):
1. In hPanel, go to **Advanced** ➔ **Git**.
2. Connect your GitHub repository (`main` or `master` branch).
3. Under **Deployment / Post-receive Commands** or via SSH in the app directory, execute:

```bash
# 1. Install dependencies
npm ci

# 2. Compile frontend and backend bundle
npm run build

# 3. Restart the Node.js application
# (Via hPanel "Restart" button or CLI)
npm start
```

### What `npm run build` does:
- `vite build`: Compiles the client React application with code-splitting (`vendor-react`, `vendor-motion`, `vendor-charts`, and lazy-loaded `AdminDashboard`) into `dist/`.
- `npm run build:server`: Bundles `server.ts` via `esbuild` into ESM `dist/server.js`, keeping Express, `mysql2`, Nodemailer, and Vite as runtime dependencies.

Before cutover, enable Hostinger database backups or export the database from hPanel/phpMyAdmin.
Keep an independent backup before performing any manual data cleanup.

---

## 🛡️ 5. Security & Verification Checklist

- [x] **Rate Limiting**: Brute-force protection enabled on `/api/auth/login` (15 attempts / 15 mins).
- [x] **Password Reset**: SMTP delivery, hashed single-use codes, 15-minute expiry, and a 5-request/IP/hour limit.
- [x] **Proxy Trust**: `app.set('trust proxy', 1)` configured for Hostinger reverse proxies and SSL cookies.
- [x] **Security Headers**: `nosniff`, `SAMEORIGIN`, `strict-origin-when-cross-origin` enabled.
- [x] **Graceful Shutdown**: MySQL connection pool closes on `SIGTERM` / `SIGINT`.
- [ ] **E2E Test Suite**: Run only against a dedicated MySQL database whose name ends in `_test` or `_e2e`.

### Post-Deployment Smoke Test:
Run these curl commands against your live domain:
```bash
# Health check:
curl https://your-domain.com/api/health

# Catalog check:
curl https://your-domain.com/api/products

# Settings check:
curl https://your-domain.com/api/settings/public
```

---

## 🔑 5. Staff & Admin Accounts

The first production owner account is created from `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
Create additional staff from the admin dashboard after signing in. Development-only sample
accounts are never seeded in production.

> 🔒 **Accessing the Portal**: Navigate to `/sbs-admin` or press **Alt + Shift + A** anywhere on the site. Use the **"Sign Out"** button (bottom of the sidebar on desktop, or the red Sign Out button in the mobile navigation drawer) to end your session. When browsing the storefront as a logged-in staff member, a compact **staff pill** appears in the top navigation bar with a direct **Admin** link and **Sign Out** button.
