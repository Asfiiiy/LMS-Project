'use client';

import React, { useState, useEffect } from 'react';
import { apiService } from '@/app/services/api';

const AssessorStudentReports = () => {
  const [loading, setLoading] = useState(false);
  const [assessors, setAssessors] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedAssessor, setSelectedAssessor] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Load assessors on mount
  useEffect(() => {
    loadAssessors();
  }, []);

  // Load students when assessor is selected
  useEffect(() => {
    if (selectedAssessor) {
      loadStudents();
    }
  }, [selectedAssessor]);

  // Load activity logs, sessions, and summary when both assessor and student are selected
  useEffect(() => {
    if (selectedAssessor && selectedStudent) {
      loadActivityLogs();
      loadSummary();
    }
  }, [selectedAssessor, selectedStudent, dateFrom, dateTo]);

  const loadAssessors = async () => {
    try {
      const response = await fetch('/api/admin/tutors', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('lms-token')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setAssessors(data.tutors || []);
      }
    } catch (error) {
      // no-op
    }
  };

  const loadStudents = async () => {
    try {
      const response = await apiService.getAllStudents();
      if (response.success) {
        setStudents(response.students || []);
      }
    } catch (error) {
      // no-op
    }
  };

  const loadActivityLogs = async () => {
    try {
      setLoading(true);
      const response = await apiService.getAssessorStudentUnifiedLogs({
        assessorId: parseInt(selectedAssessor),
        studentId: parseInt(selectedStudent),
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        limit: 200
      });
      if (response.success) setActivityLogs(response.logs || []);
    } catch (error) {
      // no-op
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      const response = await apiService.getAssessorStudentSummary(
        parseInt(selectedAssessor),
        parseInt(selectedStudent)
      );
      if (response.success) {
        setSummary(response.summary);
      }
    } catch (error) {
      // no-op
    }
  };

  const formatDuration = (val: number | string | null) => {
    if (val === null || val === undefined || val === '-') return '-';
    if (typeof val === 'number') {
      if (val < 60) return `${val}s`;
      const minutes = Math.floor(val / 60);
      const secs = val % 60;
      return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
    }
    return String(val);
  };

  const downloadCSV = () => {
    const header = ['Date/Time', 'Action', 'Description', 'Course Name', 'Unit Name', 'File Name', 'Duration', 'Course ID', 'Unit ID', 'Opened At', 'Closed At'];
    const escape = (v: unknown) => {
      if (v == null || v === '-') return '';
      const s = String(v).replace(/"/g, '""');
      return `"${s}"`;
    };
    const rows = activityLogs.map((log) => [
      new Date(log.created_at).toLocaleString(),
      log.action ?? '',
      log.description ?? '',
      log.course_name ?? '-',
      log.unit_name ?? '-',
      log.file_name ?? '-',
      formatDuration(log.duration),
      log.course_id ?? '-',
      log.unit_id ?? '-',
      log.opened_at ?? '-',
      log.closed_at ?? '-'
    ].map(escape).join(','));
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `assessor_student_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-gradient-to-r from-[#11CCEF]/10 to-[#E51791]/10 rounded-2xl p-6 border-2 border-[#11CCEF]/20">
        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          🔍 Assessor-Student Activity
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Student: login, course view, unit view, assignment submit + file names. Assessor: file opened, file closed (duration), file downloaded, graded (Pass/Refer).
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Assessor Select */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Select Assessor
            </label>
            <select
              value={selectedAssessor}
              onChange={(e) => {
                setSelectedAssessor(e.target.value);
                setSelectedStudent('');
                setActivityLogs([]);
                setSummary(null);
              }}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#11CCEF] focus:border-transparent"
            >
              <option value="">-- Select Assessor --</option>
              {assessors.map(assessor => (
                <option key={assessor.id} value={assessor.id}>
                  {assessor.name} {assessor.parent_tutor_name ? `(→ ${assessor.parent_tutor_name})` : '(Main)'}
                </option>
              ))}
            </select>
          </div>

          {/* Student Select */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Select Student
            </label>
            <select
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
              disabled={!selectedAssessor}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#11CCEF] focus:border-transparent disabled:bg-gray-100"
            >
              <option value="">-- Select Student --</option>
              {students.map(student => (
                <option key={student.id} value={student.id}>
                  {student.name} ({student.email})
                </option>
              ))}
            </select>
          </div>

          {/* Date From */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Date From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#11CCEF] focus:border-transparent"
            />
          </div>

          {/* Date To */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Date To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#11CCEF] focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      {summary && selectedAssessor && selectedStudent && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="bg-white rounded-xl p-4 shadow border-2 border-blue-200">
            <div className="text-2xl font-bold text-blue-600">{summary.files_viewed || 0}</div>
            <div className="text-xs text-gray-600">Files Viewed</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow border-2 border-green-200">
            <div className="text-2xl font-bold text-green-600">{summary.files_downloaded || 0}</div>
            <div className="text-xs text-gray-600">Downloaded</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow border-2 border-purple-200">
            <div className="text-2xl font-bold text-purple-600">{summary.submissions_graded || 0}</div>
            <div className="text-xs text-gray-600">Graded</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow border-2 border-green-200">
            <div className="text-2xl font-bold text-green-600">{summary.passed_submissions || 0}</div>
            <div className="text-xs text-gray-600">Passed</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow border-2 border-red-200">
            <div className="text-2xl font-bold text-red-600">{summary.referred_submissions || 0}</div>
            <div className="text-xs text-gray-600">Referred</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow border-2 border-gray-200">
            <div className="text-2xl font-bold text-gray-600">{formatDuration(summary.total_time_seconds)}</div>
            <div className="text-xs text-gray-600">Total Time</div>
          </div>
        </div>
      )}

      {/* Log Report */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#11CCEF]"></div>
        </div>
      ) : activityLogs.length > 0 ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold text-gray-900">
              📋 Log Report ({activityLogs.length} entries)
            </h3>
            <button
              onClick={downloadCSV}
              className="px-4 py-2 bg-gradient-to-r from-[#11CCEF] to-[#E51791] text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
            >
              📥 Download CSV
            </button>
          </div>
          
          <div className="overflow-x-auto border-2 border-gray-200 rounded-xl shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-[#11CCEF]/20 to-[#E51791]/20">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Date/Time</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Action</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 min-w-[200px]">Description</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Course Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Unit Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">File Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Duration</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Course ID</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Unit ID</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Opened At</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Closed At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activityLogs.map((log, index) => (
                  <tr 
                    key={`${log.created_at}-${index}`}
                    className={`hover:bg-gray-50 ${
                      log.log_source === 'assessor' ? 'bg-blue-50/30' : ''
                    }`}
                  >
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        log.action?.includes('Assessor Opened') ? 'bg-blue-100 text-blue-800' :
                        log.action?.includes('Assessor Closed') ? 'bg-slate-100 text-slate-700' :
                        log.action?.includes('Assessor Downloaded') ? 'bg-green-100 text-green-800' :
                        log.action?.includes('Assessor Graded') ? 'bg-purple-100 text-purple-800' :
                        log.action === 'user_login' ? 'bg-slate-100 text-slate-700' :
                        log.action === 'student_course_view' ? 'bg-emerald-50 text-emerald-700' :
                        log.action === 'student_unit_view' ? 'bg-teal-50 text-teal-700' :
                        log.action === 'student_assignment_submitted' ? 'bg-amber-50 text-amber-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 max-w-xs truncate" title={log.description}>
                      {log.description}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap max-w-[150px] truncate" title={log.course_name}>
                      {log.course_name}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap max-w-[150px] truncate" title={log.unit_name}>
                      {log.unit_name}
                    </td>
                    <td className="px-4 py-3">
                      {log.file_name !== '-' ? (
                        <span className="px-2 py-1 bg-cyan-50 text-cyan-800 rounded text-xs font-medium">
                          📄 {log.file_name}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {formatDuration(log.duration)}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{log.course_id}</td>
                    <td className="px-4 py-3 text-gray-500">{log.unit_id}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {log.opened_at && log.opened_at !== '-' ? new Date(log.opened_at).toLocaleString() : (log.opened_at || '-')}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {log.closed_at && log.closed_at !== '-' ? new Date(log.closed_at).toLocaleString() : (log.closed_at || '-')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : selectedAssessor && selectedStudent ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📭</div>
          <p className="text-gray-500 text-lg">No activity logs found for this assessor-student pair</p>
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">👆</div>
          <p className="text-gray-500 text-lg">Select an assessor and student to view activity logs</p>
        </div>
      )}
    </div>
  );
};

export default AssessorStudentReports;
