const express = require('express');
const pool = require('../config/db');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');
const cloudinary = require('../config/cloudinary');
const https = require('https');
const http = require('http');
const router = express.Router();
const tutorRouter = express.Router(); // Separate router for tutor routes
const ALLOWED_UNLOCK_METHODS = new Set(['initial', 'automatic', 'manual', 'free']);
const auth = require('../middleware/auth');
const { permit } = require('../middleware/roles');
const pagination = require('../middleware/pagination');
const { cacheMiddleware, invalidateCache } = require('../middleware/cache');


// Configure multer for file uploads (memory storage for Cloudinary)
const storage = multer.memoryStorage();

const upload = multer({ 
  storage: storage, // Memory storage only - files go directly to Cloudinary
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit (Cloudinary free tier allows up to 10MB, but we'll handle larger files)
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.mbz', '.json', '.zip', '.pdf', '.mp4', '.doc', '.docx', '.ppt', '.pptx', '.jpg', '.jpeg', '.png', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type.'));
    }
  }
});

// Helper function to upload to Cloudinary
// NOTE: All files are uploaded to Cloudinary only. No local storage.
async function uploadToCloudinary(file, folder = 'lms') {
  return new Promise((resolve, reject) => {
    // Determine resource type based on file extension
    const ext = path.extname(file.originalname).toLowerCase();
    let resourceType = 'auto';
    
    // For videos, use 'video' type for better streaming support
    const videoTypes = ['.mp4', '.mov', '.avi', '.wmv', '.flv', '.webm'];
    if (videoTypes.includes(ext)) {
      resourceType = 'video';
    }
    // For PDFs and documents, use 'raw' to ensure proper access
    else {
      const rawTypes = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt', '.zip', '.rar', '.mbz'];
      if (rawTypes.includes(ext)) {
        resourceType = 'raw';
      }
    }
    
    // Check file size - Cloudinary free tier has 10MB limit for raw files
    const fileSizeMB = file.buffer.length / (1024 * 1024);
    if (resourceType === 'raw' && fileSizeMB > 10) {
      return reject(new Error(`File size (${fileSizeMB.toFixed(2)}MB) exceeds Cloudinary free tier limit of 10MB for raw files. Please use a smaller file or upgrade your Cloudinary plan.`));
    }
    
    // Videos can be larger, but warn if very large
    if (resourceType === 'video' && fileSizeMB > 100) {
      console.warn(`Large video file detected: ${fileSizeMB.toFixed(2)}MB. Upload may take longer.`);
    }
    
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
        resource_type: resourceType,
        // Use the public upload preset
        upload_preset: 'lms_public_files',
        // For videos, enable eager transformations for better streaming
        ...(resourceType === 'video' && {
          eager: [{ format: 'mp4' }],
          eager_async: false,
        }),
        // For large files, use chunked upload
        chunk_size: 6000000, // 6MB chunks
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          reject(error);
        } else {
          resolve(result);
        }
      }
    );
    uploadStream.end(file.buffer);
  });
}

// Test route to verify admin API is working
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Admin API is working!' });
});

// ===============================
// USER MANAGEMENT
// ===============================

// Get all roles
router.get('/roles', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM roles ORDER BY id');
    res.json({ success: true, roles: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error fetching roles' });
  }
});

// Get all managers (for dropdown selection)
router.get('/managers', auth, permit('Admin'), cacheMiddleware(60), async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT u.id, u.name, u.email, r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE r.name = 'Manager'
      ORDER BY u.name ASC
    `);
    res.json({ success: true, managers: rows });
  } catch (err) {
    console.error('Error fetching managers:', err);
    res.status(500).json({ success: false, message: 'Error fetching managers' });
  }
});

// Get all users with roles (with pagination)
router.get('/users', auth, permit('Admin'), pagination, cacheMiddleware(30), async (req, res) => {
  try {
    const { page, limit, offset } = req.pagination;
    
    // Get total count
    const [countResult] = await pool.execute('SELECT COUNT(*) as total FROM users');
    const total = countResult[0].total;
    
    // Get paginated results with manager name
    // Ensure limit and offset are always valid integers
    const finalLimit = Math.max(1, Math.min(1000, parseInt(limit, 10) || 50));
    const finalOffset = Math.max(0, parseInt(offset, 10) || 0);
    
    // MySQL LIMIT/OFFSET can be problematic with prepared statements
    // Use template literals for LIMIT/OFFSET to avoid parameter binding issues
    const query = `
      SELECT 
        u.id, u.name, u.email, u.role_id, u.manager_id, u.created_at, u.updated_at, 
        r.name as role_name,
        m.name as manager_name
      FROM users u 
      LEFT JOIN roles r ON u.role_id = r.id 
      LEFT JOIN users m ON u.manager_id = m.id
      ORDER BY u.created_at DESC 
      LIMIT ${finalLimit} OFFSET ${finalOffset}
    `;
    
    const [rows] = await pool.execute(query);
    
    res.json({
      success: true,
      users: rows,
      pagination: {
        page: parseInt(page),
        limit: finalLimit,
        total,
        totalPages: Math.ceil(total / finalLimit),
        hasNext: parseInt(page) < Math.ceil(total / finalLimit),
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create new user
router.post('/users', async (req, res) => {
  try {
    const { name, email, password, role_id, manager_id } = req.body;
    
    if (!name || !email || !password || !role_id) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    // Check if user already exists
    const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const [result] = await pool.execute(
      'INSERT INTO users (name, email, password_hash, role_id, manager_id) VALUES (?, ?, ?, ?, ?)',
      [name, email, hashedPassword, role_id, manager_id || null]
    );

    await invalidateCache('cache:/api/admin/users*');
    
    // Log user creation - capture user info before async logging
    const userId = req.user?.id || null;
    const userRoleId = req.user?.role_id || null;
    const { logSystemEvent, getRoleName } = require('../utils/eventLogger');
    const userRole = userRoleId ? getRoleName(userRoleId) : null;
    const roleLabel = userRole ? userRole.charAt(0).toUpperCase() + userRole.slice(1) : 'User';
    
    setImmediate(async () => {
      await logSystemEvent({
        userId: userId,
        role: userRole,
        action: 'user_created',
        description: `${roleLabel} created user: ${name} (ID: ${result.insertId}, Role ID: ${role_id})`,
        req
      });
    });
    
    // If student user, create initial profile entry
    // Check if role is Student, ManagerStudent, or InstituteStudent
    try {
      const [roleRows] = await pool.execute('SELECT name FROM roles WHERE id = ?', [role_id]);
      const roleName = roleRows.length > 0 ? roleRows[0].name : null;
      const studentRoleNames = ['Student', 'ManagerStudent', 'InstituteStudent'];
      
      if (roleName && studentRoleNames.includes(roleName)) {
        await pool.execute(
          'INSERT INTO student_profiles (user_id, is_profile_complete) VALUES (?, 0)',
          [result.insertId]
        );
        console.log(`[Admin] Created initial profile for student user ID: ${result.insertId}`);
      }
    } catch (profileErr) {
      // Log error but don't fail user creation
      console.error('[Admin] Error creating student profile:', profileErr);
    }
    
    res.json({ success: true, message: 'User created successfully', userId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error creating user' });
  }
});

// Update user
router.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role_id, manager_id } = req.body;

    await pool.execute(
      'UPDATE users SET name = ?, email = ?, role_id = ?, manager_id = ? WHERE id = ?',
      [name, email, role_id, manager_id || null, id]
    );

    await invalidateCache('cache:/api/admin/users*');
    
    // Log user update - capture user info before async logging
    const userId = req.user?.id || null;
    const userRoleId = req.user?.role_id || null;
    const { logSystemEvent, getRoleName } = require('../utils/eventLogger');
    const userRole = userRoleId ? getRoleName(userRoleId) : null;
    const roleLabel = userRole ? userRole.charAt(0).toUpperCase() + userRole.slice(1) : 'User';
    
    setImmediate(async () => {
      await logSystemEvent({
        userId: userId,
        role: userRole,
        action: 'user_updated',
        description: `${roleLabel} updated user ID: ${id} (Role ID: ${role_id})`,
        req
      });
    });
    
    res.json({ success: true, message: 'User updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error updating user' });
  }
});

// Delete user
router.delete('/users/:id', auth, permit('Admin'), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const userId = parseInt(id);
    
    if (!userId || isNaN(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }
    
    // Check if user exists
    const [userCheck] = await connection.execute('SELECT id, name FROM users WHERE id = ?', [userId]);
    if (userCheck.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    await connection.beginTransaction();
    
    // Check for dependent records that might prevent deletion
    // 1. Check if user is a manager (has students assigned)
    const [managerCheck] = await connection.execute(
      'SELECT COUNT(*) as count FROM users WHERE manager_id = ?',
      [userId]
    );
    if (managerCheck[0].count > 0) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: `Cannot delete user: This user is a manager for ${managerCheck[0].count} student(s). Please reassign or remove those students first.` 
      });
    }
    
    // 2. Set manager_id to NULL for any users that reference this user as manager
    await connection.execute('UPDATE users SET manager_id = NULL WHERE manager_id = ?', [userId]);
    
    // 3. Set created_by to NULL for courses created by this user
    await connection.execute('UPDATE courses SET created_by = NULL WHERE created_by = ?', [userId]);
    
    // 4. Set assigned_by to NULL for course assignments
    await connection.execute('UPDATE course_assignments SET assigned_by = NULL WHERE assigned_by = ?', [userId]);
    
    // Now delete the user
    await connection.execute('DELETE FROM users WHERE id = ?', [userId]);
    
    await connection.commit();
    await invalidateCache('cache:/api/admin/users*');
    
    // Log user deletion - capture user info before async logging
    const adminUserId = req.user?.id || null;
    const userRoleId = req.user?.role_id || null;
    const { logSystemEvent, getRoleName } = require('../utils/eventLogger');
    const userRole = userRoleId ? getRoleName(userRoleId) : null;
    const roleLabel = userRole ? userRole.charAt(0).toUpperCase() + userRole.slice(1) : 'User';
    
    setImmediate(async () => {
      await logSystemEvent({
        userId: adminUserId,
        role: userRole,
        action: 'user_deleted',
        description: `${roleLabel} deleted user ID: ${userId} (${userCheck[0].name})`,
        req
      });
    });
    
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    await connection.rollback();
    console.error('Error deleting user:', err);
    console.error('Error details:', err.message);
    console.error('Error code:', err.code);
    
    // Provide more specific error messages
    let errorMessage = 'Error deleting user';
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
      errorMessage = 'Cannot delete user: This user has related records in the system. Please remove or reassign related data first.';
    } else if (err.message) {
      errorMessage = `Error deleting user: ${err.message}`;
    }
    
    res.status(500).json({ success: false, message: errorMessage, error: err.message });
  } finally {
    connection.release();
  }
});

// ===============================
// STUDENT MANAGEMENT & ENROLLMENT
// ===============================

router.get('/students', cacheMiddleware(30), async (_req, res) => {
  try {
    const targetRoles = ['Student', 'ManagerStudent', 'InstituteStudent'];
    const placeholders = targetRoles.map(() => '?').join(', ');
    const [rows] = await pool.execute(
      `
        SELECT 
          u.id,
          u.name,
          u.email,
          r.name AS role_name,
          u.created_at
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        WHERE r.name IN (${placeholders})
        ORDER BY u.name ASC
      `,
      targetRoles
    );
    res.json({ success: true, students: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error fetching students' });
  }
});

router.get('/courses/:courseId/enrollments', cacheMiddleware(60), async (req, res) => {
  try {
    const { courseId } = req.params;
    const [rows] = await pool.execute(
      `
        SELECT 
          u.id,
          u.name,
          u.email,
          r.name AS role_name,
          ca.status,
          ca.grade
        FROM course_assignments ca
        JOIN users u ON ca.student_id = u.id
        LEFT JOIN roles r ON u.role_id = r.id
        WHERE ca.course_id = ?
        ORDER BY u.name ASC
      `,
      [courseId]
    );
    res.json({ success: true, enrollments: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error fetching course enrollments' });
  }
});

router.post('/enrollments', auth, async (req, res) => {
  const { courseId, studentIds } = req.body;

  if (!courseId || !Array.isArray(studentIds) || studentIds.length === 0) {
    return res.status(400).json({ success: false, message: 'courseId and studentIds are required' });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Check if course is CPD or Qualification type and has topics/units with deadlines
    const [courseRows] = await connection.execute(
      `SELECT course_type FROM courses WHERE id = ?`,
      [courseId]
    );
    
    const courseType = courseRows[0]?.course_type;
    let topicsWithDeadlines = [];
    
    // If CPD course, get all topics (with or without deadlines)
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
    }
    
    // If Qualification course, get all units (with or without deadlines)
    if (courseType === 'qualification') {
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
          topic_number: u.order_index !== null && u.order_index !== undefined ? u.order_index + 1 : index + 1,
          title: u.title,
          deadline: u.deadline || null,
          type: 'qualification_unit'
        }));
      } catch (unitErr) {
        console.error('[Enrollment] Error fetching qualification units:', unitErr);
        // If units table doesn't exist or has different structure, continue without topics
        topicsWithDeadlines = [];
      }
    }

    for (const studentId of studentIds) {
      await connection.execute(
        `
          INSERT INTO course_assignments (course_id, student_id, status)
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE status = VALUES(status)
        `,
        [courseId, studentId, 'Enrolled']
      );
    }

    await connection.commit();
    
    // Fetch student names for logging
    const studentNames = [];
    if (studentIds.length > 0) {
      const placeholders = studentIds.map(() => '?').join(',');
      const [studentRows] = await pool.execute(
        `SELECT id, name FROM users WHERE id IN (${placeholders})`,
        studentIds
      );
      studentNames.push(...studentRows.map(s => s.name));
    }
    
    // Log enrollment - capture user info before async logging
    const userId = req.user?.id || null;
    const userRoleId = req.user?.role_id || null;
    const { logSystemEvent, getRoleName } = require('../utils/eventLogger');
    const userRole = userRoleId ? getRoleName(userRoleId) : null;
    
    // Build description with student names
    let description;
    if (studentNames.length > 0) {
      if (studentNames.length === 1) {
        description = `enrolled student ${studentNames[0]} in course ${courseId}`;
      } else if (studentNames.length <= 3) {
        description = `enrolled students ${studentNames.join(', ')} in course ${courseId}`;
      } else {
        description = `enrolled ${studentNames.length} students (${studentNames.slice(0, 2).join(', ')}, and ${studentNames.length - 2} more) in course ${courseId}`;
      }
    } else {
      description = `enrolled ${studentIds.length} student(s) in course ${courseId}`;
    }
    
    setImmediate(async () => {
      await logSystemEvent({
        userId: userId,
        role: userRole,
        action: 'student_enrolled',
        description: description,
        req
      });
    });
    
    // If course has topics with deadlines, return them so frontend can show popup
    if (topicsWithDeadlines.length > 0) {
      res.json({ 
        success: true, 
        message: 'Students enrolled successfully',
        requiresDeadlineSetup: true,
        topics: topicsWithDeadlines,
        studentIds: studentIds
      });
    } else {
      res.json({ success: true, message: 'Students enrolled successfully' });
    }
  } catch (err) {
    await connection.rollback();
    console.error('[Enrollment] Error:', err);
    console.error('[Enrollment] Error stack:', err.stack);
    res.status(500).json({ 
      success: false, 
      message: 'Error enrolling students',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  } finally {
    connection.release();
  }
});

// Set student-specific topic deadlines
router.post('/enrollments/:courseId/:studentId/deadlines', auth, async (req, res) => {
  try {
    const { courseId, studentId } = req.params;
    const { deadlines } = req.body; // Array of { topicId, deadline, notes?, topicType? }

    if (!deadlines || !Array.isArray(deadlines)) {
      return res.status(400).json({ success: false, message: 'deadlines array is required' });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const userId = req.user?.id || null;

      for (const item of deadlines) {
        const { topicId, deadline, notes, topicType = 'cpd_topic' } = item;
        
        if (!topicId) {
          console.log(`[Deadlines] Skipping invalid entry: missing topicId`, { topicId, deadline, topicType });
          continue; // Skip entries without topicId
        }

        // If deadline is null or empty, delete the existing deadline record
        if (!deadline || deadline === null || deadline === '') {
          console.log(`[Deadlines] Clearing deadline for student ${studentId}, course ${courseId}, topic ${topicId}, type: ${topicType}`);
          
          await connection.execute(
            `DELETE FROM student_topic_deadlines 
             WHERE student_id = ? AND course_id = ? AND topic_id = ? AND topic_type = ?`,
            [studentId, courseId, topicId, topicType]
          );
          
          console.log(`[Deadlines] Successfully cleared deadline for topic ${topicId} with type ${topicType}`);
          continue;
        }

        console.log(`[Deadlines] Saving deadline for student ${studentId}, course ${courseId}, topic ${topicId}, type: ${topicType}, deadline: ${deadline}`);

        await connection.execute(
          `INSERT INTO student_topic_deadlines 
           (student_id, course_id, topic_id, topic_type, deadline, set_by, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE 
             deadline = VALUES(deadline),
             topic_type = VALUES(topic_type),
             set_by = VALUES(set_by),
             notes = VALUES(notes),
             updated_at = NOW()`,
          [studentId, courseId, topicId, topicType, deadline, userId, notes || null]
        );
        
        console.log(`[Deadlines] Successfully saved deadline for topic ${topicId} with type ${topicType}`);
      }

      await connection.commit();
      res.json({ success: true, message: 'Deadlines set successfully' });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Error setting deadlines:', err);
    res.status(500).json({ success: false, message: 'Error setting deadlines' });
  }
});

// Get student-specific deadlines for a course
router.get('/enrollments/:courseId/:studentId/deadlines', auth, async (req, res) => {
  try {
    const { courseId, studentId } = req.params;

    // Get CPD topic deadlines
    const [cpdRows] = await pool.execute(
      `SELECT 
         std.id,
         std.topic_id,
         std.topic_type,
         std.deadline,
         std.notes,
         std.set_by,
         std.created_at,
         std.updated_at,
         t.topic_number,
         t.title as topic_title
       FROM student_topic_deadlines std
       JOIN cpd_topics t ON std.topic_id = t.id AND std.topic_type = 'cpd_topic'
       WHERE std.student_id = ? AND std.course_id = ?
       ORDER BY t.order_index`,
      [studentId, courseId]
    );

    // Get qualification unit deadlines
    const [qualRows] = await pool.execute(
      `SELECT 
         std.id,
         std.topic_id,
         std.topic_type,
         std.deadline,
         std.notes,
         std.set_by,
         std.created_at,
         std.updated_at,
         u.unit_number as topic_number,
         u.title as topic_title
       FROM student_topic_deadlines std
       JOIN units u ON std.topic_id = u.id AND std.topic_type = 'qualification_unit'
       WHERE std.student_id = ? AND std.course_id = ?
       ORDER BY u.order_index`,
      [studentId, courseId]
    );

    res.json({ success: true, deadlines: [...cpdRows, ...qualRows] });
  } catch (err) {
    console.error('Error fetching deadlines:', err);
    res.status(500).json({ success: false, message: 'Error fetching deadlines' });
  }
});

router.delete('/enrollments/:courseId/:studentId', auth, async (req, res) => {
  try {
    const { courseId, studentId } = req.params;
    await pool.execute('DELETE FROM course_assignments WHERE course_id = ? AND student_id = ?', [courseId, studentId]);
    
    // Fetch student name for logging
    let studentName = null;
    try {
      const [studentRows] = await pool.execute('SELECT name FROM users WHERE id = ?', [studentId]);
      if (studentRows.length > 0) {
        studentName = studentRows[0].name;
      }
    } catch (err) {
      // Silently fail - will use studentId in description
    }
    
    // Log unenrollment - capture user info before async logging
    const userId = req.user?.id || null;
    const userRoleId = req.user?.role_id || null;
    const { logSystemEvent, getRoleName } = require('../utils/eventLogger');
    const userRole = userRoleId ? getRoleName(userRoleId) : null;
    
    const studentLabel = studentName || `student ${studentId}`;
    
    setImmediate(async () => {
      await logSystemEvent({
        userId: userId,
        role: userRole,
        action: 'student_unenrolled',
        description: `unenrolled ${studentLabel} from course ${courseId}`,
        req
      });
    });
    
    res.json({ success: true, message: 'Student unenrolled successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error unenrolling student' });
  }
});

router.get('/tutor/:tutorId/courses', cacheMiddleware(60), async (_req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        c.*,
        u.name as created_by_name,
        cat.name as category_name,
        subcat.name as sub_category_name
      FROM courses c
      LEFT JOIN users u ON c.created_by = u.id 
      LEFT JOIN course_categories cat ON c.category_id = cat.id
      LEFT JOIN sub_categories subcat ON c.sub_category_id = subcat.id
      ORDER BY c.created_at DESC
    `);
    res.json({ success: true, courses: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error fetching tutor courses' });
  }
});

