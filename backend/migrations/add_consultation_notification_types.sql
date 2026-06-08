-- Add consultation notification types to notifications.type ENUM
-- Run: mysql -u USER -p DB < backend/migrations/add_consultation_notification_types.sql
-- Or let the app auto-migrate on first consultation request

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
  'message',
  'consultation_confirmed',
  'consultation_new',
  'consultation_cancelled'
) NOT NULL;
