'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const COOKIE_CONSENT_KEY = 'cookie_consent';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      setVisible(true);
    }
  }, []);

  const handleAccept = () => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      aria-describedby="cookie-banner-description"
      className="fixed bottom-0 left-0 right-0 z-[9999] bg-white text-gray-800 shadow-lg border-t border-gray-200"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p id="cookie-banner-description" className="text-sm sm:text-base text-gray-600 flex-1">
            We use essential cookies to make our Learning Management System work. By continuing, you accept our use of these cookies.
          </p>
          <div className="flex flex-wrap gap-3 sm:flex-shrink-0">
            <Link
              href="/cookie-policy"
              className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium text-[#11CCEF] border border-[#11CCEF] hover:bg-[#11CCEF] hover:text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[#11CCEF] focus:ring-offset-2 focus:ring-offset-white"
              aria-label="Learn more about our cookie policy"
            >
              Learn More
            </Link>
            <button
              type="button"
              onClick={handleAccept}
              className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium text-white bg-[#E51791] hover:bg-[#c4127a] rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[#E51791] focus:ring-offset-2 focus:ring-offset-white"
              aria-label="Accept essential cookies"
            >
              Accept Essential Cookies
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
