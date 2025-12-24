const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { cacheMiddleware, invalidateCache } = require('../middleware/cache');

// GET /api/admin/enrollments/:courseId/:studentId/installments - Get installments for a student-course
router.get('/admin/enrollments/:courseId/:studentId/installments', auth, cacheMiddleware(60), async (req, res) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'Admin') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    
    const { courseId, studentId } = req.params;
    
    const [rows] = await pool.execute(
      `SELECT * FROM student_payment_installments 
       WHERE student_id = ? AND course_id = ? 
       ORDER BY installment_number ASC`,
      [studentId, courseId]
    );
    
    // Get payment type (check if all_paid exists)
    let paymentType = 'installment';
    if (rows.length === 0) {
      // Check if there's an all_paid record
      const [allPaidRows] = await pool.execute(
        `SELECT payment_type FROM student_payment_installments 
         WHERE student_id = ? AND course_id = ? AND payment_type = 'all_paid' 
         LIMIT 1`,
        [studentId, courseId]
      );
      if (allPaidRows.length > 0) {
        paymentType = 'all_paid';
      }
    } else {
      paymentType = rows[0].payment_type || 'installment';
    }
    
    res.json({
      success: true,
      payment_type: paymentType,
      installments: rows
    });
  } catch (error) {
    console.error('Error fetching payment installments:', error);
    res.status(500).json({ success: false, message: 'Error fetching payment installments' });
  }
});

// POST /api/admin/enrollments/:courseId/:studentId/installments - Save payment installments
router.post('/admin/enrollments/:courseId/:studentId/installments', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'Admin') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    
    const { courseId, studentId } = req.params;
    const { payment_type, installments } = req.body;
    
    if (!payment_type || !['all_paid', 'installment'].includes(payment_type)) {
      return res.status(400).json({ success: false, message: 'Invalid payment_type' });
    }
    
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      // Delete existing installments for this student-course
      await connection.execute(
        'DELETE FROM student_payment_installments WHERE student_id = ? AND course_id = ?',
        [studentId, courseId]
      );
      
      if (payment_type === 'all_paid') {
        // Create a single record indicating all paid
        await connection.execute(
          `INSERT INTO student_payment_installments 
           (student_id, course_id, installment_number, installment_name, amount, due_date, status, payment_type)
           VALUES (?, ?, 1, 'All Fees Paid', 0, NULL, 'paid', 'all_paid')`,
          [studentId, courseId]
        );
      } else if (payment_type === 'installment') {
        // Validate installments array
        if (!Array.isArray(installments) || installments.length === 0) {
          await connection.rollback();
          return res.status(400).json({ success: false, message: 'Installments array is required' });
        }
        
        // Insert installments
        for (const installment of installments) {
          const { installment_number, installment_name, amount, due_date, status } = installment;
          
          if (!installment_number || !installment_name || amount === undefined) {
            await connection.rollback();
            return res.status(400).json({ 
              success: false, 
              message: 'Each installment must have installment_number, installment_name, and amount' 
            });
          }
          
          // Validate amount
          const amountNum = parseFloat(amount);
          if (isNaN(amountNum) || amountNum < 0) {
            await connection.rollback();
            return res.status(400).json({ 
              success: false, 
              message: 'Amount must be a positive number' 
            });
          }
          
          // Validate status
          const validStatus = ['paid', 'due', 'overdue'];
          const installmentStatus = status || 'due';
          if (!validStatus.includes(installmentStatus)) {
            await connection.rollback();
            return res.status(400).json({ 
              success: false, 
              message: `Status must be one of: ${validStatus.join(', ')}` 
            });
          }
          
          await connection.execute(
            `INSERT INTO student_payment_installments 
             (student_id, course_id, installment_number, installment_name, amount, due_date, status, payment_type, paid_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'installment', ?)`,
            [
              studentId,
              courseId,
              installment_number,
              installment_name,
              amountNum,
              due_date || null,
              installmentStatus,
              installmentStatus === 'paid' ? new Date() : null
            ]
          );
        }
      }
      
      await connection.commit();
      
      // Invalidate cache
      invalidateCache(`/api/admin/enrollments/${courseId}/${studentId}/installments`);
      
      res.json({
        success: true,
        message: 'Payment installments saved successfully'
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error saving payment installments:', error);
    res.status(500).json({ success: false, message: 'Error saving payment installments' });
  }
});

