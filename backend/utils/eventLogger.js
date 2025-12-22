// backend/utils/eventLogger.js
const pool = require('../config/db');
const logger = require('../config/logger');
const geoip = require('geoip-lite');

// Role ID to role name mapping
const roleIdToName = {
  1: 'admin',
  2: 'tutor',
  3: 'manager',
  4: 'student',
  5: 'moderator'
};

/**
 * Get role name from role_id
 */
function getRoleName(roleId) {
  if (!roleId) return null;
  return roleIdToName[roleId] || null;
}

/**
 * Extract safe fields from request body (exclude passwords, tokens, etc.)
 * Truncate to 2000 chars for safety
 */
function getSafeRequestBody(req, extraBody = null) {
  let bodyData = extraBody || (req?.body || null);
  
  if (!bodyData || typeof bodyData !== 'object') return null;
  
  const safeFields = { ...bodyData };
  // Remove sensitive fields
  delete safeFields.password;
  delete safeFields.password_hash;
  delete safeFields.token;
  delete safeFields.access_token;
  delete safeFields.refresh_token;
  delete safeFields.secret;
  
  const jsonStr = JSON.stringify(safeFields);
  // Truncate to 2000 chars
  return jsonStr.length > 2000 ? jsonStr.substring(0, 2000) + '...' : jsonStr;
}

/**
 * Detect service from endpoint path
 * 
 * @param {string} endpoint - Request endpoint path
 * @returns {string} Service name ('admin', 'auth', 'student', 'cpd', 'qualification', 'system')
 */
function detectService(endpoint) {
  if (!endpoint) return 'system';
  
  const endpointLower = endpoint.toLowerCase();
  
  if (endpointLower.startsWith('/api/auth') || endpointLower.startsWith('/api/login')) {
    return 'auth';
  }
  if (endpointLower.startsWith('/api/admin')) {
    return 'admin';
  }
  if (endpointLower.startsWith('/api/cpd')) {
    return 'cpd';
  }
  if (endpointLower.startsWith('/api/qualification')) {
    return 'qualification';
  }
  if (endpointLower.startsWith('/api/student')) {
    return 'student';
  }
  
  return 'system';
}

/**
 * Clean and normalize IP address
 * Handles IPv6-mapped IPv4 addresses (::ffff:192.168.1.1)
 * 
 * @param {string} ip - IP address
 * @returns {string} Cleaned IP address
 */
function cleanIPAddress(ip) {
  if (!ip) return null;
  
  // Remove IPv6-mapped IPv4 prefix (::ffff:)
  let cleaned = ip.replace(/^::ffff:/i, '');
  
  // Handle IPv6 localhost
  if (cleaned === '::1') {
    cleaned = '127.0.0.1';
  }
  
  // Remove whitespace
  cleaned = cleaned.trim();
  
  return cleaned || null;
}

/**
 * Check if IP is private/localhost
 * 
 * @param {string} ip - IP address
 * @returns {boolean} True if IP is private/localhost
 */
function isPrivateIP(ip) {
  if (!ip) return true;
  
  const cleaned = cleanIPAddress(ip);
  if (!cleaned) return true;
  
  // Localhost
  if (cleaned === '127.0.0.1' || cleaned === 'localhost' || cleaned === '::1') {
    return true;
  }
  
  // Private IP ranges
  // 192.168.0.0/16
  if (/^192\.168\./.test(cleaned)) return true;
  
  // 10.0.0.0/8
  if (/^10\./.test(cleaned)) return true;
  
  // 172.16.0.0/12 (172.16.0.0 to 172.31.255.255)
  const parts = cleaned.split('.');
  if (parts.length === 4) {
    const firstOctet = parseInt(parts[0], 10);
    const secondOctet = parseInt(parts[1], 10);
    if (firstOctet === 172 && secondOctet >= 16 && secondOctet <= 31) {
      return true;
    }
  }
  
  // Link-local IPv6
  if (cleaned.startsWith('fe80:')) return true;
  
  return false;
}

/**
 * Get country information from IP address using geoip-lite
 * 
 * @param {string} ip - IP address
 * @returns {Object} { countryCode, countryName }
 */
function getCountryFromIP(ip) {
  if (!ip) return { countryCode: null, countryName: null };
  
  try {
    const cleaned = cleanIPAddress(ip);
    if (!cleaned) {
      return { countryCode: null, countryName: null };
    }
    
    // Skip private/localhost IPs (they don't have country data)
    if (isPrivateIP(cleaned)) {
      return { countryCode: null, countryName: null };
    }
    
    // Lookup with geoip-lite
    const geo = geoip.lookup(cleaned);
    if (geo && geo.country) {
      return {
        countryCode: geo.country,
        countryName: geo.country // geoip-lite doesn't provide country name, only code
      };
    }
  } catch (err) {
    // Silently fail - geolocation is optional
  }
  
  return { countryCode: null, countryName: null };
}

