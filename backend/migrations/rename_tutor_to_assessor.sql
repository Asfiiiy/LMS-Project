-- =====================================================
-- RENAME TUTOR TO ASSESSOR
-- Updates the roles table: Tutor (role_id 2) → Assessor
-- =====================================================

-- Update role name from Tutor to Assessor
UPDATE roles SET name = 'Assessor' WHERE id = 2;

-- Verify
SELECT id, name FROM roles WHERE id = 2;