router.get('/tutor/:tutorId/courses/:courseId/enrollments', async (req, res) => {
  try {
    const { courseId } = req.params;
    const [rows] = await pool.execute(
      `
        SELECT 
          u.id,
          u.name,
          u.email,
          r.name AS role_name,
          ca.status,
          ca.grade
        FROM course_assignments ca
        JOIN users u ON ca.student_id = u.id
        LEFT JOIN roles r ON u.role_id = r.id
        WHERE ca.course_id = ?
        ORDER BY u.name ASC
      `,
      [courseId]
    );
    res.json({ success: true, enrollments: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error fetching tutor course enrollments' });
  }
});

router.get('/tutor/:tutorId/assignments', cacheMiddleware(60), async (req, res) => {
  try {
    const { tutorId } = req.params;
    const [rows] = await pool.execute(
      `
        SELECT 
          a.id,
          a.course_id,
          c.title AS course_title,
          a.title,
          a.due_date,
          AVG(s.grade) AS average_grade,
          COUNT(s.id) AS submission_count
        FROM assignments a
        JOIN courses c ON a.course_id = c.id
        LEFT JOIN assignment_submissions s ON s.assignment_id = a.id
        GROUP BY a.id, a.course_id, c.title, a.title, a.due_date
        ORDER BY a.due_date IS NULL, a.due_date ASC, a.created_at DESC
      `,
      [tutorId]
    );
    res.json({ success: true, assignments: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error fetching tutor assignments' });
  }
});

router.get('/tutor/:tutorId/quizzes', cacheMiddleware(60), async (req, res) => {
  try {
    const { tutorId } = req.params;
    const [rows] = await pool.execute(
      `
        SELECT 
          q.id,
          q.course_id,
          c.title AS course_title,
          q.title,
          AVG(qs.score) AS average_score,
          COUNT(qs.id) AS attempt_count
        FROM quizzes q
        JOIN courses c ON q.course_id = c.id
        LEFT JOIN quiz_submissions qs ON qs.quiz_id = q.id
        GROUP BY q.id, q.course_id, c.title, q.title
        ORDER BY q.created_at DESC
      `,
      [tutorId]
    );
    res.json({ success: true, quizzes: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error fetching tutor quizzes' });
  }
});

router.get('/tutor/:tutorId/assignment-submissions', async (req, res) => {
  try {
    const { tutorId } = req.params;
    const [rows] = await pool.execute(
      `
        SELECT 
          a.id AS assignment_id,
          a.title AS assignment_title,
          c.id AS course_id,
          c.title AS course_title,
          stu.id AS student_id,
          stu.name AS student_name,
          stu.email AS student_email,
          MAX(s.submitted_at) AS submitted_at,
          MAX(s.grade) AS grade,
          MAX(CASE WHEN s.id IS NULL THEN 0 ELSE 1 END) AS is_submitted,
          MAX(CASE WHEN s.grade IS NOT NULL AND s.grade >= 50 THEN 1 ELSE 0 END) AS is_pass
        FROM assignments a
        JOIN courses c ON a.course_id = c.id
        JOIN course_assignments ca ON ca.course_id = c.id
        JOIN users stu ON stu.id = ca.student_id
        LEFT JOIN assignment_submissions s ON s.assignment_id = a.id AND s.student_id = stu.id
        GROUP BY a.id, a.title, c.id, c.title, stu.id, stu.name, stu.email
        ORDER BY c.title ASC, a.title ASC, stu.name ASC
      `,
      [tutorId]
    );
    res.json({ success: true, submissions: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error fetching assignment submissions' });
  }
});

router.get('/tutor/:tutorId/quiz-attempts', async (req, res) => {
  try {
    const { tutorId } = req.params;
    const [rows] = await pool.execute(
      `
        SELECT 
          q.id AS quiz_id,
          q.title AS quiz_title,
          q.quiz_type,
          q.passing_score,
          c.id AS course_id,
          c.title AS course_title,
          stu.id AS student_id,
          stu.name AS student_name,
          stu.email AS student_email,
          COUNT(qs.id) AS attempt_count,
          MAX(qs.score) AS last_score,
          MAX(CASE WHEN qs.score IS NOT NULL AND qs.score >= COALESCE(q.passing_score, 70) THEN 1 ELSE 0 END) AS is_pass
        FROM quizzes q
        JOIN courses c ON q.course_id = c.id
        JOIN course_assignments ca ON ca.course_id = c.id
        JOIN users stu ON stu.id = ca.student_id
        LEFT JOIN quiz_submissions qs ON qs.quiz_id = q.id AND qs.student_id = stu.id
        WHERE COALESCE(q.quiz_type, 'practice') = 'final'
        GROUP BY q.id, q.title, q.quiz_type, q.passing_score, c.id, c.title, stu.id, stu.name, stu.email
        ORDER BY c.title ASC, q.title ASC, stu.name ASC
      `,
      [tutorId]
    );
    res.json({ success: true, attempts: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error fetching quiz attempts' });
  }
});

// Admin - Get ALL assignment submissions (across all courses)
// Includes both regular assignments AND qualification submissions (like tutor dashboard)
router.get('/all-assignment-submissions', auth, permit('Admin'), cacheMiddleware(120), async (req, res) => {
  try {
    // Get regular assignment submissions (same query as tutor route)
    const [regularRows] = await pool.execute(
      `
        SELECT 
          a.id AS assignment_id,
          a.title AS assignment_title,
          c.id AS course_id,
          c.title AS course_title,
          stu.id AS student_id,
          stu.name AS student_name,
          stu.email AS student_email,
          MAX(s.submitted_at) AS submitted_at,
          MAX(s.grade) AS grade,
          MAX(CASE WHEN s.id IS NULL THEN 0 ELSE 1 END) AS is_submitted,
          MAX(CASE WHEN s.grade IS NOT NULL AND s.grade >= 50 THEN 1 ELSE 0 END) AS is_pass
        FROM assignments a
        JOIN courses c ON a.course_id = c.id
        JOIN course_assignments ca ON ca.course_id = c.id
        JOIN users stu ON stu.id = ca.student_id
        LEFT JOIN assignment_submissions s ON s.assignment_id = a.id AND s.student_id = stu.id
        GROUP BY a.id, a.title, c.id, c.title, stu.id, stu.name, stu.email
        ORDER BY c.title ASC, a.title ASC, stu.name ASC
      `
    );
    
    // Get qualification submissions (like tutor dashboard shows)
    let qualRows = [];
    try {
      const [qualSubmissions] = await pool.execute(
        `SELECT 
          s.id AS assignment_id,
          CONCAT('Qualification: ', u.title) AS assignment_title,
          c.id AS course_id,
          c.title AS course_title,
          st.id AS student_id,
          st.name AS student_name,
          st.email AS student_email,
          s.submitted_at,
          NULL AS grade,
          1 AS is_submitted,
          CASE WHEN s.pass_fail_result = 'pass' THEN 1 ELSE 0 END AS is_pass
         FROM qual_submissions s
         JOIN units u ON s.unit_id = u.id
         JOIN courses c ON u.course_id = c.id
         JOIN users st ON s.student_id = st.id
         WHERE s.submission_type = 'assignment'
         ORDER BY s.submitted_at DESC`
      );
      qualRows = qualSubmissions;
    } catch (qualErr) {
      // Table might not exist, continue without qualification submissions
    }
    
    // Combine both
    const allRows = [...regularRows, ...qualRows];
    
    res.json({ success: true, submissions: allRows });
  } catch (err) {
    console.error('Error fetching assignment submissions:', err);
    res.status(500).json({ success: false, message: 'Error fetching assignment submissions' });
  }
});

// Admin - Get ALL quiz attempts (across all courses)
// Includes both regular quizzes AND CPD quiz attempts (like tutor dashboard)
router.get('/all-quiz-attempts', auth, permit('Admin'), cacheMiddleware(120), async (req, res) => {
  try {
    // Get regular quiz attempts (same query as tutor route, but include submitted_at as completed_at for date filtering)
    const [regularRowsRaw] = await pool.execute(
      `
        SELECT 
          q.id AS quiz_id,
          q.title AS quiz_title,
          q.quiz_type,
          q.passing_score,
          c.id AS course_id,
          c.title AS course_title,
          stu.id AS student_id,
          stu.name AS student_name,
          stu.email AS student_email,
          COUNT(qs.id) AS attempt_count,
          MAX(qs.score) AS last_score,
          MAX(qs.submitted_at) AS submitted_at,
          MAX(CASE WHEN qs.score IS NOT NULL AND qs.score >= COALESCE(q.passing_score, 70) THEN 1 ELSE 0 END) AS is_pass
        FROM quizzes q
        JOIN courses c ON q.course_id = c.id
        JOIN course_assignments ca ON ca.course_id = c.id
        JOIN users stu ON stu.id = ca.student_id
        LEFT JOIN quiz_submissions qs ON qs.quiz_id = q.id AND qs.student_id = stu.id
        WHERE COALESCE(q.quiz_type, 'practice') = 'final'
        GROUP BY q.id, q.title, q.quiz_type, q.passing_score, c.id, c.title, stu.id, stu.name, stu.email
        ORDER BY c.title ASC, q.title ASC, stu.name ASC
      `
    );
    
    // Map submitted_at to completed_at for consistency with CPD quizzes
    const regularRows = regularRowsRaw.map((row) => ({
      ...row,
      completed_at: row.submitted_at
    }));
    
    // Get CPD quiz attempts (like tutor dashboard shows)
    let cpdRows = [];
    try {
      const [cpdAttemptsRaw] = await pool.execute(
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
          c.title as course_title
        FROM cpd_quiz_attempts qa
        JOIN cpd_quizzes q ON qa.quiz_id = q.id
        JOIN cpd_topics t ON q.topic_id = t.id
        JOIN courses c ON t.course_id = c.id
        JOIN users u ON qa.student_id = u.id
        WHERE q.quiz_type = 'final'
        ORDER BY qa.completed_at DESC`
      );
      
      // Group by quiz_id + student_id to match tutor dashboard structure
      const cpdGroups = new Map();
      cpdAttemptsRaw.forEach((attempt) => {
        const key = `${attempt.quiz_id}-${attempt.student_id}`;
        if (!cpdGroups.has(key)) {
          cpdGroups.set(key, {
            quiz_id: attempt.quiz_id,
            quiz_title: attempt.quiz_title,
            quiz_type: attempt.quiz_type,
            passing_score: attempt.passing_score,
            course_id: attempt.course_id,
            course_title: attempt.course_title,
            student_id: attempt.student_id,
            student_name: attempt.student_name,
            student_email: attempt.student_email,
            attempts: []
          });
        }
        cpdGroups.get(key).attempts.push(attempt);
      });
      
      // Convert to display format with attempt_count and last_score
      cpdRows = Array.from(cpdGroups.values()).map(group => {
        const sortedAttempts = group.attempts.sort((a, b) => 
          new Date(b.completed_at || 0).getTime() - new Date(a.completed_at || 0).getTime()
        );
        const latest = sortedAttempts[0];
        
        return {
          quiz_id: group.quiz_id,
          quiz_title: group.quiz_title,
          quiz_type: group.quiz_type,
          passing_score: group.passing_score,
          course_id: group.course_id,
          course_title: group.course_title,
          student_id: group.student_id,
          student_name: group.student_name,
          student_email: group.student_email,
          attempt_count: sortedAttempts.length,
          last_score: latest.percentage,
          is_pass: latest.status === 'passed' || (latest.percentage >= (group.passing_score || 70)) ? 1 : 0,
          completed_at: latest.completed_at
        };
      });
    } catch (cpdErr) {
      // Table might not exist, continue without CPD quiz attempts
    }
    
    // Combine both
    const allRows = [...regularRows, ...cpdRows];
    
    res.json({ success: true, attempts: allRows });
  } catch (err) {
    console.error('Error fetching quiz attempts:', err);
    res.status(500).json({ success: false, message: 'Error fetching quiz attempts' });
  }
});

// ===============================
// COURSE MANAGEMENT
// ===============================

// Get all course categories
router.get('/course-categories', cacheMiddleware(3600), async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM course_categories ORDER BY name');
    res.json({ success: true, categories: rows });
  } catch (err) {
    console.error(err);
    // If table doesn't exist, return empty array
    if (err.code === 'ER_NO_SUCH_TABLE') {
      res.json({ success: true, categories: [] });
    } else {
      res.status(500).json({ success: false, message: 'Error fetching categories' });
    }
  }
});

// Get all sub-categories (for dropdown lists)
router.get('/sub-categories', cacheMiddleware(3600), async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM sub_categories ORDER BY category_id, name');
    res.json({ success: true, subCategories: rows });
  } catch (err) {
    console.error(err);
    if (err.code === 'ER_NO_SUCH_TABLE') {
      res.json({ success: true, subCategories: [] });
    } else {
      res.status(500).json({ success: false, message: 'Error fetching sub-categories' });
    }
  }
});

// Get sub-categories by category
router.get('/sub-categories/:categoryId', async (req, res) => {
  try {
    const { categoryId } = req.params;
    const [rows] = await pool.execute('SELECT * FROM sub_categories WHERE category_id = ? ORDER BY name', [categoryId]);
    res.json({ success: true, subCategories: rows });
  } catch (err) {
    console.error(err);
    if (err.code === 'ER_NO_SUCH_TABLE') {
      res.json({ success: true, subCategories: [] });
    } else {
      res.status(500).json({ success: false, message: 'Error fetching sub-categories' });
    }
  }
});

// Create sub-category
router.post('/sub-categories', async (req, res) => {
  try {
    const { category_id, name, description } = req.body;
    
    // Validate that category exists
    if (!category_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Category ID is required' 
      });
    }
    
    // Check if category exists
    const [categoryCheck] = await pool.execute(
      'SELECT id FROM course_categories WHERE id = ?',
      [category_id]
    );
    
    if (categoryCheck.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Selected category does not exist. Please refresh and try again.' 
      });
    }
    
    const [result] = await pool.execute(
      'INSERT INTO sub_categories (category_id, name, description) VALUES (?, ?, ?)',
      [category_id, name, description || '']
    );
    res.json({ success: true, message: 'Sub-category created successfully', subCategoryId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error creating sub-category' });
  }
});

// Create course category
router.post('/course-categories', async (req, res) => {
  try {
    const { name, description } = req.body;
    const [result] = await pool.execute(
      'INSERT INTO course_categories (name, description) VALUES (?, ?)',
      [name, description]
    );
    res.json({ success: true, message: 'Category created successfully', categoryId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error creating category' });
  }
});

// Get CPD topics for a course
router.get('/courses/:courseId/cpd-topics', cacheMiddleware(60), async (req, res) => {
  try {
    const { courseId } = req.params;
    const [topicRows] = await pool.execute(
      `SELECT id, topic_number, title, deadline 
       FROM cpd_topics 
       WHERE course_id = ?
       ORDER BY order_index`,
      [courseId]
    );
    res.json({ success: true, topics: topicRows });
  } catch (err) {
    console.error('Error fetching CPD topics:', err);
    res.status(500).json({ success: false, message: 'Error fetching CPD topics' });
  }
});

// Get qualification units for a course
router.get('/courses/:courseId/qualification-units', cacheMiddleware(60), async (req, res) => {
  try {
    const { courseId } = req.params;
    const [unitRows] = await pool.execute(
      `SELECT id, order_index, title, deadline 
       FROM units 
       WHERE course_id = ?
       ORDER BY order_index`,
      [courseId]
    );
    const units = unitRows.map((u, index) => ({
      id: u.id,
      order_index: u.order_index,
      title: u.title,
      deadline: u.deadline || null
    }));
    res.json({ success: true, units });
  } catch (err) {
    console.error('Error fetching qualification units:', err);
    res.status(500).json({ success: false, message: 'Error fetching qualification units' });
  }
});

// Get all courses with categories
router.get('/courses', cacheMiddleware(60), async (req, res) => {
  try {
    // Try to get courses with categories and sub-categories first
    try {
      const [rows] = await pool.execute(`
        SELECT c.*, u.name as created_by_name, cat.name as category_name, subcat.name as sub_category_name
        FROM courses c 
        LEFT JOIN users u ON c.created_by = u.id 
        LEFT JOIN course_categories cat ON c.category_id = cat.id
        LEFT JOIN sub_categories subcat ON c.sub_category_id = subcat.id
        ORDER BY c.created_at DESC
      `);
      res.json({ success: true, courses: rows });
    } catch (tableErr) {
      // If course_categories table doesn't exist, use simpler query
      if (tableErr.code === 'ER_NO_SUCH_TABLE') {
        const [rows] = await pool.execute(`
          SELECT c.*, u.name as created_by_name, NULL as category_name, NULL as sub_category_name
          FROM courses c 
          LEFT JOIN users u ON c.created_by = u.id 
          ORDER BY c.created_at DESC
        `);
        res.json({ success: true, courses: rows });
      } else {
        throw tableErr;
      }
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error fetching courses' });
  }
});

// Get single course details (course, files, assignments, quizzes)
router.get('/courses/:id/detail', cacheMiddleware(300), async (req, res) => {
  try {
    const { id } = req.params;

    // Course with optional category and sub-category
    let courseRows;
    try {
      [courseRows] = await pool.execute(`
        SELECT c.*, u.name as created_by_name, cat.name as category_name, subcat.name as sub_category_name
        FROM courses c 
        LEFT JOIN users u ON c.created_by = u.id 
        LEFT JOIN course_categories cat ON c.category_id = cat.id
        LEFT JOIN sub_categories subcat ON c.sub_category_id = subcat.id
        WHERE c.id = ?
      `, [id]);
    } catch (tableErr) {
      if (tableErr.code === 'ER_NO_SUCH_TABLE') {
        [courseRows] = await pool.execute(`
          SELECT c.*, u.name as created_by_name, NULL as category_name, NULL as sub_category_name
          FROM courses c 
          LEFT JOIN users u ON c.created_by = u.id 
          WHERE c.id = ?
        `, [id]);
      } else {
        throw tableErr;
      }
    }

    if (!courseRows || courseRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    // Related data (best-effort if tables exist)
    let files = [];
    let assignments = [];
    let quizzes = [];

    try {
      const [fileRows] = await pool.execute('SELECT * FROM course_files WHERE course_id = ? ORDER BY created_at DESC', [id]);
      files = fileRows;
    } catch {}

    try {
      const [assignRows] = await pool.execute('SELECT * FROM assignments WHERE course_id = ? ORDER BY created_at DESC', [id]);
      assignments = assignRows;
    } catch {}

    try {
      const [quizRows] = await pool.execute('SELECT * FROM quizzes WHERE course_id = ? ORDER BY id DESC', [id]);
      quizzes = quizRows;
    } catch {}

    res.json({
      success: true,
      course: courseRows[0],
      files,
      assignments,
      quizzes
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error fetching course details' });
  }
});

// Course outline: units with resources, assignments, quizzes
router.get('/courses/:id/outline', cacheMiddleware(300), async (req, res) => {
  try {
    const { id } = req.params;

    // Course basics
    const [courseRows] = await pool.execute('SELECT * FROM courses WHERE id = ? LIMIT 1', [id]);
    if (!courseRows.length) return res.status(404).json({ success: false, message: 'Course not found' });

    // Get introduction files
    let introFiles = [];
    try {
      const [files] = await pool.execute('SELECT * FROM course_intro_files WHERE course_id = ? ORDER BY created_at DESC', [id]);
      introFiles = files;
    } catch (err) {
      // Table might not exist yet, ignore
    }

    // Add intro files to course object
    const course = {
      ...courseRows[0],
      intro_files: introFiles
    };

    // Units
    const [unitRows] = await pool.execute('SELECT * FROM units WHERE course_id = ? ORDER BY order_index, id', [id]);

    // Children (unit_id may not exist in some schemas; fall back to course-level)
    let resourceRows = [];
    let assignRows = [];
    let quizRows = [];
    try { const [r] = await pool.execute('SELECT * FROM resources WHERE course_id = ?', [id]); resourceRows = r; } catch {}
    try { const [a] = await pool.execute('SELECT * FROM assignments WHERE course_id = ?', [id]); assignRows = a; } catch {}
    try { const [q] = await pool.execute('SELECT * FROM quizzes WHERE course_id = ?', [id]); quizRows = q; } catch {}

    // Group by unit_id if column exists; otherwise attach to first unit or to a pseudo General section
    const unitIdFieldExists = resourceRows.some(r => 'unit_id' in r) || assignRows.some(a => 'unit_id' in a) || quizRows.some(q => 'unit_id' in q);

    const outline = unitRows.map(u => ({
      ...u,
      resources: resourceRows.filter(r => unitIdFieldExists ? r.unit_id === u.id : true),
      assignments: assignRows.filter(a => unitIdFieldExists ? a.unit_id === u.id : true),
      quizzes: quizRows.filter(q => unitIdFieldExists ? q.unit_id === u.id : true)
    }));

    res.json({ success: true, course, units: outline });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error fetching outline' });
  }
});

// Create a unit
router.post('/courses/:id/units', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, order_index } = req.body;
    const [r] = await pool.execute(
      'INSERT INTO units (course_id, title, content, order_index) VALUES (?, ?, ?, ?)',
      [id, title, content || '', order_index || 1]
    );
    res.json({ success: true, unitId: r.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error creating unit' });
  }
});

// Update a unit
router.put('/units/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, order_index } = req.body;
    await pool.execute(
      'UPDATE units SET title = ?, content = ?, order_index = ? WHERE id = ?',
      [title, content || '', order_index || 1, id]
    );
    res.json({ success: true, message: 'Unit updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error updating unit' });
  }
});

// Delete a unit
router.delete('/units/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM units WHERE id = ?', [id]);
    res.json({ success: true, message: 'Unit deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error deleting unit' });
  }
});

// Manual unit unlock by tutor/admin
router.post('/students/:studentId/courses/:courseId/units/:unitId/unlock', async (req, res) => {
  const studentId = Number(req.params.studentId);
  const courseId = Number(req.params.courseId);
  const unitId = Number(req.params.unitId);

  if (!studentId || !courseId || !unitId) {
    return res.status(400).json({ success: false, message: 'Invalid identifiers provided' });
  }

  const { unlockMethod, unlockedBy, reason } = req.body || {};
  const method = ALLOWED_UNLOCK_METHODS.has(unlockMethod) ? unlockMethod : 'manual';
  const unlockedById = Number(unlockedBy) || null;

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [unitRows] = await connection.execute(
      'SELECT id, course_id FROM units WHERE id = ? AND course_id = ? LIMIT 1',
      [unitId, courseId]
    );

    if (!unitRows.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Unit not found for this course' });
    }

    const unlockTimestamp = new Date();

    const [progressRows] = await connection.execute(
      'SELECT * FROM unit_progress WHERE student_id = ? AND unit_id = ? FOR UPDATE',
      [studentId, unitId]
    );

    if (!progressRows.length) {
      await connection.execute(
        `INSERT INTO unit_progress 
          (student_id, course_id, unit_id, is_unlocked, unlocked_at, unlock_method, unlocked_by, unlock_reason, is_completed) 
         VALUES (?, ?, ?, 1, ?, ?, ?, ?, 0)`,
        [studentId, courseId, unitId, unlockTimestamp, method, unlockedById, reason || null]
      );
    } else {
      await connection.execute(
        `UPDATE unit_progress 
           SET is_unlocked = 1, unlocked_at = ?, unlock_method = ?, unlocked_by = ?, unlock_reason = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE student_id = ? AND unit_id = ?`,
        [unlockTimestamp, method, unlockedById, reason || null, studentId, unitId]
      );
    }

    await connection.commit();

    const [statusRows] = await pool.execute(
      'SELECT * FROM unit_progress WHERE student_id = ? AND unit_id = ?',
      [studentId, unitId]
    );

    res.json({
      success: true,
      message: 'Unit unlocked successfully',
      progress: statusRows[0] || null
    });
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json({ success: false, message: 'unit_progress table not found. Please run the latest migrations.' });
    }
    console.error(error);
    res.status(500).json({ success: false, message: 'Unable to unlock unit' });
  } finally {
    connection.release();
  }
});

// Upload a PDF (or file) to a unit (using Cloudinary)
// Upload introduction file for a course
router.post('/courses/:courseId/intro-files', upload.single('file'), async (req, res) => {
  try {
    const { courseId } = req.params;
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    // Upload to Cloudinary
    const cloudinaryResult = await uploadToCloudinary(req.file, `lms/courses/${courseId}/intro`);
    const cloudinaryUrl = cloudinaryResult.secure_url;

    // Insert into course_intro_files
    const [r] = await pool.execute(
      'INSERT INTO course_intro_files (course_id, file_name, file_path, file_size, file_type) VALUES (?, ?, ?, ?, ?)',
      [courseId, req.file.originalname, cloudinaryUrl, req.file.size, req.file.mimetype]
    );

    // Log file upload
    const { logSystemEvent } = require('../utils/eventLogger');
    setImmediate(async () => {
      await logSystemEvent({
        userId: req.user?.id || null,
        action: 'admin_file_uploaded',
        description: `Intro file uploaded: ${req.file.originalname} (${(req.file.size / 1024).toFixed(2)} KB) to course ${courseId}`,
        req
      });
    });

    res.json({ 
      success: true, 
      fileId: r.insertId, 
      url: cloudinaryUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error uploading introduction file' });
  }
});

// Get introduction files for a course
router.get('/courses/:courseId/intro-files', cacheMiddleware(300), async (req, res) => {
  try {
    const { courseId } = req.params;
    const [files] = await pool.execute(
      'SELECT * FROM course_intro_files WHERE course_id = ? ORDER BY created_at DESC',
      [courseId]
    );
    res.json({ success: true, files });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error fetching introduction files' });
  }
});

// Delete introduction file
router.delete('/courses/intro-files/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;

    // Get file info
    const [rows] = await pool.execute('SELECT file_path FROM course_intro_files WHERE id = ?', [fileId]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    const filePath = rows[0].file_path;

    // Delete from Cloudinary
    if (filePath && filePath.includes('cloudinary.com')) {
      try {
        const publicId = extractCloudinaryPublicId(filePath);
        const resourceType = extractCloudinaryResourceType(filePath);
        await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
      } catch (cloudErr) {
        console.error('Cloudinary deletion error:', cloudErr);
      }
    }

    // Delete from database
    await pool.execute('DELETE FROM course_intro_files WHERE id = ?', [fileId]);

    res.json({ success: true, message: 'Introduction file deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error deleting introduction file' });
  }
});

router.post('/units/:unitId/resources', upload.single('file'), async (req, res) => {
  try {
    const { unitId } = req.params;
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    // Find course for the unit
    const [u] = await pool.execute('SELECT course_id FROM units WHERE id = ? LIMIT 1', [unitId]);
    if (!u.length) return res.status(404).json({ success: false, message: 'Unit not found' });
    const courseId = u[0].course_id;

    // Upload to Cloudinary
    const cloudinaryResult = await uploadToCloudinary(req.file, `lms/courses/${courseId}/units/${unitId}`);
    const cloudinaryUrl = cloudinaryResult.secure_url;

    // Try insert with unit_id if column exists
    try {
      const [r] = await pool.execute(
        'INSERT INTO resources (course_id, title, file_path, uploaded_by, unit_id) VALUES (?, ?, ?, ?, ?)',
        [courseId, req.file.originalname, cloudinaryUrl, 1, unitId]
      );
      
      // Log file upload
      const { logSystemEvent } = require('../utils/eventLogger');
      setImmediate(async () => {
        await logSystemEvent({
          userId: req.user?.id || null,
          action: 'admin_resource_uploaded',
          description: `Resource uploaded: ${req.file.originalname} (${(req.file.size / 1024).toFixed(2)} KB) to unit ${unitId} in course ${courseId}`,
          req
        });
      });
      
      return res.json({ success: true, resourceId: r.insertId, url: cloudinaryUrl });
    } catch (e) {
      // fallback without unit_id column
      const [r] = await pool.execute(
        'INSERT INTO resources (course_id, title, file_path, uploaded_by) VALUES (?, ?, ?, ?)',
        [courseId, req.file.originalname, cloudinaryUrl, 1]
      );
      return res.json({ success: true, resourceId: r.insertId, url: cloudinaryUrl });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error uploading resource' });
  }
});

// Update a resource (title only)
router.put('/resources/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;
    
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    await pool.execute(
      'UPDATE resources SET title = ? WHERE id = ?',
      [title.trim(), id]
    );
    
    res.json({ success: true, message: 'Resource updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error updating resource' });
  }
});

// Delete a resource (from Cloudinary and database)
router.delete('/resources/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get resource info including Cloudinary URL
    const [resources] = await pool.execute(
      'SELECT file_path FROM resources WHERE id = ?',
      [id]
    );
    
    if (!resources.length) {
      return res.status(404).json({ success: false, message: 'Resource not found' });
    }
    
    const filePath = resources[0].file_path;
    
    // Delete from Cloudinary if it's a Cloudinary URL
    if (filePath && (filePath.includes('cloudinary.com') || filePath.includes('res.cloudinary.com'))) {
      try {
        // Extract public_id and resource_type from Cloudinary URL
        // Format: https://res.cloudinary.com/{cloud_name}/{resource_type}/upload/v{version}/{public_id}.{format}
        // Or: https://res.cloudinary.com/{cloud_name}/{resource_type}/upload/{public_id}.{format}
        const urlParts = filePath.split('/');
        const uploadIndex = urlParts.findIndex(part => part === 'upload');
        
        if (uploadIndex !== -1 && uploadIndex > 0) {
          // Extract resource_type from URL (it's the part before 'upload')
          const resourceType = urlParts[uploadIndex - 1];
          
          // Validate resource_type (must be one of: image, video, raw, javascript, css)
          const validResourceTypes = ['image', 'video', 'raw', 'javascript', 'css'];
          const finalResourceType = validResourceTypes.includes(resourceType) ? resourceType : 'raw';
          
          // Get everything after 'upload'
          const afterUpload = urlParts.slice(uploadIndex + 1).join('/');
          
          // Remove version number if present (format: v1234567890/public_id.ext)
          let publicId = afterUpload;
          if (afterUpload.startsWith('v') && afterUpload.includes('/')) {
            // Skip version part (v1234567890/)
            publicId = afterUpload.split('/').slice(1).join('/');
          }
          
          // Remove file extension
          const publicIdWithoutExt = publicId.replace(/\.[^/.]+$/, '');
          
          // Delete from Cloudinary with the correct resource type
          const result = await cloudinary.uploader.destroy(publicIdWithoutExt, {
            resource_type: finalResourceType
          });
          console.log('Cloudinary deletion result:', result);
        }
      } catch (cloudinaryErr) {
        console.error('Error deleting from Cloudinary:', cloudinaryErr);
        // Continue with database deletion even if Cloudinary deletion fails
      }
    }
    
    // Delete from database
    await pool.execute('DELETE FROM resources WHERE id = ?', [id]);
    
    res.json({ success: true, message: 'Resource deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error deleting resource' });
  }
});

// Import quiz from GIFT format text for a course (optionally attach to unit)
router.post('/courses/:id/quizzes/import-gift', async (req, res) => {
  try {
    const { id } = req.params; // course id
    const { gift, title, unit_id, quiz_type, passing_score } = req.body;
    if (!gift || typeof gift !== 'string') return res.status(400).json({ success: false, message: 'gift text required' });

    // Create quiz
    const quizTitle = title || 'Imported Quiz';
    const type = quiz_type === 'final' ? 'final' : 'practice';
    const passingScore = passing_score || 70;
    
    let quizInsert;
    try {
      quizInsert = await pool.execute(
        'INSERT INTO quizzes (course_id, title, created_by, unit_id, quiz_type, passing_score) VALUES (?, ?, ?, ?, ?, ?)', 
        [id, quizTitle, 1, unit_id || null, type, passingScore]
      );
    } catch (e) {
      // Fallback without unit_id/quiz_type columns
      try {
        quizInsert = await pool.execute('INSERT INTO quizzes (course_id, title, created_by, unit_id) VALUES (?, ?, ?, ?)', [id, quizTitle, 1, unit_id || null]);
      } catch (e2) {
        quizInsert = await pool.execute('INSERT INTO quizzes (course_id, title, created_by) VALUES (?, ?, ?)', [id, quizTitle, 1]);
      }
    }
    const quizId = quizInsert[0].insertId;

    // Minimal GIFT parser: supports MC questions with =correct and ~wrong
    const lines = gift.split(/\r?\n/);
    let buffer = '';
    const blocks = [];
    for (const line of lines) {
      if (line.trim() === '' && buffer.trim()) { 
        blocks.push(buffer.trim()); 
        buffer = ''; 
      } else {
        buffer += line + '\n';
      }
    }
    if (buffer.trim()) blocks.push(buffer.trim());

    for (const block of blocks) {
      // Skip empty blocks or comment lines
      if (!block || block.startsWith('//') || block.startsWith('#')) continue;
      
      // Match GIFT format: Question text { answers }
      const qMatch = block.match(/^(.+?)\s*\{([\s\S]+)\}\s*$/);
      if (!qMatch) {
        console.log('Skipping block - not in GIFT format:', block.substring(0, 50));
        continue;
      }
      
      const questionText = qMatch[1].trim();
      const answersRaw = qMatch[2].trim();
      
      // Skip if question text is empty
      if (!questionText || questionText.length < 3) continue;
      
      // Split answers by = or ~ at the start of lines/segments
      const answerLines = answersRaw.split(/(?=\s*[=~])/).map(s => s.trim()).filter(Boolean);
      
      const options = [];
      let correct = '';
      
      for (const ansLine of answerLines) {
        if (ansLine.startsWith('=')) {
          const text = ansLine.slice(1).trim();
          if (text && text.length > 0) {
            options.push(text);
            correct = text;
          }
        } else if (ansLine.startsWith('~')) {
          const text = ansLine.slice(1).trim();
          if (text && text.length > 0) {
            options.push(text);
          }
        }
      }
      
      // Only insert if we have a valid question, at least 2 options, and a correct answer
      if (questionText && options.length >= 2 && correct) {
        const optionsJson = JSON.stringify(options);
        await pool.execute(
          'INSERT INTO quiz_questions (quiz_id, question, options, correct_answer) VALUES (?, ?, ?, ?)', 
          [quizId, questionText, optionsJson, correct]
        );
        console.log('✓ Added question:', questionText.substring(0, 50), '| Options:', options.length);
      } else {
        console.log('✗ Skipped invalid question:', questionText.substring(0, 50), '| Options:', options.length, '| Correct:', !!correct);
      }
    }

    res.json({ success: true, quizId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error importing GIFT' });
  }
});

// Get quiz with questions
router.get('/quizzes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [quizRows] = await pool.execute('SELECT * FROM quizzes WHERE id = ? LIMIT 1', [id]);
    if (!quizRows.length) return res.status(404).json({ success: false, message: 'Quiz not found' });
    const [qRows] = await pool.execute('SELECT id, question, options, correct_answer FROM quiz_questions WHERE quiz_id = ? ORDER BY id', [id]);
    res.json({ success: true, quiz: quizRows[0], questions: qRows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error fetching quiz' });
  }
});

// Update a quiz (title only)
router.put('/quizzes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;
    
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    await pool.execute(
      'UPDATE quizzes SET title = ? WHERE id = ?',
      [title.trim(), id]
    );
    
    res.json({ success: true, message: 'Quiz updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error updating quiz' });
  }
});

// Delete a quiz (with cascade delete of questions and submissions)
router.delete('/quizzes/:id', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    
    // Check if quiz exists
    const [quizRows] = await connection.execute('SELECT id FROM quizzes WHERE id = ?', [id]);
    if (!quizRows.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }
    
    // Delete quiz submissions (if table exists)
    try {
      await connection.execute('DELETE FROM quiz_submissions WHERE quiz_id = ?', [id]);
    } catch (e) {
      // Table might not exist, continue
    }
    
    // Delete quiz questions
    try {
      await connection.execute('DELETE FROM quiz_questions WHERE quiz_id = ?', [id]);
    } catch (e) {
      // Table might not exist, continue
    }
    
    // Delete the quiz
    await connection.execute('DELETE FROM quizzes WHERE id = ?', [id]);
    
    await connection.commit();
    res.json({ success: true, message: 'Quiz deleted successfully' });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ success: false, message: 'Error deleting quiz' });
  } finally {
    connection.release();
  }
});

// Submit quiz attempt and score
router.post('/quizzes/:id/attempt', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const { student_id, answers } = req.body; // answers: [{question_id, answer}]
    
    await connection.beginTransaction();
    
    // Get quiz info including type and passing score
    const [quizInfo] = await connection.execute(
      'SELECT q.*, q.quiz_type, q.passing_score, q.unit_id, q.course_id FROM quizzes q WHERE q.id = ?', 
      [id]
    );
    const quiz = quizInfo[0];
    const quizType = quiz?.quiz_type || 'practice';
    const passingScore = quiz?.passing_score || 70;
    
    // Get questions and calculate score
    const [qRows] = await connection.execute('SELECT id, correct_answer FROM quiz_questions WHERE quiz_id = ?', [id]);
    const answerMap = new Map(qRows.map((q) => [q.id, q.correct_answer]));
    let correct = 0;
    let total = qRows.length;
    for (const a of (answers || [])) {
      if (String(a.answer).trim() === String(answerMap.get(a.question_id)).trim()) correct++;
    }
    const score = total ? Math.round((correct / total) * 100) : 0;
    const passed = score >= passingScore;
    
    // Save submission
    const record = { quiz_id: Number(id), student_id: student_id || null, answers: JSON.stringify(answers || []), score };
    try {
      await connection.execute('INSERT INTO quiz_submissions (quiz_id, student_id, answers, score, submitted_at) VALUES (?, ?, ?, ?, NOW())', [record.quiz_id, record.student_id, record.answers, score]);
    } catch (e) {
      // table might not have submitted_at in some schemas
      try { await connection.execute('INSERT INTO quiz_submissions (quiz_id, student_id, answers, score) VALUES (?, ?, ?, ?)', [record.quiz_id, record.student_id, record.answers, score]); } catch {}
    }
    
    // If this is a FINAL quiz and student passed, unlock next unit
    if (quizType === 'final' && passed && student_id && quiz.unit_id && quiz.course_id) {
      try {
        // Update current unit progress to completed
        await connection.execute(
          `UPDATE unit_progress 
           SET is_completed = 1, completed_at = NOW(), last_quiz_score = ? 
           WHERE student_id = ? AND unit_id = ? AND course_id = ?`,
          [score, student_id, quiz.unit_id, quiz.course_id]
        );
        
        // Find next unit by order_index
        const [nextUnits] = await connection.execute(
          `SELECT u.id, u.order_index FROM units u 
           WHERE u.course_id = ? AND u.order_index > (SELECT order_index FROM units WHERE id = ?) 
           ORDER BY u.order_index ASC LIMIT 1`,
          [quiz.course_id, quiz.unit_id]
        );
        
        if (nextUnits.length > 0) {
          const nextUnitId = nextUnits[0].id;
          
          // Check if next unit progress record exists
          const [existingProgress] = await connection.execute(
            'SELECT id, is_unlocked FROM unit_progress WHERE student_id = ? AND unit_id = ?',
            [student_id, nextUnitId]
          );
          
          if (existingProgress.length > 0 && !existingProgress[0].is_unlocked) {
            // Unlock next unit
            await connection.execute(
              `UPDATE unit_progress 
               SET is_unlocked = 1, unlocked_at = NOW(), unlock_method = 'automatic' 
               WHERE student_id = ? AND unit_id = ?`,
              [student_id, nextUnitId]
            );
            console.log(`✓ Auto-unlocked next unit ${nextUnitId} for student ${student_id} after passing final quiz`);
          } else if (existingProgress.length === 0) {
            // Create unlocked progress record for next unit
            await connection.execute(
              `INSERT INTO unit_progress (student_id, course_id, unit_id, is_unlocked, unlocked_at, unlock_method) 
               VALUES (?, ?, ?, 1, NOW(), 'automatic')`,
              [student_id, quiz.course_id, nextUnitId]
            );
            console.log(`✓ Created and unlocked unit ${nextUnitId} for student ${student_id} after passing final quiz`);
          }
        }
      } catch (unlockErr) {
        console.error('Error unlocking next unit:', unlockErr);
        // Don't fail the quiz submission if unlock fails
      }
    }
    
    await connection.commit();
    res.json({ success: true, score, total, correct, passed, quizType });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ success: false, message: 'Error submitting quiz' });
  } finally {
    connection.release();
  }
});

// Create course
router.post('/courses', async (req, res) => {
  try {
    const { title, description, status, created_by, category_id, sub_category_id, start_date, end_date } = req.body;
    
    const [result] = await pool.execute(
      'INSERT INTO courses (title, description, status, created_by, category_id, sub_category_id, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [title, description, status || 'Active', created_by, category_id || null, sub_category_id || null, start_date || null, end_date || null]
    );

    await invalidateCache('cache:/api/admin/courses*');
    await invalidateCache('cache:/api/courses*');
    
    // Log course creation - capture user info before async logging
    const userId = created_by || req.user?.id || null;
    const userRoleId = req.user?.role_id || null;
    const { logSystemEvent, getRoleName } = require('../utils/eventLogger');
    const userRole = userRoleId ? getRoleName(userRoleId) : null;
    const roleLabel = userRole ? userRole.charAt(0).toUpperCase() + userRole.slice(1) : 'User';
    
    setImmediate(async () => {
      await logSystemEvent({
        userId: userId,
        role: userRole,
        action: 'course_created',
        description: `${roleLabel} created course: ${title} (ID: ${result.insertId})`,
        req
      });
    });
    
    res.json({ success: true, message: 'Course created successfully', courseId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error creating course' });
  }
});

// Update course
router.put('/courses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, status, category_id, sub_category_id, start_date, end_date, intro_heading, intro_subheading, intro_content } = req.body;

    // Build dynamic update query based on provided fields
    const updates = [];
    const values = [];

    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }
    if (category_id !== undefined) {
      updates.push('category_id = ?');
      values.push(category_id || null);
    }
    if (sub_category_id !== undefined) {
      updates.push('sub_category_id = ?');
      values.push(sub_category_id || null);
    }
    if (start_date !== undefined) {
      updates.push('start_date = ?');
      values.push(start_date || null);
    }
    if (end_date !== undefined) {
      updates.push('end_date = ?');
      values.push(end_date || null);
    }
    if (intro_heading !== undefined) {
      updates.push('intro_heading = ?');
      values.push(intro_heading || null);
    }
    if (intro_subheading !== undefined) {
      updates.push('intro_subheading = ?');
      values.push(intro_subheading || null);
    }
    if (intro_content !== undefined) {
      updates.push('intro_content = ?');
      values.push(intro_content || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    values.push(id);
    const query = `UPDATE courses SET ${updates.join(', ')} WHERE id = ?`;

    await pool.execute(query, values);

    await invalidateCache('cache:/api/admin/courses*');
    await invalidateCache('cache:/api/courses*');
    res.json({ success: true, message: 'Course updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error updating course' });
  }
});

// Delete course (with cascade delete of related records)
router.delete('/courses/:id', auth, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;

    // Delete in order to respect foreign key constraints
    // 1. Delete quiz submissions (if table exists)
    try {
      await connection.execute('DELETE FROM quiz_submissions WHERE quiz_id IN (SELECT id FROM quizzes WHERE course_id = ?)', [id]);
    } catch (e) {}

    // 2. Delete quiz questions (if table exists)
    try {
      await connection.execute('DELETE FROM quiz_questions WHERE quiz_id IN (SELECT id FROM quizzes WHERE course_id = ?)', [id]);
    } catch (e) {}

    // 3. Delete quizzes
    try {
      await connection.execute('DELETE FROM quizzes WHERE course_id = ?', [id]);
    } catch (e) {}

    // 4. Delete assignment submissions (if table exists)
    try {
      await connection.execute('DELETE FROM assignment_submissions WHERE assignment_id IN (SELECT id FROM assignments WHERE course_id = ?)', [id]);
    } catch (e) {}

    // 5. Delete assignments
    try {
      await connection.execute('DELETE FROM assignments WHERE course_id = ?', [id]);
    } catch (e) {}

    // 6. Delete resources (files - only links in DB, actual files in Cloudinary)
    try {
      await connection.execute('DELETE FROM resources WHERE course_id = ?', [id]);
    } catch (e) {}

    // 7. Delete course files (if table exists)
    try {
      await connection.execute('DELETE FROM course_files WHERE course_id = ?', [id]);
    } catch (e) {}

    // 8. Delete units (topics)
    try {
      await connection.execute('DELETE FROM units WHERE course_id = ?', [id]);
    } catch (e) {}

    // 9. Delete course assignments (if table exists)
    try {
      await connection.execute('DELETE FROM course_assignments WHERE course_id = ?', [id]);
    } catch (e) {}

    // 10. Finally, delete the course
    await connection.execute('DELETE FROM courses WHERE id = ?', [id]);

    await connection.commit();
    await invalidateCache('cache:/api/admin/courses*');
    await invalidateCache('cache:/api/courses*');
    
    // Log course deletion - capture user info before async logging
    const userId = req.user?.id || null;
    const userRoleId = req.user?.role_id || null;
    const { logSystemEvent, getRoleName } = require('../utils/eventLogger');
    const userRole = userRoleId ? getRoleName(userRoleId) : null;
    const roleLabel = userRole ? userRole.charAt(0).toUpperCase() + userRole.slice(1) : 'User';
    
    setImmediate(async () => {
      await logSystemEvent({
        userId: userId,
        role: userRole,
        action: 'course_deleted',
        description: `${roleLabel} deleted course ID: ${id}`,
        req
      });
    });
    
    res.json({ success: true, message: 'Course and all related data deleted successfully' });
  } catch (err) {
    await connection.rollback();
    console.error('Error deleting course:', err);
    res.status(500).json({ success: false, message: 'Error deleting course: ' + err.message });
  } finally {
    connection.release();
  }
});

// Upload course files (using Cloudinary)
router.post('/courses/upload', upload.single('courseFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { courseId, fileType } = req.body;
    const fileName = req.file.originalname;

    // Upload to Cloudinary
    const cloudinaryResult = await uploadToCloudinary(req.file, `lms/courses/${courseId}`);
    const cloudinaryUrl = cloudinaryResult.secure_url;

    // Save file info to database (file_path stores Cloudinary URL)
    const [result] = await pool.execute(
      'INSERT INTO course_files (course_id, file_name, file_path, file_type, file_size) VALUES (?, ?, ?, ?, ?)',
      [courseId, fileName, cloudinaryUrl, fileType || 'resource', req.file.size]
    );

    res.json({ 
      success: true, 
      message: 'File uploaded successfully',
      fileId: result.insertId,
      fileName: fileName,
      filePath: cloudinaryUrl,
      url: cloudinaryUrl
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error uploading file' });
  }
});

// Get course files
router.get('/courses/:id/files', cacheMiddleware(300), async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute(
      'SELECT * FROM course_files WHERE course_id = ? ORDER BY created_at DESC',
      [id]
    );
    res.json({ success: true, files: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error fetching course files' });
  }
});

// Backup all courses
router.post('/courses/backup', async (req, res) => {
  try {
    const backupData = {
      courses: [],
      categories: [],
      assignments: [],
      quizzes: [],
      timestamp: new Date().toISOString()
    };

    // Get all courses
    const [courses] = await pool.execute('SELECT * FROM courses');
    backupData.courses = courses;

    // Get categories
    const [categories] = await pool.execute('SELECT * FROM course_categories');
    backupData.categories = categories;

    // Get assignments
    const [assignments] = await pool.execute('SELECT * FROM assignments');
    backupData.assignments = assignments;

    // Get quizzes
    const [quizzes] = await pool.execute('SELECT * FROM quizzes');
    backupData.quizzes = quizzes;

    // Save backup to file
    const backupPath = `backups/course-backup-${Date.now()}.json`;
    if (!fs.existsSync('backups')) {
      fs.mkdirSync('backups', { recursive: true });
    }
    
    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));

    res.json({ 
      success: true, 
      message: 'Backup created successfully',
      backupPath: backupPath,
      coursesCount: courses.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error creating backup' });
  }
});

// Restore courses from backup (.mbz or .json files)
// NOTE: Files are uploaded to memory, then processed. No local storage.
router.post('/courses/restore', upload.single('backupFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No backup file uploaded' });
    }

    const { categoryId, subCategoryId } = req.body;

    // Since we use memory storage, we work with the buffer directly
    const fileBuffer = req.file.buffer;
    const fileName = req.file.originalname;
    const fileExtension = path.extname(fileName).toLowerCase();

    let backupData;

    if (fileExtension === '.mbz') {
      // Handle Moodle .mbz file - write buffer to temp file for AdmZip
      const tempPath = path.join(__dirname, '../temp', `backup-${Date.now()}.mbz`);
      if (!fs.existsSync(path.dirname(tempPath))) {
        fs.mkdirSync(path.dirname(tempPath), { recursive: true });
      }
      fs.writeFileSync(tempPath, fileBuffer);
      try {
        backupData = await handleMoodleBackup(tempPath, categoryId, subCategoryId);
      } finally {
        // Clean up temp file
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      }
    } else if (fileExtension === '.json') {
      // Handle JSON backup file - parse from buffer
      backupData = JSON.parse(fileBuffer.toString('utf8'));
    } else {
      return res.status(400).json({ success: false, message: 'Unsupported file format. Please upload .mbz or .json files.' });
    }

    // Helper: ensure category by name, return id
    async function ensureCategoryId(name, description) {
      if (!name) return null;
      const [found] = await pool.execute('SELECT id FROM course_categories WHERE name = ? LIMIT 1', [name]);
      if (found.length > 0) return found[0].id;
      const [ins] = await pool.execute('INSERT INTO course_categories (name, description) VALUES (?, ?)', [name, description || '' ]);
      return ins.insertId;
    }

    // Build map from temp course ids (if provided) to new ids
    const courseIdMap = new Map();

    // Restore categories and courses
    if (backupData.courses && backupData.courses.length > 0) {
      for (const course of backupData.courses) {
        const categoryId = course.category_name
          ? await ensureCategoryId(course.category_name, course.category_description)
          : (course.category_id || null);

        const [result] = await pool.execute(
          'INSERT INTO courses (title, description, status, created_by, category_id) VALUES (?, ?, ?, ?, ?)',
          [course.title, course.description, course.status || 'Active', course.created_by || 1, categoryId || null]
        );
        // If the input had an id, map it to the new auto id
        if (course.id) courseIdMap.set(course.id, result.insertId);
        // Also store mapping by title in case ids were missing
        courseIdMap.set(course.title, result.insertId);
      }
    }

    // Resolve helper for course_id
    function resolveCourseId(ref) {
      if (!ref) return null;
      if (courseIdMap.has(ref)) return courseIdMap.get(ref);
      // try by title string
      if (typeof ref === 'string' && courseIdMap.has(ref)) return courseIdMap.get(ref);
      return null;
    }

    // Restore units
    const unitIdMap = new Map();
    console.log(`\n📋 Creating ${backupData.units?.length || 0} units...`);
    if (backupData.units && backupData.units.length > 0) {
      for (const unit of backupData.units) {
        const cid = resolveCourseId(unit.course_id) || [...courseIdMap.values()][0]; // Use first course if not specified
        console.log(`  Unit "${unit.title}" - course_id: ${unit.course_id} → resolved: ${cid}`);
        if (!cid) {
          console.log(`  ⚠️ Skipping unit "${unit.title}" - no course ID`);
          continue;
        }
        
        const [result] = await pool.execute(
          'INSERT INTO units (course_id, title, content, order_index) VALUES (?, ?, ?, ?)',
          [cid, unit.title, unit.content || '', unit.order_index || 0]
        );
        unitIdMap.set(unit.title, result.insertId);
        console.log(`  ✅ Created unit: ${unit.title} (ID: ${result.insertId})`);
      }
    } else {
      console.log(`  ⚠️ No units to create`);
    }

    // Restore resources (learning materials)
    console.log(`\n📁 Creating ${backupData.resources?.length || 0} resources...`);
    if (backupData.resources && backupData.resources.length > 0) {
      for (const resource of backupData.resources) {
        const cid = resolveCourseId(resource.course_id) || [...courseIdMap.values()][0];
        const uid = resource.unit_id || [...unitIdMap.values()][0]; // Use first unit if not specified
        
        console.log(`  Resource "${resource.file_name || resource.title}" - course_id: ${resource.course_id} → resolved: ${cid}, unit_id: ${uid}`);
        
        if (!cid) {
          console.log(`  ⚠️ Skipping resource "${resource.file_name || resource.title}" - no course ID`);
          continue;
        }
        
        // Use the 'resources' table (not 'unit_resources')
        await pool.execute(
          'INSERT INTO resources (course_id, title, file_path, uploaded_by, unit_id) VALUES (?, ?, ?, ?, ?)',
          [cid, resource.file_name || resource.title, resource.file_path, 1, uid || null]
        );
        console.log(`  ✅ Created resource: ${resource.file_name || resource.title}`);
      }
    } else {
      console.log(`  ⚠️ No resources to create`);
    }

    // Restore assignments
    if (backupData.assignments && backupData.assignments.length > 0) {
      for (const assignment of backupData.assignments) {
        const cid = resolveCourseId(assignment.course_id) || resolveCourseId(assignment.course_title) || null;
        if (!cid) continue;
        await pool.execute(
          'INSERT INTO assignments (course_id, title, description, due_date, created_by) VALUES (?, ?, ?, ?, ?)',
          [cid, assignment.title, assignment.description, assignment.due_date || null, assignment.created_by || 1]
        );
      }
    }

    // Restore quizzes
    if (backupData.quizzes && backupData.quizzes.length > 0) {
      for (const quiz of backupData.quizzes) {
        const cid = resolveCourseId(quiz.course_id) || resolveCourseId(quiz.course_title) || null;
        if (!cid) continue;
        await pool.execute(
          'INSERT INTO quizzes (course_id, title, created_by) VALUES (?, ?, ?)',
          [cid, quiz.title, quiz.created_by || 1]
        );
      }
    }

    // No cleanup needed - file was in memory only

    res.json({ 
      success: true, 
      message: 'Courses restored successfully',
      restoredCourses: backupData.courses ? backupData.courses.length : 0,
      restoredCategories: backupData.categories ? backupData.categories.length : 0,
      fileType: fileExtension === '.mbz' ? 'Moodle Backup' : 'JSON Backup'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error restoring backup' });
  }
});

// Student assignment submission (file upload using Cloudinary)
router.post('/assignments/:id/submit', upload.single('submission'), async (req, res) => {
  try {
    const { id } = req.params;
    const { student_id } = req.body; // In production, derive from JWT
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    // Upload to Cloudinary
    const cloudinaryResult = await uploadToCloudinary(req.file, `lms/assignments/${id}/submissions`);
    const cloudinaryUrl = cloudinaryResult.secure_url;

    const [result] = await pool.execute(
      'INSERT INTO assignment_submissions (assignment_id, student_id, file_path, submitted_at) VALUES (?, ?, ?, NOW())',
      [id, student_id, cloudinaryUrl]
    );
    
    // Get assignment and course info for notification
    const [assignmentInfo] = await pool.execute(
      `SELECT a.title as assignment_title, a.course_id, c.title as course_title
       FROM assignments a
       LEFT JOIN courses c ON a.course_id = c.id
       WHERE a.id = ?`,
      [id]
    );
    
    const [studentInfo] = await pool.execute('SELECT name FROM users WHERE id = ?', [student_id]);
    
    // Get tutors for this course (or all tutors if course_id is null)
    let tutorsQuery;
    let tutorsParams;
    if (assignmentInfo[0]?.course_id) {
      tutorsQuery = `SELECT DISTINCT u.id 
                     FROM users u
                     JOIN roles r ON u.role_id = r.id
                     JOIN course_assignments ca ON ca.course_id = ?
                     WHERE r.name = 'Tutor' AND (ca.assigned_by = u.id OR ca.course_id = ?)`;
      tutorsParams = [assignmentInfo[0].course_id, assignmentInfo[0].course_id];
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
        relatedUserId: student_id,
        relatedCourseId: assignmentInfo[0]?.course_id || null,
        relatedSubmissionId: result.insertId,
        req: req
      });
    }
    
    res.json({ success: true, url: cloudinaryUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error submitting assignment' });
  }
});

// Handle Moodle .mbz file (extract and parse)
async function handleMoodleBackup(filePath, categoryId = null, subCategoryId = null) {
  try {
    const backupData = {
      courses: [],
      categories: [],
      assignments: [],
      quizzes: [],
      units: [],
      resources: [],
      uploadedFiles: [],
      timestamp: new Date().toISOString()
    };

    console.log('📦 Starting Moodle backup extraction...');
    console.log(`📁 File path: ${filePath}`);

    // Extract .mbz file (it's a ZIP file)
    const zip = new AdmZip(filePath);
    const zipEntries = zip.getEntries();

    console.log(`📂 Found ${zipEntries.length} entries in backup`);
    
    // Log first 30 entries to see structure
    console.log('\n📋 First 30 entries in .mbz:');
    zipEntries.slice(0, 30).forEach(entry => {
      console.log(`  ${entry.isDirectory ? '📁' : '📄'} ${entry.entryName}`);
    });
    console.log('');

    // Look for course.xml file in the backup
    let courseXml = null;
    let moodleBackupXml = null;
    let sectionsXml = [];

    for (let entry of zipEntries) {
      if (entry.entryName.includes('course/course.xml')) {
        courseXml = entry.getData().toString('utf8');
        console.log('✅ Found course.xml');
      }
      if (entry.entryName.includes('moodle_backup.xml')) {
        moodleBackupXml = entry.getData().toString('utf8');
        console.log('✅ Found moodle_backup.xml');
      }
      // Collect all section XMLs
      if (entry.entryName.includes('sections/section_') && entry.entryName.endsWith('/section.xml')) {
        console.log(`✅ Found section XML: ${entry.entryName}`);
        sectionsXml.push({
          path: entry.entryName,
          content: entry.getData().toString('utf8')
        });
      }
    }

    console.log(`\n📑 Total sections found: ${sectionsXml.length}`);

    // Extract course information from XML
    let courseTitle = 'Imported Moodle Course';
    let courseDescription = 'Course imported from Moodle backup';
    let courseShortName = 'moodle-course';

    if (courseXml) {
      // Simple XML parsing to extract course info
      const titleMatch = courseXml.match(/<fullname><!\[CDATA\[(.*?)\]\]><\/fullname>/);
      const descMatch = courseXml.match(/<summary><!\[CDATA\[(.*?)\]\]><\/summary>/);
      const shortMatch = courseXml.match(/<shortname><!\[CDATA\[(.*?)\]\]><\/shortname>/);

      if (titleMatch) courseTitle = titleMatch[1];
      if (descMatch) courseDescription = descMatch[1];
      if (shortMatch) courseShortName = shortMatch[1];
    }

    console.log(`📚 Course: ${courseTitle}`);

    // Extract and upload files to Cloudinary
    console.log('📤 Extracting and uploading files to Cloudinary...');
    const fileMap = new Map(); // Map Moodle file hash to Cloudinary URL

    for (let entry of zipEntries) {
      // Look for files in activities folders
      if (entry.entryName.includes('/files/') && !entry.isDirectory) {
        const fileName = path.basename(entry.entryName);
        const ext = path.extname(fileName).toLowerCase();
        
        // Only process document files (skip inforef.xml and other system files)
        if (['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.jpg', '.jpeg', '.png', '.gif', '.mp4'].includes(ext)) {
          try {
            const fileBuffer = entry.getData();
            
            // Determine resource type for Cloudinary
            let resourceType = 'raw';
            if (['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) {
              resourceType = 'image';
            } else if (ext === '.mp4') {
              resourceType = 'video';
            }
            
            // Upload to Cloudinary
            const uploadPromise = new Promise((resolve, reject) => {
              const uploadStream = cloudinary.uploader.upload_stream({
                resource_type: resourceType,
                folder: 'moodle_imports',
                public_id: `${Date.now()}_${fileName.replace(/\s+/g, '_')}`
              }, (error, result) => {
                if (error) reject(error);
                else resolve(result);
              });
              uploadStream.end(fileBuffer);
            });
            
            const result = await uploadPromise;
            
            fileMap.set(entry.entryName, {
              originalName: fileName,
              cloudinaryUrl: result.secure_url,
              fileSize: entry.header.size,
              fileType: ext
            });
            
            backupData.uploadedFiles.push({
              originalPath: entry.entryName,
              fileName: fileName,
              url: result.secure_url
            });
            
            console.log(`  ✅ Uploaded: ${fileName}`);
          } catch (error) {
            console.error(`  ❌ Error uploading ${fileName}:`, error.message);
          }
        }
      }
    }

    console.log(`📁 Uploaded ${fileMap.size} files to Cloudinary`);

    // Parse sections/units
    console.log('📋 Parsing course sections...');
    for (let sectionData of sectionsXml) {
      try {
        const xml = sectionData.content;
        const numberMatch = xml.match(/<number>(\d+)<\/number>/);
        const nameMatch = xml.match(/<name><!\[CDATA\[(.*?)\]\]><\/name>/);
        const summaryMatch = xml.match(/<summary><!\[CDATA\[(.*?)\]\]><\/summary>/);
        
        const sectionNumber = numberMatch ? parseInt(numberMatch[1]) : 0;
        const sectionName = nameMatch ? nameMatch[1] : `Section ${sectionNumber}`;
        const sectionSummary = summaryMatch ? summaryMatch[1] : '';
        
        if (sectionNumber > 0) { // Skip section 0 (usually general section)
          backupData.units.push({
            title: sectionName,
            content: sectionSummary,
            order_index: sectionNumber
          });
          console.log(`  📌 Section ${sectionNumber}: ${sectionName}`);
        }
      } catch (error) {
        console.error('Error parsing section:', error.message);
      }
    }

    // Parse activities (resources, assignments, quizzes)
    console.log('🎯 Parsing activities...');
    
    // Create a map to associate resources with sections
    const sectionResourceMap = new Map();
    
    for (let entry of zipEntries) {
      // Parse resource activities
      if (entry.entryName.includes('/activities/resource_') && entry.entryName.endsWith('/resource.xml')) {
        try {
          const resourceXml = entry.getData().toString('utf8');
          const nameMatch = resourceXml.match(/<name><!\[CDATA\[(.*?)\]\]><\/name>/);
          const introMatch = resourceXml.match(/<intro><!\[CDATA\[(.*?)\]\]><\/intro>/);
          
          // Find associated files for this resource
          const activityFolder = entry.entryName.replace('/resource.xml', '/files/');
          const resourceFiles = [];
          
          for (let [filePath, fileData] of fileMap) {
            if (filePath.includes(activityFolder)) {
              resourceFiles.push(fileData);
            }
          }
          
          if (resourceFiles.length > 0) {
            resourceFiles.forEach(file => {
              backupData.resources.push({
                title: nameMatch ? nameMatch[1] : file.originalName,
                file_path: file.cloudinaryUrl,
                file_name: file.originalName,
                file_size: file.size || 0
              });
            });
            console.log(`  📄 Resource: ${nameMatch ? nameMatch[1] : 'File'} (${resourceFiles.length} files)`);
          }
        } catch (error) {
          console.error('Error parsing resource:', error.message);
        }
      }
    }
    
    console.log(`📊 Summary: ${backupData.units.length} units, ${backupData.resources.length} resources`);

    // Create course from extracted data
    const courseId = Date.now();
    backupData.courses.push({
      id: courseId,
      title: courseTitle,
      description: courseDescription,
      status: 'Active',
      created_by: 1, // Default to admin
      category_id: categoryId || null,
      sub_category_id: subCategoryId || null
    });
    
    // Link units to this course
    backupData.units.forEach(unit => {
      unit.course_id = courseId;
    });
    
    // Link resources to this course
    backupData.resources.forEach(resource => {
      resource.course_id = courseId;
    });

    // Create a category for Moodle imports
    backupData.categories.push({
      id: Date.now() + 1,
      name: 'Moodle Imports',
      description: 'Courses imported from Moodle backup files'
    });

    // Extract assignments and quizzes if available
    if (courseXml) {
      // Look for assignment activities
      const assignmentMatches = courseXml.match(/<activity.*?type="assign".*?<\/activity>/gs);
      if (assignmentMatches) {
        assignmentMatches.forEach((match, index) => {
          const nameMatch = match.match(/<name><!\[CDATA\[(.*?)\]\]><\/name>/);
          const descMatch = match.match(/<intro><!\[CDATA\[(.*?)\]\]><\/intro>/);
          
          backupData.assignments.push({
            id: Date.now() + index + 100,
            course_id: Date.now(),
            title: nameMatch ? nameMatch[1] : `Assignment ${index + 1}`,
            description: descMatch ? descMatch[1] : 'Imported from Moodle',
            due_date: null,
            created_by: 1
          });
        });
      }

      // Look for quiz activities
      const quizMatches = courseXml.match(/<activity.*?type="quiz".*?<\/activity>/gs);
      if (quizMatches) {
        quizMatches.forEach((match, index) => {
          const nameMatch = match.match(/<name><!\[CDATA\[(.*?)\]\]><\/name>/);
          const descMatch = match.match(/<intro><!\[CDATA\[(.*?)\]\]><\/intro>/);
          
          backupData.quizzes.push({
            id: Date.now() + index + 200,
            course_id: Date.now(),
            title: nameMatch ? nameMatch[1] : `Quiz ${index + 1}`,
            created_by: 1
          });
        });
      }
    }

    return backupData;
  } catch (error) {
    console.error('Error parsing .mbz file:', error);
    
    // Fallback: create basic course from filename
    const fileName = path.basename(filePath, '.mbz');
    const courseTitle = fileName.replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    return {
      courses: [{
        id: Date.now(),
        title: courseTitle,
        description: `Imported from Moodle backup: ${fileName}`,
        status: 'Active',
        created_by: 1,
        category_id: 1
      }],
      categories: [{
        id: 1,
        name: 'Moodle Imports',
        description: 'Courses imported from Moodle backup files'
      }],
      assignments: [],
      quizzes: [],
      timestamp: new Date().toISOString()
    };
  }
}

// ===============================
// ASSIGNMENT MANAGEMENT
// ===============================

// Get all assignments
router.get('/assignments', cacheMiddleware(60), async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT a.*, c.title as course_title, u.name as created_by_name 
      FROM assignments a 
      LEFT JOIN courses c ON a.course_id = c.id 
      LEFT JOIN users u ON a.created_by = u.id 
      ORDER BY a.created_at DESC
    `);
    res.json({ success: true, assignments: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error fetching assignments' });
  }
});

// Create assignment (with optional unit_id)
router.post('/assignments', async (req, res) => {
  try {
    const { course_id, unit_id, title, description, due_date, created_by } = req.body;
    
    const [result] = await pool.execute(
      'INSERT INTO assignments (course_id, unit_id, title, description, due_date, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [course_id, unit_id || null, title, description, due_date, created_by]
    );

    res.json({ success: true, message: 'Assignment created successfully', assignmentId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error creating assignment' });
  }
});

// Update assignment
router.put('/assignments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, due_date, unit_id } = req.body;
    
    await pool.execute(
      'UPDATE assignments SET title = ?, description = ?, due_date = ?, unit_id = ? WHERE id = ?',
      [title, description, due_date, unit_id || null, id]
    );

    res.json({ success: true, message: 'Assignment updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error updating assignment' });
  }
});

// Delete assignment
router.delete('/assignments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM assignments WHERE id = ?', [id]);
    res.json({ success: true, message: 'Assignment deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error deleting assignment' });
  }
});

// ===============================
// QUIZ MANAGEMENT
// ===============================

// Get all quizzes
router.get('/quizzes', cacheMiddleware(60), async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT q.*, c.title as course_title, u.name as created_by_name 
      FROM quizzes q 
      LEFT JOIN courses c ON q.course_id = c.id 
      LEFT JOIN users u ON q.created_by = u.id 
      ORDER BY q.created_at DESC
    `);
    res.json({ success: true, quizzes: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error fetching quizzes' });
  }
});

// Create quiz
router.post('/quizzes', async (req, res) => {
  try {
    const { course_id, title, created_by } = req.body;
    
    const [result] = await pool.execute(
      'INSERT INTO quizzes (course_id, title, created_by) VALUES (?, ?, ?)',
      [course_id, title, created_by]
    );

    res.json({ success: true, message: 'Quiz created successfully', quizId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error creating quiz' });
  }
});

// ===============================
// ANALYTICS & REPORTS
// ===============================

// Get dashboard statistics
router.get('/stats', cacheMiddleware(60), async (req, res) => {
  try {
    // Get user counts by role - ensure all roles are included even if count is 0
    const [userStats] = await pool.execute(`
      SELECT r.name as role, COUNT(u.id) as count 
      FROM roles r 
      LEFT JOIN users u ON r.id = u.role_id 
      GROUP BY r.id, r.name
      ORDER BY r.id
    `);

    // Convert count to number for each user stat
    const formattedUserStats = userStats.map(stat => ({
      role: stat.role,
      count: parseInt(stat.count) || 0
    }));

    // Get course stats - handle case where status column might not exist
    let courseStats;
    try {
      // Check if status column exists
      const [columns] = await pool.execute(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'courses' 
        AND COLUMN_NAME = 'status'
      `);
      
      if (columns.length > 0) {
        // Status column exists
        [courseStats] = await pool.execute(`
          SELECT 
            COUNT(*) as total_courses,
            SUM(CASE WHEN status = 'Active' OR status = 'active' THEN 1 ELSE 0 END) as active_courses
          FROM courses
        `);
      } else {
        // Status column doesn't exist - all courses are considered active
        [courseStats] = await pool.execute(`
          SELECT 
            COUNT(*) as total_courses,
            COUNT(*) as active_courses
          FROM courses
        `);
      }
    } catch (err) {
      // Fallback if there's an error
      [courseStats] = await pool.execute(`
        SELECT 
          COUNT(*) as total_courses,
          COUNT(*) as active_courses
        FROM courses
      `);
    }

    // Get assignment stats
    let assignmentStats;
    try {
      [assignmentStats] = await pool.execute(`
        SELECT COUNT(*) as total_assignments FROM assignments
      `);
    } catch (err) {
      // If assignments table doesn't exist, return 0
      assignmentStats = [{ total_assignments: 0 }];
    }

    // Get quiz stats
    let quizStats;
    try {
      [quizStats] = await pool.execute(`
        SELECT COUNT(*) as total_quizzes FROM quizzes
      `);
    } catch (err) {
      // If quizzes table doesn't exist, return 0
      quizStats = [{ total_quizzes: 0 }];
    }

    res.json({
      success: true,
      stats: {
        users: formattedUserStats,
        courses: {
          total_courses: parseInt(courseStats[0]?.total_courses) || 0,
          active_courses: parseInt(courseStats[0]?.active_courses) || 0
        },
        assignments: {
          total_assignments: parseInt(assignmentStats[0]?.total_assignments) || 0
        },
        quizzes: {
          total_quizzes: parseInt(quizStats[0]?.total_quizzes) || 0
        }
      }
    });
  } catch (err) {
    console.error('[Admin Stats] Error:', err);
    res.status(500).json({ success: false, message: 'Error fetching statistics', error: err.message });
  }
});

// ===============================
// FORUM MANAGEMENT
// ===============================

// Get all forums
router.get('/forums', cacheMiddleware(300), async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT f.*, c.title as course_title, u.name as created_by_name 
      FROM forums f 
      LEFT JOIN courses c ON f.course_id = c.id 
      LEFT JOIN users u ON f.created_by = u.id 
      ORDER BY f.created_at DESC
    `);
    res.json({ success: true, forums: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error fetching forums' });
  }
});

// ===============================
// CERTIFICATE & BADGE MANAGEMENT
// ===============================

// Get all certificates
router.get('/certificates', cacheMiddleware(300), async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT cert.*, u.name as student_name, c.title as course_title 
      FROM certificates cert 
      LEFT JOIN users u ON cert.student_id = u.id 
      LEFT JOIN courses c ON cert.course_id = c.id 
      ORDER BY cert.issued_at DESC
    `);
    res.json({ success: true, certificates: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error fetching certificates' });
  }
});

// Create certificate
router.post('/certificates', async (req, res) => {
  try {
    const { student_id, course_id, title } = req.body;
    
    const [result] = await pool.execute(
      'INSERT INTO certificates (student_id, course_id, title) VALUES (?, ?, ?)',
      [student_id, course_id, title]
    );

    res.json({ success: true, message: 'Certificate created successfully', certificateId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error creating certificate' });
  }
});

// Proxy endpoint to serve files (PDFs, videos) from Cloudinary (bypasses CORS and auth issues)
router.get('/proxy-pdf', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ success: false, message: 'URL required' });
    }

    console.log('[Admin Proxy] Received URL:', url);
    
    let fileUrl = decodeURIComponent(url);
    const isPdf = fileUrl.includes('.pdf') || fileUrl.includes('/raw/');
    
    console.log('[Admin Proxy] Will fetch URL directly:', fileUrl);
    
    // Fetch from Cloudinary
    const finalClient = fileUrl.startsWith('https') ? https : http;
    finalClient.get(fileUrl, (response) => {
      // Handle errors
      if (response.statusCode === 401 || response.statusCode === 403) {
        console.error('File access denied (401/403):', fileUrl);
        return res.status(401).json({ 
          success: false, 
          message: 'File is not publicly accessible.' 
        });
      }
      
      if (response.statusCode !== 200) {
        console.error('Failed to fetch file:', response.statusCode, fileUrl);
        return res.status(response.statusCode).json({ 
          success: false, 
          message: `Failed to fetch file: ${response.statusCode}` 
        });
      }
      
      // *** THIS IS THE KEY PART ***
      // Set headers to force INLINE display (not download)
      if (isPdf) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="document.pdf"');
      }
      
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      
      // Stream the file to response
      response.pipe(res);
    }).on('error', (err) => {
      console.error('Failed to fetch file:', err.message);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch file from storage' 
      });
    });
  } catch (err) {
    console.error('Proxy PDF error:', err);
    res.status(500).json({ success: false, message: 'Error proxying PDF' });
  }
});

