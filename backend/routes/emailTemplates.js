const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { permit } = require('../middleware/roles');
const { sendEmail, replaceTemplateVars, testEmailConnection } = require('../services/emailService');
const { insertEmailSendLog, lmsBaseUrl } = require('../services/studentVerificationEmail');

router.use(auth);
router.use(permit('Admin'));

function parseVariablesJson(raw) {
  if (!raw || typeof raw !== 'string') return [];
  try {
    const j = JSON.parse(raw);
    return Array.isArray(j) ? j : [];
  } catch {
    return [];
  }
}

function slugFromDisplayName(displayName) {
  let s = String(displayName || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
  if (!s) s = `template_${Date.now()}`;
  return s.substring(0, 100);
}

async function ensureUniqueName(baseName) {
  let name = baseName;
  let n = 0;
  while (n < 50) {
    const [rows] = await pool.execute('SELECT id FROM email_templates WHERE name = ?', [name]);
    if (!rows.length) return name;
    n += 1;
    name = `${baseName}_${n}`;
  }
  return `${baseName}_${Date.now()}`;
}

function buildVarsForUser(userRow, extra = {}) {
  const lmsUrl = lmsBaseUrl();
  const emailBody = extra.email_body != null ? String(extra.email_body) : '';
  const rest = { ...extra };
  delete rest.email_body;
  return {
    student_name: userRow.name || '',
    student_email: userRow.email || '',
    learner_id: userRow.learner_id || '',
    lms_url: lmsUrl,
    LMS_URL: lmsUrl,
    email_body: emailBody,
    ...rest
  };
}

/** Additional message from send modal (snake_case, camelCase, or top-level email_body). */
function pickAdditionalEmailBody(body) {
  if (!body || typeof body !== 'object') return null;
  const tryVal = (v) => {
    if (v == null) return null;
    const s = String(v);
    return s.trim() === '' ? null : s;
  };
  let fromExtra = null;
  if (body.extra_variables && typeof body.extra_variables === 'object') {
    fromExtra = tryVal(body.extra_variables.email_body);
  }
  return (
    tryVal(body.additional_message) ||
    tryVal(body.additionalMessage) ||
    tryVal(body.email_body) ||
    tryVal(body.emailBody) ||
    fromExtra
  );
}

function smtpFromLines() {
  const fromLabel = process.env.SMTP_FROM_NAME || 'Admissions | Inspire London College';
  const fromEmail =
    process.env.SMTP_FROM || process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || '';
  return { fromLabel, fromEmail };
}

/** mysql2 may return Buffer for TEXT/BLOB; JSON.stringify turns that into {type,data} and breaks admin iframe srcDoc. */
function coerceSqlUtf8(val) {
  if (val == null) return null;
  if (Buffer.isBuffer(val)) return val.toString('utf8');
  return String(val);
}

function mapNumericLogRow(row) {
  if (!row) return row;
  return {
    ...row,
    id: row.id != null ? Number(row.id) : row.id,
    template_id: row.template_id != null ? Number(row.template_id) : row.template_id,
    sent_to_user_id: row.sent_to_user_id != null ? Number(row.sent_to_user_id) : row.sent_to_user_id,
    sent_by: row.sent_by != null ? Number(row.sent_by) : row.sent_by,
    body: coerceSqlUtf8(row.body),
    additional_message: row.additional_message == null ? null : coerceSqlUtf8(row.additional_message)
  };
}

async function fetchGlobalLogStats(pool) {
  const [statRows] = await pool.execute(
    `SELECT 
      COUNT(*) AS total_all,
      SUM(CASE WHEN DATE(sent_at) = CURDATE() THEN 1 ELSE 0 END) AS sent_today,
      SUM(CASE WHEN sent_at >= DATE_FORMAT(NOW(), '%Y-%m-01')
        AND sent_at < DATE_ADD(DATE_FORMAT(NOW(), '%Y-%m-01'), INTERVAL 1 MONTH) THEN 1 ELSE 0 END) AS sent_this_month,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS total_failed
    FROM email_send_logs`
  );
  const s = statRows[0] || {};
  return {
    total_all: Number(s.total_all ?? 0),
    sent_today: Number(s.sent_today ?? 0),
    sent_this_month: Number(s.sent_this_month ?? 0),
    total_failed: Number(s.total_failed ?? 0)
  };
}

function appendLogDateFilter(dateFilter, where) {
  const df = dateFilter && String(dateFilter).trim();
  if (!df || df === 'all') return;
  if (df === 'today') {
    where.push('DATE(esl.sent_at) = CURDATE()');
    return;
  }
  if (df === 'week') {
    where.push('YEARWEEK(esl.sent_at, 1) = YEARWEEK(CURDATE(), 1)');
    return;
  }
  if (df === 'month') {
    where.push("esl.sent_at >= DATE_FORMAT(NOW(), '%Y-%m-01')");
    where.push("esl.sent_at < DATE_ADD(DATE_FORMAT(NOW(), '%Y-%m-01'), INTERVAL 1 MONTH)");
    return;
  }
  if (df === 'last_month') {
    where.push("esl.sent_at >= DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 MONTH), '%Y-%m-01')");
    where.push("esl.sent_at < DATE_FORMAT(NOW(), '%Y-%m-01')");
  }
}

/**
 * Stored body on the log row, or rebuild from template + recipient (for legacy rows / no body column).
 * If stored HTML still contains {{email_body}}, merge log.additional_message (modal must not show raw placeholders).
 */
async function resolveLogBodyHtml(pool, log) {
  let userLike = null;
  if (log.sent_to_user_id) {
    const [uRows] = await pool.execute(
      'SELECT id, name, email, learner_id FROM users WHERE id = ?',
      [log.sent_to_user_id]
    );
    if (uRows.length) userLike = uRows[0];
  }
  if (!userLike) {
    userLike = {
      name: log.sent_to_name || '',
      email: log.sent_to_email || '',
      learner_id: ''
    };
  }
  const extra = {};
  const addMsg = coerceSqlUtf8(log.additional_message);
  if (addMsg != null && addMsg.trim()) {
    extra.email_body = addMsg;
  }
  const vars = buildVarsForUser(userLike, extra);

  const storedRaw = coerceSqlUtf8(log.body);
  const stored = storedRaw != null && storedRaw.trim() ? storedRaw : '';
  if (stored) {
    if (!/\{\{\s*email_body\s*\}\}/i.test(stored)) {
      return stored;
    }
    return replaceTemplateVars(stored, vars);
  }

  if (!log.template_id) return null;
  const [tRows] = await pool.execute('SELECT body FROM email_templates WHERE id = ?', [log.template_id]);
  if (!tRows.length) return null;
  return replaceTemplateVars(tRows[0].body, vars);
}

async function buildHtmlForResend(pool, log) {
  return resolveLogBodyHtml(pool, log);
}

// GET /api/email-templates
router.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT et.*, u.name AS created_by_name
       FROM email_templates et
       LEFT JOIN users u ON u.id = et.created_by
       ORDER BY et.category, et.display_name ASC`
    );
    const templates = rows.map((t) => ({
      ...t,
      variables_parsed: parseVariablesJson(t.variables)
    }));
    res.json({ success: true, templates });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load templates' });
  }
});

// GET /api/email-templates/logs/stats — must be registered before /logs/:logId
router.get('/logs/stats', async (_req, res) => {
  try {
    const stats = await fetchGlobalLogStats(pool);
    const { fromLabel, fromEmail } = smtpFromLines();
    res.json({
      success: true,
      stats,
      smtp_from: { label: fromLabel, email: fromEmail }
    });
  } catch (err) {
    console.error('[email-templates/logs/stats]', err);
    res.status(500).json({ success: false, message: 'Failed to load stats' });
  }
});

// GET /api/email-templates/test-smtp — verify SMTP (Admin only)
router.get('/test-smtp', async (_req, res) => {
  try {
    const result = await testEmailConnection();
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/email-templates/logs
router.get('/logs', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const templateId = req.query.template_id ? parseInt(req.query.template_id, 10) : null;
    const status = req.query.status && ['sent', 'failed', 'pending'].includes(req.query.status) ? req.query.status : null;
    const search = req.query.search ? String(req.query.search).trim() : '';
    const from = req.query.from ? String(req.query.from).trim() : '';
    const to = req.query.to ? String(req.query.to).trim() : '';
    const dateFilter = req.query.date_filter ? String(req.query.date_filter).trim() : 'all';
    const sentByFilter = req.query.sent_by ? parseInt(req.query.sent_by, 10) : null;

    const where = [];
    const params = [];
    if (templateId) {
      where.push('esl.template_id = ?');
      params.push(templateId);
    }
    if (status) {
      where.push('esl.status = ?');
      params.push(status);
    }
    if (search) {
      where.push('(esl.sent_to_email LIKE ? OR esl.sent_to_name LIKE ? OR esl.subject LIKE ?)');
      const q = `%${search}%`;
      params.push(q, q, q);
    }
    if (from) {
      where.push('esl.sent_at >= ?');
      params.push(from);
    }
    if (to) {
      where.push('esl.sent_at < DATE_ADD(?, INTERVAL 1 DAY)');
      params.push(to);
    }
    appendLogDateFilter(dateFilter, where);
    if (sentByFilter) {
      where.push('esl.sent_by = ?');
      params.push(sentByFilter);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const safeLimit = Math.min(100, Math.max(1, Math.floor(Number(limit)) || 20));
    const safeOffset = Math.max(0, Math.floor(Number(offset)) || 0);

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) AS c FROM email_send_logs esl ${whereSql}`,
      params
    );
    const total = Number(countRows[0]?.c ?? 0);

    const listSql = `
      SELECT esl.id, esl.template_id, esl.template_name, esl.sent_to_email, esl.sent_to_name,
        esl.sent_to_user_id, esl.subject, esl.status, esl.error_message, esl.sent_by, esl.sent_at,
        et.display_name AS template_display_name, et.category AS template_category,
        sender.name AS sent_by_name, r.name AS sent_by_role_name
      FROM email_send_logs esl
      LEFT JOIN email_templates et ON et.id = esl.template_id
      LEFT JOIN users sender ON sender.id = esl.sent_by
      LEFT JOIN roles r ON r.id = sender.role_id
      ${whereSql}
      ORDER BY esl.sent_at DESC
      LIMIT ${safeLimit} OFFSET ${safeOffset}`;

    const [logs] = await pool.query(listSql, params);

    const stats = await fetchGlobalLogStats(pool);
    const totalPages = total === 0 ? 1 : Math.ceil(total / safeLimit);

    const safeLogs = (logs || []).map((row) => mapNumericLogRow(row));

    res.json({
      success: true,
      logs: safeLogs,
      total,
      page,
      limit: safeLimit,
      totalPages,
      stats,
      sentThisMonth: stats.sent_this_month
    });
  } catch (err) {
    console.error('[email-templates/logs]', err);
    res.status(500).json({ success: false, message: 'Failed to load logs' });
  }
});