// GET /api/student/installments - Get student's payment installments
router.get('/student/installments', auth, cacheMiddleware(60), async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    const { courseId } = req.query;
    
    let query = `
      SELECT 
        spi.*,
        c.title as course_title,
        c.id as course_id
      FROM student_payment_installments spi
      JOIN courses c ON spi.course_id = c.id
      WHERE spi.student_id = ?
    `;
    
    const params = [userId];
    
    if (courseId) {
      query += ' AND spi.course_id = ?';
      params.push(courseId);
    }
    
    query += ' ORDER BY spi.course_id, spi.installment_number ASC';
    
    const [rows] = await pool.execute(query, params);
    
    // Group by course
    const grouped = {};
    rows.forEach(row => {
      if (!grouped[row.course_id]) {
        grouped[row.course_id] = {
          course_id: row.course_id,
          course_title: row.course_title,
          payment_type: row.payment_type,
          installments: []
        };
      }
      grouped[row.course_id].installments.push(row);
    });
    
    res.json({
      success: true,
      installments: Object.values(grouped)
    });
  } catch (error) {
    console.error('Error fetching student installments:', error);
    res.status(500).json({ success: false, message: 'Error fetching installments' });
  }
});

// PATCH /api/admin/installments/:installmentId/status - Update installment status
router.patch('/admin/installments/:installmentId/status', auth, async (req, res) => {
  try {
    // Check if user is admin or tutor
    if (req.user?.role !== 'Admin' && req.user?.role !== 'Tutor') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    
    const { installmentId } = req.params;
    const { status, paid_at, payment_reference, notes } = req.body;
    
    if (!status || !['paid', 'due', 'overdue'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
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
    
    await pool.execute(
      `UPDATE student_payment_installments 
       SET ${updateFields.join(', ')}, updated_at = NOW()
       WHERE id = ?`,
      updateValues
    );
    
    // Invalidate cache
    invalidateCache(`/api/student/installments`);
    
    res.json({
      success: true,
      message: 'Installment status updated successfully'
    });
  } catch (error) {
    console.error('Error updating installment status:', error);
    res.status(500).json({ success: false, message: 'Error updating installment status' });
  }
});

// GET /api/admin/payments/stats - Get payment statistics (Admin)
router.get('/admin/payments/stats', auth, cacheMiddleware(60), async (req, res) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'Admin') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    
    // Get total students with payment plans
    const [totalStudentsRows] = await pool.execute(
      `SELECT COUNT(DISTINCT student_id) as total FROM student_payment_installments`
    );
    const totalStudents = totalStudentsRows[0]?.total || 0;
    
    // Get paid installments count
    const [paidCountRows] = await pool.execute(
      `SELECT COUNT(*) as count FROM student_payment_installments WHERE status = 'paid'`
    );
    const paidInstallments = paidCountRows[0]?.count || 0;
    
    // Get pending installments count (due + overdue)
    const [pendingCountRows] = await pool.execute(
      `SELECT COUNT(*) as count FROM student_payment_installments WHERE status IN ('due', 'overdue')`
    );
    const pendingInstallments = pendingCountRows[0]?.count || 0;
    
    // Get overdue amount - payments with status 'overdue' OR status 'due' with due_date in the past
    const [overdueAmountRows] = await pool.execute(
      `SELECT COALESCE(SUM(amount), 0) as total 
       FROM student_payment_installments 
       WHERE status = 'overdue' 
       OR (status = 'due' AND due_date IS NOT NULL AND due_date < CURDATE())`
    );
    const overdueAmount = overdueAmountRows[0]?.total || 0;
    
    // Get students with overdue payments (critical) - status 'overdue' OR status 'due' with due_date in the past
    const [overdueStudentsRows] = await pool.execute(
      `SELECT COUNT(DISTINCT student_id) as count 
       FROM student_payment_installments 
       WHERE status = 'overdue' 
       OR (status = 'due' AND due_date IS NOT NULL AND due_date < CURDATE())`
    );
    const studentsWithOverdue = overdueStudentsRows[0]?.count || 0;
    
    // Get upcoming payments (next 7 days)
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const [upcoming7DaysRows] = await pool.execute(
      `SELECT COUNT(*) as count FROM student_payment_installments 
       WHERE status IN ('due', 'overdue') 
       AND due_date IS NOT NULL 
       AND due_date <= ? AND due_date >= CURDATE()`,
      [sevenDaysFromNow.toISOString().split('T')[0]]
    );
    const upcoming7Days = upcoming7DaysRows[0]?.count || 0;
    
    // Get upcoming payments (next 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const [upcoming30DaysRows] = await pool.execute(
      `SELECT COUNT(*) as count FROM student_payment_installments 
       WHERE status IN ('due', 'overdue') 
       AND due_date IS NOT NULL 
       AND due_date <= ? AND due_date >= CURDATE()`,
      [thirtyDaysFromNow.toISOString().split('T')[0]]
    );
    const upcoming30Days = upcoming30DaysRows[0]?.count || 0;
    
    // Get fully paid students (all installments paid)
    const [fullyPaidRows] = await pool.execute(
      `SELECT DISTINCT student_id, course_id 
       FROM student_payment_installments 
       WHERE student_id NOT IN (
         SELECT DISTINCT student_id 
         FROM student_payment_installments 
         WHERE status IN ('due', 'overdue')
       )
       GROUP BY student_id, course_id`
    );
    const fullyPaid = fullyPaidRows.length;
    
    // Get partially paid students (some installments paid, some due)
    const [partiallyPaidRows] = await pool.execute(
      `SELECT DISTINCT spi1.student_id, spi1.course_id
       FROM student_payment_installments spi1
       WHERE EXISTS (
         SELECT 1 FROM student_payment_installments spi2 
         WHERE spi2.student_id = spi1.student_id 
         AND spi2.course_id = spi1.course_id 
         AND spi2.status = 'paid'
       )
       AND EXISTS (
         SELECT 1 FROM student_payment_installments spi3 
         WHERE spi3.student_id = spi1.student_id 
         AND spi3.course_id = spi1.course_id 
         AND spi3.status IN ('due', 'overdue')
       )
       GROUP BY spi1.student_id, spi1.course_id`
    );
    const partiallyPaid = partiallyPaidRows.length;
    
    // Get students with no payments yet (all installments are due/overdue, none paid)
    const [noPaymentRows] = await pool.execute(
      `SELECT DISTINCT spi1.student_id, spi1.course_id
       FROM student_payment_installments spi1
       WHERE NOT EXISTS (
         SELECT 1 FROM student_payment_installments spi2 
         WHERE spi2.student_id = spi1.student_id 
         AND spi2.course_id = spi1.course_id 
         AND spi2.status = 'paid'
       )
       GROUP BY spi1.student_id, spi1.course_id`
    );
    const noPaymentYet = noPaymentRows.length;
    
    res.json({
      success: true,
      stats: {
        total_students: totalStudents,
        paid_installments: paidInstallments,
        pending_installments: pendingInstallments,
        overdue_amount: overdueAmount,
        students_with_overdue: studentsWithOverdue,
        upcoming_7_days: upcoming7Days,
        upcoming_30_days: upcoming30Days,
        fully_paid: fullyPaid,
        partially_paid: partiallyPaid,
        no_payment_yet: noPaymentYet
      }
    });
  } catch (error) {
    console.error('Error fetching payment statistics:', error);
    res.status(500).json({ success: false, message: 'Error fetching payment statistics' });
  }
});

