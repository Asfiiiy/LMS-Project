/**
 * Zoom Video Consultation Booking API
 * Admin: create slots, view all, cancel bookings
 * Student: view available slots, book, view/cancel own bookings
 */
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const redis = require('../config/redis');
const auth = require('../middleware/auth');
const { permit } = require('../middleware/roles');
const { createNotification } = require('../utils/notificationHelper');
const { createMeeting, deleteMeeting } = require('../services/zoomService');
const { ensureBookingWorkflowSchema } = require('../utils/consultationBookingWorkflowMigration');

const MAX_ACTIVE_BOOKINGS_PER_STUDENT = 2;
/** Students may only book slots starting at least this many hours from server time */
const MIN_BOOKING_LEAD_HOURS = 48;

const DURATIONS = [15, 30, 45, 60];
const MIN_START = '08:00';
const MAX_START = '20:00';

// Helper: compute end_time from start_time (HH:MM) + duration_minutes
function addMinutesToTime(startTime, durationMinutes) {
  const [h, m] = String(startTime).slice(0, 5).split(':').map(Number);
  const total = h * 60 + m + durationMinutes;
  const eh = Math.floor(total / 60) % 24;
  const em = total % 60;
  return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}:00`;
}

// Helper: check if time A is in range [startB, endB) (exclusive end)
function timeInRange(timeA, startB, endB) {
  const toMins = (t) => {
    const [h, m] = String(t).slice(0, 5).split(':').map(Number);
    return h * 60 + m;
  };
  const a = toMins(timeA);
  const s = toMins(startB);
  const e = toMins(endB);
  return a >= s && a < e;
}

// Helper: check if two slots overlap (start1,end1) vs (start2,end2)
function slotsOverlap(start1, end1, start2, end2) {
  const toMins = (t) => {
    const [h, m] = String(t).slice(0, 5).split(':').map(Number);
    return h * 60 + m;
  };
  const s1 = toMins(start1), e1 = toMins(end1);
  const s2 = toMins(start2), e2 = toMins(end2);
  return s1 < e2 && s2 < e1;
}

// Helper: validate start time 08:00–20:00
function isValidStartTime(t) {
  const [h, m] = String(t).slice(0, 5).split(':').map(Number);
  const mins = h * 60 + m;
  return mins >= 8 * 60 && mins < 20 * 60;
}

// Helper: Admin user IDs (legacy / narrow use)
async function getAdminUserIds() {
  try {
    const [rows] = await pool.execute(
      'SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = ? LIMIT 10',
      ['Admin']
    );
    return (rows || []).map(r => r.id);
  } catch (e) {
    console.warn('[Consultations] getAdminUserIds:', e?.message);
    return [];
  }
}

/** Admin + Consultation Manager — same in-app alerts for consultation lifecycle */
async function getConsultationStaffNotificationUserIds() {
  try {
    const [rows] = await pool.execute(
      `SELECT u.id FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE r.name IN ('Admin', 'Consultation Manager')`
    );
    return (rows || []).map((row) => row.id);
  } catch (e) {
    console.warn('[Consultations] getConsultationStaffNotificationUserIds:', e?.message);
    return [];
  }
}

async function countActiveFutureBookings(studentId) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) as cnt
     FROM consultation_bookings cb
     JOIN consultation_slots cs ON cs.id = cb.slot_id
     WHERE cb.student_id = ?
     AND cb.status IN ('confirmed', 'pending')
     AND cs.date >= CURDATE()
     AND (
       cb.booking_status IS NULL
       OR cb.booking_status IN ('pending', 'confirmed', 'rescheduled')
     )`,
    [studentId]
  );
  return Number(rows[0]?.cnt || 0);
}

function emitConsultationStaffSockets(io, event, payload) {
  if (!io) return;
  io.to('role_Admin').emit(event, payload);
  io.to('role_Consultation Manager').emit(event, payload);
  io.to('admin_room').emit(event, payload);
}

function formatSlotDate(d) {
  if (!d) return '';
  return d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
}

/** Slot local start instant (ms); aligns with MySQL NOW() when server TZ matches Node */
function slotStartTimeMs(dateVal, timeVal) {
  const d = formatSlotDate(dateVal);
  const t = String(timeVal || '');
  const tnorm = t.length >= 8 ? t.slice(0, 8) : `${t.slice(0, 5)}:00`;
  const ms = new Date(`${d}T${tnorm}`).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function isSlotAtLeastHoursAhead(dateVal, timeVal, hours = MIN_BOOKING_LEAD_HOURS) {
  const startMs = slotStartTimeMs(dateVal, timeVal);
  if (startMs == null) return false;
  return startMs - Date.now() >= hours * 60 * 60 * 1000;
}

async function hasActiveEnrollment(studentId) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) as cnt FROM course_assignments
     WHERE student_id = ?
     AND (
       status = 'Enrolled'
       OR LOWER(TRIM(COALESCE(status, ''))) IN ('enrolled', 'active')
     )`,
    [studentId]
  );
  return Number(rows[0]?.cnt || 0) > 0;
}

// Auto-migration: add duration_minutes and is_active if missing (uses DB creds from .env)
let schemaChecked = false;
async function ensureConsultationSchema() {
  if (schemaChecked) return;
  try {
    const [cols] = await pool.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'consultation_slots' AND COLUMN_NAME IN ('is_active', 'duration_minutes')`
    );
    const has = (cols || []).map(c => c.COLUMN_NAME);
    if (!has.includes('duration_minutes')) {
      await pool.execute('ALTER TABLE consultation_slots ADD COLUMN duration_minutes INT NULL AFTER end_time');
      console.log('[Consultations] Auto-migration: added duration_minutes');
    }
    if (!has.includes('is_active')) {
      await pool.execute('ALTER TABLE consultation_slots ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER is_booked');
      console.log('[Consultations] Auto-migration: added is_active');
    }
    schemaChecked = true;
  } catch (e) {
    if (e.code === 'ER_NO_SUCH_TABLE') return;
    console.warn('[Consultations] Auto-migration failed:', e.message);
  }
}

