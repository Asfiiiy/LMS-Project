'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { useSocket } from '@/app/contexts/SocketContext';
import { apiService } from '@/app/services/api';
import { UserRole } from '@/app/components/types';
import { notify } from '@/app/utils/notify';
import Swal from 'sweetalert2';
import { showToast } from '@/app/components/Toast';

type ConsultMessageFile = {
  id?: number;
  file_name: string;
  file_path: string;
  file_type?: string;
  file_size?: number;
};

type ConsultMessage = {
  id: number;
  booking_id: number;
  sender_id: number;
  sender_role: 'student' | 'staff';
  body: string;
  created_at: string;
  sender_name?: string;
  profile_picture?: string | null;
  role_id?: number | null;
  files?: ConsultMessageFile[];
};

const MESSAGE_ALLOWED_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp,.txt';

function StudentConsultationsInner() {
  const searchParams = useSearchParams();
  const socket = useSocket();
  const bookSectionRef = useRef<HTMLDivElement>(null);
  const upcomingSectionRef = useRef<HTMLDivElement>(null);
  const historySectionRef = useRef<HTMLDivElement>(null);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [authReady, setAuthReady] = useState(false);
  const [slots, setSlots] = useState<any[]>([]);
  const [byDate, setByDate] = useState<Record<string, any[]>>({});
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showBookModal, setShowBookModal] = useState<{ slot: any } | null>(null);
  const [bookingNote, setBookingNote] = useState('');
  const [booking, setBooking] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Consultation messages state (keyed by booking id)
  const [openMessageBookingId, setOpenMessageBookingId] = useState<number | null>(null);
  const [consultMessages, setConsultMessages] = useState<Record<number, ConsultMessage[]>>({});
  const [messageInputByBooking, setMessageInputByBooking] = useState<Record<number, string>>({});
  const [selectedMsgFiles, setSelectedMsgFiles] = useState<Record<number, File[]>>({});
  const [sendingMsg, setSendingMsg] = useState<Record<number, boolean>>({});
  const [loadingMsg, setLoadingMsg] = useState<Record<number, boolean>>({});

  // Live "now" tick so the LIVE NOW / starting-soon banner updates without a refresh
  const [, setNowTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNowTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('lms-user') || 'null');
    setUserRole(u?.role || null);
    setAuthReady(true);
  }, []);

  // Feature 5 — Real-time slot status: when another student books, refresh slots
  useEffect(() => {
    if (!socket) return;
    const onSlotBooked = ({ slotId, date }: { slotId: number; date: string }) => {
      setSlots(prev => prev.filter(s => s.id !== slotId));
      setByDate(prev => {
        const arr = prev[date]?.filter(s => s.id !== slotId) ?? [];
        if (arr.length === 0) {
          const next = { ...prev };
          delete next[date];
          return next;
        }
        return { ...prev, [date]: arr };
      });
      if (showBookModal?.slot?.id === slotId) {
        setShowBookModal(null);
        setBookError('Sorry! Someone just booked this slot. Please choose another available time.');
      }
    };
    socket.on('slot_booked', onSlotBooked);
    return () => { socket.off('slot_booked', onSlotBooked); };
  }, [socket, showBookModal?.slot?.id]);

  const loadMyBookings = async () => {
    try {
      const bookingsRes = await apiService.getMyConsultationBookings();
      if (bookingsRes?.success) setBookings(bookingsRes.bookings || []);
    } catch {
      /* ignore */
    }
  };

  const loadConsultMessages = async (bookingId: number) => {
    setLoadingMsg((prev) => ({ ...prev, [bookingId]: true }));
    try {
      const res = await apiService.getConsultationMessages(bookingId);
      if (res?.success) {
        setConsultMessages((prev) => ({ ...prev, [bookingId]: res.messages || [] }));
      }
    } catch (e) {
      // Likely 403 if booking is no longer accessible — silently skip
      console.warn('[Consult messages] load failed:', e instanceof Error ? e.message : e);
    } finally {
      setLoadingMsg((prev) => ({ ...prev, [bookingId]: false }));
    }
  };

  const toggleMessagesPanel = (bookingId: number) => {
    setOpenMessageBookingId((prev) => {
      if (prev === bookingId) return null;
      if (!consultMessages[bookingId]) {
        loadConsultMessages(bookingId);
      }
      return bookingId;
    });
  };

  const sendStudentMessage = async (bookingId: number) => {
    const text = (messageInputByBooking[bookingId] || '').trim();
    const files = selectedMsgFiles[bookingId] || [];
    if (!text && files.length === 0) return;
    setSendingMsg((prev) => ({ ...prev, [bookingId]: true }));
    try {
      const res = await apiService.sendConsultationMessage(bookingId, {
        body: text,
        files,
      });
      if (res?.success && res.message) {
        setConsultMessages((prev) => {
          const list = prev[bookingId] || [];
          // Avoid double-appending if socket already delivered this message
          if (list.some((m) => m.id === res.message.id)) return prev;
          return { ...prev, [bookingId]: [...list, res.message] };
        });
        setMessageInputByBooking((prev) => ({ ...prev, [bookingId]: '' }));
        setSelectedMsgFiles((prev) => ({ ...prev, [bookingId]: [] }));
      } else {
        showToast(res?.message || 'Failed to send message', 'error');
      }
    } catch (e) {
      showToast(
        (e instanceof Error ? e.message : null) || 'Failed to send message',
        'error'
      );
    } finally {
      setSendingMsg((prev) => ({ ...prev, [bookingId]: false }));
    }
  };

  useEffect(() => {
    if (!socket) return;
    const onConfirmed = (data: {
      bookingId?: number;
      date?: string;
      time?: string;
      zoom_join_url?: string;
      tutor_note?: string;
    }) => {
      loadMyBookings();
      showToast('✅ Your consultation is confirmed!', 'success');
      if (data?.zoom_join_url) {
        Swal.fire({
          title: '✅ Consultation Confirmed!',
          html: `Your consultation on <strong>${data.date ?? ''}</strong> at <strong>${data.time ?? ''}</strong> is confirmed.<br/><br/>${
            data.tutor_note ? `<em>${data.tutor_note}</em>` : ''
          }`,
          icon: 'success',
          confirmButtonColor: '#11CCEF',
          confirmButtonText: 'Great!'
        });
      }
    };
    const onDenied = (data: { reason?: string; bookingId?: number }) => {
      loadMyBookings();
      Swal.fire({
        title: '❌ Consultation Not Confirmed',
        html: `Your request was not confirmed.<br/><strong>Reason:</strong> ${data?.reason ?? ''}<br/><br/>Please book another slot.`,
        icon: 'error',
        confirmButtonColor: '#11CCEF',
        confirmButtonText: 'Book Another Slot'
      });
    };
    const onRescheduled = (data: {
      reschedule_date?: string;
      reschedule_time?: string;
      tutor_note?: string;
    }) => {
      loadMyBookings();
      Swal.fire({
        title: '📅 New Date Suggested',
        html: `A new date has been suggested:<br/><strong>${data.reschedule_date ?? ''} at ${data.reschedule_time ?? ''}</strong><br/><em>${data.tutor_note ?? ''}</em>`,
        icon: 'info',
        confirmButtonColor: '#11CCEF'
      });
    };
    const onReminder = (data: {
      booking_id?: number;
      minutesUntil?: number;
      reminderType?: string;
      zoom_join_url?: string | null;
    }) => {
      loadMyBookings();
      const t = data?.reminderType;
      if (t === '10min') {
        showToast(
          '📅 Your consultation starts in 10 minutes. Please join the call and wait up to 10 minutes if your tutor is not yet there.',
          'info',
          12000
        );
      } else if (t === '15min') {
        showToast('⏰ Your consultation starts in 15 minutes. Please be ready to join.', 'info', 8000);
      } else if (t === '1h') {
        showToast('Your consultation starts in 1 hour.', 'info', 6000);
      } else if (t === '24h') {
        showToast('Your consultation is tomorrow. Join link is ready in your dashboard.', 'info', 6000);
      } else {
        showToast('Consultation reminder', 'info', 5000);
      }
    };

    const onMessageNew = (data: {
      bookingId?: number;
      message?: ConsultMessage;
    }) => {
      const bid = Number(data?.bookingId);
      const msg = data?.message;
      if (!bid || !msg) return;
      setConsultMessages((prev) => {
        const list = prev[bid] || [];
        if (list.some((m) => m.id === msg.id)) return prev;
        return { ...prev, [bid]: [...list, msg] };
      });
      // Only toast for messages from staff; suppress echo of our own send
      if (msg.sender_role === 'staff') {
        const preview =
          (msg.body && msg.body.slice(0, 80)) ||
          (msg.files && msg.files.length ? `New file: ${msg.files[0].file_name}` : 'New message');
        showToast(`💬 ${preview}`, 'info', 8000);
      }
    };

    socket.on('consultation_confirmed', onConfirmed);
    socket.on('consultation_denied', onDenied);
    socket.on('consultation_rescheduled', onRescheduled);
    socket.on('consultation_reminder', onReminder);
    socket.on('consultation_message_new', onMessageNew);
    return () => {
      socket.off('consultation_confirmed', onConfirmed);
      socket.off('consultation_denied', onDenied);
      socket.off('consultation_rescheduled', onRescheduled);
      socket.off('consultation_reminder', onReminder);
      socket.off('consultation_message_new', onMessageNew);
    };
  }, [socket]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [slotsRes, bookingsRes] = await Promise.all([
        apiService.getConsultationSlotsAvailable(),
        apiService.getMyConsultationBookings()
      ]);
      if (slotsRes?.success) {
        setSlots(slotsRes.slots || []);
        setByDate(slotsRes.byDate || {});
      }
      if (bookingsRes?.success) setBookings(bookingsRes.bookings || []);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (!tab) return;
    const t = setTimeout(() => {
      if (tab === 'book') {
        setViewMode('calendar');
        bookSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (tab === 'upcoming') {
        upcomingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (tab === 'history') {
        historySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 150);
    return () => clearTimeout(t);
  }, [searchParams]);

  const handleBook = async () => {
    if (!showBookModal?.slot || booking) return;
    setBooking(true);
    setBookError(null);
    try {
      const res = await apiService.bookConsultationSlot(showBookModal.slot.id, {
        student_note: bookingNote.trim()
      });
      if (res?.success) {
        setShowBookModal(null);
        setBookingNote('');
        setBookError(null);
        showToast(String(res.message || 'Booking request submitted!'), 'success');
        fetchData();
      } else {
        setBookError(res?.message || 'Failed to book');
      }
    } catch (e) {
      const msg = (e instanceof Error ? e.message : null) || 'Failed to book';
      setBookError(msg);
      if (msg.includes('just booked') || msg.includes('being processed')) {
        fetchData();
      }
    } finally {
      setBooking(false);
    }
  };

  const handleAcceptReschedule = async (bookingId: number) => {
    try {
      const res = await apiService.acceptMyConsultationReschedule(bookingId);
      if (res?.success) {
        showToast('Reschedule accepted — your slot is updated.', 'success');
        fetchData();
      } else {
        notify.errorAlert('Could not accept', res?.message || 'Try again.');
      }
    } catch (e) {
      notify.errorAlert('Failed', (e instanceof Error ? e.message : null) || 'Try again.');
    }
  };

  const handleCancel = async (bookingId: number) => {
    const confirmed = await notify.confirm('Cancel this consultation?', 'This action cannot be undone.', { confirmText: 'Yes, cancel', cancelText: 'Keep it' });
    if (!confirmed) return;
    try {
      const res = await apiService.cancelMyConsultationBooking(bookingId);
      if (res?.success) {
        fetchData();
        notify.successAlert('Cancelled', 'Your consultation has been cancelled.');
      } else {
        notify.errorAlert('Cannot cancel', res?.message || 'Something went wrong.');
      }
    } catch (e) {
      notify.errorAlert('Failed to cancel', (e instanceof Error ? e.message : null) || 'Please try again.');
    }
  };

  const changeMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setCurrentMonth(newMonth);
    setSelectedDate(null);
  };

  const formatDate = (d: string | Date) => new Date(d).toLocaleDateString('en-GB', { 
    weekday: 'short', 
    day: 'numeric', 
    month: 'short' 
  });

  const formatFullDate = (d: string | Date) => new Date(d).toLocaleDateString('en-GB', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });

  const formatTime = (t: string) => String(t).slice(0, 5);

  const bookingWorkflow = (b: { booking_status?: string; status?: string }) => {
    if (b.booking_status) return b.booking_status;
    if (b.status === 'cancelled') return 'denied';
    if (b.status === 'completed' || b.status === 'confirmed') return 'confirmed';
    return 'pending';
  };

  const now = new Date();
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const startPad = firstDay === 0 ? 6 : firstDay - 1;

  const days: { date: string; day: number; available: boolean; past: boolean }[] = [];
  for (let i = 0; i < startPad; i++) days.push({ date: '', day: 0, available: false, past: true });
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dateObj = new Date(year, month, d);
    const past = dateObj < new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const available = !past && (byDate[dateStr]?.length || 0) > 0;
    days.push({ date: dateStr, day: d, available, past });
  }

  const slotsForDate = selectedDate ? (byDate[selectedDate] || []) : [];

  // Compute the end-of-session for a booking. Prefer cs.end_time, otherwise
  // derive from start_time + duration_minutes. Falls back to a 60-min session.
  const bookingEndTime = (b: { date: string; start_time: string; end_time?: string; duration_minutes?: number }) => {
    if (b.end_time) return new Date(`${b.date}T${b.end_time}`);
    const start = new Date(`${b.date}T${b.start_time}`);
    const dur = Number(b.duration_minutes) || 60;
    return new Date(start.getTime() + dur * 60 * 1000);
  };

  // Upcoming = not yet ENDED + not cancelled/completed.
  // This keeps the Join button visible for the entire scheduled session.
  const upcomingBookings = bookings
    .filter(b => {
      const end = bookingEndTime(b);
      return end >= now && !['cancelled', 'completed'].includes(b.status);
    })
    .sort((a, b) => new Date(`${a.date}T${a.start_time}`).getTime() - new Date(`${b.date}T${b.start_time}`).getTime());

  const pastBookings = bookings
    .filter(b => {
      const end = bookingEndTime(b);
      return end < now || ['cancelled', 'completed'].includes(b.status);
    })
    .sort((a, b) => new Date(`${b.date}T${b.start_time}`).getTime() - new Date(`${a.date}T${a.start_time}`).getTime());

  const totalAvailableSlots = slots.length;

  return (
    <ProtectedRoute allowedRoles={['Student', 'ManagerStudent', 'InstituteStudent']} userRole={userRole} authReady={authReady}>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        {/* Premium Header with your colors */}
        <div className="relative overflow-hidden">
          {/* Animated gradient background */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#11CCEF] via-[#E51791] to-[#11CCEF] animate-gradient-x"></div>
          <div className="absolute inset-0 bg-black/10 backdrop-blur-sm"></div>
          
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">
                  CONSULTATIONS
                </h1>
                <p className="mt-3 text-white/90 text-lg max-w-2xl">
                  Schedule one-on-one video calls with your tutors and academic advisors
                </p>
                <p className="mt-2 text-sm text-white/85 max-w-2xl">
                  Bookings must be made at least <strong>48 hours</strong> before the slot start; only eligible times are shown below.
                </p>
              </div>
              
              {/* Premium Stats Cards */}
              <div className="flex gap-4">
                <div className="bg-white/10 backdrop-blur-xl rounded-2xl px-6 py-4 border border-white/20 shadow-2xl">
                  <p className="text-sm text-white/80">Available Slots</p>
                  <p className="text-4xl font-bold text-white">{totalAvailableSlots}</p>
                  <div className="w-full h-1 bg-white/20 rounded-full mt-2">
                    <div className="w-full h-full bg-white rounded-full"></div>
                  </div>
                </div>
                <div className="bg-white/10 backdrop-blur-xl rounded-2xl px-6 py-4 border border-white/20 shadow-2xl">
                  <p className="text-sm text-white/80">Upcoming</p>
                  <p className="text-4xl font-bold text-white">{upcomingBookings.length}</p>
                  <div className="w-full h-1 bg-white/20 rounded-full mt-2">
                    <div className="w-full h-full bg-white rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* View Toggle with premium styling */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-white rounded-2xl shadow-lg p-1.5">
                <button
                  onClick={() => setViewMode('calendar')}
                  className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all ${
                    viewMode === 'calendar'
                      ? 'bg-gradient-to-r from-[#11CCEF] to-[#E51791] text-white shadow-lg'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  📅 Calendar View
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all ${
                    viewMode === 'list'
                      ? 'bg-gradient-to-r from-[#11CCEF] to-[#E51791] text-white shadow-lg'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  📋 List View
                </button>
              </div>
              
              {viewMode === 'calendar' && (
                <div className="flex items-center gap-3 text-sm">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 bg-[#11CCEF] rounded-full animate-pulse"></span>
                    <span className="text-gray-600 font-medium">Available</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 bg-[#E51791] rounded-full"></span>
                    <span className="text-gray-600 font-medium">Selected</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 bg-gray-200 rounded-full"></span>
                    <span className="text-gray-600 font-medium">No slots</span>
                  </span>
                </div>
              )}
            </div>
            
            {selectedDate && (
              <div className="bg-gradient-to-r from-[#11CCEF]/10 to-[#E51791]/10 text-[#E51791] px-5 py-2.5 rounded-xl text-sm font-bold border border-[#11CCEF]/20">
                📌 {formatFullDate(selectedDate)}
              </div>
            )}
          </div>

          {/* Premium Info Banner */}
          {!loading && slots.length === 0 && (
            <div className="mb-6 bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-[#E51791] rounded-xl p-5 shadow-lg">
              <div className="flex items-start gap-4">
                <div className="text-3xl">💡</div>
                <div>
                  <h3 className="font-bold text-[#E51791] text-lg">No consultation slots available yet</h3>
                  <p className="text-gray-600 mt-1">
                    Your admin or tutor needs to add available time slots first. Once they add slots, 
                    you'll see <span className="font-bold text-[#11CCEF]">cyan dates</span> on the calendar below.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Calendar/List */}
            <div ref={bookSectionRef} className="lg:col-span-2 space-y-6">
              {/* Premium Calendar View */}
              {viewMode === 'calendar' && (
                <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
                  {/* Calendar Header with your colors */}
                  <div className="px-6 py-5 bg-gradient-to-r from-[#11CCEF] to-[#E51791]">
                    <div className="flex items-center justify-between">
                      <h2 className="text-2xl font-bold text-white">
                        {currentMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                      </h2>
                      <div className="flex gap-2">
                        <button
                          onClick={() => changeMonth('prev')}
                          className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white hover:bg-white/30 transition-all"
                        >
                          ←
                        </button>
                        <button
                          onClick={() => changeMonth('next')}
                          className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white hover:bg-white/30 transition-all"
                        >
                          →
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Calendar Grid */}
                  <div className="p-6">
                    {/* Weekday headers */}
                    <div className="grid grid-cols-7 gap-2 mb-4">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                        <div key={d} className="text-sm font-black text-gray-400 text-center">
                          {d}
                        </div>
                      ))}
                    </div>
                    
                    {/* Calendar days - BOLD design */}
                    <div className="grid grid-cols-7 gap-2">
                      {days.map((cell, i) => (
                        <button
                          key={i}
                          onClick={() => cell.date && !cell.past && setSelectedDate(cell.date)}
                          disabled={!cell.date || cell.past}
                          className={`
                            relative aspect-square p-3 rounded-xl text-xl font-black transition-all
                            ${!cell.date ? 'invisible' : ''}
                            ${cell.past ? 'text-gray-300 cursor-not-allowed bg-gray-50' : ''}
                            ${cell.available && !cell.past ? 'hover:scale-110 hover:shadow-2xl cursor-pointer' : ''}
                            ${selectedDate === cell.date 
                              ? 'bg-gradient-to-br from-[#11CCEF] to-[#E51791] text-white shadow-2xl' 
                              : cell.available && !cell.past
                                ? 'bg-[#11CCEF]/10 text-[#11CCEF] border-2 border-[#11CCEF] hover:bg-[#11CCEF]/20'
                                : !cell.past && cell.date
                                  ? 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                  : ''
                            }
                          `}
                        >
                          <span className="flex items-center justify-center">
                            {cell.day || ''}
                          </span>
                          {cell.available && !cell.past && (
                            <span className="absolute top-1 right-1 w-2 h-2 bg-[#11CCEF] rounded-full animate-ping"></span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Premium List View */}
              {viewMode === 'list' && (
                <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
                  <div className="px-6 py-5 bg-gradient-to-r from-[#11CCEF] to-[#E51791]">
                    <h2 className="text-2xl font-bold text-white">📋 Available Slots</h2>
                  </div>
                  <div className="p-6">
                    {loading ? (
                      <div className="text-center py-16">
                        <div className="inline-block w-16 h-16 border-4 border-[#11CCEF] border-t-[#E51791] rounded-full animate-spin"></div>
                        <p className="mt-4 text-gray-500 font-medium">Loading available slots...</p>
                      </div>
                    ) : slots.length === 0 ? (
                      <div className="text-center py-16">
                        <div className="text-7xl mb-4">📅</div>
                        <h3 className="text-xl font-black text-gray-800">No available slots</h3>
                        <p className="text-gray-500 mt-2">Check back later for new consultation slots.</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {Object.entries(byDate).map(([date, dateSlots]) => {
                          const slotDate = new Date(date);
                          if (slotDate < new Date(now.setHours(0, 0, 0, 0))) return null;
                          return (
                            <div key={date} className="border-2 border-gray-100 rounded-2xl overflow-hidden">
                              <div className="bg-gradient-to-r from-[#11CCEF]/5 to-[#E51791]/5 px-5 py-3 border-b-2 border-gray-100">
                                <h3 className="font-black text-[#E51791]">
                                  {formatFullDate(date)}
                                </h3>
                              </div>
                              <div className="p-5">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                  {dateSlots.map((slot) => (
                                    <div
                                      key={slot.id}
                                      className="group relative bg-gradient-to-br from-gray-50 to-white rounded-xl border-2 border-gray-200 hover:border-[#11CCEF] hover:shadow-xl transition-all p-4"
                                    >
                                      <div className="text-center">
                                        <span className="text-2xl font-black text-gray-800">
                                          {formatTime(slot.start_time)}
                                        </span>
                                        <span className="text-sm text-gray-400 block mt-1 font-medium">
                                          to {formatTime(slot.end_time)}
                                        </span>
                                        <button
                                          onClick={() => { setBookError(null); setBookingNote(''); setShowBookModal({ slot }); }}
                                          className="mt-4 w-full px-4 py-3 bg-gradient-to-r from-[#11CCEF] to-[#E51791] text-white rounded-xl text-sm font-bold hover:shadow-lg transition-all transform group-hover:scale-105"
                                        >
                                          Book Now
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Time Slots for Selected Date */}
              {viewMode === 'calendar' && selectedDate && (
                <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
                  <div className="px-6 py-5 bg-gradient-to-r from-[#11CCEF]/10 to-[#E51791]/10 border-b-2 border-[#11CCEF]/20">
                    <h2 className="text-2xl font-black text-[#E51791]">
                      ⏰ {formatFullDate(selectedDate)}
                    </h2>
                  </div>
                  <div className="p-6">
                    {loading ? (
                      <div className="text-center py-8">
                        <div className="inline-block w-10 h-10 border-3 border-[#11CCEF] border-t-[#E51791] rounded-full animate-spin"></div>
                      </div>
                    ) : slotsForDate.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="text-6xl mb-4">😔</div>
                        <h3 className="text-xl font-black text-gray-800">No slots available</h3>
                        <p className="text-gray-500 mt-2">Try selecting another date.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {slotsForDate.map((slot) => (
                          <div
                            key={slot.id}
                            className="group relative bg-gradient-to-br from-gray-50 to-white rounded-2xl border-2 border-gray-200 hover:border-[#11CCEF] hover:shadow-2xl transition-all p-5"
                          >
                            <div className="text-center">
                              <span className="text-3xl font-black text-gray-800">
                                {formatTime(slot.start_time)}
                              </span>
                              <span className="text-sm text-gray-400 block mt-2 font-medium">
                                {formatTime(slot.end_time)}
                              </span>
                              <button
                                onClick={() => { setBookError(null); setBookingNote(''); setShowBookModal({ slot }); }}
                                className="mt-4 w-full px-4 py-3 bg-gradient-to-r from-[#11CCEF] to-[#E51791] text-white rounded-xl text-sm font-bold hover:shadow-lg transition-all transform group-hover:scale-105"
                              >
                                Book
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - My Bookings */}
            <div className="lg:col-span-1 space-y-6">
              {/* Upcoming Bookings */}
              <div ref={upcomingSectionRef} className="bg-white rounded-3xl shadow-2xl overflow-hidden">
                <div className="px-6 py-5 bg-gradient-to-r from-[#11CCEF] to-[#E51791]">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white">📅 Upcoming</h2>
                    {upcomingBookings.length > 0 && (
                      <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-bold text-white">
                        {upcomingBookings.length}
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-5">
                  {upcomingBookings.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-5xl mb-3">📭</div>
                      <p className="text-gray-500 font-medium">No upcoming consultations</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {upcomingBookings.map((b) => {
                        const slotDateTime = new Date(`${b.date}T${b.start_time}`);
                        const slotEndTime = bookingEndTime(b);
                        const wf = bookingWorkflow(b);
                        const hoursUntil = (slotDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
                        const minsUntilStart = Math.floor((slotDateTime.getTime() - now.getTime()) / 60000);
                        const isLive = now >= slotDateTime && now <= slotEndTime;
                        const startingSoon = !isLive && minsUntilStart >= 0 && minsUntilStart <= 10;
                        const canCancel =
                          (wf === 'pending' || wf === 'rescheduled' || hoursUntil >= 24) && !isLive;
                        const isToday = slotDateTime.toDateString() === now.toDateString();
                        const noteShown = b.student_note || b.notes;
                        const msgs = consultMessages[b.id] || [];
                        const isMessageOpen = openMessageBookingId === b.id;
                        const unreadFromStaff = msgs.filter((m) => m.sender_role === 'staff').length;
                        const inputVal = messageInputByBooking[b.id] || '';
                        const filesSel = selectedMsgFiles[b.id] || [];
                        const isSending = !!sendingMsg[b.id];
                        const isLoadingMsgs = !!loadingMsg[b.id];

                        return (
                          <div
                            key={b.id}
                            className={`p-5 rounded-xl border-2 transition-all ${
                              isToday 
                                ? 'border-[#11CCEF] bg-[#11CCEF]/5' 
                                : 'border-gray-100 hover:border-[#E51791] bg-white'
                            }`}
                          >
                            <div className="flex flex-col gap-3">
                              <div>
                                <p className={`font-black text-lg ${isToday ? 'text-[#11CCEF]' : 'text-gray-800'}`}>
                                  {formatDate(b.date)}
                                </p>
                                <p className="text-sm text-gray-600 mt-1 font-medium">
                                  {formatTime(b.start_time)} – {formatTime(b.end_time)}
                                </p>
                                {noteShown && (
                                  <p className="text-xs text-gray-500 mt-2 italic bg-gray-50 p-2 rounded-lg">
                                    &quot;{noteShown}&quot;
                                  </p>
                                )}
                                {wf === 'pending' && (
                                  <div className="mt-3 rounded-xl border border-orange-200 bg-orange-50/80 p-3 text-xs text-gray-700">
                                    <p className="font-black text-[#f97316]">⏳ Pending Confirmation</p>
                                    <p className="mt-1 font-medium">
                                      Your consultation request has been submitted. Your tutor will confirm your booking shortly.
                                      You will receive a notification once confirmed.
                                    </p>
                                  </div>
                                )}
                                <span
                                  className={`inline-flex items-center mt-3 px-3 py-1 rounded-full text-xs font-bold ${
                                    wf === 'pending'
                                      ? 'bg-orange-100 text-[#f97316]'
                                      : wf === 'confirmed'
                                        ? 'bg-green-100 text-[#22c55e]'
                                        : wf === 'denied'
                                          ? 'bg-red-100 text-[#ef4444]'
                                          : wf === 'rescheduled'
                                            ? 'bg-blue-100 text-[#3b82f6]'
                                            : 'bg-gray-100 text-gray-600'
                                  }`}
                                >
                                  {wf === 'pending' && '⏳ Pending'}
                                  {wf === 'confirmed' && '✅ Confirmed'}
                                  {wf === 'denied' && '❌ Denied'}
                                  {wf === 'rescheduled' && '📅 Rescheduled'}
                                  {!['pending', 'confirmed', 'denied', 'rescheduled'].includes(wf) && b.status}
                                </span>
                                {wf === 'denied' && b.tutor_note && (
                                  <p className="text-xs text-red-600 mt-2">
                                    Reason: {b.tutor_note}
                                    <br />
                                    <span className="text-gray-600">Please book another slot.</span>
                                  </p>
                                )}
                                {wf === 'rescheduled' && b.reschedule_date && (
                                  <div className="mt-2 text-xs text-gray-700 space-y-2">
                                    <p>
                                      New date suggested:{' '}
                                      <strong>
                                        {formatDate(b.reschedule_date)} at {formatTime(String(b.reschedule_time || ''))}
                                      </strong>
                                    </p>
                                    {b.tutor_note && <p className="italic text-gray-600">{b.tutor_note}</p>}
                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        onClick={() => handleAcceptReschedule(b.id)}
                                        className="px-3 py-2 rounded-lg bg-[#3b82f6] text-white text-xs font-bold hover:opacity-90"
                                      >
                                        Accept new date
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setViewMode('calendar');
                                          bookSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                        }}
                                        className="px-3 py-2 rounded-lg border-2 border-gray-300 text-gray-800 text-xs font-bold hover:bg-gray-50"
                                      >
                                        Book new slot
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                              
                              {/* LIVE / starting-soon banners */}
                              {wf === 'confirmed' && isLive && (
                                <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
                                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse"></span>
                                  <span className="text-xs font-black text-red-600">LIVE NOW</span>
                                  <span className="text-[11px] text-red-500/80 ml-auto">
                                    Ends at {formatTime(b.end_time || '')}
                                  </span>
                                </div>
                              )}
                              {wf === 'confirmed' && startingSoon && (
                                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                                  ⏰ Starting in {minsUntilStart} minute{minsUntilStart === 1 ? '' : 's'}
                                </div>
                              )}
                              {wf === 'confirmed' && (isLive || startingSoon) && (
                                <div className="mt-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] leading-relaxed text-blue-900">
                                  <strong>⚠️ Important:</strong> If your tutor is not available when you join, please wait in the call for at least <strong>10 minutes</strong> before leaving. Your tutor may be slightly delayed.
                                </div>
                              )}

                              <div className="flex gap-2 flex-wrap">
                                {b.zoom_join_url && wf === 'confirmed' && (
                                  <a
                                    href={b.zoom_join_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`flex-1 px-4 py-3 rounded-xl text-xs font-bold hover:shadow-lg transition-all text-center min-w-[120px] text-white ${
                                      isLive
                                        ? 'bg-gradient-to-r from-red-500 to-rose-600'
                                        : 'bg-gradient-to-r from-[#11CCEF] to-[#E51791]'
                                    }`}
                                  >
                                    🎥 {isLive ? 'Rejoin Call' : 'Join Zoom'}
                                  </a>
                                )}
                                {canCancel && wf !== 'denied' && (
                                  <button
                                    onClick={() => handleCancel(b.id)}
                                    className="flex-1 px-4 py-3 border-2 border-[#E51791] text-[#E51791] rounded-xl text-xs font-bold hover:bg-[#E51791]/5 transition-all min-w-[120px]"
                                  >
                                    Cancel
                                  </button>
                                )}
                              </div>

                              {/* Messages panel */}
                              {(wf === 'confirmed' || wf === 'pending' || wf === 'rescheduled') && (
                                <div className="mt-3">
                                  <button
                                    type="button"
                                    onClick={() => toggleMessagesPanel(b.id)}
                                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 hover:border-[#11CCEF] hover:text-[#11CCEF] transition-all"
                                  >
                                    💬 Messages with consultation team
                                    {unreadFromStaff > 0 && (
                                      <span className="ml-1 rounded-full bg-[#11CCEF] px-2 py-0.5 text-[10px] font-black text-white">
                                        {unreadFromStaff}
                                      </span>
                                    )}
                                  </button>

                                  {isMessageOpen && (
                                    <div className="mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white">
                                      <div className="h-56 overflow-y-auto bg-gray-50/40 px-3 py-3 space-y-2">
                                        {isLoadingMsgs && msgs.length === 0 ? (
                                          <p className="py-8 text-center text-xs text-gray-400">Loading messages…</p>
                                        ) : msgs.length === 0 ? (
                                          <p className="py-8 text-center text-xs text-gray-400">No messages yet. Start the conversation below.</p>
                                        ) : (
                                          msgs.map((m) => {
                                            const isMe = m.sender_role === 'student';
                                            return (
                                              <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                                                  isMe
                                                    ? 'bg-gradient-to-r from-[#11CCEF] to-[#E51791] text-white rounded-br-sm'
                                                    : 'bg-white text-gray-800 border border-gray-200 rounded-bl-sm'
                                                }`}>
                                                  {m.body && (
                                                    <p className="text-[12px] whitespace-pre-wrap break-words leading-snug">{m.body}</p>
                                                  )}
                                                  {m.files && m.files.length > 0 && (
                                                    <div className={`mt-1.5 space-y-1 ${m.body ? 'pt-1.5 border-t' : ''} ${isMe ? 'border-white/30' : 'border-gray-200'}`}>
                                                      {m.files.map((f) => (
                                                        <a
                                                          key={f.id || f.file_path}
                                                          href={f.file_path}
                                                          target="_blank"
                                                          rel="noopener noreferrer"
                                                          className={`flex items-center gap-1.5 text-[11px] font-semibold underline-offset-2 hover:underline ${
                                                            isMe ? 'text-white' : 'text-blue-600'
                                                          }`}
                                                        >
                                                          📎 {f.file_name}
                                                          {f.file_size != null && (
                                                            <span className={`text-[10px] ${isMe ? 'text-white/70' : 'text-gray-400'}`}>
                                                              ({Math.round((f.file_size || 0) / 1024)}KB)
                                                            </span>
                                                          )}
                                                        </a>
                                                      ))}
                                                    </div>
                                                  )}
                                                  <p className={`mt-1 text-[10px] ${isMe ? 'text-white/80 text-right' : 'text-gray-400'}`}>
                                                    {!isMe && m.sender_name ? `${m.sender_name} • ` : ''}
                                                    {new Date(m.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                                  </p>
                                                </div>
                                              </div>
                                            );
                                          })
                                        )}
                                      </div>

                                      {filesSel.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 border-t border-gray-100 px-3 py-2">
                                          {filesSel.map((f, i) => (
                                            <span
                                              key={`${f.name}-${i}`}
                                              className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-800"
                                            >
                                              📎 {f.name}
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setSelectedMsgFiles((prev) => ({
                                                    ...prev,
                                                    [b.id]: (prev[b.id] || []).filter((_, idx) => idx !== i),
                                                  }))
                                                }
                                                className="text-gray-400 hover:text-gray-600 leading-none"
                                                aria-label="Remove file"
                                              >
                                                ×
                                              </button>
                                            </span>
                                          ))}
                                        </div>
                                      )}

                                      <div className="flex items-end gap-2 border-t border-gray-100 px-3 py-2">
                                        <label className="cursor-pointer rounded-lg border border-gray-200 bg-gray-50 px-2 py-2 text-base hover:border-[#11CCEF]" title="Attach files">
                                          📎
                                          <input
                                            type="file"
                                            multiple
                                            accept={MESSAGE_ALLOWED_ACCEPT}
                                            className="hidden"
                                            onChange={(e) => {
                                              const list = Array.from(e.target.files || []);
                                              setSelectedMsgFiles((prev) => ({
                                                ...prev,
                                                [b.id]: [...(prev[b.id] || []), ...list].slice(0, 10),
                                              }));
                                              e.target.value = '';
                                            }}
                                          />
                                        </label>
                                        <textarea
                                          rows={1}
                                          value={inputVal}
                                          onChange={(e) =>
                                            setMessageInputByBooking((prev) => ({ ...prev, [b.id]: e.target.value }))
                                          }
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                              e.preventDefault();
                                              sendStudentMessage(b.id);
                                            }
                                          }}
                                          placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
                                          className="flex-1 resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs leading-snug outline-none focus:border-[#11CCEF] focus:ring-2 focus:ring-[#11CCEF]/20"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => sendStudentMessage(b.id)}
                                          disabled={isSending || (!inputVal.trim() && filesSel.length === 0)}
                                          className="rounded-lg bg-gradient-to-r from-[#11CCEF] to-[#E51791] px-3 py-2 text-xs font-bold text-white shadow disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                          {isSending ? 'Sending…' : 'Send'}
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Past Bookings */}
              {pastBookings.length > 0 && (
                <div ref={historySectionRef} className="bg-white rounded-3xl shadow-2xl overflow-hidden">
                  <div className="px-6 py-5 bg-gradient-to-r from-gray-700 to-gray-800">
                    <h2 className="text-xl font-bold text-white">📋 History</h2>
                  </div>
                  <div className="p-5">
                    <div className="space-y-3">
                      {pastBookings.slice(0, 5).map((b) => (
                        <div key={b.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                          <p className="text-sm font-bold text-gray-700">
                            {formatDate(b.date)} at {formatTime(b.start_time)}
                          </p>
                          <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold ${
                            b.status === 'completed' ? 'bg-[#11CCEF]/10 text-[#11CCEF]' : 'bg-gray-200 text-gray-600'
                          }`}>
                            {b.status}
                          </span>
                        </div>
                      ))}
                      {pastBookings.length > 5 && (
                        <button className="w-full mt-3 text-sm text-[#E51791] hover:text-[#11CCEF] font-bold transition-colors">
                          View all {pastBookings.length} past consultations →
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Premium Booking Modal */}
        {showBookModal && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4"
            onClick={() => !booking && (setShowBookModal(null), setBookError(null), setBookingNote(''))}
          >
            <div 
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full transform transition-all scale-100"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header with your colors */}
              <div className="px-6 py-5 bg-gradient-to-r from-[#11CCEF] to-[#E51791] rounded-t-3xl">
                <h3 className="text-2xl font-black text-white">Confirm Your Booking</h3>
              </div>
              
              {/* Modal Body */}
              <div className="p-6">
                <div className="bg-gradient-to-br from-[#11CCEF]/5 to-[#E51791]/5 rounded-2xl p-6 mb-6 border-2 border-[#11CCEF]/20">
                  <div className="flex items-center gap-3 text-2xl mb-4">
                    <span className="text-3xl">📅</span>
                    <span className="font-black text-gray-800">{formatFullDate(showBookModal.slot.date)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-2xl">
                    <span className="text-3xl">⏰</span>
                    <span className="font-black text-gray-800">
                      {formatTime(showBookModal.slot.start_time)} – {formatTime(showBookModal.slot.end_time)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-4 flex items-center gap-2 font-medium">
                    <span>⏱️</span> Duration: {showBookModal.slot?.duration_minutes ?? 30} minutes
                  </p>
                </div>
                
                <div className="mb-6">
                  <label className="block text-sm font-black text-[#0f172a] mb-2">
                    Reason for Booking *
                    <span className="text-slate-400 font-normal text-xs ml-1.5">(required — minimum 10 characters)</span>
                  </label>
                  <textarea
                    value={bookingNote}
                    onChange={e => setBookingNote(e.target.value)}
                    rows={4}
                    className="w-full px-5 py-4 rounded-xl text-sm font-medium resize-y outline-none focus:ring-4 focus:ring-[#11CCEF]/20 transition-all"
                    style={{
                      border: `1.5px solid ${
                        bookingNote.length > 0 && bookingNote.length < 10 ? '#ef4444' : '#e2e8f0'
                      }`
                    }}
                    placeholder="Please describe what you would like to discuss in this consultation..."
                  />
                  {bookingNote.length > 0 && bookingNote.length < 10 && (
                    <p className="text-red-500 text-xs mt-1">Please write at least 10 characters</p>
                  )}
                </div>

                {bookError && (
                  <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm font-medium">
                    {bookError}
                  </div>
                )}
                
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => { setShowBookModal(null); setBookError(null); setBookingNote(''); }}
                    className="px-6 py-3 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all"
                    disabled={booking}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBook}
                    disabled={booking || bookingNote.trim().length < 10}
                    className="px-8 py-3 bg-gradient-to-r from-[#11CCEF] to-[#E51791] text-white rounded-xl text-sm font-bold hover:shadow-xl transition-all disabled:opacity-50"
                  >
                    {booking ? (
                      <span className="flex items-center gap-2">
                        <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        Booking...
                      </span>
                    ) : (
                      '✅ Confirm Booking'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes gradient-x {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient-x {
          background-size: 200% 200%;
          animation: gradient-x 5s ease infinite;
        }
      `}</style>
    </ProtectedRoute>
  );
}

export default function StudentConsultationsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-[#11CCEF] border-t-[#E51791] rounded-full animate-spin" />
        </div>
      }
    >
      <StudentConsultationsInner />
    </Suspense>
  );
}