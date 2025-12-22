const jwt = require('jsonwebtoken');

// Map role IDs to role names
const rolesMap = {
  1: 'Admin',
  2: 'Tutor',
  3: 'Manager',
  4: 'Student',
  5: 'Moderator'
};

const auth = (req, res, next) => {
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

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
    
    // Add role string to decoded token if role_id exists
    if (decoded.role_id && !decoded.role) {
      decoded.role = rolesMap[decoded.role_id] || 'Unknown';
    }
    
    req.user = decoded;
    // Only log auth verification for non-GET requests or if DEBUG is enabled
    // This reduces log spam from multiple parallel GET requests on page load
    if (req.method !== 'GET' || process.env.DEBUG_AUTH === 'true') {
      console.log('[Auth] Token verified for user:', decoded.id, 'Role:', decoded.role || decoded.role_id);
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
