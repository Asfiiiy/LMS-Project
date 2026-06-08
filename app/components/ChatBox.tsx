"use client";
import React, { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { useSocket } from "@/app/contexts/SocketContext";
import Swal from "sweetalert2";
import { LinkifiedText } from "@/app/utils/linkify";

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
  delivered_at?: string | null;
  parent_message_id?: number | null;
  parent_message?: string | null;
  parent_sender_name?: string | null;
}

interface ChatBoxProps {
  conversationId: number;
  userId: number;
  userName: string;
  userRole?: string;
  otherUserId?: number;
  otherUserName?: string;
  otherUserProfilePicture?: string;
  /** When provided (e.g. merged ticket history), use these instead of fetching by conversationId */
  initialMessages?: Message[];
  /** Ticket lifecycle events to show in timeline (created, accepted, etc.) - used with initialMessages */
  timelineEvents?: Array<{
    type: 'ticket_created' | 'ticket_accepted';
    ticketId: number;
    subject?: string;
    acceptedByName?: string;
    createdAt: string;
  }>;
}

export default function ChatBox({ conversationId, userId, userName, userRole, otherUserId, otherUserName, otherUserProfilePicture, initialMessages, timelineEvents }: ChatBoxProps) {
  const socket = useSocket();
  const [messages, setMessages] = useState<Message[]>(initialMessages ?? []);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [readMessages, setReadMessages] = useState<Set<number>>(new Set());
  const [replyTo, setReplyTo] = useState<{ id: number; preview: string } | null>(null);
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [searchMatchIndex, setSearchMatchIndex] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageRefsMap = useRef<Record<number, HTMLDivElement | null>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const statusIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const showSearch = (userRole === 'Assessor' || userRole === 'Admin') && true;
  const searchMatchIds = React.useMemo(() => {
    if (!chatSearchQuery.trim()) return [];
    const q = chatSearchQuery.trim().toLowerCase();
    return messages
      .filter((m) => {
        const text = (m.message || '').toLowerCase();
        const fileName = (m.file_name || '').toLowerCase();
        return text.includes(q) || fileName.includes(q);
      })
      .map((m) => m.id as number)
      .filter((id): id is number => id != null);
  }, [messages, chatSearchQuery]);
  const currentSearchId = searchMatchIds[searchMatchIndex] ?? null;

  const timelineItems = React.useMemo(() => {
    if (!timelineEvents || timelineEvents.length === 0) {
      return messages.map((m) => ({ type: 'message' as const, sortKey: new Date(m.created_at || 0).getTime(), message: m }));
    }
    const msgItems = messages.map((m) => ({ type: 'message' as const, sortKey: new Date(m.created_at || 0).getTime(), message: m }));
    const evItems = timelineEvents.map((e) => ({ type: 'event' as const, sortKey: new Date(e.createdAt || 0).getTime(), event: e }));
    const combined = [...msgItems, ...evItems].sort((a, b) => a.sortKey - b.sortKey);
    return combined;
  }, [messages, timelineEvents]);

  // Use shared socket: join conversation, add listeners
  useEffect(() => {
    if (!socket) return;

    const onConnect = () => {
      socket.emit("user_online");
      socket.emit("join_conversation", { conversationId });
    };

    socket.on('connect', onConnect);
    if (socket.connected) onConnect();

    socket.emit("mark_as_read", { conversationId });

    socket.on('reconnect', () => {
      socket.emit('user_online');
      socket.emit('join_conversation', { conversationId });
    });

    // Fetch existing messages (or use initialMessages for merged ticket view)
    if (initialMessages && initialMessages.length > 0) {
      setMessages(initialMessages);
      setLoading(false);
    } else {
      fetchMessages();
    }

    // Listen for new messages
    socket?.on("receive_message", (message: Message) => {
      setMessages((prev) => {
        if (prev.some(m => m.id === message.id)) return prev;
        return [...prev, message];
      });
      if (message.sender_id !== userId && message.id) {
        socket.emit("message_delivered", { messageId: message.id, conversationId });
        markMessageAsRead(message.id);
      }
    });

    // Listen for typing indicator
    socket?.on("user_typing", ({ userName: typingUserName, userId: typingUserId }: { userName: string; userId: number }) => {
      if (typingUserId !== userId) {
        setTypingUser(typingUserName);
      }
    });

    socket?.on("user_stop_typing", ({ userId: typingUserId }: { userId: number }) => {
      if (typingUserId !== userId) {
        setTypingUser(null);
      }
    });

    // Listen for user status changes
    socket?.on("user_status_change", ({ userId: statusUserId, status, lastSeen: lastSeenTime }: { userId: number; status: string; lastSeen: string }) => {
      if (otherUserId && statusUserId === otherUserId) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`✅ Updating status for conversation participant`);
        }
        setIsOnline(status === "online");
        setLastSeen(lastSeenTime);
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.log(`⏭️ Ignoring - not the other user in this conversation`);
        }
      }
    });

    // Listen for message seen/read receipts
    socket?.on("message_seen", ({ messageId, userId: readerId }: { messageId: number; userId: number }) => {
      if (readerId !== userId) {
        setReadMessages(prev => new Set([...prev, messageId]));
      }
    });
    // Listen for message status (delivered, read)
    socket?.on("message_status_update", (payload: { messageId?: number; conversationId?: number; status: string; readerId?: number }) => {
      if (payload.status === 'delivered' && payload.messageId) {
        setMessages((prev) => prev.map((m) =>
          m.id === payload.messageId && m.sender_id === userId ? { ...m, delivered_at: new Date().toISOString() } : m
        ));
      }
      if (payload.status === 'read' && payload.conversationId === conversationId && payload.readerId === otherUserId) {
        setMessages((prev) => prev.map((m) => (m.sender_id === userId ? { ...m, is_read: 1 } : m)));
        setReadMessages((prev) => new Set(prev));
      }
    });

    // Get online users list
    const checkOnlineStatus = () => {
      socket?.emit("get_online_users");
    };
    
    // Check immediately
    checkOnlineStatus();
    
    // Check periodically (every 10 seconds)
    statusIntervalRef.current = setInterval(checkOnlineStatus, 10000);
    
    socket?.on("online_users_list", (users: Array<{ userId: number; userName: string; status: string }>) => {
      if (otherUserId) {
        const otherUser = users.find(u => u.userId === otherUserId);
        setIsOnline(!!otherUser);
        if (otherUser) {
          setLastSeen(null); // Clear last seen if online
        }
      }
    });

    return () => {
      if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
      socket.emit("leave_conversation", conversationId);
      socket.off("connect", onConnect);
      socket.off("reconnect");
      socket.off("receive_message");
      socket.off("user_typing");
      socket.off("user_stop_typing");
      socket.off("user_status_change");
      socket.off("message_seen");
      socket.off("message_status_update");
      socket.off("online_users_list");
    };
  }, [socket, conversationId, userId, otherUserId, initialMessages]);

  // Auto-scroll to bottom when messages change (unless we're scrolling to a search result)
  useEffect(() => {
    if (currentSearchId != null) return;
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 100);
    return () => clearTimeout(timer);
  }, [messages, currentSearchId]);

  // Scroll to search match when user selects next/prev or when currentSearchId is set
  useEffect(() => {
    if (currentSearchId == null) return;
    const el = messageRefsMap.current[currentSearchId];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [currentSearchId, searchMatchIndex]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const { getApiUrl } = await import('../utils/apiUrl');
      const apiUrl = getApiUrl();
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('lms-token') : null;
      const res = await fetch(`${apiUrl}/api/chat/${conversationId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
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
    } catch {
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
    } catch {
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

    const parentMessageId = replyTo?.id ?? null;

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
          messageType: "text",
          parentMessageId: parentMessageId || undefined
        }),
      });

      const data = await res.json();
      if (data.success && data.message) {
        setMessages((prev) => {
          if (prev.some(m => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
        setNewMessage("");
        setReplyTo(null);
        socket?.emit("stop_typing", { conversationId, userId });
      }
    } catch {
    }
  };

  const scrollToMessage = (messageId: number) => {
    const el = messageRefsMap.current[messageId];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const CHAT_FILE_LIMIT = 10 * 1024 * 1024; // 10MB (Cloudinary free tier)
    if (file.size > CHAT_FILE_LIMIT) {
      Swal.fire({
        icon: "warning",
        title: "File too large",
        text: "Chat files are limited to 10MB (Cloudinary free tier). Please use a smaller file or compress it."
      });
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);

      const { getApiUrl } = await import('../utils/apiUrl');
      const apiUrl = getApiUrl();
      const uploadRes = await fetch(`${apiUrl}/api/chat/upload`, {
        method: "POST",
        body: formData,
      });

      const uploadData = await uploadRes.json();
      if (!uploadData.success) {
        Swal.fire({ icon: "error", title: "Upload failed", text: uploadData?.message || uploadData?.error || "File upload failed." });
        return;
      }

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
          messageType: uploadData.file.messageType,
          parentMessageId: replyTo?.id || undefined
        }),
      });

      const data = await res.json();
      if (data.success) {
        setReplyTo(null);
      } else {
        Swal.fire({ icon: "error", title: "Send failed", text: data?.message || data?.error || "Failed to send file message." });
      }
    } catch (error) {
      Swal.fire({ icon: "error", title: "Upload failed", text: "Could not upload file. Please try again." });
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
    const isSearchMatch = msg.id != null && chatSearchQuery.trim() && searchMatchIds.includes(msg.id);
    const preview = (msg.message || msg.file_name || '').slice(0, 50);
    const replyPreview = preview.length < (msg.message || msg.file_name || '').length ? preview + '…' : preview;

    return (
      <div
        key={msg.id}
        ref={(el) => { if (msg.id != null) messageRefsMap.current[msg.id] = el; }}
        className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3 sm:mb-4 ${isSearchMatch ? 'ring-2 ring-[#11CCEF] ring-offset-1 rounded-xl' : ''}`}
      >
        {!isOwn && (
          <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-full flex-shrink-0 overflow-hidden bg-gradient-to-br from-[#11CCEF] to-[#0daed9] mt-1 mr-1.5">
            {otherUserProfilePicture && (
              <Image src={otherUserProfilePicture} alt="" fill className="object-cover" unoptimized onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            )}
            <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-semibold bg-gradient-to-br from-[#11CCEF] to-[#0daed9]">{(msg.sender_name || '?').charAt(0).toUpperCase()}</span>
          </div>
        )}
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
            {msg.parent_message_id != null && (msg.parent_message != null || msg.parent_sender_name) && (
              <button
                type="button"
                onClick={() => scrollToMessage(msg.parent_message_id!)}
                className="w-full text-left mb-2 pl-2 py-1 border-l-2 border-[#11CCEF] text-xs text-gray-600 hover:bg-black/5 rounded"
              >
                <span className="font-medium">{msg.parent_sender_name || 'Unknown'}</span>
                <br />
                <span className="line-clamp-2">{(msg.parent_message || '').slice(0, 80)}{(msg.parent_message || '').length > 80 ? '…' : ''}</span>
              </button>
            )}
            {msg.message_type === 'image' && msg.file_url && (
              <Image 
                src={msg.file_url} 
                alt={msg.file_name || 'Image'} 
                width={400}
                height={300}
                className="max-w-full rounded-lg mb-2 cursor-pointer hover:opacity-90"
                onClick={() => window.open(msg.file_url!, '_blank')}
                unoptimized
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
            {msg.message ? (
              <div className="text-xs sm:text-sm break-words">
                <LinkifiedText
                  text={msg.message}
                  linkColor={isOwn ? "#ffffff" : "#11CCEF"}
                  className="whitespace-pre-wrap"
                />
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 mt-1 px-1 sm:px-2 flex-wrap">
            <div className="text-xs text-gray-400">
              {msg.created_at && new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            {msg.id && (
              <button
                type="button"
                onClick={() => setReplyTo({ id: msg.id!, preview: replyPreview || '(message)' })}
                className="p-0.5 text-gray-400 hover:text-[#11CCEF] rounded"
                title="Reply"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
              </button>
            )}
            {isOwn && msg.id && (
              <div className="flex items-center" title={readMessages.has(msg.id) || msg.is_read ? "Read" : msg.delivered_at ? "Delivered" : "Sent"}>
                {readMessages.has(msg.id) || msg.is_read ? (
                  <span className="flex -space-x-1.5 text-[#0EA5E9]">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 16 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 7l4 4 10-10"/></svg>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 16 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 7l4 4 10-10"/></svg>
                  </span>
                ) : msg.delivered_at ? (
                  <span className="flex -space-x-1 text-gray-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 16 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 7l4 4 10-10"/></svg>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 16 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 7l4 4 10-10"/></svg>
                  </span>
                ) : (
                  <span className="text-gray-500" title="Sent">✓</span>
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
            <div className="relative flex-shrink-0">
              <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden bg-gradient-to-br from-[#11CCEF] to-[#0daed9] shadow-md">
                {otherUserProfilePicture && (
                  <Image src={otherUserProfilePicture} alt="" fill className="object-cover" unoptimized onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                )}
                <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-base sm:text-lg bg-gradient-to-br from-[#11CCEF] to-[#0daed9]">{otherUserName.charAt(0).toUpperCase()}</span>
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
      
      {/* Search in chat (Assessor/Admin only) */}
      {showSearch && (
        <div className="border-b border-gray-200 px-3 py-2 bg-gray-50 flex-shrink-0 flex items-center gap-2">
          <span className="text-gray-500 text-sm whitespace-nowrap">Search:</span>
          <input
            type="text"
            value={chatSearchQuery}
            onChange={(e) => { setChatSearchQuery(e.target.value); setSearchMatchIndex(0); }}
            placeholder="Search in this chat..."
            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
          />
          {searchMatchIds.length > 0 && (
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {searchMatchIndex + 1} / {searchMatchIds.length}
              <button type="button" onClick={() => setSearchMatchIndex((i) => (i + 1) % searchMatchIds.length)} className="ml-1 text-[#11CCEF] font-medium">Next</button>
              <button type="button" onClick={() => setSearchMatchIndex((i) => (i - 1 + searchMatchIds.length) % searchMatchIds.length)} className="ml-1 text-[#11CCEF] font-medium">Prev</button>
            </span>
          )}
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 space-y-2" style={{ scrollBehavior: 'smooth' }}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-sm sm:text-base text-gray-500">Loading messages...</div>
          </div>
        ) : timelineItems.length === 0 ? (
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
          timelineItems.map((item, idx) =>
            item.type === 'message' ? (
              <React.Fragment key={`msg-${item.message.id ?? idx}`}>{renderMessage(item.message)}</React.Fragment>
            ) : (
              <div key={`ev-${item.event.ticketId}-${item.event.type}-${idx}`} className="flex justify-center my-3">
                <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
                  {item.event.type === 'ticket_created' && (
                    <>Ticket created{item.event.subject ? `: ${item.event.subject}` : ''}</>
                  )}
                  {item.event.type === 'ticket_accepted' && (
                    <>Accepted by {item.event.acceptedByName}</>
                  )}
                  <span className="ml-1.5 text-gray-400">
                    {item.event.createdAt ? new Date(item.event.createdAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : ''}
                  </span>
                </span>
              </div>
            )
          )
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
        {replyTo && (
          <div className="flex items-center justify-between mb-2 px-2 py-1.5 bg-blue-50 border border-[#11CCEF]/30 rounded-lg text-sm">
            <span className="text-gray-600 truncate flex-1">Replying to: {replyTo.preview}</span>
            <button type="button" onClick={() => setReplyTo(null)} className="text-gray-500 hover:text-gray-700 ml-2 flex-shrink-0" title="Cancel reply">✕</button>
          </div>
        )}
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
