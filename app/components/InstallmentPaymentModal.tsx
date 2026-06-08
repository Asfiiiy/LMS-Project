'use client';

import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { apiService } from '@/app/services/api';
import { showToast } from './Toast';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

const CARD_OPTIONS = {
  style: {
    base: {
      color: '#32325d',
      fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
      fontSmoothing: 'antialiased',
      fontSize: '16px',
      '::placeholder': { color: '#aab7c4' },
    },
    invalid: {
      color: '#fa755a',
      iconColor: '#fa755a',
    },
  },
};

function PaymentForm({
  installmentId,
  installmentName,
  amount,
  onSuccess,
  onClose,
}: {
  installmentId: number;
  installmentName: string;
  amount: number;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    setError(null);
    try {
      const res = await apiService.createInstallmentPaymentIntent(installmentId);
      if (!res?.success || !res.clientSecret) {
        throw new Error(res?.message || 'Failed to create payment intent');
      }
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(res.clientSecret, {
        payment_method: { card: elements.getElement(CardElement)! },
      });
      if (stripeError) {
        setError(stripeError.message || 'Payment failed');
        setProcessing(false);
        return;
      }
      if (paymentIntent?.status === 'succeeded') {
        await apiService.confirmInstallmentPayment(installmentId, res.paymentIntentId);
        showToast(`Payment successful! £${amount.toFixed(2)} paid.`, 'success');
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'Payment failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Card Details</label>
        <div className="border border-gray-300 rounded-lg p-4 bg-white">
          <CardElement options={CARD_OPTIONS} />
        </div>
      </div>
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
      )}
      <div className="flex justify-between items-center pt-2">
        <span className="font-semibold text-gray-800">Total: £{amount.toFixed(2)}</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!stripe || processing}
            className="px-4 py-2 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? 'Processing…' : `Pay £${amount.toFixed(2)}`}
          </button>
        </div>
      </div>
    </form>
  );
}

export default function InstallmentPaymentModal({
  isOpen,
  onClose,
  installment,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  installment: { id: number; installment_name: string; amount: number };
  onSuccess: () => void;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-900">Pay Installment</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl leading-none">
            ×
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          {installment.installment_name} — £{parseFloat(String(installment.amount)).toFixed(2)}
        </p>
        <Elements stripe={stripePromise}>
          <PaymentForm
            installmentId={installment.id}
            installmentName={installment.installment_name}
            amount={parseFloat(String(installment.amount))}
            onSuccess={onSuccess}
            onClose={onClose}
          />
        </Elements>
        <p className="text-xs text-gray-500 mt-4">Secured by Stripe. We never store your card details.</p>
      </div>
    </div>
  );
}
