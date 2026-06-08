'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { apiService } from '@/app/services/api';
import { getApiUrl } from '@/app/utils/apiUrl';

export default function TodaySubmissionsPage() {
  const params = useParams();
  const router = useRouter();
  const subTutorId = params?.subTutorId as string;
  
  const [user, setUser] = useState<any>(null);
  const [tutorInfo, setTutorInfo] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedFeedback, setExpandedFeedback] = useState<{[key: number]: boolean}>({});
  const [showFileModal, setShowFileModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [expandedStudent, setExpandedStudent] = useState<{[key: string]: boolean}>({});
  const [expandedCourse, setExpandedCourse] = useState<{[key: string]: boolean}>({});
  const [expandedUnit, setExpandedUnit] = useState<{[key: string]: boolean}>({});
  const [expandedSubmission, setExpandedSubmission] = useState<{[key: string]: boolean}>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'graded' | 'ungraded'>('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  useEffect(() => {
    const userStr = localStorage.getItem('lms-user');
    if (userStr) {
      const userData = JSON.parse(userStr);
      setUser(userData);
      fetchData(userData.id);
    }
  }, [subTutorId]);
  
  // Reset page when search or filter changes
  useEffect(() => {
    setPage(1);
  }, [searchQuery, filterStatus]);

  const fetchData = async (tutorId: number) => {
    try {
      setLoading(true);
      const response = await apiService.getSubTutorStatsDetails(
        tutorId,
        parseInt(subTutorId),
        'today'
      );
      
      if (response?.success) {
        setTutorInfo(response.tutor);
        setSubmissions(response.details || []);
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };
  
  // Group submissions by student -> courses -> units -> submissions
  const groupedByStudent = submissions.reduce((acc: any, sub) => {
    if (!acc[sub.student_id]) {
      acc[sub.student_id] = {
        student_id: sub.student_id,
        student_name: sub.student_name,
        student_email: sub.student_email,
        courses: {}
      };
    }
    
    if (!acc[sub.student_id].courses[sub.course_id]) {
      acc[sub.student_id].courses[sub.course_id] = {
        course_id: sub.course_id,
        course_title: sub.course_title,
        units: {}
      };
    }
    
    if (!acc[sub.student_id].courses[sub.course_id].units[sub.unit_id]) {
      acc[sub.student_id].courses[sub.course_id].units[sub.unit_id] = {
        unit_id: sub.unit_id,
        unit_title: sub.unit_title,
        submissions: []
      };
    }
    
    acc[sub.student_id].courses[sub.course_id].units[sub.unit_id].submissions.push(sub);
    return acc;
  }, {});
  
  // Filter students
  const filteredStudents = Object.values(groupedByStudent).filter((student: any) => {
    const matchesSearch = student.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         student.student_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         Object.values(student.courses).some((course: any) =>
                           course.course_title.toLowerCase().includes(searchQuery.toLowerCase())
                         );
    
    if (!matchesSearch) return false;
    
    if (filterStatus === 'all') return true;
    
    const hasStatus = Object.values(student.courses).some((course: any) =>
      Object.values(course.units).some((unit: any) =>
        unit.submissions.some((sub: any) =>
          filterStatus === 'graded' ? sub.status === 'graded' : sub.status === 'submitted'
        )
      )
    );
    
    return hasStatus;
  });
  
  // Paginate students
  const totalStudents = filteredStudents.length;
  const totalPages = Math.ceil(totalStudents / limit);
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedStudents = filteredStudents.slice(startIndex, endIndex);

  return (
    <ProtectedRoute allowedRoles={['Assessor']} userRole={user?.role || null}>
      <div className="min-h-screen" style={{ backgroundColor: '#F8F9FA' }}>
        {/* Header */}
        <div className="bg-white shadow-sm border-b" style={{ borderColor: '#1E1E1E20' }}>
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div>
                <button
                  onClick={() => router.back()}
                  className="flex items-center gap-2 mb-3 px-3 py-1 rounded transition-colors"
                  style={{ color: '#11CCEF' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#11CCEF20';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <span>←</span> Back to Team
                </button>
                <h1 className="text-3xl font-bold" style={{ color: '#1E1E1E' }}>
                  Today's Submissions
                </h1>
                {tutorInfo && (
                  <p className="text-sm mt-2" style={{ color: '#1E1E1E70' }}>
                    {tutorInfo.name} ({tutorInfo.email})
                  </p>
                )}
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold" style={{ color: '#11CCEF' }}>
                  {submissions.length}
                </div>
                <div className="text-sm" style={{ color: '#1E1E1E70' }}>
                  Total Submissions
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: '#11CCEF' }}></div>
                <p className="text-lg" style={{ color: '#1E1E1E60' }}>Loading submissions...</p>
              </div>
            </div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-xl" style={{ color: '#1E1E1E60' }}>
                No submissions today
              </p>
            </div>
          ) : (
            <>
              {/* Search and Filters */}
              <div className="mb-6 flex gap-4">
                {/* Search */}
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Search students or courses..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border outline-none transition-colors"
                    style={{
                      borderColor: searchQuery ? '#11CCEF' : '#1E1E1E20',
                      backgroundColor: '#FFFFFF',
                    }}
                  />
                </div>
                
                {/* Filters */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setFilterStatus('all')}
                    className="px-4 py-3 rounded-lg font-medium transition-colors"
                    style={{
                      backgroundColor: filterStatus === 'all' ? '#11CCEF' : '#FFFFFF',
                      color: filterStatus === 'all' ? '#FFFFFF' : '#1E1E1E',
                      border: `1px solid ${filterStatus === 'all' ? '#11CCEF' : '#1E1E1E20'}`,
                    }}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setFilterStatus('graded')}
                    className="px-4 py-3 rounded-lg font-medium transition-colors"
                    style={{
                      backgroundColor: filterStatus === 'graded' ? '#12B7F38F' : '#FFFFFF',
                      color: filterStatus === 'graded' ? '#11CCEF' : '#1E1E1E',
                      border: `1px solid ${filterStatus === 'graded' ? '#11CCEF' : '#1E1E1E20'}`,
                    }}
                  >
                    Graded
                  </button>
                  <button
                    onClick={() => setFilterStatus('ungraded')}
                    className="px-4 py-3 rounded-lg font-medium transition-colors"
                    style={{
                      backgroundColor: filterStatus === 'ungraded' ? '#FC98D3C9' : '#FFFFFF',
                      color: filterStatus === 'ungraded' ? '#E51791' : '#1E1E1E',
                      border: `1px solid ${filterStatus === 'ungraded' ? '#E51791' : '#1E1E1E20'}`,
                    }}
                  >
                    Ungraded
                  </button>
                </div>
              </div>
              
              {/* Pagination Info */}
              <div className="flex justify-between items-center mb-4 text-sm" style={{ color: '#1E1E1E60' }}>
                <span>
                  Showing {totalStudents > 0 ? startIndex + 1 : 0} to {Math.min(endIndex, totalStudents)} of {totalStudents} student(s)
                </span>
                <div className="flex items-center gap-2">
                  <label>Per page:</label>
                  <select
                    value={limit}
                    onChange={(e) => setLimit(Number(e.target.value))}
                    className="px-3 py-1.5 border rounded-lg" style={{ borderColor: '#1E1E1E20' }}
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>

              {/* Recursive Tree Structure */}
              {totalStudents === 0 ? (
                <div className="text-center py-20">
                  <p className="text-xl" style={{ color: '#1E1E1E60' }}>
                    No submissions match your search
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {paginatedStudents.map((student: any) => {
                    const studentKey = `student-${student.student_id}`;
                    const isStudentExpanded = expandedStudent[studentKey];
                    
                    return (
                      <div key={studentKey} className="bg-white rounded-lg overflow-hidden" style={{ border: '1px solid #1E1E1E20' }}>
                        {/* Level 1: Student */}
                        <button
                          onClick={() => setExpandedStudent(prev => ({ ...prev, [studentKey]: !prev[studentKey] }))}
                          className="w-full flex items-center justify-between p-4 transition-colors"
                          style={{
                            backgroundColor: isStudentExpanded ? '#11CCEF10' : '#FFFFFF',
                          }}
                          onMouseEnter={(e) => !isStudentExpanded && (e.currentTarget.style.backgroundColor = '#11CCEF05')}
                          onMouseLeave={(e) => !isStudentExpanded && (e.currentTarget.style.backgroundColor = '#FFFFFF')}
                        >
                          <div className="flex items-center gap-3">
                            <svg className={`w-5 h-5 transition-transform ${isStudentExpanded ? 'rotate-90' : ''}`} style={{ color: '#11CCEF' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            <div className="text-left">
                              <h3 className="font-semibold text-lg" style={{ color: '#1E1E1E' }}>
                                👤 {student.student_name}
                              </h3>
                              <p className="text-sm" style={{ color: '#1E1E1E70' }}>{student.student_email}</p>
                            </div>
                          </div>
                          <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: '#11CCEF20', color: '#11CCEF' }}>
                            {Object.keys(student.courses).length} Course(s)
                          </span>
                        </button>
                        
                        {/* Level 2: Courses */}
                        {isStudentExpanded && (
                          <div className="pl-8 pb-2">
                            {Object.values(student.courses).map((course: any) => {
                              const courseKey = `course-${student.student_id}-${course.course_id}`;
                              const isCourseExpanded = expandedCourse[courseKey];
                              
                              return (
                                <div key={courseKey} className="mb-2">
                                  <button
                                    onClick={() => setExpandedCourse(prev => ({ ...prev, [courseKey]: !prev[courseKey] }))}
                                    className="w-full flex items-center justify-between p-3 rounded transition-colors"
                                    style={{
                                      backgroundColor: isCourseExpanded ? '#12B7F38F' : '#F8F9FA',
                                    }}
                                    onMouseEnter={(e) => !isCourseExpanded && (e.currentTarget.style.backgroundColor = '#11CCEF10')}
                                    onMouseLeave={(e) => !isCourseExpanded && (e.currentTarget.style.backgroundColor = '#F8F9FA')}
                                  >
                                    <div className="flex items-center gap-3">
                                      <svg className={`w-4 h-4 transition-transform ${isCourseExpanded ? 'rotate-90' : ''}`} style={{ color: isCourseExpanded ? '#FFFFFF' : '#11CCEF' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                      </svg>
                                      <span className="font-medium" style={{ color: isCourseExpanded ? '#FFFFFF' : '#11CCEF' }}>
                                        📚 {course.course_title}
                                      </span>
                                    </div>
                                    <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: isCourseExpanded ? '#FFFFFF' : '#11CCEF20', color: isCourseExpanded ? '#11CCEF' : '#11CCEF' }}>
                                      {Object.keys(course.units).length} Unit(s)
                                    </span>
                                  </button>
                                  
                                  {/* Level 3: Units */}
                                  {isCourseExpanded && (
                                    <div className="pl-8 mt-2 space-y-2">
                                      {Object.values(course.units).map((unit: any) => {
                                        const unitKey = `unit-${student.student_id}-${course.course_id}-${unit.unit_id}`;
                                        const isUnitExpanded = expandedUnit[unitKey];
                                        
                                        return (
                                          <div key={unitKey}>
                                            <button
                                              onClick={() => setExpandedUnit(prev => ({ ...prev, [unitKey]: !prev[unitKey] }))}
                                              className="w-full flex items-center justify-between p-3 rounded transition-colors"
                                              style={{
                                                backgroundColor: isUnitExpanded ? '#FC98D3C9' : '#FFFFFF',
                                                border: '1px solid #1E1E1E20',
                                              }}
                                              onMouseEnter={(e) => !isUnitExpanded && (e.currentTarget.style.backgroundColor = '#12B7F38F')}
                                              onMouseLeave={(e) => !isUnitExpanded && (e.currentTarget.style.backgroundColor = '#FFFFFF')}
                                            >
                                              <div className="flex items-center gap-3">
                                                <svg className={`w-4 h-4 transition-transform ${isUnitExpanded ? 'rotate-90' : ''}`} style={{ color: isUnitExpanded ? '#E51791' : '#11CCEF' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                </svg>
                                                <span className="font-medium text-sm" style={{ color: isUnitExpanded ? '#E51791' : '#1E1E1E' }}>
                                                  📁 {unit.unit_title}
                                                </span>
                                              </div>
                                              <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: isUnitExpanded ? '#FFFFFF' : '#11CCEF20', color: isUnitExpanded ? '#E51791' : '#11CCEF' }}>
                                                {unit.submissions.length} Submission(s)
                                              </span>
                                            </button>
                                            
                                            {/* Level 4: Submissions */}
                                            {isUnitExpanded && (
                                              <div className="pl-8 mt-2 space-y-2">
                                                {unit.submissions.map((sub: any, subIdx: number) => {
                                                  const subKey = `sub-${unitKey}-${subIdx}`;
                                                  const isSubExpanded = expandedSubmission[subKey];
                                                  
                                                  return (
                                                    <div key={subKey} className="bg-white rounded p-3" style={{ border: '1px solid #1E1E1E20' }}>
                                                      <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-2">
                                                          <span className="text-sm font-medium capitalize">📄 {sub.submission_type}</span>
                                                          <span
                                                            className="px-2 py-1 rounded-full text-xs font-medium"
                                                            style={{
                                                              backgroundColor: sub.status === 'submitted' ? '#FC98D3C9' : '#11CCEF',
                                                              color: '#FFFFFF',
                                                            }}
                                                          >
                                                            {sub.status === 'submitted' ? 'Ungraded' : 'Graded'}
                                                          </span>
                                                        </div>
                                                        <button
                                                          onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            const apiUrl = getApiUrl();
                                                            // Ensure HTTPS for Cloudinary URLs
                                                            const secureFilePath = sub.file_path && sub.file_path.startsWith('http://')
                                                              ? sub.file_path.replace('http://', 'https://')
                                                              : sub.file_path;
                                                            // Use proxy to display PDF inline
                                                            const proxyUrl = `${apiUrl}/api/admin/proxy-pdf?url=${encodeURIComponent(secureFilePath)}`;
                                                            setSelectedFile(proxyUrl);
                                                            setSelectedFileName(sub.file_name || 'Submission File');
                                                            setShowFileModal(true);
                                                          }}
                                                          className="text-xs px-3 py-1 rounded transition-colors font-medium cursor-pointer"
                                                          style={{ backgroundColor: '#11CCEF', color: '#FFFFFF' }}
                                                          onMouseEnter={(e) => {
                                                            e.currentTarget.style.backgroundColor = '#E51791';
                                                          }}
                                                          onMouseLeave={(e) => {
                                                            e.currentTarget.style.backgroundColor = '#11CCEF';
                                                          }}
                                                        >
                                                          📄 View File
                                                        </button>
                                                      </div>
                                                      <p className="text-xs mb-2" style={{ color: '#1E1E1E70' }}>
                                                        Submitted: {new Date(sub.submitted_at).toLocaleString()}
                                                      </p>
                                                      
                                                      {/* Feedback (if exists) */}
                                                      {sub.feedback && (
                                                        <>
                                                          <button
                                                            onClick={() => setExpandedSubmission(prev => ({ ...prev, [subKey]: !prev[subKey] }))}
                                                            className="flex items-center gap-2 text-xs px-2 py-1 rounded transition-colors"
                                                            style={{
                                                              backgroundColor: isSubExpanded ? '#11CCEF20' : '#11CCEF10',
                                                              color: '#11CCEF',
                                                            }}
                                                          >
                                                            <svg className={`w-3 h-3 transition-transform ${isSubExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                            </svg>
                                                            View Feedback
                                                          </button>
                                                          {isSubExpanded && (
                                                            <div className="mt-2 p-3 rounded overflow-auto" style={{ backgroundColor: '#11CCEF10', maxHeight: '300px' }}>
                                                              <div dangerouslySetInnerHTML={{ __html: sub.feedback }} className="text-xs prose prose-sm max-w-none" />
                                                              {sub.graded_by_name && (
                                                                <p className="text-xs mt-2" style={{ color: '#1E1E1E60' }}>
                                                                  Graded by: {sub.graded_by_name}
                                                                </p>
                                                              )}
                                                            </div>
                                                          )}
                                                        </>
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
                {totalPages > 1 && (
                  <div className="flex justify-center items-center gap-2 mt-6">
                    <button
                      onClick={() => setPage(prev => Math.max(1, prev - 1))}
                      disabled={page === 1}
                      className="px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        backgroundColor: page === 1 ? '#1E1E1E10' : '#11CCEF',
                        color: page === 1 ? '#1E1E1E40' : '#FFFFFF'
                      }}
                    >
                      ← Previous
                    </button>
                    <span className="px-4 py-2 text-sm font-medium" style={{ color: '#1E1E1E' }}>
                      Page {page} of {totalPages}
                    </span>
                    <button
                      onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={page === totalPages}
                      className="px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        backgroundColor: page === totalPages ? '#1E1E1E10' : '#11CCEF',
                        color: page === totalPages ? '#1E1E1E40' : '#FFFFFF'
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
        
        {/* File Viewer Modal */}
        {showFileModal && selectedFile && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4"
            onClick={() => {
              if (process.env.NODE_ENV === 'development') { console.log('Closing modal'); }
              setShowFileModal(false);
              setSelectedFile(null);
            }}
            style={{ zIndex: 9999 }}
          >
            <div 
              className="bg-white rounded-xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: '#1E1E1E20' }}>
                <div>
                  <h3 className="font-semibold text-lg" style={{ color: '#1E1E1E' }}>
                    📄 Submission File
                  </h3>
                  <p className="text-sm mt-1 font-medium" style={{ color: '#11CCEF' }}>
                    {selectedFileName}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowFileModal(false);
                    setSelectedFile(null);
                    setSelectedFileName('');
                  }}
                  className="text-2xl w-10 h-10 flex items-center justify-center rounded-lg transition-colors"
                  style={{ color: '#1E1E1E' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#1E1E1E10';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-hidden bg-gray-100">
                <iframe
                  src={selectedFile}
                  className="w-full h-full"
                  title="Submission File"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}

