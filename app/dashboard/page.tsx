'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const u = localStorage.getItem('lms-user');
    if (!u) {
      router.replace('/login');
      return;
    }
    try {
      const user = JSON.parse(u);
      const role = (user?.role && typeof user.role === 'string') ? user.role.trim() : '';
      const r = role.toLowerCase();
      if (role === 'Admin' || r === 'admin') router.replace('/dashboard/admin');
      else if (role === 'Assessor' || r === 'assessor') router.replace('/dashboard/tutor');
      else if (role === 'Manager' || r === 'manager') router.replace('/dashboard/manager');
      else if (role === 'Moderator' || r === 'moderator') router.replace('/dashboard/moderator');
      else if (['Student', 'ManagerStudent', 'InstituteStudent'].includes(role) || r === 'student' || r === 'managerstudent' || r === 'institutestudent') router.replace('/dashboard/student');
      else if (role === 'Certificate Manager' || r === 'certificate manager') router.replace('/dashboard/certificate-manager');
      else if (['Operation Manager', 'Accounts Manager', 'Administrative Manager', 'Admission Manager', 'Team Member'].includes(role) || r === 'operation manager' || r === 'accounts manager' || r === 'administrative manager' || r === 'admission manager' || r === 'team member') router.replace('/dashboard/tickets');
      else router.replace('/dashboard/tickets');
    } catch {
      router.replace('/login');
    }
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-gray-500">Redirecting...</p>
    </div>
  );
}
