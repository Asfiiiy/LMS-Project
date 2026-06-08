/**
 * IMPORTANT DB INDEXES FOR HIGH PERFORMANCE (documentation only)
 *
 * ALTER TABLE unit_progress ADD INDEX idx_student_course (student_id, course_id);
 * ALTER TABLE unit_progress ADD INDEX idx_student_unit (student_id, unit_id);
 * ALTER TABLE units ADD INDEX idx_course_order (course_id, order_index);
 * ALTER TABLE assignments ADD INDEX idx_course_due (course_id, due_date);
 * ALTER TABLE course_assignments ADD INDEX idx_student (student_id);
 * ALTER TABLE cpd_topics ADD INDEX idx_course_order (course_id, order_index);
 */

/**
 * STEP 14 Optimization:
 * - Removed N+1 queries for unit_progress
 * - Removed N+1 queries for CPD topics/progress
 * - All student routes now use bulk SELECT queries
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // MySQL pool
const { cacheMiddleware, invalidateCache } = require('../middleware/cache');
const auth = require('../middleware/auth');
const { logSystemEvent } = require('../utils/eventLogger');

// Apply auth to all student routes
router.use(auth);

// Staff role IDs that can access any student's data (Admin, Tutor, Manager, etc.)
const STAFF_ROLE_IDS = [1, 2, 3, 5, 6, 7, 8, 9, 10, 11];
// Student role IDs (can only access own data)
const STUDENT_ROLE_IDS = [4, 12, 13];

// Ownership check for :studentId routes — students can only access own data, staff can access any
router.param('studentId', (req, res, next, studentId) => {
  const studentIdNum = parseInt(studentId, 10);
  if (isNaN(studentIdNum) || studentIdNum <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid student ID' });
  }
  const userId = req.user?.id;
  const roleId = req.user?.role_id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  if (STAFF_ROLE_IDS.includes(roleId)) {
    return next();
  }
  if (STUDENT_ROLE_IDS.includes(roleId) && userId === studentIdNum) {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Forbidden' });
});

const isTableMissing = (error) => error && error.code === 'ER_NO_SUCH_TABLE';

const isIntroUnit = (unit) => {
  if (!unit) return false;
  const orderIndex = Number(unit.order_index ?? 0);
  if (Number.isFinite(orderIndex) && orderIndex <= 0) {
    return true;
  }
  const title = String(unit.title || '').toLowerCase();
  return title.startsWith('intro') || title.includes('basic information');
};

const fetchCourseUnits = async (courseId, connection = pool) => {
  const [units] = await connection.execute(
    'SELECT id, course_id, title, content, order_index FROM units WHERE course_id = ? ORDER BY order_index, id',
    [courseId]
  );
  return units;
};

const ensureUnitProgressRecords = async (studentId, courseId, units, connection = pool) => {
  if (!units.length) {
    return new Map();
  }

  let progressRows;
  try {
    [progressRows] = await connection.execute(
      'SELECT * FROM unit_progress WHERE student_id = ? AND course_id = ?',
      [studentId, courseId]
    );
  } catch (error) {
    if (isTableMissing(error)) {
      throw Object.assign(new Error('unit_progress table not found. Please run the latest migrations.'), {
        status: 500,
        code: 'UNIT_PROGRESS_TABLE_MISSING'
      });
    }
    throw error;
  }

  const map = new Map(progressRows.map((row) => [row.unit_id, row]));
  const now = new Date();

  let firstUnlockedAssigned = false;
  const missingUnits = [];

  // First pass: determine which units need to be inserted and their unlock status
  for (let index = 0; index < units.length; index += 1) {
    const unit = units[index];
    const intro = isIntroUnit(unit);
    const shouldBeUnlocked = intro || !firstUnlockedAssigned;
    const unlockedAt = shouldBeUnlocked ? now : null;
    const unlockMethod = intro ? 'intro' : shouldBeUnlocked ? 'initial' : null;

    if (!intro && shouldBeUnlocked) {
      firstUnlockedAssigned = true;
    }

    const existing = map.get(unit.id);
    if (!existing) {
      // Collect missing units for bulk insert
      missingUnits.push({
        unit,
        shouldBeUnlocked,
        unlockedAt,
        unlockMethod
      });
    } else {
      // Handle updates for existing records
      if (shouldBeUnlocked && !existing.is_unlocked) {
        await connection.execute(
          `UPDATE unit_progress 
             SET is_unlocked = 1, unlocked_at = COALESCE(unlocked_at, ?), unlock_method = COALESCE(unlock_method, ?) 
           WHERE student_id = ? AND unit_id = ?`,
          [now, unlockMethod || existing.unlock_method, studentId, unit.id]
        );
        existing.is_unlocked = 1;
        existing.unlocked_at = existing.unlocked_at || now;
        existing.unlock_method = existing.unlock_method || unlockMethod;
      }
      map.set(unit.id, existing);
    }
  }

  // Bulk insert all missing units at once (eliminates N+1)
  if (missingUnits.length > 0) {
    const values = missingUnits.map(({ unit, shouldBeUnlocked, unlockedAt, unlockMethod }) => [
      studentId,
      courseId,
      unit.id,
      shouldBeUnlocked ? 1 : 0,
      unlockedAt,
      unlockMethod
    ]);

    await connection.query(
      `INSERT INTO unit_progress 
        (student_id, course_id, unit_id, is_unlocked, unlocked_at, unlock_method)
       VALUES ?`,
      [values]
    );

    // Update map with newly inserted records
    missingUnits.forEach(({ unit, shouldBeUnlocked, unlockedAt, unlockMethod }) => {
      map.set(unit.id, {
        student_id: studentId,
        course_id: courseId,
        unit_id: unit.id,
        is_unlocked: shouldBeUnlocked ? 1 : 0,
        unlocked_at: unlockedAt,
        unlock_method: unlockMethod,
        unlocked_by: null,
        unlock_reason: null,
        is_completed: 0,
        completed_at: null,
        last_quiz_score: null,
        last_assignment_grade: null
      });
    });
  }

  return map;
};

const serializeUnitWithProgress = (unit, progress) => ({
  id: unit.id,
  course_id: unit.course_id,
  title: unit.title,
  content: unit.content,
  order_index: unit.order_index,
  progress: progress
    ? {
        isUnlocked: !!progress.is_unlocked,
        unlockedAt: progress.unlocked_at,
        unlockMethod: progress.unlock_method,
        unlockedBy: progress.unlocked_by,
        unlockReason: progress.unlock_reason,
        isCompleted: !!progress.is_completed,
        completedAt: progress.completed_at,
        lastQuizScore: progress.last_quiz_score,
        lastAssignmentGrade: progress.last_assignment_grade
      }
    : {
        isUnlocked: false,
        unlockedAt: null,
        unlockMethod: null,
        unlockedBy: null,
        unlockReason: null,
        isCompleted: false,
        completedAt: null,
        lastQuizScore: null,
        lastAssignmentGrade: null
      }
});

// POST /api/student/activity-log - record detailed student activity (course view, unit view, file open/close)
// Must be defined before /:studentId routes so 'activity-log' is not captured as studentId
router.post('/activity-log', async (req, res) => {
  try {
    const userId = req.user?.id;
    const roleId = req.user?.role_id;
    // Only students (role_id 4) may use this endpoint
    if (!userId || roleId !== 4) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const { action, course_id, course_name, unit_id, unit_name, file_name, opened_at, closed_at, duration_seconds } = req.body || {};
    if (!action || typeof action !== 'string') {
      return res.status(400).json({ success: false, message: 'action is required' });
    }
    const descriptionByAction = {
      student_course_view: course_name ? `${req.user?.name || 'Student'} viewed course: ${course_name}` : 'Student viewed qualification course',
      student_unit_view: unit_name ? `${req.user?.name || 'Student'} viewed unit: ${unit_name}` : 'Student viewed unit',
      student_file_view: file_name ? `${req.user?.name || 'Student'} opened file: ${file_name}${duration_seconds != null ? ` (${duration_seconds}s)` : ''}` : 'Student opened file'
    };
    const description = descriptionByAction[action] || `${req.user?.name || 'Student'} – ${action}`;
    const extraBody = {
      course_id: course_id != null ? Number(course_id) : null,
      course_name: course_name || null,
      unit_id: unit_id != null ? Number(unit_id) : null,
      unit_name: unit_name || null,
      file_name: file_name || null,
      opened_at: opened_at || null,
      closed_at: closed_at || null,
      duration_seconds: duration_seconds != null ? Number(duration_seconds) : null
    };
    setImmediate(async () => {
      await logSystemEvent({
        userId,
        role: 'student',
        action,
        description,
        courseId: extraBody.course_id || null,
        service: 'student',
        req,
        extraBody
      });
    });
    return res.json({ success: true });
  } catch (err) {
    console.error('[Student activity-log]', err);
    return res.status(500).json({ success: false, message: 'Failed to log activity' });
  }
});

// GET /api/student/grade-notifications
// Returns recent unread assignment_graded notifications for student
// Frontend checks localStorage to skip already-shown popups
router.get('/grade-notifications', async (req, res) => {
  try {
    const studentId = req.user?.id;
    const roleId = req.user?.role_id;
    if (!studentId || !STUDENT_ROLE_IDS.includes(roleId)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const [notifications] = await pool.execute(
      `SELECT
         n.id,
         n.type,
         n.title,
         n.message,
         n.is_read,
         n.created_at,
         n.related_submission_id,
         n.related_course_id,
         qs.pass_fail_result as result,
         qs.feedback,
         qs.graded_at,
         qs.unit_id,
         u.course_id,
         u.title as unit_title,
         c.title as course_title,
         grader.name as graded_by_name
       FROM notifications n
       LEFT JOIN qual_submissions qs
         ON qs.id = n.related_submission_id
       LEFT JOIN units u ON u.id = qs.unit_id
       LEFT JOIN courses c ON c.id = u.course_id
       LEFT JOIN users grader ON grader.id = qs.graded_by
       WHERE n.user_id = ?
       AND n.type = 'assignment_graded'
       AND n.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       ORDER BY n.created_at DESC
       LIMIT 10`,
      [studentId]
    );

    const popups = notifications.map(n => ({
      notificationId: n.id,
      submissionId: n.related_submission_id,
      unitId: n.unit_id,
      courseId: n.course_id || n.related_course_id,
      unitTitle: n.unit_title || 'Assignment',
      courseTitle: n.course_title || '',
      result: n.result || 'refer',
      isPass: n.result === 'pass',
      feedback: n.feedback || '',
      gradedBy: n.graded_by_name || 'Assessor',
      gradedAt: n.graded_at,
      type: n.type
    }));

    res.json({ success: true, notifications: popups });
  } catch (err) {
    console.error('[GradeNotif]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get courses assigned to a student (excluding CPD courses which are fetched separately)
router.get('/:studentId/courses', cacheMiddleware(120), async (req, res) => {
  try {
    const { studentId } = req.params;

    const [rows] = await pool.execute(
      `SELECT 
          c.id,
          c.title,
          c.description,
          c.status,
          c.created_at,
          c.start_date,
          c.end_date,
          cat.name as category_name,
          subcat.name as sub_category_name,
          u.name as instructor_name,
          ca.status as enrollment_status,
          ca.grade as enrollment_grade
        FROM courses c
        JOIN course_assignments ca ON c.id = ca.course_id
        LEFT JOIN course_categories cat ON c.category_id = cat.id
        LEFT JOIN sub_categories subcat ON c.sub_category_id = subcat.id
        LEFT JOIN users u ON c.created_by = u.id
        WHERE ca.student_id = ? AND (c.course_type IS NULL OR (c.course_type != 'cpd' AND c.course_type != 'qualification'))
        ORDER BY c.created_at DESC`,
      [studentId]
    );

    // Log student course access
    setImmediate(async () => {
      await logSystemEvent({
        userId: studentId,
        action: 'student_course_access',
        description: `Student accessed enrolled courses list`,
        req
      });
    });

    res.json({ success: true, courses: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error fetching student courses' });
  }
});

// Get assignments available to a student (across enrolled courses)
router.get('/:studentId/assignments', cacheMiddleware(120), async (req, res) => {
  try {
    const { studentId } = req.params;

    const [rows] = await pool.execute(
      `SELECT 
          a.id,
          a.course_id,
          c.title as course_title,
          a.title as assignment_title,
          a.description,
          a.due_date,
          a.created_at,
          a.updated_at,
          s.id as submission_id,
          s.file_path,
          s.submitted_at,
          s.grade,
          s.feedback
        FROM assignments a
        JOIN course_assignments ca ON a.course_id = ca.course_id
        JOIN courses c ON a.course_id = c.id
        LEFT JOIN assignment_submissions s ON s.assignment_id = a.id AND s.student_id = ?
        WHERE ca.student_id = ?
        ORDER BY a.due_date IS NULL, a.due_date ASC, a.created_at DESC`,
      [studentId, studentId]
    );

    res.json({ success: true, assignments: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error fetching student assignments' });
  }
});

// Get unit lock/unlock status for a student within a course
router.get('/:studentId/courses/:courseId/units', cacheMiddleware(60), async (req, res) => {
  try {
    const studentId = Number(req.params.studentId);
    const courseId = Number(req.params.courseId);

    if (!studentId || !courseId) {
      return res.status(400).json({ success: false, message: 'Invalid student or course id' });
    }

    const units = await fetchCourseUnits(courseId);
    const progressMap = await ensureUnitProgressRecords(studentId, courseId, units);

    const payload = units.map((unit) => serializeUnitWithProgress(unit, progressMap.get(unit.id)));
    res.json({ success: true, units: payload });
  } catch (error) {
    if (error.code === 'UNIT_PROGRESS_TABLE_MISSING') {
      return res.status(500).json({ success: false, message: error.message });
    }
    console.error(error);
    res.status(500).json({ success: false, message: 'Error fetching unit progress' });
  }
});

// Get tutors for a student (based on assigned tutor or main tutors)
router.get('/:studentId/tutors', cacheMiddleware(300), async (req, res) => {
  try {
    const { studentId } = req.params;

    // Check if student has an assigned tutor
    const [studentData] = await pool.execute(
      `SELECT assigned_tutor_id FROM users WHERE id = ?`,
      [studentId]
    );

    let rows = [];

    if (studentData.length > 0 && studentData[0].assigned_tutor_id) {
      // Student has an assigned tutor - return only that tutor
      const [assignedTutor] = await pool.execute(
        `SELECT u.id, u.name, u.email
         FROM users u
         WHERE u.id = ? AND u.role_id = 2`,
        [studentData[0].assigned_tutor_id]
      );
      rows = assignedTutor;
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Student Tutors] Student ${studentId} has assigned tutor ${studentData[0].assigned_tutor_id}`);
      }
    } else {
      // No assigned tutor - return all main tutors (tutors without parent_tutor_id)
      const [mainTutors] = await pool.execute(
        `SELECT u.id, u.name, u.email
         FROM users u
         WHERE u.role_id = 2 AND (u.parent_tutor_id IS NULL OR u.parent_tutor_id = 0)
         ORDER BY u.name ASC`,
        []
      );
      rows = mainTutors;
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Student Tutors] Student ${studentId} has no assigned tutor, returning ${rows.length} main tutors`);
      }
    }

    res.json({ success: true, tutors: rows });
  } catch (err) {
    console.error('[Student Tutors] Error:', err);
    res.status(500).json({ success: false, message: 'Error fetching student tutors' });
  }
});

// Mark a unit as complete and auto-unlock the next unit
router.post('/:studentId/courses/:courseId/units/:unitId/complete', async (req, res) => {
  const studentId = Number(req.params.studentId);
  const courseId = Number(req.params.courseId);
  const unitId = Number(req.params.unitId);

  if (!studentId || !courseId || !unitId) {
    return res.status(400).json({ success: false, message: 'Invalid identifiers provided' });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [currentUnitRows] = await connection.execute(
      'SELECT id, course_id, order_index FROM units WHERE id = ? AND course_id = ? LIMIT 1',
      [unitId, courseId]
    );

    if (!currentUnitRows.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Unit not found for this course' });
    }

    // Ensure progress records exist (may insert missing entries)
    const units = await fetchCourseUnits(courseId, connection);
    await ensureUnitProgressRecords(studentId, courseId, units, connection);

    const [progressRows] = await connection.execute(
      'SELECT * FROM unit_progress WHERE student_id = ? AND unit_id = ? FOR UPDATE',
      [studentId, unitId]
    );

    if (!progressRows.length) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Progress record missing for this unit' });
    }

    const currentProgress = progressRows[0];
    if (!currentProgress.is_unlocked) {
      await connection.rollback();
      return res.status(403).json({ success: false, message: 'Unit is locked. Complete the previous unit or request unlock.' });
    }

    if (currentProgress.is_completed) {
      await connection.rollback();
      return res.status(200).json({ success: true, message: 'Unit already marked as complete' });
    }

    const completedAt = new Date();
    await connection.execute(
      'UPDATE unit_progress SET is_completed = 1, completed_at = ?, updated_at = CURRENT_TIMESTAMP WHERE student_id = ? AND unit_id = ?',
      [completedAt, studentId, unitId]
    );

    // Determine and unlock the next unit automatically
    const currentUnit = currentUnitRows[0];
    const [nextUnitRows] = await connection.execute(
      `SELECT id FROM units 
       WHERE course_id = ? AND (order_index > ? OR (order_index = ? AND id > ?))
       ORDER BY order_index, id
       LIMIT 1`,
      [courseId, currentUnit.order_index ?? 0, currentUnit.order_index ?? 0, currentUnit.id]
    );

    if (nextUnitRows.length) {
      const nextUnitId = nextUnitRows[0].id;
      const [nextProgressRows] = await connection.execute(
        'SELECT * FROM unit_progress WHERE student_id = ? AND unit_id = ? FOR UPDATE',
        [studentId, nextUnitId]
      );

      const unlockTimestamp = new Date();
      if (!nextProgressRows.length) {
        await connection.execute(
          `INSERT INTO unit_progress 
            (student_id, course_id, unit_id, is_unlocked, unlocked_at, unlock_method, is_completed) 
           VALUES (?, ?, ?, 1, ?, 'automatic', 0)`,
          [studentId, courseId, nextUnitId, unlockTimestamp]
        );
      } else if (!nextProgressRows[0].is_unlocked) {
        await connection.execute(
          `UPDATE unit_progress 
             SET is_unlocked = 1, unlocked_at = ?, unlock_method = 'automatic', unlocked_by = NULL, unlock_reason = NULL 
           WHERE student_id = ? AND unit_id = ?`,
          [unlockTimestamp, studentId, nextUnitId]
        );
      }
    }

    await connection.commit();

    await invalidateCache('cache:/api/students/*/courses/*/units*');
    await invalidateCache('cache:/api/students/*/courses*');
    await invalidateCache('cache:/api/students/*/assignments*');
    await invalidateCache('cache:/api/students/*/tutors*');
    const [progressSummary] = await pool.execute(
      'SELECT * FROM unit_progress WHERE student_id = ? AND course_id = ?',
      [studentId, courseId]
    );

    res.json({
      success: true,
      message: 'Unit marked as complete and next unit processed',
      progress: progressSummary
    });
  } catch (error) {
    await connection.rollback();
    if (error.code === 'UNIT_PROGRESS_TABLE_MISSING') {
      return res.status(500).json({ success: false, message: error.message });
    }
    console.error(error);
    res.status(500).json({ success: false, message: 'Unable to update unit progress' });
  } finally {
    connection.release();
  }
});

