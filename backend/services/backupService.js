const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const util = require('util');
const execAsync = util.promisify(exec);

const BACKUP_DIR = path.join(__dirname, '../../backups/database');
const MAX_DAILY_BACKUPS = 30;
const MAX_WEEKLY_BACKUPS = 12;

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function getDbConfig() {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'db_lms'
  };
}

function generateFilename(type = 'manual') {
  const now = new Date();
  const date = now.toISOString()
    .replace(/:/g, '-')
    .replace(/\..+/, '')
    .replace('T', '_');
  return `backup_${type}_${date}.sql`;
}

async function createDatabaseBackup(type = 'manual', options = {}) {
  const { uploadToR2 = false, deleteLocalAfterR2 = false } = options;
  const db = getDbConfig();
  const filename = generateFilename(type);
  const filepath = path.join(BACKUP_DIR, filename);

  const tmpCnf = path.join(BACKUP_DIR, `.my_${Date.now()}.cnf`);

  try {
    fs.writeFileSync(tmpCnf, `[client]\npassword="${db.password}"\n`, { mode: 0o600 });

    const cmd = [
      'mysqldump',
      `--defaults-extra-file=${tmpCnf}`,
      `-h ${db.host}`,
      `-P ${db.port}`,
      `-u ${db.user}`,
      '--single-transaction',
      '--routines',
      '--triggers',
      '--add-drop-table',
      '--create-options',
      '--complete-insert',
      '--set-gtid-purged=OFF',
      db.database,
      `> "${filepath}"`
    ].join(' ');

    await execAsync(cmd, { timeout: 300000 });

    if (fs.existsSync(tmpCnf)) fs.unlinkSync(tmpCnf);

    const stats = fs.statSync(filepath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

    let r2Result = null;

    if (uploadToR2) {
      try {
        const { uploadBackupToR2 } = require('./r2Service');
        r2Result = await uploadBackupToR2(filepath, filename);
      } catch (r2Err) {
        r2Result = { success: false, error: r2Err.message };
      }
    }

    if (deleteLocalAfterR2 && r2Result && r2Result.success && fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }

    return {
      success: true,
      filename,
      filepath,
      sizeMB: parseFloat(sizeMB),
      type,
      createdAt: new Date().toISOString(),
      r2: r2Result
    };
  } catch (err) {
    if (fs.existsSync(tmpCnf)) fs.unlinkSync(tmpCnf);
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    throw new Error(`Backup failed: ${err.message}`);
  }
}

function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];

  return fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.sql'))
    .map(filename => {
      const filepath = path.join(BACKUP_DIR, filename);
      const stats = fs.statSync(filepath);
      const parts = filename.split('_');
      const type = parts[1] || 'manual';

      return {
        filename,
        filepath,
        type,
        sizeMB: parseFloat((stats.size / 1024 / 1024).toFixed(2)),
        sizeBytes: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime
      };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function getBackupFile(filename) {
  const filepath = path.join(BACKUP_DIR, filename);
  if (!filepath.startsWith(BACKUP_DIR)) {
    throw new Error('Invalid filename');
  }
  if (!fs.existsSync(filepath)) {
    throw new Error('Backup file not found');
  }
  return filepath;
}

async function deleteBackup(filename) {
  const filepath = getBackupFile(filename);
  fs.unlinkSync(filepath);
  return { success: true, filename };
}

async function cleanupOldBackups() {
  const backups = listBackups();
  const daily = backups.filter(b => b.type === 'daily' || b.type === 'manual');
  const weekly = backups.filter(b => b.type === 'weekly');
  let deleted = 0;

  if (daily.length > MAX_DAILY_BACKUPS) {
    for (const b of daily.slice(MAX_DAILY_BACKUPS)) {
      try { fs.unlinkSync(b.filepath); deleted++; } catch (_) { /* no-op */ }
    }
  }

  if (weekly.length > MAX_WEEKLY_BACKUPS) {
    for (const b of weekly.slice(MAX_WEEKLY_BACKUPS)) {
      try { fs.unlinkSync(b.filepath); deleted++; } catch (_) { /* no-op */ }
    }
  }

  return { deleted };
}

function getBackupStats() {
  const backups = listBackups();
  const totalSize = backups.reduce((sum, b) => sum + b.sizeBytes, 0);

  return {
    total: backups.length,
    totalSizeMB: parseFloat((totalSize / 1024 / 1024).toFixed(2)),
    latest: backups[0] || null,
    oldest: backups[backups.length - 1] || null,
    byType: {
      daily: backups.filter(b => b.type === 'daily').length,
      weekly: backups.filter(b => b.type === 'weekly').length,
      manual: backups.filter(b => b.type === 'manual').length
    }
  };
}

module.exports = {
  createDatabaseBackup,
  listBackups,
  getBackupFile,
  deleteBackup,
  cleanupOldBackups,
  getBackupStats,
  BACKUP_DIR
};
