'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getApiUrl } from '@/app/utils/apiUrl';
import { showToast } from '@/app/components/Toast';
import { StatSkeleton, CardSkeleton } from '@/app/components/ui/Skeleton';
import { FiUsers, FiBook, FiCheckCircle, FiFileText, FiSearch, FiDownload } from 'react-icons/fi';

interface Stat {
  students_with_completed_units: number;
  total_qualification_courses: number;
  total_units_assessed_passed: number;
  total_assignments_submitted: number;
}

interface Student {
  student_id: number;
  student_name: string;
  email: string;
  course_id: number;
  course_name: string;
  total_units: number;
  passed_units: number;
  completion_percentage: number;
  last_completed_at: string | null;
  is_fully_complete: boolean;
}

interface Course {
  id: number;
  title: string;
}

const PAGE_SIZE_OPTIONS = [20, 50, 100, 200] as const;
type StatusFilter = 'all' | 'pass' | 'in_progress';

export default function ClaimManagerPage() {
  const [userName, setUserName] = useState<string>('');
  const [stats, setStats] = useState<Stat | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(20);
  const [sortBy, setSortBy] = useState<'name' | 'course' | 'completion'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    const u = localStorage.getItem('lms-user');
    if (u) {
      try {
        const user = JSON.parse(u);
        setUserName(user?.name || '');
      } catch {
        setUserName('');
      }
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const token = localStorage.getItem('lms-token');
      const res = await fetch(`${getApiUrl()}/api/claim-manager/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.stats) setStats(data.stats);
    } catch {
      setStats(null);
    }
  }, []);

  const fetchCourses = useCallback(async () => {
    try {
      const token = localStorage.getItem('lms-token');
      const res = await fetch(`${getApiUrl()}/api/claim-manager/courses`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.courses) setCourses(data.courses);
    } catch {
      setCourses([]);
    }
  }, []);

  const fetchStudents = useCallback(async () => {
    setStudentsLoading(true);
    try {
      const token = localStorage.getItem('lms-token');
      const params = new URLSearchParams();
      if (selectedCourse) params.set('courseId', selectedCourse);
      if (search) params.set('search', search);
      const res = await fetch(`${getApiUrl()}/api/claim-manager/completed-students?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.students) setStudents(data.students);
      else setStudents([]);
    } catch {
      setStudents([]);
    } finally {
      setStudentsLoading(false);
    }
  }, [selectedCourse, search]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchStats(), fetchCourses()]).finally(() => setLoading(false));
  }, [fetchStats, fetchCourses]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const downloadFile = useCallback(async (url: string, filename: string) => {
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
    }
  }, []);

  const handleDownloadAll = (s: Student) => {
    const url = `${getApiUrl()}/api/claim-manager/student/${s.student_id}/download-all${selectedCourse ? `?courseId=${selectedCourse}` : ''}`;
    downloadFile(url, `${s.student_name.replace(/[^a-zA-Z0-9_-]/g, '_')}_Complete.zip`);
  };

  const handleDownloadCsv = (s: Student) => {
    const url = `${getApiUrl()}/api/claim-manager/student/${s.student_id}/report-csv${selectedCourse ? `?courseId=${selectedCourse}` : ''}`;
    downloadFile(url, `${s.student_name.replace(/[^a-zA-Z0-9_-]/g, '_')}_Report.csv`);
  };

  const handleDownloadAllCsv = () => {
    const url = `${getApiUrl()}/api/claim-manager/report-csv${selectedCourse ? `?courseId=${selectedCourse}` : ''}`;
    const date = new Date().toISOString().slice(0, 10);
    downloadFile(url, `ClaimManager_Report_${date}.csv`);
  };

  const filtered = students.filter((s) => {
    if (statusFilter === 'pass') return s.is_fully_complete;
    if (statusFilter === 'in_progress') return !s.is_fully_complete;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'name') cmp = a.student_name.localeCompare(b.student_name);
    else if (sortBy === 'course') cmp = a.course_name.localeCompare(b.course_name);
    else cmp = a.completion_percentage - b.completion_percentage;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const paginated = pageSize === 'all'
    ? sorted
    : sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = pageSize === 'all' ? 1 : Math.ceil(sorted.length / pageSize) || 1;

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    const date = new Date(d);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#11CCEF] via-[#11CCEF] to-[#E51791] p-6 sm:p-8 shadow-xl">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.08\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-80" />
        <div className="relative">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            Welcome back, {userName || 'Claim Manager'}
          </h2>
          <p className="mt-1 text-white/90 text-sm sm:text-base">
            Manage qualification claims and student submissions
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          [1, 2, 3, 4].map((i) => <StatSkeleton key={i} />)
        ) : (
          <>
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#11CCEF]/10 text-[#11CCEF]">
                  <FiUsers className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Students with completed units</p>
                  <p className="text-2xl font-bold text-gray-900">{stats?.students_with_completed_units ?? 0}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#E51791]/10 text-[#E51791]">
                  <FiBook className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Qualification courses</p>
                  <p className="text-2xl font-bold text-gray-900">{stats?.total_qualification_courses ?? 0}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#16a34a]/10 text-[#16a34a]">
                  <FiCheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Units assessed (passed)</p>
                  <p className="text-2xl font-bold text-gray-900">{stats?.total_units_assessed_passed ?? 0}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-amber-500/10 text-amber-600">
                  <FiFileText className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Assignments submitted</p>
                  <p className="text-2xl font-bold text-gray-900">{stats?.total_assignments_submitted ?? 0}</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Filters & Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100 bg-gray-50/50">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by student name..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#11CCEF]/30 focus:border-[#11CCEF] outline-none bg-white"
              />
            </div>
            <select
              value={selectedCourse}
              onChange={(e) => { setSelectedCourse(e.target.value); setCurrentPage(1); }}
              className="px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#11CCEF]/30 focus:border-[#11CCEF] outline-none bg-white"
            >
              <option value="">All courses</option>
              {courses.map((c) => (
                <option key={c.id} value={String(c.id)}>{c.title}</option>
              ))}
            </select>
            <div className="flex gap-2">
              {(['all', 'pass', 'in_progress'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => { setStatusFilter(status); setCurrentPage(1); }}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    statusFilter === status
                      ? status === 'pass'
                        ? 'bg-[#16a34a] text-white shadow-sm'
                        : status === 'in_progress'
                          ? 'bg-[#c2410c] text-white shadow-sm'
                          : 'bg-[#11CCEF] text-white shadow-sm'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {status === 'all' ? 'All' : status === 'pass' ? '✅ Pass' : '🔄 In Progress'}
                </button>
              ))}
            </div>
            <select
              value={pageSize}
              onChange={(e) => {
                const v = e.target.value;
                setPageSize(v === 'all' ? 'all' : Number(v));
                setCurrentPage(1);
              }}
              className="px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#11CCEF]/30 focus:border-[#11CCEF] outline-none bg-white"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>Show {n}</option>
              ))}
              <option value="all">Show all</option>
            </select>
            <button
              onClick={handleDownloadAllCsv}
              className="px-4 py-2.5 rounded-xl text-white font-medium flex items-center gap-2 shadow-sm hover:shadow transition-shadow"
              style={{ backgroundColor: '#11CCEF' }}
            >
              <FiDownload className="w-4 h-4" />
              Download All CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {studentsLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => <CardSkeleton key={i} />)}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-gray-100/80 border-b border-gray-200">
                  <th className="text-left py-4 px-5 font-semibold text-gray-700">
                    <button onClick={() => { setSortBy('name'); setSortDir(sortBy === 'name' && sortDir === 'asc' ? 'desc' : 'asc'); }} className="hover:text-[#11CCEF] transition-colors">
                      Student Name {sortBy === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
                    </button>
                  </th>
                  <th className="text-left py-4 px-5 font-semibold text-gray-700">
                    <button onClick={() => { setSortBy('course'); setSortDir(sortBy === 'course' && sortDir === 'asc' ? 'desc' : 'asc'); }} className="hover:text-[#11CCEF] transition-colors">
                      Course {sortBy === 'course' && (sortDir === 'asc' ? '↑' : '↓')}
                    </button>
                  </th>
                  <th className="text-left py-4 px-5 font-semibold text-gray-700">Units Passed</th>
                  <th className="text-left py-4 px-5 font-semibold text-gray-700">
                    <button onClick={() => { setSortBy('completion'); setSortDir(sortBy === 'completion' && sortDir === 'asc' ? 'desc' : 'asc'); }} className="hover:text-[#11CCEF] transition-colors">
                      Completion % {sortBy === 'completion' && (sortDir === 'asc' ? '↑' : '↓')}
                    </button>
                  </th>
                  <th className="text-left py-4 px-5 font-semibold text-gray-700">Last Activity</th>
                  <th className="text-left py-4 px-5 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr><td colSpan={6} className="py-16 text-center text-gray-500">No students found</td></tr>
                ) : (
                  paginated.map((s) => (
                    <tr key={`${s.student_id}-${s.course_id}`} className="border-b border-gray-100 hover:bg-[#11CCEF]/5 transition-colors">
                      <td className="py-4 px-5 font-medium text-gray-900">{s.student_name}</td>
                      <td className="py-4 px-5 text-gray-600">{s.course_name}</td>
                      <td className="py-4 px-5 text-gray-600">{s.passed_units} / {s.total_units}</td>
                      <td className="py-4 px-5">
                        <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                          s.is_fully_complete ? 'bg-[#f0fdf4] text-[#16a34a] border border-[#16a34a]/20' : 'bg-[#fff7ed] text-[#c2410c] border border-[#c2410c]/20'
                        }`}>
                          {s.is_fully_complete ? '✅ Fully Complete' : '🔄 In Progress'} ({s.completion_percentage}%)
                        </span>
                      </td>
                      <td className="py-4 px-5 text-gray-600">{formatDate(s.last_completed_at)}</td>
                      <td className="py-4 px-5">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/dashboard/claim-manager/students/${s.student_id}${selectedCourse ? `?courseId=${selectedCourse}` : ''}`}
                            className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-[#0f172a] hover:bg-[#1e293b] transition-colors"
                          >
                            View Details
                          </Link>
                          <button
                            onClick={() => handleDownloadAll(s)}
                            className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-[#0f172a] hover:bg-[#1e293b] transition-colors"
                          >
                            Download All
                          </button>
                          <button
                            onClick={() => handleDownloadCsv(s)}
                            className="px-3 py-1.5 rounded-lg text-sm font-medium text-white hover:opacity-90 transition-opacity"
                            style={{ backgroundColor: '#11CCEF' }}
                          >
                            Download CSV
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {!studentsLoading && sorted.length > 0 && (
          <div className="p-4 border-t border-gray-100 bg-gray-50/30 flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-gray-600">
              Showing <span className="font-medium text-gray-900">{paginated.length}</span> of <span className="font-medium text-gray-900">{sorted.length}</span> students
              {pageSize !== 'all' && (
                <span className="ml-1 text-gray-500">· Page {currentPage} of {totalPages}</span>
              )}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1 || pageSize === 'all'}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white hover:border-[#11CCEF]/50 transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || pageSize === 'all'}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white hover:border-[#11CCEF]/50 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
