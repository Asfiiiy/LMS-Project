#!/usr/bin/env node
/**
 * Run add_parent_message_id migration.
 * Usage: node backend/scripts/run_parent_message_id_migration.js
 * Or from backend: node scripts/run_parent_message_id_migration.js
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const pool = require('../config/db');

async function run() {
  try {
    await pool.query(`
      ALTER TABLE messages
      ADD COLUMN parent_message_id INT NULL DEFAULT NULL,
      ADD INDEX idx_messages_parent (parent_message_id)
    `);
    console.log('Migration completed: parent_message_id added to messages.');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME' || err.message?.includes('Duplicate column')) {
      console.log('Column parent_message_id already exists; migration skipped.');
      process.exit(0);
      return;
    }
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
