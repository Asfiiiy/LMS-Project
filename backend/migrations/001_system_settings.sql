-- Run against the LMS MySQL database (requires users table for FK).
CREATE TABLE IF NOT EXISTS system_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value TEXT NULL,
  setting_type ENUM('string','boolean','json','number')
    DEFAULT 'string',
  description TEXT NULL,
  updated_by INT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by)
    REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO system_settings
  (setting_key, setting_value, setting_type, description)
VALUES
(
  'stripe_mode',
  'test',
  'string',
  'Stripe payment mode: test or live'
),
(
  'stripe_test_publishable_key',
  '',
  'string',
  'Stripe test publishable key (pk_test_...)'
),
(
  'stripe_test_secret_key',
  '',
  'string',
  'Stripe test secret key (sk_test_...)'
),
(
  'stripe_test_webhook_secret',
  '',
  'string',
  'Stripe test webhook secret (whsec_...)'
),
(
  'stripe_live_publishable_key',
  '',
  'string',
  'Stripe live publishable key (pk_live_...)'
),
(
  'stripe_live_secret_key',
  '',
  'string',
  'Stripe live secret key (sk_live_...)'
),
(
  'stripe_live_webhook_secret',
  '',
  'string',
  'Stripe live webhook secret (whsec_...)'
)
ON DUPLICATE KEY UPDATE setting_key = setting_key;
