'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { UserRole } from '@/app/components/types';
import { apiService } from '@/app/services/api';
import { getStoredToken, getStoredUserJson } from '@/app/utils/authStorage';
import type { NativeQuillEditorHandle } from '@/app/components/NativeQuillEditor';
import { showToast } from '@/app/components/Toast';

const LOG_PAGE_SIZE = 20;

const EmailQuillEditor = dynamic(() => import('./EmailQuillEditor'), {
  ssr: false,
  loading: () => <div className="h-[350px] bg-gray-50 animate-pulse rounded" aria-hidden />
});

const CATEGORY_ORDER = ['onboarding', 'notification', 'emergency', 'custom', 'system'] as const;
const CATEGORY_LABEL: Record<string, string> = {
  onboarding: 'Onboarding',
  notification: 'Notification',
  emergency: 'Emergency',
  custom: 'Custom',
  system: 'System'
};

/** Remove scripts / inline handlers so sandboxed iframe srcDoc does not log "Blocked script execution". */
function htmlForSandboxedEmailPreview(html: string): string {
  if (!html || typeof html !== 'string') return html;
  if (typeof document === 'undefined') return html.replace(/<script\b[\s\S]*?<\/script>/gi, '');
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script').forEach((el) => el.remove());
    doc.querySelectorAll('*').forEach((el) => {
      for (const attr of [...el.attributes]) {
        if (/^on[a-z]/i.test(attr.name)) el.removeAttribute(attr.name);
        if (
          (attr.name === 'href' || attr.name === 'src' || attr.name === 'xlink:href') &&
          /^\s*javascript:/i.test(attr.value)
        ) {
          el.removeAttribute(attr.name);
        }
      }
    });
    return doc.documentElement?.outerHTML ?? html;
  } catch {
    return html.replace(/<script\b[\s\S]*?<\/script>/gi, '');
  }
}

type TemplateRow = {
  id: number;
  name: string;
  display_name: string;
  category: string;
  subject: string;
  body: string;
  variables: string | null;
  is_active: number;
  is_system: number;
  updated_at?: string;
  variables_parsed?: { key: string; description?: string }[];
};

