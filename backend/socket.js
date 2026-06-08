const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const pool = require("./config/db");
const redis = require("./config/redis");
const ticketController = require("./controllers/ticketController");
const getRoleName = ticketController.getRoleName;
const getEffectiveDepartmentId = ticketController.getEffectiveDepartmentId;
let createAdapter, createClient;

// Try to load Redis adapter (optional - for PM2 cluster mode)
try {
  const redisAdapter = require("@socket.io/redis-adapter");
  const redisLib = require("redis");
  createAdapter = redisAdapter.createAdapter;
  createClient = redisLib.createClient;
} catch (err) {
  console.log('ℹ️ [Socket] Redis adapter not installed. Install with: npm install @socket.io/redis-adapter redis');
  createAdapter = null;
  createClient = null;
}

// In-memory fallback (still used for backward-compat export, but Redis is primary)
const onlineUsers = new Map();

const ONLINE_USER_TTL = 120; // 2 minutes — heartbeat refreshes this
const ONLINE_USER_PREFIX = 'online_user:';

async function setUserOnline(userId, data) {
  const key = `${ONLINE_USER_PREFIX}${userId}`;
  const ok = await redis.safeRedis(
    () => redis.setex(key, ONLINE_USER_TTL, JSON.stringify(data)),
    null
  );
  if (ok === null) {
    console.warn('[Socket] Redis setUserOnline skipped (unavailable/reconnecting)');
  }
}

async function setUserOffline(userId) {
  await redis.safeRedis(() => redis.del(`${ONLINE_USER_PREFIX}${userId}`), null);
}

