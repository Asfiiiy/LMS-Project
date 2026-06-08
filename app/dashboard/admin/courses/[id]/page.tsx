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
        const response = await fetch(`http://localhost:5000/api/courses/details/${courseId}`);

        const data = await response.json();

        if (data.success && data.course) {
          if (data.course.course_type === 'cpd') {
            router.push(`/cpd/${courseId}`);
          } else {
            router.push(`/courses/${courseId}`);
          }
        } else {
          setError('Course not found');
        }
      } catch (error) {
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

