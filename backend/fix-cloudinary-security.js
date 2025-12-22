/**
 * Cloudinary Security Fix
 * Alternative solutions for "Customer is marked as untrusted" error
 */

const pool = require('./config/db');
const cloudinary = require('./config/cloudinary');
const fs = require('fs-extra');
const path = require('path');

async function fixCloudinaryIssues() {
  console.log('🔧 Cloudinary Security Issue Diagnosis & Fix\n');
  
  try {
    console.log('1️⃣ Checking Cloudinary Configuration...\n');
    
    // Test Cloudinary connection
    try {
      const result = await cloudinary.api.ping();
      console.log('✅ Cloudinary connection:', result);
    } catch (error) {
      console.error('❌ Cloudinary connection failed:', error.message);
    }
    
    console.log('\n2️⃣ Testing Different Upload Strategies...\n');
    
    // Find a test PDF file
    const testPdfPath = path.join(__dirname, 'test-output');
    const pdfFiles = fs.readdirSync(testPdfPath).filter(f => f.endsWith('.pdf'));
    
    if (pdfFiles.length === 0) {
      console.log('❌ No test PDF files found. Run: node test-libreoffice-direct.js first');
      return;
    }
    
    const testFile = path.join(testPdfPath, pdfFiles[0]);
    console.log('📄 Using test file:', testFile);
    
    // Strategy 1: Try with security options disabled
    console.log('\n🧪 Strategy 1: Upload with security bypass...');
    try {
      const upload1 = await cloudinary.uploader.upload(testFile, {
        resource_type: 'raw',
        public_id: 'test_security_bypass',
        access_mode: 'public',
        type: 'upload',
        secure: false,  // Try non-secure
        use_filename: true,
        unique_filename: false,
        overwrite: true
      });
      
      console.log('✅ Strategy 1 Success:', upload1.secure_url);
      console.log('   Test this URL:', upload1.secure_url);
      
    } catch (error) {
      console.error('❌ Strategy 1 Failed:', error.message);
    }
    
    // Strategy 2: Try as image (auto format)
    console.log('\n🧪 Strategy 2: Upload as auto format...');
    try {
      const upload2 = await cloudinary.uploader.upload(testFile, {
        resource_type: 'auto',
        public_id: 'test_auto_format',
        access_mode: 'public',
        overwrite: true
      });
      
      console.log('✅ Strategy 2 Success:', upload2.secure_url);
      console.log('   Test this URL:', upload2.secure_url);
      
    } catch (error) {
      console.error('❌ Strategy 2 Failed:', error.message);
    }
    
    // Strategy 3: Upload with transformation
    console.log('\n🧪 Strategy 3: Upload with transformation...');
    try {
      const upload3 = await cloudinary.uploader.upload(testFile, {
        resource_type: 'raw',
        public_id: 'test_with_transform',
        access_mode: 'public',
        type: 'upload',
        transformation: [
          { format: 'pdf' }
        ],
        overwrite: true
      });
      
      console.log('✅ Strategy 3 Success:', upload3.secure_url);
      console.log('   Test this URL:', upload3.secure_url);
      
    } catch (error) {
      console.error('❌ Strategy 3 Failed:', error.message);
    }
    
    console.log('\n3️⃣ Cloudinary Account Settings Check\n');
    
    // Get account details
    try {
      const usage = await cloudinary.api.usage();
      console.log('📊 Account Usage:');
      console.log('   Plan:', usage.plan);
      console.log('   Credits Used:', usage.credits.used_percent + '%');
      
      if (usage.plan === 'Free') {
        console.log('\n⚠️  FREE PLAN DETECTED');
        console.log('   Free plans have security restrictions');
        console.log('   Consider upgrading to remove "untrusted customer" error');
      }
      
    } catch (error) {
      console.error('❌ Could not check account details:', error.message);
    }
    
    console.log('\n4️⃣ Alternative Solution: Direct File Serving\n');
    console.log('💡 RECOMMENDED: Serve PDFs directly from backend instead of Cloudinary');
    console.log('   This bypasses Cloudinary security restrictions entirely');
    console.log('   Files are served from: http://localhost:5000/api/certificates/generated/:id/file/:type');
    
    console.log('\n🔧 MANUAL FIXES NEEDED:\n');
    console.log('Option 1: Cloudinary Dashboard Settings');
    console.log('  1. Go to: https://console.cloudinary.com/settings/security');
    console.log('  2. Under "Secure delivery", disable restrictions');
    console.log('  3. Under "Access control", set to "Public"');
    console.log('  4. Save changes and wait 5 minutes');
    
    console.log('\nOption 2: Use Local File Serving (RECOMMENDED)');
    console.log('  1. Keep PDFs on server');
    console.log('  2. Serve via: /api/certificates/generated/:id/file/:type');
    console.log('  3. No Cloudinary restrictions');
    
    console.log('\nOption 3: Different Cloud Provider');
    console.log('  1. AWS S3 with public bucket');
    console.log('  2. Google Cloud Storage');
    console.log('  3. Digital Ocean Spaces');
    
  } catch (error) {
    console.error('❌ Error during diagnosis:', error);
  } finally {
    await pool.end();
  }
}

fixCloudinaryIssues();
