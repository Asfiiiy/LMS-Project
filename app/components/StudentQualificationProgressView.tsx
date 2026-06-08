'use client';

import { useEffect, useState } from 'react';
import { apiService } from '@/app/services/api';
import { formatDateGB, getGradeByDate } from '@/app/utils/gradingDeadline';

interface SubmissionFile {
  id: number;
  file_name: string;
  file_path: string;
  file_type?: string;
  status: string;
  resubmit_feedback?: string | null;
  uploaded_at?: string;
}

interface Submission {
  id: number;
  status: string;
  pass_fail_result?: string | null;
  feedback?: string | null;
  submitted_at?: string | null;
  graded_at?: string | null;
  graded_by_name?: string | null;
  files?: SubmissionFile[];
}

interface QualUnit {
  unit_id: number;
  unit_title: string;
  unit_number: number;
  is_unlocked: boolean;
  is_completed: boolean;
  assignment_submitted: boolean;
  assignment_status?: string | null;
  deadline?: string | null;
  assessor_name?: string | null;
  submissions?: Submission[];
}

interface QualCourse {
  course_id: number;
  course_title: string;
  units: QualUnit[];
}

function unitLabel(unit: QualUnit): string {
  const codeMatch = unit.unit_title.match(/\b([A-Z]{2,}\d{2,}[A-Z0-9]*)\b/);
  const code = codeMatch ? codeMatch[1] : null;
  if (code) return `Unit ${unit.unit_number} - ${code}`;
  return `Unit ${unit.unit_number} - ${unit.unit_title}`;
}

function getUnitStatus(unit: QualUnit): {
  icon: string;
  label: string;
  color: string;
  bg: string;
} {
  const latest = unit.submissions?.[0];
  const passFail = String(latest?.pass_fail_result || unit.assignment_status || '').toLowerCase();
  const hasRejected = latest?.files?.some((f) => f.status === 'resubmit_requested');
  const isLocked = !unit.is_unlocked;

  if (isLocked && !unit.assignment_submitted && passFail !== 'pass') {
    return { icon: '🔒', label: 'Locked', color: '#94a3b8', bg: '#f8fafc' };
  }
  if (passFail === 'pass' || unit.is_completed) {
    return { icon: '✅', label: 'Passed', color: '#16a34a', bg: '#dcfce7' };
  }
  if (passFail === 'refer') {
    return { icon: '🔄', label: 'Referred', color: '#dc2626', bg: '#fee2e2' };
  }
  if (hasRejected) {
    return { icon: '❌', label: 'File Rejected', color: '#dc2626', bg: '#fee2e2' };
  }
  if (
    latest &&
    (latest.status === 'submitted' || latest.status === 'resubmit_requested') &&
    !latest.graded_at
  ) {
    return { icon: '⏳', label: 'Awaiting Grade', color: '#d97706', bg: '#fef3c7' };
  }
  if (unit.assignment_submitted) {
    return { icon: '⏳', label: 'Awaiting Grade', color: '#d97706', bg: '#fef3c7' };
  }
  return { icon: '📝', label: 'In Progress', color: '#2563eb', bg: '#dbeafe' };
}

interface StudentQualificationProgressViewProps {
  studentId: number;
  compact?: boolean;
}

