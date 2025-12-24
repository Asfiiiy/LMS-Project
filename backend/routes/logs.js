// backend/routes/logs.js
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { permit } = require('../middleware/roles');
const logger = require('../config/logger');
const PDFDocument = require('pdfkit');
const { getRoleName } = require('../utils/eventLogger');

// =============================================
// GET /api/admin/logs
// Query params:
//   page (default 1)
//   limit (default 50, max 200)
//   user_id (optional)
//   role (optional)
//   action (optional, partial match via LIKE)
//   endpoint (optional, partial match)
//   date_from (optional) – ISO date string
//   date_to (optional)   – ISO date string
//   range (optional enum: 'today','week','month')
//   format (optional: 'json' | 'csv')
// =============================================
router.get('/', auth, permit('Admin'), async (req, res) => {
  try {
    let {
      page = 1,
      limit = 50,
      user_id,
      role,
      action,
      endpoint,
      service,
      courseId,
      studentId,
      date_from,
      date_to,
      range,
      format = 'json'
    } = req.query;

    // Ensure limit and offset are always valid integers
    const finalLimit = Math.max(1, Math.min(500, parseInt(limit, 10) || 50));
    const finalPage = Math.max(1, parseInt(page, 10) || 1);
    const finalOffset = Math.max(0, (finalPage - 1) * finalLimit);

    const whereClauses = [];
    const params = [];

    // ----- Date range handling -----
    if (date_from && date_to) {
      // Custom date range (overrides range)
      whereClauses.push('DATE(sl.created_at) BETWEEN ? AND ?');
      params.push(date_from, date_to);
    } else if (range) {
      // Predefined ranges
      switch (range) {
        case 'today':
          whereClauses.push('DATE(sl.created_at) = CURDATE()');
          break;
        case 'week':
          whereClauses.push('sl.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)');
          break;
        case 'month':
          whereClauses.push('sl.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)');
          break;
      }
    }

    // ----- Other filters -----
    if (user_id) {
      whereClauses.push('sl.user_id = ?');
      params.push(user_id);
    }

    if (role) {
      whereClauses.push('LOWER(sl.role) = LOWER(?)');
      params.push(role);
    }

    if (action) {
      whereClauses.push('sl.action LIKE ?');
      params.push(`%${action}%`);
    }

    if (endpoint) {
      whereClauses.push('sl.endpoint LIKE ?');
      params.push(`%${endpoint}%`);
    }

    // Search in description
    if (req.query.search) {
      whereClauses.push('sl.description LIKE ?');
      params.push(`%${req.query.search}%`);
    }

    // New filters: service, courseId, studentId
    if (service) {
      whereClauses.push('sl.service = ?');
      params.push(service);
    }

    if (courseId) {
      whereClauses.push('sl.course_id = ?');
      params.push(parseInt(courseId, 10));
    }

    if (studentId) {
      const studentIdInt = parseInt(studentId, 10);
      // Filter by student_id OR user_id (when student is the actor) OR description contains student info
      whereClauses.push('(sl.student_id = ? OR sl.user_id = ?)');
      params.push(studentIdInt, studentIdInt);
    }

    const whereSQL = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';

    // Count total
    const [countRows] = await pool.execute(
      `SELECT COUNT(*) AS total FROM system_logs sl ${whereSQL}`,
      params
    );
    const total = countRows[0].total || 0;

    // Fetch rows with user names and new columns
    // Use COALESCE to provide defaults for old logs with NULL service/role
    // Map role_id to role name for users without role in log
    let query = `SELECT 
        sl.id,
        sl.user_id,
        u.name as user_name,
        COALESCE(
          sl.role,
          CASE 
            WHEN sl.user_id IS NULL THEN 'system'
            WHEN u.role_id = 1 THEN 'admin'
            WHEN u.role_id = 2 THEN 'tutor'
            WHEN u.role_id = 3 THEN 'manager'
            WHEN u.role_id = 4 THEN 'student'
            WHEN u.role_id = 5 THEN 'moderator'
            ELSE NULL
          END
        ) as role,
        sl.action,
        sl.description,
        sl.ip_address,
        sl.country_code,
        sl.country_name,
        COALESCE(sl.service, 'system') as service,
        sl.course_id,
        sl.student_id,
        sl.endpoint,
        sl.method,
        sl.created_at
       FROM system_logs sl
       LEFT JOIN users u ON sl.user_id = u.id
       ${whereSQL}
       ORDER BY sl.created_at DESC
       LIMIT ? OFFSET ?`;
    
    // MySQL LIMIT/OFFSET can be problematic with prepared statements
    // Use template literals for LIMIT/OFFSET to avoid parameter binding issues
    const queryWithLimit = query.replace('LIMIT ? OFFSET ?', `LIMIT ${finalLimit} OFFSET ${finalOffset}`);
    
    const [rows] = await pool.execute(queryWithLimit, params);

    // CSV export
    if (format === 'csv') {
      const header = [
        'id',
        'user_id',
        'user_name',
        'role',
        'action',
        'description',
        'ip_address',
        'country_code',
        'country_name',
        'service',
        'course_id',
        'student_id',
        'endpoint',
        'method',
        'created_at'
      ];

      const escapeCSV = (value) => {
        if (value == null) return '';
        const str = String(value).replace(/"/g, '""');
        return `"${str}"`;
      };

      const csvLines = [];
      csvLines.push(header.join(','));

      for (const row of rows) {
        csvLines.push(
          header
            .map((col) => escapeCSV(row[col]))
            .join(',')
        );
      }

      const csvContent = csvLines.join('\n');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      
      // Log export to log_exports table
      setImmediate(async () => {
        try {
          await pool.execute(
            `INSERT INTO log_exports (admin_id, exported_rows, filter_used, exported_at)
             VALUES (?, ?, ?, NOW())`,
            [req.user?.id || null, rows.length, JSON.stringify(req.query || {})]
          );
        } catch (err) {
          logger.error({ error: err.message }, '[LOGS] Failed to record export');
        }
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="logs_${timestamp}.csv"`
      );
      return res.send(csvContent);
    }

    // PDF export
    if (format === 'pdf') {
      // Limit PDF export to 2000 rows for safety
      const maxRows = Math.min(rows.length, 2000);
      const pdfRows = rows.slice(0, maxRows);

      // Create PDF document
      const doc = new PDFDocument({ margin: 50 });
      const filename = `logs_export_${Date.now()}.pdf`;

      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      // Pipe PDF to response
      doc.pipe(res);

      // PDF Header
      doc.fontSize(20).text('LMS System Logs Export', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
      doc.text(`Total Records: ${maxRows}${rows.length > maxRows ? ` (showing first ${maxRows} of ${rows.length})` : ''}`, { align: 'center' });
      doc.moveDown();

      // Add filter info if any filters applied
      const filterInfo = [];
      if (service) filterInfo.push(`Service: ${service}`);
      if (courseId) filterInfo.push(`Course ID: ${courseId}`);
      if (studentId) filterInfo.push(`Student ID: ${studentId}`);
      if (role) filterInfo.push(`Role: ${role}`);
      if (range) filterInfo.push(`Date Range: ${range}`);
      if (date_from && date_to) filterInfo.push(`Custom Range: ${date_from} to ${date_to}`);

      if (filterInfo.length > 0) {
        doc.fontSize(10).text('Filters Applied:', { underline: true });
        filterInfo.forEach(info => doc.text(`  • ${info}`, { indent: 20 }));
        doc.moveDown();
      }

      // Table headers
      const tableTop = doc.y;
      const colWidths = [40, 60, 80, 50, 100, 150, 60, 50, 60, 50, 50, 50, 100, 50, 80];
      const headers = ['ID', 'User ID', 'User', 'Role', 'Action', 'Description', 'IP', 'Country', 'Service', 'Course', 'Student', 'Endpoint', 'Method', 'Date'];
      
      let x = 50;
      doc.fontSize(8).font('Helvetica-Bold');
      headers.forEach((header, i) => {
        doc.text(header, x, tableTop, { width: colWidths[i], align: 'left' });
        x += colWidths[i];
      });

      // Table rows
      let y = tableTop + 20;
      doc.font('Helvetica').fontSize(7);
      
      pdfRows.forEach((row, idx) => {
        // Check if we need a new page
        if (y > 750) {
          doc.addPage();
          y = 50;
        }

        const rowData = [
          row.id?.toString() || '',
          row.user_id?.toString() || '',
          (row.user_name || '').substring(0, 15),
          (row.role || '').substring(0, 10),
          (row.action || '').substring(0, 20),
          (row.description || '').substring(0, 30),
          (row.ip_address || '').substring(0, 15),
          (row.country_code || '').substring(0, 10),
          (row.service || '').substring(0, 10),
          row.course_id?.toString() || '',
          row.student_id?.toString() || '',
          (row.endpoint || '').substring(0, 20),
          row.method || '',
          new Date(row.created_at).toLocaleDateString()
        ];

        x = 50;
        rowData.forEach((cell, i) => {
          doc.text(cell, x, y, { width: colWidths[i], align: 'left' });
          x += colWidths[i];
        });

        y += 15;
      });

      // Footer
      doc.fontSize(8).text(
        `Page ${doc.page.number} - Exported by ${req.user?.name || 'Admin'} on ${new Date().toLocaleString()}`,
        50,
        doc.page.height - 50,
        { align: 'center' }
      );

      // Finalize PDF
      doc.end();

      // Log export
      const adminId = req.user?.id || null;
      const userRole = req.user?.role_id ? getRoleName(req.user.role_id) : null;
      setImmediate(async () => {
        try {
          await pool.execute(
            `INSERT INTO log_exports (admin_id, exported_rows, filter_used, exported_at)
             VALUES (?, ?, ?, NOW())`,
            [adminId, maxRows, JSON.stringify(req.query || {})]
          );
        } catch (err) {
          logger.error({ error: err.message }, '[LOGS] Failed to record PDF export');
        }
      });

      return; // Response is handled by PDF stream
    }

    // JSON response
    res.json({
      success: true,
      data: rows,
      pagination: {
        page: finalPage,
        limit: finalLimit,
        total,
        totalPages: Math.ceil(total / finalLimit)
      }
    });
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, '[LOGS] Error fetching logs');
    res.status(500).json({
      success: false,
      message: 'Error fetching logs'
    });
  }
});

// ===================================================
// POST /api/admin/logs/presets
// Save a filter preset
// ===================================================
router.post('/presets', auth, permit('Admin'), async (req, res) => {
  try {
    const { preset_name, filters } = req.body;
    const admin_id = req.user.id;

    if (!preset_name || !filters) {
      return res.status(400).json({ success: false, message: 'Preset name and filters are required.' });
    }

    const [result] = await pool.execute(
      `INSERT INTO log_filter_presets (admin_id, preset_name, filters, created_at) VALUES (?, ?, ?, NOW())`,
      [admin_id, preset_name, JSON.stringify(filters)]
    );

    res.json({ success: true, message: 'Filter preset saved successfully.', presetId: result.insertId });
  } catch (err) {
    logger.error({ error: err.message }, '[LOGS] Error saving log filter preset');
    res.status(500).json({ success: false, message: 'Error saving filter preset', error: err.message });
  }
});

// ===================================================
// GET /api/admin/logs/presets
// Get all filter presets for the current admin
// ===================================================
router.get('/presets', auth, permit('Admin'), async (req, res) => {
  try {
    const admin_id = req.user.id;
    const [presets] = await pool.execute(
      `SELECT id, preset_name, filters, created_at FROM log_filter_presets WHERE admin_id = ? ORDER BY created_at DESC`,
      [admin_id]
    );
    
    // Parse JSON filters
    const parsedPresets = presets.map(p => ({
      ...p,
      filters: typeof p.filters === 'string' ? JSON.parse(p.filters) : p.filters
    }));
    
    res.json({ success: true, presets: parsedPresets });
  } catch (err) {
    logger.error({ error: err.message }, '[LOGS] Error fetching log filter presets');
    res.status(500).json({ success: false, message: 'Error fetching filter presets', error: err.message });
  }
});

// ===================================================
// DELETE /api/admin/logs/presets/:id
// Delete a filter preset
// ===================================================
router.delete('/presets/:id', auth, permit('Admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const admin_id = req.user.id;

    const [result] = await pool.execute(
      `DELETE FROM log_filter_presets WHERE id = ? AND admin_id = ?`,
      [id, admin_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Preset not found or not authorized.' });
    }

    res.json({ success: true, message: 'Filter preset deleted successfully.' });
  } catch (err) {
    logger.error({ error: err.message }, '[LOGS] Error deleting log filter preset');
    res.status(500).json({ success: false, message: 'Error deleting filter preset', error: err.message });
  }
});

// ===================================================
// GET /api/admin/logs/exports
// Get export history for the current admin
// ===================================================
router.get('/exports', auth, permit('Admin'), async (req, res) => {
  try {
    const admin_id = req.user.id;
    const { page = 1, limit = 50 } = req.query;
    
    // Ensure limit and offset are always valid integers
    const finalLimit = Math.max(1, Math.min(500, parseInt(limit, 10) || 50));
    const finalPage = Math.max(1, parseInt(page, 10) || 1);
    const finalOffset = Math.max(0, (finalPage - 1) * finalLimit);

    // MySQL LIMIT/OFFSET can be problematic with prepared statements
    // Use template literals for LIMIT/OFFSET to avoid parameter binding issues
    const query = `SELECT id, exported_rows, filter_used, exported_at 
       FROM log_exports 
       WHERE admin_id = ? 
       ORDER BY exported_at DESC 
       LIMIT ${finalLimit} OFFSET ${finalOffset}`;
    
    const [exports] = await pool.execute(query, [admin_id]);

    // Parse JSON filter_used
    const parsedExports = exports.map(e => ({
      ...e,
      filter_used: typeof e.filter_used === 'string' ? JSON.parse(e.filter_used) : e.filter_used
    }));

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) AS total FROM log_exports WHERE admin_id = ?`,
      [admin_id]
    );
    const total = countRows[0].total || 0;

    res.json({
      success: true,
      exports: parsedExports,
      pagination: {
        page: finalPage,
        limit: finalLimit,
        total,
        totalPages: Math.ceil(total / finalLimit)
      }
    });
  } catch (err) {
    logger.error({ error: err.message }, '[LOGS] Error fetching export history');
    res.status(500).json({ success: false, message: 'Error fetching export history', error: err.message });
  }
});

module.exports = router;
