'use client';

import React, { useState, useEffect, useRef } from 'react';
import { getApiUrl } from '@/app/utils/apiUrl';

interface TicketMessage {
  id: number;
  ticket_id: number;
  sender_id: number;
  sender_name: string;
  sender_role_name?: string | null;
  message: string;
  file_url?: string | null;
  file_name?: string | null;
  created_at: string;
  read_at?: string | null;
  is_internal?: number;
}

interface FloatingTicketWindowProps {
  ticketId: number;
  subject: string;
  position: { x: number; y: number };
  isMinimized: boolean;
  unreadCount: number;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onMarkAsRead: () => void;
  onPositionChange: (x: number, y: number) => void;
  userId: number;
  minimizedIndex?: number;
  /** When true (student view), header shows "Support" instead of student name */
  forStudent?: boolean;
}

export default function FloatingTicketWindow({
  ticketId,
  subject,
  position,
  isMinimized,
  unreadCount,
  onClose,
  onMinimize,
  onMaximize,
  onMarkAsRead,
  onPositionChange,
  userId,
  minimizedIndex = 0,
  forStudent = false
}: FloatingTicketWindowProps) {
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [studentName, setStudentName] = useState<string>('');
  const [ticketStudentId, setTicketStudentId] = useState<number | null>(null);
  const [escalatedToId, setEscalatedToId] = useState<number | null>(null);
  const [escalatedToName, setEscalatedToName] = useState<string>('');
  const [assignedToId, setAssignedToId] = useState<number | null>(null);
  const [ticketStatus, setTicketStatus] = useState<string>('');
  const [ticketDepartmentId, setTicketDepartmentId] = useState<number | null>(null);
  const [departmentName, setDepartmentName] = useState<string>('');
  const [headerProfilePicture, setHeaderProfilePicture] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const conversationIdRef = useRef<number | null>(null);
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [escalateAgents, setEscalateAgents] = useState<{ id: number; name: string; email: string }[]>([]);
  const [escalateTo, setEscalateTo] = useState<number | ''>('');
  const [escalating, setEscalating] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const [showEditDelete, setShowEditDelete] = useState<number | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editMessageText, setEditMessageText] = useState('');
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchTicket = async () => {
    try {
      const res = await fetch(`${getApiUrl()}/api/tickets/${ticketId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('lms-token')}` }
      });
      const data = await res.json();
      if (data.success) {
        setMessages(data.messages || []);
        if (data.ticket?.student_name) setStudentName(data.ticket.student_name);
        if (data.ticket?.student_id != null) setTicketStudentId(data.ticket.student_id);
        if (data.ticket?.escalated_to != null) setEscalatedToId(data.ticket.escalated_to);
        if (data.ticket?.escalated_to_name) setEscalatedToName(data.ticket.escalated_to_name);
        if (data.ticket?.assigned_to != null) setAssignedToId(data.ticket.assigned_to);
        setTicketStatus(data.ticket?.status || '');
        setTicketDepartmentId(data.ticket?.department_id ?? null);
        setDepartmentName(data.ticket?.department_name || '');
        setHeaderProfilePicture(data.ticket?.header_profile_picture ?? null);
        const cid = data.ticket?.conversation_id ?? null;
        setConversationId(cid);
        conversationIdRef.current = cid;
        if (cid && !isMinimized) {
          fetch(`${getApiUrl()}/api/chat/mark-read`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('lms-token')}`
            },
            body: JSON.stringify({ conversationId: cid, userId })
          }).then(() => {
            window.dispatchEvent(new CustomEvent('conversation_marked_read', { detail: { conversationId: cid } }));
          }).catch(() => {});
        }
        // Mark ticket messages as read (triggers ticket_messages_read emit to senders for instant tick update)
        if (!isMinimized) {
          fetch(`${getApiUrl()}/api/tickets/${ticketId}/mark-read`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${localStorage.getItem('lms-token')}` }
          }).catch(() => {});
        }
      }
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTicket();
    onMarkAsRead();
  }, [ticketId]);

  useEffect(() => {
    const handler = () => fetchTicket();
    window.addEventListener('ticket_updated', handler);
    return () => {
      window.removeEventListener('ticket_updated', handler);
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, [ticketId]);

  // Refetch when window gains focus (catches missed messages if socket had a blip)
  useEffect(() => {
    const handler = () => {
      if (!document.hidden && !isMinimized) fetchTicket();
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [ticketId, isMinimized]);

  // Mark ticket messages as read when user views the window (maximized/visible)
  useEffect(() => {
    if (isMinimized || document.hidden) return;
    fetch(`${getApiUrl()}/api/tickets/${ticketId}/mark-read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('lms-token')}` }
    }).catch(() => {});
  }, [ticketId, isMinimized]);

  // Instant message: when the other party sends, append to list without refresh
  useEffect(() => {
    const handler = (e: Event) => {
      const { ticketId: msgTicketId, message: newMsg } = (e as CustomEvent<{ ticketId: number; message: TicketMessage }>).detail;
      if (msgTicketId !== ticketId) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === (newMsg as TicketMessage).id)) return prev;
        return [...prev, newMsg as TicketMessage];
      });
      const cid = conversationIdRef.current;
      if (cid && !document.hidden) {
        fetch(`${getApiUrl()}/api/chat/mark-read`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('lms-token')}`
          },
          body: JSON.stringify({ conversationId: cid, userId })
        }).then(() => {
          window.dispatchEvent(new CustomEvent('conversation_marked_read', { detail: { conversationId: cid } }));
        }).catch(() => {});
      }
      // Mark ticket messages as read so sender gets instant tick update
      if (!document.hidden) {
        fetch(`${getApiUrl()}/api/tickets/${ticketId}/mark-read`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('lms-token')}` }
        }).catch(() => {});
      }
    };
    window.addEventListener('ticket_message', handler);
    return () => window.removeEventListener('ticket_message', handler);
  }, [ticketId, userId]);

  // Instant tick update: when recipient reads our messages, backend emits ticket_messages_read
  useEffect(() => {
    const handler = (e: Event) => {
      const { ticketId: evTicketId, messageIds } = (e as CustomEvent<{ ticketId: number; messageIds: number[] }>).detail;
      if (evTicketId !== ticketId || !messageIds?.length) return;
      const now = new Date().toISOString();
      setMessages((prev) =>
        prev.map((m) => (messageIds.includes(m.id) ? { ...m, read_at: m.read_at || now } : m))
      );
    };
    window.addEventListener('ticket_messages_read', handler);
    return () => window.removeEventListener('ticket_messages_read', handler);
  }, [ticketId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (windowRef.current) {
      const rect = windowRef.current.getBoundingClientRect();
      setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      setIsDragging(true);
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = e.clientX - dragOffset.x;
        const newY = e.clientY - dragOffset.y;
        const maxX = window.innerWidth - 380;
        const maxY = window.innerHeight - 500;
        onPositionChange(Math.max(0, Math.min(newX, maxX)), Math.max(0, Math.min(newY, maxY)));
      }
    };
    const handleMouseUp = () => setIsDragging(false);
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, onPositionChange]);

  const openEscalateModal = async () => {
    setShowEscalateModal(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/tickets/${ticketId}/escalate-agents`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('lms-token')}` }
      });
      const data = await res.json();
      if (data.success) setEscalateAgents(data.agents || []);
      else setEscalateAgents([]);
    } catch {
      setEscalateAgents([]);
    }
    setEscalateTo('');
  };

  const handleMarkResolved = async () => {
    setResolving(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/tickets/${ticketId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('lms-token')}` },
        body: JSON.stringify({ status: 'resolved' })
      });
      const data = await res.json();
      if (data.success) {
        setTicketStatus('resolved');
        window.dispatchEvent(new CustomEvent('ticket_updated', { detail: { ticketId, status: 'resolved' } }));
      } else alert(data.message || 'Failed to resolve');
    } catch {
      alert('Failed to resolve');
    } finally {
      setResolving(false);
    }
  };

  const handleEscalate = async () => {
    if (!escalateTo) return;
    setEscalating(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/tickets/${ticketId}/escalate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('lms-token')}` },
        body: JSON.stringify({ escalate_to: escalateTo })
      });
      const data = await res.json();
      if (data.success) {
        setShowEscalateModal(false);
        setTicketStatus('escalated');
      } else alert(data.message || 'Failed to escalate');
    } catch {
      alert('Failed to escalate');
    } finally {
      setEscalating(false);
    }
  };

  const sendMessage = async (text?: string, fileAttachment?: { url: string; name: string; type: string }) => {
    const msg = (text || newMessage).trim();
    if (!msg && !fileAttachment) return;
    setSending(true);
    try {
      const payload: { message: string; file_url?: string; file_name?: string; file_type?: string } = {
        message: msg || '[Attachment]'
      };
      if (fileAttachment) {
        payload.file_url = fileAttachment.url;
        payload.file_name = fileAttachment.name;
        payload.file_type = fileAttachment.type;
      }
      const res = await fetch(`${getApiUrl()}/api/tickets/${ticketId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('lms-token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setMessages((prev) => [...prev, data.message]);
        setNewMessage('');
        const cid = conversationIdRef.current ?? conversationId;
        if (cid) {
          fetch(`${getApiUrl()}/api/chat/mark-read`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('lms-token')}`
            },
            body: JSON.stringify({ conversationId: cid, userId })
          }).then(() => {
            window.dispatchEvent(new CustomEvent('conversation_marked_read', { detail: { conversationId: cid } }));
          }).catch(() => {});
        }
      } else {
        alert(data.message || 'Failed to send');
      }
    } catch {
      alert('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleEditMessage = (messageId: number, currentText: string) => {
    setEditingMessageId(messageId);
    setEditMessageText(currentText || '');
  };

  const handleSaveEdit = async () => {
    if (!editingMessageId || !editMessageText.trim()) {
      setEditingMessageId(null);
      setEditMessageText('');
      return;
    }
    const messageId = editingMessageId;
    const text = editMessageText.trim();
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, message: text } : m)));
    setEditingMessageId(null);
    setEditMessageText('');
    try {
      const res = await fetch(`${getApiUrl()}/api/tickets/${ticketId}/messages/${messageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('lms-token')}` },
        body: JSON.stringify({ message: text })
      });
      const data = await res.json();
      if (!data.success) {
        fetchTicket();
        alert(data.message || 'Edit failed');
      }
    } catch {
      fetchTicket();
      alert('Edit failed');
    }
  };

  const handleDeleteMessage = async (messageId: number) => {
    if (!confirm('Are you sure you want to delete this message?')) return;
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, message: 'This message was deleted.' } : m)));
    try {
      const res = await fetch(`${getApiUrl()}/api/tickets/${ticketId}/messages/${messageId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('lms-token')}` }
      });
      const data = await res.json();
      if (!data.success) {
        fetchTicket();
        alert(data.message || 'Delete failed');
      }
    } catch {
      fetchTicket();
      alert('Delete failed');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('File too large. Max 10MB.');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${getApiUrl()}/api/tickets/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('lms-token')}` },
        body: formData
      });
      const data = await res.json();
      if (data.success && data.file) {
        await sendMessage('[Attachment]', { url: data.file.url, name: data.file.name, type: data.file.type });
      } else alert(data.message || 'Upload failed');
    } catch {
      alert('Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // When tutor joins (sends a message) on escalated ticket, show tutor name instead of department
  const tutorJoined = escalatedToName && (assignedToId != null || escalatedToId != null) &&
    messages.some((m) => m.sender_id === (assignedToId ?? escalatedToId));
  const displayName = forStudent
    ? (tutorJoined ? escalatedToName : (departmentName || 'Support'))
    : (studentName || 'Student');

  if (isMinimized) {
    const minimizedRight = 20 + minimizedIndex * 70;
    return (
      <div
        ref={windowRef}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: `${minimizedRight}px`,
          zIndex: 1000,
          width: '60px',
          height: '60px'
        }}
        className="bg-white rounded-full shadow-2xl border-2 border-[#11CCEF] cursor-pointer hover:scale-110 transition-transform"
        onClick={() => onMaximize()}
      >
        <div className="relative w-full h-full flex items-center justify-center">
          {headerProfilePicture && forStudent ? (
            <img src={headerProfilePicture} alt="" className="w-12 h-12 rounded-full object-cover border-2 border-white/80" />
          ) : (
            <div className="w-12 h-12 bg-gradient-to-br from-[#11CCEF] to-[#0daed9] rounded-full flex items-center justify-center text-white font-bold text-lg">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
          <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white bg-green-500" />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={windowRef}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 1000,
        width: '380px',
        height: '500px'
      }}
      className="bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
    >
      {/* Header - like the chat window in the image */}
      <div
        onMouseDown={handleMouseDown}
        className="bg-gradient-to-r from-[#11CCEF] to-[#0daed9] text-white px-4 py-2 flex items-center justify-between cursor-move"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="relative flex-shrink-0">
            {headerProfilePicture && forStudent ? (
              <img src={headerProfilePicture} alt="" className="w-8 h-8 rounded-full object-cover border border-white/50" />
            ) : (
              <div className="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center text-white font-bold text-sm">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-white bg-green-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">{displayName}</div>
            <div className="text-xs opacity-90">Online</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!forStudent && ticketStatus !== 'resolved' && ticketStatus !== 'escalated' && (
            <button
              type="button"
              onClick={openEscalateModal}
              className="p-1 hover:bg-white/20 rounded transition-colors"
              title="Escalate to assessor"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          )}
          {!forStudent && ticketStatus !== 'resolved' && (
            <button
              type="button"
              onClick={handleMarkResolved}
              disabled={resolving}
              className="p-1.5 px-2 hover:bg-white/20 rounded transition-colors disabled:opacity-50 flex items-center gap-1 text-xs font-medium"
              title="Mark as complete"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="hidden sm:inline">Mark complete</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onMinimize()}
            className="p-1 hover:bg-white rounded transition-colors"
            title="Minimize"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-white rounded transition-colors"
            title="Close"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 bg-gray-50" style={{ scrollBehavior: 'smooth' }}>
        {loading && messages.length === 0 ? (
          <div className="flex justify-center items-center h-full text-sm text-gray-500">Loading...</div>
        ) : messages.length === 0 ? (
          <div className="flex justify-center items-center h-full text-sm text-gray-400">No messages yet</div>
        ) : (
          messages.map((m) => {
            const isFromStudent = ticketStudentId != null && m.sender_id === ticketStudentId;
            const isRightSide = forStudent ? isFromStudent : (m.sender_id === userId);
            const isOwnMessage = Number(m.sender_id) === Number(userId);
            const senderLabel = (m.sender_name || 'Staff') + (m.sender_role_name ? ` · ${m.sender_role_name}` : '');
            const isClosed = ticketStatus === 'resolved';
            const canEdit = isOwnMessage && !isClosed &&
              m.created_at && (Date.now() - new Date(m.created_at).getTime() < 15 * 60 * 1000);
            const showActions = isOwnMessage && showEditDelete === m.id && canEdit;
            const isEditing = editingMessageId === m.id;
            const isDeleted = m.message === 'This message was deleted.';
            return (
              <div
                key={m.id}
                className={`flex ${isRightSide ? 'justify-end' : 'justify-start'} mb-2 items-end gap-1.5 group`}
                onMouseEnter={() => {
                  if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                  hoverTimeoutRef.current = setTimeout(() => {
                    if (isOwnMessage) setShowEditDelete(m.id);
                  }, 150);
                }}
                onMouseLeave={() => {
                  if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                  setShowEditDelete(null);
                }}
              >
                {!isRightSide && (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#11CCEF] to-[#0daed9] flex items-center justify-center text-white text-xs font-bold flex-shrink-0" title={senderLabel}>
                    {m.sender_name?.charAt(0).toUpperCase() || '?'}
                  </div>
                )}
                <div className="max-w-[80%] relative">
                  {!isRightSide && (m.sender_role_name || m.sender_name) && (
                    <div className="text-left mb-0.5">
                      <span className="text-xs font-medium text-gray-700">{senderLabel}</span>
                    </div>
                  )}
                  {isRightSide && (
                    <div className="text-right mb-0.5">
                      <span className="text-xs font-medium text-gray-600">You</span>
                    </div>
                  )}
                  {isEditing ? (
                    <div className={`rounded-lg px-3 py-1.5 text-sm ${isRightSide ? 'bg-[#11CCEF] text-white rounded-br-none' : 'bg-gray-100 text-gray-900 rounded-bl-none'}`}>
                      <textarea
                        value={editMessageText}
                        onChange={(e) => setEditMessageText(e.target.value)}
                        className="w-full bg-transparent border-none outline-none resize-none text-xs"
                        rows={2}
                        autoFocus
                      />
                      <div className="flex gap-2 mt-2">
                        <button onClick={handleSaveEdit} className="px-2 py-1 bg-white rounded text-xs text-pink-500 hover:bg-opacity-90 font-medium">Save</button>
                        <button onClick={() => { setEditingMessageId(null); setEditMessageText(''); }} className="px-2 py-1 bg-white rounded text-xs text-pink-500 hover:bg-opacity-90 font-medium">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className={`rounded-lg px-3 py-1.5 text-sm ${isRightSide ? 'bg-[#11CCEF] text-white rounded-br-none' : 'bg-gray-100 text-gray-900 rounded-bl-none'}`}>
                      {!isDeleted ? m.message : <span className="italic text-gray-500">{m.message}</span>}
                      {m.file_url && !isDeleted && (
                        <a href={m.file_url} target="_blank" rel="noopener noreferrer" className="block mt-1 text-xs underline">
                          {m.file_name || 'Attachment'}
                        </a>
                      )}
                    </div>
                  )}
                  <div className="text-xs mt-0.5 px-1 flex items-center gap-1 flex-wrap text-gray-500">
                    {m.created_at && new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {isOwnMessage && (
                      <span className="inline-flex items-center ml-1 shrink-0" title={m.read_at ? 'Read' : 'Sent'}>
                        {m.read_at ? (
                          <span className="inline-flex -space-x-1 text-blue-600" title="Read">
                            <svg className="w-4 h-4" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 7l4 4 10-10"/></svg>
                            <svg className="w-4 h-4" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 7l4 4 10-10"/></svg>
                          </span>
                        ) : (
                          <span className="text-gray-500" title="Sent">✓</span>
                        )}
                      </span>
                    )}
                    {showActions && (
                      <span className="inline-flex items-center gap-1 ml-2">
                        <button onClick={() => handleEditMessage(m.id, m.message)} className="text-gray-600 hover:text-[#11CCEF] hover:underline text-xs">Edit</button>
                        <span className="text-gray-300">|</span>
                        <button onClick={() => handleDeleteMessage(m.id)} className="text-red-500 hover:text-red-600 hover:underline text-xs">Delete</button>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {forStudent && (() => {
        // Show "joining soon" when transferred to department (in_progress + assigned) or escalated to tutor
        const awaitingPersonId = ticketStatus === 'escalated' ? escalatedToId : ticketStatus === 'in_progress' ? assignedToId : null;
        const personHasJoined = awaitingPersonId != null && messages.some((m) => m.sender_id === awaitingPersonId);
        const showJoiningSoon = (ticketStatus === 'escalated' && escalatedToId != null) || (ticketStatus === 'in_progress' && assignedToId != null);
        return showJoiningSoon && !personHasJoined ? (
          <div className="border-t border-gray-200 p-3 bg-amber-50 text-center text-sm text-amber-800">
            {ticketStatus === 'escalated' ? 'Your tutor will join soon.' : 'A team member will join soon.'}
          </div>
        ) : null;
      })()}
      {ticketStatus === 'resolved' && (
        <div className="border-t border-gray-200 p-3 bg-green-50 text-center text-sm text-green-800">
          {forStudent ? 'Your ticket has been resolved.' : 'This ticket has been resolved.'}
        </div>
      )}
      {/* Input - paperclip + Type a message... + Send */}
      <div className={`border-t border-gray-200 p-2 bg-white ${ticketStatus === 'resolved' ? 'opacity-60 pointer-events-none' : ''}`}>
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileUpload}
            className="hidden"
            accept="*"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="p-1.5 text-gray-500 hover:text-[#11CCEF] rounded transition-colors disabled:opacity-50"
            title="Attach file"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#11CCEF] resize-none"
          />
          <button
            type="button"
            onClick={() => sendMessage()}
            disabled={(!newMessage.trim() && !uploading) || sending}
            className="bg-[#11CCEF] text-white px-4 py-1.5 text-sm rounded-lg font-medium hover:bg-[#0daed9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
        {forStudent && (
          <a
            href={`/dashboard/tickets/${ticketId}`}
            className="block mt-2 text-xs text-[#11CCEF] hover:underline text-center"
          >
            Open full ticket page →
          </a>
        )}
      </div>

      {showEscalateModal && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10 rounded-lg" onClick={() => setShowEscalateModal(false)}>
          <div className="bg-white rounded-xl p-4 w-[90%] max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold mb-2">Escalate to Assessor</h3>
            <select
              value={escalateTo}
              onChange={(e) => setEscalateTo(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-3"
            >
              <option value="">Select assessor...</option>
              {escalateAgents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            {escalateAgents.length === 0 && (
              <p className="text-sm text-amber-600 mb-2">This student has no assigned assessor. Escalation is not available.</p>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowEscalateModal(false)} className="px-3 py-1.5 border rounded-lg text-sm">Cancel</button>
              <button onClick={handleEscalate} disabled={!escalateTo || escalating} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm disabled:opacity-50">
                {escalating ? 'Escalating...' : 'Escalate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
