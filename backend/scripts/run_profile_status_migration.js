const mysql = require('mysql2/promise');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true
  });

  try {
    console.log('🔄 Running onboarding profile status migration...');
    
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, '../migrations/add_onboarding_profile_status.sql'),
      'utf8'
    );

    await connection.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    console.log('✅ Added onboarding_profile_status column to users table');
    console.log('✅ Updated existing student statuses based on onboarding state');
    
    // Show statistics
    const [newCount] = await connection.query(
      "SELECT COUNT(*) as count FROM users WHERE role_id = 4 AND onboarding_profile_status = 'new'"
    );
    const [reviewCount] = await connection.query(
      "SELECT COUNT(*) as count FROM users WHERE role_id = 4 AND onboarding_profile_status = 'review'"
    );
    const [verifiedCount] = await connection.query(
      "SELECT COUNT(*) as count FROM users WHERE role_id = 4 AND onboarding_profile_status = 'verified'"
    );
    
    console.log('\n📊 Status Distribution:');
    console.log(`   - New: ${newCount[0].count}`);
    console.log(`   - Review: ${reviewCount[0].count}`);
    console.log(`   - Verified: ${verifiedCount[0].count}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

runMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
