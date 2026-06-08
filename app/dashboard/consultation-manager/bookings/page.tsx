'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSocket } from '@/app/contexts/SocketContext';
import { apiService } from '@/app/services/api';
import { showToast } from '@/app/components/Toast';
import Swal from 'sweetalert2';
import { 
  FiSearch, 
  FiFilter, 
  FiCalendar, 
  FiClock, 
  FiUser, 
  FiMail, 
  FiMessageSquare,
  FiCheck,
  FiX,
  FiRefreshCw,
  FiChevronLeft,
  FiChevronRight,
  FiChevronsLeft,
  FiChevronsRight,
  FiVideo,
  FiMoreVertical,
  FiDownload,
  FiEye,
  FiEdit,
  FiTrash2,
  FiPaperclip,
  FiSend
} from 'react-icons/fi';

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

// Utility functions - KEPT EXACTLY THE SAME
function formatTime(t: string) {
  return String(t).slice(0, 5);
}

function slotDate(s: { date: string | Date }) {
  const d = s.date;
  return d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
}

function workflowOf(b: { booking_status?: string; status?: string }) {
  if (b.booking_status) return b.booking_status;
  if (b.status === 'cancelled') return 'denied';
  if (b.status === 'completed' || b.status === 'confirmed') return 'confirmed';
  return 'pending';
}

// Custom hook for pagination
function usePagination<T>(items: T[], itemsPerPage: number = 10) {
  const [currentPage, setCurrentPage] = useState(1);
  
  const totalPages = Math.ceil(items.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedItems = items.slice(startIndex, endIndex);
  
  const goToPage = (page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(validPage);
  };
  
  const nextPage = () => goToPage(currentPage + 1);
  const prevPage = () => goToPage(currentPage - 1);
  const firstPage = () => goToPage(1);
  const lastPage = () => goToPage(totalPages);
  
  return {
    paginatedItems,
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    totalItems: items.length,
    goToPage,
    nextPage,
    prevPage,
    firstPage,
    lastPage,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1
  };
}

// Enhanced Status Badge Component
const StatusBadge = ({ status }: { status: string }) => {
  const configs: Record<string, { color: string; icon: any; label: string }> = {
    confirmed: { 
      color: 'bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-700 border-emerald-200', 
      icon: FiCheck, 
      label: 'Confirmed' 
    },
    completed: { 
      color: 'bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 border-blue-200', 
      icon: FiCheck, 
      label: 'Completed' 
    },
    pending: { 
      color: 'bg-gradient-to-r from-amber-50 to-amber-100 text-amber-700 border-amber-200', 
      icon: FiClock, 
      label: 'Pending' 
    },
    cancelled: { 
      color: 'bg-gradient-to-r from-red-50 to-red-100 text-red-700 border-red-200', 
      icon: FiX, 
      label: 'Cancelled' 
    }
  };
  
  const config = configs[status] || { 
    color: 'bg-gray-50 text-gray-700 border-gray-200', 
    icon: null, 
    label: status 
  };
  
  const Icon = config.icon;
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${config.color} shadow-sm`}>
      {Icon && <Icon className="w-3 h-3" />}
      {config.label}
    </span>
  );
};

// Enhanced Workflow Badge Component
const WorkflowBadge = ({ workflow }: { workflow: string }) => {
  const configs: Record<string, { color: string; icon: any; label: string; pulse?: boolean }> = {
    pending: {
      color: 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-amber-200',
      icon: FiClock,
      label: 'Pending Confirmation',
      pulse: true
    },
    confirmed: {
      color: 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-emerald-200',
      icon: FiCheck,
      label: 'Confirmed'
    },
    denied: {
      color: 'bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-red-200',
      icon: FiX,
      label: 'Denied'
    },
    rescheduled: {
      color: 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-cyan-200',
      icon: FiRefreshCw,
      label: 'Rescheduled'
    }
  };
  
  const config = configs[workflow] || {
    color: 'bg-gray-100 text-gray-700',
    icon: null,
    label: workflow
  };
  
  const Icon = config.icon;
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shadow-lg ${config.color} ${config.pulse ? 'animate-pulse' : ''}`}>
      {Icon && <Icon className="w-3 h-3" />}
      {config.label}
    </span>
  );
};

