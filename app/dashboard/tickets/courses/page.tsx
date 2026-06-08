'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import CourseManagement from '@/app/components/CourseManagement';
import { apiService } from '@/app/services/api';

const TotalCoursesCountDisplay = ({ filterType }: { filterType: 'cpd' | 'qualification' }) => {
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const response = await apiService.getTicketsCourses();
        if (response?.success && response?.courses) {
          let courses = response.courses;
          if (filterType) {
            courses = courses.filter((c: any) => c.course_type === filterType);
          }
          setTotalCount(courses.length);
        }
      } catch (error) {
      } finally {
        setLoading(false);
      }
    };
    fetchCount();
  }, [filterType]);

  if (loading) {
    return (
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <div className="text-sm text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-1">
            Total Courses
          </div>
          <div className="text-4xl font-bold text-gray-900">
            {totalCount?.toLocaleString() || 0}
          </div>
        </div>
        <div className="text-5xl opacity-20">📚</div>
      </div>
    </div>
  );
};

export default function TicketsCoursesPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [courseTypeFilter, setCourseTypeFilter] = useState<'cpd' | 'qualification'>('cpd');

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('lms-user') || 'null');
    setUser(u);
    if (!u) {
      router.push('/login');
      return;
    }
    const role = u.role || '';
    if (role !== 'Operation Manager' && role !== 'Team Member') {
      router.push('/dashboard/tickets');
    }
  }, [router]);

  if (!user) return null;

  return (
    <div className="p-6">
      <div className="space-y-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Total Courses</h2>
              <p className="text-sm text-gray-600 mt-1">
                View all courses in the system
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCourseTypeFilter('cpd')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  courseTypeFilter === 'cpd'
                    ? 'bg-[#11CCEF] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                🎓 CPD Courses
              </button>
              <button
                onClick={() => setCourseTypeFilter('qualification')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  courseTypeFilter === 'qualification'
                    ? 'bg-[#E51791] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                📜 Qualification Courses
              </button>
            </div>
          </div>
          <TotalCoursesCountDisplay filterType={courseTypeFilter} />
        </div>
        <CourseManagement
          filterType={courseTypeFilter}
          showControls={false}
          useTicketsApi={true}
          basePathForView="/dashboard/admin"
        />
      </div>
    </div>
  );
}
