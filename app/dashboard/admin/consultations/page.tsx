'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { useSocket } from '@/app/contexts/SocketContext';
import { apiService } from '@/app/services/api';
import { UserRole } from '@/app/components/types';
import { showToast } from '@/app/components/Toast';
import Swal from 'sweetalert2';

const DURATIONS = [15, 30, 45, 60] as const;
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const DAY_LABELS: Record<string, string> = { 
  monday: 'Mon', 
  tuesday: 'Tue', 
  wednesday: 'Wed', 
  thursday: 'Thu', 
  friday: 'Fri', 
  saturday: 'Sat', 
  sunday: 'Sun' 
};

// Start times every 15 min from 08:00 to 18:00
const START_TIMES: string[] = [];
for (let h = 8; h <= 18; h++) {
  for (let m = 0; m < 60; m += 15) {
    if (h === 18 && m > 0) break;
    START_TIMES.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
}

function addMinutesToTime(startTime: string, durationMinutes: number): string {
  const [h, m] = startTime.split(':').map(Number);
  const total = h * 60 + m + durationMinutes;
  const eh = Math.floor(total / 60) % 24;
  const em = total % 60;
  return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
}

function workflowOf(b: { booking_status?: string; status?: string }) {
  if (b.booking_status) return b.booking_status;
  if (b.status === 'cancelled') return 'denied';
  if (b.status === 'completed' || b.status === 'confirmed') return 'confirmed';
  return 'pending';
}

function slotsOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  const toMins = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const s1 = toMins(start1), e1 = toMins(end1);
  const s2 = toMins(start2), e2 = toMins(end2);
  return s1 < e2 && s2 < e1;
}

