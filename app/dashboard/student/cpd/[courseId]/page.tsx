'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiService } from '@/app/services/api';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import LoadingButton from '@/app/components/LoadingButton';

interface CPDCourse {
  id: number;
  title: string;
  description: string;
}

interface CPDTopic {
  id: number;
  topic_number: number;
  title: string;
  description: string;
  deadline: string;
  files: any[];
  practice_quiz?: any;
  final_quiz?: any;
  progress: {
    is_unlocked: number;
    practice_quiz_attempted: number;
    practice_quiz_best_score: number;
    final_quiz_attempted: number;
    final_quiz_passed: number;
    final_quiz_score: number;
  };
}

const StudentCPDCourse = () => {
  const params = useParams();
  const router = useRouter();
  const courseId = parseInt(params.courseId as string);
  
  const [course, setCourse] = useState<CPDCourse | null>(null);
  const [announcements, setAnnouncements] = useState<any>(null);
  const [faq, setFaq] = useState<any>(null);
  const [topics, setTopics] = useState<CPDTopic[]>([]);
  const [canClaimCertificate, setCanClaimCertificate] = useState(false);
  const [hasCertificateClaim, setHasCertificateClaim] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<CPDTopic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userId, setUserId] = useState<number | null>(null);
  const [userRole, setUserRole] = useState<'Admin' | 'Tutor' | 'Student' | null>(null);
  const [viewingFile, setViewingFile] = useState<{url: string; name: string} | null>(null);
  const [loadingQuiz, setLoadingQuiz] = useState<{quizId: number; type: 'practice' | 'final'} | null>(null);
  const [pdfViewerUrl, setPdfViewerUrl] = useState<string>('');
  const [downloadUrl, setDownloadUrl] = useState<string>('');

  // Compute PDF viewer URL and download URL with HTTPS
  useEffect(() => {
    if (viewingFile) {
      const computeUrls = async () => {
        const { getApiUrl } = await import('@/app/utils/apiUrl');
        const apiUrl = getApiUrl();
        
        // Ensure file URL uses HTTPS
        let secureFileUrl = viewingFile.url;
        if (secureFileUrl.startsWith('http://')) {
          secureFileUrl = secureFileUrl.replace('http://', 'https://');
        }
        
        // Set download URL
        const secureDownloadUrl = `${apiUrl}/api/cpd/download-file?url=${encodeURIComponent(secureFileUrl)}&filename=${encodeURIComponent(viewingFile.name)}`;
        setDownloadUrl(secureDownloadUrl);
        
        // If it's a PDF, compute viewer URL
        if (viewingFile.url.includes('.pdf') || viewingFile.name.endsWith('.pdf')) {
          // If it's a Cloudinary URL, use proxy endpoint
          if (secureFileUrl.includes('cloudinary.com')) {
            const proxyUrl = `${apiUrl}/api/cpd/proxy-pdf?url=${encodeURIComponent(secureFileUrl)}`;
            setPdfViewerUrl(proxyUrl);
          } else {
            // Direct PDF URL with viewer parameters
            setPdfViewerUrl(`${secureFileUrl}#toolbar=1&navpanes=0&scrollbar=1`);
          }
        } else {
          setPdfViewerUrl('');
        }
      };
      computeUrls();
    } else {
      setPdfViewerUrl('');
      setDownloadUrl('');
    }
  }, [viewingFile]);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('lms-user') || 'null');
    if (user && user.id) {
      setUserId(user.id);
      const role = user.role || null;
      setUserRole(role as 'Admin' | 'Tutor' | 'Student' | null);
      loadCourseData(user.id);
    } else {
      setError('Please login to view this course');
      setLoading(false);
    }
  }, [courseId]);

  const loadCourseData = async (userId: number) => {
    try {
      setLoading(true);
      const data = await apiService.getCPDCourseForStudent(courseId, userId);
      
      if (data.success) {
        setCourse(data.course);
        setAnnouncements(data.announcements);
        setFaq(data.faq);
        setTopics(data.topics);
        setCanClaimCertificate(data.canClaimCertificate);
        
        // Auto-select first unlocked topic
        const firstUnlocked = data.topics.find((t: CPDTopic) => t.progress.is_unlocked === 1);
        if (firstUnlocked) {
          setSelectedTopic(firstUnlocked);
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
          console.error('Error checking certificate claims:', error);
        }
      } else {
        setError(data.message || 'Failed to load course');
      }
    } catch (error) {
      console.error('Error loading CPD course:', error);
      setError('Failed to load course data');
    } finally {
      setLoading(false);
    }
  };

  const handleClaimCertificate = () => {
    router.push(`/dashboard/student/cpd/${courseId}/claim-certificate`);
  };

  const getDownloadUrl = async (fileUrl: string, fileName: string) => {
    const { getApiUrl } = await import('@/app/utils/apiUrl');
    const apiUrl = getApiUrl();
    // Ensure fileUrl uses HTTPS if it's a Cloudinary URL
    const secureFileUrl = fileUrl && fileUrl.startsWith('http://') 
      ? fileUrl.replace('http://', 'https://')
      : fileUrl;
    return `${apiUrl}/api/cpd/download-file?url=${encodeURIComponent(secureFileUrl)}&filename=${encodeURIComponent(fileName)}`;
  };

  const handleStartQuiz = async (quizId: number, quizType: 'practice' | 'final') => {
    if (loadingQuiz) return; // Prevent multiple clicks
    
    setLoadingQuiz({ quizId, type: quizType });
    try {
      // Navigate to quiz taking page
      router.push(`/dashboard/student/cpd/${courseId}/quiz/${quizId}?type=${quizType}`);
    } catch (error) {
      console.error('Error starting quiz:', error);
      setLoadingQuiz(null);
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('word') || fileType.includes('doc')) return '📝';
    if (fileType.includes('powerpoint') || fileType.includes('ppt')) return '📊';
    if (fileType.includes('video') || fileType.includes('mp4')) return '🎥';
    return '📎';
  };

  const getDeadlineStatus = (deadline: string | null) => {
    if (!deadline) return null;
    
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const daysUntil = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntil < 0) {
      return { status: 'overdue', text: 'Overdue', color: 'text-red-600 bg-red-50 border-red-200', icon: '⚠️' };
    } else if (daysUntil === 0) {
      return { status: 'today', text: 'Due Today', color: 'text-orange-600 bg-orange-50 border-orange-200', icon: '🔔' };
    } else if (daysUntil <= 3) {
      return { status: 'urgent', text: `${daysUntil} days left`, color: 'text-orange-600 bg-orange-50 border-orange-200', icon: '⏰' };
    } else if (daysUntil <= 7) {
      return { status: 'upcoming', text: `${daysUntil} days left`, color: 'text-yellow-600 bg-yellow-50 border-yellow-200', icon: '📅' };
    } else {
      return { status: 'normal', text: `${daysUntil} days left`, color: 'text-blue-600 bg-blue-50 border-blue-200', icon: '📆' };
    }
  };

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['Student']} userRole={userRole}>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-lg">Loading course...</div>
        </div>
      </ProtectedRoute>
    );
  }

  if (error) {
    return (
      <ProtectedRoute allowedRoles={['Student']} userRole={userRole}>
        <div className="min-h-screen flex items-center justify-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['Student']} userRole={userRole}>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Course Header */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <button
              onClick={() => router.push('/dashboard/student')}
              className="text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-2"
            >
              ← Back to Dashboard
            </button>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{course?.title}</h1>
            <p className="text-gray-600">{course?.description}</p>
          </div>

          {/* General Sections */}
          <div className="space-y-4 mb-6">
            {announcements && (
              <details className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <summary className="cursor-pointer font-semibold text-gray-900 flex items-center justify-between">
                  <span className="text-2xl">📢</span>
                  General News & Announcements
                  <span className="ml-auto text-2xl">›</span>
                </summary>
                <div className="mt-4 pl-8">
                  <h3 className="font-medium">{announcements.title}</h3>
                  <p className="text-gray-600 mt-2">{announcements.description}</p>
                  {announcements.files && announcements.files.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {announcements.files.map((file: any) => (
                        <div
                          key={file.id}
                          onClick={() => setViewingFile({url: file.file_path, name: file.file_name})}
                          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 cursor-pointer"
                        >
                          {getFileIcon(file.file_type)} {file.file_name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </details>
            )}

            {faq && (
              <details className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <summary className="cursor-pointer font-semibold text-gray-900 flex items-center justify-between">
                  <span className="text-2xl">📂</span>
                  General FAQ
                  <span className="ml-auto text-2xl">›</span>
                </summary>
                <div className="mt-4 pl-8">
                  <p className="text-gray-700">{faq.content}</p>
                  {faq.files && faq.files.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {faq.files.map((file: any) => (
                        <div
                          key={file.id}
                          onClick={() => setViewingFile({url: file.file_path, name: file.file_name})}
                          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 cursor-pointer"
                        >
                          {getFileIcon(file.file_type)} {file.file_name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>

          {/* Topics List */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Course Modules</h2>
            <div className="space-y-3">
              {topics.map((topic) => {
                const deadlineInfo = getDeadlineStatus(topic.deadline);
                return (
                  <div
                    key={topic.id}
                    onClick={() => topic.progress.is_unlocked ? setSelectedTopic(topic) : null}
                    className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                      topic.progress.is_unlocked
                        ? 'border-blue-200 hover:border-blue-400 cursor-pointer bg-blue-50'
                        : 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                    } ${selectedTopic?.id === topic.id ? 'border-blue-500 bg-blue-100' : ''}`}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-2xl">📂</span>
                      <div className="flex-1">
                        <span className="text-sm text-blue-600 font-medium">Unit {topic.topic_number}</span>
                        <h3 className="font-medium text-gray-900">{topic.title}</h3>
                        {topic.deadline && (
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-xs text-gray-500">
                              Deadline: {new Date(topic.deadline).toLocaleDateString()}
                            </p>
                            {deadlineInfo && (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border ${deadlineInfo.color}`}>
                                {deadlineInfo.icon} {deadlineInfo.text}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {topic.progress.is_unlocked ? (
                      <span className="text-2xl">›</span>
                    ) : (
                      <span className="text-2xl">🔒</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Topic Content */}
          {selectedTopic && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">{selectedTopic.title}</h2>
                <button
                  onClick={() => setSelectedTopic(null)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ✕
                </button>
              </div>

              {selectedTopic.description && (
                <p className="text-gray-600 mb-6">{selectedTopic.description}</p>
              )}

              {/* Topic Files */}
              {selectedTopic.files && selectedTopic.files.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-3">Course Materials</h3>
                  <div className="space-y-2">
                    {selectedTopic.files.map((file: any) => (
                      <div
                        key={file.id}
                        onClick={() => setViewingFile({url: file.file_path, name: file.file_name})}
                        className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        <span className="text-3xl">{getFileIcon(file.file_type)}</span>
                        <div>
                          <p className="font-medium text-gray-900">{file.file_name}</p>
                          <p className="text-xs text-gray-500">
                            {file.file_type.includes('pdf') ? 'PDF Document' : 
                             file.file_type.includes('video') ? 'Video' : 'File'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quiz Section */}
              <div className="border-t pt-6">
                <h3 className="font-semibold text-gray-900 mb-4">Quizzes</h3>
                
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Practice Quiz */}
                  {(selectedTopic as any).practice_quiz ? (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">🧪</span>
                        <h4 className="font-semibold text-gray-900">Practice Quiz</h4>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">
                        {(selectedTopic as any).practice_quiz.title}
                      </p>
                      <p className="text-xs text-gray-500 mb-3">
                        Pass: {(selectedTopic as any).practice_quiz.passing_score}% • Unlimited attempts
                      </p>
                      {selectedTopic.progress.practice_quiz_attempted > 0 && (
                        <div className="mb-3 text-xs text-gray-600">
                          Best Score: {selectedTopic.progress.practice_quiz_best_score}%
                        </div>
                      )}
                      <LoadingButton
                        isLoading={loadingQuiz?.quizId === (selectedTopic as any).practice_quiz.id && loadingQuiz?.type === 'practice'}
                        onClick={() => handleStartQuiz((selectedTopic as any).practice_quiz.id, 'practice')}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                      >
                        {selectedTopic.progress.practice_quiz_attempted > 0 ? 'Retake Practice Quiz' : 'Start Practice Quiz'}
                      </LoadingButton>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">🧪</span>
                        <h4 className="font-semibold text-gray-500">Practice Quiz</h4>
                      </div>
                      <p className="text-sm text-gray-500">No practice quiz available</p>
                    </div>
                  )}

                  {/* Final Quiz */}
                  {(selectedTopic as any).final_quiz ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">🏁</span>
                        <h4 className="font-semibold text-gray-900">Final Test</h4>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">
                        {(selectedTopic as any).final_quiz.title}
                      </p>
                      <p className="text-xs text-gray-500 mb-3">
                        Pass: {(selectedTopic as any).final_quiz.passing_score}% • Required to unlock next topic
                      </p>
                      {selectedTopic.progress.final_quiz_attempted > 0 && (
                        <div className="mb-3">
                          <div className={`text-xs font-medium ${selectedTopic.progress.final_quiz_passed ? 'text-green-600' : 'text-red-600'}`}>
                            {selectedTopic.progress.final_quiz_passed ? '✓ Passed' : '✗ Not Passed'} - Score: {selectedTopic.progress.final_quiz_score}%
                          </div>
                        </div>
                      )}
                      <LoadingButton
                        isLoading={loadingQuiz?.quizId === (selectedTopic as any).final_quiz.id && loadingQuiz?.type === 'final'}
                        onClick={() => handleStartQuiz((selectedTopic as any).final_quiz.id, 'final')}
                        className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                      >
                        {selectedTopic.progress.final_quiz_attempted > 0 ? 'Retake Final Test' : 'Take Final Test'}
                      </LoadingButton>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">🏁</span>
                        <h4 className="font-semibold text-gray-500">Final Test</h4>
                      </div>
                      <p className="text-sm text-gray-500">No final test available</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Claim Certificate */}
          {canClaimCertificate && (
            hasCertificateClaim ? (
              // Already claimed - show success message
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-300 rounded-lg p-6 mt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">✅ Certificate Claimed!</h3>
                    <p className="text-gray-600">Congratulations! You have successfully claimed your certificate.</p>
                  </div>
                  <button
                    onClick={() => router.push('/dashboard/student/certificates')}
                    className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:shadow-lg font-semibold transition-all transform hover:scale-105"
                  >
                    View Certificate
                  </button>
                </div>
              </div>
            ) : (
              // Not claimed yet - show claim button
              <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-300 rounded-lg p-6 mt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">🎓 Congratulations!</h3>
                    <p className="text-gray-600">You've completed all modules. Claim your certificate now!</p>
                  </div>
                  <button
                    onClick={handleClaimCertificate}
                    className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold transition-all transform hover:scale-105"
                  >
                    Claim Certificate
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      </div>

          {/* PDF/File Viewer Modal */}
          {viewingFile && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg w-full max-w-6xl h-[90vh] flex flex-col">
                <div className="flex items-center justify-between p-4 border-b">
                  <h3 className="font-semibold text-lg">{viewingFile.name}</h3>
                  <div className="flex items-center gap-3">
                    <a
                      href={downloadUrl}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-2"
                    >
                      ⬇️ Download
                    </a>
                    <button
                      onClick={() => setViewingFile(null)}
                      className="text-gray-500 hover:text-gray-700 text-2xl"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              <div className="flex-1 overflow-hidden">
                {viewingFile.url.includes('.pdf') || viewingFile.name.endsWith('.pdf') ? (
                  <iframe
                    src={pdfViewerUrl}
                    className="w-full h-full"
                    title={viewingFile.name}
                    allow="fullscreen"
                    style={{ border: 'none' }}
                    onLoad={() => console.log('[CPD] PDF loaded successfully')}
                    onError={(e) => console.error('[CPD] PDF load error:', e)}
                  />
                ) : viewingFile.url.includes('.mp4') || viewingFile.url.includes('video') ? (
                <video controls className="w-full h-full">
                  <source src={viewingFile.url} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              ) : (
                <div className="flex flex-col items-center justify-center h-full">
                  <p className="text-gray-600 mb-4">This file type cannot be previewed</p>
                  <a
                    href={viewingFile.url}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Download File
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
};

export default StudentCPDCourse;

