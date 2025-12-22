'use client';

import { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
}

// Global toast state
let toastListeners: Array<(toasts: Toast[]) => void> = [];
let toasts: Toast[] = [];

const notifyListeners = () => {
  toastListeners.forEach(listener => listener([...toasts]));
};

export const showToast = (message: string, type: ToastType = 'success', duration: number = 4000) => {
  const id = Math.random().toString(36).substring(7);
  const newToast: Toast = { id, message, type, duration };
  
  toasts = [...toasts, newToast];
  notifyListeners();
  
  // Auto remove after duration
  setTimeout(() => {
    removeToast(id);
  }, duration);
};

const removeToast = (id: string) => {
  toasts = toasts.filter(t => t.id !== id);
  notifyListeners();
};

const ToastContainer = () => {
  const [currentToasts, setCurrentToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const listener = (newToasts: Toast[]) => {
      setCurrentToasts(newToasts);
    };
    
    toastListeners.push(listener);
    setCurrentToasts([...toasts]);
    
    return () => {
      toastListeners = toastListeners.filter(l => l !== listener);
    };
  }, []);

  const getToastStyles = (type: ToastType) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getIcon = (type: ToastType) => {
    switch (type) {
      case 'success':
        return <span className="text-xl">✓</span>;
      case 'error':
        return <span className="text-xl">✕</span>;
      case 'warning':
        return <span className="text-xl">⚠</span>;
      case 'info':
        return <span className="text-xl">ℹ</span>;
      default:
        return <span className="text-xl">ℹ</span>;
    }
  };

  if (currentToasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] space-y-2 max-w-md w-full">
      {currentToasts.map((toast) => (
        <div
          key={toast.id}
          className={`${getToastStyles(toast.type)} border-2 rounded-lg shadow-lg p-4 flex items-start gap-3 animate-in slide-in-from-right duration-300`}
        >
          <div className="flex-shrink-0 mt-0.5">
            {getIcon(toast.type)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium break-words">{toast.message}</p>
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors text-lg font-bold"
            aria-label="Close"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;

