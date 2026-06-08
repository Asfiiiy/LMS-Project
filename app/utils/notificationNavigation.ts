/**
 * Notification Navigation Utilities
 * Handles deep linking for notifications using existing routes
 * DO NOT hardcode URLs - uses existing navigation patterns
 */

import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

export interface NotificationNavigationData {
  related_post_id?: number | null;
  related_comment_id?: number | null;
  related_course_id?: number | null;
  related_submission_id?: number | null;
  related_conversation_id?: number | null;
  related_user_id?: number | null;
  type: string;
}

/**
 * Extract course ID from notification message if not in related_course_id
 * Looks for patterns like "Course: [name]" or course mentions
 */
function extractCourseInfoFromMessage(message: string): { courseId?: number; isQualification?: boolean } | null {
  // Try to extract course name from message
  // Pattern: "Course: Qualifi - Level 3 Diploma..."
  const courseMatch = message.match(/Course:\s*([^\n]+)/i);
  if (courseMatch) {
    const courseName = courseMatch[1].trim();
    // Check if it's a qualification course (Qualifi, Level, Diploma, etc.)
    const isQualification = /qualifi|level\s*\d+|diploma/i.test(courseName);
    return { isQualification };
  }
  return null;
}

/**
 * Determine navigation target based on notification data
 * Uses existing route patterns from the codebase
 */
