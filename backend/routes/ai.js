/**
 * AI Automation Routes
 * Separate API endpoints for AI automation tasks
 * All routes require AI token authentication
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const bcrypt = require('bcrypt');
const { aiAuth, aiRequirePermission } = require('../middleware/aiAuth');
const AILogger = require('../services/aiLogger');
const { invalidateCache } = require('../middleware/cache');
const {
  validateCreateUser,
  validateAssignTutor,
  validateEnrollment,
  validateDeadlineSetup,
  validatePaymentSetup,
  validateAddInstallment,
  validateUpdateInstallmentStatus
} = require('../middleware/validateAIInput');
const { isStudentRoleName, normalizeLearnerId, generateNextLearnerId } = require('../utils/learnerId');
const { aiRateLimit } = require('../middleware/rateLimiter');

// Apply AI authentication to all routes
router.use(aiAuth);

// =====================================================
// USER MANAGEMENT ENDPOINTS
// =====================================================

/**
 * POST /api/ai/users/create
 * Create a new user (especially students)
 * Requires permission: users.create
 */
router.post('/users/create', aiRateLimit, aiRequirePermission('users.create'), validateCreateUser, async (req, res) => {
  const aiCreateTimeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(503).json({
        success: false,
        error: 'Request timed out'
      });
    }
  }, 10000);

  const connection = await pool.getConnection();

  if (res.headersSent) {
    clearTimeout(aiCreateTimeout);
    connection.release();
    return;
  }

  try {
    const { name, email, password, learner_id, role_id, manager_id, assigned_tutor_id } = req.body;

    // Validation
    if (!name || !email || !password || !role_id) {
      clearTimeout(aiCreateTimeout);
      return res.status(400).json({ 
        success: false, 
        message: 'name, email, password, and role_id are required' 
      });
    }

    // Set AI action metadata for logging
    req.aiActionType = 'user_created';
    req.aiActionDescription = `AI created user: ${name} (${email})`;

    await connection.beginTransaction();

    // Check if user already exists
    const [existing] = await connection.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );
    
    if (existing.length > 0) {
      await connection.rollback();
      connection.release();
      clearTimeout(aiCreateTimeout);
      return res.status(400).json({ 
        success: false, 
        message: 'User with this email already exists' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const [roleRows] = await connection.execute('SELECT name FROM roles WHERE id = ?', [role_id]);
    const roleName = roleRows.length > 0 ? roleRows[0].name : null;
    let learnerIdForUser = isStudentRoleName(roleName) ? normalizeLearnerId(learner_id) : null;

    if (isStudentRoleName(roleName) && !learnerIdForUser) {
      learnerIdForUser = await generateNextLearnerId(connection);
    }

    if (learnerIdForUser) {
      const [existingLearnerId] = await connection.execute('SELECT id FROM users WHERE learner_id = ?', [learnerIdForUser]);
      if (existingLearnerId.length > 0) {
        await connection.rollback();
        connection.release();
        clearTimeout(aiCreateTimeout);
        return res.status(400).json({
          success: false,
          message: 'Learner ID already exists'
        });
      }
    }

    // Validate manager_id and assigned_tutor_id exist before inserting
    let validManagerId = null;
    let validTutorId = null;
    if (manager_id) {
      const [mgr] = await connection.execute('SELECT id FROM users WHERE id = ?', [manager_id]);
      if (mgr.length > 0) validManagerId = manager_id;
    }
    if (assigned_tutor_id) {
      const [tutor] = await connection.execute('SELECT id FROM users WHERE id = ?', [assigned_tutor_id]);
      if (tutor.length > 0) validTutorId = assigned_tutor_id;
    }

    const [result] = await connection.execute(
      `INSERT INTO users (name, email, learner_id, password_hash, role_id, manager_id, assigned_tutor_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, email, learnerIdForUser, hashedPassword, role_id, validManagerId, validTutorId]
    );

    const userId = result.insertId;

    // If student user, create initial profile entry
    try {
      if (isStudentRoleName(roleName)) {
        await connection.execute(
          'INSERT INTO student_profiles (user_id, is_profile_complete) VALUES (?, 0)',
          [userId]
        );
      }
    } catch (profileErr) {
      console.error('[AI] Error creating student profile:', profileErr);
      // Don't fail user creation
    }

    await connection.commit();
    await invalidateCache('cache:/api/admin/users*');

    // Set affected IDs for logging
    req.aiAffectedIds = { userId };

    clearTimeout(aiCreateTimeout);
    return res.json({ 
      success: true, 
      message: 'User created successfully', 
      userId: userId,
      user: {
        id: userId,
        name,
        email,
        role_id
      }
    });
  } catch (error) {
    clearTimeout(aiCreateTimeout);
    await connection.rollback();
    console.error('[AI] Error creating user:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false, 
        message: 'Error creating user',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  } finally {
    clearTimeout(aiCreateTimeout);
    connection.release();
  }
});

/**
 * POST /api/ai/users/assign-tutor
 * Assign a tutor to a student
 * Requires permission: users.assign_tutor
 */
router.post('/users/assign-tutor', aiRequirePermission('users.assign_tutor'), validateAssignTutor, async (req, res) => {
  try {
    const { student_id, tutor_id } = req.body;

    if (!student_id || !tutor_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'student_id and tutor_id are required' 
      });
    }

    // Set AI action metadata
    req.aiActionType = 'tutor_assigned';
    req.aiAffectedIds = { userId: student_id };

    // Verify student exists
    const [studentRows] = await pool.execute('SELECT id, name, role_id FROM users WHERE id = ?', [student_id]);
    if (studentRows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: `Student with ID ${student_id} not found` 
      });
    }

    // Verify tutor exists and is actually a tutor
    const [tutorRows] = await pool.execute(
      `SELECT u.id, u.name, u.role_id, r.name as role_name 
       FROM users u 
       LEFT JOIN roles r ON u.role_id = r.id 
       WHERE u.id = ? AND (r.name = 'Assessor' OR u.role_id = 2)`,
      [tutor_id]
    );

    if (tutorRows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: `Assessor with ID ${tutor_id} not found or is not a valid assessor` 
      });
    }

    const studentName = studentRows[0]?.name || `Student ${student_id}`;
    const tutorName = tutorRows[0]?.name || `Assessor ${tutor_id}`;

    req.aiActionDescription = `AI assigned assessor ${tutorName} to student ${studentName}`;

    // Update student's assigned_tutor_id
    await pool.execute(
      'UPDATE users SET assigned_tutor_id = ? WHERE id = ?',
      [tutor_id, student_id]
    );

    await invalidateCache('cache:/api/admin/users*');

    res.json({ 
      success: true, 
      message: 'Tutor assigned successfully',
      student_id,
      tutor_id
    });
  } catch (error) {
    console.error('[AI] Error assigning tutor:', error);
    console.error('[AI] Error stack:', error.stack);
    res.status(500).json({ 
      success: false, 
      message: 'Error assigning tutor',
      error: error.message || 'Unknown error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// =====================================================
// ENROLLMENT ENDPOINTS
// =====================================================

/**
 * GET /api/ai/enrollments/courses
 * Get list of available courses
 * Requires permission: enrollments.read
 */
router.get('/enrollments/courses', aiRequirePermission('enrollments.read'), async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, title, course_type, description, status 
       FROM courses 
       WHERE status = 'active' 
       ORDER BY title ASC`
    );

    req.aiActionType = 'courses_listed';
    req.aiActionDescription = 'AI retrieved list of courses';

    res.json({ 
      success: true, 
      courses: rows 
    });
  } catch (error) {
    console.error('[AI] Error fetching courses:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching courses' 
    });
  }
});

