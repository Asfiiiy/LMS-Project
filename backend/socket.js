const { Server } = require("socket.io");

// Store online users: { userId: { socketId, userName, lastSeen } }
const onlineUsers = new Map();

function initSocket(server) {
  const io = new Server(server, {
    cors: { 
      origin: ["http://localhost:3000", "http://localhost:5000"],
      methods: ["GET", "POST"],
      credentials: true
    },
  });

  io.on("connection", (socket) => {
    console.log("🟢 User connected:", socket.id);

    // User goes online
    socket.on("user_online", (data) => {
      const { userId, userName } = data;
      onlineUsers.set(userId, {
        socketId: socket.id,
        userName,
        lastSeen: new Date().toISOString()
      });
      
      // Broadcast to all users that this user is online
      io.emit("user_status_change", {
        userId,
        userName,
        status: "online",
        lastSeen: new Date().toISOString()
      });
      
      console.log(`✅ User ${userName} (${userId}) is now online`);
    });

    // Get online users
    socket.on("get_online_users", () => {
      const onlineUsersList = Array.from(onlineUsers.entries()).map(([userId, data]) => ({
        userId,
        userName: data.userName,
        status: "online"
      }));
      socket.emit("online_users_list", onlineUsersList);
    });

    // Join conversation room
    socket.on("join_conversation", (data) => {
      const { conversationId, userId } = data;
      const room = `conversation_${conversationId}`;
      socket.join(room);
      console.log(`✅ Socket ${socket.id} joined conversation ${conversationId}`);
      
      // Notify others in the room
      socket.to(room).emit("user_joined_conversation", { userId, conversationId });
    });

    // Join user notification room (for real-time notifications)
    socket.on("join_notifications", (data) => {
      const { userId } = data;
      if (userId) {
        const room = `user_${userId}`;
        socket.join(room);
        console.log(`✅ Socket ${socket.id} joined notification room for user ${userId}`);
      }
    });

    // Leave user notification room
    socket.on("leave_notifications", (data) => {
      const { userId } = data;
      if (userId) {
        const room = `user_${userId}`;
        socket.leave(room);
        console.log(`❌ Socket ${socket.id} left notification room for user ${userId}`);
      }
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

    // Message read/seen
    socket.on("message_read", (data) => {
      const { conversationId, messageId, userId } = data;
      const room = `conversation_${conversationId}`;
      io.to(room).emit("message_seen", { messageId, userId, seenAt: new Date().toISOString() });
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      // Find and remove user from online users
      let disconnectedUserId = null;
      let disconnectedUserName = null;
      
      for (const [userId, data] of onlineUsers.entries()) {
        if (data.socketId === socket.id) {
          disconnectedUserId = userId;
          disconnectedUserName = data.userName;
          onlineUsers.delete(userId);
          break;
        }
      }
      
      if (disconnectedUserId) {
        // Broadcast offline status
        io.emit("user_status_change", {
          userId: disconnectedUserId,
          userName: disconnectedUserName,
          status: "offline",
          lastSeen: new Date().toISOString()
        });
        console.log(`🔴 User ${disconnectedUserName} (${disconnectedUserId}) went offline`);
      }
      
      console.log("🔴 User disconnected:", socket.id);
    });
  });

  return io;
}

module.exports = initSocket;
