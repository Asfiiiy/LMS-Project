'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiService } from '@/app/services/api';
import { showToast } from '@/app/components/Toast';
import { ProfileSkeleton } from '@/app/components/ui/Skeleton';

function formatTime(t: string) {
  return String(t).slice(0, 5);
}

function slotDate(s: { date: string | Date }) {
  const d = s.date;
  return d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
}

export default function ConsultationManagerStudentPage() {
  const params = useParams();
  const studentId = Number(params?.studentId);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [qualProgress, setQualProgress] = useState<any[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(studentId) || studentId <= 0) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [p, b, e] = await Promise.all([
        apiService.getStudentProfileById(studentId),
        apiService.getConsultationBookings({ scope: 'all', student_id: studentId }),
        apiService.getConsultationManagerStudentEnrollments(studentId),
      ]);
      if (p?.success && p.profile) setProfile(p.profile);
      else setProfile(null);
      if (b?.success) setBookings(b.bookings || []);
      if (e?.success) setEnrollments(e.enrollments || []);
    } catch {
      showToast('Failed to load student', 'error');
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!Number.isFinite(studentId) || studentId <= 0) return;
    setLoadingProgress(true);
    apiService
      .getConsultationManagerStudentQualProgress(studentId)
      .then((res: any) => {
        if (res?.success) {
          setQualProgress(res.data || []);
        }
      })
      .catch((e: unknown) => {
        console.error('QualProgress:', e);
      })
      .finally(() => {
        setLoadingProgress(false);
      });
  }, [studentId]);

  if (!Number.isFinite(studentId) || studentId <= 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100">
        <div className="text-center p-8 bg-white rounded-2xl shadow-xl">
          <div className="text-6xl mb-4">⚠️</div>
          <p className="text-red-600 text-lg font-semibold">Invalid student</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ProfileSkeleton />
      </div>
    );
  }

  const pic = profile?.profile_picture_url || profile?.profile_picture || null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Back Button */}
        <Link 
          href="/dashboard/consultation-manager/bookings" 
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#11CCEF] hover:text-[#0EA5D9] transition-all duration-300 group"
        >
          <svg className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to bookings
        </Link>

        {/* Profile Header - Premium Card */}
        <div className="relative bg-white rounded-3xl shadow-xl overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-r from-[#11CCEF] to-[#E51791] opacity-10"></div>
          <div className="relative p-6 md:p-8 flex flex-col md:flex-row gap-6 md:gap-8 items-center md:items-start">
            <div className="relative">
              <div className="w-28 h-28 md:w-32 md:h-32 rounded-full overflow-hidden bg-gradient-to-br from-[#11CCEF] to-[#E51791] flex items-center justify-center text-3xl font-bold text-white shadow-lg ring-4 ring-white">
                {pic ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pic} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span>{(profile?.name || '?').slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-4 border-white"></div>
            </div>
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">{profile?.name || 'Student'}</h1>
              <p className="text-slate-600 text-lg mb-3">{profile?.email}</p>
              <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                  Student ID: {studentId}
                </span>
                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                  {enrollments.length} Courses
                </span>
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                  {bookings.length} Consultations
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Course Enrollment - Modern Grid */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl md:text-2xl font-bold text-slate-900">Course Enrollment</h2>
            <div className="h-px flex-1 bg-gradient-to-r from-[#11CCEF] to-transparent ml-4"></div>
          </div>
          <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
            {enrollments.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-4xl mb-3">📚</div>
                <p className="text-slate-500">No enrollments found.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {enrollments.map((row, idx) => (
                  <div key={row.course_id} className="p-5 hover:bg-slate-50 transition-colors group">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-[#11CCEF] to-[#E51791] rounded-lg flex items-center justify-center text-white font-bold text-sm">
                          {idx + 1}
                        </div>
                        <span className="font-semibold text-slate-900 group-hover:text-[#11CCEF] transition-colors">
                          {row.title}
                        </span>
                      </div>
                      <span className={`text-xs font-medium px-3 py-1 rounded-full w-fit ${
                        row.enrollment_status === 'active' || row.course_type === 'active'
                          ? 'bg-green-100 text-green-700'
                          : row.enrollment_status === 'completed'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {row.enrollment_status || row.course_type || 'Enrolled'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Unit Progress Section - Enhanced Design */}
        {loadingProgress ? (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#11CCEF] mb-3"></div>
            <p className="text-slate-500">Loading unit progress...</p>
          </div>
        ) : (
          qualProgress.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl md:text-2xl font-bold text-slate-900">Unit Progress</h2>
                <div className="h-px flex-1 bg-gradient-to-r from-[#E51791] to-transparent ml-4"></div>
              </div>

              <div className="space-y-6">
                {qualProgress.map((course) => (
                  <div key={course.course_id} className="bg-white rounded-2xl shadow-lg overflow-hidden">
                    <div className="bg-gradient-to-r from-[#11CCEF] to-[#E51791] px-6 py-4">
                      <p className="text-white font-semibold text-lg">
                        {course.course_title}
                      </p>
                    </div>

                    <div className="p-6 space-y-4">
                      {course.units.map((unit: any) => {
                        const isLocked = !unit.is_unlocked;
                        const isCompleted = unit.is_completed;
                        const isSubmitted = unit.assignment_submitted;
                        const status = unit.assignment_status;
                        const latestSub = unit.submissions?.[0];
                        const passFail = String(latestSub?.pass_fail_result || '').toLowerCase();
                        const hasRejected = latestSub?.files?.some((f: any) => f.status === 'resubmit_requested');

                        let statusColor = '#64748b';
                        let statusBg = '#f1f5f9';
                        let statusLabel = 'Not Started';
                        let statusIcon = '📋';

                        if (isLocked) {
                          statusColor = '#94a3b8';
                          statusBg = '#f8fafc';
                          statusLabel = 'Locked';
                          statusIcon = '🔒';
                        } else if (isCompleted) {
                          statusColor = '#16a34a';
                          statusBg = '#dcfce7';
                          statusLabel = 'Completed';
                          statusIcon = '✅';
                        } else if (status === 'pass' || passFail === 'pass') {
                          statusColor = '#16a34a';
                          statusBg = '#dcfce7';
                          statusLabel = 'Passed';
                          statusIcon = '🎉';
                        } else if (status === 'refer' || passFail === 'refer') {
                          statusColor = '#dc2626';
                          statusBg = '#fee2e2';
                          statusLabel = 'Referred';
                          statusIcon = '🔄';
                        } else if (hasRejected) {
                          statusColor = '#dc2626';
                          statusBg = '#fee2e2';
                          statusLabel = 'File Rejected';
                          statusIcon = '❌';
                        } else if (isSubmitted) {
                          statusColor = '#d97706';
                          statusBg = '#fef3c7';
                          statusLabel = 'Awaiting Grade';
                          statusIcon = '⏳';
                        } else if (!isLocked) {
                          statusColor = '#2563eb';
                          statusBg = '#dbeafe';
                          statusLabel = 'In Progress';
                          statusIcon = '📝';
                        }

                        const feedbackText = typeof latestSub?.feedback === 'string'
                          ? latestSub.feedback
                          : latestSub?.feedback != null
                            ? String(latestSub.feedback)
                            : '';

                        return (
                          <div
                            key={unit.unit_id}
                            className={`rounded-xl border-2 transition-all duration-300 hover:shadow-md ${
                              isLocked ? 'border-gray-100 bg-gray-50/50' : 'border-gray-100 bg-white hover:border-[#11CCEF]/30'
                            }`}
                          >
                            <div className="p-5">
                              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-start gap-3 mb-3">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0 ${
                                      isLocked ? 'bg-gray-100' : 'bg-gradient-to-br from-[#11CCEF]/10 to-[#E51791]/10'
                                    }`}>
                                      {statusIcon}
                                    </div>
                                    <div className="flex-1">
                                      <h3 className={`font-bold text-base md:text-lg ${
                                        isLocked ? 'text-gray-400' : 'text-slate-900'
                                      }`}>
                                        {unit.unit_title}
                                      </h3>
                                      
                                      <div className="flex flex-wrap gap-3 mt-2">
                                        {unit.deadline && (
                                          <div className="flex items-center gap-1 text-xs text-slate-500">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            <span>{new Date(unit.deadline).toLocaleDateString('en-GB')}</span>
                                          </div>
                                        )}
                                        
                                        {Number(unit.assignment_submission_unlocked) === 1 && (
                                          <div className="flex items-center gap-1 text-xs text-blue-600 font-semibold">
                                            <span>🔓</span>
                                            <span>Manual Override Active</span>
                                          </div>
                                        )}
                                      </div>

                                      {latestSub?.submitted_at && (
                                        <div className="mt-2 text-xs text-slate-500">
                                          📤 Submitted: {new Date(latestSub.submitted_at).toLocaleDateString('en-GB')}
                                        </div>
                                      )}

                                      {latestSub?.graded_at && (
                                        <div className="text-xs text-slate-500">
                                          ✏️ Graded: {new Date(latestSub.graded_at).toLocaleDateString('en-GB')}
                                          {latestSub.graded_by_name && ` by ${latestSub.graded_by_name}`}
                                        </div>
                                      )}

                                      {feedbackText && (
                                        <div className="mt-3 p-3 bg-slate-50 rounded-lg border-l-4 border-[#11CCEF]">
                                          <p className="text-xs text-slate-700">
                                            <span className="font-semibold">💬 Feedback:</span> {feedbackText}
                                          </p>
                                        </div>
                                      )}

                                      {hasRejected && (
                                        <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 rounded text-xs font-semibold">
                                          <span>⚠️</span>
                                          <span>File rejected — awaiting resubmission</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="lg:text-right">
                                  <span
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shadow-sm"
                                    style={{ background: statusBg, color: statusColor }}
                                  >
                                    <span>{statusIcon}</span>
                                    <span>{statusLabel}</span>
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )
        )}

        {/* Consultation History - Premium Table */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl md:text-2xl font-bold text-slate-900">Consultation History</h2>
            <div className="h-px flex-1 bg-gradient-to-r from-[#11CCEF] to-transparent ml-4"></div>
          </div>
          
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            {bookings.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-4xl mb-3">💬</div>
                <p className="text-slate-500">No consultations yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gradient-to-r from-slate-50 to-white border-b-2 border-slate-200">
                      <th className="px-4 py-4 text-left font-semibold text-slate-700">Date</th>
                      <th className="px-4 py-4 text-left font-semibold text-slate-700">Time</th>
                      <th className="px-4 py-4 text-left font-semibold text-slate-700">Status</th>
                      <th className="px-4 py-4 text-left font-semibold text-slate-700">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map((b, idx) => (
                      <tr key={b.id} className={`border-t border-slate-100 hover:bg-slate-50 transition-colors ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                      }`}>
                        <td className="px-4 py-3 font-medium text-slate-900">{slotDate(b)}</td>
                        <td className="px-4 py-3 text-slate-600">
                          <span className="inline-flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {formatTime(b.start_time)} – {formatTime(b.end_time)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium capitalize ${
                            b.status === 'completed' ? 'bg-green-100 text-green-700' :
                            b.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              b.status === 'completed' ? 'bg-green-500' :
                              b.status === 'cancelled' ? 'bg-red-500' :
                              'bg-yellow-500'
                            }`}></span>
                            {b.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                          {b.notes || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}