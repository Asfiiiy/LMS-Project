/**
 * Get All Assessors IDs
 * Run: node backend/scripts/get_assessors.js
 */

const pool = require('../config/db');

(async () => {
  try {
    console.log('\n📊 FETCHING ALL ASSESSORS FROM DATABASE...\n');
    console.log('='.repeat(80));
    
    // Get all assessors (role_id = 2)
    const [assessors] = await pool.query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role_id,
        u.parent_tutor_id,
        pt.name as parent_tutor_name
      FROM users u
      LEFT JOIN users pt ON u.parent_tutor_id = pt.id
      WHERE u.role_id = 2
      ORDER BY u.parent_tutor_id IS NULL DESC, u.name ASC
    `);
    
    if (assessors.length === 0) {
      console.log('❌ No assessors found!\n');
      process.exit(0);
    }
    
    console.log(`\n✅ Found ${assessors.length} assessors:\n`);
    
    // Separate main assessors and sub-assessors
    const mainAssessors = assessors.filter(a => !a.parent_tutor_id);
    const subAssessors = assessors.filter(a => a.parent_tutor_id);
    
    // Display main assessors
    console.log('🎯 MAIN ASSESSORS:');
    console.log('-'.repeat(80));
    mainAssessors.forEach(a => {
      console.log(`  ID: ${a.id.toString().padEnd(6)} | Name: ${a.name.padEnd(25)} | Email: ${a.email}`);
    });
    
    // Display sub-assessors grouped by parent
    console.log('\n\n👥 SUB-ASSESSORS:');
    console.log('-'.repeat(80));
    
    const groupedByParent = {};
    subAssessors.forEach(a => {
      const parentName = a.parent_tutor_name || 'Unknown';
      if (!groupedByParent[parentName]) {
        groupedByParent[parentName] = [];
      }
      groupedByParent[parentName].push(a);
    });
    
    Object.keys(groupedByParent).sort().forEach(parentName => {
      console.log(`\n  📌 Reports to: ${parentName}`);
      groupedByParent[parentName].forEach(a => {
        console.log(`     ID: ${a.id.toString().padEnd(6)} | Name: ${a.name.padEnd(25)} | Email: ${a.email}`);
      });
    });
    
    // Create a quick reference table
    console.log('\n\n📋 QUICK REFERENCE TABLE:');
    console.log('='.repeat(80));
    console.log('ID     | Name                      | Email                          | Type');
    console.log('-'.repeat(80));
    assessors.forEach(a => {
      const type = a.parent_tutor_id ? `Sub (→ ${a.parent_tutor_name})` : 'Main';
      console.log(`${a.id.toString().padEnd(6)} | ${a.name.padEnd(25)} | ${a.email.padEnd(30)} | ${type}`);
    });
    
    console.log('\n' + '='.repeat(80));
    console.log(`✅ Total: ${assessors.length} assessors (${mainAssessors.length} main, ${subAssessors.length} sub)\n`);
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
})();
