/**
 * Check if student_topic_deadlines table exists and has topic_type column
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'db_lms',
  port: process.env.DB_PORT || 3306
};

async function checkTable() {
  let connection;
  try {
    console.log('🔌 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    
    // Check if table exists
    const [tableCheck] = await connection.execute(
      `SELECT COUNT(*) as exists_count 
       FROM information_schema.tables 
       WHERE table_schema = DATABASE() 
       AND table_name = 'student_topic_deadlines'`
    );
    
    const tableExists = tableCheck[0].exists_count > 0;
    console.log('\n📊 Database Status:');
    console.log('='.repeat(50));
    console.log(`Table exists: ${tableExists ? '✅ YES' : '❌ NO'}`);
    
    if (tableExists) {
      // Check if topic_type column exists
      const [columnCheck] = await connection.execute(
        `SELECT COUNT(*) as exists_count 
         FROM information_schema.columns 
         WHERE table_schema = DATABASE() 
         AND table_name = 'student_topic_deadlines' 
         AND column_name = 'topic_type'`
      );
      
      const columnExists = columnCheck[0].exists_count > 0;
      console.log(`topic_type column exists: ${columnExists ? '✅ YES' : '❌ NO'}`);
      
      console.log('\n📋 Migration Recommendation:');
      console.log('='.repeat(50));
      if (columnExists) {
        console.log('✅ Your table is up to date! No migration needed.');
      } else {
        console.log('⚠️  You need to run:');
        console.log('   update_student_topic_deadlines_for_qualification_safe.sql');
      }
    } else {
      console.log('\n📋 Migration Recommendation:');
      console.log('='.repeat(50));
      console.log('⚠️  You need to run:');
      console.log('   create_student_topic_deadlines_simple.sql');
    }
    
    console.log('\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Connection closed.');
    }
  }
}

checkTable();


