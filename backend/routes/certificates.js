// GOING LIVE CHECKLIST — only change .env values:
// STRIPE_SECRET_KEY=sk_live_xxxx
// NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxxx
// STRIPE_WEBHOOK_SECRET=whsec_live_xxxx (from Stripe dashboard)
// Zero code changes needed.

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { permit } = require('../middleware/roles');
const multer = require('multer');
const cloudinary = require('../config/cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { getStripeClient } = require('../services/settingsService');

// Configure Cloudinary storage for photo ID uploads
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'certificate_photo_ids',
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
    resource_type: 'auto'
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Separate multer for DOCX uploads (edited certificate/transcript) - disk temp, then move in handler
const path = require('path');
const fs = require('fs-extra');
const docxUploadDir = path.join(__dirname, '..', 'uploads', 'certificates', 'temp');
fs.ensureDirSync(docxUploadDir);
const docxUploadStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, docxUploadDir);
  },
  filename: function (req, file, cb) {
    const uid = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    cb(null, `docx_${uid}.docx`);
  }
});
const uploadDocx = multer({
  storage: docxUploadStorage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (ext !== '.docx') {
      return cb(new Error('Only .docx files are allowed'));
    }
    cb(null, true);
  },
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB for DOCX
});

// =====================================================
// GET ENDPOINTS - Retrieve Data
// =====================================================

// Get all certificates from catalog
router.get('/catalog/certificates', async (req, res) => {
  try {
    const [certificates] = await pool.execute(
      'SELECT * FROM certificate_catalog WHERE is_active = TRUE ORDER BY certificate_name'
    );
    res.json({ success: true, certificates });
  } catch (error) {
    console.error('Error fetching certificates:', error);
    res.status(500).json({ success: false, message: 'Error fetching certificates' });
  }
});

// Get level courses by level
router.get('/catalog/level-courses/:level', async (req, res) => {
  try {
    const { level } = req.params;
    const [courses] = await pool.execute(
      'SELECT * FROM level_courses_catalog WHERE level = ? AND is_active = TRUE ORDER BY course_name',
      [level]
    );
    res.json({ success: true, courses });
  } catch (error) {
    console.error('Error fetching level courses:', error);
    res.status(500).json({ success: false, message: 'Error fetching level courses' });
  }
});

// Get pricing based on level and certificate type
router.get('/pricing/:level/:certificateType', async (req, res) => {
  try {
    const { level, certificateType } = req.params;
    
    // Normalize certificate type
    let normalizedType = certificateType;
    if (certificateType.includes('Hardcopy+PDF') || certificateType.includes('Hardcopy+pdf')) {
      normalizedType = 'Hardcopy+PDF';
    } else if (certificateType.includes('Hardcopy')) {
      normalizedType = 'Hardcopy';
    } else if (certificateType.includes('Softcopy') || certificateType.includes('PDF')) {
      normalizedType = 'Softcopy';
    }
    
    const [pricing] = await pool.execute(
      'SELECT * FROM certificate_pricing WHERE level_name = ? AND certificate_type = ? AND is_active = TRUE',
      [level, normalizedType]
    );
    
    if (pricing.length === 0) {
      return res.status(404).json({ success: false, message: 'Pricing not found' });
    }
    
    res.json({ success: true, pricing: pricing[0] });
  } catch (error) {
    console.error('Error fetching pricing:', error);
    res.status(500).json({ success: false, message: 'Error fetching pricing' });
  }
});

// Get all pricing (for admin management)
router.get('/pricing/all', auth, async (req, res) => {
  try {
    const [pricing] = await pool.execute(
      'SELECT * FROM certificate_pricing ORDER BY level_name, certificate_type'
    );
    res.json({ success: true, pricing });
  } catch (error) {
    console.error('Error fetching all pricing:', error);
    res.status(500).json({ success: false, message: 'Error fetching pricing' });
  }
});

// Get certificate claims (Admin/Tutor)
// Get student's own certificate claims (only completed payments)
router.get('/my-claims', auth, async (req, res) => {
  try {
    const studentId = req.user.id;
    
    const query = `
      SELECT 
        cc.*,
        c.title as course_title,
        c.course_type,
        p.name as processed_by_name
      FROM certificate_claims cc
      LEFT JOIN courses c ON cc.course_id = c.id
      LEFT JOIN users p ON cc.processed_by = p.id
      WHERE cc.student_id = ? AND cc.payment_status = 'completed'
      ORDER BY cc.claimed_at DESC
    `;
    
    const [claims] = await pool.execute(query, [studentId]);
    res.json({ success: true, claims });
  } catch (error) {
    console.error('Error fetching student certificate claims:', error);
    res.status(500).json({ success: false, message: 'Error fetching your claims' });
  }
});

router.get('/claims', auth, async (req, res) => {
  try {
    const { payment_status, delivery_status, course_type, search, student_id, page = 1, limit = 10 } = req.query;
    
    // Ensure limit and offset are always valid integers
    const finalLimit = Math.max(1, Math.min(1000, parseInt(limit, 10) || 10));
    const finalPage = Math.max(1, parseInt(page, 10) || 1);
    const finalOffset = Math.max(0, (finalPage - 1) * finalLimit);
    
    let query = `
      SELECT 
        cc.*,
        (SELECT gc2.status FROM generated_certificates gc2 WHERE gc2.claim_id = cc.id ORDER BY gc2.id DESC LIMIT 1) as gc_status,
        u.name as student_name,
        u.email as student_email,
        c.title as course_title,
        p.name as processed_by_name
      FROM certificate_claims cc
      LEFT JOIN users u ON cc.student_id = u.id
      LEFT JOIN courses c ON cc.course_id = c.id
      LEFT JOIN users p ON cc.processed_by = p.id
      WHERE 1=1
    `;
    
    let countQuery = `
      SELECT COUNT(*) as total
      FROM certificate_claims cc
      LEFT JOIN users u ON cc.student_id = u.id
      LEFT JOIN courses c ON cc.course_id = c.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (payment_status) {
      query += ' AND cc.payment_status = ?';
      countQuery += ' AND cc.payment_status = ?';
      params.push(payment_status);
    }
    
    if (delivery_status) {
      query += ' AND cc.delivery_status = ?';
      countQuery += ' AND cc.delivery_status = ?';
      params.push(delivery_status);
    }
    
    if (course_type) {
      query += ' AND cc.course_type = ?';
      countQuery += ' AND cc.course_type = ?';
      params.push(course_type);
    }
    
    if (student_id) {
      query += ' AND cc.student_id = ?';
      countQuery += ' AND cc.student_id = ?';
      params.push(student_id);
    }
    
    if (search) {
      query += ' AND (u.name LIKE ? OR u.email LIKE ? OR c.title LIKE ?)';
      countQuery += ' AND (u.name LIKE ? OR u.email LIKE ? OR c.title LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    
    query += ' ORDER BY cc.claimed_at DESC LIMIT ? OFFSET ?';
    
    // Get total count
    const [countResult] = await pool.execute(countQuery, params);
    const total = countResult[0]?.total || 0;
    
    // MySQL LIMIT/OFFSET can be problematic with prepared statements
    // Use template literals for LIMIT/OFFSET to avoid parameter binding issues
    const queryWithLimit = query.replace('LIMIT ? OFFSET ?', `LIMIT ${finalLimit} OFFSET ${finalOffset}`);
    
    // Get paginated claims
    const [claims] = await pool.execute(queryWithLimit, params);
    // Use real delivery status from generated_certificates when certificate was delivered there
    claims.forEach((c) => {
      if (c.gc_status === 'delivered') c.delivery_status = 'delivered';
      delete c.gc_status;
    });

    res.json({ 
      success: true, 
      claims,
      pagination: {
        page: finalPage,
        limit: finalLimit,
        total,
        totalPages: Math.ceil(total / finalLimit)
      }
    });
  } catch (error) {
    console.error('Error fetching certificate claims:', error);
    res.status(500).json({ success: false, message: 'Error fetching claims' });
  }
});

// Get single certificate claim details
router.get('/claims/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const [claims] = await pool.execute(
      `SELECT 
        cc.*,
        u.name as student_name,
        u.email as student_email,
        c.title as course_title,
        p.name as processed_by_name
      FROM certificate_claims cc
      LEFT JOIN users u ON cc.student_id = u.id
      LEFT JOIN courses c ON cc.course_id = c.id
      LEFT JOIN users p ON cc.processed_by = p.id
      WHERE cc.id = ?`,
      [id]
    );
    
    if (claims.length === 0) {
      return res.status(404).json({ success: false, message: 'Claim not found' });
    }
    
    res.json({ success: true, claim: claims[0] });
  } catch (error) {
    console.error('Error fetching claim details:', error);
    res.status(500).json({ success: false, message: 'Error fetching claim details' });
  }
});

// =====================================================
// POST ENDPOINTS - Create/Submit Data
// =====================================================

// Submit certificate claim (CPD with payment)
router.post('/claim/cpd', auth, upload.single('photoId'), async (req, res) => {
  try {
    const {
      studentId,
      courseId,
      fullName,
      phoneNumber,
      email,
      dateOfBirth,
      postalAddress,
      cpdCourseLevel,
      certificateName,
      selectedCourseName,
      certificateType,
      basePrice,
      courierType,
      courierPrice,
      totalPrice
    } = req.body;
    
    // Validate required fields
    if (!studentId || !courseId || !fullName || !email || !totalPrice) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields' 
      });
    }
    
    // Check if student is enrolled in the course
    const [enrollment] = await pool.execute(
      `SELECT * FROM course_assignments 
       WHERE student_id = ? AND course_id = ?`,
      [studentId, courseId]
    );
    
    if (enrollment.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'You are not enrolled in this course'
      });
    }
    
    // Check if student has completed the CPD course (all topics' final quizzes passed)
    const [topics] = await pool.execute(
      `SELECT id FROM cpd_topics WHERE course_id = ? ORDER BY order_index ASC, topic_number ASC`,
      [courseId]
    );
    
    if (topics.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'This course has no topics. Cannot claim certificate.'
      });
    }
    
    const [progress] = await pool.execute(
      `SELECT topic_id, final_quiz_passed FROM cpd_progress 
       WHERE student_id = ? AND course_id = ?`,
      [studentId, courseId]
    );
    
    const progressMap = {};
    progress.forEach((p) => {
      progressMap[p.topic_id] = p;
    });
    
    // Check if all topics have passed their final quizzes
    const allTopicsPassed = topics.every((topic) => {
      const topicProgress = progressMap[topic.id];
      return topicProgress && topicProgress.final_quiz_passed === 1;
    });
    
    if (!allTopicsPassed) {
      const incompleteTopics = topics.filter((topic) => {
        const topicProgress = progressMap[topic.id];
        return !topicProgress || topicProgress.final_quiz_passed !== 1;
      });
      
      return res.status(400).json({
        success: false,
        message: `You must complete all topics and pass their final quizzes before claiming your certificate. ${incompleteTopics.length} topic(s) still need to be completed.`
      });
    }
    
    // Check if student already has a completed claim for this course
    const [existingClaims] = await pool.execute(
      `SELECT id, claimed_at, delivery_status, 
              (SELECT registration_number FROM generated_certificates WHERE claim_id = certificate_claims.id LIMIT 1) as registration_number
       FROM certificate_claims 
       WHERE student_id = ? AND course_id = ? AND payment_status = 'completed'
       ORDER BY claimed_at DESC
       LIMIT 1`,
      [studentId, courseId]
    );
    
    if (existingClaims.length > 0) {
      const existingClaim = existingClaims[0];
      const claimDate = new Date(existingClaim.claimed_at).toLocaleDateString();
      const regNumber = existingClaim.registration_number || 'Pending';
      const deliveryStatus = existingClaim.delivery_status;
      
      return res.status(400).json({ 
        success: false, 
        message: `You have already claimed a certificate for this course. Claim #${existingClaim.id} was made on ${claimDate}. Registration: ${regNumber}. Status: ${deliveryStatus}. Please visit your Certificates page to view it.`,
        existingClaim: {
          id: existingClaim.id,
          claimedAt: existingClaim.claimed_at,
          registrationNumber: regNumber,
          deliveryStatus: deliveryStatus
        }
      });
    }
    
    // Get photo ID URL from Cloudinary
    const photoIdUrl = req.file ? req.file.path : null;
    
    if (!photoIdUrl) {
      return res.status(400).json({ 
        success: false, 
        message: 'Photo ID is required' 
      });
    }
    
    // Insert claim into database
    const [result] = await pool.execute(
      `INSERT INTO certificate_claims (
        student_id, course_id, course_type, full_name, phone_number, email,
        date_of_birth, postal_address, photo_id_url, cpd_course_level,
        certificate_name, selected_course_name, certificate_type,
        base_price, courier_type, courier_price, total_price,
        payment_required, payment_status
      ) VALUES (?, ?, 'cpd', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, 'pending')`,
      [
        studentId, courseId, fullName, phoneNumber, email,
        dateOfBirth, postalAddress, photoIdUrl, cpdCourseLevel,
        certificateName, selectedCourseName, certificateType,
        basePrice, courierType, courierPrice, totalPrice
      ]
    );
    
    const claimId = result.insertId;
    
    res.json({ 
      success: true, 
      message: 'Certificate claim submitted successfully',
      claimId: claimId,
      requiresPayment: true
    });
  } catch (error) {
    console.error('Error submitting CPD certificate claim:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error submitting certificate claim' 
    });
  }
});

