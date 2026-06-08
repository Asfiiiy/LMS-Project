-- Migration: Add user_name column to system_logs for AI agent tracking
-- Purpose: Store AI token names and user names directly for better reporting

-- Check and add user_name column
SET @column_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'system_logs' 
  AND COLUMN_NAME = 'user_name'
);

SET @sql = IF(@column_exists = 0,
  "ALTER TABLE system_logs ADD COLUMN user_name VARCHAR(255) NULL COMMENT 'User or AI Agent name for quick display' AFTER user_id",
  'SELECT "Column user_name already exists in system_logs table" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add index for better query performance
SET @index_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'system_logs'
  AND INDEX_NAME = 'idx_system_logs_user_name'
);

SET @sql_idx = IF(@index_exists = 0,
  'CREATE INDEX idx_system_logs_user_name ON system_logs(user_name)',
  'SELECT "Index idx_system_logs_user_name already exists" AS message'
);

PREPARE stmt_idx FROM @sql_idx;
EXECUTE stmt_idx;
DEALLOCATE PREPARE stmt_idx;

-- Note: Existing logs will have NULL user_name and will continue to work via LEFT JOIN with users table
