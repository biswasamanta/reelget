'use client';
import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAManager() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    // Capture install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function handleInstall() {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setPrompt(null);
    else setDismissed(true);
  }

  if (!prompt || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-teal-500 rounded-xl flex items-center justify-center flex-shrink-0">
          <span className="text-white font-black text-lg">R</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold leading-tight">Install ReelGet</p>
          <p className="text-slate-400 text-xs">Add to home screen for faster access</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => setDismissed(true)}
            className="text-slate-500 hover:text-slate-300 text-xs px-2 py-1 transition"
          >
            Not now
          </button>
          <button
            onClick={handleInstall}
            className="bg-gradient-to-r from-cyan-500 to-teal-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:opacity-90 transition"
          >
            Install
          </button>
        </div>
      </div>
    </div>
  );
}
