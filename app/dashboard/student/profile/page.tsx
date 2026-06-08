
'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiService } from '@/app/services/api';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { UserRole } from '@/app/components/types';
import dynamic from 'next/dynamic';
import { ProfileSkeleton } from '@/app/components/ui/Skeleton';
import Image from 'next/image';
import PaymentPlanTab from './components/PaymentPlanTab';
import { C, SectionCard } from './components/profileSectionUI';

const VarkAssessment = dynamic(() => import('@/app/components/VarkAssessment'), { ssr: false });

interface ProfileData {
  name?: string;
  email?: string;
  learner_id?: string | null;
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
}

interface CompletionData {
  is_complete: boolean;
  completion_percentage: number;
  completed_fields: number;
  total_fields: number;
  missing_fields: Array<{ key: string; label: string }>;
}

interface OnboardingDocument {
  id: number;
  user_id: number;
  document_type: string;
  file_name: string;
  file_url: string;
  file_size?: number;
  mime_type?: string;
  uploaded_at: string;
}

// Info field chip
function InfoField({ label, value, span2 = false }: { label: string; value: React.ReactNode; span2?: boolean }) {
  return (
    <div
      className={`rounded-xl p-4 ${span2 ? 'lg:col-span-2' : ''}`}
      style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}
    >
      <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: C.muted }}>
        {label}
      </p>
      <p className="text-sm font-semibold" style={{ color: '#1E293B' }}>
        {value}
      </p>
    </div>
  );
}

// VARK bar
function VarkBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.min((value / 20) * 100, 100);
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.muted }}>{label}</span>
        <span className="text-sm font-bold" style={{ color }}>{value}</span>
      </div>
      <div className="h-2 rounded-full" style={{ background: '#E2E8F0' }}>
        <div
          className="h-2 rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}99, ${color})` }}
        />
      </div>
    </div>
  );
}

