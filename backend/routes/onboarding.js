const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const cloudinary = require('../config/cloudinary');
const { invalidateCache } = require('../middleware/cache');

// Normalize MySQL TINYINT/Buffer booleans to plain true/false for JSON responses
function normalizeOnboardingStatus(row) {
  if (!row) return null;
  const result = { ...row };
  const boolFields = [
    'welcome_completed', 'course_selection_completed', 'qualification_selection_completed',
    'documents_uploaded', 'initial_assessment_completed', 'vark_assessment_completed',
    'admin_verified', 'dashboard_access_granted'
  ];
  for (const f of boolFields) {
    const v = result[f];
    if (v != null && Buffer.isBuffer(v)) result[f] = v[0] === 1;
    else result[f] = v === 1 || v === true;
  }
  return result;
}

async function detectEnrollmentType(studentId) {
  const [rows] = await pool.execute(
    `SELECT DISTINCT LOWER(TRIM(COALESCE(c.course_type, ''))) AS course_type
     FROM course_assignments ca
     JOIN courses c ON c.id = ca.course_id
     WHERE ca.student_id = ?
       AND (
         ca.status = 'Enrolled'
         OR LOWER(TRIM(COALESCE(ca.status, ''))) IN ('enrolled', 'active', 'in progress')
       )`,
    [studentId]
  );

  const types = (rows || [])
    .map((r) => String(r.course_type || '').toLowerCase())
    .filter(Boolean);

  const hasQualification = types.some((t) => t.includes('qualification') || t.includes('qualifi'));
  const hasCPD = types.some((t) => t.includes('cpd'));

  return {
    hasQualification,
    hasCPD,
    hasBoth: hasQualification && hasCPD,
    hasNone: !hasQualification && !hasCPD
  };
}

// Configure multer for document uploads (memory storage for Cloudinary)
const documentStorage = multer.memoryStorage();

const documentUpload = multer({
  storage: documentStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, JPG, PNG, DOC, and DOCX are allowed.'));
    }
  }
});

// Helper function to upload document to Cloudinary
async function uploadDocumentToCloudinary(file, userId, documentType) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `lms/student-documents/${userId}/${documentType}`,
        resource_type: 'auto',
        upload_preset: 'lms_public_files'
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

// GET /api/onboarding/status - Get onboarding status for current student
router.get('/status', auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const enrollmentType = await detectEnrollmentType(userId);
    
    // Get onboarding status
    const [statusRows] = await pool.execute(
      'SELECT * FROM student_onboarding_status WHERE user_id = ?',
      [userId]
    );
    
    if (statusRows.length === 0) {
      // Create initial onboarding record
      await pool.execute(
        'INSERT INTO student_onboarding_status (user_id, current_step) VALUES (?, ?)',
        [userId, 'welcome']
      );
      
      return res.json({
        success: true,
        status: {
          user_id: userId,
          current_step: 'welcome',
          welcome_completed: false,
          course_selection_completed: false,
          qualification_selection_completed: false,
          documents_uploaded: false,
          initial_assessment_completed: false,
          vark_assessment_completed: false,
          admin_verified: false,
          dashboard_access_granted: false
        },
        enrollment_type: enrollmentType
      });
    }
    
    const row = statusRows[0];
    // CPD-only students skip documents; qualification students need documents
    const [courseRows] = await pool.execute(
      'SELECT qualifications FROM student_course_selections WHERE user_id = ?',
      [userId]
    );
    const needsDocuments = courseRows.length > 0 && (courseRows[0].qualifications === 1 || courseRows[0].qualifications === true);
    const isCpdOnly = courseRows.length > 0 && !(courseRows[0].qualifications === 1 || courseRows[0].qualifications === true);
    const allComplete = (row.initial_assessment_completed === 1 || row.initial_assessment_completed === true) &&
      (row.vark_assessment_completed === 1 || row.vark_assessment_completed === true) &&
      (!needsDocuments || (row.documents_uploaded === 1 || row.documents_uploaded === true));
    if (allComplete && !row.verification_requested_at) {
      if (isCpdOnly) {
        await pool.execute(
          'UPDATE student_onboarding_status SET verification_requested_at = NOW(), dashboard_access_granted = TRUE, updated_at = NOW() WHERE user_id = ?',
          [userId]
        );
        await pool.execute(
          "UPDATE users SET onboarding_profile_status = 'verified' WHERE id = ?",
          [userId]
        );
      } else {
        await pool.execute(
          'UPDATE student_onboarding_status SET verification_requested_at = NOW(), updated_at = NOW() WHERE user_id = ?',
          [userId]
        );
        await pool.execute(
          "UPDATE users SET onboarding_profile_status = 'review' WHERE id = ?",
          [userId]
        );
      }
      await invalidateCache('cache:/api/admin/students/profiles*');
      await invalidateCache('cache:/api/tutor/students/profiles*');
      const [updated] = await pool.execute('SELECT * FROM student_onboarding_status WHERE user_id = ?', [userId]);
      return res.json({ success: true, status: normalizeOnboardingStatus(updated[0]), enrollment_type: enrollmentType });
    }
    
    res.json({
      success: true,
      status: normalizeOnboardingStatus(statusRows[0]),
      enrollment_type: enrollmentType
    });
  } catch (error) {
    console.error('Error fetching onboarding status:', error);
    res.status(500).json({ success: false, message: 'Error fetching onboarding status' });
  }
});

