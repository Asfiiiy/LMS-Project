'use client';

import { useState, useEffect } from 'react';
import { apiService } from '@/app/services/api';
import { showSweetAlert } from './SweetAlert';
import { showToast } from './Toast';

interface GeneratedCertificate {
  id: number;
  claim_id: number;
  student_id: number;
  course_id: number;
  course_type: 'cpd' | 'qualification';
  certificate_docx_path: string | null;
  transcript_docx_path: string | null;
  certificate_pdf_url: string | null;
  transcript_pdf_url: string | null;
  registration_number: string | null;
  registration_added_at: string | null;
  registration_added_by: number | null;
  generated_at: string;
  delivered_at: string | null;
  delivered_by: number | null;
  status: 'generated' | 'pending_registration' | 'ready' | 'delivered' | 'failed';
  error_message: string | null;
  student_name: string;
  student_email: string;
  course_title: string;
  certificate_type: string | null;
  cpd_course_level: string | null;
  registration_added_by_name: string | null;
  delivered_by_name: string | null;
}

const GeneratedCertificatesManagement = () => {
  const [certificates, setCertificates] = useState<GeneratedCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showRegModal, setShowRegModal] = useState(false);
  const [selectedCert, setSelectedCert] = useState<GeneratedCertificate | null>(null);
  const [regNumber, setRegNumber] = useState('');
  const [loadingAction, setLoadingAction] = useState(false);

  useEffect(() => {
    fetchCertificates();
  }, [statusFilter, searchTerm]);

  const fetchCertificates = async () => {
    try {
      setLoading(true);
      const filters: any = {};
      if (statusFilter) filters.status = statusFilter;
      if (searchTerm) filters.search = searchTerm;

      const response = await apiService.getGeneratedCertificates(filters);
      if (response.success) {
        setCertificates(response.certificates);
      } else {
        showToast('Failed to load certificates', 'error');
      }
    } catch (error: any) {
      console.error('Error fetching certificates:', error);
      showToast(error.message || 'Error loading certificates', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGetNextRegNumber = async () => {
    try {
      const response = await apiService.getNextRegistrationNumber();
      if (response.success) {
        setRegNumber(response.registration_number);
      }
    } catch (error: any) {
      console.error('Error getting registration number:', error);
      showToast('Failed to get registration number', 'error');
    }
  };

  const handleAddRegistration = async () => {
    if (!selectedCert || !regNumber.trim()) {
      showToast('Please enter registration number', 'error');
      return;
    }

    try {
      setLoadingAction(true);
      const response = await apiService.addRegistrationNumber(selectedCert.id, regNumber);
      
      if (response.success) {
        showToast('Registration number added & PDFs generated!', 'success');
        setShowRegModal(false);
        setRegNumber('');
        setSelectedCert(null);
        fetchCertificates();
      } else {
        showToast(response.message || 'Failed to add registration number', 'error');
      }
    } catch (error: any) {
      console.error('Error adding registration number:', error);
      showToast(error.message || 'Error adding registration', 'error');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleDeliverCertificate = async (cert: GeneratedCertificate) => {
    showSweetAlert(
      'Deliver Certificate?',
      `This will upload the PDFs to Cloudinary and make them available to ${cert.student_name}. Continue?`,
      'warning',
      {
        showCancelButton: true,
        confirmButtonText: 'Yes, Deliver',
        cancelButtonText: 'Cancel',
        onConfirm: async () => {
          try {
            setLoadingAction(true);
            const response = await apiService.deliverCertificate(cert.id);
            
            if (response.success) {
              showToast('Certificate delivered successfully!', 'success');
              fetchCertificates();
            } else {
              showToast(response.message || 'Failed to deliver', 'error');
            }
          } catch (error: any) {
            console.error('Error delivering certificate:', error);
            showToast(error.message || 'Error delivering certificate', 'error');
          } finally {
            setLoadingAction(false);
          }
        }
      }
    );
  };

  const openRegModal = (cert: GeneratedCertificate) => {
    setSelectedCert(cert);
    setRegNumber(cert.registration_number || '');
    setShowRegModal(true);
    if (!cert.registration_number) {
      handleGetNextRegNumber();
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      generated: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: '⏳ Waiting Reg #' },
      pending_registration: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: '⏳ Waiting Reg #' },
      ready: { bg: 'bg-blue-100', text: 'text-blue-800', label: '✅ Ready to Deliver' },
      delivered: { bg: 'bg-green-100', text: 'text-green-800', label: '📦 Delivered' },
      failed: { bg: 'bg-red-100', text: 'text-red-800', label: '❌ Failed' },
    };

    const badge = badges[status] || badges.generated;
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  const filteredCertificates = certificates;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">🎓 Generated Certificates</h2>
            <p className="mt-1 text-purple-100">
              Manage auto-generated certificates, add registration numbers, and deliver to students
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{certificates.length}</div>
            <div className="text-sm text-purple-200">Total Generated</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">All Statuses</option>
              <option value="generated">Waiting Registration</option>
              <option value="pending_registration">Pending Registration</option>
              <option value="ready">Ready to Deliver</option>
              <option value="delivered">Delivered</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search
            </label>
            <input
              type="text"
              placeholder="Search by student name, email, or course..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Certificates Table */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading certificates...</p>
        </div>
      ) : filteredCertificates.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-6xl mb-4">📜</div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">
            No Generated Certificates Yet
          </h3>
          <p className="text-gray-600">
            Certificates will appear here automatically after students complete payment
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Course
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Registration #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Generated
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCertificates.map((cert) => (
                  <tr key={cert.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{cert.student_name}</div>
                        <div className="text-sm text-gray-500">{cert.student_email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{cert.course_title}</div>
                      <div className="text-xs text-gray-500">
                        {cert.cpd_course_level} • {cert.certificate_type}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {cert.registration_number ? (
                        <div>
                          <div className="text-sm font-mono font-semibold text-purple-600">
                            {cert.registration_number}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(cert.registration_added_at!).toLocaleDateString()}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400 italic">Not assigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(cert.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(cert.generated_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      {(cert.status === 'generated' || cert.status === 'pending_registration') && (
                        <button
                          onClick={() => openRegModal(cert)}
                          className="inline-flex items-center px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                        >
                          🔢 Add Reg #
                        </button>
                      )}
                      {cert.status === 'ready' && (
                        <>
                          <button
                            onClick={() => openRegModal(cert)}
                            className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            ✏️ Edit Reg #
                          </button>
                          <button
                            onClick={() => handleDeliverCertificate(cert)}
                            disabled={loadingAction}
                            className="inline-flex items-center px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400"
                          >
                            📦 Deliver
                          </button>
                        </>
                      )}
                      {cert.status === 'delivered' && (
                        <a
                          href={cert.certificate_pdf_url || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-3 py-1.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                        >
                          👁️ View
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Registration Number Modal */}
      {showRegModal && selectedCert && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {selectedCert.registration_number ? 'Edit' : 'Add'} Registration Number
              </h3>
              <button
                onClick={() => {
                  setShowRegModal(false);
                  setRegNumber('');
                  setSelectedCert(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">Student:</div>
              <div className="font-medium">{selectedCert.student_name}</div>
              <div className="text-sm text-gray-600 mt-2">Course:</div>
              <div className="font-medium">{selectedCert.course_title}</div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Registration Number
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={regNumber}
                  onChange={(e) => setRegNumber(e.target.value)}
                  placeholder="REG-2024-001"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <button
                  onClick={handleGetNextRegNumber}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  title="Get Next Number"
                >
                  🔄
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Click 🔄 to auto-generate the next available number
              </p>
            </div>

            {selectedCert.registration_number && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  ⚠️ Changing the registration number will regenerate the PDFs
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRegModal(false);
                  setRegNumber('');
                  setSelectedCert(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddRegistration}
                disabled={loadingAction || !regNumber.trim()}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:bg-gray-400"
              >
                {loadingAction ? 'Processing...' : selectedCert.registration_number ? 'Update & Regenerate' : 'Add & Generate PDFs'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GeneratedCertificatesManagement;

