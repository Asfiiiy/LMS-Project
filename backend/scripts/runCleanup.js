const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function getConnection() {
  return mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'db_lms',
    multipleStatements: true
  });
}

async function runPreview() {
  const conn = await getConnection();

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 PREVIEW — What will be deleted');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  const sql = fs.readFileSync(path.join(__dirname, 'cleanup_preview.sql'), 'utf8');
  const [results] = await conn.query(sql);

  const rows = Array.isArray(results[0]) ? results[0] : results;
  let totalDelete = 0;

  for (const row of rows) {
    const name = row.table_name;
    const count = row.rows_to_delete;

    if (count === '') {
      console.log(`\n  ${name}`);
      continue;
    }

    const num = parseInt(count) || 0;
    const isKeeping = name.includes('KEEPING');
    const isSeparator = name.startsWith('═');

    if (isSeparator) {
      console.log(`\n${'═'.repeat(50)}`);
      console.log('  ROWS THAT WILL BE KEPT (SAFE)');
      console.log('═'.repeat(50));
      continue;
    }

    if (isKeeping) {
      console.log(`  ✅  ${name.replace(' (KEEPING)', '').padEnd(38)} ${String(num).padStart(6)}`);
    } else {
      console.log(`  🗑️   ${name.padEnd(38)} ${String(num).padStart(6)}`);
      totalDelete += num;
    }
  }

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Total rows to delete: ${totalDelete.toLocaleString()}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('  If this looks correct, run:');
  console.log('  node backend/scripts/runCleanup.js --execute');
  console.log('');

  await conn.end();
}

async function runExecute() {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧹 EXECUTING DATABASE CLEANUP');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  const conn = await getConnection();

  try {
    const sql = fs.readFileSync(path.join(__dirname, 'cleanup_execute.sql'), 'utf8');
    const [results] = await conn.query(sql);

    console.log('✅ Database cleaned successfully!');
    console.log('');
    console.log('What was kept:');
    console.log('  ✅ All admin accounts');
    console.log('  ✅ All roles');
    console.log('  ✅ All courses and content');
    console.log('  ✅ All settings and templates');
    console.log('  ✅ All table structures');
    console.log('');

    const verifyResults = results.filter(r => Array.isArray(r) && r.length > 0 && r[0].check_item);
    if (verifyResults.length > 0) {
      console.log('Verification:');
      for (const row of verifyResults[0]) {
        console.log(`  ${row.check_item}: ${row.count}`);
      }
    }

    console.log('');
    console.log('Ready for real student data! 🎉');
  } catch (err) {
    console.error('❌ Cleanup failed:', err.message);
    console.error('');
    console.error('The transaction was rolled back — database was NOT changed.');
    console.error('Fix the error and try again.');
    process.exitCode = 1;
  }

  await conn.end();
}

const args = process.argv.slice(2);

if (args.includes('--execute')) {
  console.log('');
  console.log('⚠️  WARNING: This will permanently delete all test/dummy data!');
  console.log('   Admin accounts, courses, content, and settings are safe.');
  console.log('   You have 5 seconds to cancel (Ctrl+C)...');
  console.log('');

  let countdown = 5;
  const timer = setInterval(() => {
    countdown--;
    if (countdown > 0) {
      process.stdout.write(`   ${countdown}...\r`);
    } else {
      clearInterval(timer);
      console.log('   Executing now...                    ');
      runExecute().catch(err => {
        console.error('Fatal error:', err.message);
        process.exit(1);
      });
    }
  }, 1000);
} else {
  runPreview().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}
