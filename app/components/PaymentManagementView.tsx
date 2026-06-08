'use client';

import { useState, useEffect, useMemo } from 'react';
import { apiService } from '@/app/services/api';
import { useSocket } from '@/app/contexts/SocketContext';
import PaymentStatusUpdateModal from './PaymentStatusUpdateModal';

interface PaymentInstallment {
  id: number;
  student_id: number;
  student_name: string;
  student_email: string;
  course_id: number;
  course_title: string;
  installment_number: number;
  is_deposit: number;
  installment_name: string;
  amount: number;
  due_date: string | null;
  status: 'paid' | 'due' | 'overdue';
  paid_at: string | null;
  payment_reference: string | null;
  payment_method?: string | null;
  notes: string | null;
  payment_type: 'all_paid' | 'installment';
  created_at: string;
  updated_at: string;
}

interface PaymentStats {
  total_students: number;
  paid_installments: number;
  pending_installments: number;
  total_deposits: number;
  total_deposits_amount?: number;
  paid_deposits_count: number;
  paid_deposit_amount: number;
  total_installments: number;
  paid_installments_count: number;
  paid_installments_amount: number;
  overdue_amount: number;
  overdue_students?: number;
  students_with_overdue: number;
  upcoming_7_days: number;
  upcoming_30_days: number;
  fully_paid: number;
  partially_paid: number;
  no_payment_yet: number;
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
  total_installment_amount?: number;
  paid_installment_amount?: number;
  deposit_amount?: number;
  deposit_paid?: number;
  installments: PaymentInstallment[];
}

type PaymentUserRole = 'Admin' | 'Assessor' | 'Certificate Manager' | 'Accounts Manager' | 'Operation Manager' | 'Administrative Manager' | 'Admission Manager' | 'Team Member';

interface PaymentManagementViewProps {
  userRole: PaymentUserRole;
  userId?: number;
}

const PAYMENT_FULL_ACCESS_ROLES: PaymentUserRole[] = ['Admin', 'Certificate Manager', 'Accounts Manager', 'Operation Manager', 'Administrative Manager', 'Admission Manager', 'Team Member'];

