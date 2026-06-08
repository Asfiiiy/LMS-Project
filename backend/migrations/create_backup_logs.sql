CREATE TABLE IF NOT EXISTS backup_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  backup_type ENUM('daily','weekly','manual') NOT NULL DEFAULT 'manual',
  status ENUM('success','failed','running','deleted') NOT NULL DEFAULT 'running',
  filename VARCHAR(255) NULL,
  size_mb DECIMAL(10,2) NULL,
  error_message TEXT NULL,
  triggered_by INT NULL COMMENT 'user id if manual, null if cron',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (triggered_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS backup_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  daily_enabled TINYINT(1) DEFAULT 1,
  weekly_enabled TINYINT(1) DEFAULT 1,
  daily_time VARCHAR(5) DEFAULT '02:00',
  weekly_day TINYINT DEFAULT 0 COMMENT '0=Sunday, 1=Monday...',
  max_daily_backups INT DEFAULT 30,
  max_weekly_backups INT DEFAULT 12,
  notify_admin_email TINYINT(1) DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO backup_settings (daily_enabled, weekly_enabled)
VALUES (1, 1)
ON DUPLICATE KEY UPDATE id=id;
