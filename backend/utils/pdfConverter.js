/**
 * Alternative PDF Conversion Utility
 * Uses direct system calls to LibreOffice for better reliability
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

/**
 * Convert DOCX to PDF using LibreOffice command line (synchronous)
 * More reliable for Windows systems
 */
function convertDocxToPdfSync(docxPath, outputDir = null) {
  // Determine LibreOffice path
  let libreOfficePath = process.env.LIBREOFFICE_PATH;
  
  if (!libreOfficePath) {
    if (process.platform === 'win32') {
      // Try common Windows paths
      const possiblePaths = [
        'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
        'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe'
      ];
      
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          libreOfficePath = p;
          break;
        }
      }
    } else if (process.platform === 'linux') {
      libreOfficePath = '/usr/bin/soffice';
    } else if (process.platform === 'darwin') {
      libreOfficePath = '/Applications/LibreOffice.app/Contents/MacOS/soffice';
    }
  }
  
  if (!libreOfficePath || !fs.existsSync(libreOfficePath)) {
    throw new Error('LibreOffice not found. Please install LibreOffice or set LIBREOFFICE_PATH environment variable.');
  }
  
  // Determine output directory
  const outDir = outputDir || path.dirname(docxPath);
  fs.ensureDirSync(outDir);
  
  console.log(`Converting: ${docxPath}`);
  console.log(`Output dir: ${outDir}`);
  console.log(`LibreOffice: ${libreOfficePath}`);
  
  try {
    // Build command
    const command = `"${libreOfficePath}" --headless --convert-to pdf:writer_pdf_Export --outdir "${outDir}" "${docxPath}"`;
    
    console.log(`Executing: ${command}`);
    
    // Execute conversion (synchronous with timeout)
    const result = execSync(command, {
      encoding: 'utf8',
      timeout: 60000, // 60 second timeout
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    console.log(`LibreOffice output: ${result}`);
    
    // Check if PDF was created
    const pdfPath = path.join(outDir, path.basename(docxPath, '.docx') + '.pdf');
    
    if (!fs.existsSync(pdfPath)) {
      throw new Error(`PDF not generated at expected path: ${pdfPath}`);
    }
    
    console.log(`✅ PDF created: ${pdfPath}`);
    return pdfPath;
    
  } catch (error) {
    console.error('❌ PDF conversion failed:', error.message);
    throw new Error(`PDF conversion failed: ${error.message}`);
  }
}

/**
 * Convert DOCX buffer to PDF buffer using temporary files
 */
async function convertDocxBufferToPdfBuffer(docxBuffer) {
  const tempDir = os.tmpdir();
  const tempDocxPath = path.join(tempDir, `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.docx`);
  
  try {
    // Write buffer to temp file
    fs.writeFileSync(tempDocxPath, docxBuffer);
    
    // Convert to PDF
    const pdfPath = convertDocxToPdfSync(tempDocxPath, tempDir);
    
    // Read PDF buffer
    const pdfBuffer = fs.readFileSync(pdfPath);
    
    // Clean up temp files
    fs.unlinkSync(tempDocxPath);
    fs.unlinkSync(pdfPath);
    
    return pdfBuffer;
    
  } catch (error) {
    // Clean up on error
    try {
      if (fs.existsSync(tempDocxPath)) {
        fs.unlinkSync(tempDocxPath);
      }
    } catch (e) {}
    
    throw error;
  }
}

module.exports = {
  convertDocxToPdfSync,
  convertDocxBufferToPdfBuffer
};