export default function AdminConsultationsPage() {
  const socket = useSocket();
  const router = useRouter();
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [authReady, setAuthReady] = useState(false);
  const [slots, setSlots] = useState<any[]>([]);
  const [totalSlots, setTotalSlots] = useState(0);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'single' | 'day' | 'bulk'>('single');

  // Tab 1 - Single slot
  const [singleDate, setSingleDate] = useState('');
  const [singleStart, setSingleStart] = useState('10:00');
  const [singleDuration, setSingleDuration] = useState(60);
  const [singleSuccess, setSingleSuccess] = useState<string | null>(null);

  // Tab 2 - One day
  const [dayDate, setDayDate] = useState('');
  const [daySlots, setDaySlots] = useState<{ start_time: string; duration_minutes: number }[]>([{ start_time: '10:00', duration_minutes: 60 }]);
  const [daySuccess, setDaySuccess] = useState<string | null>(null);

  // Tab 3 - Bulk
  const [bulkDateFrom, setBulkDateFrom] = useState('');
  const [bulkDateTo, setBulkDateTo] = useState('');
  const [bulkRepeatOn, setBulkRepeatOn] = useState<string[]>([]);
  const [bulkSlots, setBulkSlots] = useState<{ start_time: string; duration_minutes: number }[]>([{ start_time: '10:00', duration_minutes: 60 }]);
  const [bulkSkipDates, setBulkSkipDates] = useState('');
  const [bulkSuccess, setBulkSuccess] = useState<string | null>(null);

  // Slot management table
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [tablePage, setTablePage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const [bookingFilter, setBookingFilter] = useState('all');
  const [bookingWorkflowFilter, setBookingWorkflowFilter] = useState('all');
  const [bookingDateFilter, setBookingDateFilter] = useState('all');
  const [bookingSearch, setBookingSearch] = useState('');
  const [slotsTotalPages, setSlotsTotalPages] = useState(1);

  const [bookingModal, setBookingModal] = useState<'confirm' | 'deny' | 'reschedule' | 'note' | null>(null);
  const [activeBookingRow, setActiveBookingRow] = useState<any | null>(null);
  const [tutorNoteOpt, setTutorNoteOpt] = useState('');
  const [denyReason, setDenyReason] = useState('');
  const [rsDate, setRsDate] = useState('');
  const [rsTime, setRsTime] = useState('');
  const [rsMsg, setRsMsg] = useState('');

  const [cmSettings, setCmSettings] = useState({ is_enabled: true, disabled_message: '' });
  const [savingSettings, setSavingSettings] = useState(false);
  const [cmTeam, setCmTeam] = useState<{ id: number; name: string; email: string }[]>([]);

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('lms-user') || 'null');
    setUserRole(u?.role || null);
    setAuthReady(true);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const s = await apiService.getConsultationManagerSettings();
        if (s?.success) {
          setCmSettings({
            is_enabled: !!s.is_enabled,
            disabled_message: s.disabled_message || ''
          });
        }
        const t = await apiService.getConsultationManagerTeam();
        if (t?.success) setCmTeam(t.users || []);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: { date_from?: string; date_to?: string; status?: string; page?: number; limit?: number } = {};
      if (filterDateFrom) params.date_from = filterDateFrom;
      if (filterDateTo) params.date_to = filterDateTo;
      if (filterStatus) params.status = filterStatus;
      params.page = tablePage;
      params.limit = 20;
      const bookingParams: {
        scope: string;
        status?: string;
        booking_status?: string;
      } = { scope: 'all' };
      if (bookingFilter !== 'all') bookingParams.status = bookingFilter;
      if (bookingWorkflowFilter !== 'all') bookingParams.booking_status = bookingWorkflowFilter;
      const [slotsRes, bookingsRes] = await Promise.all([
        apiService.getConsultationSlotsAll(params),
        apiService.getConsultationBookings(bookingParams)
      ]);
      if (slotsRes?.success) {
        setSlots(slotsRes.slots || []);
        const tot = Number(slotsRes.total) || 0;
        setTotalSlots(tot);
        const tp = Number(slotsRes.totalPages);
        setSlotsTotalPages(tp > 0 ? tp : Math.max(1, Math.ceil(tot / 20)));
      }
      if (bookingsRes?.success) setBookings(bookingsRes.bookings || []);
    } catch (e) { }
    finally {
      setLoading(false);
    }
  };

  const fetchDataRef = useRef(fetchData);
  fetchDataRef.current = fetchData;

  useEffect(() => {
    fetchData();
  }, [filterDateFrom, filterDateTo, filterStatus, tablePage, bookingWorkflowFilter, bookingFilter]);

  useEffect(() => {
    if (!socket) return;
    const onSlotBooked = () => {
      fetchDataRef.current();
      showToast('A student just booked a consultation!', 'info');
    };
    const onConsultationCancelled = () => {
      fetchDataRef.current();
      showToast('A student cancelled their consultation', 'warning');
    };
    const onConsultationCompleted = (data: { studentName?: string; autoCompleted?: boolean }) => {
      fetchDataRef.current();
      if (data?.autoCompleted) {
        showToast(`Consultation auto-completed: ${data.studentName || 'Unknown'}`, 'info');
      } else {
        showToast(`Consultation marked complete: ${data.studentName || 'Unknown'}`, 'success');
      }
    };
    socket.on('slot_booked', onSlotBooked);
    socket.on('consultation_cancelled', onConsultationCancelled);
    socket.on('consultation_completed', onConsultationCompleted);
    const onBookingFlow = () => fetchDataRef.current();
    socket.on('booking_confirmed', onBookingFlow);
    socket.on('booking_denied', onBookingFlow);
    socket.on('booking_rescheduled', onBookingFlow);
    return () => {
      socket.off('slot_booked', onSlotBooked);
      socket.off('consultation_cancelled', onConsultationCancelled);
      socket.off('consultation_completed', onConsultationCompleted);
      socket.off('booking_confirmed', onBookingFlow);
      socket.off('booking_denied', onBookingFlow);
      socket.off('booking_rescheduled', onBookingFlow);
    };
  }, [socket]);

  const today = new Date().toISOString().slice(0, 10);

  const handleSingleAdd = async () => {
    if (!singleDate || !singleStart) {
      alert('Select date and start time');
      return;
    }
    if (singleDate < today) {
      alert('Cannot create slots in the past');
      return;
    }
    setSaving(true);
    setSingleSuccess(null);
    try {
      const res = await apiService.createConsultationSlotSingle({
        date: singleDate,
        start_time: singleStart,
        duration_minutes: singleDuration
      });
      if (res?.success) {
        setSingleSuccess(`Slot created: ${singleDate} ${singleStart} - ${addMinutesToTime(singleStart, singleDuration)} (${singleDuration} min)`);
        fetchData();
      } else {
        alert(res?.message || 'Failed to create slot');
      }
    } catch (e) {
      alert((e instanceof Error ? e.message : null) || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDaySave = async () => {
    if (!dayDate || daySlots.length === 0) {
      alert('Select date and add at least one slot');
      return;
    }
    if (dayDate < today) {
      alert('Cannot create slots in the past');
      return;
    }
    const conflicts = getDaySlotConflicts();
    if (conflicts.length > 0) {
      alert('Fix overlapping slots before saving');
      return;
    }
    setSaving(true);
    setDaySuccess(null);
    try {
      const res = await apiService.createConsultationSlotsDay({ date: dayDate, slots: daySlots });
      if (res?.success) {
        setDaySuccess(`Created ${res.created?.length ?? 0} slots for ${dayDate}`);
        setDaySlots([{ start_time: '10:00', duration_minutes: 60 }]);
        fetchData();
      } else {
        alert(res?.message || 'Failed to create slots');
      }
    } catch (e) {
      alert((e instanceof Error ? e.message : null) || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const getDaySlotConflicts = (): number[][] => {
    const conflicts: number[][] = [];
    const computed = daySlots.map((s, i) => ({
      i,
      start: s.start_time,
      end: addMinutesToTime(s.start_time, s.duration_minutes)
    }));
    for (let i = 0; i < computed.length; i++) {
      for (let j = i + 1; j < computed.length; j++) {
        if (slotsOverlap(computed[i].start, computed[i].end, computed[j].start, computed[j].end)) {
          conflicts.push([i, j]);
        }
      }
    }
    return conflicts;
  };

  const isDaySlotConflicting = (idx: number): boolean => {
    return getDaySlotConflicts().some(([a, b]) => a === idx || b === idx);
  };

  const handleBulkCreate = async () => {
    if (!bulkDateFrom || !bulkDateTo || bulkRepeatOn.length === 0 || bulkSlots.length === 0) {
      alert('Fill date range, select days, and add at least one slot');
      return;
    }
    if (bulkDateTo <= bulkDateFrom) {
      alert('End date must be after start date');
      return;
    }
    const from = new Date(bulkDateFrom);
    const to = new Date(bulkDateTo);
    const daysDiff = Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
    if (daysDiff > 31) {
      alert('Maximum 1 month range');
      return;
    }
    const conflicts = getBulkSlotConflicts();
    if (conflicts.length > 0) {
      alert('Slot templates overlap');
      return;
    }
    const count = estimateBulkCount();
    if (!confirm(`Are you sure you want to create approximately ${count} slots?`)) return;
    setSaving(true);
    setBulkSuccess(null);
    try {
      const skipDates = bulkSkipDates
        .split(/[\s,]+/)
        .map(d => d.trim())
        .filter(Boolean);
      const res = await apiService.createConsultationSlotsBulk({
        date_from: bulkDateFrom,
        date_to: bulkDateTo,
        repeat_on: bulkRepeatOn,
        slots: bulkSlots,
        skip_dates: skipDates.length ? skipDates : undefined
      });
      if (res?.success) {
        setBulkSuccess(`Created ${res.created ?? 0} slots across ${(res.dates_affected ?? []).length} days`);
        fetchData();
      } else {
        alert(res?.message || 'Failed to create slots');
      }
    } catch (e) {
      alert((e instanceof Error ? e.message : null) || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const getBulkSlotConflicts = (): number[][] => {
    const conflicts: number[][] = [];
    const computed = bulkSlots.map((s, i) => ({
      i,
      start: s.start_time,
      end: addMinutesToTime(s.start_time, s.duration_minutes)
    }));
    for (let i = 0; i < computed.length; i++) {
      for (let j = i + 1; j < computed.length; j++) {
        if (slotsOverlap(computed[i].start, computed[i].end, computed[j].start, computed[j].end)) {
          conflicts.push([i, j]);
        }
      }
    }
    return conflicts;
  };

  const estimateBulkCount = (): number => {
    const from = new Date(bulkDateFrom);
    const to = new Date(bulkDateTo);
    const skipSet = new Set(
      bulkSkipDates.split(/[\s,]+/).map(d => d.trim()).filter(Boolean)
    );
    let days = 0;
    let d = new Date(from);
    while (d <= to) {
      const dateStr = d.toISOString().slice(0, 10);
      if (!skipSet.has(dateStr)) {
        const dayName = DAYS[d.getDay()];
        if (bulkRepeatOn.includes(dayName)) days++;
      }
      d.setDate(d.getDate() + 1);
    }
    return days * bulkSlots.length;
  };

  const handleDeleteSlot = async (slotId: number) => {
    if (!confirm('Remove this slot?')) return;
    try {
      const res = await apiService.deleteConsultationSlot(slotId);
      if (res?.success) {
        fetchData();
        setSelectedIds(prev => { const n = new Set(prev); n.delete(slotId); return n; });
      } else alert(res?.message || 'Cannot delete');
    } catch (e) {
      alert((e instanceof Error ? e.message : null) || 'Failed');
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      alert('Select slots to delete');
      return;
    }
    if (!confirm(`Delete ${ids.length} available slot(s)?`)) return;
    try {
      const res = await apiService.deleteConsultationSlotsBulk(ids);
      if (res?.success) {
        fetchData();
        setSelectedIds(new Set());
      } else alert(res?.message || 'Failed');
    } catch (e) {
      alert((e instanceof Error ? e.message : null) || 'Failed');
    }
  };

  const handleCancelBooking = async (bookingId: number) => {
    if (!confirm('Cancel this booking?')) return;
    try {
      const res = await apiService.cancelConsultationBooking(bookingId);
      if (res?.success) fetchData();
      else alert(res?.message || 'Failed');
    } catch (e) {
      alert((e instanceof Error ? e.message : null) || 'Failed');
    }
  };

  const openBookingModal = (type: 'confirm' | 'deny' | 'reschedule' | 'note', b: any) => {
    setBookingModal(type);
    setActiveBookingRow(b);
    setTutorNoteOpt('');
    setDenyReason('');
    setRsDate('');
    setRsTime('');
    setRsMsg('');
  };

  const closeBookingModal = () => {
    setBookingModal(null);
    setActiveBookingRow(null);
  };

  const submitStaffConfirm = async () => {
    if (!activeBookingRow) return;
    try {
      const res = await apiService.confirmConsultationBooking(activeBookingRow.id, {
        tutor_note: tutorNoteOpt.trim() || undefined
      });
      if (res?.success) {
        showToast('Booking confirmed', 'success');
        closeBookingModal();
        fetchData();
      } else showToast(res?.message || 'Failed', 'error');
    } catch {
      showToast('Failed', 'error');
    }
  };

  const submitStaffDeny = async () => {
    if (!activeBookingRow || !denyReason.trim()) {
      showToast('Please provide a reason for denying', 'error');
      return;
    }
    try {
      const res = await apiService.denyConsultationBooking(activeBookingRow.id, { tutor_note: denyReason.trim() });
      if (res?.success) {
        showToast('Request denied', 'success');
        closeBookingModal();
        fetchData();
      } else showToast(res?.message || 'Failed', 'error');
    } catch {
      showToast('Failed', 'error');
    }
  };

  const submitStaffReschedule = async () => {
    if (!activeBookingRow || !rsDate || !rsTime || !rsMsg.trim()) {
      showToast('Date, time and message are required', 'error');
      return;
    }
    try {
      const res = await apiService.rescheduleConsultationBooking(activeBookingRow.id, {
        reschedule_date: rsDate,
        reschedule_time: rsTime,
        tutor_note: rsMsg.trim()
      });
      if (res?.success) {
        showToast('Reschedule suggestion sent', 'success');
        closeBookingModal();
        fetchData();
      } else showToast(res?.message || 'Failed', 'error');
    } catch {
      showToast('Failed', 'error');
    }
  };

  const confirmRescheduleStaff = async (bookingId: number) => {
    try {
      const res = await apiService.confirmConsultationReschedule(bookingId);
      if (res?.success) {
        showToast('Reschedule confirmed', 'success');
        fetchData();
      } else showToast(res?.message || 'Failed', 'error');
    } catch {
      showToast('Failed', 'error');
    }
  };

  const handleToggleSlotActive = async (slotId: number) => {
    try {
      const res = await apiService.toggleConsultationSlotActive(slotId);
      if (res?.success) fetchData();
      else alert(res?.message || 'Failed to update slot');
    } catch (e) {
      alert((e instanceof Error ? e.message : null) || 'Failed');
    }
  };

  const handleMarkComplete = async (bookingId: number) => {
    const result = await Swal.fire({
      title: 'Mark as Completed?',
      text: 'This will mark the consultation as completed.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#16a34a',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Yes, complete it',
      cancelButtonText: 'Cancel'
    });
    if (!result.isConfirmed) return;
    try {
      const res = await apiService.markConsultationComplete(bookingId);
      if (res?.success) {
        showToast('Consultation marked as completed', 'success');
        fetchData();
      } else alert(res?.message || 'Failed');
    } catch {
      showToast('Failed to mark as completed', 'error');
    }
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
  
  const getStatus = (s: any) => {
    if (s.is_active === 0) return 'Inactive';
    return s.is_booked ? 'Booked' : 'Available';
  };

  const toggleSelect = (id: number, booked: boolean) => {
    if (booked) return;
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const totalPages = Math.max(1, slotsTotalPages);

  const getBookingStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; color: string; dot: string; label: string }> = {
      confirmed: { bg: 'bg-sky-50', color: 'text-sky-700', dot: 'bg-sky-500', label: 'Confirmed' },
      completed: { bg: 'bg-emerald-50', color: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Completed' },
      cancelled: { bg: 'bg-rose-50', color: 'text-rose-700', dot: 'bg-rose-500', label: 'Cancelled' },
      pending: { bg: 'bg-amber-50', color: 'text-amber-700', dot: 'bg-amber-500', label: 'Pending' }
    };
    const s = styles[status] || styles.pending;
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${s.bg} ${s.color}`}>
        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${s.dot}`}></span>
        {s.label}
      </span>
    );
  };

  const getWorkflowBookingBadge = (wf: string) => {
    if (wf === 'pending')
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-orange-100 text-[#f97316] text-xs font-bold animate-pulse">
          ⏳ Pending
        </span>
      );
    if (wf === 'confirmed')
      return <span className="inline-flex px-2 py-1 rounded-full bg-green-100 text-[#22c55e] text-xs font-bold">✅ Confirmed</span>;
    if (wf === 'denied')
      return <span className="inline-flex px-2 py-1 rounded-full bg-red-100 text-[#ef4444] text-xs font-bold">❌ Denied</span>;
    if (wf === 'rescheduled')
      return <span className="inline-flex px-2 py-1 rounded-full bg-blue-100 text-[#3b82f6] text-xs font-bold">📅 Rescheduled</span>;
    return <span className="text-xs text-gray-500">{wf}</span>;
  };

  const filteredBookings = bookings.filter((b: any) => {
    if (bookingSearch) {
      const s = bookingSearch.toLowerCase();
      if (!String(b.student_name || '').toLowerCase().includes(s) &&
          !String(b.student_email || '').toLowerCase().includes(s)) return false;
    }
    if (bookingDateFilter !== 'all') {
      const bd = new Date(b.date);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      if (bookingDateFilter === 'today' && bd.toDateString() !== now.toDateString()) return false;
      if (bookingDateFilter === 'upcoming' && bd < now) return false;
      if (bookingDateFilter === 'past' && bd >= now) return false;
      if (bookingDateFilter === 'week') {
        const weekEnd = new Date(now);
        weekEnd.setDate(weekEnd.getDate() + 7);
        if (bd < now || bd > weekEnd) return false;
      }
      if (bookingDateFilter === 'month') {
        if (bd.getMonth() !== now.getMonth() || bd.getFullYear() !== now.getFullYear()) return false;
      }
    }
    return true;
  });

  const saveCmSettings = async () => {
    const msg = cmSettings.disabled_message.trim();
    if (!cmSettings.is_enabled && !msg) {
      showToast('Enter a disabled message when turning the portal off', 'error');
      return;
    }
    if (!cmSettings.is_enabled) {
      const r = await Swal.fire({
        title: 'Disable Consultation Manager?',
        text: 'The Consultation Manager will see only the offline message when they login.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#E51791',
        confirmButtonText: 'Yes, disable it'
      });
      if (!r.isConfirmed) return;
    }
    setSavingSettings(true);
    try {
      const res = await apiService.updateConsultationManagerSettings({
        is_enabled: cmSettings.is_enabled,
        disabled_message: msg || ' '
      });
      if (res?.success) {
        showToast('Settings saved', 'success');
        setCmSettings((prev) => ({
          is_enabled: res.is_enabled ?? prev.is_enabled,
          disabled_message: res.disabled_message ?? prev.disabled_message
        }));
      } else showToast(res?.message || 'Failed to save settings', 'error');
    } catch {
      showToast('Failed to save settings', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={['Admin']} userRole={userRole} authReady={authReady}>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        {/* Premium Header with your colors */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-[#11CCEF] via-[#E51791] to-[#11CCEF] animate-gradient-x"></div>
          <div className="absolute inset-0 bg-black/10 backdrop-blur-sm"></div>
          
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => router.push('/dashboard/admin')} 
                className="flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-xl text-white hover:bg-white/30 transition-all"
              >
                <span>←</span> Back to Dashboard
              </button>
            </div>
            
            <div className="mt-6">
              <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">
                CONSULTATIONS
              </h1>
              <p className="mt-3 text-white/90 text-lg max-w-2xl">
                Manage Zoom video consultation slots and student bookings
              </p>
            </div>

            {/* Stats Cards */}
            <div className="mt-8 flex flex-wrap gap-4">
              <div className="bg-white/10 backdrop-blur-xl rounded-2xl px-6 py-4 border border-white/20 shadow-2xl">
                <p className="text-sm text-white/80">Total Slots</p>
                <p className="text-3xl font-bold text-white">{totalSlots}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-xl rounded-2xl px-6 py-4 border border-white/20 shadow-2xl">
                <p className="text-sm text-white/80">Total Bookings</p>
                <p className="text-3xl font-bold text-white">{bookings.length}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-[#0f172a] mb-4">Consultation Manager Role</h2>
            <div className="flex flex-wrap items-center gap-4 mb-4">
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                  cmSettings.is_enabled ? 'bg-[#f0fdf4] text-[#16a34a]' : 'bg-[#fef2f2] text-[#b91c1c]'
                }`}
              >
                {cmSettings.is_enabled ? '● ACTIVE' : '● OFFLINE'}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={cmSettings.is_enabled}
                onClick={() => setCmSettings((s) => ({ ...s, is_enabled: !s.is_enabled }))}
                className={`relative w-14 h-8 rounded-full transition-colors ${
                  cmSettings.is_enabled ? 'bg-[#11CCEF]' : 'bg-[#94a3b8]'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                    cmSettings.is_enabled ? 'translate-x-6' : ''
                  }`}
                />
              </button>
            </div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Disabled message</label>
            <textarea
              rows={3}
              value={cmSettings.disabled_message}
              onChange={(e) => setCmSettings((s) => ({ ...s, disabled_message: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl resize-y min-h-[80px] focus:border-[#11CCEF] focus:ring-2 focus:ring-[#11CCEF]/20"
            />
            <button
              type="button"
              disabled={savingSettings}
              onClick={saveCmSettings}
              className="mt-4 px-6 py-3 rounded-xl bg-[#11CCEF] text-white font-semibold disabled:opacity-50"
            >
              {savingSettings ? 'Saving…' : 'Save settings'}
            </button>
          </div>

          {/* Slot Creation Tabs */}
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="flex border-b border-gray-100">
              {(['single', 'day', 'bulk'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`relative px-8 py-4 text-sm font-bold transition-all ${
                    activeTab === tab 
                      ? 'text-[#E51791]' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab === 'single' && '📌 Single Slot'}
                  {tab === 'day' && '📅 One Day (Multiple)'}
                  {tab === 'bulk' && '📆 Bulk / Month'}
                  {activeTab === tab && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#11CCEF] to-[#E51791]"></div>
                  )}
                </button>
              ))}
            </div>

            <div className="p-8">
              {/* Tab 1 - Single Slot */}
              {activeTab === 'single' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                        Date
                      </label>
                      <input
                        type="date"
                        min={today}
                        value={singleDate}
                        onChange={e => setSingleDate(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#11CCEF] focus:ring-4 focus:ring-[#11CCEF]/20 transition-all"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                        Start Time
                      </label>
                      <select
                        value={singleStart}
                        onChange={e => setSingleStart(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#11CCEF] focus:ring-4 focus:ring-[#11CCEF]/20 transition-all"
                      >
                        {START_TIMES.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                        Duration
                      </label>
                      <div className="flex gap-2">
                        {DURATIONS.map(d => (
                          <button
                            key={d}
                            onClick={() => setSingleDuration(d)}
                            className={`flex-1 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                              singleDuration === d 
                                ? 'bg-gradient-to-r from-[#11CCEF] to-[#E51791] text-white shadow-lg' 
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {d}m
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                        End Time
                      </label>
                      <div className="px-4 py-3 bg-gradient-to-r from-[#11CCEF]/10 to-[#E51791]/10 rounded-xl font-mono font-bold text-[#E51791] border-2 border-[#11CCEF]/20">
                        {addMinutesToTime(singleStart, singleDuration)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-end">
                    <button
                      onClick={handleSingleAdd}
                      disabled={saving}
                      className="px-8 py-4 bg-gradient-to-r from-[#11CCEF] to-[#E51791] text-white rounded-xl font-bold hover:shadow-xl transition-all disabled:opacity-50 transform hover:scale-105"
                    >
                      {saving ? (
                        <span className="flex items-center gap-2">
                          <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                          Creating...
                        </span>
                      ) : (
                        '➕ Create Slot'
                      )}
                    </button>
                  </div>
                  
                  {singleSuccess && (
                    <div className="p-4 bg-emerald-50 border-l-4 border-emerald-500 rounded-xl">
                      <p className="text-emerald-700 font-medium">{singleSuccess}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2 - One Day */}
              {activeTab === 'day' && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                      Date
                    </label>
                    <input
                      type="date"
                      min={today}
                      value={dayDate}
                      onChange={e => setDayDate(e.target.value)}
                      className="w-full max-w-md px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#11CCEF] focus:ring-4 focus:ring-[#11CCEF]/20 transition-all"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                      Slots for this day (max 8)
                    </label>
                    <div className="space-y-3">
                      {daySlots.map((s, i) => (
                        <div
                          key={i}
                          className={`flex items-center gap-3 flex-wrap p-4 rounded-xl transition-all ${
                            isDaySlotConflicting(i) 
                              ? 'bg-rose-50 border-2 border-rose-300' 
                              : 'bg-gray-50 border-2 border-gray-200'
                          }`}
                        >
                          <select
                            value={s.start_time}
                            onChange={e => setDaySlots(arr => {
                              const n = [...arr];
                              n[i] = { ...n[i], start_time: e.target.value };
                              return n;
                            })}
                            className="px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-[#11CCEF]"
                          >
                            {START_TIMES.map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                          
                          <div className="flex gap-1">
                            {DURATIONS.map(d => (
                              <button
                                key={d}
                                onClick={() => setDaySlots(arr => {
                                  const n = [...arr];
                                  n[i] = { ...n[i], duration_minutes: d };
                                  return n;
                                })}
                                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                                  s.duration_minutes === d 
                                    ? 'bg-gradient-to-r from-[#11CCEF] to-[#E51791] text-white' 
                                    : 'bg-white text-gray-600 border-2 border-gray-200 hover:border-[#11CCEF]'
                                }`}
                              >
                                {d}m
                              </button>
                            ))}
                          </div>
                          
                          <span className={`text-sm font-mono font-bold ${
                            isDaySlotConflicting(i) ? 'text-rose-600' : 'text-[#E51791]'
                          }`}>
                            → {addMinutesToTime(s.start_time, s.duration_minutes)}
                          </span>
                          
                          {isDaySlotConflicting(i) && (
                            <span className="text-xs font-bold text-rose-600">⚠️ Overlaps</span>
                          )}
                          
                          <button
                            onClick={() => setDaySlots(arr => arr.filter((_, j) => j !== i))}
                            className="ml-auto px-4 py-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                    
                    <button
                      onClick={() => setDaySlots(arr => arr.length < 8 ? [...arr, { start_time: '10:00', duration_minutes: 60 }] : arr)}
                      disabled={daySlots.length >= 8}
                      className="mt-4 px-6 py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-[#11CCEF] hover:text-[#11CCEF] transition-all disabled:opacity-50 font-medium"
                    >
                      + Add Another Slot
                    </button>
                  </div>
                  
                  <div className="flex justify-end">
                    <button
                      onClick={handleDaySave}
                      disabled={saving || getDaySlotConflicts().length > 0}
                      className="px-8 py-4 bg-gradient-to-r from-[#11CCEF] to-[#E51791] text-white rounded-xl font-bold hover:shadow-xl transition-all disabled:opacity-50 transform hover:scale-105"
                    >
                      {saving ? (
                        <span className="flex items-center gap-2">
                          <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                          Saving...
                        </span>
                      ) : (
                        '💾 Save All Slots'
                      )}
                    </button>
                  </div>
                  
                  {daySuccess && (
                    <div className="p-4 bg-emerald-50 border-l-4 border-emerald-500 rounded-xl">
                      <p className="text-emerald-700 font-medium">{daySuccess}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3 - Bulk */}
              {activeTab === 'bulk' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                        From Date
                      </label>
                      <input
                        type="date"
                        min={today}
                        value={bulkDateFrom}
                        onChange={e => setBulkDateFrom(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#11CCEF] focus:ring-4 focus:ring-[#11CCEF]/20 transition-all"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                        To Date
                      </label>
                      <input
                        type="date"
                        min={bulkDateFrom || today}
                        value={bulkDateTo}
                        onChange={e => setBulkDateTo(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#11CCEF] focus:ring-4 focus:ring-[#11CCEF]/20 transition-all"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                      Repeat On
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {DAYS.map(d => (
                        <label key={d} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={bulkRepeatOn.includes(d)}
                            onChange={e => setBulkRepeatOn(prev => e.target.checked ? [...prev, d] : prev.filter(x => x !== d))}
                            className="w-5 h-5 text-[#11CCEF] rounded focus:ring-[#11CCEF]"
                          />
                          <span className="font-medium text-gray-700">{DAY_LABELS[d]}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                      Slot Templates (per day)
                    </label>
                    <div className="space-y-3">
                      {bulkSlots.map((s, i) => (
                        <div key={i} className="flex items-center gap-3 flex-wrap p-4 bg-gray-50 rounded-xl border-2 border-gray-200">
                          <select
                            value={s.start_time}
                            onChange={e => setBulkSlots(arr => {
                              const n = [...arr];
                              n[i] = { ...n[i], start_time: e.target.value };
                              return n;
                            })}
                            className="px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-[#11CCEF]"
                          >
                            {START_TIMES.map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                          
                          <div className="flex gap-1">
                            {DURATIONS.map(d => (
                              <button
                                key={d}
                                onClick={() => setBulkSlots(arr => {
                                  const n = [...arr];
                                  n[i] = { ...n[i], duration_minutes: d };
                                  return n;
                                })}
                                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                                  s.duration_minutes === d 
                                    ? 'bg-gradient-to-r from-[#11CCEF] to-[#E51791] text-white' 
                                    : 'bg-white text-gray-600 border-2 border-gray-200 hover:border-[#11CCEF]'
                                }`}
                              >
                                {d}m
                              </button>
                            ))}
                          </div>
                          
                          <span className="text-sm font-mono font-bold text-[#E51791]">
                            → {addMinutesToTime(s.start_time, s.duration_minutes)}
                          </span>
                          
                          <button
                            onClick={() => setBulkSlots(arr => arr.filter((_, j) => j !== i))}
                            className="ml-auto px-4 py-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                    
                    <button
                      onClick={() => setBulkSlots(arr => [...arr, { start_time: '10:00', duration_minutes: 60 }])}
                      className="mt-4 px-6 py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-[#11CCEF] hover:text-[#11CCEF] transition-all font-medium"
                    >
                      + Add Slot Template
                    </button>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                      Skip Dates (comma-separated)
                    </label>
                    <input
                      type="text"
                      placeholder="2026-04-15, 2026-04-16"
                      value={bulkSkipDates}
                      onChange={e => setBulkSkipDates(e.target.value)}
                      className="w-full max-w-lg px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#11CCEF] focus:ring-4 focus:ring-[#11CCEF]/20 transition-all"
                    />
                    <p className="mt-1 text-xs text-gray-400">Format: YYYY-MM-DD, separate with commas</p>
                  </div>
                  
                  {bulkDateFrom && bulkDateTo && bulkRepeatOn.length > 0 && (
                    <div className="p-5 bg-gradient-to-r from-[#11CCEF]/10 to-[#E51791]/10 rounded-xl border-2 border-[#11CCEF]/20">
                      <p className="text-sm font-medium text-gray-700">
                        This will create approximately <span className="text-2xl font-black text-[#E51791]">{estimateBulkCount()}</span> slots across the selected days.
                      </p>
                    </div>
                  )}
                  
                  <div className="flex justify-end">
                    <button
                      onClick={handleBulkCreate}
                      disabled={saving || !bulkDateFrom || !bulkDateTo || bulkRepeatOn.length === 0 || bulkSlots.length === 0 || getBulkSlotConflicts().length > 0}
                      className="px-8 py-4 bg-gradient-to-r from-[#11CCEF] to-[#E51791] text-white rounded-xl font-bold hover:shadow-xl transition-all disabled:opacity-50 transform hover:scale-105"
                    >
                      {saving ? (
                        <span className="flex items-center gap-2">
                          <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                          Creating...
                        </span>
                      ) : (
                        '🚀 Create All Slots'
                      )}
                    </button>
                  </div>
                  
                  {bulkSuccess && (
                    <div className="p-4 bg-emerald-50 border-l-4 border-emerald-500 rounded-xl">
                      <p className="text-emerald-700 font-medium">{bulkSuccess}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Slot Management Table */}
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="px-8 py-6 bg-gradient-to-r from-[#11CCEF] to-[#E51791]">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">📋 Slot Management</h2>
                {selectedIds.size > 0 && (
                  <button
                    onClick={handleBulkDelete}
                    className="px-6 py-2 bg-white/20 backdrop-blur-sm rounded-xl text-white font-bold hover:bg-white/30 transition-all"
                  >
                    Delete {selectedIds.size} Selected
                  </button>
                )}
              </div>
            </div>
            
            <div className="p-6">
              {/* Filters */}
              <div className="flex flex-wrap gap-4 mb-6">
                <div className="flex-1 min-w-[200px]">
                  <input
                    type="date"
                    value={filterDateFrom}
                    onChange={e => setFilterDateFrom(e.target.value)}
                    placeholder="From"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#11CCEF] transition-all"
                  />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <input
                    type="date"
                    value={filterDateTo}
                    onChange={e => setFilterDateTo(e.target.value)}
                    placeholder="To"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#11CCEF] transition-all"
                  />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#11CCEF] transition-all"
                  >
                    <option value="">All Statuses</option>
                    <option value="available">Available</option>
                    <option value="booked">Booked</option>
                  </select>
                </div>
              </div>

              {loading ? (
                <div className="text-center py-16">
                  <div className="inline-block w-16 h-16 border-4 border-[#11CCEF] border-t-[#E51791] rounded-full animate-spin"></div>
                  <p className="mt-4 text-gray-500 font-medium">Loading slots...</p>
                </div>
              ) : slots.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-6xl mb-4">📭</div>
                  <h3 className="text-xl font-black text-gray-800">No slots found</h3>
                  <p className="text-gray-500 mt-2">Try adjusting your filters or create new slots.</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b-2 border-gray-100">
                          <th className="px-4 py-3 text-left">
                            <input
                              type="checkbox"
                              checked={slots.filter(s => !s.is_booked).length > 0 && slots.filter(s => !s.is_booked).every(s => selectedIds.has(s.id))}
                              onChange={e => {
                                if (e.target.checked) {
                                  setSelectedIds(new Set(slots.filter(s => !s.is_booked).map(s => s.id)));
                                } else setSelectedIds(new Set());
                              }}
                              className="w-5 h-5 text-[#11CCEF] rounded focus:ring-[#11CCEF]"
                            />
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Date</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Day</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Start</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">End</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Duration</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Student</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {slots.map(s => (
                          <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-4">
                              {!s.is_booked && (
                                <input
                                  type="checkbox"
                                  checked={selectedIds.has(s.id)}
                                  onChange={() => toggleSelect(s.id, !!s.is_booked)}
                                  className="w-5 h-5 text-[#11CCEF] rounded focus:ring-[#11CCEF]"
                                />
                              )}
                            </td>
                            <td className="px-4 py-4 font-medium text-gray-900">{formatDate(s.date)}</td>
                            <td className="px-4 py-4 text-gray-600">
                              {new Date(s.date).toLocaleDateString('en-GB', { weekday: 'long' })}
                            </td>
                            <td className="px-4 py-4 font-mono font-bold text-[#11CCEF]">{formatTime(s.start_time)}</td>
                            <td className="px-4 py-4 font-mono text-gray-600">{formatTime(s.end_time)}</td>
                            <td className="px-4 py-4">{s.duration_minutes ?? 30} min</td>
                            <td className="px-4 py-4">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                                getStatus(s) === 'Available' 
                                  ? 'bg-emerald-100 text-emerald-700' 
                                  : getStatus(s) === 'Booked'
                                    ? 'bg-[#E51791]/10 text-[#E51791]'
                                    : getStatus(s) === 'Inactive'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-gray-100 text-gray-600'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                                  getStatus(s) === 'Available' 
                                    ? 'bg-emerald-500' 
                                    : getStatus(s) === 'Booked'
                                      ? 'bg-[#E51791]'
                                      : getStatus(s) === 'Inactive'
                                        ? 'bg-amber-500'
                                        : 'bg-gray-500'
                                }`}></span>
                                {getStatus(s)}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              {s.student_name ? (
                                <div>
                                  <p className="font-medium text-gray-900">{s.student_name}</p>
                                  <p className="text-xs text-gray-500">{s.student_email}</p>
                                </div>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              {!s.is_booked && (
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleSlotActive(s.id)}
                                    className="px-4 py-2 text-amber-700 hover:bg-amber-50 rounded-lg transition-all text-sm font-medium"
                                  >
                                    {s.is_active === 0 ? 'Activate' : 'Deactivate'}
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteSlot(s.id)} 
                                    className="px-4 py-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-all text-sm font-medium"
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {slots.length > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '16px 0',
                        borderTop: '1px solid #f1f5f9'
                      }}
                    >
                      <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                        Page {tablePage} of {totalPages} ({totalSlots} total slots)
                      </span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => setTablePage((p) => p - 1)}
                          disabled={tablePage === 1}
                          style={{
                            padding: '6px 16px',
                            borderRadius: '8px',
                            border: '1.5px solid #e2e8f0',
                            background: tablePage === 1 ? '#f8fafc' : '#fff',
                            color: tablePage === 1 ? '#cbd5e1' : '#0f172a',
                            cursor: tablePage === 1 ? 'not-allowed' : 'pointer',
                            fontSize: '12px',
                            fontWeight: 600,
                            fontFamily: 'inherit'
                          }}
                        >
                          ← Prev
                        </button>
                        <button
                          type="button"
                          onClick={() => setTablePage((p) => p + 1)}
                          disabled={tablePage === totalPages}
                          style={{
                            padding: '6px 16px',
                            borderRadius: '8px',
                            border: '1.5px solid #e2e8f0',
                            background: tablePage === totalPages ? '#f8fafc' : '#fff',
                            color: tablePage === totalPages ? '#cbd5e1' : '#0f172a',
                            cursor: tablePage === totalPages ? 'not-allowed' : 'pointer',
                            fontSize: '12px',
                            fontWeight: 600,
                            fontFamily: 'inherit'
                          }}
                        >
                          Next →
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* All Bookings */}
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="px-8 py-6 bg-gradient-to-r from-[#E51791] to-[#11CCEF]">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-white">📅 All Bookings</h2>
                <span className="px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold">
                  {filteredBookings.length}
                </span>
              </div>
            </div>
            
            <div className="p-6">
              <div className="flex flex-wrap gap-3 mb-6">
                <select
                  value={bookingFilter}
                  onChange={e => setBookingFilter(e.target.value)}
                  className="px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-semibold focus:border-[#11CCEF] transition-all"
                >
                  <option value="all">All row status</option>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <select
                  value={bookingWorkflowFilter}
                  onChange={e => setBookingWorkflowFilter(e.target.value)}
                  className="px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-semibold focus:border-[#11CCEF] transition-all"
                >
                  <option value="all">All workflow</option>
                  <option value="pending">Pending confirm</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="denied">Denied</option>
                  <option value="rescheduled">Rescheduled</option>
                </select>
                <select
                  value={bookingDateFilter}
                  onChange={e => setBookingDateFilter(e.target.value)}
                  className="px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-semibold focus:border-[#11CCEF] transition-all"
                >
                  <option value="all">All Dates</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="past">Past</option>
                  <option value="upcoming">Upcoming</option>
                </select>
                <input
                  value={bookingSearch}
                  onChange={e => setBookingSearch(e.target.value)}
                  placeholder="Search student name or email..."
                  className="flex-1 min-w-[200px] px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:border-[#11CCEF] transition-all"
                />
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <div className="inline-block w-12 h-12 border-3 border-[#11CCEF] border-t-[#E51791] rounded-full animate-spin"></div>
                </div>
              ) : filteredBookings.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-5xl mb-3">📭</div>
                  <p className="text-gray-500 font-medium">No bookings match your filters</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-gray-100">
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Student</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Time</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Student note</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Workflow</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredBookings.map((b: any) => {
                        const wf = workflowOf(b);
                        const sn = b.student_note || b.notes || '';
                        const snShort = sn.length > 50 ? `${sn.slice(0, 50)}…` : sn;
                        return (
                          <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-4">
                              <div className="font-medium text-gray-900">{b.student_name}</div>
                              <div className="text-xs text-gray-500">{b.student_email}</div>
                            </td>
                            <td className="px-4 py-4 font-medium text-gray-900">{formatDate(b.date)}</td>
                            <td className="px-4 py-4 font-mono font-bold text-[#11CCEF]">{formatTime(b.start_time)}</td>
                            <td className="px-4 py-4 max-w-[160px]">
                              {sn ? (
                                <button
                                  type="button"
                                  className="text-left text-xs text-gray-700 hover:text-[#11CCEF] underline"
                                  onClick={() => openBookingModal('note', b)}
                                >
                                  {snShort}
                                  {sn.length > 50 && <span className="text-[#3b82f6] ml-1">View more</span>}
                                </button>
                              ) : (
                                <span className="text-gray-400">&mdash;</span>
                              )}
                            </td>
                            <td className="px-4 py-4">{getBookingStatusBadge(b.status)}</td>
                            <td className="px-4 py-4">{getWorkflowBookingBadge(wf)}</td>
                            <td className="px-4 py-4">
                              <div className="flex flex-wrap gap-2">
                                {wf === 'pending' && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => openBookingModal('confirm', b)}
                                      className="px-3 py-2 bg-green-600 text-white rounded-lg text-xs font-bold"
                                    >
                                      ✅ Confirm
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openBookingModal('deny', b)}
                                      className="px-3 py-2 bg-red-600 text-white rounded-lg text-xs font-bold"
                                    >
                                      ❌ Deny
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openBookingModal('reschedule', b)}
                                      className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold"
                                    >
                                      📅 Reschedule
                                    </button>
                                  </>
                                )}
                                {wf === 'rescheduled' && (
                                  <div className="flex flex-col gap-1 text-xs text-gray-600">
                                    <span>
                                      New: {String(b.reschedule_date || '').slice(0, 10)} {formatTime(String(b.reschedule_time || ''))}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => confirmRescheduleStaff(b.id)}
                                      className="px-3 py-2 bg-green-600 text-white rounded-lg text-xs font-bold w-fit"
                                    >
                                      ✅ Confirm reschedule
                                    </button>
                                  </div>
                                )}
                                {wf === 'denied' && (
                                  <span className="text-xs text-gray-500">
                                    Denied{b.responded_by_name ? ` by ${b.responded_by_name}` : ''}
                                    {b.denied_at ? ` · ${new Date(b.denied_at).toLocaleString('en-GB')}` : ''}
                                  </span>
                                )}
                                {b.status === 'confirmed' && wf === 'confirmed' && b.zoom_start_url && (
                                  <a
                                    href={b.zoom_start_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-4 py-2 bg-gradient-to-r from-[#11CCEF] to-[#E51791] text-white rounded-lg text-xs font-bold hover:shadow-lg transition-all"
                                  >
                                    🎥 Start
                                  </a>
                                )}
                                {b.status === 'confirmed' && wf === 'confirmed' && (
                                  <button
                                    onClick={() => handleMarkComplete(b.id)}
                                    className="px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-all"
                                  >
                                    ✓ Complete
                                  </button>
                                )}
                                {b.status === 'confirmed' && wf === 'confirmed' && (
                                  <button
                                    onClick={() => handleCancelBooking(b.id)}
                                    className="px-4 py-2 border-2 border-rose-200 text-rose-600 rounded-lg text-xs font-bold hover:bg-rose-50 transition-all"
                                  >
                                    Cancel
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {bookingModal && activeBookingRow && (
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
              onClick={closeBookingModal}
            >
              <div
                className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6"
                onClick={(e) => e.stopPropagation()}
              >
                {bookingModal === 'note' && (
                  <>
                    <h3 className="text-lg font-bold text-[#0f172a] mb-2">Student note</h3>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {activeBookingRow.student_note || activeBookingRow.notes || '—'}
                    </p>
                    <button
                      type="button"
                      className="mt-4 px-4 py-2 rounded-xl bg-gray-100 font-semibold"
                      onClick={closeBookingModal}
                    >
                      Close
                    </button>
                  </>
                )}
                {bookingModal === 'confirm' && (
                  <>
                    <h3 className="text-lg font-bold text-[#0f172a] mb-4">Confirm consultation</h3>
                    <p className="text-sm text-gray-600 mb-1">
                      <strong>Student:</strong> {activeBookingRow.student_name}
                    </p>
                    <p className="text-sm text-gray-600 mb-1">
                      <strong>Date:</strong> {formatFullDate(activeBookingRow.date)} at {formatTime(activeBookingRow.start_time)}
                    </p>
                    <p className="text-sm text-gray-600 mb-4">
                      <strong>Note:</strong> {activeBookingRow.student_note || activeBookingRow.notes || '—'}
                    </p>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Message to student (optional)</label>
                    <textarea
                      className="w-full border rounded-xl p-3 text-sm mb-4"
                      rows={3}
                      value={tutorNoteOpt}
                      onChange={(e) => setTutorNoteOpt(e.target.value)}
                    />
                    <div className="flex gap-2 justify-end">
                      <button type="button" className="px-4 py-2 rounded-xl border" onClick={closeBookingModal}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="px-4 py-2 rounded-xl bg-green-600 text-white font-semibold"
                        onClick={submitStaffConfirm}
                      >
                        ✅ Confirm booking
                      </button>
                    </div>
                  </>
                )}
                {bookingModal === 'deny' && (
                  <>
                    <h3 className="text-lg font-bold text-[#0f172a] mb-4">Deny consultation request</h3>
                    <p className="text-sm text-gray-600 mb-1">
                      <strong>Student:</strong> {activeBookingRow.student_name}
                    </p>
                    <p className="text-sm text-gray-600 mb-1">
                      <strong>Date:</strong> {formatFullDate(activeBookingRow.date)} at {formatTime(activeBookingRow.start_time)}
                    </p>
                    <p className="text-sm text-gray-600 mb-4">
                      <strong>Student note:</strong> {activeBookingRow.student_note || activeBookingRow.notes || '—'}
                    </p>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Reason for denial *</label>
                    <textarea
                      className="w-full border rounded-xl p-3 text-sm mb-4"
                      rows={3}
                      value={denyReason}
                      onChange={(e) => setDenyReason(e.target.value)}
                    />
                    <div className="flex gap-2 justify-end">
                      <button type="button" className="px-4 py-2 rounded-xl border" onClick={closeBookingModal}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="px-4 py-2 rounded-xl bg-red-600 text-white font-semibold"
                        onClick={submitStaffDeny}
                      >
                        ❌ Deny booking
                      </button>
                    </div>
                  </>
                )}
                {bookingModal === 'reschedule' && (
                  <>
                    <h3 className="text-lg font-bold text-[#0f172a] mb-4">Suggest new date</h3>
                    <p className="text-sm text-gray-600 mb-1">
                      <strong>Student:</strong> {activeBookingRow.student_name}
                    </p>
                    <p className="text-sm text-gray-600 mb-4">
                      <strong>Original:</strong> {formatFullDate(activeBookingRow.date)} at {formatTime(activeBookingRow.start_time)}
                    </p>
                    <label className="block text-xs font-bold text-gray-600 mb-1">New date</label>
                    <input
                      type="date"
                      className="w-full border rounded-xl p-2 mb-2"
                      value={rsDate}
                      onChange={(e) => setRsDate(e.target.value)}
                    />
                    <label className="block text-xs font-bold text-gray-600 mb-1">New time</label>
                    <input
                      type="time"
                      className="w-full border rounded-xl p-2 mb-2"
                      value={rsTime}
                      onChange={(e) => setRsTime(e.target.value)}
                    />
                    <label className="block text-xs font-bold text-gray-600 mb-1">Message to student *</label>
                    <textarea
                      className="w-full border rounded-xl p-3 text-sm mb-4"
                      rows={3}
                      value={rsMsg}
                      onChange={(e) => setRsMsg(e.target.value)}
                    />
                    <div className="flex gap-2 justify-end">
                      <button type="button" className="px-4 py-2 rounded-xl border" onClick={closeBookingModal}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold"
                        onClick={submitStaffReschedule}
                      >
                        📅 Send new date
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-[#0f172a] mb-2">Consultation Manager users</h2>
            <p className="text-sm text-gray-600 mb-4">
              Active accounts with this role: <span className="font-semibold text-[#11CCEF]">{cmTeam.length}</span>
            </p>
            {cmTeam.length === 0 ? (
              <p className="text-sm text-gray-500">No Consultation Manager users yet.</p>
            ) : (
              <ul className="space-y-2">
                {cmTeam.map((u) => (
                  <li key={u.id} className="flex flex-wrap justify-between gap-2 text-sm border-b border-gray-100 pb-2 last:border-0">
                    <span className="font-medium text-gray-900">{u.name}</span>
                    <span className="text-gray-500">{u.email}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
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