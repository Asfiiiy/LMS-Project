const pool = require("../config/db");
const cloudinary = require("../config/cloudinary");
const { invalidateCache } = require('../middleware/cache');
const ticketController = require('./ticketController');

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

// Get all conversations for a user with pagination (auth required; user can only fetch own conversations)
// Includes ticket conversations: assignee, manager of assignee, or same department (so Admission Manager etc. see transferred chats)
exports.getUserConversations = async (req, res) => {
  const userId = req.user?.id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 15;
  const offset = (page - 1) * limit;

  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized', conversations: [] });
  }

  try {
    const roleName = await ticketController.getRoleName(req.user?.role_id) || '';
    const effectiveDeptId = await ticketController.getEffectiveDepartmentId(userId, roleName);
    const isOmOrTeam = ['Operation Manager', 'Operation_manager', 'operation_manager', 'Team Member', 'Team_member', 'team_member'].includes(roleName);
    const deptClause = effectiveDeptId != null ? ' OR tk.department_id = ?' : '';
    const omClause = isOmOrTeam ? ' OR 1=1' : '';
    const countParams = [userId, userId, userId, userId, userId];
    if (effectiveDeptId != null) countParams.push(effectiveDeptId);

    // Get total count: include ticket-linked where user is assignee, manager of assignee, or ticket in user's department (or all tickets for OM/Team)
    const [countRows] = await pool.query(
      `SELECT COUNT(DISTINCT c.id) as total FROM conversations c
       LEFT JOIN tickets tk ON tk.conversation_id = c.id
       LEFT JOIN users assignee ON tk.assigned_to = assignee.id
       WHERE c.student_id = ? OR c.tutor_id = ? OR c.admin_id = ?
         OR (tk.id IS NOT NULL AND (tk.assigned_to = ? OR assignee.manager_id = ?${deptClause}${omClause}))`,
      countParams
    );
    const total = countRows[0]?.total || 0;

    const mainParams = [userId, userId, userId, userId, userId, userId];
    if (effectiveDeptId != null) mainParams.push(effectiveDeptId);

    // Get conversations with pagination; include ticket-linked by assignee, manager, or department
    const [rows] = await pool.query(
      `SELECT c.*, 
        COALESCE(s.name, 'Unknown') AS student_name,
        COALESCE(t.name, 'Unknown') AS tutor_name,
        COALESCE(a.name, 'Admin') AS admin_name,
        COALESCE(co.title, 'Group Chat') AS course_title,
        sp.profile_picture AS student_profile_picture,
        tp.profile_picture AS tutor_profile_picture,
        ap.profile_picture AS admin_profile_picture,
        tk.id AS ticket_id,
        tk.status AS ticket_status,
        tk.assigned_to AS ticket_assigned_to,
        assignee.name AS ticket_assigned_to_name,
        tk.escalated_by AS ticket_escalated_by,
        eb.name AS ticket_escalated_by_name,
        tk.department_id AS ticket_department_id,
        d.name AS ticket_department_name,
        st.id AS student_tutor_id,
        st.name AS student_tutor_name,
        (SELECT message FROM messages WHERE conversation_id = c.id AND is_deleted = 0 ORDER BY created_at DESC LIMIT 1) AS last_message,
        (SELECT created_at FROM messages WHERE conversation_id = c.id AND is_deleted = 0 ORDER BY created_at DESC LIMIT 1) AS last_message_time,
        (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND sender_id != ? AND is_read = 0 AND is_deleted = 0) AS unread_count
      FROM conversations c
      LEFT JOIN users s ON c.student_id = s.id
      LEFT JOIN users t ON c.tutor_id = t.id
      LEFT JOIN users a ON c.admin_id = a.id
      LEFT JOIN courses co ON c.course_id = co.id
      LEFT JOIN student_profiles sp ON s.id = sp.user_id
      LEFT JOIN staff_profiles tp ON t.id = tp.user_id
      LEFT JOIN staff_profiles ap ON a.id = ap.user_id
      LEFT JOIN tickets tk ON tk.conversation_id = c.id
      LEFT JOIN departments d ON tk.department_id = d.id
      LEFT JOIN users assignee ON tk.assigned_to = assignee.id
      LEFT JOIN users eb ON tk.escalated_by = eb.id
      LEFT JOIN users st ON s.assigned_tutor_id = st.id
      WHERE c.student_id = ? OR c.tutor_id = ? OR c.admin_id = ?
         OR (tk.id IS NOT NULL AND (tk.assigned_to = ? OR assignee.manager_id = ?${deptClause}${omClause}))
      ORDER BY COALESCE(c.last_message_at, c.updated_at) DESC
      LIMIT ${limit} OFFSET ${offset}`,
      mainParams
    );
    
    // Format the response
    const conversations = rows.map(conv => ({
      ...conv,
      unread_count: parseInt(conv.unread_count || 0),
      last_message: conv.last_message || null,
      last_message_time: conv.last_message_time || null
    }));
    
    res.json({ 
      success: true, 
      conversations: conversations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: offset + conversations.length < total
      }
    });
  } catch (err) {
    console.error('Error fetching conversations:', err);
    res.status(500).json({ success: false, error: err.message, conversations: [] });
  }
};

