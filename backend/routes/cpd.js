const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { sanitize } = require('../utils/sanitizeHtml');
const multer = require('multer');
const cloudinary = require('../config/cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const auth = require('../middleware/auth');
const { cacheMiddleware, invalidateCache } = require('../middleware/cache');
const { logSystemEvent } = require('../utils/eventLogger');
const https = require('https');

const CPD_CACHE_KEY = 'cache:/api/cpd*';

// Configure Cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'lms-cpd',
    resource_type: 'raw',
    allowed_formats: ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx']
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[CPD] Multer fileFilter - File:', file.originalname, 'MIME:', file.mimetype);
    }
    cb(null, true);
  }
});

// ===================================================================
// SMALL HELPERS
// ===================================================================

async function getCpdCourse(courseId, includeSubCategory = false) {
  const subSelect = includeSubCategory ? ', sc.name as sub_category_name' : '';
  const subJoin = includeSubCategory ? ' LEFT JOIN sub_categories sc ON c.sub_category_id = sc.id' : '';

  const [rows] = await pool.query(
    `SELECT c.*, cat.name as category_name${subSelect}
     FROM courses c
     LEFT JOIN course_categories cat ON c.category_id = cat.id
     ${subJoin}
     WHERE c.id = ? AND c.course_type = 'cpd'`,
    [courseId]
  );

  return rows[0] || null;
}

async function getAnnouncementWithFiles(courseId) {
  const [announcements] = await pool.query(
    `SELECT * FROM cpd_announcements WHERE course_id = ?`,
    [courseId]
  );

  if (!announcements.length) return null;

  const announcement = announcements[0];
  const [files] = await pool.query(
    `SELECT * FROM cpd_announcement_files WHERE announcement_id = ?`,
    [announcement.id]
  );

  announcement.files = files;
  return announcement;
}

async function getFaqWithFiles(courseId) {
  const [faqs] = await pool.query(
    `SELECT * FROM cpd_faq WHERE course_id = ?`,
    [courseId]
  );

  if (!faqs.length) return null;

  const faq = faqs[0];
  const [files] = await pool.query(
    `SELECT * FROM cpd_faq_files WHERE faq_id = ?`,
    [faq.id]
  );

  faq.files = files;
  return faq;
}

async function getTopicsWithFilesAndQuizzes(courseId) {
  const [topics] = await pool.query(
    `SELECT * FROM cpd_topics WHERE course_id = ? ORDER BY order_index`,
    [courseId]
  );

  for (const topic of topics) {
    // Get sections for this topic
    const [sections] = await pool.query(
      `SELECT * FROM cpd_topic_sections WHERE topic_id = ? ORDER BY section_order`,
      [topic.id]
    );
    
    // Get all files for this topic
    const [files] = await pool.query(
      `SELECT * FROM cpd_topic_files WHERE topic_id = ? ORDER BY uploaded_at`,
      [topic.id]
    );
    
    // Organize files by section
    const filesBySection = new Map();
    const generalFiles = [];
    
    for (const file of files) {
      if (file.section_id) {
        if (!filesBySection.has(file.section_id)) {
          filesBySection.set(file.section_id, []);
        }
        filesBySection.get(file.section_id).push(file);
      } else {
        generalFiles.push(file);
      }
    }
    
    // Attach sections with their files
    topic.sections = sections.map(section => ({
      id: section.id,
      title: section.section_title,
      order: section.section_order,
      files: filesBySection.get(section.id) || []
    }));
    
    // Attach general files (without section) for backward compatibility
    topic.files = generalFiles;

    const [quizzes] = await pool.query(
      `SELECT * FROM cpd_quizzes WHERE topic_id = ?`,
      [topic.id]
    );
    topic.practice_quiz = quizzes.find(q => q.quiz_type === 'practice') || null;
    topic.final_quiz = quizzes.find(q => q.quiz_type === 'final') || null;
  }

  return topics;
}

function streamRemoteFile(url, onOkHeaders, res, errorLabel) {
  https
    .get(url, (response) => {
      if (response.statusCode !== 200) {
        console.error(`[CPD] Failed to fetch ${errorLabel}, status:`, response.statusCode);
        return res.status(response.statusCode).json({
          success: false,
          message: `Failed to fetch ${errorLabel}`
        });
      }

      onOkHeaders(response, res);
      response.pipe(res);
    })
    .on('error', (error) => {
      console.error(`[CPD] Error fetching ${errorLabel}:`, error.message);
      res.status(500).json({ success: false, message: `Error loading ${errorLabel}` });
    });
}