// Submit certificate claim (Qualification - no payment)
router.post('/claim/qualification', auth, async (req, res) => {
  try {
    const { studentId, courseId, fullName, email } = req.body;

    if (!studentId || !courseId || !fullName || !email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields' 
      });
    }

    // Check if Rule Level 3 is enabled for this course
    const [courseSettings] = await pool.execute(
      `SELECT rule_level_3_enabled 
       FROM qual_course_content 
       WHERE course_id = ?`,
      [courseId]
    );
    
    console.log('[Certificate Claim] Course settings:', courseSettings);
    const ruleLevel3Enabled = courseSettings.length > 0 && (courseSettings[0].rule_level_3_enabled === 1 || courseSettings[0].rule_level_3_enabled === true);
    console.log('[Certificate Claim] Rule Level 3 enabled:', ruleLevel3Enabled, 'Raw value:', courseSettings.length > 0 ? courseSettings[0].rule_level_3_enabled : 'N/A');
    
    let requiredUnits = [];
    
    if (ruleLevel3Enabled) {
      // Rule Level 3 is enabled: Check non-Rule Level 3 units + selected Rule Level 3 units
      
      // Get all non-Rule Level 3 units (required units - not optional and not Rule Level 3)
      const [nonRule3Units] = await pool.execute(
        `SELECT u.id, u.title, qup.is_completed, qup.assignment_status
         FROM units u
         LEFT JOIN qual_unit_progress qup ON u.id = qup.unit_id AND qup.student_id = ?
         WHERE u.course_id = ? 
           AND u.is_optional = 0 
           AND (u.rule_level_3_enabled = 0 OR u.rule_level_3_enabled IS NULL)
         ORDER BY u.order_index`,
        [studentId, courseId]
      );
      
      // Get selected Rule Level 3 units for this student
      const [selectedRule3Units] = await pool.execute(
        `SELECT u.id, u.title, qup.is_completed, qup.assignment_status
         FROM units u
         INNER JOIN qual_student_selected_units qssu ON u.id = qssu.unit_id
         LEFT JOIN qual_unit_progress qup ON u.id = qup.unit_id AND qup.student_id = ?
         WHERE u.course_id = ? AND qssu.student_id = ? AND u.rule_level_3_enabled = 1
         ORDER BY u.order_index`,
        [studentId, courseId, studentId]
      );
      
      // Combine both sets
      requiredUnits = [...nonRule3Units, ...selectedRule3Units];
      
      console.log('[Certificate Claim] Non-Rule Level 3 units:', nonRule3Units.length, nonRule3Units.map(u => ({ id: u.id, title: u.title, completed: u.is_completed, status: u.assignment_status })));
      console.log('[Certificate Claim] Selected Rule Level 3 units:', selectedRule3Units.length, selectedRule3Units.map(u => ({ id: u.id, title: u.title, completed: u.is_completed, status: u.assignment_status })));
      
      // Check if student has selected Rule Level 3 units (if any Rule Level 3 units exist)
      const [rule3UnitsCount] = await pool.execute(
        `SELECT COUNT(*) as count FROM units WHERE course_id = ? AND rule_level_3_enabled = 1`,
        [courseId]
      );
      
      if (rule3UnitsCount[0].count > 0 && selectedRule3Units.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'You must select your Rule Level 3 units before claiming your certificate. Please complete the required units first to make your selection.'
        });
      }
    } else {
      // Rule Level 3 is NOT enabled: Check all required units (existing logic)
      const [allRequiredUnits] = await pool.execute(
        `SELECT u.id, u.title, qup.is_completed, qup.assignment_status
         FROM units u
         LEFT JOIN qual_unit_progress qup ON u.id = qup.unit_id AND qup.student_id = ?
         WHERE u.course_id = ? AND u.is_optional = 0
         ORDER BY u.order_index`,
        [studentId, courseId]
      );
      requiredUnits = allRequiredUnits;
    }
    
    if (requiredUnits.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No required units found for this course'
      });
    }
    
    // Check if all required units are completed with passed assignments
    const incompleteUnits = requiredUnits.filter(u => 
      !u.is_completed || u.assignment_status !== 'pass'
    );
    
    if (incompleteUnits.length > 0) {
      console.log('[Certificate Claim] Rule Level 3 enabled:', ruleLevel3Enabled);
      console.log('[Certificate Claim] Total required units:', requiredUnits.length);
      console.log('[Certificate Claim] Incomplete units:', incompleteUnits.map(u => ({ id: u.id, title: u.title, is_completed: u.is_completed, assignment_status: u.assignment_status })));
      
      return res.status(400).json({
        success: false,
        message: `You must complete all required units before claiming your certificate. ${incompleteUnits.length} unit(s) still need to be completed with passing grades.`,
        incompleteUnits: incompleteUnits.map(u => u.title)
      });
    }
    
    // Check if student already has a completed claim for this course
    const [existingClaims] = await pool.execute(
      `SELECT id, claimed_at, delivery_status, 
              (SELECT registration_number FROM generated_certificates WHERE claim_id = certificate_claims.id LIMIT 1) as registration_number
       FROM certificate_claims 
       WHERE student_id = ? AND course_id = ? AND payment_status = 'completed'
       ORDER BY claimed_at DESC
       LIMIT 1`,
      [studentId, courseId]
    );
    
    if (existingClaims.length > 0) {
      const existingClaim = existingClaims[0];
      const claimDate = new Date(existingClaim.claimed_at).toLocaleDateString();
      const regNumber = existingClaim.registration_number || 'Pending';
      const deliveryStatus = existingClaim.delivery_status;
      
      return res.status(400).json({ 
        success: false, 
        message: `You have already claimed a certificate for this course. Claim #${existingClaim.id} was made on ${claimDate}. Registration: ${regNumber}. Status: ${deliveryStatus}. Please visit your Certificates page to view it.`,
        existingClaim: {
          id: existingClaim.id,
          claimedAt: existingClaim.claimed_at,
          registrationNumber: regNumber,
          deliveryStatus: deliveryStatus
        }
      });
    }
    
    // date_of_birth is NOT NULL in certificate_claims - fetch from student_profiles or use sentinel
    let dateOfBirth = '1900-01-01'; // sentinel when not collected for qualification
    try {
      const [profileRows] = await pool.execute(
        `SELECT date_of_birth FROM student_profiles WHERE user_id = ? LIMIT 1`,
        [studentId]
      );
      if (profileRows.length > 0 && profileRows[0].date_of_birth) {
        const d = profileRows[0].date_of_birth;
        dateOfBirth = typeof d === 'string' ? d.split('T')[0] : (d instanceof Date ? d.toISOString().split('T')[0] : String(d).split('T')[0]);
      }
    } catch (e) {
      // keep sentinel
    }
    
    // Insert claim into database
    // For qualification we use name, email, and date_of_birth (from profile or sentinel); other fields empty/default
    const [result] = await pool.execute(
      `INSERT INTO certificate_claims (
        student_id, course_id, course_type, full_name, phone_number, email,
        date_of_birth, postal_address, photo_id_url, cpd_course_level,
        certificate_name, selected_course_name, certificate_type,
        base_price, courier_type, courier_price, total_price,
        payment_required, payment_status, delivery_status
      ) VALUES (?, ?, 'qualification', ?, '', ?, ?, '', '', NULL, '', '', '', 0, '', 0, 0, FALSE, 'completed', 'pending')`,
      [studentId, courseId, fullName, email, dateOfBirth]
    );
    
    res.json({ 
      success: true, 
      message: 'Certificate claim submitted successfully. Your certificate will be delivered in 5-7 business days.',
      claimId: result.insertId,
      requiresPayment: false
    });
  } catch (error) {
    console.error('Error submitting qualification certificate claim:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error submitting certificate claim' 
    });
  }
});

