"use client";
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import FloatingChatWindow from "./FloatingChatWindow";
import { useSocket } from "@/app/contexts/SocketContext";
import { openFloatingTicketForStudent } from "./StudentFloatingTicketProvider";
import { openFloatingTicketForStaff } from "./FloatingTicketProvider";
import { User } from "./types";

interface Conversation {
  id: number;
  student_id: number | null;
  tutor_id: number | null;
  admin_id: number | null;
  conversation_type?: 'direct' | 'group' | 'course' | 'ticket';
  title: string | null;
  student_name: string;
  tutor_name: string;
  admin_name: string;
  course_title: string;
  ticket_id?: number | null;
  ticket_department_name?: string | null;
}

interface OpenChat {
  conversation: Conversation;
  position: { x: number; y: number };
  isMinimized: boolean;
  unreadCount: number;
}

interface FloatingChatContextType {
  openChat: (conversation: Conversation) => void;
  closeChat: (conversationId: number) => void;
  minimizeChat: (conversationId: number) => void;
  maximizeChat: (conversationId: number) => void;
  updateUnreadCount: (conversationId: number, count: number) => void;
  markAsRead: (conversationId: number) => void;
  openChats: OpenChat[];
}

export const FloatingChatContext = createContext<FloatingChatContextType | undefined>(undefined);
export type { FloatingChatContextType };

export function useFloatingChat() {
  const context = useContext(FloatingChatContext);
  if (!context) {
    throw new Error('useFloatingChat must be used within FloatingChatProvider');
  }
  return context;
}

// Global function to open chat from anywhere (set by provider)
let globalOpenChat: ((conversation: Conversation) => void) | null = null;

export function openFloatingChat(conversation: Conversation) {
  if (globalOpenChat) {
    globalOpenChat(conversation);
  } else {
    if (process.env.NODE_ENV === 'development') {
      console.warn('FloatingChatProvider not initialized');
    }
  }
}

