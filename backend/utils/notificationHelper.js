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
 * @param {number|null} options.relatedConversationId - Related conversation ID (for chat messages)
 * @param {Object} options.req - Express request object (for Socket.IO)
 * @returns {Promise<number|null>} Notification ID or null if failed
 */
async function createNotification({ userId, type, title, message, relatedUserId = null, relatedCourseId = null, relatedSubmissionId = null, relatedConversationId = null, req = null }) {
  try {
    if (userId == null || userId === '' || (typeof userId === 'number' && isNaN(userId))) {
      return null;
    }
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

    // Check if title column exists
    let hasTitle = false;
    try {
      const [titleColumns] = await pool.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'notifications' 
         AND COLUMN_NAME = 'title'`
      );
      hasTitle = titleColumns.length > 0;
    } catch (err) {
      console.error('[NotificationHelper] Error checking title column:', err);
    }

    // Check if related_course_id, related_submission_id, and related_conversation_id columns exist
    let hasRelatedCourseId = false;
    let hasRelatedSubmissionId = false;
    let hasRelatedConversationId = false;
    try {
      const [columns] = await pool.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'notifications' 
         AND COLUMN_NAME IN ('related_course_id', 'related_submission_id', 'related_conversation_id')`
      );
      hasRelatedCourseId = columns.some(col => col.COLUMN_NAME === 'related_course_id');
      hasRelatedSubmissionId = columns.some(col => col.COLUMN_NAME === 'related_submission_id');
      hasRelatedConversationId = columns.some(col => col.COLUMN_NAME === 'related_conversation_id');
    } catch (err) {
      // Ignore - columns might not exist
    }

    // Build INSERT query based on available columns
    let insertQuery;
    let insertParams;
    
    // Build column list and values based on what exists
    const columns = ['user_id', 'type', 'message'];
    const values = [userId, type, message];
    
    if (hasTitle) {
      columns.push('title');
      values.push(title);
    }
    
    if (hasRelatedUserId) {
      columns.push('related_user_id');
      values.push(relatedUserId);
    }
    
    if (hasRelatedCourseId) {
      columns.push('related_course_id');
      values.push(relatedCourseId);
    }
    
    if (hasRelatedSubmissionId) {
      columns.push('related_submission_id');
      values.push(relatedSubmissionId);
    }
    
    if (hasRelatedConversationId && relatedConversationId) {
      columns.push('related_conversation_id');
      values.push(relatedConversationId);
    }
    
    const placeholders = columns.map(() => '?').join(', ');
    insertQuery = `INSERT INTO notifications (${columns.join(', ')}) VALUES (${placeholders})`;
    insertParams = values;

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
      const notifRow = notifications[0];

      let popupData = {};
      if (type === 'assignment_graded') {
        popupData = {
          isGradePopup: true,
          submissionId: relatedSubmissionId,
          courseId: relatedCourseId,
          result: 'refer',
          isPass: false,
          unitTitle: 'Assignment',
          courseTitle: '',
          feedback: '',
          gradedBy: 'Assessor',
          gradedAt: null
        };
        if (relatedSubmissionId) {
          try {
            const [subData] = await pool.execute(
              `SELECT
                 qs.pass_fail_result,
                 qs.feedback,
                 qs.graded_at,
                 qs.unit_id,
                 u.course_id,
                 u.title as unit_title,
                 c.title as course_title,
                 grader.name as graded_by_name
               FROM qual_submissions qs
               LEFT JOIN units u ON u.id = qs.unit_id
               LEFT JOIN courses c ON c.id = u.course_id
               LEFT JOIN users grader ON grader.id = qs.graded_by
               WHERE qs.id = ?`,
              [relatedSubmissionId]
            );
            if (subData.length > 0) {
              const pf = subData[0].pass_fail_result;
              popupData = {
                isGradePopup: true,
                submissionId: relatedSubmissionId,
                unitId: subData[0].unit_id,
                courseId: subData[0].course_id || relatedCourseId,
                unitTitle: subData[0].unit_title,
                courseTitle: subData[0].course_title,
                result: pf,
                isPass: pf === 'pass',
                feedback: subData[0].feedback || '',
                gradedBy: subData[0].graded_by_name || 'Assessor',
                gradedAt: subData[0].graded_at
              };
            }
          } catch (e) {
            console.warn('[Notification] popup enrich:', e.message);
          }
        }
      }

      io.to(`user_${userId}`).emit('new_notification', {
        ...notifRow,
        ...popupData
      });
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

