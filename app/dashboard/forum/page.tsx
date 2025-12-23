'use client';

import React, { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { UserRole, User } from '@/app/components/types';
import { apiService } from '@/app/services/api';
import CommentsSection from '@/app/components/CommentsSection';
import { 
  FiMessageCircle, FiPlus, FiSearch, FiClock, 
  FiEye, FiHeart, FiMessageSquare, FiMapPin, FiLock, 
  FiTag, FiX, FiBell, FiMoreVertical, FiCheckCircle,
  FiStar, FiUsers, FiFlag
} from 'react-icons/fi';

interface Category {
  id: number;
  name: string;
  description: string;
  icon: string;
  color: string;
  posts_count: number;
}

interface Post {
  id: number;
  title: string;
  content: string;
  status: string;
  is_pinned: boolean;
  is_locked: boolean;
  comments_disabled: boolean;
  views_count: number;
  likes_count: number;
  comments_count: number;
  last_activity_at: string;
  created_at: string;
  author_id: number;
  author_name: string;
  author_avatar: string | null;
  author_role: string;
  category_id: number;
  category_name: string;
  category_color: string;
  category_icon: string;
  reactions?: Record<string, number>; // reaction_type -> count (backward compat)
  reaction_counts?: Record<string, number>; // reaction_type -> count (all 7 types with zeros)
  user_reaction?: Record<string, boolean> | null; // reaction_type -> true (backward compat)
  my_reaction?: string | null; // user's current reaction type (primary)
}

// Reaction configuration - Facebook style with emojis only
const REACTION_CONFIG = [
  { type: 'like', emoji: '👍', label: 'Like' },
  { type: 'insightful', emoji: '💡', label: 'Insightful' },
  { type: 'helpful', emoji: '❤️', label: 'Helpful' },
  { type: 'smart_thinking', emoji: '🧠', label: 'Smart Thinking' },
  { type: 'well_done', emoji: '👏', label: 'Well Done' },
  { type: 'curious', emoji: '❓', label: 'Curious' },
  { type: 'excellent', emoji: '🌟', label: 'Excellent' }
];

const ForumPageContent = () => {
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [user, setUser] = useState<User | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'most_commented'>('recent');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPost, setNewPost] = useState({ category_id: '', title: '', content: '' });
  const [submitting, setSubmitting] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });
  
  // Comments toggle state
  const [expandedPosts, setExpandedPosts] = useState<Set<number>>(new Set());
  
  // Post reactions state
  const [postReactions, setPostReactions] = useState<Record<number, string | null>>({}); // postId -> reaction_type or null
  const [reactionCounts, setReactionCounts] = useState<Record<number, Record<string, number>>>({}); // postId -> { reaction_type: count }
  const [showReactionPicker, setShowReactionPicker] = useState<number | null>(null);
  const [pickerTimeout, setPickerTimeout] = useState<NodeJS.Timeout | null>(null);
  
  // Moderator dropdown
  const [moderatorMenuOpen, setModeratorMenuOpen] = useState<number | null>(null);
  
  // Sidebar data
  const [forumStats, setForumStats] = useState({
    totalPosts: 0,
    totalComments: 0,
    totalUsers: 0,
    activeToday: 0
  });
  const [trendingPosts, setTrendingPosts] = useState<Post[]>([]);
  const [popularCategories, setPopularCategories] = useState<Category[]>([]);
  const [userStats, setUserStats] = useState({
    userPosts: 0,
    userComments: 0,
    userLikes: 0
  });
  const [loadingSidebar, setLoadingSidebar] = useState(true);
  
  const postRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const searchParams = useSearchParams();

  useEffect(() => {
    const userData: User | null = JSON.parse(localStorage.getItem('lms-user') || 'null');
    setUser(userData);
    setUserRole(userData?.role || null);
    fetchData();
  }, []);

  useEffect(() => {
    // Reset to page 1 when category, sort, or search changes
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [selectedCategory, sortBy, searchTerm]);

  useEffect(() => {
    fetchPosts();
  }, [selectedCategory, sortBy, searchTerm, pagination.page]);

  useEffect(() => {
    fetchSidebarData();
  }, [user?.id]);

  // Handle navigation from notifications
  useEffect(() => {
    const postIdParam = searchParams.get('postId');
    const commentIdParam = searchParams.get('commentId');
    
    if (postIdParam && posts.length > 0) {
      const postId = parseInt(postIdParam);
      const commentId = commentIdParam ? parseInt(commentIdParam) : null;
      
      // Check if post exists in current posts
      const postExists = posts.some(p => p.id === postId);
      
      if (postExists) {
        // Expand comments for this post
        setExpandedPosts(prev => new Set([...prev, postId]));
        
        // Scroll to post after a short delay to ensure DOM is ready
        setTimeout(() => {
          const postElement = postRefs.current[postId];
          if (postElement) {
            postElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Add highlight effect
            postElement.classList.add('ring-4', 'ring-blue-500', 'ring-offset-2', 'rounded-xl');
            setTimeout(() => {
              postElement.classList.remove('ring-4', 'ring-blue-500', 'ring-offset-2');
            }, 3000);
            
            // Scroll to specific comment if provided
            if (commentId) {
              setTimeout(() => {
                const commentElement = document.getElementById(`comment-${commentId}`);
                if (commentElement) {
                  commentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  commentElement.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2', 'rounded-lg', 'p-2', 'bg-blue-50');
                  setTimeout(() => {
                    commentElement.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2', 'p-2', 'bg-blue-50');
                  }, 3000);
                }
              }, 500);
            }
          }
        }, 300);
        
        // Clean up URL parameters
        if (window.history.replaceState) {
          const url = new URL(window.location.href);
          url.searchParams.delete('postId');
          url.searchParams.delete('commentId');
          window.history.replaceState({}, '', url);
        }
      } else {
        // Post not in current view, might need to fetch it or show a message
        // For now, just clear the params
        if (window.history.replaceState) {
          const url = new URL(window.location.href);
          url.searchParams.delete('postId');
          url.searchParams.delete('commentId');
          window.history.replaceState({}, '', url);
        }
      }
    }
  }, [searchParams, posts]);


  // Close notification dropdown when clicking outside

  const fetchData = async () => {
    try {
      setLoading(true);
      const [categoriesRes] = await Promise.all([
        apiService.getForumCategories()
      ]);

      if (categoriesRes?.success) {
        setCategories(categoriesRes.categories || []);
      }
    } catch (error) {
      console.error('Error fetching forum data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSidebarData = async () => {
    try {
      setLoadingSidebar(true);
      
      // Fetch trending posts (most liked/commented in last 7 days)
      const trendingRes = await apiService.getForumPosts({
        sort: 'popular',
        limit: 5
      });
      
      if (trendingRes?.success) {
        setTrendingPosts(trendingRes.posts || []);
      }

      // Calculate stats from posts
      const allPostsRes = await apiService.getForumPosts({ limit: 1000 });
      if (allPostsRes?.success) {
        const allPosts = allPostsRes.posts || [];
        const totalPosts = allPosts.length;
        const totalComments = allPosts.reduce((sum: number, post: Post) => sum + (post.comments_count || 0), 0);
        const totalLikes = allPosts.reduce((sum: number, post: Post) => sum + (post.likes_count || 0), 0);
        
        // Get unique authors
        const uniqueAuthors = new Set(allPosts.map((post: Post) => post.author_id));
        
        setForumStats({
          totalPosts,
          totalComments,
          totalUsers: uniqueAuthors.size,
          activeToday: allPosts.filter((post: Post) => {
            const postDate = new Date(post.created_at);
            const today = new Date();
            return postDate.toDateString() === today.toDateString();
          }).length
        });
      }

      // Get all categories (not filtered, show all)
      const categoriesRes = await apiService.getForumCategories();
      if (categoriesRes?.success) {
        const allCategories = (categoriesRes.categories || [])
          .sort((a: Category, b: Category) => (b.posts_count || 0) - (a.posts_count || 0));
        setPopularCategories(allCategories);
      }

      // Calculate user stats from all posts if logged in
      if (user?.id && allPostsRes?.success) {
        const allPosts = allPostsRes.posts || [];
        const userPosts = allPosts.filter((post: Post) => post.author_id === user.id);
        const userComments = userPosts.reduce((sum: number, post: Post) => sum + (post.comments_count || 0), 0);
        const userLikes = userPosts.reduce((sum: number, post: Post) => sum + (post.likes_count || 0), 0);
        
        setUserStats({
          userPosts: userPosts.length,
          userComments,
          userLikes
        });
      }
    } catch (error) {
      console.error('Error fetching sidebar data:', error);
    } finally {
      setLoadingSidebar(false);
    }
  };

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const res = await apiService.getForumPosts({
        category_id: selectedCategory || undefined,
        search: searchTerm || undefined,
        sort: sortBy,
        page: pagination.page,
        limit: pagination.limit
      });

      if (res?.success) {
        setPosts(res.posts || []);
        if (res.pagination) {
          setPagination(res.pagination);
        }
        
        // Initialize post reactions state from backend response
        const reactionsMap: Record<number, string | null> = {};
        const countsMap: Record<number, Record<string, number>> = {};
        
        res.posts?.forEach((post: Post) => {
          // Filter out any "00" values from post data
          if (post.author_role === '00' || post.author_role === '0' || String(post.author_role) === '00') {
            post.author_role = '';
          }
          
          // DEBUG: Log what we receive from backend
          console.log(`[Frontend fetchPosts] Post ${post.id}:`, {
            my_reaction: post.my_reaction,
            my_reaction_type: typeof post.my_reaction,
            has_my_reaction: 'my_reaction' in post,
            user_reaction: post.user_reaction,
            full_post_keys: Object.keys(post).filter(k => k.includes('reaction')),
            author_role: post.author_role,
            all_post_keys: Object.keys(post)
          });
          
          // PRIORITY 1: Use my_reaction directly (string or null) - this is the PRIMARY source
          // Backend ALWAYS returns my_reaction (either string or null)
          // Check if property exists first, then check value
          if ('my_reaction' in post) {
            // Backend returns my_reaction as string | null
            if (post.my_reaction !== null && typeof post.my_reaction === 'string' && post.my_reaction.trim() !== '') {
              reactionsMap[post.id] = post.my_reaction;
              console.log(`[Frontend fetchPosts] Post ${post.id}: Set reaction to "${post.my_reaction}"`);
            } else {
              reactionsMap[post.id] = null;
              console.log(`[Frontend fetchPosts] Post ${post.id}: Set reaction to null`);
            }
          } 
          // PRIORITY 2: Fallback to extracting from user_reaction object (backward compatibility)
          else if (post.user_reaction && typeof post.user_reaction === 'object' && post.user_reaction !== null) {
            const reactionKeys = Object.keys(post.user_reaction);
            if (reactionKeys.length > 0 && post.user_reaction[reactionKeys[0]] === true) {
              reactionsMap[post.id] = reactionKeys[0];
            } else {
              reactionsMap[post.id] = null;
            }
          } 
          // PRIORITY 3: No reaction found
          else {
            reactionsMap[post.id] = null;
          }
          
          // Store reaction counts - PRIORITY: reaction_counts > reactions > default
          if (post.reaction_counts && typeof post.reaction_counts === 'object') {
            // Ensure all 7 types are present (defensive)
            countsMap[post.id] = {
              like: post.reaction_counts.like ?? 0,
              insightful: post.reaction_counts.insightful ?? 0,
              helpful: post.reaction_counts.helpful ?? 0,
              smart_thinking: post.reaction_counts.smart_thinking ?? 0,
              well_done: post.reaction_counts.well_done ?? 0,
              curious: post.reaction_counts.curious ?? 0,
              excellent: post.reaction_counts.excellent ?? 0
            };
          } else if (post.reactions && typeof post.reactions === 'object') {
            // Fallback: ensure all 7 types are present
            countsMap[post.id] = {
              like: post.reactions.like ?? 0,
              insightful: post.reactions.insightful ?? 0,
              helpful: post.reactions.helpful ?? 0,
              smart_thinking: post.reactions.smart_thinking ?? 0,
              well_done: post.reactions.well_done ?? 0,
              curious: post.reactions.curious ?? 0,
              excellent: post.reactions.excellent ?? 0
            };
          } else {
            // Default: all zeros (should never happen if backend is correct)
            countsMap[post.id] = {
              like: 0,
              insightful: 0,
              helpful: 0,
              smart_thinking: 0,
              well_done: 0,
              curious: 0,
              excellent: 0
            };
          }
        });
        
        setPostReactions(reactionsMap);
        setReactionCounts(countsMap);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };


  const handleCreatePost = async () => {
    if (!newPost.title.trim() || !newPost.content.trim()) {
      alert('Please fill in both title and content');
      return;
    }

    try {
      setSubmitting(true);
      const res = await apiService.createForumPost({
        category_id: newPost.category_id ? parseInt(newPost.category_id) : undefined,
        title: newPost.title,
        content: newPost.content
      });

      if (res?.success) {
        setShowCreateModal(false);
        setNewPost({ category_id: '', title: '', content: '' });
        fetchPosts();
      } else {
        alert(res?.message || 'Failed to create post');
      }
    } catch (error: any) {
      console.error('Error creating post:', error);
      alert(error?.message || 'Failed to create post');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleComments = (postId: number) => {
    setExpandedPosts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
  };

  const handleReactPost = async (postId: number, reactionType: string) => {
    if (!user?.id) return;
    
    // Optimistic update
    const currentReaction = postReactions[postId];
    const isSameReaction = currentReaction === reactionType;
    
    // Optimistically update state
    setPostReactions(prev => ({
      ...prev,
      [postId]: isSameReaction ? null : reactionType
    }));
    
    // Optimistically update counts
    setReactionCounts(prev => {
      const currentCounts = prev[postId] || {};
      const newCounts = { ...currentCounts };
      
      if (isSameReaction) {
        // Removing reaction - decrease count
        if (newCounts[reactionType] > 0) {
          newCounts[reactionType] = Math.max(0, newCounts[reactionType] - 1);
        }
      } else {
        // Adding/switching reaction
        if (currentReaction && newCounts[currentReaction] > 0) {
          newCounts[currentReaction] = Math.max(0, newCounts[currentReaction] - 1);
        }
        newCounts[reactionType] = (newCounts[reactionType] || 0) + 1;
      }
      
      return {
        ...prev,
        [postId]: newCounts
      };
    });
    
    try {
      const res = await apiService.reactForumPost(postId, reactionType);
      if (res?.success) {
        // Update with actual API response - handle null explicitly
        // Backend returns my_reaction as string | null (never undefined)
        const myReaction = res.my_reaction !== undefined ? res.my_reaction : null;
        
        setPostReactions(prev => ({
          ...prev,
          [postId]: myReaction
        }));
        
        // Ensure all 7 reaction types are present
        const defaultCounts = {
          like: 0,
          insightful: 0,
          helpful: 0,
          smart_thinking: 0,
          well_done: 0,
          curious: 0,
          excellent: 0
        };
        const updatedCounts = res.counts ? { ...defaultCounts, ...res.counts } : defaultCounts;
        
        setReactionCounts(prev => ({
          ...prev,
          [postId]: updatedCounts
        }));
        
        // Update post object - CRITICAL: must set my_reaction for refresh persistence
        setPosts(prevPosts => 
          prevPosts.map(post => 
            post.id === postId 
              ? {
                  ...post,
                  my_reaction: myReaction, // Explicitly set (string | null) - required for refresh
                  reaction_counts: updatedCounts, // All 7 types
                  reactions: updatedCounts, // Backward compat
                  user_reaction: myReaction ? { [myReaction]: true } : null // Backward compat
                }
              : post
          )
        );
        
        // Close picker
        setShowReactionPicker(null);
      }
    } catch (error) {
      console.error('Error reacting to post:', error);
      // Revert optimistic update on error
      fetchPosts();
    }
  };

  const handleModeratorAction = async (postId: number, action: string) => {
    try {
      let res;
      switch (action) {
        case 'pin':
          res = await apiService.pinForumPost(postId, true);
          break;
        case 'unpin':
          res = await apiService.pinForumPost(postId, false);
          break;
        case 'lock':
          res = await apiService.lockForumPost(postId, true);
          break;
        case 'unlock':
          res = await apiService.lockForumPost(postId, false);
          break;
        case 'disable_comments':
          res = await apiService.toggleForumComments(postId, true);
          break;
        case 'enable_comments':
          res = await apiService.toggleForumComments(postId, false);
          break;
        case 'delete':
          if (confirm('Are you sure you want to delete this post?')) {
            res = await apiService.deleteForumPost(postId);
          } else {
            return;
          }
          break;
        default:
          return;
      }
      
      if (res?.success) {
        setModeratorMenuOpen(null);
        fetchPosts();
      } else {
        alert(res?.message || 'Failed to perform action');
      }
    } catch (error: any) {
      console.error('Error performing moderator action:', error);
      alert(error?.message || 'Failed to perform action');
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
    return date.toLocaleDateString();
  };

  const canPost = ['Student', 'Moderator', 'Admin', 'Tutor', 'ManagerStudent', 'InstituteStudent'].includes(userRole || '');
  const canModerate = ['Admin', 'Moderator'].includes(userRole || '');

  // Post skeleton loader
  const PostSkeleton = () => (
    <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-4">
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gray-300 animate-pulse flex-shrink-0"></div>
        <div className="flex-1 min-w-0">
          <div className="h-4 sm:h-5 bg-gray-300 rounded w-3/4 mb-2 sm:mb-3 animate-pulse"></div>
          <div className="h-3 sm:h-4 bg-gray-300 rounded w-1/2 mb-2 animate-pulse"></div>
          <div className="h-3 sm:h-4 bg-gray-300 rounded w-full mb-2 animate-pulse"></div>
          <div className="h-3 sm:h-4 bg-gray-300 rounded w-2/3 animate-pulse"></div>
        </div>
      </div>
    </div>
  );

  return (
    <ProtectedRoute allowedRoles={['Student', 'Moderator', 'Admin', 'Tutor', 'ManagerStudent', 'InstituteStudent']} userRole={userRole}>
      <div className="min-h-screen bg-gray-100 overflow-x-hidden w-full">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 w-full">
          <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 w-full">
            {/* Sidebar - Left Side */}
            <aside className="w-full lg:w-80 flex-shrink-0 space-y-4 sm:space-y-6 order-2 lg:order-1 min-w-0">
              {/* Quick Actions - Desktop Only (Sidebar) */}
              {canPost && (
                <div className="hidden lg:block bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl shadow-sm border border-green-200 p-4 sm:p-5">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
                    <FiPlus className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
                    <span className="hidden sm:inline">Quick Actions</span>
                    <span className="sm:hidden">Actions</span>
                  </h3>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-sm sm:text-base font-semibold rounded-lg hover:shadow-lg transition-all transform hover:scale-105 flex items-center justify-center gap-2"
                  >
                    <FiPlus className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="hidden sm:inline">Create New Post</span>
                    <span className="sm:hidden">New Post</span>
                  </button>
                </div>
              )}

              {/* Popular Categories */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5">
                <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
                  <FiTag className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500" />
                  <span className="hidden sm:inline">Popular Categories</span>
                  <span className="sm:hidden">Categories</span>
                </h3>
                <div className="space-y-2">
                  {/* All Posts - First Option */}
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className={`w-full flex items-center justify-between p-2.5 sm:p-3 rounded-lg transition-all ${
                      selectedCategory === null
                        ? 'bg-blue-50 border-2 border-blue-500'
                        : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <span className="text-xs sm:text-sm font-medium text-gray-700">
                      All Posts
                    </span>
                    <span className="text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 bg-gray-200 text-gray-600 rounded-full font-medium">
                      {forumStats.totalPosts}
                    </span>
                  </button>
                  
                  {/* All Categories */}
                  {popularCategories.map((category) => {
                    // Remove icons from category name (message-circle, book-open, bell, users, tool)
                    let cleanName = category.name || '';
                    cleanName = cleanName.replace(/message-circle/gi, '').trim();
                    cleanName = cleanName.replace(/book-open/gi, '').trim();
                    cleanName = cleanName.replace(/bell/gi, '').trim();
                    cleanName = cleanName.replace(/users/gi, '').trim();
                    cleanName = cleanName.replace(/tool/gi, '').trim();
                    cleanName = cleanName.replace(/\s+/g, ' ').trim(); // Clean up extra spaces
                    
                    return (
                      <button
                        key={category.id}
                        onClick={() => setSelectedCategory(category.id)}
                        className={`w-full flex items-center justify-between p-2.5 sm:p-3 rounded-lg transition-all ${
                          selectedCategory === category.id
                            ? 'bg-blue-50 border-2 border-blue-500'
                            : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        <span className="text-xs sm:text-sm font-medium text-gray-700 truncate pr-2">
                          {cleanName || category.name}
                        </span>
                        <span className="text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 bg-gray-200 text-gray-600 rounded-full font-medium flex-shrink-0">
                          {category.posts_count || 0}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Trending Now - Only 3 Posts */}
              {trendingPosts.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
                    <FiStar className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
                    <span className="hidden sm:inline">Trending Now</span>
                    <span className="sm:hidden">Trending</span>
                  </h3>
                  <div className="space-y-3">
                    {trendingPosts.slice(0, 3).map((post, index) => (
                      <div
                        key={post.id}
                        onClick={() => {
                          const postElement = postRefs.current[post.id];
                          if (postElement) {
                            postElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            setExpandedPosts(prev => new Set([...prev, post.id]));
                          }
                        }}
                        className="p-2.5 sm:p-3 bg-gray-50 rounded-lg hover:bg-blue-50 cursor-pointer transition-colors border border-transparent hover:border-blue-200"
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-r from-orange-400 to-red-500 flex items-center justify-center text-white text-xs font-bold">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs sm:text-sm font-semibold text-gray-900 line-clamp-2 mb-1">
                              {post.title}
                            </h4>
                            <div className="flex items-center gap-2 sm:gap-3 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <FiHeart className="w-3 h-3" />
                                {post.likes_count}
                              </span>
                              <span className="flex items-center gap-1">
                                <FiMessageSquare className="w-3 h-3" />
                                {post.comments_count}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tips - Last */}
              <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl shadow-sm border border-yellow-200 p-4 sm:p-5">
                <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-2 sm:mb-3 flex items-center gap-2">
                  <FiStar className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500" />
                  Tips
                </h3>
                <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-500 mt-0.5">•</span>
                    <span>Use clear titles to help others find your posts</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-500 mt-0.5">•</span>
                    <span>Be respectful and constructive in discussions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-500 mt-0.5">•</span>
                    <span>Search before posting to avoid duplicates</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-500 mt-0.5">•</span>
                    <span>Engage with others by liking and commenting</span>
                  </li>
                </ul>
              </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 lg:max-w-3xl order-1 lg:order-2 min-w-0 w-full">
          {/* Quick Actions - Mobile Only (Top) */}
          {canPost && (
            <div className="lg:hidden bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl shadow-sm border border-green-200 p-4 mb-4">
              <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                <FiPlus className="w-4 h-4 text-green-500" />
                <span>Quick Actions</span>
              </h3>
              <button
                onClick={() => setShowCreateModal(true)}
                className="w-full px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-sm font-semibold rounded-lg hover:shadow-lg transition-all transform hover:scale-105 flex items-center justify-center gap-2"
              >
                <FiPlus className="w-4 h-4" />
                <span>Create New Post</span>
              </button>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 md:p-5 mb-3 sm:mb-4 w-full overflow-hidden">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full">
              <div className="flex-1 relative min-w-0">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search posts..."
                  className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2.5 sm:py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <select
                className="w-full sm:w-auto px-3 sm:px-4 py-2.5 sm:py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white flex-shrink-0"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
              >
                <option value="recent">Most Recent</option>
                <option value="popular">Most Popular</option>
                <option value="most_commented">Most Commented</option>
              </select>
            </div>
          </div>

          {/* Posts List */}
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => <PostSkeleton key={i} />)}
            </div>
          ) : posts.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 sm:p-12 text-center">
              <FiMessageCircle className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-3 sm:mb-4" />
              <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No posts found</h3>
              <p className="text-sm sm:text-base text-gray-500">
                {canPost ? 'Be the first to start a discussion!' : 'No posts available yet.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => {
                const isExpanded = expandedPosts.has(post.id);
                // Get user reaction with correct priority:
                // 1. postReactions state (optimistic updates - immediate UI changes)
                // 2. post.my_reaction (backend persistent data - survives refresh)
                // 3. post.user_reaction (backward compatibility - old format)
                // NEVER default to "like" - only use actual stored reaction
                let userReaction: string | null = null;
                
                // PRIORITY 1: Check if state has been initialized for this post (optimistic updates)
                if (postReactions.hasOwnProperty(post.id)) {
                  // State is initialized - use it (could be string or null)
                  // This handles immediate UI updates after user clicks a reaction
                  userReaction = postReactions[post.id];
                  console.log(`[Frontend Render] Post ${post.id}: Using state reaction: "${userReaction}"`);
                } 
                // PRIORITY 2: Use post.my_reaction from backend (persists after refresh)
                else if ('my_reaction' in post) {
                  // Backend always returns my_reaction as string | null
                  if (post.my_reaction !== null && typeof post.my_reaction === 'string' && post.my_reaction.trim() !== '') {
                    userReaction = post.my_reaction;
                    console.log(`[Frontend Render] Post ${post.id}: Using post.my_reaction: "${userReaction}"`);
                  } else {
                    userReaction = null;
                    console.log(`[Frontend Render] Post ${post.id}: post.my_reaction is null or invalid`);
                  }
                } 
                // PRIORITY 3: Fallback to user_reaction object (backward compatibility)
                else if (post.user_reaction && typeof post.user_reaction === 'object' && post.user_reaction !== null) {
                  const reactionKeys = Object.keys(post.user_reaction);
                  if (reactionKeys.length > 0 && post.user_reaction[reactionKeys[0]] === true) {
                    userReaction = reactionKeys[0];
                  } else {
                    userReaction = null;
                  }
                } 
                // PRIORITY 4: No reaction found
                else {
                  userReaction = null;
                }
                
                // Get reaction counts from state (optimistic) or post data (from backend)
                // Prefer reaction_counts (all 7 types) over reactions
                const reactions = reactionCounts[post.id] || post.reaction_counts || post.reactions || {
                  like: 0,
                  insightful: 0,
                  helpful: 0,
                  smart_thinking: 0,
                  well_done: 0,
                  curious: 0,
                  excellent: 0
                };
                
                return (
                  <div
                    key={post.id}
                    id={`post-${post.id}`}
                    ref={(el) => {
                      postRefs.current[post.id] = el;
                    }}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 md:p-5 hover:shadow-md transition-shadow w-full overflow-hidden"
                  >
                    {/* Post Header */}
                    <div className="flex items-start gap-2 sm:gap-3 mb-2 sm:mb-3">
                      {post.author_avatar && post.author_avatar !== 'null' && post.author_avatar.trim() !== '' ? (
                        <img
                          src={post.author_avatar}
                          alt={post.author_name}
                          className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover flex-shrink-0 border border-gray-200"
                          onError={(e) => {
                            // Fallback to initial if image fails to load
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              const fallback = document.createElement('div');
                              fallback.className = 'w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white text-sm sm:text-base font-bold flex-shrink-0';
                              fallback.style.backgroundColor = post.category_color || '#3B82F6';
                              fallback.textContent = post.author_name.charAt(0);
                              parent.appendChild(fallback);
                            }
                          }}
                        />
                      ) : (
                        <div
                          className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white text-sm sm:text-base font-bold flex-shrink-0"
                          style={{ backgroundColor: post.category_color || '#3B82F6' }}
                        >
                          {post.author_name.charAt(0)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                          <span className="font-semibold text-sm sm:text-base md:text-lg text-gray-900 truncate">{post.author_name}</span>
                          {post.author_role && post.author_role.trim() !== '' && post.author_role !== '00' && post.author_role !== '0' && !post.author_name.toLowerCase().includes(post.author_role.toLowerCase()) && (
                            <span className="text-xs px-1.5 sm:px-2 py-0.5 bg-gray-100 rounded text-gray-600 whitespace-nowrap">
                              {post.author_role}
                            </span>
                          )}
                          {post.is_pinned && (
                            <FiMapPin className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 flex-shrink-0" />
                          )}
                          {post.is_locked && (
                            <FiLock className="w-4 h-4 sm:w-5 sm:h-5 text-red-500 flex-shrink-0" />
                          )}
                          <span className="text-xs sm:text-sm text-gray-500 ml-auto sm:ml-0 whitespace-nowrap">
                            {formatDate(post.created_at)}
                          </span>
                          {canModerate && (
                            <div className="relative ml-auto sm:ml-0">
                              <button
                                onClick={() => setModeratorMenuOpen(
                                  moderatorMenuOpen === post.id ? null : post.id
                                )}
                                className="p-1.5 sm:p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
                                aria-label="Moderator actions"
                              >
                                <FiMoreVertical className="w-5 h-5 sm:w-4 sm:h-4" />
                              </button>
                              {moderatorMenuOpen === post.id && (
                                <div className="absolute right-0 sm:right-auto sm:left-0 mt-1 w-44 sm:w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-w-[calc(100vw-2rem)]">
                                  <button
                                    onClick={() => handleModeratorAction(post.id, post.is_pinned ? 'unpin' : 'pin')}
                                    className="w-full text-left px-4 py-2.5 sm:py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                  >
                                    {post.is_pinned ? 'Unpin Post' : 'Pin Post'}
                                  </button>
                                  <button
                                    onClick={() => handleModeratorAction(post.id, post.is_locked ? 'unlock' : 'lock')}
                                    className="w-full text-left px-4 py-2.5 sm:py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                  >
                                    {post.is_locked ? 'Unlock Post' : 'Lock Post'}
                                  </button>
                                  <button
                                    onClick={() => handleModeratorAction(post.id, post.comments_disabled ? 'enable_comments' : 'disable_comments')}
                                    className="w-full text-left px-4 py-2.5 sm:py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                  >
                                    {post.comments_disabled ? 'Turn On Comments' : 'Turn Off Comments'}
                                  </button>
                                  <button
                                    onClick={() => handleModeratorAction(post.id, 'delete')}
                                    className="w-full text-left px-4 py-2.5 sm:py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                  >
                                    Delete Post
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <h3 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900 mb-2 sm:mb-3 leading-tight break-words">{post.title}</h3>
                        <p className="text-sm sm:text-base text-gray-700 whitespace-pre-wrap mb-3 sm:mb-4 leading-relaxed break-words overflow-wrap-anywhere">{post.content}</p>
                      </div>
                    </div>

                    {/* Post Actions */}
                    <div className="pt-3 sm:pt-4 border-t border-gray-200">
                      <div className="flex flex-wrap items-center gap-3 sm:gap-4 md:gap-6">
                        {/* Reactions */}
                        <div className="relative flex items-center gap-2">
                        <button
                          onMouseEnter={() => {
                            // Clear any pending timeout
                            if (pickerTimeout) {
                              clearTimeout(pickerTimeout);
                              setPickerTimeout(null);
                            }
                            // Show picker on hover (like Facebook)
                            setShowReactionPicker(post.id);
                          }}
                          onMouseLeave={() => {
                            // Delay hiding picker to allow moving to it
                            const timeout = setTimeout(() => {
                              setShowReactionPicker(prev => prev === post.id ? null : prev);
                            }, 300);
                            setPickerTimeout(timeout);
                          }}
                          onClick={() => {
                            // Quick click: toggle like if no reaction, or remove if has reaction
                            if (userReaction) {
                              // Remove reaction
                              handleReactPost(post.id, userReaction);
                            } else {
                              // Add like reaction
                              handleReactPost(post.id, 'like');
                            }
                            // Close picker after click
                            setShowReactionPicker(null);
                          }}
                          className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-full transition-colors touch-manipulation ${
                            userReaction 
                              ? 'bg-blue-50 text-blue-600' 
                              : 'text-gray-500 hover:bg-gray-100 active:bg-gray-200'
                          }`}
                        >
                          {(() => {
                            // If user has a reaction, show that reaction's emoji and label
                            // Otherwise, show default "Like" button (not selected)
                            if (userReaction) {
                              const reactionConfig = REACTION_CONFIG.find(r => r.type === userReaction);
                              if (reactionConfig) {
                                return (
                                  <>
                                    <span className="text-lg sm:text-xl">{reactionConfig.emoji}</span>
                                    <span className="text-xs sm:text-sm font-medium hidden sm:inline">{reactionConfig.label}</span>
                                  </>
                                );
                              }
                            }
                            // Default: show "Like" button (not selected state)
                            return (
                              <>
                                <span className="text-lg sm:text-xl">👍</span>
                                <span className="text-xs sm:text-sm font-medium hidden sm:inline">Like</span>
                              </>
                            );
                          })()}
                        </button>
                        
                        {/* Reaction Picker - Shows on hover */}
                        {showReactionPicker === post.id && (
                          <div
                            className="absolute bottom-full left-0 mb-1 sm:mb-0.5 bg-white rounded-full shadow-lg border border-gray-200 p-1.5 sm:p-2 flex items-center gap-0.5 sm:gap-1 z-50 max-w-[calc(100vw-2rem)] overflow-x-auto"
                            onMouseEnter={() => {
                              // Clear any pending timeout when entering picker
                              if (pickerTimeout) {
                                clearTimeout(pickerTimeout);
                                setPickerTimeout(null);
                              }
                              // Keep picker open
                              setShowReactionPicker(post.id);
                            }}
                            onMouseLeave={() => {
                              // Delay hiding picker when leaving
                              const timeout = setTimeout(() => {
                                setShowReactionPicker(prev => prev === post.id ? null : prev);
                              }, 300);
                              setPickerTimeout(timeout);
                            }}
                          >
                            {REACTION_CONFIG.map((reaction) => (
                              <button
                                key={reaction.type}
                                onClick={() => {
                                  handleReactPost(post.id, reaction.type);
                                  // Close picker after selection
                                  setShowReactionPicker(null);
                                }}
                                onMouseEnter={() => {
                                  // Clear timeout when hovering over reactions
                                  if (pickerTimeout) {
                                    clearTimeout(pickerTimeout);
                                    setPickerTimeout(null);
                                  }
                                  // Keep picker open
                                  setShowReactionPicker(post.id);
                                }}
                                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xl sm:text-2xl hover:scale-125 active:scale-110 transition-transform touch-manipulation ${
                                  userReaction === reaction.type 
                                    ? 'bg-blue-100 ring-2 ring-blue-500' 
                                    : 'hover:bg-gray-100 active:bg-gray-200'
                                }`}
                                title={reaction.label}
                                aria-label={reaction.label}
                              >
                                <span>{reaction.emoji}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        </div>
                        
                        <button
                          onClick={() => toggleComments(post.id)}
                          className="flex items-center gap-1.5 sm:gap-2 text-gray-500 hover:text-blue-500 active:text-blue-600 transition-colors touch-manipulation"
                        >
                          <FiMessageSquare className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                          <span className="text-xs sm:text-sm font-medium">{post.comments_count ?? 0}</span>
                          <span className="text-xs sm:text-sm ml-0.5 sm:ml-1 hidden sm:inline">
                            {isExpanded ? 'Hide' : 'Comments'}
                          </span>
                        </button>
                        {(post.views_count > 0) && (
                          <div className="flex items-center gap-1.5 sm:gap-2 text-gray-500 text-xs sm:text-sm">
                            <FiEye className="w-4 h-4 flex-shrink-0" />
                            <span>{post.views_count}</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Reaction Counts Bar - Facebook Style */}
                      {(() => {
                        // Filter reactions with count > 0 and order by REACTION_CONFIG
                        const activeReactions = REACTION_CONFIG
                          .map(config => ({
                            ...config,
                            count: reactions[config.type] || 0
                          }))
                          .filter(r => r.count > 0);
                        
                        if (activeReactions.length === 0) return null;
                        
                        // Calculate total reactions
                        const totalReactions = Object.values(reactions).reduce((sum: number, count: number) => sum + count, 0);
                        const hasMyReaction = userReaction !== null;
                        const otherReactions = totalReactions - (hasMyReaction ? 1 : 0);
                        
                        return (
                          <div className="mt-2 sm:mt-3">
                            {/* "You and X others" or "X reactions" */}
                            <div className="text-xs sm:text-sm text-gray-600 mb-1.5 sm:mb-2">
                              {hasMyReaction ? (
                                otherReactions > 0 ? (
                                  <span>You and {otherReactions} {otherReactions === 1 ? 'other' : 'others'}</span>
                                ) : (
                                  <span>You</span>
                                )
                              ) : (
                                <span>{totalReactions} {totalReactions === 1 ? 'reaction' : 'reactions'}</span>
                              )}
                            </div>
                            
                            {/* Reaction emojis with counts - wrap on mobile */}
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full">
                              {activeReactions.map((reaction) => (
                                <div
                                  key={reaction.type}
                                  className="flex items-center gap-1"
                                  title={`${reaction.count} ${reaction.label}`}
                                >
                                  <span className={`text-base sm:text-lg ${userReaction === reaction.type ? 'text-blue-500' : 'text-gray-700'}`}>
                                    {reaction.emoji}
                                  </span>
                                  <span className="text-xs font-medium text-gray-600">
                                    {reaction.count}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Inline Comments Section */}
                    {isExpanded && (
                      <CommentsSection
                        postId={post.id}
                        userId={user?.id || null}
                        userRole={userRole}
                        commentsDisabled={post.comments_disabled || false}
                        isLocked={post.is_locked || false}
                        onCommentAdded={() => {
                          fetchPosts();
                        }}
                        user={user ? { 
                          id: user.id || 0, 
                          name: user.name || '', 
                          avatar: (user as any).avatar || (user as any).profile_picture || null 
                        } : null}
                      />
                    )}
                  </div>
                );
              })}

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="flex flex-col items-center gap-3 sm:gap-4 mt-6 sm:mt-8">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-center">
                    <button
                      onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                      disabled={pagination.page === 1}
                      className="px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 active:bg-gray-100 transition-colors font-medium touch-manipulation"
                    >
                      <span className="hidden sm:inline">Previous</span>
                      <span className="sm:hidden">Prev</span>
                    </button>
                    
                    {/* Page Numbers */}
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                        let pageNum;
                        if (pagination.pages <= 5) {
                          pageNum = i + 1;
                        } else if (pagination.page <= 3) {
                          pageNum = i + 1;
                        } else if (pagination.page >= pagination.pages - 2) {
                          pageNum = pagination.pages - 4 + i;
                        } else {
                          pageNum = pagination.page - 2 + i;
                        }
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setPagination({ ...pagination, page: pageNum })}
                            className={`w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg transition-colors font-medium text-sm sm:text-base touch-manipulation ${
                              pagination.page === pageNum
                                ? 'bg-blue-500 text-white'
                                : 'border border-gray-300 text-gray-700 hover:bg-gray-50 active:bg-gray-100'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                      {pagination.pages > 5 && (
                        <>
                          {pagination.page < pagination.pages - 2 && (
                            <span className="px-1 sm:px-2 text-gray-500 text-sm">...</span>
                          )}
                          {pagination.page < pagination.pages - 1 && (
                            <button
                              onClick={() => setPagination({ ...pagination, page: pagination.pages })}
                              className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors font-medium text-sm sm:text-base touch-manipulation"
                            >
                              {pagination.pages}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                    
                    <button
                      onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                      disabled={pagination.page >= pagination.pages}
                      className="px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 active:bg-gray-100 transition-colors font-medium touch-manipulation"
                    >
                      Next
                    </button>
                  </div>
                  
                  {/* Pagination Info */}
                  <div className="text-xs sm:text-sm text-gray-600 text-center px-4">
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} posts
                  </div>
                </div>
              )}
            </div>
          )}
            </main>

          </div>
        </div>

        {/* Create Post Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4 overflow-x-hidden">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto overflow-x-hidden mx-2 sm:mx-0">
              <div className="p-4 sm:p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900">Create New Post</h2>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="text-gray-400 hover:text-gray-600 active:text-gray-800 transition-colors p-1 touch-manipulation"
                    aria-label="Close modal"
                  >
                    <FiX className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                </div>
              </div>
              <div className="p-4 sm:p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category (Optional)
                  </label>
                  <select
                    className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={newPost.category_id}
                    onChange={(e) => setNewPost({ ...newPost, category_id: e.target.value })}
                  >
                    <option value="">Select a category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title *
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter post title"
                    value={newPost.title}
                    onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Content *
                  </label>
                  <textarea
                    className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                    rows={6}
                    placeholder="Write your post content here..."
                    value={newPost.content}
                    onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                  />
                </div>
              </div>
              <div className="p-4 sm:p-6 border-t border-gray-200 flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 sticky bottom-0 bg-white">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="w-full sm:w-auto px-4 py-2.5 sm:py-2 text-sm sm:text-base border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors font-medium touch-manipulation"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreatePost}
                  disabled={submitting || !newPost.title.trim() || !newPost.content.trim()}
                  className="w-full sm:w-auto px-4 py-2.5 sm:py-2 text-sm sm:text-base bg-blue-500 text-white rounded-lg hover:bg-blue-600 active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium touch-manipulation"
                >
                  {submitting ? 'Creating...' : 'Create Post'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
};

const ForumPage = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ForumPageContent />
    </Suspense>
  );
};

export default ForumPage;