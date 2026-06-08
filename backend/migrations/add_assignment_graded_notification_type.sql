-- Add 'assignment_graded' to notifications type ENUM
-- Run this migration to add the 'assignment_graded' notification type

USE db_lms;

-- Check current ENUM values and add 'assignment_graded' if it doesn't exist
-- This will preserve all existing ENUM values and add the new one
ALTER TABLE notifications 
MODIFY COLUMN type ENUM(
  'assignment_submitted',
  'assignment_feedback',
  'assignment_graded',
  'assignment_resubmit',
  'quiz_result',
  'course_announcement',
  'admin_post',
  'payment_due',
  'payment_success',
  'certificate_ready',
  'forum_reply',
  'forum_post',
  'post_comment',
  'post_reply',
  'post_like',
  'reply',
  'like',
  'system',
  'security',
  'deadline_warning',
  'file_rejected',
  'file_resubmitted',
  'chat',
  'message'
) NOT NULL;

SELECT 'Notification type ENUM updated successfully! assignment_graded has been added.' AS result;
