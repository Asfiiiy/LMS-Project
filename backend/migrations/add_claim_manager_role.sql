-- Add Claim Manager role
-- Run: mysql -u user -p db_lms < backend/migrations/add_claim_manager_role.sql
-- Role ID assigned: 12 (check with: SELECT id, name FROM roles WHERE name = 'Claim Manager')

INSERT INTO roles (name)
SELECT 'Claim Manager'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Claim Manager');
