'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import ToastContainer from './Toast';
import SweetAlertContainer from './SweetAlert';
import { AutoLogoutProvider } from './AutoLogoutProvider';
import { FloatingChatProvider } from './FloatingChatProvider';
import { FloatingTicketProvider } from './FloatingTicketProvider';
import { StudentFloatingTicketProvider } from './StudentFloatingTicketProvider';
import { SocketProvider } from '@/app/contexts/SocketContext';
import SupportQuickChat from './SupportQuickChat';
import GradePopupNotification from '@/app/components/GradePopupNotification';
import ImpersonationBanner from './ImpersonationBanner';
import { User } from './types';

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/' || pathname === '/login';
  const [user, setUser] = useState<User | null>(null);
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);

  // Load user when not on login page; also sync on auth events (login/auth-change) for immediate update after login
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isLoginPage) {
      setUser(null);
      setHasCheckedAuth(false);
      return;
    }
    const loadUser = () => {
      try {
        const userData: User | null = JSON.parse(localStorage.getItem('lms-user') || 'null');
        setUser(userData);
      } catch (e) {
        setUser(null);
      }
      setHasCheckedAuth(true);
    };
    loadUser();
    window.addEventListener('login', loadUser);
    window.addEventListener('auth-change', loadUser);
    return () => {
      window.removeEventListener('login', loadUser);
      window.removeEventListener('auth-change', loadUser);
    };
  }, [isLoginPage]);

  // Avoid rendering provider tree until we've checked auth - prevents client-side exception on first load after login
  const showDashboard = !isLoginPage && hasCheckedAuth;

  return (
    <>
      {showDashboard ? (
        <SocketProvider enabled={!!user}>
          <FloatingTicketProvider user={user}>
            <ImpersonationBanner />
            <Navbar />
            <AutoLogoutProvider>
              <FloatingChatProvider user={user}>
                <StudentFloatingTicketProvider user={user}>
                  <main className="flex-1 w-full overflow-x-hidden">{children}</main>
                  <SupportQuickChat user={user} />
                  {user && user.role === 'Student' && (
                    <GradePopupNotification
                      userId={user.id}
                      userRole={user.role}
                    />
                  )}
                </StudentFloatingTicketProvider>
              </FloatingChatProvider>
            </AutoLogoutProvider>
          </FloatingTicketProvider>
        </SocketProvider>
      ) : (
        <main className="flex-1 w-full overflow-x-hidden">{children}</main>
      )}
      {showDashboard && <Footer />}
      <ToastContainer />
      <SweetAlertContainer />
    </>
  );
}

