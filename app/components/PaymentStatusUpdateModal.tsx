'use client';

import { useState } from 'react';
import { apiService } from '@/app/services/api';

interface PaymentInstallment {
  id?: number;
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
  payment_method?: string | null;
  is_deposit?: number;
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

  const handleFieldChange = (index: number, field: keyof PaymentInstallment, value: string | number | null) => {
    const updated = [...installments];
    if (field === 'status') {
      updated[index].status = (value as string) as 'paid' | 'due' | 'overdue';
      if (value === 'paid' && !updated[index].paid_at) {
        updated[index].paid_at = new Date().toISOString().split('T')[0];
      }
      if (value !== 'paid') {
        updated[index].paid_at = null;
      }
    } else if (field === 'paid_at') {
      updated[index].paid_at = value as string | null;
    } else if (field === 'payment_reference') {
      updated[index].payment_reference = value as string | null;
    } else if (field === 'installment_name') {
      updated[index].installment_name = (value as string) || '';
    } else if (field === 'amount') {
      updated[index].amount = typeof value === 'number' ? value : parseFloat(String(value)) || 0;
    } else if (field === 'due_date') {
      updated[index].due_date = (value as string) || null;
    } else if (field === 'installment_number') {
      updated[index].installment_number = typeof value === 'number' ? value : parseInt(String(value), 10) || 1;
    }
    setInstallments(updated);
  };

  const handleAddRow = () => {
    const nextNum = installments.length > 0
      ? Math.max(...installments.map((i) => i.installment_number)) + 1
      : 1;
    setInstallments([
      ...installments,
      {
        installment_number: nextNum,
        installment_name: '',
        amount: 0,
        due_date: null,
        status: 'due',
        paid_at: null,
        payment_reference: null,
        notes: null
      }
    ]);
  };

  const handleRemoveRow = (index: number) => {
    if (installments.length <= 1) return;
    const updated = installments.filter((_, i) => i !== index);
    // Re-number
    updated.forEach((inst, i) => {
      inst.installment_number = i + 1;
    });
    setInstallments(updated);
  };

  const handleSave = async (index: number) => {
    const installment = installments[index];
    if (installment.status === 'paid' && !installment.paid_at) {
      setError('Payment date is required when status is "Paid"');
      return;
    }
    if (!installment.installment_name?.trim()) {
      setError('Installment name is required');
      return;
    }
    try {
      setSavingIndex(index);
      setError('');
      await saveFullPlan();
    } catch (error: unknown) {
      const err = error as { message?: string };
      setError(err.message || 'Failed to update payment. Please try again.');
    } finally {
      setSavingIndex(null);
    }
  };

  const saveFullPlan = async () => {
    const invalidPaid = installments.find((i) => i.status === 'paid' && !i.paid_at);
    if (invalidPaid) {
      setError('All paid installments must have a payment date');
      return;
    }
    const invalidName = installments.find((i) => !i.installment_name?.trim());
    if (invalidName) {
      setError('All installments must have a name');
      return;
    }
    const payload = installments.map((inst, idx) => ({
      installment_number: inst.installment_number || idx + 1,
      installment_name: inst.installment_name || `Installment ${idx + 1}`,
      amount: typeof inst.amount === 'number' ? inst.amount : parseFloat(String(inst.amount)) || 0,
      due_date: inst.due_date || null,
      status: inst.status || 'due',
      paid_at: inst.status === 'paid' ? (inst.paid_at || new Date().toISOString().split('T')[0]) : null,
      payment_reference: inst.payment_reference || null
    }));
    await apiService.savePaymentInstallments(
      studentCourse.course_id,
      studentCourse.student_id,
      'installment',
      payload
    );
  };

  const handleSaveAll = async () => {
    try {
      setSaving(true);
      setError('');
      await saveFullPlan();
      onSuccess();
    } catch (error: unknown) {
      const err = error as { message?: string };
      setError(err.message || 'Failed to update payment plan. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
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
                  <tr key={installment.id ?? `new-${index}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '2px'
                      }}>
                        <input
                          type="number"
                          min={1}
                          value={installment.installment_number}
                          onChange={(e) => handleFieldChange(index, 'installment_number', e.target.value ? parseInt(e.target.value, 10) : 1)}
                          className="px-2 py-1 text-xs border border-gray-300 rounded w-14 focus:outline-none focus:ring-1 focus:ring-[#11CCEF]"
                        />
                        {installment.is_deposit === 1 && (
                          <span style={{
                            fontSize: '9px',
                            background: '#fef3c7',
                            color: '#92400e',
                            borderRadius: '4px',
                            padding: '1px 4px',
                            fontWeight: '700',
                            whiteSpace: 'nowrap'
                          }}>
                            DEPOSIT
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={installment.installment_name || ''}
                        onChange={(e) => handleFieldChange(index, 'installment_name', e.target.value)}
                        placeholder="e.g. Enrolment Fee"
                        className="px-2 py-1 text-xs border border-gray-300 rounded min-w-[100px] focus:outline-none focus:ring-1 focus:ring-[#11CCEF]"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={installment.amount != null ? installment.amount : ''}
                        onChange={(e) => handleFieldChange(index, 'amount', parseFloat(e.target.value) || 0)}
                        className="px-2 py-1 text-xs border border-gray-300 rounded w-20 focus:outline-none focus:ring-1 focus:ring-[#11CCEF]"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="date"
                        value={installment.due_date ? new Date(installment.due_date).toISOString().split('T')[0] : ''}
                        onChange={(e) => handleFieldChange(index, 'due_date', e.target.value || null)}
                        className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#11CCEF]"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <select
                          value={installment.status}
                          onChange={(e) => handleFieldChange(index, 'status', e.target.value)}
                          className={`px-2 py-1 text-xs font-semibold rounded-full border-0 ${getStatusColor(installment.status)}`}
                        >
                          <option value="due">Due</option>
                          <option value="paid">Paid</option>
                          <option value="overdue">Overdue</option>
                        </select>
                        {installment.status === 'paid' && installment.payment_method === 'stripe_online' && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">Paid Online</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {installment.status === 'paid' ? (
                        <input
                          type="date"
                          value={installment.paid_at ? new Date(installment.paid_at).toISOString().split('T')[0] : ''}
                          onChange={(e) => handleFieldChange(index, 'paid_at', e.target.value)}
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
                        onChange={(e) => handleFieldChange(index, 'payment_reference', e.target.value)}
                        placeholder="Reference"
                        className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#11CCEF] min-w-[80px]"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 flex-wrap">
                      <button
                        onClick={() => handleSave(index)}
                        disabled={savingIndex === index || saving}
                        className="px-3 py-1 text-xs bg-[#11CCEF] text-white rounded hover:bg-[#0daed9] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {savingIndex === index ? 'Saving...' : 'Save'}
                      </button>
                      {installments.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(index)}
                          className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                          title="Remove row"
                        >
                          ×
                        </button>
                      )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4">
            <button
              type="button"
              onClick={handleAddRow}
              className="px-4 py-2 text-sm text-[#11CCEF] border border-[#11CCEF] rounded-lg hover:bg-[#11CCEF] hover:text-white transition-colors"
            >
              + Add Row
            </button>
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
                  Saving...
                </>
              ) : (
                'Complete Update'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentStatusUpdateModal;

