-- Master toggle + offline message for Consultation Manager portal
-- Run: mysql -u USER -p DB < backend/migrations/add_consultation_manager_settings.sql

CREATE TABLE IF NOT EXISTS consultation_manager_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  is_enabled TINYINT(1) NOT NULL DEFAULT 1,
  disabled_message TEXT NOT NULL,
  updated_by INT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO consultation_manager_settings (id, is_enabled, disabled_message) VALUES (
  1,
  1,
  'The Consultation Manager portal is currently offline. Please check back later or contact your administrator.'
);
