'use client';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';

type TrendingVideo = {
  videoId: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
};

const LOCALE_TO_REGION: Record<string, string> = {
  hi: 'IN', bn: 'IN', or: 'IN', ta: 'IN', te: 'IN',
  ur: 'PK',
  id: 'ID',
  pt: 'BR',
  ar: 'SA',
  vi: 'VN',
  en: 'US',
  fr: 'NG',
  sw: 'KE',
};

export default function TrendingSection({ locale }: { locale: string }) {
  const t = useTranslations('trending');
  const [videos, setVideos] = useState<TrendingVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [noKey, setNoKey] = useState(false);

  const region = LOCALE_TO_REGION[locale] ?? 'IN';
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  useEffect(() => {
    fetch(`${apiBase}/api/trending?region=${region}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        if (data.error === 'no_key') { setNoKey(true); } else { setVideos(data.videos ?? []); }
        setLoading(false);
      })
      .catch(() => { setNoKey(true); setLoading(false); });
  }, [region, apiBase]);

  function handleClick(videoId: string) {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    window.dispatchEvent(new CustomEvent('fill-url', { detail: url }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (noKey && !loading) return null;

  return (
    <section className="py-16 px-4 bg-slate-950 border-t border-slate-800">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500/20 to-red-500/20 text-orange-300 border border-orange-400/30 text-xs font-bold px-4 py-1.5 rounded-full mb-4 uppercase tracking-wide">
            🔥 {t('badge')}
          </span>
          <h2 className="text-3xl font-black text-white mb-2">{t('title')}</h2>
          <p className="text-slate-400 text-sm">{t('subtitle')}</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="bg-slate-800 rounded-xl overflow-hidden animate-pulse">
                <div className="w-full aspect-video bg-slate-700" />
                <div className="p-2.5 space-y-1.5">
                  <div className="h-2.5 bg-slate-700 rounded w-full" />
                  <div className="h-2.5 bg-slate-700 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {videos.map((v) => (
              <button
                key={v.videoId}
                onClick={() => handleClick(v.videoId)}
                className="group relative bg-slate-800 rounded-xl overflow-hidden border border-slate-700 hover:border-orange-400/60 transition-all duration-200 hover:scale-105 text-left shadow-lg"
              >
                <div className="relative aspect-video overflow-hidden bg-slate-700">
                  {v.thumbnail ? (
                    <img src={v.thumbnail} alt={v.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500 text-2xl">▶</div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all duration-200 flex items-center justify-center">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 scale-50 group-hover:scale-100 transition-all duration-200 shadow-xl shadow-orange-500/40">
                      <span className="text-white text-sm ml-0.5">▶</span>
                    </div>
                  </div>
                  <div className="absolute top-1.5 right-1.5 bg-gradient-to-r from-cyan-500 to-teal-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition shadow-lg">
                    ↓ DOWNLOAD
                  </div>
                </div>
                <div className="p-2.5">
                  <p className="text-white text-xs font-semibold line-clamp-2 leading-tight mb-1 group-hover:text-orange-300 transition-colors">
                    {v.title}
                  </p>
                  <p className="text-slate-500 text-[10px] truncate">{v.channelTitle}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
