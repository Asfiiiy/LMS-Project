-- ============================================================================
-- Quick Script: Distribute All Students Equally Among Main Tutors
-- ============================================================================
-- This is a simplified one-query version for easy execution
-- ============================================================================

-- Create temporary tutor table with row numbers
DROP TEMPORARY TABLE IF EXISTS temp_tutors;
CREATE TEMPORARY TABLE temp_tutors (
    tutor_id INT,
    row_num INT AUTO_INCREMENT PRIMARY KEY
);

INSERT INTO temp_tutors (tutor_id)
SELECT id 
FROM users 
WHERE role_id = 2 
  AND (parent_tutor_id IS NULL OR parent_tutor_id = 0)
ORDER BY id;

-- Create temporary student table with row numbers
DROP TEMPORARY TABLE IF EXISTS temp_students;
CREATE TEMPORARY TABLE temp_students (
    student_id INT,
    row_num INT AUTO_INCREMENT PRIMARY KEY
);

INSERT INTO temp_students (student_id)
SELECT id 
FROM users 
WHERE role_id = 4
ORDER BY id;

-- Get tutor count
SET @tutor_count = (SELECT COUNT(*) FROM temp_tutors);

-- Distribute students evenly using round-robin
UPDATE users u
INNER JOIN temp_students ts ON u.id = ts.student_id
INNER JOIN temp_tutors tt ON tt.row_num = ((ts.row_num - 1) % @tutor_count) + 1
SET u.assigned_tutor_id = tt.tutor_id
WHERE u.role_id = 4;

-- Show results
SELECT 
    u.name AS 'Tutor Name',
    u.id AS 'Tutor ID',
    COUNT(s.id) AS 'Assigned Students'
FROM users u
LEFT JOIN users s ON s.assigned_tutor_id = u.id AND s.role_id = 4
WHERE u.role_id = 2 AND (u.parent_tutor_id IS NULL OR u.parent_tutor_id = 0)
GROUP BY u.id, u.name
ORDER BY u.id;

-- Cleanup
DROP TEMPORARY TABLE IF EXISTS temp_tutors;
DROP TEMPORARY TABLE IF EXISTS temp_students;
