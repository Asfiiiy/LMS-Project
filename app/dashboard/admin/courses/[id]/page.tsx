'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

const AdminCoursePage = () => {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;
  const [error, setError] = useState('');

  useEffect(() => {
    // Fetch course to check type and redirect accordingly
    const checkCourseType = async () => {
      try {
        console.log('Fetching course:', courseId);
        const response = await fetch(`http://localhost:5000/api/courses/details/${courseId}`);
        console.log('Response status:', response.status);
        
        const data = await response.json();
        console.log('Course data:', data);
        
        if (data.success && data.course) {
          if (data.course.course_type === 'cpd') {
            // Redirect to CPD view
            console.log('Redirecting to CPD view');
            router.push(`/cpd/${courseId}`);
          } else {
            // Redirect to qualification course view
            console.log('Redirecting to qualification view');
            router.push(`/courses/${courseId}`);
          }
        } else {
          setError('Course not found');
        }
      } catch (error) {
        console.error('Error checking course type:', error);
        setError('Failed to load course: ' + error);
      }
    };

    checkCourseType();
  }, [courseId, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-lg">Loading course...</div>
    </div>
  );
};

export default AdminCoursePage;

