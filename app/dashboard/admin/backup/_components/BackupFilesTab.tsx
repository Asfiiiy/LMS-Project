'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiService } from '@/app/services/api';
import { showSweetAlert } from '@/app/components/SweetAlert';

interface BackupFile {
  filename: string;
  type: string;
  sizeMB: number;
  sizeBytes: number;
  createdAt: string;
}

interface R2File {
  filename: string;
  type: string;
  sizeMB: number;
  sizeBytes: number;
  lastModified: string;
}

interface MergedBackup {
  filename: string;
  type: string;
  sizeMB: number;
  createdAt: string;
  local: boolean;
  r2: boolean;
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

const PAGE_SIZE = 10;

const TableSkeleton = () => (
  <div className="space-y-4">
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 animate-pulse">
      <div className="flex gap-3">
        <div className="h-10 bg-gray-200 rounded w-64" />
        <div className="h-10 bg-gray-200 rounded w-32" />
        <div className="h-10 bg-gray-200 rounded w-48" />
      </div>
    </div>
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 animate-pulse p-6 space-y-3">
      <div className="h-8 bg-gray-100 rounded w-full" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-12 bg-gray-50 rounded w-full" />
      ))}
    </div>
  </div>
);

export default function BackupFilesTab() {
  const [localBackups, setLocalBackups] = useState<BackupFile[]>([]);
  const [r2Backups, setR2Backups] = useState<R2File[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [locationTab, setLocationTab] = useState<'all' | 'local' | 'r2'>('all');
  const [page, setPage] = useState(1);
  const [uploadingFile, setUploadingFile] = useState<string | null>(null);
  const [uploadingAll, setUploadingAll] = useState(false);
  const [r2Configured, setR2Configured] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [localRes, r2Res, statusRes] = await Promise.all([
        apiService.listDatabaseBackups(),
        apiService.listR2Backups().catch(() => ({ success: true, backups: [] })),
        apiService.getBackupStatus().catch(() => ({ success: true, r2Status: { configured: false } })),
      ]);
      if (localRes.success) setLocalBackups(localRes.backups);
      if (r2Res.success) setR2Backups(r2Res.backups || []);
      setR2Configured(statusRes?.r2Status?.configured || false);
    } catch (err) {
      console.error('Error fetching backup files:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const r2FileSet = useMemo(() => new Set(r2Backups.map(f => f.filename)), [r2Backups]);
  const localFileSet = useMemo(() => new Set(localBackups.map(f => f.filename)), [localBackups]);

  const mergedBackups = useMemo(() => {
    const map = new Map<string, MergedBackup>();
    for (const b of localBackups) {
      map.set(b.filename, {
        filename: b.filename, type: b.type, sizeMB: b.sizeMB,
        createdAt: b.createdAt, local: true, r2: r2FileSet.has(b.filename),
      });
    }
    for (const r of r2Backups) {
      if (!map.has(r.filename)) {
        map.set(r.filename, {
          filename: r.filename, type: r.type, sizeMB: r.sizeMB,
          createdAt: r.lastModified, local: false, r2: true,
        });
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [localBackups, r2Backups, r2FileSet]);

  const filtered = useMemo(() => {
    let list = mergedBackups;
    if (locationTab === 'local') list = list.filter(b => b.local);
    if (locationTab === 'r2') list = list.filter(b => b.r2);
    if (search) list = list.filter(b => b.filename.toLowerCase().includes(search.toLowerCase()));
    if (typeFilter) list = list.filter(b => b.type === typeFilter);
    return list;
  }, [mergedBackups, locationTab, search, typeFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search, typeFilter, locationTab]);

  // --- Action Handlers ---

  const handleDownload = async (filename: string) => {
    try { await apiService.downloadDatabaseBackup(filename); }
    catch { showSweetAlert('Error', 'Download failed', 'error'); }
  };

  const handleDownloadR2 = async (filename: string) => {
    try { await apiService.downloadFromR2(filename); }
    catch { showSweetAlert('Error', 'R2 download failed', 'error'); }
  };

  const handleDelete = (filename: string) => {
    if (localBackups.length <= 1 && !r2FileSet.has(filename)) {
      showSweetAlert('Warning', 'Cannot delete the only remaining local backup', 'warning');
      return;
    }
    showSweetAlert({
      title: 'Delete Local Backup',
      text: `Delete ${filename} from local storage?${r2FileSet.has(filename) ? ' The R2 copy will remain.' : ''}`,
      icon: 'warning', showCancelButton: true, confirmButtonText: 'Delete', cancelButtonText: 'Cancel',
      onConfirm: async () => {
        try {
          const res = await apiService.deleteDatabaseBackup(filename);
          if (res.success) { showSweetAlert('Deleted', 'Local backup deleted', 'success'); fetchData(); }
          else showSweetAlert('Error', res.message || 'Delete failed', 'error');
        } catch (err: any) { showSweetAlert('Error', err.message, 'error'); }
      }
    });
  };

  const handleDeleteR2 = (filename: string) => {
    showSweetAlert({
      title: 'Delete from R2 Cloud',
      text: `Delete ${filename} from Cloudflare R2?${localFileSet.has(filename) ? ' The local copy will remain.' : ''}`,
      icon: 'warning', showCancelButton: true, confirmButtonText: 'Delete from R2', cancelButtonText: 'Cancel',
      onConfirm: async () => {
        try {
          const res = await apiService.deleteFromR2(filename);
          if (res.success) { showSweetAlert('Deleted', 'Removed from R2', 'success'); fetchData(); }
          else showSweetAlert('Error', res.message, 'error');
        } catch (err: any) { showSweetAlert('Error', err.message, 'error'); }
      }
    });
  };

  const handleUploadToR2 = async (filename: string) => {
    setUploadingFile(filename);
    try {
      const res = await apiService.uploadToR2(filename);
      if (res.success) { showSweetAlert('Uploaded', `${filename} uploaded to R2`, 'success'); fetchData(); }
      else showSweetAlert('Error', res.message, 'error');
    } catch (err: any) { showSweetAlert('Error', err.message, 'error'); }
    finally { setUploadingFile(null); }
  };

  const handleUploadAllToR2 = async () => {
    setUploadingAll(true);
    try {
      const res = await apiService.uploadAllToR2();
      if (res.success) {
        const uploaded = res.results.filter((r: any) => r.status === 'uploaded').length;
        const failed = res.results.filter((r: any) => r.status === 'failed').length;
        const existed = res.results.filter((r: any) => r.status === 'already_exists').length;
        showSweetAlert('Upload Complete',
          `Uploaded: ${uploaded} | Already in R2: ${existed}${failed ? ` | Failed: ${failed}` : ''}`,
          failed ? 'warning' : 'success');
        fetchData();
      } else showSweetAlert('Error', res.message, 'error');
    } catch (err: any) { showSweetAlert('Error', err.message, 'error'); }
    finally { setUploadingAll(false); }
  };

  // --- Badge Helpers ---

  const typeBadge = (type: string) => {
    const map: Record<string, string> = {
      daily: 'bg-blue-100 text-blue-800',
      weekly: 'bg-purple-100 text-purple-800',
      manual: 'bg-cyan-100 text-cyan-800',
    };
    return <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[type] || 'bg-gray-100 text-gray-800'}`}>{type}</span>;
  };

  const locationBadge = (b: MergedBackup) => {
    if (b.local && b.r2) return <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">💾☁️ Both</span>;
    if (b.r2) return <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">☁️ R2</span>;
    return <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">💾 Local</span>;
  };

  // --- Pagination Helper ---

  const renderPageNumbers = () => {
    const pages: number[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else if (page <= 4) {
      pages.push(1, 2, 3, 4, 5, -1, totalPages);
    } else if (page >= totalPages - 3) {
      pages.push(1, -1, totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, -1, page - 1, page, page + 1, -2, totalPages);
    }
    return pages.map((p, i) =>
      p < 0 ? (
        <span key={`ellipsis-${i}`} className="px-2 py-1.5 text-sm text-gray-400">...</span>
      ) : (
        <button
          key={p}
          onClick={() => setPage(p)}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
            page === p ? 'bg-[#11CCEF] text-white font-semibold' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {p}
        </button>
      )
    );
  };

  if (loading) return <TableSkeleton />;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search filename..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-[#11CCEF] focus:border-[#11CCEF] w-64"
          />
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-[#11CCEF] focus:border-[#11CCEF]"
          >
            <option value="">All Types</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="manual">Manual</option>
          </select>

          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {(['all', 'local', 'r2'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setLocationTab(tab)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  locationTab === tab
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'all' ? `All (${mergedBackups.length})` :
                 tab === 'local' ? `💾 Local (${localBackups.length})` :
                 `☁️ R2 (${r2Backups.length})`}
              </button>
            ))}
          </div>

          <div className="ml-auto flex gap-2">
            {r2Configured && localBackups.length > 0 && (
              <button
                onClick={handleUploadAllToR2}
                disabled={uploadingAll}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg font-semibold text-sm hover:bg-blue-100 disabled:opacity-50"
              >
                {uploadingAll ? (
                  <><div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-blue-600 border-t-transparent" /> Uploading...</>
                ) : (
                  <>⬆️ Upload All to R2</>
                )}
              </button>
            )}
            <button onClick={fetchData} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold text-sm hover:bg-gray-200 transition-colors">
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {paginated.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            <div className="text-4xl mb-3">{locationTab === 'r2' ? '☁️' : '🗄️'}</div>
            <p className="font-medium">{search || typeFilter ? 'No matching backups' : 'No backup files found'}</p>
            <p className="text-sm mt-1">
              {search || typeFilter ? 'Try adjusting your filters' : 'Create your first backup from the Overview tab'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Filename</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Size</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Location</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Created</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginated.map(b => (
                  <tr key={b.filename} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3 text-sm text-gray-900 font-mono whitespace-nowrap max-w-xs truncate">{b.filename}</td>
                    <td className="px-6 py-3">{typeBadge(b.type)}</td>
                    <td className="px-6 py-3 text-sm text-gray-700">{b.sizeMB} MB</td>
                    <td className="px-6 py-3">{locationBadge(b)}</td>
                    <td className="px-6 py-3 text-sm text-gray-500" title={new Date(b.createdAt).toLocaleString()}>
                      {timeAgo(b.createdAt)}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {b.local && (
                          <>
                            <button onClick={() => handleDownload(b.filename)} className="px-2.5 py-1.5 text-xs font-semibold bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors" title="Download local">⬇️ Local</button>
                            <button onClick={() => handleDelete(b.filename)} className="px-2.5 py-1.5 text-xs font-semibold bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors" title="Delete local">🗑️</button>
                          </>
                        )}
                        {b.r2 && (
                          <>
                            <button onClick={() => handleDownloadR2(b.filename)} className="px-2.5 py-1.5 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors" title="Download from R2">☁️⬇️</button>
                            <button onClick={() => handleDeleteR2(b.filename)} className="px-2.5 py-1.5 text-xs font-semibold bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors" title="Delete from R2">☁️🗑️</button>
                          </>
                        )}
                        {b.local && !b.r2 && r2Configured && (
                          <button
                            onClick={() => handleUploadToR2(b.filename)}
                            disabled={uploadingFile === b.filename}
                            className="px-2.5 py-1.5 text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 disabled:opacity-50 transition-colors"
                            title="Upload to R2"
                          >
                            {uploadingFile === b.filename ? (
                              <span className="inline-flex items-center gap-1">
                                <span className="animate-spin rounded-full h-3 w-3 border-2 border-indigo-600 border-t-transparent" /> R2
                              </span>
                            ) : '⬆️ R2'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              {renderPageNumbers()}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
