'use client';

import { useEffect, useState } from 'react';

export type SweetAlertType = 'success' | 'error' | 'warning' | 'info';

interface SweetAlert {
  id: string;
  title: string;
  text?: string;
  type: SweetAlertType;
  showConfirmButton?: boolean;
  confirmButtonText?: string;
  showCancelButton?: boolean;
  cancelButtonText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  timer?: number;
}

// Global state
let alertListeners: Array<(alert: SweetAlert | null) => void> = [];
let currentAlert: SweetAlert | null = null;

const notifyListeners = () => {
  alertListeners.forEach(listener => listener(currentAlert));
};

export const showSweetAlert = (
  title: string,
  text?: string,
  type: SweetAlertType = 'success',
  options?: {
    showConfirmButton?: boolean;
    confirmButtonText?: string;
    showCancelButton?: boolean;
    cancelButtonText?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
    timer?: number;
  }
) => {
  const id = Math.random().toString(36).substring(7);
  const alert: SweetAlert = {
    id,
    title,
    text,
    type,
    showConfirmButton: options?.showConfirmButton !== false,
    confirmButtonText: options?.confirmButtonText || 'OK',
    showCancelButton: options?.showCancelButton || false,
    cancelButtonText: options?.cancelButtonText || 'Cancel',
    onConfirm: options?.onConfirm,
    onCancel: options?.onCancel,
    timer: options?.timer
  };

  currentAlert = alert;
  notifyListeners();

  // Auto close if timer is set
  if (options?.timer) {
    setTimeout(() => {
      closeSweetAlert();
      if (options?.onConfirm) {
        options.onConfirm();
      }
    }, options.timer);
  }
};

export const closeSweetAlert = () => {
  currentAlert = null;
  notifyListeners();
};

const SweetAlertContainer = () => {
  const [alert, setAlert] = useState<SweetAlert | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const listener = (newAlert: SweetAlert | null) => {
      if (newAlert) {
        setAlert(newAlert);
        setIsVisible(true);
        setIsAnimating(true);
      } else {
        setIsAnimating(false);
        setTimeout(() => {
          setIsVisible(false);
          setAlert(null);
        }, 300);
      }
    };

    alertListeners.push(listener);
    if (currentAlert) {
      listener(currentAlert);
    }

    return () => {
      alertListeners = alertListeners.filter(l => l !== listener);
    };
  }, []);

  const handleConfirm = () => {
    if (alert?.onConfirm) {
      alert.onConfirm();
    }
    closeSweetAlert();
  };

  const handleCancel = () => {
    if (alert?.onCancel) {
      alert.onCancel();
    }
    closeSweetAlert();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      closeSweetAlert();
    }
  };

  if (!alert || !isVisible) return null;

  const getIcon = () => {
    switch (alert.type) {
      case 'success':
        return (
          <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-green-100">
            <svg className="h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        );
      case 'error':
        return (
          <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-red-100">
            <svg className="h-12 w-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        );
      case 'warning':
        return (
          <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-yellow-100">
            <svg className="h-12 w-12 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        );
      case 'info':
        return (
          <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-blue-100">
            <svg className="h-12 w-12 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
    }
  };

  const getButtonColors = () => {
    switch (alert.type) {
      case 'success':
        return 'bg-green-500 hover:bg-green-600 focus:ring-green-500';
      case 'error':
        return 'bg-red-500 hover:bg-red-600 focus:ring-red-500';
      case 'warning':
        return 'bg-yellow-500 hover:bg-yellow-600 focus:ring-yellow-500';
      case 'info':
        return 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-500';
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-opacity duration-300 ${
        isAnimating ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={handleBackdropClick}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
    >
      <div
        className={`bg-white rounded-lg shadow-2xl max-w-md w-full p-6 transform transition-all duration-300 ${
          isAnimating ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div className="mb-4">
          {getIcon()}
        </div>

        {/* Title */}
        <h3 className="text-2xl font-semibold text-gray-900 text-center mb-3">
          {alert.title}
        </h3>

        {/* Text */}
        {alert.text && (
          <p className="text-gray-600 text-center mb-6">
            {alert.text}
          </p>
        )}

        {/* Buttons */}
        <div className="flex gap-3 justify-center">
          {alert.showCancelButton && (
            <button
              onClick={handleCancel}
              className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-gray-300"
            >
              {alert.cancelButtonText}
            </button>
          )}
          {alert.showConfirmButton && (
            <button
              onClick={handleConfirm}
              className={`px-6 py-2.5 text-white rounded-lg transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 ${getButtonColors()}`}
            >
              {alert.confirmButtonText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SweetAlertContainer;

