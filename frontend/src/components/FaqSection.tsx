'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

const faqs = [
  { q: 'q1', a: 'a1' },
  { q: 'q2', a: 'a2' },
  { q: 'q3', a: 'a3' },
  { q: 'q4', a: 'a4' },
] as const;

export default function FaqSection() {
  const t = useTranslations('faq');
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="py-16 px-4 bg-gradient-to-b from-slate-900 to-slate-950">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-center text-3xl font-black text-white mb-2">{t('title')}</h2>
        <p className="text-center text-slate-400 text-sm mb-10">Everything you need to know</p>
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div key={i} className="border border-slate-700 rounded-xl overflow-hidden bg-slate-800/60 backdrop-blur">
              <button
                className="w-full flex justify-between items-center px-5 py-4 text-left text-white font-semibold hover:bg-slate-700/50 transition"
                onClick={() => setOpen(open === i ? null : i)}
              >
                <span className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-teal-400 flex items-center justify-center text-xs font-black text-white shrink-0">
                    {i + 1}
                  </span>
                  {t(faq.q)}
                </span>
                <span className={`text-cyan-400 transition-transform duration-300 ${open === i ? 'rotate-180' : ''}`}>▾</span>
              </button>
              {open === i && (
                <div className="px-5 pb-4 pt-1 text-slate-300 text-sm leading-relaxed border-t border-slate-700/50">
                  {t(faq.a)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
