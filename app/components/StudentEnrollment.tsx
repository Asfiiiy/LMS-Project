'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiService } from '@/app/services/api';
import { UserRole } from '@/app/components/types';
import DeadlineSetupModal from './DeadlineSetupModal';
import { showSweetAlert } from '@/app/components/SweetAlert';

interface Student {
  id: number;
  name: string;
  email: string;
  role_name?: string;
  created_at?: string;
}

interface Enrollment extends Student {
  status?: string | null;
  grade?: number | null;
  enrolled_at?: string;
  created_at?: string;
}

interface CourseSummary {
  id: number;
  title: string;
  created_by?: number;
  created_by_name?: string;
}

interface StudentEnrollmentProps {
  role: UserRole;
  userId?: number;
}

const StudentEnrollment = ({ role, userId }: StudentEnrollmentProps) => {
  const router = useRouter();
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingEnrollments, setIsLoadingEnrollments] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  // Deadline modal state
  const [showDeadlineModal, setShowDeadlineModal] = useState(false);
  const [deadlineModalData, setDeadlineModalData] = useState<{
    courseId: number;
    studentIds: number[];
    topics: Array<{ id: number; topic_number: number; title: string; deadline: string | null; type?: 'cpd_topic' | 'qualification_unit' }>;
  } | null>(null);
  
  // Search and filters
  const [globalSearch, setGlobalSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'enrolled' | 'not_assigned'>('all');
  
  // Available students pagination and sorting
  const [availableSearch, setAvailableSearch] = useState('');
  const [availablePage, setAvailablePage] = useState(1);
  const [availableLimit, setAvailableLimit] = useState(20);
  const [availableSort, setAvailableSort] = useState<'name' | 'date'>('name');
  
  // Enrolled students pagination and sorting
  const [enrolledSearch, setEnrolledSearch] = useState('');
  const [enrolledPage, setEnrolledPage] = useState(1);
  const [enrolledLimit, setEnrolledLimit] = useState(20);
  const [enrolledSort, setEnrolledSort] = useState<'name' | 'date'>('date');

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      setFeedback(null);
      try {
        const [coursesResponse, studentsResponse] = await Promise.all([
          role === 'Tutor' && userId
            ? apiService.getTutorCourses(userId)
            : apiService.getCourses(),
          apiService.getAllStudents()
        ]);

        const courseList: CourseSummary[] = (coursesResponse?.courses ?? []).map((course: any) => ({
          id: course.id,
          title: course.title,
          created_by: course.created_by,
          created_by_name: course.created_by_name
        }));

        setCourses(courseList);
        setStudents(studentsResponse?.students ?? []);

        if (courseList.length) {
          setSelectedCourseId(courseList[0].id);
        } else {
          setSelectedCourseId(null);
          setEnrollments([]);
        }
      } catch (err) {
        console.error('Error loading students or courses:', err);
        setFeedback({ type: 'error', message: 'Unable to load courses or students. Please try again.' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();
  }, [role, userId]);

  useEffect(() => {
    const fetchEnrollments = async () => {
      if (!selectedCourseId) {
        setEnrollments([]);
        return;
      }
      setIsLoadingEnrollments(true);
      setFeedback(null);
      try {
        const response =
          role === 'Tutor' && userId
            ? await apiService.getTutorCourseEnrollments(userId, selectedCourseId)
            : await apiService.getCourseEnrollments(selectedCourseId);
        setEnrollments(response?.enrollments ?? response?.students ?? []);
      } catch (err) {
        console.error('Error loading enrollments:', err);
        setFeedback({ type: 'error', message: 'Unable to load course enrollments.' });
        setEnrollments([]);
      } finally {
        setIsLoadingEnrollments(false);
      }
    };

    fetchEnrollments();
  }, [selectedCourseId, role, userId]);

  // Get date range helper
  const getDateRange = () => {
    const now = new Date();
    switch (dateFilter) {
      case 'today': {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        return { start, end: now };
      }
      case 'week': {
        const start = new Date();
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        return { start, end: now };
      }
      case 'month': {
        const start = new Date();
        start.setMonth(start.getMonth() - 1);
        start.setHours(0, 0, 0, 0);
        return { start, end: now };
      }
      default:
        return null;
    }
  };

  // Filter students based on global search, date filter, and type filter
  const filteredAllStudents = useMemo(() => {
    let filtered = students;
    
    // Apply global search
    if (globalSearch.trim()) {
      const query = globalSearch.trim().toLowerCase();
      filtered = filtered.filter((student) =>
        student.name.toLowerCase().includes(query) ||
        student.email.toLowerCase().includes(query) ||
        (student.role_name || '').toLowerCase().includes(query)
      );
    }
    
    // Apply date filter
    if (dateFilter !== 'all') {
      const dateRange = getDateRange();
      if (dateRange) {
        filtered = filtered.filter((student) => {
          if (!student.created_at) return false;
          const createdDate = new Date(student.created_at);
          return createdDate >= dateRange.start && createdDate <= dateRange.end;
        });
      }
    }
    
    // Apply type filter
    const enrolledIds = new Set(enrollments.map((e) => e.id));
    if (typeFilter === 'enrolled') {
      filtered = filtered.filter((student) => enrolledIds.has(student.id));
    } else if (typeFilter === 'not_assigned') {
      filtered = filtered.filter((student) => !enrolledIds.has(student.id));
    }
    
    return filtered;
  }, [students, globalSearch, dateFilter, typeFilter, enrollments]);

  const enrolledIds = useMemo(() => new Set(enrollments.map((student) => student.id)), [enrollments]);

  // Available students (not enrolled in selected course)
  const availableStudents = useMemo(() => {
    return filteredAllStudents.filter((student) => !enrolledIds.has(student.id));
  }, [filteredAllStudents, enrolledIds]);

  // Filter and sort available students
  const filteredAvailableStudents = useMemo(() => {
    let filtered = availableStudents;
    
    // Apply search
    if (availableSearch.trim()) {
      const query = availableSearch.trim().toLowerCase();
      filtered = filtered.filter((student) =>
        student.name.toLowerCase().includes(query) ||
        student.email.toLowerCase().includes(query) ||
        (student.role_name || '').toLowerCase().includes(query)
      );
    }
    
    // Sort
    filtered = [...filtered].sort((a, b) => {
      if (availableSort === 'name') {
        return a.name.localeCompare(b.name);
      } else {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      }
    });
    
    return filtered;
  }, [availableStudents, availableSearch, availableSort]);

  // Paginated available students
  const paginatedAvailable = useMemo(() => {
    const start = (availablePage - 1) * availableLimit;
    const end = start + availableLimit;
    return filteredAvailableStudents.slice(start, end);
  }, [filteredAvailableStudents, availablePage, availableLimit]);

  const availableTotalPages = Math.ceil(filteredAvailableStudents.length / availableLimit);

  // Filter and sort enrolled students
  const filteredEnrolledStudents = useMemo(() => {
    let filtered = enrollments;
    
    // Apply search
    if (enrolledSearch.trim()) {
      const query = enrolledSearch.trim().toLowerCase();
      filtered = filtered.filter((student) =>
        student.name.toLowerCase().includes(query) ||
        student.email.toLowerCase().includes(query) ||
        (student.role_name || '').toLowerCase().includes(query)
      );
    }
    
    // Sort
    filtered = [...filtered].sort((a, b) => {
      if (enrolledSort === 'name') {
        return a.name.localeCompare(b.name);
      } else {
        const dateA = (a.enrolled_at || a.created_at) ? new Date(a.enrolled_at || a.created_at || '').getTime() : 0;
        const dateB = (b.enrolled_at || b.created_at) ? new Date(b.enrolled_at || b.created_at || '').getTime() : 0;
        return dateB - dateA;
      }
    });
    
    return filtered;
  }, [enrollments, enrolledSearch, enrolledSort]);

  // Paginated enrolled students
  const paginatedEnrolled = useMemo(() => {
    const start = (enrolledPage - 1) * enrolledLimit;
    const end = start + enrolledLimit;
    return filteredEnrolledStudents.slice(start, end);
  }, [filteredEnrolledStudents, enrolledPage, enrolledLimit]);

  const enrolledTotalPages = Math.ceil(filteredEnrolledStudents.length / enrolledLimit);

  // Stats - Calculate based on all students and enrollments for selected course
  const stats = useMemo(() => {
    const totalStudents = students.length;
    const enrolled = enrollments.length;
    const notAssigned = totalStudents - enrolled;
    
    return {
      totalStudents,
      enrolled,
      notAssigned: Math.max(notAssigned, 0)
    };
  }, [students, enrollments]);

  const handleEnrollStudent = async (studentId: number) => {
    if (!selectedCourseId) return;
    setFeedback(null);
    try {
      let enrollmentResponse;
      if (role === 'Tutor' && userId) {
        enrollmentResponse = await apiService.enrollStudents([studentId], selectedCourseId, userId);
        const response = await apiService.getTutorCourseEnrollments(userId, selectedCourseId);
        setEnrollments(response?.enrollments ?? response?.students ?? []);
      } else {
        enrollmentResponse = await apiService.enrollStudents([studentId], selectedCourseId);
        const response = await apiService.getCourseEnrollments(selectedCourseId);
        setEnrollments(response?.enrollments ?? []);
      }

      // Redirect to enrollment setup page for deadlines and payments
      // If enrolling multiple students, redirect to first student (or handle multiple later)
      if (enrollmentResponse?.studentIds && enrollmentResponse?.studentIds.length > 0) {
        const firstStudentId = enrollmentResponse.studentIds[0];
        const dashboardPath = role === 'Tutor' ? 'tutor' : 'admin';
        // Show success message before redirect
        showSweetAlert('Success!', 'Student enrolled successfully! Redirecting to enrollment setup...', 'success', {
          timer: 2000,
          onConfirm: () => {
            router.push(`/dashboard/${dashboardPath}/enrollments/${selectedCourseId}/${firstStudentId}/setup`);
          }
        });
        // Redirect after alert auto-closes
        setTimeout(() => {
          router.push(`/dashboard/${dashboardPath}/enrollments/${selectedCourseId}/${firstStudentId}/setup`);
        }, 2000);
      } else {
        showSweetAlert('Success!', 'Student enrolled successfully!', 'success');
      }
      setAvailablePage(1);
      setEnrolledPage(1);
    } catch (err) {
      console.error('Error enrolling student:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unable to enroll student. Please try again.';
      showSweetAlert('Error', errorMessage, 'error');
    }
  };

  const handleDeadlineModalSuccess = () => {
    setFeedback({ type: 'success', message: 'Student enrolled and deadlines set successfully.' });
    setShowDeadlineModal(false);
    setDeadlineModalData(null);
  };

  const handleUnenrollStudent = async (studentId: number) => {
    if (!selectedCourseId) return;
    
    // Find student name for confirmation message
    const student = enrollments.find((s) => s.id === studentId);
    const studentName = student?.name || 'this student';
    
    // Show confirmation dialog
    showSweetAlert(
      'Confirm Removal',
      `Are you sure you want to remove ${studentName} from this course? This action cannot be undone.`,
      'warning',
      {
        showCancelButton: true,
        confirmButtonText: 'Yes, Remove',
        cancelButtonText: 'Cancel',
        onConfirm: async () => {
          try {
            setFeedback(null);
            if (role === 'Tutor' && userId) {
              await apiService.unenrollStudent(selectedCourseId, studentId, userId);
            } else {
              await apiService.unenrollStudent(selectedCourseId, studentId);
            }
            setEnrollments((prev) => prev.filter((student) => student.id !== studentId));
            showSweetAlert('Success!', `${studentName} has been removed from the course.`, 'success');
            setAvailablePage(1);
            setEnrolledPage(1);
          } catch (err) {
            console.error('Error unenrolling student:', err);
            const errorMessage = err instanceof Error ? err.message : 'Unable to remove student. Please try again.';
            showSweetAlert('Error', errorMessage, 'error');
          }
        }
      }
    );
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="text-[#11CCEF] font-medium">Loading student data...</div>
      </div>
    );
  }

  if (!courses.length) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">No courses available</h2>
        <p className="text-gray-600">
          {role === 'Tutor'
            ? 'Create a course or request access from an admin before enrolling students.'
            : 'Create a course to start enrolling students.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards - At the very top */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <div className="text-sm font-semibold text-gray-500 uppercase mb-2">Total Students</div>
          <div className="text-3xl font-bold text-gray-900">{stats.totalStudents}</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <div className="text-sm font-semibold text-gray-500 uppercase mb-2">Enrolled in Course</div>
          <div className="text-3xl font-bold text-gray-900">{stats.enrolled}</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <div className="text-sm font-semibold text-gray-500 uppercase mb-2">Not Assigned</div>
          <div className="text-3xl font-bold text-gray-900">{stats.notAssigned}</div>
        </div>
      </div>

      {/* Header Row */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        {/* Breadcrumb */}
        <div className="text-sm text-gray-500 mb-4">
          Tutor Dashboard › Student Insights › Enrollment
        </div>
        
        {/* Search and Filters */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              🔍 Search all students:
            </label>
            <input
              type="text"
              value={globalSearch}
              onChange={(e) => {
                setGlobalSearch(e.target.value);
                setAvailablePage(1);
                setEnrolledPage(1);
              }}
              placeholder="Search by name, email, or role..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter by date:</label>
              <div className="flex gap-2">
                {(['today', 'week', 'month', 'all'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => {
                      setDateFilter(filter);
                      setAvailablePage(1);
                      setEnrolledPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      dateFilter === filter
                        ? 'bg-[#11CCEF] text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                    }`}
                  >
                    {filter === 'all' ? 'All Time' : filter === 'today' ? 'Today' : filter === 'week' ? 'This Week' : 'This Month'}
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter by type:</label>
              <div className="flex gap-2">
                {(['all', 'enrolled', 'not_assigned'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => {
                      setTypeFilter(filter);
                      setAvailablePage(1);
                      setEnrolledPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      typeFilter === filter
                        ? 'bg-[#11CCEF] text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                    }`}
                  >
                    {filter === 'all' ? 'All' : filter === 'enrolled' ? 'Enrolled' : 'Not Assigned'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Student Enrollment Block */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Student Enrollment</h2>
            <p className="text-gray-600">Select a course and manage student enrollments.</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700" htmlFor="course-select">
              Course:
            </label>
            <select
              id="course-select"
              value={selectedCourseId ?? ''}
              onChange={(event) => {
                setSelectedCourseId(Number(event.target.value));
                setAvailablePage(1);
                setEnrolledPage(1);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF] min-w-[300px]"
            >
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {feedback && (
          <div
            className={`px-4 py-2 rounded-lg text-sm ${
              feedback.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-600'
            }`}
          >
            {feedback.message}
          </div>
        )}

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Available Students */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Students</h3>
            
            <div className="space-y-3 mb-4">
              <input
                type="text"
                value={availableSearch}
                onChange={(e) => {
                  setAvailableSearch(e.target.value);
                  setAvailablePage(1);
                }}
                placeholder="Search available:"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF] text-sm"
              />
              
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600">Rows per page:</label>
                <select
                  value={availableLimit}
                  onChange={(e) => {
                    setAvailableLimit(Number(e.target.value));
                    setAvailablePage(1);
                  }}
                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                
                <label className="text-sm text-gray-600 ml-auto">Sort:</label>
                <select
                  value={availableSort}
                  onChange={(e) => {
                    setAvailableSort(e.target.value as 'name' | 'date');
                    setAvailablePage(1);
                  }}
                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                >
                  <option value="name">Name A–Z</option>
                  <option value="date">Registered Date</option>
                </select>
              </div>
            </div>
            
            <div className="border-t border-gray-200 pt-3 space-y-2 max-h-[500px] overflow-y-auto">
              {paginatedAvailable.length === 0 ? (
                <div className="p-4 text-gray-500 text-sm text-center">No students available.</div>
              ) : (
                paginatedAvailable.map((student, index) => (
                  <div
                    key={`available-${student.id}-${index}-${student.email}`}
                    className="flex items-start justify-between p-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{student.name}</div>
                      <div className="text-sm text-gray-600">{student.email}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        Role: {student.role_name || 'Student'}
                      </div>
                      <div className="text-xs text-gray-500">
                        Registered: {formatDate(student.created_at)}
                      </div>
                    </div>
                    <button
                      onClick={() => handleEnrollStudent(student.id)}
                      className="ml-3 px-3 py-1.5 bg-[#11CCEF] text-white text-sm rounded-lg hover:bg-[#0daed9] flex items-center gap-1 whitespace-nowrap"
                      disabled={isLoadingEnrollments}
                    >
                      Enroll ➕
                    </button>
                  </div>
                ))
              )}
            </div>
            
            {/* Pagination */}
            {availableTotalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200">
                <button
                  onClick={() => setAvailablePage((p) => Math.max(1, p - 1))}
                  disabled={availablePage === 1}
                  className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  « Prev
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, availableTotalPages) }, (_, i) => {
                    let pageNum;
                    if (availableTotalPages <= 5) {
                      pageNum = i + 1;
                    } else if (availablePage <= 3) {
                      pageNum = i + 1;
                    } else if (availablePage >= availableTotalPages - 2) {
                      pageNum = availableTotalPages - 4 + i;
                    } else {
                      pageNum = availablePage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setAvailablePage(pageNum)}
                        className={`px-3 py-1 rounded text-sm ${
                          availablePage === pageNum
                            ? 'bg-[#11CCEF] text-white'
                            : 'border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  {availableTotalPages > 5 && <span className="px-2 text-sm text-gray-500">…</span>}
                </div>
                <button
                  onClick={() => setAvailablePage((p) => Math.min(availableTotalPages, p + 1))}
                  disabled={availablePage === availableTotalPages}
                  className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next »
                </button>
              </div>
            )}
          </div>

          {/* Enrolled Students */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Enrolled Students</h3>
            
            <div className="space-y-3 mb-4">
              <input
                type="text"
                value={enrolledSearch}
                onChange={(e) => {
                  setEnrolledSearch(e.target.value);
                  setEnrolledPage(1);
                }}
                placeholder="Search enrolled:"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF] text-sm"
              />
              
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600">Rows per page:</label>
                <select
                  value={enrolledLimit}
                  onChange={(e) => {
                    setEnrolledLimit(Number(e.target.value));
                    setEnrolledPage(1);
                  }}
                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                
                <label className="text-sm text-gray-600 ml-auto">Sort:</label>
                <select
                  value={enrolledSort}
                  onChange={(e) => {
                    setEnrolledSort(e.target.value as 'name' | 'date');
                    setEnrolledPage(1);
                  }}
                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                >
                  <option value="date">Enrolled date</option>
                  <option value="name">Name A–Z</option>
                </select>
              </div>
            </div>
            
            <div className="border-t border-gray-200 pt-3 space-y-2 max-h-[500px] overflow-y-auto">
              {isLoadingEnrollments ? (
                <div className="p-4 text-[#11CCEF] text-sm text-center">Loading enrollments...</div>
              ) : paginatedEnrolled.length === 0 ? (
                <div className="p-4 text-gray-500 text-sm text-center">No students enrolled in this course yet.</div>
              ) : (
                paginatedEnrolled.map((student, index) => (
                  <div
                    key={`enrolled-${student.id}-${index}-${student.email}`}
                    className="flex items-start justify-between p-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{student.name}</div>
                      <div className="text-sm text-gray-600">{student.email}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        Role: {student.role_name || 'Student'}
                      </div>
                      <div className="text-xs text-gray-500">
                        Enrolled: {formatDate(student.enrolled_at || student.created_at)}
                      </div>
                    </div>
                    <button
                      onClick={() => handleUnenrollStudent(student.id)}
                      className="ml-3 px-3 py-1.5 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 flex items-center gap-1 whitespace-nowrap"
                      disabled={isLoadingEnrollments}
                    >
                      Remove ❌
                    </button>
                  </div>
                ))
              )}
            </div>
            
            {/* Pagination */}
            {enrolledTotalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200">
                <button
                  onClick={() => setEnrolledPage((p) => Math.max(1, p - 1))}
                  disabled={enrolledPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  « Prev
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, enrolledTotalPages) }, (_, i) => {
                    let pageNum;
                    if (enrolledTotalPages <= 5) {
                      pageNum = i + 1;
                    } else if (enrolledPage <= 3) {
                      pageNum = i + 1;
                    } else if (enrolledPage >= enrolledTotalPages - 2) {
                      pageNum = enrolledTotalPages - 4 + i;
                    } else {
                      pageNum = enrolledPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setEnrolledPage(pageNum)}
                        className={`px-3 py-1 rounded text-sm ${
                          enrolledPage === pageNum
                            ? 'bg-[#11CCEF] text-white'
                            : 'border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  {enrolledTotalPages > 5 && <span className="px-2 text-sm text-gray-500">…</span>}
                </div>
                <button
                  onClick={() => setEnrolledPage((p) => Math.min(enrolledTotalPages, p + 1))}
                  disabled={enrolledPage === enrolledTotalPages}
                  className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next »
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Deadline Setup Modal */}
      {deadlineModalData && (
        <DeadlineSetupModal
          isOpen={showDeadlineModal}
          onClose={() => {
            setShowDeadlineModal(false);
            setDeadlineModalData(null);
          }}
          courseId={deadlineModalData.courseId}
          studentIds={deadlineModalData.studentIds}
          topics={deadlineModalData.topics}
          onSuccess={handleDeadlineModalSuccess}
        />
      )}
    </div>
  );
};

export default StudentEnrollment;
