const { sendEmail, replaceTemplateVars } = require('./emailService');

function lmsBaseUrl() {
  const raw = process.env.FRONTEND_URL || 'https://lms.inspirelondoncollege.com';
  return String(raw).split(',')[0].trim();
}

function isUnknownColumnErr(err, colName) {
  return (
    err &&
    (err.code === 'ER_BAD_FIELD_ERROR' || err.errno === 1054) &&
    new RegExp(`\\b${colName}\\b`, 'i').test(String(err.sqlMessage || ''))
  );
}

async function insertEmailSendLog(pool, row) {
  const addMsg = row.additional_message != null ? String(row.additional_message) : null;
  const bodyVal = row.body != null ? String(row.body) : null;
  const legacy9 = [
    row.template_id ?? null,
    row.template_name ?? null,
    row.sent_to_email,
    row.sent_to_name ?? null,
    row.sent_to_user_id ?? null,
    String(row.subject).substring(0, 500),
    row.status,
    row.error_message ?? null,
    row.sent_by ?? null
  ];
  const withBody = [
    row.template_id ?? null,
    row.template_name ?? null,
    row.sent_to_email,
    row.sent_to_name ?? null,
    row.sent_to_user_id ?? null,
    String(row.subject).substring(0, 500),
    bodyVal,
    row.status,
    row.error_message ?? null,
    row.sent_by ?? null
  ];
  const withBodyAndAdd = [
    row.template_id ?? null,
    row.template_name ?? null,
    row.sent_to_email,
    row.sent_to_name ?? null,
    row.sent_to_user_id ?? null,
    String(row.subject).substring(0, 500),
    bodyVal,
    addMsg,
    row.status,
    row.error_message ?? null,
    row.sent_by ?? null
  ];

  try {
    await pool.execute(
      `INSERT INTO email_send_logs (
        template_id, template_name, sent_to_email, sent_to_name, sent_to_user_id,
        subject, body, additional_message, status, error_message, sent_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      withBodyAndAdd
    );
    return;
  } catch (err) {
    if (isUnknownColumnErr(err, 'additional_message')) {
      try {
        await pool.execute(
          `INSERT INTO email_send_logs (
            template_id, template_name, sent_to_email, sent_to_name, sent_to_user_id,
            subject, body, status, error_message, sent_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          withBody
        );
        return;
      } catch (err2) {
        if (isUnknownColumnErr(err2, 'body')) {
          await pool.execute(
            `INSERT INTO email_send_logs (
              template_id, template_name, sent_to_email, sent_to_name, sent_to_user_id,
              subject, status, error_message, sent_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            legacy9
          );
          return;
        }
        throw err2;
      }
    }
    if (isUnknownColumnErr(err, 'body')) {
      await pool.execute(
        `INSERT INTO email_send_logs (
          template_id, template_name, sent_to_email, sent_to_name, sent_to_user_id,
          subject, status, error_message, sent_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        legacy9
      );
      return;
    }
    throw err;
  }
}

/**
 * Send student_verification template from DB only (no hardcoded HTML).
 * Logs to email_send_logs. Updates student_onboarding_status on success.
 * @param {{ resend?: boolean }} options — if resend=true, failed sends do not clear verification_email_sent
 */
async function sendStudentVerificationEmail(pool, studentId, sentByUserId, options = {}) {
  const resend = !!options.resend;
  const [templates] = await pool.execute(
    `SELECT id, name, subject, body FROM email_templates
     WHERE name = 'student_verification' AND is_active = 1 LIMIT 1`
  );
  if (!templates.length) {
    return { success: false, error: 'Active student_verification template not found in database' };
  }

  const t = templates[0];
  const [users] = await pool.execute(
    'SELECT id, name, email, learner_id FROM users WHERE id = ?',
    [studentId]
  );
  if (!users.length) {
    return { success: false, error: 'Student not found' };
  }

  const u = users[0];
  const lmsUrl = lmsBaseUrl();
  const vars = {
    student_name: u.name,
    lms_url: lmsUrl,
    LMS_URL: lmsUrl,
    learner_id: u.learner_id || ''
  };
  const subject = replaceTemplateVars(t.subject, vars);
  const html = replaceTemplateVars(t.body, vars);

  const result = await sendEmail({ to: u.email, subject, html });
  const ok = !!result.success;

  await insertEmailSendLog(pool, {
    template_id: t.id,
    template_name: t.name,
    sent_to_email: u.email,
    sent_to_name: u.name,
    sent_to_user_id: u.id,
    subject,
    body: html,
    status: ok ? 'sent' : 'failed',
    error_message: ok ? null : (result.error || 'Send failed'),
    sent_by: sentByUserId || null
  });

  if (ok) {
    await pool.execute(
      `UPDATE student_onboarding_status
       SET verification_email_sent = 1, verification_email_sent_at = NOW()
       WHERE user_id = ?`,
      [studentId]
    );
  } else if (!resend) {
    await pool.execute(
      `UPDATE student_onboarding_status SET verification_email_sent = 0 WHERE user_id = ?`,
      [studentId]
    );
  }

  return { success: ok, error: result.error || null };
}

module.exports = {
  sendStudentVerificationEmail,
  insertEmailSendLog,
  lmsBaseUrl
};
