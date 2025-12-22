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
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');
const auth = require('../middleware/auth');
const { cacheMiddleware, invalidateCache } = require('../middleware/cache');
const { logSystemEvent } = require('../utils/eventLogger');

// =====================================================
// CLOUDINARY STORAGE CONFIGURATION
// =====================================================

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'lms/qualification',
    resource_type: 'raw', // Use 'raw' for PDFs and documents (as per CLOUDINARY_FILE_VIEWING_SETUP.txt)
    allowed_formats: ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx']
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
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
    
    console.log('[Qualification] Creating course:', { title, userId });
    console.log('[Qualification] Files received:', req.files ? Object.keys(req.files) : 'none');
    
    // 1. Create course with type 'qualification'
    const [courseResult] = await connection.execute(
      `INSERT INTO courses (title, description, course_type, status, category_id, sub_category_id, created_by, created_at, updated_at)
       VALUES (?, ?, 'qualification', 'Active', ?, ?, ?, NOW(), NOW())`,
      [title, description, category_id || null, sub_category_id || null, userId]
    );
    
    const courseId = courseResult.insertId;
    console.log('[Qualification] Course created with ID:', courseId);
    
    // 2. Insert course content (welcome, disclaimer, general info)
    await connection.execute(
      `INSERT INTO qual_course_content (course_id, welcome_message, disclaimer, general_information)
       VALUES (?, ?, ?, ?)`,
      [courseId, welcome_message || null, disclaimer || null, general_information || null]
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
        console.log('  - Cloudinary path:', file.path);
        console.log('  - File size:', file.size);
        console.log('  - Mimetype:', file.mimetype);
        
        await connection.execute(
          `INSERT INTO qual_course_files (course_id, file_type, file_name, file_path, file_size, uploaded_by)
           VALUES (?, 'handbook', ?, ?, ?, ?)`,
          [courseId, file.originalname, file.path, file.size, userId]
        );
        console.log('[Qualification] Handbook uploaded successfully to database');
      } else {
        console.log('[Qualification] No handbook file found');
      }
      
      // Descriptor (single file)
      if (req.files.descriptor && req.files.descriptor[0]) {
        const file = req.files.descriptor[0];
        await connection.execute(
          `INSERT INTO qual_course_files (course_id, file_type, file_name, file_path, file_size, uploaded_by)
           VALUES (?, 'descriptor', ?, ?, ?, ?)`,
          [courseId, file.originalname, file.path, file.size, userId]
        );
        console.log('[Qualification] Descriptor uploaded');
      }
      
      // Welcome message files (multiple)
      if (req.files.welcome_files) {
        console.log('[Qualification] Uploading', req.files.welcome_files.length, 'welcome files');
        for (const file of req.files.welcome_files) {
          console.log('[Qualification] Welcome file:', file.originalname, '- Path:', file.path);
          await connection.execute(
            `INSERT INTO qual_course_files (course_id, file_type, file_name, file_path, file_size, uploaded_by)
             VALUES (?, 'welcome', ?, ?, ?, ?)`,
            [courseId, file.originalname, file.path, file.size, userId]
          );
        }
      }
      
      // Disclaimer files (multiple)
      if (req.files.disclaimer_files) {
        console.log('[Qualification] Uploading', req.files.disclaimer_files.length, 'disclaimer files');
        for (const file of req.files.disclaimer_files) {
          await connection.execute(
            `INSERT INTO qual_course_files (course_id, file_type, file_name, file_path, file_size, uploaded_by)
             VALUES (?, 'disclaimer', ?, ?, ?, ?)`,
            [courseId, file.originalname, file.path, file.size, userId]
          );
        }
      }
      
      // General info files (multiple)
      if (req.files.general_info_files) {
        console.log('[Qualification] Uploading', req.files.general_info_files.length, 'general info files');
        for (const file of req.files.general_info_files) {
          await connection.execute(
            `INSERT INTO qual_course_files (course_id, file_type, file_name, file_path, file_size, uploaded_by)
             VALUES (?, 'general_info', ?, ?, ?, ?)`,
            [courseId, file.originalname, file.path, file.size, userId]
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
            await connection.execute(
              `INSERT INTO qual_course_files (course_id, file_type, file_name, file_path, file_size, uploaded_by)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [courseId, fileType, file.originalname, file.path, file.size, userId]
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
              qcc.general_information
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
    
    // Get units
    const [units] = await pool.execute(
      `SELECT * FROM units WHERE course_id = ? ORDER BY order_index`,
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
          field: uploadErr.field
        });
        return res.status(400).json({
          success: false,
          message: 'File upload error',
          error: uploadErr.message
        });
      }
      console.log('[Qualification] File upload successful');
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
    const [unitResult] = await connection.execute(
      `INSERT INTO units (
        course_id, title, content, order_index, is_optional, unlock_condition, 
        enable_assignment_submission, enable_presentation_submission, enable_quiz, deadline, 
        created_at, updated_at
      )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        courseId, 
        title, 
        content || '', 
        order_index || 0, 
        is_optional === 'true' || is_optional === true ? 1 : 0, 
        unlock_condition || 'none',
        enable_assignment_submission === 'true' || enable_assignment_submission === true ? 1 : 0,
        enable_presentation_submission === 'true' || enable_presentation_submission === true ? 1 : 0,
        enable_quiz === 'true' || enable_quiz === true ? 1 : 0,
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
        [unitId, disclaimer || null, general_information || null]
      );
    }
    
    // 3. Process lectures with files
    const lecturesData = req.body.lectures ? JSON.parse(req.body.lectures) : [];
    console.log('[Qualification] Processing', lecturesData.length, 'lectures');
    
    for (let i = 0; i < lecturesData.length; i++) {
      const lecture = lecturesData[i];
      const lectureFiles = req.files[`lecture_${i}_files`] || [];
      
      console.log(`[Qualification] Lecture ${i + 1}:`, lecture.title, '- Files:', lectureFiles.length);
      
      // Store each lecture file as an announcement
      for (const file of lectureFiles) {
        let announcementType = 'text';
        if (file.originalname.toLowerCase().endsWith('.pdf')) announcementType = 'pdf';
        else if (file.originalname.match(/\.(mp4|avi|mov)$/i)) announcementType = 'video';
        
        await connection.execute(
          `INSERT INTO qual_unit_announcements (unit_id, title, content, file_path, file_name, announcement_type)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [unitId, `Lecture ${i + 1}: ${lecture.title}`, lecture.description || '', file.path, file.originalname, announcementType]
        );
      }
    }
    
    // 4. Additional reading files
    if (req.files && req.files.reading_files) {
      console.log('[Qualification] Uploading', req.files.reading_files.length, 'reading files');
      for (let i = 0; i < req.files.reading_files.length; i++) {
        const file = req.files.reading_files[i];
        await connection.execute(
          `INSERT INTO qual_additional_readings (unit_id, title, file_name, file_path, file_size, order_index)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [unitId, file.originalname, file.originalname, file.path, file.size, i]
        );
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
            assignment_brief_heading || null,
            assignment_brief_description || null,
            assignment_brief_important_note || null,
            assignment_brief_grading_type || 'pass_fail',
            assignment_brief_grading_type === 'score' ? (assignment_brief_passing_score || 70) : null
          ]
        );
        const briefId = briefResult.insertId;
        console.log('[Qualification] Assignment brief created with ID:', briefId);
        
        // Store assignment brief files if any
        const briefFiles = req.files['assignment_brief_files'] || [];
        if (briefFiles.length > 0) {
          for (const file of briefFiles) {
            await connection.execute(
              `INSERT INTO qual_assignment_brief_files (brief_id, file_type, file_name, file_path, file_size)
               VALUES (?, ?, ?, ?, ?)`,
              [briefId, 'brief', file.originalname, file.path, file.size]
            );
          }
          console.log('[Qualification] Uploaded', briefFiles.length, 'assignment brief files');
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
            presentation_brief_heading || null,
            presentation_brief_description || null,
            presentation_brief_important_note || null
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
              console.log('[Qualification] Video uploaded:', file.originalname, 'URL:', file.path);
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
    
    await connection.commit();
    
    // Invalidate cache after successful unit creation
    await invalidateCache(`cache:/api/qualification/${courseId}*`);
    await invalidateCache(`cache:/api/qualification/${courseId}/units*`);
    await invalidateCache(`cache:/api/qualification/units/${unitId}*`);
    // Invalidate student course lists that might include this course
    await invalidateCache(`cache:/api/student/*/qualification-courses*`);
    console.log('[Qualification] Cache invalidated for new unit', unitId, 'and course', courseId);
    
    // Log unit creation
    setImmediate(async () => {
      await logSystemEvent({
        userId: req.user?.id || null,
        action: 'qualification_unit_created',
        description: `Unit ${title} (ID: ${unitId}) created for course ${courseId}`,
        req
      });
    });
    
    res.json({
      success: true,
      message: 'Unit created successfully',
      unitId: unitId
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('[Qualification] Error creating unit:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating unit',
      error: error.message
    });
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
    
    // Get announcements
    const [announcements] = await pool.execute(
      `SELECT * FROM qual_unit_announcements WHERE unit_id = ? ORDER BY created_at DESC`,
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
        // First unit is always unlocked
        const isUnlocked = isFirstUnit;
        
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
      progress: progress
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
    
    // 1. Create topic
    const [topicResult] = await connection.execute(
      `INSERT INTO qual_topics (unit_id, topic_number, title, description, deadline, order_index)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [unitId, topic_number, title, description || null, deadline || null, order_index || 0]
    );
    
    const topicId = topicResult.insertId;
    console.log('[Qualification] Topic created with ID:', topicId);
    
    // 2. Upload files
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        await connection.execute(
          `INSERT INTO qual_topic_files (topic_id, file_name, file_path, file_type, file_size)
           VALUES (?, ?, ?, ?, ?)`,
          [topicId, file.originalname, file.path, file.mimetype, file.size]
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

// =====================================================
// ADDITIONAL READINGS
// =====================================================

// ADD ADDITIONAL READING
router.post('/units/:unitId/readings', auth, upload.single('file'), async (req, res) => {
  try {
    const { unitId } = req.params;
    const { title, order_index } = req.body;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'File is required'
      });
    }
    
    console.log('[Qualification] Adding reading to unit:', unitId);
    
    await pool.execute(
      `INSERT INTO qual_additional_readings (unit_id, title, file_name, file_path, file_type, file_size, order_index)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [unitId, title, file.originalname, file.path, file.mimetype, file.size, order_index || 0]
    );
    
    res.json({
      success: true,
      message: 'Additional reading added successfully'
    });
    
  } catch (error) {
    console.error('[Qualification] Error adding reading:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding additional reading'
    });
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
    
    // 2. Upload files
    if (req.files && req.files.length > 0) {
      const fileTypes = JSON.parse(req.body.fileTypes || '[]');
      
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const fileType = fileTypes[i] || 'other';
        
        await connection.execute(
          `INSERT INTO qual_assignment_brief_files (brief_id, file_type, file_name, file_path, file_size)
           VALUES (?, ?, ?, ?, ?)`,
          [briefId, fileType, file.originalname, file.path, file.size]
        );
      }
      console.log('[Qualification] Uploaded', req.files.length, 'brief files');
    }
    
    await connection.commit();
    
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

// =====================================================
// STUDENT SUBMISSION
// =====================================================

// SUBMIT ASSIGNMENT OR PRESENTATION (or resubmit if failed)
router.post('/units/:unitId/submit', auth, upload.single('file'), async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { unitId } = req.params;
    const { submission_type, is_resubmission } = req.body; // 'assignment' or 'presentation', is_resubmission flag
    const studentId = req.user.id;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'File is required'
      });
    }
    
    console.log('[Qualification] Student', studentId, 'submitting', submission_type, 'for unit:', unitId, 'is_resubmission:', is_resubmission);
    
    let submissionId;
    
    // Always create a new submission record to preserve history
    // This way old feedback and grades are preserved
    const [submissionResult] = await connection.execute(
      `INSERT INTO qual_submissions (unit_id, student_id, submission_type, file_name, file_path, file_size, status)
       VALUES (?, ?, ?, ?, ?, ?, 'submitted')`,
      [unitId, studentId, submission_type, file.originalname, file.path, file.size]
    );
    submissionId = submissionResult.insertId;
    
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
      `SELECT order_index, course_id FROM units WHERE id = ?`,
      [unitId]
    );
    
    if (currentUnit.length > 0 && submission_type === 'assignment') {
      const currentOrder = currentUnit[0].order_index;
      const courseId = currentUnit[0].course_id;
      
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
        const [nextUnit] = await connection.execute(
          `SELECT id, order_index FROM units 
           WHERE course_id = ? AND order_index > ?
           ORDER BY order_index ASC
           LIMIT 1`,
          [courseId, currentOrder]
        );
        if (nextUnit.length > 0) {
          await connection.execute(
            `INSERT INTO qual_unit_progress (student_id, course_id, unit_id, is_unlocked, unlocked_at, unlock_method)
             VALUES (?, ?, ?, 1, NOW(), 'assignment_submitted')
             ON DUPLICATE KEY UPDATE 
               is_unlocked = 1,
               unlocked_at = NOW(),
               unlock_method = 'assignment_submitted'`,
            [studentId, courseId, nextUnit[0].id]
          );
          console.log('[Qualification] ✅ Unit', nextUnit[0].id, '(order', nextUnit[0].order_index, ') unlocked because Unit 1 (order', currentOrder, ') assignment was submitted');
          
          // Invalidate cache to ensure fresh data (cache keys are prefixed with 'cache:')
          await invalidateCache(`cache:/api/qualification/units/${nextUnit[0].id}*`);
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
            const [nextUnit] = await connection.execute(
              `SELECT id, order_index FROM units 
               WHERE course_id = ? AND order_index > ?
               ORDER BY order_index ASC
               LIMIT 1`,
              [courseId, currentOrder]
            );
            
            if (nextUnit.length > 0) {
              await connection.execute(
                `INSERT INTO qual_unit_progress (student_id, course_id, unit_id, is_unlocked, unlocked_at, unlock_method)
                 VALUES (?, ?, ?, 1, NOW(), 'assignment_submitted')
                 ON DUPLICATE KEY UPDATE 
                   is_unlocked = 1,
                   unlocked_at = NOW(),
                   unlock_method = 'assignment_submitted'`,
                [studentId, courseId, nextUnit[0].id]
              );
              console.log('[Qualification] ✅ Unit', nextUnit[0].id, '(order', nextUnit[0].order_index, ') unlocked because Unit', unitId, '(order', currentOrder, ') submitted and Unit', prevUnit[0].id, '(order', prevUnit[0].order_index, ') is PASSED');
              
              // Invalidate cache to ensure fresh data (cache keys are prefixed with 'cache:')
              await invalidateCache(`cache:/api/qualification/units/${nextUnit[0].id}*`);
              await invalidateCache(`cache:/api/qualification/${courseId}*`);
              await invalidateCache(`cache:/api/student/${studentId}/qualification-courses*`);
            }
          } else {
            console.log('[Qualification] Unit', unitId, '(order', currentOrder, ') submitted but Unit', prevUnit[0].id, '(order', prevUnit[0].order_index, ') is not PASSED (result:', prevSubmission[0]?.pass_fail_result || 'none', ') - NOT unlocking next unit');
          }
        } else {
          console.log('[Qualification] No previous unit found for Unit', unitId, '(order', currentOrder, ')');
        }
      }
    }
    
    // 4. Get course tutors and notify them
    const [tutors] = await connection.execute(
      `SELECT DISTINCT u.id 
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE r.name = 'Tutor'`
    );
    
    // Get student and unit info for notification
    const [studentInfo] = await connection.execute('SELECT name FROM users WHERE id = ?', [studentId]);
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
    
    const [submissions] = await pool.execute(
      `SELECT 
        s.id as submission_id,
        s.submission_type,
        s.file_name,
        s.file_path,
        s.submitted_at,
        s.status,
        s.pass_fail_result,
        s.feedback,
        s.graded_at,
        s.graded_by,
        u.id as unit_id,
        u.title as unit_title,
        u.order_index as unit_order,
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
       ORDER BY 
         CASE WHEN s.status = 'submitted' THEN 0 ELSE 1 END,
         s.submitted_at DESC`
    );
    
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
        graded_by_name: sample.graded_by_name
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
          pass_fail_result: latestGraded.pass_fail_result
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
    });
    
    console.log('[Qualification] Submission graded successfully:', {
      submission_id: submissionId,
      graded_by: gradedSubmission?.graded_by,
      graded_at: gradedSubmission?.graded_at,
      graded_by_name: gradedSubmission?.graded_by_name,
      pass_fail_result: pass_fail_result
    });
    
    await invalidateCache('cache:/api/qual/progress*');
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
// DOWNLOAD FILE WITH PROPER FILENAME
// =====================================================
router.get('/download-file', async (req, res) => {
  try {
    const { url, filename } = req.query;
    
    if (!url || !filename) {
      return res.status(400).json({ success: false, message: 'URL and filename required' });
    }

    console.log('[Qualification] Downloading file:', filename);

    const https = require('https');
    
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        console.error('[Qualification] Failed to fetch file, status:', response.statusCode);
        return res.status(response.statusCode).json({ 
          success: false, 
          message: 'Failed to fetch file' 
        });
      }

      // Set headers for download with original filename
      res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

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
// PROXY PDF FOR VIEWING (handles CORS and auth)
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

module.exports = router;

