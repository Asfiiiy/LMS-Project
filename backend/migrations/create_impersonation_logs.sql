-- Impersonation audit log for Admin Ghost Login feature
CREATE TABLE IF NOT EXISTS impersonation_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT NOT NULL,
  target_user_id INT NOT NULL,
  target_user_role VARCHAR(100),
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at DATETIME NULL,
  ip_address VARCHAR(45),
  INDEX idx_admin_id (admin_id),
  INDEX idx_target_user_id (target_user_id),
  INDEX idx_started_at (started_at),
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
