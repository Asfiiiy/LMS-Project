-- Create database
CREATE DATABASE IF NOT EXISTS db_lms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create user
CREATE USER IF NOT EXISTS 'lms_user'@'localhost' IDENTIFIED BY 'LMS_SecurePass_2026';

-- Grant privileges
GRANT ALL PRIVILEGES ON db_lms.* TO 'lms_user'@'localhost';
FLUSH PRIVILEGES;

-- Confirm
SELECT 'Database and user created successfully!' AS Status;


