const certificateQueue = require('../queues/certificateQueue');
const certificateGenerator = require('../services/certificateGenerator');
const pool = require('../config/db');

/**
 * Certificate Generation Worker
 * Processes certificate generation jobs in parallel
 * 
 * Usage: node workers/certificateWorker.js
 * Or: pm2 start workers/certificateWorker.js --name certificate-worker
 */

// Process jobs with concurrency (5 workers = 5 certificates at once)
const WORKER_CONCURRENCY = parseInt(process.env.CERTIFICATE_WORKER_CONCURRENCY || '5');

console.log(`🚀 Starting certificate generation worker...`);
console.log(`   Concurrency: ${WORKER_CONCURRENCY} workers`);

// Log Redis connection info (same config as queue)
let redisInfo;
if (process.env.REDIS_URL) {
  const url = new URL(process.env.REDIS_URL);
  redisInfo = `${url.hostname}:${url.port} (TLS: ${url.protocol === 'rediss:' ? 'Yes' : 'No'})`;
} else if (process.env.REDIS_HOST) {
  redisInfo = `${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379} (TLS: Yes)`;
} else {
  redisInfo = 'localhost:6379 (TLS: No)';
}
console.log(`   Redis: ${redisInfo}`);

// Queue connection events
certificateQueue.on('ready', () => {
  console.log('✅ Worker connected to Redis queue successfully');
});

certificateQueue.on('error', (error) => {
  console.error('❌ Worker Redis connection error:', error);
});

certificateQueue.on('waiting', (jobId) => {
  console.log(`📋 Worker sees job ${jobId} waiting in queue`);
});

certificateQueue.process('generate', WORKER_CONCURRENCY, async (job) => {
  const { claimId, studentId, courseId, customData, customRegNumber } = job.data;
  
  console.log(`\n📋 Processing certificate generation job:`);
  console.log(`   Job ID: ${job.id}`);
  console.log(`   Claim ID: ${claimId}`);
  console.log(`   Student ID: ${studentId}`);
  console.log(`   Course ID: ${courseId}`);
  console.log(`   Attempt: ${job.attemptsMade + 1}/${job.opts.attempts}`);
  
  try {
    // Update job progress
    await job.progress(10);
    
    // Generate certificate
    const result = await certificateGenerator.generateCPDCertificates(
      claimId,
      studentId,
      courseId,
      customData,
      customRegNumber
    );
    
    // Update job progress
    await job.progress(100);
    
    console.log(`✅ Certificate generated successfully:`);
    console.log(`   Registration: ${result.registrationNumber}`);
    console.log(`   Certificate ID: ${result.generatedCertId}`);
    
    // Return result for queue monitoring
    return {
      success: true,
      claimId,
      registrationNumber: result.registrationNumber,
      generatedCertId: result.generatedCertId,
      message: result.message
    };
    
  } catch (error) {
    console.error(`❌ Certificate generation failed for claim ${claimId}:`, error);
    
    // Update database to mark as failed
    try {
      await pool.execute(
        `UPDATE generated_certificates 
         SET status = 'failed',
             error_message = ?
         WHERE claim_id = ?`,
        [error.message, claimId]
      );
    } catch (dbError) {
      console.error('Failed to update database:', dbError);
    }
    
    // Throw error to trigger retry
    throw error;
  }
});

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Shutting down certificate worker gracefully...');
  await certificateQueue.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 Shutting down certificate worker gracefully...');
  await certificateQueue.close();
  process.exit(0);
});

console.log(`✅ Certificate worker started successfully!`);
console.log(`   Waiting for jobs...\n`);

// Keep process alive
setInterval(() => {
  // Heartbeat - process stays alive
}, 60000);

