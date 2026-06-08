-- Stripe installment payment + payment_audit_log
-- Run: mysql -u lms_user -p db_lms < backend/migrations/add_stripe_installment_and_audit_log.sql
-- If columns already exist, ignore the duplicate column errors.

-- 1. Add Stripe-related columns to student_payment_installments
ALTER TABLE student_payment_installments ADD COLUMN stripe_payment_intent_id VARCHAR(255) DEFAULT NULL;
ALTER TABLE student_payment_installments ADD COLUMN payment_method VARCHAR(50) DEFAULT 'manual';
ALTER TABLE student_payment_installments ADD COLUMN payment_initiated_at TIMESTAMP NULL;
ALTER TABLE student_payment_installments ADD COLUMN payment_failed_reason TEXT DEFAULT NULL;

-- 2. Create payment_audit_log table
CREATE TABLE IF NOT EXISTS payment_audit_log (
  id INT PRIMARY KEY AUTO_INCREMENT,
  student_id INT NOT NULL,
  reference_id INT COMMENT 'claim_id or installment_id',
  reference_type ENUM('certificate','installment') NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  stripe_payment_intent_id VARCHAR(255),
  amount DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'gbp',
  status VARCHAR(50),
  failure_reason TEXT,
  source ENUM('api','webhook') DEFAULT 'api',
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_student_id (student_id),
  INDEX idx_stripe_pi (stripe_payment_intent_id),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (student_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Add payment_status to course_assignments (optional - for fully_paid when all installments paid)
ALTER TABLE course_assignments ADD COLUMN payment_status VARCHAR(50) DEFAULT NULL;
