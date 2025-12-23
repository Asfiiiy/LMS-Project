# Fix Course File Types - Course 48

## Problem
The course files were uploaded but their `file_type` is empty (`''`), so they don't show in the course view.

## Quick Fix - Run This SQL

Open your MySQL client and run this SQL to fix course 48:

```sql
-- Fix file types for course 48
UPDATE qual_course_files 
SET file_type = 'handbook' 
WHERE course_id = 48 
AND file_name LIKE '%handbook%';

UPDATE qual_course_files 
SET file_type = 'descriptor' 
WHERE course_id = 48 
AND file_name LIKE '%Descriptor%';

UPDATE qual_course_files 
SET file_type = 'general_info' 
WHERE course_id = 48 
AND (file_name LIKE '%FAQ%' OR file_name LIKE '%Referencing%' OR file_name LIKE '%plagiarism%');

-- Verify
SELECT id, file_type, file_name FROM qual_course_files WHERE course_id = 48;
```

## File Mapping (Based on Console Log)

From your console, here's what each file should be:

1. **Avoiding plagiarism exercise.pdf** → `general_info`
2. **Referencing Exercise.pdf** → `general_info`
3. **Harvard Referencing Guide.pdf** → `general_info`
4. **General FAQs. Qualifi..pdf** → `general_info`
5. **An Introduction to the Health and Social Care Module handbook.pdf** → `handbook`
6. **Course Descriptor Level 3 Diploma in Health and Social Care.pdf** → `descriptor`

## Manual Fix (Alternative)

If you prefer, you can manually update each file:

```sql
UPDATE qual_course_files SET file_type = 'handbook' WHERE id = 12;
UPDATE qual_course_files SET file_type = 'descriptor' WHERE id = 13;
UPDATE qual_course_files SET file_type = 'general_info' WHERE id = 8;
UPDATE qual_course_files SET file_type = 'general_info' WHERE id = 9;
UPDATE qual_course_files SET file_type = 'general_info' WHERE id = 10;
UPDATE qual_course_files SET file_type = 'general_info' WHERE id = 11;
```

## After Running SQL

1. Refresh the course view page
2. The files will now appear in their proper sections:
   - 📚 Course Handbook (1 file)
   - 📑 Course Descriptor (1 file)
   - 📋 General Information (4 files)

## For Future Courses

The backend code is already correct. This issue happened because the course was created before the file_type logic was fully implemented. New courses should work correctly.





















