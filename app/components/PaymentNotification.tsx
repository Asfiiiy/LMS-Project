'use client';

import { useState, useEffect } from 'react';
import { apiService } from '@/app/services/api';

interface PaymentInstallment {
  id: number;
  course_id: number;
  course_title: string;
  installment_number: number;
  installment_name: string;
  amount: number;
  due_date: string | null;
  status: 'paid' | 'due' | 'overdue';
  paid_at: string | null;
  payment_reference: string | null;
}

interface PaymentNotificationProps {
  userId: number;
}

const PaymentNotification = ({ userId }: PaymentNotificationProps) => {
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    type: 'overdue' | 'upcoming';
    message: string;
    courseTitle: string;
    daysRemaining?: number;
    amount: number;
  }>>([]);
  const [showNotification, setShowNotification] = useState(true);
  const [hasShownInitialNotifications, setHasShownInitialNotifications] = useState(false);

  // Get notification count from localStorage
  const getNotificationCount = (paymentId: string): number => {
    if (typeof window === 'undefined') return 0;
    const stored = localStorage.getItem(`payment_notification_${paymentId}`);
    return stored ? parseInt(stored, 10) : 0;
  };

  // Increment notification count in localStorage
  const incrementNotificationCount = (paymentId: string): number => {
    if (typeof window === 'undefined') return 0;
    const currentCount = getNotificationCount(paymentId);
    const newCount = currentCount + 1;
    localStorage.setItem(`payment_notification_${paymentId}`, newCount.toString());
    return newCount;
  };

  // Check if this is a new login session
  const isNewLoginSession = (): boolean => {
    if (typeof window === 'undefined') return false;
    const lastLoginTime = localStorage.getItem('last_login_time');
    const now = Date.now();
    
    // If no last login time or more than 1 hour has passed, consider it a new session
    if (!lastLoginTime) {
      localStorage.setItem('last_login_time', now.toString());
      return true;
    }
    
    const timeDiff = now - parseInt(lastLoginTime, 10);
    // Consider new session if more than 1 hour has passed
    if (timeDiff > 3600000) { // 1 hour in milliseconds
      localStorage.setItem('last_login_time', now.toString());
      return true;
    }
    
    return false;
  };

  useEffect(() => {
    // Fetch notifications on initial load (after login)
    // Always fetch once when component mounts, regardless of session
    if (!hasShownInitialNotifications && userId) {
      console.log('[PaymentNotification] Fetching notifications on mount:', { userId, hasShownInitialNotifications });
      fetchPaymentNotifications();
      setHasShownInitialNotifications(true);
    }
  }, [userId, hasShownInitialNotifications]);

  const fetchPaymentNotifications = async () => {
    try {
      console.log('[PaymentNotification] Fetching payment installments...');
      const response = await apiService.getStudentInstallments();
      console.log('[PaymentNotification] API Response:', response);
      
      if (!response?.success) {
        console.log('[PaymentNotification] API call failed or no success flag');
        return;
      }
      
      if (!response.installments || (Array.isArray(response.installments) && response.installments.length === 0)) {
        console.log('[PaymentNotification] No installments found');
        return;
      }

      // Flatten installments from all courses
      const allInstallments: PaymentInstallment[] = [];
      response.installments.forEach((courseGroup: any) => {
        if (courseGroup.installments && Array.isArray(courseGroup.installments)) {
          courseGroup.installments.forEach((inst: any) => {
            allInstallments.push({
              ...inst,
              course_title: courseGroup.course_title || inst.course_title || 'Unknown Course',
              course_id: courseGroup.course_id || inst.course_id
            });
          });
        }
      });

      const newNotifications: Array<{
        id: string;
        type: 'overdue' | 'upcoming';
        message: string;
        courseTitle: string;
        daysRemaining?: number;
        amount: number;
      }> = [];

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      console.log('[PaymentNotification] Processing installments:', allInstallments.length);
      
      allInstallments.forEach((inst) => {
        // Only show notifications for due/overdue payments, not paid ones
        if (inst.status === 'paid') {
          return; // Skip paid payments
        }

        const paymentId = `payment-${inst.id}`;
        const notificationCount = getNotificationCount(paymentId);
        
        console.log('[PaymentNotification] Processing installment:', {
          id: inst.id,
          status: inst.status,
          due_date: inst.due_date,
          notificationCount
        });

        // Only show notification if it hasn't been shown 3 times yet
        if (notificationCount >= 3) {
          console.log('[PaymentNotification] Skipping - already shown 3 times:', paymentId);
          return; // Skip if already shown 3 times
        }

        // Check for overdue payments
        if (inst.status === 'overdue') {
          const newCount = incrementNotificationCount(paymentId);
          if (newCount <= 3) {
            console.log('[PaymentNotification] Adding overdue notification (status=overdue):', inst.id);
            newNotifications.push({
              id: `overdue-${inst.id}`,
              type: 'overdue',
              message: `Overdue Payment: Your ${inst.installment_name} for ${inst.course_title} is overdue. Please make payment immediately.`,
              courseTitle: inst.course_title,
              amount: inst.amount
            });
          }
        }

        // Check for due payments with due_date
        if (inst.status === 'due' && inst.due_date) {
          const dueDate = new Date(inst.due_date);
          dueDate.setHours(0, 0, 0, 0);
          
          // Check if overdue (due date in the past)
          if (dueDate < today) {
            const newCount = incrementNotificationCount(paymentId);
            if (newCount <= 3) {
              console.log('[PaymentNotification] Adding overdue notification (past due date):', inst.id);
              newNotifications.push({
                id: `overdue-${inst.id}`,
                type: 'overdue',
                message: `Overdue Payment: Your ${inst.installment_name} for ${inst.course_title} is overdue. Please make payment immediately.`,
                courseTitle: inst.course_title,
                amount: inst.amount
              });
            }
          } else {
            // Show notification if due date is today or in the future (within 7 days)
            const diffTime = dueDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays <= 7 && diffDays >= 0) {
              const newCount = incrementNotificationCount(paymentId);
              if (newCount <= 3) {
                console.log('[PaymentNotification] Adding upcoming notification:', inst.id, diffDays);
                newNotifications.push({
                  id: `upcoming-${inst.id}`,
                  type: 'upcoming',
                  message: `Upcoming Payment: Your ${inst.installment_name} for ${inst.course_title} is due in ${diffDays} ${diffDays === 1 ? 'day' : 'days'}.`,
                  courseTitle: inst.course_title,
                  daysRemaining: diffDays,
                  amount: inst.amount
                });
              }
            }
          }
        } else if (inst.status === 'due' && !inst.due_date) {
          // If status is 'due' but no due_date, show as due payment
          const newCount = incrementNotificationCount(paymentId);
          if (newCount <= 3) {
            console.log('[PaymentNotification] Adding due notification (no due date):', inst.id);
            newNotifications.push({
              id: `upcoming-${inst.id}`,
              type: 'upcoming',
              message: `Due Payment: Your ${inst.installment_name} for ${inst.course_title} is due. Please make payment.`,
              courseTitle: inst.course_title,
              amount: inst.amount
            });
          }
        }
      });
      
      console.log('[PaymentNotification] New notifications to show:', newNotifications.length);

      // Update notifications, keeping only the most recent ones
      if (newNotifications.length > 0) {
        console.log('[PaymentNotification] Setting notifications:', newNotifications);
        setNotifications(prev => {
          // Remove duplicates and keep latest
          const existingIds = new Set(prev.map(n => n.id));
          const uniqueNew = newNotifications.filter(n => !existingIds.has(n.id));
          const finalNotifications = [...prev, ...uniqueNew].slice(-5); // Keep last 5 notifications
          console.log('[PaymentNotification] Final notifications:', finalNotifications);
          return finalNotifications;
        });
        setShowNotification(true);
      } else {
        console.log('[PaymentNotification] No new notifications to show');
      }
    } catch (error) {
      console.error('Error fetching payment notifications:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'overdue':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'upcoming':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'overdue':
        return '⚠️';
      case 'upcoming':
        return '📅';
      default:
        return 'ℹ️';
    }
  };

  if (!showNotification || notifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-3 max-w-md">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`${getNotificationColor(notification.type)} border-2 rounded-lg p-4 shadow-lg animate-slide-in-right`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{getNotificationIcon(notification.type)}</span>
                <h4 className="font-bold text-sm">
                  {notification.type === 'overdue' && 'Payment Overdue'}
                  {notification.type === 'upcoming' && 'Payment Reminder'}
                </h4>
              </div>
              <p className="text-sm mb-1">{notification.message}</p>
              <p className="text-xs font-semibold mt-1">
                Amount: {formatCurrency(notification.amount)}
              </p>
              {notification.daysRemaining && (
                <p className="text-xs mt-1 font-semibold">
                  {notification.daysRemaining} {notification.daysRemaining === 1 ? 'day' : 'days'} remaining
                </p>
              )}
            </div>
            <button
              onClick={() => {
                setNotifications(prev => prev.filter(n => n.id !== notification.id));
              }}
              className="ml-2 text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
          </div>
        </div>
      ))}
      <style jsx>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default PaymentNotification;

