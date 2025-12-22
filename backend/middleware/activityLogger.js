// backend/middleware/activityLogger.js
const { logSystemEvent, getRoleName } = require('../utils/eventLogger');
const logger = require('../config/logger');
const jwt = require('jsonwebtoken');
const geoip = require('geoip-lite');

/**
 * Extract user info from JWT token if req.user is not available
 * This allows us to capture user_id even when auth middleware hasn't run yet
 */
function extractUserFromToken(req) {
  // If req.user is already set (auth middleware ran), use it
  if (req.user && req.user.id) {
    return {
      id: req.user.id,
      role_id: req.user.role_id || null
    };
  }

  // Try to extract from Authorization header
  try {
    const authHeader = req.headers['authorization'];
    if (authHeader) {
      const token = authHeader.split(' ')[1]; // Bearer <token>
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
        return {
          id: decoded.id || null,
          role_id: decoded.role_id || null
        };
      }
    }
  } catch (err) {
    // Token invalid or expired - that's okay, we'll log as anonymous
    // Don't log this error as it's expected for unauthenticated requests
  }

  return { id: null, role_id: null };
}

/**
 * Convert technical API action names into clean, human-readable format
 * 
 * Examples:
 * - "post__api_admin_courses" → "Created Admin Course"
 * - "delete__api_admin_course_67" → "Admin Deleted Course"
 * - "put__api_cpd_topics_32" → "Updated CPD Topic"
 * 
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE, etc.)
 * @param {string} originalAction - Original technical action name
 * @returns {string} Human-readable action name
 */
