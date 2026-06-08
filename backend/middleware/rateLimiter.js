// backend/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');
const redis = require('../config/redis');
const { RedisStore } = require('rate-limit-redis');
const metrics = require('../utils/metrics');
const jwt = require('jsonwebtoken');

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

redis.on('ready', () => {
  redisAvailable = true;
});

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
          // Fail open: mark Redis unavailable briefly; express-rate-limit uses passOnStoreError
          if (err.message && err.message.includes('max requests limit')) {
            console.warn(`⚠️  Redis limit exceeded, disabling Redis store for ${prefix}`);
          } else {
            console.warn(`⚠️  Redis rate-limit command failed (${prefix}):`, err.message);
          }
          redisAvailable = false;
          setTimeout(() => {
            redisAvailable = true;
          }, 30000);
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

function shouldSkipApiRateLimit(req) {
  // Skip rate limiting for health checks
  if (req.path === '/health' || req.path === '/api/health') {
    return true;
  }

  const orig = req.originalUrl || req.url || '';
  if (orig.startsWith('/api/login') || orig.startsWith('/api/auth/login')) {
    return true;
  }

  try {
    const authHeader = req.headers['authorization'];
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role_id === 1 || decoded.role_id === 2 || decoded.role_id === 5) {
          return true;
        }
      }
    }
  } catch (err) {
    // Token invalid or missing - continue with rate limiting
  }

  if (req.path.startsWith('/api/admin') || req.originalUrl.startsWith('/api/admin')) {
    return true;
  }

  const tutorPaths = [
    '/api/qualification',
    '/api/qualification/submissions',
    '/api/cpd/quiz-attempts/tutor',
    '/api/admin/tutor',
    '/api/staff',
    '/api/tutor'
  ];

  if (tutorPaths.some(path => req.path.startsWith(path) || req.originalUrl.startsWith(path))) {
    return true;
  }

  return false;
}

// Redis-backed store for general API only — created after Redis is ready (avoid
// "Stream isn't writeable and enableOfflineQueue is false" if RedisStore runs before connect).
let apiRedisStore = null;
let apiStoreInitOptions = null;

function tryCreateApiRedisStore() {
  if (apiRedisStore) return;
  try {
    const store = createStore('ratelimit:api:');
    if (store) {
      apiRedisStore = store;
      if (apiStoreInitOptions && typeof apiRedisStore.init === 'function') {
        apiRedisStore.init(apiStoreInitOptions);
      }
    }
  } catch (err) {
    console.warn('⚠️  apiRedisStore creation on ready failed:', err.message);
    apiRedisStore = null;
  }
}

if (redis.status === 'ready') {
  tryCreateApiRedisStore();
} else {
  redis.once('ready', tryCreateApiRedisStore);
}

const dynamicApiStore = {
  init(options) {
    apiStoreInitOptions = options;
    if (apiRedisStore && typeof apiRedisStore.init === 'function') {
      apiRedisStore.init(options);
    }
  },
  increment(key) {
    if (!apiRedisStore) {
      const wm = apiStoreInitOptions?.windowMs || 15 * 60 * 1000;
      return Promise.resolve({
        totalHits: 1,
        resetTime: new Date(Date.now() + wm)
      });
    }
    return Promise.resolve(apiRedisStore.increment(key));
  },
  decrement(key) {
    if (!apiRedisStore) return Promise.resolve();
    return Promise.resolve(apiRedisStore.decrement(key)).then(() => {});
  },
  resetKey(key) {
    if (!apiRedisStore) return Promise.resolve();
    return Promise.resolve(apiRedisStore.resetKey(key)).then(() => {});
  }
};

/**
 * General API rate limiter
 * Skip rate limiting for Admin and Tutor roles (they need unlimited access)
 * Apply rate limiting only for Students and anonymous users
 */
const apiLimiter = rateLimit({
  store: dynamicApiStore,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX || '200', 10),
  passOnStoreError: true, // Redis down/slow: allow traffic (fail open)
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  handler: (req, res) => {
    metrics.recordRateLimitBlock();
    return res.status(429).json({
      success: false,
      error: 'Too many requests. Please slow down.',
      retryAfter: 60
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => shouldSkipApiRateLimit(req)
});

/**
 * Strict limiter for authentication endpoints
 * UPDATED: Increased limit to handle 200-300 concurrent users
 * - 100 login attempts per 15 minutes per IP (allows for retries and multiple devices)
 * - Successful logins don't count (skipSuccessfulRequests: true)
 */
const authLimiter = rateLimit({
  // Memory only: login/refresh/logout must never wait on Upstash (nginx upstream timeouts).
  // Counts are per PM2 worker, not cluster-wide — acceptable for auth.
  store: undefined,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '100', 10), // 100 login attempts per 15 minutes (was 5)
  message: {
    success: false,
    message: 'Too many login attempts, please try again later.'
  },
  handler: (req, res) => {
    metrics.recordRateLimitBlock();
    return res.status(429).json({
      success: false,
      message: 'Too many login attempts, please try again later.'
    });
  },
  skipSuccessfulRequests: true, // Don't count successful requests
  standardHeaders: true,
  legacyHeaders: false
});

const aiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.AI_RATE_LIMIT_MAX || '5', 10),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      error: 'Too many AI requests'
    });
  }
});

module.exports = {
  apiLimiter,
  authLimiter,
  aiRateLimit
};