// Auto-migration: add consultation notification types to notifications.type ENUM if missing
const CONSULTATION_TYPES = [
  'consultation_confirmed',
  'consultation_new',
  'consultation_cancelled',
  'consultation_reminder',
  'consultation_pending',
  'consultation_denied',
  'consultation_rescheduled'
];
let notificationTypesChecked = false;
async function ensureConsultationNotificationTypes() {
  if (notificationTypesChecked) return;
  try {
    const [cols] = await pool.execute(
      `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'type'`
    );
    if (!cols.length) return;
    const currentEnum = cols[0].COLUMN_TYPE || '';
    const needs = CONSULTATION_TYPES.filter(t => !currentEnum.includes(t));
    if (needs.length === 0) {
      notificationTypesChecked = true;
      return;
    }
    const matches = currentEnum.match(/'([^']+)'/g) || [];
    const existing = matches.map(m => m.slice(1, -1));
    const allTypes = [...new Set([...existing, ...CONSULTATION_TYPES])];
    const enumList = allTypes.map(t => `'${t}'`).join(', ');
    await pool.execute(`ALTER TABLE notifications MODIFY COLUMN type ENUM(${enumList}) NOT NULL`);
    console.log('[Consultations] Auto-migration: added notification types:', needs.join(', '));
    notificationTypesChecked = true;
  } catch (e) {
    console.warn('[Consultations] Auto-migration (notification types) failed:', e.message);
  }
}

router.use('/consultations', async (req, res, next) => {
  await ensureConsultationSchema();
  await ensureConsultationNotificationTypes();
  await ensureBookingWorkflowSchema();
  next();
});

// POST /api/consultations/slots - Admin creates available slots (legacy)
router.post('/consultations/slots', auth, permit('Admin', 'Consultation Manager', 'Operation Manager'), async (req, res) => {
  try {
    const body = Array.isArray(req.body) ? req.body : [req.body];
    const slots = body.map(s => ({
      date: s.date,
      start_time: s.start_time || s.startTime,
      end_time: s.end_time || s.endTime
    }));
    const created = [];
    for (const s of slots) {
      if (!s.date || !s.start_time || !s.end_time) continue;
      const [r] = await pool.execute(
        'INSERT INTO consultation_slots (date, start_time, end_time, duration_minutes, created_by) VALUES (?, ?, ?, ?, ?)',
        [s.date, s.start_time, s.end_time, 30, req.user.id]
      );
      created.push({ id: r.insertId, date: s.date, start_time: s.start_time, end_time: s.end_time });
    }
    res.json({ success: true, created });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json({ success: false, message: 'Consultation tables not found. Run migration.' });
    }
    console.error('[Consultations] Create slots:', err);
    res.status(500).json({ success: false, message: 'Failed to create slots' });
  }
});

// POST /api/consultations/slots/single - Create single slot
router.post('/consultations/slots/single', auth, permit('Admin', 'Consultation Manager', 'Operation Manager'), async (req, res) => {
  try {
    const { date, start_time, duration_minutes } = req.body || {};
    if (!date || !start_time || !duration_minutes) {
      return res.status(400).json({ success: false, message: 'date, start_time and duration_minutes required' });
    }
    if (!DURATIONS.includes(Number(duration_minutes))) {
      return res.status(400).json({ success: false, message: 'duration_minutes must be 15, 30, 45 or 60' });
    }
    const today = new Date().toISOString().slice(0, 10);
    if (date < today) {
      return res.status(400).json({ success: false, message: 'Cannot create slots in the past' });
    }
    if (!isValidStartTime(start_time)) {
      return res.status(400).json({ success: false, message: 'Start time must be between 08:00 and 20:00' });
    }
    const end_time = addMinutesToTime(start_time, Number(duration_minutes));
    const [existing] = await pool.execute(
      'SELECT id, start_time, end_time FROM consultation_slots WHERE date = ? AND (is_active = 1 OR is_active IS NULL)',
      [date]
    );
    for (const e of existing) {
      if (slotsOverlap(start_time, end_time, e.start_time, e.end_time)) {
        return res.status(400).json({ success: false, message: 'Slot overlaps with existing slot' });
      }
    }
    const [r] = await pool.execute(
      'INSERT INTO consultation_slots (date, start_time, end_time, duration_minutes, created_by) VALUES (?, ?, ?, ?, ?)',
      [date, String(start_time).slice(0, 5) + (String(start_time).length === 5 ? ':00' : ''), end_time, Number(duration_minutes), req.user.id]
    );
    const startNorm = String(start_time).slice(0, 5);
    res.json({
      success: true,
      slot: { id: r.insertId, date, start_time: startNorm, end_time, duration_minutes: Number(duration_minutes) }
    });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json({ success: false, message: 'Consultation tables not found. Run migration.' });
    }
    console.error('[Consultations] Create single slot:', err);
    res.status(500).json({ success: false, message: 'Failed to create slot' });
  }
});

// POST /api/consultations/slots/day - Create multiple slots for one day
router.post('/consultations/slots/day', auth, permit('Admin', 'Consultation Manager', 'Operation Manager'), async (req, res) => {
  try {
    const { date, slots: slotsArr } = req.body || {};
    if (!date || !Array.isArray(slotsArr) || slotsArr.length === 0) {
      return res.status(400).json({ success: false, message: 'date and slots array required' });
    }
    if (slotsArr.length > 48) {
      return res.status(400).json({ success: false, message: 'Maximum 48 slots per day' });
    }
    const today = new Date().toISOString().slice(0, 10);
    if (date < today) {
      return res.status(400).json({ success: false, message: 'Cannot create slots in the past' });
    }
    const computed = slotsArr.map(s => {
      const dur = Number(s.duration_minutes);
      if (!DURATIONS.includes(dur)) return null;
      const st = String(s.start_time || '').slice(0, 5);
      if (!isValidStartTime(st)) return null;
      const et = addMinutesToTime(st, dur);
      return { start_time: st + ':00', end_time: et, duration_minutes: dur };
    }).filter(Boolean);
    if (computed.length !== slotsArr.length) {
      return res.status(400).json({ success: false, message: 'Invalid slot: duration 15/30/45/60, start 08:00–20:00' });
    }
    for (let i = 0; i < computed.length; i++) {
      for (let j = i + 1; j < computed.length; j++) {
        if (slotsOverlap(computed[i].start_time, computed[i].end_time, computed[j].start_time, computed[j].end_time)) {
          return res.status(400).json({ success: false, message: 'Slots overlap on same day' });
        }
      }
    }
    const [existing] = await pool.execute(
      'SELECT start_time, end_time FROM consultation_slots WHERE date = ? AND (is_active = 1 OR is_active IS NULL)',
      [date]
    );
    for (const c of computed) {
      for (const e of existing) {
        if (slotsOverlap(c.start_time, c.end_time, e.start_time, e.end_time)) {
          return res.status(400).json({ success: false, message: 'Slot overlaps with existing slot' });
        }
      }
    }
    const created = [];
    for (const c of computed) {
      const [r] = await pool.execute(
        'INSERT INTO consultation_slots (date, start_time, end_time, duration_minutes, created_by) VALUES (?, ?, ?, ?, ?)',
        [date, c.start_time, c.end_time, c.duration_minutes, req.user.id]
      );
      created.push({ id: r.insertId, date, start_time: c.start_time.slice(0, 5), end_time: c.end_time.slice(0, 5), duration_minutes: c.duration_minutes });
    }
    res.json({ success: true, created });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json({ success: false, message: 'Consultation tables not found. Run migration.' });
    }
    console.error('[Consultations] Create day slots:', err);
    res.status(500).json({ success: false, message: 'Failed to create slots' });
  }
});

