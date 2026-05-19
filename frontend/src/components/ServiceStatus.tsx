'use client';

import { useEffect, useState } from 'react';

type Status = 'checking' | 'online' | 'offline';

export default function ServiceStatus() {
  const [status, setStatus] = useState<Status>('checking');
  const [retryIn, setRetryIn] = useState(0);

  function check() {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    fetch(`${apiBase}/health`, { cache: 'no-store' })
      .then((r) => setStatus(r.ok ? 'online' : 'offline'))
      .catch(() => setStatus('offline'));
  }

  useEffect(() => {
    check();
    // Re-check every 60 s
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Countdown timer while offline
  useEffect(() => {
    if (status !== 'offline') { setRetryIn(0); return; }
    setRetryIn(60);
    const tick = setInterval(() => setRetryIn((n) => (n > 0 ? n - 1 : 0)), 1000);
    return () => clearInterval(tick);
  }, [status]);

  if (status !== 'offline') return null;

  return (
    <div className="w-full bg-amber-500 text-slate-900 text-xs font-semibold px-4 py-2 flex items-center justify-center gap-3 z-50">
      <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse flex-shrink-0" />
      <span>
        Downloads are temporarily unavailable — our servers are recovering from an outage.
        {retryIn > 0 && <span className="ml-1 opacity-70">Rechecking in {retryIn}s…</span>}
      </span>
      <button
        onClick={() => { setStatus('checking'); check(); }}
        className="underline hover:no-underline flex-shrink-0"
      >
        Check now
      </button>
    </div>
  );
}
