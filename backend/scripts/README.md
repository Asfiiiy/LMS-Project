# Database Schema Reader Script

This script reads all database tables and their structures, including columns, data types, constraints, indexes, and foreign keys.

## Usage

```bash
# From backend directory
node scripts/readDatabaseSchema.js
```

## What it does

1. **Connects to your database** using credentials from `.env` file
2. **Lists all tables** in the database
3. **Reads structure of each table:**
   - Column names and types
   - Nullable/Not Null constraints
   - Default values
   - Primary keys
   - Foreign keys (with referenced tables)
   - Indexes
   - Other constraints

4. **Generates two output files:**
   - `database_schema/schema_[timestamp].txt` - Human-readable format
   - `database_schema/schema_[timestamp].sql` - SQL CREATE TABLE statements

## Output

The script displays:
- Table list with column details
- Foreign key relationships
- Indexes
- Full CREATE TABLE SQL statements

## Example Output

```
================================================================================
TABLE: users
================================================================================

COLUMNS:
--------------------------------------------------------------------------------
  id                            INT NOT NULL AUTO_INCREMENT [PRI]
  name                          VARCHAR(100) NOT NULL
  email                         VARCHAR(100) NOT NULL
  password_hash                 VARCHAR(255) NOT NULL
  role_id                       INT NULL
  created_at                    TIMESTAMP DEFAULT CURRENT_TIMESTAMP

PRIMARY KEY:
--------------------------------------------------------------------------------
  id

FOREIGN KEYS:
--------------------------------------------------------------------------------
  fk_users_role_id:
    Column: role_id
    References: roles.id
    On Update: RESTRICT
    On Delete: RESTRICT
```

## Environment Variables

Make sure your `.env` file has:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=db_lms
DB_PORT=3306
```

## Use Case

Before creating new tables (like `student_topic_deadlines`), run this script to:
1. Verify the exact data types of foreign key columns
2. Check existing constraints and indexes
3. Ensure compatibility with your new table design

