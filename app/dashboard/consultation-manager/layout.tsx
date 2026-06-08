'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { useSocket } from '@/app/contexts/SocketContext';
import { apiService } from '@/app/services/api';
import { UserRole } from '@/app/components/types';
import { FiMenu, FiX, FiLogOut, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

const CM_SIDEBAR_COLLAPSED_KEY = 'lms-cm-sidebar-collapsed';

function ConsultationManagerLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const socket = useSocket();
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [authReady, setAuthReady] = useState(false);
  const [userName, setUserName] = useState('');
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [isEnabled, setIsEnabled] = useState(true);
  const [disabledMessage, setDisabledMessage] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(CM_SIDEBAR_COLLAPSED_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(CM_SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    const u = localStorage.getItem('lms-user');
    if (u) {
      try {
        const parsed = JSON.parse(u);
        setUserRole((parsed.role as UserRole) || null);
        setUserName(parsed.name || '');
      } catch {
        setUserRole(null);
      }
    }
    setAuthReady(true);
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (userRole !== 'Consultation Manager') {
      setLoadingSettings(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await apiService.getConsultationManagerSettings();
        if (!cancelled && data?.success) {
          setIsEnabled(!!data.is_enabled);
          setDisabledMessage(data.disabled_message || '');
        }
      } catch {
        if (!cancelled) setIsEnabled(true);
      } finally {
        if (!cancelled) setLoadingSettings(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authReady, userRole]);

  useEffect(() => {
    if (!socket) return;
    const onToggle = (data: { is_enabled: boolean; disabled_message: string }) => {
      setIsEnabled(!!data.is_enabled);
      setDisabledMessage(data.disabled_message || '');
    };
    socket.on('consultation_manager_toggle', onToggle);
    return () => {
      socket.off('consultation_manager_toggle', onToggle);
    };
  }, [socket]);

  const handleLogout = () => {
    localStorage.removeItem('lms-user');
    localStorage.removeItem('lms-token');
    window.location.href = '/';
  };

  const cmLocked = userRole === 'Consultation Manager' && !loadingSettings && !isEnabled;

  const nav = [
    { href: '/dashboard/consultation-manager', label: 'Dashboard', icon: '🏠' },
    { href: '/dashboard/consultation-manager/today', label: "Today's Calls", icon: '📅' },
    { href: '/dashboard/consultation-manager/bookings', label: 'All Bookings', icon: '📋' },
    { href: '/dashboard/consultation-manager/slots', label: 'All Slots', icon: '🗓️' }
  ];

  if (authReady && userRole === 'Consultation Manager' && loadingSettings) {
    return (
      <div className="min-h-screen bg-[#f0f6ff] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#11CCEF] border-t-[#E51791] rounded-full animate-spin" />
      </div>
    );
  }

  if (cmLocked) {
    return (
      <ProtectedRoute allowedRoles={['Consultation Manager', 'Admin']} userRole={userRole} authReady={authReady}>
        <div className="min-h-screen bg-[#f0f6ff] flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-10 text-center border border-gray-100">
            <div className="text-5xl mb-4" aria-hidden>
              🔒
            </div>
            <h1 className="text-xl font-bold text-[#0f172a] mb-3">Portal Temporarily Unavailable</h1>
            <p className="text-sm text-[#64748b] whitespace-pre-wrap">{disabledMessage}</p>
            <p className="text-xs text-[#64748b] mt-6">Please contact your administrator if you believe this is an error.</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['Consultation Manager', 'Admin']} userRole={userRole} authReady={authReady}>
      <div className="flex min-h-screen bg-[#f0f6ff]">
        <div
          className={`fixed inset-0 z-40 bg-black/50 lg:hidden ${mobileOpen ? '' : 'hidden'}`}
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
        <aside
          className={`fixed lg:static inset-y-0 left-0 z-50 w-64 flex-shrink-0 bg-[#0f172a] text-white transform transition-transform lg:translate-x-0 ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          } ${sidebarCollapsed ? 'lg:hidden' : ''}`}
        >
          <div className="h-16 flex items-center justify-between gap-2 px-4 border-b border-white/10">
            <Link href="/dashboard/consultation-manager" className="font-bold text-[#11CCEF] truncate min-w-0">
              Inspire LMS
            </Link>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                className="hidden lg:inline-flex p-2 rounded-lg text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                onClick={() => setSidebarCollapsed(true)}
                aria-label="Hide sidebar"
                title="Hide sidebar"
              >
                <FiChevronLeft className="w-5 h-5" />
              </button>
              <button type="button" className="lg:hidden text-white/80 p-1" onClick={() => setMobileOpen(false)} aria-label="Close menu">
                <FiX className="w-6 h-6" />
              </button>
            </div>
          </div>
          <p className="px-4 py-2 text-xs text-white/50 uppercase tracking-wider">Consultation Manager</p>
          <nav className="p-3 space-y-1">
            {nav.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== '/dashboard/consultation-manager' && pathname.startsWith(item.href));
              return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  active ? 'bg-[#11CCEF]/20 text-[#11CCEF]' : 'text-white/80 hover:bg-white/5'
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
            })}
          </nav>
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#11CCEF] to-[#E51791] flex items-center justify-center text-sm font-bold">
                {userName.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{userName || 'User'}</p>
                <p className="text-xs text-white/50 truncate">{userRole}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm text-white/70 hover:text-white"
            >
              <FiLogOut className="w-4 h-4" />
              Log out
            </button>
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="lg:hidden flex items-center justify-between h-14 px-4 bg-[#0f172a] text-white">
            <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <FiMenu className="w-6 h-6" />
            </button>
            <span className="font-semibold text-[#11CCEF]">Consultations</span>
            <span className="w-6" />
          </header>
          {sidebarCollapsed && (
            <div className="hidden lg:flex items-center h-12 px-4 sm:px-6 bg-white/90 border-b border-slate-200/90 backdrop-blur-sm shrink-0">
              <button
                type="button"
                onClick={() => setSidebarCollapsed(false)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-[#0f172a] bg-slate-100 hover:bg-slate-200 transition-colors"
                aria-label="Show sidebar"
                title="Show sidebar"
              >
                <FiChevronRight className="w-5 h-5 text-[#11CCEF]" />
                Sidebar
              </button>
            </div>
          )}
          <main className="flex-1 w-full min-w-0 max-w-full p-4 sm:p-6 lg:p-8 overflow-x-hidden">{children}</main>
        </div>
      </div>
    </ProtectedRoute>
  );
}

export default function ConsultationManagerLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f0f6ff] flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-[#11CCEF] border-t-[#E51791] rounded-full animate-spin" />
        </div>
      }
    >
      <ConsultationManagerLayoutInner>{children}</ConsultationManagerLayoutInner>
    </Suspense>
  );
}
