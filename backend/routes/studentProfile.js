const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { cacheMiddleware, invalidateCache } = require('../middleware/cache');
const multer = require('multer');
const path = require('path');
const cloudinary = require('../config/cloudinary');
const varkQuestions = require('../data/varkQuestions');

// Configure multer for profile picture uploads (memory storage for Cloudinary)
const profileStorage = multer.memoryStorage();

const profileUpload = multer({
  storage: profileStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, PNG, and WEBP are allowed.'));
    }
  }
});

// Helper function to upload profile picture to Cloudinary
async function uploadProfilePictureToCloudinary(file, userId) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `lms/profiles/${userId}`,
        resource_type: 'image',
        upload_preset: 'lms_public_files',
        transformation: [
          { width: 400, height: 400, crop: 'fill', gravity: 'face' },
          { quality: 'auto', fetch_format: 'auto' }
        ]
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

// Helper function to check if profile is complete
function isProfileComplete(profile) {
  if (!profile) return false;
  
  const requiredFields = [
    'gender',
    'date_of_birth',
    'nationality',
    'ethnicity',
    'current_role',
    'motivation',
    'vark_visual',
    'vark_auditory',
    'vark_reading',
    'vark_kinesthetic',
    'english_literacy',
    'ict_skills'
  ];
  
  for (const field of requiredFields) {
    const value = profile[field];
    // Convert Buffer to string if needed (MySQL sometimes returns strings as Buffers)
    let stringValue = value;
    if (Buffer.isBuffer(value)) {
      stringValue = value.toString('utf8');
    } else if (value !== null && value !== undefined) {
      stringValue = String(value);
    }
    // Check if value is null, undefined, or empty string (also trim whitespace)
    const trimmedValue = typeof stringValue === 'string' ? stringValue.trim() : stringValue;
    if (trimmedValue === null || trimmedValue === undefined || trimmedValue === '') {
      return false;
    }
  }
  
  // Check VARK scores are in valid range (0-20)
  const varkScores = ['vark_visual', 'vark_auditory', 'vark_reading', 'vark_kinesthetic'];
  for (const score of varkScores) {
    const value = parseInt(profile[score]);
    if (isNaN(value) || value < 0 || value > 20) {
      return false;
    }
  }
  
  return true;
}

// Normalize a DB value (Buffer -> string, etc.) for profile/assessment rows
function normalizeValue(val) {
  if (val == null || val === undefined) return null;
  if (Buffer.isBuffer(val)) return val.toString('utf8');
  return String(val);
}

// Merge initial assessment into profile so verified users see data they submitted in onboarding (steps 4–7)
function mergeAssessmentIntoProfile(profile, assessment) {
  if (!assessment) return profile || {};
  const p = profile ? { ...profile } : {};
  const a = assessment;
  const fields = [
    ['gender', 'gender'],
    ['date_of_birth', 'date_of_birth'],
    ['nationality', 'nationality'],
    ['ethnicity', 'ethnicity'],
    ['english_literacy', 'english_literacy'],
    ['ict_skills', 'ict_skills'],
    ['special_learning_needs', 'special_learning_needs']
  ];
  for (const [assessKey, profileKey] of fields) {
    const v = normalizeValue(a[assessKey]);
    const existing = normalizeValue(p[profileKey]);
    if ((existing === null || existing === undefined || String(existing).trim() === '') && v && String(v).trim() !== '') {
      p[profileKey] = v;
    }
  }
  // Map onboarding fields to profile: why_qualification -> motivation, full_name as fallback for current_role
  const motivationVal = normalizeValue(a.why_qualification);
  if ((!p.motivation || String(p.motivation).trim() === '') && motivationVal && String(motivationVal).trim() !== '') {
    p.motivation = motivationVal;
  }
  const currentRoleVal = normalizeValue(p.current_role) || normalizeValue(a.full_name);
  if ((!p.current_role || String(p.current_role).trim() === '') && currentRoleVal && String(currentRoleVal).trim() !== '') {
    p.current_role = currentRoleVal;
  }
  return p;
}

