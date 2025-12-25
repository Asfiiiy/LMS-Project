// backend/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');
const redis = require('../config/redis');
const { RedisStore } = require('rate-limit-redis');
const metrics = require('../utils/metrics');

// Helper to check if Redis is available
let redisAvailable = true;

// Check Redis connection status without ping (reduces Redis usage)
// Only disable if Redis is clearly not connected
// For production with 1k+ active users, Redis is preferred for shared rate limiting
if (redis.status === 'end' || redis.status === 'close' || redis.status === 'error') {
  console.warn('⚠️  Redis not available, using memory store for rate limiting');
  redisAvailable = false;
} else {
  // Redis is connected or connecting - use it for shared rate limiting
  redisAvailable = true;
}

// Simple wrapper to disable Redis if it fails
const createStore = (prefix) => {
  if (!redisAvailable) {
    return undefined; // Use default memory store
  }
  
  try {
    return new RedisStore({
      sendCommand: async (...args) => {
        try {
          return await redis.call(...args);
        } catch (err) {
          // If Redis fails (especially max requests limit), disable it
          if (err.message && err.message.includes('max requests limit')) {
            console.warn(`⚠️  Redis limit exceeded, disabling Redis store for ${prefix}`);
            redisAvailable = false;
          }
          // Throw error to trigger fallback - rate limiter will handle it
          throw err;
        }
      },
      prefix: prefix
    });
  } catch (err) {
    console.warn(`⚠️  Redis store creation failed for ${prefix}, using memory store`);
    redisAvailable = false;
    return undefined;
  }
};

// Create stores (will be undefined if Redis fails)
let apiRedisStore = createStore('ratelimit:api:');
let authRedisStore = createStore('ratelimit:auth:');

/**
 * General API rate limiter
 * Skip rate limiting for Admin and Tutor roles (they need unlimited access)
 * Apply rate limiting only for Students and anonymous users
 */
const apiLimiter = rateLimit({
  store: apiRedisStore, // undefined = use memory store if Redis fails
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX || '1200', 10), // Optimized for 10k-15k active users
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  handler: (req, res) => {
    metrics.recordRateLimitBlock();
    return res.status(429).json({
      success: false,
      message: 'Too many requests, please try again later.'
    });
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    if (req.path === '/health') {
      return true;
    }
    
    // Skip rate limiting for ALL admin routes (admins need unlimited access)
    // This includes: /api/admin/* (all admin management routes)
    if (req.path.startsWith('/api/admin')) {
      return true;
    }
    
    // Skip rate limiting for tutor-specific routes
    // Tutors need unlimited access for:
    // - Grading submissions: /api/qualification/submissions/*
    // - Viewing quiz attempts: /api/cpd/quiz-attempts/tutor/*
    // - Tutor dashboard routes: /api/admin/tutor/*
    const tutorPaths = [
      '/api/qualification/submissions',
      '/api/cpd/quiz-attempts/tutor',
      '/api/admin/tutor'
    ];
    
    if (tutorPaths.some(path => req.path.includes(path))) {
      return true;
    }
    
    // Keep rate limiting for:
    // - Student routes (/api/student/*)
    // - Public course routes (/api/courses/*)
    // - Chat routes (/api/chat/*) - but tutors also use this, so we keep limit high
    // - CPD/Qualification routes (students use these too)
    return false;
  }
  // Using default keyGenerator which properly handles IPv6
});

/**
 * Strict limiter for authentication endpoints
 */
const authLimiter = rateLimit({
  store: authRedisStore, // undefined = use memory store if Redis fails
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per 15 minutes
  message: {
    success: false,
    message: 'Too many login attempts, please try again later.'
  },
  handler: (req, res) => {
    metrics.recordRateLimitBlock();
    return res.status(429).json({
      success: false,
      message: 'Too many requests, please try again later.'
    });
  },
  skipSuccessfulRequests: true, // Don't count successful requests
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  apiLimiter,
  authLimiter
};

