'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiService } from '@/app/services/api';
import { User, UserRole } from '@/app/components/types';

interface CourseDetailResponse {
  success: boolean;
  course: any;
  files: any[];
  assignments: any[];
  quizzes: any[];
}

interface UnitProgress {
  isUnlocked: boolean;
  unlockedAt: string | null;
  isCompleted: boolean;
  completedAt: string | null;
  unlockMethod: string | null;
}

const CourseDetailPage = () => {
  const params = useParams();
  const router = useRouter();
  const courseId = Number(params?.id);
  const [data, setData] = useState<CourseDetailResponse | null>(null);
  const [outline, setOutline] = useState<any>({ units: [] });
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [pdfSrc, setPdfSrc] = useState<string>('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [unitProgress, setUnitProgress] = useState<Map<number, UnitProgress>>(new Map());
  const [progressLoading, setProgressLoading] = useState(false);

  const isStudent = useMemo(
    () => userRole === 'Student' || userRole === 'ManagerStudent' || userRole === 'InstituteStudent',
    [userRole]
  );

  const isIntroUnitClient = (unit: any) => {
    if (!unit) return false;
    const orderIndex = Number(unit.order_index ?? 0);
    if (Number.isFinite(orderIndex) && orderIndex <= 0) {
      return true;
    }
    const title = String(unit.title || '').toLowerCase();
    return title.startsWith('intro') || title.includes('basic information');
  };

  const unlockedUnitIds = useMemo(() => {
    if (!outline?.units) return [];
    return outline.units
      .filter((u: any) => {
        const progress = unitProgress.get(u.id);
        return !isStudent || !progress || progress.isUnlocked;
      })
      .map((u: any) => u.id);
  }, [outline?.units, unitProgress, isStudent]);

  const allUnlockedExpanded =
    unlockedUnitIds.length > 0 && unlockedUnitIds.every((id: number) => expanded[id]);

  useEffect(() => {
    try {
      const stored: User | null = JSON.parse(localStorage.getItem('lms-user') || 'null');
      if (stored) {
        setUser(stored);
        setUserRole(stored.role || null);
      } else {
        setUser(null);
        setUserRole(null);
      }
    } catch (err) {
      console.error('Error parsing user from storage', err);
      setUser(null);
      setUserRole(null);
    }
  }, []);

  useEffect(() => {
    if (!courseId) return;
    (async () => {
      try {
        setLoading(true);
        const [res, ol] = await Promise.all([
          apiService.getCourseDetail(courseId),
          apiService.getCourseOutline(courseId)
        ]);
        if (res.success) {
          setData(res);
        } else {
          setError(res.message || 'Failed to load course');
        }
        if (ol.success) setOutline(ol);
      } catch (e) {
        setError('Failed to load course');
      } finally {
        setLoading(false);
      }
    })();
  }, [courseId]);

  useEffect(() => {
    const isStudent =
      userRole === 'Student' || userRole === 'ManagerStudent' || userRole === 'InstituteStudent';
    if (!isStudent || !user?.id || !courseId || !outline?.units?.length) {
      setUnitProgress(new Map());
      return;
    }

    let cancelled = false;
    const loadProgress = async () => {
      setProgressLoading(true);
      try {
        const response = await apiService.getStudentCourseUnits(user?.id!, courseId);
        if (cancelled) return;
        const map = new Map<number, UnitProgress>();
        (response?.units || []).forEach((unit: any) => {
          map.set(unit.id, {
            isUnlocked: !!unit.progress?.isUnlocked,
            unlockedAt: unit.progress?.unlockedAt || null,
            isCompleted: !!unit.progress?.isCompleted,
            completedAt: unit.progress?.completedAt || null,
            unlockMethod: unit.progress?.unlockMethod || null
          });
        });
        setUnitProgress(map);
      } catch (err) {
        console.error('Failed to load unit progress', err);
        if (!cancelled) {
          setUnitProgress(new Map());
        }
      } finally {
        if (!cancelled) {
          setProgressLoading(false);
        }
      }
    };

    loadProgress();
    return () => {
      cancelled = true;
    };
  }, [user?.id, userRole, courseId, outline?.units]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#11CCEF] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-gray-600 font-medium">Loading course content...</div>
        </div>
      </div>
    );
  }

  if (error || !data?.course) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto bg-white rounded-lg border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Course Not Available</h2>
          <p className="text-gray-600 mb-6">{error || 'The requested course could not be found.'}</p>
          <button
            onClick={() => router.back()}
            className="px-6 py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const { course, files, assignments, quizzes } = data;

  const getFileUrl = (file: any) => {
    let path = String(file.file_path || '').trim();
    if (path.includes('http://localhost:5000/http')) {
      path = path.replace('http://localhost:5000/', '');
    }
    if (path.startsWith('http://') || path.startsWith('https://')) {
      const fileName = String(file.file_name || file.title || '').toLowerCase();
      if (path.includes('cloudinary.com') && fileName.endsWith('.pdf') && path.includes('/image/upload/')) {
        path = path.replace('/image/upload/', '/raw/upload/');
      }
      return path;
    }
    return `http://localhost:5000/${path.replace(/^\//, '')}`;
  };

  const isPdfFile = (file: any) => {
    const filePath = String(file.file_path || '').toLowerCase();
    const fileName = String(file.file_name || file.title || '').toLowerCase();
    return filePath.endsWith('.pdf') || 
           fileName.endsWith('.pdf') || 
           (filePath.includes('cloudinary') && fileName.includes('.pdf'));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Course Header */}
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <div className="flex justify-between items-start mb-6">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">{course.title}</h1>
              <p className="text-gray-600 text-lg leading-relaxed mb-6">{course.description}</p>
              <div className="flex flex-wrap gap-3">
                <span className="px-4 py-2 bg-[#11CCEF] text-white rounded-lg text-sm font-medium">
                  {course.category_name || 'Uncategorized'}
                </span>
                <span className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  course.status === 'Active' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {course.status}
                </span>
                <span className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm">
                  Created by: {course.created_by_name}
                </span>
              </div>
            </div>
            <button
              onClick={() => router.back()}
              className="ml-6 px-6 py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors flex items-center gap-2"
            >
              <span>←</span>
              Back to Courses
            </button>
          </div>
        </div>

        {/* Course Introduction (if exists) */}
        {(course.intro_heading || outline?.course?.intro_heading || outline?.course?.intro_files?.length > 0) && (
          <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl border-2 border-purple-200 p-8">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="text-2xl font-bold text-purple-900">
                    {outline?.course?.intro_heading || course.intro_heading || 'Course Introduction'}
                  </h2>
                  <span className="px-3 py-1 bg-white text-purple-700 text-xs font-medium rounded-full border border-purple-300">
                    Always Available
                  </span>
                </div>
                {(outline?.course?.intro_subheading || course.intro_subheading) && (
                  <p className="text-lg font-semibold text-purple-700 mb-3">
                    {outline?.course?.intro_subheading || course.intro_subheading}
                  </p>
                )}
                {(outline?.course?.intro_content || course.intro_content) && (
                  <p className="text-purple-800 leading-relaxed whitespace-pre-wrap mb-4">
                    {outline?.course?.intro_content || course.intro_content}
                  </p>
                )}
                {outline?.course?.intro_files && outline.course.intro_files.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-purple-900 mb-2">📎 Introduction Materials:</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {outline.course.intro_files.map((file: any) => (
                        <button
                          key={file.id}
                          onClick={() => {
                            setPdfSrc(file.file_path);
                            setPdfLoading(true);
                            setPdfError(false);
                          }}
                          className="flex items-center gap-3 p-4 bg-white border-2 border-purple-200 rounded-lg hover:border-purple-400 hover:shadow-md transition-all group text-left"
                        >
                          <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-purple-900 truncate group-hover:text-purple-700">
                              {file.file_name}
                            </p>
                            <p className="text-xs text-purple-600">Click to view inline</p>
                          </div>
                          <svg className="w-5 h-5 text-purple-400 group-hover:text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Course Content */}
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Course Content</h2>
              {isStudent && (
                <p className="text-sm text-gray-500 mt-1">
                  Complete each unit to unlock the next section of the course.
                </p>
              )}
              {progressLoading && (
                <p className="text-sm text-[#11CCEF] mt-1">Checking your access…</p>
              )}
            </div>
            <button
              onClick={() => {
                const newExpanded: Record<number, boolean> = {};
                outline.units?.forEach((u: any) => {
                  const progress = unitProgress.get(u.id);
                  const canOpen = !isStudent || !progress || progress.isUnlocked;
                  newExpanded[u.id] = canOpen && !allUnlockedExpanded;
                });
                setExpanded(newExpanded);
              }}
              className="px-5 py-2.5 bg-[#11CCEF] text-white rounded-lg font-medium hover:bg-[#0daed9] transition-colors"
            >
              {allUnlockedExpanded ? 'Collapse All' : 'Expand All'}
            </button>
          </div>

          {outline.units?.length ? (
            <div className="space-y-4">
              {outline.units.map((unit: any) => {
                const progress = unitProgress.get(unit.id);
                const isIntro = isIntroUnitClient(unit);
                const hasProgress = progress !== undefined;
                const isUnlocked = !isStudent || isIntro || !hasProgress || !!progress?.isUnlocked;
                const isCompleted = hasProgress ? !!progress?.isCompleted : false;
                const canExpand = !isStudent || isIntro || isUnlocked;

                return (
                  <div
                    key={unit.id}
                    className={`border border-gray-200 rounded-xl overflow-hidden transition-colors ${
                      canExpand ? 'hover:border-gray-300' : 'opacity-60'
                    }`}
                  >
                    <button
                      onClick={() => canExpand && setExpanded(prev => ({ ...prev, [unit.id]: !prev[unit.id] }))}
                      disabled={!canExpand}
                      className={`w-full text-left p-6 flex justify-between items-center transition-colors ${
                        canExpand ? 'bg-white hover:bg-gray-50' : 'bg-gray-100 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center font-semibold ${
                            isCompleted ? 'bg-green-500 text-white' : 'bg-[#11CCEF] text-white'
                          }`}
                        >
                          {unit.order || '•'}
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            {unit.title}
                            {isIntro && (
                              <span className="text-xs px-2 py-1 rounded-full bg-gray-200 text-gray-600 uppercase tracking-wide">
                                Introduction
                              </span>
                            )}
                            {isStudent && !isIntro && !isUnlocked && (
                              <span className="text-xs px-2 py-1 rounded-full bg-gray-200 text-gray-600 uppercase tracking-wide">
                                Locked
                              </span>
                            )}
                            {isStudent && !isIntro && isUnlocked && !isCompleted && (
                              <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 uppercase tracking-wide">
                                In Progress
                              </span>
                            )}
                            {isStudent && !isIntro && isCompleted && (
                              <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 uppercase tracking-wide">
                                Completed
                              </span>
                            )}
                          </h3>
                          <p className="text-sm text-gray-500 mt-1">
                            {[
                              unit.resources?.length > 0 && `${unit.resources.length} resource${unit.resources.length !== 1 ? 's' : ''}`,
                              unit.assignments?.length > 0 && `${unit.assignments.length} assignment${unit.assignments.length !== 1 ? 's' : ''}`,
                              unit.quizzes?.length > 0 && `${unit.quizzes.length} quiz${unit.quizzes.length !== 1 ? 'zes' : ''}`
                            ].filter(Boolean).join(' • ')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {progress?.unlockMethod === 'manual' && (
                          <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-700 uppercase tracking-wide">
                            Tutor Unlock
                          </span>
                        )}
                        <div className="text-2xl text-[#11CCEF] font-light">
                          {expanded[unit.id] ? '−' : '+'}
                        </div>
                      </div>
                    </button>

                    {expanded[unit.id] && (
                      <div className="border-t border-gray-200 bg-gray-50 p-6 space-y-6">
                        {canExpand ? (
                          <>
                            {unit.content && (
                              <div className="bg-white rounded-lg p-6 border border-gray-200">
                                <h4 className="font-semibold text-gray-900 mb-3">Unit Content</h4>
                                <div className="text-gray-700 leading-relaxed whitespace-pre-line">
                                  {unit.content}
                                </div>
                              </div>
                            )}

                            {unit.resources?.length > 0 && (
                              <div>
                                <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                  <span className="text-lg">📄</span>
                                  Learning Resources
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {unit.resources.map((resource: any) => (
                                    <div
                                      key={resource.id}
                                      className="bg-white rounded-lg border border-gray-200 p-4 flex justify-between items-center hover:shadow-sm transition-shadow"
                                    >
                                      <div className="flex-1 min-w-0">
                                        <div className="font-medium text-gray-900 truncate">
                                          {resource.title || resource.file_name || 'Resource'}
                                        </div>
                                        <div className="text-sm text-gray-500 mt-1">
                                          {isPdfFile(resource) ? 'PDF Document' : 'Learning Asset'}
                                        </div>
                                      </div>
                                      {isPdfFile(resource) ? (
                                        <button
                                          onClick={() => {
                                            const url = getFileUrl(resource);
                                            setPdfSrc(url);
                                            setPdfLoading(true);
                                            setPdfError(false);
                                            setTimeout(() => setPdfLoading(false), 3000);
                                          }}
                                          className="ml-4 px-4 py-2 bg-[#11CCEF] text-white rounded-lg text-sm font-medium hover:bg-[#0daed9] transition-colors whitespace-nowrap"
                                        >
                                          View PDF
                                        </button>
                                      ) : (
                                        <a
                                          href={getFileUrl(resource)}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="ml-4 px-4 py-2 bg-[#11CCEF] text-white rounded-lg text-sm font-medium hover:bg-[#0daed9] transition-colors whitespace-nowrap"
                                        >
                                          Open Resource
                                        </a>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {unit.assignments?.length > 0 && (
                              <div>
                                <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                  <span className="text-lg">📝</span>
                                  Assignments
                                </h4>
                                <div className="space-y-4">
                                  {unit.assignments.map((assignment: any) => (
                                    <div
                                      key={assignment.id}
                                      className="bg-white rounded-lg border border-gray-200 p-5"
                                    >
                                      <div className="flex justify-between items-start mb-3">
                                        <div>
                                          <h5 className="font-semibold text-gray-900">{assignment.title}</h5>
                                          {assignment.description && (
                                            <p className="text-gray-600 mt-1">{assignment.description}</p>
                                          )}
                                        </div>
                                        <span className="px-3 py-1 bg-[#E51791] text-white rounded-full text-sm font-medium">
                                          Assignment
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-4">
                                        <label className="text-sm text-gray-700 font-medium">
                                          Submit your work:
                                        </label>
                                        <input
                                          type="file"
                                          className="text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                                          onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            const storedUser = JSON.parse(localStorage.getItem('lms-user') || 'null');
                                            if (!storedUser?.id) {
                                              alert('Please login to submit assignments');
                                              return;
                                            }
                                            try {
                                              const res = await apiService.submitAssignment(assignment.id, storedUser.id, file);
                                              if (res.success) {
                                                alert('Assignment submitted successfully!');
                                                e.target.value = '';
                                              } else {
                                                alert('Failed to submit assignment');
                                              }
                                            } catch (error) {
                                              alert('Error submitting assignment');
                                            }
                                          }}
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {unit.quizzes?.length > 0 && (
                              <div>
                                <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                  <span className="text-lg">❓</span>
                                  Quizzes
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {unit.quizzes.map((quiz: any) => (
                                    <div
                                      key={quiz.id}
                                      className="bg-white rounded-lg border border-gray-200 p-5 flex justify-between items-center hover:shadow-sm transition-shadow"
                                    >
                                      <div>
                                        <h5 className="font-semibold text-gray-900">{quiz.title}</h5>
                                        <p className="text-sm text-gray-500 mt-1">Test your knowledge</p>
                                      </div>
                                      <a
                                        href={`/quizzes/${quiz.id}`}
                                        className="px-4 py-2 bg-[#E51791] text-white rounded-lg font-medium hover:bg-[#c3147f] transition-colors whitespace-nowrap"
                                      >
                                        Take Quiz
                                      </a>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {!unit.content && !unit.resources?.length && !unit.assignments?.length && !unit.quizzes?.length && (
                              <div className="text-center py-8 text-gray-500 bg-white rounded-lg border border-gray-200">
                                <div className="text-lg mb-2">No content available</div>
                                <p className="text-sm">This unit will be updated with learning materials soon.</p>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="bg-white rounded-lg border border-dashed border-gray-300 p-6 text-center">
                            <div className="text-4xl mb-3">🔒</div>
                            <h4 className="text-lg font-semibold text-gray-900 mb-2">Unit Locked</h4>
                            <p className="text-gray-600">
                              Complete the previous unit or request an unlock from your tutor to access this material.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <div className="text-4xl mb-4">📚</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Course Content Coming Soon</h3>
              <p className="text-gray-600">The course materials are being prepared and will be available shortly.</p>
            </div>
          )}
        </div>
      </div>

      {/* PDF Viewer Modal */}
      {pdfSrc && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-6xl h-[90vh] rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-white">
              <h3 className="font-semibold text-gray-900">Document Viewer</h3>
              <button
                onClick={() => setPdfSrc('')}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 bg-gray-100 relative">
              {pdfLoading && !pdfError && (
                <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 z-20">
                  <div className="text-center">
                    <div className="w-12 h-12 border-4 border-[#11CCEF] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600 font-medium">Loading document...</p>
                  </div>
                </div>
              )}
              
              <div className="w-full h-full">
                <iframe
                  key={pdfSrc}
                  src={
                    pdfSrc.includes('cloudinary.com')
                      ? `${apiService.baseUrlPublic}/admin/proxy-pdf?url=${encodeURIComponent(pdfSrc)}`
                      : pdfSrc
                  }
                  className="w-full h-full"
                  title="PDF Viewer"
                  allow="fullscreen"
                  style={{ border: 'none' }}
                  onLoad={() => {
                    setPdfLoading(false);
                    setPdfError(false);
                  }}
                  onError={() => {
                    setPdfLoading(false);
                    setPdfError(true);
                  }}
                />
              </div>

              {pdfError && (
                <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-95 z-10">
                  <div className="text-center p-8">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-2xl">⚠️</span>
                    </div>
                    <p className="text-lg font-medium text-gray-900 mb-4">
                      Unable to display document
                    </p>
                    <a
                      href={pdfSrc}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-6 py-3 bg-[#11CCEF] text-white rounded-lg font-medium hover:bg-[#0daed9] transition-colors inline-block"
                    >
                      Open in New Tab
                    </a>
                  </div>
                </div>
              )}

              <div className="absolute bottom-4 right-4 z-10">
                <a
                  href={pdfSrc}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors shadow-lg"
                  title="Open document in new tab"
                >
                  Open in New Tab
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseDetailPage;