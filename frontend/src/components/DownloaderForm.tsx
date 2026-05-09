'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';

type DownloadResult = {
  title: string;
  thumbnail?: string;
  formats: { label: string; url: string; ext: string }[];
};

export default function DownloaderForm({ locale }: { locale: string }) {
  const t = useTranslations();
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<DownloadResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const customUrl = (e as CustomEvent<string>).detail;
      setUrl(customUrl);
      setStatus('idle');
      setResult(null);
    };
    window.addEventListener('fill-url', handler);
    return () => window.removeEventListener('fill-url', handler);
  }, []);

  const isValidUrl = (val: string) =>
    /instagram\.com|youtube\.com|youtu\.be|facebook\.com|fb\.watch|tiktok\.com|vm\.tiktok\.com/.test(val);

  async function handleDownload() {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (!isValidUrl(trimmed)) {
      setStatus('error');
      setErrorMsg(t('result.invalid_url'));
      return;
    }
    setStatus('loading');
    setResult(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const detail: string = errData.detail || '';
        // Strip yt-dlp noise like "ERROR: [youtube] abc123: "
        const cleaned = detail.replace(/^ERROR:\s*\[[^\]]+\]\s*[\w-]+:\s*/i, '').trim();
        // Strip everything from "Use --cookies" onwards (technical yt-dlp instructions)
        const trimmed = cleaned.replace(/\s*Use --cookies[\s\S]*$/i, '').trim();
        // Map known patterns to friendly messages
        let friendly = trimmed;
        if (/sign in|bot|confirm/i.test(trimmed)) {
          friendly = 'This video requires sign-in to access. Please try a different video.';
        } else if (/unavailable|not available/i.test(trimmed)) {
          friendly = 'This video is unavailable or restricted in this region.';
        } else if (/private/i.test(trimmed)) {
          friendly = 'This video is private and cannot be downloaded.';
        } else if (/age/i.test(trimmed)) {
          friendly = 'This video is age-restricted and cannot be downloaded without sign-in.';
        }
        setStatus('error');
        setErrorMsg(friendly || t('result.error'));
        return;
      }
      const data = await res.json();
      setResult(data);
      setStatus('success');
    } catch {
      setStatus('error');
      setErrorMsg(t('result.error'));
    }
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text);
      inputRef.current?.focus();
    } catch {
      inputRef.current?.focus();
    }
  }

  return (
    <div className="w-full">
      {/* Input row */}
      <div className="flex flex-col sm:flex-row gap-2 bg-white rounded-2xl p-2 shadow-xl">
        <input
          ref={inputRef}
          type="url"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setStatus('idle'); }}
          onKeyDown={(e) => e.key === 'Enter' && handleDownload()}
          placeholder={t('hero.placeholder')}
          className="flex-1 px-4 py-3 text-gray-800 outline-none rounded-xl text-sm"
          dir="ltr"
        />
        {url ? (
          <button
            onClick={() => { setUrl(''); setStatus('idle'); setResult(null); }}
            className="px-4 py-3 text-gray-400 hover:text-gray-600 text-sm font-medium"
          >
            ✕
          </button>
        ) : (
          <button
            onClick={handlePaste}
            className="px-4 py-3 text-teal-600 hover:text-teal-800 text-sm font-medium"
          >
            {t('hero.paste')}
          </button>
        )}
        <button
          onClick={handleDownload}
          disabled={status === 'loading'}
          className="btn-shimmer text-white font-black px-7 py-3 rounded-xl transition disabled:opacity-60 text-sm whitespace-nowrap animate-glow tracking-wide"
        >
          {status === 'loading' ? '...' : t('hero.button')}
        </button>
      </div>

      {/* Note */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
        <span className="text-xs text-pink-400/80">📸 Instagram ✓</span>
        <span className="text-xs text-blue-400/80">👍 Facebook ✓</span>
        <span className="text-xs text-white/60">🎵 TikTok ✓</span>
        <span className="text-xs text-slate-500">▶️ YouTube — public only</span>
      </div>

      {/* Status messages */}
      {status === 'loading' && (
        <div className="mt-6 bg-white/20 backdrop-blur rounded-xl p-4 text-center text-white">
          <div className="flex items-center justify-center gap-2">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>{t('result.processing')}</span>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="mt-4 bg-red-100 text-red-700 rounded-xl p-4 text-sm text-center">
          {errorMsg}
        </div>
      )}

      {status === 'success' && result && (
        <div className="mt-6 bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="flex items-center gap-4 p-4 border-b border-gray-100">
            {result.thumbnail && (
              <img
                src={result.thumbnail}
                alt=""
                className="w-20 h-14 object-cover rounded-lg"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            <p className="text-gray-800 font-semibold text-sm line-clamp-2">{result.title}</p>
          </div>
          <div className="p-4 space-y-3">
            {/* Video formats row */}
            <div className="flex flex-wrap gap-3">
              {result.formats.filter(f => !f.label.toLowerCase().includes('audio')).map((fmt, i) => {
                const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
                const proxyUrl = `${apiBase}/api/proxy?url=${encodeURIComponent(fmt.url)}&filename=${encodeURIComponent(result.title)}&ext=${fmt.ext}`;
                return (
                  <a
                    key={i}
                    href={proxyUrl}
                    download
                    className="flex-1 min-w-[120px] bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-center font-semibold py-3 px-4 rounded-xl text-sm hover:opacity-90 transition"
                  >
                    ⬇ {fmt.label}
                  </a>
                );
              })}
            </div>
            {/* Audio / MP3 row — distinct style */}
            {result.formats.filter(f => f.label.toLowerCase().includes('audio')).map((fmt, i) => {
              const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
              const proxyUrl = `${apiBase}/api/proxy?url=${encodeURIComponent(fmt.url)}&filename=${encodeURIComponent(result.title)}&ext=${fmt.ext}`;
              return (
                <a
                  key={i}
                  href={proxyUrl}
                  download
                  className="flex w-full items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold py-3 px-4 rounded-xl text-sm hover:opacity-90 transition border border-violet-400/30"
                >
                  🎵 Extract MP3 / Audio
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
