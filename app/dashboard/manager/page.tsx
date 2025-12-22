'use client';

import React, { useEffect, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { UserRole, User } from '@/app/components/types';
import { apiService } from '@/app/services/api';
import { 
  FiUsers, FiBookOpen, FiSearch, FiChevronRight, 
  FiEye, FiChevronDown, FiCalendar, FiCheckCircle, 
  FiXCircle, FiClock, FiBarChart2, FiTrendingUp,
  FiUserCheck, FiFilter, FiDownload, FiRefreshCw
} from 'react-icons/fi';

interface Staff {
  id: number;
  name: string;
  email: string;
  created_at: string;
  student_count: number;
  avatar_color?: string;
}

interface Student {
  id: number;
  name: string;
  email: string;
  created_at: string;
  course_count: number;
  progress?: number;
}

interface Unit {
  unit_id: number;
  unit_title: string;
  order_index: number;
  is_unlocked: boolean;
  is_completed: boolean | number; // Can be boolean or number (0/1) from database
  assignment_status?: string;
  presentation_status?: string;
  unlocked_at: string | null;
  // CPD-specific fields
  quiz_attempted?: boolean | number;
  quiz_score?: number;
  deadline?: string | null;
}

interface CourseProgress {
  course_id: number;
  course_title: string;
  course_type: string;
  enrolled_at: string;
  enrollment_status: string;
  progress: number;
  total_units: number;
  completed_units: number;
  current_unit: {
    unit_id: number;
    unit_title: string;
    order_index: number;
  } | null;
  units: Unit[];
}

interface StudentProgress {
  student_id: number;
  courses: CourseProgress[];
}

const ManagerDashboard = () => {
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [user, setUser] = useState<User | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<number | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<number | null>(null);
  const [studentProgress, setStudentProgress] = useState<StudentProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [expandedCourses, setExpandedCourses] = useState<Set<number>>(new Set());

  useEffect(() => {
    const userData: User | null = JSON.parse(localStorage.getItem('lms-user') || 'null');
    setUser(userData);
    setUserRole(userData?.role || null);

    if (userData?.id) {
      fetchData();
    }
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      console.log('Fetching manager data...');
      console.log('User:', user);
      
      const [studentsRes, staffRes] = await Promise.allSettled([
        apiService.getManagerStudents(),
        apiService.getManagerStaff()
      ]);

      console.log('Students response:', studentsRes);
      console.log('Staff response:', staffRes);

      if (studentsRes.status === 'fulfilled') {
        console.log('Students API response:', studentsRes.value);
        if (studentsRes.value?.success) {
          const fetchedStudents = studentsRes.value.students || [];
          console.log('Fetched students:', fetchedStudents);
          setStudents(fetchedStudents);
        } else {
          console.error('API returned unsuccessful:', studentsRes.value);
          setStudents([]);
        }
      } else if (studentsRes.status === 'rejected') {
        console.error('Failed to fetch students:', studentsRes.reason);
        console.error('Error details:', studentsRes.reason?.message);
        setStudents([]);
      }

      if (staffRes.status === 'fulfilled') {
        console.log('Staff API response:', staffRes.value);
        if (staffRes.value?.success) {
          const staffWithColors = (staffRes.value.staff || []).map((staffMember: Staff, index: number) => ({
            ...staffMember,
            avatar_color: `hsl(${index * 137.5}, 70%, 60%)` // Generate distinct colors
          }));
          console.log('Fetched staff:', staffWithColors);
          setStaff(staffWithColors);
        } else {
          console.error('Staff API returned unsuccessful:', staffRes.value);
          setStaff([]);
        }
      } else if (staffRes.status === 'rejected') {
        console.error('Failed to fetch staff:', staffRes.reason);
        setStaff([]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setStudents([]);
      setStaff([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStaffClick = async (staffId: number) => {
    if (selectedStaff === staffId) {
      setSelectedStaff(null);
      setSelectedStudent(null);
      setStudentProgress(null);
      // Reload all students when deselecting staff
      fetchData();
      return;
    }

    try {
      setSelectedStaff(staffId);
      setSelectedStudent(null);
      setStudentProgress(null);
      setLoading(true);
      const res = await apiService.getStaffStudents(staffId);
      if (res?.success) {
        setStudents(res.students || []);
      } else {
        console.error('Failed to fetch staff students:', res);
        setStudents([]);
      }
    } catch (error) {
      console.error('Error fetching staff students:', error);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStudentClick = async (studentId: number) => {
    if (selectedStudent === studentId) {
      setSelectedStudent(null);
      setStudentProgress(null);
      setExpandedCourses(new Set());
      return;
    }

    try {
      setSelectedStudent(studentId);
      setStudentProgress(null); // Clear previous data
      setExpandedCourses(new Set());
      setLoading(true);
      
      console.log('Fetching progress for student:', studentId);
      const res = await apiService.getStudentProgress(studentId);
      console.log('Student progress response:', res);
      
      if (res?.success) {
        console.log('Progress data received:', res);
        console.log('Courses count:', res.courses?.length);
        setStudentProgress(res);
        
        // Update student progress in the list
        if (res.courses && res.courses.length > 0) {
          const avgProgress = Math.round(
            res.courses.reduce((sum: number, course: CourseProgress) => sum + course.progress, 0) /
            res.courses.length
          );
          setStudents(prev => prev.map(s => 
            s.id === studentId ? { ...s, progress: avgProgress } : s
          ));
          console.log('Updated student progress:', avgProgress);
        } else {
          console.log('No courses found for student');
          // Still set progress even if no courses, so the UI shows "no courses"
          setStudentProgress({ student_id: studentId, courses: [] });
        }
      } else {
        console.error('Failed to fetch student progress:', res);
        // Set empty progress so UI shows error state
        setStudentProgress({ student_id: studentId, courses: [] });
      }
    } catch (error: any) {
      console.error('Error fetching student progress:', error);
      console.error('Error message:', error?.message);
      // Set empty progress so UI shows error state
      setStudentProgress({ student_id: studentId, courses: [] });
    } finally {
      setLoading(false);
    }
  };

  const toggleCourseExpanded = (courseId: number) => {
    const newExpanded = new Set(expandedCourses);
    if (newExpanded.has(courseId)) {
      newExpanded.delete(courseId);
    } else {
      newExpanded.add(courseId);
    }
    setExpandedCourses(newExpanded);
  };

  const filteredStudents = students.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         student.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeFilter === 'active') return matchesSearch && (student.progress || 0) > 70;
    if (activeFilter === 'inactive') return matchesSearch && (student.progress || 0) <= 30;
    return matchesSearch;
  });

  const stats = {
    totalStudents: students.length,
    totalCourses: students.reduce((sum, student) => sum + student.course_count, 0),
    totalStaff: staff.length,
    averageProgress: students.length > 0 
      ? Math.round(students.reduce((sum, student) => sum + (student.progress || 0), 0) / students.length)
      : 0
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 70) return 'text-green-600 bg-green-50';
    if (progress >= 40) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { color: string; bg: string }> = {
      active: { color: 'text-green-700', bg: 'bg-green-100' },
      completed: { color: 'text-blue-700', bg: 'bg-blue-100' },
      pending: { color: 'text-yellow-700', bg: 'bg-yellow-100' },
      inactive: { color: 'text-gray-700', bg: 'bg-gray-100' }
    };
    
    return statusMap[status] || statusMap.inactive;
  };

  return (
    <ProtectedRoute allowedRoles={['Manager']} userRole={userRole}>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        {/* Enhanced Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-8 py-6">
            <div className="flex justify-between items-center">
              <div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-xl">
                    <FiBarChart2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">Manager Dashboard</h1>
                    <p className="text-gray-600 mt-1 flex items-center gap-2">
                      <span>Welcome back,</span>
                      <span className="font-medium text-gray-900">{user?.name}</span>
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button 
                  onClick={fetchData}
                  className="p-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200"
                  title="Refresh data"
                >
                  <FiRefreshCw className="w-5 h-5" />
                </button>
                <button className="px-4 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-400 text-white font-medium rounded-lg hover:shadow-lg transition-all duration-200">
                  Generate Report
              </button>
            </div>
            </div>
          </div>
        </header>

        <main className="p-6">
          {/* Enhanced Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-gradient-to-br from-white to-blue-50 p-6 rounded-2xl shadow-sm border border-blue-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Students</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalStudents}</p>
                  <div className="flex items-center mt-2">
                    <FiTrendingUp className="w-4 h-4 text-green-500 mr-1" />
                    <span className="text-sm text-green-600">+12% from last month</span>
                  </div>
                </div>
                <div className="p-3 bg-gradient-to-r from-blue-100 to-blue-50 rounded-xl">
                  <FiUsers className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-white to-purple-50 p-6 rounded-2xl shadow-sm border border-purple-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Courses</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalCourses}</p>
                  <div className="flex items-center mt-2">
                    <FiTrendingUp className="w-4 h-4 text-green-500 mr-1" />
                    <span className="text-sm text-green-600">+8% from last month</span>
                  </div>
                </div>
                <div className="p-3 bg-gradient-to-r from-purple-100 to-purple-50 rounded-xl">
                  <FiBookOpen className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-white to-green-50 p-6 rounded-2xl shadow-sm border border-green-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Staff Members</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalStaff}</p>
                  <div className="flex items-center mt-2">
                    <FiTrendingUp className="w-4 h-4 text-green-500 mr-1" />
                    <span className="text-sm text-green-600">+5% from last month</span>
                  </div>
                </div>
                <div className="p-3 bg-gradient-to-r from-green-100 to-green-50 rounded-xl">
                  <FiUserCheck className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-white to-amber-50 p-6 rounded-2xl shadow-sm border border-amber-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg. Progress</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{stats.averageProgress}%</p>
                  <div className="flex items-center mt-2">
                    <FiTrendingUp className="w-4 h-4 text-green-500 mr-1" />
                    <span className="text-sm text-green-600">+15% from last month</span>
                  </div>
                </div>
                <div className="relative">
                  <div className="w-16 h-16">
                    <svg className="w-full h-full" viewBox="0 0 36 36">
                      <path
                        d="M18 2.0845
                          a 15.9155 15.9155 0 0 1 0 31.831
                          a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="3"
                        strokeDasharray={`${stats.averageProgress}, 100`}
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-bold text-amber-600">{stats.averageProgress}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Staff Panel */}
            {staff.length > 0 && (
              <div className="lg:col-span-1">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-bold text-gray-900">My Staff</h2>
                    <span className="text-sm text-gray-500">{staff.length} members</span>
                  </div>
                  <div className="space-y-3">
                    {staff.map((staffMember) => (
                      <button
                        key={staffMember.id}
                        onClick={() => handleStaffClick(staffMember.id)}
                        className={`w-full text-left p-4 rounded-xl transition-all duration-200 transform hover:-translate-y-0.5 ${
                          selectedStaff === staffMember.id
                            ? 'bg-gradient-to-r from-blue-500 to-cyan-400 shadow-lg'
                            : 'bg-gray-50 hover:bg-gray-100 hover:shadow'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
                              style={{ backgroundColor: staffMember.avatar_color }}
                            >
                              {staffMember.name.charAt(0)}
                            </div>
                            <div>
                              <p className={`font-medium ${selectedStaff === staffMember.id ? 'text-white' : 'text-gray-900'}`}>
                                {staffMember.name}
                              </p>
                              <p className={`text-xs ${selectedStaff === staffMember.id ? 'text-white/90' : 'text-gray-500'}`}>
                                {staffMember.email}
                              </p>
                            </div>
                          </div>
                          <div className={`flex items-center gap-2 ${selectedStaff === staffMember.id ? 'text-white' : 'text-gray-400'}`}>
                            <span className="text-sm font-medium">
                              {staffMember.student_count}
                            </span>
                            <FiChevronRight className="w-4 h-4" />
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Students Table */}
            <div className="lg:col-span-3">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Enhanced Table Header */}
                <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">
                        {selectedStaff ? 'Students' : 'All Students'}
                      </h2>
                      <p className="text-sm text-gray-600 mt-1">
                        {filteredStudents.length} students found
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="relative flex-1 sm:w-auto">
                        <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
                          <FiSearch className="w-4 h-4" />
                        </div>
                        <input
                          type="text"
                          placeholder="Search by name or email..."
                          className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </div>
                      <div className="flex gap-2">
                        {['all', 'active', 'inactive'].map((filter) => (
                          <button
                            key={filter}
                            onClick={() => setActiveFilter(filter as any)}
                            className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                              activeFilter === filter
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {filter.charAt(0).toUpperCase() + filter.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
        </div>

                {/* Enhanced Table Body */}
                {loading ? (
                  <div className="p-12 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                    <p className="text-gray-500 mt-4">Loading student data...</p>
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                      <FiUsers className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No students found</h3>
                    <p className="text-gray-500 mb-4">
                      {searchTerm ? 'Try adjusting your search terms' : selectedStaff ? 'This staff member has no students assigned' : 'No students are currently assigned to you'}
                    </p>
                    {!searchTerm && !selectedStaff && (
                      <div className="mt-4 p-4 bg-blue-50 rounded-lg text-left max-w-md mx-auto">
                        <p className="text-sm text-blue-800">
                          <strong>Note:</strong> Students need to have their <code className="bg-blue-100 px-1 rounded">manager_id</code> set to your user ID in the database to appear here.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Student</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Progress</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Courses</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Joined</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {filteredStudents.map((student) => (
                          <tr 
                            key={student.id} 
                            className={`group hover:bg-blue-50/50 transition-all duration-200 ${
                              selectedStudent === student.id ? 'bg-blue-50' : ''
                            }`}
                          >
                            <td 
                              className="px-6 py-4 cursor-pointer"
                              onClick={() => handleStudentClick(student.id)}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-r from-blue-400 to-cyan-300 rounded-full flex items-center justify-center text-white font-bold">
                                  {student.name.charAt(0)}
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-900 group-hover:text-blue-600">
                                    {student.name}
                                  </p>
                                  <p className="text-sm text-gray-500">{student.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="w-32">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-medium text-gray-700">
                                    {student.progress !== undefined ? `${student.progress}%` : 'N/A'}
                                  </span>
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${getProgressColor(student.progress || 0)}`}>
                                    {(student.progress || 0) >= 70 ? 'Active' : 'Needs Help'}
                                  </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-1.5">
                                  <div 
                                    className={`h-1.5 rounded-full transition-all duration-500 ${
                                      (student.progress || 0) >= 70 ? 'bg-green-500' :
                                      (student.progress || 0) >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                                    }`}
                                    style={{ width: `${student.progress || 0}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                                <FiBookOpen className="w-3 h-3" />
                                {student.course_count}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center text-sm text-gray-600">
                                <FiCalendar className="w-3.5 h-3.5 mr-2" />
                                {formatDate(student.created_at)}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleStudentClick(student.id)}
                                  className={`p-2 rounded-lg transition-colors ${
                                    selectedStudent === student.id
                                      ? 'bg-blue-500 text-white'
                                      : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                                  }`}
                                  title="View progress"
                                >
                                  <FiEye className="w-4 h-4" />
              </button>
                                <button
                                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                                  title="Export data"
                                >
                                  <FiDownload className="w-4 h-4" />
              </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Student Progress Details Table */}
            {selectedStudent && (
              <div className="lg:col-span-3 mt-6">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-cyan-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full flex items-center justify-center text-white font-bold text-lg">
                          {students.find(s => s.id === selectedStudent)?.name.charAt(0)}
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-gray-900">
                            {students.find(s => s.id === selectedStudent)?.name} - Course Progress
                          </h2>
                          <p className="text-sm text-gray-600 mt-1">
                            {studentProgress ? (
                              <>
                                {studentProgress.courses?.length || 0} {(studentProgress.courses?.length || 0) === 1 ? 'course' : 'courses'} enrolled
                                {studentProgress.courses && studentProgress.courses.length > 0 && (
                                  <span className="ml-2">
                                    • Avg. Progress: {Math.round(
                                      studentProgress.courses.reduce((sum: number, c: CourseProgress) => sum + c.progress, 0) /
                                      studentProgress.courses.length
                                    )}%
                                  </span>
                                )}
                              </>
                            ) : (
                              'Loading course data...'
                            )}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedStudent(null);
                          setStudentProgress(null);
                          setExpandedCourses(new Set());
                        }}
                        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Close details"
                      >
                        <FiXCircle className="w-5 h-5" />
              </button>
                    </div>
                  </div>

                  {loading ? (
                    <div className="p-12 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                      <p className="text-gray-500 mt-4">Loading course progress...</p>
                    </div>
                  ) : studentProgress && studentProgress.courses && studentProgress.courses.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Course Name</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Enrolled Date</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Progress</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Units Status</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Course Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {studentProgress.courses.map((course) => {
                          const statusStyle = getStatusBadge(course.enrollment_status);
                          return (
                            <tr key={course.course_id} className="bg-white hover:bg-gray-50">
                              <td className="px-6 py-4">
                                <div className="font-semibold text-gray-900">{course.course_title}</div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {course.course_type === 'qualification' ? 'Qualification Course' : 'Regular Course'}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center text-sm text-gray-600">
                                  <FiCalendar className="w-4 h-4 mr-2" />
                                  {formatDate(course.enrolled_at)}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="w-32">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-medium text-gray-900">{course.progress}%</span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div 
                                      className={`h-2 rounded-full transition-all duration-500 ${
                                        course.progress >= 70 ? 'bg-green-500' :
                                        course.progress >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                                      }`}
                                      style={{ width: `${course.progress}%` }}
                                    />
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {course.completed_units} / {course.total_units} units
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="space-y-2 min-w-[300px]">
                                  {course.units && course.units.length > 0 ? (
                                    course.units.map((unit) => {
                                      // CPD course logic
                                      if (course.course_type === 'cpd') {
                                        const isPassed = unit.is_completed === true || unit.is_completed === 1;
                                        const isAttempted = (unit.quiz_attempted === true || unit.quiz_attempted === 1);
                                        const isInProgress = unit.is_unlocked && !isPassed;
                                        const isLocked = !unit.is_unlocked;
                                        
                                        return (
                                          <div
                                            key={unit.unit_id}
                                            className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-200"
                                          >
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                              <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${
                                                isPassed
                                                  ? 'bg-green-100 text-green-600'
                                                  : isInProgress
                                                  ? 'bg-blue-100 text-blue-600'
                                                  : 'bg-gray-100 text-gray-400'
                                              }`}>
                                                {isPassed ? (
                                                  <FiCheckCircle className="w-3.5 h-3.5" />
                                                ) : isInProgress ? (
                                                  <FiClock className="w-3.5 h-3.5" />
                                                ) : (
                                                  <FiXCircle className="w-3.5 h-3.5" />
                                                )}
                                              </div>
                                              <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                  <span className="text-xs font-semibold text-gray-700">
                                                    Topic {unit.order_index}:
                                                  </span>
                                                  <span className="text-xs text-gray-600 truncate">
                                                    {unit.unit_title}
                                                  </span>
                                                </div>
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                                              {isPassed && (
                                                <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded whitespace-nowrap">
                                                  ✓ Passed
                                                </span>
                                              )}
                                              {isAttempted && !isPassed && (
                                                <span className="text-xs font-medium text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded whitespace-nowrap">
                                                  Attempted {unit.quiz_score ? `(${unit.quiz_score}%)` : ''}
                                                </span>
                                              )}
                                              {isInProgress && !isAttempted && (
                                                <span className="text-xs font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded whitespace-nowrap">
                                                  In Progress
                                                </span>
                                              )}
                                              {isLocked && (
                                                <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded whitespace-nowrap">
                                                  Locked
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      }
                                      
                                      // Qualification and regular course logic
                                      const isPassed = unit.is_completed || 
                                        (course.course_type === 'qualification' && 
                                         unit.assignment_status === 'pass' && 
                                         (unit.presentation_status === 'pass' || unit.presentation_status === 'not_required'));
                                      
                                      const isFailed = course.course_type === 'qualification' && 
                                        (unit.assignment_status === 'refer' || unit.presentation_status === 'refer');
                                      
                                      const isInProgress = unit.is_unlocked && !isPassed && !isFailed;
                                      const isLocked = !unit.is_unlocked;
                                      const isAttempted = course.course_type === 'qualification' && 
                                        (unit.assignment_status !== 'pending' && unit.assignment_status !== null && !isPassed && !isFailed);

                                      return (
                                        <div
                                          key={unit.unit_id}
                                          className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-200"
                                        >
                                          <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${
                                              isPassed
                                                ? 'bg-green-100 text-green-600'
                                                : isFailed
                                                ? 'bg-red-100 text-red-600'
                                                : isInProgress
                                                ? 'bg-blue-100 text-blue-600'
                                                : 'bg-gray-100 text-gray-400'
                                            }`}>
                                              {isPassed ? (
                                                <FiCheckCircle className="w-3.5 h-3.5" />
                                              ) : isFailed ? (
                                                <FiXCircle className="w-3.5 h-3.5" />
                                              ) : isInProgress ? (
                                                <FiClock className="w-3.5 h-3.5" />
                                              ) : (
                                                <FiXCircle className="w-3.5 h-3.5" />
                                              )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-2">
                                                <span className="text-xs font-semibold text-gray-700">
                                                  Unit {unit.order_index}:
                                                </span>
                                                <span className="text-xs text-gray-600 truncate">
                                                  {unit.unit_title}
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                                            {isPassed && (
                                              <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded whitespace-nowrap">
                                                ✓ Pass
                                              </span>
                                            )}
                                            {isFailed && (
                                              <span className="text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded whitespace-nowrap">
                                                ✗ Refer
                                              </span>
                                            )}
                                            {isAttempted && (
                                              <span className="text-xs font-medium text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded whitespace-nowrap">
                                                Attempted
                                              </span>
                                            )}
                                            {isInProgress && !isAttempted && (
                                              <span className="text-xs font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded whitespace-nowrap">
                                                In Progress
                                              </span>
                                            )}
                                            {isLocked && (
                                              <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded whitespace-nowrap">
                                                Locked
                                              </span>
                                            )}
                                            {course.course_type === 'qualification' && unit.assignment_status && (
                                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                                unit.assignment_status === 'pass' 
                                                  ? 'bg-green-100 text-green-700'
                                                  : unit.assignment_status === 'refer'
                                                  ? 'bg-red-100 text-red-700'
                                                  : 'bg-yellow-100 text-yellow-700'
                                              }`}>
                                                {unit.assignment_status === 'pass' ? '✓' : 
                                                 unit.assignment_status === 'refer' ? '✗' : '○'}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })
                                  ) : (
                                    <div className="text-xs text-gray-500 italic">No {course.course_type === 'cpd' ? 'topics' : 'units'} available</div>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`text-xs px-2 py-1 rounded-full ${statusStyle.bg} ${statusStyle.color}`}>
                                  {course.enrollment_status}
                                </span>
                              </td>
                            </tr>
                          );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : studentProgress && studentProgress.courses && studentProgress.courses.length === 0 ? (
                    <div className="p-12 text-center">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                        <FiBookOpen className="w-8 h-8 text-gray-400" />
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No courses found</h3>
                      <p className="text-gray-500">
                        This student is not enrolled in any courses yet.
                      </p>
                    </div>
                  ) : !studentProgress ? (
                    <div className="p-12 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                      <p className="text-gray-500 mt-4">Loading course progress...</p>
                    </div>
                  ) : (
                    <div className="p-12 text-center">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                        <FiBookOpen className="w-8 h-8 text-gray-400" />
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No course data available</h3>
                      <p className="text-gray-500">
                        Unable to load course information for this student.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
};

export default ManagerDashboard;