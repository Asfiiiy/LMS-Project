'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiService } from '@/app/services/api';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { UserRole } from '@/app/components/types';

interface StudentProfile {
  user_id: number;
  name: string;
  email: string;
  gender?: string;
  date_of_birth?: string;
  nationality?: string;
  ethnicity?: string;
  current_role?: string;
  previous_qualification?: string;
  motivation?: string;
  vark_visual?: number;
  vark_auditory?: number;
  vark_reading?: number;
  vark_kinesthetic?: number;
  english_literacy?: string;
  ict_skills?: string;
  special_learning_needs?: string;
  profile_picture?: string;
  is_profile_complete?: number;
  profile_completed_at?: string | null;
  updated_at?: string | null;
}

interface PaymentInstallment {
  id: number;
  course_id: number;
  course_title: string;
  installment_number: number;
  installment_name: string;
  amount: number;
  due_date: string | null;
  status: 'paid' | 'due' | 'overdue';
  paid_at: string | null;
  payment_reference: string | null;
  notes: string | null;
  payment_type: 'all_paid' | 'installment';
  created_at: string;
  updated_at: string;
}

interface ProgressUnit {
  unit_id: number;
  unit_title: string;
  is_completed: boolean;
  pass_fail_result: string | null;
  unit_status?: 'locked' | 'in_progress' | 'submitted_for_grading' | 'pass' | 'refer';
}

interface ProgressCourse {
  course_id: number;
  course_title: string;
  total_units: number;
  completed_units: number;
  units: ProgressUnit[];
}

interface CertificateClaimRow {
  id: number;
  course_id: number;
  course_title: string;
  course_type: string;
  payment_status: string;
  payment_amount?: number | null;
  delivery_status: string;
  claimed_at: string | null;
  created_at?: string;
}

