-- Add is_new column to track unviewed files for tutors
USE db_lms;

-- Add is_new column (default 1 = new/unviewed)
ALTER TABLE assignment_submission_files 
ADD COLUMN is_new TINYINT(1) DEFAULT 1 AFTER status;

-- Add index for faster queries
CREATE INDEX idx_is_new ON assignment_submission_files(is_new);

SELECT 'Schema updated successfully!' AS result;
