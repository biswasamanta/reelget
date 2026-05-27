'use client';

import { useState, useRef, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { useTranslations } from 'next-intl';
import ImageCompressor from './ImageCompressor';
import LinkHelpGuide from './LinkHelpGuide';
import AdSlot from './AdSlot';
import PlaylistResult, { type PlaylistData } from './PlaylistResult';
import ProfileResult, { type ProfileData } from './ProfileResult';
import YouTubeJobDownloader from './YouTubeJobDownloader';

type DownloadMode = 'single' | 'profile' | 'playlist';
type YouTubeQuality = 'hd' | 'sd' | 'audio';

type DownloadResult = {
  title: string;
  thumbnail?: string;
  formats: { label: string; url: string; ext: string }[];
  duration?: number;   // seconds
};

/** Format seconds → M:SS or H:MM:SS */
function fmtDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

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
  if (/threads\.net/.test(url)) return 'Threads';
  return 'Video';
}

/** Extract the 11-character YouTube video ID from any YouTube URL format. */
function getYouTubeVideoId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return m ? m[1] : null;
}

const HISTORY_KEY = 'rg_history';

export default function DownloaderForm({ locale }: { locale: string }) {
  const t = useTranslations();
  const [mode, setMode] = useState<DownloadMode>('single');
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<DownloadResult | null>(null);
  const [playlistData, setPlaylistData] = useState<PlaylistData | null>(null);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [pasteHint, setPasteHint] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [transcriptStatus, setTranscriptStatus] = useState<'idle' | 'loading' | 'done' | 'unavailable'>('idle');
  const [showTranscript, setShowTranscript] = useState(false);
  const [transcriptCopied, setTranscriptCopied] = useState(false);
  const [dlToast, setDlToast] = useState<{ isYT: boolean } | null>(null);
  const [ytQuality, setYtQuality] = useState<YouTubeQuality>('hd');
  const [trimStart, setTrimStart] = useState('');
  const [trimEnd,   setTrimEnd]   = useState('');
  const dlToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Show the download-in-progress toast.
   *  YouTube needs ~10-30 s to prepare → keep for 40 s.
   *  Everything else starts immediately → dismiss after 6 s. */
  const showDlToast = (isYT: boolean) => {
    if (dlToastTimerRef.current) clearTimeout(dlToastTimerRef.current);
    setDlToast({ isYT });
    dlToastTimerRef.current = setTimeout(() => setDlToast(null), isYT ? 40_000 : 6_000);
  };

  const inputRef = useRef<HTMLInputElement>(null);
  const resetRafRef = useRef<number | null>(null);
  // Set to true in paste handlers to prevent onFocus from overriding cursor placement.
  const skipFocusSelectRef = useRef(false);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  // Web Share Target: when redirected from /share-target the URL is in ?url=
  // Read it once on mount, pre-fill the input, then clean the query string.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shared = params.get('url');
    if (!shared) return;
    flushSync(() => { setUrl(shared); setStatus('idle'); });
    window.history.replaceState({}, '', window.location.pathname);
    if (inputRef.current) {
      inputRef.current.setSelectionRange(0, 0);
      inputRef.current.scrollLeft = 0;
    }
  }, []);

  // Clipboard auto-detect: when the user copies a URL then switches back to
  // this tab, pre-fill the input automatically so they can tap Download right away.
  useEffect(() => {
    const tryClipboard = async () => {
      // Only pre-fill if the input is currently empty and idle
      if (url.trim() || status !== 'idle') return;
      try {
        const text = await navigator.clipboard.readText();
        const trimmed = text?.trim();
        if (trimmed && isValidUrl(trimmed)) {
          flushSync(() => { setUrl(trimmed); });
          if (inputRef.current) {
            inputRef.current.setSelectionRange(0, 0);
            inputRef.current.scrollLeft = 0;
          }
        }
      } catch { /* clipboard permission denied — silently ignore */ }
    };
    const onVisibility = () => { if (document.visibilityState === 'visible') tryClipboard(); };
    document.addEventListener('visibilitychange', onVisibility);
    // Also try once on first mount (e.g. user opened a new tab with URL already copied)
    tryClipboard();
    return () => document.removeEventListener('visibilitychange', onVisibility);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, status]);

  // ─── Anti-shift scroll reset ─────────────────────────────────────────────
  // Android Chrome's native input pipeline can render a shifted scroll BEFORE
  // our JS event handlers run, so a single synchronous reset is not enough.
  //
  // Strategy:
  //   1. startScrollReset() — rAF loop that hammers the correction for 350 ms.
  //      Called immediately after every paste (onChange + onPaste).
  //   2. 'scroll' listener on the input — catches cases where the shift happens
  //      outside a detected paste (e.g. first focus on a pre-filled input).
  //   3. 'scroll' listener on the window — catches layout-viewport drift.
  //   4. visualViewport 'scroll' listener — catches Android's visual-viewport
  //      pan, which is separate from window.scrollX.
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Place cursor at position 0 and zero out all scroll, then do one rAF
   * correction in case Android asynchronously re-scrolls after layout.
   */
  const resetCursorToStart = () => {
    if (resetRafRef.current !== null) cancelAnimationFrame(resetRafRef.current);
    const apply = () => {
      const inp = inputRef.current;
      if (!inp) return;
      inp.setSelectionRange(0, 0);
      inp.scrollLeft = 0;
      if (window.scrollX !== 0) window.scrollTo(0, window.scrollY);
    };
    apply();
    resetRafRef.current = requestAnimationFrame(() => {
      apply();
      resetRafRef.current = null;
      // Clear the skip flag here so future focus events (tap after paste) work normally.
      skipFocusSelectRef.current = false;
    });
  };

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    // Listener: layout-viewport horizontal drift
    const onWindowScroll = () => {
      if (window.scrollX !== 0) window.scrollTo(0, window.scrollY);
    };

    // Listener: visual-viewport pan (Android-specific)
    const vv = (window as Window & { visualViewport?: EventTarget & { offsetLeft: number } }).visualViewport;
    const onVVScroll = () => {
      if (vv && vv.offsetLeft !== 0) {
        window.scrollTo(window.scrollX + vv.offsetLeft, window.scrollY);
      }
      if (window.scrollX !== 0) window.scrollTo(0, window.scrollY);
    };

    window.addEventListener('scroll', onWindowScroll, { passive: true });
    vv?.addEventListener('scroll', onVVScroll, { passive: true } as AddEventListenerOptions);

    return () => {
      window.removeEventListener('scroll', onWindowScroll);
      vv?.removeEventListener('scroll', onVVScroll);
    };
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
      const updated = [item, ...filtered].slice(0, 20);
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
      return updated;
    });
  }

  useEffect(() => {
    const handler = (e: Event) => {
      const customUrl = (e as CustomEvent<string>).detail;
      flushSync(() => { setUrl(customUrl); setStatus('idle'); setResult(null); });
      if (inputRef.current) {
        inputRef.current.setSelectionRange(0, 0);
        inputRef.current.scrollLeft = 0;
      }
    };
    window.addEventListener('fill-url', handler);
    return () => window.removeEventListener('fill-url', handler);
  }, []);

  const isImageExt = (ext: string) =>
    ['jpg', 'jpeg', 'webp', 'png', 'gif', 'avif'].includes(ext.toLowerCase());

  const isValidUrl = (val: string) =>
    /instagram\.com|youtube\.com|youtu\.be|facebook\.com|fb\.watch|tiktok\.com|vm\.tiktok\.com|twitter\.com|x\.com|t\.co|pinterest\.com|pin\.it|snapchat\.com|snapchat\.app|linkedin\.com|reddit\.com|redd\.it|vimeo\.com|dailymotion\.com|dai\.ly|twitch\.tv|threads\.net/.test(val);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  /** Build the /api/download-youtube URL including quality and optional trim params */
  function ytDownloadUrl(quality: YouTubeQuality, videoUrl: string): string {
    const p = new URLSearchParams({ url: videoUrl, quality });
    if (trimStart.trim()) p.set('start', trimStart.trim());
    if (trimEnd.trim())   p.set('end',   trimEnd.trim());
    return `${apiBase}/api/download-youtube?${p.toString()}`;
  }

  const switchMode = (m: DownloadMode) => {
    setMode(m);
    setUrl('');
    setStatus('idle');
    setResult(null);
    setPlaylistData(null);
    setProfileData(null);
  };

  async function handleDownload() {
    const trimmed = url.trim();
    if (!trimmed) return;

    if (mode === 'playlist') {
      setStatus('loading');
      setPlaylistData(null);
      try {
        const res = await fetch(`${apiBase}/api/playlist?url=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Could not fetch playlist');
        setPlaylistData(data);
        setStatus('success');
      } catch (e: unknown) {
        setStatus('error');
        setErrorMsg(e instanceof Error ? e.message : 'Could not fetch playlist. Check the URL and try again.');
      }
      return;
    }

    if (mode === 'profile') {
      setStatus('loading');
      setProfileData(null);
      try {
        const res = await fetch(`${apiBase}/api/profile?url=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Could not fetch profile');
        setProfileData(data);
        setStatus('success');
      } catch (e: unknown) {
        setStatus('error');
        setErrorMsg(e instanceof Error ? e.message : 'Could not fetch profile. Make sure it\'s a public account.');
      }
      return;
    }

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
        // Backend sends either {code, message} or plain string in detail
        const detail = errData.detail || {};
        const errorCode: string = (typeof detail === 'object' ? detail.code : null) || '';
        const rawMsg: string = (typeof detail === 'object' ? detail.message : detail) || '';

        // Prefer structured error codes from backend; fall back to regex on raw message
        const ERROR_MESSAGES: Record<string, string> = {
          sign_in_required: 'This video requires sign-in to access. Please try a different video.',
          unavailable:      'This video is unavailable or restricted in this region.',
          private:          'This video is private and cannot be downloaded.',
          age_restricted:   'This video is age-restricted and cannot be downloaded without sign-in.',
          geo_blocked:      'This video is not available in your region.',
          not_found:        'Video not found. Please check the link and try again.',
          no_formats:       'No downloadable formats were found for this video.',
        };
        let friendly = ERROR_MESSAGES[errorCode] || '';

        if (!friendly) {
          // Legacy fallback: regex on raw message for old-format errors
          const cleaned = rawMsg.replace(/^ERROR:\s*\[[^\]]+\]\s*[\w-]+:\s*/i, '').trim();
          const trimmed = cleaned.replace(/\s*Use --cookies[\s\S]*$/i, '').trim();
          if (/sign in|bot|confirm/i.test(rawMsg) || /use --cookies/i.test(rawMsg)) {
            friendly = ERROR_MESSAGES.sign_in_required;
          } else if (/unavailable|not available/i.test(trimmed)) {
            friendly = ERROR_MESSAGES.unavailable;
          } else if (/private/i.test(trimmed)) {
            friendly = ERROR_MESSAGES.private;
          } else if (/age/i.test(trimmed)) {
            friendly = ERROR_MESSAGES.age_restricted;
          } else {
            friendly = trimmed;
          }
        }
        setStatus('error');
        setErrorMsg(friendly || t('result.error'));
        return;
      }
      const data = await res.json();
      setResult(data);
      setStatus('success');
      saveToHistory(trimmed, data);

      // Kick off transcript fetch in the background (non-blocking)
      setTranscript(null);
      setTranscriptStatus('loading');
      setShowTranscript(false);
      fetch(`${apiBase}/api/transcript?url=${encodeURIComponent(trimmed)}`)
        .then(r => r.json())
        .then(td => {
          if (td.transcript) {
            setTranscript(td.transcript);
            setTranscriptStatus('done');
          } else {
            setTranscriptStatus('unavailable');
          }
        })
        .catch(() => setTranscriptStatus('unavailable'));
    } catch {
      setStatus('error');
      setErrorMsg(t('result.error'));
    }
  }

  async function handleCopy() {
    const shareUrl = 'https://reelget.com';
    const shareText = result ? `📥 "${result.title.slice(0, 80)}" — download it free at ReelGet` : 'Download videos free at ReelGet';
    try {
      // Use native share sheet on mobile if available
      if (navigator.share) {
        await navigator.share({ title: 'ReelGet', text: shareText, url: shareUrl });
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // silently fail (user cancelled share sheet)
    }
  }

  async function handlePaste() {
    // iOS Safari blocks clipboard.readText() — fall back to native paste popup
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      inputRef.current?.focus();
      setPasteHint(true);
      setTimeout(() => setPasteHint(false), 2500);
      return;
    }
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) return;
      skipFocusSelectRef.current = true;
      flushSync(() => setUrl(text.trim()));
      inputRef.current?.focus();
      resetCursorToStart();
    } catch {
      inputRef.current?.focus();
      setPasteHint(true);
      setTimeout(() => setPasteHint(false), 2500);
    }
  }

  const modePlaceholder =
    mode === 'playlist'
      ? 'Paste a YouTube playlist URL…'
      : mode === 'profile'
      ? 'Paste an Instagram or YouTube channel URL…'
      : t('hero.placeholder');

  return (
    <div className="w-full">
      {/* Mode tabs */}
      <div className="flex gap-1.5 mb-3 justify-center">
        {([
          { id: 'single',   label: '📥 Video',    title: 'Download a single video' },
          { id: 'profile',  label: '👤 Profile',  title: 'Download recent videos from an Instagram or YouTube profile' },
          { id: 'playlist', label: '📋 Playlist', title: 'Download videos from a YouTube playlist' },
        ] as { id: DownloadMode; label: string; title: string }[]).map(m => (
          <button
            key={m.id}
            title={m.title}
            onClick={() => switchMode(m.id)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              mode === m.id
                ? 'bg-white text-slate-800 shadow-md'
                : 'text-white/60 hover:text-white/90'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Input row */}
      <div className="flex flex-col sm:flex-row gap-2 bg-white rounded-2xl p-2 shadow-xl">
        {/* Input + clear/paste — always on one row */}
        <div className="flex flex-1 items-center">
          <input
            ref={inputRef}
            type="text"
            inputMode="url"
            value={url}
            onChange={(e) => {
              const newVal = e.target.value;
              // Detect Android GBoard paste — it fires onChange, not onPaste.
              // Two signals: native inputType starts with 'insertFromPaste', OR
              // a large absolute change in length (catches replacing a long URL
              // with a shorter one, which a simple > 10 check would miss).
              const nativeInputType = (e.nativeEvent as InputEvent).inputType ?? '';
              const isPaste =
                nativeInputType.startsWith('insertFromPaste') ||
                Math.abs(newVal.length - url.length) > 5;
              if (isPaste) {
                skipFocusSelectRef.current = true;
                flushSync(() => { setUrl(newVal); setStatus('idle'); });
                resetCursorToStart();
              } else {
                setUrl(newVal);
                setStatus('idle');
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleDownload();
              if (e.key === 'Escape') { setUrl(''); setStatus('idle'); setResult(null); }
            }}
            onFocus={(e) => {
              // Skip select-all if a paste just happened — cursor is already at 0.
              if (skipFocusSelectRef.current) {
                skipFocusSelectRef.current = false;
                return;
              }
              const target = e.target;
              requestAnimationFrame(() => target.select());
            }}
            onPaste={(e) => {
              e.preventDefault();
              const pasted = (e.clipboardData?.getData('text/plain') || '').trim();
              if (!pasted) return;
              skipFocusSelectRef.current = true;
              flushSync(() => { setUrl(pasted); setStatus('idle'); });
              resetCursorToStart();
            }}
            placeholder={modePlaceholder}
            className="flex-1 px-4 py-3 text-gray-800 outline-none rounded-xl text-[16px] sm:text-sm min-w-0"
            dir="ltr"
          />
          {url ? (
            <button
              onClick={() => { setUrl(''); setStatus('idle'); setResult(null); }}
              className="px-3 py-3 text-gray-400 hover:text-gray-600 text-sm font-medium flex-shrink-0"
            >
              ✕
            </button>
          ) : (
            <div className="relative flex-shrink-0">
              <button
                onClick={handlePaste}
                className="px-3 py-3 text-teal-600 hover:text-teal-800 text-sm font-medium"
              >
                {t('hero.paste')}
              </button>
              {pasteHint && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-36 bg-gray-800 text-white text-xs text-center rounded-lg px-2 py-1.5 shadow-lg pointer-events-none">
                  Tap the box &amp; choose Paste
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
                </div>
              )}
            </div>
          )}
        </div>
        {/* Download button — full width on mobile, inline on desktop */}
        <button
          onClick={handleDownload}
          disabled={status === 'loading'}
          className="btn-shimmer text-white font-black px-7 py-3 rounded-xl transition disabled:opacity-60 text-sm whitespace-nowrap animate-glow tracking-wide cursor-pointer"
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
        <span className="text-xs text-gray-400/80">🧵 Threads ✓</span>
        <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded-full font-medium">▶️ YouTube — public only</span>
      </div>

      {/* Telegram bot hint — only shown in single-video mode */}
      {mode === 'single' && (
        <p className="text-center text-white/30 text-xs mt-3">
          🤖 Also on Telegram:{' '}
          <a href="https://t.me/ReelGetBot" target="_blank" rel="noopener noreferrer" className="text-cyan-400/70 hover:text-cyan-300 transition">
            @ReelGetBot
          </a>
          {' '}— send any URL, get download links instantly
        </p>
      )}

      {/* Link help guide */}
      <LinkHelpGuide />

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

      {/* Playlist result */}
      {status === 'success' && playlistData && (
        <PlaylistResult data={playlistData} apiBase={apiBase} />
      )}

      {/* Profile result */}
      {status === 'success' && profileData && (
        <ProfileResult
          data={profileData}
          apiBase={apiBase}
          onSelectVideo={(videoUrl) => {
            switchMode('single');
            setUrl(videoUrl);
            // Small delay lets the mode switch render before download starts
            setTimeout(handleDownload, 50);
          }}
        />
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
              {/* Duration badge */}
              {result.duration && result.duration > 0 && (
                <span className="absolute top-2 right-2 bg-black/70 text-white text-xs font-semibold px-2 py-0.5 rounded-md">
                  {fmtDuration(result.duration)}
                </span>
              )}
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
            {/* YouTube quality picker + trim */}
            {/youtube\.com|youtu\.be/.test(url) && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-gray-500">Quality:</span>
                  {([
                    { id: 'hd',    label: '🎬 HD (up to 1080p)' },
                    { id: 'sd',    label: '📱 SD 480p' },
                    { id: 'audio', label: '🎵 Audio Only' },
                  ] as { id: YouTubeQuality; label: string }[]).map(q => (
                    <button
                      key={q.id}
                      onClick={() => setYtQuality(q.id)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${
                        ytQuality === q.id
                          ? 'bg-teal-500 text-white border-teal-500'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-teal-400'
                      }`}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
                {/* Trim controls — only shown for video qualities */}
                {ytQuality !== 'audio' && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-500 shrink-0">✂️ Trim:</span>
                    <input
                      type="text"
                      placeholder="Start (e.g. 1:30)"
                      value={trimStart}
                      onChange={e => setTrimStart(e.target.value)}
                      className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 outline-none focus:border-teal-400"
                    />
                    <span className="text-gray-400 text-xs">→</span>
                    <input
                      type="text"
                      placeholder="End (e.g. 3:00)"
                      value={trimEnd}
                      onChange={e => setTrimEnd(e.target.value)}
                      className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 outline-none focus:border-teal-400"
                    />
                    {(trimStart || trimEnd) && (
                      <button
                        onClick={() => { setTrimStart(''); setTrimEnd(''); }}
                        className="text-gray-400 hover:text-gray-600 text-xs"
                        title="Clear trim"
                      >✕</button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Video / Image formats row */}
            <div className="flex flex-wrap gap-3">
              {result.formats.filter(f => !f.label.toLowerCase().includes('audio')).map((fmt, i) => {
                const isTikTok = /tiktok\.com|vm\.tiktok\.com/.test(url);
                const isYouTube = /youtube\.com|youtu\.be/.test(url);
                const isImg = isImageExt(fmt.ext);
                const downloadUrl = isTikTok
                  ? `${apiBase}/api/download-tiktok?url=${encodeURIComponent(url)}&quality=${fmt.label.toLowerCase().includes('sd') ? 'sd' : 'hd'}`
                  : isYouTube
                  ? ytDownloadUrl(ytQuality === 'audio' ? 'hd' : ytQuality, url)
                  : `${apiBase}/api/proxy?url=${encodeURIComponent(fmt.url)}&filename=${encodeURIComponent(result.title)}&ext=${fmt.ext}`;
                const btnLabel = isYouTube && !isImg
                  ? (ytQuality === 'hd' ? '⬇ Download HD' : ytQuality === 'sd' ? '⬇ Download SD' : '⬇ Download Video')
                  : `${isImg ? '🖼' : '⬇'} ${fmt.label}`;
                return (
                  <a
                    key={i}
                    href={downloadUrl}
                    download
                    onClick={() => showDlToast(isYouTube)}
                    className={`flex-1 min-w-[120px] text-white text-center font-semibold py-3 px-4 rounded-xl text-sm hover:opacity-90 transition cursor-pointer ${
                      isImg
                        ? 'bg-gradient-to-r from-pink-500 to-rose-500'
                        : 'bg-gradient-to-r from-teal-500 to-cyan-500'
                    }`}
                  >
                    {btnLabel}
                  </a>
                );
              })}
            </div>
            {/* Audio / MP3 row — distinct style */}
            {result.formats.filter(f => f.label.toLowerCase().includes('audio')).map((fmt, i) => {
              const isYouTubeAudio = /youtube\.com|youtu\.be/.test(url);
              const proxyUrl = isYouTubeAudio
                ? `${apiBase}/api/download-youtube?url=${encodeURIComponent(url)}&quality=audio`
                : `${apiBase}/api/proxy?url=${encodeURIComponent(fmt.url)}&filename=${encodeURIComponent(result.title)}&ext=${fmt.ext}`;
              // If user selected audio quality from picker, clicking the video button already handles it.
              // This row shows for non-YouTube audio formats only; for YT, picker handles it.
              if (isYouTubeAudio && ytQuality === 'audio') return null;
              return (
                <a
                  key={i}
                  href={proxyUrl}
                  download
                  onClick={() => showDlToast(isYouTubeAudio)}
                  className="flex w-full items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold py-3 px-4 rounded-xl text-sm hover:opacity-90 transition border border-violet-400/30 cursor-pointer"
                >
                  🎵 Extract MP3 / Audio
                </a>
              );
            })}
            {/* YouTube audio download — shown when audio quality is selected */}
            {/youtube\.com|youtu\.be/.test(url) && ytQuality === 'audio' && (
              <a
                href={ytDownloadUrl('audio', url)}
                download
                onClick={() => showDlToast(true)}
                className="flex w-full items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold py-3 px-4 rounded-xl text-sm hover:opacity-90 transition border border-violet-400/30 cursor-pointer"
              >
                🎵 Download Audio (M4A)
              </a>
            )}

            {/* Background job downloader — YouTube only, for when direct streaming is slow */}
            {/youtube\.com|youtu\.be/.test(url) && (
              <YouTubeJobDownloader
                videoUrl={url}
                quality={ytQuality}
                trimStart={trimStart}
                trimEnd={trimEnd}
                apiBase={apiBase}
              />
            )}
            {/* Image compressor — shown only when result contains image formats */}
            {(() => {
              const imgFmts = result.formats.filter(f => isImageExt(f.ext));
              return imgFmts.length > 0 ? (
                <ImageCompressor formats={imgFmts} title={result.title} />
              ) : null;
            })()}

            {/* Ad slot — shown between download buttons and share row */}
            <AdSlot slot="3921547860" format="auto" className="my-1 rounded-xl overflow-hidden" />

            {/* Share row: Copy link + WhatsApp + Telegram */}
            <div className="flex gap-2 pt-1 flex-wrap">
              {/* Copy link */}
              <button
                onClick={handleCopy}
                className="flex flex-1 min-w-[100px] items-center justify-center gap-2 border border-gray-200 text-gray-600 font-semibold py-2.5 px-3 rounded-xl text-sm hover:bg-gray-50 transition"
              >
                {copied ? <>✅ Shared!</> : <><span className="hidden sm:inline">📋 Copy Link</span><span className="sm:hidden">↗ Share</span></>}
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

            {/* YouTube thumbnail downloader — shown for any YouTube URL */}
            {(() => {
              const ytId = getYouTubeVideoId(url);
              if (!ytId) return null;
              const thumbs = [
                { label: 'HD  1280×720', key: 'maxresdefault' },
                { label: 'HQ  480×360',  key: 'hqdefault'     },
                { label: 'MQ  320×180',  key: 'mqdefault'      },
              ];
              return (
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs font-semibold text-gray-500 mb-2">🖼 Download Thumbnail</p>
                  <div className="flex flex-wrap gap-2">
                    {thumbs.map(({ label, key }) => (
                      <a
                        key={key}
                        href={`${apiBase}/api/proxy?url=${encodeURIComponent(`https://i.ytimg.com/vi/${ytId}/${key}.jpg`)}&filename=thumbnail-${ytId}&ext=jpg`}
                        download
                        className="flex-1 min-w-[90px] text-center text-xs font-semibold py-2 px-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
                      >
                        {label}
                      </a>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Transcript panel — shown when captions are available or loading */}
            {transcriptStatus !== 'idle' && transcriptStatus !== 'unavailable' && (
              <div className="border-t border-gray-100 pt-3">
                <button
                  onClick={() => setShowTranscript(s => !s)}
                  className="flex w-full items-center justify-between text-sm font-semibold text-gray-700 hover:text-gray-900 transition"
                >
                  <span>📝 Video Transcript</span>
                  {transcriptStatus === 'loading' ? (
                    <span className="text-xs text-gray-400 animate-pulse">Loading…</span>
                  ) : (
                    <span className="text-gray-400">{showTranscript ? '▲' : '▼'}</span>
                  )}
                </button>
                {showTranscript && transcript && (
                  <div className="mt-2 space-y-2">
                    <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-700 leading-relaxed max-h-48 overflow-y-auto">
                      {transcript}
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={async () => {
                          await navigator.clipboard.writeText(transcript);
                          setTranscriptCopied(true);
                          setTimeout(() => setTranscriptCopied(false), 2000);
                        }}
                        className="text-xs text-teal-600 hover:text-teal-800 font-semibold transition"
                      >
                        {transcriptCopied ? '✅ Copied!' : '📋 Copy transcript'}
                      </button>
                      <span className="text-gray-300">·</span>
                      <span className="text-xs text-gray-400">Auto-generated captions</span>
                    </div>
                  </div>
                )}
              </div>
            )}
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
            🕓 Recent downloads
            <span className="bg-white/10 text-white/70 px-1.5 py-0.5 rounded-full text-[10px] font-bold">{history.length}</span>
            <span>{showHistory ? '▲' : '▼'}</span>
          </button>
          {showHistory && (
            <div className="mt-2 space-y-1.5">
              {history.map((item) => (
                <div
                  key={item.ts}
                  className="flex items-center gap-3 bg-white/10 rounded-xl px-3 py-2 hover:bg-white/20 transition group"
                >
                  {/* Thumbnail — tap to re-fill URL */}
                  <button
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
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
                  </button>
                  {/* Re-download instantly */}
                  <button
                    title="Download again"
                    onClick={() => { setUrl(item.url); setStatus('idle'); setResult(null); setShowHistory(false); setTimeout(handleDownload, 50); }}
                    className="shrink-0 text-white/30 hover:text-cyan-400 transition text-sm opacity-0 group-hover:opacity-100"
                  >
                    ⬇
                  </button>
                  {/* Remove from history */}
                  <button
                    title="Remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      setHistory(prev => {
                        const updated = prev.filter(h => h.ts !== item.ts);
                        try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
                        return updated;
                      });
                    }}
                    className="shrink-0 text-white/30 hover:text-red-400 transition text-xs opacity-0 group-hover:opacity-100"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={() => { setHistory([]); localStorage.removeItem(HISTORY_KEY); setShowHistory(false); }}
                className="text-[10px] text-white/30 hover:text-white/60 transition w-full text-center pt-1"
              >
                Clear all history
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Download progress toast ───────────────────────────────────────── */}
      {dlToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm pointer-events-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-4 flex flex-col gap-3">
            {/* Header row */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="text-xl shrink-0">⬇</span>
                <div>
                  <p className="text-white text-sm font-semibold leading-snug">
                    {dlToast.isYT ? 'Preparing your video…' : 'Download in progress'}
                  </p>
                  <p className="text-slate-400 text-xs mt-0.5 leading-snug">
                    {dlToast.isYT
                      ? 'YouTube videos take 10–30 s to prepare — please wait.'
                      : 'Your file will appear in Downloads shortly.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setDlToast(null); if (dlToastTimerRef.current) clearTimeout(dlToastTimerRef.current); }}
                className="text-slate-500 hover:text-slate-300 transition shrink-0 text-lg leading-none mt-0.5 cursor-pointer"
              >
                ✕
              </button>
            </div>
            {/* Indeterminate progress bar */}
            <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full w-2/5 bg-gradient-to-r from-teal-400 to-cyan-400 rounded-full animate-dl-progress" />
            </div>
            {/* iOS tip — file goes to Files app, not Photos */}
            {/iphone|ipad|ipod/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : '') && (
              <p className="text-slate-400 text-xs leading-snug border-t border-slate-700 pt-2">
                📱 <span className="text-slate-300 font-medium">iPhone tip:</span> File saves to the <span className="text-white">Files app</span>. To move it to Photos, open Files → tap the video → Share → Save to Photos.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
