'use client';
import { useEffect, useState, useCallback } from 'react';

const DISMISS_KEY = 'reelget_push_dismissed_at';
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000; // re-ask at most every 14 days
const API = process.env.NEXT_PUBLIC_API_URL || '';

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const buffer = new ArrayBuffer(raw.length);
  const arr = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function snoozed(): boolean {
  try {
    const ts = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return ts > 0 && Date.now() - ts < SNOOZE_MS;
  } catch {
    return false;
  }
}

/**
 * Opt-in prompt for web push. Targets installed (standalone) users only — the
 * highest-intent cohort, where push works on every platform incl. iOS, and which
 * never collides with the PWA install banner. Triggered after a download.
 */
export default function PushOptIn() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const eligible = useCallback(async (): Promise<boolean> => {
    if (!isStandalone()) return false;
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return false;
    if (Notification.permission !== 'default') return false; // already granted or denied
    if (snoozed()) return false;
    if (!API) return false;
    // Need a configured VAPID key on the backend.
    try {
      const r = await fetch(`${API}/api/push/vapid-public-key`);
      const j = await r.json();
      return !!j.key;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    const onSuccess = async () => {
      if (await eligible()) setTimeout(() => setShow(true), 2500);
    };
    window.addEventListener('reelget:download-success', onSuccess);
    return () => window.removeEventListener('reelget:download-success', onSuccess);
  }, [eligible]);

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
    setShow(false);
  }

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { dismiss(); return; }

      const keyResp = await fetch(`${API}/api/push/vapid-public-key`).then(r => r.json());
      if (!keyResp.key) { dismiss(); return; }

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(keyResp.key),
        });
      }
      await fetch(`${API}/api/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });
      // Best-effort tracking.
      fetch(`${API}/api/track`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: 'push_subscribed' }),
      }).catch(() => {});
      setShow(false);
    } catch {
      dismiss();
    } finally {
      setBusy(false);
    }
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-xl flex items-center justify-center flex-shrink-0">
          <span className="text-white text-lg">🔔</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold leading-tight">Get notified</p>
          <p className="text-slate-400 text-xs">New platforms, features &amp; trending — never miss an update.</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={dismiss}
            className="text-slate-500 hover:text-slate-300 text-xs px-2 py-1 transition"
          >
            No thanks
          </button>
          <button
            onClick={enable}
            disabled={busy}
            className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:opacity-90 transition disabled:opacity-60"
          >
            {busy ? '…' : 'Enable'}
          </button>
        </div>
      </div>
    </div>
  );
}
