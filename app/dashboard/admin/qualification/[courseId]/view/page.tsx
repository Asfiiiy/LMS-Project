'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { apiService } from '@/app/services/api';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { showSweetAlert } from '@/app/components/SweetAlert';
import RejectionDisplay from '@/app/components/RejectionDisplay';
import { getApiUrl } from '@/app/utils/apiUrl';
import { QualificationViewSkeleton } from '@/app/components/ui/Skeleton';

// Color scheme matching your dashboard
const COLORS = {
  primary: {
    blue: '#11CCEF',
    pink: '#E51791',
    purple: '#8B5CF6'
  },
  gradients: {
    main: 'from-[#11CCEF] to-[#E51791]',
    blue: 'from-[#11CCEF] to-[#0daed9]',
    pink: 'from-[#E51791] to-[#c3147f]',
    success: 'from-green-400 to-emerald-500',
    warning: 'from-amber-400 to-orange-500',
    danger: 'from-orange-400 to-red-500'
  }
} as const;

// Professional design system
const STYLES = {
  card: 'bg-white/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20',
  button: {
    primary: 'bg-gradient-to-r from-[#11CCEF] to-[#0daed9] text-white font-semibold rounded-xl hover:shadow-lg transform hover:scale-105 transition-all duration-300',
    secondary: 'bg-white/50 text-gray-700 font-semibold rounded-xl border border-gray-200 hover:border-[#11CCEF]/30 hover:bg-white/80 transition-all duration-300',
    danger: 'bg-gradient-to-r from-[#E51791] to-[#c3147f] text-white font-semibold rounded-xl hover:shadow-lg transform hover:scale-105 transition-all duration-300'
  },
  badge: {
    success: 'bg-green-100 text-green-800 border border-green-200',
    warning: 'bg-amber-100 text-amber-800 border border-amber-200',
    danger: 'bg-red-100 text-red-800 border border-red-200',
    info: 'bg-blue-100 text-blue-800 border border-blue-200',
    purple: 'bg-purple-100 text-purple-800 border border-purple-200'
  }
};

type QualLockUnits = Array<{ order_index?: number | null }>;

/** Enrollment-setup deadline: submission opens 3 calendar days before due datetime (first unit and admin unlock exempt). */
function getQualAssignmentSubmissionLockState(opts: {
  studentDeadline: string | null | undefined;
  assignmentSubmissionUnlocked?: number | boolean | null;
  orderIndex?: number | null;
  allUnits?: QualLockUnits;
}) {
  const {
    studentDeadline,
    assignmentSubmissionUnlocked,
    orderIndex,
    allUnits = [],
  } = opts;

  const unlocked =
    assignmentSubmissionUnlocked === 1 ||
    assignmentSubmissionUnlocked === true;
  const ms = 1000 * 60 * 60 * 24;
  const now = new Date();

  if (unlocked) {
    const deadlineDate = studentDeadline ? new Date(studentDeadline) : null;
    return {
      isLocked: false,
      isAdminUnlocked: true,
      isFirstUnit: false,
      deadline: deadlineDate,
      unlockDate: null as Date | null,
      daysUntilUnlock: 0,
      daysUntilDeadline: deadlineDate
        ? Math.ceil((deadlineDate.getTime() - now.getTime()) / ms)
        : 0,
    };
  }

  if (allUnits.length > 0 && orderIndex != null && orderIndex !== undefined) {
    const minOrderIndex = Math.min(
      ...allUnits.map((u) =>
        u.order_index != null && u.order_index !== undefined ? Number(u.order_index) : 999
      )
    );
    const isFirstUnit = Number(orderIndex) === minOrderIndex;
    if (isFirstUnit) {
      const deadlineDate = studentDeadline ? new Date(studentDeadline) : null;
      return {
        isLocked: false,
        isAdminUnlocked: false,
        isFirstUnit: true,
        deadline: deadlineDate,
        unlockDate: null as Date | null,
        daysUntilUnlock: 0,
        daysUntilDeadline: deadlineDate
          ? Math.ceil((deadlineDate.getTime() - now.getTime()) / ms)
          : 0,
      };
    }
  }

  if (!studentDeadline) {
    return {
      isLocked: false,
      isAdminUnlocked: false,
      isFirstUnit: false,
      deadline: null as Date | null,
      unlockDate: null as Date | null,
      daysUntilUnlock: 0,
      daysUntilDeadline: 0,
    };
  }

  const deadlineDate = new Date(studentDeadline);
  const unlockDate = new Date(deadlineDate);
  unlockDate.setDate(unlockDate.getDate() - 3);
  const isLocked = now < unlockDate;
  const daysUntilUnlock = isLocked ? Math.max(1, Math.ceil((unlockDate.getTime() - now.getTime()) / ms)) : 0;
  const daysUntilDeadline = Math.ceil((deadlineDate.getTime() - now.getTime()) / ms);
  return {
    isLocked,
    isAdminUnlocked: false,
    isFirstUnit: false,
    deadline: deadlineDate,
    unlockDate,
    daysUntilUnlock,
    daysUntilDeadline,
  };
}