// GET /api/admin/payments - Get all payment installments (Admin)
router.get('/admin/payments', auth, cacheMiddleware(60), async (req, res) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'Admin') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    
    const { status, search, page = 1, limit = 25 } = req.query;
    
    // Ensure limit and offset are always valid integers
    const finalLimit = Math.max(1, Math.min(1000, parseInt(limit, 10) || 25));
    const finalPage = Math.max(1, parseInt(page, 10) || 1);
    const finalOffset = Math.max(0, (finalPage - 1) * finalLimit);
    
    let baseQuery = `
      FROM student_payment_installments spi
      JOIN users u ON spi.student_id = u.id
      JOIN courses c ON spi.course_id = c.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (status) {
      baseQuery += ' AND spi.status = ?';
      params.push(status);
    }
    
    if (search) {
      baseQuery += ' AND (u.name LIKE ? OR u.email LIKE ? OR c.title LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    
    // Get total count
    const [countRows] = await pool.execute(`SELECT COUNT(*) as total ${baseQuery}`, params);
    const total = countRows[0]?.total || 0;
    
    // Get paginated data
    let dataQuery = `
      SELECT 
        spi.*,
        u.name as student_name,
        u.email as student_email,
        c.title as course_title
      ${baseQuery}
      ORDER BY spi.due_date ASC, u.name ASC
      LIMIT ? OFFSET ?
    `;
    
    // MySQL LIMIT/OFFSET can be problematic with prepared statements
    // Use template literals for LIMIT/OFFSET to avoid parameter binding issues
    const queryWithLimit = dataQuery.replace('LIMIT ? OFFSET ?', `LIMIT ${finalLimit} OFFSET ${finalOffset}`);
    
    const [rows] = await pool.execute(queryWithLimit, params);
    
    res.json({
      success: true,
      installments: rows,
      pagination: {
        page: finalPage,
        limit: finalLimit,
        total: total,
        totalPages: Math.ceil(total / finalLimit)
      }
    });
  } catch (error) {
    console.error('Error fetching all payments:', error);
    res.status(500).json({ success: false, message: 'Error fetching payments' });
  }
});

// GET /api/admin/students/:studentId/installments - Get all installments for a specific student (Admin)
router.get('/admin/students/:studentId/installments', auth, cacheMiddleware(60), async (req, res) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'Admin') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    
    const { studentId } = req.params;
    
    const [rows] = await pool.execute(
      `SELECT 
        spi.*,
        c.title as course_title,
        c.id as course_id
      FROM student_payment_installments spi
      JOIN courses c ON spi.course_id = c.id
      WHERE spi.student_id = ?
      ORDER BY c.title ASC, spi.installment_number ASC`,
      [studentId]
    );
    
    res.json({
      success: true,
      installments: rows
    });
  } catch (error) {
    console.error('Error fetching student installments:', error);
    res.status(500).json({ success: false, message: 'Error fetching student installments' });
  }
});

// GET /api/tutor/payments - Get tutor's students payment installments
router.get('/tutor/payments', auth, cacheMiddleware(60), async (req, res) => {
  try {
    // Check if user is tutor
    if (req.user?.role !== 'Tutor') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    
    const tutorId = req.user.id;
    const { status, search, page = 1, limit = 25 } = req.query;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 25;
    const offset = (pageNum - 1) * limitNum;
    
    let baseQuery = `
      FROM student_payment_installments spi
      JOIN users u ON spi.student_id = u.id
      JOIN courses c ON spi.course_id = c.id
      WHERE c.created_by = ?
    `;
    
    const params = [tutorId];
    
    if (status) {
      baseQuery += ' AND spi.status = ?';
      params.push(status);
    }
    
    if (search) {
      baseQuery += ' AND (u.name LIKE ? OR u.email LIKE ? OR c.title LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    
    // Get total count
    const [countRows] = await pool.execute(`SELECT COUNT(*) as total ${baseQuery}`, params);
    const total = countRows[0]?.total || 0;
    
    // Get paginated data
    let dataQuery = `
      SELECT 
        spi.*,
        u.name as student_name,
        u.email as student_email,
        c.title as course_title
      ${baseQuery}
      ORDER BY spi.due_date ASC, u.name ASC
      LIMIT ? OFFSET ?
    `;
    
    params.push(limitNum, offset);
    const [rows] = await pool.execute(dataQuery, params);
    
    res.json({
      success: true,
      installments: rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching tutor payments:', error);
    res.status(500).json({ success: false, message: 'Error fetching payments' });
  }
});

module.exports = router;

