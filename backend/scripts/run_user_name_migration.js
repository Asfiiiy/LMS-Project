#!/usr/bin/env node
/**
 * Migration Script: Add user_name to system_logs
 * Run: node backend/scripts/run_user_name_migration.js
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Database configuration from environment or defaults
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'lms_db',
  multipleStatements: true
};

async function runMigration() {
  let connection;
  
  try {
    console.log('🔄 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database');

    // Read migration file
    const migrationPath = path.join(__dirname, '../migrations/add_user_name_to_system_logs.sql');
    console.log('📄 Reading migration file:', migrationPath);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Execute migration
    console.log('⚙️  Executing migration...');
    await connection.query(sql);
    console.log('✅ Migration executed successfully');

    // Verify the column was added
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'system_logs'
      AND COLUMN_NAME = 'user_name'
    `);

    if (columns.length > 0) {
      console.log('✅ Verified: user_name column exists');
      console.log('   Type:', columns[0].COLUMN_TYPE);
      console.log('   Nullable:', columns[0].IS_NULLABLE);
    } else {
      console.log('⚠️  Warning: Could not verify user_name column');
    }

    console.log('\n✅ Migration completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Migration failed:');
    console.error('Error:', error.message);
    if (error.sql) {
      console.error('SQL:', error.sql);
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

runMigration();
