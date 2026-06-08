-- Add 'ticket' to conversations.conversation_type ENUM
-- Run this migration so claim ticket can create conversation_type = 'ticket'

-- Use your DB name if different
-- USE db_lms;

ALTER TABLE conversations
MODIFY COLUMN conversation_type ENUM('direct', 'group', 'course', 'ticket') NULL DEFAULT 'direct';

SELECT 'conversation_type ENUM updated: ticket added.' AS result;
