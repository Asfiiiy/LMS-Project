const pool = require('./config/db');

async function updateDatabase() {
  console.log('🔄 Updating database schema...\n');
  
  try {
    // Add certificate_pdf_path column if it doesn't exist
    console.log('📋 Adding certificate_pdf_path column...');
    try {
      await pool.execute(`
        ALTER TABLE generated_certificates 
        ADD COLUMN certificate_pdf_path VARCHAR(500)
      `);
      console.log('✅ certificate_pdf_path column added');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('✅ certificate_pdf_path column already exists');
      } else {
        throw error;
      }
    }
    
    // Add transcript_pdf_path column if it doesn't exist
    console.log('📋 Adding transcript_pdf_path column...');
    try {
      await pool.execute(`
        ALTER TABLE generated_certificates 
        ADD COLUMN transcript_pdf_path VARCHAR(500)
      `);
      console.log('✅ transcript_pdf_path column added');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('✅ transcript_pdf_path column already exists');
      } else {
        throw error;
      }
    }
    
    // Show current table structure
    console.log('\n📊 Current table structure:');
    const [columns] = await pool.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'db_lms' AND TABLE_NAME = 'generated_certificates' 
      ORDER BY ORDINAL_POSITION
    `);
    
    columns.forEach(col => {
      console.log(`   ${col.COLUMN_NAME.padEnd(30)} | ${col.DATA_TYPE.padEnd(15)} | ${col.IS_NULLABLE}`);
    });
    
    console.log('\n✅ Database update completed successfully!');
    
  } catch (error) {
    console.error('❌ Database update failed:', error.message);
  } finally {
    await pool.end();
  }
}

updateDatabase();
