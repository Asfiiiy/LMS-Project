# Database Schema Reader - Usage Guide

## Quick Start

```bash
# From backend directory
npm run read-schema

# Or directly
node scripts/readDatabaseSchema.js
```

## What It Does

This script reads your entire database schema and generates:
1. **Human-readable report** - Shows all tables with columns, types, constraints, indexes, and foreign keys
2. **SQL export** - Complete CREATE TABLE statements for all tables

## Output Files

Files are saved in `backend/database_schema/`:
- `schema_[timestamp].txt` - Human-readable format
- `schema_[timestamp].sql` - SQL CREATE TABLE statements

## Use Cases

### Before Creating New Tables
Run this script to:
- ✅ Check exact data types of foreign key columns
- ✅ Verify existing constraints and indexes
- ✅ Ensure compatibility with your new table design
- ✅ Avoid foreign key constraint errors

### Example: Creating `student_topic_deadlines` table

1. Run the script:
   ```bash
   npm run read-schema
   ```

2. Check the output for key tables:
   - `users.id` → `INT(11)`
   - `courses.id` → `INT(11)`
   - `cpd_topics.id` → `INT(11)`
   - `units.id` → `INT(11)`

3. Create your new table with matching data types:
   ```sql
   CREATE TABLE student_topic_deadlines (
     id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
     student_id INT(11) NOT NULL,  -- Matches users.id
     course_id INT(11) NOT NULL,   -- Matches courses.id
     topic_id INT(11) NOT NULL,    -- Matches cpd_topics.id or units.id
     ...
   );
   ```

## Key Tables Reference

The script automatically checks for these important tables:
- ✅ `users` - User accounts
- ✅ `courses` - Course definitions
- ✅ `cpd_topics` - CPD course topics
- ✅ `units` - Qualification course units
- ✅ `course_assignments` - Student enrollments

## Environment Setup

Make sure your `.env` file has:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=db_lms
DB_PORT=3306
```

## Troubleshooting

### Connection Error
- Check your `.env` file has correct database credentials
- Verify MySQL server is running
- Check database name exists

### Permission Error
- Ensure database user has `SELECT` permission on `information_schema` database
- Check user has access to your database

