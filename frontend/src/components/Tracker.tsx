'use client';

import { useEffect } from 'react';

export default function Tracker({ page }: { page: string }) {
  useEffect(() => {
    const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    fetch(`${api}/api/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page }),
    }).catch(() => {});
  }, [page]);

  return null;
}
