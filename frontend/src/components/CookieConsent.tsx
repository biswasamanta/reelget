'use client';

import { useState, useEffect } from 'react';

const COOKIE_KEY = 'rg_cookie_consent';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show only if user hasn't already responded
    try {
      if (!localStorage.getItem(COOKIE_KEY)) {
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  const accept = () => {
    try { localStorage.setItem(COOKIE_KEY, 'accepted'); } catch { /* ignore */ }
    setVisible(false);
  };

  const decline = () => {
    try { localStorage.setItem(COOKIE_KEY, 'declined'); } catch { /* ignore */ }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6">
      <div className="max-w-3xl mx-auto bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl shadow-black/50 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold mb-1">🍪 We use cookies</p>
          <p className="text-slate-400 text-xs leading-relaxed">
            We use cookies to serve ads and analyse site traffic. By clicking &ldquo;Accept&rdquo; you consent to our use of cookies as described in our{' '}
            <a href="/en/privacy" className="text-teal-400 hover:underline">Privacy Policy</a>.
            You can decline non-essential cookies.
          </p>
        </div>
        <div className="flex gap-2 shrink-0 w-full sm:w-auto">
          <button
            onClick={decline}
            className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 transition"
          >
            Decline
          </button>
          <button
            onClick={accept}
            className="flex-1 sm:flex-none px-5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-cyan-500 to-teal-500 text-white hover:opacity-90 transition shadow-lg shadow-cyan-500/20"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