// Get single conversation by id (for opening ticket-linked chat; user must be participant, assignee, or ticket in user's department)
exports.getConversationById = async (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user?.id || req.query.userId;
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
  try {
    const roleId = req.user?.role_id || null;
    let roleName = roleId ? await ticketController.getRoleName(roleId) : null;
    if (!roleName) {
      const [u] = await pool.query('SELECT role_id FROM users WHERE id = ?', [userId]);
      if (u?.length) roleName = await ticketController.getRoleName(u[0].role_id);
    }
    const effectiveDeptId = roleName ? await ticketController.getEffectiveDepartmentId(userId, roleName) : null;
    const isOmOrTeam = roleName && ['Operation Manager', 'Operation_manager', 'operation_manager', 'Team Member', 'Team_member', 'team_member'].includes(roleName);
    const deptClause = effectiveDeptId != null ? ' OR tk.department_id = ?' : '';
    const omClause = isOmOrTeam ? ' OR 1=1' : '';
    const params = [conversationId, userId, userId, userId, userId, userId];
    if (effectiveDeptId != null) params.push(effectiveDeptId);

    const [rows] = await pool.query(
      `SELECT c.*, 
        COALESCE(s.name, 'Unknown') AS student_name,
        COALESCE(t.name, 'Unknown') AS tutor_name,
        COALESCE(a.name, 'Admin') AS admin_name,
        COALESCE(co.title, 'Group Chat') AS course_title,
        sp.profile_picture AS student_profile_picture,
        tp.profile_picture AS tutor_profile_picture,
        ap.profile_picture AS admin_profile_picture,
        tk.id AS ticket_id,
        tk.status AS ticket_status,
        tk.assigned_to AS ticket_assigned_to,
        assignee.name AS ticket_assigned_to_name,
        tk.escalated_by AS ticket_escalated_by,
        eb.name AS ticket_escalated_by_name,
        tk.department_id AS ticket_department_id,
        d.name AS ticket_department_name,
        st.id AS student_tutor_id,
        st.name AS student_tutor_name
      FROM conversations c
      LEFT JOIN users s ON c.student_id = s.id
      LEFT JOIN users t ON c.tutor_id = t.id
      LEFT JOIN users a ON c.admin_id = a.id
      LEFT JOIN courses co ON c.course_id = co.id
      LEFT JOIN student_profiles sp ON s.id = sp.user_id
      LEFT JOIN staff_profiles tp ON t.id = tp.user_id
      LEFT JOIN staff_profiles ap ON a.id = ap.user_id
      LEFT JOIN tickets tk ON tk.conversation_id = c.id
      LEFT JOIN departments d ON tk.department_id = d.id
      LEFT JOIN users assignee ON tk.assigned_to = assignee.id
      LEFT JOIN users eb ON tk.escalated_by = eb.id
      LEFT JOIN users st ON s.assigned_tutor_id = st.id
      WHERE c.id = ?
        AND (c.student_id = ? OR c.tutor_id = ? OR c.admin_id = ?
             OR (tk.id IS NOT NULL AND (tk.assigned_to = ? OR assignee.manager_id = ?${deptClause}${omClause})))`,
      params
    );
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'Conversation not found' });
    res.json({ success: true, conversation: rows[0] });
  } catch (err) {
    console.error('Error fetching conversation:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Get unread conversation count (conversations with unread messages)
exports.getUnreadConversationCount = async (req, res) => {
  const { userId } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT COUNT(DISTINCT c.id) as count
       FROM conversations c
       INNER JOIN messages m ON c.id = m.conversation_id
       WHERE (c.student_id = ? OR c.tutor_id = ? OR c.admin_id = ?)
       AND m.sender_id != ?
       AND m.is_read = 0
       AND m.is_deleted = 0`,
      [userId, userId, userId, userId]
    );
    
    const count = parseInt(rows[0]?.count || 0);
    res.json({ success: true, count });
  } catch (err) {
    console.error('Error fetching unread conversation count:', err);
    res.status(500).json({ success: false, error: err.message, count: 0 });
  }
};

// Get merged messages from all ticket conversations with a student (for staff "one chat per person" view)
// Also returns ticket lifecycle events (created, accepted, transferred) to show in timeline
exports.getMergedTicketMessages = async (req, res) => {
  const studentId = parseInt(req.query.studentId, 10);
  const userId = req.user?.id || req.query.userId;
  if (!studentId || !userId) {
    return res.status(400).json({ success: false, error: 'studentId and userId required' });
  }
  try {
    const roleId = req.user?.role_id || null;
    let roleName = roleId ? await ticketController.getRoleName(roleId) : null;
    if (!roleName) {
      const [u] = await pool.query('SELECT role_id FROM users WHERE id = ?', [userId]);
      if (u?.length) roleName = await ticketController.getRoleName(u[0].role_id);
    }
    const effectiveDeptId = roleName ? await ticketController.getEffectiveDepartmentId(userId, roleName) : null;
    const isOmOrTeam = roleName && ['Operation Manager', 'Operation_manager', 'operation_manager', 'Team Member', 'Team_member', 'team_member'].includes(roleName);
    const deptClause = effectiveDeptId != null ? ' OR tk.department_id = ?' : '';
    const omClause = isOmOrTeam ? ' OR 1=1' : '';
    const convParams = [studentId, userId, userId, userId, userId];
    if (effectiveDeptId != null) convParams.push(effectiveDeptId);
    // Include tickets where user is assignee, manager of assignee, or ticket in user's department (or all for OM/Team)
    const [convs] = await pool.query(
      `SELECT c.id, c.last_message_at
       FROM conversations c
       LEFT JOIN tickets tk ON tk.conversation_id = c.id
       LEFT JOIN users assignee ON tk.assigned_to = assignee.id
       WHERE c.student_id = ? AND (c.admin_id = ? OR c.tutor_id = ? OR (tk.id IS NOT NULL AND (tk.assigned_to = ? OR assignee.manager_id = ?${deptClause}${omClause})))
       ORDER BY c.last_message_at IS NULL, c.last_message_at DESC`,
      convParams
    );
    if (convs.length === 0) {
      return res.json({ success: true, messages: [], events: [], activeConversationId: null });
    }
    const conversationIds = convs.map((c) => c.id);
    const activeConversationId = convs[0].id;
    const placeholders = conversationIds.map(() => '?').join(',');
    const [rows] = await pool.query(
      `SELECT m.*, u.name AS sender_name, u.email AS sender_email,
        parent_msg.message AS parent_message, parent_user.name AS parent_sender_name
       FROM messages m
       LEFT JOIN users u ON m.sender_id = u.id
       LEFT JOIN messages parent_msg ON m.parent_message_id = parent_msg.id AND (parent_msg.is_deleted = 0 OR parent_msg.is_deleted IS NULL)
       LEFT JOIN users parent_user ON parent_msg.sender_id = parent_user.id
       WHERE m.conversation_id IN (${placeholders}) AND (m.is_deleted = 0 OR m.is_deleted IS NULL)
       ORDER BY m.created_at ASC`,
      conversationIds
    );
    const [ticketRows] = await pool.query(
      `SELECT tk.id AS ticket_id, tk.subject, tk.created_at, tk.updated_at, tk.assigned_to,
        u.name AS assigned_to_name
       FROM tickets tk
       LEFT JOIN users u ON tk.assigned_to = u.id
       WHERE tk.conversation_id IN (${placeholders})`,
      conversationIds
    );
    const events = [];
    for (const t of ticketRows) {
      events.push({
        type: 'ticket_created',
        ticketId: t.ticket_id,
        subject: t.subject,
        createdAt: t.created_at,
        _sortKey: new Date(t.created_at).getTime()
      });
      if (t.assigned_to && t.assigned_to_name) {
        const updatedAt = t.updated_at || t.created_at;
        events.push({
          type: 'ticket_accepted',
          ticketId: t.ticket_id,
          acceptedByName: t.assigned_to_name,
          createdAt: updatedAt,
          _sortKey: new Date(updatedAt).getTime()
        });
      }
    }
    res.json({ success: true, messages: rows, events, activeConversationId });
  } catch (err) {
    console.error('Error fetching merged ticket messages:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Get all messages for conversation (includes parent message for reply-to)
// For ticket-linked conversations, merge in ticket_messages so both sides (student + staff/tutor) show
exports.getMessages = async (req, res) => {
  const { conversationId } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT m.*, u.name AS sender_name, u.email AS sender_email, r.name AS sender_role_name,
        parent_msg.message AS parent_message, parent_user.name AS parent_sender_name
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN messages parent_msg ON m.parent_message_id = parent_msg.id AND (parent_msg.is_deleted = 0 OR parent_msg.is_deleted IS NULL)
      LEFT JOIN users parent_user ON parent_msg.sender_id = parent_user.id
      WHERE m.conversation_id = ? AND (m.is_deleted = 0 OR m.is_deleted IS NULL)
      ORDER BY m.created_at ASC`,
      [conversationId]
    );

    // If this conversation is linked to a ticket, merge ticket_messages so tutor/staff replies show
    const [ticketRows] = await pool.query(
      'SELECT id FROM tickets WHERE conversation_id = ?',
      [conversationId]
    );
    if (ticketRows.length > 0) {
      const ticketId = ticketRows[0].id;
      const [ticketMsgs] = await pool.query(
        `SELECT tm.id, tm.ticket_id, tm.sender_id, tm.message, tm.file_url, tm.file_name, tm.file_type, tm.created_at,
         u.name AS sender_name, u.email AS sender_email, r.name AS sender_role_name
         FROM ticket_messages tm
         LEFT JOIN users u ON tm.sender_id = u.id
         LEFT JOIN roles r ON u.role_id = r.id
         WHERE tm.ticket_id = ? AND (tm.is_internal = 0 OR tm.is_internal IS NULL)
         ORDER BY tm.created_at ASC`,
        [ticketId]
      );
      const byKey = (r) => `${r.sender_id}|${(r.message || '').slice(0, 100)}|${r.created_at ? new Date(r.created_at).getTime() : 0}`;
      const seen = new Set(rows.map(byKey));
      const merged = [...rows];
      for (const tm of ticketMsgs) {
        const key = `${tm.sender_id}|${(tm.message || '').slice(0, 100)}|${tm.created_at ? new Date(tm.created_at).getTime() : 0}`;
        if (seen.has(key)) continue;
        // Check for approximate match (sync might have different created_at)
        const already = rows.some(
          (m) => m.sender_id === tm.sender_id && (m.message || '') === (tm.message || '') && Math.abs(new Date(m.created_at).getTime() - new Date(tm.created_at).getTime()) < 5000
        );
        if (already) continue;
        seen.add(key);
        merged.push({
          id: `ticket_${tm.id}`,
          conversation_id: parseInt(conversationId, 10),
          sender_id: tm.sender_id,
          sender_name: tm.sender_name,
          sender_role_name: tm.sender_role_name,
          sender_email: tm.sender_email,
          message: tm.message,
          file_url: tm.file_url,
          file_name: tm.file_name,
          file_type: tm.file_type,
          created_at: tm.created_at,
          message_type: tm.file_url ? 'file' : 'text'
        });
      }
      merged.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      return res.json({ success: true, messages: merged });
    }

    res.json({ success: true, messages: rows });
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Max length for file_type column (DB may be VARCHAR(50) or similar; truncate to avoid "Data too long")
const FILE_TYPE_MAX_LENGTH = 100;

// Send text message (supports parent_message_id for reply-to)
exports.sendMessage = async (req, res) => {
  const { conversationId, senderId, message, fileUrl, fileName, fileType, fileSize, messageType, parentMessageId } = req.body;
  const fileTypeTruncated = fileType && String(fileType).length > FILE_TYPE_MAX_LENGTH
    ? String(fileType).slice(0, FILE_TYPE_MAX_LENGTH)
    : (fileType || null);
  try {
    // 4️⃣ Closed ticket = read only - block send
    const [ticketRows] = await pool.query(
      'SELECT tk.status FROM tickets tk WHERE tk.conversation_id = ?',
      [conversationId]
    );
    if (ticketRows[0] && ticketRows[0].status === 'resolved') {
      return res.status(403).json({ success: false, message: 'Ticket is closed. You cannot send new messages.' });
    }
    const [result] = await pool.query(
      `INSERT INTO messages (conversation_id, sender_id, message, file_url, file_name, file_type, file_size, message_type, parent_message_id) 
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [conversationId, senderId, message || null, fileUrl || null, fileName || null, fileTypeTruncated, fileSize || null, messageType || "text", parentMessageId || null]
    );

    // Update conversation last_message_at
    await pool.query(
      "UPDATE conversations SET last_message_at = NOW(), updated_at = NOW() WHERE id = ?",
      [conversationId]
    );

    // Get the inserted message with sender info and parent message preview
    const [newMessage] = await pool.query(
      `SELECT m.*, u.name AS sender_name, u.email AS sender_email,
        parent_msg.message AS parent_message, parent_user.name AS parent_sender_name
       FROM messages m
       LEFT JOIN users u ON m.sender_id = u.id
       LEFT JOIN messages parent_msg ON m.parent_message_id = parent_msg.id AND (parent_msg.is_deleted = 0 OR parent_msg.is_deleted IS NULL)
       LEFT JOIN users parent_user ON parent_msg.sender_id = parent_user.id
       WHERE m.id = ?`,
      [result.insertId]
    );

    // If this conversation is linked to a support ticket, sync message to ticket so ticket page / floating window stay in sync
    try {
      const [ticketRows] = await pool.query('SELECT id, student_id, assigned_to FROM tickets WHERE conversation_id = ?', [conversationId]);
      if (ticketRows.length > 0) {
        const ticket = ticketRows[0];
        const msgBody = (message || '').trim() || (fileUrl ? '[Attachment]' : '');
        await pool.query(
          'INSERT INTO ticket_messages (ticket_id, sender_id, message, file_url, file_name, file_type, is_internal) VALUES (?, ?, ?, ?, ?, ?, 0)',
          [ticket.id, senderId, msgBody, fileUrl || null, fileName || null, (fileTypeTruncated || '').slice(0, 50)]
        );
        const { invalidateCache } = require('../middleware/cache');
        invalidateCache('cache:/api/tickets*');
        const [ticketMsgRows] = await pool.query(
          'SELECT tm.*, u.name as sender_name FROM ticket_messages tm JOIN users u ON tm.sender_id = u.id WHERE tm.ticket_id = ? ORDER BY tm.id DESC LIMIT 1',
          [ticket.id]
        );
        const ticketMsg = ticketMsgRows[0];
        const io = req.app.get('io');
        if (io && ticketMsg) {
          const recipientId = ticket.student_id === senderId ? ticket.assigned_to : ticket.student_id;
          if (recipientId) io.to(`user_${recipientId}`).emit('ticket_message', { ticketId: ticket.id, message: ticketMsg });
        }
      }
    } catch (ticketSyncErr) {
      console.warn('[Chat] Ticket sync failed:', ticketSyncErr.message);
    }

    // Emit to socket for real-time message delivery
    const io = req.app.get('io');
    if (io) {
      // Emit to conversation room for real-time chat
      const messageToEmit = newMessage[0];
      const room = `conversation_${conversationId}`;
      
      // Get all sockets in the room
      const socketsInRoom = io.sockets.adapter.rooms.get(room);
      console.log(`📤 [Chat] Emitting message ${result.insertId} to room ${room}`);
      console.log(`📤 [Chat] Sockets in room: ${socketsInRoom ? socketsInRoom.size : 0}`);
      
      io.to(room).emit("receive_message", messageToEmit);
      console.log(`📤 [Chat] Message data:`, JSON.stringify(messageToEmit));
      
      // Emit conversation_updated event for real-time updates in dropdown
      io.emit("conversation_updated", { conversationId });
      // 6️⃣ Unread count - notify receiver for badge update
      const [convRows] = await pool.query(
        'SELECT student_id, tutor_id, admin_id FROM conversations WHERE id = ?',
        [conversationId]
      );
      if (convRows[0]) {
        const c = convRows[0];
        const sid = parseInt(senderId, 10);
        const receiverId = [c.student_id, c.tutor_id, c.admin_id].find((id) => id && id !== sid);
        if (receiverId) {
          const [unread] = await pool.query(
            'SELECT COUNT(*) as cnt FROM messages WHERE conversation_id = ? AND sender_id != ? AND (is_read = 0 OR is_read IS NULL) AND (is_deleted = 0 OR is_deleted IS NULL)',
            [conversationId, receiverId]
          );
          io.to(`user_${receiverId}`).emit('unread_count_update', { conversationId, count: unread[0].cnt });
        }
      }
    } else {
      console.warn('⚠️ [Chat] Socket.IO not available - real-time messaging disabled');
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
        const notificationId = await createNotification({
          userId: receiverId,
          type: 'chat', // Changed from 'chat_message' to 'chat' to fit VARCHAR(50) column
          title: 'New Message',
          message: `${senderName} sent you a message${conv.title ? ` in "${conv.title}"` : ''}`,
          relatedUserId: senderId,
          relatedCourseId: conv.course_id || null,
          relatedConversationId: conversationId, // Store conversation ID for chat opening
          req: req
        });
        
        // Also emit notification via socket to ensure real-time delivery
        // Note: notificationHelper already emits the notification, but we emit here too for redundancy
        if (io && notificationId) {
          const notificationRoom = `user_${receiverId}`;
          const socketsInRoom = io.sockets.adapter.rooms.get(notificationRoom);
          console.log(`📬 [Chat] Sending notification to room ${notificationRoom}`);
          console.log(`📬 [Chat] Sockets in notification room: ${socketsInRoom ? socketsInRoom.size : 0}`);
          
          // Fetch the created notification to get all fields
          const [notificationRows] = await pool.query(
            `SELECT n.*, u.name as related_user_name
             FROM notifications n
             LEFT JOIN users u ON n.related_user_id = u.id
             WHERE n.id = ?`,
            [notificationId]
          );
          
          if (notificationRows.length > 0) {
            const notificationData = notificationRows[0];
            io.to(notificationRoom).emit('new_notification', notificationData);
            console.log(`📬 [Chat] Notification data emitted:`, JSON.stringify(notificationData));
            
            // Emit unread count update
            const [unreadCount] = await pool.query(
              'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE',
              [receiverId]
            );
            io.to(notificationRoom).emit('notification_count_update', { count: unreadCount[0].count });
            console.log(`📬 [Chat] Sent notification and count update to user ${receiverId} (unread: ${unreadCount[0].count})`);
          } else {
            console.warn(`⚠️ [Chat] Notification ${notificationId} not found after creation`);
          }
        } else {
          console.warn(`⚠️ [Chat] Cannot send notification: io=${!!io}, notificationId=${notificationId}`);
          if (!notificationId) {
            console.error(`❌ [Chat] Notification creation failed - check notificationHelper logs`);
          }
        }
      }
    }

    await invalidateCache('cache:/api/messages*');
    await invalidateCache('cache:/api/conversations*');
    res.json({ success: true, message: newMessage[0] });
  } catch (err) {
    console.error('Error sending message:', err);
    const msg = err.message || 'Failed to send message';
    const isDataTooLong = /Data too long|column/i.test(msg);
    res.status(500).json({
      success: false,
      error: msg,
      message: isDataTooLong ? 'File type or name too long. Please try a shorter filename or a different file.' : msg
    });
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
    const message = err.message || 'Upload failed';
    const isSizeError = /too large|limit|size/i.test(message);
    res.status(isSizeError ? 400 : 500).json({
      success: false,
      message: isSizeError ? 'File too large. Chat files are limited to 10MB (Cloudinary free tier). Please use a smaller file or compress it.' : message
    });
  }
};

// Mark messages as read
exports.markAsRead = async (req, res) => {
  const { conversationId, userId, messageId } = req.body;
  try {
    if (messageId) {
      const msgIdStr = String(messageId);
      if (msgIdStr.startsWith('ticket_')) {
        // Merged ticket_message id (from getMessages when merging ticket_messages)
        const ticketMsgId = parseInt(msgIdStr.replace(/^ticket_/, ''), 10);
        if (!isNaN(ticketMsgId)) {
          const [rows] = await pool.query(
            'SELECT ticket_id, sender_id FROM ticket_messages WHERE id = ?',
            [ticketMsgId]
          );
          const row = rows[0];
          if (row && row.sender_id != userId) {
            await pool.query(
              `UPDATE ticket_messages SET read_at = CURRENT_TIMESTAMP 
               WHERE id = ? AND sender_id != ? AND read_at IS NULL`,
              [ticketMsgId, userId]
            );
            const io = req.app.get('io');
            if (io && row.ticket_id) {
              io.to(`user_${row.sender_id}`).emit('ticket_messages_read', {
                ticketId: Number(row.ticket_id),
                messageIds: [ticketMsgId]
              });
            }
          }
        }
      } else {
        // Regular message id (numeric)
        const numericId = parseInt(msgIdStr, 10);
        if (!isNaN(numericId)) {
          await pool.query(
            `UPDATE messages SET is_read = 1, read_at = NOW() 
             WHERE id = ? AND sender_id != ?`,
            [numericId, userId]
          );
        }
      }
    } else if (conversationId) {
      // Mark all messages in conversation as read
      await pool.query(
        `UPDATE messages SET is_read = 1, read_at = NOW() 
         WHERE conversation_id = ? AND sender_id != ? AND is_read = 0`,
        [conversationId, userId]
      );
    }
    // Emit message_read so sender's UI can show "seen" (two ticks)
    const io = req.app.get('io');
    if (io && conversationId) {
      const room = `conversation_${conversationId}`;
      io.to(room).emit('message_read', { conversationId, readerId: userId });
      // Emit conversation_updated so MessageDropdown refetches and clears unread badge
      io.emit('conversation_updated', { conversationId });
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
          WHEN u.role_id = 2 THEN 'Assessor'
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

// Get user profile picture and email by user ID
exports.getUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }
    
    // Get user info
    const [userRows] = await pool.query(
      'SELECT id, name, email, role_id FROM users WHERE id = ?',
      [userId]
    );
    
    if (userRows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    const user = userRows[0];
    let profilePicture = null;
    
    // Get profile picture based on role
    if (user.role_id === 4) { // Student
      const [profileRows] = await pool.query(
        'SELECT profile_picture FROM student_profiles WHERE user_id = ?',
        [userId]
      );
      if (profileRows.length > 0) {
        profilePicture = profileRows[0].profile_picture;
      }
    } else if ([1, 2, 3, 5].includes(user.role_id)) { // Admin, Tutor, Moderator, Manager
      const [profileRows] = await pool.query(
        'SELECT profile_picture FROM staff_profiles WHERE user_id = ?',
        [userId]
      );
      if (profileRows.length > 0) {
        profilePicture = profileRows[0].profile_picture;
      }
    }
    
    res.json({
      success: true,
      profile_picture: profilePicture,
      email: user.email
    });
  } catch (err) {
    console.error('Error fetching user profile:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Edit message
exports.editMessage = async (req, res) => {
  try {
    const { messageId, message, senderId } = req.body;
    
    if (!messageId || !message || !senderId) {
      return res.status(400).json({ success: false, message: 'Message ID, message text, and sender ID are required' });
    }
    
    // Check if user owns the message
    const [messageRows] = await pool.query(
      'SELECT sender_id, conversation_id FROM messages WHERE id = ? AND is_deleted = 0',
      [messageId]
    );
    
    if (messageRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }
    
    if (messageRows[0].sender_id !== senderId) {
      return res.status(403).json({ success: false, message: 'You can only edit your own messages' });
    }

    const convId = messageRows[0].conversation_id;
    if (convId) {
      const [ticketRow] = await pool.query('SELECT status FROM tickets WHERE conversation_id = ?', [convId]);
      if (ticketRow[0] && ticketRow[0].status === 'resolved') {
        return res.status(403).json({ success: false, message: 'Ticket is closed' });
      }
    }
    
    // Check if is_edited column exists, if not add it
    try {
      const [columns] = await pool.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'messages' 
         AND COLUMN_NAME = 'is_edited'`
      );
      
      if (columns.length === 0) {
        // Add is_edited and edited_at columns
        try {
          await pool.query(
            `ALTER TABLE messages 
             ADD COLUMN is_edited TINYINT(1) DEFAULT 0`
          );
        } catch (e) {
          // Column might already exist, ignore
          if (!e.message.includes('Duplicate column name')) {
            throw e;
          }
        }
        
        try {
          await pool.query(
            `ALTER TABLE messages 
             ADD COLUMN edited_at TIMESTAMP NULL`
          );
        } catch (e) {
          // Column might already exist, ignore
          if (!e.message.includes('Duplicate column name')) {
            throw e;
          }
        }
      }
    } catch (alterError) {
      console.error('Error checking/adding columns:', alterError);
      // Continue anyway - columns might already exist
    }
    
    // Update message - use try/catch to handle case where columns don't exist yet
    try {
      await pool.query(
        `UPDATE messages SET message = ?, is_edited = 1, edited_at = NOW(), updated_at = NOW() WHERE id = ?`,
        [message, messageId]
      );
    } catch (updateError) {
      // If columns don't exist, update without them
      if (updateError.message && updateError.message.includes('Unknown column')) {
        console.log('Columns not found, updating message without edit fields');
        await pool.query(
          `UPDATE messages SET message = ?, updated_at = NOW() WHERE id = ?`,
          [message, messageId]
        );
      } else {
        throw updateError;
      }
    }
    
    // Get updated message
    const [updatedMessage] = await pool.query(
      `SELECT m.*, u.name AS sender_name, u.email AS sender_email,
              COALESCE(m.is_edited, 0) as is_edited, m.edited_at
       FROM messages m
       LEFT JOIN users u ON m.sender_id = u.id
       WHERE m.id = ?`,
      [messageId]
    );
    
    // Emit to socket for real-time update
    const io = req.app.get('io');
    if (io && updatedMessage[0]) {
      const [conversation] = await pool.query(
        'SELECT id FROM conversations WHERE id = (SELECT conversation_id FROM messages WHERE id = ?)',
        [messageId]
      );
      if (conversation.length > 0) {
        const room = `conversation_${conversation[0].id}`;
        io.to(room).emit("message_edited", updatedMessage[0]);
      }
    }
    
    res.json({ success: true, message: updatedMessage[0] });
  } catch (err) {
    console.error('Error editing message:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Delete message
exports.deleteMessage = async (req, res) => {
  try {
    const { messageId, senderId } = req.body;
    
    if (!messageId || !senderId) {
      return res.status(400).json({ success: false, message: 'Message ID and sender ID are required' });
    }
    
    // Check if user owns the message
    const [messageRows] = await pool.query(
      'SELECT sender_id, conversation_id FROM messages WHERE id = ? AND is_deleted = 0',
      [messageId]
    );
    
    if (messageRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }
    
    if (messageRows[0].sender_id !== senderId) {
      return res.status(403).json({ success: false, message: 'You can only delete your own messages' });
    }

    const [ticketRow] = await pool.query(
      'SELECT tk.status FROM tickets tk JOIN messages m ON tk.conversation_id = m.conversation_id WHERE m.id = ?',
      [messageId]
    );
    if (ticketRow[0] && ticketRow[0].status === 'resolved') {
      return res.status(403).json({ success: false, message: 'Ticket is closed' });
    }
    
    const conversationId = messageRows[0].conversation_id;
    
    // Soft delete message
    await pool.query(
      `UPDATE messages SET is_deleted = 1, deleted_at = NOW(), updated_at = NOW() WHERE id = ?`,
      [messageId]
    );
    
    // Emit to socket for real-time update
    const io = req.app.get('io');
    if (io) {
      const room = `conversation_${conversationId}`;
      io.to(room).emit("message_deleted", { messageId, conversationId });
    }
    
    res.json({ success: true, message: 'Message deleted successfully' });
  } catch (err) {
    console.error('Error deleting message:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
