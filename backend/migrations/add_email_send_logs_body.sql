-- Store rendered HTML for send history / resend. Run once (ignore error if column exists).
ALTER TABLE email_send_logs
  ADD COLUMN body LONGTEXT NULL COMMENT 'Rendered HTML snapshot' AFTER subject;
