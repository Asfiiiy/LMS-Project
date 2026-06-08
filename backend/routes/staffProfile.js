const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { cacheMiddleware, invalidateCache } = require('../middleware/cache');
const redis = require('../config/redis');
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
        folder: `lms/staff-profiles/${userId}`,
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

// Create staff_profiles table if it doesn't exist
async function ensureStaffProfilesTable() {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS staff_profiles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL UNIQUE,
      date_of_birth DATE,
      phone VARCHAR(20),
      address TEXT,
      professional_title VARCHAR(255),
      department VARCHAR(255),
      bio TEXT,
      qualifications TEXT,
      specializations TEXT,
      profile_picture VARCHAR(500),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_user_id (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  
  try {
    await pool.execute(createTableSQL);
    console.log('[Staff Profile] staff_profiles table ensured');
  } catch (error) {
    console.error('[Staff Profile] Error creating staff_profiles table:', error);
  }
}

// Initialize table on module load
ensureStaffProfilesTable();

/** Same staff as other dashboards; must include Consultation Manager & Claim Manager */
const STAFF_PROFILE_ALLOWED_ROLES = [
  'Admin',
  'Assessor',
  'Moderator',
  'Operation Manager',
  'Accounts Manager',
  'Admission Manager',
  'Administrative Manager',
  'Team Member',
  'Certificate Manager',
  'Claim Manager',
  'Consultation Manager'
];

// GET /api/staff/profile - Get own staff profile
// Use custom cache key generator that includes user ID to prevent cross-user cache hits
router.get('/profile', auth, cacheMiddleware(60, (req) => {
  const userId = req.user?.id || 'anonymous';
  return `cache:/api/staff/profile:user:${userId}`;
}), async (req, res) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    if (!STAFF_PROFILE_ALLOWED_ROLES.includes(userRole)) {
      return res.status(403).json({ success: false, message: 'Access denied. Staff only.' });
    }
    
    // Get user basic info and profile data - ensure we're getting the correct user's data
    const [rows] = await pool.execute(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role_id,
        sp.date_of_birth,
        sp.phone,
        sp.address,
        sp.professional_title,
        sp.department,
        sp.bio,
        sp.qualifications,
        sp.specializations,
        sp.profile_picture,
        sp.created_at,
        sp.updated_at
      FROM users u
      LEFT JOIN staff_profiles sp ON u.id = sp.user_id
      WHERE u.id = ?
    `, [userId]);
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    const profile = rows[0];
    
    // Log for debugging - verify correct user data is returned
    console.log(`[Staff Profile] Fetched profile for user ID: ${userId}, Role: ${userRole}, Name: ${profile.name}`);
    
    // Format date_of_birth safely
    let formattedDOB = null;
    if (profile.date_of_birth) {
      if (typeof profile.date_of_birth === 'string') {
        formattedDOB = profile.date_of_birth.split('T')[0];
      } else if (profile.date_of_birth instanceof Date) {
        formattedDOB = profile.date_of_birth.toISOString().split('T')[0];
      }
    }
    
    res.json({
      success: true,
      profile: {
        name: profile.name,
        email: profile.email,
        date_of_birth: formattedDOB,
        phone: profile.phone,
        address: profile.address,
        professional_title: profile.professional_title,
        department: profile.department,
        bio: profile.bio,
        qualifications: profile.qualifications,
        specializations: profile.specializations,
        profile_picture: profile.profile_picture,
        created_at: profile.created_at,
        updated_at: profile.updated_at
      }
    });
  } catch (error) {
    console.error('[Staff Profile] Error fetching profile:', error);
    res.status(500).json({ success: false, message: 'Error fetching profile' });
  }
});

// PUT /api/staff/profile - Update own staff profile
router.put('/profile', auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    if (!STAFF_PROFILE_ALLOWED_ROLES.includes(userRole)) {
      return res.status(403).json({ success: false, message: 'Access denied. Staff only.' });
    }
    
    const {
      date_of_birth,
      phone,
      address,
      professional_title,
      department,
      bio,
      qualifications,
      specializations
    } = req.body;
    
    // Check if profile exists
    const [existingRows] = await pool.execute(
      'SELECT id FROM staff_profiles WHERE user_id = ?',
      [userId]
    );
    
    if (existingRows.length === 0) {
      // Create new profile
      await pool.execute(`
        INSERT INTO staff_profiles 
        (user_id, date_of_birth, phone, address, professional_title, department, bio, qualifications, specializations)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        userId,
        date_of_birth || null,
        phone || null,
        address || null,
        professional_title || null,
        department || null,
        bio || null,
        qualifications || null,
        specializations || null
      ]);
    } else {
      // Update existing profile
      await pool.execute(`
        UPDATE staff_profiles 
        SET 
          date_of_birth = ?,
          phone = ?,
          address = ?,
          professional_title = ?,
          department = ?,
          bio = ?,
          qualifications = ?,
          specializations = ?,
          updated_at = NOW()
        WHERE user_id = ?
      `, [
        date_of_birth || null,
        phone || null,
        address || null,
        professional_title || null,
        department || null,
        bio || null,
        qualifications || null,
        specializations || null,
        userId
      ]);
    }
    
    // Invalidate cache for this specific user
    const cacheKey = `cache:/api/staff/profile:user:${userId}`;
    await redis.del(cacheKey).catch(err => console.error('Cache invalidation error:', err));
    
    res.json({
      success: true,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('[Staff Profile] Error updating profile:', error);
    res.status(500).json({ success: false, message: 'Error updating profile' });
  }
});

// POST /api/staff/profile/picture - Upload profile picture
router.post('/profile/picture', auth, profileUpload.single('picture'), async (req, res) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    if (!STAFF_PROFILE_ALLOWED_ROLES.includes(userRole)) {
      return res.status(403).json({ success: false, message: 'Access denied. Staff only.' });
    }
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    // Log for debugging - verify correct user is uploading
    console.log(`[Staff Profile] Uploading picture for user ID: ${userId}, Role: ${userRole}`);
    
    // Get existing profile to check for old picture
    const [existingRows] = await pool.execute(
      'SELECT profile_picture FROM staff_profiles WHERE user_id = ?',
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
        'INSERT INTO staff_profiles (user_id, profile_picture) VALUES (?, ?)',
        [userId, cloudinaryUrl]
      );
    } else {
      await pool.execute(
        'UPDATE staff_profiles SET profile_picture = ?, updated_at = NOW() WHERE user_id = ?',
        [cloudinaryUrl, userId]
      );
    }
    
    // Invalidate cache for this specific user
    const cacheKey = `cache:/api/staff/profile:user:${userId}`;
    await redis.del(cacheKey).catch(err => console.error('Cache invalidation error:', err));
    
    res.json({
      success: true,
      message: 'Profile picture uploaded successfully',
      picture_path: cloudinaryUrl
    });
  } catch (error) {
    console.error('[Staff Profile] Error uploading profile picture:', error);
    res.status(500).json({ success: false, message: 'Error uploading profile picture' });
  }
});

module.exports = router;

