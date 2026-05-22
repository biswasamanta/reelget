'use client';
import { useState, useEffect } from 'react';

type Video = {
  videoId: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
};

type Category = 'all' | 'music' | 'gaming' | 'films';

const CATEGORIES: { id: Category; label: string; emoji: string }[] = [
  { id: 'all',    label: 'All',    emoji: '🔥' },
  { id: 'music',  label: 'Music',  emoji: '🎵' },
  { id: 'gaming', label: 'Gaming', emoji: '🎮' },
  { id: 'films',  label: 'Films',  emoji: '🎬' },
];

export default function TrendingNowSection() {
  const [activeCategory, setActiveCategory] = useState<Category>('all');
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  useEffect(() => {
    setLoading(true);
    setFailed(false);
    fetch(`${apiBase}/api/trending-now?category=${activeCategory}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        setVideos(data.videos ?? []);
        setLoading(false);
      })
      .catch(() => {
        setFailed(true);
        setLoading(false);
      });
  }, [activeCategory, apiBase]);

  // Silently hide if the fetch fails completely
  if (failed && !loading) return null;

  return (
    <section className="py-16 px-4 bg-slate-900 border-t border-slate-800">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <span className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500/20 to-teal-500/20 text-cyan-300 border border-cyan-400/30 text-xs font-bold px-4 py-1.5 rounded-full mb-4 uppercase tracking-wide">
            ⚡ Trending Now
          </span>
          <h2 className="text-3xl font-black text-white mb-2">What&apos;s Trending on YouTube</h2>
          <p className="text-slate-400 text-sm">Live from YouTube — updated every 2 hours</p>
        </div>

        {/* Category tabs */}
        <div className="flex justify-center gap-2 mb-8 flex-wrap">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                activeCategory === cat.id
                  ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-lg shadow-cyan-500/30'
                  : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 border border-slate-700'
              }`}
            >
              {cat.emoji} {cat.label}
            </button>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {videos.map((v) => (
              <a
                key={v.videoId}
                href={`https://www.youtube.com/watch?v=${v.videoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative bg-slate-800 rounded-xl overflow-hidden border border-slate-700 hover:border-cyan-400/60 transition-all duration-200 hover:scale-105 text-left shadow-lg"
              >
                <div className="relative aspect-video overflow-hidden bg-slate-700">
                  {v.thumbnail ? (
                    <img
                      src={v.thumbnail}
                      alt={v.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500 text-2xl">▶</div>
                  )}
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all duration-200 flex items-center justify-center">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center opacity-0 group-hover:opacity-100 scale-50 group-hover:scale-100 transition-all duration-200 shadow-xl shadow-cyan-500/40">
                      <span className="text-white text-sm ml-0.5">▶</span>
                    </div>
                  </div>
                  {/* Download badge */}
                  <div className="absolute bottom-1.5 right-1.5 bg-gradient-to-r from-cyan-500 to-teal-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition shadow-lg">
                    ⬇ SAVE
                  </div>
                </div>
                <div className="p-2.5">
                  <p className="text-white text-xs font-semibold line-clamp-2 leading-tight mb-1 group-hover:text-cyan-300 transition-colors">
                    {v.title}
                  </p>
                  <p className="text-slate-500 text-[10px] truncate">{v.channelTitle}</p>
                </div>
              </a>
            ))}
          </div>
        )}

        {/* CTA hint */}
        {!loading && videos.length > 0 && (
          <p className="text-center text-slate-600 text-xs mt-8">
            Paste any YouTube URL above to download it instantly ↑
          </p>
        )}
      </div>
    </section>
  );
}