export default function AdminEmailsPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [authReady, setAuthReady] = useState(false);
  const [mainTab, setMainTab] = useState<'templates' | 'history'>('templates');
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TemplateRow | null>(null);
  const [draft, setDraft] = useState({
    display_name: '',
    category: 'custom',
    subject: '',
    body: '',
    is_active: true
  });
  const [creatingNew, setCreatingNew] = useState(false);
  const quillRef = useRef<NativeQuillEditorHandle | null>(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewSubject, setPreviewSubject] = useState('');
  const [previewStudentId, setPreviewStudentId] = useState<string>('');

  const [sendOpen, setSendOpen] = useState(false);
  const [sendRecipients, setSendRecipients] = useState<'single' | 'all' | 'course' | 'role'>('single');
  const [sendStudentId, setSendStudentId] = useState('');
  const [sendCourseId, setSendCourseId] = useState('');
  const [sendRoleId, setSendRoleId] = useState('');
  const [additionalMessage, setAdditionalMessage] = useState('');
  const [sendSubjectOverride, setSendSubjectOverride] = useState('');
  const [recipientCount, setRecipientCount] = useState<number | null>(null);

  const [students, setStudents] = useState<{ id: number; name: string; email: string; role_id?: number }[]>([]);
  const [courses, setCourses] = useState<{ id: number; title?: string; name?: string }[]>([]);
  const [roles, setRoles] = useState<{ id: number; name: string }[]>([]);

  const [logs, setLogs] = useState<any[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotalPages, setLogsTotalPages] = useState(1);
  const [logStats, setLogStats] = useState({
    sent_today: 0,
    sent_this_month: 0,
    total_failed: 0,
    total_all: 0
  });
  const [logFilterTemplate, setLogFilterTemplate] = useState('');
  const [logFilterStatus, setLogFilterStatus] = useState('');
  const [logSearch, setLogSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [sentByFilter, setSentByFilter] = useState('');
  const [adminUsers, setAdminUsers] = useState<{ id: number; name: string }[]>([]);
  const [viewingEmail, setViewingEmail] = useState<any>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewModalSmtp, setViewModalSmtp] = useState<{ label: string; email: string } | null>(null);
  const [viewModalLoading, setViewModalLoading] = useState(false);

  useEffect(() => {
    let user: { role?: string } | null = null;
    try {
      const raw = getStoredUserJson();
      user = raw ? JSON.parse(raw) : null;
    } catch {
      user = null;
    }
    setUserRole((user?.role as UserRole) || null);
    setAuthReady(true);
  }, []);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.getEmailTemplates();
      if (res?.success) setTemplates(res.templates || []);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAux = useCallback(async () => {
    try {
      const [st, cr, rl] = await Promise.all([
        apiService.getAllStudents(),
        apiService.getCourses(),
        apiService.getRoles()
      ]);
      if (st?.success) setStudents(st.students || []);
      if (cr?.success) setCourses(cr.courses || []);
      if (rl?.success) setRoles(rl.roles || []);
    } catch {
      /* ignore */
    }
  }, []);

  const loadLogs = useCallback(async () => {
    try {
      const res = await apiService.getEmailLogs({
        page: logsPage,
        limit: LOG_PAGE_SIZE,
        template_id: logFilterTemplate || undefined,
        status: logFilterStatus || undefined,
        search: logSearch || undefined,
        date_filter: dateFilter !== 'all' ? dateFilter : undefined,
        sent_by: sentByFilter || undefined
      });
      if (res?.success) {
        setLogs(res.logs || []);
        setLogsTotal(res.total || 0);
        setLogsTotalPages(res.totalPages ?? 1);
        if (res.stats) {
          setLogStats({
            sent_today: res.stats.sent_today ?? 0,
            sent_this_month: res.stats.sent_this_month ?? 0,
            total_failed: res.stats.total_failed ?? 0,
            total_all: res.stats.total_all ?? 0
          });
        }
      }
    } catch {
      setLogs([]);
    }
  }, [logsPage, logFilterTemplate, logFilterStatus, logSearch, dateFilter, sentByFilter]);

  const loadAdminUsers = useCallback(async () => {
    try {
      const res = await apiService.getUsers(1, 5000);
      if (res?.success && Array.isArray(res.users)) {
        setAdminUsers(
          res.users
            .filter((u: { role_name?: string; role_id?: number }) => u.role_name === 'Admin' || u.role_id === 1)
            .map((u: { id: number; name: string }) => ({ id: u.id, name: u.name }))
        );
      }
    } catch {
      setAdminUsers([]);
    }
  }, []);

  useEffect(() => {
    if (!getStoredToken()) return;
    loadTemplates();
    loadAux();
  }, [loadTemplates, loadAux]);

  useEffect(() => {
    if (mainTab === 'history' && getStoredToken()) {
      loadLogs();
      loadAdminUsers();
    }
  }, [mainTab, loadLogs, loadAdminUsers]);

  const grouped = useMemo(() => {
    const g: Record<string, TemplateRow[]> = {};
    for (const c of CATEGORY_ORDER) g[c] = [];
    for (const t of templates) {
      const cat = CATEGORY_ORDER.includes(t.category as (typeof CATEGORY_ORDER)[number]) ? t.category : 'custom';
      g[cat].push(t);
    }
    return g;
  }, [templates]);

  const selectTemplate = (t: TemplateRow | null, isNew?: boolean) => {
    setCreatingNew(!!isNew);
    if (isNew) {
      setSelected(null);
      setDraft({
        display_name: '',
        category: 'custom',
        subject: '',
        body: '<p></p>',
        is_active: true
      });
      return;
    }
    if (!t) return;
    setSelected(t);
    setDraft({
      display_name: t.display_name,
      category: t.category,
      subject: t.subject,
      body: t.body || '<p></p>',
      is_active: !!t.is_active
    });
  };

  const chips = useMemo(() => {
    const raw = selected?.variables_parsed;
    if (raw && raw.length) return raw;
    try {
      if (selected?.variables) {
        const j = JSON.parse(selected.variables);
        return Array.isArray(j) ? j : [];
      }
    } catch {
      /* ignore */
    }
    return [
      { key: '{{student_name}}', description: 'Student name' },
      { key: '{{student_email}}', description: 'Email' },
      { key: '{{learner_id}}', description: 'Learner ID' },
      { key: '{{lms_url}}', description: 'LMS URL' },
      { key: '{{email_body}}', description: 'Extra body' }
    ];
  }, [selected]);

  const insertChip = (key: string) => {
    const editor = quillRef.current?.getEditor?.();
    if (editor) {
      const range = editor.getSelection(true);
      const idx = range ? range.index : Math.max(0, editor.getLength() - 1);
      editor.insertText(idx, ` ${key} `);
      editor.setSelection(idx + key.length + 2, 0);
    } else {
      setDraft((d) => ({ ...d, body: (d.body || '') + ` ${key} ` }));
    }
  };

  const applyColor = (hex: string) => {
    const editor = quillRef.current?.getEditor?.();
    if (!editor) return;
    editor.focus();
    const range = editor.getSelection(true);
    if (range && range.length > 0) {
      editor.formatText(range.index, range.length, 'color', hex);
    } else {
      editor.format('color', hex);
    }
  };

  const quillModules = useMemo(
    () => ({
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ color: [] }, { background: [] }],
        [{ align: [] }],
        ['link'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['clean']
      ]
    }),
    []
  );

  /** Quill 2: only `list` is registered — `bullet` is a list *value*, not a format name. */
  const quillFormats = useMemo(
    () => [
      'header',
      'bold',
      'italic',
      'underline',
      'strike',
      'color',
      'background',
      'align',
      'link',
      'list'
    ],
    []
  );

  const saveTemplate = async () => {
    if (!draft.display_name.trim() || !draft.subject.trim()) {
      Swal.fire('Missing fields', 'Display name and subject are required.', 'warning');
      return;
    }
    try {
      if (creatingNew) {
        await apiService.createEmailTemplate({
          display_name: draft.display_name.trim(),
          category: draft.category,
          subject: draft.subject.trim(),
          body: draft.body
        });
        Swal.fire('Created', 'Template created', 'success');
        setCreatingNew(false);
      } else if (selected) {
        await apiService.updateEmailTemplate(selected.id, {
          display_name: draft.display_name.trim(),
          category: draft.category,
          subject: draft.subject.trim(),
          body: draft.body,
          is_active: draft.is_active
        });
        Swal.fire('Saved', 'Template saved', 'success');
      }
      await loadTemplates();
    } catch (e) {
      Swal.fire('Error', e instanceof Error ? e.message : 'Save failed', 'error');
    }
  };

  const deleteTemplate = async () => {
    if (!selected || selected.is_system) return;
    const { isConfirmed } = await Swal.fire({
      title: 'Delete template?',
      icon: 'warning',
      showCancelButton: true
    });
    if (!isConfirmed) return;
    try {
      await apiService.deleteEmailTemplate(selected.id);
      Swal.fire('Deleted', '', 'success');
      setSelected(null);
      setCreatingNew(false);
      await loadTemplates();
    } catch (e) {
      Swal.fire('Error', e instanceof Error ? e.message : 'Delete failed', 'error');
    }
  };

  const runPreview = async () => {
    try {
      const res = await apiService.previewEmailTemplate({
        template_id: creatingNew ? undefined : selected?.id,
        subject: draft.subject,
        body: draft.body,
        student_id: previewStudentId ? parseInt(previewStudentId, 10) : undefined
      });
      if (res?.success) {
        setPreviewSubject(res.subject || '');
        setPreviewHtml(res.html || '');
        setPreviewOpen(true);
      }
    } catch {
      Swal.fire('Error', 'Preview failed', 'error');
    }
  };

  const updateRecipientCount = useCallback(async () => {
    try {
      if (sendRecipients === 'single') {
        setRecipientCount(sendStudentId ? 1 : 0);
        return;
      }
      if (sendRecipients === 'all') {
        setRecipientCount(students.length);
        return;
      }
      if (sendRecipients === 'course' && sendCourseId) {
        const res = await apiService.getCourseEnrollments(parseInt(sendCourseId, 10));
        setRecipientCount(res?.enrollments?.length ?? 0);
        return;
      }
      if (sendRecipients === 'role' && sendRoleId) {
        const rId = parseInt(sendRoleId, 10);
        const n = students.filter((s) => s.role_id === rId).length;
        setRecipientCount(n);
        return;
      }
      setRecipientCount(null);
    } catch {
      setRecipientCount(null);
    }
  }, [sendRecipients, sendStudentId, sendCourseId, sendRoleId, students]);

  useEffect(() => {
    updateRecipientCount();
  }, [updateRecipientCount]);

  const openSendModal = () => {
    setSendSubjectOverride(draft.subject);
    setAdditionalMessage('');
    setSendOpen(true);
  };

  const confirmSend = async () => {
    const n = recipientCount ?? 0;
    if (n < 1) {
      Swal.fire('No recipients', 'Choose recipients so at least one user receives the email.', 'warning');
      return;
    }
    const { isConfirmed } = await Swal.fire({
      title: `Send email to ${n} recipient(s)?`,
      text: 'This will send real emails via SMTP.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Send'
    });
    if (!isConfirmed) return;

    const extraMsg = (additionalMessage || '').trim();
    const payload: Record<string, unknown> = {
      recipients: sendRecipients,
      extra_variables: {}
    };
    if (extraMsg) {
      payload.additional_message = extraMsg;
      payload.email_body = extraMsg;
    }
    if (creatingNew || !selected) {
      payload.template_id = null;
      payload.custom_subject = sendSubjectOverride;
      payload.custom_body = draft.body;
    } else {
      payload.template_id = selected.id;
      payload.subject_override = sendSubjectOverride;
    }
    if (sendRecipients === 'single') payload.student_id = parseInt(sendStudentId, 10);
    if (sendRecipients === 'course') payload.course_id = parseInt(sendCourseId, 10);
    if (sendRecipients === 'role') payload.role_id = parseInt(sendRoleId, 10);

    try {
      Swal.fire({ title: 'Sending…', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      const res = await apiService.sendEmail(payload);
      Swal.close();
      if (res?.success) {
        const fail = res.failed || 0;
        const ok = res.sent || 0;
        Swal.fire(
          fail ? 'Completed with errors' : 'Sent',
          `${ok} sent${fail ? `, ${fail} failed` : ''}.`,
          fail ? 'warning' : 'success'
        );
        setSendOpen(false);
        loadLogs();
      }
    } catch (e) {
      Swal.close();
      Swal.fire('Error', e instanceof Error ? e.message : 'Send failed', 'error');
    }
  };

  const categoryBadgeClass = (cat: string) => {
    const c = (cat || '').toLowerCase();
    if (c === 'emergency') return 'bg-orange-100 text-orange-800 border-orange-200';
    if (c === 'onboarding') return 'bg-cyan-100 text-cyan-800 border-cyan-200';
    if (c === 'notification') return 'bg-blue-100 text-blue-800 border-blue-200';
    if (c === 'system') return 'bg-violet-100 text-violet-800 border-violet-200';
    return 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const formatLogDateParts = (iso: string | null | undefined) => {
    if (!iso) return { dateLine: '—', timeLine: '' };
    const d = new Date(iso);
    const dateLine = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeLine = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    return { dateLine, timeLine };
  };

  const truncateSubject = (s: string, max = 52) => {
    const t = String(s || '');
    return t.length <= max ? t : `${t.slice(0, max)}…`;
  };

  const handleViewEmail = async (log: any) => {
    setViewingEmail(log);
    setShowViewModal(true);
    setViewModalSmtp(null);
    setViewModalLoading(true);
    try {
      const res = await apiService.getEmailLogDetail(log.id);
      if (res?.success && res.log) {
        setViewingEmail(res.log);
        if (res.smtp_from) {
          setViewModalSmtp({
            label: res.smtp_from.label || '',
            email: res.smtp_from.email || ''
          });
        }
      }
    } catch {
      showToast('Could not load full email details', 'error');
    } finally {
      setViewModalLoading(false);
    }
  };

  const closeViewModal = () => {
    setShowViewModal(false);
    setViewingEmail(null);
    setViewModalSmtp(null);
    setViewModalLoading(false);
  };

  const handleResendFromModal = async () => {
    if (!viewingEmail?.id) return;
    const email = viewingEmail.sent_to_email || '';
    const { isConfirmed } = await Swal.fire({
      title: 'Resend email?',
      text: `Resend this email to ${email}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Resend'
    });
    if (!isConfirmed) return;
    try {
      await apiService.resendEmailLog(viewingEmail.id);
      showToast('Email resent!', 'success');
      loadLogs();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Resend failed', 'error');
    }
  };

  const copyEmailContent = async () => {
    const html = viewingEmail?.body || '';
    if (!html) {
      showToast('Nothing to copy', 'warning');
      return;
    }
    try {
      const el = document.createElement('div');
      el.innerHTML = html;
      const text = el.innerText || el.textContent || '';
      await navigator.clipboard.writeText(text.trim() || html);
      showToast('Copied to clipboard', 'success');
    } catch {
      showToast('Copy failed', 'error');
    }
  };

  const exportHistoryCSV = () => {
    const headers = ['Date', 'Template', 'To Email', 'To Name', 'Subject', 'Status', 'Sent By'];
    const rows = logs.map((log) => [
      log.sent_at ? new Date(log.sent_at).toLocaleString('en-GB') : '',
      log.template_display_name || log.template_name || 'Custom',
      log.sent_to_email || '',
      log.sent_to_name || '',
      log.subject || '',
      log.status || '',
      log.sent_by_name || ''
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      )
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `email_history_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ProtectedRoute allowedRoles={['Admin']} userRole={userRole} authReady={authReady}>
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
            <button
              type="button"
              onClick={() => router.push('/dashboard/admin')}
              className="text-gray-500 hover:text-gray-700"
              title="Back"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Email Management</h1>
              <p className="text-sm text-gray-500">Templates, broadcasts, and send history</p>
            </div>
          </div>
          <div className="px-4 sm:px-6 lg:px-8 flex gap-1 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setMainTab('templates')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 ${
                mainTab === 'templates' ? 'border-[#11CCEF] text-[#11CCEF]' : 'border-transparent text-gray-500'
              }`}
            >
              Templates &amp; send
            </button>
            <button
              type="button"
              onClick={() => setMainTab('history')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 ${
                mainTab === 'history' ? 'border-[#11CCEF] text-[#11CCEF]' : 'border-transparent text-gray-500'
              }`}
            >
              Send history
            </button>
          </div>
        </div>

        <div className="px-4 sm:px-6 lg:px-8 py-6">
          {mainTab === 'templates' && (
            <div className="flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-220px)]">
              {/* List */}
              <div className="w-full lg:w-[35%] flex-shrink-0 bg-white rounded-xl shadow border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-gray-900">Email templates</h2>
                  <button
                    type="button"
                    onClick={() => selectTemplate(null, true)}
                    className="text-xs font-bold text-white px-3 py-1.5 rounded-lg bg-[#11CCEF] hover:opacity-90"
                  >
                    + New
                  </button>
                </div>
                {loading ? (
                  <p className="text-gray-500 text-sm">Loading…</p>
                ) : (
                  <div className="space-y-4 max-h-[70vh] overflow-y-auto">
                    {CATEGORY_ORDER.map((cat) => {
                      const list = grouped[cat] || [];
                      if (!list.length) return null;
                      return (
                        <div key={cat}>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                            {CATEGORY_LABEL[cat] || cat}
                          </p>
                          <ul className="space-y-2">
                            {list.map((t) => (
                              <li key={t.id}>
                                <button
                                  type="button"
                                  onClick={() => selectTemplate(t)}
                                  className={`w-full text-left rounded-lg border p-3 transition-colors ${
                                    selected?.id === t.id && !creatingNew
                                      ? 'border-[#11CCEF] bg-cyan-50'
                                      : 'border-gray-200 hover:border-gray-300'
                                  }`}
                                >
                                  <div className="font-medium text-gray-900 text-sm">📧 {t.display_name}</div>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    <span
                                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                                        t.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                                      }`}
                                    >
                                      {t.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                    {!!t.is_system && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                                        System
                                      </span>
                                    )}
                                  </div>
                                  {t.updated_at && (
                                    <p className="text-[10px] text-gray-400 mt-1">
                                      Updated {new Date(t.updated_at).toLocaleDateString('en-GB')}
                                    </p>
                                  )}
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Editor */}
              <div className="flex-1 bg-white rounded-xl shadow border border-gray-200 p-4 min-w-0">
                {!selected && !creatingNew ? (
                  <div className="h-64 flex items-center justify-center text-gray-500">
                    Select a template or create a new one.
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2 mb-4">
                      <button
                        type="button"
                        onClick={saveTemplate}
                        className="px-4 py-2 rounded-lg bg-[#11CCEF] text-white text-sm font-semibold"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={runPreview}
                        className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700"
                      >
                        Preview
                      </button>
                      <button
                        type="button"
                        onClick={openSendModal}
                        className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-[#11CCEF] to-[#E51791]"
                      >
                        Send now
                      </button>
                      {selected && !selected.is_system && (
                        <button
                          type="button"
                          onClick={deleteTemplate}
                          className="px-4 py-2 rounded-lg border border-red-200 text-red-600 text-sm font-semibold ml-auto"
                        >
                          Delete
                        </button>
                      )}
                    </div>

                    <div className="grid gap-3 mb-3">
                      <label className="block text-sm">
                        <span className="text-gray-600 font-medium">Display name</span>
                        <input
                          className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                          value={draft.display_name}
                          onChange={(e) => setDraft((d) => ({ ...d, display_name: e.target.value }))}
                          disabled={!!selected?.is_system && false}
                        />
                      </label>
                      <label className="block text-sm">
                        <span className="text-gray-600 font-medium">Category</span>
                        <select
                          className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                          value={draft.category}
                          onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                        >
                          {CATEGORY_ORDER.map((c) => (
                            <option key={c} value={c}>
                              {CATEGORY_LABEL[c]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-sm">
                        <span className="text-gray-600 font-medium">Subject</span>
                        <input
                          className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                          value={draft.subject}
                          onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
                        />
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={draft.is_active}
                          onChange={(e) => setDraft((d) => ({ ...d, is_active: e.target.checked }))}
                        />
                        <span className="text-gray-600">Template active</span>
                      </label>
                    </div>

                    <p className="text-xs text-gray-500 mb-1">Variables — click to insert</p>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {chips.map((c) => (
                        <button
                          key={c.key}
                          type="button"
                          onClick={() => insertChip(c.key)}
                          className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-800"
                          title={c.description}
                        >
                          {c.key}
                        </button>
                      ))}
                    </div>

                    <div className="border rounded-lg overflow-hidden email-template-quill min-h-[400px]">
                      <EmailQuillEditor
                        ref={quillRef}
                        value={draft.body}
                        onChange={(html: string) => setDraft((d) => ({ ...d, body: html }))}
                        modules={quillModules}
                        formats={quillFormats}
                        style={{ height: '350px', marginBottom: '50px' }}
                        placeholder="Write your email content here..."
                      />
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        gap: '8px',
                        marginTop: '8px',
                        alignItems: 'center'
                      }}
                    >
                      <span
                        style={{
                          fontSize: '12px',
                          color: '#64748b',
                          fontWeight: 600
                        }}
                      >
                        Brand Colors:
                      </span>
                      <button
                        type="button"
                        onClick={() => applyColor('#11CCEF')}
                        style={{
                          background: '#11CCEF',
                          width: '24px',
                          height: '24px',
                          borderRadius: '6px',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                        title="Cyan #11CCEF"
                      />
                      <button
                        type="button"
                        onClick={() => applyColor('#E51791')}
                        style={{
                          background: '#E51791',
                          width: '24px',
                          height: '24px',
                          borderRadius: '6px',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                        title="Pink #E51791"
                      />
                      <button
                        type="button"
                        onClick={() => applyColor('#333333')}
                        style={{
                          background: '#333333',
                          width: '24px',
                          height: '24px',
                          borderRadius: '6px',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                        title="Dark #333333"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {mainTab === 'history' && (
            <div className="bg-white rounded-xl shadow border border-gray-200 p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <div
                  className="rounded-xl border-2 p-4 text-center"
                  style={{ background: '#f0fbff', borderColor: '#11CCEF' }}
                >
                  <div className="text-xs font-bold text-gray-600 uppercase tracking-wide">Sent today</div>
                  <div className="text-2xl font-bold text-gray-900 mt-1">{logStats.sent_today}</div>
                </div>
                <div className="rounded-xl border-2 p-4 text-center bg-violet-50 border-violet-200">
                  <div className="text-xs font-bold text-gray-600 uppercase tracking-wide">Sent this month</div>
                  <div className="text-2xl font-bold text-gray-900 mt-1">{logStats.sent_this_month}</div>
                </div>
                <div
                  className={`rounded-xl border-2 p-4 text-center ${
                    logStats.total_failed === 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="text-xs font-bold text-gray-600 uppercase tracking-wide">Failed</div>
                  <div className="text-2xl font-bold text-gray-900 mt-1">{logStats.total_failed}</div>
                </div>
                <div className="rounded-xl border-2 p-4 text-center bg-gray-50 border-gray-200">
                  <div className="text-xs font-bold text-gray-600 uppercase tracking-wide">Total all</div>
                  <div className="text-2xl font-bold text-gray-900 mt-1">{logStats.total_all}</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-4">
                <select
                  className="border rounded-lg px-2 py-1.5 text-sm"
                  value={logFilterTemplate}
                  onChange={(e) => {
                    setLogFilterTemplate(e.target.value);
                    setLogsPage(1);
                  }}
                >
                  <option value="">All templates</option>
                  {templates.map((t) => (
                    <option key={t.id} value={String(t.id)}>
                      {t.display_name}
                    </option>
                  ))}
                </select>
                <select
                  className="border rounded-lg px-2 py-1.5 text-sm"
                  value={logFilterStatus}
                  onChange={(e) => {
                    setLogFilterStatus(e.target.value);
                    setLogsPage(1);
                  }}
                >
                  <option value="">All statuses</option>
                  <option value="sent">Sent</option>
                  <option value="failed">Failed</option>
                  <option value="pending">Pending</option>
                </select>
                <select
                  className="border rounded-lg px-2 py-1.5 text-sm"
                  value={dateFilter}
                  onChange={(e) => {
                    setDateFilter(e.target.value);
                    setLogsPage(1);
                  }}
                >
                  <option value="all">All time</option>
                  <option value="today">Today</option>
                  <option value="week">This week</option>
                  <option value="month">This month</option>
                  <option value="last_month">Last month</option>
                </select>
                <select
                  className="border rounded-lg px-2 py-1.5 text-sm min-w-[140px]"
                  value={sentByFilter}
                  onChange={(e) => {
                    setSentByFilter(e.target.value);
                    setLogsPage(1);
                  }}
                >
                  <option value="">All admins</option>
                  {adminUsers.map((a) => (
                    <option key={a.id} value={String(a.id)}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <input
                  className="border rounded-lg px-2 py-1.5 text-sm flex-1 min-w-[160px]"
                  placeholder="Search email / subject"
                  value={logSearch}
                  onChange={(e) => {
                    setLogSearch(e.target.value);
                    setLogsPage(1);
                  }}
                />
                <button
                  type="button"
                  onClick={() => exportHistoryCSV()}
                  className="text-sm font-semibold text-gray-700 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50"
                >
                  Export CSV
                </button>
                <button
                  type="button"
                  onClick={() => loadLogs()}
                  className="text-sm font-semibold text-[#11CCEF]"
                >
                  Refresh
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="py-2 pr-2">Template</th>
                      <th className="py-2 pr-2">To</th>
                      <th className="py-2 pr-2">Subject</th>
                      <th className="py-2 pr-2">Status</th>
                      <th className="py-2 pr-2">By</th>
                      <th className="py-2 pr-2">Date</th>
                      <th className="py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((row) => {
                      const { dateLine, timeLine } = formatLogDateParts(row.sent_at);
                      const cat = row.template_category || 'custom';
                      return (
                        <tr key={row.id} className="border-b border-gray-100 align-top">
                          <td className="py-2 pr-2">
                            <div className="font-medium text-gray-900">
                              {row.template_display_name || row.template_name || '—'}
                            </div>
                            <span
                              className={`inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${categoryBadgeClass(cat)}`}
                            >
                              {cat}
                            </span>
                          </td>
                          <td className="py-2 pr-2">
                            <div className="font-semibold text-gray-900">{row.sent_to_email}</div>
                            {row.sent_to_name && (
                              <div className="text-xs text-gray-500 mt-0.5">{row.sent_to_name}</div>
                            )}
                          </td>
                          <td className="py-2 pr-2 max-w-[220px]">
                            <span className="line-clamp-2" title={row.subject}>
                              {truncateSubject(row.subject || '', 56)}
                            </span>
                          </td>
                          <td className="py-2 pr-2">
                            {row.status === 'sent' && (
                              <span className="text-xs font-bold px-2 py-0.5 rounded bg-green-100 text-green-800">
                                ✅ sent
                              </span>
                            )}
                            {row.status === 'failed' && (
                              <span
                                className="text-xs font-bold px-2 py-0.5 rounded bg-red-100 text-red-800 cursor-help"
                                title={row.error_message || 'Send failed'}
                              >
                                ❌ failed
                              </span>
                            )}
                            {row.status === 'pending' && (
                              <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                                ⏳ pending
                              </span>
                            )}
                            {!['sent', 'failed', 'pending'].includes(row.status) && (
                              <span className="text-xs font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                                {row.status}
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-2">
                            <div className="font-medium text-gray-900">{row.sent_by_name || '—'}</div>
                            {row.sent_by_role_name && (
                              <div className="text-xs text-gray-500">{row.sent_by_role_name}</div>
                            )}
                          </td>
                          <td className="py-2 pr-2 whitespace-nowrap">
                            <div className="text-gray-900">{dateLine}</div>
                            {timeLine && <div className="text-xs text-gray-500">{timeLine}</div>}
                          </td>
                          <td className="py-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleViewEmail(row)}
                              style={{
                                background: '#f0fbff',
                                color: '#0ea5e9',
                                border: '1px solid #bae6fd',
                                borderRadius: '8px',
                                padding: '5px 14px',
                                fontSize: '12px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px'
                              }}
                            >
                              👁 View
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between items-center mt-4 text-sm text-gray-600">
                <span>
                  Page {logsPage} of {logsTotalPages} — {logsTotal} total
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={logsPage <= 1}
                    onClick={() => setLogsPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1 border rounded-lg disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    disabled={logsPage >= logsTotalPages || logsPage * LOG_PAGE_SIZE >= logsTotal}
                    onClick={() => setLogsPage((p) => p + 1)}
                    className="px-3 py-1 border rounded-lg disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Email history — view detail */}
        {showViewModal && viewingEmail && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
            <div
              className="bg-white rounded-xl shadow-2xl w-full max-w-[700px] max-h-[90vh] flex flex-col overflow-hidden"
              role="dialog"
              aria-modal="true"
              aria-labelledby="email-view-title"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
                <h3 id="email-view-title" className="font-bold text-lg text-gray-900">
                  📧 Email Details
                </h3>
                <button
                  type="button"
                  onClick={closeViewModal}
                  className="text-gray-500 hover:text-gray-800 text-2xl leading-none px-2"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              <div className="p-4 overflow-y-auto flex-1 min-h-0 text-sm space-y-4">
                {viewModalLoading && (
                  <p className="text-gray-500 text-center py-4">Loading full details…</p>
                )}
                <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">From</div>
                  <div className="font-semibold text-gray-900 mt-0.5">
                    {viewModalSmtp?.label || 'Inspire London College'}
                  </div>
                  {viewModalSmtp?.email && (
                    <div className="text-xs text-gray-600 mt-0.5">{viewModalSmtp.email}</div>
                  )}
                  <div className="text-[11px] text-gray-400 mt-1">From server mail configuration (SMTP)</div>
                </div>
                <div className="rounded-lg border border-gray-200 p-3">
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Template</div>
                  <div className="font-semibold text-gray-900 mt-0.5">
                    {viewingEmail.template_display_name || viewingEmail.template_name || '—'}
                  </div>
                  {viewingEmail.template_category && (
                    <span
                      className={`inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${categoryBadgeClass(
                        viewingEmail.template_category
                      )}`}
                    >
                      {viewingEmail.template_category}
                    </span>
                  )}
                </div>
                <div className="rounded-lg border border-gray-200 p-3">
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">To</div>
                  <div className="font-semibold text-gray-900 mt-0.5">{viewingEmail.sent_to_email}</div>
                  {viewingEmail.sent_to_name && (
                    <div className="text-gray-600 mt-0.5">{viewingEmail.sent_to_name}</div>
                  )}
                </div>
                <div className="rounded-lg border border-gray-200 p-3">
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Subject</div>
                  <div className="font-medium text-gray-900 mt-0.5 break-words">{viewingEmail.subject}</div>
                </div>
                <div className="rounded-lg border border-gray-200 p-3">
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Status</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    {viewingEmail.status === 'sent' && (
                      <span className="text-green-700 font-bold">✅ Sent</span>
                    )}
                    {viewingEmail.status === 'failed' && (
                      <span className="text-red-700 font-bold" title={viewingEmail.error_message || ''}>
                        ❌ Failed
                      </span>
                    )}
                    {viewingEmail.status === 'pending' && (
                      <span className="text-amber-700 font-bold">⏳ Pending</span>
                    )}
                    <span className="text-gray-500">
                      •{' '}
                      {viewingEmail.sent_at
                        ? new Date(viewingEmail.sent_at).toLocaleString('en-GB')
                        : '—'}
                    </span>
                  </div>
                  {viewingEmail.status === 'failed' && viewingEmail.error_message && (
                    <p className="text-xs text-red-600 mt-2">{viewingEmail.error_message}</p>
                  )}
                </div>
                <div className="rounded-lg border border-gray-200 p-3">
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Sent by</div>
                  <div className="font-semibold text-gray-900 mt-0.5">
                    {viewingEmail.sent_by_name || '—'}
                    {viewingEmail.sent_by_role_name && (
                      <span className="text-gray-500 font-normal"> ({viewingEmail.sent_by_role_name})</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Email preview
                  </div>
                  <div className="rounded-lg border border-gray-200 overflow-hidden bg-white min-h-[200px]">
                    <iframe
                      title="Email HTML preview"
                      className="w-full min-h-[280px] border-0"
                      sandbox="allow-same-origin"
                      srcDoc={
                        typeof viewingEmail.body === 'string'
                          ? htmlForSandboxedEmailPreview(viewingEmail.body)
                          : '<p class="p-4 text-gray-500">No body stored for this send.</p>'
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 justify-end px-4 py-3 border-t border-gray-200 bg-gray-50 shrink-0">
                <button
                  type="button"
                  onClick={handleResendFromModal}
                  disabled={viewModalLoading || viewingEmail.status === 'pending'}
                  className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-800 hover:bg-white disabled:opacity-40"
                  title={viewingEmail.status === 'pending' ? 'Wait until send completes' : undefined}
                >
                  ↻ Resend to same recipient
                </button>
                <button
                  type="button"
                  onClick={copyEmailContent}
                  className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-800 hover:bg-white"
                >
                  📋 Copy email content
                </button>
                <button
                  type="button"
                  onClick={closeViewModal}
                  className="px-3 py-2 rounded-lg bg-gray-200 text-sm font-semibold text-gray-800 hover:bg-gray-300"
                >
                  ✕ Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Preview modal */}
        {previewOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
              <div className="p-4 border-b flex justify-between items-center">
                <h3 className="font-bold text-lg">Preview</h3>
                <button type="button" onClick={() => setPreviewOpen(false)} className="text-gray-500 text-xl">
                  ×
                </button>
              </div>
              <div className="p-4 border-b">
                <label className="text-sm text-gray-600">Preview as student</label>
                <select
                  className="mt-1 w-full border rounded-lg px-2 py-1 text-sm"
                  value={previewStudentId}
                  onChange={(e) => setPreviewStudentId(e.target.value)}
                >
                  <option value="">Sample data</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.email})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={runPreview}
                  className="mt-2 text-sm font-semibold text-[#11CCEF]"
                >
                  Refresh preview
                </button>
              </div>
              <div className="p-4 flex-1 overflow-hidden flex flex-col min-h-0">
                <p className="text-xs text-gray-500 mb-1 font-semibold">{previewSubject}</p>
                <iframe
                  title="preview"
                  className="flex-1 w-full min-h-[420px] border rounded-lg"
                  sandbox="allow-same-origin"
                  srcDoc={htmlForSandboxedEmailPreview(previewHtml)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Send modal */}
        {sendOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
              <h3 className="font-bold text-lg mb-4">Send email</h3>
              <p className="text-sm text-gray-600 mb-2">
                Template: <strong>{creatingNew ? '(new / custom)' : selected?.display_name}</strong>
              </p>
              <label className="block text-sm mb-2">
                Subject
                <input
                  className="mt-1 w-full border rounded-lg px-2 py-1 text-sm"
                  value={sendSubjectOverride}
                  onChange={(e) => setSendSubjectOverride(e.target.value)}
                />
              </label>
              <div className="space-y-2 mb-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={sendRecipients === 'single'}
                    onChange={() => setSendRecipients('single')}
                  />
                  Single student
                </label>
                {sendRecipients === 'single' && (
                  <select
                    className="w-full border rounded-lg px-2 py-1"
                    value={sendStudentId}
                    onChange={(e) => setSendStudentId(e.target.value)}
                  >
                    <option value="">Select…</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                )}
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={sendRecipients === 'all'}
                    onChange={() => setSendRecipients('all')}
                  />
                  All students
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={sendRecipients === 'course'}
                    onChange={() => setSendRecipients('course')}
                  />
                  Students in course
                </label>
                {sendRecipients === 'course' && (
                  <select
                    className="w-full border rounded-lg px-2 py-1"
                    value={sendCourseId}
                    onChange={(e) => setSendCourseId(e.target.value)}
                  >
                    <option value="">Select course…</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {(c as { title?: string; name?: string }).title || (c as { name?: string }).name || `Course ${c.id}`}
                      </option>
                    ))}
                  </select>
                )}
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={sendRecipients === 'role'}
                    onChange={() => setSendRecipients('role')}
                  />
                  By role
                </label>
                {sendRecipients === 'role' && (
                  <select
                    className="w-full border rounded-lg px-2 py-1"
                    value={sendRoleId}
                    onChange={(e) => setSendRoleId(e.target.value)}
                  >
                    <option value="">Select role…</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <p className="text-sm font-semibold text-gray-700 mb-2">
                Recipients: {recipientCount === null ? '—' : recipientCount}
              </p>
              <label className="block text-sm mb-4">
                Additional message (optional, fills <code className="text-xs">{'{{email_body}}'}</code>)
                <textarea
                  className="mt-1 w-full border rounded-lg px-2 py-1 text-sm min-h-[80px]"
                  value={additionalMessage}
                  onChange={(e) => setAdditionalMessage(e.target.value)}
                />
              </label>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setSendOpen(false)}
                  className="px-4 py-2 rounded-lg border text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmSend}
                  className="px-4 py-2 rounded-lg text-white text-sm font-bold bg-gradient-to-r from-[#11CCEF] to-[#E51791]"
                >
                  Send email
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
