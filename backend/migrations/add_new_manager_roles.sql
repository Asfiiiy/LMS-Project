-- Add new manager roles: Operation Manager, Accounts Manager, Administrative Manager
-- Run this migration to add the three new manager roles to the roles table

USE db_lms;

-- Check if roles already exist before inserting
INSERT INTO roles (name) 
SELECT 'Operation Manager' 
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Operation Manager');

INSERT INTO roles (name) 
SELECT 'Accounts Manager' 
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Accounts Manager');

INSERT INTO roles (name) 
SELECT 'Administrative Manager' 
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Administrative Manager');

-- Verify the roles were added
SELECT id, name FROM roles WHERE name IN ('Operation Manager', 'Accounts Manager', 'Administrative Manager') ORDER BY id;

SELECT 'New manager roles added successfully!' AS result;
