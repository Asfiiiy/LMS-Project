'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiService } from '@/app/services/api';
import { showSweetAlert } from '@/app/components/SweetAlert';

const FormSkeleton = () => (
  <div className="space-y-6">
    {[1, 2].map(i => (
      <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-40 mb-4" />
        <div className="grid grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(j => (
            <div key={j} className="flex items-center gap-3">
              <div className="h-5 w-5 bg-gray-200 rounded" />
              <div className="h-4 bg-gray-200 rounded w-48" />
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

export default function SettingsTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [form, setForm] = useState({
    daily_enabled: true,
    weekly_enabled: true,
    max_daily_backups: 30,
    max_weekly_backups: 12,
    notify_admin_email: false,
    r2_enabled: false,
    r2_auto_upload: true,
    r2_delete_local_after_upload: false,
  });

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.getBackupSettings();
      if (res.success && res.settings) {
        const s = res.settings;
        setForm({
          daily_enabled: !!s.daily_enabled,
          weekly_enabled: !!s.weekly_enabled,
          max_daily_backups: s.max_daily_backups || 30,
          max_weekly_backups: s.max_weekly_backups || 12,
          notify_admin_email: !!s.notify_admin_email,
          r2_enabled: !!s.r2_enabled,
          r2_auto_upload: !!s.r2_auto_upload,
          r2_delete_local_after_upload: !!s.r2_delete_local_after_upload,
        });
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiService.updateBackupSettings(form);
      if (res.success) {
        showSweetAlert('Saved', 'Backup settings updated', 'success');
      } else {
        showSweetAlert('Error', res.message || 'Failed to save', 'error');
      }
    } catch (err: any) {
      showSweetAlert('Error', err.message || 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <FormSkeleton />;

  return (
    <div className="space-y-6">
      {/* Schedule & Retention */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Schedule & Retention</h3>
          <button onClick={fetchSettings} className="text-sm text-gray-500 hover:text-gray-700 font-medium">🔄 Refresh</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.daily_enabled}
              onChange={e => setForm(f => ({ ...f, daily_enabled: e.target.checked }))}
              className="w-5 h-5 rounded border-gray-300 text-[#11CCEF] focus:ring-[#11CCEF]"
            />
            <span className="text-sm text-gray-700">Daily backup enabled (02:00 London)</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.weekly_enabled}
              onChange={e => setForm(f => ({ ...f, weekly_enabled: e.target.checked }))}
              className="w-5 h-5 rounded border-gray-300 text-[#11CCEF] focus:ring-[#11CCEF]"
            />
            <span className="text-sm text-gray-700">Weekly backup enabled (Sun 03:00 London)</span>
          </label>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Max daily backups to keep</label>
            <input
              type="number" min={1} max={100}
              value={form.max_daily_backups}
              onChange={e => setForm(f => ({ ...f, max_daily_backups: parseInt(e.target.value) || 30 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-[#11CCEF] focus:border-[#11CCEF]"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Max weekly backups to keep</label>
            <input
              type="number" min={1} max={52}
              value={form.max_weekly_backups}
              onChange={e => setForm(f => ({ ...f, max_weekly_backups: parseInt(e.target.value) || 12 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-[#11CCEF] focus:border-[#11CCEF]"
            />
          </div>
        </div>
      </div>

      {/* R2 Cloud Settings */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">☁️ Cloudflare R2 Cloud Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.r2_enabled}
              onChange={e => setForm(f => ({ ...f, r2_enabled: e.target.checked }))}
              className="w-5 h-5 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Enable R2 Cloud Backup</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.r2_auto_upload}
              onChange={e => setForm(f => ({ ...f, r2_auto_upload: e.target.checked }))}
              disabled={!form.r2_enabled}
              className="w-5 h-5 rounded border-gray-300 text-blue-500 focus:ring-blue-500 disabled:opacity-40"
            />
            <span className={`text-sm ${form.r2_enabled ? 'text-gray-700' : 'text-gray-400'}`}>
              Auto-upload after every backup
            </span>
          </label>
          <div className="md:col-span-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.r2_delete_local_after_upload}
                onChange={e => setForm(f => ({ ...f, r2_delete_local_after_upload: e.target.checked }))}
                disabled={!form.r2_enabled}
                className="w-5 h-5 rounded border-gray-300 text-red-500 focus:ring-red-500 disabled:opacity-40 mt-0.5"
              />
              <div>
                <span className={`text-sm ${form.r2_enabled ? 'text-gray-700' : 'text-gray-400'}`}>
                  Delete local file after R2 upload
                </span>
                <p className="text-xs text-amber-600 mt-0.5">
                  ⚠️ Only enable if R2 is fully configured and tested. Local backup will be deleted after successful R2 upload.
                </p>
              </div>
            </label>
          </div>
        </div>

        <div className="mt-4">
          <button
            onClick={() => setShowSetupGuide(!showSetupGuide)}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            {showSetupGuide ? '▲ Hide' : '▼ Show'} R2 Setup Guide
          </button>
        </div>

        {showSetupGuide && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-gray-700 space-y-2">
            <h5 className="font-semibold text-blue-900">How to Set Up Cloudflare R2</h5>
            <ol className="list-decimal ml-5 space-y-1.5">
              <li>Go to <a href="https://dash.cloudflare.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">dash.cloudflare.com</a></li>
              <li>Click <strong>R2 Object Storage</strong> in the sidebar</li>
              <li>Click <strong>Create Bucket</strong> — Name: <code className="bg-blue-100 px-1 rounded">inspire-lms-backups</code>, Location: Europe</li>
              <li>Go to <strong>R2 Overview → Manage R2 API Tokens</strong></li>
              <li>Click <strong>Create API Token</strong> — Permissions: Object Read & Write, Bucket: inspire-lms-backups</li>
              <li>Copy: <strong>Account ID</strong> (from R2 overview), <strong>Access Key ID</strong>, <strong>Secret Access Key</strong></li>
              <li>Add to <code className="bg-blue-100 px-1 rounded">backend/.env</code>:
                <pre className="mt-1 bg-white p-2 rounded border border-blue-200 text-xs font-mono whitespace-pre-wrap">{`R2_ACCOUNT_ID=your_account_id\nR2_ACCESS_KEY_ID=your_access_key\nR2_SECRET_ACCESS_KEY=your_secret_key\nR2_BUCKET_NAME=inspire-lms-backups\nR2_ENABLED=true`}</pre>
              </li>
              <li>Restart backend server</li>
              <li>Go to the <strong>Overview</strong> tab and click <strong>Test Connection</strong></li>
            </ol>
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 text-white rounded-lg font-semibold text-sm transition-all disabled:opacity-50"
          style={{ backgroundColor: '#11CCEF' }}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
