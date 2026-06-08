-- Create AI Tokens table for AI automation system
-- This allows AI agents to perform automated tasks with secure token-based access

CREATE TABLE IF NOT EXISTS ai_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  token VARCHAR(255) UNIQUE NOT NULL COMMENT 'The actual AI token (e.g., ai_tok_abc123...)',
  name VARCHAR(100) NOT NULL COMMENT 'Friendly name like "Jarvis AI", "AutoBot", "AI Assistant"',
  description TEXT NULL COMMENT 'Optional description of what this AI token is used for',
  created_by INT NOT NULL COMMENT 'Admin user who created this token',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL COMMENT 'NULL = never expires, otherwise token expires at this time',
  is_active BOOLEAN DEFAULT TRUE COMMENT 'Can be revoked without deleting',
  is_revoked BOOLEAN DEFAULT FALSE COMMENT 'Set to TRUE when token is compromised or manually revoked',
  revoked_at TIMESTAMP NULL COMMENT 'When the token was revoked',
  revoked_reason TEXT NULL COMMENT 'Reason for revocation (e.g., "Security alert: Multiple IPs detected")',
  last_used_at TIMESTAMP NULL COMMENT 'Last time this token was used',
  last_used_ip VARCHAR(50) NULL COMMENT 'Last IP address that used this token',
  usage_count INT DEFAULT 0 COMMENT 'Total number of API calls made with this token',
  rate_limit_per_minute INT DEFAULT 60 COMMENT 'Max requests per minute for this token',
  
  -- Security monitoring fields
  unique_ip_count INT DEFAULT 0 COMMENT 'Number of unique IPs that have used this token',
  security_alert_count INT DEFAULT 0 COMMENT 'Number of security alerts triggered',
  last_security_alert_at TIMESTAMP NULL COMMENT 'Last time a security alert was triggered',
  
  -- Permissions (JSON array of allowed actions)
  permissions JSON NULL COMMENT 'Array of allowed permissions: ["users.create", "users.assign_tutor", "enrollments.enroll", "enrollments.setup"]',
  
  INDEX idx_token (token),
  INDEX idx_created_by (created_by),
  INDEX idx_is_active (is_active),
  INDEX idx_is_revoked (is_revoked),
  INDEX idx_expires_at (expires_at),
  INDEX idx_last_used_at (last_used_at),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create AI action logs table for detailed tracking of all AI operations
CREATE TABLE IF NOT EXISTS ai_action_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  token_id INT NOT NULL COMMENT 'Reference to ai_tokens.id',
  token_name VARCHAR(100) NOT NULL COMMENT 'Denormalized token name for quick queries',
  
  -- Action details
  action_type VARCHAR(100) NOT NULL COMMENT 'Type of action: user_created, tutor_assigned, student_enrolled, deadline_set, payment_setup, etc.',
  action_description TEXT NOT NULL COMMENT 'Human-readable description of what was done',
  
  -- Request details
  endpoint VARCHAR(500) NOT NULL,
  method VARCHAR(10) NOT NULL,
  ip_address VARCHAR(50),
  country_code VARCHAR(2) NULL,
  country_name VARCHAR(100) NULL,
  user_agent TEXT NULL,
  request_body TEXT NULL COMMENT 'Truncated to 5000 chars',
  
  -- Response details
  response_status INT NULL,
  response_time_ms INT NULL COMMENT 'How long the request took',
  response_body TEXT NULL COMMENT 'Truncated response for debugging',
  error_message TEXT NULL COMMENT 'Error message if action failed',
  
  -- Related entities (for filtering)
  affected_user_id INT NULL COMMENT 'User ID that was created/modified',
  affected_student_id INT NULL COMMENT 'Student ID that was enrolled/modified',
  affected_course_id INT NULL COMMENT 'Course ID that was involved',
  affected_enrollment_id INT NULL COMMENT 'Enrollment ID that was created/modified',
  
  -- Timestamp
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_token_id (token_id),
  INDEX idx_token_name (token_name),
  INDEX idx_action_type (action_type),
  INDEX idx_endpoint (endpoint(255)),
  INDEX idx_created_at (created_at),
  INDEX idx_ip_address (ip_address),
  INDEX idx_affected_user_id (affected_user_id),
  INDEX idx_affected_student_id (affected_student_id),
  INDEX idx_affected_course_id (affected_course_id),
  INDEX idx_affected_enrollment_id (affected_enrollment_id),
  FOREIGN KEY (token_id) REFERENCES ai_tokens(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create AI token IP tracking table for security monitoring
-- Tracks which IPs have used each token to detect exposure
CREATE TABLE IF NOT EXISTS ai_token_ip_tracking (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  token_id INT NOT NULL COMMENT 'Reference to ai_tokens.id',
  ip_address VARCHAR(50) NOT NULL,
  country_code VARCHAR(2) NULL,
  country_name VARCHAR(100) NULL,
  first_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  usage_count INT DEFAULT 1 COMMENT 'Number of times this IP used this token',
  
  UNIQUE KEY unique_token_ip (token_id, ip_address),
  INDEX idx_token_id (token_id),
  INDEX idx_ip_address (ip_address),
  INDEX idx_first_used_at (first_used_at),
  FOREIGN KEY (token_id) REFERENCES ai_tokens(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