// GET /api/student/profile - Get current student's profile (merged with initial assessment so verified users see all submitted data)
router.get('/profile', auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    // Get user info
    const [userRows] = await pool.execute(
      'SELECT id, name, email, learner_id FROM users WHERE id = ?',
      [userId]
    );
    
    if (userRows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Get profile and initial assessment (onboarding steps 4–7 data)
    const [profileRows] = await pool.execute(
      'SELECT * FROM student_profiles WHERE user_id = ?',
      [userId]
    );
    const [assessmentRows] = await pool.execute(
      'SELECT * FROM student_initial_assessments WHERE user_id = ?',
      [userId]
    );
    
    const profile = profileRows.length > 0 ? profileRows[0] : null;
    const assessment = assessmentRows.length > 0 ? assessmentRows[0] : null;
    const merged = mergeAssessmentIntoProfile(profile, assessment);
    const user = userRows[0];
    // Normalize Buffers and values so JSON response has plain strings
    const safeProfile = {};
    for (const [k, v] of Object.entries(merged)) {
      if (v != null && Buffer.isBuffer(v)) safeProfile[k] = v.toString('utf8');
      else safeProfile[k] = v;
    }
    res.json({
      success: true,
      profile: {
        user_id: user.id,
        name: user.name,
        email: user.email,
        learner_id: user.learner_id,
        ...safeProfile
      }
    });
  } catch (error) {
    console.error('Error fetching student profile:', error);
    res.status(500).json({ success: false, message: 'Error fetching profile' });
  }
});

// GET /api/student/profile/export - GDPR Right to Data Portability (export metadata, no file contents)
router.get('/profile/export', auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const [userRows] = await pool.execute(
      'SELECT id, name, email, learner_id, created_at FROM users WHERE id = ?',
      [userId]
    );
    if (userRows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const [profileRows] = await pool.execute(
      'SELECT * FROM student_profiles WHERE user_id = ?',
      [userId]
    );
    const [assessmentRows] = await pool.execute(
      'SELECT * FROM student_initial_assessments WHERE user_id = ?',
      [userId]
    );

    const profile = profileRows.length > 0 ? profileRows[0] : null;
    const assessment = assessmentRows.length > 0 ? assessmentRows[0] : null;
    const merged = mergeAssessmentIntoProfile(profile, assessment);
    const safeProfile = {};
    for (const [k, v] of Object.entries(merged || {})) {
      if (v != null && Buffer.isBuffer(v)) safeProfile[k] = v.toString('utf8');
      else safeProfile[k] = v;
    }

    const [enrollments] = await pool.execute(
      `SELECT ca.id, ca.course_id, c.title as course_title, ca.status, ca.created_at
       FROM course_assignments ca
       JOIN courses c ON c.id = ca.course_id
       WHERE ca.student_id = ?
       ORDER BY ca.created_at DESC`,
      [userId]
    );

    const [qualSubmissions] = await pool.execute(
      `SELECT qs.id, qs.unit_id, u.title as unit_title, qs.submission_type, qs.file_name, qs.submitted_at, qs.status, qs.pass_fail_result
       FROM qual_submissions qs
       JOIN units u ON u.id = qs.unit_id
       WHERE qs.student_id = ?
       ORDER BY qs.submitted_at DESC`,
      [userId]
    );

    const [assignmentSubmissions] = await pool.execute(
      `SELECT s.id, a.title as assignment_title, s.submitted_at
       FROM assignment_submissions s
       JOIN assignments a ON a.id = s.assignment_id
       WHERE s.student_id = ?`,
      [userId]
    );

    res.json({
      success: true,
      export_date: new Date().toISOString(),
      profile: {
        user_id: userRows[0].id,
        name: userRows[0].name,
        email: userRows[0].email,
        learner_id: userRows[0].learner_id,
        created_at: userRows[0].created_at,
        ...safeProfile
      },
      enrollments: enrollments,
      qualification_submissions: qualSubmissions.map(s => ({
        id: s.id,
        unit_id: s.unit_id,
        unit_title: s.unit_title,
        submission_type: s.submission_type,
        file_name: s.file_name,
        submitted_at: s.submitted_at,
        status: s.status,
        pass_fail_result: s.pass_fail_result
      })),
      assignment_submissions: assignmentSubmissions.map(s => ({
        id: s.id,
        assignment_title: s.assignment_title,
        submitted_at: s.submitted_at
      }))
    });
  } catch (error) {
    console.error('Error exporting profile:', error);
    res.status(500).json({ success: false, message: 'Export failed' });
  }
});

