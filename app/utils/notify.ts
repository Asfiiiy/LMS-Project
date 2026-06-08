import Swal from 'sweetalert2';
import { showToast } from '@/app/components/Toast';

export const notify = {
  success: (message: string) => showToast(message, 'success'),
  error: (message: string) => showToast(message, 'error'),
  warning: (message: string) => showToast(message, 'warning'),
  info: (message: string) => showToast(message, 'info'),
  confirm: async (title: string, text: string, options?: { confirmText?: string; cancelText?: string }) => {
    const result = await Swal.fire({
      title,
      text,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#11CCEF',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: options?.confirmText ?? 'Yes, continue',
      cancelButtonText: options?.cancelText ?? 'Cancel'
    });
    return result.isConfirmed;
  },
  /** For success alerts that need more prominence than a toast */
  successAlert: (title: string, text?: string) => {
    return Swal.fire({
      icon: 'success',
      title,
      text: text ?? '',
      confirmButtonColor: '#11CCEF',
      timer: 2000,
      showConfirmButton: false
    });
  },
  /** For error alerts that need user acknowledgment */
  errorAlert: (title: string, text?: string) => {
    return Swal.fire({
      icon: 'error',
      title,
      text: text ?? '',
      confirmButtonColor: '#11CCEF'
    });
  },
  /** For info alerts */
  infoAlert: (title: string, text?: string) => {
    return Swal.fire({
      icon: 'info',
      title,
      text: text ?? '',
      confirmButtonColor: '#11CCEF'
    });
  }
};
