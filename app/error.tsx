'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  const goToDashboard = () => {
    window.location.href = '/dashboard';
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
        <p className="text-gray-600 mb-6">
          A client-side error occurred. This can happen when switching between accounts or during navigation.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={goToDashboard}
            className="px-6 py-3 bg-[#11CCEF] text-white font-semibold rounded-lg hover:bg-[#0fb8d8] transition-colors"
          >
            Go to Dashboard
          </button>
          <button
            onClick={() => reset()}
            className="px-6 py-3 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
