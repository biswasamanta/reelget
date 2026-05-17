'use client';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

const STEPS = [
  {
    num: '1',
    icon: '🔗',
    color: 'from-cyan-500 to-blue-500',
    glow: 'shadow-cyan-500/20',
    border: 'border-cyan-500/30',
    titleKey: 'step1_title' as const,
    descKey: 'step1_desc' as const,
    detail: 'Open any supported app, find the video you want, and tap the Share or ⋯ menu.',
    platforms: ['📸 Instagram', '🎵 TikTok', '▶️ YouTube', '👍 Facebook', '🐦 Twitter'],
    tip: 'Look for "Copy link" or "Share → Copy link" in every app.',
    example: null,
  },
  {
    num: '2',
    icon: '📋',
    color: 'from-violet-500 to-purple-600',
    glow: 'shadow-violet-500/20',
    border: 'border-violet-500/30',
    titleKey: 'step2_title' as const,
    descKey: 'step2_desc' as const,
    detail: 'Tap the input box at the top of this page and paste the link. Then hit the Download button.',
    platforms: [],
    tip: 'On mobile, long-press the input box and tap "Paste". On desktop, press Ctrl+V.',
    example: 'https://www.instagram.com/reel/ABC123...',
  },
  {
    num: '3',
    icon: '💾',
    color: 'from-teal-400 to-emerald-500',
    glow: 'shadow-teal-500/20',
    border: 'border-teal-500/30',
    titleKey: 'step3_title' as const,
    descKey: 'step3_desc' as const,
    detail: 'Pick HD for best quality or SD to save storage. The video downloads directly to your device.',
    platforms: [],
    tip: 'On iPhone, tap "Download" then open it in Files or Photos. On Android it goes to Downloads.',
    example: null,
  },
];

export default function HowToSection() {
  const t = useTranslations('howto');
  const [active, setActive] = useState<number | null>(null);

  return (
    <section className="py-16 px-4 bg-slate-900">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="inline-block bg-teal-500/10 text-teal-400 text-xs font-bold px-4 py-1.5 rounded-full border border-teal-500/20 mb-4 tracking-widest uppercase">
            Simple &amp; Fast
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">{t('title')}</h2>
          <p className="text-slate-400 text-sm">Download any video in under 10 seconds</p>
        </div>

        {/* Flow connector — desktop only */}
        <div className="hidden sm:flex items-center justify-center gap-0 mb-8">
          {STEPS.map((step, i) => (
            <div key={i} className="flex items-center">
              <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${step.color} flex items-center justify-center text-white text-xs font-black`}>
                {step.num}
              </div>
              {i < STEPS.length - 1 && (
                <div className="w-24 h-px bg-gradient-to-r from-slate-600 to-slate-700 mx-1 relative">
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-slate-600 text-xs">→</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Step cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {STEPS.map((step, i) => (
            <div
              key={i}
              onClick={() => setActive(active === i ? null : i)}
              className={`relative bg-slate-800 rounded-2xl border cursor-pointer transition-all duration-200 overflow-hidden ${step.border} ${active === i ? 'shadow-xl ' + step.glow : 'hover:scale-[1.02]'}`}
            >
              {/* Top gradient bar */}
              <div className={`h-1 w-full bg-gradient-to-r ${step.color}`} />

              <div className="p-6">
                {/* Step number + icon */}
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center text-white font-black text-lg shadow-lg`}>
                    {step.num}
                  </div>
                  <span className="text-3xl">{step.icon}</span>
                </div>

                <h3 className="font-bold text-white text-base mb-1">{t(step.titleKey)}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{step.detail}</p>

                {/* Platform tags — step 1 only */}
                {step.platforms.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {step.platforms.map((p) => (
                      <span key={p} className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{p}</span>
                    ))}
                  </div>
                )}

                {/* Example URL */}
                {step.example && (
                  <div className="mt-3 bg-slate-900 rounded-lg px-3 py-2 font-mono text-[10px] text-cyan-400 truncate">
                    {step.example}
                  </div>
                )}

                {/* Expand toggle */}
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    {active === i ? 'Hide tip ▲' : 'See tip ▼'}
                  </span>
                </div>
              </div>

              {/* Expandable tip */}
              {active === i && (
                <div className={`px-6 pb-5 border-t border-slate-700`}>
                  <div className={`mt-4 flex gap-2 bg-gradient-to-r ${step.color} bg-opacity-10 rounded-xl p-3`}>
                    <span className="text-base shrink-0">💡</span>
                    <p className="text-xs text-slate-200 leading-relaxed">{step.tip}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-10 text-center">
          <a
            href="#top"
            onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-bold px-8 py-3 rounded-xl text-sm hover:opacity-90 transition shadow-lg shadow-cyan-500/20"
          >
            ⬇ Try it now — it&apos;s free
          </a>
          <p className="text-slate-600 text-xs mt-3">No login · No app · No watermark</p>
        </div>
      </div>
    </section>
  );
}
