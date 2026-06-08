'use client';

import { ReactNode, useEffect, useState } from 'react';
import { UserRole } from './types';

const loadingEl = (
  <div className="min-h-[200px] flex items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 border-2 border-[#11CCEF] border-t-transparent rounded-full animate-spin" />
      <p className="text-gray-500 text-sm">Loading...</p>
    </div>
  </div>
);

interface ProtectedRouteProps {
  allowedRoles: UserRole[];
  userRole: UserRole | null;
  /** Set true after reading user/role from storage; when false, shows loading to avoid Access Denied flash on refresh */
  authReady?: boolean;
  children: ReactNode;
}

const ProtectedRoute = ({ allowedRoles, userRole, authReady = true, children }: ProtectedRouteProps) => {
  // After mount, allow a short delay before treating null userRole as "not allowed" (avoids flash on refresh)
  const [allowDeny, setAllowDeny] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAllowDeny(true), 1200);
    return () => clearTimeout(t);
  }, []);

  // Before auth is ready (e.g. right after refresh), show loading instead of Access Denied
  if (authReady === false) {
    return loadingEl;
  }

  // Role not yet loaded (e.g. first paint after refresh): show loading until we've had time to read localStorage
  if (userRole == null) {
    if (!allowDeny) return loadingEl;
    return (
      <div className="p-4 text-center text-red-600 font-bold">
        Access Denied: You do not have permission to view this page.
      </div>
    );
  }

  if (!allowedRoles.includes(userRole)) {
    return (
      <div className="p-4 text-center text-red-600 font-bold">
        Access Denied: You do not have permission to view this page.
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
