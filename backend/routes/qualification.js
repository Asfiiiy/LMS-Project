/**
 * =====================================================
 * QUALIFICATION COURSES API ROUTES
 * =====================================================
 * Handles all qualification course operations:
 * - Course creation and management
 * - Unit management
 * - Topics, files, readings
 * - Assignment briefs and submissions
 * - Tutor grading
 * - Progress tracking and unlock logic
 * =====================================================
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const multer = require('multer');
const cloudinary = require('../config/cloudinary');
const auth = require('../middleware/auth');
const { qualificationSubmitValidation, handleValidationErrors } = require('../middleware/validateInput');
const { sanitize } = require('../utils/sanitizeHtml');
const { cacheMiddleware, invalidateCache } = require('../middleware/cache');
const { logSystemEvent } = require('../utils/eventLogger');
const AssessorActivityLogger = require('../services/assessorActivityLogger');

const QUALIFICATION_CACHE_KEY = 'cache:/api/qualification*';

const QUALIFICATION_UNIT_STAFF_ROLES = ['Admin', 'Assessor', 'Moderator', 'Admission Manager', 'Certificate Manager'];

function canEditQualificationUnitContent(user) {
  return QUALIFICATION_UNIT_STAFF_ROLES.includes(user?.role);
}

function coerceBool01(value) {
  if (value === undefined) return undefined;
  if (value === true || value === 1 || value === '1' || value === 'true') return 1;
  if (value === false || value === 0 || value === '0' || value === 'false') return 0;
  return undefined;
}

function normalizeQualificationVideoLink(body) {
  const raw = body?.video_link ?? body?.video_url ?? body?.large_file_link ?? '';
  const s = typeof raw === 'string' ? raw.trim() : String(raw || '').trim();
  return s || null;
}

function qualificationVideoResubmitTextValid(text) {
  if (!text || typeof text !== 'string') return false;
  return /https?:\/\/[^\s]+/.test(text.trim());
}

function canRejectQualificationSubmissions(user) {
  const rid = user.role_id;
  return rid === 1 || rid === 2;
}

// =====================================================
// MULTER STORAGE CONFIGURATION (Memory Storage)
// =====================================================
// Using memory storage to bypass CloudinaryStorage's 10MB limit
// Files will be uploaded to Cloudinary manually after multer processes them

const storage = multer.memoryStorage();

// Helper function to upload file to Cloudinary
// Note: Cloudinary free tier has 10MB limit per file for raw files
// Paid plans support up to 100MB per file
async function uploadToCloudinary(fileBuffer, originalName, folder = 'lms/qualification', retries = 3) {
  const fileSizeMB = fileBuffer.length / (1024 * 1024);
  
  // Cloudinary free tier has 10MB limit for raw files
  // Paid plans support up to 100MB
  if (fileSizeMB > 10) {
    console.warn(`[Qualification] Warning: File ${originalName} is ${fileSizeMB.toFixed(2)}MB. Cloudinary free tier limit is 10MB per file. Consider upgrading plan for larger files.`);
  }
  
  // Extract filename from originalName (handle cases where it might include path)
  const path = require('path');
  const filename = path.basename(originalName);
  // Get file extension
  const fileExt = path.extname(filename);
  // Get filename without extension
  const filenameWithoutExt = path.parse(filename).name;
  // Sanitize filename to remove special characters that Cloudinary doesn't like
  // Keep only alphanumeric, hyphens, underscores, and dots
  const sanitizedFilename = filenameWithoutExt.replace(/[^a-zA-Z0-9._-]/g, '_');
  // Build a globally-unique public_id so two uploads of the same filename
  // (across different courses/units) never collide on Cloudinary.
  // Combined with overwrite:false this makes silent file replacement impossible.
  const timestamp = Date.now();
  const uniqueSuffix = Math.random().toString(36).substring(2, 8);
  const publicId = `${folder}/${sanitizedFilename}_${timestamp}_${uniqueSuffix}${fileExt}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            public_id: publicId, // Globally-unique: folder/filename_timestamp_random.ext
            resource_type: 'raw',
            type: 'upload', // Explicitly set type
            use_filename: false, // We specify public_id, so don't auto-generate filename
            unique_filename: false, // Don't append cloudinary's own suffix; our suffix is unique
            overwrite: false, // Defense-in-depth: refuse to clobber any existing asset
            access_mode: 'public', // CRITICAL: Explicitly set files as public for proxy access
            invalidate: true, // Invalidate CDN cache
            timeout: 120000 // 120 seconds for large files
          },
          (error, result) => {
            if (error) {
              reject(error);
            } else {
              // Verify the file is public, if not, explicitly set it
              if (result.access_mode !== 'public') {
                console.warn(`[Qualification] Warning: File ${originalName} uploaded but access_mode is ${result.access_mode}, attempting to set as public...`);
                // Try to explicitly set as public using Admin API
                cloudinary.uploader.explicit(result.public_id, {
                  resource_type: 'raw',
                  type: 'upload',
                  access_mode: 'public'
                }, (updateError, updateResult) => {
                  if (updateError) {
                    console.error(`[Qualification] Failed to set file as public:`, updateError);
                  } else {
                    console.log(`[Qualification] ✓ File ${originalName} explicitly set as PUBLIC`);
                  }
                });
              } else {
                console.log(`[Qualification] ✓ File ${originalName} uploaded as PUBLIC (access_mode: ${result.access_mode})`);
              }
              console.log(`[Qualification] Upload result for ${originalName}:`, {
                public_id: result.public_id,
                secure_url: result.secure_url,
                access_mode: result.access_mode,
                resource_type: result.resource_type
              });
              resolve(result);
            }
          }
        );
        
        uploadStream.end(fileBuffer);
      });
    } catch (error) {
      console.error(`[Qualification] Cloudinary upload attempt ${attempt}/${retries} failed for ${originalName}:`, error.message);
      
      if (attempt === retries) {
        // If it's a size limit error, provide helpful message
        if (error.message && error.message.includes('File size too large')) {
          throw new Error(`File ${originalName} (${fileSizeMB.toFixed(2)}MB) exceeds Cloudinary's 10MB limit. Please upgrade your Cloudinary plan or compress the file.`);
        }
        throw error;
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

// Helper function to map MIME type to file_type enum
function getFileTypeFromMimeType(mimeType) {
  if (!mimeType) return 'other';
  
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('video/')) return 'video';
  
  // Document MIME types
  const documentMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'application/rtf',
    'text/rtf',
    'application/vnd.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.spreadsheet',
    'application/vnd.oasis.opendocument.presentation'
  ];
  
  if (documentMimeTypes.includes(mimeType)) return 'document';
  
  return 'other';
}

// File filter to allow document, image, audio, and video formats
const fileFilter = (req, file, cb) => {
  const allowedExtensions = [
    // Documents
    '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt', '.rtf', '.odt', '.ods', '.odp',
    // Images
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp',
    // Audio
    '.mp3', '.wav', '.ogg', '.m4a', '.aac',
    // Video
    '.mp4', '.mov', '.avi', '.wmv', '.flv', '.webm'
  ];
  const allowedMimeTypes = [
    // Documents
    'application/pdf',
    'application/msword', // .doc
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.ms-powerpoint', // .ppt
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
    'application/vnd.ms-excel', // .xls
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'text/plain', // .txt
    'application/rtf', // .rtf
    'text/rtf', // .rtf (alternative)
    'application/vnd.oasis.opendocument.text', // .odt
    'application/vnd.oasis.opendocument.spreadsheet', // .ods
    'application/vnd.oasis.opendocument.presentation', // .odp
    'application/octet-stream', // Sometimes browsers send this for .doc/.docx
    // Images
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/bmp',
    'image/webp',
    // Audio
    'audio/mpeg', // .mp3
    'audio/wav',
    'audio/ogg',
    'audio/mp4', // .m4a
    'audio/aac',
    // Video
    'video/mp4',
    'video/quicktime', // .mov
    'video/x-msvideo', // .avi
    'video/x-ms-wmv', // .wmv
    'video/x-flv', // .flv
    'video/webm'
  ];
  
  // Get file extension
  const lastDot = file.originalname.lastIndexOf('.');
  const fileExt = lastDot > 0 ? file.originalname.toLowerCase().substring(lastDot) : '';
  
  // Check if extension is valid
  const isValidExtension = fileExt && allowedExtensions.includes(fileExt);
  
  // Check if MIME type is valid (also check if it starts with allowed MIME types for flexibility)
  const isValidMimeType = allowedMimeTypes.includes(file.mimetype) || 
                          file.mimetype.startsWith('application/vnd.openxmlformats') ||
                          file.mimetype.startsWith('application/vnd.ms-') ||
                          file.mimetype.startsWith('application/vnd.oasis.opendocument');
  
  // Special case: if extension is .doc or .docx, accept it even if MIME type is application/octet-stream
  const isDocFile = fileExt === '.doc' || fileExt === '.docx';
  const isOctetStream = file.mimetype === 'application/octet-stream';
  
  if (isValidExtension || isValidMimeType || (isDocFile && isOctetStream)) {
    console.log('[Qualification] File accepted:', file.originalname, '- Extension:', fileExt || 'none', '- MIME:', file.mimetype);
    cb(null, true);
  } else {
    console.error('[Qualification] File rejected:', file.originalname, '- Extension:', fileExt || 'none', '- MIME:', file.mimetype);
    cb(new Error(`File format not allowed: ${file.originalname}. Allowed formats: ${allowedExtensions.join(', ')}`), false);
  }
};

const upload = multer({ 
  storage: storage, // Memory storage - files will be uploaded to Cloudinary manually
  fileFilter: fileFilter,
  limits: { 
    fileSize: 200 * 1024 * 1024, // 200MB limit per file (increased for large qualification course files)
    files: 100 // Allow up to 100 files total
  }
});

// =====================================================
// COURSE MANAGEMENT
// =====================================================

// CREATE QUALIFICATION COURSE
router.post('/create', (req, res, next) => {
  // Run auth middleware first
  auth(req, res, (err) => {
    if (err) return next(err);
    // Then run multer for file uploads
    upload.fields([
      { name: 'handbook', maxCount: 1 },
      { name: 'descriptor', maxCount: 1 },
      { name: 'welcome_files', maxCount: 10 },
      { name: 'disclaimer_files', maxCount: 10 },
      { name: 'general_info_files', maxCount: 10 }
    ])(req, res, next);
  });
}, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const {
      title,
      description,
      category_id,
      sub_category_id,
      welcome_message,
      disclaimer,
      general_information
    } = req.body;
    
    const userId = req.user.id;

    if (process.env.NODE_ENV === 'development') {
      console.log('[Qualification] Creating course:', { title, userId });
      console.log('[Qualification] Files received:', req.files ? Object.keys(req.files) : 'none');
    }

    // 1. Create course with type 'qualification'
    const [courseResult] = await connection.execute(
      `INSERT INTO courses (title, description, course_type, status, category_id, sub_category_id, created_by, created_at, updated_at)
       VALUES (?, ?, 'qualification', 'Active', ?, ?, ?, NOW(), NOW())`,
      [sanitize(title), sanitize(description), category_id || null, sub_category_id || null, userId]
    );
    
    const courseId = courseResult.insertId;
    console.log('[Qualification] Course created with ID:', courseId);
    
    // 2. Insert course content (welcome, disclaimer, general info)
    await connection.execute(
      `INSERT INTO qual_course_content (course_id, welcome_message, disclaimer, general_information)
       VALUES (?, ?, ?, ?)`,
      [courseId, welcome_message ? sanitize(welcome_message) : null, disclaimer ? sanitize(disclaimer) : null, general_information ? sanitize(general_information) : null]
    );
    
    // 3. Upload all files
    console.log('[Qualification] Processing files...');
    console.log('[Qualification] req.files keys:', req.files ? Object.keys(req.files) : 'no files');
    
    if (req.files) {
      // Handbook (single file)
      if (req.files.handbook && req.files.handbook[0]) {
        const file = req.files.handbook[0];
        console.log('[Qualification] Handbook file details:');
        console.log('  - Original name:', file.originalname);
        console.log('  - File size:', file.size);
        console.log('  - Mimetype:', file.mimetype);
        
        // Upload to Cloudinary (course-scoped path so filenames never collide across courses)
        const cloudinaryResult = await uploadToCloudinary(
          file.buffer,
          file.originalname,
          `lms/qualification/course-${courseId}`
        );
        const fileUrl = cloudinaryResult.secure_url;

        await connection.execute(
          `INSERT INTO qual_course_files (course_id, file_type, file_name, file_path, file_size, uploaded_by)
           VALUES (?, 'handbook', ?, ?, ?, ?)`,
          [courseId, file.originalname, fileUrl, file.size, userId]
        );
        console.log('[Qualification] Handbook uploaded successfully to database');
      } else {
        console.log('[Qualification] No handbook file found');
      }
      
      // Descriptor (single file)
      if (req.files.descriptor && req.files.descriptor[0]) {
        const file = req.files.descriptor[0];
        // Upload to Cloudinary (course-scoped path)
        const cloudinaryResult = await uploadToCloudinary(
          file.buffer,
          file.originalname,
          `lms/qualification/course-${courseId}`
        );
        const fileUrl = cloudinaryResult.secure_url;
        
        await connection.execute(
          `INSERT INTO qual_course_files (course_id, file_type, file_name, file_path, file_size, uploaded_by)
           VALUES (?, 'descriptor', ?, ?, ?, ?)`,
          [courseId, file.originalname, fileUrl, file.size, userId]
        );
        console.log('[Qualification] Descriptor uploaded');
      }
      
      // Welcome message files (multiple)
      if (req.files.welcome_files) {
        console.log('[Qualification] Uploading', req.files.welcome_files.length, 'welcome files');
        for (const file of req.files.welcome_files) {
          // Upload to Cloudinary (course-scoped path)
          const cloudinaryResult = await uploadToCloudinary(
            file.buffer,
            file.originalname,
            `lms/qualification/course-${courseId}`
          );
          const fileUrl = cloudinaryResult.secure_url;

          await connection.execute(
            `INSERT INTO qual_course_files (course_id, file_type, file_name, file_path, file_size, uploaded_by)
             VALUES (?, 'welcome', ?, ?, ?, ?)`,
            [courseId, file.originalname, fileUrl, file.size, userId]
          );
        }
      }
      
      // Disclaimer files (multiple)
      if (req.files.disclaimer_files) {
        console.log('[Qualification] Uploading', req.files.disclaimer_files.length, 'disclaimer files');
        for (const file of req.files.disclaimer_files) {
          // Upload to Cloudinary (course-scoped path)
          const cloudinaryResult = await uploadToCloudinary(
            file.buffer,
            file.originalname,
            `lms/qualification/course-${courseId}`
          );
          const fileUrl = cloudinaryResult.secure_url;
          
          await connection.execute(
            `INSERT INTO qual_course_files (course_id, file_type, file_name, file_path, file_size, uploaded_by)
             VALUES (?, 'disclaimer', ?, ?, ?, ?)`,
            [courseId, file.originalname, fileUrl, file.size, userId]
          );
        }
      }
      
      // General info files (multiple)
      if (req.files.general_info_files) {
        console.log('[Qualification] Uploading', req.files.general_info_files.length, 'general info files');
        for (const file of req.files.general_info_files) {
          // Upload to Cloudinary (course-scoped path)
          const cloudinaryResult = await uploadToCloudinary(
            file.buffer,
            file.originalname,
            `lms/qualification/course-${courseId}`
          );
          const fileUrl = cloudinaryResult.secure_url;
          
          await connection.execute(
            `INSERT INTO qual_course_files (course_id, file_type, file_name, file_path, file_size, uploaded_by)
             VALUES (?, 'general_info', ?, ?, ?, ?)`,
            [courseId, file.originalname, fileUrl, file.size, userId]
          );
        }
      }
      
      // Handle any other files that weren't caught by specific handlers
      console.log('[Qualification] Checking for unmatched files...');
      for (const fieldName in req.files) {
        if (!['handbook', 'descriptor', 'welcome_files', 'disclaimer_files', 'general_info_files'].includes(fieldName)) {
          console.log('[Qualification] WARNING: Found unmatched field:', fieldName, 'with', req.files[fieldName].length, 'files');
          const files = Array.isArray(req.files[fieldName]) ? req.files[fieldName] : [req.files[fieldName]];
          
          // Try to guess the file type based on field name
          let fileType = 'general_info'; // default
          if (fieldName.includes('welcome')) fileType = 'welcome';
          else if (fieldName.includes('disclaimer')) fileType = 'disclaimer';
          else if (fieldName.includes('handbook')) fileType = 'handbook';
          else if (fieldName.includes('descriptor')) fileType = 'descriptor';
          
          console.log(`[Qualification] Saving ${files.length} files from field "${fieldName}" as type "${fileType}"`);
          
          for (const file of files) {
            // Upload to Cloudinary (course-scoped path)
            const cloudinaryResult = await uploadToCloudinary(
              file.buffer,
              file.originalname,
              `lms/qualification/course-${courseId}`
            );
            const fileUrl = cloudinaryResult.secure_url;
            
            await connection.execute(
              `INSERT INTO qual_course_files (course_id, file_type, file_name, file_path, file_size, uploaded_by)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [courseId, fileType, file.originalname, fileUrl, file.size, userId]
            );
          }
        }
      }
    }
    
    console.log('[Qualification] All files processed, committing transaction...');
    await connection.commit();
    
    // Log course creation
    setImmediate(async () => {
      await logSystemEvent({
        userId: userId,
        action: 'qualification_course_created',
        description: `Course ${title} (ID: ${courseId}) created by user ${userId}`,
        req
      });
    });
    
    res.json({
      success: true,
      message: 'Qualification course created successfully',
      courseId: courseId
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('[Qualification] Error creating course:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating qualification course',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// =====================================================
// DOWNLOAD FILE WITH PROPER FILENAME (MUST BE BEFORE /:courseId)
// =====================================================
router.get('/download-file', async (req, res) => {
  try {
    const { url, filename } = req.query;
    
    if (!url) {
      return res.status(400).json({ success: false, message: 'URL required' });
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[Qualification] Download request received:');
      console.log('  - Filename from query:', filename);
      console.log('  - URL:', url);
    }

    let finalFilename = filename ? String(filename).trim() : '';
    
    // Check if filename looks like a random Cloudinary ID (no extension, alphanumeric only, short)
    const looksLikeCloudinaryId = finalFilename && 
                                   !finalFilename.includes('.') && 
                                   /^[a-z0-9]{10,20}$/i.test(finalFilename);
    
    // If filename is missing or looks like a Cloudinary ID, try to find it in database
    if (!finalFilename || looksLikeCloudinaryId) {
      console.log('[Qualification] Filename appears invalid, looking up in database...');
      
      try {
        // Try to find the file in various qualification tables
        const [courseFiles] = await pool.execute(
          `SELECT file_name FROM qual_course_files WHERE file_path = ? LIMIT 1`,
          [url]
        );
        
        const [announcementFiles] = courseFiles.length === 0 ? await pool.execute(
          `SELECT file_name FROM qual_unit_announcements WHERE file_path = ? LIMIT 1`,
          [url]
        ) : [[]];
        
        const [readingFiles] = announcementFiles.length === 0 ? await pool.execute(
          `SELECT file_name FROM qual_additional_readings WHERE file_path = ? LIMIT 1`,
          [url]
        ) : [[]];
        
        const [briefFiles] = readingFiles.length === 0 ? await pool.execute(
          `SELECT file_name FROM qual_assignment_brief_files WHERE file_path = ? LIMIT 1`,
          [url]
        ) : [[]];
        
        const foundFile = courseFiles[0] || announcementFiles[0] || readingFiles[0] || briefFiles[0];
        
        if (foundFile && foundFile.file_name) {
          finalFilename = foundFile.file_name;
          console.log('[Qualification] Found filename in database:', finalFilename);
        } else {
          console.warn('[Qualification] File not found in database, will try to extract from URL');
        }
      } catch (dbError) {
        console.error('[Qualification] Database lookup error:', dbError.message);
      }
    }
    
    // If still no valid filename, try to extract from URL
    if (!finalFilename || !finalFilename.includes('.')) {
      console.warn('[Qualification] Filename still missing extension, attempting to extract from URL');
      // Try to extract from Cloudinary URL structure
      const urlMatch = url.match(/\/([^\/]+)\.([a-z0-9]+)(?:\?|$)/i);
      if (urlMatch) {
        const baseName = urlMatch[1];
        const ext = urlMatch[2];
        // If we have a base name that looks like a filename, use it
        if (baseName.length > 5 && !/^[a-z0-9]{10,20}$/i.test(baseName)) {
          finalFilename = `${baseName}.${ext}`;
        } else {
          // Otherwise use a generic name with the extension
          finalFilename = `download.${ext}`;
        }
        console.log('[Qualification] Extracted filename from URL:', finalFilename);
      } else {
        // Last resort: try to get extension from URL
        const extMatch = url.match(/\.([a-z0-9]+)(?:\?|$)/i);
        const ext = extMatch ? extMatch[1] : 'file';
        finalFilename = finalFilename ? `${finalFilename}.${ext}` : `download.${ext}`;
        console.log('[Qualification] Using fallback filename:', finalFilename);
      }
    }

    // Get file extension for content type
    const fileExt = finalFilename.toLowerCase().split('.').pop() || '';
    
    // Set proper content type based on extension
    const mimeTypes = {
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'pdf': 'application/pdf',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'txt': 'text/plain',
      'rtf': 'application/rtf'
    };
    
    const contentType = mimeTypes[fileExt] || 'application/octet-stream';

    const https = require('https');
    
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        console.error('[Qualification] Failed to fetch file, status:', response.statusCode);
        return res.status(response.statusCode).json({ 
          success: false, 
          message: 'Failed to fetch file' 
        });
      }

      // Clean filename for Content-Disposition (remove any path separators)
      const cleanFilename = finalFilename.replace(/[\/\\]/g, '_');
      
      // Create safe ASCII filename for basic compatibility
      const asciiFilename = cleanFilename.replace(/[^\x20-\x7E]/g, '_');
      
      // Create RFC 5987 encoded filename for international characters
      const encodedFilename = encodeURIComponent(cleanFilename);
      
      // Set headers for download with original filename
      res.setHeader('Content-Type', contentType);
      // Use both filename (ASCII) and filename* (UTF-8) for maximum browser compatibility
      res.setHeader('Content-Disposition', `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`);

      if (process.env.NODE_ENV === 'development') {
        console.log('[Qualification] Serving file:', {
          originalFilename: filename,
          finalFilename: cleanFilename,
          extension: fileExt,
          contentType: contentType,
          asciiFilename: asciiFilename
        });
      }

      // Pipe the file
      response.pipe(res);

    }).on('error', (error) => {
      console.error('[Qualification] Error downloading file:', error.message);
      res.status(500).json({ success: false, message: 'Error downloading file' });
    });

  } catch (error) {
    console.error('[Qualification] Error:', error.message);
    res.status(500).json({ success: false, message: 'Error downloading file' });
  }
});

// =====================================================
// PROXY PDF FOR VIEWING (MUST BE BEFORE /:courseId)
// =====================================================
router.get('/proxy-pdf', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({ success: false, message: 'URL parameter required' });
    }

    console.log('[Qualification] Proxying PDF:', url);

    // Use Node.js built-in https module (no dependencies)
    const https = require('https');
    
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        console.error('[Qualification] Failed to fetch PDF, status:', response.statusCode);
        return res.status(response.statusCode).json({ 
          success: false, 
          message: 'Failed to fetch PDF from storage' 
        });
      }

      console.log('[Qualification] PDF fetched successfully, streaming to client...');

      // Set appropriate headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.setHeader('Access-Control-Allow-Origin', '*');

      // Pipe the response stream directly
      response.pipe(res);

    }).on('error', (error) => {
      console.error('[Qualification] Error fetching PDF:', error.message);
      res.status(500).json({ success: false, message: 'Error loading PDF' });
    });

  } catch (error) {
    console.error('[Qualification] Error proxying PDF:', error.message);
    res.status(500).json({ success: false, message: 'Error loading PDF' });
  }
});

// GET QUALIFICATION COURSE DETAILS
router.get('/:courseId', cacheMiddleware(300), async (req, res) => {
  try {
    const { courseId } = req.params;
    
    // Get course basic info
    const [course] = await pool.execute(
      `SELECT c.*, 
              cc.name as category_name,
              sc.name as sub_category_name,
              u.name as creator_name,
              qcc.welcome_message,
              qcc.disclaimer,
              qcc.general_information,
              qcc.rule_level_3_enabled,
              qcc.rule_level_3_required_units,
              qcc.rule_level_3_selectable_units
       FROM courses c
       LEFT JOIN course_categories cc ON c.category_id = cc.id
       LEFT JOIN sub_categories sc ON c.sub_category_id = sc.id
       LEFT JOIN users u ON c.created_by = u.id
       LEFT JOIN qual_course_content qcc ON c.id = qcc.course_id
       WHERE c.id = ? AND c.course_type = 'qualification'`,
      [courseId]
    );
    
    if (course.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Qualification course not found'
      });
    }
    
    // Get course files (handbook, descriptor)
    const [files] = await pool.execute(
      `SELECT * FROM qual_course_files WHERE course_id = ?`,
      [courseId]
    );
    
    // Get units (including rule_level_3_enabled flag)
    const [units] = await pool.execute(
      `SELECT u.*, 
              CASE WHEN u.rule_level_3_enabled = 1 THEN true ELSE false END as rule_level_3_enabled
       FROM units u 
       WHERE u.course_id = ? 
       ORDER BY u.order_index`,
      [courseId]
    );
    
    res.json({
      success: true,
      course: course[0],
      files: files,
      units: units
    });
    
  } catch (error) {
    console.error('[Qualification] Error fetching course:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching qualification course'
    });
  }
});

// =====================================================
// UNIT MANAGEMENT
// =====================================================

// CREATE UNIT
router.post('/:courseId/units', (req, res, next) => {
  console.log('[Qualification] Unit creation request received');
  
  // Run auth middleware first
  auth(req, res, (err) => {
    if (err) {
      console.error('[Qualification] Auth error:', err);
      return next(err);
    }
    
    console.log('[Qualification] Auth passed, processing file upload...');
    
    // Then run multer for file uploads - dynamically handle lecture files
    const fields = [
      { name: 'reading_files', maxCount: 20 },
      { name: 'assignment_brief_files', maxCount: 20 }
    ];
    
    // Add lecture file fields dynamically (lecture_0_files, lecture_1_files, etc.)
    for (let i = 0; i < 20; i++) {
      fields.push({ name: `lecture_${i}_files`, maxCount: 20 });
    }
    
    console.log('[Qualification] Multer fields configured:', fields.map(f => f.name).slice(0, 5), '...');
    
    upload.fields(fields)(req, res, (uploadErr) => {
      if (uploadErr) {
        console.error('[Qualification] Multer upload error:', uploadErr);
        console.error('[Qualification] Error details:', {
          message: uploadErr.message,
          code: uploadErr.code,
          field: uploadErr.field,
          filename: uploadErr.filename || 'unknown',
          originalname: uploadErr.originalname || 'unknown'
        });
        
        // Log all files that were attempted to be uploaded
        if (req.files) {
          console.error('[Qualification] Files attempted:', Object.keys(req.files).map(key => {
            const files = Array.isArray(req.files[key]) ? req.files[key] : [req.files[key]];
            return files.map(f => ({
              field: key,
              filename: f.originalname,
              mimetype: f.mimetype,
              size: f.size
            }));
          }).flat());
        }
        
        return res.status(400).json({
          success: false,
          message: 'File upload error',
          error: uploadErr.message
        });
      }
      console.log('[Qualification] File upload successful');
      if (req.files) {
        console.log('[Qualification] Uploaded files:', Object.keys(req.files).map(key => {
          const files = Array.isArray(req.files[key]) ? req.files[key] : [req.files[key]];
          return files.map(f => `${f.originalname} (${f.mimetype})`).join(', ');
        }).join(' | '));
      }
      next();
    });
  });
}, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { courseId } = req.params;
    const {
      title,
      content,
      order_index,
      is_optional,
      unlock_condition,
      enable_assignment_submission,
      enable_presentation_submission,
      enable_quiz,
      deadline,
      disclaimer,
      general_information
    } = req.body;
    
    const userId = req.user.id;
    
    console.log('[Qualification] Creating unit for course:', courseId);
    console.log('[Qualification] Files received:', req.files ? Object.keys(req.files) : 'none');
    
    // 1. Create unit
    // Validate unlock_condition - database column is ENUM('assignment','quiz','both') with default 'assignment'
    // Map frontend values to valid database ENUM values
    let validUnlockCondition = 'assignment'; // Default to 'assignment' (matches database default)
    
    if (unlock_condition && unlock_condition.trim() !== '') {
      const conditionStr = String(unlock_condition).trim().toLowerCase();
      
      // Map frontend values to database ENUM values
      if (conditionStr === 'none' || conditionStr === 'initial' || conditionStr === 'automatic' || conditionStr === 'free') {
        // 'none' means unlocked by default, use 'assignment' as default (or could be 'quiz')
        validUnlockCondition = 'assignment';
      } else if (conditionStr === 'assignment_pass' || conditionStr === 'assignment') {
        validUnlockCondition = 'assignment';
      } else if (conditionStr === 'final_quiz_pass' || conditionStr === 'quiz_pass' || conditionStr === 'quiz') {
        validUnlockCondition = 'quiz';
      } else if (conditionStr === 'both') {
        validUnlockCondition = 'both';
      } else {
        // Unknown value, default to 'assignment'
        console.warn('[Qualification] Unknown unlock_condition value:', conditionStr, '- defaulting to "assignment"');
        validUnlockCondition = 'assignment';
      }
    }
    
    console.log('[Qualification] unlock_condition value:', unlock_condition, '-> processed as:', validUnlockCondition);
    
    const rule_level_3_enabled = req.body.rule_level_3_enabled === 'true' || req.body.rule_level_3_enabled === true ? 1 : 0;
    
    const [unitResult] = await connection.execute(
      `INSERT INTO units (
        course_id, title, content, order_index, is_optional, unlock_condition, 
        enable_assignment_submission, enable_presentation_submission, enable_quiz, 
        rule_level_3_enabled, deadline, 
        created_at, updated_at
      )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        courseId, 
        sanitize(title), 
        sanitize(content || ''), 
        order_index || 0, 
        is_optional === 'true' || is_optional === true ? 1 : 0, 
        validUnlockCondition,
        enable_assignment_submission === 'true' || enable_assignment_submission === true ? 1 : 0,
        enable_presentation_submission === 'true' || enable_presentation_submission === true ? 1 : 0,
        enable_quiz === 'true' || enable_quiz === true ? 1 : 0,
        rule_level_3_enabled,
        deadline || null
      ]
    );
    
    const unitId = unitResult.insertId;
    console.log('[Qualification] Unit created with ID:', unitId);
    
    // 2. Create unit content (disclaimer, general info)
    if (disclaimer || general_information) {
      await connection.execute(
        `INSERT INTO qual_unit_content (unit_id, disclaimer, general_information)
         VALUES (?, ?, ?)`,
        [unitId, sanitize(disclaimer), sanitize(general_information)]
      );
    }
    
    // 3. Process lectures with files
    const lecturesData = req.body.lectures ? JSON.parse(req.body.lectures) : [];
    console.log('[Qualification] Processing', lecturesData.length, 'lectures');
    
    // Track all failed uploads across all sections
    const allUploadErrors = [];
    let newUnitAnnouncementOrder = 0;

    for (let i = 0; i < lecturesData.length; i++) {
      const lecture = lecturesData[i];
      const lectureFiles = req.files[`lecture_${i}_files`] || [];
      
      console.log(`[Qualification] Lecture ${i + 1}:`, lecture.title, '- Files:', lectureFiles.length);
      
      // Store each lecture file as an announcement
      const uploadErrors = [];
      for (const file of lectureFiles) {
        try {
          let announcementType = 'text';
          if (file.originalname.toLowerCase().endsWith('.pdf')) announcementType = 'pdf';
          else if (file.originalname.match(/\.(mp4|avi|mov)$/i)) announcementType = 'video';
          
          // Upload to Cloudinary (course/unit-scoped path)
          const cloudinaryResult = await uploadToCloudinary(
            file.buffer,
            file.originalname,
            `lms/qualification/course-${courseId}/unit-${unitId}`
          );
          const fileUrl = cloudinaryResult.secure_url;
          
          await connection.execute(
            `INSERT INTO qual_unit_announcements (unit_id, title, content, file_path, file_name, announcement_type, order_index)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [unitId, sanitize(`Lecture ${i + 1}: ${lecture.title}`), sanitize(lecture.description || ''), fileUrl, file.originalname, announcementType, newUnitAnnouncementOrder++]
          );
          console.log(`[Qualification] ✓ Uploaded: ${file.originalname}`);
          
          // Small delay to avoid rate limiting (especially important for 50+ files)
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (uploadError) {
          console.error(`[Qualification] ✗ Failed to upload ${file.originalname}:`, uploadError.message);
          uploadErrors.push({ file: file.originalname, error: uploadError.message });
          // Continue with other files even if one fails
        }
      }
      
      if (uploadErrors.length > 0) {
        console.warn(`[Qualification] ${uploadErrors.length} file(s) failed to upload for Lecture ${i + 1}:`, uploadErrors);
        allUploadErrors.push(...uploadErrors.map(e => ({ ...e, lecture: `Lecture ${i + 1}: ${lecture.title}` })));
      }
    }
    
    // 4. Additional reading files
    if (req.files && req.files.reading_files) {
      console.log('[Qualification] Uploading', req.files.reading_files.length, 'reading files');
      const readingUploadErrors = [];
      for (let i = 0; i < req.files.reading_files.length; i++) {
        const file = req.files.reading_files[i];
        try {
          // Upload to Cloudinary (course/unit-scoped path)
          const cloudinaryResult = await uploadToCloudinary(
            file.buffer,
            file.originalname,
            `lms/qualification/course-${courseId}/unit-${unitId}`
          );
          const fileUrl = cloudinaryResult.secure_url;
          
          await connection.execute(
            `INSERT INTO qual_additional_readings (unit_id, title, file_name, file_path, file_size, order_index)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [unitId, sanitize(file.originalname), file.originalname, fileUrl, file.size, i]
          );
          console.log(`[Qualification] ✓ Uploaded reading file: ${file.originalname}`);
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (uploadError) {
          console.error(`[Qualification] ✗ Failed to upload reading file ${file.originalname}:`, uploadError.message);
          readingUploadErrors.push({ file: file.originalname, error: uploadError.message });
        }
      }
      
      if (readingUploadErrors.length > 0) {
        console.warn(`[Qualification] ${readingUploadErrors.length} reading file(s) failed to upload:`, readingUploadErrors);
        allUploadErrors.push(...readingUploadErrors);
      }
    }
    
    // 5. Store assignment brief if enabled
    if (enable_assignment_submission === 'true' || enable_assignment_submission === true) {
      const {
        assignment_brief_heading,
        assignment_brief_description,
        assignment_brief_important_note,
        assignment_brief_grading_type,
        assignment_brief_passing_score
      } = req.body;
      
      if (assignment_brief_heading || assignment_brief_description || assignment_brief_important_note) {
        const [briefResult] = await connection.execute(
          `INSERT INTO qual_assignment_briefs (unit_id, heading, description, important_note, grading_type, passing_score)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            unitId,
            sanitize(assignment_brief_heading) || null,
            sanitize(assignment_brief_description) || null,
            sanitize(assignment_brief_important_note) || null,
            assignment_brief_grading_type || 'pass_fail',
            assignment_brief_grading_type === 'score' ? (assignment_brief_passing_score || 70) : null
          ]
        );
        const briefId = briefResult.insertId;
        console.log('[Qualification] Assignment brief created with ID:', briefId);
        
        // Store assignment brief files if any
        const briefFiles = req.files['assignment_brief_files'] || [];
        if (briefFiles.length > 0) {
          const briefUploadErrors = [];
          for (const file of briefFiles) {
            try {
              // Upload to Cloudinary (course/unit-scoped path)
              const cloudinaryResult = await uploadToCloudinary(
                file.buffer,
                file.originalname,
                `lms/qualification/course-${courseId}/unit-${unitId}/briefs`
              );
              const fileUrl = cloudinaryResult.secure_url;
              
              await connection.execute(
                `INSERT INTO qual_assignment_brief_files (brief_id, file_type, file_name, file_path, file_size)
                 VALUES (?, ?, ?, ?, ?)`,
                [briefId, 'brief', file.originalname, fileUrl, file.size]
              );
              console.log(`[Qualification] ✓ Uploaded brief file: ${file.originalname}`);
              
              // Small delay to avoid rate limiting
              await new Promise(resolve => setTimeout(resolve, 100));
            } catch (uploadError) {
              console.error(`[Qualification] ✗ Failed to upload brief file ${file.originalname}:`, uploadError.message);
              briefUploadErrors.push({ file: file.originalname, error: uploadError.message });
            }
          }
          
          if (briefUploadErrors.length > 0) {
            console.warn(`[Qualification] ${briefUploadErrors.length} brief file(s) failed to upload:`, briefUploadErrors);
            allUploadErrors.push(...briefUploadErrors);
          } else {
            console.log('[Qualification] Uploaded', briefFiles.length, 'assignment brief files');
          }
        }
      }
    }
    
    // 6. Store presentation brief if enabled
    if (enable_presentation_submission === 'true' || enable_presentation_submission === true) {
      const {
        presentation_brief_heading,
        presentation_brief_description,
        presentation_brief_important_note
      } = req.body;
      
      if (presentation_brief_heading || presentation_brief_description || presentation_brief_important_note) {
        await connection.execute(
          `INSERT INTO qual_presentation_briefs (unit_id, heading, description, important_note)
           VALUES (?, ?, ?, ?)`,
          [
            unitId,
            sanitize(presentation_brief_heading) || null,
            sanitize(presentation_brief_description) || null,
            sanitize(presentation_brief_important_note) || null
          ]
        );
        console.log('[Qualification] Presentation brief created');
      }
    }
    
    // 7. Store quiz if enabled (practice only, does not unlock units)
    if (enable_quiz === 'true' || enable_quiz === true) {
      const {
        quiz_title,
        quiz_type,
        quiz_gift_format,
        quiz_passing_score
      } = req.body;
      
      if (quiz_title && quiz_gift_format) {
        // Create quiz
        const [quizResult] = await connection.execute(
          `INSERT INTO qual_unit_quizzes (unit_id, title, quiz_type, gift_format, passing_score)
           VALUES (?, ?, ?, ?, ?)`,
          [
            unitId,
            quiz_title || null,
            quiz_type || 'practice',
            quiz_gift_format || null,
            quiz_passing_score || 70
          ]
        );
        const quizId = quizResult.insertId;
        console.log('[Qualification] Quiz created with ID:', quizId);
        
        // Parse GIFT format and create questions
        if (quiz_gift_format) {
          try {
            const questions = parseGiftFormat(quiz_gift_format);
            console.log('[Qualification] Parsed', questions.length, 'questions from GIFT format');
            
            for (let i = 0; i < questions.length; i++) {
              const q = questions[i];
              await connection.execute(
                `INSERT INTO qual_quiz_questions (quiz_id, question, options, correct_answer, question_type, order_index)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                  quizId,
                  q.question || '',
                  JSON.stringify(q.options || []),
                  q.correctAnswer || 'A',
                  'multiple_choice',
                  i
                ]
              );
            }
            console.log('[Qualification] Added', questions.length, 'quiz questions');
          } catch (parseErr) {
            console.error('[Qualification] Error parsing GIFT format:', parseErr);
            // Don't fail the whole unit creation if quiz parsing fails
          }
        }
      }
    }
    
    // 8. Handle video uploads (videos go to Cloudinary, save link in database)
    // Videos can be uploaded as part of lectures or as separate unit videos
    if (req.files) {
      // Check for video files in lecture files
      for (const fieldName in req.files) {
        if (fieldName.startsWith('lecture_') && fieldName.endsWith('_files')) {
          const files = Array.isArray(req.files[fieldName]) ? req.files[fieldName] : [req.files[fieldName]];
          for (const file of files) {
            // Check if file is a video
            if (file.mimetype && file.mimetype.startsWith('video/')) {
              // Store video link in qual_unit_videos table
              await connection.execute(
                `INSERT INTO qual_unit_videos (unit_id, video_title, video_url, video_type, file_size, uploaded_by)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                  unitId,
                  file.originalname,
                  file.path, // Cloudinary URL
                  'lecture',
                  file.size,
                  userId
                ]
              );
            }
          }
        }
      }

      // Check for dedicated video upload field
      if (req.files.unit_videos) {
        const videos = Array.isArray(req.files.unit_videos) ? req.files.unit_videos : [req.files.unit_videos];
        for (const video of videos) {
          await connection.execute(
            `INSERT INTO qual_unit_videos (unit_id, video_title, video_url, video_type, file_size, uploaded_by)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              unitId,
              video.originalname,
              video.path, // Cloudinary URL
              'unit',
              video.size,
              userId
            ]
          );
          console.log('[Qualification] Unit video uploaded:', video.originalname);
        }
      }
    }
    
    // Commit transaction
    await connection.commit();
    
    // Invalidate cache after successful unit creation
    await invalidateCache(`cache:/api/qualification/${courseId}*`);
    await invalidateCache(`cache:/api/qualification/${courseId}/units*`);
    await invalidateCache(`cache:/api/qualification/units/${unitId}*`);
    // Invalidate student course lists that might include this course
    await invalidateCache(`cache:/api/student/*/qualification-courses*`);
    console.log('[Qualification] Cache invalidated for new unit', unitId, 'and course', courseId);
    
    // Log unit creation (async, don't wait)
    setImmediate(async () => {
      await logSystemEvent({
        userId: req.user?.id || null,
        action: 'qualification_unit_created',
        description: `Unit ${title} (ID: ${unitId}) created for course ${courseId}`,
        req
      });
    });
    
    // Send response with upload errors info if any
    res.json({
      success: true,
      message: allUploadErrors.length > 0 
        ? `Unit created successfully. ${allUploadErrors.length} file(s) failed to upload.`
        : 'Unit created successfully',
      unitId: unitId,
      failedUploads: allUploadErrors.length > 0 ? allUploadErrors : undefined
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('[Qualification] Error creating unit:', error);
    console.error('[Qualification] Error details:', {
      message: error.message,
      unlock_condition_received: req.body?.unlock_condition || 'not provided',
      unlock_condition_type: typeof req.body?.unlock_condition,
      unlock_condition_length: req.body?.unlock_condition ? String(req.body.unlock_condition).length : 0,
      courseId: req.params?.courseId,
      stack: error.stack
    });
    
    // Only send error response if response hasn't been sent yet
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Error creating unit',
        error: error.message
      });
    }
  } finally {
    connection.release();
  }
});

// GET UNIT DETAILS WITH ALL CONTENT
router.get('/units/:unitId', cacheMiddleware(300), async (req, res) => {
  try {
    const { unitId } = req.params;
    const studentId = req.query.studentId;
    
    // Get unit basic info
    const [unit] = await pool.execute(
      `SELECT u.*, quc.welcome_message, quc.disclaimer, quc.general_information
       FROM units u
       LEFT JOIN qual_unit_content quc ON u.id = quc.unit_id
       WHERE u.id = ?`,
      [unitId]
    );
    
    if (unit.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Unit not found'
      });
    }
    
    const [announcements] = await pool.execute(
      `SELECT * FROM qual_unit_announcements WHERE unit_id = ?
       ORDER BY order_index ASC, created_at ASC`,
      [unitId]
    );
    
    // Get topics with files
    const [topics] = await pool.execute(
      `SELECT * FROM qual_topics WHERE unit_id = ? ORDER BY order_index`,
      [unitId]
    );
    
    for (let topic of topics) {
      const [files] = await pool.execute(
        `SELECT * FROM qual_topic_files WHERE topic_id = ?`,
        [topic.id]
      );
      topic.files = files;
    }
    
    // Get additional readings
    const [readings] = await pool.execute(
      `SELECT * FROM qual_additional_readings WHERE unit_id = ? ORDER BY order_index`,
      [unitId]
    );
    
    // Get assignment brief
    const [brief] = await pool.execute(
      `SELECT * FROM qual_assignment_briefs WHERE unit_id = ?`,
      [unitId]
    );
    
    let briefFiles = [];
    if (brief.length > 0) {
      [briefFiles] = await pool.execute(
        `SELECT * FROM qual_assignment_brief_files WHERE brief_id = ?`,
        [brief[0].id]
      );
    }
    
    // Get presentation brief
    const [presentationBrief] = await pool.execute(
      `SELECT * FROM qual_presentation_briefs WHERE unit_id = ?`,
      [unitId]
    );
    
    // Get quiz if enabled
    const [quizzes] = await pool.execute(
      `SELECT * FROM qual_unit_quizzes WHERE unit_id = ?`,
      [unitId]
    );
    
    let quizQuestions = [];
    if (quizzes.length > 0) {
      const [questions] = await pool.execute(
        `SELECT * FROM qual_quiz_questions WHERE quiz_id = ? ORDER BY order_index`,
        [quizzes[0].id]
      );
      // Parse JSON options
      quizQuestions = questions.map(q => ({
        ...q,
        options: typeof q.options === 'string' ? JSON.parse(q.options || '[]') : q.options
      }));
    }
    
    // Get videos
    const [videos] = await pool.execute(
      `SELECT * FROM qual_unit_videos WHERE unit_id = ? ORDER BY created_at`,
      [unitId]
    );
    
    // Get student progress if studentId provided
    let progress = null;
    if (studentId) {
      const [progressData] = await pool.execute(
        `SELECT * FROM qual_unit_progress WHERE unit_id = ? AND student_id = ?`,
        [unitId, studentId]
      );
      progress = progressData.length > 0 ? progressData[0] : null;
      
      // If no progress exists, create initial progress entry
      if (!progress) {
        // Find the minimum order_index (first unit) in this course
        const [minOrderResult] = await pool.execute(
          `SELECT MIN(order_index) as min_order FROM units WHERE course_id = ?`,
          [unit[0].course_id]
        );
        const minOrder = minOrderResult[0]?.min_order ?? 0;
        const isFirstUnit = unit[0].order_index === minOrder;
        
        // Check Rule Level 3 settings
        const [ruleLevel3Settings] = await pool.execute(
          `SELECT rule_level_3_enabled, rule_level_3_required_units
           FROM qual_course_content
           WHERE course_id = ?`,
          [unit[0].course_id]
        );
        
        let isUnlocked = isFirstUnit;
        
        // Check if unit has Rule Level 3 enabled (per-unit based)
        // If it's a Rule Level 3 unit, only unlock if student selected it
        // Otherwise, use existing unlock logic (first unit default, others by assignment)
        const [unitInfo] = await pool.execute(
          `SELECT rule_level_3_enabled FROM units WHERE id = ?`,
          [unitId]
        );
        
        if (unitInfo.length > 0 && unitInfo[0].rule_level_3_enabled) {
          // This is a Rule Level 3 unit - only unlock if student selected it
          const [selected] = await pool.execute(
            `SELECT unit_id FROM qual_student_selected_units
             WHERE course_id = ? AND student_id = ? AND unit_id = ?`,
            [unit[0].course_id, studentId, unitId]
          );
          isUnlocked = selected.length > 0;
        }
        // If not Rule Level 3 unit, keep existing logic (isUnlocked already set above for first unit)
        
        console.log('[Qualification] Creating initial progress - Unit order:', unit[0].order_index, 'Min order:', minOrder, 'Is first unit:', isFirstUnit, 'Is unlocked:', isUnlocked);
        
        await pool.execute(
          `INSERT INTO qual_unit_progress (student_id, course_id, unit_id, is_unlocked, unlocked_at, unlock_method)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [studentId, unit[0].course_id, unitId, isUnlocked ? 1 : 0, isUnlocked ? new Date() : null, isUnlocked ? 'initial' : null]
        );
        
        // Fetch the newly created progress
        const [newProgressData] = await pool.execute(
          `SELECT * FROM qual_unit_progress WHERE unit_id = ? AND student_id = ?`,
          [unitId, studentId]
        );
        progress = newProgressData.length > 0 ? newProgressData[0] : null;
        
        console.log('[Qualification] Created initial progress for unit:', unitId, 'student:', studentId, 'unlocked:', isUnlocked);
      } else {
        // Check Rule Level 3 for existing progress - update unlock status if needed
        const [ruleLevel3Settings] = await pool.execute(
          `SELECT rule_level_3_enabled, rule_level_3_required_units
           FROM qual_course_content
           WHERE course_id = ?`,
          [unit[0].course_id]
        );
        
        // Check if unit has Rule Level 3 enabled (per-unit based)
        // If it's a Rule Level 3 unit, only unlock if student selected it
        // Otherwise, keep existing unlock logic unchanged
        const [unitInfo] = await pool.execute(
          `SELECT rule_level_3_enabled FROM units WHERE id = ?`,
          [unitId]
        );
        
        if (unitInfo.length > 0 && unitInfo[0].rule_level_3_enabled) {
          // This is a Rule Level 3 unit - only unlock if student selected it
          const [selected] = await pool.execute(
            `SELECT unit_id FROM qual_student_selected_units
             WHERE course_id = ? AND student_id = ? AND unit_id = ?`,
            [unit[0].course_id, studentId, unitId]
          );
          const shouldBeUnlocked = selected.length > 0;
          
          // Update progress if unlock status changed
          if (shouldBeUnlocked && progress.is_unlocked === 0) {
            await pool.execute(
              `UPDATE qual_unit_progress
               SET is_unlocked = 1, unlocked_at = NOW(), unlock_method = 'rule_level_3'
               WHERE unit_id = ? AND student_id = ?`,
              [unitId, studentId]
            );
            progress.is_unlocked = 1;
          } else if (!shouldBeUnlocked && progress.is_unlocked === 1) {
            // Lock it if not selected (skip unselected Rule Level 3 units)
            await pool.execute(
              `UPDATE qual_unit_progress
               SET is_unlocked = 0, unlocked_at = NULL, unlock_method = NULL
               WHERE unit_id = ? AND student_id = ?`,
              [unitId, studentId]
            );
            progress.is_unlocked = 0;
          }
        }
        // If not Rule Level 3 unit, existing unlock logic remains unchanged
      }
    }

    // Per-student unit deadline (enrollment setup) — used for assignment submission window
    let studentDeadline = null;
    let studentDeadlineNotes = null;
    let assignmentSubmissionUnlocked = 0;
    let assignmentUnlockedAt = null;
    let assignmentUnlockedBy = null;
    if (studentId) {
      const sid = parseInt(studentId, 10);
      if (!Number.isNaN(sid)) {
        const uid = parseInt(unitId, 10);
        const [deadlineRows] = await pool.execute(
          `SELECT deadline, notes, assignment_submission_unlocked, unlocked_at, unlocked_by
           FROM student_topic_deadlines
           WHERE student_id = ?
             AND topic_id = ?
             AND topic_type = 'qualification_unit'
           LIMIT 1`,
          [sid, uid]
        );
        if (deadlineRows.length > 0) {
          studentDeadline = deadlineRows[0].deadline;
          studentDeadlineNotes = deadlineRows[0].notes != null ? deadlineRows[0].notes : null;
          assignmentSubmissionUnlocked =
            deadlineRows[0].assignment_submission_unlocked === 1 || deadlineRows[0].assignment_submission_unlocked === true ? 1 : 0;
          assignmentUnlockedAt = deadlineRows[0].unlocked_at || null;
          assignmentUnlockedBy = deadlineRows[0].unlocked_by != null ? deadlineRows[0].unlocked_by : null;
        }
      }
    }
    
    res.json({
      success: true,
      unit: unit[0],
      announcements: announcements,
      topics: topics,
      readings: readings,
      assignmentBrief: brief.length > 0 ? brief[0] : null,
      briefFiles: briefFiles,
      presentationBrief: presentationBrief.length > 0 ? presentationBrief[0] : null,
      quiz: quizzes.length > 0 ? quizzes[0] : null,
      quizQuestions: quizQuestions,
      videos: videos,
      progress: progress,
      student_deadline: studentDeadline,
      student_deadline_notes: studentDeadlineNotes,
      assignment_submission_unlocked: assignmentSubmissionUnlocked,
      unlocked_at: assignmentUnlockedAt,
      unlocked_by: assignmentUnlockedBy
    });
    
  } catch (error) {
    console.error('[Qualification] Error fetching unit:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching unit details'
    });
  }
});

