-- Create lms_user if not exists and grant privileges on db_lms
-- Run: sudo mysql < backend/migrations/create_lms_user.sql

CREATE USER IF NOT EXISTS 'lms_user'@'localhost' IDENTIFIED BY '13302!#!asfiumar!_zawar749#&*#$%';
GRANT ALL PRIVILEGES ON db_lms.* TO 'lms_user'@'localhost';
FLUSH PRIVILEGES;

SELECT 'lms_user created/verified' AS result;
