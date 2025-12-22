'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiService } from '@/app/services/api';
import { showSweetAlert } from '@/app/components/SweetAlert';
import { showToast } from '@/app/components/Toast';

interface Course {
  id: number;
  title: string;
}

export default function ClaimQualificationCertificatePage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params?.courseId as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [course, setCourse] = useState<Course | null>(null);
  const [user, setUser] = useState<any>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('lms-token');
        if (!token) {
          router.push('/');
          return;
        }

        const userData = JSON.parse(localStorage.getItem('lms-user') || '{}');
        setUser(userData);
        setFullName(userData.name || '');
        setEmail(userData.email || '');

        // Check if student has already claimed a certificate for this course
        const claimsResponse = await apiService.getMyMyCertificateClaims();
        if (claimsResponse.success) {
          const existingClaim = claimsResponse.claims.find(
            (claim: any) => claim.course_id === parseInt(courseId) && claim.payment_status === 'completed'
          );
          
          if (existingClaim) {
            // Already claimed - redirect to certificates page
            showSweetAlert(
              'Certificate Already Claimed',
              'You have already claimed a certificate for this course. Redirecting to your certificates page...',
              'info',
              {
                confirmButtonText: 'View My Certificates',
                onConfirm: () => {
                  router.push('/dashboard/student/certificates');
                }
              }
            );
            // Auto redirect after 2 seconds
            setTimeout(() => {
              router.push('/dashboard/student/certificates');
            }, 2000);
            return;
          }
        }

        // Fetch course details
        const courseResponse = await apiService.getQualificationCourse(parseInt(courseId));
        if (courseResponse.success) {
          setCourse(courseResponse.course);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        showToast('Failed to load course data', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [courseId, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName || !email) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    setSubmitting(true);

    try {
      const response = await apiService.submitQualificationCertificateClaim({
        studentId: user.id,
        courseId: parseInt(courseId),
        fullName,
        email
      });

      if (response.success) {
        showSweetAlert(
          'Certificate Claimed Successfully! 🎉',
          `Your certificate for "${course?.title}" will be delivered within the next 30 days. For further information or inquiries, please contact our support team at support@yourdomain.com`,
          'success',
          {
            confirmButtonText: 'View My Certificates',
            onConfirm: () => router.push('/dashboard/student/certificates')
          }
        );
      } else {
        showToast(response.message || 'Failed to claim certificate', 'error');
      }
    } catch (error: any) {
      console.error('Error claiming certificate:', error);
      
      // Check if it's a duplicate claim error
      if (error.message && error.message.includes('already claimed')) {
        showSweetAlert(
          'Certificate Already Claimed',
          error.message || 'You have already claimed a certificate for this course.',
          'warning',
          {
            confirmButtonText: 'View My Certificates',
            onConfirm: () => {
              router.push('/dashboard/student/certificates');
            }
          }
        );
      } else {
        showToast(error.message || 'Failed to claim certificate', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="mb-6">
            <button
              onClick={() => router.push(`/dashboard/student/qualification/${courseId}/view`)}
              className="text-blue-600 hover:text-blue-800 flex items-center gap-2"
            >
              ← Back to Course
            </button>
          </div>

          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <svg
                className="w-8 h-8 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              Claim Your Certificate
            </h1>
            <p className="text-gray-600">
              {course?.title}
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
            <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Important Information
            </h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>Your certificate will be delivered within the next <strong>30 days</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>For further information, contact us at <strong>support@yourdomain.com</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>This is a <strong>free service</strong> for qualification courses - no payment required</span>
              </li>
            </ul>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="As displayed on certificate"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                This name will appear on your certificate
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your email"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Confirmation and certificate details will be sent to this email
              </p>
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => router.push(`/dashboard/student/qualification/${courseId}/view`)}
                className="flex-1 py-3 px-6 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className={`flex-1 py-3 px-6 rounded-lg font-medium transition-colors ${
                  submitting
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {submitting ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Claiming...
                  </span>
                ) : (
                  'Claim Certificate'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