// =====================================================
// STUDENT PROFILE ROUTES (Admin & Tutor)
// =====================================================

// GET /api/admin/students/profiles - Get all students profiles (Admin)
router.get('/students/profiles', auth, cacheMiddleware(60), async (req, res) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'Admin') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    
    const { search, status } = req.query;
    
    // Get all student role types (Student, ManagerStudent, InstituteStudent)
    const targetRoles = ['Student', 'ManagerStudent', 'InstituteStudent'];
    const placeholders = targetRoles.map(() => '?').join(', ');
    
    let query = `
      SELECT 
        u.id as user_id,
        u.name,
        u.email,
        sp.id as profile_id,
        sp.gender,
        sp.date_of_birth,
        sp.nationality,
        sp.ethnicity,
        sp.current_role,
        sp.previous_qualification,
        sp.motivation,
        sp.vark_visual,
        sp.vark_auditory,
        sp.vark_reading,
        sp.vark_kinesthetic,
        sp.english_literacy,
        sp.ict_skills,
        sp.special_learning_needs,
        sp.profile_picture,
        sp.is_profile_complete,
        sp.profile_completed_at,
        sp.created_at as profile_created_at,
        sp.updated_at as profile_updated_at,
        CASE 
          WHEN sp.is_profile_complete = 1 THEN 'complete'
          ELSE 'incomplete'
        END as profile_status
      FROM users u
      LEFT JOIN student_profiles sp ON u.id = sp.user_id
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE r.name IN (${placeholders}) AND u.id IS NOT NULL
    `;
    
    const params = [...targetRoles];
    
    if (search) {
      query += ' AND (u.name LIKE ? OR u.email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    if (status === 'complete') {
      query += ' AND sp.is_profile_complete = 1';
    } else if (status === 'incomplete') {
      query += ' AND (sp.is_profile_complete = 0 OR sp.is_profile_complete IS NULL)';
    }
    
    query += ' ORDER BY u.name ASC';
    
    console.log('[Admin] Fetching students profiles. Query:', query.substring(0, 200) + '...');
    console.log('[Admin] Params:', params);
    
    const [rows] = await pool.execute(query, params);
    
    console.log('[Admin] Found', rows.length, 'students');
    
    res.json({
      success: true,
      students: rows
    });
  } catch (error) {
    console.error('Error fetching students profiles:', error);
    res.status(500).json({ success: false, message: 'Error fetching students profiles' });
  }
});

