const cron = require('node-cron');
const fs = require('fs');
const { createDatabaseBackup, cleanupOldBackups } = require('../services/backupService');
const pool = require('../config/db');
const redis = require('../config/redis');

const LOCK_TTL = 600; // 10 minutes

async function logBackupEvent(type, status, details) {
  try {
    await pool.execute(
      `INSERT INTO backup_logs
       (backup_type, status, filename, size_mb, error_message, r2_uploaded, r2_uploaded_at, r2_upload_error, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        type,
        status,
        details.filename || null,
        details.sizeMB || null,
        details.error || null,
        details.r2Uploaded ? 1 : 0,
        details.r2UploadedAt || null,
        details.r2UploadError || null
      ]
    );
  } catch (_) { /* silent — never crash on log failure */ }
}

async function getR2Settings() {
  try {
    const [rows] = await pool.execute(
      'SELECT r2_enabled, r2_auto_upload, r2_delete_local_after_upload FROM backup_settings WHERE id = 1'
    );
    return rows[0] || {};
  } catch (_) {
    return {};
  }
}

async function acquireLock(key) {
  try {
    const result = await redis.set(key, '1', 'EX', LOCK_TTL, 'NX');
    return result === 'OK';
  } catch (_) {
    return true;
  }
}

async function releaseLock(key) {
  try { await redis.del(key); } catch (_) { /* no-op */ }
}

async function runDailyBackup() {
  const lockKey = 'backup:cron:daily';
  if (!(await acquireLock(lockKey))) return;

  try {
    const r2Settings = await getR2Settings();
    const shouldUploadR2 = !!(r2Settings.r2_enabled && r2Settings.r2_auto_upload);
    const deleteLocal = !!(r2Settings.r2_delete_local_after_upload);

    const result = await createDatabaseBackup('daily', {
      uploadToR2: shouldUploadR2,
      deleteLocalAfterR2: deleteLocal
    });

    await logBackupEvent('daily', 'success', {
      filename: result.filename,
      sizeMB: result.sizeMB,
      r2Uploaded: result.r2 && result.r2.success,
      r2UploadedAt: result.r2 && result.r2.success ? result.r2.uploadedAt : null,
      r2UploadError: result.r2 && !result.r2.success ? result.r2.error : null
    });

    await cleanupOldBackups();
  } catch (err) {
    await logBackupEvent('daily', 'failed', { error: err.message });
  } finally {
    await releaseLock(lockKey);
  }
}

async function runWeeklyBackup() {
  const lockKey = 'backup:cron:weekly';
  if (!(await acquireLock(lockKey))) return;

  try {
    const r2Settings = await getR2Settings();
    const shouldUploadR2 = !!(r2Settings.r2_enabled && r2Settings.r2_auto_upload);
    const deleteLocal = !!(r2Settings.r2_delete_local_after_upload);

    const result = await createDatabaseBackup('weekly', {
      uploadToR2: shouldUploadR2,
      deleteLocalAfterR2: deleteLocal
    });

    await logBackupEvent('weekly', 'success', {
      filename: result.filename,
      sizeMB: result.sizeMB,
      r2Uploaded: result.r2 && result.r2.success,
      r2UploadedAt: result.r2 && result.r2.success ? result.r2.uploadedAt : null,
      r2UploadError: result.r2 && !result.r2.success ? result.r2.error : null
    });
  } catch (err) {
    await logBackupEvent('weekly', 'failed', { error: err.message });
  } finally {
    await releaseLock(lockKey);
  }
}

function registerDatabaseBackup() {
  cron.schedule('0 2 * * *', runDailyBackup, { timezone: 'Europe/London' });
  cron.schedule('0 3 * * 0', runWeeklyBackup, { timezone: 'Europe/London' });
  console.log('✅ [DatabaseBackup] Cron jobs registered (daily 02:00, weekly Sun 03:00 Europe/London)');
}

module.exports = { registerDatabaseBackup, runDailyBackup, runWeeklyBackup };
