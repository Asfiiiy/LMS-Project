'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiService } from '@/app/services/api';

interface BackupLog {
  id: number;
  backup_type: string;
  status: string;
  filename: string | null;
  size_mb: number | null;
  error_message: string | null;
  triggered_by: number | null;
  triggered_by_name: string | null;
  r2_uploaded: number;
  r2_uploaded_at: string | null;
  r2_upload_error: string | null;
  created_at: string;
}

const PAGE_SIZE = 20;

const TableSkeleton = () => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-200 animate-pulse p-6 space-y-3">
    <div className="h-8 bg-gray-100 rounded w-full" />
    {Array.from({ length: 8 }).map((_, i) => (
      <div key={i} className="h-12 bg-gray-50 rounded w-full" />
    ))}
  </div>
);

export default function BackupHistoryTab() {
  const [logs, setLogs] = useState<BackupLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.getBackupLogs(page);
      if (res.success) {
        setLogs(res.logs);
        setTotal(res.total);
      }
    } catch (err) {
      console.error('Error fetching backup logs:', err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const typeBadge = (type: string) => {
    const map: Record<string, string> = {
      daily: 'bg-blue-100 text-blue-800',
      weekly: 'bg-purple-100 text-purple-800',
      manual: 'bg-cyan-100 text-cyan-800',
    };
    return <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[type] || 'bg-gray-100 text-gray-800'}`}>{type}</span>;
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      success: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      running: 'bg-amber-100 text-amber-800',
      deleted: 'bg-gray-100 text-gray-500',
    };
    return (
      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[status] || 'bg-gray-100 text-gray-800'}`}>
        {status === 'running' ? '⏳ Running' : status}
      </span>
    );
  };

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
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Log of all backup events — scheduled and manual</p>
        <button onClick={fetchLogs} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold text-sm hover:bg-gray-200 transition-colors">
          🔄 Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            <div className="text-4xl mb-3">📋</div>
            <p className="font-medium">No backup history yet</p>
            <p className="text-sm mt-1">Backup events will appear here after the first backup</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Size</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">R2</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Triggered By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3 text-sm text-gray-700" title={new Date(log.created_at).toLocaleString()}>
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-3">{typeBadge(log.backup_type)}</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        {statusBadge(log.status)}
                        {log.status === 'failed' && log.error_message && (
                          <span className="text-xs text-red-600 max-w-xs truncate" title={log.error_message}>
                            {log.error_message.slice(0, 60)}...
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-700">
                      {log.size_mb ? `${log.size_mb} MB` : '—'}
                    </td>
                    <td className="px-6 py-3 text-sm">
                      {log.r2_uploaded ? (
                        <span className="text-green-600 font-semibold" title={log.r2_uploaded_at ? `Uploaded ${new Date(log.r2_uploaded_at).toLocaleString()}` : ''}>
                          ☁️ ✓
                        </span>
                      ) : log.r2_upload_error ? (
                        <span className="text-red-500" title={log.r2_upload_error}>☁️ ✗</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-700">
                      {log.triggered_by_name || (log.triggered_by ? `User #${log.triggered_by}` : 'Scheduled')}
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
              Page {page} of {totalPages} ({total} total)
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