// POST /api/email-templates/logs/:logId/resend
router.post('/logs/:logId/resend', async (req, res) => {
  try {
    const logId = parseInt(req.params.logId, 10);
    if (!logId) {
      return res.status(400).json({ success: false, message: 'Invalid log id' });
    }
    const [rows] = await pool.execute('SELECT * FROM email_send_logs WHERE id = ?', [logId]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Log not found' });
    }
    const log = rows[0];
    const html = await buildHtmlForResend(pool, log);
    if (!html || !String(html).trim()) {
      return res.status(400).json({
        success: false,
        message: 'No email body stored and could not rebuild from template'
      });
    }
    const subject = log.subject;
    const out = await sendEmail({ to: log.sent_to_email, subject, html });
    const ok = !!out.success;
    const sentBy = req.user?.id || null;
      await insertEmailSendLog(pool, {
        template_id: log.template_id,
        template_name: log.template_name,
        sent_to_email: log.sent_to_email,
        sent_to_name: log.sent_to_name,
        sent_to_user_id: log.sent_to_user_id,
        subject,
        body: html,
        additional_message: log.additional_message != null ? String(log.additional_message) : null,
        status: ok ? 'sent' : 'failed',
        error_message: ok ? null : out.error || 'Send failed',
        sent_by: sentBy
      });
    if (!ok) {
      return res.status(502).json({ success: false, message: out.error || 'Resend failed' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[email-templates/logs/resend]', err);
    res.status(500).json({ success: false, message: 'Resend failed' });
  }
});

// GET /api/email-templates/logs/:logId — full log including body (for View modal)
router.get('/logs/:logId', async (req, res) => {
  try {
    const logId = parseInt(req.params.logId, 10);
    if (!logId) {
      return res.status(400).json({ success: false, message: 'Invalid log id' });
    }
    const [rows] = await pool.query(
      `SELECT esl.*, et.display_name AS template_display_name, et.category AS template_category,
        sender.name AS sent_by_name, r.name AS sent_by_role_name
       FROM email_send_logs esl
       LEFT JOIN email_templates et ON et.id = esl.template_id
       LEFT JOIN users sender ON sender.id = esl.sent_by
       LEFT JOIN roles r ON r.id = sender.role_id
       WHERE esl.id = ?`,
      [logId]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Log not found' });
    }
    const raw = rows[0];
    const resolvedHtml = await resolveLogBodyHtml(pool, raw);
    const rawBodyStr = coerceSqlUtf8(raw.body);
    const bodyOut =
      resolvedHtml != null && String(resolvedHtml).trim() !== ''
        ? String(resolvedHtml)
        : rawBodyStr != null && rawBodyStr.trim() !== ''
          ? rawBodyStr
          : null;
    const merged = {
      ...raw,
      body: bodyOut
    };
    // TEMP: remove after Send History View debugging
    console.log('[LOG DETAIL] body length:', resolvedHtml?.length);
    console.log('[LOG DETAIL] body preview:', resolvedHtml?.substring(0, 200));
    console.log('[LOG DETAIL] additional_message:', raw.additional_message);
    const { fromLabel, fromEmail } = smtpFromLines();
    res.json({
      success: true,
      log: mapNumericLogRow(merged),
      smtp_from: { label: fromLabel, email: fromEmail }
    });
  } catch (err) {
    console.error('[email-templates/logs/:id]', err);
    res.status(500).json({ success: false, message: 'Failed to load log' });
  }
});

// GET /api/email-templates/:id
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [rows] = await pool.execute(
      `SELECT et.*, u.name AS created_by_name
       FROM email_templates et
       LEFT JOIN users u ON u.id = et.created_by
       WHERE et.id = ?`,
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }
    const t = rows[0];
    t.variables_parsed = parseVariablesJson(t.variables);
    res.json({ success: true, template: t });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load template' });
  }
});

