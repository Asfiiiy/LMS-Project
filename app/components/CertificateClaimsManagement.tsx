'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import { apiService } from '@/app/services/api';
import { showSweetAlert } from './SweetAlert';
import { showToast } from './Toast';
import dynamic from 'next/dynamic';

// Dynamically import the editor to avoid SSR issues
const CertificateEditor = dynamic(
  () => import('./CertificateEditor').then((mod) => ({ default: mod.default })),
  {
    ssr: false,
    loading: () => <div className="text-center py-4">Loading editor...</div>
  }
);

interface CertificateClaim {
  id: number;
  student_id: number;
  course_id: number;
  course_type: 'cpd' | 'qualification';
  full_name: string;
  phone_number: string | null;
  email: string;
  date_of_birth: string | null;
  postal_address: string | null;
  photo_id_url: string | null;
  cpd_course_level: string | null;
  certificate_name: string | null;
  selected_course_name: string | null;
  certificate_type: string | null;
  base_price: number | null;
  courier_type: string | null;
  courier_price: number | null;
  total_price: number | null;
  payment_required: boolean;
  payment_status: 'pending' | 'completed' | 'failed' | 'refunded';
  payment_amount: number | null;
  stripe_payment_intent_id: string | null;
  delivery_status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  tracking_number: string | null;
  estimated_delivery_date: string | null;
  admin_notes: string | null;
  student_name: string | null;
  student_email: string | null;
  course_title: string | null;
  processed_by_name: string | null;
  claimed_at: string;
  paid_at: string | null;
  processed_at: string | null;
  delivered_at: string | null;
}

interface Pricing {
  id: number;
  level_name: string;
  certificate_type: string;
  base_price: number;
  normal_courier_price: number;
  special_courier_price: number;
  is_active?: number | boolean;
}

const PRICING_LEVEL_ORDER = [
  'General',
  'Level 1',
  'Level 2',
  'Level 3',
  'Level 4',
  'Level 5',
  'Level 6',
  'Level 7'
];

const CERT_DELIVERY_ORDER = ['Hardcopy+PDF', 'Hardcopy', 'Softcopy'];

