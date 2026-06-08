/**
 * Payment Reminders API - Pending Installments, Received Installments, Reminder Logs
 * Accounts Manager and Team Member access for tabs 1 & 2; Accounts Manager only for tab 3
 */
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { invalidateCache } = require('../middleware/cache');
const { sendPaymentReminderEmail, replaceTemplateVars } = require('../services/emailService');

const ACCOUNTS_TEAM_ROLES = ['Accounts Manager', 'Team Member'];
const ACCOUNTS_MANAGER_ONLY = ['Accounts Manager'];

function buildPaymentReminderHtml(
  plainTextBody,
  studentName,
  courseName,
  installmentNumber,
  amountDue,
  totalRemaining,
  collegeName
) {
  const paragraphs = plainTextBody
    .split('\n\n')
    .filter(p => p.trim())
    .map(p => {
      const text = p.trim()
        .replace(/\n/g, '<br>');

      if (text.startsWith('Dear ')) {
        const name = studentName || '';
        return `<p style="font-size:15px;
          color:#1a1a1a;margin:0 0 16px;">
          Dear <strong>${name}</strong>,
        </p>`;
      }

      if (text.toLowerCase().includes('total remaining')) {
        return `
        <table width="100%" cellpadding="0"
          cellspacing="0"
          style="margin:20px 0;">
        <tr><td style="background:#fdf2f8;
          border:2px solid #e51791;
          border-radius:10px;
          padding:16px;text-align:center;">
        <p style="margin:0 0 4px;
          font-size:11px;color:#9d174d;
          text-transform:uppercase;
          letter-spacing:0.08em;
          font-weight:700;">
          Total Remaining Balance
        </p>
        <p style="margin:0;font-size:26px;
          font-weight:800;color:#e51791;">
          ${totalRemaining}
        </p>
        </td></tr></table>`;
      }

      if (text.includes('Kind regards') ||
          text.includes('Accounts Team')) {
        return `<p style="font-size:13px;
          color:#6b7280;
          border-top:1px solid #e5e7eb;
          padding-top:16px;margin:16px 0 0;">
          ${text.replace(/\n/g, '<br>')}
        </p>`;
      }

      return `<p style="font-size:14px;
        color:#374151;line-height:1.7;
        margin:0 0 14px;">
        ${text}
      </p>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport"
  content="width=device-width,
  initial-scale=1.0">
</head>
<body style="margin:0;padding:0;
  background:#f5f5f5;
  font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0"
  cellspacing="0"
  style="background:#f5f5f5;
  padding:20px 0;">
<tr><td align="center">
<table width="600" cellpadding="0"
  cellspacing="0"
  style="background:#ffffff;
  border-radius:12px;
  overflow:hidden;
  box-shadow:0 2px 8px rgba(0,0,0,0.1);
  max-width:600px;width:100%;">

<!-- HEADER -->
<tr>
<td style="background:linear-gradient(
  135deg,#e51791,#c1147a);
  padding:28px 40px;text-align:center;">
<h1 style="color:#ffffff;margin:0;
  font-size:22px;font-weight:800;">
  Inspire London College
</h1>
<p style="color:rgba(255,255,255,0.85);
  margin:6px 0 0;font-size:13px;">
  Payment Reminder
</p>
</td>
</tr>

<!-- BODY -->
<tr>
<td style="padding:36px 40px;">
${paragraphs}

<!-- CTA -->
<table cellpadding="0" cellspacing="0"
  style="margin:20px auto 0;">
<tr><td style="background:#e51791;
  border-radius:8px;">
<a href="https://lms.inspirelondoncollege.com"
  style="display:inline-block;
  padding:11px 28px;color:#ffffff;
  font-weight:700;font-size:14px;
  text-decoration:none;">
  View Payment Details
</a>
</td></tr>
</table>

</td>
</tr>

<!-- FOOTER -->
<tr>
<td style="background:#11ccef;
  padding:18px 40px;text-align:center;">
<p style="color:#ffffff;margin:0;
  font-size:13px;font-weight:700;">
  Accounts Team
</p>
<p style="color:rgba(255,255,255,0.9);
  margin:4px 0 0;font-size:12px;">
  <strong>${collegeName || 'Inspire London College'}</strong>
</p>
<p style="color:rgba(255,255,255,0.75);
  margin:6px 0 0;font-size:11px;">
  First Floor, Fairlawn High Street,
  Southall London UB1 3HB
</p>
</td>
</tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// GET /api/admin/payments/pending - Pending installments with filters
router.get('/admin/payments/pending', auth, async (req, res) => {
  try {
    if (!ACCOUNTS_TEAM_ROLES.includes(req.user?.role || '')) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const { search, course, fromDate, toDate, reminderStatus, timeFilter } = req.query;

    let baseQuery = `
      FROM student_payment_installments spi
      JOIN users u ON spi.student_id = u.id
      JOIN courses c ON spi.course_id = c.id
      WHERE spi.status IN ('due', 'overdue')
      AND spi.is_deposit = 0
    `;
    const params = [];

    if (search) {
      baseQuery += ' AND (u.name LIKE ? OR u.email LIKE ? OR c.title LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (course) {
      baseQuery += ' AND c.title = ?';
      params.push(course);
    }
    if (fromDate) {
      baseQuery += ' AND spi.due_date >= ?';
      params.push(fromDate);
    }
    if (toDate) {
      baseQuery += ' AND spi.due_date <= ?';
      params.push(toDate);
    }

    // Time filter: overdue, due in 1 month, due in 3 months, all
    if (timeFilter === 'overdue') {
      baseQuery += ' AND (spi.status = ? OR (spi.status = ? AND spi.due_date < CURDATE()))';
      params.push('overdue', 'due');
    } else if (timeFilter === '1month') {
      const d = new Date();
      d.setMonth(d.getMonth() + 1);
      baseQuery += ' AND spi.due_date BETWEEN CURDATE() AND ?';
      params.push(d.toISOString().split('T')[0]);
    } else if (timeFilter === '3months') {
      const d = new Date();
      d.setMonth(d.getMonth() + 3);
      baseQuery += ' AND spi.due_date BETWEEN CURDATE() AND ?';
      params.push(d.toISOString().split('T')[0]);
    }

    const [rows] = await pool.execute(
      `SELECT 
        spi.is_deposit,
        spi.*,
        u.name as student_name,
        u.email as student_email,
        c.title as course_title,
        (SELECT COUNT(*) FROM payment_reminders pr WHERE pr.installment_id = spi.id) as reminder_count,
        (SELECT MAX(pr.created_at) FROM payment_reminders pr WHERE pr.installment_id = spi.id) as last_reminder_at
      ${baseQuery}
      ORDER BY spi.due_date ASC, u.name ASC`,
      params
    );

    // Apply reminder status filter client-side (needs reminder_count)
    let filtered = rows;
    if (reminderStatus === 'not_notified') {
      filtered = rows.filter(r => (r.reminder_count || 0) === 0);
    } else if (reminderStatus === 'reminder_sent') {
      filtered = rows.filter(r => (r.reminder_count || 0) === 1);
    } else if (reminderStatus === 'reminded_multiple') {
      filtered = rows.filter(r => (r.reminder_count || 0) > 1);
    }

    res.json({ success: true, installments: filtered });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.json({ success: true, installments: [] });
    }
    console.error('[PaymentReminders] Pending error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch pending installments' });
  }
});

// GET /api/admin/payments/pending/stats - Stats for Pending tab
router.get('/admin/payments/pending/stats', auth, async (req, res) => {
  try {
    if (!ACCOUNTS_TEAM_ROLES.includes(req.user?.role || '')) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const today = new Date().toISOString().split('T')[0];
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    const [pendingStudents] = await pool.execute(
      `SELECT COUNT(DISTINCT student_id) as cnt FROM student_payment_installments 
       WHERE status IN ('due', 'overdue') AND is_deposit = 0`
    );
    const [pendingAmount] = await pool.execute(
      `SELECT COALESCE(SUM(amount), 0) as total FROM student_payment_installments 
       WHERE status IN ('due', 'overdue') AND is_deposit = 0`
    );
    const [overdueStudents] = await pool.execute(
      `SELECT COUNT(DISTINCT student_id) as cnt FROM student_payment_installments 
       WHERE is_deposit = 0 AND (status = 'overdue' OR (status = 'due' AND due_date < CURDATE()))`
    );
    const [overdueAmount] = await pool.execute(
      `SELECT COALESCE(SUM(amount), 0) as total FROM student_payment_installments 
       WHERE is_deposit = 0 AND (status = 'overdue' OR (status = 'due' AND due_date < CURDATE()))`
    );
    const [depositCounts] = await pool.execute(
      `SELECT
        SUM(CASE WHEN is_deposit = 1 THEN 1 ELSE 0 END) as total_deposits,
        SUM(CASE WHEN is_deposit = 1 AND status = 'paid' THEN 1 ELSE 0 END) as paid_deposits,
        SUM(CASE WHEN is_deposit = 0 THEN 1 ELSE 0 END) as total_installments,
        SUM(CASE WHEN is_deposit = 1 THEN 1 ELSE 0 END) as deposit_count,
        SUM(CASE WHEN is_deposit = 0 THEN 1 ELSE 0 END) as installment_count
      FROM student_payment_installments`
    );
    let remindersToday = [{ cnt: 0 }];
    let remindersMonth = [{ cnt: 0 }];
    try {
      [remindersToday] = await pool.execute(
        `SELECT COUNT(*) as cnt FROM payment_reminders WHERE DATE(created_at) = ?`,
        [today]
      );
      [remindersMonth] = await pool.execute(
        `SELECT COUNT(*) as cnt FROM payment_reminders WHERE created_at >= ?`,
        [monthStart]
      );
    } catch (e) {
      if (e.code !== 'ER_NO_SUCH_TABLE') throw e;
    }

    res.json({
      success: true,
      stats: {
        total_pending_students: pendingStudents[0]?.cnt || 0,
        total_pending_amount: parseFloat(pendingAmount[0]?.total || 0),
        overdue_students: overdueStudents[0]?.cnt || 0,
        overdue_amount: parseFloat(overdueAmount[0]?.total || 0),
        total_deposits: depositCounts[0]?.total_deposits || 0,
        paid_deposits: depositCounts[0]?.paid_deposits || 0,
        total_installments: depositCounts[0]?.total_installments || 0,
        deposit_count: depositCounts[0]?.deposit_count || 0,
        installment_count: depositCounts[0]?.installment_count || 0,
        reminders_sent_today: remindersToday[0]?.cnt || 0,
        reminders_sent_this_month: remindersMonth[0]?.cnt || 0
      }
    });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.json({ success: true, stats: { total_pending_students: 0, total_pending_amount: 0, overdue_students: 0, overdue_amount: 0, reminders_sent_today: 0, reminders_sent_this_month: 0 } });
    }
    console.error('[PaymentReminders] Pending stats error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
});

// GET /api/admin/payments/received - Received/paid installments
router.get('/admin/payments/received', auth, async (req, res) => {
  try {
    if (!ACCOUNTS_TEAM_ROLES.includes(req.user?.role || '')) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const { search, course, fromDate, toDate, month, year, paymentPlan } = req.query;

    let baseQuery = `
      FROM student_payment_installments spi
      JOIN users u ON spi.student_id = u.id
      JOIN courses c ON spi.course_id = c.id
      LEFT JOIN course_assignments ca ON ca.student_id = spi.student_id AND ca.course_id = spi.course_id
      WHERE spi.status = 'paid'
    `;
    const params = [];

    if (search) {
      baseQuery += ' AND (u.name LIKE ? OR u.email LIKE ? OR c.title LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (course) {
      baseQuery += ' AND c.title = ?';
      params.push(course);
    }
    if (fromDate) {
      baseQuery += ' AND spi.paid_at >= ?';
      params.push(fromDate);
    }
    if (toDate) {
      baseQuery += ' AND DATE(spi.paid_at) <= ?';
      params.push(toDate);
    }
    // Enrollment month/year filter (course_assignments.created_at)
    // Only apply when BOTH are provided, as requested.
    if (month && year) {
      baseQuery += ' AND MONTH(ca.created_at) = ? AND YEAR(ca.created_at) = ?';
      params.push(month, year);
    }
    if (paymentPlan === 'all_paid') {
      baseQuery += ' AND spi.payment_type = ?';
      params.push('all_paid');
    } else if (paymentPlan === 'installment') {
      baseQuery += ' AND spi.payment_type = ?';
      params.push('installment');
    }

    const [rows] = await pool.execute(
      `SELECT 
        spi.is_deposit,
        spi.*,
        u.name as student_name,
        u.email as student_email,
        c.title as course_title
      ${baseQuery}
      ORDER BY spi.paid_at DESC, u.name ASC`,
      params
    );

    res.json({ success: true, installments: rows });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return res.json({ success: true, installments: [] });
    console.error('[PaymentReminders] Received error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch received installments' });
  }
});

// GET /api/admin/payments/received/stats - Stats for Received tab
router.get('/admin/payments/received/stats', auth, async (req, res) => {
  try {
    if (!ACCOUNTS_TEAM_ROLES.includes(req.user?.role || '')) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartStr = weekStart.toISOString().split('T')[0];

    const [stats] = await pool.execute(
      `SELECT
        COUNT(*) as total_received,
        SUM(spi.amount) as total_amount,
        SUM(CASE WHEN spi.is_deposit = 1 THEN spi.amount ELSE 0 END) as deposit_amount,
        SUM(CASE WHEN spi.is_deposit = 0 THEN spi.amount ELSE 0 END) as installment_amount,
        SUM(CASE WHEN spi.is_deposit = 1 THEN 1 ELSE 0 END) as deposit_count,
        SUM(CASE WHEN spi.is_deposit = 0 THEN 1 ELSE 0 END) as installment_count
      FROM student_payment_installments spi
      WHERE spi.status = 'paid'`
    );
    const [receivedMonth] = await pool.execute(
      `SELECT COALESCE(SUM(amount), 0) as total FROM student_payment_installments 
       WHERE status = 'paid' AND paid_at >= ?`,
      [monthStart]
    );
    const [receivedWeek] = await pool.execute(
      `SELECT COALESCE(SUM(amount), 0) as total FROM student_payment_installments 
       WHERE status = 'paid' AND paid_at >= ?`,
      [weekStartStr]
    );
    const [avgAmount] = await pool.execute(
      `SELECT COALESCE(AVG(amount), 0) as avg FROM student_payment_installments WHERE status = 'paid'`
    );
    const [fullyPaid] = await pool.execute(
      `SELECT COUNT(DISTINCT CONCAT(student_id, '-', course_id)) as cnt FROM student_payment_installments spi
       WHERE NOT EXISTS (
         SELECT 1 FROM student_payment_installments s2 
         WHERE s2.student_id = spi.student_id AND s2.course_id = spi.course_id AND s2.status IN ('due', 'overdue')
       )`
    );
    const [remainingBalance] = await pool.execute(
      `SELECT COUNT(DISTINCT student_id) as cnt FROM student_payment_installments 
       WHERE status IN ('due', 'overdue')`
    );

    res.json({
      success: true,
      stats: {
        total_amount_received: parseFloat(stats[0]?.total_amount || 0),
        deposit_amount: parseFloat(stats[0]?.deposit_amount || 0),
        installment_amount: parseFloat(stats[0]?.installment_amount || 0),
        deposit_count: stats[0]?.deposit_count || 0,
        installment_count: stats[0]?.installment_count || 0,
        total_installments_received: stats[0]?.total_received || 0,
        received_this_month: parseFloat(receivedMonth[0]?.total || 0),
        received_this_week: parseFloat(receivedWeek[0]?.total || 0),
        average_installment_amount: parseFloat(avgAmount[0]?.avg || 0),
        students_fully_paid: fullyPaid[0]?.cnt || 0,
        students_with_remaining_balance: remainingBalance[0]?.cnt || 0
      }
    });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.json({ success: true, stats: { total_installments_received: 0, total_amount_received: 0, received_this_month: 0, received_this_week: 0, average_installment_amount: 0, students_fully_paid: 0, students_with_remaining_balance: 0 } });
    }
    console.error('[PaymentReminders] Received stats error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
});

// GET /api/admin/reminders/logs - Reminder logs (Accounts Manager only)
router.get('/admin/reminders/logs', auth, async (req, res) => {
  try {
    if (!ACCOUNTS_MANAGER_ONLY.includes(req.user?.role || '')) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const { fromDate, toDate, sentBy, method, search } = req.query;

    let baseQuery = `
      FROM payment_reminders pr
      JOIN users u ON pr.student_id = u.id
      JOIN courses c ON pr.course_id = c.id
      JOIN student_payment_installments spi ON pr.installment_id = spi.id
      LEFT JOIN users sender ON pr.sent_by = sender.id
      LEFT JOIN email_templates et ON pr.email_template_id = et.id
      WHERE 1=1
    `;
    const params = [];

    if (fromDate) {
      baseQuery += ' AND DATE(pr.created_at) >= ?';
      params.push(fromDate);
    }
    if (toDate) {
      baseQuery += ' AND DATE(pr.created_at) <= ?';
      params.push(toDate);
    }
    if (sentBy === 'auto') {
      baseQuery += ' AND pr.sent_by IS NULL';
    } else if (sentBy === 'manual') {
      baseQuery += ' AND pr.sent_by IS NOT NULL';
    }
    if (method) {
      baseQuery += ' AND pr.method = ?';
      params.push(method);
    }
    if (search) {
      baseQuery += ' AND (u.name LIKE ? OR u.email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const [rows] = await pool.execute(
      `SELECT 
        pr.*,
        u.name as student_name,
        u.email as student_email,
        c.title as course_title,
        spi.installment_number,
        spi.amount as amount_due,
        sender.name as sent_by_name,
        et.name as template_name
      ${baseQuery}
      ORDER BY pr.created_at DESC`,
      params
    );

    const logs = rows.map(r => ({
      id: r.id,
      created_at: r.created_at,
      student_name: r.student_name,
      student_email: r.student_email,
      course_title: r.course_title,
      installment: r.installment_number,
      amount_due: r.amount_due,
      sent_by: r.sent_by ? r.sent_by_name : 'System (Auto)',
      method: r.method,
      template_name: r.template_name || '-',
      email_status: r.email_status || 'pending'
    }));

    res.json({ success: true, logs });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return res.json({ success: true, logs: [] });
    console.error('[PaymentReminders] Logs error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch reminder logs' });
  }
});

// POST /api/admin/reminders/send - Send single reminder
router.post('/admin/reminders/send', auth, async (req, res) => {
  try {
    if (!ACCOUNTS_TEAM_ROLES.includes(req.user?.role || '')) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const { installmentId, method, templateId } = req.body;
    if (!installmentId) {
      return res.status(400).json({ success: false, message: 'installmentId required' });
    }

    const [instRows] = await pool.execute(
      `SELECT spi.*, spi.is_deposit, u.name as student_name, u.email as student_email, c.title as course_title,
       (SELECT COUNT(*) FROM student_payment_installments WHERE student_id = spi.student_id AND course_id = spi.course_id AND status IN ('due', 'overdue')) as due_count,
       (SELECT COUNT(*) FROM student_payment_installments WHERE student_id = spi.student_id AND course_id = spi.course_id AND is_deposit = 0) as total_count
       FROM student_payment_installments spi
       JOIN users u ON spi.student_id = u.id
       JOIN courses c ON spi.course_id = c.id
       WHERE spi.id = ?`,
      [installmentId]
    );
    if (!instRows.length) {
      return res.status(404).json({ success: false, message: 'Installment not found' });
    }
    const inst = instRows[0];
    if (inst.status === 'paid') {
      return res.status(400).json({ success: false, message: 'Installment is already paid' });
    }

    const sendMethod = method || 'both';
    let template = null;
    if (templateId) {
      const [tRows] = await pool.execute('SELECT * FROM email_templates WHERE id = ?', [templateId]);
      template = tRows[0];
    }
    if (!template) {
      const [defRows] = await pool.execute('SELECT * FROM email_templates WHERE is_default = 1 LIMIT 1');
      template = defRows[0];
    }

    const dueDate = inst.due_date ? new Date(inst.due_date).toLocaleDateString('en-GB') : '-';
    const daysOverdue = inst.due_date && new Date(inst.due_date) < new Date()
      ? Math.floor((new Date() - new Date(inst.due_date)) / (1000 * 60 * 60 * 24))
      : 0;

    const [remainingRows] = await pool.execute(
      `SELECT COALESCE(SUM(amount), 0) as total FROM student_payment_installments 
       WHERE student_id = ? AND course_id = ? AND status IN ('due', 'overdue')`,
      [inst.student_id, inst.course_id]
    );
    const totalRemaining = remainingRows[0]?.total || inst.amount;

    const vars = {
      studentName: inst.student_name,
      courseName: inst.course_title,
      installmentNumber: inst.is_deposit === 1
        ? 'Initial Deposit'
        : `${inst.installment_number - 1} of ${inst.total_count || 1}`,
      amountDue: `£${parseFloat(inst.amount).toFixed(2)}`,
      dueDate,
      totalRemaining: `£${parseFloat(totalRemaining).toFixed(2)}`,
      daysOverdue: String(daysOverdue),
      collegeName: 'Inspire London College'
    };

    const DEFAULT_BODY = 'Dear {{studentName}},\n\nThis is a friendly reminder that your installment {{installmentNumber}} of {{amountDue}} for {{courseName}} was due on {{dueDate}}.\n\nYour total remaining balance is {{totalRemaining}}.\n\nPlease make your payment at the earliest.\n\nBest regards,\nAccounts Team\n{{collegeName}}';
    let emailStatus = 'pending';
    if (sendMethod === 'email' || sendMethod === 'both') {
      const plainBody = replaceTemplateVars(
        (template?.body &&
         String(template.body).trim())
          ? template.body
          : DEFAULT_BODY,
        vars
      );

      const htmlBody = buildPaymentReminderHtml(
        plainBody,
        vars.studentName,
        vars.courseName,
        vars.installmentNumber,
        vars.amountDue,
        vars.totalRemaining,
        vars.collegeName
      );

      const result = await sendPaymentReminderEmail({
        to: inst.student_email,
        subject: replaceTemplateVars(
          template?.subject ||
          'Payment Reminder – {{courseName}}',
          vars
        ),
        html: htmlBody,
        text: plainBody
      });
      emailStatus = result.success ? 'delivered' : 'failed';
    }

    const notificationMsg = `Payment Reminder: Your installment of £${parseFloat(inst.amount).toFixed(2)} for ${inst.course_title} was due on ${dueDate}. Please make your payment at the earliest.`;
    if (sendMethod === 'dashboard' || sendMethod === 'both') {
      await pool.execute(
        `INSERT INTO student_notifications (student_id, type, title, message, related_installment_id, is_read)
         VALUES (?, 'payment_reminder', ?, ?, ?, 0)`,
        [inst.student_id, 'Payment Reminder', notificationMsg, inst.id]
      );
    }

    await pool.execute(
      `INSERT INTO payment_reminders (student_id, course_id, installment_id, sent_by, method, email_template_id, email_status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [inst.student_id, inst.course_id, inst.id, req.user.id, sendMethod, template?.id || null, emailStatus]
    );

    await invalidateCache('cache:/api/admin/payments*');
    await invalidateCache('cache:/api/student/notifications*');

    res.json({ success: true, message: 'Reminder sent successfully' });
  } catch (err) {
    console.error('[PaymentReminders] Send error:', err);
    res.status(500).json({ success: false, message: 'Failed to send reminder' });
  }
});

