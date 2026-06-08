#!/usr/bin/env node
/**
 * Test Stripe webhook locally without Stripe CLI.
 * Run: node test-webhook.js
 * Requires: backend server running on port 5000
 */

require('dotenv').config();
const crypto = require('crypto');
const http = require('http');

const WEBHOOK_URL = 'http://localhost:5000/api/webhook';
const secret = process.env.STRIPE_WEBHOOK_SECRET;

if (!secret) {
  console.error('❌ STRIPE_WEBHOOK_SECRET not set in .env');
  process.exit(1);
}

// Minimal payment_intent.succeeded event (Stripe format)
const payload = JSON.stringify({
  id: 'evt_test_webhook_' + Date.now(),
  object: 'event',
  type: 'payment_intent.succeeded',
  data: {
    object: {
      id: 'pi_test_' + Date.now(),
      object: 'payment_intent',
      amount: 1000,
      metadata: {}
    }
  }
});

const timestamp = Math.floor(Date.now() / 1000);
const signedPayload = `${timestamp}.${payload}`;
const signature = crypto
  .createHmac('sha256', secret)
  .update(signedPayload)
  .digest('hex');

const stripeSignature = `t=${timestamp},v1=${signature}`;

const url = new URL(WEBHOOK_URL);
const options = {
  hostname: url.hostname,
  port: url.port || 5000,
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'stripe-signature': stripeSignature,
    'Content-Length': Buffer.byteLength(payload)
  }
};

console.log('🔔 Sending test webhook to', WEBHOOK_URL);
console.log('   Event: payment_intent.succeeded\n');

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => { body += chunk; });
  res.on('end', () => {
    console.log('Response status:', res.statusCode);
    console.log('Response body:', body || '(empty)');
    if (res.statusCode === 200) {
      console.log('\n✅ Webhook accepted (check backend logs for 🔔)');
    } else {
      console.log('\n❌ Webhook rejected');
    }
  });
});

req.on('error', (err) => {
  console.error('❌ Request failed:', err.message);
  console.log('   Is the backend running on port 5000?');
  process.exit(1);
});

req.write(payload);
req.end();
