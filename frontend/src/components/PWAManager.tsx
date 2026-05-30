'use client';
import { useEffect, useState, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'reelget_pwa_dismissed_at';
const INSTALLED_KEY = 'reelget_pwa_installed';
// Don't re-nag for 7 days after a dismissal.
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

/** True when the app is already running as an installed PWA. */
function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/** True for iOS Safari, which never fires beforeinstallprompt. */
function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  const iOSDevice = /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS reports as Mac but has touch
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /^((?!chrome|crios|fxios|android).)*safari/i.test(ua);
  return iOSDevice && isSafari;
}

function recentlyDismissed(): boolean {
  try {
    if (localStorage.getItem(INSTALLED_KEY)) return true;
    const ts = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return ts > 0 && Date.now() - ts < SNOOZE_MS;
  } catch {
    return false;
  }
}

export default function PWAManager() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);

  // Register SW + capture the native install prompt (but DON'T show it yet).
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    if (isStandalone()) {
      try { localStorage.setItem(INSTALLED_KEY, '1'); } catch { /* ignore */ }
      return;
    }
    setIos(isIOS());

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      try { localStorage.setItem(INSTALLED_KEY, '1'); } catch { /* ignore */ }
      setShow(false);
      // Best-effort install tracking.
      try {
        const base = process.env.NEXT_PUBLIC_API_URL || '';
        if (base) fetch(`${base}/api/track`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ page: 'pwa_installed' }),
        }).catch(() => {});
      } catch { /* ignore */ }
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  // Reveal the banner at the peak-value moment: right after a successful download.
  useEffect(() => {
    const onSuccess = () => {
      if (isStandalone() || recentlyDismissed()) return;
      // Only show if we can actually install: native prompt OR iOS instructions.
      if (!prompt && !isIOS()) return;
      // Small delay so it appears just after the result card renders.
      setTimeout(() => setShow(true), 1200);
    };
    window.addEventListener('reelget:download-success', onSuccess);
    return () => window.removeEventListener('reelget:download-success', onSuccess);
  }, [prompt]);

  const dismiss = useCallback(() => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
    setShow(false);
  }, []);

  const install = useCallback(async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') {
      try { localStorage.setItem(INSTALLED_KEY, '1'); } catch { /* ignore */ }
      setShow(false);
    } else {
      dismiss();
    }
  }, [prompt, dismiss]);

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-teal-500 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="text-white font-black text-lg">R</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold leading-tight">Install ReelGet</p>
            <p className="text-slate-400 text-xs">
              {ios ? 'Add to your Home Screen for 1-tap downloads' : 'Add to home screen — faster, works offline'}
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={dismiss}
              className="text-slate-500 hover:text-slate-300 text-xs px-2 py-1 transition"
            >
              Not now
            </button>
            {!ios && (
              <button
                onClick={install}
                className="bg-gradient-to-r from-cyan-500 to-teal-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:opacity-90 transition"
              >
                Install
              </button>
            )}
          </div>
        </div>

        {/* iOS has no native install prompt — show the manual steps instead. */}
        {ios && (
          <div className="mt-3 pt-3 border-t border-slate-700 text-slate-300 text-xs leading-relaxed">
            Tap the <span className="font-semibold">Share</span> icon
            {' '}<span aria-hidden>⬆️</span>{' '}
            below, then choose <span className="font-semibold">“Add to Home Screen”</span>.
          </div>
        )}
      </div>
    </div>
  );
}
