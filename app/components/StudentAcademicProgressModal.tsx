'use client';

import Link from 'next/link';
import StudentQualificationProgressView from '@/app/components/StudentQualificationProgressView';

interface StudentAcademicProgressModalProps {
  studentId: number;
  studentName: string;
  onClose: () => void;
}

export default function StudentAcademicProgressModal({
  studentId,
  studentName,
  onClose,
}: StudentAcademicProgressModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-[#11CCEF] to-[#0daed9] text-white p-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold m-0">Course progress – {studentName}</h2>
            <Link
              href={`/dashboard/tickets/student/${studentId}`}
              className="text-xs text-white/90 hover:underline mt-1 inline-block"
              onClick={onClose}
            >
              Open full student view →
            </Link>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors shrink-0"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">
          <StudentQualificationProgressView studentId={studentId} compact />
        </div>
      </div>
    </div>
  );
}