export default function CertificateClaimsManagement() {
  const [claims, setClaims] = useState<CertificateClaim[]>([]);
  const [pricing, setPricing] = useState<Pricing[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'claims' | 'pricing'>('claims');
  
  // Online editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorCertId, setEditorCertId] = useState<number | null>(null);
  const [editorType, setEditorType] = useState<'cert' | 'trans'>('cert');
  const [editorRegNumber, setEditorRegNumber] = useState('');
  const [editorIsDelivered, setEditorIsDelivered] = useState(false);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('completed');
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState('');
  const [courseTypeFilter, setCourseTypeFilter] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  
  // Edit claim state
  const [editingClaim, setEditingClaim] = useState<CertificateClaim | null>(null);
  const [editDeliveryStatus, setEditDeliveryStatus] = useState('');
  const [editTrackingNumber, setEditTrackingNumber] = useState('');
  const [editEstimatedDelivery, setEditEstimatedDelivery] = useState('');
  const [editAdminNotes, setEditAdminNotes] = useState('');
  const [updating, setUpdating] = useState(false);

  // Edit pricing state
  const [editingPricing, setEditingPricing] = useState<Pricing | null>(null);
  const [editBasePrice, setEditBasePrice] = useState('');
  const [editNormalCourier, setEditNormalCourier] = useState('');
  const [editSpecialCourier, setEditSpecialCourier] = useState('');
  const [editIsActive, setEditIsActive] = useState<0 | 1>(1);
  const [updatingPricing, setUpdatingPricing] = useState(false);

  const [showCreatePricing, setShowCreatePricing] = useState(false);
  const [newLevelName, setNewLevelName] = useState('General');
  const [newCertificateType, setNewCertificateType] = useState('Hardcopy+PDF');
  const [newBasePrice, setNewBasePrice] = useState('0');
  const [newNormalCourier, setNewNormalCourier] = useState('0');
  const [newSpecialCourier, setNewSpecialCourier] = useState('0');
  const [creatingPricing, setCreatingPricing] = useState(false);

  // Student profile modal state
  const [viewingStudent, setViewingStudent] = useState<number | null>(null);
  const [studentProfile, setStudentProfile] = useState<any>(null);
  const [studentOnboarding, setStudentOnboarding] = useState<any>(null);
  const [studentPayments, setStudentPayments] = useState<any[]>([]);
  const [progressCourses, setProgressCourses] = useState<any[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileTab, setProfileTab] = useState<'profile' | 'payments' | 'progress'>('profile');

  // Generated certificates state
  const [generatedCerts, setGeneratedCerts] = useState<Map<number, any>>(new Map());
  const [deliveringCert, setDeliveringCert] = useState<number | null>(null);
  const [uploadingDocx, setUploadingDocx] = useState<{ certId: number; type: 'cert' | 'trans' } | null>(null);
  const [reconvertingPdf, setReconvertingPdf] = useState<{ certId: number; type: 'cert' | 'trans' } | null>(null);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [paymentStatusFilter, deliveryStatusFilter, courseTypeFilter, searchTerm]);

  useEffect(() => {
    fetchClaims();
    if (activeView === 'pricing') {
      fetchPricing();
    }
  }, [activeView, paymentStatusFilter, deliveryStatusFilter, courseTypeFilter, searchTerm, currentPage]);

  const fetchClaims = async () => {
    try {
      setLoading(true);
      const filters: any = {};
      if (paymentStatusFilter) filters.payment_status = paymentStatusFilter;
      if (deliveryStatusFilter) filters.delivery_status = deliveryStatusFilter;
      if (courseTypeFilter) filters.course_type = courseTypeFilter;
      if (searchTerm) filters.search = searchTerm;
      filters.page = currentPage;
      filters.limit = pageLimit;

      const response = await apiService.getCertificateClaims(filters);
      if (response.success) {
        setClaims(response.claims);
        // Update pagination info
        if (response.pagination) {
          setTotalPages(response.pagination.totalPages || 1);
          setTotalItems(response.pagination.total || 0);
        }
        // Fetch generated certificates for these claims
        await fetchGeneratedCertsForClaims(response.claims);
      }
    } catch (error) {
      console.error('Error fetching claims:', error);
      showToast('Failed to fetch certificate claims', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchGeneratedCertsForClaims = async (claimsData: CertificateClaim[]) => {
    const certsMap = new Map();
    
    for (const claim of claimsData) {
      try {
        const response = await apiService.getGeneratedCertificateByClaim(claim.id);
        if (response.success && response.certificate) {
          certsMap.set(claim.id, response.certificate);
        }
      } catch (error) {
        // Silent fail - certificate might not be generated yet
        if (process.env.NODE_ENV === 'development') {
          console.log(`No generated cert for claim ${claim.id}`);
        }
      }
    }
    
    setGeneratedCerts(certsMap);
  };

  const fetchPricing = async () => {
    try {
      setLoading(true);
      const response = await apiService.getAllCertificatePricing();
      if (response.success) {
        setPricing(response.pricing);
      }
    } catch (error) {
      console.error('Error fetching pricing:', error);
      showToast('Failed to fetch pricing', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleViewCertificate = async (claimId: number, type: 'certificate' | 'transcript') => {
    const cert = generatedCerts.get(claimId);
    if (!cert) {
      showToast('Certificate not generated yet', 'warning');
      return;
    }
    
    // For delivered certificates, use public view URL
    if (cert.status === 'delivered') {
      const fileType = type === 'certificate' ? 'cert' : 'trans';
      const viewUrl = apiService.getViewCertificateURL(cert.registration_number, fileType);
      window.open(viewUrl, '_blank');
      return;
    }
    
    // For non-delivered certificates, check if file exists (PDF or DOCX)
    const hasPdf = type === 'certificate' ? cert.certificate_pdf_url : cert.transcript_pdf_url;
    const hasDocx = type === 'certificate' ? cert.certificate_docx_path : cert.transcript_docx_path;
    
    if (!hasPdf && !hasDocx) {
      showToast('Certificate file not available yet', 'warning');
      return;
    }
    
    // Get token from localStorage
    const token = localStorage.getItem('lms-token');
    
    if (!token) {
      showToast('Please log in again', 'error');
      return;
    }
    
    // Use the API endpoint to serve the file with token and view=true parameter
    // Get API URL dynamically (handles HTTPS in production)
    const { getApiUrl } = await import('@/app/utils/apiUrl');
    const apiUrl = getApiUrl();
    const fileUrl = `${apiUrl}/api/certificates/generated/${cert.id}/file/${type}?token=${encodeURIComponent(token)}&view=true`;
    window.open(fileUrl, '_blank');
  };

  const handleDownloadDOCX = async (claimId: number, type: 'certificate' | 'transcript') => {
    const cert = generatedCerts.get(claimId);
    if (!cert) {
      showToast('Certificate not generated yet', 'warning');
      return;
    }
    const fileType = type === 'certificate' ? 'cert' : 'trans';
    const reg = (cert.registration_number || 'cert').replace(/[^a-zA-Z0-9-]/g, '_');
    const suggestedName = type === 'certificate' ? `Certificate_${reg}.docx` : `Transcript_${reg}.docx`;
    try {
      await apiService.downloadCertificateDOCXFile(cert.id, fileType, suggestedName);
      showToast('Download started', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Download failed', 'error');
    }
  };

  const handleUploadEditedDOCX = async (claimId: number, type: 'certificate' | 'transcript') => {
    const cert = generatedCerts.get(claimId);
    if (!cert) {
      showToast('Certificate not generated yet', 'warning');
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.docx';
    const fileType = type === 'certificate' ? 'cert' : 'trans';

    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.name.endsWith('.docx')) {
        showToast('Please upload a .docx file', 'error');
        return;
      }

      try {
        setUploadingDocx({ certId: cert.id, type: fileType });
        const response = await apiService.uploadEditedDOCX(cert.id, fileType, file);

        if (response.success) {
          showToast('Edited DOCX uploaded. Reconvert to PDF (optional) then Deliver.', 'success');
          fetchClaims();
        } else {
          showToast(response.message || 'Upload failed', 'error');
        }
      } catch (error: any) {
        showToast(error.message || 'Error uploading file', 'error');
      } finally {
        setUploadingDocx(null);
      }
    };

    input.click();
  };

  const handleReconvertToPDF = async (claimId: number, type: 'certificate' | 'transcript') => {
    const cert = generatedCerts.get(claimId);
    if (!cert) {
      showToast('Certificate not generated yet', 'warning');
      return;
    }
    const fileType = type === 'certificate' ? 'cert' : 'trans';

    showSweetAlert(
      'Reconvert to PDF?',
      `This will convert the ${type} DOCX to PDF. Do this after uploading an edited DOCX so the student gets the updated file.`,
      'warning',
      {
        showCancelButton: true,
        confirmButtonText: 'Yes, Reconvert',
        onConfirm: async () => {
          try {
            setReconvertingPdf({ certId: cert.id, type: fileType });
            const response = await apiService.reconvertCertificateToPDF(cert.id, fileType);

            if (response.success) {
              showToast('PDF reconverted successfully!', 'success');
              fetchClaims();
            } else {
              showToast(response.message || 'Reconversion failed', 'error');
            }
          } catch (error: any) {
            showToast(error.message || 'Error reconverting to PDF', 'error');
          } finally {
            setReconvertingPdf(null);
          }
        }
      }
    );
  };

  const handleEditOnline = (claimId: number, type: 'certificate' | 'transcript') => {
    const cert = generatedCerts.get(claimId);
    if (!cert) {
      showToast('Certificate not generated yet', 'warning');
      return;
    }

    const fileType = type === 'certificate' ? 'cert' : 'trans';
    setEditorCertId(cert.id);
    setEditorType(fileType);
    setEditorRegNumber(cert.registration_number);
    setEditorIsDelivered(cert.status === 'delivered');
    setEditorOpen(true);
  };

  const handleEditorClose = () => {
    setEditorOpen(false);
    setEditorCertId(null);
  };

  const handleEditorSave = () => {
    fetchClaims(); // Refresh claims to show updated status
  };

  const handleDeliverCertificate = async (claimId: number) => {
    const cert = generatedCerts.get(claimId);
    if (!cert) {
      showToast('Certificate not found', 'error');
      return;
    }
    
    showSweetAlert(
      'Deliver Certificate?',
      `Upload PDFs to Cloudinary and make available to student (${cert.registration_number})?`,
      'warning',
      {
        showCancelButton: true,
        confirmButtonText: 'Yes, Deliver',
        onConfirm: async () => {
          try {
            setDeliveringCert(cert.id);
            const response = await apiService.deliverCertificate(cert.id);
            
            if (response.success) {
              showToast('Certificate delivered successfully!', 'success');
              fetchClaims();
            } else {
              showToast(response.message || 'Delivery failed', 'error');
            }
          } catch (error: any) {
            showToast(error.message || 'Error delivering certificate', 'error');
          } finally {
            setDeliveringCert(null);
          }
        }
      }
    );
  };

  const handleDeliverAll = async () => {
    const readyCerts = Array.from(generatedCerts.values()).filter(
      cert => cert.status === 'ready'
    );
    
    if (readyCerts.length === 0) {
      showToast('No certificates ready to deliver', 'warning');
      return;
    }
    
    showSweetAlert(
      `Deliver ${readyCerts.length} Certificate${readyCerts.length > 1 ? 's' : ''}?`,
      'This will upload all PDFs to Cloudinary and make them available to students',
      'warning',
      {
        showCancelButton: true,
        confirmButtonText: `Yes, Deliver All (${readyCerts.length})`,
        onConfirm: async () => {
          try {
            setDeliveringCert(-1); // Indicate bulk delivery
            const certIds = readyCerts.map(c => c.id);
            const response = await apiService.deliverMultipleCertificates(certIds);
            
            if (response.success) {
              showToast(`${response.delivered} certificate(s) delivered successfully!`, 'success');
              if (response.failed > 0) {
                showToast(`${response.failed} failed to deliver`, 'warning');
              }
              fetchClaims();
            }
          } catch (error: any) {
            showToast(error.message || 'Error delivering certificates', 'error');
          } finally {
            setDeliveringCert(null);
          }
        }
      }
    );
  };

  const handleEditClaim = (claim: CertificateClaim) => {
    setEditingClaim(claim);
    setEditDeliveryStatus(claim.delivery_status);
    setEditTrackingNumber(claim.tracking_number || '');
    setEditEstimatedDelivery(claim.estimated_delivery_date || '');
    setEditAdminNotes(claim.admin_notes || '');
  };

  const handleUpdateClaim = async () => {
    if (!editingClaim) return;

    setUpdating(true);
    try {
      const user = JSON.parse(localStorage.getItem('lms-user') || '{}');
      
      const updateData: any = {
        delivery_status: editDeliveryStatus,
        tracking_number: editTrackingNumber || null,
        estimated_delivery_date: editEstimatedDelivery || null,
        admin_notes: editAdminNotes || null,
        processedBy: user.id
      };

      const response = await apiService.updateCertificateClaimStatus(editingClaim.id, updateData);
      
      if (response.success) {
        showToast('Claim updated successfully', 'success');
        setEditingClaim(null);
        fetchClaims();
      }
    } catch (error: any) {
      console.error('Error updating claim:', error);
      showToast('error', error.message || 'Failed to update claim');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteClaim = async (claimId: number) => {
    showSweetAlert(
      'Delete Certificate Claim?',
      'This action cannot be undone. Are you sure?',
      'warning',
      {
        showCancelButton: true,
        confirmButtonText: 'Yes, Delete',
        onConfirm: async () => {
          try {
            await apiService.deleteCertificateClaim(claimId);
            showToast('Claim deleted successfully', 'success');
            fetchClaims();
          } catch (error: any) {
            console.error('Error deleting claim:', error);
            showToast('error', error.message || 'Failed to delete claim');
          }
        }
      }
    );
  };

  const handleViewStudent = async (studentId: number) => {
    setViewingStudent(studentId);
    setLoadingProfile(true);
    setProfileTab('profile');
    setStudentOnboarding(null);
    setProgressCourses([]);
    try {
      // Fetch profile, onboarding, payments, and qualification progress in parallel
      const [profileResponse, onboardingResponse, paymentsResponse, progressResponse] = await Promise.all([
        apiService.getStudentProfileById(studentId),
        apiService.getStudentOnboardingById(studentId).catch(() => ({ success: false, onboarding: null })),
        apiService.getStudentInstallmentsByAdmin(studentId),
        apiService.getStudentAcademicProgress(studentId).catch(() => ({ success: false, courses: [] }))
      ]);

      if (profileResponse?.success) {
        setStudentProfile(profileResponse.profile);
      } else {
        showToast('Failed to load student profile', 'error');
      }

      if (onboardingResponse?.success) {
        setStudentOnboarding(onboardingResponse.onboarding || null);
      }

      if (paymentsResponse?.success) {
        setStudentPayments(paymentsResponse.installments || []);
      }

      if (progressResponse?.success && Array.isArray(progressResponse.courses)) {
        setProgressCourses(progressResponse.courses);
      }
    } catch (error) {
      console.error('Error fetching student data:', error);
      showToast('Failed to load student data', 'error');
    } finally {
      setLoadingProfile(false);
    }
  };

  const groupedPricing = useMemo(() => {
    const acc: Record<string, Pricing[]> = {};
    for (const row of pricing) {
      const key = row.level_name;
      if (!acc[key]) acc[key] = [];
      acc[key].push(row);
    }
    for (const k of Object.keys(acc)) {
      acc[k].sort((a, b) => {
        const ia = CERT_DELIVERY_ORDER.indexOf(a.certificate_type);
        const ib = CERT_DELIVERY_ORDER.indexOf(b.certificate_type);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      });
    }
    return acc;
  }, [pricing]);

  const handleEditPricing = (price: Pricing) => {
    setEditingPricing(price);
    setEditBasePrice(price.base_price.toString());
    setEditNormalCourier(price.normal_courier_price.toString());
    setEditSpecialCourier(price.special_courier_price.toString());
    setEditIsActive(price.is_active === 0 || price.is_active === false ? 0 : 1);
  };

  const handleUpdatePricing = async () => {
    if (!editingPricing) return;

    setUpdatingPricing(true);
    try {
      const updateData = {
        base_price: parseFloat(editBasePrice),
        normal_courier_price: parseFloat(editNormalCourier),
        special_courier_price: parseFloat(editSpecialCourier),
        is_active: editIsActive
      };

      const response = await apiService.updateCertificatePricing(editingPricing.id, updateData);
      
      if (response.success) {
        showToast('Pricing updated successfully', 'success');
        setEditingPricing(null);
        fetchPricing();
      }
    } catch (error: any) {
      console.error('Error updating pricing:', error);
      showToast('error', error.message || 'Failed to update pricing');
    } finally {
      setUpdatingPricing(false);
    }
  };

  const handleCreatePricing = async () => {
    setCreatingPricing(true);
    try {
      const response = await apiService.createCertificatePricing({
        level_name: newLevelName,
        certificate_type: newCertificateType,
        base_price: parseFloat(newBasePrice) || 0,
        normal_courier_price: parseFloat(newNormalCourier) || 0,
        special_courier_price: parseFloat(newSpecialCourier) || 0
      });
      if (response.success) {
        showToast('Pricing row created', 'success');
        setShowCreatePricing(false);
        fetchPricing();
      }
    } catch (error: any) {
      console.error('Error creating pricing:', error);
      showToast('error', error.message || 'Failed to create pricing');
    } finally {
      setCreatingPricing(false);
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      refunded: 'bg-gray-100 text-gray-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getDeliveryStatusBadge = (status: string) => {
    const colors = {
      pending: 'bg-gray-100 text-gray-800',
      processing: 'bg-blue-100 text-blue-800',
      shipped: 'bg-purple-100 text-purple-800',
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const studentAssessment = studentOnboarding?.initialAssessment || null;
  const displayStudentName = studentAssessment?.full_name || studentProfile?.name;
  const displayStudentEmail = studentAssessment?.email || studentProfile?.email;
  const displayPrimaryLanguage = studentAssessment?.primary_language || null;
  const displayContactNumber = studentAssessment?.contact_number || null;
  const displayPostalAddress = studentAssessment?.postal_address || null;
  const displayMotivation = studentAssessment?.why_qualification || studentProfile?.motivation || null;
  const displayCareerGoals = studentAssessment?.career_goals || null;
  const displayCurrentEmployment = studentAssessment?.current_employment || null;
  const displayEmployerSupport = studentAssessment?.employer_support || null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Certificate Claims Management</h2>
          
          <div className="flex gap-2">
            <button
              onClick={() => setActiveView('claims')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeView === 'claims'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Claims
            </button>
            <button
              onClick={() => setActiveView('pricing')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeView === 'pricing'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Pricing
            </button>
          </div>
        </div>

        {/* Claims View */}
        {activeView === 'claims' && (
          <>
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <input
                type="text"
                placeholder="Search by name, email, or course..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              
              <select
                value={courseTypeFilter}
                onChange={(e) => setCourseTypeFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Course Types</option>
                <option value="cpd">CPD</option>
                <option value="qualification">Qualification</option>
              </select>

              <select
                value={paymentStatusFilter}
                onChange={(e) => setPaymentStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Payment Status</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>

              <select
                value={deliveryStatusFilter}
                onChange={(e) => setDeliveryStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Delivery Status</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
              </select>
            </div>

            {/* Deliver All Button */}
            {Array.from(generatedCerts.values()).filter(c => c.status === 'ready').length > 0 && (
              <div className="mb-4 flex justify-end">
                <button
                  onClick={handleDeliverAll}
                  disabled={deliveringCert !== null}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  📦 Deliver All ({Array.from(generatedCerts.values()).filter(c => c.status === 'ready').length})
                </button>
              </div>
            )}

            {/* Claims Table */}
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading claims...</p>
              </div>
            ) : claims.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-4">📜</div>
                <p className="text-gray-600">No certificate claims found</p>
              </div>
            ) : (
              <>
                {/* Workflow: Download → Edit in Word → Upload → Reconvert → Deliver */}
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-1">📄 Edit alignment in Word</h4>
                  <p className="text-sm text-blue-800">
                    <strong>Workflow:</strong> 📥 Download Cert/Trans DOCX → open in Word and fix alignment → 📤 Upload edited DOCX → 🔄 Reconvert to PDF (optional) → 📦 Deliver to student.
                  </p>
                </div>

                <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Course</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reg #</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Claimed At</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {claims.map((claim) => (
                      <tr key={claim.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">#{claim.id}</td>
                        <td className="px-4 py-3 text-sm">
                          <button
                            onClick={() => handleViewStudent(claim.student_id)}
                            className="text-left hover:bg-blue-50 rounded p-1 -m-1 transition-colors"
                          >
                            <div className="font-medium text-blue-600 hover:text-blue-800 cursor-pointer">
                              {claim.full_name}
                            </div>
                            <div className="text-gray-500">{claim.email}</div>
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">
                          {claim.course_title}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            claim.course_type === 'cpd' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                          }`}>
                            {claim.course_type.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {claim.course_type === 'qualification' ? (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              FREE
                            </span>
                          ) : (
                            <>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPaymentStatusBadge(claim.payment_status)}`}>
                                {claim.payment_status}
                              </span>
                              {claim.total_price && (
                                <div className="text-xs text-gray-500 mt-1">
                                  £{Number(claim.total_price).toFixed(2)}
                                </div>
                              )}
                            </>
                          )}
                        </td>
                        {/* Registration Number Column */}
                        <td className="px-4 py-3 text-sm">
                          {generatedCerts.has(claim.id) ? (
                            <span className="font-mono font-semibold text-purple-600">
                              {generatedCerts.get(claim.id).registration_number}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400 italic">Generating...</span>
                          )}
                        </td>

                        {/* Status Column */}
                        <td className="px-4 py-3 text-sm">
                          {generatedCerts.has(claim.id) ? (
                            generatedCerts.get(claim.id).status === 'delivered' ? (
                              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                                ✅ Delivered
                              </span>
                            ) : (
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">
                                📦 Ready
                              </span>
                            )
                          ) : (
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full font-medium">
                              ⏳ Processing
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-sm text-gray-500">
                          {new Date(claim.claimed_at).toLocaleDateString()}
                        </td>

                        {/* Actions Column - Enhanced */}
                        <td className="px-4 py-3 text-sm">
                          <div className="flex flex-wrap gap-1">
                            {generatedCerts.has(claim.id) && (
                              <>
                                {/* View Certificate Buttons */}
                                <button
                                  onClick={() => handleViewCertificate(claim.id, 'certificate')}
                                  className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 text-xs font-medium"
                                  title="View Certificate Online"
                                >
                                  👁️ Cert
                                </button>
                                <button
                                  onClick={() => handleViewCertificate(claim.id, 'transcript')}
                                  className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-xs font-medium"
                                  title="View Transcript Online"
                                >
                                  👁️ Trans
                                </button>
                                
                                {/* Edit Online Buttons */}
                                <button
                                  onClick={() => handleEditOnline(claim.id, 'certificate')}
                                  className="inline-flex items-center px-2 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 text-xs font-medium"
                                  title="Edit Certificate Online"
                                >
                                  ✏️ Edit Cert
                                </button>
                                <button
                                  onClick={() => handleEditOnline(claim.id, 'transcript')}
                                  className="inline-flex items-center px-2 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 text-xs font-medium"
                                  title="Edit Transcript Online"
                                >
                                  ✏️ Edit Trans
                                </button>
                                
                                {/* Download DOCX → Edit in Word → Upload → Reconvert → Deliver (only if not delivered) */}
                                {generatedCerts.get(claim.id).status !== 'delivered' && (
                                  <>
                                    <button
                                      onClick={() => handleDownloadDOCX(claim.id, 'certificate')}
                                      className="inline-flex items-center px-2 py-1 bg-orange-100 text-orange-700 rounded hover:bg-orange-200 text-xs font-medium"
                                      title="Download Certificate DOCX (edit alignment in Word)"
                                    >
                                      📥 Cert
                                    </button>
                                    <button
                                      onClick={() => handleDownloadDOCX(claim.id, 'transcript')}
                                      className="inline-flex items-center px-2 py-1 bg-orange-100 text-orange-700 rounded hover:bg-orange-200 text-xs font-medium"
                                      title="Download Transcript DOCX (edit alignment in Word)"
                                    >
                                      📥 Trans
                                    </button>
                                    <button
                                      onClick={() => handleUploadEditedDOCX(claim.id, 'certificate')}
                                      disabled={!!uploadingDocx}
                                      className="inline-flex items-center px-2 py-1 bg-amber-100 text-amber-800 rounded hover:bg-amber-200 text-xs font-medium disabled:opacity-50"
                                      title="Upload edited Certificate DOCX"
                                    >
                                      {uploadingDocx?.certId === generatedCerts.get(claim.id).id && uploadingDocx?.type === 'cert' ? '⏳' : '📤'} Cert
                                    </button>
                                    <button
                                      onClick={() => handleUploadEditedDOCX(claim.id, 'transcript')}
                                      disabled={!!uploadingDocx}
                                      className="inline-flex items-center px-2 py-1 bg-amber-100 text-amber-800 rounded hover:bg-amber-200 text-xs font-medium disabled:opacity-50"
                                      title="Upload edited Transcript DOCX"
                                    >
                                      {uploadingDocx?.certId === generatedCerts.get(claim.id).id && uploadingDocx?.type === 'trans' ? '⏳' : '📤'} Trans
                                    </button>
                                    <button
                                      onClick={() => handleReconvertToPDF(claim.id, 'certificate')}
                                      disabled={!!reconvertingPdf}
                                      className="inline-flex items-center px-2 py-1 bg-slate-100 text-slate-700 rounded hover:bg-slate-200 text-xs font-medium disabled:opacity-50"
                                      title="Reconvert Certificate DOCX to PDF (do after upload)"
                                    >
                                      {reconvertingPdf?.certId === generatedCerts.get(claim.id).id && reconvertingPdf?.type === 'cert' ? '⏳' : '🔄'} PDF Cert
                                    </button>
                                    <button
                                      onClick={() => handleReconvertToPDF(claim.id, 'transcript')}
                                      disabled={!!reconvertingPdf}
                                      className="inline-flex items-center px-2 py-1 bg-slate-100 text-slate-700 rounded hover:bg-slate-200 text-xs font-medium disabled:opacity-50"
                                      title="Reconvert Transcript DOCX to PDF (do after upload)"
                                    >
                                      {reconvertingPdf?.certId === generatedCerts.get(claim.id).id && reconvertingPdf?.type === 'trans' ? '⏳' : '🔄'} PDF Trans
                                    </button>
                                  </>
                                )}

                                {/* Deliver Button */}
                                {generatedCerts.get(claim.id).status === 'ready' && (
                                  <button
                                    onClick={() => handleDeliverCertificate(claim.id)}
                                    disabled={deliveringCert === generatedCerts.get(claim.id).id}
                                    className="inline-flex items-center px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 text-xs font-medium disabled:opacity-50"
                                    title="Deliver to Student"
                                  >
                                    {deliveringCert === generatedCerts.get(claim.id).id ? '⏳' : '📦 Deliver'}
                                  </button>
                                )}
                              </>
                            )}
                            <button
                              onClick={() => handleEditClaim(claim)}
                              className="text-blue-600 hover:text-blue-800 text-xs font-medium px-2 py-1"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteClaim(claim.id)}
                              className="text-red-600 hover:text-red-800 text-xs font-medium px-2 py-1"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            )}

            {/* Pagination Controls */}
            {!loading && claims.length > 0 && totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between flex-wrap gap-4">
                <div className="text-sm text-gray-600">
                  Showing {((currentPage - 1) * pageLimit) + 1} to {Math.min(currentPage * pageLimit, totalItems)} of {totalItems} claims
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className={`px-4 py-2 rounded-lg border border-gray-300 ${
                      currentPage === 1
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Previous
                  </button>
                  <div className="flex gap-1">
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
                          className={`px-4 py-2 rounded-lg border ${
                            currentPage === pageNum
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className={`px-4 py-2 rounded-lg border border-gray-300 ${
                      currentPage === totalPages
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Pricing View */}
        {activeView === 'pricing' && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div
                style={{
                  background: '#f0fbff',
                  border: '1px solid #bae6fd',
                  borderRadius: '12px',
                  padding: '14px 18px',
                  fontSize: '13px',
                  color: '#0369a1',
                  flex: '1 1 320px'
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: '6px' }}>How pricing works</div>
                <div>
                  • <strong>General</strong> = Certificate (All Levels)
                  <br />
                  • <strong>Level 1–7</strong> = specific level certificates
                  <br />
                  • Student pays: base price + one courier price (hardcopy types only)
                  <br />
                  • Softcopy has no courier charge
                  <br />• Set prices to £0.00 for free certificates
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreatePricing(true)}
                className="px-4 py-2 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700"
              >
                Add pricing row
              </button>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading pricing...</p>
              </div>
            ) : pricing.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-4">💰</div>
                <p className="text-gray-600">No pricing data found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Level</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Delivery type
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Base price (£)
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Normal courier (£)
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Special courier (£)
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Active</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {PRICING_LEVEL_ORDER.filter((lvl) => groupedPricing[lvl]?.length).map((levelName) => (
                      <Fragment key={levelName}>
                        <tr className="bg-gray-100">
                          <td
                            colSpan={7}
                            className="px-4 py-2 text-sm font-bold text-gray-800"
                          >
                            {levelName === 'General'
                              ? 'General (Certificate — All Levels)'
                              : levelName}
                          </td>
                        </tr>
                        {groupedPricing[levelName].map((price) => (
                          <tr key={price.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-400"> </td>
                            <td className="px-4 py-3 text-sm text-gray-900">{price.certificate_type}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              £{Number(price.base_price).toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              £{Number(price.normal_courier_price).toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              £{Number(price.special_courier_price).toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {price.is_active === 0 || price.is_active === false ? (
                                <span
                                  style={{
                                    background: '#fef2f2',
                                    color: '#dc2626',
                                    border: '1px solid #fecaca',
                                    borderRadius: '6px',
                                    padding: '2px 8px',
                                    fontSize: '11px',
                                    fontWeight: 700
                                  }}
                                >
                                  Inactive
                                </span>
                              ) : (
                                <span
                                  style={{
                                    background: '#f0fdf4',
                                    color: '#16a34a',
                                    border: '1px solid #bbf7d0',
                                    borderRadius: '6px',
                                    padding: '2px 8px',
                                    fontSize: '11px',
                                    fontWeight: 700
                                  }}
                                >
                                  Active
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <button
                                type="button"
                                onClick={() => handleEditPricing(price)}
                                className="text-blue-600 hover:text-blue-800 font-medium"
                              >
                                Edit
                              </button>
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                    {pricing.some((p) => !PRICING_LEVEL_ORDER.includes(p.level_name)) && (
                      <Fragment key="other-levels">
                        <tr className="bg-gray-100">
                          <td colSpan={7} className="px-4 py-2 text-sm font-bold text-gray-800">
                            Other levels
                          </td>
                        </tr>
                        {pricing
                          .filter((p) => !PRICING_LEVEL_ORDER.includes(p.level_name))
                          .map((price) => (
                            <tr key={price.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-900">{price.level_name}</td>
                              <td className="px-4 py-3 text-sm text-gray-900">{price.certificate_type}</td>
                              <td className="px-4 py-3 text-sm text-gray-900">
                                £{Number(price.base_price).toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900">
                                £{Number(price.normal_courier_price).toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900">
                                £{Number(price.special_courier_price).toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                {price.is_active === 0 || price.is_active === false ? (
                                  <span
                                    style={{
                                      background: '#fef2f2',
                                      color: '#dc2626',
                                      border: '1px solid #fecaca',
                                      borderRadius: '6px',
                                      padding: '2px 8px',
                                      fontSize: '11px',
                                      fontWeight: 700
                                    }}
                                  >
                                    Inactive
                                  </span>
                                ) : (
                                  <span
                                    style={{
                                      background: '#f0fdf4',
                                      color: '#16a34a',
                                      border: '1px solid #bbf7d0',
                                      borderRadius: '6px',
                                      padding: '2px 8px',
                                      fontSize: '11px',
                                      fontWeight: 700
                                    }}
                                  >
                                    Active
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <button
                                  type="button"
                                  onClick={() => handleEditPricing(price)}
                                  className="text-blue-600 hover:text-blue-800 font-medium"
                                >
                                  Edit
                                </button>
                              </td>
                            </tr>
                          ))}
                      </Fragment>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Edit Claim Modal */}
      {editingClaim && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                Edit Claim #{editingClaim.id}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Delivery Status
                  </label>
                  <select
                    value={editDeliveryStatus}
                    onChange={(e) => setEditDeliveryStatus(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="pending">Pending</option>
                    <option value="processing">Processing</option>
                    <option value="shipped">Shipped</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tracking Number
                  </label>
                  <input
                    type="text"
                    value={editTrackingNumber}
                    onChange={(e) => setEditTrackingNumber(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter tracking number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estimated Delivery Date
                  </label>
                  <input
                    type="date"
                    value={editEstimatedDelivery}
                    onChange={(e) => setEditEstimatedDelivery(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Admin Notes
                  </label>
                  <textarea
                    value={editAdminNotes}
                    onChange={(e) => setEditAdminNotes(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Add notes (visible to admins only)"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setEditingClaim(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateClaim}
                  disabled={updating}
                  className={`flex-1 px-4 py-2 rounded-lg text-white ${
                    updating ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {updating ? 'Updating...' : 'Update Claim'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Pricing Modal */}
      {editingPricing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                Edit Pricing - {editingPricing.level_name === 'General' ? 'Certificate' : editingPricing.level_name} ({editingPricing.certificate_type})
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Base Price (£)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editBasePrice}
                    onChange={(e) => setEditBasePrice(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Normal Courier Price (£)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editNormalCourier}
                    onChange={(e) => setEditNormalCourier(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Special Courier Price (£)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editSpecialCourier}
                    onChange={(e) => setEditSpecialCourier(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#374151',
                      display: 'block',
                      marginBottom: '8px'
                    }}
                  >
                    Status
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setEditIsActive(1)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        border: '2px solid',
                        borderColor: editIsActive === 1 ? '#22c55e' : '#e2e8f0',
                        background: editIsActive === 1 ? '#f0fdf4' : '#fff',
                        color: editIsActive === 1 ? '#16a34a' : '#64748b',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Active
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditIsActive(0)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        border: '2px solid',
                        borderColor: editIsActive === 0 ? '#dc2626' : '#e2e8f0',
                        background: editIsActive === 0 ? '#fef2f2' : '#fff',
                        color: editIsActive === 0 ? '#dc2626' : '#64748b',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Inactive
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setEditingPricing(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdatePricing}
                  disabled={updatingPricing}
                  className={`flex-1 px-4 py-2 rounded-lg text-white ${
                    updatingPricing ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {updatingPricing ? 'Updating...' : 'Update Pricing'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreatePricing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Add pricing row</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Level</label>
                  <select
                    value={newLevelName}
                    onChange={(e) => setNewLevelName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {PRICING_LEVEL_ORDER.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl === 'General' ? 'General (Certificate — All Levels)' : lvl}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Delivery type</label>
                  <select
                    value={newCertificateType}
                    onChange={(e) => setNewCertificateType(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {CERT_DELIVERY_ORDER.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Base price (£)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newBasePrice}
                    onChange={(e) => setNewBasePrice(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Normal courier (£)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newNormalCourier}
                    onChange={(e) => setNewNormalCourier(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Special courier (£)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newSpecialCourier}
                    onChange={(e) => setNewSpecialCourier(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreatePricing(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreatePricing}
                  disabled={creatingPricing}
                  className={`flex-1 px-4 py-2 rounded-lg text-white ${
                    creatingPricing ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {creatingPricing ? 'Creating…' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Student Profile Modal */}
      {viewingStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-50 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            {loadingProfile ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#11CCEF] mx-auto mb-4"></div>
                <p className="text-gray-600">Loading student data...</p>
              </div>
            ) : studentProfile ? (
              <div className="space-y-6 p-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-r from-[#11CCEF] to-[#E51791] flex items-center justify-center text-white text-2xl font-bold">
                      {displayStudentName?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h1 className="text-3xl font-bold text-gray-900">{displayStudentName}</h1>
                      <p className="text-gray-600">{displayStudentEmail}</p>
                      {studentProfile.learner_id && (
                        <p className="text-sm font-semibold text-[#11CCEF] mt-1">Learner ID: {studentProfile.learner_id}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setViewingStudent(null);
                      setStudentProfile(null);
                      setStudentOnboarding(null);
                      setStudentPayments([]);
                      setProgressCourses([]);
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    ← Back
                  </button>
                </div>

                {/* Tabs */}
                <div className="bg-white rounded-xl shadow-lg">
                  <div className="border-b border-gray-200">
                    <nav className="flex -mb-px">
                      <button
                        onClick={() => setProfileTab('profile')}
                        className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                          profileTab === 'profile'
                            ? 'border-[#11CCEF] text-[#11CCEF]'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        Profile
                      </button>
                      <button
                        onClick={() => setProfileTab('payments')}
                        className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                          profileTab === 'payments'
                            ? 'border-[#11CCEF] text-[#11CCEF]'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        Payments ({studentPayments.length})
                      </button>
                      <button
                        onClick={() => setProfileTab('progress')}
                        className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                          profileTab === 'progress'
                            ? 'border-[#11CCEF] text-[#11CCEF]'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        Qualification progress
                      </button>
                    </nav>
                  </div>
                </div>

                {/* Profile Tab Content - matches upgraded Students Profile (onboarding + profile) */}
                {profileTab === 'profile' && (
                  <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
                    {(() => {
                      const ia = studentOnboarding?.initialAssessment || {};
                      const p = studentProfile || {};
                      const fmtDate = (d: string | null | undefined) =>
                        d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : null;
                      return (
                        <>
                          {/* Personal Information */}
                          <div className="bg-white rounded-2xl shadow border-2 border-[#11CCEF]/20 overflow-hidden">
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
                                <div className="rounded-xl p-4 border border-[#11CCEF]/10 bg-[#11CCEF]/5">
                                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Full Name</label>
                                  <p className="text-gray-900 font-medium mt-1">{ia.full_name || p.name || 'Not provided'}</p>
                                </div>
                                <div className="rounded-xl p-4 border border-[#11CCEF]/10 bg-[#11CCEF]/5">
                                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Learner ID</label>
                                  <p className="text-gray-900 font-medium mt-1">{p.learner_id || 'Not provided'}</p>
                                </div>
                                <div className="rounded-xl p-4 border border-[#11CCEF]/10 bg-[#11CCEF]/5">
                                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact Number</label>
                                  <p className="text-gray-900 font-medium mt-1">{ia.contact_number || 'Not provided'}</p>
                                </div>
                                <div className="rounded-xl p-4 border border-[#11CCEF]/10 bg-[#11CCEF]/5">
                                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Primary Language</label>
                                  <p className="text-gray-900 font-medium mt-1">{ia.primary_language || 'Not provided'}</p>
                                </div>
                                <div className="rounded-xl p-4 border border-[#11CCEF]/10 bg-[#11CCEF]/5">
                                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Gender</label>
                                  <p className="text-gray-900 font-medium mt-1">{ia.gender || p.gender || 'Not provided'}</p>
                                </div>
                                <div className="rounded-xl p-4 border border-[#11CCEF]/10 bg-[#11CCEF]/5">
                                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Date of Birth</label>
                                  <p className="text-gray-900 font-medium mt-1">{fmtDate(ia.date_of_birth || p.date_of_birth) || 'Not provided'}</p>
                                </div>
                                <div className="rounded-xl p-4 border border-[#11CCEF]/10 bg-[#11CCEF]/5">
                                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Nationality</label>
                                  <p className="text-gray-900 font-medium mt-1">{ia.nationality || p.nationality || 'Not provided'}</p>
                                </div>
                                <div className="rounded-xl p-4 border border-[#11CCEF]/10 bg-[#11CCEF]/5">
                                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Ethnicity</label>
                                  <p className="text-gray-900 font-medium mt-1">{ia.ethnicity || p.ethnicity || 'Not provided'}</p>
                                </div>
                                <div className="rounded-xl p-4 border border-[#11CCEF]/10 bg-[#11CCEF]/5 md:col-span-2">
                                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Postal Address</label>
                                  <p className="text-gray-900 font-medium mt-1 whitespace-pre-wrap">{ia.postal_address || 'Not provided'}</p>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Motivation & Background */}
                          <div className="bg-white rounded-2xl shadow border-2 border-[#11CCEF]/20 overflow-hidden">
                            <div className="bg-gradient-to-r from-[#11CCEF]/10 to-[#E51791]/10 px-6 py-4 border-b-2 border-[#11CCEF]/20 flex items-center gap-3">
                              <div className="bg-gradient-to-br from-[#11CCEF] to-[#E51791] p-2 rounded-lg">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                </svg>
                              </div>
                              <h3 className="text-xl font-bold text-gray-900">Motivation & Background</h3>
                            </div>
                            <div className="p-6 space-y-5">
                              <div className="rounded-xl p-5 border border-[#11CCEF]/10 bg-[#11CCEF]/5">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Why This Qualification?</label>
                                <p className="text-gray-900 mt-2 italic border-l-4 border-[#11CCEF] pl-4 whitespace-pre-wrap">
                                  {ia.why_qualification || p.motivation || 'Not provided'}
                                </p>
                              </div>
                              <div className="rounded-xl p-5 border border-[#11CCEF]/10 bg-[#11CCEF]/5">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Career Goals</label>
                                <p className="text-gray-900 mt-2 italic border-l-4 border-[#E51791] pl-4 whitespace-pre-wrap">
                                  {ia.career_goals || 'Not provided'}
                                </p>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="rounded-xl p-4 border border-[#11CCEF]/10 bg-[#11CCEF]/5">
                                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Current Employment</label>
                                  <p className="text-gray-900 font-medium mt-1">{ia.current_employment || 'Not provided'}</p>
                                </div>
                                <div className="rounded-xl p-4 border border-[#11CCEF]/10 bg-[#11CCEF]/5">
                                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Highest Qualification</label>
                                  <p className="text-gray-900 font-medium mt-1">{ia.highest_qualification || p.previous_qualification || 'Not provided'}</p>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Skills & Learning Needs */}
                          <div className="bg-white rounded-2xl shadow border-2 border-[#11CCEF]/20 overflow-hidden">
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
                                <div className="rounded-xl p-5 border-2 border-[#11CCEF]/20 bg-[#11CCEF]/5">
                                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">English & Literacy</label>
                                  <p className="text-lg font-bold text-[#11CCEF] mt-1">{ia.english_literacy || p.english_literacy || 'Not provided'}</p>
                                </div>
                                <div className="rounded-xl p-5 border-2 border-[#E51791]/20 bg-[#E51791]/5">
                                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">ICT Skills</label>
                                  <p className="text-lg font-bold text-[#E51791] mt-1">{ia.ict_skills || p.ict_skills || 'Not provided'}</p>
                                </div>
                                <div className="rounded-xl p-5 border-2 border-[#61CE70]/20 bg-[#61CE70]/5">
                                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Maths Skills</label>
                                  <p className="text-lg font-bold text-[#61CE70] mt-1">{ia.maths_skills || 'Not provided'}</p>
                                </div>
                              </div>
                              <div className="rounded-xl p-5 border border-[#11CCEF]/10 bg-[#11CCEF]/5">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Special Learning Needs / Disabilities</label>
                                <p className="text-gray-900 mt-2 whitespace-pre-wrap">
                                  {ia.special_learning_needs || p.special_learning_needs || 'None identified'}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Learning Style (VARK) */}
                          <div className="bg-white rounded-2xl shadow border-2 border-[#11CCEF]/20 overflow-hidden">
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
                                  { label: 'Visual', value: p.vark_visual || 0 },
                                  { label: 'Auditory', value: p.vark_auditory || 0 },
                                  { label: 'Reading', value: p.vark_reading || 0 },
                                  { label: 'Kinesthetic', value: p.vark_kinesthetic || 0 }
                                ].map((score) => (
                                  <div key={score.label} className="text-center p-4 bg-gray-50 rounded-lg">
                                    <div className="text-sm font-medium text-gray-500 mb-2">{score.label}</div>
                                    <div className="text-2xl font-bold text-[#11CCEF]">{score.value}</div>
                                    <div className="mt-2 bg-gray-200 rounded-full h-2">
                                      <div
                                        className="bg-[#11CCEF] h-2 rounded-full"
                                        style={{ width: `${(score.value / 20) * 100}%` }}
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Profile Status */}
                          <div className="pt-4 border-t border-gray-200">
                            <div className="flex items-center justify-between">
                              <div>
                                <label className="text-sm font-medium text-gray-500">Profile Status</label>
                                <p className="text-gray-900 mt-1">
                                  <span
                                    className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                      p.is_profile_complete === 1 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                    }`}
                                  >
                                    {p.is_profile_complete === 1 ? 'Complete' : 'Incomplete'}
                                  </span>
                                </p>
                              </div>
                              {p.profile_completed_at && (
                                <div>
                                  <label className="text-sm font-medium text-gray-500">Completed At</label>
                                  <p className="text-gray-900 mt-1">
                                    {new Date(p.profile_completed_at).toLocaleDateString('en-GB', {
                                      day: 'numeric',
                                      month: 'long',
                                      year: 'numeric'
                                    })}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* Payments Tab Content */}
                {profileTab === 'payments' && (
                  <div className="bg-white rounded-xl shadow-lg p-6">
                    {studentPayments.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="text-4xl mb-4">💳</div>
                        <p className="text-gray-500 text-lg">No payment installments found for this student.</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {Object.values(
                          studentPayments.reduce((acc: any, payment: any) => {
                            if (!acc[payment.course_id]) {
                              acc[payment.course_id] = {
                                course_id: payment.course_id,
                                course_title: payment.course_title,
                                payments: []
                              };
                            }
                            acc[payment.course_id].payments.push(payment);
                            return acc;
                          }, {})
                        ).map((courseGroup: any) => (
                          <div key={courseGroup.course_id} className="border border-gray-200 rounded-lg p-6">
                            <h3 className="text-xl font-bold text-gray-900 mb-4">{courseGroup.course_title}</h3>
                            <div className="overflow-x-auto">
                              <table className="w-full">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">No.</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Installment</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paid At</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {courseGroup.payments.map((payment: any) => (
                                    <tr key={payment.id}>
                                      <td className="px-4 py-3 text-sm text-gray-900">{payment.installment_number}</td>
                                      <td className="px-4 py-3 text-sm text-gray-900">{payment.installment_name}</td>
                                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                        £{Number(payment.amount).toFixed(2)}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-gray-500">
                                        {payment.due_date
                                          ? new Date(payment.due_date).toLocaleDateString('en-GB')
                                          : 'Not set'}
                                      </td>
                                      <td className="px-4 py-3">
                                        <span
                                          className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                            payment.status === 'paid'
                                              ? 'bg-green-100 text-green-800'
                                              : payment.status === 'overdue'
                                              ? 'bg-red-100 text-red-800'
                                              : 'bg-yellow-100 text-yellow-800'
                                          }`}
                                        >
                                          {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 text-sm text-gray-500">
                                        {payment.paid_at
                                          ? new Date(payment.paid_at).toLocaleDateString('en-GB')
                                          : '-'}
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

                {/* Qualification Progress Tab: course units with Locked | In progress | Submitted for grading | Pass | Refer */}
                {profileTab === 'progress' && (
                  <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
                    <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                      Qualification progress – course units
                    </h3>
                    {progressCourses.length === 0 ? (
                      <div className="py-8 text-center text-gray-500">
                        No qualification courses with progress yet. Units and status (Locked, In progress, Submitted for grading, Pass, Refer) will appear when the student is enrolled in qualification courses and has activity.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {progressCourses.map((course: any) => {
                          const units = course.units || [];
                          return (
                            <div key={course.course_id} className="border border-gray-200 rounded-lg overflow-hidden">
                              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-wrap gap-2">
                                <h4 className="font-semibold text-gray-900">{course.course_title}</h4>
                                <span className="text-sm text-gray-600">
                                  {course.completed_units ?? 0} / {course.total_units ?? units.length} units
                                </span>
                              </div>
                              <ul className="divide-y divide-gray-100">
                                {units.map((unit: any) => {
                                  const status = unit.unit_status || (unit.pass_fail_result?.toLowerCase() === 'refer' ? 'refer' : unit.pass_fail_result?.toLowerCase() === 'pass' || unit.is_completed ? 'pass' : 'locked');
                                  const statusBadge =
                                    status === 'pass' ? (
                                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 whitespace-nowrap">Pass</span>
                                    ) : status === 'refer' ? (
                                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 whitespace-nowrap">Refer</span>
                                    ) : status === 'submitted_for_grading' ? (
                                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 whitespace-nowrap">Submitted for grading</span>
                                    ) : status === 'in_progress' ? (
                                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 whitespace-nowrap">In progress</span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 whitespace-nowrap">Locked</span>
                                    );
                                  return (
                                    <li key={unit.unit_id} className="px-4 py-3 flex items-center justify-between gap-4">
                                      <span className="text-sm font-medium text-gray-900 truncate">{unit.unit_title}</span>
                                      {statusBadge}
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-600">No profile data available</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Online Certificate Editor Modal */}
      {editorOpen && editorCertId && (
        <CertificateEditor
          certificateId={editorCertId}
          type={editorType}
          registrationNumber={editorRegNumber}
          isDelivered={editorIsDelivered}
          onClose={handleEditorClose}
          onSave={handleEditorSave}
        />
      )}
    </div>
  );
}

