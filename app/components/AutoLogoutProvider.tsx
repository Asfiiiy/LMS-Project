'use client';

import { useAutoLogout } from '../hooks/useAutoLogout';

export const AutoLogoutProvider = ({ children }: { children: React.ReactNode }) => {
  useAutoLogout();
  return <>{children}</>;
};

