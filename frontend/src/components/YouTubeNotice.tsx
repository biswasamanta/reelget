'use client';

import { useState } from 'react';

export default function YouTubeNotice() {
  const [dismissed, setDismissed] = useState(false);

  if (!process.env.NEXT_PUBLIC_YOUTUBE_NOTICE) return null;
  if (dismissed) return null;

  return (
    <div className="w-full bg-amber-500/10 border-b border-amber-400/20 px-4 py-2.5 flex items-center justify-between gap-3">
      <p className="text-amber-300 text-xs text-center flex-1">
        ⚠️ YouTube downloads are temporarily limited due to a platform restriction. Our team is working on a fix — please check back in a few hours.
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="text-amber-400/60 hover:text-amber-300 text-sm shrink-0 transition"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
