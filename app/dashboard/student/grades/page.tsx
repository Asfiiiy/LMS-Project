'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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

type UserRole = 'Admin' | 'Tutor' | 'Manager' | 'Student' | 'Moderator' | 'ManagerStudent' | 'InstituteStudent' | null;

export default function StudentGradesPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [grades, setGrades] = useState<GradeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupedGrades, setGroupedGrades] = useState<Record<string, GradeRecord[]>>({});
  const [selectedFeedback, setSelectedFeedback] = useState<GradeRecord | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
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

      /* Formatted feedback styling */
      .formatted-feedback {
        line-height: 1.6;
        color: #1f2937;
        font-size: 15px;
        overflow-wrap: break-word;
        word-break: break-word;
      }

      /* Tables - Preserve layout with horizontal scroll */
      .formatted-feedback table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        margin: 1rem 0;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 4px 12px rgba(17, 204, 239, 0.15);
        background: white;
        min-width: 300px;
        display: table;
      }
      
      .formatted-feedback table th {
        background: var(--primary-gradient);
        color: white;
        font-weight: 600;
        text-align: left;
        padding: 12px 16px;
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        white-space: nowrap;
      }
      
      .formatted-feedback table td {
        padding: 12px 16px;
        border-bottom: 1px solid #e5e7eb;
        vertical-align: top;
        color: #374151;
      }

      .formatted-feedback table tr:last-child td {
        border-bottom: none;
      }

      .formatted-feedback table tr:hover td {
        background-color: #f8fafc;
      }
      
      /* Ensure tables can scroll horizontally on mobile */
      .table-container {
        overflow-x: auto;
        margin: 1rem 0;
        border-radius: 12px;
        -webkit-overflow-scrolling: touch;
      }
      
      .table-container table {
        min-width: 600px;
      }
      
      /* Headings */
      .formatted-feedback h1,
      .formatted-feedback h2,
      .formatted-feedback h3,
      .formatted-feedback h4 {
        margin: 1.25rem 0 0.75rem 0;
        font-weight: 600;
        color: #111827;
        padding-left: 0.5rem;
        border-left: 4px solid var(--primary-color);
      }

      .formatted-feedback h1 {
        font-size: 1.5rem;
        border-left-width: 6px;
        padding-left: 1rem;
        background: linear-gradient(to right, rgba(17, 204, 239, 0.1), transparent);
        padding: 0.75rem 1rem;
        border-radius: 0 8px 8px 0;
      }

      .formatted-feedback h2 {
        font-size: 1.25rem;
        border-left-width: 5px;
        background: linear-gradient(to right, rgba(17, 204, 239, 0.08), transparent);
        padding: 0.5rem 0.75rem;
      }

      .formatted-feedback h3 {
        font-size: 1.1rem;
        border-left-width: 4px;
        background: linear-gradient(to right, rgba(17, 204, 239, 0.06), transparent);
      }
      
      /* Paragraphs and lists */
      .formatted-feedback p {
        margin: 0.75rem 0;
        color: #4b5563;
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
      
      /* Text formatting */
      .formatted-feedback strong {
        font-weight: 600;
        color: #111827;
        background: linear-gradient(120deg, rgba(17, 204, 239, 0.15) 0%, rgba(17, 204, 239, 0.1) 100%);
        padding: 0.1rem 0.3rem;
        border-radius: 3px;
      }
      
      .formatted-feedback em {
        font-style: italic;
        color: #6b7280;
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
        background: linear-gradient(to right, rgba(17, 204, 239, 0.05), transparent);
        color: #4b5563;
        font-style: italic;
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
          min-width: 500px;
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
      console.error('Error fetching grades:', err);
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
    setTimeout(() => {
      setSelectedFeedback(null);
      document.body.style.overflow = 'auto';
    }, 300);
  };

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
        {/* Main Content - Shifts right when panel opens on desktop */}
        <div className={`transition-all duration-300 ${
          isPanelOpen && screenSize === 'desktop' 
            ? 'ml-[70vw]' 
            : isPanelOpen && screenSize === 'tablet'
            ? 'ml-[50vw]'
            : ''
        }`}>
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

        {/* Feedback Panel */}
        {selectedFeedback && (
          <>
            {/* Backdrop */}
            <div 
              className={`fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 z-40 ${
                isPanelOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
              onClick={closeFeedbackPanel}
            />
            
            {/* Panel - Left side on desktop/tablet, Bottom on mobile */}
            <div className={`fixed z-50 bg-white shadow-2xl ${
              panelPosition === 'right' 
                ? `top-0 left-0 h-full ${
                    screenSize === 'desktop' 
                      ? 'w-[70vw]' 
                      : screenSize === 'tablet'
                      ? 'w-[50vw]'
                      : 'w-full'
                  } ${
                    isPanelOpen ? 'animate-slideInLeft' : 'animate-slideOutLeft'
                  }`
                : `bottom-0 left-0 w-full h-[85vh] rounded-t-2xl ${
                    isPanelOpen ? 'animate-slideUp' : 'animate-slideDown'
                  }`
            }`}>
              {/* Panel Header */}
              <div className="sticky top-0 z-10 bg-gradient-to-r from-[#11CCEF] to-[#E51791] p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                      <span className="text-white text-lg">💬</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">Tutor Feedback</h3>
                      <p className="text-sm text-white/80">Unit {selectedFeedback.unit_order}</p>
                    </div>
                  </div>
                  <button
                    onClick={closeFeedbackPanel}
                    className="p-2 text-white hover:text-white/80 transition-colors rounded-lg hover:bg-white/10"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Grade Summary */}
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{selectedFeedback.unit_title}</p>
                      <p className="text-xs text-white/80 truncate">{selectedFeedback.course_title}</p>
                    </div>
                    <div className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase ${getGradeBadgeClass(selectedFeedback)} ml-3`}>
                      {selectedFeedback.grading_type === 'numeric' && selectedFeedback.numeric_grade !== null ? `${selectedFeedback.numeric_grade}%` : ''}
                      {selectedFeedback.grading_type === 'pass_fail' && selectedFeedback.pass_fail_result ? selectedFeedback.pass_fail_result : ''}
                    </div>
                  </div>
                </div>
              </div>

              {/* Panel Content with Scroll */}
              <div className={`overflow-y-auto ${
                panelPosition === 'right' 
                  ? 'h-[calc(100vh-180px)]' 
                  : 'h-[calc(85vh-180px)]'
              }`}>
                <div className="p-6">
                  {/* Feedback Content */}
                  <div className="mb-8">
                    {selectedFeedback.feedback ? (
                      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                        <div className="formatted-feedback">
                          {/* Wrap tables in container for horizontal scroll */}
                          <div 
                            dangerouslySetInnerHTML={{ 
                              __html: selectedFeedback.feedback.replace(
                                /<table[^>]*>[\s\S]*?<\/table>/g, 
                                (match) => `<div class="table-container">${match}</div>`
                              )
                            }}
                            className="prose prose-sm max-w-none"
                          />
                        </div>
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
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}