// Create Stripe payment intent
router.post('/payment/create-intent', auth, async (req, res) => {
  try {
    const { claimId, amount } = req.body;
    
    if (!claimId || !amount) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields' 
      });
    }
    
    // Fetch claim details
    const [claims] = await pool.execute(
      'SELECT * FROM certificate_claims WHERE id = ?',
      [claimId]
    );
    
    if (claims.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Claim not found' 
      });
    }
    
    const claim = claims[0];

    const stripe = await getStripeClient();
    // Create Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(parseFloat(amount) * 100), // Convert to cents
      currency: 'gbp',
      metadata: {
        claimId: claimId.toString(),
        studentId: claim.student_id.toString(),
        courseId: claim.course_id.toString(),
        certificateType: claim.certificate_type
      },
      description: `Certificate: ${claim.certificate_name || claim.certificate_type}`
    });
    
    // Update claim with payment intent ID
    await pool.execute(
      'UPDATE certificate_claims SET stripe_payment_intent_id = ? WHERE id = ?',
      [paymentIntent.id, claimId]
    );
    
    res.json({ 
      success: true, 
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error creating payment intent' 
    });
  }
});

// Confirm payment success
router.post('/payment/confirm', auth, async (req, res) => {
  try {
    const { claimId, paymentIntentId } = req.body;
    
    if (!claimId || !paymentIntentId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields' 
      });
    }

    const stripe = await getStripeClient();
    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status === 'succeeded') {
      // Update claim payment status
      await pool.execute(
        `UPDATE certificate_claims 
         SET payment_status = 'completed', 
             payment_amount = ?,
             paid_at = NOW(),
             delivery_status = 'processing'
         WHERE id = ?`,
        [paymentIntent.amount / 100, claimId]
      );
      
      // Send response immediately (don't wait for queue)
      res.json({ 
        success: true, 
        message: 'Payment confirmed successfully' 
      });
      
      // 🚀 ADD CERTIFICATE GENERATION TO QUEUE (NON-BLOCKING - AFTER RESPONSE)
      // This runs in background, doesn't block the response
      console.log(`💰 Payment confirmed for claim ${claimId} - Adding certificate generation to queue...`);
      setImmediate(async () => {
        try {
          // Try to load queue (with timeout protection)
          let certificateQueue;
          try {
            console.log(`📦 Loading certificate queue...`);
            certificateQueue = require('../queues/certificateQueue');
            console.log(`✅ Certificate queue loaded successfully`);
          } catch (requireError) {
            console.error('❌ Failed to load certificate queue:', requireError);
            console.log('⚠️ Queue not available - falling back to direct generation...');
            
            // Fallback: Generate directly (old method)
            try {
              const certificateGenerator = require('../services/certificateGenerator');
              const [claims] = await pool.execute(
                'SELECT course_type FROM certificate_claims WHERE id = ?',
                [claimId]
              );
              
              if (claims.length > 0 && claims[0].course_type === 'cpd') {
                const [existing] = await pool.execute(
                  'SELECT id FROM generated_certificates WHERE claim_id = ?',
                  [claimId]
                );
                
                if (existing.length === 0) {
                  console.log(`🎓 Direct certificate generation (fallback) for claim ID: ${claimId}`);
                  await certificateGenerator.generateCPDCertificates(parseInt(claimId));
                  console.log(`✅ Certificates generated directly for claim ID: ${claimId}`);
                }
              }
            } catch (genError) {
              console.error('❌ Direct generation also failed:', genError);
              // Certificate can be generated manually later
            }
            return;
          }
          
          // Check if this is a CPD claim
          const [claims] = await pool.execute(
            'SELECT course_type, student_id, course_id FROM certificate_claims WHERE id = ?',
            [claimId]
          );
          
          if (claims.length > 0 && claims[0].course_type === 'cpd') {
            // Check if not already generated
            const [existing] = await pool.execute(
              'SELECT id FROM generated_certificates WHERE claim_id = ?',
              [claimId]
            );
            
            if (existing.length === 0) {
              const claim = claims[0];
              
              // Add job to queue (non-blocking)
              console.log(`📤 Attempting to add job to queue for claim ${claimId}...`);
              certificateQueue.add('generate', {
                claimId: parseInt(claimId),
                studentId: claim.student_id,
                courseId: claim.course_id,
                customData: null,
                customRegNumber: null
              }, {
                priority: 1,
                jobId: `cert-${claimId}`,
                removeOnComplete: true
              }).then((job) => {
                console.log(`✅ Certificate generation job added to queue:`);
                console.log(`   Job ID: ${job.id}`);
                console.log(`   Claim ID: ${claimId}`);
                console.log(`   Job Data:`, JSON.stringify(job.data));
                
                // Update claim status (non-blocking)
                pool.execute(
                  `UPDATE certificate_claims 
                   SET delivery_status = 'processing',
                       admin_notes = CONCAT(COALESCE(admin_notes, ''), ' Certificate generation queued. Job ID: ', ?)
                   WHERE id = ?`,
                  [job.id.toString(), claimId]
                ).catch(err => console.error('Error updating claim status:', err));
              }).catch((err) => {
                console.error(`❌ Failed to add certificate to queue for claim ${claimId}:`, err);
                console.error(`   Error details:`, err.message);
                console.error(`   Stack:`, err.stack);
                console.error('❌ Failed to add certificate to queue:', err);
                console.log('⚠️ Queue add failed - falling back to direct generation...');
                
                // Fallback: Generate directly if queue fails
                try {
                  const certificateGenerator = require('../services/certificateGenerator');
                  console.log(`🎓 Direct certificate generation (queue failed) for claim ID: ${claimId}`);
                  certificateGenerator.generateCPDCertificates(parseInt(claimId))
                    .then(() => {
                      console.log(`✅ Certificates generated directly for claim ID: ${claimId}`);
                    })
                    .catch(genErr => {
                      console.error('❌ Direct generation also failed:', genErr);
                    });
                } catch (genError) {
                  console.error('❌ Direct generation failed:', genError);
                }
                
                // Still update status
                pool.execute(
                  `UPDATE certificate_claims 
                   SET delivery_status = 'processing',
                       admin_notes = CONCAT(COALESCE(admin_notes, ''), ' Queue error: ', ?)
                   WHERE id = ?`,
                  [err.message, claimId]
                ).catch(updateErr => console.error('Error updating claim:', updateErr));
              });
            } else {
              console.log(`⚠️ Certificates already generated for claim ID: ${claimId}`);
            }
          }
        } catch (queueError) {
          // Log error but don't fail - payment is already confirmed
          console.error('❌ Failed to add certificate to queue (payment still confirmed):', queueError);
        }
      });
      
    } else {
      res.status(400).json({ 
        success: false, 
        message: 'Payment not successful' 
      });
    }
  } catch (error) {
    console.error('Error confirming payment:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error confirming payment' 
    });
  }
});

// =====================================================
// PUT ENDPOINTS - Update Data (Admin/Tutor)
// =====================================================

// Update claim status
router.put('/claims/:id/status', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      delivery_status, 
      tracking_number, 
      estimated_delivery_date, 
      admin_notes,
      processedBy 
    } = req.body;
    
    const updates = [];
    const params = [];
    
    if (delivery_status) {
      updates.push('delivery_status = ?');
      params.push(delivery_status);
    }
    
    if (tracking_number) {
      updates.push('tracking_number = ?');
      params.push(tracking_number);
    }
    
    if (estimated_delivery_date) {
      updates.push('estimated_delivery_date = ?');
      params.push(estimated_delivery_date);
    }
    
    if (admin_notes !== undefined) {
      updates.push('admin_notes = ?');
      params.push(admin_notes);
    }
    
    if (processedBy) {
      updates.push('processed_by = ?, processed_at = NOW()');
      params.push(processedBy);
    }
    
    if (delivery_status === 'delivered') {
      updates.push('delivered_at = NOW()');
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No fields to update' 
      });
    }
    
    params.push(id);
    
    await pool.execute(
      `UPDATE certificate_claims SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    res.json({ 
      success: true, 
      message: 'Claim updated successfully' 
    });
  } catch (error) {
    console.error('Error updating claim:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating claim' 
    });
  }
});

// Create pricing row (Admin only)
router.post('/pricing', auth, permit('Admin'), async (req, res) => {
  try {
    const {
      level_name,
      certificate_type,
      base_price,
      normal_courier_price,
      special_courier_price
    } = req.body;

    if (!level_name || !certificate_type) {
      return res.status(400).json({
        success: false,
        message: 'level_name and certificate_type are required'
      });
    }

    const [existing] = await pool.execute(
      `SELECT id FROM certificate_pricing
       WHERE level_name = ?
       AND certificate_type = ?`,
      [level_name, certificate_type]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Pricing for this level and certificate type already exists'
      });
    }

    const [result] = await pool.execute(
      `INSERT INTO certificate_pricing
       (level_name, certificate_type, base_price,
        normal_courier_price, special_courier_price,
        is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [
        level_name,
        certificate_type,
        parseFloat(base_price) || 0,
        parseFloat(normal_courier_price) || 0,
        parseFloat(special_courier_price) || 0
      ]
    );

    res.json({ success: true, id: result.insertId });
  } catch (error) {
    console.error('Error creating pricing:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating pricing'
    });
  }
});

