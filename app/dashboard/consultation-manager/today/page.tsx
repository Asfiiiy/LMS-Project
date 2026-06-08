'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSocket } from '@/app/contexts/SocketContext';
import { apiService } from '@/app/services/api';
import { showToast } from '@/app/components/Toast';
import Swal from 'sweetalert2';
import {
  FiClock,
  FiUser,
  FiMail,
  FiVideo,
  FiCheck,
  FiCalendar,
  FiActivity,
  FiArrowRight,
  FiMoreVertical,
  FiPlay,
  FiPause,
  FiAlertCircle,
  FiRefreshCw,
  FiChevronRight,
  FiMapPin,
  FiMessageCircle
} from 'react-icons/fi';

// Utility functions - KEPT EXACTLY THE SAME
function formatTime(t: string) {
  return String(t).slice(0, 5);
}

function parseToday(str: string) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function timeToMinutes(t: string) {
  const [h, m] = String(t).slice(0, 5).split(':').map(Number);
  return h * 60 + m;
}

function minsToLabel(m: number) {
  if (m < 0) return 'Started';
  const h = Math.floor(m / 60);
  const m2 = m % 60;
  if (h > 0) return `${h}h ${m2}m`;
  return `${m2}m`;
}

function countdownParts(totalSec: number) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return { h, m, s };
}

