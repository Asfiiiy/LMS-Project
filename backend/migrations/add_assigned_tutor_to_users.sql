-- =====================================================
-- ADD ASSIGNED TUTOR TO USERS TABLE
-- Students can have a default assigned tutor
-- =====================================================

USE db_lms;

-- Add assigned_tutor_id to users table
-- This allows assigning a default tutor to student users
ALTER TABLE users
ADD COLUMN assigned_tutor_id INT DEFAULT NULL AFTER parent_tutor_id,
ADD KEY idx_assigned_tutor (assigned_tutor_id),
ADD CONSTRAINT fk_user_assigned_tutor FOREIGN KEY (assigned_tutor_id)
  REFERENCES users(id) ON DELETE SET NULL;

-- Verification query
SELECT 
  'Users table updated' as status,
  COUNT(*) as total_users,
  SUM(CASE WHEN assigned_tutor_id IS NOT NULL THEN 1 ELSE 0 END) as users_with_tutors
FROM users;

SELECT 
  'Column exists' as verification,
  COLUMN_NAME,
  DATA_TYPE,
  IS_NULLABLE,
  COLUMN_KEY
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'db_lms'
  AND TABLE_NAME = 'users'
  AND COLUMN_NAME = 'assigned_tutor_id';


