const Queue = require('bull');
require('dotenv').config();

/**
 * Certificate Generation Queue
 * Handles background processing of certificate generation
 * Uses Redis for job storage and coordination
 */
// Build Redis connection configuration for Upstash (same as config/redis.js)
let redisConfig;

if (process.env.REDIS_HOST && process.env.REDIS_PASSWORD && process.env.REDIS_PORT) {
  // Use same config as working Redis connection
  redisConfig = {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD,
    // Upstash requires TLS (same as config/redis.js)
    tls: {
      rejectUnauthorized: false
    },
    // Connection options
    connectTimeout: 10000,
    lazyConnect: false,
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    maxRetriesPerRequest: 3
  };
} else if (process.env.REDIS_URL) {
  // Parse REDIS_URL
  const url = new URL(process.env.REDIS_URL);
  redisConfig = {
    host: url.hostname,
    port: parseInt(url.port) || 6379,
    password: url.password,
    tls: url.protocol === 'rediss:' ? {
      rejectUnauthorized: false
    } : undefined,
    connectTimeout: 10000,
    retryStrategy: (times) => Math.min(times * 50, 2000),
    maxRetriesPerRequest: 3
  };
} else {
  // Fallback to localhost (no TLS)
  redisConfig = {
    host: 'localhost',
    port: 6379
  };
}

console.log(`📦 Initializing certificate queue...`);
const maskedHost = redisConfig.host || 'localhost';
console.log(`   Redis: ${maskedHost}:${redisConfig.port}`);
console.log(`   TLS: ${redisConfig.tls ? 'Enabled (Upstash)' : 'Disabled (Local)'}`);

const certificateQueue = new Queue('certificate-generation', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3, // Retry failed jobs 3 times
    backoff: {
      type: 'exponential', // Exponential backoff: 2s, 4s, 8s
      delay: 2000
    },
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
      count: 1000 // Keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 86400 // Keep failed jobs for 24 hours
    }
  },
  settings: {
    maxStalledCount: 1, // Mark job as failed if it stalls
    retryProcessDelay: 5000 // Wait 5s before retrying failed job
  }
});

// Queue connection event listeners
certificateQueue.on('ready', () => {
  console.log('✅ Certificate queue connected to Redis successfully');
});

certificateQueue.on('error', (error) => {
  console.error('❌ Certificate queue Redis error:', error.message);
  // Don't spam logs - only log unique errors
  if (error.code !== 'ECONNRESET') {
    console.error('   Full error:', error);
  }
});

// Handle connection close
certificateQueue.on('close', () => {
  console.warn('⚠️  Certificate queue Redis connection closed');
});

// Handle reconnection
certificateQueue.on('reconnecting', () => {
  console.log('🔄 Certificate queue reconnecting to Redis...');
});

certificateQueue.on('waiting', (jobId) => {
  console.log(`📋 Job ${jobId} is waiting in queue`);
});

// Queue event listeners for monitoring
certificateQueue.on('completed', (job, result) => {
  console.log(`✅ Certificate generation completed for claim ${job.data.claimId}`);
  console.log(`   Registration: ${result.registrationNumber}`);
});

certificateQueue.on('failed', (job, err) => {
  console.error(`❌ Certificate generation failed for claim ${job.data.claimId}:`, err.message);
});

certificateQueue.on('stalled', (job) => {
  console.warn(`⚠️  Certificate generation stalled for claim ${job.data.claimId}`);
});

certificateQueue.on('active', (job) => {
  console.log(`🔄 Processing certificate for claim ${job.data.claimId}...`);
});

// Get queue statistics
certificateQueue.getJobCounts = async () => {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    certificateQueue.getWaitingCount(),
    certificateQueue.getActiveCount(),
    certificateQueue.getCompletedCount(),
    certificateQueue.getFailedCount(),
    certificateQueue.getDelayedCount()
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    total: waiting + active + completed + failed + delayed
  };
};

module.exports = certificateQueue;

