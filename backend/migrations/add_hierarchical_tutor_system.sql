-- =====================================================
-- HIERARCHICAL TUTOR SYSTEM
-- Main Tutor can have Sub Tutors
-- Students are assigned to specific tutors
-- =====================================================

USE db_lms;

-- Step 1: Add parent_tutor_id to users table for tutor hierarchy
-- This links sub tutors to their main tutor
ALTER TABLE users 
ADD COLUMN parent_tutor_id INT DEFAULT NULL AFTER manager_id,
ADD KEY idx_parent_tutor (parent_tutor_id),
ADD CONSTRAINT fk_parent_tutor FOREIGN KEY (parent_tutor_id) 
  REFERENCES users(id) ON DELETE SET NULL;

-- Step 2: Add assigned_tutor_id to course_assignments table
-- This specifies which tutor is assigned to handle this specific student enrollment
ALTER TABLE course_assignments 
ADD COLUMN assigned_tutor_id INT DEFAULT NULL AFTER assigned_by,
ADD KEY idx_assigned_tutor (assigned_tutor_id),
ADD CONSTRAINT fk_assigned_tutor FOREIGN KEY (assigned_tutor_id) 
  REFERENCES users(id) ON DELETE SET NULL;

-- Step 3: Create index for faster queries
ALTER TABLE course_assignments 
ADD INDEX idx_tutor_student (assigned_tutor_id, student_id),
ADD INDEX idx_course_tutor (course_id, assigned_tutor_id);

-- Step 4: Update existing enrollments
-- Set assigned_tutor_id to course creator (default behavior)
UPDATE course_assignments ca
JOIN courses c ON ca.course_id = c.id
SET ca.assigned_tutor_id = c.created_by
WHERE ca.assigned_tutor_id IS NULL;

-- Verification queries
SELECT 'Users with parent_tutor_id' as info, COUNT(*) as count 
FROM users 
WHERE parent_tutor_id IS NOT NULL;

SELECT 'Course assignments with assigned_tutor_id' as info, COUNT(*) as count 
FROM course_assignments 
WHERE assigned_tutor_id IS NOT NULL;

SELECT 'Main tutors (no parent)' as info, COUNT(*) as count 
FROM users 
WHERE role_id = 2 AND parent_tutor_id IS NULL;

SELECT 'Sub tutors (have parent)' as info, COUNT(*) as count 
FROM users 
WHERE role_id = 2 AND parent_tutor_id IS NOT NULL;


