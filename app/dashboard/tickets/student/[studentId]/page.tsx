'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiService } from '@/app/services/api';
import SendMessageToStudentModal from '@/app/components/SendMessageToStudentModal';
import StudentQualificationProgressView from '@/app/components/StudentQualificationProgressView';
import StudentPaymentsTab from '@/app/components/StudentPaymentsTab';

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

type TabId = 'profile' | 'progress' | 'payments';

/** Finance department — payment tab (Academic / Operation Manager use progress only) */
const FINANCE_ROLES = ['Admin', 'Accounts Manager', 'Team Member'];
const FINANCE_EDIT_ROLES = ['Admin', 'Accounts Manager'];

export default function TicketStudentProfilePage() {
  const params = useParams();
  const router = useRouter();
  const studentId = parseInt(params.studentId as string, 10);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('progress');
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('lms-user') || '{}');
      setUserRole(u?.role || null);
    } catch {
      setUserRole(null);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [studentId]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError('');
      const profileResponse = await apiService.getStudentProfileById(studentId);
      if (profileResponse?.success && profileResponse.profile) {
        setProfile(profileResponse.profile);
      } else {
        setError('Failed to load student profile');
      }
    } catch {
      setError('Failed to load student profile');
    } finally {
      setLoading(false);
    }
  };

  const showPaymentsTab = userRole != null && FINANCE_ROLES.includes(userRole);
  const canEditPayments = userRole != null && FINANCE_EDIT_ROLES.includes(userRole);

  const tabs: { id: TabId; label: string }[] = [
    { id: 'progress', label: '📚 Course progress' },
    ...(showPaymentsTab ? [{ id: 'payments' as TabId, label: '💳 Payments' }] : []),
    { id: 'profile', label: '👤 Profile' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#11CCEF]" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
          {error || 'Student not found'}
        </div>
        <Link
          href="/dashboard/tickets"
          className="inline-block px-4 py-2 bg-[#11CCEF] text-white rounded-lg hover:opacity-90"
        >
          ← Back to Tickets
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <Link
          href="/dashboard/tickets/students-profile"
          className="text-sm text-[#11CCEF] hover:underline font-medium mr-4"
        >
          ← Students profile
        </Link>
        <Link href="/dashboard/tickets" className="text-sm text-gray-500 hover:underline font-medium">
          Tickets
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-[#11CCEF] to-[#0daed9] text-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {profile.profile_picture ? (
                <img
                  src={profile.profile_picture}
                  alt={profile.name}
                  className="h-16 w-16 rounded-full object-cover border-2 border-white"
                />
              ) : (
                <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">
                  {profile.name?.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold m-0">{profile.name}</h1>
                <p className="text-white/90 text-sm m-0">{profile.email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowMessageModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 text-white border-0 rounded-[10px] text-[13px] font-bold cursor-pointer shadow-lg"
              style={{
                background: 'linear-gradient(135deg, #e51791, #c1147a)',
                boxShadow: '0 4px 12px rgba(229,23,145,0.3)',
              }}
            >
              💬 Send Message
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 p-2 border-b border-gray-200 bg-gray-50">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                activeTab === tab.id
                  ? 'bg-white text-[#11CCEF] shadow-sm border border-[#11CCEF]/30'
                  : 'text-gray-600 hover:bg-white/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'progress' && (
            <StudentQualificationProgressView studentId={studentId} />
          )}
          {activeTab === 'payments' && showPaymentsTab && (
            <StudentPaymentsTab
              studentId={studentId}
              studentName={profile.name}
              canEdit={canEditPayments}
            />
          )}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                    Personal Information
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-500">Gender</span>
                      <p className="text-gray-900 m-0">{profile.gender || 'Not provided'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Date of Birth</span>
                      <p className="text-gray-900 m-0">
                        {profile.date_of_birth
                          ? new Date(profile.date_of_birth).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            })
                          : 'Not provided'}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Nationality</span>
                      <p className="text-gray-900 m-0">{profile.nationality || 'Not provided'}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                    Professional
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-500">Current role</span>
                      <p className="text-gray-900 m-0">{profile.current_role || 'Not provided'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Previous qualification</span>
                      <p className="text-gray-900 m-0 whitespace-pre-wrap">
                        {profile.previous_qualification || 'Not provided'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <SendMessageToStudentModal
        studentId={studentId}
        studentName={profile.name}
        open={showMessageModal}
        onClose={() => setShowMessageModal(false)}
        onSuccess={(ticketId) => router.push(`/dashboard/tickets/${ticketId}`)}
      />
    </div>
  );
}
