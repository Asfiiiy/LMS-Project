/**
 * Simple test for download URLs without external dependencies
 */

const pool = require('./config/db');
const fs = require('fs');
const path = require('path');

async function testDownloadSimple() {
  console.log('🧪 Testing Certificate Download System\n');
  
  try {
    // Get delivered certificates
    const [certificates] = await pool.execute(`
      SELECT id, registration_number, status, certificate_pdf_path, transcript_pdf_path,
             certificate_docx_path, transcript_docx_path
      FROM generated_certificates 
      WHERE status = 'delivered' 
      ORDER BY id DESC 
      LIMIT 2
    `);
    
    console.log(`📊 Found ${certificates.length} delivered certificates\n`);
    
    if (certificates.length === 0) {
      console.log('❌ No delivered certificates found');
      console.log('   Action needed: Deliver a certificate via admin dashboard first');
      await pool.end();
      return;
    }
    
    for (const cert of certificates) {
      console.log(`\n📋 Certificate: ${cert.registration_number}`);
      console.log(`   Status: ${cert.status}`);
      console.log(`   Certificate PDF Path: ${cert.certificate_pdf_path || 'Not set'}`);
      console.log(`   Transcript PDF Path: ${cert.transcript_pdf_path || 'Not set'}`);
      
      // Check if PDF files exist on disk
      if (cert.certificate_pdf_path) {
        const certPath = path.join(__dirname, '..', cert.certificate_pdf_path);
        const certExists = fs.existsSync(certPath);
        console.log(`   📜 Certificate file exists: ${certExists ? '✅ YES' : '❌ NO'} - ${certPath}`);
        if (certExists) {
          const stats = fs.statSync(certPath);
          console.log(`      File size: ${stats.size} bytes, Modified: ${stats.mtime.toISOString()}`);
        }
      }
      
      if (cert.transcript_pdf_path) {
        const transPath = path.join(__dirname, '..', cert.transcript_pdf_path);
        const transExists = fs.existsSync(transPath);
        console.log(`   📄 Transcript file exists: ${transExists ? '✅ YES' : '❌ NO'} - ${transPath}`);
        if (transExists) {
          const stats = fs.statSync(transPath);
          console.log(`      File size: ${stats.size} bytes, Modified: ${stats.mtime.toISOString()}`);
        }
      }
      
      // Generate download URLs
      console.log(`\n🔗 Download URLs:`);
      console.log(`   📜 Certificate: http://localhost:5000/api/certificates/download/cert/${cert.registration_number}`);
      console.log(`   📄 Transcript:  http://localhost:5000/api/certificates/download/trans/${cert.registration_number}`);
    }
    
    console.log('\n\n🧪 Manual Test Instructions:');
    console.log('1. Copy one of the URLs above');
    console.log('2. Open in browser (should download PDF file)');
    console.log('3. If you get 401 error, restart backend server:');
    console.log('   Get-Process node | Stop-Process -Force');
    console.log('   node server.js');
    console.log('\n4. For student dashboard test:');
    console.log('   Go to student dashboard → certificates');
    console.log('   Click download buttons (should work now)');
    
    // Check server status
    console.log('\n\n🔍 Server Status Check:');
    try {
      const http = require('http');
      const req = http.request({
        hostname: 'localhost',
        port: 5000,
        path: '/api/certificates/test-auth',
        method: 'GET',
        timeout: 2000
      }, (res) => {
        console.log(`✅ Backend server is running - Status: ${res.statusCode}`);
      });
      
      req.on('error', (error) => {
        if (error.code === 'ECONNREFUSED') {
          console.log('❌ Backend server is NOT running');
          console.log('   Start it: cd lms-app/backend && node server.js');
        } else {
          console.log(`⚠️  Server check failed: ${error.message}`);
        }
      });
      
      req.on('timeout', () => {
        console.log('⏰ Server response timeout (might be slow but running)');
        req.destroy();
      });
      
      req.end();
    } catch (error) {
      console.log(`❌ Server check error: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    setTimeout(() => pool.end(), 1000); // Give server check time to complete
  }
}

testDownloadSimple();
