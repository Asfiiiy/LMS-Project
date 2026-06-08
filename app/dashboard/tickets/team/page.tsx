'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getApiUrl } from '@/app/utils/apiUrl';
import { User } from '@/app/components/types';

export default function TeamPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [team, setTeam] = useState<{ id: number; name: string; email: string; role_name: string }[]>([]);
  const [available, setAvailable] = useState<{ id: number; name: string; email: string; role_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '' });

  useEffect(() => {
    const u: User | null = JSON.parse(localStorage.getItem('lms-user') || 'null');
    setUser(u);
    if (!u) {
      router.push('/login');
      return;
    }
    const role = u.role as string;
    const canManage = ['Operation Manager', 'Accounts Manager', 'Administrative Manager', 'Admission Manager'].includes(role);
    if (!canManage) {
      router.push('/dashboard/tickets');
      return;
    }
    fetchTeam();
    fetchAvailable();
  }, [router]);

  const fetchTeam = async () => {
    try {
      const res = await fetch(`${getApiUrl()}/api/tickets/team`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('lms-token')}` }
      });
      const data = await res.json();
      if (data.success) setTeam(data.team || []);
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailable = async () => {
    try {
      const res = await fetch(`${getApiUrl()}/api/tickets/team/available`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('lms-token')}` }
      });
      const data = await res.json();
      if (data.success) setAvailable(data.users || []);
    } catch (e) {
    }
  };

  const addToTeam = async (targetId: number) => {
    setAdding(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/tickets/team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('lms-token')}` },
        body: JSON.stringify({ user_id: targetId })
      });
      const data = await res.json();
      if (data.success) {
        await fetchTeam();
        await fetchAvailable();
      } else {
        alert(data.error || 'Failed to add');
      }
    } catch (e) {
      alert('Failed to add');
    } finally {
      setAdding(false);
    }
  };

  const removeFromTeam = async (targetId: number) => {
    if (!confirm('Remove this member from your team?')) return;
    try {
      const res = await fetch(`${getApiUrl()}/api/tickets/team/${targetId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('lms-token')}` }
      });
      const data = await res.json();
      if (data.success) {
        await fetchTeam();
        await fetchAvailable();
      } else {
        alert(data.error || 'Failed to remove');
      }
    } catch (e) {
      alert('Failed to remove');
    }
  };

  const createTeamMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim() || !createForm.email.trim() || !createForm.password) {
      alert('Name, email, and password are required');
      return;
    }
    if (createForm.password.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/tickets/team/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('lms-token')}` },
        body: JSON.stringify({
          name: createForm.name.trim(),
          email: createForm.email.trim().toLowerCase(),
          password: createForm.password
        })
      });
      const data = await res.json();
      if (data.success) {
        setCreateForm({ name: '', email: '', password: '' });
        await fetchTeam();
        await fetchAvailable();
        alert('Team member created. They can log in with the email and password you provided.');
      } else {
        alert(data.error || 'Failed to create team member');
      }
    } catch (e) {
      alert('Failed to create team member');
    } finally {
      setCreating(false);
    }
  };

  if (!user) return null;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">My Team</h1>
      <p className="text-sm text-gray-600 mb-6">
        Team members can claim and handle tickets in your department. They will see the same ticket list, chat, and history as you.
      </p>

      {loading ? (
        <div className="text-gray-500">Loading...</div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Current Team ({team.length})</h2>
            </div>
            {team.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">No team members yet. Add users from your department below.</div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {team.map((m) => (
                  <li key={m.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
                    <div>
                      <p className="font-medium text-gray-900">{m.name}</p>
                      <p className="text-sm text-gray-500">{m.email}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded">{m.role_name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromTeam(m.id)}
                      className="text-sm text-red-600 hover:text-red-800 font-medium"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Create Team Member</h2>
              <p className="text-xs text-gray-500 mt-1">Create a new user and add them to your team. They will have Team Member role and can only access tickets in your department (no Tutor/Forum/Admin access).</p>
            </div>
            <form onSubmit={createTeamMember} className="p-4 space-y-4">
              <div>
                <label htmlFor="create-name" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  id="create-name"
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#11CCEF]/50 focus:border-[#11CCEF]"
                  placeholder="Full name"
                  required
                />
              </div>
              <div>
                <label htmlFor="create-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  id="create-email"
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#11CCEF]/50 focus:border-[#11CCEF]"
                  placeholder="email@example.com"
                  required
                />
              </div>
              <div>
                <label htmlFor="create-password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  id="create-password"
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#11CCEF]/50 focus:border-[#11CCEF]"
                  placeholder="Min 6 characters"
                  minLength={6}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-2 text-sm font-medium text-white bg-[#11CCEF] rounded-lg hover:bg-[#11CCEF]/90 disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Team Member'}
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Add to Team</h2>
              <p className="text-xs text-gray-500 mt-1">Existing users in your department who can be added</p>
            </div>
            {available.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">No users available to add (all may already be in your team).</div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {available.map((u) => (
                  <li key={u.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
                    <div>
                      <p className="font-medium text-gray-900">{u.name}</p>
                      <p className="text-sm text-gray-500">{u.email}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded">{u.role_name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => addToTeam(u.id)}
                      disabled={adding}
                      className="px-3 py-1.5 text-sm font-medium text-[#11CCEF] border border-[#11CCEF] rounded-lg hover:bg-[#11CCEF]/10 disabled:opacity-50"
                    >
                      Add
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
