'use client';

import { useEffect, useState } from 'react';
import { apiService } from '@/app/services/api';
import PaymentStatusUpdateModal from './PaymentStatusUpdateModal';

interface PaymentInstallment {
  id: number;
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
  course_id: number;
  course_title: string;
  payment_type: 'all_paid' | 'installment';
  paid_installments: number;
  total_installments: number;
  paid_amount: number;
  due_amount: number;
  installments: PaymentInstallment[];
}

interface StudentPaymentsTabProps {
  studentId: number;
  studentName: string;
  canEdit?: boolean;
}

export default function StudentPaymentsTab({
  studentId,
  studentName,
  canEdit = false,
}: StudentPaymentsTabProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [studentCoursePayments, setStudentCoursePayments] = useState<StudentCoursePayment[]>([]);
  const [selectedStudentCourse, setSelectedStudentCourse] = useState<StudentCoursePayment | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);

  const loadPayments = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getTicketsStudentPaymentInstallments(studentId);
      if (!data?.success) {
        setError(data?.message || 'Failed to load payments');
        return;
      }
      const rows: PaymentInstallment[] = data.installments || [];
      const grouped = rows.reduce((acc: Record<string, StudentCoursePayment>, row) => {
        const key = String(row.course_id);
        if (!acc[key]) {
          acc[key] = {
            course_id: row.course_id,
            course_title: row.course_title || '',
            payment_type: (row.payment_type || 'installment') as 'all_paid' | 'installment',
            total_installments: 0,
            paid_installments: 0,
            paid_amount: 0,
            due_amount: 0,
            installments: [],
          };
        }
        const amount = typeof row.amount === 'string' ? parseFloat(row.amount) : Number(row.amount) || 0;
        acc[key].installments.push(row);
        acc[key].total_installments++;
        if (row.status === 'paid') {
          acc[key].paid_installments++;
          acc[key].paid_amount += amount;
        } else {
          acc[key].due_amount += amount;
        }
        return acc;
      }, {});
      setStudentCoursePayments(
        Object.values(grouped).map((sc) => ({
          ...sc,
          installments: sc.installments.sort((a, b) => a.installment_number - b.installment_number),
        }))
      );
    } catch {
      setError('Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, [studentId]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—';
    try {
      return new Date(dateString).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateString;
    }
  };

  const statusClass = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  if (loading) {
    return <div className="py-10 text-center text-gray-500 text-sm">Loading payments…</div>;
  }
  if (error) {
    return <div className="py-8 text-center text-red-600 text-sm">{error}</div>;
  }
  if (studentCoursePayments.length === 0) {
    return <div className="py-8 text-center text-gray-500 text-sm">No payment plans for this student.</div>;
  }

  return (
    <>
      <div className="space-y-4">
        {studentCoursePayments.map((sc) => (
          <div key={sc.course_id} className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 flex flex-wrap items-center justify-between gap-2 border-b">
              <div>
                <h3 className="font-semibold text-gray-900 m-0">{sc.course_title}</h3>
                <p className="text-xs text-gray-600 mt-1 mb-0">
                  {sc.payment_type === 'all_paid'
                    ? 'All paid'
                    : `${sc.paid_installments} / ${sc.total_installments} installments paid`}
                  {' · '}
                  {formatCurrency(sc.paid_amount)} paid · {formatCurrency(sc.due_amount)} due
                </p>
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStudentCourse(sc);
                    setShowStatusModal(true);
                  }}
                  className="px-3 py-1.5 bg-[#E51791] text-white rounded-lg text-xs font-semibold hover:opacity-90"
                >
                  Update status
                </button>
              )}
            </div>
            <ul className="divide-y divide-gray-100">
              {sc.installments.map((inst) => (
                <li key={inst.id} className="px-4 py-3 flex flex-wrap justify-between gap-2 text-sm">
                  <span className="font-medium text-gray-900">{inst.installment_name}</span>
                  <span className="text-gray-600">{formatCurrency(Number(inst.amount))}</span>
                  <span className="text-xs text-gray-500">Due {formatDate(inst.due_date)}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusClass(inst.status)}`}>
                    {inst.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {canEdit && selectedStudentCourse && showStatusModal && (
        <PaymentStatusUpdateModal
          studentCourse={{
            student_id: studentId,
            student_name: studentName,
            student_email: '',
            course_id: selectedStudentCourse.course_id,
            course_title: selectedStudentCourse.course_title,
            payment_type: selectedStudentCourse.payment_type,
            total_installments: selectedStudentCourse.total_installments,
            paid_installments: selectedStudentCourse.paid_installments,
            due_installments: selectedStudentCourse.total_installments - selectedStudentCourse.paid_installments,
            total_amount: selectedStudentCourse.paid_amount + selectedStudentCourse.due_amount,
            paid_amount: selectedStudentCourse.paid_amount,
            due_amount: selectedStudentCourse.due_amount,
            installments: selectedStudentCourse.installments,
          }}
          onClose={() => {
            setShowStatusModal(false);
            setSelectedStudentCourse(null);
          }}
          onSuccess={() => {
            setShowStatusModal(false);
            setSelectedStudentCourse(null);
            loadPayments();
          }}
        />
      )}
    </>
  );
}
