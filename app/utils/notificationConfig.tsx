/**
 * Notification Configuration
 * Centralized mapping of notification types to icons, colors, and styles
 * Follows Facebook/LinkedIn-style notification system
 */

import React from 'react';
import {
  FiUpload,
  FiMessageSquare,
  FiAlertTriangle,
  FiClipboard,
  FiVolume2,
  FiShield,
  FiCreditCard,
  FiCheckCircle,
  FiAward,
  FiMessageCircle,
  FiSettings,
  FiAlertCircle,
  FiClock,
  FiFileText,
  FiHeart,
  FiBell,
  FiVideo
} from 'react-icons/fi';

export type NotificationType =
  | 'assignment_submitted'
  | 'assignment_feedback'
  | 'assignment_graded'
  | 'assignment_resubmit'
  | 'quiz_result'
  | 'course_announcement'
  | 'admin_post'
  | 'payment_due'
  | 'payment_success'
  | 'certificate_ready'
  | 'forum_reply'
  | 'forum_post'
  | 'post_comment'
  | 'post_reply'
  | 'post_like'
  | 'reply'
  | 'like'
  | 'system'
  | 'security'
  | 'deadline_warning'
  | 'file_rejected'
  | 'file_resubmitted'
  | 'chat'
  | 'message'
  | 'consultation_confirmed'
  | 'consultation_cancelled'
  | 'consultation_new';

export interface NotificationTypeConfig {
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string; // Left border color
  bgTint: string; // Background tint
  iconBg: string; // Icon background color
  label: string; // Human-readable label
}

/**
 * Centralized notification type configuration
 * Maps each notification type to its visual representation
 */
export const notificationTypeConfig: Record<NotificationType, NotificationTypeConfig> = {
  // Assignment notifications
  assignment_submitted: {
    icon: FiUpload,
    accentColor: 'border-l-blue-500',
    bgTint: 'bg-blue-50/30',
    iconBg: 'bg-blue-500',
    label: 'Assignment Submitted'
  },
  assignment_feedback: {
    icon: FiMessageSquare,
    accentColor: 'border-l-indigo-500',
    bgTint: 'bg-indigo-50/30',
    iconBg: 'bg-indigo-500',
    label: 'Assignment Feedback'
  },
  assignment_graded: {
    icon: FiCheckCircle,
    accentColor: 'border-l-green-500',
    bgTint: 'bg-green-50/30',
    iconBg: 'bg-green-500',
    label: 'Assignment Graded'
  },
  assignment_resubmit: {
    icon: FiAlertTriangle,
    accentColor: 'border-l-red-500',
    bgTint: 'bg-red-50/30',
    iconBg: 'bg-red-500',
    label: 'Action Required'
  },
  
  // Quiz notifications
  quiz_result: {
    icon: FiClipboard,
    accentColor: 'border-l-green-500',
    bgTint: 'bg-green-50/30',
    iconBg: 'bg-green-500',
    label: 'Quiz Graded'
  },
  
  // Course notifications
  course_announcement: {
    icon: FiVolume2,
    accentColor: 'border-l-cyan-500',
    bgTint: 'bg-cyan-50/30',
    iconBg: 'bg-cyan-500',
    label: 'Course Update'
  },
  
  // Admin notifications
  admin_post: {
    icon: FiShield,
    accentColor: 'border-l-purple-500',
    bgTint: 'bg-purple-50/30',
    iconBg: 'bg-purple-500',
    label: 'Admin Action'
  },
  
  // Payment notifications
  payment_due: {
    icon: FiCreditCard,
    accentColor: 'border-l-orange-500',
    bgTint: 'bg-orange-50/30',
    iconBg: 'bg-orange-500',
    label: 'Payment Reminder'
  },
  payment_success: {
    icon: FiCheckCircle,
    accentColor: 'border-l-green-500',
    bgTint: 'bg-green-50/30',
    iconBg: 'bg-green-500',
    label: 'Payment Completed'
  },
  
  // Certificate notifications
  certificate_ready: {
    icon: FiAward,
    accentColor: 'border-l-emerald-500',
    bgTint: 'bg-emerald-50/30',
    iconBg: 'bg-emerald-500',
    label: 'Certificate Issued'
  },
  
  // Forum notifications
  forum_reply: {
    icon: FiMessageCircle,
    accentColor: 'border-l-sky-500',
    bgTint: 'bg-sky-50/30',
    iconBg: 'bg-sky-500',
    label: 'Forum Activity'
  },
  forum_post: {
    icon: FiFileText,
    accentColor: 'border-l-purple-500',
    bgTint: 'bg-purple-50/30',
    iconBg: 'bg-purple-500',
    label: 'New Forum Post'
  },
  post_comment: {
    icon: FiMessageSquare,
    accentColor: 'border-l-green-500',
    bgTint: 'bg-green-50/30',
    iconBg: 'bg-green-500',
    label: 'New Comment'
  },
  post_reply: {
    icon: FiMessageSquare,
    accentColor: 'border-l-green-500',
    bgTint: 'bg-green-50/30',
    iconBg: 'bg-green-500',
    label: 'New Reply'
  },
  post_like: {
    icon: FiHeart,
    accentColor: 'border-l-red-500',
    bgTint: 'bg-red-50/30',
    iconBg: 'bg-red-500',
    label: 'Post Liked'
  },
  reply: {
    icon: FiMessageSquare,
    accentColor: 'border-l-green-500',
    bgTint: 'bg-green-50/30',
    iconBg: 'bg-green-500',
    label: 'New Reply'
  },
  like: {
    icon: FiHeart,
    accentColor: 'border-l-red-500',
    bgTint: 'bg-red-50/30',
    iconBg: 'bg-red-500',
    label: 'Liked'
  },
  
  // System notifications
  system: {
    icon: FiSettings,
    accentColor: 'border-l-gray-500',
    bgTint: 'bg-gray-50/30',
    iconBg: 'bg-gray-500',
    label: 'System Notice'
  },
  security: {
    icon: FiAlertCircle,
    accentColor: 'border-l-rose-500',
    bgTint: 'bg-rose-50/30',
    iconBg: 'bg-rose-500',
    label: 'Security Warning'
  },
  deadline_warning: {
    icon: FiClock,
    accentColor: 'border-l-amber-500',
    bgTint: 'bg-amber-50/30',
    iconBg: 'bg-amber-500',
    label: 'Deadline Approaching'
  },
  
  // File notifications
  file_rejected: {
    icon: FiAlertTriangle,
    accentColor: 'border-l-red-600',
    bgTint: 'bg-red-50/50',
    iconBg: 'bg-red-600',
    label: 'File Rejected'
  },
  file_resubmitted: {
    icon: FiUpload,
    accentColor: 'border-l-blue-600',
    bgTint: 'bg-blue-50/30',
    iconBg: 'bg-blue-600',
    label: 'File Resubmitted'
  },
  
  // Chat/Message notifications (should be filtered out, but included for completeness)
  chat: {
    icon: FiMessageSquare,
    accentColor: 'border-l-blue-500',
    bgTint: 'bg-blue-50/30',
    iconBg: 'bg-blue-500',
    label: 'New Message'
  },
  message: {
    icon: FiMessageSquare,
    accentColor: 'border-l-blue-500',
    bgTint: 'bg-blue-50/30',
    iconBg: 'bg-blue-500',
    label: 'New Message'
  },

  // Consultation (Zoom video booking) notifications
  consultation_confirmed: {
    icon: FiVideo,
    accentColor: 'border-l-indigo-500',
    bgTint: 'bg-indigo-50/30',
    iconBg: 'bg-indigo-500',
    label: 'Consultation Booked'
  },
  consultation_cancelled: {
    icon: FiAlertCircle,
    accentColor: 'border-l-amber-500',
    bgTint: 'bg-amber-50/30',
    iconBg: 'bg-amber-500',
    label: 'Consultation Cancelled'
  },
  consultation_new: {
    icon: FiVideo,
    accentColor: 'border-l-cyan-500',
    bgTint: 'bg-cyan-50/30',
    iconBg: 'bg-cyan-500',
    label: 'New Consultation Booking'
  }
};

