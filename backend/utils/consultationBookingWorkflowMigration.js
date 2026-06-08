/**
 * Shared auto-migration for consultation_bookings workflow columns.
 * Safe to call from multiple routers (runs once per process).
 */
const pool = require('../config/db');

let bookingWorkflowSchemaDone = false;

async function ensureBookingWorkflowSchema() {
  if (bookingWorkflowSchemaDone) return;
  try {
    const [cols] = await pool.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'consultation_bookings'`
    );
    const names = new Set((cols || []).map((c) => c.COLUMN_NAME));
    if (!names.has('booking_status')) {
      await pool.execute(`
        ALTER TABLE consultation_bookings
        ADD COLUMN booking_status ENUM('pending','confirmed','denied','rescheduled') NULL
        COMMENT 'Workflow: pending=awaiting staff, confirmed=approved, denied=rejected, rescheduled=new time proposed'
      `);
      await pool.execute(`
        UPDATE consultation_bookings SET booking_status = 'confirmed'
        WHERE status IN ('confirmed','completed')
      `);
      await pool.execute(`
        UPDATE consultation_bookings SET booking_status = 'denied' WHERE status = 'cancelled'
      `);
      await pool.execute(`
        UPDATE consultation_bookings SET booking_status = 'pending' WHERE status = 'pending' AND booking_status IS NULL
      `);
      await pool.execute(`
        UPDATE consultation_bookings SET booking_status = 'confirmed' WHERE booking_status IS NULL
      `);
      await pool.execute(`
        ALTER TABLE consultation_bookings
        MODIFY COLUMN booking_status ENUM('pending','confirmed','denied','rescheduled') NOT NULL DEFAULT 'pending'
      `);
      console.log('[Consultations] Auto-migration: added booking_status');
    }
    if (!names.has('student_note')) {
      await pool.execute(
        'ALTER TABLE consultation_bookings ADD COLUMN student_note TEXT NULL AFTER notes'
      );
      await pool.execute(
        'UPDATE consultation_bookings SET student_note = notes WHERE student_note IS NULL AND notes IS NOT NULL'
      );
    }
    if (!names.has('tutor_note')) {
      await pool.execute(
        'ALTER TABLE consultation_bookings ADD COLUMN tutor_note TEXT NULL AFTER student_note'
      );
    }
    if (!names.has('reschedule_date')) {
      await pool.execute(
        'ALTER TABLE consultation_bookings ADD COLUMN reschedule_date DATE NULL AFTER tutor_note'
      );
    }
    if (!names.has('reschedule_time')) {
      await pool.execute(
        'ALTER TABLE consultation_bookings ADD COLUMN reschedule_time TIME NULL AFTER reschedule_date'
      );
    }
    if (!names.has('confirmed_at')) {
      await pool.execute(
        'ALTER TABLE consultation_bookings ADD COLUMN confirmed_at TIMESTAMP NULL AFTER reschedule_time'
      );
    }
    if (!names.has('denied_at')) {
      await pool.execute(
        'ALTER TABLE consultation_bookings ADD COLUMN denied_at TIMESTAMP NULL AFTER confirmed_at'
      );
    }
    if (!names.has('responded_by')) {
      await pool.execute(
        'ALTER TABLE consultation_bookings ADD COLUMN responded_by INT NULL COMMENT "admin/CM who confirmed or denied" AFTER denied_at'
      );
      try {
        await pool.execute(`
          ALTER TABLE consultation_bookings
          ADD CONSTRAINT fk_consultation_bookings_responded_by
          FOREIGN KEY (responded_by) REFERENCES users(id) ON DELETE SET NULL
        `);
      } catch (fkErr) {
        console.warn('[Consultations] responded_by FK skipped:', fkErr.message);
      }
    }
    bookingWorkflowSchemaDone = true;
  } catch (e) {
    if (e.code === 'ER_NO_SUCH_TABLE') return;
    console.warn('[Consultations] booking workflow migration:', e.message);
    bookingWorkflowSchemaDone = false;
  }
}

module.exports = { ensureBookingWorkflowSchema };