// =====================================================
// CREATE CPD COURSE
// =====================================================
router.post(
  '/create',
  (req, res, next) => {
    auth(req, res, (err) => {
      if (err) return next(err);
      upload.fields([
        { name: 'announcement_files', maxCount: 10 },
        { name: 'faq_files', maxCount: 10 },
        ...Array.from({ length: 20 }, (_, i) => ({ name: `topic_${i}_files`, maxCount: 20 }))
      ])(req, res, next);
    });
  },
  async (req, res) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const {
        title,
        description,
        category_id,
        sub_category_id,
        announcement_title,
        announcement_description,
        faq_content,
        topics: topicsJSON
      } = req.body;

      const userId = req.user.id;

      // 1. Create Course
      const [courseResult] = await connection.query(
        `INSERT INTO courses (title, description, category_id, sub_category_id, course_type, status, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'cpd', 'Active', ?, NOW(), NOW())`,
        [sanitize(title), sanitize(description), category_id, sub_category_id || null, userId]
      );

      const courseId = courseResult.insertId;

      // 2. Create Announcement
      if (announcement_title) {
        const [announcementResult] = await connection.query(
          `INSERT INTO cpd_announcements (course_id, title, description, created_at, updated_at)
           VALUES (?, ?, ?, NOW(), NOW())`,
          [courseId, sanitize(announcement_title), sanitize(announcement_description)]
        );

        const announcementId = announcementResult.insertId;

        if (req.files['announcement_files']) {
          for (const file of req.files['announcement_files']) {
            await connection.query(
              `INSERT INTO cpd_announcement_files (announcement_id, file_name, file_path, file_type, file_size, uploaded_at)
               VALUES (?, ?, ?, ?, ?, NOW())`,
              [announcementId, file.originalname, file.path, file.mimetype, file.size]
            );
          }
        }
      }

      // 3. Create FAQ
      if (faq_content) {
        const [faqResult] = await connection.query(
          `INSERT INTO cpd_faq (course_id, content, created_at, updated_at)
           VALUES (?, ?, NOW(), NOW())`,
          [courseId, sanitize(faq_content)]
        );

        const faqId = faqResult.insertId;

        if (req.files['faq_files']) {
          for (const file of req.files['faq_files']) {
            await connection.query(
              `INSERT INTO cpd_faq_files (faq_id, file_name, file_path, file_type, file_size, uploaded_at)
               VALUES (?, ?, ?, ?, ?, NOW())`,
              [faqId, file.originalname, file.path, file.mimetype, file.size]
            );
          }
        }
      }

      // 4. Create Topics
      if (topicsJSON) {
        const topics = JSON.parse(topicsJSON);

        for (let i = 0; i < topics.length; i++) {
          const topic = topics[i];

          const [topicResult] = await connection.query(
            `INSERT INTO cpd_topics (course_id, topic_number, title, description, deadline, order_index, is_locked, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [
              courseId,
              topic.topic_number,
              sanitize(topic.title),
              sanitize(topic.description),
              topic.deadline || null,
              i,
              i === 0 ? 0 : 1 // First topic unlocked
            ]
          );

          const topicId = topicResult.insertId;
          const topicFilesKey = `topic_${i}_files`;

          if (req.files[topicFilesKey]) {
            for (const file of req.files[topicFilesKey]) {
              await connection.query(
                `INSERT INTO cpd_topic_files (topic_id, file_name, file_path, file_type, file_size, uploaded_at)
                 VALUES (?, ?, ?, ?, ?, NOW())`,
                [topicId, file.originalname, file.path, file.mimetype, file.size]
              );
            }
          }
        }
      }

      await connection.commit();

      // Log CPD course creation - capture user info before async logging
      const logUserId = req.user?.id || null;
      const logUserRoleId = req.user?.role_id || null;
      const { getRoleName } = require('../utils/eventLogger');
      const logUserRole = logUserRoleId ? getRoleName(logUserRoleId) : null;
      const logRoleLabel = logUserRole ? logUserRole.charAt(0).toUpperCase() + logUserRole.slice(1) : 'User';
      
      setImmediate(async () => {
        await logSystemEvent({
          userId: logUserId,
          role: logUserRole,
          action: 'cpd_course_created',
          description: `${logRoleLabel} created CPD course ${title} (ID: ${courseId})`,
          req
        });
      });

      await invalidateCache(CPD_CACHE_KEY);
      res.json({
        success: true,
        message: 'CPD course created successfully',
        courseId
      });
    } catch (error) {
      await connection.rollback();
      res.status(500).json({
        success: false,
        message: 'Failed to create CPD course',
        error: error.message,
        details: error.stack
      });
    } finally {
      connection.release();
    }
  }
);

// =====================================================
// GET CPD COURSE DETAILS FOR STUDENT
// =====================================================
router.get('/:courseId/student/:studentId', cacheMiddleware(60), async (req, res) => {
  try {
    const { courseId, studentId } = req.params;

    const course = await getCpdCourse(courseId, false);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    const announcement = await getAnnouncementWithFiles(courseId);
    const faq = await getFaqWithFiles(courseId);
    const topics = await getTopicsWithFilesAndQuizzes(courseId);

    // Progress
    const [progress] = await pool.query(
      `SELECT * FROM cpd_progress
       WHERE student_id = ? AND course_id = ?`,
      [studentId, courseId]
    );

    const progressMap = {};
    progress.forEach((p) => {
      progressMap[p.topic_id] = p;
    });

    // Initialize progress for first topic if not exists
    if (topics.length > 0 && !progressMap[topics[0].id]) {
      await pool.query(
        `INSERT INTO cpd_progress (student_id, course_id, topic_id, is_unlocked, created_at, updated_at)
         VALUES (?, ?, ?, 1, NOW(), NOW())
         ON DUPLICATE KEY UPDATE is_unlocked = 1`,
        [studentId, courseId, topics[0].id]
      );
      progressMap[topics[0].id] = { is_unlocked: 1, final_quiz_passed: 0 };
    }

    // Safety check: Auto-unlock next topics if previous ones are passed
    // This ensures unlock logic works even if it failed during quiz submission
    for (let i = 0; i < topics.length; i++) {
      const topic = topics[i];
      const progress = progressMap[topic.id] || { is_unlocked: 0, final_quiz_passed: 0 };
      
      // If this topic is passed and next topic exists, ensure next is unlocked
      if (progress.final_quiz_passed === 1 && i < topics.length - 1) {
        const nextTopic = topics[i + 1];
        const nextProgress = progressMap[nextTopic.id];
        
        if (!nextProgress || nextProgress.is_unlocked === 0) {
          // Auto-unlock the next topic
          await pool.query(
            `INSERT INTO cpd_progress (student_id, course_id, topic_id, is_unlocked, created_at, updated_at)
             VALUES (?, ?, ?, 1, NOW(), NOW())
             ON DUPLICATE KEY UPDATE is_unlocked = 1, updated_at = NOW()`,
            [studentId, courseId, nextTopic.id]
          );
          progressMap[nextTopic.id] = { is_unlocked: 1, final_quiz_passed: 0 };
          console.log(`[CPD] Auto-unlocked topic ${nextTopic.id} (${nextTopic.title}) for student ${studentId} because previous topic ${topic.id} was passed`);
        }
      }
    }

    topics.forEach((topic) => {
      topic.progress = progressMap[topic.id] || { is_unlocked: 0, final_quiz_passed: 0 };
    });

    const allTopicsPassed =
      topics.length > 0 && topics.every((t) => t.progress.final_quiz_passed === 1);

    res.json({
      success: true,
      course,
      announcements: announcement,
      faq,
      topics,
      canClaimCertificate: allTopicsPassed
    });
  } catch (error) {
    console.error('Error fetching CPD course:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch course details',
      error: error.message
    });
  }
});

// =====================================================
// GET ALL CPD COURSES
// =====================================================
router.get('/list', cacheMiddleware(300), async (req, res) => {
  try {
    const [courses] = await pool.query(
      `SELECT c.*, cat.name as category_name, u.name as created_by_name,
       (SELECT COUNT(*) FROM cpd_topics WHERE course_id = c.id) as topic_count
       FROM courses c
       LEFT JOIN course_categories cat ON c.category_id = cat.id
       LEFT JOIN users u ON c.created_by = u.id
       WHERE c.course_type = 'cpd'
       ORDER BY c.created_at DESC`
    );

    res.json({ success: true, courses });
  } catch (error) {
    console.error('Error fetching CPD courses:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch courses' });
  }
});

// =====================================================
// GET CPD COURSE FOR ADMIN (with all details)
// =====================================================
router.get('/:courseId/admin', cacheMiddleware(300), async (req, res) => {
  try {
    const { courseId } = req.params;

    const course = await getCpdCourse(courseId, true);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    const announcement = await getAnnouncementWithFiles(courseId);
    const faq = await getFaqWithFiles(courseId);
    const topics = await getTopicsWithFilesAndQuizzes(courseId);

    res.json({
      success: true,
      course,
      announcements: announcement,
      faq,
      topics
    });
  } catch (error) {
    console.error('Error fetching CPD course for admin:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch course details',
      error: error.message
    });
  }
});

// =====================================================
// ADD CPD TOPIC
// =====================================================
// Error handler for multer errors (too many files, file too large, etc.)
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: `Too many files. Maximum allowed is ${err.limit} files.`,
        error: err.message
      });
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: `File too large. Maximum size is 50MB per file.`,
        error: err.message
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: `Unexpected file field. Expected field name: 'files'`,
        error: err.message
      });
    }
    return res.status(400).json({
      success: false,
      message: 'File upload error: ' + err.message,
      error: err.code
    });
  }
  if (err) {
    return res.status(500).json({
      success: false,
      message: 'File upload error: ' + err.message
    });
  }
  next();
};

router.post('/:courseId/topics', auth, (req, res, next) => {
  // Use multer to handle file uploads - accept any field name for sections support
  upload.any()(req, res, (err) => {
    if (err) {
      console.error('[CPD] Multer error:', err.code, err.message, err.field);
      // Handle multer errors
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            success: false,
            message: `Too many files. Maximum allowed is ${err.limit} files.`,
            error: err.message
          });
        }
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: `File too large. Maximum size is 50MB per file.`,
            error: err.message
          });
        }
        return res.status(400).json({
          success: false,
          message: 'File upload error: ' + err.message,
          error: err.code
        });
      }
      // Other errors
      console.error('[CPD] File upload error:', err);
      return res.status(500).json({
        success: false,
        message: 'File upload error: ' + err.message
      });
    }
    next();
  });
}, async (req, res) => {
  const { courseId } = req.params;
  const { topic_number, title, description, deadline, sections } = req.body;

  if (process.env.NODE_ENV === 'development') {
    console.log('[CPD] Adding topic to course:', courseId);
    console.log('[CPD] Topic data:', { topic_number, title, description, deadline });
  }

  // Parse sections if provided
  let sectionsData = [];
  try {
    if (sections) {
      sectionsData = typeof sections === 'string' ? JSON.parse(sections) : sections;
    }
  } catch (err) {
    console.error('[CPD] Error parsing sections:', err);
    sectionsData = [];
  }
  
  // Check if too many files were sent (client-side validation might have failed)
  if (req.files && req.files.length > 50) {
    return res.status(400).json({
      success: false,
      message: `Too many files. Maximum allowed is 50 files. You sent ${req.files.length} files.`
    });
  }

  // Use transaction for atomicity
  const connection = await pool.getConnection();
  
  try {
      await connection.beginTransaction();

      const [maxOrder] = await connection.query(
        `SELECT MAX(order_index) as max_order FROM cpd_topics WHERE course_id = ?`,
        [courseId]
      );

      const orderIndex = (maxOrder[0].max_order || -1) + 1;
      const isLocked = orderIndex === 0 ? 0 : 1;

      // Auto-calculate topic_number from order_index if not provided or invalid
      // This ensures topic_number matches the sequential order
      let finalTopicNumber = topic_number;
      if (!topic_number || topic_number <= 0) {
        finalTopicNumber = orderIndex + 1; // order_index is 0-based, topic_number is 1-based
      }

      const [topicResult] = await connection.query(
        `INSERT INTO cpd_topics (course_id, topic_number, title, description, deadline, order_index, is_locked, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [courseId, finalTopicNumber, sanitize(title), sanitize(description), deadline || null, orderIndex, isLocked]
      );

      const topicId = topicResult.insertId;

      // Process sections and their files
      const sectionFileMap = new Map(); // Map section index to section ID
      if (sectionsData && sectionsData.length > 0) {
        console.log('[CPD] Creating', sectionsData.length, 'sections...');
        for (let i = 0; i < sectionsData.length; i++) {
          const section = sectionsData[i];
          if (section.title && section.title.trim()) {
            const [sectionResult] = await connection.query(
              `INSERT INTO cpd_topic_sections (topic_id, section_title, section_order, created_at, updated_at)
               VALUES (?, ?, ?, NOW(), NOW())`,
              [topicId, sanitize(section.title.trim()), i]
            );
            sectionFileMap.set(i, sectionResult.insertId);
            console.log(`[CPD] Created section "${section.title}" with ID ${sectionResult.insertId}`);
          }
        }
      }

      // Helper function to process a file
      async function processFile(connection, topicId, file, sectionId, fileErrors) {
        try {
          if (!file.path) {
            throw new Error(`File ${file.originalname} missing Cloudinary path`);
          }

          await connection.query(
            `INSERT INTO cpd_topic_files (topic_id, section_id, file_name, file_path, file_type, file_size, uploaded_at)
             VALUES (?, ?, ?, ?, ?, ?, NOW())`,
            [
              topicId, 
              sectionId, 
              file.originalname, 
              file.path, 
              file.mimetype || 'application/pdf', 
              file.size || 0
            ]
          );
          console.log(`[CPD] Added file "${file.originalname}" ${sectionId ? `to section ${sectionId}` : 'without section'}`);
        } catch (fileError) {
          console.error(`[CPD] Error processing file ${file.originalname}:`, fileError);
          fileErrors.push({
            fileName: file.originalname,
            error: fileError.message
          });
        }
      }

      // Process files
      if (req.files && req.files.length > 0) {
        console.log('[CPD] Processing', req.files.length, 'files...');
        console.log('[CPD] File fieldnames:', req.files.map(f => f.fieldname));
        
        const fileErrors = [];
        const processedFiles = new Set(); // Track processed files by index
        
        // First, process section files
        for (let sectionIndex = 0; sectionIndex < sectionsData.length; sectionIndex++) {
          const sectionId = sectionFileMap.get(sectionIndex);
          if (!sectionId) continue;
          
          // Find all files for this section (fieldname like "section_0_files", "section_1_files", etc.)
          const sectionFieldName = `section_${sectionIndex}_files`;
          for (let fileIndex = 0; fileIndex < req.files.length; fileIndex++) {
            const file = req.files[fileIndex];
            if (file.fieldname === sectionFieldName && !processedFiles.has(fileIndex)) {
              await processFile(connection, topicId, file, sectionId, fileErrors);
              processedFiles.add(fileIndex);
            }
          }
        }
        
        // Process general files (without section) - files not already processed
        for (let fileIndex = 0; fileIndex < req.files.length; fileIndex++) {
          const file = req.files[fileIndex];
          if (!processedFiles.has(fileIndex) && (file.fieldname === 'files' || !file.fieldname || !file.fieldname.startsWith('section_'))) {
            await processFile(connection, topicId, file, null, fileErrors);
            processedFiles.add(fileIndex);
          }
        }

        if (fileErrors.length > 0) {
          console.warn(`[CPD] ${fileErrors.length} file(s) failed to process:`, fileErrors);
        }
      }

      // Re-sequence all topics to ensure topic_number matches order_index + 1
      // This fixes issues when topics are deleted and recreated
      const [allTopics] = await connection.query(
        `SELECT id, order_index FROM cpd_topics WHERE course_id = ? ORDER BY order_index`,
        [courseId]
      );
      
      for (let i = 0; i < allTopics.length; i++) {
        const topic = allTopics[i];
        const expectedTopicNumber = i + 1; // order_index is 0-based, topic_number is 1-based
        await connection.query(
          `UPDATE cpd_topics SET topic_number = ? WHERE id = ?`,
          [expectedTopicNumber, topic.id]
        );
      }
      
      console.log(`[CPD] Re-sequenced ${allTopics.length} topics for course ${courseId}`);

      await connection.commit();

      await invalidateCache(CPD_CACHE_KEY);
      
      // Log topic creation - capture user info before async logging
      const userId = req.user?.id || null;
      const userRoleId = req.user?.role_id || null;
      const { logSystemEvent, getRoleName } = require('../utils/eventLogger');
      const userRole = userRoleId ? getRoleName(userRoleId) : null;
      const roleLabel = userRole ? userRole.charAt(0).toUpperCase() + userRole.slice(1) : 'User';
      
      setImmediate(async () => {
        await logSystemEvent({
          userId: userId,
          role: userRole,
          action: 'cpd_topic_created',
          description: `${roleLabel} created CPD topic ${title} (ID: ${topicId}) for course ${courseId}`,
          req
        });
      });
      
      res.json({
        success: true,
        message: 'Topic added successfully',
        topicId,
        filesProcessed: req.files ? req.files.length : 0
      });
    } catch (error) {
      // Rollback transaction on error
      if (connection && !connection._released) {
        await connection.rollback();
        connection.release();
      }
      
      console.error('[CPD] Error adding CPD topic:', error);
      console.error('[CPD] Error stack:', error.stack);
      res.status(500).json({
        success: false,
        message: 'Failed to add topic',
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
});

// =====================================================
// IMPORT CPD QUIZ FROM GIFT FORMAT (inline parser)
// =====================================================
router.post('/topics/:topicId/quizzes/import-gift', auth, async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const { topicId } = req.params;
    const { gift, title, quiz_type, passing_score } = req.body;

    if (process.env.NODE_ENV === 'development') {
      console.log('=== CPD GIFT Import Started ===');
      console.log('Topic ID:', topicId);
      console.log('Quiz Type:', quiz_type);
      console.log('Passing Score:', passing_score);
    }

    if (!['practice', 'final'].includes(quiz_type)) {
      return res.status(400).json({
        success: false,
        message: 'Quiz type must be either "practice" or "final"'
      });
    }

    const [existing] = await connection.query(
      `SELECT id FROM cpd_quizzes WHERE topic_id = ? AND quiz_type = ?`,
      [topicId, quiz_type]
    );

    if (existing.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `A ${quiz_type} quiz already exists for this topic`
      });
    }

    const [quizResult] = await connection.query(
      `INSERT INTO cpd_quizzes (topic_id, title, quiz_type, time_limit, passing_score, created_at, updated_at)
       VALUES (?, ?, ?, NULL, ?, NOW(), NOW())`,
      [topicId, title, quiz_type, passing_score]
    );

    const quizId = quizResult.insertId;

    const questions = parseGiftFormat(gift);
    if (process.env.NODE_ENV === 'development') {
      console.log('Parsed questions:', questions.length);
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];

      const [questionResult] = await connection.query(
        `INSERT INTO cpd_quiz_questions (quiz_id, question_text, question_type, order_index, created_at)
         VALUES (?, ?, 'multiple_choice', ?, NOW())`,
        [quizId, q.question, i]
      );

      const questionId = questionResult.insertId;

      for (let j = 0; j < q.options.length; j++) {
        const isCorrect = String.fromCharCode(65 + j) === q.correctAnswer ? 1 : 0;
        await connection.query(
          `INSERT INTO cpd_quiz_options (question_id, option_text, is_correct, order_index)
           VALUES (?, ?, ?, ?)`,
          [questionId, q.options[j], isCorrect, j]
        );
      }
    }

    await connection.commit();

    // Log quiz creation - capture user info before async logging
    const logUserId = req.user?.id || null;
    const logUserRoleId = req.user?.role_id || null;
    const { getRoleName } = require('../utils/eventLogger');
    const logUserRole = logUserRoleId ? getRoleName(logUserRoleId) : null;
    const logRoleLabel = logUserRole ? logUserRole.charAt(0).toUpperCase() + logUserRole.slice(1) : 'User';
    
    setImmediate(async () => {
      await logSystemEvent({
        userId: logUserId,
        role: logUserRole,
        action: 'cpd_quiz_created',
        description: `${logRoleLabel} created ${quiz_type} quiz "${title}" (ID: ${quizId}) for topic ${topicId} with ${questions.length} questions`,
        req
      });
    });

    await invalidateCache(CPD_CACHE_KEY);
    res.json({
      success: true,
      message: 'Quiz created successfully',
      quizId,
      questionCount: questions.length
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error importing CPD GIFT quiz:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to import quiz',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// Helper function to parse GIFT format (inline variant)
function parseGiftFormat(giftText) {
  const questions = [];
  const questionBlocks = giftText.split(/::[\s\S]*?::/g).filter((block) => block.trim());

  for (const block of questionBlocks) {
    const lines = block
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l);
    if (lines.length === 0) continue;

    const questionText = lines[0].replace(/\{$/, '').trim();
    const options = [];
    let correctAnswer = 'A';

    for (const line of lines.slice(1)) {
      if (line.startsWith('=')) {
        correctAnswer = String.fromCharCode(65 + options.length);
        options.push(line.substring(1).replace(/[{}]/g, '').trim());
      } else if (line.startsWith('~')) {
        options.push(line.substring(1).replace(/[{}]/g, '').trim());
      }
    }

    while (options.length < 4) {
      options.push('(No option)');
    }

    if (questionText && options.length >= 2) {
      questions.push({
        question: questionText,
        options: options.slice(0, 4),
        correctAnswer
      });
    }
  }

  return questions;
}

// =====================================================
// CREATE CPD QUIZ (OLD METHOD - BACKWARD COMPATIBILITY)
// =====================================================
router.post('/topics/:topicId/quizzes', auth, async (req, res) => {
  try {
    const { topicId } = req.params;
    const { title, quiz_type, time_limit, passing_score } = req.body;

    if (!['practice', 'final'].includes(quiz_type)) {
      return res.status(400).json({
        success: false,
        message: 'Quiz type must be either "practice" or "final"'
      });
    }

    const [existing] = await pool.query(
      `SELECT id FROM cpd_quizzes WHERE topic_id = ? AND quiz_type = ?`,
      [topicId, quiz_type]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `A ${quiz_type} quiz already exists for this topic`
      });
    }

    const [result] = await pool.query(
      `INSERT INTO cpd_quizzes (topic_id, title, quiz_type, time_limit, passing_score, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [topicId, title, quiz_type, time_limit, passing_score || null]
    );

    await invalidateCache(CPD_CACHE_KEY);
    
    // Log quiz creation - capture user info before async logging
    const logUserId = req.user?.id || null;
    const logUserRoleId = req.user?.role_id || null;
    const { getRoleName } = require('../utils/eventLogger');
    const logUserRole = logUserRoleId ? getRoleName(logUserRoleId) : null;
    const logRoleLabel = logUserRole ? logUserRole.charAt(0).toUpperCase() + logUserRole.slice(1) : 'User';
    
    setImmediate(async () => {
      await logSystemEvent({
        userId: logUserId,
        role: logUserRole,
        action: 'cpd_quiz_created',
        description: `${logRoleLabel} created ${quiz_type} quiz "${title}" for topic ${topicId}`,
        req
      });
    });
    
    res.json({
      success: true,
      message: 'Quiz created successfully',
      quizId: result.insertId
    });
  } catch (error) {
    console.error('Error creating CPD quiz:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create quiz',
      error: error.message
    });
  }
});

// =====================================================
// ADD QUIZ QUESTION (NEW STRUCTURE: OPTIONS TABLE)
// =====================================================
router.post('/quizzes/:quizId/questions', async (req, res) => {
  try {
    const { quizId } = req.params;
    const { question_text, question_type, points, options, correct_answer } = req.body;

    console.log('[CPD] Adding question to quiz:', quizId);

    const [result] = await pool.query(
      `INSERT INTO cpd_quiz_questions (quiz_id, question_text, question_type, points, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [quizId, question_text, question_type, points]
    );

    const questionId = result.insertId;

    for (let i = 0; i < options.length; i++) {
      const text = (options[i] || '').trim();
      if (!text) continue;

      await pool.query(
        `INSERT INTO cpd_quiz_options (question_id, option_text, is_correct, order_index)
         VALUES (?, ?, ?, ?)`,
        [questionId, text, i === Number(correct_answer) ? 1 : 0, i]
      );
    }

    await invalidateCache(CPD_CACHE_KEY);
    res.json({
      success: true,
      message: 'Question added successfully',
      questionId
    });
  } catch (error) {
    console.error('[CPD] Error adding question:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add question',
      error: error.message
    });
  }
});

// =====================================================
// DOWNLOAD FILE WITH PROPER FILENAME
// =====================================================
router.get('/download-file', cacheMiddleware(300), async (req, res) => {
  try {
    const { url, filename } = req.query;

    if (!url || !filename) {
      return res.status(400).json({ success: false, message: 'URL and filename required' });
    }

    console.log('[CPD] Downloading file:', filename);

    streamRemoteFile(
      url,
      (response, resObj) => {
        resObj.setHeader(
          'Content-Type',
          response.headers['content-type'] || 'application/octet-stream'
        );
        resObj.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      },
      res,
      'file'
    );
  } catch (error) {
    console.error('[CPD] Error:', error.message);
    res.status(500).json({ success: false, message: 'Error downloading file' });
  }
});

// =====================================================
// PROXY PDF FOR VIEWING (handles CORS and auth)
// =====================================================
router.get('/proxy-pdf', cacheMiddleware(300), async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ success: false, message: 'URL parameter required' });
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[CPD] Proxying PDF:', url);
    }

    streamRemoteFile(
      url,
      (response, resObj) => {
        resObj.setHeader('Content-Type', 'application/pdf');
        resObj.setHeader('Content-Disposition', 'inline');
        resObj.setHeader('Cache-Control', 'public, max-age=31536000');
        resObj.setHeader('Access-Control-Allow-Origin', '*');
      },
      res,
      'PDF from storage'
    );
  } catch (error) {
    console.error('[CPD] Error proxying PDF:', error.message);
    res.status(500).json({ success: false, message: 'Error loading PDF' });
  }
});

