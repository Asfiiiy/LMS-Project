-- Create API Tokens table for n8n automation and external integrations
-- This allows secure API access without password-based authentication

CREATE TABLE IF NOT EXISTS api_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  token VARCHAR(255) UNIQUE NOT NULL COMMENT 'The actual API token (e.g., lms_tok_abc123...)',
  name VARCHAR(100) NOT NULL COMMENT 'Friendly name like "Jarvis", "n8n-bot", "External Integration"',
  description TEXT NULL COMMENT 'Optional description of what this token is used for',
  created_by INT NOT NULL COMMENT 'Admin user who created this token',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL COMMENT 'NULL = never expires',
  is_active BOOLEAN DEFAULT TRUE COMMENT 'Can be revoked without deleting',
  permissions JSON NULL COMMENT 'Array of allowed permissions: ["users.create", "enrollments.create", etc.]',
  last_used_at TIMESTAMP NULL COMMENT 'Last time this token was used',
  usage_count INT DEFAULT 0 COMMENT 'Total number of API calls made with this token',
  rate_limit_per_minute INT DEFAULT 100 COMMENT 'Max requests per minute',
  ip_whitelist TEXT NULL COMMENT 'Comma-separated IPs (NULL = any IP allowed)',
  INDEX idx_token (token),
  INDEX idx_created_by (created_by),
  INDEX idx_is_active (is_active),
  INDEX idx_expires_at (expires_at),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create API usage logs table for detailed tracking
CREATE TABLE IF NOT EXISTS api_token_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  token_id INT NOT NULL COMMENT 'Reference to api_tokens.id',
  token_name VARCHAR(100) NOT NULL COMMENT 'Denormalized token name for quick queries',
  endpoint VARCHAR(500) NOT NULL,
  method VARCHAR(10) NOT NULL,
  ip_address VARCHAR(50),
  country_code VARCHAR(2) NULL,
  country_name VARCHAR(100) NULL,
  user_agent TEXT NULL,
  request_body TEXT NULL COMMENT 'Truncated to 2000 chars',
  response_status INT NULL,
  response_time_ms INT NULL COMMENT 'How long the request took',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_token_id (token_id),
  INDEX idx_token_name (token_name),
  INDEX idx_endpoint (endpoint(255)),
  INDEX idx_created_at (created_at),
  INDEX idx_ip_address (ip_address),
  FOREIGN KEY (token_id) REFERENCES api_tokens(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
