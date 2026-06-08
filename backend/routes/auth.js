const express = require('express');
const pool = require('../config/db'); // MySQL pool
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const redis = require('../config/redis');
const { loginValidation, handleValidationErrors } = require('../middleware/validateInput');
const router = express.Router();
const metrics = require('../utils/metrics');
const { logSystemEvent, getRoleName } = require('../utils/eventLogger');
const { findUserForLogin } = require('../utils/emailLoginLookup');

// Map role IDs to role names
const rolesMap = {
  1: 'Admin',
  2: 'Assessor',
  3: 'Manager',
  4: 'Student',
  5: 'Moderator',
  6: 'Operation Manager',
  7: 'Accounts Manager',
  8: 'Administrative Manager',
  9: 'Admission Manager',
  10: 'Team Member',  // Operation Manager team: tickets only, no tutor/forum/admin
  11: 'Certificate Manager',
  12: 'Claim Manager',
  13: 'ManagerStudent',
  14: 'InstituteStudent',
  15: 'Consultation Manager'
};

router.post('/', loginValidation, handleValidationErrors, async (req, res) => {
  const { email, password } = req.body;

  const loginTimeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(503).json({
        success: false,
        error:
          'Login is taking longer than expected. Please try again in a moment.',
        code: 'LOGIN_TIMEOUT'
      });
    }
  }, 8000);

  try {
    // Exact match, then Gmail/GoogleMail dot- and plus-tag–insensitive match
    const user = await findUserForLogin(pool, email);

    if (!user) {
      if (res.headersSent) return;
      metrics.recordLoginFailure();
      // Log failed login attempt
      setImmediate(() => {
        Promise.resolve(
          logSystemEvent({
            userId: null,
            role: null,
            action: 'user_login_failed',
            description: `Failed login attempt for email: ${email}`,
            req
          })
        ).catch((e) =>
          console.error('[Auth] logSystemEvent (login failed):', e.message)
        );
      });
      clearTimeout(loginTimeout);
      return res.json({ success: false, message: 'Invalid credentials' });
    }

    // Compare password
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      if (res.headersSent) return;
      metrics.recordLoginFailure();
      // Log failed login attempt
      setImmediate(() => {
        Promise.resolve(
          logSystemEvent({
            userId: user.id,
            role: getRoleName(user.role_id),
            action: 'user_login_failed',
            description: `Failed login attempt for user ID: ${user.id}`,
            req
          })
        ).catch((e) =>
          console.error('[Auth] logSystemEvent (login failed):', e.message)
        );
      });
      clearTimeout(loginTimeout);
      return res.json({ success: false, message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, role_id: user.role_id, role: rolesMap[user.role_id] || 'Unknown' },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // Log successful login
    setImmediate(() => {
      Promise.resolve(
        logSystemEvent({
          userId: user.id,
          role: getRoleName(user.role_id),
          action: 'user_login',
          description: `User logged in successfully: ${user.name} (${rolesMap[user.role_id]})`,
          req
        })
      ).catch((e) =>
        console.error('[Auth] logSystemEvent (user_login):', e.message)
      );
    });

    // Check profile completion status for students
    let isProfileComplete = null;
    if (rolesMap[user.role_id] === 'Student' || rolesMap[user.role_id] === 'ManagerStudent' || rolesMap[user.role_id] === 'InstituteStudent') {
      try {
        const [profileRows] = await pool.execute(
          'SELECT is_profile_complete FROM student_profiles WHERE user_id = ?',
          [user.id]
        );
        isProfileComplete = profileRows.length > 0 ? profileRows[0].is_profile_complete === 1 : false;
      } catch (profileErr) {
        console.error('Error checking profile status:', profileErr);
        isProfileComplete = false;
      }
    }

    if (res.headersSent) return;
    clearTimeout(loginTimeout);
    return res.json({
      success: true,
      user: { 
        id: user.id, 
        name: user.name, 
        role: rolesMap[user.role_id] || 'Unknown'
      },
      token,
      is_profile_complete: isProfileComplete
    });
  } catch (err) {
    clearTimeout(loginTimeout);
    console.error('Login error:', err);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: 'Server error' });
    }
  }
});

// ----------------------
// Token Refresh route
// ----------------------
router.post('/refresh', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    
    if (!authHeader) {
      return res.status(401).json({ 
        success: false, 
        message: 'No token provided' 
      });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify the current token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid or expired token' 
      });
    }

    // Fetch fresh user data from database
    const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [decoded.id]);
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Generate new token with extended expiration
    const newToken = jwt.sign(
      { 
        id: user.id, 
        role_id: user.role_id, 
        role: rolesMap[user.role_id] || 'Unknown',
        name: user.name
      },
      process.env.JWT_SECRET,
      { expiresIn: '30m' } // 30 minutes
    );

    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Token refreshed for user: ${user.name} (${rolesMap[user.role_id]})`);
    }

    res.json({
      success: true,
      token: newToken,
      message: 'Token refreshed successfully'
    });
  } catch (err) {
    console.error('Token refresh error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during token refresh' 
    });
  }
});

// ----------------------
// Logout route
// ----------------------
router.post('/logout', async (req, res) => {
  try {
    // Get user from token if available
    const authHeader = req.headers['authorization'];
    let userId = null;
    let userRole = null;
    let userName = null;
    let logoutReason = req.body?.reason || 'manual';

    if (authHeader) {
      const token = authHeader.split(' ')[1];
      if (token) {
        // Use decode (not verify) so we can blacklist even expired tokens
        const decoded = jwt.decode(token);
        if (decoded) {
          userId = decoded.id;
          userRole = decoded.role || (decoded.role_id ? getRoleName(decoded.role_id) : null);
          userName = decoded.name || null;
          // Add token to Redis blacklist so it cannot be used until expiry
          if (decoded.exp) {
            const ttl = decoded.exp - Math.floor(Date.now() / 1000);
            if (ttl > 0) {
              try {
                await redis.setex('jwt_blacklist:' + token, ttl, '1');
              } catch (redisErr) {
                console.warn('[Logout] Redis blacklist failed:', redisErr.message);
              }
            }
          }
        }
      }
    }

    // Log logout event if we have user info
    if (userId) {
      setImmediate(() => {
        Promise.resolve(
          logSystemEvent({
            userId: userId,
            role: userRole,
            action: logoutReason === 'inactivity' ? 'user_auto_logout' : 'user_logout',
            description: `User logged out: ${userName || `ID: ${userId}`} (${userRole || 'Unknown'}) - Reason: ${logoutReason}`,
            req
          })
        ).catch((e) =>
          console.error('[Auth] logSystemEvent (logout):', e.message)
        );
      });
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (err) {
    console.error('Logout error:', err);
    // Even if logging fails, return success (logout should always succeed)
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  }
});

module.exports = router;
