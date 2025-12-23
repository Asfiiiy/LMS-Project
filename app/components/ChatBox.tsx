"use client";
import React, { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";

interface Message {
  id?: number;
  conversation_id: number;
  sender_id: number;
  sender_name?: string;
  sender_email?: string;
  message: string | null;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  message_type: 'text' | 'file' | 'image' | 'pdf';
  created_at?: string;
  is_read?: number;
  read_at?: string | null;
}

interface ChatBoxProps {
  conversationId: number;
  userId: number;
  userName: string;
  otherUserId?: number;
  otherUserName?: string;
}

let socket: Socket | null = null;

export default function ChatBox({ conversationId, userId, userName, otherUserId, otherUserName }: ChatBoxProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [readMessages, setReadMessages] = useState<Set<number>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize socket connection
  useEffect(() => {
    if (!socket) {
      const getApiUrl = () => {
        if (typeof window !== 'undefined') {
          return process.env.NEXT_PUBLIC_API_URL || 
                 `${window.location.protocol}//${window.location.hostname}:5000`;
        }
        return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      };
      const apiUrl = getApiUrl();
      socket = io(apiUrl, {
        transports: ['websocket', 'polling']
      });
    }

    // Announce user online
    socket.emit("user_online", { userId, userName });

    // Join conversation room
    socket.emit("join_conversation", { conversationId, userId });

    // Fetch existing messages
    fetchMessages();

    // Listen for new messages
    socket.on("receive_message", (message: Message) => {
      setMessages((prev) => {
        // Avoid duplicates
        if (prev.some(m => m.id === message.id)) return prev;
        return [...prev, message];
      });
      
      // Mark as read if it's from the other user
      if (message.sender_id !== userId && message.id) {
        markMessageAsRead(message.id);
      }
    });

    // Listen for typing indicator
    socket.on("user_typing", ({ userName: typingUserName, userId: typingUserId }: { userName: string; userId: number }) => {
      if (typingUserId !== userId) {
        setTypingUser(typingUserName);
      }
    });

    socket.on("user_stop_typing", ({ userId: typingUserId }: { userId: number }) => {
      if (typingUserId !== userId) {
        setTypingUser(null);
      }
    });

    // Listen for user status changes
    socket.on("user_status_change", ({ userId: statusUserId, status, lastSeen: lastSeenTime }: { userId: number; status: string; lastSeen: string }) => {
      console.log(`🔄 Status change: User ${statusUserId} is now ${status}`);
      console.log(`🎯 Current otherUserId: ${otherUserId}`);
      if (otherUserId && statusUserId === otherUserId) {
        console.log(`✅ Updating status for conversation participant`);
        setIsOnline(status === "online");
        setLastSeen(lastSeenTime);
      } else {
        console.log(`⏭️ Ignoring - not the other user in this conversation`);
      }
    });

    // Listen for message seen/read receipts
    socket.on("message_seen", ({ messageId, userId: readerId }: { messageId: number; userId: number }) => {
      if (readerId !== userId) {
        setReadMessages(prev => new Set([...prev, messageId]));
      }
    });

    // Get online users list
    socket.emit("get_online_users");
    socket.on("online_users_list", (users: Array<{ userId: number; userName: string; status: string }>) => {
      console.log('📋 Online users list:', users);
      console.log('🎯 Looking for otherUserId:', otherUserId);
      if (otherUserId) {
        const otherUser = users.find(u => u.userId === otherUserId);
        console.log('👤 Found other user:', otherUser);
        setIsOnline(!!otherUser);
      } else {
        console.warn('⚠️ otherUserId is not set!');
      }
    });

    return () => {
      socket?.emit("leave_conversation", conversationId);
      socket?.off("receive_message");
      socket?.off("user_typing");
      socket?.off("user_stop_typing");
      socket?.off("user_status_change");
      socket?.off("message_seen");
      socket?.off("online_users_list");
    };
  }, [conversationId, userId, userName, otherUserId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    // Small delay to ensure DOM is updated
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 100);
    return () => clearTimeout(timer);
  }, [messages]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const { getApiUrl } = await import('../utils/apiUrl');
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/chat/${conversationId}`);
      const data = await res.json();
      if (data.success) {
        setMessages(data.messages || []);
        // Mark unread messages as read
        data.messages?.forEach((msg: Message) => {
          if (msg.sender_id !== userId && msg.id && !msg.is_read) {
            markMessageAsRead(msg.id);
          }
        });
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoading(false);
    }
  };

  const markMessageAsRead = async (messageId: number) => {
    try {
      const { getApiUrl } = await import('../utils/apiUrl');
      const apiUrl = getApiUrl();
      await fetch(`${apiUrl}/api/chat/mark-read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, userId }),
      });
      
      // Emit to socket for real-time update
      socket?.emit("message_read", { conversationId, messageId, userId });
      setReadMessages(prev => new Set([...prev, messageId]));
    } catch (error) {
      console.error("Error marking message as read:", error);
    }
  };

  const handleTyping = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    
    // Emit typing indicator
    socket?.emit("typing", { conversationId, userName, userId });
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      socket?.emit("stop_typing", { conversationId, userId });
    }, 2000);
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    const msgObj: Message = {
      conversation_id: conversationId,
      sender_id: userId,
      message: newMessage,
      file_url: null,
      file_name: null,
      file_type: null,
      message_type: "text",
    };

    try {
      const { getApiUrl } = await import('../utils/apiUrl');
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/chat/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          senderId: userId,
          message: newMessage,
          messageType: "text"
        }),
      });

      const data = await res.json();
      if (data.success) {
        // Socket will broadcast to all users in room
        setNewMessage("");
        socket?.emit("stop_typing", { conversationId, userId });
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      alert("File size must be less than 10MB");
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);

      // Upload to Cloudinary via backend
      const { getApiUrl } = await import('../utils/apiUrl');
      const apiUrl = getApiUrl();
      const uploadRes = await fetch(`${apiUrl}/api/chat/upload`, {
        method: "POST",
        body: formData,
      });

      const uploadData = await uploadRes.json();
      if (!uploadData.success) {
        alert("File upload failed");
        return;
      }

      // Send message with file
      const res = await fetch(`${apiUrl}/api/chat/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          senderId: userId,
          message: `Sent a file: ${uploadData.file.name}`,
          fileUrl: uploadData.file.url,
          fileName: uploadData.file.name,
          fileType: uploadData.file.type,
          fileSize: uploadData.file.size,
          messageType: uploadData.file.messageType
        }),
      });

      const data = await res.json();
      if (!data.success) {
        alert("Failed to send file message");
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Error uploading file");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatLastSeen = (lastSeenTime: string | null) => {
    if (!lastSeenTime) return '';
    const date = new Date(lastSeenTime);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const renderMessage = (msg: Message) => {
    const isOwn = msg.sender_id === userId;

    return (
      <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3 sm:mb-4`}>
        <div className={`max-w-[85%] sm:max-w-[75%] lg:max-w-[70%] ${isOwn ? 'order-2' : 'order-1'}`}>
          {!isOwn && (
            <div className="text-xs text-gray-500 mb-1 px-1">{msg.sender_name || 'Unknown'}</div>
          )}
          <div
            className={`rounded-2xl px-3 py-1.5 sm:px-4 sm:py-2 ${
              isOwn
                ? 'bg-[#11CCEF] text-white rounded-br-none'
                : 'bg-gray-100 text-gray-900 rounded-bl-none'
            }`}
          >
            {msg.message_type === 'image' && msg.file_url && (
              <img 
                src={msg.file_url} 
                alt={msg.file_name || 'Image'} 
                className="max-w-full rounded-lg mb-2 cursor-pointer hover:opacity-90"
                onClick={() => window.open(msg.file_url!, '_blank')}
              />
            )}
            {msg.message_type === 'pdf' && msg.file_url && (
              <div className="flex items-center gap-2 p-1.5 sm:p-2 bg-white bg-opacity-20 rounded-lg mb-2">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M4 18h12V6h-4V2H4v16zm-2 1V0h12l4 4v16H2v-1z"/>
                </svg>
                <a 
                  href={msg.file_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs sm:text-sm underline hover:no-underline truncate"
                >
                  {msg.file_name}
                </a>
              </div>
            )}
            {msg.message_type === 'file' && msg.file_url && (
              <div className="flex items-center gap-2 p-1.5 sm:p-2 bg-white bg-opacity-20 rounded-lg mb-2">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M8 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0017.414 6L14 2.586A2 2 0 0012.586 2H8z"/>
                </svg>
                <a 
                  href={msg.file_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs sm:text-sm underline hover:no-underline truncate"
                >
                  {msg.file_name}
                </a>
              </div>
            )}
            <p className="text-xs sm:text-sm whitespace-pre-wrap break-words">{msg.message}</p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 mt-1 px-1 sm:px-2">
            <div className="text-xs text-gray-400">
              {msg.created_at && new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            {isOwn && msg.id && (
              <div className="flex items-center" title={readMessages.has(msg.id) || msg.is_read ? "Seen" : "Delivered"}>
                {readMessages.has(msg.id) || msg.is_read ? (
                  // Double checkmark for seen/read - bright blue
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <path d="M4 12.9L7.14286 16.5L15 7.5" stroke="#0EA5E9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M9 12.9L12.1429 16.5L20 7.5" stroke="#0EA5E9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  // Single checkmark for delivered - gray
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <path d="M5 13l4 4L19 7" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full sm:h-[calc(100vh-200px)] bg-white rounded-lg sm:rounded-xl shadow-lg border border-gray-200">
      {/* Header with Online Status */}
      {otherUserName && (
        <div className="border-b border-gray-200 px-3 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 bg-gradient-to-r from-gray-50 to-white flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-[#11CCEF] to-[#0daed9] rounded-full flex items-center justify-center text-white font-bold text-base sm:text-lg shadow-md">
                {otherUserName.charAt(0).toUpperCase()}
              </div>
              <div className={`absolute bottom-0 right-0 w-3 h-3 sm:w-4 sm:h-4 rounded-full border-2 border-white ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`}></div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm sm:text-base lg:text-lg font-bold text-gray-900 truncate">{otherUserName}</h3>
              <p className="text-xs text-gray-500">
                {isOnline ? (
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full animate-pulse"></span>
                    Online
                  </span>
                ) : (
                  lastSeen && `Last seen ${formatLastSeen(lastSeen)}`
                )}
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 space-y-2" style={{ scrollBehavior: 'smooth' }}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-sm sm:text-base text-gray-500">Loading messages...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full p-4">
            <div className="text-center text-gray-400">
              <svg className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-sm sm:text-base">No messages yet</p>
              <p className="text-xs sm:text-sm mt-1">Start the conversation!</p>
            </div>
          </div>
        ) : (
          messages.map(renderMessage)
        )}
        {typingUser && (
          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 px-1">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
            <span className="truncate">{typingUser} is typing...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 p-2 sm:p-3 lg:p-4 bg-gray-50 rounded-b-lg sm:rounded-b-xl flex-shrink-0">
        <div className="flex items-end gap-1.5 sm:gap-2">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileUpload}
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.txt,.zip"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="p-1.5 sm:p-2 text-gray-500 hover:text-[#11CCEF] hover:bg-blue-50 active:bg-blue-100 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
            title="Attach file"
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
          <textarea
            value={newMessage}
            onChange={handleTyping}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 text-sm sm:text-base border border-gray-300 rounded-lg px-3 sm:px-4 py-1.5 sm:py-2 focus:outline-none focus:ring-2 focus:ring-[#11CCEF] focus:border-transparent resize-none"
          />
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim() || uploading}
            className="bg-[#11CCEF] text-white px-3 sm:px-4 lg:px-6 py-1.5 sm:py-2 text-sm sm:text-base rounded-lg font-medium hover:bg-[#0daed9] active:bg-[#0b9bc7] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            {uploading ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
