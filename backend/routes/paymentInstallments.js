// GOING LIVE CHECKLIST — only change .env values:
// STRIPE_SECRET_KEY=sk_live_xxxx
// NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxxx
// STRIPE_WEBHOOK_SECRET=whsec_live_xxxx (from Stripe dashboard)
// Zero code changes needed.

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { cacheMiddleware, invalidateCache } = require('../middleware/cache');
const { getStripeClient, getStripeConfig } = require('../services/settingsService');

// Roles with full payment access (same as Admin): Accounts Manager + team
const PAYMENT_FULL_ACCESS_ROLES = ['Admin', 'Certificate Manager', 'Accounts Manager', 'Operation Manager', 'Administrative Manager', 'Admission Manager', 'Team Member'];

// GET /api/admin/enrollments/:courseId/:studentId/installments - Get installments for a student-course
router.get('/admin/enrollments/:courseId/:studentId/installments', auth, cacheMiddleware(60), async (req, res) => {
  try {
    if (!PAYMENT_FULL_ACCESS_ROLES.includes(req.user?.role || '')) {
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
    if (!PAYMENT_FULL_ACCESS_ROLES.includes(req.user?.role || '')) {
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
           (student_id, course_id, installment_number, is_deposit, installment_name, amount, due_date, status, payment_type)
           VALUES (?, ?, 1, 1, 'All Fees Paid', 0, NULL, 'paid', 'all_paid')`,
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
          const { installment_number, installment_name, amount, due_date, status, paid_at: paidAt, payment_reference } = installment;
          
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
          
          // paid_at: use provided value when status is paid, otherwise null
          const paidAtValue = installmentStatus === 'paid'
            ? (paidAt ? new Date(paidAt) : new Date())
            : null;

          await connection.execute(
            `INSERT INTO student_payment_installments 
             (student_id, course_id, installment_number, is_deposit, installment_name, amount, due_date, status, payment_type, paid_at, payment_reference)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'installment', ?, ?)`,
            [
              studentId,
              courseId,
              installment_number,
              installment_number === 1 ? 1 : 0,
              installment_name,
              amountNum,
              due_date || null,
              installmentStatus,
              paidAtValue,
              payment_reference || null
            ]
          );
        }
      }
      
      await connection.commit();
      
      // Invalidate cache
      await invalidateCache(`cache:/api/admin/enrollments/${courseId}/${studentId}/installments*`);
      await invalidateCache('cache:/api/admin/students/*');
      await invalidateCache('cache:/api/student/installments*');
      await invalidateCache(`cache:/api/student/${studentId}/*`);
      await invalidateCache('cache:/api/admin/payments*');
      await invalidateCache('cache:/api/tutor/payments*');
      await invalidateCache('cache:/api/tickets/student/*/payment-installments*');
      
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

// Student-only role check for installment payment
const STUDENT_ROLES = ['Student', 'ManagerStudent', 'InstituteStudent'];
function requireStudent(req, res, next) {
  if (!STUDENT_ROLES.includes(req.user?.role || '')) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  next();
}

// POST /api/installments/:installmentId/pay - Create payment intent for installment (student only)
router.post('/installments/:installmentId/pay', auth, requireStudent, async (req, res) => {
  try {
    const installmentId = parseInt(req.params.installmentId, 10);
    const userId = req.user?.id;
    if (!userId || isNaN(installmentId)) {
      return res.status(400).json({ success: false, message: 'Invalid request' });
    }

    const [rows] = await pool.execute(
      'SELECT * FROM student_payment_installments WHERE id = ? AND student_id = ?',
      [installmentId, userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Installment not found' });
    }
    const installment = rows[0];
    if (installment.student_id !== userId) {
      return res.status(403).json({ success: false, message: 'Not your installment' });
    }
    if (installment.status === 'paid') {
      return res.status(409).json({ success: false, message: 'This installment is already paid' });
    }
    if (installment.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'This installment is cancelled' });
    }

    if (installment.stripe_payment_intent_id) {
      try {
        const stripe = await getStripeClient();
        const pi = await stripe.paymentIntents.retrieve(installment.stripe_payment_intent_id);
        if (pi.status === 'requires_payment_method' || pi.status === 'requires_confirmation') {
          return res.json({
            success: true,
            clientSecret: pi.client_secret,
            paymentIntentId: pi.id,
            amount: installment.amount,
            installmentName: installment.installment_name
          });
        }
      } catch (e) {
        // Intent may be invalid, create new one
      }
    }

    const amount = parseFloat(installment.amount);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    const stripe = await getStripeClient();
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: Math.round(amount * 100),
        currency: 'gbp',
        metadata: {
          type: 'installment',
          installmentId: installmentId.toString(),
          studentId: userId.toString(),
          installmentName: installment.installment_name || '',
          courseId: installment.course_id.toString()
        },
        description: `Installment: ${installment.installment_name || 'Payment'}`
      },
      { idempotencyKey: `installment_${installmentId}_${userId}` }
    );

    await pool.execute(
      `UPDATE student_payment_installments 
       SET stripe_payment_intent_id = ?, payment_initiated_at = NOW() 
       WHERE id = ?`,
      [paymentIntent.id, installmentId]
    );

    try {
      await pool.execute(
        `INSERT INTO payment_audit_log (student_id, reference_id, reference_type, event_type, stripe_payment_intent_id, amount, currency, status, source)
         VALUES (?, ?, 'installment', 'payment_intent_created', ?, ?, 'gbp', 'pending', 'api')`,
        [userId, installmentId, paymentIntent.id, amount]
      );
    } catch (e) {
      console.warn('[Installment Pay] payment_audit_log insert failed:', e.message);
    }

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount,
      installmentName: installment.installment_name,
      installmentId
    });
  } catch (error) {
    console.error('Error creating installment payment intent:', error);
    res.status(500).json({ success: false, message: 'Error creating payment intent' });
  }
});