// POST /api/email-templates
router.post('/', async (req, res) => {
  try {
    const { display_name, category, subject, body, variables } = req.body;
    if (!display_name || !subject || !body) {
      return res.status(400).json({ success: false, message: 'display_name, subject, and body are required' });
    }
    const cat = ['onboarding', 'notification', 'emergency', 'custom', 'system'].includes(category)
      ? category
      : 'custom';
    const baseName = slugFromDisplayName(display_name);
    const name = await ensureUniqueName(baseName);
    const varsJson = typeof variables === 'string' ? variables : variables != null ? JSON.stringify(variables) : null;

    const [r] = await pool.execute(
      `INSERT INTO email_templates (name, display_name, category, subject, body, variables, created_by, is_default, is_active, is_system)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, 0)`,
      [name, display_name, cat, subject, body, varsJson, req.user?.id || null]
    );
    const [created] = await pool.execute('SELECT * FROM email_templates WHERE id = ?', [r.insertId]);
    const template = created[0];
    template.variables_parsed = parseVariablesJson(template.variables);
    res.json({ success: true, template });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create template' });
  }
});

// PUT /api/email-templates/:id
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [existing] = await pool.execute('SELECT * FROM email_templates WHERE id = ?', [id]);
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }
    const { display_name, category, subject, body, variables, is_active } = req.body;
    const cat = category && ['onboarding', 'notification', 'emergency', 'custom', 'system'].includes(category)
      ? category
      : existing[0].category;
    const varsJson =
      variables === undefined
        ? existing[0].variables
        : typeof variables === 'string'
          ? variables
          : variables != null
            ? JSON.stringify(variables)
            : null;

    await pool.execute(
      `UPDATE email_templates SET
        display_name = COALESCE(?, display_name),
        category = ?,
        subject = COALESCE(?, subject),
        body = COALESCE(?, body),
        variables = COALESCE(?, variables),
        is_active = COALESCE(?, is_active)
      WHERE id = ?`,
      [
        display_name ?? null,
        cat,
        subject ?? null,
        body ?? null,
        varsJson,
        is_active !== undefined ? (is_active ? 1 : 0) : null,
        id
      ]
    );
    const [updated] = await pool.execute(
      `SELECT et.*, u.name AS created_by_name FROM email_templates et
       LEFT JOIN users u ON u.id = et.created_by WHERE et.id = ?`,
      [id]
    );
    const template = updated[0];
    template.variables_parsed = parseVariablesJson(template.variables);
    res.json({ success: true, template });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update template' });
  }
});