/**
 * GET /api/ai/enrollments/students
 * Get list of available students (not enrolled in a specific course)
 * Query params: courseId (optional) - if provided, returns students not enrolled in that course
 * Requires permission: enrollments.read
 */
router.get('/enrollments/students', aiRequirePermission('enrollments.read'), async (req, res) => {
  try {
    const { courseId } = req.query;

    let query = `
      SELECT u.id, u.name, u.email, u.role_id, r.name as role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE r.name IN ('Student', 'ManagerStudent', 'InstituteStudent')
    `;

    const params = [];

    // If courseId provided, exclude already enrolled students
    if (courseId) {
      query += `
        AND u.id NOT IN (
          SELECT student_id FROM course_assignments WHERE course_id = ?
        )
      `;
      params.push(courseId);
    }

    query += ' ORDER BY u.name ASC';

    const [rows] = await pool.execute(query, params);

    req.aiActionType = 'students_listed';
    req.aiActionDescription = courseId 
      ? `AI retrieved available students for course ${courseId}`
      : 'AI retrieved list of students';

    res.json({ 
      success: true, 
      students: rows 
    });
  } catch (error) {
    console.error('[AI] Error fetching students:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching students' 
    });
  }
});

/**
 * POST /api/ai/enrollments/enroll
 * Enroll a student in a course
 * Requires permission: enrollments.create
 */
