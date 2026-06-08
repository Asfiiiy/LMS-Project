'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { UserRole } from '@/app/components/types';

export default function ClaimManagerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const u = localStorage.getItem('lms-user');
    if (u) {
      try {
        const user = JSON.parse(u);
        setUserRole((user.role as UserRole) || null);
      } catch {
        setUserRole(null);
      }
    }
    setAuthReady(true);
  }, []);

  const isStudentDetail = pathname?.match(/\/dashboard\/claim-manager\/students\/\d+$/);

  return (
    <ProtectedRoute allowedRoles={['Claim Manager', 'Admin']} userRole={userRole} authReady={authReady}>
      <div className="min-h-screen bg-gray-50 w-full overflow-x-hidden">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200 w-full">
          <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {isStudentDetail && (
                  <Link
                    href="/dashboard/claim-manager"
                    className="flex items-center gap-2 text-gray-600 hover:text-[#11CCEF] transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    <span className="text-sm font-medium">Back to Dashboard</span>
                  </Link>
                )}
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Claim Manager</h1>
                  <p className="text-gray-600 mt-1">
                    {isStudentDetail ? 'Student submissions and downloads' : 'Manage completed qualification students and claims'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-semibold bg-gradient-to-r from-[#11CCEF] to-[#E51791]">
                  📋
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </div>
    </ProtectedRoute>
  );
}
