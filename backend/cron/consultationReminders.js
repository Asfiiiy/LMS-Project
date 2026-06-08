/**
 * Consultation reminders: 24h, 1h, 15min before start (Europe/London)
 */
const cron = require('node-cron');
const pool = require('../config/db');
const redis = require('../config/redis');
const { createNotification } = require('../utils/notificationHelper');

let isRunning = false;
let reminderEnumChecked = false;
const CONSULTATION_MANAGER_ROLE_ID = 15;
const ADMIN_ROLE_ID = 1;

async function ensureCompletedNotificationType() {
  try {
    const [cols] = await pool.execute(
      `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'type'`
    );
    if (!cols.length) return;
    const currentEnum = cols[0].COLUMN_TYPE || '';
    if (currentEnum.includes('consultation_completed')) return;
    const matches = currentEnum.match(/'([^']+)'/g) || [];
    const existing = matches.map((m) => m.slice(1, -1));
    const allTypes = [...new Set([...existing, 'consultation_completed'])];
    const enumList = allTypes.map((t) => `'${t}'`).join(', ');
    await pool.execute(`ALTER TABLE notifications MODIFY COLUMN type ENUM(${enumList}) NOT NULL`);
  } catch (e) {
    console.warn('[ConsultationReminders] consultation_completed ENUM:', e.message);
  }
}

async function autoCompleteExpiredBookings(io) {
  try {
    const [rows] = await pool.execute(
      `SELECT
        cb.id as booking_id,
        cb.student_id,
        cb.slot_id,
        cs.date,
        cs.start_time,
        cs.end_time,
        u.name as student_name
      FROM consultation_bookings cb
      JOIN consultation_slots cs ON cs.id = cb.slot_id
      JOIN users u ON u.id = cb.student_id
      WHERE cb.status = 'confirmed'
      AND (cb.booking_status = 'confirmed' OR cb.booking_status IS NULL)
      AND CONCAT(cs.date, ' ', cs.end_time) < NOW()`
    );
    if (!rows.length) return;

    await ensureCompletedNotificationType();

    let completed = 0;
    for (const row of rows) {
      const [upd] = await pool.execute(
        `UPDATE consultation_bookings SET status = 'completed' WHERE id = ? AND status = 'confirmed'
         AND (booking_status = 'confirmed' OR booking_status IS NULL)`,
        [row.booking_id]
      );
      if (!upd.affectedRows) continue;
      completed++;

      const dateStr = row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date).slice(0, 10);

      if (io) {
        io.emit('consultation_completed', {
          bookingId: row.booking_id,
          slotId: row.slot_id,
          studentId: row.student_id,
          studentName: row.student_name,
          date: dateStr,
          startTime: String(row.start_time).slice(0, 5),
          endTime: String(row.end_time).slice(0, 5),
          autoCompleted: true
        });
      }

      try {
        await createNotification({
          userId: row.student_id,
          type: 'consultation_completed',
          title: 'Consultation Completed',
          message: `Your consultation on ${dateStr} at ${String(row.start_time).slice(0, 5)} has been completed.`,
          req: io ? { app: { get: (k) => (k === 'io' ? io : undefined) } } : null
        });
      } catch (e) { /* non-fatal */ }
    }

    if (completed > 0 && process.env.NODE_ENV === 'development') {
      console.log(`[ConsultationReminders] Auto-completed ${completed} expired bookings`);
    }
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return;
    console.warn('[ConsultationReminders] autoComplete:', err.message);
  }
}

async function ensureConsultationReminderEnum() {
  if (reminderEnumChecked) return;
  try {
    const [cols] = await pool.execute(
      `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'type'`
    );
    if (!cols.length) return;
    const currentEnum = cols[0].COLUMN_TYPE || '';
    if (currentEnum.includes('consultation_reminder')) {
      reminderEnumChecked = true;
      return;
    }
    const matches = currentEnum.match(/'([^']+)'/g) || [];
    const existing = matches.map((m) => m.slice(1, -1));
    const allTypes = [...new Set([...existing, 'consultation_reminder'])];
    const enumList = allTypes.map((t) => `'${t}'`).join(', ');
    await pool.execute(`ALTER TABLE notifications MODIFY COLUMN type ENUM(${enumList}) NOT NULL`);
    reminderEnumChecked = true;
  } catch (e) {
    console.warn('[ConsultationReminders] ENUM migration:', e.message);
  }
}