// PUT /api/onboarding/status - Update onboarding status
router.put('/status', auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    const updates = req.body;
    const allowedFields = [
      'current_step',
      'welcome_completed',
      'course_selection_completed',
      'qualification_selection_completed',
      'documents_uploaded',
      'initial_assessment_completed',
      'vark_assessment_completed'
    ];
    
    const updateFields = [];
    const updateValues = [];
    
    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        updateFields.push(`${key} = ?`);
        updateValues.push(updates[key]);
      }
    });
    
    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }
    
    updateValues.push(userId);
    
    await pool.execute(
      `UPDATE student_onboarding_status SET ${updateFields.join(', ')}, updated_at = NOW() WHERE user_id = ?`,
      updateValues
    );
    
    // Get updated status and check if all steps are now complete (student may have sent only one flag, e.g. vark_assessment_completed)
    const [statusRows] = await pool.execute(
      'SELECT * FROM student_onboarding_status WHERE user_id = ?',
      [userId]
    );
    const row = statusRows[0];
    const [courseRows] = await pool.execute(
      'SELECT qualifications FROM student_course_selections WHERE user_id = ?',
      [userId]
    );
    const needsDocuments = courseRows.length > 0 && (courseRows[0].qualifications === 1 || courseRows[0].qualifications === true);
    const isCpdOnly = courseRows.length > 0 && !(courseRows[0].qualifications === 1 || courseRows[0].qualifications === true);
    const allComplete = row &&
      (row.initial_assessment_completed === 1 || row.initial_assessment_completed === true) &&
      (row.vark_assessment_completed === 1 || row.vark_assessment_completed === true) &&
      (!needsDocuments || (row.documents_uploaded === 1 || row.documents_uploaded === true));
    if (allComplete && row && !row.verification_requested_at) {
      if (isCpdOnly) {
        // CPD-only: auto-grant dashboard access, skip verification
        await pool.execute(
          'UPDATE student_onboarding_status SET verification_requested_at = NOW(), dashboard_access_granted = TRUE, updated_at = NOW() WHERE user_id = ?',
          [userId]
        );
        await pool.execute(
          "UPDATE users SET onboarding_profile_status = 'verified' WHERE id = ?",
          [userId]
        );
      } else {
        // Qualification students: go to verification queue
        await pool.execute(
          'UPDATE student_onboarding_status SET verification_requested_at = NOW(), updated_at = NOW() WHERE user_id = ?',
          [userId]
        );
        await pool.execute(
          "UPDATE users SET onboarding_profile_status = 'review' WHERE id = ?",
          [userId]
        );
      }
      await invalidateCache('cache:/api/admin/students/profiles*');
      await invalidateCache('cache:/api/tutor/students/profiles*');
    }
    
    invalidateCache('/api/onboarding/status');
    
    // Re-fetch so response includes verification_requested_at if we just set it
    const [finalRows] = await pool.execute(
      'SELECT * FROM student_onboarding_status WHERE user_id = ?',
      [userId]
    );
    
    res.json({
      success: true,
      message: 'Onboarding status updated',
      status: normalizeOnboardingStatus(finalRows[0] || statusRows[0])
    });
  } catch (error) {
    console.error('Error updating onboarding status:', error);
    res.status(500).json({ success: false, message: 'Error updating onboarding status' });
  }
});

