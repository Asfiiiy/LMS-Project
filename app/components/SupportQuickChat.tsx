'use client';

import { useState, useEffect, useCallback } from 'react';
import { getApiUrl } from '@/app/utils/apiUrl';
import { User } from '@/app/components/types';
import { useStudentFloatingTicket } from './StudentFloatingTicketProvider';

interface TicketSummary {
  id: number;
  subject: string;
  status: string;
  created_at: string;
  updated_at?: string;
}

interface SupportQuickChatProps {
  user: User | null;
}

type View = 'create' | 'list';

export default function SupportQuickChat({ user }: SupportQuickChatProps) {
  const { openFloatingTicket } = useStudentFloatingTicket() ?? {};
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<View>('list');

  const [selectedCategory, setSelectedCategory] = useState<'Academic' | 'Finance' | 'Support' | 'Certificate'>('Support');
  const [createMessage, setCreateMessage] = useState('');
  const [creating, setCreating] = useState(false);

  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  const CATEGORY_OPTIONS: {
    label: string;
    value: 'Academic' | 'Finance' | 'Support' | 'Certificate';
    apiCategory: string;
    icon: string;
    description: string;
  }[] = [
    { label: 'Academic', value: 'Academic', apiCategory: 'Course Related', icon: '📚', description: 'Course or assignments' },
    { label: 'Finance', value: 'Finance', apiCategory: 'Financial', icon: '💳', description: 'Installment plan info' },
    { label: 'Support', value: 'Support', apiCategory: 'General', icon: '🔧', description: 'Login issue, technical issue' },
    { label: 'Certificate', value: 'Certificate', apiCategory: 'Certificate', icon: '📜', description: 'Certificate queries, claims, delivery' }
  ];

  const isStudent = user && ['Student', 'ManagerStudent', 'InstituteStudent'].includes(user.role || '');
  if (!isStudent) return null;

  // When staff replies, open the floating chat window for that ticket (not the quick support widget)
  useEffect(() => {
    const handler = (e: Event) => {
      const { ticketId } = (e as CustomEvent<{ ticketId: number }>).detail;
      openFloatingTicket?.(ticketId);
    };
    window.addEventListener('ticket_message', handler);
    return () => window.removeEventListener('ticket_message', handler);
  }, [openFloatingTicket]);

  const fetchTickets = useCallback(async () => {
    setTicketsLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/tickets?page=1&limit=5`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('lms-token')}` }
      });
      const data = await res.json();
      if (data.success) setTickets(data.tickets || []);
      else setTickets([]);
    } catch {
      setTickets([]);
    } finally {
      setTicketsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && (view === 'list' || view === 'create')) fetchTickets();
  }, [isOpen, view, fetchTickets]);

  const handleCreateTicket = async () => {
    const trimmed = createMessage.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/tickets`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('lms-token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subject: trimmed.slice(0, 80) + (trimmed.length > 80 ? '...' : ''),
          category: CATEGORY_OPTIONS.find((c) => c.value === selectedCategory)?.apiCategory || 'General',
          message: trimmed
        })
      });
      const data = await res.json();
      if (data.success && data.ticketId) {
        setCreateMessage('');
        openFloatingTicket?.(data.ticketId, trimmed.slice(0, 50));
        setIsOpen(false); // Close quick support – conversation continues in floating chat window
      } else {
        alert(data.message || 'Failed to create ticket');
      }
    } catch {
      alert('Failed to create ticket');
    } finally {
      setCreating(false);
    }
  };

  const openTicketInFloatingWindow = (t: TicketSummary) => {
    openFloatingTicket?.(t.id, t.subject);
    setIsOpen(false); // Close quick support – open ticket in floating chat window
  };

  return (
    <>
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) setView('list');
        }}
        className="fixed z-40 w-14 h-14 rounded-full bg-[#11CCEF] text-white shadow-lg hover:bg-[#0daed9] flex items-center justify-center"
        style={{ right: 24, bottom: 24, left: 'auto' }}
        title="Quick support – create a ticket only"
        aria-label="Quick support (create ticket)"
      >
        💬
      </button>
      {isOpen && (
        <div
          className="fixed z-40 w-96 max-h-[28rem] bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden flex flex-col"
          style={{ right: 24, bottom: 88, left: 'auto' }}
        >
          <div className="p-4 border-b border-gray-200 bg-[#11CCEF]/10 flex items-center justify-between shrink-0">
            <h3 className="font-semibold text-gray-900">Support</h3>
            <div className="flex gap-1">
              {view === 'create' && (
                <button
                  type="button"
                  onClick={() => setView('list')}
                  className="text-xs px-2 py-1 text-gray-600 hover:bg-gray-200 rounded"
                >
                  ← Back
                </button>
              )}
              <button type="button" onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-gray-700">
                ✕
              </button>
            </div>
          </div>

          {view === 'list' && (
            <div className="flex-1 overflow-y-auto p-2 min-h-0">
              {ticketsLoading ? (
                <p className="text-sm text-gray-500 p-4">Loading...</p>
              ) : tickets.length === 0 ? (
                <div className="p-4">
                  <p className="text-sm text-gray-500 mb-4">No tickets yet. Create one to get help.</p>
                  <button
                    type="button"
                    onClick={() => setView('create')}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-[#11CCEF] to-[#0daed9] text-white rounded-xl text-sm font-semibold hover:from-[#0daed9] hover:to-[#11CCEF] shadow-md hover:shadow-lg transition-all"
                  >
                    <span className="text-base">+</span> New ticket
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-500 px-3 mb-2">Click a ticket to open it in the chat window.</p>
                  <ul className="space-y-1 px-2">
                    {tickets.slice(0, 5).map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => openTicketInFloatingWindow(t)}
                          className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-gray-100 flex items-center justify-between gap-2 transition-colors"
                        >
                          <span className="flex-1 truncate text-sm font-medium text-gray-900">{t.subject}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 shrink-0">{t.status}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => setView('create')}
                    className="mx-3 mt-4 w-[calc(100%-1.5rem)] flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-[#11CCEF] to-[#0daed9] text-white rounded-xl text-sm font-semibold hover:from-[#0daed9] hover:to-[#11CCEF] shadow-md hover:shadow-lg transition-all"
                  >
                    <span className="text-base">+</span> New ticket
                  </button>
                </>
              )}
            </div>
          )}

          {view === 'create' && (
            <>
              <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                <p className="text-sm text-gray-600">Describe your issue. A ticket will be created and the chat window will open.</p>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto flex flex-col p-4 gap-4">
                <div>
                  <p className="text-sm font-semibold text-gray-800 mb-3">What do you need help with?</p>
                  <div className="space-y-2">
                    {CATEGORY_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setSelectedCategory(opt.value)}
                        className={`w-full flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                          selectedCategory === opt.value
                            ? 'border-[#11CCEF] bg-[#11CCEF]/5 shadow-sm'
                            : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <span className="text-xl shrink-0 mt-0.5">{opt.icon}</span>
                        <div className="flex-1 min-w-0">
                          <span className={`block font-semibold text-sm ${selectedCategory === opt.value ? 'text-[#11CCEF]' : 'text-gray-900'}`}>
                            {opt.label}
                          </span>
                          <span className="block text-xs text-gray-500 mt-0.5">{opt.description}</span>
                        </div>
                        {selectedCategory === opt.value && (
                          <span className="shrink-0 w-5 h-5 rounded-full bg-[#11CCEF] flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">Your message</label>
                  <textarea
                    value={createMessage}
                    onChange={(e) => setCreateMessage(e.target.value)}
                    placeholder="Please describe your issue in detail..."
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#11CCEF]/50 focus:border-[#11CCEF]"
                  />
                  <div className="flex gap-3 mt-3">
                    <button
                      type="button"
                      onClick={() => setView('list')}
                      className="px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      My tickets
                    </button>
                    <button
                      onClick={handleCreateTicket}
                      disabled={creating || !createMessage.trim()}
                      className="flex-1 px-4 py-2.5 bg-[#11CCEF] text-white rounded-xl text-sm font-semibold hover:bg-[#0daed9] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {creating ? 'Creating...' : 'Create Ticket'}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