// PUT /api/student/profile - Update student profile
router.put('/profile', auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    // Extract values from req.body
    const {
      gender,
      date_of_birth,
      nationality,
      ethnicity,
      current_role,
      previous_qualification,
      motivation,
      vark_visual,
      vark_auditory,
      vark_reading,
      vark_kinesthetic,
      english_literacy,
      ict_skills,
      special_learning_needs
    } = req.body;

    // FIXED: Simple normalization that preserves actual values
    const normalizedEnglishLiteracy = english_literacy && String(english_literacy).trim() !== '' ? String(english_literacy).trim() : null;
    const normalizedIctSkills = ict_skills && String(ict_skills).trim() !== '' ? String(ict_skills).trim() : null;
    const normalizedSpecialLearningNeeds = special_learning_needs && String(special_learning_needs).trim() !== '' ? String(special_learning_needs).trim() : null;

    // Validate VARK scores (0-20)
    const varkScores = { vark_visual, vark_auditory, vark_reading, vark_kinesthetic };
    for (const [key, value] of Object.entries(varkScores)) {
      const numValue = parseInt(value);
      if (value !== null && value !== undefined && (isNaN(numValue) || numValue < 0 || numValue > 20)) {
        return res.status(400).json({ 
          success: false, 
          message: `${key} must be between 0 and 20` 
        });
      }
    }
    
    // Validate date_of_birth is in the past
    if (date_of_birth) {
      const dob = new Date(date_of_birth);
      const today = new Date();
      if (dob >= today) {
        return res.status(400).json({ 
          success: false, 
          message: 'Date of birth must be in the past' 
        });
      }
    }
    
    // Validate required ethnicity
    const ethnicityTrimmed = ethnicity != null ? String(ethnicity).trim() : '';
    if (!ethnicityTrimmed) {
      return res.status(400).json({
        success: false,
        message: 'Ethnicity is required'
      });
    }
    
    // Check if profile exists
    const [existingRows] = await pool.execute(
      'SELECT * FROM student_profiles WHERE user_id = ?',
      [userId]
    );
    
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      if (existingRows.length === 0) {
        // Create new profile
        await connection.execute(
          `INSERT INTO student_profiles (
            user_id, gender, date_of_birth, nationality, ethnicity,
            \`current_role\`, previous_qualification, motivation,
            vark_visual, vark_auditory, vark_reading, vark_kinesthetic,
            english_literacy, ict_skills, special_learning_needs
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userId, gender, date_of_birth, nationality, ethnicityTrimmed,
            current_role, previous_qualification, motivation,
            vark_visual || 0, vark_auditory || 0, vark_reading || 0, vark_kinesthetic || 0,
            normalizedEnglishLiteracy, normalizedIctSkills, normalizedSpecialLearningNeeds
          ]
        );
      } else {
        // Update existing profile
        await connection.execute(
          `UPDATE student_profiles SET
            gender = ?, date_of_birth = ?, nationality = ?, ethnicity = ?,
            \`current_role\` = ?, previous_qualification = ?, motivation = ?,
            vark_visual = ?, vark_auditory = ?, vark_reading = ?, vark_kinesthetic = ?,
            english_literacy = ?, ict_skills = ?, special_learning_needs = ?,
            updated_at = NOW()
          WHERE user_id = ?`,
          [
            gender, date_of_birth, nationality, ethnicityTrimmed,
            current_role, previous_qualification, motivation,
            vark_visual || 0, vark_auditory || 0, vark_reading || 0, vark_kinesthetic || 0,
            normalizedEnglishLiteracy, normalizedIctSkills, normalizedSpecialLearningNeeds,
            userId
          ]
        );
      }

      // Get updated profile
      const [updatedRows] = await connection.execute(
        'SELECT * FROM student_profiles WHERE user_id = ?',
        [userId]
      );
      
      const updatedProfile = updatedRows[0];

      // Check if profile is complete
      const profileComplete = isProfileComplete(updatedProfile);

      if (profileComplete && !updatedProfile.is_profile_complete) {
        await connection.execute(
          'UPDATE student_profiles SET is_profile_complete = 1, profile_completed_at = NOW() WHERE user_id = ?',
          [userId]
        );
        updatedProfile.is_profile_complete = 1;
      } else if (!profileComplete && updatedProfile.is_profile_complete) {
        await connection.execute(
          'UPDATE student_profiles SET is_profile_complete = 0, profile_completed_at = NULL WHERE user_id = ?',
          [userId]
        );
        updatedProfile.is_profile_complete = 0;
      }
      
      await connection.commit();
      
      // Invalidate cache
      invalidateCache(`/api/student/profile`);
      invalidateCache(`/api/student/profile/status`);
      invalidateCache(`/api/student/profile/completion`);
      
      res.json({
        success: true,
        message: 'Profile updated successfully',
        profile: updatedProfile,
        is_profile_complete: profileComplete
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error updating student profile:', error);
    res.status(500).json({ success: false, message: 'Error updating profile' });
  }
});

