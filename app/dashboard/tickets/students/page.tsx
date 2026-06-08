'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getApiUrl } from '@/app/utils/apiUrl';
import { User } from '@/app/components/types';
import { FiUser, FiMail, FiCalendar, FiEdit2, FiX, FiKey, FiEye, FiEyeOff } from 'react-icons/fi';
import SendMessageToStudentModal from '@/app/components/SendMessageToStudentModal';

interface Student {
  id: number;
  name: string;
  email: string;
  created_at: string;
}

export default function TicketsStudentsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState<Student | null>(null);
  const [editForm, setEditForm] = useState({ email: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showMessageModal, setShowMessageModal] = useState(false);

  useEffect(() => {
    const u: User | null = JSON.parse(localStorage.getItem('lms-user') || 'null');
    setUser(u);
    if (!u) { router.push('/login'); return; }
    if (u.role !== 'Accounts Manager') { router.push('/dashboard/tickets'); return; }
    fetchStudents();
  }, [router]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/tickets/students`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('lms-token')}` },
      });
      const data = await res.json();
      if (data.success) setStudents(data.students || []);
      else if (data.message === 'Access denied') router.push('/dashboard/tickets');
    } catch (e) { } finally { setLoading(false); }
  };

  const openEdit = (s: Student) => {
    setEditModal(s);
    setEditForm({ email: s.email, password: '' });
    setError(null);
  };

  const closeEdit = () => {
    setEditModal(null);
    setEditForm({ email: '', password: '' });
    setError(null);
    setShowNewPassword(false);
  };

  const saveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal) return;
    const payload: Record<string, string> = {};
    if (editForm.email.trim()) payload.email = editForm.email.trim();
    if (editForm.password) payload.password = editForm.password;
    if (Object.keys(payload).length === 0) { setError('Enter email and/or new password to update'); return; }
    if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) { setError('Invalid email format'); return; }
    if (payload.password && payload.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${getApiUrl()}/api/tickets/students/${editModal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('lms-token')}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) { closeEdit(); fetchStudents(); }
      else { setError(data.message || 'Update failed'); }
    } catch (e) { setError('Update failed'); } finally { setSaving(false); }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

  if (!user || user.role !== 'Accounts Manager') return null;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-[#11CCEF] to-[#E51791] bg-clip-text text-transparent">Students</h1>
        <p className="text-gray-600 mt-1">Manage student accounts. You can update email and reset passwords.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#11CCEF] mx-auto" />
            <p className="text-gray-500 mt-4">Loading students...</p>
          </div>
        ) : students.length === 0 ? (
          <div className="p-12 text-center">
            <FiUser className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No students found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Student</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {students.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#11CCEF] to-[#E51791] flex items-center justify-center text-white font-semibold text-sm">
                          {s.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                        <span className="font-medium text-gray-900">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{s.email}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <FiCalendar className="w-4 h-4" />
                        {formatDate(s.created_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStudent(s);
                            setShowMessageModal(true);
                          }}
                          title="Send message to student"
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-[#e51791] bg-pink-50 hover:bg-pink-100 rounded-lg border-0 cursor-pointer"
                        >
                          💬 Message
                        </button>
                        <button onClick={() => openEdit(s)} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-[#11CCEF] hover:text-[#E51791] hover:bg-[#11CCEF]/5 rounded-lg transition-colors">
                          <FiEdit2 className="w-4 h-4" />
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showMessageModal && selectedStudent && (
        <SendMessageToStudentModal
          studentId={selectedStudent.id}
          studentName={selectedStudent.name}
          open={showMessageModal}
          onClose={() => {
            setShowMessageModal(false);
            setSelectedStudent(null);
          }}
          onSuccess={(ticketId) => router.push(`/dashboard/tickets/${ticketId}`)}
        />
      )}

      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Edit Student: {editModal.name}</h2>
              <button onClick={closeEdit} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={saveCredentials} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <div className="relative">
                  <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#11CCEF] focus:border-[#11CCEF]" placeholder="student@example.com" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current password</label>
                <div className="relative">
                  <FiKey className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="text" readOnly value="••••••••" className="w-full pl-10 pr-12 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed" />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-not-allowed" title="Stored securely; cannot be retrieved or displayed.">
                    <FiEye className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Stored securely; cannot be displayed.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New password <span className="text-gray-500 font-normal">(leave blank to keep current)</span></label>
                <div className="relative">
                  <FiKey className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type={showNewPassword ? 'text' : 'password'} value={editForm.password} onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))} className="w-full pl-10 pr-12 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#11CCEF] focus:border-[#11CCEF]" placeholder="••••••••" />
                  <button type="button" onClick={() => setShowNewPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" title={showNewPassword ? 'Hide password' : 'Show password'}>
                    {showNewPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={closeEdit} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#11CCEF] to-[#E51791] text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed">{saving ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