// Update pricing (Admin only)
router.put('/pricing/:id', auth, permit('Admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { base_price, normal_courier_price, special_courier_price, is_active } = req.body;

    const isActiveParam =
      is_active === undefined || is_active === null ? null : is_active ? 1 : 0;

    await pool.execute(
      `UPDATE certificate_pricing
       SET base_price = ?,
           normal_courier_price = ?,
           special_courier_price = ?,
           is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [base_price, normal_courier_price, special_courier_price, isActiveParam, id]
    );

    res.json({
      success: true,
      message: 'Pricing updated successfully'
    });
  } catch (error) {
    console.error('Error updating pricing:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating pricing'
    });
  }
});

// =====================================================
// CERTIFICATE GENERATION ENDPOINTS
// =====================================================

const certificateGenerator = require('../services/certificateGenerator');

/**
 * Get all generated certificates (Admin/Tutor view)
 * GET /api/certificates/generated
 */
router.get('/generated', auth, async (req, res) => {
  try {
    const { status, search } = req.query;
    
    let query = `
      SELECT 
        gc.*,
        u.name as student_name,
        u.email as student_email,
        u.learner_id as learner_id,
        c.title as course_title,
        cc.certificate_type,
        cc.cpd_course_level,
        reg_by.name as registration_added_by_name,
        del_by.name as delivered_by_name
      FROM generated_certificates gc
      LEFT JOIN users u ON gc.student_id = u.id
      LEFT JOIN courses c ON gc.course_id = c.id
      LEFT JOIN certificate_claims cc ON gc.claim_id = cc.id
      LEFT JOIN users reg_by ON gc.registration_added_by = reg_by.id
      LEFT JOIN users del_by ON gc.delivered_by = del_by.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (status) {
      query += ' AND gc.status = ?';
      params.push(status);
    }
    
    if (search) {
      query += ' AND (u.name LIKE ? OR u.email LIKE ? OR c.title LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    
    query += ' ORDER BY gc.generated_at DESC';
    
    const [certificates] = await pool.execute(query, params);
    res.json({ success: true, certificates });
  } catch (error) {
    console.error('Error fetching generated certificates:', error);
    res.status(500).json({ success: false, message: 'Error fetching certificates' });
  }
});

/**
 * Get specific generated certificate details
 * GET /api/certificates/generated/:id
 */
router.get('/generated/:id', auth, async (req, res) => {
  try {
    const [certificates] = await pool.execute(
      `SELECT 
        gc.*,
        u.name as student_name,
        u.email as student_email,
        c.title as course_title,
        cc.certificate_type,
        cc.cpd_course_level
      FROM generated_certificates gc
      LEFT JOIN users u ON gc.student_id = u.id
      LEFT JOIN courses c ON gc.course_id = c.id
      LEFT JOIN certificate_claims cc ON gc.claim_id = cc.id
      WHERE gc.id = ?`,
      [req.params.id]
    );
    
    if (certificates.length === 0) {
      return res.status(404).json({ success: false, message: 'Certificate not found' });
    }
    
    res.json({ success: true, certificate: certificates[0] });
  } catch (error) {
    console.error('Error fetching certificate:', error);
    res.status(500).json({ success: false, message: 'Error fetching certificate' });
  }
});

/**
 * Manually trigger certificate generation (Admin)
 * POST /api/certificates/generate/:claimId
 * Query param: ?immediate=true for immediate generation (bypasses queue)
 */
router.post('/generate/:claimId', auth, async (req, res) => {
  try {
    const { claimId } = req.params;
    const immediate = req.query.immediate === 'true';
    
    // Check if already generated
    const [existing] = await pool.execute(
      'SELECT id FROM generated_certificates WHERE claim_id = ?',
      [claimId]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Certificate already generated for this claim'
      });
    }
    
    // Get claim details
    const [claims] = await pool.execute(
      'SELECT student_id, course_id, course_type FROM certificate_claims WHERE id = ?',
      [claimId]
    );
    
    if (claims.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Claim not found'
      });
    }
    
    const claim = claims[0];
    
    if (immediate) {
      // Immediate generation (bypass queue) - for admin manual generation
      console.log(`⚡ Immediate certificate generation for claim ${claimId}`);
      const result = await certificateGenerator.generateCPDCertificates(parseInt(claimId));
      res.json(result);
    } else {
      // Add to queue (recommended for high volume)
      const certificateQueue = require('../queues/certificateQueue');
      
      const job = await certificateQueue.add('generate', {
        claimId: parseInt(claimId),
        studentId: claim.student_id,
        courseId: claim.course_id,
        customData: null,
        customRegNumber: null
      }, {
        priority: 2, // Higher priority for manual generation
        jobId: `cert-${claimId}`,
        removeOnComplete: true
      });
      
      console.log(`📋 Certificate generation job added to queue (manual):`);
      console.log(`   Job ID: ${job.id}`);
      console.log(`   Claim ID: ${claimId}`);
      
      res.json({
        success: true,
        message: 'Certificate generation job added to queue',
        jobId: job.id,
        queuePosition: await certificateQueue.getWaitingCount()
      });
    }
  } catch (error) {
    console.error('Error generating certificate:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating certificate: ' + error.message
    });
  }
});

/**
 * Add registration number and generate PDFs
 * POST /api/certificates/generated/:id/registration
 */
router.post('/generated/:id/registration', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { registration_number } = req.body;
    const adminId = req.user.id;
    
    if (!registration_number) {
      return res.status(400).json({
        success: false,
        message: 'Registration number is required'
      });
    }
    
    // Check if registration number already exists
    const [existing] = await pool.execute(
      'SELECT id FROM generated_certificates WHERE registration_number = ? AND id != ?',
      [registration_number, id]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Registration number already exists. Please use a unique number.'
      });
    }
    
    // Add registration number and generate PDFs
    const result = await certificateGenerator.addRegistrationNumberAndGeneratePDF(
      parseInt(id),
      registration_number,
      adminId
    );
    
    res.json(result);
  } catch (error) {
    console.error('Error adding registration number:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding registration number: ' + error.message
    });
  }
});

/**
 * Get registration number for a student (Reg # = number from learner_id)
 * GET /api/certificates/next-registration-number?studentId=123
 */
router.get('/next-registration-number', auth, async (req, res) => {
  try {
    const { studentId } = req.query;
    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: 'studentId is required. Reg # comes from the student\'s Learner ID.'
      });
    }
    const [rows] = await pool.execute(
      'SELECT learner_id FROM users WHERE id = ?',
      [studentId]
    );
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }
    const learnerId = rows[0].learner_id;
    const { formatLearnerIdForCertificate } = require('../utils/learnerId');
    const regNumber = formatLearnerIdForCertificate(learnerId);
    if (!regNumber) {
      return res.status(400).json({
        success: false,
        message: `Student has no valid Learner ID (ILC001 format). Assign one in User Management first. learner_id: ${learnerId || 'null'}`
      });
    }
    res.json({
      success: true,
      registration_number: regNumber
    });
  } catch (error) {
    console.error('Error getting registration number:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting registration number'
    });
  }
});

/**
 * Deliver certificate to student (Upload PDFs to Cloudinary)
 * POST /api/certificates/generated/:id/deliver
 */