const CertificateManagerStudentDetailPage = () => {
  const params = useParams();
  const router = useRouter();
  const studentId = parseInt(params.studentId as string, 10);

  const [userRole, setUserRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [payments, setPayments] = useState<PaymentInstallment[]>([]);
  const [activeTab, setActiveTab] = useState<'profile' | 'payments' | 'progress'>('profile');
  const [progressCourses, setProgressCourses] = useState<ProgressCourse[]>([]);
  const [progressLoading, setProgressLoading] = useState(false);
  const [claimsList, setClaimsList] = useState<CertificateClaimRow[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(false);

  useEffect(() => {
    const u = localStorage.getItem('lms-user');
    if (u) {
      try {
        const user = JSON.parse(u);
        setUserRole((user.role as UserRole) || null);
      } catch {
        setUserRole(null);
      }
    }
  }, []);

  useEffect(() => {
    if (studentId) fetchData();
  }, [studentId]);

  useEffect(() => {
    if (!studentId) return;
    const loadProgress = async () => {
      setProgressLoading(true);
      try {
        const res = await apiService.getStudentAcademicProgress(studentId);
        if (res?.success && res.courses) setProgressCourses(res.courses);
        else setProgressCourses([]);
      } catch {
        setProgressCourses([]);
      } finally {
        setProgressLoading(false);
      }
    };
    const loadClaims = async () => {
      setClaimsLoading(true);
      try {
        const res = await apiService.getCertificateClaims({ student_id: studentId, limit: 500 });
        if (res?.success && res.claims) setClaimsList(res.claims);
        else setClaimsList([]);
      } catch {
        setClaimsList([]);
      } finally {
        setClaimsLoading(false);
      }
    };
    loadProgress();
    loadClaims();
  }, [studentId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');

      const [profileResponse, paymentsResponse] = await Promise.all([
        apiService.getStudentProfileById(studentId),
        apiService.getStudentInstallmentsByAdmin(studentId)
      ]);

      if (profileResponse?.success) {
        setProfile(profileResponse.profile);
      } else {
        setError('Failed to load student profile');
      }

      if (paymentsResponse?.success) {
        setPayments(paymentsResponse.installments || []);
      }
    } catch (err) {
      setError('Failed to load student data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not set';
    try {
      return new Date(dateString).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      case 'due':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const paymentsByCourse = payments.reduce((acc, payment) => {
    if (!acc[payment.course_id]) {
      acc[payment.course_id] = {
        course_id: payment.course_id,
        course_title: payment.course_title,
        payments: []
      };
    }
    acc[payment.course_id].payments.push(payment);
    return acc;
  }, {} as Record<number, { course_id: number; course_title: string; payments: PaymentInstallment[] }>);

  // While role not yet read from storage, show loading to avoid flashing Access Denied
  if (userRole === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#11CCEF] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['Certificate Manager']} userRole={userRole}>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#11CCEF] mx-auto mb-4"></div>
            <p className="text-gray-600">Loading student data...</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (error || !profile) {
    return (
      <ProtectedRoute allowedRoles={['Certificate Manager']} userRole={userRole}>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-600 mb-4">{error || 'Student not found'}</p>
            <button
              onClick={() => router.push('/dashboard/certificate-manager')}
              className="px-4 py-2 bg-[#11CCEF] text-white rounded-lg hover:bg-[#0daed9]"
            >
              Back to Certificate Manager
            </button>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['Certificate Manager']} userRole={userRole}>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                {profile.profile_picture ? (
                  <img
                    src={profile.profile_picture}
                    alt={profile.name}
                    className="h-16 w-16 rounded-full object-cover border-2 border-[#11CCEF]"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-[#11CCEF] flex items-center justify-center text-white text-2xl font-bold border-2 border-[#11CCEF]">
                    {profile.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">{profile.name}</h1>
                  <p className="text-gray-600">{profile.email}</p>
                </div>
              </div>
              <button
                onClick={() => router.push('/dashboard/certificate-manager')}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                ← Back to Certificate Manager
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-xl shadow-lg mb-6">
            <div className="border-b border-gray-200">
              <nav className="flex -mb-px">
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'profile'
                      ? 'border-[#11CCEF] text-[#11CCEF]'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Profile
                </button>
                <button
                  onClick={() => setActiveTab('payments')}
                  className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'payments'
                      ? 'border-[#11CCEF] text-[#11CCEF]'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Payments ({payments.length})
                </button>
                <button
                  onClick={() => setActiveTab('progress')}
                  className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'progress'
                      ? 'border-[#11CCEF] text-[#11CCEF]'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Track Progress
                </button>
              </nav>
            </div>
          </div>

          {/* Content */}
          {activeTab === 'profile' && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                    Personal Information
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Gender</label>
                      <p className="text-gray-900">{profile.gender || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Date of Birth</label>
                      <p className="text-gray-900">
                        {profile.date_of_birth
                          ? new Date(profile.date_of_birth).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric'
                            })
                          : 'Not provided'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Nationality</label>
                      <p className="text-gray-900">{profile.nationality || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Ethnicity</label>
                      <p className="text-gray-900">{profile.ethnicity || 'Not provided'}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                    Professional Information
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Current Role</label>
                      <p className="text-gray-900">{profile.current_role || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Previous Qualification</label>
                      <p className="text-gray-900 whitespace-pre-wrap">
                        {profile.previous_qualification || 'Not provided'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Motivation</label>
                      <p className="text-gray-900 whitespace-pre-wrap">
                        {profile.motivation || 'Not provided'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 md:col-span-2">
                  <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                    Learning Style (VARK)
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'Visual', value: profile.vark_visual || 0 },
                      { label: 'Auditory', value: profile.vark_auditory || 0 },
                      { label: 'Reading', value: profile.vark_reading || 0 },
                      { label: 'Kinesthetic', value: profile.vark_kinesthetic || 0 }
                    ].map((score) => (
                      <div key={score.label} className="bg-gray-50 p-4 rounded-lg">
                        <div className="text-sm font-medium text-gray-500 mb-2">{score.label}</div>
                        <div className="text-2xl font-bold text-[#11CCEF]">{score.value}</div>
                        <div className="mt-2 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-[#11CCEF] h-2 rounded-full"
                            style={{ width: `${(score.value / 20) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 md:col-span-2">
                  <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                    Skills & Learning Needs
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">English & Literacy</label>
                      <p className="text-gray-900">{profile.english_literacy || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">ICT Skills</label>
                      <p className="text-gray-900">{profile.ict_skills || 'Not provided'}</p>
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-gray-500">Special Learning Needs</label>
                      <p className="text-gray-900 whitespace-pre-wrap">
                        {profile.special_learning_needs || 'None identified'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Profile Status</label>
                      <p className="text-gray-900">
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            profile.is_profile_complete === 1
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {profile.is_profile_complete === 1 ? 'Complete' : 'Incomplete'}
                        </span>
                      </p>
                    </div>
                    {profile.profile_completed_at && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Completed At</label>
                        <p className="text-gray-900">
                          {new Date(profile.profile_completed_at).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'payments' && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              {payments.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-4">💳</div>
                  <p className="text-gray-500 text-lg">No payment installments found for this student.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.values(paymentsByCourse).map((courseGroup) => (
                    <div key={courseGroup.course_id} className="border border-gray-200 rounded-lg p-6">
                      <h3 className="text-xl font-bold text-gray-900 mb-4">{courseGroup.course_title}</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">No.</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Installment</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paid At</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {courseGroup.payments.map((payment) => (
                              <tr key={payment.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm text-gray-900">{payment.installment_number}</td>
                                <td className="px-4 py-3 text-sm text-gray-900">{payment.installment_name}</td>
                                <td className="px-4 py-3 text-sm font-medium text-gray-900">{formatCurrency(payment.amount)}</td>
                                <td className="px-4 py-3 text-sm text-gray-500">{formatDate(payment.due_date)}</td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(payment.status)}`}>
                                    {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500">{payment.paid_at ? formatDate(payment.paid_at) : '-'}</td>
                                <td className="px-4 py-3 text-sm text-gray-500">{payment.payment_reference || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'progress' && (
            <div className="bg-white rounded-xl shadow-lg p-6 space-y-8">
              {/* Live report: Course completed + certificate (available / claimed, payment done, delivered) */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-4">
                  Course completion & certificate (live data)
                </h3>
                {(progressLoading || claimsLoading) && progressCourses.length === 0 && claimsList.length === 0 ? (
                  <div className="py-8 text-center text-gray-500">Loading...</div>
                ) : (
                  <div className="space-y-6">
                    {/* Qualification courses from progress: show units (Locked / In progress / Submitted for grading / Pass / Refer) + certificate */}
                    {progressCourses.length > 0 && (
                      <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Qualification courses</h4>
                        {progressCourses.map((course) => {
                      const allPassed = course.units.length > 0 && course.units.every((u) => u.is_completed && (u.pass_fail_result === 'pass' || !u.pass_fail_result));
                      const claim = claimsList.find((c) => c.course_id === course.course_id);
                      const paymentDone = claim && (claim.payment_status || '').toLowerCase() === 'completed';
                      const delivery = (claim?.delivery_status || '').toLowerCase();
                      const isDelivered = delivery === 'delivered' || delivery === 'ready';
                      const paidAmount = claim?.payment_amount != null ? formatCurrency(Number(claim.payment_amount)) : null;
                      return (
                        <div key={course.course_id} className="border border-gray-200 rounded-lg overflow-hidden">
                          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-wrap gap-2">
                            <h4 className="font-semibold text-gray-900">{course.course_title}</h4>
                            <span className="text-sm text-gray-600">
                              {course.completed_units} / {course.total_units} units
                              {allPassed && (
                                <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 whitespace-nowrap">
                                  Course completed
                                </span>
                              )}
                            </span>
                          </div>
                          <ul className="divide-y divide-gray-100">
                            {course.units.map((unit) => {
                              // Qualification: Locked | In progress | Submitted for grading | Pass | Refer
                              const status = unit.unit_status || (unit.pass_fail_result?.toLowerCase() === 'refer' ? 'refer' : unit.pass_fail_result?.toLowerCase() === 'pass' || unit.is_completed ? 'pass' : 'locked');
                              const statusBadge =
                                status === 'pass' ? (
                                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 whitespace-nowrap">Pass</span>
                                ) : status === 'refer' ? (
                                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 whitespace-nowrap">Refer</span>
                                ) : status === 'submitted_for_grading' ? (
                                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 whitespace-nowrap">Submitted for grading</span>
                                ) : status === 'in_progress' ? (
                                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 whitespace-nowrap">In progress</span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 whitespace-nowrap">Locked</span>
                                );
                              return (
                                <li key={unit.unit_id} className="px-4 py-3 flex items-center justify-between gap-4">
                                  <span className="text-sm font-medium text-gray-900 truncate">{unit.unit_title}</span>
                                  {statusBadge}
                                </li>
                              );
                            })}
                          </ul>
                          {/* Certificate line: if course completed show available or claimed + payment + delivered */}
                          {allPassed && (
                            <div className="px-4 py-3 bg-blue-50/50 border-t border-gray-200 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                              <span className="font-medium text-gray-700">Certificate:</span>
                              {!claim ? (
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">Certificate available</span>
                              ) : (
                                <>
                                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Claimed</span>
                                  {paymentDone ? (
                                    <span className="text-gray-700">
                                      Payment done by user{paidAmount ? ` (${paidAmount})` : ''}
                                    </span>
                                  ) : (
                                    <span className="text-amber-700">Payment pending</span>
                                  )}
                                  {isDelivered ? (
                                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Certificate delivered</span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">Certificate not yet delivered</span>
                                  )}
                                  {claim.claimed_at && (
                                    <span className="text-gray-500">Claimed {formatDate(claim.claimed_at)}</span>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                      </div>
                    )}
                    {progressCourses.length === 0 && !progressLoading && (
                      <p className="text-sm text-gray-500">No qualification courses enrolled.</p>
                    )}
                    {/* Enrolled courses from payments (when no progress/claims): show so Track Progress is not empty */}
                    {progressCourses.length === 0 && claimsList.length === 0 && Object.keys(paymentsByCourse).length > 0 && (
                      <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider pt-2">Enrolled courses</h4>
                        <p className="text-sm text-gray-500">Progress and certificate status will appear here when the student starts or completes courses.</p>
                        {Object.values(paymentsByCourse).map((group) => (
                          <div key={group.course_id} className="border border-gray-200 rounded-lg overflow-hidden">
                            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-wrap gap-2">
                              <h4 className="font-semibold text-gray-900">{group.course_title}</h4>
                              <span className="text-sm text-gray-600">Enrolled · {group.payments.length} installment{group.payments.length !== 1 ? 's' : ''}</span>
                            </div>
                            <div className="px-4 py-3 text-sm text-gray-600">
                              No progress or certificate claim yet. Check the Payments tab for payment status.
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Certificate claims (CPD and qualification with claims): show course, claimed, payment done, delivered */}
                    {claimsList.length > 0 && (
                      <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider pt-2">Certificate claims</h4>
                    {claimsList
                      .filter((claim) => !progressCourses.some((c) => c.course_id === claim.course_id))
                      .map((claim) => {
                        const paymentDone = (claim.payment_status || '').toLowerCase() === 'completed';
                        const delivery = (claim.delivery_status || '').toLowerCase();
                        const isDelivered = delivery === 'delivered' || delivery === 'ready';
                        const paidAmount = claim.payment_amount != null ? formatCurrency(Number(claim.payment_amount)) : null;
                        return (
                          <div key={claim.id} className="border border-gray-200 rounded-lg overflow-hidden">
                            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-wrap gap-2">
                              <h4 className="font-semibold text-gray-900">{claim.course_title || 'Course'}</h4>
                              <span className="text-sm text-gray-600 capitalize">{claim.course_type || 'CPD'}</span>
                            </div>
                            <div className="px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                              <span className="font-medium text-gray-700">Certificate:</span>
                              <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Claimed</span>
                              {paymentDone ? (
                                <span className="text-gray-700">
                                  Payment done by user{paidAmount ? ` (${paidAmount})` : ''}
                                </span>
                              ) : (
                                <span className="text-amber-700">Payment pending</span>
                              )}
                              {isDelivered ? (
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Certificate delivered</span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">Certificate not yet delivered</span>
                              )}
                              {claim.claimed_at && (
                                <span className="text-gray-500">Claimed {formatDate(claim.claimed_at)}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      </div>
                    )}
                    {progressCourses.length === 0 && claimsList.length === 0 && Object.keys(paymentsByCourse).length === 0 && (
                      <div className="py-8 text-center text-gray-500">
                        No courses or certificate claims yet. Complete a course to see certificate status here.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default CertificateManagerStudentDetailPage;
