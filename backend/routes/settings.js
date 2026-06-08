const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { permit } = require('../middleware/roles');
const { getSetting, setSetting, getStripeConfig } = require('../services/settingsService');

router.use(auth);

// Authenticated: mode + publishable key only (for checkout UIs)
router.get('/stripe-config', async (req, res) => {
  try {
    const config = await getStripeConfig();
    res.json({
      success: true,
      mode: config.mode,
      publishableKey: config.publishableKey || ''
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || 'Failed to load Stripe config' });
  }
});

function maskKey(key) {
  if (!key || key.length < 8) return '';
  return key.substring(0, 7) + '...' + key.substring(key.length - 4);
}

const validateKey = (key, prefix, fieldName) => {
  if (!key || String(key).trim() === '') return null;
  if (!String(key).startsWith(prefix)) {
    return `${fieldName} must start with ${prefix}`;
  }
  return null;
};

// Admin: masked keys + hasKeys flags
router.get('/stripe', permit('Admin'), async (req, res) => {
  try {
    const mode = await getSetting('stripe_mode', 'test');
    const testSk = await getSetting('stripe_test_secret_key', '');
    const liveSk = await getSetting('stripe_live_secret_key', '');

    res.json({
      success: true,
      mode: mode || 'test',
      test: {
        publishableKey: maskKey(await getSetting('stripe_test_publishable_key', '')),
        secretKey: maskKey(await getSetting('stripe_test_secret_key', '')),
        webhookSecret: maskKey(await getSetting('stripe_test_webhook_secret', '')),
        hasKeys: !!String(testSk || '').trim()
      },
      live: {
        publishableKey: maskKey(await getSetting('stripe_live_publishable_key', '')),
        secretKey: maskKey(await getSetting('stripe_live_secret_key', '')),
        webhookSecret: maskKey(await getSetting('stripe_live_webhook_secret', '')),
        hasKeys: !!String(liveSk || '').trim()
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || 'Failed to load settings' });
  }
});

router.put('/stripe', permit('Admin'), async (req, res) => {
  console.log('[Stripe Settings] Request body:', JSON.stringify(req.body, null, 2));
  console.log('[Stripe Settings] Body keys:', Object.keys(req.body || {}));

  const {
    mode,
    test_publishable_key,
    test_secret_key,
    test_webhook_secret,
    live_publishable_key,
    live_secret_key,
    live_webhook_secret
  } = req.body;

  if (mode !== undefined && mode !== null && !['test', 'live'].includes(mode)) {
    console.log('[Stripe Settings] 400 reason:', 'mode is present but not test or live');
    return res.status(400).json({
      success: false,
      error: 'Mode must be test or live'
    });
  }

  const errors = [
    validateKey(live_publishable_key, 'pk_live_', 'Live publishable key'),
    validateKey(live_secret_key, 'sk_live_', 'Live secret key'),
    validateKey(live_webhook_secret, 'whsec_', 'Live webhook secret'),
    validateKey(test_publishable_key, 'pk_test_', 'Test publishable key'),
    validateKey(test_secret_key, 'sk_test_', 'Test secret key'),
    validateKey(test_webhook_secret, 'whsec_', 'Test webhook secret')
  ].filter(Boolean);

  console.log('[Stripe Settings] Validation errors:', errors);

  if (errors.length > 0) {
    console.log('[Stripe Settings] 400 reason:', 'Stripe key prefix validation failed (see Validation errors)');
    return res.status(400).json({
      success: false,
      error: errors[0],
      errors: errors
    });
  }

  const updates = [
    ['stripe_mode', mode],
    ['stripe_test_publishable_key', test_publishable_key],
    ['stripe_test_secret_key', test_secret_key],
    ['stripe_test_webhook_secret', test_webhook_secret],
    ['stripe_live_publishable_key', live_publishable_key],
    ['stripe_live_secret_key', live_secret_key],
    ['stripe_live_webhook_secret', live_webhook_secret]
  ];

  for (const [key, value] of updates) {
    if (value !== undefined && value !== null) {
      await setSetting(key, value, req.user?.id || null);
    }
  }

  res.json({
    success: true,
    message: `Stripe settings saved. Mode: ${mode !== undefined && mode !== null ? mode : 'unchanged'}`
  });
});

module.exports = router;