/** Parse YYYY-MM-DD + time as instant in Europe/London → UTC ms */
function londonLocalToUtcMs(dateStr, timeStr) {
  const [Y, M, D] = dateStr.split('-').map(Number);
  const tt = String(timeStr).slice(0, 8);
  const padded = tt.length >= 8 ? tt : `${String(tt).slice(0, 5)}:00`;
  const [h, m, s] = padded.split(':').map((x) => Number(x) || 0);
  const target = { y: Y, mo: M, d: D, h, min: m, sec: s };

  function partsFor(ms) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).formatToParts(new Date(ms));
    const get = (p) => parts.find((x) => x.type === p)?.value;
    return {
      y: Number(get('year')),
      mo: Number(get('month')),
      d: Number(get('day')),
      h: Number(get('hour')),
      min: Number(get('minute')),
      sec: Number(get('second'))
    };
  }

  function cmp(a, b) {
    if (a.y !== b.y) return a.y - b.y;
    if (a.mo !== b.mo) return a.mo - b.mo;
    if (a.d !== b.d) return a.d - b.d;
    if (a.h !== b.h) return a.h - b.h;
    if (a.min !== b.min) return a.min - b.min;
    return a.sec - b.sec;
  }

  const anchor = Date.UTC(Y, M - 1, D, 12, 0, 0);
  for (let delta = -14 * 3600000; delta <= 14 * 3600000; delta += 60000) {
    const ms = anchor + delta;
    if (cmp(partsFor(ms), target) === 0) return ms;
  }
  return anchor;
}

function formatTimeLondon(dateStr, timeStr) {
  const ms = londonLocalToUtcMs(
    dateStr,
    String(timeStr).slice(0, 8).length >= 8 ? String(timeStr).slice(0, 8) : `${String(timeStr).slice(0, 5)}:00`
  );
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(new Date(ms));
}

