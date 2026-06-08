'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { UserRole } from '@/app/components/types';
import OverviewTab from './_components/OverviewTab';
import SettingsTab from './_components/SettingsTab';
import BackupFilesTab from './_components/BackupFilesTab';
import BackupHistoryTab from './_components/BackupHistoryTab';

const TABS = [
  { id: 'overview',  label: 'Overview',        icon: '📊' },
  { id: 'settings',  label: 'Settings',        icon: '⚙️' },
  { id: 'files',     label: 'Backup Files',    icon: '🗄️' },
  { id: 'history',   label: 'Backup History',  icon: '📋' },
] as const;

type TabId = typeof TABS[number]['id'];

export default function BackupDashboard() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [authReady, setAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('lms-user') || 'null');
    setUserRole(user?.role || null);
    setAuthReady(true);
  }, []);

  return (
    <ProtectedRoute allowedRoles={['Admin']} userRole={userRole} authReady={authReady}>
      <div className="min-h-screen bg-gray-50">
        {/* Header + Tab Navigation */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/dashboard/admin')}
                className="text-gray-500 hover:text-gray-700 transition-colors"
                title="Back to Admin"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Database Backup</h1>
                <p className="text-gray-500 text-sm mt-0.5">Manage and schedule automatic database backups</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="px-4 sm:px-6 lg:px-8">
            <nav className="flex gap-0.5 -mb-px overflow-x-auto">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-[#11CCEF] text-[#11CCEF]'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="mr-1.5">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="px-4 sm:px-6 lg:px-8 py-6">
          {activeTab === 'overview' && <OverviewTab />}
          {activeTab === 'settings' && <SettingsTab />}
          {activeTab === 'files'    && <BackupFilesTab />}
          {activeTab === 'history'  && <BackupHistoryTab />}
        </div>
      </div>
    </ProtectedRoute>
  );
}
