const pool = require('../config/db');
const bcrypt = require('bcrypt');
const cloudinary = require('../config/cloudinary');
const { invalidateCache } = require('../middleware/cache');
const { createNotification } = require('../utils/notificationHelper');
const { fetchStudentQualProgress } = require('../services/studentQualProgressService');

// Auto-routing: category -> department_id
const CATEGORY_TO_DEPARTMENT = {
  'Course Related': 1,
  'Feedback / Assignment': 1,
  'Financial': 2,
  'Technical': 3,
  'General': 3,
  'Admission': 3,
  'Certificate': 3
};

const DEPARTMENT_IDS = { Academic: 1, Finance: 2, Support: 3 };

// Default department for staff roles when user.department_id is not set
const ROLE_DEFAULT_DEPARTMENT = {
  'Operation Manager': 1, 'operation_manager': 1, 'Operation_manager': 1,
  'Accounts Manager': 2, 'accounts_manager': 2, 'Accounts_manager': 2,
  'Admission Manager': 3, 'admission_manager': 3, 'Admission_manager': 3,
  'Administrative Manager': 3, 'administrative_manager': 3, 'Administrative_manager': 3
};

function getDefaultDeptForRole(roleName) {
  if (!roleName) return null;
  return ROLE_DEFAULT_DEPARTMENT[roleName] ?? ROLE_DEFAULT_DEPARTMENT[String(roleName).replace(/\s+/g, '_')] ?? ROLE_DEFAULT_DEPARTMENT[String(roleName).replace(/_/g, ' ')];
}

const TICKET_ROLE_NAMES = ['Admin', 'Operation Manager', 'Accounts Manager', 'Admission Manager', 'Assessor'];

// Get role name from role_id (exported for chatController department visibility)
async function getRoleName(roleId) {
  if (!roleId) return null;
  const [rows] = await pool.execute('SELECT name FROM roles WHERE id = ?', [roleId]);
  return rows.length > 0 ? rows[0].name : null;
}
exports.getRoleName = getRoleName;

// Get effective department for ticket access (team members use manager's department) (exported for chatController)
async function getEffectiveDepartmentId(userId, roleName) {
  const [rows] = await pool.execute('SELECT department_id, manager_id FROM users WHERE id = ?', [userId]);
  const user = rows[0];
  if (!user) return null;
  let deptId = user.department_id;
  if (user.manager_id) {
    const [mgr] = await pool.execute('SELECT department_id FROM users WHERE id = ?', [user.manager_id]);
    deptId = mgr[0]?.department_id ?? deptId;
  }
  if (!deptId) deptId = getDefaultDeptForRole(roleName);
  return deptId;
}
exports.getEffectiveDepartmentId = getEffectiveDepartmentId;

// Check if user can access ticket (Super Admin or same department; team members use manager's dept; OM/Team see all)
// Optional 5th param: full ticket object - when user is assigned_to or escalated_to, grant access regardless of department
async function canAccessTicket(userId, userRoleId, userRoleName, ticketDepartmentId, ticket) {
  const uid = parseInt(userId, 10);
  if (ticket && (ticket.assigned_to === uid || ticket.escalated_to === uid)) return true;
  const roleName = userRoleName || await getRoleName(userRoleId);
  if (roleName === 'Admin') return true;
  // Certificate Manager: only tickets with category Certificate (chat and queries about certificates)
  if (roleName === 'Certificate Manager' && ticket && String(ticket.category || '').toLowerCase().trim() === 'certificate') return true;
  // Operation Manager and Team Member can access tickets from all departments
  const omOrTeam = ['Operation Manager', 'Operation_manager', 'operation_manager', 'Team Member', 'Team_member', 'team_member'].includes(roleName || '');
  if (omOrTeam) return true;
  // Assessor: only escalated academic tickets (or when assigned/escalated via ticket param above)
  if (roleName === 'Assessor') return ticketDepartmentId === 1;
  const userDeptId = await getEffectiveDepartmentId(userId, roleName);
  return userDeptId === ticketDepartmentId;
}

// POST /upload - Upload file for ticket message (Cloudinary)
exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const file = req.file;
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: 'lms/tickets',
          resource_type: 'auto',
          public_id: `ticket_${Date.now()}_${(file.originalname || 'file').replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 80)}`,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(file.buffer);
    });
    res.json({
      success: true,
      file: {
        url: result.secure_url,
        name: file.originalname,
        type: file.mimetype || 'application/octet-stream'
      }
    });
  } catch (err) {
    console.error('[Tickets] Error uploading file:', err);
    res.status(500).json({ success: false, message: err.message || 'Upload failed' });
  }
};

