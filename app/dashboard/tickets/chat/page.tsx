'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function TicketsChatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('from', 'tickets');
    const conversation = searchParams.get('conversation');
    if (conversation) params.set('conversation', conversation);
    router.replace(`/chat?${params.toString()}`);
  }, [router, searchParams]);

  return (
    <div className="flex items-center justify-center min-h-[300px]">
      <p className="text-gray-500">Redirecting to chat...</p>
    </div>
  );
}

export default function TicketsChatPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[300px]"><p className="text-gray-500">Loading...</p></div>}>
      <TicketsChatContent />
    </Suspense>
  );
}
