-- Per-student qualification unit: allow admin override of assignment submission deadline window
ALTER TABLE student_topic_deadlines
  ADD COLUMN assignment_submission_unlocked TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1 = admin manually unlocked submission regardless of deadline',
  ADD COLUMN unlocked_by INT NULL COMMENT 'Admin user who unlocked',
  ADD COLUMN unlocked_at TIMESTAMP NULL DEFAULT NULL;