router.post('/enrollments/enroll', aiRequirePermission('enrollments.create'), validateEnrollment, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { courseId, studentId, assignedTutorId } = req.body;

    if (!courseId || !studentId) {
      return res.status(400).json({ 
        success: false, 
        message: 'courseId and studentId are required' 
      });
    }

    // Set AI action metadata
    req.aiActionType = 'student_enrolled';
    req.aiAffectedIds = { studentId, courseId };

    await connection.beginTransaction();

    // Check if already enrolled
    const [existing] = await connection.execute(
      'SELECT id FROM course_assignments WHERE course_id = ? AND student_id = ?',
      [courseId, studentId]
    );

    if (existing.length > 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ 
        success: false, 
        message: 'Student is already enrolled in this course' 
      });
    }

    // Get course and student names for description
    const [courseRows] = await connection.execute('SELECT title FROM courses WHERE id = ?', [courseId]);
    const [studentRows] = await connection.execute('SELECT name FROM users WHERE id = ?', [studentId]);

    const courseName = courseRows[0]?.title || `Course ${courseId}`;
    const studentName = studentRows[0]?.name || `Student ${studentId}`;

    req.aiActionDescription = `AI enrolled student ${studentName} in course ${courseName}`;

    // Create enrollment
    await connection.execute(
      `INSERT INTO course_assignments (course_id, student_id, status, assigned_tutor_id)
       VALUES (?, ?, 'Enrolled', ?)`,
      [courseId, studentId, assignedTutorId || null]
    );

    // Get enrollment ID
    const [enrollmentRows] = await connection.execute(
      'SELECT id FROM course_assignments WHERE course_id = ? AND student_id = ?',
      [courseId, studentId]
    );

    const enrollmentId = enrollmentRows[0]?.id;
    req.aiAffectedIds.enrollmentId = enrollmentId;

    // Check if course has topics/units with deadlines (for CPD/Qualification)
    const [courseTypeRows] = await connection.execute(
      'SELECT course_type FROM courses WHERE id = ?',
      [courseId]
    );

    const courseType = courseTypeRows[0]?.course_type;
    let topicsWithDeadlines = [];

    if (courseType === 'cpd') {
      const [topicRows] = await connection.execute(
        `SELECT id, topic_number, title, deadline 
         FROM cpd_topics 
         WHERE course_id = ?
         ORDER BY order_index`,
        [courseId]
      );
      topicsWithDeadlines = topicRows.map(t => ({
        ...t,
        type: 'cpd_topic'
      }));
    } else if (courseType === 'qualification') {
      try {
        const [unitRows] = await connection.execute(
          `SELECT id, order_index, title, deadline 
           FROM units 
           WHERE course_id = ?
           ORDER BY order_index`,
          [courseId]
        );
        topicsWithDeadlines = unitRows.map((u, index) => ({
          id: u.id,
          topic_number: u.order_index !== null ? u.order_index + 1 : index + 1,
          title: u.title,
          deadline: u.deadline || null,
          type: 'qualification_unit'
        }));
      } catch (unitErr) {
        console.error('[AI] Error fetching qualification units:', unitErr);
      }
    }

    await connection.commit();
    await invalidateCache(`cache:/api/admin/courses/${courseId}/enrollments*`);

    res.json({ 
      success: true, 
      message: 'Student enrolled successfully',
      enrollmentId,
      requiresDeadlineSetup: topicsWithDeadlines.length > 0,
      topics: topicsWithDeadlines
    });
  } catch (error) {
    await connection.rollback();
    console.error('[AI] Error enrolling student:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error enrolling student',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    connection.release();
  }
});

// =====================================================
// ENROLLMENT SETUP ENDPOINTS
// =====================================================

/**
 * POST /api/ai/enrollments/setup/deadlines
 * Set topic deadlines for a student enrollment
 * Requires permission: enrollments.setup
 */