export function FloatingChatProvider({ children, user }: { children: React.ReactNode; user: User | null }) {
  const pathname = usePathname();
  const socket = useSocket();
  const [openChats, setOpenChats] = useState<OpenChat[]>([]);

  // Load open chats from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && user) {
      const saved = localStorage.getItem(`floatingChats_${user.id}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setOpenChats(parsed);
        } catch (e) {
        }
      }
    }
  }, [user]);

  // Save open chats to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && user) {
      localStorage.setItem(`floatingChats_${user.id}`, JSON.stringify(openChats));
    }
  }, [openChats, user]);

  const openChat = useCallback((conversation: Conversation) => {
    const isStudent = user && ['Student', 'ManagerStudent', 'InstituteStudent'].includes(user.role || '');
    if (isStudent && conversation.ticket_id) {
      openFloatingTicketForStudent(conversation.ticket_id);
      return;
    }
    // Staff (tutor, etc.): when clicking a ticket conversation in Messages, open FloatingTicketWindow
    if (!isStudent && conversation.ticket_id) {
      openFloatingTicketForStaff(conversation.ticket_id);
      return;
    }
    setOpenChats(prev => {
      // Check if chat is already open
      const existing = prev.find(chat => chat.conversation.id === conversation.id);
      if (existing) {
        // If minimized, maximize it
        if (existing.isMinimized) {
          return prev.map(chat =>
            chat.conversation.id === conversation.id
              ? { ...chat, isMinimized: false }
              : chat
          );
        }
        return prev; // Already open and maximized
      }

      // Calculate position to avoid overlap
      const baseX = window.innerWidth - 400;
      const baseY = window.innerHeight - 520;
      const offset = prev.length * 20;
      
      const newChat: OpenChat = {
        conversation,
        position: {
          x: Math.max(0, baseX - offset),
          y: Math.max(0, baseY - offset)
        },
        isMinimized: false,
        unreadCount: 0
      };

      return [...prev, newChat];
    });
  }, [user]);

  // Set global function
  useEffect(() => {
    globalOpenChat = openChat;
    return () => {
      globalOpenChat = null;
    };
  }, [openChat]);

  const closeChat = useCallback((conversationId: number) => {
    setOpenChats(prev => prev.filter(chat => chat.conversation.id !== conversationId));
  }, []);

  const minimizeChat = useCallback((conversationId: number) => {
    setOpenChats(prev => prev.map(chat =>
      chat.conversation.id === conversationId
        ? { ...chat, isMinimized: true }
        : chat
    ));
  }, []);

  const maximizeChat = useCallback((conversationId: number) => {
    setOpenChats(prev => prev.map(chat =>
      chat.conversation.id === conversationId
        ? { ...chat, isMinimized: false }
        : chat
    ));
  }, []);

  const updateUnreadCount = useCallback((conversationId: number, count: number) => {
    setOpenChats(prev => prev.map(chat =>
      chat.conversation.id === conversationId
        ? { ...chat, unreadCount: count }
        : chat
    ));
  }, []);

  const markAsRead = useCallback((conversationId: number) => {
    setOpenChats(prev => prev.map(chat =>
      chat.conversation.id === conversationId
        ? { ...chat, unreadCount: 0 }
        : chat
    ));
  }, []);

  const updatePosition = useCallback((conversationId: number, x: number, y: number) => {
    setOpenChats(prev => prev.map(chat =>
      chat.conversation.id === conversationId
        ? { ...chat, position: { x, y } }
        : chat
    ));
  }, []);

  // Listen for new messages via shared socket and auto-open chat (desktop only)
  useEffect(() => {
    if (!socket || !user) return;
    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
    if (!isDesktop || pathname === '/chat') return;

    const onReceiveMessage = async (message: any) => {
      if (!message.conversation_id || message.sender_id === user.id) return;
      setOpenChats(prev => {
        const isAlreadyOpen = prev.some(chat => chat.conversation.id === message.conversation_id);
        if (!isAlreadyOpen) {
          (async () => {
            try {
              const { getApiUrl } = await import('../utils/apiUrl');
              const apiUrl = getApiUrl();
              const token = localStorage.getItem('lms-token');
              const res = await fetch(`${apiUrl}/api/chat/conversations/${user.id}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
              });
              const data = await res.json();
              if (data.success && data.conversations) {
                const conversation = data.conversations.find((c: Conversation) => c.id === message.conversation_id);
                const isStudent = user?.role && ['Student', 'ManagerStudent', 'InstituteStudent'].includes(user.role);
                if (conversation && (!isStudent || conversation.ticket_id != null)) openChat(conversation);
              }
            } catch (error) {
            }
          })();
          return prev;
        }
        return prev.map(chat =>
          chat.conversation.id === message.conversation_id
            ? { ...chat, unreadCount: chat.unreadCount + 1 }
            : chat
        );
      });
    };

    socket.on('receive_message', onReceiveMessage);
    return () => {
      socket.off('receive_message', onReceiveMessage);
    };
  }, [socket, user, pathname, openChat]);

  // Listen for new messages and update unread counts
  useEffect(() => {
    if (!user || openChats.length === 0) return;

    const checkUnreadCounts = async () => {
      try {
        const { getApiUrl } = await import('../utils/apiUrl');
        const apiUrl = getApiUrl();
        const token = typeof localStorage !== 'undefined' ? localStorage.getItem('lms-token') : null;
        const res = await fetch(`${apiUrl}/api/chat/conversations/${user.id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        const data = await res.json();
        
        if (data.success && data.conversations) {
          data.conversations.forEach((conv: Conversation & { unread_count?: number }) => {
            if (conv.unread_count !== undefined && conv.unread_count > 0) {
              updateUnreadCount(conv.id, conv.unread_count);
            }
          });
        }
      } catch (error) {
      }
    };

    // Check every 5 seconds
    const interval = setInterval(checkUnreadCounts, 5000);
    checkUnreadCounts(); // Initial check

    return () => clearInterval(interval);
  }, [user, updateUnreadCount]);

  if (!user) return <>{children}</>;

  const isStudent = ['Student', 'ManagerStudent', 'InstituteStudent'].includes(user.role || '');
  const chatsToRender = isStudent ? [] : openChats;

  return (
    <FloatingChatContext.Provider
      value={{
        openChat,
        closeChat,
        minimizeChat,
        maximizeChat,
        updateUnreadCount,
        markAsRead,
        openChats
      }}
    >
      {children}
      {/* Render expanded floating chat windows (with stacking offset) - students use FloatingTicketWindow only */}
      {chatsToRender
        .filter(chat => !chat.isMinimized)
        .map((chat, index) => {
          const stackOffset = index * 20;
          const finalPosition = {
            x: Math.max(0, chat.position.x - stackOffset),
            y: Math.max(0, chat.position.y - stackOffset)
          };
          
          return (
            <FloatingChatWindow
              key={chat.conversation.id}
              conversation={chat.conversation}
              userId={user.id!}
              userName={user.name || 'User'}
              onClose={() => closeChat(chat.conversation.id)}
              onMinimize={() => minimizeChat(chat.conversation.id)}
              isMinimized={false}
              position={finalPosition}
              onPositionChange={(x, y) => updatePosition(chat.conversation.id, x, y)}
              unreadCount={chat.unreadCount}
              onMarkAsRead={() => markAsRead(chat.conversation.id)}
            />
          );
        })}
      
      {/* Render minimized chat windows (stacked on right side) */}
      {chatsToRender
        .filter(chat => chat.isMinimized)
        .map((chat, index) => (
          <FloatingChatWindow
            key={`minimized-${chat.conversation.id}`}
            conversation={chat.conversation}
            userId={user.id!}
            userName={user.name || 'User'}
            onClose={() => closeChat(chat.conversation.id)}
            onMinimize={() => maximizeChat(chat.conversation.id)}
            isMinimized={true}
            position={{ x: 0, y: 0 }}
            onPositionChange={() => {}}
            unreadCount={chat.unreadCount}
            onMarkAsRead={() => markAsRead(chat.conversation.id)}
            minimizedIndex={index}
          />
        ))}
    </FloatingChatContext.Provider>
  );
}
