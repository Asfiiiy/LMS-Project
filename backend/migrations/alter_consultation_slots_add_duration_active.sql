-- Add duration_minutes and is_active to consultation_slots
-- Run: mysql -u USER -p DB < backend/migrations/alter_consultation_slots_add_duration_active.sql

ALTER TABLE consultation_slots ADD COLUMN duration_minutes INT NULL AFTER end_time;
ALTER TABLE consultation_slots ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER is_booked;
