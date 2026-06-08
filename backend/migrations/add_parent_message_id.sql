-- Add parent_message_id to messages table for reply-to-message (WhatsApp-style) feature.
-- Run this migration once before using reply-to in chat (e.g. mysql db_lms < backend/migrations/add_parent_message_id.sql).

ALTER TABLE messages
ADD COLUMN parent_message_id INT NULL DEFAULT NULL,
ADD INDEX idx_messages_parent (parent_message_id);

-- Optional: add foreign key if you want referential integrity
-- ALTER TABLE messages ADD CONSTRAINT fk_messages_parent FOREIGN KEY (parent_message_id) REFERENCES messages(id);