const PaymentManagementView = ({ userRole, userId }: PaymentManagementViewProps) => {
  const socket = useSocket();
  const [payments, setPayments] = useState<PaymentInstallment[]>([]);
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [courseFilter, setCourseFilter] = useState<string>('');
  const [selectedStudentCourse, setSelectedStudentCourse] = useState<StudentCoursePayment | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [activeCardFilter, setActiveCardFilter] = useState<string | null>(null);
  const [showDepositsOnly, setShowDepositsOnly] = useState(false);
  
  // Month/Year filter state
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  
  // Date range filter state
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageLimit, setPageLimit] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Sorting state
  const [sortConfig, setSortConfig] = useState<{
    key: keyof StudentCoursePayment | 'payment_progress' | 'payment_status';
    direction: 'asc' | 'desc';
  }>({
    key: 'student_name',
    direction: 'asc'
  });

  // Fetch data only on initial load
  useEffect(() => {
    fetchData();
    if (PAYMENT_FULL_ACCESS_ROLES.includes(userRole)) {
      fetchStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only fetch on mount - filtering is done client-side

  useEffect(() => {
    if (PAYMENT_FULL_ACCESS_ROLES.includes(userRole)) {
      fetchStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate, selectedMonth, selectedYear]);

  // Real-time: refetch when student pays online
  useEffect(() => {
    if (!socket) return;
    const onInstallmentPaid = () => {
      fetchData();
      if (PAYMENT_FULL_ACCESS_ROLES.includes(userRole)) fetchStats();
    };
    socket.on('installment_paid', onInstallmentPaid);
    return () => { socket.off('installment_paid', onInstallmentPaid); };
  }, [socket, userRole]);

  // Reset to page 1 when filters change (no API call needed)
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeCardFilter, courseFilter, selectedMonth, selectedYear, fromDate, toDate]);

  const fetchStats = async () => {
    try {
      setLoadingStats(true);
      const response = await apiService.getPaymentStats({
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        month: selectedMonth || undefined,
        year: selectedYear || undefined
      });
      if (response?.success) {
        setStats(response.stats);
      }
    } catch (error) {
      // Error fetching payment stats
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');

      // Determine status filter from activeCardFilter
      let statusFilter: string | undefined;
      if (activeCardFilter === 'fully-paid') {
        statusFilter = 'paid';
      } else if (activeCardFilter === 'partially-paid') {
        // For partially paid, we'll filter on frontend since backend doesn't support this directly
        statusFilter = undefined;
      } else if (activeCardFilter === 'overdue') {
        // For overdue, don't filter by status on backend - fetch all and filter on frontend
        // This allows us to catch both status='overdue' and status='due' with past due_date
        statusFilter = undefined;
      } else if (activeCardFilter === 'due') {
        statusFilter = 'due';
      } else if (activeCardFilter === 'upcoming-7-days' || activeCardFilter === 'upcoming-30-days') {
        // For upcoming filters, fetch all non-paid installments and filter on frontend
        statusFilter = undefined;
      }

      let response;
      if (PAYMENT_FULL_ACCESS_ROLES.includes(userRole)) {
        // Fetch all payments at once for client-side filtering (limit: 50000)
        response = await apiService.getAllPayments(statusFilter, searchTerm || undefined, 1, 50000);
      } else if (userRole === 'Assessor' && userId) {
        // Fetch all payments at once for client-side filtering (limit: 50000)
        response = await apiService.getTutorPayments(userId, statusFilter, searchTerm || undefined, 1, 50000);
      } else {
        setError('User ID required for assessor');
        return;
      }

      if (response?.success) {
        setPayments(response.installments || []);
        // Note: Pagination is now done client-side, so we ignore backend pagination values
      } else {
        setError(response?.message || 'Failed to fetch payments');
      }
    } catch (error) {
      setError('Failed to connect to API. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (studentId: number, courseId: number) => {
    try {
      // Fetch all installments for this student-course
      const response = await apiService.getStudentInstallmentsByAdmin(studentId);
      if (response?.success) {
        // The API returns a flat array of installments
        const allInstallments: PaymentInstallment[] = response.installments || [];
        const studentInstallments = allInstallments.filter(
          (inst: PaymentInstallment) => inst.course_id === courseId
        );
        
        if (studentInstallments.length === 0) {
          setError('No installments found for this student-course');
          return;
        }
        
        // Group and calculate totals
        const totalInstallments = studentInstallments.length;
        const paidInstallments = studentInstallments.filter((inst: PaymentInstallment) => inst.status === 'paid').length;
        const dueInstallments = studentInstallments.filter((inst: PaymentInstallment) => 
          inst.status === 'due' || inst.status === 'overdue'
        ).length;
        
        const totalAmount = studentInstallments.reduce((sum: number, inst: PaymentInstallment) => sum + inst.amount, 0);
        const paidAmount = studentInstallments
          .filter((inst: PaymentInstallment) => inst.status === 'paid')
          .reduce((sum: number, inst: PaymentInstallment) => sum + inst.amount, 0);
        const dueAmount = totalAmount - paidAmount;
        
        const studentCourse: StudentCoursePayment = {
          student_id: studentId,
          student_name: studentInstallments[0]?.student_name || '',
          student_email: studentInstallments[0]?.student_email || '',
          course_id: courseId,
          course_title: studentInstallments[0]?.course_title || '',
          payment_type: studentInstallments[0]?.payment_type || 'installment',
          total_installments: totalInstallments,
          paid_installments: paidInstallments,
          due_installments: dueInstallments,
          total_amount: totalAmount,
          paid_amount: paidAmount,
          due_amount: dueAmount,
          installments: studentInstallments.sort((a: PaymentInstallment, b: PaymentInstallment) => 
            a.installment_number - b.installment_number
          )
        };
        
        setSelectedStudentCourse(studentCourse);
        setShowStatusModal(true);
      }
    } catch (error) {
      setError('Failed to load payment details');
    }
  };

  const handleStatusUpdated = () => {
    setShowStatusModal(false);
    setSelectedStudentCourse(null);
    fetchData();
    if (PAYMENT_FULL_ACCESS_ROLES.includes(userRole)) {
      fetchStats();
    }
  };

  const handleSort = (key: keyof StudentCoursePayment | 'payment_progress' | 'payment_status') => {
    setSortConfig({
      key,
      direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
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

  // Generate months and years for filter dropdowns
  const generateMonthsAndYears = () => {
    const months = [
      { value: '01', label: 'January' },
      { value: '02', label: 'February' },
      { value: '03', label: 'March' },
      { value: '04', label: 'April' },
      { value: '05', label: 'May' },
      { value: '06', label: 'June' },
      { value: '07', label: 'July' },
      { value: '08', label: 'August' },
      { value: '09', label: 'September' },
      { value: '10', label: 'October' },
      { value: '11', label: 'November' },
      { value: '12', label: 'December' }
    ];

    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear; i >= currentYear - 5; i--) {
      years.push(i.toString());
    }

    return { months, years };
  };

  const { months, years } = generateMonthsAndYears();

  // Function to download CSV
  const downloadCSV = () => {
    // Use filteredStudentCoursePayments (ALL filtered results, not paginated)
    const csvData = filteredStudentCoursePayments.map((studentCourse) => ({
      'Student': studentCourse.student_name,
      'Student Email': studentCourse.student_email,
      'Course': studentCourse.course_title,
      'Plan': studentCourse.payment_type === 'all_paid' ? 'All Paid' : 'Installment',
      'Total Installments': studentCourse.total_installments,
      'Paid Installments': studentCourse.paid_installments,
      'Due Installments': studentCourse.due_installments,
      'Total Amount': `£${studentCourse.total_amount.toFixed(2)}`,
      'Paid Amount': `£${studentCourse.paid_amount.toFixed(2)}`,
      'Due Amount': `£${studentCourse.due_amount.toFixed(2)}`,
      'Payment Progress': `${Math.round((studentCourse.paid_amount / studentCourse.total_amount) * 100)}%`
    }));

    if (csvData.length === 0) {
      alert('No data to export');
      return;
    }

    // Create CSV header
    const headers = Object.keys(csvData[0]);
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => 
        headers.map(header => {
          const value = row[header as keyof typeof row];
          // Escape commas and quotes in values
          const escapedValue = String(value).replace(/"/g, '""');
          return `"${escapedValue}"`;
        }).join(',')
      )
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    let filename = 'payments';
    if (fromDate && toDate) {
      filename += `-${fromDate}-to-${toDate}`;
    } else if (fromDate) {
      filename += `-from-${fromDate}`;
    } else if (toDate) {
      filename += `-to-${toDate}`;
    } else if (selectedMonth && selectedYear) {
      const monthLabel = months.find(m => m.value === selectedMonth)?.label;
      filename += `-${monthLabel}-${selectedYear}`;
    } else if (selectedMonth) {
      const monthLabel = months.find(m => m.value === selectedMonth)?.label;
      filename += `-${monthLabel}`;
    } else if (selectedYear) {
      filename += `-${selectedYear}`;
    }
    filename += `-${new Date().toISOString().split('T')[0]}.csv`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBackendExport = async () => {
    try {
      const params: Record<string, string> = {
        tab: 'all'
      };
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      if (selectedMonth) params.month = selectedMonth;
      if (selectedYear) params.year = selectedYear;

      const q = new URLSearchParams(params);
      const token = typeof window !== 'undefined'
        ? (localStorage.getItem('token') || sessionStorage.getItem('token'))
        : '';

      const res = await fetch(`/api/admin/payments/export?${q.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        alert('Export failed');
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payments_all_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Export failed');
    }
  };

  const displayedPayments = useMemo(() => {
    // Always keep full rows and apply deposits-only at group level.
    return payments;
  }, [payments, showDepositsOnly]);

  // Group payments by student-course
  const groupedPayments = displayedPayments.reduce((acc, payment) => {
    const key = `${payment.student_id}-${payment.course_id}`;
    // Ensure amount is a number
    const amount = typeof payment.amount === 'string' ? parseFloat(payment.amount) : (Number(payment.amount) || 0);
    
    if (!acc[key]) {
      acc[key] = {
        student_id: payment.student_id,
        student_name: payment.student_name,
        student_email: payment.student_email,
        course_id: payment.course_id,
        course_title: payment.course_title,
        payment_type: payment.payment_type,
        total_installments: 0,
        paid_installments: 0,
        due_installments: 0,
        total_amount: 0,
        paid_amount: 0,
        due_amount: 0,
        total_installment_amount: 0,
        paid_installment_amount: 0,
        deposit_amount: 0,
        deposit_paid: 0,
        installments: []
      };
    }
    acc[key].installments.push(payment);
    if (isNaN(amount)) return acc;

    // Do not count deposits in installment counts/amounts.
    if (payment.is_deposit === 1) {
      acc[key].deposit_amount = (acc[key].deposit_amount || 0) + amount;
      if (payment.status === 'paid') {
        acc[key].deposit_paid = (acc[key].deposit_paid || 0) + 1;
      }
      return acc;
    }

    acc[key].total_installments++;
    acc[key].total_amount += amount;
    acc[key].total_installment_amount = (acc[key].total_installment_amount || 0) + amount;
    if (payment.status === 'paid') {
      acc[key].paid_installments++;
      acc[key].paid_amount += amount;
      acc[key].paid_installment_amount = (acc[key].paid_installment_amount || 0) + amount;
    } else {
      acc[key].due_installments++;
      acc[key].due_amount += amount;
    }
    return acc;
  }, {} as Record<string, StudentCoursePayment>);

  const studentCoursePayments = Object.values(groupedPayments);

  // Get unique course names for filter dropdown
  const uniqueCourses = Array.from(
    new Set(studentCoursePayments.map(scp => scp.course_title))
  ).sort();

  // Filter student-course payments based on active card filter, search term, course filter, month/year filter, and date range
  // Note: All filtering is now done client-side for consistency
  const filteredStudentCoursePayments = studentCoursePayments.filter((scp) => {
    if (showDepositsOnly && !scp.installments.some(inst => inst.is_deposit === 1 && inst.status === 'paid')) {
      return false;
    }

    // Apply date range filter (takes priority over month/year)
    if (fromDate || toDate) {
      const hasMatchingInstallment = scp.installments.some(inst => {
        // Use paid_at for paid installments, due_date for others
        const dateToCheck = inst.status === 'paid' && inst.paid_at ? inst.paid_at : inst.due_date;
        if (!dateToCheck) return false;

        try {
          const date = new Date(dateToCheck);
          date.setHours(0, 0, 0, 0);

          if (fromDate && toDate) {
            const from = new Date(fromDate);
            const to = new Date(toDate);
            from.setHours(0, 0, 0, 0);
            to.setHours(23, 59, 59, 999);
            return date >= from && date <= to;
          } else if (fromDate) {
            const from = new Date(fromDate);
            from.setHours(0, 0, 0, 0);
            return date >= from;
          } else if (toDate) {
            const to = new Date(toDate);
            to.setHours(23, 59, 59, 999);
            return date <= to;
          }
        } catch (e) {
          return false;
        }
        return false;
      });

      if (!hasMatchingInstallment) return false;
    }
    // Apply month/year filter (only if date range is not set)
    else if (selectedMonth || selectedYear) {
      const hasMatchingInstallment = scp.installments.some(inst => {
        // Use paid_at for paid installments, due_date for others
        const dateToCheck = inst.status === 'paid' && inst.paid_at ? inst.paid_at : inst.due_date;
        if (!dateToCheck) return false;

        try {
          const date = new Date(dateToCheck);
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const year = String(date.getFullYear());

          if (selectedMonth && selectedYear) {
            return month === selectedMonth && year === selectedYear;
          } else if (selectedMonth) {
            return month === selectedMonth;
          } else if (selectedYear) {
            return year === selectedYear;
          }
        } catch (e) {
          return false;
        }
        return false;
      });

      if (!hasMatchingInstallment) return false;
    }

    // Apply active card filter (for partially-paid, which isn't a backend status)
    if (activeCardFilter === 'partially-paid') {
      // Partially paid means some installments are paid but not all
      if (scp.paid_installments === 0 || scp.paid_installments === scp.total_installments) {
        return false;
      }
    }
    
    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        scp.student_name.toLowerCase().includes(searchLower) ||
        scp.student_email.toLowerCase().includes(searchLower) ||
        scp.course_title.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }

    // Apply course filter
    if (courseFilter && scp.course_title !== courseFilter) {
      return false;
    }

    // Apply card filter
    if (!activeCardFilter) return true;

    switch (activeCardFilter) {
      case 'overdue':
        // Students with overdue payments (critical) - check status or due_date in past
        return scp.installments.some(inst => {
          if (inst.is_deposit === 1) return false;
          // Check if status is explicitly 'overdue'
          if (inst.status === 'overdue') return true;
          
          // Check if status is 'due' and due_date is in the past (overdue)
          if (inst.status === 'due' && inst.due_date) {
            try {
              const dueDate = new Date(inst.due_date);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              dueDate.setHours(0, 0, 0, 0);
              // Check if due date is before today (overdue)
              return dueDate < today;
            } catch (e) {
              return false;
            }
          }
          
          return false;
        });
      
      case 'upcoming-7-days':
        // Upcoming payments in next 7 days
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
        return scp.installments.some(inst => {
          if (!inst.due_date || inst.status === 'paid') return false;
          const dueDate = new Date(inst.due_date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return dueDate >= today && dueDate <= sevenDaysFromNow && (inst.status === 'due' || inst.status === 'overdue');
        });
      
      case 'upcoming-30-days':
        // Upcoming payments in next 30 days
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        return scp.installments.some(inst => {
          if (!inst.due_date || inst.status === 'paid') return false;
          const dueDate = new Date(inst.due_date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return dueDate >= today && dueDate <= thirtyDaysFromNow && (inst.status === 'due' || inst.status === 'overdue');
        });
      
      case 'partially-paid':
        // Partially paid students (some paid, some due)
        return scp.paid_installments > 0 && scp.due_installments > 0;
      
      case 'fully-paid':
        // Fully paid students (all installments paid)
        return scp.due_installments === 0 && scp.paid_installments > 0;
      
      default:
        return true;
    }
  });

  // Apply sorting
  const sortedStudentCoursePayments = [...filteredStudentCoursePayments].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortConfig.key) {
      case 'payment_progress':
        aValue = (a.paid_amount / a.total_amount) * 100;
        bValue = (b.paid_amount / b.total_amount) * 100;
        break;
      case 'payment_status':
        if (a.due_installments === 0 && a.paid_installments > 0) aValue = 1; // Fully paid
        else if (a.paid_installments > 0 && a.due_installments > 0) aValue = 2; // Partially paid
        else aValue = 3; // No payment
        if (b.due_installments === 0 && b.paid_installments > 0) bValue = 1;
        else if (b.paid_installments > 0 && b.due_installments > 0) bValue = 2;
        else bValue = 3;
        break;
      default:
        aValue = a[sortConfig.key];
        bValue = b[sortConfig.key];
    }

    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  // Client-side pagination - disable pagination when filters are active
  const hasActiveFilters = !!(selectedMonth || selectedYear || fromDate || toDate || searchTerm || courseFilter);
  const effectivePageLimit = hasActiveFilters ? sortedStudentCoursePayments.length : pageLimit;
  const clientTotalPages = Math.ceil(sortedStudentCoursePayments.length / effectivePageLimit);
  const clientTotalItems = sortedStudentCoursePayments.length;
  const startIndex = hasActiveFilters ? 0 : (currentPage - 1) * pageLimit;
  const endIndex = hasActiveFilters ? sortedStudentCoursePayments.length : startIndex + pageLimit;
  const paginatedStudentCoursePayments = sortedStudentCoursePayments.slice(startIndex, endIndex);

  // Calculate overall totals for statistics based on filtered date range
  const overallTotals = useMemo(() => payments.reduce(
    (acc, payment) => {
      const amount = typeof payment.amount === 'string' ? parseFloat(payment.amount) : (Number(payment.amount) || 0);
      if (isNaN(amount)) return acc;

      // Keep deposits fully separate from installment totals.
      if (payment.is_deposit === 1) {
        acc.depositTotal += amount;
        if (payment.status === 'paid') {
          let includeDeposit = true;
          if (fromDate || toDate) {
            if (!payment.paid_at) {
              includeDeposit = false;
            } else {
              const paidDate = new Date(payment.paid_at);
              const from = fromDate ? new Date(fromDate) : null;
              const to = toDate ? new Date(toDate) : null;
              if (to) to.setHours(23, 59, 59, 999);
              if ((from && paidDate < from) || (to && paidDate > to)) {
                includeDeposit = false;
              }
            }
          }
          if (includeDeposit) {
            acc.depositPaid += amount;
            acc.depositCount += 1;
          }
        }
        return acc;
      }

      // Apply date range filter
      if (fromDate || toDate) {
        const from = fromDate
          ? new Date(fromDate + 'T00:00:00')
          : null;
        const to = toDate
          ? new Date(toDate + 'T23:59:59')
          : null;

        if (payment.status === 'paid') {
          // Paid rows: filter by paid_at
          if (!payment.paid_at) return acc;
          try {
            const paidDate = new Date(
              payment.paid_at
            );
            if (
              (from && paidDate < from) ||
              (to && paidDate > to)
            ) return acc;
          } catch (e) {
            return acc;
          }
          // In range paid installment
          acc.total += amount;
          acc.paid += amount;
        }
        // Unpaid rows NOT added to total
        // when date filter is active
        return acc;
      }

      // Month/year filter (no date range)
      else if (selectedMonth || selectedYear) {
        const dateToCheck =
          payment.status === 'paid' &&
          payment.paid_at
            ? payment.paid_at
            : payment.due_date;
        if (!dateToCheck) return acc;
        try {
          const date = new Date(dateToCheck);
          const month = String(
            date.getMonth() + 1
          ).padStart(2, '0');
          const year = String(
            date.getFullYear()
          );
          if (selectedMonth && selectedYear) {
            if (!(month === selectedMonth &&
                year === selectedYear))
              return acc;
          } else if (selectedMonth) {
            if (month !== selectedMonth)
              return acc;
          } else if (selectedYear) {
            if (year !== selectedYear)
              return acc;
          }
        } catch (e) {
          return acc;
        }
      }

      // No filter OR passed month/year filter
      acc.total += amount;
      if (payment.status === 'paid') {
        acc.paid += amount;
      }
      return acc;
    },
    { total: 0, paid: 0, pending: 0, overdue: 0, depositTotal: 0, depositPaid: 0, depositCount: 0 }
  ), [payments, fromDate, toDate, selectedMonth, selectedYear]);

  const pendingTotal = useMemo(() => {
    const hasDateFilter = !!(fromDate || toDate);
    const hasMonthFilter = !!(
      selectedMonth || selectedYear
    );

    return payments
      .filter(p => {
        if (p.is_deposit === 1) return false;
        if (p.status === 'paid') return false;

        if (hasDateFilter) {
          // Show pending whose due_date
          // falls in selected period
          if (!p.due_date) return false;
          const dueDate = new Date(p.due_date);
          const from = fromDate
            ? new Date(fromDate + 'T00:00:00')
            : null;
          const to = toDate
            ? new Date(toDate + 'T23:59:59')
            : null;
          return (
            (!from || dueDate >= from) &&
            (!to || dueDate <= to)
          );
        }

        if (hasMonthFilter) {
          if (!p.due_date) return false;
          const d = new Date(p.due_date);
          const m = String(
            d.getMonth() + 1
          ).padStart(2, '0');
          const y = String(d.getFullYear());
          if (selectedMonth && selectedYear) {
            return m === selectedMonth &&
              y === selectedYear;
          } else if (selectedMonth) {
            return m === selectedMonth;
          } else if (selectedYear) {
            return y === selectedYear;
          }
        }

        return true; // No filter: all unpaid
      })
      .reduce((sum, p) =>
        sum + (parseFloat(String(p.amount))
        || 0), 0);
  }, [payments, fromDate, toDate,
      selectedMonth, selectedYear]);

  const overdueTotal = useMemo(() => {
    const hasDateFilter = !!(fromDate || toDate);
    const hasMonthFilter = !!(
      selectedMonth || selectedYear
    );

    return payments
      .filter(p => {
        if (p.is_deposit === 1) return false;
        if (p.status !== 'overdue') return false;

        if (hasDateFilter) {
          if (!p.due_date) return false;
          const dueDate = new Date(p.due_date);
          const from = fromDate
            ? new Date(fromDate + 'T00:00:00')
            : null;
          const to = toDate
            ? new Date(toDate + 'T23:59:59')
            : null;
          return (
            (!from || dueDate >= from) &&
            (!to || dueDate <= to)
          );
        }

        if (hasMonthFilter) {
          if (!p.due_date) return false;
          const d = new Date(p.due_date);
          const m = String(
            d.getMonth() + 1
          ).padStart(2, '0');
          const y = String(d.getFullYear());
          if (selectedMonth && selectedYear) {
            return m === selectedMonth &&
              y === selectedYear;
          } else if (selectedMonth) {
            return m === selectedMonth;
          } else if (selectedYear) {
            return y === selectedYear;
          }
        }

        return true;
      })
      .reduce((sum, p) =>
        sum + (parseFloat(String(p.amount))
        || 0), 0);
  }, [payments, fromDate, toDate,
      selectedMonth, selectedYear]);

const overdueStudentCount = useMemo(() => {
  const hasFilter = !!(fromDate || toDate
    || selectedMonth || selectedYear)

  const ids = new Set(
    payments
      .filter(p => {
        if (p.is_deposit === 1) return false
        if (p.status !== 'overdue') return false

        if (!hasFilter) return true

        if (!p.due_date) return false
        const d = new Date(p.due_date)
        const from = fromDate
          ? new Date(fromDate + 'T00:00:00')
          : null
        const to = toDate
          ? new Date(toDate + 'T23:59:59')
          : null
        return (
          (!from || d >= from) &&
          (!to || d <= to)
        )
      })
      .map(p => p.student_id)
  )
  return ids.size
}, [payments, fromDate, toDate,
    selectedMonth, selectedYear])

  // Get status badge color and text
  const getPaymentStatusInfo = (studentCourse: StudentCoursePayment) => {
    if (studentCourse.due_installments === 0 && studentCourse.paid_installments > 0) {
      return {
        label: 'Fully Paid',
        bgColor: 'bg-emerald-100',
        textColor: 'text-emerald-700',
        dotColor: 'bg-emerald-500'
      };
    } else if (studentCourse.paid_installments > 0 && studentCourse.due_installments > 0) {
      return {
        label: 'Partially Paid',
        bgColor: 'bg-amber-100',
        textColor: 'text-amber-700',
        dotColor: 'bg-amber-500'
      };
    } else {
      return {
        label: 'No Payment',
        bgColor: 'bg-slate-100',
        textColor: 'text-slate-700',
        dotColor: 'bg-slate-500'
      };
    }
  };

  // Get progress bar color
  const getProgressColor = (percentage: number) => {
    if (percentage === 100) return 'bg-emerald-500';
    if (percentage >= 75) return 'bg-green-500';
    if (percentage >= 50) return 'bg-lime-500';
    if (percentage >= 25) return 'bg-amber-500';
    return 'bg-red-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-4 border-gray-200 border-t-[#11CCEF] animate-spin"></div>
          <div className="mt-4 text-gray-600 font-medium">Loading payments...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 w-full overflow-x-hidden max-w-full">
      {/* Search and Filters Section - Above Header */}
      <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200 w-full max-w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
          <div className="relative">
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
              Search
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setActiveCardFilter(null);
                }}
                placeholder="Search by student, email, or course..."
                className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF] focus:border-transparent transition-all"
              />
              <svg className="w-5 h-5 text-gray-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
              Filter by Course
            </label>
            <select
              value={courseFilter}
              onChange={(e) => {
                setCourseFilter(e.target.value);
                setActiveCardFilter(null);
              }}
              className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF] focus:border-transparent transition-all appearance-none bg-white"
            >
              <option value="">All Courses</option>
              {uniqueCourses.map((course) => (
                <option key={course} value={course}>
                  {course}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={downloadCSV}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 active:bg-emerald-800 font-semibold transition-colors touch-manipulation text-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Export CSV</span>
            </button>
            <button
              onClick={handleBackendExport}
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap'
              }}
            >
              📥 Export Filtered CSV
            </button>
          </div>
        </div>
        
        {/* Date Range Filters */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-[#11CCEF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Date Range Filter
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                From Date
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setActiveCardFilter(null);
                  if (e.target.value) {
                    setSelectedMonth('');
                    setSelectedYear('');
                  }
                }}
                className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF] focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                To Date
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setActiveCardFilter(null);
                  if (e.target.value) {
                    setSelectedMonth('');
                    setSelectedYear('');
                  }
                }}
                className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF] focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Month
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(e.target.value);
                  setActiveCardFilter(null);
                  if (e.target.value) {
                    setFromDate('');
                    setToDate('');
                  }
                }}
                disabled={!!(fromDate || toDate)}
                className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF] focus:border-transparent transition-all disabled:bg-gray-100 disabled:cursor-not-allowed appearance-none"
              >
                <option value="">All Months</option>
                {months.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Year
              </label>
              <select
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(e.target.value);
                  setActiveCardFilter(null);
                  if (e.target.value) {
                    setFromDate('');
                    setToDate('');
                  }
                }}
                disabled={!!(fromDate || toDate)}
                className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF] focus:border-transparent transition-all disabled:bg-gray-100 disabled:cursor-not-allowed appearance-none"
              >
                <option value="">All Years</option>
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-3 text-xs text-gray-500">
            {(fromDate || toDate) && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                Using date range filter
              </span>
            )}
            {!(fromDate || toDate) && (selectedMonth || selectedYear) && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                Using month/year filter
              </span>
            )}
          </div>
        </div>
        
        {/* Clear Filters Button */}
        {(searchTerm || courseFilter || selectedMonth || selectedYear || fromDate || toDate || activeCardFilter) && (
          <div className="mt-4">
            <button
              onClick={() => {
                setSearchTerm('');
                setCourseFilter('');
                setSelectedMonth('');
                setSelectedYear('');
                setFromDate('');
                setToDate('');
                setActiveCardFilter(null);
              }}
              className="inline-flex items-center gap-2 text-sm text-[#11CCEF] hover:text-[#0daed9] font-semibold transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear All Filters
            </button>
          </div>
        )}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Payment Management</h2>
        <div className="text-sm text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
          {filteredStudentCoursePayments.length} {filteredStudentCoursePayments.length === 1 ? 'record' : 'records'}
        </div>
      </div>

      {/* Statistics Cards - Admin and Certificate Manager */}
      {PAYMENT_FULL_ACCESS_ROLES.includes(userRole) && stats && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-white to-gray-50 p-5 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Total Amount
                </div>
                {(selectedMonth || selectedYear || fromDate || toDate) && (
                  <span className="text-[10px] bg-[#11CCEF] text-white px-2 py-0.5 rounded-full">Filtered</span>
                )}
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {formatCurrency(
                  (fromDate || toDate || selectedMonth || selectedYear)
                    ? overallTotals.total + pendingTotal
                    : overallTotals.total
                )}
              </div>
              {(fromDate || toDate || selectedMonth || selectedYear) ? (
                <p className="text-xs text-gray-400 mt-1">
                  Paid + pending in period
                </p>
              ) : (
                <p className="text-xs text-gray-400 mt-1">
                  Total instalment value
                </p>
              )}
            </div>
            <div className="bg-gradient-to-br from-green-50 to-white p-5 rounded-xl shadow-sm border border-green-200">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-green-600 uppercase tracking-wider">
                  Paid
                </div>
                {(selectedMonth || selectedYear || fromDate || toDate) && (
                  <span className="text-[10px] bg-green-500 text-white px-2 py-0.5 rounded-full">Filtered</span>
                )}
              </div>
              <div className="text-2xl font-bold text-green-700">{formatCurrency(overallTotals.paid)}</div>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-white p-5 rounded-xl shadow-sm border border-amber-200">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-amber-600 uppercase tracking-wider">
                  Pending
                </div>
                {(selectedMonth || selectedYear || fromDate || toDate) && (
                  <span className="text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded-full">Filtered</span>
                )}
              </div>
              <div className="text-2xl font-bold text-amber-700">{formatCurrency(pendingTotal)}</div>
              {(fromDate || toDate ||
                selectedMonth || selectedYear) ? (
                <p className="text-xs text-amber-400 mt-1">
                  Due in selected period
                </p>
              ) : (
                <p className="text-xs text-amber-400 mt-1">
                  Current outstanding
                </p>
              )}
            </div>
            <div className="bg-gradient-to-br from-red-50 to-white p-5 rounded-xl shadow-sm border border-red-200">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-red-600 uppercase tracking-wider">
                  Overdue
                </div>
                {(selectedMonth || selectedYear || fromDate || toDate) && (
                  <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full">Filtered</span>
                )}
              </div>
              <div className="text-2xl font-bold text-red-700">{formatCurrency(overdueTotal)}</div>
              {(fromDate || toDate ||
                selectedMonth || selectedYear) ? (
                <p className="text-xs text-red-400 mt-1">
                  Overdue in selected period
                </p>
              ) : (
                <p className="text-xs text-red-400 mt-1">
                  Current overdue balance
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Total Students</div>
                  <div className="text-2xl font-bold text-gray-900">{stats.total_students}</div>
                </div>
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Paid Installments</div>
                  <div className="text-2xl font-bold text-green-600">{stats.paid_installments_count || stats.paid_installments}</div>
                </div>
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
            <div onClick={() => setShowDepositsOnly(p => !p)} style={{
              background: '#fff',
              borderRadius: '12px',
              border: showDepositsOnly ? '2px solid #92400e' : '1px solid #e2e8f0',
              padding: '16px',
              textAlign: 'center',
              cursor: 'pointer'
            }}>
              <p style={{
                fontSize: '11px',
                fontWeight: '700',
                color: '#92400e',
                textTransform: 'uppercase',
                marginBottom: '4px'
              }}>
                Initial Deposits
              </p>
              <p style={{
                fontSize: '24px',
                fontWeight: '800',
                color: '#92400e'
              }}>
                {stats?.total_deposits || 0}
              </p>
              <p style={{
                fontSize: '12px',
                color: '#64748b'
              }}>
                Total: £{Number(stats?.total_deposits_amount || 0).toFixed(2)}
              </p>
              {(fromDate || toDate) && (
                <p style={{
                  fontSize: '11px',
                  color: '#92400e',
                  marginTop: '4px'
                }}>
                  In period: {overallTotals.depositCount || 0} (£{Number(overallTotals.depositPaid || 0).toFixed(2)})
                </p>
              )}
              {showDepositsOnly && (
                <p style={{
                  fontSize: '10px',
                  color: '#92400e',
                  fontWeight: '700'
                }}>
                  ✓ Showing deposits only
                </p>
              )}
            </div>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Pending Installments</div>
                  <div className="text-2xl font-bold text-amber-600">{stats.pending_installments}</div>
                </div>
                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
            <div 
              className={`p-5 rounded-xl shadow-sm border cursor-pointer transition-all ${
                activeCardFilter === 'overdue' 
                  ? 'bg-red-100 border-red-400 ring-2 ring-red-200' 
                  : 'bg-red-50 border-red-200 hover:bg-red-100'
              }`}
              onClick={() => setActiveCardFilter(activeCardFilter === 'overdue' ? null : 'overdue')}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-1">Overdue Students</div>
                  <div className="text-2xl font-bold text-red-700">{overdueStudentCount || 0}</div>
                </div>
                <div className="w-10 h-10 bg-red-200 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div 
              className={`p-5 rounded-xl border cursor-pointer transition-all ${
                activeCardFilter === 'fully-paid' 
                  ? 'bg-emerald-100 border-emerald-400 ring-2 ring-emerald-200' 
                  : 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
              }`}
              onClick={() => setActiveCardFilter(activeCardFilter === 'fully-paid' ? null : 'fully-paid')}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-1">Fully Paid</div>
                  <div className="text-2xl font-bold text-emerald-700">{stats.fully_paid} students</div>
                </div>
                <div className="w-10 h-10 bg-emerald-200 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
            <div 
              className={`p-5 rounded-xl border cursor-pointer transition-all ${
                activeCardFilter === 'partially-paid' 
                  ? 'bg-amber-100 border-amber-400 ring-2 ring-amber-200' 
                  : 'bg-amber-50 border-amber-200 hover:bg-amber-100'
              }`}
              onClick={() => setActiveCardFilter(activeCardFilter === 'partially-paid' ? null : 'partially-paid')}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">Partially Paid</div>
                  <div className="text-2xl font-bold text-amber-700">{stats.partially_paid} students</div>
                </div>
                <div className="w-10 h-10 bg-amber-200 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">No Payment Yet</div>
                  <div className="text-2xl font-bold text-slate-700">{stats.no_payment_yet} students</div>
                </div>
                <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Upcoming Payments Cards - Admin and Certificate Manager */}
      {PAYMENT_FULL_ACCESS_ROLES.includes(userRole) && stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div 
            className={`p-5 rounded-xl shadow-sm border cursor-pointer transition-all ${
              activeCardFilter === 'upcoming-7-days' 
                ? 'bg-blue-100 border-blue-400 ring-2 ring-blue-200' 
                : 'bg-white border-gray-200 hover:bg-blue-50'
            }`}
            onClick={() => setActiveCardFilter(activeCardFilter === 'upcoming-7-days' ? null : 'upcoming-7-days')}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="text-sm text-gray-500 mb-1">Upcoming Payments</div>
                <div className="text-2xl font-bold text-blue-600">{stats.upcoming_7_days}</div>
                <div className="text-xs text-gray-500 mt-1">in the next 7 days</div>
              </div>
            </div>
          </div>
          <div 
            className={`p-5 rounded-xl shadow-sm border cursor-pointer transition-all ${
              activeCardFilter === 'upcoming-30-days' 
                ? 'bg-blue-100 border-blue-400 ring-2 ring-blue-200' 
                : 'bg-white border-gray-200 hover:bg-blue-50'
            }`}
            onClick={() => setActiveCardFilter(activeCardFilter === 'upcoming-30-days' ? null : 'upcoming-30-days')}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="text-sm text-gray-500 mb-1">Upcoming Payments</div>
                <div className="text-2xl font-bold text-blue-600">{stats.upcoming_30_days}</div>
                <div className="text-xs text-gray-500 mt-1">in the next 30 days</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Filter Indicator */}
      {(activeCardFilter || selectedMonth || selectedYear || fromDate || toDate) && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">Active Filters:</span>
            {activeCardFilter && (
              <span className="text-sm capitalize bg-blue-100 px-3 py-1 rounded-full flex items-center gap-1.5">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                {activeCardFilter === 'overdue' && 'Overdue Students'}
                {activeCardFilter === 'upcoming-7-days' && 'Next 7 Days'}
                {activeCardFilter === 'upcoming-30-days' && 'Next 30 Days'}
                {activeCardFilter === 'partially-paid' && 'Partially Paid'}
                {activeCardFilter === 'fully-paid' && 'Fully Paid'}
              </span>
            )}
            {fromDate && (
              <span className="text-sm bg-blue-100 px-3 py-1 rounded-full flex items-center gap-1.5">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                From: {new Date(fromDate).toLocaleDateString('en-GB')}
              </span>
            )}
            {toDate && (
              <span className="text-sm bg-blue-100 px-3 py-1 rounded-full flex items-center gap-1.5">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                To: {new Date(toDate).toLocaleDateString('en-GB')}
              </span>
            )}
            {!fromDate && !toDate && selectedMonth && (
              <span className="text-sm bg-blue-100 px-3 py-1 rounded-full flex items-center gap-1.5">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                {months.find(m => m.value === selectedMonth)?.label}
              </span>
            )}
            {!fromDate && !toDate && selectedYear && (
              <span className="text-sm bg-blue-100 px-3 py-1 rounded-full flex items-center gap-1.5">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                {selectedYear}
              </span>
            )}
          </div>
          <button
            onClick={() => {
              setActiveCardFilter(null);
              setSelectedMonth('');
              setSelectedYear('');
              setFromDate('');
              setToDate('');
            }}
            className="text-blue-600 hover:text-blue-800 active:text-blue-900 font-semibold text-sm flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear Filters
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2 text-sm">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* Payments Table - Grouped by Student-Course */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden w-full max-w-full border border-gray-200">
        {/* Desktop Table View */}
        <div className="hidden lg:block overflow-x-auto max-w-full">
          <table className="w-full min-w-max">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:text-[#11CCEF] transition-colors"
                  onClick={() => handleSort('student_name')}
                >
                  <div className="flex items-center gap-1">
                    Student
                    {sortConfig.key === 'student_name' && (
                      <svg className={`w-4 h-4 transition-transform ${sortConfig.direction === 'desc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:text-[#11CCEF] transition-colors"
                  onClick={() => handleSort('course_title')}
                >
                  <div className="flex items-center gap-1">
                    Course
                    {sortConfig.key === 'course_title' && (
                      <svg className={`w-4 h-4 transition-transform ${sortConfig.direction === 'desc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    )}
                  </div>
                </th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Plan
                </th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Installments
                </th>
                <th 
                  className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:text-[#11CCEF] transition-colors"
                  onClick={() => handleSort('payment_progress')}
                >
                  <div className="flex items-center gap-1">
                    Progress
                    {sortConfig.key === 'payment_progress' && (
                      <svg className={`w-4 h-4 transition-transform ${sortConfig.direction === 'desc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:text-[#11CCEF] transition-colors"
                  onClick={() => handleSort('payment_status')}
                >
                  <div className="flex items-center gap-1">
                    Status
                    {sortConfig.key === 'payment_status' && (
                      <svg className={`w-4 h-4 transition-transform ${sortConfig.direction === 'desc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:text-[#11CCEF] transition-colors"
                  onClick={() => handleSort('total_amount')}
                >
                  <div className="flex items-center gap-1">
                    Total
                    {sortConfig.key === 'total_amount' && (
                      <svg className={`w-4 h-4 transition-transform ${sortConfig.direction === 'desc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    )}
                  </div>
                </th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Paid
                </th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Due
                </th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedStudentCoursePayments.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-lg font-medium">No payments found</span>
                      <span className="text-sm">Try adjusting your filters</span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedStudentCoursePayments.map((studentCourse) => {
                  const statusInfo = getPaymentStatusInfo(studentCourse);
                  const progressPercentage = Math.round(
                    ((studentCourse.paid_installment_amount || 0) /
                      (studentCourse.total_installment_amount || 1)) * 100
                  );
                  
                  return (
                    <tr key={`${studentCourse.student_id}-${studentCourse.course_id}`} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-gradient-to-br from-[#11CCEF] to-[#0daed9] rounded-full flex items-center justify-center text-white font-semibold text-sm mr-3">
                            {studentCourse.student_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-900">{studentCourse.student_name}</div>
                            <div className="text-xs text-gray-500">{studentCourse.student_email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm font-medium text-gray-900 max-w-[250px] truncate" title={studentCourse.course_title}>
                          {studentCourse.course_title}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          studentCourse.payment_type === 'all_paid' 
                            ? 'bg-purple-100 text-purple-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {studentCourse.payment_type === 'all_paid' ? 'All Paid' : 'Installment'}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">
                            {studentCourse.paid_installments}/{studentCourse.total_installments} instalments
                            {(studentCourse.deposit_paid || 0) > 0 && (
                              <span style={{
                                fontSize: '10px',
                                color: '#92400e',
                                display: 'block',
                                marginTop: '2px'
                              }}>
                                + 💰 deposit paid
                              </span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap min-w-[120px]">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${getProgressColor(progressPercentage)} transition-all duration-500`}
                              style={{ width: `${progressPercentage}%` }}
                            ></div>
                          </div>
                          <span className="text-xs font-medium text-gray-700">{progressPercentage}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.bgColor} ${statusInfo.textColor}`}>
                          <span className={`w-2 h-2 rounded-full ${statusInfo.dotColor}`}></span>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">{formatCurrency(studentCourse.total_amount)}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-emerald-600">{formatCurrency(studentCourse.paid_amount)}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-amber-600">{formatCurrency(studentCourse.due_amount)}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleUpdateStatus(studentCourse.student_id, studentCourse.course_id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#11CCEF] text-white rounded-lg hover:bg-[#0daed9] active:bg-[#0a9bc4] font-medium transition-colors touch-manipulation opacity-0 group-hover:opacity-100 focus:opacity-100"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                          Update
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls - Only show when no filters are active */}
        {clientTotalPages > 1 && !hasActiveFilters && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-4 bg-gray-50 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              Showing <span className="font-semibold">{clientTotalItems > 0 ? startIndex + 1 : 0}</span> to{' '}
              <span className="font-semibold">{Math.min(endIndex, clientTotalItems)}</span> of{' '}
              <span className="font-semibold">{clientTotalItems}</span> results
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-1 ${
                  currentPage === 1
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Previous
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, clientTotalPages) }, (_, i) => {
                  let pageNum;
                  if (clientTotalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= clientTotalPages - 2) {
                    pageNum = clientTotalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-10 h-10 rounded-lg font-medium transition-colors ${
                        currentPage === pageNum
                          ? 'bg-[#11CCEF] text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <div className="text-sm text-gray-600 px-2">
                Page {currentPage} of {clientTotalPages}
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(clientTotalPages, p + 1))}
                disabled={currentPage === clientTotalPages}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-1 ${
                  currentPage === clientTotalPages
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                }`}
              >
                Next
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Mobile/Tablet Card View */}
        <div className="lg:hidden divide-y divide-gray-200">
          {paginatedStudentCoursePayments.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <div className="flex flex-col items-center gap-3">
                <svg className="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-lg font-medium">No payments found</span>
                <span className="text-sm">Try adjusting your filters</span>
              </div>
            </div>
          ) : (
            paginatedStudentCoursePayments.map((studentCourse) => {
              const statusInfo = getPaymentStatusInfo(studentCourse);
              const progressPercentage = Math.round(
                ((studentCourse.paid_installment_amount || 0) /
                  (studentCourse.total_installment_amount || 1)) * 100
              );
              
              return (
                <div key={`${studentCourse.student_id}-${studentCourse.course_id}`} className="p-5 hover:bg-gray-50 transition-colors">
                  <div className="space-y-4">
                    {/* Student Header with Avatar */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-[#11CCEF] to-[#0daed9] rounded-full flex items-center justify-center text-white font-semibold">
                        {studentCourse.student_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-900 truncate">{studentCourse.student_name}</div>
                        <div className="text-xs text-gray-500 truncate">{studentCourse.student_email}</div>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.bgColor} ${statusInfo.textColor}`}>
                        <span className={`w-2 h-2 rounded-full ${statusInfo.dotColor} mr-1`}></span>
                        {statusInfo.label}
                      </span>
                    </div>

                    {/* Course and Plan */}
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-gray-500 mb-1">Course</div>
                        <div className="text-sm font-medium text-gray-900 truncate" title={studentCourse.course_title}>
                          {studentCourse.course_title}
                        </div>
                      </div>
                      <span className={`ml-2 px-2.5 py-1 rounded-full text-xs font-medium ${
                        studentCourse.payment_type === 'all_paid' 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {studentCourse.payment_type === 'all_paid' ? 'All Paid' : 'Installment'}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-gray-500">Payment Progress</span>
                        <span className="text-xs font-medium text-gray-700">{progressPercentage}%</span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${getProgressColor(progressPercentage)} transition-all duration-500`}
                          style={{ width: `${progressPercentage}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Installments and Amounts Grid */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-xs text-gray-500 mb-1">Installments</div>
                        <div className="text-sm font-semibold text-gray-900">
                          {studentCourse.paid_installments}/{studentCourse.total_installments} instalments
                          {(studentCourse.deposit_paid || 0) > 0 && (
                            <span style={{
                              fontSize: '10px',
                              color: '#92400e',
                              display: 'block',
                              marginTop: '2px'
                            }}>
                              + 💰 deposit paid
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="bg-emerald-50 p-3 rounded-lg">
                        <div className="text-xs text-emerald-600 mb-1">Paid</div>
                        <div className="text-sm font-semibold text-emerald-700 break-words">
                          {formatCurrency(studentCourse.paid_amount)}
                        </div>
                      </div>
                      <div className="bg-amber-50 p-3 rounded-lg">
                        <div className="text-xs text-amber-600 mb-1">Due</div>
                        <div className="text-sm font-semibold text-amber-700 break-words">
                          {formatCurrency(studentCourse.due_amount)}
                        </div>
                      </div>
                    </div>

                    {/* Total Amount and Action */}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Total Amount</div>
                        <div className="text-base font-bold text-gray-900">{formatCurrency(studentCourse.total_amount)}</div>
                      </div>
                      <button
                        onClick={() => handleUpdateStatus(studentCourse.student_id, studentCourse.course_id)}
                        className="px-4 py-2 text-sm bg-[#11CCEF] text-white rounded-lg hover:bg-[#0daed9] active:bg-[#0a9bc4] font-medium transition-colors touch-manipulation flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        Update
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Status Update Modal */}
      {showStatusModal && selectedStudentCourse && (
        <PaymentStatusUpdateModal
          studentCourse={selectedStudentCourse}
          onClose={() => {
            setShowStatusModal(false);
            setSelectedStudentCourse(null);
          }}
          onSuccess={handleStatusUpdated}
        />
      )}
    </div>
  );
};

export default PaymentManagementView;