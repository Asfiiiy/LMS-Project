'use client';

import { useState, useEffect } from 'react';
import { apiService } from '@/app/services/api';

interface ImpersonationLog {
  id: number;
  admin_id: number;
  admin_name: string;
  target_user_id: number;
  target_user_name: string;
  target_user_email: string;
  target_user_role: string;
  started_at: string;
  ended_at: string | null;
  ip_address: string | null;
}

export default function ImpersonationLogs() {
  const [logs, setLogs] = useState<ImpersonationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchLogs();
  }, [page]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await apiService.getImpersonationLogs(page, 20);
      if (res?.success) {
        setLogs(res.logs || []);
        setTotalPages(res.pagination?.totalPages || 1);
        setTotal(res.pagination?.total || 0);
      }
    } catch (err) {
      // no-op
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleString();
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Impersonation Audit Log</h2>
      <p className="text-sm text-gray-600 mb-6">
        Log of all Admin Ghost Login (Login As) sessions. Only Admins can use this feature.
      </p>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading logs...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No impersonation sessions recorded yet.</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-2 font-semibold text-gray-700">Admin</th>
                  <th className="text-left py-3 px-2 font-semibold text-gray-700">Impersonated User</th>
                  <th className="text-left py-3 px-2 font-semibold text-gray-700">Role</th>
                  <th className="text-left py-3 px-2 font-semibold text-gray-700">Started</th>
                  <th className="text-left py-3 px-2 font-semibold text-gray-700">Ended</th>
                  <th className="text-left py-3 px-2 font-semibold text-gray-700">IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-2">
                      <span className="font-medium">{log.admin_name}</span>
                    </td>
                    <td className="py-3 px-2">
                      <div>
                        <span className="font-medium">{log.target_user_name}</span>
                        <div className="text-xs text-gray-500">{log.target_user_email}</div>
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <span className="px-2 py-1 bg-gray-100 rounded text-xs">{log.target_user_role}</span>
                    </td>
                    <td className="py-3 px-2 text-gray-600">{formatDate(log.started_at)}</td>
                    <td className="py-3 px-2 text-gray-600">{formatDate(log.ended_at)}</td>
                    <td className="py-3 px-2 text-gray-500 text-xs">{log.ip_address || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-gray-600">
                Page {page} of {totalPages} ({total} total)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
