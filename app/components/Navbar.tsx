'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { apiService } from '@/app/services/api';
import { useSocket } from '@/app/contexts/SocketContext';
import { FiBell, FiMessageSquare, FiHeart, FiFileText } from 'react-icons/fi';
import { openFloatingChat } from './FloatingChatProvider';
import { useFloatingTicket } from './FloatingTicketProvider';
import MessageDropdown from './MessageDropdown';
import { getNotificationConfig, normalizeNotificationType } from '@/app/utils/notificationConfig';
import { navigateToNotification } from '@/app/utils/notificationNavigation';

interface User {
  id?: number;
  name: string;
  role: 'Admin' | 'Assessor' | 'Manager' | 'Student' | 'Moderator' | 'Operation Manager' | 'Accounts Manager' | 'Administrative Manager' | 'Admission Manager' | 'Team Member' | 'Certificate Manager' | 'Claim Manager' | 'Consultation Manager' | 'ManagerStudent' | 'InstituteStudent' | null;
}

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  related_post_id: number | null;
  related_comment_id: number | null;
  related_user_id: number | null;
  related_user_name: string | null;
  related_user_avatar: string | null;
  post_title: string | null;
  related_conversation_id?: number | null;
  related_course_id?: number | null;
  related_submission_id?: number | null;
  is_read: boolean;
  created_at: string;
}

const Navbar = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const isUpdatingRef = useRef(false);
  
  // Notifications
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState<'all' | 'unread'>('all');
  const notificationRef = useRef<HTMLDivElement>(null);
  const socket = useSocket();
  
  // Messages
  const [unreadConversationCount, setUnreadConversationCount] = useState(0);
  const [showMessages, setShowMessages] = useState(false);
  const messageRef = useRef<HTMLDivElement>(null);
  const floatingTicket = useFloatingTicket();
  const floatingTicketRef = useRef(floatingTicket);
  floatingTicketRef.current = floatingTicket;

  // Optimized function to check and update user state with immediate sync
  const checkUserState = useCallback(() => {
    // Prevent multiple simultaneous updates
    if (isUpdatingRef.current) return;
    isUpdatingRef.current = true;

    try {
      const userData = localStorage.getItem('lms-user');
      if (userData) {
        const parsedUser = JSON.parse(userData);
        // Use requestAnimationFrame for immediate visual update
        requestAnimationFrame(() => {
          setUser(parsedUser);
          isUpdatingRef.current = false;
        });
      } else {
        requestAnimationFrame(() => {
          setUser(null);
          isUpdatingRef.current = false;
        });
      }
    } catch {
      requestAnimationFrame(() => {
        setUser(null);
        isUpdatingRef.current = false;
      });
    }
  }, []);

  // Initial user check and setup listeners for instant updates
  useEffect(() => {
    // Initial check - synchronous for first render
    try {
      const userData = localStorage.getItem('lms-user');
      if (userData) {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }

    // Listen for storage events (works across tabs/windows)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'lms-user' || e.key === 'lms-token') {
        checkUserState();
      }
    };

    // Listen for custom auth events (works in same tab) - immediate update
    const handleAuthChange = () => {
      // Immediate synchronous check for instant UI update
      try {
        const userData = localStorage.getItem('lms-user');
        if (userData) {
          const parsedUser = JSON.parse(userData);
          setUser(parsedUser);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      }
    };

    // Add event listeners with immediate flag for better performance
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('auth-change', handleAuthChange, false);
    window.addEventListener('login', handleAuthChange, false);
    window.addEventListener('logout', handleAuthChange, false);

    // Update on page visibility change (when user returns to tab)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkUserState();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth-change', handleAuthChange);
      window.removeEventListener('login', handleAuthChange);
      window.removeEventListener('logout', handleAuthChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkUserState]);

  // Fetch profile picture when user is logged in
  useEffect(() => {
    const fetchProfilePicture = async () => {
      if (!user?.id) {
        setProfilePicture(null);
        return;
      }

      try {
        // Fetch for student roles
        if (['Student', 'ManagerStudent', 'InstituteStudent'].includes(user.role || '')) {
          const response = await apiService.getStudentProfile();
          if (response?.success && response.profile?.profile_picture) {
            setProfilePicture(response.profile.profile_picture);
          } else {
            setProfilePicture(null);
          }
        }
        // Fetch for staff roles (all staff use staff profile)
        else if (['Admin', 'Assessor', 'Moderator', 'Operation Manager', 'Accounts Manager', 'Admission Manager', 'Administrative Manager', 'Team Member', 'Manager', 'Certificate Manager'].includes(user.role || '')) {
          const response = await apiService.getStaffProfile();
          if (response?.success && response.profile?.profile_picture) {
            setProfilePicture(response.profile.profile_picture);
          } else {
            setProfilePicture(null);
          }
        }
        // Other roles (Manager, etc.)
        else {
          setProfilePicture(null);
        }
      } catch {
        setProfilePicture(null);
      }
    };

    fetchProfilePicture();

    // Listen for profile picture updates
    const handleProfileUpdate = () => {
      fetchProfilePicture();
    };
    window.addEventListener('profile-picture-updated', handleProfileUpdate);

    return () => {
      window.removeEventListener('profile-picture-updated', handleProfileUpdate);
    };
  }, [user?.id, user?.role]);

  // Optimized scroll effect for navbar with throttling
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setScrolled(window.scrollY > 10);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Memoized logout handler
  const handleLogout = useCallback(() => {
    router.push('/logout');
  }, [router]);

  // Memoized user display name initial
  const userInitial = useMemo(() => {
    return user?.name?.charAt(0).toUpperCase() || '';
  }, [user?.name]);

  // Use shared socket from context; add listeners and join rooms
  useEffect(() => {
    if (!socket || !user?.id) return;

    const adminRoles = ['Admin', 'Certificate Manager', 'Accounts Manager', 'Operation Manager', 'Administrative Manager', 'Admission Manager', 'Team Member'];
    const isAdmin = adminRoles.includes(user?.role || '');

    const onConnect = () => {
      socket.emit('join_notifications');
      socket.emit('user_online');
      if (isAdmin) socket.emit('join_admin_room');
    };

    socket.on('connect', onConnect);
    if (socket.connected) onConnect();

    socket.on('connect_error', () => {});
    socket.on('disconnect', () => {});
    socket.on('reconnect', () => {
      socket.emit('join_notifications');
      socket.emit('user_online');
      if (isAdmin) socket.emit('join_admin_room');
    });
    socket.on('new_notification', (notification: Notification) => {
      if (notification.type !== 'chat' && !notification.related_conversation_id) {
        setNotifications(prev => [notification, ...prev]);
        setUnreadCount(prev => prev + 1);
      }
    });
    socket.on('notification_count_update', () => fetchUnreadCount());
    socket.on('conversation_updated', () => fetchUnreadConversationCount());
    socket.on('receive_message', () => fetchUnreadConversationCount());
    socket.on('unread_count_update', () => fetchUnreadConversationCount());
    socket.on('ticket_message', (data: { ticketId: number; message: unknown }) => {
      window.dispatchEvent(new CustomEvent('ticket_message', { detail: data }));
    });
    socket.on('ticket_messages_read', (data: { ticketId: number; messageIds: number[] }) => {
      window.dispatchEvent(new CustomEvent('ticket_messages_read', { detail: data }));
    });
    socket.on('ticket_updated', (data: { ticketId: number; assigned_to?: number; assigned_to_name?: string; status?: string; conversation_id?: number | null }) => {
      window.dispatchEvent(new CustomEvent('ticket_updated', { detail: data }));
    });
    socket.on('ticket_reply_from_student', (data: { ticketId: number; subject?: string }) => {
      const ticket = floatingTicketRef.current;
      ticket?.incrementUnreadTicketReply();
      ticket?.openFloatingTicket(data.ticketId, data.subject);
    });
    socket.on('ticket_escalated_to_you', (data: { ticketId: number; subject?: string }) => {
      const ticket = floatingTicketRef.current;
      ticket?.incrementUnreadTicketReply();
      ticket?.openFloatingTicket(data.ticketId, data.subject);
    });

    fetchNotifications();
    fetchUnreadCount();
    fetchUnreadConversationCount();

    return () => {
      socket.off('connect', onConnect);
      socket.off('connect_error');
      socket.off('disconnect');
      socket.off('reconnect');
      socket.off('new_notification');
      socket.off('notification_count_update');
      socket.off('conversation_updated');
      socket.off('receive_message');
      socket.off('unread_count_update');
      socket.off('ticket_message');
      socket.off('ticket_messages_read');
      socket.off('ticket_updated');
      socket.off('ticket_reply_from_student');
      socket.off('ticket_escalated_to_you');
    };
  }, [socket, user?.id]);

  // Heartbeat: keep user marked online in Redis (every 60s)
  useEffect(() => {
    if (!socket) return;
    const interval = setInterval(() => {
      if (socket.connected) {
        socket.emit('heartbeat');
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [socket]);

  // Close notifications when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    if (!user?.id) return;
    try {
      setLoadingNotifications(true);
      let allNotifications: Notification[] = [];
      const res = await apiService.getNotifications(50, 0);
      if (res?.success) {
        const nonChatNotifications = (res.notifications || []).filter(
          (n: Notification) => n.type !== 'chat' && !n.related_conversation_id
        );
        allNotifications = nonChatNotifications;
      }
      // For students, also fetch payment reminder notifications
      const isStudent = user?.role && ['Student', 'ManagerStudent', 'InstituteStudent'].includes(user.role);
      if (isStudent) {
        try {
          const studentRes = await apiService.getStudentNotifications();
          if (studentRes?.success && studentRes.notifications?.length) {
            const paymentReminders = studentRes.notifications.map((sn: any) => ({
              id: sn.id + 100000,
              type: sn.type || 'payment_reminder',
              title: sn.title || 'Payment Reminder',
              message: sn.message || '',
              related_post_id: null,
              related_comment_id: null,
              related_user_id: null,
              related_user_name: null,
              related_user_avatar: null,
              post_title: null,
              is_read: !!sn.is_read,
              created_at: sn.created_at
            }));
            allNotifications = [...paymentReminders, ...allNotifications].sort(
              (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
          }
        } catch (e) {
          // student_notifications table may not exist yet
        }
      }
      setNotifications(allNotifications);
      const unreadCountVal = allNotifications.filter((n: Notification) => !n.is_read).length;
      setUnreadCount(unreadCountVal);
    } catch {
    } finally {
      setLoadingNotifications(false);
    }
  };

  const fetchUnreadCount = async () => {
    if (!user?.id) return;
    try {
      const res = await apiService.getUnreadNotificationCount();
      if (res?.success) {
        // We need to filter out chat notifications from the count
        // Fetch notifications and filter
        const allRes = await apiService.getNotifications(100, 0);
        if (allRes?.success) {
          const nonChatNotifications = (allRes.notifications || []).filter(
            (n: Notification) => n.type !== 'chat' && !n.related_conversation_id && !n.is_read
          );
          setUnreadCount(nonChatNotifications.length);
        } else {
          setUnreadCount(0);
        }
      }
    } catch {
    }
  };

  const fetchUnreadConversationCount = useCallback(async () => {
    const uid = user?.id;
    if (!uid) return;
    try {
      const { getApiUrl } = await import('../utils/apiUrl');
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/chat/conversations/${uid}/unread-count`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('lms-token')}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setUnreadConversationCount(data.count || 0);
      }
    } catch {
    }
  }, [user?.id]);

  // When a ticket is updated (resolved, escalated, etc.), refresh unread counts so Messages badge and dropdown update
  useEffect(() => {
    const handler = (e: CustomEvent<{ status?: string; assigned_to?: number }>) => {
      if (user?.id && (e.detail?.status === 'resolved' || e.detail?.assigned_to != null)) {
        fetchUnreadConversationCount();
      }
    };
    window.addEventListener('ticket_updated', handler as EventListener);
    return () => window.removeEventListener('ticket_updated', handler as EventListener);
  }, [user?.id, fetchUnreadConversationCount]);

  // When user views/replies in floating chat/ticket window, refresh Messages badge count
  useEffect(() => {
    const handler = () => {
      if (user?.id) fetchUnreadConversationCount();
    };
    window.addEventListener('conversation_marked_read', handler as EventListener);
    return () => window.removeEventListener('conversation_marked_read', handler as EventListener);
  }, [user?.id, fetchUnreadConversationCount]);

  const handleMarkNotificationRead = async (notificationId: number) => {
    try {
      // Payment reminders use student_notifications API (ids offset by 100000)
      if (notificationId >= 100000) {
        const res = await apiService.markNotificationRead(notificationId - 100000);
        if (res?.success) {
          setNotifications(prev =>
            prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
          );
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
        return;
      }
      const res = await apiService.markNotificationAsRead(notificationId);
      if (res?.success) {
        setNotifications(prev => 
          prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch {
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await apiService.markAllNotificationsAsRead();
      if (res?.success) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
      }
    } catch {
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read if unread
    if (!notification.is_read) {
      await handleMarkNotificationRead(notification.id);
    }
    
    // Close notification dropdown
    setShowNotifications(false);
    
    // Handle chat notifications separately (should be filtered out, but handle for safety)
    if (notification.type === 'chat' || notification.related_conversation_id) {
      try {
        const { getApiUrl } = await import('../utils/apiUrl');
        const apiUrl = getApiUrl();
        
        if (user?.id && notification.related_conversation_id) {
          const res = await fetch(`${apiUrl}/api/chat/conversations/${user.id}`);
          const data = await res.json();
          
          if (data.success && data.conversations) {
            const conversation = data.conversations.find((c: any) => c.id === notification.related_conversation_id);
            const isStudent = user?.role && ['Student', 'ManagerStudent', 'InstituteStudent'].includes(user.role);
            if (conversation && (!isStudent || conversation.ticket_id != null)) {
              openFloatingChat(conversation);
              return;
            }
          }
        }
      } catch {
      }
      return;
    }
    
    // DIRECT NAVIGATION - Handle common cases first for reliability
    const role = user?.role?.toLowerCase() || 'student';
    const dashboardPrefix = `/dashboard/${role}`;
    
    // 1. Forum notifications (highest priority)
    if (notification.related_post_id) {
      const postId = notification.related_post_id;
      const commentId = notification.related_comment_id;
      const url = `/dashboard/forum?postId=${postId}${commentId ? `&commentId=${commentId}` : ''}`;
      // Use window.location for more reliable navigation
      window.location.href = url;
      return;
    }
    
    // 2. File rejection notifications - qualification course
    if (notification.type === 'file_rejected') {
      // If we have course_id, use it directly
      if (notification.related_course_id) {
        const courseId = notification.related_course_id;
        const submissionId = notification.related_submission_id;
        const url = `${dashboardPrefix}/qualification/${courseId}/view${submissionId ? `?submission=${submissionId}` : ''}`;
        // Use window.location for more reliable navigation
        window.location.href = url;
        return;
      }
      
      // If no course_id, try to fetch it from the message by querying student's courses
      if (notification.message && role === 'student' && user?.id) {
        try {
          const { getApiUrl } = await import('../utils/apiUrl');
          const apiUrl = getApiUrl();
          
          // Extract course name from message
          const courseMatch = notification.message.match(/Course:\s*([^\n]+)/i);
          if (courseMatch) {
            const courseName = courseMatch[1].trim();
            
            // Fetch student's qualification courses
            const res = await fetch(`${apiUrl}/api/student/${user.id}/qualification-courses`, {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('lms-token')}`,
                'Content-Type': 'application/json'
              }
            });
            
            if (res.ok) {
              const data = await res.json();
              if (data.success && data.qualificationCourses && Array.isArray(data.qualificationCourses)) {
                // Find course by name (fuzzy match)
                const course = data.qualificationCourses.find((c: any) => 
                  c.course_title && (
                    c.course_title.toLowerCase().includes(courseName.toLowerCase()) ||
                    courseName.toLowerCase().includes(c.course_title.toLowerCase().substring(0, 20)) ||
                    c.course_title.toLowerCase().includes('qualifi') && courseName.toLowerCase().includes('qualifi')
                  )
                );
                
                if (course) {
                  const courseId = course.course_id || course.id;
                  const submissionId = notification.related_submission_id;
                  const url = `${dashboardPrefix}/qualification/${courseId}/view${submissionId ? `?submission=${submissionId}` : ''}`;
                  // Use window.location for more reliable navigation
                  window.location.href = url;
                  return;
                }
              }
            }
          }
        } catch {
        }
      }
      
      // Final fallback for file_rejected: go to student dashboard (they can find qualification courses there)
      const fallbackUrl = `${dashboardPrefix}`;
      // Use window.location for more reliable navigation
      window.location.href = fallbackUrl;
      return;
    }
    
    // 3. Course-related notifications
    if (notification.related_course_id) {
      const courseId = notification.related_course_id;
      const submissionId = notification.related_submission_id;
      
      // Check if qualification course (from message or type)
      const isQualification = notification.type === 'file_rejected' || 
                             notification.type === 'assignment_resubmit' ||
                             (notification.message && /qualifi|level\s*\d+|diploma/i.test(notification.message));
      
      if (isQualification && role === 'student') {
        const url = `${dashboardPrefix}/qualification/${courseId}/view${submissionId ? `?submission=${submissionId}` : ''}`;
        // Use window.location for more reliable navigation
        window.location.href = url;
        return;
      }
      
      // Regular course
      const url = `${dashboardPrefix}/courses/${courseId}${submissionId ? `?submission=${submissionId}` : ''}`;
      // Use window.location for more reliable navigation
      window.location.href = url;
      return;
    }
    
    // 4. Certificate notifications
    if (notification.type === 'certificate_ready') {
      const url = `${dashboardPrefix}/certificates`;
      // Use window.location for more reliable navigation
      window.location.href = url;
      return;
    }
    
    // 5. Use navigation utility for other cases
    try {
      const navigationData = {
        related_post_id: notification.related_post_id ? Number(notification.related_post_id) : null,
        related_comment_id: notification.related_comment_id ? Number(notification.related_comment_id) : null,
        related_course_id: notification.related_course_id ? Number(notification.related_course_id) : null,
        related_submission_id: notification.related_submission_id ? Number(notification.related_submission_id) : null,
        related_conversation_id: notification.related_conversation_id ? Number(notification.related_conversation_id) : null,
        related_user_id: notification.related_user_id ? Number(notification.related_user_id) : null,
        type: notification.type
      };
      
      const navigated = navigateToNotification(
        navigationData,
        router,
        user?.role,
        notification.message
      );
      
      if (navigated) {
        if (process.env.NODE_ENV === 'development') {
          console.log('[Notification Click] ✅ Navigation successful via utility');
        }
        return;
      }
    } catch {
    }
    
    // Final fallback: always navigate somewhere
    const dashboardLink = role === 'student' 
      ? '/dashboard/student' 
      : role === 'tutor'
      ? '/dashboard/tutor'
      : '/dashboard/admin';
    router.push(dashboardLink);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getDashboardLink = () => {
    if (user?.role === 'Admin') return '/dashboard/admin';
    if (user?.role === 'Assessor') return '/dashboard/tutor';
    if (user?.role === 'Moderator') return '/dashboard/moderator';
    if (user?.role === 'Manager') return '/dashboard/manager';
    if (user?.role === 'Certificate Manager') return '/dashboard/certificate-manager';
    if (user?.role === 'Claim Manager') return '/dashboard/claim-manager';
    if (user?.role === 'Consultation Manager') return '/dashboard/consultation-manager';
    if (user?.role === 'Team Member') return '/dashboard/tickets';
    if (['Student', 'ManagerStudent', 'InstituteStudent'].includes(user?.role || '')) return '/dashboard/student';
    if (['Operation Manager', 'Accounts Manager', 'Administrative Manager', 'Admission Manager'].includes(user?.role || '')) return '/dashboard/tickets';
    return '/dashboard/tickets';
  };

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (mobileMenuOpen && !target.closest('nav')) {
        setMobileMenuOpen(false);
      }
    };

    if (mobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [mobileMenuOpen]);

  return (
    <nav className={`sticky top-0 z-50 transition-all duration-300 ${
      scrolled 
        ? 'bg-white/95 backdrop-blur-xl shadow-2xl border-b border-gray-100' 
        : 'bg-white shadow-md'
    }`}>
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="flex justify-between h-16 sm:h-20 items-center">
          {/* Logo and Title (Mobile) */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href={user ? getDashboardLink() : '/'} className="flex items-center group">
              <div className="relative group-hover:scale-110 transition-transform duration-300">
                <Image 
                  src="/assets/logo.png" 
                  alt="LMS Logo" 
                  width={32} 
                  height={32}
                  className="sm:w-10 sm:h-10 object-contain"
                />
              </div>
            </Link>
            {/* Mobile Title */}
            <Link href={user ? getDashboardLink() : '/'} className="sm:hidden">
              <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-black bg-gradient-to-r from-[#11CCEF] to-[#E51791] bg-clip-text text-transparent animate-pulse">
                Inspire LMS
              </h1>
            </Link>
          </div>

          {/* Desktop Title (Center) */}
          <div className="hidden sm:flex flex-1 justify-center">
            <Link href={user ? getDashboardLink() : '/'}>
              <h1 className="text-xl md:text-2xl lg:text-3xl font-black bg-gradient-to-r from-[#11CCEF] to-[#E51791] bg-clip-text text-transparent animate-pulse hover:opacity-80 transition-opacity cursor-pointer">
                Inspire LMS
              </h1>
            </Link>
          </div>

          {/* Desktop Right Menu */}
          <div className="hidden md:flex items-center space-x-2 lg:space-x-3">
            {!user ? (
              <>
                <Link
                  href="/"
                  className="px-4 lg:px-6 py-2 lg:py-3 bg-gradient-to-r from-[#11CCEF] to-[#12B7F3] text-white rounded-xl lg:rounded-2xl font-semibold text-sm lg:text-base shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
                >
                  Login
                </Link>
              </>
            ) : (
              <>
                {/* Messages Icon */}
                <div className="relative" ref={messageRef}>
                  <button
                    onClick={() => {
                      setShowMessages(!showMessages);
                      setShowNotifications(false);
                    }}
                    className="relative p-2 lg:p-3 text-[#11CCEF] hover:text-[#0daed9] hover:bg-gray-100 rounded-xl transition-colors"
                  >
                    <FiMessageSquare className="w-5 h-5 lg:w-6 lg:h-6" />
                    {(() => {
                      const total = unreadConversationCount + (floatingTicket?.unreadTicketReplyCount ?? 0);
                      return total > 0 ? (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#E51791] text-white text-xs rounded-full flex items-center justify-center font-bold">
                          {total > 99 ? '99+' : total}
                        </span>
                      ) : null;
                    })()}
                  </button>
                  
                  {/* Messages Dropdown */}
                  {showMessages && user && (
                    <MessageDropdown
                      userId={user.id!}
                      userName={user.name}
                      userRole={user.role}
                      isOpen={showMessages}
                      onClose={() => setShowMessages(false)}
                    />
                  )}
                </div>

                {/* Notifications Bell */}
                <div className="relative" ref={notificationRef}>
                  <button
                    onClick={() => {
                      setShowNotifications(!showNotifications);
                      if (!showNotifications) {
                        fetchNotifications();
                      }
                    }}
                    className="relative p-2 lg:p-3 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
                  >
                    <FiBell className="w-5 h-5 lg:w-6 lg:h-6" />
                    {unreadCount > 0 && (
                      <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>
                  
                  {/* Notifications Dropdown */}
                  {showNotifications && (
                    <div className="absolute right-0 mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 max-h-[600px] overflow-hidden">
                      <div className="p-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
                        <h3 className="font-bold text-gray-900">Notifications</h3>
                        {unreadCount > 0 && (
                          <button
                            onClick={handleMarkAllRead}
                            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                          >
                            Mark all as read
                          </button>
                        )}
                      </div>
                      <div className="flex gap-1 border-b border-gray-200 px-4">
                        <button
                          onClick={() => setNotificationFilter('all')}
                          className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                            notificationFilter === 'all'
                              ? 'text-blue-600'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          All
                          {notificationFilter === 'all' && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
                          )}
                        </button>
                        <button
                          onClick={() => setNotificationFilter('unread')}
                          className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                            notificationFilter === 'unread'
                              ? 'text-blue-600'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          Unread
                          {unreadCount > 0 && (
                            <span className="ml-1 px-1.5 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                              {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                          )}
                          {notificationFilter === 'unread' && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
                          )}
                        </button>
                      </div>
                      <div className="overflow-y-auto max-h-[500px]">
                        {loadingNotifications ? (
                          // Skeleton loader
                          <div className="p-4 space-y-3">
                            {[1, 2, 3].map((i) => (
                              <div key={i} className="animate-pulse flex items-start gap-3 p-3">
                                <div className="w-12 h-12 rounded-full bg-gray-200"></div>
                                <div className="flex-1 space-y-2">
                                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (() => {
                          const filteredNotifications = notificationFilter === 'unread'
                            ? notifications.filter(n => !n.is_read)
                            : notifications;
                          
                          return filteredNotifications.length === 0 ? (
                            // Empty state
                            <div className="p-12 text-center text-gray-500">
                              <FiBell className="w-16 h-16 mx-auto mb-3 text-gray-300" />
                              <p className="font-medium text-gray-600">No {notificationFilter === 'unread' ? 'unread ' : ''}notifications</p>
                              <p className="text-sm text-gray-400 mt-1">You're all caught up!</p>
                            </div>
                          ) : (
                            <div className="divide-y divide-gray-100">
                              {filteredNotifications.map((notification) => {
                                const normalizedType = normalizeNotificationType(notification.type);
                                const config = getNotificationConfig(normalizedType);
                                const Icon = config.icon;
                                
                                const userInitial = notification.related_user_name
                                  ? notification.related_user_name.charAt(0).toUpperCase()
                                  : '?';
                                const hasAvatar = notification.related_user_avatar && 
                                  notification.related_user_avatar !== 'null' && 
                                  notification.related_user_avatar.trim() !== '';

                                // Modern styling with accent border and background tint
                                const isUnread = !notification.is_read;
                                const baseClasses = `relative flex items-start gap-3 p-4 cursor-pointer transition-all duration-200 hover:shadow-sm ${config.accentColor} border-l-4 ${isUnread ? config.bgTint : 'bg-white hover:bg-gray-50'}`;

                                return (
                                  <div
                                    key={notification.id}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleNotificationClick(notification);
                                    }}
                                    className={baseClasses}
                                  >
                                    {/* Left accent border is handled by border-l-4 in baseClasses */}
                                    
                                    {/* Avatar with icon badge */}
                                    <div className="relative flex-shrink-0">
                                      {hasAvatar && notification.related_user_avatar ? (
                                        <img
                                          src={notification.related_user_avatar}
                                          alt={notification.related_user_name || 'User'}
                                          className="w-12 h-12 rounded-full object-cover border-2 border-gray-200"
                                          onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            target.style.display = 'none';
                                            const parent = target.parentElement;
                                            if (parent) {
                                              const fallback = document.createElement('div');
                                              fallback.className = 'w-12 h-12 rounded-full bg-gradient-to-r from-blue-400 to-cyan-300 flex items-center justify-center text-white font-bold';
                                              fallback.textContent = userInitial;
                                              parent.appendChild(fallback);
                                            }
                                          }}
                                        />
                                      ) : (
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-400 to-cyan-300 flex items-center justify-center text-white font-bold text-lg">
                                          {userInitial}
                                        </div>
                                      )}
                                      {/* Icon badge */}
                                      <div className={`absolute -bottom-1 -right-1 w-6 h-6 ${config.iconBg} rounded-full flex items-center justify-center text-white border-2 border-white shadow-sm`}>
                                        <Icon className="w-3.5 h-3.5" />
                                      </div>
                                    </div>

                                    {/* Notification content */}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                          <p className={`text-sm leading-snug ${isUnread ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                                            {notification.related_user_name ? (
                                              <>
                                                <span className="font-semibold text-gray-900">
                                                  {notification.related_user_name}
                                                </span>
                                                {' '}
                                                <span className="text-gray-600">
                                                  {(notification.message.replace(notification.related_user_name, '').trim())?.length > 100
                                                    ? notification.message.replace(notification.related_user_name, '').trim().substring(0, 100) + '...'
                                                    : notification.message.replace(notification.related_user_name, '').trim()}
                                                </span>
                                              </>
                                            ) : (
                                              <span className="text-gray-700">
                                                {notification.message?.length > 100
                                                  ? notification.message.substring(0, 100) + '...'
                                                  : notification.message
                                                }
                                              </span>
                                            )}
                                          </p>
                                          
                                          {/* Post title or additional context */}
                                          {notification.post_title && (
                                            <p className="text-xs mt-1.5 truncate text-gray-500 italic">
                                              "{notification.post_title}"
                                            </p>
                                          )}
                                          
                                          {/* Timestamp */}
                                          <p className="text-xs mt-1.5 text-gray-400">
                                            {formatDate(notification.created_at)}
                                          </p>
                                        </div>
                                        
                                        {/* Unread indicator */}
                                        {isUnread && (
                                          <div className="flex-shrink-0 mt-1">
                                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>

                {/* Profile / Logout */}
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="flex items-center gap-2 lg:gap-3 px-3 lg:px-4 py-2 lg:py-3 bg-gray-50 rounded-xl lg:rounded-2xl hover:bg-gray-100 transition-all duration-300 border border-gray-200 shadow-lg hover:shadow-xl group"
                  >
                    {profilePicture ? (
                      <img
                        src={profilePicture}
                        alt={user.name}
                        className="w-7 h-7 lg:w-8 lg:h-8 rounded-full object-cover border-2 border-white shadow-md"
                      />
                    ) : (
                      <div className="w-7 h-7 lg:w-8 lg:h-8 bg-gradient-to-r from-[#11CCEF] to-[#E51791] rounded-full flex items-center justify-center text-white font-semibold text-xs lg:text-sm">
                        {userInitial}
                      </div>
                    )}
                    <span className="font-semibold text-gray-800 text-sm lg:text-base hidden lg:inline">{user.name}</span>
                    <svg 
                      className={`w-4 h-4 text-gray-500 transition-transform duration-300 ${menuOpen ? 'rotate-180' : ''}`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {menuOpen && (
                    <div className="absolute right-0 mt-2 lg:mt-3 w-48 lg:w-56 bg-white/95 backdrop-blur-xl rounded-xl lg:rounded-2xl border border-gray-200 shadow-2xl py-2 lg:py-3 z-50 animate-in fade-in slide-in-from-top-5 duration-300">
                      <div className="px-3 lg:px-4 py-2 lg:py-3 border-b border-gray-100">
                        <div className="font-semibold text-gray-800 text-sm lg:text-base">{user.name}</div>
                        <div className="text-xs lg:text-sm text-gray-500 capitalize">{user.role?.toLowerCase()}</div>
                      </div>
                      
                      <Link
                        href={getDashboardLink()}
                        className="block px-3 lg:px-4 py-2 lg:py-3 text-gray-700 hover:bg-gray-50 transition-colors duration-200 font-medium text-sm lg:text-base"
                        onClick={() => setMenuOpen(false)}
                      >
                        Dashboard
                      </Link>
                      
                      {['Admin', 'Operation Manager', 'Accounts Manager', 'Administrative Manager', 'Admission Manager', 'Assessor', 'Team Member', 'Manager', 'Moderator'].includes(user.role!) && (
                        <Link
                          href="/dashboard/tickets"
                          className="block px-3 lg:px-4 py-2 lg:py-3 text-gray-700 hover:bg-gray-50 transition-colors duration-200 font-medium text-sm lg:text-base"
                          onClick={() => setMenuOpen(false)}
                        >
                          Support Tickets
                        </Link>
                      )}
                      {['Student', 'ManagerStudent', 'InstituteStudent'].includes(user.role!) && (
                        <Link
                          href="/dashboard/tickets"
                          className="block px-3 lg:px-4 py-2 lg:py-3 text-gray-700 hover:bg-gray-50 transition-colors duration-200 font-medium text-sm lg:text-base"
                          onClick={() => setMenuOpen(false)}
                        >
                          Support
                        </Link>
                      )}
                      
                      {['Student', 'ManagerStudent', 'InstituteStudent'].includes(user.role!) ? (
                        <Link
                          href="/dashboard/student/profile"
                          className="block px-3 lg:px-4 py-2 lg:py-3 text-gray-700 hover:bg-gray-50 transition-colors duration-200 font-medium text-sm lg:text-base"
                          onClick={() => setMenuOpen(false)}
                        >
                          My Profile
                        </Link>
                      ) : (
                        <Link
                          href="/profile"
                          className="block px-3 lg:px-4 py-2 lg:py-3 text-gray-700 hover:bg-gray-50 transition-colors duration-200 font-medium text-sm lg:text-base"
                          onClick={() => setMenuOpen(false)}
                        >
                          Profile Settings
                        </Link>
                      )}
                      
                      <button
                        onClick={() => {
                          handleLogout();
                          setMenuOpen(false);
                        }}
                        className="w-full text-left px-3 lg:px-4 py-2 lg:py-3 text-red-500 hover:bg-red-50 transition-colors duration-200 font-semibold border-t border-gray-100 text-sm lg:text-base"
                      >
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-2">
            {user && (
              profilePicture ? (
                <img
                  src={profilePicture}
                  alt={user.name}
                  className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-md"
                />
              ) : (
                <div className="w-8 h-8 bg-gradient-to-r from-[#11CCEF] to-[#E51791] rounded-full flex items-center justify-center text-white font-semibold text-sm">
                  {userInitial}
                </div>
              )
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Toggle menu"
            >
              <svg 
                className={`w-6 h-6 text-gray-700 transition-transform duration-300 ${mobileMenuOpen ? 'rotate-90' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 py-4 animate-in slide-in-from-top duration-300">
            <div className="space-y-3">
              {!user ? (
                <>
                  <Link
                    href="/"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block w-full px-4 py-3 bg-gradient-to-r from-[#11CCEF] to-[#12B7F3] text-white rounded-xl font-semibold text-center shadow-lg"
                  >
                    Login
                  </Link>
                </>
              ) : (
                <>
                  {/* User Info */}
                  <div className="px-4 py-3 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="font-semibold text-gray-800">{user.name}</div>
                    <div className="text-sm text-gray-500 capitalize">{user.role?.toLowerCase()}</div>
                  </div>

                  {/* Role-based Links */}
                  {user.role === 'Admin' && (
                    <Link
                      href="/dashboard/admin"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block w-full px-4 py-3 bg-gradient-to-r from-[#E51791] to-[#c4127a] text-white rounded-xl font-semibold text-center shadow-lg"
                    >
                      Admin Dashboard
                    </Link>
                  )}
                  {user.role === 'Assessor' && (
                    <Link
                      href="/dashboard/tutor"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block w-full px-4 py-3 bg-gradient-to-r from-[#E51791] to-[#c4127a] text-white rounded-xl font-semibold text-center shadow-lg"
                    >
                      Tutor Dashboard
                    </Link>
                  )}
                  {user.role === 'Team Member' && (
                    <Link
                      href="/dashboard/tickets"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block w-full px-4 py-3 bg-gradient-to-r from-[#E51791] to-[#c4127a] text-white rounded-xl font-semibold text-center shadow-lg"
                    >
                      Support Tickets
                    </Link>
                  )}
                  {['Student', 'ManagerStudent', 'InstituteStudent'].includes(user.role!) && (
                    <Link
                      href="/dashboard/student"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block w-full px-4 py-3 bg-gradient-to-r from-[#E51791] to-[#c4127a] text-white rounded-xl font-semibold text-center shadow-lg"
                    >
                      Dashboard
                    </Link>
                  )}
                  {user.role === 'Moderator' && (
                    <Link
                      href="/dashboard/moderator"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block w-full px-4 py-3 bg-gradient-to-r from-[#E51791] to-[#c4127a] text-white rounded-xl font-semibold text-center shadow-lg"
                    >
                      Dashboard
                    </Link>
                  )}
                  {user.role === 'Manager' && (
                    <Link
                      href="/dashboard"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block w-full px-4 py-3 bg-gradient-to-r from-[#E51791] to-[#c4127a] text-white rounded-xl font-semibold text-center shadow-lg"
                    >
                      Dashboard
                    </Link>
                  )}
                  {['Admin', 'Operation Manager', 'Accounts Manager', 'Administrative Manager', 'Admission Manager', 'Assessor', 'Team Member', 'Moderator'].includes(user.role!) && (
                    <Link
                      href="/dashboard/tickets"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block w-full px-4 py-3 text-[#11CCEF] hover:bg-[#11CCEF]/10 rounded-xl transition-colors duration-200 font-medium text-center border border-[#11CCEF]"
                    >
                      Support Tickets
                    </Link>
                  )}
                  {['Student', 'ManagerStudent', 'InstituteStudent'].includes(user.role!) && (
                    <Link
                      href="/dashboard/tickets"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block w-full px-4 py-3 text-[#11CCEF] hover:bg-[#11CCEF]/10 rounded-xl transition-colors duration-200 font-medium text-center border border-[#11CCEF]"
                    >
                      Support
                    </Link>
                  )}

                  {/* Profile Link */}
                  {['Student', 'ManagerStudent', 'InstituteStudent'].includes(user.role!) ? (
                    <Link
                      href="/dashboard/student/profile"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block w-full px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-xl transition-colors duration-200 font-medium text-center border border-gray-200"
                    >
                      My Profile
                    </Link>
                  ) : (
                    <Link
                      href="/profile"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block w-full px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-xl transition-colors duration-200 font-medium text-center border border-gray-200"
                    >
                      Profile Settings
                    </Link>
                  )}

                  {/* Logout Button */}
                  <button
                    onClick={() => {
                      handleLogout();
                      setMobileMenuOpen(false);
                    }}
                    className="block w-full px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors duration-200 font-semibold border border-red-200"
                  >
                    Logout
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;