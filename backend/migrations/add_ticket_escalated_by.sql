-- Add escalated_by to track who escalated the ticket to tutor
ALTER TABLE tickets ADD COLUMN escalated_by INT NULL AFTER escalated_to;
ALTER TABLE tickets ADD CONSTRAINT fk_tickets_escalated_by FOREIGN KEY (escalated_by) REFERENCES users(id) ON DELETE SET NULL;