// GET /api/admin/students/:studentId/profile - Get single student profile (Admin)
router.get('/students/:studentId/profile', auth, cacheMiddleware(60), async (req, res) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'Admin') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    
    const { studentId } = req.params;
    
    // Get user info
    const [userRows] = await pool.execute(
      'SELECT id, name, email FROM users WHERE id = ?',
      [studentId]
    );
    
    if (userRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    
    // Get profile
    const [profileRows] = await pool.execute(
      'SELECT * FROM student_profiles WHERE user_id = ?',
      [studentId]
    );
    
    const profile = profileRows.length > 0 ? profileRows[0] : null;
    const user = userRows[0];
    
    res.json({
      success: true,
      profile: {
        user_id: user.id,
        name: user.name,
        email: user.email,
        ...profile
      }
    });
  } catch (error) {
    console.error('Error fetching student profile:', error);
    res.status(500).json({ success: false, message: 'Error fetching student profile' });
  }
});

// GET /api/tutor/students/profiles - Get all students profiles (same as admin)
tutorRouter.get('/students/profiles', auth, cacheMiddleware(60), async (req, res) => {
  try {
    // Check if user is tutor
    if (req.user?.role !== 'Tutor') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    
    const { search, status } = req.query;
    
    // Get all student role types (Student, ManagerStudent, InstituteStudent)
    const targetRoles = ['Student', 'ManagerStudent', 'InstituteStudent'];
    const placeholders = targetRoles.map(() => '?').join(', ');
    
    // Get all students (same query as admin)
    let query = `
      SELECT 
        u.id as user_id,
        u.name,
        u.email,
        sp.id as profile_id,
        sp.gender,
        sp.date_of_birth,
        sp.nationality,
        sp.ethnicity,
        sp.current_role,
        sp.previous_qualification,
        sp.motivation,
        sp.vark_visual,
        sp.vark_auditory,
        sp.vark_reading,
        sp.vark_kinesthetic,
        sp.english_literacy,
        sp.ict_skills,
        sp.special_learning_needs,
        sp.profile_picture,
        sp.is_profile_complete,
        sp.profile_completed_at,
        sp.created_at as profile_created_at,
        sp.updated_at as profile_updated_at,
        CASE 
          WHEN sp.is_profile_complete = 1 THEN 'complete'
          ELSE 'incomplete'
        END as profile_status
      FROM users u
      LEFT JOIN student_profiles sp ON u.id = sp.user_id
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE r.name IN (${placeholders}) AND u.id IS NOT NULL
    `;
    
    const params = [...targetRoles];
    
    if (search) {
      query += ' AND (u.name LIKE ? OR u.email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    if (status === 'complete') {
      query += ' AND sp.is_profile_complete = 1';
    } else if (status === 'incomplete') {
      query += ' AND (sp.is_profile_complete = 0 OR sp.is_profile_complete IS NULL)';
    }
    
    query += ' ORDER BY u.name ASC';
    
    console.log('[Tutor Students Profiles] Fetching all students profiles (same as admin)');
    console.log('[Tutor Students Profiles] Search:', search || 'none');
    console.log('[Tutor Students Profiles] Status filter:', status || 'none');
    
    const [rows] = await pool.execute(query, params);
    
    console.log('[Tutor Students Profiles] Found', rows.length, 'students');
    
    res.json({
      success: true,
      students: rows
    });
  } catch (error) {
    console.error('Error fetching tutor students profiles:', error);
    res.status(500).json({ success: false, message: 'Error fetching students profiles' });
  }
});

// GET /api/tutor/students/:studentId/profile - Get single student profile (Tutor)
tutorRouter.get('/students/:studentId/profile', auth, cacheMiddleware(60), async (req, res) => {
  try {
    // Check if user is tutor
    if (req.user?.role !== 'Tutor') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    
    const { studentId } = req.params;
    
    // Get user info
    const [userRows] = await pool.execute(
      'SELECT id, name, email FROM users WHERE id = ?',
      [studentId]
    );
    
    if (userRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    
    // Get profile
    const [profileRows] = await pool.execute(
      'SELECT * FROM student_profiles WHERE user_id = ?',
      [studentId]
    );
    
    const profile = profileRows.length > 0 ? profileRows[0] : null;
    const user = userRows[0];
    
    res.json({
      success: true,
      profile: {
        user_id: user.id,
        name: user.name,
        email: user.email,
        ...profile
      }
    });
  } catch (error) {
    console.error('Error fetching tutor student profile:', error);
    res.status(500).json({ success: false, message: 'Error fetching student profile' });
  }
});

module.exports = router;
module.exports.tutorRouter = tutorRouter;
