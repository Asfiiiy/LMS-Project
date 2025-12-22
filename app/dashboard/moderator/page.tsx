'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { UserRole, User } from '@/app/components/types';
import { apiService } from '@/app/services/api';
import { 
  FiMessageCircle, FiPlus, FiEye, 
  FiMessageSquare, FiMapPin, FiLock, FiTag,
  FiChevronRight, FiRefreshCw, FiCheckCircle, FiX,
  FiShield, FiActivity
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
  views_count: number;
  likes_count: number;
  comments_count: number;
  last_activity_at: string;
  created_at: string;
  author_id: number;
  author_name: string;
  author_role: string;
  category_id: number;
  category_name: string;
  category_color: string;
}

const ModeratorDashboard = () => {
  const router = useRouter();
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPost, setNewPost] = useState({ category_id: '', title: '', content: '' });
  const [submitting, setSubmitting] = useState(false);
  const [forumStats, setForumStats] = useState({
    totalPosts: 0,
    activePosts: 0,
    lockedPosts: 0,
    pinnedPosts: 0,
    totalComments: 0,
    totalViews: 0
  });

  useEffect(() => {
    const userData: User | null = JSON.parse(localStorage.getItem('lms-user') || 'null');
    setUserRole(userData?.role || null);
    fetchData();
    fetchForumStats();
  }, []);

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

  const fetchForumStats = async () => {
    try {
      // Fetch all posts to calculate real statistics
      const res = await apiService.getForumPosts({
        sort: 'recent',
        page: 1,
        limit: 1000 // Get all posts for accurate stats
      });

      if (res?.success && res.posts) {
        const allPosts = res.posts;
        const stats = {
          totalPosts: allPosts.length,
          activePosts: allPosts.filter((p: Post) => !p.is_locked && !p.is_pinned).length,
          lockedPosts: allPosts.filter((p: Post) => p.is_locked).length,
          pinnedPosts: allPosts.filter((p: Post) => p.is_pinned).length,
          totalComments: allPosts.reduce((sum: number, p: Post) => sum + (p.comments_count || 0), 0),
          totalViews: allPosts.reduce((sum: number, p: Post) => sum + (p.views_count || 0), 0)
        };
        setForumStats(stats);
      }
    } catch (error) {
      console.error('Error fetching forum stats:', error);
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
        fetchForumStats(); // Refresh stats after creating post
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

  // Use real forum stats instead of calculated from posts
  const stats = forumStats;

  return (
    <ProtectedRoute allowedRoles={['Moderator', 'Admin']} userRole={userRole}>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl">
                  <FiShield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Moderator Dashboard</h1>
                  <p className="text-gray-600 mt-1">Manage and moderate forum content</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    fetchForumStats();
                    fetchData();
                  }}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200"
                  title="Refresh"
                >
                  <FiRefreshCw className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-lg hover:shadow-lg transition-all duration-200"
                >
                  <FiPlus className="w-5 h-5" />
                  New Post
                </button>
                <button
                  onClick={() => router.push('/dashboard/forum')}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white font-medium rounded-lg hover:shadow-lg transition-all duration-200"
                >
                  <FiMessageCircle className="w-5 h-5" />
                  Go to Forum
                  <FiChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Quick Actions */}
          <div className="mb-8">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <button
                onClick={() => router.push('/dashboard/forum')}
                className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 text-left group"
              >
                <div className="flex items-center justify-between mb-3">
                  <FiMessageCircle className="w-8 h-8" />
                  <FiChevronRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
                <h3 className="text-lg font-bold mb-1">View Forum</h3>
                <p className="text-blue-100 text-sm">Browse and interact with all posts</p>
              </button>

              <button
                onClick={() => router.push('/dashboard/forum')}
                className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 text-left group"
              >
                <div className="flex items-center justify-between mb-3">
                  <FiActivity className="w-8 h-8" />
                  <FiChevronRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <h3 className="text-lg font-bold mb-1">Moderate Posts</h3>
                <p className="text-purple-100 text-sm">{forumStats.totalPosts} total posts to manage</p>
              </button>

              <button
                onClick={() => {
                  setStatusFilter('locked');
                  router.push('/dashboard/forum?status=locked');
                }}
                className="bg-gradient-to-r from-red-500 to-red-600 text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 text-left group"
              >
                <div className="flex items-center justify-between mb-3">
                  <FiLock className="w-8 h-8" />
                  <FiChevronRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <h3 className="text-lg font-bold mb-1">Locked Posts</h3>
                <p className="text-red-100 text-sm">{forumStats.lockedPosts} locked discussions</p>
              </button>

              <button
                onClick={() => {
                  setStatusFilter('pinned');
                  router.push('/dashboard/forum?status=pinned');
                }}
                className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 text-left group"
              >
                <div className="flex items-center justify-between mb-3">
                  <FiMapPin className="w-8 h-8" />
                  <FiChevronRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <h3 className="text-lg font-bold mb-1">Pinned Posts</h3>
                <p className="text-green-100 text-sm">{forumStats.pinnedPosts} pinned announcements</p>
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Posts</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalPosts}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-xl">
                  <FiMessageCircle className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Posts</p>
                  <p className="text-3xl font-bold text-green-600 mt-2">{stats.activePosts}</p>
                </div>
                <div className="p-3 bg-green-100 rounded-xl">
                  <FiCheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Locked Posts</p>
                  <p className="text-3xl font-bold text-red-600 mt-2">{stats.lockedPosts}</p>
                </div>
                <div className="p-3 bg-red-100 rounded-xl">
                  <FiLock className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Comments</p>
                  <p className="text-3xl font-bold text-purple-600 mt-2">{stats.totalComments}</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-xl">
                  <FiMessageSquare className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Views</p>
                  <p className="text-3xl font-bold text-orange-600 mt-2">{stats.totalViews}</p>
                </div>
                <div className="p-3 bg-orange-100 rounded-xl">
                  <FiEye className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </div>
          </div>

        </main>

        {/* Create Post Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold text-gray-900">Create New Post</h2>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <FiX className="w-6 h-6" />
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category (Optional)
                  </label>
                  <select
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    rows={8}
                    placeholder="Write your post content here..."
                    value={newPost.content}
                    onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                  />
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreatePost}
                  disabled={submitting || !newPost.title.trim() || !newPost.content.trim()}
                  className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
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

export default ModeratorDashboard;
