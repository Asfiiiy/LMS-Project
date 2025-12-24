/**
 * =====================================================
 * NOTIFICATIONS API ROUTES
 * =====================================================
 * Real-time notification system for forum activity
 * =====================================================
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');

// GET all notifications for current user
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    // Ensure limit and offset are always valid integers
    const limit = Math.max(1, Math.min(1000, parseInt(req.query.limit, 10) || 50));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

    // Check if notifications table exists and has related_user_id column
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
      console.error('[Notifications] Error checking columns:', err);
    }

    // Build query based on column existence - include profile picture if available
    let query;
    if (hasRelatedUserId) {
      // Get profile picture from student_profiles table
      const profileField = 'sp.profile_picture as related_user_avatar,';
      
      query = `SELECT 
        n.*,
        u.name as related_user_name,
        u.email as related_user_email,
        ${profileField}
        fp.title as post_title
      FROM notifications n
      LEFT JOIN users u ON n.related_user_id = u.id
      LEFT JOIN student_profiles sp ON u.id = sp.user_id
      LEFT JOIN forum_posts fp ON n.related_post_id = fp.id
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC
      LIMIT ? OFFSET ?`;
    } else {
      // Fallback if column doesn't exist yet
      query = `SELECT 
        n.*,
        NULL as related_user_name,
        NULL as related_user_email,
        NULL as related_user_avatar,
        fp.title as post_title
      FROM notifications n
      LEFT JOIN forum_posts fp ON n.related_post_id = fp.id
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC
      LIMIT ? OFFSET ?`;
    }

    // Ensure all parameters are valid integers for MySQL
    const finalLimit = isNaN(limit) ? 50 : Math.max(1, Math.min(1000, Number(limit)));
    const finalOffset = isNaN(offset) ? 0 : Math.max(0, Number(offset));
    const finalUserId = Number(userId);
    
    if (isNaN(finalUserId)) {
      throw new Error('Invalid user ID');
    }
    
    // MySQL LIMIT/OFFSET can be problematic with prepared statements
    // Use template literals for LIMIT/OFFSET to avoid parameter binding issues
    const queryWithLimit = query.replace('LIMIT ? OFFSET ?', `LIMIT ${finalLimit} OFFSET ${finalOffset}`);
    const params = [finalUserId];
    
    console.log('[Notifications] Query:', queryWithLimit);
    console.log('[Notifications] Params:', params);
    console.log('[Notifications] Limit:', finalLimit, 'Offset:', finalOffset);
    
    const [notifications] = await pool.execute(queryWithLimit, params);

    // Get unread count
    const [unreadCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE',
      [userId]
    );

    res.json({
      success: true,
      notifications: notifications,
      unreadCount: unreadCount[0].count
    });
  } catch (error) {
    console.error('[Notifications] Error fetching notifications:', error);
    console.error('[Notifications] Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Error fetching notifications',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET unread count only
router.get('/unread-count', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const [result] = await pool.execute(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE',
      [userId]
    );

    res.json({
      success: true,
      count: result[0].count
    });
  } catch (error) {
    console.error('[Notifications] Error fetching unread count:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching unread count'
    });
  }
});

// MARK notification as read
router.put('/:notificationId/read', auth, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id;

    // Verify notification belongs to user
    const [notifications] = await pool.execute(
      'SELECT id FROM notifications WHERE id = ? AND user_id = ?',
      [notificationId, userId]
    );

    if (notifications.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    await pool.execute(
      'UPDATE notifications SET is_read = TRUE WHERE id = ?',
      [notificationId]
    );

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('[Notifications] Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking notification as read'
    });
  }
});

// MARK ALL notifications as read
router.put('/mark-all-read', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    await pool.execute(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE',
      [userId]
    );

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('[Notifications] Error marking all as read:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking all notifications as read'
    });
  }
});

// DELETE notification
router.delete('/:notificationId', auth, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id;

    // Verify notification belongs to user
    const [notifications] = await pool.execute(
      'SELECT id FROM notifications WHERE id = ? AND user_id = ?',
      [notificationId, userId]
    );

    if (notifications.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    await pool.execute(
      'DELETE FROM notifications WHERE id = ?',
      [notificationId]
    );

    res.json({
      success: true,
      message: 'Notification deleted'
    });
  } catch (error) {
    console.error('[Notifications] Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting notification'
    });
  }
});

module.exports = router;

