/**
 * Consultation Manager — settings, today's calls, upcoming, complete booking
 */
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { ensureBookingWorkflowSchema } = require('../utils/consultationBookingWorkflowMigration');
const auth = require('../middleware/auth');
const { permit } = require('../middleware/roles');
const { createNotification } = require('../utils/notificationHelper');
const { fetchStudentQualProgress } = require('../services/studentQualProgressService');

const CM_ROLE_ID = 15;

const DEFAULT_DISABLED_MESSAGE =
  'The Consultation Manager portal is currently offline. Please check back later or contact your administrator.';

/** Create table + seed row if migration was not run (avoids 500 on /settings). */
let cmSettingsSchemaDone = false;
async function ensureConsultationManagerSettingsSchema() {
  if (cmSettingsSchemaDone) return;
  const withFk = `
    CREATE TABLE IF NOT EXISTS consultation_manager_settings (
      id INT PRIMARY KEY AUTO_INCREMENT,
      is_enabled TINYINT(1) NOT NULL DEFAULT 1,
      disabled_message TEXT NOT NULL,
      updated_by INT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;
  const noFk = `
    CREATE TABLE IF NOT EXISTS consultation_manager_settings (
      id INT PRIMARY KEY AUTO_INCREMENT,
      is_enabled TINYINT(1) NOT NULL DEFAULT 1,
      disabled_message TEXT NOT NULL,
      updated_by INT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;
  try {
    await pool.execute(withFk);
  } catch (e) {
    const code = e.code || e.errno;
    if (code === 'ER_TABLE_EXISTS_ERROR' || code === 1050) {
      /* already there */
    } else {
      console.warn('[consultationManager] Settings table create with FK failed, retrying without FK:', e.message);
      await pool.execute(noFk);
    }
  }
  await pool.execute(
    `INSERT IGNORE INTO consultation_manager_settings (id, is_enabled, disabled_message) VALUES (1, 1, ?)`,
    [DEFAULT_DISABLED_MESSAGE]
  );
  cmSettingsSchemaDone = true;
}

router.use(async (req, res, next) => {
  try {
    await ensureConsultationManagerSettingsSchema();
    await ensureBookingWorkflowSchema();
  } catch (e) {
    cmSettingsSchemaDone = false;
    console.error('[consultationManager] ensureConsultationManagerSettingsSchema:', e.message || e);
  }
  next();
});

// GET /api/consultation-manager/settings
router.get('/settings', auth, permit('Admin', 'Consultation Manager', 'Operation Manager'), async (req, res) => {
  try {
    await ensureConsultationManagerSettingsSchema();
    const [rows] = await pool.execute(
      'SELECT is_enabled, disabled_message, updated_at FROM consultation_manager_settings WHERE id = 1'
    );
    if (!rows.length) {
      return res.json({
        success: true,
        is_enabled: true,
        disabled_message: 'The Consultation Manager portal is currently offline. Please check back later or contact your administrator.',
        updated_at: null
      });
    }
    const r = rows[0];
    let msg = r.disabled_message;
    if (Buffer.isBuffer(msg)) msg = msg.toString('utf8');
    else if (msg != null) msg = String(msg);
    else msg = '';
    let updatedAt = r.updated_at;
    if (updatedAt instanceof Date) updatedAt = updatedAt.toISOString();
    else if (updatedAt != null) updatedAt = String(updatedAt);

    res.json({
      success: true,
      is_enabled: Number(r.is_enabled) === 1,
      disabled_message: msg,
      updated_at: updatedAt ?? null
    });
  } catch (err) {
    console.error('[consultationManager] GET settings:', err.code, err.message, err);
    res.status(500).json({
      success: false,
      message:
        err.code === 'ER_NO_SUCH_TABLE'
          ? 'Settings table could not be created.'
          : err.message || 'Failed to load settings'
    });
  }
});

// PUT /api/consultation-manager/settings — Admin only
router.put('/settings', auth, permit('Admin'), async (req, res) => {
  try {
    await ensureConsultationManagerSettingsSchema();
    const { is_enabled, disabled_message } = req.body || {};
    if (typeof is_enabled !== 'boolean') {
      return res.status(400).json({ success: false, message: 'is_enabled must be a boolean' });
    }
    if (typeof disabled_message !== 'string') {
      return res.status(400).json({ success: false, message: 'disabled_message must be a string' });
    }
    const msg = disabled_message.trim();
    if (msg.length > 500) {
      return res.status(400).json({ success: false, message: 'disabled_message max 500 characters' });
    }
    if (!is_enabled && !msg) {
      return res.status(400).json({ success: false, message: 'disabled_message cannot be empty when disabling' });
    }
    const [upd] = await pool.execute(
      `UPDATE consultation_manager_settings SET is_enabled = ?, disabled_message = ?, updated_by = ? WHERE id = 1`,
      [is_enabled ? 1 : 0, msg || ' ', req.user.id]
    );
    if (!upd.affectedRows) {
      await pool.execute(
        `INSERT INTO consultation_manager_settings (id, is_enabled, disabled_message, updated_by) VALUES (1, ?, ?, ?)`,
        [is_enabled ? 1 : 0, msg || ' ', req.user.id]
      );
    }
    const io = req.app?.get?.('io');
    if (io) {
      io.emit('consultation_manager_toggle', {
        is_enabled,
        disabled_message: msg
      });
    }
    res.json({
      success: true,
      message: 'Settings updated successfully',
      is_enabled,
      disabled_message: msg
    });
  } catch (err) {
    console.error('[consultationManager] PUT settings:', err);
    res.status(500).json({ success: false, message: 'Failed to update settings' });
  }
});

// GET /api/consultation-manager/today
router.get('/today', auth, permit('Admin', 'Consultation Manager', 'Operation Manager'), async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT
        cb.id as booking_id,
        cb.student_id,
        cb.zoom_join_url,
        cb.zoom_start_url,
        cb.zoom_meeting_id,
        cb.zoom_password,
        cb.status,
        cb.booking_status,
        cb.notes,
        cb.student_note,
        cb.tutor_note,
        cb.reschedule_date,
        cb.reschedule_time,
        cs.date,
        cs.start_time,
        cs.end_time,
        cs.duration_minutes,
        u.name as student_name,
        u.email as student_email,
        u.id as student_id
      FROM consultation_bookings cb
      JOIN consultation_slots cs ON cs.id = cb.slot_id
      JOIN users u ON u.id = cb.student_id
      WHERE cs.date = CURDATE()
      AND cb.status IN ('pending', 'confirmed', 'completed')
      ORDER BY cs.start_time ASC`
    );
    const today = new Date().toISOString().slice(0, 10);
    res.json({
      success: true,
      date: today,
      total: rows.length,
      consultations: rows
    });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return res.json({ success: true, date: new Date().toISOString().slice(0, 10), total: 0, consultations: [] });
    console.error('[consultationManager] today:', err);
    res.status(500).json({ success: false, message: 'Failed to load today' });
  }
});

// GET /api/consultation-manager/upcoming
router.get('/upcoming', auth, permit('Admin', 'Consultation Manager', 'Operation Manager'), async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT
        cb.id as booking_id,
        cb.zoom_start_url,
        cb.zoom_join_url,
        cb.status,
        cs.date,
        cs.start_time,
        cs.end_time,
        cs.duration_minutes,
        u.name as student_name,
        u.email as student_email
      FROM consultation_bookings cb
      JOIN consultation_slots cs ON cs.id = cb.slot_id
      JOIN users u ON u.id = cb.student_id
      WHERE cb.status = 'confirmed'
      AND (
        cs.date > CURDATE()
        OR (cs.date = CURDATE() AND cs.start_time >= CURTIME())
      )
      ORDER BY cs.date ASC, cs.start_time ASC`
    );
    res.json({ success: true, consultations: rows });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return res.json({ success: true, consultations: [] });
    console.error('[consultationManager] upcoming:', err);
    res.status(500).json({ success: false, message: 'Failed to load upcoming' });
  }
});