// Card View Component for Mobile
const BookingCard = ({ booking, onAction }: { booking: any; onAction: (type: string, data: any) => void }) => {
  const wf = workflowOf(booking);
  
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
            {booking.student_name?.charAt(0) || '?'}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{booking.student_name}</h3>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <FiMail className="w-3 h-3" />
              {booking.student_email}
            </p>
          </div>
        </div>
        <WorkflowBadge workflow={wf} />
      </div>
      
      {/* Details */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-2 text-gray-600">
          <FiCalendar className="w-4 h-4 text-gray-400" />
          <span>{slotDate(booking)}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-600">
          <FiClock className="w-4 h-4 text-gray-400" />
          <span>{formatTime(booking.start_time)} - {formatTime(booking.end_time)}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-600">
          <FiClock className="w-4 h-4 text-gray-400" />
          <span>{booking.duration_minutes ?? '—'} min</span>
        </div>
        <StatusBadge status={booking.status} />
      </div>
      
      {/* Note Preview */}
      {booking.student_note && (
        <div className="bg-gray-50 rounded-lg p-2 text-xs text-gray-600">
          <p className="line-clamp-2">{booking.student_note}</p>
          <button
            onClick={() => onAction('note', booking)}
            className="text-blue-600 hover:text-blue-700 font-medium mt-1"
          >
            Read more
          </button>
        </div>
      )}
      
      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
        {wf === 'pending' && (
          <>
            <button
              onClick={() => onAction('confirm', booking)}
              className="flex-1 px-3 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs font-semibold rounded-lg shadow-md hover:shadow-lg transition-all"
            >
              <FiCheck className="inline mr-1" /> Confirm
            </button>
            <button
              onClick={() => onAction('deny', booking)}
              className="flex-1 px-3 py-2 bg-gradient-to-r from-red-500 to-rose-600 text-white text-xs font-semibold rounded-lg shadow-md hover:shadow-lg transition-all"
            >
              <FiX className="inline mr-1" /> Deny
            </button>
            <button
              onClick={() => onAction('reschedule', booking)}
              className="w-full px-3 py-2 bg-gradient-to-r from-blue-500 to-cyan-600 text-white text-xs font-semibold rounded-lg shadow-md hover:shadow-lg transition-all"
            >
              <FiRefreshCw className="inline mr-1" /> Reschedule
            </button>
          </>
        )}
        
        {wf === 'rescheduled' && (
          <div className="w-full space-y-2">
            <p className="text-xs text-gray-600">
              New: {String(booking.reschedule_date || '').slice(0, 10)} {formatTime(String(booking.reschedule_time || ''))}
            </p>
            <button
              onClick={() => onAction('confirmReschedule', booking)}
              className="w-full px-3 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs font-semibold rounded-lg shadow-md hover:shadow-lg transition-all"
            >
              <FiCheck className="inline mr-1" /> Confirm Reschedule
            </button>
          </div>
        )}
        
        {booking.status === 'confirmed' && wf === 'confirmed' && (
          <>
            {booking.zoom_start_url && (
              <a
                href={booking.zoom_start_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 px-3 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-semibold rounded-lg shadow-md hover:shadow-lg transition-all text-center"
              >
                <FiVideo className="inline mr-1" /> Start Meeting
              </a>
            )}
            <button
              onClick={() => onAction('complete', booking)}
              className="flex-1 px-3 py-2 bg-gradient-to-r from-emerald-500 to-green-600 text-white text-xs font-semibold rounded-lg shadow-md hover:shadow-lg transition-all"
            >
              <FiCheck className="inline mr-1" /> Complete
            </button>
            <button
              onClick={() => onAction('cancel', booking)}
              className="w-full px-3 py-2 bg-red-50 text-red-700 text-xs font-semibold rounded-lg border border-red-200 hover:bg-red-100 transition-all"
            >
              <FiTrash2 className="inline mr-1" /> Cancel Booking
            </button>
          </>
        )}
        
        {(wf === 'pending' || wf === 'confirmed' || wf === 'rescheduled') && (
          <button
            type="button"
            onClick={() => onAction('messages', booking)}
            className="w-full px-3 py-2 bg-gradient-to-r from-teal-500 to-cyan-600 text-white text-xs font-bold rounded-lg shadow-md hover:shadow-lg transition-all"
          >
            <FiMessageSquare className="inline mr-1" /> Messages
          </button>
        )}
        <Link
          href={`/dashboard/consultation-manager/students/${booking.student_id}`}
          className="w-full px-3 py-2 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200 transition-all text-center"
        >
          <FiUser className="inline mr-1" /> View Student
        </Link>
      </div>
    </div>
  );
};

// Main Component
export default function ConsultationManagerBookingsPage() {
  const socket = useSocket();
  
  // State - KEPT EXACTLY THE SAME
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'completed' | 'cancelled' | 'pending'>('all');
  const [workflowFilter, setWorkflowFilter] = useState<'all' | 'pending' | 'confirmed' | 'denied' | 'rescheduled'>('all');
  const [datePreset, setDatePreset] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  
  // Pagination state
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Modal state
  const [modal, setModal] = useState<'confirm' | 'deny' | 'reschedule' | 'note' | 'messages' | null>(null);
  const [activeBooking, setActiveBooking] = useState<any | null>(null);
  const [tutorNoteOpt, setTutorNoteOpt] = useState('');
  const [denyReason, setDenyReason] = useState('');
  const [rsDate, setRsDate] = useState('');
  const [rsTime, setRsTime] = useState('');
  const [rsMsg, setRsMsg] = useState('');

  // Messaging state (chat thread per booking)
  const [messages, setMessages] = useState<Record<number, ConsultMessage[]>>({});
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [sendingMessage, setSendingMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  // Advanced filters state
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'status' | 'student'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modal functions
  const openModal = (type: 'confirm' | 'deny' | 'reschedule' | 'note' | 'messages', b: any) => {
    setModal(type);
    setActiveBooking(b);
    setTutorNoteOpt('');
    setDenyReason('');
    if (type === 'reschedule') {
      setRsDate('');
      setRsTime('');
      setRsMsg('');
    }
    if (type === 'messages') {
      setMessageInput('');
      setSelectedFiles([]);
      loadMessages(b.id);
    }
  };

  const closeModal = () => {
    setModal(null);
    setActiveBooking(null);
    setMessageInput('');
    setSelectedFiles([]);
  };

  const loadMessages = async (bookingId: number) => {
    setLoadingMessages(true);
    try {
      const res = await apiService.getConsultationMessages(bookingId);
      if (res?.success) {
        setMessages((prev) => ({ ...prev, [bookingId]: res.messages || [] }));
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 50);
      } else {
        showToast(res?.message || 'Failed to load messages', 'error');
      }
    } catch (e) {
      showToast(
        (e instanceof Error ? e.message : null) || 'Failed to load messages',
        'error'
      );
    } finally {
      setLoadingMessages(false);
    }
  };

  const sendMessage = async (bookingId: number) => {
    const text = messageInput.trim();
    if (!text && selectedFiles.length === 0) return;
    setSendingMessage(true);
    try {
      const res = await apiService.sendConsultationMessage(bookingId, {
        body: text,
        files: selectedFiles,
      });
      if (res?.success && res.message) {
        setMessages((prev) => {
          const list = prev[bookingId] || [];
          if (list.some((m) => m.id === res.message.id)) return prev;
          return { ...prev, [bookingId]: [...list, res.message] };
        });
        setMessageInput('');
        setSelectedFiles([]);
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 50);
      } else {
        showToast(res?.message || 'Failed to send message', 'error');
      }
    } catch (e) {
      showToast(
        (e instanceof Error ? e.message : null) || 'Failed to send message',
        'error'
      );
    } finally {
      setSendingMessage(false);
    }
  };

  // Load function - KEPT EXACTLY THE SAME
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const params: {
        scope: string;
        status?: string;
        booking_status?: string;
        date_from?: string;
        date_to?: string;
      } = { scope: 'all' };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (workflowFilter !== 'all') params.booking_status = workflowFilter;
      if (datePreset === 'today') {
        params.date_from = today;
        params.date_to = today;
      } else if (datePreset === 'week') {
        const d = new Date();
        const start = new Date(d);
        start.setDate(d.getDate() - d.getDay());
        params.date_from = start.toISOString().slice(0, 10);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        params.date_to = end.toISOString().slice(0, 10);
      } else if (datePreset === 'month') {
        const d = new Date();
        const start = new Date(d.getFullYear(), d.getMonth(), 1);
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        params.date_from = start.toISOString().slice(0, 10);
        params.date_to = end.toISOString().slice(0, 10);
      }
      const res = await apiService.getConsultationBookings(params);
      if (res?.success) setBookings(res.bookings || []);
    } catch {
      showToast('Failed to load bookings', 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, datePreset, workflowFilter]);

  useEffect(() => {
    load();
  }, [load]);

  // Socket - KEPT EXACTLY THE SAME
  useEffect(() => {
    if (!socket) return;
    const onUp = () => load();
    const onCompleted = (data: { studentName?: string; autoCompleted?: boolean }) => {
      load();
      if (data?.autoCompleted) {
        showToast(`Consultation auto-completed: ${data.studentName || 'Unknown'}`, 'info');
      }
    };
    const onMessageNew = (data: { bookingId?: number; message?: ConsultMessage }) => {
      const bid = Number(data?.bookingId);
      const msg = data?.message;
      if (!bid || !msg) return;
      setMessages((prev) => {
        const list = prev[bid] || [];
        if (list.some((m) => m.id === msg.id)) return prev;
        return { ...prev, [bid]: [...list, msg] };
      });
      // Toast notification only for messages from the student
      if (msg.sender_role === 'student') {
        const preview =
          (msg.body && msg.body.slice(0, 80)) ||
          (msg.files && msg.files.length ? `New file: ${msg.files[0].file_name}` : 'New message');
        showToast(`💬 ${msg.sender_name || 'Student'}: ${preview}`, 'info', 8000);
      }
    };

    socket.on('slot_booked', onUp);
    socket.on('consultation_cancelled', onUp);
    socket.on('consultation_completed', onCompleted);
    socket.on('booking_confirmed', onUp);
    socket.on('booking_denied', onUp);
    socket.on('booking_rescheduled', onUp);
    socket.on('consultation_message_new', onMessageNew);
    return () => {
      socket.off('slot_booked', onUp);
      socket.off('consultation_cancelled', onUp);
      socket.off('consultation_completed', onCompleted);
      socket.off('booking_confirmed', onUp);
      socket.off('booking_denied', onUp);
      socket.off('booking_rescheduled', onUp);
      socket.off('consultation_message_new', onMessageNew);
    };
  }, [socket, load]);

  // Filtered and sorted data
  const filtered = useMemo(() => {
    let filteredData = bookings;
    
    // Apply search
    const q = search.trim().toLowerCase();
    if (q) {
      filteredData = filteredData.filter(
        (b) =>
          String(b.student_name || '').toLowerCase().includes(q) ||
          String(b.student_email || '').toLowerCase().includes(q)
      );
    }
    
    // Apply sorting
    filteredData = [...filteredData].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '');
          break;
        case 'student':
          comparison = (a.student_name || '').localeCompare(b.student_name || '');
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return filteredData;
  }, [bookings, search, sortBy, sortOrder]);

  // Pagination
  const pagination = usePagination(filtered, itemsPerPage);
  const { 
    paginatedItems, 
    currentPage, 
    totalPages, 
    startIndex, 
    endIndex, 
    totalItems,
    goToPage,
    nextPage,
    prevPage,
    firstPage,
    lastPage,
    hasNextPage,
    hasPrevPage
  } = pagination;

  // Action handlers - KEPT EXACTLY THE SAME
  const markComplete = async (bookingId: number) => {
    const r = await Swal.fire({
      title: 'Mark completed?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#22c55e',
      confirmButtonText: 'Yes'
    });
    if (!r.isConfirmed) return;
    try {
      const res = await apiService.markConsultationComplete(bookingId);
      if (res?.success) {
        showToast('Updated', 'success');
        load();
      } else showToast(res?.message || 'Failed', 'error');
    } catch {
      showToast('Failed', 'error');
    }
  };

  const cancelBooking = async (bookingId: number) => {
    const r = await Swal.fire({
      title: 'Cancel booking?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Cancel booking'
    });
    if (!r.isConfirmed) return;
    try {
      const res = await apiService.cancelConsultationBooking(bookingId);
      if (res?.success) {
        showToast('Cancelled', 'success');
        load();
      } else showToast(res?.message || 'Failed', 'error');
    } catch {
      showToast('Failed', 'error');
    }
  };

  const submitConfirm = async () => {
    if (!activeBooking) return;
    try {
      const res = await apiService.confirmConsultationBooking(activeBooking.id, {
        tutor_note: tutorNoteOpt.trim() || undefined
      });
      if (res?.success) {
        showToast('Booking confirmed', 'success');
        closeModal();
        load();
      } else showToast(res?.message || 'Failed', 'error');
    } catch {
      showToast('Failed', 'error');
    }
  };

  const submitDeny = async () => {
    if (!activeBooking || !denyReason.trim()) {
      showToast('Please provide a reason for denying', 'error');
      return;
    }
    try {
      const res = await apiService.denyConsultationBooking(activeBooking.id, { tutor_note: denyReason.trim() });
      if (res?.success) {
        showToast('Request denied', 'success');
        closeModal();
        load();
      } else showToast(res?.message || 'Failed', 'error');
    } catch {
      showToast('Failed', 'error');
    }
  };

  const submitReschedule = async () => {
    if (!activeBooking || !rsDate || !rsTime || !rsMsg.trim()) {
      showToast('Date, time and message are required', 'error');
      return;
    }
    try {
      const res = await apiService.rescheduleConsultationBooking(activeBooking.id, {
        reschedule_date: rsDate,
        reschedule_time: rsTime,
        tutor_note: rsMsg.trim()
      });
      if (res?.success) {
        showToast('Reschedule suggestion sent', 'success');
        closeModal();
        load();
      } else showToast(res?.message || 'Failed', 'error');
    } catch {
      showToast('Failed', 'error');
    }
  };

  const confirmRescheduleApply = async (bookingId: number) => {
    try {
      const res = await apiService.confirmConsultationReschedule(bookingId);
      if (res?.success) {
        showToast('Reschedule confirmed', 'success');
        load();
      } else showToast(res?.message || 'Failed', 'error');
    } catch {
      showToast('Failed', 'error');
    }
  };

  const handleAction = (type: string, booking: any) => {
    switch(type) {
      case 'confirm':
      case 'deny':
      case 'reschedule':
      case 'note':
      case 'messages':
        openModal(type, booking);
        break;
      case 'complete':
        markComplete(booking.id);
        break;
      case 'cancel':
        cancelBooking(booking.id);
        break;
      case 'confirmReschedule':
        confirmRescheduleApply(booking.id);
        break;
    }
  };

  const studentNotePreview = (b: any) => {
    const t = b.student_note || b.notes || '';
    if (!t) return <span className="text-gray-400">—</span>;
    const short = t.length > 50 ? `${t.slice(0, 50)}…` : t;
    return (
      <button
        type="button"
        className="text-left text-xs text-gray-700 hover:text-blue-600 underline decoration-dotted underline-offset-2 transition-colors"
        onClick={() => openModal('note', b)}
      >
        {short}
        {t.length > 50 && <span className="text-blue-600 ml-1 font-medium">View more</span>}
      </button>
    );
  };

  // Export function
  const exportData = () => {
    const csv = [
      ['Student', 'Email', 'Date', 'Time', 'Duration', 'Status', 'Workflow', 'Note'],
      ...filtered.map(b => [
        b.student_name,
        b.student_email,
        slotDate(b),
        `${formatTime(b.start_time)}-${formatTime(b.end_time)}`,
        `${b.duration_minutes || '—'} min`,
        b.status,
        workflowOf(b),
        (b.student_note || '').replace(/,/g, ';')
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bookings-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    showToast('Export started', 'success');
  };

  return (
    <div className="w-full max-w-full 2xl:max-w-[1800px] mx-auto space-y-6 px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
            Consultation Bookings
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage and track all consultation requests
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={exportData}
            className="px-4 py-2 bg-white border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all flex items-center gap-2 shadow-sm"
          >
            <FiDownload className="w-4 h-4" />
            Export
          </button>
          
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === 'table' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Table
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === 'cards' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Cards
            </button>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 min-w-0">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by student name or email..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>
          
          {/* Quick Filters */}
          <div className="flex flex-wrap gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="px-4 py-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            
            <select
              value={workflowFilter}
              onChange={(e) => setWorkflowFilter(e.target.value as typeof workflowFilter)}
              className="px-4 py-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
            >
              <option value="all">All Workflow</option>
              <option value="pending">Pending Confirm</option>
              <option value="confirmed">Confirmed</option>
              <option value="denied">Denied</option>
              <option value="rescheduled">Rescheduled</option>
            </select>
            
            <select
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value as typeof datePreset)}
              className="px-4 py-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
            
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all flex items-center gap-2"
            >
              <FiFilter className="w-4 h-4" />
              {showAdvancedFilters ? 'Hide' : 'More'} Filters
            </button>
          </div>
        </div>
        
        {/* Advanced Filters */}
        {showAdvancedFilters && (
          <div className="pt-4 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="date">Date</option>
                <option value="status">Status</option>
                <option value="student">Student Name</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Sort Order</label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="desc">Newest First</option>
                <option value="asc">Oldest First</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Items Per Page</label>
              <select
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value={10}>10 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
          <p className="text-xs text-blue-600 font-semibold mb-1">Total Bookings</p>
          <p className="text-2xl font-bold text-blue-900">{totalItems}</p>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-4 border border-amber-200">
          <p className="text-xs text-amber-600 font-semibold mb-1">Pending</p>
          <p className="text-2xl font-bold text-amber-900">
            {filtered.filter(b => workflowOf(b) === 'pending').length}
          </p>
        </div>
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-4 border border-emerald-200">
          <p className="text-xs text-emerald-600 font-semibold mb-1">Confirmed</p>
          <p className="text-2xl font-bold text-emerald-900">
            {filtered.filter(b => workflowOf(b) === 'confirmed').length}
          </p>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
          <p className="text-xs text-purple-600 font-semibold mb-1">Today's Bookings</p>
          <p className="text-2xl font-bold text-purple-900">
            {filtered.filter(b => {
              const today = new Date().toISOString().slice(0, 10);
              return slotDate(b) === today;
            }).length}
          </p>
        </div>
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
        {loading ? (
          <div className="p-12">
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="animate-pulse">
                  <div className="h-16 bg-gray-100 rounded-xl"></div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {viewMode === 'table' ? (
              <div className="overflow-x-auto">
                <table
                  className="w-full text-sm"
                  style={{ borderCollapse: 'separate', borderSpacing: 0 }}
                >
                  <thead>
                    <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                      <th
                        className="p-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider bg-gray-50"
                        style={{
                          position: 'sticky',
                          left: 0,
                          zIndex: 10,
                          boxShadow: '2px 0 4px rgba(0,0,0,0.08)',
                        }}
                      >
                        <div className="flex items-center gap-1">
                          <FiUser className="w-3 h-3" />
                          Student
                        </div>
                      </th>
                      <th className="p-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Email</th>
                      <th className="p-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Date</th>
                      <th className="p-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Time</th>
                      <th className="p-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Duration</th>
                      <th className="p-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Note</th>
                      <th className="p-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Status</th>
                      <th className="p-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Workflow</th>
                      <th className="p-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Booked</th>
                      <th className="p-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map((b, index) => {
                      const wf = workflowOf(b);
                      return (
                        <tr 
                          key={b.id} 
                          className={`border-b border-gray-100 hover:bg-gray-50/80 transition-colors ${
                            index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                          }`}
                        >
                          <td
                            className={`p-4 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}
                            style={{
                              position: 'sticky',
                              left: 0,
                              zIndex: 9,
                              boxShadow: '2px 0 4px rgba(0,0,0,0.06)',
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">
                                {b.student_name?.charAt(0) || '?'}
                              </div>
                              <span className="font-semibold text-gray-900">{b.student_name}</span>
                            </div>
                          </td>
                          <td className="p-4 text-gray-600 max-w-[200px] truncate" title={b.student_email}>
                            {b.student_email}
                          </td>
                          <td className="p-4 whitespace-nowrap font-medium">{slotDate(b)}</td>
                          <td className="p-4 whitespace-nowrap">
                            <span className="bg-gray-100 px-2 py-1 rounded-lg text-xs font-mono">
                              {formatTime(b.start_time)} – {formatTime(b.end_time)}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-lg text-xs font-medium">
                              {b.duration_minutes ?? '—'} min
                            </span>
                          </td>
                          <td className="p-4 max-w-[150px]">{studentNotePreview(b)}</td>
                          <td className="p-4"><StatusBadge status={b.status} /></td>
                          <td className="p-4"><WorkflowBadge workflow={wf} /></td>
                          <td className="p-4 text-xs text-gray-500 whitespace-nowrap">
                            {b.created_at ? new Date(b.created_at).toLocaleString('en-GB') : '—'}
                          </td>
                          <td className="p-4">
                            <div className="flex flex-wrap items-center gap-1">
                              {wf === 'pending' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openModal('confirm', b)}
                                    className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 px-2 py-1 text-white shadow-md transition-all hover:shadow-lg"
                                    title="Confirm booking"
                                  >
                                    <FiCheck className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openModal('deny', b)}
                                    className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-red-500 to-rose-600 px-2 py-1 text-white shadow-md transition-all hover:shadow-lg"
                                    title="Deny booking"
                                  >
                                    <FiX className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openModal('reschedule', b)}
                                    className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-blue-500 to-cyan-600 px-2 py-1 text-white shadow-md transition-all hover:shadow-lg"
                                    title="Suggest new time"
                                  >
                                    <FiRefreshCw className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                              
                              {wf === 'rescheduled' && (
                                <div className="space-y-1.5">
                                  <p className="text-xs text-gray-600 bg-yellow-50 px-2 py-1 rounded">
                                    New: {String(b.reschedule_date || '').slice(0, 10)} {formatTime(String(b.reschedule_time || ''))}
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => confirmRescheduleApply(b.id)}
                                    className="inline-flex w-full items-center justify-center rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 px-2 py-1 text-white shadow-md transition-all hover:shadow-lg"
                                    title="Confirm reschedule"
                                  >
                                    <FiCheck className="h-4 w-4" />
                                  </button>
                                </div>
                              )}
                              
                              {wf === 'denied' && (
                                <div className="text-xs text-gray-500 bg-red-50 px-2 py-1.5 rounded-lg border border-red-100">
                                  <p className="font-medium text-red-700">Denied</p>
                                  {b.responded_by_name && <p>by {b.responded_by_name}</p>}
                                  {b.denied_at && <p className="text-[10px] mt-1">{new Date(b.denied_at).toLocaleString('en-GB')}</p>}
                                </div>
                              )}
                              
                              {b.status === 'confirmed' && wf === 'confirmed' && (
                                <>
                                  {b.zoom_start_url && (
                                    <a
                                      href={b.zoom_start_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-2 py-1 text-white shadow-md transition-all hover:shadow-lg"
                                      title="Start session"
                                    >
                                      <FiVideo className="h-4 w-4" />
                                    </a>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => markComplete(b.id)}
                                    className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-emerald-500 to-green-600 px-2 py-1 text-white shadow-md transition-all hover:shadow-lg"
                                    title="Complete"
                                  >
                                    <FiCheck className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => cancelBooking(b.id)}
                                    className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-red-700 transition-all hover:bg-red-100"
                                    title="Cancel"
                                  >
                                    <FiTrash2 className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                              
                              {(wf === 'pending' || wf === 'confirmed' || wf === 'rescheduled') && (
                                <button
                                  type="button"
                                  onClick={() => openModal('messages', b)}
                                  className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-teal-500 to-cyan-600 px-2 py-1 text-white shadow-md transition-all hover:shadow-lg"
                                  title="Messages"
                                >
                                  <FiMessageSquare className="h-4 w-4" />
                                </button>
                              )}
                              <Link
                                href={`/dashboard/consultation-manager/students/${b.student_id}`}
                                className="inline-flex items-center justify-center rounded-lg bg-gray-100 px-2 py-1 text-gray-700 transition-all hover:bg-gray-200"
                                title="View student"
                              >
                                <FiUser className="h-4 w-4" />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 sm:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {paginatedItems.map((b) => (
                    <BookingCard key={b.id} booking={b} onAction={handleAction} />
                  ))}
                </div>
              </div>
            )}
            
            {!loading && filtered.length === 0 && (
              <div className="p-12 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                  <FiCalendar className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">No bookings found</h3>
                <p className="text-sm text-gray-500">Try adjusting your filters or search criteria</p>
              </div>
            )}
            
            {/* Pagination */}
            {filtered.length > 0 && (
              <div className="border-t border-gray-200 bg-gray-50/50 px-4 py-3 sm:px-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-sm text-gray-700">
                    Showing <span className="font-semibold">{startIndex + 1}</span> to{' '}
                    <span className="font-semibold">{Math.min(endIndex, totalItems)}</span> of{' '}
                    <span className="font-semibold">{totalItems}</span> results
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <button
                      onClick={firstPage}
                      disabled={!hasPrevPage}
                      className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      title="First page"
                    >
                      <FiChevronsLeft className="w-4 h-4" />
                    </button>
                    
                    <button
                      onClick={prevPage}
                      disabled={!hasPrevPage}
                      className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      title="Previous page"
                    >
                      <FiChevronLeft className="w-4 h-4" />
                    </button>
                    
                    <div className="flex items-center gap-1 mx-2">
                      <input
                        type="number"
                        min={1}
                        max={totalPages}
                        value={currentPage}
                        onChange={(e) => {
                          const page = parseInt(e.target.value);
                          if (!isNaN(page)) goToPage(page);
                        }}
                        className="w-16 px-2 py-1.5 text-center border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-600">/ {totalPages}</span>
                    </div>
                    
                    <button
                      onClick={nextPage}
                      disabled={!hasNextPage}
                      className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      title="Next page"
                    >
                      <FiChevronRight className="w-4 h-4" />
                    </button>
                    
                    <button
                      onClick={lastPage}
                      disabled={!hasNextPage}
                      className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      title="Last page"
                    >
                      <FiChevronsRight className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">Per page:</label>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => setItemsPerPage(Number(e.target.value))}
                      className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals - KEPT EXACTLY THE SAME but with enhanced styling */}
      {modal && activeBooking && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={closeModal}
        >
          <div
            className={`bg-white rounded-2xl shadow-2xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 ${
              modal === 'messages' ? 'max-w-2xl' : 'max-w-lg'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              {modal === 'note' && (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <FiMessageSquare className="w-5 h-5 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Student Note</h3>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 mb-4">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {activeBooking.student_note || activeBooking.notes || 'No note provided'}
                    </p>
                  </div>
                  <button 
                    type="button" 
                    className="w-full px-4 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 font-semibold text-gray-700 transition-all"
                    onClick={closeModal}
                  >
                    Close
                  </button>
                </>
              )}
              
              {modal === 'confirm' && (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                      <FiCheck className="w-5 h-5 text-green-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Confirm Consultation</h3>
                  </div>
                  
                  <div className="space-y-3 mb-4">
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-sm text-gray-600 mb-1">
                        <span className="font-semibold text-gray-900">{activeBooking.student_name}</span>
                      </p>
                      <p className="text-sm text-gray-600">
                        <FiCalendar className="inline mr-1 w-4 h-4" />
                        {slotDate(activeBooking)} at {formatTime(activeBooking.start_time)}
                      </p>
                    </div>
                    
                    {activeBooking.student_note && (
                      <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                        <p className="text-xs font-semibold text-blue-700 mb-1">Student Note:</p>
                        <p className="text-sm text-gray-700">{activeBooking.student_note}</p>
                      </div>
                    )}
                  </div>
                  
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Message to student (optional)
                  </label>
                  <textarea
                    className="w-full border border-gray-300 rounded-xl p-3 text-sm mb-4 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    rows={3}
                    placeholder="Add an optional message..."
                    value={tutorNoteOpt}
                    onChange={(e) => setTutorNoteOpt(e.target.value)}
                  />
                  
                  <div className="flex gap-3">
                    <button 
                      type="button" 
                      className="flex-1 px-4 py-3 rounded-xl border border-gray-300 hover:bg-gray-50 font-semibold text-gray-700 transition-all"
                      onClick={closeModal}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold hover:shadow-lg transition-all"
                      onClick={submitConfirm}
                    >
                      <FiCheck className="inline mr-1" /> Confirm Booking
                    </button>
                  </div>
                </>
              )}
              
              {modal === 'deny' && (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                      <FiX className="w-5 h-5 text-red-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Deny Consultation Request</h3>
                  </div>
                  
                  <div className="space-y-3 mb-4">
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-sm text-gray-600 mb-1">
                        <span className="font-semibold text-gray-900">{activeBooking.student_name}</span>
                      </p>
                      <p className="text-sm text-gray-600">
                        <FiCalendar className="inline mr-1 w-4 h-4" />
                        {slotDate(activeBooking)} at {formatTime(activeBooking.start_time)}
                      </p>
                    </div>
                    
                    {activeBooking.student_note && (
                      <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                        <p className="text-xs font-semibold text-blue-700 mb-1">Student Note:</p>
                        <p className="text-sm text-gray-700">{activeBooking.student_note}</p>
                      </div>
                    )}
                  </div>
                  
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Reason for denial <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    className="w-full border border-gray-300 rounded-xl p-3 text-sm mb-4 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                    rows={3}
                    placeholder="Please provide a reason for denying this request..."
                    value={denyReason}
                    onChange={(e) => setDenyReason(e.target.value)}
                    required
                  />
                  
                  <div className="flex gap-3">
                    <button 
                      type="button" 
                      className="flex-1 px-4 py-3 rounded-xl border border-gray-300 hover:bg-gray-50 font-semibold text-gray-700 transition-all"
                      onClick={closeModal}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 text-white font-semibold hover:shadow-lg transition-all"
                      onClick={submitDeny}
                    >
                      <FiX className="inline mr-1" /> Deny Booking
                    </button>
                  </div>
                </>
              )}
              
              {modal === 'messages' && (
                <>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white">
                      <FiMessageSquare className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-bold text-gray-900">
                        Messages with {activeBooking.student_name}
                      </h3>
                      <p className="text-xs text-gray-500 truncate">
                        {slotDate(activeBooking)} at {formatTime(activeBooking.start_time)} • Private to this consultation
                      </p>
                    </div>
                  </div>

                  {/* Thread */}
                  <div className="border border-gray-200 rounded-2xl bg-gray-50/40 h-80 overflow-y-auto px-4 py-3 space-y-3 mb-3">
                    {loadingMessages && (messages[activeBooking.id]?.length ?? 0) === 0 ? (
                      <p className="text-center text-sm text-gray-400 py-12">Loading messages…</p>
                    ) : (messages[activeBooking.id]?.length ?? 0) === 0 ? (
                      <p className="text-center text-sm text-gray-400 py-12">
                        No messages yet. Start the conversation with {activeBooking.student_name}.
                      </p>
                    ) : (
                      (messages[activeBooking.id] || []).map((m) => {
                        const isStaff = m.sender_role === 'staff';
                        return (
                          <div key={m.id} className={`flex ${isStaff ? 'justify-end' : 'justify-start'} gap-2 items-end`}>
                            {!isStaff && (
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                                {(m.sender_name || activeBooking.student_name || '?').charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="max-w-[75%]">
                              {m.body && (
                                <div className={`px-3 py-2 text-[13px] leading-snug whitespace-pre-wrap break-words ${
                                  isStaff
                                    ? 'bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-2xl rounded-br-sm'
                                    : 'bg-white border border-gray-200 text-gray-800 rounded-2xl rounded-bl-sm'
                                }`}>
                                  {m.body}
                                </div>
                              )}
                              {m.files && m.files.length > 0 && (
                                <div className={`mt-1 space-y-1 ${m.body ? '' : ''}`}>
                                  {m.files.map((f) => (
                                    <a
                                      key={f.id || f.file_path}
                                      href={f.file_path}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold underline-offset-2 hover:underline ${
                                        isStaff
                                          ? 'bg-teal-50 text-teal-700 border border-teal-200'
                                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                                      }`}
                                    >
                                      <FiPaperclip className="w-3 h-3" />
                                      {f.file_name}
                                      {f.file_size != null && (
                                        <span className="text-gray-400">({Math.round((f.file_size || 0) / 1024)}KB)</span>
                                      )}
                                    </a>
                                  ))}
                                </div>
                              )}
                              <p className={`mt-0.5 text-[10px] text-gray-400 ${isStaff ? 'text-right' : ''}`}>
                                {!isStaff && m.sender_name ? `${m.sender_name} • ` : ''}
                                {isStaff && m.sender_name ? `${m.sender_name} • ` : ''}
                                {new Date(m.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Selected files preview */}
                  {selectedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2 px-1">
                      {selectedFiles.map((f, i) => (
                        <span
                          key={`${f.name}-${i}`}
                          className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[12px] font-medium text-blue-800"
                        >
                          <FiPaperclip className="w-3 h-3" />
                          {f.name}
                          <span className="text-gray-400 text-[10px]">
                            ({Math.round(f.size / 1024)}KB)
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedFiles((prev) => prev.filter((_, idx) => idx !== i))
                            }
                            className="ml-1 text-gray-400 hover:text-red-600 leading-none"
                            aria-label="Remove file"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Composer */}
                  <div className="flex items-end gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      title="Attach files (PDF, Word, Excel, images, txt — max 20MB each)"
                      className="w-10 h-10 rounded-xl border border-gray-300 bg-gray-50 hover:border-teal-500 hover:text-teal-600 text-gray-500 flex items-center justify-center flex-shrink-0"
                    >
                      <FiPaperclip className="w-4 h-4" />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept={MESSAGE_ALLOWED_ACCEPT}
                      className="hidden"
                      onChange={(e) => {
                        const list = Array.from(e.target.files || []);
                        setSelectedFiles((prev) => [...prev, ...list].slice(0, 10));
                        e.target.value = '';
                      }}
                    />
                    <textarea
                      rows={2}
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage(activeBooking.id);
                        }
                      }}
                      placeholder="Type a message to the student… (Enter to send, Shift+Enter for newline)"
                      className="flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm leading-snug outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => sendMessage(activeBooking.id)}
                      disabled={
                        sendingMessage ||
                        (!messageInput.trim() && selectedFiles.length === 0)
                      }
                      className="h-10 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 text-white text-sm font-bold flex items-center gap-1 shadow-md disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {sendingMessage ? '⏳' : <><FiSend className="w-4 h-4" /> Send</>}
                    </button>
                  </div>

                  <button
                    type="button"
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 font-semibold text-gray-700 transition-all text-sm"
                    onClick={closeModal}
                  >
                    Close
                  </button>
                </>
              )}

              {modal === 'reschedule' && (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <FiRefreshCw className="w-5 h-5 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Suggest New Time</h3>
                  </div>
                  
                  <div className="space-y-3 mb-4">
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-sm text-gray-600 mb-1">
                        <span className="font-semibold text-gray-900">{activeBooking.student_name}</span>
                      </p>
                      <p className="text-sm text-gray-600">
                        <span className="font-semibold">Original:</span> {slotDate(activeBooking)} at {formatTime(activeBooking.start_time)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-3 mb-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        New Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        value={rsDate}
                        onChange={(e) => setRsDate(e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        New Time <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="time"
                        className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        value={rsTime}
                        onChange={(e) => setRsTime(e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Message to Student <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        rows={3}
                        placeholder="Explain why you're suggesting a new time..."
                        value={rsMsg}
                        onChange={(e) => setRsMsg(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <button 
                      type="button" 
                      className="flex-1 px-4 py-3 rounded-xl border border-gray-300 hover:bg-gray-50 font-semibold text-gray-700 transition-all"
                      onClick={closeModal}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 text-white font-semibold hover:shadow-lg transition-all"
                      onClick={submitReschedule}
                    >
                      <FiRefreshCw className="inline mr-1" /> Send Suggestion
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}