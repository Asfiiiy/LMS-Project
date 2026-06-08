'use client';

import React from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import UserManagement from '@/app/components/UserManagement';
import ImpersonationLogs from '@/app/components/ImpersonationLogs';
import CourseManagement from '@/app/components/CourseManagement';
import StudentEnrollment from '@/app/components/StudentEnrollment';
import StudentsProfileView from '@/app/components/StudentsProfileView';
import PaymentManagementView from '@/app/components/PaymentManagementView';
import StripeSettings from '@/app/dashboard/admin/components/StripeSettings';
import CertificateClaimsManagement from '@/app/components/CertificateClaimsManagement';
import CertificateTemplateManager from '@/app/components/CertificateTemplateManager';
import GeneratedCertificatesManagement from '@/app/components/GeneratedCertificatesManagement';
import AITokenManagement from '@/app/components/AITokenManagement';
import AssessorStudentReports from '@/app/components/AssessorStudentReports';
import { apiService } from '@/app/services/api';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { UserRole, User } from '@/app/components/types';
import { getApiUrl } from '@/app/utils/apiUrl';
import { getStoredToken, getStoredUserJson } from '@/app/utils/authStorage';
import UniversalFileViewer from '@/app/components/UniversalFileViewer';

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
  user_email?: string | null;
  role: 'admin' | 'assessor' | 'student' | 'system' | 'ai_agent' | null;
  action: string;
  description: string | null;
  ip_address: string | null;
  country_code: string | null;
  country_name: string | null;
  service: string | null;
  course_id: number | null;
  student_id: number | null;
  user_agent?: string | null;
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
      } catch (error) { }
      finally {
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

// File Version Row Component
const FileVersionRow = ({ 
  file, 
  isLatest, 
  hasOlderVersions, 
  isExpanded, 
  onToggle, 
  onView
}: { 
  file: any; 
  isLatest: boolean; 
  hasOlderVersions: boolean; 
  isExpanded: boolean; 
  onToggle: () => void; 
  onView: (path: string, name: string, id: number) => void; 
}) => {
  const isViewable = file.file_name.toLowerCase().match(/\.(pdf|jpg|jpeg|png|gif|webp|docx|doc|pptx|ppt|mp3|wav|m4a|mp4|mov|webm)$/);
  const isRejected = file.status === 'resubmit_requested';
  const isNew = file.is_new === 1 || file.is_new === true;
  
  return (
    <div className={`flex items-center justify-between p-3 ${
      isLatest ? (isRejected ? 'bg-red-50' : 'bg-white') : 'bg-gray-100'
    }`}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {hasOlderVersions && isLatest && (
          <button
            onClick={onToggle}
            className="text-gray-600 hover:text-gray-900 transition-transform duration-200"
            style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
          >
            ▶
          </button>
        )}
        <span className="text-2xl">
          {file.file_type === 'image' ? '🖼️' : 
           file.file_type === 'audio' ? '🎵' : 
           file.file_type === 'video' ? '🎥' : '📄'}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-gray-900 truncate">{file.file_name}</p>
            {isLatest && isNew && (
              <span className="px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded animate-pulse">
                NEW
              </span>
            )}
            {isRejected && (
              <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded">
                REJECTED
              </span>
            )}
            {!isLatest && !isRejected && (
              <span className="px-2 py-0.5 bg-gray-400 text-white text-xs font-semibold rounded">
                OLD
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">
            {new Date(file.uploaded_at).toLocaleDateString()} • {(file.file_size / 1024 / 1024).toFixed(2)} MB
          </p>
          {isRejected && file.resubmit_feedback && (
            <p className="text-xs text-red-600 mt-1 italic">
              Rejection reason: {file.resubmit_feedback}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 ml-3">
        <button
          onClick={() => onView(file.file_path, file.file_name, file.id)}
          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 whitespace-nowrap"
        >
          {isViewable ? 'View' : 'Download'}
        </button>
      </div>
    </div>
  );
};

const AdminDashboard = () => {
  const router = useRouter();
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [authReady, setAuthReady] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [navCollapsed, setNavCollapsed] = useState(false);
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
  
  // Tree expansion states for assignments
  const [assignmentsExpandedStudent, setAssignmentsExpandedStudent] = useState<{[key: string]: boolean}>({});
  const [assignmentsExpandedCourse, setAssignmentsExpandedCourse] = useState<{[key: string]: boolean}>({});
  const [assignmentsExpandedUnit, setAssignmentsExpandedUnit] = useState<{[key: string]: boolean}>({});
  const [assignmentsExpandedSubmission, setAssignmentsExpandedSubmission] = useState<{[key: number]: boolean}>({});
  const [assignmentsExpandedFeedback, setAssignmentsExpandedFeedback] = useState<{[key: number]: boolean}>({});
  const [assignmentsExpandedFileVersions, setAssignmentsExpandedFileVersions] = useState<{[key: number]: boolean}>({});
  
  // File viewer state
  const [showUniversalViewer, setShowUniversalViewer] = useState(false);
  const [viewerFile, setViewerFile] = useState<{url: string, name: string, fileId?: number, openedAt?: string} | null>(null);
  
  // PDF Viewer state
  const [pdfSrc, setPdfSrc] = useState<string>('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  
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
  const [logsStudentSearch, setLogsStudentSearch] = useState<string>('');
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());
  const [logsGroupByStudent, setLogsGroupByStudent] = useState(false);
  const [expandedStudentIds, setExpandedStudentIds] = useState<Set<number>>(new Set());
  
  // Active users state
  const [activeUsers, setActiveUsers] = useState<any[]>([]);
  const [activeUsersLoading, setActiveUsersLoading] = useState(false);
  const [activeUsersError, setActiveUsersError] = useState<string | null>(null);
  const [activeUsersPage, setActiveUsersPage] = useState(1);
  const [activeUsersLimit, setActiveUsersLimit] = useState(20);
  const [activeUsersTotal, setActiveUsersTotal] = useState(0);
  const [activeUsersTotalPages, setActiveUsersTotalPages] = useState(0);
  const [showActiveUsers, setShowActiveUsers] = useState(false);
  const [showAssessorReports, setShowAssessorReports] = useState(false);
  
  // Assessor-Student Reports state
  const [assessorReportsData, setAssessorReportsData] = useState<any[]>([]);
  const [assessorReportsLoading, setAssessorReportsLoading] = useState(false);
  const [selectedAssessor, setSelectedAssessor] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [assessorsList, setAssessorsList] = useState<any[]>([]);
  const [studentsList, setStudentsList] = useState<any[]>([]);
  const [activitySummary, setActivitySummary] = useState<any>(null);
  
  // For filter dropdowns
  const [courses, setCourses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [roles, setRoles] = useState<{ id: number; name: string }[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingRoles, setLoadingRoles] = useState(false);

  useEffect(() => {
    let user: User | null = null;
    try {
      const raw = getStoredUserJson();
      user = raw ? JSON.parse(raw) : null;
    } catch {
      user = null;
    }
    setUserRole(user?.role || null);
    setAuthReady(true);
    const token = getStoredToken();
    if (token && user?.role === 'Admin') {
      fetchStats();
      loadAssessments();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only; avoid pre-auth 401s
  }, []);

  // Reset pagination when filters change
  useEffect(() => {
    setAssignmentPage(1);
  }, [assignmentDateFilter, assignmentDateFrom, assignmentDateTo, assignmentSearch]);

  useEffect(() => {
    setQuizPage(1);
  }, [quizDateFilter, quizDateFrom, quizDateTo, quizSearch]);

  // Load courses, students, and roles for filters
  useEffect(() => {
    if (activeTab === 'reports') {
      const fetchFilterData = async () => {
        setLoadingCourses(true);
        setLoadingStudents(true);
        setLoadingRoles(true);
        try {
          const [coursesData, studentsData, rolesData] = await Promise.all([
            apiService.getCourses(),
            apiService.getAllStudents(),
            apiService.getRoles()
          ]);
          if (coursesData?.success && coursesData?.courses) {
            setCourses(coursesData.courses);
          }
          if (studentsData?.success && studentsData?.students) {
            setStudents(studentsData.students);
          }
          if (rolesData?.success && rolesData?.roles) {
            setRoles(Array.isArray(rolesData.roles) ? rolesData.roles : []);
          }
        } catch (error) { }
        finally {
          setLoadingCourses(false);
          setLoadingStudents(false);
          setLoadingRoles(false);
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
  }, [activeTab, logsPage, logsLimit, logsDateFilter, logsDateFrom, logsDateTo, logsSearch, logsStudentSearch, logsRoleFilter, logsEventTypeFilter, logsServiceFilter, logsCourseFilter, logsStudentFilter]);

  // Reset logs pagination when filters change
  useEffect(() => {
    setLogsPage(1);
  }, [logsDateFilter, logsDateFrom, logsDateTo, logsSearch, logsStudentSearch, logsRoleFilter, logsEventTypeFilter, logsServiceFilter, logsCourseFilter, logsStudentFilter]);

  // Load active users when requested + auto-refresh every 30s
  useEffect(() => {
    if (showActiveUsers) {
      loadActiveUsers();
      const interval = setInterval(loadActiveUsers, 30000);
      return () => clearInterval(interval);
    }
  }, [showActiveUsers, activeUsersPage, activeUsersLimit]);


  // Handle file click - open PDFs in modal, download other files (legacy for single file)
  const handleFileClick = (filePath: string, fileName: string) => {
    let finalFileName = fileName || '';
    
    // If filename is missing or looks like a Cloudinary public ID (no extension, alphanumeric only)
    if (!finalFileName || (!finalFileName.includes('.') && /^[a-z0-9]+$/i.test(finalFileName))) {
      // Try to extract filename from Cloudinary URL
      const urlMatch = filePath.match(/\/([^\/]+)\.([a-z0-9]+)(?:\?|$)/i);
      if (urlMatch) {
        finalFileName = urlMatch[1] + '.' + urlMatch[2];
      } else {
        // Fallback: use a generic name with extension from URL
        const extMatch = filePath.match(/\.([a-z0-9]+)(?:\?|$)/i);
        const ext = extMatch ? extMatch[1] : 'file';
        finalFileName = `download.${ext}`;
      }
    }
    
    // Ensure HTTPS
    const secureFilePath = filePath && filePath.startsWith('http://')
      ? filePath.replace('http://', 'https://')
      : filePath;
    
    // Open in Universal File Viewer
    setViewerFile({ url: secureFilePath, name: finalFileName });
    setShowUniversalViewer(true);
  };

  // Handle file click from FileVersionRow (for multi-file system)
  const handleFileView = async (filePath: string, fileName: string, fileId?: number) => {
    // Mark as viewed if qualification file
    if (fileId) {
      try {
        await apiService.markQualificationFileAsViewed(fileId);
      } catch (e) { }
    }
    // Ensure HTTPS
    const secureFilePath = filePath && filePath.startsWith('http://')
      ? filePath.replace('http://', 'https://')
      : filePath;
    
    // Open in Universal File Viewer (pass fileId for download logging, openedAt for file_closed)
    setViewerFile({ url: secureFilePath, name: fileName, fileId, openedAt: new Date().toISOString() });
    setShowUniversalViewer(true);
  };

  // Handle download from viewer - log assessor activity then trigger download
  const handleViewerDownload = async () => {
    if (!viewerFile) return;
    if (viewerFile.fileId) {
      try {
        await apiService.markQualificationFileAsDownloaded(viewerFile.fileId);
      } catch (e) { }
    }
    const apiUrl = getApiUrl();
    const downloadUrl = `${apiUrl}/api/qualification/download-file?url=${encodeURIComponent(viewerFile.url)}&filename=${encodeURIComponent(viewerFile.name)}`;
    window.open(downloadUrl, '_blank');
  };

  const closePdfViewer = () => {
    setPdfSrc('');
    setPdfLoading(false);
    setPdfError(false);
  };

  const fetchStats = async () => {
    try {
      const data = await apiService.getAdminStats();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) { }
    finally {
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
      if (logsStudentSearch.trim()) {
        params.search_user = logsStudentSearch.trim();
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
      setLogsError(err.message || 'Unable to load logs right now.');
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  };

  /** Format duration seconds as human-readable (e.g. "45s", "2m 30s", "1h 5m", "2h 10m 30s") */
  const formatDurationSeconds = (seconds: string | number | null | undefined): string => {
    if (seconds === null || seconds === undefined || seconds === '') return '';
    const n = typeof seconds === 'string' ? parseInt(seconds, 10) : seconds;
    if (!Number.isFinite(n) || n < 0) return '';
    if (n < 60) return `${n}s`;
    const m = Math.floor(n / 60);
    const s = n % 60;
    if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
    const h = Math.floor(m / 60);
    const min = m % 60;
    if (min === 0 && s === 0) return `${h}h`;
    if (s === 0) return `${h}h ${min}m`;
    return `${h}h ${min}m ${s}s`;
  };

  /** Parse request_body for detail fields (file_name, duration_seconds, opened_at, closed_at, unit_id, course_name, unit_name) */
  const parseLogDetail = (request_body: string | null): { file_name: string; duration_seconds: string; opened_at: string; closed_at: string; unit_id: string; course_name: string; unit_name: string } => {
    const empty = { file_name: '', duration_seconds: '', opened_at: '', closed_at: '', unit_id: '', course_name: '', unit_name: '' };
    if (!request_body) return empty;
    try {
      const b = JSON.parse(request_body);
      if (!b || typeof b !== 'object') return empty;
      return {
        file_name: b.file_name ?? b.fileName ?? '',
        duration_seconds: b.duration_seconds != null ? String(b.duration_seconds) : (b.duration != null ? String(b.duration) : ''),
        opened_at: b.opened_at ?? b.openedAt ?? '',
        closed_at: b.closed_at ?? b.closedAt ?? '',
        unit_id: b.unit_id != null ? String(b.unit_id) : (b.unitId != null ? String(b.unitId) : ''),
        course_name: b.course_name ?? b.courseName ?? '',
        unit_name: b.unit_name ?? b.unitName ?? ''
      };
    } catch {
      return empty;
    }
  };

  /** Download current logs as Student Activity CSV (Student Name, Email, Date/Time, Action, Description, Course Name, Unit Name, File Name, Duration, Course ID, Unit ID, Opened At, Closed At) */
  const downloadStudentActivityCSV = () => {
    const header = ['Student Name', 'Student Email', 'Date/Time', 'Action', 'Description', 'Course Name', 'Unit Name', 'File Name', 'Duration', 'Course ID', 'Unit ID', 'Opened At', 'Closed At', 'IP', 'Created At'];
    const escape = (v: unknown) => {
      if (v == null) return '';
      const s = String(v).replace(/"/g, '""');
      return `"${s}"`;
    };
    const rows = logs.map((log) => {
      const d = parseLogDetail(log.request_body);
      return [
        log.user_name ?? '',
        log.user_email ?? '',
        new Date(log.created_at).toLocaleString(),
        log.action ?? '',
        log.description ?? '',
        d.course_name,
        d.unit_name,
        d.file_name,
        formatDurationSeconds(d.duration_seconds) || d.duration_seconds,
        log.course_id ?? '',
        d.unit_id,
        d.opened_at,
        d.closed_at,
        log.ip_address ?? '',
        log.created_at
      ].map(escape).join(',');
    });
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `student_activity_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  /** Download detailed report for a single student (group) */
  const downloadStudentDetailedReport = (group: { user_name: string; user_email: string | null; logs: EventLog[] }) => {
    const header = ['Student Name', 'Student Email', 'Date/Time', 'Action', 'Description', 'Course Name', 'Unit Name', 'File Name', 'Duration', 'Course ID', 'Unit ID', 'Opened At', 'Closed At', 'IP', 'Created At'];
    const escape = (v: unknown) => {
      if (v == null) return '';
      const s = String(v).replace(/"/g, '""');
      return `"${s}"`;
    };
    const rows = group.logs.map((log) => {
      const d = parseLogDetail(log.request_body);
      return [
        group.user_name,
        group.user_email ?? '',
        new Date(log.created_at).toLocaleString(),
        log.action ?? '',
        log.description ?? '',
        d.course_name,
        d.unit_name,
        d.file_name,
        formatDurationSeconds(d.duration_seconds) || d.duration_seconds,
        log.course_id ?? '',
        d.unit_id,
        d.opened_at,
        d.closed_at,
        log.ip_address ?? '',
        log.created_at
      ].map(escape).join(',');
    });
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const safeName = (group.user_name || 'student').replace(/[^a-zA-Z0-9-_]/g, '_');
    a.download = `student_report_${safeName}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  /** Group logs by user_id for "Group by student" view (one row per student, expand to see all activity) */
  const studentGroups = useMemo(() => {
    const m = new Map<number, EventLog[]>();
    for (const log of logs) {
      const uid = log.user_id;
      if (uid == null) continue;
      if (!m.has(uid)) m.set(uid, []);
      m.get(uid)!.push(log);
    }
    return Array.from(m.entries())
      .map(([userId, logList]) => ({
        userId,
        user_name: logList[0]?.user_name ?? `User #${userId}`,
        user_email: logList[0]?.user_email ?? '',
        logs: [...logList].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      }))
      .sort((a, b) => (b.logs[0]?.created_at ?? '').localeCompare(a.logs[0]?.created_at ?? ''));
  }, [logs]);

  const loadActiveUsers = async () => {
    setActiveUsersLoading(true);
    setActiveUsersError(null);
    try {
      const response = await apiService.getActiveUsers({
        page: activeUsersPage,
        limit: activeUsersLimit
      });
      
      if (response?.success) {
        setActiveUsers(response.users || []);
        setActiveUsersTotal(response.pagination?.total || 0);
        setActiveUsersTotalPages(response.pagination?.totalPages || 0);
      } else {
        throw new Error(response?.message || 'Failed to load active users');
      }
    } catch (err: any) {
      setActiveUsersError(err.message || 'Unable to load active users right now.');
      setActiveUsers([]);
    } finally {
      setActiveUsersLoading(false);
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
            return false;
          }
        });
      }
    }
    
    return filtered;
  }, [assignmentRows, assignmentSearch, assignmentDateFilter, assignmentDateFrom, assignmentDateTo]);

  // Hierarchical assignments structure (Student > Course > Unit > Submissions)
  const hierarchicalAssignments = useMemo(() => {
    const students: {[key: string]: any} = {};
    
    filteredAssignments.forEach((row) => {
      const studentKey = `student-${row.student_id}`;
      
      if (!students[studentKey]) {
        students[studentKey] = {
          student_id: row.student_id,
          student_name: row.student_name,
          student_email: row.student_email,
          courses: {}
        };
      }
      
      const courseKey = `course-${row.course_id}`;
      if (!students[studentKey].courses[courseKey]) {
        students[studentKey].courses[courseKey] = {
          course_id: row.course_id,
          course_title: row.course_title,
          units: {}
        };
      }
      
      const unitKey = `assignment-${row.assignment_id}`;
      if (!students[studentKey].courses[courseKey].units[unitKey]) {
        students[studentKey].courses[courseKey].units[unitKey] = {
          assignment_id: row.assignment_id,
          assignment_title: row.assignment_title,
          submissions: []
        };
      }
      
      students[studentKey].courses[courseKey].units[unitKey].submissions.push(row);
    });
    
    return students;
  }, [filteredAssignments]);
  
  // Paginated students for tree view
  const paginatedHierarchicalAssignments = useMemo(() => {
    const studentKeys = Object.keys(hierarchicalAssignments);
    const start = (assignmentPage - 1) * assignmentLimit;
    const end = start + assignmentLimit;
    const paginatedKeys = studentKeys.slice(start, end);
    
    const paginated: {[key: string]: any} = {};
    paginatedKeys.forEach(key => {
      paginated[key] = hierarchicalAssignments[key];
    });
    
    return {
      students: paginated,
      totalStudents: studentKeys.length
    };
  }, [hierarchicalAssignments, assignmentPage, assignmentLimit]);

  // Paginated assignments (for legacy table view if needed)
  const paginatedAssignments = useMemo(() => {
    const start = (assignmentPage - 1) * assignmentLimit;
    const end = start + assignmentLimit;
    return filteredAssignments.slice(start, end);
  }, [filteredAssignments, assignmentPage, assignmentLimit]);

  const assignmentTotalPages = Math.ceil(Object.keys(hierarchicalAssignments).length / assignmentLimit);

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
    { id: 'profile', name: 'My Profile', icon: '👤' },
    { id: 'users', name: 'User Management', icon: '👥' },
    { id: 'impersonation-logs', name: 'Impersonation Logs', icon: '🔑' },
    { id: 'courses', name: 'Course Management', icon: '📚' },
    { id: 'students', name: 'Student Insights', icon: '👥' },
    { id: 'students-profile', name: 'Students Profile', icon: '👤' },
    { id: 'payments', name: 'Payments', icon: '💳' },
    { id: 'consultations', name: 'Consultations', icon: '📹' },
    { id: 'import', name: 'Import Moodle', icon: '📦' },
    { id: 'assignments', name: 'Assignments', icon: '📝' },
    { id: 'quizzes', name: 'Quizzes', icon: '❓' },
    { id: 'chat', name: 'Chat', icon: '💬' },
    { id: 'forums', name: 'Forums', icon: '📋' },
    { id: 'certificates', name: 'Certificates', icon: '🏆' },
    { id: 'certificate-templates', name: 'Certificate Templates', icon: '📄' },
    { id: 'totalcourses', name: 'Total Courses', icon: '📚' },
    { id: 'reports', name: 'Reports', icon: '📈' },
    { id: 'ai-tokens', name: 'AI Tokens', icon: '🤖' },
    { id: 'health', name: 'Health', icon: '🏥' },
    { id: 'emails', name: 'Emails', icon: '✉️' },
    { id: 'backup', name: 'Backup', icon: '🗄️' }
  ];

  const getRoleColor = (role: string) => {
    const r = role.toLowerCase();
    if (r === 'admin') return 'bg-red-500';
    if (r === 'assessor') return 'bg-green-500';
    if (r === 'student') return 'bg-blue-500';
    if (r === 'manager') return 'bg-purple-500';
    if (r === 'accounts manager' || r === 'accounts_manager') return 'bg-amber-500';
    if (r === 'certificate manager') return 'bg-amber-500';
    if (r === 'moderator') return 'bg-orange-500';
    return 'bg-gray-500';
  };

  return (
    <ProtectedRoute allowedRoles={['Admin']} userRole={userRole} authReady={authReady}>
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
          {/* Sidebar - toggle to collapse/expand */}
          <div
            className={`flex-shrink-0 bg-white shadow-sm min-h-screen border-r border-gray-200 transition-[width] duration-200 ${
              navCollapsed ? 'w-16' : 'w-64'
            }`}
          >
            <nav className="p-4">
              <div className={`flex items-center mb-4 ${navCollapsed ? 'justify-center' : 'justify-between'}`}>
                {!navCollapsed && (
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                    Navigation
                  </h2>
                )}
                <button
                  type="button"
                  onClick={() => setNavCollapsed((c) => !c)}
                  className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors flex-shrink-0"
                  aria-label={navCollapsed ? 'Expand navigation' : 'Collapse navigation'}
                  title={navCollapsed ? 'Expand navigation' : 'Collapse navigation'}
                >
                  <svg
                    className={`w-5 h-5 transition-transform duration-200 ${navCollapsed ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                  </svg>
                </button>
              </div>
              <ul className="space-y-1">
                {tabs.map((tab) => (
                  <li key={tab.id}>
                    <button
                      onClick={() => {
                        if (tab.id === 'forums') {
                          router.push('/dashboard/forum');
                        } else if (tab.id === 'profile') {
                          router.push('/profile');
                        } else if (tab.id === 'consultations') {
                          router.push('/dashboard/admin/consultations');
                        } else if (tab.id === 'emails') {
                          router.push('/dashboard/admin/emails');
                        } else {
                          setActiveTab(tab.id);
                        }
                      }}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-3 ${
                        navCollapsed ? 'justify-center px-0' : ''
                      } ${
                        activeTab === tab.id
                          ? 'bg-[#11CCEF] text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                      title={navCollapsed ? tab.name : undefined}
                    >
                      <span className="text-lg flex-shrink-0">{tab.icon}</span>
                      {!navCollapsed && <span className="font-medium truncate">{tab.name}</span>}
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
                {/* Overview Tab: Quick Actions on top, then upper box (Admins, Assessors, Students, Accounts Managers only) */}
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    {/* Quick Actions - on top */}
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

                    {/* Upper box: Admins, Assessors, Students, Accounts Managers only */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                      {stats?.users
                        ?.filter((userStat) => {
                          const r = (userStat.role || '').toLowerCase();
                          return (
                            r === 'admin' || r === 'assessor' || r === 'student' ||
                            r === 'accounts manager' || r === 'accounts_manager' ||
                            r === 'certificate manager'
                          );
                        })
                        .map((userStat) => (
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
                    </div>
                  </div>
                )}

                {/* User Management Tab */}
                {activeTab === 'users' && <UserManagement />}

                {/* Impersonation Logs Tab */}
                {activeTab === 'impersonation-logs' && (
                  <ImpersonationLogs />
                )}

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
                  <div className="space-y-6">
                    <StripeSettings />
                    <PaymentManagementView userRole="Admin" />
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
                            Showing {((assignmentPage - 1) * assignmentLimit) + 1} to {Math.min(assignmentPage * assignmentLimit, paginatedHierarchicalAssignments.totalStudents)} of {paginatedHierarchicalAssignments.totalStudents} students
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-sm font-medium">Students per page:</label>
                            <select
                              value={assignmentLimit}
                              onChange={(e) => {
                                setAssignmentLimit(Number(e.target.value));
                                setAssignmentPage(1);
                              }}
                              className="px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
                            >
                              <option value={5}>5</option>
                              <option value={10}>10</option>
                              <option value={25}>25</option>
                              <option value={50}>50</option>
                            </select>
                          </div>
                        </div>
                      {/* Tree View: Students > Courses > Assignments > Submissions */}
                      <div className="space-y-3">
                        {paginatedHierarchicalAssignments.totalStudents === 0 ? (
                          <div className="text-center py-20">
                            <p className="text-xl text-gray-400">
                              No submissions match your search
                            </p>
                          </div>
                        ) : (
                          Object.keys(paginatedHierarchicalAssignments.students).map((studentKey) => {
                            const student = paginatedHierarchicalAssignments.students[studentKey];
                            const isStudentExpanded = assignmentsExpandedStudent[studentKey];

                            return (
                              <div key={studentKey} className="bg-white rounded-lg overflow-hidden border border-gray-200">
                                {/* Level 1: Student */}
                                <button
                                  onClick={() => setAssignmentsExpandedStudent(prev => ({ ...prev, [studentKey]: !prev[studentKey] }))}
                                  className="w-full flex items-center justify-between p-4 transition-colors hover:bg-gray-50"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-[#11CCEF] text-white flex items-center justify-center text-lg font-bold">
                                      {student.student_name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="text-left">
                                      <h3 className="text-lg font-bold text-gray-900">
                                        👤 {student.student_name}
                                      </h3>
                                      <p className="text-sm text-gray-500">
                                        {student.student_email} • {Object.keys(student.courses).length} Course(s)
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-2xl text-gray-400">
                                    {isStudentExpanded ? '▼' : '▶'}
                                  </div>
                                </button>

                                {/* Level 2: Courses (nested under student) */}
                                {isStudentExpanded && (
                                  <div className="bg-gray-50 px-4 py-2">
                                    {Object.keys(student.courses).map((courseKey) => {
                                      const course = student.courses[courseKey];
                                      const isCourseExpanded = assignmentsExpandedCourse[`${studentKey}-${courseKey}`];

                                      return (
                                        <div key={courseKey} className="mb-2">
                                          <button
                                            onClick={() => setAssignmentsExpandedCourse(prev => ({ ...prev, [`${studentKey}-${courseKey}`]: !prev[`${studentKey}-${courseKey}`] }))}
                                            className="w-full flex items-center justify-between p-3 bg-white rounded-lg hover:bg-gray-100 transition-colors border border-gray-200"
                                          >
                                            <div className="flex items-center gap-2">
                                              <span className="text-xl">📚</span>
                                              <div className="text-left">
                                                <h4 className="font-semibold text-gray-900">{course.course_title}</h4>
                                                <p className="text-xs text-gray-500">{Object.keys(course.units).length} Assignment(s)</p>
                                              </div>
                                            </div>
                                            <div className="text-xl text-gray-400">
                                              {isCourseExpanded ? '▼' : '▶'}
                                            </div>
                                          </button>

                                          {/* Level 3: Units/Assignments (nested under course) */}
                                          {isCourseExpanded && (
                                            <div className="ml-4 mt-2 space-y-2">
                                              {Object.keys(course.units).map((unitKey) => {
                                                const unit = course.units[unitKey];
                                                const isUnitExpanded = assignmentsExpandedUnit[`${studentKey}-${courseKey}-${unitKey}`];

                                                return (
                                                  <div key={unitKey}>
                                                    <button
                                                      onClick={() => setAssignmentsExpandedUnit(prev => ({ ...prev, [`${studentKey}-${courseKey}-${unitKey}`]: !prev[`${studentKey}-${courseKey}-${unitKey}`] }))}
                                                      className="w-full flex items-center justify-between p-3 bg-white rounded-lg hover:bg-blue-50 transition-colors border border-gray-200"
                                                    >
                                                      <div className="flex items-center gap-2">
                                                        <span className="text-lg">📝</span>
                                                        <div className="text-left">
                                                          <h5 className="font-medium text-gray-900">{unit.assignment_title}</h5>
                                                          <p className="text-xs text-gray-500">{unit.submissions.length} Submission(s)</p>
                                                        </div>
                                                      </div>
                                                      <div className="text-lg text-gray-400">
                                                        {isUnitExpanded ? '▼' : '▶'}
                                                      </div>
                                                    </button>

                                                    {/* Level 4: Submissions (nested under assignment) */}
                                                    {isUnitExpanded && (
                                                      <div className="ml-4 mt-2 space-y-2">
                                                        {unit.submissions.map((submission: any) => {
                                                          const submissionKey = submission.assignment_id || `${submission.assignment_id}-${submission.student_id}`;
                                                          const isSubmissionExpanded = assignmentsExpandedSubmission[submissionKey];
                                                          const isFeedbackExpanded = assignmentsExpandedFeedback[submissionKey];
                                                          
                                                          return (
                                                            <div key={submissionKey} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                                              <div 
                                                                onClick={() => setAssignmentsExpandedSubmission(prev => ({ ...prev, [submissionKey]: !prev[submissionKey] }))}
                                                                className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                                                              >
                                                                <div className="flex-1">
                                                                  <div className="flex items-center gap-2 mb-2">
                                                                    <h6 className="font-semibold text-gray-900">📝 Submission #{submissionKey}</h6>
                                                                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                                                      submission.is_submitted ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                                                                    }`}>
                                                                      {submission.is_submitted ? '✔ Submitted' : 'Pending'}
                                                                    </span>
                                                                    {submission.pass_fail_result ? (
                                                                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                                                        submission.pass_fail_result === 'pass' 
                                                                          ? 'bg-green-100 text-green-700' 
                                                                          : submission.pass_fail_result === 'refer'
                                                                          ? 'bg-orange-100 text-orange-700'
                                                                          : 'bg-red-100 text-red-700'
                                                                      }`}>
                                                                        {submission.pass_fail_result === 'pass' ? '✅ Pass' : submission.pass_fail_result === 'refer' ? '⚠️ Refer' : '❌ Fail'}
                                                                      </span>
                                                                    ) : (
                                                                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                                                        submission.is_pass ? 'bg-green-100 text-green-700' :
                                                                        submission.is_submitted ? 'bg-yellow-100 text-yellow-700' :
                                                                        'bg-gray-100 text-gray-500'
                                                                      }`}>
                                                                        {submission.is_pass ? '✅ Pass' : submission.is_submitted ? '📋 Needs Review' : 'Not Graded'}
                                                                      </span>
                                                                    )}
                                                                  </div>
                                                                  {submission.submitted_at && (
                                                                    <p className="text-xs text-gray-500">
                                                                      Submitted: {new Date(submission.submitted_at).toLocaleString()}
                                                                    </p>
                                                                  )}
                                                                </div>
                                                                <div className="text-lg text-gray-400">
                                                                  {isSubmissionExpanded ? '▼' : '▶'}
                                                                </div>
                                                              </div>

                                                              {/* Expanded Submission Details */}
                                                              {isSubmissionExpanded && (
                                                                <div className="px-4 pb-4 space-y-4">
                                                                  <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-gray-50">
                                                                    {submission.file_name && (
                                                                      <div>
                                                                        <p className="text-xs font-medium text-gray-500 mb-1">File Name</p>
                                                                        <p className="text-sm font-medium text-gray-900">{submission.file_name}</p>
                                                                      </div>
                                                                    )}
                                                                    {submission.status && (
                                                                      <div>
                                                                        <p className="text-xs font-medium text-gray-500 mb-1">Status</p>
                                                                        <p className="text-sm font-medium text-gray-900 capitalize">{submission.status}</p>
                                                                      </div>
                                                                    )}
                                                                    {submission.pass_fail_result && (
                                                                      <div>
                                                                        <p className="text-xs font-medium text-gray-500 mb-1">Result</p>
                                                                        <p className={`text-sm font-medium ${submission.pass_fail_result === 'pass' ? 'text-green-600' : 'text-red-600'}`}>
                                                                          {submission.pass_fail_result === 'pass' ? '✅ Pass' : '❌ Fail'}
                                                                        </p>
                                                                      </div>
                                                                    )}
                                                                    {submission.graded_by_name && (
                                                                      <div>
                                                                        <p className="text-xs font-medium text-gray-500 mb-1">Graded By</p>
                                                                        <p className="text-sm font-medium text-gray-900">{submission.graded_by_name}</p>
                                                                      </div>
                                                                    )}
                                                                  </div>

                                                                  {/* Submitted Files Section - Multi-file support */}
                                                                  <div className="bg-white rounded-lg border-2 border-[#11CCEF40] p-4">
                                                                    <h4 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-900">
                                                                      <span>📎</span>
                                                                      <span>Submitted Files ({submission.files?.length || (submission.file_path ? 1 : 0)})</span>
                                                                    </h4>
                                                                    
                                                                    {submission.files && submission.files.length > 0 ? (
                                                                      <div className="space-y-3">
                                                                        {(() => {
                                                                          // Build version chains (same logic as Record tab)
                                                                          const fileMap = new Map<number, any>();
                                                                          const latestFiles: any[] = [];
                                                                          
                                                                          // Index all files
                                                                          submission.files.forEach((file: any) => {
                                                                            fileMap.set(file.id, { ...file, olderVersions: [] });
                                                                          });
                                                                          
                                                                          // Build version chains
                                                                          submission.files.forEach((file: any) => {
                                                                            if (file.replaces_file_id && fileMap.has(file.replaces_file_id)) {
                                                                              const oldFile = fileMap.get(file.replaces_file_id);
                                                                              const newFile = fileMap.get(file.id);
                                                                              if (newFile && oldFile) {
                                                                                newFile.olderVersions = [oldFile, ...oldFile.olderVersions];
                                                                              }
                                                                            }
                                                                          });
                                                                          
                                                                          // Find latest versions (files that aren't replaced by anything)
                                                                          const replacedIds = new Set(submission.files.filter((f: any) => f.replaces_file_id).map((f: any) => f.replaces_file_id));
                                                                          submission.files.forEach((file: any) => {
                                                                            if (!replacedIds.has(file.id)) {
                                                                              latestFiles.push(fileMap.get(file.id));
                                                                            }
                                                                          });
                                                                          
                                                                          return latestFiles.map((fileChain: any) => {
                                                                            const file = fileChain;
                                                                            const hasOlderVersions = fileChain.olderVersions && fileChain.olderVersions.length > 0;
                                                                            const isVersionExpanded = assignmentsExpandedFileVersions[file.id] || false;
                                                                            
                                                                            return (
                                                                              <div key={file.id} className="border border-gray-200 rounded-lg overflow-hidden">
                                                                                {/* Latest Version */}
                                                                                <FileVersionRow 
                                                                                  file={file} 
                                                                                  isLatest={true}
                                                                                  hasOlderVersions={hasOlderVersions}
                                                                                  isExpanded={isVersionExpanded}
                                                                                  onToggle={() => setAssignmentsExpandedFileVersions(prev => ({
                                                                                    ...prev,
                                                                                    [file.id]: !prev[file.id]
                                                                                  }))}
                                                                                  onView={handleFileView}
                                                                                />
                                                                                
                                                                                {/* Older Versions (Collapsible) */}
                                                                                {hasOlderVersions && isVersionExpanded && (
                                                                                  <div className="bg-gray-50 border-t border-gray-200">
                                                                                    <div className="pl-8 pr-3 py-2">
                                                                                      <p className="text-xs font-semibold text-gray-600 mb-2">
                                                                                        📂 Previous Versions ({fileChain.olderVersions.length})
                                                                                      </p>
                                                                                      <div className="space-y-2">
                                                                                        {fileChain.olderVersions.map((oldFile: any, idx: number) => (
                                                                                          <FileVersionRow 
                                                                                            key={oldFile.id}
                                                                                            file={oldFile} 
                                                                                            isLatest={false}
                                                                                            hasOlderVersions={false}
                                                                                            isExpanded={false}
                                                                                            onToggle={() => {}}
                                                                                            onView={handleFileView}
                                                                                          />
                                                                                        ))}
                                                                                      </div>
                                                                                    </div>
                                                                                  </div>
                                                                                )}
                                                                              </div>
                                                                            );
                                                                          });
                                                                        })()}
                                                                      </div>
                                                                    ) : submission.file_path ? (
                                                                      // Fallback: show single file if files array doesn't exist
                                                                      <button
                                                                        onClick={(e) => {
                                                                          e.stopPropagation();
                                                                          handleFileClick(submission.file_path, submission.file_name);
                                                                        }}
                                                                        className="px-4 py-2 bg-[#11CCEF] text-white rounded-lg transition-colors hover:bg-[#0daed9] font-medium"
                                                                      >
                                                                        📄 View File
                                                                      </button>
                                                                    ) : (
                                                                      <p className="text-sm text-gray-500">No files uploaded.</p>
                                                                    )}
                                                                    
                                                                    {/* Show video/large files links if available */}
                                                                    {submission.video_link && (
                                                                      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                                                                        <p className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                                                          <span>🔗</span>
                                                                          <span>External Links:</span>
                                                                        </p>
                                                                        <div className="text-sm text-gray-700 whitespace-pre-wrap break-all">
                                                                          {submission.video_link.split('\n').map((link: string, idx: number) => (
                                                                            <div key={idx} className="mb-1">
                                                                              {link.startsWith('http') ? (
                                                                                <a href={link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                                                                  {link}
                                                                                </a>
                                                                              ) : (
                                                                                <span>{link}</span>
                                                                              )}
                                                                            </div>
                                                                          ))}
                                                                        </div>
                                                                      </div>
                                                                    )}
                                                                  </div>

                                                                  {/* Feedback Section */}
                                                                  {submission.feedback && submission.feedback.trim() !== '' && (
                                                                    <div className="mt-4">
                                                                      <button
                                                                        onClick={(e) => {
                                                                          e.stopPropagation();
                                                                          setAssignmentsExpandedFeedback(prev => ({ ...prev, [submissionKey]: !prev[submissionKey] }));
                                                                        }}
                                                                        className="w-full p-3 rounded-lg flex items-center justify-between transition-colors bg-blue-50 hover:bg-blue-100"
                                                                      >
                                                                        <span className="font-semibold text-[#11CCEF]">💬 View Feedback</span>
                                                                        <span className="text-[#11CCEF]">
                                                                          {isFeedbackExpanded ? '▲' : '▼'}
                                                                        </span>
                                                                      </button>

                                                                      {isFeedbackExpanded && (
                                                                        <div
                                                                          className="mt-2 p-4 rounded-lg bg-gray-50 text-gray-900 prose prose-sm max-w-none"
                                                                          dangerouslySetInnerHTML={{ __html: submission.feedback }}
                                                                        />
                                                                      )}
                                                                    </div>
                                                                  )}
                                                                </div>
                                                              )}
                                                            </div>
                                                          );
                                                        })}
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
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

                {/* AI Token Management Tab */}
                {activeTab === 'ai-tokens' && (
                  <AITokenManagement />
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
                      {/* Sub-tabs for Reports */}
                      <div className="flex gap-2 mb-6 border-b border-gray-200 pb-4">
                        <button
                          onClick={() => {
                            setShowActiveUsers(false);
                            setShowAssessorReports(false);
                          }}
                          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                            !showActiveUsers && !showAssessorReports
                              ? 'bg-[#11CCEF] text-white' 
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          📈 Event Logs
                        </button>
                        <button
                          onClick={() => {
                            setShowActiveUsers(true);
                            setShowAssessorReports(false);
                          }}
                          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                            showActiveUsers && !showAssessorReports
                              ? 'bg-purple-600 text-white' 
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          👥 Active Users
                        </button>
                        <button
                          onClick={() => {
                            setShowActiveUsers(false);
                            setShowAssessorReports(true);
                          }}
                          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                            showAssessorReports
                              ? 'bg-gradient-to-r from-[#11CCEF] to-[#E51791] text-white' 
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          🎓 Assessor-Student Activity
                        </button>
                      </div>

                      {/* Active Users View */}
                      {showActiveUsers ? (
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                                👥 Active Users Online
                                <span className="bg-green-500 text-white text-sm px-3 py-1 rounded-full">
                                  {activeUsersTotal} online
                                </span>
                              </h2>
                              <p className="text-gray-600 mt-1">
                                Live — auto-refreshes every 30 seconds.
                              </p>
                            </div>
                            <button
                              onClick={loadActiveUsers}
                              className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors flex items-center gap-2"
                            >
                              🔄 Refresh
                            </button>
                          </div>
                          
                          {activeUsersLoading ? (
                            <div className="text-purple-600 py-8 text-center">Loading active users...</div>
                          ) : activeUsersError ? (
                            <div className="bg-red-50 text-red-600 border border-red-200 rounded-lg px-4 py-3">
                              {activeUsersError}
                            </div>
                          ) : activeUsers.length === 0 ? (
                            <div className="bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-lg px-4 py-6 text-center">
                              <div className="text-4xl mb-2">😴</div>
                              No users are currently online.
                            </div>
                          ) : (
                            <>
                              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                                <table className="w-full text-sm">
                                  <thead className="bg-purple-50">
                                    <tr>
                                      <th className="px-4 py-3 text-left font-semibold text-gray-700">User</th>
                                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Email</th>
                                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Role</th>
                                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Last Activity</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {activeUsers.map((user) => (
                                      <tr key={user.id} className="hover:bg-purple-50/50">
                                        <td className="px-4 py-3">
                                          <div className="flex items-center gap-3">
                                            {user.profile_picture ? (
                                              <img 
                                                src={user.profile_picture} 
                                                alt={user.name}
                                                className="w-10 h-10 rounded-full object-cover border-2 border-green-400"
                                              />
                                            ) : (
                                              <div className="w-10 h-10 bg-purple-200 rounded-full flex items-center justify-center text-purple-700 font-semibold border-2 border-green-400">
                                                {user.name?.charAt(0)?.toUpperCase() || '?'}
                                              </div>
                                            )}
                                            <span className="font-medium text-gray-900">{user.name}</span>
                                          </div>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">{user.email}</td>
                                        <td className="px-4 py-3">
                                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                            user.role === 'Admin' ? 'bg-red-100 text-red-700' :
                                            user.role === 'Assessor' ? 'bg-blue-100 text-blue-700' :
                                            user.role === 'Student' ? 'bg-green-100 text-green-700' :
                                            user.role === 'Manager' ? 'bg-orange-100 text-orange-700' :
                                            'bg-gray-100 text-gray-700'
                                          }`}>
                                            {user.role}
                                          </span>
                                        </td>
                                        <td className="px-4 py-3">
                                          <span className="flex items-center gap-2 text-green-600 font-medium">
                                            <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></span>
                                            Online
                                          </span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-500 text-sm">
                                          {(() => {
                                            const diff = Date.now() - new Date(user.lastSeen).getTime();
                                            if (diff < 60000) return 'Just now';
                                            if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
                                            return new Date(user.lastSeen).toLocaleTimeString();
                                          })()}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              
                              {/* Pagination */}
                              {activeUsersTotalPages > 1 && (
                                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                                  <div className="text-sm text-gray-600">
                                    Showing {((activeUsersPage - 1) * activeUsersLimit) + 1} - {Math.min(activeUsersPage * activeUsersLimit, activeUsersTotal)} of {activeUsersTotal} users
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => setActiveUsersPage(Math.max(1, activeUsersPage - 1))}
                                      disabled={activeUsersPage === 1}
                                      className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      Previous
                                    </button>
                                    <span className="px-3 py-1 bg-purple-600 text-white rounded-lg">
                                      {activeUsersPage} / {activeUsersTotalPages}
                                    </span>
                                    <button
                                      onClick={() => setActiveUsersPage(Math.min(activeUsersTotalPages, activeUsersPage + 1))}
                                      disabled={activeUsersPage === activeUsersTotalPages}
                                      className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      Next
                                    </button>
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      ) : showAssessorReports ? (
                        <AssessorStudentReports />
                      ) : (
                        /* Event Logs View */
                        <div>
                          <h2 className="text-xl font-semibold text-gray-900 mb-2">Event Logs</h2>
                          <p className="text-gray-600 mb-6">
                            View and filter all system events, user actions, and activity logs.
                          </p>

                          {/* Export Buttons */}
                          <div className="flex gap-2 mb-6">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={logsGroupByStudent}
                            onChange={(e) => {
                              setLogsGroupByStudent(e.target.checked);
                              if (!e.target.checked) setExpandedStudentIds(new Set());
                            }}
                            className="rounded border-gray-300 text-[#11CCEF] focus:ring-[#11CCEF]"
                          />
                          <span className="text-sm font-medium text-gray-700">Group by student (expand to see all activity)</span>
                        </label>
                        <button
                          onClick={downloadStudentActivityCSV}
                          className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors flex items-center gap-2"
                        >
                          <span>📥</span> Download Student Activity CSV
                        </button>
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
                              const base = getApiUrl();
                              const apiBase = base.endsWith('/api') ? base : `${base}/api`;
                              const response = await fetch(`${apiBase}/admin/logs?${queryString}`, {
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
                              const base = getApiUrl();
                              const apiBase = base.endsWith('/api') ? base : `${base}/api`;
                              const response = await fetch(`${apiBase}/admin/logs?${queryString}`, {
                                headers: {
                                  'Authorization': `Bearer ${token}`
                                }
                              });
                              if (!response.ok) {
                                const text = await response.text();
                                throw new Error(text || `Export failed (${response.status})`);
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
                              alert('Failed to export PDF. Please try again.');
                            }
                          }}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                        >
                          <span>📄</span> Export PDF
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              const params: any = { format: 'csv', limit: 50000 };
                              if (logsDateFilter !== 'all') {
                                if (logsDateFilter === 'custom' && logsDateFrom && logsDateTo) {
                                  params.date_from = logsDateFrom;
                                  params.date_to = logsDateTo;
                                } else {
                                  params.range = logsDateFilter === 'today' ? 'today' : logsDateFilter === 'this_week' ? 'week' : 'month';
                                }
                              }
                              if (logsSearch) params.search = logsSearch;
                              if (logsStudentSearch) params.search_user = logsStudentSearch;
                              if (logsRoleFilter) params.role = logsRoleFilter;
                              if (logsEventTypeFilter) params.action = logsEventTypeFilter;
                              if (logsServiceFilter) params.service = logsServiceFilter;
                              if (logsCourseFilter) params.courseId = parseInt(logsCourseFilter, 10);
                              if (logsStudentFilter) params.studentId = parseInt(logsStudentFilter, 10);
                              const queryString = new URLSearchParams(params).toString();
                              const token = localStorage.getItem('lms-token');
                              const base = getApiUrl();
                              const apiBase = base.endsWith('/api') ? base : `${base}/api`;
                              const response = await fetch(`${apiBase}/admin/logs?${queryString}`, { headers: { 'Authorization': `Bearer ${token}` } });
                              if (!response.ok) {
                                const text = await response.text();
                                throw new Error(text || `Export failed (${response.status} ${response.statusText})`);
                              }
                              const blob = await response.blob();
                              const url = window.URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `all_logs_${new Date().toISOString().slice(0, 10)}.csv`;
                              document.body.appendChild(a);
                              a.click();
                              window.URL.revokeObjectURL(url);
                              document.body.removeChild(a);
                            } catch (error: any) {
                              const msg = error?.message || 'Failed to download all logs. Please try again.';
                              alert(msg.length > 120 ? 'Failed to download all logs. Check console and ensure the backend is running.' : msg);
                            }
                          }}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
                        >
                          <span>📥</span> Download all logs
                        </button>
                        <button
                          onClick={async () => {
                            const hasFilters = logsDateFilter !== 'all' || logsSearch || logsStudentSearch || logsRoleFilter || logsEventTypeFilter || logsServiceFilter || logsCourseFilter || logsStudentFilter;
                            const msg = hasFilters
                              ? 'Delete all logs matching the current filters? This cannot be undone.'
                              : 'Delete ALL logs in the system? This cannot be undone.';
                            if (!confirm(msg)) return;
                            try {
                              const params: any = {};
                              if (logsDateFilter !== 'all') {
                                if (logsDateFilter === 'custom' && logsDateFrom && logsDateTo) {
                                  params.date_from = logsDateFrom;
                                  params.date_to = logsDateTo;
                                } else {
                                  params.range = logsDateFilter === 'today' ? 'today' : logsDateFilter === 'this_week' ? 'week' : 'month';
                                }
                              }
                              if (logsStudentSearch) params.search_user = logsStudentSearch;
                              if (logsRoleFilter) params.role = logsRoleFilter;
                              if (logsEventTypeFilter) params.action = logsEventTypeFilter;
                              if (logsServiceFilter) params.service = logsServiceFilter;
                              if (logsCourseFilter) params.courseId = parseInt(logsCourseFilter, 10);
                              if (logsStudentFilter) params.studentId = parseInt(logsStudentFilter, 10);
                              const res = await apiService.deleteLogs(params);
                              if (res?.success) {
                                alert(`Deleted ${res.deleted ?? 0} log(s).`);
                                loadLogs();
                              } else {
                                throw new Error(res?.message || 'Delete failed');
                              }
                            } catch (error: any) {
                              alert(error?.message || 'Failed to delete logs. Please try again.');
                            }
                          }}
                          className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2"
                        >
                          <span>🗑️</span> Delete logs
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
                              disabled={loadingRoles}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF] disabled:bg-gray-100"
                            >
                              <option value="">All Roles</option>
                              {roles.map((role) => (
                                <option key={role.id} value={(role.name || '').toLowerCase().replace(/\s+/g, '_')}>
                                  {role.name || `Role #${role.id}`}
                                </option>
                              ))}
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

                        {/* Search by student name or email */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Search by student name or email</label>
                          <input
                            type="text"
                            value={logsStudentSearch}
                            onChange={(e) => {
                              setLogsStudentSearch(e.target.value);
                              setLogsPage(1);
                            }}
                            placeholder="Type name or email to filter logs..."
                            className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
                          />
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
                            <div className="flex flex-wrap items-center gap-3 mt-2">
                              <div className="flex items-center gap-2">
                                <label className="text-sm text-gray-600 whitespace-nowrap">From date</label>
                                <input
                                  type="date"
                                  value={logsDateFrom}
                                  onChange={(e) => {
                                    setLogsDateFrom(e.target.value);
                                    setLogsPage(1);
                                  }}
                                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <label className="text-sm text-gray-600 whitespace-nowrap">To date</label>
                                <input
                                  type="date"
                                  value={logsDateTo}
                                  onChange={(e) => {
                                    setLogsDateTo(e.target.value);
                                    setLogsPage(1);
                                  }}
                                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
                                />
                              </div>
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
                              {logsGroupByStudent ? (
                                <>
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"># Events</th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Activity</th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-gray-200">
                                    {studentGroups.map((group) => {
                                      const isExpanded = expandedStudentIds.has(group.userId);
                                      const toggleExpanded = () => {
                                        const next = new Set(expandedStudentIds);
                                        if (isExpanded) next.delete(group.userId);
                                        else next.add(group.userId);
                                        setExpandedStudentIds(next);
                                      };
                                      return (
                                        <React.Fragment key={group.userId}>
                                          <tr className="hover:bg-gray-50">
                                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{group.user_name}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{group.user_email || '-'}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{group.logs.length}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                              {group.logs[0] ? new Date(group.logs[0].created_at).toLocaleString() : '-'}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                              <div className="flex flex-wrap items-center gap-2">
                                                <button
                                                  type="button"
                                                  onClick={toggleExpanded}
                                                  className="text-[#11CCEF] hover:text-[#0DAED9] font-medium"
                                                >
                                                  {isExpanded ? '▼ Hide' : '▶ Open'}
                                                </button>
                                                <span className="text-gray-300">|</span>
                                                <button
                                                  type="button"
                                                  onClick={() => downloadStudentDetailedReport(group)}
                                                  className="text-teal-600 hover:text-teal-700 font-medium"
                                                >
                                                  📥 Download report
                                                </button>
                                              </div>
                                            </td>
                                          </tr>
                                          {isExpanded && (
                                            <tr className="bg-gray-50">
                                              <td colSpan={5} className="px-4 py-4">
                                                <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white">
                                                  <table className="min-w-full text-sm">
                                                    <thead className="bg-gray-100">
                                                      <tr>
                                                        <th className="px-3 py-2 text-left font-medium text-gray-600">Date/Time</th>
                                                        <th className="px-3 py-2 text-left font-medium text-gray-600">Action</th>
                                                        <th className="px-3 py-2 text-left font-medium text-gray-600">Description</th>
                                                        <th className="px-3 py-2 text-left font-medium text-gray-600">Course Name</th>
                                                        <th className="px-3 py-2 text-left font-medium text-gray-600">Unit Name</th>
                                                        <th className="px-3 py-2 text-left font-medium text-gray-600">File Name</th>
                                                        <th className="px-3 py-2 text-left font-medium text-gray-600">Duration</th>
                                                        <th className="px-3 py-2 text-left font-medium text-gray-600">Course ID</th>
                                                        <th className="px-3 py-2 text-left font-medium text-gray-600">Unit ID</th>
                                                        <th className="px-3 py-2 text-left font-medium text-gray-600">Opened At</th>
                                                        <th className="px-3 py-2 text-left font-medium text-gray-600">Closed At</th>
                                                      </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-200">
                                                      {group.logs.map((log) => {
                                                        const d = parseLogDetail(log.request_body);
                                                        return (
                                                          <tr key={log.id} className="hover:bg-gray-50">
                                                            <td className="px-3 py-2 whitespace-nowrap text-gray-900">{new Date(log.created_at).toLocaleString()}</td>
                                                            <td className="px-3 py-2 whitespace-nowrap font-mono text-gray-800">{log.action || '-'}</td>
                                                            <td className="px-3 py-2 text-gray-600 max-w-xs truncate" title={log.description ?? ''}>{log.description || '-'}</td>
                                                            <td className="px-3 py-2 whitespace-nowrap text-gray-800">{d.course_name || '-'}</td>
                                                            <td className="px-3 py-2 whitespace-nowrap text-gray-800">{d.unit_name || '-'}</td>
                                                            <td className="px-3 py-2 whitespace-nowrap text-gray-800">{d.file_name || '-'}</td>
                                                            <td className="px-3 py-2 whitespace-nowrap text-gray-800">{formatDurationSeconds(d.duration_seconds) || '-'}</td>
                                                            <td className="px-3 py-2 whitespace-nowrap text-gray-800">{log.course_id ?? '-'}</td>
                                                            <td className="px-3 py-2 whitespace-nowrap text-gray-800">{d.unit_id || '-'}</td>
                                                            <td className="px-3 py-2 whitespace-nowrap text-gray-600">{d.opened_at || '-'}</td>
                                                            <td className="px-3 py-2 whitespace-nowrap text-gray-600">{d.closed_at || '-'}</td>
                                                          </tr>
                                                        );
                                                      })}
                                                    </tbody>
                                                  </table>
                                                </div>
                                              </td>
                                            </tr>
                                          )}
                                        </React.Fragment>
                                      );
                                    })}
                                  </tbody>
                                </>
                              ) : (
                                <>
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
                                            log.role === 'assessor' ? 'bg-blue-100 text-blue-800' :
                                            log.role === 'student' ? 'bg-green-100 text-green-800' :
                                            (log.role as any) === 'ai_agent' ? 'bg-gradient-to-r from-[#11CCEF] to-[#E51791] text-white' :
                                            (log.role as any) === 'manager' ? 'bg-yellow-100 text-yellow-800' :
                                            (log.role as any) === 'moderator' ? 'bg-indigo-100 text-indigo-800' :
                                            'bg-gray-100 text-gray-800'
                                          }`}>
                                            {(log.role as any) === 'ai_agent' ? '🤖 AI Agent' : log.role || (log.user_id ? 'Unknown' : 'System')}
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
                                </>
                              )}
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

                {/* Backup Dashboard */}
                {activeTab === 'backup' && (
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h2 className="text-2xl font-semibold text-gray-900">Database Backup</h2>
                        <p className="text-gray-600 mt-1">Manage scheduled and manual database backups</p>
                      </div>
                    </div>
                    <div className="grid md:grid-cols-3 gap-6">
                      <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 p-6 rounded-lg">
                        <div className="text-4xl mb-3">🗄️</div>
                        <h3 className="font-semibold text-gray-900 mb-2">Full SQL Backup</h3>
                        <p className="text-sm text-gray-600 mb-4">Create, schedule, download and manage complete MySQL database backups</p>
                        <button
                          onClick={() => window.location.href = '/dashboard/admin/backup'}
                          className="text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity font-medium"
                          style={{ backgroundColor: '#11CCEF' }}
                        >
                          Open Backup Dashboard
                        </button>
                      </div>
                      <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg">
                        <div className="text-4xl mb-3">⏰</div>
                        <h3 className="font-semibold text-gray-900 mb-2">Auto Scheduled</h3>
                        <p className="text-sm text-gray-600">Daily backups at 02:00 and weekly backups every Sunday at 03:00 (London time)</p>
                      </div>
                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-lg">
                        <div className="text-4xl mb-3">🔒</div>
                        <h3 className="font-semibold text-gray-900 mb-2">Secure Storage</h3>
                        <p className="text-sm text-gray-600">Credentials never exposed in process list. Automatic retention management cleans old backups</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Other tabs (Forums) */}
                {!['overview', 'users', 'courses', 'totalcourses', 'import', 'assignments', 'quizzes', 'chat', 'health', 'reports', 'payments', 'students', 'students-profile', 'certificates', 'certificate-templates', 'generated-certificates', 'ai-tokens', 'impersonation-logs', 'backup'].includes(activeTab) && (
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

      {/* Universal File Viewer */}
      {showUniversalViewer && viewerFile && (
        <UniversalFileViewer
          fileUrl={viewerFile.url}
          fileName={viewerFile.name}
          onDownload={handleViewerDownload}
          openedAt={viewerFile.openedAt}
          onCloseWithDuration={viewerFile.fileId && viewerFile.openedAt
            ? (openedAt, opts) => apiService.markQualificationFileAsClosed(viewerFile!.fileId!, openedAt, opts)
            : undefined}
          onClose={() => {
            setShowUniversalViewer(false);
            setViewerFile(null);
          }}
        />
      )}

      {/* PDF Viewer Modal (Legacy - kept for backward compatibility) */}
      {pdfSrc && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-lg text-gray-900">PDF Viewer</h3>
              <button
                onClick={closePdfViewer}
                className="text-gray-500 hover:text-gray-700 text-2xl w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              {pdfLoading && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#11CCEF] mx-auto mb-4"></div>
                    <div className="text-lg text-gray-600">Loading PDF...</div>
                  </div>
                </div>
              )}
              {pdfError && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-red-600">
                    <div className="text-2xl mb-2">❌</div>
                    <div className="text-lg">Error loading PDF</div>
                  </div>
                </div>
              )}
              <iframe
                src={pdfSrc}
                className="w-full h-full"
                title="PDF Viewer"
                allow="fullscreen"
                style={{ border: 'none' }}
                onLoad={() => {
                  if (process.env.NODE_ENV === 'development') { console.log('[Admin Dashboard] PDF loaded successfully'); }
                  setPdfLoading(false);
                }}
                onError={() => {
                  setPdfError(true);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
};

export default AdminDashboard;