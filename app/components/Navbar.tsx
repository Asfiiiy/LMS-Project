'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { apiService } from '@/app/services/api';
import { io, Socket } from 'socket.io-client';
import { FiBell, FiMessageSquare, FiHeart } from 'react-icons/fi';

interface User {
  id?: number;
  name: string;
  role: 'Admin' | 'Tutor' | 'Manager' | 'Student' | 'ManagerStudent' | 'InstituteStudent' | 'Moderator' | null;
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
  const [socket, setSocket] = useState<Socket | null>(null);

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
    } catch (error) {
      console.error('Error parsing user data:', error);
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
    } catch (error) {
      console.error('Error parsing user data:', error);
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
      } catch (error) {
        console.error('Error parsing user data:', error);
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

      // Only fetch for student roles
      if (['Student', 'ManagerStudent', 'InstituteStudent'].includes(user.role || '')) {
        try {
          const response = await apiService.getStudentProfile();
          if (response?.success && response.profile?.profile_picture) {
            setProfilePicture(response.profile.profile_picture);
          } else {
            setProfilePicture(null);
          }
        } catch (err) {
          console.error('Error fetching profile picture:', err);
          setProfilePicture(null);
        }
      } else {
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

  // Initialize socket and fetch notifications
  useEffect(() => {
    if (user?.id) {
      const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';
      const newSocket = io(socketUrl, {
        transports: ['websocket', 'polling']
      });
      
      newSocket.on('connect', () => {
        newSocket.emit('join_notifications', { userId: user.id });
      });
      
      newSocket.on('new_notification', (notification: Notification) => {
        setNotifications(prev => [notification, ...prev]);
        setUnreadCount(prev => prev + 1);
      });
      
      newSocket.on('notification_count_update', (data: { count: number }) => {
        setUnreadCount(data.count);
      });
      
      setSocket(newSocket);
      fetchNotifications();
      fetchUnreadCount();
      
      return () => {
        newSocket.disconnect();
      };
    }
  }, [user?.id]);

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
      const res = await apiService.getNotifications(50, 0);
      if (res?.success) {
        setNotifications(res.notifications || []);
        setUnreadCount(res.unreadCount || 0);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoadingNotifications(false);
    }
  };

  const fetchUnreadCount = async () => {
    if (!user?.id) return;
    try {
      const res = await apiService.getUnreadNotificationCount();
      if (res?.success) {
        setUnreadCount(res.count || 0);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const handleMarkNotificationRead = async (notificationId: number) => {
    try {
      const res = await apiService.markNotificationAsRead(notificationId);
      if (res?.success) {
        setNotifications(prev => 
          prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await apiService.markAllNotificationsAsRead();
      if (res?.success) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await handleMarkNotificationRead(notification.id);
    }
    setShowNotifications(false);
    
    if (notification.related_post_id) {
      // Navigate to forum with postId and commentId in URL
      const url = `/dashboard/forum?postId=${notification.related_post_id}${notification.related_comment_id ? `&commentId=${notification.related_comment_id}` : ''}`;
      router.push(url);
    }
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
    if (user?.role === 'Tutor') return '/dashboard/tutor';
    if (user?.role === 'Moderator') return '/dashboard/moderator';
    if (['Student', 'ManagerStudent', 'InstituteStudent'].includes(user?.role || '')) return '/dashboard/student';
    if (user?.role === 'Manager') return '/dashboard';
    return '/dashboard';
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
            <Link href="/" className="flex items-center group">
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
            <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-black bg-gradient-to-r from-[#11CCEF] to-[#E51791] bg-clip-text text-transparent animate-pulse sm:hidden">
              Inspire LMS
            </h1>
          </div>

          {/* Desktop Title (Center) */}
          <div className="hidden sm:flex flex-1 justify-center">
            <h1 className="text-xl md:text-2xl lg:text-3xl font-black bg-gradient-to-r from-[#11CCEF] to-[#E51791] bg-clip-text text-transparent animate-pulse">
              Inspire LMS
            </h1>
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
                <Link
                  href="/register"
                  className="px-4 lg:px-6 py-2 lg:py-3 border-2 border-[#11CCEF] text-[#11CCEF] rounded-xl lg:rounded-2xl font-semibold text-sm lg:text-base hover:bg-[#11CCEF] hover:text-white transition-all duration-300 shadow-lg hover:shadow-xl"
                >
                  Register
                </Link>
              </>
            ) : (
              <>
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
                          <div className="p-8 text-center text-gray-500">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                            <p className="mt-2">Loading...</p>
                          </div>
                        ) : (() => {
                          const filteredNotifications = notificationFilter === 'unread'
                            ? notifications.filter(n => !n.is_read)
                            : notifications;
                          
                          return filteredNotifications.length === 0 ? (
                            <div className="p-12 text-center text-gray-500">
                              <FiBell className="w-16 h-16 mx-auto mb-3 text-gray-300" />
                              <p className="font-medium">No {notificationFilter === 'unread' ? 'unread ' : ''}notifications</p>
                            </div>
                          ) : (
                            <div className="divide-y divide-gray-100">
                              {filteredNotifications.map((notification) => {
                                const getNotificationIcon = () => {
                                  switch (notification.type) {
                                    case 'post_comment':
                                    case 'post_reply':
                                    case 'reply':
                                      return <FiMessageSquare className="w-4 h-4" />;
                                    case 'post_like':
                                    case 'like':
                                      return <FiHeart className="w-4 h-4" />;
                                    default:
                                      return <FiBell className="w-4 h-4" />;
                                  }
                                };

                                const getIconColor = () => {
                                  switch (notification.type) {
                                    case 'post_comment':
                                    case 'post_reply':
                                    case 'reply':
                                      return 'bg-green-500';
                                    case 'post_like':
                                    case 'like':
                                      return 'bg-red-500';
                                    default:
                                      return 'bg-blue-500';
                                  }
                                };

                                const userInitial = notification.related_user_name
                                  ? notification.related_user_name.charAt(0).toUpperCase()
                                  : '?';
                                const hasAvatar = notification.related_user_avatar && 
                                  notification.related_user_avatar !== 'null' && 
                                  notification.related_user_avatar.trim() !== '';

                                return (
                                  <div
                                    key={notification.id}
                                    onClick={() => handleNotificationClick(notification)}
                                    className={`p-3 hover:bg-gray-50 cursor-pointer transition-colors ${
                                      !notification.is_read ? 'bg-blue-50/50' : 'bg-white'
                                    }`}
                                  >
                                    <div className="flex items-start gap-3">
                                      <div className="relative flex-shrink-0">
                                        {hasAvatar && notification.related_user_avatar ? (
                                          <img
                                            src={notification.related_user_avatar}
                                            alt={notification.related_user_name || 'User'}
                                            className="w-12 h-12 rounded-full object-cover border border-gray-200"
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
                                        <div className={`absolute -bottom-1 -right-1 w-5 h-5 ${getIconColor()} rounded-full flex items-center justify-center text-white border-2 border-white`}>
                                          {getNotificationIcon()}
                                        </div>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm text-gray-900 leading-snug">
                                          {notification.related_user_name ? (
                                            <>
                                              <span className="font-semibold">
                                                {notification.related_user_name}
                                              </span>
                                              {' '}
                                              <span className="text-gray-600">
                                                {notification.message.replace(notification.related_user_name, '').trim()}
                                              </span>
                                            </>
                                          ) : (
                                            <span className="text-gray-600">{notification.message}</span>
                                          )}
                                        </p>
                                        {notification.post_title && (
                                          <p className="text-xs text-gray-500 mt-1 truncate">
                                            "{notification.post_title}"
                                          </p>
                                        )}
                                        <p className="text-xs text-gray-400 mt-1">
                                          {formatDate(notification.created_at)}
                                        </p>
                                      </div>
                                      {!notification.is_read && (
                                        <div className="flex-shrink-0 mt-2">
                                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                        </div>
                                      )}
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
                  <Link
                    href="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block w-full px-4 py-3 border-2 border-[#11CCEF] text-[#11CCEF] rounded-xl font-semibold text-center hover:bg-[#11CCEF] hover:text-white transition-all duration-300"
                  >
                    Register
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
                  {user.role === 'Tutor' && (
                    <Link
                      href="/dashboard/tutor"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block w-full px-4 py-3 bg-gradient-to-r from-[#E51791] to-[#c4127a] text-white rounded-xl font-semibold text-center shadow-lg"
                    >
                      Tutor Dashboard
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