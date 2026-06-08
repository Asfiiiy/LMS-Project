'use client';

import Image from 'next/image';

function inferAttachmentKind(fileUrl: string, fileName?: string | null, fileType?: string | null): 'image' | 'pdf' | 'document' | 'other' {
  const mime = (fileType || '').toLowerCase();
  const name = (fileName || fileUrl || '').toLowerCase();
  if (mime.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(name)) return 'image';
  if (mime.includes('pdf') || /\.pdf$/i.test(name)) return 'pdf';
  if (
    mime.includes('word') ||
    mime.includes('document') ||
    mime.includes('presentation') ||
    mime.includes('powerpoint') ||
    /\.(doc|docx|ppt|pptx|xls|xlsx)$/i.test(name)
  ) {
    return 'document';
  }
  return 'other';
}

interface MessageFileAttachmentProps {
  fileUrl: string;
  fileName?: string | null;
  fileType?: string | null;
  isOwn?: boolean;
  className?: string;
}

export default function MessageFileAttachment({
  fileUrl,
  fileName,
  fileType,
  isOwn = false,
  className = '',
}: MessageFileAttachmentProps) {
  const kind = inferAttachmentKind(fileUrl, fileName, fileType);
  const label = fileName || 'Download file';
  const linkClass = isOwn
    ? 'text-white hover:text-white/90'
    : 'text-[#11CCEF] hover:text-[#0daed9]';

  if (kind === 'image') {
    return (
      <a
        href={fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`block mt-2 max-w-xs ${className}`}
      >
        <Image
          src={fileUrl}
          alt={label}
          width={320}
          height={240}
          unoptimized
          className="rounded-lg border border-black/10 max-h-48 w-auto object-contain cursor-pointer hover:opacity-90"
        />
        <span className={`text-xs mt-1 inline-block ${linkClass}`}>{label}</span>
      </a>
    );
  }

  const icon =
    kind === 'pdf' ? (
      <svg className="w-8 h-8 text-red-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path d="M4 18h12V6h-4V2H4v16zm-2 1V0h12l4 4v16H2v-1z" />
      </svg>
    ) : (
      <svg className="w-8 h-8 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path d="M8 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0017.414 6L14 2.586A2 2 0 0012.586 2H8z" />
      </svg>
    );

  return (
    <a
      href={fileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-3 mt-2 p-3 rounded-xl border max-w-sm transition-colors ${
        isOwn ? 'bg-white/15 border-white/30 hover:bg-white/25' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
      } ${className}`}
    >
      {icon}
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold truncate ${isOwn ? 'text-white' : 'text-gray-900'}`}>{label}</p>
        <p className={`text-xs ${isOwn ? 'text-white/80' : 'text-gray-500'}`}>
          {kind === 'pdf' ? 'PDF — click to download' : 'Document — click to download'}
        </p>
      </div>
      <span className={`text-lg ${isOwn ? 'text-white' : 'text-gray-400'}`}>⬇</span>
    </a>
  );
}