router.post('/enrollments/setup/deadlines', aiRequirePermission('enrollments.setup'), validateDeadlineSetup, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { courseId, studentId, deadlines } = req.body;

    if (!courseId || !studentId || !Array.isArray(deadlines)) {
      return res.status(400).json({ 
        success: false, 
        message: 'courseId, studentId, and deadlines array are required' 
      });
    }

    // Set AI action metadata
    req.aiActionType = 'deadlines_set';
    req.aiAffectedIds = { studentId, courseId };

    await connection.beginTransaction();

    // Get student and course names
    const [studentRows] = await connection.execute('SELECT name FROM users WHERE id = ?', [studentId]);
    const [courseRows] = await connection.execute('SELECT title FROM courses WHERE id = ?', [courseId]);

    const studentName = studentRows[0]?.name || `Student ${studentId}`;
    const courseName = courseRows[0]?.title || `Course ${courseId}`;

    req.aiActionDescription = `AI set ${deadlines.length} topic deadline(s) for student ${studentName} in course ${courseName}`;

    // Helper function to parse deadline date
    const parseDeadlineDate = (dateString) => {
      if (!dateString || dateString === null || dateString === '' || dateString === 'null') {
        return null;
      }

      try {
        // If already in MySQL DATETIME format
        if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateString)) {
          return dateString;
        }
        
        // If in DATE format, add time
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
          return dateString + ' 00:00:00';
        }

        // Parse MM/DD/YYYY HH:MM AM/PM format
        if (dateString.includes('/') && (dateString.includes('AM') || dateString.includes('PM'))) {
          const parts = dateString.trim().split(' ');
          if (parts.length >= 3) {
            const datePart = parts[0];
            const timePart = parts[1];
            const ampm = parts[2].toUpperCase();
            
            const [month, day, year] = datePart.split('/').map(Number);
            const [hours, minutes] = timePart.split(':').map(Number);
            
            let hour24 = hours;
            if (ampm === 'PM' && hours !== 12) {
              hour24 = hours + 12;
            } else if (ampm === 'AM' && hours === 12) {
              hour24 = 0;
            }
            
            return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(hour24).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
          }
        }

        // Try standard Date parsing
        const date = new Date(dateString);
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          return `${year}-${month}-${day} ${hours}:${minutes}:00`;
        }
      } catch (e) {
        console.error('[AI] Error parsing deadline date:', e);
      }

      return null;
    };

    // Process each deadline
    // Table unique key is (student_id, topic_id, topic_type); topic_type is required for rows to be visible in app
    for (const deadlineItem of deadlines) {
      const { topicId, topicType, deadline, notes } = deadlineItem;
      const parsedDeadline = parseDeadlineDate(deadline);
      const validType = topicType === 'cpd_topic' ? 'cpd_topic' : 'qualification_unit';

      try {
        await connection.execute(
          `INSERT INTO student_topic_deadlines (student_id, course_id, topic_id, topic_type, deadline, set_by, notes)
           VALUES (?, ?, ?, ?, ?, NULL, ?)
           ON DUPLICATE KEY UPDATE 
             deadline = VALUES(deadline),
             notes = VALUES(notes),
             course_id = VALUES(course_id),
             updated_at = NOW()`,
          [studentId, courseId, topicId, validType, parsedDeadline, notes || null]
        );
      } catch (err) {
        console.error('[AI] Error setting deadline for topic', topicId, validType, err.message);
        if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
          await connection.execute(
            `UPDATE student_topic_deadlines 
             SET deadline = ?, notes = ?, course_id = ?, updated_at = NOW()
             WHERE student_id = ? AND topic_id = ? AND topic_type = ?`,
            [parsedDeadline, notes || null, courseId, studentId, topicId, validType]
          );
        } else {
          throw err;
        }
      }
    }

    await connection.commit();

    res.json({ 
      success: true, 
      message: 'Deadlines set successfully',
      deadlinesCount: deadlines.length
    });
  } catch (error) {
    await connection.rollback();
    console.error('[AI] Error setting deadlines:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error setting deadlines',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    connection.release();
  }
});

/**
 * POST /api/ai/enrollments/setup/payments
 * Set payment installments or mark as all paid
 * Requires permission: enrollments.setup
 */
