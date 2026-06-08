'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getApiUrl } from '@/app/utils/apiUrl';
import { User } from '@/app/components/types';

interface Category {
  value: string;
  department: string;
}

function NewTicketContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get('category') || '';
  const [user, setUser] = useState<User | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState(categoryParam);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const u: User | null = JSON.parse(localStorage.getItem('lms-user') || 'null');
    setUser(u);
    if (!u) router.push('/login');
  }, [router]);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${getApiUrl()}/api/tickets/categories`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('lms-token')}` }
      });
      const data = await res.json();
      if (data.success && data.categories) {
        const list = data.categories as Category[];
        setCategories(list);
        const match = categoryParam ? list.find((c: Category) => c.value.toLowerCase() === categoryParam.toLowerCase()) : null;
        if (match) {
          setCategory(match.value);
        } else if (list.length > 0) {
          setCategory(list[0].value);
        }
      }
    } catch (e) {
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !category) {
      setError('Subject and category are required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${getApiUrl()}/api/tickets`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('lms-token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subject: subject.trim(),
          category,
          message: message.trim() || undefined
        })
      });
      const data = await res.json();
      if (data.success) {
        router.push(`/dashboard/tickets/${data.ticketId}`);
      } else {
        setError(data.message || 'Failed to create ticket.');
      }
    } catch (e) {
      setError('Failed to create ticket. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href="/dashboard/tickets" className="text-[#11CCEF] hover:underline font-medium">
          ← Back to Tickets
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Create Support Ticket</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#11CCEF] focus:border-[#11CCEF]"
            >
              <option value="">Select category...</option>
              {categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.value} → {c.department}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief description of your issue"
              required
              maxLength={255}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#11CCEF] focus:border-[#11CCEF]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message (optional)</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Provide more details about your request..."
              rows={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#11CCEF] focus:border-[#11CCEF]"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-[#11CCEF] text-white rounded-lg font-semibold hover:bg-[#0daed9] disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Ticket'}
            </button>
            <Link
              href="/dashboard/tickets"
              className="px-6 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function NewTicketPage() {
  return (
    <Suspense fallback={<div className="p-6 flex items-center justify-center min-h-[300px]"><p className="text-gray-500">Loading...</p></div>}>
      <NewTicketContent />
    </Suspense>
  );
}
