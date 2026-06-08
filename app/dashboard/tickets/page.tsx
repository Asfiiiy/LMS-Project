'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getApiUrl } from '@/app/utils/apiUrl';
import Link from 'next/link';
import { User } from '@/app/components/types';
import StudentAcademicProgressModal from '@/app/components/StudentAcademicProgressModal';
import StudentFinancePaymentsModal from '@/app/components/StudentFinancePaymentsModal';
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

const DEPARTMENT_COLORS: Record<string, string> = {
  'Academic': '#11CCEF',
  'Finance': '#E51791',
  'Support': '#61CE70'
};

function TicketsDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const department = searchParams.get('department') || '';
  const statusFilter = searchParams.get('status') || '';
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState({ open: 0, inProgress: 0, escalated: 0, resolvedToday: 0 });
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [academicModal, setAcademicModal] = useState<{ studentId: number; studentName: string } | null>(null);
  const [financeModal, setFinanceModal] = useState<{ studentId: number; studentName: string } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  useEffect(() => {
    const u: User | null = JSON.parse(localStorage.getItem('lms-user') || 'null');
    setUser(u);
    if (!u) router.push('/login');
  }, [router]);

  useEffect(() => {
    if (user) {
      fetchStats();
      fetchTickets();
      if (['Operation Manager', 'Accounts Manager', 'Administrative Manager', 'Admission Manager'].includes(user.role || '')) {
        fetchTeamMembers();
      }
    }
  }, [user, department, statusFilter, page]);

  useEffect(() => {
    const handler = () => {
      if (user) {
        fetchStats();
        fetchTickets();
      }
    };
    window.addEventListener('ticket_updated', handler);
    return () => window.removeEventListener('ticket_updated', handler);
  }, [user]);

  const fetchStats = async () => {
    try {
      const res = await fetch(`${getApiUrl()}/api/tickets/stats`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('lms-token')}` }
      });
      const data = await res.json();
      if (data.success) setStats(data.stats);
    } catch (e) {
    }
  };

  const fetchTeamMembers = async () => {
    try {
      const res = await fetch(`${getApiUrl()}/api/tickets/team`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('lms-token')}` }
      });
      const data = await res.json();
      if (data.success && data.team) {
        const mapped = data.team.map((m: any) => ({
          id: m.id,
          name: m.name,
          role: m.role_name || 'Team Member',
          avatar: (m.name || '')
            .split(' ')
            .map((s: string) => s[0])
            .join('')
            .toUpperCase()
            .slice(0, 2) || '?',
          status: m.status || 'offline',
          email: m.email
        }));
        setTeamMembers(mapped);
      } else {
        setTeamMembers([]);
      }
    } catch (e) {
      setTeamMembers([]);
    }
  };

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (department) q.set('department', department);
      if (statusFilter) q.set('status', statusFilter);
      q.set('page', String(page));
      q.set('limit', '25');
      const res = await fetch(`${getApiUrl()}/api/tickets?${q}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('lms-token')}` }
      });
      const data = await res.json();
      if (data.success) {
        setTickets(data.tickets || []);
        setPagination(data.pagination || { total: 0, totalPages: 1 });
      }
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  const isStudent = ['Student', 'ManagerStudent', 'InstituteStudent'].includes(user.role || '');
  const canSeeTeam = ['Operation Manager', 'Accounts Manager', 'Administrative Manager', 'Admission Manager'].includes(user.role || '');

  // Welcome message for Operation Manager
  const WelcomeBanner = () => (
    <div className="mb-8 bg-gradient-to-r from-[#11CCEF] to-[#E51791] rounded-2xl p-6 text-white shadow-lg">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">
            Welcome back, {user?.name}! 👋
          </h2>
          <p className="text-white/90">Here's your team's performance overview</p>
        </div>
        {canSeeTeam && teamMembers.length > 0 && (
          <div className="flex -space-x-2">
            {teamMembers.slice(0, 4).map((member, idx) => (
              <div
                key={member.id}
                className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white font-semibold border-2 border-white"
                title={`${member.name} (${member.role})`}
              >
                {member.avatar}
              </div>
            ))}
          </div>
        )}
      </div>
      
      {canSeeTeam && (
        <div className="mt-4 flex flex-wrap gap-4">
          <div className="bg-white/10 backdrop-blur rounded-lg px-4 py-2">
            <p className="text-sm text-white/80">Team Members Online</p>
            <p className="text-xl font-semibold">{teamMembers.filter(m => m.status === 'online').length}/{teamMembers.length}</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg px-4 py-2">
            <p className="text-sm text-white/80">Active Tickets</p>
            <p className="text-xl font-semibold">{stats.open + stats.inProgress}</p>
          </div>
        </div>
      )}
    </div>
  );

  // Team members section for managers with team access
  const TeamMembersSection = () => {
    if (!canSeeTeam) return null;
    
    return (
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Your Team Members</h3>
          <Link
            href="/dashboard/tickets/team"
            className="text-sm text-[#11CCEF] hover:text-[#E51791] font-medium transition-colors"
          >
            Manage Team →
          </Link>
        </div>
        {teamMembers.length === 0 ? (
          <div className="bg-gray-50 rounded-xl p-6 text-center border border-gray-200">
            <p className="text-gray-600">No team members yet.</p>
            <Link href="/dashboard/tickets/team" className="mt-2 inline-block text-[#11CCEF] hover:text-[#E51791] font-medium">
              Add team members →
            </Link>
          </div>
        ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {teamMembers.map((member) => (
            <div key={member.id} className="bg-white rounded-xl p-4 border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#11CCEF] to-[#E51791] flex items-center justify-center text-white font-semibold">
                    {member.avatar}
                  </div>
                  <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                    member.status === 'online' ? 'bg-green-500' : 
                    member.status === 'busy' ? 'bg-yellow-500' : 'bg-gray-400'
                  }`}></span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">{member.name}</p>
                  <p className="text-xs text-gray-500">{member.role}</p>
                  <p className="text-xs mt-1">
                    <span className={`inline-block w-2 h-2 rounded-full mr-1 ${
                      member.status === 'online' ? 'bg-green-500' : 
                      member.status === 'busy' ? 'bg-yellow-500' : 'bg-gray-400'
                    }`}></span>
                    {member.status.charAt(0).toUpperCase() + member.status.slice(1)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
        )}
      </div>
    );
  };

  if (isStudent) {
    return (
      <div className="p-6">
        <WelcomeBanner />
        
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-[#11CCEF] to-[#E51791] bg-clip-text text-transparent">
            My Support Tickets
          </h1>
          <Link
            href="/dashboard/tickets/new"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#11CCEF] to-[#E51791] text-white rounded-xl font-semibold hover:shadow-lg transform hover:scale-105 transition-all duration-200"
          >
            <span className="text-xl">➕</span> Create New Ticket
          </Link>
        </div>
        
        <div className="mb-6">
          <Link href="/dashboard/student" className="text-[#11CCEF] hover:text-[#E51791] transition-colors font-medium inline-flex items-center gap-1">
            <FiChevronLeft /> Back to Dashboard
          </Link>
        </div>

        {/* Stats for students with new design */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Open', value: stats.open, color: 'yellow', icon: FiClock },
            { label: 'In Progress', value: stats.inProgress, color: 'blue', icon: FiTrendingUp },
            { label: 'Escalated', value: stats.escalated, color: 'red', icon: FiAlertCircle },
            { label: 'Resolved', value: stats.resolvedToday, color: 'green', icon: FiCheckCircle }
          ].map((stat) => (
            <div key={stat.label} className={`bg-${stat.color}-50 border border-${stat.color}-200 rounded-xl p-4 hover:shadow-md transition-shadow`}>
              <div className="flex items-center justify-between">
                <p className={`text-sm font-medium text-${stat.color}-800`}>{stat.label}</p>
                <stat.icon className={`w-5 h-5 text-${stat.color}-600`} />
              </div>
              <p className={`text-2xl font-bold text-${stat.color}-900 mt-2`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Ticket list for students with new design */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#11CCEF] mx-auto"></div>
              <p className="text-gray-500 mt-4">Loading your tickets...</p>
            </div>
          ) : tickets.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">🎫</div>
              <p className="text-gray-600 mb-6">You have no support tickets yet.</p>
              <Link
                href="/dashboard/tickets/new"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#11CCEF] to-[#E51791] text-white rounded-xl font-semibold hover:shadow-lg transition-all"
              >
                <span className="text-xl">➕</span> Create Your First Ticket
              </Link>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">ID</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Subject</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Department</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Created</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {tickets.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50 transition-colors group">
                        <td className="px-6 py-4 text-sm font-medium text-[#11CCEF]">#{t.id}</td>
                        <td className="px-6 py-4 text-sm text-gray-900 max-w-[200px] truncate">{t.subject}</td>
                        <td className="px-6 py-4">
                          <span 
                            className="px-3 py-1 rounded-full text-xs font-medium text-white shadow-sm"
                            style={{ 
                              backgroundColor: DEPARTMENT_COLORS[t.department_name] || t.department_color,
                            }}
                          >
                            {t.department_name}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[t.status]?.bg} ${STATUS_COLORS[t.status]?.text}`}>
                            {STATUS_COLORS[t.status]?.label || t.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          <div className="flex items-center gap-1" title={new Date(t.created_at).toLocaleString()}>
                            <FiCalendar className="w-4 h-4 flex-shrink-0" />
                            {new Date(t.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link
                            href={`/dashboard/tickets/${t.id}`}
                            className="inline-flex items-center gap-1 text-[#11CCEF] hover:text-[#E51791] transition-colors font-medium group-hover:underline"
                          >
                            View <FiEye className="w-4 h-4" />
                          </Link>
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
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="px-4 py-2 border rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors flex items-center gap-1"
                    >
                      <FiChevronLeft /> Previous
                    </button>
                    <button
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

  return (
    <div className="p-6">
      <WelcomeBanner />
      <TeamMembersSection />

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-[#11CCEF] to-[#E51791] bg-clip-text text-transparent">
          Ticket Dashboard
        </h1>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <FiFilter className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          Filters
        </button>
      </div>

      {/* Stats Cards with new design */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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

      {/* Filters with new design */}
      {showFilters && (
        <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200 animate-fadeIn">
          <div className="flex flex-wrap gap-4">
            <select
              value={statusFilter}
              onChange={(e) => router.push(`/dashboard/tickets?${department ? `department=${department}&` : ''}status=${e.target.value}`)}
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

      {/* Ticket List with new design */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#11CCEF] mx-auto"></div>
            <p className="text-gray-500 mt-4">Loading tickets...</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-6xl mb-4">🎫</div>
            <p className="text-gray-600">No tickets found.</p>
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
                        <div
                          className={`flex items-center gap-2 cursor-pointer ${(t.department_id === 1 || t.department_id === 2) ? 'text-[#11CCEF] hover:text-[#E51791]' : 'text-gray-900'}`}
                          onClick={() => {
                            if (t.department_id === 1 && t.student_id) {
                              setAcademicModal({ studentId: t.student_id, studentName: t.student_name || 'Student' });
                            } else if (t.department_id === 2 && t.student_id) {
                              setFinanceModal({ studentId: t.student_id, studentName: t.student_name || 'Student' });
                            }
                          }}
                        >
                          <FiUser className="w-4 h-4" />
                          <div>
                            <div className="font-medium">{t.student_name}</div>
                            <div className="text-xs text-gray-500 flex items-center gap-1">
                              <FiMail className="w-3 h-3" /> {t.student_email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-[200px] truncate">{t.subject}</td>
                      <td className="px-6 py-4">
                        <span 
                          className="px-3 py-1 rounded-full text-xs font-medium text-white shadow-sm"
                          style={{ 
                            backgroundColor: DEPARTMENT_COLORS[t.department_name] || t.department_color,
                          }}
                        >
                          {t.department_name}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[t.status]?.bg} ${STATUS_COLORS[t.status]?.text}`}>
                          {STATUS_COLORS[t.status]?.label || t.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <FiBriefcase className="w-4 h-4" />
                          {t.assigned_to_name || '—'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1" title={new Date(t.created_at).toLocaleString()}>
                          <FiCalendar className="w-4 h-4 flex-shrink-0" />
                          {new Date(t.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {t.status === 'transferred' && (
                            <Link
                              href={`/dashboard/tickets/${t.id}?transfer=1`}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Transfer to another department"
                            >
                              <FiArrowRightCircle className="w-4 h-4" /> Transfer
                            </Link>
                          )}
                          <Link
                            href={`/dashboard/tickets/${t.id}`}
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
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-4 py-2 border rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors flex items-center gap-1"
                  >
                    <FiChevronLeft /> Previous
                  </button>
                  <button
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

      {academicModal && (
        <StudentAcademicProgressModal
          studentId={academicModal.studentId}
          studentName={academicModal.studentName}
          onClose={() => setAcademicModal(null)}
        />
      )}

      {financeModal && (
        <StudentFinancePaymentsModal
          studentId={financeModal.studentId}
          studentName={financeModal.studentName}
          onClose={() => setFinanceModal(null)}
        />
      )}
    </div>
  );
}

export default function TicketsDashboardPage() {
  return (
    <Suspense fallback={<div className="p-6 flex items-center justify-center min-h-[300px]"><p className="text-gray-500">Loading...</p></div>}>
      <TicketsDashboardContent />
    </Suspense>
  );
}