-- Add delivered_at to messages table for message status (sent → delivered → read)
-- Run: sudo mysql db_lms < backend/migrations/add_message_delivered_at.sql
-- If column exists, ignore "Duplicate column" error.

USE db_lms;

ALTER TABLE messages ADD COLUMN delivered_at TIMESTAMP NULL DEFAULT NULL;
