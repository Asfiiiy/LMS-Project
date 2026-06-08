-- Zoom Video Consultation Booking System
-- consultation_slots: available time slots created by admin
-- consultation_bookings: student bookings with Zoom meeting links

CREATE TABLE IF NOT EXISTS consultation_slots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_booked TINYINT(1) NOT NULL DEFAULT 0,
  created_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_date (date),
  INDEX idx_is_booked (is_booked),
  INDEX idx_created_by (created_by),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS consultation_bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slot_id INT NOT NULL,
  student_id INT NOT NULL,
  zoom_meeting_id VARCHAR(100) NULL,
  zoom_join_url TEXT NULL,
  zoom_start_url TEXT NULL,
  zoom_password VARCHAR(50) NULL,
  status ENUM('pending', 'confirmed', 'cancelled', 'completed') NOT NULL DEFAULT 'confirmed',
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_slot_id (slot_id),
  INDEX idx_student_id (student_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (slot_id) REFERENCES consultation_slots(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
