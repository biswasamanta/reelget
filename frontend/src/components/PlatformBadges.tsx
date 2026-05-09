'use client';
import { useTranslations } from 'next-intl';

export default function PlatformBadges() {
  const t = useTranslations('platforms');
  return (
    <section className="py-12 px-4 bg-gradient-to-b from-slate-800 to-slate-900">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-center text-xl font-bold text-white mb-2">{t('title')}</h2>
        <p className="text-center text-slate-400 text-sm mb-8">Instagram • TikTok • Facebook • YouTube</p>

        {/* Instagram + Facebook + TikTok — featured 3-col */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          {/* Instagram */}
          <div className="relative bg-gradient-to-br from-pink-500 via-rose-500 to-orange-400 p-px rounded-2xl shadow-xl shadow-pink-500/40">
            <div className="bg-slate-900 rounded-2xl px-4 py-5 flex items-center gap-3 hover:bg-slate-800 transition">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 via-rose-500 to-orange-400 flex items-center justify-center text-xl shadow-lg flex-shrink-0">
                📸
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-white font-bold text-sm">{t('instagram')}</span>
                  <span className="bg-pink-500/20 text-pink-300 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-pink-400/30">✓ BEST</span>
                </div>
                <p className="text-slate-400 text-xs leading-tight">Reels, Posts & Stories</p>
              </div>
            </div>
          </div>

          {/* TikTok */}
          <div className="relative bg-gradient-to-br from-slate-700 via-pink-600 to-cyan-500 p-px rounded-2xl shadow-xl shadow-pink-500/30">
            <div className="bg-slate-900 rounded-2xl px-4 py-5 flex items-center gap-3 hover:bg-slate-800 transition">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-900 via-pink-600 to-cyan-400 flex items-center justify-center text-xl shadow-lg flex-shrink-0">
                🎵
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-white font-bold text-sm">TikTok</span>
                  <span className="bg-pink-500/20 text-pink-300 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-pink-400/30">✓ BEST</span>
                </div>
                <p className="text-slate-400 text-xs leading-tight">Videos & Reels</p>
              </div>
            </div>
          </div>

          {/* Facebook */}
          <div className="relative bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400 p-px rounded-2xl shadow-xl shadow-blue-500/40">
            <div className="bg-slate-900 rounded-2xl px-4 py-5 flex items-center gap-3 hover:bg-slate-800 transition">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400 flex items-center justify-center text-xl shadow-lg flex-shrink-0">
                👍
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-white font-bold text-sm">{t('facebook')}</span>
                  <span className="bg-blue-500/20 text-blue-300 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-blue-400/30">✓ BEST</span>
                </div>
                <p className="text-slate-400 text-xs leading-tight">Videos & Reels</p>
              </div>
            </div>
          </div>
        </div>

        {/* YouTube — smaller, with note */}
        <div className="relative bg-gradient-to-br from-red-600 via-red-500 to-orange-500 p-px rounded-2xl shadow-xl shadow-red-500/30 max-w-sm mx-auto">
          <div className="bg-slate-900 rounded-2xl px-5 py-4 flex items-center gap-4 hover:bg-slate-800 transition">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-red-600 via-red-500 to-orange-500 flex items-center justify-center text-xl shadow-lg flex-shrink-0">
              ▶️
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-white font-semibold text-sm">{t('youtube')}</span>
                <span className="bg-slate-700 text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded-full">PUBLIC ONLY</span>
              </div>
              <p className="text-slate-500 text-xs">Videos & Shorts — public videos only</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
