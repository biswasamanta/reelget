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
    /instagram\.com|youtube\.com|youtu\.be|facebook\.com|fb\.watch|tiktok\.com|vm\.tiktok\.com|twitter\.com|x\.com|t\.co/.test(val);

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
        <span className="text-xs text-sky-400/80">🐦 Twitter / X ✓</span>
        <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded-full font-medium">▶️ YouTube — public only</span>
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
                const isTikTok = /tiktok\.com|vm\.tiktok\.com/.test(url);
                const quality = fmt.label.toLowerCase().includes('sd') ? 'sd' : 'hd';
                const downloadUrl = isTikTok
                  ? `${apiBase}/api/download-tiktok?url=${encodeURIComponent(url)}&quality=${quality}`
                  : `${apiBase}/api/proxy?url=${encodeURIComponent(fmt.url)}&filename=${encodeURIComponent(result.title)}&ext=${fmt.ext}`;
                return (
                  <a
                    key={i}
                    href={downloadUrl}
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
            {/* WhatsApp share */}
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Download videos free at https://reelget.com`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 bg-[#25D366] text-white font-semibold py-2.5 px-4 rounded-xl text-sm hover:opacity-90 transition"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Share on WhatsApp
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
