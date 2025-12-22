'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

const TutorCoursePage = () => {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;

  useEffect(() => {
    // Fetch course to check type and redirect accordingly
    const checkCourseType = async () => {
      try {
        const response = await fetch(`http://localhost:5000/api/courses/details/${courseId}`);
        const data = await response.json();
        
        if (data.success && data.course) {
          if (data.course.course_type === 'cpd') {
            // Redirect to CPD view
            router.push(`/cpd/${courseId}`);
          } else {
            // Redirect to qualification course view
            router.push(`/courses/${courseId}`);
          }
        }
      } catch (error) {
        console.error('Error checking course type:', error);
      }
    };

    checkCourseType();
  }, [courseId, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-lg">Loading course...</div>
    </div>
  );
};

export default TutorCoursePage;

