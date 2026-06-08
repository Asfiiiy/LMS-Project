'use client';

import ProtectedRoute from '@/app/components/ProtectedRoute';
import CourseManagement from '@/app/components/CourseManagement';
import StudentEnrollment from '@/app/components/StudentEnrollment';
import StudentsProfileView from '@/app/components/StudentsProfileView';
import CertificateClaimsManagement from '@/app/components/CertificateClaimsManagement';
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { User, UserRole } from '@/app/components/types';
import UniversalFileViewer from '@/app/components/UniversalFileViewer';
import { apiService } from '@/app/services/api';
import { showSweetAlert } from '@/app/components/SweetAlert';
import QuillFeedbackEditor from '@/app/components/QuillFeedbackEditor';
import RejectionDisplay from '@/app/components/RejectionDisplay';
import { getApiUrl } from '@/app/utils/apiUrl';
import Swal from 'sweetalert2';

function firstUrlInQualificationLinkBlob(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s]+/);
  return m ? m[0] : null;
}

/** Student-visible "new upload" after reject: do not rely only on is_new (tutors clear is_new on mark-viewed). */
function qualSubmissionHasFreshStudentUpload(files: any[] | undefined): boolean {
  if (!files?.length) return false;
  return files.some((f: any) => {
    const replaces = Number(f?.replaces_file_id);
    return (
      f?.is_new === 1 ||
      f?.is_new === true ||
      (Number.isFinite(replaces) && replaces > 0)
    );
  });
}

/**
 * Block Grade Now when at least one file is rejected and there is nothing left in the
 * normal assessor queue (no file still status=pending). Pending rows include new uploads after reject.
 */
function qualSubmissionGradeBlockedByFileWorkflow(files: any[] | undefined): boolean {
  if (!files?.length) return false;
  const hasRejected = files.some((f: any) => f.status === 'resubmit_requested');
  if (!hasRejected) return false;
  const hasPendingForReview = files.some((f: any) => f.status === 'pending');
  return !hasPendingForReview;
}

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

