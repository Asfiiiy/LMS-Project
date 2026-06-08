-- ============================================
-- Performance Indexes for 5K-10K Concurrent Users
-- ============================================
-- Run this migration to optimize database queries
-- mysql -u lms_user -p db_lms < backend/migrations/add_performance_indexes.sql

-- ============================================
-- User Table Indexes
-- ============================================
-- Optimize login queries
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- ============================================
-- Course Assignment Indexes
-- ============================================
-- Optimize student course access
CREATE INDEX IF NOT EXISTS idx_course_assignments_student ON course_assignments(student_id, course_id);
CREATE INDEX IF NOT EXISTS idx_course_assignments_course ON course_assignments(course_id, status);
CREATE INDEX IF NOT EXISTS idx_course_assignments_status ON course_assignments(status, created_at);

-- ============================================
-- File Access Indexes
-- ============================================
-- Optimize course file access
CREATE INDEX IF NOT EXISTS idx_course_files_course ON course_files(course_id);
CREATE INDEX IF NOT EXISTS idx_course_files_type ON course_files(course_id, file_type);

-- Optimize qualification submission files
CREATE INDEX IF NOT EXISTS idx_qual_submission_files_submission ON qual_submission_files(submission_id);
CREATE INDEX IF NOT EXISTS idx_qual_submission_files_status ON qual_submission_files(submission_id, status);

-- ============================================
-- Notification Indexes
-- ============================================
-- Optimize notification queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_type ON notifications(user_id, type, is_read);

-- ============================================
-- Chat/Message Indexes
-- ============================================
-- Optimize message queries
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_read ON messages(conversation_id, is_read, created_at);

-- Optimize conversation queries
CREATE INDEX IF NOT EXISTS idx_conversations_user1 ON conversations(user1_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_conversations_user2 ON conversations(user2_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_conversations_users ON conversations(user1_id, user2_id);

-- ============================================
-- Activity Log Indexes
-- ============================================
-- Optimize system log queries
CREATE INDEX IF NOT EXISTS idx_system_logs_user_action ON system_logs(user_id, action, created_at);
CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_system_logs_action ON system_logs(action, created_at);

-- ============================================
-- Qualification Course Indexes
-- ============================================
-- Optimize qualification queries
CREATE INDEX IF NOT EXISTS idx_qual_submissions_student ON qual_submissions(student_id, unit_id);
CREATE INDEX IF NOT EXISTS idx_qual_submissions_unit ON qual_submissions(unit_id, status);
CREATE INDEX IF NOT EXISTS idx_qual_submissions_status ON qual_submissions(status, created_at);

-- ============================================
-- Forum Indexes
-- ============================================
-- Optimize forum queries
CREATE INDEX IF NOT EXISTS idx_forum_posts_author ON forum_posts(author_id, created_at);
CREATE INDEX IF NOT EXISTS idx_forum_posts_category ON forum_posts(category_id, created_at);
CREATE INDEX IF NOT EXISTS idx_forum_comments_post ON forum_comments(post_id, created_at);

-- ============================================
-- Payment Indexes
-- ============================================
-- Optimize payment queries
CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status, created_at);

-- ============================================
-- Verification
-- ============================================
-- Check indexes were created
SELECT 
    TABLE_NAME,
    INDEX_NAME,
    COLUMN_NAME
FROM 
    INFORMATION_SCHEMA.STATISTICS
WHERE 
    TABLE_SCHEMA = DATABASE()
    AND INDEX_NAME LIKE 'idx_%'
ORDER BY 
    TABLE_NAME, INDEX_NAME;
