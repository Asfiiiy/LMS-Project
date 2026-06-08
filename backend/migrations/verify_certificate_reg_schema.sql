-- Schema verification before using learner_id as Reg #
-- Run this first to ensure required tables/columns exist.
-- Errors indicate missing schema; apply migrations before proceeding.

-- 1. Check users.learner_id exists
SELECT COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'users'
  AND COLUMN_NAME = 'learner_id';

-- 2. Check generated_certificates table and registration_number
SELECT COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'generated_certificates'
  AND COLUMN_NAME = 'registration_number';

-- 3. Check certificate_claims exists
SELECT TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'certificate_claims';
