-- Migration: Add onboarding_profile_status column to users and student_onboarding_status tables
-- Purpose: Track student profile status (new, review, verified)

-- Check and add profile status to users table
SET @column_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'users' 
  AND COLUMN_NAME = 'onboarding_profile_status'
);

SET @sql = IF(@column_exists = 0,
  "ALTER TABLE users ADD COLUMN onboarding_profile_status ENUM('new', 'review', 'verified') DEFAULT 'new' COMMENT 'Student profile status: new (not logged in or not completed), review (completed, pending verification), verified (admin verified)'",
  'SELECT "Column onboarding_profile_status already exists in users table" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add index for better query performance
SET @index_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'users'
  AND INDEX_NAME = 'idx_users_onboarding_profile_status'
);

SET @sql_idx = IF(@index_exists = 0,
  'CREATE INDEX idx_users_onboarding_profile_status ON users(onboarding_profile_status)',
  'SELECT "Index idx_users_onboarding_profile_status already exists" AS message'
);

PREPARE stmt_idx FROM @sql_idx;
EXECUTE stmt_idx;
DEALLOCATE PREPARE stmt_idx;

-- Update existing users based on their current state
-- Set to 'verified' if they have dashboard access
UPDATE users u
INNER JOIN student_onboarding_status sos ON u.id = sos.user_id
SET u.onboarding_profile_status = 'verified'
WHERE u.role_id = 4
AND sos.dashboard_access_granted = 1;

-- Set to 'review' if onboarding is complete but not yet verified
UPDATE users u
INNER JOIN student_onboarding_status sos ON u.id = sos.user_id
SET u.onboarding_profile_status = 'review'
WHERE u.role_id = 4
AND sos.vark_assessment_completed = 1
AND sos.documents_uploaded = 1
AND sos.dashboard_access_granted = 0
AND u.onboarding_profile_status = 'new';

-- Students who logged in but haven't completed onboarding stay as 'new'

-- Check and add to student_onboarding_status table
SET @column_exists2 = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'student_onboarding_status' 
  AND COLUMN_NAME = 'profile_status'
);

SET @sql2 = IF(@column_exists2 = 0,
  "ALTER TABLE student_onboarding_status ADD COLUMN profile_status ENUM('new', 'review', 'verified') DEFAULT 'new'",
  'SELECT "Column profile_status already exists in student_onboarding_status table" AS message'
);

PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

SET @index_exists2 = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'student_onboarding_status'
  AND INDEX_NAME = 'idx_onboarding_profile_status'
);

SET @sql_idx2 = IF(@index_exists2 = 0,
  'CREATE INDEX idx_onboarding_profile_status ON student_onboarding_status(profile_status)',
  'SELECT "Index idx_onboarding_profile_status already exists" AS message'
);

PREPARE stmt_idx2 FROM @sql_idx2;
EXECUTE stmt_idx2;
DEALLOCATE PREPARE stmt_idx2;
