/**
 * Database Analysis Script
 * 
 * This script analyzes the entire LMS database structure and content
 * to understand table relationships and data flow for certificate generation.
 * 
 * Usage: node analyze-database.js
 */

const pool = require('./config/db');

async function analyzeDatabase() {
  console.log('\n🔍 LMS DATABASE ANALYSIS REPORT\n');
  console.log('='.repeat(80));
  
  try {
    // 0. Discover actual database name
    console.log('\n🔌 DATABASE CONNECTION INFO\n');
    const [dbInfo] = await pool.execute('SELECT DATABASE() as current_db');
    const currentDb = dbInfo[0].current_db;
    console.log('Connected to database:', currentDb);
    
    if (!currentDb) {
      console.log('⚠️  No database selected! Checking available databases...');
      const [databases] = await pool.execute('SHOW DATABASES');
      console.log('Available databases:');
      databases.forEach(db => console.log(`  - ${db.Database}`));
      
      // Try to find LMS database
      const lmsDb = databases.find(db => 
        db.Database.toLowerCase().includes('lms') || 
        db.Database.toLowerCase().includes('learning')
      );
      
      if (lmsDb) {
        console.log(`\n✅ Found potential LMS database: ${lmsDb.Database}`);
        console.log('Switching to this database...');
        await pool.execute(`USE ${lmsDb.Database}`);
        const [newDbInfo] = await pool.execute('SELECT DATABASE() as current_db');
        console.log('Now connected to:', newDbInfo[0].current_db);
      }
    }
    
    const [finalDbInfo] = await pool.execute('SELECT DATABASE() as current_db');
    const dbName = finalDbInfo[0].current_db;
    
    // 1. Get all tables in the database
    console.log('\n\n📋 SECTION 1: DATABASE TABLES\n');
    console.log('-'.repeat(80));
    const [tables] = await pool.execute(`
      SELECT TABLE_NAME, TABLE_ROWS, 
             ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2) AS SIZE_MB
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ?
      ORDER BY TABLE_NAME
    `, [dbName]);
    
    console.log('Total Tables:', tables.length);
    console.log('-'.repeat(80));
    tables.forEach(table => {
      console.log(`${table.TABLE_NAME.padEnd(40)} | Rows: ${String(table.TABLE_ROWS).padStart(6)} | Size: ${table.SIZE_MB} MB`);
    });

    // 2. Get courses table structure first
    console.log('\n\n📚 SECTION 2: COURSES TABLE STRUCTURE\n');
    console.log('-'.repeat(80));
    
    const [coursesColumns] = await pool.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'courses'
      ORDER BY ORDINAL_POSITION
    `, [dbName]);
    
    console.log('\nCourses Table Columns:');
    coursesColumns.forEach(col => {
      console.log(`  - ${col.COLUMN_NAME.padEnd(30)} | Type: ${col.DATA_TYPE.padEnd(15)} | Key: ${col.COLUMN_KEY || 'None'}`);
    });
    
    // Sample CPD courses (dynamically select available columns)
    const [cpdCourses] = await pool.execute(`
      SELECT * FROM courses 
      WHERE course_type = 'cpd'
      LIMIT 2
    `);
    console.log('\n\nSample CPD Course:');
    if (cpdCourses.length > 0) {
      console.log(JSON.stringify(cpdCourses[0], null, 2));
    }
    
    const [cpdCoursesCount] = await pool.execute(`SELECT COUNT(*) as count FROM courses WHERE course_type = 'cpd'`);
    console.log(`\nTotal CPD Courses: ${cpdCoursesCount[0].count}`);

    // 3. Analyze Units/Modules structure
    console.log('\n\n📖 SECTION 3: UNITS/MODULES STRUCTURE\n');
    console.log('-'.repeat(80));
    
    // Check for different possible unit tables
    const possibleUnitTables = [
      'course_units',
      'units',
      'modules',
      'course_modules',
      'cpd_units',
      'qualification_units',
      'qual_units'
    ];
    
    let foundUnitTable = null;
    
    for (const tableName of possibleUnitTables) {
      try {
        const [tableExists] = await pool.execute(`
          SELECT COUNT(*) as exists_check
          FROM information_schema.TABLES 
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
        `, [dbName, tableName]);
        
        if (tableExists[0].exists_check > 0) {
          console.log(`\n✅ Found table: ${tableName}`);
          foundUnitTable = tableName;
          
          // Get table structure
          const [columns] = await pool.execute(`
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
            ORDER BY ORDINAL_POSITION
          `, [dbName, tableName]);
          
          console.log('\nColumns:');
          columns.forEach(col => {
            console.log(`  - ${col.COLUMN_NAME.padEnd(30)} | Type: ${col.DATA_TYPE.padEnd(15)} | Key: ${col.COLUMN_KEY || 'None'}`);
          });
          
          // Get sample data
          const [sampleData] = await pool.execute(`SELECT * FROM ${tableName} LIMIT 2`);
          console.log('\nSample Data:');
          if (sampleData.length > 0) {
            console.log(JSON.stringify(sampleData[0], null, 2));
          }
          
          // Get count
          const [count] = await pool.execute(`SELECT COUNT(*) as count FROM ${tableName}`);
          console.log(`\nTotal Records: ${count[0].count}`);
          
          // Check if related to a course
          if (sampleData.length > 0 && sampleData[0].course_id) {
            const [relatedUnits] = await pool.execute(`
              SELECT COUNT(*) as count FROM ${tableName} WHERE course_id = ?
            `, [sampleData[0].course_id]);
            console.log(`Units for course ${sampleData[0].course_id}: ${relatedUnits[0].count}`);
          }
        }
      } catch (error) {
        // Table doesn't exist, skip
      }
    }
    
    if (!foundUnitTable) {
      console.log('\n⚠️  No unit/module tables found');
    }

    // 4. Analyze Certificate Claims
    console.log('\n\n🎓 SECTION 4: CERTIFICATE CLAIMS\n');
    console.log('-'.repeat(80));
    
    const [claimsSample] = await pool.execute(`
      SELECT cc.*, c.title as course_title, c.course_type
      FROM certificate_claims cc
      LEFT JOIN courses c ON cc.course_id = c.id
      WHERE cc.payment_status = 'completed'
      LIMIT 2
    `);
    
    console.log('\nSample Completed Claims:');
    if (claimsSample.length > 0) {
      console.log(JSON.stringify(claimsSample[0], null, 2));
    }
    
    const [claimsCount] = await pool.execute(`SELECT COUNT(*) as count FROM certificate_claims WHERE payment_status = 'completed'`);
    console.log(`\nTotal Completed Claims: ${claimsCount[0].count}`);

    // 5. Analyze Generated Certificates
    console.log('\n\n📜 SECTION 5: GENERATED CERTIFICATES\n');
    console.log('-'.repeat(80));
    
    const [genCertsSample] = await pool.execute(`SELECT * FROM generated_certificates LIMIT 2`);
    
    console.log('\nSample Generated Certificates:');
    if (genCertsSample.length > 0) {
      console.log(JSON.stringify(genCertsSample[0], null, 2));
    }
    
    const [genCertsCount] = await pool.execute(`SELECT COUNT(*) as count FROM generated_certificates`);
    console.log(`\nTotal Generated Certificates: ${genCertsCount[0].count}`);

    // 6. Check Certificate Templates
    console.log('\n\n📄 SECTION 6: CERTIFICATE TEMPLATES\n');
    console.log('-'.repeat(80));
    
    const [templates] = await pool.execute(`
      SELECT id, template_type, course_type, template_name, is_active, uploaded_at
      FROM certificate_templates
      ORDER BY uploaded_at DESC
    `);
    
    console.log('\nCertificate Templates:');
    templates.forEach(template => {
      console.log(`  ${template.is_active ? '✅' : '⏸️ '} [${template.template_type}] [${template.course_type}] ${template.template_name}`);
    });
    
    if (templates.length === 0) {
      console.log('  ⚠️  No templates found');
    }

    // 7. Summary and Recommendations
    console.log('\n\n💡 SECTION 7: SUMMARY & RECOMMENDATIONS\n');
    console.log('-'.repeat(80));
    
    if (foundUnitTable) {
      console.log(`✅ Unit/Module data found in table: ${foundUnitTable}`);
      console.log(`   → Use this table name in certificateGenerator.js`);
    } else {
      console.log('⚠️  WARNING: No unit/module table found with data!');
      console.log('   → certificateGenerator.js will use fallback generic units');
    }
    
    // Check templates
    const [activeCertTemplate] = await pool.execute(`
      SELECT * FROM certificate_templates 
      WHERE template_type = 'certificate' AND course_type = 'cpd' AND is_active = TRUE
      LIMIT 1
    `);
    
    const [activeTransTemplate] = await pool.execute(`
      SELECT * FROM certificate_templates 
      WHERE template_type = 'transcript' AND course_type = 'cpd' AND is_active = TRUE
      LIMIT 1
    `);
    
    if (activeCertTemplate.length === 0) {
      console.log('⚠️  WARNING: No active CPD certificate template found!');
      console.log('   → Upload a certificate template in admin dashboard');
    } else {
      console.log('✅ Active CPD certificate template: ' + activeCertTemplate[0].template_name);
    }
    
    if (activeTransTemplate.length === 0) {
      console.log('⚠️  WARNING: No active CPD transcript template found!');
      console.log('   → Upload a transcript template in admin dashboard');
    } else {
      console.log('✅ Active CPD transcript template: ' + activeTransTemplate[0].template_name);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Database analysis complete!\n');
    
  } catch (error) {
    console.error('\n❌ Error during database analysis:', error);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

// Run the analysis
analyzeDatabase();
