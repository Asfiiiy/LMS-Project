'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const LogoutPage = () => {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(true);

  useEffect(() => {
    const performLogout = async () => {
      try {
        // Get token before clearing localStorage
        const token = localStorage.getItem('lms-token');
        
        // Call backend logout endpoint to log the event
        if (token) {
          try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 
                           (typeof window !== 'undefined' 
                             ? `${window.location.protocol}//${window.location.hostname}:5000/api`
                             : 'http://localhost:5000/api');
            
            await fetch(`${apiUrl}/login/logout`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });
          } catch (err) {
            // Don't block logout if API call fails
            console.error('Error calling logout API:', err);
          }
        }
      } catch (err) {
        // Don't block logout if there's an error
        console.error('Logout error:', err);
      } finally {
        // Clear all authentication data from localStorage
        localStorage.removeItem('lms-token');
        localStorage.removeItem('lms-user');

        // Dispatch custom events immediately for instant navbar update
        // Events are dispatched synchronously after localStorage is cleared
        window.dispatchEvent(new Event('logout'));
        window.dispatchEvent(new Event('auth-change'));

        // Show logout message for a moment before redirecting
        setTimeout(() => {
          setIsLoggingOut(false);
          router.push('/login');
        }, 1500);
      }
    };

    performLogout();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 py-4 sm:py-6" style={{ backgroundColor: '#D7E5FE' }}>
      <div className="bg-white p-6 sm:p-8 rounded-xl sm:rounded-2xl shadow-lg w-full max-w-md text-center">
        <div className="mb-4 sm:mb-6">
          <div className="inline-block animate-spin rounded-full h-12 w-12 sm:h-14 sm:w-14 md:h-16 md:w-16 border-b-3 sm:border-b-4 border-[#11CCEF] mb-3 sm:mb-4"></div>
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 px-2" style={{ color: '#464646' }}>
          {isLoggingOut ? 'Logging out...' : 'Logged out successfully'}
        </h1>
        <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6 px-2">
          {isLoggingOut 
            ? 'Please wait while we log you out...' 
            : 'Redirecting to login page...'}
        </p>
        {!isLoggingOut && (
          <div className="flex justify-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LogoutPage;