// POST /api/student/profile/picture - Upload profile picture to Cloudinary
router.post('/profile/picture', auth, profileUpload.single('picture'), async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    // Get existing profile to check for old picture
    const [existingRows] = await pool.execute(
      'SELECT profile_picture FROM student_profiles WHERE user_id = ?',
      [userId]
    );
    
    // Delete old picture from Cloudinary if exists
    if (existingRows.length > 0 && existingRows[0].profile_picture) {
      const oldPictureUrl = existingRows[0].profile_picture;
      try {
        if (oldPictureUrl.includes('cloudinary.com')) {
          const urlParts = oldPictureUrl.split('/');
          const uploadIndex = urlParts.findIndex(part => part === 'upload');
          if (uploadIndex !== -1 && uploadIndex < urlParts.length - 1) {
            let publicIdParts = urlParts.slice(uploadIndex + 1);
            if (publicIdParts.length > 1 && /^\d+$/.test(publicIdParts[0])) {
              publicIdParts = publicIdParts.slice(1);
            }
            let publicId = publicIdParts.join('/');
            publicId = publicId.replace(/\.[^/.]+$/, '');
            
            cloudinary.uploader.destroy(publicId, { invalidate: true }, (err) => {
              if (err) {
                console.log('Could not delete old profile picture from Cloudinary:', err.message);
              } else {
                console.log('Successfully deleted old profile picture from Cloudinary:', publicId);
              }
            });
          }
        }
      } catch (deleteErr) {
        console.log('Error extracting public_id for deletion:', deleteErr.message);
      }
    }
    
    // Upload new picture to Cloudinary
    const cloudinaryResult = await uploadProfilePictureToCloudinary(req.file, userId);
    const cloudinaryUrl = cloudinaryResult.secure_url;
    
    // Update profile with Cloudinary URL
    if (existingRows.length === 0) {
      await pool.execute(
        'INSERT INTO student_profiles (user_id, profile_picture) VALUES (?, ?)',
        [userId, cloudinaryUrl]
      );
    } else {
      await pool.execute(
        'UPDATE student_profiles SET profile_picture = ?, updated_at = NOW() WHERE user_id = ?',
        [cloudinaryUrl, userId]
      );
    }
    
    // Invalidate cache
    invalidateCache(`/api/student/profile`);
    invalidateCache(`/api/student/profile/status`);
    invalidateCache(`/api/student/profile/completion`);
    
    res.json({
      success: true,
      message: 'Profile picture uploaded successfully',
      picture_path: cloudinaryUrl
    });
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    res.status(500).json({ success: false, message: 'Error uploading profile picture' });
  }
});

// GET /api/student/profile/status - Check profile completion status
router.get('/profile/status', auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    const [rows] = await pool.execute(
      'SELECT is_profile_complete, profile_completed_at FROM student_profiles WHERE user_id = ?',
      [userId]
    );
    
    if (rows.length === 0) {
      return res.json({
        success: true,
        is_complete: false,
        completed_at: null
      });
    }
    
    res.json({
      success: true,
      is_complete: rows[0].is_profile_complete === 1,
      completed_at: rows[0].profile_completed_at
    });
  } catch (error) {
    console.error('Error checking profile status:', error);
    res.status(500).json({ success: false, message: 'Error checking profile status' });
  }
});

// GET /api/student/profile/completion - Get profile completion (uses merged profile + initial assessment so verified users show complete)
router.get('/profile/completion', auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    const [profileRows] = await pool.execute(
      'SELECT * FROM student_profiles WHERE user_id = ?',
      [userId]
    );
    const [assessmentRows] = await pool.execute(
      'SELECT * FROM student_initial_assessments WHERE user_id = ?',
      [userId]
    );
    
    const profile = profileRows.length > 0 ? profileRows[0] : null;
    const assessment = assessmentRows.length > 0 ? assessmentRows[0] : null;
    const profileRaw = profile || {};
    const assessmentRaw = assessment || {};
    const merged = mergeAssessmentIntoProfile(profile, assessment);
    
    // Define required fields with labels
    const requiredFields = [
      { key: 'gender', label: 'Gender' },
      { key: 'date_of_birth', label: 'Date of Birth' },
      { key: 'nationality', label: 'Nationality' },
      { key: 'ethnicity', label: 'Ethnicity' },
      { key: 'current_role', label: 'Current Role' },
      { key: 'motivation', label: 'Motivation' },
      { key: 'vark_visual', label: 'VARK Visual Score' },
      { key: 'vark_auditory', label: 'VARK Auditory Score' },
      { key: 'vark_reading', label: 'VARK Reading Score' },
      { key: 'vark_kinesthetic', label: 'VARK Kinesthetic Score' },
      { key: 'english_literacy', label: 'English & Literacy' },
      { key: 'ict_skills', label: 'ICT Skills' }
    ];
    
    const missingFields = [];
    let completedFields = 0;
    
    requiredFields.forEach(field => {
      let value = merged[field.key];
      value = normalizeValue(value);
      
      let isComplete = false;
      if (field.key.startsWith('vark_')) {
        const numValue = parseInt(value);
        isComplete = !isNaN(numValue) && numValue >= 0 && numValue <= 20;
      } else {
        const trimmedValue = typeof value === 'string' ? value.trim() : value;
        isComplete = trimmedValue !== null && trimmedValue !== undefined && trimmedValue !== '';
      }
      
      if (!isComplete) {
        missingFields.push(field);
      } else {
        completedFields++;
      }
    });
    
    const totalFields = requiredFields.length;
    const completionPercentage = Math.round((completedFields / totalFields) * 100);
    const isComplete = missingFields.length === 0;
    
    res.json({
      success: true,
      is_complete: isComplete,
      completion_percentage: completionPercentage,
      completed_fields: completedFields,
      total_fields: totalFields,
      missing_fields: missingFields,
      profile_completed_at: profileRaw.profile_completed_at || null
    });
  } catch (error) {
    console.error('Error getting profile completion:', error);
    res.status(500).json({ success: false, message: 'Error getting profile completion' });
  }
});

