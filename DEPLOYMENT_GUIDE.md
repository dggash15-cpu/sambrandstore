# 🚀 Hostinger Node.js Production Deployment Guide

Sam Brand Store is built with **Express 5**, **Vite**, **TypeScript**, and **SQLite (better-sqlite3)**. Follow this guide to deploy to Hostinger with **0 errors and maximum performance**.

---

## 📋 1. Hostinger Prerequisites & Configuration

In your Hostinger hPanel:
1. Navigate to **Websites** ➔ **Manage** ➔ **Node.js**.
2. Set up your Node.js application:
   - **Node.js version**: `20.x` or `22.x` (LTS recommended).
   - **Application Mode / Environment**: `production`
   - **Application root**: `sam-brand-store` (or your chosen repository directory).
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
| `DB_PATH` | `./data/sam_brand_store.db` | SQLite database location |
| `STORE_WHATSAPP_NUMBER` | `96171972495` | International format without `+` |
| `GEMINI_API_KEY` | *(Optional)* | For AI features |

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
- `npm run build:server`: Bundles `server.ts` via `esbuild` into standalone ESM `dist/server.js`, externalizing `better-sqlite3` and `vite`.

---

## 💾 4. Automated SQLite Daily Backups

The project includes an automated backup and retention script at `scripts/backup-sqlite.ts`.

### Test Local Backup:
```bash
npm run backup
```
- Creates timestamped copies in `./backups/backup-YYYY-MM-DD_HH-mm-ss.db`.
- Copies SQLite `-wal` and `-shm` files to prevent write-ahead journal loss.
- Automatically purges backups older than **30 days**.

### Setup Cron Job on Hostinger:
1. In hPanel, navigate to **Advanced** ➔ **Cron Jobs**.
2. Add a new cron job:
   - **Type**: Custom
   - **Timing**: Daily at 03:00 AM (`0 3 * * *`)
   - **Command**:
     ```bash
     cd /home/YOUR_USERNAME/sam-brand-store && /usr/bin/node -e "require('child_process').execSync('npm run backup', {stdio: 'inherit'})"
     ```
     *(Or via `npm run backup` directly if node/npm are in your path)*

---

## 🛡️ 5. Security & Verification Checklist

- [x] **Rate Limiting**: Brute-force protection enabled on `/api/auth/login` (12 attempts / 15 mins).
- [x] **Proxy Trust**: `app.set('trust proxy', 1)` configured for Hostinger reverse proxies and SSL cookies.
- [x] **Security Headers**: `nosniff`, `SAMEORIGIN`, `strict-origin-when-cross-origin` enabled.
- [x] **Graceful Shutdown**: WAL checkpoints run on `SIGTERM` / `SIGINT` to protect database integrity.
- [x] **E2E Test Suite**: 28 automated checks passing with 0 errors.

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

## 🔑 6. Staff & Admin Credentials

| Account | Role | Email | Scope |
| :--- | :--- | :--- | :--- |
| **Sam Vance** | Store Owner (Full Access) | `sam@sambrandstore.com` | `all` |
| **Maya Lin** | Operations Manager | `maya.ops@sambrandstore.com` | `all` |
| **Alex Rivera** | Inventory Specialist | `alex.stock@sambrandstore.com` | `Monitors,Peripherals` |
| **Liam Patel** | Fulfillment Specialist | `liam.ship@sambrandstore.com` | `all` |

> 🔒 **Accessing the Portal**: Navigate to `/sbs-admin` or press **Alt + Shift + A** anywhere on the site. Use the **"Sign Out"** button (bottom of the sidebar on desktop, or the red Sign Out button in the mobile navigation drawer) to end your session. When browsing the storefront as a logged-in staff member, a compact **staff pill** appears in the top navigation bar with a direct **Admin** link and **Sign Out** button.
