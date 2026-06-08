'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getApiUrl } from '@/app/utils/apiUrl';
import { User } from '@/app/components/types';
import { openFloatingChat } from '@/app/components/FloatingChatProvider';
import { showSweetAlert } from '@/app/components/SweetAlert';
import { LinkifiedText } from '@/app/utils/linkify';
import MessageFileAttachment from '@/app/components/MessageFileAttachment';

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  transferred: 'bg-indigo-100 text-indigo-800',
  escalated: 'bg-red-100 text-red-800',
  resolved: 'bg-green-100 text-green-800'
};

function TicketDetailContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id as string;
  const [user, setUser] = useState<User | null>(null);
  const [ticket, setTicket] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [internalNotes, setInternalNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [newNote, setNewNote] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [sendingNote, setSendingNote] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [agents, setAgents] = useState<{ id: number; name: string; email: string }[]>([]);
  const [reassignTo, setReassignTo] = useState<number | ''>('');
  const [reassigning, setReassigning] = useState(false);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [studentTutor, setStudentTutor] = useState<{ id: number; name: string; email: string } | null>(null);
  const [forwardingToTutor, setForwardingToTutor] = useState(false);
  const [departments, setDepartments] = useState<{ id: number; name: string; color: string }[]>([]);
  const [transferDeptId, setTransferDeptId] = useState<number | ''>('');
  const [transferAgents, setTransferAgents] = useState<{ id: number; name: string; email: string }[]>([]);
  const [transferAssignedTo, setTransferAssignedTo] = useState<number | ''>('');
  const [transferring, setTransferring] = useState(false);
  const [fileAttachment, setFileAttachment] = useState<{ url: string; name: string; type: string } | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const openInChat = async () => {
    if (!ticket?.conversation_id || !user?.id) return;
    try {
      const res = await fetch(
        `${getApiUrl()}/api/chat/conversation/${ticket.conversation_id}?userId=${user.id}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('lms-token')}` } }
      );
      const data = await res.json();
      if (data.success && data.conversation) {
        const c = data.conversation;
        openFloatingChat({
          id: c.id,
          student_id: c.student_id,
          tutor_id: c.tutor_id,
          admin_id: c.admin_id,
          conversation_type: (c.conversation_type || 'ticket') as 'direct' | 'group' | 'course' | 'ticket',
          title: c.title,
          student_name: c.student_name || 'Student',
          tutor_name: c.tutor_name || 'Staff',
          admin_name: c.admin_name || 'Support',
          course_title: c.course_title || ''
        });
      }
    } catch (_) {}
  };

  useEffect(() => {
    const u: User | null = JSON.parse(localStorage.getItem('lms-user') || 'null');
    setUser(u);
    if (!u) router.push('/login');
  }, [router]);

  useEffect(() => {
    if (user && id) fetchTicket();
  }, [user, id]);

  // Open transfer modal when arriving with ?transfer=1 (from tickets list Transfer button)
  useEffect(() => {
    if (searchParams.get('transfer') === '1' && ticket) {
      openForwardModal();
      router.replace(`/dashboard/tickets/${id}`, { scroll: false });
    }
  }, [searchParams.get('transfer'), ticket?.id]);

  useEffect(() => {
    const handler = (e: Event) => {
      const { ticketId: evTicketId, assigned_to_name } = (e as CustomEvent<{ ticketId: number; assigned_to_name?: string }>).detail;
      if (evTicketId !== Number(id)) return;
      fetchTicket();
      if (assigned_to_name && ticket && !ticket.assigned_to) {
        showSweetAlert({
          title: 'Ticket claimed',
          text: `This ticket was just claimed by ${assigned_to_name}.`,
          icon: 'info'
        });
      }
    };
    window.addEventListener('ticket_updated', handler);
    return () => window.removeEventListener('ticket_updated', handler);
  }, [id, ticket?.assigned_to]);

  // Instant message: append when the other party sends (no refresh)
  useEffect(() => {
    const handler = (e: Event) => {
      const { ticketId: msgTicketId, message: newMsg } = (e as CustomEvent<{ ticketId: number; message: any }>).detail;
      if (msgTicketId !== Number(id)) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
    };
    window.addEventListener('ticket_message', handler);
    return () => window.removeEventListener('ticket_message', handler);
  }, [id]);

  // Mark messages as read when viewing (for double-tick "seen")
  useEffect(() => {
    if (!id || !user?.id || !ticket) return;
    const markRead = async () => {
      try {
        await fetch(`${getApiUrl()}/api/tickets/${id}/mark-read`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('lms-token')}` }
        });
      } catch (_) {}
    };
    markRead();
  }, [id, user?.id, ticket?.id]);

  // When the other party has read our messages, show double tick
  useEffect(() => {
    const handler = (e: Event) => {
      const { ticketId: msgTicketId, messageIds } = (e as CustomEvent<{ ticketId: number; messageIds: number[] }>).detail;
      if (msgTicketId !== Number(id)) return;
      const now = new Date().toISOString();
      setMessages((prev) =>
        prev.map((m) => (messageIds.includes(m.id) ? { ...m, read_at: m.read_at || now } : m))
      );
    };
    window.addEventListener('ticket_messages_read', handler);
    return () => window.removeEventListener('ticket_messages_read', handler);
  }, [id]);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchTicket = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${getApiUrl()}/api/tickets/${id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('lms-token')}` }
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.message || 'Failed to load ticket');
        setTicket(null);
        setMessages([]);
        setInternalNotes([]);
      } else {
        setTicket(data.ticket);
        setMessages(data.messages || []);
        setInternalNotes(data.internalNotes || []);
      }
    } catch (e) {
      setError('Failed to load ticket');
      setTicket(null);
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async () => {
    try {
      const res = await fetch(`${getApiUrl()}/api/tickets/${id}/claim`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('lms-token')}`, 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success) fetchTicket();
      else {
        showSweetAlert({
          title: 'Already claimed',
          text: data.message || 'This ticket was just claimed by another team member.',
          icon: 'warning'
        });
      }
    } catch (e) {
      alert('Failed to claim ticket');
    }
  };

  const handleStatus = async (status: string) => {
    try {
      const res = await fetch(`${getApiUrl()}/api/tickets/${id}/status`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('lms-token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (data.success) fetchTicket();
      else alert(data.message || 'Failed to update status');
    } catch (e) {
      alert('Failed to update status');
    }
  };

  const handleEscalate = async () => {
    if (!reassignTo) return;
    try {
      const res = await fetch(`${getApiUrl()}/api/tickets/${id}/escalate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('lms-token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ escalate_to: reassignTo })
      });
      const data = await res.json();
      if (data.success) {
        fetchTicket();
        setShowEscalateModal(false);
        setReassignTo('');
      } else alert(data.message || 'Failed to escalate');
    } catch (e) {
      alert('Failed to escalate ticket');
    }
  };

  const openEscalateModal = async () => {
    setShowEscalateModal(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/tickets/${id}/escalate-agents`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('lms-token')}` }
      });
      const data = await res.json();
      if (data.success) setAgents(data.agents || []);
      else setAgents([]);
    } catch (e) {
      setAgents([]);
    }
    setReassignTo('');
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() && !fileAttachment) return;
    setSendingMessage(true);
    try {
      const payload: { message: string; is_internal: boolean; file_url?: string; file_name?: string; file_type?: string } = {
        message: newMessage.trim() || '[Attachment]',
        is_internal: false
      };
      if (fileAttachment) {
        payload.file_url = fileAttachment.url;
        payload.file_name = fileAttachment.name;
        payload.file_type = fileAttachment.type;
      }
      const res = await fetch(`${getApiUrl()}/api/tickets/${id}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('lms-token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setMessages((m) => [...m, data.message]);
        setNewMessage('');
        setFileAttachment(null);
        if (textareaRef.current) {
          textareaRef.current.style.height = '40px';
        }
      } else alert(data.message || 'Failed to send');
    } catch (e) {
      alert('Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleReassign = async () => {
    if (!reassignTo) return;
    setReassigning(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/tickets/${id}/reassign`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('lms-token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigned_to: reassignTo })
      });
      const data = await res.json();
      if (data.success) {
        fetchTicket();
        setShowReassignModal(false);
        setReassignTo('');
      } else alert(data.message || 'Failed to reassign');
    } catch (e) {
      alert('Failed to reassign');
    } finally {
      setReassigning(false);
    }
  };

  const openReassignModal = async () => {
    setShowReassignModal(true);
    try {
      const q = ticket?.department_id ? `?department=${ticket.department_id}` : '';
      const res = await fetch(`${getApiUrl()}/api/tickets/agents${q}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('lms-token')}` }
      });
      const data = await res.json();
      if (data.success) setAgents(data.agents || []);
      else setAgents([]);
    } catch (e) {
      setAgents([]);
    }
    setReassignTo('');
  };

  const openForwardModal = async () => {
    setShowForwardModal(true);
    setStudentTutor(null);
    setTransferDeptId('');
    setTransferAgents([]);
    setTransferAssignedTo('');
    try {
      const [escRes, deptRes] = await Promise.all([
        fetch(`${getApiUrl()}/api/tickets/${id}/escalate-agents`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('lms-token')}` } }),
        fetch(`${getApiUrl()}/api/tickets/departments`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('lms-token')}` } })
      ]);
      const escData = await escRes.json();
      const deptData = await deptRes.json();
      if (escData.success && escData.agents?.length > 0) setStudentTutor(escData.agents[0]);
      if (deptData.success) setDepartments(deptData.departments || []);
    } catch (e) {
      setDepartments([]);
    }
  };

  const handleForwardToTutor = async () => {
    if (!studentTutor) return;
    setForwardingToTutor(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/tickets/${id}/escalate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('lms-token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ escalate_to: studentTutor.id })
      });
      const data = await res.json();
      if (data.success) {
        fetchTicket();
        setShowForwardModal(false);
      } else alert(data.message || 'Forward failed');
    } catch (e) {
      alert('Forward failed');
    } finally {
      setForwardingToTutor(false);
    }
  };

  const onTransferDeptChange = async (deptId: number | '') => {
    setTransferDeptId(deptId);
    setTransferAssignedTo('');
    if (!deptId) {
      setTransferAgents([]);
      return;
    }
    try {
      const res = await fetch(`${getApiUrl()}/api/tickets/agents?department=${deptId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('lms-token')}` }
      });
      const data = await res.json();
      if (data.success) setTransferAgents(data.agents || []);
      else setTransferAgents([]);
    } catch (e) {
      setTransferAgents([]);
    }
  };

  const handleTransfer = async () => {
    if (!transferDeptId) return;
    setTransferring(true);
    try {
      const body: { department_id: number; assigned_to?: number } = { department_id: Number(transferDeptId) };
      if (transferAssignedTo) body.assigned_to = Number(transferAssignedTo);
      const res = await fetch(`${getApiUrl()}/api/tickets/${id}/transfer`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('lms-token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.success) {
        fetchTicket();
        setShowForwardModal(false);
        setTransferDeptId('');
        setTransferAssignedTo('');
      } else {
        alert(data.message || 'Transfer failed');
      }
    } catch (e) {
      alert('Transfer failed');
    } finally {
      setTransferring(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('File too large. Max 10MB.');
      return;
    }
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${getApiUrl()}/api/tickets/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('lms-token')}` },
        body: formData
      });
      const data = await res.json();
      if (data.success && data.file) {
        setFileAttachment({ url: data.file.url, name: data.file.name, type: data.file.type });
      } else alert(data.message || 'Upload failed');
    } catch (e) {
      alert('Upload failed');
    } finally {
      setUploadingFile(false);
      e.target.value = '';
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setSendingNote(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/tickets/${id}/notes`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('lms-token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: newNote.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setInternalNotes((n) => [...n, data.note]);
        setNewNote('');
        setShowNoteInput(false);
      } else alert(data.message || 'Failed to add note');
    } catch (e) {
      alert('Failed to add note');
    } finally {
      setSendingNote(false);
    }
  };

  if (!user) return null;

  const isStudent = ['Student', 'ManagerStudent', 'InstituteStudent'].includes(user.role || '');
  const fromCertManager = searchParams.get('from') === 'certificate-manager' && user.role === 'Certificate Manager';

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[300px]">
        <p className="text-gray-500">Loading ticket...</p>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="p-6">
        <p className="text-red-600 mb-4">{error || 'Ticket not found'}</p>
        <Link href={fromCertManager ? '/dashboard/certificate-manager' : '/dashboard/tickets'} className="text-[#11CCEF] hover:underline">
          ← Back to {fromCertManager ? 'Certificate Manager' : 'Tickets'}
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href={fromCertManager ? '/dashboard/certificate-manager' : '/dashboard/tickets'} className="text-[#11CCEF] hover:underline font-medium">
          ← Back to {fromCertManager ? 'Certificate Manager' : 'Tickets'}
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Ticket #{ticket.id}</h3>
            <p className="text-sm text-gray-600 mb-2">{ticket.subject}</p>
            <div className="flex flex-wrap gap-2 mb-2">
              <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[ticket.status] || 'bg-gray-100'}`}>
                {ticket.status.replace('_', ' ')}
              </span>
              <span className="px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: `${ticket.department_color}20`, color: ticket.department_color }}>
                {ticket.department_name}
              </span>
            </div>
            <p className="text-xs text-gray-500">Category: {ticket.category}</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Student</h3>
            <p className="text-sm font-medium text-gray-800">{ticket.student_name}</p>
            <p className="text-xs text-gray-500">{ticket.student_email}</p>
            {!isStudent && ticket.student_id && (
              <Link
                href={
                  user?.role === 'Assessor'
                    ? `/dashboard/tutor/students/${ticket.student_id}`
                    : user?.role === 'Admin'
                    ? `/dashboard/admin/students/${ticket.student_id}`
                    : fromCertManager
                    ? `/dashboard/certificate-manager/students/${ticket.student_id}`
                    : `/dashboard/tickets/student/${ticket.student_id}`
                }
                className="inline-block mt-2 text-sm text-[#11CCEF] hover:underline font-medium"
              >
                View student profile →
              </Link>
            )}
          </div>

          {!isStudent && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-2">Assigned To</h3>
              <p className="text-sm text-gray-600">{ticket.assigned_to_name || 'Unassigned'}</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Conversation</h3>
              {ticket.conversation_id && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={openInChat}
                    className="text-sm text-[#11CCEF] hover:underline font-medium"
                  >
                    Open in Chat window
                  </button>
                  <Link
                    href="/chat"
                    className="text-sm text-gray-600 hover:text-[#11CCEF] font-medium"
                  >
                    Full chat page →
                  </Link>
                </div>
              )}
            </div>
            <div className="p-4 max-h-[400px] overflow-y-auto space-y-3">
              {messages.length === 0 ? (
                <p className="text-sm text-gray-500">No messages yet.</p>
              ) : (
                <>
                {messages.map((m: any) => {
                  const isSent = m.sender_id === user?.id;
                  return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isSent ? 'items-end ml-8' : 'items-start mr-8'}`}
                  >
                    <p
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#64748b',
                        margin: '0 0 2px',
                        textAlign: isSent ? 'right' : 'left',
                      }}
                    >
                      {isSent ? 'You' : m.sender_name}
                    </p>
                    <div
                      className="max-w-[85%] rounded-2xl px-3 py-2 shadow-sm"
                      style={
                        isSent
                          ? { background: 'linear-gradient(135deg, #e51791, #c1147a)', color: '#ffffff' }
                          : { background: '#f1f5f9', color: '#1a1a1a' }
                      }
                    >
                    {m.message !== '[Attachment]' && m.message ? (
                      <span className="text-sm" style={{ lineHeight: 1.6 }}>
                        <LinkifiedText text={m.message} linkColor={isSent ? '#ffffff' : '#11CCEF'} />
                      </span>
                    ) : null}
                    {m.file_url && (
                      <MessageFileAttachment
                        fileUrl={m.file_url}
                        fileName={m.file_name}
                        fileType={m.file_type}
                        isOwn={isSent}
                      />
                    )}
                  </div>
                  <div
                    className="flex items-center gap-1.5 mt-0.5"
                    style={{ justifyContent: isSent ? 'flex-end' : 'flex-start' }}
                  >
                    <p
                      style={{
                        fontSize: '10px',
                        color: '#94a3b8',
                        margin: 0,
                        textAlign: isSent ? 'right' : 'left',
                      }}
                    >
                      {new Date(m.created_at).toLocaleTimeString('en-GB', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    {isSent && (
                      <span className="inline-flex" title={m.read_at ? 'Seen' : 'Sent'}>
                        {m.read_at ? (
                          <span className="text-[#11CCEF] flex -space-x-1" title="Seen">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 7l4 4 10-10"/></svg>
                            <svg className="w-3.5 h-3.5" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 7l4 4 10-10"/></svg>
                          </span>
                        ) : (
                          <span className="text-gray-500 flex" title="Sent">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 7l4 4 10-10"/></svg>
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
                  );
                })}
                <div ref={conversationEndRef} />
                </>
              )}
            </div>
            {isStudent && (() => {
              const awaitingPersonId = ticket.status === 'escalated' ? ticket.escalated_to : ticket.status === 'in_progress' ? ticket.assigned_to : null;
              const personHasJoined = awaitingPersonId != null && messages.some((m: { sender_id: number }) => m.sender_id === awaitingPersonId);
              const showJoiningSoon = (ticket.status === 'escalated' && ticket.escalated_to) || (ticket.status === 'in_progress' && ticket.assigned_to);
              return showJoiningSoon && !personHasJoined ? (
                <div className="p-4 border-t border-gray-200 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800 font-medium">{ticket.status === 'escalated' ? 'Your assessor will join soon.' : 'A team member will join soon.'}</p>
                </div>
              ) : null;
            })()}
            {ticket.status === 'resolved' && isStudent && (
              <div className="p-4 border-t border-gray-200 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800 font-medium">This ticket has been resolved.</p>
                <p className="text-sm text-green-700 mt-1">If you have another query, please <Link href="/dashboard/tickets/new" className="text-[#11CCEF] hover:underline font-medium">create a new ticket</Link>.</p>
              </div>
            )}
            {ticket.status !== 'resolved' && (
              <div className="p-4 border-t border-gray-200 space-y-2">
                {fileAttachment && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    📎 {fileAttachment.name}
                    <button type="button" onClick={() => setFileAttachment(null)} className="text-red-500 hover:underline">Remove</button>
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="file"
                    id="ticket-file"
                    className="hidden"
                    onChange={handleFileSelect}
                    disabled={uploadingFile}
                  />
                  <label htmlFor="ticket-file" className="px-3 py-2 border border-gray-300 rounded-lg text-sm cursor-pointer hover:bg-gray-50">
                    {uploadingFile ? 'Uploading...' : '📎 Attach'}
                  </label>
                  <div className="flex-1 flex flex-col min-w-0">
                    <textarea
                      ref={textareaRef}
                      value={newMessage}
                      onChange={(e) => {
                        setNewMessage(e.target.value);
                        autoResize(e.target);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder="Type your message... (Shift+Enter for new line)"
                      rows={1}
                      style={{
                        resize: 'none',
                        overflow: 'hidden',
                        minHeight: '40px',
                        maxHeight: '160px',
                        lineHeight: '1.5',
                        transition: 'height 0.1s ease',
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#11CCEF]"
                    />
                    <p style={{ fontSize: '10px', color: '#94a3b8', margin: '2px 0 0 4px' }}>
                      Enter to send • Shift+Enter for new line
                    </p>
                  </div>
                  <button
                    onClick={handleSendMessage}
                    disabled={sendingMessage || (!newMessage.trim() && !fileAttachment)}
                    className="px-4 py-2 bg-[#11CCEF] text-white rounded-lg text-sm font-medium disabled:opacity-50 self-end"
                  >
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>

          {!isStudent && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="font-semibold text-gray-900">Internal Notes</h3>
                {!showNoteInput && (
                  <button
                    onClick={() => setShowNoteInput(true)}
                    className="text-sm text-[#11CCEF] hover:underline"
                  >
                    + Add Note
                  </button>
                )}
              </div>
              {showNoteInput && (
                <div className="p-4 border-b border-gray-200">
                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add internal note..."
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={handleAddNote}
                      disabled={sendingNote || !newNote.trim()}
                      className="px-3 py-1.5 bg-gray-800 text-white rounded-lg text-sm disabled:opacity-50"
                    >
                      Save Note
                    </button>
                    <button
                      onClick={() => { setShowNoteInput(false); setNewNote(''); }}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              <div className="p-4 max-h-[200px] overflow-y-auto space-y-2">
                {internalNotes.length === 0 ? (
                  <p className="text-sm text-gray-500">No internal notes.</p>
                ) : (
                  internalNotes.map((n: any) => (
                    <div key={n.id} className="p-2 bg-amber-50 rounded text-sm">
                      <span className="font-medium text-amber-800">{n.user_name}</span>
                      <span className="text-amber-600 mx-1">•</span>
                      <span className="text-amber-700">{new Date(n.created_at).toLocaleString()}</span>
                      <p className="text-gray-700 mt-1">{n.note}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {!isStudent && ticket.status !== 'resolved' && (
        <div className="mt-6 flex flex-wrap gap-3">
          {!ticket.assigned_to && (
            <button
              onClick={handleClaim}
              className="px-4 py-2 bg-[#11CCEF] text-white rounded-lg font-medium hover:bg-[#0daed9]"
            >
              Claim Ticket
            </button>
          )}
          {ticket.assigned_to && ticket.status === 'open' && (
            <button
              onClick={() => handleStatus('in_progress')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
            >
              Mark In Progress
            </button>
          )}
          {ticket.assigned_to && (
            <button
              onClick={() => handleStatus('resolved')}
              className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
            >
              Mark Resolved
            </button>
          )}
          {ticket.status !== 'escalated' && (
            <button
              onClick={openForwardModal}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700"
            >
              Forward
            </button>
          )}
          {ticket.assigned_to && (
            <button
              onClick={openReassignModal}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700"
            >
              Reassign
            </button>
          )}
        </div>
      )}

      {showForwardModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowForwardModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-lg mb-4">Forward chat</h3>
            <p className="text-sm text-gray-600 mb-4">Send this ticket to the student&apos;s assessor or to another department.</p>

            <div className="space-y-4">
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">To student&apos;s own assessor</h4>
                {studentTutor ? (
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{studentTutor.name}</p>
                      <p className="text-xs text-gray-500">{studentTutor.email}</p>
                    </div>
                    <button
                      onClick={handleForwardToTutor}
                      disabled={forwardingToTutor}
                      className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                    >
                      {forwardingToTutor ? 'Sending…' : 'Forward'}
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Student has no assigned assessor.</p>
                )}
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">To other department</h4>
                <select
                  value={transferDeptId}
                  onChange={(e) => onTransferDeptChange(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2"
                >
                  <option value="">Select department...</option>
                  {departments.filter(d => d.id !== ticket.department_id).map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                {transferDeptId && (
                  <select
                    value={transferAssignedTo}
                    onChange={(e) => setTransferAssignedTo(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2"
                  >
                    <option value="">Unassigned</option>
                    {transferAgents.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                )}
                <button
                  onClick={handleTransfer}
                  disabled={!transferDeptId || transferring}
                  className="w-full px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {transferring ? 'Transferring…' : 'Transfer to department'}
                </button>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button onClick={() => setShowForwardModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Close</button>
            </div>
          </div>
        </div>
      )}

      {showReassignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowReassignModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-lg mb-4">Reassign Ticket</h3>
            <select
              value={reassignTo}
              onChange={(e) => setReassignTo(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-4"
            >
              <option value="">Select agent...</option>
              {agents.filter(a => a.id !== ticket.assigned_to).map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowReassignModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button onClick={handleReassign} disabled={!reassignTo || reassigning} className="px-4 py-2 bg-[#11CCEF] text-white rounded-lg text-sm disabled:opacity-50">
                {reassigning ? 'Reassigning...' : 'Reassign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEscalateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowEscalateModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-lg mb-2">Escalate to Assessor</h3>
            <p className="text-sm text-gray-600 mb-4">Select an assessor to escalate this ticket. They will see the full chat history and can reply.</p>
            {agents.length === 0 && (
              <p className="text-sm text-amber-600 mb-2">This student has no assigned assessor. Escalation is not available.</p>
            )}
            <select
              value={reassignTo}
              onChange={(e) => setReassignTo(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-4"
            >
              <option value="">Select assessor...</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({a.email})</option>
              ))}
            </select>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowEscalateModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button onClick={handleEscalate} disabled={!reassignTo} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm disabled:opacity-50">
                Escalate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TicketDetailPage() {
  return (
    <Suspense fallback={<div className="p-6 flex items-center justify-center min-h-[300px]"><p className="text-gray-500">Loading...</p></div>}>
      <TicketDetailContent />
    </Suspense>
  );
}
