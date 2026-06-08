'use client';

import { useState, useEffect } from 'react';
import { apiService } from '@/app/services/api';

export default function ImpersonationBanner() {
  const [impersonating, setImpersonating] = useState<{ name: string; role: string } | null>(null);
  const [switching, setSwitching] = useState(false);

  const checkImpersonating = () => {
    if (typeof window === 'undefined') return;
    const data = localStorage.getItem('lms-impersonating');
    if (data) {
      try {
        setImpersonating(JSON.parse(data));
      } catch {
        setImpersonating(null);
      }
    } else {
      setImpersonating(null);
    }
  };

  useEffect(() => {
    checkImpersonating();
    window.addEventListener('auth-change', checkImpersonating);
    window.addEventListener('login', checkImpersonating);
    return () => {
      window.removeEventListener('auth-change', checkImpersonating);
      window.removeEventListener('login', checkImpersonating);
    };
  }, []);

  const handleSwitchBack = async () => {
    if (switching) return;
    setSwitching(true);
    try {
      const res = await apiService.stopImpersonation();
      if (res?.success && res.token && res.user) {
        const { persistLoginCredentials } = await import('@/app/utils/authStorage');
        persistLoginCredentials(res.token, JSON.stringify(res.user));
        try {
          localStorage.removeItem('lms-impersonating');
        } catch {
          /* ignore */
        }
        // No auth-change dispatch: full reload loads fresh session and avoids mid-navigation state chaos
        window.location.href = '/dashboard/admin';
      } else {
        alert('Failed to restore admin session. Please log in again.');
        window.location.href = '/logout';
      }
    } catch (err) {
      alert('Failed to restore admin session. Please log in again.');
      window.location.href = '/logout';
    } finally {
      setSwitching(false);
    }
  };

  if (!impersonating) return null;

  return (
    <div className="sticky top-0 left-0 right-0 z-[9999] bg-amber-500 text-amber-950 px-4 py-2 border-b-2 border-amber-600 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <span className="font-semibold text-sm sm:text-base">
          You are currently logged in as <strong>{impersonating.name}</strong> ({impersonating.role})
        </span>
        <button
          onClick={handleSwitchBack}
          disabled={switching}
          className="px-4 py-2 bg-amber-900 text-white font-semibold rounded-lg hover:bg-amber-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm whitespace-nowrap"
        >
          {switching ? 'Switching...' : 'Switch Back to Admin'}
        </button>
      </div>
    </div>
  );
}
