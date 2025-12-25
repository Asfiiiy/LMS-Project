/**
 * Certificate Generator Service
 * Auto-generates certificates and transcripts from DOCX templates
 */

const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');
const fs = require('fs-extra');
const path = require('path');
const pool = require('../config/db');
const libreOfficeConfig = require('../config/libreoffice');
const { convertDocxBufferToPdfBuffer } = require('../utils/pdfConverter');

// Ensure directories exist
const TEMPLATES_DIR = path.join(__dirname, '../templates/active');
const GENERATED_DIR = path.join(__dirname, '../generated');
const DOCX_DIR = path.join(GENERATED_DIR, 'docx');
const PDF_DIR = path.join(GENERATED_DIR, 'pdf');

// Create directories if they don't exist
fs.ensureDirSync(TEMPLATES_DIR);
fs.ensureDirSync(DOCX_DIR);
fs.ensureDirSync(PDF_DIR);

/**
 * Get active template for a course type
 */
async function getActiveTemplate(templateType, courseType) {
  try {
    const [templates] = await pool.execute(
      `SELECT * FROM certificate_templates 
       WHERE template_type = ? AND course_type = ? AND is_active = TRUE 
       LIMIT 1`,
      [templateType, courseType]
    );

    if (templates.length === 0) {
      throw new Error(`No active ${templateType} template found for ${courseType} courses`);
    }

    return templates[0];
  } catch (error) {
    console.error('Error fetching template:', error);
    throw error;
  }
}

/**
 * Fill DOCX template with data
 */
async function fillTemplate(templatePath, data) {
  try {
    // Read template file
    const content = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(content);

    // Create docxtemplater instance
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '' // Return empty string for undefined values
    });

    // Fill template with data
    doc.render(data);

    // Generate buffer
    const buffer = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE'
    });

    return buffer;
  } catch (error) {
    console.error('Error filling template:', error);
    if (error.properties && error.properties.errors) {
      console.error('Template errors:', error.properties.errors);
    }
    throw new Error(`Template filling failed: ${error.message}`);
  }
}

/**
 * Convert DOCX to PDF using the new utility
 */
async function convertDocxToPdf(docxBuffer) {
  return await convertDocxBufferToPdfBuffer(docxBuffer);
}

/**
 * OLD Convert DOCX to PDF using LibreOffice (command-line method) - DEPRECATED
 * More reliable than libreoffice-convert library on Windows
 */
