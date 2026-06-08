'use client';

import ProtectedRoute from '@/app/components/ProtectedRoute';
import { useEffect, useState } from 'react';
import { UserRole, User } from '@/app/components/types';

interface Course {
  id: number;
  title: string;
  description: string;
  status: 'In Progress' | 'Completed';
}

const ManagerStudentDashboard = () => {
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    const user: User | null = JSON.parse(localStorage.getItem('lms-user') || 'null');
    setUserRole(user?.role || null);

    // Simulated courses assigned by manager
    const assignedCourses: Course[] = [
      { id: 1, title: 'Business Management Basics', description: 'Intro to business', status: 'In Progress' },
      { id: 2, title: 'Health & Social Care', description: 'Level 3 course', status: 'Completed' },
    ];
    setCourses(assignedCourses);
  }, []);

  return (
    <ProtectedRoute allowedRoles={['ManagerStudent']} userRole={userRole}>
      <div className="p-8 bg-gray-100 min-h-screen">
        <h1 className="text-3xl font-bold mb-6">Student Dashboard (Manager Assigned)</h1>

        {/* Courses Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {courses.map(course => (
            <div key={course.id} className="bg-white p-4 rounded shadow-md hover:shadow-lg transition">
              <h2 className="text-xl font-semibold mb-2">{course.title}</h2>
              <p className="text-gray-600 mb-2">{course.description}</p>
              <p className={`font-semibold ${course.status === 'Completed' ? 'text-green-500' : 'text-yellow-500'}`}>
                {course.status}
              </p>
              <div className="mt-4 flex space-x-2">
                <button className="px-3 py-1 bg-[#11CCEF] text-white rounded hover:bg-[#0daed9]">View Course</button>
                <button className="px-3 py-1 bg-[#E51791] text-white rounded hover:bg-[#c3147f]">Submit Assignment</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default ManagerStudentDashboard;