async function getOnlineUsersFromRedis() {
  return redis.safeRedis(async () => {
    const keys = await redis.keys(`${ONLINE_USER_PREFIX}*`);
    if (!keys || keys.length === 0) return [];
    const pipeline = redis.pipeline();
    keys.forEach((key) => pipeline.get(key));
    const results = await pipeline.exec();
    return results
      .map(([err, val]) => {
        if (err || !val) return null;
        try {
          return JSON.parse(val);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }, []);
}

function initSocket(server) {
  const io = new Server(server, {
    cors: { 
      origin: process.env.NODE_ENV === 'production' 
        ? ["https://lms.inspirelondoncollege.com", "https://www.lms.inspirelondoncollege.com"]
        : ["http://localhost:3000", "http://localhost:5000"],
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true,
    // Prevent "ping timeout" disconnects (default 20s too short for slow/proxy networks)
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Use Redis adapter for cluster mode (PM2 with multiple instances)
  // This allows Socket.IO rooms to work across different Node.js processes
  // CRITICAL: Without Redis adapter, sockets joining in one process won't receive messages from another process
  if (createAdapter && createClient) {
    // Build Redis URL from environment variables (same as config/redis.js)
    // Socket.IO adapter uses 'redis' package (node-redis) which needs TLS config
    let redisConfig = null;
    
    if (process.env.REDIS_URL) {
      // Use REDIS_URL directly
      const url = new URL(process.env.REDIS_URL);
      const isTLS = url.protocol === 'rediss:';
      redisConfig = {
        url: process.env.REDIS_URL,
        socket: {
          ...(isTLS && { tls: true, rejectUnauthorized: false }),
          connectTimeout: 10000,
          keepAlive: true,
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              console.error('❌ [Socket] Redis adapter: Max reconnection attempts reached');
              return new Error('Max reconnection attempts reached');
            }
            return Math.min(retries * 100, 3000);
          }
        }
      };
    } else if (process.env.REDIS_HOST && process.env.REDIS_PASSWORD && process.env.REDIS_PORT) {
      // Build config for Upstash (TLS required)
      // node-redis v4+ uses different TLS config format
      // Remove quotes from password if present, Upstash doesn't need 'default:' username
      const redisPassword = (process.env.REDIS_PASSWORD || '').replace(/^["']|["']$/g, '');
      const redisUrl = `rediss://:${encodeURIComponent(redisPassword)}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`;
      redisConfig = {
        url: redisUrl,
        socket: {
          tls: true,
          rejectUnauthorized: false, // Upstash uses self-signed certs
          servername: process.env.REDIS_HOST, // Required for TLS SNI
          connectTimeout: 30000, // Increased timeout for Upstash (30 seconds)
          keepAlive: true,
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              console.error('❌ [Socket] Redis adapter: Max reconnection attempts reached');
              return new Error('Max reconnection attempts reached');
            }
            return Math.min(retries * 100, 3000);
          }
        }
      };
    } else if (process.env.REDIS_HOST) {
      // Fallback for local Redis (no TLS)
      const redisUrl = `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}`;
      redisConfig = {
        url: redisUrl,
        socket: {
          connectTimeout: 10000,
          keepAlive: true,
          reconnectStrategy: (retries) => {
            if (retries > 10) return new Error('Max reconnection attempts reached');
            return Math.min(retries * 100, 3000);
          }
        }
      };
    }
    
    if (redisConfig) {
      try {
        console.log('🔄 [Socket] Connecting Redis adapter for instant messaging...');
        const maskedUrl = redisConfig.url.replace(/:[^:@]+@/, ':****@');
        console.log('🔄 [Socket] Redis URL:', maskedUrl);
        const pubClient = createClient(redisConfig);
        const subClient = pubClient.duplicate();

        // Add error handlers with reconnection logic
        pubClient.on('error', (err) => {
          console.error('❌ [Socket] Redis pub client error:', err.message);
          // Don't crash - Redis will auto-reconnect based on reconnectStrategy
        });
        
        pubClient.on('end', () => {
          console.warn('⚠️ [Socket] Redis pub client connection ended, will reconnect...');
        });
        
        pubClient.on('reconnecting', () => {
          console.log('🔄 [Socket] Redis pub client reconnecting...');
        });
        
        subClient.on('error', (err) => {
          console.error('❌ [Socket] Redis sub client error:', err.message);
          // Don't crash - Redis will auto-reconnect based on reconnectStrategy
        });
        
        subClient.on('end', () => {
          console.warn('⚠️ [Socket] Redis sub client connection ended, will reconnect...');
        });
        
        subClient.on('reconnecting', () => {
          console.log('🔄 [Socket] Redis sub client reconnecting...');
        });

        // Connect with timeout (increased for Upstash)
        const connectPromise = Promise.all([
          pubClient.connect().catch(err => {
            console.error('❌ [Socket] Redis pub client connection failed:', err.message);
            console.error('❌ [Socket] Redis pub client error details:', err.code, err.errno);
            throw err;
          }),
          subClient.connect().catch(err => {
            console.error('❌ [Socket] Redis sub client connection failed:', err.message);
            console.error('❌ [Socket] Redis sub client error details:', err.code, err.errno);
            throw err;
          })
        ]);

        // Set timeout for connection (30 seconds for Upstash TLS connections)
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Connection timeout after 30 seconds')), 30000);
        });

        Promise.race([connectPromise, timeoutPromise])
          .then(() => {
            io.adapter(createAdapter(pubClient, subClient));
            console.log('✅ [Socket] Redis adapter connected for cluster mode');
            console.log('✅ [Socket] Socket.IO rooms will work across all PM2 instances');
            console.log('✅ [Socket] Instant messaging enabled - messages will be delivered in real-time!');
          })
          .catch((err) => {
            console.error('⚠️ [Socket] Redis adapter connection failed:', err.message);
            if (err.stack) {
              console.error('⚠️ [Socket] Error stack:', err.stack);
            }
            console.log('⚠️ [Socket] Socket.IO will work but rooms won\'t be shared across PM2 instances');
            console.log('⚠️ [Socket] This will cause DELAYS in message delivery in cluster mode!');
            console.log('⚠️ [Socket] Check Redis configuration: REDIS_URL or REDIS_HOST/REDIS_PASSWORD/REDIS_PORT');
            console.log('⚠️ [Socket] Verify Redis is reachable: REDIS_HOST=' + (process.env.REDIS_HOST || 'NOT SET'));
          });
      } catch (err) {
        console.error('⚠️ [Socket] Redis adapter setup failed:', err.message);
        console.log('⚠️ [Socket] Socket.IO will work but rooms won\'t be shared across PM2 instances');
      }
    } else {
      console.log('⚠️ [Socket] WARNING: PM2 cluster mode detected but no Redis configured!');
      console.log('⚠️ [Socket] Socket.IO rooms will NOT work across PM2 instances');
      console.log('⚠️ [Socket] Messages will have DELAYS. Set REDIS_URL or REDIS_HOST/REDIS_PASSWORD/REDIS_PORT');
      console.log('⚠️ [Socket] Install: npm install @socket.io/redis-adapter redis');
    }
  } else {
    console.log('⚠️ [Socket] WARNING: Redis adapter package not installed!');
    console.log('⚠️ [Socket] Install with: npm install @socket.io/redis-adapter redis');
    console.log('⚠️ [Socket] Socket.IO rooms will NOT work across PM2 instances in cluster mode');
  }

  // STEP 1 — Socket authentication: require valid JWT
  const JWT_SECRET = process.env.JWT_SECRET;
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.userId = decoded.id;
      socket.userName = decoded.name || decoded.userName || 'User';
      socket.roleId = decoded.role_id;
      socket.roleName = decoded.role;
      next();
    } catch (err) {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.userId;
    const userName = socket.userName;
    const userRole = socket.roleName || 'Unknown';
    console.log("🟢 User connected:", socket.id, `(user ${userId})`);

    // Auto-track user as online on connect (Redis — shared across all PM2 workers)
    const userData = {
      userId,
      userName,
      userRole,
      socketId: socket.id,
      connectedAt: new Date().toISOString(),
      lastSeen: new Date().toISOString()
    };
    await setUserOnline(userId, userData);
    onlineUsers.set(userId, { socketId: socket.id, userName, lastSeen: userData.lastSeen });

    socket.join(`user_${userId}`);
    socket.join(`role_${userRole}`);

    io.emit("user_status_change", {
      userId,
      userName,
      userRole,
      status: "online",
      lastSeen: userData.lastSeen
    });

    // Legacy support — clients still emit user_online, just refresh TTL
    socket.on("user_online", async () => {
      const now = new Date().toISOString();
      await setUserOnline(userId, { ...userData, lastSeen: now, socketId: socket.id });
      onlineUsers.set(userId, { socketId: socket.id, userName, lastSeen: now });
    });

    // Heartbeat — frontend sends every 60s, we refresh the 2-min TTL
    socket.on("heartbeat", async () => {
      const now = new Date().toISOString();
      await setUserOnline(userId, { ...userData, lastSeen: now, socketId: socket.id });
      onlineUsers.set(userId, { socketId: socket.id, userName, lastSeen: now });
    });

    // Get online users (from Redis for accuracy)
    socket.on("get_online_users", async () => {
      const users = await getOnlineUsersFromRedis();
      const onlineUsersList = users.map(u => ({
        userId: u.userId,
        userName: u.userName,
        status: "online"
      }));
      socket.emit("online_users_list", onlineUsersList);
    });

    // STEP 2 — Join conversation room (access validated against DB)
    socket.on("join_conversation", async (data) => {
      const { conversationId } = data;
      const convId = parseInt(conversationId, 10);
      if (isNaN(convId) || convId <= 0) {
        socket.emit("socket_error", { message: "Invalid conversation ID" });
        return;
      }
      try {
        const roleName = socket.roleName || (socket.roleId ? await getRoleName(socket.roleId) : null);
        const effectiveDeptId = await getEffectiveDepartmentId(userId, roleName);
        const isOmOrTeam = ['Operation Manager', 'Operation_manager', 'operation_manager', 'Team Member', 'Team_member', 'team_member'].includes(roleName || '');
        const deptClause = effectiveDeptId != null ? ' OR tk.department_id = ?' : '';
        const omClause = isOmOrTeam ? ' OR 1=1' : '';
        const params = [convId, userId, userId, userId, userId, userId];
        if (effectiveDeptId != null) params.push(effectiveDeptId);
        const [rows] = await pool.query(
          `SELECT 1, tk.status AS ticket_status FROM conversations c
           LEFT JOIN tickets tk ON tk.conversation_id = c.id
           LEFT JOIN users assignee ON tk.assigned_to = assignee.id
           WHERE c.id = ? AND (c.student_id = ? OR c.tutor_id = ? OR c.admin_id = ?
             OR (tk.id IS NOT NULL AND (tk.assigned_to = ? OR assignee.manager_id = ?${deptClause}${omClause})))`,
          params
        );
        if (rows.length === 0) {
          socket.emit("socket_error", { message: "Access denied to conversation" });
          return;
        }
        const room = `conversation_${convId}`;
        socket.join(room);
        const ticketStatus = rows[0].ticket_status || null;
        const isClosed = ticketStatus === 'resolved';
        socket.emit("conversation_joined", { conversationId: convId, ticketStatus: isClosed ? 'closed' : ticketStatus });
        socket.to(room).emit("user_joined_conversation", { userId, conversationId: convId });
        console.log(`✅ [Socket] User ${userId} joined conversation ${convId}`);
      } catch (err) {
        console.error('[Socket] join_conversation error:', err.message);
        socket.emit("socket_error", { message: "Failed to join conversation" });
      }
    });

    // Join user notification room (own room only - userId from JWT)
    socket.on("join_notifications", () => {
      const room = `user_${userId}`;
      socket.join(room);
      console.log(`✅ Socket ${socket.id} joined notification room for user ${userId}`);
    });

    // Join admin room (for payment/installment updates - Admin, Accounts Manager, etc.)
    socket.on("join_admin_room", () => {
      const adminRoles = ['Admin', 'Certificate Manager', 'Accounts Manager', 'Operation Manager', 'Administrative Manager', 'Admission Manager', 'Team Member'];
      if (adminRoles.includes(socket.roleName || '')) {
        socket.join('admin_room');
        console.log(`✅ Socket ${socket.id} joined admin_room`);
      }
    });

    // Leave user notification room (own room only)
    socket.on("leave_notifications", () => {
      const room = `user_${userId}`;
      socket.leave(room);
      console.log(`❌ Socket ${socket.id} left notification room for user ${userId}`);
    });

    // Leave conversation room
    socket.on("leave_conversation", (conversationId) => {
      const room = `conversation_${conversationId}`;
      socket.leave(room);
      console.log(`❌ Socket ${socket.id} left conversation ${conversationId}`);
    });

    // Send message (real-time broadcast)
    socket.on("send_message", (data) => {
      const { conversationId, message } = data;
      const room = `conversation_${conversationId}`;
      io.to(room).emit("receive_message", message);
      console.log(`📤 Message sent to conversation ${conversationId}`);
    });

    // Typing indicator
    socket.on("typing", (data) => {
      const { conversationId, userName, userId } = data;
      const room = `conversation_${conversationId}`;
      socket.to(room).emit("user_typing", { userName, userId, conversationId });
    });

    // Stop typing indicator
    socket.on("stop_typing", (data) => {
      const { conversationId, userId } = data;
      const room = `conversation_${conversationId}`;
      socket.to(room).emit("user_stop_typing", { userId, conversationId });
    });

    // Message read/seen (legacy - single message)
    socket.on("message_read", (data) => {
      const { conversationId, messageId } = data;
      const room = `conversation_${conversationId}`;
      io.to(room).emit("message_seen", { messageId, userId, seenAt: new Date().toISOString() });
    });

    // 1️⃣ message_delivered - when receiver socket receives message
    socket.on("message_delivered", async (data) => {
      const { messageId, conversationId } = data || {};
      if (!messageId || !conversationId) return;
      try {
        const [cols] = await pool.query(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'messages' AND COLUMN_NAME = 'delivered_at'`
        );
        if (cols.length > 0) {
          await pool.query(
            `UPDATE messages SET delivered_at = NOW() WHERE id = ? AND sender_id != ? AND delivered_at IS NULL`,
            [messageId, userId]
          );
        }
        io.to(`conversation_${conversationId}`).emit("message_status_update", {
          messageId,
          conversationId,
          status: "delivered"
        });
      } catch (err) {
        console.error('[Socket] message_delivered error:', err.message);
      }
    });

    // 2️⃣ mark_as_read - when user opens chat (conversation-level)
    socket.on("mark_as_read", async (data) => {
      const { conversationId } = data || {};
      if (!conversationId) return;
      try {
        await pool.query(
          `UPDATE messages SET is_read = 1, read_at = NOW() 
           WHERE conversation_id = ? AND sender_id != ? AND (is_read = 0 OR is_read IS NULL)`,
          [conversationId, userId]
        );
        const room = `conversation_${conversationId}`;
        io.to(room).emit("message_status_update", {
          conversationId,
          status: "read",
          readerId: userId
        });
        io.emit("conversation_updated", { conversationId });
        const [conv] = await pool.query(
          `SELECT c.student_id, c.tutor_id, c.admin_id FROM conversations c WHERE c.id = ?`,
          [conversationId]
        );
        if (conv[0]) {
          const c = conv[0];
          const otherId = c.student_id === userId ? (c.tutor_id || c.admin_id) : (c.tutor_id === userId ? c.student_id : (c.admin_id === userId ? c.student_id : c.student_id));
          if (otherId) {
            io.to(`user_${otherId}`).emit("unread_count_update", { conversationId, count: 0 });
          }
        }
      } catch (err) {
        console.error('[Socket] mark_as_read error:', err.message);
      }
    });

    // 3️⃣ edit_message - only sender, within 15 minutes
    socket.on("edit_message", async (data) => {
      const { messageId, newText } = data || {};
      if (!messageId || newText == null) return;
      try {
        const [msg] = await pool.query(
          'SELECT sender_id, conversation_id, created_at FROM messages WHERE id = ? AND is_deleted = 0',
          [messageId]
        );
        if (!msg[0]) {
          socket.emit("socket_error", { message: "Message not found" });
          return;
        }
        if (msg[0].sender_id !== userId) {
          socket.emit("socket_error", { message: "Unauthorized" });
          return;
        }
        const createdAt = new Date(msg[0].created_at).getTime();
        if (Date.now() - createdAt > 15 * 60 * 1000) {
          socket.emit("socket_error", { message: "Edit window expired (15 min)" });
          return;
        }
        const [ticketRows] = await pool.query(
          'SELECT tk.status FROM tickets tk JOIN conversations c ON tk.conversation_id = c.id JOIN messages m ON m.conversation_id = c.id WHERE m.id = ?',
          [messageId]
        );
        if (ticketRows[0] && ticketRows[0].status === 'resolved') {
          socket.emit("socket_error", { message: "Ticket is closed" });
          return;
        }
        await pool.query(
          'UPDATE messages SET message = ?, is_edited = 1, edited_at = NOW() WHERE id = ?',
          [newText, messageId]
        );
        const room = `conversation_${msg[0].conversation_id}`;
        io.to(room).emit("message_edited", { messageId, newText });
      } catch (err) {
        console.error('[Socket] edit_message error:', err.message);
        socket.emit("socket_error", { message: "Edit failed" });
      }
    });

    // 4️⃣ delete_message - only sender, soft delete
    socket.on("delete_message", async (data) => {
      const { messageId } = data || {};
      if (!messageId) return;
      try {
        const [msg] = await pool.query(
          'SELECT sender_id, conversation_id FROM messages WHERE id = ? AND is_deleted = 0',
          [messageId]
        );
        if (!msg[0]) {
          socket.emit("socket_error", { message: "Message not found" });
          return;
        }
        if (msg[0].sender_id !== userId) {
          socket.emit("socket_error", { message: "Unauthorized" });
          return;
        }
        const [ticketRows] = await pool.query(
          'SELECT tk.status FROM tickets tk JOIN conversations c ON tk.conversation_id = c.id JOIN messages m ON m.conversation_id = c.id WHERE m.id = ?',
          [messageId]
        );
        if (ticketRows[0] && ticketRows[0].status === 'resolved') {
          socket.emit("socket_error", { message: "Ticket is closed" });
          return;
        }
        await pool.query(
          'UPDATE messages SET is_deleted = 1, message = ? WHERE id = ?',
          ['This message was deleted.', messageId]
        );
        const room = `conversation_${msg[0].conversation_id}`;
        io.to(room).emit("message_deleted", { messageId });
      } catch (err) {
        console.error('[Socket] delete_message error:', err.message);
        socket.emit("socket_error", { message: "Delete failed" });
      }
    });

    // Handle disconnect — remove from Redis + in-memory
    socket.on("disconnect", async () => {
      // Only remove if this socket is still the active one for this user
      // (prevents removing when user has multiple tabs and one tab closes)
      try {
        const existing = await redis.get(`${ONLINE_USER_PREFIX}${userId}`);
        if (existing) {
          const parsed = JSON.parse(existing);
          if (parsed.socketId === socket.id) {
            await setUserOffline(userId);
            onlineUsers.delete(userId);
            io.emit("user_status_change", {
              userId,
              userName,
              userRole,
              status: "offline",
              lastSeen: new Date().toISOString()
            });
            console.log(`🔴 User ${userName} (${userId}) went offline`);
          }
        }
      } catch (err) {
        // Fallback: remove from in-memory map
        onlineUsers.delete(userId);
      }
      console.log("🔴 User disconnected:", socket.id);
    });
  });

  return io;
}

module.exports = initSocket;
module.exports.getOnlineUsers = () => onlineUsers;
module.exports.getOnlineUsersFromRedis = getOnlineUsersFromRedis;
module.exports.setUserOnline = setUserOnline;
module.exports.ONLINE_USER_PREFIX = ONLINE_USER_PREFIX;
module.exports.ONLINE_USER_TTL = ONLINE_USER_TTL;