// POST /api/onboarding/course-selection - Save course selection
router.post('/course-selection', auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    const { cpd_courses, qualifications } = req.body;
    
    if (cpd_courses === undefined || qualifications === undefined) {
      return res.status(400).json({ success: false, message: 'Course selection required' });
    }
    
    // Upsert course selection
    await pool.execute(
      `INSERT INTO student_course_selections (user_id, cpd_courses, qualifications)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE cpd_courses = ?, qualifications = ?, updated_at = NOW()`,
      [userId, cpd_courses, qualifications, cpd_courses, qualifications]
    );
    
    // Update onboarding status
    // CPD-only: skip qualification-level and documents, go to initial-assessment
    // Qualification or both: go to qualification-level then documents
    const nextStep = qualifications ? 'qualification-level' : 'initial-assessment';
    await pool.execute(
      'UPDATE student_onboarding_status SET course_selection_completed = TRUE, current_step = ? WHERE user_id = ?',
      [nextStep, userId]
    );
    
    res.json({
      success: true,
      message: 'Course selection saved',
      next_step: nextStep
    });
  } catch (error) {
    console.error('Error saving course selection:', error);
    res.status(500).json({ success: false, message: 'Error saving course selection' });
  }
});

// GET /api/onboarding/course-selection - Get course selection
router.get('/course-selection', auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    const [rows] = await pool.execute(
      'SELECT * FROM student_course_selections WHERE user_id = ?',
      [userId]
    );
    
    res.json({
      success: true,
      selection: rows.length > 0 ? rows[0] : null
    });
  } catch (error) {
    console.error('Error fetching course selection:', error);
    res.status(500).json({ success: false, message: 'Error fetching course selection' });
  }
});

// POST /api/onboarding/qualification-level - Save qualification level
router.post('/qualification-level', auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    const { level } = req.body;
    
    if (!level || level < 2 || level > 7) {
      return res.status(400).json({ success: false, message: 'Valid qualification level (2-7) required' });
    }
    
    // Upsert qualification selection
    await pool.execute(
      `INSERT INTO student_qualification_selections (user_id, level, entry_requirements_acknowledged)
       VALUES (?, ?, TRUE)
       ON DUPLICATE KEY UPDATE level = ?, entry_requirements_acknowledged = TRUE, updated_at = NOW()`,
      [userId, level, level]
    );
    
    // Update onboarding status
    await pool.execute(
      'UPDATE student_onboarding_status SET qualification_selection_completed = TRUE, current_step = ? WHERE user_id = ?',
      ['documents', userId]
    );
    
    res.json({
      success: true,
      message: 'Qualification level saved',
      next_step: 'documents'
    });
  } catch (error) {
    console.error('Error saving qualification level:', error);
    res.status(500).json({ success: false, message: 'Error saving qualification level' });
  }
});

// GET /api/onboarding/qualification-level - Get qualification level
router.get('/qualification-level', auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    const [rows] = await pool.execute(
      'SELECT * FROM student_qualification_selections WHERE user_id = ?',
      [userId]
    );
    
    res.json({
      success: true,
      selection: rows.length > 0 ? rows[0] : null
    });
  } catch (error) {
    console.error('Error fetching qualification level:', error);
    res.status(500).json({ success: false, message: 'Error fetching qualification level' });
  }
});

