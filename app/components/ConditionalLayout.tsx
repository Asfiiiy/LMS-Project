'use client';

import { usePathname } from 'next/navigation';
import Navbar from './Navbar';
import Footer from './Footer';
import ToastContainer from './Toast';
import SweetAlertContainer from './SweetAlert';
import { AutoLogoutProvider } from './AutoLogoutProvider';

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/' || pathname === '/login';

  return (
    <>
      {!isLoginPage && <Navbar />}
      {!isLoginPage && <AutoLogoutProvider />}
      <main className="flex-1 w-full overflow-x-hidden">{children}</main>
      {!isLoginPage && <Footer />}
      <ToastContainer />
      <SweetAlertContainer />
    </>
  );
}

