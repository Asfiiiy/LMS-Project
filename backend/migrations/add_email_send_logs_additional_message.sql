-- Snapshot of "Additional message" merged into {{email_body}} (run after body column migration if used).
ALTER TABLE email_send_logs
  ADD COLUMN additional_message LONGTEXT NULL COMMENT 'HTML/text for {{email_body}} at send time' AFTER body;
