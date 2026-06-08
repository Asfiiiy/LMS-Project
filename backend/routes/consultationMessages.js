/**
 * Consultation Messages — chat thread per consultation booking.
 * Both students and consultation staff (Admin / Consultation Manager / Operation Manager)
 * can post messages and file attachments scoped to a single booking.
 *
 * Tables: consultation_messages, consultation_message_files
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { Readable } = require('stream');
const cloudinary = require('../config/cloudinary');
const auth = require('../middleware/auth');
const pool = require('../config/db');

const STAFF_ROLES = ['Admin', 'Consultation Manager', 'Operation Manager'];
const STUDENT_ROLES = ['Student', 'ManagerStudent', 'InstituteStudent'];

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'text/plain',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`), false);
    }
  },
});

function uploadToCloudinary(buffer, originalName, bookingId) {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now();
    const uniqueSuffix = Math.random().toString(36).substring(2, 8);
    const dotIdx = originalName.lastIndexOf('.');
    const ext = dotIdx >= 0 ? originalName.slice(dotIdx) : '';
    const baseName = (dotIdx >= 0 ? originalName.slice(0, dotIdx) : originalName)
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 80);
    const publicId = `lms/consultation-messages/booking-${bookingId}/${baseName}_${timestamp}_${uniqueSuffix}${ext}`;

    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        resource_type: 'raw',
        type: 'upload',
        use_filename: false,
        unique_filename: false,
        overwrite: false,
        access_mode: 'public',
        invalidate: true,
        timeout: 120000,
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );

    Readable.from(buffer).pipe(stream);
  });
}

async function emitConsultationStaffSockets(io, event, payload) {
  if (!io) return;
  io.to('role_Admin').emit(event, payload);
  io.to('role_Consultation Manager').emit(event, payload);
  io.to('role_Operation Manager').emit(event, payload);
  io.to('admin_room').emit(event, payload);
}

/**
 * Look up the booking + verify the requester (student owner OR staff role) has access.
 * Returns the booking row, or null when access is denied / not found.
 */
async function loadBookingForUser(bookingId, user) {
  const [rows] = await pool.execute(
    `SELECT cb.id, cb.student_id, cb.slot_id, cb.status, cb.booking_status,
            cs.date, cs.start_time, cs.end_time
       FROM consultation_bookings cb
       JOIN consultation_slots cs ON cs.id = cb.slot_id
      WHERE cb.id = ?`,
    [bookingId]
  );
  if (!rows.length) return null;
  const booking = rows[0];
  const role = user?.role || '';
  const isOwner = Number(user?.id) === Number(booking.student_id);
  const isStaff = STAFF_ROLES.includes(role);
  if (!isOwner && !isStaff) return null;
  return { booking, isStaff, isOwner };
}

function isStudentRole(role) {
  return STUDENT_ROLES.includes(role);
}

/**
 * GET /api/consultation-messages/:bookingId
 * Return all messages (with attached files) for a booking.
 */
router.get('/:bookingId', auth, async (req, res) => {
  try {
    const bookingId = Number(req.params.bookingId);
    if (!Number.isFinite(bookingId) || bookingId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid booking id' });
    }
    const access = await loadBookingForUser(bookingId, req.user);
    if (!access) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const [messages] = await pool.execute(
      `SELECT cm.id, cm.booking_id, cm.sender_id, cm.sender_role, cm.body,
              cm.created_at, cm.updated_at,
              u.name AS sender_name, u.profile_picture, u.role_id
         FROM consultation_messages cm
         JOIN users u ON u.id = cm.sender_id
        WHERE cm.booking_id = ?
        ORDER BY cm.created_at ASC, cm.id ASC`,
      [bookingId]
    );

    let files = [];
    if (messages.length) {
      const ids = messages.map((m) => m.id);
      const placeholders = ids.map(() => '?').join(',');
      const [fileRows] = await pool.execute(
        `SELECT id, message_id, file_name, file_path, file_type, file_size, created_at
           FROM consultation_message_files
          WHERE message_id IN (${placeholders})
          ORDER BY id ASC`,
        ids
      );
      files = fileRows;
    }

    const result = messages.map((m) => ({
      ...m,
      files: files.filter((f) => f.message_id === m.id),
    }));

    res.json({ success: true, messages: result });
  } catch (err) {
    console.error('[ConsultationMessages] GET:', err);
    res.status(500).json({ success: false, message: 'Failed to load messages' });
  }
});