router.post('/enrollments/setup/payments', aiRequirePermission('enrollments.setup'), validatePaymentSetup, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { courseId, studentId, paymentType, installments } = req.body;

    if (!courseId || !studentId || !paymentType) {
      return res.status(400).json({ 
        success: false, 
        message: 'courseId, studentId, and paymentType are required' 
      });
    }

    if (paymentType !== 'all_paid' && paymentType !== 'installment') {
      return res.status(400).json({ 
        success: false, 
        message: 'paymentType must be "all_paid" or "installment"' 
      });
    }

    if (paymentType === 'installment' && (!Array.isArray(installments) || installments.length === 0)) {
      return res.status(400).json({ 
        success: false, 
        message: 'installments array is required when paymentType is "installment"' 
      });
    }

    // Set AI action metadata
    req.aiActionType = 'payment_setup';
    req.aiAffectedIds = { studentId, courseId };

    await connection.beginTransaction();

    // Get student and course names
    const [studentRows] = await connection.execute('SELECT name FROM users WHERE id = ?', [studentId]);
    const [courseRows] = await connection.execute('SELECT title FROM courses WHERE id = ?', [courseId]);

    const studentName = studentRows[0]?.name || `Student ${studentId}`;
    const courseName = courseRows[0]?.title || `Course ${courseId}`;

    // Delete existing payment installments for this enrollment
    await connection.execute(
      `DELETE FROM student_payment_installments 
       WHERE student_id = ? AND course_id = ?`,
      [studentId, courseId]
    );

    if (paymentType === 'all_paid') {
      req.aiActionDescription = `AI marked payment as all paid for student ${studentName} in course ${courseName}`;

      // Create a single "All Paid" installment record
      await connection.execute(
        `INSERT INTO student_payment_installments 
         (student_id, course_id, installment_number, installment_name, amount, due_date, status, payment_type, paid_at)
         VALUES (?, ?, 1, 'All Fees Paid', 0, NULL, 'paid', 'all_paid', NOW())`,
        [studentId, courseId]
      );
    } else {
      // Insert installment records
      req.aiActionDescription = `AI set ${installments.length} payment installment(s) for student ${studentName} in course ${courseName}`;

      for (let i = 0; i < installments.length; i++) {
        const inst = installments[i];
        const installmentStatus = inst.status || 'due';
        await connection.execute(
          `INSERT INTO student_payment_installments 
           (student_id, course_id, installment_number, installment_name, amount, due_date, status, payment_type, paid_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'installment', ?)`,
          [
            studentId,
            courseId,
            inst.installment_number || (i + 1),
            inst.installment_name,
            inst.amount,
            inst.due_date || null,
            installmentStatus,
            installmentStatus === 'paid' ? new Date() : null
          ]
        );
      }
    }

    await connection.commit();

    res.json({ 
      success: true, 
      message: 'Payment setup saved successfully',
      paymentType,
      installmentsCount: paymentType === 'installment' ? installments.length : 0
    });
  } catch (error) {
    await connection.rollback();
    console.error('[AI] Error setting payment:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error setting payment',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    connection.release();
  }
});

/**
 * POST /api/ai/enrollments/payments/installments/add
 * Add a single installment row (append) to an existing installment plan
 * Requires permission: enrollments.setup
 */
router.post('/enrollments/payments/installments/add', aiRequirePermission('enrollments.setup'), validateAddInstallment, async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { courseId, studentId, installment_name, amount, due_date, status, paid_at, payment_reference, notes } = req.body;

    req.aiActionType = 'installment_added';
    req.aiAffectedIds = { studentId, courseId };

    await connection.beginTransaction();

    // If "all_paid" exists for this enrollment, do not allow adding installment rows
    const [allPaidRows] = await connection.execute(
      `SELECT id FROM student_payment_installments
       WHERE student_id = ? AND course_id = ? AND payment_type = 'all_paid'
       LIMIT 1`,
      [studentId, courseId]
    );
    if (allPaidRows.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Payment type is all_paid for this enrollment. Cannot add installment rows unless you replace the payment plan.'
      });
    }

    const [maxRows] = await connection.execute(
      `SELECT COALESCE(MAX(installment_number), 0) as max_number
       FROM student_payment_installments
       WHERE student_id = ? AND course_id = ? AND payment_type = 'installment'`,
      [studentId, courseId]
    );

    const nextNumber = (maxRows[0]?.max_number || 0) + 1;
    const finalStatus = status || 'due';
    const finalPaidAt = finalStatus === 'paid' ? (paid_at ? new Date(paid_at) : new Date()) : null;

    const [insertResult] = await connection.execute(
      `INSERT INTO student_payment_installments
        (student_id, course_id, installment_number, installment_name, amount, due_date, status, payment_type, paid_at, payment_reference, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'installment', ?, ?, ?)`,
      [
        studentId,
        courseId,
        nextNumber,
        installment_name,
        amount,
        due_date || null,
        finalStatus,
        finalPaidAt,
        payment_reference || null,
        notes || null
      ]
    );

    req.aiAffectedIds.installmentId = insertResult.insertId;
    req.aiActionDescription = `AI added installment #${nextNumber} for student ${studentId} course ${courseId}`;

    await connection.commit();

    await invalidateCache('cache:/api/student/installments*');
    await invalidateCache('cache:/api/admin/payments*');
    await invalidateCache('cache:/api/admin/students/*');
    await invalidateCache('cache:/api/tutor/payments*');
    await invalidateCache('cache:/api/tickets/student/*/payment-installments*');

    res.json({
      success: true,
      message: 'Installment row added successfully',
      installmentId: insertResult.insertId,
      installment_number: nextNumber
    });
  } catch (error) {
    await connection.rollback();
    console.error('[AI] Error adding installment row:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding installment row',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    connection.release();
  }
});