export default function StudentQualificationProgressView({
  studentId,
  compact = false,
}: StudentQualificationProgressViewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courses, setCourses] = useState<QualCourse[]>([]);
  const [assignedTutor, setAssignedTutor] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiService.getStudentQualProgress(studentId);
        if (cancelled) return;
        if (!res?.success) {
          setError(res?.message || 'Failed to load course progress');
          return;
        }
        setCourses(res.courses || []);
        setAssignedTutor(res.assigned_tutor_name || null);
      } catch {
        if (!cancelled) setError('Failed to load course progress');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  if (loading) {
    return (
      <div className="py-10 text-center text-gray-500">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#11CCEF] mb-2" />
        <p className="text-sm">Loading course progress…</p>
      </div>
    );
  }

  if (error) {
    return <div className="py-8 text-center text-red-600 text-sm">{error}</div>;
  }

  if (courses.length === 0) {
    return (
      <div className="py-8 text-center text-gray-500 text-sm">
        No qualification courses enrolled for this student.
      </div>
    );
  }

  return (
    <div className={`space-y-${compact ? '4' : '6'}`}>
      {assignedTutor && (
        <p className="text-xs text-gray-600 mb-2">
          <span className="font-semibold">Assigned assessor:</span> {assignedTutor}
        </p>
      )}
      {courses.map((course) => (
        <div key={course.course_id} className="border border-gray-200 rounded-xl overflow-hidden bg-white">
          <div className="bg-gradient-to-r from-[#11CCEF]/10 to-[#E51791]/10 px-4 py-3 border-b border-gray-100">
            <p className="font-bold text-gray-900 m-0">Course: {course.course_title}</p>
          </div>
          <div className="p-4 space-y-3 font-mono text-sm">
            {course.units.map((unit) => {
              const status = getUnitStatus(unit);
              const latest = unit.submissions?.[0];
              const gradeBy = getGradeByDate(latest?.submitted_at);
              const awaitingGrade =
                status.label === 'Awaiting Grade' || status.label === 'File Rejected';
              const rejectedFiles =
                latest?.files?.filter((f) => f.status === 'resubmit_requested') || [];
              const resubmittedFiles =
                latest?.files?.filter((f) => f.status === 'pending' && latest?.status === 'resubmit_requested') ||
                [];

              return (
                <div
                  key={unit.unit_id}
                  className="pl-3 border-l-2 border-gray-200 space-y-1"
                  style={{ borderColor: status.color }}
                >
                  <p className="m-0 font-semibold text-gray-900">
                    ├ {unitLabel(unit)} {status.icon} {status.label}
                  </p>
                  {unit.deadline && (
                    <p className="m-0 text-gray-600 text-xs pl-4">
                      │ 📅 Deadline: {formatDateGB(unit.deadline)}
                    </p>
                  )}
                  {latest?.submitted_at && (
                    <p className="m-0 text-gray-600 text-xs pl-4">
                      │ 📤 Submitted: {formatDateGB(latest.submitted_at)}
                    </p>
                  )}
                  {awaitingGrade && gradeBy && !latest?.graded_at && (
                    <p className="m-0 text-gray-600 text-xs pl-4">
                      │ Grade by: {formatDateGB(gradeBy)} (10 day rule)
                    </p>
                  )}
                  {latest?.graded_at ? (
                    <p className="m-0 text-gray-600 text-xs pl-4">
                      │ ✏️ Graded: {formatDateGB(latest.graded_at)}
                      {(latest.graded_by_name || unit.assessor_name) &&
                        ` by ${latest.graded_by_name || unit.assessor_name}`}
                    </p>
                  ) : awaitingGrade ? (
                    <p className="m-0 text-amber-700 text-xs pl-4">│ ✏️ Not graded yet</p>
                  ) : null}
                  {!latest?.graded_at && unit.assessor_name && awaitingGrade && (
                    <p className="m-0 text-gray-500 text-xs pl-4">
                      │ 👤 Assessor: {unit.assessor_name}
                    </p>
                  )}
                  {rejectedFiles.length > 0 && (
                    <div className="pl-4 mt-1 space-y-1">
                      {rejectedFiles.map((f) => (
                        <p key={f.id} className="m-0 text-xs text-red-700">
                          │ ⚠️ Rejected: {f.file_name}
                          {f.resubmit_feedback ? ` — ${f.resubmit_feedback}` : ''}
                        </p>
                      ))}
                    </div>
                  )}
                  {resubmittedFiles.length > 0 && (
                    <div className="pl-4 mt-1">
                      {resubmittedFiles.map((f) => (
                        <p key={f.id} className="m-0 text-xs text-blue-700">
                          │ 📎 Resubmitted: {f.file_name}
                        </p>
                      ))}
                    </div>
                  )}
                  {latest?.feedback && (
                    <p className="m-0 text-gray-600 text-xs pl-4 line-clamp-2">
                      │ 💬 {String(latest.feedback).slice(0, 120)}
                      {String(latest.feedback).length > 120 ? '…' : ''}
                    </p>
                  )}
                </div>
              );
            })}
            <p className="m-0 text-gray-400 text-xs">└ …</p>
          </div>
        </div>
      ))}
    </div>
  );
}
