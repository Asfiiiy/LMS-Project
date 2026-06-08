"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/app/contexts/SocketContext';
import { openFloatingChat } from './FloatingChatProvider';
import { getApiUrl } from '../utils/apiUrl';

interface Conversation {
  id: number;
  student_id: number | null;
  tutor_id: number | null;
  admin_id: number | null;
  student_name: string;
  tutor_name: string;
  admin_name: string;
  student_profile_picture?: string | null;
  tutor_profile_picture?: string | null;
  admin_profile_picture?: string | null;
  last_message: string | null;
  last_message_time: string | null;
  unread_count: number;
  last_message_at?: string | null;
  ticket_id?: number | null;
  ticket_department_name?: string | null;
}

interface MessageDropdownProps {
  userId: number;
  userName: string;
  userRole?: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function MessageDropdown({ userId, userName, userRole, isOpen, onClose }: MessageDropdownProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const socket = useSocket();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Fetch conversations
  const fetchConversations = useCallback(async (pageNum: number = 1, append: boolean = false) => {
    if (loading) return;
    
    try {
      setLoading(true);
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/chat/conversations/${userId}?page=${pageNum}&limit=15`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('lms-token')}`
        }
      });
      
      const data = await res.json();
      if (data.success) {
        let list = data.conversations || [];
        const isStudent = userRole && ['Student', 'ManagerStudent', 'InstituteStudent'].includes(userRole);
        if (isStudent) list = list.filter((c: Conversation) => c.ticket_id != null);
        if (append) {
          setConversations(prev => [...prev, ...list]);
        } else {
          setConversations(list);
        }
        setHasMore(data.pagination?.hasMore || false);
        setPage(pageNum);
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  }, [userId, loading]);

  // Initial load
  useEffect(() => {
    if (isOpen && conversations.length === 0) {
      fetchConversations(1, false);
    }
  }, [isOpen, fetchConversations, conversations.length]);

  // Use shared socket for real-time updates
  useEffect(() => {
    if (!socket || !userId) return;

    const onReceiveMessage = (message: any) => {
      setConversations(prev => {
        const updated = [...prev];
        const convIndex = updated.findIndex(c => c.id === message.conversation_id);
        if (convIndex !== -1) {
          const conv = updated[convIndex];
          updated.splice(convIndex, 1);
          return [{
            ...conv,
            last_message: message.message || 'Sent a file',
            last_message_time: message.created_at,
            last_message_at: message.created_at,
            unread_count: message.sender_id !== userId ? conv.unread_count + 1 : conv.unread_count
          }, ...updated];
        }
        return prev;
      });
    };

    socket.on('receive_message', onReceiveMessage);
    socket.on('conversation_updated', () => fetchConversations(1, false));

    return () => {
      socket.off('receive_message', onReceiveMessage);
      socket.off('conversation_updated');
    };
  }, [socket, userId, fetchConversations]);

  // When a ticket is marked resolved (chat closed), clear unread for that conversation and refetch so list updates instantly
  useEffect(() => {
    const handler = (e: CustomEvent<{ status?: string; conversation_id?: number | null }>) => {
      if (e.detail?.status !== 'resolved') return;
      const conversationId = e.detail?.conversation_id;
      if (conversationId != null) {
        setConversations(prev =>
          prev.map(c => (c.id === conversationId ? { ...c, unread_count: 0 } : c))
        );
      }
      fetchConversations(1, false);
    };
    window.addEventListener('ticket_updated', handler as EventListener);
    return () => window.removeEventListener('ticket_updated', handler as EventListener);
  }, [fetchConversations]);

  // When user views or replies in floating window, optimistically clear unread instantly (don't wait for socket/refetch)
  useEffect(() => {
    const handler = (e: CustomEvent<{ conversationId?: number }>) => {
      const conversationId = e.detail?.conversationId;
      if (conversationId != null) {
        setConversations(prev =>
          prev.map(c => (c.id === conversationId ? { ...c, unread_count: 0 } : c))
        );
      }
    };
    window.addEventListener('conversation_marked_read', handler as EventListener);
    return () => window.removeEventListener('conversation_marked_read', handler as EventListener);
  }, []);