// DELETE UNIT
// =====================================================
// REORDER UNITS (Must be BEFORE the generic :unitId route)
// =====================================================
router.put('/units/reorder', auth, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { course_id, units } = req.body;

    console.log('[Qualification] Reordering units for course:', course_id);
    console.log('[Qualification] New order:', units);

    // Update order_index for each unit (unit_number is calculated display value)
    for (const unit of units) {
      const newOrderIndex = unit.unit_number - 1;  // order_index is 0-based, unit_number is 1-based
      console.log(`[Qualification] Updating unit ${unit.id}: order_index = ${newOrderIndex}`);
      
      const [result] = await connection.execute(
        'UPDATE units SET order_index = ? WHERE id = ? AND course_id = ?',
        [newOrderIndex, unit.id, course_id]
      );
      
      console.log(`[Qualification] Update result for unit ${unit.id}:`, result.affectedRows, 'rows affected');
    }

    await connection.commit();

    console.log('[Qualification] Units reordered successfully');

    // Verify the updates
    const [verifyUnits] = await connection.execute(
      'SELECT id, title, order_index FROM units WHERE course_id = ? ORDER BY order_index',
      [course_id]
    );
    console.log('[Qualification] Verified order after commit:', verifyUnits.map(u => ({ id: u.id, title: u.title, order_index: u.order_index })));

    // Invalidate cache for all qualification routes
    await invalidateCache(QUALIFICATION_CACHE_KEY);

    res.json({
      success: true,
      message: 'Units reordered successfully'
    });
  } catch (error) {
    await connection.rollback();
    console.error('[Qualification] Error reordering units:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reorder units',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// UPDATE UNIT (title, content, order, submission flags) — after /units/reorder
router.put('/units/:unitId', auth, async (req, res) => {
  try {
    if (!canEditQualificationUnitContent(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const { unitId } = req.params;
    const b = req.body || {};

    const [existing] = await pool.execute('SELECT * FROM units WHERE id = ?', [unitId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Unit not found' });
    }

    const courseId = existing[0].course_id;
    const updates = [];
    const values = [];

    if (b.title !== undefined) {
      updates.push('title = ?');
      values.push(sanitize(b.title));
    }
    if (b.content !== undefined) {
      updates.push('content = ?');
      values.push(sanitize(b.content));
    }
    if (b.unit_number !== undefined && b.unit_number !== null && b.unit_number !== '') {
      const un = parseInt(b.unit_number, 10);
      if (!Number.isNaN(un)) {
        updates.push('order_index = ?');
        values.push(un - 1);
      }
    }
    const assignSub = coerceBool01(b.enable_assignment_submission);
    if (assignSub !== undefined) {
      updates.push('enable_assignment_submission = ?');
      values.push(assignSub);
    }
    const presSub = coerceBool01(b.enable_presentation_submission);
    if (presSub !== undefined) {
      updates.push('enable_presentation_submission = ?');
      values.push(presSub);
    }

    if (updates.length === 0) {
      return res.json({ success: true, unit: existing[0] });
    }

    values.push(unitId);
    await pool.execute(`UPDATE units SET ${updates.join(', ')} WHERE id = ?`, values);

    const [updated] = await pool.execute('SELECT * FROM units WHERE id = ?', [unitId]);

    await invalidateCache(`cache:/api/qualification/${courseId}*`);
    await invalidateCache(`cache:/api/qualification/units/${unitId}*`);
    await invalidateCache(QUALIFICATION_CACHE_KEY);

    res.json({ success: true, unit: updated[0] });
  } catch (error) {
    console.error('[Qualification] Error updating unit:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating unit',
      error: error.message
    });
  }
});

router.delete('/units/:unitId', auth, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { unitId } = req.params;
    console.log('[Qualification] Deleting unit:', unitId);
    
    // Get course_id before deletion for cache invalidation
    const [unitInfo] = await connection.execute(
      `SELECT course_id FROM units WHERE id = ?`,
      [unitId]
    );
    const courseId = unitInfo.length > 0 ? unitInfo[0].course_id : null;

    // Safety check: refuse delete when student data is attached.
    // Editing a unit must use the UPDATE endpoint, not delete + recreate,
    // because cascade deletes here permanently destroy student progress
    // and submissions (root cause of the unit-204 incident).
    const [studentData] = await connection.execute(
      `SELECT 
         (SELECT COUNT(*) FROM qual_unit_progress WHERE unit_id = ?) AS progress_count,
         (SELECT COUNT(*) FROM qual_submissions   WHERE unit_id = ?) AS submission_count`,
      [unitId, unitId]
    );
    const progressCount = Number(studentData[0].progress_count) || 0;
    const submissionCount = Number(studentData[0].submission_count) || 0;
    if (progressCount > 0 || submissionCount > 0) {
      await connection.rollback();
      console.warn(
        `[Qualification] BLOCKED unit delete unitId=${unitId}: progress=${progressCount} submissions=${submissionCount}`
      );
      return res.status(409).json({
        success: false,
        error: 'Cannot delete unit',
        message:
          `This unit has student data attached: ${progressCount} progress records, ${submissionCount} submissions. ` +
          `Deleting this unit will permanently destroy student progress and submissions. ` +
          `To update unit content use EDIT instead of DELETE.`,
        progress_count: progressCount,
        submission_count: submissionCount
      });
    }

    // 1. Delete all topics and their files
    const [topics] = await connection.execute(
      `SELECT id FROM qual_topics WHERE unit_id = ?`,
      [unitId]
    );
    
    for (const topic of topics) {
      // Delete topic files
      await connection.execute(
        `DELETE FROM qual_topic_files WHERE topic_id = ?`,
        [topic.id]
      );
    }
    
    // Delete topics
    await connection.execute(
      `DELETE FROM qual_topics WHERE unit_id = ?`,
      [unitId]
    );
    
    // 2. Delete announcements (lectures)
    await connection.execute(
      `DELETE FROM qual_unit_announcements WHERE unit_id = ?`,
      [unitId]
    );
    
    // 3. Delete additional readings
    await connection.execute(
      `DELETE FROM qual_additional_readings WHERE unit_id = ?`,
      [unitId]
    );
    
    // 4. Delete assignment brief and its files
    const [briefs] = await connection.execute(
      `SELECT id FROM qual_assignment_briefs WHERE unit_id = ?`,
      [unitId]
    );
    
    for (const brief of briefs) {
      await connection.execute(
        `DELETE FROM qual_assignment_brief_files WHERE brief_id = ?`,
        [brief.id]
      );
    }
    
    await connection.execute(
      `DELETE FROM qual_assignment_briefs WHERE unit_id = ?`,
      [unitId]
    );
    
    // 5. Delete presentation brief
    await connection.execute(
      `DELETE FROM qual_presentation_briefs WHERE unit_id = ?`,
      [unitId]
    );
    
    // 6. Delete unit content
    await connection.execute(
      `DELETE FROM qual_unit_content WHERE unit_id = ?`,
      [unitId]
    );
    
    // 7. Delete unit progress
    await connection.execute(
      `DELETE FROM qual_unit_progress WHERE unit_id = ?`,
      [unitId]
    );
    
    // 8. Delete submissions for this unit
    await connection.execute(
      `DELETE FROM qual_submissions WHERE unit_id = ?`,
      [unitId]
    );
    
    // 9. Delete quizzes and questions
    const [quizzes] = await connection.execute(
      `SELECT id FROM qual_unit_quizzes WHERE unit_id = ?`,
      [unitId]
    );
    for (const quiz of quizzes) {
      await connection.execute(
        `DELETE FROM qual_quiz_questions WHERE quiz_id = ?`,
        [quiz.id]
      );
    }
    await connection.execute(
      `DELETE FROM qual_unit_quizzes WHERE unit_id = ?`,
      [unitId]
    );
    
    // 10. Delete videos
    await connection.execute(
      `DELETE FROM qual_unit_videos WHERE unit_id = ?`,
      [unitId]
    );
    
    // 11. Finally, delete the unit itself
    await connection.execute(
      `DELETE FROM units WHERE id = ?`,
      [unitId]
    );
    
    await connection.commit();
    console.log('[Qualification] Unit deleted successfully');
    
    // Invalidate cache after successful deletion
    if (courseId) {
      await invalidateCache(`cache:/api/qualification/units/${unitId}*`);
      await invalidateCache(`cache:/api/qualification/${courseId}*`);
      await invalidateCache(`cache:/api/qualification/${courseId}/units*`);
      // Invalidate student course lists that might include this course
      await invalidateCache(`cache:/api/student/*/qualification-courses*`);
      console.log('[Qualification] Cache invalidated for deleted unit', unitId, 'and course', courseId);
    }
    
    res.json({
      success: true,
      message: 'Unit deleted successfully'
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('[Qualification] Error deleting unit:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting unit',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// =====================================================
// TOPIC MANAGEMENT
// =====================================================

// ADD TOPIC TO UNIT
router.post('/units/:unitId/topics', auth, upload.array('files', 10), async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { unitId } = req.params;
    const { topic_number, title, description, deadline, order_index } = req.body;
    
    console.log('[Qualification] Adding topic to unit:', unitId);

    // Resolve owning course for collision-proof Cloudinary scoping
    const courseId = await getCourseIdForUnit(connection, unitId);

    // 1. Create topic
    const [topicResult] = await connection.execute(
      `INSERT INTO qual_topics (unit_id, topic_number, title, description, deadline, order_index)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [unitId, topic_number, sanitize(title), sanitize(description), deadline || null, order_index || 0]
    );
    
    const topicId = topicResult.insertId;
    console.log('[Qualification] Topic created with ID:', topicId);
    
    // 2. Upload files
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        // Upload to Cloudinary (course/unit-scoped path)
        const cloudinaryResult = await uploadToCloudinary(
          file.buffer,
          file.originalname,
          `lms/qualification/course-${courseId}/unit-${unitId}/topics`
        );
        const fileUrl = cloudinaryResult.secure_url;
        
        await connection.execute(
          `INSERT INTO qual_topic_files (topic_id, file_name, file_path, file_type, file_size)
           VALUES (?, ?, ?, ?, ?)`,
          [topicId, file.originalname, fileUrl, file.mimetype, file.size]
        );
      }
      console.log('[Qualification] Uploaded', req.files.length, 'files');
    }
    
    await connection.commit();
    
    res.json({
      success: true,
      message: 'Topic created successfully',
      topicId: topicId
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('[Qualification] Error creating topic:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating topic',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// UPDATE TOPIC
router.put('/units/:unitId/topics/:topicId', auth, async (req, res) => {
  try {
    if (!canEditQualificationUnitContent(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const { unitId, topicId } = req.params;
    const b = req.body || {};

    const [topicRows] = await pool.execute(
      'SELECT id FROM qual_topics WHERE id = ? AND unit_id = ?',
      [topicId, unitId]
    );
    if (topicRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Topic not found' });
    }

    const updates = [];
    const values = [];

    if (b.title !== undefined) {
      updates.push('title = ?');
      values.push(sanitize(b.title));
    }
    if (b.description !== undefined) {
      updates.push('description = ?');
      values.push(sanitize(b.description));
    }
    if (b.deadline !== undefined) {
      updates.push('deadline = ?');
      values.push(b.deadline === '' || b.deadline === null ? null : b.deadline);
    }
    if (b.topic_number !== undefined && b.topic_number !== null && b.topic_number !== '') {
      const tn = parseInt(b.topic_number, 10);
      if (!Number.isNaN(tn)) {
        updates.push('topic_number = ?');
        values.push(tn);
      }
    }
    if (b.order_index !== undefined && b.order_index !== null && b.order_index !== '') {
      const oi = parseInt(b.order_index, 10);
      if (!Number.isNaN(oi)) {
        updates.push('order_index = ?');
        values.push(oi);
      }
    }

    if (updates.length === 0) {
      return res.json({ success: true });
    }

    values.push(topicId, unitId);
    await pool.execute(
      `UPDATE qual_topics SET ${updates.join(', ')} WHERE id = ? AND unit_id = ?`,
      values
    );

    await invalidateCache(`cache:/api/qualification/units/${unitId}*`);
    await invalidateCache(QUALIFICATION_CACHE_KEY);

    res.json({ success: true });
  } catch (error) {
    console.error('[Qualification] Error updating topic:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating topic',
      error: error.message
    });
  }
});

// DELETE TOPIC
router.delete('/units/:unitId/topics/:topicId', auth, async (req, res) => {
  const connection = await pool.getConnection();

  try {
    if (!canEditQualificationUnitContent(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const { unitId, topicId } = req.params;

    await connection.beginTransaction();

    const [topicRows] = await connection.execute(
      'SELECT id FROM qual_topics WHERE id = ? AND unit_id = ?',
      [topicId, unitId]
    );
    if (topicRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Topic not found' });
    }

    const [files] = await connection.execute(
      'SELECT id, file_path FROM qual_topic_files WHERE topic_id = ?',
      [topicId]
    );

    for (const f of files) {
      if (f.file_path && f.file_path.includes('cloudinary.com')) {
        try {
          const publicId = f.file_path.match(/\/v\d+\/(.+)$/)?.[1]?.replace(/\.[^/.]+$/, '');
          if (publicId) {
            // Skip destroy if this URL is referenced by other rows (legacy shared-asset protection)
            const sharedElsewhere = await isQualificationFileShared(
              connection,
              f.file_path,
              'qual_topic_files',
              f.id
            );
            if (sharedElsewhere) {
              console.log('[Qualification] Skipping Cloudinary destroy for topic file - shared with other rows:', publicId);
            } else {
              await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
            }
          }
        } catch (cloudErr) {
          console.error('[Qualification] Error deleting topic file from Cloudinary:', cloudErr);
        }
      }
    }

    await connection.execute('DELETE FROM qual_topic_files WHERE topic_id = ?', [topicId]);
    await connection.execute('DELETE FROM qual_topics WHERE id = ? AND unit_id = ?', [topicId, unitId]);

    await connection.commit();

    await invalidateCache(`cache:/api/qualification/units/${unitId}*`);
    await invalidateCache(QUALIFICATION_CACHE_KEY);

    res.json({ success: true, message: 'Topic deleted' });
  } catch (error) {
    await connection.rollback();
    console.error('[Qualification] Error deleting topic:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting topic',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// =====================================================
// LECTURE MANAGEMENT (Announcements)
// =====================================================

async function getNextLectureOrderStart(connection, unitId) {
  const [rows] = await connection.execute(
    'SELECT COALESCE(MAX(order_index), -1) + 1 AS next_o FROM qual_unit_announcements WHERE unit_id = ?',
    [unitId]
  );
  return rows[0]?.next_o ?? 0;
}

// Resolve a unit's parent course_id so that uploaded file paths on Cloudinary
// can be properly scoped per course. `executor` may be a transaction connection
// or the pool. Returns 'unknown' (string) if the unit is missing so we never
// throw and never leak null into a path string.
async function getCourseIdForUnit(executor, unitId) {
  try {
    const [rows] = await executor.execute(
      'SELECT course_id FROM units WHERE id = ?',
      [unitId]
    );
    return rows[0]?.course_id ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

// Returns true if the given Cloudinary `file_path` URL is referenced by any
// qualification row OTHER than (excludeTable, excludeId). Used to gate
// cloudinary.uploader.destroy() calls so that a delete on one row never
// orphans another row that points at the same legacy shared asset.
async function isQualificationFileShared(executor, filePath, excludeTable, excludeId) {
  if (!filePath) return false;
  const tables = [
    'qual_unit_announcements',
    'qual_additional_readings',
    'qual_topic_files',
    'qual_assignment_brief_files',
    'qual_course_files'
  ];
  for (const t of tables) {
    const sql = (t === excludeTable)
      ? `SELECT COUNT(*) AS c FROM ${t} WHERE file_path = ? AND id != ?`
      : `SELECT COUNT(*) AS c FROM ${t} WHERE file_path = ?`;
    const params = (t === excludeTable) ? [filePath, excludeId] : [filePath];
    try {
      const [rows] = await executor.execute(sql, params);
      if ((rows[0]?.c || 0) > 0) return true;
    } catch {
      // Table may not exist on some envs; skip silently.
    }
  }
  return false;
}

// REORDER LECTURES (must be before /lectures/:lectureId routes)
router.put('/units/:unitId/lectures/reorder', auth, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    if (!canEditQualificationUnitContent(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const { unitId } = req.params;
    const { lectures } = req.body || {};

    if (!Array.isArray(lectures) || lectures.length === 0) {
      return res.status(400).json({ success: false, message: 'lectures array is required' });
    }

    await connection.beginTransaction();

    for (const item of lectures) {
      const id = parseInt(item?.id, 10);
      const order_index = parseInt(item?.order_index, 10);
      if (Number.isNaN(id) || Number.isNaN(order_index)) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'Each lecture needs id and order_index' });
      }
      await connection.execute(
        'UPDATE qual_unit_announcements SET order_index = ? WHERE id = ? AND unit_id = ?',
        [order_index, id, unitId]
      );
    }

    await connection.commit();

    await invalidateCache(`cache:/api/qualification/units/${unitId}*`);
    await invalidateCache(QUALIFICATION_CACHE_KEY);

    res.json({ success: true });
  } catch (error) {
    await connection.rollback();
    console.error('[Qualification] Error reordering lectures:', error);
    res.status(500).json({
      success: false,
      message: 'Error reordering lectures',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// ADD LECTURE WITH FILES
router.post('/units/:unitId/lectures', auth, upload.array('files', 20), async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { unitId } = req.params;
    const { title, description } = req.body;
    const userId = req.user.id;
    
    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Lecture title is required'
      });
    }
    
    console.log('[Qualification] Adding lecture to unit:', unitId, 'Title:', title, 'Files:', req.files?.length || 0);
    
    // If no files, just create announcement without file
    if (!req.files || req.files.length === 0) {
      const nextOrder = await getNextLectureOrderStart(connection, unitId);
      await connection.execute(
        `INSERT INTO qual_unit_announcements (unit_id, title, content, announcement_type, order_index)
         VALUES (?, ?, ?, 'text', ?)`,
        [unitId, sanitize(title), sanitize(description || ''), nextOrder]
      );
      
      await connection.commit();
      
      await invalidateCache(`cache:/api/qualification/units/${unitId}*`);
      
      return res.json({
        success: true,
        message: 'Lecture added successfully'
      });
    }
    
    let nextOrder = await getNextLectureOrderStart(connection, unitId);
    // Resolve owning course for collision-proof Cloudinary scoping
    const courseIdForLecture = await getCourseIdForUnit(connection, unitId);
    // Create announcement for each file
    for (const file of req.files) {
      let announcementType = 'text';
      if (file.originalname.toLowerCase().endsWith('.pdf')) announcementType = 'pdf';
      else if (file.originalname.match(/\.(mp4|avi|mov)$/i)) announcementType = 'video';
      
      // Upload to Cloudinary (course/unit-scoped path)
      const cloudinaryResult = await uploadToCloudinary(
        file.buffer,
        file.originalname,
        `lms/qualification/course-${courseIdForLecture}/unit-${unitId}`
      );
      const fileUrl = cloudinaryResult.secure_url;
      
      await connection.execute(
        `INSERT INTO qual_unit_announcements (unit_id, title, content, file_path, file_name, announcement_type, order_index)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [unitId, sanitize(title), sanitize(description || ''), fileUrl, file.originalname, announcementType, nextOrder++]
      );
    }
    
    await connection.commit();
    
    await invalidateCache(`cache:/api/qualification/units/${unitId}*`);
    
    res.json({
      success: true,
      message: 'Lecture added successfully',
      filesUploaded: req.files.length
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('[Qualification] Error adding lecture:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding lecture',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// PATCH LECTURE (title / learning outcome text only)
router.patch('/units/:unitId/lectures/:lectureId', auth, async (req, res) => {
  try {
    if (!canEditQualificationUnitContent(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const { unitId, lectureId } = req.params;
    const { title, content } = req.body || {};

    const updates = [];
    const values = [];

    if (title !== undefined) {
      updates.push('title = ?');
      values.push(sanitize(title));
    }
    if (content !== undefined) {
      updates.push('content = ?');
      values.push(sanitize(content));
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    values.push(lectureId, unitId);
    const [result] = await pool.execute(
      `UPDATE qual_unit_announcements SET ${updates.join(', ')} WHERE id = ? AND unit_id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Lecture not found' });
    }

    await invalidateCache(`cache:/api/qualification/units/${unitId}*`);
    await invalidateCache(QUALIFICATION_CACHE_KEY);

    res.json({ success: true });
  } catch (error) {
    console.error('[Qualification] Error patching lecture:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating lecture',
      error: error.message
    });
  }
});

// DELETE LECTURE
router.delete('/units/:unitId/lectures/:lectureId', auth, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { unitId, lectureId } = req.params;
    
    console.log('[Qualification] Deleting lecture:', lectureId, 'from unit:', unitId);
    
    // Verify lecture belongs to unit
    const [lecture] = await connection.execute(
      `SELECT id, file_path FROM qual_unit_announcements WHERE id = ? AND unit_id = ?`,
      [lectureId, unitId]
    );
    
    if (lecture.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Lecture not found'
      });
    }
    
    // Delete from Cloudinary if file exists
    if (lecture[0].file_path && lecture[0].file_path.includes('cloudinary.com')) {
      try {
        const cloudinary = require('../config/cloudinary');
        const publicId = lecture[0].file_path.match(/\/v\d+\/(.+)$/)?.[1]?.replace(/\.[^/.]+$/, '');
        if (publicId) {
          // Skip destroy if this URL is referenced by other rows (legacy shared-asset protection)
          const sharedElsewhere = await isQualificationFileShared(
            connection,
            lecture[0].file_path,
            'qual_unit_announcements',
            lectureId
          );
          if (sharedElsewhere) {
            console.log('[Qualification] Skipping Cloudinary destroy for lecture - file shared with other rows:', publicId);
          } else {
            await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
            console.log('[Qualification] Deleted file from Cloudinary:', publicId);
          }
        }
      } catch (cloudErr) {
        console.error('[Qualification] Error deleting from Cloudinary:', cloudErr);
        // Continue with database deletion even if Cloudinary deletion fails
      }
    }
    
    // Delete from database
    await connection.execute(
      `DELETE FROM qual_unit_announcements WHERE id = ? AND unit_id = ?`,
      [lectureId, unitId]
    );
    
    await connection.commit();
    
    await invalidateCache(`cache:/api/qualification/units/${unitId}*`);
    
    res.json({
      success: true,
      message: 'Lecture deleted successfully'
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('[Qualification] Error deleting lecture:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting lecture',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// UPDATE/REPLACE LECTURE FILES
router.put('/units/:unitId/lectures/:lectureId/files', auth, upload.array('files', 20), async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    if (!canEditQualificationUnitContent(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    await connection.beginTransaction();
    
    const { unitId, lectureId } = req.params;
    const { title, description } = req.body;
    
    console.log('[Qualification] Updating lecture files:', lectureId, 'Files:', req.files?.length || 0);

    // Resolve owning course for collision-proof Cloudinary scoping
    const courseIdForReplace = await getCourseIdForUnit(connection, unitId);

    // Verify lecture exists (need title/content for re-insert after file replace)
    const [lecture] = await connection.execute(
      `SELECT id, file_path, title, content, unit_id, order_index FROM qual_unit_announcements WHERE id = ? AND unit_id = ?`,
      [lectureId, unitId]
    );
    
    if (lecture.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Lecture not found'
      });
    }
    
    // Delete old file from Cloudinary if exists
    if (lecture[0].file_path && lecture[0].file_path.includes('cloudinary.com')) {
      try {
        const publicId = lecture[0].file_path.match(/\/v\d+\/(.+)$/)?.[1]?.replace(/\.[^/.]+$/, '');
        if (publicId) {
          // Skip destroy if this URL is referenced by other rows (legacy shared-asset protection)
          const sharedElsewhere = await isQualificationFileShared(
            connection,
            lecture[0].file_path,
            'qual_unit_announcements',
            lectureId
          );
          if (sharedElsewhere) {
            console.log('[Qualification] Skipping Cloudinary destroy for replaced lecture - file shared with other rows:', publicId);
          } else {
            await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
            console.log('[Qualification] Deleted old file from Cloudinary:', publicId);
          }
        }
      } catch (cloudErr) {
        console.error('[Qualification] Error deleting old file from Cloudinary:', cloudErr);
      }
    }
    
    // Update lecture with new files
    if (req.files && req.files.length > 0) {
      const baseOrder =
        lecture[0].order_index !== undefined && lecture[0].order_index !== null
          ? Number(lecture[0].order_index)
          : 0;
      // Delete old announcement and create new ones for each file
      await connection.execute(
        `DELETE FROM qual_unit_announcements WHERE id = ?`,
        [lectureId]
      );
      
      let insertOrder = baseOrder;
      for (const file of req.files) {
        let announcementType = 'text';
        if (file.originalname.toLowerCase().endsWith('.pdf')) announcementType = 'pdf';
        else if (file.originalname.match(/\.(mp4|avi|mov)$/i)) announcementType = 'video';

        const cloudinaryResult = await uploadToCloudinary(
          file.buffer,
          file.originalname,
          `lms/qualification/course-${courseIdForReplace}/unit-${unitId}`
        );
        const fileUrl = cloudinaryResult.secure_url;
        
        await connection.execute(
          `INSERT INTO qual_unit_announcements (unit_id, title, content, file_path, file_name, announcement_type, order_index)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            unitId,
            title || lecture[0].title || 'Lecture',
            description !== undefined ? sanitize(description || '') : (lecture[0].content || ''),
            fileUrl,
            file.originalname,
            announcementType,
            insertOrder++
          ]
        );
      }
    } else if (title !== undefined || description !== undefined) {
      // Just update title/description if no files
      await connection.execute(
        `UPDATE qual_unit_announcements SET title = ?, content = ? WHERE id = ? AND unit_id = ?`,
        [
          title !== undefined ? sanitize(title) : lecture[0].title,
          description !== undefined ? sanitize(description || '') : (lecture[0].content || ''),
          lectureId,
          unitId
        ]
      );
    }
    
    await connection.commit();
    
    await invalidateCache(`cache:/api/qualification/units/${unitId}*`);
    await invalidateCache(QUALIFICATION_CACHE_KEY);
    
    res.json({
      success: true,
      message: 'Lecture updated successfully',
      filesUploaded: req.files?.length || 0
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('[Qualification] Error updating lecture:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating lecture',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// =====================================================
// ADDITIONAL READINGS
// =====================================================

// ADD ADDITIONAL READING (one row per file)
router.post('/units/:unitId/readings', auth, upload.array('files', 10), async (req, res) => {
  try {
    if (!canEditQualificationUnitContent(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const { unitId } = req.params;
    const files = req.files || [];

    if (files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one file is required'
      });
    }

    let titles = [];
    if (req.body.titles) {
      try {
        titles = typeof req.body.titles === 'string' ? JSON.parse(req.body.titles) : req.body.titles;
      } catch {
        titles = [];
      }
    }

    const [maxRow] = await pool.execute(
      'SELECT COALESCE(MAX(order_index), -1) AS mx FROM qual_additional_readings WHERE unit_id = ?',
      [unitId]
    );
    let nextOrder = (maxRow[0]?.mx ?? -1) + 1;

    console.log('[Qualification] Adding', files.length, 'reading(s) to unit:', unitId);

    // Resolve owning course for collision-proof Cloudinary scoping
    const courseIdForReading = await getCourseIdForUnit(pool, unitId);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const cloudinaryResult = await uploadToCloudinary(
        file.buffer,
        file.originalname,
        `lms/qualification/course-${courseIdForReading}/unit-${unitId}/readings`
      );
      const fileUrl = cloudinaryResult.secure_url;
      const rowTitle = (titles[i] && String(titles[i]).trim()) || file.originalname;

      await pool.execute(
        `INSERT INTO qual_additional_readings (unit_id, title, file_name, file_path, file_type, file_size, order_index)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [unitId, rowTitle, file.originalname, fileUrl, file.mimetype, file.size, nextOrder++]
      );
    }

    await invalidateCache(`cache:/api/qualification/units/${unitId}*`);
    await invalidateCache(QUALIFICATION_CACHE_KEY);

    res.json({
      success: true,
      message: 'Additional reading(s) added successfully'
    });
  } catch (error) {
    console.error('[Qualification] Error adding reading:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding additional reading'
    });
  }
});

// UPDATE ADDITIONAL READING (optional title and/or file)
router.put('/units/:unitId/readings/:readingId', auth, upload.single('file'), async (req, res) => {
  try {
    if (!canEditQualificationUnitContent(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const { unitId, readingId } = req.params;
    const titleRaw = req.body?.title;

    const [rows] = await pool.execute(
      'SELECT * FROM qual_additional_readings WHERE id = ? AND unit_id = ?',
      [readingId, unitId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Reading not found' });
    }

    const existing = rows[0];
    const hasFile = req.file && req.file.buffer;
    const hasTitle = titleRaw !== undefined && titleRaw !== null && String(titleRaw).trim() !== '';

    if (!hasFile && !hasTitle) {
      return res.status(400).json({
        success: false,
        message: 'Provide a new title and/or file to update'
      });
    }

    let filePath = existing.file_path;
    let fileName = existing.file_name;
    let fileType = existing.file_type;
    let fileSize = existing.file_size;

    if (hasFile) {
      // Resolve owning course for collision-proof Cloudinary scoping
      const courseIdForReadingUpdate = await getCourseIdForUnit(pool, unitId);

      if (existing.file_path && existing.file_path.includes('cloudinary.com')) {
        try {
          const publicId = existing.file_path.match(/\/v\d+\/(.+)$/)?.[1]?.replace(/\.[^/.]+$/, '');
          if (publicId) {
            // Skip Cloudinary destroy when this URL is referenced by other rows
            // (legacy shared-asset protection — see audit on cross-course collisions)
            const sharedElsewhere = await isQualificationFileShared(
              pool,
              existing.file_path,
              'qual_additional_readings',
              readingId
            );
            if (sharedElsewhere) {
              console.log('[Qualification] Skipping Cloudinary destroy for reading - file shared with other rows:', publicId);
            } else {
              await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
            }
          }
        } catch (cloudErr) {
          console.error('[Qualification] Error deleting old reading from Cloudinary:', cloudErr);
        }
      }

      const cloudinaryResult = await uploadToCloudinary(
        req.file.buffer,
        req.file.originalname,
        `lms/qualification/course-${courseIdForReadingUpdate}/unit-${unitId}/readings`
      );
      filePath = cloudinaryResult.secure_url;
      fileName = req.file.originalname;
      fileType = req.file.mimetype;
      fileSize = req.file.size;
    }

    const newTitle = hasTitle ? String(titleRaw).trim() : existing.title;

    await pool.execute(
      `UPDATE qual_additional_readings SET title = ?, file_name = ?, file_path = ?, file_type = ?, file_size = ? WHERE id = ? AND unit_id = ?`,
      [newTitle, fileName, filePath, fileType, fileSize, readingId, unitId]
    );

    const [updated] = await pool.execute(
      'SELECT * FROM qual_additional_readings WHERE id = ? AND unit_id = ?',
      [readingId, unitId]
    );

    await invalidateCache(`cache:/api/qualification/units/${unitId}*`);
    await invalidateCache(QUALIFICATION_CACHE_KEY);

    res.json({ success: true, reading: updated[0] });
  } catch (error) {
    console.error('[Qualification] Error updating reading:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating reading',
      error: error.message
    });
  }
});

// DELETE ADDITIONAL READING
router.delete('/units/:unitId/readings/:readingId', auth, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { unitId, readingId } = req.params;
    
    console.log('[Qualification] Deleting reading:', readingId, 'from unit:', unitId);
    
    // Verify reading belongs to unit
    const [reading] = await connection.execute(
      `SELECT id, file_path FROM qual_additional_readings WHERE id = ? AND unit_id = ?`,
      [readingId, unitId]
    );
    
    if (reading.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Reading not found'
      });
    }
    
    // Delete from Cloudinary if file exists
    if (reading[0].file_path && reading[0].file_path.includes('cloudinary.com')) {
      try {
        const cloudinary = require('../config/cloudinary');
        const publicId = reading[0].file_path.match(/\/v\d+\/(.+)$/)?.[1]?.replace(/\.[^/.]+$/, '');
        if (publicId) {
          // Skip destroy if this URL is referenced by other rows (legacy shared-asset protection)
          const sharedElsewhere = await isQualificationFileShared(
            connection,
            reading[0].file_path,
            'qual_additional_readings',
            readingId
          );
          if (sharedElsewhere) {
            console.log('[Qualification] Skipping Cloudinary destroy for reading - file shared with other rows:', publicId);
          } else {
            await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
            console.log('[Qualification] Deleted file from Cloudinary:', publicId);
          }
        }
      } catch (cloudErr) {
        console.error('[Qualification] Error deleting from Cloudinary:', cloudErr);
        // Continue with database deletion even if Cloudinary deletion fails
      }
    }
    
    // Delete from database
    await connection.execute(
      `DELETE FROM qual_additional_readings WHERE id = ? AND unit_id = ?`,
      [readingId, unitId]
    );
    
    await connection.commit();
    
    await invalidateCache(`cache:/api/qualification/units/${unitId}*`);
    
    res.json({
      success: true,
      message: 'Reading deleted successfully'
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('[Qualification] Error deleting reading:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting reading',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// =====================================================
// ASSIGNMENT BRIEF
// =====================================================

// CREATE ASSIGNMENT BRIEF
router.post('/units/:unitId/assignment-brief', auth, upload.array('files', 10), async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { unitId } = req.params;
    const { important_note, grading_type, passing_score } = req.body;
    
    console.log('[Qualification] Creating assignment brief for unit:', unitId);
    
    // 1. Create brief
    const [briefResult] = await connection.execute(
      `INSERT INTO qual_assignment_briefs (unit_id, important_note, grading_type, passing_score)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
         important_note = VALUES(important_note),
         grading_type = VALUES(grading_type),
         passing_score = VALUES(passing_score)`,
      [unitId, important_note || null, grading_type || 'pass_fail', passing_score || null]
    );
    
    const briefId = briefResult.insertId || (await connection.execute(
      `SELECT id FROM qual_assignment_briefs WHERE unit_id = ?`, [unitId]
    ))[0][0].id;
    
    console.log('[Qualification] Brief created/updated with ID:', briefId);
    
    // 2. Upload files (memoryStorage gives us file.buffer; we must push to Cloudinary
    // and persist the resulting URL — the previous code stored undefined `file.path`).
    if (req.files && req.files.length > 0) {
      const fileTypes = JSON.parse(req.body.fileTypes || '[]');

      // Resolve owning course for collision-proof Cloudinary scoping
      const courseIdForBrief = await getCourseIdForUnit(connection, unitId);

      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const fileType = fileTypes[i] || 'other';

        const briefCloudResult = await uploadToCloudinary(
          file.buffer,
          file.originalname,
          `lms/qualification/course-${courseIdForBrief}/unit-${unitId}/briefs`
        );

        await connection.execute(
          `INSERT INTO qual_assignment_brief_files (brief_id, file_type, file_name, file_path, file_size)
           VALUES (?, ?, ?, ?, ?)`,
          [briefId, fileType, file.originalname, briefCloudResult.secure_url, file.size]
        );
      }
      console.log('[Qualification] Uploaded', req.files.length, 'brief files');
    }
    
    await connection.commit();
    
    await invalidateCache(`cache:/api/qualification/units/${unitId}*`);
    
    res.json({
      success: true,
      message: 'Assignment brief created successfully',
      briefId: briefId
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('[Qualification] Error creating brief:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating assignment brief',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// ADD ASSIGNMENT BRIEF FILES
router.post('/units/:unitId/assignment-brief/files', auth, upload.array('files', 20), async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { unitId } = req.params;
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files provided'
      });
    }
    
    console.log('[Qualification] Adding assignment brief files to unit:', unitId, 'Files:', req.files.length);
    
    // Get or create brief
    const [brief] = await connection.execute(
      `SELECT id FROM qual_assignment_briefs WHERE unit_id = ?`,
      [unitId]
    );
    
    let briefId;
    if (brief.length === 0) {
      // Create brief if it doesn't exist
      const [newBrief] = await connection.execute(
        `INSERT INTO qual_assignment_briefs (unit_id, grading_type)
         VALUES (?, 'pass_fail')`,
        [unitId]
      );
      briefId = newBrief.insertId;
      console.log('[Qualification] Created new assignment brief with ID:', briefId);
    } else {
      briefId = brief[0].id;
    }
    
    // Upload files to Cloudinary and persist resulting URL
    // (previous code stored undefined `file.path` from memoryStorage)
    const courseIdForBriefFiles = await getCourseIdForUnit(connection, unitId);
    for (const file of req.files) {
      const briefFileCloudResult = await uploadToCloudinary(
        file.buffer,
        file.originalname,
        `lms/qualification/course-${courseIdForBriefFiles}/unit-${unitId}/briefs`
      );
      await connection.execute(
        `INSERT INTO qual_assignment_brief_files (brief_id, file_type, file_name, file_path, file_size)
         VALUES (?, ?, ?, ?, ?)`,
        [briefId, 'brief', file.originalname, briefFileCloudResult.secure_url, file.size]
      );
    }
    
    await connection.commit();
    
    await invalidateCache(`cache:/api/qualification/units/${unitId}*`);
    
    res.json({
      success: true,
      message: 'Assignment brief files uploaded successfully',
      filesUploaded: req.files.length
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('[Qualification] Error uploading assignment brief files:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading assignment brief files',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// DELETE ASSIGNMENT BRIEF FILE
router.delete('/units/:unitId/assignment-brief/files/:fileId', auth, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { unitId, fileId } = req.params;
    
    console.log('[Qualification] Deleting assignment brief file:', fileId, 'from unit:', unitId);
    
    // Verify file belongs to unit's brief
    const [file] = await connection.execute(
      `SELECT abf.id, abf.file_path, abf.brief_id
       FROM qual_assignment_brief_files abf
       JOIN qual_assignment_briefs ab ON abf.brief_id = ab.id
       WHERE abf.id = ? AND ab.unit_id = ?`,
      [fileId, unitId]
    );
    
    if (file.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
    
    // Delete from Cloudinary if file exists
    if (file[0].file_path && file[0].file_path.includes('cloudinary.com')) {
      try {
        const cloudinary = require('../config/cloudinary');
        const publicId = file[0].file_path.match(/\/v\d+\/(.+)$/)?.[1]?.replace(/\.[^/.]+$/, '');
        if (publicId) {
          // Skip destroy if this URL is referenced by other rows (legacy shared-asset protection)
          const sharedElsewhere = await isQualificationFileShared(
            connection,
            file[0].file_path,
            'qual_assignment_brief_files',
            fileId
          );
          if (sharedElsewhere) {
            console.log('[Qualification] Skipping Cloudinary destroy for brief file - shared with other rows:', publicId);
          } else {
            await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
            console.log('[Qualification] Deleted file from Cloudinary:', publicId);
          }
        }
      } catch (cloudErr) {
        console.error('[Qualification] Error deleting from Cloudinary:', cloudErr);
        // Continue with database deletion even if Cloudinary deletion fails
      }
    }
    
    // Delete from database
    await connection.execute(
      `DELETE FROM qual_assignment_brief_files WHERE id = ?`,
      [fileId]
    );
    
    await connection.commit();
    
    await invalidateCache(`cache:/api/qualification/units/${unitId}*`);
    
    res.json({
      success: true,
      message: 'Assignment brief file deleted successfully'
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('[Qualification] Error deleting assignment brief file:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting assignment brief file',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// =====================================================
// STUDENT SUBMISSION
// =====================================================

// SUBMIT ASSIGNMENT OR PRESENTATION (or resubmit if failed) - SUPPORTS MULTIPLE FILES
router.post('/units/:unitId/submit', auth, upload.array('files', 10), qualificationSubmitValidation, handleValidationErrors, async (req, res) => {
  const { unitId } = req.params;
  const { submission_type, is_resubmission } = req.body;
  const video_link = normalizeQualificationVideoLink(req.body);
  const studentId = req.user.id;
  const files = req.files || [];
  
  // Check if at least one file OR video link is provided
  if (files.length === 0 && !video_link) {
    return res.status(400).json({
      success: false,
      message: 'At least one file or video link is required'
    });
  }

  // Assignment only: enforce enrollment deadline window (opens 3 days before due)
  if (submission_type === 'assignment') {
    const uid = parseInt(unitId, 10);
    const [unitMeta] = await pool.execute(
      'SELECT course_id, order_index FROM units WHERE id = ? LIMIT 1',
      [uid]
    );
    let isFirstUnit = false;
    if (unitMeta.length > 0) {
      const { course_id: cid, order_index: oi } = unitMeta[0];
      const [minOrderResult] = await pool.execute(
        'SELECT MIN(order_index) as min_order FROM units WHERE course_id = ?',
        [cid]
      );
      const minOrder = minOrderResult[0]?.min_order;
      isFirstUnit = oi === minOrder;
    }

    if (!isFirstUnit) {
      const [deadlineRows] = await pool.execute(
        `SELECT deadline, assignment_submission_unlocked
         FROM student_topic_deadlines
         WHERE student_id = ?
           AND topic_id = ?
           AND topic_type = 'qualification_unit'
         LIMIT 1`,
        [studentId, uid]
      );
      const row = deadlineRows[0];
      const adminUnlocked = row && (row.assignment_submission_unlocked === 1 || row.assignment_submission_unlocked === true);
      if (!adminUnlocked && row && row.deadline) {
        const deadline = new Date(row.deadline);
        const now = new Date();
        const unlockDate = new Date(deadline);
        unlockDate.setDate(unlockDate.getDate() - 3);
        if (now < unlockDate) {
          const msPerDay = 1000 * 60 * 60 * 24;
          const daysUntilUnlock = Math.ceil((unlockDate.getTime() - now.getTime()) / msPerDay);
          return res.status(403).json({
            success: false,
            error: 'Assignment submission is not yet open.',
            code: 'SUBMISSION_LOCKED',
            message: 'Assignment submission is not yet open.',
            unlockDate: unlockDate.toISOString(),
            daysUntilUnlock,
            deadline: deadline.toISOString()
          });
        }
      }
    }
  }

  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    console.log('[Qualification] Student', studentId, 'submitting', submission_type, 'for unit:', unitId);
    console.log('[Qualification] Files count:', files.length, 'Video link:', video_link || 'none', 'is_resubmission:', is_resubmission);
    
    let submissionId;
    
    // 1. Create main submission record first (with video link if provided)
    const [submissionResult] = await connection.execute(
      `INSERT INTO qual_submissions (unit_id, student_id, submission_type, file_name, file_path, video_link, file_size, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'submitted')`,
      [
        unitId, 
        studentId, 
        submission_type, 
        files.length > 0 ? files[0].originalname : 'Multiple files', 
        files.length > 0 ? 'multi' : 'video-only', 
        video_link || null, 
        files.length > 0 ? files[0].size : 0
      ]
    );
    submissionId = submissionResult.insertId;
    
    console.log('[Qualification] Created submission:', submissionId);
    
    // 2. Upload all files to Cloudinary and store in assignment_submission_files table
    if (files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        try {
          const cloudinaryResult = await uploadToCloudinary(
            file.buffer, 
            file.originalname, 
            `lms/qualification/submissions/unit-${unitId}/student-${studentId}`
          );
          console.log(`[Qualification] File ${i + 1}/${files.length} uploaded to Cloudinary:`, cloudinaryResult.secure_url);
          
          // Determine file type based on extension
          const fileExtension = file.originalname.split('.').pop().toLowerCase();
          let fileType = 'document';
          if (['jpg', 'jpeg', 'png', 'gif'].includes(fileExtension)) {
            fileType = 'image';
          } else if (['mp3', 'wav', 'ogg'].includes(fileExtension)) {
            fileType = 'audio';
          } else if (['mp4', 'mov', 'avi'].includes(fileExtension)) {
            fileType = 'video';
          }
          
          // Store in assignment_submission_files table (is_new = 1 by default)
          await connection.execute(
            `INSERT INTO assignment_submission_files (submission_id, file_type, file_name, file_path, file_size, status, is_new)
             VALUES (?, ?, ?, ?, ?, 'pending', 1)`,
            [submissionId, fileType, file.originalname, cloudinaryResult.secure_url, file.size]
          );
          
        } catch (uploadError) {
          console.error(`[Qualification] Cloudinary upload failed for file ${i + 1}:`, uploadError);
          await connection.rollback();
          
          // Check if it's a file size error
          if (uploadError.message.includes('exceeds Cloudinary') || uploadError.message.includes('10MB')) {
            return res.status(413).json({
              success: false,
              message: `⚠️ File "${file.originalname}" is too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum file size is 10MB.`,
              fileName: file.originalname,
              fileSize: (file.size / 1024 / 1024).toFixed(2),
              suggestion: 'Please upload large files to Google Drive and share the public link in the "Large Files Links" field below.'
            });
          }
          
          return res.status(500).json({
            success: false,
            message: `Failed to upload file "${file.originalname}" to cloud storage`,
            fileName: file.originalname,
            error: uploadError.message
          });
        }
      }
    }
    
    if (is_resubmission === 'true' || is_resubmission === true) {
      console.log('[Qualification] Created new resubmission (preserving old feedback):', submissionId);
    } else {
      console.log('[Qualification] Created new submission:', submissionId);
    }
    
    // 2. Update progress
    await connection.execute(
      `INSERT INTO qual_unit_progress (student_id, course_id, unit_id, ${submission_type}_submitted)
       SELECT ?, course_id, ?, 1 FROM units WHERE id = ?
       ON DUPLICATE KEY UPDATE ${submission_type}_submitted = 1`,
      [studentId, unitId, unitId]
    );
    
    // 3. UNLOCK LOGIC: When assignment is submitted, check unlock conditions
    // Get current unit order and find first unit in course
    const [currentUnit] = await connection.execute(
      `SELECT order_index, course_id, rule_level_3_enabled FROM units WHERE id = ?`,
      [unitId]
    );
    
    if (currentUnit.length > 0 && submission_type === 'assignment') {
      const currentOrder = currentUnit[0].order_index;
      const courseId = currentUnit[0].course_id;
      const isRuleLevel3Unit = currentUnit[0].rule_level_3_enabled === 1;
      
      // Find the minimum order_index (first unit) in this course
      const [minOrderResult] = await connection.execute(
        `SELECT MIN(order_index) as min_order FROM units WHERE course_id = ?`,
        [courseId]
      );
      const minOrder = minOrderResult[0]?.min_order ?? 0;
      const isFirstUnit = currentOrder === minOrder;
      
      console.log('[Qualification] Unlock check - Current unit order:', currentOrder, 'Min order:', minOrder, 'Is first unit:', isFirstUnit);
      
      if (isFirstUnit) {
        // Unit 1 submitted → Unlock Unit 2 (next unit by order_index)
        // But skip Rule Level 3 units unless selected
        const [nextUnit] = await connection.execute(
          `SELECT id, order_index, rule_level_3_enabled FROM units 
           WHERE course_id = ? AND order_index > ?
           ORDER BY order_index ASC
           LIMIT 1`,
          [courseId, currentOrder]
        );
        if (nextUnit.length > 0) {
          const nextUnitId = nextUnit[0].id;
          const isNextUnitRuleLevel3 = nextUnit[0].rule_level_3_enabled === 1;
          
          // If next unit is Rule Level 3, only unlock if student selected it
          if (isNextUnitRuleLevel3) {
            const [selected] = await connection.execute(
              `SELECT unit_id FROM qual_student_selected_units
               WHERE course_id = ? AND student_id = ? AND unit_id = ?`,
              [courseId, studentId, nextUnitId]
            );
                if (selected.length === 0) {
                  console.log('[Qualification] ⏭️ Skipping Rule Level 3 unit', nextUnitId, '- not selected by student. Student must select units first.');
                  // Don't unlock anything - Rule Level 3 units must be selected via the modal
                } else {
              // Student selected it, unlock it
              await connection.execute(
                `INSERT INTO qual_unit_progress (student_id, course_id, unit_id, is_unlocked, unlocked_at, unlock_method)
                 VALUES (?, ?, ?, 1, NOW(), 'rule_level_3')
                 ON DUPLICATE KEY UPDATE 
                   is_unlocked = 1,
                   unlocked_at = NOW(),
                   unlock_method = 'rule_level_3'`,
                [studentId, courseId, nextUnitId]
              );
              console.log('[Qualification] ✅ Rule Level 3 Unit', nextUnitId, 'unlocked (student selected it)');
            }
          } else {
            // Not Rule Level 3 unit - use existing unlock logic
            await connection.execute(
              `INSERT INTO qual_unit_progress (student_id, course_id, unit_id, is_unlocked, unlocked_at, unlock_method)
               VALUES (?, ?, ?, 1, NOW(), 'assignment_submitted')
               ON DUPLICATE KEY UPDATE 
                 is_unlocked = 1,
                 unlocked_at = NOW(),
                 unlock_method = 'assignment_submitted'`,
              [studentId, courseId, nextUnitId]
            );
            console.log('[Qualification] ✅ Unit', nextUnitId, '(order', nextUnit[0].order_index, ') unlocked (existing logic)');
          }
          
          // Invalidate cache to ensure fresh data
          await invalidateCache(`cache:/api/qualification/units/${nextUnitId}*`);
          await invalidateCache(`cache:/api/qualification/${courseId}*`);
          await invalidateCache(`cache:/api/student/${studentId}/qualification-courses*`);
        } else {
          console.log('[Qualification] ⚠️ No next unit found to unlock after Unit 1');
        }
      } else {
        // For Unit N (N > 1): Check if Unit (N-1) is PASSED, then unlock Unit (N+1)
        const [prevUnit] = await connection.execute(
          `SELECT id, order_index FROM units 
           WHERE course_id = ? AND order_index < ?
           ORDER BY order_index DESC
           LIMIT 1`,
          [courseId, currentOrder]
        );
        
        if (prevUnit.length > 0) {
          // Check if previous unit assignment is PASSED
          const [prevSubmission] = await connection.execute(
            `SELECT pass_fail_result FROM qual_submissions 
             WHERE unit_id = ? AND student_id = ? AND submission_type = 'assignment'
             ORDER BY submitted_at DESC LIMIT 1`,
            [prevUnit[0].id, studentId]
          );
          
          if (prevSubmission.length > 0 && prevSubmission[0].pass_fail_result === 'pass') {
            // Previous unit is PASSED → Unlock next unit
            // But skip Rule Level 3 units unless selected
            const [nextUnit] = await connection.execute(
              `SELECT id, order_index, rule_level_3_enabled FROM units 
               WHERE course_id = ? AND order_index > ?
               ORDER BY order_index ASC
               LIMIT 1`,
              [courseId, currentOrder]
            );
            
            if (nextUnit.length > 0) {
              const nextUnitId = nextUnit[0].id;
              const isNextUnitRuleLevel3 = nextUnit[0].rule_level_3_enabled === 1;
              
              // If next unit is Rule Level 3, only unlock if student selected it
              if (isNextUnitRuleLevel3) {
                const [selected] = await connection.execute(
                  `SELECT unit_id FROM qual_student_selected_units
                   WHERE course_id = ? AND student_id = ? AND unit_id = ?`,
                  [courseId, studentId, nextUnitId]
                );
                if (selected.length === 0) {
                  console.log('[Qualification] ⏭️ Skipping Rule Level 3 unit', nextUnitId, '- not selected by student');
                  // Don't unlock any unit - Rule Level 3 units must be selected first
                  // Student will see the selection modal when they complete all required units
                } else {
                  // Student selected it, unlock it
                  await connection.execute(
                    `INSERT INTO qual_unit_progress (student_id, course_id, unit_id, is_unlocked, unlocked_at, unlock_method)
                     VALUES (?, ?, ?, 1, NOW(), 'rule_level_3')
                     ON DUPLICATE KEY UPDATE 
                       is_unlocked = 1,
                       unlocked_at = NOW(),
                       unlock_method = 'rule_level_3'`,
                    [studentId, courseId, nextUnitId]
                  );
                  console.log('[Qualification] ✅ Rule Level 3 Unit', nextUnitId, 'unlocked (student selected it)');
                  await invalidateCache(`cache:/api/qualification/units/${nextUnitId}*`);
                  await invalidateCache(`cache:/api/qualification/${courseId}*`);
                  await invalidateCache(`cache:/api/student/${studentId}/qualification-courses*`);
                }
              } else {
                // Not Rule Level 3 unit - use existing unlock logic (unchanged)
                await connection.execute(
                  `INSERT INTO qual_unit_progress (student_id, course_id, unit_id, is_unlocked, unlocked_at, unlock_method)
                   VALUES (?, ?, ?, 1, NOW(), 'assignment_submitted')
                   ON DUPLICATE KEY UPDATE 
                     is_unlocked = 1,
                     unlocked_at = NOW(),
                     unlock_method = 'assignment_submitted'`,
                  [studentId, courseId, nextUnitId]
                );
                console.log('[Qualification] ✅ Unit', nextUnitId, '(order', nextUnit[0].order_index, ') unlocked because Unit', unitId, '(order', currentOrder, ') submitted and Unit', prevUnit[0].id, '(order', prevUnit[0].order_index, ') is PASSED');
                
                // Invalidate cache to ensure fresh data
                await invalidateCache(`cache:/api/qualification/units/${nextUnitId}*`);
                await invalidateCache(`cache:/api/qualification/${courseId}*`);
                await invalidateCache(`cache:/api/student/${studentId}/qualification-courses*`);
              }
            }
          } else {
            console.log('[Qualification] Unit', unitId, '(order', currentOrder, ') submitted but Unit', prevUnit[0].id, '(order', prevUnit[0].order_index, ') is not PASSED (result:', prevSubmission[0]?.pass_fail_result || 'none', ') - NOT unlocking next unit');
          }
        } else {
          console.log('[Qualification] No previous unit found for Unit', unitId, '(order', currentOrder, ')');
        }
      }
    }
    
    // 4. Get tutors to notify based on student's assigned tutor
    const [studentInfo] = await connection.execute('SELECT name, assigned_tutor_id FROM users WHERE id = ?', [studentId]);
    
    let tutors = [];
    
    if (studentInfo.length > 0 && studentInfo[0].assigned_tutor_id) {
      // Student has an assigned tutor - notify only that tutor
      const [assignedTutor] = await connection.execute(
        `SELECT id FROM users WHERE id = ? AND role_id = 2`,
        [studentInfo[0].assigned_tutor_id]
      );
      tutors = assignedTutor;
      console.log(`[Qualification Submit] Student ${studentId} has assigned tutor ${studentInfo[0].assigned_tutor_id}`);
    } else {
      // No assigned tutor - notify all main tutors (tutors without parent_tutor_id)
      const [mainTutors] = await connection.execute(
        `SELECT id FROM users WHERE role_id = 2 AND (parent_tutor_id IS NULL OR parent_tutor_id = 0)`,
        []
      );
      tutors = mainTutors;
      console.log(`[Qualification Submit] Student ${studentId} has no assigned tutor, notifying ${tutors.length} main tutors`);
    }
    
    // Get unit and course info for notification
    const [unitInfo] = await connection.execute('SELECT title, course_id FROM units WHERE id = ?', [unitId]);
    const [courseInfo] = unitInfo.length > 0 ? await connection.execute('SELECT title FROM courses WHERE id = ?', [unitInfo[0].course_id]) : [[]];
    
    const studentName = studentInfo[0]?.name || 'Student';
    const unitTitle = unitInfo[0]?.title || 'Unit';
    const courseTitle = courseInfo[0]?.title || 'Course';
    const submissionTypeText = submission_type === 'assignment' ? 'Assignment' : 'Presentation';
    
    const { createNotification } = require('../utils/notificationHelper');
    
    for (const tutor of tutors) {
      // Insert into qual_tutor_notifications (existing system)
      await connection.execute(
        `INSERT INTO qual_tutor_notifications (tutor_id, submission_id, unit_id, student_id, notification_type)
         VALUES (?, ?, ?, ?, 'new_submission')`,
        [tutor.id, submissionId, unitId, studentId]
      );
      
      // Also create notification in main notifications table
      await createNotification({
        userId: tutor.id,
        type: 'assignment_submitted',
        title: `${submissionTypeText} Submitted`,
        message: `${studentName} submitted a ${submission_type} for "${unitTitle}" in ${courseTitle}`,
        relatedUserId: studentId,
        relatedCourseId: unitInfo[0]?.course_id || null,
        relatedSubmissionId: submissionId,
        req: req
      });
    }
    
    await connection.commit();

    // Log student submission to system_logs for Event Logs / group-by-student report
    const courseIdForLog = unitInfo[0]?.course_id || null;
    setImmediate(async () => {
      try {
        await logSystemEvent({
          userId: studentId,
          role: 'student',
          action: 'student_assignment_submitted',
          description: `${studentName} submitted ${submissionTypeText} for "${unitTitle}" in ${courseTitle}`,
          courseId: courseIdForLog,
          service: 'qualification',
          req,
          extraBody: {
            course_name: courseTitle,
            unit_name: unitTitle,
            unit_id: parseInt(unitId, 10),
            submission_type,
            submission_id: submissionId,
            is_resubmission: is_resubmission === 'true' || is_resubmission === true,
            file_names: (files || []).map(f => f.originalname)
          }
        });
      } catch (e) {
        logger.error({ err: e }, '[Qualification] Failed to log student submission');
      }
    });
    
    // Invalidate cache after commit to ensure fresh data (cache keys are prefixed with 'cache:')
    if (currentUnit.length > 0) {
      const courseIdForCache = currentUnit[0].course_id;
      await invalidateCache(`cache:/api/qualification/units/${unitId}*`);
      await invalidateCache(`cache:/api/qualification/${courseIdForCache}*`);
      await invalidateCache(`cache:/api/student/${studentId}/qualification-courses*`);
      console.log('[Qualification] Cache invalidated for unit', unitId, 'and course', courseIdForCache);
    }
    
    res.json({
      success: true,
      message: `${submission_type} submitted successfully`,
      submissionId: submissionId
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('[Qualification] Error submitting:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting file',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// =====================================================
// TUTOR GRADING
// =====================================================

// GET UNIT FOR A SUBMISSION (avoids N+1 when deep-linking)
router.get('/submissions/:submissionId/unit', auth, async (req, res) => {
  try {
    const { submissionId } = req.params;
    const studentId = req.user.id;

    const [rows] = await pool.execute(
      `SELECT s.unit_id, u.title as unit_title, u.order_index, u.course_id
       FROM qual_submissions s
       JOIN units u ON s.unit_id = u.id
       WHERE s.id = ? AND s.student_id = ?`,
      [submissionId, studentId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found or access denied'
      });
    }

    res.json({
      success: true,
      unitId: rows[0].unit_id,
      unit: rows[0]
    });
  } catch (error) {
    console.error('[Qualification] Error fetching unit for submission:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching unit'
    });
  }
});

// GET STUDENT'S SUBMISSIONS FOR A UNIT
router.get('/units/:unitId/submissions', auth, async (req, res) => {
  try {
    const { unitId } = req.params;
    const studentId = req.query.studentId || req.user.id;
    
    console.log('[Qualification] Getting submissions for unit:', unitId, 'student:', studentId);
    
    const [submissions] = await pool.execute(
      `SELECT * FROM qual_submissions 
       WHERE unit_id = ? AND student_id = ?
       ORDER BY submitted_at DESC`,
      [unitId, studentId]
    );
    
    // Fetch files for each submission from assignment_submission_files table
    for (let submission of submissions) {
      const [files] = await pool.execute(
        `SELECT * FROM assignment_submission_files 
         WHERE submission_id = ?
         ORDER BY uploaded_at ASC`,
        [submission.id]
      );
      submission.files = files; // Attach files to submission object
    }
    
    // Organize by submission type - return latest and all history
    const assignmentSubmissions = submissions.filter(s => s.submission_type === 'assignment');
    const presentationSubmissions = submissions.filter(s => s.submission_type === 'presentation');
    
    const result = {
      assignment: assignmentSubmissions.length > 0 ? assignmentSubmissions[0] : null, // Latest
      presentation: presentationSubmissions.length > 0 ? presentationSubmissions[0] : null, // Latest
      // Include full history for displaying previous feedback
      assignment_history: assignmentSubmissions,
      presentation_history: presentationSubmissions
    };
    
    console.log('[Qualification] Returning submissions with files:', {
      assignment_files: result.assignment?.files?.length || 0,
      presentation_files: result.presentation?.files?.length || 0
    });
    
    res.json({
      success: true,
      submissions: result
    });
    
  } catch (error) {
    console.error('[Qualification] Error fetching student submissions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching submissions'
    });
  }
});

// GET ALL SUBMISSIONS FOR TUTOR DASHBOARD (both pending and graded)
router.get('/submissions/all', auth, async (req, res) => {
  try {
    const tutorId = req.user.id;
    
    console.log('[Qualification] Fetching all submissions for tutor:', tutorId);
    
    // Check if tutor has sub-tutors (main tutor) or is a sub-tutor
    const [tutorInfo] = await pool.execute(
      `SELECT parent_tutor_id FROM users WHERE id = ? AND role_id = 2`,
      [tutorId]
    );
    
    let studentFilter = '';
    let params = [];
    
    if (tutorInfo.length > 0 && tutorInfo[0].parent_tutor_id) {
      // Sub-tutor: only see submissions from their assigned students
      studentFilter = 'AND st.assigned_tutor_id = ?';
      params = [tutorId];
      console.log('[Qualification] Sub-tutor - filtering for assigned students only');
    } else if (tutorInfo.length > 0) {
      // Main tutor: only see submissions from their OWN assigned students (not sub-tutors' students)
      studentFilter = 'AND st.assigned_tutor_id = ?';
      params = [tutorId];
      console.log('[Qualification] Main tutor - filtering for own assigned students only');
    } else {
      // No filtering if not a tutor (shouldn't happen due to auth)
      console.log('[Qualification] No tutor filtering applied');
    }
    
    const [submissions] = await pool.execute(
      `SELECT 
        s.id as submission_id,
        s.submission_type,
        s.file_name,
        s.file_path,
        s.video_link,
        s.video_link_status,
        s.video_link_reject_reason,
        s.video_link_rejected_at,
        s.submitted_at,
        s.status,
        s.pass_fail_result,
        s.feedback,
        s.graded_at,
        s.graded_by,
        u.id as unit_id,
        u.title as unit_title,
        (SELECT COUNT(*) FROM units u2 WHERE u2.course_id = u.course_id AND u2.order_index < u.order_index) + 1 as unit_order,
        c.id as course_id,
        c.title as course_title,
        st.id as student_id,
        st.name as student_name,
        st.email as student_email,
        grader.name as graded_by_name
       FROM qual_submissions s
       JOIN units u ON s.unit_id = u.id
       JOIN courses c ON u.course_id = c.id
       JOIN users st ON s.student_id = st.id
       LEFT JOIN users grader ON s.graded_by = grader.id
       WHERE 1=1 ${studentFilter}
       ORDER BY 
         CASE WHEN s.status = 'submitted' THEN 0 ELSE 1 END,
         s.submitted_at DESC`,
      params
    );
    
    // Fetch files for each submission
    for (let submission of submissions) {
      const [files] = await pool.execute(
        `SELECT * FROM assignment_submission_files 
         WHERE submission_id = ?
         ORDER BY uploaded_at ASC`,
        [submission.submission_id]
      );
      submission.files = files; // Attach files to submission object
    }
    
    console.log('[Qualification] Found submissions:', submissions.length);
    if (submissions.length > 0) {
      // Log a sample submission
      const sample = submissions[0];
      console.log('[Qualification] Sample submission:', {
        submission_id: sample.submission_id,
        student_name: sample.student_name,
        status: sample.status,
        pass_fail_result: sample.pass_fail_result,
        graded_by: sample.graded_by,
        graded_at: sample.graded_at,
        graded_by_name: sample.graded_by_name,
        files_count: sample.files?.length || 0
      });
      
      // Also log any graded submissions to verify they have the correct data
      const gradedSubmissions = submissions.filter(s => s.status === 'graded' && s.graded_by);
      if (gradedSubmissions.length > 0) {
        console.log('[Qualification] Graded submissions count:', gradedSubmissions.length);
        const latestGraded = gradedSubmissions[0];
        console.log('[Qualification] Latest graded submission:', {
          submission_id: latestGraded.submission_id,
          graded_by: latestGraded.graded_by,
          graded_at: latestGraded.graded_at,
          graded_by_name: latestGraded.graded_by_name,
          pass_fail_result: latestGraded.pass_fail_result,
          files_count: latestGraded.files?.length || 0
        });
      }
    }
    
    res.json({
      success: true,
      submissions: submissions
    });
    
  } catch (error) {
    console.error('[Qualification] Error fetching all submissions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching submissions',
      error: error.message
    });
  }
});

// GET SUBMISSIONS FOR GRADING (pending only)
router.get('/submissions/pending', auth, async (req, res) => {
  try {
    const tutorId = req.user.id;
    
    const [submissions] = await pool.execute(
      `SELECT 
        s.*,
        u.title as unit_title,
        c.title as course_title,
        st.name as student_name,
        st.email as student_email
       FROM qual_submissions s
       JOIN units u ON s.unit_id = u.id
       JOIN courses c ON u.course_id = c.id
       JOIN users st ON s.student_id = st.id
       WHERE s.status = 'submitted'
       ORDER BY s.submitted_at ASC`
    );
    
    res.json({
      success: true,
      submissions: submissions
    });
    
  } catch (error) {
    console.error('[Qualification] Error fetching submissions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching submissions'
    });
  }
});

// GRADE SUBMISSION (CRITICAL: UNLOCK LOGIC)
router.post('/submissions/:submissionId/grade', auth, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { submissionId } = req.params;
    const {
      grading_type,
      numeric_grade,
      pass_fail_result,
      feedback
    } = req.body;
    
    const tutorId = req.user.id;
    
    console.log('[Qualification] Grading submission:', submissionId, 'Result:', pass_fail_result);
    
    // 1. Get submission details
    const [submission] = await connection.execute(
      `SELECT s.*, u.course_id, u.unlock_condition, u.is_optional
       FROM qual_submissions s
       JOIN units u ON s.unit_id = u.id
       WHERE s.id = ?`,
      [submissionId]
    );
    
    if (submission.length === 0) {
      throw new Error('Submission not found');
    }
    
    const sub = submission[0];
    
    // 2. Update submission with grade
    await connection.execute(
      `UPDATE qual_submissions 
       SET graded_by = ?,
           graded_at = NOW(),
           grading_type = ?,
           numeric_grade = ?,
           pass_fail_result = ?,
           feedback = ?,
           status = 'graded'
       WHERE id = ?`,
      [tutorId, grading_type, numeric_grade || null, pass_fail_result, feedback || null, submissionId]
    );
    
    // 3. Update progress
    const statusField = sub.submission_type === 'assignment' ? 'assignment_status' : 'presentation_status';
    const gradedAtField = sub.submission_type === 'assignment' ? 'assignment_graded_at' : 'presentation_graded_at';
    
    await connection.execute(
      `UPDATE qual_unit_progress 
       SET ${statusField} = ?,
           ${gradedAtField} = NOW()
       WHERE unit_id = ? AND student_id = ?`,
      [pass_fail_result, sub.unit_id, sub.student_id]
    );
    
    // 4. UNLOCK LOGIC: When assignment is PASSED, unlock next unit if all previous are PASSED
    // Rule: Unit N unlocks when Unit (N-1) is submitted AND all previous units (1 to N-2) have PASSED assignments
    // FALLBACK: Also check ALL passed assignments and unlock any eligible units (for bulk grading)
    if (pass_fail_result === 'pass') {
      console.log('[Qualification] Assignment PASSED - checking unlock logic');
      
      // Get current unit order
      const [currentUnit] = await connection.execute(
        `SELECT order_index FROM units WHERE id = ?`,
        [sub.unit_id]
      );
      
      if (currentUnit.length > 0 && sub.submission_type === 'assignment') {
        const currentOrder = currentUnit[0].order_index;
        
        // Find the minimum order_index (first unit) in this course
        const [minOrderResult] = await connection.execute(
          `SELECT MIN(order_index) as min_order FROM units WHERE course_id = ?`,
          [sub.course_id]
        );
        const minOrder = minOrderResult[0]?.min_order ?? 0;
        const isFirstUnit = currentOrder === minOrder;
        
        console.log('[Qualification] Grading unlock check - Current unit order:', currentOrder, 'Min order:', minOrder, 'Is first unit:', isFirstUnit);
        
        if (isFirstUnit) {
          // Unit 1 PASSED → Unlock Unit 3 (Unit 2 already unlocked when Unit 1 was submitted)
          // Find the second unit (order_index = minOrder + 1) and then the third unit
          const [secondUnit] = await connection.execute(
            `SELECT id, order_index FROM units 
             WHERE course_id = ? AND order_index > ?
             ORDER BY order_index ASC
             LIMIT 1`,
            [sub.course_id, currentOrder]
          );
          
          if (secondUnit.length > 0) {
            // Find the third unit (next after second unit)
            const [thirdUnit] = await connection.execute(
              `SELECT id, order_index FROM units 
               WHERE course_id = ? AND order_index > ?
               ORDER BY order_index ASC
               LIMIT 1`,
              [sub.course_id, secondUnit[0].order_index]
            );
            
            if (thirdUnit.length > 0) {
              await connection.execute(
                `INSERT INTO qual_unit_progress (student_id, course_id, unit_id, is_unlocked, unlocked_at, unlock_method)
                 VALUES (?, ?, ?, 1, NOW(), 'assignment_pass')
                 ON DUPLICATE KEY UPDATE 
                   is_unlocked = 1,
                   unlocked_at = NOW(),
                   unlock_method = 'assignment_pass'`,
                [sub.student_id, sub.course_id, thirdUnit[0].id]
              );
              console.log('[Qualification] Unit', thirdUnit[0].id, '(order', thirdUnit[0].order_index, ') unlocked because Unit 1 (order', currentOrder, ') PASSED');
            }
          }
        } else {
          // For Unit N (N > 1): Check if all previous units (1 to N-1) have PASSED assignments
          // Get all previous units
          const [previousUnits] = await connection.execute(
            `SELECT u.id, u.order_index 
             FROM units u
             WHERE u.course_id = ? AND u.order_index < ?
             ORDER BY u.order_index ASC`,
            [sub.course_id, currentOrder]
          );
          
          // Check if all previous units have PASSED assignments (not REFER)
          let allPreviousPassed = true;
          for (const prevUnit of previousUnits) {
            const [prevSubmission] = await connection.execute(
              `SELECT pass_fail_result FROM qual_submissions 
               WHERE unit_id = ? AND student_id = ? AND submission_type = 'assignment'
               ORDER BY submitted_at DESC LIMIT 1`,
              [prevUnit.id, sub.student_id]
            );
            
            if (prevSubmission.length === 0 || prevSubmission[0].pass_fail_result !== 'pass') {
              allPreviousPassed = false;
              console.log('[Qualification] Unit', prevUnit.id, '(order', prevUnit.order_index, ') does not have PASSED assignment - result:', prevSubmission[0]?.pass_fail_result || 'none');
              break;
            }
          }
          
          if (allPreviousPassed) {
            // All previous units passed AND current unit passed -> unlock next unit
            const [nextUnit] = await connection.execute(
              `SELECT id FROM units WHERE course_id = ? AND order_index = ?`,
              [sub.course_id, currentOrder + 1]
            );
            
            if (nextUnit.length > 0) {
              await connection.execute(
                `INSERT INTO qual_unit_progress (student_id, course_id, unit_id, is_unlocked, unlocked_at, unlock_method)
                 VALUES (?, ?, ?, 1, NOW(), 'assignment_pass')
                 ON DUPLICATE KEY UPDATE 
                   is_unlocked = 1,
                   unlocked_at = NOW(),
                   unlock_method = 'assignment_pass'`,
                [sub.student_id, sub.course_id, nextUnit[0].id]
              );
              console.log('[Qualification] Unit', nextUnit[0].id, 'unlocked - all previous units (1 to', currentOrder, ') PASSED');
            }
          } else {
            console.log('[Qualification] Unit', sub.unit_id, 'PASSED but not all previous units are PASSED - NOT unlocking next unit');
          }
        }
      }
      
      // Mark current unit as completed if passed
      await connection.execute(
        `UPDATE qual_unit_progress 
         SET is_completed = 1,
             completed_at = NOW(),
             completion_method = '${sub.submission_type}'
         WHERE unit_id = ? AND student_id = ?`,
        [sub.unit_id, sub.student_id]
      );
      
      // FALLBACK: Check ALL units in sequence and unlock any that should be unlocked
      // This handles cases where multiple assignments are graded at once
      console.log('[Qualification] Running fallback unlock check for all units');
      const [allUnits] = await connection.execute(
        `SELECT id, order_index FROM units 
         WHERE course_id = ? 
         ORDER BY order_index ASC`,
        [sub.course_id]
      );
      
      for (let i = 0; i < allUnits.length; i++) {
        const unit = allUnits[i];
        const nextUnit = allUnits[i + 1];
        
        if (!nextUnit) continue; // No next unit to unlock
        
        // Check if current unit has a PASSED assignment
        const [unitSubmission] = await connection.execute(
          `SELECT pass_fail_result FROM qual_submissions 
           WHERE unit_id = ? AND student_id = ? AND submission_type = 'assignment'
           ORDER BY submitted_at DESC LIMIT 1`,
          [unit.id, sub.student_id]
        );
        
        if (unitSubmission.length > 0 && unitSubmission[0].pass_fail_result === 'pass') {
          // Check if all previous units are also passed
          let allPreviousPassed = true;
          for (let j = 0; j < i; j++) {
            const prevUnit = allUnits[j];
            const [prevSubmission] = await connection.execute(
              `SELECT pass_fail_result FROM qual_submissions 
               WHERE unit_id = ? AND student_id = ? AND submission_type = 'assignment'
               ORDER BY submitted_at DESC LIMIT 1`,
              [prevUnit.id, sub.student_id]
            );
            
            if (prevSubmission.length === 0 || prevSubmission[0].pass_fail_result !== 'pass') {
              allPreviousPassed = false;
              break;
            }
          }
          
          if (allPreviousPassed) {
            // Unlock next unit
            await connection.execute(
              `INSERT INTO qual_unit_progress (student_id, course_id, unit_id, is_unlocked, unlocked_at, unlock_method)
               VALUES (?, ?, ?, 1, NOW(), 'assignment_pass_fallback')
               ON DUPLICATE KEY UPDATE 
                 is_unlocked = 1,
                 unlocked_at = NOW(),
                 unlock_method = 'assignment_pass_fallback'`,
              [sub.student_id, sub.course_id, nextUnit.id]
            );
            console.log('[Qualification] Fallback: Unit', nextUnit.id, '(order', nextUnit.order_index, ') unlocked');
          }
        }
      }
    } else if (pass_fail_result === 'refer') {
      // If assignment is REFER, do NOT unlock next unit (even if submitted)
      console.log('[Qualification] Assignment REFER - NOT unlocking next unit');
    }
    
    await connection.commit();
    
    // Fetch the updated submission with grader name
    const [updatedSubmission] = await connection.execute(
      `SELECT 
        s.*,
        grader.name as graded_by_name
       FROM qual_submissions s
       LEFT JOIN users grader ON s.graded_by = grader.id
       WHERE s.id = ?`,
      [submissionId]
    );
    
    const gradedSubmission = updatedSubmission[0];
    
    // Log grading
    setImmediate(async () => {
      await logSystemEvent({
        userId: tutorId,
        action: 'qualification_submission_graded',
        description: `Submission ${submissionId} graded: student_id=${sub.student_id}, unit_id=${sub.unit_id}, result=${pass_fail_result}, grade=${numeric_grade || 'N/A'}`,
        req
      });

      // Log detailed assessor activity
      await AssessorActivityLogger.logGrading({
        assessorId: tutorId,
        studentId: sub.student_id,
        submissionId: parseInt(submissionId),
        unitId: sub.unit_id,
        courseId: sub.course_id,
        gradeResult: pass_fail_result,
        feedbackText: feedback,
        numericScore: numeric_grade,
        req
      });
    });

    // Notify student in bell icon: assignment graded (Pass or Refer)
    setImmediate(async () => {
      try {
        const { createNotification } = require('../utils/notificationHelper');
        const resultText = pass_fail_result === 'pass' ? 'Pass' : 'Refer';
        const resultEmoji = pass_fail_result === 'pass' ? '✅' : '⚠️';
        await createNotification({
          userId: sub.student_id,
          type: 'assignment_graded',
          title: 'Assignment Graded',
          message: `Your assignment has been graded. Result: ${resultEmoji} ${resultText}.${pass_fail_result === 'refer' ? ' Please check feedback and resubmit if needed.' : ''}`,
          relatedUserId: tutorId,
          relatedCourseId: sub.course_id || null,
          relatedSubmissionId: parseInt(submissionId, 10) || null,
          req
        });
      } catch (err) {
        console.error('[Qualification] Failed to create student notification for graded assignment:', err);
      }
    });

    console.log('[Qualification] Submission graded successfully:', {
      submission_id: submissionId,
      graded_by: gradedSubmission?.graded_by,
      graded_at: gradedSubmission?.graded_at,
      graded_by_name: gradedSubmission?.graded_by_name,
      pass_fail_result: pass_fail_result
    });
    
    await invalidateCache('cache:/api/qual/progress*');
    // Invalidate student dashboard qualification progress so progress bar updates
    await invalidateCache(`cache:/api/student/${sub.student_id}/qualification-courses*`);
    res.json({
      success: true,
      message: 'Submission graded successfully',
      unlocked: pass_fail_result === 'pass'
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('[Qualification] Error grading submission:', error);
    res.status(500).json({
      success: false,
      message: 'Error grading submission',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// UPDATE OR DELETE FEEDBACK (NO NOTIFICATIONS)
router.put('/submissions/:submissionId/feedback', auth, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { submissionId } = req.params;
    const { feedback, action } = req.body; // action: 'update' or 'delete'
    const tutorId = req.user.id;
    
    console.log('[Qualification] Updating feedback for submission:', submissionId, 'Action:', action);
    
    // Verify submission exists and is graded
    const [submission] = await connection.execute(
      `SELECT s.*, u.course_id
       FROM qual_submissions s
       JOIN units u ON s.unit_id = u.id
       WHERE s.id = ? AND s.status = 'graded'`,
      [submissionId]
    );
    
    if (submission.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found or not graded'
      });
    }
    
    const sub = submission[0];
    
    // Verify tutor has permission (must be the grader or admin)
    if (sub.graded_by !== tutorId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this feedback'
      });
    }
    
    // Update or delete feedback
    if (action === 'delete') {
      await connection.execute(
        `UPDATE qual_submissions 
         SET feedback = NULL
         WHERE id = ?`,
        [submissionId]
      );
    } else {
      // Validate feedback is not empty for update
      if (!feedback || feedback.trim() === '' || feedback.replace(/<[^>]*>/g, '').trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Feedback cannot be empty'
        });
      }
      
      await connection.execute(
        `UPDATE qual_submissions 
         SET feedback = ?
         WHERE id = ?`,
        [feedback, submissionId]
      );
    }
    
    // Invalidate cache so student sees updated feedback immediately
    await invalidateCache(`cache:/api/student/${sub.student_id}/qualification-courses*`);
    await invalidateCache('cache:/api/qual/progress*');
    
    res.json({
      success: true,
      message: action === 'delete' ? 'Feedback deleted successfully' : 'Feedback updated successfully'
    });
    
  } catch (error) {
    console.error('[Qualification] Error updating feedback:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating feedback',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// =====================================================
// STUDENT PROGRESS AND ENROLLMENT
// =====================================================

// ENROLL STUDENT IN QUALIFICATION COURSE
router.post('/:courseId/enroll/:studentId', auth, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { courseId, studentId } = req.params;
    const assignedBy = req.user.id;
    
    console.log('[Qualification] Enrolling student', studentId, 'in course', courseId);
    
    // 1. Create course assignment
    await connection.execute(
      `INSERT INTO course_assignments (course_id, student_id, assigned_by, status, created_at)
       VALUES (?, ?, ?, 'active', NOW())`,
      [courseId, studentId, assignedBy]
    );
    
    // 2. Get all units for this course
    const [units] = await connection.execute(
      `SELECT id, order_index, is_optional FROM units WHERE course_id = ? ORDER BY order_index`,
      [courseId]
    );
    
    // 3. Create progress records and unlock first unit
    for (let i = 0; i < units.length; i++) {
      const unit = units[i];
      const isFirst = i === 0;
      
      await connection.execute(
        `INSERT INTO qual_unit_progress (student_id, course_id, unit_id, is_unlocked, unlocked_at, unlock_method)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          studentId,
          courseId,
          unit.id,
          isFirst ? 1 : 0,
          isFirst ? new Date() : null,
          isFirst ? 'initial' : null
        ]
      );
    }
    
    await connection.commit();
    
    await invalidateCache('cache:/api/qual/progress*');
    res.json({
      success: true,
      message: 'Student enrolled successfully',
      unlockedUnits: 1
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('[Qualification] Error enrolling student:', error);
    res.status(500).json({
      success: false,
      message: 'Error enrolling student',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// GET STUDENT PROGRESS
router.get('/:courseId/progress/:studentId', cacheMiddleware(60), async (req, res) => {
  try {
    const { courseId, studentId } = req.params;
    
    const [progress] = await pool.execute(
      `SELECT 
        qup.*,
        u.title as unit_title,
        u.order_index
       FROM qual_unit_progress qup
       JOIN units u ON qup.unit_id = u.id
       WHERE qup.course_id = ? AND qup.student_id = ?
       ORDER BY u.order_index`,
      [courseId, studentId]
    );
    
    res.json({
      success: true,
      progress: progress
    });
    
  } catch (error) {
    console.error('[Qualification] Error fetching progress:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching student progress'
    });
  }
});

// =====================================================
// GIFT FORMAT PARSER (for qualification quizzes)
// =====================================================
function parseGiftFormat(giftText) {
  if (!giftText || typeof giftText !== 'string') {
    return [];
  }

  const questions = [];
  // Split by question markers (::Question Title::)
  const questionBlocks = giftText.split(/::[\s\S]*?::/g).filter((block) => block.trim());

  for (const block of questionBlocks) {
    const lines = block
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l);
    if (lines.length === 0) continue;

    // Extract question text (first line, remove { if present)
    const questionText = lines[0].replace(/\{$/, '').trim();
    const options = [];
    let correctAnswer = 'A';

    // Parse options (lines starting with = or ~)
    for (const line of lines.slice(1)) {
      if (line.startsWith('=')) {
        // Correct answer
        correctAnswer = String.fromCharCode(65 + options.length); // A, B, C, D...
        options.push(line.substring(1).replace(/[{}]/g, '').trim());
      } else if (line.startsWith('~')) {
        // Wrong answer
        options.push(line.substring(1).replace(/[{}]/g, '').trim());
      }
    }

    // Ensure minimum 2 options
    while (options.length < 2) {
      options.push('(No option)');
    }

    // Only add if we have a valid question and at least 2 options
    if (questionText && options.length >= 2) {
      questions.push({
        question: questionText,
        options: options.slice(0, 10), // Limit to 10 options max
        correctAnswer
      });
    }
  }

  return questions;
}

// =====================================================
// QUIZ ATTEMPT
// =====================================================

// SUBMIT QUIZ ATTEMPT
router.post('/units/:unitId/quiz/attempt', auth, async (req, res) => {
  try {
    const { unitId } = req.params;
    const { quiz_id, student_id, answers } = req.body;
    const userId = req.user.id;
    
    // Verify student_id matches authenticated user
    if (student_id && student_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Student ID does not match authenticated user'
      });
    }
    
    console.log('[Qualification] Quiz attempt for quiz:', quiz_id, 'student:', userId);
    
    // Get quiz and questions
    const [quiz] = await pool.execute(
      `SELECT * FROM qual_unit_quizzes WHERE id = ?`,
      [quiz_id]
    );
    
    if (quiz.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }
    
    const [questions] = await pool.execute(
      `SELECT * FROM qual_quiz_questions WHERE quiz_id = ? ORDER BY order_index`,
      [quiz_id]
    );
    
    // Calculate score
    let correct = 0;
    const total = questions.length;
    const answerMap = {};
    
    for (const question of questions) {
      const userAnswer = answers.find((a) => a.question_id === question.id);
      if (userAnswer) {
        answerMap[question.id] = userAnswer.answer;
        // Compare user answer with correct answer
        if (userAnswer.answer === question.correct_answer) {
          correct++;
        }
      }
    }
    
    const score = total > 0 ? Math.round((correct / total) * 100) : 0;
    const passingScore = quiz[0].passing_score || 70;
    const passed = score >= passingScore;
    
    // Store quiz attempt (optional - you can create a qual_quiz_attempts table if needed)
    // For now, we'll just return the result
    
    console.log('[Qualification] Quiz result - Score:', score, 'Correct:', correct, '/', total, 'Passed:', passed);
    
    res.json({
      success: true,
      result: {
        score,
        correct,
        total,
        passed,
        passing_score: passingScore,
        answers: answerMap
      }
    });
    
  } catch (error) {
    console.error('[Qualification] Error submitting quiz:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting quiz',
      error: error.message
    });
  }
});

// =====================================================
// RULE LEVEL 3 MANAGEMENT
// =====================================================

// UPDATE RULE LEVEL 3 SETTINGS
router.put('/:courseId/rule-level-3', auth, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { courseId } = req.params;
    const { enabled, required_units, selectable_units } = req.body;
    const userId = req.user.id;
    
    // Verify course exists and user has permission
    const [course] = await connection.execute(
      `SELECT c.* FROM courses c
       WHERE c.id = ? AND c.course_type = 'qualification'`,
      [courseId]
    );
    
    if (course.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Qualification course not found'
      });
    }
    
    // Check if qual_course_content exists, if not create it
    const [existing] = await connection.execute(
      `SELECT * FROM qual_course_content WHERE course_id = ?`,
      [courseId]
    );
    
    if (existing.length === 0) {
      await connection.execute(
        `INSERT INTO qual_course_content (course_id, rule_level_3_enabled, rule_level_3_required_units, rule_level_3_selectable_units)
         VALUES (?, ?, ?, ?)`,
        [courseId, enabled ? 1 : 0, required_units || 0, selectable_units || 0]
      );
    } else {
      await connection.execute(
        `UPDATE qual_course_content 
         SET rule_level_3_enabled = ?,
             rule_level_3_required_units = ?,
             rule_level_3_selectable_units = ?
         WHERE course_id = ?`,
        [enabled ? 1 : 0, required_units || 0, selectable_units || 0, courseId]
      );
    }
    
    await invalidateCache(`cache:/api/qualification/${courseId}*`);
    
    await logSystemEvent({
      userId: userId,
      role: req.user.role,
      action: 'qualification_rule_level_3_updated',
      description: `Updated Rule Level 3 settings for course ${courseId}: enabled=${enabled}, required=${required_units}, selectable=${selectable_units}`
    });
    
    res.json({
      success: true,
      message: 'Rule Level 3 settings updated successfully'
    });
    
  } catch (error) {
    console.error('[Qualification] Error updating Rule Level 3:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating Rule Level 3 settings',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// GET STUDENT'S SELECTED UNITS FOR RULE LEVEL 3
router.get('/:courseId/selected-units', auth, async (req, res) => {
  try {
    const { courseId } = req.params;
    const studentId = req.user.id;
    
    const [selected] = await pool.execute(
      `SELECT unit_id FROM qual_student_selected_units
       WHERE course_id = ? AND student_id = ?`,
      [courseId, studentId]
    );
    
    res.json({
      success: true,
      selected_units: selected.map(row => row.unit_id)
    });
    
  } catch (error) {
    console.error('[Qualification] Error fetching selected units:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching selected units',
      error: error.message
    });
  }
});

// SELECT UNITS FOR RULE LEVEL 3
router.post('/:courseId/select-units', auth, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { courseId } = req.params;
    const { unit_ids } = req.body;
    const studentId = req.user.id;
    
    if (!Array.isArray(unit_ids) || unit_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please select at least one unit'
      });
    }
    
    // Check selectable_units limit from course settings
    const [courseSettings] = await connection.execute(
      `SELECT rule_level_3_selectable_units FROM qual_course_content WHERE course_id = ?`,
      [courseId]
    );
    const maxSelectable = courseSettings[0]?.rule_level_3_selectable_units || 0;
    if (maxSelectable > 0 && unit_ids.length !== maxSelectable) {
      return res.status(400).json({
        success: false,
        message: `You must select exactly ${maxSelectable} unit${maxSelectable !== 1 ? 's' : ''}`
      });
    }
    
    // Verify units belong to this course and have Rule Level 3 enabled
    const placeholders = unit_ids.map(() => '?').join(',');
    const [units] = await connection.execute(
      `SELECT id, rule_level_3_enabled FROM units 
       WHERE id IN (${placeholders}) AND course_id = ?`,
      [...unit_ids, courseId]
    );
    
    if (units.length !== unit_ids.length) {
      return res.status(400).json({
        success: false,
        message: 'Some selected units are invalid or do not belong to this course'
      });
    }
    
    // Verify all selected units have Rule Level 3 enabled
    const invalidUnits = units.filter(u => !u.rule_level_3_enabled);
    if (invalidUnits.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Some selected units do not have Rule Level 3 enabled'
      });
    }
    
    // Delete existing selections for this student and course
    await connection.execute(
      `DELETE FROM qual_student_selected_units
       WHERE course_id = ? AND student_id = ?`,
      [courseId, studentId]
    );
    
    // Insert new selections
    for (const unitId of unit_ids) {
      await connection.execute(
        `INSERT INTO qual_student_selected_units (course_id, student_id, unit_id)
         VALUES (?, ?, ?)`,
        [courseId, studentId, unitId]
      );
    }
    
    await connection.commit();
    
    await invalidateCache(`cache:/api/qualification/${courseId}*`);
    
    res.json({
      success: true,
      message: 'Units selected successfully',
      selected_units: unit_ids
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('[Qualification] Error selecting units:', error);
    res.status(500).json({
      success: false,
      message: 'Error selecting units',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// =====================================================
// FILE REJECTION & VIEWING MANAGEMENT
// =====================================================

// Reject a specific file
router.post('/files/:fileId/reject', auth, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { fileId } = req.params;
    const { feedback } = req.body;
    const tutorId = req.user.id;

    console.log(`[Qualification] Rejecting file ${fileId} by tutor ${tutorId}`);

    // Get file and submission details with course name and IDs
    const [files] = await connection.execute(
      `SELECT asf.*, s.student_id, s.unit_id, s.id as submission_id,
              u.name as student_name, 
              un.title as unit_title,
              c.title as course_title,
              c.id as course_id
       FROM assignment_submission_files asf
       JOIN qual_submissions s ON asf.submission_id = s.id
       JOIN users u ON s.student_id = u.id
       JOIN units un ON s.unit_id = un.id
       JOIN courses c ON un.course_id = c.id
       WHERE asf.id = ?`,
      [fileId]
    );

    if (files.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    const file = files[0];

    // Update file status to rejected
    await connection.execute(
      `UPDATE assignment_submission_files 
       SET status = 'resubmit_requested', resubmit_feedback = ?, is_new = 0
       WHERE id = ?`,
      [feedback, fileId]
    );

    const fileName = file.file_name;
    const unitTitle = file.unit_title;
    const notificationMessage =
      `Your assignment file "${fileName}" for "${unitTitle}" has been rejected. ` +
      `Please log in to view the detailed feedback and resubmit your work.`;

    // Create notification for student with concise summary
    try {
      // Check if related_course_id and related_submission_id columns exist
      let hasRelatedCourseId = false;
      let hasRelatedSubmissionId = false;
      try {
        const [columns] = await connection.execute(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = DATABASE() 
           AND TABLE_NAME = 'notifications' 
           AND COLUMN_NAME IN ('related_course_id', 'related_submission_id')`
        );
        hasRelatedCourseId = columns.some(col => col.COLUMN_NAME === 'related_course_id');
        hasRelatedSubmissionId = columns.some(col => col.COLUMN_NAME === 'related_submission_id');
      } catch (err) {
        // Ignore - columns might not exist
      }
      
      // Build INSERT query with available columns
      if (hasRelatedCourseId && hasRelatedSubmissionId) {
        await connection.execute(
          `INSERT INTO notifications (
            user_id, type, title, message, related_course_id, related_submission_id, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [
            file.student_id,
            'file_rejected',
            '🔴 File Rejected - Resubmission Required',
            notificationMessage,
            file.course_id,
            file.submission_id
          ]
        );
      } else {
        // Fallback without related IDs
        await connection.execute(
          `INSERT INTO notifications (
            user_id, type, title, message, created_at
          ) VALUES (?, ?, ?, ?, NOW())`,
          [
            file.student_id,
            'file_rejected',
            '🔴 File Rejected - Resubmission Required',
            notificationMessage
          ]
        );
      }
      console.log(`[Qualification] ✓ Database notification created for student ${file.student_id} with course_id: ${file.course_id}, submission_id: ${file.submission_id}`);
    } catch (notifError) {
      console.error('[Qualification] Error creating notification (non-critical):', notifError.message);
      // Continue even if notification fails
    }

    // Emit real-time notification via socket
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${file.student_id}`).emit('new_notification', {
        type: 'file_rejected',  // Specific type for red styling
        title: '🔴 File Rejected - Resubmission Required',
        message: notificationMessage,
        courseTitle: file.course_title,
        unitTitle: file.unit_title,
        fileName: file.file_name,
        feedback: feedback,
        created_at: new Date()
      });
      console.log(`[Qualification] ✓ Real-time notification sent to student ${file.student_id} via Socket.io`);
    }

    console.log(`[Qualification] File ${fileId} rejected successfully, student ${file.student_id} notified`);
    
    // Invalidate cache
    invalidateCache(QUALIFICATION_CACHE_KEY);

    res.json({
      success: true,
      message: 'File rejected successfully. Student has been notified.'
    });

  } catch (error) {
    console.error('[Qualification] Error rejecting file:', error);
    res.status(500).json({
      success: false,
      message: 'Error rejecting file',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// Mark file as viewed (remove NEW badge)
router.post('/files/:fileId/mark-viewed', auth, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { fileId } = req.params;
    const tutorId = req.user.id;

    console.log(`[Qualification] Marking file ${fileId} as viewed by tutor ${tutorId}`);

    // Get file details before updating
    const [fileDetails] = await connection.execute(
      `SELECT asf.*, qs.student_id, qs.unit_id, u.course_id, qs.id as submission_id
       FROM assignment_submission_files asf
       JOIN qual_submissions qs ON asf.submission_id = qs.id
       JOIN units u ON qs.unit_id = u.id
       WHERE asf.id = ?`,
      [fileId]
    );

    if (fileDetails.length === 0) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    const file = fileDetails[0];

    // Update file to mark as viewed
    await connection.execute(
      `UPDATE assignment_submission_files 
       SET is_new = 0 
       WHERE id = ?`,
      [fileId]
    );

    console.log(`[Qualification] File ${fileId} marked as viewed`);

    // Log the activity
    await AssessorActivityLogger.logFileView({
      assessorId: tutorId,
      studentId: file.student_id,
      submissionId: file.submission_id,
      fileId: parseInt(fileId),
      fileName: file.file_name,
      fileType: file.file_type,
      fileSize: file.file_size,
      unitId: file.unit_id,
      courseId: file.course_id,
      req
    });
    
    // Invalidate cache
    invalidateCache(QUALIFICATION_CACHE_KEY);

    res.json({
      success: true,
      message: 'File marked as viewed'
    });

  } catch (error) {
    console.error('[Qualification] Error marking file as viewed:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking file as viewed',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// Mark file as downloaded (log assessor activity)
router.post('/files/:fileId/mark-downloaded', auth, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { fileId } = req.params;
    const tutorId = req.user.id;

    const [fileDetails] = await connection.execute(
      `SELECT asf.*, qs.student_id, qs.unit_id, u.course_id, qs.id as submission_id
       FROM assignment_submission_files asf
       JOIN qual_submissions qs ON asf.submission_id = qs.id
       JOIN units u ON qs.unit_id = u.id
       WHERE asf.id = ?`,
      [fileId]
    );

    if (fileDetails.length === 0) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    const file = fileDetails[0];

    await AssessorActivityLogger.logFileDownload({
      assessorId: tutorId,
      studentId: file.student_id,
      submissionId: file.submission_id,
      fileId: parseInt(fileId),
      fileName: file.file_name,
      fileType: file.file_type,
      fileSize: file.file_size,
      unitId: file.unit_id,
      courseId: file.course_id,
      req
    });

    res.json({ success: true, message: 'File download logged' });
  } catch (error) {
    console.error('[Qualification] Error marking file as downloaded:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging file download',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// Mark file as closed (log assessor activity with duration)
router.post('/files/:fileId/mark-closed', auth, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { fileId } = req.params;
    const { opened_at: openedAt } = req.body || {};
    const tutorId = req.user.id;

    if (!openedAt) {
      return res.status(400).json({ success: false, message: 'opened_at is required' });
    }

    const [fileDetails] = await connection.execute(
      `SELECT asf.*, qs.student_id, qs.unit_id, u.course_id, qs.id as submission_id
       FROM assignment_submission_files asf
       JOIN qual_submissions qs ON asf.submission_id = qs.id
       JOIN units u ON qs.unit_id = u.id
       WHERE asf.id = ?`,
      [fileId]
    );

    if (fileDetails.length === 0) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    const file = fileDetails[0];
    const closedAt = new Date();

    await AssessorActivityLogger.logFileClosed({
      assessorId: tutorId,
      studentId: file.student_id,
      submissionId: file.submission_id,
      fileId: parseInt(fileId),
      fileName: file.file_name,
      fileType: file.file_type,
      fileSize: file.file_size,
      unitId: file.unit_id,
      courseId: file.course_id,
      openedAt,
      closedAt,
      req
    });

    res.json({ success: true, message: 'File closed logged' });
  } catch (error) {
    console.error('[Qualification] Error marking file as closed:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging file close',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// Resubmit a rejected file (student replaces the file)
router.post('/files/:fileId/resubmit', auth, upload.single('file'), async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { fileId } = req.params;
    const studentId = req.user.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No file provided'
      });
    }

    console.log(`[Qualification] Student ${studentId} resubmitting file ${fileId}`);

    // Get the existing file record and verify ownership
    const [existingFiles] = await connection.execute(
      `SELECT asf.*, s.unit_id, u.title as unit_title
       FROM assignment_submission_files asf
       JOIN qual_submissions s ON asf.submission_id = s.id
       JOIN units u ON s.unit_id = u.id
       WHERE asf.id = ? AND s.student_id = ?`,
      [fileId, studentId]
    );

    if (existingFiles.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'File not found or you do not have permission to resubmit this file'
      });
    }

    const existingFile = existingFiles[0];

    // Verify the file was actually rejected
    if (existingFile.status !== 'resubmit_requested') {
      return res.status(400).json({
        success: false,
        message: 'This file has not been rejected and does not require resubmission'
      });
    }

    console.log(`[Qualification] Uploading replacement file to Cloudinary...`);

    // Upload the new file to Cloudinary
    let cloudinaryResult;
    try {
      cloudinaryResult = await uploadToCloudinary(
        file.buffer,
        file.originalname,
        `lms/qualification/submissions/unit-${existingFile.unit_id}/student-${studentId}`
      );
    } catch (uploadError) {
      console.error('[Qualification] Cloudinary upload failed:', uploadError);
      return res.status(400).json({
        success: false,
        message: uploadError.message || 'File upload failed',
        suggestion: uploadError.message.includes('10MB') 
          ? 'Please compress your file or upload it to Google Drive and share the link in the "Large Files" section.'
          : undefined
      });
    }

    // Insert a new file record (keep the old rejected file for history)
    const [insertResult] = await connection.execute(
      `INSERT INTO assignment_submission_files 
       (submission_id, file_type, file_name, file_path, file_size, status, is_new, replaces_file_id, uploaded_at)
       VALUES (?, ?, ?, ?, ?, 'pending', 1, ?, NOW())`,
      [
        existingFile.submission_id,
        getFileTypeFromMimeType(file.mimetype),
        file.originalname,
        cloudinaryResult.secure_url,
        file.size,
        fileId  // This new file replaces the old rejected file
      ]
    );
    
    const newFileId = insertResult.insertId;
    console.log(`[Qualification] New file ${newFileId} created, replacing rejected file ${fileId}`);

    // Refresh submission / progress timestamps so dashboards reflect new work (no row deletes)
    await connection.execute(`UPDATE qual_submissions SET submitted_at = NOW() WHERE id = ?`, [
      existingFile.submission_id,
    ]);
    await connection.execute(
      `UPDATE qual_unit_progress SET assignment_submitted = 1, updated_at = NOW() WHERE student_id = ? AND unit_id = ?`,
      [studentId, existingFile.unit_id]
    );

    // Get tutor assignments for this unit (to notify the tutor)
    const [tutorAssignments] = await connection.execute(
      `SELECT DISTINCT ca.assigned_tutor_id as tutor_id 
       FROM course_assignments ca
       JOIN units u ON u.course_id = ca.course_id
       WHERE ca.student_id = ? AND u.id = ?`,
      [studentId, existingFile.unit_id]
    );

    // Send notification to tutors
    if (tutorAssignments.length > 0) {
      const io = req.app.get('io');
      // Get student name for notification
      const [studentInfo] = await connection.execute(
        `SELECT u.name FROM users u WHERE u.id = ?`,
        [studentId]
      );
      const studentName = studentInfo.length > 0 
        ? studentInfo[0].name 
        : 'A student';

      for (const assignment of tutorAssignments) {
        if (assignment.tutor_id) {
          try {
            await connection.execute(
              `INSERT INTO notifications (
                user_id, type, title, message, created_at
              ) VALUES (?, ?, ?, ?, NOW())`,
              [
                assignment.tutor_id,
                'file_resubmitted',
                '🔄 File Resubmitted',
                `${studentName} has resubmitted a file for ${existingFile.unit_title}. New file: ${file.originalname}`
              ]
            );

            // Emit real-time notification
            if (io) {
              io.to(`user_${assignment.tutor_id}`).emit('new_notification', {
                type: 'file_resubmitted',
                title: '🔄 File Resubmitted',
                message: `${studentName} has resubmitted a file for ${existingFile.unit_title}`,
                created_at: new Date()
              });
            }
            
            console.log(`[Qualification] Notification sent to tutor ${assignment.tutor_id} about file resubmission`);
          } catch (notifError) {
            console.error('[Qualification] Error creating tutor notification (non-critical):', notifError.message);
          }
        } else {
          console.warn('[Qualification] Skipping notification: user_id is null');
        }
      }
    } else {
      console.log(`[Qualification] No tutor assignments found for student ${studentId} and unit ${existingFile.unit_id}`);
    }

    console.log(`[Qualification] File resubmitted successfully. Old file: ${fileId}, New file: ${newFileId}`);
    
    // Invalidate cache
    invalidateCache(QUALIFICATION_CACHE_KEY);

    // Log to system_logs for Event Logs / group-by-student report
    setImmediate(async () => {
      try {
        await logSystemEvent({
          userId: studentId,
          role: 'student',
          action: 'student_file_resubmitted',
          description: `${studentName} resubmitted file "${file.originalname}" for unit "${existingFile.unit_title}"`,
          service: 'qualification',
          req,
          extraBody: {
            unit_id: existingFile.unit_id,
            unit_name: existingFile.unit_title,
            file_name: file.originalname,
            submission_id: existingFile.submission_id,
            old_file_id: parseInt(fileId, 10),
            new_file_id: newFileId
          }
        });
      } catch (e) {
        logger.error({ err: e }, '[Qualification] Failed to log file resubmission');
      }
    });

    res.json({
      success: true,
      message: 'File resubmitted successfully! Your tutor will review it.',
      file: {
        id: newFileId,
        replaces_file_id: fileId,
        file_name: file.originalname,
        file_path: cloudinaryResult.secure_url,
        file_size: file.size,
        status: 'pending'
      }
    });

  } catch (error) {
    console.error('[Qualification] Error resubmitting file:', error);
    res.status(500).json({
      success: false,
      message: 'Error resubmitting file',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// Reject external video / large-file link (assessor or admin)
router.patch('/submissions/:submissionId/reject-video-link', auth, async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { submissionId } = req.params;
    const { reason } = req.body;
    const feedbackText = typeof reason === 'string' ? reason.trim() : '';

    if (!canRejectQualificationSubmissions(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to reject submissions'
      });
    }

    const [rows] = await connection.execute(
      `SELECT s.*, u.title as unit_title, c.id as course_id, c.title as course_title,
              st.name as student_name
       FROM qual_submissions s
       JOIN units u ON s.unit_id = u.id
       JOIN courses c ON u.course_id = c.id
       JOIN users st ON s.student_id = st.id
       WHERE s.id = ?`,
      [submissionId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }

    const sub = rows[0];
    if (!sub.video_link || !String(sub.video_link).trim()) {
      return res.status(400).json({
        success: false,
        message: 'This submission has no video or external link to reject'
      });
    }

    await connection.execute(
      `UPDATE qual_submissions
       SET video_link_status = 'rejected',
           video_link_reject_reason = ?,
           video_link_rejected_at = NOW()
       WHERE id = ?`,
      [feedbackText || null, submissionId]
    );

    const notificationMessage = `Course: ${sub.course_title}\nUnit: ${sub.unit_title}\n\nYour video / large file link was rejected.${feedbackText ? `\n\nReason: ${feedbackText}` : ''}\n\nPlease submit a new link.`;

    try {
      let hasRelatedCourseId = false;
      let hasRelatedSubmissionId = false;
      try {
        const [columns] = await connection.execute(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'notifications'
           AND COLUMN_NAME IN ('related_course_id', 'related_submission_id')`
        );
        hasRelatedCourseId = columns.some((col) => col.COLUMN_NAME === 'related_course_id');
        hasRelatedSubmissionId = columns.some((col) => col.COLUMN_NAME === 'related_submission_id');
      } catch (err) {
        /* ignore */
      }

      if (hasRelatedCourseId && hasRelatedSubmissionId) {
        await connection.execute(
          `INSERT INTO notifications (
            user_id, type, title, message, related_course_id, related_submission_id, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [
            sub.student_id,
            'video_link_rejected',
            '🔴 Video / link rejected — resubmit required',
            notificationMessage,
            sub.course_id,
            parseInt(submissionId, 10)
          ]
        );
      } else {
        await connection.execute(
          `INSERT INTO notifications (
            user_id, type, title, message, created_at
          ) VALUES (?, ?, ?, ?, NOW())`,
          [
            sub.student_id,
            'video_link_rejected',
            '🔴 Video / link rejected — resubmit required',
            notificationMessage
          ]
        );
      }
    } catch (notifError) {
      console.error('[Qualification] Error creating video link rejection notification:', notifError.message);
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`user_${sub.student_id}`).emit('new_notification', {
        type: 'video_link_rejected',
        title: '🔴 Video / link rejected — resubmit required',
        message: notificationMessage,
        created_at: new Date()
      });
      io.to(`user_${sub.student_id}`).emit('video_link_rejected', {
        submissionId: parseInt(submissionId, 10),
        studentId: sub.student_id
      });
    }

    invalidateCache(QUALIFICATION_CACHE_KEY);

    res.json({ success: true, message: 'Video link rejected. Student has been notified.' });
  } catch (error) {
    console.error('[Qualification] Error rejecting video link:', error);
    res.status(500).json({
      success: false,
      message: 'Error rejecting video link',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// Student resubmits video / large-file link after rejection
router.patch('/submissions/:submissionId/resubmit-video-link', auth, async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { submissionId } = req.params;
    const studentId = req.user.id;
    const newLinkRaw = req.body?.video_link;
    const newLink = typeof newLinkRaw === 'string' ? newLinkRaw.trim() : '';

    if (!qualificationVideoResubmitTextValid(newLink)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid http(s) URL (or text that includes one).'
      });
    }

    const [existing] = await connection.execute(
      `SELECT s.id, s.student_id, s.unit_id, s.video_link_status, u.title as unit_title
       FROM qual_submissions s
       JOIN units u ON s.unit_id = u.id
       WHERE s.id = ? AND s.student_id = ?`,
      [submissionId, studentId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found or access denied'
      });
    }

    if (existing[0].video_link_status !== 'rejected') {
      return res.status(400).json({
        success: false,
        message: 'Video link can only be resubmitted after it has been rejected'
      });
    }

    const [upd] = await connection.execute(
      `UPDATE qual_submissions
       SET video_link = ?,
           video_link_status = 'submitted',
           video_link_reject_reason = NULL,
           video_link_rejected_at = NULL
       WHERE id = ? AND student_id = ? AND video_link_status = 'rejected'`,
      [newLink, submissionId, studentId]
    );

    if (upd.affectedRows === 0) {
      return res.status(400).json({
        success: false,
        message: 'Could not update video link'
      });
    }

    const unitRow = existing[0];
    const [tutorAssignments] = await connection.execute(
      `SELECT DISTINCT ca.assigned_tutor_id AS tutor_id
       FROM course_assignments ca
       JOIN units u ON u.course_id = ca.course_id
       WHERE ca.student_id = ? AND u.id = ?`,
      [studentId, unitRow.unit_id]
    );

    const io = req.app.get('io');
    const [studentInfo] = await connection.execute(
      `SELECT name FROM users WHERE id = ?`,
      [studentId]
    );
    const studentName = studentInfo.length > 0 ? studentInfo[0].name : 'A student';

    if (tutorAssignments.length > 0) {
      for (const assignment of tutorAssignments) {
        try {
          await connection.execute(
            `INSERT INTO notifications (
              user_id, type, title, message, created_at
            ) VALUES (?, ?, ?, ?, NOW())`,
            [
              assignment.tutor_id,
              'video_link_resubmitted',
              '🔄 Video / link resubmitted',
              `${studentName} resubmitted a video or large file link for ${unitRow.unit_title}.`
            ]
          );
          if (io) {
            io.to(`user_${assignment.tutor_id}`).emit('new_notification', {
              type: 'video_link_resubmitted',
              title: '🔄 Video / link resubmitted',
              message: `${studentName} resubmitted a video or large file link for ${unitRow.unit_title}.`,
              created_at: new Date()
            });
          }
        } catch (notifError) {
          console.error('[Qualification] Tutor notification (video link resubmit):', notifError.message);
        }
      }
    }

    invalidateCache(QUALIFICATION_CACHE_KEY);
    await invalidateCache(`cache:/api/student/${studentId}/qualification-courses*`);

    res.json({ success: true, message: 'Video link updated successfully.' });
  } catch (error) {
    console.error('[Qualification] Error resubmitting video link:', error);
    res.status(500).json({
      success: false,
      message: 'Error resubmitting video link',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

module.exports = router;