// POST /api/onboarding/documents/upload - Upload document
router.post('/documents/upload', auth, documentUpload.single('file'), async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    const { document_type } = req.body;
    
    if (!['qualification', 'identity', 'cv', 'address'].includes(document_type)) {
      return res.status(400).json({ success: false, message: 'Invalid document type' });
    }
    
    // Upload to Cloudinary
    const cloudinaryResult = await uploadDocumentToCloudinary(req.file, userId, document_type);
    
    // Save to database
    const [result] = await pool.execute(
      `INSERT INTO student_documents (user_id, document_type, file_name, file_url, file_size, mime_type, cloudinary_public_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, document_type, req.file.originalname, cloudinaryResult.secure_url, req.file.size, req.file.mimetype, cloudinaryResult.public_id]
    );
    
    res.json({
      success: true,
      message: 'Document uploaded successfully',
      document: {
        id: result.insertId,
        document_type,
        file_name: req.file.originalname,
        file_url: cloudinaryResult.secure_url,
        file_size: req.file.size,
        mime_type: req.file.mimetype
      }
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({ success: false, message: 'Error uploading document' });
  }
});

// GET /api/onboarding/documents - Get all documents
router.get('/documents', auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    const [rows] = await pool.execute(
      `SELECT id, user_id, document_type, file_name, file_url, file_size, mime_type, uploaded_at,
              COALESCE(status, 'pending') AS status,
              rejection_reason,
              previous_version_id
       FROM student_documents WHERE user_id = ? ORDER BY uploaded_at DESC`,
      [userId]
    );
    
    res.json({
      success: true,
      documents: rows
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ success: false, message: 'Error fetching documents' });
  }
});

// DELETE /api/onboarding/documents/:id - Delete document
router.delete('/documents/:id', auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const documentId = parseInt(req.params.id);
    
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    // Get document info
    const [rows] = await pool.execute(
      'SELECT * FROM student_documents WHERE id = ? AND user_id = ?',
      [documentId, userId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }
    
    const document = rows[0];
    
    // Delete from Cloudinary
    if (document.cloudinary_public_id) {
      try {
        // Determine resource type based on mime type
        let resourceType = 'raw'; // default
        if (document.mime_type.startsWith('image/')) {
          resourceType = 'image';
        } else if (document.mime_type.startsWith('video/')) {
          resourceType = 'video';
        } else if (document.mime_type === 'application/pdf' || 
                   document.mime_type.includes('word') || 
                   document.mime_type.includes('document')) {
          resourceType = 'raw';
        }

        await new Promise((resolve, reject) => {
          cloudinary.uploader.destroy(document.cloudinary_public_id, { resource_type: resourceType }, (error, result) => {
            if (error) reject(error);
            else resolve(result);
          });
        });
      } catch (err) {
        console.error('Error deleting from Cloudinary:', err);
        // Continue with database deletion even if Cloudinary fails
      }
    }
    
    // Delete from database
    await pool.execute('DELETE FROM student_documents WHERE id = ? AND user_id = ?', [documentId, userId]);
    
    res.json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ success: false, message: 'Error deleting document' });
  }
});

// POST /api/onboarding/initial-assessment - Submit initial assessment
router.post('/initial-assessment', auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Detect if CPD-only: selections row first, else enrollment (e.g. before auto-setup persisted)
    const [courseRows] = await pool.execute(
      'SELECT qualifications FROM student_course_selections WHERE user_id = ?',
      [userId]
    );
    let isCpdOnly = false;
    if (courseRows.length > 0) {
      isCpdOnly = !(courseRows[0].qualifications === 1 || courseRows[0].qualifications === true);
    } else {
      const et = await detectEnrollmentType(userId);
      isCpdOnly = et.hasCPD && !et.hasQualification;
    }
    
    const {
      full_name,
      gender,
      date_of_birth,
      nationality,
      primary_language,
      contact_number,
      email,
      postal_address,
      ethnicity,
      why_qualification,
      career_goals,
      employer_support,
      english_literacy,
      ict_skills,
      special_learning_needs,
      data_usage_consent,
      assessment_accuracy_consent,
      qualification_understanding,
      apl_understanding,
      privacy_policy_consent,
      terms_conditions_consent,
      signature_name,
      signature_date
    } = req.body;
    
    // Validate required fields (personal info + signature — always required)
    const coreFields = {
      full_name, gender, date_of_birth, nationality, primary_language, contact_number,
      email, postal_address, ethnicity, signature_name, signature_date
    };
    
    for (const [key, value] of Object.entries(coreFields)) {
      if (!value || String(value).trim() === '') {
        return res.status(400).json({ success: false, message: `${key.replace('_', ' ')} is required` });
      }
    }

    // Qualification students also require motivation/skills fields
    if (!isCpdOnly) {
      const qualFields = { why_qualification, career_goals, employer_support, english_literacy, ict_skills };
      for (const [key, value] of Object.entries(qualFields)) {
        if (!value || String(value).trim() === '') {
          return res.status(400).json({ success: false, message: `${key.replace('_', ' ')} is required` });
        }
      }

      if (why_qualification.length < 50) {
        return res.status(400).json({ success: false, message: 'Why qualification answer must be at least 50 characters' });
      }
      if (career_goals.length < 50) {
        return res.status(400).json({ success: false, message: 'Career goals answer must be at least 50 characters' });
      }
      if (employer_support.length < 50) {
        return res.status(400).json({ success: false, message: 'Employer support answer must be at least 50 characters' });
      }
    }
    
    // Validate consents
    if (!data_usage_consent || !privacy_policy_consent || !terms_conditions_consent) {
      return res.status(400).json({ success: false, message: 'All consent checkboxes must be checked' });
    }
    if (!isCpdOnly && (!assessment_accuracy_consent || !qualification_understanding || !apl_understanding)) {
      return res.status(400).json({ success: false, message: 'All consent checkboxes must be checked' });
    }
    
    // Upsert initial assessment
    await pool.execute(
      `INSERT INTO student_initial_assessments (
        user_id, full_name, gender, date_of_birth, nationality, primary_language,
        contact_number, email, postal_address, ethnicity, why_qualification,
        career_goals, employer_support, english_literacy, ict_skills, special_learning_needs,
        data_usage_consent, assessment_accuracy_consent, qualification_understanding,
        apl_understanding, privacy_policy_consent, terms_conditions_consent, signature_name, signature_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        full_name = ?, gender = ?, date_of_birth = ?, nationality = ?, primary_language = ?,
        contact_number = ?, email = ?, postal_address = ?, ethnicity = ?, why_qualification = ?,
        career_goals = ?, employer_support = ?, english_literacy = ?, ict_skills = ?,
        special_learning_needs = ?, data_usage_consent = ?, assessment_accuracy_consent = ?,
        qualification_understanding = ?, apl_understanding = ?, privacy_policy_consent = ?,
        terms_conditions_consent = ?, signature_name = ?, signature_date = ?, updated_at = NOW()`,
      [
        userId, full_name, gender, date_of_birth, nationality, primary_language,
        contact_number, email, postal_address, ethnicity, why_qualification || '',
        career_goals || '', employer_support || '', english_literacy || '', ict_skills || '', special_learning_needs || '',
        data_usage_consent ? 1 : 0, assessment_accuracy_consent ? 1 : 0, qualification_understanding ? 1 : 0,
        apl_understanding ? 1 : 0, privacy_policy_consent ? 1 : 0, terms_conditions_consent ? 1 : 0, signature_name, signature_date,
        full_name, gender, date_of_birth, nationality, primary_language,
        contact_number, email, postal_address, ethnicity, why_qualification || '',
        career_goals || '', employer_support || '', english_literacy || '', ict_skills || '',
        special_learning_needs || '', data_usage_consent ? 1 : 0, assessment_accuracy_consent ? 1 : 0,
        qualification_understanding ? 1 : 0, apl_understanding ? 1 : 0, privacy_policy_consent ? 1 : 0,
        terms_conditions_consent ? 1 : 0, signature_name, signature_date
      ]
    );

    if (isCpdOnly) {
      // CPD-only: skip VARK + admin verification wait; grant dashboard immediately
      await pool.execute(
        `UPDATE student_onboarding_status
         SET initial_assessment_completed = TRUE,
             vark_assessment_completed = TRUE,
             admin_verified = TRUE,
             verification_requested_at = NOW(),
             dashboard_access_granted = TRUE,
             current_step = 'dashboard',
             profile_status = 'verified',
             updated_at = NOW()
         WHERE user_id = ?`,
        [userId]
      );
      await pool.execute(
        "UPDATE users SET onboarding_profile_status = 'verified' WHERE id = ?",
        [userId]
      );
      await invalidateCache('cache:/api/admin/students/profiles*');
      await invalidateCache('cache:/api/tutor/students/profiles*');

      return res.json({
        success: true,
        message: 'Assessment submitted — dashboard access granted',
        next_step: 'dashboard',
        cpd_only: true,
        dashboard_access_granted: true
      });
    }
    
    // Qualification/Both: proceed to VARK
    await pool.execute(
      'UPDATE student_onboarding_status SET initial_assessment_completed = TRUE, current_step = ? WHERE user_id = ?',
      ['vark', userId]
    );
    
    res.json({
      success: true,
      message: 'Initial assessment submitted successfully',
      next_step: 'vark'
    });
  } catch (error) {
    console.error('Error submitting initial assessment:', error);
    res.status(500).json({ success: false, message: 'Error submitting initial assessment' });
  }
});

// GET /api/onboarding/initial-assessment - Get initial assessment
router.get('/initial-assessment', auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    const [rows] = await pool.execute(
      'SELECT * FROM student_initial_assessments WHERE user_id = ?',
      [userId]
    );
    
    res.json({
      success: true,
      assessment: rows.length > 0 ? rows[0] : null
    });
  } catch (error) {
    console.error('Error fetching initial assessment:', error);
    res.status(500).json({ success: false, message: 'Error fetching initial assessment' });
  }
});

// GET /api/onboarding/me - Get current student's complete onboarding data (for profile page)
router.get('/me', auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const [statusRows] = await pool.execute(
      'SELECT * FROM student_onboarding_status WHERE user_id = ?',
      [userId]
    );
    const [courseRows] = await pool.execute(
      'SELECT * FROM student_course_selections WHERE user_id = ?',
      [userId]
    );
    const [qualificationRows] = await pool.execute(
      'SELECT * FROM student_qualification_selections WHERE user_id = ?',
      [userId]
    );
    const [documentRows] = await pool.execute(
      'SELECT id, user_id, document_type, file_name, file_url, file_size, mime_type, uploaded_at FROM student_documents WHERE user_id = ? ORDER BY document_type, uploaded_at DESC',
      [userId]
    );
    const [assessmentRows] = await pool.execute(
      'SELECT * FROM student_initial_assessments WHERE user_id = ?',
      [userId]
    );
    res.json({
      success: true,
      onboarding: {
        status: statusRows.length > 0 ? statusRows[0] : null,
        courseSelection: courseRows.length > 0 ? courseRows[0] : null,
        qualificationSelection: qualificationRows.length > 0 ? qualificationRows[0] : null,
        documents: documentRows || [],
        initialAssessment: assessmentRows.length > 0 ? assessmentRows[0] : null
      }
    });
  } catch (error) {
    console.error('Error fetching onboarding/me:', error);
    res.status(500).json({ success: false, message: 'Error fetching onboarding data' });
  }
});

// GET /api/onboarding/admin/student/:id - Get student's complete onboarding data (Admin only)
router.get('/admin/student/:id', auth, async (req, res) => {
  try {
    const studentId = parseInt(req.params.id);
    const adminRole = req.user?.role;
    
    // Only admins can access
    if (!['Admin', 'Certificate Manager', 'Operation Manager'].includes(adminRole)) {
      return res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
    }
    
    // Get onboarding status
    const [statusRows] = await pool.execute(
      'SELECT * FROM student_onboarding_status WHERE user_id = ?',
      [studentId]
    );
    
    // Get course selections
    const [courseRows] = await pool.execute(
      'SELECT * FROM student_course_selections WHERE user_id = ?',
      [studentId]
    );
    
    // Get qualification selections
    const [qualificationRows] = await pool.execute(
      'SELECT * FROM student_qualification_selections WHERE user_id = ?',
      [studentId]
    );
    
    // Get documents
    const [documentRows] = await pool.execute(
      'SELECT * FROM student_documents WHERE user_id = ? ORDER BY document_type, uploaded_at DESC',
      [studentId]
    );
    
    // Get initial assessment
    const [assessmentRows] = await pool.execute(
      'SELECT * FROM student_initial_assessments WHERE user_id = ?',
      [studentId]
    );
    
    res.json({
      success: true,
      onboarding: {
        status: normalizeOnboardingStatus(statusRows.length > 0 ? statusRows[0] : null),
        courseSelection: courseRows.length > 0 ? courseRows[0] : null,
        qualificationSelection: qualificationRows.length > 0 ? qualificationRows[0] : null,
        documents: documentRows || [],
        initialAssessment: assessmentRows.length > 0 ? assessmentRows[0] : null
      }
    });
  } catch (error) {
    console.error('Error fetching student onboarding data:', error);
    res.status(500).json({ success: false, message: 'Error fetching onboarding data' });
  }
});

// PUT /api/onboarding/admin/verify/:id - Verify student and grant dashboard access (Admin only)
router.put('/admin/verify/:id', auth, async (req, res) => {
  try {
    const studentId = parseInt(req.params.id);
    const adminId = req.user?.id;
    const adminRole = req.user?.role;
    const { admin_notes } = req.body;
    
    // Only admins can verify
    if (!['Admin', 'Certificate Manager', 'Accounts Manager', 'Operation Manager'].includes(adminRole)) {
      return res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
    }
    
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      // Update onboarding status
      await connection.execute(
        `UPDATE student_onboarding_status 
         SET admin_verified = TRUE, 
             dashboard_access_granted = TRUE,
             admin_verified_at = NOW(),
             admin_verified_by = ?,
             admin_notes = ?
         WHERE user_id = ?`,
        [adminId, admin_notes || 'Verified by admin', studentId]
      );
      // Set user's onboarding_profile_status to 'verified' so Students Profile shows correct status
      await connection.execute(
        "UPDATE users SET onboarding_profile_status = 'verified' WHERE id = ?",
        [studentId]
      );
      
      // Get initial assessment data
      const [assessmentRows] = await connection.execute(
        'SELECT * FROM student_initial_assessments WHERE user_id = ?',
        [studentId]
      );
      
      if (assessmentRows.length > 0) {
        const assessment = assessmentRows[0];
        
        // Check if student profile exists
        const [profileRows] = await connection.execute(
          'SELECT user_id FROM student_profiles WHERE user_id = ?',
          [studentId]
        );
        
        if (profileRows.length === 0) {
          // Create profile with initial assessment data
          await connection.execute(
            `INSERT INTO student_profiles (
              user_id, gender, date_of_birth, nationality, ethnicity,
              \`current_role\`, motivation, 
              english_literacy, ict_skills, special_learning_needs,
              is_profile_complete, profile_completed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
            [
              studentId,
              assessment.gender,
              assessment.date_of_birth,
              assessment.nationality,
              assessment.ethnicity,
              assessment.full_name, // Use full_name as current_role placeholder
              assessment.why_qualification,
              assessment.english_literacy,
              assessment.ict_skills,
              assessment.special_learning_needs
            ]
          );
        } else {
          // Update existing profile
          await connection.execute(
            `UPDATE student_profiles SET
              gender = ?,
              date_of_birth = ?,
              nationality = ?,
              ethnicity = ?,
              \`current_role\` = ?,
              motivation = ?,
              english_literacy = ?,
              ict_skills = ?,
              special_learning_needs = ?,
              is_profile_complete = 1,
              profile_completed_at = NOW(),
              updated_at = NOW()
            WHERE user_id = ?`,
            [
              assessment.gender,
              assessment.date_of_birth,
              assessment.nationality,
              assessment.ethnicity,
              assessment.full_name,
              assessment.why_qualification,
              assessment.english_literacy,
              assessment.ict_skills,
              assessment.special_learning_needs,
              studentId
            ]
          );
        }
      }
      
      await connection.commit();
      
      let emailSent = false;
      try {
        const { sendStudentVerificationEmail } = require('../services/studentVerificationEmail');
        const r = await sendStudentVerificationEmail(pool, studentId, adminId, { resend: false });
        emailSent = r.success;
        if (!r.success) {
          console.error('[Onboarding] Verification email failed for student', studentId, r.error);
        }
      } catch (emailErr) {
        console.error('[Onboarding] Error sending verification email:', emailErr.message);
      }

      res.json({
        success: true,
        message: 'Student verified, profile populated, and dashboard access granted',
        emailSent
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error verifying student:', error);
    res.status(500).json({ success: false, message: 'Error verifying student' });
  }
});

