/**
 * Email service for payment reminders and other transactional emails
 * Uses Nodemailer with SMTP — credentials from environment variables only
 */
const nodemailer = require('nodemailer');

let transporter = null;

function getFromAddress() {
  const fromName =
    process.env.SMTP_FROM_NAME || 'Admissions | Inspire London College';
  const fromEmail =
    process.env.SMTP_FROM ||
    process.env.SMTP_FROM_EMAIL ||
    process.env.SMTP_USER ||
    '';
  return `"${fromName}" <${fromEmail}>`;
}

function getTransporter() {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST || '';
  const port = parseInt(process.env.SMTP_PORT || '25', 10);
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';
  const secure =
    String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' ||
    port === 465;

  transporter = nodemailer.createTransport({
    host,
    port: Number.isFinite(port) ? port : 25,
    secure,
    auth: user && pass ? { user, pass } : undefined,
    tls: {
      rejectUnauthorized: false
    }
  });

  return transporter;
}

/** For tests or after .env change without process restart */
function resetTransporter() {
  transporter = null;
}

async function testEmailConnection() {
  try {
    resetTransporter();
    const t = getTransporter();
    await t.verify();
    console.log('✅ SMTP connection verified');
    return { success: true };
  } catch (err) {
    console.log('❌ SMTP connection failed:', err.message);
    return { success: false, error: err.message };
  }
}

/** Undo HTML entities / fullwidth braces so {{var}} matches after rich-text editors. */
function decodeTemplateBraces(text) {
  return String(text)
    .replace(/&#123;/g, '{')
    .replace(/&#125;/g, '}')
    .replace(/&lbrace;/gi, '{')
    .replace(/&rbrace;/gi, '}')
    .replace(/\uFF5B/g, '{')
    .replace(/\uFF5D/g, '}');
}

/**
 * Replace template variables in subject and body
 * Supports {{variable}} and {{ variable }} (with optional spaces)
 */
function replaceTemplateVars(text, vars) {
  if (!text || typeof text !== 'string') return text;
  let result = decodeTemplateBraces(text);
  if (!vars || typeof vars !== 'object') return result;
  for (const [key, value] of Object.entries(vars)) {
    const escaped = String(key).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\{\\{\\s*${escaped}\\s*\\}\\}`, 'gi');
    result = result.replace(regex, String(value ?? ''));
  }
  if (vars.email_body != null && /\{\{\s*email_body\s*\}\}/i.test(result)) {
    result = result.replace(/\{\{\s*email_body\s*\}\}/gi, String(vars.email_body));
  }
  return result;
}

/**
 * Send an email
 * @param {Object} options - { to, subject, html, text }
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
async function sendEmail(options) {
  try {
    const transport = getTransporter();
    const from = getFromAddress();

    const info = await transport.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html || options.text,
      text: options.text || (options.html ? options.html.replace(/<[^>]*>/g, '') : undefined)
    });

    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('[EmailService] Send failed:', err.message);
    return { success: false, error: err.message };
  }
}

async function sendPaymentReminderEmail({
  to, subject, html, text
}) {
  const host = process.env.PAYMENT_SMTP_HOST
    || process.env.SMTP_HOST || '';
  const port = parseInt(
    process.env.PAYMENT_SMTP_PORT
    || process.env.SMTP_PORT || '25', 10);
  const user = process.env.PAYMENT_SMTP_USER
    || process.env.SMTP_USER || '';
  const pass = process.env.PAYMENT_SMTP_PASS
    || process.env.SMTP_PASS || '';
  const fromEmail =
    process.env.PAYMENT_SMTP_FROM
    || process.env.SMTP_FROM_EMAIL
    || user;
  const fromName =
    process.env.PAYMENT_SMTP_FROM_NAME
    || 'Accounts Team | Inspire London College';
  const secure =
    String(process.env.PAYMENT_SMTP_SECURE
      || '').toLowerCase() === 'true';

  const paymentTransporter =
    nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      tls: { rejectUnauthorized: false }
    });

  const mailOptions = {
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    html,
    text
  };

  const info = await paymentTransporter
    .sendMail(mailOptions);

  console.log('[PaymentEmail] Sent to:', to,
    '| ID:', info.messageId);

  return info;
}

module.exports = {
  getTransporter,
  replaceTemplateVars,
  sendEmail,
  sendPaymentReminderEmail,
  testEmailConnection
};
