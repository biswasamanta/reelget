'use client';
import { useTranslations } from 'next-intl';

const steps = [
  { num: '1', key: 'step1', icon: '🔗', color: 'from-cyan-500 to-blue-500',    glow: 'shadow-cyan-500/30'   },
  { num: '2', key: 'step2', icon: '📋', color: 'from-violet-500 to-purple-600', glow: 'shadow-violet-500/30' },
  { num: '3', key: 'step3', icon: '💾', color: 'from-teal-400 to-emerald-500',  glow: 'shadow-teal-500/30'   },
];

export default function HowToSection() {
  const t = useTranslations('howto');
  return (
    <section className="py-16 px-4 bg-slate-900">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-center text-3xl font-black text-white mb-2">{t('title')}</h2>
        <p className="text-center text-slate-400 text-sm mb-10">3 easy steps →</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {steps.map((step) => (
            <div key={step.key} className={`relative bg-slate-800 rounded-2xl p-6 text-center border border-slate-700 shadow-xl ${step.glow} hover:scale-105 transition-transform`}>
              {/* Top gradient bar */}
              <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r ${step.color}`} />

              <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${step.color} flex items-center justify-center text-white font-black text-2xl mx-auto mb-4 shadow-lg`}>
                {step.num}
              </div>
              <p className="text-4xl mb-3">{step.icon}</p>
              <h3 className="font-bold text-white mb-2">
                {t(`${step.key}_title` as 'step1_title' | 'step2_title' | 'step3_title')}
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                {t(`${step.key}_desc` as 'step1_desc' | 'step2_desc' | 'step3_desc')}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