// POST /api/onboarding/admin/resend-verification-email/:id - Resend verification email
router.post('/admin/resend-verification-email/:id', auth, async (req, res) => {
  try {
    const studentId = parseInt(req.params.id);
    const adminRole = req.user?.role;
    if (!['Admin', 'Certificate Manager', 'Accounts Manager', 'Operation Manager'].includes(adminRole)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const { sendStudentVerificationEmail } = require('../services/studentVerificationEmail');
    const r = await sendStudentVerificationEmail(pool, studentId, req.user?.id, { resend: true });
    res.json({
      success: r.success,
      message: r.success ? 'Email sent successfully' : 'Failed to send email',
      error: r.error || null
    });
  } catch (error) {
    console.error('[Onboarding] Error resending verification email:', error);
    res.status(500).json({ success: false, message: 'Error sending email' });
  }
});

// POST /api/onboarding/auto-setup - Auto-setup course selection based on detected enrollment
router.post('/auto-setup', auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const enrollmentType = await detectEnrollmentType(userId);

    if (enrollmentType.hasNone) {
      return res.json({
        success: true,
        message: 'No enrollments detected — manual selection required',
        enrollment_type: enrollmentType,
        auto_setup: false
      });
    }

    const cpd = enrollmentType.hasCPD ? 1 : 0;
    const qual = enrollmentType.hasQualification ? 1 : 0;
    const nextStep = qual ? 'qualification-level' : 'initial-assessment';

    await pool.execute(
      `INSERT INTO student_course_selections (user_id, cpd_courses, qualifications)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE cpd_courses = ?, qualifications = ?, updated_at = NOW()`,
      [userId, cpd, qual, cpd, qual]
    );

    await pool.execute(
      'UPDATE student_onboarding_status SET welcome_completed = TRUE, course_selection_completed = TRUE, current_step = ? WHERE user_id = ?',
      [nextStep, userId]
    );

    res.json({
      success: true,
      message: 'Course selection auto-configured from enrollments',
      enrollment_type: enrollmentType,
      auto_setup: true,
      next_step: nextStep,
      path: enrollmentType.hasQualification ? 'qualification' : 'cpd-only'
    });
  } catch (error) {
    console.error('Error in auto-setup:', error);
    res.status(500).json({ success: false, message: 'Error in auto-setup' });
  }
});

