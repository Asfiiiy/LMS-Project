'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiService } from '@/app/services/api';
import ProtectedRoute from '@/app/components/ProtectedRoute';

export default function ViewQualificationUnit() {
  const params = useParams();
  const router = useRouter();
  const unitId = parseInt(params.unitId as string);
  
  const [userRole, setUserRole] = useState<'Admin' | 'Tutor' | 'Student' | null>(null);
  const [unit, setUnit] = useState<any>(null);
  const [lectures, setLectures] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [readings, setReadings] = useState<any[]>([]);
  const [assignmentBrief, setAssignmentBrief] = useState<any>(null);
  const [briefFiles, setBriefFiles] = useState<any[]>([]);
  const [presentationBrief, setPresentationBrief] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // PDF Viewer State
  const [pdfSrc, setPdfSrc] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('lms-user') || 'null');
    const role = user?.role || null;
    setUserRole(role as 'Admin' | 'Tutor' | 'Student' | null);
    loadUnitData();
  }, [unitId]);

  const loadUnitData = async () => {
    try {
      setLoading(true);
      const response = await apiService.getQualificationUnit(unitId);
      
      if (response.success) {
        setUnit(response.unit);
        setLectures(response.announcements || []);
        setTopics(response.topics || []);
        setReadings(response.readings || []);
        setAssignmentBrief(response.assignmentBrief || null);
        setBriefFiles(response.briefFiles || []);
        setPresentationBrief(response.presentationBrief || null);
      } else {
        alert('Failed to load unit data');
      }
    } catch (error) {
      console.error('Error loading unit:', error);
      alert('Error loading unit data');
    } finally {
      setLoading(false);
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

  const handleFileClick = (filePath: string, fileName: string, e: React.MouseEvent) => {
    e.preventDefault();
    console.log('[Unit View] File clicked:', fileName);
    console.log('[Unit View] File path:', filePath);
    
    const fileExtension = fileName.toLowerCase().split('.').pop();
    
    // For PDFs, open in viewer modal using proxy for inline display
    if (fileExtension === 'pdf') {
      console.log('[Unit View] Opening PDF in viewer');
      setPdfLoading(true);
      setPdfError(false);
      // Use proxy to force inline display instead of download
      const proxyUrl = `${API_BASE_URL}/admin/proxy-pdf?url=${encodeURIComponent(filePath)}`;
      setPdfSrc(proxyUrl);
    } else {
      // For other files, open in new tab
      console.log('[Unit View] Opening non-PDF in new tab');
      window.open(filePath, '_blank');
    }
  };

  const closePdfViewer = () => {
    setPdfSrc('');
    setPdfLoading(false);
    setPdfError(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading unit...</div>
      </div>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['Admin', 'Tutor']} userRole={userRole}>
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 p-6">
        <div className="max-w-7xl mx-auto">
          
          {/* Header */}
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-6 border-t-4 border-purple-600">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                  <span className="text-4xl">📖</span>
                  {unit?.title || 'Unit View'}
                </h1>
                <p className="text-gray-600 mt-2">
                  {unit?.content || 'View all unit content, lectures, topics, and assignments'}
                </p>
              </div>
              <button
                onClick={() => router.back()}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                ← Back
              </button>
            </div>

            {/* Unit Stats */}
            <div className="grid grid-cols-4 gap-4 mt-6">
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600">{lectures.length}</div>
                <div className="text-sm text-gray-600">Lectures</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600">{topics.length}</div>
                <div className="text-sm text-gray-600">Topics</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-yellow-600">{readings.length}</div>
                <div className="text-sm text-gray-600">Readings</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-600">
                  {(unit?.enable_assignment_submission ? 1 : 0) + (unit?.enable_presentation_submission ? 1 : 0)}
                </div>
                <div className="text-sm text-gray-600">Submissions</div>
              </div>
            </div>
          </div>

          {/* Unit Introduction/Details */}
          {(unit?.disclaimer || unit?.general_information) && (
            <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <span className="text-3xl">ℹ️</span>
                Unit Information
              </h2>
              {unit.disclaimer && (
                <div className="mb-4 bg-yellow-50 border-l-4 border-yellow-400 p-4">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">⚠️ Disclaimer</h3>
                  <p className="text-gray-700">{unit.disclaimer}</p>
                </div>
              )}
              {unit.general_information && (
                <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">📋 General Information</h3>
                  <p className="text-gray-700">{unit.general_information}</p>
                </div>
              )}
            </div>
          )}

          {/* Lectures Section - Only show if there are lectures */}
          {lectures.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <span className="text-3xl">🎓</span>
                Lectures ({lectures.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {lectures.map((lecture, index) => (
                  <div
                    key={lecture.id || index}
                    className="border-2 border-gray-200 rounded-xl p-6 hover:border-green-300 transition-all bg-gradient-to-br from-white to-green-50"
                  >
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{lecture.title}</h3>
                    {lecture.content && (
                      <p className="text-gray-600 mb-4">{lecture.content}</p>
                    )}
                    {lecture.file_path && (
                      <div className="mt-4">
                        <button
                          onClick={(e) => handleFileClick(lecture.file_path, lecture.file_name || '', e)}
                          className="inline-flex items-center gap-2 bg-green-50 px-4 py-2 rounded-lg border border-green-200 hover:bg-green-100 transition-colors cursor-pointer"
                        >
                          <span className="text-2xl">{getFileIcon(lecture.file_name || '')}</span>
                          <span className="text-sm font-semibold text-gray-700">{lecture.file_name}</span>
                          <span className="text-xs text-gray-500">View</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Topics Section - Only show if there are topics */}
          {topics.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <span className="text-3xl">📚</span>
                Topics ({topics.length})
              </h2>
              <div className="space-y-4">
                {topics.map((topic) => (
                  <div
                    key={topic.id}
                    className="border-2 border-gray-200 rounded-xl p-6 hover:border-blue-300 transition-all bg-gradient-to-r from-white to-blue-50"
                  >
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      Topic {topic.topic_number}: {topic.title}
                    </h3>
                    {topic.description && (
                      <p className="text-gray-600 mb-4">{topic.description}</p>
                    )}
                    {topic.deadline && (
                      <p className="text-sm text-orange-600 mb-3">
                        ⏰ Due: {new Date(topic.deadline).toLocaleDateString()}
                      </p>
                    )}
                    {topic.files && topic.files.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm font-semibold text-gray-700 mb-2">📎 Files:</p>
                        <div className="grid grid-cols-2 gap-2">
                          {topic.files.map((file: any, idx: number) => (
                            <a
                              key={idx}
                              href={file.file_path}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors"
                            >
                              <span>{getFileIcon(file.file_name)}</span>
                              <span className="text-sm text-gray-700 flex-1 truncate">{file.file_name}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Additional Reading Section - Only show if there are readings */}
          {readings.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <span className="text-3xl">📖</span>
                Additional Reading ({readings.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {readings.map((reading, index) => (
                  <a
                    key={reading.id || index}
                    href={reading.file_path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border-2 border-gray-200 rounded-xl p-6 hover:border-yellow-300 transition-all bg-gradient-to-br from-white to-yellow-50 flex flex-col items-center text-center"
                  >
                    <span className="text-4xl mb-3">{getFileIcon(reading.file_name)}</span>
                    <p className="font-semibold text-gray-900 text-sm mb-2">{reading.title || reading.file_name}</p>
                    <span className="text-xs text-blue-600 hover:underline">Download</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Assignment Brief Section - Only show if brief exists */}
          {assignmentBrief && (
            <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <span className="text-3xl">📝</span>
                Assignment Brief
              </h2>
              <div className="bg-orange-50 p-6 rounded-xl border-2 border-orange-200">
                <h3 className="text-xl font-bold text-gray-900 mb-3">{assignmentBrief.heading || 'Assignment Brief'}</h3>
                {assignmentBrief.description && (
                  <p className="text-gray-700 mb-4">{assignmentBrief.description}</p>
                )}
                {assignmentBrief.important_note && (
                  <div className="bg-white p-4 rounded-lg border-l-4 border-orange-500 mb-4">
                    <p className="text-sm font-semibold text-gray-700 mb-1">⚠️ Important Note:</p>
                    <p className="text-sm text-gray-600">{assignmentBrief.important_note}</p>
                  </div>
                )}
                <div className="mb-4">
                  <span className="inline-block bg-orange-100 px-3 py-1 rounded-full text-sm font-semibold text-orange-800">
                    Grading: {assignmentBrief.grading_type === 'score' ? `Score (Pass: ${assignmentBrief.passing_score}%)` : 'Pass/Fail'}
                  </span>
                </div>
                {briefFiles.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-semibold text-gray-700 mb-3">📎 Brief Files:</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {briefFiles.map((file, idx) => (
                        <a
                          key={idx}
                          href={file.file_path}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 bg-white px-4 py-3 rounded-lg border border-orange-300 hover:border-orange-400 transition-colors"
                        >
                          <span className="text-2xl">{getFileIcon(file.file_name)}</span>
                          <span className="text-sm text-gray-700 flex-1">{file.file_name}</span>
                          <span className="text-xs text-blue-600">ownload</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Presentation Brief Section - Only show if brief exists */}
          {presentationBrief && (
            <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <span className="text-3xl">🎤</span>
                Presentation Brief
              </h2>
              <div className="bg-pink-50 p-6 rounded-xl border-2 border-pink-200">
                <h3 className="text-xl font-bold text-gray-900 mb-3">{presentationBrief.heading || 'Presentation Brief'}</h3>
                {presentationBrief.description && (
                  <p className="text-gray-700 mb-4">{presentationBrief.description}</p>
                )}
                {presentationBrief.important_note && (
                  <div className="bg-white p-4 rounded-lg border-l-4 border-pink-500">
                    <p className="text-sm font-semibold text-gray-700 mb-1">⚠️ Important Note:</p>
                    <p className="text-sm text-gray-600">{presentationBrief.important_note}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* PDF Viewer Modal */}
        {pdfSrc && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg w-11/12 h-5/6 flex flex-col">
              {/* Header with close button */}
              <div className="flex justify-between items-center p-4 border-b">
                <h3 className="text-lg font-semibold">PDF Viewer</h3>
                <button
                  onClick={closePdfViewer}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* PDF iframe */}
              <div className="flex-1 relative">
                {pdfLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                    <div className="text-lg">Loading PDF...</div>
                  </div>
                )}
                {pdfError && (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-lg text-red-600">Error loading PDF</div>
                  </div>
                )}
                <iframe
                  src={pdfSrc}
                  className="w-full h-full"
                  title="PDF Viewer"
                  allow="fullscreen"
                  style={{ border: 'none' }}
                  onLoad={() => {
                    console.log('[Unit View] PDF loaded successfully');
                    setPdfLoading(false);
                  }}
                  onError={() => {
                    console.error('[Unit View] PDF load error');
                    setPdfError(true);
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}

