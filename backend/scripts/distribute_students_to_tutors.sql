-- ============================================================================
-- Script to Distribute All Students Equally Among Main Tutors
-- ============================================================================
-- This script assigns all students (role_id = 4) evenly to main tutors
-- (role_id = 2, parent_tutor_id IS NULL)
-- 
-- Usage: Run this script via MySQL command line or MySQL Workbench
-- ============================================================================

-- Step 1: Create a temporary table to store tutor IDs in order
DROP TEMPORARY TABLE IF EXISTS temp_tutors;
CREATE TEMPORARY TABLE temp_tutors (
    tutor_id INT,
    tutor_name VARCHAR(255),
    row_num INT AUTO_INCREMENT PRIMARY KEY
);

-- Step 2: Insert all main tutors into the temporary table
INSERT INTO temp_tutors (tutor_id, tutor_name)
SELECT id, name 
FROM users 
WHERE role_id = 2 
  AND (parent_tutor_id IS NULL OR parent_tutor_id = 0)
ORDER BY id;

-- Step 3: Create a temporary table to store students with their assignment order
DROP TEMPORARY TABLE IF EXISTS temp_students;
CREATE TEMPORARY TABLE temp_students (
    student_id INT,
    student_name VARCHAR(255),
    row_num INT AUTO_INCREMENT PRIMARY KEY
);

-- Step 4: Insert all students into the temporary table
INSERT INTO temp_students (student_id, student_name)
SELECT id, name 
FROM users 
WHERE role_id = 4
ORDER BY id;

-- Step 5: Get the count of tutors
SET @tutor_count = (SELECT COUNT(*) FROM temp_tutors);
SET @student_count = (SELECT COUNT(*) FROM temp_students);

-- Step 6: Update students with assigned tutors using round-robin distribution
-- Formula: (row_num - 1) % tutor_count gives us the tutor index (0-based)
UPDATE users u
INNER JOIN temp_students ts ON u.id = ts.student_id
INNER JOIN temp_tutors tt ON tt.row_num = ((ts.row_num - 1) % @tutor_count) + 1
SET u.assigned_tutor_id = tt.tutor_id
WHERE u.role_id = 4;

-- Step 7: Show distribution summary
SELECT 
    tt.tutor_name AS 'Tutor Name',
    tt.tutor_id AS 'Tutor ID',
    COUNT(u.id) AS 'Assigned Students'
FROM temp_tutors tt
LEFT JOIN users u ON u.assigned_tutor_id = tt.tutor_id AND u.role_id = 4
GROUP BY tt.tutor_id, tt.tutor_name
ORDER BY tt.tutor_id;

-- Step 8: Show students without assignments (if any)
SELECT 
    COUNT(*) AS 'Students Without Tutor'
FROM users
WHERE role_id = 4 AND (assigned_tutor_id IS NULL OR assigned_tutor_id = 0);

-- Cleanup temporary tables
DROP TEMPORARY TABLE IF EXISTS temp_tutors;
DROP TEMPORARY TABLE IF EXISTS temp_students;

-- ============================================================================
-- Summary:
-- - Total Students: (shown in Step 7)
-- - Total Tutors: (shown in Step 7)
-- - Distribution: Round-robin (each tutor gets approximately equal number)
-- ============================================================================
