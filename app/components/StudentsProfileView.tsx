'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiService } from '@/app/services/api';
import SendMessageToStudentModal from '@/app/components/SendMessageToStudentModal';

type ProfileDisplayStatus = 'new' | 'review' | 'verified' | 'rejected_awaiting' | 'resubmitted';

function countPositive(v: unknown): boolean {
  const n = Number(v);
  return !Number.isNaN(n) && n > 0;
}

interface StudentProfile {
  user_id: number;
  name: string;
  email: string;
  learner_id?: string | null;
  onboarding_profile_status: 'new' | 'review' | 'verified';
  profile_status: 'complete' | 'incomplete';
  is_profile_complete: number;
  profile_completed_at: string | null;
  updated_at: string | null;
  verification_requested_at: string | null;
  onboarding_updated_at: string | null;
  profile_updated_at?: string | null;
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
  /** Comma-separated course_type values from active enrollments */
  enrolled_course_types?: string | null;
  /** Comma-separated course titles */
  enrolled_courses?: string | null;
  /** Derived: cpd-only | qualification (incl. both) | none */
  student_type?: 'cpd' | 'qualification' | 'none' | string | null;
  has_rejected_docs?: number | string | null;
  has_resubmitted_docs?: number | string | null;
  pending_docs_count?: number | string | null;
  total_docs_count?: number | string | null;
  rejected_docs_count?: number | string | null;
}

interface StudentsProfileViewProps {
  userRole: 'Admin' | 'Assessor' | 'Certificate Manager' | 'Accounts Manager' | 'Operation Manager';
  userId?: number;
}