// Get student CPD course enrollments with topic progress and deadlines
router.get('/:studentId/cpd-courses', cacheMiddleware(60), async (req, res) => {
  try {
    const { studentId } = req.params;

    // Get all CPD courses the student is enrolled in via course_assignments
    const [enrollments] = await pool.execute(
      `SELECT 
        c.id as course_id,
        c.title as course_title,
        c.description,
        c.status as course_status,
        c.created_at,
        cat.name as category_name,
        subcat.name as sub_category_name,
        u.name as instructor_name,
        ca.created_at as enrolled_at
      FROM course_assignments ca
      JOIN courses c ON ca.course_id = c.id
      LEFT JOIN course_categories cat ON c.category_id = cat.id
      LEFT JOIN sub_categories subcat ON c.sub_category_id = subcat.id
      LEFT JOIN users u ON c.created_by = u.id
      WHERE ca.student_id = ? AND c.course_type = 'cpd'
      ORDER BY ca.created_at DESC`,
      [studentId]
    );

    // Bulk load all topics with progress for all enrolled courses (eliminates N+1)
    const courseIds = enrollments.map(e => e.course_id);
    let allTopics = [];
    
    if (courseIds.length > 0) {
      const placeholders = courseIds.map(() => '?').join(',');
      const [topicsRows] = await pool.execute(
        `SELECT 
          t.id as topic_id,
          t.course_id,
          t.title as topic_title,
          t.description as topic_description,
          t.order_index,
          COALESCE(std.deadline, t.deadline) as deadline,
          CASE WHEN std.deadline IS NOT NULL THEN 1 ELSE 0 END as has_custom_deadline,
          COALESCE(p.final_quiz_passed, 0) as is_completed,
          p.completed_at
        FROM cpd_topics t
        LEFT JOIN cpd_progress p 
          ON p.topic_id = t.id AND p.student_id = ?
        LEFT JOIN student_topic_deadlines std
          ON std.topic_id = t.id AND std.student_id = ? AND std.course_id = t.course_id
        WHERE t.course_id IN (${placeholders})
        ORDER BY t.course_id, t.order_index`,
        [studentId, studentId, ...courseIds]
      );
      allTopics = topicsRows;
    }

    // Group topics by course_id
    const topicsByCourse = {};
    allTopics.forEach(t => {
      if (!topicsByCourse[t.course_id]) {
        topicsByCourse[t.course_id] = [];
      }
      topicsByCourse[t.course_id].push(t);
    });

    // Map enrollments with their topics (no more N+1 queries)
    const coursesWithProgress = enrollments.map((course) => {
      const topics = topicsByCourse[course.course_id] || [];

      // Calculate progress
      const totalTopics = topics.length;
      const completedTopics = topics.filter(t => t.is_completed === 1).length;
      const progress = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

      // Get upcoming deadlines (topics not completed - include overdue and future)
      // Include all deadlines for incomplete topics (both overdue and upcoming)
      const upcomingDeadlines = topics
        .filter(t => t.deadline && t.is_completed !== 1)
        .map(t => ({
          topic_id: t.topic_id,
          topic_title: t.topic_title,
          deadline: t.deadline
        }));

      return {
        ...course,
        progress,
        total_topics: totalTopics,
        completed_topics: completedTopics,
        topics,
        upcoming_deadlines: upcomingDeadlines
      };
    });

    res.json({ success: true, cpdCourses: coursesWithProgress });
  } catch (err) {
    console.error('Error fetching student CPD courses:', err);
    res.status(500).json({ success: false, message: 'Error fetching student CPD courses' });
  }
});