// GET /api/onboarding/qualification-upgrade-needed - Check if CPD-only student later enrolled in qualification
router.get('/qualification-upgrade-needed', auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const [courseRows] = await pool.execute(
      'SELECT qualifications FROM student_course_selections WHERE user_id = ?',
      [userId]
    );

    const currentlyQualification = courseRows.length > 0 && (courseRows[0].qualifications === 1 || courseRows[0].qualifications === true);

    if (currentlyQualification) {
      return res.json({ success: true, upgrade_needed: false });
    }

    const enrollmentType = await detectEnrollmentType(userId);

    res.json({
      success: true,
      upgrade_needed: enrollmentType.hasQualification,
      enrollment_type: enrollmentType
    });
  } catch (error) {
    console.error('Error checking qualification upgrade:', error);
    res.status(500).json({ success: false, message: 'Error checking qualification upgrade' });
  }
});

// POST /api/onboarding/start-qualification-upgrade - CPD-only student starts qualification onboarding
router.post('/start-qualification-upgrade', auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Mark qualifications in course selections
    await pool.execute(
      `INSERT INTO student_course_selections (user_id, cpd_courses, qualifications)
       VALUES (?, 1, 1)
       ON DUPLICATE KEY UPDATE qualifications = 1, updated_at = NOW()`,
      [userId]
    );

    // Reset qualification-specific onboarding steps but keep dashboard access
    await pool.execute(
      `UPDATE student_onboarding_status
       SET qualification_selection_completed = FALSE,
           documents_uploaded = FALSE,
           initial_assessment_completed = FALSE,
           vark_assessment_completed = FALSE,
           admin_verified = FALSE,
           admin_verified_at = NULL,
           admin_verified_by = NULL,
           admin_notes = NULL,
           verification_requested_at = NULL,
           dashboard_access_granted = TRUE,
           current_step = 'qualification-level',
           updated_at = NOW()
       WHERE user_id = ?`,
      [userId]
    );

    // Reset user's profile verification status back to pending
    await pool.execute(
      "UPDATE users SET onboarding_profile_status = 'pending' WHERE id = ?",
      [userId]
    );

    await invalidateCache('cache:/api/admin/students/profiles*');
    await invalidateCache('cache:/api/tutor/students/profiles*');

    res.json({
      success: true,
      message: 'Qualification upgrade started',
      next_step: 'qualification-level'
    });
  } catch (error) {
    console.error('Error starting qualification upgrade:', error);
    res.status(500).json({ success: false, message: 'Error starting qualification upgrade' });
  }
});

