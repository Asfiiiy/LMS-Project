-- ============================================
-- Department-Based Ticket & Chat Support System
-- ============================================
-- Run: sudo mysql db_lms < backend/migrations/create_ticket_system.sql
-- If "department_id already exists" error: run add_ticket_department_id.sql instead for step 2

USE db_lms;

-- ============================================
-- 1. DEPARTMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(20) NOT NULL DEFAULT '#6B7280',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_departments_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO departments (name, color) VALUES 
  ('Academic', '#8B5CF6'),
  ('Finance', '#10B981'),
  ('Support', '#F97316')
ON DUPLICATE KEY UPDATE color = VALUES(color);

-- ============================================
-- 2. ADD DEPARTMENT_ID TO USERS
-- ============================================
ALTER TABLE users ADD COLUMN department_id INT NULL AFTER role_id;
ALTER TABLE users ADD CONSTRAINT fk_users_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;

-- ============================================
-- 3. ADD ADMISSION MANAGER ROLE
-- ============================================
INSERT INTO roles (name) 
SELECT 'Admission Manager' 
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Admission Manager');

-- ============================================
-- 4. TICKETS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS tickets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  department_id INT NOT NULL,
  assigned_to INT NULL,
  subject VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  status ENUM('open', 'in_progress', 'resolved', 'escalated') NOT NULL DEFAULT 'open',
  priority ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'medium',
  conversation_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL,
  escalated_at TIMESTAMP NULL,
  escalated_to INT NULL,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL,
  FOREIGN KEY (escalated_to) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_tickets_department (department_id),
  INDEX idx_tickets_status (status),
  INDEX idx_tickets_assigned (assigned_to),
  INDEX idx_tickets_student (student_id),
  INDEX idx_tickets_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 5. TICKET_MESSAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS ticket_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ticket_id INT NOT NULL,
  sender_id INT NOT NULL,
  message TEXT NOT NULL,
  file_url VARCHAR(500) NULL,
  file_name VARCHAR(255) NULL,
  file_type VARCHAR(50) NULL,
  is_internal TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_ticket_messages_ticket (ticket_id),
  INDEX idx_ticket_messages_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 6. INTERNAL_NOTES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS internal_notes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ticket_id INT NOT NULL,
  user_id INT NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_internal_notes_ticket (ticket_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT 'Ticket system migration completed!' AS result;
SELECT id, name, color FROM departments;
