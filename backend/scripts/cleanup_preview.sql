-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- INSPIRE LMS — CLEANUP PREVIEW (READ-ONLY)
-- This script ONLY counts rows. Nothing is deleted.
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- ═══════════════════════════════════
-- ROWS THAT WILL BE DELETED
-- ═══════════════════════════════════

SELECT '── LOGS ──' as table_name, '' as rows_to_delete

UNION ALL SELECT 'system_logs', COUNT(*) FROM system_logs
UNION ALL SELECT 'system_logs_archive', COUNT(*) FROM system_logs_archive
UNION ALL SELECT 'ai_action_logs', COUNT(*) FROM ai_action_logs
UNION ALL SELECT 'impersonation_logs', COUNT(*) FROM impersonation_logs
UNION ALL SELECT 'assessor_student_activity_logs', COUNT(*) FROM assessor_student_activity_logs
UNION ALL SELECT 'log_exports', COUNT(*) FROM log_exports
UNION ALL SELECT 'log_filter_presets', COUNT(*) FROM log_filter_presets

UNION ALL SELECT '── NOTIFICATIONS ──', ''
UNION ALL SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL SELECT 'student_notifications', COUNT(*) FROM student_notifications
UNION ALL SELECT 'admin_notifications', COUNT(*) FROM admin_notifications
UNION ALL SELECT 'qual_tutor_notifications', COUNT(*) FROM qual_tutor_notifications

UNION ALL SELECT '── CHAT & MESSAGES ──', ''
UNION ALL SELECT 'message_read_receipts', COUNT(*) FROM message_read_receipts
UNION ALL SELECT 'messages', COUNT(*) FROM messages
UNION ALL SELECT 'chat_messages', COUNT(*) FROM chat_messages
UNION ALL SELECT 'conversation_participants', COUNT(*) FROM conversation_participants
UNION ALL SELECT 'conversations', COUNT(*) FROM conversations

UNION ALL SELECT '── TICKETS ──', ''
UNION ALL SELECT 'internal_notes', COUNT(*) FROM internal_notes
UNION ALL SELECT 'ticket_messages', COUNT(*) FROM ticket_messages
UNION ALL SELECT 'tickets', COUNT(*) FROM tickets

UNION ALL SELECT '── FORUM ──', ''
UNION ALL SELECT 'forum_comment_likes', COUNT(*) FROM forum_comment_likes
UNION ALL SELECT 'forum_post_likes', COUNT(*) FROM forum_post_likes
UNION ALL SELECT 'comments', COUNT(*) FROM comments
UNION ALL SELECT 'forum_comments', COUNT(*) FROM forum_comments
UNION ALL SELECT 'forum_posts', COUNT(*) FROM forum_posts
UNION ALL SELECT 'forums', COUNT(*) FROM forums

UNION ALL SELECT '── CERTIFICATES ──', ''
UNION ALL SELECT 'certificate_generation_log', COUNT(*) FROM certificate_generation_log
UNION ALL SELECT 'generated_certificates', COUNT(*) FROM generated_certificates
UNION ALL SELECT 'certificate_claims', COUNT(*) FROM certificate_claims
UNION ALL SELECT 'certificates', COUNT(*) FROM certificates
UNION ALL SELECT 'cpd_certificates', COUNT(*) FROM cpd_certificates

UNION ALL SELECT '── CONSULTATIONS ──', ''
UNION ALL SELECT 'consultation_bookings', COUNT(*) FROM consultation_bookings
UNION ALL SELECT 'consultation_slots', COUNT(*) FROM consultation_slots

UNION ALL SELECT '── SUBMISSIONS & GRADES ──', ''
UNION ALL SELECT 'assignment_submission_files', COUNT(*) FROM assignment_submission_files
UNION ALL SELECT 'qual_submissions', COUNT(*) FROM qual_submissions
UNION ALL SELECT 'assignment_submissions', COUNT(*) FROM assignment_submissions
UNION ALL SELECT 'qual_unit_progress', COUNT(*) FROM qual_unit_progress
UNION ALL SELECT 'unit_progress', COUNT(*) FROM unit_progress
UNION ALL SELECT 'quiz_submissions', COUNT(*) FROM quiz_submissions

UNION ALL SELECT '── CPD PROGRESS ──', ''
UNION ALL SELECT 'cpd_quiz_answers', COUNT(*) FROM cpd_quiz_answers
UNION ALL SELECT 'cpd_quiz_attempts', COUNT(*) FROM cpd_quiz_attempts
UNION ALL SELECT 'cpd_progress', COUNT(*) FROM cpd_progress

UNION ALL SELECT '── ONBOARDING & DOCUMENTS ──', ''
UNION ALL SELECT 'document_verification_history', COUNT(*) FROM document_verification_history
UNION ALL SELECT 'student_documents', COUNT(*) FROM student_documents
UNION ALL SELECT 'student_onboarding_status', COUNT(*) FROM student_onboarding_status
UNION ALL SELECT 'student_initial_assessments', COUNT(*) FROM student_initial_assessments
UNION ALL SELECT 'student_course_selections', COUNT(*) FROM student_course_selections
UNION ALL SELECT 'student_qualification_selections', COUNT(*) FROM student_qualification_selections