// Checkbox row for agreements
function AgreementRow({ checked, label, sub }: { checked: boolean; label: string; sub: string }) {
  return (
    <div className="flex items-start gap-3 py-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
      <div
        className="mt-0.5 w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
        style={{
          background: checked ? C.green : '#F1F5F9',
          border: `2px solid ${checked ? C.green : '#CBD5E1'}`,
        }}
      >
        {checked && (
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <div>
        <p className="text-sm font-semibold" style={{ color: '#1E293B' }}>{label}</p>
        <p className="text-xs mt-0.5" style={{ color: C.muted }}>{sub}</p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
const StudentProfilePage = () => {
  const searchParams = useSearchParams();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileData>({});
  const [completion, setCompletion] = useState<CompletionData | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'payment-plan'>('profile');
  const [paymentTabCount, setPaymentTabCount] = useState(0);
  const [paymentFetchError, setPaymentFetchError] = useState('');
  const [showVarkAssessment, setShowVarkAssessment] = useState(false);
  const [documents, setDocuments] = useState<OnboardingDocument[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [onboarding, setOnboarding] = useState<{
    status: Record<string, unknown> | null;
    courseSelection: { cpd_courses?: boolean; qualifications?: boolean } | null;
    qualificationSelection: { level?: number } | null;
    initialAssessment: Record<string, unknown> | null;
    documents: OnboardingDocument[];
  } | null>(null);

  const varkSum =
    (Number(profile.vark_visual) || 0) +
    (Number(profile.vark_auditory) || 0) +
    (Number(profile.vark_reading) || 0) +
    (Number(profile.vark_kinesthetic) || 0);
  const hasVarkScores =
    varkSum > 0 &&
    [profile.vark_visual, profile.vark_auditory, profile.vark_reading, profile.vark_kinesthetic].every(
      (v) => v != null && !isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= 20
    );

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('lms-user') || '{}');
    setUserRole((user?.role as UserRole) || null);
    fetchProfile();
  }, []);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'payments') setActiveTab('payment-plan');
  }, [searchParams]);

  useEffect(() => {
    if (activeTab === 'profile') fetchDocuments();
  }, [activeTab]);

  const fetchDocuments = async () => {
    try {
      setLoadingDocuments(true);
      const res = await apiService.getMyDocuments();
      if (res?.success && Array.isArray(res.documents)) {
        setDocuments(res.documents.filter((doc: any) => doc.status !== 'replaced'));
      } else setDocuments([]);
    } catch { setDocuments([]); }
    finally { setLoadingDocuments(false); }
  };

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const [profileRes, completionRes, onboardingRes] = await Promise.all([
        apiService.getStudentProfile(),
        apiService.getProfileCompletion(),
        apiService.getOnboardingMe().catch(() => ({ success: false, onboarding: null })),
      ]);
      if (profileRes?.success && profileRes.profile) {
        setProfile(profileRes.profile);
        setProfilePicture(profileRes.profile.profile_picture || null);
      }
      if (completionRes?.success) setCompletion(completionRes);
      if (onboardingRes?.success && onboardingRes.onboarding) {
        const o = onboardingRes.onboarding as any;
        setOnboarding({
          status: o.status || null,
          courseSelection: o.courseSelection || null,
          qualificationSelection: o.qualificationSelection || null,
          initialAssessment: o.initialAssessment || null,
          documents: o.documents || [],
        });
        if (Array.isArray(o.documents)) setDocuments(o.documents);
      }
    } catch (err) {
      setError('Failed to load profile');
    } finally { setLoading(false); }
  };

  const handlePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg','image/jpg','image/png','image/webp'].includes(file.type)) { setError('Invalid file type. Please upload JPG, PNG, or WEBP.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('File size too large. Max 5MB.'); return; }
    setUploadingPicture(true); setError('');
    try {
      const response = await apiService.uploadProfilePicture(file);
      if (response?.success && response.picture_path) {
        setProfilePicture(response.picture_path);
        setSuccess('Profile picture updated!');
        const profileRes = await apiService.getStudentProfile();
        if (profileRes?.success && profileRes.profile) setProfile(profileRes.profile);
        window.dispatchEvent(new Event('profile-picture-updated'));
      } else setError(response?.message || 'Upload failed');
    } catch { setError('Failed to upload picture.'); }
    finally { setUploadingPicture(false); e.target.value = ''; }
  };

  const val = (v: unknown): string | null => {
    if (v == null) return null;
    const s = String(v).trim();
    return s === '' ? null : s;
  };

  const fmtDate = (d: string | null | undefined) => {
    if (!d || !val(d)) return null;
    const x = new Date(d);
    if (isNaN(x.getTime())) return d;
    return x.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatDOB = (d: string | null | undefined) => {
    if (!d) return null;
    const x = new Date(d);
    if (isNaN(x.getTime())) return null;
    return `${String(x.getDate()).padStart(2,'0')}/${String(x.getMonth()+1).padStart(2,'0')}/${x.getFullYear()}`;
  };

  const documentTypeLabel = (type: string) => {
    const t = (type || '').replace(/_/g, ' ');
    return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
  };

  const assessment = onboarding?.initialAssessment as Record<string, unknown> | undefined;
  const fullName = val(profile.name) || val(assessment?.full_name as string) || '';
  const email = val(profile.email) || val(assessment?.email as string) || '';
  const contactNumber = val(assessment?.contact_number as string) || '';
  const postalAddress = val(assessment?.postal_address as string) || '';
  const primaryLanguage = val(assessment?.primary_language as string) || '';
  const courseSel = onboarding?.courseSelection;
  const qualSel = onboarding?.qualificationSelection;
  const status = onboarding?.status as Record<string, unknown> | undefined;

  const varkScores = [
    { label: 'Visual',      value: Number(profile.vark_visual) || 0,      key: 'V', color: C.cyan  },
    { label: 'Aural',       value: Number(profile.vark_auditory) || 0,    key: 'A', color: C.pink  },
    { label: 'Read/Write',  value: Number(profile.vark_reading) || 0,     key: 'R', color: C.green },
    { label: 'Kinesthetic', value: Number(profile.vark_kinesthetic) || 0, key: 'K', color: '#F59E0B' },
  ];
  const varkPrimary = hasVarkScores ? varkScores.reduce((a, b) => a.value >= b.value ? a : b) : null;

  const completionPct = completion?.completion_percentage ?? 0;

  // ── Loading ──
  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['Student','ManagerStudent','InstituteStudent']} userRole={userRole}>
        <div className="min-h-screen py-8 px-6" style={{ background: '#F8FAFC' }}>
          <div className="max-w-5xl mx-auto">
            <ProfileSkeleton />
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['Student','ManagerStudent','InstituteStudent']} userRole={userRole}>
      <div className="min-h-screen" style={{ background: '#F1F5F9' }}>

        {/* ── Hero header ───────────────────────────────── */}
        <div
          className="relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, #0A0F1E 0%, #0F1A35 50%, #0A0F1E 100%)`,
          }}
        >
          {/* decorative glow blobs */}
          <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full opacity-20 pointer-events-none"
            style={{ background: C.cyan, filter: 'blur(80px)' }} />
          <div className="absolute -top-12 right-24 w-64 h-64 rounded-full opacity-20 pointer-events-none"
            style={{ background: C.pink, filter: 'blur(80px)' }} />

          <div className="relative max-w-5xl mx-auto px-6 pt-10 pb-0">
            {/* top row */}
            <div className="flex flex-wrap items-start justify-between gap-6 mb-8">
              <div className="flex items-center gap-5">
                {/* avatar */}
                <div className="relative flex-shrink-0">
                  <div
                    className="w-20 h-20 rounded-2xl overflow-hidden"
                    style={{ border: `3px solid rgba(255,255,255,0.15)`, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
                  >
                    {profilePicture ? (
                      <Image src={profilePicture} alt="Profile" width={80} height={80} className="w-full h-full object-cover" />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center text-white text-3xl font-bold"
                        style={{ background: `linear-gradient(135deg, ${C.cyan}, ${C.pink})` }}
                      >
                        {(fullName || JSON.parse(localStorage.getItem('lms-user') || '{}')?.name || 'U').charAt(0).toUpperCase()}
                      </div>
                    )}
                    {uploadingPicture && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm rounded-2xl">
                        <div className="w-7 h-7 border-4 border-white border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                  {/* camera button */}
                  <label
                    className="absolute -bottom-2 -right-2 w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer"
                    style={{ background: C.cyan, boxShadow: '0 2px 8px rgba(17,204,239,0.5)' }}
                    title="Change photo"
                  >
                    <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={handlePictureUpload} className="hidden" disabled={uploadingPicture} />
                    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </label>
                </div>

                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">{fullName || 'My Profile'}</h1>
                  {email && <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>{email}</p>}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {courseSel?.qualifications && (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: `${C.pink}22`, color: C.pink, border: `1px solid ${C.pink}44` }}>
                        Qualifications
                      </span>
                    )}
                    {courseSel?.cpd_courses && (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: `${C.cyan}22`, color: C.cyan, border: `1px solid ${C.cyan}44` }}>
                        CPD Courses
                      </span>
                    )}
                    {qualSel?.level && (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: `${C.green}22`, color: C.green, border: `1px solid ${C.green}44` }}>
                        Level {qualSel.level}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* completion ring */}
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 flex-shrink-0">
                  <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" />
                    <circle cx="32" cy="32" r="26" fill="none"
                      stroke={completionPct === 100 ? C.green : C.cyan}
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 26}`}
                      strokeDashoffset={`${2 * Math.PI * 26 * (1 - completionPct / 100)}`}
                      style={{ transition: 'stroke-dashoffset 1s ease' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-bold text-white">{completionPct}%</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>Profile</p>
                  <p className="text-sm font-bold text-white">
                    {completionPct === 100 ? '✓ Complete' : `${completion?.completed_fields ?? 0}/${completion?.total_fields ?? 0} fields`}
                  </p>
                </div>
              </div>
            </div>

            {/* tab nav */}
            <div className="flex gap-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              {(['profile','payment-plan'] as const).map((tab) => {
                const active = activeTab === tab;
                const label = tab === 'profile' ? 'Profile Information' : `Payment Plan${paymentTabCount > 0 ? ` (${paymentTabCount})` : ''}`;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className="relative px-6 py-3.5 text-sm font-semibold transition-all"
                    style={{ color: active ? '#fff' : 'rgba(255,255,255,0.4)' }}
                  >
                    {label}
                    {active && (
                      <span
                        className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full"
                        style={{ background: `linear-gradient(90deg, ${C.cyan}, ${C.pink})` }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Body ──────────────────────────────────────── */}
        <div className="max-w-5xl mx-auto px-6 py-8 space-y-5">

          {/* Alerts */}
          {success && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold"
              style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#16A34A' }}>
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              {success}
            </div>
          )}
          {error && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold"
              style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              {error}
            </div>
          )}
          {paymentFetchError && activeTab === 'payment-plan' && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold"
              style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              {paymentFetchError}
            </div>
          )}

          {/* missing fields */}
          {activeTab === 'profile' && completion && completion.missing_fields.length > 0 && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl text-sm"
              style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#D97706' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <div>
                <p className="font-semibold" style={{ color: '#92400E' }}>Complete your profile</p>
                <p className="text-xs mt-0.5" style={{ color: '#B45309' }}>
                  Missing: {completion.missing_fields.map(f => f.label).join(' · ')}
                </p>
              </div>
            </div>
          )}

          {/* ════ PROFILE TAB ════ */}
          {activeTab === 'profile' && (
            <div className="space-y-5">

              {/* Personal Information */}
              <SectionCard
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>}
                title="Personal Information"
                accent={C.cyan}
                badge={
                  completion?.is_complete ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                      style={{ background: `${C.green}15`, color: C.green, border: `1px solid ${C.green}40` }}>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
                      </svg>
                      Verified
                    </span>
                  ) : undefined
                }
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {val(fullName) && <InfoField label="Full Name" value={fullName} />}
                  {val(profile.learner_id) && <InfoField label="Learner ID" value={profile.learner_id!} />}
                  {val(profile.gender) && <InfoField label="Gender" value={profile.gender!} />}
                  {(val(profile.date_of_birth) || assessment?.date_of_birth != null) && (
                    <InfoField label="Date of Birth" value={formatDOB(profile.date_of_birth) || fmtDate(assessment?.date_of_birth as string) || '—'} />
                  )}
                  {val(profile.nationality) && <InfoField label="Nationality" value={profile.nationality!} />}
                  {val(profile.ethnicity) && <InfoField label="Ethnicity" value={profile.ethnicity!} />}
                  {val(primaryLanguage) && <InfoField label="Primary Language" value={primaryLanguage} />}
                  {val(contactNumber) && <InfoField label="Contact Number" value={contactNumber} />}
                  {val(email) && <InfoField label="Email Address" value={<span className="break-all">{email}</span>} />}
                  {val(postalAddress) && <InfoField label="Postal Address" value={<span className="whitespace-pre-wrap">{postalAddress}</span>} span2 />}
                </div>
              </SectionCard>

              {/* Qualification & Courses */}
              {(courseSel || qualSel) && (
                <SectionCard
                  icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>}
                  title="Qualification & Courses"
                  accent={C.pink}
                >
                  <div className="flex flex-wrap gap-3">
                    {courseSel?.cpd_courses && (
                      <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
                        style={{ background: `${C.cyan}10`, border: `1px solid ${C.cyan}30` }}>
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: C.cyan }} />
                        <span className="text-sm font-semibold" style={{ color: C.cyan }}>CPD Courses</span>
                      </div>
                    )}
                    {courseSel?.qualifications && (
                      <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
                        style={{ background: `${C.pink}10`, border: `1px solid ${C.pink}30` }}>
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: C.pink }} />
                        <span className="text-sm font-semibold" style={{ color: C.pink }}>Qualifications</span>
                      </div>
                    )}
                    {qualSel?.level != null && (
                      <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
                        style={{ background: `${C.green}10`, border: `1px solid ${C.green}30` }}>
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: C.green }} />
                        <span className="text-sm font-semibold" style={{ color: C.green }}>Level {qualSel.level}</span>
                      </div>
                    )}
                  </div>
                </SectionCard>
              )}

              {/* Professional Information */}
              <SectionCard
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>}
                title="Professional Information"
                accent={C.pink}
              >
                <div className="space-y-4">
                  {val(profile.previous_qualification) && (
                    <div className="p-4 rounded-xl" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: C.muted }}>Previous Qualification</p>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#1E293B' }}>{profile.previous_qualification}</p>
                    </div>
                  )}
                  {(val(profile.motivation) || val(assessment?.why_qualification as string)) && (
                    <div className="p-4 rounded-xl" style={{ background: '#F8FAFC', border: `1px solid ${C.cyan}30`, borderLeft: `4px solid ${C.cyan}` }}>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: C.muted }}>Motivation</p>
                      <p className="text-sm italic leading-relaxed whitespace-pre-wrap" style={{ color: '#334155' }}>
                        {String(profile.motivation ?? assessment?.why_qualification ?? '')}
                      </p>
                    </div>
                  )}
                  {val(assessment?.career_goals as string) && (
                    <div className="p-4 rounded-xl" style={{ background: '#F8FAFC', border: `1px solid ${C.pink}30`, borderLeft: `4px solid ${C.pink}` }}>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: C.muted }}>Career Goals</p>
                      <p className="text-sm italic leading-relaxed whitespace-pre-wrap" style={{ color: '#334155' }}>{String(assessment?.career_goals ?? '')}</p>
                    </div>
                  )}
                  {val(assessment?.employer_support as string) && (
                    <div className="p-4 rounded-xl" style={{ background: '#F8FAFC', border: `1px solid ${C.green}30`, borderLeft: `4px solid ${C.green}` }}>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: C.muted }}>Employer Support</p>
                      <p className="text-sm italic leading-relaxed whitespace-pre-wrap" style={{ color: '#334155' }}>{String(assessment?.employer_support ?? '')}</p>
                    </div>
                  )}
                  {!val(profile.motivation) && !val(assessment?.why_qualification as string) && !val(profile.previous_qualification) && (
                    <p className="text-sm text-center py-8" style={{ color: C.muted }}>No professional information yet.</p>
                  )}
                </div>
              </SectionCard>

              {/* Skills Assessment */}
              <SectionCard
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
                title="Skills Assessment"
                accent={C.green}
              >
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {(val(profile.english_literacy) || val(assessment?.english_literacy as string)) && (
                    <div className="p-4 rounded-xl" style={{ background: `${C.cyan}08`, border: `1px solid ${C.cyan}20` }}>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: C.muted }}>English & Literacy</p>
                      <span className="text-sm font-bold px-3 py-1 rounded-full"
                        style={{ background: `linear-gradient(135deg, ${C.cyan}, ${C.cyan}CC)`, color: '#fff' }}>
                        {String(profile.english_literacy ?? (assessment?.english_literacy != null ? String(assessment.english_literacy) : '') ?? '')}
                      </span>
                    </div>
                  )}
                  {(val(profile.ict_skills) || val(assessment?.ict_skills as string)) && (
                    <div className="p-4 rounded-xl" style={{ background: `${C.pink}08`, border: `1px solid ${C.pink}20` }}>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: C.muted }}>ICT Skills</p>
                      <span className="text-sm font-bold px-3 py-1 rounded-full"
                        style={{ background: `linear-gradient(135deg, ${C.pink}, ${C.pink}CC)`, color: '#fff' }}>
                        {String(profile.ict_skills ?? (assessment?.ict_skills != null ? String(assessment.ict_skills) : '') ?? '')}
                      </span>
                    </div>
                  )}
                  {(val(profile.special_learning_needs) || val(assessment?.special_learning_needs as string)) && (
                    <div className="p-4 rounded-xl lg:col-span-3" style={{ background: `${C.green}08`, border: `1px solid ${C.green}20` }}>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: C.muted }}>Special Learning Needs</p>
                      <p className="text-sm font-medium whitespace-pre-wrap" style={{ color: '#1E293B' }}>
                        {String(profile.special_learning_needs ?? (assessment?.special_learning_needs != null ? String(assessment.special_learning_needs) : '') ?? 'None specified')}
                      </p>
                    </div>
                  )}
                  {!val(profile.english_literacy) && !val(profile.ict_skills) && !(val(assessment?.english_literacy as string)) && (
                    <p className="col-span-3 text-sm text-center py-8" style={{ color: C.muted }}>No skills data yet.</p>
                  )}
                </div>
              </SectionCard>

              {/* VARK Learning Style */}
              <SectionCard
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>}
                title="VARK Learning Style"
                accent={C.cyan}
                badge={
                  varkPrimary ? (
                    <span className="text-xs font-bold px-3 py-1 rounded-full"
                      style={{ background: `${varkPrimary.color}15`, color: varkPrimary.color, border: `1px solid ${varkPrimary.color}40` }}>
                      {varkPrimary.label} Learner
                    </span>
                  ) : undefined
                }
              >
                {hasVarkScores ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      {varkScores.map(s => (
                        <VarkBar key={s.key} label={s.label} value={s.value} color={s.color} />
                      ))}
                    </div>
                    {/* radar */}
                    <div className="flex flex-col items-center justify-center gap-4">
                      <svg viewBox="0 0 120 120" className="w-36 h-36">
                        {/* grid rings */}
                        {[0.25,0.5,0.75,1].map((r,i) => (
                          <circle key={i} cx="60" cy="60" r={r*40} fill="none" stroke="#E2E8F0" strokeWidth="0.75"/>
                        ))}
                        {/* axes */}
                        {varkScores.map((_,i) => {
                          const a = (i*90-90)*Math.PI/180;
                          return <line key={i} x1="60" y1="60" x2={60+40*Math.cos(a)} y2={60+40*Math.sin(a)} stroke="#E2E8F0" strokeWidth="0.75"/>;
                        })}
                        {/* shape */}
                        <polygon
                          points={varkScores.map((s,i)=>{
                            const a=(i*90-90)*Math.PI/180;
                            const r=5+(s.value/20)*35;
                            return `${60+r*Math.cos(a)},${60+r*Math.sin(a)}`;
                          }).join(' ')}
                          fill={`${C.cyan}25`}
                          stroke={C.cyan}
                          strokeWidth="1.5"
                          strokeLinejoin="round"
                        />
                        {/* dots + labels */}
                        {varkScores.map((s,i)=>{
                          const a=(i*90-90)*Math.PI/180;
                          const r=5+(s.value/20)*35;
                          const lx=60+46*Math.cos(a), ly=60+46*Math.sin(a);
                          return (
                            <g key={s.key}>
                              <circle cx={60+r*Math.cos(a)} cy={60+r*Math.sin(a)} r="3" fill={s.color}/>
                              <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="8" fontWeight="600" fill={C.muted}>{s.key}</text>
                            </g>
                          );
                        })}
                      </svg>
                      <button
                        type="button"
                        onClick={() => setShowVarkAssessment(true)}
                        className="text-xs font-semibold px-4 py-2 rounded-lg transition-all hover:opacity-80"
                        style={{ background: `${C.cyan}12`, color: C.cyan, border: `1px solid ${C.cyan}30` }}
                      >
                        Retake Assessment
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-8 gap-4">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                      style={{ background: `${C.cyan}10`, border: `2px dashed ${C.cyan}40` }}>
                      <svg className="w-7 h-7" style={{ color: C.cyan }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold" style={{ color: '#1E293B' }}>No VARK scores yet</p>
                      <p className="text-xs mt-1" style={{ color: C.muted }}>Complete the assessment to discover your learning style</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowVarkAssessment(true)}
                      className="text-sm font-semibold px-5 py-2.5 rounded-xl transition-all hover:opacity-90"
                      style={{ background: `linear-gradient(135deg, ${C.cyan}, ${C.pink})`, color: '#fff' }}
                    >
                      Start VARK Assessment
                    </button>
                  </div>
                )}
              </SectionCard>

              {/* Documents */}
              <SectionCard
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>}
                title="Uploaded Documents"
                accent={C.green}
                badge={
                  documents.length > 0 ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                      style={{ background: `${C.green}15`, color: C.green, border: `1px solid ${C.green}40` }}>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
                      </svg>
                      {documents.length} Verified
                    </span>
                  ) : undefined
                }
              >
                {documents.length === 0 ? (
                  <p className="text-sm text-center py-8" style={{ color: C.muted }}>No documents uploaded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {documents.map((doc) => (
                      <a
                        key={doc.id}
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 rounded-xl transition-all hover:translate-x-0.5"
                        style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}
                      >
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: `${C.green}15` }}>
                          <svg className="w-4 h-4" style={{ color: C.green }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.muted }}>{documentTypeLabel(doc.document_type)}</p>
                          <p className="text-sm font-semibold truncate" style={{ color: C.cyan }}>{doc.file_name}</p>
                        </div>
                        <span className="text-xs font-bold flex-shrink-0" style={{ color: C.green }}>✓ Verified</span>
                      </a>
                    ))}
                  </div>
                )}
              </SectionCard>

              {/* E-Signature */}
              {(assessment?.signature_name != null || assessment?.signature_date != null) && (
                <SectionCard
                  icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
                  title="E-Signature & Agreements"
                  accent={C.green}
                >
                  <div className="space-y-0">
                    <AgreementRow
                      checked={assessment?.assessment_accuracy_consent === true || assessment?.assessment_accuracy_consent === 1}
                      label="Information Accuracy Agreement"
                      sub="I confirm that all information provided is accurate and complete"
                    />
                    <AgreementRow
                      checked={assessment?.data_usage_consent === true || assessment?.data_usage_consent === 1}
                      label="Learning Support Disclosure Agreement"
                      sub="I have disclosed any special learning needs or disabilities"
                    />
                    <AgreementRow
                      checked={assessment?.qualification_understanding === true || assessment?.qualification_understanding === 1}
                      label="Qualification Understanding"
                      sub="I understand the requirements and expectations of this qualification"
                    />
                    <AgreementRow
                      checked={assessment?.apl_understanding === true || assessment?.apl_understanding === 1}
                      label="APL Understanding"
                      sub="I understand the Accreditation of Prior Learning (APL) process if applicable"
                    />
                    <AgreementRow
                      checked={assessment?.privacy_policy_consent === true || assessment?.privacy_policy_consent === 1}
                      label="Privacy Policy"
                      sub="I have read and agree to the Privacy Policy"
                    />
                    <AgreementRow
                      checked={assessment?.terms_conditions_consent === true || assessment?.terms_conditions_consent === 1}
                      label="Terms & Conditions"
                      sub="I have read and agree to the Terms & Conditions"
                    />
                  </div>
                  <div className="mt-4 pt-4 flex items-center justify-between" style={{ borderTop: '1px solid #F1F5F9' }}>
                    <div className="space-y-1 text-sm" style={{ color: C.muted }}>
                      {val(assessment?.signature_name as string) && (
                        <p>Signed by <span className="font-semibold" style={{ color: '#1E293B' }}>{String(assessment?.signature_name ?? '')}</span></p>
                      )}
                      {assessment?.signature_date != null && (
                        <p>Signed on <span className="font-semibold" style={{ color: '#1E293B' }}>{fmtDate(String(assessment?.signature_date)) || String(assessment?.signature_date)}</span></p>
                      )}
                    </div>
                    <span className="text-sm font-bold" style={{ color: C.green }}>✓ All agreements signed</span>
                  </div>
                </SectionCard>
              )}

              {/* Verification Status */}
              <SectionCard
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>}
                title="Verification Status"
                accent={C.pink}
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: C.muted }}>Status</p>
                    <p className="text-sm font-bold" style={{ color: status?.admin_verified ? C.green : '#F59E0B' }}>
                      {status?.admin_verified ? '✓ Verified' : (status?.verification_requested_at ? '⏳ Pending' : 'In Progress')}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: C.muted }}>Verified On</p>
                    <p className="text-sm font-bold" style={{ color: '#1E293B' }}>{status?.admin_verified_at ? fmtDate(String(status.admin_verified_at)) : '—'}</p>
                  </div>
                  <div className="p-4 rounded-xl" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: C.muted }}>Dashboard Access</p>
                    <p className="text-sm font-bold" style={{ color: Boolean(status?.dashboard_access_granted) ? C.green : C.muted }}>
                      {Boolean(status?.dashboard_access_granted) ? '✓ Granted' : 'Not yet'}
                    </p>
                  </div>
                </div>
              </SectionCard>

            </div>
          )}

          {/* ════ PAYMENT TAB ════ */}
          {activeTab === 'payment-plan' && (
            <PaymentPlanTab
              onInstallmentsCountChange={setPaymentTabCount}
              onFetchError={setPaymentFetchError}
            />
          )}
        </div>
      </div>

      {showVarkAssessment && (
        <VarkAssessment
          onComplete={(scores) => {
            setProfile((prev) => ({ ...prev, ...scores }));
            fetchProfile();
            setShowVarkAssessment(false);
          }}
          onClose={() => setShowVarkAssessment(false)}
          isRetake={hasVarkScores}
        />
      )}
    </ProtectedRoute>
  );
};

export default StudentProfilePage;