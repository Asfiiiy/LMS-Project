'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiService } from '@/app/services/api';
import { showToast } from '@/app/components/Toast';
import ProtectedRoute from '@/app/components/ProtectedRoute';

interface CertificateClaim {
  id: number;
  course_id: number;
  course_title: string;
  course_type: 'cpd' | 'qualification';
  certificate_type: string;
  delivery_type: string;
  payment_status: 'pending' | 'completed' | 'failed';
  delivery_status: 'processing' | 'shipped' | 'delivered';
  total_price: string;
  claimed_at: string;
  courier_type?: string;
  level_name?: string;
}

interface DeliveredCertificate {
  id: number;
  claim_id: number;
  student_id: number;
  course_id: number;
  course_title: string;
  course_type: 'cpd' | 'qualification';
  certificate_pdf_url: string;
  transcript_pdf_url: string;
  registration_number: string;
  delivered_at: string;
  certificate_type?: string;
  cpd_course_level?: string;
}

interface Course {
  id: number;
  title: string;
  course_type: 'cpd' | 'qualification';
  completion_status?: string;
  status?: string;
}

type UserRole = 'Admin' | 'Tutor' | 'Manager' | 'Student' | 'Moderator' | 'ManagerStudent' | 'InstituteStudent' | null;

interface User {
  id?: number;
  name: string;
  role: UserRole;
}

function CertificatesPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [claims, setClaims] = useState<CertificateClaim[]>([]);
  const [deliveredCerts, setDeliveredCerts] = useState<DeliveredCertificate[]>([]);
  const [cpdCourses, setCpdCourses] = useState<Course[]>([]);
  const [qualificationCourses, setQualificationCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'claimed' | 'available'>('claimed');

  useEffect(() => {
    // Get user from localStorage
    const storedUserRaw = (() => {
      try {
        return JSON.parse(localStorage.getItem('lms-user') || 'null');
      } catch (err) {
        console.error('Unable to parse stored user:', err);
        return null;
      }
    })();

    if (storedUserRaw) {
      const normalizedId = Number(storedUserRaw.id);
      const normalizedUser = {
        ...storedUserRaw,
        id: Number.isFinite(normalizedId) ? normalizedId : undefined,
        name: storedUserRaw.name || 'Student',
        role: storedUserRaw.role || null
      } as User;

      setUser(normalizedUser);
      setUserRole(normalizedUser.role || null);

      if (normalizedUser.id) {
        fetchData(normalizedUser.id);
      } else {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const fetchData = async (studentId: number) => {
    try {
      setLoading(true);
      
      // Fetch claimed certificates
      const claimsResponse = await apiService.getMyMyCertificateClaims();
      if (claimsResponse.success) {
        setClaims(claimsResponse.claims);
      }

      // Fetch delivered certificates (generated & delivered)
      const deliveredResponse = await apiService.getMyDeliveredCertificates();
      if (deliveredResponse.success) {
        setDeliveredCerts(deliveredResponse.certificates);
      }

      // Fetch completed CPD courses
      const cpdResponse = await apiService.getStudentCPDCourses(studentId);
      if (cpdResponse.success) {
        const completedCPD = cpdResponse.cpdCourses.filter((c: any) => 
          c.completion_status === 'completed' || c.completion_status === 'passed'
        ).map((c: any) => ({
          id: c.course_id,
          title: c.course_title,
          course_type: 'cpd' as const,
          completion_status: c.completion_status
        }));
        setCpdCourses(completedCPD);
      }

      // Fetch completed Qualification courses
      const qualResponse = await apiService.getStudentQualificationCourses(studentId);
      if (qualResponse.success) {
        const completedQual = qualResponse.qualificationCourses.filter((c: any) => 
          c.completion_status === 'completed' || c.completion_status === 'passed' || c.status === 'Completed'
        ).map((c: any) => ({
          id: c.course_id,
          title: c.course_title,
          course_type: 'qualification' as const,
          completion_status: c.completion_status,
          status: c.status
        }));
        setQualificationCourses(completedQual);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
      showToast('Failed to load certificates', 'error');
    } finally {
      setLoading(false);
    }
  };

  const hasClaim = (courseId: number) => {
    return claims.some(claim => claim.course_id === courseId);
  };

  const getClaimForCourse = (courseId: number) => {
    return claims.find(claim => claim.course_id === courseId);
  };

  const handleClaimCertificate = (courseId: number, courseType: 'cpd' | 'qualification') => {
    router.push(`/dashboard/student/${courseType}/${courseId}/claim-certificate`);
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      processing: 'bg-blue-100 text-blue-800',
      shipped: 'bg-purple-100 text-purple-800',
      delivered: 'bg-green-100 text-green-800',
    };
    return statusColors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['Student', 'ManagerStudent', 'InstituteStudent']} userRole={userRole}>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-8 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#11CCEF]"></div>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['Student', 'ManagerStudent', 'InstituteStudent']} userRole={userRole}>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-8 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => router.push('/dashboard/student')}
              className="flex items-center gap-2 text-gray-600 hover:text-[#11CCEF] transition-colors mb-4"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Dashboard
            </button>
            
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center text-2xl shadow-lg">
                🏆
              </div>
              <h1 className="text-3xl md:text-4xl font-black text-gray-900">
                My Certificates
              </h1>
            </div>
            <p className="text-gray-600 ml-15">
              View your claimed certificates and claim new ones for completed courses
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mb-6 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('claimed')}
              className={`pb-3 px-4 font-semibold transition-all ${
                activeTab === 'claimed'
                  ? 'text-[#11CCEF] border-b-2 border-[#11CCEF]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Claimed Certificates ({claims.length})
            </button>
            <button
              onClick={() => setActiveTab('available')}
              className={`pb-3 px-4 font-semibold transition-all ${
                activeTab === 'available'
                  ? 'text-[#11CCEF] border-b-2 border-[#11CCEF]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Available to Claim ({cpdCourses.length + qualificationCourses.length})
            </button>
          </div>

          {/* Claimed Certificates Tab */}
          {activeTab === 'claimed' && (
            <div className="space-y-8">
              {/* Delivered Certificates Section */}
              {deliveredCerts.length > 0 && (
                <div>
                  <div className="mb-4">
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                      <span className="text-3xl">🎓</span>
                      Delivered Certificates
                    </h2>
                    <p className="text-gray-600 mt-1">Your certificates are ready! Download them anytime.</p>
                  </div>
                  
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {deliveredCerts.map((cert) => (
                      <div
                        key={cert.id}
                        className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all transform hover:scale-105 border-2 border-purple-200"
                      >
                        {/* Pink/Purple Success Banner - Certificate Delivered */}
                        <div className="bg-gradient-to-r from-purple-500 via-pink-500 to-pink-600 p-4 text-white text-center">
                          <div className="text-4xl mb-2 animate-pulse">🏆</div>
                          <h3 className="font-bold text-lg">Certificate Ready!</h3>
                          <p className="text-sm opacity-90">Registration: {cert.registration_number}</p>
                        </div>

                        <div className="p-6">
                          <h4 className="font-bold text-xl text-gray-900 mb-3 line-clamp-2">
                            {cert.course_title}
                          </h4>

                          <div className="space-y-2 mb-4">
                            {cert.cpd_course_level && (
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-gray-500">Level:</span>
                                <span className="font-medium">{cert.cpd_course_level}</span>
                              </div>
                            )}

                            {cert.certificate_type && (
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-gray-500">Type:</span>
                                <span className="font-medium">{cert.certificate_type}</span>
                              </div>
                            )}

                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-gray-500">Delivered:</span>
                              <span className="font-medium">
                                {new Date(cert.delivered_at).toLocaleDateString('en-GB', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                              </span>
                            </div>
                          </div>

                          {/* View & Download Buttons */}
                          <div className="space-y-2">
                            {/* Certificate Buttons */}
                            <div className="flex gap-2">
                              <a
                                href={cert.certificate_pdf_url + '?view=true'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-2 rounded-lg font-medium hover:shadow-lg transition-all text-sm"
                              >
                                👁️ View
                              </a>
                              <a
                                href={cert.certificate_pdf_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-2 rounded-lg font-medium hover:shadow-lg transition-all text-sm"
                              >
                                📜 Download
                              </a>
                            </div>
                            <div className="text-xs text-center text-gray-500">Certificate</div>

                            {/* Transcript Buttons */}
                            <div className="flex gap-2">
                              <a
                                href={cert.transcript_pdf_url + '?view=true'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-3 py-2 rounded-lg font-medium hover:shadow-lg transition-all text-sm"
                              >
                                👁️ View
                              </a>
                              <a
                                href={cert.transcript_pdf_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-3 py-2 rounded-lg font-medium hover:shadow-lg transition-all text-sm"
                              >
                                📄 Download
                              </a>
                            </div>
                            <div className="text-xs text-center text-gray-500">Transcript</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Processing Claims Section - Only show claims that are NOT delivered */}
              {(() => {
                // Filter out claims that are already delivered
                const processingClaims = claims.filter(claim => {
                  // Check if this claim has a delivered certificate
                  // Match by claim_id if available, otherwise match by course_id and student_id
                  const isDelivered = deliveredCerts.some(cert => {
                    if (cert.claim_id && cert.claim_id === claim.id) return true;
                    // Fallback: match by course_id and student_id
                    return cert.course_id === claim.course_id && cert.student_id === user?.id;
                  });
                  // Only show if payment is completed and not delivered
                  return claim.payment_status === 'completed' && !isDelivered;
                });

                return processingClaims.length > 0 ? (
                  <div>
                    <div className="mb-4">
                      <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <span className="text-3xl">⏳</span>
                        Processing Claims
                      </h2>
                      <p className="text-gray-600 mt-1">Your certificate claims are being processed</p>
                    </div>
                    
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {processingClaims.map((claim) => (
                        <div
                          key={claim.id}
                          className={`bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all transform hover:scale-105 ${
                            claim.course_type === 'qualification' 
                              ? 'border-2 border-blue-200' 
                              : 'border-2 border-green-200'
                          }`}
                        >
                          {/* Different banner based on course type */}
                          {claim.course_type === 'qualification' ? (
                            /* Light Blue/Pink Banner for Qualification - 30-day delivery */
                            <div className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 p-4 text-white text-center">
                              <div className="text-3xl mb-2 animate-bounce">📜</div>
                              <h3 className="font-bold text-lg">Certificate Approved!</h3>
                              <p className="text-sm opacity-90">Delivery in 30 Days</p>
                            </div>
                          ) : (
                            /* Green Success Banner for CPD - Payment Confirmed */
                            <div className="bg-gradient-to-r from-green-400 to-emerald-500 p-4 text-white text-center">
                              <div className="text-3xl mb-2 animate-bounce">🎉</div>
                              <h3 className="font-bold text-lg">Payment Confirmed!</h3>
                              <p className="text-sm opacity-90">Processing Certificate</p>
                            </div>
                          )}

                          <div className="p-6">
                            <h4 className="font-bold text-xl text-gray-900 mb-3 line-clamp-2">
                              {claim.course_title}
                            </h4>

                            <div className="space-y-2 mb-4">
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-gray-500">Type:</span>
                                <span className="font-medium capitalize">{claim.course_type}</span>
                              </div>

                              {claim.level_name && (
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="text-gray-500">Level:</span>
                                  <span className="font-medium">{claim.level_name}</span>
                                </div>
                              )}

                              {claim.certificate_type && (
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="text-gray-500">Certificate:</span>
                                  <span className="font-medium">{claim.certificate_type}</span>
                                </div>
                              )}

                              {claim.course_type !== 'qualification' && (
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="text-gray-500">Payment:</span>
                                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusBadge(claim.payment_status)}`}>
                                    {claim.payment_status}
                                  </span>
                                </div>
                              )}

                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-gray-500">Status:</span>
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusBadge(claim.delivery_status)}`}>
                                  {claim.delivery_status}
                                </span>
                              </div>
                            </div>

                            {claim.course_type === 'qualification' ? (
                              /* Qualification - 30-day delivery message */
                              <div className="bg-gradient-to-r from-blue-50 to-pink-50 border border-blue-200 rounded-lg p-3">
                                <p className="text-sm text-blue-900 flex items-center gap-2 font-medium">
                                  <span>📅</span>
                                  <span>Your certificate will be delivered within the next 30 days</span>
                                </p>
                                <p className="text-xs text-gray-600 mt-2">
                                  For inquiries, contact: <strong>info@inspirelondoncollege.co.uk</strong>
                                </p>
                              </div>
                            ) : (
                              /* CPD - Processing message */
                              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <p className="text-sm text-blue-800 flex items-center gap-2">
                                  <span>⏳</span>
                                  <span>Your certificate will be available for download once processing is complete</span>
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}

              {/* No Claims Yet */}
              {(() => {
                const processingClaims = claims.filter(claim => {
                  const isDelivered = deliveredCerts.some(cert => {
                    if (cert.claim_id && cert.claim_id === claim.id) return true;
                    return cert.course_id === claim.course_id && cert.student_id === user?.id;
                  });
                  return claim.payment_status === 'completed' && !isDelivered;
                });
                return processingClaims.length === 0 && deliveredCerts.length === 0;
              })() && (
                <div className="bg-white rounded-3xl shadow-lg p-12 text-center">
                  <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">No Certificates Claimed Yet</h3>
                  <p className="text-gray-600 mb-6">
                    Complete your courses and claim your certificates to showcase your achievements!
                  </p>
                  <button
                    onClick={() => setActiveTab('available')}
                    className="bg-gradient-to-r from-[#11CCEF] to-[#E51791] text-white px-8 py-3 rounded-xl font-semibold hover:shadow-lg transform hover:scale-105 transition-all"
                  >
                    View Available Certificates
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Available to Claim Tab */}
          {activeTab === 'available' && (
            <div>
              {cpdCourses.length === 0 && qualificationCourses.length === 0 ? (
                <div className="bg-white rounded-3xl shadow-lg p-12 text-center">
                  <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">No Completed Courses</h3>
                  <p className="text-gray-600 mb-6">
                    Complete your enrolled courses to unlock certificate claims!
                  </p>
                  <button
                    onClick={() => router.push('/dashboard/student')}
                    className="bg-gradient-to-r from-[#11CCEF] to-[#E51791] text-white px-8 py-3 rounded-xl font-semibold hover:shadow-lg transform hover:scale-105 transition-all"
                  >
                    Go to My Courses
                  </button>
                </div>
              ) : (
                <div>
                  {/* CPD Courses */}
                  {cpdCourses.length > 0 && (
                    <div className="mb-8">
                      <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <span className="text-2xl">📚</span>
                        CPD Courses ({cpdCourses.length})
                      </h3>
                      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {cpdCourses.map((course) => {
                          const claimed = hasClaim(course.id);
                          return (
                            <div
                              key={course.id}
                              className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all"
                            >
                              <div className="p-6">
                                <h4 className="font-bold text-xl text-gray-900 mb-4 line-clamp-2">
                                  {course.title}
                                </h4>

                                {claimed ? (
                                  <div className="text-center py-4">
                                    <div className="text-4xl mb-3">✅</div>
                                    <p className="font-semibold text-green-600 mb-2">Already Claimed!</p>
                                    <button
                                      onClick={() => setActiveTab('claimed')}
                                      className="text-sm text-[#11CCEF] hover:underline"
                                    >
                                      View Certificate
                                    </button>
                                  </div>
                                ) : (
                                  <div className="text-center py-4">
                                    <div className="text-5xl mb-3 animate-bounce">🎓</div>
                                    <p className="font-semibold text-gray-700 mb-4">Ready to Claim!</p>
                                    <button
                                      onClick={() => handleClaimCertificate(course.id, 'cpd')}
                                      className="w-full bg-gradient-to-r from-[#11CCEF] to-[#E51791] text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transform hover:scale-105 transition-all"
                                    >
                                      Claim Now 🚀
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Qualification Courses */}
                  {qualificationCourses.length > 0 && (
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <span className="text-2xl">🎯</span>
                        Qualification Courses ({qualificationCourses.length})
                      </h3>
                      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {qualificationCourses.map((course) => {
                          const claimed = hasClaim(course.id);
                          return (
                            <div
                              key={course.id}
                              className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all"
                            >
                              <div className="p-6">
                                <h4 className="font-bold text-xl text-gray-900 mb-4 line-clamp-2">
                                  {course.title}
                                </h4>

                                {claimed ? (
                                  <div className="text-center py-4">
                                    <div className="text-4xl mb-3">✅</div>
                                    <p className="font-semibold text-green-600 mb-2">Already Claimed!</p>
                                    <button
                                      onClick={() => setActiveTab('claimed')}
                                      className="text-sm text-[#11CCEF] hover:underline"
                                    >
                                      View Certificate
                                    </button>
                                  </div>
                                ) : (
                                  <div className="text-center py-4">
                                    <div className="text-5xl mb-3 animate-bounce">🎓</div>
                                    <p className="font-semibold text-gray-700 mb-4">Ready to Claim!</p>
                                    <button
                                      onClick={() => handleClaimCertificate(course.id, 'qualification')}
                                      className="w-full bg-gradient-to-r from-[#11CCEF] to-[#E51791] text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transform hover:scale-105 transition-all"
                                    >
                                      Claim Now 🚀
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}

export default CertificatesPage;