// POST /api/admin/reminders/send-bulk - Send bulk reminders
router.post('/admin/reminders/send-bulk', auth, async (req, res) => {
  try {
    if (!ACCOUNTS_TEAM_ROLES.includes(req.user?.role || '')) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const { installmentIds, method, templateId } = req.body;
    if (!Array.isArray(installmentIds) || installmentIds.length === 0) {
      return res.status(400).json({ success: false, message: 'installmentIds array required' });
    }

    let sent = 0;
    let failed = 0;
    for (const id of installmentIds) {
      try {
        const [instRows] = await pool.execute(
          `SELECT spi.*, spi.is_deposit, u.name as student_name, u.email as student_email, c.title as course_title,
           (SELECT COUNT(*) FROM student_payment_installments WHERE student_id = spi.student_id AND course_id = spi.course_id AND is_deposit = 0) as total_count
           FROM student_payment_installments spi
           JOIN users u ON spi.student_id = u.id
           JOIN courses c ON spi.course_id = c.id
           WHERE spi.id = ? AND spi.status IN ('due', 'overdue')`,
          [id]
        );
        if (!instRows.length) continue;
        const inst = instRows[0];

        let template = null;
        if (templateId) {
          const [tRows] = await pool.execute('SELECT * FROM email_templates WHERE id = ?', [templateId]);
          template = tRows[0];
        }
        if (!template) {
          const [defRows] = await pool.execute('SELECT * FROM email_templates WHERE is_default = 1 LIMIT 1');
          template = defRows[0];
        }

        const sendMethod = method || 'both';
        const vars = {
          studentName: inst.student_name,
          courseName: inst.course_title,
          installmentNumber: inst.is_deposit === 1
            ? 'Initial Deposit'
            : `${inst.installment_number - 1} of ${inst.total_count || 1}`,
          amountDue: `£${parseFloat(inst.amount).toFixed(2)}`,
          dueDate: inst.due_date ? new Date(inst.due_date).toLocaleDateString('en-GB') : '-',
          totalRemaining: `£${parseFloat(inst.amount).toFixed(2)}`,
          daysOverdue: '0',
          collegeName: 'Inspire London College'
        };

        const defaultBody = 'Dear {{studentName}},\n\nThis is a friendly reminder that your installment {{installmentNumber}} of {{amountDue}} for {{courseName}} was due on {{dueDate}}.\n\nYour total remaining balance is {{totalRemaining}}.\n\nPlease make your payment at the earliest.\n\nBest regards,\nAccounts Team\n{{collegeName}}';
        let emailStatus = 'pending';
        if (sendMethod === 'email' || sendMethod === 'both') {
          const plainBody = replaceTemplateVars(
            (template?.body &&
             String(template.body).trim())
              ? template.body
              : defaultBody,
            vars
          );
          const htmlBody = buildPaymentReminderHtml(
            plainBody,
            vars.studentName,
            vars.courseName,
            vars.installmentNumber,
            vars.amountDue,
            vars.totalRemaining,
            vars.collegeName
          );
          const result = await sendPaymentReminderEmail({
            to: inst.student_email,
            subject: replaceTemplateVars(template?.subject || 'Payment Reminder', vars),
            html: htmlBody,
            text: plainBody
          });
          emailStatus = result.success ? 'delivered' : 'failed';
        }

        let notificationMsg = `Payment Reminder: Your installment of £${parseFloat(inst.amount).toFixed(2)} for ${inst.course_title}. Please make your payment at the earliest.`;
        if (sendMethod === 'dashboard' || sendMethod === 'both') {
          await pool.execute(
            `INSERT INTO student_notifications (student_id, type, title, message, related_installment_id, is_read)
             VALUES (?, 'payment_reminder', ?, ?, ?, 0)`,
            [inst.student_id, 'Payment Reminder', notificationMsg, inst.id]
          );
        }

        await pool.execute(
          `INSERT INTO payment_reminders (student_id, course_id, installment_id, sent_by, method, email_template_id, email_status)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [inst.student_id, inst.course_id, inst.id, req.user.id, sendMethod, template?.id || null, emailStatus]
        );
        sent++;
      } catch (e) {
        failed++;
      }
    }

    await invalidateCache('cache:/api/admin/payments*');
    await invalidateCache('cache:/api/student/notifications*');

    res.json({ success: true, sent, failed, message: `Sent ${sent} reminders${failed ? `, ${failed} failed` : ''}` });
  } catch (err) {
    console.error('[PaymentReminders] Bulk send error:', err);
    res.status(500).json({ success: false, message: 'Failed to send bulk reminders' });
  }
});

// CRUD email templates
router.get('/admin/email-templates', auth, async (req, res) => {
  try {
    if (!ACCOUNTS_TEAM_ROLES.includes(req.user?.role || '')) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const [rows] = await pool.execute('SELECT * FROM email_templates ORDER BY is_default DESC, name ASC');
    res.json({ success: true, templates: rows });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.json({ success: true, templates: [] });
    }
    res.status(500).json({ success: false, message: 'Failed to fetch templates' });
  }
});

router.post('/admin/email-templates', auth, async (req, res) => {
  try {
    if (!ACCOUNTS_TEAM_ROLES.includes(req.user?.role || '')) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const { name, subject, body, is_default } = req.body;
    if (!name || !subject || !body) {
      return res.status(400).json({ success: false, message: 'name, subject, body required' });
    }
    if (is_default) {
      await pool.execute('UPDATE email_templates SET is_default = 0');
    }
    const [r] = await pool.execute(
      `INSERT INTO email_templates (name, display_name, category, subject, body, created_by, is_default, is_active, is_system)
       VALUES (?, ?, 'custom', ?, ?, ?, ?, 1, 0)`,
      [name, name, subject, body, req.user.id, is_default ? 1 : 0]
    );
    res.json({ success: true, id: r.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create template' });
  }
});

router.put('/admin/email-templates/:id', auth, async (req, res) => {
  try {
    if (!ACCOUNTS_TEAM_ROLES.includes(req.user?.role || '')) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const { name, subject, body, is_default } = req.body;
    if (is_default) {
      await pool.execute('UPDATE email_templates SET is_default = 0');
    }
    await pool.execute(
      'UPDATE email_templates SET name = COALESCE(?, name), subject = COALESCE(?, subject), body = COALESCE(?, body), is_default = COALESCE(?, is_default) WHERE id = ?',
      [name, subject, body, is_default !== undefined ? (is_default ? 1 : 0) : null, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update template' });
  }
});

router.delete('/admin/email-templates/:id', auth, async (req, res) => {
  try {
    if (!ACCOUNTS_TEAM_ROLES.includes(req.user?.role || '')) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const [rows] = await pool.execute('SELECT is_default FROM email_templates WHERE id = ?', [req.params.id]);
    if (rows.length && rows[0].is_default) {
      return res.status(400).json({ success: false, message: 'Cannot delete default template' });
    }
    await pool.execute('DELETE FROM email_templates WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete template' });
  }
});

// Auto-reminder settings
router.get('/admin/auto-reminder/settings', auth, async (req, res) => {
  try {
    if (!ACCOUNTS_MANAGER_ONLY.includes(req.user?.role || '')) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const [rows] = await pool.execute('SELECT * FROM auto_reminder_settings ORDER BY id DESC LIMIT 1');
    res.json({ success: true, settings: rows[0] || { is_enabled: 0, interval_hours: 24 } });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.json({ success: true, settings: { is_enabled: 0, interval_hours: 24 } });
    }
    res.status(500).json({ success: false, message: 'Failed to fetch settings' });
  }
});

router.patch('/admin/auto-reminder/settings', auth, async (req, res) => {
  try {
    if (!ACCOUNTS_MANAGER_ONLY.includes(req.user?.role || '')) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const { is_enabled, interval_hours } = req.body;
    const [existing] = await pool.execute('SELECT id FROM auto_reminder_settings LIMIT 1');
    if (existing.length) {
      await pool.execute(
        'UPDATE auto_reminder_settings SET is_enabled = COALESCE(?, is_enabled), interval_hours = COALESCE(?, interval_hours), updated_by = ? WHERE id = ?',
        [is_enabled, interval_hours, req.user.id, existing[0].id]
      );
    } else {
      await pool.execute(
        'INSERT INTO auto_reminder_settings (is_enabled, interval_hours, updated_by) VALUES (?, ?, ?)',
        [is_enabled !== undefined ? is_enabled : 0, interval_hours || 24, req.user.id]
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update settings' });
  }
});

// Student notifications (payment reminders on student dashboard)
router.get('/student/notifications', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const studentRoles = ['Student', 'ManagerStudent', 'InstituteStudent'];
    if (!studentRoles.includes(req.user?.role || '')) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const [rows] = await pool.execute(
      `SELECT * FROM student_notifications 
       WHERE student_id = ? 
       ORDER BY created_at DESC 
       LIMIT 100`,
      [userId]
    );
    const unreadCount = rows.filter(r => !r.is_read).length;
    res.json({ success: true, notifications: rows, unreadCount });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.json({ success: true, notifications: [], unreadCount: 0 });
    }
    res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
});

router.patch('/student/notifications/:id/read', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const studentRoles = ['Student', 'ManagerStudent', 'InstituteStudent'];
    if (!studentRoles.includes(req.user?.role || '')) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    await pool.execute(
      'UPDATE student_notifications SET is_read = 1 WHERE id = ? AND student_id = ?',
      [req.params.id, userId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to mark as read' });
  }
});

module.exports = router;
