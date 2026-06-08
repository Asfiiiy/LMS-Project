-- Restore Original Unit Titles for Course 110
-- This script restores the descriptive unit titles that were lost

USE db_lms;

-- Show current state (broken)
SELECT id, course_id, title, order_index 
FROM units 
WHERE course_id = 110 
ORDER BY order_index;

-- Restore original titles
UPDATE units SET title = '1 - K/505/9496 - Principles Underpinning Health and Social Care' WHERE id = 149;
UPDATE units SET title = '2 - A/505/9521 - The Management of Quality in Health and Social Care' WHERE id = 150;
UPDATE units SET title = '3 - H/505/9500 - Research Project' WHERE id = 151;
UPDATE units SET title = '4 - A/505/9499 - Partnership Working in Health and Social Care' WHERE id = 152;
UPDATE units SET title = '5 - T/505/9520 - Working with Service users with Complex Needs' WHERE id = 153;

-- Show restored state
SELECT id, course_id, title, order_index 
FROM units 
WHERE course_id = 110 
ORDER BY order_index;