/**
 * Get notification configuration for a given type
 * Falls back to default if type is unknown
 */
export function getNotificationConfig(type: string): NotificationTypeConfig {
  const normalizedType = type.toLowerCase() as NotificationType;
  return notificationTypeConfig[normalizedType] || {
    icon: FiBell,
    accentColor: 'border-l-gray-500',
    bgTint: 'bg-gray-50/30',
    iconBg: 'bg-gray-500',
    label: 'Notification'
  };
}

/**
 * Normalize notification type from database to our type system
 * Handles variations and legacy types
 */
export function normalizeNotificationType(type: string): NotificationType {
  const normalized = type.toLowerCase();
  
  // Map legacy types to new types
  const typeMap: Record<string, NotificationType> = {
    'post_comment': 'post_comment',
    'post_reply': 'post_reply',
    'post_like': 'post_like',
    'reply': 'reply',
    'like': 'like',
    'forum_post': 'forum_post',
    'file_rejected': 'file_rejected',
    'file_resubmitted': 'file_resubmitted',
    'chat': 'chat',
    'message': 'message',
    'assignment_submitted': 'assignment_submitted',
    'assignment_feedback': 'assignment_feedback',
    'assignment_graded': 'assignment_graded',
    'assignment_resubmit': 'assignment_resubmit',
    'quiz_graded': 'quiz_result',
    'quiz_result': 'quiz_result',
    'course_announcement': 'course_announcement',
    'admin_post': 'admin_post',
    'payment_due': 'payment_due',
    'payment_success': 'payment_success',
    'certificate_ready': 'certificate_ready',
    'forum_reply': 'forum_reply',
    'system': 'system',
    'security': 'security',
    'deadline_reminder': 'deadline_warning',
    'deadline_warning': 'deadline_warning',
    'consultation_confirmed': 'consultation_confirmed',
    'consultation_cancelled': 'consultation_cancelled',
    'consultation_new': 'consultation_new'
  };
  
  return typeMap[normalized] || 'system';
}
