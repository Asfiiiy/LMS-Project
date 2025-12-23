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
    const { logSystemEvent } = require('../utils/eventLogger');
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

// Get tutors for a student (based on enrolled courses)
router.get('/:studentId/tutors', cacheMiddleware(300), async (req, res) => {
  try {
    const { studentId } = req.params;

    // Strategy 1: Get tutors from course creator (created_by)
    let [rows] = await pool.execute(
      `SELECT DISTINCT u.id, u.name, u.email
        FROM users u
        JOIN courses c ON c.created_by = u.id
        JOIN course_assignments ca ON ca.course_id = c.id
        WHERE ca.student_id = ? AND u.role_id = 2
        ORDER BY u.name ASC`,
      [studentId]
    );

    // Strategy 2: If no tutors found, check if there's a tutor_assignments table
    if (rows.length === 0) {
      try {
        const [tutorRows] = await pool.execute(
          `SELECT DISTINCT u.id, u.name, u.email
            FROM users u
            JOIN tutor_assignments ta ON ta.tutor_id = u.id
            JOIN course_assignments ca ON ca.course_id = ta.course_id
            WHERE ca.student_id = ? AND u.role_id = 2
            ORDER BY u.name ASC`,
          [studentId]
        );
        rows = tutorRows;
      } catch (e) {
        // Table might not exist, continue with empty result
        console.log('tutor_assignments table not found or query failed:', e.message);
      }
    }

    // Strategy 3: If still no tutors, get ALL tutors as fallback
    if (rows.length === 0) {
      const [allTutors] = await pool.execute(
        `SELECT DISTINCT u.id, u.name, u.email
          FROM users u
          WHERE u.role_id = 2
          ORDER BY u.name ASC
          LIMIT 10`,
        []
      );
      rows = allTutors;
    }

    res.json({ success: true, tutors: rows });
  } catch (err) {
    console.error(err);
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
    console.log(`[Student Grades] Fetching grades for student ${studentId}`);

    const [grades] = await pool.execute(
      `SELECT 
        c.id as course_id,
        c.title as course_title,
        u.id as unit_id,
        u.title as unit_title,
        u.order_index as unit_order,
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

    console.log(`[Student Grades] Found ${grades.length} graded submissions`);

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
    console.log(`[Qualification Courses] Fetching courses for student ${studentId}`);

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
      console.log(`[Qualification Courses] Found ${enrollments.length} enrollments`);
      
      // Debug: Check what course_types exist for this student
      const [allEnrollments] = await pool.execute(
        `SELECT c.id, c.title, c.course_type, ca.student_id
         FROM course_assignments ca
         JOIN courses c ON ca.course_id = c.id
         WHERE ca.student_id = ?`,
        [studentId]
      );
      console.log(`[Qualification Courses] All enrollments for student ${studentId}:`, 
        allEnrollments.map(e => ({ id: e.id, title: e.title, type: e.course_type }))
      );
      
      // Check for qualification courses with different case or variations
      const qualEnrollments = allEnrollments.filter(e => {
        const type = (e.course_type || '').toLowerCase().trim();
        return type === 'qualification' || type === 'qualifi';
      });
      console.log(`[Qualification Courses] Qualification enrollments (case-insensitive):`, 
        qualEnrollments.map(e => ({ id: e.id, title: e.title, type: e.course_type }))
      );
      
      // Also check course 64 specifically (from the database entries)
      const [course64] = await pool.execute(
        `SELECT id, title, course_type FROM courses WHERE id = 64`
      );
      if (course64.length > 0) {
        console.log(`[Qualification Courses] Course 64 details:`, course64[0]);
      }
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
      
      // Check if qual_unit_progress table exists and has is_completed column
      // Qualification courses use qual_unit_progress, not unit_progress
      let hasUnitProgressTable = false;
      let unitProgressColumn = 'is_completed';
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
        }
      } catch (err) {
        console.log('[Qualification Courses] qual_unit_progress table check failed:', err.message);
        hasUnitProgressTable = false;
      }
      
      if (hasStudentDeadlinesTable && hasDeadlineColumn) {
        // Use student-specific deadlines if both tables/columns exist
        const progressSelect = hasUnitProgressTable 
          ? `COALESCE(up.${unitProgressColumn}, 0) as is_completed, up.completed_at`
          : `0 as is_completed, NULL as completed_at`;
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
          ? `COALESCE(up.${unitProgressColumn}, 0) as is_completed, up.completed_at`
          : `0 as is_completed, NULL as completed_at`;
        const progressJoin = hasUnitProgressTable
          ? `LEFT JOIN qual_unit_progress up ON up.unit_id = u.id AND up.student_id = ?`
          : '';
        
        query = `SELECT 
          u.id as unit_id,
          u.course_id,
          u.title as unit_title,
          u.order_index,
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
          ? `COALESCE(up.${unitProgressColumn}, 0) as is_completed, up.completed_at`
          : `0 as is_completed, NULL as completed_at`;
        const progressJoin = hasUnitProgressTable
          ? `LEFT JOIN qual_unit_progress up ON up.unit_id = u.id AND up.student_id = ?`
          : '';
        
        query = `SELECT 
          u.id as unit_id,
          u.course_id,
          u.title as unit_title,
          u.order_index,
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
        console.error('[Qualification Courses] Query error:', queryErr);
        console.error('[Qualification Courses] Query:', query);
        console.error('[Qualification Courses] Params:', params);
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

    // Map enrollments with their units
    const coursesWithProgress = enrollments.map((course) => {
      const units = unitsByCourse[course.course_id] || [];

      // Calculate progress
      const totalUnits = units.length;
      // Handle different types: 1, true, "1", etc.
      const completedUnits = units.filter(u => {
        const isCompleted = u.is_completed;
        const completed = isCompleted === 1 || isCompleted === true || isCompleted === '1' || String(isCompleted).toLowerCase() === 'true';
        return completed;
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

      // Get upcoming deadlines from units
      const unitDeadlines = units
        .filter(u => {
          const hasDeadline = !!u.deadline;
          const isCompleted = u.is_completed;
          const isIncomplete = !(isCompleted === 1 || isCompleted === true || isCompleted === '1' || String(isCompleted).toLowerCase() === 'true');
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

      return {
        ...course,
        progress,
        total_units: totalUnits,
        completed_units: completedUnits,
        units,
        upcoming_deadlines: upcomingDeadlines
      };
    });

    console.log(`[Qualification Courses] Returning ${coursesWithProgress.length} courses with progress`);
    console.log(`[Qualification Courses] Courses data:`, JSON.stringify(coursesWithProgress.map(c => ({
      course_id: c.course_id,
      course_title: c.course_title,
      total_units: c.total_units,
      upcoming_deadlines_count: c.upcoming_deadlines?.length || 0
    })), null, 2));
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

