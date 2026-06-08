'use client';

import React, { useState, useEffect, useRef } from 'react';

interface UniversalFileViewerProps {
  fileUrl: string;
  fileName: string;
  onClose: () => void;
  /** When provided, called on download click (e.g. to log assessor activity). Use for custom download handling. */
  onDownload?: () => void | Promise<void>;
  /** When provided, called when viewer closes (for file_closed logging). Receives openedAt. For beforeunload, pass { keepalive: true }. */
  onCloseWithDuration?: (openedAt: string, opts?: { keepalive?: boolean }) => void | Promise<void>;
  /** Timestamp when file was opened (ISO string). Required for onCloseWithDuration. */
  openedAt?: string;
}

export default function UniversalFileViewer({ fileUrl, fileName, onClose, onDownload, onCloseWithDuration, openedAt }: UniversalFileViewerProps) {
  const [fileType, setFileType] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const closeFiredRef = useRef(false);

  const handleClose = async () => {
    if (closeFiredRef.current) return;
    closeFiredRef.current = true;
    if (onCloseWithDuration && openedAt) {
      try {
        await onCloseWithDuration(openedAt);
      } catch (e) {
        // no-op
      }
    }
    onClose();
  };

  useEffect(() => {
    if (!onCloseWithDuration || !openedAt) return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleClose();
      }
    };
    const handleBeforeUnload = () => {
      if (closeFiredRef.current) return;
      onCloseWithDuration(openedAt, { keepalive: true });
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [onCloseWithDuration, openedAt]);

  useEffect(() => () => { closeFiredRef.current = false; }, []);

  useEffect(() => {
    const ext = fileName.toLowerCase().split('.').pop() || '';
    setFileType(ext);
  }, [fileUrl, fileName]);

  const getFileTypeCategory = () => {
    const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
    const audioTypes = ['mp3', 'wav', 'ogg', 'm4a', 'aac'];
    const videoTypes = ['mp4', 'mov', 'webm', 'avi'];
    const docTypes = ['doc', 'docx'];
    const pptTypes = ['ppt', 'pptx'];
    const excelTypes = ['xls', 'xlsx'];
    
    if (imageTypes.includes(fileType)) return 'image';
    if (audioTypes.includes(fileType)) return 'audio';
    if (videoTypes.includes(fileType)) return 'video';
    if (docTypes.includes(fileType)) return 'docx';
    if (pptTypes.includes(fileType)) return 'pptx';
    if (excelTypes.includes(fileType)) return 'excel';
    if (fileType === 'pdf') return 'pdf';
    
    return 'unknown';
  };

  // Get Google Docs Viewer URL for Office files
  const getGoogleDocsViewerUrl = (url: string) => {
    return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
  };

  const category = getFileTypeCategory();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg text-gray-900 truncate">{fileName}</h3>
            <p className="text-sm text-gray-500">
              {category === 'image' && '🖼️ Image File'}
              {category === 'audio' && '🎵 Audio File'}
              {category === 'video' && '🎥 Video File'}
              {category === 'docx' && '📄 Word Document'}
              {category === 'pptx' && '📊 PowerPoint Presentation'}
              {category === 'excel' && '📊 Excel Spreadsheet'}
              {category === 'pdf' && '📄 PDF Document'}
              {category === 'unknown' && '📎 File'}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="ml-4 text-gray-500 hover:text-gray-700 text-2xl w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading file...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {!loading && !error && (
            <>
              {/* Image Viewer */}
              {category === 'image' && (
                <div className="flex items-center justify-center">
                  <img 
                    src={fileUrl} 
                    alt={fileName}
                    className="max-w-full h-auto rounded-lg shadow-lg"
                  />
                </div>
              )}

              {/* Audio Player */}
              {category === 'audio' && (
                <div className="max-w-2xl mx-auto">
                  <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-8 text-center">
                    <div className="text-6xl mb-4">🎵</div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Audio Player</h4>
                    <audio 
                      controls 
                      className="w-full"
                      preload="metadata"
                    >
                      <source src={fileUrl} />
                      Your browser does not support audio playback.
                    </audio>
                    <p className="text-sm text-gray-600 mt-4">
                      Use the controls above to play, pause, and adjust volume
                    </p>
                  </div>
                </div>
              )}

              {/* Video Player */}
              {category === 'video' && (
                <div className="max-w-4xl mx-auto">
                  <video 
                    controls 
                    className="w-full h-auto rounded-lg shadow-lg"
                    preload="metadata"
                  >
                    <source src={fileUrl} />
                    Your browser does not support video playback.
                  </video>
                </div>
              )}

              {/* PDF Viewer */}
              {category === 'pdf' && (
                <div className="w-full h-[calc(90vh-200px)]">
                  <iframe
                    src={fileUrl}
                    className="w-full h-full rounded-lg"
                    title="PDF Viewer"
                    allow="fullscreen"
                  />
                </div>
              )}

              {/* DOCX Viewer - Google Docs Viewer (preserves all formatting) */}
              {category === 'docx' && (
                <div className="w-full h-[calc(90vh-200px)]">
                  <iframe
                    src={getGoogleDocsViewerUrl(fileUrl)}
                    className="w-full h-full rounded-lg border border-gray-200"
                    title="Document Viewer"
                    allow="fullscreen"
                  />
                  <p className="text-xs text-gray-500 text-center mt-2">
                    💡 Viewing with Google Docs Viewer - All formatting preserved
                  </p>
                </div>
              )}

              {/* PPTX Viewer - Google Docs Viewer */}
              {category === 'pptx' && (
                <div className="w-full h-[calc(90vh-200px)]">
                  <iframe
                    src={getGoogleDocsViewerUrl(fileUrl)}
                    className="w-full h-full rounded-lg border border-gray-200"
                    title="Presentation Viewer"
                    allow="fullscreen"
                  />
                  <p className="text-xs text-gray-500 text-center mt-2">
                    💡 Viewing with Google Docs Viewer - All slides and animations preserved
                  </p>
                </div>
              )}

              {/* Excel Viewer - Google Docs Viewer */}
              {category === 'excel' && (
                <div className="w-full h-[calc(90vh-200px)]">
                  <iframe
                    src={getGoogleDocsViewerUrl(fileUrl)}
                    className="w-full h-full rounded-lg border border-gray-200"
                    title="Spreadsheet Viewer"
                    allow="fullscreen"
                  />
                  <p className="text-xs text-gray-500 text-center mt-2">
                    💡 Viewing with Google Docs Viewer
                  </p>
                </div>
              )}

              {/* Unknown - Show Download */}
              {category === 'unknown' && (
                <div className="max-w-2xl mx-auto text-center">
                  <div className="bg-gray-50 rounded-xl p-8">
                    <div className="text-6xl mb-4">📎</div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">
                      File Preview Not Available
                    </h4>
                    <p className="text-gray-600 mb-6">
                      This file type cannot be previewed in the browser. Please download to view.
                    </p>
                    {onDownload ? (
                      <button
                        onClick={onDownload}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                      >
                        <span>⬇️</span>
                        <span>Download File</span>
                      </button>
                    ) : (
                      <a
                        href={fileUrl}
                        download={fileName}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                      >
                        <span>⬇️</span>
                        <span>Download File</span>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
          {onDownload ? (
            <button
              onClick={onDownload}
              className="px-4 py-2 text-blue-600 hover:text-blue-800 font-medium text-sm"
            >
              ⬇️ Download File
            </button>
          ) : (
            <a
              href={fileUrl}
              download={fileName}
              className="px-4 py-2 text-blue-600 hover:text-blue-800 font-medium text-sm"
            >
              ⬇️ Download File
            </a>
          )}
          <button
            onClick={handleClose}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

