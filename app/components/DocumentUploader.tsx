'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { Upload, X, FileText, Loader2 } from 'lucide-react';
import Swal from 'sweetalert2';
import { onboardingService } from '@/app/services/onboardingService';
import type { StudentDocument, DocumentType } from '@/app/types/onboarding.types';

interface DocumentUploaderProps {
  documentType: DocumentType;
  title: string;
  acceptedFormats: string[];
  maxSizeMB: number;
  multiple?: boolean;
  documents: StudentDocument[];
  onUploadSuccess: (document: StudentDocument) => void;
  onDeleteSuccess: (documentId: number) => void;
  /** After replace API, reload list so replaced + new rows appear */
  onRefreshDocuments?: () => void | Promise<void>;
}

/**
 * DocumentUploader - Handles document upload with preview and validation
 */
export default function DocumentUploader({
  documentType,
  title,
  acceptedFormats,
  maxSizeMB,
  multiple = false,
  documents,
  onUploadSuccess,
  onDeleteSuccess,
  onRefreshDocuments
}: DocumentUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [replacingId, setReplacingId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const filteredDocuments = documents.filter(d => d.document_type === documentType);
  const visibleDocuments = filteredDocuments.filter(d => d.status !== 'replaced');
  const hasRejected = visibleDocuments.some(d => d.status === 'rejected');

  const validateFile = (file: File): string | null => {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return `File size must be less than ${maxSizeMB}MB`;
    }
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!acceptedFormats.includes(fileExt)) {
      return `Only ${acceptedFormats.join(', ')} files are allowed`;
    }
    return null;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setError('');
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    let progressInterval: ReturnType<typeof setInterval> | null = null;
    try {
      setUploading(true);
      setUploadProgress(0);

      progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await onboardingService.uploadDocument(file, documentType);

      setUploadProgress(100);

      if (response.success && response.document) {
        onUploadSuccess(response.document);
        setTimeout(() => {
          setUploadProgress(0);
          setUploading(false);
        }, 500);
      } else {
        throw new Error(response.message || 'Upload failed');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to upload document';
      setError(message);
      setUploading(false);
      setUploadProgress(0);
    } finally {
      if (progressInterval) clearInterval(progressInterval);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleReplaceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    const targetId = replacingId;
    if (!files?.length || targetId == null) {
      setReplacingId(null);
      if (replaceInputRef.current) replaceInputRef.current.value = '';
      return;
    }

    const file = files[0];
    setError('');
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      setReplacingId(null);
      if (replaceInputRef.current) replaceInputRef.current.value = '';
      return;
    }

    let progressInterval: ReturnType<typeof setInterval> | null = null;
    try {
      setUploading(true);
      setUploadProgress(0);
      progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      await onboardingService.replaceDocument(targetId, file);

      setUploadProgress(100);
      if (onRefreshDocuments) {
        await onRefreshDocuments();
      }
      Swal.fire({
        icon: 'success',
        title: 'Uploaded',
        text: 'Your new document was submitted for review.',
        confirmButtonColor: '#11CCEF',
        timer: 2500,
        showConfirmButton: false
      });
      setTimeout(() => {
        setUploadProgress(0);
        setUploading(false);
      }, 400);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to replace document';
      setError(message);
      setUploading(false);
      setUploadProgress(0);
    } finally {
      if (progressInterval) clearInterval(progressInterval);
    }

    setReplacingId(null);
    if (replaceInputRef.current) replaceInputRef.current.value = '';
  };

  const startReplace = (documentId: number) => {
    setReplacingId(documentId);
    setTimeout(() => replaceInputRef.current?.click(), 0);
  };

  const handleDelete = async (documentId: number) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: 'Are you sure you want to delete this document?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#11CCEF',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Yes, delete it',
      cancelButtonText: 'Cancel'
    });
    if (!result.isConfirmed) return;

    try {
      const response = await onboardingService.deleteDocument(documentId);
      if (response.success) {
        onDeleteSuccess(documentId);
        Swal.fire({
          icon: 'success',
          title: 'Done!',
          text: 'Document deleted successfully',
          confirmButtonColor: '#11CCEF',
          timer: 2000,
          showConfirmButton: false
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Delete failed',
          text: response.message || 'Failed to delete document',
          confirmButtonColor: '#11CCEF'
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete document';
      Swal.fire({
        icon: 'error',
        title: 'Something went wrong',
        text: message,
        confirmButtonColor: '#11CCEF'
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const isImage = (mimeType: string) => mimeType.startsWith('image/');

  const showMainUpload = (multiple || visibleDocuments.length === 0) && !hasRejected;

  return (
    <div className="space-y-4">
      {title ? <h3 className="text-lg font-semibold text-gray-900">{title}</h3> : null}

      <input
        ref={replaceInputRef}
        type="file"
        accept={acceptedFormats.join(',')}
        onChange={handleReplaceFile}
        className="hidden"
        disabled={uploading}
      />

      {showMainUpload && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedFormats.join(',')}
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploading}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-[#11CCEF] hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading && replacingId === null ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Uploading ({uploadProgress}%)...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                Click to upload {acceptedFormats.join(', ')} (max {maxSizeMB}MB)
              </>
            )}
          </button>
        </div>
      )}

      {uploading && (
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-[#11CCEF] h-2 rounded-full transition-all duration-300"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}

      {visibleDocuments.length > 0 && (
        <div className="space-y-2">
          {visibleDocuments.map(doc => (
            <div
              key={doc.id}
              className={`flex flex-col gap-2 p-3 rounded-lg border ${
                doc.status === 'rejected'
                  ? 'bg-red-50/80 border-red-200'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 relative w-16 h-16 rounded border border-gray-300 overflow-hidden">
                  {isImage(doc.mime_type) ? (
                    <Image
                      src={doc.file_url}
                      alt={doc.file_name}
                      width={64}
                      height={64}
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gray-200 flex items-center justify-center">
                      <FileText className="w-8 h-8 text-gray-500" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{doc.file_name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(doc.file_size)}</p>
                  {doc.status && doc.status !== 'pending' && (
                    <p className="text-xs font-semibold text-gray-600 mt-0.5 capitalize">Status: {doc.status}</p>
                  )}
                  <p className="text-xs text-gray-400">
                    {new Date(doc.uploaded_at).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleDelete(doc.id)}
                  className="flex-shrink-0 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete document"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {doc.status === 'rejected' && (
                <div
                  style={{
                    background: '#fef2f2',
                    border: '1.5px solid #fecaca',
                    borderRadius: '10px',
                    padding: '12px',
                    marginTop: '4px'
                  }}
                >
                  <div
                    style={{
                      color: '#dc2626',
                      fontWeight: 700,
                      fontSize: '13px',
                      marginBottom: '4px'
                    }}
                  >
                    Document rejected
                  </div>
                  {doc.rejection_reason ? (
                    <div
                      style={{
                        color: '#991b1b',
                        fontSize: '12px',
                        marginBottom: '8px'
                      }}
                    >
                      Reason: {doc.rejection_reason}
                    </div>
                  ) : null}
                  <p style={{ color: '#64748b', fontSize: '12px', marginBottom: '10px' }}>
                    Please upload a new document to continue your application.
                  </p>
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => startReplace(doc.id)}
                    className="w-full sm:w-auto px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-[#11CCEF] to-[#E51791] disabled:opacity-50"
                  >
                    Upload new version
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
