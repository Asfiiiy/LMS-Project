'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiService } from '@/app/services/api';
import { showSweetAlert } from '@/app/components/SweetAlert';

interface BackupFile {
  filename: string;
  type: string;
  sizeMB: number;
  createdAt: string;
}

interface BackupStats {
  total: number;
  totalSizeMB: number;
  latest: BackupFile | null;
  oldest: BackupFile | null;
  byType: { daily: number; weekly: number; manual: number };
}

interface R2Status {
  configured: boolean;
  connected: boolean;
  fileCount: number;
  totalSizeMB: number;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const CardSkeleton = () => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 animate-pulse">
    <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
    <div className="h-8 bg-gray-200 rounded w-20 mb-2" />
    <div className="h-3 bg-gray-200 rounded w-32" />
  </div>
);

export default function OverviewTab() {
  const [stats, setStats] = useState<BackupStats | null>(null);
  const [r2Status, setR2Status] = useState<R2Status>({ configured: false, connected: false, fileCount: 0, totalSizeMB: 0 });
  const [settings, setSettings] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.getBackupStatus();
      if (res.success) {
        setStats(res.stats);
        setR2Status(res.r2Status || { configured: false, connected: false, fileCount: 0, totalSizeMB: 0 });
        setSettings(res.settings);
        setIsRunning(res.isRunning);
      }
    } catch (err) {
      console.error('Error fetching backup status:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = () => {
    showSweetAlert({
      title: 'Create Backup',
      text: `Create a full database backup now?${settings?.r2_enabled && settings?.r2_auto_upload ? ' It will also upload to R2 cloud.' : ''}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Create Backup',
      cancelButtonText: 'Cancel',
      onConfirm: async () => {
        setCreating(true);
        try {
          const res = await apiService.createDatabaseBackup();
          if (res.success) {
            const r2Msg = res.backup?.r2?.success ? ' + uploaded to R2' : '';
            showSweetAlert('Backup Created', `${res.backup.filename} (${res.backup.sizeMB} MB)${r2Msg}`, 'success');
            fetchData();
          } else {
            showSweetAlert('Error', res.message || 'Backup failed', 'error');
          }
        } catch (err: any) {
          showSweetAlert('Error', err.message || 'Failed to create backup', 'error');
        } finally {
          setCreating(false);
        }
      }
    });
  };

  const handleTestR2 = async () => {
    try {
      const res = await apiService.testR2Connection();
      if (res.success) {
        showSweetAlert('R2 Connected', 'Successfully connected to Cloudflare R2 bucket', 'success');
        fetchData();
      } else {
        showSweetAlert('Connection Failed', res.message || 'Could not connect to R2', 'error');
      }
    } catch (err: any) {
      showSweetAlert('Error', err.message || 'Connection test failed', 'error');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-32 mb-4" />
          <div className="flex gap-3">
            <div className="h-10 bg-gray-200 rounded w-44" />
            <div className="h-10 bg-gray-200 rounded w-28" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="text-sm font-medium text-gray-500">Total Backups</div>
          <div className="mt-1 text-3xl font-bold text-gray-900">{stats?.total ?? 0}</div>
          <div className="mt-1 text-xs text-gray-400">
            {stats?.byType.daily ?? 0} daily · {stats?.byType.weekly ?? 0} weekly · {stats?.byType.manual ?? 0} manual
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="text-sm font-medium text-gray-500">Local Size</div>
          <div className="mt-1 text-3xl font-bold text-gray-900">{stats?.totalSizeMB ?? 0} MB</div>
          <div className="mt-1 text-xs text-gray-400">Combined SQL backup files</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="text-sm font-medium text-gray-500">Last Backup</div>
          <div className="mt-1 text-3xl font-bold text-gray-900">{timeAgo(stats?.latest?.createdAt ?? null)}</div>
          <div className="mt-1 text-xs text-gray-400 truncate">{stats?.latest?.filename ?? 'No backups yet'}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="text-sm font-medium text-gray-500">Schedule</div>
          <div className="mt-1 text-lg font-bold text-gray-900">
            {settings?.daily_enabled ? '✅ Daily 02:00' : '❌ Daily off'}
          </div>
          <div className="mt-1 text-xs text-gray-400">
            {settings?.weekly_enabled ? '✅ Weekly Sun 03:00' : '❌ Weekly off'}
          </div>
        </div>
        <div className={`bg-white rounded-xl shadow-sm border-2 p-5 ${
          r2Status.connected ? 'border-green-300' :
          r2Status.configured ? 'border-red-300' :
          'border-gray-200'
        }`}>
          <div className="text-sm font-medium text-gray-500">☁️ Cloudflare R2</div>
          <div className="mt-1">
            {r2Status.connected ? (
              <span className="text-lg font-bold text-green-700">● Connected</span>
            ) : r2Status.configured ? (
              <span className="text-lg font-bold text-red-600">✗ Disconnected</span>
            ) : (
              <span className="text-lg font-bold text-gray-400">Not configured</span>
            )}
          </div>
          {r2Status.connected && (
            <div className="mt-1 text-xs text-gray-400">{r2Status.fileCount} files · {r2Status.totalSizeMB} MB</div>
          )}
          <button onClick={handleTestR2} className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium">
            Test Connection
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleCreate}
            disabled={creating || isRunning}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-white font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#11CCEF' }}
          >
            {creating || isRunning ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                {isRunning ? 'Backup in progress...' : 'Creating...'}
              </>
            ) : (
              <>🗄️ Create Backup Now</>
            )}
          </button>
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-semibold text-sm hover:bg-gray-200 transition-colors"
          >
            🔄 Refresh
          </button>
        </div>
      </div>
    </div>
  );
}