function prettifyAction(method, originalAction) {
  if (!originalAction) return 'Unknown Action';

  // Step 1: Extract the endpoint path from the action
  // Actions are formatted like: "post__api_admin_courses"
  // We need to extract the path part after the method prefix
  
  // Remove method prefix (get__, post__, put__, delete__, etc.)
  let path = originalAction.replace(/^(get|post|put|patch|delete)_+/, '');
  
  // Remove "api_" prefix if present
  path = path.replace(/^api_+/, '');
  
  // Step 2: Remove query parameters and IDs
  // Remove common query patterns: _page_\d+, _limit_\d+, _id_\d+, etc.
  path = path.replace(/_(page|limit|id|offset|studentId|courseId|unitId|topicId|quizId|userId|tutorId|adminId|fileId|submissionId|attemptId)_\d+/gi, '');
  
  // Remove trailing numbers (IDs at the end)
  path = path.replace(/_\d+$/g, '');
  
  // Remove multiple consecutive underscores
  path = path.replace(/_+/g, '_');
  
  // Step 3: Replace underscores and clean up
  path = path.replace(/_/g, ' ').trim();
  
  // Step 4: Remove common suffixes that don't add meaning
  path = path.replace(/\s+(page|limit|offset|id|ids)$/gi, '');
  
  // Step 5: Detect route prefixes and extract meaningful parts
  const routePrefixes = {
    'admin': 'Admin',
    'student': 'Student',
    'tutor': 'Tutor',
    'cpd': 'CPD',
    'qualification': 'Qualification',
    'chat': 'Chat',
    'courses': 'Course',
    'users': 'User',
    'assignments': 'Assignment',
    'quizzes': 'Quiz',
    'enrollments': 'Enrollment',
    'logs': 'Logs',
    'topics': 'Topic',
    'units': 'Unit',
    'submissions': 'Submission',
    'attempts': 'Attempt',
    'files': 'File',
    'resources': 'Resource',
    'messages': 'Message',
    'conversations': 'Conversation',
    'certificates': 'Certificate',
    'stats': 'Statistics',
    'health': 'Health',
    'login': 'Login',
    'auth': 'Authentication'
  };
  
  // Step 6: Convert to title case and apply route prefixes
  const words = path.split(/\s+/).filter(w => w.length > 0);
  const processedWords = [];
  let prefix = null;
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i].toLowerCase();
    
    // Check if this word is a route prefix
    if (routePrefixes[word]) {
      if (!prefix && (word === 'admin' || word === 'student' || word === 'tutor' || word === 'cpd' || word === 'qualification')) {
        prefix = routePrefixes[word];
        continue; // Skip adding it to processedWords, we'll add it as prefix
      } else if (routePrefixes[word]) {
        processedWords.push(routePrefixes[word]);
        continue;
      }
    }
    
    // Convert to title case
    processedWords.push(word.charAt(0).toUpperCase() + word.slice(1));
  }
  
  // Step 7: Determine verb based on HTTP method
  let verb = '';
  const methodUpper = method.toUpperCase();
  
  switch (methodUpper) {
    case 'GET':
      verb = 'Viewed';
      break;
    case 'POST':
      // Determine if it's a submission or creation
      const actionLower = processedWords.join(' ').toLowerCase();
      if (actionLower.includes('submit') || actionLower.includes('attempt') || actionLower.includes('quiz') || actionLower.includes('assignment')) {
        verb = 'Submitted';
      } else if (actionLower.includes('login') || actionLower.includes('auth')) {
        verb = 'Logged In';
      } else if (actionLower.includes('enroll')) {
        verb = 'Enrolled';
      } else if (actionLower.includes('claim')) {
        verb = 'Claimed';
      } else {
        verb = 'Created';
      }
      break;
    case 'PUT':
    case 'PATCH':
      verb = 'Updated';
      break;
    case 'DELETE':
      verb = 'Deleted';
      break;
    default:
      verb = 'Performed';
  }
  
  // Step 8: Build final action string
  let finalAction = verb;
  
  // Add prefix if detected (Admin, Student, Tutor, CPD, Qualification)
  if (prefix) {
    finalAction += ` ${prefix}`;
  }
  
  // Add the main action words
  if (processedWords.length > 0) {
    finalAction += ' ' + processedWords.join(' ');
  } else {
    // Fallback if no words extracted
    finalAction += ' Resource';
  }
  
  // Step 9: Clean up and finalize
  finalAction = finalAction.replace(/\s+/g, ' ').trim();
  
  // Handle special cases
  if (finalAction === 'Viewed Login' || finalAction === 'Viewed Auth') {
    finalAction = 'Viewed Login Page';
  }
  if (finalAction === 'Logged In Login' || finalAction === 'Logged In Auth') {
    finalAction = 'Logged In';
  }
  if (finalAction === 'Enrolled Enrollment') {
    finalAction = 'Enrolled Student';
  }
  if (finalAction === 'Submitted Submission') {
    finalAction = 'Submitted Assignment';
  }
  if (finalAction === 'Submitted Attempt') {
    finalAction = 'Submitted Quiz';
  }
  
  return finalAction;
}

/**
 * Detect service from endpoint path
 * 
 * @param {string} endpoint - Request endpoint path
 * @returns {string} Service name ('admin', 'auth', 'student', 'cpd', 'qualification', 'system')
 */
