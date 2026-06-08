'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiService } from '@/app/services/api';

interface RejectedDocument {
  id: number;
  document_type: string;
  file_name: string;
  rejection_reason: string;
  rejected_at: string;
}

const ResubmitDocumentsPage = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [rejectedDocs, setRejectedDocs] = useState<RejectedDocument[]>([]);
  const [uploadFiles, setUploadFiles] = useState<{ [key: number]: File | null }>({});
  const [error, setError] = useState('');

  useEffect(() => {
    fetchRejectedDocuments();
  }, []);

  const fetchRejectedDocuments = async () => {
    try {
      setLoading(true);
      const response = await apiService.getMyDocuments();
      
      if (response.success) {
        const rejected = response.documents.filter(
          (doc: any) => doc.status === 'rejected'
        );
        setRejectedDocs(rejected);
        
        if (rejected.length === 0) {
          // No rejected documents, redirect to verification pending
          router.replace('/onboarding/verification-pending');
        }
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
      setError('Failed to load rejected documents');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (docId: number, file: File | null) => {
    setUploadFiles(prev => ({
      ...prev,
      [docId]: file
    }));
  };

  const handleResubmit = async () => {
    try {
      setUploading(true);
      setError('');

      const resubmitPromises = Object.entries(uploadFiles).map(async ([docId, file]) => {
        if (!file) return null;

        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`/api/documents/replace/${docId}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('lms-token')}`
          },
          body: formData
        });

        return response.json();
      });

      const results = await Promise.all(resubmitPromises);
      const allSuccess = results.every(r => !r || r.success);

      if (allSuccess) {
        // Update onboarding status to show documents resubmitted
        await fetch('/api/onboarding/documents', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('lms-token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            documents_uploaded: true,
            resubmitted: true
          })
        });

        // Redirect to verification pending
        router.push('/onboarding/verification-pending');
      } else {
        setError('Some documents failed to upload. Please try again.');
      }
    } catch (error) {
      console.error('Error resubmitting documents:', error);
      setError('Failed to resubmit documents. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const canSubmit = rejectedDocs.every(doc => uploadFiles[doc.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E51791] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            📄 Resubmit Documents
          </h1>
          <p className="text-lg text-gray-600">
            Please upload new versions of the rejected documents below
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-lg">
            <div className="flex items-center">
              <span className="text-red-600 font-medium">⚠️ {error}</span>
            </div>
          </div>
        )}

        {/* Rejected Documents */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Documents Requiring Resubmission
          </h2>

          <div className="space-y-6">
            {rejectedDocs.map((doc) => (
              <div key={doc.id} className="border-2 border-red-200 rounded-lg p-6 bg-red-50">
                {/* Document Info */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {doc.document_type.replace(/_/g, ' ').toUpperCase()}
                    </h3>
                    <span className="px-3 py-1 bg-red-100 text-red-800 text-sm font-medium rounded-full">
                      REJECTED
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Previous file:</span> {doc.file_name}
                  </p>
                  <div className="mt-2 p-3 bg-white rounded-lg border border-red-300">
                    <p className="text-sm font-medium text-red-600">Rejection Reason:</p>
                    <p className="text-sm text-gray-700 mt-1">{doc.rejection_reason}</p>
                  </div>
                </div>

                {/* File Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload New Document *
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={(e) => handleFileSelect(doc.id, e.target.files?.[0] || null)}
                    className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-lg file:border-0
                      file:text-sm file:font-semibold
                      file:bg-[#E51791] file:text-white
                      hover:file:bg-[#c01376] file:cursor-pointer
                      cursor-pointer"
                  />
                  {uploadFiles[doc.id] && (
                    <p className="mt-2 text-sm text-green-600 font-medium">
                      ✓ {uploadFiles[doc.id]?.name}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-center gap-4">
          <button
            onClick={() => router.push('/dashboard/student')}
            className="px-8 py-3 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleResubmit}
            disabled={!canSubmit || uploading}
            className="px-8 py-3 bg-[#E51791] text-white font-medium rounded-lg hover:bg-[#c01376] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? 'Uploading...' : 'Submit Documents'}
          </button>
        </div>

        {!canSubmit && (
          <p className="text-center text-sm text-gray-500 mt-4">
            Please upload all rejected documents to continue
          </p>
        )}
      </div>
    </div>
  );
};

export default ResubmitDocumentsPage;
