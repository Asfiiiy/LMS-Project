/**
 * =====================================================
 * MANAGER API ROUTES
 * =====================================================
 * Handles manager-specific operations:
 * - Get staff members under manager
 * - Get students under staff members
 * - Get student course progress with unit completion
 * =====================================================
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { cacheMiddleware } = require('../middleware/cache');

// =====================================================
// TEST ENDPOINT (for debugging)
// =====================================================
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Manager routes are working!' });
});

// =====================================================
// GET ALL STUDENTS UNDER MANAGER (DIRECTLY)
// =====================================================
router.get('/students', auth, async (req, res) => {
  try {
    const managerId = req.user.id;
    
    // Get all students directly under this manager (regardless of role)
    // This includes ManagerStudent, Student, or any other role that has manager_id set
    const [students] = await pool.execute(
      `SELECT 
        u.id,
        u.name,
        u.email,
        u.created_at,
        u.role_id,
        COUNT(DISTINCT ca.course_id) as course_count
       FROM users u
       LEFT JOIN course_assignments ca ON ca.student_id = u.id
       WHERE u.manager_id = ?
       GROUP BY u.id, u.name, u.email, u.created_at, u.role_id
       ORDER BY u.name`,
      [managerId]
    );
    
    console.log(`[Manager] Found ${students.length} students for manager ${managerId}`);
    if (students.length > 0) {
      console.log(`[Manager] Sample student:`, students[0]);
    }
    
    res.json({
      success: true,
      students: students
    });
    
  } catch (error) {
    console.error('[Manager] Error fetching students:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching students',
      error: error.message
    });
  }
});

// =====================================================
// GET STAFF MEMBERS UNDER MANAGER
// =====================================================
router.get('/staff', auth, async (req, res) => {
  try {
    const managerId = req.user.id;
    
    // Get role_id for 'Tutor' role
    const [roleRows] = await pool.execute(
      `SELECT id FROM roles WHERE name = 'Tutor'`
    );
    
    if (roleRows.length === 0) {
      return res.json({ success: true, staff: [] });
    }
    
    const tutorRoleId = roleRows[0].id;
    
    // Get all staff members (Tutors) under this manager
    const [staff] = await pool.execute(
      `SELECT 
        u.id,
        u.name,
        u.email,
        u.created_at,
        COUNT(DISTINCT s.id) as student_count
       FROM users u
       LEFT JOIN users s ON s.manager_id = u.id
       WHERE u.manager_id = ? AND u.role_id = ?
       GROUP BY u.id, u.name, u.email, u.created_at
       ORDER BY u.name`,
      [managerId, tutorRoleId]
    );
    
    res.json({
      success: true,
      staff: staff
    });
    
  } catch (error) {
    console.error('[Manager] Error fetching staff:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching staff members',
      error: error.message
    });
  }
});

// =====================================================
// GET STUDENTS UNDER STAFF MEMBER
// =====================================================
router.get('/staff/:staffId/students', auth, async (req, res) => {
  try {
    const managerId = req.user.id;
    const { staffId } = req.params;
    
    // Verify staff member belongs to this manager
    const [staffCheck] = await pool.execute(
      `SELECT id FROM users WHERE id = ? AND manager_id = ?`,
      [staffId, managerId]
    );
    
    if (staffCheck.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Staff member not found or not under your management'
      });
    }
    
    // Get all students under this staff member (regardless of role)
    const [students] = await pool.execute(
      `SELECT 
        u.id,
        u.name,
        u.email,
        u.created_at,
        u.role_id,
        COUNT(DISTINCT ca.course_id) as course_count
       FROM users u
       LEFT JOIN course_assignments ca ON ca.student_id = u.id
       WHERE u.manager_id = ?
       GROUP BY u.id, u.name, u.email, u.created_at, u.role_id
       ORDER BY u.name`,
      [staffId]
    );
    
    console.log(`[Manager] Found ${students.length} students for staff ${staffId}`);
    if (students.length > 0) {
      console.log(`[Manager] Sample student:`, students[0]);
    }
    
    res.json({
      success: true,
      students: students
    });
    
  } catch (error) {
    console.error('[Manager] Error fetching students:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching students',
      error: error.message
    });
  }
});

// =====================================================
// GET STUDENT COURSE PROGRESS
// =====================================================
router.get('/students/:studentId/progress', auth, async (req, res) => {
  try {
    const managerId = req.user.id;
    const { studentId } = req.params;
    
    // Verify student belongs directly to this manager or through staff
    const [studentCheck] = await pool.execute(
      `SELECT u.id, u.manager_id, u.name
       FROM users u
       LEFT JOIN users staff ON staff.id = u.manager_id
       WHERE u.id = ? AND (u.manager_id = ? OR staff.manager_id = ?)`,
      [studentId, managerId, managerId]
    );
    
    console.log(`[Manager] Student check for student ${studentId} under manager ${managerId}:`, studentCheck);
    
    if (studentCheck.length === 0) {
      console.log(`[Manager] Student ${studentId} not found under manager ${managerId}`);
      return res.status(403).json({
        success: false,
        message: 'Student not found or not under your management'
      });
    }
    
    console.log(`[Manager] Student verified: ${studentCheck[0].name} (ID: ${studentCheck[0].id})`);
    
    // Get all courses for this student with enrollment info
    const [courses] = await pool.execute(
      `SELECT 
        c.id as course_id,
        c.title as course_title,
        c.course_type,
        ca.created_at as enrolled_at,
        ca.status as enrollment_status
       FROM course_assignments ca
       JOIN courses c ON c.id = ca.course_id
       WHERE ca.student_id = ?
       ORDER BY ca.created_at DESC`,
      [studentId]
    );
    
    console.log(`[Manager] Found ${courses.length} courses for student ${studentId}`);
    if (courses.length > 0) {
      console.log(`[Manager] Sample course:`, courses[0]);
    }
    
    // Get progress for each course
    const coursesWithProgress = await Promise.all(
      courses.map(async (course) => {
        let progress = null;
        let units = [];
        
        if (course.course_type === 'qualification') {
          // Qualification course progress
          const [qualProgress] = await pool.execute(
            `SELECT 
              qup.*,
              u.id as unit_id,
              u.title as unit_title,
              u.order_index,
              CASE 
                WHEN qup.assignment_status = 'pass' AND (qup.presentation_status = 'pass' OR qup.presentation_status = 'not_required') THEN 1
                ELSE 0
              END as is_completed
             FROM qual_unit_progress qup
             JOIN units u ON u.id = qup.unit_id
             WHERE qup.course_id = ? AND qup.student_id = ?
             ORDER BY u.order_index`,
            [course.course_id, studentId]
          );
          
          units = qualProgress.map((up) => ({
            unit_id: up.unit_id,
            unit_title: up.unit_title,
            order_index: up.order_index,
            is_unlocked: up.is_unlocked === 1,
            is_completed: up.is_completed === 1,
            assignment_status: up.assignment_status || 'pending',
            presentation_status: up.presentation_status || 'not_required',
            unlocked_at: up.unlocked_at
          }));
          
          console.log(`[Manager] Course ${course.course_id}: Found ${units.length} units, ${units.filter(u => u.is_completed).length} completed`);
          
          const completedUnits = units.filter(u => u.is_completed).length;
          const totalUnits = units.length;
          progress = totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : 0;
          
        } else if (course.course_type === 'cpd') {
          // CPD course progress (using cpd_topics and cpd_progress)
          const [topics] = await pool.execute(
            `SELECT 
              t.id as topic_id,
              t.topic_number,
              t.title as topic_title,
              t.order_index,
              t.deadline,
              COALESCE(cp.is_unlocked, 0) as is_unlocked,
              COALESCE(cp.final_quiz_passed, 0) as is_completed,
              COALESCE(cp.final_quiz_attempted, 0) as quiz_attempted,
              COALESCE(cp.final_quiz_score, 0) as quiz_score,
              cp.updated_at as unlocked_at
             FROM cpd_topics t
             LEFT JOIN cpd_progress cp ON cp.topic_id = t.id AND cp.student_id = ? AND cp.course_id = ?
             WHERE t.course_id = ?
             ORDER BY t.order_index`,
            [studentId, course.course_id, course.course_id]
          );
          
          units = topics.map((topic) => ({
            unit_id: topic.topic_id,
            unit_title: `${topic.topic_number ? `Topic ${topic.topic_number}: ` : ''}${topic.topic_title}`,
            order_index: topic.order_index,
            is_unlocked: topic.is_unlocked === 1,
            is_completed: topic.is_completed === 1,
            quiz_attempted: topic.quiz_attempted === 1,
            quiz_score: topic.quiz_score,
            deadline: topic.deadline,
            unlocked_at: topic.unlocked_at
          }));
          
          console.log(`[Manager] Course ${course.course_id} (CPD): Found ${units.length} topics, ${units.filter(u => u.is_completed).length} completed`);
          
          const completedUnits = units.filter(u => u.is_completed).length;
          const totalUnits = units.length;
          progress = totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : 0;
          
        } else {
          // Regular course progress (using unit_progress table)
          const [unitProgress] = await pool.execute(
            `SELECT 
              up.*,
              u.id as unit_id,
              u.title as unit_title,
              u.order_index
             FROM unit_progress up
             JOIN units u ON u.id = up.unit_id
             WHERE up.course_id = ? AND up.student_id = ?
             ORDER BY u.order_index`,
            [course.course_id, studentId]
          );
          
          units = unitProgress.map((up) => ({
            unit_id: up.unit_id,
            unit_title: up.unit_title,
            order_index: up.order_index,
            is_unlocked: up.is_unlocked === 1,
            is_completed: up.is_completed === 1,
            unlocked_at: up.unlocked_at
          }));
          
          console.log(`[Manager] Course ${course.course_id}: Found ${units.length} units, ${units.filter(u => u.is_completed).length} completed`);
          
          const completedUnits = units.filter(u => u.is_completed).length;
          const totalUnits = units.length;
          progress = totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : 0;
        }
        
        // Find current unit (first incomplete unit, or last unit if all complete)
        const currentUnit = units.find(u => !u.is_completed) || units[units.length - 1] || null;
        
        return {
          course_id: course.course_id,
          course_title: course.course_title,
          course_type: course.course_type,
          enrolled_at: course.enrolled_at,
          enrollment_status: course.enrollment_status,
          progress: progress,
          total_units: units.length,
          completed_units: units.filter(u => u.is_completed).length,
          current_unit: currentUnit ? {
            unit_id: currentUnit.unit_id,
            unit_title: currentUnit.unit_title,
            order_index: currentUnit.order_index
          } : null,
          units: units
        };
      })
    );
    
    console.log(`[Manager] Returning progress for student ${studentId}:`, {
      student_id: studentId,
      courses_count: coursesWithProgress.length,
      courses: coursesWithProgress.map(c => ({
        course_id: c.course_id,
        course_title: c.course_title,
        progress: c.progress,
        units_count: c.total_units
      }))
    });
    
    res.json({
      success: true,
      student_id: studentId,
      courses: coursesWithProgress
    });
    
  } catch (error) {
    console.error('[Manager] Error fetching student progress:', error);
    console.error('[Manager] Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Error fetching student progress',
      error: error.message
    });
  }
});

module.exports = router;