  // Infinite scroll
  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement || !isOpen) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      if (scrollHeight - scrollTop <= clientHeight + 100 && hasMore && !loading) {
        fetchConversations(page + 1, true);
      }
    };

    scrollElement.addEventListener('scroll', handleScroll);
    return () => scrollElement.removeEventListener('scroll', handleScroll);
  }, [isOpen, hasMore, loading, page, fetchConversations]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString();
  };

  const getOtherUser = (conv: Conversation) => {
    const isStudent = userRole && ['Student', 'ManagerStudent', 'InstituteStudent'].includes(userRole);
    if (conv.student_id === userId) {
      // When tutor has joined (tutor_id set on escalation), show tutor name instead of department
      const tutorJoined = isStudent && conv.ticket_id && conv.tutor_id != null && conv.tutor_name !== 'Unknown';
      const name = tutorJoined
        ? conv.tutor_name
        : (isStudent && conv.ticket_id && conv.ticket_department_name)
          ? conv.ticket_department_name
          : (conv.tutor_name !== 'Unknown' ? conv.tutor_name : conv.admin_name);
      return {
        name,
        avatar: conv.tutor_profile_picture || conv.admin_profile_picture
      };
    } else if (conv.tutor_id === userId) {
      return {
        name: conv.student_name !== 'Unknown' ? conv.student_name : conv.admin_name,
        avatar: conv.student_profile_picture || conv.admin_profile_picture
      };
    } else {
      return {
        name: conv.student_name !== 'Unknown' ? conv.student_name : conv.tutor_name,
        avatar: conv.student_profile_picture || conv.tutor_profile_picture
      };
    }
  };

  const handleConversationClick = async (conv: Conversation) => {
    onClose();
    
    // Mark as read
    try {
      const apiUrl = getApiUrl();
      await fetch(`${apiUrl}/api/chat/mark-read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('lms-token')}`
        },
        body: JSON.stringify({
          conversationId: conv.id,
          userId: userId
        })
      });
      
      // Update local state
      setConversations(prev =>
        prev.map(c =>
          c.id === conv.id ? { ...c, unread_count: 0 } : c
        )
      );
    } catch (error) {
    }

    // Open floating chat - construct conversation object
    const conversationForChat = {
      id: conv.id,
      student_id: conv.student_id,
      tutor_id: conv.tutor_id,
      admin_id: conv.admin_id,
      student_name: conv.student_name,
      tutor_name: conv.tutor_name,
      admin_name: conv.admin_name,
      student_profile_picture: conv.student_profile_picture,
      tutor_profile_picture: conv.tutor_profile_picture,
      admin_profile_picture: conv.admin_profile_picture,
      conversation_type: (conv.ticket_id ? 'ticket' : 'direct') as 'direct' | 'ticket',
      title: null,
      course_title: '',
      ticket_id: conv.ticket_id ?? null,
      ticket_department_name: conv.ticket_department_name ?? null
    };
    openFloatingChat(conversationForChat);
  };

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-2xl border border-gray-200 z-50 max-h-[600px] flex flex-col"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-black">Messages</h3>
        <button
          onClick={() => router.push('/chat')}
          className="text-sm text-[#11CCEF] hover:text-[#0daed9] font-medium"
        >
          See all in Messenger
        </button>
      </div>

      {/* Conversations List */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        style={{ maxHeight: '500px' }}
      >
        {loading && conversations.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <p className="text-sm">No conversations yet</p>
          </div>
        ) : (
          conversations.map((conv) => {
            const otherUser = getOtherUser(conv);
            const isUnread = conv.unread_count > 0;
            
            return (
              <div
                key={conv.id}
                onClick={() => handleConversationClick(conv)}
                className={`px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 transition-colors ${
                  isUnread ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    {otherUser.avatar ? (
                      <img
                        src={otherUser.avatar}
                        alt={otherUser.name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#11CCEF] to-[#0daed9] flex items-center justify-center text-white font-semibold">
                        {otherUser.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    {isUnread && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#E51791] rounded-full border-2 border-white"></div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-sm font-medium truncate ${isUnread ? 'text-black font-semibold' : 'text-gray-900'}`}>
                        {otherUser.name}
                      </span>
                      {conv.last_message_time && (
                        <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                          {formatTime(conv.last_message_time)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <p className={`text-sm truncate ${isUnread ? 'text-black font-medium' : 'text-gray-600'}`}>
                        {conv.last_message || 'No messages yet'}
                      </p>
                      {conv.unread_count > 0 && (
                        <span className="ml-2 px-2 py-0.5 bg-[#E51791] text-white text-xs font-semibold rounded-full flex-shrink-0">
                          {conv.unread_count > 99 ? '99+' : conv.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        {loading && conversations.length > 0 && (
          <div className="p-4 text-center text-gray-500 text-sm">Loading more...</div>
        )}
      </div>
    </div>
  );
}