// PATCH /api/consultation-manager/bookings/:bookingId/complete
router.patch('/bookings/:bookingId/complete', auth, permit('Admin', 'Consultation Manager', 'Operation Manager'), async (req, res) => {
  try {
    const bookingId = req.params.bookingId;
    const [r] = await pool.execute(
      `UPDATE consultation_bookings SET status = 'completed' WHERE id = ? AND status = 'confirmed'
       AND (booking_status = 'confirmed' OR booking_status IS NULL)`,
      [bookingId]
    );
    if (!r.affectedRows) {
      return res.status(404).json({ success: false, message: 'Booking not found or not confirmed' });
    }

    const [bookingDetails] = await pool.execute(
      `SELECT cb.id, cb.student_id, cb.slot_id,
              cs.date, cs.start_time, cs.end_time,
              u.name as student_name
       FROM consultation_bookings cb
       JOIN consultation_slots cs ON cs.id = cb.slot_id
       JOIN users u ON u.id = cb.student_id
       WHERE cb.id = ?`,
      [bookingId]
    );

    if (bookingDetails.length > 0) {
      const b = bookingDetails[0];
      const dateStr = b.date instanceof Date ? b.date.toISOString().slice(0, 10) : String(b.date).slice(0, 10);
      const timeStr = String(b.start_time).slice(0, 5);

      const io = req.app?.get?.('io');
      if (io) {
        io.emit('consultation_completed', {
          bookingId: b.id,
          slotId: b.slot_id,
          studentId: b.student_id,
          studentName: b.student_name,
          date: dateStr,
          startTime: timeStr,
          endTime: String(b.end_time).slice(0, 5),
          autoCompleted: false
        });
      }

      try {
        const [admins] = await pool.execute('SELECT id FROM users WHERE role_id = 1');
        for (const admin of admins) {
          await createNotification({
            userId: admin.id,
            type: 'consultation_completed',
            title: 'Consultation Completed',
            message: `Consultation with ${b.student_name} on ${dateStr} at ${timeStr} has been completed.`,
            req
          });
        }
      } catch (e) {
        console.warn('[consultationManager] notification:', e.message);
      }
    }

    res.json({ success: true, message: 'Marked as completed' });
  } catch (err) {
    console.error('[consultationManager] complete:', err);
    res.status(500).json({ success: false, message: 'Failed to update booking' });
  }
});