/**
 * Log a system event to system_logs table
 * 
 * @param {Object} opts
 * @param {number|null} opts.userId - User ID
 * @param {string|null} opts.role - Role name ('admin', 'tutor', 'student', etc.)
 * @param {string} opts.action - Action name (e.g. 'user_login', 'cpd_quiz_submitted')
 * @param {string} [opts.description] - Description of the action
 * @param {number|null} [opts.courseId] - Course ID (for per-course filtering)
 * @param {number|null} [opts.studentId] - Student ID (for per-student filtering)
 * @param {string|null} [opts.service] - Service name ('admin', 'auth', 'student', 'cpd', 'qualification', 'system')
 * @param {Object} [opts.req] - Express request object (optional, to capture IP, UA, endpoint, method, body)
 * @param {Object} [opts.extraBody] - Optional object to merge into request_body even if no req
 */
async function logSystemEvent({ 
  userId = null, 
  role = null, 
  action, 
  description = null, 
  courseId = null,
  studentId = null,
  service = null,
  req = null, 
  extraBody = null 
}) {
  if (!action) {
    logger.warn('[EventLogger] action is required');
    return;
  }

  try {
    let ip_address = null;
    let user_agent = null;
    let endpoint = null;
    let method = null;
    let request_body = null;

    // Capture from req if provided
    let countryCode = null;
    let countryName = null;
    
    // Auto-detect service from endpoint if not provided
    if (!service && req) {
      const detectedEndpoint = req.originalUrl || req.url || null;
      service = detectService(detectedEndpoint);
    }
    
    // Default to 'system' if still no service
    if (!service) {
      service = 'system';
    }
    
    if (req) {
      // Extract IP address with priority: X-Forwarded-For > X-Real-IP > req.ip > connection.remoteAddress
      // X-Forwarded-For can contain multiple IPs (client, proxy1, proxy2), take the first one
      const forwardedFor = req.headers['x-forwarded-for'];
      const realIP = req.headers['x-real-ip'];
      
      if (forwardedFor) {
        // X-Forwarded-For: "client, proxy1, proxy2" - take the first (original client)
        ip_address = forwardedFor.split(',')[0].trim();
      } else if (realIP) {
        ip_address = realIP.trim();
      } else {
        ip_address = req.ip || req.connection?.remoteAddress || null;
      }
      
      // Clean the IP address (remove IPv6 prefixes, normalize)
      if (ip_address) {
        ip_address = cleanIPAddress(ip_address) || ip_address;
      }
      
      user_agent = req.headers['user-agent'] || null;
      endpoint = req.originalUrl || req.url || null;
      method = req.method || null;
      request_body = getSafeRequestBody(req, extraBody);
      
      // Get country from IP address (only for public IPs)
      if (ip_address && !isPrivateIP(ip_address)) {
        const geo = getCountryFromIP(ip_address);
        countryCode = geo.countryCode;
        countryName = geo.countryName;
      }
    } else if (extraBody) {
      request_body = getSafeRequestBody(null, extraBody);
    }

    // If role not provided but req.user exists, try to get it
    if (!role && req?.user) {
      const roleId = req.user.role_id || null;
      role = getRoleName(roleId);
    }
    
    // If userId is provided but role is still null, try to get role and name from userId
    // This is a fallback in case req.user wasn't available
    let userName = null;
    if (userId && !role) {
      try {
        const [users] = await pool.execute('SELECT name, role_id FROM users WHERE id = ?', [userId]);
        if (users.length > 0) {
          userName = users[0].name;
          role = getRoleName(users[0].role_id);
        }
      } catch (err) {
        // Silently fail - role and userName will remain null
      }
    } else if (userId) {
      // Even if role is set, fetch userName for description enhancement
      try {
        const [users] = await pool.execute('SELECT name FROM users WHERE id = ?', [userId]);
        if (users.length > 0) {
          userName = users[0].name;
        }
      } catch (err) {
        // Silently fail
      }
    }

    // Enhance description with user name if available
    let enhancedDescription = description;
    if (userName && description) {
      // Replace role labels at the start with actual user name
      // Examples: "enrolled..." -> "John enrolled..." or "Tutor enrolled..." -> "John enrolled..."
      enhancedDescription = description
        .replace(/^(Tutor|Admin|User|Student|Manager|Moderator)\s+/, `${userName} `)
        .replace(/^User #\d+\s+/, `${userName} `);
    }

    // Insert into system_logs (with new columns: course_id, student_id, service, country_code, country_name)
    // Backward compatible: new columns are NULL if not provided
    await pool.execute(
      `INSERT INTO system_logs
        (user_id, course_id, student_id, service, role, action, description, ip_address, country_code, country_name, user_agent, endpoint, method, request_body, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [userId, courseId, studentId, service, role, action, enhancedDescription, ip_address, countryCode, countryName, user_agent, endpoint, method, request_body]
    );

    // Also log to pino
    logger.info({
      event: 'system_log',
      user_id: userId,
      role,
      action,
      endpoint,
      method
    }, description || action);

  } catch (error) {
    // Never crash the request because of logging
    logger.error({ error: error.message, stack: error.stack }, '[EventLogger] Failed to write system log');
  }
}

module.exports = {
  logSystemEvent,
  getRoleName
};
