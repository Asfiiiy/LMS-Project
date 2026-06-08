'use client';

import { useState, useEffect } from 'react';
import { apiService } from '@/app/services/api';

export default function ReminderLogsTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sentBy, setSentBy] = useState('');
  const [method, setMethod] = useState('');
  const [search, setSearch] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await apiService.getReminderLogs({ fromDate: fromDate || undefined, toDate: toDate || undefined, sentBy: sentBy || undefined, method: method || undefined, search: search || undefined });
      if (res?.success) setLogs(res.logs || []);
    } catch (e) {
      // no-op
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fromDate, toDate, sentBy, method, search]);

  const formatCurrency = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-lg border border-gray-200 grid grid-cols-1 md:grid-cols-5 gap-4">
        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} placeholder="From" className="px-4 py-2 border rounded-lg" />
        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} placeholder="To" className="px-4 py-2 border rounded-lg" />
        <select value={sentBy} onChange={(e) => setSentBy(e.target.value)} className="px-4 py-2 border rounded-lg">
          <option value="">All</option>
          <option value="auto">System (Auto)</option>
          <option value="manual">Manual</option>
        </select>
        <select value={method} onChange={(e) => setMethod(e.target.value)} className="px-4 py-2 border rounded-lg">
          <option value="">All</option>
          <option value="dashboard">Dashboard</option>
          <option value="email">Email</option>
          <option value="both">Both</option>
        </select>
        <input type="text" placeholder="Search student..." value={search} onChange={(e) => setSearch(e.target.value)} className="px-4 py-2 border rounded-lg" />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No reminder logs found</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Date/Time</th>
                <th className="px-4 py-3 text-left font-semibold">Student</th>
                <th className="px-4 py-3 text-left font-semibold">Course</th>
                <th className="px-4 py-3 text-left font-semibold">Installment</th>
                <th className="px-4 py-3 text-left font-semibold">Amount Due</th>
                <th className="px-4 py-3 text-left font-semibold">Sent By</th>
                <th className="px-4 py-3 text-left font-semibold">Method</th>
                <th className="px-4 py-3 text-left font-semibold">Template</th>
                <th className="px-4 py-3 text-left font-semibold">Email Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log: any) => (
                <tr key={log.id} className="border-t border-gray-200 hover:bg-gray-50">
                  <td className="px-4 py-3">{log.created_at ? new Date(log.created_at).toLocaleString() : '-'}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{log.student_name}</div>
                    <div className="text-xs text-gray-500">{log.student_email}</div>
                  </td>
                  <td className="px-4 py-3">{log.course_title}</td>
                  <td className="px-4 py-3">{log.installment}</td>
                  <td className="px-4 py-3">{formatCurrency(log.amount_due || 0)}</td>
                  <td className="px-4 py-3">{log.sent_by}</td>
                  <td className="px-4 py-3 capitalize">{log.method}</td>
                  <td className="px-4 py-3">{log.template_name || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      log.email_status === 'delivered' ? 'bg-green-100 text-green-800' :
                      log.email_status === 'failed' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {log.email_status || 'Pending'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
