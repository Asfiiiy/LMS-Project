'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import StudentsProfileView from '@/app/components/StudentsProfileView';

const ALLOWED_ROLES = new Set(['Accounts Manager', 'Admin', 'Operation Manager']);

type ViewRole = 'Admin' | 'Accounts Manager' | 'Operation Manager';

export default function TicketsStudentsProfilePage() {
  const router = useRouter();
  const [viewRole, setViewRole] = useState<ViewRole | null>(null);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('lms-user') || '{}');
    if (!user?.role || !ALLOWED_ROLES.has(user.role)) {
      router.push('/dashboard/tickets');
      return;
    }
    const r = user.role as string;
    if (r === 'Admin') setViewRole('Admin');
    else if (r === 'Operation Manager') setViewRole('Operation Manager');
    else setViewRole('Accounts Manager');
  }, [router]);

  if (!viewRole) {
    return (
      <div
        style={{
          padding: '40px',
          textAlign: 'center',
          color: '#64748b',
          fontSize: '14px',
        }}
      >
        Loading...
      </div>
    );
  }

  return <StudentsProfileView userRole={viewRole} />;
}
