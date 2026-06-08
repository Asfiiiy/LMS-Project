'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { apiService } from '@/app/services/api';
import { C, SectionCard, StatusPill } from './profileSectionUI';

const InstallmentPaymentModal = dynamic(() => import('@/app/components/InstallmentPaymentModal'), { ssr: false });

export interface PaymentInstallment {
  id: number;
  course_id: number;
  course_title: string;
  installment_number: number;
  is_deposit?: number;
  installment_name: string;
  amount: number;
  due_date: string | null;
  status: 'paid' | 'due' | 'overdue';
  paid_at: string | null;
  payment_reference: string | null;
  payment_method?: string | null;
  notes: string | null;
  payment_type: 'all_paid' | 'installment';
  created_at: string;
  updated_at: string;
}

interface PaymentPlanTabProps {
  onInstallmentsCountChange?: (count: number) => void;
  onFetchError?: (message: string) => void;
}

export default function PaymentPlanTab({ onInstallmentsCountChange, onFetchError }: PaymentPlanTabProps) {
  const [payments, setPayments] = useState<PaymentInstallment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [payModalInstallment, setPayModalInstallment] = useState<PaymentInstallment | null>(null);

  const fetchPayments = async () => {
    try {
      setLoadingPayments(true);
      onFetchError?.('');
      const response = await apiService.getStudentInstallments();
      if (response?.success) {
        const all: PaymentInstallment[] = [];
        if (response.installments && Array.isArray(response.installments)) {
          response.installments.forEach((cg: any) => {
            if (cg.installments && Array.isArray(cg.installments)) {
              cg.installments.forEach((inst: any) =>
                all.push({
                  ...inst,
                  course_title: cg.course_title || 'Unknown Course',
                  course_id: cg.course_id || inst.course_id,
                })
              );
            } else if (cg.id) all.push({ ...cg, course_title: cg.course_title || 'Unknown Course' });
          });
        } else if (Array.isArray(response.installments)) all.push(...response.installments);
        setPayments(all);
        onInstallmentsCountChange?.(all.length);
      } else {
        setPayments([]);
        onInstallmentsCountChange?.(0);
      }
    } catch {
      onFetchError?.('Failed to load payment information');
      setPayments([]);
      onInstallmentsCountChange?.(0);
    } finally {
      setLoadingPayments(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const paymentsByCourse = payments.reduce(
    (acc, p) => {
      if (!acc[p.course_id]) acc[p.course_id] = { course_id: p.course_id, course_title: p.course_title, payments: [] };
      acc[p.course_id].payments.push(p);
      return acc;
    },
    {} as Record<number, { course_id: number; course_title: string; payments: PaymentInstallment[] }>
  );

  return (
    <>
      <div className="space-y-6">
        {loadingPayments ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center space-y-4">
              <div
                className="w-12 h-12 mx-auto rounded-xl flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${C.cyan}, ${C.pink})` }}
              >
                <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="text-sm font-semibold" style={{ color: C.muted }}>
                Loading payments…
              </p>
            </div>
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-20">
            <div
              className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ background: '#F1F5F9', border: '2px dashed #CBD5E1' }}
            >
              <svg className="w-7 h-7" style={{ color: C.muted }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                />
              </svg>
            </div>
            <p className="text-sm font-semibold" style={{ color: '#1E293B' }}>
              No payment installments
            </p>
            <p className="text-xs mt-1" style={{ color: C.muted }}>
              Your payment plan will appear here once set up
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: C.muted }}>
                  Total
                </p>
                <p className="text-lg font-bold" style={{ color: '#1E293B' }}>
                  {formatCurrency(payments.reduce((s, p) => s + p.amount, 0))}
                </p>
              </div>
              <div className="p-4 rounded-xl" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: C.muted }}>
                  Paid
                </p>
                <p className="text-lg font-bold" style={{ color: C.green }}>
                  {formatCurrency(payments.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0))}
                </p>
              </div>
              <div className="p-4 rounded-xl" style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: C.muted }}>
                  Remaining
                </p>
                <p className="text-lg font-bold" style={{ color: '#EA580C' }}>
                  {formatCurrency(payments.filter((p) => p.status !== 'paid').reduce((s, p) => s + p.amount, 0))}
                </p>
              </div>
              <div className="p-4 rounded-xl" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: C.muted }}>
                  Next Due
                </p>
                <p className="text-sm font-bold" style={{ color: '#1E293B' }}>
                  {(() => {
                    const unpaid = payments
                      .filter((p) => p.status !== 'paid' && p.due_date)
                      .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime());
                    return unpaid[0] ? formatDate(unpaid[0].due_date) : '—';
                  })()}
                </p>
              </div>
            </div>

            {Object.values(paymentsByCourse).map((cg) => {
              const total = cg.payments.reduce((s, p) => s + p.amount, 0);
              const paid = cg.payments.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
              const paidPct = total > 0 ? Math.round((paid / total) * 100) : 0;
              const canPay = (p: PaymentInstallment) => p.status !== 'paid';
              const payLabel = (p: PaymentInstallment) => {
                if (p.status === 'paid') return '';
                const due = p.due_date ? new Date(p.due_date) : null;
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (!due) return 'Pay Now';
                due.setHours(0, 0, 0, 0);
                const daysUntil = Math.ceil((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
                return daysUntil > 7 ? 'Pay Early' : 'Pay Now';
              };
              return (
                <SectionCard
                  key={cg.course_id}
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                      />
                    </svg>
                  }
                  title={cg.course_title}
                  accent={C.cyan}
                  badge={
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs font-semibold" style={{ color: C.muted }}>
                          {paidPct}% paid
                        </p>
                        <p className="text-xs" style={{ color: C.muted }}>
                          {formatCurrency(paid)} of {formatCurrency(total)}
                        </p>
                      </div>
                      <div className="relative w-10 h-10">
                        <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
                          <circle cx="20" cy="20" r="15" fill="none" stroke="#E2E8F0" strokeWidth="4" />
                          <circle
                            cx="20"
                            cy="20"
                            r="15"
                            fill="none"
                            stroke={paidPct === 100 ? C.green : C.cyan}
                            strokeWidth="4"
                            strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 15}`}
                            strokeDashoffset={`${2 * Math.PI * 15 * (1 - paidPct / 100)}`}
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xs font-bold" style={{ color: '#1E293B' }}>
                            {paidPct}%
                          </span>
                        </div>
                      </div>
                    </div>
                  }
                >
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ borderBottom: '2px solid #F1F5F9' }}>
                          {['#', 'Installment', 'Amount', 'Due Date', 'Status', 'Paid At', 'Reference', ''].map((h) => (
                            <th
                              key={h}
                              className="pb-3 text-left pr-4 last:pr-0 text-xs font-semibold uppercase tracking-wider"
                              style={{ color: C.muted }}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {cg.payments.map((p, idx) => (
                          <tr key={p.id} style={{ borderBottom: idx < cg.payments.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                            <td className="py-3 pr-4 font-bold text-xs" style={{ color: C.muted }}>
                              {p.is_deposit === 1 ? 'D' : p.installment_number - 1}
                            </td>
                            <td className="py-3 pr-4 font-semibold" style={{ color: '#1E293B' }}>
                              {p.is_deposit === 1 ? '💰 Initial Deposit' : `Instalment ${p.installment_number - 1}`}
                            </td>
                            <td className="py-3 pr-4 font-bold" style={{ color: '#1E293B' }}>
                              {formatCurrency(p.amount)}
                            </td>
                            <td className="py-3 pr-4" style={{ color: C.muted }}>
                              {formatDate(p.due_date)}
                            </td>
                            <td className="py-3 pr-4">
                              <StatusPill
                                status={p.status}
                                dueDate={p.due_date}
                                paidAtFormatted={p.paid_at ? formatDate(p.paid_at) : ''}
                              />
                              {p.status === 'paid' && p.payment_method === 'stripe_online' && (
                                <span className="ml-1 text-xs px-1.5 py-0.5 rounded" style={{ background: '#DBEAFE', color: '#1D4ED8' }}>
                                  Paid Online
                                </span>
                              )}
                            </td>
                            <td className="py-3 pr-4" style={{ color: C.muted }}>
                              {p.paid_at ? formatDate(p.paid_at) : '—'}
                            </td>
                            <td className="py-3 pr-4" style={{ color: C.muted }}>
                              {p.payment_reference ? `${String(p.payment_reference).slice(0, 20)}…` : '—'}
                            </td>
                            <td className="py-3 pl-2">
                              {canPay(p) && (
                                <button
                                  type="button"
                                  onClick={() => setPayModalInstallment(p)}
                                  className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                                  style={{ background: C.cyan, color: '#fff' }}
                                >
                                  {payLabel(p)}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </SectionCard>
              );
            })}

            {payments.filter((p) => p.status === 'paid').length > 0 && (
              <SectionCard
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                }
                title="Payment History"
                accent={C.green}
              >
                <div className="space-y-2">
                  {payments
                    .filter((p) => p.status === 'paid')
                    .sort((a, b) => new Date(b.paid_at!).getTime() - new Date(a.paid_at!).getTime())
                    .map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between py-2 px-3 rounded-lg"
                        style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}
                      >
                        <div>
                          <span className="font-semibold" style={{ color: '#1E293B' }}>
                            {p.installment_name}
                          </span>
                          <span className="ml-2 text-sm" style={{ color: C.muted }}>
                            {p.paid_at ? formatDate(p.paid_at) : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold" style={{ color: C.green }}>
                            {formatCurrency(p.amount)}
                          </span>
                          <span className="text-xs" style={{ color: C.muted }}>
                            {p.payment_reference ? `${String(p.payment_reference).slice(0, 12)}…` : ''}
                          </span>
                          <button
                            type="button"
                            onClick={() => window.print()}
                            className="text-xs px-2 py-1 rounded border"
                            style={{ borderColor: C.muted, color: C.muted }}
                          >
                            Print
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </SectionCard>
            )}
          </>
        )}
      </div>

      {payModalInstallment && (
        <InstallmentPaymentModal
          isOpen={!!payModalInstallment}
          onClose={() => setPayModalInstallment(null)}
          installment={payModalInstallment}
          onSuccess={() => {
            setPayModalInstallment(null);
            fetchPayments();
          }}
        />
      )}
    </>
  );
}
