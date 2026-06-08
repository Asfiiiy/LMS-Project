-- Add Team Member role for Operation Manager's team users
-- Team Members: created by Operation Manager, only perform ticket work in manager's department
-- Run: mysql -u user -p db_lms < add_team_member_role.sql

USE db_lms;

INSERT INTO roles (name) 
SELECT 'Team Member' 
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Team Member');

SELECT id, name FROM roles WHERE name = 'Team Member';
