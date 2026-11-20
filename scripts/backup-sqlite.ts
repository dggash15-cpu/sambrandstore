/**
 * SQLite Database Backup Script
 * 
 * Creates a timestamped copy of the SQLite database file and
 * automatically removes backups older than 30 days.
 *
 * Usage:
 *   npx tsx scripts/backup-sqlite.ts
 *
 * Schedule on Hostinger via Cron Jobs:
 *   0 3 * * *  cd /home/username/sam-brand-store && npx tsx scripts/backup-sqlite.ts
 */

import fs from 'node:fs';
import path from 'node:path';

const DB_PATH = process.env.DB_PATH || path.join('data', 'sam_brand_store.db');
const resolvedDb = path.isAbsolute(DB_PATH)
  ? DB_PATH
  : path.resolve(process.cwd(), DB_PATH);

if (!fs.existsSync(resolvedDb)) {
  console.error(`❌ Database not found at: ${resolvedDb}`);
  process.exit(1);
}

const backupDir = path.resolve(process.cwd(), 'backups');
fs.mkdirSync(backupDir, { recursive: true });

const timestamp = new Date()
  .toISOString()
  .replace(/[:.]/g, '-')
  .replace('T', '_')
  .slice(0, 19);

const dest = path.join(backupDir, `backup-${timestamp}.db`);
fs.copyFileSync(resolvedDb, dest);

const sizeMB = (fs.statSync(dest).size / (1024 * 1024)).toFixed(2);
console.log(`✅ Backup created: ${dest} (${sizeMB} MB)`);

// Also copy WAL and SHM files if they exist (for WAL mode databases)
for (const suffix of ['-wal', '-shm']) {
  const walPath = resolvedDb + suffix;
  if (fs.existsSync(walPath)) {
    fs.copyFileSync(walPath, dest + suffix);
    console.log(`   Copied ${suffix} file`);
  }
}

// Cleanup: remove backups older than 30 days
const RETENTION_DAYS = 30;
const cutoffMs = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
let removed = 0;

for (const file of fs.readdirSync(backupDir)) {
  if (!file.startsWith('backup-') || !file.endsWith('.db')) continue;
  const fp = path.join(backupDir, file);
  const stats = fs.statSync(fp);
  if (stats.mtimeMs < cutoffMs) {
    fs.unlinkSync(fp);
    // Also remove associated WAL/SHM files
    for (const suffix of ['-wal', '-shm']) {
      const assoc = fp + suffix;
      if (fs.existsSync(assoc)) fs.unlinkSync(assoc);
    }
    removed++;
  }
}

if (removed > 0) {
  console.log(`🗑️  Removed ${removed} backup(s) older than ${RETENTION_DAYS} days`);
}

console.log('Done.');
