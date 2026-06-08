const jwt = require('jsonwebtoken');
const redis = require('../config/redis');

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
  10: 'Team Member',
  11: 'Certificate Manager',
  12: 'Claim Manager',
  13: 'ManagerStudent',
  14: 'InstituteStudent',
  15: 'Consultation Manager'
};

const auth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader) {
    console.log('[Auth] No Authorization header found');
    return res.status(401).json({ 
      success: false,
      message: 'No authorization header provided. Please log in again.' 
    });
  }

  const token = authHeader.split(' ')[1];
  
  if (!token) {
    console.log('[Auth] No token in Authorization header');
    return res.status(401).json({ 
      success: false,
      message: 'No token provided. Please log in again.' 
    });
  }

  // Check blacklist before verifying (safeRedis: no throw when connection is down / reconnecting)
  const blacklisted = await redis.safeRedis(
    () => redis.get('jwt_blacklist:' + token),
    null
  );
  if (blacklisted) {
    console.log('[Auth] Token invalidated (blacklisted)');
    return res.status(401).json({
      success: false,
      message: 'Token invalidated. Please log in again.'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Add role string to decoded token if role_id exists
    if (decoded.role_id && !decoded.role) {
      decoded.role = rolesMap[decoded.role_id] || 'Unknown';
    }
    
    req.user = decoded;
    // Only log auth verification for non-GET requests or if DEBUG is enabled
    if (req.method !== 'GET' || process.env.DEBUG_AUTH === 'true') {
      console.log('[Auth] Token verified for user:', decoded.id, 'Role:', decoded.role || decoded.role_id);
    }

    // Refresh online presence (fire-and-forget; do not await — must not slow the request)
    if (decoded.id) {
      const presenceKey = `online_user:${decoded.id}`;
      const safeRedis = redis.safeRedis;
      if (typeof safeRedis === 'function') {
        safeRedis(
          () =>
            redis.exists(presenceKey).then((exists) => {
              if (exists) {
                return redis.expire(presenceKey, 120);
              }
              return redis.setex(
                presenceKey,
                120,
                JSON.stringify({
                  userId: decoded.id,
                  userName: decoded.name || decoded.userName || 'User',
                  userRole: decoded.role || rolesMap[decoded.role_id] || 'Unknown',
                  lastSeen: new Date().toISOString(),
                  source: 'api_activity'
                })
              );
            }),
          null
        ).catch(() => {});
      }
    }

    next();
  } catch (err) {
    console.log('[Auth] Token verification failed:', err.message);
    return res.status(401).json({ 
      success: false,
      message: 'Invalid or expired token. Please log in again.',
      error: err.message 
    });
  }
};

module.exports = auth;