// GET /api/student/profile/vark-questions - Get VARK assessment questions (student only)
router.get('/profile/vark-questions', auth, (req, res) => {
  try {
    res.json({ success: true, questions: varkQuestions });
  } catch (error) {
    console.error('Error getting VARK questions:', error);
    res.status(500).json({ success: false, message: 'Error loading assessment' });
  }
});

// POST /api/student/profile/vark-assessment - Submit VARK assessment and save scores (student only)
router.post('/profile/vark-assessment', auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const { answers } = req.body;
    if (!Array.isArray(answers) || answers.length !== 16) {
      return res.status(400).json({
        success: false,
        message: 'Please answer all 16 questions. Each question must have one option selected (A, B, C, or D).'
      });
    }
    const V = { V: 0, A: 0, R: 0, K: 0 };
    for (let i = 0; i < 16; i++) {
      const q = varkQuestions[i];
      const selectedKey = String(answers[i]).toUpperCase();
      const opt = q.options.find(o => o.key === selectedKey);
      if (!opt) {
        return res.status(400).json({
          success: false,
          message: `Invalid option for question ${i + 1}. Use A, B, C, or D.`
        });
      }
      V[opt.vark] = (V[opt.vark] || 0) + 1;
    }
    const vark_visual = V.V;
    const vark_auditory = V.A;
    const vark_reading = V.R;
    const vark_kinesthetic = V.K;
    const scores = { V: vark_visual, A: vark_auditory, R: vark_reading, K: vark_kinesthetic };
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const maxScore = sorted[0][1];
    const secondScore = sorted[1] ? sorted[1][1] : 0;
    const isMultiModal = (maxScore - secondScore) <= 2;
    const primary = sorted[0][0];
    const resultMessages = {
      V: 'You learn best with diagrams, charts, videos, and visual layouts.',
      A: 'You learn best through discussion, listening, and explanations.',
      R: 'You learn best through reading, writing, and detailed text.',
      K: 'You learn best by doing, practicing, and real-life examples.'
    };
    const primaryMessage = resultMessages[primary];
    const [existing] = await pool.execute('SELECT user_id FROM student_profiles WHERE user_id = ?', [userId]);
    if (existing.length === 0) {
      await pool.execute(
        `INSERT INTO student_profiles (user_id, vark_visual, vark_auditory, vark_reading, vark_kinesthetic)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, vark_visual, vark_auditory, vark_reading, vark_kinesthetic]
      );
    } else {
      await pool.execute(
        `UPDATE student_profiles SET vark_visual = ?, vark_auditory = ?, vark_reading = ?, vark_kinesthetic = ?, updated_at = NOW()
         WHERE user_id = ?`,
        [vark_visual, vark_auditory, vark_reading, vark_kinesthetic, userId]
      );
    }
    invalidateCache('/api/student/profile');
    invalidateCache('/api/student/profile/completion');
    res.json({
      success: true,
      message: 'VARK assessment saved.',
      scores: { vark_visual, vark_auditory, vark_reading, vark_kinesthetic },
      primary,
      isMultiModal,
      primaryMessage,
      resultMessages
    });
  } catch (error) {
    console.error('Error submitting VARK assessment:', error);
    res.status(500).json({ success: false, message: 'Error saving assessment' });
  }
});

module.exports = router;