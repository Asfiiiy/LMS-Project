"use client";
import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useSocket } from "@/app/contexts/SocketContext";
import Swal from "sweetalert2";
import { LinkifiedText } from "@/app/utils/linkify";
// Icons will be inline SVGs

interface Message {
  id?: number | string;
  conversation_id: number;
  sender_id: number;
  sender_name?: string;
  sender_role_name?: string | null;
  message: string | null;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  message_type: 'text' | 'file' | 'image' | 'pdf';
  created_at?: string;
  is_read?: number;
  read_at?: string | null;
  delivered_at?: string | null;
  is_edited?: number;
  edited_at?: string | null;
  is_deleted?: number;
}

interface Conversation {
  id: number;
  student_id: number | null;
  tutor_id: number | null;
  admin_id: number | null;
  conversation_type?: 'direct' | 'group' | 'course' | 'ticket';
  title: string | null;
  ticket_id?: number | null;
  ticket_department_name?: string | null;
  student_name: string;
  tutor_name: string;
  admin_name: string;
  course_title: string;
  student_profile_picture?: string | null;
  tutor_profile_picture?: string | null;
  admin_profile_picture?: string | null;
  ticket_status?: string | null;
  ticket_escalated_by_name?: string | null;
}

interface FloatingChatWindowProps {
  conversation: Conversation;
  userId: number;
  userName: string;
  onClose: () => void;
  onMinimize: () => void;
  isMinimized: boolean;
  position: { x: number; y: number };
  onPositionChange: (x: number, y: number) => void;
  unreadCount: number;
  onMarkAsRead: () => void;
  minimizedIndex?: number; // Index for stacking minimized chats
}