// POST /api/installments/:installmentId/confirm - Confirm installment payment (student only)
router.post('/installments/:installmentId/confirm', auth, requireStudent, async (req, res) => {
  try {
    const installmentId = parseInt(req.params.installmentId, 10);
    const { paymentIntentId } = req.body;
    const userId = req.user?.id;
    if (!userId || isNaN(installmentId) || !paymentIntentId) {
      return res.status(400).json({ success: false, message: 'Invalid request' });
    }

    const [rows] = await pool.execute(
      'SELECT * FROM student_payment_installments WHERE id = ? AND student_id = ?',
      [installmentId, userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Installment not found' });
    }
    const installment = rows[0];
    if (installment.student_id !== userId) {
      return res.status(403).json({ success: false, message: 'Not your installment' });
    }
    if (installment.status === 'paid') {
      return res.json({ success: true, message: 'Payment confirmed' });
    }

    const stripe = await getStripeClient();
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ success: false, message: 'Payment not completed' });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [up] = await connection.execute(
        `UPDATE student_payment_installments 
         SET status = 'paid', paid_at = NOW(), payment_reference = ?, payment_method = 'stripe_online', stripe_payment_intent_id = ?
         WHERE id = ? AND status != 'paid'`,
        [paymentIntentId, paymentIntentId, installmentId]
      );
      if (up.affectedRows === 0) {
        await connection.rollback();
        return res.json({ success: true, message: 'Payment confirmed' });
      }

      try {
        await connection.execute(
          `INSERT INTO payment_audit_log (student_id, reference_id, reference_type, event_type, stripe_payment_intent_id, amount, currency, status, source)
           VALUES (?, ?, 'installment', 'payment_intent.succeeded', ?, ?, 'gbp', 'succeeded', 'api')`,
          [userId, installmentId, paymentIntentId, paymentIntent.amount / 100]
        );
      } catch (e) {
        console.warn('[Installment Confirm] payment_audit_log insert failed:', e.message);
      }

      const [counts] = await connection.execute(
        `SELECT COUNT(*) as total, SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_count
         FROM student_payment_installments WHERE student_id = ? AND course_id = ?`,
        [userId, installment.course_id]
      );
      const { total, paid_count } = counts[0] || {};
      if (total > 0 && total === paid_count) {
        const [caCols] = await connection.execute(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'course_assignments' AND COLUMN_NAME = 'payment_status'`
        );
        if (caCols.length > 0) {
          await connection.execute(
            'UPDATE course_assignments SET payment_status = ? WHERE student_id = ? AND course_id = ?',
            ['fully_paid', userId, installment.course_id]
          );
        }
      }
      await connection.commit();
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }

    await invalidateCache('cache:/api/student/installments*');
    await invalidateCache('cache:/api/admin/payments*');
    await invalidateCache('cache:/api/admin/students/*');
    await invalidateCache('cache:/api/tutor/payments*');

    const io = req.app.get('io');
    if (io) {
      io.to('admin_room').emit('installment_paid', {
        studentId: userId,
        installmentId,
        amount: installment.amount,
        installmentName: installment.installment_name,
        courseId: installment.course_id
      });
      io.to(`user_${userId}`).emit('new_notification', {
        type: 'payment_confirm',
        title: 'Payment Successful',
        message: `Payment received for ${installment.installment_name} — £${parseFloat(installment.amount).toFixed(2)}`
      });
    }

    res.json({ success: true, message: 'Payment confirmed' });
  } catch (error) {
    console.error('Error confirming installment payment:', error);
    res.status(500).json({ success: false, message: 'Error confirming payment' });
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
    // Check if user is admin, certificate manager, tutor, or finance staff
    const role = req.user?.role || '';
    const allowed = ['Admin', 'Certificate Manager', 'Assessor', 'Operation Manager', 'Accounts Manager', 'Administrative Manager', 'Admission Manager', 'Team Member'];
    if (!allowed.includes(role)) {
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
    
    // Invalidate cache so Admin, Assessor, Finance views get fresh data
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
    console.error('Error updating installment status:', error);
    res.status(500).json({ success: false, message: 'Error updating installment status' });
  }
});

// GET /api/admin/payments/stats - Get payment statistics (Admin, Certificate Manager, Accounts Manager + team)
router.get('/admin/payments/stats', auth, async (req, res) => {
  try {
    // Auto-mark past-due as overdue
    // Silent - runs on every page load
    try {
      await pool.execute(
        `UPDATE student_payment_installments
         SET status = 'overdue',
             updated_at = NOW()
         WHERE status = 'due'
         AND is_deposit = 0
         AND due_date < CURDATE()`
      )
    } catch(e) {
      // Non-critical - continue
    }

    if (!PAYMENT_FULL_ACCESS_ROLES.includes(req.user?.role || '')) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const {
      fromDate, toDate, month, year
    } = req.query;

    const paidParams = [];
    let paidFilter = '';
    if (fromDate && toDate) {
      paidFilter += ' AND DATE(spi.paid_at) BETWEEN ? AND ?';
      paidParams.push(fromDate, toDate);
    }
    if (month && year) {
      paidFilter += ' AND MONTH(ca.created_at) = ? AND YEAR(ca.created_at) = ?';
      paidParams.push(parseInt(month, 10), parseInt(year, 10));
    }

    const [paidStats] = await pool.execute(
      `SELECT
        COUNT(DISTINCT spi.student_id) as paid_students,
        SUM(CASE WHEN spi.is_deposit = 0 AND spi.status = 'paid' THEN spi.amount ELSE 0 END) as paid_installments_amount,
        SUM(CASE WHEN spi.is_deposit = 0 AND spi.status = 'paid' THEN 1 ELSE 0 END) as paid_installments_count,
        SUM(CASE WHEN spi.is_deposit = 1 AND spi.status = 'paid' THEN spi.amount ELSE 0 END) as paid_deposit_amount,
        SUM(CASE WHEN spi.is_deposit = 1 AND spi.status = 'paid' THEN 1 ELSE 0 END) as paid_deposits_count
       FROM student_payment_installments spi
       LEFT JOIN course_assignments ca
         ON ca.student_id = spi.student_id
         AND ca.course_id = spi.course_id
       WHERE spi.status = 'paid'
       ${paidFilter}`,
      paidParams
    );

    const [pendingStats] = await pool.execute(
      `SELECT
        COUNT(DISTINCT spi.student_id) as total_students,
        SUM(CASE WHEN spi.is_deposit = 0 AND spi.status IN ('due','overdue') THEN spi.amount ELSE 0 END) as pending_installments_amount,
        SUM(CASE WHEN spi.is_deposit = 0 AND spi.status IN ('due','overdue') THEN 1 ELSE 0 END) as pending_installments_count,
        SUM(CASE WHEN spi.is_deposit = 0 AND spi.status = 'overdue' THEN spi.amount ELSE 0 END) as overdue_amount,
        COUNT(DISTINCT CASE WHEN spi.is_deposit = 0 AND spi.status = 'overdue' THEN spi.student_id END) as overdue_students,
        SUM(CASE WHEN spi.is_deposit = 0 THEN spi.amount ELSE 0 END) as total_installments_amount,
        SUM(CASE WHEN spi.is_deposit = 0 THEN 1 ELSE 0 END) as total_installments_count,
        SUM(CASE WHEN spi.is_deposit = 1 THEN 1 ELSE 0 END) as total_deposits_count,
        SUM(CASE WHEN spi.is_deposit = 1 THEN spi.amount ELSE 0 END) as total_deposits_amount
       FROM student_payment_installments spi`,
      []
    );

    const paidRow = paidStats[0] || {};
    const pendingRow = pendingStats[0] || {};
    
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
        paid_installments_count: paidRow.paid_installments_count || 0,
        paid_installments_amount: paidRow.paid_installments_amount || 0,
        paid_deposits_count: paidRow.paid_deposits_count || 0,
        paid_deposit_amount: paidRow.paid_deposit_amount || 0,
        pending_installments: pendingRow.pending_installments_count || 0,
        pending_installments_amount: pendingRow.pending_installments_amount || 0,
        overdue_amount: pendingRow.overdue_amount || 0,
        overdue_students: pendingRow.overdue_students || 0,
        total_students: pendingRow.total_students || 0,
        total_deposits: pendingRow.total_deposits_count || 0,
        total_deposits_amount: pendingRow.total_deposits_amount || 0,
        paid_installments: paidRow.paid_installments_count || 0,
        students_with_overdue: pendingRow.overdue_students || 0,
        total_installments: pendingRow.pending_installments_count || 0,
        total_amount: pendingRow.total_installments_amount || 0,
        total_paid_amount: paidRow.paid_installments_amount || 0,
        total_pending_amount: pendingRow.pending_installments_amount || 0,
        total_overdue_amount: pendingRow.overdue_amount || 0,
        pending_students: pendingRow.total_students || 0,
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

// GET /api/admin/payments/export - Export filtered payment data as CSV
router.get('/admin/payments/export', auth, async (req, res) => {
  try {
    if (!PAYMENT_FULL_ACCESS_ROLES.includes(req.user?.role || '')) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const {
      fromDate, toDate,
      month, year,
      courseId, status,
      tab = 'all'
    } = req.query;

    let where = 'WHERE 1=1';
    const params = [];

    if (courseId) {
      where += ' AND spi.course_id = ?';
      params.push(parseInt(courseId, 10));
    }

    if (tab === 'received') {
      where += " AND spi.status = 'paid'";
      if (fromDate) {
        where += ' AND DATE(spi.paid_at) >= ?';
        params.push(fromDate);
      }
      if (toDate) {
        where += ' AND DATE(spi.paid_at) <= ?';
        params.push(toDate);
      }
    } else if (tab === 'pending') {
      where += " AND spi.status IN ('due','overdue')";
      where += ' AND spi.is_deposit = 0';
    } else {
      if (status) {
        where += ' AND spi.status = ?';
        params.push(status);
      }
      if (fromDate) {
        where += ' AND DATE(spi.paid_at) >= ?';
        params.push(fromDate);
      }
      if (toDate) {
        where += ' AND DATE(spi.paid_at) <= ?';
        params.push(toDate);
      }
    }

    if (month && year) {
      where += ' AND MONTH(ca.created_at) = ? AND YEAR(ca.created_at) = ?';
      params.push(parseInt(month, 10), parseInt(year, 10));
    }

    const [rows] = await pool.execute(
      `SELECT
         u.name as student_name,
         u.email as student_email,
         c.title as course_title,
         CASE WHEN spi.is_deposit = 1
           THEN 'Initial Deposit'
           ELSE CONCAT('Instalment ', spi.installment_number - 1)
         END as payment_type,
         spi.installment_number,
         spi.amount,
         spi.status,
         spi.due_date,
         spi.paid_at,
         spi.payment_reference,
         spi.payment_method,
         spi.notes
       FROM student_payment_installments spi
       JOIN users u ON u.id = spi.student_id
       JOIN courses c ON c.id = spi.course_id
       LEFT JOIN course_assignments ca
         ON ca.student_id = spi.student_id
         AND ca.course_id = spi.course_id
       ${where}
       ORDER BY u.name ASC, spi.installment_number ASC`,
      params
    );

    const headers = [
      'Student Name',
      'Email',
      'Course',
      'Payment Type',
      'Installment #',
      'Amount (£)',
      'Status',
      'Due Date',
      'Paid Date',
      'Reference',
      'Payment Method',
      'Notes'
    ];

    const csvRows = rows.map(r => [
      r.student_name,
      r.student_email,
      r.course_title,
      r.payment_type,
      r.installment_number,
      r.amount,
      r.status,
      r.due_date ? new Date(r.due_date).toLocaleDateString('en-GB') : '',
      r.paid_at ? new Date(r.paid_at).toLocaleDateString('en-GB') : '',
      r.payment_reference || '',
      r.payment_method || '',
      r.notes || ''
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));

    const csv = [headers.join(','), ...csvRows].join('\n');
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `payments_${tab}_${dateStr}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    console.error('[Export]', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/payments - Get all payment installments (Admin, Certificate Manager, Accounts Manager + team)
router.get('/admin/payments', auth, cacheMiddleware(60), async (req, res) => {
  try {
    // Auto-mark past-due as overdue
    // Silent - runs on every page load
    try {
      await pool.execute(
        `UPDATE student_payment_installments
         SET status = 'overdue',
             updated_at = NOW()
         WHERE status = 'due'
         AND is_deposit = 0
         AND due_date < CURDATE()`
      )
    } catch(e) {
      // Non-critical - continue
    }

    if (!PAYMENT_FULL_ACCESS_ROLES.includes(req.user?.role || '')) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    
    const { status, search, page = 1, limit = 25 } = req.query;
    
    // Ensure limit and offset are always valid integers
    // Allow up to 50,000 payments for admin payment management (client-side filtering)
    const finalLimit = Math.max(1, Math.min(50000, parseInt(limit, 10) || 25));
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

// GET /api/admin/students/:studentId/installments - Get all installments for a specific student (Admin, Certificate Manager, Accounts Manager + team)
router.get('/admin/students/:studentId/installments', auth, cacheMiddleware(60), async (req, res) => {
  try {
    if (!PAYMENT_FULL_ACCESS_ROLES.includes(req.user?.role || '')) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    
    const { studentId } = req.params;
    
    const [rows] = await pool.execute(
      `SELECT 
        spi.is_deposit,
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
    if (req.user?.role !== 'Assessor') {
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
    
    // Get paginated data - explicitly include student_id
    // MySQL LIMIT/OFFSET can be problematic with prepared statements
    // Use template literals for LIMIT/OFFSET to avoid parameter binding issues
    let dataQuery = `
      SELECT 
        spi.id,
        spi.student_id,
        spi.course_id,
        spi.installment_number,
        spi.installment_name,
        spi.amount,
        spi.due_date,
        spi.status,
        spi.paid_at,
        spi.payment_reference,
        spi.notes,
        spi.payment_type,
        spi.created_at,
        spi.updated_at,
        u.name as student_name,
        u.email as student_email,
        c.title as course_title
      ${baseQuery}
      ORDER BY spi.due_date ASC, u.name ASC
      LIMIT ${limitNum} OFFSET ${offset}
    `;
    
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
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching payments',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Stripe webhook handler - validates signature via constructEvent.
 * Must be mounted with express.raw({ type: 'application/json' }) before express.json() in server.js.
 * Add STRIPE_WEBHOOK_SECRET to .env (Stripe Dashboard > Developers > Webhooks).
 *
 * CRITICAL: Always return 200 with { received: true } — never return 4xx/5xx to Stripe
 * or it will keep retrying forever.
 */
async function stripeWebhookHandler(req, res) {
  if (process.env.NODE_ENV === 'development') {
    console.log('🔔 Webhook received:', new Date().toISOString());
  }

  const sig = req.headers['stripe-signature'];
  if (!sig) {
    if (process.env.NODE_ENV === 'development') {
      console.log('❌ No stripe-signature header');
    }
    return res.status(400).json({ error: 'No signature' });
  }

  let config;
  try {
    config = await getStripeConfig();
  } catch (e) {
    return res.status(500).json({ error: 'Stripe configuration error' });
  }
  if (!config.webhookSecret) {
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  const signingSecretKey = config.secretKey || process.env.STRIPE_SECRET_KEY;
  if (!signingSecretKey) {
    return res.status(500).json({ error: 'Stripe secret key not configured' });
  }

  let event;
  try {
    const stripe = require('stripe')(signingSecretKey);
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      config.webhookSecret
    );
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Webhook verified! Event type:', event.type);
    }
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.log('❌ Webhook verification failed:', err.message);
    }
    return res.status(400).json({ error: err.message });
  }

  try {
    const paymentIntentId = event.data?.object?.id;
    const metadata = event.data?.object?.metadata || {};
    const type = metadata.type || (metadata.claimId ? 'certificate' : (metadata.installmentId ? 'installment' : null));
    const claimId = metadata.claimId ? parseInt(metadata.claimId, 10) : null;
    const installmentId = metadata.installmentId ? parseInt(metadata.installmentId, 10) : null;
    const studentId = metadata.studentId ? parseInt(metadata.studentId, 10) : null;
    const amount = event.data?.object?.amount ? event.data.object.amount / 100 : null;

    switch (event.type) {
      case 'payment_intent.succeeded': {
        if (type === 'certificate' && paymentIntentId) {
          try {
            const [r] = await pool.execute(
              `UPDATE certificate_claims
               SET payment_status = 'completed', paid_at = NOW(), delivery_status = 'processing'
               WHERE stripe_payment_intent_id = ? AND payment_status != 'completed'`,
              [paymentIntentId]
            );
            if (r.affectedRows > 0) {
              if (process.env.NODE_ENV === 'development') {
                console.log(`[Stripe Webhook] Certificate claim updated for payment ${paymentIntentId}`);
              }
            }
          } catch (e) {
          }
        }
        if (type === 'installment' && paymentIntentId) {
          try {
            const [r] = await pool.execute(
              `UPDATE student_payment_installments
               SET status = 'paid', paid_at = NOW(), payment_reference = ?,
                   payment_method = 'stripe_online'
               WHERE stripe_payment_intent_id = ? AND status != 'paid'`,
              [paymentIntentId, paymentIntentId]
            );
            if (r.affectedRows > 0) {
              const [rows] = await pool.execute(
                'SELECT student_id, course_id FROM student_payment_installments WHERE stripe_payment_intent_id = ?',
                [paymentIntentId]
              );
              if (rows.length > 0) {
                const { student_id: sid, course_id: cid } = rows[0];
                const [counts] = await pool.execute(
                  `SELECT COUNT(*) as total, SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_count
                   FROM student_payment_installments WHERE student_id = ? AND course_id = ?`,
                  [sid, cid]
                );
                const { total, paid_count } = counts[0] || {};
                if (total > 0 && total === paid_count) {
                  const [caCols] = await pool.execute(
                    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
                     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'course_assignments' AND COLUMN_NAME = 'payment_status'`
                  );
                  if (caCols.length > 0) {
                    await pool.execute(
                      'UPDATE course_assignments SET payment_status = ? WHERE student_id = ? AND course_id = ?',
                      ['fully_paid', sid, cid]
                    );
                  }
                }
              }
              await invalidateCache('cache:/api/student/installments*');
              await invalidateCache('cache:/api/admin/payments*');
              await invalidateCache('cache:/api/admin/students/*');
              await invalidateCache('cache:/api/tutor/payments*');
              if (process.env.NODE_ENV === 'development') {
                console.log(`[Stripe Webhook] Installment updated for payment ${paymentIntentId}`);
              }
            }
          } catch (e) {
          }
        }
        try {
          if (studentId && studentId > 0) {
            await pool.execute(
              `INSERT INTO payment_audit_log (student_id, reference_id, reference_type, event_type, stripe_payment_intent_id, amount, currency, status, source)
               VALUES (?, ?, ?, 'payment_intent.succeeded', ?, ?, 'gbp', 'succeeded', 'webhook')`,
              [studentId, claimId || installmentId || 0, (type === 'certificate' || type === 'installment') ? type : 'installment', paymentIntentId, amount]
            );
          }
        } catch (e) {
          console.warn('[Stripe Webhook] payment_audit_log insert failed (table may not exist):', e.message);
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const failureReason = event.data?.object?.last_payment_error?.message || null;
        if (type === 'certificate' && paymentIntentId) {
          try {
            await pool.execute(
              'UPDATE certificate_claims SET payment_status = ? WHERE stripe_payment_intent_id = ?',
              ['failed', paymentIntentId]
            );
          } catch (e) {
            console.error('[Stripe Webhook] Certificate failed update error:', e.message);
          }
        }
        if (type === 'installment' && paymentIntentId) {
          try {
            await pool.execute(
              `UPDATE student_payment_installments SET status = 'failed', payment_failed_reason = ?
               WHERE stripe_payment_intent_id = ?`,
              [failureReason, paymentIntentId]
            );
            await invalidateCache('cache:/api/student/installments*');
            await invalidateCache('cache:/api/admin/payments*');
          } catch (e) {
            console.error('[Stripe Webhook] Installment failed update error:', e.message);
          }
        }
        try {
          if (studentId && studentId > 0) {
            await pool.execute(
              `INSERT INTO payment_audit_log (student_id, reference_id, reference_type, event_type, stripe_payment_intent_id, amount, currency, status, failure_reason, source)
               VALUES (?, ?, ?, 'payment_intent.payment_failed', ?, ?, 'gbp', 'failed', ?, 'webhook')`,
              [studentId, claimId || installmentId || 0, (type === 'certificate' || type === 'installment') ? type : 'installment', paymentIntentId, amount, failureReason]
            );
          }
        } catch (e) {
          console.warn('[Stripe Webhook] payment_audit_log insert failed:', e.message);
        }
        break;
      }

      case 'payment_intent.canceled': {
        if (type === 'certificate' && paymentIntentId) {
          try {
            await pool.execute(
              'UPDATE certificate_claims SET payment_status = ? WHERE stripe_payment_intent_id = ?',
              ['failed', paymentIntentId]
            );
          } catch (e) {
            console.error('[Stripe Webhook] Certificate cancelled update error:', e.message);
          }
        }
        if (type === 'installment' && paymentIntentId) {
          try {
            await pool.execute(
              'UPDATE student_payment_installments SET status = ? WHERE stripe_payment_intent_id = ?',
              ['cancelled', paymentIntentId]
            );
            await invalidateCache('cache:/api/student/installments*');
            await invalidateCache('cache:/api/admin/payments*');
          } catch (e) {
            console.error('[Stripe Webhook] Installment cancelled update error:', e.message);
          }
        }
        try {
          if (studentId && studentId > 0) {
            await pool.execute(
              `INSERT INTO payment_audit_log (student_id, reference_id, reference_type, event_type, stripe_payment_intent_id, amount, currency, status, source)
               VALUES (?, ?, ?, 'payment_intent.canceled', ?, ?, 'gbp', 'cancelled', 'webhook')`,
              [studentId, claimId || installmentId || 0, (type === 'certificate' || type === 'installment') ? type : 'installment', paymentIntentId, amount]
            );
          }
        } catch (e) {
          console.warn('[Stripe Webhook] payment_audit_log insert failed:', e.message);
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[Stripe Webhook] Handler error:', err.message);
    }
  }

  return res.json({ received: true });
}

module.exports = router;
module.exports.stripeWebhookHandler = stripeWebhookHandler;

