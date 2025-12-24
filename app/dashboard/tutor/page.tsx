'use client';

import ProtectedRoute from '@/app/components/ProtectedRoute';
import CourseManagement from '@/app/components/CourseManagement';
import StudentEnrollment from '@/app/components/StudentEnrollment';
import StudentsProfileView from '@/app/components/StudentsProfileView';
import CertificateClaimsManagement from '@/app/components/CertificateClaimsManagement';
import { useEffect, useMemo, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { User, UserRole } from '@/app/components/types';
import { apiService } from '@/app/services/api';
import { showSweetAlert } from '@/app/components/SweetAlert';
import { Editor } from '@tinymce/tinymce-react';
import { getApiUrl } from '@/app/utils/apiUrl';

interface TutorAssignmentRow {
  assignment_id: number;
  assignment_title: string;
  course_id: number;
  course_title: string;
  student_id: number;
  student_name: string;
  student_email: string;
  submitted_at: string | null;
  grade: number | null;
  is_submitted: number;
  is_pass: number;
}

interface TutorQuizRow {
  attempt_id?: number; // Unique ID for CPD quiz attempts
  quiz_id: number;
  quiz_title: string;
  course_id: number;
  course_title: string;
  student_id: number;
  student_name: string;
  student_email: string;
  attempt_count: number;
  last_score: number | null;
  is_pass: number;
}

// Component to display total courses count
const TotalCoursesCountDisplay = ({ filterType }: { filterType: 'all' | 'cpd' | 'qualification' }) => {
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const user = JSON.parse(localStorage.getItem('lms-user') || '{}');
        const userId = user?.id;
        let response;
        if (userId) {
          response = await apiService.getTutorCourses(userId);
        } else {
          response = await apiService.getCourses();
        }
        if (response?.success && response?.courses) {
          let courses = response.courses;
          if (filterType !== 'all') {
            courses = courses.filter((c: any) => c.course_type === filterType);
          }
          setTotalCount(courses.length);
        }
      } catch (error) {
        console.error('Error fetching course count:', error);
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

const TutorDashboard = () => {
  const router = useRouter();
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('courses');
  const [courseTypeFilter, setCourseTypeFilter] = useState<'all' | 'cpd' | 'qualification'>('all');
  const [assignmentRows, setAssignmentRows] = useState<TutorAssignmentRow[]>([]);
  const [quizRows, setQuizRows] = useState<TutorQuizRow[]>([]);
  const [qualSubmissions, setQualSubmissions] = useState<any[]>([]);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);
  const [assessmentLoading, setAssessmentLoading] = useState<boolean>(false);
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [quizSearch, setQuizSearch] = useState('');
  const [showAttemptsModal, setShowAttemptsModal] = useState(false);
  const [selectedQuizAttempts, setSelectedQuizAttempts] = useState<any[]>([]);
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [gradeForm, setGradeForm] = useState({ pass_fail_result: 'pass', feedback: '' });
  
  // Date filter states for assignments (removed - not using anymore)
  const [assignmentDateFilter, setAssignmentDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('today');
  const [assignmentDateFrom, setAssignmentDateFrom] = useState<string>('');
  const [assignmentDateTo, setAssignmentDateTo] = useState<string>('');
  
  // Pagination states for assignments (removed - not using anymore)
  const [assignmentPage, setAssignmentPage] = useState(1);
  const [assignmentLimit, setAssignmentLimit] = useState(25);
  
  // Date filter states for quiz
  const [quizDateFilter, setQuizDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('today');
  const [quizDateFrom, setQuizDateFrom] = useState<string>('');
  const [quizDateTo, setQuizDateTo] = useState<string>('');
  
  // Pagination states for quiz
  const [quizPage, setQuizPage] = useState(1);
  const [quizLimit, setQuizLimit] = useState(25);
  
  // Filter and pagination states for Qualification Submissions
  const [qualSearch, setQualSearch] = useState('');
  const [qualDateFilter, setQualDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('today');
  const [qualDateFrom, setQualDateFrom] = useState<string>('');
  const [qualDateTo, setQualDateTo] = useState<string>('');
  const [qualPage, setQualPage] = useState(1);
  const [qualLimit, setQualLimit] = useState(25);
  const [qualRefreshing, setQualRefreshing] = useState(false);
  const [qualLastRefreshed, setQualLastRefreshed] = useState<Date | null>(null);

  useEffect(() => {
    try {
      const stored: User | null = JSON.parse(localStorage.getItem('lms-user') || 'null');
      if (stored) {
        setUser(stored);
        setUserRole(stored.role || null);
      } else {
        setUserRole(null);
      }
    } catch (err) {
      console.error('Error parsing stored user:', err);
      setUserRole(null);
    }
  }, []);

  // Reset pagination when filters change
  useEffect(() => {
    setAssignmentPage(1);
  }, [assignmentDateFilter, assignmentDateFrom, assignmentDateTo, assignmentSearch]);

  useEffect(() => {
    setQuizPage(1);
  }, [quizDateFilter, quizDateFrom, quizDateTo, quizSearch]);

  useEffect(() => {
    setQualPage(1);
  }, [qualDateFilter, qualDateFrom, qualDateTo, qualSearch]);

  useEffect(() => {
    if (!user?.id) return;
    
    const loadAssessments = async (tutorId: number) => {
      setAssessmentLoading(true);
      setAssessmentError(null);
      try {
        console.log('[Tutor Dashboard] Loading assessments for tutor:', tutorId);
        
        const [assignmentRes, quizRes, cpdQuizRes, qualSubmissionsRes] = await Promise.all([
          apiService.getTutorAssignmentSubmissions(tutorId),
          apiService.getTutorQuizAttempts(tutorId),
          apiService.getCPDQuizAttemptsForTutor(tutorId),
          fetch(`${getApiUrl()}/api/qualification/submissions/all`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('lms-token')}`,
              'Content-Type': 'application/json'
            }
          }).then(async (res) => {
            if (!res.ok) {
              console.error('[Tutor Dashboard] Qualification submissions API error:', res.status, res.statusText);
              const errorText = await res.text();
              console.error('[Tutor Dashboard] Error response:', errorText);
              return { success: false, submissions: [] };
            }
            return res.json();
          }).catch((error) => {
            console.error('[Tutor Dashboard] Error fetching qualification submissions:', error);
            return { success: false, submissions: [] };
          })
        ]);

        console.log('[Tutor Dashboard] CPD Quiz attempts:', cpdQuizRes);
        console.log('[Tutor Dashboard] Qualification submissions response:', qualSubmissionsRes);
        console.log('[Tutor Dashboard] Qualification submissions count:', qualSubmissionsRes?.submissions?.length || 0);

        setAssignmentRows(
          (assignmentRes?.submissions ?? []).map((row: any) => ({
            ...row,
            grade: row.grade !== null ? Number(row.grade) : null,
            is_submitted: Number(row.is_submitted),
            is_pass: Number(row.is_pass)
          }))
        );
        
        const submissions = qualSubmissionsRes?.submissions ?? [];
        console.log('[Tutor Dashboard] Setting qualification submissions:', submissions.length, submissions);
        setQualSubmissions(submissions);
        setQualLastRefreshed(new Date());

        // Combine regular quizzes and CPD quizzes
        const regularQuizzes = (quizRes?.attempts ?? []).map((row: any) => ({
          ...row,
          attempt_count: Number(row.attempt_count),
          last_score: row.last_score !== null ? Number(row.last_score) : null,
          is_pass: Number(row.is_pass),
          quiz_type: 'regular'
        }));

        // Store ALL CPD attempts for the modal
        const allCpdAttempts = (cpdQuizRes?.attempts ?? []).map((row: any) => ({
          attempt_id: row.attempt_id,
          quiz_id: row.quiz_id,
          quiz_title: row.quiz_title,
          course_id: row.course_id,
          course_title: row.course_title,
          student_id: row.student_id,
          student_name: row.student_name,
          student_email: row.student_email,
          score: row.percentage,
          status: row.status,
          completed_at: row.completed_at,
          topic_title: row.topic_title,
          passing_score: row.passing_score
        }));

        // Group CPD attempts by student + quiz, show only LATEST attempt in main table
        const cpdQuizGroups = new Map<string, any[]>();
        allCpdAttempts.forEach((attempt: any) => {
          const key = `${attempt.quiz_id}-${attempt.student_id}`;
          if (!cpdQuizGroups.has(key)) {
            cpdQuizGroups.set(key, []);
          }
          cpdQuizGroups.get(key)!.push(attempt);
        });

        // Create display rows with LATEST attempt + total count
        const cpdQuizzes = Array.from(cpdQuizGroups.entries()).map(([key, attempts]) => {
          // Sort by completed_at DESC to get latest first
          const sortedAttempts = attempts.sort((a, b) => 
            new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
          );
          const latestAttempt = sortedAttempts[0];
          
          return {
            attempt_id: latestAttempt.attempt_id,
            quiz_id: latestAttempt.quiz_id,
            quiz_title: `${latestAttempt.quiz_title} (🏁 Final Test)`,
            course_id: latestAttempt.course_id,
            course_title: latestAttempt.course_title,
            student_id: latestAttempt.student_id,
            student_name: latestAttempt.student_name,
            student_email: latestAttempt.student_email,
            attempt_count: sortedAttempts.length, // Total attempts
            last_score: latestAttempt.score,
            is_pass: latestAttempt.status === 'passed' ? 1 : 0,
            quiz_type: 'cpd',
            topic_title: latestAttempt.topic_title,
            completed_at: latestAttempt.completed_at,
            all_attempts: sortedAttempts // Store all attempts for modal
          };
        });

        const combinedQuizzes = [...regularQuizzes, ...cpdQuizzes].sort((a: any, b: any) => {
          const dateA = new Date(a.completed_at || 0).getTime();
          const dateB = new Date(b.completed_at || 0).getTime();
          return dateB - dateA;
        });

        console.log('[Tutor Dashboard] Regular quizzes:', regularQuizzes.length);
        console.log('[Tutor Dashboard] CPD quizzes:', cpdQuizzes.length);
        console.log('[Tutor Dashboard] Combined quizzes:', combinedQuizzes.length);
        console.log('[Tutor Dashboard] Combined quiz data:', combinedQuizzes);

        setQuizRows(combinedQuizzes);
      } catch (err) {
        console.error('Error loading tutor assessments:', err);
        setAssessmentError('Unable to load assignments and quizzes right now.');
        setAssignmentRows([]);
        setQuizRows([]);
        setQualSubmissions([]);
      } finally {
        setAssessmentLoading(false);
      }
    };
    
    loadAssessments(user.id);
  }, [user?.id]);

  // Refresh function for qualification submissions
  const refreshQualificationSubmissions = async () => {
    if (!user?.id) return;
    
    setQualRefreshing(true);
    try {
      const apiUrl = getApiUrl();
      const qualSubmissionsRes = await fetch(`${apiUrl}/api/qualification/submissions/all`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('lms-token')}`,
          'Content-Type': 'application/json'
        }
      }).then(async (res) => {
        if (!res.ok) {
          console.error('[Tutor Dashboard] Qualification submissions API error:', res.status, res.statusText);
          return { success: false, submissions: [] };
        }
        return res.json();
      }).catch((error) => {
        console.error('[Tutor Dashboard] Error fetching qualification submissions:', error);
        return { success: false, submissions: [] };
      });

      const submissions = qualSubmissionsRes?.submissions ?? [];
      setQualSubmissions(submissions);
      setQualLastRefreshed(new Date());
    } catch (error) {
      console.error('Error refreshing qualification submissions:', error);
    } finally {
      setQualRefreshing(false);
    }
  };

  const tabs = useMemo(
    () => [
      { id: 'courses', name: 'Course Management', icon: '📚' },
      { id: 'students', name: 'Student Insights', icon: '👥' },
      { id: 'students-profile', name: 'Students Profile', icon: '👤' },
      { id: 'assignments', name: 'Assignments', icon: '📝' },
      { id: 'quiz', name: 'Quiz', icon: '❓' },
      { id: 'chat', name: 'Chat', icon: '💬' },
      { id: 'forums', name: 'Forums', icon: '💭' },
      { id: 'certificates', name: 'Certificates & Badges', icon: '🏆' },
      { id: 'totalcourses', name: 'Total Courses', icon: '📚' }
    ],
    []
  );

  // Helper function to get date range based on filter
  const getDateRange = (filter: 'all' | 'today' | 'week' | 'month' | 'custom', fromDate?: string, toDate?: string) => {
    const now = new Date();
    now.setHours(23, 59, 59, 999); // End of today
    
    switch (filter) {
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
      case 'custom': {
        if (fromDate && toDate) {
          const start = new Date(fromDate);
          start.setHours(0, 0, 0, 0);
          const end = new Date(toDate);
          end.setHours(23, 59, 59, 999);
          return { start, end };
        }
        return null;
      }
      default:
        return null;
    }
  };

  const filteredAssignments = useMemo(() => {
    let filtered = assignmentRows;
    
    // Apply search filter
    const query = assignmentSearch.trim().toLowerCase();
    if (query) {
      filtered = filtered.filter((row) =>
        [row.course_title, row.assignment_title, row.student_name, row.student_email]
          .filter(Boolean)
          .some((field) => field.toLowerCase().includes(query))
      );
    }
    
    // Apply date filter
    if (assignmentDateFilter !== 'all') {
      const dateRange = getDateRange(assignmentDateFilter, assignmentDateFrom, assignmentDateTo);
      if (dateRange) {
        filtered = filtered.filter((row) => {
          // For assignments, filter by submitted_at date
          if (!row.submitted_at) {
            // Pending assignments (not submitted) are excluded from date filtering
            return false;
          }
          try {
            const submittedDate = new Date(row.submitted_at);
            // Reset time to start of day for accurate comparison
            submittedDate.setHours(0, 0, 0, 0);
            const rangeStart = new Date(dateRange.start);
            rangeStart.setHours(0, 0, 0, 0);
            const rangeEnd = new Date(dateRange.end);
            rangeEnd.setHours(23, 59, 59, 999);
            
            return submittedDate >= rangeStart && submittedDate <= rangeEnd;
          } catch (e) {
            console.error('Error parsing date:', row.submitted_at, e);
            return false;
          }
        });
      }
    }
    
    return filtered;
  }, [assignmentRows, assignmentSearch, assignmentDateFilter, assignmentDateFrom, assignmentDateTo]);

  // Paginated assignments
  const paginatedAssignments = useMemo(() => {
    const start = (assignmentPage - 1) * assignmentLimit;
    const end = start + assignmentLimit;
    return filteredAssignments.slice(start, end);
  }, [filteredAssignments, assignmentPage, assignmentLimit]);

  const assignmentTotalPages = Math.ceil(filteredAssignments.length / assignmentLimit);

  const filteredQuizzes = useMemo(() => {
    let filtered = quizRows;
    
    // Apply search filter
    const query = quizSearch.trim().toLowerCase();
    if (query) {
      filtered = filtered.filter((row) =>
        [row.course_title, row.quiz_title, row.student_name, row.student_email]
          .filter(Boolean)
          .some((field) => field.toLowerCase().includes(query))
      );
    }
    
    // Apply date filter
    if (quizDateFilter !== 'all') {
      const dateRange = getDateRange(quizDateFilter, quizDateFrom, quizDateTo);
      if (dateRange) {
        filtered = filtered.filter((row) => {
          const completedAt = (row as any).completed_at;
          if (!completedAt) return false;
          try {
            const completedDate = new Date(completedAt);
            // Reset time to start of day for accurate comparison
            completedDate.setHours(0, 0, 0, 0);
            const rangeStart = new Date(dateRange.start);
            rangeStart.setHours(0, 0, 0, 0);
            const rangeEnd = new Date(dateRange.end);
            rangeEnd.setHours(23, 59, 59, 999);
            
            return completedDate >= rangeStart && completedDate <= rangeEnd;
          } catch (e) {
            console.error('Error parsing date:', completedAt, e);
            return false;
          }
        });
      }
    }
    
    return filtered;
  }, [quizRows, quizSearch, quizDateFilter, quizDateFrom, quizDateTo]);

  // Paginated quizzes
  const paginatedQuizzes = useMemo(() => {
    const start = (quizPage - 1) * quizLimit;
    const end = start + quizLimit;
    return filteredQuizzes.slice(start, end);
  }, [filteredQuizzes, quizPage, quizLimit]);

  const quizTotalPages = Math.ceil(filteredQuizzes.length / quizLimit);

  // Filtered and paginated qualification submissions
  const filteredQualSubmissions = useMemo(() => {
    let filtered = qualSubmissions;
    
    // Apply search filter
    const query = qualSearch.trim().toLowerCase();
    if (query) {
      filtered = filtered.filter((submission) =>
        [
          submission.course_title,
          submission.unit_title,
          submission.student_name,
          submission.student_email,
          submission.submission_type
        ]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(query))
      );
    }
    
    // Apply date filter
    if (qualDateFilter !== 'all') {
      const dateRange = getDateRange(qualDateFilter, qualDateFrom, qualDateTo);
      if (dateRange) {
        filtered = filtered.filter((submission) => {
          if (!submission.submitted_at) return false;
          try {
            const submittedDate = new Date(submission.submitted_at);
            submittedDate.setHours(0, 0, 0, 0);
            const rangeStart = new Date(dateRange.start);
            rangeStart.setHours(0, 0, 0, 0);
            const rangeEnd = new Date(dateRange.end);
            rangeEnd.setHours(23, 59, 59, 999);
            
            return submittedDate >= rangeStart && submittedDate <= rangeEnd;
          } catch (e) {
            console.error('Error parsing date:', submission.submitted_at, e);
            return false;
          }
        });
      }
    }
    
    return filtered;
  }, [qualSubmissions, qualSearch, qualDateFilter, qualDateFrom, qualDateTo]);

  const paginatedQualSubmissions = useMemo(() => {
    const start = (qualPage - 1) * qualLimit;
    const end = start + qualLimit;
    return filteredQualSubmissions.slice(start, end);
  }, [filteredQualSubmissions, qualPage, qualLimit]);

  const qualTotalPages = Math.ceil(filteredQualSubmissions.length / qualLimit);

  const renderPlaceholder = (title: string, description: string) => (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 text-center">
      <div className="text-4xl mb-4">🚧</div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">{title}</h2>
      <p className="text-gray-600 max-w-2xl mx-auto">{description}</p>
      <p className="text-xs text-gray-400 mt-4">
        This module will reuse the admin tools with tutor-level permissions.
      </p>
    </div>
  );

  return (
    <ProtectedRoute allowedRoles={['Tutor']} userRole={userRole}>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Tutor Dashboard</h1>
                <p className="text-gray-600 mt-1">
                  Welcome back, {user?.name || 'Tutor'}! Access the same layout as the admin dashboard with
                  tools tailored to tutor responsibilities.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#11CCEF] rounded-lg flex items-center justify-center text-white font-semibold">
                  {user?.name?.charAt(0) || 'T'}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex">
          {/* Sidebar */}
          <div className="w-64 bg-white shadow-sm min-h-screen border-r border-gray-200">
            <nav className="p-4">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                Navigation
              </h2>
              <ul className="space-y-1">
                {tabs.map((tab) => (
                  <li key={tab.id}>
                    <button
                      onClick={() => {
                        if (tab.id === 'forums') {
                          router.push('/dashboard/forum');
                        } else {
                          setActiveTab(tab.id);
                        }
                      }}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-3 ${
                        activeTab === tab.id
                          ? 'bg-[#11CCEF] text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <span className="text-lg">{tab.icon}</span>
                      <span className="font-medium">{tab.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1 p-6 space-y-6">
            {activeTab === 'courses' && (
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Course Management</h2>
                <p className="text-gray-600 mb-6">
                  Tutors leverage the same reusable course management component as admins—create units, upload
                  files, manage quizzes, and track progress without duplicated code.
                </p>
                <CourseManagement />
              </div>
            )}

            {/* Total Courses Tab */}
            {activeTab === 'totalcourses' && (
              <div className="space-y-4">
                {/* Filter Buttons */}
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-2xl font-semibold text-gray-900">Total Courses</h2>
                      <p className="text-sm text-gray-600 mt-1">
                        View and manage all courses in the system
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
                  {/* Total Count Display */}
                  <TotalCoursesCountDisplay filterType={courseTypeFilter} />
                </div>
                {/* Course Management Component */}
                <CourseManagement filterType={courseTypeFilter} showControls={false} />
              </div>
            )}

            {activeTab === 'students' && (
              <StudentEnrollment role={userRole} userId={user?.id} />
            )}

            {activeTab === 'students-profile' && (
              <StudentsProfileView userRole="Tutor" userId={user?.id} />
            )}

            {/* Assignments Tab */}
            {activeTab === 'assignments' && (
              <div className="space-y-6">
                {/* Qualification Submissions Section */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">📜 Qualification Course Submissions</h2>
                      <p className="text-gray-600">
                        Grade assignments and presentations from qualification courses. Passing grades automatically unlock the next unit.
                      </p>
                      {qualLastRefreshed && (
                        <p className="text-xs text-gray-500 mt-1">
                          Last refreshed: {qualLastRefreshed.toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={qualSearch}
                        onChange={(event) => {
                          setQualSearch(event.target.value);
                          setQualPage(1);
                        }}
                        placeholder="Search by course, unit, student, or type..."
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF] w-full md:w-80"
                      />
                      <button
                        onClick={refreshQualificationSubmissions}
                        disabled={qualRefreshing}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                          qualRefreshing
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-[#11CCEF] text-white hover:bg-[#0daed9]'
                        }`}
                        title="Refresh to check for new assignments"
                      >
                        {qualRefreshing ? (
                          <>
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Refreshing...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Refresh
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Date Filter for Qualification Submissions */}
                  <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex flex-wrap items-center gap-3 mb-3">
                      <span className="text-sm font-semibold text-gray-700">Filter by Date:</span>
                      <button
                        onClick={() => {
                          setQualDateFilter('all');
                          setQualPage(1);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          qualDateFilter === 'all'
                            ? 'bg-[#11CCEF] text-white'
                            : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                        }`}
                      >
                        All
                      </button>
                      <button
                        onClick={() => {
                          setQualDateFilter('today');
                          setQualPage(1);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          qualDateFilter === 'today'
                            ? 'bg-[#11CCEF] text-white'
                            : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                        }`}
                      >
                        Today
                      </button>
                      <button
                        onClick={() => {
                          setQualDateFilter('week');
                          setQualPage(1);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          qualDateFilter === 'week'
                            ? 'bg-[#11CCEF] text-white'
                            : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                        }`}
                      >
                        This Week
                      </button>
                      <button
                        onClick={() => {
                          setQualDateFilter('month');
                          setQualPage(1);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          qualDateFilter === 'month'
                            ? 'bg-[#11CCEF] text-white'
                            : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                        }`}
                      >
                        This Month
                      </button>
                      <button
                        onClick={() => {
                          setQualDateFilter('custom');
                          setQualPage(1);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          qualDateFilter === 'custom'
                            ? 'bg-[#11CCEF] text-white'
                            : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                        }`}
                      >
                        Custom Range
                      </button>
                    </div>
                    {qualDateFilter === 'custom' && (
                      <div className="flex flex-wrap items-center gap-3 mt-3">
                        <div className="flex items-center gap-2">
                          <label className="text-sm font-medium text-gray-700">From:</label>
                          <input
                            type="date"
                            value={qualDateFrom}
                            onChange={(e) => {
                              setQualDateFrom(e.target.value);
                              setQualPage(1);
                            }}
                            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-sm font-medium text-gray-700">To:</label>
                          <input
                            type="date"
                            value={qualDateTo}
                            onChange={(e) => {
                              setQualDateTo(e.target.value);
                              setQualPage(1);
                            }}
                            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {assessmentLoading ? (
                    <div className="text-[#11CCEF]">Loading submissions...</div>
                  ) : assessmentError ? (
                    <div className="bg-red-50 text-red-600 border border-red-200 rounded-lg px-4 py-3">
                      {assessmentError}
                    </div>
                  ) : filteredQualSubmissions.length === 0 ? (
                    <div className="text-gray-500">No qualification submissions found.</div>
                  ) : (
                    <>
                      <div className="mb-4 flex items-center justify-between text-sm text-gray-600">
                        <div>
                          Showing {((qualPage - 1) * qualLimit) + 1} to {Math.min(qualPage * qualLimit, filteredQualSubmissions.length)} of {filteredQualSubmissions.length} submissions
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-sm font-medium">Items per page:</label>
                          <select
                            value={qualLimit}
                            onChange={(e) => {
                              setQualLimit(Number(e.target.value));
                              setQualPage(1);
                            }}
                            className="px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
                          >
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                          </select>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Course
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Unit
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Student
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Type
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Submitted
                              </th>
                              <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {paginatedQualSubmissions.map((submission) => (
                            <tr key={submission.submission_id} className={submission.status === 'submitted' ? 'bg-yellow-50' : ''}>
                              <td className="px-4 py-2 text-sm text-gray-700">{submission.course_title}</td>
                              <td className="px-4 py-2 text-sm text-gray-900 font-medium">
                                Unit {submission.unit_order}: {submission.unit_title}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-600">
                                <div className="font-medium text-gray-900">{submission.student_name}</div>
                                <div className="text-xs text-gray-500">{submission.student_email}</div>
                              </td>
                              <td className="px-4 py-2 text-sm">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                                  submission.submission_type === 'assignment' 
                                    ? 'bg-orange-100 text-orange-700' 
                                    : 'bg-pink-100 text-pink-700'
                                }`}>
                                  {submission.submission_type === 'assignment' ? '📝 Assignment' : '🎤 Presentation'}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-600">
                                {new Date(submission.submitted_at).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-2 text-sm text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {submission.status === 'graded' ? (
                                    <>
                                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                                        submission.pass_fail_result === 'pass' 
                                          ? 'bg-green-100 text-green-700' 
                                          : submission.pass_fail_result === 'refer'
                                          ? 'bg-orange-100 text-orange-700'
                                          : 'bg-gray-100 text-gray-700'
                                      }`}>
                                        {submission.pass_fail_result === 'pass' ? '✅ Pass' : submission.pass_fail_result === 'refer' ? '⚠️ Refer' : '⏳ Pending'}
                                      </span>
                                      <button 
                                        onClick={() => window.open(`${getApiUrl()}/api/admin/proxy-pdf?url=${encodeURIComponent(submission.file_path)}`, '_blank')}
                                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700"
                                      >
                                        View File
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
                                        ⏳ Awaiting Grade
                                      </span>
                                      <button 
                                        onClick={() => window.open(`${getApiUrl()}/api/admin/proxy-pdf?url=${encodeURIComponent(submission.file_path)}`, '_blank')}
                                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700"
                                      >
                                        View File
                                      </button>
                                      <button 
                                        onClick={() => {
                                          setSelectedSubmission(submission);
                                          setGradeForm({ pass_fail_result: 'pass', feedback: '' });
                                          setShowGradeModal(true);
                                        }}
                                        className="px-3 py-1.5 bg-[#E51791] text-white rounded-lg text-xs font-semibold hover:bg-[#c0146f]"
                                      >
                                        Grade Now
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      
                      {/* Pagination Controls for Qualification Submissions */}
                      {qualTotalPages > 1 && (
                        <div className="mt-4 flex items-center justify-between">
                          <button
                            onClick={() => setQualPage(p => Math.max(1, p - 1))}
                            disabled={qualPage === 1}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                              qualPage === 1
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-[#11CCEF] text-white hover:bg-[#0daed9]'
                            }`}
                          >
                            Previous
                          </button>
                          <div className="flex items-center gap-2">
                            {Array.from({ length: Math.min(5, qualTotalPages) }, (_, i) => {
                              let pageNum;
                              if (qualTotalPages <= 5) {
                                pageNum = i + 1;
                              } else if (qualPage <= 3) {
                                pageNum = i + 1;
                              } else if (qualPage >= qualTotalPages - 2) {
                                pageNum = qualTotalPages - 4 + i;
                              } else {
                                pageNum = qualPage - 2 + i;
                              }
                              return (
                                <button
                                  key={pageNum}
                                  onClick={() => setQualPage(pageNum)}
                                  className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                                    qualPage === pageNum
                                      ? 'bg-[#11CCEF] text-white'
                                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                  }`}
                                >
                                  {pageNum}
                                </button>
                              );
                            })}
                          </div>
                          <div className="text-sm text-gray-600">
                            Page {qualPage} of {qualTotalPages}
                          </div>
                          <button
                            onClick={() => setQualPage(p => Math.min(qualTotalPages, p + 1))}
                            disabled={qualPage === qualTotalPages}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                              qualPage === qualTotalPages
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-[#11CCEF] text-white hover:bg-[#0daed9]'
                            }`}
                          >
                            Next
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Quiz Tab */}
            {activeTab === 'quiz' && (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">Quiz Performance</h2>
                      <p className="text-gray-600">
                        Review all quiz attempts across your courses, monitor student performance, and track scores.
                      </p>
                    </div>
                    <input
                      type="text"
                      value={quizSearch}
                      onChange={(event) => {
                        setQuizSearch(event.target.value);
                        setQuizPage(1);
                      }}
                      placeholder="Search by course, quiz, or student..."
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF] w-full md:w-80"
                    />
                  </div>

                  {/* Date Filter for Quiz */}
                  <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex flex-wrap items-center gap-3 mb-3">
                      <span className="text-sm font-semibold text-gray-700">Filter by Date:</span>
                      <button
                        onClick={() => {
                          setQuizDateFilter('all');
                          setQuizPage(1);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          quizDateFilter === 'all'
                            ? 'bg-[#11CCEF] text-white'
                            : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                        }`}
                      >
                        All
                      </button>
                      <button
                        onClick={() => {
                          setQuizDateFilter('today');
                          setQuizPage(1);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          quizDateFilter === 'today'
                            ? 'bg-[#11CCEF] text-white'
                            : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                        }`}
                      >
                        Today
                      </button>
                      <button
                        onClick={() => {
                          setQuizDateFilter('week');
                          setQuizPage(1);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          quizDateFilter === 'week'
                            ? 'bg-[#11CCEF] text-white'
                            : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                        }`}
                      >
                        This Week
                      </button>
                      <button
                        onClick={() => {
                          setQuizDateFilter('month');
                          setQuizPage(1);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          quizDateFilter === 'month'
                            ? 'bg-[#11CCEF] text-white'
                            : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                        }`}
                      >
                        This Month
                      </button>
                      <button
                        onClick={() => {
                          setQuizDateFilter('custom');
                          setQuizPage(1);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          quizDateFilter === 'custom'
                            ? 'bg-[#11CCEF] text-white'
                            : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                        }`}
                      >
                        Custom Range
                      </button>
                    </div>
                    {quizDateFilter === 'custom' && (
                      <div className="flex flex-wrap items-center gap-3 mt-3">
                        <div className="flex items-center gap-2">
                          <label className="text-sm font-medium text-gray-700">From:</label>
                          <input
                            type="date"
                            value={quizDateFrom}
                            onChange={(e) => {
                              setQuizDateFrom(e.target.value);
                              setQuizPage(1);
                            }}
                            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-sm font-medium text-gray-700">To:</label>
                          <input
                            type="date"
                            value={quizDateTo}
                            onChange={(e) => {
                              setQuizDateTo(e.target.value);
                              setQuizPage(1);
                            }}
                            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  {assessmentLoading ? (
                    <div className="text-[#11CCEF]">Loading quizzes...</div>
                  ) : assessmentError ? (
                    <div className="bg-red-50 text-red-600 border border-red-200 rounded-lg px-4 py-3">
                      {assessmentError}
                    </div>
                  ) : filteredQuizzes.length === 0 ? (
                    <div className="text-gray-500">No quiz attempts found.</div>
                  ) : (
                    <>
                      <div className="mb-4 flex items-center justify-between text-sm text-gray-600">
                        <div>
                          Showing {((quizPage - 1) * quizLimit) + 1} to {Math.min(quizPage * quizLimit, filteredQuizzes.length)} of {filteredQuizzes.length} quiz attempts
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-sm font-medium">Items per page:</label>
                          <select
                            value={quizLimit}
                            onChange={(e) => {
                              setQuizLimit(Number(e.target.value));
                              setQuizPage(1);
                            }}
                            className="px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
                          >
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                          </select>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Course
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Quiz
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Student
                              </th>
                              <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {paginatedQuizzes.map((row) => (
                            <tr key={row.attempt_id ? `attempt-${row.attempt_id}` : `${row.quiz_id}-${row.student_id}`}>
                              <td className="px-4 py-2 text-sm text-gray-700">{row.course_title}</td>
                              <td className="px-4 py-2 text-sm text-gray-900 font-medium">{row.quiz_title}</td>
                              <td className="px-4 py-2 text-sm text-gray-600">
                                <div className="font-medium text-gray-900">{row.student_name}</div>
                                <div className="text-xs text-gray-500">{row.student_email}</div>
                              </td>
                              <td className="px-4 py-2 text-sm text-right">
                                <div className="flex items-center justify-end gap-3">
                                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                                    Attempts: {row.attempt_count}
                                  </span>
                                  <span
                                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                                      row.is_pass
                                        ? 'bg-green-100 text-green-700'
                                        : row.attempt_count > 0
                                        ? 'bg-red-100 text-red-600'
                                        : 'bg-gray-100 text-gray-500'
                                    }`}
                                  >
                                    {row.is_pass ? 'Pass' : row.attempt_count > 0 ? 'Needs Review' : 'No Attempt'}
                                  </span>
                                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                                    Last Score:{' '}
                                    {row.last_score !== null ? `${row.last_score}%` : 'N/A'}
                                  </span>
                                  <button 
                                    onClick={() => {
                                      // For CPD quizzes, show all attempts modal
                                      if ((row as any).all_attempts) {
                                        setSelectedQuizAttempts((row as any).all_attempts);
                                        setShowAttemptsModal(true);
                                      }
                                    }}
                                    className="px-3 py-1.5 bg-[#11CCEF] text-white rounded-lg text-xs font-semibold hover:bg-[#0daed9] transition-colors"
                                  >
                                    Review Attempts
                                  </button>
                                </div>
                              </td>
                            </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      
                      {/* Pagination Controls for Quiz */}
                      {quizTotalPages > 1 && (
                        <div className="mt-4 flex items-center justify-between">
                          <button
                            onClick={() => setQuizPage(p => Math.max(1, p - 1))}
                            disabled={quizPage === 1}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                              quizPage === 1
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-[#11CCEF] text-white hover:bg-[#0daed9]'
                            }`}
                          >
                            Previous
                          </button>
                          <div className="flex items-center gap-2">
                            {Array.from({ length: Math.min(5, quizTotalPages) }, (_, i) => {
                              let pageNum;
                              if (quizTotalPages <= 5) {
                                pageNum = i + 1;
                              } else if (quizPage <= 3) {
                                pageNum = i + 1;
                              } else if (quizPage >= quizTotalPages - 2) {
                                pageNum = quizTotalPages - 4 + i;
                              } else {
                                pageNum = quizPage - 2 + i;
                              }
                              return (
                                <button
                                  key={pageNum}
                                  onClick={() => setQuizPage(pageNum)}
                                  className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                                    quizPage === pageNum
                                      ? 'bg-[#11CCEF] text-white'
                                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                  }`}
                                >
                                  {pageNum}
                                </button>
                              );
                            })}
                          </div>
                          <div className="text-sm text-gray-600">
                            Page {quizPage} of {quizTotalPages}
                          </div>
                          <button
                            onClick={() => setQuizPage(p => Math.min(quizTotalPages, p + 1))}
                            disabled={quizPage === quizTotalPages}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                              quizPage === quizTotalPages
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-[#11CCEF] text-white hover:bg-[#0daed9]'
                            }`}
                          >
                            Next
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Chat Tab - Direct redirect to /chat */}
            {activeTab === 'chat' && (
              <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200">
                <div className="max-w-2xl mx-auto text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Chat with Students & Admins</h2>
                  <p className="text-gray-600 mb-8">
                    Open the full chat interface to communicate with your students and administrators in real-time.
                  </p>
                  <button
                    onClick={() => window.location.href = '/chat'}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-cyan-600 transform hover:scale-105 transition-all duration-300 shadow-lg"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    Open Chat
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'forums' &&
              renderPlaceholder(
                'Forums & Announcements',
                'Engage with course forums, respond to comments, and create announcements via the shared communication components.'
              )}

            {activeTab === 'certificates' && (
              <CertificateClaimsManagement />
            )}
          </div>
        </div>
      </div>

      {/* Quiz Attempts Modal */}
      {showAttemptsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#11CCEF] to-[#0daed9] px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-white">All Quiz Attempts</h3>
                {selectedQuizAttempts.length > 0 && (
                  <p className="text-white text-sm opacity-90 mt-1">
                    {selectedQuizAttempts[0].student_name} - {selectedQuizAttempts[0].course_title}
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  setShowAttemptsModal(false);
                  setSelectedQuizAttempts([]);
                }}
                className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {selectedQuizAttempts.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No attempts found
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedQuizAttempts.map((attempt, index) => (
                    <div
                      key={attempt.attempt_id}
                      className={`border-2 rounded-lg p-4 transition-all ${
                        index === 0
                          ? 'border-blue-300 bg-blue-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          {/* Attempt Number */}
                          <div className={`flex items-center justify-center w-12 h-12 rounded-full font-bold text-lg ${
                            index === 0 
                              ? 'bg-blue-500 text-white' 
                              : 'bg-gray-200 text-gray-700'
                          }`}>
                            #{selectedQuizAttempts.length - index}
                          </div>

                          {/* Attempt Details */}
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                                attempt.status === 'passed'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-600'
                              }`}>
                                {attempt.status === 'passed' ? '✓ Pass' : '✗ Needs Review'}
                              </span>
                              {index === 0 && (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                                  Latest Attempt
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-600">
                              Completed: {new Date(attempt.completed_at).toLocaleString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Score */}
                        <div className="text-right">
                          <div className="text-3xl font-bold text-gray-900">
                            {attempt.score}%
                          </div>
                          <div className="text-xs text-gray-500">
                            Passing: {attempt.passing_score}%
                          </div>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-3">
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div
                            className={`h-2.5 rounded-full transition-all ${
                              attempt.status === 'passed' ? 'bg-green-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(attempt.score, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t px-6 py-4 bg-gray-50 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Total Attempts: <span className="font-semibold text-gray-900">{selectedQuizAttempts.length}</span>
              </div>
              <button
                onClick={() => {
                  setShowAttemptsModal(false);
                  setSelectedQuizAttempts([]);
                }}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grading Modal for Qualification Submissions */}
      {showGradeModal && selectedSubmission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#E51791] to-[#c0146f] px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-white">Grade Submission</h3>
                <p className="text-white text-sm opacity-90 mt-1">
                  {selectedSubmission.student_name} - {selectedSubmission.course_title}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowGradeModal(false);
                  setSelectedSubmission(null);
                  setGradeForm({ pass_fail_result: 'pass', feedback: '' });
                }}
                className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Submission Details */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h4 className="font-semibold text-gray-900 mb-3">Submission Details</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Course:</span>
                    <span className="font-medium text-gray-900">{selectedSubmission.course_title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Unit:</span>
                    <span className="font-medium text-gray-900">
                      Unit {selectedSubmission.unit_order}: {selectedSubmission.unit_title}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Type:</span>
                    <span className={`font-medium ${
                      selectedSubmission.submission_type === 'assignment' ? 'text-orange-700' : 'text-pink-700'
                    }`}>
                      {selectedSubmission.submission_type === 'assignment' ? '📝 Assignment' : '🎤 Presentation'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Submitted:</span>
                    <span className="font-medium text-gray-900">
                      {new Date(selectedSubmission.submitted_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">File:</span>
                    <button
                      onClick={() => window.open(`${getApiUrl()}/api/admin/proxy-pdf?url=${encodeURIComponent(selectedSubmission.file_path)}`, '_blank')}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      {selectedSubmission.file_name}
                    </button>
                  </div>
                </div>
              </div>

              {/* Grading Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Grade Result *
                  </label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setGradeForm({ ...gradeForm, pass_fail_result: 'pass' })}
                      className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
                        gradeForm.pass_fail_result === 'pass'
                          ? 'bg-green-600 text-white shadow-lg scale-105'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      ✅ Pass
                    </button>
                    <button
                      onClick={() => setGradeForm({ ...gradeForm, pass_fail_result: 'refer' })}
                      className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
                        gradeForm.pass_fail_result === 'refer'
                          ? 'bg-orange-600 text-white shadow-lg scale-105'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      ⚠️ Refer
                    </button>
                  </div>
                </div>

                {gradeForm.pass_fail_result === 'pass' && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm text-green-800">
                      <span className="font-semibold">🔓 Auto-Unlock:</span> Marking this as "Pass" will automatically unlock the next unit for this student (if all previous units are also passed).
                    </p>
                  </div>
                )}

                {gradeForm.pass_fail_result === 'refer' && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <p className="text-sm text-orange-800">
                      <span className="font-semibold">⚠️ Refer Status:</span> Marking this as "Refer" means the student needs to resubmit. The next unit will NOT be unlocked until this assignment is passed.
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Feedback (Optional)
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    💡 Tip: You can copy-paste formatted content from Word/Google Docs including tables, colors, and formatting
                  </p>
                  <Editor
                    tinymceScriptSrc="/tinymce/tinymce.min.js"
                    value={gradeForm.feedback}
                    onEditorChange={(content) => setGradeForm({ ...gradeForm, feedback: content })}
                    init={{
                      license_key: 'gpl' as any,
                      height: 400,
                      menubar: false,
                      plugins: [
                        'advlist', 'autolink', 'lists', 'link', 'charmap', 'preview',
                        'searchreplace', 'visualblocks', 'code', 'fullscreen',
                        'insertdatetime', 'table', 'help', 'wordcount'
                      ],
                      toolbar: 'undo redo | formatselect | ' +
                        'bold italic underline strikethrough | forecolor backcolor | ' +
                        'alignleft aligncenter alignright alignjustify | ' +
                        'bullist numlist outdent indent | table | removeformat | help',
                      content_style: 'body { font-family:Arial,sans-serif; font-size:14px }',
                      
                      // ⭐ MAXIMUM PASTE SETTINGS - Preserve EVERYTHING from Word/Google Docs
                      paste_data_images: true,
                      paste_as_text: false,
                      paste_enable_default_filters: false,
                      paste_filter_drop: false,
                      paste_remove_styles_if_webkit: false,
                      paste_webkit_styles: 'all',
                      paste_retain_style_properties: 'all',
                      paste_merge_formats: true,
                      paste_convert_word_fake_lists: true,
                      paste_remove_spans: false,
                      paste_remove_styles: false,
                      paste_tab_spaces: 4,
                      paste_preprocess: function(plugin: any, args: any) {
                        // Don't modify the pasted content at all
                        console.log('Pasting content, preserving all formatting');
                      },
                      
                      // Allow ALL HTML elements and attributes
                      valid_elements: '*[*]',
                      valid_styles: '*[*]',
                      extended_valid_elements: '*[*]',
                      valid_children: '+body[style],+body[link]',
                      
                      // Don't clean up any HTML
                      verify_html: false,
                      cleanup: false,
                      convert_urls: false,
                      
                      // Table settings
                      table_default_attributes: {
                        border: '1'
                      },
                      table_default_styles: {
                        'border-collapse': 'collapse',
                        'width': '100%'
                      },
                      table_style_by_css: false,
                      table_use_colgroups: false,
                      table_advtab: true,
                      table_cell_advtab: true,
                      table_row_advtab: true,
                      
                      promotion: false,
                      branding: false
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowGradeModal(false);
                  setSelectedSubmission(null);
                  setGradeForm({ pass_fail_result: 'pass', feedback: '' });
                }}
                className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    const apiUrl = getApiUrl();
                    const response = await fetch(`${apiUrl}/api/qualification/submissions/${selectedSubmission.submission_id}/grade`, {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${localStorage.getItem('lms-token')}`,
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({
                        grading_type: 'pass_fail',
                        pass_fail_result: gradeForm.pass_fail_result,
                        feedback: gradeForm.feedback
                      })
                    });

                    const data = await response.json();

                    if (data.success) {
                      const successMessage = `Submission graded as ${gradeForm.pass_fail_result.toUpperCase()}!${data.unlocked ? '\n\n✅ Next unit unlocked for student.' : ''}`;
                      showSweetAlert('Success!', successMessage, 'success');
                      setShowGradeModal(false);
                      setSelectedSubmission(null);
                      setGradeForm({ pass_fail_result: 'pass', feedback: '' });
                      
                      // Reload submissions
                      if (user?.id) {
                        const apiUrl = getApiUrl();
                        const qualSubmissionsRes = await fetch(`${apiUrl}/api/qualification/submissions/all`, {
                          headers: {
                            'Authorization': `Bearer ${localStorage.getItem('lms-token')}`,
                            'Content-Type': 'application/json'
                          }
                        }).then(res => res.json());
                        setQualSubmissions(qualSubmissionsRes?.submissions ?? []);
                      }
                    } else {
                      showSweetAlert('Error', data.message || 'Failed to grade submission', 'error');
                    }
                  } catch (error) {
                    console.error('Error grading submission:', error);
                    showSweetAlert('Error', 'Error grading submission. Please try again.', 'error');
                  }
                }}
                className="px-6 py-2.5 bg-[#E51791] text-white rounded-lg font-semibold hover:bg-[#c0146f] transition-colors"
              >
                Submit Grade
              </button>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
};

export default TutorDashboard;