// Enhanced Timeline Item Component
const TimelineItem = ({ 
  consultation, 
  now, 
  onComplete 
}: { 
  consultation: any; 
  now: Date;
  onComplete: (id: number) => void;
}) => {
  const ds = consultation.date instanceof Date 
    ? consultation.date.toISOString().slice(0, 10) 
    : String(consultation.date).slice(0, 10);
  const st = String(consultation.start_time).slice(0, 5);
  const et = String(consultation.end_time || consultation.start_time).slice(0, 5);
  const startMs = new Date(`${ds}T${st}:00`).getTime();
  const endMs = new Date(`${ds}T${et}:00`).getTime();
  const t = now.getTime();
  
  const isCompleted = consultation.status === 'completed';
  const isLive = !isCompleted && t >= startMs && t < endMs;
  const isPast = isCompleted || t >= endMs;
  const isPending = consultation.status === 'pending';
  
  let statusColor = 'bg-gray-400';
  let borderColor = 'border-gray-200';
  let bgGradient = 'from-white to-gray-50';
  let statusIcon = null;
  let statusText = '';
  
  if (isLive) {
    statusColor = 'bg-green-500';
    borderColor = 'border-green-300';
    bgGradient = 'from-green-50 to-emerald-50';
    statusIcon = <FiPlay className="w-3 h-3" />;
    statusText = 'LIVE NOW';
  } else if (isCompleted) {
    statusColor = 'bg-blue-500';
    borderColor = 'border-gray-200';
    bgGradient = 'from-gray-50 to-gray-100';
    statusIcon = <FiCheck className="w-3 h-3" />;
    statusText = 'Completed';
  } else if (isPending) {
    statusColor = 'bg-amber-500';
    borderColor = 'border-amber-200';
    bgGradient = 'from-amber-50 to-orange-50';
    statusIcon = <FiAlertCircle className="w-3 h-3" />;
    statusText = 'Pending';
  } else {
    statusColor = 'bg-cyan-500';
    borderColor = 'border-cyan-200';
    bgGradient = 'from-blue-50 to-cyan-50';
    statusIcon = <FiClock className="w-3 h-3" />;
    statusText = 'Upcoming';
  }
  
  let remainText = '';
  let progressPercent = 0;
  
  if (!isPast && !isLive) {
    const minutesUntil = Math.ceil((startMs - t) / 60000);
    remainText = `Starts in ${minsToLabel(minutesUntil)}`;
  } else if (isLive) {
    const totalDuration = endMs - startMs;
    const elapsed = t - startMs;
    progressPercent = Math.min(100, (elapsed / totalDuration) * 100);
    const remainingMs = endMs - t;
    const remainingMin = Math.ceil(remainingMs / 60000);
    remainText = `${minsToLabel(remainingMin)} remaining`;
  } else if (isCompleted) {
    remainText = '✓ Completed';
  } else {
    remainText = 'Ended';
  }

  return (
    <div className="relative pl-8">
      {/* Timeline connector */}
      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-cyan-400 via-blue-400 to-purple-400" />
      
      {/* Timeline dot */}
      <div className={`absolute -left-1.5 top-6 w-4 h-4 rounded-full border-3 border-white shadow-lg ${statusColor} ${isLive ? 'animate-pulse' : ''}`}>
        {isLive && (
          <div className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-75" />
        )}
      </div>
      
      {/* Card */}
      <div className={`relative rounded-2xl border-2 ${borderColor} bg-gradient-to-br ${bgGradient} p-5 shadow-lg hover:shadow-xl transition-all duration-300 ${isLive ? 'ring-4 ring-green-300/50' : ''}`}>
        {/* Status Badge */}
        <div className="absolute -top-3 left-4">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shadow-md ${
            isLive ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white animate-pulse' :
            isCompleted ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white' :
            isPending ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white' :
            'bg-gradient-to-r from-cyan-500 to-blue-600 text-white'
          }`}>
            {statusIcon}
            {statusText}
          </span>
        </div>
        
        {/* Time Section */}
        <div className="mt-4 mb-3">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center gap-2">
              <FiClock className="w-4 h-4 text-gray-500" />
              <span className="text-lg font-bold text-gray-900">
                {formatTime(consultation.start_time)} – {formatTime(consultation.end_time)}
              </span>
            </div>
            {!isCompleted && !isPending && (
              <span className={`text-sm font-medium ${isLive ? 'text-green-600' : 'text-gray-600'}`}>
                {remainText}
              </span>
            )}
          </div>
          
          {/* Progress bar for live sessions */}
          {isLive && (
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-1000"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}
        </div>
        
        {/* Student Info */}
        <div className="flex items-start gap-4 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
            {consultation.student_name?.charAt(0) || '?'}
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-gray-900 text-lg">{consultation.student_name}</h3>
            <p className="text-sm text-gray-600 flex items-center gap-1">
              <FiMail className="w-3 h-3" />
              {consultation.student_email}
            </p>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <FiClock className="w-3 h-3" />
                {consultation.duration_minutes ?? 30} min
              </span>
              {consultation.notes && (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <FiMessageCircle className="w-3 h-3" />
                  Has notes
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* Actions */}
        {!isCompleted && consultation.status === 'confirmed' && (
          <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-200">
            {consultation.zoom_start_url && (
              <a
                href={consultation.zoom_start_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
              >
                <FiVideo className="w-5 h-5" />
                Join Zoom Call
                <FiArrowRight className="w-4 h-4" />
              </a>
            )}
            <button
              type="button"
              onClick={() => onComplete(consultation.booking_id)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold shadow-md hover:shadow-lg transition-all"
            >
              <FiCheck className="w-5 h-5" />
              Mark Complete
            </button>
            <Link
              href={`/dashboard/consultation-manager/students/${consultation.student_id}`}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-all"
            >
              <FiUser className="w-4 h-4" />
              Student Profile
              <FiChevronRight className="w-4 h-4" />
            </Link>
          </div>
        )}
        
        {!isCompleted && consultation.status === 'pending' && (
          <div className="pt-3 border-t border-amber-200">
            <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
              <p className="text-sm text-amber-800 flex items-start gap-2">
                <FiAlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                  Awaiting confirmation — visit{' '}
                  <Link href="/dashboard/consultation-manager/bookings" className="font-bold text-amber-900 underline hover:text-amber-700">
                    All Bookings
                  </Link>{' '}
                  to confirm, deny, or reschedule.
                </span>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Countdown Timer Component
const CountdownTimer = ({ seconds }: { seconds: number }) => {
  const { h, m, s } = countdownParts(Math.max(0, Math.floor(seconds)));
  
  return (
    <div className="flex items-center justify-center gap-2">
      <div className="text-center">
        <div className="bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl px-4 py-2 shadow-lg">
          <span className="text-3xl font-bold text-white tabular-nums">{String(h).padStart(2, '0')}</span>
        </div>
        <span className="text-xs font-medium text-gray-600 mt-1 block">Hours</span>
      </div>
      <span className="text-2xl font-bold text-gray-400 mb-4">:</span>
      <div className="text-center">
        <div className="bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl px-4 py-2 shadow-lg">
          <span className="text-3xl font-bold text-white tabular-nums">{String(m).padStart(2, '0')}</span>
        </div>
        <span className="text-xs font-medium text-gray-600 mt-1 block">Minutes</span>
      </div>
      <span className="text-2xl font-bold text-gray-400 mb-4">:</span>
      <div className="text-center">
        <div className="bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl px-4 py-2 shadow-lg">
          <span className="text-3xl font-bold text-white tabular-nums">{String(s).padStart(2, '0')}</span>
        </div>
        <span className="text-xs font-medium text-gray-600 mt-1 block">Seconds</span>
      </div>
    </div>
  );
};

// Summary Stats Component
const SummaryStats = ({ list, now }: { list: any[]; now: Date }) => {
  const completed = list.filter(c => c.status === 'completed').length;
  const confirmed = list.filter(c => c.status === 'confirmed').length;
  const pending = list.filter(c => c.status === 'pending').length;
  const total = list.length;
  
  const nowMs = now.getTime();
  const upcoming = list.filter(c => {
    if (c.status === 'completed') return false;
    const ds = c.date instanceof Date ? c.date.toISOString().slice(0, 10) : String(c.date).slice(0, 10);
    const st = String(c.start_time).slice(0, 5);
    const startMs = new Date(`${ds}T${st}:00`).getTime();
    return startMs > nowMs;
  }).length;
  
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-200">
        <p className="text-xs font-semibold text-blue-600 mb-1">Total Sessions</p>
        <p className="text-2xl font-bold text-blue-900">{total}</p>
      </div>
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
        <p className="text-xs font-semibold text-green-600 mb-1">Completed</p>
        <p className="text-2xl font-bold text-green-900">{completed}</p>
        <p className="text-xs text-green-600 mt-1">{total > 0 ? `${((completed/total)*100).toFixed(0)}%` : '0%'}</p>
      </div>
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-200">
        <p className="text-xs font-semibold text-amber-600 mb-1">Pending</p>
        <p className="text-2xl font-bold text-amber-900">{pending}</p>
      </div>
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200">
        <p className="text-xs font-semibold text-purple-600 mb-1">Upcoming</p>
        <p className="text-2xl font-bold text-purple-900">{upcoming}</p>
      </div>
    </div>
  );
};

// Main Component
export default function ConsultationManagerTodayPage() {
  const socket = useSocket();
  
  // State - KEPT EXACTLY THE SAME
  const [list, setList] = useState<any[]>([]);
  const [dateStr, setDateStr] = useState('');
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoCompletedRef = useRef<Set<string>>(new Set());

  // Load function - KEPT EXACTLY THE SAME
  const load = useCallback(async () => {
    try {
      const res = await apiService.getTodaysConsultations();
      if (res?.success) {
        setList(res.consultations || []);
        setDateStr(res.date || new Date().toISOString().slice(0, 10));
      }
    } catch {
      showToast('Failed to load', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Effects - KEPT EXACTLY THE SAME
  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    tick.current = setInterval(() => setNow(new Date()), 1000);
    return () => {
      if (tick.current) clearInterval(tick.current);
    };
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onBooked = () => load();
    const onCancelled = () => load();
    const onCompleted = () => load();
    socket.on('slot_booked', onBooked);
    socket.on('consultation_cancelled', onCancelled);
    socket.on('consultation_reminder_cm', onBooked);
    socket.on('consultation_completed', onCompleted);
    return () => {
      socket.off('slot_booked', onBooked);
      socket.off('consultation_cancelled', onCancelled);
      socket.off('consultation_reminder_cm', onBooked);
      socket.off('consultation_completed', onCompleted);
    };
  }, [socket, load]);

  useEffect(() => {
    const t = now.getTime();
    for (const c of list) {
      if (c.status !== 'confirmed') continue;
      const ds = c.date instanceof Date ? c.date.toISOString().slice(0, 10) : String(c.date).slice(0, 10);
      const et = String(c.end_time || c.start_time).slice(0, 5);
      const endMs = new Date(`${ds}T${et}:00`).getTime();
      if (t < endMs) continue;
      const key = `booking_${c.booking_id}`;
      if (autoCompletedRef.current.has(key)) continue;
      autoCompletedRef.current.add(key);
      apiService.markConsultationComplete(c.booking_id)
        .then(() => load())
        .catch(() => { autoCompletedRef.current.delete(key); });
    }
  }, [now, list, load]);

  // Actions - KEPT EXACTLY THE SAME
  const markComplete = async (bookingId: number) => {
    const r = await Swal.fire({
      title: 'Mark as completed?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#22c55e',
      confirmButtonText: 'Yes'
    });
    if (!r.isConfirmed) return;
    try {
      const res = await apiService.markConsultationComplete(bookingId);
      if (res?.success) {
        showToast('Completed', 'success');
        load();
      } else showToast(res?.message || 'Failed', 'error');
    } catch {
      showToast('Failed', 'error');
    }
  };

  // Data processing
  const today = dateStr || new Date().toISOString().slice(0, 10);
  const sorted = [...list].sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));
  
  const dateStrFor = (c: { date: string | Date }) => {
    const d = c.date;
    return d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
  };

  let nextUpcoming: any = null;
  let nextSec = Infinity;
  const nowMs = now.getTime();
  for (const c of sorted) {
    if (c.status === 'completed') continue;
    const ds = dateStrFor(c);
    const st = String(c.start_time).slice(0, 5);
    const startMs = new Date(`${ds}T${st}:00`).getTime();
    if (startMs > nowMs) {
      nextSec = Math.floor((startMs - nowMs) / 1000);
      nextUpcoming = c;
      break;
    }
  }

  const clock = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const hasLiveSession = sorted.some(c => {
    if (c.status === 'completed') return false;
    const ds = dateStrFor(c);
    const st = String(c.start_time).slice(0, 5);
    const et = String(c.end_time || c.start_time).slice(0, 5);
    const startMs = new Date(`${ds}T${st}:00`).getTime();
    const endMs = new Date(`${ds}T${et}:00`).getTime();
    return nowMs >= startMs && nowMs < endMs;
  });

  return (
    <div className="w-full max-w-full 2xl:max-w-[1600px] mx-auto space-y-8 px-4 sm:px-6 lg:px-8 py-6">
      {/* Header - Enhanced */}
      <header className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-50 via-blue-50 to-purple-50 rounded-3xl -z-10 opacity-50" />
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 py-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg">
                <FiCalendar className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                Today's Consultations
              </h1>
            </div>
            <p className="text-lg text-gray-600 ml-14">
              {parseToday(today).toLocaleDateString('en-GB', { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric' 
              })}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            {hasLiveSession && (
              <div className="flex items-center gap-2 px-4 py-2 bg-green-500 rounded-xl shadow-lg animate-pulse">
                <div className="w-2 h-2 bg-white rounded-full animate-ping" />
                <span className="text-white font-bold text-sm">LIVE SESSION</span>
              </div>
            )}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-lg px-6 py-3">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Current Time</p>
              <p className="text-3xl font-mono font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent tabular-nums">
                {clock}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Summary */}
      {!loading && list.length > 0 && <SummaryStats list={list} now={now} />}

      {/* Next Call Countdown */}
      {nextUpcoming && nextSec >= 0 && nextSec < 86400 && (
        <div className="bg-gradient-to-r from-cyan-50 via-blue-50 to-purple-50 rounded-2xl border-2 border-cyan-200 p-6 shadow-lg">
          <div className="text-center space-y-4">
            <div>
              <p className="text-sm font-semibold text-cyan-700 uppercase tracking-wider mb-2">
                Next Call with {nextUpcoming.student_name}
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {formatTime(nextUpcoming.start_time)} – {formatTime(nextUpcoming.end_time)}
              </p>
            </div>
            <CountdownTimer seconds={nextSec} />
          </div>
        </div>
      )}

      {/* Timeline */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-cyan-200 border-t-cyan-600 rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <FiClock className="w-6 h-6 text-cyan-600" />
            </div>
          </div>
        </div>
      ) : (
        <div className="relative">
          {sorted.length === 0 && (
            <div className="bg-white rounded-2xl border-2 border-dashed border-gray-300 p-12 text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <FiCalendar className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">No consultations today</h3>
              <p className="text-gray-600 mb-6">Your schedule is clear for today</p>
              <Link
                href="/dashboard/consultation-manager/slots"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all"
              >
                <FiCalendar className="w-5 h-5" />
                Manage Availability
                <FiArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
          
          {sorted.length > 0 && (
            <div className="space-y-6">
              {sorted.map((c) => (
                <TimelineItem
                  key={c.booking_id}
                  consultation={c}
                  now={now}
                  onComplete={markComplete}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick Actions */}
      {!loading && sorted.length > 0 && (
        <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
          <Link
            href="/dashboard/consultation-manager/bookings"
            className="inline-flex items-center gap-2 px-5 py-3 bg-white border border-gray-300 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 transition-all"
          >
            <FiActivity className="w-4 h-4" />
            View All Bookings
          </Link>
          <Link
            href="/dashboard/consultation-manager/slots"
            className="inline-flex items-center gap-2 px-5 py-3 bg-white border border-gray-300 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 transition-all"
          >
            <FiCalendar className="w-4 h-4" />
            Manage Slots
          </Link>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 px-5 py-3 bg-white border border-gray-300 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 transition-all"
          >
            <FiRefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      )}
    </div>
  );
}