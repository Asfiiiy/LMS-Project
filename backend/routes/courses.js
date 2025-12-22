const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // MySQL pool
const { cacheMiddleware, invalidateCache } = require('../middleware/cache');

// Get course details by ID
router.get('/details/:courseId', cacheMiddleware(300), async (req, res) => {
  try {
    const { courseId } = req.params;
    
    const [rows] = await pool.query(
      `SELECT id, title, description, course_type, status, category_id, created_by, created_at 
       FROM courses WHERE id = ?`,
      [courseId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    res.json({ success: true, course: rows[0] });
  } catch (error) {
    console.error('Error fetching course:', error);
    res.status(500).json({ success: false, message: 'Error fetching course' });
  }
});

// Get all courses for a specific student
router.get('/student/:studentId', async (req, res) => {
  const { studentId } = req.params;
  try {
    const [rows] = await pool.execute(
      `SELECT c.id, c.title, c.description, c.course_type, sc.status
       FROM courses c
       JOIN course_assignments sc ON c.id = sc.course_id
       WHERE sc.student_id = ?`,
      [studentId]
    );

    res.json({ success: true, courses: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ========================================
// UNIT PROGRESSION SYSTEM
// ========================================

// Get unit progression status for a student
router.get('/:courseId/progression/:studentId', cacheMiddleware(60), async (req, res) => {
  try {
    const { courseId, studentId } = req.params;

    // Get all units for the course with their requirements
    const [units] = await pool.execute(
      `SELECT id, title, order_index, requires_assignment, assignment_passing_score
       FROM units
       WHERE course_id = ?
       ORDER BY order_index ASC`,
      [courseId]
    );

    // Get student's progress for each unit
    const [progress] = await pool.execute(
      `SELECT unit_id, is_unlocked, assignment_submitted, assignment_passed, assignment_score
       FROM unit_progress
       WHERE student_id = ?`,
      [studentId]
    );

    // Create a map of progress
    const progressMap = {};
    progress.forEach(p => {
      progressMap[p.unit_id] = p;
    });

    // Determine which units are unlocked
    const unitsWithStatus = units.map((unit, index) => {
      const prog = progressMap[unit.id] || {};
      
      // First unit is always unlocked
      const isFirstUnit = index === 0;
      const previousUnit = index > 0 ? units[index - 1] : null;
      const previousProgress = previousUnit ? progressMap[previousUnit.id] : null;

      let isUnlocked = prog.is_unlocked || false;
      let lockReason = null;

      if (isFirstUnit) {
        isUnlocked = true;
      } else if (previousUnit && previousUnit.requires_assignment) {
        // Previous unit requires assignment completion
        if (!previousProgress || !previousProgress.assignment_passed) {
          isUnlocked = false;
          lockReason = `Complete assignment in "${previousUnit.title}" to unlock`;
        } else {
          isUnlocked = true;
        }
      } else {
        // No assignment required, unlock if previous unit exists
        isUnlocked = true;
      }

      return {
        ...unit,
        isUnlocked,
        lockReason,
        assignmentSubmitted: prog.assignment_submitted || false,
        assignmentPassed: prog.assignment_passed || false,
        assignmentScore: prog.assignment_score || null
      };
    });

    res.json({ success: true, units: unitsWithStatus });
  } catch (err) {
    console.error('Error fetching progression:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Toggle assignment requirement for a unit
router.put('/units/:unitId/assignment-requirement', async (req, res) => {
  try {
    const { unitId } = req.params;
    const { requiresAssignment, passingScore } = req.body;

    await pool.execute(
      `UPDATE units 
       SET requires_assignment = ?, assignment_passing_score = ?
       WHERE id = ?`,
      [requiresAssignment, passingScore || 70, unitId]
    );

    res.json({ success: true, message: 'Unit requirements updated' });
  } catch (err) {
    console.error('Error updating unit requirements:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Submit assignment and update progression
router.post('/assignments/:assignmentId/submit', async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { studentId, filePath, fileName } = req.body;

    // Get assignment details including unit_id
    const [assignments] = await pool.execute(
      `SELECT a.unit_id, u.requires_assignment, u.assignment_passing_score, u.course_id
       FROM assignments a
       LEFT JOIN units u ON a.unit_id = u.id
       WHERE a.id = ?`,
      [assignmentId]
    );

    if (assignments.length === 0) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    const assignment = assignments[0];

    // Create submission
    const [result] = await pool.execute(
      `INSERT INTO assignment_submissions (assignment_id, student_id, file_path, status)
       VALUES (?, ?, ?, 'Submitted')`,
      [assignmentId, studentId, filePath]
    );

    // If this assignment is linked to a unit, update progress
    if (assignment.unit_id) {
      await pool.execute(
        `INSERT INTO unit_progress (student_id, unit_id, assignment_submitted, is_unlocked, unlocked_at)
         VALUES (?, ?, TRUE, TRUE, NOW())
         ON DUPLICATE KEY UPDATE 
         assignment_submitted = TRUE,
         updated_at = NOW()`,
        [studentId, assignment.unit_id]
      );
    }

    // Get assignment and course info for notification
    const [assignmentInfo] = await pool.execute(
      `SELECT a.title as assignment_title, c.title as course_title, c.id as course_id
       FROM assignments a
       LEFT JOIN courses c ON a.course_id = c.id
       WHERE a.id = ?`,
      [assignmentId]
    );
    
    const [studentInfo] = await pool.execute('SELECT name FROM users WHERE id = ?', [studentId]);
    
    // Get tutors for this course (or all tutors if course_id is null)
    let tutorsQuery;
    let tutorsParams;
    if (assignment.course_id) {
      tutorsQuery = `SELECT DISTINCT u.id 
                     FROM users u
                     JOIN roles r ON u.role_id = r.id
                     JOIN course_assignments ca ON ca.course_id = ?
                     WHERE r.name = 'Tutor' AND (ca.assigned_by = u.id OR ca.course_id = ?)`;
      tutorsParams = [assignment.course_id, assignment.course_id];
    } else {
      tutorsQuery = `SELECT DISTINCT u.id 
                     FROM users u
                     JOIN roles r ON u.role_id = r.id
                     WHERE r.name = 'Tutor'`;
      tutorsParams = [];
    }
    
    const [tutors] = await pool.execute(tutorsQuery, tutorsParams);
    
    const studentName = studentInfo[0]?.name || 'Student';
    const assignmentTitle = assignmentInfo[0]?.assignment_title || 'Assignment';
    const courseTitle = assignmentInfo[0]?.course_title || 'Course';
    
    const { createNotification } = require('../utils/notificationHelper');
    
    // Notify all tutors
    for (const tutor of tutors) {
      await createNotification({
        userId: tutor.id,
        type: 'assignment_submitted',
        title: 'Assignment Submitted',
        message: `${studentName} submitted assignment "${assignmentTitle}" in ${courseTitle}`,
        relatedUserId: studentId,
        relatedCourseId: assignmentInfo[0]?.course_id || null,
        relatedSubmissionId: result.insertId,
        req: req
      });
    }

    await invalidateCache('cache:/api/unit-progress*');
    await invalidateCache('cache:/api/assignment-submissions*');
    res.json({ 
      success: true, 
      message: 'Assignment submitted successfully',
      submissionId: result.insertId 
    });
  } catch (err) {
    console.error('Error submitting assignment:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Grade assignment submission (Tutor/Admin)
router.put('/submissions/:submissionId/grade', async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { score, feedback, gradedBy } = req.body;

    // Get submission details
    const [submissions] = await pool.execute(
      `SELECT s.student_id, s.assignment_id, a.unit_id, u.assignment_passing_score
       FROM assignment_submissions s
       JOIN assignments a ON s.assignment_id = a.id
       LEFT JOIN units u ON a.unit_id = u.id
       WHERE s.id = ?`,
      [submissionId]
    );

    if (submissions.length === 0) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }

    const submission = submissions[0];
    const passed = score >= (submission.assignment_passing_score || 70);
    const status = passed ? 'Passed' : 'Failed';

    // Update submission with grade
    await pool.execute(
      `UPDATE assignment_submissions
       SET score = ?, feedback = ?, status = ?
       WHERE id = ?`,
      [score, feedback, status, submissionId]
    );

    // If assignment is linked to a unit, update progression
    if (submission.unit_id) {
      await pool.execute(
        `INSERT INTO unit_progress (student_id, unit_id, assignment_passed, assignment_score, is_unlocked, unlocked_at)
         VALUES (?, ?, ?, ?, TRUE, NOW())
         ON DUPLICATE KEY UPDATE 
         assignment_passed = ?,
         assignment_score = ?,
         updated_at = NOW()`,
        [submission.student_id, submission.unit_id, passed, score, passed, score]
      );

      // If passed, unlock the next unit
      if (passed) {
        const [nextUnit] = await pool.execute(
          `SELECT id FROM units 
           WHERE course_id = (SELECT course_id FROM units WHERE id = ?)
           AND order_index = (SELECT order_index + 1 FROM units WHERE id = ?)
           LIMIT 1`,
          [submission.unit_id, submission.unit_id]
        );

        if (nextUnit.length > 0) {
          await pool.execute(
            `INSERT INTO unit_progress (student_id, unit_id, is_unlocked, unlocked_at)
             VALUES (?, ?, TRUE, NOW())
             ON DUPLICATE KEY UPDATE 
             is_unlocked = TRUE,
             unlocked_at = NOW(),
             updated_at = NOW()`,
            [submission.student_id, nextUnit[0].id]
          );
        }
      }
    }

    await invalidateCache('cache:/api/unit-progress*');
    await invalidateCache('cache:/api/assignment-submissions*');
    res.json({ 
      success: true, 
      message: 'Assignment graded successfully',
      passed,
      nextUnitUnlocked: passed && submission.unit_id
    });
  } catch (err) {
    console.error('Error grading assignment:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