UNION ALL SELECT '── PROFILES ──', ''
UNION ALL SELECT 'student_profiles', COUNT(*) FROM student_profiles
UNION ALL SELECT 'staff_profiles', COUNT(*) FROM staff_profiles

UNION ALL SELECT '── PAYMENTS ──', ''
UNION ALL SELECT 'payment_reminders', COUNT(*) FROM payment_reminders
UNION ALL SELECT 'payment_audit_log', COUNT(*) FROM payment_audit_log
UNION ALL SELECT 'student_payment_installments', COUNT(*) FROM student_payment_installments

UNION ALL SELECT '── ENROLLMENTS & ASSIGNMENTS ──', ''
UNION ALL SELECT 'student_topic_deadlines', COUNT(*) FROM student_topic_deadlines
UNION ALL SELECT 'qual_student_selected_units', COUNT(*) FROM qual_student_selected_units
UNION ALL SELECT 'course_assignments', COUNT(*) FROM course_assignments
UNION ALL SELECT 'badges', COUNT(*) FROM badges

UNION ALL SELECT '── USERS (non-admin) ──', ''
UNION ALL SELECT 'users (non-admin, role_id != 1)', COUNT(*) FROM users WHERE role_id != 1

-- ═══════════════════════════════════
-- ROWS THAT WILL BE KEPT (SAFE)
-- ═══════════════════════════════════

UNION ALL SELECT '══════════════════════════', ''
UNION ALL SELECT 'admin users (KEEPING)', COUNT(*) FROM users WHERE role_id = 1
UNION ALL SELECT 'roles (KEEPING)', COUNT(*) FROM roles
UNION ALL SELECT 'courses (KEEPING)', COUNT(*) FROM courses
UNION ALL SELECT 'units (KEEPING)', COUNT(*) FROM units
UNION ALL SELECT 'qual_units (KEEPING)', COUNT(*) FROM qual_units
UNION ALL SELECT 'qual_topics (KEEPING)', COUNT(*) FROM qual_topics
UNION ALL SELECT 'qual_course_content (KEEPING)', COUNT(*) FROM qual_course_content
UNION ALL SELECT 'qual_course_files (KEEPING)', COUNT(*) FROM qual_course_files
UNION ALL SELECT 'qual_assignment_briefs (KEEPING)', COUNT(*) FROM qual_assignment_briefs
UNION ALL SELECT 'qual_assignment_brief_files (KEEPING)', COUNT(*) FROM qual_assignment_brief_files
UNION ALL SELECT 'qual_unit_announcements (KEEPING)', COUNT(*) FROM qual_unit_announcements
UNION ALL SELECT 'course_categories (KEEPING)', COUNT(*) FROM course_categories
UNION ALL SELECT 'sub_categories (KEEPING)', COUNT(*) FROM sub_categories
UNION ALL SELECT 'departments (KEEPING)', COUNT(*) FROM departments
UNION ALL SELECT 'cpd_topics (KEEPING)', COUNT(*) FROM cpd_topics
UNION ALL SELECT 'cpd_topic_sections (KEEPING)', COUNT(*) FROM cpd_topic_sections
UNION ALL SELECT 'cpd_topic_files (KEEPING)', COUNT(*) FROM cpd_topic_files
UNION ALL SELECT 'cpd_quizzes (KEEPING)', COUNT(*) FROM cpd_quizzes
UNION ALL SELECT 'cpd_quiz_questions (KEEPING)', COUNT(*) FROM cpd_quiz_questions
UNION ALL SELECT 'cpd_quiz_options (KEEPING)', COUNT(*) FROM cpd_quiz_options
UNION ALL SELECT 'cpd_announcements (KEEPING)', COUNT(*) FROM cpd_announcements
UNION ALL SELECT 'cpd_announcement_files (KEEPING)', COUNT(*) FROM cpd_announcement_files
UNION ALL SELECT 'cpd_faq (KEEPING)', COUNT(*) FROM cpd_faq
UNION ALL SELECT 'cpd_faq_files (KEEPING)', COUNT(*) FROM cpd_faq_files
UNION ALL SELECT 'level_courses_catalog (KEEPING)', COUNT(*) FROM level_courses_catalog
UNION ALL SELECT 'certificate_catalog (KEEPING)', COUNT(*) FROM certificate_catalog
UNION ALL SELECT 'certificate_pricing (KEEPING)', COUNT(*) FROM certificate_pricing
UNION ALL SELECT 'certificate_templates (KEEPING)', COUNT(*) FROM certificate_templates
UNION ALL SELECT 'email_templates (KEEPING)', COUNT(*) FROM email_templates
UNION ALL SELECT 'auto_reminder_settings (KEEPING)', COUNT(*) FROM auto_reminder_settings
UNION ALL SELECT 'backup_settings (KEEPING)', COUNT(*) FROM backup_settings
UNION ALL SELECT 'backup_logs (KEEPING)', COUNT(*) FROM backup_logs
UNION ALL SELECT 'consultation_manager_settings (KEEPING)', COUNT(*) FROM consultation_manager_settings
UNION ALL SELECT 'forum_categories (KEEPING)', COUNT(*) FROM forum_categories
UNION ALL SELECT 'ai_tokens (KEEPING)', COUNT(*) FROM ai_tokens
UNION ALL SELECT 'ai_token_ip_tracking (KEEPING)', COUNT(*) FROM ai_token_ip_tracking
;
