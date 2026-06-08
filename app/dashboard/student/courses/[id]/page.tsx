'use client';

import { useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { getApiUrl } from '@/app/utils/apiUrl';

const StudentCoursePage = () => {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const courseId = params.id as string;
  const submissionId = searchParams.get('submission');

  useEffect(() => {
    // Fetch course to check type and redirect accordingly
    const checkCourseType = async () => {
      try {
        const apiUrl = getApiUrl();
        const response = await fetch(`${apiUrl}/api/courses/details/${courseId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('lms-token')}`,
            'Content-Type': 'application/json'
          }
        });
        const data = await response.json();
        
        if (data.success && data.course) {
          // Build redirect URL with submission parameter if present
          const submissionParam = submissionId ? `?submission=${submissionId}` : '';
          
          if (data.course.course_type === 'cpd') {
            // Redirect to CPD course for students (take course)
            router.push(`/dashboard/student/cpd/${courseId}${submissionParam}`);
          } else if (data.course.course_type === 'qualification' || data.course.course_type === 'qualifi') {
            // Redirect to qualification course view
            router.push(`/dashboard/student/qualification/${courseId}/view${submissionParam}`);
          } else {
            // Regular course - redirect to qualification view (most courses are qualification)
            router.push(`/dashboard/student/qualification/${courseId}/view${submissionParam}`);
          }
        } else {
          // If course not found, try redirecting to qualification view anyway (might be qualification course)
          const submissionParam = submissionId ? `?submission=${submissionId}` : '';
          router.push(`/dashboard/student/qualification/${courseId}/view${submissionParam}`);
        }
      } catch (error) {
        // Fallback: redirect to qualification view
        const submissionParam = submissionId ? `?submission=${submissionId}` : '';
        router.push(`/dashboard/student/qualification/${courseId}/view${submissionParam}`);
      }
    };

    checkCourseType();
  }, [courseId, router, submissionId]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-lg">Loading course...</div>
    </div>
  );
};

export default StudentCoursePage;

