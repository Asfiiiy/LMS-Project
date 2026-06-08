-- Payment reminders, email templates, student notifications, and auto-reminder settings
-- For Accounts Manager dashboard: Pending Installments, Received Installments, Reminder Logs

-- payment_reminders: audit trail of all reminders sent (manual + auto)
CREATE TABLE IF NOT EXISTS payment_reminders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  course_id INT NOT NULL,
  installment_id INT NOT NULL,
  sent_by INT NULL COMMENT 'user_id for manual, NULL for system/auto',
  method ENUM('dashboard', 'email', 'both') NOT NULL DEFAULT 'both',
  email_template_id INT NULL,
  email_status ENUM('delivered', 'failed', 'pending') NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_student_id (student_id),
  INDEX idx_installment_id (installment_id),
  INDEX idx_created_at (created_at),
  INDEX idx_sent_by (sent_by),
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (installment_id) REFERENCES student_payment_installments(id) ON DELETE CASCADE,
  FOREIGN KEY (sent_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- email_templates: manageable from Accounts Manager dashboard
CREATE TABLE IF NOT EXISTS email_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  body LONGTEXT NOT NULL,
  created_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  INDEX idx_created_by (created_by),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- student_notifications: payment reminders shown on student dashboard
CREATE TABLE IF NOT EXISTS student_notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'payment_reminder',
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  related_installment_id INT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_student_id (student_id),
  INDEX idx_is_read (is_read),
  INDEX idx_created_at (created_at),
  INDEX idx_type (type),
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (related_installment_id) REFERENCES student_payment_installments(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- auto_reminder_settings: Accounts Manager can toggle and set interval
CREATE TABLE IF NOT EXISTS auto_reminder_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  is_enabled TINYINT(1) NOT NULL DEFAULT 1,
  interval_hours INT NOT NULL DEFAULT 24,
  last_run_at DATETIME NULL,
  updated_by INT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default row for auto_reminder_settings
INSERT INTO auto_reminder_settings (is_enabled, interval_hours) 
SELECT 0, 24 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM auto_reminder_settings LIMIT 1);

-- Insert default payment reminder email template
INSERT INTO email_templates (name, subject, body, is_default) 
SELECT 
  'Payment Reminder (Default)',
  'Payment Reminder – {{courseName}}',
  'Dear {{studentName}},\n\nThis is a friendly reminder that your installment {{installmentNumber}} of {{amountDue}} for {{courseName}} was due on {{dueDate}}.\n\nYour total remaining balance is {{totalRemaining}}.\n\nPlease make your payment at the earliest to avoid any disruption to your studies.\n\nIf you have already made this payment, please disregard this email.\n\nBest regards,\nAccounts Team\n{{collegeName}}',
  1
FROM DUAL 
WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE is_default = 1 LIMIT 1);
