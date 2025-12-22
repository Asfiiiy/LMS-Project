'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiService } from '@/app/services/api';

interface StudentProfile {
  user_id: number;
  name: string;
  email: string;
  profile_status: 'complete' | 'incomplete';
  is_profile_complete: number;
  profile_completed_at: string | null;
  updated_at: string | null;
  gender?: string;
  date_of_birth?: string;
  nationality?: string;
  ethnicity?: string;
  current_role?: string;
  previous_qualification?: string;
  motivation?: string;
  vark_visual?: number;
  vark_auditory?: number;
  vark_reading?: number;
  vark_kinesthetic?: number;
  english_literacy?: string;
  ict_skills?: string;
  special_learning_needs?: string;
  profile_picture?: string;
}

interface StudentsProfileViewProps {
  userRole: 'Admin' | 'Tutor';
  userId?: number;
}

const StudentsProfileView = ({ userRole, userId }: StudentsProfileViewProps) => {
  const router = useRouter();
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'complete' | 'incomplete'>('all');

  useEffect(() => {
    fetchData();
  }, [searchTerm, statusFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');

      let response;
      if (userRole === 'Admin') {
        response = await apiService.getAllStudentsProfiles(
          searchTerm || undefined,
          statusFilter !== 'all' ? statusFilter : undefined
        );
      } else {
        response = await apiService.getTutorStudentsProfiles(
          searchTerm || undefined,
          statusFilter !== 'all' ? statusFilter : undefined
        );
      }

      if (response?.success) {
        setStudents(response.students || []);
      } else {
        setError(response?.message || 'Failed to fetch student profiles');
      }
    } catch (error) {
      console.error('Error fetching student profiles:', error);
      setError('Failed to connect to API. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewProfile = (student: StudentProfile) => {
    // Navigate to student detail page based on user role
    if (userRole === 'Admin') {
      router.push(`/dashboard/admin/students/${student.user_id}`);
    } else {
      router.push(`/dashboard/tutor/students/${student.user_id}`);
    }
  };

  const filteredStudents = students
    .filter(student => {
      // Filter out students with null user_id
      if (!student.user_id) {
        return false;
      }
      
      const matchesSearch = !searchTerm || 
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.email.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'complete' && student.is_profile_complete === 1) ||
        (statusFilter === 'incomplete' && student.is_profile_complete !== 1);

      return matchesSearch && matchesStatus;
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading student profiles...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-2xl font-bold text-gray-900">Students Profile</h2>
        <div className="text-sm text-gray-600">
          Total: <span className="font-semibold">{filteredStudents.length}</span> students
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Profile Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'complete' | 'incomplete')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
            >
              <option value="all">All</option>
              <option value="complete">Complete</option>
              <option value="incomplete">Incomplete</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Students Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Profile Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Updated
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No students found
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student, index) => (
                  <tr key={student.user_id || `student-${index}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {student.profile_picture ? (
                          <img
                            src={student.profile_picture}
                            alt={student.name}
                            className="h-10 w-10 rounded-full mr-3 object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-[#11CCEF] flex items-center justify-center text-white font-semibold mr-3">
                            {student.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="text-sm font-medium text-gray-900">{student.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {student.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          student.is_profile_complete === 1
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {student.is_profile_complete === 1 ? 'Complete' : 'Incomplete'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {student.updated_at
                        ? new Date(student.updated_at).toLocaleDateString()
                        : 'Never'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleViewProfile(student)}
                        className="text-[#11CCEF] hover:text-[#0daed9]"
                      >
                        View Profile
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default StudentsProfileView;

