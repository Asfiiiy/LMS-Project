-- Add 'transferred' to ticket status ENUM
-- When a ticket is forwarded to another department without assigning, show "Transferred" so receiving dept can view and claim
-- Run: sudo mysql db_lms < backend/migrations/add_ticket_transferred_status.sql

USE db_lms;

ALTER TABLE tickets 
MODIFY COLUMN status ENUM('open', 'in_progress', 'resolved', 'escalated', 'transferred') NOT NULL DEFAULT 'open';

SELECT 'Ticket status ENUM updated: transferred added.' AS result;
