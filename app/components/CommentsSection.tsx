'use client';

import React, { useEffect, useState } from 'react';
import { apiService } from '@/app/services/api';
import { 
  FiHeart, FiMessageSquare, FiSend, FiEdit2, FiTrash2, FiClock
} from 'react-icons/fi';

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

interface Comment {
  id: number;
  content: string;
  likes_count: number;
  is_edited: boolean;
  created_at: string;
  author_id: number;
  author_name: string;
  author_avatar: string | null;
  author_role: string;
  parent_comment_id: number | null;
  replies: Comment[];
  my_reaction?: string | null; // user's current reaction type (primary)
  reaction_counts?: Record<string, number>; // reaction_type -> count (all 7 types with zeros)
  user_reaction?: Record<string, boolean> | null; // backward compat
}

interface CommentsSectionProps {
  postId: number;
  userId: number | null;
  userRole: string | null;
  commentsDisabled: boolean;
  isLocked: boolean;
  onCommentAdded?: () => void;
  user?: { id: number; name: string; avatar?: string | null } | null;
}

const CommentsSection: React.FC<CommentsSectionProps> = ({
  postId,
  userId,
  userRole,
  commentsDisabled,
  isLocked,
  onCommentAdded,
  user
}) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingComment, setEditingComment] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [commentLikes, setCommentLikes] = useState<number[]>([]); // backward compat
  const [postLiked, setPostLiked] = useState(false);
  const [commentReactions, setCommentReactions] = useState<Record<number, string | null>>({}); // commentId -> reaction_type or null
  const [commentReactionCounts, setCommentReactionCounts] = useState<Record<number, Record<string, number>>>({}); // commentId -> { reaction_type -> count }
  const [showCommentReactionPicker, setShowCommentReactionPicker] = useState<number | null>(null);
  const [commentPickerTimeout, setCommentPickerTimeout] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchComments();
  }, [postId]);

  const fetchComments = async () => {
    try {
      setLoading(true);
      const [postRes, likesRes] = await Promise.all([
        apiService.getForumPost(postId),
        apiService.getForumLikes(postId)
      ]);

      if (postRes?.success) {
        setComments(postRes.comments || []);
        
        // Initialize comment reactions from backend response
        const reactionsMap: Record<number, string | null> = {};
        const countsMap: Record<number, Record<string, number>> = {};
        
        const processComments = (commentList: Comment[]) => {
          commentList.forEach((comment: Comment) => {
            if ('my_reaction' in comment) {
              if (comment.my_reaction !== null && typeof comment.my_reaction === 'string' && comment.my_reaction.trim() !== '') {
                reactionsMap[comment.id] = comment.my_reaction;
              } else {
                reactionsMap[comment.id] = null;
              }
            }
            
            if (comment.reaction_counts && typeof comment.reaction_counts === 'object') {
              countsMap[comment.id] = {
                like: comment.reaction_counts.like ?? 0,
                insightful: comment.reaction_counts.insightful ?? 0,
                helpful: comment.reaction_counts.helpful ?? 0,
                smart_thinking: comment.reaction_counts.smart_thinking ?? 0,
                well_done: comment.reaction_counts.well_done ?? 0,
                curious: comment.reaction_counts.curious ?? 0,
                excellent: comment.reaction_counts.excellent ?? 0
              };
            } else {
              countsMap[comment.id] = {
                like: 0,
                insightful: 0,
                helpful: 0,
                smart_thinking: 0,
                well_done: 0,
                curious: 0,
                excellent: 0
              };
            }
            
            // Process nested replies
            if (comment.replies && comment.replies.length > 0) {
              processComments(comment.replies);
            }
          });
        };
        
        processComments(postRes.comments || []);
        setCommentReactions(reactionsMap);
        setCommentReactionCounts(countsMap);
      }

      if (likesRes?.success) {
        setPostLiked(likesRes.postLiked);
        setCommentLikes(likesRes.commentLikes || []);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !userId) return;

    try {
      setSubmitting(true);
      const res = await apiService.createForumComment(postId, {
        content: newComment
      });

      if (res?.success) {
        setNewComment('');
        fetchComments();
        if (onCommentAdded) onCommentAdded();
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
    if (!replyContent.trim() || !userId) return;

    try {
      setSubmitting(true);
      const res = await apiService.createForumComment(postId, {
        content: replyContent,
        parent_comment_id: parentId
      });

      if (res?.success) {
        setReplyContent('');
        setReplyingTo(null);
        fetchComments();
        if (onCommentAdded) onCommentAdded();
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
        fetchComments();
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
        fetchComments();
        if (onCommentAdded) onCommentAdded();
      } else {
        alert(res?.message || 'Failed to delete comment');
      }
    } catch (error: any) {
      console.error('Error deleting comment:', error);
      alert(error?.message || 'Failed to delete comment');
    }
  };

  const handleCommentReact = async (commentId: number, reactionType: string) => {
    if (!userId) return;

    // Get current reaction
    const currentReaction = commentReactions[commentId] || null;
    const isSameReaction = currentReaction === reactionType;

    // Optimistic update
    setCommentReactions(prev => ({
      ...prev,
      [commentId]: isSameReaction ? null : reactionType
    }));

    // Optimistic update counts
    setCommentReactionCounts(prev => {
      const currentCounts = prev[commentId] || {
        like: 0,
        insightful: 0,
        helpful: 0,
        smart_thinking: 0,
        well_done: 0,
        curious: 0,
        excellent: 0
      };
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
        [commentId]: newCounts
      };
    });

    try {
      const res = await apiService.reactForumComment(commentId, reactionType);
      if (res?.success) {
        // Update with actual API response
        setCommentReactions(prev => ({
          ...prev,
          [commentId]: res.my_reaction || null
        }));
        
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
        
        setCommentReactionCounts(prev => ({
          ...prev,
          [commentId]: updatedCounts
        }));
      }
    } catch (error) {
      console.error('Error reacting to comment:', error);
      // Revert optimistic update on error
      fetchComments();
    }
  };

  // Backward compatibility
  const handleCommentLike = async (commentId: number) => {
    const currentReaction = commentReactions[commentId];
    if (currentReaction === 'like') {
      // Remove like
      await handleCommentReact(commentId, 'like');
    } else {
      // Add like
      await handleCommentReact(commentId, 'like');
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

  const canPost = ['Student', 'Moderator', 'Admin', 'ManagerStudent', 'InstituteStudent'].includes(userRole || '');
  const canModerate = ['Admin', 'Moderator'].includes(userRole || '');

  const renderComment = (comment: Comment, depth: number = 0) => {
    // Get user reaction from state (optimistic) or comment data (from backend)
    const userReaction = commentReactions.hasOwnProperty(comment.id) 
      ? commentReactions[comment.id]
      : (comment.my_reaction !== undefined 
          ? (comment.my_reaction !== null && typeof comment.my_reaction === 'string' && comment.my_reaction.trim() !== '' 
              ? comment.my_reaction 
              : null)
          : null);
    
    // Get reaction counts from state (optimistic) or comment data (from backend)
    const reactions = commentReactionCounts[comment.id] || comment.reaction_counts || {
      like: 0,
      insightful: 0,
      helpful: 0,
      smart_thinking: 0,
      well_done: 0,
      curious: 0,
      excellent: 0
    };
    
    const isOwner = comment.author_id === userId;
    const canEdit = isOwner || canModerate;

    return (
      <div key={comment.id} id={`comment-${comment.id}`} className={`${depth > 0 ? 'ml-6 mt-3' : 'mt-4'}`}>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-start gap-3">
            {comment.author_avatar && comment.author_avatar !== 'null' && comment.author_avatar.trim() !== '' ? (
              <img
                src={comment.author_avatar}
                alt={comment.author_name}
                className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-gray-200"
                onError={(e) => {
                  // Fallback to initial if image fails to load
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    const fallback = document.createElement('div');
                    fallback.className = 'w-8 h-8 rounded-full bg-gradient-to-r from-blue-400 to-cyan-300 flex items-center justify-center text-white text-xs font-bold flex-shrink-0';
                    fallback.textContent = comment.author_name.charAt(0);
                    parent.appendChild(fallback);
                  }
                }}
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-400 to-cyan-300 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {comment.author_name.charAt(0)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-sm text-gray-900">{comment.author_name}</span>
                <span className="text-xs px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    rows={3}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditComment(comment.id)}
                      disabled={submitting || !editContent.trim()}
                      className="px-3 py-1 bg-blue-500 text-white rounded text-xs disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingComment(null);
                        setEditContent('');
                      }}
                      className="px-3 py-1 border border-gray-300 rounded text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap mb-2">{comment.content}</p>
                  
                  {/* Reaction Section */}
                  <div className="flex items-center gap-3 mt-2">
                    {/* Reaction Button */}
                    <div className="relative">
                      <button
                        onMouseEnter={() => {
                          if (commentPickerTimeout) {
                            clearTimeout(commentPickerTimeout);
                            setCommentPickerTimeout(null);
                          }
                          setShowCommentReactionPicker(comment.id);
                        }}
                        onMouseLeave={() => {
                          const timeout = setTimeout(() => {
                            setShowCommentReactionPicker(prev => prev === comment.id ? null : prev);
                          }, 300);
                          setCommentPickerTimeout(timeout);
                        }}
                        onClick={() => {
                          handleCommentReact(comment.id, userReaction === 'like' ? userReaction : 'like');
                          setShowCommentReactionPicker(null);
                        }}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-full transition-colors text-xs ${
                          userReaction 
                            ? 'bg-blue-50 text-blue-600' 
                            : 'text-gray-500 hover:bg-gray-100'
                        }`}
                      >
                        {userReaction ? (
                          (() => {
                            const reactionConfig = REACTION_CONFIG.find(r => r.type === userReaction);
                            return reactionConfig ? (
                              <>
                                <span className="text-base">{reactionConfig.emoji}</span>
                                <span className="text-xs font-medium">{reactionConfig.label}</span>
                              </>
                            ) : (
                              <>
                                <span className="text-base">👍</span>
                                <span className="text-xs font-medium">Like</span>
                              </>
                            );
                          })()
                        ) : (
                          <>
                            <span className="text-base">👍</span>
                            <span className="text-xs font-medium">Like</span>
                          </>
                        )}
                      </button>
                      
                      {/* Reaction Picker */}
                      {showCommentReactionPicker === comment.id && (
                        <div
                          className="absolute bottom-full left-0 mb-1 bg-white rounded-full shadow-lg border border-gray-200 p-1.5 flex items-center gap-0.5 z-20"
                          onMouseEnter={() => {
                            if (commentPickerTimeout) {
                              clearTimeout(commentPickerTimeout);
                              setCommentPickerTimeout(null);
                            }
                            setShowCommentReactionPicker(comment.id);
                          }}
                          onMouseLeave={() => {
                            const timeout = setTimeout(() => {
                              setShowCommentReactionPicker(null);
                            }, 300);
                            setCommentPickerTimeout(timeout);
                          }}
                        >
                          {REACTION_CONFIG.map((reaction) => (
                            <button
                              key={reaction.type}
                              onClick={() => {
                                handleCommentReact(comment.id, reaction.type);
                                setShowCommentReactionPicker(null);
                              }}
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-lg hover:scale-125 transition-transform ${
                                userReaction === reaction.type ? 'bg-blue-100 ring-2 ring-blue-500' : 'hover:bg-gray-100'
                              }`}
                              title={reaction.label}
                            >
                              <span>{reaction.emoji}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* Reaction Counts Bar */}
                    {(() => {
                      const activeReactions = REACTION_CONFIG
                        .map(config => ({
                          ...config,
                          count: reactions[config.type] || 0
                        }))
                        .filter(r => r.count > 0);
                      
                      if (activeReactions.length === 0) return null;
                      
                      const totalReactions = Object.values(reactions).reduce((sum: number, count: number) => sum + count, 0);
                      const hasMyReaction = userReaction !== null;
                      
                      return (
                        <div className="flex items-center gap-2 text-gray-600">
                          {activeReactions.map((reaction) => (
                            <div
                              key={reaction.type}
                              className="flex items-center gap-0.5"
                              title={`${reaction.count} ${reaction.label}`}
                            >
                              <span className={`text-sm ${userReaction === reaction.type ? 'text-blue-500' : 'text-gray-700'}`}>
                                {reaction.emoji}
                              </span>
                              <span className="text-xs font-medium">
                                {reaction.count}
                              </span>
                            </div>
                          ))}
                          {totalReactions > 0 && (
                            <span className="text-xs ml-1">
                              {hasMyReaction && totalReactions > 1
                                ? `You and ${totalReactions - 1} others`
                                : hasMyReaction && totalReactions === 1
                                ? `You`
                                : `${totalReactions} reactions`}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  
                  <div className="flex items-center gap-4 mt-2">
                    {!isLocked && !commentsDisabled && canPost && (
                      <button
                        onClick={() => {
                          setReplyingTo(comment.id);
                          setReplyContent('');
                        }}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-500"
                      >
                        <FiMessageSquare className="w-3.5 h-3.5" />
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
                          className="text-xs text-gray-500 hover:text-blue-500"
                        >
                          <FiEdit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="text-xs text-gray-500 hover:text-red-500"
                        >
                          <FiTrash2 className="w-3.5 h-3.5" />
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
          <div className="ml-6 mt-2">
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              rows={2}
              placeholder="Write a reply..."
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => handleSubmitReply(comment.id)}
                disabled={submitting || !replyContent.trim()}
                className="px-3 py-1 bg-blue-500 text-white rounded text-xs disabled:opacity-50 flex items-center gap-1"
              >
                <FiSend className="w-3 h-3" />
                Reply
              </button>
              <button
                onClick={() => {
                  setReplyingTo(null);
                  setReplyContent('');
                }}
                className="px-3 py-1 border border-gray-300 rounded text-xs"
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
      <div className="mt-4 space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="bg-gray-50 rounded-lg p-3 animate-pulse">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-300"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-300 rounded w-1/4 mb-2"></div>
                <div className="h-3 bg-gray-300 rounded w-full mb-2"></div>
                <div className="h-3 bg-gray-300 rounded w-2/3"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-gray-200 pt-4">
      {/* Comment input */}
      {!isLocked && !commentsDisabled && canPost && (
        <div className="mb-4">
          <div className="flex items-start gap-3">
            {user?.avatar && user.avatar !== 'null' && user.avatar.trim() !== '' ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-gray-200"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    const fallback = document.createElement('div');
                    fallback.className = 'w-8 h-8 rounded-full bg-gradient-to-r from-blue-400 to-cyan-300 flex items-center justify-center text-white text-xs font-bold flex-shrink-0';
                    fallback.textContent = user.name?.charAt(0) || 'U';
                    parent.appendChild(fallback);
                  }
                }}
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-400 to-cyan-300 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {user?.name?.charAt(0) || (userId ? 'U' : '')}
              </div>
            )}
            <div className="flex-1">
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                rows={3}
                placeholder="Write a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
              />
              <div className="flex justify-end mt-2">
                <button
                  onClick={handleSubmitComment}
                  disabled={submitting || !newComment.trim()}
                  className="px-4 py-1.5 bg-blue-500 text-white rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 hover:bg-blue-600"
                >
                  <FiSend className="w-4 h-4" />
                  {submitting ? 'Posting...' : 'Post Comment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {commentsDisabled && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
          <p className="text-yellow-800 text-sm">
            Comments are disabled by a moderator
          </p>
        </div>
      )}

      {isLocked && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
          <p className="text-yellow-800 text-sm">
            This post is locked. No new comments can be added.
          </p>
        </div>
      )}

      {/* Comments list */}
      {comments.length === 0 ? (
        <div className="text-center py-6 text-gray-500">
          <FiMessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No comments yet. Be the first to comment!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {comments.map((comment) => renderComment(comment))}
        </div>
      )}
    </div>
  );
};

export default CommentsSection;

