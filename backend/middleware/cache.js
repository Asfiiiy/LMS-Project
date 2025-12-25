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
    // Use SCAN instead of KEYS to reduce Redis load (KEYS is blocking and expensive)
    const stream = redis.scanStream({
      match: pattern,
      count: 100
    });
    
    const keys = [];
    stream.on('data', (resultKeys) => {
      keys.push(...resultKeys);
    });
    
    await new Promise((resolve, reject) => {
      stream.on('end', resolve);
      stream.on('error', reject);
    });
    
    if (keys.length > 0) {
      // Delete in batches to avoid overwhelming Redis
      const batchSize = 100;
      for (let i = 0; i < keys.length; i += batchSize) {
        const batch = keys.slice(i, i + batchSize);
        await redis.del(...batch);
      }
      console.log(`🗑️  Invalidated ${keys.length} cache keys: ${pattern}`);
    }
  } catch (err) {
    console.error('Cache invalidation error:', err);
    // Continue without cache if Redis fails
  }
};

/**
 * Clear all cache
 */
const clearAllCache = async () => {
  try {
    // Use SCAN instead of KEYS to reduce Redis load
    const stream = redis.scanStream({
      match: 'cache:*',
      count: 100
    });
    
    const keys = [];
    stream.on('data', (resultKeys) => {
      keys.push(...resultKeys);
    });
    
    await new Promise((resolve, reject) => {
      stream.on('end', resolve);
      stream.on('error', reject);
    });
    
    if (keys.length > 0) {
      // Delete in batches
      const batchSize = 100;
      for (let i = 0; i < keys.length; i += batchSize) {
        const batch = keys.slice(i, i + batchSize);
        await redis.del(...batch);
      }
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

