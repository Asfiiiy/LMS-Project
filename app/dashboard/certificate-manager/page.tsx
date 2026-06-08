'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import CertificateClaimsManagement from '@/app/components/CertificateClaimsManagement';
import CertificateTemplateManager from '@/app/components/CertificateTemplateManager';
import GeneratedCertificatesManagement from '@/app/components/GeneratedCertificatesManagement';
import PaymentManagementView from '@/app/components/PaymentManagementView';
import StudentsProfileView from '@/app/components/StudentsProfileView';
import CertificateQueriesView from '@/app/components/CertificateQueriesView';
import { UserRole } from '@/app/components/types';

// Top: ticket dashboard + chat (same as tickets layout)
const topNav = [
  { id: 'certificate-queries', name: 'Ticket Dashboard', icon: '🎫' },
  { id: 'chat', name: 'Chat', icon: '💬', href: '/dashboard/tickets/chat' },
];
// Below: Certificates, Payments, Students Profile, Certificate Templates
const tabsBelow = [
  { id: 'certificates', name: 'Certificates', icon: '🏆' },
  { id: 'payments', name: 'Payments', icon: '💳' },
  { id: 'students-profile', name: 'Students Profile', icon: '👤' },
  { id: 'certificate-templates', name: 'Certificate Templates', icon: '📄' },
  { id: 'generated-certificates', name: 'Generated Certificates', icon: '📜' },
];

export default function CertificateManagerDashboard() {
  const pathname = usePathname();
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [authReady, setAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState('certificate-queries');
  const [navCollapsed, setNavCollapsed] = useState(false);
  const isOnChatPage = pathname === '/dashboard/tickets/chat';

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

  return (
    <ProtectedRoute allowedRoles={['Certificate Manager']} userRole={userRole} authReady={authReady}>
      <div className="min-h-screen bg-gray-50 w-full overflow-x-hidden">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200 w-full">
          <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Certificate Department</h1>
                <p className="text-gray-600 mt-1">Manage certificate claims, templates, and generated certificates</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center text-white font-semibold">
                  🏆
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex w-full overflow-x-hidden">
          {/* Sidebar - toggle to collapse/expand */}
          <div
            className={`flex-shrink-0 bg-white shadow-sm min-h-screen border-r border-gray-200 transition-[width] duration-200 ${
              navCollapsed ? 'w-16' : 'w-64'
            }`}
          >
            <nav className="p-4">
              <div className={`flex items-center mb-4 ${navCollapsed ? 'justify-center' : 'justify-between'}`}>
                {!navCollapsed && (
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                    Navigation
                  </h2>
                )}
                <button
                  type="button"
                  onClick={() => setNavCollapsed((c) => !c)}
                  className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors flex-shrink-0"
                  aria-label={navCollapsed ? 'Expand navigation' : 'Collapse navigation'}
                  title={navCollapsed ? 'Expand navigation' : 'Collapse navigation'}
                >
                  <svg
                    className={`w-5 h-5 transition-transform duration-200 ${navCollapsed ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                  </svg>
                </button>
              </div>
              <ul className="space-y-1">
                {/* Top: Ticket Dashboard + Chat (same as tickets layout) */}
                {topNav.map((tab) =>
                  (tab as { href?: string }).href ? (
                    <li key={tab.id}>
                      <Link
                        href={(tab as { href: string }).href}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                          navCollapsed ? 'justify-center px-0' : ''
                        } ${isOnChatPage && tab.id === 'chat' ? 'bg-[#11CCEF] text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                        title={navCollapsed ? tab.name : undefined}
                      >
                        <span className="text-lg flex-shrink-0">{tab.icon}</span>
                        {!navCollapsed && <span className="font-medium truncate">{tab.name}</span>}
                      </Link>
                    </li>
                  ) : (
                    <li key={tab.id}>
                      <button
                        onClick={() => setActiveTab(tab.id)}
                        className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-3 ${
                          navCollapsed ? 'justify-center px-0' : ''
                        } ${activeTab === tab.id ? 'bg-[#11CCEF] text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                        title={navCollapsed ? tab.name : undefined}
                      >
                        <span className="text-lg flex-shrink-0">{tab.icon}</span>
                        {!navCollapsed && <span className="font-medium truncate">{tab.name}</span>}
                      </button>
                    </li>
                  )
                )}
                <li className="pt-2 mt-2 border-t border-gray-200">
                  {!navCollapsed && (
                    <span className="px-4 pt-2 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Certificate
                    </span>
                  )}
                </li>
                {/* Below: Certificates, Payments, Students Profile, Certificate Templates */}
                {tabsBelow.map((tab) => (
                  <li key={tab.id}>
                    <button
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-3 ${
                        navCollapsed ? 'justify-center px-0' : ''
                      } ${activeTab === tab.id ? 'bg-[#11CCEF] text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                      title={navCollapsed ? tab.name : undefined}
                    >
                      <span className="text-lg flex-shrink-0">{tab.icon}</span>
                      {!navCollapsed && <span className="font-medium truncate">{tab.name}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1 p-4 sm:p-6 min-w-0 overflow-x-hidden w-full">
            {activeTab === 'certificates' && <CertificateClaimsManagement />}
            {activeTab === 'certificate-queries' && <CertificateQueriesView />}
            {activeTab === 'payments' && <PaymentManagementView userRole="Certificate Manager" />}
            {activeTab === 'students-profile' && <StudentsProfileView userRole="Certificate Manager" />}
            {activeTab === 'certificate-templates' && <CertificateTemplateManager />}
            {activeTab === 'generated-certificates' && <GeneratedCertificatesManagement />}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
