'use client';

import { useState } from 'react';
import { apiService } from '@/app/services/api';

interface PaymentInstallment {
  id: number;
  student_id: number;
  student_name: string;
  student_email: string;
  course_id: number;
  course_title: string;
  installment_number: number;
  installment_name: string;
  amount: number;
  due_date: string | null;
  status: 'paid' | 'due' | 'overdue';
  paid_at: string | null;
  payment_reference: string | null;
  notes: string | null;
}

interface PaymentStatusUpdateProps {
  payment: PaymentInstallment;
  onClose: () => void;
  onSuccess: () => void;
}

const PaymentStatusUpdate = ({ payment, onClose, onSuccess }: PaymentStatusUpdateProps) => {
  const [status, setStatus] = useState<'paid' | 'due' | 'overdue'>(payment.status);
  const [paidAt, setPaidAt] = useState<string>(
    payment.paid_at ? new Date(payment.paid_at).toISOString().split('T')[0] : ''
  );
  const [paymentReference, setPaymentReference] = useState<string>(payment.payment_reference || '');
  const [notes, setNotes] = useState<string>(payment.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');

      // Validate paid_at if status is paid
      if (status === 'paid' && !paidAt) {
        setError('Payment date is required when status is "Paid"');
        setSaving(false);
        return;
      }

      await apiService.updatePaymentStatus(
        payment.id,
        status,
        status === 'paid' ? paidAt : undefined,
        paymentReference || undefined,
        notes || undefined
      );

      onSuccess();
    } catch (error: any) {
      console.error('Error updating payment status:', error);
      setError(error.message || 'Failed to update payment status. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#11CCEF] to-[#0daed9] text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Update Payment Status</h2>
              <p className="text-blue-100 mt-1">
                {payment.student_name} - {payment.course_title}
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
          <div className="space-y-6">
            {/* Payment Info */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Installment</label>
                  <p className="text-gray-900 font-semibold">
                    {payment.installment_number}. {payment.installment_name}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Amount</label>
                  <p className="text-gray-900 font-semibold">{formatCurrency(payment.amount)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Due Date</label>
                  <p className="text-gray-900">
                    {payment.due_date
                      ? new Date(payment.due_date).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })
                      : 'Not set'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Current Status</label>
                  <p className="text-gray-900 capitalize">{payment.status}</p>
                </div>
              </div>
            </div>

            {/* Status Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status <span className="text-red-500">*</span>
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'paid' | 'due' | 'overdue')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
              >
                <option value="due">Due</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>

            {/* Payment Date (required if paid) */}
            {status === 'paid' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={paidAt}
                  onChange={(e) => setPaidAt(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
                  required
                />
              </div>
            )}

            {/* Payment Reference */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Reference (Optional)
              </label>
              <input
                type="text"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="e.g., Transaction ID, Check Number, etc."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any additional notes..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}
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
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-gradient-to-r from-[#11CCEF] to-[#0daed9] text-white rounded-lg hover:from-[#0daed9] hover:to-[#11CCEF] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentStatusUpdate;