export default function FloatingChatWindow({
  conversation,
  userId,
  userName,
  onClose,
  onMinimize,
  isMinimized,
  position,
  onPositionChange,
  unreadCount,
  onMarkAsRead,
  minimizedIndex = 0
}: FloatingChatWindowProps) {
  const socket = useSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isExpanded, setIsExpanded] = useState(true);
  const [otherUserProfile, setOtherUserProfile] = useState<{ profile_picture?: string | null; email?: string } | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<number | string | null>(null);
  const [editMessageText, setEditMessageText] = useState("");
  const [hoveredMessageId, setHoveredMessageId] = useState<number | string | null>(null);
  const [showEditDelete, setShowEditDelete] = useState<number | string | null>(null);
  const [markCompleteLoading, setMarkCompleteLoading] = useState(false);
  const [markedResolved, setMarkedResolved] = useState(false);
  const [fetchedTicketId, setFetchedTicketId] = useState<number | null>(null);
  const [fetchedTicketStatus, setFetchedTicketStatus] = useState<string | null>(null);
  const [fetchedEscalatedByName, setFetchedEscalatedByName] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isStudentView = conversation.student_id === userId;
  const ticketId = conversation.ticket_id ?? fetchedTicketId ?? null;
  const ticketStatus = markedResolved ? 'resolved' : (conversation.ticket_status ?? fetchedTicketStatus ?? null);
  const isClosed = ticketStatus === 'resolved';
  const escalatedByName = conversation.ticket_escalated_by_name ?? fetchedEscalatedByName ?? null;
  const isTicketConversation = !!ticketId;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const statusIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get other user info
  const otherUserId = conversation.student_id === userId 
    ? (conversation.tutor_id || conversation.admin_id)
    : (conversation.student_id || conversation.admin_id || conversation.tutor_id);
  
  // When tutor has joined (tutor_id set on escalation), show tutor name instead of department
  const tutorJoined = conversation.ticket_id != null && conversation.tutor_id != null && conversation.tutor_name !== 'Unknown';
  const otherUserName = conversation.student_id === userId
    ? (tutorJoined
        ? conversation.tutor_name
        : (conversation.ticket_id != null && conversation.ticket_department_name
            ? conversation.ticket_department_name
            : (conversation.tutor_name !== 'Unknown' ? conversation.tutor_name : conversation.admin_name)))
    : (conversation.student_name !== 'Unknown' ? conversation.student_name : conversation.tutor_name || conversation.admin_name);

  // Fetch full conversation (including ticket_id, ticket_status) when opened without them (e.g. from tutor dashboard)
  useEffect(() => {
    if (conversation.ticket_id != null) return;
    let cancelled = false;
    (async () => {
      try {
        const { getApiUrl } = await import('../utils/apiUrl');
        const apiUrl = getApiUrl();
        const token = localStorage.getItem('lms-token');
        const res = await fetch(`${apiUrl}/api/chat/conversation/${conversation.id}?userId=${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (cancelled || !data.success || !data.conversation) return;
        const c = data.conversation as { ticket_id?: number | null; ticket_status?: string | null; ticket_escalated_by_name?: string | null };
        if (c.ticket_id != null) {
          setFetchedTicketId(c.ticket_id);
          if (c.ticket_status != null) setFetchedTicketStatus(c.ticket_status);
          if (c.ticket_escalated_by_name != null) setFetchedEscalatedByName(c.ticket_escalated_by_name);
        }
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [conversation.id, conversation.ticket_id, userId]);

  // Get profile picture from conversation data
  useEffect(() => {
    if (!otherUserId) return;
    
    // Get profile picture from conversation data
    let profilePicture: string | null = null;
    let email: string | undefined = undefined;
    
    if (conversation.student_id === otherUserId && conversation.student_profile_picture) {
      profilePicture = conversation.student_profile_picture;
    } else if (conversation.tutor_id === otherUserId && conversation.tutor_profile_picture) {
      profilePicture = conversation.tutor_profile_picture;
    } else if (conversation.admin_id === otherUserId && conversation.admin_profile_picture) {
      profilePicture = conversation.admin_profile_picture;
    }
    
    if (profilePicture) {
      setOtherUserProfile({
        profile_picture: profilePicture,
        email: email
      });
    } else {
      // If not in conversation data, try to fetch it
      const fetchProfile = async () => {
        try {
          const { getApiUrl } = await import('../utils/apiUrl');
          const apiUrl = getApiUrl();
          
          // Direct query to get profile picture
          const profileRes = await fetch(`${apiUrl}/api/chat/user/${otherUserId}/profile`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('lms-token')}`
            }
          });
          
          if (profileRes.ok) {
            const profileData = await profileRes.json();
            if (profileData.success) {
              setOtherUserProfile({
                profile_picture: profileData.profile_picture || undefined,
                email: profileData.email || undefined
              });
            }
          }
        } catch {
        }
      };
      
      fetchProfile();
    }
  }, [otherUserId, conversation]);

  // Use shared socket: join conversation, listen for events
  useEffect(() => {
    if (!socket) return;

    const onConnect = () => {
      socket.emit("user_online");
      socket.emit("join_conversation", { conversationId: conversation.id });
    };

    socket.on("connect", onConnect);
    if (socket.connected) onConnect();

    socket.emit("mark_as_read", { conversationId: conversation.id });

    fetchMessages();
    if (isExpanded && unreadCount > 0) {
      markConversationAsRead();
      onMarkAsRead();
    }

    const onMessageRead = ({ conversationId: readConvId, readerId }: { conversationId: number; readerId: number }) => {
      if (readConvId === conversation.id && readerId === otherUserId) {
        setMessages((prev) => prev.map((m) => (Number(m.sender_id) === userId ? { ...m, is_read: 1 } : m)));
      }
    };
    const onReceiveMessage = (message: Message) => {
      if (message.conversation_id === conversation.id) {
        setMessages((prev) => {
          if (prev.some(m => m.id === message.id)) return prev;
          return [...prev, message];
        });
        if (message.sender_id !== userId && message.id) {
          socket.emit("message_delivered", { messageId: message.id, conversationId: conversation.id });
        }
        if (isExpanded) {
          markConversationAsRead();
          onMarkAsRead();
        }
      }
    };
    const onMessageEdited = (payload: Message | { messageId: number; newText: string }) => {
      if ('conversation_id' in payload && payload.conversation_id === conversation.id) {
        setMessages((prev) => prev.map((msg) => (msg.id === payload.id ? { ...msg, ...payload } : msg)));
      } else if ('messageId' in payload && 'newText' in payload) {
        setMessages((prev) => prev.map((msg) =>
          msg.id === payload.messageId ? { ...msg, message: payload.newText, is_edited: 1 } : msg
        ));
      }
    };
    const onMessageDeleted = ({ messageId }: { messageId: number }) => {
      setMessages((prev) => prev.map((msg) =>
        msg.id === messageId ? { ...msg, message: 'This message was deleted.', is_deleted: 1 } : msg
      ));
    };
    const onMessageStatusUpdate = (payload: { messageId?: number; conversationId?: number; status: string; readerId?: number }) => {
      if (payload.status === 'delivered' && payload.messageId) {
        setMessages((prev) => prev.map((m) =>
          m.id === payload.messageId && Number(m.sender_id) === userId ? { ...m, delivered_at: new Date().toISOString() } : m
        ));
      }
      if (payload.status === 'read' && payload.conversationId === conversation.id && payload.readerId === otherUserId) {
        setMessages((prev) => prev.map((m) => (Number(m.sender_id) === userId ? { ...m, is_read: 1, read_at: new Date().toISOString() } : m)));
      }
    };
    const onConversationJoined = (data: { conversationId: number; ticketStatus?: string }) => {
      if (data.conversationId === conversation.id) setFetchedTicketStatus(data.ticketStatus === 'closed' ? 'resolved' : data.ticketStatus || null);
    };
    const onUserTyping = ({ userName: typingUserName, userId: typingUserId }: { userName: string; userId: number }) => {
      if (typingUserId !== userId && typingUserId === otherUserId) setTypingUser(typingUserName);
    };
    const onUserStopTyping = ({ userId: typingUserId }: { userId: number }) => {
      if (typingUserId === otherUserId) setTypingUser(null);
    };
    const onUserStatusChange = ({ userId: statusUserId, status, lastSeen: lastSeenTime }: { userId: number; status: string; lastSeen: string }) => {
      if (statusUserId === otherUserId) {
        setIsOnline(status === "online");
        setLastSeen(lastSeenTime);
      }
    };
    const onOnlineUsersList = (users: Array<{ userId: number; userName: string; status: string }>) => {
      if (otherUserId) {
        const otherUser = users.find(u => u.userId === otherUserId);
        setIsOnline(!!otherUser);
        if (otherUser) setLastSeen(null);
      }
    };

    socket.on("message_read", onMessageRead);
    socket.on("receive_message", onReceiveMessage);
    socket.on("message_edited", onMessageEdited);
    socket.on("message_deleted", onMessageDeleted);
    socket.on("message_status_update", onMessageStatusUpdate);
    socket.on("conversation_joined", onConversationJoined);
    socket.on("socket_error", (data: { message?: string }) => {
      if (data?.message) Swal.fire({ icon: "warning", title: "Chat", text: data.message });
    });
    socket.on("user_typing", onUserTyping);
    socket.on("user_stop_typing", onUserStopTyping);
    socket.on("user_status_change", onUserStatusChange);
    socket.on("online_users_list", onOnlineUsersList);

    const checkOnlineStatus = () => socket.emit("get_online_users");
    checkOnlineStatus();
    statusIntervalRef.current = setInterval(checkOnlineStatus, 10000);

    return () => {
      if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      socket.emit("leave_conversation", conversation.id);
      socket.off("connect", onConnect);
      socket.off("message_read", onMessageRead);
      socket.off("receive_message", onReceiveMessage);
      socket.off("message_edited", onMessageEdited);
      socket.off("message_deleted", onMessageDeleted);
      socket.off("message_status_update", onMessageStatusUpdate);
      socket.off("conversation_joined", onConversationJoined);
      socket.off("socket_error");
      socket.off("user_typing", onUserTyping);
      socket.off("user_stop_typing", onUserStopTyping);
      socket.off("user_status_change", onUserStatusChange);
      socket.off("online_users_list", onOnlineUsersList);
    };
  }, [socket, conversation.id, userId, otherUserId, isExpanded, unreadCount, onMarkAsRead]);

  // Auto-scroll
  useEffect(() => {
    if (isExpanded && !isMinimized) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }, 100);
    }
  }, [messages, isExpanded, isMinimized]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const { getApiUrl } = await import('../utils/apiUrl');
      const apiUrl = getApiUrl();
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('lms-token') : null;
      const res = await fetch(`${apiUrl}/api/chat/${conversation.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (data.success) {
        setMessages(data.messages || []);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const markConversationAsRead = async () => {
    try {
      const { getApiUrl } = await import('../utils/apiUrl');
      const apiUrl = getApiUrl();
      await fetch(`${apiUrl}/api/chat/mark-read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('lms-token')}`
        },
        body: JSON.stringify({ conversationId: conversation.id, userId })
      });
      window.dispatchEvent(new CustomEvent('conversation_marked_read', { detail: { conversationId: conversation.id } }));
    } catch {
    }
  };

  const handleTyping = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    socket?.emit("typing", { conversationId: conversation.id, userName, userId });
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      socket?.emit("stop_typing", { conversationId: conversation.id, userId });
    }, 2000);
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    const messageText = newMessage.trim();
    setNewMessage("");
    socket?.emit("stop_typing", { conversationId: conversation.id, userId });

    // Optimistic update - add message immediately
    const tempId = Date.now(); // Temporary ID for optimistic message
    const optimisticMessage: Message = {
      id: tempId,
      conversation_id: conversation.id,
      sender_id: userId,
      sender_name: userName,
      message: messageText,
      file_url: null,
      file_name: null,
      file_type: null,
      message_type: 'text',
      created_at: new Date().toISOString(),
      is_read: 0,
      delivered_at: null
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      const { getApiUrl } = await import('../utils/apiUrl');
      const apiUrl = getApiUrl();
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('lms-token') : null;
      const res = await fetch(`${apiUrl}/api/chat/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          conversationId: conversation.id,
          senderId: userId,
          message: String(messageText).trim(),
          messageType: "text"
        }),
      });

      const data = await res.json();
      if (data.success && data.message) {
        // Replace optimistic message with real message
        setMessages((prev) => {
          const filtered = prev.filter(m => m.id !== tempId);
          if (filtered.some(m => m.id === data.message.id)) return filtered;
          return [...filtered, data.message];
        });
        // Mark as read when user sends a reply so MessageDropdown clears unread
        markConversationAsRead();
        onMarkAsRead();
      } else {
        // Remove optimistic message on error
        setMessages((prev) => prev.filter(m => m.id !== tempId));
        setNewMessage(messageText); // Restore message text
        Swal.fire({ icon: "error", title: "Send failed", text: data?.message || data?.error || "Failed to send message. Please try again." });
      }
    } catch (error) {
      setMessages((prev) => prev.filter(m => m.id !== tempId));
      setNewMessage(messageText);
      Swal.fire({ icon: "error", title: "Send failed", text: "Failed to send message. Please try again." });
    }
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
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('lms-token') : null;
      const uploadRes = await fetch(`${apiUrl}/api/chat/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const uploadData = await uploadRes.json();
      if (!uploadData.success) {
        Swal.fire({ icon: "error", title: "Upload failed", text: uploadData?.message || uploadData?.error || "File upload failed." });
        return;
      }

      const res = await fetch(`${apiUrl}/api/chat/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          conversationId: conversation.id,
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
      if (editingMessageId) {
        handleSaveEdit();
      } else {
        sendMessage();
      }
    }
    if (e.key === 'Escape' && editingMessageId) {
      setEditingMessageId(null);
      setEditMessageText("");
    }
  };

  const handleEditMessage = (messageId: number, currentText: string) => {
    setEditingMessageId(messageId);
    setEditMessageText(currentText || "");
  };

  const handleSaveEdit = async () => {
    if (editingMessageId == null || !editMessageText.trim() || typeof editingMessageId !== 'number') {
      setEditingMessageId(null);
      setEditMessageText("");
      return;
    }

    const messageText = editMessageText.trim();
    const messageId = editingMessageId;

    // Optimistic update
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId
          ? { ...msg, message: messageText, is_edited: 1 }
          : msg
      )
    );

    setEditingMessageId(null);
    setEditMessageText("");

    try {
      const { getApiUrl } = await import('../utils/apiUrl');
      const apiUrl = getApiUrl();
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('lms-token') : null;
      const res = await fetch(`${apiUrl}/api/chat/message/edit`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          messageId,
          message: messageText,
          senderId: userId
        }),
      });

      const data = await res.json();
      if (data.success && data.message) {
        setMessages((prev) =>
          prev.map((msg) => (msg.id === messageId ? data.message : msg))
        );
      } else {
        fetchMessages();
        Swal.fire({ icon: "error", title: "Edit failed", text: data?.message || "Failed to edit message." });
      }
    } catch (error) {
      fetchMessages();
      Swal.fire({ icon: "error", title: "Edit failed", text: "Error editing message. Please try again." });
    }
  };

  const handleMarkComplete = async () => {
    if (!ticketId) return;
    setMarkCompleteLoading(true);
    try {
      const { getApiUrl } = await import('../utils/apiUrl');
      const apiUrl = getApiUrl();
      const token = localStorage.getItem('lms-token');
      const res = await fetch(`${apiUrl}/api/tickets/${ticketId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'resolved' })
      });
      const data = await res.json();
      if (data.success) {
        setMarkedResolved(true);
        window.dispatchEvent(new CustomEvent('ticket_updated', { detail: { ticketId, status: 'resolved', conversation_id: conversation.id } }));
      } else alert(data.message || 'Failed to mark complete');
    } catch {
      alert('Failed to mark complete');
    } finally {
      setMarkCompleteLoading(false);
    }
  };

  const handleDeleteMessage = async (messageId: number) => {
    if (typeof messageId !== 'number') return;
    if (!confirm("Are you sure you want to delete this message?")) {
      return;
    }

    // Optimistic update - show "This message was deleted." (soft delete)
    setMessages((prev) => prev.map((msg) =>
      msg.id === messageId ? { ...msg, message: "This message was deleted.", is_deleted: 1 } : msg
    ));

    try {
      const { getApiUrl } = await import('../utils/apiUrl');
      const apiUrl = getApiUrl();
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('lms-token') : null;
      const res = await fetch(`${apiUrl}/api/chat/message/delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          messageId,
          senderId: userId
        }),
      });

      const data = await res.json();
      if (!data.success) {
        fetchMessages();
        Swal.fire({ icon: "error", title: "Delete failed", text: data?.message || "Failed to delete message." });
      }
    } catch (error) {
      fetchMessages();
      alert("Error deleting message. Please try again.");
    }
  };

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (windowRef.current) {
      const rect = windowRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      setIsDragging(true);
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = e.clientX - dragOffset.x;
        const newY = e.clientY - dragOffset.y;
        
        // Keep within viewport
        const maxX = window.innerWidth - 380;
        const maxY = window.innerHeight - 500;
        
        onPositionChange(
          Math.max(0, Math.min(newX, maxX)),
          Math.max(0, Math.min(newY, maxY))
        );
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, onPositionChange]);

  const formatLastSeen = (lastSeenTime: string | null) => {
    if (!lastSeenTime) return '';
    const date = new Date(lastSeenTime);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  const renderMessage = (msg: Message) => {
    // For ticket conversations: left = student, right = staff/team (one-to-one style)
    // For other chats: left = other person, right = current user
    const isOwnMessage = Number(msg.sender_id) === Number(userId);
    const isFromStudent = conversation.student_id != null && Number(msg.sender_id) === Number(conversation.student_id);
    const isRightSide = isTicketConversation
      ? !isFromStudent   // staff/team on right
      : isOwnMessage;    // own messages on right
    const isEditing = editingMessageId === msg.id;
    const isHovered = hoveredMessageId === msg.id;
    const isChatMessage = typeof msg.id === 'number'; // only messages table has numeric id; ticket_* cannot be edited
    const canEdit = isOwnMessage && isChatMessage && !isClosed &&
      msg.created_at && (Date.now() - new Date(msg.created_at).getTime() < 15 * 60 * 1000);
    const showActions = isOwnMessage && isChatMessage && showEditDelete === msg.id && canEdit;
    const senderDisplayName = (msg.sender_name && msg.sender_name !== 'Unknown') ? msg.sender_name : otherUserName;
    const senderInitial = (senderDisplayName && senderDisplayName !== 'Unknown') ? senderDisplayName.charAt(0).toUpperCase() : '?';

    return (
      <div 
        key={msg.id} 
        className={`flex ${isRightSide ? 'justify-end' : 'justify-start'} mb-2 group items-end gap-1.5`}
        onMouseEnter={() => {
          setHoveredMessageId(msg.id || null);
          if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
          hoverTimeoutRef.current = setTimeout(() => {
            if (isOwnMessage) setShowEditDelete(msg.id || null);
          }, 150);
        }}
        onMouseLeave={() => {
          setHoveredMessageId(null);
          if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
          }
          setShowEditDelete(null);
        }}
      >
        {!isRightSide && (
          <div className="flex-shrink-0 order-1" title={senderDisplayName}>
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#11CCEF] to-[#0daed9] flex items-center justify-center text-white text-xs font-bold">
              {senderInitial}
            </div>
          </div>
        )}
        <div className={`max-w-[80%] ${isRightSide ? 'order-2' : 'order-2'} relative`}>
          {isRightSide && isTicketConversation && (msg.sender_role_name || msg.sender_name) && (
            <div className="text-right mb-0.5">
              <span className="text-xs text-gray-500">
                {msg.sender_name || 'Staff'}
                {msg.sender_role_name ? ` · ${msg.sender_role_name}` : ''}
              </span>
            </div>
          )}
          {isEditing ? (
            <div className={`rounded-lg px-3 py-1.5 text-sm ${
              isRightSide
                ? 'bg-[#11CCEF] text-white rounded-br-none'
                : 'bg-gray-100 text-gray-900 rounded-bl-none'
            }`}>
              <textarea
                value={editMessageText}
                onChange={(e) => setEditMessageText(e.target.value)}
                onKeyDown={handleKeyPress}
                className="w-full bg-transparent border-none outline-none resize-none text-xs text-white placeholder-white placeholder-opacity-70"
                rows={3}
                autoFocus
                placeholder="Edit your message..."
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleSaveEdit}
                  className="px-2 py-1 bg-white rounded text-xs text-pink-500 hover:bg-opacity-90 transition-colors font-medium"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setEditingMessageId(null);
                    setEditMessageText("");
                  }}
                  className="px-2 py-1 bg-white rounded text-xs text-pink-500 hover:bg-opacity-90 transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div
              className={`rounded-lg px-3 py-1.5 text-sm relative ${
                isRightSide
                  ? 'bg-[#11CCEF] text-white rounded-br-none'
                  : 'bg-gray-100 text-gray-900 rounded-bl-none'
              }`}
            >
              {msg.message_type === 'image' && msg.file_url ? (
                <div
                  className="relative w-full max-w-[280px] h-48 rounded mb-1 cursor-pointer overflow-hidden"
                  onClick={() => window.open(msg.file_url!, '_blank')}
                >
                  <Image
                    src={msg.file_url}
                    alt={msg.file_name || 'Image'}
                    fill
                    className="object-contain"
                    unoptimized
                  />
                </div>
              ) : null}
              {msg.message_type === 'pdf' && msg.file_url ? (
                <div className="flex items-center gap-2 p-1.5 bg-white bg-opacity-20 rounded mb-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M4 18h12V6h-4V2H4v16zm-2 1V0h12l4 4v16H2v-1z"/>
                  </svg>
                  <a href={msg.file_url} target="_blank" rel="noopener noreferrer" className="text-xs underline truncate">
                    {msg.file_name}
                  </a>
                </div>
              ) : null}
              {msg.message_type === 'file' && msg.file_url ? (
                <div className="flex items-center gap-2 p-1.5 bg-white bg-opacity-20 rounded mb-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0017.414 6L14 2.586A2 2 0 0012.586 2H8z"/>
                  </svg>
                  <a href={msg.file_url} target="_blank" rel="noopener noreferrer" className="text-xs underline truncate">
                    {msg.file_name}
                  </a>
                </div>
              ) : null}
              {msg.message && typeof msg.message === 'string' && msg.message.trim() ? (
                (msg as any).is_deleted ? (
                  <p className="text-xs whitespace-pre-wrap break-words italic text-gray-500">
                    {String(msg.message).trim()}
                  </p>
                ) : (
                  <div className="text-xs break-words">
                    <LinkifiedText
                      text={String(msg.message).trim()}
                      linkColor={isRightSide ? "#ffffff" : "#11CCEF"}
                      className="whitespace-pre-wrap"
                    />
                  </div>
                )
              ) : null}
              {((msg as any).is_edited === 1 || (msg as any).is_edited === true) && !(msg as any).is_deleted ? (
                <span className="text-xs opacity-70 italic ml-1">(edited)</span>
              ) : null}
            </div>
          )}
          <div className="text-xs mt-0.5 px-1 flex items-center gap-1 flex-wrap text-gray-500">
            {msg.created_at && new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            {isOwnMessage && (
              <span className="inline-flex items-center ml-1 shrink-0" title={msg.is_read ? 'Read' : msg.delivered_at ? 'Delivered' : 'Sent'}>
                {msg.is_read ? (
                  <span className="inline-flex -space-x-1 text-blue-600" title="Read">
                    <svg className="w-4 h-4" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 7l4 4 10-10"/></svg>
                    <svg className="w-4 h-4" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 7l4 4 10-10"/></svg>
                  </span>
                ) : msg.delivered_at ? (
                  <span className="inline-flex -space-x-1 text-gray-400" title="Delivered">
                    <svg className="w-4 h-4" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 7l4 4 10-10"/></svg>
                    <svg className="w-4 h-4" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 7l4 4 10-10"/></svg>
                  </span>
                ) : (
                  <span className="text-gray-500" title="Sent">✓</span>
                )}
              </span>
            )}
            {showActions && typeof msg.id === 'number' && (
              <span className="inline-flex items-center gap-1 ml-2">
                <button
                  onClick={() => handleEditMessage(msg.id as number, msg.message || "")}
                  className="text-gray-600 hover:text-[#11CCEF] hover:underline text-xs"
                >
                  Edit
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={() => handleDeleteMessage(msg.id as number)}
                  className="text-red-500 hover:text-red-600 hover:underline text-xs"
                >
                  Delete
                </button>
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (isMinimized) {
    // Calculate position for minimized chat (stack from right)
    const minimizedRight = 20 + (minimizedIndex * 70);
    
    return (
      <div
        ref={windowRef}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: `${minimizedRight}px`,
          zIndex: 1000,
          width: '60px',
          height: '60px',
        }}
        className="bg-white rounded-full shadow-2xl border-2 border-[#11CCEF] cursor-pointer hover:scale-110 transition-transform"
        onClick={() => {
          setIsExpanded(true);
          onMinimize();
        }}
      >
        <div className="relative w-full h-full flex items-center justify-center">
          {otherUserProfile?.profile_picture ? (
            <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-[#11CCEF] flex-shrink-0">
              <Image
                src={otherUserProfile.profile_picture}
                alt={otherUserName}
                width={48}
                height={48}
                className="object-cover"
                unoptimized
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    const fallback = document.createElement('div');
                    fallback.className = 'absolute inset-0 bg-gradient-to-br from-[#11CCEF] to-[#0daed9] rounded-full flex items-center justify-center text-white font-bold text-lg';
                    fallback.textContent = otherUserName.charAt(0).toUpperCase();
                    parent.appendChild(fallback);
                  }
                }}
              />
            </div>
          ) : (
            <div className="w-12 h-12 bg-gradient-to-br from-[#11CCEF] to-[#0daed9] rounded-full flex items-center justify-center text-white font-bold text-lg">
              {otherUserName.charAt(0).toUpperCase()}
            </div>
          )}
          {unreadCount > 0 && (
            <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </div>
          )}
          <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`}></div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={windowRef}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 1000,
        width: '380px',
        height: '500px',
      }}
      className="bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
    >
      {/* Header - Draggable */}
      <div
        onMouseDown={handleMouseDown}
        className="bg-gradient-to-r from-[#11CCEF] to-[#0daed9] text-white px-4 py-2 flex items-center justify-between cursor-move"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="relative flex-shrink-0 w-8 h-8 rounded-full overflow-hidden">
            {otherUserProfile?.profile_picture ? (
              <Image
                src={otherUserProfile.profile_picture}
                alt={otherUserName}
                width={32}
                height={32}
                className="rounded-full object-cover border-2 border-white"
                unoptimized
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    const fallback = document.createElement('div');
                    fallback.className = 'absolute inset-0 bg-white bg-opacity-20 rounded-full flex items-center justify-center text-white font-bold text-sm';
                    fallback.textContent = otherUserName.charAt(0).toUpperCase();
                    parent.appendChild(fallback);
                  }
                }}
              />
            ) : (
              <div className="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center text-white font-bold text-sm">
                {otherUserName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-white ${isOnline ? 'bg-green-400' : 'bg-gray-400'}`}></div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">{otherUserName}</div>
            <div className="text-xs opacity-90 truncate">
              {ticketStatus === 'escalated' && escalatedByName ? (
                <span title="Chat escalated by">Escalated by {escalatedByName}</span>
              ) : otherUserProfile?.email ? (
                <span className="truncate">{otherUserProfile.email}</span>
              ) : (
                isOnline ? 'Online' : lastSeen ? `Last seen ${formatLastSeen(lastSeen)}` : 'Offline'
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isTicketConversation && !isStudentView && ticketStatus !== 'resolved' && (
            <button
              type="button"
              onClick={handleMarkComplete}
              disabled={markCompleteLoading}
              className="px-2 py-1 text-xs font-medium bg-white/20 hover:bg-white/30 rounded transition-colors disabled:opacity-50"
              title="Mark as complete"
            >
              {markCompleteLoading ? '…' : 'Mark complete'}
            </button>
          )}
          <button
            onClick={() => {
              setIsExpanded(false);
              onMinimize();
            }}
            className="p-1 hover:bg-white rounded transition-colors group"
            title="Minimize"
          >
            <svg className="w-4 h-4 text-white group-hover:text-pink-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white rounded transition-colors group"
            title="Close"
          >
            <svg className="w-4 h-4 text-white group-hover:text-pink-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-3 bg-gray-50" style={{ scrollBehavior: 'smooth' }}>
        {loading && messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-sm text-gray-500">Loading messages...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-400">
              <p className="text-sm">No messages yet</p>
            </div>
          </div>
        ) : (
          messages.map(renderMessage)
        )}
        {typingUser && (
          <div className="flex items-center gap-2 text-xs text-gray-500 px-1">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
            <span className="truncate">{typingUser} is typing...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {isTicketConversation && isStudentView && ticketStatus === 'escalated' && (
        <div className="px-3 py-2 bg-amber-50 border-t border-amber-200 text-center text-sm text-amber-800">
          Your tutor will join soon.
        </div>
      )}

      {isClosed ? (
        <div className="border-t border-gray-200 px-3 py-4 bg-gray-50 text-center text-sm text-gray-600">
          Ticket is closed. You cannot send new messages.
        </div>
      ) : (
      /* Input Area */
      <div className="border-t border-gray-200 p-2 bg-white">
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileUpload}
            className="hidden"
            accept="*"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="p-1.5 text-gray-500 hover:text-[#11CCEF] rounded transition-colors disabled:opacity-50"
            title="Attach file"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
          <textarea
            value={newMessage}
            onChange={handleTyping}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#11CCEF] resize-none"
          />
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim() || uploading}
            className="bg-[#11CCEF] text-white px-4 py-1.5 text-sm rounded-lg font-medium hover:bg-[#0daed9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? '...' : 'Send'}
          </button>
        </div>
      </div>
      )}
    </div>
  );
}