router.post('/generated/:id/deliver', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;
    
    // Get certificate details
    const [certificates] = await pool.execute(
      'SELECT * FROM generated_certificates WHERE id = ?',
      [id]
    );
    
    if (certificates.length === 0) {
      return res.status(404).json({ success: false, message: 'Certificate not found' });
    }
    
    const certificate = certificates[0];
    
    if (certificate.status !== 'ready') {
      return res.status(400).json({
        success: false,
        message: 'Certificate must have registration number before delivery'
      });
    }
    
    // Upload PDFs to Cloudinary
    const fs = require('fs');
    const path = require('path');
    const cloudinary = require('../config/cloudinary');
    const { convertDocxToPdf } = require('../services/certificateGenerator');
    
    let certPdfPath, transPdfPath;
    let certPdfBuffer, transPdfBuffer;
    
    // Check if PDFs already exist
    if (certificate.certificate_pdf_url && !certificate.certificate_pdf_url.startsWith('http')) {
      // Local PDF path
      certPdfPath = path.join(__dirname, '..', certificate.certificate_pdf_url);
      if (fs.existsSync(certPdfPath)) {
        certPdfBuffer = fs.readFileSync(certPdfPath);
      }
    }
    
    if (certificate.transcript_pdf_url && !certificate.transcript_pdf_url.startsWith('http')) {
      // Local PDF path
      transPdfPath = path.join(__dirname, '..', certificate.transcript_pdf_url);
      if (fs.existsSync(transPdfPath)) {
        transPdfBuffer = fs.readFileSync(transPdfPath);
      }
    }
    
    // If PDFs don't exist, try to convert from DOCX (with fallback to DOCX delivery)
    if (!certPdfBuffer) {
      console.log('   📄 Certificate PDF not found, attempting conversion from DOCX...');
      const certDocxPath = path.join(__dirname, '..', certificate.certificate_docx_path);
      if (!fs.existsSync(certDocxPath)) {
        return res.status(404).json({
          success: false,
          message: 'Certificate DOCX file not found'
        });
      }
      
      try {
        const certDocxBuffer = fs.readFileSync(certDocxPath);
        certPdfBuffer = await convertDocxToPdf(certDocxBuffer);
        
        // Save PDF locally for future use
        certPdfPath = path.join(path.dirname(certDocxPath), `cert_${certificate.registration_number}.pdf`.replace(/[^a-zA-Z0-9._-]/g, '_'));
        fs.writeFileSync(certPdfPath, certPdfBuffer);
        console.log('   ✅ Certificate PDF generated and saved');
      } catch (pdfError) {
        console.error('   ⚠️  PDF conversion failed, uploading DOCX instead:', pdfError.message);
        // Fallback: Upload DOCX file to Cloudinary
        certPdfPath = certDocxPath;
        certPdfBuffer = fs.readFileSync(certDocxPath);
      }
    }
    
    if (!transPdfBuffer) {
      console.log('   📄 Transcript PDF not found, attempting conversion from DOCX...');
      const transDocxPath = path.join(__dirname, '..', certificate.transcript_docx_path);
      if (!fs.existsSync(transDocxPath)) {
        return res.status(404).json({
          success: false,
          message: 'Transcript DOCX file not found'
        });
      }
      
      try {
        const transDocxBuffer = fs.readFileSync(transDocxPath);
        transPdfBuffer = await convertDocxToPdf(transDocxBuffer);
        
        // Save PDF locally for future use
        transPdfPath = path.join(path.dirname(transDocxPath), `trans_${certificate.registration_number}.pdf`.replace(/[^a-zA-Z0-9._-]/g, '_'));
        fs.writeFileSync(transPdfPath, transPdfBuffer);
        console.log('   ✅ Transcript PDF generated and saved');
      } catch (pdfError) {
        console.error('   ⚠️  PDF conversion failed, uploading DOCX instead:', pdfError.message);
        // Fallback: Upload DOCX file to Cloudinary
        transPdfPath = transDocxPath;
        transPdfBuffer = fs.readFileSync(transDocxPath);
      }
    }
    
    // BYPASS CLOUDINARY - Serve PDFs directly from backend
    // Create public URLs that point to frontend (Next.js API routes proxy to backend)
    // Use environment variable for frontend URL, or construct from request
    let frontendBaseUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_FRONTEND_URL;
    
    // If not set, try to construct from request (for production with domain)
    if (!frontendBaseUrl && req) {
      const protocol = req.protocol || (req.secure ? 'https' : 'http');
      const host = req.get('host') || '';
      
      // If behind reverse proxy (Nginx), use same host (domain)
      // Otherwise, replace backend port (5000) with frontend port (3000)
      if (host.includes(':5000')) {
        frontendBaseUrl = `${protocol}://${host.replace(':5000', ':3000')}`;
      } else if (host && !host.includes('localhost')) {
        // Production domain (e.g., lms.inspirelondoncollege.com)
        frontendBaseUrl = `${protocol}://${host}`;
      } else {
        // Fallback to relative URL (will use current domain)
        frontendBaseUrl = '';
      }
    }
    
    // Fallback to relative URL if still not set (will use current domain)
    if (!frontendBaseUrl) {
      frontendBaseUrl = '';
    }
    
    const certPublicUrl = `${frontendBaseUrl}/api/certificates/public-download/cert/${certificate.registration_number}`;
    const transPublicUrl = `${frontendBaseUrl}/api/certificates/public-download/trans/${certificate.registration_number}`;
    
    // Save PDF paths locally (relative to backend)
    const relativeCertPath = path.relative(path.join(__dirname, '..'), certPdfPath);
    const relativeTransPath = path.relative(path.join(__dirname, '..'), transPdfPath);
    
    console.log('   💾 Saving PDFs locally instead of Cloudinary');
    console.log('   Certificate URL:', certPublicUrl);
    console.log('   Transcript URL:', transPublicUrl);
    
    // Update database with local file paths and public URLs
    await pool.execute(
      `UPDATE generated_certificates 
       SET certificate_pdf_url = ?,
           transcript_pdf_url = ?,
           certificate_pdf_path = ?,
           transcript_pdf_path = ?,
           delivered_at = NOW(),
           delivered_by = ?,
           status = 'delivered'
       WHERE id = ?`,
      [certPublicUrl, transPublicUrl, relativeCertPath, relativeTransPath, adminId, id]
    );
    // Keep certificate_claims.delivery_status in sync so claims list shows "delivered" everywhere
    if (certificate.claim_id) {
      await pool.execute(
        'UPDATE certificate_claims SET delivery_status = ? WHERE id = ?',
        ['delivered', certificate.claim_id]
      );
    }
    console.log(`✅ Certificate delivered to student (Cert ID: ${id})`);
    
    res.json({
      success: true,
      message: 'Certificate delivered to student successfully',
      urls: {
        certificate: certPublicUrl,
        transcript: transPublicUrl
      }
    });
  } catch (error) {
    console.error('Error delivering certificate:', error);
    res.status(500).json({
      success: false,
      message: 'Error delivering certificate: ' + error.message
    });
  }
});

/**
 * Get student's delivered certificates
 * GET /api/certificates/my-delivered
 */
router.get('/my-delivered', auth, async (req, res) => {
  try {
    const studentId = req.user.id;
    
    const [certificates] = await pool.execute(
      `SELECT 
        gc.*,
        gc.claim_id,
        c.title as course_title,
        cc.certificate_type,
        cc.cpd_course_level
      FROM generated_certificates gc
      JOIN courses c ON gc.course_id = c.id
      LEFT JOIN certificate_claims cc ON gc.claim_id = cc.id
      WHERE gc.student_id = ? AND gc.status = 'delivered'
      ORDER BY gc.delivered_at DESC`,
      [studentId]
    );
    
    res.json({ success: true, certificates });
  } catch (error) {
    console.error('Error fetching delivered certificates:', error);
    res.status(500).json({ success: false, message: 'Error fetching certificates' });
  }
});

/**
 * Download certificate PDF (student or admin)
 * GET /api/certificates/download/:id/:type (type: certificate or transcript)
 */
router.get('/download/:id/:type', auth, async (req, res) => {
  try {
    const { id, type } = req.params;
    const userId = req.user.id;
    
    // Get certificate
    const [certificates] = await pool.execute(
      'SELECT * FROM generated_certificates WHERE id = ?',
      [id]
    );
    
    if (certificates.length === 0) {
      return res.status(404).json({ success: false, message: 'Certificate not found' });
    }
    
    const certificate = certificates[0];
    
    // Check if user has permission (student owns it, or admin)
    const [userRole] = await pool.execute('SELECT role FROM users WHERE id = ?', [userId]);
    const isAdmin = userRole[0]?.role === 'admin' || userRole[0]?.role === 'assessor';
    
    if (!isAdmin && certificate.student_id !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    // Get PDF URL
    let pdfUrl;
    if (type === 'certificate') {
      pdfUrl = certificate.certificate_pdf_url;
    } else if (type === 'transcript') {
      pdfUrl = certificate.transcript_pdf_url;
    } else {
      return res.status(400).json({ success: false, message: 'Invalid type. Use certificate or transcript' });
    }
    
    if (!pdfUrl) {
      return res.status(404).json({ success: false, message: 'PDF not available' });
    }
    
    // Log download
    await pool.execute(
      `INSERT INTO certificate_generation_log (generated_cert_id, action, performed_by, details)
       VALUES (?, 'downloaded', ?, ?)`,
      [id, userId, JSON.stringify({ type, timestamp: new Date() })]
    );
    
    // Redirect to Cloudinary URL (or serve file if local)
    if (pdfUrl.startsWith('http')) {
      res.redirect(pdfUrl);
    } else {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(__dirname, '..', pdfUrl);
      
      if (fs.existsSync(filePath)) {
        res.download(filePath);
      } else {
        res.status(404).json({ success: false, message: 'File not found' });
      }
    }
  } catch (error) {
    console.error('Error downloading certificate:', error);
    res.status(500).json({ success: false, message: 'Error downloading certificate' });
  }
});

// =====================================================
// DELETE ENDPOINTS
// =====================================================

// Delete claim (Admin only)
router.delete('/claims/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.execute('DELETE FROM certificate_claims WHERE id = ?', [id]);
    
    res.json({ 
      success: true, 
      message: 'Claim deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting claim:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error deleting claim' 
    });
  }
});

/**
 * Get generated certificate by claim ID
 * GET /api/certificates/generated/by-claim/:claimId
 */
router.get('/generated/by-claim/:claimId', auth, async (req, res) => {
  try {
    const { claimId } = req.params;
    
    const [certs] = await pool.execute(
      `SELECT * FROM generated_certificates WHERE claim_id = ? LIMIT 1`,
      [claimId]
    );
    
    if (certs.length === 0) {
      return res.json({ success: false, certificate: null });
    }
    
    res.json({ success: true, certificate: certs[0] });
  } catch (error) {
    console.error('Error fetching generated certificate:', error);
    res.status(500).json({ success: false, message: 'Error fetching certificate' });
  }
});

/**
 * Deliver multiple certificates at once
 * POST /api/certificates/deliver-all
 */
