-- Email management: extend email_templates + send logs
-- Safe to run once; re-run may error on duplicate columns — ignore or adjust.

ALTER TABLE email_templates
  ADD COLUMN display_name VARCHAR(150) NULL AFTER name;

UPDATE email_templates SET display_name = name WHERE display_name IS NULL OR display_name = '';

ALTER TABLE email_templates
  MODIFY COLUMN display_name VARCHAR(150) NOT NULL;

ALTER TABLE email_templates
  ADD COLUMN category ENUM('onboarding','notification','emergency','custom','system') NOT NULL DEFAULT 'custom' AFTER display_name;

ALTER TABLE email_templates
  ADD COLUMN variables TEXT NULL COMMENT 'JSON array of variable hints' AFTER body;

ALTER TABLE email_templates
  ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER variables;

ALTER TABLE email_templates
  ADD COLUMN is_system TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active;

UPDATE email_templates
SET category = 'system', is_system = 1, display_name = COALESCE(NULLIF(TRIM(display_name), ''), name)
WHERE is_default = 1 OR name LIKE '%Payment%';

UPDATE email_templates
SET category = 'onboarding', is_system = 1
WHERE name = 'student_verification';

ALTER TABLE email_templates
  ADD UNIQUE KEY uniq_email_templates_name (name);

CREATE TABLE IF NOT EXISTS email_send_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  template_id INT NULL,
  template_name VARCHAR(100) NULL,
  sent_to_email VARCHAR(255) NOT NULL,
  sent_to_name VARCHAR(255) NULL,
  sent_to_user_id INT NULL,
  subject VARCHAR(500) NOT NULL,
  status ENUM('sent','failed','pending') NOT NULL DEFAULT 'pending',
  error_message TEXT NULL,
  sent_by INT NULL COMMENT 'admin user who sent',
  sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email_send_logs_sent_at (sent_at),
  INDEX idx_email_send_logs_template (template_id),
  INDEX idx_email_send_logs_status (status),
  CONSTRAINT fk_email_send_logs_template FOREIGN KEY (template_id) REFERENCES email_templates(id) ON DELETE SET NULL,
  CONSTRAINT fk_email_send_logs_user FOREIGN KEY (sent_to_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_email_send_logs_sent_by FOREIGN KEY (sent_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO email_templates (name, display_name, category, subject, body, variables, is_system, is_active, is_default)
VALUES (
  'student_verification',
  'Student Verification & Welcome',
  'onboarding',
  'Congratulations on Completing Your Profile - Inspire London College',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; color: #333;">
    <p style="margin-bottom: 16px;">Dear {{student_name}},</p>
    <p style="margin-bottom: 16px;">
      <span style="color: #11CCEF; font-weight: bold; text-decoration: underline;">Congratulations!!</span>
      on successfully completing your profile on the
      <strong style="color: #E51791;">Learning Management System.</strong>
    </p>
    <p style="color: #E51791; font-weight: bold; font-size: 16px; margin-bottom: 8px;">Course Material</p>
    <p style="margin-bottom: 16px;">You can now access your course materials and begin your learning journey through the LMS platform. Please use the link below to log in:</p>
    <p style="margin-bottom: 16px;"><strong>Link:</strong> <a href="{{lms_url}}" style="color: #11CCEF;">{{lms_url}}</a></p>
    <p style="margin-bottom: 16px;">Kindly log in at your earliest convenience and continue with your studies.</p>
    <p style="margin-bottom: 16px;">We wish you every success in your course.</p>
    <p style="margin-bottom: 8px;"><strong>Kind Regards,</strong></p>
    <p><span style="color: #11CCEF; font-weight: bold;">Admissions</span> | <span style="color: #E51791; font-weight: bold;">Inspire London College</span></p>
  </div>',
  '[{"key":"{{student_name}}","description":"Student full name"},{"key":"{{lms_url}}","description":"LMS login URL"},{"key":"{{learner_id}}","description":"Student learner ID"}]',
  1, 1, 0
)
ON DUPLICATE KEY UPDATE
  display_name = VALUES(display_name),
  category = VALUES(category),
  subject = VALUES(subject),
  body = VALUES(body),
  variables = VALUES(variables),
  is_system = VALUES(is_system);

INSERT INTO email_templates (name, display_name, category, subject, body, variables, is_system, is_active, is_default)
VALUES (
  'student_login_welcome',
  'Welcome - Login Credentials',
  'onboarding',
  'Welcome to Inspire London College LMS - Your Login Details',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; color: #333;">
    <p style="margin-bottom: 16px;">Dear {{student_name}},</p>
    <p style="margin-bottom: 16px;">Welcome to <strong style="color: #E51791;">Inspire London College</strong> Learning Management System.</p>
    <p style="margin-bottom: 16px;">Your account has been created. Please find your login details below:</p>
    <div style="background: #f0fbff; border: 1px solid #bae6fd; border-radius: 10px; padding: 16px; margin-bottom: 16px;">
      <p style="margin-bottom: 8px;"><strong>Email:</strong> {{student_email}}</p>
      <p style="margin-bottom: 8px;"><strong>Learner ID:</strong> {{learner_id}}</p>
      <p style="margin-bottom: 0;"><strong>Login URL:</strong> <a href="{{lms_url}}" style="color: #11CCEF;">{{lms_url}}</a></p>
    </div>
    <p style="margin-bottom: 16px;">Kind Regards,</p>
    <p><span style="color: #11CCEF; font-weight: bold;">Admissions</span> | <span style="color: #E51791; font-weight: bold;">Inspire London College</span></p>
  </div>',
  '[{"key":"{{student_name}}","description":"Student full name"},{"key":"{{student_email}}","description":"Student email"},{"key":"{{learner_id}}","description":"Learner ID"},{"key":"{{lms_url}}","description":"LMS URL"}]',
  1, 1, 0
)
ON DUPLICATE KEY UPDATE
  display_name = VALUES(display_name),
  category = VALUES(category),
  subject = VALUES(subject),
  body = VALUES(body),
  variables = VALUES(variables),
  is_system = VALUES(is_system);

INSERT INTO email_templates (name, display_name, category, subject, body, variables, is_system, is_active, is_default)
VALUES (
  'emergency',
  'Emergency Notice',
  'emergency',
  'Important Notice from Inspire London College',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; color: #333;">
    <div style="background: #fef2f2; border-left: 4px solid #E51791; padding: 12px 16px; margin-bottom: 20px; border-radius: 4px;">
      <p style="color: #E51791; font-weight: bold; margin: 0;">⚠️ Important Notice</p>
    </div>
    <p style="margin-bottom: 16px;">Dear {{student_name}},</p>
    <p style="margin-bottom: 16px;">{{email_body}}</p>
    <p style="margin-bottom: 16px;">Kind Regards,</p>
    <p><span style="color: #11CCEF; font-weight: bold;">Admissions</span> | <span style="color: #E51791; font-weight: bold;">Inspire London College</span></p>
  </div>',
  '[{"key":"{{student_name}}","description":"Student full name"},{"key":"{{email_body}}","description":"Main email content"}]',
  0, 1, 0
)
ON DUPLICATE KEY UPDATE
  display_name = VALUES(display_name),
  category = VALUES(category),
  subject = VALUES(subject),
  body = VALUES(body),
  variables = VALUES(variables);
