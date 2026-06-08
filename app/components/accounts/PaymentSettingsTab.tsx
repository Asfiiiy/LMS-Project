'use client';

import { useState, useEffect } from 'react';
import { apiService } from '@/app/services/api';
import Swal from 'sweetalert2';

export default function PaymentSettingsTab() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<any | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', subject: '', body: '', is_default: false });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tRes, sRes] = await Promise.all([
        apiService.getPaymentReminderEmailTemplates(),
        apiService.getAutoReminderSettings()
      ]);
      if (tRes?.success) setTemplates(tRes.templates || []);
      if (sRes?.success) setSettings(sRes.settings || {});
    } catch (e) {
      // no-op
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveTemplate = async () => {
    try {
      if (editingTemplate) {
        await apiService.updatePaymentReminderEmailTemplate(editingTemplate.id, form);
        Swal.fire('Updated', 'Template updated successfully', 'success');
      } else {
        await apiService.createPaymentReminderEmailTemplate(form);
        Swal.fire('Created', 'Template created successfully', 'success');
      }
      setEditingTemplate(null);
      setShowCreate(false);
      setForm({ name: '', subject: '', body: '', is_default: false });
      fetchData();
    } catch (e) {
      Swal.fire('Error', 'Failed to save template', 'error');
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    const { isConfirmed } = await Swal.fire({ title: 'Delete?', text: 'Are you sure?', showCancelButton: true });
    if (!isConfirmed) return;
    try {
      await apiService.deletePaymentReminderEmailTemplate(id);
      Swal.fire('Deleted', 'Template deleted', 'success');
      fetchData();
    } catch (e) {
      Swal.fire('Error', (e instanceof Error ? e.message : null) || 'Cannot delete default template', 'error');
    }
  };

  const handleSaveSettings = async () => {
    try {
      await apiService.updateAutoReminderSettings({
        is_enabled: settings?.is_enabled ?? false,
        interval_hours: settings?.interval_hours ?? 24
      });
      Swal.fire('Saved', 'Auto-reminder settings updated', 'success');
      fetchData();
    } catch (e) {
      Swal.fire('Error', 'Failed to save settings', 'error');
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading...</div>;

  return (
    <div className="space-y-8">
      {/* Auto-reminder settings */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h2 className="text-lg font-bold mb-4">Auto-Reminder Settings</h2>
        <p className="text-sm text-gray-600 mb-4">Automatically send payment reminders for overdue installments.</p>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!(settings?.is_enabled === 1 || settings?.is_enabled === true)}
              onChange={(e) => setSettings((s: any) => ({ ...s, is_enabled: e.target.checked ? 1 : 0 }))}
            />
            Enable auto-reminder
          </label>
          <div className="flex items-center gap-2">
            <label>Interval:</label>
            <select
              value={settings?.interval_hours ?? 24}
              onChange={(e) => setSettings((s: any) => ({ ...s, interval_hours: parseInt(e.target.value, 10) }))}
              className="px-3 py-2 border rounded-lg"
            >
              <option value={24}>24 hours</option>
              <option value={48}>48 hours</option>
              <option value={72}>72 hours</option>
              <option value={168}>Weekly</option>
            </select>
          </div>
          <button onClick={handleSaveSettings} className="px-4 py-2 bg-[#11CCEF] text-white rounded-lg font-medium">
            Save Settings
          </button>
        </div>
      </div>

      {/* Email templates */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Email Templates</h2>
          <button onClick={() => { setShowCreate(true); setEditingTemplate(null); setForm({ name: '', subject: '', body: '', is_default: false }); }} className="px-4 py-2 bg-[#11CCEF] text-white rounded-lg font-medium text-sm">
            Create Template
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          These templates are used for all payment reminder emails (manual send, bulk send, and auto-reminder). Edit anytime – changes apply immediately.
        </p>
        <p className="text-sm text-gray-500 mb-4">Variables: {'{{studentName}}'} {'{{courseName}}'} {'{{installmentNumber}}'} {'{{amountDue}}'} {'{{dueDate}}'} {'{{totalRemaining}}'} {'{{daysOverdue}}'} {'{{collegeName}}'}</p>
        <div className="space-y-2">
          {templates.map((t) => (
            <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <span className="font-medium">{t.name}</span>
                {t.is_default && <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">Default</span>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setEditingTemplate(t); setForm({ name: t.name, subject: t.subject, body: t.body, is_default: !!t.is_default }); }} className="text-[#11CCEF] hover:underline text-sm">Edit</button>
                {!t.is_default && <button onClick={() => handleDeleteTemplate(t.id)} className="text-red-600 hover:underline text-sm">Delete</button>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit/Create modal */}
      {(editingTemplate || showCreate) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setEditingTemplate(null); setShowCreate(false); }}>
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">{editingTemplate ? 'Edit Template' : 'Create Template'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full px-4 py-2 border rounded-lg" placeholder="Template name" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Subject</label>
                <input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} className="w-full px-4 py-2 border rounded-lg" placeholder="Email subject" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Body</label>
                <textarea value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} rows={10} className="w-full px-4 py-2 border rounded-lg font-mono text-sm" placeholder="Email body (use {{variables}})" />
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.is_default} onChange={(e) => setForm((f) => ({ ...f, is_default: e.target.checked }))} />
                Set as default
              </label>
            </div>
            <div className="flex gap-3 mt-6 justify-end">
              <button onClick={() => { setEditingTemplate(null); setShowCreate(false); }} className="px-4 py-2 bg-gray-200 rounded-lg">Cancel</button>
              <button onClick={handleSaveTemplate} className="px-4 py-2 bg-[#11CCEF] text-white rounded-lg font-medium">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
