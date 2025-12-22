// backend/utils/notificationHelper.js
const pool = require('../config/db');

/**
 * Create a notification for a user
 * @param {Object} options
 * @param {number} options.userId - User ID to notify
 * @param {string} options.type - Notification type (e.g., 'assignment_submitted', 'chat_message')
 * @param {string} options.title - Notification title
 * @param {string} options.message - Notification message
 * @param {number|null} options.relatedUserId - Related user ID (e.g., sender of message)
 * @param {number|null} options.relatedCourseId - Related course ID
 * @param {number|null} options.relatedSubmissionId - Related submission ID
 * @param {Object} options.req - Express request object (for Socket.IO)
 * @returns {Promise<number|null>} Notification ID or null if failed
 */
async function createNotification({ userId, type, title, message, relatedUserId = null, relatedCourseId = null, relatedSubmissionId = null, req = null }) {
  try {
    const io = req?.app?.get('io');
    
    // Check if related_user_id column exists
    let hasRelatedUserId = false;
    try {
      const [columns] = await pool.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'notifications' 
         AND COLUMN_NAME = 'related_user_id'`
      );
      hasRelatedUserId = columns.length > 0;
    } catch (err) {
      console.error('[NotificationHelper] Error checking columns:', err);
    }

    // Check if related_course_id and related_submission_id columns exist
    let hasRelatedCourseId = false;
    let hasRelatedSubmissionId = false;
    try {
      const [columns] = await pool.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'notifications' 
         AND COLUMN_NAME IN ('related_course_id', 'related_submission_id')`
      );
      hasRelatedCourseId = columns.some(col => col.COLUMN_NAME === 'related_course_id');
      hasRelatedSubmissionId = columns.some(col => col.COLUMN_NAME === 'related_submission_id');
    } catch (err) {
      // Ignore - columns might not exist
    }

    // Build INSERT query based on available columns
    let insertQuery;
    let insertParams;
    
    if (hasRelatedUserId && hasRelatedCourseId && hasRelatedSubmissionId) {
      insertQuery = `INSERT INTO notifications (user_id, type, title, message, related_user_id, related_course_id, related_submission_id)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`;
      insertParams = [userId, type, title, message, relatedUserId, relatedCourseId, relatedSubmissionId];
    } else if (hasRelatedUserId) {
      insertQuery = `INSERT INTO notifications (user_id, type, title, message, related_user_id)
                     VALUES (?, ?, ?, ?, ?)`;
      insertParams = [userId, type, title, message, relatedUserId];
    } else {
      insertQuery = `INSERT INTO notifications (user_id, type, title, message)
                     VALUES (?, ?, ?, ?)`;
      insertParams = [userId, type, title, message];
    }

    const [result] = await pool.execute(insertQuery, insertParams);

    // Get the created notification
    let selectQuery;
    if (hasRelatedUserId) {
      selectQuery = `SELECT 
        n.*,
        u.name as related_user_name,
        sp.profile_picture as related_user_avatar
      FROM notifications n
      LEFT JOIN users u ON n.related_user_id = u.id
      LEFT JOIN student_profiles sp ON u.id = sp.user_id
      WHERE n.id = ?`;
    } else {
      selectQuery = `SELECT n.* FROM notifications n WHERE n.id = ?`;
    }

    const [notifications] = await pool.execute(selectQuery, [result.insertId]);

    // Emit notification via socket.io to the user's room
    if (io && notifications.length > 0) {
      io.to(`user_${userId}`).emit('new_notification', notifications[0]);
      // Also emit unread count update
      const [unreadCount] = await pool.execute(
        'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE',
        [userId]
      );
      io.to(`user_${userId}`).emit('notification_count_update', { count: unreadCount[0].count });
    }

    return result.insertId;
  } catch (error) {
    console.error('[NotificationHelper] Error creating notification:', error);
    // Don't throw - notifications are non-critical
    return null;
  }
}

module.exports = {
  createNotification
};

