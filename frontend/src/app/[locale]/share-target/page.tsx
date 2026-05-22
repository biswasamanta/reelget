'use client';

/**
 * Web Share Target handler.
 *
 * When the user picks ReelGet from the Android share sheet, Chrome navigates to
 * /en/share-target?text={sharedUrl} (or ?url=... depending on the source app).
 * This page extracts the URL and immediately redirects to the home page with
 * the URL pre-filled via the ?url= query param, which DownloaderForm reads on
 * mount and auto-fills into the input.
 */

import { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function ShareHandler() {
  const params = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    // The shared content lands in 'text' (most apps) or 'url' (some browsers).
    // It might include surrounding text like "Check this out: https://..." so we
    // extract the first https:// URL found in the string.
    const raw = params.get('text') || params.get('url') || '';
    const match = raw.match(/https?:\/\/\S+/);
    const url = match ? match[0].replace(/[)>\]'"]+$/, '') : raw.trim();

    if (url) {
      router.replace(`/en?url=${encodeURIComponent(url)}`);
    } else {
      router.replace('/en');
    }
  }, [params, router]);

  return null;
}

export default function ShareTargetPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
      <div className="w-14 h-14 bg-gradient-to-br from-cyan-400 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
        <span className="text-white font-black text-2xl">R</span>
      </div>
      <p className="text-white text-sm font-medium">Opening in ReelGet…</p>
      <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      <Suspense>
        <ShareHandler />
      </Suspense>
    </div>
  );
}
