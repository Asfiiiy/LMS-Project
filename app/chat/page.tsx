"use client";
import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import ChatBox from "@/app/components/ChatBox";
import { User } from "@/app/components/types";
import { useFloatingChatSafe } from "@/app/components/useFloatingChatSafe";

interface Conversation {
  id: number;
  student_id: number | null;
  tutor_id: number | null;
  admin_id: number | null;
  course_id: number | null;
  conversation_type: 'direct' | 'group' | 'course' | 'ticket';
  title: string | null;
  student_name: string;
  tutor_name: string;
  admin_name: string;
  course_title: string;
  student_profile_picture?: string | null;
  tutor_profile_picture?: string | null;
  admin_profile_picture?: string | null;
  last_message: string | null;
  last_message_time: string | null;
  updated_at: string;
  ticket_id?: number | null;
  ticket_status?: string | null;
  ticket_assigned_to?: number | null;
  ticket_assigned_to_name?: string | null;
  ticket_department_id?: number | null;
  student_tutor_id?: number | null;
  student_tutor_name?: string | null;
}

function ChatPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferAgents, setTransferAgents] = useState<{ id: number; name: string; email: string }[]>([]);
  const [transferDepartments, setTransferDepartments] = useState<{ id: number; name: string; color: string }[]>([]);
  const [transferDepartmentId, setTransferDepartmentId] = useState<number | ''>('');
  const [studentTutorForTransfer, setStudentTutorForTransfer] = useState<{ id: number; name: string; email: string } | null>(null);
  const [forwardingToTutor, setForwardingToTutor] = useState(false);
  const [reassignTo, setReassignTo] = useState<number | ''>('');
  const [reassigning, setReassigning] = useState(false);
  const [selectedThread, setSelectedThread] = useState<{
    student_id: number;
    student_name: string;
    student_profile_picture?: string | null;
    conversations: Conversation[];
    activeConversationId: number;
    lastMessageAt: string | null;
    lastMessage: string | null;
  } | null>(null);
  const [mergedMessages, setMergedMessages] = useState<any[]>([]);
  const [mergedEvents, setMergedEvents] = useState<Array<{ type: 'ticket_created' | 'ticket_accepted'; ticketId: number; subject?: string; acceptedByName?: string; createdAt: string }>>([]);
  const [mergedLoading, setMergedLoading] = useState(false);
  const [transferConversation, setTransferConversation] = useState<Conversation | null>(null);
  const [markCompleteLoading, setMarkCompleteLoading] = useState(false);
  const floatingChat = useFloatingChatSafe();

  const doMarkComplete = async (conv: Conversation) => {
    if (!conv?.ticket_id || !user) return;
    setMarkCompleteLoading(true);
    try {
      const { getApiUrl } = await import('../utils/apiUrl');
      const apiUrl = getApiUrl();
      const token = localStorage.getItem('lms-token');
      const res = await fetch(`${apiUrl}/api/tickets/${conv.ticket_id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'resolved' })
      });
      const data = await res.json();
      if (data.success) {
        setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, ticket_status: 'resolved' } : c));
        setSelectedConversation(prev => prev && prev.id === conv.id ? { ...prev, ticket_status: 'resolved' } : prev);
        setSelectedThread(prev => prev ? {
          ...prev,
          conversations: prev.conversations.map(c => c.id === conv.id ? { ...c, ticket_status: 'resolved' } : c)
        } : null);
        window.dispatchEvent(new CustomEvent('ticket_updated', { detail: { ticketId: conv.ticket_id, status: 'resolved', conversation_id: conv.id } }));
      } else alert(data.message || 'Failed to mark complete');
    } catch (e) {
      console.error(e);
      alert('Failed to mark complete');
    } finally {
      setMarkCompleteLoading(false);
    }
  };

  useEffect(() => {
    const userData: User | null = JSON.parse(localStorage.getItem('lms-user') || 'null');
    if (!userData) {
      router.push('/login');
      return;
    }
    setUser(userData);
    fetchConversations(userData.id!);
  }, [router]);

  // Handle conversation query parameter
  useEffect(() => {
    const conversationId = searchParams.get('conversation');
    if (conversationId && conversations.length > 0) {
      const conv = conversations.find((c) => c.id === parseInt(conversationId));
      if (conv) {
        setSelectedConversation(conv);
        setSelectedThread(null);
        setShowSidebar(false);
      }
    }
  }, [searchParams, conversations]);

  const fromTickets = searchParams.get('from') === 'tickets';
  const displayConversations = fromTickets
    ? conversations.filter((c) => c.conversation_type === 'ticket' || c.ticket_id)
    : conversations;

  const threads = React.useMemo(() => {
    if (!fromTickets || displayConversations.length === 0) return [];
    const byStudent = new Map<number, Conversation[]>();
    for (const c of displayConversations) {
      const sid = c.student_id ?? 0;
      if (!sid) continue;
      if (!byStudent.has(sid)) byStudent.set(sid, []);
      byStudent.get(sid)!.push(c);
    }
    const result: Array<{
      student_id: number;
      student_name: string;
      student_profile_picture?: string | null;
      conversations: Conversation[];
      activeConversationId: number;
      lastMessageAt: string | null;
      lastMessage: string | null;
    }> = [];
    byStudent.forEach((convs, student_id) => {
      const sorted = [...convs].sort((a, b) => {
        const ta = a.last_message_time || a.updated_at || '';
        const tb = b.last_message_time || b.updated_at || '';
        return tb.localeCompare(ta);
      });
      const active = sorted[0];
      result.push({
        student_id,
        student_name: active.student_name || 'Student',
        student_profile_picture: active.student_profile_picture ?? null,
        conversations: sorted,
        activeConversationId: active.id,
        lastMessageAt: active.last_message_time || active.updated_at || null,
        lastMessage: active.last_message || null
      });
    });
    result.sort((a, b) => (b.lastMessageAt || '').localeCompare(a.lastMessageAt || ''));
    return result;
  }, [fromTickets, displayConversations]);

  // When fromTickets and user selects a thread, fetch merged messages
  useEffect(() => {
    if (!fromTickets || !selectedThread || !user?.id) return;
    setMergedLoading(true);
    import('../utils/apiUrl').then(({ getApiUrl }) => {
      const apiUrl = getApiUrl();
      const token = localStorage.getItem('lms-token');
      return fetch(`${apiUrl}/api/chat/merged-ticket-messages?studentId=${selectedThread.student_id}&userId=${user.id}`, {
        headers: { Authorization: token ? `Bearer ${token}` : '' }
      });
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setMergedMessages(data.messages || []);
          setMergedEvents(data.events || []);
          if (data.activeConversationId && selectedThread.activeConversationId !== data.activeConversationId) {
            setSelectedThread((prev) => prev ? { ...prev, activeConversationId: data.activeConversationId } : null);
          }
        }
      })
      .catch(() => { setMergedMessages([]); setMergedEvents([]); })
      .finally(() => setMergedLoading(false));
  }, [fromTickets, selectedThread?.student_id, user?.id]);

  // When fromTickets and threads load, select first thread if none selected
  useEffect(() => {
    if (fromTickets && threads.length > 0 && !selectedThread) {
      setSelectedThread(threads[0]);
    }
  }, [fromTickets, threads, selectedThread]);

  useEffect(() => {
    if (!fromTickets || !user?.id) return;
    const handler = () => fetchConversations(user.id!);
    window.addEventListener('ticket_updated', handler);
    return () => window.removeEventListener('ticket_updated', handler);
  }, [fromTickets, user?.id]);

  const fetchConversations = async (userId: number) => {
    try {
      setLoading(true);
      const { getApiUrl } = await import('../utils/apiUrl');
      const apiUrl = getApiUrl();
      const token = localStorage.getItem('lms-token');
      const res = await fetch(`${apiUrl}/api/chat/conversations/${userId}`, {
        headers: { Authorization: token ? `Bearer ${token}` : '' }
      });
      const data = await res.json();
      if (data.success) {
        const list = data.conversations || [];
        setConversations(list);
        const ticketOnly = list.filter((c: Conversation) => c.conversation_type === 'ticket' || c.ticket_id);
        const toShow = fromTickets ? ticketOnly : list;
        if (toShow.length > 0 && !fromTickets) {
          const conversationId = searchParams.get('conversation');
          if (conversationId) {
            const conv = list.find((c: Conversation) => c.id === parseInt(conversationId));
            if (conv) {
              setSelectedConversation(conv);
              setShowSidebar(false);
            } else {
              setSelectedConversation(toShow[0]);
            }
          } else {
            setSelectedConversation(toShow[0]);
          }
        }
        // when fromTickets, selectedThread is set by useEffect from threads
      }
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const { getApiUrl } = await import('../utils/apiUrl');
      const apiUrl = getApiUrl();
      const token = localStorage.getItem('lms-token');
      const res = await fetch(`${apiUrl}/api/chat/users/all`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (data.success) {
        // Filter out current user
        const filteredUsers = (data.users || []).filter((u: any) => u.id !== user?.id);
        setAllUsers(filteredUsers);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const startNewConversation = async () => {
    if (!selectedUserId || !user) return;
    
    try {
      const selectedUser = allUsers.find(u => u.id === selectedUserId);
      if (!selectedUser) return;

      // Determine conversation participants based on roles
      const payload: any = {
        conversation_type: 'direct'
      };

      if (user.role === 'Admin') {
        payload.admin_id = user.id;
        if (selectedUser.role === 'Student') {
          payload.student_id = selectedUserId;
        } else if (selectedUser.role === 'Assessor') {
          payload.tutor_id = selectedUserId;
        }
      } else if (user.role === 'Assessor') {
        payload.tutor_id = user.id;
        if (selectedUser.role === 'Student') {
          payload.student_id = selectedUserId;
        } else if (selectedUser.role === 'Admin') {
          payload.admin_id = selectedUserId;
        }
      } else if (user.role === 'Student') {
        payload.student_id = user.id;
        if (selectedUser.role === 'Assessor') {
          payload.tutor_id = selectedUserId;
        } else if (selectedUser.role === 'Admin') {
          payload.admin_id = selectedUserId;
        }
      }

      const { getApiUrl } = await import('../utils/apiUrl');
      const apiUrl = getApiUrl();
      const token = localStorage.getItem('lms-token');
      const res = await fetch(`${apiUrl}/api/chat/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text();
        throw new Error(`Expected JSON but got ${contentType}. Response: ${text.substring(0, 100)}`);
      }

      const data = await res.json();
      if (data.success) {
        setShowNewChatModal(false);
        setSelectedUserId(null);
        setSearchQuery('');
        // Refresh conversations
        await fetchConversations(user.id!);
        // Select the new conversation
        const newConv = conversations.find(c => c.id === data.conversation.id) || data.conversation;
        setSelectedConversation(newConv);
      }
    } catch (error) {
      console.error("Error starting conversation:", error);
      alert("Failed to start conversation");
    }
  };

  const getConversationTitle = (conv: Conversation) => {
    if (conv.title) return conv.title;
    if (conv.conversation_type === 'course') return conv.course_title;
    if (conv.conversation_type === 'ticket' && conv.student_name) return `${conv.student_name} (Ticket)`;
    
    // For direct messages, show the other person's name
    if (user?.id === conv.student_id) {
      // Current user is the student, show tutor or admin
      return conv.tutor_name !== 'Unknown' ? conv.tutor_name : conv.admin_name;
    } else if (user?.id === conv.tutor_id) {
      // Current user is the tutor, show student or admin
      return conv.student_name !== 'Unknown' ? conv.student_name : conv.admin_name;
    } else if (user?.id === conv.admin_id) {
      // Current user is the admin, show student or tutor
      return conv.student_name !== 'Unknown' ? conv.student_name : conv.tutor_name;
    }
    return conv.student_name !== 'Unknown' ? conv.student_name : 'Unknown';
  };

  const openTransferModal = async (conversation?: Conversation | null) => {
    const conv = conversation ?? selectedConversation;
    if (!conv?.ticket_id) return;
    setTransferConversation(conv);
    setTransferDepartmentId(conv.ticket_department_id ?? '');
    setReassignTo('');
    setStudentTutorForTransfer(null);
    try {
      const { getApiUrl } = await import('../utils/apiUrl');
      const apiUrl = getApiUrl();
      const token = localStorage.getItem('lms-token');
      const [deptRes, agentsRes, escalateRes] = await Promise.all([
        fetch(`${apiUrl}/api/tickets/departments`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${apiUrl}/api/tickets/agents?department=${conv.ticket_department_id || ''}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${apiUrl}/api/tickets/${conv.ticket_id}/escalate-agents`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      const deptData = await deptRes.json();
      const agentsData = await agentsRes.json();
      const escalateData = await escalateRes.json();
      if (deptData.success) setTransferDepartments(deptData.departments || []);
      if (agentsData.success) setTransferAgents(agentsData.agents || []);
      if (escalateData.success && escalateData.agents?.length > 0) setStudentTutorForTransfer(escalateData.agents[0]);
      setShowTransferModal(true);
    } catch (e) {
      console.error(e);
    }
  };

  const doForwardToTutor = async () => {
    const conv = transferConversation || selectedConversation;
    if (!conv?.ticket_id || !studentTutorForTransfer || !user) return;
    setForwardingToTutor(true);
    try {
      const { getApiUrl } = await import('../utils/apiUrl');
      const apiUrl = getApiUrl();
      const token = localStorage.getItem('lms-token');
      const res = await fetch(`${apiUrl}/api/tickets/${conv.ticket_id}/escalate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ escalate_to: studentTutorForTransfer.id })
      });
      const data = await res.json();
      if (data.success) {
        setShowTransferModal(false);
        setConversations(prev => prev.map(c =>
          c.id === conv.id ? { ...c, ticket_assigned_to: studentTutorForTransfer.id, ticket_assigned_to_name: studentTutorForTransfer.name, ticket_status: 'escalated' } : c
        ));
        setSelectedConversation(prev => prev && prev.id === conv.id ? { ...prev, ticket_assigned_to: studentTutorForTransfer.id, ticket_assigned_to_name: studentTutorForTransfer.name, ticket_status: 'escalated' } : prev);
        setSelectedThread(prev => prev ? {
          ...prev,
          conversations: prev.conversations.map(c =>
            c.id === conv.id ? { ...c, ticket_assigned_to: studentTutorForTransfer.id, ticket_assigned_to_name: studentTutorForTransfer.name, ticket_status: 'escalated' } : c
          )
        } : null);
        setTransferConversation(null);
        window.dispatchEvent(new CustomEvent('ticket_updated', { detail: { ticketId: conv.ticket_id, status: 'escalated', assigned_to: studentTutorForTransfer.id, assigned_to_name: studentTutorForTransfer.name } }));
      } else {
        alert(data.message || 'Forward failed');
      }
    } catch (e) {
      console.error(e);
      alert('Forward failed');
    } finally {
      setForwardingToTutor(false);
    }
  };

  const onTransferDepartmentChange = async (deptId: number | '') => {
    setTransferDepartmentId(deptId);
    setReassignTo('');
    if (!deptId) {
      setTransferAgents([]);
      return;
    }
    try {
      const { getApiUrl } = await import('../utils/apiUrl');
      const apiUrl = getApiUrl();
      const token = localStorage.getItem('lms-token');
      const res = await fetch(`${apiUrl}/api/tickets/agents?department=${deptId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setTransferAgents(data.agents || []);
      else setTransferAgents([]);
    } catch (e) {
      setTransferAgents([]);
    }
  };

  const doReassignTicket = async () => {
    const conv = transferConversation || selectedConversation;
    if (!conv?.ticket_id || !user) return;
    const isTransferToOtherDept = transferDepartmentId !== '' && transferDepartmentId !== (conv.ticket_department_id ?? null);
    if (!isTransferToOtherDept && reassignTo === '') return; // same department requires an agent
    setReassigning(true);
    try {
      const { getApiUrl } = await import('../utils/apiUrl');
      const apiUrl = getApiUrl();
      const token = localStorage.getItem('lms-token');
      let res: Response;
      if (isTransferToOtherDept) {
        const body: { department_id: number; assigned_to?: number } = { department_id: Number(transferDepartmentId) };
        if (reassignTo !== '') body.assigned_to = Number(reassignTo);
        res = await fetch(`${apiUrl}/api/tickets/${conv.ticket_id}/transfer`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body)
        });
      } else {
        res = await fetch(`${apiUrl}/api/tickets/${conv.ticket_id}/reassign`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ assigned_to: reassignTo })
        });
      }
      const data = await res.json();
      if (data.success) {
        setShowTransferModal(false);
        const agent = transferAgents.find(a => a.id === reassignTo);
        const newAssignedTo = reassignTo as number;
        const newAssignedToName = agent?.name ?? '';
        const newDeptId = isTransferToOtherDept ? transferDepartmentId : conv.ticket_department_id;
        setConversations(prev => prev.map(c =>
          c.id === conv.id
            ? { ...c, ticket_assigned_to: newAssignedTo || null, ticket_assigned_to_name: newAssignedToName, ticket_department_id: newDeptId ?? c.ticket_department_id }
            : c
        ));
        setSelectedConversation(prev => prev && prev.id === conv.id ? { ...prev, ticket_assigned_to: newAssignedTo || null, ticket_assigned_to_name: newAssignedToName, ticket_department_id: newDeptId ?? prev.ticket_department_id } : prev);
        setSelectedThread(prev => prev ? {
          ...prev,
          conversations: prev.conversations.map(c =>
            c.id === conv.id ? { ...c, ticket_assigned_to: newAssignedTo || null, ticket_assigned_to_name: newAssignedToName, ticket_department_id: newDeptId ?? c.ticket_department_id } : c
          )
        } : null);
        setTransferConversation(null);
        window.dispatchEvent(new CustomEvent('ticket_updated', { detail: { ticketId: conv.ticket_id, department_id: newDeptId, assigned_to: newAssignedTo || null, assigned_to_name: newAssignedToName } }));
      } else {
        alert(data.message || (isTransferToOtherDept ? 'Transfer failed' : 'Reassign failed'));
      }
    } catch (e) {
      console.error(e);
      alert(isTransferToOtherDept ? 'Transfer failed' : 'Reassign failed');
    } finally {
      setReassigning(false);
    }
  };

  const getOtherUserProfilePic = (conv: Conversation): string | null => {
    if (user?.id === conv.student_id) {
      return conv.tutor_profile_picture || conv.admin_profile_picture || null;
    }
    if (user?.id === conv.tutor_id) {
      return conv.student_profile_picture || conv.admin_profile_picture || null;
    }
    if (user?.id === conv.admin_id) {
      return conv.student_profile_picture || conv.tutor_profile_picture || null;
    }
    return null;
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Mobile: Show back to conversations button when chat is open */}
              {selectedConversation && (
                <button
                  onClick={() => {
                    setSelectedConversation(null);
                    setShowSidebar(true);
                  }}
                  className="lg:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </button>
              )}
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">💬 Chat</h1>
            </div>
            <div className="flex items-center gap-2">
              {/* Mobile: Toggle sidebar button */}
              {!selectedConversation && (
                <button
                  onClick={() => setShowSidebar(!showSidebar)}
                  className="lg:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              )}
              {searchParams.get('from') === 'tickets' ? (
                <Link href="/dashboard/tickets" className="hidden sm:flex px-3 sm:px-4 py-2 text-sm sm:text-base text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                  ← Tickets
                </Link>
              ) : (
                <button
                  onClick={() => router.back()}
                  className="hidden sm:flex px-3 sm:px-4 py-2 text-sm sm:text-base text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  ← Back
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-64px)] sm:h-[calc(100vh-72px)] lg:h-[calc(100vh-80px)] relative">
        {/* Conversations Sidebar */}
        <div className={`${showSidebar ? 'flex' : 'hidden'} lg:flex absolute lg:relative inset-0 lg:inset-auto z-40 lg:z-auto w-full lg:w-80 bg-white border-r border-gray-200 overflow-y-auto flex-col`}>
          <div className="p-3 sm:p-4 border-b border-gray-200 sticky top-0 bg-white z-10">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">
                {fromTickets ? 'Ticket conversations' : 'Messages'}
              </h2>
              {/* Mobile: Close sidebar button */}
              <button
                onClick={() => setShowSidebar(false)}
                className="lg:hidden p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {fromTickets && (
              <p className="text-xs text-gray-500 mb-2">All your ticket chats in one place</p>
            )}
            {/* Hide "New Chat" button for students; hide when showing only tickets */}
            {user?.role !== 'Student' && !fromTickets && (
              <button
                onClick={() => {
                  setShowNewChatModal(true);
                  fetchAllUsers();
                }}
                className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base bg-[#11CCEF] text-white rounded-lg hover:bg-[#0daed9] transition-colors"
              >
                + New Chat
              </button>
            )}
          </div>

          {loading ? (
            <div className="p-4 text-center text-sm text-gray-500">Loading...</div>
          ) : fromTickets ? (
            threads.length === 0 ? (
              <div className="p-6 sm:p-8 text-center text-gray-400">
                <svg className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-xs sm:text-sm">No ticket conversations yet</p>
              </div>
            ) : (
              <div>
                {threads.map((thread) => (
                  <div
                    key={thread.student_id}
                    onClick={() => {
                      setSelectedThread(thread);
                      setSelectedConversation(null);
                      setShowSidebar(false);
                    }}
                    className={`p-3 sm:p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors ${
                      selectedThread?.student_id === thread.student_id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2 sm:gap-3">
                      <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-full flex-shrink-0 overflow-hidden bg-gradient-to-r from-blue-500 to-purple-600">
                        {thread.student_profile_picture ? (
                          <img src={thread.student_profile_picture} alt="" className="absolute inset-0 w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                        ) : null}
                        <span className="absolute inset-0 flex items-center justify-center text-white font-semibold text-sm sm:text-base">
                          {(thread.student_name || 'S').charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <h3 className="text-sm sm:text-base font-semibold text-gray-900 truncate">
                            {thread.student_name}
                          </h3>
                          <span className="text-xs text-gray-500 flex-shrink-0">
                            {formatTime(thread.lastMessageAt)}
                          </span>
                        </div>
                        {thread.lastMessage && (
                          <p className="text-xs sm:text-sm text-gray-600 truncate mt-1">
                            {thread.lastMessage}
                          </p>
                        )}
                        <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">
                          {thread.conversations.length} ticket{thread.conversations.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : displayConversations.length === 0 ? (
            <div className="p-6 sm:p-8 text-center text-gray-400">
              <svg className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-xs sm:text-sm">No conversations yet</p>
            </div>
          ) : (
            <div>
              {displayConversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => {
                    setSelectedConversation(conv);
                    setSelectedThread(null);
                    setShowSidebar(false);
                  }}
                  className={`p-3 sm:p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors ${
                    selectedConversation?.id === conv.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-full flex-shrink-0 overflow-hidden bg-gradient-to-r from-blue-500 to-purple-600">
                      {getOtherUserProfilePic(conv) && (
                        <img src={getOtherUserProfilePic(conv)!} alt="" className="absolute inset-0 w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      )}
                      <span className="absolute inset-0 flex items-center justify-center text-white font-semibold text-sm sm:text-base">
                        {getConversationTitle(conv).charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="text-sm sm:text-base font-semibold text-gray-900 truncate">
                          {getConversationTitle(conv)}
                        </h3>
                        <span className="text-xs text-gray-500 flex-shrink-0">
                          {formatTime(conv.last_message_time || conv.updated_at)}
                        </span>
                      </div>
                      {conv.last_message && (
                        <p className="text-xs sm:text-sm text-gray-600 truncate mt-1">
                          {conv.last_message}
                        </p>
                      )}
                      {conv.conversation_type === 'course' && (
                        <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">
                          Course Chat
                        </span>
                      )}
                      {conv.conversation_type === 'ticket' && (
                        <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">
                          Ticket
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chat Area */}
        <div className={`flex-1 flex flex-col ${(selectedConversation || selectedThread) ? 'flex' : 'hidden lg:flex'}`}>
          {fromTickets && selectedThread ? (
            <>
              <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900 truncate">
                      {selectedThread.student_name}
                    </h2>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-gray-600">
                      <span><strong>Student:</strong> {selectedThread.student_name}</span>
                      {selectedThread.conversations[0]?.ticket_assigned_to_name && (
                        <span><strong>Assigned to:</strong> {selectedThread.conversations[0].ticket_assigned_to_name}</span>
                      )}
                      {selectedThread.conversations[0]?.student_tutor_name && (
                        <span><strong>Student&apos;s assessor:</strong> {selectedThread.conversations[0].student_tutor_name}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">All ticket history in one chat</p>
                  </div>
                  {selectedThread.conversations[0]?.ticket_id && user?.role !== 'Student' && (
                    <div className="flex flex-wrap gap-2">
                      {selectedThread.conversations[0].ticket_status !== 'escalated' && (
                        <>
                          <button
                            type="button"
                            onClick={() => openTransferModal(selectedThread.conversations[0])}
                            className="flex-shrink-0 px-3 py-1.5 text-sm font-medium text-[#11CCEF] border border-[#11CCEF] rounded-lg hover:bg-[#11CCEF]/10 transition-colors"
                          >
                            Transfer
                          </button>
                          <button
                            type="button"
                            onClick={() => openTransferModal(selectedThread.conversations[0])}
                            className="flex-shrink-0 px-3 py-1.5 text-sm font-medium text-red-600 border border-red-600 rounded-lg hover:bg-red-50 transition-colors"
                          >
                            Escalate to assessor
                          </button>
                        </>
                      )}
                      {selectedThread.conversations[0].ticket_status !== 'resolved' && (
                        <button
                          type="button"
                          onClick={() => doMarkComplete(selectedThread.conversations[0])}
                          disabled={markCompleteLoading}
                          className="flex-shrink-0 px-3 py-1.5 text-sm font-medium text-white bg-green-600 border border-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                          {markCompleteLoading ? 'Completing…' : 'Mark as complete'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {user?.role === 'Student' && (() => {
                const conv = selectedThread.conversations[0];
                if (!conv?.ticket_id) return null;
                const awaitingId = conv.ticket_status === 'escalated' || conv.ticket_status === 'in_progress' ? conv.ticket_assigned_to : null;
                const personHasJoined = awaitingId != null && mergedMessages.some((m: { sender_id?: number }) => m.sender_id === awaitingId);
                const showJoiningSoon = (conv.ticket_status === 'escalated' && conv.ticket_assigned_to) || (conv.ticket_status === 'in_progress' && conv.ticket_assigned_to);
                return showJoiningSoon && !personHasJoined ? (
                  <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-center text-sm text-amber-800">
                    {conv.ticket_status === 'escalated' ? 'Your assessor will join soon.' : 'A team member will join soon.'}
                  </div>
                ) : null;
              })()}
              <div className="flex-1 p-3 sm:p-4 lg:p-6 overflow-hidden">
                {mergedLoading ? (
                  <div className="flex items-center justify-center h-full text-gray-500">Loading history...</div>
                ) : (
                  <ChatBox
                    conversationId={selectedThread.activeConversationId}
                    userId={user.id!}
                    userName={user.name || 'User'}
                    userRole={user.role ?? undefined}
                    otherUserId={selectedThread.student_id}
                    otherUserName={selectedThread.student_name}
                    otherUserProfilePicture={selectedThread.student_profile_picture ?? undefined}
                    initialMessages={mergedMessages}
                    timelineEvents={mergedEvents}
                  />
                )}
              </div>
            </>
          ) : selectedConversation ? (
            <>
              <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900 truncate">
                      {getConversationTitle(selectedConversation)}
                    </h2>
                    {selectedConversation.conversation_type === 'course' && (
                      <p className="text-xs sm:text-sm text-gray-500">Course Discussion</p>
                    )}
                    {selectedConversation.ticket_id && (
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-gray-600">
                        <span><strong>Student:</strong> {selectedConversation.student_name}</span>
                        {selectedConversation.ticket_assigned_to_name && (
                          <span><strong>Assigned to:</strong> {selectedConversation.ticket_assigned_to_name}</span>
                        )}
                        {selectedConversation.student_tutor_name && (
                          <span><strong>Student&apos;s assessor:</strong> {selectedConversation.student_tutor_name}</span>
                        )}
                      </div>
                    )}
                  </div>
                  {selectedConversation.ticket_id && user?.role !== 'Student' && (
                    <div className="flex flex-wrap gap-2">
                      {selectedConversation.ticket_status !== 'escalated' && (
                        <>
                          <button
                            type="button"
                            onClick={() => openTransferModal()}
                            className="flex-shrink-0 px-3 py-1.5 text-sm font-medium text-[#11CCEF] border border-[#11CCEF] rounded-lg hover:bg-[#11CCEF]/10 transition-colors"
                          >
                            Transfer
                          </button>
                          <button
                            type="button"
                            onClick={() => openTransferModal()}
                            className="flex-shrink-0 px-3 py-1.5 text-sm font-medium text-red-600 border border-red-600 rounded-lg hover:bg-red-50 transition-colors"
                          >
                            Escalate to assessor
                          </button>
                        </>
                      )}
                      {selectedConversation.ticket_status !== 'resolved' && (
                        <button
                          type="button"
                          onClick={() => doMarkComplete(selectedConversation)}
                          disabled={markCompleteLoading}
                          className="flex-shrink-0 px-3 py-1.5 text-sm font-medium text-white bg-green-600 border border-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                          {markCompleteLoading ? 'Completing…' : 'Mark as complete'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {selectedConversation.ticket_id && user?.role === 'Student' && (() => {
                const conv = selectedConversation;
                const showJoiningSoon = (conv.ticket_status === 'escalated' && conv.ticket_assigned_to) || (conv.ticket_status === 'in_progress' && conv.ticket_assigned_to);
                if (!showJoiningSoon) return null;
                return (
                  <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-center text-sm text-amber-800">
                    {conv.ticket_status === 'escalated' ? 'Your assessor will join soon.' : 'A team member will join soon.'}
                  </div>
                );
              })()}
              <div className="flex-1 p-3 sm:p-4 lg:p-6 overflow-hidden">
                <ChatBox
                  conversationId={selectedConversation.id}
                  userId={user.id!}
                  userName={user.name || 'User'}
                  userRole={user.role ?? undefined}
                  otherUserId={(() => {
                    if (selectedConversation.student_id && selectedConversation.student_id !== user.id) return selectedConversation.student_id;
                    if (selectedConversation.tutor_id && selectedConversation.tutor_id !== user.id) return selectedConversation.tutor_id;
                    if (selectedConversation.admin_id && selectedConversation.admin_id !== user.id) return selectedConversation.admin_id;
                    return undefined;
                  })()}
                  otherUserName={getConversationTitle(selectedConversation)}
                  otherUserProfilePicture={getOtherUserProfilePic(selectedConversation) ?? undefined}
                />
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full p-4">
              <div className="text-center text-gray-400">
                <svg className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 mx-auto mb-3 sm:mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-sm sm:text-base lg:text-lg">Select a conversation to start chatting</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Chat Modal - Only show for non-students */}
      {showNewChatModal && user?.role !== 'Student' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col">
            <div className="p-4 sm:p-6 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Start New Chat</h3>
                <button
                  onClick={() => {
                    setShowNewChatModal(false);
                    setSelectedUserId(null);
                    setSearchQuery('');
                  }}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search User
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or email..."
                  className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select User
                </label>
                <div className="max-h-48 sm:max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                  {allUsers
                    .filter(u => 
                      searchQuery === '' || 
                      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      u.email.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((u) => (
                      <div
                        key={u.id}
                        onClick={() => setSelectedUserId(u.id)}
                        className={`p-2.5 sm:p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors ${
                          selectedUserId === u.id ? 'bg-blue-50 border-l-4 border-l-[#11CCEF]' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm sm:text-base flex-shrink-0">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm sm:text-base font-medium text-gray-900 truncate">{u.name}</p>
                            <p className="text-xs sm:text-sm text-gray-500 truncate">{u.email}</p>
                          </div>
                          <span className={`text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded flex-shrink-0 ${
                            u.role === 'Student' ? 'bg-blue-100 text-blue-700' :
                            u.role === 'Assessor' ? 'bg-green-100 text-green-700' :
                            'bg-purple-100 text-purple-700'
                          }`}>
                            {u.role}
                          </span>
                        </div>
                      </div>
                    ))}
                  {allUsers.filter(u => 
                    searchQuery === '' || 
                    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    u.email.toLowerCase().includes(searchQuery.toLowerCase())
                  ).length === 0 && (
                    <div className="p-6 sm:p-8 text-center text-gray-400">
                      <p className="text-sm sm:text-base">No users found</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 sm:gap-3 pt-4 border-t border-gray-200 mt-4">
                <button
                  onClick={() => {
                    setShowNewChatModal(false);
                    setSelectedUserId(null);
                    setSearchQuery('');
                  }}
                  className="flex-1 px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={startNewConversation}
                  disabled={!selectedUserId}
                  className="flex-1 px-3 sm:px-4 py-2 text-sm sm:text-base bg-[#11CCEF] text-white rounded-lg hover:bg-[#0daed9] active:bg-[#0b9bc7] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Start Chat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transfer / reassign modal (ticket conversations) */}
      {showTransferModal && (transferConversation || selectedConversation)?.ticket_id && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col">
            <div className="p-4 sm:p-6 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Forward / Transfer</h3>
                <button
                  onClick={() => { setShowTransferModal(false); setReassignTo(''); setTransferDepartmentId(''); setStudentTutorForTransfer(null); setTransferConversation(null); }}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-3">
              <p className="text-sm text-gray-600">Forward to the student&apos;s tutor or send to another department.</p>

              <div className="border border-gray-200 rounded-lg p-3">
                <h4 className="text-sm font-medium text-gray-900 mb-2">To student&apos;s own tutor</h4>
                {studentTutorForTransfer ? (
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{studentTutorForTransfer.name}</p>
                      <p className="text-xs text-gray-500">{studentTutorForTransfer.email}</p>
                    </div>
                    <button
                      onClick={doForwardToTutor}
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

              <div className="border-t border-gray-200 pt-3">
                <h4 className="text-sm font-medium text-gray-900 mb-2">To other department</h4>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <select
                  value={transferDepartmentId}
                  onChange={(e) => onTransferDepartmentChange(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">Select department...</option>
                  {transferDepartments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              {transferDepartmentId !== '' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assign to (optional when transferring to another department)</label>
                  <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                    <div
                      onClick={() => setReassignTo('' as number | '')}
                      className={`p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                        reassignTo === '' ? 'bg-blue-50 border-l-4 border-l-[#11CCEF]' : ''
                      }`}
                    >
                      <p className="text-sm text-gray-600">Unassigned — assign later</p>
                    </div>
                    {transferAgents.map((agent) => (
                      <div
                        key={agent.id}
                        onClick={() => setReassignTo(agent.id)}
                        className={`p-3 border-b border-gray-100 last:border-0 cursor-pointer hover:bg-gray-50 transition-colors ${
                          reassignTo === agent.id ? 'bg-blue-50 border-l-4 border-l-[#11CCEF]' : ''
                        }`}
                      >
                        <p className="font-medium text-gray-900">{agent.name}</p>
                        <p className="text-xs text-gray-500">{agent.email}</p>
                      </div>
                    ))}
                    {transferAgents.length === 0 && (
                      <div className="p-3 text-gray-500 text-sm">No agents in this department.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-200 flex gap-2">
              <button
                onClick={() => { setShowTransferModal(false); setReassignTo(''); setTransferDepartmentId(''); setStudentTutorForTransfer(null); setTransferConversation(null); }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={doReassignTicket}
                disabled={
                  transferDepartmentId === '' ||
                  (Number(transferDepartmentId) === (transferConversation || selectedConversation)?.ticket_department_id && reassignTo === '') ||
                  reassigning
                }
                className="flex-1 px-4 py-2 bg-[#11CCEF] text-white rounded-lg hover:bg-[#0daed9] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {reassigning ? 'Transferring…' : 'Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ChatPageContent />
    </Suspense>
  );
}

