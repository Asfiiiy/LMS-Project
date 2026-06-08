-- Consultation Manager role
-- Expected role ID: 15 (verify: SELECT id, name FROM roles WHERE name = 'Consultation Manager')
-- Run: mysql -u USER -p DB < backend/migrations/add_consultation_manager_role.sql

INSERT INTO roles (name)
SELECT 'Consultation Manager'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Consultation Manager');
