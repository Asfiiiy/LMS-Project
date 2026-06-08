const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const redis = require('../config/redis');
const auth = require('../middleware/auth');
const { permit } = require('../middleware/roles');
const {
  createDatabaseBackup,
  listBackups,
  getBackupFile,
  deleteBackup,
  getBackupStats,
  cleanupOldBackups
} = require('../services/backupService');
const {
  uploadBackupToR2,
  deleteFromR2,
  listR2Backups,
  downloadFromR2,
  checkR2FileExists,
  testR2Connection,
  isR2Configured
} = require('../services/r2Service');

router.use(auth);
router.use(permit('Admin'));

const BACKUP_LOCK_KEY = 'backup:running';

function validateFilename(filename) {
  return filename &&
    filename.endsWith('.sql') &&
    !filename.includes('..') &&
    !filename.includes('/') &&
    !filename.includes('\\');
}

// GET /api/backup/status
router.get('/status', async (req, res) => {
  try {
    const stats = getBackupStats();

    const [logs] = await pool.execute(
      `SELECT bl.*, u.name as triggered_by_name
       FROM backup_logs bl
       LEFT JOIN users u ON u.id = bl.triggered_by
       ORDER BY bl.created_at DESC
       LIMIT 10`
    );

    const [settingsRows] = await pool.execute(
      'SELECT * FROM backup_settings WHERE id = 1'
    );

    let isRunning = false;
    try { isRunning = !!(await redis.get(BACKUP_LOCK_KEY)); } catch (_) { /* no-op */ }

    let r2Status = { configured: isR2Configured(), connected: false, fileCount: 0, totalSizeMB: 0 };
    if (r2Status.configured) {
      try {
        const r2Files = await listR2Backups();
        r2Status.connected = true;
        r2Status.fileCount = r2Files.length;
        r2Status.totalSizeMB = parseFloat(r2Files.reduce((sum, f) => sum + f.sizeMB, 0).toFixed(2));
      } catch (_) {
        r2Status.connected = false;
      }
    }

    res.json({
      success: true,
      stats,
      logs,
      settings: settingsRows[0] || null,
      isRunning,
      r2Status
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching backup status', error: err.message });
  }
});

// GET /api/backup/list
router.get('/list', async (req, res) => {
  try {
    const backups = listBackups();
    res.json({ success: true, backups, total: backups.length });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error listing backups', error: err.message });
  }
});

// POST /api/backup/create
router.post('/create', async (req, res) => {
  try {
    let isRunning = false;
    try { isRunning = !!(await redis.get(BACKUP_LOCK_KEY)); } catch (_) { /* no-op */ }

    if (isRunning) {
      return res.status(409).json({ success: false, message: 'A backup is already in progress' });
    }

    try { await redis.setex(BACKUP_LOCK_KEY, 600, '1'); } catch (_) { /* no-op */ }

    const [logInsert] = await pool.execute(
      `INSERT INTO backup_logs (backup_type, status, triggered_by, created_at)
       VALUES ('manual', 'running', ?, NOW())`,
      [req.user.id]
    );
    const logId = logInsert.insertId;

    try {
      const [settingsRows] = await pool.execute(
        'SELECT r2_enabled, r2_auto_upload, r2_delete_local_after_upload FROM backup_settings WHERE id = 1'
      );
      const s = settingsRows[0] || {};
      const shouldUploadR2 = !!(s.r2_enabled && s.r2_auto_upload);
      const deleteLocal = !!(s.r2_delete_local_after_upload);

      const result = await createDatabaseBackup('manual', {
        uploadToR2: shouldUploadR2,
        deleteLocalAfterR2: deleteLocal
      });

      const r2Uploaded = result.r2 && result.r2.success ? 1 : 0;
      const r2UploadedAt = result.r2 && result.r2.success ? new Date() : null;
      const r2UploadError = result.r2 && !result.r2.success ? result.r2.error : null;

      await pool.execute(
        `UPDATE backup_logs SET status = 'success', filename = ?, size_mb = ?,
         r2_uploaded = ?, r2_uploaded_at = ?, r2_upload_error = ?
         WHERE id = ?`,
        [result.filename, result.sizeMB, r2Uploaded, r2UploadedAt, r2UploadError, logId]
      );

      try { await redis.del(BACKUP_LOCK_KEY); } catch (_) { /* no-op */ }

      res.json({ success: true, message: 'Backup created successfully', backup: result });
    } catch (err) {
      await pool.execute(
        `UPDATE backup_logs SET status = 'failed', error_message = ? WHERE id = ?`,
        [err.message, logId]
      );
      try { await redis.del(BACKUP_LOCK_KEY); } catch (_) { /* no-op */ }
      res.status(500).json({ success: false, message: err.message });
    }
  } catch (err) {
    try { await redis.del(BACKUP_LOCK_KEY); } catch (_) { /* no-op */ }
    res.status(500).json({ success: false, message: 'Error creating backup', error: err.message });
  }
});

// GET /api/backup/download/:filename
router.get('/download/:filename', async (req, res) => {
  const { filename } = req.params;

  if (!validateFilename(filename)) {
    return res.status(400).json({ success: false, message: 'Invalid filename' });
  }

  try {
    const filepath = getBackupFile(filename);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.download(filepath, filename);
  } catch (err) {
    res.status(404).json({ success: false, message: 'Backup file not found' });
  }
});

// DELETE /api/backup/:filename  (local delete)
router.delete('/:filename', async (req, res) => {
  const { filename } = req.params;

  if (!validateFilename(filename)) {
    return res.status(400).json({ success: false, message: 'Invalid filename' });
  }

  try {
    const backups = listBackups();
    if (backups.length <= 1) {
      return res.status(400).json({ success: false, message: 'Cannot delete the only remaining backup' });
    }

    await deleteBackup(filename);

    try {
      await pool.execute(
        `UPDATE backup_logs SET status = 'deleted' WHERE filename = ?`,
        [filename]
      );
    } catch (_) { /* non-critical */ }

    res.json({ success: true, message: 'Backup deleted' });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
});

// GET /api/backup/logs
router.get('/logs', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const [countResult] = await pool.execute('SELECT COUNT(*) as total FROM backup_logs');
    const total = countResult[0].total;

    const [logs] = await pool.execute(
      `SELECT bl.*, u.name as triggered_by_name
       FROM backup_logs bl
       LEFT JOIN users u ON u.id = bl.triggered_by
       ORDER BY bl.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`
    );

    res.json({ success: true, logs, total, page, limit });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching backup logs', error: err.message });
  }
});

// GET /api/backup/settings
router.get('/settings', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM backup_settings WHERE id = 1');
    res.json({ success: true, settings: rows[0] || null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/backup/settings
router.put('/settings', async (req, res) => {
  try {
    const {
      daily_enabled, weekly_enabled, max_daily_backups, max_weekly_backups,
      notify_admin_email, r2_enabled, r2_auto_upload, r2_delete_local_after_upload
    } = req.body;

    await pool.execute(
      `UPDATE backup_settings
       SET daily_enabled = ?,
           weekly_enabled = ?,
           max_daily_backups = ?,
           max_weekly_backups = ?,
           notify_admin_email = ?,
           r2_enabled = ?,
           r2_auto_upload = ?,
           r2_delete_local_after_upload = ?
       WHERE id = 1`,
      [
        daily_enabled ? 1 : 0,
        weekly_enabled ? 1 : 0,
        Math.max(1, parseInt(max_daily_backups) || 30),
        Math.max(1, parseInt(max_weekly_backups) || 12),
        notify_admin_email ? 1 : 0,
        r2_enabled ? 1 : 0,
        r2_auto_upload ? 1 : 0,
        r2_delete_local_after_upload ? 1 : 0
      ]
    );

    res.json({ success: true, message: 'Settings updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error updating settings', error: err.message });
  }
});

// =====================================================
// CLOUDFLARE R2 ENDPOINTS
// =====================================================

// GET /api/backup/r2/test
router.get('/r2/test', async (req, res) => {
  try {
    if (!isR2Configured()) {
      return res.json({ success: false, message: 'R2 credentials not configured in .env' });
    }
    const result = await testR2Connection();
    res.json(result);
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// GET /api/backup/r2/list
router.get('/r2/list', async (req, res) => {
  try {
    if (!isR2Configured()) {
      return res.json({ success: true, backups: [], total: 0, message: 'R2 not configured' });
    }
    const backups = await listR2Backups();
    res.json({ success: true, backups, total: backups.length });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error listing R2 backups', error: err.message });
  }
});

// POST /api/backup/r2/upload/:filename
router.post('/r2/upload/:filename', async (req, res) => {
  const { filename } = req.params;

  if (!validateFilename(filename)) {
    return res.status(400).json({ success: false, message: 'Invalid filename' });
  }

  try {
    const filepath = getBackupFile(filename);
    const result = await uploadBackupToR2(filepath, filename);

    try {
      await pool.execute(
        `UPDATE backup_logs SET r2_uploaded = 1, r2_uploaded_at = NOW(), r2_upload_error = NULL WHERE filename = ?`,
        [filename]
      );
    } catch (_) { /* non-critical */ }

    res.json({ success: true, message: 'Uploaded to R2 successfully', r2: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/backup/r2/upload-all
router.post('/r2/upload-all', async (req, res) => {
  try {
    if (!isR2Configured()) {
      return res.status(400).json({ success: false, message: 'R2 not configured' });
    }

    const localBackups = listBackups();
    const results = [];

    for (const backup of localBackups) {
      const alreadyInR2 = await checkR2FileExists(backup.filename);

      if (!alreadyInR2) {
        try {
          await uploadBackupToR2(backup.filepath, backup.filename);
          try {
            await pool.execute(
              `UPDATE backup_logs SET r2_uploaded = 1, r2_uploaded_at = NOW(), r2_upload_error = NULL WHERE filename = ?`,
              [backup.filename]
            );
          } catch (_) { /* non-critical */ }
          results.push({ filename: backup.filename, status: 'uploaded' });
        } catch (err) {
          results.push({ filename: backup.filename, status: 'failed', error: err.message });
        }
      } else {
        results.push({ filename: backup.filename, status: 'already_exists' });
      }
    }

    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/backup/r2/download/:filename
router.get('/r2/download/:filename', async (req, res) => {
  const { filename } = req.params;

  if (!validateFilename(filename)) {
    return res.status(400).json({ success: false, message: 'Invalid filename' });
  }

  try {
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const stream = await downloadFromR2(filename);
    stream.pipe(res);
  } catch (err) {
    res.status(404).json({ success: false, message: 'File not found in R2' });
  }
});

// DELETE /api/backup/r2/:filename
router.delete('/r2/:filename', async (req, res) => {
  const { filename } = req.params;

  if (!validateFilename(filename)) {
    return res.status(400).json({ success: false, message: 'Invalid filename' });
  }

  try {
    await deleteFromR2(filename);

    try {
      await pool.execute(
        `UPDATE backup_logs SET r2_uploaded = 0, r2_uploaded_at = NULL WHERE filename = ?`,
        [filename]
      );
    } catch (_) { /* non-critical */ }

    res.json({ success: true, message: 'Deleted from R2' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