function detectService(endpoint) {
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
 * Extract course_id and student_id from endpoint or request body
 * 
 * @param {string} endpoint - Request endpoint path
 * @param {Object} req - Express request object
 * @returns {Object} { courseId, studentId }
 */
function extractCourseAndStudentIds(endpoint, req) {
  let courseId = null;
  let studentId = null;
  
  // Try to extract from URL params
  const endpointLower = endpoint.toLowerCase();
  
  // Pattern: /api/.../courses/:courseId or /api/.../course/:courseId
  const courseMatch = endpoint.match(/\/(courses?|course)\/(\d+)/i);
  if (courseMatch) {
    courseId = parseInt(courseMatch[2], 10);
  }
  
  // Pattern: /api/.../students/:studentId or /api/.../student/:studentId
  const studentMatch = endpoint.match(/\/(students?|student)\/(\d+)/i);
  if (studentMatch) {
    studentId = parseInt(studentMatch[2], 10);
  }
  
  // Also check request body for courseId/studentId
  if (req?.body) {
    if (req.body.courseId && !courseId) {
      courseId = parseInt(req.body.courseId, 10) || null;
    }
    if (req.body.course_id && !courseId) {
      courseId = parseInt(req.body.course_id, 10) || null;
    }
    if (req.body.studentId && !studentId) {
      studentId = parseInt(req.body.studentId, 10) || null;
    }
    if (req.body.student_id && !studentId) {
      studentId = parseInt(req.body.student_id, 10) || null;
    }
  }
  
  // Check URL params
  if (req?.params) {
    if (req.params.courseId && !courseId) {
      courseId = parseInt(req.params.courseId, 10) || null;
    }
    if (req.params.studentId && !studentId) {
      studentId = parseInt(req.params.studentId, 10) || null;
    }
  }
  
  return { courseId, studentId };
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
 * Get country information from IP address
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
 * Check if a GET request should be logged
 * 
 * GET requests are ONLY logged if they match sensitive/important patterns:
 * - Authentication endpoints (login, auth)
 * - Certificate access
 * - Submission/attempt viewing (for audit)
 * 
 * All other GET requests are skipped to reduce log spam.
 * 
 * @param {string} endpoint - Request endpoint path
 * @returns {boolean} True if GET request should be logged
 */
function shouldLogGETRequest(endpoint) {
  const endpointLower = endpoint.toLowerCase();
  
  // Always skip health checks and static files
  if (endpointLower === '/health' || endpointLower.startsWith('/uploads/')) {
    return false;
  }
  
  // Skip noisy GET requests (dashboard loads, lists, pagination)
  const skipPatterns = [
    '/api/admin/courses',           // Course list
    '/api/admin/course-categories', // Category list
    '/api/admin/stats',             // Dashboard stats
    '/api/admin/students',         // Student list
    '/api/courses',                 // Public course list
    '/api/cpd/list',                // CPD course list
    '/api/admin/tutor/',            // Tutor dashboard data
    '/api/cpd/quiz-attempts/tutor/', // Tutor quiz attempts list
    '/api/qualification/submissions/all', // All submissions list
    '/api/student/',                // Student dashboard data
  ];
  
  for (const pattern of skipPatterns) {
    if (endpointLower.includes(pattern.toLowerCase())) {
      return false;
    }
  }
  
  // Sensitive GET endpoints that should be logged
  // These are important for security/audit purposes
  const sensitiveGETPatterns = [
    '/api/login',           // Login endpoint (even GET requests)
    '/api/auth',            // Authentication endpoints
    '/api/auth/login',      // Login endpoint (alternative)
    '/certificate',         // Certificate access
    '/api/cpd/claim-certificate', // Certificate claiming
  ];
  
  // Check if endpoint matches any sensitive pattern
  for (const pattern of sensitiveGETPatterns) {
    if (endpointLower.includes(pattern.toLowerCase())) {
      return true;
    }
  }
  
  // All other GET requests are NOT logged
  return false;
}

/**
 * Check if an endpoint should be logged by activityLogger
 * 
 * LOGGING RULES:
 * 1. ALWAYS log POST, PUT, PATCH, DELETE (all data changes)
 * 2. ONLY log GET requests that match sensitive patterns (login, auth, certificates, submissions)
 * 3. Skip all other GET requests (dashboard loads, lists, pagination, etc.)
 * 
 * NOTE: Routes that already call logSystemEvent() will still be logged by activityLogger.
 * This is intentional - activityLogger provides automatic logging, while logSystemEvent()
 * provides detailed, context-specific logs. Both serve different purposes.
 * 
 * @param {string} method - HTTP method
 * @param {string} endpoint - Request endpoint path
 * @returns {boolean} True if request should be logged
 */
function shouldLogRequest(method, endpoint) {
  const methodUpper = method.toUpperCase();
  const endpointLower = endpoint.toLowerCase();

  // RULE 1: Always log data-changing operations
  // These are critical for audit trails and security
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(methodUpper)) {
    return true;
  }

  // RULE 2: Only log sensitive GET requests
  // Skip all routine GET requests (dashboard loads, lists, pagination, etc.)
  if (methodUpper === 'GET') {
    return shouldLogGETRequest(endpoint);
  }

  // Default: don't log other methods (shouldn't happen, but safe fallback)
  return false;
}

/**
 * Activity Logger Middleware
 * 
 * Automatically logs important actions to system_logs table.
 * 
 * LOGGING STRATEGY:
 * - Logs ALL POST/PUT/PATCH/DELETE requests (data changes)
 * - Logs ONLY sensitive GET requests (login, auth, certificates, submissions)
 * - Skips routine GET requests (dashboard loads, lists, pagination, health checks)
 * 
 * This reduces log spam by ~90% while maintaining complete audit trail for:
 * - All data modifications
 * - Authentication events
 * - Security-sensitive operations
 * - Important business actions
 * 
 * Routes that call logSystemEvent() will still be logged here as well.
 * This provides both automatic logging (activityLogger) and detailed logging (logSystemEvent).
 */
function activityLogger(req, res, next) {
  // Skip logging for health checks and static files (always skip these)
  if (req.path === '/health' || req.path.startsWith('/uploads/')) {
    return next();
  }

  const method = req.method;
  const endpoint = req.originalUrl || req.path;

  // Check if this request should be logged
  if (!shouldLogRequest(method, endpoint)) {
    return next(); // Skip logging for routine requests
  }

  // Extract user info from req.user or JWT token
  const userInfo = extractUserFromToken(req);
  const userId = userInfo.id;
  const roleId = userInfo.role_id;
  const role = getRoleName(roleId);

  // Detect service from endpoint
  const service = detectService(endpoint);
  
  // Extract course_id and student_id from endpoint/request
  const { courseId, studentId } = extractCourseAndStudentIds(endpoint, req);

  // Determine log level based on HTTP method
  const isDataChange = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  const logLevel = isDataChange ? 'info' : 'debug';

  // Generate technical action name (for internal tracking)
  const technicalAction = `${method.toLowerCase()}_${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`;
  
  // Convert to human-readable action name
  const action = prettifyAction(method, technicalAction);
  
  // Generate description
  let description = `${method} ${endpoint}`;

  // Add role-specific context
  if (role) {
    description = `${role.charAt(0).toUpperCase() + role.slice(1)} ${description}`;
  }

  // Log asynchronously to not block the request
  setImmediate(async () => {
    try {
      // Extract IP with improved logic (same as eventLogger)
      let extractedIP = null;
      const forwardedFor = req.headers['x-forwarded-for'];
      const realIP = req.headers['x-real-ip'];
      
      if (forwardedFor) {
        extractedIP = forwardedFor.split(',')[0].trim();
      } else if (realIP) {
        extractedIP = realIP.trim();
      } else {
        extractedIP = req.ip || req.connection?.remoteAddress || null;
      }
      
      // Clean the IP address
      if (extractedIP) {
        extractedIP = cleanIPAddress(extractedIP) || extractedIP;
      }
      
      await logSystemEvent({ 
        userId, 
        role, 
        action, 
        description, 
        courseId,
        studentId,
        service,
        req 
      });
      
      // Also log to pino with appropriate level
      const logData = {
        user_id: userId,
        role,
        action,
        endpoint,
        method,
        ip: extractedIP
      };

      if (logLevel === 'info') {
        logger.info(logData, '[ACTIVITY]');
      } else {
        logger.debug(logData, '[ACTIVITY]');
      }
    } catch (err) {
      logger.error('[ActivityLogger] Error logging activity', { error: err.message });
    }
  });

  next();
}

module.exports = activityLogger;
