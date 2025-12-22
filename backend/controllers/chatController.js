const pool = require("../config/db");
const cloudinary = require("../config/cloudinary");
const { invalidateCache } = require('../middleware/cache');

// Create or get existing conversation
exports.startConversation = async (req, res) => {
  const { student_id, tutor_id, admin_id, course_id, conversation_type, title } = req.body;
  try {
    // Check for existing conversation
    let query = "SELECT * FROM conversations WHERE ";
    let params = [];
    
    if (conversation_type === 'course' && course_id) {
      query += "course_id=? AND conversation_type='course'";
      params = [course_id];
    } else if (admin_id) {
      query += "student_id=? AND admin_id=?";
      params = [student_id, admin_id];
    } else {
      query += "student_id=? AND tutor_id=?";
      params = [student_id, tutor_id];
    }
    
    const [existing] = await pool.query(query, params);

    if (existing.length > 0) return res.json({ success: true, conversation: existing[0] });

    // Create new conversation
    const [result] = await pool.query(
      "INSERT INTO conversations (student_id, tutor_id, admin_id, course_id, conversation_type, title) VALUES (?,?,?,?,?,?)",
      [student_id || null, tutor_id || null, admin_id || null, course_id || null, conversation_type || 'direct', title || null]
    );

    const newConversation = {
      id: result.insertId,
      student_id,
      tutor_id,
      admin_id,
      course_id,
      conversation_type: conversation_type || 'direct',
      title
    };

    res.json({ success: true, conversation: newConversation });
  } catch (err) {
    console.error('Error starting conversation:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Get all conversations for a user
exports.getUserConversations = async (req, res) => {
  const { userId } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT c.*, 
        COALESCE(s.name, 'Unknown') AS student_name,
        COALESCE(t.name, 'Unknown') AS tutor_name,
        COALESCE(a.name, 'Admin') AS admin_name,
        COALESCE(co.title, 'Group Chat') AS course_title
      FROM conversations c
      LEFT JOIN users s ON c.student_id = s.id
      LEFT JOIN users t ON c.tutor_id = t.id
      LEFT JOIN users a ON c.admin_id = a.id
      LEFT JOIN courses co ON c.course_id = co.id
      WHERE c.student_id = ? OR c.tutor_id = ? OR c.admin_id = ?
      ORDER BY COALESCE(c.last_message_at, c.updated_at) DESC`,
      [userId, userId, userId]
    );
    
    // Get last message for each conversation (if any exist)
    if (rows && rows.length > 0) {
      for (let conv of rows) {
        try {
          const [lastMsg] = await pool.query(
            `SELECT message, created_at FROM messages 
             WHERE conversation_id = ? AND is_deleted = 0 
             ORDER BY created_at DESC LIMIT 1`,
            [conv.id]
          );
          conv.last_message = lastMsg[0]?.message || null;
          conv.last_message_time = lastMsg[0]?.created_at || null;
        } catch (e) {
          conv.last_message = null;
          conv.last_message_time = null;
        }
      }
    }
    
    res.json({ success: true, conversations: rows || [] });
  } catch (err) {
    console.error('Error fetching conversations:', err);
    res.status(500).json({ success: false, error: err.message, conversations: [] });
  }
};

// Get all messages for conversation
exports.getMessages = async (req, res) => {
  const { conversationId } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT m.*, u.name AS sender_name, u.email AS sender_email
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = ? AND m.is_deleted = 0
      ORDER BY m.created_at ASC`,
      [conversationId]
    );
    res.json({ success: true, messages: rows });
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Send text message
exports.sendMessage = async (req, res) => {
  const { conversationId, senderId, message, fileUrl, fileName, fileType, fileSize, messageType } = req.body;
  try {
    const [result] = await pool.query(
      `INSERT INTO messages (conversation_id, sender_id, message, file_url, file_name, file_type, file_size, message_type) 
       VALUES (?,?,?,?,?,?,?,?)`,
      [conversationId, senderId, message || null, fileUrl || null, fileName || null, fileType || null, fileSize || null, messageType || "text"]
    );

    // Update conversation last_message_at
    await pool.query(
      "UPDATE conversations SET last_message_at = NOW(), updated_at = NOW() WHERE id = ?",
      [conversationId]
    );

    // Get the inserted message with sender info
    const [newMessage] = await pool.query(
      `SELECT m.*, u.name AS sender_name, u.email AS sender_email
       FROM messages m
       LEFT JOIN users u ON m.sender_id = u.id
       WHERE m.id = ?`,
      [result.insertId]
    );

    // Emit to socket
    const io = req.app.get('io');
    if (io) {
      io.to(`conversation_${conversationId}`).emit("receive_message", newMessage[0]);
    }

    // Get conversation details to find receiver
    const [conversation] = await pool.query(
      `SELECT student_id, tutor_id, admin_id, course_id, title
       FROM conversations WHERE id = ?`,
      [conversationId]
    );

    if (conversation.length > 0) {
      const conv = conversation[0];
      let receiverId = null;
      
      // Determine who should receive the notification
      if (conv.student_id && conv.student_id !== senderId) {
        receiverId = conv.student_id;
      } else if (conv.tutor_id && conv.tutor_id !== senderId) {
        receiverId = conv.tutor_id;
      } else if (conv.admin_id && conv.admin_id !== senderId) {
        receiverId = conv.admin_id;
      }

      // Get sender info for notification
      const [senderInfo] = await pool.query('SELECT name FROM users WHERE id = ?', [senderId]);
      const senderName = senderInfo[0]?.name || 'Someone';

      // Create notification for receiver
      if (receiverId) {
        const { createNotification } = require('../utils/notificationHelper');
        await createNotification({
          userId: receiverId,
          type: 'chat_message',
          title: 'New Message',
          message: `${senderName} sent you a message${conv.title ? ` in "${conv.title}"` : ''}`,
          relatedUserId: senderId,
          relatedCourseId: conv.course_id || null,
          req: req
        });
      }
    }

    await invalidateCache('cache:/api/messages*');
    await invalidateCache('cache:/api/conversations*');
    res.json({ success: true, message: newMessage[0] });
  } catch (err) {
    console.error('Error sending message:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Upload file to Cloudinary
exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const file = req.file;
    const fileType = file.mimetype.split('/')[0]; // image, application, etc.

    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'lms/chat',
          resource_type: 'auto',
          public_id: `chat_${Date.now()}_${file.originalname.replace(/\.[^/.]+$/, '')}`,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(file.buffer);
    });

    res.json({
      success: true,
      file: {
        url: result.secure_url,
        name: file.originalname,
        type: file.mimetype,
        size: file.size,
        messageType: fileType === 'image' ? 'image' : file.mimetype === 'application/pdf' ? 'pdf' : 'file'
      }
    });
  } catch (err) {
    console.error('Error uploading file:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Mark messages as read
exports.markAsRead = async (req, res) => {
  const { conversationId, userId, messageId } = req.body;
  try {
    if (messageId) {
      // Mark specific message as read
      await pool.query(
        `UPDATE messages SET is_read = 1, read_at = NOW() 
         WHERE id = ? AND sender_id != ?`,
        [messageId, userId]
      );
    } else if (conversationId) {
      // Mark all messages in conversation as read
      await pool.query(
        `UPDATE messages SET is_read = 1, read_at = NOW() 
         WHERE conversation_id = ? AND sender_id != ? AND is_read = 0`,
        [conversationId, userId]
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error marking as read:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Get all users for starting new conversation
exports.getAllUsers = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT 
        u.id, 
        u.name, 
        u.email,
        CASE 
          WHEN u.role_id = 1 THEN 'Admin'
          WHEN u.role_id = 2 THEN 'Tutor'
          WHEN u.role_id = 3 THEN 'Moderator'
          WHEN u.role_id = 4 THEN 'Student'
          WHEN u.role_id = 5 THEN 'Manager'
          ELSE 'Student'
        END AS role
      FROM users u
      WHERE u.role_id IN (1, 2, 4)
      ORDER BY u.role_id ASC, u.name ASC`
    );
    res.json({ success: true, users: rows });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
