'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { apiService } from '@/app/services/api';
import { getApiUrl } from '@/app/utils/apiUrl';

export default function PendingSubmissionsPage() {
  const params = useParams();
  const router = useRouter();
  const subTutorId = params?.subTutorId as string;
  
  const [user, setUser] = useState<any>(null);
  const [tutorInfo, setTutorInfo] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFileModal, setShowFileModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
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

  const fetchData = async (tutorId: number) => {
    try {
      setLoading(true);
      const response = await apiService.getSubTutorStatsDetails(
        tutorId,
        parseInt(subTutorId),
        'pending'
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
  
  // Paginate submissions
  const totalSubmissions = submissions.length;
  const totalPages = Math.ceil(totalSubmissions / limit);
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedSubmissions = submissions.slice(startIndex, endIndex);

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
                  style={{ color: '#E51791' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#FC98D3C9';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <span>←</span> Back to Team
                </button>
                <h1 className="text-3xl font-bold" style={{ color: '#1E1E1E' }}>
                  Pending Submissions
                </h1>
                {tutorInfo && (
                  <p className="text-sm mt-2" style={{ color: '#1E1E1E70' }}>
                    {tutorInfo.name} ({tutorInfo.email})
                  </p>
                )}
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold" style={{ color: '#E51791' }}>
                  {submissions.length}
                </div>
                <div className="text-sm" style={{ color: '#1E1E1E70' }}>
                  Awaiting Review
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
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: '#E51791' }}></div>
                <p className="text-lg" style={{ color: '#1E1E1E60' }}>Loading submissions...</p>
              </div>
            </div>
          ) : totalSubmissions === 0 ? (
            <div className="text-center py-20">
              <p className="text-xl" style={{ color: '#1E1E1E60' }}>
                No pending submissions
              </p>
            </div>
          ) : (
            <>
              {/* Pagination Info */}
              <div className="flex justify-between items-center mb-4 text-sm" style={{ color: '#1E1E1E60' }}>
                <span>
                  Showing {totalSubmissions > 0 ? startIndex + 1 : 0} to {Math.min(endIndex, totalSubmissions)} of {totalSubmissions} submission(s)
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

              <div className="space-y-4">
                {paginatedSubmissions.map((item, index) => (
                <div
                  key={index}
                  className="bg-white rounded-lg p-6 transition-all"
                  style={{
                    border: '1px solid #1E1E1E20',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#FC98D3C9';
                    e.currentTarget.style.borderColor = '#E51791';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#FFFFFF';
                    e.currentTarget.style.borderColor = '#1E1E1E20';
                  }}
                >
                  {/* Student Info */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-xl" style={{ color: '#1E1E1E' }}>
                        {item.student_name}
                      </h3>
                      <p className="text-sm" style={{ color: '#1E1E1E70' }}>
                        {item.student_email}
                      </p>
                    </div>
                    <span
                      className="px-4 py-2 rounded-full text-sm font-medium"
                      style={{
                        backgroundColor: '#FC98D3C9',
                        color: '#E51791',
                      }}
                    >
                      Pending Review
                    </span>
                  </div>

                  {/* Course and Unit Info */}
                  <div className="grid grid-cols-2 gap-6 mb-4">
                    <div>
                      <p className="text-xs font-semibold mb-1" style={{ color: '#1E1E1E60' }}>
                        COURSE
                      </p>
                      <p className="text-base font-medium" style={{ color: '#1E1E1E' }}>
                        {item.course_title}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold mb-1" style={{ color: '#1E1E1E60' }}>
                        UNIT
                      </p>
                      <p className="text-base font-medium" style={{ color: '#1E1E1E' }}>
                        {item.unit_title}
                      </p>
                    </div>
                  </div>

                  {/* Submission Details */}
                  <div className="grid grid-cols-3 gap-6 mb-4">
                    <div>
                      <p className="text-xs font-semibold mb-1" style={{ color: '#1E1E1E60' }}>
                        SUBMISSION TYPE
                      </p>
                      <p className="text-base capitalize" style={{ color: '#1E1E1E' }}>
                        {item.submission_type}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold mb-1" style={{ color: '#1E1E1E60' }}>
                        FILE NAME
                      </p>
                      <p className="text-base truncate" style={{ color: '#E51791' }}>
                        {item.file_name}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold mb-1" style={{ color: '#1E1E1E60' }}>
                        SUBMITTED AT
                      </p>
                      <p className="text-base" style={{ color: '#1E1E1E' }}>
                        {new Date(item.submitted_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  {/* Submission File */}
                  {item.file_path && (
                    <div className="pt-4" style={{ borderTop: '1px solid #1E1E1E20' }}>
                      <p className="text-xs font-semibold mb-2" style={{ color: '#1E1E1E60' }}>
                        SUBMITTED FILE
                      </p>
                      <button
                        onClick={() => {
                          const apiUrl = getApiUrl();
                          const secureFilePath = item.file_path && item.file_path.startsWith('http://')
                            ? item.file_path.replace('http://', 'https://')
                            : item.file_path;
                          const proxyUrl = `${apiUrl}/api/admin/proxy-pdf?url=${encodeURIComponent(secureFilePath)}`;
                          setSelectedFile(proxyUrl);
                          setSelectedFileName(item.file_name || 'Submission File');
                          setShowFileModal(true);
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
                        style={{
                          backgroundColor: '#E51791',
                          color: '#FFFFFF',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#11CCEF';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#E51791';
                        }}
                      >
                        <span>📄</span>
                        <span>View Submission</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-6">
                  <button
                    onClick={() => setPage(prev => Math.max(1, prev - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: page === 1 ? '#1E1E1E10' : '#E51791',
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
                      backgroundColor: page === totalPages ? '#1E1E1E10' : '#E51791',
                      color: page === totalPages ? '#1E1E1E40' : '#FFFFFF'
                    }}
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
        
        {/* File Viewer Modal */}
        {showFileModal && selectedFile && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
            onClick={() => {
              setShowFileModal(false);
              setSelectedFile(null);
            }}
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
              <div className="flex-1 overflow-hidden">
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