async function convertDocxToPdfOld(docxBuffer) {
  if (!libreOfficeConfig.isAvailable) {
    throw new Error('LibreOffice is not available. Please install LibreOffice or set LIBREOFFICE_PATH in .env');
  }
  
  const { spawn } = require('child_process');
  const os = require('os');
  const tempDir = os.tmpdir();
  
  // Create temporary files
  const tempDocxPath = path.join(tempDir, `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.docx`);
  const tempOutDir = path.join(tempDir, `out_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  
  try {
    // Ensure output directory exists
    fs.ensureDirSync(tempOutDir);
    
    // Write DOCX buffer to temp file
    fs.writeFileSync(tempDocxPath, docxBuffer);
    console.log(`   📄 Temp DOCX created: ${tempDocxPath}`);
    
    // Convert using LibreOffice command line
    console.log(`   🔄 Converting with LibreOffice CLI...`);
    
    const libreOfficeBin = libreOfficeConfig.path;
    
    return await new Promise((resolve, reject) => {
      // LibreOffice command: soffice --headless --convert-to pdf --outdir <outdir> <file>
      const args = [
        '--headless',
        '--invisible',
        '--nocrashreport',
        '--nodefault',
        '--nofirststartwizard',
        '--nolockcheck',
        '--nologo',
        '--norestore',
        '--convert-to',
        'pdf:writer_pdf_Export',
        '--outdir',
        tempOutDir,
        tempDocxPath
      ];
      
      console.log(`   Executing: ${libreOfficeBin} ${args.join(' ')}`);
      
      const process = spawn(libreOfficeBin, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        timeout: 30000 // 30 second timeout
      });
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        // Clean up temp DOCX
        try {
          if (fs.existsSync(tempDocxPath)) {
            fs.unlinkSync(tempDocxPath);
          }
        } catch (e) {
          console.warn('   ⚠️  Could not delete temp DOCX:', e.message);
        }
        
        if (code !== 0) {
          // Clean up output dir
          try {
            fs.removeSync(tempOutDir);
          } catch (e) {}
          
          console.error(`   ❌ LibreOffice exited with code ${code}`);
          console.error(`   STDOUT: ${stdout}`);
          console.error(`   STDERR: ${stderr}`);
          return reject(new Error(`LibreOffice conversion failed with code ${code}. STDERR: ${stderr}`));
        }
        
        // Find the generated PDF
        const pdfFileName = path.basename(tempDocxPath, '.docx') + '.pdf';
        const pdfPath = path.join(tempOutDir, pdfFileName);
        
        if (!fs.existsSync(pdfPath)) {
          // Clean up
          try {
            fs.removeSync(tempOutDir);
          } catch (e) {}
          
          console.error(`   ❌ PDF not found at: ${pdfPath}`);
          return reject(new Error(`PDF file not generated at expected path: ${pdfPath}`));
        }
        
        // Read PDF buffer
        const pdfBuffer = fs.readFileSync(pdfPath);
        console.log(`   ✅ PDF conversion successful (${pdfBuffer.length} bytes)`);
        
        // Clean up temp files
        try {
          fs.removeSync(tempOutDir);
        } catch (e) {
          console.warn('   ⚠️  Could not delete temp output dir:', e.message);
        }
        
        resolve(pdfBuffer);
      });
      
      process.on('error', (error) => {
        // Clean up
        try {
          if (fs.existsSync(tempDocxPath)) {
            fs.unlinkSync(tempDocxPath);
          }
          fs.removeSync(tempOutDir);
        } catch (e) {}
        
        console.error(`   ❌ LibreOffice process error:`, error);
        reject(new Error(`Failed to execute LibreOffice: ${error.message}`));
      });
    });
    
  } catch (error) {
    // Clean up on error
    try {
      if (fs.existsSync(tempDocxPath)) {
        fs.unlinkSync(tempDocxPath);
      }
      if (fs.existsSync(tempOutDir)) {
        fs.removeSync(tempOutDir);
      }
    } catch (e) {}
    
    console.error('   ❌ Error in convertDocxToPdf:', error);
    throw new Error(`PDF conversion failed: ${error.message}`);
  }
}

/**
 * Format date for certificate display
 */
function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  const day = d.getDate();
  const month = d.toLocaleString('en-US', { month: 'long' });
  const year = d.getFullYear();
  
  // Add ordinal suffix (st, nd, rd, th)
  const suffix = day === 1 || day === 21 || day === 31 ? 'st' :
                 day === 2 || day === 22 ? 'nd' :
                 day === 3 || day === 23 ? 'rd' : 'th';
  
  return `${day}${suffix} ${month} ${year}`;
}

/**
 * Format units for transcript
 * Returns object with UNIT_1_NAME, UNIT_1_CREDITS, etc.
 * Supports up to 25 units per course
 */
function formatUnits(units) {
  const formattedUnits = {};
  const MAX_UNITS = 25; // Support up to 25 units
  
  if (!units || units.length === 0) {
    // Return empty placeholders for up to 25 units
    for (let i = 1; i <= MAX_UNITS; i++) {
      formattedUnits[`UNIT_${i}_NAME`] = '';
      formattedUnits[`UNIT_${i}_CREDITS`] = '';
    }
    return formattedUnits;
  }

  units.forEach((unit, index) => {
    const num = index + 1;
    if (num <= MAX_UNITS) {
      formattedUnits[`UNIT_${num}_NAME`] = unit.title || unit.name || `Unit ${num}`;
      const credits = unit.cpd_credits || unit.credits || 10;
      formattedUnits[`UNIT_${num}_CREDITS`] = `(${credits} CPD Credits)`;
    }
  });

  // Fill remaining slots with empty strings
  for (let i = units.length + 1; i <= MAX_UNITS; i++) {
    formattedUnits[`UNIT_${i}_NAME`] = '';
    formattedUnits[`UNIT_${i}_CREDITS`] = '';
  }

  return formattedUnits;
}

/**
 * Generate CPD certificates (certificate + transcript)
 * Called automatically after payment is completed
 */
async function generateCPDCertificates(claimId, studentId = null, courseId = null, customData = null, customRegNumber = null) {
  console.log(`\n🎓 Starting certificate generation for claim ID: ${claimId}`);
  if (customRegNumber) {
    console.log(`   📝 Using custom registration number: ${customRegNumber}`);
  }

  try {
    // 1. Get claim details
    const [claims] = await pool.execute(
      `SELECT cc.*, c.title as course_title, u.name as student_name, u.email as student_email
       FROM certificate_claims cc
       JOIN courses c ON cc.course_id = c.id
       JOIN users u ON cc.student_id = u.id
       WHERE cc.id = ?`,
      [claimId]
    );

    if (claims.length === 0) {
      throw new Error(`Claim ${claimId} not found`);
    }

    const claim = claims[0];
    
    // Determine the course name to use for certificate:
    // Priority: customData > certificate_name/selected_course_name > course_title
    let courseNameForCertificate = claim.course_title;
    
    // Use certificate_name or selected_course_name if available
    if (claim.certificate_name && claim.certificate_name.trim() !== '') {
      courseNameForCertificate = claim.certificate_name;
    } else if (claim.selected_course_name && claim.selected_course_name.trim() !== '') {
      courseNameForCertificate = claim.selected_course_name;
    }
    
    // Override with custom data if provided (for editing)
    if (customData) {
      if (customData.STUDENT_NAME) claim.student_name = customData.STUDENT_NAME;
      if (customData.COURSE_NAME) courseNameForCertificate = customData.COURSE_NAME;
    }
    
    // Update claim object with the determined course name
    claim.course_title = courseNameForCertificate;
    
    console.log(`   Student: ${claim.student_name} (${claim.student_email})`);
    console.log(`   Course: ${courseNameForCertificate}`);
    if (claim.certificate_name) console.log(`   Certificate Name: ${claim.certificate_name}`);
    if (claim.selected_course_name) console.log(`   Selected Course Name: ${claim.selected_course_name}`);

    // 2. Get course units for transcript
    let units = [];
    
    // Use custom units if provided (for editing)
    if (customData && customData.units && Array.isArray(customData.units)) {
      units = customData.units.map((unit, index) => ({
        unit_number: index + 1,
        title: unit.name,
        cpd_credits: unit.credits || 10
      }));
      console.log(`   Using ${units.length} custom units from edited data`);
    } else {
      // Fetch units from database
      try {
        // For CPD courses, check 'cpd_topics' table first
        if (claim.course_type === 'cpd') {
        console.log(`   Looking for units in 'cpd_topics' table for CPD course_id: ${claim.course_id}...`);
        const [cpdTopics] = await pool.execute(
          `SELECT topic_number, title, order_index
           FROM cpd_topics 
           WHERE course_id = ? 
           ORDER BY order_index ASC, topic_number ASC`,
          [claim.course_id]
        );
        
        if (cpdTopics.length > 0) {
          // Map to expected format with default CPD credits
          units = cpdTopics.map((topic, index) => ({
            unit_number: topic.topic_number || (index + 1),
            title: topic.title,
            cpd_credits: 10 // Default CPD credits per unit
          }));
          console.log(`   ✅ Found ${units.length} units in 'cpd_topics' table`);
        } else {
          console.log(`   ⚠️  No CPD topics found, trying 'units' table...`);
          // Fallback to 'units' table
          const [courseUnits] = await pool.execute(
            `SELECT id as unit_number, title, order_index
             FROM units 
             WHERE course_id = ? 
             ORDER BY order_index ASC`,
            [claim.course_id]
          );
          
          if (courseUnits.length > 0) {
            units = courseUnits.map(unit => ({
              unit_number: unit.order_index || unit.unit_number,
              title: unit.title,
              cpd_credits: 10
            }));
            console.log(`   ✅ Found ${units.length} units in 'units' table`);
          }
        }
      } else {
        // For qualification courses, try 'qual_units' first, then 'units'
        console.log(`   Looking for units in 'qual_units' table for qualification course_id: ${claim.course_id}...`);
        const [qualUnits] = await pool.execute(
          `SELECT unit_number, title
           FROM qual_units 
           WHERE course_id = ? 
           ORDER BY unit_number ASC`,
          [claim.course_id]
        );
        
        if (qualUnits.length > 0) {
          units = qualUnits.map(unit => ({
            unit_number: unit.unit_number,
            title: unit.title,
            cpd_credits: 10
          }));
          console.log(`   ✅ Found ${units.length} units in 'qual_units' table`);
        } else {
          console.log(`   No qual_units found, trying 'units' table...`);
          const [courseUnits] = await pool.execute(
            `SELECT id as unit_number, title, order_index
             FROM units 
             WHERE course_id = ? 
             ORDER BY order_index ASC`,
            [claim.course_id]
          );
          
          if (courseUnits.length > 0) {
            units = courseUnits.map(unit => ({
              unit_number: unit.order_index || unit.unit_number,
              title: unit.title,
              cpd_credits: 10
            }));
            console.log(`   ✅ Found ${units.length} units in 'units' table`);
          }
        }
      }
      
        // If no units found in any table, use fallback
        if (units.length === 0) {
          console.log(`   ⚠️  No units found in any table, using generic unit structure`);
          units = [
            { unit_number: 1, title: 'Course Completion', cpd_credits: 10 }
          ];
        }
      } catch (error) {
        console.error(`   ❌ Error fetching units:`, error.message);
        // Use fallback on error
        units = [
          { unit_number: 1, title: 'Course Completion', cpd_credits: 10 }
        ];
      }
    }

    console.log(`   Total units to use: ${units.length}`);

    // 3. Get active templates
    const certTemplate = await getActiveTemplate('certificate', 'cpd');
    const transTemplate = await getActiveTemplate('transcript', 'cpd');

    console.log(`   Certificate template: ${certTemplate.template_name}`);
    console.log(`   Transcript template: ${transTemplate.template_name}`);

    // 4. Get or generate registration number
    let registrationNumber;
    if (customRegNumber) {
      registrationNumber = customRegNumber;
      console.log(`   🔢 Using provided registration number: ${registrationNumber}`);
    } else {
      const [regResult] = await pool.execute('CALL get_next_registration_number(@reg_num)');
      const [regNum] = await pool.execute('SELECT @reg_num as registration_number');
      registrationNumber = regNum[0].registration_number;
      console.log(`   🔢 Registration number auto-generated: ${registrationNumber}`);
    }

    // 5. Prepare data for certificate
    const certData = {
      REGISTRATION_NO: registrationNumber,
      STUDENT_NAME: claim.full_name || claim.student_name,
      COURSE_NAME: claim.course_title,
      DATE_OF_ISSUANCE: formatDate(new Date()),
      COMPLETION_DATE: formatDate(claim.claimed_at),
      Date: formatDate(new Date()), // Support {{Date}} as well
      DATE: formatDate(new Date()) // Support {{DATE}} as well
    };

    // 6. Prepare data for transcript
    const transData = {
      REGISTRATION_NO: registrationNumber,
      STUDENT_NAME: claim.full_name || claim.student_name,
      COURSE_NAME: claim.course_title,
      COURSE_LEVEL: claim.cpd_course_level || 'CPD Certificate',
      COMPLETION_DATE: formatDate(claim.claimed_at),
      ...formatUnits(units)
    };

    console.log('   ✅ Data prepared for templates');

    // 7. Fill certificate template
    // Normalize template path - handle both Windows and Linux paths
    let templateFileName = certTemplate.template_path;
    // Replace backslashes with forward slashes (Windows to Linux)
    templateFileName = templateFileName.replace(/\\/g, '/');
    // Extract just the filename, removing any directory paths
    templateFileName = path.basename(templateFileName);
    const certPath = path.join(TEMPLATES_DIR, templateFileName);
    console.log(`   📄 Certificate template path: ${certPath}`);
    if (!fs.existsSync(certPath)) {
      throw new Error(`Certificate template not found at: ${certPath}`);
    }

    const certDocxBuffer = await fillTemplate(certPath, certData);
    const certDocxFilename = `cert_${claimId}_${Date.now()}.docx`;
    const certDocxPath = path.join(DOCX_DIR, certDocxFilename);
    fs.writeFileSync(certDocxPath, certDocxBuffer);

    console.log('   ✅ Certificate DOCX generated');

    // 8. Fill transcript template
    // Normalize template path - handle both Windows and Linux paths
    let transTemplateFileName = transTemplate.template_path;
    // Replace backslashes with forward slashes (Windows to Linux)
    transTemplateFileName = transTemplateFileName.replace(/\\/g, '/');
    // Extract just the filename, removing any directory paths
    transTemplateFileName = path.basename(transTemplateFileName);
    const transPath = path.join(TEMPLATES_DIR, transTemplateFileName);
    console.log(`   📄 Transcript template path: ${transPath}`);
    if (!fs.existsSync(transPath)) {
      throw new Error(`Transcript template not found at: ${transPath}`);
    }

    const transDocxBuffer = await fillTemplate(transPath, transData);
    const transDocxFilename = `trans_${claimId}_${Date.now()}.docx`;
    const transDocxPath = path.join(DOCX_DIR, transDocxFilename);
    fs.writeFileSync(transDocxPath, transDocxBuffer);

    console.log('   ✅ Transcript DOCX generated');

    // 9. Convert DOCX to PDF (optional - if fails, continue with DOCX only)
    let certPdfPath = null;
    let transPdfPath = null;
    
    try {
      console.log('   📄 Converting to PDFs...');
      const certPdfBuffer = await convertDocxToPdf(certDocxBuffer);
      const transPdfBuffer = await convertDocxToPdf(transDocxBuffer);

      const certPdfFilename = `cert_${claimId}_${registrationNumber}.pdf`;
      const transPdfFilename = `trans_${claimId}_${registrationNumber}.pdf`;
      certPdfPath = path.join(PDF_DIR, certPdfFilename);
      transPdfPath = path.join(PDF_DIR, transPdfFilename);

      fs.writeFileSync(certPdfPath, certPdfBuffer);
      fs.writeFileSync(transPdfPath, transPdfBuffer);

      console.log('   ✅ PDFs generated successfully');
    } catch (pdfError) {
      console.warn('   ⚠️  PDF conversion failed, continuing with DOCX only:', pdfError.message);
      console.log('   ℹ️  PDFs can be generated later when needed');
      // Continue without PDFs - they can be generated later
    }

    // 10. Store paths relative to backend directory
    const relativeCertDocxPath = path.relative(path.join(__dirname, '..'), certDocxPath);
    const relativeTransDocxPath = path.relative(path.join(__dirname, '..'), transDocxPath);
    const relativeCertPdfPath = certPdfPath ? path.relative(path.join(__dirname, '..'), certPdfPath) : null;
    const relativeTransPdfPath = transPdfPath ? path.relative(path.join(__dirname, '..'), transPdfPath) : null;

    // 11. Check if certificate already exists for this claim
    const [existing] = await pool.execute(
      'SELECT id FROM generated_certificates WHERE claim_id = ?',
      [claimId]
    );

    let generatedCertId;
    
    if (existing.length > 0) {
      // UPDATE existing record
      generatedCertId = existing[0].id;
      console.log(`   🔄 Updating existing certificate (ID: ${generatedCertId})`);
      
      await pool.execute(
        `UPDATE generated_certificates 
         SET certificate_docx_path = ?,
             transcript_docx_path = ?,
             certificate_pdf_url = ?,
             transcript_pdf_url = ?,
             registration_number = ?,
             registration_added_at = NOW(),
             registration_added_by = ?,
             status = 'ready',
             generated_data = ?
         WHERE id = ?`,
        [
          relativeCertDocxPath,
          relativeTransDocxPath,
          relativeCertPdfPath,
          relativeTransPdfPath,
          registrationNumber,
          1, // System auto-generated (user_id 1 = system/admin)
          JSON.stringify({ certData, transData, registrationNumber }),
          generatedCertId
        ]
      );
      
      console.log(`   ✅ Updated database record (ID: ${generatedCertId})`);
    } else {
      // INSERT new record
      const [result] = await pool.execute(
        `INSERT INTO generated_certificates (
          claim_id, student_id, course_id, course_type,
          certificate_docx_path, transcript_docx_path,
          certificate_pdf_url, transcript_pdf_url,
          registration_number, registration_added_at, registration_added_by,
          status, generated_data
        ) VALUES (?, ?, ?, 'cpd', ?, ?, ?, ?, ?, NOW(), ?, 'ready', ?)`,
        [
          claimId,
          claim.student_id,
          claim.course_id,
          relativeCertDocxPath,
          relativeTransDocxPath,
          relativeCertPdfPath,
          relativeTransPdfPath,
          registrationNumber,
          1, // System auto-generated (user_id 1 = system/admin)
          JSON.stringify({ certData, transData, registrationNumber })
        ]
      );

      generatedCertId = result.insertId;
      console.log(`   ✅ Saved to database (ID: ${generatedCertId})`);
    }

    // 12. Log the generation
    await pool.execute(
      `INSERT INTO certificate_generation_log (generated_cert_id, action, details)
       VALUES (?, 'generated', ?), (?, 'pdf_created', ?)`,
      [
        generatedCertId, 
        JSON.stringify({ claimId, registrationNumber, timestamp: new Date() }),
        generatedCertId,
        JSON.stringify({ registrationNumber, status: 'ready' })
      ]
    );

    console.log(`✅ Certificate generation completed with registration number ${registrationNumber}\n`);

    return {
      success: true,
      generatedCertId,
      registrationNumber,
      message: `Certificates generated successfully with registration number ${registrationNumber}. Ready for delivery.`
    };

  } catch (error) {
    console.error(`❌ Certificate generation failed for claim ${claimId}:`, error);

    // Log failure - get claim details if available
    try {
      let studentId = null;
      let courseId = null;
      
      // Try to get claim details for error logging
      try {
        const [errorClaims] = await pool.execute(
          `SELECT student_id, course_id FROM certificate_claims WHERE id = ?`,
          [claimId]
        );
        if (errorClaims.length > 0) {
          studentId = errorClaims[0].student_id;
          courseId = errorClaims[0].course_id;
        }
      } catch (dbError) {
        console.error('Could not fetch claim details for error logging:', dbError.message);
      }
      
      await pool.execute(
        `INSERT INTO generated_certificates (
          claim_id, student_id, course_id, course_type, status, error_message
        ) VALUES (?, ?, ?, 'cpd', 'failed', ?)`,
        [claimId, studentId, courseId, error.message]
      );
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    throw error;
  }
}

/**
 * Add registration number and generate PDFs
 * Called by admin when they add registration number
 */
async function addRegistrationNumberAndGeneratePDF(generatedCertId, registrationNumber, adminId) {
  console.log(`\n🔢 Adding registration number: ${registrationNumber} to cert ID: ${generatedCertId}`);

  try {
    // 1. Get generated certificate record
    const [genCerts] = await pool.execute(
      `SELECT gc.*, cc.full_name, cc.student_name, cc.certificate_name, cc.selected_course_name, 
              c.title as course_title, cc.claimed_at, cc.cpd_course_level
       FROM generated_certificates gc
       JOIN certificate_claims cc ON gc.claim_id = cc.id
       JOIN courses c ON gc.course_id = c.id
       WHERE gc.id = ?`,
      [generatedCertId]
    );

    if (genCerts.length === 0) {
      throw new Error(`Generated certificate ${generatedCertId} not found`);
    }

    const genCert = genCerts[0];
    
    // Determine the course name to use for certificate:
    // Priority: certificate_name/selected_course_name > course_title
    let courseNameForCertificate = genCert.course_title;
    if (genCert.certificate_name && genCert.certificate_name.trim() !== '') {
      courseNameForCertificate = genCert.certificate_name;
    } else if (genCert.selected_course_name && genCert.selected_course_name.trim() !== '') {
      courseNameForCertificate = genCert.selected_course_name;
    }
    
    // Update genCert object with the determined course name
    genCert.course_title = courseNameForCertificate;

    // 2. Get course units
    const [units] = await pool.execute(
      `SELECT unit_number, title FROM course_units WHERE course_id = ? ORDER BY unit_number ASC`,
      [genCert.course_id]
    );

    // 3. Get templates
    const certTemplate = await getActiveTemplate('certificate', 'cpd');
    const transTemplate = await getActiveTemplate('transcript', 'cpd');

    // 4. Prepare data WITH registration number
    const certData = {
      REGISTRATION_NO: registrationNumber,
      STUDENT_NAME: genCert.full_name || genCert.student_name,
      COURSE_NAME: genCert.course_title,
      DATE_OF_ISSUANCE: formatDate(new Date()),
      COMPLETION_DATE: formatDate(genCert.claimed_at)
    };

    const transData = {
      REGISTRATION_NO: registrationNumber,
      STUDENT_NAME: genCert.full_name || genCert.student_name,
      COURSE_NAME: genCert.course_title,
      COURSE_LEVEL: genCert.cpd_course_level || 'CPD Certificate',
      COMPLETION_DATE: formatDate(genCert.claimed_at),
      ...formatUnits(units)
    };

    console.log('   ✅ Data prepared with registration number');

    // 5. Re-generate DOCX files with registration number
    // Normalize template paths - handle both Windows and Linux paths
    let certTemplateFileName = certTemplate.template_path.replace(/\\/g, '/');
    certTemplateFileName = path.basename(certTemplateFileName);
    let transTemplateFileName = transTemplate.template_path.replace(/\\/g, '/');
    transTemplateFileName = path.basename(transTemplateFileName);
    
    const certPath = path.join(TEMPLATES_DIR, certTemplateFileName);
    const transPath = path.join(TEMPLATES_DIR, transTemplateFileName);

    const certDocxBuffer = await fillTemplate(certPath, certData);
    const transDocxBuffer = await fillTemplate(transPath, transData);

    // Save updated DOCX files
    const certDocxPath = path.join(__dirname, '..', genCert.certificate_docx_path);
    const transDocxPath = path.join(__dirname, '..', genCert.transcript_docx_path);

    fs.writeFileSync(certDocxPath, certDocxBuffer);
    fs.writeFileSync(transDocxPath, transDocxBuffer);

    console.log('   ✅ DOCX files updated with registration number');

    // 6. Convert to PDF
    console.log('   📄 Converting to PDF...');
    const certPdfBuffer = await convertDocxToPdf(certDocxBuffer);
    const transPdfBuffer = await convertDocxToPdf(transDocxBuffer);

    console.log('   ✅ PDF conversion completed');

    // 7. Save PDFs locally (will be uploaded to Cloudinary when delivered)
    const certPdfFilename = `cert_${genCert.claim_id}_${Date.now()}.pdf`;
    const transPdfFilename = `trans_${genCert.claim_id}_${Date.now()}.pdf`;

    const certPdfPath = path.join(PDF_DIR, certPdfFilename);
    const transPdfPath = path.join(PDF_DIR, transPdfFilename);

    fs.writeFileSync(certPdfPath, certPdfBuffer);
    fs.writeFileSync(transPdfPath, transPdfBuffer);

    const relativeCertPdfPath = path.relative(path.join(__dirname, '..'), certPdfPath);
    const relativeTransPdfPath = path.relative(path.join(__dirname, '..'), transPdfPath);

    console.log('   ✅ PDFs saved locally');

    // 8. Update database
    await pool.execute(
      `UPDATE generated_certificates 
       SET registration_number = ?,
           certificate_pdf_url = ?,
           transcript_pdf_url = ?,
           registration_added_at = NOW(),
           registration_added_by = ?,
           status = 'ready'
       WHERE id = ?`,
      [registrationNumber, relativeCertPdfPath, relativeTransPdfPath, adminId, generatedCertId]
    );

    console.log('   ✅ Database updated');

    console.log(`✅ Registration number added and PDFs generated for cert ID ${generatedCertId}\n`);

    return {
      success: true,
      message: 'Registration number added and PDFs generated',
      pdfPaths: {
        certificate: relativeCertPdfPath,
        transcript: relativeTransPdfPath
      }
    };

  } catch (error) {
    console.error(`❌ Failed to add registration number:`, error);
    throw error;
  }
}

module.exports = {
  generateCPDCertificates,
  addRegistrationNumberAndGeneratePDF,
  getActiveTemplate,
  fillTemplate,
  convertDocxToPdf,
  formatDate,
  formatUnits
};

