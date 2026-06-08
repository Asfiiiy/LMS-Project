-- Add Certificate Manager role (certificate department head)
-- Run: mysql -u user -p db_lms < add_certificate_manager_role.sql

USE db_lms;

INSERT INTO roles (name)
SELECT 'Certificate Manager'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Certificate Manager');

SELECT id, name FROM roles WHERE name = 'Certificate Manager';
