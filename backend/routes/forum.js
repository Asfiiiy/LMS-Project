/**
 * =====================================================
 * FORUM API ROUTES
 * =====================================================
 * Complete forum system with:
 * - Posts (Students, Moderators, Admins can create)
 * - Comments on posts
 * - Nested replies to comments
 * - Likes on posts and comments
 * - Categories
 * =====================================================
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { cacheMiddleware, invalidateCache } = require('../middleware/cache');
const { logSystemEvent } = require('../utils/eventLogger');

// Helper function to create notification and emit via socket
async function createNotification(req, notificationData) {
  try {
    const io = req.app.get('io');
    const { userId, type, title, message, relatedPostId, relatedCommentId, relatedUserId } = notificationData;

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
      console.error('[Forum] Error checking notifications columns:', err);
    }

    // Insert notification into database
    let result;
    if (hasRelatedUserId) {
      [result] = await pool.execute(
        `INSERT INTO notifications (user_id, type, title, message, related_post_id, related_comment_id, related_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, type, title, message, relatedPostId || null, relatedCommentId || null, relatedUserId || null]
      );
    } else {
      // Fallback without related_user_id
      [result] = await pool.execute(
        `INSERT INTO notifications (user_id, type, title, message, related_post_id, related_comment_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, type, title, message, relatedPostId || null, relatedCommentId || null]
      );
    }

    // Get the created notification with related data
    let query;
    if (hasRelatedUserId) {
      query = `SELECT 
        n.*,
        u.name as related_user_name,
        sp.profile_picture as related_user_avatar,
        fp.title as post_title
      FROM notifications n
      LEFT JOIN users u ON n.related_user_id = u.id
      LEFT JOIN student_profiles sp ON u.id = sp.user_id
      LEFT JOIN forum_posts fp ON n.related_post_id = fp.id
      WHERE n.id = ?`;
    } else {
      query = `SELECT 
        n.*,
        NULL as related_user_name,
        fp.title as post_title
      FROM notifications n
      LEFT JOIN forum_posts fp ON n.related_post_id = fp.id
      WHERE n.id = ?`;
    }

    const [notifications] = await pool.execute(query, [result.insertId]);

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
    console.error('[Forum] Error creating notification:', error);
    // Don't throw - notifications are non-critical
    return null;
  }
}

// =====================================================
// CATEGORIES
// =====================================================

// GET all categories
router.get('/categories', cacheMiddleware(300), async (req, res) => {
  try {
    // Try with category_id first (new schema), fallback to forum_id (old schema)
    let [categories] = [];
    try {
      [categories] = await pool.execute(
        `SELECT 
          fc.*,
          COUNT(DISTINCT fp.id) as posts_count
        FROM forum_categories fc
        LEFT JOIN forum_posts fp ON fc.id = fp.category_id
        WHERE fc.is_active = TRUE
        GROUP BY fc.id
        ORDER BY fc.order_index ASC, fc.name ASC`
      );
    } catch (err) {
      // If category_id doesn't exist, try with forum_id (old schema)
      if (err.code === 'ER_BAD_FIELD_ERROR') {
        [categories] = await pool.execute(
          `SELECT 
            fc.*,
            0 as posts_count
          FROM forum_categories fc
          WHERE fc.is_active = TRUE
          ORDER BY fc.order_index ASC, fc.name ASC`
        );
      } else {
        throw err;
      }
    }

    res.json({
      success: true,
      categories: categories
    });
  } catch (error) {
    console.error('[Forum] Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching categories'
    });
  }
});

// =====================================================
// POSTS
// =====================================================

// Optional auth middleware - sets req.user if token present, but doesn't require it
// MUST run BEFORE cacheMiddleware so req.user is available for cache key generation
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader) {
    // No auth header - continue without user
    req.user = null;
    return next();
  }

  const token = authHeader.split(' ')[1];
  
  if (!token) {
    // No token - continue without user
    req.user = null;
    return next();
  }

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
    
    // Map role IDs to role names
    const rolesMap = {
      1: 'Admin',
      2: 'Tutor',
      3: 'Manager',
      4: 'Student',
      5: 'Moderator'
    };
    
    // Add role string to decoded token if role_id exists
    if (decoded.role_id && !decoded.role) {
      decoded.role = rolesMap[decoded.role_id] || 'Unknown';
    }
    
    req.user = decoded;
    // Only log auth verification for non-GET requests or if DEBUG is enabled
    // This reduces log spam from multiple parallel GET requests on page load
    if (req.method !== 'GET' || process.env.DEBUG_AUTH === 'true') {
      console.log('[Auth] Token verified for user:', decoded.id, 'Role:', decoded.role || decoded.role_id);
    }
    next();
  } catch (err) {
    // Token invalid - continue without user (don't fail the request)
    console.log('[Auth] Optional token verification failed:', err.message);
    req.user = null;
    next();
  }
};

// GET all posts (with filters)
// IMPORTANT: optionalAuth must run BEFORE cacheMiddleware so req.user is available for cache key
router.get('/posts', optionalAuth, cacheMiddleware(60, (req) => {
  // Include user ID in cache key if authenticated (so each user gets their own reactions)
  const userId = req.user?.id || 'anonymous';
  return `cache:${req.originalUrl}:${JSON.stringify(req.query)}:user:${userId}`;
}), async (req, res) => {
  try {
    const { category_id, status, search, sort = 'recent', page = 1, limit = 20 } = req.query;
    
    // Ensure limit and offset are always valid integers
    const finalLimit = Math.max(1, Math.min(1000, parseInt(limit, 10) || 20));
    const finalPage = Math.max(1, parseInt(page, 10) || 1);
    const finalOffset = Math.max(0, (finalPage - 1) * finalLimit);

    // Build query - handle both new schema (category_id) and old schema (forum_id)
    // First check if category_id column exists
    let hasCategoryId = false;
    let hasTitle = false;
    try {
      const [columns] = await pool.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'forum_posts'`
      );
      const columnNames = columns.map(c => c.COLUMN_NAME);
      hasCategoryId = columnNames.includes('category_id');
      hasTitle = columnNames.includes('title');
    } catch (err) {
      console.error('[Forum] Error checking columns:', err);
    }

    // Build the category join condition
    const categoryJoin = hasCategoryId 
      ? 'LEFT JOIN forum_categories fc ON fp.category_id = fc.id'
      : 'LEFT JOIN forum_categories fc ON fp.forum_id = fc.id';

    // Get profile picture from student_profiles table (LEFT JOIN)
    // This is where profile pictures are actually stored
    const profileField = 'sp.profile_picture as author_avatar,';

    let query = `
      SELECT 
        fp.*,
        u.id as author_id,
        u.name as author_name,
        u.email as author_email,
        ${profileField}
        CASE 
          WHEN r.name = '00' OR r.name = '0' THEN NULL 
          ELSE r.name 
        END as author_role,
        fc.name as category_name,
        fc.color as category_color,
        fc.icon as category_icon
      FROM forum_posts fp
      INNER JOIN users u ON fp.author_id = u.id
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN student_profiles sp ON u.id = sp.user_id
      ${categoryJoin}
      WHERE 1=1
    `;

    const params = [];

    if (category_id) {
      // Use the appropriate column based on what exists
      if (hasCategoryId) {
        query += ' AND fp.category_id = ?';
        params.push(category_id);
      } else {
        query += ' AND fp.forum_id = ?';
        params.push(category_id);
      }
    }

    // Handle status - try status column first, fallback to is_locked/is_pinned
    if (status === 'locked') {
      query += ' AND (fp.status = "locked" OR fp.is_locked = 1)';
    } else if (status === 'pinned') {
      query += ' AND (fp.status = "pinned" OR fp.is_pinned = 1)';
    } else if (status === 'active') {
      query += ' AND (fp.status = "active" OR (fp.is_locked = 0 AND fp.status IS NULL))';
    }

    if (search) {
      if (hasTitle) {
        query += ' AND (fp.title LIKE ? OR fp.content LIKE ?)';
      } else {
        query += ' AND fp.content LIKE ?';
      }
      if (hasTitle) {
        params.push(`%${search}%`, `%${search}%`);
      } else {
        params.push(`%${search}%`);
      }
    }

    // Check for additional columns
    const [allColumns] = await pool.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'forum_posts'`
    );
    const columnNames = allColumns.map(c => c.COLUMN_NAME);
    const hasIsPinned = columnNames.includes('is_pinned');
    const hasLastActivity = columnNames.includes('last_activity_at');
    const hasViewsCount = columnNames.includes('views_count');
    const hasCommentsCount = columnNames.includes('comments_count');

    // Sorting - handle missing columns gracefully
    switch (sort) {
      case 'recent':
        if (hasIsPinned && hasLastActivity) {
          query += ' ORDER BY fp.is_pinned DESC, fp.last_activity_at DESC';
        } else if (hasLastActivity) {
          query += ' ORDER BY fp.last_activity_at DESC';
        } else {
          query += ' ORDER BY fp.created_at DESC';
        }
        break;
      case 'popular':
        if (hasIsPinned && hasViewsCount && hasCommentsCount) {
          query += ' ORDER BY fp.is_pinned DESC, fp.views_count DESC, fp.comments_count DESC';
        } else if (hasViewsCount) {
          query += ' ORDER BY fp.views_count DESC';
        } else {
          query += ' ORDER BY fp.created_at DESC';
        }
        break;
      case 'most_commented':
        if (hasIsPinned && hasCommentsCount && hasLastActivity) {
          query += ' ORDER BY fp.is_pinned DESC, fp.comments_count DESC, fp.last_activity_at DESC';
        } else if (hasCommentsCount) {
          query += ' ORDER BY fp.comments_count DESC';
        } else {
          query += ' ORDER BY fp.created_at DESC';
        }
        break;
      default:
        if (hasIsPinned) {
          query += ' ORDER BY fp.is_pinned DESC, fp.created_at DESC';
        } else {
          query += ' ORDER BY fp.created_at DESC';
        }
    }

    // MySQL LIMIT/OFFSET can be problematic with prepared statements
    // Use template literals for LIMIT/OFFSET to avoid parameter binding issues
    const queryWithLimit = query.replace('LIMIT ? OFFSET ?', `LIMIT ${finalLimit} OFFSET ${finalOffset}`);

    const [posts] = await pool.execute(queryWithLimit, params);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM forum_posts fp
      WHERE 1=1
    `;
    const countParams = [];

    if (category_id) {
      // Use the appropriate column based on what exists
      if (hasCategoryId) {
        countQuery += ' AND fp.category_id = ?';
        countParams.push(category_id);
      } else {
        countQuery += ' AND fp.forum_id = ?';
        countParams.push(category_id);
      }
    }

    // Handle status - try status column first, fallback to is_locked/is_pinned
    if (status === 'locked') {
      countQuery += ' AND (fp.status = "locked" OR fp.is_locked = 1)';
    } else if (status === 'pinned') {
      countQuery += ' AND (fp.status = "pinned" OR fp.is_pinned = 1)';
    } else if (status === 'active') {
      countQuery += ' AND (fp.status = "active" OR (fp.is_locked = 0 AND fp.status IS NULL))';
    }

    if (search) {
      if (hasTitle) {
        countQuery += ' AND (fp.title LIKE ? OR fp.content LIKE ?)';
        countParams.push(`%${search}%`, `%${search}%`);
      } else {
        countQuery += ' AND fp.content LIKE ?';
        countParams.push(`%${search}%`);
      }
    }

    const [countResult] = await pool.execute(countQuery, countParams);
    const total = countResult[0].total;

    // Get reaction counts for all posts
    const postIds = posts.map(p => p.id);
    let reactionsData = {};
    let userReactions = {};
    
    // Default reaction counts structure (all 7 types with zeros)
    const defaultReactionCounts = {
      like: 0,
      insightful: 0,
      helpful: 0,
      smart_thinking: 0,
      well_done: 0,
      curious: 0,
      excellent: 0
    };
    
    // Initialize reactionsData for all posts with default counts
    postIds.forEach(postId => {
      reactionsData[postId] = { ...defaultReactionCounts };
    });
    
    if (postIds.length > 0) {
      // Check if reaction_type column exists
      const [reactionColumns] = await pool.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'forum_post_likes' 
         AND COLUMN_NAME = 'reaction_type'`
      );
      const hasReactionType = reactionColumns.length > 0;

      if (hasReactionType) {
        // Get reaction counts grouped by post and reaction type
        const [reactions] = await pool.execute(
          `SELECT post_id, reaction_type, COUNT(*) as count 
           FROM forum_post_likes 
           WHERE post_id IN (${postIds.map(() => '?').join(',')})
           GROUP BY post_id, reaction_type`,
          postIds
        );

        // Get user's reactions if authenticated
        if (req.user) {
          // Ensure postIds are integers for proper comparison
          const postIdsInt = postIds.map(id => parseInt(id));
          const userIdInt = parseInt(req.user.id);
          console.log(`[Forum GET] Querying reactions for user ${userIdInt} (type: ${typeof userIdInt}), posts: [${postIdsInt.join(', ')}] (types: ${postIdsInt.map(id => typeof id).join(', ')})`);
          
          const [userReacts] = await pool.execute(
            `SELECT post_id, reaction_type 
             FROM forum_post_likes 
             WHERE post_id IN (${postIdsInt.map(() => '?').join(',')}) AND user_id = ?`,
            [...postIdsInt, userIdInt]
          );
          console.log(`[Forum GET] Found ${userReacts.length} reactions for user ${userIdInt}:`, userReacts);
          
          // Store as string (reaction_type) instead of object
          userReacts.forEach(r => {
            const postIdInt = parseInt(r.post_id);
            if (postIdInt && r.reaction_type) {
              userReactions[postIdInt] = r.reaction_type;
              console.log(`[Forum GET] Stored reaction: post ${postIdInt} (from DB: ${r.post_id}) = "${r.reaction_type}"`);
            }
          });
        } else {
          console.log(`[Forum GET] No user authenticated, skipping reaction query`);
        }

        // Populate actual counts
        reactions.forEach(r => {
          if (r.post_id && r.reaction_type && reactionsData[r.post_id] && reactionsData[r.post_id].hasOwnProperty(r.reaction_type)) {
            reactionsData[r.post_id][r.reaction_type] = parseInt(r.count) || 0;
          }
        });
      }
    }

    // Attach reaction data to posts - ALWAYS return my_reaction and reaction_counts
    const postsWithReactions = posts.map(post => {
      const postReactionCounts = reactionsData[post.id] || { ...defaultReactionCounts };
      // Ensure my_reaction is either a valid non-empty string or null (never empty string)
      let postMyReaction = userReactions[post.id] || null;
      if (postMyReaction && (typeof postMyReaction !== 'string' || postMyReaction.trim() === '')) {
        postMyReaction = null;
      }
      
      // DEBUG: Log reaction data for troubleshooting
      if (req.user) {
        console.log(`[Forum GET] Post ${post.id}: User ${req.user.id}, my_reaction: ${postMyReaction} (type: ${typeof postMyReaction}), userReactions[${post.id}]: ${userReactions[post.id]}, userReactions object:`, userReactions);
      }
      
      return {
        ...post,
        // author_role is already filtered at SQL level (NULL if "00" or "0")
        // Primary fields (always present)
        my_reaction: postMyReaction, // string | null (never empty string)
        reaction_counts: postReactionCounts, // object with all 7 types
        // Backward compatibility fields
        reactions: postReactionCounts, // same as reaction_counts
        user_reaction: postMyReaction ? { [postMyReaction]: true } : null // object for old clients
      };
    });

    res.json({
      success: true,
      posts: postsWithReactions,
      pagination: {
        page: finalPage,
        limit: finalLimit,
        total: total,
        pages: Math.ceil(total / finalLimit)
      }
    });
  } catch (error) {
    console.error('[Forum] Error fetching posts:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching posts'
    });
  }
});

// GET single post with comments
router.get('/posts/:postId', optionalAuth, cacheMiddleware(60, (req) => {
  // Include user ID in cache key if authenticated (so each user gets their own reactions)
  const userId = req.user?.id || 'anonymous';
  return `cache:${req.originalUrl}:user:${userId}`;
}), async (req, res) => {
  try {
    const { postId } = req.params;

    // Check if category_id column exists
    let hasCategoryId = false;
    try {
      const [columns] = await pool.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'forum_posts' 
         AND COLUMN_NAME = 'category_id'`
      );
      hasCategoryId = columns.length > 0;
    } catch (err) {
      console.error('[Forum] Error checking columns:', err);
    }

    const categoryJoin = hasCategoryId 
      ? 'LEFT JOIN forum_categories fc ON fp.category_id = fc.id'
      : 'LEFT JOIN forum_categories fc ON fp.forum_id = fc.id';

    // Get profile picture from student_profiles table (LEFT JOIN)
    // This is where profile pictures are actually stored
    const profileField = 'sp.profile_picture as author_avatar,';

    // Get post details
    const [posts] = await pool.execute(
      `SELECT 
        fp.*,
        u.id as author_id,
        u.name as author_name,
        u.email as author_email,
        ${profileField}
        CASE 
          WHEN r.name = '00' OR r.name = '0' THEN NULL 
          ELSE r.name 
        END as author_role,
        fc.name as category_name,
        fc.color as category_color,
        fc.icon as category_icon
      FROM forum_posts fp
      INNER JOIN users u ON fp.author_id = u.id
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN student_profiles sp ON u.id = sp.user_id
      ${categoryJoin}
      WHERE fp.id = ?`,
      [postId]
    );

    if (posts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Increment views
    await pool.execute(
      'UPDATE forum_posts SET views_count = views_count + 1 WHERE id = ?',
      [postId]
    );

    const post = posts[0];
    post.views_count = (post.views_count || 0) + 1;
    // author_role is already filtered at SQL level (NULL if "00" or "0")

    // Get profile picture from student_profiles table for comments
    const commentProfileField = 'sp.profile_picture as author_avatar,';

    // Get comments with nested replies
    const [comments] = await pool.execute(
      `SELECT 
        fc.*,
        u.id as author_id,
        u.name as author_name,
        u.email as author_email,
        ${commentProfileField}
        CASE 
          WHEN r.name = '00' OR r.name = '0' THEN NULL 
          ELSE r.name 
        END as author_role
      FROM forum_comments fc
      INNER JOIN users u ON fc.author_id = u.id
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN student_profiles sp ON u.id = sp.user_id
      WHERE fc.post_id = ?
      ORDER BY fc.created_at ASC`,
      [postId]
    );

    // Get comment reactions if user is authenticated
    let commentReactions = {};
    let userCommentReactions = {};
    const commentIds = comments.map(c => c.id);
    
    if (commentIds.length > 0 && req.user) {
      // Check if reaction_type column exists
      const [reactionColumns] = await pool.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'forum_comment_likes' 
         AND COLUMN_NAME = 'reaction_type'`
      );
      const hasReactionType = reactionColumns.length > 0;

      if (hasReactionType) {
        const userIdInt = parseInt(req.user.id);
        
        // Get reaction counts grouped by comment and reaction type
        const [reactions] = await pool.execute(
          `SELECT comment_id, reaction_type, COUNT(*) as count 
           FROM forum_comment_likes 
           WHERE comment_id IN (${commentIds.map(() => '?').join(',')})
           GROUP BY comment_id, reaction_type`,
          commentIds
        );

        // Get user's reactions
        const [userReacts] = await pool.execute(
          `SELECT comment_id, reaction_type 
           FROM forum_comment_likes 
           WHERE comment_id IN (${commentIds.map(() => '?').join(',')}) AND user_id = ?`,
          [...commentIds, userIdInt]
        );
        
        // Store user reactions
        userReacts.forEach(r => {
          userCommentReactions[r.comment_id] = r.reaction_type;
        });

        // Initialize all comments with default counts
        const defaultReactionCounts = {
          like: 0,
          insightful: 0,
          helpful: 0,
          smart_thinking: 0,
          well_done: 0,
          curious: 0,
          excellent: 0
        };
        
        commentIds.forEach(cId => {
          commentReactions[cId] = { ...defaultReactionCounts };
        });

        // Populate actual counts
        reactions.forEach(r => {
          if (commentReactions[r.comment_id] && commentReactions[r.comment_id].hasOwnProperty(r.reaction_type)) {
            commentReactions[r.comment_id][r.reaction_type] = parseInt(r.count) || 0;
          }
        });
      }
    }

    // Organize comments into tree structure and attach reaction data
    const commentsMap = new Map();
    const rootComments = [];

    const attachReactions = (comment) => {
      const commentId = comment.id;
      const defaultCounts = {
        like: 0,
        insightful: 0,
        helpful: 0,
        smart_thinking: 0,
        well_done: 0,
        curious: 0,
        excellent: 0
      };
      
      return {
        ...comment,
        my_reaction: userCommentReactions[commentId] || null,
        reaction_counts: commentReactions[commentId] || defaultCounts,
        replies: comment.replies ? comment.replies.map(attachReactions) : []
      };
    };

    comments.forEach(comment => {
      commentsMap.set(comment.id, { ...comment, replies: [] });
    });

    comments.forEach(comment => {
      if (comment.parent_comment_id) {
        const parent = commentsMap.get(comment.parent_comment_id);
        if (parent) {
          parent.replies.push(commentsMap.get(comment.id));
        }
      } else {
        rootComments.push(commentsMap.get(comment.id));
      }
    });

    // Attach reactions to all comments (including nested replies)
    const commentsWithReactions = rootComments.map(attachReactions);

    res.json({
      success: true,
      post: post,
      comments: commentsWithReactions
    });
  } catch (error) {
    console.error('[Forum] Error fetching post:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching post'
    });
  }
});

// CREATE post (Students, Moderators, Admins can create)
router.post('/posts', auth, async (req, res) => {
  try {
    const { category_id, title, content } = req.body;
    const authorId = req.user.id;
    const userRole = req.user.role;

    // Check if user has permission to post
    const allowedRoles = ['Student', 'Moderator', 'Admin', 'Tutor', 'ManagerStudent', 'InstituteStudent'];
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to create posts'
      });
    }

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: 'Title and content are required'
      });
    }

    // Try to insert with category_id, fallback to forum_id if category_id doesn't exist
    let result;
    try {
      [result] = await pool.execute(
        `INSERT INTO forum_posts (category_id, author_id, title, content, last_activity_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [category_id || null, authorId, title, content]
      );
    } catch (err) {
      if (err.code === 'ER_BAD_FIELD_ERROR') {
        // Fallback to forum_id (old schema)
        [result] = await pool.execute(
          `INSERT INTO forum_posts (forum_id, author_id, content, created_at)
           VALUES (?, ?, ?, NOW())`,
          [category_id || null, authorId, content]
        );
      } else {
        throw err;
      }
    }

    const postId = result.insertId;

    // Log event
    setImmediate(async () => {
      await logSystemEvent({
        userId: authorId,
        role: userRole,
        action: 'forum_post_created',
        description: `Created forum post: ${title}`,
        req
      });
    });

    // Invalidate cache
    await invalidateCache('cache:/api/forum/*');

    res.json({
      success: true,
      message: 'Post created successfully',
      postId: postId
    });
  } catch (error) {
    console.error('[Forum] Error creating post:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating post'
    });
  }
});

// UPDATE post (only author or admin/moderator)
router.put('/posts/:postId', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const { title, content } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check if user owns the post or is admin/moderator
    const [posts] = await pool.execute(
      'SELECT author_id FROM forum_posts WHERE id = ?',
      [postId]
    );

    if (posts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    const isOwner = posts[0].author_id === userId;
    const isModerator = ['Admin', 'Moderator'].includes(userRole);

    if (!isOwner && !isModerator) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to edit this post'
      });
    }

    await pool.execute(
      `UPDATE forum_posts 
       SET title = ?, content = ?, updated_at = NOW()
       WHERE id = ?`,
      [title, content, postId]
    );

    await invalidateCache('cache:/api/forum/*');

    res.json({
      success: true,
      message: 'Post updated successfully'
    });
  } catch (error) {
    console.error('[Forum] Error updating post:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating post'
    });
  }
});

// DELETE post (only author or admin/moderator)
router.delete('/posts/:postId', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check if user owns the post or is admin/moderator
    const [posts] = await pool.execute(
      'SELECT author_id FROM forum_posts WHERE id = ?',
      [postId]
    );

    if (posts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    const isOwner = posts[0].author_id === userId;
    const isModerator = ['Admin', 'Moderator'].includes(userRole);

    if (!isOwner && !isModerator) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this post'
      });
    }

    await pool.execute('DELETE FROM forum_posts WHERE id = ?', [postId]);

    await invalidateCache('cache:/api/forum/*');

    res.json({
      success: true,
      message: 'Post deleted successfully'
    });
  } catch (error) {
    console.error('[Forum] Error deleting post:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting post'
    });
  }
});

// PIN/UNPIN post (admin/moderator only)
router.post('/posts/:postId/pin', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const { is_pinned } = req.body;
    const userRole = req.user.role;

    if (!['Admin', 'Moderator'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins and moderators can pin posts'
      });
    }

    await pool.execute(
      'UPDATE forum_posts SET is_pinned = ? WHERE id = ?',
      [is_pinned ? 1 : 0, postId]
    );

    await invalidateCache('cache:/api/forum/*');

    res.json({
      success: true,
      message: is_pinned ? 'Post pinned' : 'Post unpinned'
    });
  } catch (error) {
    console.error('[Forum] Error pinning post:', error);
    res.status(500).json({
      success: false,
      message: 'Error pinning post'
    });
  }
});

// LOCK/UNLOCK post (admin/moderator only)
router.post('/posts/:postId/lock', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const { is_locked } = req.body;
    const userRole = req.user.role;

    if (!['Admin', 'Moderator'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins and moderators can lock posts'
      });
    }

    await pool.execute(
      'UPDATE forum_posts SET is_locked = ? WHERE id = ?',
      [is_locked ? 1 : 0, postId]
    );

    await invalidateCache('cache:/api/forum/*');

    res.json({
      success: true,
      message: is_locked ? 'Post locked' : 'Post unlocked'
    });
  } catch (error) {
    console.error('[Forum] Error locking post:', error);
    res.status(500).json({
      success: false,
      message: 'Error locking post'
    });
  }
});

// TOGGLE COMMENTS (admin/moderator only)
router.post('/posts/:postId/toggle-comments', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const { comments_disabled } = req.body;
    const userRole = req.user.role;

    if (!['Admin', 'Moderator'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins and moderators can toggle comments'
      });
    }

    await pool.execute(
      'UPDATE forum_posts SET comments_disabled = ? WHERE id = ?',
      [comments_disabled ? 1 : 0, postId]
    );

    await invalidateCache('cache:/api/forum/*');

    res.json({
      success: true,
      message: comments_disabled ? 'Comments disabled' : 'Comments enabled'
    });
  } catch (error) {
    console.error('[Forum] Error toggling comments:', error);
    res.status(500).json({
      success: false,
      message: 'Error toggling comments'
    });
  }
});

// =====================================================
// COMMENTS
// =====================================================

// CREATE comment on post
router.post('/posts/:postId/comments', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const { content, parent_comment_id } = req.body;
    const authorId = req.user.id;
    const userRole = req.user.role;

    // Check if user has permission to comment
    const allowedRoles = ['Student', 'Moderator', 'Admin', 'Tutor', 'ManagerStudent', 'InstituteStudent'];
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to comment'
      });
    }

    // Check if post exists, is not locked, and comments are not disabled
    const [posts] = await pool.execute(
      'SELECT id, is_locked, author_id, title, comments_disabled FROM forum_posts WHERE id = ?',
      [postId]
    );

    if (posts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    const post = posts[0];

    if (post.is_locked) {
      return res.status(403).json({
        success: false,
        message: 'This post is locked and cannot be commented on'
      });
    }

    if (post.comments_disabled) {
      return res.status(403).json({
        success: false,
        message: 'Comments are disabled by a moderator'
      });
    }

    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'Comment content is required'
      });
    }

    const [result] = await pool.execute(
      `INSERT INTO forum_comments (post_id, author_id, parent_comment_id, content)
       VALUES (?, ?, ?, ?)`,
      [postId, authorId, parent_comment_id || null, content]
    );

    const commentId = result.insertId;

    // Update post last_activity_at (trigger handles comments_count)
    await pool.execute(
      'UPDATE forum_posts SET last_activity_at = NOW() WHERE id = ?',
      [postId]
    );

    // Get author info for notification
    const [authorInfo] = await pool.execute(
      'SELECT name FROM users WHERE id = ?',
      [authorId]
    );
    const authorName = authorInfo[0]?.name || 'Someone';

    // Create notification for post author (if not commenting on own post)
    if (post.author_id !== authorId) {
      setImmediate(async () => {
        await createNotification(req, {
          userId: post.author_id,
          type: parent_comment_id ? 'post_reply' : 'post_comment',
          title: parent_comment_id ? 'New Reply' : 'New Comment',
          message: `${authorName} ${parent_comment_id ? 'replied to a comment on' : 'commented on'} your post "${post.title}"`,
          relatedPostId: parseInt(postId),
          relatedCommentId: commentId,
          relatedUserId: authorId
        });
      });
    }

    // If this is a reply, notify the parent comment author
    if (parent_comment_id) {
      const [parentComment] = await pool.execute(
        'SELECT author_id FROM forum_comments WHERE id = ?',
        [parent_comment_id]
      );
      if (parentComment.length > 0 && parentComment[0].author_id !== authorId) {
        setImmediate(async () => {
          await createNotification(req, {
            userId: parentComment[0].author_id,
            type: 'reply',
            title: 'New Reply',
            message: `${authorName} replied to your comment`,
            relatedPostId: parseInt(postId),
            relatedCommentId: commentId,
            relatedUserId: authorId
          });
        });
      }
    }

    await invalidateCache('cache:/api/forum/*');

    res.json({
      success: true,
      message: 'Comment added successfully',
      commentId: commentId
    });
  } catch (error) {
    console.error('[Forum] Error creating comment:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating comment'
    });
  }
});

// UPDATE comment (only author or admin/moderator)
router.put('/comments/:commentId', auth, async (req, res) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check if user owns the comment or is admin/moderator
    const [comments] = await pool.execute(
      'SELECT author_id FROM forum_comments WHERE id = ?',
      [commentId]
    );

    if (comments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found'
      });
    }

    const isOwner = comments[0].author_id === userId;
    const isModerator = ['Admin', 'Moderator'].includes(userRole);

    if (!isOwner && !isModerator) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to edit this comment'
      });
    }

    await pool.execute(
      `UPDATE forum_comments 
       SET content = ?, is_edited = TRUE, edited_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      [content, commentId]
    );

    await invalidateCache('cache:/api/forum/*');

    res.json({
      success: true,
      message: 'Comment updated successfully'
    });
  } catch (error) {
    console.error('[Forum] Error updating comment:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating comment'
    });
  }
});

// DELETE comment (only author or admin/moderator)
router.delete('/comments/:commentId', auth, async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check if user owns the comment or is admin/moderator
    const [comments] = await pool.execute(
      'SELECT author_id FROM forum_comments WHERE id = ?',
      [commentId]
    );

    if (comments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found'
      });
    }

    const isOwner = comments[0].author_id === userId;
    const isModerator = ['Admin', 'Moderator'].includes(userRole);

    if (!isOwner && !isModerator) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this comment'
      });
    }

    await pool.execute('DELETE FROM forum_comments WHERE id = ?', [commentId]);

    await invalidateCache('cache:/api/forum/*');

    res.json({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    console.error('[Forum] Error deleting comment:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting comment'
    });
  }
});

// =====================================================
// LIKES
// =====================================================

// REACT to post (like, insightful, helpful, smart_thinking, well_done, curious, excellent)
router.post('/posts/:postId/react', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const { reaction_type } = req.body; // like, insightful, helpful, smart_thinking, well_done, curious, excellent
    const postIdInt = parseInt(postId);
    const userIdInt = parseInt(req.user.id);
    const userId = userIdInt;
    const userName = req.user.name || 'Someone';
    
    console.log(`[Forum REACT] Received: postId=${postId} (parsed: ${postIdInt}), userId=${req.user.id} (parsed: ${userIdInt}), reaction_type=${reaction_type}`);

    // Validate reaction type
    const validReactions = ['like', 'insightful', 'helpful', 'smart_thinking', 'well_done', 'curious', 'excellent'];
    if (!reaction_type || !validReactions.includes(reaction_type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reaction type'
      });
    }

    // Get post author to send notification
    const [posts] = await pool.execute(
      'SELECT author_id, title FROM forum_posts WHERE id = ?',
      [postIdInt]
    );

    if (posts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    const postAuthorId = posts[0].author_id;
    const postTitle = posts[0].title;

    // Check if reaction_type column exists
    const [reactionColumns] = await pool.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'forum_post_likes' 
       AND COLUMN_NAME = 'reaction_type'`
    );
    const hasReactionType = reactionColumns.length > 0;

    if (!hasReactionType) {
      return res.status(400).json({
        success: false,
        message: 'Reaction system not available'
      });
    }

    // Get user's current reaction (if any)
    console.log(`[Forum REACT] Checking existing reaction: post_id=${postIdInt} (type: ${typeof postIdInt}), user_id=${userIdInt} (type: ${typeof userIdInt}), reaction_type=${reaction_type}`);
    const [currentReaction] = await pool.execute(
      'SELECT reaction_type FROM forum_post_likes WHERE post_id = ? AND user_id = ?',
      [postIdInt, userIdInt]
    );
    console.log(`[Forum REACT] Found existing reactions:`, currentReaction);

    const userCurrentReaction = currentReaction.length > 0 ? currentReaction[0].reaction_type : null;
    const isSameReaction = userCurrentReaction === reaction_type;
    console.log(`[Forum REACT] userCurrentReaction: ${userCurrentReaction}, isSameReaction: ${isSameReaction}`);

    // Facebook-style logic: same reaction = remove, different = switch
    if (isSameReaction) {
      // Remove reaction (toggle off)
      console.log(`[Forum REACT] Removing reaction: post_id=${postIdInt}, user_id=${userIdInt}`);
      await pool.execute(
        'DELETE FROM forum_post_likes WHERE post_id = ? AND user_id = ?',
        [postIdInt, userIdInt]
      );
    } else {
      // Switch reaction (or add new) - use ON DUPLICATE KEY UPDATE
      console.log(`[Forum REACT] Inserting/updating reaction: post_id=${postIdInt}, user_id=${userIdInt}, reaction_type=${reaction_type}`);
      await pool.execute(
        `INSERT INTO forum_post_likes (post_id, user_id, reaction_type) 
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE reaction_type = VALUES(reaction_type)`,
        [postIdInt, userIdInt, reaction_type]
      );
    }

    await invalidateCache('cache:/api/forum/*');

    // Helper function to get all reaction counts (including zeros)
    const getAllReactionCounts = async () => {
      const counts = {
        like: 0,
        insightful: 0,
        helpful: 0,
        smart_thinking: 0,
        well_done: 0,
        curious: 0,
        excellent: 0
      };

      // Get counts grouped by reaction_type
      const [reactionCounts] = await pool.execute(
        `SELECT reaction_type, COUNT(*) as count 
         FROM forum_post_likes 
         WHERE post_id = ?
         GROUP BY reaction_type`,
        [postIdInt]
      );
      
      // Populate counts from database results
      reactionCounts.forEach(r => {
        if (counts.hasOwnProperty(r.reaction_type)) {
          counts[r.reaction_type] = parseInt(r.count);
        }
      });

      return counts;
    };

    // Get user's current reaction after the operation
    const getMyReaction = async () => {
      console.log(`[Forum REACT] Getting my_reaction after operation: post_id=${postIdInt} (type: ${typeof postIdInt}), user_id=${userIdInt} (type: ${typeof userIdInt})`);
      const [myReaction] = await pool.execute(
        'SELECT reaction_type FROM forum_post_likes WHERE post_id = ? AND user_id = ?',
        [postIdInt, userIdInt]
      );
      console.log(`[Forum REACT] Query result:`, myReaction);
      const result = myReaction.length > 0 ? myReaction[0].reaction_type : null;
      console.log(`[Forum REACT] Returning my_reaction: ${result} (type: ${typeof result})`);
      return result;
    };

    // Get updated reaction counts and user's reaction
    const counts = await getAllReactionCounts();
    const myReaction = await getMyReaction();
    
    // Create notification for post author (only if not reacting to own post and not removing)
    if (postAuthorId !== userId && !isSameReaction) {
      const reactionMessages = {
        like: 'liked',
        insightful: 'found insightful',
        helpful: 'found helpful',
        smart_thinking: 'appreciated the smart thinking in',
        well_done: 'appreciated',
        curious: 'is curious about',
        excellent: 'found excellent'
      };
      
      setImmediate(async () => {
        await createNotification(req, {
          userId: postAuthorId,
          type: 'post_like',
          title: 'Post Reacted',
          message: `${userName} ${reactionMessages[reaction_type] || 'reacted to'} your post`,
          relatedPostId: parseInt(postId),
          relatedCommentId: null,
          relatedUserId: userId
        });
      });
    }
    
    return res.json({
      success: true,
      my_reaction: myReaction,
      counts: counts
    });
  } catch (error) {
    console.error('[Forum] Error reacting to post:', error);
    res.status(500).json({
      success: false,
      message: 'Error reacting to post'
    });
  }
});

// LIKE/UNLIKE post (backward compatibility - maps to 'like' reaction)
router.post('/posts/:postId/like', auth, async (req, res) => {
  // Forward to react endpoint with 'like' reaction type
  req.body.reaction_type = 'like';
  req.url = `/posts/${req.params.postId}/react`;
  req.params = { postId: req.params.postId };
  return router.handle(req, res);
});

// REACT to comment (like, insightful, helpful, smart_thinking, well_done, curious, excellent)
router.post('/comments/:commentId/react', auth, async (req, res) => {
  try {
    const { commentId } = req.params;
    const { reaction_type } = req.body; // like, insightful, helpful, smart_thinking, well_done, curious, excellent
    const commentIdInt = parseInt(commentId);
    const userIdInt = parseInt(req.user.id);
    const userId = userIdInt;
    const userName = req.user.name || 'Someone';

    // Validate reaction type
    const validReactions = ['like', 'insightful', 'helpful', 'smart_thinking', 'well_done', 'curious', 'excellent'];
    if (!reaction_type || !validReactions.includes(reaction_type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reaction type'
      });
    }

    // Get comment author to send notification
    const [comments] = await pool.execute(
      'SELECT author_id, content, post_id FROM forum_comments WHERE id = ?',
      [commentIdInt]
    );

    if (comments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found'
      });
    }

    const commentAuthorId = comments[0].author_id;
    const commentContent = comments[0].content.substring(0, 50); // First 50 chars for notification
    const postId = comments[0].post_id;

    // Check if reaction_type column exists
    const [reactionColumns] = await pool.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'forum_comment_likes' 
       AND COLUMN_NAME = 'reaction_type'`
    );
    const hasReactionType = reactionColumns.length > 0;

    if (!hasReactionType) {
      return res.status(400).json({
        success: false,
        message: 'Reaction system not available for comments'
      });
    }

    // Get user's current reaction (if any)
    const [currentReaction] = await pool.execute(
      'SELECT reaction_type FROM forum_comment_likes WHERE comment_id = ? AND user_id = ?',
      [commentIdInt, userIdInt]
    );

    const userCurrentReaction = currentReaction.length > 0 ? currentReaction[0].reaction_type : null;
    const isSameReaction = userCurrentReaction === reaction_type;

    // Facebook-style logic: same reaction = remove, different = switch
    if (isSameReaction) {
      // Remove reaction (toggle off)
      await pool.execute(
        'DELETE FROM forum_comment_likes WHERE comment_id = ? AND user_id = ?',
        [commentIdInt, userIdInt]
      );
    } else {
      // Switch reaction (or add new) - use ON DUPLICATE KEY UPDATE
      await pool.execute(
        `INSERT INTO forum_comment_likes (comment_id, user_id, reaction_type) 
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE reaction_type = VALUES(reaction_type)`,
        [commentIdInt, userIdInt, reaction_type]
      );
    }

    await invalidateCache('cache:/api/forum/*');

    // Helper function to get all reaction counts (including zeros)
    const getAllReactionCounts = async () => {
      const counts = {
        like: 0,
        insightful: 0,
        helpful: 0,
        smart_thinking: 0,
        well_done: 0,
        curious: 0,
        excellent: 0
      };

      // Get counts grouped by reaction_type
      const [reactionCounts] = await pool.execute(
        `SELECT reaction_type, COUNT(*) as count 
         FROM forum_comment_likes 
         WHERE comment_id = ?
         GROUP BY reaction_type`,
        [commentIdInt]
      );
      
      // Populate counts from database results
      reactionCounts.forEach(r => {
        if (counts.hasOwnProperty(r.reaction_type)) {
          counts[r.reaction_type] = parseInt(r.count);
        }
      });

      return counts;
    };

    // Get user's current reaction after the operation
    const getMyReaction = async () => {
      const [myReaction] = await pool.execute(
        'SELECT reaction_type FROM forum_comment_likes WHERE comment_id = ? AND user_id = ?',
        [commentIdInt, userIdInt]
      );
      return myReaction.length > 0 ? myReaction[0].reaction_type : null;
    };

    // Get updated reaction counts and user's reaction
    const counts = await getAllReactionCounts();
    const myReaction = await getMyReaction();
    
    // Create notification for comment author (only if not reacting to own comment and not removing)
    if (commentAuthorId !== userId && !isSameReaction) {
      const reactionMessages = {
        like: 'liked',
        insightful: 'found insightful',
        helpful: 'found helpful',
        smart_thinking: 'appreciated the smart thinking in',
        well_done: 'appreciated',
        curious: 'is curious about',
        excellent: 'found excellent'
      };
      
      setImmediate(async () => {
        await createNotification(req, {
          userId: commentAuthorId,
          type: 'comment_reaction',
          title: 'Comment Reacted',
          message: `${userName} ${reactionMessages[reaction_type] || 'reacted to'} your comment "${commentContent}${commentContent.length >= 50 ? '...' : ''}"`,
          relatedPostId: postId,
          relatedCommentId: commentIdInt,
          relatedUserId: userId
        });
      });
    }
    
    return res.json({
      success: true,
      my_reaction: myReaction,
      counts: counts
    });

  } catch (error) {
    console.error('[Forum] Error reacting to comment:', error);
    res.status(500).json({
      success: false,
      message: 'Error reacting to comment'
    });
  }
});

// LIKE/UNLIKE comment (backward compatibility - maps to 'like' reaction)
router.post('/comments/:commentId/like', auth, async (req, res) => {
  // Forward to react endpoint with 'like' reaction type
  req.body.reaction_type = 'like';
  req.url = `/comments/${req.params.commentId}/react`;
  req.params = { commentId: req.params.commentId };
  return router.handle(req, res);
});

// GET user's liked posts/comments for a specific post
router.get('/posts/:postId/likes', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    // Get if user liked the post
    const [postLike] = await pool.execute(
      'SELECT id FROM forum_post_likes WHERE post_id = ? AND user_id = ?',
      [postId, userId]
    );

    // Get all comment IDs for this post
    const [comments] = await pool.execute(
      'SELECT id FROM forum_comments WHERE post_id = ?',
      [postId]
    );

    const commentIds = comments.map(c => c.id);
    let commentLikes = [];

    if (commentIds.length > 0) {
      const placeholders = commentIds.map(() => '?').join(',');
      const [likes] = await pool.execute(
        `SELECT comment_id FROM forum_comment_likes 
         WHERE comment_id IN (${placeholders}) AND user_id = ?`,
        [...commentIds, userId]
      );
      commentLikes = likes.map(l => l.comment_id);
    }

    res.json({
      success: true,
      postLiked: postLike.length > 0,
      commentLikes: commentLikes
    });
  } catch (error) {
    console.error('[Forum] Error fetching likes:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching likes'
    });
  }
});

module.exports = router;

