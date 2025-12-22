/**
 * Fix Existing Certificates in Cloudinary
 * Re-uploads existing certificates with correct public access settings
 */

const pool = require('./config/db');
const cloudinary = require('./config/cloudinary');
const fs = require('fs-extra');
const path = require('path');

async function fixExistingCertificates() {
  console.log('🔧 Fixing Existing Certificates in Cloudinary\n');
  
  try {
    // Get all delivered certificates
    const [certificates] = await pool.execute(`
      SELECT id, student_id, registration_number, certificate_pdf_url, transcript_pdf_url,
             certificate_docx_path, transcript_docx_path
      FROM generated_certificates 
      WHERE status = 'delivered' 
      AND (certificate_pdf_url LIKE '%cloudinary%' OR transcript_pdf_url LIKE '%cloudinary%')
    `);
    
    console.log(`📊 Found ${certificates.length} delivered certificates to fix\n`);
    
    for (const cert of certificates) {
      console.log(`\n🔄 Processing Certificate ID: ${cert.id}`);
      console.log(`   Registration: ${cert.registration_number}`);
      console.log(`   Student ID: ${cert.student_id}`);
      
      let newCertUrl = cert.certificate_pdf_url;
      let newTransUrl = cert.transcript_pdf_url;
      
      // Fix certificate PDF
      if (cert.certificate_pdf_url && cert.certificate_pdf_url.includes('cloudinary')) {
        try {
          // Check if we have local PDF file
          const localPdfPath = path.join(__dirname, 'generated', 'docx', `cert_${cert.registration_number}.pdf`);
          let pdfPath = localPdfPath;
          
          // If no local PDF, try to find DOCX and convert
          if (!fs.existsSync(localPdfPath) && cert.certificate_docx_path) {
            const docxPath = path.join(__dirname, '..', cert.certificate_docx_path);
            if (fs.existsSync(docxPath)) {
              console.log(`   📄 Converting DOCX to PDF for certificate...`);
              const { convertDocxToPdfSync } = require('./utils/pdfConverter');
              try {
                pdfPath = convertDocxToPdfSync(docxPath, path.dirname(localPdfPath));
              } catch (convError) {
                console.warn(`   ⚠️  PDF conversion failed, skipping certificate: ${convError.message}`);
                pdfPath = null;
              }
            }
          }
          
          if (pdfPath && fs.existsSync(pdfPath)) {
            console.log(`   ☁️  Re-uploading certificate PDF with public access...`);
            
            const certUpload = await cloudinary.uploader.upload(pdfPath, {
              folder: `certificates/delivered/${cert.student_id}`,
              resource_type: 'raw',
              public_id: `cert_${cert.registration_number}`,
              access_mode: 'public',
              type: 'upload',
              flags: 'attachment',
              invalidate: true,
              overwrite: true
            });
            
            newCertUrl = certUpload.secure_url;
            console.log(`   ✅ Certificate PDF fixed: ${newCertUrl}`);
          } else {
            console.warn(`   ⚠️  Certificate PDF file not found locally, skipping`);
          }
        } catch (error) {
          console.error(`   ❌ Error fixing certificate PDF: ${error.message}`);
        }
      }
      
      // Fix transcript PDF
      if (cert.transcript_pdf_url && cert.transcript_pdf_url.includes('cloudinary')) {
        try {
          // Check if we have local PDF file
          const localPdfPath = path.join(__dirname, 'generated', 'docx', `trans_${cert.registration_number}.pdf`);
          let pdfPath = localPdfPath;
          
          // If no local PDF, try to find DOCX and convert
          if (!fs.existsSync(localPdfPath) && cert.transcript_docx_path) {
            const docxPath = path.join(__dirname, '..', cert.transcript_docx_path);
            if (fs.existsSync(docxPath)) {
              console.log(`   📄 Converting DOCX to PDF for transcript...`);
              const { convertDocxToPdfSync } = require('./utils/pdfConverter');
              try {
                pdfPath = convertDocxToPdfSync(docxPath, path.dirname(localPdfPath));
              } catch (convError) {
                console.warn(`   ⚠️  PDF conversion failed, skipping transcript: ${convError.message}`);
                pdfPath = null;
              }
            }
          }
          
          if (pdfPath && fs.existsSync(pdfPath)) {
            console.log(`   ☁️  Re-uploading transcript PDF with public access...`);
            
            const transUpload = await cloudinary.uploader.upload(pdfPath, {
              folder: `certificates/delivered/${cert.student_id}`,
              resource_type: 'raw',
              public_id: `trans_${cert.registration_number}`,
              access_mode: 'public',
              type: 'upload',
              flags: 'attachment',
              invalidate: true,
              overwrite: true
            });
            
            newTransUrl = transUpload.secure_url;
            console.log(`   ✅ Transcript PDF fixed: ${newTransUrl}`);
          } else {
            console.warn(`   ⚠️  Transcript PDF file not found locally, skipping`);
          }
        } catch (error) {
          console.error(`   ❌ Error fixing transcript PDF: ${error.message}`);
        }
      }
      
      // Update database if URLs changed
      if (newCertUrl !== cert.certificate_pdf_url || newTransUrl !== cert.transcript_pdf_url) {
        await pool.execute(`
          UPDATE generated_certificates 
          SET certificate_pdf_url = ?, transcript_pdf_url = ?
          WHERE id = ?
        `, [newCertUrl, newTransUrl, cert.id]);
        
        console.log(`   💾 Database updated with new URLs`);
      }
    }
    
    console.log('\n✅ All certificates processed!');
    console.log('\n📋 Next Steps:');
    console.log('1. Test download from student dashboard');
    console.log('2. Check that PDFs open correctly');
    console.log('3. Verify no more "untrusted customer" errors');
    
  } catch (error) {
    console.error('❌ Error fixing certificates:', error);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

fixExistingCertificates();