export function getNotificationNavigationTarget(
  notification: NotificationNavigationData,
  userRole?: string | null,
  notificationMessage?: string
): string | null {
  const role = userRole?.toLowerCase() || 'student';
  const dashboardPrefix = `/dashboard/${role}`;

  // Forum notifications - highest priority
  if (notification.related_post_id) {
    const postId = notification.related_post_id;
    const commentId = notification.related_comment_id;
    return `/dashboard/forum?postId=${postId}${commentId ? `&commentId=${commentId}` : ''}`;
  }

  // Chat/Message notifications (should be filtered out, but handle for safety)
  if (notification.related_conversation_id || notification.type === 'chat' || notification.type === 'message') {
    return null; // Handled by FloatingChatProvider
  }

  // File rejection notifications - redirect to qualification course view
  if (notification.type === 'file_rejected') {
    if (notification.related_course_id) {
      const courseId = notification.related_course_id;
      if (role === 'student') {
        return `${dashboardPrefix}/qualification/${courseId}/view${notification.related_submission_id ? `?submission=${notification.related_submission_id}` : ''}`;
      }
    }
    // Fallback: try to extract course name from message and fetch course ID
    if (notificationMessage && role === 'student') {
      const courseInfo = extractCourseInfoFromMessage(notificationMessage);
      if (courseInfo?.isQualification) {
        // For file_rejected, we know it's a qualification course
        // We'll need to fetch the course ID, but for now, navigate to student dashboard
        // where they can see their qualification courses
        // TODO: Could fetch course by name from API, but that's async
        // For now, navigate to dashboard - student can find the course there
        return `${dashboardPrefix}`;
      }
    }
    // If no course info, still try to go to qualification courses
    if (role === 'student') {
      return `${dashboardPrefix}`;
    }
  }

  // Course-related notifications
  if (notification.related_course_id) {
    const courseId = notification.related_course_id;
    
    // Check if it's a qualification course based on type or message
    const isQualification = notification.type === 'file_rejected' || 
                           notification.type === 'assignment_resubmit' ||
                           notification.type === 'assignment_graded' ||
                           (notificationMessage && /qualifi|level\s*\d+|diploma/i.test(notificationMessage));
    
    if (isQualification && role === 'student') {
      // Qualification course
      if (notification.related_submission_id) {
        return `${dashboardPrefix}/qualification/${courseId}/view?submission=${notification.related_submission_id}`;
      }
      return `${dashboardPrefix}/qualification/${courseId}/view`;
    }
    
    // Regular course or CPD
    if (notification.type === 'course_announcement') {
      return `${dashboardPrefix}/courses/${courseId}`;
    }
    
    // Assignment-related notifications
    if (notification.related_submission_id) {
      // Try qualification first if message suggests it
      if (notificationMessage && /qualifi|level\s*\d+|diploma/i.test(notificationMessage)) {
        return `${dashboardPrefix}/qualification/${courseId}/view?submission=${notification.related_submission_id}`;
      }
      // Regular course
      return `${dashboardPrefix}/courses/${courseId}?submission=${notification.related_submission_id}`;
    }
    
    // Default: navigate to course
    return `${dashboardPrefix}/courses/${courseId}`;
  }

  // Assignment feedback/resubmit (may have submission_id without course_id)
  if (notification.related_submission_id && notification.type !== 'file_rejected') {
    // Check message for qualification indicators
    const isQualification = notificationMessage && /qualifi|level\s*\d+|diploma/i.test(notificationMessage);
    
    if (role === 'student') {
      if (isQualification) {
        // Try to find course from submission - for now, go to dashboard
        // The student can find it from their courses
        return `${dashboardPrefix}`;
      }
      return `${dashboardPrefix}/grades?submission=${notification.related_submission_id}`;
    } else if (role === 'tutor') {
      return `${dashboardPrefix}?submission=${notification.related_submission_id}`;
    }
  }

  // Assignment-related notifications (without IDs, try to parse message)
  if (notification.type === 'assignment_feedback' || 
      notification.type === 'assignment_resubmit' || 
      notification.type === 'assignment_submitted') {
    if (notificationMessage) {
      const courseInfo = extractCourseInfoFromMessage(notificationMessage);
      if (courseInfo?.isQualification && role === 'student') {
        // Navigate to qualification courses
        return `${dashboardPrefix}`;
      }
    }
    // Fallback to grades page
    if (role === 'student') {
      return `${dashboardPrefix}/grades`;
    }
  }

  // Certificate notifications
  if (notification.type === 'certificate_ready') {
    return `${dashboardPrefix}/certificates`;
  }

  // Payment notifications
  if (notification.type === 'payment_due' || notification.type === 'payment_success') {
    if (role === 'student') {
      return `${dashboardPrefix}`; // Student dashboard shows payment info
    }
  }

  // Quiz result notifications
  if (notification.type === 'quiz_result' || notification.type === 'quiz_graded') {
    if (notification.related_course_id) {
      const courseId = notification.related_course_id;
      // Check if qualification course
      if (notificationMessage && /qualifi|level\s*\d+|diploma/i.test(notificationMessage)) {
        return `${dashboardPrefix}/qualification/${courseId}/view`;
      }
      return `${dashboardPrefix}/courses/${courseId}`;
    }
    // Fallback
    if (role === 'student') {
      return `${dashboardPrefix}`;
    }
  }

  // Admin post / Forum post notifications
  if (notification.type === 'admin_post' || notification.type === 'forum_post') {
    return '/dashboard/forum';
  }

  // Forum reply/comment notifications
  if (notification.type === 'forum_reply' || 
      notification.type === 'post_comment' || 
      notification.type === 'post_reply') {
    return '/dashboard/forum';
  }

  // System/security notifications - navigate to dashboard
  if (notification.type === 'system' || notification.type === 'security') {
    return `${dashboardPrefix}`;
  }

  // Deadline warnings
  if (notification.type === 'deadline_warning' || notification.type === 'deadline_reminder') {
    return `${dashboardPrefix}`; // Dashboard shows deadlines
  }

  // Consultation (Zoom video booking) notifications
  if (notification.type === 'consultation_confirmed' || notification.type === 'consultation_cancelled') {
    const studentRoles = ['student', 'managerstudent', 'institutestudent'];
    if (studentRoles.includes(role)) {
      return '/dashboard/student/consultations';
    }
  }
  if (notification.type === 'consultation_new') {
    if (role === 'admin') {
      return '/dashboard/admin/consultations';
    }
  }

  // Default fallback: always navigate to dashboard (never return null)
  return `${dashboardPrefix}`;
}

/**
 * Navigate to notification target
 * Handles the actual navigation using Next.js router
 * Returns true if navigation was handled, false otherwise
 */
export function navigateToNotification(
  notification: NotificationNavigationData,
  router: AppRouterInstance,
  userRole?: string | null,
  notificationMessage?: string
): boolean {
  // Chat notifications should be filtered out before reaching here
  // But handle gracefully if they slip through
  if (notification.related_conversation_id || notification.type === 'chat' || notification.type === 'message') {
    // Chat notifications are handled by FloatingChatProvider in Navbar
    // Return false to indicate it should be handled elsewhere
    return false;
  }

  // Get navigation target (pass message for parsing)
  const target = getNotificationNavigationTarget(notification, userRole, notificationMessage);
  
  if (target) {
    // Use window.location for more reliable navigation
    if (typeof window !== 'undefined') {
      window.location.href = target;
    } else {
      router.push(target);
    }
    return true;
  }

  return false;
}