export default function ViewQualificationCourse() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const courseId = parseInt(params.courseId as string);
  const submissionIdFromUrl = searchParams.get('submission');
  
  const [userRole, setUserRole] = useState<'Admin' | 'Assessor' | 'Student' | null>(null);
  const [course, setCourse] = useState<any>(null);
  const [courseFiles, setCourseFiles] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);
  const [selectedUnitData, setSelectedUnitData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingUnit, setLoadingUnit] = useState(false);
  const [pdfSrc, setPdfSrc] = useState<string>('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  // Student submission state
  const [assignmentFile, setAssignmentFile] = useState<File | null>(null);
  const [assignmentFiles, setAssignmentFiles] = useState<File[]>([]); // NEW: Multiple files support
  const [videoLink, setVideoLink] = useState<string>(''); // NEW: Video link support
  const [largeFilesLinks, setLargeFilesLinks] = useState<string>(''); // NEW: Large files links (Google Drive)
  const [presentationFile, setPresentationFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submissions, setSubmissions] = useState<any>(null);
  const [showResubmitAssignment, setShowResubmitAssignment] = useState(false);
  const [showResubmitPresentation, setShowResubmitPresentation] = useState(false);
  const [expandedLectures, setExpandedLectures] = useState<Set<string>>(new Set());
  
  // Quiz modal state
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [quizResult, setQuizResult] = useState<any>(null);
  const [submittingQuiz, setSubmittingQuiz] = useState(false);
  
  // Certificate claim state
  const [hasCertificateClaim, setHasCertificateClaim] = useState(false);
  
  // Rule Level 3 state
  const [selectedUnits, setSelectedUnits] = useState<number[]>([]);
  const [selectingUnits, setSelectingUnits] = useState(false);
  const [showUnitSelectionModal, setShowUnitSelectionModal] = useState(false);
  const [ruleLevel3Units, setRuleLevel3Units] = useState<any[]>([]);
  const [maxSelectableUnits, setMaxSelectableUnits] = useState<number>(0);
  
  // File resubmission state
  const [showResubmitFileModal, setShowResubmitFileModal] = useState(false);
  const [fileToResubmit, setFileToResubmit] = useState<any>(null);
  const [resubmitFile, setResubmitFile] = useState<File | null>(null);
  const [resubmittingFile, setResubmittingFile] = useState(false);
  const [standaloneVideoLinkResubmit, setStandaloneVideoLinkResubmit] = useState('');
  const [standaloneVideoLinkSubmitting, setStandaloneVideoLinkSubmitting] = useState(false);
  // Tree view: which file chains show "Rejected / Previous versions" expanded
  const [expandedFileChains, setExpandedFileChains] = useState<Set<number>>(new Set());
  // Student activity logging: track course view logged once per load, and file open for close log
  const courseViewLoggedRef = useRef<string | null>(null);
  const [fileOpenLog, setFileOpenLog] = useState<{ at: number; fileName: string; unitId: number | null; courseId: number; courseName: string } | null>(null);

  // Sidebar collapse/expand - persisted to localStorage, default closed on mobile
  const [sidebarOpen, setSidebarOpen] = useState(true);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem('qualification-sidebar-open');
    if (saved !== null) {
      setSidebarOpen(saved === 'true');
    } else if (window.innerWidth <= 768) {
      setSidebarOpen(false);
    }
  }, []);
  const toggleSidebar = () => {
    setSidebarOpen(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('qualification-sidebar-open', String(next));
      }
      return next;
    });
  };

  const toggleLecture = (lectureKey: string) => {
    setExpandedLectures(prev => {
      const newSet = new Set(prev);
      if (newSet.has(lectureKey)) {
        newSet.delete(lectureKey);
      } else {
        newSet.add(lectureKey);
      }
      return newSet;
    });
  };

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
      const isSmallScreen = window.innerWidth <= 768;
      setIsMobile(isMobileDevice || isSmallScreen);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Preserve assessor feedback styling (center, bold, etc.) when showing feedback in qualification view
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'qualification-feedback-styles';
    style.textContent = `
      .formatted-feedback-qualification .align-center, .formatted-feedback-qualification .aligncenter,
      .formatted-feedback-qualification p.align-center, .formatted-feedback-qualification p.aligncenter,
      .formatted-feedback-qualification div.align-center, .formatted-feedback-qualification div.aligncenter,
      .formatted-feedback-qualification h1.align-center, .formatted-feedback-qualification h1.aligncenter,
      .formatted-feedback-qualification h2.align-center, .formatted-feedback-qualification h2.aligncenter,
      .formatted-feedback-qualification h3.align-center, .formatted-feedback-qualification h3.aligncenter,
      .formatted-feedback-qualification h4.align-center, .formatted-feedback-qualification h4.aligncenter { text-align: center; }
      .formatted-feedback-qualification .align-right, .formatted-feedback-qualification .alignright,
      .formatted-feedback-qualification p.align-right, .formatted-feedback-qualification p.alignright,
      .formatted-feedback-qualification div.align-right, .formatted-feedback-qualification div.alignright { text-align: right; }
      .formatted-feedback-qualification .align-left, .formatted-feedback-qualification .alignleft,
      .formatted-feedback-qualification p.align-left, .formatted-feedback-qualification p.alignleft,
      .formatted-feedback-qualification div.align-left, .formatted-feedback-qualification div.alignleft { text-align: left; }
      .formatted-feedback-qualification .align-justify, .formatted-feedback-qualification .alignjustify,
      .formatted-feedback-qualification p.align-justify, .formatted-feedback-qualification p.alignjustify,
      .formatted-feedback-qualification div.align-justify, .formatted-feedback-qualification div.alignjustify { text-align: justify; }
    `;
    if (!document.getElementById('qualification-feedback-styles')) {
      document.head.appendChild(style);
    }
    return () => {
      const el = document.getElementById('qualification-feedback-styles');
      if (el) el.remove();
    };
  }, []);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('lms-user') || 'null');
    const role = user?.role || null;
    setUserRole(role as 'Admin' | 'Assessor' | 'Student' | null);
    loadCourseData();
  }, [courseId]);

  // Handle deep linking from notifications - auto-load unit with rejected file (single API call)
  useEffect(() => {
    if (submissionIdFromUrl && units.length > 0 && userRole === 'Student') {
      const findUnitForSubmission = async () => {
        const submissionId = parseInt(submissionIdFromUrl);
        if (!submissionId) return;

        try {
          const res = await apiService.getQualificationUnitForSubmission(submissionId);
          if (res?.success && res.unitId) {
            await loadUnitData(res.unitId);
            setTimeout(() => {
              const unitElement = document.getElementById(`unit-${res.unitId}`);
              if (unitElement) {
                unitElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }, 500);
          }
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Qualification View] Error finding unit for submission:', error);
          }
        }
      };

      findUnitForSubmission();
    }
  }, [submissionIdFromUrl, units, userRole]);

  const loadCourseData = async () => {
    try {
      setLoading(true);
      const response = await apiService.getQualificationCourse(courseId);

        if (response.success) {
        setCourse(response.course);
        setCourseFiles(response.files || []);
        const sortedUnits = (response.units || []).sort((a: any, b: any) => {
          return (a.order_index || 0) - (b.order_index || 0);
        });
        
        // If student, fetch progress for all units to show lock status and log course view (with course name)
        const user = JSON.parse(localStorage.getItem('lms-user') || 'null');
        if (user?.role === 'Student') {
          // Log that student viewed this qualification course (with course name) once per load
          const logKey = `${courseId}`;
          if (courseViewLoggedRef.current !== logKey) {
            courseViewLoggedRef.current = logKey;
            apiService.logStudentActivity({
              action: 'student_course_view',
              course_id: courseId,
              course_name: response.course?.title || (response.course as any)?.name || ''
            }).catch(() => {});
          }
          // Add cache-busting timestamp to ensure fresh data after submission
          const cacheBuster = `&_t=${Date.now()}`;
          const apiUrl = getApiUrl();
          const unitsWithProgress = await Promise.all(
            sortedUnits.map(async (unit: any) => {
              try {
                const progressResponse = await fetch(`${apiUrl}/api/qualification/units/${unit.id}?studentId=${user.id}${cacheBuster}`, {
                  headers: {
                    'Authorization': `Bearer ${localStorage.getItem('lms-token')}`,
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache'
                  }
                });
                const progressData = await progressResponse.json();
                return {
                  ...unit,
                  progress: progressData.progress || { is_unlocked: 0 }, // Default to locked if no progress
                  student_deadline: progressData.student_deadline ?? unit.deadline ?? null,
                  student_deadline_notes: progressData.student_deadline_notes ?? null,
                  assignment_submission_unlocked:
                    progressData.assignment_submission_unlocked === 1 ||
                    progressData.assignment_submission_unlocked === true
                      ? 1
                      : 0,
                };
              } catch (error) {
                return {
                  ...unit,
                  progress: { is_unlocked: 0 } // Default to locked on error
                };
              }
            })
          );
          setUnits(unitsWithProgress);
          
          // Check Rule Level 3 conditions (per-unit based)
          const rl3Units = unitsWithProgress.filter((u: any) => u.rule_level_3_enabled === 1 || u.rule_level_3_enabled === true);
          const requiredUnits = unitsWithProgress.filter((u: any) => !u.rule_level_3_enabled || u.rule_level_3_enabled === 0 || u.rule_level_3_enabled === false);
          
          setRuleLevel3Units(rl3Units);
          setMaxSelectableUnits(response.course?.rule_level_3_selectable_units || 0);
          
          if (rl3Units.length > 0) {
            // Count completed required units (non-Rule Level 3 units)
            const completedRequired = requiredUnits.filter((u: any) => 
              u.progress?.is_completed && u.progress?.assignment_status === 'pass'
            ).length;
            
            // Check if all required units are completed
            const allRequiredCompleted = requiredUnits.length > 0 && completedRequired === requiredUnits.length;
            
            // Check if student has selected units
            try {
              const selectedResponse = await apiService.getStudentSelectedUnits(courseId);
              if (selectedResponse.success) {
                setSelectedUnits(selectedResponse.selected_units || []);
                
                // Show modal if all required units completed but no selection made
                if (allRequiredCompleted && selectedResponse.selected_units.length === 0) {
                  setShowUnitSelectionModal(true);
                }
              }
            } catch (error) {
            }
          }
          
          // Check if student has already claimed a certificate for this course
          try {
            const claimsResponse = await apiService.getMyMyCertificateClaims();
            if (claimsResponse.success) {
              const existingClaim = claimsResponse.claims.find(
                (claim: any) => claim.course_id === courseId && claim.payment_status === 'completed'
              );
              setHasCertificateClaim(!!existingClaim);
            }
            } catch (error) {
            }
        } else {
          setUnits(sortedUnits);
        }
      } else {
        showSweetAlert('Error', 'Failed to load course data', 'error');
      }
    } catch (error) {
      showSweetAlert('Error', 'Error loading course data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadUnitData = async (unitId: number) => {
    try {
      setLoadingUnit(true);
      setSelectedUnitId(unitId);
      
      // Get user info
      const user = JSON.parse(localStorage.getItem('lms-user') || 'null');
      const studentId = user?.role === 'Student' ? user.id : null;
      
      const response = await apiService.getQualificationUnit(unitId, studentId);
      
      if (response.success) {
        setSelectedUnitData(response);

        // If student, log unit view (with course and unit name) and fetch submissions
        if (studentId) {
          const unitTitle = (response as any).unit?.title ?? (response as any).title ?? (response as any).unit?.name ?? '';
          apiService.logStudentActivity({
            action: 'student_unit_view',
            course_id: courseId,
            course_name: course?.title ?? '',
            unit_id: unitId,
            unit_name: unitTitle
          }).catch(() => {});
          loadSubmissions(unitId, studentId);
        }
      } else {
        showSweetAlert('Error', 'Failed to load unit data', 'error');
      }
    } catch (error) {
      showSweetAlert('Error', 'Error loading unit data', 'error');
    } finally {
      setLoadingUnit(false);
    }
  };
  
  const loadSubmissions = async (unitId: number, studentId: number) => {
    try {
      const token = localStorage.getItem('lms-token');
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/qualification/units/${unitId}/submissions?studentId=${studentId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        return;
      }

      const data = await response.json();

      if (data.success) {
        setSubmissions(data.submissions);
        // Reset resubmit forms when submissions are reloaded
        setShowResubmitAssignment(false);
        setShowResubmitPresentation(false);
      }
    } catch (error) {
    }
  };

  const getFileIcon = (fileName: string) => {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.pdf')) return '📄';
    if (lower.endsWith('.doc') || lower.endsWith('.docx')) return '📝';
    if (lower.endsWith('.ppt') || lower.endsWith('.pptx')) return '📊';
    if (lower.endsWith('.xls') || lower.endsWith('.xlsx')) return '📈';
    if (lower.endsWith('.zip') || lower.endsWith('.rar')) return '📦';
    if (lower.endsWith('.mp4') || lower.endsWith('.avi') || lower.endsWith('.mov')) return '🎥';
    if (lower.endsWith('.mp3') || lower.endsWith('.wav')) return '🎵';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.gif')) return '🖼️';
    return '📎';
  };

  const handleFileClick = (filePath: string, fileName: string) => {
    // Ensure we have a valid filename - if fileName is empty or looks like a Cloudinary ID, try to extract from URL
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

    const fileExtension = finalFileName.toLowerCase().split('.').pop() || '';
    const apiUrl = getApiUrl();
    
    // Ensure filePath uses HTTPS (fix Mixed Content error)
    const secureFilePath = filePath && filePath.startsWith('http://')
      ? filePath.replace('http://', 'https://')
      : filePath;
    
    // For PDFs, open in viewer modal using proxy (as per documentation)
    if (fileExtension === 'pdf') {
      // Mobile browsers don't support PDFs in iframes - open in new window (log file open only; close not trackable)
      if (isMobile) {
        const user = JSON.parse(localStorage.getItem('lms-user') || 'null');
        if (user?.role === 'Student') {
          apiService.logStudentActivity({
            action: 'student_file_view',
            file_name: finalFileName,
            opened_at: new Date().toISOString(),
            course_id: courseId,
            course_name: course?.title ?? '',
            unit_id: selectedUnitId ?? undefined
          }).catch(() => {});
        }
        const proxyUrl = `${apiUrl}/api/admin/proxy-pdf?url=${encodeURIComponent(secureFilePath)}`;
        window.open(proxyUrl, '_blank', 'noopener,noreferrer');
        return;
      }
      
      // Desktop: use iframe modal (as per documentation)
      setPdfLoading(true);
      setPdfError(false);
      // Track file open for student activity log (course name, unit, file name, read time)
      const user = JSON.parse(localStorage.getItem('lms-user') || 'null');
      if (user?.role === 'Student') {
        setFileOpenLog({
          at: Date.now(),
          fileName: finalFileName,
          unitId: selectedUnitId,
          courseId,
          courseName: course?.title ?? ''
        });
      }
      // Use proxy to force inline display instead of download
      const proxyUrl = `${apiUrl}/api/admin/proxy-pdf?url=${encodeURIComponent(secureFilePath)}`;
      setPdfSrc(proxyUrl);
    } else {
      // For other files (doc, docx, ppt, etc.), use download endpoint to preserve original filename
      const user = JSON.parse(localStorage.getItem('lms-user') || 'null');
      if (user?.role === 'Student') {
        apiService.logStudentActivity({
          action: 'student_file_view',
          file_name: finalFileName,
          opened_at: new Date().toISOString(),
          course_id: courseId,
          course_name: course?.title ?? '',
          unit_id: selectedUnitId ?? undefined
        }).catch(() => {});
      }
      const downloadUrl = `${apiUrl}/api/qualification/download-file?url=${encodeURIComponent(secureFilePath)}&filename=${encodeURIComponent(finalFileName)}`;
      window.open(downloadUrl, '_blank');
    }
  };

  const closePdfViewer = () => {
    // If student had opened a file, log file view with read duration
    if (fileOpenLog) {
      const durationSec = Math.round((Date.now() - fileOpenLog.at) / 1000);
      apiService.logStudentActivity({
        action: 'student_file_view',
        file_name: fileOpenLog.fileName,
        opened_at: new Date(fileOpenLog.at).toISOString(),
        closed_at: new Date().toISOString(),
        duration_seconds: durationSec,
        course_id: fileOpenLog.courseId,
        course_name: fileOpenLog.courseName,
        unit_id: fileOpenLog.unitId ?? undefined
      }).catch(() => {});
      setFileOpenLog(null);
    }
    setPdfSrc('');
    setPdfLoading(false);
    setPdfError(false);
  };
  
  const handleSubmitAssignment = async (isResubmission: boolean = false) => {
    // Check if we have at least one file OR links
    if ((assignmentFiles.length === 0 && !videoLink && !largeFilesLinks.trim()) || !selectedUnitId) {
      showSweetAlert('Error', 'Please select at least one file or provide a link to your files', 'error');
      return;
    }
    
    try {
      setSubmitting(true);
      const formData = new FormData();
      
      // Append multiple files
      assignmentFiles.forEach((file, index) => {
        formData.append(`files`, file); // Use 'files' as array name
      });
      
      // Combine video link and large files links
      let allLinks = '';
      if (videoLink.trim()) {
        allLinks += `Video: ${videoLink.trim()}\n`;
      }
      if (largeFilesLinks.trim()) {
        allLinks += `Large Files:\n${largeFilesLinks.trim()}`;
      }
      
      if (allLinks) {
        formData.append('video_link', allLinks.trim());
      }
      
      formData.append('submission_type', 'assignment');
      if (isResubmission) {
        formData.append('is_resubmission', 'true');
      }
      
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/qualification/units/${selectedUnitId}/submit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('lms-token')}`
        },
        body: formData
      });
      
      const data = await response.json();

      if (response.status === 403 && data.code === 'SUBMISSION_LOCKED') {
        const opens = data.unlockDate
          ? new Date(data.unlockDate).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })
          : '';
        showSweetAlert(
          'Submission not open yet',
          `${data.error || data.message || 'Assignment submission is not yet open.'}${typeof data.daysUntilUnlock === 'number' ? ` You can submit in ${data.daysUntilUnlock} day(s).` : ''}${opens ? ` Opens: ${opens}.` : ''}`,
          'info'
        );
        return;
      }
      
      if (data.success) {
        showSweetAlert(
          'Success!',
          isResubmission 
            ? 'Assignment resubmitted successfully! It will be graded again.' 
            : 'Assignment submitted successfully! Next unit may have been unlocked.',
          'success'
        );
        setAssignmentFile(null);
        setAssignmentFiles([]);
        setVideoLink('');
        setLargeFilesLinks('');
        setShowResubmitAssignment(false);
        // Reload submissions and course data to refresh unit lock statuses
        const user = JSON.parse(localStorage.getItem('lms-user') || 'null');
        if (user?.id) {
          loadSubmissions(selectedUnitId, user.id);
          // Reload course data to refresh unit list with updated lock statuses
          loadCourseData();
        }
      } else {
        // Show detailed error message with file name if available
        const errorMsg = data.suggestion 
          ? `${data.message}\n\n${data.suggestion}`
          : data.message || 'Failed to submit assignment';
        
        showSweetAlert('Error', errorMsg, 'error');
      }
    } catch (error) {
      showSweetAlert('Error', 'Error submitting assignment. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleSubmitPresentation = async (isResubmission: boolean = false) => {
    if (!presentationFile || !selectedUnitId) return;
    
    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append('file', presentationFile);
      formData.append('submission_type', 'presentation');
      if (isResubmission) {
        formData.append('is_resubmission', 'true');
      }
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/qualification/units/${selectedUnitId}/submit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('lms-token')}`
        },
        body: formData
      });
      
      const data = await response.json();
      
      if (data.success) {
        showSweetAlert(
          'Success!',
          isResubmission 
            ? 'Presentation resubmitted successfully! It will be graded again.' 
            : 'Presentation submitted successfully!',
          'success'
        );
        setPresentationFile(null);
        setShowResubmitPresentation(false);
        // Reload submissions and course data to refresh unit lock statuses
        const user = JSON.parse(localStorage.getItem('lms-user') || 'null');
        if (user?.id) {
          loadSubmissions(selectedUnitId, user.id);
          // Reload course data to refresh unit list with updated lock statuses
          loadCourseData();
        }
      } else {
        showSweetAlert('Error', data.message || 'Failed to submit presentation', 'error');
      }
    } catch (error) {
      showSweetAlert('Error', 'Error submitting presentation. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Handler for individual file resubmission
  const handleStandaloneVideoLinkResubmit = async () => {
    const sid = submissions?.assignment?.id;
    if (!sid) {
      showSweetAlert('Error', 'No assignment submission found', 'error');
      return;
    }
    const text = standaloneVideoLinkResubmit.trim();
    if (!text) {
      showSweetAlert('Error', 'Please paste a new link', 'error');
      return;
    }
    if (!/https?:\/\/[^\s]+/.test(text)) {
      showSweetAlert('Error', 'Your text must include a valid http(s) URL', 'error');
      return;
    }
    try {
      setStandaloneVideoLinkSubmitting(true);
      await apiService.resubmitVideoLink(sid, text);
      showSweetAlert('Success!', 'Your video / external link was updated. Your assessor will review it.', 'success');
      setStandaloneVideoLinkResubmit('');
      const user = JSON.parse(localStorage.getItem('lms-user') || 'null');
      if (user?.id && selectedUnitId) {
        loadSubmissions(selectedUnitId, user.id);
      }
    } catch (err: any) {
      const msg = err?.message || 'Failed to resubmit link';
      showSweetAlert('Error', msg, 'error');
    } finally {
      setStandaloneVideoLinkSubmitting(false);
    }
  };

  const handleResubmitFile = async () => {
    if (!resubmitFile || !fileToResubmit) {
      showSweetAlert('Error', 'Please select a file to resubmit', 'error');
      return;
    }

    try {
      setResubmittingFile(true);
      const formData = new FormData();
      formData.append('file', resubmitFile);
      formData.append('original_file_id', fileToResubmit.id.toString());

      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/qualification/files/${fileToResubmit.id}/resubmit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('lms-token')}`
        },
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        showSweetAlert(
          'Success!',
          'File resubmitted successfully! Your assessor will review it.',
          'success'
        );
        setResubmitFile(null);
        setFileToResubmit(null);
        setShowResubmitFileModal(false);

        // Reload submissions to show updated file
        const user = JSON.parse(localStorage.getItem('lms-user') || 'null');
        if (user?.id && selectedUnitId) {
          loadSubmissions(selectedUnitId, user.id);
        }
      } else {
        const errorMsg = data.suggestion 
          ? `${data.message}\n\n${data.suggestion}`
          : data.message || 'Failed to resubmit file';
        
        showSweetAlert('Error', errorMsg, 'error');
      }
    } catch (error) {
      showSweetAlert('Error', 'Error resubmitting file. Please try again.', 'error');
    } finally {
      setResubmittingFile(false);
    }
  };

  const assignmentSubmissionLockState =
    userRole === 'Student'
      ? getQualAssignmentSubmissionLockState({
          studentDeadline:
            selectedUnitData?.student_deadline ?? selectedUnitData?.unit?.deadline ?? null,
          assignmentSubmissionUnlocked: selectedUnitData?.assignment_submission_unlocked,
          orderIndex: selectedUnitData?.unit?.order_index,
          allUnits: units,
        })
      : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
        <div className="max-w-7xl mx-auto">
          <QualificationViewSkeleton />
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['Admin', 'Assessor', 'Student', 'Operation Manager', 'Team Member']} userRole={userRole}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        {/* Animated Background Elements */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-r from-[#11CCEF] to-[#0daed9] rounded-full blur-3xl opacity-10 animate-float"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-r from-[#E51791] to-[#c3147f] rounded-full blur-3xl opacity-10 animate-float-delayed"></div>
        </div>

        <div className="relative flex flex-row min-h-screen z-10">
          
          {/* Left Sidebar - Units Navigation */}
          <div className={`relative flex flex-col self-stretch bg-white border-r border-gray-100 transition-all duration-300 ease-in-out flex-shrink-0 ${sidebarOpen ? 'w-72 lg:w-80' : 'w-14'} border-b lg:border-b-0 lg:border-r border-gray-200`}>
            {/* Toggle button */}
            <button
              onClick={toggleSidebar}
              className="absolute -right-3 top-6 z-10 w-8 h-8 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center hover:bg-gray-50 transition-colors"
              aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {sidebarOpen ? (
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </button>

            {sidebarOpen && (
              <div className="p-5 bg-gradient-to-r from-[#11CCEF] to-[#0daed9] flex-shrink-0">
                <button
                  onClick={() => router.back()}
                  className="flex items-center gap-2 text-white/80 hover:text-white transition-colors text-sm font-medium mb-3 group"
                >
                  <svg className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back
                </button>
                <h2 className="text-lg font-bold text-white break-words leading-tight">{course?.title}</h2>
                <p className="text-sm text-white/80 mt-1">{units.length} {units.length === 1 ? 'Unit' : 'Units'}</p>
              </div>
            )}

            {/* Course Introduction Button - only when expanded */}
            {sidebarOpen && (
              <div className="p-3 flex-shrink-0 border-b border-gray-100">
                <button
                  onClick={() => {
                    setSelectedUnitId(null);
                    setSelectedUnitData(null);
                  }}
                  className={`w-full text-left p-3 rounded-lg transition-all duration-200 ${
                    selectedUnitId === null
                      ? 'bg-gradient-to-r from-[#11CCEF] to-[#0daed9] text-white shadow-md'
                      : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 hover:border-[#11CCEF]/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      selectedUnitId === null ? 'bg-white/20' : 'bg-[#11CCEF]/10'
                    }`}>
                      <svg className={`w-5 h-5 ${selectedUnitId === null ? 'text-white' : 'text-[#11CCEF]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-semibold text-sm">Course Introduction</div>
                      <div className={`text-xs ${selectedUnitId === null ? 'text-white/70' : 'text-gray-500'}`}>Welcome & Overview</div>
                    </div>
                  </div>
                </button>
              </div>
            )}

            {/* Section label - only when expanded */}
            {sidebarOpen && (
              <div className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-widest flex-shrink-0">
                Course Units
              </div>
            )}

            {/* Units List - scrollable */}
            <div className={`flex-1 overflow-y-auto min-h-0 pb-4 scrollbar-hide ${sidebarOpen ? 'px-3' : 'px-2 pt-12'}`} style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              <div className="space-y-2">
                {units.map((unit, index) => {
                  const isLocked = userRole === 'Student' && (unit.progress?.is_unlocked === 0 || unit.progress?.is_unlocked === false || !unit.progress);
                  const isSelected = selectedUnitId === unit.id;
                  const unitNumber = index + 1;
                  const unitCode = unit.unit_code || unit.reference;
                  const unitSubLock =
                    userRole === 'Student' &&
                    (unit.enable_assignment_submission === 1 || unit.enable_assignment_submission === true)
                      ? getQualAssignmentSubmissionLockState({
                          studentDeadline: unit.student_deadline ?? unit.deadline ?? null,
                          assignmentSubmissionUnlocked: unit.assignment_submission_unlocked,
                          orderIndex: unit.order_index,
                          allUnits: units,
                        })
                      : null;

                  return (
                    <button
                      key={unit.id}
                      onClick={() => !isLocked && loadUnitData(unit.id)}
                      disabled={isLocked}
                      title={!sidebarOpen ? unit.title : undefined}
                      className={`w-full text-left flex items-start gap-3 p-3 rounded-lg transition-all duration-200 ${
                        isSelected
                          ? 'bg-gradient-to-r from-[#11CCEF] to-[#0daed9] text-white shadow-md'
                          : isLocked
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 hover:border-[#11CCEF]/50 hover:shadow-sm'
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : isLocked
                          ? 'bg-gray-200 text-gray-400'
                          : 'bg-[#11CCEF]/10 text-[#11CCEF]'
                      }`}>
                        {isLocked ? (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        ) : (
                          unitNumber
                        )}
                      </div>
                      {sidebarOpen && (
                        <div className="min-w-0 flex-1">
                          {unitCode && (
                            <p className={`text-xs font-semibold mb-0.5 tracking-wide ${isSelected ? 'text-white/80' : isLocked ? 'text-gray-400' : 'text-slate-400'}`}>
                              {unitCode}
                            </p>
                          )}
                          <p className={`text-sm font-semibold leading-snug break-words ${isSelected ? 'text-white' : isLocked ? 'text-gray-400' : 'text-slate-700'}`}>
                            {unit.title}
                          </p>
                          {!!unit.is_optional && (
                            <span className={`inline-block mt-1 text-xs font-bold px-2 py-0.5 rounded border ${isSelected ? 'bg-white/20 text-white border-white/30' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                              Optional
                            </span>
                          )}
                          {unitSubLock &&
                            (unitSubLock.deadline != null ||
                              unitSubLock.isLocked ||
                              unitSubLock.isAdminUnlocked) && (
                            <div
                              className="mt-1 text-[10px] font-semibold"
                              style={{
                                color: unitSubLock.isAdminUnlocked
                                  ? '#16a34a'
                                  : unitSubLock.isLocked
                                    ? '#dc2626'
                                    : '#16a34a',
                              }}
                            >
                              {unitSubLock.isAdminUnlocked
                                ? '🔓 Admin unlocked'
                                : unitSubLock.isLocked
                                  ? `🔒 Opens in ${unitSubLock.daysUntilUnlock}d`
                                  : unitSubLock.deadline
                                    ? `📅 Due in ${unitSubLock.daysUntilDeadline}d`
                                    : ''}
                            </div>
                          )}
                        </div>
                      )}
                      {sidebarOpen && !isLocked && !isSelected && (
                        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Content Area */}
          <div className="flex-1 min-w-0 overflow-y-auto p-6 lg:p-8">
            {/* Course Introduction View */}
            {selectedUnitId === null && (
              <div className="space-y-6">
                {/* Course Header */}
                <div className={STYLES.card}>
                  <div className="p-6 md:p-8">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 bg-gradient-to-r from-[#11CCEF] to-[#0daed9] rounded-xl flex items-center justify-center text-white text-xl">
                        🎓
                      </div>
                      <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 break-words">{course?.title}</h1>
                        <p className="text-gray-600 mt-1 break-words">{course?.description}</p>
                      </div>
                    </div>
                    
                    {/* Course Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                      <div className="text-center p-4 bg-white/50 rounded-xl border border-white/20">
                        <div className="text-2xl font-bold text-[#11CCEF]">{units.length}</div>
                        <div className="text-sm text-gray-600">Units</div>
                      </div>
                      <div className="text-center p-4 bg-white/50 rounded-xl border border-white/20">
                        <div className="text-2xl font-bold text-[#E51791]">{courseFiles.length}</div>
                        <div className="text-sm text-gray-600">Resources</div>
                      </div>
                      <div className="text-center p-4 bg-white/50 rounded-xl border border-white/20">
                        <div className="text-2xl font-bold text-purple-500">{units.filter(u => u.is_optional).length}</div>
                        <div className="text-sm text-gray-600">Optional</div>
                      </div>
                      <div className="text-center p-4 bg-white/50 rounded-xl border border-white/20">
                        <div className="text-2xl font-bold text-green-500">{units.filter(u => !u.is_optional).length}</div>
                        <div className="text-sm text-gray-600">Required</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rule Level 3 Unit Selection Modal */}
                {showUnitSelectionModal && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                      <div className="p-6">
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <span>🎯</span>
                            Rule Level 3: Choose Your Units
                          </h3>
                          <button
                            onClick={() => setShowUnitSelectionModal(false)}
                            className="text-gray-400 hover:text-gray-600 text-2xl"
                          >
                            ×
                          </button>
                        </div>
                        
                        <p className="text-gray-700 mb-6">
                          Congratulations! You&apos;ve completed all required units.
                          {maxSelectableUnits > 0
                            ? ` Now choose exactly ${maxSelectableUnits} unit${maxSelectableUnits !== 1 ? 's' : ''} you want to complete from the options below.`
                            : ' Now choose which units you want to complete from the options below.'}
                        </p>
                        
                        <div className="space-y-3 mb-6">
                          {ruleLevel3Units.map((unit: any) => {
                            // Find the unit's position in the full units array for proper numbering
                            const unitIndex = units.findIndex((u: any) => u.id === unit.id);
                            const unitNumber = unitIndex >= 0 ? unitIndex + 1 : 0;
                            
                            return (
                            <label
                              key={unit.id}
                              className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-all ${
                                selectedUnits.includes(unit.id)
                                  ? 'bg-yellow-100 border-yellow-400 cursor-pointer'
                                  : (!selectedUnits.includes(unit.id) && maxSelectableUnits > 0 && selectedUnits.length >= maxSelectableUnits)
                                    ? 'bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed'
                                    : 'bg-white border-gray-200 hover:border-yellow-300 cursor-pointer'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={selectedUnits.includes(unit.id)}
                                disabled={!selectedUnits.includes(unit.id) && maxSelectableUnits > 0 && selectedUnits.length >= maxSelectableUnits}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    if (maxSelectableUnits > 0 && selectedUnits.length >= maxSelectableUnits) return;
                                    setSelectedUnits([...selectedUnits, unit.id]);
                                  } else {
                                    setSelectedUnits(selectedUnits.filter(id => id !== unit.id));
                                  }
                                }}
                                className="w-5 h-5 text-yellow-600 rounded focus:ring-2 focus:ring-yellow-500 mt-1 disabled:opacity-40 disabled:cursor-not-allowed"
                              />
                              <div className="flex-1">
                                <div className="font-semibold text-gray-900 text-lg">
                                  {unit.title}
                                </div>
                                {unit.content && (
                                  <div className="text-sm text-gray-600 mt-2">{unit.content}</div>
                                )}
                              </div>
                            </label>
                            );
                          })}
                        </div>
                        
                        <div className="flex gap-3">
                          <button
                            onClick={() => setShowUnitSelectionModal(false)}
                            className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-all"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={async () => {
                              if (selectedUnits.length === 0) {
                                showSweetAlert('Selection Required', 'Please select at least one unit to continue', 'warning');
                                return;
                              }
                              if (maxSelectableUnits > 0 && selectedUnits.length !== maxSelectableUnits) {
                                showSweetAlert('Selection Required', `Please select exactly ${maxSelectableUnits} unit${maxSelectableUnits !== 1 ? 's' : ''} to continue`, 'warning');
                                return;
                              }
                              
                              try {
                                setSelectingUnits(true);
                                const response = await apiService.selectUnitsForRuleLevel3(courseId, selectedUnits);
                                
                                if (response.success) {
                                  showSweetAlert('Success!', 'Units selected successfully. You can now access these units.', 'success');
                                  setShowUnitSelectionModal(false);
                                  loadCourseData(); // Reload to refresh unit access
                                } else {
                                  showSweetAlert('Error', response.message || 'Failed to select units', 'error');
                                }
                              } catch (error: any) {
                                showSweetAlert('Error', error?.message || 'Error selecting units', 'error');
                              } finally {
                                setSelectingUnits(false);
                              }
                            }}
                            disabled={selectingUnits || selectedUnits.length === 0 || (maxSelectableUnits > 0 && selectedUnits.length !== maxSelectableUnits)}
                            className={`flex-1 px-6 py-3 bg-yellow-600 text-white rounded-lg font-semibold transition-all ${
                              selectingUnits || selectedUnits.length === 0 || (maxSelectableUnits > 0 && selectedUnits.length !== maxSelectableUnits)
                                ? 'opacity-50 cursor-not-allowed'
                                : 'hover:bg-yellow-700 transform hover:scale-105'
                            }`}
                          >
                            {selectingUnits ? 'Saving...' : maxSelectableUnits > 0
                              ? `Confirm Selection (${selectedUnits.length}/${maxSelectableUnits})`
                              : `Confirm Selection (${selectedUnits.length} unit${selectedUnits.length !== 1 ? 's' : ''})`}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Claim Certificate - Show for students who completed all required units */}
                {(() => {
                  if (userRole !== 'Student') {
                    return null;
                  }
                  
                  // Check Rule Level 3: required units + selected units completed
                  const ruleLevel3Units = units.filter((u: any) => u.rule_level_3_enabled === 1 || u.rule_level_3_enabled === true);
                  const requiredUnits = units.filter((u: any) => !u.rule_level_3_enabled || u.rule_level_3_enabled === 0 || u.rule_level_3_enabled === false);
                  
                  if (ruleLevel3Units.length > 0 && selectedUnits.length > 0) {
                    // Rule Level 3 course: check required + selected units
                    const allRequiredCompleted = requiredUnits.length > 0 && requiredUnits.every((u: any) => 
                      u.progress?.is_completed && u.progress?.assignment_status === 'pass'
                    );
                    
                    const allSelectedCompleted = selectedUnits.every(unitId => {
                      const unit = units.find((u: any) => u.id === unitId);
                      return unit?.progress?.is_completed && unit?.progress?.assignment_status === 'pass';
                    });
                    
                    if (!allRequiredCompleted || !allSelectedCompleted) {
                      return null;
                    }
                  } else {
                    // Regular course: all required units completed
                    const allRequiredCompleted = requiredUnits.length > 0 && requiredUnits.every((u: any) => 
                      u.progress?.is_completed && u.progress?.assignment_status === 'pass'
                    );
                    
                    if (!allRequiredCompleted) {
                      return null;
                    }
                  }
                  
                  // Show different message based on claim status
                  if (hasCertificateClaim) {
                    // Already claimed - show success message
                    return (
                      <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-300 rounded-2xl p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                              ✅ Certificate Claimed!
                            </h3>
                            <p className="text-gray-600 mt-1">Congratulations! You have successfully claimed your certificate.</p>
                          </div>
                          <button
                            onClick={() => router.push('/dashboard/student/certificates')}
                            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:shadow-lg font-semibold transition-all transform hover:scale-105"
                          >
                            View Certificate
                          </button>
                        </div>
                      </div>
                    );
                  } else {
                    // Not claimed yet - show claim button
                    return (
                      <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-300 rounded-2xl p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                              🎓 Congratulations!
                            </h3>
                            <p className="text-gray-600 mt-1">You've completed all required units. Claim your certificate now!</p>
                          </div>
                          <button
                            onClick={() => router.push(`/dashboard/student/qualification/${courseId}/claim-certificate`)}
                            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold transition-all transform hover:scale-105"
                          >
                            Claim Certificate
                          </button>
                        </div>
                      </div>
                    );
                  }
                })()}

                {/* Course Introduction - Welcome, Disclaimer, General Information */}
                {(course?.welcome_message || course?.disclaimer || course?.general_information || courseFiles.filter(f => f.file_type === 'welcome').length > 0) && (
                  <div className={STYLES.card}>
                    <div className="p-6 md:p-8">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-gradient-to-r from-[#11CCEF] to-[#0daed9] rounded-xl flex items-center justify-center text-white text-lg">
                          👋
                        </div>
                        <h2 className="text-xl font-bold text-gray-900">Course Introduction</h2>
                      </div>
                      
                      {/* Welcome Message */}
                      {course?.welcome_message && (
                        <div className="mb-6">
                          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <span>👋</span>
                            Welcome Message
                          </h3>
                          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-[#11CCEF] p-6 rounded-lg">
                            <div className="text-gray-800 whitespace-pre-wrap leading-relaxed">{course.welcome_message}</div>
                          </div>
                        </div>
                      )}
                      
                      {/* Disclaimer */}
                      {course?.disclaimer && (
                        <div className="mb-6">
                          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <span>⚠️</span>
                            Disclaimer
                          </h3>
                          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded-lg">
                            <div className="text-gray-800 whitespace-pre-wrap leading-relaxed">{course.disclaimer}</div>
                          </div>
                        </div>
                      )}
                      
                      {/* General Information */}
                      {course?.general_information && (
                        <div className="mb-6">
                          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <span>📋</span>
                            General Information
                          </h3>
                          <div className="bg-blue-50 border-l-4 border-blue-400 p-6 rounded-lg">
                            <div className="text-gray-800 whitespace-pre-wrap leading-relaxed">{course.general_information}</div>
                          </div>
                        </div>
                      )}
                      
                      {/* Welcome Materials Files */}
                      {courseFiles.filter(f => f.file_type === 'welcome').length > 0 && (
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <span>📎</span>
                            Welcome Materials
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {courseFiles.filter(f => f.file_type === 'welcome').map((file, idx) => (
                              <div
                                key={idx}
                                onClick={() => handleFileClick(file.file_path, file.file_name)}
                                className="flex items-center gap-3 bg-white p-4 rounded-xl border border-gray-200 hover:border-[#11CCEF] hover:shadow-md transition-all cursor-pointer group"
                              >
                                <span className="text-2xl">{getFileIcon(file.file_name)}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-gray-900 text-sm group-hover:text-[#11CCEF] transition-colors truncate">
                                    {file.file_name}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {file.file_name.toLowerCase().endsWith('.pdf') ? 'View PDF' : 'Download File'}
                                  </div>
                                </div>
                                <svg className="w-4 h-4 text-gray-400 group-hover:text-[#11CCEF] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Course Materials */}
                {courseFiles.filter(f => !['welcome'].includes(f.file_type)).length > 0 && (
                  <div className={STYLES.card}>
                    <div className="p-6 md:p-8">
                      <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-[#E51791] to-[#c3147f] rounded-xl flex items-center justify-center text-white text-lg">
                          📚
                        </div>
                        Course Materials
                      </h2>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {courseFiles
                          .filter(f => !['welcome'].includes(f.file_type))
                          .map((file, idx) => (
                            <div
                              key={idx}
                              onClick={() => handleFileClick(file.file_path, file.file_name)}
                              className="bg-white p-4 rounded-xl border border-gray-200 hover:border-[#11CCEF] hover:shadow-md transition-all cursor-pointer group"
                            >
                              <div className="flex items-center gap-3 mb-3">
                                <span className="text-2xl">{getFileIcon(file.file_name)}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-gray-900 text-sm group-hover:text-[#11CCEF] transition-colors truncate">
                                    {file.file_name}
                                  </div>
                                  <div className="text-xs text-gray-500 capitalize">
                                    {file.file_type?.replace('_', ' ') || 'Document'}
                                  </div>
                                </div>
                              </div>
                              <div className="text-xs text-[#11CCEF] font-medium">
                                {file.file_name.toLowerCase().endsWith('.pdf') ? 'View Document' : 'Download File'}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Unit Content View */}
            {selectedUnitId !== null && (
              <div>
                {loadingUnit ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#11CCEF] mx-auto mb-4"></div>
                      <div className="text-gray-600">Loading unit content...</div>
                    </div>
                  </div>
                ) : selectedUnitData ? (
                  // Check if unit is locked for students
                  userRole === 'Student' && selectedUnitData.progress?.is_unlocked === 0 ? (
                    <div className={STYLES.card}>
                      <div className="p-8 text-center">
                        <div className="w-16 h-16 bg-gradient-to-r from-gray-400 to-gray-600 rounded-2xl flex items-center justify-center text-white text-2xl mx-auto mb-4">
                          🔒
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">This Unit is Locked</h2>
                        <p className="text-gray-600 mb-6 max-w-md mx-auto">
                          You need to complete the previous unit's requirements to unlock this unit.
                        </p>
                        {selectedUnitData.unit?.unlock_condition && (
                          <div className="inline-block bg-purple-50 px-6 py-3 rounded-lg border border-purple-200">
                            <p className="text-sm font-semibold text-purple-900">
                              Unlock Requirement: {selectedUnitData.unit.unlock_condition === 'both' ? 'Complete Assignment & Quiz' : selectedUnitData.unit.unlock_condition ? `Complete ${selectedUnitData.unit.unlock_condition.charAt(0).toUpperCase() + selectedUnitData.unit.unlock_condition.slice(1)}` : 'Default'}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                  <div className="space-y-6">
                    {/* Unit Header */}
                    <div className={STYLES.card}>
                      <div className="p-6 md:p-8">
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 mb-6">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-4">
                              <div className="w-10 h-10 bg-gradient-to-r from-[#11CCEF] to-[#0daed9] rounded-xl flex items-center justify-center text-white font-bold">
                                {units.findIndex((u: any) => u.id === selectedUnitId) + 1 || 1}
                              </div>
                              <div>
                                <h1 className="text-2xl font-bold text-gray-900 break-words">
                                  {selectedUnitData.unit?.title}
                                </h1>
                                <p className="text-gray-600 mt-1 break-words">{selectedUnitData.unit?.content}</p>
                              </div>
                            </div>
                            
                            {/* Unit Badges */}
                            <div className="flex flex-wrap gap-2">
                              {!!selectedUnitData.unit?.is_optional && (
                                <span className={STYLES.badge.warning + " px-3 py-1 rounded-full text-xs font-semibold"}>
                                  Optional Unit
                                </span>
                              )}
                              {selectedUnitData.unit?.unlock_condition && (
                                <span className={STYLES.badge.purple + " px-3 py-1 rounded-full text-xs font-semibold"}>
                                  Unlock: {selectedUnitData.unit.unlock_condition}
                                </span>
                              )}
                              {selectedUnitData.progress?.is_unlocked === 1 ? (
                                <span className={STYLES.badge.success + " px-3 py-1 rounded-full text-xs font-semibold"}>
                                  🔓 Unlocked
                                </span>
                              ) : null}
                            </div>
                          </div>
                          
                          {/* Deadline & Status */}
                          <div className="flex flex-col gap-3">
                            {selectedUnitData.unit?.deadline && (
                              <div className="bg-gradient-to-r from-[#11CCEF] to-[#0daed9] text-white px-4 py-3 rounded-xl text-center shadow-lg">
                                <div className="text-sm font-semibold">⏰ Due Date</div>
                                <div className="text-lg font-bold">
                                  {new Date(selectedUnitData.unit.deadline).toLocaleDateString()}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Unit Information */}
                        {(selectedUnitData.unit?.disclaimer || selectedUnitData.unit?.general_information) && (
                          <div className="border-t border-white/20 pt-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Unit Information</h3>
                            <div className="space-y-4">
                              {selectedUnitData.unit.disclaimer && (
                                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
                                  <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                    <span>⚠️</span>
                                    Disclaimer
                                  </h4>
                                  <p className="text-gray-700 text-sm">{selectedUnitData.unit.disclaimer}</p>
                                </div>
                              )}
                              {selectedUnitData.unit.general_information && (
                                <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-lg">
                                  <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                    <span>📋</span>
                                    General Information
                                  </h4>
                                  <p className="text-gray-700 text-sm">{selectedUnitData.unit.general_information}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Lectures */}
                    {selectedUnitData.announcements && selectedUnitData.announcements.length > 0 && (
                      <div className={STYLES.card}>
                        <div className="p-6 md:p-8">
                          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-r from-[#11CCEF] to-[#0daed9] rounded-xl flex items-center justify-center text-white text-lg">
                              🎓
                            </div>
                            Lectures ({selectedUnitData.announcements.length})
                          </h2>
                          
                          <div className="space-y-4">
                            {(() => {
                              const stripLecturePrefix = (title: string) =>
                                (title || '').replace(/^Lecture\s*\d+\s*[\s:\-]*/i, '').trim();

                              type LectureGroup = {
                                number: number;
                                stableKey: string;
                                headline: string;
                                files: any[];
                              };

                              const lectureGroups = new Map<string, LectureGroup>();

                              selectedUnitData.announcements.forEach((announcement: any) => {
                                const rawTitle = announcement.title || '';
                                const match = rawTitle.match(/^Lecture\s*(\d+)/i);

                                if (match) {
                                  const lectureNum = parseInt(match[1], 10);
                                  const lectureKey = `Lecture ${lectureNum}`;
                                  const subtitle =
                                    stripLecturePrefix(rawTitle) ||
                                    (announcement.content || '').trim() ||
                                    'Untitled Lecture';

                                  if (!lectureGroups.has(lectureKey)) {
                                    lectureGroups.set(lectureKey, {
                                      number: lectureNum,
                                      stableKey: lectureKey,
                                      headline: lectureKey,
                                      files: []
                                    });
                                  }

                                  lectureGroups.get(lectureKey)!.files.push({
                                    ...announcement,
                                    lectureTitle: subtitle
                                  });
                                } else {
                                  const otherKey = 'Other Materials';
                                  if (!lectureGroups.has(otherKey)) {
                                    lectureGroups.set(otherKey, {
                                      number: 999,
                                      stableKey: otherKey,
                                      headline: otherKey,
                                      files: []
                                    });
                                  }
                                  lectureGroups.get(otherKey)!.files.push({
                                    ...announcement,
                                    lectureTitle:
                                      rawTitle || announcement.content || 'Untitled Lecture'
                                  });
                                }
                              });

                              const sortedLectures = Array.from(lectureGroups.values()).sort(
                                (a, b) => a.number - b.number
                              );

                              return sortedLectures.map(lecture => {
                                const { stableKey, headline, files } = lecture;
                                const firstFile = files[0];
                                const lectureTitle = firstFile?.lectureTitle || '';
                                const isExpanded = expandedLectures.has(stableKey);
                                const badgeNum =
                                  lecture.number === 999 ? '⋯' : String(lecture.number);

                                return (
                                  <div
                                    key={stableKey}
                                    className="border border-gray-200 rounded-xl overflow-hidden bg-white/50 hover:bg-white/80 transition-all"
                                  >
                                    <button
                                      type="button"
                                      onClick={() => toggleLecture(stableKey)}
                                      className="w-full text-left p-4 hover:bg-gray-50/50 transition-all"
                                    >
                                      <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-4 flex-1 min-w-0">
                                          <div className="w-12 h-12 bg-gradient-to-br from-[#11CCEF] to-[#0daed9] rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-lg">
                                            {badgeNum}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <h3 className="text-lg font-semibold text-gray-900 mb-1 break-words">
                                              {headline}
                                            </h3>
                                            {lectureTitle &&
                                              lectureTitle !== 'Untitled Lecture' &&
                                              lecture.number !== 999 && (
                                                <p className="text-gray-600 text-sm break-words">
                                                  {lectureTitle}
                                                </p>
                                              )}
                                          </div>
                                        </div>
                                        <svg
                                          className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M19 9l-7 7-7-7"
                                          />
                                        </svg>
                                      </div>
                                    </button>

                                    {isExpanded && files.length > 0 && (
                                      <div className="border-t border-gray-200 bg-gray-50/50 p-4">
                                        <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                          <span>📎</span>
                                          {lecture.number === 999
                                            ? `Materials (${files.length})`
                                            : `Lecture Materials (${files.length})`}
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                          {files.map((file: any, fileIndex: number) => {
                                            let fileName = file.file_name;
                                            let displayName = file.file_name;
                                            const titleForClean =
                                              lecture.number === 999
                                                ? file.lectureTitle || 'material'
                                                : lectureTitle;

                                            if (
                                              !fileName ||
                                              (!fileName.includes(' ') && fileName.length > 20)
                                            ) {
                                              const cleanTitle = titleForClean
                                                .replace(/[^a-zA-Z0-9\s]/g, '')
                                                .trim()
                                                .substring(0, 30);
                                              fileName = `${cleanTitle || 'file'}_file_${fileIndex + 1}.pdf`;
                                              displayName = `File ${fileIndex + 1}`;
                                            }

                                            return (
                                              <div
                                                key={file.id || fileIndex}
                                                onClick={() =>
                                                  handleFileClick(file.file_path, fileName || 'file.pdf')
                                                }
                                                className="flex items-center gap-3 bg-white p-3 rounded-lg border border-gray-200 hover:border-[#11CCEF] hover:shadow-md transition-all cursor-pointer group"
                                              >
                                                <span className="text-xl">
                                                  {getFileIcon(fileName || 'file.pdf')}
                                                </span>
                                                <span className="text-sm text-gray-700 flex-1 truncate font-medium group-hover:text-[#11CCEF]">
                                                  {lecture.number === 999
                                                    ? displayName ||
                                                      file.lectureTitle ||
                                                      'File'
                                                    : displayName || 'File'}
                                                </span>
                                                <span className="text-xs text-[#11CCEF] font-medium">
                                                  {fileName?.toLowerCase().endsWith('.pdf')
                                                    ? 'View'
                                                    : 'Open'}
                                                </span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Videos Section */}
                    {selectedUnitData.videos && selectedUnitData.videos.length > 0 && (
                      <div className={STYLES.card}>
                        <div className="p-6 md:p-8">
                          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-pink-500 rounded-xl flex items-center justify-center text-white text-lg">
                              🎥
                            </div>
                            Videos ({selectedUnitData.videos.length})
                          </h2>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {selectedUnitData.videos.map((video: any, idx: number) => {
                              // Format video name - extract lecture number if available
                              const getVideoDisplayName = () => {
                                if (video.video_type === 'lecture') {
                                  // Try to find matching announcement to get lecture number
                                  const matchingAnnouncement = selectedUnitData.announcements?.find((a: any) => 
                                    a.file_path === video.video_url || 
                                    a.file_name === video.video_title
                                  );
                                  
                                  if (matchingAnnouncement) {
                                    const lectureMatch = matchingAnnouncement.title?.match(/Lecture\s*(\d+)/i);
                                    if (lectureMatch) {
                                      return `Lecture ${lectureMatch[1]} Video`;
                                    }
                                  }
                                  
                                  // Fallback: try to extract from video title
                                  const titleMatch = video.video_title?.match(/lecture\s*(\d+)/i);
                                  if (titleMatch) {
                                    return `Lecture ${titleMatch[1]} Video`;
                                  }
                                  
                                  // Last resort: use index + 1
                                  return `Lecture ${idx + 1} Video`;
                                }
                                return video.video_title || 'Unit Video';
                              };

                              return (
                                <div
                                  key={video.id || idx}
                                  className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden hover:shadow-xl transition-all cursor-pointer group"
                                  onClick={() => window.open(video.video_url, '_blank')}
                                >
                                  {/* Video Preview - Plays on Hover */}
                                  <div 
                                    className="relative w-full h-48 bg-gradient-to-br from-red-100 to-pink-100 overflow-hidden group/video"
                                    onMouseEnter={(e) => {
                                      const video = e.currentTarget.querySelector('video') as HTMLVideoElement;
                                      if (video) {
                                        video.play().catch(err => { if (process.env.NODE_ENV === 'development') console.log('Video play error:', err); });
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      const video = e.currentTarget.querySelector('video') as HTMLVideoElement;
                                      if (video) {
                                        video.pause();
                                        video.currentTime = 0; // Reset to start
                                      }
                                    }}
                                  >
                                    <video
                                      src={video.video_url}
                                      className="w-full h-full object-cover"
                                      muted
                                      loop
                                      playsInline
                                      preload="metadata"
                                      onError={(e) => {
                                        // Fallback if video fails to load
                                        const videoEl = e.target as HTMLVideoElement;
                                        videoEl.style.display = 'none';
                                        const fallback = videoEl.parentElement?.querySelector('.video-fallback');
                                        if (fallback) {
                                          (fallback as HTMLElement).style.display = 'flex';
                                        }
                                      }}
                                    />
                                    {/* Fallback if video doesn't load */}
                                    <div className="video-fallback hidden absolute inset-0 w-full h-full flex items-center justify-center bg-gradient-to-br from-red-100 to-pink-100">
                                      <div className="w-20 h-20 bg-gradient-to-r from-red-500 to-pink-500 rounded-full flex items-center justify-center text-white text-4xl shadow-lg">
                                        ▶️
                                      </div>
                                    </div>
                                    {/* Play Button Overlay - Click to open full video */}
                                    <div 
                                      className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover/video:bg-black/20 transition-colors cursor-pointer"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        window.open(video.video_url, '_blank');
                                      }}
                                    >
                                      <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center shadow-xl transform group-hover/video:scale-110 transition-transform">
                                        <svg className="w-8 h-8 text-red-600 ml-1" fill="currentColor" viewBox="0 0 24 24">
                                          <path d="M8 5v14l11-7z"/>
                                        </svg>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* Video Info */}
                                  <div className="p-4">
                                    <h3 className="font-semibold text-gray-900 mb-1 truncate group-hover:text-red-600 transition-colors">
                                      {getVideoDisplayName()}
                                    </h3>
                                    <p className="text-xs text-gray-600 truncate">
                                      {video.video_title}
                                    </p>
                                    <div className="flex items-center gap-2 mt-2">
                                      <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-semibold">
                                        {video.video_type === 'lecture' ? '📚 Lecture' : '🎬 Video'}
                                      </span>
                                      <svg className="w-4 h-4 text-gray-400 group-hover:text-red-600 transition-colors ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                      </svg>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Quiz Section (Practice Only) */}
                    {selectedUnitData.quiz && selectedUnitData.quizQuestions && selectedUnitData.quizQuestions.length > 0 && (
                      <div className={STYLES.card}>
                        <div className="p-6 md:p-8">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gradient-to-r from-yellow-500 to-amber-500 rounded-xl flex items-center justify-center text-white text-lg">
                                🧪
                              </div>
                              <div>
                                <h3 className="text-lg font-bold text-gray-900">
                                  {selectedUnitData.quiz.title}
                                </h3>
                                <p className="text-sm text-gray-600">
                                  Practice Quiz (Does Not Unlock Units)
                                </p>
                              </div>
                            </div>
                            {userRole === 'Student' && (
                              <button
                                onClick={() => {
                                  setQuizAnswers({});
                                  setQuizResult(null);
                                  setShowQuizModal(true);
                                }}
                                className={STYLES.button.primary + " px-6 py-3"}
                              >
                                Attempt Quiz
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Assignment Brief */}
                    {selectedUnitData.assignmentBrief && (
                      <div className={STYLES.card}>
                        <div className="p-6 md:p-8">
                          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl flex items-center justify-center text-white text-lg">
                              📝
                            </div>
                            Assignment Brief
                          </h2>
                          
                          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-xl p-6 mb-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-3">
                              {selectedUnitData.assignmentBrief.heading || 'Assignment Brief'}
                            </h3>
                            {selectedUnitData.assignmentBrief.description && (
                              <p className="text-gray-700 mb-4 leading-relaxed">{selectedUnitData.assignmentBrief.description}</p>
                            )}
                            {selectedUnitData.assignmentBrief.important_note && (
                              <div className="bg-white p-4 rounded-lg border-l-4 border-amber-500 mb-4">
                                <p className="text-sm font-semibold text-gray-700 mb-1">💡 Important Note:</p>
                                <p className="text-sm text-gray-600">{selectedUnitData.assignmentBrief.important_note}</p>
                              </div>
                            )}
                            <div className="flex flex-wrap gap-2">
                              <span className={STYLES.badge.warning + " px-3 py-1 rounded-full text-sm font-semibold"}>
                                Grading: {selectedUnitData.assignmentBrief.grading_type === 'score' 
                                  ? `Score (Pass: ${selectedUnitData.assignmentBrief.passing_score}%)` 
                                  : 'Pass/Refer'}
                              </span>
                            </div>
                          </div>

                          {/* Assignment Files */}
                          {selectedUnitData.briefFiles && selectedUnitData.briefFiles.length > 0 && (
                            <div className="mb-6">
                              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <span>📎</span>
                                Brief Files
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {selectedUnitData.briefFiles.map((file: any, idx: number) => (
                                  <div
                                    key={idx}
                                    onClick={() => handleFileClick(file.file_path, file.file_name)}
                                    className="flex items-center gap-3 bg-white p-4 rounded-xl border border-amber-200 hover:border-amber-400 hover:shadow-md transition-all cursor-pointer group"
                                  >
                                    <span className="text-2xl">{getFileIcon(file.file_name)}</span>
                                    <div className="flex-1 min-w-0">
                                      <div className="font-medium text-gray-900 text-sm group-hover:text-amber-600 transition-colors truncate">
                                        {file.file_name}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        {file.file_name.toLowerCase().endsWith('.pdf') ? 'View PDF' : 'Download File'}
                                      </div>
                                    </div>
                                    <svg className="w-4 h-4 text-gray-400 group-hover:text-amber-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Assignment Submission Form (Students Only) */}
                          {userRole === 'Student' && selectedUnitData.unit?.enable_assignment_submission && (
                            <div className="border-t border-white/20 pt-6">
                              <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <span>📤</span>
                                Submit Your Assignment
                              </h4>

                              {assignmentSubmissionLockState?.isAdminUnlocked && (
                                <div
                                  style={{
                                    background: '#f0fdf4',
                                    border: '1px solid #bbf7d0',
                                    borderRadius: '10px',
                                    padding: '8px 14px',
                                    marginBottom: '12px',
                                    fontSize: '12px',
                                    color: '#16a34a',
                                    fontWeight: 600,
                                  }}
                                >
                                  🔓 Assignment submission manually unlocked by admin
                                </div>
                              )}

                              {assignmentSubmissionLockState?.isLocked && !submissions?.assignment ? (
                                <div
                                  style={{
                                    background: '#f8fafc',
                                    border: '2px solid #e2e8f0',
                                    borderRadius: '16px',
                                    padding: '24px',
                                    textAlign: 'center',
                                  }}
                                >
                                  <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔒</div>
                                  <div
                                    style={{
                                      fontSize: '16px',
                                      fontWeight: 800,
                                      color: '#0f172a',
                                      marginBottom: '8px',
                                    }}
                                  >
                                    Assignment Submission Locked
                                  </div>
                                  <div
                                    style={{
                                      fontSize: '13px',
                                      color: '#64748b',
                                      marginBottom: '16px',
                                    }}
                                  >
                                    Your assignment submission will open 3 days before the deadline.
                                  </div>
                                  <div
                                    style={{
                                      display: 'flex',
                                      gap: '12px',
                                      justifyContent: 'center',
                                      flexWrap: 'wrap',
                                    }}
                                  >
                                    <div
                                      style={{
                                        background: '#fef9c3',
                                        border: '1px solid #fde047',
                                        borderRadius: '12px',
                                        padding: '12px 20px',
                                        textAlign: 'center',
                                      }}
                                    >
                                      <div style={{ fontSize: '22px', fontWeight: 800, color: '#854d0e' }}>
                                        {assignmentSubmissionLockState.daysUntilUnlock}
                                      </div>
                                      <div style={{ fontSize: '11px', color: '#854d0e', fontWeight: 600 }}>
                                        days until submission opens
                                      </div>
                                    </div>
                                    <div
                                      style={{
                                        background: '#f0fbff',
                                        border: '1px solid #bae6fd',
                                        borderRadius: '12px',
                                        padding: '12px 20px',
                                        textAlign: 'center',
                                      }}
                                    >
                                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#0369a1' }}>📅 Unlocks on</div>
                                      <div style={{ fontSize: '13px', color: '#0369a1' }}>
                                        {assignmentSubmissionLockState.unlockDate?.toLocaleDateString('en-GB', {
                                          day: '2-digit',
                                          month: 'short',
                                          year: 'numeric',
                                        })}
                                      </div>
                                    </div>
                                    <div
                                      style={{
                                        background: '#fef2f2',
                                        border: '1px solid #fecaca',
                                        borderRadius: '12px',
                                        padding: '12px 20px',
                                        textAlign: 'center',
                                      }}
                                    >
                                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#dc2626' }}>⏰ Deadline</div>
                                      <div style={{ fontSize: '13px', color: '#dc2626' }}>
                                        {assignmentSubmissionLockState.deadline?.toLocaleDateString('en-GB', {
                                          day: '2-digit',
                                          month: 'short',
                                          year: 'numeric',
                                        })}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  {!assignmentSubmissionLockState?.isLocked &&
                                    assignmentSubmissionLockState?.deadline && (
                                    <div
                                      style={{
                                        background:
                                          assignmentSubmissionLockState.isFirstUnit
                                            ? '#f0fbff'
                                            : assignmentSubmissionLockState.daysUntilDeadline <= 3
                                            ? '#fef2f2'
                                            : assignmentSubmissionLockState.daysUntilDeadline <= 7
                                              ? '#fff7ed'
                                              : '#f0fdf4',
                                        border: `1px solid ${
                                          assignmentSubmissionLockState.isFirstUnit
                                            ? '#bae6fd'
                                            : assignmentSubmissionLockState.daysUntilDeadline <= 3
                                            ? '#fecaca'
                                            : assignmentSubmissionLockState.daysUntilDeadline <= 7
                                              ? '#fed7aa'
                                              : '#bbf7d0'
                                        }`,
                                        borderRadius: '12px',
                                        padding: '12px 16px',
                                        marginBottom: '16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                      }}
                                    >
                                      <span style={{ fontSize: '18px' }}>
                                        {assignmentSubmissionLockState.isFirstUnit
                                          ? '📅'
                                          : assignmentSubmissionLockState.daysUntilDeadline <= 3
                                          ? '🚨'
                                          : assignmentSubmissionLockState.daysUntilDeadline <= 7
                                            ? '⚠️'
                                            : '✅'}
                                      </span>
                                      <div>
                                        <div
                                          style={{
                                            fontSize: '13px',
                                            fontWeight: 700,
                                            color:
                                              assignmentSubmissionLockState.isFirstUnit
                                                ? '#0369a1'
                                                : assignmentSubmissionLockState.daysUntilDeadline <= 3
                                                ? '#dc2626'
                                                : assignmentSubmissionLockState.daysUntilDeadline <= 7
                                                  ? '#d97706'
                                                  : '#16a34a',
                                          }}
                                        >
                                          {assignmentSubmissionLockState.isFirstUnit
                                            ? 'Assignment due (first unit — submit anytime)'
                                            : assignmentSubmissionLockState.daysUntilDeadline <= 0
                                            ? 'Deadline has passed!'
                                            : assignmentSubmissionLockState.daysUntilDeadline <= 3
                                              ? `⏰ Due in ${assignmentSubmissionLockState.daysUntilDeadline} day(s)!`
                                              : assignmentSubmissionLockState.daysUntilDeadline <= 7
                                                ? `Assignment due in ${assignmentSubmissionLockState.daysUntilDeadline} days`
                                                : 'Assignment submission is open'}
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                                          Deadline:{' '}
                                          {assignmentSubmissionLockState.deadline.toLocaleDateString('en-GB', {
                                            day: '2-digit',
                                            month: 'short',
                                            year: 'numeric',
                                          })}
                                        </div>
                                      </div>
                                    </div>
                                  )}

                              {submissions?.assignment ? (
                                <div className={`p-6 rounded-xl border-2 ${
                                  submissions.assignment.status === 'graded' 
                                    ? submissions.assignment.pass_fail_result === 'pass' 
                                      ? 'bg-green-50 border-green-300'
                                      : 'bg-red-50 border-red-300'
                                    : 'bg-blue-50 border-blue-300'
                                }`}>
                                  <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${
                                        submissions.assignment.status === 'graded' 
                                          ? submissions.assignment.pass_fail_result === 'pass' 
                                            ? 'bg-green-500'
                                            : 'bg-red-500'
                                          : 'bg-blue-500'
                                      }`}>
                                        {submissions.assignment.status === 'graded' 
                                          ? submissions.assignment.pass_fail_result === 'pass' ? '✓' : '✗'
                                          : '⏳'
                                        }
                                      </div>
                                      <div>
                                        <div className="font-semibold text-gray-900">
                                          {submissions.assignment.status === 'graded' ? 'Graded' : 'Submitted - Awaiting Grade'}
                                        </div>
                                        <div className="text-sm text-gray-600">
                                          Submitted on {new Date(submissions.assignment.submitted_at).toLocaleDateString()}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {submissions.assignment.status !== 'graded' && (
                                    <div className="bg-white p-4 rounded-lg border border-blue-200 mb-4">
                                      <p className="text-sm text-blue-800 flex items-center gap-2">
                                        <span>⏱️</span>
                                        <span><strong>Grading Timeline:</strong> Your assignment will be graded within 10 days of submission.</span>
                                      </p>
                                    </div>
                                  )}
                                  
                                  {submissions.assignment.status === 'graded' && (
                                    <div className="space-y-4">
                                      <div className="flex items-center gap-3 flex-wrap">
                                        <span className="font-semibold">Result:</span>
                                        <span className={`font-bold uppercase px-3 py-1 rounded-full text-sm ${
                                          submissions.assignment.pass_fail_result === 'pass' 
                                            ? 'bg-green-100 text-green-800'
                                            : submissions.assignment.pass_fail_result === 'refer'
                                            ? 'bg-amber-100 text-amber-800'
                                            : 'bg-red-100 text-red-800'
                                        }`}>
                                          {submissions.assignment.pass_fail_result || 'Pending'}
                                        </span>
                                      </div>
                                      
                                      {/* View Feedback & Grades Button */}
                                      <button
                                        onClick={() => router.push('/dashboard/student/grades')}
                                        className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transform hover:scale-105 transition-all flex items-center justify-center gap-2"
                                      >
                                        <span>📊</span>
                                        <span>View Full Feedback & Grades</span>
                                      </button>
                                      
                                      {submissions.assignment.feedback && (
                                        <div className="bg-white p-4 rounded-lg border border-gray-200">
                                          <p className="text-sm font-semibold text-gray-700 mb-1">📝 Quick Feedback Preview:</p>
                                          <div className="text-sm text-gray-600 line-clamp-4 max-h-32 overflow-y-auto">
                                            <div className="formatted-feedback-qualification max-w-none" dangerouslySetInnerHTML={{ __html: submissions.assignment.feedback }} />
                                          </div>
                                          <p className="text-xs text-blue-600 mt-1">Click "View Full Feedback & Grades" above to see complete feedback</p>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  
                                  {/* Show previous submission history */}
                                  {submissions.assignment_history && submissions.assignment_history.length > 1 && (
                                    <div className="mt-6 pt-4 border-t-2 border-gray-300">
                                      <h5 className="text-sm font-semibold text-gray-700 mb-3">📜 Previous Submission History</h5>
                                      <div className="space-y-3">
                                        {submissions.assignment_history.slice(1).map((prevSub: any, idx: number) => (
                                          <div key={prevSub.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                            <div className="flex items-center justify-between mb-3">
                                              <span className="text-sm font-semibold text-gray-700">
                                                Previous Submission #{submissions.assignment_history.length - idx}
                                              </span>
                                              <span className="text-xs text-gray-500">
                                                {new Date(prevSub.submitted_at).toLocaleDateString()}
                                              </span>
                                            </div>
                                            {prevSub.status === 'graded' && (
                                              <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                  <span className="text-sm font-semibold text-gray-700">Result:</span>
                                                  <span className={`text-xs font-bold uppercase px-3 py-1 rounded-full ${
                                                    prevSub.pass_fail_result === 'pass' 
                                                      ? 'bg-green-100 text-green-800'
                                                      : prevSub.pass_fail_result === 'refer'
                                                      ? 'bg-amber-100 text-amber-800'
                                                      : 'bg-red-100 text-red-800'
                                                  }`}>
                                                    {prevSub.pass_fail_result || 'Pending'}
                                                  </span>
                                                </div>
                                                {prevSub.feedback && (
                                                  <button
                                                    onClick={() => router.push('/dashboard/student/grades')}
                                                    className="text-xs font-semibold text-[#11CCEF] hover:text-cyan-600 transition-colors flex items-center gap-1 px-3 py-1.5 bg-white rounded-lg border border-[#11CCEF]/30 hover:border-[#11CCEF] hover:bg-[#11CCEF]/5"
                                                  >
                                                    <span>📝</span>
                                                    <span>View Feedback</span>
                                                  </button>
                                                )}
                                              </div>
                                            )}
                                            
                                            {/* Display files for previous submission */}
                                            {prevSub.files && prevSub.files.length > 0 && (
                                              <div className="mt-3">
                                                <p className="text-xs font-semibold text-gray-600 mb-2">Files ({prevSub.files.length}):</p>
                                                <div className="space-y-1">
                                                  {prevSub.files.map((file: any) => (
                                                    <div key={file.id} className="flex items-center gap-2 text-xs text-gray-600">
                                                      <span>📎</span>
                                                      <span className="truncate">{file.file_name}</span>
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                            
                                            {/* Display video link if provided */}
                                            {prevSub.video_link && (
                                              <div className="mt-2 text-xs text-gray-600 whitespace-pre-wrap break-all">
                                                <span className="font-semibold">Video / link: </span>
                                                {(() => {
                                                  const m = String(prevSub.video_link).match(/https?:\/\/[^\s]+/);
                                                  if (m) {
                                                    return (
                                                      <a href={m[0]} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                                        {prevSub.video_link}
                                                      </a>
                                                    );
                                                  }
                                                  return <span>{prevSub.video_link}</span>;
                                                })()}
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Display submitted files - tree style: latest on top, rejected/previous in dropdown below */}
                                  {submissions.assignment.files && submissions.assignment.files.length > 0 && (() => {
                                    const files = submissions.assignment.files as any[];
                                    const fileMap = new Map<number, any>();
                                    files.forEach((f: any) => fileMap.set(f.id, { ...f, olderVersions: [] }));
                                    files.forEach((f: any) => {
                                      if (f.replaces_file_id && fileMap.has(f.replaces_file_id)) {
                                        const oldFile = fileMap.get(f.replaces_file_id);
                                        const newFile = fileMap.get(f.id);
                                        if (newFile && oldFile) newFile.olderVersions = [oldFile, ...oldFile.olderVersions];
                                      }
                                    });
                                    const replacedIds = new Set(files.filter((f: any) => f.replaces_file_id).map((f: any) => f.replaces_file_id));
                                    const latestFiles = files.filter((f: any) => !replacedIds.has(f.id)).map((f: any) => fileMap.get(f.id));
                                    return (
                                      <div className="mt-4">
                                        <p className="text-sm font-semibold text-gray-700 mb-2">
                                          📎 Submitted Files ({files.length}):
                                        </p>
                                        <div className="space-y-2">
                                          {latestFiles.map((fileChain: any) => {
                                            const file = fileChain;
                                            const hasOlder = fileChain.olderVersions && fileChain.olderVersions.length > 0;
                                            const isExpanded = expandedFileChains.has(file.id);
                                            const isRejected = file.status === 'resubmit_requested';
                                            const canResubmit =
                                              isRejected &&
                                              userRole === 'Student' &&
                                              !assignmentSubmissionLockState?.isLocked;
                                            return (
                                              <div key={file.id} className={`rounded-lg border overflow-hidden ${isRejected ? 'border-red-200 bg-red-50/50' : 'border-gray-200 bg-white'}`}>
                                                <div className="flex items-center justify-between p-3">
                                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    {hasOlder && (
                                                      <button
                                                        type="button"
                                                        onClick={() => setExpandedFileChains(prev => {
                                                          const next = new Set(prev);
                                                          if (next.has(file.id)) next.delete(file.id); else next.add(file.id);
                                                          return next;
                                                        })}
                                                        className="text-gray-500 hover:text-gray-700 transition-transform duration-200 shrink-0"
                                                        style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                                                        aria-label={isExpanded ? 'Collapse' : 'Expand'}
                                                      >
                                                        ▶
                                                      </button>
                                                    )}
                                                    <span className="text-lg shrink-0">
                                                      {file.file_type === 'image' ? '🖼️' : file.file_type === 'audio' ? '🎵' : file.file_type === 'video' ? '🎥' : '📄'}
                                                    </span>
                                                    <div className="flex-1 min-w-0">
                                                      <p className="text-sm text-gray-700 font-medium truncate">{file.file_name}</p>
                                                      <p className="text-xs text-gray-500">
                                                        Uploaded: {new Date(file.uploaded_at).toLocaleDateString()} • {(file.file_size / 1024 / 1024).toFixed(2)} MB
                                                      </p>
                                                    </div>
                                                    {isRejected ? (
                                                      <span className="text-xs font-semibold bg-red-100 text-red-800 px-2 py-1 rounded shrink-0">🔴 REJECTED</span>
                                                    ) : (
                                                      <span className="text-xs font-semibold bg-green-100 text-green-800 px-2 py-1 rounded shrink-0">Submitted</span>
                                                    )}
                                                  </div>
                                                  <div className="flex items-center gap-2 shrink-0">
                                                    <button
                                                      onClick={() => handleFileClick(file.file_path, file.file_name)}
                                                      className="text-blue-600 hover:text-blue-800 text-sm font-semibold whitespace-nowrap"
                                                    >
                                                      View
                                                    </button>
                                                    {canResubmit && (
                                                      <button
                                                        onClick={() => { setFileToResubmit(file); setShowResubmitFileModal(true); }}
                                                        className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                                                      >
                                                        🔄 Resubmit
                                                      </button>
                                                    )}
                                                  </div>
                                                </div>
                                                {/* Rejection reason - one line only */}
                                                {isRejected && file.resubmit_feedback && (
                                                  <div className="bg-red-50 border-t border-red-200 px-4 py-2">
                                                    <RejectionDisplay
                                                      feedback={file.resubmit_feedback}
                                                      previewLength={150}
                                                      showLabel={false}
                                                      variant="inline"
                                                    />
                                                  </div>
                                                )}
                                                {/* Tree: rejected / previous versions below */}
                                                {hasOlder && isExpanded && (
                                                  <div className="border-t border-gray-200 bg-gray-50">
                                                    <p className="text-xs font-semibold text-gray-600 px-4 py-2">📂 Rejected / Previous versions</p>
                                                    <div className="pl-6 pr-3 pb-3 space-y-2">
                                                      {fileChain.olderVersions.map((oldFile: any) => (
                                                        <div key={oldFile.id} className="bg-white rounded border border-gray-200 p-2">
                                                          <div className="flex items-center justify-between gap-2">
                                                            <div className="min-w-0 flex-1">
                                                              <p className="text-xs font-medium text-gray-700 truncate">{oldFile.file_name}</p>
                                                              <p className="text-xs text-gray-500">{new Date(oldFile.uploaded_at).toLocaleDateString()}</p>
                                                            </div>
                                                            {oldFile.status === 'resubmit_requested' && (
                                                              <span className="text-xs font-semibold bg-red-100 text-red-800 px-2 py-0.5 rounded shrink-0">REJECTED</span>
                                                            )}
                                                            <button
                                                              onClick={() => handleFileClick(oldFile.file_path, oldFile.file_name)}
                                                              className="text-blue-600 hover:text-blue-800 text-xs font-semibold shrink-0"
                                                            >
                                                              View
                                                            </button>
                                                          </div>
                                                          {oldFile.status === 'resubmit_requested' && oldFile.resubmit_feedback && (
                                                            <RejectionDisplay
                                                              feedback={oldFile.resubmit_feedback}
                                                              previewLength={150}
                                                              showLabel={false}
                                                              variant="inline"
                                                            />
                                                          )}
                                                        </div>
                                                      ))}
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })()}

                                  {/* Display video / external link (with reject → resubmit flow) */}
                                  {submissions.assignment.video_link && (
                                    <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
                                      <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                        <span>🎥</span>
                                        <span>Video / large file link</span>
                                        {submissions.assignment.video_link_status !== 'rejected' && (
                                          <span className="text-xs font-bold text-green-700">✓ Submitted</span>
                                        )}
                                      </p>
                                      {submissions.assignment.video_link_status === 'rejected' ? (
                                        <div className="space-y-3">
                                          <p className="text-sm font-bold text-red-700">❌ Link rejected — please submit a new link</p>
                                          {submissions.assignment.video_link_reject_reason && (
                                            <p className="text-xs text-red-700">
                                              Reason: {submissions.assignment.video_link_reject_reason}
                                            </p>
                                          )}
                                          <p className="text-xs text-gray-600 whitespace-pre-wrap break-all">
                                            Previous: {submissions.assignment.video_link}
                                          </p>
                                          {assignmentSubmissionLockState?.isLocked && (
                                            <p className="text-xs text-amber-800 font-semibold">
                                              Link updates open when the assignment submission window opens (3 days before the deadline).
                                            </p>
                                          )}
                                          {!assignmentSubmissionLockState?.isLocked && (
                                          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                                            <div className="flex-1">
                                              <label className="block text-xs font-semibold text-gray-600 mb-1">New link</label>
                                              <input
                                                type="url"
                                                placeholder="Paste new video or Drive link"
                                                value={standaloneVideoLinkResubmit}
                                                onChange={(e) => setStandaloneVideoLinkResubmit(e.target.value)}
                                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                              />
                                            </div>
                                            <button
                                              type="button"
                                              onClick={handleStandaloneVideoLinkResubmit}
                                              disabled={standaloneVideoLinkSubmitting}
                                              className={STYLES.button.primary + ' px-4 py-2 text-sm disabled:opacity-50'}
                                            >
                                              {standaloneVideoLinkSubmitting ? 'Saving…' : 'Resubmit link'}
                                            </button>
                                          </div>
                                          )}
                                        </div>
                                      ) : (
                                        <div className="space-y-1">
                                          {(() => {
                                            const blob = submissions.assignment.video_link as string;
                                            const urlMatch = blob.match(/https?:\/\/[^\s]+/);
                                            if (urlMatch) {
                                              return (
                                                <a
                                                  href={urlMatch[0]}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="text-sm text-blue-600 hover:text-blue-800 underline break-all"
                                                >
                                                  {blob}
                                                </a>
                                              );
                                            }
                                            return (
                                              <span className="text-sm text-gray-800 whitespace-pre-wrap break-all">{blob}</span>
                                            );
                                          })()}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  
                                  {/* Resubmit button for failed or referred assignments */}
                                  {submissions.assignment.status === 'graded' && 
                                   (submissions.assignment.pass_fail_result === 'fail' || submissions.assignment.pass_fail_result === 'refer') && 
                                   !assignmentSubmissionLockState?.isLocked &&
                                   !showResubmitAssignment && (
                                    <div className="mt-6 pt-4 border-t border-gray-300">
                                      <button
                                        onClick={() => setShowResubmitAssignment(true)}
                                        className={STYLES.button.danger + " w-full py-3"}
                                      >
                                        🔄 Resubmit Assignment
                                      </button>
                                      <p className="text-xs text-gray-500 mt-2 text-center">
                                        You can resubmit your assignment after receiving feedback
                                      </p>
                                    </div>
                                  )}
                                  
                                  {/* Resubmission form */}
                                  {showResubmitAssignment && !assignmentSubmissionLockState?.isLocked && (
                                    <div className="mt-6 pt-4 border-t-2 border-amber-300">
                                      <h5 className="text-lg font-semibold text-gray-900 mb-4">🔄 Resubmit Your Assignment</h5>
                                      <div className="bg-gray-50 p-6 rounded-xl border-2 border-dashed border-amber-300 space-y-4">
                                        {/* Multi-file upload */}
                                        <div>
                                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            📎 Upload Files (Multiple Allowed)
                                          </label>
                                          <input
                                            type="file"
                                            accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.mp3,.wav,.mp4,.mov"
                                            multiple
                                            onChange={(e) => {
                                              const files = Array.from(e.target.files || []);
                                              setAssignmentFiles(prev => [...prev, ...files]);
                                            }}
                                            className="w-full text-sm text-gray-600 file:mr-4 file:py-3 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-amber-100 file:text-amber-700 hover:file:bg-amber-200"
                                          />
                                          <p className="text-xs text-red-600 font-semibold mt-2 bg-red-50 p-2 rounded">
                                            ⚠️ Max 10MB per file. Accepted: PDF, DOC, DOCX, PPT, PPTX, JPG, PNG, MP3, WAV, MP4, MOV
                                          </p>
                                        </div>

                                        {/* Display selected files */}
                                        {assignmentFiles.length > 0 && (
                                          <div className="space-y-2">
                                            <p className="text-sm font-semibold text-gray-700">Selected Files ({assignmentFiles.length}):</p>
                                            <div className="space-y-2">
                                              {assignmentFiles.map((file, index) => (
                                                <div key={index} className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200">
                                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                                    <span className="text-lg">📄</span>
                                                    <span className="text-sm text-gray-700 truncate">{file.name}</span>
                                                    <span className="text-xs text-gray-500 whitespace-nowrap">
                                                      ({(file.size / 1024 / 1024).toFixed(2)} MB)
                                                    </span>
                                                  </div>
                                                  <button
                                                    onClick={() => {
                                                      setAssignmentFiles(prev => prev.filter((_, i) => i !== index));
                                                    }}
                                                    className="ml-2 text-red-500 hover:text-red-700 text-xl"
                                                    title="Remove file"
                                                  >
                                                    ✕
                                                  </button>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        {/* Large Files Links (Google Drive) */}
                                        <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4">
                                          <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                            <span>☁️</span>
                                            <span>Large Files Links (Google Drive)</span>
                                          </label>
                                          <textarea
                                            value={largeFilesLinks}
                                            onChange={(e) => setLargeFilesLinks(e.target.value)}
                                            placeholder="Paste Google Drive links here (one per line)"
                                            rows={3}
                                            className="w-full px-4 py-3 rounded-lg border border-amber-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-sm resize-none"
                                          />
                                          <p className="text-xs text-amber-800 font-semibold mt-2">
                                            ⚠️ Max 10MB per file for direct uploads. For larger files, use Google Drive.
                                          </p>
                                        </div>

                                        <div className="flex gap-3">
                                          <button
                                            onClick={() => handleSubmitAssignment(true)}
                                            disabled={(assignmentFiles.length === 0 && !videoLink.trim() && !largeFilesLinks.trim()) || submitting}
                                            className={STYLES.button.primary + " flex-1 py-3 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"}
                                          >
                                            {submitting && (
                                              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                              </svg>
                                            )}
                                            <span>{submitting ? 'Uploading files...' : 'Resubmit Assignment'}</span>
                                          </button>
                                          <button
                                            onClick={() => {
                                              setShowResubmitAssignment(false);
                                              setAssignmentFile(null);
                                              setAssignmentFiles([]);
                                              setVideoLink('');
                                              setLargeFilesLinks('');
                                            }}
                                            className={STYLES.button.secondary + " px-6 py-3"}
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div>
                                  <div className="bg-gray-50 p-6 rounded-xl border-2 border-dashed border-gray-300 space-y-4">
                                    {/* Multi-file upload */}
                                    <div>
                                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        📎 Upload Files (Multiple Allowed)
                                      </label>
                                      <input
                                        type="file"
                                        accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.mp3,.wav,.mp4,.mov"
                                        multiple
                                        onChange={(e) => {
                                          const files = Array.from(e.target.files || []);
                                          setAssignmentFiles(prev => [...prev, ...files]);
                                        }}
                                        className="w-full text-sm text-gray-600 file:mr-4 file:py-3 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200"
                                      />
                                      <p className="text-xs text-red-600 font-semibold mt-2 bg-red-50 p-2 rounded">
                                        ⚠️ Max 10MB per file. Accepted: PDF, DOC, DOCX, PPT, PPTX, JPG, PNG, MP3, WAV, MP4, MOV
                                      </p>
                                    </div>

                                    {/* Display selected files */}
                                    {assignmentFiles.length > 0 && (
                                      <div className="space-y-2">
                                        <p className="text-sm font-semibold text-gray-700">Selected Files ({assignmentFiles.length}):</p>
                                        <div className="space-y-2">
                                          {assignmentFiles.map((file, index) => (
                                            <div key={index} className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200">
                                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <span className="text-lg">📄</span>
                                                <span className="text-sm text-gray-700 truncate">{file.name}</span>
                                                <span className="text-xs text-gray-500 whitespace-nowrap">
                                                  ({(file.size / 1024 / 1024).toFixed(2)} MB)
                                                </span>
                                              </div>
                                              <button
                                                onClick={() => {
                                                  setAssignmentFiles(prev => prev.filter((_, i) => i !== index));
                                                }}
                                                className="ml-2 text-red-500 hover:text-red-700 text-xl"
                                                title="Remove file"
                                              >
                                                ✕
                                              </button>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* Large Files Links (Google Drive) */}
                                    <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4">
                                      <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                        <span>☁️</span>
                                        <span>Large Files Links (Google Drive)</span>
                                      </label>
                                      <textarea
                                        value={largeFilesLinks}
                                        onChange={(e) => setLargeFilesLinks(e.target.value)}
                                        placeholder="Paste Google Drive links here (one per line)&#10;Example:&#10;https://drive.google.com/file/d/...&#10;https://drive.google.com/file/d/..."
                                        rows={4}
                                        className="w-full px-4 py-3 rounded-lg border border-amber-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-sm resize-none"
                                      />
                                      <div className="mt-2 space-y-2">
                                        <p className="text-xs text-amber-800 font-semibold flex items-start gap-2">
                                          <span>⚠️</span>
                                          <span><strong>File Size Limit:</strong> Maximum 10MB per file for direct uploads.</span>
                                        </p>
                                        <p className="text-xs text-blue-700 bg-blue-50 p-2 rounded flex items-start gap-2">
                                          <span>💡</span>
                                          <span><strong>For files larger than 10MB:</strong> Upload to Google Drive, set permission to "Anyone with the link can view", and paste the link above. This includes large videos, presentations, audio files, or any document over 10MB.</span>
                                        </p>
                                      </div>
                                    </div>

                                    <button
                                      onClick={() => handleSubmitAssignment(false)}
                                      disabled={(assignmentFiles.length === 0 && !videoLink.trim() && !largeFilesLinks.trim()) || submitting}
                                      className={STYLES.button.primary + " w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"}
                                    >
                                      {submitting && (
                                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                      )}
                                      <span>{submitting ? 'Uploading files...' : 'Submit Assignment'}</span>
                                    </button>
                                  </div>
                                </div>
                              )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  )
                ) : null}
              </div>
            )}
          </div>
        </div>

        {/* PDF Viewer Modal */}
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
                      <div className="text-lg">Error loading PDF</div>
                    </div>
                  </div>
                )}
                
                {/* *** SIMPLE IFRAME - JUST USE pdfSrc DIRECTLY *** (as per documentation) */}
                <iframe
                  src={pdfSrc}
                  className="w-full h-full"
                  title="PDF Viewer"
                  allow="fullscreen"
                  style={{ border: 'none' }}
                  onLoad={() => {
                    if (process.env.NODE_ENV === 'development') console.log('[Qualification View] PDF loaded successfully');
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

        {/* Quiz Attempt Modal */}
        {showQuizModal && selectedUnitData?.quiz && selectedUnitData?.quizQuestions && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-yellow-500 to-amber-500 rounded-xl flex items-center justify-center text-white text-lg">
                    🧪
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedUnitData.quiz.title}</h2>
                    <p className="text-sm text-gray-600">Practice Quiz - {selectedUnitData.quizQuestions.length} Questions</p>
                  </div>
                </div>
                {!quizResult && (
                  <button
                    onClick={() => {
                      setShowQuizModal(false);
                      setQuizAnswers({});
                      setQuizResult(null);
                    }}
                    className="text-gray-500 hover:text-gray-700 text-2xl w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {!quizResult ? (
                  <div className="space-y-6">
                    {selectedUnitData.quizQuestions.map((question: any, idx: number) => (
                      <div key={question.id || idx} className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 bg-gradient-to-r from-yellow-500 to-amber-500 rounded-lg flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                            {idx + 1}
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900 mb-4 text-lg">{question.question}</p>
                            <div className="space-y-2">
                              {question.options && Array.isArray(question.options) && question.options.map((opt: string, optIdx: number) => {
                                const optionLetter = String.fromCharCode(65 + optIdx);
                                return (
                                  <label
                                    key={optIdx}
                                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                                      quizAnswers[question.id] === opt
                                        ? 'bg-blue-100 border-2 border-blue-500'
                                        : 'bg-white border-2 border-gray-200 hover:border-blue-300'
                                    }`}
                                  >
                                    <input
                                      type="radio"
                                      name={`q-${question.id}`}
                                      value={opt}
                                      checked={quizAnswers[question.id] === opt}
                                      onChange={(e) => setQuizAnswers(prev => ({ ...prev, [question.id]: e.target.value }))}
                                      className="w-5 h-5 text-blue-600"
                                    />
                                    <span className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-700">
                                      {optionLetter}
                                    </span>
                                    <span className="flex-1 text-gray-700">{opt}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Results Summary */}
                    <div className={`rounded-xl p-6 text-center ${
                      quizResult.score >= (selectedUnitData.quiz.passing_score || 70)
                        ? 'bg-green-50 border-2 border-green-500'
                        : 'bg-red-50 border-2 border-red-500'
                    }`}>
                      <div className="text-4xl font-bold mb-2">
                        {quizResult.score >= (selectedUnitData.quiz.passing_score || 70) ? '✅' : '❌'}
                      </div>
                      <div className={`text-3xl font-bold mb-2 ${
                        quizResult.score >= (selectedUnitData.quiz.passing_score || 70) ? 'text-green-700' : 'text-red-700'
                      }`}>
                        {quizResult.score}%
                      </div>
                      <div className="text-lg text-gray-700 mb-2">
                        {quizResult.correct} out of {quizResult.total} questions correct
                      </div>
                      {quizResult.score >= (selectedUnitData.quiz.passing_score || 70) ? (
                        <div className="text-green-700 font-semibold">You passed! 🎉</div>
                      ) : (
                        <div className="text-red-700 font-semibold">
                          Passing Score: {selectedUnitData.quiz.passing_score || 70}%
                        </div>
                      )}
                    </div>

                    {/* Question Review */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-gray-900">Question Review</h3>
                      {selectedUnitData.quizQuestions.map((question: any, idx: number) => {
                        const userAnswer = quizResult.answers[question.id];
                        const isCorrect = userAnswer === question.correct_answer;
                        return (
                          <div key={question.id || idx} className={`rounded-xl p-4 border-2 ${
                            isCorrect ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'
                          }`}>
                            <div className="flex items-start gap-3 mb-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm ${
                                isCorrect ? 'bg-green-500' : 'bg-red-500'
                              }`}>
                                {idx + 1}
                              </div>
                              <p className="font-semibold text-gray-900 flex-1">{question.question}</p>
                            </div>
                            <div className="space-y-2 ml-11">
                              {question.options && Array.isArray(question.options) && question.options.map((opt: string, optIdx: number) => {
                                const optionLetter = String.fromCharCode(65 + optIdx);
                                const isUserAnswer = userAnswer === opt;
                                const isCorrectAnswer = question.correct_answer === opt;
                                return (
                                  <div
                                    key={optIdx}
                                    className={`p-2 rounded-lg ${
                                      isCorrectAnswer ? 'bg-green-100 border-2 border-green-500' :
                                      isUserAnswer ? 'bg-red-100 border-2 border-red-500' :
                                      'bg-gray-50 border border-gray-200'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs font-bold">
                                        {optionLetter}
                                      </span>
                                      <span className="flex-1">{opt}</span>
                                      {isCorrectAnswer && <span className="text-green-700 font-bold">✓ Correct</span>}
                                      {isUserAnswer && !isCorrectAnswer && <span className="text-red-700 font-bold">✗ Your Answer</span>}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="border-t border-gray-200 p-6">
                {!quizResult ? (
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowQuizModal(false);
                        setQuizAnswers({});
                      }}
                      className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        const totalQuestions = selectedUnitData.quizQuestions.length;
                        const answeredQuestions = Object.keys(quizAnswers).length;
                        
                        if (answeredQuestions < totalQuestions) {
                          showSweetAlert('Warning', `Please answer all ${totalQuestions} questions before submitting.`, 'warning');
                          return;
                        }

                        setSubmittingQuiz(true);
                        try {
                          const user = JSON.parse(localStorage.getItem('lms-user') || 'null');
                          const payload = Object.entries(quizAnswers).map(([qid, ans]) => ({
                            question_id: Number(qid),
                            answer: String(ans)
                          }));

                          const apiUrl = getApiUrl();
                          const response = await fetch(`${apiUrl}/api/qualification/units/${selectedUnitId}/quiz/attempt`, {
                            method: 'POST',
                            headers: {
                              'Authorization': `Bearer ${localStorage.getItem('lms-token')}`,
                              'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                              quiz_id: selectedUnitData.quiz.id,
                              student_id: user?.id,
                              answers: payload
                            })
                          });

                          const data = await response.json();
                          if (data.success) {
                            setQuizResult(data.result);
                          } else {
                            showSweetAlert('Error', data.message || 'Failed to submit quiz', 'error');
                          }
                        } catch (error) {
                          showSweetAlert('Error', 'Error submitting quiz. Please try again.', 'error');
                        } finally {
                          setSubmittingQuiz(false);
                        }
                      }}
                      disabled={submittingQuiz || Object.keys(quizAnswers).length < selectedUnitData.quizQuestions.length}
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-[#11CCEF] to-[#0daed9] text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submittingQuiz ? 'Submitting...' : 'Submit Quiz'}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setShowQuizModal(false);
                      setQuizAnswers({});
                      setQuizResult(null);
                    }}
                    className="w-full px-6 py-3 bg-gradient-to-r from-[#11CCEF] to-[#0daed9] text-white rounded-xl font-semibold hover:shadow-lg transition-all"
                  >
                    Close
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Resubmit File Modal */}
        {showResubmitFileModal && fileToResubmit && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="sticky top-0 bg-gradient-to-r from-amber-500 to-orange-500 text-white p-6 rounded-t-2xl">
                <h3 className="text-2xl font-bold">🔄 Resubmit File</h3>
                <p className="text-sm text-white/90 mt-1">Replace your rejected file with a new one</p>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4">
                {/* Original File Info */}
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-red-900 mb-2">📄 Rejected File:</p>
                  <p className="text-sm text-red-800 font-medium">{fileToResubmit.file_name}</p>
                  {fileToResubmit.resubmit_feedback && (
                    <div className="mt-3 pt-3 border-t border-red-200">
                      <RejectionDisplay
                        feedback={fileToResubmit.resubmit_feedback}
                        previewLength={250}
                        showLabel={true}
                        variant="modal"
                      />
                    </div>
                  )}
                </div>

                {/* File Upload */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    📎 Upload Replacement File
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.mp3,.wav,.mp4,.mov"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setResubmitFile(file);
                      }
                    }}
                    className="w-full text-sm text-gray-600 file:mr-4 file:py-3 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-amber-100 file:text-amber-700 hover:file:bg-amber-200"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    ⚠️ Max 10MB per file. Accepted formats: PDF, DOC, DOCX, PPT, PPTX, JPG, PNG, MP3, WAV, MP4, MOV
                  </p>
                </div>

                {/* Selected File Preview */}
                {resubmitFile && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">✅</span>
                        <div>
                          <p className="text-sm font-medium text-green-900">{resubmitFile.name}</p>
                          <p className="text-xs text-green-700">
                            {(resubmitFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setResubmitFile(null)}
                        className="text-red-600 hover:text-red-800 font-semibold text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}

                {/* Info Notice */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-800">
                    💡 <strong>Note:</strong> The new file will replace the rejected file in your submission. 
                    Your assessor will be notified and will review the new file.
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="border-t border-gray-200 p-6 flex gap-3">
                <button
                  onClick={() => {
                    setShowResubmitFileModal(false);
                    setFileToResubmit(null);
                    setResubmitFile(null);
                  }}
                  disabled={resubmittingFile}
                  className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResubmitFile}
                  disabled={!resubmitFile || resubmittingFile}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resubmittingFile ? (
                    <>
                      <span className="inline-block animate-spin mr-2">⏳</span>
                      Resubmitting...
                    </>
                  ) : (
                    '🔄 Resubmit File'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}