// =====================================================
// DELETE CPD FILE
// =====================================================
router.delete('/files/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;

    const [fileRows] = await pool.query(
      'SELECT file_path FROM cpd_topic_files WHERE id = ?',
      [fileId]
    );

    if (!fileRows.length) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    await pool.query('DELETE FROM cpd_topic_files WHERE id = ?', [fileId]);

    // Optional Cloudinary delete goes here (if needed)

    await invalidateCache(CPD_CACHE_KEY);
    res.json({ success: true, message: 'File deleted successfully' });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ success: false, message: 'Error deleting file' });
  }
});

// =====================================================
// DELETE CPD QUIZ (single, cleaned implementation)
// =====================================================
router.delete('/quizzes/:quizId', async (req, res) => {
  try {
    const { quizId } = req.params;

    console.log('[CPD] Deleting quiz:', quizId);

    // Delete quiz options
    await pool.query(
      `DELETE FROM cpd_quiz_options 
       WHERE question_id IN (SELECT id FROM cpd_quiz_questions WHERE quiz_id = ?)`,
      [quizId]
    );

    // Delete quiz questions
    await pool.query(`DELETE FROM cpd_quiz_questions WHERE quiz_id = ?`, [quizId]);

    // Delete quiz attempts
    await pool.query(`DELETE FROM cpd_quiz_attempts WHERE quiz_id = ?`, [quizId]);

    // Delete quiz
    await pool.query(`DELETE FROM cpd_quizzes WHERE id = ?`, [quizId]);

    await invalidateCache(CPD_CACHE_KEY);
    
    // Log quiz deletion
    setImmediate(async () => {
      await logSystemEvent({
        userId: req.user?.id || null,
        action: 'cpd_quiz_deleted',
        description: `Quiz deleted: ID ${quizId}`,
        req
      });
    });
    
    res.json({
      success: true,
      message: 'Quiz deleted successfully'
    });
  } catch (error) {
    console.error('[CPD] Error deleting quiz:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete quiz',
      error: error.message
    });
  }
});

