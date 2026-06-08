const pool = require('../config/db');

function coalesce(val, fallback) {
  if (val === null || val === undefined) return fallback;
  const s = String(val).trim();
  return s === '' ? fallback : val;
}

async function getSetting(key, defaultValue = null) {
  try {
    const [rows] = await pool.execute(
      'SELECT setting_value FROM system_settings WHERE setting_key = ?',
      [key]
    );
    if (rows.length === 0) return defaultValue;
    return rows[0].setting_value;
  } catch {
    return defaultValue;
  }
}

async function setSetting(key, value, updatedBy = null) {
  await pool.execute(
    `INSERT INTO system_settings (setting_key, setting_value, updated_by)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
     setting_value = VALUES(setting_value),
     updated_by = VALUES(updated_by)`,
    [key, value, updatedBy]
  );
}

async function getStripeConfig() {
  const modeRaw = await getSetting('stripe_mode', 'test');
  const mode = String(modeRaw || 'test').toLowerCase() === 'live' ? 'live' : 'test';

  if (mode === 'live') {
    return {
      mode: 'live',
      secretKey: coalesce(
        await getSetting('stripe_live_secret_key'),
        process.env.STRIPE_SECRET_KEY
      ),
      publishableKey: coalesce(
        await getSetting('stripe_live_publishable_key'),
        process.env.STRIPE_PUBLISHABLE_KEY
      ),
      webhookSecret: coalesce(
        await getSetting('stripe_live_webhook_secret'),
        process.env.STRIPE_WEBHOOK_SECRET
      )
    };
  }

  return {
    mode: 'test',
    secretKey: coalesce(
      await getSetting('stripe_test_secret_key'),
      process.env.STRIPE_SECRET_KEY
    ),
    publishableKey: coalesce(
      await getSetting('stripe_test_publishable_key'),
      process.env.STRIPE_PUBLISHABLE_KEY
    ),
    webhookSecret: coalesce(
      await getSetting('stripe_test_webhook_secret'),
      process.env.STRIPE_WEBHOOK_SECRET
    )
  };
}

async function getStripeClient() {
  const config = await getStripeConfig();
  const secret = config.secretKey;
  if (!secret) {
    throw new Error('Stripe secret key is not configured');
  }
  return require('stripe')(secret);
}

module.exports = {
  getSetting,
  setSetting,
  getStripeConfig,
  getStripeClient
};
