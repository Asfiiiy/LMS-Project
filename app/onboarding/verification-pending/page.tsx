'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onboardingService } from '@/app/services/onboardingService';
import { apiService } from '@/app/services/api';
import VerificationCountdown from '@/app/components/VerificationCountdown';
import { CheckCircle2, Clock, FileCheck } from 'lucide-react';
import type { OnboardingStatus } from '@/app/types/onboarding.types';

export default function VerificationPendingPage() {
  const router = useRouter();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasCheckedDocuments, setHasCheckedDocuments] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [redirectReason, setRedirectReason] = useState<'verified' | 'resubmit' | null>(null);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 8000); // Check every 8 seconds for quick auto-redirect when admin verifies
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    // Don't do anything if we're already redirecting
    if (isRedirecting) return;

    try {
      const response = await onboardingService.getStatus();
      if (response.success && response.status) {
        setStatus(response.status);
        
        // If admin verified and dashboard access granted, redirect
        if (response.status.dashboard_access_granted) {
          setRedirectReason('verified');
          setIsRedirecting(true);
          router.push('/dashboard/student');
          return;
        }
      }

      // Check if there are any rejected documents - only run this check ONCE
      if (!hasCheckedDocuments && loading) {
        setHasCheckedDocuments(true); // Mark as checked immediately to prevent duplicate checks
        
        try {
          const docsData = await apiService.getMyDocuments();
          
          // If any documents are rejected, redirect to resubmit page
          if (docsData.success && docsData.documents) {
            const hasRejectedDocs = docsData.documents.some((doc: any) => doc.status === 'rejected');
            if (hasRejectedDocs) {
              if (process.env.NODE_ENV === 'development') {
                console.log('Rejected documents found, redirecting to resubmit page');
              }
              setRedirectReason('resubmit');
              setIsRedirecting(true);
              router.replace('/onboarding/resubmit');
              return;
            }
          }
        } catch (docError) {
          // Don't redirect on error, just show verification pending
        }
      }

      setLoading(false);
    } catch (error) {
      setLoading(false);
    }
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

  if (isRedirecting) {
    const isVerified = redirectReason === 'verified';
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <CheckCircle2 className={`w-16 h-16 mx-auto mb-4 ${isVerified ? 'text-green-600' : 'text-[#11CCEF]'}`} />
          <p className="text-gray-900 text-xl font-semibold mb-2">
            {isVerified ? "You're verified!" : 'Documents need attention'}
          </p>
          <p className="text-gray-600">
            {isVerified ? 'Redirecting to your dashboard and courses...' : 'Redirecting to document resubmission...'}
          </p>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#11CCEF] mx-auto mt-4"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-3xl w-full">
        {/* Header Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6 border-t-4 border-[#E51791]">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-[#11CCEF] bg-opacity-10 rounded-full mb-4">
              <Clock className="w-10 h-10 text-[#11CCEF]" />
            </div>
            <h1 className="text-3xl font-bold text-[#1E1E1E] mb-2">
              Application Under Review
            </h1>
            <p className="text-[#7A7A7A] text-lg">
              Thank you for completing your application! Our team is currently reviewing your documents.
            </p>
          </div>
        </div>

        {/* Status Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <div className="space-y-6">
            {/* Verification in Progress */}
            <div className="flex items-start space-x-4 p-4 bg-[#11CCEF] bg-opacity-5 rounded-xl">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-[#11CCEF] bg-opacity-20 rounded-full flex items-center justify-center">
                  <FileCheck className="w-6 h-6 text-[#11CCEF]" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-[#1E1E1E] mb-1">
                  Verification in Progress
                </h3>
                <p className="text-[#7A7A7A]">
                  Your application is currently being reviewed by our Admissions and Compliance Team.
                </p>
              </div>
            </div>

            {/* What Happens Next */}
            <div className="border-t pt-6">
              <h3 className="text-xl font-bold text-[#1E1E1E] mb-4">What Happens Next?</h3>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-2 h-2 bg-[#E51791] rounded-full"></div>
                  </div>
                  <div>
                    <p className="font-semibold text-[#1E1E1E]">Document Review</p>
                    <p className="text-[#54595F] text-sm mt-0.5">
                      Our team will review your submitted documents, including identification and qualification records.
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-2 h-2 bg-[#E51791] rounded-full"></div>
                  </div>
                  <div>
                    <p className="font-semibold text-[#1E1E1E]">Assessment Review</p>
                    <p className="text-[#54595F] text-sm mt-0.5">
                      Your initial assessment and learning preferences will be reviewed to ensure the programme is appropriate for your background.
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-2 h-2 bg-[#E51791] rounded-full"></div>
                  </div>
                  <div>
                    <p className="font-semibold text-[#1E1E1E]">Final Approval</p>
                    <p className="text-[#54595F] text-sm mt-0.5">
                      Once the verification process is complete, your learner account will be fully activated and you will gain access to your course.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 24hr Countdown */}
            {status?.created_at && (
              <div className="border-t pt-6">
                <VerificationCountdown verificationRequestedAt={status.created_at} />
              </div>
            )}
          </div>
        </div>

        {/* Support Card */}
        <div className="bg-gradient-to-r from-[#E51791] to-[#11CCEF] rounded-2xl shadow-xl p-8 text-white">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold mb-2">Need Help?</h3>
              <p className="text-white text-opacity-90 mb-4">
                If you have any questions about your application or need to update any information, please contact our admissions team.
              </p>
              <div className="space-y-2 text-sm">
                <p>📧 Email: admissions@inspirelondoncollege.co.uk</p>
                <p>📞 Phone: +44 (0) 20 7101 9543</p>
                <p>⏰ Hours: Monday - Friday, 9:00 AM - 5:00 PM GMT</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
