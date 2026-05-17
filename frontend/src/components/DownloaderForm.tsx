'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import ImageCompressor from './ImageCompressor';

type DownloadResult = {
  title: string;
  thumbnail?: string;
  formats: { label: string; url: string; ext: string }[];
};

type HistoryItem = {
  url: string;
  title: string;
  thumbnail?: string;
  platform: string;
  ts: number;
};

function detectPlatform(url: string): string {
  if (/instagram\.com/.test(url)) return 'Instagram';
  if (/tiktok\.com|vm\.tiktok\.com/.test(url)) return 'TikTok';
  if (/facebook\.com|fb\.watch/.test(url)) return 'Facebook';
  if (/youtube\.com|youtu\.be/.test(url)) return 'YouTube';
  if (/twitter\.com|x\.com|t\.co/.test(url)) return 'Twitter/X';
  if (/pinterest\.com|pin\.it/.test(url)) return 'Pinterest';
  if (/snapchat\.com/.test(url)) return 'Snapchat';
  if (/linkedin\.com/.test(url)) return 'LinkedIn';
  if (/reddit\.com|redd\.it/.test(url)) return 'Reddit';
  if (/vimeo\.com/.test(url)) return 'Vimeo';
  if (/dailymotion\.com|dai\.ly/.test(url)) return 'Dailymotion';
  if (/twitch\.tv/.test(url)) return 'Twitch';
  return 'Video';
}

const HISTORY_KEY = 'rg_history';

