'use client';

import { useState, useEffect } from 'react';
import { apiService } from '@/app/services/api';

export default function ReceivedInstallmentsTab() {
  const [stats, setStats] = useState<any>(null);
  const [installments, setInstallments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [paymentPlan, setPaymentPlan] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, receivedRes] = await Promise.all([
        apiService.getReceivedPaymentsStats(),
        apiService.getReceivedPayments({ search, course: courseFilter || undefined, fromDate: fromDate || undefined, toDate: toDate || undefined, month: month || undefined, year: year || undefined, paymentPlan: paymentPlan || undefined })
      ]);
      if (statsRes?.success) setStats(statsRes.stats);
      if (receivedRes?.success) setInstallments(receivedRes.installments || []);
    } catch (e) {
      // no-op
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [search, courseFilter, fromDate, toDate, month, year, paymentPlan]);

  const formatCurrency = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);
  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-GB') : '-';

  const uniqueCourses = [...new Set(installments.map((i: any) => i.course_title))].filter(Boolean).sort();
  const months = ['01','02','03','04','05','06','07','08','09','10','11','12'].map((m, i) => ({ value: m, label: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i] }));
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="space-y-4">
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-xs font-semibold text-gray-500 uppercase">Total Received</div>
            <div className="text-xl font-bold text-gray-900">{stats.total_installments_received}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-green-200">
            <div className="text-xs font-semibold text-green-600 uppercase">Total Amount</div>
            <div className="text-xl font-bold text-green-700">{formatCurrency(stats.total_amount_received)}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-xs font-semibold text-gray-500 uppercase">This Month</div>
            <div className="text-xl font-bold">{formatCurrency(stats.received_this_month)}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-xs font-semibold text-gray-500 uppercase">This Week</div>
            <div className="text-xl font-bold">{formatCurrency(stats.received_this_week)}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-xs font-semibold text-gray-500 uppercase">Avg Installment</div>
            <div className="text-xl font-bold">{formatCurrency(stats.average_installment_amount)}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-emerald-200">
            <div className="text-xs font-semibold text-emerald-600 uppercase">Fully Paid</div>
            <div className="text-xl font-bold text-emerald-700">{stats.students_fully_paid}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-amber-200">
            <div className="text-xs font-semibold text-amber-600 uppercase">With Balance</div>
            <div className="text-xl font-bold text-amber-700">{stats.students_with_remaining_balance}</div>
          </div>
        </div>
      )}

      <div className="bg-white p-4 rounded-lg border border-gray-200 grid grid-cols-1 md:grid-cols-4 gap-4">
        <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="px-4 py-2 border rounded-lg" />
        <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} className="px-4 py-2 border rounded-lg">
          <option value="">All Courses</option>
          {uniqueCourses.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} placeholder="From" className="px-4 py-2 border rounded-lg" />
        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} placeholder="To" className="px-4 py-2 border rounded-lg" />
        <select value={month} onChange={(e) => setMonth(e.target.value)} className="px-4 py-2 border rounded-lg">
          <option value="">All Months</option>
          {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(e.target.value)} className="px-4 py-2 border rounded-lg">
          <option value="">All Years</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={paymentPlan} onChange={(e) => setPaymentPlan(e.target.value)} className="px-4 py-2 border rounded-lg">
          <option value="">All Plans</option>
          <option value="all_paid">All Paid (upfront)</option>
          <option value="installment">Installment</option>
        </select>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : installments.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No received installments found</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Student</th>
                <th className="px-4 py-3 text-left font-semibold">Course</th>
                <th className="px-4 py-3 text-left font-semibold">Installment</th>
                <th className="px-4 py-3 text-left font-semibold">Amount Paid</th>
                <th className="px-4 py-3 text-left font-semibold">Paid Date</th>
                <th className="px-4 py-3 text-left font-semibold">Reference</th>
                <th className="px-4 py-3 text-left font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody>
              {installments.map((inst: any) => (
                <tr key={inst.id} className="border-t border-gray-200 hover:bg-gray-50">
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
                        border: '1px solid #fde68a',
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
                  <td className="px-4 py-3 font-medium text-green-600">{formatCurrency(inst.amount)}</td>
                  <td className="px-4 py-3">{formatDate(inst.paid_at)}</td>
                  <td className="px-4 py-3">{inst.payment_reference || '-'}</td>
                  <td className="px-4 py-3">{inst.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