// GET /api/consultation-manager/students/:studentId/enrollments
router.get('/students/:studentId/enrollments', auth, permit('Admin', 'Consultation Manager', 'Operation Manager'), async (req, res) => {
  try {
    const studentId = req.params.studentId;
    const [rows] = await pool.execute(
      `SELECT c.id as course_id, c.title, c.course_type, ca.status as enrollment_status
       FROM course_assignments ca
       JOIN courses c ON c.id = ca.course_id
       WHERE ca.student_id = ?
       ORDER BY c.title ASC`,
      [studentId]
    );
    res.json({ success: true, enrollments: rows });
  } catch (err) {
    console.error('[consultationManager] enrollments:', err);
    res.status(500).json({ success: false, message: 'Failed to load enrollments' });
  }
});

// GET /api/consultation-manager/students/:studentId/qual-progress
// Qualification unit progress, deadlines, submissions, and files (read-only; CM / Admin / Operation Manager)
router.get(
  '/students/:studentId/qual-progress',
  auth,
  permit('Admin', 'Consultation Manager', 'Operation Manager'),
  async (req, res) => {
    try {
      const studentId = Number(req.params.studentId);
      if (!Number.isFinite(studentId) || studentId <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid student id' });
      }

      const { courses } = await fetchStudentQualProgress(studentId);
      res.json({ success: true, data: courses });
    } catch (err) {
      console.error('[CM QualProgress]', err);
      res.status(500).json({
        success: false,
        message: err.message || 'Failed to load qualification progress',
      });
    }
  }
);

// GET /api/consultation-manager/team — Admin: list Consultation Manager users (for admin UI)
router.get('/team', auth, permit('Admin'), async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, name, email FROM users WHERE role_id = ? ORDER BY name ASC`,
      [CM_ROLE_ID]
    );
    res.json({ success: true, total: rows.length, users: rows });
  } catch (err) {
    console.error('[consultationManager] team:', err);
    res.status(500).json({ success: false, message: 'Failed to load team' });
  }
});

module.exports = router;