// POST /api/consultations/slots/bulk - Bulk create for date range
router.post('/consultations/slots/bulk', auth, permit('Admin', 'Consultation Manager', 'Operation Manager'), async (req, res) => {
  try {
    const { date_from, date_to, repeat_on, slots: slotsArr, skip_dates } = req.body || {};
    if (!date_from || !date_to || !Array.isArray(repeat_on) || !Array.isArray(slotsArr) || slotsArr.length === 0) {
      return res.status(400).json({ success: false, message: 'date_from, date_to, repeat_on and slots required' });
    }
    if (date_to <= date_from) {
      return res.status(400).json({ success: false, message: 'date_to must be after date_from' });
    }
    const from = new Date(date_from);
    const to = new Date(date_to);
    const daysDiff = Math.ceil((to - from) / (24 * 60 * 60 * 1000));
    if (daysDiff > 31) {
      return res.status(400).json({ success: false, message: 'Maximum 1 month range for bulk creation' });
    }
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const repeatSet = new Set(repeat_on.map(d => String(d).toLowerCase()));
    const skipSet = new Set((skip_dates || []).map((d) => String(d).slice(0, 10)));
    const today = new Date().toISOString().slice(0, 10);
    const computed = slotsArr.map(s => {
      const dur = Number(s.duration_minutes);
      if (!DURATIONS.includes(dur)) return null;
      const st = String(s.start_time || '').slice(0, 5);
      if (!isValidStartTime(st)) return null;
      const et = addMinutesToTime(st, dur);
      return { start_time: st + ':00', end_time: et, duration_minutes: dur };
    }).filter(Boolean);
    if (computed.length !== slotsArr.length) {
      return res.status(400).json({ success: false, message: 'Invalid slot: duration 15/30/45/60, start 08:00–20:00' });
    }
    for (let i = 0; i < computed.length; i++) {
      for (let j = i + 1; j < computed.length; j++) {
        if (slotsOverlap(computed[i].start_time, computed[i].end_time, computed[j].start_time, computed[j].end_time)) {
          return res.status(400).json({ success: false, message: 'Slot templates overlap' });
        }
      }
    }
    const [existingRows] = await pool.execute(
      'SELECT date, start_time, end_time FROM consultation_slots WHERE date >= ? AND date <= ? AND (is_active = 1 OR is_active IS NULL)',
      [date_from, date_to]
    );
    const existingByDate = {};
    for (const r of existingRows) {
      const d = r.date.toISOString ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10);
      if (!existingByDate[d]) existingByDate[d] = [];
      existingByDate[d].push({ start_time: r.start_time, end_time: r.end_time });
    }
    let created = 0;
    const datesAffected = [];
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      let d = new Date(date_from);
      const endD = new Date(date_to);
      while (d <= endD) {
        const dateStr = d.toISOString().slice(0, 10);
        if (dateStr < today) { d.setDate(d.getDate() + 1); continue; }
        if (skipSet.has(dateStr)) { d.setDate(d.getDate() + 1); continue; }
        const dayName = dayNames[d.getDay()];
        if (!repeatSet.has(dayName)) { d.setDate(d.getDate() + 1); continue; }
        const existing = existingByDate[dateStr] || [];
        for (const c of computed) {
          let conflict = false;
          for (const e of existing) {
            if (slotsOverlap(c.start_time, c.end_time, e.start_time, e.end_time)) {
              conflict = true;
              break;
            }
          }
          if (conflict) continue;
          await connection.execute(
            'INSERT INTO consultation_slots (date, start_time, end_time, duration_minutes, created_by) VALUES (?, ?, ?, ?, ?)',
            [dateStr, c.start_time, c.end_time, c.duration_minutes, req.user.id]
          );
          created++;
          if (!datesAffected.includes(dateStr)) datesAffected.push(dateStr);
          existing.push({ start_time: c.start_time, end_time: c.end_time });
        }
        d.setDate(d.getDate() + 1);
      }
      await connection.commit();
    } finally {
      connection.release();
    }
    res.json({ success: true, created, dates_affected: datesAffected });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json({ success: false, message: 'Consultation tables not found. Run migration.' });
    }
    console.error('[Consultations] Bulk create:', err);
    res.status(500).json({ success: false, message: 'Failed to create slots' });
  }
});

// GET /api/consultations/slots/all - Admin sees all slots with booking details (supports filters, pagination)
router.get('/consultations/slots/all', auth, permit('Admin', 'Consultation Manager', 'Operation Manager'), async (req, res) => {
  try {
    const { date_from, date_to, status, page = 1, per_page, limit } = req.query;
    const limitRaw = limit != null && limit !== '' ? limit : per_page;
    let sql = `SELECT cs.*, u.name as student_name, u.email as student_email, u.id as student_id,
       cb.id as booking_id, cb.status as booking_row_status, cb.booking_status,
       cb.student_note, cb.tutor_note, cb.reschedule_date, cb.reschedule_time
       FROM consultation_slots cs
       LEFT JOIN consultation_bookings cb ON cb.slot_id = cs.id AND cb.status IN ('pending', 'confirmed')
       LEFT JOIN users u ON cb.student_id = u.id WHERE 1=1`;
    const params = [];
    if (date_from) { sql += ' AND cs.date >= ?'; params.push(date_from); }
    if (date_to) { sql += ' AND cs.date <= ?'; params.push(date_to); }
    if (status === 'available') { sql += ' AND cs.is_booked = 0 AND (cs.is_active = 1 OR cs.is_active IS NULL)'; }
    else if (status === 'booked') { sql += ' AND cs.is_booked = 1'; }
    const countSql = 'SELECT COUNT(*) as cnt FROM (' + sql + ') _count';
    const [[{ cnt }]] = await pool.execute(countSql, params);
    const total = Number(cnt) || 0;
    sql += ' ORDER BY cs.date ASC, cs.start_time ASC';
    const perPage = Math.min(Math.max(Number(limitRaw) || 20, 1), 100);
    const pageNum = Math.max(Number(page) || 1, 1);
    const offset = (pageNum - 1) * perPage;
    sql += ` LIMIT ${perPage} OFFSET ${offset}`;
    const [rows] = await pool.execute(sql, params);
    const totalPages = Math.max(1, Math.ceil(total / perPage) || 1);
    res.json({
      success: true,
      slots: rows,
      total,
      page: pageNum,
      per_page: perPage,
      limit: perPage,
      totalPages
    });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return res.json({ success: true, slots: [], total: 0 });
    console.error('[Consultations] Slots all:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch slots' });
  }
});

