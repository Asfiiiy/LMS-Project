'use client';

import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { showToast } from './Toast';
import { showSweetAlert } from './SweetAlert';

interface Template {
  id: number;
  template_type: 'certificate' | 'transcript';
  course_type: 'cpd' | 'qualification';
  template_name: string;
  template_path: string;
  cloudinary_url: string | null;
  version: string;
  is_active: boolean;
  uploaded_by: number;
  uploaded_by_name: string;
  uploaded_at: string;
  description: string | null;
}

const CertificateTemplateManager: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Upload form state
  const [uploadForm, setUploadForm] = useState({
    template_type: 'certificate' as 'certificate' | 'transcript',
    course_type: 'cpd' as 'cpd' | 'qualification',
    template_name: '',
    description: '',
    file: null as File | null
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await apiService.getCertificateTemplates({ course_type: 'cpd' });
      if (response.success) {
        setTemplates(response.templates);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
      showToast('Failed to fetch', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validate file type
      if (!file.name.endsWith('.docx')) {
        showToast('DOCX only', 'error');
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        showToast('File too large', 'error');
        return;
      }

      setUploadForm({ ...uploadForm, file });
    }
  };

  const handleUpload = async () => {
    if (!uploadForm.file || !uploadForm.template_name.trim()) {
      showToast('Fill all fields', 'error');
      return;
    }

    try {
      setUploading(true);

      const formData = new FormData();
      formData.append('template', uploadForm.file);
      formData.append('template_type', uploadForm.template_type);
      formData.append('course_type', uploadForm.course_type);
      formData.append('template_name', uploadForm.template_name);
      if (uploadForm.description) {
        formData.append('description', uploadForm.description);
      }

      const response = await apiService.uploadCertificateTemplate(formData);

      if (response.success) {
        showSweetAlert('Success!', 'Template uploaded successfully', 'success');
        setShowUploadModal(false);
        resetUploadForm();
        fetchTemplates();
      } else {
        showToast(response.message || 'Upload failed', 'error');
      }
    } catch (error: any) {
      console.error('Error uploading template:', error);
      showToast(error.message || 'Error uploading template', 'error');
    } finally {
      setUploading(false);
    }
  };

  const resetUploadForm = () => {
    setUploadForm({
      template_type: 'certificate',
      course_type: 'cpd',
      template_name: '',
      description: '',
      file: null
    });
  };

  const handleDelete = async (templateId: number, templateName: string, isActive: boolean) => {
    if (isActive) {
      showSweetAlert(
        'Cannot Delete Active Template',
        'Please deactivate this template first before deleting it. You need at least one active template of each type.',
        'warning'
      );
      return;
    }

    // Show confirmation dialog with promise-based handling
    return new Promise<void>((resolve) => {
        showSweetAlert(
          'Delete Template?',
          `Are you sure you want to delete "${templateName}"? This action cannot be undone.`,
          'warning',
          {
            showCancelButton: true,
            showConfirmButton: true,
            confirmButtonText: 'Yes, delete it',
            cancelButtonText: 'Cancel',
            onConfirm: async () => {
            try {
              const response = await apiService.deleteCertificateTemplate(templateId);
              if (response.success) {
                showToast('Deleted', 'success');
                fetchTemplates();
                resolve();
              } else {
                showToast(response.message || 'Delete failed', 'error');
                resolve();
              }
            } catch (error: any) {
              console.error('Error deleting template:', error);
              showToast(error.message || 'Error deleting template', 'error');
              resolve();
            }
          },
          onCancel: () => {
            resolve();
          }
        }
      );
    });
  };

  const handleToggleActive = async (templateId: number, currentState: boolean, templateName: string) => {
    try {
      const formData = new FormData();
      formData.append('is_active', (!currentState).toString());

      const response = await apiService.updateCertificateTemplate(templateId, formData);
      if (response.success) {
        if (!currentState) {
          showToast('Activated', 'success');
        } else {
          showToast('Deactivated', 'success');
        }
        fetchTemplates();
      } else {
        showToast(response.message || 'Update failed', 'error');
      }
    } catch (error: any) {
      console.error('Error updating template:', error);
      showToast(error.message || 'Error updating template', 'error');
    }
  };

  const activeTemplates = templates.filter(t => t.is_active);
  const inactiveTemplates = templates.filter(t => !t.is_active);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading templates...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Certificate Templates</h2>
          <p className="text-sm text-gray-600 mt-1">Manage DOCX templates for auto-generating certificates</p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Upload New Template
        </button>
      </div>

      {/* Template Guidelines */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">📚 Template Guidelines:</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Use placeholders: <code className="bg-blue-100 px-1">{'{{STUDENT_NAME}}'}</code>, <code className="bg-blue-100 px-1">{'{{COURSE_NAME}}'}</code>, <code className="bg-blue-100 px-1">{'{{REGISTRATION_NO}}'}</code></li>
          <li>• For units: <code className="bg-blue-100 px-1">{'{{UNIT_1_NAME}}'}</code>, <code className="bg-blue-100 px-1">{'{{UNIT_1_CREDITS}}'}</code>, etc. (up to 25 units)</li>
          <li>• DOCX format only, max size: 10MB</li>
          <li>• Only one template of each type can be active at a time</li>
          <li>• Empty unit placeholders will be blank if course has fewer units</li>
        </ul>
      </div>

      {/* Active Templates */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">🟢 Active Templates</h3>
        {activeTemplates.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800">
            ⚠️ No active templates found. Please upload templates to enable auto-generation.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {activeTemplates.map((template) => (
              <div key={template.id} className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border-3 border-green-500">
                {/* Preview/Thumbnail Area - Exactly like your design */}
                <div className="relative bg-gradient-to-br from-green-400 via-emerald-500 to-teal-500 h-44 flex items-center justify-center overflow-hidden">
                  {/* Center Document Icon */}
                  <div className="relative z-10 text-center">
                    {template.template_type === 'certificate' ? (
                      // Scroll/Certificate Icon
                      <div className="text-8xl drop-shadow-2xl">📜</div>
                    ) : (
                      // Document/Paper Icon
                      <div className="text-8xl drop-shadow-2xl">📄</div>
                    )}
                    <div className="mt-2 bg-white/30 backdrop-blur-sm px-4 py-1.5 rounded-full inline-block">
                      <span className="text-white font-bold text-xs uppercase tracking-wide">
                        {template.template_type === 'certificate' ? 'Certificate' : 'Transcript'}
                      </span>
                    </div>
                  </div>

                  {/* Active Badge - Top Right */}
                  <div className="absolute top-2.5 right-2.5 bg-white text-green-600 px-2.5 py-1 rounded-full text-[10px] font-bold shadow-md flex items-center gap-1">
                    <span className="text-green-500 text-xs">●</span>
                    <span>ACTIVE</span>
                  </div>

                  {/* Course Type Badge - Top Left */}
                  <div className="absolute top-2.5 left-2.5 bg-white/95 backdrop-blur-sm text-gray-800 px-2.5 py-1 rounded-full text-[10px] font-bold shadow-md">
                    {template.course_type.toUpperCase()}
                  </div>
                </div>

                {/* Content Area */}
                <div className="p-4 space-y-2.5">
                  {/* Title */}
                  <h4 className="font-bold text-base text-gray-900 truncate" title={template.template_name}>
                    {template.template_name}
                  </h4>

                  {/* Meta Info - Compact */}
                  <div className="flex items-center gap-3 text-[11px] text-gray-500">
                    <div className="flex items-center gap-1">
                      <span className="text-purple-500">👤</span>
                      <span>{template.uploaded_by_name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-blue-500">📅</span>
                      <span>{new Date(template.uploaded_at).toLocaleDateString('en-GB', { 
                        day: 'numeric', 
                        month: 'short' 
                      })}</span>
                    </div>
                  </div>

                  {/* Action Buttons - Compact like your design */}
                  <div className="grid grid-cols-3 gap-2 pt-2">
                    <a
                      href={apiService.downloadCertificateTemplate(template.id)}
                      download
                      className="flex flex-col items-center justify-center py-2.5 px-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors shadow-sm"
                    >
                      <span className="text-xl mb-0.5">⬇️</span>
                      <span className="text-[10px] font-semibold">Download</span>
                    </a>
                    <a
                      href={apiService.downloadCertificateTemplate(template.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center justify-center py-2.5 px-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition-colors shadow-sm"
                    >
                      <span className="text-xl mb-0.5">👁️</span>
                      <span className="text-[10px] font-semibold">Preview</span>
                    </a>
                    <button
                      onClick={() => handleToggleActive(template.id, template.is_active, template.template_name)}
                      className="flex flex-col items-center justify-center py-2.5 px-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors shadow-sm"
                    >
                      <span className="text-xl mb-0.5">⏸️</span>
                      <span className="text-[10px] font-semibold">Pause</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inactive Templates */}
      {inactiveTemplates.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">⚪ Inactive Templates (Archive)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {inactiveTemplates.map((template) => (
              <div key={template.id} className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border-3 border-gray-400 opacity-70 hover:opacity-100">
                {/* Preview/Thumbnail Area - Grayscale for inactive */}
                <div className="relative bg-gradient-to-br from-gray-300 via-gray-400 to-gray-500 h-44 flex items-center justify-center overflow-hidden">
                  {/* Center Document Icon */}
                  <div className="relative z-10 text-center opacity-60">
                    {template.template_type === 'certificate' ? (
                      // Scroll/Certificate Icon
                      <div className="text-8xl drop-shadow-2xl">📜</div>
                    ) : (
                      // Document/Paper Icon
                      <div className="text-8xl drop-shadow-2xl">📄</div>
                    )}
                    <div className="mt-2 bg-white/30 backdrop-blur-sm px-4 py-1.5 rounded-full inline-block">
                      <span className="text-white font-bold text-xs uppercase tracking-wide">
                        {template.template_type === 'certificate' ? 'Certificate' : 'Transcript'}
                      </span>
                    </div>
                  </div>

                  {/* Inactive Badge - Top Right */}
                  <div className="absolute top-2.5 right-2.5 bg-gray-700 text-white px-2.5 py-1 rounded-full text-[10px] font-bold shadow-md flex items-center gap-1">
                    <span className="text-xs">⏸️</span>
                    <span>INACTIVE</span>
                  </div>

                  {/* Course Type Badge - Top Left */}
                  <div className="absolute top-2.5 left-2.5 bg-white/95 backdrop-blur-sm text-gray-800 px-2.5 py-1 rounded-full text-[10px] font-bold shadow-md">
                    {template.course_type.toUpperCase()}
                  </div>
                </div>

                {/* Content Area */}
                <div className="p-4 space-y-2.5">
                  {/* Title */}
                  <h4 className="font-bold text-base text-gray-700 truncate" title={template.template_name}>
                    {template.template_name}
                  </h4>

                  {/* Meta Info - Compact */}
                  <div className="flex items-center gap-2 text-[11px] text-gray-400">
                    <span className="text-blue-400">📅</span>
                    <span>{new Date(template.uploaded_at).toLocaleDateString('en-GB', { 
                      day: 'numeric', 
                      month: 'short',
                      year: 'numeric'
                    })}</span>
                  </div>

                  {/* Action Buttons - 4 buttons for inactive */}
                  <div className="grid grid-cols-4 gap-1.5 pt-2">
                    <a
                      href={apiService.downloadCertificateTemplate(template.id)}
                      download
                      className="flex flex-col items-center justify-center py-2 px-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors shadow-sm text-center"
                    >
                      <span className="text-lg mb-0.5">⬇️</span>
                      <span className="text-[9px] font-semibold">Download</span>
                    </a>
                    <a
                      href={apiService.downloadCertificateTemplate(template.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center justify-center py-2 px-1 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors shadow-sm text-center"
                    >
                      <span className="text-lg mb-0.5">👁️</span>
                      <span className="text-[9px] font-semibold">Preview</span>
                    </a>
                    <button
                      onClick={() => handleToggleActive(template.id, template.is_active, template.template_name)}
                      className="flex flex-col items-center justify-center py-2 px-1 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors shadow-sm text-center"
                    >
                      <span className="text-lg mb-0.5">▶️</span>
                      <span className="text-[9px] font-semibold">Activate</span>
                    </button>
                    <button
                      onClick={() => handleDelete(template.id, template.template_name, template.is_active)}
                      className="flex flex-col items-center justify-center py-2 px-1 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow-sm text-center"
                    >
                      <span className="text-lg mb-0.5">🗑️</span>
                      <span className="text-[9px] font-semibold">Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4">Upload Certificate Template</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template Type *
                </label>
                <select
                  value={uploadForm.template_type}
                  onChange={(e) => setUploadForm({ ...uploadForm, template_type: e.target.value as 'certificate' | 'transcript' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="certificate">Certificate</option>
                  <option value="transcript">Transcript</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Course Type *
                </label>
                <select
                  value={uploadForm.course_type}
                  onChange={(e) => setUploadForm({ ...uploadForm, course_type: e.target.value as 'cpd' | 'qualification' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="cpd">CPD</option>
                  <option value="qualification">Qualification</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={uploadForm.template_name}
                  onChange={(e) => setUploadForm({ ...uploadForm, template_name: e.target.value })}
                  placeholder="e.g., CPD Certificate V1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                  placeholder="Optional description..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template File (.docx) *
                </label>
                <input
                  type="file"
                  accept=".docx"
                  onChange={handleFileChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
                {uploadForm.file && (
                  <div className="mt-2 text-sm text-gray-600">
                    Selected: {uploadForm.file.name} ({(uploadForm.file.size / 1024).toFixed(2)} KB)
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  resetUploadForm();
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                disabled={uploading}
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || !uploadForm.file || !uploadForm.template_name.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? 'Uploading...' : 'Upload Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CertificateTemplateManager;

