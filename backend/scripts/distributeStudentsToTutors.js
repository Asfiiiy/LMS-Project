/**
 * Script to Distribute All Students Equally Among Main Tutors
 * 
 * This script assigns all students (role_id = 4) evenly to main tutors
 * (role_id = 2, parent_tutor_id IS NULL) using round-robin distribution.
 * 
 * Usage:
 *   node backend/scripts/distributeStudentsToTutors.js
 */

const pool = require('../config/db');

async function distributeStudentsToTutors() {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    console.log('🔄 Starting student distribution...\n');
    
    // Step 1: Get all main tutors
    const [tutors] = await connection.query(
      `SELECT id, name 
       FROM users 
       WHERE role_id = 2 
         AND (parent_tutor_id IS NULL OR parent_tutor_id = 0)
       ORDER BY id`
    );
    
    if (tutors.length === 0) {
      console.log('❌ No main tutors found!');
      await connection.rollback();
      return;
    }
    
    console.log(`📚 Found ${tutors.length} main tutor(s):`);
    tutors.forEach((tutor, index) => {
      console.log(`   ${index + 1}. ${tutor.name} (ID: ${tutor.id})`);
    });
    console.log('');
    
    // Step 2: Get all students
    const [students] = await connection.query(
      `SELECT id, name 
       FROM users 
       WHERE role_id = 4
       ORDER BY id`
    );
    
    if (students.length === 0) {
      console.log('❌ No students found!');
      await connection.rollback();
      return;
    }
    
    console.log(`👥 Found ${students.length} student(s)\n`);
    
    // Step 3: Distribute students evenly using round-robin
    const tutorCount = tutors.length;
    let assignedCount = 0;
    
    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      const tutorIndex = i % tutorCount; // Round-robin: 0, 1, 2, ..., 0, 1, 2, ...
      const tutor = tutors[tutorIndex];
      
      await connection.query(
        'UPDATE users SET assigned_tutor_id = ? WHERE id = ?',
        [tutor.id, student.id]
      );
      
      assignedCount++;
    }
    
    // Step 4: Show distribution summary
    console.log('✅ Distribution complete!\n');
    console.log('📊 Distribution Summary:');
    console.log('─'.repeat(50));
    
    for (const tutor of tutors) {
      const [countResult] = await connection.query(
        `SELECT COUNT(*) as count 
         FROM users 
         WHERE role_id = 4 AND assigned_tutor_id = ?`,
        [tutor.id]
      );
      
      const count = countResult[0].count;
      const percentage = ((count / students.length) * 100).toFixed(1);
      console.log(`   ${tutor.name.padEnd(20)} (ID: ${tutor.id.toString().padStart(3)}): ${count.toString().padStart(3)} students (${percentage}%)`);
    }
    
    console.log('─'.repeat(50));
    console.log(`   Total Students: ${students.length}`);
    console.log(`   Assigned: ${assignedCount}`);
    
    // Check for unassigned students
    const [unassignedResult] = await connection.query(
      `SELECT COUNT(*) as count 
       FROM users 
       WHERE role_id = 4 
         AND (assigned_tutor_id IS NULL OR assigned_tutor_id = 0)`
    );
    
    const unassignedCount = unassignedResult[0].count;
    if (unassignedCount > 0) {
      console.log(`   ⚠️  Unassigned: ${unassignedCount}`);
    } else {
      console.log(`   ✅ All students assigned!`);
    }
    
    await connection.commit();
    console.log('\n✅ Transaction committed successfully!');
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error distributing students:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// Run the script
if (require.main === module) {
  distributeStudentsToTutors()
    .then(() => {
      console.log('\n✨ Script completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = distributeStudentsToTutors;
