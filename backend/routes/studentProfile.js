const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { cacheMiddleware, invalidateCache } = require('../middleware/cache');
const multer = require('multer');
const path = require('path');
const cloudinary = require('../config/cloudinary');

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
      console.log(`[isProfileComplete] Missing field: ${field}, value:`, value, `type:`, typeof value, `stringValue:`, stringValue);
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

// GET /api/student/profile - Get current student's profile
router.get('/profile', auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    // Get user info
    const [userRows] = await pool.execute(
      'SELECT id, name, email FROM users WHERE id = ?',
      [userId]
    );
    
    if (userRows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Get profile
    const [profileRows] = await pool.execute(
      'SELECT * FROM student_profiles WHERE user_id = ?',
      [userId]
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
    res.status(500).json({ success: false, message: 'Error fetching profile' });
  }
});

// PUT /api/student/profile - Update student profile
router.put('/profile', auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    // EXTENSIVE DEBUGGING
    console.log('========================================');
    console.log('[Update Profile] === COMPLETE REQUEST ANALYSIS ===');
    console.log('[Update Profile] Full req.body:', JSON.stringify(req.body, null, 2));
    
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
    
    console.log('[Update Profile] === EXTRACTED VALUES ===');
    console.log('[Update Profile] english_literacy:', english_literacy, 'type:', typeof english_literacy, 'exists:', english_literacy !== undefined);
    console.log('[Update Profile] ict_skills:', ict_skills, 'type:', typeof ict_skills, 'exists:', ict_skills !== undefined);
    console.log('========================================');
    
    // FIXED: Simple normalization that preserves actual values
    const normalizedEnglishLiteracy = english_literacy && String(english_literacy).trim() !== '' ? String(english_literacy).trim() : null;
    const normalizedIctSkills = ict_skills && String(ict_skills).trim() !== '' ? String(ict_skills).trim() : null;
    const normalizedSpecialLearningNeeds = special_learning_needs && String(special_learning_needs).trim() !== '' ? String(special_learning_needs).trim() : null;
    
    console.log('[Update Profile] === NORMALIZED VALUES ===');
    console.log('[Update Profile] normalizedEnglishLiteracy:', normalizedEnglishLiteracy);
    console.log('[Update Profile] normalizedIctSkills:', normalizedIctSkills);
    
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
            userId, gender, date_of_birth, nationality, ethnicity,
            current_role, previous_qualification, motivation,
            vark_visual || 0, vark_auditory || 0, vark_reading || 0, vark_kinesthetic || 0,
            normalizedEnglishLiteracy, normalizedIctSkills, normalizedSpecialLearningNeeds
          ]
        );
        console.log('[Update Profile] INSERT executed with english_literacy:', normalizedEnglishLiteracy, 'ict_skills:', normalizedIctSkills);
      } else {
        // Update existing profile
        console.log('[Update Profile] Executing UPDATE with english_literacy:', normalizedEnglishLiteracy, 'ict_skills:', normalizedIctSkills);
        await connection.execute(
          `UPDATE student_profiles SET
            gender = ?, date_of_birth = ?, nationality = ?, ethnicity = ?,
            \`current_role\` = ?, previous_qualification = ?, motivation = ?,
            vark_visual = ?, vark_auditory = ?, vark_reading = ?, vark_kinesthetic = ?,
            english_literacy = ?, ict_skills = ?, special_learning_needs = ?,
            updated_at = NOW()
          WHERE user_id = ?`,
          [
            gender, date_of_birth, nationality, ethnicity,
            current_role, previous_qualification, motivation,
            vark_visual || 0, vark_auditory || 0, vark_reading || 0, vark_kinesthetic || 0,
            normalizedEnglishLiteracy, normalizedIctSkills, normalizedSpecialLearningNeeds,
            userId
          ]
        );
        console.log('[Update Profile] UPDATE executed successfully');
      }
      
      // Get updated profile
      const [updatedRows] = await connection.execute(
        'SELECT * FROM student_profiles WHERE user_id = ?',
        [userId]
      );
      
      const updatedProfile = updatedRows[0];
      
      // Log saved values for verification
      console.log('[Update Profile] Saved english_literacy:', updatedProfile?.english_literacy);
      console.log('[Update Profile] Saved ict_skills:', updatedProfile?.ict_skills);
      
      // Check if profile is complete
      const profileComplete = isProfileComplete(updatedProfile);
      console.log('[Update Profile] Profile complete check result:', profileComplete);
      
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

// GET /api/student/profile/completion - Get profile completion details with missing fields
router.get('/profile/completion', auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    // Get profile
    const [profileRows] = await pool.execute(
      'SELECT * FROM student_profiles WHERE user_id = ?',
      [userId]
    );
    
    const profile = profileRows.length > 0 ? profileRows[0] : null;
    
    // Debug log the profile data
    if (profile) {
      console.log('[Profile Completion] Profile ict_skills:', profile.ict_skills, 'type:', typeof profile.ict_skills, 'length:', profile.ict_skills?.length);
      console.log('[Profile Completion] Profile english_literacy:', profile.english_literacy, 'type:', typeof profile.english_literacy, 'length:', profile.english_literacy?.length);
    }
    
    // Define required fields with labels
    const requiredFields = [
      { key: 'gender', label: 'Gender' },
      { key: 'date_of_birth', label: 'Date of Birth' },
      { key: 'nationality', label: 'Nationality' },
      { key: 'current_role', label: 'Current Role' },
      { key: 'motivation', label: 'Motivation' },
      { key: 'vark_visual', label: 'VARK Visual Score' },
      { key: 'vark_auditory', label: 'VARK Auditory Score' },
      { key: 'vark_reading', label: 'VARK Reading Score' },
      { key: 'vark_kinesthetic', label: 'VARK Kinesthetic Score' },
      { key: 'english_literacy', label: 'English & Literacy' },
      { key: 'ict_skills', label: 'ICT Skills' }
    ];
    
    // Check which fields are missing
    const missingFields = [];
    let completedFields = 0;
    
    requiredFields.forEach(field => {
      let value = profile ? profile[field.key] : null;
      
      // Convert Buffer to string if needed
      if (Buffer.isBuffer(value)) {
        value = value.toString('utf8');
      } else if (value !== null && value !== undefined) {
        value = String(value);
      }
      
      let isComplete = false;
      
      if (field.key.startsWith('vark_')) {
        const numValue = parseInt(value);
        isComplete = !isNaN(numValue) && numValue >= 0 && numValue <= 20;
      } else {
        const trimmedValue = typeof value === 'string' ? value.trim() : value;
        isComplete = trimmedValue !== null && trimmedValue !== undefined && trimmedValue !== '';
      }
      
      if (!isComplete) {
        console.log(`[Profile Completion] Missing field: ${field.key}, value:`, value);
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
      profile_completed_at: profile?.profile_completed_at || null
    });
  } catch (error) {
    console.error('Error getting profile completion:', error);
    res.status(500).json({ success: false, message: 'Error getting profile completion' });
  }
});

module.exports = router;