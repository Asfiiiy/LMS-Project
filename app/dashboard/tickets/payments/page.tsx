'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import PaymentManagementView from '@/app/components/PaymentManagementView';
import PendingInstallmentsTab from '@/app/components/accounts/PendingInstallmentsTab';
import ReceivedInstallmentsTab from '@/app/components/accounts/ReceivedInstallmentsTab';
import ReminderLogsTab from '@/app/components/accounts/ReminderLogsTab';
import PaymentSettingsTab from '@/app/components/accounts/PaymentSettingsTab';
import { UserRole } from '@/app/components/types';

const PAYMENT_ACCESS_ROLES: UserRole[] = [
  'Admin', 'Operation Manager', 'Accounts Manager', 'Administrative Manager',
  'Admission Manager', 'Team Member', 'Certificate Manager'
];

const ACCOUNTS_TEAM_ROLES: UserRole[] = ['Accounts Manager', 'Team Member'];
const ACCOUNTS_MANAGER_ONLY: UserRole[] = ['Accounts Manager'];

export default function TicketsPaymentsPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'received' | 'logs' | 'settings'>('all');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const u = JSON.parse(localStorage.getItem('lms-user') || 'null');
      const role = (u?.role && typeof u.role === 'string') ? u.role.trim() : null;
      setUserRole(role as UserRole);
    } catch {
      setUserRole(null);
    }
    setAuthReady(true);
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (!userRole) return;
    if (!PAYMENT_ACCESS_ROLES.includes(userRole)) {
      router.push('/dashboard/tickets');
    }
  }, [authReady, userRole, router]);

  const showAccountsTabs = userRole && ACCOUNTS_TEAM_ROLES.includes(userRole);
  const showReminderLogs = userRole && ACCOUNTS_MANAGER_ONLY.includes(userRole);

  return (
    <ProtectedRoute allowedRoles={PAYMENT_ACCESS_ROLES} userRole={userRole} authReady={authReady}>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Payments</h1>

        {showAccountsTabs ? (
          <>
            <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-4 py-2 rounded-lg font-medium text-sm ${activeTab === 'all' ? 'bg-[#11CCEF] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                All Payments
              </button>
              <button
                onClick={() => setActiveTab('pending')}
                className={`px-4 py-2 rounded-lg font-medium text-sm ${activeTab === 'pending' ? 'bg-[#11CCEF] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                Pending Installments
              </button>
              <button
                onClick={() => setActiveTab('received')}
                className={`px-4 py-2 rounded-lg font-medium text-sm ${activeTab === 'received' ? 'bg-[#11CCEF] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                Received Installments
              </button>
              {showReminderLogs && (
                <>
                  <button
                    onClick={() => setActiveTab('logs')}
                    className={`px-4 py-2 rounded-lg font-medium text-sm ${activeTab === 'logs' ? 'bg-[#11CCEF] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  >
                    Reminder Logs
                  </button>
                  <button
                    onClick={() => setActiveTab('settings')}
                    className={`px-4 py-2 rounded-lg font-medium text-sm ${activeTab === 'settings' ? 'bg-[#11CCEF] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  >
                    ⚙️ Settings
                  </button>
                </>
              )}
            </div>

            {activeTab === 'all' && userRole && (
              <PaymentManagementView
                userRole={userRole as 'Admin' | 'Certificate Manager' | 'Accounts Manager' | 'Operation Manager' | 'Administrative Manager' | 'Admission Manager' | 'Team Member'}
              />
            )}
            {activeTab === 'pending' && <PendingInstallmentsTab />}
            {activeTab === 'received' && <ReceivedInstallmentsTab />}
            {activeTab === 'logs' && showReminderLogs && <ReminderLogsTab />}
            {activeTab === 'settings' && showReminderLogs && <PaymentSettingsTab />}
          </>
        ) : (
          <>
            <p className="text-gray-600 mb-4">
              View and manage payment installments across all students.
            </p>
            {userRole && (
              <PaymentManagementView
                userRole={userRole as 'Admin' | 'Certificate Manager' | 'Accounts Manager' | 'Operation Manager' | 'Administrative Manager' | 'Admission Manager' | 'Team Member'}
              />
            )}
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