router.post('/deliver-all', auth, async (req, res) => {
  try {
    const { certificateIds } = req.body;
    const adminId = req.user.id;
    
    if (!certificateIds || !Array.isArray(certificateIds) || certificateIds.length === 0) {
      return res.status(400).json({ success: false, message: 'No certificate IDs provided' });
    }
    
    const results = [];
    const errors = [];
    const cloudinary = require('../config/cloudinary');
    const fs = require('fs');
    const path = require('path');
    
    for (const certId of certificateIds) {
      try {
        // Get certificate details
        const [certs] = await pool.execute(
          'SELECT * FROM generated_certificates WHERE id = ? AND status = \'ready\'',
          [certId]
        );
        
        if (certs.length === 0) {
          errors.push({ certId, error: 'Certificate not found or not ready' });
          continue;
        }
        
        const cert = certs[0];
        
        // Check if PDFs exist locally
        const certPdfPath = path.join(__dirname, '..', cert.certificate_pdf_url);
        const transPdfPath = path.join(__dirname, '..', cert.transcript_pdf_url);
        
        if (!fs.existsSync(certPdfPath) || !fs.existsSync(transPdfPath)) {
          errors.push({ certId, error: 'PDF files not found' });
          continue;
        }
        
        // BYPASS CLOUDINARY - Use direct file serving (through frontend proxy)
        const certPublicUrl = `http://localhost:3000/api/certificates/public-download/cert/${cert.registration_number}`;
        const transPublicUrl = `http://localhost:3000/api/certificates/public-download/trans/${cert.registration_number}`;
        
        // Save relative paths
        const relativeCertPath = path.relative(path.join(__dirname, '..'), certPdfPath);
        const relativeTransPath = path.relative(path.join(__dirname, '..'), transPdfPath);
        
        // Update database with local file paths
        await pool.execute(
          `UPDATE generated_certificates 
           SET certificate_pdf_url = ?, transcript_pdf_url = ?, 
               certificate_pdf_path = ?, transcript_pdf_path = ?,
               status = 'delivered', delivered_at = NOW(), delivered_by = ?
           WHERE id = ?`,
          [certPublicUrl, transPublicUrl, relativeCertPath, relativeTransPath, adminId, certId]
        );
        if (cert.claim_id) {
          await pool.execute('UPDATE certificate_claims SET delivery_status = ? WHERE id = ?', ['delivered', cert.claim_id]);
        }
        // Log delivery
        await pool.execute(
          `INSERT INTO certificate_generation_log (generated_cert_id, action, details)
           VALUES (?, 'delivered', ?)`,
          [certId, JSON.stringify({ deliveredBy: adminId, timestamp: new Date() })]
        );
        
        results.push({ certId, success: true });
        
      } catch (error) {
        console.error(`Error delivering certificate ${certId}:`, error);
        errors.push({ certId, error: error.message });
      }
    }
    
    res.json({
      success: true,
      delivered: results.length,
      failed: errors.length,
      results,
      errors
    });
    
  } catch (error) {
    console.error('Error in deliver-all:', error);
    res.status(500).json({ success: false, message: 'Error delivering certificates' });
  }
});

/**
 * Serve generated certificate/transcript files (DOCX or PDF)
 * GET /api/certificates/generated/:id/file/:type?token=xxx
 * Supports token in Authorization header or query parameter
 */
router.get('/generated/:id/file/:type', async (req, res) => {
  try {
    const { id, type } = req.params;
    const fs = require('fs');
    const path = require('path');
    const jwt = require('jsonwebtoken');
    
    // Check authentication - accept token from header or query parameter
    const authHeader = req.headers['authorization'];
    const tokenFromQuery = req.query.token;
    const token = authHeader ? authHeader.split(' ')[1] : tokenFromQuery;
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: 'No authorization token provided. Please log in again.' 
      });
    }
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded; // Set user for potential future use
    } catch (err) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid or expired token. Please log in again.' 
      });
    }
    
    // Get certificate details
    const [certs] = await pool.execute(
      'SELECT * FROM generated_certificates WHERE id = ?',
      [id]
    );
    
    if (certs.length === 0) {
      return res.status(404).json({ success: false, message: 'Certificate not found' });
    }
    
    const cert = certs[0];
    
    // Determine file path based on type
    let filePath = null;
    let fileName = '';
    
    if (type === 'certificate') {
      // Try PDF first, fallback to DOCX
      if (cert.certificate_pdf_url && !cert.certificate_pdf_url.startsWith('http')) {
        filePath = path.join(__dirname, '..', cert.certificate_pdf_url);
        fileName = `certificate_${cert.registration_number || cert.id}.pdf`;
      } else if (cert.certificate_docx_path) {
        filePath = path.join(__dirname, '..', cert.certificate_docx_path);
        fileName = `certificate_${cert.registration_number || cert.id}.docx`;
      }
    } else if (type === 'transcript') {
      // Try PDF first, fallback to DOCX
      if (cert.transcript_pdf_url && !cert.transcript_pdf_url.startsWith('http')) {
        filePath = path.join(__dirname, '..', cert.transcript_pdf_url);
        fileName = `transcript_${cert.registration_number || cert.id}.pdf`;
      } else if (cert.transcript_docx_path) {
        filePath = path.join(__dirname, '..', cert.transcript_docx_path);
        fileName = `transcript_${cert.registration_number || cert.id}.docx`;
      }
    }
    
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }
    
    // Determine content type
    const ext = path.extname(filePath).toLowerCase();
    const contentType = ext === '.pdf' ? 'application/pdf' : 
                       ext === '.docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
                       'application/octet-stream';
    
    // Check if user wants to view inline or download
    const viewInline = req.query.view === 'true';
    const disposition = viewInline ? 'inline' : 'attachment';
    
    console.log(`📄 Serving file: ${fileName}`);
    console.log(`   View inline: ${viewInline}`);
    console.log(`   Disposition: ${disposition}`);
    
    res.setHeader('Content-Type', contentType);
    
    // For inline viewing of PDFs, don't set Content-Disposition to let browser handle it
    if (viewInline && ext === '.pdf') {
      console.log('   ✅ Omitting Content-Disposition for inline PDF viewing');
      // Don't set Content-Disposition - browser will display inline by default
    } else {
      res.setHeader('Content-Disposition', `${disposition}; filename="${fileName}"`);
    }
    
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.resolve(filePath));
    
  } catch (error) {
    console.error('Error serving file:', error);
    res.status(500).json({ success: false, message: 'Error serving file' });
  }
});

/**
 * Test token authentication endpoint
 * GET /api/certificates/test-auth?token=xxx
 */
router.get('/test-auth', async (req, res) => {
  try {
    const jwt = require('jsonwebtoken');
    
    // Check authentication - accept token from header or query parameter
    const authHeader = req.headers['authorization'];
    const tokenFromQuery = req.query.token;
    const token = authHeader ? authHeader.split(' ')[1] : tokenFromQuery;

    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: 'No authorization token provided. Please log in again.',
        debug: {
          authHeader: authHeader ? 'present' : 'missing',
          queryToken: tokenFromQuery ? 'present' : 'missing'
        }
      });
    }
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      return res.json({ 
        success: true,
        message: 'Token is valid',
        user: {
          id: decoded.id,
          name: decoded.name,
          role: decoded.role
        }
      });
    } catch (err) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid or expired token. Please log in again.',
        error: err.message
      });
    }
    
  } catch (error) {
    console.error('Test Auth - Error:', error);
    res.status(500).json({ success: false, message: 'Server error during authentication test' });
  }
});

/**
 * Test endpoint to verify new code is loaded
 */
router.get('/test-public-download', (req, res) => {
  res.json({ 
    success: true, 
    message: 'New public download code is loaded!',
    timestamp: new Date().toISOString()
  });
});

/**
 * Direct PDF download endpoints (bypass Cloudinary) - PUBLIC ACCESS
 * GET /api/certificates/public-download/cert/:regNumber
 * GET /api/certificates/public-download/trans/:regNumber
 * Public access for delivered certificates only
 */
