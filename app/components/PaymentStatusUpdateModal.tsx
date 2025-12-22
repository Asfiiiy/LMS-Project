'use client';

import { useState, useEffect } from 'react';
import { apiService } from '@/app/services/api';

interface PaymentInstallment {
  id: number;
  student_id?: number;
  student_name?: string;
  student_email?: string;
  course_id?: number;
  course_title?: string;
  installment_number: number;
  installment_name: string;
  amount: number;
  due_date: string | null;
  status: 'paid' | 'due' | 'overdue';
  paid_at: string | null;
  payment_reference: string | null;
  notes: string | null;
  payment_type?: 'all_paid' | 'installment';
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

interface PaymentStatusUpdateModalProps {
  studentCourse: StudentCoursePayment;
  onClose: () => void;
  onSuccess: () => void;
}

const PaymentStatusUpdateModal = ({ studentCourse, onClose, onSuccess }: PaymentStatusUpdateModalProps) => {
  const [installments, setInstallments] = useState<PaymentInstallment[]>(studentCourse.installments);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savingIndex, setSavingIndex] = useState<number | null>(null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      case 'due':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleStatusChange = (index: number, field: 'status' | 'paid_at' | 'payment_reference', value: string) => {
    const updated = [...installments];
    if (field === 'status') {
      updated[index].status = value as 'paid' | 'due' | 'overdue';
      // If changing to paid and no paid_at, set to today
      if (value === 'paid' && !updated[index].paid_at) {
        updated[index].paid_at = new Date().toISOString().split('T')[0];
      }
      // If changing from paid, clear paid_at
      if (value !== 'paid') {
        updated[index].paid_at = null;
      }
    } else if (field === 'paid_at') {
      updated[index].paid_at = value || null;
    } else if (field === 'payment_reference') {
      updated[index].payment_reference = value || null;
    }
    setInstallments(updated);
  };

  const handleSave = async (index: number) => {
    const installment = installments[index];
    
    // Validate paid_at if status is paid
    if (installment.status === 'paid' && !installment.paid_at) {
      setError('Payment date is required when status is "Paid"');
      return;
    }

    try {
      setSavingIndex(index);
      setError('');
      
      await apiService.updatePaymentStatus(
        installment.id,
        installment.status,
        installment.status === 'paid' ? installment.paid_at || undefined : undefined,
        installment.payment_reference || undefined,
        installment.notes || undefined
      );

      // Update local state
      const updated = [...installments];
      updated[index] = { ...installment };
      setInstallments(updated);
    } catch (error: any) {
      console.error('Error updating payment status:', error);
      setError(error.message || 'Failed to update payment status. Please try again.');
    } finally {
      setSavingIndex(null);
    }
  };

  const handleSaveAll = async () => {
    try {
      setSaving(true);
      setError('');

      // Validate all paid installments have paid_at
      const invalidPaid = installments.find(
        (inst, idx) => inst.status === 'paid' && !inst.paid_at
      );
      if (invalidPaid) {
        setError('All paid installments must have a payment date');
        setSaving(false);
        return;
      }

      // Save all installments
      await Promise.all(
        installments.map((inst) =>
          apiService.updatePaymentStatus(
            inst.id,
            inst.status,
            inst.status === 'paid' ? inst.paid_at || undefined : undefined,
            inst.payment_reference || undefined,
            inst.notes || undefined
          )
        )
      );

      onSuccess();
    } catch (error: any) {
      console.error('Error updating payment statuses:', error);
      setError(error.message || 'Failed to update payment statuses. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#11CCEF] to-[#0daed9] text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Update Payment Status</h2>
              <p className="text-blue-100 mt-1">
                {studentCourse.student_name} - {studentCourse.course_title}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 text-2xl font-bold"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    No.
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Installment
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Due Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Paid At
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Reference
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {installments.map((installment, index) => (
                  <tr key={installment.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {installment.installment_number}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {installment.installment_name}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {formatCurrency(installment.amount)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(installment.due_date)}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={installment.status}
                        onChange={(e) => handleStatusChange(index, 'status', e.target.value)}
                        className={`px-2 py-1 text-xs font-semibold rounded-full border-0 ${getStatusColor(installment.status)}`}
                      >
                        <option value="due">Due</option>
                        <option value="paid">Paid</option>
                        <option value="overdue">Overdue</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {installment.status === 'paid' ? (
                        <input
                          type="date"
                          value={installment.paid_at ? new Date(installment.paid_at).toISOString().split('T')[0] : ''}
                          onChange={(e) => handleStatusChange(index, 'paid_at', e.target.value)}
                          max={new Date().toISOString().split('T')[0]}
                          className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#11CCEF]"
                        />
                      ) : (
                        <span className="text-sm text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={installment.payment_reference || ''}
                        onChange={(e) => handleStatusChange(index, 'payment_reference', e.target.value)}
                        placeholder="Reference"
                        className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#11CCEF] w-32"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleSave(index)}
                        disabled={savingIndex === index}
                        className="px-3 py-1 text-xs bg-[#11CCEF] text-white rounded hover:bg-[#0daed9] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {savingIndex === index ? 'Saving...' : 'Save'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 bg-gray-50">
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={saving}
            >
              Close
            </button>
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="px-6 py-2 bg-gradient-to-r from-[#11CCEF] to-[#0daed9] text-white rounded-lg hover:from-[#0daed9] hover:to-[#11CCEF] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Saving All...
                </>
              ) : (
                'Save All Changes'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentStatusUpdateModal;

