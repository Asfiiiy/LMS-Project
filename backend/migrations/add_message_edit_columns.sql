-- Add is_edited and edited_at columns to messages table for message editing feature
-- Run this migration to add support for editing messages

ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS is_edited TINYINT(1) DEFAULT 0,
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP NULL;

-- Note: IF NOT EXISTS is MySQL 8.0.19+ syntax
-- For older MySQL versions, run without IF NOT EXISTS and ignore error if columns already exist
