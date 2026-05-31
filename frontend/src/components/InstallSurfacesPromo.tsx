'use client';
import { useEffect, useState } from 'react';

const DISMISS_KEY = 'reelget_promo_dismissed_at';
// Re-show at most once every 5 days so it nudges without nagging.
const SNOOZE_MS = 5 * 24 * 60 * 60 * 1000;

// Set NEXT_PUBLIC_EXTENSION_URL once the browser extension is published to a
// store — the extension card then appears automatically.
const EXTENSION_URL = process.env.NEXT_PUBLIC_EXTENSION_URL || '';
const TELEGRAM_URL = 'https://t.me/ReelGetBot';

/**
 * Post-download promo for the app's "sticky" install surfaces (Telegram bot +
 * browser extension). Shown inside the result card at the peak-value moment.
 * Dismissible with a 5-day snooze so returning users aren't nagged.
 */
export default function InstallSurfacesPromo() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const ts = Number(localStorage.getItem(DISMISS_KEY) || 0);
      if (!ts || Date.now() - ts >= SNOOZE_MS) setShow(true);
    } catch {
      setShow(true);
    }
  }, []);

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
    setShow(false);
  }

  function track(surface: string) {
    try {
      const base = process.env.NEXT_PUBLIC_API_URL || '';
      if (base) fetch(`${base}/api/track`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: `promo_click_${surface}` }),
      }).catch(() => {});
    } catch { /* ignore */ }
  }

  if (!show) return null;

  return (
    <div className="mt-3 rounded-xl border border-cyan-200 bg-gradient-to-r from-cyan-50 to-teal-50 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-semibold text-gray-700">
          ⚡ Download even faster next time
        </p>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="text-gray-400 hover:text-gray-600 text-sm leading-none px-1"
        >
          ✕
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <a
          href={TELEGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track('telegram')}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#229ED9] px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 transition"
        >
          <span aria-hidden>✈️</span> Get the Telegram bot
        </a>

        {EXTENSION_URL && (
          <a
            href={EXTENSION_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track('extension')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gray-800 px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 transition"
          >
            <span aria-hidden>🧩</span> Add the browser extension
          </a>
        )}
      </div>

      <p className="mt-1.5 text-[11px] text-gray-500">
        Paste a link in Telegram and get the download instantly — no need to open the site.
      </p>
    </div>
  );
}
