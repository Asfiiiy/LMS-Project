'use client';

import React, { useEffect, useState, use } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { UserRole, User } from '@/app/components/types';
import { apiService } from '@/app/services/api';
import { 
  FiMessageCircle, FiHeart, FiMessageSquare, FiClock, FiEdit2, 
  FiTrash2, FiMapPin, FiLock, FiTag, FiSend, FiChevronLeft, FiX, FiEye
} from 'react-icons/fi';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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

interface Comment {
  id: number;
  content: string;
  likes_count: number;
  is_edited: boolean;
  created_at: string;
  author_id: number;
  author_name: string;
  author_role: string;
  parent_comment_id: number | null;
  replies: Comment[];
}

const PostDetailPage = ({ params }: { params: Promise<{ postId: string }> }) => {
  const router = useRouter();
  const resolvedParams = use(params);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [user, setUser] = useState<User | null>(null);
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [commentLikes, setCommentLikes] = useState<number[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingComment, setEditingComment] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    const userData: User | null = JSON.parse(localStorage.getItem('lms-user') || 'null');
    setUser(userData);
    setUserRole(userData?.role || null);
    fetchPost();
  }, [resolvedParams.postId]);

  const fetchPost = async () => {
    try {
      setLoading(true);
      const postId = parseInt(resolvedParams.postId);
      const [postRes, likesRes] = await Promise.all([
        apiService.getForumPost(postId),
        apiService.getForumLikes(postId)
      ]);

      if (postRes?.success) {
        setPost(postRes.post);
        setComments(postRes.comments || []);
      }

      if (likesRes?.success) {
        setLiked(likesRes.postLiked);
        setCommentLikes(likesRes.commentLikes || []);
      }
    } catch (error) {
      console.error('Error fetching post:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async () => {
    try {
      const postId = parseInt(resolvedParams.postId);
      const res = await apiService.likeForumPost(postId);
      if (res?.success) {
        setLiked(res.liked);
        fetchPost(); // Refresh to get updated like count
      }
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const handleCommentLike = async (commentId: number) => {
    try {
      const res = await apiService.likeForumComment(commentId);
      if (res?.success) {
        if (res.liked) {
          setCommentLikes([...commentLikes, commentId]);
        } else {
          setCommentLikes(commentLikes.filter(id => id !== commentId));
        }
        fetchPost(); // Refresh to get updated like counts
      }
    } catch (error) {
      console.error('Error liking comment:', error);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;

    try {
      setSubmitting(true);
      const postId = parseInt(resolvedParams.postId);
      const res = await apiService.createForumComment(postId, {
        content: newComment,
        parent_comment_id: replyingTo || undefined
      });

      if (res?.success) {
        setNewComment('');
        setReplyingTo(null);
        fetchPost();
      } else {
        alert(res?.message || 'Failed to add comment');
      }
    } catch (error: any) {
      console.error('Error adding comment:', error);
      alert(error?.message || 'Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitReply = async (parentId: number) => {
    if (!replyContent.trim()) return;

    try {
      setSubmitting(true);
      const postId = parseInt(resolvedParams.postId);
      const res = await apiService.createForumComment(postId, {
        content: replyContent,
        parent_comment_id: parentId
      });

      if (res?.success) {
        setReplyContent('');
        setReplyingTo(null);
        fetchPost();
      } else {
        alert(res?.message || 'Failed to add reply');
      }
    } catch (error: any) {
      console.error('Error adding reply:', error);
      alert(error?.message || 'Failed to add reply');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditComment = async (commentId: number) => {
    if (!editContent.trim()) return;

    try {
      setSubmitting(true);
      const res = await apiService.updateForumComment(commentId, editContent);

      if (res?.success) {
        setEditingComment(null);
        setEditContent('');
        fetchPost();
      } else {
        alert(res?.message || 'Failed to update comment');
      }
    } catch (error: any) {
      console.error('Error updating comment:', error);
      alert(error?.message || 'Failed to update comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    try {
      const res = await apiService.deleteForumComment(commentId);
      if (res?.success) {
        fetchPost();
      } else {
        alert(res?.message || 'Failed to delete comment');
      }
    } catch (error: any) {
      console.error('Error deleting comment:', error);
      alert(error?.message || 'Failed to delete comment');
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

  const renderComment = (comment: Comment, depth: number = 0) => {
    const isLiked = commentLikes.includes(comment.id);
    const isOwner = comment.author_id === user?.id;
    const canEdit = isOwner || canModerate;

    return (
      <div key={comment.id} className={`${depth > 0 ? 'ml-8 mt-4' : ''}`}>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-400 to-cyan-300 flex items-center justify-center text-white font-bold flex-shrink-0">
              {comment.author_name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-gray-900">{comment.author_name}</span>
                <span className="text-xs px-2 py-0.5 bg-gray-200 rounded text-gray-600">
                  {comment.author_role}
                </span>
                <span className="text-xs text-gray-500">{formatDate(comment.created_at)}</span>
                {comment.is_edited && (
                  <span className="text-xs text-gray-400 italic">(edited)</span>
                )}
              </div>
              {editingComment === comment.id ? (
                <div className="space-y-2">
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditComment(comment.id)}
                      disabled={submitting || !editContent.trim()}
                      className="px-3 py-1 bg-blue-500 text-white rounded text-sm disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingComment(null);
                        setEditContent('');
                      }}
                      className="px-3 py-1 border border-gray-300 rounded text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-gray-700 whitespace-pre-wrap mb-2">{comment.content}</p>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => handleCommentLike(comment.id)}
                      className={`flex items-center gap-1 text-sm ${
                        isLiked ? 'text-red-500' : 'text-gray-500'
                      } hover:text-red-500`}
                    >
                      <FiHeart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                      {comment.likes_count}
                    </button>
                    {!post?.is_locked && canPost && (
                      <button
                        onClick={() => {
                          setReplyingTo(comment.id);
                          setReplyContent('');
                        }}
                        className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-500"
                      >
                        <FiMessageSquare className="w-4 h-4" />
                        Reply
                      </button>
                    )}
                    {canEdit && (
                      <>
                        <button
                          onClick={() => {
                            setEditingComment(comment.id);
                            setEditContent(comment.content);
                          }}
                          className="text-sm text-gray-500 hover:text-blue-500"
                        >
                          <FiEdit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="text-sm text-gray-500 hover:text-red-500"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Reply input */}
        {replyingTo === comment.id && (
          <div className="ml-8 mt-3">
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              placeholder="Write a reply..."
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => handleSubmitReply(comment.id)}
                disabled={submitting || !replyContent.trim()}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm disabled:opacity-50 flex items-center gap-2"
              >
                <FiSend className="w-4 h-4" />
                Reply
              </button>
              <button
                onClick={() => {
                  setReplyingTo(null);
                  setReplyContent('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Nested replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-2">
            {comment.replies.map((reply) => renderComment(reply, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['Student', 'Moderator', 'Admin', 'Tutor', 'ManagerStudent', 'InstituteStudent']} userRole={userRole}>
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="text-gray-500 mt-4">Loading post...</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!post) {
    return (
      <ProtectedRoute allowedRoles={['Student', 'Moderator', 'Admin', 'Tutor', 'ManagerStudent', 'InstituteStudent']} userRole={userRole}>
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Post not found</h2>
            <Link href="/dashboard/forum" className="text-blue-500 hover:underline">
              Back to Forum
            </Link>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  const isOwner = post.author_id === user?.id;

  return (
    <ProtectedRoute allowedRoles={['Student', 'Moderator', 'Admin', 'Tutor', 'ManagerStudent', 'InstituteStudent']} userRole={userRole}>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <Link
              href="/dashboard/forum"
              className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
            >
              <FiChevronLeft className="w-5 h-5" />
              Back to Forum
            </Link>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Post */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-start gap-4 mb-4">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                style={{ backgroundColor: post.category_color || '#11CCEF' }}
              >
                {post.author_name.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  {post.is_pinned && (
                    <FiMapPin className="w-4 h-4 text-blue-500" />
                  )}
                  {post.is_locked && (
                    <FiLock className="w-4 h-4 text-red-500" />
                  )}
                  <h1 className="text-2xl font-bold text-gray-900">{post.title}</h1>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                  <span className="flex items-center gap-1">
                    <span style={{ color: post.category_color }}>
                      <FiTag className="w-3 h-3" />
                    </span>
                    {post.category_name}
                  </span>
                  <span>by {post.author_name}</span>
                  <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                    {post.author_role}
                  </span>
                  <span className="flex items-center gap-1">
                    <FiClock className="w-3 h-3" />
                    {formatDate(post.created_at)}
                  </span>
                </div>
                <div className="prose max-w-none">
                  <p className="text-gray-700 whitespace-pre-wrap">{post.content}</p>
                </div>
                <div className="flex items-center gap-6 mt-6 pt-4 border-t border-gray-200">
                  <button
                    onClick={handleLike}
                    className={`flex items-center gap-2 ${
                      liked ? 'text-red-500' : 'text-gray-500'
                    } hover:text-red-500`}
                  >
                    <FiHeart className={`w-5 h-5 ${liked ? 'fill-current' : ''}`} />
                    <span>{post.likes_count}</span>
                  </button>
                  <span className="flex items-center gap-2 text-gray-500">
                    <FiMessageSquare className="w-5 h-5" />
                    {post.comments_count} comments
                  </span>
                  <span className="flex items-center gap-2 text-gray-500">
                    <FiEye className="w-5 h-5" />
                    {post.views_count} views
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Comments Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Comments ({post.comments_count})
            </h2>

            {/* Add Comment */}
            {!post.is_locked && canPost && (
              <div className="mb-6">
                <textarea
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={4}
                  placeholder="Write a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={handleSubmitComment}
                    disabled={submitting || !newComment.trim()}
                    className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-400 text-white rounded-lg hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <FiSend className="w-4 h-4" />
                    {submitting ? 'Posting...' : 'Post Comment'}
                  </button>
                </div>
              </div>
            )}

            {post.is_locked && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <p className="text-yellow-800 text-sm">
                  This post is locked. No new comments can be added.
                </p>
              </div>
            )}

            {/* Comments List */}
            {comments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FiMessageSquare className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No comments yet. Be the first to comment!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {comments.map((comment) => renderComment(comment))}
              </div>
            )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
};

export default PostDetailPage;

