const pool = require('./config/db');
const certificateGenerator = require('./services/certificateGenerator');

async function testCPDTopics() {
  try {
    console.log('🔍 Testing CPD Topics for Certificate Generation\n');
    
    // Get a completed CPD claim
    const [claims] = await pool.execute(
      `SELECT id, student_id, course_id, full_name, course_type, payment_status 
       FROM certificate_claims 
       WHERE payment_status = 'completed' AND course_type = 'cpd'
       ORDER BY id DESC 
       LIMIT 1`
    );
    
    if (claims.length === 0) {
      console.log('❌ No completed CPD claims found');
      await pool.end();
      return;
    }
    
    const claim = claims[0];
    console.log('📋 Testing with claim:');
    console.log(`   ID: ${claim.id}`);
    console.log(`   Student: ${claim.full_name}`);
    console.log(`   Course ID: ${claim.course_id}`);
    console.log(`   Course Type: ${claim.course_type}`);
    
    // Check if certificate already exists
    const [existing] = await pool.execute(
      'SELECT id FROM generated_certificates WHERE claim_id = ?',
      [claim.id]
    );
    
    if (existing.length > 0) {
      console.log(`\n✅ Certificate already exists (ID: ${existing[0].id})`);
      console.log('   Checking CPD topics for this course...\n');
      
      // Check CPD topics
      const [topics] = await pool.execute(
        `SELECT topic_number, title FROM cpd_topics 
         WHERE course_id = ? 
         ORDER BY order_index ASC, topic_number ASC`,
        [claim.course_id]
      );
      
      console.log(`📚 Found ${topics.length} CPD topics:`);
      topics.forEach(topic => {
        console.log(`   ${topic.topic_number}. ${topic.title}`);
      });
      
      // Check generated certificate data
      const [genCert] = await pool.execute(
        'SELECT generated_data FROM generated_certificates WHERE claim_id = ?',
        [claim.id]
      );
      
      if (genCert.length > 0 && genCert[0].generated_data) {
        const data = JSON.parse(genCert[0].generated_data);
        console.log('\n📜 Units in Generated Transcript:');
        for (let i = 1; i <= 5; i++) {
          if (data.transData[`UNIT_${i}_NAME`]) {
            console.log(`   Unit ${i}: ${data.transData[`UNIT_${i}_NAME`]}`);
          }
        }
      }
      
    } else {
      console.log('\n🔄 No certificate generated yet. Generating now...\n');
      
      // Generate certificate
      const result = await certificateGenerator.generateCPDCertificates(claim.id, 1);
      
      if (result.success) {
        console.log('\n✅ Certificate generated successfully!');
        console.log(`   Registration Number: ${result.registrationNumber}`);
        console.log(`   Generated Cert ID: ${result.generatedCertId}`);
      } else {
        console.log('\n❌ Generation failed:', result.message);
      }
    }
    
    await pool.end();
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    await pool.end();
  }
}

testCPDTopics();