// GET /departments - List all departments
exports.getDepartments = async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT id, name, color FROM departments ORDER BY id');
    res.json({ success: true, departments: rows });
  } catch (err) {
    console.error('[Tickets] Error fetching departments:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST / - Create ticket (student self-service or staff on behalf of student)
exports.createTicket = async (req, res) => {
  try {
    const { subject, category } = req.body;
    const roleName = (await getRoleName(req.user.role_id)) || req.user.role || '';
    const STUDENT_ROLES = ['Student', 'ManagerStudent', 'InstituteStudent'];
    const STAFF_ROLES = [
      'Admin',
      'Assessor',
      'Manager',
      'Moderator',
      'Operation Manager',
      'Accounts Manager',
      'Administrative Manager',
      'Admission Manager',
      'Team Member',
      'Certificate Manager',
      'Claim Manager',
      'Consultation Manager',
    ];
    const isStudent = STUDENT_ROLES.includes(roleName);
    const isStaff = STAFF_ROLES.includes(roleName);

    let studentId = req.user.id;
    const staffInitiated = isStaff && req.body.student_id != null && req.body.student_id !== '';

    if (staffInitiated) {
      studentId = parseInt(req.body.student_id, 10);
      if (!studentId || Number.isNaN(studentId)) {
        return res.status(400).json({ success: false, message: 'Invalid student_id' });
      }
      const [studentCheck] = await pool.execute(
        `SELECT u.id, u.name, r.name AS role_name
         FROM users u
         LEFT JOIN roles r ON r.id = u.role_id
         WHERE u.id = ?
         LIMIT 1`,
        [studentId]
      );
      if (!studentCheck.length) {
        return res.status(404).json({ success: false, message: 'Student not found' });
      }
      if (!STUDENT_ROLES.includes(studentCheck[0].role_name)) {
        return res.status(400).json({ success: false, message: 'Target user is not a student' });
      }
    } else if (!isStudent && req.body.student_id) {
      return res.status(403).json({ success: false, message: 'Only staff can create tickets on behalf of students' });
    }

    if (!subject || !category) {
      return res.status(400).json({ success: false, message: 'Subject and category are required' });
    }

    const departmentId = CATEGORY_TO_DEPARTMENT[category] || DEPARTMENT_IDS.Support;
    const staffUserId = req.user.id;
    const initialStatus = staffInitiated ? 'in_progress' : 'open';

    const [result] = await pool.execute(
      `INSERT INTO tickets (student_id, department_id, subject, category, status, priority) 
       VALUES (?, ?, ?, ?, ?, 'medium')`,
      [studentId, departmentId, subject, category, initialStatus]
    );

    const ticketId = result.insertId;
    const messageText = req.body.message && String(req.body.message).trim();
    const fileUrl = req.body.file_url && String(req.body.file_url).trim();
    const fileName = req.body.file_name ? String(req.body.file_name).slice(0, 255) : null;
    const fileType = req.body.file_type ? String(req.body.file_type).slice(0, 50) : null;
    const hasFile = !!fileUrl;
    const msgText = messageText || (hasFile ? '[Attachment]' : null);
    let conversationId = null;

    if (staffInitiated) {
      const [convResult] = await pool.execute(
        `INSERT INTO conversations (student_id, tutor_id, admin_id, course_id, conversation_type, title, last_message_at, updated_at)
         VALUES (?, NULL, ?, NULL, 'ticket', ?, NOW(), NOW())`,
        [studentId, staffUserId, String(subject).slice(0, 255)]
      );
      conversationId = convResult.insertId;

      await pool.execute(
        `UPDATE tickets SET conversation_id = ?, assigned_to = ?, status = 'in_progress' WHERE id = ?`,
        [conversationId, staffUserId, ticketId]
      );

      if (msgText) {
        const [tmResult] = await pool.execute(
          `INSERT INTO ticket_messages (ticket_id, sender_id, message, file_url, file_name, file_type, is_internal)
           VALUES (?, ?, ?, ?, ?, ?, 0)`,
          [ticketId, staffUserId, msgText, fileUrl || null, fileName, fileType]
        );
        const messageType = fileUrl
          ? (fileType && /^image\//i.test(fileType) ? 'image' : fileType && /pdf/i.test(fileType) ? 'pdf' : 'file')
          : 'text';
        await pool.execute(
          `INSERT INTO messages (conversation_id, sender_id, message, file_url, file_name, file_type, file_size, message_type, created_at)
           VALUES (?, ?, ?, ?, ?, ?, NULL, ?, NOW())`,
          [conversationId, staffUserId, msgText, fileUrl || null, fileName, fileType, messageType]
        );

        const [staffRow] = await pool.execute('SELECT name FROM users WHERE id = ?', [staffUserId]);
        const senderName = staffRow[0]?.name || 'Support team';
        const [newMsg] = await pool.execute(
          'SELECT tm.*, u.name AS sender_name FROM ticket_messages tm JOIN users u ON tm.sender_id = u.id WHERE tm.id = ?',
          [tmResult.insertId]
        );

        const io = req.app.get('io');
        if (io) {
          const ticketMsgPayload = { ticketId: Number(ticketId), message: newMsg[0] };
          io.to(`user_${studentId}`).emit('ticket_message', ticketMsgPayload);
          io.to(`conversation_${conversationId}`).emit('ticket_message', ticketMsgPayload);
          io.to(`conversation_${conversationId}`).emit('receive_message', {
            id: tmResult.insertId,
            conversation_id: conversationId,
            sender_id: staffUserId,
            sender_name: senderName,
            message: msgText,
            file_url: fileUrl || null,
            file_name: fileName,
            file_type: fileType,
            created_at: newMsg[0].created_at,
          });
          io.emit('conversation_updated', { conversationId });
          io.emit('ticket_updated', {
            ticketId: Number(ticketId),
            assigned_to: staffUserId,
            assigned_to_name: senderName,
            status: 'in_progress',
            student_id: studentId,
          });
        }

        try {
          await createNotification({
            userId: studentId,
            type: 'ticket',
            title: 'New message from support team',
            message: `${senderName} sent you a message regarding: ${subject}`,
            relatedUserId: staffUserId,
            relatedConversationId: conversationId,
            req,
          });
        } catch (notifErr) {
          console.warn('[Tickets] Staff-initiated notification:', notifErr.message);
        }
      } else {
        const io = req.app.get('io');
        if (io) {
          io.to(`user_${studentId}`).emit('ticket_updated', {
            ticketId: Number(ticketId),
            assigned_to: staffUserId,
            status: 'in_progress',
            student_id: studentId,
          });
          io.emit('conversation_updated', { conversationId });
        }
      }
    } else if (msgText) {
      await pool.execute(
        'INSERT INTO ticket_messages (ticket_id, sender_id, message, file_url, file_name, file_type, is_internal) VALUES (?, ?, ?, ?, ?, ?, 0)',
        [ticketId, studentId, msgText, fileUrl || null, fileName, fileType]
      );
    }

    invalidateCache('cache:/api/tickets*');
    if (staffInitiated) {
      invalidateCache('cache:/api/chat*');
    }

    res.json({
      success: true,
      ticketId,
      conversationId: conversationId || undefined,
      message: staffInitiated ? 'Message sent to student successfully' : 'Ticket created successfully',
    });
  } catch (err) {
    console.error('[Tickets] Error creating ticket:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET / - List tickets (filtered by role and department)
exports.getTickets = async (req, res) => {
  try {
    const userId = req.user.id;
    const roleId = req.user.role_id;
    const roleName = await getRoleName(roleId);

    const { department, status, category, page = 1, limit = 25 } = req.query;
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const offset = (pageNum - 1) * limitNum;

    let whereClause = '1=1';
    const params = [];

    // Certificate Manager: see only certificate-related tickets (student queries about certificates)
    if (roleName === 'Certificate Manager') {
      whereClause = "LOWER(TRIM(t.category)) = 'certificate'";
      params.length = 0;
    }
    // Admin, Operation Manager, Team Member see all departments
    else if (roleName !== 'Admin' && roleName !== 'Operation Manager' && roleName !== 'Operation_manager' && roleName !== 'operation_manager' && roleName !== 'Team Member' && roleName !== 'Team_member' && roleName !== 'team_member') {
      let userDeptId = await getEffectiveDepartmentId(userId, roleName);

      if (roleName === 'Student' || roleName === 'ManagerStudent' || roleName === 'InstituteStudent') {
        // Students see only their own tickets
        whereClause = 't.student_id = ?';
        params.push(userId);
      } else if (roleName === 'Assessor') {
        // Assessor sees only escalated academic tickets
        whereClause = 't.department_id = 1 AND t.status = ?';
        params.push('escalated');
      } else if (userDeptId) {
        whereClause = 't.department_id = ?';
        params.push(userDeptId);
      } else {
        // No department - see nothing
        whereClause = '1=0';
      }
    }

    if (department) {
      whereClause += ' AND t.department_id = ?';
      params.push(parseInt(department, 10) || department);
    }
    if (status) {
      whereClause += ' AND t.status = ?';
      params.push(status);
    }
    if (category) {
      whereClause += ' AND LOWER(TRIM(t.category)) = LOWER(TRIM(?))';
      params.push(String(category));
    }

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM tickets t WHERE ${whereClause}`,
      params
    );
    const total = countRows[0]?.total || 0;

    // Use literal LIMIT/OFFSET (validated integers) - MySQL can reject ? placeholders for LIMIT/OFFSET
    const [rows] = await pool.execute(
      `SELECT t.*, 
        u.name as student_name, u.email as student_email,
        d.name as department_name, d.color as department_color,
        au.name as assigned_to_name
       FROM tickets t
       JOIN users u ON t.student_id = u.id
       JOIN departments d ON t.department_id = d.id
       LEFT JOIN users au ON t.assigned_to = au.id
       WHERE ${whereClause}
       ORDER BY t.created_at DESC
       LIMIT ${limitNum} OFFSET ${offset}`,
      params
    );

    res.json({
      success: true,
      tickets: rows,
      pagination: { page: parseInt(page) || 1, limit: parseInt(limit) || 25, total, totalPages: Math.ceil(total / (parseInt(limit) || 25)) }
    });
  } catch (err) {
    console.error('[Tickets] Error fetching tickets:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /stats - Dashboard stats
exports.getStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const roleId = req.user.role_id;
    const roleName = await getRoleName(roleId);

    let whereClause = '1=1';
    const params = [];

    // Certificate Manager: stats for certificate-related tickets only
    if (roleName === 'Certificate Manager') {
      whereClause = "LOWER(TRIM(category)) = 'certificate'";
      params.length = 0;
    } else if (roleName !== 'Admin' && !['Operation Manager', 'Operation_manager', 'operation_manager', 'Team Member', 'Team_member', 'team_member'].includes(roleName || '')) {
      const userDeptId = await getEffectiveDepartmentId(userId, roleName);
      if (roleName === 'Student' || roleName === 'ManagerStudent' || roleName === 'InstituteStudent') {
        whereClause = 'student_id = ?';
        params.push(userId);
      } else if (roleName === 'Assessor') {
        whereClause = 'department_id = 1 AND status = ?';
        params.push('escalated');
      } else if (userDeptId) {
        whereClause = 'department_id = ?';
        params.push(userDeptId);
      } else {
        whereClause = '1=0';
      }
    }

    const [stats] = await pool.execute(
      `SELECT 
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_count,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_count,
        SUM(CASE WHEN status = 'escalated' THEN 1 ELSE 0 END) as escalated_count,
        SUM(CASE WHEN status = 'resolved' AND DATE(resolved_at) = CURDATE() THEN 1 ELSE 0 END) as resolved_today
       FROM tickets WHERE ${whereClause}`,
      params
    );

    res.json({
      success: true,
      stats: {
        open: parseInt(stats[0]?.open_count || 0),
        inProgress: parseInt(stats[0]?.in_progress_count || 0),
        escalated: parseInt(stats[0]?.escalated_count || 0),
        resolvedToday: parseInt(stats[0]?.resolved_today || 0)
      }
    });
  } catch (err) {
    console.error('[Tickets] Error fetching stats:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /:id - Ticket detail with messages
exports.getTicket = async (req, res) => {
  try {
    const ticketId = req.params.id;
    const userId = req.user.id;
    const roleId = req.user.role_id;
    const roleName = await getRoleName(roleId);

    const [tickets] = await pool.execute(
      `SELECT t.*, 
        u.name as student_name, u.email as student_email,
        d.name as department_name, d.color as department_color,
        au.name as assigned_to_name, au.email as assigned_to_email,
        asp.profile_picture as assigned_to_profile_picture,
        eu.name as escalated_to_name
       FROM tickets t
       JOIN users u ON t.student_id = u.id
       JOIN departments d ON t.department_id = d.id
       LEFT JOIN users au ON t.assigned_to = au.id
       LEFT JOIN staff_profiles asp ON au.id = asp.user_id
       LEFT JOIN users eu ON t.escalated_to = eu.id
       WHERE t.id = ?`,
      [ticketId]
    );

    if (tickets.length === 0) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    const ticket = tickets[0];
    // Department manager profile pic (for student header when no assignee): use assignee pic, else first manager of that dept
    let headerProfilePicture = ticket.assigned_to_profile_picture;
    if (!headerProfilePicture && ticket.department_id) {
      const managerRoles = { 1: ['Operation Manager', 'operation_manager', 'Operation_manager'], 2: ['Accounts Manager', 'accounts_manager', 'Accounts_manager'], 3: ['Admission Manager', 'admission_manager', 'Administrative Manager', 'administrative_manager'] };
      const roles = managerRoles[ticket.department_id] || [];
      if (roles.length > 0) {
        const placeholders = roles.map(() => '?').join(',');
        const [mgrRows] = await pool.execute(
          `SELECT sp.profile_picture FROM users u
           JOIN staff_profiles sp ON u.id = sp.user_id
           JOIN roles r ON u.role_id = r.id
           WHERE u.department_id = ? AND r.name IN (${placeholders}) AND sp.profile_picture IS NOT NULL
           LIMIT 1`,
          [ticket.department_id, ...roles]
        );
        if (mgrRows.length > 0) headerProfilePicture = mgrRows[0].profile_picture;
      }
    }
    ticket.header_profile_picture = headerProfilePicture;
    const isStudentRole = roleName === 'Student' || roleName === 'ManagerStudent' || roleName === 'InstituteStudent';
    const isOwnTicket = ticket.student_id === userId;
    const canAccess = isOwnTicket || await canAccessTicket(userId, roleId, roleName, ticket.department_id, ticket);
    if (!canAccess) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Students see only public messages; staff see all
    const isStudent = isStudentRole;
    const [messages] = await pool.execute(
      `SELECT tm.*, u.name as sender_name, r.name as sender_role_name
       FROM ticket_messages tm
       JOIN users u ON tm.sender_id = u.id
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE tm.ticket_id = ? ${isStudent ? 'AND tm.is_internal = 0' : ''}
       ORDER BY tm.created_at ASC`,
      [ticketId]
    );

    // Internal notes: only staff see them
    let notes = [];
    if (!isStudentRole) {
      const [noteRows] = await pool.execute(
        `SELECT in_.*, u.name as user_name 
         FROM internal_notes in_
         JOIN users u ON in_.user_id = u.id
         WHERE in_.ticket_id = ?
         ORDER BY in_.created_at ASC`,
        [ticketId]
      );
      notes = noteRows;
    }

    res.json({ success: true, ticket, messages, internalNotes: notes });
  } catch (err) {
    console.error('[Tickets] Error fetching ticket:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /:id/claim - Claim ticket
exports.claimTicket = async (req, res) => {
  try {
    const ticketId = req.params.id;
    const userId = req.user.id;
    const roleName = await getRoleName(req.user.role_id);

    const [tickets] = await pool.execute('SELECT * FROM tickets WHERE id = ?', [ticketId]);
    if (tickets.length === 0) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    const ticket = tickets[0];
    if (ticket.assigned_to) {
      return res.status(400).json({ success: false, message: 'Ticket already claimed' });
    }

    const canAccess = await canAccessTicket(userId, req.user.role_id, roleName, ticket.department_id, ticket);
    if (!canAccess) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    let conversationId = ticket.conversation_id;
    if (!conversationId) {
      const [convResult] = await pool.execute(
        `INSERT INTO conversations (student_id, tutor_id, admin_id, course_id, conversation_type, title)
         VALUES (?, NULL, ?, NULL, 'ticket', ?)`,
        [ticket.student_id, userId, (ticket.subject || 'Support ticket').slice(0, 255)]
      );
      conversationId = convResult.insertId;
      const [ticketMsgs] = await pool.execute(
        'SELECT sender_id, message, file_url, file_name, file_type FROM ticket_messages WHERE ticket_id = ? AND is_internal = 0 ORDER BY created_at ASC',
        [ticketId]
      );
      for (const tm of ticketMsgs) {
        await pool.execute(
          `INSERT INTO messages (conversation_id, sender_id, message, file_url, file_name, file_type, file_size, message_type)
           VALUES (?, ?, ?, ?, ?, ?, NULL, 'text')`,
          [conversationId, tm.sender_id, tm.message || '', tm.file_url || null, tm.file_name || null, (tm.file_type || '').slice(0, 100)]
        );
      }
      await pool.execute(
        'UPDATE conversations SET last_message_at = NOW(), updated_at = NOW() WHERE id = ?',
        [conversationId]
      );
    }

    const [assigneeRow] = await pool.execute('SELECT name FROM users WHERE id = ?', [userId]);
    const assigneeName = assigneeRow[0]?.name || 'Someone';
    await pool.execute(
      'UPDATE tickets SET assigned_to = ?, status = ?, conversation_id = ? WHERE id = ?',
      [userId, 'in_progress', conversationId || ticket.conversation_id, ticketId]
    );

    invalidateCache('cache:/api/tickets*');
    invalidateCache('cache:/api/chat*');
    const io = req.app.get('io');
    if (io) {
      io.emit('ticket_updated', { ticketId: Number(ticketId), assigned_to: userId, assigned_to_name: assigneeName, status: 'in_progress', student_id: ticket.student_id });
    }
    res.json({ success: true, message: 'Ticket claimed', conversationId: conversationId || ticket.conversation_id });
  } catch (err) {
    console.error('[Tickets] Error claiming ticket:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /:id/status - Update status (in_progress, resolved)
exports.updateStatus = async (req, res) => {
  try {
    const ticketId = req.params.id;
    const { status } = req.body;
    const userId = req.user.id;

    if (!['in_progress', 'resolved'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const [tickets] = await pool.execute('SELECT * FROM tickets WHERE id = ?', [ticketId]);
    if (tickets.length === 0) return res.status(404).json({ success: false, message: 'Ticket not found' });

    const ticket = tickets[0];
    const canAccess = await canAccessTicket(userId, req.user.role_id, null, ticket.department_id, ticket);
    if (!canAccess) return res.status(403).json({ success: false, message: 'Access denied' });

    const updates = status === 'resolved'
      ? ['status = ?, resolved_at = NOW()', status]
      : ['status = ?', status];

    await pool.execute(`UPDATE tickets SET ${updates[0]} WHERE id = ?`, [...updates.slice(1), ticketId]);

    // When marking resolved, mark all messages in this conversation/ticket as read for the current user so "Messages" dropdown stops showing unread
    if (status === 'resolved' && ticket.conversation_id) {
      try {
        await pool.execute(
          'UPDATE messages SET is_read = 1, read_at = NOW() WHERE conversation_id = ? AND sender_id != ? AND (is_read = 0 OR is_read IS NULL)',
          [ticket.conversation_id, userId]
        );
        await pool.execute(
          'UPDATE ticket_messages SET read_at = CURRENT_TIMESTAMP WHERE ticket_id = ? AND sender_id != ? AND read_at IS NULL',
          [ticketId, userId]
        );
      } catch (readErr) {
        console.error('[Tickets] Error marking messages read on resolve:', readErr);
      }
    }

    invalidateCache('cache:/api/tickets*');
    invalidateCache('cache:/api/chat*');
    const io = req.app.get('io');
    if (io) {
      io.emit('ticket_updated', {
        ticketId: Number(ticketId),
        status,
        assigned_to: ticket.assigned_to,
        student_id: ticket.student_id,
        conversation_id: ticket.conversation_id || null
      });
    }
    res.json({ success: true, message: 'Status updated' });
  } catch (err) {
    console.error('[Tickets] Error updating status:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /:id/reassign - Reassign ticket to another agent
exports.reassignTicket = async (req, res) => {
  try {
    const ticketId = req.params.id;
    const { assigned_to } = req.body;
    const userId = req.user.id;

    if (!assigned_to) {
      return res.status(400).json({ success: false, message: 'assigned_to is required' });
    }

    const [tickets] = await pool.execute('SELECT * FROM tickets WHERE id = ?', [ticketId]);
    if (tickets.length === 0) return res.status(404).json({ success: false, message: 'Ticket not found' });

    const ticket = tickets[0];
    const canAccess = await canAccessTicket(userId, req.user.role_id, null, ticket.department_id, ticket);
    if (!canAccess) return res.status(403).json({ success: false, message: 'Access denied' });

    const [assigneeRow] = await pool.execute('SELECT name FROM users WHERE id = ?', [assigned_to]);
    const assigneeName = assigneeRow[0]?.name || '';
    await pool.execute(
      'UPDATE tickets SET assigned_to = ? WHERE id = ?',
      [assigned_to, ticketId]
    );

    invalidateCache('cache:/api/tickets*');
    invalidateCache('cache:/api/chat*');
    const io = req.app.get('io');
    if (io) {
      io.emit('ticket_updated', { ticketId: Number(ticketId), assigned_to, assigned_to_name: assigneeName, status: ticket.status, student_id: ticket.student_id });
    }
    res.json({ success: true, message: 'Ticket reassigned' });
  } catch (err) {
    console.error('[Tickets] Error reassigning ticket:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /:id/transfer - Transfer ticket to another department (managers only)
const MANAGER_ROLES_FOR_TRANSFER = ['Admin', 'Operation Manager', 'Accounts Manager', 'Administrative Manager', 'Admission Manager'];
exports.transferTicket = async (req, res) => {
  try {
    const ticketId = req.params.id;
    const { department_id, assigned_to } = req.body;
    const userId = req.user.id;
    const roleName = await getRoleName(req.user.role_id);

    const allowed = MANAGER_ROLES_FOR_TRANSFER.some(r => (roleName || '').toLowerCase().replace(/\s+/g, '_') === r.toLowerCase().replace(/\s+/g, '_'));
    if (!allowed) {
      return res.status(403).json({ success: false, message: 'Only managers can transfer tickets to another department' });
    }

    const newDeptId = department_id != null ? parseInt(department_id, 10) : null;
    if (!newDeptId || newDeptId < 1) {
      return res.status(400).json({ success: false, message: 'Valid department_id is required' });
    }

    const [tickets] = await pool.execute('SELECT * FROM tickets WHERE id = ?', [ticketId]);
    if (tickets.length === 0) return res.status(404).json({ success: false, message: 'Ticket not found' });

    const ticket = tickets[0];
    const canAccess = await canAccessTicket(userId, req.user.role_id, null, ticket.department_id, ticket);
    if (!canAccess) return res.status(403).json({ success: false, message: 'Access denied' });

    const [deptRows] = await pool.execute('SELECT id FROM departments WHERE id = ?', [newDeptId]);
    if (deptRows.length === 0) return res.status(400).json({ success: false, message: 'Invalid department' });

    let assigneeId = null;
    let assigneeName = '';
    if (assigned_to != null && assigned_to !== '') {
      const aid = parseInt(assigned_to, 10);
      const [userRows] = await pool.execute('SELECT u.id, u.name, u.department_id FROM users u WHERE u.id = ?', [aid]);
      if (userRows.length === 0) return res.status(400).json({ success: false, message: 'Invalid assigned_to user' });
      if (userRows[0].department_id != null && userRows[0].department_id !== newDeptId) {
        return res.status(400).json({ success: false, message: 'Assigned agent must belong to the target department' });
      }
      assigneeId = aid;
      assigneeName = userRows[0].name || '';
    }

    // When transferred without assignee: status = 'transferred' so receiving dept sees "Transferred" and can claim
    const newStatus = assigneeId ? (ticket.status === 'transferred' ? 'in_progress' : ticket.status) : 'transferred';
    await pool.execute(
      'UPDATE tickets SET department_id = ?, assigned_to = ?, status = ? WHERE id = ?',
      [newDeptId, assigneeId, newStatus, ticketId]
    );

    invalidateCache('cache:/api/tickets*');
    invalidateCache('cache:/api/chat*');
    const io = req.app.get('io');
    if (io) {
      io.emit('ticket_updated', {
        ticketId: Number(ticketId),
        department_id: newDeptId,
        assigned_to: assigneeId,
        assigned_to_name: assigneeName,
        status: newStatus,
        student_id: ticket.student_id
      });
    }
    res.json({ success: true, message: 'Ticket transferred to department' });
  } catch (err) {
    console.error('[Tickets] Error transferring ticket:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const MANAGER_ROLES_FOR_TEAM = ['Operation Manager', 'Accounts Manager', 'Administrative Manager', 'Admission Manager'];

// GET /team - List my team members (users where manager_id = me) with active ticket counts
exports.getMyTeam = async (req, res) => {
  try {
    const userId = req.user.id;
    const roleName = await getRoleName(req.user.role_id);
    if (!MANAGER_ROLES_FOR_TEAM.includes(roleName)) {
      return res.status(403).json({ success: false, error: 'Only department managers can manage teams' });
    }
    const [team] = await pool.execute(
      `SELECT u.id, u.name, u.email, r.name as role_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.manager_id = ?
       ORDER BY u.name`,
      [userId]
    );
    if (team.length === 0) {
      return res.json({ success: true, team });
    }
    const teamIds = team.map(t => t.id);
    const placeholders = teamIds.map(() => '?').join(',');
    const [counts] = await pool.execute(
      `SELECT assigned_to as user_id,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_count,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_count
       FROM tickets
       WHERE assigned_to IN (${placeholders})
       GROUP BY assigned_to`,
      teamIds
    );
    const countMap = {};
    counts.forEach(c => {
      countMap[c.user_id] = { in_progress: c.in_progress_count || 0, open: c.open_count || 0 };
    });
    const teamWithStatus = team.map(t => {
      const c = countMap[t.id] || { in_progress: 0, open: 0 };
      let status = 'offline';
      if (c.in_progress > 0) status = 'busy';
      else if (c.open > 0) status = 'online';
      return { ...t, open_tickets: c.open, in_progress_tickets: c.in_progress, status };
    });
    res.json({ success: true, team: teamWithStatus });
  } catch (err) {
    console.error('[Tickets] Error fetching team:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /team - Add user to my team (set manager_id)
exports.addToTeam = async (req, res) => {
  try {
    const userId = req.user.id;
    const { user_id: targetUserId } = req.body;
    const roleName = await getRoleName(req.user.role_id);
    if (!MANAGER_ROLES_FOR_TEAM.includes(roleName)) {
      return res.status(403).json({ success: false, error: 'Only department managers can add team members' });
    }
    if (!targetUserId) return res.status(400).json({ success: false, error: 'user_id required' });
    const myDeptId = await getEffectiveDepartmentId(userId, roleName);
    const [target] = await pool.execute('SELECT id, department_id FROM users WHERE id = ?', [targetUserId]);
    if (target.length === 0) return res.status(404).json({ success: false, error: 'User not found' });
    if (target[0].department_id && target[0].department_id !== myDeptId) {
      return res.status(400).json({ success: false, error: 'User must be in your department to add to team' });
    }
    await pool.execute('UPDATE users SET manager_id = ? WHERE id = ?', [userId, targetUserId]);
    invalidateCache('cache:/api/tickets*');
    res.json({ success: true, message: 'Added to team' });
  } catch (err) {
    console.error('[Tickets] Error adding to team:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// DELETE /team/:userId - Remove user from my team
exports.removeFromTeam = async (req, res) => {
  try {
    const userId = req.user.id;
    const targetUserId = req.params.userId;
    const roleName = await getRoleName(req.user.role_id);
    if (!MANAGER_ROLES_FOR_TEAM.includes(roleName)) {
      return res.status(403).json({ success: false, error: 'Only department managers can remove team members' });
    }
    const [target] = await pool.execute('SELECT manager_id FROM users WHERE id = ?', [targetUserId]);
    if (target.length === 0) return res.status(404).json({ success: false, error: 'User not found' });
    if (target[0].manager_id !== userId) {
      return res.status(400).json({ success: false, error: 'User is not in your team' });
    }
    await pool.execute('UPDATE users SET manager_id = NULL WHERE id = ?', [targetUserId]);
    invalidateCache('cache:/api/tickets*');
    res.json({ success: true, message: 'Removed from team' });
  } catch (err) {
    console.error('[Tickets] Error removing from team:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /team/create - Create a new team user (name, email, password)
exports.createTeamMember = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, email, password } = req.body;
    const roleName = await getRoleName(req.user.role_id);
    if (!MANAGER_ROLES_FOR_TEAM.includes(roleName)) {
      return res.status(403).json({ success: false, error: 'Only department managers can create team members' });
    }
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'name, email, and password are required' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
    }
    const myDeptId = await getEffectiveDepartmentId(userId, roleName);
    const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [String(email).trim().toLowerCase()]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, error: 'Email already in use' });
    }
    const [roleRow] = await pool.execute("SELECT id FROM roles WHERE name = 'Team Member'");
    const teamMemberRoleId = roleRow[0]?.id;
    if (!teamMemberRoleId) {
      return res.status(500).json({ success: false, error: 'Team Member role not found. Run migration add_team_member_role.sql' });
    }
    const hashedPassword = await bcrypt.hash(String(password), 10);
    const [result] = await pool.execute(
      `INSERT INTO users (name, email, password_hash, role_id, department_id, manager_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [String(name).trim(), String(email).trim().toLowerCase(), hashedPassword, teamMemberRoleId, myDeptId, userId]
    );
    invalidateCache('cache:/api/tickets*');
    res.json({ success: true, userId: result.insertId, message: 'Team member created. They can log in with this email and password.' });
  } catch (err) {
    console.error('[Tickets] Error creating team member:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /team/available - List users in my department who can be added to team (not already in a team or in my team)
exports.getAvailableForTeam = async (req, res) => {
  try {
    const userId = req.user.id;
    const roleName = await getRoleName(req.user.role_id);
    if (!MANAGER_ROLES_FOR_TEAM.includes(roleName)) {
      return res.status(403).json({ success: false, error: 'Only department managers can manage teams' });
    }
    const deptId = await getEffectiveDepartmentId(userId, roleName);
    const [users] = await pool.execute(
      `SELECT u.id, u.name, u.email, r.name as role_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE (u.department_id = ? OR u.department_id IS NULL) AND u.id != ?
       AND r.name IN ('Admin', 'Operation Manager', 'Accounts Manager', 'Administrative Manager', 'Admission Manager', 'Assessor')
       ORDER BY u.name`,
      [deptId, userId]
    );
    const [team] = await pool.execute('SELECT id FROM users WHERE manager_id = ?', [userId]);
    const teamIds = new Set(team.map(t => t.id));
    const available = users.filter(u => !teamIds.has(u.id));
    res.json({ success: true, users: available });
  } catch (err) {
    console.error('[Tickets] Error fetching available users:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /:id/escalate-agents - List only the student's assigned tutor (for Escalate)
exports.getEscalateAgents = async (req, res) => {
  try {
    const ticketId = req.params.id;
    const userId = req.user.id;
    const roleName = await getRoleName(req.user.role_id);

    const [tickets] = await pool.execute('SELECT student_id, department_id FROM tickets WHERE id = ?', [ticketId]);
    if (tickets.length === 0) return res.status(404).json({ success: false, message: 'Ticket not found' });
    const ticket = tickets[0];
    const canAccess = ticket.student_id === userId || await canAccessTicket(userId, req.user.role_id, roleName, ticket.department_id, ticket);
    if (!canAccess) return res.status(403).json({ success: false, message: 'Access denied' });

    const studentId = ticket.student_id;
    if (!studentId) return res.json({ success: true, agents: [] });

    const [student] = await pool.execute('SELECT assigned_tutor_id FROM users WHERE id = ?', [studentId]);
    const assignedTutorId = student[0]?.assigned_tutor_id;
    if (!assignedTutorId) return res.json({ success: true, agents: [] });

    const [tutor] = await pool.execute(
      `SELECT u.id, u.name, u.email FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = ? AND r.name = 'Assessor'`,
      [assignedTutorId]
    );
    res.json({ success: true, agents: tutor || [] });
  } catch (err) {
    console.error('[Tickets] Error fetching escalate agents:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /agents - List department agents for reassign dropdown
exports.getAgents = async (req, res) => {
  try {
    const userId = req.user.id;
    const roleId = req.user.role_id;
    const roleName = await getRoleName(roleId);
    const departmentId = req.query.department;

    let deptId = departmentId ? parseInt(departmentId, 10) : null;
    if (!deptId) {
      deptId = await getEffectiveDepartmentId(userId, roleName);
    }

    if (!deptId) {
      return res.json({ success: true, agents: [] });
    }

    const [agents] = await pool.execute(
      `SELECT u.id, u.name, u.email FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE (u.department_id = ? OR r.name = 'Admin')
       AND r.name IN ('Admin', 'Operation Manager', 'Accounts Manager', 'Administrative Manager', 'Admission Manager', 'Assessor', 'Team Member')
       ORDER BY u.name`,
      [deptId]
    );

    res.json({ success: true, agents });
  } catch (err) {
    console.error('[Tickets] Error fetching agents:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /:id/escalate - Escalate ticket to tutor (assigns to them so they see chat)
exports.escalateTicket = async (req, res) => {
  try {
    const ticketId = req.params.id;
    const { escalate_to } = req.body;
    const userId = req.user.id;

    const [tickets] = await pool.execute('SELECT * FROM tickets WHERE id = ?', [ticketId]);
    if (tickets.length === 0) return res.status(404).json({ success: false, message: 'Ticket not found' });

    const ticket = tickets[0];
    const canAccess = await canAccessTicket(userId, req.user.role_id, null, ticket.department_id, ticket);
    if (!canAccess) return res.status(403).json({ success: false, message: 'Access denied' });

    // Assign to escalated tutor so they see it in chat and can reply
    const newAssignee = escalate_to || null;
    await pool.execute(
      'UPDATE tickets SET status = ?, priority = ?, escalated_at = NOW(), escalated_to = ?, escalated_by = ?, assigned_to = ? WHERE id = ?',
      ['escalated', 'high', newAssignee, userId, newAssignee, ticketId]
    );
    if (ticket.conversation_id && newAssignee) {
      await pool.execute('UPDATE conversations SET tutor_id = ?, updated_at = NOW(), last_message_at = COALESCE(last_message_at, NOW()) WHERE id = ?', [newAssignee, ticket.conversation_id]);
      // Mark messages as unread for the tutor so message icon badge shows (even on page load)
      await pool.execute(
        'UPDATE messages SET is_read = 0 WHERE conversation_id = ? AND sender_id != ? AND (is_deleted = 0 OR is_deleted IS NULL)',
        [ticket.conversation_id, newAssignee]
      );
    }

    invalidateCache('cache:/api/tickets*');
    invalidateCache('cache:/api/chat*');
    const [assigneeRow] = await pool.execute('SELECT name FROM users WHERE id = ?', [newAssignee]);
    const assigneeName = assigneeRow[0]?.name || '';
    const io = req.app.get('io');
    if (io) {
      io.emit('ticket_updated', { ticketId: Number(ticketId), status: 'escalated', escalated_to: newAssignee, assigned_to: newAssignee, assigned_to_name: assigneeName, student_id: ticket.student_id });
      // Notify assessor so they see badge on message icon and can open the ticket
      if (newAssignee) {
        io.to(`user_${newAssignee}`).emit('ticket_escalated_to_you', {
          ticketId: Number(ticketId),
          subject: ticket.subject || 'Support ticket',
          student_id: ticket.student_id
        });
        io.to(`user_${newAssignee}`).emit('unread_count_update', {}); // Trigger message icon badge refresh
      }
    }
    // Create in-app notification for the assessor when chat/ticket is escalated to them
    if (newAssignee) {
      let studentName = 'A student';
      if (ticket.student_id) {
        const [studentRow] = await pool.execute('SELECT name FROM users WHERE id = ?', [ticket.student_id]);
        if (studentRow && studentRow[0]) studentName = studentRow[0].name;
      }
      const subject = ticket.subject || 'Support ticket';
      await createNotification({
        userId: newAssignee,
        type: 'ticket_escalated',
        title: 'Ticket escalated to you',
        message: `${subject} (from ${studentName}) – open Chat to respond.`,
        relatedUserId: ticket.student_id,
        req
      });
    }
    res.json({ success: true, message: 'Ticket escalated' });
  } catch (err) {
    console.error('[Tickets] Error escalating ticket:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /:id/messages - Add message (optionally with file)
exports.addMessage = async (req, res) => {
  try {
    const ticketId = req.params.id;
    const { message, is_internal, file_url, file_name, file_type } = req.body;
    const userId = req.user.id;

    const hasMessage = message && String(message).trim();
    const hasFile = file_url && String(file_url).trim();
    if (!hasMessage && !hasFile) {
      return res.status(400).json({ success: false, message: 'Message or file is required' });
    }

    const [tickets] = await pool.execute('SELECT * FROM tickets WHERE id = ?', [ticketId]);
    if (tickets.length === 0) return res.status(404).json({ success: false, message: 'Ticket not found' });

    const ticket = tickets[0];
    const isOwnTicket = ticket.student_id === userId;
    const canAccess = isOwnTicket || await canAccessTicket(userId, req.user.role_id, null, ticket.department_id, ticket);
    if (!canAccess) return res.status(403).json({ success: false, message: 'Access denied' });

    if (ticket.status === 'resolved') {
      return res.status(403).json({ success: false, message: 'Ticket is closed. You cannot send new messages.' });
    }

    // Students can only add public messages
    const isInternal = isOwnTicket ? 0 : (is_internal === true || is_internal === 1 ? 1 : 0);

    const msgText = hasMessage ? String(message).trim() : '[Attachment]';
    const fileUrl = hasFile ? String(file_url).trim() : null;
    const fileName = file_name ? String(file_name).slice(0, 255) : null;
    const fileTypeVal = file_type ? String(file_type).slice(0, 50) : null;

    const [result] = await pool.execute(
      'INSERT INTO ticket_messages (ticket_id, sender_id, message, file_url, file_name, file_type, is_internal) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [ticketId, userId, msgText, fileUrl, fileName, fileTypeVal, isInternal]
    );

    invalidateCache('cache:/api/tickets*');

    const [newMsg] = await pool.execute(
      'SELECT tm.*, u.name as sender_name FROM ticket_messages tm JOIN users u ON tm.sender_id = u.id WHERE tm.id = ?',
      [result.insertId]
    );

    // Sync to chat messenger: when ticket is linked to a conversation, add to messages so /chat shows it
    if (ticket.conversation_id && !isInternal) {
      try {
        const [msgIns] = await pool.execute(
          `INSERT INTO messages (conversation_id, sender_id, message, file_url, file_name, file_type, file_size, message_type)
           VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
          [
            ticket.conversation_id,
            userId,
            msgText,
            fileUrl,
            fileName,
            fileTypeVal,
            fileUrl ? (fileTypeVal && /^image\//i.test(fileTypeVal) ? 'image' : fileTypeVal && /pdf/i.test(fileTypeVal) ? 'pdf' : 'file') : 'text'
          ]
        );
        await pool.execute(
          'UPDATE conversations SET last_message_at = NOW(), updated_at = NOW() WHERE id = ?',
          [ticket.conversation_id]
        );
        invalidateCache('cache:/api/chat*');
        const chatMsg = { id: msgIns.insertId, conversation_id: ticket.conversation_id, sender_id: userId, sender_name: newMsg[0].sender_name, message: msgText, file_url: fileUrl, file_name: fileName, file_type: fileTypeVal, created_at: newMsg[0].created_at };
        const io = req.app.get('io');
        if (io) {
          io.to(`conversation_${ticket.conversation_id}`).emit('receive_message', chatMsg);
          io.emit('conversation_updated', { conversationId: ticket.conversation_id });
        }
      } catch (syncErr) {
        console.warn('[Tickets] Sync to conversation failed:', syncErr.message);
      }
    }

    const io = req.app.get('io');
    if (io) {
      const ticketMsgPayload = { ticketId: Number(ticketId), message: newMsg[0] };
      // When staff replies, push to student (floating ticket) and to conversation room (staff viewing via chat)
      if (ticket.student_id && userId !== ticket.student_id) {
        io.to(`user_${ticket.student_id}`).emit('ticket_message', ticketMsgPayload);
        if (ticket.conversation_id) {
          io.to(`conversation_${ticket.conversation_id}`).emit('ticket_message', ticketMsgPayload);
        }
      }
      // When student replies: notify staff (badge + auto-open) and push message for instant display
      if (isOwnTicket) {
        if (ticket.assigned_to) {
          io.to(`user_${ticket.assigned_to}`).emit('ticket_reply_from_student', {
            ticketId: Number(ticketId),
            message: newMsg[0],
            subject: ticket.subject || 'Support ticket'
          });
          io.to(`user_${ticket.assigned_to}`).emit('ticket_message', ticketMsgPayload);
        }
        // Also emit to conversation room so staff viewing via chat get instant update (e.g. when no assignee or viewing from tickets)
        if (ticket.conversation_id) {
          io.to(`conversation_${ticket.conversation_id}`).emit('ticket_message', ticketMsgPayload);
        }
      }
    }

    res.json({ success: true, message: newMsg[0] });
  } catch (err) {
    console.error('[Tickets] Error adding message:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /:id/messages/:messageId - Edit ticket message (own only, within 15 min, ticket not resolved)
exports.editTicketMessage = async (req, res) => {
  try {
    const { id: ticketId, messageId } = req.params;
    const { message } = req.body;
    const userId = req.user.id;
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message text is required' });
    }
    const [tickets] = await pool.execute('SELECT * FROM tickets WHERE id = ?', [ticketId]);
    if (tickets.length === 0) return res.status(404).json({ success: false, message: 'Ticket not found' });
    const ticket = tickets[0];
    if (ticket.status === 'resolved') {
      return res.status(403).json({ success: false, message: 'Ticket is closed. You cannot edit messages.' });
    }
    const [rows] = await pool.execute(
      'SELECT id, sender_id, created_at FROM ticket_messages WHERE id = ? AND ticket_id = ?',
      [messageId, ticketId]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Message not found' });
    const msg = rows[0];
    if (msg.sender_id !== userId) {
      return res.status(403).json({ success: false, message: 'You can only edit your own messages' });
    }
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
    if (new Date(msg.created_at) < fifteenMinAgo) {
      return res.status(403).json({ success: false, message: 'You can only edit messages within 15 minutes' });
    }
    await pool.execute('UPDATE ticket_messages SET message = ? WHERE id = ?', [message.trim(), messageId]);
    invalidateCache('cache:/api/tickets*');
    const [updated] = await pool.execute(
      'SELECT tm.*, u.name as sender_name, r.name as sender_role_name FROM ticket_messages tm JOIN users u ON tm.sender_id = u.id LEFT JOIN roles r ON u.role_id = r.id WHERE tm.id = ?',
      [messageId]
    );
    res.json({ success: true, message: updated[0] });
  } catch (err) {
    console.error('[Tickets] Error editing message:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /:id/messages/:messageId - Delete ticket message (own only, soft delete via clearing text)
exports.deleteTicketMessage = async (req, res) => {
  try {
    const { id: ticketId, messageId } = req.params;
    const userId = req.user.id;
    const [tickets] = await pool.execute('SELECT * FROM tickets WHERE id = ?', [ticketId]);
    if (tickets.length === 0) return res.status(404).json({ success: false, message: 'Ticket not found' });
    const ticket = tickets[0];
    if (ticket.status === 'resolved') {
      return res.status(403).json({ success: false, message: 'Ticket is closed. You cannot delete messages.' });
    }
    const [rows] = await pool.execute(
      'SELECT id, sender_id FROM ticket_messages WHERE id = ? AND ticket_id = ?',
      [messageId, ticketId]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Message not found' });
    if (rows[0].sender_id !== userId) {
      return res.status(403).json({ success: false, message: 'You can only delete your own messages' });
    }
    await pool.execute("UPDATE ticket_messages SET message = 'This message was deleted.' WHERE id = ?", [messageId]);
    invalidateCache('cache:/api/tickets*');
    res.json({ success: true, message: 'Message deleted successfully' });
  } catch (err) {
    console.error('[Tickets] Error deleting message:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /:id/mark-read - Mark messages in ticket as read (for double-tick "seen")
exports.markTicketMessagesRead = async (req, res) => {
  try {
    const ticketId = req.params.id;
    const userId = req.user.id;

    const [tickets] = await pool.execute('SELECT * FROM tickets WHERE id = ?', [ticketId]);
    if (tickets.length === 0) return res.status(404).json({ success: false, message: 'Ticket not found' });

    const ticket = tickets[0];
    const isOwnTicket = ticket.student_id === userId;
    const canAccess = isOwnTicket || await canAccessTicket(userId, req.user.role_id, null, ticket.department_id, ticket);
    if (!canAccess) return res.status(403).json({ success: false, message: 'Access denied' });

    let toMark = [];
    try {
      const [rows] = await pool.execute(
        'SELECT id, sender_id FROM ticket_messages WHERE ticket_id = ? AND sender_id != ? AND read_at IS NULL',
        [ticketId, userId]
      );
      toMark = rows;
    } catch (colErr) {
      if (colErr.code === 'ER_BAD_FIELD_ERROR') return res.json({ success: true, marked: 0 });
      throw colErr;
    }
    if (toMark.length === 0) {
      return res.json({ success: true, marked: 0 });
    }

    const ids = toMark.map((r) => r.id);
    const placeholders = ids.map(() => '?').join(',');
    try {
      await pool.execute(
        `UPDATE ticket_messages SET read_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`,
        ids
      );
    } catch (upErr) {
      if (upErr.code === 'ER_BAD_FIELD_ERROR') return res.json({ success: true, marked: 0 });
      throw upErr;
    }
    invalidateCache('cache:/api/tickets*');

    const io = req.app.get('io');
    if (io) {
      const bySender = {};
      toMark.forEach((r) => {
        if (!bySender[r.sender_id]) bySender[r.sender_id] = [];
        bySender[r.sender_id].push(r.id);
      });
      Object.keys(bySender).forEach((senderId) => {
        io.to(`user_${senderId}`).emit('ticket_messages_read', {
          ticketId: Number(ticketId),
          messageIds: bySender[senderId]
        });
      });
    }

    res.json({ success: true, marked: ids.length });
  } catch (err) {
    console.error('[Tickets] Error marking messages read:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /:id/notes - Add internal note
exports.addInternalNote = async (req, res) => {
  try {
    const ticketId = req.params.id;
    const { note } = req.body;
    const userId = req.user.id;

    if (!note || !note.trim()) {
      return res.status(400).json({ success: false, message: 'Note is required' });
    }

    const [tickets] = await pool.execute('SELECT * FROM tickets WHERE id = ?', [ticketId]);
    if (tickets.length === 0) return res.status(404).json({ success: false, message: 'Ticket not found' });

    const ticket = tickets[0];
    const canAccess = await canAccessTicket(userId, req.user.role_id, null, ticket.department_id, ticket);
    if (!canAccess) return res.status(403).json({ success: false, message: 'Access denied' });

    const [result] = await pool.execute(
      'INSERT INTO internal_notes (ticket_id, user_id, note) VALUES (?, ?, ?)',
      [ticketId, userId, note.trim()]
    );

    invalidateCache('cache:/api/tickets*');

    const [newNote] = await pool.execute(
      'SELECT in_.*, u.name as user_name FROM internal_notes in_ JOIN users u ON in_.user_id = u.id WHERE in_.id = ?',
      [result.insertId]
    );

    res.json({ success: true, note: newNote[0] });
  } catch (err) {
    console.error('[Tickets] Error adding note:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /categories - List categories for student form
exports.getCategories = (req, res) => {
  res.json({
    success: true,
    categories: [
      { value: 'Course Related', department: 'Academic' },
      { value: 'Feedback / Assignment', department: 'Academic' },
      { value: 'Financial', department: 'Finance' },
      { value: 'Certificate', department: 'Support' },
      { value: 'Technical', department: 'Support' },
      { value: 'General', department: 'Support' },
      { value: 'Admission', department: 'Support' }
    ]
  });
};

function canStaffViewStudentProgress(roleName) {
  const staffRoles = ['Admin', 'Certificate Manager', 'Claim Manager', 'Operation Manager', 'Operation_manager', 'operation_manager', 'Assessor', 'Accounts Manager', 'Admission Manager', 'Administrative Manager', 'Team Member', 'Team_member', 'team_member', 'Consultation Manager'];
  const norm = (roleName || '').toLowerCase().replace(/\s+/g, '_');
  return staffRoles.some((r) => r.toLowerCase().replace(/\s+/g, '_') === norm);
}

// GET /student/:studentId/qual-progress - Rich unit progress (deadlines, grading, files)
exports.getStudentQualProgress = async (req, res) => {
  try {
    const studentId = Number(req.params.studentId);
    if (!studentId) {
      return res.status(400).json({ success: false, message: 'Invalid student id' });
    }

    const userId = req.user.id;
    const roleName = await getRoleName(req.user.role_id);

    if (roleName === 'Student' || roleName === 'ManagerStudent' || roleName === 'InstituteStudent') {
      if (userId !== studentId) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    } else if (!canStaffViewStudentProgress(roleName)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { courses, assigned_tutor_name } = await fetchStudentQualProgress(studentId);
    const [userRows] = await pool.execute('SELECT name FROM users WHERE id = ?', [studentId]);
    res.json({
      success: true,
      student_name: userRows[0]?.name || null,
      assigned_tutor_name,
      courses,
    });
  } catch (err) {
    console.error('[Tickets] Error fetching qual progress:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /student/:studentId/academic-progress - For Academic department popup on tickets dashboard
exports.getStudentAcademicProgress = async (req, res) => {
  try {
    const studentId = Number(req.params.studentId);
    if (!studentId) {
      return res.status(400).json({ success: false, message: 'Invalid student id' });
    }

    const userId = req.user.id;
    const roleId = req.user.role_id;
    const roleName = await getRoleName(roleId);

    // Only staff who can access tickets can view academic progress (Admin, Certificate Manager, Operation Manager, Tutor, Team Member, etc.)
    const staffRoles = ['Admin', 'Certificate Manager', 'Claim Manager', 'Operation Manager', 'Operation_manager', 'operation_manager', 'Assessor', 'Accounts Manager', 'Admission Manager', 'Administrative Manager', 'Team Member', 'Team_member', 'team_member'];
    if (roleName === 'Student' || roleName === 'ManagerStudent' || roleName === 'InstituteStudent') {
      if (userId !== studentId) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    } else if (!staffRoles.some(r => (roleName || '').toLowerCase().replace(/\s+/g, '_') === r.toLowerCase().replace(/\s+/g, '_'))) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Get qualification course enrollments from course_assignments
    const [caEnrollments] = await pool.execute(
      `SELECT c.id as course_id, c.title as course_title
       FROM course_assignments ca
       JOIN courses c ON ca.course_id = c.id
       WHERE ca.student_id = ? AND LOWER(TRIM(COALESCE(c.course_type, ''))) IN ('qualification', 'qualifi')
       ORDER BY ca.created_at DESC`,
      [studentId]
    );

    // Also include qualification courses from payment installments (so enrolled-by-payment courses show units + progress)
    const [paymentEnrollments] = await pool.execute(
      `SELECT DISTINCT c.id as course_id, c.title as course_title
       FROM student_payment_installments spi
       JOIN courses c ON spi.course_id = c.id
       WHERE spi.student_id = ? AND LOWER(TRIM(COALESCE(c.course_type, ''))) IN ('qualification', 'qualifi')`,
      [studentId]
    );

    // Merge: course_assignments first, then add any from payments not already present (by course_id)
    const seen = new Set((caEnrollments || []).map(e => e.course_id));
    const enrollments = [...(caEnrollments || [])];
    for (const pe of paymentEnrollments || []) {
      if (!seen.has(pe.course_id)) {
        seen.add(pe.course_id);
        enrollments.push(pe);
      }
    }
    // Sort by title for consistent order
    enrollments.sort((a, b) => (a.course_title || '').localeCompare(b.course_title || ''));

    const courseIds = enrollments.map(e => e.course_id);
    const unitsByCourse = {};
    const gradedByUnit = {};
    const qualProgressMap = {};
    let submittedNotGradedByUnit = {};

    if (courseIds.length > 0) {
      const placeholders = courseIds.map(() => '?').join(',');
      const [units] = await pool.execute(
        `SELECT u.id as unit_id, u.course_id, u.title as unit_title, u.order_index
         FROM units u
         WHERE u.course_id IN (${placeholders})
         ORDER BY u.course_id, u.order_index`,
        courseIds
      );

      units.forEach(u => {
        if (!unitsByCourse[u.course_id]) unitsByCourse[u.course_id] = [];
        unitsByCourse[u.course_id].push(u);
      });

      const unitIds = units.map(u => u.unit_id);
      const ph = unitIds.map(() => '?').join(',');

      try {
        const [progRows] = await pool.execute(
          `SELECT unit_id, is_unlocked, is_completed, assignment_status FROM qual_unit_progress WHERE student_id = ? AND unit_id IN (${ph})`,
          [studentId, ...unitIds]
        );
        progRows.forEach(r => { qualProgressMap[r.unit_id] = r; });
      } catch (e) {
        // qual_unit_progress may not exist
      }

      const [gradedRows] = await pool.execute(
        `SELECT qs.unit_id, qs.pass_fail_result FROM qual_submissions qs
         INNER JOIN (
           SELECT unit_id, MAX(graded_at) as max_graded FROM qual_submissions
           WHERE student_id = ? AND status = 'graded' AND submission_type = 'assignment'
           GROUP BY unit_id
         ) latest ON qs.unit_id = latest.unit_id AND qs.student_id = ? AND qs.graded_at = latest.max_graded
           AND qs.status = 'graded' AND qs.submission_type = 'assignment'
         WHERE qs.unit_id IN (${ph})`,
        [studentId, studentId, ...unitIds]
      );
      gradedRows.forEach(r => { gradedByUnit[r.unit_id] = r.pass_fail_result; });

      // Units with submission not yet graded (status = 'submitted' or 'resubmit_requested', and no graded submission for that unit)
      try {
        const [submittedRows] = await pool.execute(
          `SELECT DISTINCT qs.unit_id FROM qual_submissions qs
           WHERE qs.student_id = ? AND qs.unit_id IN (${ph}) AND qs.submission_type = 'assignment'
             AND qs.status IN ('submitted', 'resubmit_requested')
             AND NOT EXISTS (SELECT 1 FROM qual_submissions qs2 WHERE qs2.unit_id = qs.unit_id AND qs2.student_id = ? AND qs2.status = 'graded' AND qs2.submission_type = 'assignment')`,
          [studentId, ...unitIds, studentId]
        );
        submittedRows.forEach(r => { submittedNotGradedByUnit[r.unit_id] = true; });
      } catch (e) {
        // ignore
      }
    }

    const courses = enrollments.map(c => {
      const courseUnits = unitsByCourse[c.course_id] || [];
      const firstUnitId = courseUnits.length > 0 ? courseUnits[0].unit_id : null;
      const unitList = courseUnits.map(u => {
        const prog = qualProgressMap[u.unit_id];
        const gradedResult = gradedByUnit[u.unit_id];
        const submittedForGrading = submittedNotGradedByUnit[u.unit_id];
        const isUnlocked = prog && (prog.is_unlocked === 1 || prog.is_unlocked === true);
        const isFirstUnit = u.unit_id === firstUnitId;
        const assignmentPass = prog && prog.assignment_status === 'pass';
        const isCompleted = gradedResult === 'pass' || (prog && (prog.is_completed === 1 || prog.is_completed === true)) || assignmentPass;
        const passFailResult = gradedResult || (prog && prog.assignment_status) || (isCompleted ? 'pass' : null);
        // unit_status: locked | in_progress | submitted_for_grading | pass | refer
        let unit_status = 'locked';
        if (gradedResult === 'pass') unit_status = 'pass';
        else if (gradedResult === 'refer') unit_status = 'refer';
        else if (submittedForGrading) unit_status = 'submitted_for_grading';
        else if (isUnlocked || isFirstUnit) unit_status = 'in_progress'; // unlocked but no submission yet
        return {
          unit_id: u.unit_id,
          unit_title: u.unit_title,
          is_completed: !!isCompleted,
          pass_fail_result: passFailResult,
          unit_status
        };
      });
      const completed = unitList.filter(u => u.is_completed).length;
      return {
        course_id: c.course_id,
        course_title: c.course_title,
        total_units: unitList.length,
        completed_units: completed,
        units: unitList
      };
    });

    const [userRows] = await pool.execute('SELECT name FROM users WHERE id = ?', [studentId]);
    const studentName = userRows[0]?.name || null;
    res.json({ success: true, student_name: studentName, courses });
  } catch (err) {
    console.error('[Tickets] Error fetching academic progress:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /courses - List all courses for Operation Manager & Team Member (Total Courses view)
exports.getTicketsCourses = async (req, res) => {
  try {
    const roleId = req.user.role_id;
    const roleName = await getRoleName(roleId);
    const allowed = ['Operation Manager', 'Operation_manager', 'operation_manager', 'Team Member', 'Team_member', 'team_member'];
    const roleNorm = (roleName || '').toLowerCase().replace(/\s+/g, '_');
    if (!allowed.some(r => r.toLowerCase().replace(/\s+/g, '_') === roleNorm)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const [rows] = await pool.execute(`
      SELECT c.*, u.name as created_by_name, cat.name as category_name, subcat.name as sub_category_name
      FROM courses c
      LEFT JOIN users u ON c.created_by = u.id
      LEFT JOIN course_categories cat ON c.category_id = cat.id
      LEFT JOIN sub_categories subcat ON c.sub_category_id = subcat.id
      ORDER BY c.created_at DESC
    `);
    res.json({ success: true, courses: rows });
  } catch (err) {
    console.error('[Tickets] Error fetching courses:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /student/:studentId/payment-installments - Finance department: student payment plans & installments
exports.getStudentPaymentInstallments = async (req, res) => {
  try {
    const studentId = Number(req.params.studentId);
    if (!studentId) return res.status(400).json({ success: false, message: 'Invalid student id' });

    const roleId = req.user.role_id;
    const roleName = await getRoleName(roleId);
    const financeRoles = ['Operation Manager', 'Operation_manager', 'operation_manager', 'Accounts Manager', 'Accounts_manager', 'accounts_manager', 'Team Member', 'Team_member', 'team_member'];
    const roleNorm = (roleName || '').toLowerCase().replace(/\s+/g, '_');
    if (!financeRoles.some(r => r.toLowerCase().replace(/\s+/g, '_') === roleNorm)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const [rows] = await pool.execute(
      `SELECT spi.*, c.title as course_title, c.id as course_id, u.name as student_name, u.email as student_email
       FROM student_payment_installments spi
       JOIN courses c ON spi.course_id = c.id
       JOIN users u ON spi.student_id = u.id
       WHERE spi.student_id = ?
       ORDER BY c.title ASC, spi.installment_number ASC`,
      [studentId]
    );

    res.json({ success: true, installments: rows });
  } catch (err) {
    console.error('[Tickets] Error fetching payment installments:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /students - List all students (Accounts Manager only)
exports.getStudents = async (req, res) => {
  try {
    const roleId = req.user.role_id;
    const roleName = await getRoleName(roleId);
    const allowed = ['Accounts Manager', 'accounts_manager', 'Accounts_manager'];
    const roleNorm = (roleName || '').toLowerCase().replace(/\s+/g, '_');
    if (!allowed.some(r => r.toLowerCase().replace(/\s+/g, '_') === roleNorm)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const [rows] = await pool.execute(
      `SELECT u.id, u.name, u.email, u.created_at
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE r.name IN ('Student', 'ManagerStudent', 'InstituteStudent')
       ORDER BY u.created_at DESC`
    );
    res.json({ success: true, students: rows });
  } catch (err) {
    console.error('[Tickets] Error fetching students:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /students/:studentId - Update student email and/or password (Accounts Manager only)
exports.updateStudentCredentials = async (req, res) => {
  try {
    const studentId = Number(req.params.studentId);
    if (!studentId) return res.status(400).json({ success: false, message: 'Invalid student id' });

    const roleId = req.user.role_id;
    const roleName = await getRoleName(roleId);
    const allowed = ['Accounts Manager', 'accounts_manager', 'Accounts_manager'];
    const roleNorm = (roleName || '').toLowerCase().replace(/\s+/g, '_');
    if (!allowed.some(r => r.toLowerCase().replace(/\s+/g, '_') === roleNorm)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { email, password } = req.body;

    const [studentRows] = await pool.execute(
      `SELECT u.id, u.role_id, r.name as role_name FROM users u
       JOIN roles r ON u.role_id = r.id WHERE u.id = ?`,
      [studentId]
    );
    if (!studentRows.length) return res.status(404).json({ success: false, message: 'Student not found' });
    const target = studentRows[0];
    const studentRoles = ['Student', 'ManagerStudent', 'InstituteStudent'];
    if (!studentRoles.includes(target.role_name || '')) {
      return res.status(403).json({ success: false, message: 'Can only update students' });
    }

    const updates = [];
    const values = [];

    if (email != null && typeof email === 'string' && email.trim()) {
      const trimmed = email.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        return res.status(400).json({ success: false, message: 'Invalid email format' });
      }
      const [dup] = await pool.execute('SELECT id FROM users WHERE email = ? AND id != ?', [trimmed, studentId]);
      if (dup.length) return res.status(400).json({ success: false, message: 'Email already in use' });
      updates.push('email = ?');
      values.push(trimmed);
    }

    if (password != null && typeof password === 'string' && password.length >= 6) {
      const hash = await bcrypt.hash(password, 10);
      updates.push('password = ?');
      values.push(hash);
    } else if (password !== undefined && password !== null && password !== '') {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'Provide email and/or password to update' });
    }

    values.push(studentId);
    await pool.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
    res.json({ success: true, message: 'Student credentials updated' });
  } catch (err) {
    console.error('[Tickets] Error updating student credentials:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /course-categories - List course categories for Total Courses view
exports.getTicketsCourseCategories = async (req, res) => {
  try {
    const roleId = req.user.role_id;
    const roleName = await getRoleName(roleId);
    const allowed = ['Operation Manager', 'Operation_manager', 'operation_manager', 'Team Member', 'Team_member', 'team_member'];
    const roleNorm = (roleName || '').toLowerCase().replace(/\s+/g, '_');
    if (!allowed.some(r => r.toLowerCase().replace(/\s+/g, '_') === roleNorm)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const [rows] = await pool.execute('SELECT * FROM course_categories ORDER BY name');
    res.json({ success: true, categories: rows });
  } catch (err) {
    console.error('[Tickets] Error fetching course categories:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
