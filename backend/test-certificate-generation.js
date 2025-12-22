/**
 * Test Certificate Auto-Generation System
 * Run this to test if everything is working
 */

const pool = require('./config/db');
const certificateGenerator = require('./services/certificateGenerator');

async function testSystem() {
  console.log('\n🧪 Testing Certificate Auto-Generation System...\n');
  
  try {
    // Test 1: Check if registration number procedure exists
    console.log('📋 Test 1: Checking registration number procedure...');
    try {
      const [result] = await pool.execute('CALL get_next_registration_number(@reg_num)');
      const [regNum] = await pool.execute('SELECT @reg_num as registration_number');
      
      if (regNum[0].registration_number) {
        console.log(`   ✅ Registration number works: ${regNum[0].registration_number}`);
        
        if (regNum[0].registration_number.startsWith('ILC')) {
          console.log('   ✅ Format is correct (ILC format)');
        } else {
          console.log('   ❌ Format is wrong (should start with ILC)');
          console.log('   ⚠️  You need to run: mysql -u root -p < sql/update_registration_number_format.sql');
          return;
        }
      }
    } catch (error) {
      console.log('   ❌ Registration number procedure not found');
      console.log('   ⚠️  Run this SQL script: sql/update_registration_number_format.sql');
      console.log('   Error:', error.message);
      return;
    }
    
    // Test 2: Check if LibreOffice is available
    console.log('\n📋 Test 2: Checking LibreOffice...');
    const { spawnSync } = require('child_process');
    const libreOfficePath = process.env.LIBREOFFICE_PATH || 'C:\\Program Files\\LibreOffice\\program\\soffice.exe';
    
    try {
      const result = spawnSync(libreOfficePath, ['--version'], { encoding: 'utf8', timeout: 5000 });
      if (result.status === 0) {
        console.log(`   ✅ LibreOffice found: ${libreOfficePath}`);
        console.log(`   ✅ Version: ${result.stdout.trim().split('\n')[0]}`);
      } else {
        console.log('   ❌ LibreOffice not found');
        console.log('   ⚠️  Install from: https://www.libreoffice.org/download/');
        return;
      }
    } catch (error) {
      console.log('   ❌ LibreOffice test failed:', error.message);
      console.log('   ⚠️  Install from: https://www.libreoffice.org/download/');
      return;
    }
    
    // Test 3: Check if certificate templates exist
    console.log('\n📋 Test 3: Checking certificate templates...');
    const [certTemplates] = await pool.execute(
      'SELECT * FROM certificate_templates WHERE template_type = "certificate" AND course_type = "cpd" AND is_active = TRUE'
    );
    const [transTemplates] = await pool.execute(
      'SELECT * FROM certificate_templates WHERE template_type = "transcript" AND course_type = "cpd" AND is_active = TRUE'
    );
    
    if (certTemplates.length > 0) {
      console.log(`   ✅ Certificate template found: ${certTemplates[0].template_name}`);
    } else {
      console.log('   ❌ No active certificate template found');
      console.log('   ⚠️  Upload a certificate template in Admin Dashboard → Certificate Templates');
      return;
    }
    
    if (transTemplates.length > 0) {
      console.log(`   ✅ Transcript template found: ${transTemplates[0].template_name}`);
    } else {
      console.log('   ❌ No active transcript template found');
      console.log('   ⚠️  Upload a transcript template in Admin Dashboard → Certificate Templates');
      return;
    }
    
    // Test 4: Check claim #5
    console.log('\n📋 Test 4: Checking claim #5...');
    const [claims] = await pool.execute('SELECT * FROM certificate_claims WHERE id = 5');
    
    if (claims.length === 0) {
      console.log('   ⚠️  Claim #5 not found');
      console.log('   ℹ️  Make a new payment to test auto-generation');
      return;
    }
    
    console.log(`   ✅ Claim #5 found: ${claims[0].full_name} - ${claims[0].course_type}`);
    console.log(`   Payment Status: ${claims[0].payment_status}`);
    
    // Test 5: Check if certificate was generated for claim #5
    console.log('\n📋 Test 5: Checking if certificate exists for claim #5...');
    const [genCerts] = await pool.execute('SELECT * FROM generated_certificates WHERE claim_id = 5');
    
    if (genCerts.length > 0) {
      console.log(`   ✅ Certificate already generated!`);
      console.log(`   Registration Number: ${genCerts[0].registration_number}`);
      console.log(`   Status: ${genCerts[0].status}`);
      console.log(`   Generated At: ${genCerts[0].generated_at}`);
      
      console.log('\n✅ Everything is working! Refresh your admin dashboard to see the buttons.');
      return;
    } else {
      console.log('   ⚠️  No certificate generated yet for claim #5');
      console.log('   🔄 Triggering generation now...\n');
      
      // Test 6: Generate certificate for claim #5
      console.log('📋 Test 6: Generating certificate for claim #5...');
      try {
        const result = await certificateGenerator.generateCPDCertificates(5, 1);
        
        if (result.success) {
          console.log(`   ✅ Certificate generated successfully!`);
          console.log(`   Registration Number: ${result.registrationNumber}`);
          console.log(`   Generated Cert ID: ${result.generatedCertId}`);
          console.log(`   Message: ${result.message}`);
          
          console.log('\n🎉 SUCCESS! Everything is working!');
          console.log('📌 Next steps:');
          console.log('   1. Refresh your admin dashboard');
          console.log('   2. You should see registration number and buttons');
          console.log('   3. Click 📜 to view certificate, 📄 to view transcript');
          console.log('   4. Click 📦 to deliver to student\n');
        } else {
          console.log('   ❌ Generation failed:', result.message);
        }
      } catch (error) {
        console.log('   ❌ Generation error:', error.message);
        console.log('   Stack:', error.stack);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

// Run the test
console.log('🚀 Starting Certificate System Test...');
testSystem();

