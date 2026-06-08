'use client';

import { useEffect, useState } from 'react';
import { getApiUrl } from '@/app/utils/apiUrl';
import PaymentStatusUpdateModal from './PaymentStatusUpdateModal';

interface PaymentInstallment {
  id: number;
  student_id: number;
  student_name?: string;
  student_email?: string;
  course_id: number;
  course_title?: string;
  installment_number: number;
  installment_name: string;
  amount: number;
  due_date: string | null;
  status: 'paid' | 'due' | 'overdue';
  paid_at: string | null;
  payment_reference: string | null;
  notes: string | null;
  payment_type: 'all_paid' | 'installment';
}

interface StudentCoursePayment {
  student_id: number;
  student_name: string;
  student_email: string;
  course_id: number;
  course_title: string;
  payment_type: 'all_paid' | 'installment';
  total_installments: number;
  paid_installments: number;
  due_installments: number;
  total_amount: number;
  paid_amount: number;
  due_amount: number;
  installments: PaymentInstallment[];
}

interface StudentFinancePaymentsModalProps {
  studentId: number;
  studentName: string;
  onClose: () => void;
}

export default function StudentFinancePaymentsModal({
  studentId,
  studentName,
  onClose
}: StudentFinancePaymentsModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [studentCoursePayments, setStudentCoursePayments] = useState<StudentCoursePayment[]>([]);
  const [selectedStudentCourse, setSelectedStudentCourse] = useState<StudentCoursePayment | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);

  useEffect(() => {
    const fetchInstallments = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${getApiUrl()}/api/tickets/student/${studentId}/payment-installments`,
          { headers: { Authorization: `Bearer ${localStorage.getItem('lms-token')}` } }
        );
        const data = await res.json();
        if (!data.success) {
          setError(data.message || 'Failed to load payment installments');
          return;
        }
        const rows: PaymentInstallment[] = data.installments || [];

        // Group by course (same structure as PaymentManagementView)
        const grouped = rows.reduce((acc: Record<string, StudentCoursePayment>, row) => {
          const key = String(row.course_id);
          if (!acc[key]) {
            acc[key] = {
              student_id: row.student_id,
              student_name: row.student_name || studentName,
              student_email: row.student_email || '',
              course_id: row.course_id,
              course_title: row.course_title || '',
              payment_type: (row.payment_type || 'installment') as 'all_paid' | 'installment',
              total_installments: 0,
              paid_installments: 0,
              due_installments: 0,
              total_amount: 0,
              paid_amount: 0,
              due_amount: 0,
              installments: []
            };
          }
          const amount = typeof row.amount === 'string' ? parseFloat(row.amount) : Number(row.amount) || 0;
          acc[key].installments.push(row);
          acc[key].total_installments++;
          acc[key].total_amount += amount;
          if (row.status === 'paid') {
            acc[key].paid_installments++;
            acc[key].paid_amount += amount;
          } else {
            acc[key].due_installments++;
            acc[key].due_amount += amount;
          }
          return acc;
        }, {});

        setStudentCoursePayments(
          Object.values(grouped).map((sc) => ({
            ...sc,
            installments: sc.installments.sort((a, b) => a.installment_number - b.installment_number)
          }))
        );
      } catch (e) {
        setError('Failed to load payment installments');
      } finally {
        setLoading(false);
      }
    };
    fetchInstallments();
  }, [studentId, studentName]);

  const handleUpdateStatus = (sc: StudentCoursePayment) => {
    setSelectedStudentCourse(sc);
    setShowStatusModal(true);
  };

  const refetchInstallments = async () => {
    try {
      const res = await fetch(
        `${getApiUrl()}/api/tickets/student/${studentId}/payment-installments`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('lms-token')}` } }
      );
      const data = await res.json();
      if (data.success && data.installments) {
        const rows: PaymentInstallment[] = data.installments;
        const grouped = rows.reduce((acc: Record<string, StudentCoursePayment>, row) => {
          const key = String(row.course_id);
          if (!acc[key]) {
            acc[key] = {
              student_id: row.student_id,
              student_name: row.student_name || studentName,
              student_email: row.student_email || '',
              course_id: row.course_id,
              course_title: row.course_title || '',
              payment_type: (row.payment_type || 'installment') as 'all_paid' | 'installment',
              total_installments: 0,
              paid_installments: 0,
              due_installments: 0,
              total_amount: 0,
              paid_amount: 0,
              due_amount: 0,
              installments: []
            };
          }
          const amount = typeof row.amount === 'string' ? parseFloat(row.amount) : Number(row.amount) || 0;
          acc[key].installments.push(row);
          acc[key].total_installments++;
          acc[key].total_amount += amount;
          if (row.status === 'paid') {
            acc[key].paid_installments++;
            acc[key].paid_amount += amount;
          } else {
            acc[key].due_installments++;
            acc[key].due_amount += amount;
          }
          return acc;
        }, {});
        setStudentCoursePayments(
          Object.values(grouped).map((sc) => ({
            ...sc,
            installments: sc.installments.sort((a, b) => a.installment_number - b.installment_number)
          }))
        );
      }
    } catch (e) {
      // no-op
    }
  };

  const handleStatusUpdated = () => {
    setShowStatusModal(false);
    setSelectedStudentCourse(null);
    refetchInstallments();
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'due': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateString;
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-[#E51791] to-[#c4127a] text-white p-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            💳 Payments – {studentName}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-12 text-center text-gray-500">Loading...</div>
          ) : error ? (
            <div className="py-8 text-center text-red-600">{error}</div>
          ) : studentCoursePayments.length === 0 ? (
            <div className="py-8 text-center text-gray-500">No payment plans found for this student.</div>
          ) : (
            <div className="space-y-6">
              {studentCoursePayments.map((sc) => (
                <div key={sc.course_id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{sc.course_title}</h3>
                      <p className="text-sm text-gray-600 mt-0.5">
                        {sc.payment_type === 'all_paid' ? 'All paid' : `${sc.paid_installments} / ${sc.total_installments} paid`}
                        {' • '}
                        {formatCurrency(sc.paid_amount)} paid, {formatCurrency(sc.due_amount)} due
                      </p>
                    </div>
                    <button
                      onClick={() => handleUpdateStatus(sc)}
                      className="px-4 py-2 bg-[#E51791] text-white rounded-lg text-sm font-medium hover:bg-[#c4127a] transition-colors"
                    >
                      Update Status
                    </button>
                  </div>
                  <ul className="divide-y divide-gray-100">
                    {sc.installments.map((inst) => (
                      <li
                        key={inst.id}
                        className="px-4 py-3 flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-sm font-medium text-gray-900">
                            {inst.installment_name}
                          </span>
                          <span className="text-sm text-gray-600">
                            {formatCurrency(typeof inst.amount === 'string' ? parseFloat(inst.amount) : inst.amount)}
                          </span>
                          <span className="text-xs text-gray-500">
                            Due: {formatDate(inst.due_date)}
                          </span>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(inst.status)}`}>
                          {inst.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showStatusModal && selectedStudentCourse && (
        <PaymentStatusUpdateModal
          studentCourse={selectedStudentCourse}
          onClose={() => {
            setShowStatusModal(false);
            setSelectedStudentCourse(null);
            refetchInstallments();
          }}
          onSuccess={() => {
            handleStatusUpdated();
          }}
        />
      )}
    </div>
  );
}