router.get('/public-download/:type/:regNumber', async (req, res) => {
  try {
    const { type, regNumber } = req.params;
    const fs = require('fs');
    const path = require('path');
    
    // Validate type
    if (!['cert', 'trans'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid certificate type' });
    }
    
    console.log(`📥 Download request: ${type} for registration ${regNumber}`);
    
    // Get certificate details from database - ONLY DELIVERED CERTIFICATES
    const [certs] = await pool.execute(
      `SELECT id, student_id, certificate_pdf_path, transcript_pdf_path, 
              certificate_docx_path, transcript_docx_path
       FROM generated_certificates 
       WHERE registration_number = ? AND status = 'delivered'`,
      [regNumber]
    );
    
    if (certs.length === 0) {
      console.log(`❌ Certificate not found or not delivered: ${regNumber}`);
      return res.status(404).json({ 
        success: false, 
        message: 'Certificate not found or not yet delivered' 
      });
    }
    
    console.log(`✅ Public download authorized for delivered certificate: ${regNumber}`);
    
    const cert = certs[0];
    
    // Determine file path
    let filePath = null;
    let fileName = '';
    
    if (type === 'cert') {
      // Try PDF first, fallback to DOCX
      if (cert.certificate_pdf_path) {
        filePath = path.resolve(__dirname, '..', cert.certificate_pdf_path);
        fileName = `Certificate_${regNumber}.pdf`;
      } else if (cert.certificate_docx_path) {
        filePath = path.resolve(__dirname, '..', cert.certificate_docx_path);
        fileName = `Certificate_${regNumber}.docx`;
      }
    } else if (type === 'trans') {
      // Try PDF first, fallback to DOCX
      if (cert.transcript_pdf_path) {
        filePath = path.resolve(__dirname, '..', cert.transcript_pdf_path);
        fileName = `Transcript_${regNumber}.pdf`;
      } else if (cert.transcript_docx_path) {
        filePath = path.resolve(__dirname, '..', cert.transcript_docx_path);
        fileName = `Transcript_${regNumber}.docx`;
      }
    }
    
    if (!filePath || !fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      return res.status(404).json({ 
        success: false, 
        message: 'Certificate file not found on server' 
      });
    }
    
    console.log(`✅ Serving file: ${filePath}`);
    
    // Set appropriate headers
    const ext = path.extname(filePath).toLowerCase();
    const contentType = ext === '.pdf' ? 'application/pdf' : 
                       ext === '.docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
                       'application/octet-stream';
    
    // Check if user wants to view inline or download
    const viewInline = req.query.view === 'true';
    const disposition = viewInline ? 'inline' : 'attachment';
    
    console.log(`📄 Public download: ${fileName}`);
    console.log(`   View inline: ${viewInline}`);
    console.log(`   Disposition: ${disposition}`);
    
    res.setHeader('Content-Type', contentType);
    
    // For inline viewing of PDFs, don't set Content-Disposition to let browser handle it
    if (viewInline && ext === '.pdf') {
      console.log('   ✅ Omitting Content-Disposition for inline PDF viewing');
      // Don't set Content-Disposition - browser will display inline by default
    } else {
      res.setHeader('Content-Disposition', `${disposition}; filename="${fileName}"`);
    }
    
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Stream the file
    res.sendFile(filePath);
    
  } catch (error) {
    console.error('Error serving certificate download:', error);
    res.status(500).json({ success: false, message: 'Error downloading certificate' });
  }
});

/**
 * Admin: View/Download certificate DOCX for editing (before delivery)
 * GET /api/certificates/generated/:id/docx/:type
 * Requires authentication
 */
router.get('/generated/:id/docx/:type', auth, async (req, res) => {
  try {
    const { id, type } = req.params;
    const fs = require('fs');
    const path = require('path');
    
    // Validate type
    if (!['cert', 'trans'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid certificate type' });
    }
    
    console.log(`📄 Admin requesting DOCX: ${type} for certificate ID ${id}`);
    
    // Get certificate details (gc has docx paths and registration_number)
    const [certs] = await pool.execute(
      `SELECT gc.* FROM generated_certificates gc WHERE gc.id = ?`,
      [id]
    );
    
    if (certs.length === 0) {
      return res.status(404).json({ success: false, message: 'Certificate not found' });
    }
    
    const cert = certs[0];
    
    // Determine file path
    let filePath = null;
    let fileName = '';
    
    if (type === 'cert') {
      if (cert.certificate_docx_path) {
        filePath = path.resolve(__dirname, '..', cert.certificate_docx_path);
        fileName = `Certificate_${cert.registration_number}.docx`;
      }
    } else if (type === 'trans') {
      if (cert.transcript_docx_path) {
        filePath = path.resolve(__dirname, '..', cert.transcript_docx_path);
        fileName = `Transcript_${cert.registration_number}.docx`;
      }
    }
    
    if (!filePath || !fs.existsSync(filePath)) {
      console.error(`❌ DOCX file not found: ${filePath}`);
      return res.status(404).json({ 
        success: false, 
        message: 'DOCX file not found. It may have been deleted or not generated yet.' 
      });
    }
    
    console.log(`✅ Serving DOCX file: ${filePath}`);
    
    // Set headers for download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'no-cache');
    
    // Stream the file
    res.sendFile(filePath);
    
  } catch (error) {
    console.error('Error serving DOCX file:', error);
    res.status(500).json({ success: false, message: 'Error downloading DOCX file' });
  }
});

/**
 * Admin: Upload edited DOCX file
 * POST /api/certificates/generated/:id/upload-docx/:type
 * Requires authentication
 */
router.post('/generated/:id/upload-docx/:type', auth, uploadDocx.single('file'), async (req, res) => {
  try {
    const { id, type } = req.params;
    
    // Validate type
    if (!['cert', 'trans'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid certificate type' });
    }
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    console.log(`📤 Admin uploading edited DOCX: ${type} for certificate ID ${id}`);
    
    // Get certificate details
    const [certs] = await pool.execute(
      'SELECT * FROM generated_certificates WHERE id = ?',
      [id]
    );
    
    if (certs.length === 0) {
      return res.status(404).json({ success: false, message: 'Certificate not found' });
    }
    
    const cert = certs[0];
    
    // Determine target path
    const uploadsDir = path.join(__dirname, '..', 'uploads', 'certificates', 'generated', cert.student_id.toString());
    await fs.ensureDir(uploadsDir);
    
    const fileName = type === 'cert' 
      ? `cert_${cert.registration_number}.docx`
      : `transcript_${cert.registration_number}.docx`;
    
    const targetPath = path.join(uploadsDir, fileName);
    
    // Move uploaded file to target location (overwrite existing)
    await fs.move(req.file.path, targetPath, { overwrite: true });
    
    console.log(`✅ Edited DOCX saved: ${targetPath}`);
    
    // Update database - mark as edited and clear PDF paths (will be regenerated on delivery)
    const relativePath = path.relative(path.join(__dirname, '..'), targetPath);
    
    if (type === 'cert') {
      await pool.execute(
        `UPDATE generated_certificates 
         SET certificate_docx_path = ?, 
             certificate_pdf_path = NULL, 
             certificate_pdf_url = NULL
         WHERE id = ?`,
        [relativePath, id]
      );
    } else {
      await pool.execute(
        `UPDATE generated_certificates 
         SET transcript_docx_path = ?, 
             transcript_pdf_path = NULL, 
             transcript_pdf_url = NULL
         WHERE id = ?`,
        [relativePath, id]
      );
    }
    
    console.log(`✅ Database updated - PDF will be regenerated on delivery`);
    
    res.json({ 
      success: true, 
      message: 'Edited certificate uploaded successfully. PDF will be regenerated when you deliver it.',
      docxPath: relativePath
    });
    
  } catch (error) {
    console.error('Error uploading edited DOCX:', error);
    res.status(500).json({ success: false, message: 'Error uploading edited certificate' });
  }
});

/**
 * Admin: Re-convert DOCX to PDF (manual trigger)
 * POST /api/certificates/generated/:id/reconvert/:type
 * Requires authentication
 */
router.post('/generated/:id/reconvert/:type', auth, async (req, res) => {
  try {
    const { id, type } = req.params;
    const fs = require('fs-extra');
    const path = require('path');
    const { convertDocxToPdfDirect } = require('../utils/pdfConverter');
    
    // Validate type
    if (!['cert', 'trans'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid certificate type' });
    }
    
    console.log(`🔄 Admin requesting reconversion: ${type} for certificate ID ${id}`);
    
    // Get certificate details
    const [certs] = await pool.execute(
      'SELECT * FROM generated_certificates WHERE id = ?',
      [id]
    );
    
    if (certs.length === 0) {
      return res.status(404).json({ success: false, message: 'Certificate not found' });
    }
    
    const cert = certs[0];
    
    // Get DOCX path
    const docxPath = type === 'cert' ? cert.certificate_docx_path : cert.transcript_docx_path;
    
    if (!docxPath) {
      return res.status(404).json({ success: false, message: 'DOCX file not found' });
    }
    
    const fullDocxPath = path.resolve(__dirname, '..', docxPath);
    
    if (!fs.existsSync(fullDocxPath)) {
      return res.status(404).json({ success: false, message: 'DOCX file not found on server' });
    }
    
    // Read DOCX file
    const docxBuffer = fs.readFileSync(fullDocxPath);
    
    // Convert to PDF
    const outputDir = path.dirname(fullDocxPath);
    const pdfBuffer = await convertDocxToPdfDirect(docxBuffer, outputDir);
    
    // Save PDF
    const pdfFileName = type === 'cert' 
      ? `cert_${cert.registration_number}.pdf`
      : `transcript_${cert.registration_number}.pdf`;
    
    const pdfPath = path.join(outputDir, pdfFileName);
    fs.writeFileSync(pdfPath, pdfBuffer);
    
    const relativePdfPath = path.relative(path.join(__dirname, '..'), pdfPath);
    
    console.log(`✅ PDF reconverted: ${relativePdfPath}`);
    
    // Update database
    if (type === 'cert') {
      await pool.execute(
        `UPDATE generated_certificates 
         SET certificate_pdf_path = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [relativePdfPath, id]
      );
    } else {
      await pool.execute(
        `UPDATE generated_certificates 
         SET transcript_pdf_path = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [relativePdfPath, id]
      );
    }
    
    res.json({ 
      success: true, 
      message: 'PDF reconverted successfully',
      pdfPath: relativePdfPath
    });
    
  } catch (error) {
    console.error('Error reconverting to PDF:', error);
    res.status(500).json({ success: false, message: `Error reconverting to PDF: ${error.message}` });
  }
});

/**
 * Admin: Get certificate placeholder data for editing
 * GET /api/certificates/generated/:id/placeholders
 * Requires authentication
 */
router.get('/generated/:id/placeholders', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`📖 Admin requesting placeholder data for certificate ID ${id}`);
    
    // Get certificate details with generated_data
    const [certs] = await pool.execute(
      `SELECT gc.*, cc.course_id, cc.course_type
       FROM generated_certificates gc
       JOIN certificate_claims cc ON gc.claim_id = cc.id
       WHERE gc.id = ?`,
      [id]
    );
    
    if (certs.length === 0) {
      return res.status(404).json({ success: false, message: 'Certificate not found' });
    }
    
    const cert = certs[0];
    
    // Parse generated_data JSON
    let generatedData = {};
    try {
      generatedData = JSON.parse(cert.generated_data || '{}');
    } catch (e) {
      console.error('Error parsing generated_data:', e);
      generatedData = { certData: {}, transData: {} };
    }
    
    // Extract placeholder values from certData and transData
    const certData = generatedData.certData || {};
    const transData = generatedData.transData || {};
    
    // DATE_OF_ISSUANCE may be short format ("4 Feb 2026") or ISO ("2026-02-04"); normalize to YYYY-MM-DD for date input
    let dateOfIssuance = certData.DATE_OF_ISSUANCE || new Date().toISOString().split('T')[0];
    if (dateOfIssuance && dateOfIssuance.length > 10) {
      const parsed = new Date(dateOfIssuance);
      if (!isNaN(parsed.getTime())) dateOfIssuance = parsed.toISOString().split('T')[0];
    }
    const placeholderData = {
      STUDENT_NAME: certData.STUDENT_NAME || '',
      COURSE_NAME: certData.COURSE_NAME || '',
      REGISTRATION_NO: cert.registration_number || certData.REGISTRATION_NO || '',
      DATE_OF_ISSUANCE: dateOfIssuance,
      units: []
    };
    
    // Extract units from transData (UNIT_1_NAME, UNIT_1_CREDITS, etc.)
    for (let i = 1; i <= 25; i++) {
      let unitName = (transData[`UNIT_${i}_NAME`] || '').trim();
      const unitCredits = (transData[`UNIT_${i}_CREDITS`] || '').trim();
      
      if (unitName) {
        // Strip "Module X - " prefix for editor display; alignment adds it back when generating
        const displayName = unitName.replace(new RegExp(`^Module ${i} - `), '').trim() || unitName;
        // Extract just the number from credits like "(10 CPD Credits)"
        let credits = '10';
        if (unitCredits) {
          const match = unitCredits.match(/\((\d+)/);
          if (match) credits = match[1];
        }
        
        placeholderData.units.push({
          name: displayName,
          credits: credits
        });
      }
    }

    // If no units in saved data, fetch from course so transcript is not empty
    if (placeholderData.units.length === 0 && cert.course_id) {
      const courseType = (cert.course_type || 'cpd').toLowerCase();
      try {
        if (courseType === 'cpd') {
          const [cpdTopics] = await pool.execute(
            `SELECT topic_number, title, order_index FROM cpd_topics WHERE course_id = ? ORDER BY order_index ASC, topic_number ASC`,
            [cert.course_id]
          );
          if (cpdTopics.length > 0) {
            placeholderData.units = cpdTopics.map((t) => ({ name: t.title || '', credits: '10' }));
          } else {
            const [courseUnits] = await pool.execute(
              `SELECT id, title, order_index FROM units WHERE course_id = ? ORDER BY order_index ASC`,
              [cert.course_id]
            );
            if (courseUnits.length > 0) {
              placeholderData.units = courseUnits.map((u) => ({ name: u.title || '', credits: '10' }));
            }
          }
        } else {
          const [qualUnits] = await pool.execute(
            `SELECT unit_number, title FROM qual_units WHERE course_id = ? ORDER BY unit_number ASC`,
            [cert.course_id]
          );
          if (qualUnits.length > 0) {
            placeholderData.units = qualUnits.map((u) => ({ name: u.title || '', credits: '10' }));
          } else {
            const [courseUnits] = await pool.execute(
              `SELECT id, title, order_index FROM units WHERE course_id = ? ORDER BY order_index ASC`,
              [cert.course_id]
            );
            if (courseUnits.length > 0) {
              placeholderData.units = courseUnits.map((u) => ({ name: u.title || '', credits: '10' }));
            }
          }
        }
        if (placeholderData.units.length > 0) {
          console.log(`   Fetched ${placeholderData.units.length} course units for placeholder fallback`);
        }
      } catch (err) {
        console.error('Error fetching course units for placeholders:', err.message);
      }
    }
    
    console.log(`✅ Loaded placeholder data for ${cert.registration_number}`);
    
    res.json({
      success: true,
      data: placeholderData
    });
    
  } catch (error) {
    console.error('Error getting placeholder data:', error);
    res.status(500).json({ success: false, message: `Error loading certificate data: ${error.message}` });
  }
});

/**
 * Admin: Save edited certificate placeholders and regenerate
 * POST /api/certificates/generated/:id/placeholders
 * Requires authentication
 */
router.post('/generated/:id/placeholders', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { STUDENT_NAME, COURSE_NAME, REGISTRATION_NO, DATE_OF_ISSUANCE, units } = req.body;
    const certificateGenerator = require('../services/certificateGenerator');

    // Get certificate details
    const [certs] = await pool.execute(
      `SELECT gc.*, cc.id as claim_id, cc.student_id, cc.course_id, cc.course_type
       FROM generated_certificates gc
       JOIN certificate_claims cc ON gc.claim_id = cc.id
       WHERE gc.id = ?`,
      [id]
    );
    
    if (certs.length === 0) {
      return res.status(404).json({ success: false, message: 'Certificate not found' });
    }
    
    const cert = certs[0];
    const wasDelivered = cert.status === 'delivered';
    
    // Parse existing generated_data
    let generatedData = {};
    try {
      generatedData = JSON.parse(cert.generated_data || '{}');
    } catch (e) {
      console.error('Error parsing generated_data:', e);
      generatedData = { certData: {}, transData: {} };
    }
    
    // Ensure certData and transData exist
    if (!generatedData.certData) generatedData.certData = {};
    if (!generatedData.transData) generatedData.transData = {};
    
    // Update certData
    generatedData.certData.STUDENT_NAME = STUDENT_NAME;
    generatedData.certData.COURSE_NAME = COURSE_NAME;
    generatedData.certData.REGISTRATION_NO = REGISTRATION_NO;
    generatedData.certData.DATE_OF_ISSUANCE = DATE_OF_ISSUANCE;
    
    // Update transData
    generatedData.transData.STUDENT_NAME = STUDENT_NAME;
    generatedData.transData.COURSE_NAME = COURSE_NAME;
    generatedData.transData.REGISTRATION_NO = REGISTRATION_NO;
    
    // Update units in transData if provided (NAME, CREDITS, and LINE for transcript alignment)
    if (units && Array.isArray(units)) {
      units.forEach((unit, index) => {
        const unitNum = index + 1;
        const name = unit.name || '';
        const creditsStr = unit.credits ? `(${unit.credits} CPD Credits)` : '';
        generatedData.transData[`UNIT_${unitNum}_NAME`] = name;
        generatedData.transData[`UNIT_${unitNum}_CREDITS`] = creditsStr;
        generatedData.transData[`UNIT_${unitNum}_LINE`] = name && creditsStr ? `Module ${unitNum} - ${name} ${creditsStr}` : '';
      });
      
      // Clear remaining unit slots (up to 25)
      for (let i = units.length + 1; i <= 25; i++) {
        generatedData.transData[`UNIT_${i}_NAME`] = '';
        generatedData.transData[`UNIT_${i}_CREDITS`] = '';
        generatedData.transData[`UNIT_${i}_LINE`] = '';
      }
    }
    
    // Update registrationNumber at root level too
    generatedData.registrationNumber = REGISTRATION_NO;
    
    // Update certificate_claims table with edited data
    await pool.execute(
      `UPDATE certificate_claims 
       SET full_name = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [STUDENT_NAME, cert.claim_id]
    );
    
    console.log(`✅ Updated certificate_claims table with new student name`);
    
    // Update generated_certificates: only placeholder data and reg number. Do NOT regenerate
    // DOCX/PDF from template, so any admin-uploaded edited transcript (Word layout) is preserved.
    await pool.execute(
      `UPDATE generated_certificates 
       SET registration_number = ?,
           generated_data = ?,
           status = 'ready'
       WHERE id = ?`,
      [REGISTRATION_NO, JSON.stringify(generatedData), id]
    );
    
    console.log(`✅ Updated generated_certificates (placeholder data only; existing DOCX/PDF files preserved)`);
    
    res.json({ 
      success: true, 
      message: 'Certificate data saved. Existing certificate/transcript files are unchanged (uploaded Word edits preserved).',
      registration_number: REGISTRATION_NO,
      needsRedelivery: false
    });
    
  } catch (error) {
    console.error('Error saving certificate placeholders:', error);
    res.status(500).json({ success: false, message: `Error saving certificate: ${error.message}` });
  }
});

/**
 * Get certificate generation queue status (Admin)
 * GET /api/certificates/queue/status
 */
router.get('/queue/status', auth, async (req, res) => {
  try {
    const certificateQueue = require('../queues/certificateQueue');
    
    const stats = await certificateQueue.getJobCounts();
    
    // Get recent jobs
    const [waiting, active, completed, failed] = await Promise.all([
      certificateQueue.getJobs(['waiting'], 0, 10),
      certificateQueue.getJobs(['active'], 0, 10),
      certificateQueue.getJobs(['completed'], 0, 10),
      certificateQueue.getJobs(['failed'], 0, 10)
    ]);
    
    res.json({
      success: true,
      stats: {
        waiting: stats.waiting,
        active: stats.active,
        completed: stats.completed,
        failed: stats.failed,
        delayed: stats.delayed,
        total: stats.total
      },
      recentJobs: {
        waiting: waiting.map(job => ({
          id: job.id,
          claimId: job.data.claimId,
          createdAt: new Date(job.timestamp)
        })),
        active: active.map(job => ({
          id: job.id,
          claimId: job.data.claimId,
          progress: job.progress(),
          startedAt: new Date(job.processedOn)
        })),
        completed: completed.map(job => ({
          id: job.id,
          claimId: job.data.claimId,
          completedAt: new Date(job.finishedOn),
          result: job.returnvalue
        })),
        failed: failed.map(job => ({
          id: job.id,
          claimId: job.data.claimId,
          failedAt: new Date(job.failedReason),
          error: job.failedReason,
          attempts: job.attemptsMade
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching queue status:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching queue status: ' + error.message
    });
  }
});

/**
 * Retry failed certificate generation job (Admin)
 * POST /api/certificates/queue/retry/:jobId
 */
router.post('/queue/retry/:jobId', auth, async (req, res) => {
  try {
    const certificateQueue = require('../queues/certificateQueue');
    const { jobId } = req.params;
    
    const job = await certificateQueue.getJob(jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }
    
    await job.retry();
    
    res.json({
      success: true,
      message: 'Job queued for retry',
      jobId: job.id
    });
  } catch (error) {
    console.error('Error retrying job:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrying job: ' + error.message
    });
  }
});

module.exports = router;


