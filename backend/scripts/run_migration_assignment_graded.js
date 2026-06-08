// Script to add 'assignment_graded' to notifications type ENUM
const pool = require('../config/db');

async function runMigration() {
  const connection = await pool.getConnection();
  
  try {
    console.log('🔄 Running migration: Add assignment_graded to notifications type ENUM...');
    
    // First, check current ENUM values
    const [columns] = await connection.execute(
      `SELECT COLUMN_TYPE 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'notifications' 
         AND COLUMN_NAME = 'type'`
    );
    
    if (columns.length === 0) {
      console.error('❌ notifications table or type column not found');
      process.exit(1);
    }
    
    const currentEnum = columns[0].COLUMN_TYPE;
    console.log('📋 Current ENUM:', currentEnum);
    
    // Check if 'assignment_graded' already exists
    if (currentEnum.includes('assignment_graded')) {
      console.log('✅ assignment_graded already exists in ENUM. No migration needed.');
      process.exit(0);
    }
    
    // Add 'assignment_graded' to the ENUM
    // We'll preserve all existing values and add the new one
    const sql = `ALTER TABLE notifications 
MODIFY COLUMN type ENUM(
  'assignment_submitted',
  'assignment_feedback',
  'assignment_graded',
  'assignment_resubmit',
  'quiz_result',
  'course_announcement',
  'admin_post',
  'payment_due',
  'payment_success',
  'certificate_ready',
  'forum_reply',
  'forum_post',
  'post_comment',
  'post_reply',
  'post_like',
  'reply',
  'like',
  'system',
  'security',
  'deadline_warning',
  'file_rejected',
  'file_resubmitted',
  'chat',
  'message'
) NOT NULL`;
    
    await connection.execute(sql);
    console.log('✅ Migration completed successfully! assignment_graded has been added to notifications type ENUM.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    connection.release();
    await pool.end();
    process.exit(0);
  }
}

runMigration();
