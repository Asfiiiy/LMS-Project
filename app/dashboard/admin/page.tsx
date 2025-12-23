'use client';

import React from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import UserManagement from '@/app/components/UserManagement';
import CourseManagement from '@/app/components/CourseManagement';
import StudentEnrollment from '@/app/components/StudentEnrollment';
import StudentsProfileView from '@/app/components/StudentsProfileView';
import PaymentManagementView from '@/app/components/PaymentManagementView';
import CertificateClaimsManagement from '@/app/components/CertificateClaimsManagement';
import CertificateTemplateManager from '@/app/components/CertificateTemplateManager';
import GeneratedCertificatesManagement from '@/app/components/GeneratedCertificatesManagement';
import { apiService } from '@/app/services/api';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { UserRole, User } from '@/app/components/types';

interface DashboardStats {
  users: Array<{ role: string; count: number }>;
  courses: { total_courses: number; active_courses: number };
  assignments: { total_assignments: number };
  quizzes: { total_quizzes: number };
}

interface AdminAssignmentRow {
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

interface AdminQuizRow {
  quiz_id: number;
  quiz_title: string;
  quiz_type: string;
  passing_score: number;
  course_id: number;
  course_title: string;
  student_id: number;
  student_name: string;
  student_email: string;
  attempt_count: number;
  last_score: number | null;
  is_pass: number;
  completed_at?: string | null; // For date filtering
}

interface HealthStatus {
  status: string;
  timestamp: string;
  uptime: number;
  uptime_seconds: number;
  responseTime: number | null;
  response_time_ms: number;
  version?: {
    number: string;
    releaseDate: string;
    notes: string;
  };
  server: {
    hostname: string;
    platform: string;
    cpu_cores: number;
    load_avg: number[];
  };
  checks: {
    database: { status: string; error: string | null };
    redis: { status: string; error: string | null };
    memory: { 
      used: string | null; 
      total: string | null; 
      usage_percent: string | null;
      process_heap_used?: string | null;
      process_heap_total?: string | null;
      process_heap_percent?: string | null;
      system_total?: string | null;
      system_used?: string | null;
      system_free?: string | null;
      system_usage_percent?: string | null;
      error?: string | null;
    };
    disk: { status: string; error: string | null };
    sockets: { status: string; value: number | null; error: string | null };
    queue?: {
      pending: number;
      failed: number;
      running: number;
    };
    apiMetrics?: {
      errorsLast24h: number;
      loginFailures: number;
      rateLimitBlocks: number;
    };
  };
}

interface EventLog {
  id: number;
  user_id: number | null;
  user_name: string | null;
  role: 'admin' | 'tutor' | 'student' | 'system' | null;
  action: string; // Changed from event_type to action
  description: string | null;
  ip_address: string | null;
  country_code: string | null;
  country_name: string | null;
  service: string | null;
  course_id: number | null;
  student_id: number | null;
  user_agent: string | null;
  endpoint: string | null;
  method: string | null;
  request_body: string | null;
  created_at: string;
}

// Component to display total courses count
const TotalCoursesCountDisplay = ({ filterType }: { filterType: 'all' | 'cpd' | 'qualification' }) => {
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const response = await apiService.getCourses();
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

const AdminDashboard = () => {
  const router = useRouter();
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [courseTypeFilter, setCourseTypeFilter] = useState<'all' | 'cpd' | 'qualification'>('all');
  
  // Assessment state (assignments & quizzes)
  const [assignmentRows, setAssignmentRows] = useState<AdminAssignmentRow[]>([]);
  const [quizRows, setQuizRows] = useState<AdminQuizRow[]>([]);
  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [quizSearch, setQuizSearch] = useState('');
  
  // Date filter states for assignments
  const [assignmentDateFilter, setAssignmentDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [assignmentDateFrom, setAssignmentDateFrom] = useState<string>('');
  const [assignmentDateTo, setAssignmentDateTo] = useState<string>('');
  
  // Pagination states for assignments
  const [assignmentPage, setAssignmentPage] = useState(1);
  const [assignmentLimit, setAssignmentLimit] = useState(25);
  
  // Date filter states for quiz
  const [quizDateFilter, setQuizDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [quizDateFrom, setQuizDateFrom] = useState<string>('');
  const [quizDateTo, setQuizDateTo] = useState<string>('');
  
  // Pagination states for quiz
  const [quizPage, setQuizPage] = useState(1);
  const [quizLimit, setQuizLimit] = useState(25);
  
  // Health check state
  const [healthData, setHealthData] = useState<HealthStatus | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);

  // Logs state
  const [logs, setLogs] = useState<EventLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [logsPage, setLogsPage] = useState(1);
  const [logsLimit, setLogsLimit] = useState(50);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsTotalPages, setLogsTotalPages] = useState(0);
  
  // Logs filters
  const [logsDateFilter, setLogsDateFilter] = useState<'all' | 'today' | 'this_week' | 'this_month' | 'custom'>('all');
  const [logsDateFrom, setLogsDateFrom] = useState<string>('');
  const [logsDateTo, setLogsDateTo] = useState<string>('');
  const [logsSearch, setLogsSearch] = useState('');
  const [logsRoleFilter, setLogsRoleFilter] = useState<string>('');
  const [logsEventTypeFilter, setLogsEventTypeFilter] = useState<string>('');
  const [logsServiceFilter, setLogsServiceFilter] = useState<string>('');
  const [logsCourseFilter, setLogsCourseFilter] = useState<string>('');
  const [logsStudentFilter, setLogsStudentFilter] = useState<string>('');
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());
  
  // For filter dropdowns
  const [courses, setCourses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);

  useEffect(() => {
    const user: User | null = JSON.parse(localStorage.getItem('lms-user') || 'null');
    setUserRole(user?.role || null);
    fetchStats();
    loadAssessments();
  }, []);

  // Reset pagination when filters change
  useEffect(() => {
    setAssignmentPage(1);
  }, [assignmentDateFilter, assignmentDateFrom, assignmentDateTo, assignmentSearch]);

  useEffect(() => {
    setQuizPage(1);
  }, [quizDateFilter, quizDateFrom, quizDateTo, quizSearch]);

  // Load courses and students for filters
  useEffect(() => {
    if (activeTab === 'reports') {
      const fetchFilterData = async () => {
        setLoadingCourses(true);
        setLoadingStudents(true);
        try {
          const [coursesData, studentsData] = await Promise.all([
            apiService.getCourses(),
            apiService.getAllStudents()
          ]);
          if (coursesData?.success && coursesData?.courses) {
            setCourses(coursesData.courses);
          }
          if (studentsData?.success && studentsData?.students) {
            setStudents(studentsData.students);
          }
        } catch (error) {
          console.error('Error fetching filter data:', error);
        } finally {
          setLoadingCourses(false);
          setLoadingStudents(false);
        }
      };
      fetchFilterData();
    }
  }, [activeTab]);

  // Load logs when reports tab is active
  useEffect(() => {
    if (activeTab === 'reports') {
      loadLogs();
    }
  }, [activeTab, logsPage, logsLimit, logsDateFilter, logsDateFrom, logsDateTo, logsSearch, logsRoleFilter, logsEventTypeFilter, logsServiceFilter, logsCourseFilter, logsStudentFilter]);

  // Reset logs pagination when filters change
  useEffect(() => {
    setLogsPage(1);
  }, [logsDateFilter, logsDateFrom, logsDateTo, logsSearch, logsRoleFilter, logsEventTypeFilter, logsServiceFilter, logsCourseFilter, logsStudentFilter]);

  const fetchStats = async () => {
    try {
      const data = await apiService.getAdminStats();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    setLogsLoading(true);
    setLogsError(null);
    try {
      const params: any = {
        page: logsPage,
        limit: logsLimit
      };

      if (logsDateFilter !== 'all') {
        if (logsDateFilter === 'custom' && logsDateFrom && logsDateTo) {
          params.date_from = logsDateFrom;
          params.date_to = logsDateTo;
        } else {
          params.range = logsDateFilter === 'today' ? 'today' : 
                       logsDateFilter === 'this_week' ? 'week' : 
                       logsDateFilter === 'this_month' ? 'month' : undefined;
        }
      }

      if (logsSearch.trim()) {
        params.search = logsSearch.trim();
      }

      if (logsRoleFilter) {
        params.role = logsRoleFilter;
      }

      if (logsEventTypeFilter) {
        params.action = logsEventTypeFilter;
      }

      if (logsServiceFilter) {
        params.service = logsServiceFilter;
      }

      if (logsCourseFilter) {
        params.courseId = parseInt(logsCourseFilter, 10);
      }

      if (logsStudentFilter) {
        params.studentId = parseInt(logsStudentFilter, 10);
      }

      const response = await apiService.getLogs(params);
      
      if (response?.success) {
        setLogs(response.data || []);
        setLogsTotal(response.pagination?.total || 0);
        setLogsTotalPages(response.pagination?.totalPages || 0);
      } else {
        throw new Error(response?.message || 'Failed to load logs');
      }
    } catch (err: any) {
      console.error('Error loading logs:', err);
      setLogsError(err.message || 'Unable to load logs right now.');
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  };

  const loadAssessments = async () => {
    setAssessmentLoading(true);
    setAssessmentError(null);
    try {
      const [assignmentRes, quizRes] = await Promise.all([
        apiService.getAllAssignmentSubmissions(),
        apiService.getAllQuizAttempts()
      ]);
      
      if (!assignmentRes || !assignmentRes.success) {
        throw new Error(assignmentRes?.message || 'Failed to load assignments');
      }
      
      if (!quizRes || !quizRes.success) {
        throw new Error(quizRes?.message || 'Failed to load quizzes');
      }
      
      const assignmentData = (assignmentRes?.submissions ?? []).map((row: any) => ({
          ...row,
          grade: row.grade !== null ? Number(row.grade) : null,
        is_submitted: Number(row.is_submitted) || 0,
        is_pass: Number(row.is_pass) || 0,
      }));
      
      const quizData = (quizRes?.attempts ?? []).map((row: any) => ({
          ...row,
          last_score: row.last_score !== null ? Number(row.last_score) : null,
        attempt_count: Number(row.attempt_count) || 0,
        is_pass: Number(row.is_pass) || 0,
      }));
      
      setAssignmentRows(assignmentData);
      setQuizRows(quizData);
    } catch (err: any) {
      console.error('Error loading assessments:', err);
      setAssessmentError(err.message || 'Unable to load assignments and quizzes right now.');
      setAssignmentRows([]);
      setQuizRows([]);
    } finally {
      setAssessmentLoading(false);
    }
  };

  // Helper function to get date range
  const getDateRange = (filter: string, fromDate?: string, toDate?: string) => {
    const now = new Date();
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
          if (!row.submitted_at) return false;
          try {
            const submittedDate = new Date(row.submitted_at);
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
    
    // Apply date filter - use completed_at field (from quiz_submissions or cpd_quiz_attempts)
    if (quizDateFilter !== 'all') {
      const dateRange = getDateRange(quizDateFilter, quizDateFrom, quizDateTo);
      if (dateRange) {
        filtered = filtered.filter((row) => {
          const completedAt = (row as any).completed_at;
          if (!completedAt) return false;
          try {
            const completedDate = new Date(completedAt);
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

  const fetchHealthStatus = async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const data = await apiService.getHealthStatus();
      setHealthData(data);
    } catch (err: any) {
      console.error('Error fetching health status:', err);
      setHealthError(err.message || 'Failed to fetch health status');
    } finally {
      setHealthLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'health') {
      fetchHealthStatus();
      // Auto-refresh every 30 seconds when health tab is active
      const interval = setInterval(fetchHealthStatus, 30000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  const tabs = [
    { id: 'overview', name: 'Overview', icon: '📊' },
    { id: 'users', name: 'User Management', icon: '👥' },
    { id: 'courses', name: 'Course Management', icon: '📚' },
    { id: 'students', name: 'Student Insights', icon: '👥' },
    { id: 'students-profile', name: 'Students Profile', icon: '👤' },
    { id: 'payments', name: 'Payments', icon: '💳' },
    { id: 'import', name: 'Import Moodle', icon: '📦' },
    { id: 'assignments', name: 'Assignments', icon: '📝' },
    { id: 'quizzes', name: 'Quizzes', icon: '❓' },
    { id: 'chat', name: 'Chat', icon: '💬' },
    { id: 'forums', name: 'Forums', icon: '📋' },
    { id: 'certificates', name: 'Certificates', icon: '🏆' },
    { id: 'certificate-templates', name: 'Certificate Templates', icon: '📄' },
    { id: 'totalcourses', name: 'Total Courses', icon: '📚' },
    { id: 'reports', name: 'Reports', icon: '📈' },
    { id: 'health', name: 'Health', icon: '🏥' }
  ];

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin': return 'bg-red-500';
      case 'tutor': return 'bg-green-500';
      case 'student': return 'bg-blue-500';
      case 'manager': return 'bg-purple-500';
      case 'moderator': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <ProtectedRoute allowedRoles={['Admin']} userRole={userRole}>
      <div className="min-h-screen bg-gray-50 w-full overflow-x-hidden">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200 w-full">
          <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
                <p className="text-gray-600 mt-1">Complete system management and control</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#11CCEF] rounded-lg flex items-center justify-center text-white font-semibold">
                  A
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex w-full overflow-x-hidden">
          {/* Sidebar */}
          <div className="w-64 flex-shrink-0 bg-white shadow-sm min-h-screen border-r border-gray-200">
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
          <div className="flex-1 p-4 sm:p-6 min-w-0 overflow-x-hidden w-full">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-gray-600">Loading dashboard data...</div>
              </div>
            ) : (
              <>
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                      {stats?.users.map((userStat) => (
                        <div 
                          key={userStat.role} 
                          className="bg-white p-5 rounded-lg shadow-sm border border-gray-200"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-base font-semibold text-gray-700">{userStat.role}s</h3>
                            <div className={`w-8 h-8 ${getRoleColor(userStat.role)} rounded-lg flex items-center justify-center text-white text-xs font-semibold`}>
                              {userStat.role.charAt(0)}
                            </div>
                          </div>
                          <p className="text-2xl font-bold text-gray-900">{userStat.count}</p>
                        </div>
                      ))}
                      
                      {/* Courses Stats */}
                      <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-base font-semibold text-gray-700">Total Courses</h3>
                          <div className="w-8 h-8 bg-[#E51791] rounded-lg flex items-center justify-center text-white text-xs">
                            📚
                          </div>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{stats?.courses.total_courses}</p>
                      </div>

                      <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-base font-semibold text-gray-700">Active Courses</h3>
                          <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center text-white text-xs">
                            🎯
                          </div>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{stats?.courses.active_courses}</p>
                      </div>

                      <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-base font-semibold text-gray-700">Assignments</h3>
                          <div className="w-8 h-8 bg-gray-600 rounded-lg flex items-center justify-center text-white text-xs">
                            📝
                          </div>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{stats?.assignments.total_assignments}</p>
                      </div>

                      <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-base font-semibold text-gray-700">Quizzes</h3>
                          <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center text-white text-xs">
                            ❓
                          </div>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{stats?.quizzes.total_quizzes}</p>
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                      <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <button 
                          onClick={() => setActiveTab('users')}
                          className="p-4 bg-[#11CCEF] text-white rounded-lg hover:bg-[#0daed9] transition-colors text-left"
                        >
                          <div className="text-xl mb-2">👥</div>
                          <div className="font-semibold">Manage Users</div>
                          <div className="text-sm opacity-90 mt-1">User management</div>
                        </button>
                        <button 
                          onClick={() => setActiveTab('courses')}
                          className="p-4 bg-[#E51791] text-white rounded-lg hover:bg-[#c3147f] transition-colors text-left"
                        >
                          <div className="text-xl mb-2">📚</div>
                          <div className="font-semibold">Manage Courses</div>
                          <div className="text-sm opacity-90 mt-1">Course management</div>
                        </button>
                        <button 
                          onClick={() => setActiveTab('assignments')}
                          className="p-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-left"
                        >
                          <div className="text-xl mb-2">📝</div>
                          <div className="font-semibold">Assignments</div>
                          <div className="text-sm opacity-90 mt-1">Assignment management</div>
                        </button>
                        <button 
                          onClick={() => setActiveTab('reports')}
                          className="p-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-left"
                        >
                          <div className="text-xl mb-2">📈</div>
                          <div className="font-semibold">Reports</div>
                          <div className="text-sm opacity-90 mt-1">Analytics and insights</div>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* User Management Tab */}
                {activeTab === 'users' && <UserManagement />}

                {/* Course Management Tab */}
                {activeTab === 'courses' && <CourseManagement />}

                {/* Student Insights Tab */}
                {activeTab === 'students' && (
                  <StudentEnrollment role={userRole} />
                )}

                {/* Students Profile Tab */}
                {activeTab === 'students-profile' && (
                  <StudentsProfileView userRole="Admin" />
                )}

                {/* Payments Tab */}
                {activeTab === 'payments' && (
                  <PaymentManagementView userRole="Admin" />
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

                {/* Import Moodle Tab */}
                {activeTab === 'import' && (
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h2 className="text-2xl font-semibold text-gray-900">Import Moodle Course</h2>
                        <p className="text-gray-600 mt-1">
                          Upload Moodle backup files (.mbz) to import courses with all content
                        </p>
                      </div>
                    </div>
                    <div className="grid md:grid-cols-3 gap-6">
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg">
                        <div className="text-4xl mb-3">📦</div>
                        <h3 className="font-semibold text-gray-900 mb-2">Moodle Backups</h3>
                        <p className="text-sm text-gray-600 mb-4">
                          Import complete courses from Moodle including sections, files, and structure
                        </p>
                        <button
                          onClick={() => window.location.href = '/dashboard/admin/import-moodle'}
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Start Import
                        </button>
                      </div>
                      
                      <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg">
                        <div className="text-4xl mb-3">✅</div>
                        <h3 className="font-semibold text-gray-900 mb-2">Auto Processing</h3>
                        <p className="text-sm text-gray-600">
                          Files are automatically extracted and uploaded to Cloudinary
                        </p>
                      </div>
                      
                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-lg">
                        <div className="text-4xl mb-3">🎯</div>
                        <h3 className="font-semibold text-gray-900 mb-2">Structure Preserved</h3>
                        <p className="text-sm text-gray-600">
                          Course units, resources, and organization maintained from Moodle
                        </p>
                      </div>
                    </div>
                    
                    <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <h4 className="font-semibold text-yellow-900 mb-2">📋 Supported Content:</h4>
                      <ul className="text-sm text-yellow-800 grid md:grid-cols-2 gap-2">
                        <li>✓ Course metadata & descriptions</li>
                        <li>✓ Sections/Units structure</li>
                        <li>✓ PDF documents</li>
                        <li>✓ Video files (MP4)</li>
                        <li>✓ Word & PowerPoint files</li>
                        <li>✓ Images (JPG, PNG, GIF)</li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* Assignments Tab */}
                {activeTab === 'assignments' && (
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                      <div>
                        <h2 className="text-xl font-semibold text-gray-900">Assignments Overview</h2>
                        <p className="text-gray-600">
                          Review all assignments across all courses, monitor submissions, and track grades.
                        </p>
                      </div>
                      <input
                        type="text"
                        value={assignmentSearch}
                        onChange={(event) => {
                          setAssignmentSearch(event.target.value);
                          setAssignmentPage(1);
                        }}
                        placeholder="Search by course, assignment, or student..."
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF] w-full md:w-80"
                      />
                    </div>

                    {/* Date Filter for Assignments */}
                    <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex flex-wrap items-center gap-3 mb-3">
                        <span className="text-sm font-semibold text-gray-700">Filter by Date:</span>
                        <button
                          onClick={() => {
                            setAssignmentDateFilter('all');
                            setAssignmentPage(1);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            assignmentDateFilter === 'all'
                              ? 'bg-[#11CCEF] text-white'
                              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                          }`}
                        >
                          All
                        </button>
                        <button
                          onClick={() => {
                            setAssignmentDateFilter('today');
                            setAssignmentPage(1);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            assignmentDateFilter === 'today'
                              ? 'bg-[#11CCEF] text-white'
                              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                          }`}
                        >
                          Today
                        </button>
                        <button
                          onClick={() => {
                            setAssignmentDateFilter('week');
                            setAssignmentPage(1);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            assignmentDateFilter === 'week'
                              ? 'bg-[#11CCEF] text-white'
                              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                          }`}
                        >
                          This Week
                        </button>
                        <button
                          onClick={() => {
                            setAssignmentDateFilter('month');
                            setAssignmentPage(1);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            assignmentDateFilter === 'month'
                              ? 'bg-[#11CCEF] text-white'
                              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                          }`}
                        >
                          This Month
                        </button>
                        <button
                          onClick={() => {
                            setAssignmentDateFilter('custom');
                            setAssignmentPage(1);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            assignmentDateFilter === 'custom'
                              ? 'bg-[#11CCEF] text-white'
                              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                          }`}
                        >
                          Custom Range
                        </button>
                      </div>
                      {assignmentDateFilter === 'custom' && (
                        <div className="flex flex-wrap items-center gap-3 mt-3">
                          <div className="flex items-center gap-2">
                            <label className="text-sm font-medium text-gray-700">From:</label>
                            <input
                              type="date"
                              value={assignmentDateFrom}
                              onChange={(e) => {
                                setAssignmentDateFrom(e.target.value);
                                setAssignmentPage(1);
                              }}
                              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-sm font-medium text-gray-700">To:</label>
                            <input
                              type="date"
                              value={assignmentDateTo}
                              onChange={(e) => {
                                setAssignmentDateTo(e.target.value);
                                setAssignmentPage(1);
                              }}
                              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {assessmentLoading ? (
                      <div className="text-[#11CCEF]">Loading assignments...</div>
                    ) : assessmentError ? (
                      <div className="bg-red-50 text-red-600 border border-red-200 rounded-lg px-4 py-3">
                        <strong>Error:</strong> {assessmentError}
                        <br />
                        <small className="text-red-500 mt-2 block">Check browser console and backend logs for details.</small>
                      </div>
                    ) : assignmentRows.length === 0 ? (
                      <div className="bg-yellow-50 text-yellow-800 border border-yellow-200 rounded-lg px-4 py-3">
                        <strong>No Data:</strong> No assignments found in the database.
                        <br />
                        <small className="text-yellow-600 mt-2 block">This could mean: 1) No assignments exist, 2) No students are enrolled in courses with assignments, or 3) There's a database connection issue.</small>
                      </div>
                    ) : filteredAssignments.length === 0 ? (
                      <div className="bg-blue-50 text-blue-800 border border-blue-200 rounded-lg px-4 py-3">
                        <strong>No Results:</strong> No assignments match your current filters.
                        <br />
                        <small className="text-blue-600 mt-2 block">Try adjusting your search or date filters. Total assignments in database: {assignmentRows.length}</small>
                      </div>
                    ) : (
                      <>
                        <div className="mb-4 flex items-center justify-between text-sm text-gray-600">
                          <div>
                            Showing {((assignmentPage - 1) * assignmentLimit) + 1} to {Math.min(assignmentPage * assignmentLimit, filteredAssignments.length)} of {filteredAssignments.length} assignments
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-sm font-medium">Items per page:</label>
                            <select
                              value={assignmentLimit}
                              onChange={(e) => {
                                setAssignmentLimit(Number(e.target.value));
                                setAssignmentPage(1);
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
                                Assignment
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
                              {paginatedAssignments.map((row) => (
                              <tr key={`${row.assignment_id}-${row.student_id}`}>
                                <td className="px-4 py-2 text-sm text-gray-700">{row.course_title}</td>
                                <td className="px-4 py-2 text-sm text-gray-900 font-medium">{row.assignment_title}</td>
                                <td className="px-4 py-2 text-sm text-gray-600">
                                  <div className="font-medium text-gray-900">{row.student_name}</div>
                                  <div className="text-xs text-gray-500">{row.student_email}</div>
                                </td>
                                <td className="px-4 py-2 text-sm text-right">
                                  <div className="flex items-center justify-end gap-3">
                                    <span
                                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                                        row.is_submitted
                                          ? 'bg-green-100 text-green-700'
                                          : 'bg-gray-100 text-gray-500'
                                      }`}
                                    >
                                      {row.is_submitted ? '✔ Submitted' : 'Pending'}
                                    </span>
                                    <span
                                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                                        row.is_pass
                                          ? 'bg-green-100 text-green-700'
                                          : row.is_submitted
                                          ? 'bg-red-100 text-red-600'
                                          : 'bg-gray-100 text-gray-500'
                                      }`}
                                    >
                                      {row.is_pass ? 'Pass' : row.is_submitted ? 'Needs Review' : 'Not Graded'}
                                    </span>
                                    <button className="px-3 py-1.5 bg-[#11CCEF] text-white rounded-lg text-xs font-semibold hover:bg-[#0daed9]">
                                      View Submissions
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        </div>
                        
                        {/* Pagination Controls for Assignments */}
                        {assignmentTotalPages > 1 && (
                          <div className="mt-4 flex items-center justify-between">
                            <button
                              onClick={() => setAssignmentPage(p => Math.max(1, p - 1))}
                              disabled={assignmentPage === 1}
                              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                assignmentPage === 1
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                  : 'bg-[#11CCEF] text-white hover:bg-[#0daed9]'
                              }`}
                            >
                              Previous
                            </button>
                            <div className="flex items-center gap-2">
                              {Array.from({ length: Math.min(5, assignmentTotalPages) }, (_, i) => {
                                let pageNum;
                                if (assignmentTotalPages <= 5) {
                                  pageNum = i + 1;
                                } else if (assignmentPage <= 3) {
                                  pageNum = i + 1;
                                } else if (assignmentPage >= assignmentTotalPages - 2) {
                                  pageNum = assignmentTotalPages - 4 + i;
                                } else {
                                  pageNum = assignmentPage - 2 + i;
                                }
                                return (
                                  <button
                                    key={pageNum}
                                    onClick={() => setAssignmentPage(pageNum)}
                                    className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                                      assignmentPage === pageNum
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
                              Page {assignmentPage} of {assignmentTotalPages}
                            </div>
                            <button
                              onClick={() => setAssignmentPage(p => Math.min(assignmentTotalPages, p + 1))}
                              disabled={assignmentPage === assignmentTotalPages}
                              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                assignmentPage === assignmentTotalPages
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
                )}

                {/* Quizzes Tab */}
                {activeTab === 'quizzes' && (
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                      <div>
                      <h2 className="text-xl font-semibold text-gray-900">Quiz Performance</h2>
                        <p className="text-gray-600">
                          Review all quiz attempts across all courses, monitor performance, and track scores.
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

                    {/* Date Filter for Quizzes */}
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
                        <strong>Error:</strong> {assessmentError}
                        <br />
                        <small className="text-red-500 mt-2 block">Check browser console and backend logs for details.</small>
                      </div>
                    ) : quizRows.length === 0 ? (
                      <div className="bg-yellow-50 text-yellow-800 border border-yellow-200 rounded-lg px-4 py-3">
                        <strong>No Data:</strong> No quiz attempts found in the database.
                        <br />
                        <small className="text-yellow-600 mt-2 block">This could mean: 1) No final quizzes exist, 2) No students are enrolled in courses with quizzes, or 3) There's a database connection issue.</small>
                      </div>
                    ) : filteredQuizzes.length === 0 ? (
                      <div className="bg-blue-50 text-blue-800 border border-blue-200 rounded-lg px-4 py-3">
                        <strong>No Results:</strong> No quiz attempts match your current filters.
                        <br />
                        <small className="text-blue-600 mt-2 block">Try adjusting your search or date filters. Total quiz attempts in database: {quizRows.length}</small>
                      </div>
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
                              <tr key={`${row.quiz_id}-${row.student_id}`}>
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
                                      {row.is_pass ? '✅ Pass' : row.attempt_count > 0 ? '❌ Needs Review' : 'No Attempt'}
                                    </span>
                                    {row.last_score !== null && (
                                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                                        Last Score: {row.last_score}%
                                      </span>
                                    )}
                                    <button className="px-3 py-1.5 bg-[#11CCEF] text-white rounded-lg text-xs font-semibold hover:bg-[#0daed9]">
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
                )}

                {/* Chat Tab - Direct redirect to /chat */}
                {activeTab === 'chat' && (
                  typeof window !== 'undefined' && (window.location.href = '/chat')
                )}

                {/* Health Tab */}
                {activeTab === 'health' && (
                  <div className="space-y-6">
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <h2 className="text-2xl font-semibold text-gray-900">System Health Monitor</h2>
                          <p className="text-gray-600 mt-1">
                            Real-time monitoring of system components and performance metrics
                          </p>
                        </div>
                        <button
                          onClick={fetchHealthStatus}
                          disabled={healthLoading}
                          className="px-4 py-2 bg-[#11CCEF] text-white rounded-lg hover:bg-[#0daed9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          <span>🔄</span>
                          <span>{healthLoading ? 'Refreshing...' : 'Refresh'}</span>
                        </button>
                      </div>

                      {healthLoading && !healthData ? (
                        <div className="text-center py-12">
                          <div className="text-[#11CCEF] text-lg">Loading health status...</div>
                        </div>
                      ) : healthError ? (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                          <div className="flex items-center gap-2 text-red-600">
                            <span>❌</span>
                            <span className="font-semibold">Error:</span>
                            <span>{healthError}</span>
                          </div>
                        </div>
                      ) : healthData ? (
                        <>
                          {/* Version Information */}
                          {healthData.version && (
                            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-6">
                              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <span>📦</span>
                                <span>LMS Version Information</span>
                              </h3>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                  <div className="text-xs font-semibold text-gray-600 uppercase mb-1">Version</div>
                                  <div className="text-xl font-bold text-blue-900">{healthData.version.number}</div>
                                </div>
                                <div>
                                  <div className="text-xs font-semibold text-gray-600 uppercase mb-1">Release Date</div>
                                  <div className="text-lg font-medium text-gray-900">
                                    {new Date(healthData.version.releaseDate).toLocaleDateString()}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs font-semibold text-gray-600 uppercase mb-1">Release Notes</div>
                                  <div className="text-sm text-gray-700">{healthData.version.notes}</div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Overall Status */}
                          <div className={`p-6 rounded-lg mb-6 ${
                            healthData.status === 'ok' 
                              ? 'bg-green-50 border-2 border-green-200' 
                              : 'bg-red-50 border-2 border-red-200'
                          }`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className={`text-4xl ${healthData.status === 'ok' ? '✅' : '❌'}`}>
                                  {healthData.status === 'ok' ? '✅' : '❌'}
                                </div>
                                <div>
                                  <h3 className="text-2xl font-bold text-gray-900">
                                    System Status: {healthData.status.toUpperCase()}
                                  </h3>
                                  <p className="text-gray-600 mt-1">
                                    Last checked: {new Date(healthData.timestamp).toLocaleString()}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm text-gray-600">Response Time</div>
                                <div className="text-2xl font-bold text-gray-900">
                                  {healthData.responseTime ?? healthData.response_time_ms}ms
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Error Summary Section - Shows when there are errors */}
                          {(() => {
                            const errors: Array<{ component: string; error: string }> = [];
                            
                            if (healthData.checks.database.status !== 'ok' && healthData.checks.database.error) {
                              errors.push({ component: 'Database', error: healthData.checks.database.error });
                            }
                            if (healthData.checks.redis.status !== 'ok' && healthData.checks.redis.error) {
                              errors.push({ component: 'Redis Cache', error: healthData.checks.redis.error });
                            }
                            if (healthData.checks.disk.status !== 'ok' && healthData.checks.disk.error) {
                              errors.push({ component: 'Disk', error: healthData.checks.disk.error });
                            }
                            if (healthData.checks.sockets.status !== 'ok' && healthData.checks.sockets.error) {
                              errors.push({ component: 'WebSockets', error: healthData.checks.sockets.error });
                            }
                            if (healthData.checks.memory.error) {
                              errors.push({ component: 'Memory', error: healthData.checks.memory.error });
                            }

                            if (errors.length > 0) {
                              return (
                                <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6 mb-6">
                                  <div className="flex items-start gap-3 mb-4">
                                    <div className="text-3xl">⚠️</div>
                                    <div className="flex-1">
                                      <h3 className="text-xl font-bold text-red-900 mb-1">
                                        System Errors Detected
                                      </h3>
                                      <p className="text-sm text-red-700">
                                        {errors.length} component{errors.length > 1 ? 's' : ''} {errors.length > 1 ? 'have' : 'has'} failed health checks
                                      </p>
                                    </div>
                                  </div>
                                  <div className="space-y-3">
                                    {errors.map((err, index) => (
                                      <div 
                                        key={index}
                                        className="bg-white border border-red-200 rounded-lg p-4"
                                      >
                                        <div className="flex items-start gap-3">
                                          <div className="text-red-500 text-xl mt-0.5">❌</div>
                                          <div className="flex-1">
                                            <div className="font-semibold text-red-900 mb-1">
                                              {err.component}
                                            </div>
                                            <div className="text-sm text-red-700 font-mono bg-red-50 p-2 rounded border border-red-100 break-words">
                                              {err.error}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="mt-4 pt-4 border-t border-red-200">
                                    <p className="text-sm text-red-700">
                                      <strong>Action Required:</strong> Please check the component status cards below for more details and resolve the issues.
                                    </p>
                                  </div>
                                </div>
                              );
                            }

                            // Show info when all systems are OK
                            return (
                              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 mb-6">
                                <div className="flex items-start gap-3">
                                  <div className="text-2xl">✅</div>
                                  <div className="flex-1">
                                    <h3 className="text-sm font-semibold text-green-900 mb-1">
                                      All Systems Operational
                                    </h3>
                                    <p className="text-xs text-green-700">
                                      All health checks are passing. If any component fails, you'll see a detailed error summary here with specific error messages and troubleshooting information.
                                    </p>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}

                          {/* Server Information */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
                              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <span>🖥️</span>
                                <span>Server Information</span>
                              </h3>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Hostname:</span>
                                  <span className="font-medium text-gray-900">{healthData.server.hostname}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Platform:</span>
                                  <span className="font-medium text-gray-900">{healthData.server.platform}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">CPU Cores:</span>
                                  <span className="font-medium text-gray-900">{healthData.server.cpu_cores}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Uptime:</span>
                                  <span className="font-medium text-gray-900">
                                    {Math.floor(healthData.uptime_seconds / 3600)}h {Math.floor((healthData.uptime_seconds % 3600) / 60)}m
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Load Average:</span>
                                  <span className="font-medium text-gray-900">
                                    {healthData.server.load_avg.map((load, i) => `${load.toFixed(2)}`).join(', ')}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Memory Usage */}
                            <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
                              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <span>💾</span>
                                <span>Memory Usage</span>
                              </h3>
                              {healthData.checks.memory.system_total ? (
                                <div className="space-y-4">
                                  {/* System Memory (Total RAM) */}
                                  <div>
                                    <div className="flex justify-between items-center mb-2">
                                      <span className="text-xs font-semibold text-gray-700 uppercase">System RAM</span>
                                      <span className="text-xs text-gray-500">
                                        {healthData.checks.memory.system_used} / {healthData.checks.memory.system_total}
                                      </span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-3 mb-1">
                                      <div
                                        className={`h-3 rounded-full ${
                                          parseFloat(healthData.checks.memory.system_usage_percent || '0') > 85
                                            ? 'bg-red-500'
                                            : parseFloat(healthData.checks.memory.system_usage_percent || '0') > 70
                                            ? 'bg-yellow-500'
                                            : 'bg-green-500'
                                        }`}
                                        style={{
                                          width: `${healthData.checks.memory.system_usage_percent || '0%'}`
                                        }}
                                      ></div>
                                    </div>
                                    <div className="flex justify-between text-xs text-gray-600">
                                      <span>Free: {healthData.checks.memory.system_free}</span>
                                      <span className="font-semibold">{healthData.checks.memory.system_usage_percent} Used</span>
                                    </div>
                                  </div>
                                  
                                  {/* Node.js Process Memory (Heap) */}
                                  {healthData.checks.memory.process_heap_used && (
                                    <div className="pt-3 border-t border-gray-300">
                                      <div className="flex justify-between items-center mb-2">
                                        <span className="text-xs font-semibold text-gray-700 uppercase">Node.js Process (Heap)</span>
                                        <span className="text-xs text-gray-500">
                                          {healthData.checks.memory.process_heap_used} / {healthData.checks.memory.process_heap_total}
                                        </span>
                                      </div>
                                      <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                                        <div
                                          className={`h-2 rounded-full ${
                                            parseFloat(healthData.checks.memory.process_heap_percent || '0') > 80
                                              ? 'bg-orange-500'
                                              : parseFloat(healthData.checks.memory.process_heap_percent || '0') > 60
                                              ? 'bg-yellow-500'
                                              : 'bg-blue-500'
                                          }`}
                                          style={{
                                            width: `${healthData.checks.memory.process_heap_percent || '0%'}`
                                          }}
                                        ></div>
                                      </div>
                                      <div className="text-xs text-gray-600 text-right">
                                        <span className="font-semibold">{healthData.checks.memory.process_heap_percent} Used</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : healthData.checks.memory.used ? (
                                // Fallback to legacy format
                                <div className="space-y-3">
                                  <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Used:</span>
                                    <span className="font-medium text-gray-900">{healthData.checks.memory.used}</span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Total:</span>
                                    <span className="font-medium text-gray-900">{healthData.checks.memory.total}</span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-3">
                                    <div
                                      className={`h-3 rounded-full ${
                                        parseFloat(healthData.checks.memory.usage_percent || '0') > 80
                                          ? 'bg-red-500'
                                          : parseFloat(healthData.checks.memory.usage_percent || '0') > 60
                                          ? 'bg-yellow-500'
                                          : 'bg-green-500'
                                      }`}
                                      style={{
                                        width: `${healthData.checks.memory.usage_percent || '0%'}`
                                      }}
                                    ></div>
                                  </div>
                                  <div className="text-center text-sm font-semibold text-gray-900">
                                    {healthData.checks.memory.usage_percent} Used
                                  </div>
                                </div>
                              ) : (
                                <div className="text-gray-500 text-sm">Memory data unavailable</div>
                              )}
                            </div>
                          </div>

                          {/* Health Checks Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {/* Database Check */}
                            <div className={`p-5 rounded-lg border-2 ${
                              healthData.checks.database.status === 'ok'
                                ? 'bg-green-50 border-green-200'
                                : 'bg-red-50 border-red-200'
                            }`}>
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                                  <span>🗄️</span>
                                  <span>Database</span>
                                </h4>
                                <span className={`text-2xl ${
                                  healthData.checks.database.status === 'ok' ? '✅' : '❌'
                                }`}>
                                  {healthData.checks.database.status === 'ok' ? '✅' : '❌'}
                                </span>
                              </div>
                              <div className={`text-sm font-medium ${
                                healthData.checks.database.status === 'ok' ? 'text-green-700' : 'text-red-700'
                              }`}>
                                {healthData.checks.database.status === 'ok' ? 'Connected' : 'Error'}
                              </div>
                              {healthData.checks.database.error && (
                                <div className="mt-3 pt-3 border-t border-red-200">
                                  <div className="text-xs font-semibold text-red-700 mb-1">Error Details:</div>
                                  <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-100 font-mono break-words">
                                    {healthData.checks.database.error}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Redis Check */}
                            <div className={`p-5 rounded-lg border-2 ${
                              healthData.checks.redis.status === 'ok'
                                ? 'bg-green-50 border-green-200'
                                : 'bg-red-50 border-red-200'
                            }`}>
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                                  <span>⚡</span>
                                  <span>Redis Cache</span>
                                </h4>
                                <span className={`text-2xl ${
                                  healthData.checks.redis.status === 'ok' ? '✅' : '❌'
                                }`}>
                                  {healthData.checks.redis.status === 'ok' ? '✅' : '❌'}
                                </span>
                              </div>
                              <div className={`text-sm font-medium ${
                                healthData.checks.redis.status === 'ok' ? 'text-green-700' : 'text-red-700'
                              }`}>
                                {healthData.checks.redis.status === 'ok' ? 'Connected' : 'Error'}
                              </div>
                              {healthData.checks.redis.error && (
                                <div className="mt-3 pt-3 border-t border-red-200">
                                  <div className="text-xs font-semibold text-red-700 mb-1">Error Details:</div>
                                  <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-100 font-mono break-words">
                                    {healthData.checks.redis.error}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Disk Check */}
                            <div className={`p-5 rounded-lg border-2 ${
                              healthData.checks.disk.status === 'ok'
                                ? 'bg-green-50 border-green-200'
                                : 'bg-red-50 border-red-200'
                            }`}>
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                                  <span>💿</span>
                                  <span>Disk</span>
                                </h4>
                                <span className={`text-2xl ${
                                  healthData.checks.disk.status === 'ok' ? '✅' : '❌'
                                }`}>
                                  {healthData.checks.disk.status === 'ok' ? '✅' : '❌'}
                                </span>
                              </div>
                              <div className={`text-sm font-medium ${
                                healthData.checks.disk.status === 'ok' ? 'text-green-700' : 'text-red-700'
                              }`}>
                                {healthData.checks.disk.status === 'ok' ? 'Available' : 'Error'}
                              </div>
                              {healthData.checks.disk.error && (
                                <div className="mt-3 pt-3 border-t border-red-200">
                                  <div className="text-xs font-semibold text-red-700 mb-1">Error Details:</div>
                                  <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-100 font-mono break-words">
                                    {healthData.checks.disk.error}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Sockets Check */}
                            {healthData.checks.sockets.status !== 'unknown' && (
                              <div className={`p-5 rounded-lg border-2 ${
                                healthData.checks.sockets.status === 'ok'
                                  ? 'bg-green-50 border-green-200'
                                  : 'bg-yellow-50 border-yellow-200'
                              }`}>
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                                    <span>🔌</span>
                                    <span>WebSockets</span>
                                  </h4>
                                  <span className="text-2xl">🔌</span>
                                </div>
                                <div className="text-sm font-medium text-gray-700">
                                  Active Connections: {healthData.checks.sockets.value ?? 0}
                                </div>
                                {healthData.checks.sockets.error && (
                                  <div className="mt-3 pt-3 border-t border-yellow-200">
                                    <div className="text-xs font-semibold text-yellow-700 mb-1">Error Details:</div>
                                    <div className="text-xs text-yellow-600 bg-yellow-50 p-2 rounded border border-yellow-100 font-mono break-words">
                                      {healthData.checks.sockets.error}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* API Metrics & Queue Status */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                            {/* API Metrics */}
                            {healthData.checks.apiMetrics && (
                              <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                  <span>📊</span>
                                  <span>API Metrics (Last 24h)</span>
                                </h3>
                                <div className="space-y-4">
                                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-purple-100">
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                                        <span className="text-red-600 text-xl">❌</span>
                                      </div>
                                      <div>
                                        <div className="text-sm font-medium text-gray-700">Errors</div>
                                        <div className="text-xs text-gray-500">Server errors tracked</div>
                                      </div>
                                    </div>
                                    <div className="text-2xl font-bold text-red-600">
                                      {healthData.checks.apiMetrics.errorsLast24h}
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-purple-100">
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                                        <span className="text-orange-600 text-xl">🔐</span>
                                      </div>
                                      <div>
                                        <div className="text-sm font-medium text-gray-700">Login Failures</div>
                                        <div className="text-xs text-gray-500">Failed authentication attempts</div>
                                      </div>
                                    </div>
                                    <div className="text-2xl font-bold text-orange-600">
                                      {healthData.checks.apiMetrics.loginFailures}
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-purple-100">
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                                        <span className="text-yellow-600 text-xl">🚫</span>
                                      </div>
                                      <div>
                                        <div className="text-sm font-medium text-gray-700">Rate Limit Blocks</div>
                                        <div className="text-xs text-gray-500">Requests blocked by rate limiter</div>
                                      </div>
                                    </div>
                                    <div className="text-2xl font-bold text-yellow-600">
                                      {healthData.checks.apiMetrics.rateLimitBlocks}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Queue Status */}
                            {healthData.checks.queue && (
                              <div className="bg-indigo-50 border-2 border-indigo-200 rounded-lg p-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                  <span>⚙️</span>
                                  <span>Queue Status</span>
                                </h3>
                                <div className="space-y-4">
                                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-indigo-100">
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                        <span className="text-blue-600 text-xl">⏳</span>
                                      </div>
                                      <div>
                                        <div className="text-sm font-medium text-gray-700">Pending</div>
                                        <div className="text-xs text-gray-500">Jobs waiting in queue</div>
                                      </div>
                                    </div>
                                    <div className="text-2xl font-bold text-blue-600">
                                      {healthData.checks.queue.pending}
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-indigo-100">
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                                        <span className="text-green-600 text-xl">▶️</span>
                                      </div>
                                      <div>
                                        <div className="text-sm font-medium text-gray-700">Running</div>
                                        <div className="text-xs text-gray-500">Jobs currently executing</div>
                                      </div>
                                    </div>
                                    <div className="text-2xl font-bold text-green-600">
                                      {healthData.checks.queue.running}
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-indigo-100">
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                                        <span className="text-red-600 text-xl">⚠️</span>
                                      </div>
                                      <div>
                                        <div className="text-sm font-medium text-gray-700">Failed</div>
                                        <div className="text-xs text-gray-500">Jobs that failed execution</div>
                                      </div>
                                    </div>
                                    <div className="text-2xl font-bold text-red-600">
                                      {healthData.checks.queue.failed}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Auto-refresh indicator */}
                          <div className="mt-6 text-center text-sm text-gray-500">
                            Auto-refreshing every 30 seconds
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-12 text-gray-500">
                          No health data available. Click refresh to load.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Reports Tab - Event Logs */}
                {activeTab === 'reports' && (
                  <div className="space-y-6">
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                      <h2 className="text-xl font-semibold text-gray-900 mb-4">Event Logs</h2>
                      <p className="text-gray-600 mb-6">
                        View and filter all system events, user actions, and activity logs.
                      </p>

                      {/* Export Buttons */}
                      <div className="flex gap-2 mb-6">
                        <button
                          onClick={async () => {
                            try {
                              const params: any = { format: 'csv' };
                              if (logsDateFilter !== 'all') {
                                if (logsDateFilter === 'custom' && logsDateFrom && logsDateTo) {
                                  params.date_from = logsDateFrom;
                                  params.date_to = logsDateTo;
                                } else {
                                  params.range = logsDateFilter === 'today' ? 'today' : 
                                               logsDateFilter === 'this_week' ? 'week' : 
                                               logsDateFilter === 'this_month' ? 'month' : undefined;
                                }
                              }
                              if (logsSearch) params.search = logsSearch;
                              if (logsRoleFilter) params.role = logsRoleFilter;
                              if (logsEventTypeFilter) params.action = logsEventTypeFilter;
                              if (logsServiceFilter) params.service = logsServiceFilter;
                              if (logsCourseFilter) params.courseId = parseInt(logsCourseFilter, 10);
                              if (logsStudentFilter) params.studentId = parseInt(logsStudentFilter, 10);
                              
                              const queryString = new URLSearchParams(params as any).toString();
                              const token = localStorage.getItem('lms-token');
                              
                              // Use dynamic API URL (same as ApiService)
                              const apiUrl = process.env.NEXT_PUBLIC_API_URL || 
                                             (typeof window !== 'undefined' 
                                               ? `${window.location.protocol}//${window.location.hostname}:5000/api`
                                               : 'http://localhost:5000/api');
                              
                              const response = await fetch(`${apiUrl}/admin/logs?${queryString}`, {
                                headers: {
                                  'Authorization': `Bearer ${token}`
                                }
                              });
                              
                              if (!response.ok) {
                                throw new Error('Export failed');
                              }
                              
                              const blob = await response.blob();
                              const url = window.URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `logs_export_${new Date().toISOString().slice(0, 10)}.csv`;
                              document.body.appendChild(a);
                              a.click();
                              window.URL.revokeObjectURL(url);
                              document.body.removeChild(a);
                            } catch (error) {
                              console.error('Export error:', error);
                              alert('Failed to export CSV. Please try again.');
                            }
                          }}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                        >
                          <span>📥</span> Export CSV
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              const params: any = { format: 'pdf' };
                              if (logsDateFilter !== 'all') {
                                if (logsDateFilter === 'custom' && logsDateFrom && logsDateTo) {
                                  params.date_from = logsDateFrom;
                                  params.date_to = logsDateTo;
                                } else {
                                  params.range = logsDateFilter === 'today' ? 'today' : 
                                               logsDateFilter === 'this_week' ? 'week' : 
                                               logsDateFilter === 'this_month' ? 'month' : undefined;
                                }
                              }
                              if (logsSearch) params.search = logsSearch;
                              if (logsRoleFilter) params.role = logsRoleFilter;
                              if (logsEventTypeFilter) params.action = logsEventTypeFilter;
                              if (logsServiceFilter) params.service = logsServiceFilter;
                              if (logsCourseFilter) params.courseId = parseInt(logsCourseFilter, 10);
                              if (logsStudentFilter) params.studentId = parseInt(logsStudentFilter, 10);
                              
                              const queryString = new URLSearchParams(params as any).toString();
                              const token = localStorage.getItem('lms-token');
                              
                              // Use dynamic API URL (same as ApiService)
                              const apiUrl = process.env.NEXT_PUBLIC_API_URL || 
                                             (typeof window !== 'undefined' 
                                               ? `${window.location.protocol}//${window.location.hostname}:5000/api`
                                               : 'http://localhost:5000/api');
                              
                              const response = await fetch(`${apiUrl}/admin/logs?${queryString}`, {
                                headers: {
                                  'Authorization': `Bearer ${token}`
                                }
                              });
                              
                              if (!response.ok) {
                                throw new Error('Export failed');
                              }
                              
                              const blob = await response.blob();
                              const url = window.URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `logs_export_${new Date().toISOString().slice(0, 10)}.pdf`;
                              document.body.appendChild(a);
                              a.click();
                              window.URL.revokeObjectURL(url);
                              document.body.removeChild(a);
                            } catch (error) {
                              console.error('Export error:', error);
                              alert('Failed to export PDF. Please try again.');
                            }
                          }}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                        >
                          <span>📄</span> Export PDF
                        </button>
                      </div>

                      {/* Filters */}
                      <div className="space-y-4 mb-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                            <input
                              type="text"
                              value={logsSearch}
                              onChange={(e) => {
                                setLogsSearch(e.target.value);
                                setLogsPage(1);
                              }}
                              placeholder="Search in descriptions..."
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Role</label>
                            <select
                              value={logsRoleFilter}
                              onChange={(e) => {
                                setLogsRoleFilter(e.target.value);
                                setLogsPage(1);
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
                            >
                              <option value="">All Roles</option>
                              <option value="admin">Admin</option>
                              <option value="tutor">Tutor</option>
                              <option value="student">Student</option>
                              <option value="system">System</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Action</label>
                            <input
                              type="text"
                              value={logsEventTypeFilter}
                              onChange={(e) => {
                                setLogsEventTypeFilter(e.target.value);
                                setLogsPage(1);
                              }}
                              placeholder="e.g. user_login, cpd_quiz_created..."
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
                            />
                          </div>
                        </div>
                        
                        {/* New Filters Row - Service, Course, Student */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Service</label>
                            <select
                              value={logsServiceFilter}
                              onChange={(e) => {
                                setLogsServiceFilter(e.target.value);
                                setLogsPage(1);
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
                            >
                              <option value="">All Services</option>
                              <option value="admin">Admin</option>
                              <option value="auth">Auth</option>
                              <option value="student">Student</option>
                              <option value="cpd">CPD</option>
                              <option value="qualification">Qualification</option>
                              <option value="system">System</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Course</label>
                            <select
                              value={logsCourseFilter}
                              onChange={(e) => {
                                setLogsCourseFilter(e.target.value);
                                setLogsPage(1);
                              }}
                              disabled={loadingCourses}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF] disabled:bg-gray-100"
                            >
                              <option value="">All Courses</option>
                              {courses.map((course) => (
                                <option key={course.id} value={course.id}>
                                  {course.title}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Student</label>
                            <select
                              value={logsStudentFilter}
                              onChange={(e) => {
                                setLogsStudentFilter(e.target.value);
                                setLogsPage(1);
                              }}
                              disabled={loadingStudents}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF] disabled:bg-gray-100"
                            >
                              <option value="">All Students</option>
                              {students.map((student) => (
                                <option key={student.id} value={student.id}>
                                  {student.name} ({student.email})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Date Filter */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Date</label>
                          <div className="flex flex-wrap items-center gap-2">
                            {(['all', 'today', 'this_week', 'this_month', 'custom'] as const).map((filter) => (
                              <button
                                key={filter}
                                onClick={() => {
                                  setLogsDateFilter(filter);
                                  setLogsPage(1);
                                }}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                  logsDateFilter === filter
                                    ? 'bg-[#11CCEF] text-white'
                                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                                }`}
                              >
                                {filter === 'all' ? 'All Time' : 
                                 filter === 'today' ? 'Today' : 
                                 filter === 'this_week' ? 'This Week' : 
                                 filter === 'this_month' ? 'This Month' : 'Custom Range'}
                              </button>
                            ))}
                          </div>
                          {logsDateFilter === 'custom' && (
                            <div className="flex gap-2 mt-2">
                              <input
                                type="date"
                                value={logsDateFrom}
                                onChange={(e) => {
                                  setLogsDateFrom(e.target.value);
                                  setLogsPage(1);
                                }}
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
                                placeholder="From"
                              />
                              <input
                                type="date"
                                value={logsDateTo}
                                onChange={(e) => {
                                  setLogsDateTo(e.target.value);
                                  setLogsPage(1);
                                }}
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
                                placeholder="To"
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Logs Table */}
                      {logsLoading ? (
                        <div className="text-[#11CCEF] py-8 text-center">Loading logs...</div>
                      ) : logsError ? (
                        <div className="bg-red-50 text-red-600 border border-red-200 rounded-lg px-4 py-3">
                          {logsError}
                        </div>
                      ) : logs.length === 0 ? (
                        <div className="bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-lg px-4 py-3">
                          No logs found matching your filters.
                        </div>
                      ) : (
                        <>
                          {/* Pagination Info */}
                          <div className="flex items-center justify-between mb-4">
                            <div className="text-sm text-gray-600">
                              Showing {((logsPage - 1) * logsLimit) + 1} to {Math.min(logsPage * logsLimit, logsTotal)} of {logsTotal} logs
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="text-sm text-gray-600">Items per page:</label>
                              <select
                                value={logsLimit}
                                onChange={(e) => {
                                  setLogsLimit(Number(e.target.value));
                                  setLogsPage(1);
                                }}
                                className="px-2 py-1 border border-gray-300 rounded text-sm"
                              >
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                                <option value={200}>200</option>
                              </select>
                            </div>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date/Time</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP / Country</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {logs.map((log) => {
                                  const isExpanded = expandedLogs.has(log.id);
                                  const toggleExpanded = () => {
                                    const newSet = new Set(expandedLogs);
                                    if (isExpanded) {
                                      newSet.delete(log.id);
                                    } else {
                                      newSet.add(log.id);
                                    }
                                    setExpandedLogs(newSet);
                                  };
                                  
                                  let parsedRequestBody = null;
                                  try {
                                    if (log.request_body) {
                                      parsedRequestBody = JSON.parse(log.request_body);
                                    }
                                  } catch (e) {
                                    // If parsing fails, show raw string
                                    parsedRequestBody = log.request_body;
                                  }
                                  
                                  return (
                                    <React.Fragment key={log.id}>
                                      <tr className="hover:bg-gray-50">
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                          {new Date(log.created_at).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                          {log.user_name || (log.user_id ? `User #${log.user_id}` : 'System')}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                            log.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                                            log.role === 'tutor' ? 'bg-blue-100 text-blue-800' :
                                            log.role === 'student' ? 'bg-green-100 text-green-800' :
                                            (log.role as any) === 'manager' ? 'bg-yellow-100 text-yellow-800' :
                                            (log.role as any) === 'moderator' ? 'bg-indigo-100 text-indigo-800' :
                                            'bg-gray-100 text-gray-800'
                                          }`}>
                                            {log.role || (log.user_id ? 'Unknown' : 'System')}
                                          </span>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                            log.service === 'admin' ? 'bg-indigo-100 text-indigo-800' :
                                            log.service === 'auth' ? 'bg-orange-100 text-orange-800' :
                                            log.service === 'student' ? 'bg-teal-100 text-teal-800' :
                                            log.service === 'cpd' ? 'bg-pink-100 text-pink-800' :
                                            log.service === 'qualification' ? 'bg-cyan-100 text-cyan-800' :
                                            log.service === 'system' ? 'bg-gray-100 text-gray-800' :
                                            'bg-gray-100 text-gray-500'
                                          }`}>
                                            {log.service || 'system'}
                                          </span>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-mono">
                                          {log.action || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-600 max-w-md truncate">
                                          {log.description || '-'}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                          <div className="font-mono">
                                            {(() => {
                                              const ip = log.ip_address || '';
                                              // Check if it's localhost (various formats)
                                              if (ip === '::1' || ip === '127.0.0.1' || 
                                                  ip.startsWith('::ffff:127.0.0.1') || 
                                                  ip === 'localhost') {
                                                return 'Localhost';
                                              }
                                              // Check if it's a private IP (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
                                              const cleanedIP = ip.replace(/^::ffff:/i, '').trim();
                                              if (cleanedIP.startsWith('192.168.') || 
                                                  cleanedIP.startsWith('10.') || 
                                                  /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(cleanedIP)) {
                                                return cleanedIP || ip || '-';
                                              }
                                              return ip || '-';
                                            })()}
                                          </div>
                                          {log.country_code ? (
                                            <div className="text-xs text-gray-400 mt-1">
                                              🌍 {log.country_code}
                                            </div>
                                          ) : (() => {
                                            const ip = log.ip_address || '';
                                            const cleanedIP = ip.replace(/^::ffff:/i, '').trim();
                                            // Show "Private IP" for private IPs, "Unknown" for public IPs without country
                                            if (cleanedIP.startsWith('192.168.') || 
                                                cleanedIP.startsWith('10.') || 
                                                /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(cleanedIP)) {
                                              return (
                                                <div className="text-xs text-gray-400 mt-1">
                                                  🔒 Private IP
                                                </div>
                                              );
                                            }
                                            // Only show "Unknown" for public IPs that should have country data
                                            if (ip && ip !== '::1' && ip !== '127.0.0.1' && 
                                                !ip.startsWith('::ffff:127.0.0.1') && ip !== 'localhost') {
                                              return (
                                                <div className="text-xs text-gray-400 mt-1">
                                                  🌍 Unknown
                                                </div>
                                              );
                                            }
                                            return null;
                                          })()}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                                          <button
                                            onClick={toggleExpanded}
                                            className="text-[#11CCEF] hover:text-[#0FA8C7] font-medium"
                                          >
                                            {isExpanded ? '▼ Hide' : '▶ Show'}
                                          </button>
                                        </td>
                                      </tr>
                                      {isExpanded && (
                                        <tr className="bg-gray-50">
                                          <td colSpan={8} className="px-4 py-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                              <div>
                                                <span className="font-semibold text-gray-700">Endpoint:</span>
                                                <div className="mt-1 p-2 bg-white rounded border border-gray-200 font-mono text-xs break-all">
                                                  {log.endpoint || '-'}
                                                </div>
                                              </div>
                                              <div>
                                                <span className="font-semibold text-gray-700">Method:</span>
                                                <div className="mt-1 p-2 bg-white rounded border border-gray-200">
                                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                                    log.method === 'GET' ? 'bg-blue-100 text-blue-800' :
                                                    log.method === 'POST' ? 'bg-green-100 text-green-800' :
                                                    log.method === 'PUT' ? 'bg-yellow-100 text-yellow-800' :
                                                    log.method === 'DELETE' ? 'bg-red-100 text-red-800' :
                                                    'bg-gray-100 text-gray-800'
                                                  }`}>
                                                    {log.method || '-'}
                                                  </span>
                                                </div>
                                              </div>
                                              <div>
                                                <span className="font-semibold text-gray-700">User Agent:</span>
                                                <div className="mt-1 p-2 bg-white rounded border border-gray-200 font-mono text-xs break-all">
                                                  {log.user_agent || '-'}
                                                </div>
                                              </div>
                                              <div>
                                                <span className="font-semibold text-gray-700">Request Body:</span>
                                                <div className="mt-1 p-2 bg-white rounded border border-gray-200 font-mono text-xs break-all max-h-32 overflow-y-auto">
                                                  {parsedRequestBody ? (
                                                    typeof parsedRequestBody === 'string' ? (
                                                      <pre className="whitespace-pre-wrap">{parsedRequestBody}</pre>
                                                    ) : (
                                                      <pre className="whitespace-pre-wrap">{JSON.stringify(parsedRequestBody, null, 2)}</pre>
                                                    )
                                                  ) : '-'}
                                                </div>
                                              </div>
                                            </div>
                                          </td>
                                        </tr>
                                      )}
                                    </React.Fragment>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          {/* Pagination */}
                          {logsTotalPages > 1 && (
                            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                              <button
                                onClick={() => setLogsPage((p) => Math.max(1, p - 1))}
                                disabled={logsPage === 1}
                                className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                              >
                                « Prev
                              </button>
                              <div className="flex items-center gap-1">
                                {Array.from({ length: Math.min(5, logsTotalPages) }, (_, i) => {
                                  let pageNum;
                                  if (logsTotalPages <= 5) {
                                    pageNum = i + 1;
                                  } else if (logsPage <= 3) {
                                    pageNum = i + 1;
                                  } else if (logsPage >= logsTotalPages - 2) {
                                    pageNum = logsTotalPages - 4 + i;
                                  } else {
                                    pageNum = logsPage - 2 + i;
                                  }
                                  return (
                                    <button
                                      key={pageNum}
                                      onClick={() => setLogsPage(pageNum)}
                                      className={`px-3 py-1 rounded text-sm ${
                                        logsPage === pageNum
                                          ? 'bg-[#11CCEF] text-white'
                                          : 'border border-gray-300 hover:bg-gray-50'
                                      }`}
                                    >
                                      {pageNum}
                                    </button>
                                  );
                                })}
                                {logsTotalPages > 5 && <span className="px-2 text-sm text-gray-500">…</span>}
                              </div>
                              <button
                                onClick={() => setLogsPage((p) => Math.min(logsTotalPages, p + 1))}
                                disabled={logsPage === logsTotalPages}
                                className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                              >
                                Next »
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Certificate Claims Management */}
                {activeTab === 'certificates' && (
                  <CertificateClaimsManagement />
                )}

                {/* Certificate Templates Management */}
                {activeTab === 'certificate-templates' && (
                  <CertificateTemplateManager />
                )}

                {/* Generated Certificates Management */}
                {activeTab === 'generated-certificates' && (
                  <GeneratedCertificatesManagement />
                )}

                {/* Other tabs (Forums) */}
                {!['overview', 'users', 'courses', 'totalcourses', 'import', 'assignments', 'quizzes', 'chat', 'health', 'reports', 'payments', 'students', 'students-profile', 'certificates', 'certificate-templates', 'generated-certificates'].includes(activeTab) && (
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">
                      {tabs.find(tab => tab.id === activeTab)?.name}
                    </h2>
                    <div className="text-center py-8">
                      <div className="text-4xl mb-4">🚧</div>
                      <p className="text-gray-600">
                        {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} management coming soon...
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default AdminDashboard;