// =====================================================
// GET QUIZ WITH QUESTIONS FOR TAKING
// =====================================================
router.get('/quizzes/:quizId', cacheMiddleware(300), async (req, res) => {
  try {
    const { quizId } = req.params;
    
    // Validate quizId
    if (!quizId || isNaN(parseInt(quizId))) {
      return res.status(400).json({ success: false, message: 'Invalid quiz ID' });
    }

    const [quizRows] = await pool.query(
      `SELECT q.id, q.title, q.quiz_type, q.passing_score, q.topic_id, t.title as topic_title
       FROM cpd_quizzes q
       JOIN cpd_topics t ON q.topic_id = t.id
       WHERE q.id = ?`,
      [quizId]
    );

    if (!quizRows || !quizRows.length) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    const quiz = quizRows[0];

    // Optimized: Get all questions and options in 2 queries instead of N+1
    const [questions] = await pool.query(
      `SELECT id, question_text, question_type, order_index
       FROM cpd_quiz_questions
       WHERE quiz_id = ?
       ORDER BY order_index ASC`,
      [quizId]
    );

    // Ensure questions is an array
    const questionsArray = Array.isArray(questions) ? questions : [];

    // Get all options in one query instead of per-question
    if (questionsArray.length > 0) {
      const questionIds = questionsArray.map(q => q.id);
      const [allOptions] = await pool.query(
        `SELECT id, question_id, option_text, order_index, is_correct
         FROM cpd_quiz_options
         WHERE question_id IN (${questionIds.map(() => '?').join(',')})
         ORDER BY question_id, order_index ASC`,
        questionIds
      );

      // Group options by question_id
      const optionsByQuestion = new Map();
      (Array.isArray(allOptions) ? allOptions : []).forEach(option => {
        if (!optionsByQuestion.has(option.question_id)) {
          optionsByQuestion.set(option.question_id, []);
        }
        optionsByQuestion.get(option.question_id).push(option);
      });

      // Attach options to questions
      questionsArray.forEach(question => {
        question.options = optionsByQuestion.get(question.id) || [];
      });
    }

    res.json({
      success: true,
      quiz,
      questions: questionsArray
    });
  } catch (error) {
    console.error('[CPD] Error fetching quiz:', error);
    console.error('[CPD] Error stack:', error.stack);
    res.status(500).json({ 
      success: false, 
      message: 'Error loading quiz',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// =====================================================
// SUBMIT QUIZ ATTEMPT
// =====================================================
router.post('/quizzes/:quizId/submit', async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const { quizId } = req.params;
    const { student_id, answers } = req.body;

    const [quizRows] = await connection.query(
      `SELECT q.*, t.course_id, t.id as topic_id, t.topic_number
       FROM cpd_quizzes q
       JOIN cpd_topics t ON q.topic_id = t.id
       WHERE q.id = ?`,
      [quizId]
    );

    if (!quizRows.length) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    const quiz = quizRows[0];

    const [questions] = await connection.query(
      `SELECT q.id as question_id, o.id as correct_option_id
       FROM cpd_quiz_questions q
       JOIN cpd_quiz_options o ON o.question_id = q.id AND o.is_correct = 1
       WHERE q.quiz_id = ?
       ORDER BY q.order_index`,
      [quizId]
    );

    let correctAnswers = 0;
    const answersObj = typeof answers === 'string' ? JSON.parse(answers) : answers || {};

    questions.forEach((q) => {
      const studentAnswer = parseInt(answersObj[q.question_id], 10);
      if (studentAnswer === q.correct_option_id) {
        correctAnswers++;
      }
    });

    const totalQuestions = questions.length;
    const score = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
    const isPassed = quiz.passing_score ? score >= quiz.passing_score : true;

    // Store the attempt with student answers (as JSON)
    const [attemptResult] = await connection.query(
      `INSERT INTO cpd_quiz_attempts (student_id, quiz_id, score, total_points, percentage, status, student_answers, started_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [student_id, quizId, correctAnswers, totalQuestions, score, isPassed ? 'passed' : 'failed', JSON.stringify(answersObj)]
    );

    if (quiz.quiz_type === 'final') {
      if (isPassed) {
        await connection.query(
          `INSERT INTO cpd_progress (student_id, course_id, topic_id, is_unlocked, final_quiz_attempted, final_quiz_passed, final_quiz_score, updated_at)
           VALUES (?, ?, ?, 1, 1, 1, ?, NOW())
           ON DUPLICATE KEY UPDATE 
             final_quiz_attempted = final_quiz_attempted + 1,
             final_quiz_passed = 1, 
             final_quiz_score = ?, 
             updated_at = NOW()`,
          [student_id, quiz.course_id, quiz.topic_id, score, score]
        );

        // Get current topic's order_index to find next topic
        const [currentTopic] = await connection.query(
          `SELECT id, order_index, topic_number, title FROM cpd_topics WHERE id = ?`,
          [quiz.topic_id]
        );
        
        if (!currentTopic.length) {
          console.error('[CPD Quiz] Current topic not found:', quiz.topic_id);
        } else {
          const currentOrderIndex = currentTopic[0]?.order_index ?? 0;
          console.log(`[CPD Quiz] Topic ${quiz.topic_id} (${currentTopic[0].title}) passed. Current order_index: ${currentOrderIndex}. Unlocking next topic...`);
          
          // Find next topic by order_index (sequential order), not topic_number
          // This ensures deleted/recreated topics don't break the unlock sequence
          const [nextTopic] = await connection.query(
            `SELECT id, order_index, topic_number, title FROM cpd_topics WHERE course_id = ? AND order_index > ? ORDER BY order_index LIMIT 1`,
            [quiz.course_id, currentOrderIndex]
          );

          if (nextTopic.length > 0) {
            console.log(`[CPD Quiz] Found next topic: ${nextTopic[0].id} (${nextTopic[0].title}), order_index: ${nextTopic[0].order_index}. Unlocking for student ${student_id}...`);
            
            const [unlockResult] = await connection.query(
              `INSERT INTO cpd_progress (student_id, course_id, topic_id, is_unlocked, created_at, updated_at)
               VALUES (?, ?, ?, 1, NOW(), NOW())
               ON DUPLICATE KEY UPDATE is_unlocked = 1, updated_at = NOW()`,
              [student_id, quiz.course_id, nextTopic[0].id]
            );
            
            console.log(`[CPD Quiz] ✅ Unlocked topic ${nextTopic[0].id} for student ${student_id}. Result:`, unlockResult);
          } else {
            console.log(`[CPD Quiz] ⚠️ No next topic found for course ${quiz.course_id} after order_index ${currentOrderIndex}`);
          }
        }
      } else {
        await connection.query(
          `INSERT INTO cpd_progress (student_id, course_id, topic_id, is_unlocked, final_quiz_attempted, final_quiz_passed, final_quiz_score, updated_at)
           VALUES (?, ?, ?, 1, 1, 0, ?, NOW())
           ON DUPLICATE KEY UPDATE 
             final_quiz_attempted = final_quiz_attempted + 1,
             final_quiz_score = ?, 
             updated_at = NOW()`,
          [student_id, quiz.course_id, quiz.topic_id, score, score]
        );
      }
    }

    if (quiz.quiz_type === 'practice') {
      await connection.query(
        `INSERT INTO cpd_progress (student_id, course_id, topic_id, is_unlocked, practice_quiz_attempted, practice_quiz_best_score, updated_at)
         VALUES (?, ?, ?, 1, 1, ?, NOW())
         ON DUPLICATE KEY UPDATE 
           practice_quiz_attempted = practice_quiz_attempted + 1, 
           practice_quiz_best_score = GREATEST(COALESCE(practice_quiz_best_score, 0), ?),
           updated_at = NOW()`,
        [student_id, quiz.course_id, quiz.topic_id, score, score]
      );
    }

    await connection.commit();

    // Invalidate all relevant caches
    // Note: Cache keys include query string, so we need to match the pattern correctly
    await invalidateCache(CPD_CACHE_KEY);
    await invalidateCache(`cache:/api/cpd/${quiz.course_id}/student/${student_id}*`);
    await invalidateCache(`cache:/api/student/${student_id}/cpd-courses*`);
    await invalidateCache(`cache:/api/cpd/${quiz.course_id}*`); // Invalidate all course-related caches
    
    // Log quiz submission
    setImmediate(async () => {
      await logSystemEvent({
        userId: student_id,
        action: 'cpd_quiz_submitted',
        description: `Student ${student_id} submitted quiz ${quizId}: Score ${score}% - ${isPassed ? 'PASSED' : 'FAILED'}`,
        req
      });
    });
    
    res.json({
      success: true,
      message: isPassed ? 'Quiz passed!' : 'Quiz failed. Try again.',
      attemptId: attemptResult.insertId,
      score,
      passed: isPassed,
      correctAnswers,
      totalQuestions
    });
  } catch (error) {
    await connection.rollback();
    console.error('[CPD Quiz Submit] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit quiz',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// =====================================================
// GET LATEST QUIZ ATTEMPT WITH DETAILS (for student)
// =====================================================
router.get('/quizzes/:quizId/latest-attempt/:studentId', async (req, res) => {
  try {
    const { quizId, studentId } = req.params;

    // Get the latest attempt
    const [attempts] = await pool.query(
      `SELECT * FROM cpd_quiz_attempts 
       WHERE quiz_id = ? AND student_id = ? 
       ORDER BY completed_at DESC 
       LIMIT 1`,
      [quizId, studentId]
    );

    if (!attempts.length) {
      return res.status(404).json({ 
        success: false, 
        message: 'No attempt found' 
      });
    }

    const attempt = attempts[0];
    
    // Parse student_answers safely (could be JSON string, object, or null)
    let studentAnswers = {};
    if (attempt.student_answers) {
      try {
        // If it's already an object, use it directly
        if (typeof attempt.student_answers === 'object') {
          studentAnswers = attempt.student_answers;
        } else if (typeof attempt.student_answers === 'string') {
          // Parse if it's a string
          studentAnswers = JSON.parse(attempt.student_answers);
        }
      } catch (e) {
        console.error('[CPD] Failed to parse student_answers:', e);
        studentAnswers = {};
      }
    }

    // Get quiz details with questions and options
    const [quiz] = await pool.query(
      `SELECT q.*, t.title as topic_title
       FROM cpd_quizzes q
       JOIN cpd_topics t ON q.topic_id = t.id
       WHERE q.id = ?`,
      [quizId]
    );

    if (!quiz.length) {
      return res.status(404).json({ 
        success: false, 
        message: 'Quiz not found' 
      });
    }

    // Get all questions with options
    const [questions] = await pool.query(
      `SELECT q.id, q.question_text, q.question_type, q.order_index
       FROM cpd_quiz_questions q
       WHERE q.quiz_id = ?
       ORDER BY q.order_index`,
      [quizId]
    );

    // Get all options for these questions
    const [options] = await pool.query(
      `SELECT o.id, o.question_id, o.option_text, o.is_correct, o.order_index
       FROM cpd_quiz_options o
       JOIN cpd_quiz_questions q ON o.question_id = q.id
       WHERE q.quiz_id = ?
       ORDER BY o.order_index`,
      [quizId]
    );

    // Group options by question
    const questionsWithOptions = questions.map(q => ({
      ...q,
      options: options.filter(o => o.question_id === q.id),
      student_answer: studentAnswers[q.id] ? parseInt(studentAnswers[q.id]) : null,
      correct_option_id: options.find(o => o.question_id === q.id && o.is_correct === 1)?.id || null
    }));

    res.json({
      success: true,
      attempt: {
        id: attempt.id,
        score: attempt.score,
        total_points: attempt.total_points,
        percentage: attempt.percentage,
        status: attempt.status,
        completed_at: attempt.completed_at,
        has_answers: Object.keys(studentAnswers).length > 0
      },
      quiz: quiz[0],
      questions: questionsWithOptions
    });

  } catch (error) {
    console.error('[CPD] Error fetching quiz attempt:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch quiz attempt',
      error: error.message
    });
  }
});

// =====================================================
// GET QUIZ ATTEMPTS FOR TUTOR (FINAL quizzes only)
// =====================================================
router.get('/quiz-attempts/tutor/:tutorId', cacheMiddleware(60), async (req, res) => {
  try {
    const { tutorId } = req.params;
    console.log('[CPD] Fetching quiz attempts for tutor:', tutorId);

    const [attempts] = await pool.query(
      `SELECT 
        qa.id as attempt_id,
        qa.quiz_id,
        qa.student_id,
        qa.score,
        qa.percentage,
        qa.status,
        qa.started_at,
        qa.completed_at,
        u.name as student_name,
        u.email as student_email,
        q.title as quiz_title,
        q.quiz_type,
        q.passing_score,
        t.title as topic_title,
        t.topic_number,
        c.id as course_id,
        c.title as course_title,
        creator.name as course_creator
      FROM cpd_quiz_attempts qa
      JOIN cpd_quizzes q ON qa.quiz_id = q.id
      JOIN cpd_topics t ON q.topic_id = t.id
      JOIN courses c ON t.course_id = c.id
      JOIN users u ON qa.student_id = u.id
      JOIN users creator ON c.created_by = creator.id
      WHERE q.quiz_type = 'final'
      ORDER BY qa.completed_at DESC
      LIMIT 200`
    );

    console.log('[CPD] Found FINAL quiz attempts:', attempts.length);

    // Log tutor viewing quiz attempts - capture user info before async logging
    const userId = req.user?.id || tutorId || null;
    const userRoleId = req.user?.role_id || null;
    const { getRoleName } = require('../utils/eventLogger');
    const userRole = userRoleId ? getRoleName(userRoleId) : (tutorId ? 'assessor' : null);
    const roleLabel = userRole ? userRole.charAt(0).toUpperCase() + userRole.slice(1) : 'User';
    
    setImmediate(async () => {
      await logSystemEvent({
        userId: userId,
        role: userRole,
        action: 'cpd_quiz_attempts_viewed',
        description: `${roleLabel} ${tutorId} viewed ${attempts.length} quiz attempts`,
        req
      });
    });

    res.json({
      success: true,
      attempts
    });
  } catch (error) {
    console.error('[CPD] Error fetching quiz attempts for tutor:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching quiz attempts',
      error: error.message
    });
  }
});

// =====================================================
// CLAIM CPD CERTIFICATE
// =====================================================
router.post('/:courseId/claim-certificate/:studentId', async (req, res) => {
  try {
    const { courseId, studentId } = req.params;

    const [topics] = await pool.query(
      `SELECT t.id FROM cpd_topics t
       WHERE t.course_id = ?`,
      [courseId]
    );

    const [progress] = await pool.query(
      `SELECT * FROM cpd_progress
       WHERE student_id = ? AND course_id = ? AND final_quiz_passed = 1`,
      [studentId, courseId]
    );

    if (progress.length !== topics.length) {
      return res.status(400).json({
        success: false,
        message: 'You must pass all final quizzes before claiming certificate'
      });
    }

    const [existing] = await pool.query(
      `SELECT * FROM cpd_certificates WHERE student_id = ? AND course_id = ?`,
      [studentId, courseId]
    );

    if (existing.length > 0) {
      return res.json({
        success: true,
        message: 'Certificate already issued',
        certificate: existing[0]
      });
    }

    const certificateNumber = `CPD-${courseId}-${studentId}-${Date.now()}`;

    const [result] = await pool.query(
      `INSERT INTO cpd_certificates (student_id, course_id, certificate_number, issued_at)
       VALUES (?, ?, ?, NOW())`,
      [studentId, courseId, certificateNumber]
    );

    const [certificate] = await pool.query(
      `SELECT * FROM cpd_certificates WHERE id = ?`,
      [result.insertId]
    );

    // Log certificate claim
    setImmediate(async () => {
      await logSystemEvent({
        userId: parseInt(studentId),
        action: 'cpd_certificate_claimed',
        description: `Student ${studentId} claimed certificate for CPD course ${courseId} (Certificate: ${certificateNumber})`,
        req
      });
    });

    res.json({
      success: true,
      message: 'Certificate claimed successfully',
      certificate: certificate[0]
    });
  } catch (error) {
    console.error('Error claiming certificate:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to claim certificate',
      error: error.message
    });
  }
});

// =====================================================
// UPDATE TOPIC DEADLINE
// =====================================================
router.put('/topics/:topicId/deadline', async (req, res) => {
  try {
    const { topicId } = req.params;
    const { deadline } = req.body;

    console.log('[CPD] Updating deadline for topic:', topicId, 'New deadline:', deadline);

    await pool.query(`UPDATE cpd_topics SET deadline = ? WHERE id = ?`, [deadline, topicId]);

    await invalidateCache(CPD_CACHE_KEY);
    res.json({
      success: true,
      message: 'Deadline updated successfully'
    });
  } catch (error) {
    console.error('[CPD] Error updating deadline:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update deadline',
      error: error.message
    });
  }
});

// =====================================================
// REORDER TOPICS (Must be BEFORE the generic :topicId route)
// =====================================================
router.put('/topics/reorder', auth, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { course_id, topics } = req.body;

    console.log('[CPD] Reordering topics for course:', course_id);
    console.log('[CPD] New order:', topics);

    // Update order_index for each topic
    for (const topic of topics) {
      await connection.execute(
        'UPDATE cpd_topics SET order_index = ? WHERE id = ? AND course_id = ?',
        [topic.order_index, topic.id, course_id]
      );
    }

    await connection.commit();

    console.log('[CPD] Topics reordered successfully');

    // Invalidate cache for this course
    await invalidateCache(CPD_CACHE_KEY);

    res.json({
      success: true,
      message: 'Topics reordered successfully'
    });
  } catch (error) {
    await connection.rollback();
    console.error('[CPD] Error reordering topics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reorder topics',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// =====================================================
// UPDATE TOPIC (NAME & DESCRIPTION)
// =====================================================
router.put('/topics/:topicId', async (req, res) => {
  try {
    const { topicId } = req.params;
    const { title, description } = req.body;

    console.log('[CPD] Updating topic:', topicId);

    await pool.query(
      `UPDATE cpd_topics SET title = ?, description = ? WHERE id = ?`,
      [title, description, topicId]
    );

    await invalidateCache(CPD_CACHE_KEY);
    res.json({
      success: true,
      message: 'Topic updated successfully'
    });
  } catch (error) {
    console.error('[CPD] Error updating topic:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update topic',
      error: error.message
    });
  }
});

// =====================================================
// DELETE TOPIC
// =====================================================
router.delete('/topics/:topicId', auth, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { topicId } = req.params;

    console.log('[CPD] Deleting topic:', topicId);

    // Delete student topic deadlines
    await connection.execute(
      `DELETE FROM student_topic_deadlines WHERE topic_id = ? AND topic_type = 'cpd_topic'`,
      [topicId]
    );

    // Delete student progress for this topic
    await connection.execute(
      `DELETE FROM cpd_progress WHERE topic_id = ?`,
      [topicId]
    );

    // Delete files
    await connection.execute(`DELETE FROM cpd_topic_files WHERE topic_id = ?`, [topicId]);

    // Get all quizzes for this topic
    const [quizzes] = await connection.execute(`SELECT id FROM cpd_quizzes WHERE topic_id = ?`, [topicId]);

    // Delete quiz-related data
    for (const quiz of quizzes) {
      // Delete quiz options
      await connection.execute(
        `DELETE FROM cpd_quiz_options WHERE question_id IN (SELECT id FROM cpd_quiz_questions WHERE quiz_id = ?)`,
        [quiz.id]
      );
      // Delete quiz questions
      await connection.execute(`DELETE FROM cpd_quiz_questions WHERE quiz_id = ?`, [quiz.id]);
      // Delete quiz attempts
      await connection.execute(`DELETE FROM cpd_quiz_attempts WHERE quiz_id = ?`, [quiz.id]);
    }

    // Delete quizzes
    await connection.execute(`DELETE FROM cpd_quizzes WHERE topic_id = ?`, [topicId]);
    
    // Get course_id before deleting
    const [topicToDelete] = await connection.execute(
      `SELECT course_id FROM cpd_topics WHERE id = ?`,
      [topicId]
    );
    const courseId = topicToDelete[0]?.course_id;

    // Finally delete the topic
    await connection.execute(`DELETE FROM cpd_topics WHERE id = ?`, [topicId]);

    // Re-sequence topic_numbers to match order_index (for display consistency)
    // This ensures topic_number = order_index + 1 for all remaining topics
    if (courseId) {
      const [remainingTopics] = await connection.execute(
        `SELECT id, order_index FROM cpd_topics WHERE course_id = ? ORDER BY order_index`,
        [courseId]
      );
      
      for (let i = 0; i < remainingTopics.length; i++) {
        const topic = remainingTopics[i];
        const expectedTopicNumber = topic.order_index + 1; // order_index is 0-based, topic_number is 1-based
        await connection.execute(
          `UPDATE cpd_topics SET topic_number = ? WHERE id = ?`,
          [expectedTopicNumber, topic.id]
        );
      }
    }

    await connection.commit();

    await invalidateCache(CPD_CACHE_KEY);
    
    // Log the deletion
    const userId = req.user?.id || null;
    const userRoleId = req.user?.role_id || null;
    const { getRoleName } = require('../utils/eventLogger');
    const userRole = userRoleId ? getRoleName(userRoleId) : null;
    
    setImmediate(async () => {
      await logSystemEvent({
        userId: userId,
        role: userRole,
        action: 'cpd_topic_deleted',
        description: `deleted CPD topic ${topicId}`,
        req
      });
    });

    res.json({
      success: true,
      message: 'Topic deleted successfully'
    });
  } catch (error) {
    await connection.rollback();
    console.error('[CPD] Error deleting topic:', error);
    console.error('[CPD] Error stack:', error.stack);
    console.error('[CPD] Error code:', error.code);
    console.error('[CPD] Error SQL state:', error.sqlState);
    res.status(500).json({
      success: false,
      message: 'Failed to delete topic',
      error: error.message,
      code: error.code
    });
  } finally {
    connection.release();
  }
});

// =====================================================
// UPDATE QUIZ PASSING SCORE
// =====================================================
router.put('/quizzes/:quizId/passing-score', async (req, res) => {
  try {
    const { quizId } = req.params;
    const { passing_score } = req.body;

    console.log('[CPD] Updating passing score for quiz:', quizId);

    await pool.query(`UPDATE cpd_quizzes SET passing_score = ? WHERE id = ?`, [
      passing_score,
      quizId
    ]);

    await invalidateCache(CPD_CACHE_KEY);
    res.json({
      success: true,
      message: 'Passing score updated successfully'
    });
  } catch (error) {
    console.error('[CPD] Error updating passing score:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update passing score',
      error: error.message
    });
  }
});

// =====================================================
// DELETE QUESTION
// =====================================================
router.delete('/questions/:questionId', async (req, res) => {
  try {
    const { questionId } = req.params;

    console.log('[CPD] Deleting question:', questionId);

    await pool.query(`DELETE FROM cpd_quiz_options WHERE question_id = ?`, [questionId]);
    await pool.query(`DELETE FROM cpd_quiz_questions WHERE id = ?`, [questionId]);

    await invalidateCache(CPD_CACHE_KEY);
    res.json({
      success: true,
      message: 'Question deleted successfully'
    });
  } catch (error) {
    console.error('[CPD] Error deleting question:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete question',
      error: error.message
    });
  }
});

// =====================================================
// UPLOAD MORE FILES TO TOPIC
// =====================================================
router.post('/topics/:topicId/upload-files', upload.array('files'), async (req, res) => {
  try {
    const { topicId } = req.params;
    const files = req.files || [];

    if (!files.length) {
      return res.status(400).json({
        success: false,
        message: 'No files provided'
      });
    }

    console.log('[CPD] Uploading files to topic:', topicId);
    console.log('[CPD] Files received:', files.length);

    for (const file of files) {
      const cloudinaryUrl = file.path;

      await pool.query(
        `INSERT INTO cpd_topic_files (topic_id, file_name, file_type, file_path, uploaded_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [topicId, file.originalname, file.mimetype, cloudinaryUrl]
      );
    }

    await invalidateCache(CPD_CACHE_KEY);
    
    // Log file upload
    setImmediate(async () => {
      for (const file of files) {
        await logSystemEvent({
          userId: req.user?.id || null,
          action: 'cpd_file_uploaded',
          description: `File uploaded: ${file.originalname} (${(file.size / 1024).toFixed(2)} KB) to topic ${topicId}`,
          req
        });
      }
    });
    
    res.json({
      success: true,
      message: 'Files uploaded successfully',
      filesUploaded: files.length
    });
  } catch (error) {
    console.error('[CPD] Error uploading files:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload files',
      error: error.message
    });
  }
});

// =====================================================
// REPLACE FILE
// =====================================================
router.put('/files/:fileId/replace', upload.single('file'), async (req, res) => {
  try {
    const { fileId } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No file provided'
      });
    }

    console.log('[CPD] Replacing file:', fileId);
    console.log('[CPD] New file:', file.originalname, 'URL:', file.path);

    const [oldFiles] = await pool.query(`SELECT * FROM cpd_topic_files WHERE id = ?`, [fileId]);
    const oldFile = oldFiles[0];

    if (!oldFile) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    const cloudinaryUrl = file.path;

    await pool.query(
      `UPDATE cpd_topic_files SET file_name = ?, file_type = ?, file_path = ? WHERE id = ?`,
      [file.originalname, file.mimetype, cloudinaryUrl, fileId]
    );

    await invalidateCache(CPD_CACHE_KEY);
    
    // Log file replacement
    setImmediate(async () => {
      await logSystemEvent({
        userId: req.user?.id || null,
        action: 'cpd_file_replaced',
        description: `File replaced: ${file.originalname} (${(file.size / 1024).toFixed(2)} KB) - File ID ${fileId}`,
        req
      });
    });
    
    res.json({
      success: true,
      message: 'File replaced successfully'
    });
  } catch (error) {
    console.error('[CPD] Error replacing file:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to replace file',
      error: error.message
    });
  }
});