async function sendConsultationReminders(io) {
  if (isRunning) return;
  isRunning = true;
  const fakeReq = io ? { app: { get: (k) => (k === 'io' ? io : undefined) } } : null;

  try {
    await ensureConsultationReminderEnum();

    let cmUserIds = [];
    let adminUserIds = [];
    try {
      const [staffRows] = await pool.execute(
        'SELECT id, role_id FROM users WHERE role_id IN (?, ?)',
        [CONSULTATION_MANAGER_ROLE_ID, ADMIN_ROLE_ID]
      );
      cmUserIds = (staffRows || []).filter((r) => Number(r.role_id) === CONSULTATION_MANAGER_ROLE_ID).map((r) => r.id);
      adminUserIds = (staffRows || []).filter((r) => Number(r.role_id) === ADMIN_ROLE_ID).map((r) => r.id);
    } catch (e) {
      cmUserIds = [];
      adminUserIds = [];
    }

    const [rows] = await pool.execute(
      `SELECT 
        cb.id as booking_id,
        cb.student_id,
        cb.zoom_join_url,
        cb.zoom_start_url,
        cb.zoom_meeting_id,
        cs.date,
        cs.start_time,
        cs.duration_minutes,
        u.name as student_name,
        u.email as student_email
      FROM consultation_bookings cb
      JOIN consultation_slots cs ON cs.id = cb.slot_id
      JOIN users u ON u.id = cb.student_id
      WHERE cb.status = 'confirmed'
      AND (cb.booking_status = 'confirmed' OR cb.booking_status IS NULL)
      AND cs.date >= CURDATE()
      ORDER BY cs.date ASC, cs.start_time ASC`
    );

    const nowMs = Date.now();

    for (const row of rows) {
      const dateStr = row.date.toISOString ? row.date.toISOString().slice(0, 10) : String(row.date).slice(0, 10);
      const timeStr = String(row.start_time).slice(0, 8);
      let startMs;
      try {
        startMs = londonLocalToUtcMs(dateStr, timeStr);
      } catch (e) {
        continue;
      }

      const minutesUntil = (startMs - nowMs) / (1000 * 60);

      const windows = [
        { type: '24h', min: 1439, max: 1441 },
        { type: '1h', min: 59, max: 61 },
        { type: '15min', min: 14, max: 16 },
        { type: '10min', min: 9, max: 11 }
      ];

      const timeLabel = formatTimeLondon(dateStr, row.start_time);

      for (const w of windows) {
        if (minutesUntil < w.min || minutesUntil > w.max) continue;

        const studentKey = `consultation_reminder:${row.booking_id}:${w.type}`;
        let studentAlreadySent = false;
        try {
          const exists = await redis.get(studentKey);
          if (exists) studentAlreadySent = true;
        } catch (e) {
          // proceed without dedup if Redis fails
        }

        if (!studentAlreadySent) {
          let title;
          let message;
          if (w.type === '24h') {
            title = 'Consultation Tomorrow';
            message = `Your video consultation is tomorrow at ${timeLabel}. Join link ready in your dashboard.`;
          } else if (w.type === '1h') {
            title = 'Consultation in 1 Hour';
            message = `Your video consultation starts in 1 hour at ${timeLabel}. Get ready!`;
          } else if (w.type === '15min') {
            title = 'Consultation Starting Soon!';
            message = `Your consultation starts in 15 minutes. Click to join now.`;
          } else {
            // 10min window
            title = '📅 Consultation Starting in 10 Minutes';
            message = `Your consultation starts in 10 minutes. Please join the call and wait for your tutor for up to 10 minutes if they are not immediately available.`;
          }

          await createNotification({
            userId: row.student_id,
            type: 'consultation_reminder',
            title,
            message,
            req: fakeReq
          });

          try {
            await redis.setex(studentKey, 86400 * 2, '1');
          } catch (e) {
            // non-fatal
          }

          if (io) {
            io.to(`user_${row.student_id}`).emit('consultation_reminder', {
              booking_id: row.booking_id,
              minutesUntil: Math.round(minutesUntil),
              reminderType: w.type,
              zoom_join_url: row.zoom_join_url || null
            });
          }
        }

        // CM reminders use a separate Redis key so staff still get alerts if student dedup already fired
        if (cmUserIds.length) {
          const cmKey = `consultation_reminder_cm:${row.booking_id}:${w.type}`;
          let cmAlreadySent = false;
          try {
            const cmExists = await redis.get(cmKey);
            if (cmExists) cmAlreadySent = true;
          } catch (e) {
            /* proceed */
          }
          if (!cmAlreadySent) {
            const cmTimeLabel =
              w.type === '24h' ? '24 hours'
                : w.type === '1h' ? '1 hour'
                : w.type === '15min' ? '15 minutes'
                : '10 minutes';
            const startDisp = String(row.start_time).slice(0, 5);
            for (const uid of cmUserIds) {
              await createNotification({
                userId: uid,
                type: 'consultation_reminder',
                title: `Upcoming call in ${cmTimeLabel}`,
                message: `${row.student_name} has a consultation in ${cmTimeLabel} at ${startDisp}`,
                req: fakeReq
              });
            }
            try {
              await redis.setex(cmKey, 86400 * 2, '1');
            } catch (e) {
              // non-fatal
            }
            if (io) {
              io.emit('consultation_reminder_cm', {
                booking_id: row.booking_id,
                student_name: row.student_name,
                start_time: row.start_time,
                minutesUntil: Math.round(minutesUntil),
                zoom_start_url: row.zoom_start_url || null
              });
            }
          }
        }

        if (adminUserIds.length) {
          const adminKey = `consultation_reminder_admin:${row.booking_id}:${w.type}`;
          let adminAlreadySent = false;
          try {
            const adminExists = await redis.get(adminKey);
            if (adminExists) adminAlreadySent = true;
          } catch (e) { /* proceed */ }
          if (!adminAlreadySent) {
            const adminTimeLabel =
              w.type === '24h' ? '24 hours'
                : w.type === '1h' ? '1 hour'
                : w.type === '15min' ? '15 minutes'
                : '10 minutes';
            const startDisp = String(row.start_time).slice(0, 5);
            for (const uid of adminUserIds) {
              await createNotification({
                userId: uid,
                type: 'consultation_reminder',
                title: `Consultation reminder: ${adminTimeLabel}`,
                message: `${row.student_name} has a booked consultation in ${adminTimeLabel} at ${startDisp}`,
                req: fakeReq
              });
            }
            try {
              await redis.setex(adminKey, 86400 * 2, '1');
            } catch (e) { /* non-fatal */ }
          }
        }
      }
    }
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE' || err.code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD') {
      return;
    }
    console.warn('[ConsultationReminders]', err.message);
  } finally {
    isRunning = false;
  }
}

function registerConsultationReminders(io) {
  cron.schedule('*/5 * * * *', async () => {
    await autoCompleteExpiredBookings(io);
    await sendConsultationReminders(io);
  });
}

module.exports = { registerConsultationReminders, sendConsultationReminders };