// DELETE /api/consultations/slots/bulk - Bulk delete available slots only
router.delete('/consultations/slots/bulk', auth, permit('Admin', 'Consultation Manager', 'Operation Manager'), async (req, res) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'ids array required' });
    }
    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await pool.execute(
      `SELECT id FROM consultation_slots WHERE id IN (${placeholders}) AND is_booked = 0`,
      ids
    );
    const toDelete = rows.map(r => r.id);
    if (toDelete.length === 0) {
      return res.json({ success: true, deleted: 0, message: 'No available slots to delete' });
    }
    const delPlaceholders = toDelete.map(() => '?').join(',');
    await pool.execute(`DELETE FROM consultation_slots WHERE id IN (${delPlaceholders})`, toDelete);
    res.json({ success: true, deleted: toDelete.length });
  } catch (err) {
    console.error('[Consultations] Bulk delete:', err);
    res.status(500).json({ success: false, message: 'Failed to delete slots' });
  }
});

// PATCH /api/consultations/slots/:slotId/toggle-active - Deactivate/reactivate empty slot
router.patch('/consultations/slots/:slotId/toggle-active', auth, permit('Admin', 'Consultation Manager', 'Operation Manager'), async (req, res) => {
  try {
    const slotId = req.params.slotId;
    const [rows] = await pool.execute(
      'SELECT id, is_booked, is_active FROM consultation_slots WHERE id = ?',
      [slotId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Slot not found' });
    if (rows[0].is_booked) {
      return res.status(400).json({ success: false, message: 'Cannot toggle a booked slot' });
    }
    await pool.execute(
      'UPDATE consultation_slots SET is_active = IF(COALESCE(is_active, 1) = 1, 0, 1) WHERE id = ? AND is_booked = 0',
      [slotId]
    );
    const [updated] = await pool.execute('SELECT * FROM consultation_slots WHERE id = ?', [slotId]);
    res.json({ success: true, slot: updated[0] || null });
  } catch (err) {
    console.error('[Consultations] Toggle slot active:', err);
    res.status(500).json({ success: false, message: 'Failed to update slot' });
  }
});

// DELETE /api/consultations/slots/:slotId - Admin removes slot (only if not booked)
router.delete('/consultations/slots/:slotId', auth, permit('Admin', 'Consultation Manager', 'Operation Manager'), async (req, res) => {
  try {
    const slotId = req.params.slotId;
    const [slot] = await pool.execute('SELECT is_booked FROM consultation_slots WHERE id = ?', [slotId]);
    if (!slot.length) return res.status(404).json({ success: false, message: 'Slot not found' });
    if (slot[0].is_booked) {
      return res.status(400).json({ success: false, message: 'Cannot delete a booked slot' });
    }
    await pool.execute('DELETE FROM consultation_slots WHERE id = ?', [slotId]);
    res.json({ success: true });
  } catch (err) {
    console.error('[Consultations] Delete slot:', err);
    res.status(500).json({ success: false, message: 'Failed to delete slot' });
  }
});

// GET /api/consultations/bookings — upcoming (default) or full list with filters (scope=all)
router.get('/consultations/bookings', auth, permit('Admin', 'Consultation Manager', 'Operation Manager'), async (req, res) => {
  try {
    const { scope, student_id, status: statusFilter, booking_status: bookingStatusFilter, date_from, date_to } = req.query;
    let sql = `SELECT cb.*, u.name as student_name, u.email as student_email,
       cs.date, cs.start_time, cs.end_time, cs.duration_minutes,
       u_responded.name as responded_by_name
       FROM consultation_bookings cb
       JOIN users u ON cb.student_id = u.id
       JOIN consultation_slots cs ON cb.slot_id = cs.id
       LEFT JOIN users u_responded ON u_responded.id = cb.responded_by
       WHERE 1=1`;
    const params = [];

    if (scope === 'all') {
      if (student_id) {
        sql += ' AND cb.student_id = ?';
        params.push(Number(student_id));
      }
      if (statusFilter && String(statusFilter) !== 'all') {
        sql += ' AND cb.status = ?';
        params.push(statusFilter);
      }
      if (bookingStatusFilter && String(bookingStatusFilter) !== 'all') {
        sql += ' AND cb.booking_status = ?';
        params.push(bookingStatusFilter);
      }
      if (date_from) {
        sql += ' AND cs.date >= ?';
        params.push(date_from);
      }
      if (date_to) {
        sql += ' AND cs.date <= ?';
        params.push(date_to);
      }
    } else {
      sql += ` AND cb.status IN ('pending', 'confirmed') AND cs.date >= CURDATE()`;
    }

    sql += ' ORDER BY cs.date ASC, cs.start_time ASC';
    const [rows] = await pool.execute(sql, params);
    res.json({ success: true, bookings: rows });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return res.json({ success: true, bookings: [] });
    console.error('[Consultations] Bookings:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch bookings' });
  }
});

// PUT /api/consultations/bookings/:bookingId/cancel - Admin cancels booking
router.put('/consultations/bookings/:bookingId/cancel', auth, permit('Admin', 'Consultation Manager', 'Operation Manager'), async (req, res) => {
  try {
    const bookingId = req.params.bookingId;
    const [bookings] = await pool.execute(
      `SELECT cb.*, u.name as student_name, cs.date, cs.start_time
       FROM consultation_bookings cb
       JOIN users u ON cb.student_id = u.id
       JOIN consultation_slots cs ON cb.slot_id = cs.id
       WHERE cb.id = ? AND cb.status IN ('pending', 'confirmed')`,
      [bookingId]
    );
    if (!bookings.length) return res.status(404).json({ success: false, message: 'Booking not found' });
    const b = bookings[0];
    if (b.zoom_meeting_id) {
      try { await deleteMeeting(b.zoom_meeting_id); } catch (e) { console.warn('[Consultations] Zoom delete:', e.message); }
    }
    await pool.execute('UPDATE consultation_bookings SET status = ? WHERE id = ?', ['cancelled', bookingId]);
    await pool.execute('UPDATE consultation_slots SET is_booked = 0 WHERE id = ?', [b.slot_id]);
    await createNotification({
      userId: b.student_id,
      type: 'consultation_cancelled',
      title: 'Consultation Cancelled',
      message: `Your video consultation on ${new Date(b.date).toLocaleDateString('en-GB')} at ${String(b.start_time).slice(0, 5)} has been cancelled by admin.`,
      req
    });
    const io = req.app?.get?.('io');
    if (io) {
      const dateStr = b.date.toISOString ? b.date.toISOString().slice(0, 10) : String(b.date).slice(0, 10);
      io.emit('consultation_cancelled', {
        slotId: b.slot_id,
        bookingId: Number(bookingId),
        studentName: b.student_name,
        date: dateStr,
        startTime: String(b.start_time).slice(0, 5)
      });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[Consultations] Cancel booking:', err);
    res.status(500).json({ success: false, message: 'Failed to cancel booking' });
  }
});

// GET /api/consultations/slots/available - Student sees available (not booked) future slots (≥48h lead time)
router.get('/consultations/slots/available', auth, permit('Student', 'ManagerStudent', 'InstituteStudent'), async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT * FROM consultation_slots
       WHERE is_booked = 0 AND date >= CURDATE() AND COALESCE(is_active, 1) = 1
       AND CAST(CONCAT(DATE_FORMAT(date, '%Y-%m-%d'), ' ', TIME_FORMAT(start_time, '%H:%i:%s')) AS DATETIME)
           > DATE_ADD(NOW(), INTERVAL ? HOUR)
       ORDER BY date ASC, start_time ASC`,
      [MIN_BOOKING_LEAD_HOURS]
    );
    const byDate = {};
    rows.forEach(r => {
      const d = r.date.toISOString ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10);
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push(r);
    });
    res.json({ success: true, slots: rows, byDate });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return res.json({ success: true, slots: [], byDate: {} });
    console.error('[Consultations] Available slots:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch slots' });
  }
});

// POST /api/consultations/book/:slotId - Student books a slot
// Concurrency protection: Redis lock + DB transaction with SELECT FOR UPDATE
router.post('/consultations/book/:slotId', auth, permit('Student', 'ManagerStudent', 'InstituteStudent'), async (req, res) => {
  try {
    const slotId = req.params.slotId;
    const student_note = req.body?.student_note ?? req.body?.notes ?? '';
    if (!student_note || String(student_note).trim().length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a reason for booking (minimum 10 characters)'
      });
    }
    const noteTrim = String(student_note).trim();

    const activeBookings = await countActiveFutureBookings(req.user.id);
    if (activeBookings >= MAX_ACTIVE_BOOKINGS_PER_STUDENT) {
      return res.status(400).json({
        success: false,
        message: 'You already have 2 upcoming consultations booked. Please cancel one before booking another.',
        error: 'You already have 2 upcoming consultations booked. Please cancel one before booking another.'
      });
    }

    const enrolled = await hasActiveEnrollment(req.user.id);
    if (!enrolled) {
      return res.status(403).json({
        success: false,
        message: 'You must be enrolled in a course to book a consultation.',
        error: 'You must be enrolled in a course to book a consultation.'
      });
    }

    // Layer 1 — Redis distributed lock (prevents duplicate requests from even reaching DB)
    const lockKey = `slot_booking_lock:${slotId}`;
    let lockAcquired = false;
    try {
      const lockResult = await redis.set(lockKey, '1', 'EX', 10, 'NX');
      lockAcquired = lockResult === 'OK';
    } catch (redisErr) {
      console.warn('[Consultations] Redis lock error (proceeding without lock):', redisErr?.message);
      lockAcquired = true; // Proceed if Redis is down — DB layer still protects
    }
    if (!lockAcquired) {
      return res.status(409).json({
        success: false,
        message: 'This slot is being processed. Please try again in a few seconds.'
      });
    }

    try {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        // Layer 2 — SELECT FOR UPDATE locks the row; other requests wait
        const [slots] = await connection.execute(
          'SELECT * FROM consultation_slots WHERE id = ? AND date >= CURDATE() AND COALESCE(is_active, 1) = 1 FOR UPDATE',
          [slotId]
        );
        if (!slots.length) {
          await connection.rollback();
          return res.status(404).json({ success: false, message: 'This slot is no longer available.' });
        }
        const slot = slots[0];
        if (slot.is_booked) {
          await connection.rollback();
          return res.status(409).json({
            success: false,
            message: 'Sorry! Someone just booked this slot. Please choose another available time.'
          });
        }

        if (!isSlotAtLeastHoursAhead(slot.date, slot.start_time)) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: 'Bookings must be made at least 48 hours in advance.',
            error: 'Bookings must be made at least 48 hours in advance.'
          });
        }

        const studentName = req.user.name || 'Student';
        const durationMinutes = slot.duration_minutes || 30;

        const [r] = await connection.execute(
          `INSERT INTO consultation_bookings (
            slot_id, student_id, zoom_meeting_id, zoom_join_url, zoom_start_url, zoom_password,
            status, notes, booking_status, student_note
          ) VALUES (?, ?, NULL, NULL, NULL, NULL, 'pending', ?, 'pending', ?)`,
          [slotId, req.user.id, noteTrim, noteTrim]
        );
        await connection.execute('UPDATE consultation_slots SET is_booked = 1 WHERE id = ?', [slotId]);
        await connection.commit();

        const dateStr = new Date(slot.date).toLocaleDateString('en-GB');
        const timeStr = String(slot.start_time).slice(0, 5);
        await createNotification({
          userId: req.user.id,
          type: 'consultation_pending',
          title: 'Consultation request submitted',
          message: `Your consultation request for ${dateStr} at ${timeStr} is pending tutor confirmation.`,
          req
        });
        const staffIds = await getConsultationStaffNotificationUserIds();
        for (const staffId of staffIds) {
          await createNotification({
            userId: staffId,
            type: 'consultation_new',
            title: 'New consultation request',
            message: `${studentName} requested a consultation for ${dateStr} at ${timeStr}. Review to confirm or decline.`,
            relatedUserId: req.user.id,
            req
          });
        }

        const io = req.app?.get?.('io');
        if (io) {
          const slotDate = formatSlotDate(slot.date);
          io.emit('slot_booked', {
            slotId: Number(slotId),
            date: slotDate,
            booking_id: r.insertId,
            student_name: studentName,
            start_time: String(slot.start_time).slice(0, 8),
            duration_minutes: durationMinutes,
            zoom_start_url: '',
            booking_status: 'pending'
          });
        }

        res.json({
          success: true,
          message: 'Booking request submitted! Your tutor will confirm shortly.',
          booking_status: 'pending',
          booking: {
            id: r.insertId,
            zoom_join_url: null,
            date: slot.date,
            start_time: slot.start_time,
            end_time: slot.end_time,
            booking_status: 'pending',
            student_note: noteTrim
          }
        });
      } catch (txErr) {
        await connection.rollback().catch(() => {});
        throw txErr;
      } finally {
        connection.release();
      }
    } finally {
      if (lockAcquired) {
        try {
          await redis.del(lockKey);
        } catch (e) {
          console.warn('[Consultations] Redis lock release:', e?.message);
        }
      }
    }
  } catch (err) {
    console.error('[Consultations] Book:', err);
    res.status(500).json({ success: false, message: 'Failed to book slot' });
  }
});

// GET /api/consultations/my-bookings - Student sees own bookings
router.get('/consultations/my-bookings', auth, permit('Student', 'ManagerStudent', 'InstituteStudent'), async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT cb.*, cs.date, cs.start_time, cs.end_time, cs.duration_minutes
       FROM consultation_bookings cb
       JOIN consultation_slots cs ON cb.slot_id = cs.id
       WHERE cb.student_id = ?
       ORDER BY cs.date ASC, cs.start_time ASC`,
      [req.user.id]
    );
    res.json({ success: true, bookings: rows });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return res.json({ success: true, bookings: [] });
    console.error('[Consultations] My bookings:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch bookings' });
  }
});

