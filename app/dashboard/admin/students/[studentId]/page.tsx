'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import { apiService } from '@/app/services/api';
import { getApiUrl } from '@/app/utils/apiUrl';
import StudentProfileDetail from '@/app/components/StudentProfileDetail';
import SendMessageToStudentModal from '@/app/components/SendMessageToStudentModal';

interface StudentProfile {
  user_id: number;
  name: string;
  email: string;
  learner_id?: string | null;
  gender?: string;
  date_of_birth?: string;
  nationality?: string;
  ethnicity?: string;
  current_role?: string;
  previous_qualification?: string;
  motivation?: string;
  vark_visual?: number;
  vark_auditory?: number;
  vark_reading?: number;
  vark_kinesthetic?: number;
  english_literacy?: string;
  ict_skills?: string;
  special_learning_needs?: string;
  profile_picture?: string;
  is_profile_complete?: number;
  profile_completed_at?: string | null;
  updated_at?: string | null;
}

interface PaymentInstallment {
  id: number;
  course_id: number;
  course_title: string;
  installment_number: number;
  is_deposit?: number;
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

const StudentDetailPage = () => {
  const params = useParams();
  const router = useRouter();
  const studentId = parseInt(params.studentId as string, 10);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [payments, setPayments] = useState<PaymentInstallment[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [onboarding, setOnboarding] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'onboarding' | 'documents' | 'payments' | 'courses'>('profile');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showReplacedDocs, setShowReplacedDocs] = useState(false);
  const [qualificationCourses, setQualificationCourses] = useState<any[]>([]);
  const [cpdCourses, setCpdCourses] = useState<any[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [deadlineEdit, setDeadlineEdit] = useState<{ courseId: number; courseTitle: string; unitId: number; unitTitle: string; currentDeadline: string | null } | null>(null);
  const [deadlineValue, setDeadlineValue] = useState('');
  const [savingDeadline, setSavingDeadline] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, [studentId]);

  useEffect(() => {
    if (activeTab === 'profile' && !onboarding) {
      fetchOnboarding();
    }
    if (activeTab === 'onboarding' && !onboarding) {
      fetchOnboarding();
    }
    if (activeTab === 'documents' && documents.length === 0) {
      fetchDocuments();
    }
    if (activeTab === 'courses') {
      const et = onboarding?.enrollment_type;
      const cpdOnly = et && et.hasCPD && !et.hasQualification;
      if (cpdOnly && cpdCourses.length === 0) {
        fetchCpdCourses();
      }
      if (!cpdOnly && qualificationCourses.length === 0) {
        fetchQualificationCourses();
      }
    }
  }, [activeTab, onboarding?.enrollment_type]);

  const fetchQualificationCourses = async () => {
    try {
      setCoursesLoading(true);
      const res = await apiService.getStudentQualificationCourses(studentId);
      if (res?.success && res?.qualificationCourses) {
        setQualificationCourses(res.qualificationCourses);
      }
    } catch (e) { }
    finally {
      setCoursesLoading(false);
    }
  };

  const fetchCpdCourses = async () => {
    try {
      setCoursesLoading(true);
      const res = await apiService.getStudentCPDCourses(studentId);
      if (res?.success && res?.cpdCourses) {
        setCpdCourses(res.cpdCourses);
      } else {
        setCpdCourses([]);
      }
    } catch (e) {
      setCpdCourses([]);
    } finally {
      setCoursesLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');

      const token = typeof window !== 'undefined' ? localStorage.getItem('lms-token') : null;
      const onboardingPromise = fetch(`/api/onboarding/student/${studentId}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Content-Type': 'application/json',
        },
      }).then((r) => r.json());

      const [profileResponse, paymentsResponse, onboardingJson] = await Promise.all([
        apiService.getStudentProfileById(studentId),
        apiService.getStudentInstallmentsByAdmin(studentId),
        onboardingPromise,
      ]);

      if (profileResponse?.success) {
        setProfile(profileResponse.profile);
      } else {
        setError('Failed to load student profile');
      }

      if (paymentsResponse?.success) {
        setPayments(paymentsResponse.installments || []);
      }

      if (onboardingJson?.success && onboardingJson?.onboarding) {
        setOnboarding(onboardingJson.onboarding);
      }
    } catch (error) {
      setError('Failed to load student data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchOnboarding = async () => {
    try {
      const response = await fetch(`/api/onboarding/student/${studentId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('lms-token')}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (data.success) {
        setOnboarding(data.onboarding);
      }
    } catch (error) { }
  };

  const fetchDocuments = async () => {
    try {
      const response = await fetch(`/api/documents/student/${studentId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('lms-token')}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (data.success) {
        setDocuments(data.documents || []);
      }
    } catch (error) { }
  };

  const handleVerifyStudent = async () => {
    const { isConfirmed } = await Swal.fire({
      title: 'Verify & grant dashboard access?',
      html: 'This will verify the student and grant dashboard access. All pending documents will be auto-approved.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#11CCEF',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, verify',
      cancelButtonText: 'Cancel',
      reverseButtons: true,
      focusCancel: true
    });
    if (!isConfirmed) return;

    try {
      setLoading(true);
      
      const pendingDocs = documents.filter((doc: any) => 
        doc.status === 'pending' || doc.status === null
      );
      
      if (pendingDocs.length > 0) {
        const approvePromises = pendingDocs.map((doc: any) => 
          apiService.approveDocument(doc.id, 'Auto-approved during onboarding verification')
        );
        await Promise.all(approvePromises);
      }

      const token = localStorage.getItem('lms-token');
      const response = await fetch(`/api/onboarding/admin/verify/${studentId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          admin_notes: 'Onboarding verified and approved by admin. All documents approved.'
        })
      });

      const data = await response.json();

      if (data.success) {
        await Swal.fire({
          title: 'Student verified',
          text: 'Dashboard access granted and all documents approved.',
          icon: 'success',
          confirmButtonColor: '#11CCEF',
          confirmButtonText: 'OK'
        });
        await fetchOnboarding();
        await fetchDocuments();
      } else {
        await Swal.fire({
          title: 'Verification failed',
          text: data.message || 'Unknown error',
          icon: 'error',
          confirmButtonColor: '#11CCEF',
          confirmButtonText: 'OK'
        });
      }
    } catch (error) {
      await Swal.fire({
        title: 'Error',
        text: 'Error verifying student. Please try again.',
        icon: 'error',
        confirmButtonColor: '#11CCEF',
        confirmButtonText: 'OK'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApproveDocument = async (docId: number) => {
    if (!confirm('Are you sure you want to approve this document?')) {
      return;
    }

    try {
      setLoading(true);
      const response = await apiService.approveDocument(docId, 'Approved by admin');

      if (response.success) {
        alert('✅ Document approved successfully!');
        await fetchDocuments();
      } else {
        alert('Failed to approve document: ' + (response.message || 'Unknown error'));
      }
    } catch (error) {
      alert('Error approving document. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectDocument = async () => {
    if (!selectedDocId || !rejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }

    try {
      setLoading(true);
      const response = await apiService.rejectDocument(selectedDocId, rejectionReason);

      if (response.success) {
        alert('Document rejected successfully!');
        setShowRejectModal(false);
        setSelectedDocId(null);
        setRejectionReason('');
        await fetchDocuments();
      } else {
        alert('Failed to reject document: ' + (response.message || 'Unknown error'));
      }
    } catch (error) {
      alert('Error rejecting document. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const openRejectModal = (docId: number) => {
    setSelectedDocId(docId);
    setShowRejectModal(true);
    setRejectionReason('');
  };

  const openDeadlineEdit = (courseId: number, courseTitle: string, unitId: number, unitTitle: string, currentDeadline: string | null) => {
    setDeadlineEdit({ courseId, courseTitle, unitId, unitTitle, currentDeadline });
    setDeadlineValue(currentDeadline ? new Date(currentDeadline).toISOString().slice(0, 16) : '');
  };

  const handleSaveDeadline = async () => {
    if (!deadlineEdit) return;
    const { courseId, unitId } = deadlineEdit;
    try {
      setSavingDeadline(true);
      const payload = deadlineValue.trim()
        ? [{ topicId: unitId, deadline: new Date(deadlineValue).toISOString(), topicType: 'qualification_unit' as const }]
        : [{ topicId: unitId, deadline: null, topicType: 'qualification_unit' as const }];
      const res = await apiService.setStudentDeadlines(courseId, studentId, payload);
      if (res?.success) {
        setDeadlineEdit(null);
        await fetchQualificationCourses();
      } else {
        alert(res?.message || 'Failed to update deadline');
      }
    } catch (e) {
      alert('Error updating deadline. Please try again.');
    } finally {
      setSavingDeadline(false);
    }
  };

  const handleUnlockAssignment = async (unitId: number, courseId: number) => {
    const result = await Swal.fire({
      title: 'Unlock assignment submission?',
      text: 'The student will be able to submit this assignment regardless of the deadline window.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#11CCEF',
      confirmButtonText: 'Yes, unlock',
      cancelButtonText: 'Cancel',
      reverseButtons: true,
      focusCancel: true,
    });
    if (!result.isConfirmed) return;
    try {
      const res = await apiService.unlockStudentAssignment(studentId, unitId, courseId);
      if (res?.success) {
        await Swal.fire({
          title: 'Unlocked',
          text: 'Assignment submission is unlocked for this unit.',
          icon: 'success',
          confirmButtonColor: '#11CCEF',
        });
        await fetchQualificationCourses();
      } else {
        await Swal.fire({
          title: 'Failed',
          text: res?.message || 'Could not unlock assignment submission.',
          icon: 'error',
          confirmButtonColor: '#11CCEF',
        });
      }
    } catch {
      await Swal.fire({
        title: 'Error',
        text: 'Failed to unlock assignment submission.',
        icon: 'error',
        confirmButtonColor: '#11CCEF',
      });
    }
  };

  const handleDownloadProfile = async () => {
    setDownloading(true);
    try {
      const token = localStorage.getItem('lms-token');
      const apiUrl = getApiUrl();
      const response = await fetch(
        `${apiUrl}/api/admin/students/${studentId}/download-profile`,
        {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        let msg = errText || `HTTP ${response.status}`;
        try {
          const j = JSON.parse(errText);
          if (j?.message) msg = j.message;
        } catch {
          /* plain text / HTML error body */
        }
        throw new Error(msg);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      const disposition = response.headers.get('content-disposition');
      let filename = `student_${studentId}_profile.zip`;
      if (disposition) {
        const m = disposition.match(/filename="([^"]+)"/i);
        if (m?.[1]) filename = m[1];
        else {
          const m2 = disposition.match(/filename=([^;\s]+)/i);
          if (m2?.[1]) filename = m2[1].replace(/"/g, '');
        }
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      await Swal.fire({
        title: 'Download started',
        text: 'Your profile ZIP is downloading. Large documents may take a moment.',
        icon: 'success',
        confirmButtonColor: '#11CCEF',
      });
    } catch {
      await Swal.fire({
        title: 'Download failed',
        text: 'Could not download the profile package. Check your connection and permissions, then try again.',
        icon: 'error',
        confirmButtonColor: '#11CCEF',
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleLockAssignment = async (unitId: number, courseId: number) => {
    const result = await Swal.fire({
      title: 'Lock assignment submission?',
      text: 'Deadline rules will apply again for this unit.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#E51791',
      confirmButtonText: 'Yes, lock',
      cancelButtonText: 'Cancel',
      reverseButtons: true,
      focusCancel: true,
    });
    if (!result.isConfirmed) return;
    try {
      const res = await apiService.lockStudentAssignment(studentId, unitId, courseId);
      if (res?.success) {
        await Swal.fire({
          title: 'Locked',
          text: 'Deadline rules apply again for this unit.',
          icon: 'success',
          confirmButtonColor: '#11CCEF',
        });
        await fetchQualificationCourses();
      } else {
        await Swal.fire({
          title: 'Failed',
          text: res?.message || 'Could not lock assignment submission.',
          icon: 'error',
          confirmButtonColor: '#11CCEF',
        });
      }
    } catch {
      await Swal.fire({
        title: 'Error',
        text: 'Failed to lock assignment submission.',
        icon: 'error',
        confirmButtonColor: '#11CCEF',
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not set';
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      case 'due':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const enrollmentType = onboarding?.enrollment_type;
  const isCpdStudent = Boolean(
    enrollmentType && enrollmentType.hasCPD && !enrollmentType.hasQualification
  );

  // Group payments by course
  const paymentsByCourse = payments.reduce((acc, payment) => {
    if (!acc[payment.course_id]) {
      acc[payment.course_id] = {
        course_id: payment.course_id,
        course_title: payment.course_title,
        payments: []
      };
    }
    acc[payment.course_id].payments.push(payment);
    return acc;
  }, {} as Record<number, { course_id: number; course_title: string; payments: PaymentInstallment[] }>);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#11CCEF] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading student data...</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Student not found'}</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-[#11CCEF] text-white rounded-lg hover:bg-[#0daed9]"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header with Gradient Background */}
        <div className="bg-gradient-to-r from-[#11CCEF] via-[#E51791] to-[#11CCEF] rounded-2xl shadow-xl mb-8 overflow-hidden">
          <div className="p-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="flex items-center gap-6">
                {profile.profile_picture ? (
                  <img
                    src={profile.profile_picture}
                    alt={profile.name}
                    className="h-24 w-24 rounded-2xl object-cover border-4 border-white shadow-lg"
                  />
                ) : (
                  <div className="h-24 w-24 rounded-2xl bg-white flex items-center justify-center text-[#11CCEF] text-3xl font-bold shadow-lg">
                    {profile.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h1 className="text-3xl lg:text-4xl font-bold text-white mb-2">{profile.name}</h1>
                  <p className="text-white/90 text-lg flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {profile.email}
                  </p>
                  {profile.is_profile_complete === 1 && (
                    <span className="inline-flex items-center gap-2 mt-2 px-4 py-2 rounded-full text-sm font-bold bg-white text-[#61CE70] shadow-md">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                      Profile Complete
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowMessageModal(true)}
                  className="px-6 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 shadow-lg transition-all text-white border-0 cursor-pointer"
                  style={{
                    background: 'linear-gradient(135deg, #e51791, #c1147a)',
                    boxShadow: '0 4px 12px rgba(229,23,145,0.3)',
                  }}
                >
                  💬 Send Message
                </button>
                <button
                  type="button"
                  onClick={handleDownloadProfile}
                  disabled={downloading}
                  className="px-6 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed text-white"
                  style={{
                    background: downloading
                      ? 'rgba(226, 232, 240, 0.35)'
                      : 'linear-gradient(135deg, #11CCEF, #E51791)',
                    color: downloading ? 'rgba(255,255,255,0.75)' : '#fff',
                    border: 'none',
                  }}
                >
                  <span className="text-base" aria-hidden>
                    {downloading ? '⏳' : '⬇️'}
                  </span>
                  {downloading ? 'Preparing download…' : 'Download profile'}
                </button>
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="px-6 py-3 text-white bg-white/20 backdrop-blur-sm rounded-xl hover:bg-white/30 transition-all font-semibold flex items-center justify-center gap-2 shadow-lg"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to Students
                </button>
              </div>
            </div>
          </div>

          {/* Modern Tabs */}
          <div className="bg-white/10 backdrop-blur-sm">
            <nav className="flex">
              <button
                onClick={() => setActiveTab('profile')}
                className={`relative px-8 py-4 font-semibold text-sm transition-all ${
                  activeTab === 'profile'
                    ? 'text-white bg-white/20'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                {activeTab === 'profile' && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-white rounded-t-full"></div>
                )}
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Profile
                </div>
              </button>
              <button
                onClick={() => setActiveTab('onboarding')}
                className={`relative px-8 py-4 font-semibold text-sm transition-all ${
                  activeTab === 'onboarding'
                    ? 'text-white bg-white/20'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                {activeTab === 'onboarding' && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-white rounded-t-full"></div>
                )}
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  Onboarding
                </div>
              </button>
              <button
                onClick={() => setActiveTab('documents')}
                className={`relative px-8 py-4 font-semibold text-sm transition-all ${
                  activeTab === 'documents'
                    ? 'text-white bg-white/20'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                {activeTab === 'documents' && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-white rounded-t-full"></div>
                )}
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Documents
                  {documents.length > 0 && (
                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-white text-[#11CCEF]">
                      {documents.length}
                    </span>
                  )}
                </div>
              </button>
              <button
                onClick={() => setActiveTab('payments')}
                className={`relative px-8 py-4 font-semibold text-sm transition-all ${
                  activeTab === 'payments'
                    ? 'text-white bg-white/20'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                {activeTab === 'payments' && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-white rounded-t-full"></div>
                )}
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  Payments
                  {payments.length > 0 && (
                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-white text-[#11CCEF]">
                      {payments.length}
                    </span>
                  )}
                </div>
              </button>
              <button
                onClick={() => setActiveTab('courses')}
                className={`relative px-8 py-4 font-semibold text-sm transition-all ${
                  activeTab === 'courses'
                    ? 'text-white bg-white/20'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                {activeTab === 'courses' && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-white rounded-t-full"></div>
                )}
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  Course
                  {(isCpdStudent ? cpdCourses.length : qualificationCourses.length) > 0 && (
                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-white text-[#11CCEF]">
                      {isCpdStudent ? cpdCourses.length : qualificationCourses.length}
                    </span>
                  )}
                </div>
              </button>
            </nav>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            {/* Personal Information */}
            <div className="bg-white rounded-2xl shadow-lg border-2 border-[#11CCEF]/20 overflow-hidden hover:shadow-xl transition-shadow">
              <div className="bg-gradient-to-r from-[#11CCEF]/10 to-[#E51791]/10 px-6 py-4 border-b-2 border-[#11CCEF]/20 flex items-center gap-3">
                <div className="bg-gradient-to-br from-[#11CCEF] to-[#E51791] p-2 rounded-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900">Personal Information</h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="bg-gradient-to-br from-[#11CCEF]/5 to-[#E51791]/5 rounded-xl p-4 border border-[#11CCEF]/10">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Full Name</label>
                    <p className="text-gray-900 font-medium mt-1">{onboarding?.initialAssessment?.full_name || profile.name || 'Not provided'}</p>
                  </div>
                  <div className="bg-gradient-to-br from-[#11CCEF]/5 to-[#E51791]/5 rounded-xl p-4 border border-[#11CCEF]/10">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Learner ID</label>
                    <p className="text-gray-900 font-medium mt-1">{profile.learner_id || 'Not provided'}</p>
                  </div>
                  <div className="bg-gradient-to-br from-[#11CCEF]/5 to-[#E51791]/5 rounded-xl p-4 border border-[#11CCEF]/10">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact Number</label>
                    <p className="text-gray-900 font-medium mt-1">{onboarding?.initialAssessment?.contact_number || 'Not provided'}</p>
                  </div>
                  <div className="bg-gradient-to-br from-[#11CCEF]/5 to-[#E51791]/5 rounded-xl p-4 border border-[#11CCEF]/10">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Primary Language</label>
                    <p className="text-gray-900 font-medium mt-1">{onboarding?.initialAssessment?.primary_language || 'Not provided'}</p>
                  </div>
                  <div className="bg-gradient-to-br from-[#11CCEF]/5 to-[#E51791]/5 rounded-xl p-4 border border-[#11CCEF]/10">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Gender</label>
                    <p className="text-gray-900 font-medium mt-1">{onboarding?.initialAssessment?.gender || profile.gender || 'Not provided'}</p>
                  </div>
                  <div className="bg-gradient-to-br from-[#11CCEF]/5 to-[#E51791]/5 rounded-xl p-4 border border-[#11CCEF]/10">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Date of Birth</label>
                    <p className="text-gray-900 font-medium mt-1">
                      {onboarding?.initialAssessment?.date_of_birth
                        ? new Date(onboarding.initialAssessment.date_of_birth).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })
                        : profile.date_of_birth
                        ? new Date(profile.date_of_birth).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })
                        : 'Not provided'}
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-[#11CCEF]/5 to-[#E51791]/5 rounded-xl p-4 border border-[#11CCEF]/10">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Nationality</label>
                    <p className="text-gray-900 font-medium mt-1">{onboarding?.initialAssessment?.nationality || profile.nationality || 'Not provided'}</p>
                  </div>
                  <div className="bg-gradient-to-br from-[#11CCEF]/5 to-[#E51791]/5 rounded-xl p-4 border border-[#11CCEF]/10">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Ethnicity</label>
                    <p className="text-gray-900 font-medium mt-1">{onboarding?.initialAssessment?.ethnicity || profile.ethnicity || 'Not provided'}</p>
                  </div>
                  <div className="bg-gradient-to-br from-[#11CCEF]/5 to-[#E51791]/5 rounded-xl p-4 border border-[#11CCEF]/10 md:col-span-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Postal Address</label>
                    <p className="text-gray-900 font-medium mt-1 whitespace-pre-wrap">{onboarding?.initialAssessment?.postal_address || 'Not provided'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Motivation & Background — qualification-focused */}
            {!isCpdStudent && (
            <div className="bg-white rounded-2xl shadow-lg border-2 border-[#11CCEF]/20 overflow-hidden hover:shadow-xl transition-shadow">
              <div className="bg-gradient-to-r from-[#11CCEF]/10 to-[#E51791]/10 px-6 py-4 border-b-2 border-[#11CCEF]/20 flex items-center gap-3">
                <div className="bg-gradient-to-br from-[#11CCEF] to-[#E51791] p-2 rounded-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900">Motivation & Background</h3>
              </div>
              <div className="p-6 space-y-5">
                <div className="bg-gradient-to-br from-[#11CCEF]/5 to-[#E51791]/5 rounded-xl p-5 border border-[#11CCEF]/10">
                  <div className="flex items-start gap-3">
                    <div className="bg-gradient-to-br from-[#11CCEF] to-[#E51791] p-2 rounded-lg flex-shrink-0">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Why This Qualification?</label>
                      <p className="text-gray-900 mt-2 italic border-l-4 border-[#11CCEF] pl-4 whitespace-pre-wrap">
                        {onboarding?.initialAssessment?.why_qualification || profile.motivation || 'Not provided'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-[#11CCEF]/5 to-[#E51791]/5 rounded-xl p-5 border border-[#11CCEF]/10">
                  <div className="flex items-start gap-3">
                    <div className="bg-gradient-to-br from-[#E51791] to-[#11CCEF] p-2 rounded-lg flex-shrink-0">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Career Goals</label>
                      <p className="text-gray-900 mt-2 italic border-l-4 border-[#E51791] pl-4 whitespace-pre-wrap">
                        {onboarding?.initialAssessment?.career_goals || 'Not provided'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-[#11CCEF]/5 to-[#E51791]/5 rounded-xl p-4 border border-[#11CCEF]/10">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Current Employment</label>
                    <p className="text-gray-900 font-medium mt-1">{onboarding?.initialAssessment?.current_employment || 'Not provided'}</p>
                  </div>
                  <div className="bg-gradient-to-br from-[#11CCEF]/5 to-[#E51791]/5 rounded-xl p-4 border border-[#11CCEF]/10">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Highest Qualification</label>
                    <p className="text-gray-900 font-medium mt-1">{onboarding?.initialAssessment?.highest_qualification || profile.previous_qualification || 'Not provided'}</p>
                  </div>
                </div>
              </div>
            </div>
            )}

            {/* Skills & Learning Needs — qualification */}
            {!isCpdStudent && (
            <div className="bg-white rounded-2xl shadow-lg border-2 border-[#11CCEF]/20 overflow-hidden hover:shadow-xl transition-shadow">
              <div className="bg-gradient-to-r from-[#11CCEF]/10 to-[#E51791]/10 px-6 py-4 border-b-2 border-[#11CCEF]/20 flex items-center gap-3">
                <div className="bg-gradient-to-br from-[#11CCEF] to-[#E51791] p-2 rounded-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900">Skills & Learning Needs</h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-gradient-to-br from-[#11CCEF]/10 to-[#11CCEF]/5 rounded-xl p-5 border-2 border-[#11CCEF]/20">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="bg-[#11CCEF] p-2 rounded-lg">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      </div>
                      <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">English & Literacy</label>
                    </div>
                    <p className="text-lg font-bold text-[#11CCEF]">{onboarding?.initialAssessment?.english_literacy || profile.english_literacy || 'Not provided'}</p>
                  </div>
                  <div className="bg-gradient-to-br from-[#E51791]/10 to-[#E51791]/5 rounded-xl p-5 border-2 border-[#E51791]/20">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="bg-[#E51791] p-2 rounded-lg">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">ICT Skills</label>
                    </div>
                    <p className="text-lg font-bold text-[#E51791]">{onboarding?.initialAssessment?.ict_skills || profile.ict_skills || 'Not provided'}</p>
                  </div>
                  <div className="bg-gradient-to-br from-[#61CE70]/10 to-[#61CE70]/5 rounded-xl p-5 border-2 border-[#61CE70]/20">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="bg-[#61CE70] p-2 rounded-lg">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Maths Skills</label>
                    </div>
                    <p className="text-lg font-bold text-[#61CE70]">{onboarding?.initialAssessment?.maths_skills || 'Not provided'}</p>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-[#11CCEF]/5 to-[#E51791]/5 rounded-xl p-5 border border-[#11CCEF]/10">
                  <div className="flex items-start gap-3">
                    <div className="bg-gradient-to-br from-[#11CCEF] to-[#E51791] p-2 rounded-lg flex-shrink-0">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Special Learning Needs / Disabilities</label>
                      <p className="text-gray-900 mt-2 whitespace-pre-wrap">
                        {onboarding?.initialAssessment?.special_learning_needs || profile.special_learning_needs || 'None identified'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            )}

            {isCpdStudent && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-sm text-emerald-900">
                <p className="font-bold text-base mb-1">CPD learner profile</p>
                <p className="text-emerald-800/90">
                  Motivation, extended skills assessment, and VARK are not required for CPD-only students. Use the Initial Assessment data in the Onboarding tab for submitted details.
                </p>
              </div>
            )}

            {/* Learning Style (VARK) — qualification */}
            {!isCpdStudent && (
            <div className="bg-white rounded-2xl shadow-lg border-2 border-[#11CCEF]/20 overflow-hidden hover:shadow-xl transition-shadow">
              <div className="bg-gradient-to-r from-[#11CCEF]/10 to-[#E51791]/10 px-6 py-4 border-b-2 border-[#11CCEF]/20 flex items-center gap-3">
                <div className="bg-gradient-to-br from-[#11CCEF] to-[#E51791] p-2 rounded-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900">Learning Style (VARK)</h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Visual', value: profile.vark_visual || 0, color: '#11CCEF', icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' },
                    { label: 'Auditory', value: profile.vark_auditory || 0, color: '#E51791', icon: 'M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z' },
                    { label: 'Reading', value: profile.vark_reading || 0, color: '#61CE70', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
                    { label: 'Kinesthetic', value: profile.vark_kinesthetic || 0, color: '#11CCEF', icon: 'M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11' }
                  ].map((score) => (
                    <div key={score.label} className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-5 border-2 hover:shadow-md transition-shadow" style={{borderColor: `${score.color}30`}}>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 rounded-lg" style={{backgroundColor: score.color}}>
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={score.icon} />
                          </svg>
                        </div>
                        <div className="text-sm font-semibold text-gray-700">{score.label}</div>
                      </div>
                      <div className="text-3xl font-bold mb-3" style={{color: score.color}}>{score.value}</div>
                      <div className="bg-gray-200 rounded-full h-2.5">
                        <div
                          className="h-2.5 rounded-full transition-all"
                          style={{ width: `${(score.value / 20) * 100}%`, backgroundColor: score.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            )}

            {/* E-Signature & Agreements */}
            {onboarding?.initialAssessment && (
              <div className="bg-white rounded-2xl shadow-lg border-2 border-[#11CCEF]/20 overflow-hidden hover:shadow-xl transition-shadow">
                <div className="bg-gradient-to-r from-[#11CCEF]/10 to-[#E51791]/10 px-6 py-4 border-b-2 border-[#11CCEF]/20 flex items-center gap-3">
                  <div className="bg-gradient-to-br from-[#11CCEF] to-[#E51791] p-2 rounded-lg">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">E-Signature & Agreements</h3>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {[
                      { key: 'assessment_accuracy_consent', label: 'Information Accuracy Agreement' },
                      { key: 'data_usage_consent', label: 'Learning Support Disclosure Agreement' },
                      { key: 'qualification_understanding', label: 'Terms & Conditions Agreement' },
                      { key: 'apl_understanding', label: 'Digital Signature Agreement' }
                    ].map((agreement) => {
                      const isChecked = onboarding.initialAssessment[agreement.key] === true || onboarding.initialAssessment[agreement.key] === 1;
                      return (
                        <div key={agreement.key} className={`rounded-xl p-4 border-2 flex items-center gap-3 ${isChecked ? 'bg-[#61CE70]/10 border-[#61CE70]/30' : 'bg-gray-50 border-gray-200'}`}>
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isChecked ? 'bg-[#61CE70]' : 'bg-gray-300'}`}>
                            {isChecked ? (
                              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            )}
                          </div>
                          <span className={`font-medium ${isChecked ? 'text-[#61CE70]' : 'text-gray-500'}`}>{agreement.label}</span>
                        </div>
                      );
                    })}
                  </div>
                  {onboarding.initialAssessment.signature_date && (
                    <div className="bg-gradient-to-br from-[#11CCEF]/5 to-[#E51791]/5 rounded-xl p-5 border border-[#11CCEF]/10">
                      <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-br from-[#11CCEF] to-[#E51791] p-2 rounded-lg">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Signed On</label>
                          <p className="text-gray-900 font-medium">
                            {new Date(onboarding.initialAssessment.signature_date).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            {payments.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-4">💳</div>
                <p className="text-gray-500 text-lg">No payment installments found for this student.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.values(paymentsByCourse).map((courseGroup) => (
                  <div key={courseGroup.course_id} className="border border-gray-200 rounded-lg p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">{courseGroup.course_title}</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              No.
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Installment
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Amount
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Due Date
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Status
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Paid At
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Reference
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {courseGroup.payments.map((payment) => (
                            <tr key={payment.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {payment.is_deposit === 1 ? 'D' : payment.installment_number - 1}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {payment.is_deposit === 1 ? '💰 Initial Deposit' : `Instalment ${payment.installment_number - 1}`}
                              </td>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                {formatCurrency(payment.amount)}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-500">
                                {formatDate(payment.due_date)}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                                    payment.status
                                  )}`}
                                >
                                  {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-500">
                                {payment.paid_at ? formatDate(payment.paid_at) : '-'}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-500">
                                {payment.payment_reference || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Onboarding Tab */}
        {activeTab === 'onboarding' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            {!onboarding ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#11CCEF] mx-auto mb-4"></div>
                <p className="text-gray-600">Loading onboarding data...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Verification Status Banner */}
                {onboarding.status && (() => {
                  const isAdminVerified = !!onboarding.status.admin_verified;
                  const dashGranted = !!onboarding.status.dashboard_access_granted;
                  const cpdAccessOk = isCpdStudent && (isAdminVerified || dashGranted);
                  const showVerifiedHeader = isAdminVerified || cpdAccessOk;
                  const showQualPending = !isCpdStudent && !isAdminVerified;
                  const showCpdPending = isCpdStudent && !showVerifiedHeader;
                  const showVerifyButton = showQualPending;

                  return (
                  <div className={`border rounded-lg p-4 ${
                    showVerifiedHeader
                      ? 'bg-green-50 border-green-300'
                      : isCpdStudent
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-yellow-50 border-yellow-300'
                  }`}>
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex-1 min-w-0">
                        {showVerifiedHeader ? (
                          <h3 className="font-bold text-lg">
                            ✅ Verified & Dashboard Access Granted
                          </h3>
                        ) : showCpdPending ? (
                          <div
                            style={{
                              background: '#f0fdf4',
                              border: '1px solid #bbf7d0',
                              borderRadius: '12px',
                              padding: '12px 16px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                            }}
                          >
                            <span style={{ fontSize: '20px' }}>✅</span>
                            <div>
                              <div
                                style={{
                                  fontSize: '13px',
                                  fontWeight: 700,
                                  color: '#16a34a',
                                }}
                              >
                                CPD student — access automatic
                              </div>
                              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                                CPD students get dashboard access automatically after completing their profile. No manual verification required.
                              </div>
                            </div>
                          </div>
                        ) : (
                          <h3 className="font-bold text-lg">⏳ Pending Verification</h3>
                        )}
                        {showQualPending && documents.length > 0 && (
                          <p className="text-sm text-gray-600 mt-1">
                            📄 {documents.filter((d: any) => d.status === 'pending' || !d.status).length} pending document(s) will be auto-approved upon verification
                          </p>
                        )}
                        {onboarding.status.admin_verified_at && isAdminVerified && (
                          <p className="text-sm text-gray-600">
                            Verified on {formatDate(onboarding.status.admin_verified_at)}
                          </p>
                        )}
                        {onboarding.status.admin_notes && (
                          <p className="text-sm text-gray-600 mt-1">
                            <span className="font-medium">Admin Notes:</span> {onboarding.status.admin_notes}
                          </p>
                        )}
                      </div>
                      {showVerifyButton && (
                        <button
                          onClick={handleVerifyStudent}
                          disabled={loading}
                          className="px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          {loading ? 'Verifying...' : '✓ Verify & Grant Dashboard Access'}
                        </button>
                      )}
                    </div>
                    {showVerifiedHeader && (
                      <div className={`mt-3 flex items-center gap-2 p-3 rounded-lg ${
                        onboarding.status?.verification_email_sent
                          ? 'bg-green-50 border border-green-200'
                          : 'bg-gray-50 border border-gray-200'
                      }`}>
                        <span className="text-base">✉️</span>
                        {onboarding.status?.verification_email_sent ? (
                          <div className="flex-1 flex items-center justify-between flex-wrap gap-2">
                            <div>
                              <span className="text-sm font-bold text-green-700">✓ Verification Email Sent</span>
                              {onboarding.status?.verification_email_sent_at && (
                                <span className="text-xs text-gray-500 ml-2">
                                  {new Date(onboarding.status.verification_email_sent_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                            <button
                              onClick={async () => {
                                const { isConfirmed } = await Swal.fire({ title: 'Resend verification email?', text: `Email will be sent to ${profile?.email}`, icon: 'question', showCancelButton: true, confirmButtonText: 'Resend', confirmButtonColor: '#0ea5e9' });
                                if (!isConfirmed) return;
                                try {
                                  const data = await apiService.resendVerificationEmail(Number(studentId));
                                  if (data.success) { Swal.fire('Sent!', 'Verification email resent successfully.', 'success'); fetchOnboarding(); }
                                  else Swal.fire('Failed', data.message || 'Failed to send email', 'error');
                                } catch { Swal.fire('Error', 'Failed to send email', 'error'); }
                              }}
                              className="text-xs font-bold text-sky-600 bg-sky-50 border border-sky-200 rounded-lg px-3 py-1.5 hover:bg-sky-100 transition-colors"
                            >
                              ↻ Resend
                            </button>
                          </div>
                        ) : (
                          <div className="flex-1 flex items-center justify-between flex-wrap gap-2">
                            <span className="text-sm text-gray-500">Verification email not sent yet</span>
                            <button
                              onClick={async () => {
                                const { isConfirmed } = await Swal.fire({ title: 'Send verification email?', text: `Email will be sent to ${profile?.email}`, icon: 'question', showCancelButton: true, confirmButtonText: 'Send', confirmButtonColor: '#0ea5e9' });
                                if (!isConfirmed) return;
                                try {
                                  const data = await apiService.resendVerificationEmail(Number(studentId));
                                  if (data.success) { Swal.fire('Sent!', 'Verification email sent successfully.', 'success'); fetchOnboarding(); }
                                  else Swal.fire('Failed', data.message || 'Failed to send email', 'error');
                                } catch { Swal.fire('Error', 'Failed to send email', 'error'); }
                              }}
                              className="text-xs font-bold text-sky-600 bg-sky-50 border border-sky-200 rounded-lg px-3 py-1.5 hover:bg-sky-100 transition-colors"
                            >
                              ✉️ Send Email
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  );
                })()}

                {/* Step 1: Course Selection */}
                {onboarding.courseSelection && (
                  <div className="border border-gray-200 rounded-lg p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">📚 Course Selection</h3>
                    <div className="space-y-2">
                      <p><span className="font-medium">CPD Courses:</span> {onboarding.courseSelection.cpd_courses ? 'Yes' : 'No'}</p>
                      <p><span className="font-medium">Qualifications:</span> {onboarding.courseSelection.qualifications ? 'Yes' : 'No'}</p>
                    </div>
                  </div>
                )}

                {/* Step 2: Qualification Level — not shown for CPD-only */}
                {!isCpdStudent && onboarding.qualificationSelection && (
                  <div className="border border-gray-200 rounded-lg p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">🎓 Qualification Level</h3>
                    <p><span className="font-medium">Level:</span> {onboarding.qualificationSelection.level || 'Not selected'}</p>
                  </div>
                )}

                {/* Step 3: Initial Assessment */}
                {onboarding.initialAssessment && (
                  <div className="border border-gray-200 rounded-lg p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">📝 Initial Assessment</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-500">Full Name</p>
                        <p className="text-gray-900">{onboarding.initialAssessment.full_name || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">Contact Number</p>
                        <p className="text-gray-900">{onboarding.initialAssessment.contact_number || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">Primary Language</p>
                        <p className="text-gray-900">{onboarding.initialAssessment.primary_language || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">Postal Address</p>
                        <p className="text-gray-900 whitespace-pre-wrap">{onboarding.initialAssessment.postal_address || 'N/A'}</p>
                      </div>
                      {!isCpdStudent && (
                        <>
                          <div className="md:col-span-2">
                            <p className="text-sm font-medium text-gray-500">Why Qualification</p>
                            <p className="text-gray-900 whitespace-pre-wrap">{onboarding.initialAssessment.why_qualification || 'N/A'}</p>
                          </div>
                          <div className="md:col-span-2">
                            <p className="text-sm font-medium text-gray-500">Career Goals</p>
                            <p className="text-gray-900 whitespace-pre-wrap">{onboarding.initialAssessment.career_goals || 'N/A'}</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Step 4: Onboarding Status */}
                {onboarding.status && isCpdStudent && (
                  <div
                    className="border border-emerald-200 rounded-lg p-6 bg-emerald-50/50"
                    style={{ borderRadius: '12px' }}
                  >
                    <h3 className="text-xl font-bold text-gray-900 mb-4">📋 CPD onboarding status</h3>
                    <div className="space-y-2 text-sm">
                      <p className={onboarding.status.welcome_completed ? 'text-green-700 font-medium' : 'text-gray-500'}>
                        {onboarding.status.welcome_completed ? '✓' : '○'} Welcome completed
                      </p>
                      <p className={onboarding.status.course_selection_completed ? 'text-green-700 font-medium' : 'text-gray-500'}>
                        {onboarding.status.course_selection_completed ? '✓' : '○'} Course path set (auto)
                      </p>
                      <p className={onboarding.status.initial_assessment_completed ? 'text-green-700 font-medium' : 'text-gray-500'}>
                        {onboarding.status.initial_assessment_completed ? '✓' : '○'} Initial assessment completed
                      </p>
                      <p className={onboarding.status.dashboard_access_granted ? 'text-green-700 font-medium' : 'text-gray-500'}>
                        {onboarding.status.dashboard_access_granted ? '✓' : '○'} Dashboard access granted
                      </p>
                    </div>
                  </div>
                )}

                {onboarding.status && !isCpdStudent && (
                  <div className="border border-gray-200 rounded-lg p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">✅ Onboarding Status</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Welcome</p>
                        <p className={onboarding.status.welcome_completed ? 'text-green-600 font-medium' : 'text-gray-400'}>
                          {onboarding.status.welcome_completed ? '✓ Complete' : '○ Pending'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Course Selection</p>
                        <p className={onboarding.status.course_selection_completed ? 'text-green-600 font-medium' : 'text-gray-400'}>
                          {onboarding.status.course_selection_completed ? '✓ Complete' : '○ Pending'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Documents</p>
                        <p className={onboarding.status.documents_uploaded ? 'text-green-600 font-medium' : 'text-gray-400'}>
                          {onboarding.status.documents_uploaded ? '✓ Complete' : '○ Pending'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Assessment</p>
                        <p className={onboarding.status.initial_assessment_completed ? 'text-green-600 font-medium' : 'text-gray-400'}>
                          {onboarding.status.initial_assessment_completed ? '✓ Complete' : '○ Pending'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <div className="bg-white rounded-2xl shadow-lg border-2 border-[#11CCEF]/20 overflow-hidden">
            {documents.length === 0 ? (
              <div className="text-center py-20">
                <div className="bg-gradient-to-br from-[#11CCEF]/10 to-[#E51791]/10 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-12 h-12 text-[#11CCEF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-gray-500 text-lg font-medium">No documents uploaded yet.</p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="bg-gradient-to-r from-[#11CCEF]/10 to-[#E51791]/10 px-6 py-4 border-b-2 border-[#11CCEF]/20">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-gradient-to-br from-[#11CCEF] to-[#E51791] p-2 rounded-lg">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-bold text-gray-900">Uploaded Documents</h3>
                    </div>
                    <label className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer bg-white px-4 py-2 rounded-xl border border-[#11CCEF]/20 hover:bg-[#11CCEF]/5 transition-colors">
                      <input
                        type="checkbox"
                        checked={showReplacedDocs}
                        onChange={(e) => setShowReplacedDocs(e.target.checked)}
                        className="rounded border-gray-300 text-[#11CCEF] focus:ring-[#11CCEF] w-4 h-4"
                      />
                      <span className="font-medium">Show replaced documents</span>
                    </label>
                  </div>
                </div>

                {/* Documents Grid */}
                <div className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {documents
                      .filter((doc: any) => showReplacedDocs || doc.status !== 'replaced')
                      .map((doc: any) => {
                        const getDocTypeIcon = (type: string) => {
                          switch (type) {
                            case 'qualification':
                              return (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                                </svg>
                              );
                            case 'identity':
                              return (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                                </svg>
                              );
                            case 'address':
                              return (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                </svg>
                              );
                            case 'cv':
                              return (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              );
                            default:
                              return (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                              );
                          }
                        };

                        const getDocTypeColor = (type: string) => {
                          switch (type) {
                            case 'qualification': return '#11CCEF';
                            case 'identity': return '#E51791';
                            case 'address': return '#61CE70';
                            case 'cv': return '#11CCEF';
                            default: return '#11CCEF';
                          }
                        };

                        const docColor = getDocTypeColor(doc.document_type);
                        const isReplaced = doc.status === 'replaced';
                        
                        return (
                          <div 
                            key={doc.id} 
                            className={`relative rounded-xl overflow-hidden transition-all ${
                              isReplaced 
                                ? 'bg-gray-50 border-2 border-gray-300 opacity-60' 
                                : 'bg-gradient-to-br from-white to-gray-50 border-2 hover:shadow-lg'
                            }`}
                            style={{ borderColor: isReplaced ? '#d1d5db' : `${docColor}30` }}
                          >
                            {/* Status Banner */}
                            {isReplaced && (
                              <div className="absolute top-3 right-3 z-10">
                                <span className="px-3 py-1 bg-gray-500 text-white text-xs font-bold rounded-full shadow-md">
                                  OLD VERSION
                                </span>
                              </div>
                            )}
                            {doc.version > 1 && !isReplaced && (
                              <div className="absolute top-3 right-3 z-10">
                                <span className="px-3 py-1.5 bg-[#61CE70] text-white text-xs font-bold rounded-full shadow-lg flex items-center gap-1 animate-pulse">
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                                  </svg>
                                  NEW
                                </span>
                              </div>
                            )}

                            <div className="p-5">
                              {/* Document Type Icon & Badge */}
                              <div className="flex items-start gap-4 mb-4">
                                <div 
                                  className="p-3 rounded-xl flex-shrink-0"
                                  style={{ backgroundColor: `${docColor}15` }}
                                >
                                  <div style={{ color: docColor }}>
                                    {getDocTypeIcon(doc.document_type)}
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`font-bold text-lg mb-1 truncate ${isReplaced ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                                    {doc.file_name}
                                  </p>
                                  <div className="flex flex-wrap items-center gap-2 text-sm">
                                    <span 
                                      className="inline-flex items-center px-3 py-1 rounded-full font-semibold text-white"
                                      style={{ backgroundColor: docColor }}
                                    >
                                      {doc.document_type}
                                    </span>
                                    <span className="text-gray-500">
                                      📅 {formatDate(doc.uploaded_at)}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Replacement Warning */}
                              {doc.previous_version_id && !isReplaced && (
                                <div className="mb-4 p-3 bg-orange-50 border-l-4 border-orange-400 rounded-r-lg">
                                  <p className="text-sm font-semibold text-orange-700 flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    Replaces rejected document
                                  </p>
                                </div>
                              )}

                              {/* Rejection Reason */}
                              {doc.status === 'rejected' && doc.rejection_reason && (
                                <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
                                  <p className="text-sm font-bold text-red-700 mb-1">❌ Rejection Reason:</p>
                                  <p className="text-sm text-gray-700 italic">{doc.rejection_reason}</p>
                                </div>
                              )}

                              {/* Status Badge */}
                              <div className="mb-4">
                                <span className={`inline-flex items-center px-4 py-2 rounded-xl text-sm font-bold shadow-sm ${
                                  doc.status === 'approved' ? 'bg-[#61CE70] text-white' :
                                  doc.status === 'rejected' ? 'bg-red-500 text-white' :
                                  doc.status === 'replaced' ? 'bg-gray-400 text-white' :
                                  'bg-yellow-400 text-gray-900'
                                }`}>
                                  {doc.status === 'approved' && (
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                  {doc.status === 'rejected' && (
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  )}
                                  {(doc.status || 'pending').toUpperCase()}
                                </span>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex flex-wrap items-center gap-3">
                                <a
                                  href={doc.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-1 min-w-[120px] px-5 py-2.5 bg-gradient-to-r from-[#11CCEF] to-[#0daed9] text-white font-semibold rounded-xl hover:shadow-lg transition-all text-center flex items-center justify-center gap-2"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                  View
                                </a>
                                {doc.status !== 'approved' && doc.status !== 'replaced' && (
                                  <>
                                    <button
                                      onClick={() => handleApproveDocument(doc.id)}
                                      className="px-5 py-2.5 bg-[#61CE70] text-white font-semibold rounded-xl hover:bg-[#51be60] hover:shadow-lg transition-all flex items-center gap-2"
                                    >
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                      </svg>
                                      Approve
                                    </button>
                                    <button
                                      onClick={() => openRejectModal(doc.id)}
                                      className="px-5 py-2.5 bg-red-500 text-white font-semibold rounded-xl hover:bg-red-600 hover:shadow-lg transition-all flex items-center gap-2"
                                    >
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                      Reject
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Course Tab: qualification courses, unit pass/refer, deadlines, update deadline */}
        {activeTab === 'courses' && (
          <div className="bg-white rounded-2xl shadow-lg border-2 border-[#11CCEF]/20 overflow-hidden">
            {coursesLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#11CCEF]"></div>
                <span className="ml-3 text-gray-600">Loading courses...</span>
              </div>
            ) : isCpdStudent && cpdCourses.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-5xl mb-4">📚</div>
                <p className="text-gray-500 text-lg">No CPD courses enrolled.</p>
              </div>
            ) : isCpdStudent ? (
              <div className="p-6 space-y-6">
                <h3 className="text-xl font-bold text-gray-900">CPD courses</h3>
                <div className="space-y-4">
                  {cpdCourses.map((course: any) => (
                    <div
                      key={course.course_id}
                      className="border border-emerald-200 rounded-xl p-5 bg-emerald-50/40"
                    >
                      <div className="font-bold text-gray-900">{course.course_title || course.title}</div>
                      <div className="text-sm text-emerald-800 mt-1">Type: CPD</div>
                      {course.enrolled_at && (
                        <div className="text-xs text-gray-500 mt-2">
                          Enrolled: {formatDate(course.enrolled_at)}
                        </div>
                      )}
                      {typeof course.progress === 'number' && (
                        <div className="text-sm text-gray-600 mt-2">Progress: {course.progress}%</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : qualificationCourses.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-5xl mb-4">📚</div>
                <p className="text-gray-500 text-lg">No qualification courses enrolled.</p>
              </div>
            ) : (
              <div className="p-6 space-y-8">
                {qualificationCourses.map((course: any) => (
                  <div key={course.course_id} className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="bg-gradient-to-r from-[#11CCEF]/10 to-[#E51791]/10 px-6 py-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-xl font-bold text-gray-900">{course.course_title}</h3>
                      <span className="text-sm text-gray-600">
                        {course.completed_units ?? 0} / {course.total_units ?? 0} units completed
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deadline</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assignment</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {(course.units || []).map((unit: any) => {
                            const result = unit.unit_result || unit.assignment_status;
                            const statusLabel = result === 'pass' ? 'Pass' : (result === 'refer' || result === 'fail') ? 'Refer' : '—';
                            const deadlineStr = unit.deadline ? formatDate(unit.deadline) : 'Not set';
                            const submissionUnlocked =
                              unit.assignment_submission_unlocked === 1 ||
                              unit.assignment_submission_unlocked === true;
                            return (
                              <tr key={unit.unit_id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-gray-900 font-medium">{unit.unit_title || `Unit ${unit.unit_id}`}</td>
                                <td className="px-4 py-3">
                                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                    result === 'pass' ? 'bg-green-100 text-green-800' :
                                    result === 'refer' ? 'bg-amber-100 text-amber-800' :
                                    'bg-gray-100 text-gray-600'
                                  }`}>
                                    {statusLabel}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-gray-600">{deadlineStr}</td>
                                <td className="px-4 py-3">
                                  {submissionUnlocked ? (
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="inline-flex items-center rounded-md border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] font-bold text-green-700">
                                        Unlocked
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleLockAssignment(unit.unit_id, course.course_id)}
                                        className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-700 hover:bg-red-100"
                                      >
                                        Lock
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleUnlockAssignment(unit.unit_id, course.course_id)}
                                      className="rounded-md border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-bold text-sky-700 hover:bg-sky-100"
                                    >
                                      Unlock submission
                                    </button>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => openDeadlineEdit(course.course_id, course.course_title, unit.unit_id, unit.unit_title || `Unit ${unit.unit_id}`, unit.deadline || null)}
                                    className="text-sm font-medium text-[#11CCEF] hover:text-[#0daed9]"
                                  >
                                    Update deadline
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Deadline edit modal */}
      {deadlineEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Update unit deadline</h3>
            <p className="text-sm text-gray-600 mb-4">{deadlineEdit.courseTitle} → {deadlineEdit.unitTitle}</p>
            <input
              type="datetime-local"
              value={deadlineValue}
              onChange={(e) => setDeadlineValue(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#11CCEF] focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-2">Leave empty to clear the deadline.</p>
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => { setDeadlineEdit(null); setDeadlineValue(''); }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDeadline}
                disabled={savingDeadline}
                className="px-4 py-2 bg-[#11CCEF] text-white rounded-lg hover:bg-[#0daed9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingDeadline ? 'Saving...' : 'Save deadline'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Reject Document</h3>
            <p className="text-sm text-gray-600 mb-4">
              Please provide a reason for rejecting this document. The student will see this message.
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter rejection reason..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E51791] focus:border-transparent resize-none"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setSelectedDocId(null);
                  setRejectionReason('');
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectDocument}
                disabled={!rejectionReason.trim() || loading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Rejecting...' : 'Reject Document'}
              </button>
            </div>
          </div>
        </div>
      )}

      {profile && (
        <SendMessageToStudentModal
          studentId={studentId}
          studentName={profile.name}
          open={showMessageModal}
          onClose={() => setShowMessageModal(false)}
          onSuccess={(ticketId) => router.push(`/dashboard/tickets/${ticketId}`)}
        />
      )}
    </div>
  );
};

export default StudentDetailPage;

