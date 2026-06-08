/**
 * Auto-reminder cron: sends payment reminders for overdue installments
 * Runs based on interval in auto_reminder_settings (default 24h)
 */
const cron = require('node-cron');
const pool = require('../config/db');
const { sendEmail, replaceTemplateVars } = require('../services/emailService');

let isRunning = false;

async function runAutoReminders() {
  if (isRunning) return;
  isRunning = true;
  try {
    let settingsRows;
    try {
      [settingsRows] = await pool.execute('SELECT * FROM auto_reminder_settings ORDER BY id DESC LIMIT 1');
    } catch (e) {
      if (e.code === 'ER_NO_SUCH_TABLE') return;
      throw e;
    }
    const settings = settingsRows?.[0];
    if (!settings || !settings.is_enabled) {
      return;
    }

    const intervalHours = settings.interval_hours || 24;
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - intervalHours);
    const cutoffStr = cutoff.toISOString().slice(0, 19).replace('T', ' ');

    const [overdueRows] = await pool.execute(
      `SELECT spi.*, u.name as student_name, u.email as student_email, c.title as course_title,
       (SELECT COUNT(*) FROM student_payment_installments WHERE student_id = spi.student_id AND course_id = spi.course_id) as total_count,
       (SELECT MAX(pr.created_at) FROM payment_reminders pr WHERE pr.installment_id = spi.id) as last_reminder
       FROM student_payment_installments spi
       JOIN users u ON spi.student_id = u.id
       JOIN courses c ON spi.course_id = c.id
       WHERE spi.status IN ('due', 'overdue')
       AND (spi.due_date IS NULL OR spi.due_date < CURDATE())`
    );

    const [defTemplateRows] = await pool.execute('SELECT * FROM email_templates WHERE is_default = 1 LIMIT 1');
    const template = defTemplateRows[0];

    for (const inst of overdueRows) {
      const lastReminder = inst.last_reminder ? new Date(inst.last_reminder) : null;
      if (lastReminder && lastReminder > cutoff) continue;

      const vars = {
        studentName: inst.student_name,
        courseName: inst.course_title,
        installmentNumber: `${inst.installment_number} of ${inst.total_count || 1}`,
        amountDue: `£${parseFloat(inst.amount).toFixed(2)}`,
        dueDate: inst.due_date ? new Date(inst.due_date).toLocaleDateString('en-GB') : '-',
        totalRemaining: `£${parseFloat(inst.amount).toFixed(2)}`,
        daysOverdue: inst.due_date ? Math.floor((new Date() - new Date(inst.due_date)) / (1000 * 60 * 60 * 24)) : 0,
        collegeName: 'Inspire London College'
      };

      const defaultBody = 'Dear {{studentName}},\n\nThis is a friendly reminder that your installment {{installmentNumber}} of {{amountDue}} for {{courseName}} was due on {{dueDate}}.\n\nYour total remaining balance is {{totalRemaining}}.\n\nPlease make your payment at the earliest.\n\nBest regards,\nAccounts Team\n{{collegeName}}';
      let emailStatus = 'pending';
      if (template) {
        const body = replaceTemplateVars((template.body && String(template.body).trim()) ? template.body : defaultBody, vars);
        const result = await sendEmail({
          to: inst.student_email,
          subject: replaceTemplateVars(template.subject || 'Payment Reminder', vars),
          html: body.replace(/\n/g, '<br>'),
          text: body
        });
        emailStatus = result.success ? 'delivered' : 'failed';
      }

      const notificationMsg = `Payment Reminder: Your installment of £${parseFloat(inst.amount).toFixed(2)} for ${inst.course_title} was due on ${vars.dueDate}. Please make your payment at the earliest.`;
      await pool.execute(
        `INSERT INTO student_notifications (student_id, type, title, message, related_installment_id, is_read)
         VALUES (?, 'payment_reminder', ?, ?, ?, 0)`,
        [inst.student_id, 'Payment Reminder', notificationMsg, inst.id]
      );

      await pool.execute(
        `INSERT INTO payment_reminders (student_id, course_id, installment_id, sent_by, method, email_template_id, email_status)
         VALUES (?, ?, ?, NULL, 'both', ?, ?)`,
        [inst.student_id, inst.course_id, inst.id, template?.id || null, emailStatus]
      );
    }

    await pool.execute(
      'UPDATE auto_reminder_settings SET last_run_at = NOW() WHERE id = ?',
      [settings.id]
    );
  } catch (err) {
  } finally {
    isRunning = false;
  }
}

function registerAutoReminder() {
  cron.schedule('0 * * * *', runAutoReminders);
}

module.exports = { registerAutoReminder, runAutoReminders };