/**
 * PUT /api/ai/enrollments/payments/installments/:installmentId/status
 * Mark an installment as paid/due/overdue (for "click Paid" workflow)
 * Requires permission: enrollments.setup
 */
router.put('/enrollments/payments/installments/:installmentId/status', aiRequirePermission('enrollments.setup'), validateUpdateInstallmentStatus, async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { installmentId } = req.params;
    const { courseId, studentId, status, paid_at, payment_reference, notes } = req.body;

    req.aiActionType = 'installment_status_updated';
    req.aiAffectedIds = { studentId, courseId, installmentId };
    req.aiActionDescription = `AI updated installment ${installmentId} status to ${status} for student ${studentId} course ${courseId}`;

    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT id FROM student_payment_installments
       WHERE id = ? AND student_id = ? AND course_id = ?`,
      [installmentId, studentId, courseId]
    );
    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Installment not found for this student/course'
      });
    }

    const updateFields = ['status = ?'];
    const updateValues = [status];

    if (status === 'paid') {
      updateFields.push('paid_at = ?');
      updateValues.push(paid_at ? new Date(paid_at) : new Date());
    } else {
      updateFields.push('paid_at = NULL');
    }

    if (payment_reference !== undefined) {
      updateFields.push('payment_reference = ?');
      updateValues.push(payment_reference);
    }

    if (notes !== undefined) {
      updateFields.push('notes = ?');
      updateValues.push(notes);
    }

    updateValues.push(installmentId);

    await connection.execute(
      `UPDATE student_payment_installments
       SET ${updateFields.join(', ')}, updated_at = NOW()
       WHERE id = ?`,
      updateValues
    );

    await connection.commit();

    await invalidateCache('cache:/api/student/installments*');
    await invalidateCache('cache:/api/admin/payments*');
    await invalidateCache('cache:/api/admin/students/*');
    await invalidateCache('cache:/api/tutor/payments*');
    await invalidateCache('cache:/api/tickets/student/*/payment-installments*');

    res.json({
      success: true,
      message: 'Installment status updated successfully'
    });
  } catch (error) {
    await connection.rollback();
    console.error('[AI] Error updating installment status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating installment status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    connection.release();
  }
});

// =====================================================
// MIDDLEWARE TO LOG ALL AI ACTIONS
// =====================================================

// Log all AI actions after response is sent
router.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  
  res.json = function(data) {
    // Log action asynchronously
    setImmediate(async () => {
      try {
        await AILogger.logAction({
          tokenId: req.aiToken?.id,
          tokenName: req.aiToken?.name || 'Unknown',
          actionType: req.aiActionType || 'unknown',
          actionDescription: req.aiActionDescription || `${req.method} ${req.path}`,
          endpoint: req.originalUrl || req.path,
          method: req.method,
          ipAddress: req.aiTokenIp || req.ip || 'unknown',
          userAgent: req.headers['user-agent'],
          requestBody: req.body,
          responseStatus: res.statusCode,
          responseTimeMs: Date.now() - (req.startTime || Date.now()),
          responseBody: data,
          errorMessage: data.success === false ? data.message : null,
          affectedIds: req.aiAffectedIds || {}
        });
      } catch (error) {
        console.error('[AI] Error logging action:', error);
      }
    });

    return originalJson(data);
  };

  next();
});

// Track request start time
router.use((req, res, next) => {
  req.startTime = Date.now();
  next();
});

module.exports = router;
