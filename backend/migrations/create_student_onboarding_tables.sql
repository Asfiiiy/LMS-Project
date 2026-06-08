-- Student Onboarding System Migration
-- Run this migration to create all tables needed for the student onboarding flow

-- 1. Student Onboarding Status Table
CREATE TABLE IF NOT EXISTS `student_onboarding_status` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT UNIQUE NOT NULL,
  `current_step` VARCHAR(50) DEFAULT 'welcome',
  `welcome_completed` BOOLEAN DEFAULT FALSE,
  `course_selection_completed` BOOLEAN DEFAULT FALSE,
  `qualification_selection_completed` BOOLEAN DEFAULT FALSE,
  `documents_uploaded` BOOLEAN DEFAULT FALSE,
  `initial_assessment_completed` BOOLEAN DEFAULT FALSE,
  `vark_assessment_completed` BOOLEAN DEFAULT FALSE,
  `admin_verified` BOOLEAN DEFAULT FALSE,
  `dashboard_access_granted` BOOLEAN DEFAULT FALSE,
  `verification_requested_at` TIMESTAMP NULL,
  `admin_verified_at` TIMESTAMP NULL,
  `admin_verified_by` INT NULL,
  `admin_notes` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`admin_verified_by`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_dashboard_access` (`dashboard_access_granted`),
  INDEX `idx_admin_verified` (`admin_verified`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Student Course Selections Table
CREATE TABLE IF NOT EXISTS `student_course_selections` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `cpd_courses` BOOLEAN DEFAULT FALSE,
  `qualifications` BOOLEAN DEFAULT FALSE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_user_course_selection` (`user_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Student Qualification Selections Table
CREATE TABLE IF NOT EXISTS `student_qualification_selections` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `level` INT NOT NULL,
  `entry_requirements_acknowledged` BOOLEAN DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_user_qualification` (`user_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_level` (`level`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Student Documents Table
CREATE TABLE IF NOT EXISTS `student_documents` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `document_type` ENUM('qualification', 'identity', 'cv') NOT NULL,
  `file_name` VARCHAR(255) NOT NULL,
  `file_url` VARCHAR(512) NOT NULL,
  `file_size` INT NOT NULL,
  `mime_type` VARCHAR(100) NOT NULL,
  `cloudinary_public_id` VARCHAR(255) NULL,
  `uploaded_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_document_type` (`document_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Student Initial Assessments Table
CREATE TABLE IF NOT EXISTS `student_initial_assessments` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT UNIQUE NOT NULL,
  
  -- Personal Information
  `full_name` VARCHAR(255) NOT NULL,
  `gender` VARCHAR(50) NOT NULL,
  `date_of_birth` DATE NOT NULL,
  `nationality` VARCHAR(100) NOT NULL,
  `primary_language` VARCHAR(100) NOT NULL,
  `contact_number` VARCHAR(50) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `postal_address` TEXT NOT NULL,
  `ethnicity` VARCHAR(100) NOT NULL,
  
  -- Motivation & Background
  `why_qualification` TEXT NOT NULL,
  `career_goals` TEXT NOT NULL,
  `employer_support` TEXT NOT NULL,
  
  -- Skills Assessment
  `english_literacy` VARCHAR(100) NOT NULL,
  `ict_skills` VARCHAR(100) NOT NULL,
  `special_learning_needs` TEXT NULL,
  
  -- E-Signature & Agreements
  `data_usage_consent` BOOLEAN NOT NULL DEFAULT FALSE,
  `assessment_accuracy_consent` BOOLEAN NOT NULL DEFAULT FALSE,
  `qualification_understanding` BOOLEAN NOT NULL DEFAULT FALSE,
  `apl_understanding` BOOLEAN NOT NULL DEFAULT FALSE,
  `signature_name` VARCHAR(255) NOT NULL,
  `signature_date` DATE NOT NULL,
  
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Verify tables were created
SELECT 'student_onboarding_status' as table_name, COUNT(*) as row_count FROM student_onboarding_status
UNION ALL
SELECT 'student_course_selections', COUNT(*) FROM student_course_selections
UNION ALL
SELECT 'student_qualification_selections', COUNT(*) FROM student_qualification_selections
UNION ALL
SELECT 'student_documents', COUNT(*) FROM student_documents
UNION ALL
SELECT 'student_initial_assessments', COUNT(*) FROM student_initial_assessments;