// File Version Row Component
const FileVersionRow = ({ 
  file, 
  isLatest, 
  hasOlderVersions, 
  isExpanded, 
  onToggle, 
  onView, 
  onReject 
}: { 
  file: any; 
  isLatest: boolean; 
  hasOlderVersions: boolean; 
  isExpanded: boolean; 
  onToggle: () => void; 
  onView: (path: string, name: string, id: number) => void; 
  onReject: (id: number, name: string) => void; 
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
            <RejectionDisplay
              feedback={file.resubmit_feedback}
              previewLength={200}
              showLabel={true}
              variant="card"
            />
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
        {!isRejected && isLatest && (
          <button
            onClick={() => onReject(file.id, file.file_name)}
            className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 whitespace-nowrap"
          >
            Reject
          </button>
        )}
      </div>
    </div>
  );
};

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
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('courses');
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [courseTypeFilter, setCourseTypeFilter] = useState<'all' | 'cpd' | 'qualification'>('all');
  const [assignmentRows, setAssignmentRows] = useState<TutorAssignmentRow[]>([]);
  const [quizRows, setQuizRows] = useState<TutorQuizRow[]>([]);
  const [qualSubmissions, setQualSubmissions] = useState<any[]>([]);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);
  const [assessmentLoading, setAssessmentLoading] = useState<boolean>(false);
  const [expandedSubmissionId, setExpandedSubmissionId] = useState<number | null>(null);
  const [expandedFileVersions, setExpandedFileVersions] = useState<{[key: number]: boolean}>({});
  const [showUniversalViewer, setShowUniversalViewer] = useState(false);
  const [viewerFile, setViewerFile] = useState<{url: string, name: string, fileId?: number, openedAt?: string} | null>(null);
  const [rejectingFileId, setRejectingFileId] = useState<number | null>(null);
  const [rejectFeedback, setRejectFeedback] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [subTutors, setSubTutors] = useState<any[]>([]);
  const [expandedTutorId, setExpandedTutorId] = useState<number | null>(null);
  const [subTutorStudents, setSubTutorStudents] = useState<{[key: number]: any[]}>({});
  const [loadingSubTutors, setLoadingSubTutors] = useState(false);
  const [showTeamProgress, setShowTeamProgress] = useState(false);
  const [teamProgress, setTeamProgress] = useState<any[]>([]);
  const [loadingTeamProgress, setLoadingTeamProgress] = useState(false);
  const [teamProgressFilters, setTeamProgressFilters] = useState({
    dateFrom: '',
    dateTo: '',
    sortBy: 'total_assignments_graded'
  });
  
  // Record tab states
  const [recordSubmissions, setRecordSubmissions] = useState<any[]>([]);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordExpandedStudent, setRecordExpandedStudent] = useState<{[key: string]: boolean}>({});
  const [recordExpandedCourse, setRecordExpandedCourse] = useState<{[key: string]: boolean}>({});
  const [recordExpandedUnit, setRecordExpandedUnit] = useState<{[key: string]: boolean}>({});
  const [recordExpandedSubmission, setRecordExpandedSubmission] = useState<{[key: number]: boolean}>({});
  const [recordExpandedFeedback, setRecordExpandedFeedback] = useState<{[key: number]: boolean}>({});
  const [recordExpandedFileVersions, setRecordExpandedFileVersions] = useState<{[key: number]: boolean}>({});
  const [recordSearchQuery, setRecordSearchQuery] = useState('');
  const [recordFilterStatus, setRecordFilterStatus] = useState<'all' | 'graded' | 'ungraded'>('all');
  const [recordPage, setRecordPage] = useState(1);
  const [recordLimit, setRecordLimit] = useState(10);
  const [isMainTutor, setIsMainTutor] = useState(false);
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [quizSearch, setQuizSearch] = useState('');
  const [showAttemptsModal, setShowAttemptsModal] = useState(false);
  const [selectedQuizAttempts, setSelectedQuizAttempts] = useState<any[]>([]);
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [gradeForm, setGradeForm] = useState({ pass_fail_result: 'pass', feedback: '' });
  const [showEditFeedbackModal, setShowEditFeedbackModal] = useState(false);
  const [editingFeedbackSubmission, setEditingFeedbackSubmission] = useState<any>(null);
  const [editFeedbackContent, setEditFeedbackContent] = useState('');
  // PDF Viewer state
  const [pdfSrc, setPdfSrc] = useState<string>('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  
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
        // Team Member: tickets only, redirect to tickets dashboard
        if (stored.role === 'Team Member') {
          router.replace('/dashboard/tickets');
          return;
        }
        setUser(stored);
        setUserRole(stored.role || null);
        setAuthReady(true);
        // Check if this tutor is a main tutor (has sub-tutors)
        if (stored.role === 'Assessor' && stored.id) {
          fetchSubTutors(stored.id);
        }
      } else {
        setUserRole(null);
        setAuthReady(true);
      }
    } catch (err) {
      setUserRole(null);
      setAuthReady(true);
    }
  }, [router]);
  
  // Fetch sub-tutors for main tutor
  const fetchSubTutors = async (tutorId: number) => {
    try {
      setLoadingSubTutors(true);
      const response = await apiService.getSubTutors(tutorId);
      if (response?.success && response?.subTutors) {
        setSubTutors(response.subTutors);
        setIsMainTutor(response.subTutors.length > 0);
      }
    } catch (error) {
    } finally {
      setLoadingSubTutors(false);
    }
  };
  
  // Fetch students for a specific sub-tutor
  const fetchSubTutorStudents = async (subTutorId: number) => {
    if (!user?.id) return;
    
    try {
      const response = await apiService.getSubTutorStudents(user.id, subTutorId);
      if (response?.success && response?.users) {
        setSubTutorStudents(prev => ({
          ...prev,
          [subTutorId]: response.users
        }));
      }
    } catch (error) {
    }
  };
  
  // Fetch all submissions for tutor's own students (Record tab)
  const fetchRecordSubmissions = async () => {
    if (!user?.id) return;
    
    try {
      setRecordLoading(true);
      const submissions = await apiService.getMyStudentsSubmissions(user.id);
      setRecordSubmissions(submissions || []);
    } catch (error) {
    } finally {
      setRecordLoading(false);
    }
  };
  
  // Toggle sub-tutor expansion
  const toggleSubTutor = async (subTutorId: number) => {
    if (expandedTutorId === subTutorId) {
      setExpandedTutorId(null);
    } else {
      setExpandedTutorId(subTutorId);
      // Fetch students if not already loaded
      if (!subTutorStudents[subTutorId]) {
        await fetchSubTutorStudents(subTutorId);
      }
    }
  };
  
  // Navigate to detailed stats page
  const handleStatClick = (subTutor: any, statType: 'today' | 'pending' | 'feedback') => {
    window.open(`/dashboard/tutor/team/${statType}/${subTutor.id}`, '_blank');
  };
  
  // Fetch team progress data
  const fetchTeamProgress = async () => {
    if (!user?.id) return;
    
    try {
      setLoadingTeamProgress(true);
      const response = await apiService.getTeamProgress(user.id, teamProgressFilters);
      if (response?.success && response?.teamProgress) {
        setTeamProgress(response.teamProgress);
        setShowTeamProgress(true);
      }
    } catch (error) {
    } finally {
      setLoadingTeamProgress(false);
    }
  };
  
  // Handle filter changes
  const handleFilterChange = (field: string, value: string) => {
    setTeamProgressFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  // Apply filters
  const applyFilters = () => {
    fetchTeamProgress();
  };
  
  // Reset filters
  const resetFilters = () => {
    const resetFilters = {
      dateFrom: '',
      dateTo: '',
      sortBy: 'total_assignments_graded'
    };
    setTeamProgressFilters(resetFilters);
    // Fetch with reset filters
    if (user?.id) {
      apiService.getTeamProgress(user.id, resetFilters).then(response => {
        if (response?.success && response?.teamProgress) {
          setTeamProgress(response.teamProgress);
        }
      }).catch(() => {
      });
    }
  };
  
  // Handle Team Progress button click
  const handleTeamProgressClick = () => {
    if (showTeamProgress) {
      setShowTeamProgress(false);
    } else {
      fetchTeamProgress();
    }
  };

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
  
  // Fetch record submissions when Record tab is active
  useEffect(() => {
    if (activeTab === 'record' && user?.id) {
      fetchRecordSubmissions();
    }
  }, [activeTab, user?.id]);
  
  // Reset record page when search or filter changes
  useEffect(() => {
    setRecordPage(1);
  }, [recordSearchQuery, recordFilterStatus]);

  // Handle reject file
  const handleRejectFile = async (fileId: number, fileName: string) => {
    setRejectingFileId(fileId);
    setShowRejectModal(true);
  };

  const confirmRejectFile = async () => {
    if (!rejectingFileId || !rejectFeedback.trim()) {
      showSweetAlert('Feedback Required', 'Please provide feedback for rejection', 'warning');
      return;
    }

    try {
      await apiService.rejectQualificationFile(rejectingFileId, rejectFeedback);
      showSweetAlert('Success!', 'File rejected successfully. Student will be notified.', 'success');
      
      // Refresh the submissions
      const apiUrl = getApiUrl();
      const qualSubmissionsRes = await fetch(`${apiUrl}/api/qualification/submissions/all`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('lms-token')}`,
          'Content-Type': 'application/json'
        }
      }).then(res => res.json());
      setQualSubmissions(qualSubmissionsRes?.submissions ?? []);
      
      // Refresh Record tab submissions if user is viewing it
      if (activeTab === 'record' && user?.id) {
        await fetchRecordSubmissions();
      }
      
      // Close modal and reset
      setShowRejectModal(false);
      setRejectingFileId(null);
      setRejectFeedback('');
    } catch (error) {
      showSweetAlert('Error', 'Failed to reject file. Please try again.', 'error');
    }
  };

  const handleRejectVideoLink = async (submissionId: number) => {
    const result = await Swal.fire({
      title: 'Reject video / external link?',
      text: 'The student can submit a new link after rejection. Reason is optional.',
      input: 'textarea',
      inputPlaceholder: 'Optional reason for the student…',
      showCancelButton: true,
      confirmButtonText: 'Reject link',
      confirmButtonColor: '#b91c1c',
      cancelButtonText: 'Cancel',
    });
    if (!result.isConfirmed) return;
    const reason = typeof result.value === 'string' ? result.value.trim() : '';
    try {
      await apiService.rejectVideoLink(submissionId, reason);
      showSweetAlert('Success!', 'Video link rejected. The student has been notified.', 'success');
      const apiUrl = getApiUrl();
      const qualSubmissionsRes = await fetch(`${apiUrl}/api/qualification/submissions/all`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('lms-token')}`,
          'Content-Type': 'application/json',
        },
      }).then((res) => res.json());
      const nextList = qualSubmissionsRes?.submissions ?? [];
      setQualSubmissions(nextList);
      if (activeTab === 'record' && user?.id) {
        await fetchRecordSubmissions();
      }
      if (selectedSubmission?.submission_id === submissionId) {
        const updated = nextList.find((s: any) => s.submission_id === submissionId);
        if (updated) setSelectedSubmission(updated);
      }
    } catch {
      showSweetAlert('Error', 'Failed to reject video link. Please try again.', 'error');
    }
  };

  // Handle file click - open in Universal File Viewer and mark as viewed
  const handleFileClick = async (filePath: string, fileName: string, fileId?: number) => {
    // Mark file as viewed if fileId is provided
    if (fileId) {
      try {
        await apiService.markQualificationFileAsViewed(fileId);
        // Refresh submissions to remove "NEW" badge
        const apiUrl = getApiUrl();
        const qualSubmissionsRes = await fetch(`${apiUrl}/api/qualification/submissions/all`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('lms-token')}`,
            'Content-Type': 'application/json'
          }
        }).then(res => res.json());
        setQualSubmissions(qualSubmissionsRes?.submissions ?? []);
      } catch (error) {
      }
    }

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
    
    // Ensure filePath uses HTTPS (fix Mixed Content error)
    const secureFilePath = filePath && filePath.startsWith('http://')
      ? filePath.replace('http://', 'https://')
      : filePath;
    
    // Open in Universal File Viewer (pass fileId for download logging, openedAt for file_closed)
    setViewerFile({ url: secureFilePath, name: finalFileName, fileId, openedAt: new Date().toISOString() });
    setShowUniversalViewer(true);
  };

  // Handle download from viewer - log assessor activity then trigger download
  const handleViewerDownload = async () => {
    if (!viewerFile) return;
    if (viewerFile.fileId) {
      try {
        await apiService.markQualificationFileAsDownloaded(viewerFile.fileId);
      } catch (error) {
      }
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

  useEffect(() => {
    if (!user?.id) return;
    
    const loadAssessments = async (tutorId: number) => {
      setAssessmentLoading(true);
      setAssessmentError(null);
      try {
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
              return { success: false, submissions: [] };
            }
            return res.json();
          }).catch(() => {
            return { success: false, submissions: [] };
          })
        ]);

        setAssignmentRows(
          (assignmentRes?.submissions ?? []).map((row: any) => ({
            ...row,
            grade: row.grade !== null ? Number(row.grade) : null,
            is_submitted: Number(row.is_submitted),
            is_pass: Number(row.is_pass)
          }))
        );
        
        const submissions = qualSubmissionsRes?.submissions ?? [];
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

        setQuizRows(combinedQuizzes);
      } catch (err) {
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
          return { success: false, submissions: [] };
        }
        return res.json();
      }).catch(() => {
        return { success: false, submissions: [] };
      });

      const submissions = qualSubmissionsRes?.submissions ?? [];
      setQualSubmissions(submissions);
      setQualLastRefreshed(new Date());
    } catch (error) {
    } finally {
      setQualRefreshing(false);
    }
  };
  
  // Group record submissions by Student -> Course -> Unit -> Submission
  const groupedRecordByStudent = useMemo(() => {
    const grouped: any = {};
    
    recordSubmissions.forEach((sub) => {
      const studentKey = `student_${sub.student_id}`;
      if (!grouped[studentKey]) {
        grouped[studentKey] = {
          student_id: sub.student_id,
          student_name: sub.student_name,
          courses: {}
        };
      }

      const courseKey = `course_${sub.course_id}`;
      if (!grouped[studentKey].courses[courseKey]) {
        grouped[studentKey].courses[courseKey] = {
          course_id: sub.course_id,
          course_name: sub.course_name,
          units: {}
        };
      }

      const unitKey = `unit_${sub.unit_id}`;
      if (!grouped[studentKey].courses[courseKey].units[unitKey]) {
        grouped[studentKey].courses[courseKey].units[unitKey] = {
          unit_id: sub.unit_id,
          unit_name: sub.unit_name,
          submissions: []
        };
      }

      grouped[studentKey].courses[courseKey].units[unitKey].submissions.push(sub);
    });

    return grouped;
  }, [recordSubmissions]);

  // Apply search and filters to record
  const filteredRecordStudents = useMemo(() => {
    let filtered = { ...groupedRecordByStudent };

    // Apply search filter
    if (recordSearchQuery.trim()) {
      const query = recordSearchQuery.toLowerCase();
      filtered = Object.keys(filtered).reduce((acc: any, studentKey) => {
        const student = filtered[studentKey];
        if (student.student_name.toLowerCase().includes(query)) {
          acc[studentKey] = student;
        }
        return acc;
      }, {});
    }

    // Apply status filter
    if (recordFilterStatus !== 'all') {
      Object.keys(filtered).forEach(studentKey => {
        const student = filtered[studentKey];
        Object.keys(student.courses).forEach(courseKey => {
          const course = student.courses[courseKey];
          Object.keys(course.units).forEach(unitKey => {
            const unit = course.units[unitKey];
            unit.submissions = unit.submissions.filter((sub: any) => {
              if (recordFilterStatus === 'graded') return sub.status === 'graded';
              if (recordFilterStatus === 'ungraded') return sub.status !== 'graded';
              return true;
            });
            if (unit.submissions.length === 0) {
              delete course.units[unitKey];
            }
          });
          if (Object.keys(course.units).length === 0) {
            delete student.courses[courseKey];
          }
        });
        if (Object.keys(student.courses).length === 0) {
          delete filtered[studentKey];
        }
      });
    }

    return filtered;
  }, [groupedRecordByStudent, recordSearchQuery, recordFilterStatus]);
  
  // Paginate record students
  const paginatedRecordStudents = useMemo(() => {
    const studentKeys = Object.keys(filteredRecordStudents);
    const totalStudents = studentKeys.length;
    const totalPages = Math.ceil(totalStudents / recordLimit);
    const startIndex = (recordPage - 1) * recordLimit;
    const endIndex = startIndex + recordLimit;
    const paginatedKeys = studentKeys.slice(startIndex, endIndex);
    
    const paginated: any = {};
    paginatedKeys.forEach(key => {
      paginated[key] = filteredRecordStudents[key];
    });
    
    return {
      students: paginated,
      totalStudents,
      totalPages,
      startIndex,
      endIndex
    };
  }, [filteredRecordStudents, recordPage, recordLimit]);

  // Calculate record statistics
  const recordStats = useMemo(() => {
    const totalSubmissions = recordSubmissions.length;
    const totalGraded = recordSubmissions.filter((s: any) => s.status === 'graded').length;
    const totalUngraded = recordSubmissions.filter((s: any) => s.status !== 'graded').length;
    const totalWithFeedback = recordSubmissions.filter((s: any) => s.feedback && s.feedback.trim() !== '').length;
    
    return {
      totalSubmissions,
      totalGraded,
      totalUngraded,
      totalWithFeedback
    };
  }, [recordSubmissions]);

  const tabs = useMemo(
    () => {
      const allTabs = [
        ...(isMainTutor ? [{ id: 'team', name: 'My Team', icon: '👥' }] : []),
        { id: 'profile', name: 'My Profile', icon: '👤' },
        { id: 'record', name: 'Record', icon: '📝' },
        { id: 'courses', name: 'Course Management', icon: '📚' },
        { id: 'students', name: 'Student Insights', icon: '👥' },
        { id: 'students-profile', name: 'Students Profile', icon: '👤' },
        { id: 'assignments', name: 'Assignments', icon: '📝' },
        { id: 'quiz', name: 'Quiz', icon: '❓' },
        { id: 'chat', name: 'Chat', icon: '💬' },
        { id: 'forums', name: 'Forums', icon: '💭' },
        { id: 'certificates', name: 'Certificates & Badges', icon: '🏆' },
        { id: 'totalcourses', name: 'Total Courses', icon: '📚' }
      ];
      return allTabs;
    },
    [isMainTutor]
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
        This module will reuse the admin tools with assessor-level permissions.
      </p>
    </div>
  );

  return (
    <ProtectedRoute allowedRoles={['Assessor']} userRole={userRole} authReady={authReady}>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Assessor Dashboard</h1>
                <p className="text-gray-600 mt-1">
                  Welcome back, {user?.name || 'Assessor'}! Access the same layout as the admin dashboard with
                  tools tailored to assessor responsibilities.
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
          <div className="flex-1 p-6 space-y-6">
            {/* Team Tab - Only for Main Assessors */}
            {activeTab === 'team' && isMainTutor && (
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-semibold text-gray-900">My Team</h2>
                  <button
                    onClick={handleTeamProgressClick}
                    className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                      showTeamProgress
                        ? 'bg-gray-600 text-white hover:bg-gray-700'
                        : 'bg-[#11CCEF] text-white hover:bg-[#0daed9]'
                    }`}
                  >
                    {showTeamProgress ? '← Back to Team' : '📊 Team Progress'}
                  </button>
                </div>
                
                {/* Team Progress View */}
                {showTeamProgress ? (
                  <div className="space-y-6">
                    <style dangerouslySetInnerHTML={{__html: `
                      @keyframes slideInUp {
                        from {
                          opacity: 0;
                          transform: translateY(30px);
                        }
                        to {
                          opacity: 1;
                          transform: translateY(0);
                        }
                      }
                      .team-progress-item {
                        animation: slideInUp 0.5s ease-out both;
                      }
                    `}} />
                    {loadingTeamProgress ? (
                      <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#11CCEF] mx-auto"></div>
                        <p className="text-gray-600 mt-4">Loading team progress...</p>
                      </div>
                    ) : teamProgress.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="text-5xl mb-4">📊</div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Team Progress Data</h3>
                        <p className="text-gray-600">No progress data available for your team yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Filters */}
                        <div className="bg-white p-4 rounded-lg border border-gray-200">
                          <h4 className="text-lg font-semibold text-gray-900 mb-4">Filters</h4>
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Date From</label>
                              <input
                                type="date"
                                value={teamProgressFilters.dateFrom}
                                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Date To</label>
                              <input
                                type="date"
                                value={teamProgressFilters.dateTo}
                                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
                              <select
                                value={teamProgressFilters.sortBy}
                                onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
                              >
                                <option value="total_assignments_graded">Total Graded</option>
                                <option value="total_feedback_given">Total Feedback</option>
                                <option value="week_assignments_graded">This Week</option>
                                <option value="month_assignments_graded">This Month</option>
                                <option value="student_count">Student Count</option>
                              </select>
                            </div>
                            <div className="flex items-end gap-2">
                              <button
                                onClick={applyFilters}
                                className="px-4 py-2 bg-[#11CCEF] text-white rounded-lg hover:bg-[#0daed9] font-semibold transition-colors"
                              >
                                Apply
                              </button>
                              <button
                                onClick={resetFilters}
                                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-semibold transition-colors"
                              >
                                Reset
                              </button>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
                          <h3 className="text-xl font-bold text-gray-900 mb-2">🏆 Team Leaderboard</h3>
                          <p className="text-sm text-gray-600">
                            Ranked by {
                              teamProgressFilters.sortBy === 'total_assignments_graded' ? 'Total Assignments Graded' :
                              teamProgressFilters.sortBy === 'total_feedback_given' ? 'Total Feedback Given' :
                              teamProgressFilters.sortBy === 'week_assignments_graded' ? 'This Week' :
                              teamProgressFilters.sortBy === 'month_assignments_graded' ? 'This Month' :
                              'Student Count'
                            }
                            {teamProgressFilters.dateFrom && teamProgressFilters.dateTo && 
                              ` (${teamProgressFilters.dateFrom} to ${teamProgressFilters.dateTo})`
                            }
                          </p>
                        </div>
                        
                        {teamProgress.map((tutor, index) => (
                          <div
                            key={tutor.tutor_id}
                            className="border border-gray-200 rounded-lg overflow-hidden bg-white hover:shadow-md transition-all team-progress-item"
                            style={{
                              animationDelay: `${index * 0.1}s`
                            }}
                          >
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                  {/* Rank Badge */}
                                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                                    index === 0 ? 'bg-yellow-400 text-yellow-900' :
                                    index === 1 ? 'bg-gray-300 text-gray-700' :
                                    index === 2 ? 'bg-orange-300 text-orange-900' :
                                    'bg-blue-100 text-blue-700'
                                  }`}>
                                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                                  </div>
                                  
                                  {/* Assessor Info */}
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h3 className="font-bold text-lg text-gray-900">{tutor.tutor_name}</h3>
                                      {tutor.is_main_tutor && (
                                        <span className="px-2 py-0.5 bg-purple-500 text-white text-xs font-bold rounded">
                                          MAIN TUTOR
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-sm text-gray-600">{tutor.tutor_email}</p>
                                  </div>
                                </div>
                                
                                {/* Main Stat */}
                                <div className="text-right">
                                  <div className="text-3xl font-bold text-[#11CCEF]">{tutor.total_assignments_graded}</div>
                                  <div className="text-sm text-gray-600">Total Graded</div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Stats Grid */}
                            <div className="p-4 bg-white">
                              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                <div className="text-center p-3 bg-gray-50 rounded-lg">
                                  <div className="text-2xl font-bold text-gray-900">{tutor.total_feedback_given}</div>
                                  <div className="text-xs text-gray-600 mt-1">Total Feedback</div>
                                </div>
                                <div className="text-center p-3 bg-blue-50 rounded-lg">
                                  <div className="text-2xl font-bold text-blue-600">{tutor.week_assignments_graded}</div>
                                  <div className="text-xs text-gray-600 mt-1">This Week</div>
                                </div>
                                <div className="text-center p-3 bg-green-50 rounded-lg">
                                  <div className="text-2xl font-bold text-green-600">{tutor.month_assignments_graded}</div>
                                  <div className="text-xs text-gray-600 mt-1">This Month</div>
                                </div>
                                <div className="text-center p-3 bg-purple-50 rounded-lg">
                                  <div className="text-2xl font-bold text-purple-600">{tutor.student_count}</div>
                                  <div className="text-xs text-gray-600 mt-1">Students</div>
                                </div>
                                <div className="text-center p-3 bg-yellow-50 rounded-lg">
                                  <div className="text-2xl font-bold text-yellow-600">
                                    {tutor.student_count > 0 
                                      ? Math.round((tutor.total_assignments_graded / tutor.student_count) * 10) / 10
                                      : 0
                                    }
                                  </div>
                                  <div className="text-xs text-gray-600 mt-1">Avg/Student</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Regular Team List View */
                  <>
                {loadingSubTutors ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#11CCEF] mx-auto"></div>
                    <p className="text-gray-600 mt-4">Loading team...</p>
                  </div>
                ) : subTutors.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-5xl mb-4">👥</div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No Sub-Assessors Yet</h3>
                    <p className="text-gray-600">You don't have any sub-assessors assigned to you.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {subTutors.map((subTutor) => (
                      <div key={subTutor.id} className="border border-gray-200 rounded-lg overflow-hidden">
                        {/* Sub-Assessor Header */}
                        <button
                          onClick={() => toggleSubTutor(subTutor.id)}
                          className="w-full bg-gradient-to-r from-blue-50 to-indigo-50 p-4 flex items-center justify-between hover:from-blue-100 hover:to-indigo-100 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-[#11CCEF] rounded-full flex items-center justify-center text-white font-bold text-lg">
                              {subTutor.name?.charAt(0) || 'T'}
                            </div>
                            <div className="text-left">
                              <h3 className="font-semibold text-gray-900 text-lg">{subTutor.name}</h3>
                              <p className="text-sm text-gray-600">{subTutor.email}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-6">
                            {/* Statistics */}
                            <div className="flex items-center gap-4 text-sm">
                              <div className="text-center">
                                <div className="font-bold text-gray-900">{subTutor.student_count}</div>
                                <div className="text-gray-600">Students</div>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStatClick(subTutor, 'today');
                                }}
                                className="text-center p-2 rounded transition-colors"
                                style={{
                                  backgroundColor: 'transparent',
                                  cursor: 'pointer',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#12B7F38F';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                              >
                                <div className="font-bold" style={{ color: '#11CCEF' }}>{subTutor.today_submissions}</div>
                                <div className="text-gray-600">Today's Submissions</div>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStatClick(subTutor, 'pending');
                                }}
                                className="text-center p-2 rounded transition-colors"
                                style={{
                                  backgroundColor: 'transparent',
                                  cursor: 'pointer',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#FC98D3C9';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                              >
                                <div className="font-bold" style={{ color: '#E51791' }}>{subTutor.pending_submissions}</div>
                                <div className="text-gray-600">Pending</div>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStatClick(subTutor, 'feedback');
                                }}
                                className="text-center p-2 rounded transition-colors"
                                style={{
                                  backgroundColor: 'transparent',
                                  cursor: 'pointer',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#12B7F38F';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                              >
                                <div className="font-bold" style={{ color: '#11CCEF' }}>{subTutor.feedback_today}</div>
                                <div className="text-gray-600">Feedback Today</div>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/dashboard/tutor/team/all/${subTutor.id}`);
                                }}
                                className="px-4 py-2 rounded-lg font-semibold transition-colors"
                                style={{
                                  backgroundColor: '#1E1E1E',
                                  color: '#FFFFFF',
                                  cursor: 'pointer',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#E51791';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = '#1E1E1E';
                                }}
                              >
                                📊 View/Work
                              </button>
                            </div>
                            
                            {/* Expand Icon */}
                            <svg
                              className={`w-6 h-6 text-gray-600 transition-transform ${
                                expandedTutorId === subTutor.id ? 'rotate-180' : ''
                              }`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </button>
                        
                        {/* Student List - Expanded */}
                        {expandedTutorId === subTutor.id && (
                          <div className="p-4 bg-white">
                            <h4 className="font-semibold text-gray-900 mb-3">Assigned Students</h4>
                            {subTutorStudents[subTutor.id] ? (
                              subTutorStudents[subTutor.id].length > 0 ? (
                                <div className="space-y-2">
                                  {subTutorStudents[subTutor.id].map((student: any) => (
                                    <div
                                      key={student.id}
                                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                                          {student.name?.charAt(0) || 'S'}
                                        </div>
                                        <div>
                                          <div className="font-medium text-gray-900">{student.name}</div>
                                          <div className="text-sm text-gray-600">{student.email}</div>
                                        </div>
                                      </div>
                                      <a
                                        href={`mailto:${student.email}`}
                                        className="text-[#11CCEF] hover:text-[#0da5c4] text-sm font-medium"
                                      >
                                        Email
                                      </a>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-gray-600 text-center py-4">No students assigned yet</p>
                              )
                            ) : (
                              <div className="text-center py-4">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#11CCEF] mx-auto"></div>
                                <p className="text-gray-600 mt-2 text-sm">Loading students...</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                  </>
                )}
              </div>
            )}
            
            {/* Record Tab - All submissions for assessor's own students */}
            {activeTab === 'record' && (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-6">📝 Student Submission Records</h2>
                  <p className="text-gray-600 mb-6">
                    View all submissions from your assigned students organized by student, course, and unit.
                  </p>
                  
                  {recordLoading ? (
                    <div className="text-center py-12">
                      <div className="animate-spin rounded-full h-16 w-16 border-b-2 mx-auto mb-4" style={{ borderColor: '#11CCEF' }}></div>
                      <p className="text-lg font-medium" style={{ color: '#1E1E1E' }}>Loading records...</p>
                    </div>
                  ) : (
                    <>
                      {/* Statistics Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        <div className="rounded-xl p-6" style={{ backgroundColor: '#FFFFFF', border: '2px solid #11CCEF20' }}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium" style={{ color: '#1E1E1E60' }}>Total Submissions</p>
                              <p className="text-3xl font-bold mt-2" style={{ color: '#11CCEF' }}>{recordStats.totalSubmissions}</p>
                            </div>
                            <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl" style={{ backgroundColor: '#11CCEF20' }}>📊</div>
                          </div>
                        </div>
                        <div className="rounded-xl p-6" style={{ backgroundColor: '#FFFFFF', border: '2px solid #28a74520' }}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium" style={{ color: '#1E1E1E60' }}>Total Graded</p>
                              <p className="text-3xl font-bold mt-2" style={{ color: '#28a745' }}>{recordStats.totalGraded}</p>
                            </div>
                            <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl" style={{ backgroundColor: '#28a74520' }}>✅</div>
                          </div>
                        </div>
                        <div className="rounded-xl p-6" style={{ backgroundColor: '#FFFFFF', border: '2px solid #E5179120' }}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium" style={{ color: '#1E1E1E60' }}>Total Ungraded</p>
                              <p className="text-3xl font-bold mt-2" style={{ color: '#E51791' }}>{recordStats.totalUngraded}</p>
                            </div>
                            <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl" style={{ backgroundColor: '#E5179120' }}>⏳</div>
                          </div>
                        </div>
                        <div className="rounded-xl p-6" style={{ backgroundColor: '#FFFFFF', border: '2px solid #11CCEF20' }}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium" style={{ color: '#1E1E1E60' }}>Total Feedback</p>
                              <p className="text-3xl font-bold mt-2" style={{ color: '#11CCEF' }}>{recordStats.totalWithFeedback}</p>
                            </div>
                            <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl" style={{ backgroundColor: '#11CCEF20' }}>💬</div>
                          </div>
                        </div>
                      </div>

                      {/* Search and Filters */}
                      <div className="flex flex-col md:flex-row gap-4 mb-6">
                        <div className="flex-1">
                          <input
                            type="text"
                            placeholder="🔍 Search by student name..."
                            value={recordSearchQuery}
                            onChange={(e) => setRecordSearchQuery(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg border-2 focus:outline-none transition-colors"
                            style={{ borderColor: '#1E1E1E20', backgroundColor: '#FFFFFF' }}
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setRecordFilterStatus('all')}
                            className="px-6 py-3 rounded-lg font-medium transition-colors"
                            style={{
                              backgroundColor: recordFilterStatus === 'all' ? '#11CCEF' : '#1E1E1E10',
                              color: recordFilterStatus === 'all' ? '#FFFFFF' : '#1E1E1E'
                            }}
                          >All</button>
                          <button
                            onClick={() => setRecordFilterStatus('graded')}
                            className="px-6 py-3 rounded-lg font-medium transition-colors"
                            style={{
                              backgroundColor: recordFilterStatus === 'graded' ? '#28a745' : '#1E1E1E10',
                              color: recordFilterStatus === 'graded' ? '#FFFFFF' : '#1E1E1E'
                            }}
                          >Graded</button>
                          <button
                            onClick={() => setRecordFilterStatus('ungraded')}
                            className="px-6 py-3 rounded-lg font-medium transition-colors"
                            style={{
                              backgroundColor: recordFilterStatus === 'ungraded' ? '#E51791' : '#1E1E1E10',
                              color: recordFilterStatus === 'ungraded' ? '#FFFFFF' : '#1E1E1E'
                            }}
                          >Ungraded</button>
                        </div>
                      </div>

                      {/* Pagination Info */}
                      <div className="flex justify-between items-center mb-4 text-sm" style={{ color: '#1E1E1E60' }}>
                        <span>
                          Showing {paginatedRecordStudents.totalStudents > 0 ? paginatedRecordStudents.startIndex + 1 : 0} to{' '}
                          {Math.min(paginatedRecordStudents.endIndex, paginatedRecordStudents.totalStudents)} of{' '}
                          {paginatedRecordStudents.totalStudents} student(s)
                        </span>
                        <div className="flex items-center gap-2">
                          <label className="text-sm">Per page:</label>
                          <select
                            value={recordLimit}
                            onChange={(e) => setRecordLimit(Number(e.target.value))}
                            className="px-3 py-1.5 border rounded-lg"
                            style={{ borderColor: '#1E1E1E20' }}
                          >
                            <option value={5}>5</option>
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                          </select>
                        </div>
                      </div>

                      {/* Submissions Tree */}
                      {paginatedRecordStudents.totalStudents === 0 ? (
                        <div className="text-center py-12">
                          <div className="text-6xl mb-4">📭</div>
                          <p className="text-xl font-semibold mb-2" style={{ color: '#1E1E1E' }}>No submissions found</p>
                          <p style={{ color: '#1E1E1E60' }}>Try adjusting your search or filters</p>
                        </div>
                      ) : (
                        <>
                          <div className="space-y-4">
                            {Object.keys(paginatedRecordStudents.students).map((studentKey) => {
                              const student = paginatedRecordStudents.students[studentKey];
                            const isStudentExpanded = recordExpandedStudent[studentKey];

                            return (
                              <div key={studentKey} className="rounded-xl overflow-hidden border-2" style={{ borderColor: '#1E1E1E10', backgroundColor: '#FFFFFF' }}>
                                <div
                                  onClick={() => setRecordExpandedStudent(prev => ({ ...prev, [studentKey]: !prev[studentKey] }))}
                                  className="p-6 flex items-center justify-between cursor-pointer transition-colors"
                                  style={{ backgroundColor: '#1E1E1E05' }}
                                >
                                  <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold" style={{ backgroundColor: '#11CCEF', color: '#FFFFFF' }}>
                                      {student.student_name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                      <h3 className="text-lg font-bold" style={{ color: '#1E1E1E' }}>👤 {student.student_name}</h3>
                                      <p className="text-sm" style={{ color: '#1E1E1E60' }}>
                                        {Object.keys(student.courses).length} Course(s)
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-2xl" style={{ color: '#1E1E1E40' }}>
                                    {isStudentExpanded ? '▼' : '▶'}
                                  </div>
                                </div>

                                {isStudentExpanded && (
                                  <div className="px-6 pb-4">
                                    {Object.keys(student.courses).map((courseKey) => {
                                      const course = student.courses[courseKey];
                                      const isCourseExpanded = recordExpandedCourse[courseKey];

                                      return (
                                        <div key={courseKey} className="mt-4 rounded-lg overflow-hidden border" style={{ borderColor: '#1E1E1E20' }}>
                                          <div
                                            onClick={() => setRecordExpandedCourse(prev => ({ ...prev, [courseKey]: !prev[courseKey] }))}
                                            className="p-4 flex items-center justify-between cursor-pointer transition-colors"
                                            style={{ backgroundColor: '#11CCEF10' }}
                                          >
                                            <div>
                                              <h4 className="font-bold" style={{ color: '#1E1E1E' }}>📚 {course.course_name}</h4>
                                              <p className="text-sm mt-1" style={{ color: '#1E1E1E60' }}>
                                                {Object.keys(course.units).length} Unit(s)
                                              </p>
                                            </div>
                                            <div className="text-xl" style={{ color: '#1E1E1E40' }}>
                                              {isCourseExpanded ? '▼' : '▶'}
                                            </div>
                                          </div>

                                          {isCourseExpanded && (
                                            <div className="p-4" style={{ backgroundColor: '#FFFFFF' }}>
                                              {Object.keys(course.units).map((unitKey) => {
                                                const unit = course.units[unitKey];
                                                const isUnitExpanded = recordExpandedUnit[unitKey];

                                                return (
                                                  <div key={unitKey} className="mt-3 rounded-lg overflow-hidden border" style={{ borderColor: '#1E1E1E20' }}>
                                                    <div
                                                      onClick={() => setRecordExpandedUnit(prev => ({ ...prev, [unitKey]: !prev[unitKey] }))}
                                                      className="p-4 flex items-center justify-between cursor-pointer transition-colors"
                                                      style={{ backgroundColor: '#E5179110' }}
                                                    >
                                                      <div>
                                                        <h5 className="font-semibold" style={{ color: '#1E1E1E' }}>📖 {unit.unit_name}</h5>
                                                        <p className="text-sm mt-1" style={{ color: '#1E1E1E60' }}>
                                                          {unit.submissions.length} Submission(s)
                                                        </p>
                                                      </div>
                                                      <div className="text-lg" style={{ color: '#1E1E1E40' }}>
                                                        {isUnitExpanded ? '▼' : '▶'}
                                                      </div>
                                                    </div>

                                                    {isUnitExpanded && (
                                                      <div className="p-4 space-y-3" style={{ backgroundColor: '#F8F9FA' }}>
                                                        {unit.submissions.map((sub: any) => {
                                                          const isSubmissionExpanded = recordExpandedSubmission[sub.submission_id];
                                                          const isFeedbackExpanded = recordExpandedFeedback[sub.submission_id];

                                                          return (
                                                            <div key={sub.submission_id} className="rounded-lg overflow-hidden border" style={{ borderColor: '#1E1E1E20', backgroundColor: '#FFFFFF' }}>
                                                              <div
                                                                onClick={() => setRecordExpandedSubmission(prev => ({ ...prev, [sub.submission_id]: !prev[sub.submission_id] }))}
                                                                className="p-4 flex items-center justify-between cursor-pointer"
                                                              >
                                                                <div className="flex-1">
                                                                  <div className="flex items-center gap-3 flex-wrap">
                                                                    <h6 className="font-semibold" style={{ color: '#1E1E1E' }}>📝 Submission #{sub.submission_id}</h6>
                                                                    {sub.status === 'graded' ? (
                                                                      <span
                                                                        className="px-3 py-1 rounded-full text-xs font-semibold"
                                                                        style={{
                                                                          backgroundColor: sub.pass_fail_result === 'pass' 
                                                                            ? '#28a74520' 
                                                                            : sub.pass_fail_result === 'refer'
                                                                            ? '#ff980020'
                                                                            : '#1E1E1E20',
                                                                          color: sub.pass_fail_result === 'pass' 
                                                                            ? '#28a745' 
                                                                            : sub.pass_fail_result === 'refer'
                                                                            ? '#ff9800'
                                                                            : '#1E1E1E'
                                                                        }}
                                                                      >
                                                                        {sub.pass_fail_result === 'pass' ? '✅ Pass' : sub.pass_fail_result === 'refer' ? '⚠️ Refer' : '✓ Graded'}
                                                                      </span>
                                                                    ) : (
                                                                    <span
                                                                      className="px-3 py-1 rounded-full text-xs font-medium"
                                                                      style={{
                                                                          backgroundColor: '#E5179120',
                                                                          color: '#E51791'
                                                                      }}
                                                                    >
                                                                        ⏳ Pending
                                                                    </span>
                                                                    )}
                                                                  </div>
                                                                  <p className="text-sm mt-1" style={{ color: '#1E1E1E60' }}>
                                                                    {new Date(sub.submitted_at).toLocaleString()}
                                                                  </p>
                                                                </div>
                                                                <div className="text-lg" style={{ color: '#1E1E1E40' }}>
                                                                  {isSubmissionExpanded ? '▼' : '▶'}
                                                                </div>
                                                              </div>

                                                              {isSubmissionExpanded && (
                                                                <div className="px-4 pb-4 space-y-4">
                                                                  <div className="grid grid-cols-2 gap-4 p-4 rounded-lg" style={{ backgroundColor: '#F8F9FA' }}>
                                                                    <div>
                                                                      <p className="text-xs font-medium mb-1" style={{ color: '#1E1E1E60' }}>Submission Type</p>
                                                                      <p className="text-sm font-medium" style={{ color: '#1E1E1E' }}>
                                                                        {sub.submission_type === 'assignment' ? '📋 Assignment' : '🎤 Presentation'}
                                                                      </p>
                                                                    </div>
                                                                    <div>
                                                                      <p className="text-xs font-medium mb-1" style={{ color: '#1E1E1E60' }}>Submitted</p>
                                                                      <p className="text-sm font-medium" style={{ color: '#1E1E1E' }}>
                                                                        {new Date(sub.submitted_at).toLocaleDateString()}
                                                                      </p>
                                                                    </div>
                                                                  </div>

                                                                  {/* Submitted Files Section - Same as Assignments tab */}
                                                                  <div className="bg-white rounded-lg border-2" style={{ borderColor: '#11CCEF40', padding: '16px' }}>
                                                                    <h4 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: '#1E1E1E' }}>
                                                                      <span>📎</span>
                                                                      <span>Submitted Files ({sub.files?.length || 0}{sub.video_link ? ' + Link' : ''})</span>
                                                                    </h4>
                                                                    
                                                                    {sub.files && sub.files.length > 0 ? (
                                                                      <div className="space-y-3">
                                                                        {(() => {
                                                                          // Build version chains (same logic as Assignments tab)
                                                                          const fileMap = new Map<number, any>();
                                                                          const latestFiles: any[] = [];
                                                                          
                                                                          // Index all files
                                                                          sub.files.forEach((file: any) => {
                                                                            fileMap.set(file.id, { ...file, olderVersions: [] });
                                                                          });
                                                                          
                                                                          // Build version chains
                                                                          sub.files.forEach((file: any) => {
                                                                            if (file.replaces_file_id && fileMap.has(file.replaces_file_id)) {
                                                                              const oldFile = fileMap.get(file.replaces_file_id);
                                                                              const newFile = fileMap.get(file.id);
                                                                              if (newFile && oldFile) {
                                                                                newFile.olderVersions = [oldFile, ...oldFile.olderVersions];
                                                                              }
                                                                            }
                                                                          });
                                                                          
                                                                          // Find latest versions (files that aren't replaced by anything)
                                                                          const replacedIds = new Set(sub.files.filter((f: any) => f.replaces_file_id).map((f: any) => f.replaces_file_id));
                                                                          sub.files.forEach((file: any) => {
                                                                            if (!replacedIds.has(file.id)) {
                                                                              latestFiles.push(fileMap.get(file.id));
                                                                            }
                                                                          });
                                                                          
                                                                          return latestFiles.map((fileChain: any) => {
                                                                            const file = fileChain;
                                                                            const hasOlderVersions = fileChain.olderVersions && fileChain.olderVersions.length > 0;
                                                                            const isVersionExpanded = recordExpandedFileVersions[file.id] || false;
                                                                            
                                                                            return (
                                                                              <div key={file.id} className="border border-gray-200 rounded-lg overflow-hidden">
                                                                                {/* Latest Version */}
                                                                                <FileVersionRow 
                                                                                  file={file} 
                                                                                  isLatest={true}
                                                                                  hasOlderVersions={hasOlderVersions}
                                                                                  isExpanded={isVersionExpanded}
                                                                                  onToggle={() => setRecordExpandedFileVersions(prev => ({
                                                                                    ...prev,
                                                                                    [file.id]: !prev[file.id]
                                                                                  }))}
                                                                                  onView={handleFileClick}
                                                                                  onReject={handleRejectFile}
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
                                                                                            onView={handleFileClick}
                                                                                            onReject={handleRejectFile}
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
                                                                    ) : (
                                                                      <p className="text-sm text-gray-500">No files uploaded.</p>
                                                                    )}
                                                                    
                                                                    {/* Video / external link (same actions as assignment list) */}
                                                                    {sub.video_link && (
                                                                      <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-3 sm:p-4">
                                                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                                          <div className="flex min-w-0 flex-1 items-start gap-2">
                                                                            <span className="text-lg shrink-0">🎥</span>
                                                                            <div className="min-w-0">
                                                                              <p className="text-xs font-bold uppercase tracking-wide text-sky-800">Video / large file link</p>
                                                                              <div className="mt-1 text-sm text-slate-700 whitespace-pre-wrap break-all">
                                                                                {sub.video_link.split('\n').map((line: string, idx: number) => {
                                                                                  const url = firstUrlInQualificationLinkBlob(line);
                                                                                  return (
                                                                                    <div key={idx} className="mb-1">
                                                                                      {url ? (
                                                                                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-sky-700 hover:underline">
                                                                                          {line}
                                                                                        </a>
                                                                                      ) : (
                                                                                        <span>{line}</span>
                                                                                      )}
                                                                                    </div>
                                                                                  );
                                                                                })}
                                                                              </div>
                                                                              {sub.video_link_status === 'rejected' && sub.video_link_reject_reason && (
                                                                                <p className="mt-1 text-xs text-red-700">Reason: {sub.video_link_reject_reason}</p>
                                                                              )}
                                                                            </div>
                                                                          </div>
                                                                          <div className="flex flex-shrink-0 flex-wrap gap-2">
                                                                            {firstUrlInQualificationLinkBlob(sub.video_link) && (
                                                                              <a
                                                                                href={firstUrlInQualificationLinkBlob(sub.video_link)!}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="inline-flex items-center rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-600"
                                                                              >
                                                                                Open link
                                                                              </a>
                                                                            )}
                                                                            {sub.video_link_status !== 'rejected' ? (
                                                                              <button
                                                                                type="button"
                                                                                onClick={() => handleRejectVideoLink(sub.submission_id)}
                                                                                className="inline-flex items-center rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-800 hover:bg-red-100"
                                                                              >
                                                                                Reject
                                                                              </button>
                                                                            ) : (
                                                                              <span className="inline-flex items-center rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-800">
                                                                                Rejected
                                                                              </span>
                                                                            )}
                                                                          </div>
                                                                        </div>
                                                                      </div>
                                                                    )}
                                                                  </div>

                                                                  {sub.status === 'graded' && sub.feedback && (
                                                                    <div className="mt-4">
                                                                      <button
                                                                        onClick={() => setRecordExpandedFeedback(prev => ({ ...prev, [sub.submission_id]: !prev[sub.submission_id] }))}
                                                                        className="w-full p-3 rounded-lg flex items-center justify-between transition-colors"
                                                                        style={{ backgroundColor: '#11CCEF10' }}
                                                                      >
                                                                        <span className="font-semibold" style={{ color: '#11CCEF' }}>💬 View Feedback</span>
                                                                        <span style={{ color: '#11CCEF' }}>
                                                                          {isFeedbackExpanded ? '▲' : '▼'}
                                                                        </span>
                                                                      </button>

                                                                      {isFeedbackExpanded && (
                                                                        <div className="mt-2">
                                                                          <div
                                                                            className="p-4 rounded-lg"
                                                                            style={{ backgroundColor: '#F8F9FA', color: '#1E1E1E' }}
                                                                            dangerouslySetInnerHTML={{ __html: sub.feedback }}
                                                                          />
                                                                          <div className="mt-3 flex gap-2">
                                                                            <button
                                                                              onClick={() => {
                                                                                setEditingFeedbackSubmission(sub);
                                                                                setEditFeedbackContent(sub.feedback);
                                                                                setShowEditFeedbackModal(true);
                                                                              }}
                                                                              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
                                                                            >
                                                                              ✏️ Edit Feedback
                                                                            </button>
                                                                            <button
                                                                              onClick={async () => {
                                                                                if (confirm('Are you sure you want to delete this feedback? This action cannot be undone.')) {
                                                                                  try {
                                                                                    const apiUrl = getApiUrl();
                                                                                    const response = await fetch(`${apiUrl}/api/qualification/submissions/${sub.submission_id}/feedback`, {
                                                                                      method: 'PUT',
                                                                                      headers: {
                                                                                        'Authorization': `Bearer ${localStorage.getItem('lms-token')}`,
                                                                                        'Content-Type': 'application/json'
                                                                                      },
                                                                                      body: JSON.stringify({
                                                                                        action: 'delete'
                                                                                      })
                                                                                    });

                                                                                    const data = await response.json();

                                                                                    if (data.success) {
                                                                                      showSweetAlert('Success!', 'Feedback deleted successfully', 'success');
                                                                                      // Refresh record submissions
                                                                                      await fetchRecordSubmissions();
                                                                                    } else {
                                                                                      showSweetAlert('Error', data.message || 'Failed to delete feedback', 'error');
                                                                                    }
                                                                                  } catch (error) {
                                                                                    showSweetAlert('Error', 'Error deleting feedback. Please try again.', 'error');
                                                                                  }
                                                                                }
                                                                              }}
                                                                              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors"
                                                                            >
                                                                              🗑️ Delete Feedback
                                                                            </button>
                                                                          </div>
                                                                        </div>
                                                                      )}
                                                                    </div>
                                                                  )}
                                                                  {sub.status === 'graded' && !sub.feedback && (
                                                                    <div className="mt-4">
                                                                      <button
                                                                        onClick={() => {
                                                                          setEditingFeedbackSubmission(sub);
                                                                          setEditFeedbackContent('');
                                                                          setShowEditFeedbackModal(true);
                                                                        }}
                                                                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
                                                                      >
                                                                        ➕ Add Feedback
                                                                      </button>
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
                          })}
                        </div>

                          {/* Pagination Controls */}
                          {paginatedRecordStudents.totalPages > 1 && (
                            <div className="flex justify-center items-center gap-2 mt-6">
                              <button
                                onClick={() => setRecordPage(prev => Math.max(1, prev - 1))}
                                disabled={recordPage === 1}
                                className="px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{
                                  backgroundColor: recordPage === 1 ? '#1E1E1E10' : '#11CCEF',
                                  color: recordPage === 1 ? '#1E1E1E40' : '#FFFFFF'
                                }}
                              >
                                ← Previous
                              </button>
                              
                              <span className="px-4 py-2 text-sm font-medium" style={{ color: '#1E1E1E' }}>
                                Page {recordPage} of {paginatedRecordStudents.totalPages}
                              </span>
                              
                              <button
                                onClick={() => setRecordPage(prev => Math.min(paginatedRecordStudents.totalPages, prev + 1))}
                                disabled={recordPage === paginatedRecordStudents.totalPages}
                                className="px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{
                                  backgroundColor: recordPage === paginatedRecordStudents.totalPages ? '#1E1E1E10' : '#11CCEF',
                                  color: recordPage === paginatedRecordStudents.totalPages ? '#1E1E1E40' : '#FFFFFF'
                                }}
                              >
                                Next →
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
            
            {activeTab === 'courses' && (
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Course Management</h2>
                <p className="text-gray-600 mb-6">
                  Assessors leverage the same reusable course management component as admins—create units, upload
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
              <StudentsProfileView userRole="Assessor" userId={user?.id} />
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
                              <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Files
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
                            <React.Fragment key={submission.submission_id}>
                              <tr className={`${submission.status === 'submitted' ? 'bg-yellow-50' : ''} ${expandedSubmissionId === submission.submission_id ? 'border-b-0' : ''}`}>
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
                                <td className="px-4 py-2 text-center">
                                  <button
                                    onClick={() => setExpandedSubmissionId(expandedSubmissionId === submission.submission_id ? null : submission.submission_id)}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-100 transition-colors"
                                  >
                                    <span>📎</span>
                                    <span>
                                      {(() => {
                                        const fileCount = submission.files?.length || 0;
                                        const hasVideoLink = submission.video_link && submission.video_link.trim() !== '';
                                        
                                        if (fileCount > 0 && hasVideoLink) {
                                          return `${fileCount} Files + Link`;
                                        } else if (fileCount > 0) {
                                          return `${fileCount} Files`;
                                        } else if (hasVideoLink) {
                                          return '🔗 Video/Link Only';
                                        } else {
                                          return '0 Files';
                                        }
                                      })()}
                                    </span>
                                    <span>{expandedSubmissionId === submission.submission_id ? '▼' : '▶'}</span>
                                  </button>
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-600">
                                  {new Date(submission.submitted_at).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-2 text-sm text-right">
                                  <div className="flex items-center justify-end gap-2 flex-wrap">
                                    {/* Pending / New tag: rejected files and/or rejected video link */}
                                    {submission.status !== 'graded' && (() => {
                                      const files = submission.files || [];
                                      const hasFileReject = files.some((f: any) => f.status === 'resubmit_requested');
                                      const videoRejected = submission.video_link && submission.video_link_status === 'rejected';
                                      const hasFreshUpload = qualSubmissionHasFreshStudentUpload(files);
                                      const hasPendingForReview = files.some((f: any) => f.status === 'pending');
                                      const showNew = hasFreshUpload;
                                      const showPending =
                                        (hasFileReject && !hasFreshUpload && !hasPendingForReview) || !!videoRejected;
                                      return (
                                        <>
                                          {showNew && (
                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                                              New
                                            </span>
                                          )}
                                          {showPending && (
                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                                              📋 Pending
                                            </span>
                                          )}
                                        </>
                                      );
                                    })()}
                                    {submission.status === 'graded' ? (
                                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                                        submission.pass_fail_result === 'pass' 
                                          ? 'bg-green-100 text-green-700' 
                                          : submission.pass_fail_result === 'refer'
                                          ? 'bg-orange-100 text-orange-700'
                                          : 'bg-gray-100 text-gray-700'
                                      }`}>
                                        {submission.pass_fail_result === 'pass' ? '✅ Pass' : submission.pass_fail_result === 'refer' ? '⚠️ Refer' : '⏳ Pending'}
                                      </span>
                                    ) : (
                                      <>
                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
                                          ⏳ Awaiting Grade
                                        </span>
                                        {(() => {
                                          const files = submission.files || [];
                                          const videoRejected = submission.video_link && submission.video_link_status === 'rejected';
                                          const isPending =
                                            qualSubmissionGradeBlockedByFileWorkflow(files) || !!videoRejected;
                                          
                                          return (
                                            <button 
                                              onClick={() => {
                                                setSelectedSubmission(submission);
                                                setGradeForm({ pass_fail_result: 'pass', feedback: '' });
                                                setShowGradeModal(true);
                                              }}
                                              disabled={isPending}
                                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                                isPending
                                                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                                  : 'bg-[#E51791] text-white hover:bg-[#c0146f]'
                                              }`}
                                              title={isPending ? 'Cannot grade: waiting for student to resubmit required files or video/link' : ''}
                                            >
                                              Grade Now
                                            </button>
                                          );
                                        })()}
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                              
                              {/* Expanded Files Row */}
                              {expandedSubmissionId === submission.submission_id && (
                                <tr className={submission.status === 'submitted' ? 'bg-yellow-50' : 'bg-gray-50'}>
                                  <td colSpan={7} className="px-4 py-4">
                                    <div className="bg-white rounded-lg border-2 border-blue-200 p-4">
                                      <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                                        <span>📎</span>
                                        <span>Submitted Files ({submission.files?.length || 0}{submission.video_link ? ' + Link' : ''})</span>
                                      </h4>
                                      
                                      {submission.files && submission.files.length > 0 ? (
                                        <div className="space-y-3">
                                          {(() => {
                                            // Build version chains
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
                                              const isVersionExpanded = expandedFileVersions[file.id] || false;
                                              
                                              return (
                                                <div key={file.id} className="border border-gray-200 rounded-lg overflow-hidden">
                                                  {/* Latest Version */}
                                                  <FileVersionRow 
                                                    file={file} 
                                                    isLatest={true}
                                                    hasOlderVersions={hasOlderVersions}
                                                    isExpanded={isVersionExpanded}
                                                    onToggle={() => setExpandedFileVersions(prev => ({
                                                      ...prev,
                                                      [file.id]: !prev[file.id]
                                                    }))}
                                                    onView={handleFileClick}
                                                    onReject={handleRejectFile}
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
                                                              onView={handleFileClick}
                                                              onReject={handleRejectFile}
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
                                      ) : (
                                        <p className="text-sm text-gray-500">No files uploaded.</p>
                                      )}
                                      
                                      {/* Video / external link */}
                                      {submission.video_link && (
                                        <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-3 sm:p-4">
                                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                            <div className="flex min-w-0 flex-1 items-start gap-2">
                                              <span className="text-lg shrink-0">🎥</span>
                                              <div className="min-w-0">
                                                <p className="text-xs font-bold uppercase tracking-wide text-sky-800">Video / large file link</p>
                                                <div className="mt-1 text-sm text-slate-700 whitespace-pre-wrap break-all">
                                                  {submission.video_link.split('\n').map((line: string, idx: number) => {
                                                    const url = firstUrlInQualificationLinkBlob(line);
                                                    return (
                                                      <div key={idx} className="mb-1">
                                                        {url ? (
                                                          <a href={url} target="_blank" rel="noopener noreferrer" className="text-sky-700 hover:underline">
                                                            {line}
                                                          </a>
                                                        ) : (
                                                          <span>{line}</span>
                                                        )}
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                                {submission.video_link_status === 'rejected' && submission.video_link_reject_reason && (
                                                  <p className="mt-1 text-xs text-red-700">Reason: {submission.video_link_reject_reason}</p>
                                                )}
                                              </div>
                                            </div>
                                            <div className="flex flex-shrink-0 flex-wrap gap-2">
                                              {firstUrlInQualificationLinkBlob(submission.video_link) && (
                                                <a
                                                  href={firstUrlInQualificationLinkBlob(submission.video_link)!}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="inline-flex items-center rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-600"
                                                >
                                                  Open link
                                                </a>
                                              )}
                                              {submission.video_link_status !== 'rejected' ? (
                                                <button
                                                  type="button"
                                                  onClick={() => handleRejectVideoLink(submission.submission_id)}
                                                  className="inline-flex items-center rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-800 hover:bg-red-100"
                                                >
                                                  Reject
                                                </button>
                                              ) : (
                                                <span className="inline-flex items-center rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-800">
                                                  Rejected
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
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
                      onClick={() => handleFileClick(selectedSubmission.file_path, selectedSubmission.file_name || selectedSubmission.file_path.substring(selectedSubmission.file_path.lastIndexOf('/') + 1))}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      {selectedSubmission.file_name || selectedSubmission.file_path.substring(selectedSubmission.file_path.lastIndexOf('/') + 1)}
                    </button>
                  </div>
                  {selectedSubmission.video_link && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <span className="text-gray-600 block text-xs font-semibold mb-1">Video / external link</span>
                      <p className="text-xs text-gray-800 whitespace-pre-wrap break-all mb-2">{selectedSubmission.video_link}</p>
                      <div className="flex flex-wrap gap-2">
                        {firstUrlInQualificationLinkBlob(selectedSubmission.video_link) && (
                          <a
                            href={firstUrlInQualificationLinkBlob(selectedSubmission.video_link)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-bold text-sky-600 hover:underline"
                          >
                            Open link
                          </a>
                        )}
                        {selectedSubmission.video_link_status !== 'rejected' ? (
                          <button
                            type="button"
                            onClick={() => handleRejectVideoLink(selectedSubmission.submission_id)}
                            className="text-xs font-bold text-red-700 hover:underline"
                          >
                            Reject link
                          </button>
                        ) : (
                          <span className="text-xs font-bold text-red-700">Link rejected</span>
                        )}
                      </div>
                    </div>
                  )}
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
                    Feedback *
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    💡 Tip: You can copy-paste formatted content from Word/Google Docs including tables, colors, and formatting
                  </p>
                  <QuillFeedbackEditor
                    value={gradeForm.feedback}
                    onChange={(content) => setGradeForm({ ...gradeForm, feedback: content })}
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
                  // Validate feedback is not empty
                  const feedbackText = gradeForm.feedback?.trim() || '';
                  // Remove HTML tags and check if there's actual content
                  const textContent = feedbackText.replace(/<[^>]*>/g, '').trim();
                  
                  if (!textContent) {
                    showSweetAlert('Feedback Required', 'Please provide feedback before submitting the grade.', 'warning');
                    return;
                  }

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
        
        {/* Reject File Modal */}
        {showRejectModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-[680px] max-h-[90vh] overflow-auto shadow-2xl">
              <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4 rounded-t-xl">
                <h3 className="text-lg font-semibold text-white">Reject File</h3>
              </div>
              <div className="p-6">
                <p className="text-sm text-gray-600 mb-4">
                  Please provide feedback to the student about why this file is being rejected:
                </p>
                <QuillFeedbackEditor
                  value={rejectFeedback}
                  onChange={(content) =>
                    setRejectFeedback(content)
                  }
                  placeholder={
                    'Dear learner,\n\n' +
                    'Thank you for submitting your assignment.\n\n' +
                    'After reviewing your work, we require ' +
                    'the following improvements:\n\n' +
                    '1. \n\n2. \n\n' +
                    'Please resubmit at your earliest ' +
                    'convenience.\n\nKind regards'
                  }
                />
              </div>
              <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 rounded-b-xl">
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectingFileId(null);
                    setRejectFeedback('');
                  }}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmRejectFile}
                  disabled={!rejectFeedback.trim()}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Reject File
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Edit Feedback Modal */}
        {showEditFeedbackModal && editingFeedbackSubmission && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-4xl shadow-2xl max-h-[90vh] flex flex-col">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-xl font-semibold text-gray-900">✏️ Edit Feedback</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Update feedback for {editingFeedbackSubmission.student_name} - {editingFeedbackSubmission.unit_name}
                </p>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Feedback *
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    💡 Tip: You can copy-paste formatted content from Word/Google Docs including tables, colors, and formatting
                  </p>
                  <QuillFeedbackEditor
                    value={editFeedbackContent}
                    onChange={(content) => setEditFeedbackContent(content)}
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    setShowEditFeedbackModal(false);
                    setEditingFeedbackSubmission(null);
                    setEditFeedbackContent('');
                  }}
                  className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    // Validate feedback is not empty
                    const feedbackText = editFeedbackContent?.trim() || '';
                    const textContent = feedbackText.replace(/<[^>]*>/g, '').trim();
                    
                    if (!textContent) {
                      showSweetAlert('Feedback Required', 'Please provide feedback before saving.', 'warning');
                      return;
                    }

                    try {
                      const apiUrl = getApiUrl();
                      const response = await fetch(`${apiUrl}/api/qualification/submissions/${editingFeedbackSubmission.submission_id}/feedback`, {
                        method: 'PUT',
                        headers: {
                          'Authorization': `Bearer ${localStorage.getItem('lms-token')}`,
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                          action: 'update',
                          feedback: editFeedbackContent
                        })
                      });

                      const data = await response.json();

                      if (data.success) {
                        showSweetAlert('Success!', 'Feedback updated successfully. Changes will be visible to the student immediately.', 'success');
                        setShowEditFeedbackModal(false);
                        setEditingFeedbackSubmission(null);
                        setEditFeedbackContent('');
                        
                        // Refresh record submissions
                        await fetchRecordSubmissions();
                        
                        // Also refresh assignments tab if active
                        if (activeTab === 'assignments' && user?.id) {
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
                        showSweetAlert('Error', data.message || 'Failed to update feedback', 'error');
                      }
                    } catch (error) {
                      showSweetAlert('Error', 'Error updating feedback. Please try again.', 'error');
                    }
                  }}
                  className="px-6 py-2.5 bg-[#E51791] text-white rounded-lg font-semibold hover:bg-[#c0146f] transition-colors"
                >
                  Save Feedback
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Universal File Viewer Modal */}
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
        
        {/* PDF Viewer Modal (Legacy - can be removed if Universal Viewer handles PDFs) */}
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
                    if (process.env.NODE_ENV === 'development') { console.log('[Assessor Dashboard] PDF loaded successfully'); }
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
  
  export default TutorDashboard;
