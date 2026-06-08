'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getApiUrl } from '@/app/utils/apiUrl';
import {
  FiClock,
  FiCheckCircle,
  FiAlertCircle,
  FiTrendingUp,
  FiFilter,
  FiChevronLeft,
  FiChevronRight,
  FiEye,
  FiUser,
  FiMail,
  FiCalendar,
  FiBriefcase,
  FiArrowRightCircle,
  FiExternalLink
} from 'react-icons/fi';

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  open: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: '🟡 Open' },
  in_progress: { bg: 'bg-blue-100', text: 'text-blue-800', label: '🔵 In Progress' },
  transferred: { bg: 'bg-indigo-100', text: 'text-indigo-800', label: '🔄 Transferred' },
  escalated: { bg: 'bg-red-100', text: 'text-red-800', label: '🔴 Escalated' },
  resolved: { bg: 'bg-green-100', text: 'text-green-800', label: '🟢 Resolved' }
};

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-amber-100 text-amber-800',
  medium: 'bg-blue-100 text-blue-800',
  low: 'bg-gray-100 text-gray-700'
};

const DEPARTMENT_COLORS: Record<string, string> = {
  Academic: '#11CCEF',
  Finance: '#E51791',
  Support: '#61CE70'
};

export default function CertificateQueriesView() {
  const [userName, setUserName] = useState<string>('');
  const [stats, setStats] = useState({ open: 0, inProgress: 0, escalated: 0, resolvedToday: 0 });
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [statusFilter, setStatusFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const fetchStats = async () => {
    try {
      const res = await fetch(`${getApiUrl()}/api/tickets/stats`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('lms-token')}` }
      });
      const data = await res.json();
      if (data.success) setStats(data.stats);
    } catch (e) {
      // no-op
    }
  };

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      q.set('page', String(page));
      q.set('limit', '25');
      if (statusFilter) q.set('status', statusFilter);
      const res = await fetch(`${getApiUrl()}/api/tickets?${q}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('lms-token')}` }
      });
      const data = await res.json();
      if (data.success) {
        setTickets(data.tickets || []);
        setPagination(data.pagination || { total: 0, totalPages: 1 });
      }
    } catch (e) {
      // no-op
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const u = localStorage.getItem('lms-user');
    if (u) {
      try {
        const user = JSON.parse(u);
        setUserName(user?.name || '');
      } catch {
        setUserName('');
      }
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchTickets();
  }, [page, statusFilter]);

  useEffect(() => {
    const handler = () => {
      fetchStats();
      fetchTickets();
    };
    window.addEventListener('ticket_updated', handler);
    return () => window.removeEventListener('ticket_updated', handler);
  }, []);

  return (
    <div className="p-6 space-y-8">
      {/* Welcome banner – same style as Operation Manager */}
      <div className="bg-gradient-to-r from-[#11CCEF] to-[#E51791] rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">
              Welcome back, {userName || 'Certificate Manager'}! 👋
            </h2>
            <p className="text-white/90">Certificate-related queries and chat</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-4">
          <div className="bg-white/10 backdrop-blur rounded-lg px-4 py-2">
            <p className="text-sm text-white/80">Active Tickets</p>
            <p className="text-xl font-semibold">{stats.open + stats.inProgress}</p>
          </div>
        </div>
      </div>

      {/* Ticket Dashboard heading + filters – same as Operation Manager */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-[#11CCEF] to-[#E51791] bg-clip-text text-transparent">
          Ticket Dashboard
        </h1>
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <FiFilter className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          Filters
        </button>
      </div>

      {/* Stats cards – same as Operation Manager */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Open', value: stats.open, color: 'yellow', icon: FiClock, bg: 'from-yellow-400 to-yellow-600' },
          { label: 'In Progress', value: stats.inProgress, color: 'blue', icon: FiTrendingUp, bg: 'from-blue-400 to-blue-600' },
          { label: 'Escalated', value: stats.escalated, color: 'red', icon: FiAlertCircle, bg: 'from-red-400 to-red-600' },
          { label: 'Resolved Today', value: stats.resolvedToday, color: 'green', icon: FiCheckCircle, bg: 'from-green-400 to-green-600' }
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-all transform hover:-translate-y-1">
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.bg} flex items-center justify-center text-white`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <span className="text-3xl font-bold text-gray-900">{stat.value}</span>
            </div>
            <p className="text-sm font-medium text-gray-600">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
          <div className="flex flex-wrap gap-4">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#11CCEF] focus:border-transparent"
            >
              <option value="">All Status</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="transferred">Transferred</option>
              <option value="escalated">Escalated</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>
      )}

      {/* Ticket table – same columns and layout as Operation Manager */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#11CCEF] mx-auto" />
            <p className="text-gray-500 mt-4">Loading tickets...</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-6xl mb-4">🎫</div>
            <p className="text-gray-600">No certificate-related tickets yet.</p>
            <p className="text-sm text-gray-500 mt-1">When students raise a ticket with category &quot;Certificate&quot;, they will appear here.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Student</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Subject</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Department</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Priority</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Assigned To</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Created</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {tickets.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-6 py-4 text-sm font-medium text-[#11CCEF]">#{t.id}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-gray-900">
                          <FiUser className="w-4 h-4 flex-shrink-0" />
                          <div>
                            <div className="font-medium">{t.student_name || '—'}</div>
                            <div className="text-xs text-gray-500 flex items-center gap-1">
                              <FiMail className="w-3 h-3" /> {t.student_email || '—'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-[200px] truncate">{t.subject || '—'}</td>
                      <td className="px-6 py-4">
                        <span
                          className="px-3 py-1 rounded-full text-xs font-medium text-white shadow-sm"
                          style={{
                            backgroundColor: DEPARTMENT_COLORS[t.department_name] || t.department_color || '#6B7280'
                          }}
                        >
                          {t.department_name || '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${PRIORITY_COLORS[t.priority] || 'bg-gray-100 text-gray-700'}`}>
                          {(t.priority || 'medium').replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[t.status]?.bg || 'bg-gray-100'} ${STATUS_COLORS[t.status]?.text || 'text-gray-800'}`}>
                          {STATUS_COLORS[t.status]?.label || (t.status || '').replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <FiBriefcase className="w-4 h-4 flex-shrink-0" />
                          {t.assigned_to_name || '—'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1" title={t.created_at ? new Date(t.created_at).toLocaleString() : ''}>
                          <FiCalendar className="w-4 h-4 flex-shrink-0" />
                          {t.created_at ? new Date(t.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {t.status === 'transferred' && (
                            <Link
                              href={`/dashboard/tickets/${t.id}?transfer=1&from=certificate-manager`}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Transfer to another department"
                            >
                              <FiArrowRightCircle className="w-4 h-4" /> Transfer
                            </Link>
                          )}
                          <Link
                            href={`/dashboard/tickets/${t.id}?from=certificate-manager`}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-[#11CCEF] hover:text-[#E51791] hover:bg-[#11CCEF]/10 rounded-lg transition-colors"
                            title="Open ticket"
                          >
                            <FiExternalLink className="w-4 h-4" /> Open
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pagination.totalPages > 1 && (
              <div className="px-6 py-4 flex justify-between items-center border-t bg-gray-50">
                <p className="text-sm text-gray-600">Page {page} of {pagination.totalPages}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-4 py-2 border rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors flex items-center gap-1"
                  >
                    <FiChevronLeft /> Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                    disabled={page >= pagination.totalPages}
                    className="px-4 py-2 border rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors flex items-center gap-1"
                  >
                    Next <FiChevronRight />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