/**
 * POST /api/consultation-messages/:bookingId
 * Body: multipart/form-data with `body` (text) and `files` (0..10 attachments).
 * At least one of `body` or `files` must be present.
 */
router.post(
  '/:bookingId',
  auth,
  (req, res, next) => {
    upload.array('files', 10)(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ success: false, message: 'File too large (max 20MB)' });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ success: false, message: 'Too many files (max 10)' });
      }
      return res.status(400).json({ success: false, message: err.message || 'Upload error' });
    });
  },
  async (req, res) => {
    try {
      const bookingId = Number(req.params.bookingId);
      if (!Number.isFinite(bookingId) || bookingId <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid booking id' });
      }
      const role = req.user?.role || '';
      // Anyone outside the student/staff scope cannot post
      if (!STAFF_ROLES.includes(role) && !isStudentRole(role)) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      const access = await loadBookingForUser(bookingId, req.user);
      if (!access) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
      const { booking, isOwner } = access;

      const bodyRaw = typeof req.body?.body === 'string' ? req.body.body : '';
      const body = bodyRaw.trim();
      const files = Array.isArray(req.files) ? req.files : [];
      if (!body && files.length === 0) {
        return res.status(400).json({ success: false, message: 'Message text or at least one file is required' });
      }
      if (body.length > 4000) {
        return res.status(400).json({ success: false, message: 'Message too long (max 4000 chars)' });
      }

      const senderRole = isOwner ? 'student' : 'staff';

      const connection = await pool.getConnection();
      let messageId;
      const uploadedFiles = [];
      try {
        await connection.beginTransaction();

        const [insMsg] = await connection.execute(
          `INSERT INTO consultation_messages (booking_id, sender_id, sender_role, body)
           VALUES (?, ?, ?, ?)`,
          [bookingId, req.user.id, senderRole, body]
        );
        messageId = insMsg.insertId;

        for (const file of files) {
          let cloudResult;
          try {
            cloudResult = await uploadToCloudinary(file.buffer, file.originalname, bookingId);
          } catch (e) {
            console.error('[ConsultationMessages] Cloudinary upload failed:', e.message);
            throw new Error(`Failed to upload file: ${file.originalname}`);
          }
          await connection.execute(
            `INSERT INTO consultation_message_files
              (message_id, file_name, file_path, file_type, file_size)
             VALUES (?, ?, ?, ?, ?)`,
            [messageId, file.originalname, cloudResult.secure_url, file.mimetype, file.size]
          );
          uploadedFiles.push({
            file_name: file.originalname,
            file_path: cloudResult.secure_url,
            file_type: file.mimetype,
            file_size: file.size,
          });
        }

        await connection.commit();
      } catch (txErr) {
        await connection.rollback().catch(() => {});
        throw txErr;
      } finally {
        connection.release();
      }

      const [senderRows] = await pool.execute(
        'SELECT id, name AS sender_name, profile_picture, role_id FROM users WHERE id = ?',
        [req.user.id]
      );
      const sender = senderRows[0] || {};

      const fullMessage = {
        id: messageId,
        booking_id: bookingId,
        sender_id: req.user.id,
        sender_role: senderRole,
        body,
        created_at: new Date(),
        sender_name: sender.sender_name || req.user.name || '',
        profile_picture: sender.profile_picture || null,
        role_id: sender.role_id || null,
        files: uploadedFiles,
      };

      const io = req.app?.get?.('io');
      if (io) {
        io.to(`user_${booking.student_id}`).emit('consultation_message_new', {
          bookingId,
          message: fullMessage,
        });
        await emitConsultationStaffSockets(io, 'consultation_message_new', {
          bookingId,
          message: fullMessage,
        });
      }

      res.status(201).json({ success: true, message: fullMessage });
    } catch (err) {
      console.error('[ConsultationMessages] POST:', err);
      res.status(500).json({ success: false, message: err.message || 'Failed to send message' });
    }
  }
);

module.exports = router;