// Get student Qualification course enrollments with unit progress and deadlines
// Get student's grades for all qualification courses
router.get('/:studentId/grades', async (req, res) => {
  try {
    const { studentId } = req.params;
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Student Grades] Fetching grades for student ${studentId}`);
    }

    const [grades] = await pool.execute(
      `SELECT 
        c.id as course_id,
        c.title as course_title,
        u.id as unit_id,
        u.title as unit_title,
        (SELECT COUNT(*) FROM units u2 WHERE u2.course_id = u.course_id AND u2.order_index < u.order_index) + 1 as unit_order,
        qs.id as submission_id,
        qs.submission_type,
        qs.grading_type,
        qs.numeric_grade,
        qs.pass_fail_result,
        qs.feedback,
        qs.submitted_at,
        qs.graded_at,
        grader.name as graded_by_name
      FROM qual_submissions qs
      JOIN units u ON qs.unit_id = u.id
      JOIN courses c ON u.course_id = c.id
      LEFT JOIN users grader ON qs.graded_by = grader.id
      WHERE qs.student_id = ? 
        AND qs.status = 'graded'
        AND c.course_type = 'qualification'
      ORDER BY c.id, u.order_index, qs.submission_type`,
      [studentId]
    );

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Student Grades] Found ${grades.length} graded submissions`);
    }

    res.json({
      success: true,
      grades: grades
    });
  } catch (error) {
    console.error('[Student Grades] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching grades',
      error: error.message
    });
  }
});