// =====================================================
// UPDATE QUIZ (TITLE & PASSING SCORE)
// =====================================================
router.put('/quizzes/:quizId', async (req, res) => {
  try {
    const { quizId } = req.params;
    const { title, passing_score } = req.body;

    console.log('[CPD] Updating quiz:', quizId);

    await pool.query(
      `UPDATE cpd_quizzes SET title = ?, passing_score = ? WHERE id = ?`,
      [title, passing_score, quizId]
    );

    await invalidateCache(CPD_CACHE_KEY);
    
    // Log quiz update
    setImmediate(async () => {
      await logSystemEvent({
        userId: req.user?.id || null,
        action: 'cpd_quiz_updated',
        description: `Quiz updated: ID ${quizId} - Title: ${title}, Passing Score: ${passing_score}`,
        req
      });
    });
    
    res.json({
      success: true,
      message: 'Quiz updated successfully'
    });
  } catch (error) {
    console.error('[CPD] Error updating quiz:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update quiz',
      error: error.message
    });
  }
});

// =====================================================
// UPDATE QUIZ QUESTIONS (GIFT FORMAT - external parser)
// =====================================================
router.put('/quizzes/:quizId/update-gift', async (req, res) => {
  try {
    const { quizId } = req.params;
    const { gift_format } = req.body;

    console.log('[CPD] Updating quiz questions via GIFT format');
    console.log('[CPD] GIFT format length:', gift_format ? gift_format.length : 0);

    const { parseGiftFormat } = require('../utils/giftParser');
    const questions = parseGiftFormat(gift_format);

    console.log('[CPD] Parsed questions:', questions.length);

    if (!questions || !questions.length) {
      console.log('[CPD] No valid questions found');
      return res.status(400).json({
        success: false,
        message: 'No valid questions found in GIFT format. Please check your format.'
      });
    }

    await pool.query(
      `DELETE FROM cpd_quiz_options WHERE question_id IN (SELECT id FROM cpd_quiz_questions WHERE quiz_id = ?)`,
      [quizId]
    );
    await pool.query(`DELETE FROM cpd_quiz_questions WHERE quiz_id = ?`, [quizId]);

    for (const question of questions) {
      const [result] = await pool.query(
        `INSERT INTO cpd_quiz_questions (quiz_id, question_text, question_type, points, created_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [quizId, question.question_text, question.question_type, question.points]
      );

      const questionId = result.insertId;

      for (let idx = 0; idx < question.options.length; idx++) {
        const option = question.options[idx];
        await pool.query(
          `INSERT INTO cpd_quiz_options (question_id, option_text, is_correct, order_index)
           VALUES (?, ?, ?, ?)`,
          [questionId, option.text, option.is_correct ? 1 : 0, idx]
        );
      }
    }

    await invalidateCache(CPD_CACHE_KEY);
    res.json({
      success: true,
      message: 'Quiz questions updated successfully',
      questionsCount: questions.length
    });
  } catch (error) {
    console.error('[CPD] Error updating quiz questions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update quiz questions',
      error: error.message
    });
  }
});

module.exports = router;
