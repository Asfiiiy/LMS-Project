'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { apiService } from '@/app/services/api';
import { getApiUrl } from '@/app/utils/apiUrl';
import UniversalFileViewer from '@/app/components/UniversalFileViewer';

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

export default function SubTutorAllSubmissions() {
  const params = useParams();
  const router = useRouter();
  const subTutorId = params.subTutorId as string;

  const [user, setUser] = useState<any>(null);
  const [userLoaded, setUserLoaded] = useState(false);
  const [tutorInfo, setTutorInfo] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedFeedback, setExpandedFeedback] = useState<{[key: number]: boolean}>({});
  const [expandedFileVersions, setExpandedFileVersions] = useState<{[key: number]: boolean}>({});
  const [showUniversalViewer, setShowUniversalViewer] = useState(false);
  const [viewerFile, setViewerFile] = useState<{url: string, name: string, fileId?: number, openedAt?: string} | null>(null);
  const [rejectingFileId, setRejectingFileId] = useState<number | null>(null);
  const [rejectFeedback, setRejectFeedback] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [expandedStudent, setExpandedStudent] = useState<{[key: string]: boolean}>({});
  const [expandedCourse, setExpandedCourse] = useState<{[key: string]: boolean}>({});
  const [expandedUnit, setExpandedUnit] = useState<{[key: string]: boolean}>({});
  const [expandedSubmission, setExpandedSubmission] = useState<{[key: number]: boolean}>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'graded' | 'ungraded'>('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  useEffect(() => {
    const userStr = localStorage.getItem('lms-user');
    if (userStr) {
      const userData = JSON.parse(userStr);
      setUser(userData);
      setUserLoaded(true);
      fetchData(userData.id);
    } else {
      setUserLoaded(true);
      setLoading(false);
    }
  }, [subTutorId]);
  
  // Reset page when search or filter changes
  useEffect(() => {
    setPage(1);
  }, [searchQuery, filterStatus]);

  const fetchData = async (tutorId: number) => {
    if (!tutorId) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      
      // Fetch sub-tutors to get the name of the current sub-tutor
      const subTutorsResponse = await apiService.getSubTutors(tutorId);
      const subTutorsList = Array.isArray(subTutorsResponse) ? subTutorsResponse : subTutorsResponse.subTutors || [];
      const currentSubTutor = subTutorsList.find((t: any) => t.id === parseInt(subTutorId));
      setTutorInfo(currentSubTutor);

      // Fetch ALL submissions for this sub-tutor
      const allSubmissions = await apiService.getSubTutorAllSubmissions(tutorId, parseInt(subTutorId));
      
      setSubmissions(allSubmissions || []);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const getApiUrl = () => {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return '';
  };

  // File handling functions
  const handleFileClick = async (filePath: string, fileName: string, fileId?: number) => {
    if (fileId) {
      try {
        await apiService.markQualificationFileAsViewed(fileId);
      } catch (e) {
      }
    }
    const secureFilePath = filePath && filePath.startsWith('http://')
      ? filePath.replace('http://', 'https://')
      : filePath;
    setViewerFile({ url: secureFilePath, name: fileName, fileId, openedAt: new Date().toISOString() });
    setShowUniversalViewer(true);
  };

  const handleViewerDownload = async () => {
    if (!viewerFile) return;
    if (viewerFile.fileId) {
      try {
        await apiService.markQualificationFileAsDownloaded(viewerFile.fileId);
      } catch (e) {
      }
    }
    const apiUrl = getApiUrl();
    const downloadUrl = `${apiUrl}/api/qualification/download-file?url=${encodeURIComponent(viewerFile.url)}&filename=${encodeURIComponent(viewerFile.name)}`;
    window.open(downloadUrl, '_blank');
  };

  const handleRejectFile = async (fileId: number, fileName: string) => {
    setRejectingFileId(fileId);
    setRejectFeedback('');
    setShowRejectModal(true);
  };

  const confirmRejectFile = async () => {
    if (!rejectingFileId || !rejectFeedback.trim()) {
      alert('Please provide feedback for rejection');
      return;
    }

    try {
      await apiService.rejectQualificationFile(rejectingFileId, rejectFeedback);
      alert('File rejected successfully. Student will be notified.');
      
      // Refresh submissions
      if (user?.id) {
        const allSubmissions = await apiService.getSubTutorAllSubmissions(user.id, parseInt(subTutorId));
        setSubmissions(allSubmissions || []);
      }
      
      // Close modal and reset
      setShowRejectModal(false);
      setRejectingFileId(null);
      setRejectFeedback('');
    } catch (error) {
      alert('Failed to reject file. Please try again.');
    }
  };

  // Group submissions by Student -> Course -> Unit -> Submission
  const groupedByStudent = useMemo(() => {
    const grouped: any = {};
    
    submissions.forEach((sub) => {
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
  }, [submissions]);

  // Apply search and filters
  const filteredStudents = useMemo(() => {
    let filtered = { ...groupedByStudent };

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = Object.keys(filtered).reduce((acc: any, studentKey) => {
        const student = filtered[studentKey];
        if (student.student_name.toLowerCase().includes(query)) {
          acc[studentKey] = student;
        }
        return acc;
      }, {});
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      Object.keys(filtered).forEach(studentKey => {
        const student = filtered[studentKey];
        Object.keys(student.courses).forEach(courseKey => {
          const course = student.courses[courseKey];
          Object.keys(course.units).forEach(unitKey => {
            const unit = course.units[unitKey];
            unit.submissions = unit.submissions.filter((sub: any) => {
              if (filterStatus === 'graded') return sub.status === 'graded';
              if (filterStatus === 'ungraded') return sub.status !== 'graded';
              return true;
            });
            // Remove empty units
            if (unit.submissions.length === 0) {
              delete course.units[unitKey];
            }
          });
          // Remove empty courses
          if (Object.keys(course.units).length === 0) {
            delete student.courses[courseKey];
          }
        });
        // Remove empty students
        if (Object.keys(student.courses).length === 0) {
          delete filtered[studentKey];
        }
      });
    }

    return filtered;
  }, [groupedByStudent, searchQuery, filterStatus]);
  
  // Paginate students
  const paginatedStudents = useMemo(() => {
    const studentKeys = Object.keys(filteredStudents);
    const totalStudents = studentKeys.length;
    const totalPages = Math.ceil(totalStudents / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedKeys = studentKeys.slice(startIndex, endIndex);
    
    const paginated: any = {};
    paginatedKeys.forEach(key => {
      paginated[key] = filteredStudents[key];
    });
    
    return {
      students: paginated,
      totalStudents,
      totalPages,
      startIndex,
      endIndex
    };
  }, [filteredStudents, page, limit]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalSubmissions = submissions.length;
    const totalGraded = submissions.filter((s: any) => s.status === 'graded').length;
    const totalUngraded = submissions.filter((s: any) => s.status !== 'graded').length;
    const totalWithFeedback = submissions.filter((s: any) => s.feedback && s.feedback.trim() !== '').length;
    
    return {
      totalSubmissions,
      totalGraded,
      totalUngraded,
      totalWithFeedback
    };
  }, [submissions]);

  // Don't render ProtectedRoute until user data is loaded
  if (!userLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 mx-auto mb-4" style={{ borderColor: '#11CCEF' }}></div>
          <p className="text-lg font-medium" style={{ color: '#1E1E1E' }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['Assessor']} userRole={user?.role || null}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 mx-auto mb-4" style={{ borderColor: '#11CCEF' }}></div>
            <p className="text-lg font-medium" style={{ color: '#1E1E1E' }}>Loading submissions...</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['Assessor']} userRole={user?.role || null}>
      <div className="min-h-screen" style={{ backgroundColor: '#F8F9FA' }}>
        {/* Header */}
        <div className="p-6 border-b" style={{ backgroundColor: '#FFFFFF', borderColor: '#1E1E1E10' }}>
          <button
            onClick={() => router.push('/dashboard/tutor')}
            className="mb-4 flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
            style={{ backgroundColor: '#1E1E1E10', color: '#1E1E1E' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#1E1E1E20';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#1E1E1E10';
            }}
          >
            ← Back to Team
          </button>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold" style={{ backgroundColor: '#11CCEF', color: '#FFFFFF' }}>
              {tutorInfo?.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: '#1E1E1E' }}>
                All Submissions - {tutorInfo?.name}
              </h1>
              <p className="text-sm mt-1" style={{ color: '#1E1E1E60' }}>
                {tutorInfo?.email}
              </p>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="p-6 pb-0">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {/* Total Submissions */}
            <div className="rounded-xl p-6" style={{ backgroundColor: '#FFFFFF', border: '2px solid #11CCEF20' }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium" style={{ color: '#1E1E1E60' }}>Total Submissions</p>
                  <p className="text-3xl font-bold mt-2" style={{ color: '#11CCEF' }}>{stats.totalSubmissions}</p>
                </div>
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl" style={{ backgroundColor: '#11CCEF20' }}>
                  📊
                </div>
              </div>
            </div>

            {/* Total Graded */}
            <div className="rounded-xl p-6" style={{ backgroundColor: '#FFFFFF', border: '2px solid #28a74520' }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium" style={{ color: '#1E1E1E60' }}>Total Graded</p>
                  <p className="text-3xl font-bold mt-2" style={{ color: '#28a745' }}>{stats.totalGraded}</p>
                </div>
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl" style={{ backgroundColor: '#28a74520' }}>
                  ✅
                </div>
              </div>
            </div>

            {/* Total Ungraded */}
            <div className="rounded-xl p-6" style={{ backgroundColor: '#FFFFFF', border: '2px solid #E5179120' }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium" style={{ color: '#1E1E1E60' }}>Total Ungraded</p>
                  <p className="text-3xl font-bold mt-2" style={{ color: '#E51791' }}>{stats.totalUngraded}</p>
                </div>
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl" style={{ backgroundColor: '#E5179120' }}>
                  ⏳
                </div>
              </div>
            </div>

            {/* Total with Feedback */}
            <div className="rounded-xl p-6" style={{ backgroundColor: '#FFFFFF', border: '2px solid #11CCEF20' }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium" style={{ color: '#1E1E1E60' }}>Total Feedback</p>
                  <p className="text-3xl font-bold mt-2" style={{ color: '#11CCEF' }}>{stats.totalWithFeedback}</p>
                </div>
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl" style={{ backgroundColor: '#11CCEF20' }}>
                  💬
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="p-6 pt-0">
          <div className="rounded-xl p-6 mb-6" style={{ backgroundColor: '#FFFFFF' }}>
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="🔍 Search by student name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border-2 focus:outline-none transition-colors"
                  style={{ 
                    borderColor: '#1E1E1E20',
                    backgroundColor: '#FFFFFF'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#11CCEF';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#1E1E1E20';
                  }}
                />
              </div>

              {/* Status Filter */}
              <div className="flex gap-2">
                <button
                  onClick={() => setFilterStatus('all')}
                  className="px-6 py-3 rounded-lg font-medium transition-colors"
                  style={{
                    backgroundColor: filterStatus === 'all' ? '#11CCEF' : '#1E1E1E10',
                    color: filterStatus === 'all' ? '#FFFFFF' : '#1E1E1E'
                  }}
                >
                  All
                </button>
                <button
                  onClick={() => setFilterStatus('graded')}
                  className="px-6 py-3 rounded-lg font-medium transition-colors"
                  style={{
                    backgroundColor: filterStatus === 'graded' ? '#28a745' : '#1E1E1E10',
                    color: filterStatus === 'graded' ? '#FFFFFF' : '#1E1E1E'
                  }}
                >
                  Graded
                </button>
                <button
                  onClick={() => setFilterStatus('ungraded')}
                  className="px-6 py-3 rounded-lg font-medium transition-colors"
                  style={{
                    backgroundColor: filterStatus === 'ungraded' ? '#E51791' : '#1E1E1E10',
                    color: filterStatus === 'ungraded' ? '#FFFFFF' : '#1E1E1E'
                  }}
                >
                  Ungraded
                </button>
              </div>
            </div>
          </div>

          {/* Pagination Info */}
          <div className="flex justify-between items-center mb-4 text-sm" style={{ color: '#1E1E1E60' }}>
            <span>
              Showing {paginatedStudents.totalStudents > 0 ? paginatedStudents.startIndex + 1 : 0} to{' '}
              {Math.min(paginatedStudents.endIndex, paginatedStudents.totalStudents)} of{' '}
              {paginatedStudents.totalStudents} student(s)
            </span>
            <div className="flex items-center gap-2">
              <label className="text-sm">Per page:</label>
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
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
          {paginatedStudents.totalStudents === 0 ? (
            <div className="rounded-xl p-12 text-center" style={{ backgroundColor: '#FFFFFF' }}>
              <div className="text-6xl mb-4">📭</div>
              <p className="text-xl font-semibold mb-2" style={{ color: '#1E1E1E' }}>
                No submissions found
              </p>
              <p style={{ color: '#1E1E1E60' }}>
                Try adjusting your search or filters
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {Object.keys(paginatedStudents.students).map((studentKey) => {
                  const student = paginatedStudents.students[studentKey];
                const isStudentExpanded = expandedStudent[studentKey];

                return (
                  <div key={studentKey} className="rounded-xl overflow-hidden" style={{ backgroundColor: '#FFFFFF' }}>
                    {/* Student Header */}
                    <div
                      onClick={() => setExpandedStudent(prev => ({ ...prev, [studentKey]: !prev[studentKey] }))}
                      className="p-6 flex items-center justify-between cursor-pointer transition-colors"
                      style={{ backgroundColor: '#1E1E1E05' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#1E1E1E10';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#1E1E1E05';
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold" style={{ backgroundColor: '#11CCEF', color: '#FFFFFF' }}>
                          {student.student_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="text-lg font-bold" style={{ color: '#1E1E1E' }}>
                            👤 {student.student_name}
                          </h3>
                          <p className="text-sm" style={{ color: '#1E1E1E60' }}>
                            {Object.keys(student.courses).length} Course(s) • {
                              Object.values(student.courses).reduce((total: number, course: any) => 
                                total + Object.keys(course.units).length, 0)
                            } Unit(s)
                          </p>
                        </div>
                      </div>
                      <div className="text-2xl" style={{ color: '#1E1E1E40' }}>
                        {isStudentExpanded ? '▼' : '▶'}
                      </div>
                    </div>

                    {/* Courses (nested under student) */}
                    {isStudentExpanded && (
                      <div className="px-6 pb-4">
                        {Object.keys(student.courses).map((courseKey) => {
                          const course = student.courses[courseKey];
                          const isCourseExpanded = expandedCourse[courseKey];

                          return (
                            <div key={courseKey} className="mt-4 rounded-lg overflow-hidden border-2" style={{ borderColor: '#1E1E1E10' }}>
                              {/* Course Header */}
                              <div
                                onClick={() => setExpandedCourse(prev => ({ ...prev, [courseKey]: !prev[courseKey] }))}
                                className="p-4 flex items-center justify-between cursor-pointer transition-colors"
                                style={{ backgroundColor: '#11CCEF10' }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#11CCEF20';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = '#11CCEF10';
                                }}
                              >
                                <div>
                                  <h4 className="font-bold" style={{ color: '#1E1E1E' }}>
                                    📚 {course.course_name}
                                  </h4>
                                  <p className="text-sm mt-1" style={{ color: '#1E1E1E60' }}>
                                    {Object.keys(course.units).length} Unit(s)
                                  </p>
                                </div>
                                <div className="text-xl" style={{ color: '#1E1E1E40' }}>
                                  {isCourseExpanded ? '▼' : '▶'}
                                </div>
                              </div>

                              {/* Units (nested under course) */}
                              {isCourseExpanded && (
                                <div className="p-4" style={{ backgroundColor: '#FFFFFF' }}>
                                  {Object.keys(course.units).map((unitKey) => {
                                    const unit = course.units[unitKey];
                                    const isUnitExpanded = expandedUnit[unitKey];

                                    return (
                                      <div key={unitKey} className="mt-3 rounded-lg overflow-hidden border" style={{ borderColor: '#1E1E1E20' }}>
                                        {/* Unit Header */}
                                        <div
                                          onClick={() => setExpandedUnit(prev => ({ ...prev, [unitKey]: !prev[unitKey] }))}
                                          className="p-4 flex items-center justify-between cursor-pointer transition-colors"
                                          style={{ backgroundColor: '#E5179110' }}
                                          onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor = '#E5179120';
                                          }}
                                          onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor = '#E5179110';
                                          }}
                                        >
                                          <div>
                                            <h5 className="font-semibold" style={{ color: '#1E1E1E' }}>
                                              📖 {unit.unit_name}
                                            </h5>
                                            <p className="text-sm mt-1" style={{ color: '#1E1E1E60' }}>
                                              {unit.submissions.length} Submission(s)
                                            </p>
                                          </div>
                                          <div className="text-lg" style={{ color: '#1E1E1E40' }}>
                                            {isUnitExpanded ? '▼' : '▶'}
                                          </div>
                                        </div>

                                        {/* Submissions (nested under unit) */}
                                        {isUnitExpanded && (
                                          <div className="p-4 space-y-3" style={{ backgroundColor: '#F8F9FA' }}>
                                            {unit.submissions.map((sub: any) => {
                                              const isSubmissionExpanded = expandedSubmission[sub.submission_id];
                                              const isFeedbackExpanded = expandedFeedback[sub.submission_id];

                                              return (
                                                <div key={sub.submission_id} className="rounded-lg overflow-hidden border" style={{ borderColor: '#1E1E1E20', backgroundColor: '#FFFFFF' }}>
                                                  {/* Submission Header */}
                                                  <div
                                                    onClick={() => setExpandedSubmission(prev => ({ ...prev, [sub.submission_id]: !prev[sub.submission_id] }))}
                                                    className="p-4 flex items-center justify-between cursor-pointer transition-colors"
                                                    style={{ backgroundColor: '#FFFFFF' }}
                                                    onMouseEnter={(e) => {
                                                      e.currentTarget.style.backgroundColor = '#1E1E1E05';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                      e.currentTarget.style.backgroundColor = '#FFFFFF';
                                                    }}
                                                  >
                                                    <div className="flex-1">
                                                      <div className="flex items-center gap-3 flex-wrap">
                                                        <h6 className="font-semibold" style={{ color: '#1E1E1E' }}>
                                                          📝 Submission #{sub.submission_id}
                                                        </h6>
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

                                                  {/* Submission Details */}
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

                                                      {/* Submitted Files Section - Same as Record tab */}
                                                      <div className="bg-white rounded-lg border-2" style={{ borderColor: '#11CCEF40', padding: '16px' }}>
                                                        <h4 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: '#1E1E1E' }}>
                                                          <span>📎</span>
                                                          <span>Submitted Files ({sub.files?.length || 0})</span>
                                                        </h4>
                                                        
                                                        {sub.files && sub.files.length > 0 ? (
                                                          <div className="space-y-3">
                                                            {(() => {
                                                              // Build version chains (same logic as Record tab)
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
                                                        
                                                        {/* Show video/large files links if available */}
                                                        {sub.video_link && (
                                                          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                                                            <p className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                                              <span>🔗</span>
                                                              <span>External Links:</span>
                                                            </p>
                                                            <div className="text-sm text-gray-700 whitespace-pre-wrap break-all">
                                                              {sub.video_link.split('\n').map((link: string, idx: number) => (
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
                                                      {sub.status === 'graded' && sub.feedback && (
                                                        <div className="mt-4">
                                                          <button
                                                            onClick={() => setExpandedFeedback(prev => ({ ...prev, [sub.submission_id]: !prev[sub.submission_id] }))}
                                                            className="w-full p-3 rounded-lg flex items-center justify-between transition-colors"
                                                            style={{ backgroundColor: '#11CCEF10' }}
                                                            onMouseEnter={(e) => {
                                                              e.currentTarget.style.backgroundColor = '#11CCEF20';
                                                            }}
                                                            onMouseLeave={(e) => {
                                                              e.currentTarget.style.backgroundColor = '#11CCEF10';
                                                            }}
                                                          >
                                                            <span className="font-semibold" style={{ color: '#11CCEF' }}>
                                                              💬 View Feedback
                                                            </span>
                                                            <span style={{ color: '#11CCEF' }}>
                                                              {isFeedbackExpanded ? '▲' : '▼'}
                                                            </span>
                                                          </button>

                                                          {isFeedbackExpanded && (
                                                            <div
                                                              className="mt-2 p-4 rounded-lg"
                                                              style={{ backgroundColor: '#F8F9FA', color: '#1E1E1E' }}
                                                              dangerouslySetInnerHTML={{ __html: sub.feedback }}
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
              })}
            </div>

              {/* Pagination Controls */}
              {paginatedStudents.totalPages > 1 && (
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
                    Page {page} of {paginatedStudents.totalPages}
                  </span>
                  
                  <button
                    onClick={() => setPage(prev => Math.min(paginatedStudents.totalPages, prev + 1))}
                    disabled={page === paginatedStudents.totalPages}
                    className="px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: page === paginatedStudents.totalPages ? '#1E1E1E10' : '#11CCEF',
                      color: page === paginatedStudents.totalPages ? '#1E1E1E40' : '#FFFFFF'
                    }}
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
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

        {/* Reject File Modal */}
        {showRejectModal && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
            onClick={() => {
              setShowRejectModal(false);
              setRejectingFileId(null);
              setRejectFeedback('');
            }}
          >
            <div 
              className="bg-white rounded-xl w-full max-w-md p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold mb-4" style={{ color: '#1E1E1E' }}>
                ⚠️ Reject File
              </h3>
              <p className="text-sm mb-4" style={{ color: '#1E1E1E60' }}>
                Please provide feedback explaining why this file needs to be resubmitted. The student will be notified.
              </p>
              <textarea
                value={rejectFeedback}
                onChange={(e) => setRejectFeedback(e.target.value)}
                placeholder="Enter rejection reason..."
                className="w-full px-4 py-3 border-2 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
                style={{ 
                  borderColor: '#1E1E1E20',
                  minHeight: '120px'
                }}
                rows={4}
              />
              <div className="flex gap-3 mt-6">
                <button
                  onClick={confirmRejectFile}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
                >
                  Reject File
                </button>
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectingFileId(null);
                    setRejectFeedback('');
                  }}
                  className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}

