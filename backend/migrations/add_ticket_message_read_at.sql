-- Add read_at to ticket_messages for read receipts (double tick when seen)
USE db_lms;

ALTER TABLE ticket_messages
  ADD COLUMN read_at TIMESTAMP NULL DEFAULT NULL AFTER created_at,
  ADD INDEX idx_ticket_messages_read (read_at);
