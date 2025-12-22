'use client';

import { ReactNode } from 'react';
import { UserRole } from './types';

interface ProtectedRouteProps {
  allowedRoles: UserRole[];
  userRole: UserRole | null;
  children: ReactNode;
}

const ProtectedRoute = ({ allowedRoles, userRole, children }: ProtectedRouteProps) => {
  if (!userRole || !allowedRoles.includes(userRole)) {
    return (
      <div className="p-4 text-center text-red-600 font-bold">
        Access Denied: You do not have permission to view this page.
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
