'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiService } from '@/app/services/api';
import StudentProfileDetail from '@/app/components/StudentProfileDetail';

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

const StudentDetailPage = () => {
  const params = useParams();
  const router = useRouter();
  const studentId = parseInt(params.studentId as string, 10);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [payments, setPayments] = useState<PaymentInstallment[]>([]);
  const [activeTab, setActiveTab] = useState<'profile' | 'payments'>('profile');

  useEffect(() => {
    fetchData();
  }, [studentId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch profile and payments in parallel
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
    } catch (error) {
      console.error('Error fetching student data:', error);
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

  // Group payments by course
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#11CCEF] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading student data...</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Student not found'}</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-[#11CCEF] text-white rounded-lg hover:bg-[#0daed9]"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
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
              onClick={() => router.back()}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              ← Back
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
            </nav>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'profile' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Personal Information */}
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

              {/* Professional Information */}
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

              {/* Learning Style (VARK) */}
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

              {/* Skills & Needs */}
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

              {/* Profile Status */}
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
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              No.
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Installment
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Amount
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Due Date
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Status
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Paid At
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Reference
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {courseGroup.payments.map((payment) => (
                            <tr key={payment.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {payment.installment_number}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {payment.installment_name}
                              </td>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                {formatCurrency(payment.amount)}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-500">
                                {formatDate(payment.due_date)}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                                    payment.status
                                  )}`}
                                >
                                  {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-500">
                                {payment.paid_at ? formatDate(payment.paid_at) : '-'}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-500">
                                {payment.payment_reference || '-'}
                              </td>
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
      </div>
    </div>
  );
};

export default StudentDetailPage;