export default function DownloaderForm({ locale }: { locale: string }) {
  const t = useTranslations();
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<DownloadResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  function saveToHistory(downloadUrl: string, data: DownloadResult) {
    const item: HistoryItem = {
      url: downloadUrl,
      title: data.title,
      thumbnail: data.thumbnail,
      platform: detectPlatform(downloadUrl),
      ts: Date.now(),
    };
    setHistory(prev => {
      const filtered = prev.filter(h => h.url !== downloadUrl);
      const updated = [item, ...filtered].slice(0, 10);
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
      return updated;
    });
  }

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

  const isImageExt = (ext: string) =>
    ['jpg', 'jpeg', 'webp', 'png', 'gif', 'avif'].includes(ext.toLowerCase());

  const isValidUrl = (val: string) =>
    /instagram\.com|youtube\.com|youtu\.be|facebook\.com|fb\.watch|tiktok\.com|vm\.tiktok\.com|twitter\.com|x\.com|t\.co|pinterest\.com|pin\.it|snapchat\.com|snapchat\.app|linkedin\.com|reddit\.com|redd\.it|vimeo\.com|dailymotion\.com|dai\.ly|twitch\.tv/.test(val);

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
      saveToHistory(trimmed, data);
    } catch {
      setStatus('error');
      setErrorMsg(t('result.error'));
    }
  }

  async function handleCopy() {
    try {
      const shareUrl = typeof window !== 'undefined' ? window.location.href : 'https://reelget.com';
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // silently fail
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
        <span className="text-xs text-red-400/80">📌 Pinterest ✓</span>
        <span className="text-xs text-yellow-400/80">👻 Snapchat ✓</span>
        <span className="text-xs text-blue-300/80">💼 LinkedIn ✓</span>
        <span className="text-xs text-orange-400/80">🤖 Reddit ✓</span>
        <span className="text-xs text-cyan-400/80">🎬 Vimeo ✓</span>
        <span className="text-xs text-blue-400/80">📺 Dailymotion ✓</span>
        <span className="text-xs text-purple-400/80">🎮 Twitch ✓</span>
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
          <p>{errorMsg}</p>
          <button
            onClick={handleDownload}
            className="mt-2 text-xs font-semibold underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      )}

      {status === 'success' && result && (
        <div className="mt-6 bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Video preview */}
          {result.thumbnail && (
            <div className="relative w-full bg-black">
              <img
                src={result.thumbnail}
                alt={result.title}
                className="w-full max-h-52 object-contain"
                onError={(e) => { (e.target as HTMLImageElement).closest('div')!.style.display = 'none'; }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
              <p className="absolute bottom-0 left-0 right-0 px-4 py-3 text-white font-semibold text-sm line-clamp-2 drop-shadow">
                {result.title}
              </p>
            </div>
          )}
          {!result.thumbnail && (
            <div className="flex items-center gap-3 p-4 border-b border-gray-100">
              <p className="text-gray-800 font-semibold text-sm line-clamp-2">{result.title}</p>
            </div>
          )}

          <div className="p-4 space-y-3">
            {/* Video / Image formats row */}
            <div className="flex flex-wrap gap-3">
              {result.formats.filter(f => !f.label.toLowerCase().includes('audio')).map((fmt, i) => {
                const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
                const isTikTok = /tiktok\.com|vm\.tiktok\.com/.test(url);
                const quality = fmt.label.toLowerCase().includes('sd') ? 'sd' : 'hd';
                const isImg = isImageExt(fmt.ext);
                const downloadUrl = isTikTok
                  ? `${apiBase}/api/download-tiktok?url=${encodeURIComponent(url)}&quality=${quality}`
                  : `${apiBase}/api/proxy?url=${encodeURIComponent(fmt.url)}&filename=${encodeURIComponent(result.title)}&ext=${fmt.ext}`;
                return (
                  <a
                    key={i}
                    href={downloadUrl}
                    download
                    className={`flex-1 min-w-[120px] text-white text-center font-semibold py-3 px-4 rounded-xl text-sm hover:opacity-90 transition ${
                      isImg
                        ? 'bg-gradient-to-r from-pink-500 to-rose-500'
                        : 'bg-gradient-to-r from-teal-500 to-cyan-500'
                    }`}
                  >
                    {isImg ? '🖼' : '⬇'} {fmt.label}
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
            {/* Image compressor — shown only when result contains image formats */}
            {(() => {
              const imgFmts = result.formats.filter(f => isImageExt(f.ext));
              return imgFmts.length > 0 ? (
                <ImageCompressor formats={imgFmts} title={result.title} />
              ) : null;
            })()}

            {/* Share row: Copy link + WhatsApp + Telegram */}
            <div className="flex gap-2 pt-1 flex-wrap">
              {/* Copy link */}
              <button
                onClick={handleCopy}
                className="flex flex-1 min-w-[100px] items-center justify-center gap-2 border border-gray-200 text-gray-600 font-semibold py-2.5 px-3 rounded-xl text-sm hover:bg-gray-50 transition"
              >
                {copied ? <>✅ Copied!</> : <>📋 Copy</>}
              </button>
              {/* WhatsApp share */}
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`📥 "${result.title.slice(0, 80)}" — download it free at https://reelget.com`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 min-w-[100px] items-center justify-center gap-2 bg-[#25D366] text-white font-semibold py-2.5 px-3 rounded-xl text-sm hover:opacity-90 transition"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current shrink-0" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                WhatsApp
              </a>
              {/* Telegram share */}
              <a
                href={`https://t.me/share/url?url=${encodeURIComponent('https://reelget.com')}&text=${encodeURIComponent(`📥 "${result.title.slice(0, 80)}" — download it free at ReelGet`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 min-w-[100px] items-center justify-center gap-2 bg-[#229ED9] text-white font-semibold py-2.5 px-3 rounded-xl text-sm hover:opacity-90 transition"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current shrink-0" xmlns="http://www.w3.org/2000/svg">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
                Telegram
              </a>
            </div>
          </div>
        </div>
      )}
      {/* Download history */}
      {history.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setShowHistory(h => !h)}
            className="flex items-center gap-2 text-xs text-white/50 hover:text-white/80 transition mx-auto"
          >
            🕓 Recent downloads ({history.length})
            <span>{showHistory ? '▲' : '▼'}</span>
          </button>
          {showHistory && (
            <div className="mt-2 space-y-2">
              {history.map((item) => (
                <div
                  key={item.ts}
                  className="flex items-center gap-3 bg-white/10 rounded-xl px-3 py-2 cursor-pointer hover:bg-white/20 transition"
                  onClick={() => { setUrl(item.url); setStatus('idle'); setResult(null); setShowHistory(false); }}
                >
                  {item.thumbnail ? (
                    <img src={item.thumbnail} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center text-lg shrink-0">▶</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-medium truncate">{item.title}</p>
                    <p className="text-white/40 text-[10px]">{item.platform} · {new Date(item.ts).toLocaleDateString()}</p>
                  </div>
                  <span className="text-white/40 text-xs shrink-0">↩</span>
                </div>
              ))}
              <button
                onClick={() => { setHistory([]); localStorage.removeItem(HISTORY_KEY); setShowHistory(false); }}
                className="text-[10px] text-white/30 hover:text-white/60 transition w-full text-center pt-1"
              >
                Clear history
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
