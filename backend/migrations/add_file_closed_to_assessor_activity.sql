-- Add file_closed to assessor_student_activity_logs activity_type ENUM
-- For tracking when assessor closes the file viewer (with duration)

ALTER TABLE assessor_student_activity_logs 
MODIFY COLUMN activity_type ENUM(
  'file_viewed',
  'file_closed',
  'file_downloaded', 
  'submission_graded',
  'feedback_given',
  'file_approved',
  'file_rejected',
  'resubmission_requested'
) NOT NULL COMMENT 'Type of activity';
