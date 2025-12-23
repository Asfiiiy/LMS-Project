// backend/cron/logRotation.js
const cron = require('node-cron');
const logger = require('../config/logger');

/**
 * Register log rotation cron job
 * 
 * Moves logs older than 90 days to system_logs_archive table
 * and deletes them from system_logs to prevent database bloat.
 * 
 * Runs daily at 3:00 AM
 * 
 * @param {Object} pool - MySQL connection pool
 */
function registerLogRotation(pool) {
  // Schedule: Every day at 3:00 AM
  cron.schedule('0 3 * * *', async () => {
    try {
      logger.info('[LogRotation] Starting log rotation job...');

      // Get current date minus 90 days
      const archiveDate = new Date();
      archiveDate.setDate(archiveDate.getDate() - 90);

      // Start transaction
      const connection = await pool.getConnection();
      await connection.beginTransaction();

      try {
        // Step 1: Move logs older than 90 days to archive table
        const [archiveResult] = await connection.execute(
          `INSERT INTO system_logs_archive 
           SELECT * FROM system_logs 
           WHERE created_at < ?`,
          [archiveDate]
        );

        const archivedCount = archiveResult.affectedRows || 0;

        // Step 2: Delete archived logs from main table
        const [deleteResult] = await connection.execute(
          `DELETE FROM system_logs 
           WHERE created_at < ?`,
          [archiveDate]
        );

        const deletedCount = deleteResult.affectedRows || 0;

        // Commit transaction
        await connection.commit();

        logger.info(`[LogRotation] Successfully archived ${archivedCount} logs and deleted ${deletedCount} old entries`);

        // Log to console (not to system_logs to avoid recursion)
        console.log(`✅ [LogRotation] Archived ${archivedCount} logs older than 90 days`);
      } catch (err) {
        // Rollback on error
        await connection.rollback();
        throw err;
      } finally {
        connection.release();
      }
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, '[LogRotation] Error during log rotation');
      console.error('❌ [LogRotation] Error:', error.message);
    }
  }, {
    scheduled: true,
    timezone: 'UTC'
  });

  logger.info('[LogRotation] Log rotation cron job registered (runs daily at 3:00 AM UTC)');
  console.log('✅ [LogRotation] Log rotation cron job registered');
}

/**
 * Manually trigger log rotation (for testing or manual runs)
 * 
 * @param {Object} pool - MySQL connection pool
 * @param {number} daysOld - Archive logs older than this many days (default: 90)
 */
async function manualLogRotation(pool, daysOld = 90) {
  try {
    logger.info(`[LogRotation] Starting manual log rotation (archiving logs older than ${daysOld} days)...`);

    const archiveDate = new Date();
    archiveDate.setDate(archiveDate.getDate() - daysOld);

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Move to archive
      const [archiveResult] = await connection.execute(
        `INSERT INTO system_logs_archive 
         SELECT * FROM system_logs 
         WHERE created_at < ?`,
        [archiveDate]
      );

      const archivedCount = archiveResult.affectedRows || 0;

      // Delete from main table
      const [deleteResult] = await connection.execute(
        `DELETE FROM system_logs 
         WHERE created_at < ?`,
        [archiveDate]
      );

      const deletedCount = deleteResult.affectedRows || 0;

      await connection.commit();
      connection.release();

      logger.info(`[LogRotation] Manual rotation complete: archived ${archivedCount}, deleted ${deletedCount}`);
      console.log(`✅ [LogRotation] Manual rotation complete: archived ${archivedCount}, deleted ${deletedCount}`);

      return { archived: archivedCount, deleted: deletedCount };
    } catch (err) {
      await connection.rollback();
      connection.release();
      throw err;
    }
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, '[LogRotation] Error during manual log rotation');
    throw error;
  }
}

module.exports = {
  registerLogRotation,
  manualLogRotation
};

