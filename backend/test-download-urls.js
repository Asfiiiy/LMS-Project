/**
 * Test Certificate Download URLs
 */

const axios = require('axios').default;
const pool = require('./config/db');

async function testDownloadUrls() {
  console.log('🧪 Testing Certificate Download URLs\n');
  
  try {
    // Get delivered certificates from database
    const [certificates] = await pool.execute(`
      SELECT id, registration_number, status, certificate_pdf_path, transcript_pdf_path
      FROM generated_certificates 
      WHERE status = 'delivered' 
      ORDER BY id DESC 
      LIMIT 3
    `);
    
    console.log(`📊 Found ${certificates.length} delivered certificates\n`);
    
    if (certificates.length === 0) {
      console.log('❌ No delivered certificates found');
      console.log('   Deliver a certificate first via admin dashboard');
      await pool.end();
      return;
    }
    
    for (const cert of certificates) {
      console.log(`\n🧪 Testing Certificate: ${cert.registration_number}`);
      console.log(`   Status: ${cert.status}`);
      console.log(`   DB ID: ${cert.id}`);
      
      // Test certificate download
      const certUrl = `http://localhost:5000/api/certificates/download/cert/${cert.registration_number}`;
      console.log(`\n📜 Testing Certificate URL: ${certUrl}`);
      
      try {
        const response = await axios.head(certUrl, { timeout: 5000 });
        console.log(`   ✅ Certificate accessible - Status: ${response.status}`);
        console.log(`   📄 Content-Type: ${response.headers['content-type']}`);
        console.log(`   📊 Content-Length: ${response.headers['content-length']} bytes`);
      } catch (error) {
        if (error.code === 'ECONNREFUSED') {
          console.log('   ❌ Backend server not running');
        } else if (error.response) {
          console.log(`   ❌ Certificate failed - Status: ${error.response.status}`);
          console.log(`   ❌ Message: ${error.response.data?.message || 'Unknown error'}`);
        } else {
          console.log(`   ❌ Network error: ${error.message}`);
        }
      }
      
      // Test transcript download
      const transUrl = `http://localhost:5000/api/certificates/download/trans/${cert.registration_number}`;
      console.log(`\n📄 Testing Transcript URL: ${transUrl}`);
      
      try {
        const response = await axios.head(transUrl, { timeout: 5000 });
        console.log(`   ✅ Transcript accessible - Status: ${response.status}`);
        console.log(`   📄 Content-Type: ${response.headers['content-type']}`);
        console.log(`   📊 Content-Length: ${response.headers['content-length']} bytes`);
      } catch (error) {
        if (error.code === 'ECONNREFUSED') {
          console.log('   ❌ Backend server not running');
        } else if (error.response) {
          console.log(`   ❌ Transcript failed - Status: ${error.response.status}`);
          console.log(`   ❌ Message: ${error.response.data?.message || 'Unknown error'}`);
        } else {
          console.log(`   ❌ Network error: ${error.message}`);
        }
      }
    }
    
    console.log('\n\n📋 Test URLs for Browser:');
    certificates.forEach(cert => {
      console.log(`\nCertificate ${cert.registration_number}:`);
      console.log(`  📜 http://localhost:5000/api/certificates/download/cert/${cert.registration_number}`);
      console.log(`  📄 http://localhost:5000/api/certificates/download/trans/${cert.registration_number}`);
    });
    
    console.log('\n\n🔄 If URLs don\'t work:');
    console.log('1. Restart backend: Get-Process node | Stop-Process -Force; node server.js');
    console.log('2. Check if certificates were delivered properly');
    console.log('3. Verify PDF files exist on disk');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await pool.end();
  }
}

testDownloadUrls();