// DELETE /api/consultations/my-bookings/:bookingId - Student cancels own booking (24hrs+ in future)
router.delete('/consultations/my-bookings/:bookingId', auth, permit('Student', 'ManagerStudent', 'InstituteStudent'), async (req, res) => {
  try {
    const bookingId = req.params.bookingId;
    const [bookings] = await pool.execute(
      `SELECT cb.*, cs.date, cs.start_time
       FROM consultation_bookings cb
       JOIN consultation_slots cs ON cb.slot_id = cs.id
       WHERE cb.id = ? AND cb.student_id = ? AND cb.status IN ('pending', 'confirmed')`,
      [bookingId, req.user.id]
    );
    if (!bookings.length) return res.status(404).json({ success: false, message: 'Booking not found' });
    const b = bookings[0];
    const workflowPending = b.booking_status === 'pending' || b.booking_status == null;
    if (!workflowPending) {
      const slotDateTime = new Date(`${b.date}T${b.start_time}`);
      const hoursUntil = (slotDateTime - new Date()) / (1000 * 60 * 60);
      if (hoursUntil < 24) {
        return res.status(400).json({ success: false, message: 'Cancellation must be at least 24 hours before the consultation' });
      }
    }
    if (b.zoom_meeting_id) {
      try { await deleteMeeting(b.zoom_meeting_id); } catch (e) { console.warn('[Consultations] Zoom delete:', e.message); }
    }
    await pool.execute('UPDATE consultation_bookings SET status = ? WHERE id = ?', ['cancelled', bookingId]);
    await pool.execute('UPDATE consultation_slots SET is_booked = 0 WHERE id = ?', [b.slot_id]);

    const studentName = req.user.name || 'Student';
    const dateStr = new Date(b.date).toLocaleDateString('en-GB');
    const timeStr = String(b.start_time).slice(0, 5);
    const staffIds = await getConsultationStaffNotificationUserIds();
    for (const staffId of staffIds) {
      await createNotification({
        userId: staffId,
        type: 'consultation_cancelled',
        title: 'Consultation Cancelled by Student',
        message: `${studentName} has cancelled their consultation on ${dateStr} at ${timeStr}`,
        relatedUserId: req.user.id,
        req
      });
    }

    const io = req.app?.get?.('io');
    if (io) {
      io.emit('consultation_cancelled', {
        slotId: b.slot_id,
        bookingId: Number(bookingId),
        studentName,
        date: b.date.toISOString ? b.date.toISOString().slice(0, 10) : String(b.date).slice(0, 10),
        startTime: timeStr
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[Consultations] Cancel my booking:', err);
    res.status(500).json({ success: false, message: 'Failed to cancel booking' });
  }
});

// PATCH /api/consultations/bookings/:bookingId/confirm — Admin / CM confirms pending request (creates Zoom)
router.patch('/consultations/bookings/:bookingId/confirm', auth, permit('Admin', 'Consultation Manager', 'Operation Manager'), async (req, res) => {
  const bookingId = req.params.bookingId;
  const tutor_note = req.body?.tutor_note != null ? String(req.body.tutor_note).trim() || null : null;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT cb.*, cs.date, cs.start_time, cs.end_time, cs.duration_minutes, u.name as student_name
       FROM consultation_bookings cb
       JOIN consultation_slots cs ON cs.id = cb.slot_id
       JOIN users u ON u.id = cb.student_id
       WHERE cb.id = ? AND cb.booking_status = 'pending' FOR UPDATE`,
      [bookingId]
    );
    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Booking not found or not pending confirmation' });
    }
    const b = rows[0];
    const studentName = b.student_name || 'Student';
    const durationMinutes = b.duration_minutes || 30;
    const dateStrRaw = formatSlotDate(b.date);
    const timeNorm = String(b.start_time).slice(0, 8).length >= 8
      ? String(b.start_time).slice(0, 8)
      : `${String(b.start_time).slice(0, 5)}:00`;
    const startDateTime = new Date(`${dateStrRaw}T${timeNorm}`);

    let zoomData = { meetingId: null, joinUrl: '', startUrl: '', password: '' };
    try {
      zoomData = await createMeeting(
        `Consultation with ${studentName}`,
        startDateTime,
        durationMinutes,
        studentName
      );
    } catch (e) {
      await connection.rollback();
      console.error('[Consultations] Zoom create (confirm):', e);
      return res.status(500).json({ success: false, message: 'Failed to create Zoom meeting. Check Zoom credentials.' });
    }

    await connection.execute(
      `UPDATE consultation_bookings SET
        booking_status = 'confirmed',
        status = 'confirmed',
        confirmed_at = NOW(),
        responded_by = ?,
        tutor_note = ?,
        zoom_meeting_id = ?,
        zoom_join_url = ?,
        zoom_start_url = ?,
        zoom_password = ?
       WHERE id = ? AND booking_status = 'pending'`,
      [
        req.user.id,
        tutor_note,
        zoomData.meetingId,
        zoomData.joinUrl,
        zoomData.startUrl,
        zoomData.password,
        bookingId
      ]
    );
    await connection.commit();

    const dateDisp = new Date(b.date).toLocaleDateString('en-GB');
    const timeDisp = String(b.start_time).slice(0, 5);
    const noteHtml = tutor_note ? ` ${tutor_note}` : '';
    await createNotification({
      userId: b.student_id,
      type: 'consultation_confirmed',
      title: '✅ Consultation Confirmed!',
      message: `Your consultation on ${dateDisp} at ${timeDisp} has been confirmed.${noteHtml}`,
      req
    });

    const io = req.app?.get?.('io');
    if (io) {
      io.to(`user_${b.student_id}`).emit('consultation_confirmed', {
        bookingId: Number(bookingId),
        date: dateStrRaw,
        time: timeDisp,
        zoom_join_url: zoomData.joinUrl,
        tutor_note: tutor_note || ''
      });
      emitConsultationStaffSockets(io, 'booking_confirmed', { bookingId: Number(bookingId) });
    }

    res.json({ success: true, message: 'Booking confirmed' });
  } catch (err) {
    await connection.rollback().catch(() => {});
    console.error('[Consultations] Confirm booking:', err);
    res.status(500).json({ success: false, message: 'Failed to confirm booking' });
  } finally {
    connection.release();
  }
});

// PATCH /api/consultations/bookings/:bookingId/deny
router.patch('/consultations/bookings/:bookingId/deny', auth, permit('Admin', 'Consultation Manager', 'Operation Manager'), async (req, res) => {
  const bookingId = req.params.bookingId;
  const tutor_note = req.body?.tutor_note != null ? String(req.body.tutor_note).trim() : '';
  if (!tutor_note) {
    return res.status(400).json({ success: false, error: 'Please provide a reason for denying' });
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT cb.*, cs.date, cs.start_time
       FROM consultation_bookings cb
       JOIN consultation_slots cs ON cs.id = cb.slot_id
       WHERE cb.id = ? AND cb.booking_status = 'pending' FOR UPDATE`,
      [bookingId]
    );
    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Booking not found or not pending' });
    }
    const b = rows[0];
    if (b.zoom_meeting_id) {
      try {
        await deleteMeeting(b.zoom_meeting_id);
      } catch (e) {
        console.warn('[Consultations] Zoom delete (deny):', e.message);
      }
    }
    await connection.execute(
      `UPDATE consultation_bookings SET
        booking_status = 'denied',
        status = 'cancelled',
        denied_at = NOW(),
        responded_by = ?,
        tutor_note = ?,
        zoom_meeting_id = NULL,
        zoom_join_url = NULL,
        zoom_start_url = NULL,
        zoom_password = NULL
       WHERE id = ?`,
      [req.user.id, tutor_note, bookingId]
    );
    await connection.execute('UPDATE consultation_slots SET is_booked = 0 WHERE id = ?', [b.slot_id]);
    await connection.commit();

    const dateDisp = new Date(b.date).toLocaleDateString('en-GB');
    const timeDisp = String(b.start_time).slice(0, 5);
    await createNotification({
      userId: b.student_id,
      type: 'consultation_denied',
      title: '❌ Consultation Request Denied',
      message: `Your consultation request for ${dateDisp} at ${timeDisp} was not confirmed. Reason: ${tutor_note} Please book another slot.`,
      req
    });

    const io = req.app?.get?.('io');
    if (io) {
      io.to(`user_${b.student_id}`).emit('consultation_denied', {
        bookingId: Number(bookingId),
        reason: tutor_note,
        slotId: b.slot_id
      });
      emitConsultationStaffSockets(io, 'booking_denied', { bookingId: Number(bookingId) });
    }

    res.json({ success: true });
  } catch (err) {
    await connection.rollback().catch(() => {});
    console.error('[Consultations] Deny booking:', err);
    res.status(500).json({ success: false, message: 'Failed to deny booking' });
  } finally {
    connection.release();
  }
});

