'use client';

import { useState, useEffect } from 'react';
import { apiService } from '@/app/services/api';
import { showSweetAlert } from './SweetAlert';
import { showToast } from './Toast';

interface CertificateEditorProps {
  certificateId: number;
  type: 'cert' | 'trans';
  registrationNumber: string;
  isDelivered: boolean;
  onClose: () => void;
  onSave: () => void;
}

interface PlaceholderData {
  STUDENT_NAME: string;
  COURSE_NAME: string;
  REGISTRATION_NO: string;
  DATE_OF_ISSUANCE: string;
  [key: string]: string; // For dynamic unit fields
}

export default function CertificateEditor({
  certificateId,
  type,
  registrationNumber,
  isDelivered,
  onClose,
  onSave
}: CertificateEditorProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [placeholders, setPlaceholders] = useState<PlaceholderData>({
    STUDENT_NAME: '',
    COURSE_NAME: '',
    REGISTRATION_NO: '',
    DATE_OF_ISSUANCE: ''
  });
  const [originalPlaceholders, setOriginalPlaceholders] = useState<PlaceholderData>({
    STUDENT_NAME: '',
    COURSE_NAME: '',
    REGISTRATION_NO: '',
    DATE_OF_ISSUANCE: ''
  });
  const [units, setUnits] = useState<Array<{ name: string; credits: string }>>([]);

  useEffect(() => {
    loadPlaceholderData();
  }, [certificateId, type]);

  const loadPlaceholderData = async () => {
    try {
      setLoading(true);
      // Fetch placeholder data from generated_certificates
      const response = await apiService.getCertificatePlaceholders(certificateId);
      
      if (response.success) {
        const data = response.data;
        const newPlaceholders: PlaceholderData = {
          STUDENT_NAME: data.STUDENT_NAME || '',
          COURSE_NAME: data.COURSE_NAME || '',
          REGISTRATION_NO: data.REGISTRATION_NO || '',
          DATE_OF_ISSUANCE: data.DATE_OF_ISSUANCE || ''
        };
        
        // Load units for transcript
        if (type === 'trans' && data.units) {
          setUnits(data.units);
          // Add unit placeholders
          data.units.forEach((unit: any, index: number) => {
            newPlaceholders[`UNIT_${index + 1}_NAME`] = unit.name || '';
            newPlaceholders[`UNIT_${index + 1}_CREDITS`] = unit.credits || '';
          });
        }
        
        setPlaceholders(newPlaceholders);
        setOriginalPlaceholders(JSON.parse(JSON.stringify(newPlaceholders)));
      } else {
        showToast(response.message || 'Failed to load certificate data', 'error');
      }
    } catch (error: any) {
      console.error('Error loading certificate:', error);
      showToast(error.message || 'Error loading certificate data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (JSON.stringify(placeholders) === JSON.stringify(originalPlaceholders)) {
      showToast('No changes detected', 'warning');
      return;
    }

    showSweetAlert(
      'Save Changes?',
      isDelivered 
        ? 'This certificate is already delivered. Saving will regenerate the certificate and require re-delivery.'
        : 'Save the edited certificate? Certificate will be regenerated with new data.',
      'warning',
      {
        showCancelButton: true,
        confirmButtonText: 'Yes, Save',
        onConfirm: async () => {
          try {
            setSaving(true);
            
            // Prepare units data for transcript
            const unitsData = type === 'trans' ? units.map((unit, index) => ({
              name: placeholders[`UNIT_${index + 1}_NAME`] || unit.name,
              credits: placeholders[`UNIT_${index + 1}_CREDITS`] || unit.credits
            })) : [];
            
            const response = await apiService.saveCertificatePlaceholders(
              certificateId,
              {
                STUDENT_NAME: placeholders.STUDENT_NAME,
                COURSE_NAME: placeholders.COURSE_NAME,
                REGISTRATION_NO: placeholders.REGISTRATION_NO,
                DATE_OF_ISSUANCE: placeholders.DATE_OF_ISSUANCE,
                units: unitsData
              }
            );

            if (response.success) {
              showToast('Certificate updated successfully!', 'success');
              setOriginalPlaceholders(JSON.parse(JSON.stringify(placeholders)));
              onSave();
              
              if (isDelivered) {
                showSweetAlert(
                  'Re-deliver Certificate?',
                  'The certificate has been updated. Would you like to re-deliver it to the student?',
                  'warning',
                  {
                    showCancelButton: true,
                    confirmButtonText: 'Yes, Re-deliver',
                    onConfirm: async () => {
                      try {
                        const deliverResponse = await apiService.deliverCertificate(certificateId);
                        if (deliverResponse.success) {
                          showToast('Certificate re-delivered successfully!', 'success');
                          onClose();
                        }
                      } catch (error: any) {
                        showToast(error.message || 'Error re-delivering', 'error');
                      }
                    }
                  }
                );
              } else {
                onClose();
              }
            } else {
              showToast(response.message || 'Save failed', 'error');
            }
          } catch (error: any) {
            showToast(error.message || 'Error saving certificate', 'error');
          } finally {
            setSaving(false);
          }
        }
      }
    );
  };

  const handleDiscard = () => {
    if (JSON.stringify(placeholders) !== JSON.stringify(originalPlaceholders)) {
      showSweetAlert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to discard them?',
        'warning',
        {
          showCancelButton: true,
          confirmButtonText: 'Yes, Discard',
          onConfirm: () => {
            onClose();
          }
        }
      );
    } else {
      onClose();
    }
  };

  const handlePlaceholderChange = (key: string, value: string) => {
    setPlaceholders(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleUnitChange = (index: number, field: 'name' | 'credits', value: string) => {
    const key = field === 'name' ? `UNIT_${index + 1}_NAME` : `UNIT_${index + 1}_CREDITS`;
    handlePlaceholderChange(key, value);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {type === 'cert' ? '📜 Edit Certificate' : '📄 Edit Transcript'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Registration: {registrationNumber}
              {isDelivered && (
                <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                  ✅ Delivered
                </span>
              )}
            </p>
          </div>
          <button
            onClick={handleDiscard}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading certificate data...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">📝 Edit Certificate Placeholders:</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Edit the fields below to update certificate data</li>
                  <li>• Certificate will be regenerated automatically when you save</li>
                  <li>• Registration number will be updated in the system</li>
                  {isDelivered && (
                    <li className="text-orange-700 font-medium">
                      ⚠️ This certificate is delivered. Saving will require re-delivery to update the student's copy.
                    </li>
                  )}
                </ul>
              </div>

              {/* Basic Fields */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">📋 Certificate Information</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    👤 Student Name
                  </label>
                  <input
                    type="text"
                    value={placeholders.STUDENT_NAME}
                    onChange={(e) => handlePlaceholderChange('STUDENT_NAME', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter student name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    📚 Course Name
                  </label>
                  <input
                    type="text"
                    value={placeholders.COURSE_NAME}
                    onChange={(e) => handlePlaceholderChange('COURSE_NAME', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter course name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    🔢 Registration Number
                  </label>
                  <input
                    type="text"
                    value={placeholders.REGISTRATION_NO}
                    onChange={(e) => handlePlaceholderChange('REGISTRATION_NO', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                    placeholder="e.g., ILC50033"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This will update the Reg # in the table
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    📅 Date of Issuance
                  </label>
                  <input
                    type="date"
                    value={placeholders.DATE_OF_ISSUANCE}
                    onChange={(e) => handlePlaceholderChange('DATE_OF_ISSUANCE', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Units Section (for Transcript only) */}
              {type === 'trans' && units.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">📖 Course Units</h3>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {units.map((unit, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold text-blue-600">Unit {index + 1}</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Unit Name
                            </label>
                            <input
                              type="text"
                              value={placeholders[`UNIT_${index + 1}_NAME`] || unit.name}
                              onChange={(e) => handleUnitChange(index, 'name', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="Enter unit name"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Credits
                            </label>
                            <input
                              type="text"
                              value={placeholders[`UNIT_${index + 1}_CREDITS`] || unit.credits}
                              onChange={(e) => handleUnitChange(index, 'credits', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="e.g., 10"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="text-sm text-gray-600">
            {JSON.stringify(placeholders) !== JSON.stringify(originalPlaceholders) && (
              <span className="text-orange-600 font-medium">● Unsaved changes</span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleDiscard}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || JSON.stringify(placeholders) === JSON.stringify(originalPlaceholders)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <span className="inline-block animate-spin mr-2">⏳</span>
                  Saving...
                </>
              ) : (
                '💾 Save & Regenerate'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

