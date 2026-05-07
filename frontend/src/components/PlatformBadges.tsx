'use client';
import { useTranslations } from 'next-intl';

const platforms = [
  { name: 'instagram', icon: '📸', gradient: 'from-pink-500 via-rose-500 to-orange-400', glow: 'shadow-pink-500/40' },
  { name: 'youtube',   icon: '▶️', gradient: 'from-red-600 via-red-500 to-orange-500',   glow: 'shadow-red-500/40'  },
  { name: 'facebook',  icon: '👍', gradient: 'from-blue-600 via-blue-500 to-cyan-400',   glow: 'shadow-blue-500/40' },
];

export default function PlatformBadges() {
  const t = useTranslations('platforms');
  return (
    <section className="py-12 px-4 bg-gradient-to-b from-slate-800 to-slate-900">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-center text-xl font-bold text-white mb-2">{t('title')}</h2>
        <p className="text-center text-slate-400 text-sm mb-8">Instagram • YouTube • Facebook</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {platforms.map((p) => (
            <div
              key={p.name}
              className={`relative bg-gradient-to-br ${p.gradient} p-px rounded-2xl shadow-xl ${p.glow}`}
            >
              <div className="bg-slate-900 rounded-2xl px-5 py-5 flex items-center gap-4 hover:bg-slate-800 transition">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${p.gradient} flex items-center justify-center text-xl shadow-lg`}>
                  {p.icon}
                </div>
                <span className="text-white font-semibold text-sm">
                  {t(p.name as 'instagram' | 'youtube' | 'facebook')}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
