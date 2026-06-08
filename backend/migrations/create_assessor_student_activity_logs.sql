-- Migration: Create assessor_student_activity_logs table
-- Purpose: Track detailed assessor interactions with student submissions

CREATE TABLE IF NOT EXISTS assessor_student_activity_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  
  -- Core identifiers
  assessor_id INT NOT NULL COMMENT 'Assessor/Tutor user ID',
  student_id INT NOT NULL COMMENT 'Student user ID',
  submission_id INT NULL COMMENT 'Related qual_submissions.id',
  file_id INT NULL COMMENT 'Related assignment_submission_files.id',
  unit_id INT NULL COMMENT 'Related unit ID',
  course_id INT NULL COMMENT 'Related course ID',
  
  -- Activity details
  activity_type ENUM(
    'file_viewed',
    'file_downloaded', 
    'submission_graded',
    'feedback_given',
    'file_approved',
    'file_rejected',
    'resubmission_requested'
  ) NOT NULL COMMENT 'Type of activity',
  
  -- Time tracking
  activity_started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  activity_ended_at TIMESTAMP NULL COMMENT 'For tracking review duration',
  duration_seconds INT NULL COMMENT 'Time spent on activity',
  
  -- File details
  file_name VARCHAR(255) NULL,
  file_type VARCHAR(50) NULL COMMENT 'document, pdf, image, etc',
  file_size INT NULL,
  
  -- Grading/Feedback details
  grade_result ENUM('pass', 'refer', 'pending') NULL,
  feedback_text TEXT NULL,
  numeric_score DECIMAL(5,2) NULL,
  
  -- Session tracking
  session_id VARCHAR(100) NULL COMMENT 'Groups activities in same review session',
  
  -- Metadata
  ip_address VARCHAR(50) NULL,
  user_agent TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes for fast queries
  INDEX idx_assessor_student (assessor_id, student_id),
  INDEX idx_student_unit (student_id, unit_id),
  INDEX idx_submission (submission_id),
  INDEX idx_activity_type (activity_type),
  INDEX idx_created_at (created_at),
  INDEX idx_session (session_id),
  
  -- Foreign keys
  FOREIGN KEY (assessor_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (submission_id) REFERENCES qual_submissions(id) ON DELETE CASCADE,
  FOREIGN KEY (file_id) REFERENCES assignment_submission_files(id) ON DELETE SET NULL

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Detailed tracking of assessor activities on student submissions';

-- Create indexes for reporting queries
CREATE INDEX idx_assessor_activity_date ON assessor_student_activity_logs(assessor_id, created_at);
CREATE INDEX idx_student_activity_date ON assessor_student_activity_logs(student_id, created_at);
CREATE INDEX idx_unit_activity ON assessor_student_activity_logs(unit_id, created_at);
