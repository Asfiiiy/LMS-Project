'use client';

import { useEffect, useRef, useState } from 'react';
import { getApiUrl } from '@/app/utils/apiUrl';

const TICKET_CATEGORIES = [
  { value: 'General', label: 'General Inquiry' },
  { value: 'Course Related', label: 'Academic / Course Related' },
  { value: 'Financial', label: 'Payment / Financial' },
  { value: 'Certificate', label: 'Certificate Inquiry' },
  { value: 'Admission', label: 'Document / Admission' },
  { value: 'Technical', label: 'Technical Support' },
];

export interface SendMessageToStudentModalProps {
  studentId: string | number;
  studentName: string;
  open: boolean;
  onClose: () => void;
  onSuccess?: (ticketId: number) => void;
}

export default function SendMessageToStudentModal({
  studentId,
  studentName,
  open,
  onClose,
  onSuccess,
}: SendMessageToStudentModalProps) {
  const [msgSubject, setMsgSubject] = useState('');
  const [msgCategory, setMsgCategory] = useState('General');
  const [msgBody, setMsgBody] = useState('');
  const [msgFile, setMsgFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const msgFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setSent(false);
    setMsgSubject('');
    setMsgBody('');
    setMsgFile(null);
    setMsgCategory('General');
    if (msgFileRef.current) msgFileRef.current.value = '';
  }, [open, studentId]);

  if (!open) return null;

  const handleSendToStudent = async () => {
    if (!msgSubject.trim()) {
      alert('Please enter a subject');
      return;
    }
    setSending(true);

    try {
      const token = localStorage.getItem('lms-token') || '';
      const apiUrl = getApiUrl();
      let fileData: Record<string, string> = {};

      if (msgFile) {
        if (msgFile.size > 10 * 1024 * 1024) {
          alert('File too large. Max 10MB.');
          setSending(false);
          return;
        }
        const fd = new FormData();
        fd.append('file', msgFile);
        const upRes = await fetch(`${apiUrl}/api/tickets/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        const upData = await upRes.json();
        if (upData.success && upData.file) {
          fileData = {
            file_url: upData.file.url,
            file_name: upData.file.name || msgFile.name,
            file_type: upData.file.type || msgFile.type,
          };
        } else {
          alert(upData.message || 'File upload failed');
          setSending(false);
          return;
        }
      }

      const res = await fetch(`${apiUrl}/api/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          student_id: Number(studentId),
          subject: msgSubject.trim(),
          category: msgCategory,
          message: msgBody.trim() || undefined,
          ...fileData,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSent(true);
        if (data.ticketId && onSuccess) onSuccess(data.ticketId);
        setTimeout(() => {
          onClose();
          setSent(false);
        }, 2000);
      } else {
        alert(data.message || 'Failed to send');
      }
    } catch {
      alert('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[9999] p-5"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[20px] w-full max-w-[560px] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-6 py-5 text-white"
          style={{ background: 'linear-gradient(135deg, #e51791, #c1147a)' }}
        >
          <h2 className="m-0 text-lg font-extrabold">💬 Send Message to Student</h2>
          <p className="mt-1 mb-0 text-sm opacity-90">{studentName}</p>
        </div>

        {sent ? (
          <div className="p-10 text-center">
            <div className="text-5xl mb-3">✅</div>
            <p className="text-base font-bold text-green-600">Message sent successfully!</p>
            <p className="text-sm text-slate-500 mt-1">The student will be notified.</p>
          </div>
        ) : (
          <div className="p-6">
            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">
                Subject *
              </label>
              <input
                value={msgSubject}
                onChange={(e) => setMsgSubject(e.target.value)}
                placeholder="e.g. Assignment feedback, Payment query..."
                className="w-full px-3.5 py-2.5 border-[1.5px] border-slate-200 rounded-[10px] text-sm outline-none focus:border-[#11CCEF] box-border"
              />
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">
                Category
              </label>
              <select
                value={msgCategory}
                onChange={(e) => setMsgCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 border-[1.5px] border-slate-200 rounded-[10px] text-sm bg-white outline-none focus:border-[#11CCEF] box-border"
              >
                {TICKET_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">
                Message
              </label>
              <textarea
                value={msgBody}
                onChange={(e) => setMsgBody(e.target.value)}
                placeholder="Type your message to the student..."
                rows={4}
                className="w-full px-3.5 py-2.5 border-[1.5px] border-slate-200 rounded-[10px] text-sm resize-y outline-none focus:border-[#11CCEF] box-border leading-relaxed"
              />
            </div>

            <div className="mb-5">
              <input
                ref={msgFileRef}
                type="file"
                className="hidden"
                onChange={(e) => setMsgFile(e.target.files?.[0] || null)}
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
              />
              {msgFile ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                  <span>📎</span>
                  <span className="text-sm flex-1 text-gray-700 font-semibold truncate">{msgFile.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setMsgFile(null);
                      if (msgFileRef.current) msgFileRef.current.value = '';
                    }}
                    className="bg-transparent border-0 cursor-pointer text-slate-400 text-base"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => msgFileRef.current?.click()}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 border-[1.5px] border-dashed border-slate-300 rounded-lg text-slate-500 text-sm font-medium cursor-pointer"
                >
                  📎 Attach file (optional)
                </button>
              )}
            </div>

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-[10px] border border-slate-200 bg-transparent text-slate-500 text-sm font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendToStudent}
                disabled={sending || !msgSubject.trim()}
                className="px-6 py-2.5 rounded-[10px] border-0 text-sm font-bold cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 text-white"
                style={
                  sending || !msgSubject.trim()
                    ? undefined
                    : { background: 'linear-gradient(135deg, #e51791, #c1147a)' }
                }
              >
                {sending ? '⏳ Sending...' : '💬 Send Message'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