// DELETE /api/email-templates/:id
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [rows] = await pool.execute('SELECT is_system, is_default FROM email_templates WHERE id = ?', [id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }
    if (rows[0].is_system) {
      return res.status(403).json({ success: false, message: 'System templates cannot be deleted' });
    }
    if (rows[0].is_default) {
      return res.status(400).json({ success: false, message: 'Cannot delete the default payment reminder template' });
    }
    await pool.execute('DELETE FROM email_templates WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete template' });
  }
});

// POST /api/email-templates/preview
router.post('/preview', async (req, res) => {
  try {
    const { template_id, subject, body, student_id } = req.body;
    let subj = subject || '';
    let html = body || '';

    if (template_id) {
      const [tRows] = await pool.execute('SELECT * FROM email_templates WHERE id = ?', [template_id]);
      if (!tRows.length) {
        return res.status(404).json({ success: false, message: 'Template not found' });
      }
      const t = tRows[0];
      subj = t.subject;
      html = t.body;
    }

    let userRow = { name: 'Sample Student', email: 'student@example.com', learner_id: 'ILC00000' };
    if (student_id) {
      const [uRows] = await pool.execute(
        'SELECT id, name, email, learner_id FROM users WHERE id = ?',
        [parseInt(student_id, 10)]
      );
      if (uRows.length) userRow = uRows[0];
    }

    const vars = buildVarsForUser(userRow, { email_body: '<p>Your additional message preview text.</p>' });
    res.json({
      success: true,
      subject: replaceTemplateVars(subj, vars),
      html: replaceTemplateVars(html, vars)
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Preview failed' });
  }
});

// POST /api/email-templates/send
router.post('/send', async (req, res) => {
  try {
    const {
      template_id,
      custom_subject,
      custom_body,
      subject_override,
      recipients,
      student_id,
      course_id,
      role_id,
      extra_variables
    } = req.body;

    const sentBy = req.user?.id || null;
    let templateRow = null;
    let baseSubject = custom_subject || '';
    let baseBody = custom_body || '';

    if (template_id) {
      const [tRows] = await pool.execute(
        'SELECT * FROM email_templates WHERE id = ? AND is_active = 1',
        [parseInt(template_id, 10)]
      );
      if (!tRows.length) {
        return res.status(400).json({ success: false, message: 'Template not found or inactive' });
      }
      templateRow = tRows[0];
      baseSubject =
        subject_override != null && String(subject_override).trim() !== ''
          ? String(subject_override).trim()
          : templateRow.subject;
      baseBody = templateRow.body;
    } else {
      if (!custom_subject || !custom_body) {
        return res.status(400).json({
          success: false,
          message: 'custom_subject and custom_body are required when template_id is omitted'
        });
      }
    }

    const extra = { ...(extra_variables && typeof extra_variables === 'object' ? extra_variables : {}) };
    const pickedAdditional = pickAdditionalEmailBody(req.body);
    if (pickedAdditional) extra.email_body = pickedAdditional;

    let userRows = [];
    if (recipients === 'single') {
      const sid = parseInt(student_id, 10);
      if (!sid) {
        return res.status(400).json({ success: false, message: 'student_id required' });
      }
      const [rows] = await pool.execute(
        'SELECT id, name, email, learner_id FROM users WHERE id = ?',
        [sid]
      );
      userRows = rows;
    } else if (recipients === 'all') {
      const [rows] = await pool.execute(
        `SELECT DISTINCT u.id, u.name, u.email, u.learner_id
         FROM users u
         INNER JOIN roles r ON r.id = u.role_id
         WHERE r.name IN ('Student', 'ManagerStudent', 'InstituteStudent')
         ORDER BY u.name ASC`
      );
      userRows = rows;
    } else if (recipients === 'course') {
      const cid = parseInt(course_id, 10);
      if (!cid) {
        return res.status(400).json({ success: false, message: 'course_id required' });
      }
      const [rows] = await pool.execute(
        `SELECT DISTINCT u.id, u.name, u.email, u.learner_id
         FROM users u
         INNER JOIN course_assignments ca ON ca.student_id = u.id
         WHERE ca.course_id = ?
         ORDER BY u.name ASC`,
        [cid]
      );
      userRows = rows;
    } else if (recipients === 'role') {
      const rid = parseInt(role_id, 10);
      if (!rid) {
        return res.status(400).json({ success: false, message: 'role_id required' });
      }
      const [rows] = await pool.execute(
        'SELECT id, name, email, learner_id FROM users WHERE role_id = ? ORDER BY name ASC',
        [rid]
      );
      userRows = rows;
    } else {
      return res.status(400).json({ success: false, message: 'Invalid recipients type' });
    }

    if (!userRows.length) {
      return res.json({
        success: true,
        total: 0,
        sent: 0,
        failed: 0,
        results: [],
        message: 'No recipients match'
      });
    }

    const results = [];
    let sent = 0;
    let failed = 0;

    const additionalMessageSnapshot =
      extra.email_body != null && String(extra.email_body).trim() !== '' ? String(extra.email_body) : null;

    for (const u of userRows) {
      const vars = buildVarsForUser(u, extra);
      const subject = replaceTemplateVars(baseSubject, vars);
      const html = replaceTemplateVars(baseBody, vars);
      const out = await sendEmail({ to: u.email, subject, html });
      const ok = !!out.success;
      if (ok) sent += 1;
      else failed += 1;

      await insertEmailSendLog(pool, {
        template_id: templateRow ? templateRow.id : null,
        template_name: templateRow ? templateRow.name : 'custom',
        sent_to_email: u.email,
        sent_to_name: u.name,
        sent_to_user_id: u.id,
        subject,
        body: html,
        additional_message: additionalMessageSnapshot,
        status: ok ? 'sent' : 'failed',
        error_message: ok ? null : out.error || 'Send failed',
        sent_by: sentBy
      });

      results.push({ email: u.email, user_id: u.id, status: ok ? 'sent' : 'failed', error: out.error || null });
    }

    res.json({
      success: true,
      total: userRows.length,
      sent,
      failed,
      results
    });
  } catch (err) {
    console.error('[email-templates/send]', err);
    res.status(500).json({ success: false, message: 'Send failed' });
  }
});

module.exports = router;
