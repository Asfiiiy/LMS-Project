'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { getApiUrl } from '@/app/utils/apiUrl';
import { showToast } from '@/app/components/Toast';
import { Skeleton } from '@/app/components/ui/Skeleton';

interface Submission {
  submission_id: number;
  submission_type: string;
  submitted_at: string;
  graded_at: string | null;
  pass_fail_result: string | null;
  feedback: string | null;
  assessor_name: string | null;
  files: { file_name: string; file_path: string; uploaded_at: string | null }[];
  is_resubmission: boolean;
}

interface Unit {
  unit_id: number;
  unit_code: string;
  unit_name: string;
  unit_number: number;
  final_result: string | null;
  submissions: Submission[];
}

interface Course {
  course_id: number;
  course_name: string;
  units: Unit[];
}

interface Student {
  id: number;
  name: string;
  email: string;
}

// Filter to only PASS units and submissions
function filterPassOnly(courses: Course[]): Course[] {
  return courses.map((c) => ({
    ...c,
    units: c.units
      .filter((u) => u.final_result === 'pass')
      .map((u) => ({
        ...u,
        submissions: u.submissions.filter((s) => s.pass_fail_result === 'pass')
      }))
      .filter((u) => u.submissions.length > 0)
  })).filter((c) => c.units.length > 0);
}