// PATCH /api/consultations/bookings/:bookingId/reschedule — propose new date/time (slot row unchanged until applied)
router.patch('/consultations/bookings/:bookingId/reschedule', auth, permit('Admin', 'Consultation Manager', 'Operation Manager'), async (req, res) => {
  const bookingId = req.params.bookingId;
  const reschedule_date = req.body?.reschedule_date;
  const reschedule_time = req.body?.reschedule_time;
  const tutor_note = req.body?.tutor_note != null ? String(req.body.tutor_note).trim() : '';
  if (!reschedule_date || !reschedule_time || !tutor_note) {
    return res.status(400).json({
      success: false,
      message: 'reschedule_date, reschedule_time and tutor_note are required'
    });
  }
  const timeNorm = String(reschedule_time).slice(0, 5);
  try {
    const [rows] = await pool.execute(
      `SELECT cb.*, cs.date, cs.start_time
       FROM consultation_bookings cb
       JOIN consultation_slots cs ON cs.id = cb.slot_id
       WHERE cb.id = ? AND cb.booking_status = 'pending'`,
      [bookingId]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Booking not found or not pending' });
    }
    const b = rows[0];
    await pool.execute(
      `UPDATE consultation_bookings SET
        booking_status = 'rescheduled',
        reschedule_date = ?,
        reschedule_time = ?,
        tutor_note = ?,
        responded_by = ?
       WHERE id = ?`,
      [reschedule_date, `${timeNorm}:00`, tutor_note, req.user.id, bookingId]
    );

    await createNotification({
      userId: b.student_id,
      type: 'consultation_rescheduled',
      title: '📅 New Date Suggested',
      message: `Your consultation has been rescheduled to ${reschedule_date} at ${timeNorm}. Note: ${tutor_note} Please confirm or book a new slot.`,
      req
    });

    const io = req.app?.get?.('io');
    if (io) {
      io.to(`user_${b.student_id}`).emit('consultation_rescheduled', {
        bookingId: Number(bookingId),
        reschedule_date,
        reschedule_time: timeNorm,
        tutor_note
      });
      emitConsultationStaffSockets(io, 'booking_rescheduled', { bookingId: Number(bookingId) });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[Consultations] Reschedule booking:', err);
    res.status(500).json({ success: false, message: 'Failed to reschedule booking' });
  }
});

async function applyConsultationReschedule(connection, bookingId, responderId) {
  const [rows] = await connection.execute(
    `SELECT cb.*, cs.id as slot_id, cs.duration_minutes
     FROM consultation_bookings cb
     JOIN consultation_slots cs ON cs.id = cb.slot_id
     WHERE cb.id = ? AND cb.booking_status = 'rescheduled'
       AND cb.reschedule_date IS NOT NULL AND cb.reschedule_time IS NOT NULL FOR UPDATE`,
    [bookingId]
  );
  if (!rows.length) return { error: 'not_found' };
  const b = rows[0];
  const d = formatSlotDate(b.reschedule_date);
  const tRaw = String(b.reschedule_time);
  const t5 = tRaw.slice(0, 5);
  const durationMinutes = b.duration_minutes || 30;
  const end_time = addMinutesToTime(t5, durationMinutes);
  const startSql = tRaw.length >= 8 ? tRaw.slice(0, 8) : `${t5}:00`;

  await connection.execute(
    'UPDATE consultation_slots SET date = ?, start_time = ?, end_time = ? WHERE id = ?',
    [d, startSql, end_time, b.slot_id]
  );

  let zoomData = {
    meetingId: b.zoom_meeting_id,
    joinUrl: b.zoom_join_url,
    startUrl: b.zoom_start_url,
    password: b.zoom_password
  };
  if (b.zoom_meeting_id) {
    try {
      await deleteMeeting(b.zoom_meeting_id);
    } catch (e) {
      console.warn('[Consultations] Zoom delete (apply reschedule):', e.message);
    }
  }
  const [urows] = await connection.execute('SELECT name FROM users WHERE id = ?', [b.student_id]);
  const nameStr = urows[0]?.name || 'Student';
  const startDateTime = new Date(`${d}T${startSql.length >= 8 ? startSql.slice(0, 8) : `${t5}:00`}`);
  try {
    zoomData = await createMeeting(`Consultation with ${nameStr}`, startDateTime, durationMinutes, nameStr);
  } catch (e) {
    return { error: 'zoom', message: e.message };
  }

  await connection.execute(
    `UPDATE consultation_bookings SET
      booking_status = 'confirmed',
      status = 'confirmed',
      confirmed_at = NOW(),
      responded_by = COALESCE(?, responded_by),
      reschedule_date = NULL,
      reschedule_time = NULL,
      zoom_meeting_id = ?,
      zoom_join_url = ?,
      zoom_start_url = ?,
      zoom_password = ?
     WHERE id = ?`,
    [
      responderId,
      zoomData.meetingId,
      zoomData.joinUrl,
      zoomData.startUrl,
      zoomData.password,
      bookingId
    ]
  );

  return { ok: true, b, d, t5, zoomData };
}

// PATCH /api/consultations/bookings/:bookingId/confirm-reschedule — apply proposed slot time (staff)
router.patch(
  '/consultations/bookings/:bookingId/confirm-reschedule',
  auth,
  permit('Admin', 'Consultation Manager', 'Operation Manager'),
  async (req, res) => {
    const bookingId = req.params.bookingId;
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await applyConsultationReschedule(connection, bookingId, req.user.id);
      if (result.error === 'not_found') {
        await connection.rollback();
        return res.status(404).json({ success: false, message: 'Booking not found or not in rescheduled state' });
      }
      if (result.error === 'zoom') {
        await connection.rollback();
        return res.status(500).json({ success: false, message: 'Failed to create Zoom meeting. Check Zoom credentials.' });
      }
      await connection.commit();
      const { b, d, t5, zoomData } = result;
      const dateDisp = new Date(d).toLocaleDateString('en-GB');
      await createNotification({
        userId: b.student_id,
        type: 'consultation_confirmed',
        title: '✅ Consultation Confirmed!',
        message: `Your consultation is confirmed for ${dateDisp} at ${t5}. Join here: ${zoomData.joinUrl || ''}`,
        req
      });
      const io = req.app?.get?.('io');
      if (io) {
        io.to(`user_${b.student_id}`).emit('consultation_confirmed', {
          bookingId: Number(bookingId),
          date: d,
          time: t5,
          zoom_join_url: zoomData.joinUrl,
          tutor_note: ''
        });
        emitConsultationStaffSockets(io, 'booking_confirmed', { bookingId: Number(bookingId) });
      }
      res.json({ success: true, message: 'Reschedule applied and booking confirmed' });
    } catch (err) {
      await connection.rollback().catch(() => {});
      console.error('[Consultations] Confirm reschedule:', err);
      res.status(500).json({ success: false, message: 'Failed to confirm reschedule' });
    } finally {
      connection.release();
    }
  }
);

