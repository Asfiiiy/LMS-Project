const fs = require('fs-extra');
const path = require('path');
const { convertDocxToPdf } = require('./services/certificateGenerator');

async function testPdfConversion() {
  try {
    console.log('🧪 Testing PDF Conversion\n');
    
    // Find a generated DOCX file
    const docxDir = path.join(__dirname, 'generated', 'docx');
    
    if (!fs.existsSync(docxDir)) {
      console.log('❌ No generated DOCX directory found');
      return;
    }
    
    const files = fs.readdirSync(docxDir);
    const docxFiles = files.filter(f => f.endsWith('.docx'));
    
    if (docxFiles.length === 0) {
      console.log('❌ No DOCX files found in generated/docx');
      return;
    }
    
    const testFile = docxFiles[0];
    console.log(`📄 Testing with file: ${testFile}`);
    
    const docxPath = path.join(docxDir, testFile);
    const docxBuffer = fs.readFileSync(docxPath);
    
    console.log(`📊 DOCX size: ${docxBuffer.length} bytes\n`);
    
    console.log('🔄 Starting conversion...\n');
    
    const pdfBuffer = await convertDocxToPdf(docxBuffer);
    
    console.log(`\n✅ Conversion successful!`);
    console.log(`📊 PDF size: ${pdfBuffer.length} bytes`);
    
    // Save test PDF
    const testPdfPath = path.join(docxDir, testFile.replace('.docx', '_test.pdf'));
    fs.writeFileSync(testPdfPath, pdfBuffer);
    console.log(`💾 Test PDF saved to: ${testPdfPath}`);
    
  } catch (error) {
    console.error('\n❌ Conversion failed:', error.message);
    console.error(error.stack);
  }
}

testPdfConversion();