router.get('/:studentId/qualification-courses', cacheMiddleware(60), async (req, res) => {
  try {
    const { studentId } = req.params;
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Qualification Courses] Fetching courses for student ${studentId}`);
    }

    // Get all Qualification courses the student is enrolled in via course_assignments
    let enrollments = [];
    try {
      const [enrollmentRows] = await pool.execute(
        `SELECT 
          c.id as course_id,
          c.title as course_title,
          c.description,
          c.status as course_status,
          c.created_at,
          cat.name as category_name,
          subcat.name as sub_category_name,
          u.name as instructor_name,
          ca.created_at as enrolled_at
        FROM course_assignments ca
        JOIN courses c ON ca.course_id = c.id
        LEFT JOIN course_categories cat ON c.category_id = cat.id
        LEFT JOIN sub_categories subcat ON c.sub_category_id = subcat.id
        LEFT JOIN users u ON c.created_by = u.id
        WHERE ca.student_id = ? AND (c.course_type = 'qualification' OR c.course_type = 'qualifi')
        ORDER BY ca.created_at DESC`,
        [studentId]
      );
      enrollments = enrollmentRows;
    } catch (enrollmentErr) {
      console.error('[Qualification Courses] Error fetching enrollments:', enrollmentErr);
      throw enrollmentErr;
    }

    // Bulk load all units with progress and deadlines for all enrolled courses
    const courseIds = enrollments.map(e => e.course_id);
    let allUnits = [];
    
    if (courseIds.length > 0) {
      const placeholders = courseIds.map(() => '?').join(',');
      
      // Check if student_topic_deadlines table exists
      let hasStudentDeadlinesTable = false;
      try {
        const [tableCheck] = await pool.execute(
          `SELECT COUNT(*) as count FROM information_schema.tables 
           WHERE table_schema = DATABASE() AND table_name = 'student_topic_deadlines'`
        );
        hasStudentDeadlinesTable = tableCheck[0]?.count > 0;
      } catch (err) {
        console.log('[Qualification Courses] student_topic_deadlines table check failed:', err.message);
        hasStudentDeadlinesTable = false;
      }
      
      let query;
      let params;
      
      // Check if units table has deadline column
      let hasDeadlineColumn = false;
      try {
        const [columnCheck] = await pool.execute(
          `SELECT COUNT(*) as count FROM information_schema.columns 
           WHERE table_schema = DATABASE() AND table_name = 'units' AND column_name = 'deadline'`
        );
        hasDeadlineColumn = columnCheck[0]?.count > 0;
      } catch (err) {
        console.log('[Qualification Courses] deadline column check failed:', err.message);
        hasDeadlineColumn = false;
      }
      
      // Check if qual_unit_progress table exists and has is_completed / assignment_status columns
      // Qualification courses use qual_unit_progress, not unit_progress
      let hasUnitProgressTable = false;
      let unitProgressColumn = 'is_completed';
      let hasAssignmentStatusColumn = false;
      try {
        const [progressTableCheck] = await pool.execute(
          `SELECT COUNT(*) as count FROM information_schema.tables 
           WHERE table_schema = DATABASE() AND table_name = 'qual_unit_progress'`
        );
        hasUnitProgressTable = progressTableCheck[0]?.count > 0;
        
        if (hasUnitProgressTable) {
          // Check what completion column exists
          const [progressColumnCheck] = await pool.execute(
            `SELECT column_name FROM information_schema.columns 
             WHERE table_schema = DATABASE() AND table_name = 'qual_unit_progress' 
             AND column_name IN ('is_completed', 'completed')`
          );
          if (progressColumnCheck.length > 0 && progressColumnCheck[0].column_name) {
            unitProgressColumn = progressColumnCheck[0].column_name;
          } else {
            hasUnitProgressTable = false; // No completion column found
            unitProgressColumn = 'is_completed'; // Reset to default
          }
          // Check for assignment_status (used for progress bar when is_completed not set)
          const [assignColCheck] = await pool.execute(
            `SELECT 1 FROM information_schema.columns 
             WHERE table_schema = DATABASE() AND table_name = 'qual_unit_progress' AND column_name = 'assignment_status'`
          );
          hasAssignmentStatusColumn = assignColCheck.length > 0;
        }
      } catch (err) {
        console.log('[Qualification Courses] qual_unit_progress table check failed:', err.message);
        hasUnitProgressTable = false;
      }
      
      if (hasStudentDeadlinesTable && hasDeadlineColumn) {
        // Use student-specific deadlines if both tables/columns exist; include assignment_status for completion fallback
        const progressSelect = hasUnitProgressTable 
          ? `COALESCE(up.${unitProgressColumn}, 0) as is_completed, up.completed_at, up.assignment_status, up.presentation_status`
          : `0 as is_completed, NULL as completed_at, NULL as assignment_status, NULL as presentation_status`;
        const progressJoin = hasUnitProgressTable
          ? `LEFT JOIN qual_unit_progress up ON up.unit_id = u.id AND up.student_id = ?`
          : '';
        
        query = `SELECT 
          u.id as unit_id,
          u.course_id,
          u.title as unit_title,
          u.order_index,
          COALESCE(std.deadline, u.deadline) as deadline,
          CASE WHEN std.deadline IS NOT NULL THEN 1 ELSE 0 END as has_custom_deadline,
          COALESCE(std.assignment_submission_unlocked, 0) as assignment_submission_unlocked,
          std.unlocked_at as assignment_unlocked_at,
          ${progressSelect}
        FROM units u
        ${progressJoin}
        LEFT JOIN student_topic_deadlines std
          ON std.topic_id = u.id AND std.student_id = ? AND std.course_id = u.course_id AND std.topic_type = 'qualification_unit'
        WHERE u.course_id IN (${placeholders})
        ORDER BY u.course_id, u.order_index`;
        // Build params: [studentId for progress join (if exists), studentId for std join, ...courseIds]
        params = hasUnitProgressTable ? [studentId, studentId, ...courseIds] : [studentId, ...courseIds];
      } else if (hasDeadlineColumn) {
        // Use course-level deadlines only
        const progressSelect = hasUnitProgressTable 
          ? `COALESCE(up.${unitProgressColumn}, 0) as is_completed, up.completed_at, up.assignment_status, up.presentation_status`
          : `0 as is_completed, NULL as completed_at, NULL as assignment_status, NULL as presentation_status`;
        const progressJoin = hasUnitProgressTable
          ? `LEFT JOIN qual_unit_progress up ON up.unit_id = u.id AND up.student_id = ?`
          : '';
        
        query = `SELECT 
          u.id as unit_id,
          u.course_id,
          u.title as unit_title,
          u.order_index,
          u.rule_level_3_enabled,
          u.deadline,
          0 as has_custom_deadline,
          ${progressSelect}
        FROM units u
        ${progressJoin}
        WHERE u.course_id IN (${placeholders})
        ORDER BY u.course_id, u.order_index`;
        // Build params: [studentId for progress join (if exists), ...courseIds]
        params = hasUnitProgressTable ? [studentId, ...courseIds] : [...courseIds];
      } else {
        // No deadline column - return units without deadlines
        const progressSelect = hasUnitProgressTable 
          ? (hasAssignmentStatusColumn
            ? `COALESCE(up.${unitProgressColumn}, 0) as is_completed, up.completed_at, up.assignment_status, up.presentation_status`
            : `COALESCE(up.${unitProgressColumn}, 0) as is_completed, up.completed_at, NULL as assignment_status, NULL as presentation_status`)
          : `0 as is_completed, NULL as completed_at, NULL as assignment_status, NULL as presentation_status`;
        const progressJoin = hasUnitProgressTable
          ? `LEFT JOIN qual_unit_progress up ON up.unit_id = u.id AND up.student_id = ?`
          : '';
        
        query = `SELECT 
          u.id as unit_id,
          u.course_id,
          u.title as unit_title,
          u.order_index,
          u.rule_level_3_enabled,
          NULL as deadline,
          0 as has_custom_deadline,
          ${progressSelect}
        FROM units u
        ${progressJoin}
        WHERE u.course_id IN (${placeholders})
        ORDER BY u.course_id, u.order_index`;
        // Build params: [studentId for progress join (if exists), ...courseIds]
        params = hasUnitProgressTable ? [studentId, ...courseIds] : [...courseIds];
      }
      
      try {
        const [unitRows] = await pool.execute(query, params);
        allUnits = unitRows;
      } catch (queryErr) {
        throw queryErr;
      }
    }

    // Group units by course_id
    const unitsByCourse = {};
    allUnits.forEach(u => {
      if (!unitsByCourse[u.course_id]) {
        unitsByCourse[u.course_id] = [];
      }
      unitsByCourse[u.course_id].push(u);
    });

    // Fallback: get latest graded result per unit from qual_submissions (source of truth)
    // so progress shows correctly even when qual_unit_progress has no row or assignment_status not set
    const gradedByUnit = {};
    if (allUnits.length > 0 && studentId) {
      const unitIds = [...new Set(allUnits.map(u => u.unit_id))];
      const placeholders = unitIds.map(() => '?').join(',');
      try {
        const [gradedRows] = await pool.execute(
          `SELECT qs.unit_id, qs.pass_fail_result
           FROM qual_submissions qs
           INNER JOIN (
             SELECT unit_id, MAX(graded_at) as max_graded
             FROM qual_submissions
             WHERE student_id = ? AND status = 'graded' AND submission_type = 'assignment'
             GROUP BY unit_id
           ) latest ON qs.unit_id = latest.unit_id AND qs.student_id = ? AND qs.graded_at = latest.max_graded
             AND qs.status = 'graded' AND qs.submission_type = 'assignment'
           WHERE qs.unit_id IN (${placeholders})`,
          [studentId, studentId, ...unitIds]
        );
        gradedRows.forEach(r => { gradedByUnit[r.unit_id] = r.pass_fail_result; });
        if (Object.keys(gradedByUnit).length > 0) {
          console.log('[Qualification Courses] Graded submissions fallback:', Object.keys(gradedByUnit).length, 'units with graded result');
        }
      } catch (err) {
        console.error('[Qualification Courses] Error fetching graded submissions for progress:', err.message);
      }
    }
    
    // Also check for courses that have qualification_unit deadlines but might be marked as CPD
    // This handles cases where course_type might be wrong in the courses table
    if (enrollments.length === 0) {
      console.log(`[Qualification Courses] No courses found with course_type='qualification', checking student_topic_deadlines...`);
      const [coursesWithQualDeadlines] = await pool.execute(
        `SELECT DISTINCT c.id as course_id, c.title as course_title, c.description, 
                c.status as course_status, c.created_at,
                cat.name as category_name, subcat.name as sub_category_name,
                u.name as instructor_name, ca.created_at as enrolled_at
         FROM course_assignments ca
         JOIN courses c ON ca.course_id = c.id
         JOIN student_topic_deadlines std ON std.course_id = c.id AND std.student_id = ca.student_id
         LEFT JOIN course_categories cat ON c.category_id = cat.id
         LEFT JOIN sub_categories subcat ON c.sub_category_id = subcat.id
         LEFT JOIN users u ON c.created_by = u.id
         WHERE ca.student_id = ? 
           AND std.topic_type = 'qualification_unit'
         ORDER BY ca.created_at DESC`,
        [studentId]
      );
      
      console.log(`[Qualification Courses] Found ${coursesWithQualDeadlines.length} courses with qualification_unit deadlines`);
      enrollments = coursesWithQualDeadlines;
    }

    // First, fetch all student_topic_deadlines for all courses in one query
    const courseIdsForDeadlines = enrollments.map(e => e.course_id);
    let allStdDeadlines = [];
    if (courseIdsForDeadlines.length > 0) {
      const placeholders = courseIdsForDeadlines.map(() => '?').join(',');
      try {
        const [stdDeadlinesRows] = await pool.execute(
          `SELECT std.topic_id as unit_id, std.course_id, std.deadline, u.title as unit_title
           FROM student_topic_deadlines std
           LEFT JOIN units u ON std.topic_id = u.id
           WHERE std.student_id = ? 
             AND std.course_id IN (${placeholders})
             AND std.topic_type = 'qualification_unit'
           ORDER BY std.course_id, std.deadline ASC`,
          [studentId, ...courseIdsForDeadlines]
        );
        allStdDeadlines = stdDeadlinesRows;
        console.log(`[Qualification Courses] Found ${allStdDeadlines.length} qualification_unit deadlines from student_topic_deadlines`);
      } catch (stdErr) {
        console.error(`[Qualification Courses] Error fetching student_topic_deadlines:`, stdErr);
      }
    }
    
    // Group stdDeadlines by course_id
    const stdDeadlinesByCourse = {};
    allStdDeadlines.forEach(d => {
      if (!stdDeadlinesByCourse[d.course_id]) {
        stdDeadlinesByCourse[d.course_id] = [];
      }
      stdDeadlinesByCourse[d.course_id].push(d);
    });

    // Fetch Rule Level 3 settings for all courses
    const courseIdsForRule3 = enrollments.map(e => e.course_id);
    const rule3SettingsByCourse = {};
    const selectedUnitsByCourse = {};
    
    if (courseIdsForRule3.length > 0) {
      const placeholders = courseIdsForRule3.map(() => '?').join(',');
      try {
        // Fetch Rule Level 3 settings
        const [rule3Settings] = await pool.execute(
          `SELECT course_id, rule_level_3_enabled 
           FROM qual_course_content 
           WHERE course_id IN (${placeholders})`,
          courseIdsForRule3
        );
        
        rule3Settings.forEach(s => {
          rule3SettingsByCourse[s.course_id] = s.rule_level_3_enabled === 1 || s.rule_level_3_enabled === true;
        });
        
        // Fetch selected Rule Level 3 units for this student
        const [selectedUnits] = await pool.execute(
          `SELECT course_id, unit_id 
           FROM qual_student_selected_units 
           WHERE student_id = ? AND course_id IN (${placeholders})`,
          [studentId, ...courseIdsForRule3]
        );
        
        selectedUnits.forEach(su => {
          if (!selectedUnitsByCourse[su.course_id]) {
            selectedUnitsByCourse[su.course_id] = new Set();
          }
          selectedUnitsByCourse[su.course_id].add(su.unit_id);
        });
      } catch (rule3Err) {
        console.error('[Qualification Courses] Error fetching Rule Level 3 settings:', rule3Err);
      }
    }

    // Map enrollments with their units
    const coursesWithProgress = enrollments.map((course) => {
      const allUnits = unitsByCourse[course.course_id] || [];
      const rule3Enabled = rule3SettingsByCourse[course.course_id] || false;
      const selectedUnitIds = selectedUnitsByCourse[course.course_id] || new Set();

      // Filter units based on Rule Level 3
      let units = allUnits;
      if (rule3Enabled) {
        // For Rule Level 3 courses, only count:
        // 1. Non-Rule Level 3 units (required units - not optional and not Rule Level 3)
        // 2. Selected Rule Level 3 units
        units = allUnits.filter(u => {
          const isRule3Unit = u.rule_level_3_enabled === 1 || u.rule_level_3_enabled === true;
          if (isRule3Unit) {
            // Only include if student has selected this Rule Level 3 unit
            return selectedUnitIds.has(u.unit_id);
          } else {
            // Include all non-Rule Level 3 units (required units)
            return true;
          }
        });
      }

      // Calculate progress: unit completed if is_completed, assignment_status=pass, OR qual_submissions has Pass (fallback)
      const totalUnits = units.length;
      const completedUnits = units.filter(u => {
        const isCompleted = u.is_completed === 1 || u.is_completed === true || u.is_completed === '1' || String(u.is_completed).toLowerCase() === 'true';
        const assignmentPassed = u.assignment_status === 'pass';
        const submissionPassed = gradedByUnit[u.unit_id] === 'pass';
        return isCompleted || assignmentPassed || submissionPassed;
      }).length;
      
      // Debug: Log unit completion status
      if (units.length > 0) {
        console.log(`[Qualification Courses] Course "${course.course_title}" (ID: ${course.course_id}):`);
        console.log(`  Total units: ${totalUnits}`);
        units.forEach((u, idx) => {
          console.log(`  Unit ${idx + 1} (ID: ${u.unit_id}, Title: ${u.unit_title}): is_completed = ${u.is_completed} (type: ${typeof u.is_completed})`);
        });
        console.log(`  Completed units: ${completedUnits}`);
      }
      
      const progress = totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : 0;
      
      console.log(`[Qualification Courses] Course "${course.course_title}": ${completedUnits}/${totalUnits} units completed = ${progress}%`);

      // Get upcoming deadlines from units (exclude completed: is_completed, assignment Pass, or submission Pass)
      const unitDeadlines = units
        .filter(u => {
          const hasDeadline = !!u.deadline;
          const isCompleted = u.is_completed === 1 || u.is_completed === true || u.is_completed === '1' || String(u.is_completed).toLowerCase() === 'true';
          const assignmentPassed = u.assignment_status === 'pass';
          const submissionPassed = gradedByUnit[u.unit_id] === 'pass';
          const isIncomplete = !isCompleted && !assignmentPassed && !submissionPassed;
          return hasDeadline && isIncomplete;
        })
        .map(u => ({
          unit_id: u.unit_id,
          unit_title: u.unit_title,
          deadline: u.deadline
        }));
      
      // Get deadlines from student_topic_deadlines for this course
      const stdDeadlines = stdDeadlinesByCourse[course.course_id] || [];
      
      // Merge deadlines, prioritizing student_topic_deadlines
      const deadlineMap = new Map();
      
      // Add student_topic_deadlines first (these take priority)
      stdDeadlines.forEach(d => {
        deadlineMap.set(d.unit_id, {
          unit_id: d.unit_id,
          unit_title: d.unit_title || `Unit ${d.unit_id}`,
          deadline: d.deadline
        });
      });
      
      // Add unit deadlines that aren't in student_topic_deadlines
      unitDeadlines.forEach(u => {
        if (!deadlineMap.has(u.unit_id)) {
          deadlineMap.set(u.unit_id, u);
        }
      });
      
      const upcomingDeadlines = Array.from(deadlineMap.values());
      
      console.log(`[Qualification Courses] Course "${course.course_title}" has ${units.length} units, ${upcomingDeadlines.length} deadlines (${stdDeadlines.length} from student_topic_deadlines, ${unitDeadlines.length} from units)`);

      // Enrich each unit with pass/refer result for admin profile and reporting
      const unitsWithResult = units.map(u => ({
        ...u,
        unit_result: gradedByUnit[u.unit_id] || null
      }));

      return {
        ...course,
        progress,
        total_units: totalUnits,
        completed_units: completedUnits,
        units: unitsWithResult,
        upcoming_deadlines: upcomingDeadlines
      };
    });

    res.json({ success: true, qualificationCourses: coursesWithProgress });
  } catch (err) {
    console.error('[Qualification Courses] Error fetching student Qualification courses:', err);
    console.error('[Qualification Courses] Error details:', {
      message: err.message,
      stack: err.stack,
      code: err.code,
      sqlState: err.sqlState,
      sqlMessage: err.sqlMessage,
      errno: err.errno
    });
    
    // Return empty array instead of error if it's just a missing table/column issue
    if (err.code === 'ER_NO_SUCH_TABLE' || err.code === 'ER_BAD_FIELD_ERROR') {
      console.log('[Qualification Courses] Missing table/column, returning empty result');
      return res.json({ success: true, qualificationCourses: [] });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching student Qualification courses',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

module.exports = router;

