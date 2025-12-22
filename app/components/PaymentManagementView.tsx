'use client';

import { useState, useEffect } from 'react';
import { apiService } from '@/app/services/api';
import PaymentStatusUpdateModal from './PaymentStatusUpdateModal';

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
  payment_type: 'all_paid' | 'installment';
  created_at: string;
  updated_at: string;
}

interface PaymentStats {
  total_students: number;
  paid_installments: number;
  pending_installments: number;
  overdue_amount: number;
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
  installments: PaymentInstallment[];
}

interface PaymentManagementViewProps {
  userRole: 'Admin' | 'Tutor';
  userId?: number;
}

const PaymentManagementView = ({ userRole, userId }: PaymentManagementViewProps) => {
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
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageLimit, setPageLimit] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  useEffect(() => {
    fetchData();
    if (userRole === 'Admin') {
      fetchStats();
    }
  }, [currentPage, pageLimit, searchTerm, activeCardFilter, courseFilter]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeCardFilter, courseFilter]);

  const fetchStats = async () => {
    try {
      setLoadingStats(true);
      const response = await apiService.getPaymentStats();
      if (response?.success) {
        setStats(response.stats);
      }
    } catch (error) {
      console.error('Error fetching payment stats:', error);
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
      if (userRole === 'Admin') {
        response = await apiService.getAllPayments(statusFilter, searchTerm || undefined, currentPage, pageLimit);
      } else if (userRole === 'Tutor' && userId) {
        response = await apiService.getTutorPayments(userId, statusFilter, searchTerm || undefined, currentPage, pageLimit);
      } else {
        setError('User ID required for tutor');
        return;
      }

      if (response?.success) {
        setPayments(response.installments || []);
        if (response.pagination) {
          setTotalPages(response.pagination.totalPages || 1);
          setTotalItems(response.pagination.total || 0);
        }
      } else {
        setError(response?.message || 'Failed to fetch payments');
      }
    } catch (error) {
      console.error('Error fetching payments:', error);
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
      console.error('Error fetching student installments:', error);
      setError('Failed to load payment details');
    }
  };

  const handleStatusUpdated = () => {
    setShowStatusModal(false);
    setSelectedStudentCourse(null);
    fetchData();
    if (userRole === 'Admin') {
      fetchStats();
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
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

  // Group payments by student-course
  const groupedPayments = payments.reduce((acc, payment) => {
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
        installments: []
      };
    }
    acc[key].installments.push(payment);
    acc[key].total_installments++;
    if (!isNaN(amount)) {
      acc[key].total_amount += amount;
      if (payment.status === 'paid') {
        acc[key].paid_installments++;
        acc[key].paid_amount += amount;
      } else {
        acc[key].due_installments++;
        acc[key].due_amount += amount;
      }
    }
    return acc;
  }, {} as Record<string, StudentCoursePayment>);

  const studentCoursePayments = Object.values(groupedPayments);

  // Get unique course names for filter dropdown
  const uniqueCourses = Array.from(
    new Set(studentCoursePayments.map(scp => scp.course_title))
  ).sort();

  // Filter student-course payments based on active card filter, search term, and course filter
  // Note: Status filtering is done on the backend, but "partially-paid" needs frontend filtering
  const filteredStudentCoursePayments = studentCoursePayments.filter((scp) => {
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
              console.error('Error parsing due_date:', inst.due_date, e);
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

  // Calculate overall totals for statistics
  const overallTotals = payments.reduce(
    (acc, payment) => {
      // Ensure amount is a number
      const amount = typeof payment.amount === 'string' ? parseFloat(payment.amount) : (Number(payment.amount) || 0);
      if (!isNaN(amount)) {
        acc.total += amount;
        if (payment.status === 'paid') {
          acc.paid += amount;
        } else {
          acc.pending += amount;
        }
      }
      return acc;
    },
    { total: 0, paid: 0, pending: 0 }
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading payments...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 w-full overflow-x-hidden max-w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Payment Management</h2>
      </div>

      {/* Statistics Cards - Only for Admin */}
      {userRole === 'Admin' && stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 w-full max-w-full">
          <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="text-xs sm:text-sm text-gray-500 mb-1">Total Amount</div>
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 break-words">{formatCurrency(overallTotals.total)}</div>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="text-xs sm:text-sm text-gray-500 mb-1">Paid</div>
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-green-600 break-words">{formatCurrency(overallTotals.paid)}</div>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="text-xs sm:text-sm text-gray-500 mb-1">Pending</div>
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-yellow-600 break-words">{formatCurrency(overallTotals.pending)}</div>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="text-xs sm:text-sm text-gray-500 mb-1">Total Students</div>
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">{stats.total_students}</div>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="text-xs sm:text-sm text-gray-500 mb-1">Paid Installments</div>
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-green-600">{stats.paid_installments}</div>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="text-xs sm:text-sm text-gray-500 mb-1">Pending Installments</div>
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-yellow-600">{stats.pending_installments}</div>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="text-xs sm:text-sm text-gray-500 mb-1">Overdue Amount</div>
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-red-600 break-words">{formatCurrency(stats.overdue_amount)}</div>
          </div>
          <div 
            className={`p-3 sm:p-4 rounded-lg shadow-sm border cursor-pointer transition-all touch-manipulation ${
              activeCardFilter === 'overdue' 
                ? 'bg-red-100 border-red-400 shadow-md' 
                : 'bg-white border-red-200 bg-red-50 hover:bg-red-100 active:bg-red-200'
            }`}
            onClick={() => setActiveCardFilter(activeCardFilter === 'overdue' ? null : 'overdue')}
          >
            <div className="text-xs sm:text-sm text-red-600 mb-1 font-semibold">Students With Overdue (Critical)</div>
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-red-700">{stats.students_with_overdue}</div>
          </div>
          <div 
            className={`p-3 sm:p-4 rounded-lg shadow-sm border cursor-pointer transition-all touch-manipulation ${
              activeCardFilter === 'upcoming-7-days' 
                ? 'bg-blue-100 border-blue-400 shadow-md' 
                : 'bg-white border-gray-200 hover:bg-blue-50 active:bg-blue-100'
            }`}
            onClick={() => setActiveCardFilter(activeCardFilter === 'upcoming-7-days' ? null : 'upcoming-7-days')}
          >
            <div className="text-xs sm:text-sm text-gray-500 mb-1">Upcoming (Next 7 Days)</div>
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-blue-600">{stats.upcoming_7_days}</div>
          </div>
          <div 
            className={`p-3 sm:p-4 rounded-lg shadow-sm border cursor-pointer transition-all touch-manipulation ${
              activeCardFilter === 'upcoming-30-days' 
                ? 'bg-blue-100 border-blue-400 shadow-md' 
                : 'bg-white border-gray-200 hover:bg-blue-50 active:bg-blue-100'
            }`}
            onClick={() => setActiveCardFilter(activeCardFilter === 'upcoming-30-days' ? null : 'upcoming-30-days')}
          >
            <div className="text-xs sm:text-sm text-gray-500 mb-1">Upcoming (Next 30 Days)</div>
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-blue-600">{stats.upcoming_30_days}</div>
          </div>
        </div>
      )}

      {/* Payment Status Summary - Only for Admin */}
      {userRole === 'Admin' && stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 w-full max-w-full">
          <div 
            className={`p-3 sm:p-4 rounded-lg border cursor-pointer transition-all touch-manipulation ${
              activeCardFilter === 'fully-paid' 
                ? 'bg-green-100 border-green-400 shadow-md' 
                : 'bg-green-50 border-green-200 hover:bg-green-100 active:bg-green-200'
            }`}
            onClick={() => setActiveCardFilter(activeCardFilter === 'fully-paid' ? null : 'fully-paid')}
          >
            <div className="text-xs sm:text-sm text-green-600 mb-1 font-semibold">Fully Paid</div>
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-green-700">{stats.fully_paid} students</div>
          </div>
          <div 
            className={`p-3 sm:p-4 rounded-lg border cursor-pointer transition-all touch-manipulation ${
              activeCardFilter === 'partially-paid' 
                ? 'bg-yellow-100 border-yellow-400 shadow-md' 
                : 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100 active:bg-yellow-200'
            }`}
            onClick={() => setActiveCardFilter(activeCardFilter === 'partially-paid' ? null : 'partially-paid')}
          >
            <div className="text-xs sm:text-sm text-yellow-600 mb-1 font-semibold">Partially Paid</div>
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-yellow-700">{stats.partially_paid} students</div>
          </div>
          <div className="bg-gray-50 border border-gray-200 p-3 sm:p-4 rounded-lg">
            <div className="text-xs sm:text-sm text-gray-600 mb-1 font-semibold">No Payment Yet</div>
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-gray-700">{stats.no_payment_yet} students</div>
          </div>
        </div>
      )}

      {/* Active Filter Indicator */}
      {activeCardFilter && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-3 sm:px-4 py-2 sm:py-3 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="text-xs sm:text-sm font-semibold">Active Filter:</span>
            <span className="text-xs sm:text-sm capitalize">
              {activeCardFilter === 'overdue' && 'Students With Overdue (Critical)'}
              {activeCardFilter === 'upcoming-7-days' && 'Upcoming (Next 7 Days)'}
              {activeCardFilter === 'upcoming-30-days' && 'Upcoming (Next 30 Days)'}
              {activeCardFilter === 'partially-paid' && 'Partially Paid'}
              {activeCardFilter === 'fully-paid' && 'Fully Paid'}
            </span>
            <span className="text-xs sm:text-sm text-blue-600">
              ({filteredStudentCoursePayments.length} {filteredStudentCoursePayments.length === 1 ? 'result' : 'results'})
            </span>
          </div>
          <button
            onClick={() => setActiveCardFilter(null)}
            className="text-blue-600 hover:text-blue-800 active:text-blue-900 font-semibold text-xs sm:text-sm touch-manipulation"
          >
            Clear Filter
          </button>
        </div>
      )}

      {/* Search and Course Filter */}
      <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-gray-200 w-full max-w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 w-full">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
              Search
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setActiveCardFilter(null); // Clear card filter when searching
              }}
              placeholder="Search by student name, email, or course..."
              className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
            />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
              Filter by Course
            </label>
            <select
              value={courseFilter}
              onChange={(e) => {
                setCourseFilter(e.target.value);
                setActiveCardFilter(null); // Clear card filter when changing course
              }}
              className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
            >
              <option value="">All Courses</option>
              {uniqueCourses.map((course) => (
                <option key={course} value={course}>
                  {course}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-sm sm:text-base">
          {error}
        </div>
      )}

      {/* Payments Table - Grouped by Student-Course */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden w-full max-w-full">
        {/* Desktop Table View */}
        <div className="hidden lg:block overflow-x-auto max-w-full">
          <table className="w-full min-w-max">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 xl:px-4 2xl:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                  Student
                </th>
                <th className="px-3 xl:px-4 2xl:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[150px]">
                  Course
                </th>
                <th className="px-3 xl:px-4 2xl:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                  Plan
                </th>
                <th className="px-3 xl:px-4 2xl:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[80px]">
                  Total Installments
                </th>
                <th className="px-3 xl:px-4 2xl:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[80px]">
                  Paid Installments
                </th>
                <th className="px-3 xl:px-4 2xl:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[80px]">
                  Due Installments
                </th>
                <th className="px-3 xl:px-4 2xl:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                  Total Amount
                </th>
                <th className="px-3 xl:px-4 2xl:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                  Paid Amount
                </th>
                <th className="px-3 xl:px-4 2xl:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                  Due Amount
                </th>
                <th className="px-3 xl:px-4 2xl:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredStudentCoursePayments.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 xl:px-6 py-8 text-center text-gray-500">
                    {activeCardFilter ? 'No payments match the selected filter' : 'No payments found'}
                  </td>
                </tr>
              ) : (
                filteredStudentCoursePayments.map((studentCourse) => (
                  <tr key={`${studentCourse.student_id}-${studentCourse.course_id}`} className="hover:bg-gray-50">
                    <td className="px-3 xl:px-4 2xl:px-6 py-4 whitespace-nowrap min-w-[120px]">
                      <div className="text-sm font-medium text-gray-900">{studentCourse.student_name}</div>
                      <div className="text-xs sm:text-sm text-gray-500 truncate max-w-[150px]" title={studentCourse.student_email}>{studentCourse.student_email}</div>
                    </td>
                    <td className="px-3 xl:px-4 2xl:px-6 py-4 whitespace-nowrap text-sm text-gray-900 min-w-[150px]">
                      <div className="truncate max-w-[200px]" title={studentCourse.course_title}>{studentCourse.course_title}</div>
                    </td>
                    <td className="px-3 xl:px-4 2xl:px-6 py-4 whitespace-nowrap text-sm text-gray-900 min-w-[100px]">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        studentCourse.payment_type === 'all_paid' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {studentCourse.payment_type === 'all_paid' ? 'All Paid' : 'Installment'}
                      </span>
                    </td>
                    <td className="px-3 xl:px-4 2xl:px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center min-w-[80px]">
                      {studentCourse.total_installments}
                    </td>
                    <td className="px-3 xl:px-4 2xl:px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium text-center min-w-[80px]">
                      {studentCourse.paid_installments}
                    </td>
                    <td className="px-3 xl:px-4 2xl:px-6 py-4 whitespace-nowrap text-sm text-yellow-600 font-medium text-center min-w-[80px]">
                      {studentCourse.due_installments}
                    </td>
                    <td className="px-3 xl:px-4 2xl:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 min-w-[100px]">
                      {formatCurrency(studentCourse.total_amount)}
                    </td>
                    <td className="px-3 xl:px-4 2xl:px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600 min-w-[100px]">
                      {formatCurrency(studentCourse.paid_amount)}
                    </td>
                    <td className="px-3 xl:px-4 2xl:px-6 py-4 whitespace-nowrap text-sm font-medium text-yellow-600 min-w-[100px]">
                      {formatCurrency(studentCourse.due_amount)}
                    </td>
                    <td className="px-3 xl:px-4 2xl:px-6 py-4 whitespace-nowrap text-sm font-medium min-w-[120px]">
                      <button
                        onClick={() => handleUpdateStatus(studentCourse.student_id, studentCourse.course_id)}
                        className="text-[#11CCEF] hover:text-[#0daed9] active:text-[#0a9bc4] font-semibold touch-manipulation whitespace-nowrap"
                      >
                        Update Status
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-4 bg-gray-50 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              Showing {((currentPage - 1) * pageLimit) + 1} to {Math.min(currentPage * pageLimit, totalItems)} of {totalItems} results
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  currentPage === 1
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-[#11CCEF] text-white hover:bg-[#0daed9]'
                }`}
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                        currentPage === pageNum
                          ? 'bg-[#11CCEF] text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <div className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  currentPage === totalPages
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-[#11CCEF] text-white hover:bg-[#0daed9]'
                }`}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Mobile/Tablet Card View */}
        <div className="lg:hidden divide-y divide-gray-200">
          {filteredStudentCoursePayments.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              {activeCardFilter ? 'No payments match the selected filter' : 'No payments found'}
            </div>
          ) : (
            filteredStudentCoursePayments.map((studentCourse) => (
              <div key={`${studentCourse.student_id}-${studentCourse.course_id}`} className="p-4 hover:bg-gray-50">
                <div className="space-y-3">
                  {/* Student Info */}
                  <div>
                    <div className="text-sm font-semibold text-gray-900 mb-1">{studentCourse.student_name}</div>
                    <div className="text-xs text-gray-500 break-all">{studentCourse.student_email}</div>
                  </div>

                  {/* Course Info */}
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Course</div>
                    <div className="text-sm font-medium text-gray-900">{studentCourse.course_title}</div>
                  </div>

                  {/* Plan Badge */}
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Plan</div>
                    <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${
                      studentCourse.payment_type === 'all_paid' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {studentCourse.payment_type === 'all_paid' ? 'All Paid' : 'Installment'}
                    </span>
                  </div>

                  {/* Installments Grid */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-200">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Total</div>
                      <div className="text-sm font-semibold text-gray-900">{studentCourse.total_installments}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Paid</div>
                      <div className="text-sm font-semibold text-green-600">{studentCourse.paid_installments}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Due</div>
                      <div className="text-sm font-semibold text-yellow-600">{studentCourse.due_installments}</div>
                    </div>
                  </div>

                  {/* Amounts Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-gray-200">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Total Amount</div>
                      <div className="text-sm font-semibold text-gray-900 break-words">{formatCurrency(studentCourse.total_amount)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Paid Amount</div>
                      <div className="text-sm font-semibold text-green-600 break-words">{formatCurrency(studentCourse.paid_amount)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Due Amount</div>
                      <div className="text-sm font-semibold text-yellow-600 break-words">{formatCurrency(studentCourse.due_amount)}</div>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="pt-2 border-t border-gray-200">
                    <button
                      onClick={() => handleUpdateStatus(studentCourse.student_id, studentCourse.course_id)}
                      className="w-full sm:w-auto px-4 py-2 text-sm text-[#11CCEF] hover:text-white hover:bg-[#11CCEF] active:bg-[#0daed9] font-semibold rounded-lg border border-[#11CCEF] transition-colors touch-manipulation"
                    >
                      Update Status
                    </button>
                  </div>
                </div>
              </div>
            ))
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
