'use client';

import { useState, useEffect } from 'react';
import { apiService } from '@/app/services/api';

const TIME_FILTERS = [
  { id: 'overdue', label: 'Overdue' },
  { id: '1month', label: 'Due in 1 Month' },
  { id: '3months', label: 'Due in 3 Months' },
  { id: 'all', label: 'All Pending' }
];

const REMINDER_STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'not_notified', label: 'Not Notified' },
  { value: 'reminder_sent', label: 'Reminder Sent' },
  { value: 'reminded_multiple', label: 'Already Reminded (Multiple)' }
];

export default function PendingInstallmentsTab() {
  const [stats, setStats] = useState<any>(null);
  const [installments, setInstallments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [timeFilter, setTimeFilter] = useState('all');
  const [reminderStatus, setReminderStatus] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [sending, setSending] = useState(false);
  const [showSendModal, setShowSendModal] = useState<{ single?: any; bulk?: boolean } | null>(null);
  const [sendMethod, setSendMethod] = useState<'dashboard' | 'email' | 'both'>('both');
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateId, setTemplateId] = useState<number | undefined>();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, pendingRes, templatesRes] = await Promise.all([
        apiService.getPendingPaymentsStats(),
        apiService.getPendingPayments({ search, course: courseFilter || undefined, fromDate: fromDate || undefined, toDate: toDate || undefined, timeFilter: timeFilter === 'all' ? undefined : timeFilter, reminderStatus: reminderStatus || undefined }),
        apiService.getPaymentReminderEmailTemplates()
      ]);
      if (statsRes?.success) setStats(statsRes.stats);
      if (pendingRes?.success) setInstallments(pendingRes.installments || []);
      if (templatesRes?.success) setTemplates(templatesRes.templates || []);
    } catch (e) {
      // no-op
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [search, courseFilter, fromDate, toDate, timeFilter, reminderStatus]);

  const formatCurrency = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);
  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-GB') : '-';

  const getDaysOverdue = (inst: any) => {
    if (!inst.due_date) return null;
    const due = new Date(inst.due_date);
    const now = new Date();
    const diff = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : null;
  };

  const getReminderLabel = (inst: any) => {
    const c = inst.reminder_count || 0;
    if (c === 0) return 'Not Notified';
    if (c === 1) return 'Reminder Sent';
    return `Reminded ${c} times`;
  };

  // Replace template variables for email preview (same as backend)
  const replaceVars = (text: string, inst?: any) => {
    if (!text) return '';
    const sample = inst ?? showSendModal?.single ?? (selectedIds.size ? installments.find((i: any) => selectedIds.has(i.id)) : null) ?? installments[0];
    const dueDate = sample?.due_date ? new Date(sample.due_date).toLocaleDateString('en-GB') : '-';
    const daysOverdue = sample?.due_date && new Date(sample.due_date) < new Date()
      ? Math.floor((new Date().getTime() - new Date(sample.due_date).getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    const totalCount = sample?.total_count || 1;
    const amount = parseFloat(sample?.amount || 0);
    const vars: Record<string, string> = {
      studentName: sample?.student_name || 'Student Name',
      courseName: sample?.course_title || 'Course Name',
      installmentNumber: `${sample?.installment_number || 1} of ${totalCount}`,
      amountDue: `£${amount.toFixed(2)}`,
      dueDate,
      totalRemaining: `£${amount.toFixed(2)}`,
      daysOverdue: String(daysOverdue),
      collegeName: 'Inspire London College'
    };
    let result = text;
    for (const [k, v] of Object.entries(vars)) {
      result = result.replace(new RegExp(`{{${k}}}`, 'gi'), v);
    }
    return result;
  };

  const getPreviewTemplate = () => {
    if (templateId && templates.length) {
      const t = templates.find((x: any) => x.id === templateId);
      if (t) return t;
    }
    return templates.find((t: any) => t.is_default) || templates[0] || null;
  };

  const handleSendSingle = async () => {
    if (!showSendModal?.single) return;
    setSending(true);
    try {
      const res = await apiService.sendReminder(showSendModal.single.id, sendMethod, templateId);
      if (res?.success) {
        setShowSendModal(null);
        fetchData();
      }
    } finally {
      setSending(false);
    }
  };

  const handleSendBulk = async () => {
    if (selectedIds.size === 0) return;
    setSending(true);
    try {
      const res = await apiService.sendBulkReminders(Array.from(selectedIds), sendMethod, templateId);
      if (res?.success) {
        setSelectedIds(new Set());
        setShowSendModal(null);
        fetchData();
      }
    } finally {
      setSending(false);
    }
  };

  const uniqueCourses = [...new Set(installments.map((i: any) => i.course_title))].filter(Boolean).sort();

  return (
    <div className="space-y-4">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-xs font-semibold text-gray-500 uppercase">Total Pending Students</div>
            <div className="text-2xl font-bold text-gray-900">{stats.total_pending_students}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-xs font-semibold text-gray-500 uppercase">Total Pending Amount</div>
            <div className="text-2xl font-bold text-amber-600">{formatCurrency(stats.total_pending_amount)}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-red-200">
            <div className="text-xs font-semibold text-red-600 uppercase">Overdue Students</div>
            <div className="text-2xl font-bold text-red-700">{stats.overdue_students}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-red-200">
            <div className="text-xs font-semibold text-red-600 uppercase">Overdue Amount</div>
            <div className="text-2xl font-bold text-red-700">{formatCurrency(stats.overdue_amount)}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-xs font-semibold text-gray-500 uppercase">Reminders Today</div>
            <div className="text-2xl font-bold text-blue-600">{stats.reminders_sent_today}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-xs font-semibold text-gray-500 uppercase">Reminders This Month</div>
            <div className="text-2xl font-bold text-blue-600">{stats.reminders_sent_this_month}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-4">
        <div className="flex flex-wrap gap-2">
          {TIME_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setTimeFilter(f.id)}
              className={`px-4 py-2 rounded-lg font-medium text-sm ${timeFilter === f.id ? 'bg-[#11CCEF] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="Search student, email, course..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          />
          <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg">
            <option value="">All Courses</option>
            {uniqueCourses.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg" />
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg" />
        </div>
        <div className="flex gap-4 items-center">
          <select value={reminderStatus} onChange={(e) => setReminderStatus(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg">
            {REMINDER_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {selectedIds.size > 0 && (
            <button onClick={() => setShowSendModal({ bulk: true })} className="px-4 py-2 bg-[#11CCEF] text-white rounded-lg font-medium">
              Send Bulk Reminder ({selectedIds.size})
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : installments.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No pending installments found</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input type="checkbox" checked={selectedIds.size === installments.length} onChange={(e) => setSelectedIds(e.target.checked ? new Set(installments.map((i: any) => i.id)) : new Set())} />
                </th>
                <th className="px-4 py-3 text-left font-semibold">Student</th>
                <th className="px-4 py-3 text-left font-semibold">Course</th>
                <th className="px-4 py-3 text-left font-semibold">Installment</th>
                <th className="px-4 py-3 text-left font-semibold">Amount Due</th>
                <th className="px-4 py-3 text-left font-semibold">Due Date</th>
                <th className="px-4 py-3 text-left font-semibold">Days Overdue</th>
                <th className="px-4 py-3 text-left font-semibold">Reminder Status</th>
                <th className="px-4 py-3 text-left font-semibold">Last Reminder</th>
                <th className="px-4 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {installments.map((inst: any) => {
                const daysOverdue = getDaysOverdue(inst);
                return (
                  <tr key={inst.id} className="border-t border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selectedIds.has(inst.id)} onChange={(e) => setSelectedIds((s) => { const n = new Set(s); if (e.target.checked) n.add(inst.id); else n.delete(inst.id); return n; })} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{inst.student_name}</div>
                      <div className="text-xs text-gray-500">{inst.student_email}</div>
                    </td>
                    <td className="px-4 py-3">{inst.course_title}</td>
                    <td className="px-4 py-3">
                      {inst.is_deposit === 1 ? (
                        <span style={{
                          background: '#fef3c7',
                          color: '#92400e',
                          borderRadius: '6px',
                          padding: '2px 8px',
                          fontSize: '11px',
                          fontWeight: '700'
                        }}>
                          💰 Deposit
                        </span>
                      ) : (
                        <span>
                          Instalment {inst.installment_number - 1}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">{formatCurrency(inst.amount)}</td>
                    <td className="px-4 py-3">{formatDate(inst.due_date)}</td>
                    <td className="px-4 py-3">{daysOverdue != null ? `${daysOverdue} days` : '-'}</td>
                    <td className="px-4 py-3">{getReminderLabel(inst)}</td>
                    <td className="px-4 py-3">{inst.last_reminder_at ? new Date(inst.last_reminder_at).toLocaleString() : '-'}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => setShowSendModal({ single: inst })} className="text-[#11CCEF] hover:underline font-medium">Send Reminder</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Send Modal */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => !sending && setShowSendModal(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Send Payment Reminder</h3>
            {showSendModal.single && (
              <p className="text-gray-600 mb-4">
                Send reminder to {showSendModal.single.student_name} for {showSendModal.single.course_title} – Installment {showSendModal.single.installment_number} of {formatCurrency(showSendModal.single.amount)}?
              </p>
            )}
            {showSendModal.bulk && (
              <p className="text-gray-600 mb-4">You are about to send reminders to {selectedIds.size} students. Continue?</p>
            )}
            <div className="space-y-3 mb-4">
              <label className="block font-medium">Method</label>
              <div className="flex gap-4">
                {(['dashboard', 'email', 'both'] as const).map((m) => (
                  <label key={m} className="flex items-center gap-2">
                    <input type="radio" name="method" checked={sendMethod === m} onChange={() => setSendMethod(m)} />
                    {m === 'both' ? 'Send Both' : m === 'dashboard' ? 'Dashboard Only' : 'Email Only'}
                  </label>
                ))}
              </div>
              <div>
                <label className="block font-medium">Email Template (from Settings tab – fully editable)</label>
                {templates.length > 0 ? (
                  <select value={templateId ?? ''} onChange={(e) => setTemplateId(e.target.value ? parseInt(e.target.value, 10) : undefined)} className="w-full px-4 py-2 border rounded-lg mt-1">
                    <option value="">Use default template</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}{t.is_default ? ' (Default)' : ''}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-amber-600 text-sm mt-1">No templates yet. Create one in the Settings tab first.</p>
                )}
              </div>
              {(sendMethod === 'email' || sendMethod === 'both') && getPreviewTemplate() && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Email preview (what will be sent)</div>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium text-gray-600">Subject: </span>
                      <span className="text-gray-900">{replaceVars(getPreviewTemplate()!.subject, showSendModal.single)}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600 block mb-1">Body:</span>
                      <div className="text-gray-800 whitespace-pre-wrap bg-white p-3 rounded border border-gray-200 max-h-40 overflow-y-auto">
                        {replaceVars(getPreviewTemplate()!.body, showSendModal.single)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowSendModal(null)} className="px-4 py-2 bg-gray-200 rounded-lg">Cancel</button>
              <button onClick={showSendModal.single ? handleSendSingle : handleSendBulk} disabled={sending} className="px-4 py-2 bg-[#11CCEF] text-white rounded-lg font-medium disabled:opacity-50">
                {sending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
