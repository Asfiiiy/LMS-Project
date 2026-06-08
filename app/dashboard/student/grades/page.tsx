'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiMaximize2, FiMinimize2, FiX } from 'react-icons/fi';
import { apiService } from '@/app/services/api';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { showToast } from '@/app/components/Toast';

interface GradeRecord {
  course_id: number;
  course_title: string;
  unit_id: number;
  unit_title: string;
  unit_order: number;
  submission_type: 'assignment' | 'presentation';
  submission_id: number;
  grading_type: 'numeric' | 'pass_fail';
  numeric_grade: number | null;
  pass_fail_result: 'pass' | 'refer' | null;
  feedback: string | null;
  graded_by_name: string | null;
  graded_at: string | null;
  submitted_at: string;
}

type UserRole = 'Admin' | 'Assessor' | 'Manager' | 'Student' | 'Moderator' | 'ManagerStudent' | 'InstituteStudent' | null;

export default function StudentGradesPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [grades, setGrades] = useState<GradeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupedGrades, setGroupedGrades] = useState<Record<string, GradeRecord[]>>({});
  const [selectedFeedback, setSelectedFeedback] = useState<GradeRecord | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [feedbackFullScreen, setFeedbackFullScreen] = useState(false);
  const [panelPosition, setPanelPosition] = useState<'right' | 'bottom'>('right');
  const [screenSize, setScreenSize] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');

  // Detect screen size for responsive panel positioning
  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setScreenSize('mobile');
        setPanelPosition('bottom');
      } else if (width < 1024) {
        setScreenSize('tablet');
        setPanelPosition('right');
      } else {
        setScreenSize('desktop');
        setPanelPosition('right');
      }
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Add CSS for formatted feedback and animations
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      /* Brand Colors */
      :root {
        --primary-color: #11CCEF;
        --primary-gradient: linear-gradient(135deg, #11CCEF 0%, #0daed9 100%);
        --secondary-color: #E51791;
        --secondary-gradient: linear-gradient(135deg, #E51791 0%, #c9147d 100%);
        --success-color: #10b981;
        --success-gradient: linear-gradient(135deg, #10b981 0%, #059669 100%);
        --warning-color: #f59e0b;
        --warning-gradient: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        --danger-color: #ef4444;
        --danger-gradient: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      }

      /* Panel Animations */
      @keyframes slideInLeft {
        from {
          transform: translateX(-100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      
      @keyframes slideOutLeft {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(-100%);
          opacity: 0;
        }
      }
      
      @keyframes slideUp {
        from {
          transform: translateY(100%);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
      
      @keyframes slideDown {
        from {
          transform: translateY(0);
          opacity: 1;
        }
        to {
          transform: translateY(100%);
          opacity: 0;
        }
      }
      
      .animate-slideInLeft {
        animation: slideInLeft 0.3s ease-out forwards;
      }
      
      .animate-slideOutLeft {
        animation: slideOutLeft 0.3s ease-out forwards;
      }
      
      .animate-slideUp {
        animation: slideUp 0.3s ease-out forwards;
      }
      
      .animate-slideDown {
        animation: slideDown 0.3s ease-out forwards;
      }

      /* Formatted feedback - preserve tutor styling from Grade Submission editor */
      .formatted-feedback {
        line-height: 1.6;
        font-size: 15px;
        overflow-wrap: break-word;
        word-break: break-word;
        max-width: 100%;
        box-sizing: border-box;
        color: #1f2937;
      }

      /* Preserve center/left/right alignment from tutor (bold + center must both show) */
      .formatted-feedback .align-center,
      .formatted-feedback .aligncenter,
      .formatted-feedback p.align-center,
      .formatted-feedback p.aligncenter,
      .formatted-feedback div.align-center,
      .formatted-feedback div.aligncenter,
      .formatted-feedback h1.align-center, .formatted-feedback h1.aligncenter,
      .formatted-feedback h2.align-center, .formatted-feedback h2.aligncenter,
      .formatted-feedback h3.align-center, .formatted-feedback h3.aligncenter,
      .formatted-feedback h4.align-center, .formatted-feedback h4.aligncenter {
        text-align: center;
      }
      .formatted-feedback .align-right,
      .formatted-feedback .alignright,
      .formatted-feedback p.align-right, .formatted-feedback p.alignright,
      .formatted-feedback div.align-right, .formatted-feedback div.alignright {
        text-align: right;
      }
      .formatted-feedback .align-left,
      .formatted-feedback .alignleft,
      .formatted-feedback p.align-left, .formatted-feedback p.alignleft,
      .formatted-feedback div.align-left, .formatted-feedback div.alignleft {
        text-align: left;
      }
      .formatted-feedback .align-justify,
      .formatted-feedback .alignjustify,
      .formatted-feedback p.align-justify, .formatted-feedback p.alignjustify,
      .formatted-feedback div.align-justify, .formatted-feedback div.alignjustify {
        text-align: justify;
      }

      /* Tables - clean borders; do NOT override background/color/text-align so tutor styling shows */
      .formatted-feedback table {
        width: 100% !important;
        table-layout: auto !important;
        border-collapse: collapse;
        margin: 1rem 0;
        border: 1px solid #374151;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 1px 3px rgba(0,0,0,0.08);
        background: white;
        display: table;
      }
      
      .formatted-feedback table th {
        padding: 12px 16px;
        font-size: 13px;
        border: 1px solid #374151;
        vertical-align: top;
        font-weight: 600;
        min-width: 120px;
      }
      
      .formatted-feedback table td {
        padding: 12px 16px;
        border: 1px solid #374151;
        vertical-align: top;
        min-width: 100px;
      }

      .formatted-feedback table tr:hover td {
        background-color: rgba(248, 250, 252, 0.8);
      }
      
      /* Ensure tables can scroll horizontally, fit at 100% zoom */
      .table-container {
        overflow-x: auto;
        margin: 1rem 0;
        border-radius: 12px;
        -webkit-overflow-scrolling: touch;
        max-width: 100%;
      }
      
      .table-container table {
        min-width: 800px;
      }
      
      /* Headings - preserve tutor alignment/color; only add margin and fallback size */
      .formatted-feedback h1,
      .formatted-feedback h2,
      .formatted-feedback h3,
      .formatted-feedback h4 {
        margin: 1.25rem 0 0.75rem 0;
      }

      .formatted-feedback h1 {
        font-size: 1.5rem;
      }

      .formatted-feedback h2 {
        font-size: 1.25rem;
      }

      .formatted-feedback h3 {
        font-size: 1.1rem;
      }
      
      /* Paragraphs and lists - preserve tutor text-align and color */
      .formatted-feedback p {
        margin: 0.75rem 0;
      }

      .formatted-feedback ul,
      .formatted-feedback ol {
        margin: 0.75rem 0;
        padding-left: 1.5rem;
      }

      .formatted-feedback ul li {
        margin: 0.4rem 0;
        position: relative;
        padding-left: 1.5rem;
      }

      .formatted-feedback ul li::before {
        content: "▸";
        color: var(--primary-color);
        font-weight: bold;
        position: absolute;
        left: 0;
        font-size: 1.1em;
      }
      
      /* Text formatting - preserve tutor bold/italic/color from editor */
      .formatted-feedback strong {
        font-weight: 700;
      }
      
      .formatted-feedback em {
        font-style: italic;
      }

      /* Links */
      .formatted-feedback a {
        color: var(--primary-color);
        text-decoration: none;
        font-weight: 500;
        transition: color 0.2s;
      }

      .formatted-feedback a:hover {
        color: #0daed9;
        text-decoration: underline;
      }

      /* Code and quotes */
      .formatted-feedback pre,
      .formatted-feedback code {
        background: #f3f4f6;
        border-radius: 6px;
        padding: 0.25rem 0.5rem;
        font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
        font-size: 0.875rem;
      }

      .formatted-feedback pre {
        padding: 1rem;
        margin: 1rem 0;
        overflow-x: auto;
        border-left: 4px solid var(--primary-color);
      }

      .formatted-feedback blockquote {
        border-left: 4px solid var(--primary-color);
        padding: 0.75rem 1.25rem;
        margin: 1rem 0;
        border-radius: 0 8px 8px 0;
      }

      /* Images */
      .formatted-feedback img {
        max-width: 100%;
        height: auto;
        border-radius: 8px;
        margin: 1rem 0;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      }

      /* Horizontal rules */
      .formatted-feedback hr {
        border: none;
        height: 2px;
        background: linear-gradient(to right, transparent, var(--primary-color), transparent);
        margin: 1.5rem 0;
      }

      /* Mobile optimizations */
      @media (max-width: 768px) {
        .formatted-feedback {
          font-size: 14px;
        }
        
        .formatted-feedback table {
          font-size: 12px;
          border-radius: 8px;
          table-layout: auto !important;
        }
        
        .formatted-feedback th,
        .formatted-feedback td {
          padding: 10px 12px;
        }
        
        .formatted-feedback h1 {
          font-size: 1.25rem;
        }
        
        .formatted-feedback h2 {
          font-size: 1.1rem;
        }
        
        .formatted-feedback h3 {
          font-size: 1rem;
        }
        
        .table-container {
          border-radius: 8px;
          margin: 0.75rem -1rem;
          width: calc(100% + 2rem);
        }
        
        .table-container table {
          min-width: 600px;
          border-radius: 0;
        }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  useEffect(() => {
    const storedUserRaw = localStorage.getItem('lms-user');
    if (storedUserRaw) {
      const user = JSON.parse(storedUserRaw);
      setUserRole(user.role || null);
      if (user.id) {
        fetchGrades(user.id);
      } else {
        showToast('User ID not found.', 'error');
        setLoading(false);
      }
    } else {
      router.push('/');
    }
  }, [router]);

  const fetchGrades = async (studentId: number) => {
    try {
      setLoading(true);
      const response = await apiService.getStudentGrades(studentId);
      if (response.success) {
        const gradesData: GradeRecord[] = response.grades;
        setGrades(gradesData);

        // Group grades by course
        const grouped: Record<string, GradeRecord[]> = {};
        gradesData.forEach(grade => {
          const key = `${grade.course_id}-${grade.course_title}`;
          if (!grouped[key]) {
            grouped[key] = [];
          }
          grouped[key].push(grade);
        });

        // Sort grades within each course by unit order
        Object.keys(grouped).forEach(key => {
          grouped[key].sort((a, b) => a.unit_order - b.unit_order);
        });

        setGroupedGrades(grouped);
      } else {
        showToast(response.message || 'Failed to fetch grades.', 'error');
      }
    } catch (err) {
      showToast('An unexpected error occurred.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openFeedbackPanel = (grade: GradeRecord) => {
    setSelectedFeedback(grade);
    setIsPanelOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const closeFeedbackPanel = () => {
    setIsPanelOpen(false);
    setFeedbackFullScreen(false);
    setTimeout(() => {
      setSelectedFeedback(null);
      document.body.style.overflow = 'auto';
    }, 300);
  };

  useEffect(() => {
    if (!selectedFeedback) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (feedbackFullScreen) setFeedbackFullScreen(false);
        else closeFeedbackPanel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFeedback, feedbackFullScreen]);

  const getGradeBadgeClass = (grade: GradeRecord) => {
    if (grade.pass_fail_result === 'pass') return 'bg-gradient-to-r from-green-500 to-emerald-600 text-white';
    if (grade.pass_fail_result === 'refer') return 'bg-gradient-to-r from-amber-500 to-orange-500 text-white';
    if (grade.numeric_grade !== null) {
      if (grade.numeric_grade >= 70) return 'bg-gradient-to-r from-green-500 to-emerald-600 text-white';
      if (grade.numeric_grade >= 50) return 'bg-gradient-to-r from-yellow-500 to-amber-500 text-white';
      return 'bg-gradient-to-r from-red-500 to-rose-600 text-white';
    }
    return 'bg-gradient-to-r from-gray-500 to-gray-600 text-white';
  };

  const getGradeIcon = (grade: GradeRecord) => {
    if (grade.pass_fail_result === 'pass') return '✓';
    if (grade.pass_fail_result === 'refer') return '↻';
    return grade.numeric_grade !== null ? `${grade.numeric_grade}%` : '?';
  };

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['Student', 'ManagerStudent', 'InstituteStudent']} userRole={userRole}>
        <div className="min-h-screen bg-gradient-to-br from-[#f0fdff] via-white to-[#fff0f8] py-8 px-4 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-[#11CCEF]/20 rounded-full"></div>
              <div className="absolute top-0 left-0 w-16 h-16 border-4 border-[#11CCEF] border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-gray-600 font-medium">Loading your grades...</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['Student', 'ManagerStudent', 'InstituteStudent']} userRole={userRole}>
      <div className="min-h-screen bg-gradient-to-br from-[#f0fdff] via-white to-[#fff0f8]">
        {/* Main Content - no shift; feedback opens as centered overlay */}
        <div className="transition-all duration-300">
          <div className="max-w-6xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="mb-10">
              <div className="flex items-center justify-between mb-8">
                <button
                  onClick={() => router.push('/dashboard/student')}
                  className="group flex items-center gap-2 text-gray-600 hover:text-[#11CCEF] transition-colors font-medium"
                >
                  <svg className="w-5 h-5 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to Dashboard
                </button>
                <div className="w-12 h-12 bg-gradient-to-r from-[#11CCEF] to-[#E51791] rounded-xl flex items-center justify-center text-white shadow-lg">
                  <span className="text-xl">📊</span>
                </div>
              </div>
              
              <div className="mb-8">
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
                  My Grades & Feedback
                </h1>
                <p className="text-gray-600">
                  Track your academic progress with detailed tutor feedback
                </p>
              </div>

              {/* Stats Summary */}
              {Object.keys(groupedGrades).length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                  <div className="bg-white rounded-xl p-5 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-[#11CCEF]/10 to-[#E51791]/10 rounded-lg flex items-center justify-center">
                        <span className="text-lg">📚</span>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Total Courses</p>
                        <p className="text-2xl font-bold text-gray-900">{Object.keys(groupedGrades).length}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl p-5 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-[#11CCEF]/10 to-[#E51791]/10 rounded-lg flex items-center justify-center">
                        <span className="text-lg">📝</span>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Total Units</p>
                        <p className="text-2xl font-bold text-gray-900">{grades.length}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl p-5 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-[#11CCEF]/10 to-[#E51791]/10 rounded-lg flex items-center justify-center">
                        <span className="text-lg">⭐</span>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Avg. Grade</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {(() => {
                            const numericGrades = grades.filter(g => g.numeric_grade !== null);
                            if (numericGrades.length === 0) return 'N/A';
                            const avg = numericGrades.reduce((sum, g) => sum + (g.numeric_grade || 0), 0) / numericGrades.length;
                            return `${Math.round(avg)}%`;
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl p-5 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-[#11CCEF]/10 to-[#E51791]/10 rounded-lg flex items-center justify-center">
                        <span className="text-lg">✅</span>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Pass Rate</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {(() => {
                            const passed = grades.filter(g => 
                              g.pass_fail_result === 'pass' || 
                              (g.numeric_grade !== null && g.numeric_grade >= 50)
                            ).length;
                            return grades.length > 0 ? `${Math.round((passed / grades.length) * 100)}%` : '0%';
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {Object.keys(groupedGrades).length === 0 ? (
              <div className="bg-white rounded-2xl shadow-xl p-12 text-center border border-gray-100">
                <div className="w-24 h-24 bg-gradient-to-r from-[#11CCEF]/10 to-[#E51791]/10 rounded-full flex items-center justify-center mx-auto mb-8">
                  <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">No Grades Yet</h3>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                  Your graded submissions will appear here once your tutor has reviewed them.
                </p>
                <button
                  onClick={() => router.push('/dashboard/student')}
                  className="bg-gradient-to-r from-[#11CCEF] to-[#E51791] text-white px-8 py-3 rounded-xl font-semibold hover:shadow-lg transform hover:scale-105 transition-all"
                >
                  Browse Courses
                </button>
              </div>
            ) : (
              <div className="space-y-8">
                {Object.entries(groupedGrades).map(([key, courseGrades]) => {
                  const courseId = courseGrades[0].course_id;
                  const courseTitle = courseGrades[0].course_title;

                  return (
                    <div key={key} className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                      {/* Course Header */}
                      <div className="bg-gradient-to-r from-[#11CCEF] to-[#E51791] p-6 md:p-8">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                                <span className="text-white text-lg">🎓</span>
                              </div>
                              <h2 className="text-xl md:text-2xl font-bold text-white">{courseTitle}</h2>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-lg text-sm text-white font-medium">
                                {courseGrades.length} Units
                              </span>
                              <span className="text-white/80">•</span>
                              <span className="text-white/80 text-sm">
                                {courseGrades.filter(g => g.pass_fail_result === 'pass' || (g.numeric_grade !== null && g.numeric_grade >= 50)).length} Passed
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => router.push(`/dashboard/student/qualification/${courseId}/view`)}
                            className="px-6 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white rounded-xl font-medium transition-all duration-300 border border-white/20 hover:border-white/30 hover:shadow-lg"
                          >
                            View Course
                          </button>
                        </div>
                      </div>

                      {/* Grades Grid */}
                      <div className="p-6 md:p-8">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {courseGrades.map((grade) => (
                            <div
                              key={grade.submission_id}
                              className="group bg-gradient-to-br from-white to-gray-50 rounded-xl border border-gray-200 hover:border-[#11CCEF]/40 hover:shadow-xl transition-all duration-300 overflow-hidden"
                            >
                              {/* Card Header */}
                              <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                                <div className="flex items-start gap-4">
                                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold shadow-lg flex-shrink-0 ${getGradeBadgeClass(grade)}`}>
                                    {getGradeIcon(grade)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex-1">
                                        <h3 className="text-lg font-bold text-gray-900 mb-1.5 line-clamp-2">
                                          Unit {grade.unit_order}: {grade.unit_title}
                                        </h3>
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="px-3 py-1 bg-[#11CCEF]/10 text-[#11CCEF] rounded-lg text-xs font-medium capitalize">
                                            {grade.submission_type}
                                          </span>
                                          <span className="text-xs text-gray-500">
                                            Graded • {new Date(grade.graded_at || '').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Card Body */}
                              <div className="p-5">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-4">
                                      <div>
                                        <p className="text-sm text-gray-500 mb-1">Result</p>
                                        <span className={`px-4 py-2 rounded-lg text-sm font-bold uppercase ${getGradeBadgeClass(grade)}`}>
                                          {grade.grading_type === 'numeric' && grade.numeric_grade !== null ? `${grade.numeric_grade}%` : ''}
                                          {grade.grading_type === 'pass_fail' && grade.pass_fail_result ? grade.pass_fail_result : ''}
                                          {grade.numeric_grade === null && grade.pass_fail_result === null && 'N/A'}
                                        </span>
                                      </div>
                                      <div className="hidden sm:block h-8 w-px bg-gray-200"></div>
                                      <div className="hidden sm:block">
                                        <p className="text-sm text-gray-500 mb-0.5">Graded by</p>
                                        <p className="text-sm font-medium text-gray-900">{grade.graded_by_name || 'N/A'}</p>
                                      </div>
                                    </div>
                                  </div>

                                  {grade.feedback && (
                                    <button
                                      onClick={() => openFeedbackPanel(grade)}
                                      className="relative overflow-hidden px-6 py-2.5 bg-gradient-to-r from-[#11CCEF] to-[#E51791] text-white rounded-xl font-semibold hover:shadow-xl transition-all duration-300 group"
                                    >
                                      <span className="relative z-10 flex items-center gap-2">
                                        View Feedback
                                        <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                      </span>
                                      <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-100 transition-transform duration-500"></div>
                                    </button>
                                  )}
                                </div>

                                {/* Mobile Graded By */}
                                <div className="sm:hidden mt-4 pt-4 border-t border-gray-100">
                                  <p className="text-sm text-gray-500 mb-0.5">Graded by</p>
                                  <p className="text-sm font-medium text-gray-900">{grade.graded_by_name || 'N/A'}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Feedback Panel - opens centered in the middle, full screen option */}
        {selectedFeedback && (
          <>
            {/* Backdrop */}
            <div 
              className={`fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 z-40 ${
                isPanelOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
              onClick={closeFeedbackPanel}
            />
            
            {/* Centered wrapper: panel always in the middle (never slide from left) */}
            <div 
              className={`fixed z-50 inset-0 flex items-center justify-center p-3 sm:p-4 ${
                isPanelOpen ? '' : 'pointer-events-none'
              } ${feedbackFullScreen ? 'p-0' : ''}`}
              style={feedbackFullScreen ? { padding: 0 } : undefined}
            >
              <div 
                className={`bg-white shadow-2xl flex flex-col overflow-hidden flex-shrink-0 ${
                  feedbackFullScreen 
                    ? 'fixed inset-0 w-full h-full rounded-none' 
                    : 'max-w-5xl w-full max-h-[90vh] rounded-2xl'
                } transition-all duration-300 ${
                  isPanelOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
                }`}
                style={!feedbackFullScreen ? { margin: 'auto' } : undefined}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Panel Header */}
                <div className="sticky top-0 z-10 bg-gradient-to-r from-[#11CCEF] to-[#E51791] p-4 sm:p-6 flex-shrink-0">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-lg">💬</span>
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-lg font-bold text-white truncate">Tutor Feedback</h3>
                        <p className="text-sm text-white/80">Unit {selectedFeedback.unit_order}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => setFeedbackFullScreen((v) => !v)}
                        className="p-2.5 text-white hover:bg-white/20 rounded-lg transition-colors inline-flex items-center justify-center"
                        title={feedbackFullScreen ? 'Exit full screen' : 'Full screen'}
                        aria-label={feedbackFullScreen ? 'Exit full screen' : 'Full screen'}
                      >
                        {feedbackFullScreen ? (
                          <FiMinimize2 className="w-5 h-5 flex-shrink-0" aria-hidden />
                        ) : (
                          <FiMaximize2 className="w-5 h-5 flex-shrink-0" aria-hidden />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={closeFeedbackPanel}
                        className="p-2.5 text-white hover:bg-white/20 rounded-lg transition-colors inline-flex items-center justify-center"
                        aria-label="Close"
                      >
                        <FiX className="w-5 h-5 flex-shrink-0" aria-hidden />
                      </button>
                    </div>
                  </div>

                  {/* Grade Summary */}
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{selectedFeedback.unit_title}</p>
                        <p className="text-xs text-white/80 truncate">{selectedFeedback.course_title}</p>
                      </div>
                      <div className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase flex-shrink-0 ${getGradeBadgeClass(selectedFeedback)}`}>
                        {selectedFeedback.grading_type === 'numeric' && selectedFeedback.numeric_grade !== null ? `${selectedFeedback.numeric_grade}%` : ''}
                        {selectedFeedback.grading_type === 'pass_fail' && selectedFeedback.pass_fail_result ? selectedFeedback.pass_fail_result : ''}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Panel Content - scrollable, works at 100% zoom */}
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto">
                <div className="p-6">
                  {/* Feedback Content */}
                  <div className="mb-8 border border-gray-400 rounded-lg overflow-hidden">
                    {selectedFeedback.feedback ? (
                      <div className="bg-white p-6 shadow-sm">
                        {/* formatted-feedback preserves tutor styling (bold, alignment, colors, tables) from Grade Submission editor */}
                        <div 
                          className="formatted-feedback max-w-none"
                          dangerouslySetInnerHTML={{ 
                            __html: selectedFeedback.feedback.replace(
                              /<table[^>]*>[\s\S]*?<\/table>/g, 
                              (match) => `<div class="table-container">${match}</div>`
                            )
                          }}
                        />
                      </div>
                    ) : (
                      <div className="bg-gradient-to-br from-gray-50 to-white border border-dashed border-gray-300 rounded-2xl p-8 text-center">
                        <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <h5 className="text-lg font-semibold text-gray-900 mb-2">No Feedback Provided</h5>
                        <p className="text-gray-600 text-sm">
                          The tutor hasn't provided written feedback for this submission.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Submission Details */}
                  <div className="bg-gradient-to-r from-gray-50 to-[#f0fdff] rounded-2xl p-6 border border-gray-200">
                    <h5 className="font-semibold text-gray-900 mb-4">Submission Details</h5>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Graded By</span>
                        <span className="text-sm font-medium text-gray-900">{selectedFeedback.graded_by_name || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Submission Date</span>
                        <span className="text-sm font-medium text-gray-900">
                          {new Date(selectedFeedback.submitted_at).toLocaleDateString('en-GB', { 
                            day: 'numeric', 
                            month: 'short', 
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Grading Type</span>
                        <span className="text-sm font-medium text-gray-900 capitalize">
                          {selectedFeedback.grading_type === 'numeric' ? 'Percentage' : 'Pass/Refer'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Status</span>
                        <span className={`text-xs font-medium px-3 py-1 rounded-full ${
                          selectedFeedback.pass_fail_result === 'pass' || (selectedFeedback.numeric_grade !== null && selectedFeedback.numeric_grade >= 50)
                            ? 'bg-green-100 text-green-800'
                            : selectedFeedback.pass_fail_result === 'refer'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {selectedFeedback.pass_fail_result === 'pass' || (selectedFeedback.numeric_grade !== null && selectedFeedback.numeric_grade >= 50)
                            ? 'Completed'
                            : selectedFeedback.pass_fail_result === 'refer'
                            ? 'Needs Resubmission'
                            : 'Graded'
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Panel Footer */}
              <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6">
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={closeFeedbackPanel}
                    className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-xl font-semibold transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => router.push(`/dashboard/student/qualification/${selectedFeedback.course_id}/view`)}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-[#11CCEF] to-[#E51791] text-white rounded-xl font-semibold hover:shadow-lg transition-all"
                  >
                    View Course
                  </button>
                </div>
              </div>
            </div>
            </div>
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}