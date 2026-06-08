'use client';

import { useState, useEffect } from 'react';
import { apiService } from '@/app/services/api';

interface AIActionLog {
  id: number;
  token_id: number;
  token_name: string;
  action_type: string;
  action_description: string;
  endpoint: string;
  method: string;
  ip_address: string;
  country_code: string | null;
  country_name: string | null;
  response_status: number | null;
  response_time_ms: number | null;
  error_message: string | null;
  affected_user_id: number | null;
  affected_student_id: number | null;
  affected_course_id: number | null;
  affected_enrollment_id: number | null;
  created_at: string;
}

interface AIActionLogsProps {
  tokenId?: number;
  onClose?: () => void;
}

const AIActionLogs = ({ tokenId, onClose }: AIActionLogsProps) => {
  const [logs, setLogs] = useState<AIActionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Filters
  const [actionTypeFilter, setActionTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    fetchLogs();
  }, [page, limit, actionTypeFilter, dateFrom, dateTo, tokenId]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      
      if (tokenId) {
        // Fetch logs for specific token
        const response = await apiService.getAITokenLogs(tokenId, {
          page,
          limit,
          actionType: actionTypeFilter || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined
        });

        if (response.success) {
          setLogs(response.logs || []);
          setTotal(response.pagination?.total || 0);
          setTotalPages(response.pagination?.totalPages || 0);
        }
      } else {
        // TODO: Add endpoint to get all AI logs (not token-specific)
        // For now, show message
        setLogs([]);
        setTotal(0);
        setTotalPages(0);
      }
    } catch (error) {
      // no-op
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status: number | null) => {
    if (!status) return 'text-gray-600';
    if (status >= 200 && status < 300) return 'text-green-600';
    if (status >= 400 && status < 500) return 'text-orange-600';
    if (status >= 500) return 'text-red-600';
    return 'text-gray-600';
  };

  const actionTypes = [
    'user_created',
    'tutor_assigned',
    'student_enrolled',
    'deadlines_set',
    'payment_setup',
    'courses_listed',
    'students_listed'
  ];

  return (
    <div className="space-y-4">
      {onClose && (
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold">AI Action Logs</h3>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Action Type
            </label>
            <select
              value={actionTypeFilter}
              onChange={(e) => {
                setActionTypeFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">All Actions</option>
              {actionTypes.map(type => (
                <option key={type} value={type}>
                  {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setActionTypeFilter('');
                setDateFrom('');
                setDateTo('');
                setPage(1);
              }}
              className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      {loading ? (
        <div className="text-center py-8">Loading logs...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No logs found</div>
      ) : (
        <>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Timestamp</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Token</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Action</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Endpoint</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Response Time</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-t border-gray-200 hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {log.token_name}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium text-gray-900 text-sm">
                            {log.action_type.replace(/_/g, ' ')}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {log.action_description}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                        {log.method} {log.endpoint.substring(0, 40)}
                        {log.endpoint.length > 40 ? '...' : ''}
                      </td>
                      <td className="px-4 py-3">
                        {log.response_status ? (
                          <span className={`text-sm font-semibold ${getStatusColor(log.response_status)}`}>
                            {log.response_status}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                        {log.error_message && (
                          <div className="text-xs text-red-600 mt-1">
                            {log.error_message.substring(0, 50)}
                            {log.error_message.length > 50 ? '...' : ''}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {log.response_time_ms ? `${log.response_time_ms}ms` : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        <div>
                          <div>{log.ip_address}</div>
                          {log.country_name && (
                            <div className="text-xs text-gray-500">{log.country_name}</div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-600">
                Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} logs
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-gray-700">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
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
};

export default AIActionLogs;