// GET /api/onboarding/student/:studentId - Get onboarding data for specific student (staff)
router.get('/student/:studentId', auth, async (req, res) => {
  try {
    const { studentId } = req.params;
    const sid = parseInt(studentId, 10);
    if (Number.isNaN(sid) || sid <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid student id' });
    }

    // Fetch all onboarding data (using user_id as the column name)
    const [statusRows] = await pool.execute(
      'SELECT * FROM student_onboarding_status WHERE user_id = ?',
      [sid]
    );

    const [courseRows] = await pool.execute(
      'SELECT * FROM student_course_selections WHERE user_id = ?',
      [sid]
    );

    const [qualRows] = await pool.execute(
      'SELECT * FROM student_qualification_selections WHERE user_id = ?',
      [sid]
    );

    const [assessRows] = await pool.execute(
      'SELECT * FROM student_initial_assessments WHERE user_id = ?',
      [sid]
    );

    const enrollment_type = await detectEnrollmentType(sid);

    res.json({
      success: true,
      onboarding: {
        status: statusRows[0] || null,
        courseSelection: courseRows[0] || null,
        qualificationSelection: qualRows[0] || null,
        initialAssessment: assessRows[0] || null,
        enrollment_type
      }
    });
  } catch (error) {
    console.error('Error fetching student onboarding:', error);
    res.status(500).json({ success: false, message: 'Error fetching onboarding data' });
  }
});

module.exports = router;
