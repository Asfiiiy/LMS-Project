'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSocket } from '@/app/contexts/SocketContext';
import { apiService } from '@/app/services/api';
import { showToast } from '@/app/components/Toast';
import { StatSkeleton } from '@/app/components/ui/Skeleton';
import Swal from 'sweetalert2';
import {
  FiCalendar,
  FiClock,
  FiUser,
  FiMail,
  FiVideo,
  FiCheck,
  FiX,
  FiChevronRight,
  FiTrendingUp,
  FiUsers,
  FiBookOpen,
  FiActivity,
  FiAlertCircle,
  FiBell,
  FiArrowUp,
  FiArrowDown,
  FiMoreHorizontal,
  FiGrid,
  FiList
} from 'react-icons/fi';

// Utility functions - KEPT EXACTLY THE SAME
function playNotificationBeep() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 880;
    g.gain.value = 0.08;
    o.start();
    o.stop(ctx.currentTime + 0.12);
  } catch {
    /* ignore */
  }
}

function formatTime(t: string) {
  return String(t).slice(0, 5);
}

function formatDateLong(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function greetingName(name: string) {
  const h = new Date().getHours();
  const g = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return `${g}, ${name || 'there'}!`;
}

// Enhanced Stat Card Component
const StatCard = ({ 
  title, 
  value, 
  icon: Icon, 
  color, 
  trend, 
  subtitle 
}: { 
  title: string; 
  value: number | string; 
  icon: any; 
  color: string; 
  trend?: { value: number; isUp: boolean };
  subtitle?: string;
}) => {
  const colorMap: Record<string, string> = {
    blue: 'from-blue-500 to-cyan-500',
    green: 'from-emerald-500 to-green-500',
    purple: 'from-purple-500 to-pink-500',
    orange: 'from-orange-500 to-red-500',
    indigo: 'from-indigo-500 to-blue-500',
    teal: 'from-teal-500 to-cyan-500',
  };

  return (
    <div className="group relative bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-all duration-300 hover:border-gray-300">
      <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-5 rounded-2xl transition-opacity duration-300"
        style={{ backgroundImage: `linear-gradient(135deg, var(--tw-gradient-stops))` }}
      />
      
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorMap[color]} p-2.5 shadow-lg`}>
            <Icon className="w-full h-full text-white" />
          </div>
          {trend && (
            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold ${
              trend.isUp ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {trend.isUp ? <FiArrowUp className="w-3 h-3" /> : <FiArrowDown className="w-3 h-3" />}
              {trend.value}%
            </div>
          )}
        </div>
        
        <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
        <p className="text-3xl font-bold text-gray-900">{value}</p>
        
        {subtitle && (
          <p className="text-xs text-gray-500 mt-2">{subtitle}</p>
        )}
      </div>
    </div>
  );
};

// Enhanced Notification Toast Component
const NotificationToast = ({ 
  type, 
  data, 
  onDismiss, 
  className 
}: { 
  type: 'reminder' | 'booking';
  data: any;
  onDismiss: () => void;
  className?: string;
}) => {
  const isReminder = type === 'reminder';
  const Icon = isReminder ? FiClock : FiBell;
  const bgGradient = isReminder 
    ? 'from-amber-500 to-orange-500' 
    : 'from-blue-500 to-cyan-500';

  return (
    <div className={`bg-white rounded-2xl border border-gray-200 shadow-xl p-4 animate-in slide-in-from-right duration-300 ${className}`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${bgGradient} p-2 shadow-lg flex-shrink-0`}>
          <Icon className="w-full h-full text-white" />
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-gray-900 mb-1">
            {isReminder ? '⏰ Upcoming Consultation' : '📞 New Booking!'}
          </h4>
          
          <p className="text-sm text-gray-600">
            <span className="font-medium text-gray-900">{data.student_name || 'Student'}</span>
            {isReminder && data.minutesUntil != null && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                in ~{Math.max(1, Math.round(data.minutesUntil))} min
              </span>
            )}
          </p>
          
          {!isReminder && data.date && (
            <p className="text-xs text-gray-500 mt-1">
              {data.date} at {formatTime(data.start_time || '')}
            </p>
          )}
          
          <div className="flex gap-2 mt-3">
            {isReminder && data.zoom_start_url && (
              <a
                href={data.zoom_start_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 px-3 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-semibold rounded-lg shadow-md hover:shadow-lg transition-all text-center"
              >
                <FiVideo className="inline mr-1 w-3 h-3" />
                Start Call
              </a>
            )}
            
            {!isReminder && (
              <Link
                href="/dashboard/consultation-manager/today"
                className="flex-1 px-3 py-2 bg-gradient-to-r from-blue-500 to-cyan-600 text-white text-xs font-semibold rounded-lg shadow-md hover:shadow-lg transition-all text-center"
              >
                View Details
              </Link>
            )}
            
            <button
              onClick={onDismiss}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition-all"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Enhanced Consultation Card Component
const ConsultationCard = ({ 
  consultation, 
  isPast = false,
  onComplete,
  onCancel 
}: { 
  consultation: any; 
  isPast?: boolean;
  onComplete: (id: number) => void;
  onCancel: (id: number) => void;
}) => {
  const statusColors: Record<string, string> = {
    completed: 'bg-green-100 text-green-700 border-green-200',
    confirmed: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    pending: 'bg-amber-100 text-amber-700 border-amber-200',
  };

  return (
    <div className={`bg-white rounded-xl border ${isPast ? 'border-gray-200 opacity-60' : 'border-gray-200'} p-5 shadow-sm hover:shadow-md transition-all duration-200`}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
              {consultation.student_name?.charAt(0) || '?'}
            </div>
            <div>
              <p className="font-semibold text-gray-900">{consultation.student_name}</p>
              <p className="text-sm text-gray-500 flex items-center gap-1">
                <FiMail className="w-3 h-3" />
                {consultation.student_email}
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <FiClock className="w-4 h-4 text-gray-400" />
              <span className="font-mono">
                {formatTime(consultation.start_time)} – {formatTime(consultation.end_time)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <FiActivity className="w-4 h-4 text-gray-400" />
              <span>{consultation.duration_minutes ?? 30} minutes</span>
            </div>
          </div>
          
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${statusColors[consultation.status] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
            {consultation.status === 'completed' ? 'Completed' : 'Confirmed'}
          </span>
        </div>
        
        {consultation.status === 'confirmed' && !isPast && (
          <div className="flex flex-wrap gap-2">
            {consultation.zoom_start_url && (
              <a
                href={consultation.zoom_start_url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg transition-all flex items-center gap-2"
              >
                <FiVideo className="w-4 h-4" />
                Start Call
              </a>
            )}
            <button
              onClick={() => onComplete(consultation.booking_id)}
              className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-green-600 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg transition-all flex items-center gap-2"
            >
              <FiCheck className="w-4 h-4" />
              Complete
            </button>
            <button
              onClick={() => onCancel(consultation.booking_id)}
              className="px-4 py-2 bg-red-50 text-red-700 text-sm font-semibold rounded-lg border border-red-200 hover:bg-red-100 transition-all flex items-center gap-2"
            >
              <FiX className="w-4 h-4" />
              Cancel
            </button>
            <Link
              href={`/dashboard/consultation-manager/students/${consultation.student_id}`}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-all flex items-center gap-2"
            >
              <FiUser className="w-4 h-4" />
              Student
            </Link>
          </div>
        )}
        
        {isPast && (
          <Link
            href={`/dashboard/consultation-manager/students/${consultation.student_id}`}
            className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-all flex items-center gap-2"
          >
            <FiUser className="w-4 h-4" />
            View Student
          </Link>
        )}
      </div>
    </div>
  );
};

// Upcoming Session Item Component
const UpcomingSessionItem = ({ session }: { session: any }) => {
  return (
    <div className="group bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-all duration-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-md">
            <FiClock className="w-5 h-5 text-white" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-gray-900">{session.student_name}</span>
              <span className="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-0.5 rounded">
                {formatTime(session.start_time)}
              </span>
            </div>
            <p className="text-sm text-gray-600 truncate">
              <FiMail className="inline w-3 h-3 mr-1" />
              {session.student_email}
            </p>
          </div>
        </div>
        
        <Link
          href="/dashboard/consultation-manager/bookings"
          className="opacity-0 group-hover:opacity-100 transition-opacity px-3 py-1.5 text-xs font-semibold text-cyan-600 hover:text-cyan-700"
        >
          View <FiChevronRight className="inline w-3 h-3" />
        </Link>
      </div>
    </div>
  );
};

// Main Component
type IncomingBooking = {
  slotId?: number;
  booking_id?: number;
  student_name?: string;
  date?: string;
  start_time?: string;
  duration_minutes?: number;
  zoom_start_url?: string;
};

export default function ConsultationManagerDashboardPage() {
  const socket = useSocket();
  
  // State - KEPT EXACTLY THE SAME
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);
  const [todayList, setTodayList] = useState<any[]>([]);
  const [todayDate, setTodayDate] = useState('');
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [availableSlots, setAvailableSlots] = useState(0);
  const [completedToday, setCompletedToday] = useState(0);
  const [weekCount, setWeekCount] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [bookingsThisMonth, setBookingsThisMonth] = useState(0);
  const [completedThisMonth, setCompletedThisMonth] = useState(0);
  const [incoming, setIncoming] = useState<IncomingBooking | null>(null);
  const incomingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reminderPopup, setReminderPopup] = useState<{
    booking_id?: number;
    student_name?: string;
    minutesUntil?: number;
    zoom_start_url?: string;
  } | null>(null);
  const reminderTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // New UI state
  const [viewMode, setViewMode] = useState<'compact' | 'detailed'>('detailed');

  // Load function - KEPT EXACTLY THE SAME
  const loadData = useCallback(async () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const y = now.getFullYear();
    const mo = now.getMonth();
    const monthStart = `${y}-${String(mo + 1).padStart(2, '0')}-01`;
    const lastD = new Date(y, mo + 1, 0).getDate();
    const monthEnd = `${y}-${String(mo + 1).padStart(2, '0')}-${String(lastD).padStart(2, '0')}`;
    try {
      const [
        todayRes,
        upRes,
        availRes,
        doneRes,
        pendingRes,
        monthRes,
        completedMonthRes
      ] = await Promise.all([
        apiService.getTodaysConsultations(),
        apiService.getUpcomingConsultationsCm(),
        apiService.getConsultationSlotsAll({ status: 'available', page: 1, per_page: 1 }),
        apiService.getConsultationBookings({
          scope: 'all',
          status: 'completed',
          date_from: todayStr,
          date_to: todayStr
        }),
        apiService.getConsultationBookings({ scope: 'all', booking_status: 'pending' }),
        apiService.getConsultationBookings({ scope: 'all', date_from: monthStart, date_to: monthEnd }),
        apiService.getConsultationBookings({
          scope: 'all',
          status: 'completed',
          date_from: monthStart,
          date_to: monthEnd
        })
      ]);
      if (todayRes?.success) {
        setTodayList(todayRes.consultations || []);
        setTodayDate(todayRes.date || todayStr);
      }
      if (upRes?.success) {
        const list = upRes.consultations || [];
        setUpcoming(list);
        const weekEnd = new Date(now);
        weekEnd.setDate(weekEnd.getDate() + 7);
        const wk = list.filter((c: { date: string }) => {
          const d = new Date(c.date + 'T12:00:00');
          return d >= now && d <= weekEnd;
        }).length;
        setWeekCount(wk);
      }
      if (availRes?.success) setAvailableSlots(Number(availRes.total) || 0);
      if (doneRes?.success) setCompletedToday((doneRes.bookings || []).length);
      if (pendingRes?.success) setPendingRequests((pendingRes.bookings || []).length);
      if (monthRes?.success) setBookingsThisMonth((monthRes.bookings || []).length);
      if (completedMonthRes?.success) setCompletedThisMonth((completedMonthRes.bookings || []).length);
    } catch {
      showToast('Failed to load dashboard', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Effects - KEPT EXACTLY THE SAME
  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('lms-user') || 'null');
    setUserName(u?.name || '');
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onBooked = (payload: IncomingBooking) => {
      loadData();
      playNotificationBeep();
      setIncoming(payload);
      if (incomingTimer.current) clearTimeout(incomingTimer.current);
      incomingTimer.current = setTimeout(() => setIncoming(null), 10000);
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('New consultation booked', {
          body: `${payload.student_name || 'A student'} — ${payload.date} at ${formatTime(payload.start_time || '')}`
        });
      }
    };
    const onCancelled = () => {
      loadData();
      showToast('A booking was cancelled', 'warning');
    };
    const onReminder = (data: {
      booking_id?: number;
      student_name?: string;
      minutesUntil?: number;
      zoom_start_url?: string;
    }) => {
      playNotificationBeep();
      setReminderPopup(data);
      if (reminderTimer.current) clearTimeout(reminderTimer.current);
      reminderTimer.current = setTimeout(() => setReminderPopup(null), 15000);
      const label =
        data.minutesUntil != null && data.minutesUntil >= 60
          ? `~${Math.round(data.minutesUntil / 60)}h`
          : data.minutesUntil != null
            ? `${Math.round(data.minutesUntil)} min`
            : '';
      showToast(
        `Reminder${label ? ` (${label})` : ''}: ${data.student_name || 'Consultation'}`,
        'info',
        6000
      );
      loadData();
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('Consultation reminder', {
          body: `${data.student_name || 'Student'} — starts in ${label || 'soon'}`
        });
      }
    };
    const onBookingFlow = () => loadData();
    socket.on('slot_booked', onBooked);
    socket.on('consultation_cancelled', onCancelled);
    socket.on('consultation_reminder_cm', onReminder);
    socket.on('booking_confirmed', onBookingFlow);
    socket.on('booking_denied', onBookingFlow);
    socket.on('booking_rescheduled', onBookingFlow);
    return () => {
      socket.off('slot_booked', onBooked);
      socket.off('consultation_cancelled', onCancelled);
      socket.off('consultation_reminder_cm', onReminder);
      socket.off('booking_confirmed', onBookingFlow);
      socket.off('booking_denied', onBookingFlow);
      socket.off('booking_rescheduled', onBookingFlow);
      if (incomingTimer.current) clearTimeout(incomingTimer.current);
      if (reminderTimer.current) clearTimeout(reminderTimer.current);
    };
  }, [socket, loadData]);

  // Actions - KEPT EXACTLY THE SAME
  const dismissIncoming = () => {
    setIncoming(null);
    if (incomingTimer.current) clearTimeout(incomingTimer.current);
  };

  const dismissReminder = () => {
    setReminderPopup(null);
    if (reminderTimer.current) clearTimeout(reminderTimer.current);
  };

  const markComplete = async (bookingId: number) => {
    const r = await Swal.fire({
      title: 'Mark as completed?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#22c55e',
      confirmButtonText: 'Yes, completed'
    });
    if (!r.isConfirmed) return;
    try {
      const res = await apiService.markConsultationComplete(bookingId);
      if (res?.success) {
        showToast('Marked as completed', 'success');
        loadData();
      } else showToast(res?.message || 'Failed', 'error');
    } catch {
      showToast('Failed to update', 'error');
    }
  };

  const cancelBooking = async (bookingId: number) => {
    const r = await Swal.fire({
      title: 'Cancel this booking?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Yes, cancel'
    });
    if (!r.isConfirmed) return;
    try {
      const res = await apiService.cancelConsultationBooking(bookingId);
      if (res?.success) {
        showToast('Booking cancelled', 'success');
        loadData();
      } else showToast(res?.message || 'Failed', 'error');
    } catch {
      showToast('Failed to cancel', 'error');
    }
  };

  // Data processing
  const nextFive = upcoming.slice(0, 5);
  const grouped: Record<string, typeof upcoming> = {};
  for (const c of nextFive) {
    const d = c.date;
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(c);
  }

  const nowMs = new Date().getTime();
  const upcomingCalls = todayList.filter((c) => {
    const ds = c.date instanceof Date ? c.date.toISOString().slice(0, 10) : String(c.date).slice(0, 10);
    const et = String(c.end_time || c.start_time).slice(0, 5);
    return new Date(`${ds}T${et}:00`).getTime() > nowMs;
  });
  const pastCalls = todayList.filter((c) => {
    const ds = c.date instanceof Date ? c.date.toISOString().slice(0, 10) : String(c.date).slice(0, 10);
    const et = String(c.end_time || c.start_time).slice(0, 5);
    return new Date(`${ds}T${et}:00`).getTime() <= nowMs;
  });

  // Calculate trends (mock data - can be connected to real data)
  const trends = {
    today: { value: 12, isUp: true },
    week: { value: 8, isUp: true },
    month: { value: 15, isUp: true },
  };

  return (
    <div className="relative w-full max-w-full 2xl:max-w-[1800px] mx-auto space-y-8 px-4 sm:px-6 lg:px-8 py-6">
      {/* Notifications - Enhanced */}
      {reminderPopup && (
        <NotificationToast
          type="reminder"
          data={reminderPopup}
          onDismiss={dismissReminder}
          className={`fixed right-4 z-[99] max-w-sm w-[calc(100%-2rem)] ${incoming ? 'top-48' : 'top-20'}`}
        />
      )}

      {incoming && (
        <NotificationToast
          type="booking"
          data={incoming}
          onDismiss={dismissIncoming}
          className={`fixed top-20 right-4 z-[100] max-w-sm w-[calc(100%-2rem)] ${reminderPopup ? 'top-48' : ''}`}
        />
      )}

      {/* Header - Enhanced */}
      <header className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-50 via-cyan-50 to-teal-50 rounded-3xl -z-10 opacity-50" />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
              {greetingName(userName)}
            </h1>
            <p className="text-gray-600 mt-1 flex items-center gap-2">
              <FiActivity className="w-4 h-4" />
              Consultation Manager Dashboard
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="bg-white rounded-xl px-4 py-2 shadow-sm border border-gray-200">
              <p className="text-sm font-medium text-gray-900">{formatDateLong(todayDate || new Date().toISOString().slice(0, 10))}</p>
            </div>
            
            <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
              <button
                onClick={() => setViewMode('detailed')}
                className={`p-2 rounded-lg transition-all ${
                  viewMode === 'detailed' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Detailed view"
              >
                <FiGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('compact')}
                className={`p-2 rounded-lg transition-all ${
                  viewMode === 'compact' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Compact view"
              >
                <FiList className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Grid - Enhanced */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <StatSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard
            title="Today's Calls"
            value={todayList.length}
            icon={FiCalendar}
            color="blue"
            trend={trends.today}
            subtitle={`${completedToday} completed`}
          />
          <StatCard
            title="Pending Requests"
            value={pendingRequests}
            icon={FiAlertCircle}
            color="orange"
            subtitle="Awaiting confirmation"
          />
          <StatCard
            title="Monthly Bookings"
            value={bookingsThisMonth}
            icon={FiBookOpen}
            color="purple"
            trend={trends.month}
          />
          <StatCard
            title="Completed (Month)"
            value={completedThisMonth}
            icon={FiCheck}
            color="green"
            subtitle={`${((completedThisMonth / (bookingsThisMonth || 1)) * 100).toFixed(0)}% completion`}
          />
          <StatCard
            title="Available Slots"
            value={availableSlots}
            icon={FiGrid}
            color="teal"
          />
          <StatCard
            title="This Week"
            value={weekCount}
            icon={FiTrendingUp}
            color="indigo"
            trend={trends.week}
            subtitle={`${completedToday} today`}
          />
        </div>
      )}

      {/* Quick Actions Bar */}
      <div className="flex flex-wrap gap-3 p-4 bg-white rounded-2xl border border-gray-200 shadow-sm">
        <Link
          href="/dashboard/consultation-manager/slots"
          className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-600 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg transition-all flex items-center gap-2"
        >
          <FiCalendar className="w-4 h-4" />
          Manage Slots
        </Link>
        <Link
          href="/dashboard/consultation-manager/bookings"
          className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-all flex items-center gap-2"
        >
          <FiList className="w-4 h-4" />
          View All Bookings
        </Link>
        <Link
          href="/dashboard/consultation-manager/today"
          className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-all flex items-center gap-2"
        >
          <FiClock className="w-4 h-4" />
          Today's Timeline
        </Link>
      </div>

      {/* Today's Calls Section - Enhanced */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <FiCalendar className="w-5 h-5 text-cyan-500" />
              Today's Consultations
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {upcomingCalls.length} upcoming · {pastCalls.length} completed
            </p>
          </div>
          <Link 
            href="/dashboard/consultation-manager/today" 
            className="text-sm font-semibold text-cyan-600 hover:text-cyan-700 flex items-center gap-1 group"
          >
            Full Timeline 
            <FiChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
        
        <div className="space-y-4">
          {upcomingCalls.length === 0 && pastCalls.length === 0 && !loading && (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <FiCalendar className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">No consultations today</h3>
              <p className="text-sm text-gray-500">Enjoy your day! Check back later for updates.</p>
            </div>
          )}
          
          {upcomingCalls.length === 0 && pastCalls.length > 0 && !loading && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl border border-green-200 p-4">
              <p className="text-green-700 font-medium flex items-center gap-2">
                <FiCheck className="w-5 h-5" />
                All caught up! No more upcoming calls today.
              </p>
            </div>
          )}
          
          {upcomingCalls.map((c) => (
            <ConsultationCard
              key={c.booking_id}
              consultation={c}
              onComplete={markComplete}
              onCancel={cancelBooking}
            />
          ))}
          
          {pastCalls.length > 0 && (
            <details className="group">
              <summary className="text-sm font-semibold text-gray-600 cursor-pointer py-3 px-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all flex items-center gap-2 select-none">
                <FiChevronRight className="w-4 h-4 group-open:rotate-90 transition-transform" />
                Earlier Today ({pastCalls.length} completed)
              </summary>
              <div className="space-y-3 mt-3 pl-4">
                {pastCalls.map((c) => (
                  <ConsultationCard
                    key={c.booking_id}
                    consultation={c}
                    isPast={true}
                    onComplete={markComplete}
                    onCancel={cancelBooking}
                  />
                ))}
              </div>
            </details>
          )}
        </div>
      </section>

      {/* Upcoming Sessions - Enhanced */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <FiTrendingUp className="w-5 h-5 text-purple-500" />
              Upcoming Sessions
            </h2>
            <p className="text-sm text-gray-500 mt-1">Next 5 consultations</p>
          </div>
          <Link 
            href="/dashboard/consultation-manager/bookings" 
            className="text-sm font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1 group"
          >
            View All 
            <FiChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
        
        <div className="space-y-6">
          {Object.keys(grouped).length === 0 && !loading && (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <FiCalendar className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">No upcoming consultations</h3>
              <p className="text-sm text-gray-500 mb-4">Schedule some sessions to get started</p>
              <Link
                href="/dashboard/consultation-manager/slots"
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-600 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg transition-all"
              >
                <FiCalendar className="w-4 h-4" />
                Manage Availability
              </Link>
            </div>
          )}
          
          {Object.entries(grouped).map(([date, rows]) => (
            <div key={date} className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-md">
                  <FiCalendar className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { 
                    weekday: 'long', 
                    day: 'numeric', 
                    month: 'long' 
                  })}
                </h3>
                <span className="px-2 py-1 bg-gray-100 rounded-full text-xs font-medium text-gray-600">
                  {rows.length} session{rows.length !== 1 ? 's' : ''}
                </span>
              </div>
              
              <div className="space-y-2 pl-11">
                {rows.map((c: { booking_id: number; start_time: string; student_name: string; student_email: string }) => (
                  <UpcomingSessionItem key={c.booking_id} session={c} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Activity Summary Footer */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-gray-200">
        <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl">
          <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
            <FiVideo className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs text-gray-600">Total Sessions</p>
            <p className="text-xl font-bold text-gray-900">{todayList.length + upcoming.length}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl">
          <div className="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center">
            <FiCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs text-gray-600">Completion Rate</p>
            <p className="text-xl font-bold text-gray-900">
              {completedThisMonth && bookingsThisMonth 
                ? `${((completedThisMonth / bookingsThisMonth) * 100).toFixed(0)}%` 
                : '0%'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl">
          <div className="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center">
            <FiUsers className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs text-gray-600">Active Students</p>
            <p className="text-xl font-bold text-gray-900">
              {new Set([...todayList, ...upcoming].map(c => c.student_id)).size}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}