const StudentsProfileView = ({ userRole, userId }: StudentsProfileViewProps) => {
  const router = useRouter();
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ProfileDisplayStatus>('all');
  const [dateFilter, setDateFilter] = useState<
    'all' | 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_7_days' | 'last_30_days' | 'custom'
  >('all');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | 'all'>(20);
  const [courseTypeFilter, setCourseTypeFilter] = useState<'all' | 'cpd' | 'qualification' | 'none'>('all');
  const [messageStudent, setMessageStudent] = useState<StudentProfile | null>(null);
  const [showMessageModal, setShowMessageModal] = useState(false);

  const canSendMessageToStudent =
    userRole === 'Admin' ||
    userRole === 'Accounts Manager' ||
    userRole === 'Operation Manager' ||
    userRole === 'Certificate Manager';

  useEffect(() => {
    fetchData();
  }, []); // Only fetch once on mount

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');

      let response;
      if (
        userRole === 'Admin' ||
        userRole === 'Certificate Manager' ||
        userRole === 'Accounts Manager' ||
        userRole === 'Operation Manager'
      ) {
        response = await apiService.getAllStudentsProfiles();
      } else {
        response = await apiService.getTutorStudentsProfiles();
      }

      if (response?.success) {
        setStudents(response.students || []);
      } else {
        setError(response?.message || 'Failed to fetch student profiles');
      }
    } catch (error) {
      setError('Failed to connect to API. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewProfile = (student: StudentProfile) => {
    // Navigate to student detail page based on user role
    if (userRole === 'Operation Manager') {
      router.push(`/dashboard/tickets/student/${student.user_id}`);
    } else if (userRole === 'Admin' || userRole === 'Accounts Manager') {
      router.push(`/dashboard/admin/students/${student.user_id}`);
    } else if (userRole === 'Certificate Manager') {
      router.push(`/dashboard/certificate-manager/students/${student.user_id}`);
    } else {
      router.push(`/dashboard/tutor/students/${student.user_id}`);
    }
  };

  const getDisplayStatus = (s: StudentProfile): ProfileDisplayStatus => {
    if (countPositive(s.has_rejected_docs)) return 'rejected_awaiting';
    if (countPositive(s.has_resubmitted_docs)) return 'resubmitted';
    const status = s.onboarding_profile_status;
    if (status === 'verified' || status === 'review' || status === 'new') return status;
    if (s.verification_requested_at && !s.onboarding_profile_status) return 'review';
    return 'new';
  };

  const getSubmittedDate = (student: StudentProfile): Date | null => {
    const raw =
      student.verification_requested_at ||
      student.onboarding_updated_at ||
      student.updated_at ||
      student.profile_updated_at;
    return raw ? new Date(raw) : null;
  };

  const filteredStudents = students
    .filter(student => {
      // Filter out students with null user_id
      if (!student.user_id) {
        return false;
      }
      
      const matchesSearch = !searchTerm || 
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (student.learner_id || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const displayStatus = getDisplayStatus(student);
      const matchesStatus = statusFilter === 'all' || displayStatus === statusFilter;

      // Date filtering: use calendar day in local TZ so "Today" shows submissions from the same day
      let matchesDate = true;
      if (dateFilter === 'all') {
        matchesDate = true;
      } else if (dateFilter === 'custom') {
        if (!customDateFrom.trim() && !customDateTo.trim()) {
          matchesDate = true;
        } else {
          const date = getSubmittedDate(student);
          if (!date) {
            matchesDate = false;
          } else {
            const t = date.getTime();
            if (customDateFrom.trim()) {
              const start = new Date(`${customDateFrom.trim()}T00:00:00`);
              if (t < start.getTime()) matchesDate = false;
            }
            if (matchesDate && customDateTo.trim()) {
              const end = new Date(`${customDateTo.trim()}T23:59:59.999`);
              if (t > end.getTime()) matchesDate = false;
            }
          }
        }
      } else {
        const submittedDate =
          student.verification_requested_at ||
          student.onboarding_updated_at ||
          student.updated_at ||
          student.profile_updated_at;
        if (submittedDate) {
          const date = new Date(submittedDate);
          const now = new Date();
          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const yesterdayStart = new Date(todayStart);
          yesterdayStart.setDate(yesterdayStart.getDate() - 1);
          
          switch (dateFilter) {
            case 'today':
              // Same calendar day in viewer's timezone
              matchesDate = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
              break;
            case 'yesterday':
              matchesDate = date >= yesterdayStart && date < todayStart;
              break;
            case 'this_week': {
              const startOfWeek = new Date(todayStart);
              startOfWeek.setDate(todayStart.getDate() - now.getDay());
              matchesDate = date >= startOfWeek;
              break;
            }
            case 'this_month': {
              const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
              matchesDate = date >= startOfMonth;
              break;
            }
            case 'last_7_days': {
              const last7Days = new Date(todayStart);
              last7Days.setDate(last7Days.getDate() - 7);
              matchesDate = date >= last7Days;
              break;
            }
            case 'last_30_days': {
              const last30Days = new Date(todayStart);
              last30Days.setDate(last30Days.getDate() - 30);
              matchesDate = date >= last30Days;
              break;
            }
            default:
              matchesDate = true;
          }
        } else {
          matchesDate = false;
        }
      }

      const st = student.student_type;
      const matchesCourseType =
        courseTypeFilter === 'all' ||
        (courseTypeFilter === 'cpd' && st === 'cpd') ||
        (courseTypeFilter === 'qualification' && st === 'qualification') ||
        (courseTypeFilter === 'none' && (!st || st === 'none'));

      return matchesSearch && matchesStatus && matchesDate && matchesCourseType;
    });

  // Pagination logic
  const totalItems = filteredStudents.length;
  const totalPages = itemsPerPage === 'all' ? 1 : Math.ceil(totalItems / itemsPerPage);
  const startIndex = itemsPerPage === 'all' ? 0 : (currentPage - 1) * itemsPerPage;
  const endIndex = itemsPerPage === 'all' ? totalItems : startIndex + itemsPerPage;
  const paginatedStudents = filteredStudents.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, dateFilter, customDateFrom, customDateTo, itemsPerPage, courseTypeFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading student profiles...</div>
      </div>
    );
  }

  // Get status counts
  const statusCounts = {
    all: students.length,
    new: students.filter(s => getDisplayStatus(s) === 'new').length,
    review: students.filter(s => getDisplayStatus(s) === 'review').length,
    verified: students.filter(s => getDisplayStatus(s) === 'verified').length,
    rejected_awaiting: students.filter(s => getDisplayStatus(s) === 'rejected_awaiting').length,
    resubmitted: students.filter(s => getDisplayStatus(s) === 'resubmitted').length,
  };

  const docSnapshotStats = [
    {
      id: 'all' as const,
      label: 'Total',
      sub: 'Students',
      count: statusCounts.all,
      accent: '#64748b',
      bg: '#f8fafc'
    },
    {
      id: 'review' as const,
      label: 'Pending review',
      sub: '',
      count: statusCounts.review,
      accent: '#d97706',
      bg: '#fffbeb'
    },
    {
      id: 'rejected_awaiting' as const,
      label: 'Docs rejected',
      sub: '',
      count: statusCounts.rejected_awaiting,
      accent: '#dc2626',
      bg: '#fef2f2'
    },
    {
      id: 'resubmitted' as const,
      label: 'Docs resubmitted',
      sub: '',
      count: statusCounts.resubmitted,
      accent: '#7c3aed',
      bg: '#f5f3ff'
    },
    {
      id: 'verified' as const,
      label: 'Verified',
      sub: '',
      count: statusCounts.verified,
      accent: '#16a34a',
      bg: '#f0fdf4'
    }
  ];

  const applyStatusFilter = (id: 'all' | ProfileDisplayStatus) => {
    setStatusFilter(id);
    if (id !== 'all') {
      setDateFilter('all');
      setCustomDateFrom('');
      setCustomDateTo('');
    }
  };

  const getStatusBadge = (student: StudentProfile) => {
    const status = getDisplayStatus(student);
    const badges: Record<
      string,
      { label: string; bg: string; color: string; border: string; tooltip: string }
    > = {
      rejected_awaiting: {
        label: 'Docs rejected',
        bg: '#fef2f2',
        color: '#dc2626',
        border: '#fecaca',
        tooltip: 'Admin rejected documents. Waiting for the student to resubmit.'
      },
      resubmitted: {
        label: 'Docs resubmitted',
        bg: '#f5f3ff',
        color: '#7c3aed',
        border: '#ddd6fe',
        tooltip: 'Student resubmitted documents. Ready for admin review.'
      },
      review: {
        label: 'Pending review',
        bg: '#fffbeb',
        color: '#d97706',
        border: '#fde68a',
        tooltip: 'Waiting for admin verification.'
      },
      verified: {
        label: 'Verified',
        bg: '#f0fdf4',
        color: '#16a34a',
        border: '#bbf7d0',
        tooltip: 'Student verified and has access.'
      },
      new: {
        label: 'New',
        bg: '#f0fbff',
        color: '#0369a1',
        border: '#bae6fd',
        tooltip: 'New student, not yet submitted.'
      }
    };
    const badge = badges[status] || badges.new;
    return (
      <div className="flex flex-col items-start gap-1">
        <span
          title={badge.tooltip}
          style={{
            background: badge.bg,
            color: badge.color,
            border: `1px solid ${badge.border}`,
            borderRadius: '8px',
            padding: '3px 10px',
            fontSize: '11px',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            cursor: 'default'
          }}
        >
          {badge.label}
        </span>
        {countPositive(student.rejected_docs_count) && (
          <div style={{ fontSize: '10px', color: '#dc2626', marginTop: '2px' }}>
            {Number(student.rejected_docs_count)} doc(s) rejected
          </div>
        )}
        {countPositive(student.has_resubmitted_docs) && (
          <div style={{ fontSize: '10px', color: '#7c3aed', marginTop: '2px' }}>
            {Number(student.has_resubmitted_docs)} doc(s) resubmitted
          </div>
        )}
      </div>
    );
  };

  const typeStats = {
    cpd: students.filter(s => s.student_type === 'cpd').length,
    qualification: students.filter(s => s.student_type === 'qualification').length,
    notEnrolled: students.filter(s => !s.student_type || s.student_type === 'none').length,
    pendingReview: students.filter(s => getDisplayStatus(s) === 'review').length,
  };

  // Get date-based counts (same calendar-day logic as filter so counts match)
  const getDateFilterCount = (filter: string) => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    
    return students.filter(student => {
      const submittedDate = student.verification_requested_at || student.onboarding_updated_at || student.updated_at || student.profile_updated_at;
      if (!submittedDate) return false;
      
      const date = new Date(submittedDate);
      switch (filter) {
        case 'today':
          return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
        case 'yesterday':
          return date >= yesterdayStart && date < todayStart;
        case 'this_week':
          const startOfWeek = new Date(todayStart);
          startOfWeek.setDate(todayStart.getDate() - now.getDay());
          return date >= startOfWeek;
        case 'this_month':
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          return date >= startOfMonth;
        case 'last_7_days':
          const last7Days = new Date(todayStart);
          last7Days.setDate(last7Days.getDate() - 7);
          return date >= last7Days;
        case 'last_30_days':
          const last30Days = new Date(todayStart);
          last30Days.setDate(last30Days.getDate() - 30);
          return date >= last30Days;
        default:
          return true;
      }
    }).length;
  };

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="bg-gradient-to-r from-[#11CCEF] via-[#E51791] to-[#11CCEF] rounded-2xl shadow-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">Students Profile</h2>
            <p className="text-white/90">Manage and monitor student onboarding status</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="bg-white/20 backdrop-blur-sm rounded-xl px-5 py-3 border border-white/30">
              <div className="text-xs font-semibold text-white/80 uppercase tracking-wider">Total students</div>
              <div className="text-2xl font-bold text-white">{statusCounts.all}</div>
            </div>
            <div className="bg-emerald-500/30 backdrop-blur-sm rounded-xl px-5 py-3 border border-emerald-200/40">
              <div className="text-xs font-semibold text-white/90 uppercase tracking-wider">CPD</div>
              <div className="text-2xl font-bold text-white">{typeStats.cpd}</div>
            </div>
            <div className="bg-sky-500/25 backdrop-blur-sm rounded-xl px-5 py-3 border border-sky-200/40">
              <div className="text-xs font-semibold text-white/90 uppercase tracking-wider">Qualification</div>
              <div className="text-2xl font-bold text-white">{typeStats.qualification}</div>
            </div>
            <div className="bg-orange-500/25 backdrop-blur-sm rounded-xl px-5 py-3 border border-orange-200/40">
              <div className="text-xs font-semibold text-white/90 uppercase tracking-wider">Not enrolled</div>
              <div className="text-2xl font-bold text-white">{typeStats.notEnrolled}</div>
            </div>
            <div className="bg-amber-400/30 backdrop-blur-sm rounded-xl px-5 py-3 border border-amber-200/40">
              <div className="text-xs font-semibold text-white/90 uppercase tracking-wider">Pending review</div>
              <div className="text-2xl font-bold text-white">{typeStats.pendingReview}</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl px-5 py-3 border border-white/30">
              <div className="text-xs font-semibold text-white/80 uppercase tracking-wider">Today</div>
              <div className="text-2xl font-bold text-white">{getDateFilterCount('today')}</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl px-5 py-3 border border-white/30">
              <div className="text-xs font-semibold text-white/80 uppercase tracking-wider">This week</div>
              <div className="text-2xl font-bold text-white">{getDateFilterCount('this_week')}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 md:p-5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Onboarding & documents</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {docSnapshotStats.map(card => (
            <button
              key={card.id}
              type="button"
              onClick={() => applyStatusFilter(card.id)}
              className="text-left rounded-xl border-2 transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#11CCEF]/40"
              style={{
                background: card.bg,
                borderColor: statusFilter === card.id ? card.accent : `${card.accent}33`,
                padding: '12px 14px'
              }}
            >
              <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: card.accent }}>
                {card.label}
              </div>
              <div className="text-2xl font-extrabold text-gray-900 mt-1">{card.count}</div>
              {card.sub ? <div className="text-[11px] text-gray-500 mt-0.5">{card.sub}</div> : null}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-lg border-2 border-[#11CCEF]/20 overflow-hidden">
        <div className="bg-gradient-to-r from-[#11CCEF]/10 to-[#E51791]/10 px-6 py-4 border-b-2 border-[#11CCEF]/20">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-[#11CCEF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Search & Filter
          </h3>
        </div>
        <div className="p-6">
          <div
            style={{
              display: 'flex',
              gap: '8px',
              marginBottom: '16px',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: '#64748b',
                marginRight: '4px',
              }}
            >
              Course type:
            </span>
            {(
              [
                { id: 'all' as const, label: '👥 All students', count: students.length },
                { id: 'cpd' as const, label: '✅ CPD', count: students.filter(s => s.student_type === 'cpd').length },
                {
                  id: 'qualification' as const,
                  label: '🎓 Qualification',
                  count: students.filter(s => s.student_type === 'qualification').length,
                },
                {
                  id: 'none' as const,
                  label: '⚠️ Not enrolled',
                  count: students.filter(s => !s.student_type || s.student_type === 'none').length,
                },
              ] as const
            ).map((btn) => (
              <button
                key={btn.id}
                type="button"
                onClick={() => setCourseTypeFilter(btn.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: courseTypeFilter === btn.id ? 'none' : '1.5px solid #e2e8f0',
                  background:
                    courseTypeFilter === btn.id
                      ? btn.id === 'cpd'
                        ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                        : btn.id === 'qualification'
                          ? 'linear-gradient(135deg, #11CCEF, #0ea5e9)'
                          : btn.id === 'none'
                            ? 'linear-gradient(135deg, #f97316, #ea580c)'
                            : 'linear-gradient(135deg, #11CCEF, #E51791)'
                      : '#fff',
                  color: courseTypeFilter === btn.id ? '#fff' : '#64748b',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s',
                }}
              >
                {btn.label}
                <span
                  style={{
                    background: courseTypeFilter === btn.id ? 'rgba(255,255,255,0.3)' : '#f1f5f9',
                    color: courseTypeFilter === btn.id ? '#fff' : '#64748b',
                    borderRadius: '10px',
                    padding: '1px 7px',
                    fontSize: '11px',
                    fontWeight: 800,
                  }}
                >
                  {btn.count}
                </span>
              </button>
            ))}
          </div>

          <div
            style={{
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap',
              alignItems: 'center',
              marginBottom: '16px'
            }}
          >
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginRight: '4px' }}>Status:</span>
            {(
              [
                {
                  id: 'all' as const,
                  label: 'All students',
                  color: '#64748b',
                  bg: '#f8fafc',
                  activeBg: 'linear-gradient(135deg, #11CCEF, #E51791)'
                },
                {
                  id: 'review' as const,
                  label: 'Pending review',
                  color: '#d97706',
                  bg: '#fffbeb',
                  activeBg: 'linear-gradient(135deg, #f59e0b, #d97706)'
                },
                {
                  id: 'rejected_awaiting' as const,
                  label: 'Docs rejected',
                  color: '#dc2626',
                  bg: '#fef2f2',
                  activeBg: 'linear-gradient(135deg, #ef4444, #dc2626)'
                },
                {
                  id: 'resubmitted' as const,
                  label: 'Docs resubmitted',
                  color: '#7c3aed',
                  bg: '#f5f3ff',
                  activeBg: 'linear-gradient(135deg, #8b5cf6, #7c3aed)'
                },
                {
                  id: 'verified' as const,
                  label: 'Verified',
                  color: '#16a34a',
                  bg: '#f0fdf4',
                  activeBg: 'linear-gradient(135deg, #22c55e, #16a34a)'
                },
                {
                  id: 'new' as const,
                  label: 'New',
                  color: '#0369a1',
                  bg: '#f0fbff',
                  activeBg: 'linear-gradient(135deg, #11CCEF, #0369a1)'
                }
              ] as const
            ).map(filter => {
              const count =
                filter.id === 'all'
                  ? students.length
                  : students.filter(s => getDisplayStatus(s) === filter.id).length;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => applyStatusFilter(filter.id)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '20px',
                    border: statusFilter === filter.id ? 'none' : `1.5px solid ${filter.color}22`,
                    background: statusFilter === filter.id ? filter.activeBg : filter.bg,
                    color: statusFilter === filter.id ? '#fff' : filter.color,
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {filter.label}
                  <span
                    style={{
                      background: statusFilter === filter.id ? 'rgba(255,255,255,0.25)' : `${filter.color}22`,
                      borderRadius: '10px',
                      padding: '1px 7px',
                      fontSize: '11px',
                      fontWeight: 800
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4 text-[#11CCEF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search Students
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name or email..."
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#11CCEF] focus:border-[#11CCEF] transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4 text-[#11CCEF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Submission Date
              </label>
              <select
                value={dateFilter}
                onChange={(e) =>
                  setDateFilter(
                    e.target.value as
                      | 'all'
                      | 'today'
                      | 'yesterday'
                      | 'this_week'
                      | 'this_month'
                      | 'last_7_days'
                      | 'last_30_days'
                      | 'custom'
                  )
                }
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#11CCEF] focus:border-[#11CCEF] transition-all font-medium"
              >
                <option value="all">All Time</option>
                <option value="today">📅 Today ({getDateFilterCount('today')})</option>
                <option value="yesterday">📅 Yesterday ({getDateFilterCount('yesterday')})</option>
                <option value="last_7_days">📅 Last 7 Days ({getDateFilterCount('last_7_days')})</option>
                <option value="this_week">📅 This Week ({getDateFilterCount('this_week')})</option>
                <option value="last_30_days">📅 Last 30 Days ({getDateFilterCount('last_30_days')})</option>
                <option value="this_month">📅 This Month ({getDateFilterCount('this_month')})</option>
                <option value="custom">📅 Custom date range</option>
              </select>
            </div>
          </div>

          {dateFilter === 'custom' && (
            <div className="mt-6 pt-6 border-t-2 border-gray-100">
              <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-[#11CCEF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Custom submission date range
              </p>
              <p className="text-xs text-gray-500 mb-3">
                Uses the same &quot;submitted&quot; timestamp as the preset filters (verification request, then onboarding / profile updates).
                Leave either field empty to leave that end open.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
                <div>
                  <label htmlFor="students-profile-date-from" className="block text-xs font-semibold text-gray-600 mb-1.5">
                    From
                  </label>
                  <input
                    id="students-profile-date-from"
                    type="date"
                    value={customDateFrom}
                    onChange={(e) => setCustomDateFrom(e.target.value)}
                    max={customDateTo || undefined}
                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#11CCEF] focus:border-[#11CCEF] text-sm font-medium text-gray-800"
                  />
                </div>
                <div>
                  <label htmlFor="students-profile-date-to" className="block text-xs font-semibold text-gray-600 mb-1.5">
                    To
                  </label>
                  <input
                    id="students-profile-date-to"
                    type="date"
                    value={customDateTo}
                    onChange={(e) => setCustomDateTo(e.target.value)}
                    min={customDateFrom || undefined}
                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#11CCEF] focus:border-[#11CCEF] text-sm font-medium text-gray-800"
                  />
                </div>
                <div className="flex flex-wrap gap-2 pb-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setCustomDateFrom('');
                      setCustomDateTo('');
                    }}
                    className="px-4 py-2.5 text-sm font-semibold rounded-xl border-2 border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Clear dates
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Quick Filter Buttons */}
          <div className="mt-6 pt-6 border-t-2 border-gray-100">
            <p className="text-sm font-semibold text-gray-700 mb-3">Quick Filters:</p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => {
                  setStatusFilter('review');
                  setDateFilter('today');
                }}
                type="button"
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-400 to-orange-500 text-white font-semibold rounded-xl hover:shadow-lg transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Today's Reviews
              </button>
              <button
                onClick={() => {
                  setStatusFilter('review');
                  setDateFilter('this_week');
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white font-semibold rounded-xl hover:shadow-lg transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                This Week's Reviews
              </button>
              <button
                onClick={() => {
                  setStatusFilter('new');
                  setDateFilter('today');
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-gray-400 to-gray-500 text-white font-semibold rounded-xl hover:shadow-lg transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Today
              </button>
              <button
                onClick={() => {
                  setStatusFilter('verified');
                  setDateFilter('this_week');
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#61CE70] to-[#51be60] text-white font-semibold rounded-xl hover:shadow-lg transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
                Verified This Week
              </button>
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setDateFilter('all');
                  setCustomDateFrom('');
                  setCustomDateTo('');
                  setSearchTerm('');
                  setCourseTypeFilter('all');
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Clear All Filters
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {canSendMessageToStudent && (
        <div
          className="rounded-2xl px-5 py-4 flex flex-wrap items-center justify-between gap-3 border-2 border-pink-200"
          style={{ background: 'linear-gradient(135deg, #fdf2f8, #fff)' }}
        >
          <div>
            <p className="text-sm font-bold text-gray-900 m-0">💬 Message a student</p>
            <p className="text-xs text-gray-600 mt-1 mb-0">
              Scroll to the student list below and click <strong>Send Message</strong> on any row, or open their profile first.
            </p>
          </div>
        </div>
      )}

      {/* Students Table */}
      <div className="bg-white rounded-2xl shadow-lg border-2 border-[#11CCEF]/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-[#11CCEF]/10 to-[#E51791]/10">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Student
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Onboarding Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Submitted Date
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="bg-gradient-to-br from-[#11CCEF]/10 to-[#E51791]/10 w-16 h-16 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-[#11CCEF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                      </div>
                      <p className="text-gray-500 text-lg font-medium">No students found</p>
                      <p className="text-gray-400 text-sm">Try adjusting your search or filter</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedStudents.map((student, index) => {
                  return (
                    <tr key={student.user_id || `student-${index}`} className="hover:bg-gradient-to-r hover:from-[#11CCEF]/5 hover:to-[#E51791]/5 transition-all">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {student.profile_picture ? (
                            <img
                              src={student.profile_picture}
                              alt={student.name}
                              className="h-12 w-12 rounded-xl mr-4 object-cover border-2 border-[#11CCEF]/20 shadow-sm"
                            />
                          ) : (
                            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#11CCEF] to-[#0daed9] flex items-center justify-center text-white font-bold mr-4 shadow-md text-lg">
                              {student.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="text-sm font-semibold text-gray-900 flex flex-wrap items-center gap-1">
                              <span>{student.name}</span>
                              {student.student_type === 'cpd' && (
                                <span
                                  style={{
                                    background: '#f0fdf4',
                                    color: '#16a34a',
                                    border: '1px solid #bbf7d0',
                                    borderRadius: '6px',
                                    padding: '1px 7px',
                                    fontSize: '10px',
                                    fontWeight: 700,
                                  }}
                                >
                                  CPD
                                </span>
                              )}
                              {student.student_type === 'qualification' && (
                                <span
                                  style={{
                                    background: '#f0fbff',
                                    color: '#0369a1',
                                    border: '1px solid #bae6fd',
                                    borderRadius: '6px',
                                    padding: '1px 7px',
                                    fontSize: '10px',
                                    fontWeight: 700,
                                  }}
                                >
                                  Qualification
                                </span>
                              )}
                              {(!student.student_type || student.student_type === 'none') && (
                                <span
                                  style={{
                                    background: '#fff7ed',
                                    color: '#c2410c',
                                    border: '1px solid #fed7aa',
                                    borderRadius: '6px',
                                    padding: '1px 7px',
                                    fontSize: '10px',
                                    fontWeight: 700,
                                  }}
                                >
                                  Not enrolled
                                </span>
                              )}
                            </div>
                            {student.learner_id && (
                              <div className="text-xs text-[#11CCEF] font-semibold mt-0.5">Learner ID: {student.learner_id}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          <div>
                            <div>{student.email}</div>
                            {student.enrolled_courses ? (
                              <div
                                style={{
                                  fontSize: '10px',
                                  color: '#94a3b8',
                                  marginTop: '2px',
                                  maxWidth: '280px',
                                }}
                                className="line-clamp-2"
                                title={student.enrolled_courses}
                              >
                                📚 {student.enrolled_courses}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap align-top">{getStatusBadge(student)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {student.verification_requested_at
                          ? new Date(student.verification_requested_at).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : student.onboarding_updated_at
                          ? new Date(student.onboarding_updated_at).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })
                          : student.updated_at
                          ? new Date(student.updated_at).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })
                          : 'Never'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex flex-wrap items-center gap-2">
                          {canSendMessageToStudent && (
                            <button
                              type="button"
                              onClick={() => {
                                setMessageStudent(student);
                                setShowMessageModal(true);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-2 text-white font-bold rounded-xl border-0 cursor-pointer text-xs hover:opacity-90"
                              style={{
                                background: 'linear-gradient(135deg, #e51791, #c1147a)',
                                boxShadow: '0 2px 8px rgba(229,23,145,0.25)',
                              }}
                              title="Send a support message to this student"
                            >
                              💬 Send Message
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleViewProfile(student)}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#11CCEF] to-[#0daed9] text-white font-semibold rounded-xl hover:shadow-lg transition-all"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            View Profile
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {filteredStudents.length > 0 && (
          <div className="bg-gradient-to-r from-[#11CCEF]/5 to-[#E51791]/5 px-6 py-4 border-t-2 border-[#11CCEF]/20">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Results Info */}
              <div className="text-sm text-gray-600">
                Showing{' '}
                <span className="font-bold text-gray-900">
                  {itemsPerPage === 'all' ? totalItems : startIndex + 1}
                </span>
                {' '}-{' '}
                <span className="font-bold text-gray-900">
                  {itemsPerPage === 'all' ? totalItems : Math.min(endIndex, totalItems)}
                </span>
                {' '}of{' '}
                <span className="font-bold text-gray-900">{totalItems}</span>
                {' '}students
              </div>

              {/* Items per page selector */}
              <div className="flex items-center gap-3">
                <label className="text-sm font-semibold text-gray-700">Show:</label>
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                  className="px-4 py-2 border-2 border-[#11CCEF]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#11CCEF] font-semibold text-gray-700 bg-white"
                >
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value="all">All</option>
                </select>
              </div>

              {/* Page Navigation */}
              {itemsPerPage !== 'all' && totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="px-3 py-2 rounded-lg font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#11CCEF]/10 transition-all"
                    title="First page"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 rounded-lg font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed bg-white border-2 border-[#11CCEF]/20 hover:bg-[#11CCEF]/10 transition-all"
                  >
                    Previous
                  </button>
                  
                  {/* Page numbers */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-10 h-10 rounded-lg font-bold text-sm transition-all ${
                            currentPage === pageNum
                              ? 'bg-gradient-to-r from-[#11CCEF] to-[#0daed9] text-white shadow-lg'
                              : 'bg-white border-2 border-[#11CCEF]/20 text-gray-700 hover:bg-[#11CCEF]/10'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 rounded-lg font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed bg-white border-2 border-[#11CCEF]/20 hover:bg-[#11CCEF]/10 transition-all"
                  >
                    Next
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 rounded-lg font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#11CCEF]/10 transition-all"
                    title="Last page"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {canSendMessageToStudent && messageStudent && (
        <SendMessageToStudentModal
          studentId={messageStudent.user_id}
          studentName={messageStudent.name}
          open={showMessageModal}
          onClose={() => {
            setShowMessageModal(false);
            setMessageStudent(null);
          }}
          onSuccess={(ticketId) => router.push(`/dashboard/tickets/${ticketId}`)}
        />
      )}

    </div>
  );
};

export default StudentsProfileView;

