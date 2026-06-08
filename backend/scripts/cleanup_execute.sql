-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- INSPIRE LMS — DATABASE CLEANUP (EXECUTE)
-- Removes all test/dummy data. Keeps structure,
-- admin users, courses, content, and settings.
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SET FOREIGN_KEY_CHECKS = 0;
START TRANSACTION;

-- ═══════════════════════════════════
-- 1. LOGS (no dependencies)
-- ═══════════════════════════════════
DELETE FROM system_logs;
DELETE FROM system_logs_archive;
DELETE FROM ai_action_logs;
DELETE FROM impersonation_logs;
DELETE FROM assessor_student_activity_logs;
DELETE FROM log_exports;
DELETE FROM log_filter_presets;

-- ═══════════════════════════════════
-- 2. NOTIFICATIONS
-- ═══════════════════════════════════
DELETE FROM notifications;
DELETE FROM student_notifications;
DELETE FROM admin_notifications;
DELETE FROM qual_tutor_notifications;

-- ═══════════════════════════════════
-- 3. CHAT & MESSAGES
-- ═══════════════════════════════════
DELETE FROM message_read_receipts;
DELETE FROM messages;
DELETE FROM chat_messages;
DELETE FROM conversation_participants;
DELETE FROM conversations;

-- ═══════════════════════════════════
-- 4. TICKETS
-- ═══════════════════════════════════
DELETE FROM internal_notes;
DELETE FROM ticket_messages;
DELETE FROM tickets;

-- ═══════════════════════════════════
-- 5. FORUM (reactions → comments → posts → forums)
-- ═══════════════════════════════════
DELETE FROM forum_comment_likes;
DELETE FROM forum_post_likes;
DELETE FROM comments;
DELETE FROM forum_comments;
DELETE FROM forum_posts;
DELETE FROM forums;

-- ═══════════════════════════════════
-- 6. CERTIFICATES
-- ═══════════════════════════════════
DELETE FROM certificate_generation_log;
DELETE FROM generated_certificates;
DELETE FROM certificate_claims;
DELETE FROM certificates;
DELETE FROM cpd_certificates;
DELETE FROM certificate_registration_sequence;

-- ═══════════════════════════════════
-- 7. CONSULTATIONS
-- ═══════════════════════════════════
DELETE FROM consultation_bookings;
DELETE FROM consultation_slots;

-- ═══════════════════════════════════
-- 8. SUBMISSIONS & GRADES
-- ═══════════════════════════════════
DELETE FROM assignment_submission_files;
DELETE FROM qual_submissions;
DELETE FROM assignment_submissions;
DELETE FROM qual_unit_progress;
DELETE FROM unit_progress;
DELETE FROM quiz_submissions;

-- ═══════════════════════════════════
-- 9. CPD PROGRESS
-- ═══════════════════════════════════
DELETE FROM cpd_quiz_answers;
DELETE FROM cpd_quiz_attempts;
DELETE FROM cpd_progress;

-- ═══════════════════════════════════
-- 10. ONBOARDING & DOCUMENTS
-- ═══════════════════════════════════
DELETE FROM document_verification_history;
DELETE FROM student_documents;
DELETE FROM student_onboarding_status;
DELETE FROM student_initial_assessments;
DELETE FROM student_course_selections;
DELETE FROM student_qualification_selections;

-- ═══════════════════════════════════
-- 11. PROFILES
-- ═══════════════════════════════════
DELETE FROM student_profiles;
DELETE FROM staff_profiles;

-- ═══════════════════════════════════
-- 12. PAYMENTS
-- ═══════════════════════════════════
DELETE FROM payment_reminders;
DELETE FROM payment_audit_log;
DELETE FROM student_payment_installments;

-- ═══════════════════════════════════
-- 13. ENROLLMENTS & ASSIGNMENTS
-- ═══════════════════════════════════
DELETE FROM student_topic_deadlines;
DELETE FROM qual_student_selected_units;
DELETE FROM course_assignments;
DELETE FROM badges;

-- ═══════════════════════════════════
-- 14. NON-ADMIN USERS (LAST)
-- ═══════════════════════════════════
DELETE FROM users WHERE role_id != 1;

COMMIT;
SET FOREIGN_KEY_CHECKS = 1;

SELECT 'Cleanup completed successfully!' as status;

-- ═══════════════════════════════════
-- VERIFICATION — What remains
-- ═══════════════════════════════════
SELECT 'admin users remaining' as check_item, COUNT(*) as count FROM users WHERE role_id = 1
UNION ALL SELECT 'total users remaining', COUNT(*) FROM users
UNION ALL SELECT 'roles', COUNT(*) FROM roles
UNION ALL SELECT 'courses', COUNT(*) FROM courses
UNION ALL SELECT 'units', COUNT(*) FROM units
UNION ALL SELECT 'course_categories', COUNT(*) FROM course_categories
UNION ALL SELECT 'email_templates', COUNT(*) FROM email_templates
UNION ALL SELECT 'backup_settings', COUNT(*) FROM backup_settings
UNION ALL SELECT 'departments', COUNT(*) FROM departments;
