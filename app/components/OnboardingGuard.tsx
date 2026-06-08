'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { onboardingService } from '@/app/services/onboardingService';
import type { OnboardingStatus, EnrollmentType } from '@/app/types/onboarding.types';

interface OnboardingGuardProps {
  children: React.ReactNode;
}

export default function OnboardingGuard({ children }: OnboardingGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [enrollmentType, setEnrollmentType] = useState<EnrollmentType | null>(null);

  useEffect(() => {
    checkOnboardingStatus();
  }, [pathname]);

  const getStaffDashboardLink = (role: string): string | null => {
    if (['Admin', 'Assessor', 'Manager', 'Moderator', 'Certificate Manager', 'Claim Manager', 'Consultation Manager', 'Team Member'].includes(role)) {
      if (role === 'Admin') return '/dashboard/admin';
      if (role === 'Assessor') return '/dashboard/tutor';
      if (role === 'Manager') return '/dashboard/manager';
      if (role === 'Moderator') return '/dashboard/moderator';
      if (role === 'Certificate Manager') return '/dashboard/certificate-manager';
      if (role === 'Claim Manager') return '/dashboard/claim-manager';
      if (role === 'Consultation Manager') return '/dashboard/consultation-manager';
      if (role === 'Team Member') return '/dashboard/tickets';
    }
    if (['Operation Manager', 'Accounts Manager', 'Administrative Manager', 'Admission Manager'].includes(role)) {
      return '/dashboard/tickets';
    }
    return null;
  };

  const checkOnboardingStatus = async () => {
    try {
      const userStr = localStorage.getItem('lms-user');
      if (!userStr) {
        if (pathname?.startsWith('/onboarding')) {
          router.push('/');
        }
        setLoading(false);
        return;
      }

      const user = JSON.parse(userStr);
      const userRole = (typeof user.role === 'string' ? user.role : '').toLowerCase();
      const roleName = typeof user.role === 'string' ? user.role : '';

      // Staff should never see onboarding - redirect to their dashboard
      if (!['student', 'managerstudent', 'institutestudent'].includes(userRole)) {
        if (pathname?.startsWith('/onboarding')) {
          const dashboard = getStaffDashboardLink(roleName);
          router.replace(dashboard || '/dashboard/tickets');
          return; // Keep loading until redirect completes
        }
        setLoading(false);
        return;
      }

      // All /onboarding/* routes are reachable for students (including hasNone: manual qualification path).
      // Step order is enforced by each page + API; do not redirect away from onboarding based on enrollment here.
      if (pathname?.startsWith('/onboarding')) {
        setLoading(false);
        return;
      }

      // Skip onboarding redirect when admin is impersonating a student (show dashboard as-is)
      if (typeof window !== 'undefined' && localStorage.getItem('lms-impersonating')) {
        setLoading(false);
        return;
      }

      const response = await onboardingService.getStatus();
      
      if (response.success && response.status) {
        const onboardingStatus = response.status;
        setStatus(onboardingStatus);
        if (response.enrollment_type) {
          setEnrollmentType(response.enrollment_type);
        }

        if (pathname?.startsWith('/dashboard/student')) {
          if (!onboardingStatus.dashboard_access_granted) {
            const nextStep = getNextOnboardingStep(onboardingStatus, response.enrollment_type);
            router.push(`/onboarding/${nextStep}`);
            return;
          }
        }
      }

      setLoading(false);
    } catch (error) {
      setLoading(false);
    }
  };

  const getNextOnboardingStep = (status: OnboardingStatus, et?: EnrollmentType | null): string => {
    if (!status.welcome_completed) return 'welcome';
    // No enrollment (hasNone) or unknown type: after welcome, send to manual course-selection (qualification-only UI).
    if (!status.course_selection_completed && (!et || et.hasNone)) return 'course-selection';
    // Enrolled but auto-setup not applied yet — send back to welcome so Continue runs POST /auto-setup
    if (!status.course_selection_completed && et && !et.hasNone) return 'welcome';
    if (!status.qualification_selection_completed && status.current_step === 'qualification-level') {
      return 'qualification-level';
    }

    const isCpdOnly = et ? (et.hasCPD && !et.hasQualification) : false;

    if (!isCpdOnly && !status.documents_uploaded) return 'documents';
    if (!status.initial_assessment_completed) return 'initial-assessment';
    if (!isCpdOnly && !status.vark_assessment_completed) return 'vark-assessment';
    if (!isCpdOnly && !status.admin_verified) return 'verification-pending';
    return 'welcome';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#11CCEF] mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
