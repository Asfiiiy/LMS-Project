'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import PrivacyPolicyContent from '@/app/components/policy-content/PrivacyPolicyContent';
import TermsConditionsContent from '@/app/components/policy-content/TermsConditionsContent';

interface PolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'privacy' | 'terms';
}

export default function PolicyModal({ isOpen, onClose, type }: PolicyModalProps) {
  const router = useRouter();

  const handleNavigate = (path: string) => {
    onClose();
    router.push(path);
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const title = type === 'privacy' ? 'Privacy Policy' : 'Terms & Conditions';
  const Content = type === 'privacy' ? PrivacyPolicyContent : TermsConditionsContent;

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="policy-modal-title"
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-[#11CCEF] to-[#0daed9] text-white px-4 sm:px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 id="policy-modal-title" className="text-xl sm:text-2xl font-bold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-white hover:text-gray-200 text-2xl font-bold leading-none p-1"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50">
          <Content onClose={onClose} onNavigate={handleNavigate} />
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
}
