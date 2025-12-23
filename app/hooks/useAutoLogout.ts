'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { showSweetAlert } from '../components/SweetAlert';
import { getApiUrl } from '../utils/apiUrl';

const INACTIVITY_TIMEOUT = 20 * 60 * 1000; // 20 minutes in milliseconds
const WARNING_TIME = 60 * 1000; // 60 seconds before logout
const TOKEN_REFRESH_INTERVAL = 15 * 60 * 1000; // 15 minutes

export const useAutoLogout = () => {
  const router = useRouter();
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const warningShownRef = useRef<boolean>(false);

  // Perform logout
  const performLogout = useCallback(async (reason: 'inactivity' | 'token_expired' = 'inactivity') => {
    try {
      // Call backend logout endpoint to log the event
      const token = localStorage.getItem('lms-token');
      if (token) {
        await fetch(`${getApiUrl()}/api/login/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ reason })
        });
      }
    } catch (error) {
      console.error('Error logging auto-logout:', error);
    }

    // Clear storage and redirect
    localStorage.removeItem('lms-token');
    localStorage.removeItem('lms-user');
    localStorage.setItem('autoLogoutReason', reason);
    
    // Broadcast logout to other tabs
    localStorage.setItem('logout-event', Date.now().toString());
    
    router.push('/');
  }, [router]);

  // Show warning modal
  const showWarningModal = useCallback(() => {
    if (warningShownRef.current) return;
    warningShownRef.current = true;

    let countdown = 60;
    let countdownInterval: NodeJS.Timeout;

    const updateCountdown = () => {
      countdown--;
      if (countdown <= 0) {
        clearInterval(countdownInterval);
        performLogout('inactivity');
      }
    };

    showSweetAlert(
      'Session Expiring',
      `You've been inactive. You will be logged out in ${countdown} seconds.`,
      'warning',
      {
        showConfirmButton: true,
        confirmButtonText: 'Stay Logged In',
        showCancelButton: true,
        cancelButtonText: 'Logout Now',
        onConfirm: () => {
          clearInterval(countdownInterval);
          warningShownRef.current = false;
          resetTimers();
        },
        onCancel: () => {
          clearInterval(countdownInterval);
          performLogout('inactivity');
        }
      }
    );

    // Start countdown
    countdownInterval = setInterval(updateCountdown, 1000);
  }, [performLogout]);

  // Refresh token
  const refreshToken = useCallback(async () => {
    try {
      const token = localStorage.getItem('lms-token');
      if (!token) return;

      const response = await fetch(`${getApiUrl()}/api/login/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.token) {
          localStorage.setItem('lms-token', data.token);
          console.log('✅ Token refreshed successfully');
        }
      } else {
        // Token refresh failed, logout
        console.error('❌ Token refresh failed');
        performLogout('token_expired');
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      performLogout('token_expired');
    }
  }, [performLogout]);

  // Reset all timers
  const resetTimers = useCallback(() => {
    lastActivityRef.current = Date.now();

    // Clear existing timers
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
    }

    // Set warning timer (show warning 60 seconds before logout)
    warningTimerRef.current = setTimeout(() => {
      showWarningModal();
    }, INACTIVITY_TIMEOUT - WARNING_TIME);

    // Set inactivity timer (auto-logout after inactivity)
    inactivityTimerRef.current = setTimeout(() => {
      if (!warningShownRef.current) {
        performLogout('inactivity');
      }
    }, INACTIVITY_TIMEOUT);
  }, [showWarningModal, performLogout]);

  // Handle user activity
  const handleActivity = useCallback(() => {
    const now = Date.now();
    const timeSinceLastActivity = now - lastActivityRef.current;

    // Only reset if enough time has passed (debounce)
    if (timeSinceLastActivity > 1000) {
      resetTimers();
    }
  }, [resetTimers]);

  // Setup activity listeners and token refresh
  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('lms-token');
    if (!token) return;

    // Initial timer setup
    resetTimers();

    // Activity events to track
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    // Setup token refresh interval
    refreshTimerRef.current = setInterval(() => {
      refreshToken();
    }, TOKEN_REFRESH_INTERVAL);

    // Initial token refresh
    refreshToken();

    // Listen for logout events from other tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'logout-event') {
        // Another tab logged out, logout this tab too
        localStorage.removeItem('lms-token');
        localStorage.removeItem('lms-user');
        router.push('/');
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });

      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      if (warningTimerRef.current) {
        clearTimeout(warningTimerRef.current);
      }
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }

      window.removeEventListener('storage', handleStorageChange);
    };
  }, [handleActivity, resetTimers, refreshToken, router]);

  return null;
};

