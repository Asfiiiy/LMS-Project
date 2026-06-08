'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onboardingService } from '@/app/services/onboardingService';
import type { EnrollmentType } from '@/app/types/onboarding.types';
import { ArrowRight, Sparkles, BookOpen, GraduationCap, CheckCircle } from 'lucide-react';

export default function WelcomePage() {
  const router = useRouter();
  const [studentName, setStudentName] = useState('');
  const [loading, setLoading] = useState(false);
  const [enrollmentType, setEnrollmentType] = useState<EnrollmentType | null>(null);
  const [detectingEnrollment, setDetectingEnrollment] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('lms-user');
    if (userStr) {
      const user = JSON.parse(userStr);
      setStudentName(user.name || 'Student');
    }

    onboardingService
      .getStatus()
      .then((res) => {
        if (res.success && res.enrollment_type) {
          setEnrollmentType(res.enrollment_type);
        }
      })
      .catch(() => {})
      .finally(() => setDetectingEnrollment(false));
  }, []);

  const isCpdOnlyEnrollment =
    !!enrollmentType && enrollmentType.hasCPD && !enrollmentType.hasQualification;
  const hasNoEnrollment = enrollmentType?.hasNone === true;
  /** Wait for enrollment detection; do not block no-enrollment students — they use manual qualification selection. */
  const continueDisabled = loading || detectingEnrollment;

  const markWelcomeComplete = async () => {
    try {
      await onboardingService.updateStatus({
        welcome_completed: true,
        current_step: 'course-selection',
      });
    } catch {
      // Proceed to course-selection even if this fails (e.g. offline)
    }
  };

  const handleContinue = async () => {
    if (continueDisabled) return;
    setLoading(true);
    setError(null);
    try {
      const result = await onboardingService.autoSetupOnboarding();

      if (result.success && result.auto_setup && result.next_step) {
        const path = result.next_step;
        if (path === 'initial-assessment') {
          router.push('/onboarding/initial-assessment');
        } else if (path === 'qualification-level') {
          router.push('/onboarding/qualification-level');
        } else if (path === 'course-selection') {
          router.push('/onboarding/course-selection');
        } else {
          router.push(`/onboarding/${path}`);
        }
        return;
      }

      // No enrollment (auto_setup false) or unexpected response — manual qualification path
      await markWelcomeComplete();
      router.push('/onboarding/course-selection');
    } catch (err) {
      console.error('Error during onboarding continue:', err);
      try {
        await markWelcomeComplete();
      } catch {
        /* ignore */
      }
      router.push('/onboarding/course-selection');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 via-pink-50 to-purple-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl p-8 md:p-12">
        <div className="flex justify-center mb-6">
          <div className="relative">
            <Sparkles className="w-20 h-20 text-pink-500 animate-pulse" />
            <div className="absolute inset-0 bg-pink-200 rounded-full blur-xl opacity-50 animate-pulse"></div>
          </div>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold text-center text-gray-900 mb-4">
          Welcome, {studentName}
        </h1>

        <div className="text-lg text-center text-gray-700 mb-8 leading-relaxed space-y-3">
          <p>We are delighted to welcome you to Inspire London College.</p>
          <p>
            You are now part of a global learning community with learners from over 60 countries, studying
            through our flexible online learning platform.
          </p>
          <p>Before your course access is activated, please complete the short onboarding process below.</p>
        </div>

        {/* CPD-only enrollment badge */}
        {!detectingEnrollment && isCpdOnlyEnrollment && (
          <div
            className="rounded-xl p-5 mb-6 border text-center"
            style={{
              background: '#f0fdf4',
              borderColor: '#bbf7d0',
              color: '#16a34a',
            }}
          >
            <div className="flex justify-center mb-2">
              <CheckCircle className="w-8 h-8" style={{ color: '#16a34a' }} aria-hidden />
            </div>
            <p className="text-sm font-bold mb-1" style={{ color: '#15803d' }}>
              Your enrollment
            </p>
            <p className="text-base font-extrabold" style={{ color: '#16a34a' }}>
              CPD course
            </p>
            <p className="text-xs mt-2 leading-snug" style={{ color: '#15803d' }}>
              Continuing Professional Development
            </p>
            <p className="text-xs mt-3 opacity-90">
              Your onboarding path has been set automatically based on your enrolment.
            </p>
          </div>
        )}

        {/* Qualification / both — existing style */}
        {!detectingEnrollment && enrollmentType && !enrollmentType.hasNone && !isCpdOnlyEnrollment && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 mb-6 border border-green-200 flex items-center gap-3">
            {enrollmentType.hasQualification ? (
              <GraduationCap className="w-6 h-6 text-green-600 flex-shrink-0" />
            ) : (
              <BookOpen className="w-6 h-6 text-green-600 flex-shrink-0" />
            )}
            <div>
              <p className="text-sm text-green-800 font-semibold">
                Enrolled in:{' '}
                <span className="text-green-600">
                  {enrollmentType.hasBoth
                    ? 'Qualification + CPD'
                    : enrollmentType.hasQualification
                      ? 'Qualification'
                      : 'CPD'}
                </span>
              </p>
              <p className="text-xs text-green-600 mt-0.5">
                Your onboarding path has been set automatically based on your enrolment.
              </p>
            </div>
          </div>
        )}

        {!detectingEnrollment && hasNoEnrollment && (
          <div
            className="rounded-xl p-4 mb-6 border flex items-start gap-3"
            style={{ background: '#fffbeb', borderColor: '#fde68a' }}
          >
            <span className="text-2xl shrink-0" aria-hidden>
              ℹ️
            </span>
            <div>
              <p className="text-sm font-bold" style={{ color: '#92400e' }}>
                No active enrollment detected yet
              </p>
              <p className="text-xs mt-1" style={{ color: '#a16207' }}>
                You can still continue: choose <span className="font-semibold">Qualification</span> on the next
                screen and complete onboarding. If you expected a course to appear here, contact your administrator.
              </p>
            </div>
          </div>
        )}

        <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-xl p-6 mb-8 border border-pink-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">What to expect:</h2>
          <ul className="space-y-2 text-gray-700">
            {enrollmentType && !enrollmentType.hasNone ? (
              <>
                {enrollmentType.hasQualification && (
                  <li className="flex items-start gap-2">
                    <span className="text-pink-500 font-bold">1.</span>
                    <span>Select your qualification level</span>
                  </li>
                )}
                {enrollmentType.hasQualification && (
                  <li className="flex items-start gap-2">
                    <span className="text-pink-500 font-bold">2.</span>
                    <span>Upload required documents for verification</span>
                  </li>
                )}
                <li className="flex items-start gap-2">
                  <span className="text-pink-500 font-bold">
                    {enrollmentType.hasQualification ? '3' : '1'}.
                  </span>
                  <span>Complete your initial assessment form</span>
                </li>
                {enrollmentType.hasQualification && (
                  <li className="flex items-start gap-2">
                    <span className="text-pink-500 font-bold">4.</span>
                    <span>Take a quick learning style assessment</span>
                  </li>
                )}
                {enrollmentType.hasQualification && (
                  <li className="flex items-start gap-2">
                    <span className="text-pink-500 font-bold">5.</span>
                    <span>Wait for admin verification (typically within 24 hours)</span>
                  </li>
                )}
                {isCpdOnlyEnrollment && (
                  <li className="flex items-start gap-2">
                    <span className="text-pink-500 font-bold">2.</span>
                    <span>Access your student dashboard as soon as you submit the form</span>
                  </li>
                )}
              </>
            ) : hasNoEnrollment ? (
              <>
                <li className="flex items-start gap-2">
                  <span className="text-pink-500 font-bold">1.</span>
                  <span>Select Qualification on the course selection screen</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-pink-500 font-bold">2.</span>
                  <span>Select your qualification level</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-pink-500 font-bold">3.</span>
                  <span>Upload required documents for verification</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-pink-500 font-bold">4.</span>
                  <span>Complete your initial assessment form</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-pink-500 font-bold">5.</span>
                  <span>Take a quick learning style assessment</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-pink-500 font-bold">6.</span>
                  <span>Wait for admin verification (typically within 24 hours)</span>
                </li>
              </>
            ) : (
              <li className="flex items-start gap-2">
                <span className="text-pink-500 font-bold">•</span>
                <span>
                  Once an administrator enrolls you in a course, return here and tap Continue to start onboarding.
                </span>
              </li>
            )}
          </ul>
        </div>

        <div className="text-center mb-8">
          <p className="text-sm text-gray-600">
            This process takes approximately <span className="font-semibold text-pink-600">15-20 minutes</span>
          </p>
        </div>

        {error && (
          <p className="text-center text-sm text-red-600 mb-4" role="alert">
            {error}
          </p>
        )}

        <button
          onClick={handleContinue}
          disabled={continueDisabled}
          className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              Loading...
            </>
          ) : (
            <>
              Let&apos;s Get Started
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