export default function ClaimManagerStudentPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const studentId = Number(params?.studentId);
  const courseId = searchParams?.get('courseId') ? Number(searchParams.get('courseId')) : null;

  const [student, setStudent] = useState<Student | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCourseTab, setActiveCourseTab] = useState<number | null>(null);
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('lms-token');
      const url = `${getApiUrl()}/api/claim-manager/student/${studentId}/submissions${courseId ? `?courseId=${courseId}` : ''}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) {
        setStudent(data.student);
        const c = data.courses || [];
        setCourses(c);
        if (c.length > 0) {
          setActiveCourseTab((prev) => {
            if (courseId && c.some((x: Course) => x.course_id === courseId)) return courseId;
            return prev ?? c[0].course_id;
          });
        }
      }
    } catch {
      showToast('Failed to load student data', 'error');
    } finally {
      setLoading(false);
    }
  }, [studentId, courseId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Styles for Word-pasted feedback (MsoNormal, align-center, etc.)
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'claim-manager-feedback-styles';
    style.textContent = `
      .formatted-feedback-claim-manager .MsoNormal { margin: 0 0 0.5em 0; }
      .formatted-feedback-claim-manager .align-center, .formatted-feedback-claim-manager .aligncenter,
      .formatted-feedback-claim-manager p.align-center, .formatted-feedback-claim-manager p.aligncenter,
      .formatted-feedback-claim-manager div.align-center, .formatted-feedback-claim-manager div.aligncenter,
      .formatted-feedback-claim-manager h1.align-center, .formatted-feedback-claim-manager h2.align-center,
      .formatted-feedback-claim-manager h3.align-center, .formatted-feedback-claim-manager h4.align-center { text-align: center; }
      .formatted-feedback-claim-manager .align-right, .formatted-feedback-claim-manager .alignright,
      .formatted-feedback-claim-manager p.align-right, .formatted-feedback-claim-manager div.align-right { text-align: right; }
      .formatted-feedback-claim-manager .align-left, .formatted-feedback-claim-manager .alignleft,
      .formatted-feedback-claim-manager p.align-left, .formatted-feedback-claim-manager div.align-left { text-align: left; }
      .formatted-feedback-claim-manager .align-justify, .formatted-feedback-claim-manager .alignjustify { text-align: justify; }
      .formatted-feedback-claim-manager ul, .formatted-feedback-claim-manager ol { margin: 0.5em 0; padding-left: 1.5em; }
      .formatted-feedback-claim-manager li { margin: 0.25em 0; }
    `;
    if (!document.getElementById('claim-manager-feedback-styles')) {
      document.head.appendChild(style);
    }
    return () => {
      const el = document.getElementById('claim-manager-feedback-styles');
      if (el) el.remove();
    };
  }, []);

  const downloadFile = useCallback(async (url: string, filename: string, key: string) => {
    setDownloading(key);
    try {
      const token = localStorage.getItem('lms-token');
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
      showToast('Download started', 'success');
    } catch {
      showToast('Download failed', 'error');
    } finally {
      setDownloading(null);
    }
  }, []);

  const handleDownloadUnit = (unit: Unit) => {
    const url = `${getApiUrl()}/api/claim-manager/student/${studentId}/download-unit/${unit.unit_id}`;
    const unitNum = String(unit.unit_number).padStart(2, '0');
    downloadFile(url, `Unit_${unitNum}_${student?.name || 'Student'}.zip`, `unit-${unit.unit_id}`);
  };

  const handleDownloadAll = () => {
    const url = `${getApiUrl()}/api/claim-manager/student/${studentId}/download-all${courseId ? `?courseId=${courseId}` : ''}`;
    downloadFile(url, `${student?.name || 'Student'}_Complete.zip`, 'all');
  };

  const handleDownloadCsv = () => {
    const url = `${getApiUrl()}/api/claim-manager/student/${studentId}/report-csv${courseId ? `?courseId=${courseId}` : ''}`;
    downloadFile(url, `${student?.name || 'Student'}_Report.csv`, 'csv');
  };

  const stripHtml = (html: string) => {
    if (!html) return '';
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  const downloadFeedbackAsTxt = (unit: Unit, feedback: string, courseName: string) => {
    const unitNum = String(unit.unit_number).padStart(2, '0');
    const plainText = stripHtml(feedback);
    const content = `Unit ${unitNum} - ${unit.unit_name}\nStudent: ${student?.name || 'Student'}\nCourse: ${courseName}\nAssessed: ${formatDate(unit.submissions[0]?.graded_at)}\nAssessor: ${unit.submissions[0]?.assessor_name || '—'}\n\n--- FEEDBACK ---\n\n${plainText}`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Unit_${unitNum}_Feedback.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast('Feedback downloaded as .txt', 'success');
  };

  const downloadFeedbackAsDocx = async (unit: Unit, feedback: string, courseName: string) => {
    try {
      const mod = await import('html-docx-js/dist/html-docx.js');
      const htmlDocx = mod.default ?? mod;
      const unitNum = String(unit.unit_number).padStart(2, '0');
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family: Arial, sans-serif; padding: 20px;"><h2>Unit ${unitNum} - ${unit.unit_name}</h2><p><strong>Student:</strong> ${student?.name || 'Student'}</p><p><strong>Course:</strong> ${courseName}</p><p><strong>Assessed:</strong> ${formatDate(unit.submissions[0]?.graded_at)}</p><p><strong>Assessor:</strong> ${unit.submissions[0]?.assessor_name || '—'}</p><hr><h3>Feedback</h3><div>${feedback || ''}</div></body></html>`;
      const blob = htmlDocx.asBlob(html);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Unit_${unitNum}_Feedback.docx`;
      link.click();
      URL.revokeObjectURL(link.href);
      showToast('Feedback downloaded as .docx', 'success');
    } catch {
      showToast('Word download failed. Use .txt instead.', 'error');
    }
  };

  const toggleUnit = (key: string) => {
    setExpandedUnits((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading || !student) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const displayCourses = courseId ? courses.filter((c) => c.course_id === courseId) : courses;
  const passOnlyCourses = filterPassOnly(displayCourses);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{student.name}</h2>
          <p className="text-gray-600">{student.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleDownloadAll}
            disabled={!!downloading}
            className="px-4 py-2 rounded-lg font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: '#0f172a' }}
          >
            {downloading === 'all' ? 'Downloading...' : 'Download All'}
          </button>
          <button
            onClick={handleDownloadCsv}
            disabled={!!downloading}
            className="px-4 py-2 rounded-lg font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: '#11CCEF' }}
          >
            {downloading === 'csv' ? 'Downloading...' : 'Download CSV'}
          </button>
        </div>
      </div>

      {/* Info: Only PASS units shown */}
      {passOnlyCourses.length > 0 && (
        <div className="bg-[#f0fdf4] border border-[#16a34a]/30 rounded-lg px-4 py-2 text-sm text-[#16a34a]">
          Showing only units graded <strong>PASS</strong>. REFER and pending are hidden. Use &quot;Download All&quot; for complete files.
        </div>
      )}

      {/* Course tabs */}
      {passOnlyCourses.length > 1 && (
        <div className="flex gap-2 border-b border-gray-200">
          {passOnlyCourses.map((c) => (
            <button
              key={c.course_id}
              onClick={() => setActiveCourseTab(c.course_id)}
              className={`px-4 py-2 font-medium border-b-2 -mb-px transition-colors ${
                activeCourseTab === c.course_id
                  ? 'border-[#11CCEF] text-[#11CCEF]'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {c.course_name}
            </button>
          ))}
        </div>
      )}

      {/* Units accordion - PASS only */}
      {passOnlyCourses.map((course) => (
        <div key={course.course_id} className={activeCourseTab !== course.course_id ? 'hidden' : ''}>
          {course.units.map((unit) => {
            const key = `${course.course_id}-${unit.unit_id}`;
            const isExpanded = expandedUnits.has(key);
            const passSub = unit.submissions[0];
            return (
              <div key={key} className="bg-white rounded-xl border border-gray-200 shadow-sm mb-4 overflow-hidden">
                <button
                  onClick={() => toggleUnit(key)}
                  className="w-full flex flex-wrap items-center justify-between gap-4 p-4 text-left hover:bg-gray-50/50"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-medium text-gray-900">
                      Unit {String(unit.unit_number).padStart(2, '0')} | {unit.unit_code} | {unit.unit_name}
                    </span>
                    <span className="px-2 py-0.5 rounded text-sm bg-[#f0fdf4] text-[#16a34a]">✅ PASS</span>
                    <span className="text-sm text-gray-500">
                      Submitted: {formatDate(passSub?.submitted_at)} | Assessed: {formatDate(passSub?.graded_at)} by {passSub?.assessor_name || '—'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDownloadUnit(unit); }}
                      disabled={!!downloading}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                      style={{ backgroundColor: '#0f172a' }}
                    >
                      {downloading === `unit-${unit.unit_id}` ? '...' : 'Download Unit ZIP'}
                    </button>
                    <svg className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {isExpanded && passSub && (
                  <div className="border-t border-gray-100 p-4 bg-gray-50/30">
                    <div className="mb-4 p-4 bg-white rounded-lg border border-gray-100">
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="font-medium">{passSub.submission_type === 'assignment' ? 'Assignment' : 'Presentation'}</span>
                        <span className="text-sm text-gray-500">Submitted: {formatDate(passSub.submitted_at)}</span>
                        <span className="text-sm text-gray-500">Assessed by: {passSub.assessor_name || '—'} on {formatDate(passSub.graded_at)}</span>
                      </div>
                      {passSub.files.length > 0 && (
                        <div className="mb-4">
                          <p className="text-sm font-medium text-gray-600 mb-2">Submitted files (PASS):</p>
                          <div className="flex flex-wrap gap-2">
                            {passSub.files.map((f) => (
                              <a
                                key={f.file_path}
                                href={f.file_path}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-medium"
                              >
                                {f.file_name} <span className="text-[#11CCEF]">↗ View / Download</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                      {passSub.feedback && (
                        <div className="mb-0">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <p className="font-medium text-gray-700">Assessor feedback</p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => downloadFeedbackAsTxt(unit, passSub.feedback ?? '', course.course_name)}
                                className="px-2 py-1 rounded text-xs font-medium bg-gray-200 hover:bg-gray-300 text-gray-700"
                              >
                                Download .txt
                              </button>
                              <button
                                onClick={() => downloadFeedbackAsDocx(unit, passSub.feedback ?? '', course.course_name)}
                                className="px-2 py-1 rounded text-xs font-medium bg-gray-200 hover:bg-gray-300 text-gray-700"
                              >
                                Download .docx
                              </button>
                            </div>
                          </div>
                          <div
                            className="formatted-feedback-claim-manager p-4 rounded-lg bg-[#f0fdf4] border border-[#16a34a]/20 text-gray-800 text-sm leading-relaxed max-h-64 overflow-y-auto [&_p]:mb-2 [&_ul]:list-disc [&_ol]:list-decimal [&_li]:ml-4"
                            dangerouslySetInnerHTML={{ __html: passSub.feedback ?? '' }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {passOnlyCourses.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
          {displayCourses.length === 0
            ? 'No submissions found for this student.'
            : 'No units graded PASS yet. Only PASS units are shown here. Use "Download All" for complete files.'}
        </div>
      )}
    </div>
  );
}
