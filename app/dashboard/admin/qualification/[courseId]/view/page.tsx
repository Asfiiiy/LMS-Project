'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiService } from '@/app/services/api';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { showSweetAlert } from '@/app/components/SweetAlert';
import { getApiUrl } from '@/app/utils/apiUrl';

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

export default function ViewQualificationCourse() {
  const params = useParams();
  const router = useRouter();
  const courseId = parseInt(params.courseId as string);
  
  const [userRole, setUserRole] = useState<'Admin' | 'Tutor' | 'Student' | null>(null);
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
  
  // Student submission state
  const [assignmentFile, setAssignmentFile] = useState<File | null>(null);
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

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('lms-user') || 'null');
    const role = user?.role || null;
    setUserRole(role as 'Admin' | 'Tutor' | 'Student' | null);
    loadCourseData();
  }, [courseId]);

  const loadCourseData = async () => {
    try {
      setLoading(true);
      const response = await apiService.getQualificationCourse(courseId);
      
      console.log('[Course View] Loaded data:', response);
      console.log('[Course View] Course files:', response.files);
      
      if (response.success) {
        setCourse(response.course);
        setCourseFiles(response.files || []);
        const sortedUnits = (response.units || []).sort((a: any, b: any) => {
          return (a.order_index || 0) - (b.order_index || 0);
        });
        
        // If student, fetch progress for all units to show lock status
        const user = JSON.parse(localStorage.getItem('lms-user') || 'null');
        if (user?.role === 'Student') {
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
                console.log('[Course View] Unit', unit.id, 'progress:', progressData.progress, 'is_unlocked:', progressData.progress?.is_unlocked);
                return {
                  ...unit,
                  progress: progressData.progress || { is_unlocked: 0 } // Default to locked if no progress
                };
              } catch (error) {
                console.error('[Course View] Error loading progress for unit:', unit.id, error);
                return {
                  ...unit,
                  progress: { is_unlocked: 0 } // Default to locked on error
                };
              }
            })
          );
          setUnits(unitsWithProgress);
          
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
            console.error('[Course View] Error checking certificate claims:', error);
          }
        } else {
          setUnits(sortedUnits);
        }
      } else {
        showSweetAlert('Error', 'Failed to load course data', 'error');
      }
    } catch (error) {
      console.error('Error loading course:', error);
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
        console.log('[Qualification View] Unit data loaded:', response);
        
        // If student, fetch their submissions for this unit
        if (studentId) {
          loadSubmissions(unitId, studentId);
        }
      } else {
        showSweetAlert('Error', 'Failed to load unit data', 'error');
      }
    } catch (error) {
      console.error('Error loading unit:', error);
      showSweetAlert('Error', 'Error loading unit data', 'error');
    } finally {
      setLoadingUnit(false);
    }
  };
  
  const loadSubmissions = async (unitId: number, studentId: number) => {
    try {
      const token = localStorage.getItem('lms-token');
      console.log('[Qualification View] Loading submissions for unit:', unitId, 'student:', studentId);
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/qualification/units/${unitId}/submissions?studentId=${studentId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.error('[Qualification View] Submissions fetch failed:', response.status, response.statusText);
        return;
      }
      
      const data = await response.json();
      console.log('[Qualification View] Submissions data:', data);
      
      if (data.success) {
        setSubmissions(data.submissions);
        // Reset resubmit forms when submissions are reloaded
        setShowResubmitAssignment(false);
        setShowResubmitPresentation(false);
      }
    } catch (error) {
      console.error('[Qualification View] Error loading submissions:', error);
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
    console.log('[Qualification View] File clicked:', fileName);
    console.log('[Qualification View] File path:', filePath);
    
    const fileExtension = fileName.toLowerCase().split('.').pop();
    
    // For PDFs, open in viewer modal using proxy for inline display
    if (fileExtension === 'pdf') {
      console.log('[Qualification View] Opening PDF in viewer');
      setPdfLoading(true);
      setPdfError(false);
      // Use proxy to force inline display instead of download
      const apiUrl = getApiUrl();
      // Ensure filePath uses HTTPS (fix Mixed Content error)
      const secureFilePath = filePath && filePath.startsWith('http://')
        ? filePath.replace('http://', 'https://')
        : filePath;
      const proxyUrl = `${apiUrl}/api/admin/proxy-pdf?url=${encodeURIComponent(secureFilePath)}`;
      setPdfSrc(proxyUrl);
    } else {
      // For other files, open in new tab
      console.log('[Qualification View] Opening non-PDF in new tab');
      // Ensure HTTPS for file URLs
      const secureFilePath = filePath && filePath.startsWith('http://')
        ? filePath.replace('http://', 'https://')
        : filePath;
      window.open(secureFilePath, '_blank');
    }
  };

  const closePdfViewer = () => {
    setPdfSrc('');
    setPdfLoading(false);
    setPdfError(false);
  };
  
  const handleSubmitAssignment = async (isResubmission: boolean = false) => {
    if (!assignmentFile || !selectedUnitId) return;
    
    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append('file', assignmentFile);
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
      
      if (data.success) {
        showSweetAlert(
          'Success!',
          isResubmission 
            ? 'Assignment resubmitted successfully! It will be graded again.' 
            : 'Assignment submitted successfully! Next unit may have been unlocked.',
          'success'
        );
        setAssignmentFile(null);
        setShowResubmitAssignment(false);
        // Reload submissions and course data to refresh unit lock statuses
        const user = JSON.parse(localStorage.getItem('lms-user') || 'null');
        if (user?.id) {
          loadSubmissions(selectedUnitId, user.id);
          // Reload course data to refresh unit list with updated lock statuses
          loadCourseData();
        }
      } else {
        showSweetAlert('Error', data.message || 'Failed to submit assignment', 'error');
      }
    } catch (error) {
      console.error('Error submitting assignment:', error);
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
      console.error('Error submitting presentation:', error);
      showSweetAlert('Error', 'Error submitting presentation. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#11CCEF] mx-auto mb-4"></div>
          <div className="text-lg text-gray-600">Loading course...</div>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['Admin', 'Tutor', 'Student']} userRole={userRole}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        {/* Animated Background Elements */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-r from-[#11CCEF] to-[#0daed9] rounded-full blur-3xl opacity-10 animate-float"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-r from-[#E51791] to-[#c3147f] rounded-full blur-3xl opacity-10 animate-float-delayed"></div>
        </div>

        <div className="relative flex flex-col lg:flex-row min-h-screen z-10">
          
          {/* Left Sidebar - Units Navigation */}
          <div className="w-full lg:w-80 bg-white/80 backdrop-blur-xl border-b lg:border-b-0 lg:border-r border-white/20 shadow-xl lg:shadow-2xl lg:h-screen lg:sticky lg:top-0 lg:overflow-y-auto">
            <div className="p-6 border-b border-white/20">
              <button
                onClick={() => router.back()}
                className="flex items-center gap-2 text-gray-600 hover:text-[#11CCEF] transition-colors text-sm font-medium mb-4 group"
              >
                <svg className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Dashboard
              </button>
              <h2 className="text-xl font-bold bg-gradient-to-r from-[#11CCEF] via-[#E51791] to-purple-500 bg-clip-text text-transparent break-words mb-2">{course?.title}</h2>
              <p className="text-sm text-gray-600">{units.length} {units.length === 1 ? 'Unit' : 'Units'}</p>
            </div>

            {/* Course Introduction Button */}
            <div className="p-4 border-b border-white/20">
              <button
                onClick={() => {
                  setSelectedUnitId(null);
                  setSelectedUnitData(null);
                }}
                className={`w-full text-left p-4 rounded-xl transition-all duration-300 ${
                  selectedUnitId === null
                    ? 'bg-gradient-to-r from-[#11CCEF] to-[#0daed9] text-white shadow-lg'
                    : 'bg-white/50 hover:bg-white/80 text-gray-700 hover:border-[#11CCEF]/30 border-2 border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center text-lg">
                    ℹ️
                  </div>
                  <div>
                    <div className="font-semibold text-sm">Course Introduction</div>
                    <div className="text-xs opacity-80">Welcome & Overview</div>
                  </div>
                </div>
              </button>
            </div>

            {/* Units List */}
            <div className="p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Course Units</h3>
              <div className="space-y-2">
                {units.map((unit) => {
                  // Check if unit is locked: for students, check is_unlocked field
                  // If progress doesn't exist, default to locked (is_unlocked = 0)
                  const isLocked = userRole === 'Student' && (unit.progress?.is_unlocked === 0 || unit.progress?.is_unlocked === false || !unit.progress);
                  const isSelected = selectedUnitId === unit.id;
                  
                  return (
                    <button
                      key={unit.id}
                      onClick={() => !isLocked && loadUnitData(unit.id)}
                      disabled={isLocked}
                      className={`w-full text-left p-3 rounded-xl transition-all duration-300 group ${
                        isSelected
                          ? 'bg-gradient-to-r from-[#11CCEF] to-[#0daed9] text-white shadow-lg'
                          : isLocked
                          ? 'bg-gray-100/50 text-gray-500 cursor-not-allowed opacity-70'
                          : 'bg-white/50 hover:bg-white/80 text-gray-700 hover:border-[#11CCEF]/30 border-2 border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {isLocked ? (
                          <div className="w-8 h-8 bg-gray-300 rounded-lg flex items-center justify-center text-sm">
                            🔒
                          </div>
                        ) : (
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                            isSelected ? 'bg-white/20' : 'bg-[#11CCEF]/10 text-[#11CCEF]'
                          }`}>
                            {unit.order_index || unit.id}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm mb-1 truncate">Unit {unit.order_index || unit.id}</div>
                          <div className="text-xs text-current opacity-80 break-words">{unit.title}</div>
                        </div>
                      </div>
                      {unit.is_optional && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full mt-2 inline-block">
                          Optional
                        </span>
                      )}
                      {/* Removed any count/0 display - not needed */}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Content Area */}
          <div className="flex-1 p-6 lg:p-8">
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

                {/* Claim Certificate - Show for students who completed all required units */}
                {(() => {
                  // Check if student has completed all required units (all assignments passed)
                  const requiredUnits = units.filter(u => !u.is_optional);
                  const allRequiredCompleted = requiredUnits.length > 0 && requiredUnits.every(u => 
                    u.progress?.is_completed && u.progress?.assignment_status === 'pass'
                  );
                  
                  if (userRole !== 'Student' || !allRequiredCompleted) {
                    return null;
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
                              Unlock Requirement: {selectedUnitData.unit.unlock_condition === 'both' ? 'Complete Assignment & Quiz' : `Complete ${selectedUnitData.unit.unlock_condition.charAt(0).toUpperCase() + selectedUnitData.unit.unlock_condition.slice(1)}`}
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
                                {selectedUnitData.unit?.order_index || selectedUnitId}
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
                              {selectedUnitData.unit?.is_optional && (
                                <span className={STYLES.badge.warning + " px-3 py-1 rounded-full text-xs font-semibold"}>
                                  Optional Unit
                                </span>
                              )}
                              {selectedUnitData.unit?.unlock_condition && (
                                <span className={STYLES.badge.purple + " px-3 py-1 rounded-full text-xs font-semibold"}>
                                  Unlock: {selectedUnitData.unit.unlock_condition}
                                </span>
                              )}
                              {selectedUnitData.progress?.is_unlocked === 1 && (
                                <span className={STYLES.badge.success + " px-3 py-1 rounded-full text-xs font-semibold"}>
                                  🔓 Unlocked
                                </span>
                              )}
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
                              const lectureGroups = new Map<string, any[]>();
                              
                              selectedUnitData.announcements.forEach((announcement: any) => {
                                const match = announcement.title.match(/^(Lecture\s+\d+):?\s*(.*)$/i);
                                if (match) {
                                  const lectureKey = match[1];
                                  const lectureTitle = match[2] || '';
                                  
                                  if (!lectureGroups.has(lectureKey)) {
                                    lectureGroups.set(lectureKey, []);
                                  }
                                  
                                  lectureGroups.get(lectureKey)!.push({
                                    ...announcement,
                                    lectureTitle: lectureTitle || announcement.content || 'Untitled Lecture'
                                  });
                                } else {
                                  const key = `Lecture ${lectureGroups.size + 1}`;
                                  if (!lectureGroups.has(key)) {
                                    lectureGroups.set(key, []);
                                  }
                                  lectureGroups.get(key)!.push({
                                    ...announcement,
                                    lectureTitle: announcement.title || announcement.content || 'Untitled Lecture'
                                  });
                                }
                              });
                              
                              const sortedGroups = Array.from(lectureGroups.entries()).sort((a, b) => {
                                const numA = parseInt(a[0].match(/\d+/)?.[0] || '0');
                                const numB = parseInt(b[0].match(/\d+/)?.[0] || '0');
                                return numA - numB;
                              });
                              
                              return sortedGroups.map(([lectureKey, files], groupIndex) => {
                                const firstFile = files[0];
                                const lectureTitle = firstFile.lectureTitle;
                                const isExpanded = expandedLectures.has(lectureKey);
                                
                                return (
                                  <div key={lectureKey} className="border border-gray-200 rounded-xl overflow-hidden bg-white/50 hover:bg-white/80 transition-all">
                                    <button
                                      onClick={() => toggleLecture(lectureKey)}
                                      className="w-full text-left p-4 hover:bg-gray-50/50 transition-all"
                                    >
                                      <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-4 flex-1 min-w-0">
                                          <div className="w-12 h-12 bg-gradient-to-br from-[#11CCEF] to-[#0daed9] rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-lg">
                                            {lectureKey.match(/\d+/)?.[0] || groupIndex + 1}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <h3 className="text-lg font-semibold text-gray-900 mb-1 break-words">
                                              {lectureKey}
                                            </h3>
                                            {lectureTitle && lectureTitle !== 'Untitled Lecture' && (
                                              <p className="text-gray-600 text-sm break-words">{lectureTitle}</p>
                                            )}
                                          </div>
                                        </div>
                                        <svg 
                                          className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                          fill="none" 
                                          stroke="currentColor" 
                                          viewBox="0 0 24 24"
                                        >
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                      </div>
                                    </button>
                                    
                                    {isExpanded && files.length > 0 && (
                                      <div className="border-t border-gray-200 bg-gray-50/50 p-4">
                                        <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                          <span>📎</span>
                                          Lecture Materials ({files.length})
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                          {files.map((file: any, fileIndex: number) => {
                                            let fileName = file.file_name;
                                            let displayName = file.file_name;
                                            
                                            if (!fileName || (!fileName.includes(' ') && fileName.length > 20)) {
                                              const cleanTitle = lectureTitle.replace(/[^a-zA-Z0-9\s]/g, '').trim().substring(0, 30);
                                              fileName = `${cleanTitle}_file_${fileIndex + 1}.pdf`;
                                              displayName = `File ${fileIndex + 1}`;
                                            }
                                            
                                            return (
                                              <div
                                                key={file.id || fileIndex}
                                                onClick={() => handleFileClick(file.file_path, fileName || 'file.pdf')}
                                                className="flex items-center gap-3 bg-white p-3 rounded-lg border border-gray-200 hover:border-[#11CCEF] hover:shadow-md transition-all cursor-pointer group"
                                              >
                                                <span className="text-xl">
                                                  {getFileIcon(fileName || 'file.pdf')}
                                                </span>
                                                <span className="text-sm text-gray-700 flex-1 truncate font-medium group-hover:text-[#11CCEF]">
                                                  {displayName || 'File'}
                                                </span>
                                                <span className="text-xs text-[#11CCEF] font-medium">
                                                  {fileName?.toLowerCase().endsWith('.pdf') ? 'View' : 'Open'}
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
                                    const lectureMatch = matchingAnnouncement.title?.match(/Lecture\s+(\d+)/i);
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
                                        video.play().catch(err => console.log('Video play error:', err));
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
                                  : 'Pass/Fail'}
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
                                          <p className="text-sm font-semibold text-gray-700 mb-2">📝 Quick Feedback Preview:</p>
                                          <div className="text-sm text-gray-600 line-clamp-3">
                                            <div dangerouslySetInnerHTML={{ __html: submissions.assignment.feedback }} />
                                          </div>
                                          <p className="text-xs text-blue-600 mt-2">Click "View Full Feedback & Grades" above to see complete feedback</p>
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
                                            <div className="mt-2 text-xs text-gray-500">
                                              File: {prevSub.file_name}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  <div className="mt-4 text-sm text-gray-600">
                                    <span className="font-semibold">Submitted File: </span>
                                    <span>{submissions.assignment.file_name}</span>
                                  </div>
                                  
                                  {/* Resubmit button for failed or referred assignments */}
                                  {submissions.assignment.status === 'graded' && 
                                   (submissions.assignment.pass_fail_result === 'fail' || submissions.assignment.pass_fail_result === 'refer') && 
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
                                  {showResubmitAssignment && (
                                    <div className="mt-6 pt-4 border-t-2 border-amber-300">
                                      <h5 className="text-lg font-semibold text-gray-900 mb-4">🔄 Resubmit Your Assignment</h5>
                                      <div className="bg-gray-50 p-6 rounded-xl border-2 border-dashed border-gray-300">
                                        <input
                                          type="file"
                                          accept=".pdf,.doc,.docx,.ppt,.pptx"
                                          onChange={(e) => setAssignmentFile(e.target.files?.[0] || null)}
                                          className="mb-4 w-full text-sm text-gray-600 file:mr-4 file:py-3 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-amber-100 file:text-amber-700 hover:file:bg-amber-200"
                                        />
                                        {assignmentFile && (
                                          <p className="text-sm text-gray-700 mb-4 flex items-center gap-2">
                                            <span>📄</span>
                                            <span>Selected: <strong>{assignmentFile.name}</strong></span>
                                          </p>
                                        )}
                                        <div className="flex gap-3">
                                          <button
                                            onClick={() => handleSubmitAssignment(true)}
                                            disabled={!assignmentFile || submitting}
                                            className={STYLES.button.primary + " flex-1 py-3 disabled:opacity-50 disabled:cursor-not-allowed"}
                                          >
                                            {submitting ? 'Resubmitting...' : 'Resubmit Assignment'}
                                          </button>
                                          <button
                                            onClick={() => {
                                              setShowResubmitAssignment(false);
                                              setAssignmentFile(null);
                                            }}
                                            className={STYLES.button.secondary + " px-6 py-3"}
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </div>
                                      <p className="text-xs text-gray-500 mt-3">
                                        Accepted formats: PDF, DOC, DOCX, PPT, PPTX (Max 100MB)
                                      </p>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div>
                                  <div className="bg-gray-50 p-6 rounded-xl border-2 border-dashed border-gray-300">
                                    <input
                                      type="file"
                                      accept=".pdf,.doc,.docx,.ppt,.pptx"
                                      onChange={(e) => setAssignmentFile(e.target.files?.[0] || null)}
                                      className="mb-4 w-full text-sm text-gray-600 file:mr-4 file:py-3 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-amber-100 file:text-amber-700 hover:file:bg-amber-200"
                                    />
                                    {assignmentFile && (
                                      <p className="text-sm text-gray-700 mb-4 flex items-center gap-2">
                                        <span>📄</span>
                                        <span>Selected: <strong>{assignmentFile.name}</strong></span>
                                      </p>
                                    )}
                                    <button
                                      onClick={() => handleSubmitAssignment(false)}
                                      disabled={!assignmentFile || submitting}
                                      className={STYLES.button.primary + " w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed"}
                                    >
                                      {submitting ? 'Submitting...' : 'Submit Assignment'}
                                    </button>
                                  </div>
                                  <p className="text-xs text-gray-500 mt-3">
                                    Accepted formats: PDF, DOC, DOCX, PPT, PPTX (Max 100MB)
                                  </p>
                                </div>
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
                    console.log('[Qualification View] PDF loaded successfully');
                    setPdfLoading(false);
                  }}
                  onError={() => {
                    console.error('[Qualification View] PDF load error');
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
                          console.error('Error submitting quiz:', error);
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
      </div>
    </ProtectedRoute>
  );
}