// backend/middleware/cache.js
const redis = require('../config/redis');

/**
 * Cache middleware for GET requests
 * @param {number} duration - Cache duration in seconds (default: 300 = 5 minutes)
 * @param {function} keyGenerator - Optional function to generate custom cache key
 */
const cacheMiddleware = (duration = 300, keyGenerator = null) => {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }
    
    // Generate cache key
    const cacheKey = keyGenerator 
      ? keyGenerator(req)
      : `cache:${req.originalUrl}:${JSON.stringify(req.query)}`;
    
    try {
      // Try to get from cache
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        console.log(`✅ Cache HIT: ${cacheKey}`);
        return res.json(JSON.parse(cached));
      }
      
      // Cache miss - intercept response
      const originalJson = res.json.bind(res);
      res.json = (data) => {
        // Store in cache
        redis.setex(cacheKey, duration, JSON.stringify(data))
          .catch(err => console.error('Cache set error:', err));
        
        console.log(`💾 Cache SET: ${cacheKey} (${duration}s)`);
        return originalJson(data);
      };
      
      next();
    } catch (err) {
      console.error('Cache middleware error:', err);
      // Continue without cache if Redis fails
      next();
    }
  };
};

/**
 * Invalidate cache by pattern
 * @param {string} pattern - Redis key pattern (e.g., 'cache:/api/users/*')
 */
const invalidateCache = async (pattern) => {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
      console.log(`🗑️  Invalidated ${keys.length} cache keys: ${pattern}`);
    }
  } catch (err) {
    console.error('Cache invalidation error:', err);
  }
};

/**
 * Clear all cache
 */
const clearAllCache = async () => {
  try {
    const keys = await redis.keys('cache:*');
    if (keys.length > 0) {
      await redis.del(...keys);
      console.log(`🗑️  Cleared ${keys.length} cache entries`);
    }
  } catch (err) {
    console.error('Clear cache error:', err);
  }
};

module.exports = {
  cacheMiddleware,
  invalidateCache,
  clearAllCache
};

