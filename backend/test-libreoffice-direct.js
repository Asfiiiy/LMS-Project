/**
 * Direct LibreOffice Test
 * Tests LibreOffice conversion with detailed error logging
 */

const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

async function testLibreOffice() {
  console.log('🧪 Testing LibreOffice Direct Conversion\n');
  console.log('='.repeat(80));
  
  // 1. Check LibreOffice installation
  console.log('\n📋 Step 1: Checking LibreOffice Installation\n');
  
  const libreOfficePath = 'C:\\Program Files\\LibreOffice\\program\\soffice.exe';
  
  if (!fs.existsSync(libreOfficePath)) {
    console.error('❌ LibreOffice not found at:', libreOfficePath);
    console.log('\nPlease install LibreOffice from: https://www.libreoffice.org/download/');
    return;
  }
  
  console.log('✅ LibreOffice found at:', libreOfficePath);
  
  // 2. Check version
  console.log('\n📋 Step 2: Checking LibreOffice Version\n');
  
  try {
    const versionCommand = `"${libreOfficePath}" --version`;
    console.log('Command:', versionCommand);
    
    const version = execSync(versionCommand, { 
      encoding: 'utf8',
      timeout: 5000,
      windowsHide: true
    });
    
    console.log('✅ Version:', version.trim());
  } catch (error) {
    console.error('❌ Version check failed:', error.message);
  }
  
  // 3. Find a test DOCX file
  console.log('\n📋 Step 3: Finding Test DOCX File\n');
  
  const docxDir = path.join(__dirname, 'generated', 'docx');
  
  if (!fs.existsSync(docxDir)) {
    console.error('❌ No generated/docx directory found');
    return;
  }
  
  const files = fs.readdirSync(docxDir);
  const docxFiles = files.filter(f => f.endsWith('.docx'));
  
  if (docxFiles.length === 0) {
    console.error('❌ No DOCX files found in generated/docx');
    return;
  }
  
  const testFile = docxFiles[0];
  const testDocxPath = path.join(docxDir, testFile);
  
  console.log('✅ Test file:', testFile);
  console.log('   Full path:', testDocxPath);
  console.log('   File size:', fs.statSync(testDocxPath).size, 'bytes');
  
  // 4. Test conversion
  console.log('\n📋 Step 4: Testing Conversion\n');
  
  const outputDir = path.join(__dirname, 'test-output');
  fs.ensureDirSync(outputDir);
  
  const command = `"${libreOfficePath}" --headless --convert-to pdf:writer_pdf_Export --outdir "${outputDir}" "${testDocxPath}"`;
  
  console.log('Command:', command);
  console.log('\n🔄 Executing conversion...\n');
  
  try {
    const result = execSync(command, {
      encoding: 'utf8',
      timeout: 60000,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    console.log('📤 LibreOffice Output:');
    console.log(result || '(no output)');
    
    // Check if PDF was created
    const expectedPdfName = path.basename(testFile, '.docx') + '.pdf';
    const pdfPath = path.join(outputDir, expectedPdfName);
    
    if (fs.existsSync(pdfPath)) {
      const pdfSize = fs.statSync(pdfPath).size;
      console.log('\n✅ SUCCESS! PDF Created:');
      console.log('   Path:', pdfPath);
      console.log('   Size:', pdfSize, 'bytes');
      
      if (pdfSize < 1000) {
        console.warn('\n⚠️  WARNING: PDF size is very small, might be corrupted');
      }
    } else {
      console.error('\n❌ PDF not found at expected path:', pdfPath);
      console.log('\nFiles in output directory:');
      const outputFiles = fs.readdirSync(outputDir);
      outputFiles.forEach(f => console.log('  -', f));
    }
    
  } catch (error) {
    console.error('\n❌ CONVERSION FAILED\n');
    console.error('Error Type:', error.constructor.name);
    console.error('Error Code:', error.code);
    console.error('Error Message:', error.message);
    
    if (error.stdout) {
      console.error('\n📤 STDOUT:');
      console.error(error.stdout.toString());
    }
    
    if (error.stderr) {
      console.error('\n📤 STDERR:');
      console.error(error.stderr.toString());
    }
    
    if (error.status) {
      console.error('\nExit Status:', error.status);
    }
    
    console.error('\n🔍 Possible Causes:');
    console.error('  1. LibreOffice is already running (close all LibreOffice windows)');
    console.error('  2. File is corrupted or invalid DOCX format');
    console.error('  3. Insufficient permissions');
    console.error('  4. LibreOffice installation is incomplete');
    console.error('  5. Antivirus blocking the conversion');
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('Test Complete\n');
}

testLibreOffice();

