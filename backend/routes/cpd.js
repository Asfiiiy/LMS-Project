const express = require('express');
const router = express.Router();
const pool = require('../config/db');
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
    console.log('[CPD] Multer fileFilter - File:', file.originalname, 'MIME:', file.mimetype);
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
    const [files] = await pool.query(
      `SELECT * FROM cpd_topic_files WHERE topic_id = ?`,
      [topic.id]
    );
    topic.files = files;

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
      console.log('=== CPD Course Creation Started ===');
      console.log('Request body:', req.body);
      console.log('Files:', req.files ? Object.keys(req.files) : 'No files');

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
      console.log('[CPD] Creating course for user ID:', userId);

      // 1. Create Course
      const [courseResult] = await connection.query(
        `INSERT INTO courses (title, description, category_id, sub_category_id, course_type, status, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'cpd', 'Active', ?, NOW(), NOW())`,
        [title, description, category_id, sub_category_id || null, userId]
      );

      const courseId = courseResult.insertId;

      // 2. Create Announcement
      if (announcement_title) {
        const [announcementResult] = await connection.query(
          `INSERT INTO cpd_announcements (course_id, title, description, created_at, updated_at)
           VALUES (?, ?, ?, NOW(), NOW())`,
          [courseId, announcement_title, announcement_description]
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
          [courseId, faq_content]
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
              topic.title,
              topic.description,
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
      console.error('Error creating CPD course:', error);
      console.error('Error stack:', error.stack);
      console.error('Request body:', req.body);
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
router.post('/:courseId/topics', auth, upload.array('files', 20), async (req, res) => {
  try {
    const { courseId } = req.params;
    const { topic_number, title, description, deadline } = req.body;

    console.log('[CPD] Adding topic to course:', courseId);
    console.log('[CPD] Topic data:', { topic_number, title, description, deadline });
    console.log('[CPD] Files received:', req.files ? req.files.length : 0);

    const [maxOrder] = await pool.query(
      `SELECT MAX(order_index) as max_order FROM cpd_topics WHERE course_id = ?`,
      [courseId]
    );

    const orderIndex = (maxOrder[0].max_order || -1) + 1;
    const isLocked = orderIndex === 0 ? 0 : 1;

    const [topicResult] = await pool.query(
      `INSERT INTO cpd_topics (course_id, topic_number, title, description, deadline, order_index, is_locked, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [courseId, topic_number, title, description, deadline || null, orderIndex, isLocked]
    );

    const topicId = topicResult.insertId;

    if (req.files && req.files.length > 0) {
      console.log('[CPD] Processing', req.files.length, 'files...');
      for (const file of req.files) {
        console.log('[CPD] File details:', {
          name: file.originalname,
          path: file.path,
          mimetype: file.mimetype,
          size: file.size
        });

        await pool.query(
          `INSERT INTO cpd_topic_files (topic_id, file_name, file_path, file_type, file_size, uploaded_at)
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [topicId, file.originalname, file.path, file.mimetype, file.size]
        );
      }
    }

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
      topicId
    });
  } catch (error) {
    console.error('[CPD] Error adding CPD topic:', error);
    console.error('[CPD] Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to add topic',
      error: error.message
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

    console.log('=== CPD GIFT Import Started ===');
    console.log('Topic ID:', topicId);
    console.log('Quiz Type:', quiz_type);
    console.log('Passing Score:', passing_score);

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
    console.log('Parsed questions:', questions.length);

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

    console.log('[CPD] Proxying PDF:', url);

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

    const [quizRows] = await pool.query(
      `SELECT q.id, q.title, q.quiz_type, q.passing_score, q.topic_id, t.title as topic_title
       FROM cpd_quizzes q
       JOIN cpd_topics t ON q.topic_id = t.id
       WHERE q.id = ?`,
      [quizId]
    );

    if (!quizRows.length) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    const quiz = quizRows[0];

    const [questions] = await pool.query(
      `SELECT id, question_text, question_type, order_index
       FROM cpd_quiz_questions
       WHERE quiz_id = ?
       ORDER BY order_index ASC`,
      [quizId]
    );

    for (const question of questions) {
      const [options] = await pool.query(
        `SELECT id, option_text, order_index
         FROM cpd_quiz_options
         WHERE question_id = ?
         ORDER BY order_index ASC`,
        [question.id]
      );
      question.options = options;
    }

    res.json({
      success: true,
      quiz,
      questions
    });
  } catch (error) {
    console.error('[CPD] Error fetching quiz:', error);
    res.status(500).json({ success: false, message: 'Error loading quiz' });
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

    const [attemptResult] = await connection.query(
      `INSERT INTO cpd_quiz_attempts (student_id, quiz_id, score, total_points, percentage, status, started_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [student_id, quizId, correctAnswers, totalQuestions, score, isPassed ? 'passed' : 'failed']
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

        const [nextTopic] = await connection.query(
          `SELECT id FROM cpd_topics WHERE course_id = ? AND topic_number > ? ORDER BY topic_number LIMIT 1`,
          [quiz.course_id, quiz.topic_number]
        );

        if (nextTopic.length > 0) {
          await connection.query(
            `INSERT INTO cpd_progress (student_id, course_id, topic_id, is_unlocked, created_at, updated_at)
             VALUES (?, ?, ?, 1, NOW(), NOW())
             ON DUPLICATE KEY UPDATE is_unlocked = 1, updated_at = NOW()`,
            [student_id, quiz.course_id, nextTopic[0].id]
          );
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

    await invalidateCache(CPD_CACHE_KEY);
    
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
    const userRole = userRoleId ? getRoleName(userRoleId) : (tutorId ? 'tutor' : null);
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
router.delete('/topics/:topicId', async (req, res) => {
  try {
    const { topicId } = req.params;

    console.log('[CPD] Deleting topic:', topicId);

    await pool.query(`DELETE FROM cpd_files WHERE topic_id = ?`, [topicId]);

    const [quizzes] = await pool.query(`SELECT id FROM cpd_quizzes WHERE topic_id = ?`, [topicId]);

    for (const quiz of quizzes) {
      await pool.query(
        `DELETE FROM cpd_quiz_options WHERE question_id IN (SELECT id FROM cpd_quiz_questions WHERE quiz_id = ?)`,
        [quiz.id]
      );
      await pool.query(`DELETE FROM cpd_quiz_questions WHERE quiz_id = ?`, [quiz.id]);
      await pool.query(`DELETE FROM cpd_quiz_attempts WHERE quiz_id = ?`, [quiz.id]);
    }

    await pool.query(`DELETE FROM cpd_quizzes WHERE topic_id = ?`, [topicId]);
    await pool.query(`DELETE FROM cpd_topics WHERE id = ?`, [topicId]);

    await invalidateCache(CPD_CACHE_KEY);
    res.json({
      success: true,
      message: 'Topic deleted successfully'
    });
  } catch (error) {
    console.error('[CPD] Error deleting topic:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete topic',
      error: error.message
    });
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