// PATCH /api/consultations/my-bookings/:bookingId/accept-reschedule — student accepts proposed time
router.patch(
  '/consultations/my-bookings/:bookingId/accept-reschedule',
  auth,
  permit('Student', 'ManagerStudent', 'InstituteStudent'),
  async (req, res) => {
    const bookingId = req.params.bookingId;
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [own] = await connection.execute(
        'SELECT id FROM consultation_bookings WHERE id = ? AND student_id = ? FOR UPDATE',
        [bookingId, req.user.id]
      );
      if (!own.length) {
        await connection.rollback();
        return res.status(404).json({ success: false, message: 'Booking not found' });
      }
      const result = await applyConsultationReschedule(connection, bookingId, null);
      if (result.error === 'not_found') {
        await connection.rollback();
        return res.status(404).json({ success: false, message: 'No pending reschedule to accept' });
      }
      if (result.error === 'zoom') {
        await connection.rollback();
        return res.status(500).json({ success: false, message: 'Failed to create Zoom meeting. Check Zoom credentials.' });
      }
      await connection.commit();
      const { b, d, t5, zoomData } = result;
      const dateDisp = new Date(d).toLocaleDateString('en-GB');
      await createNotification({
        userId: b.student_id,
        type: 'consultation_confirmed',
        title: '✅ Consultation Confirmed!',
        message: `Your consultation is confirmed for ${dateDisp} at ${t5}. Join here: ${zoomData.joinUrl || ''}`,
        req
      });
      const io = req.app?.get?.('io');
      if (io) {
        io.to(`user_${b.student_id}`).emit('consultation_confirmed', {
          bookingId: Number(bookingId),
          date: d,
          time: t5,
          zoom_join_url: zoomData.joinUrl,
          tutor_note: ''
        });
        emitConsultationStaffSockets(io, 'booking_confirmed', { bookingId: Number(bookingId) });
      }
      res.json({ success: true, message: 'Reschedule accepted' });
    } catch (err) {
      await connection.rollback().catch(() => {});
      console.error('[Consultations] Accept reschedule:', err);
      res.status(500).json({ success: false, message: 'Failed to accept reschedule' });
    } finally {
      connection.release();
    }
  }
);

module.exports = router;
