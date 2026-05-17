'use client';

import { useState } from 'react';

interface FaqItem {
  q: string;
  a: string;
}

export default function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div
          key={i}
          className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden"
        >
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full text-left px-5 py-4 flex items-center justify-between gap-4 text-white font-semibold text-sm hover:bg-slate-700/50 transition-colors"
          >
            <span>{item.q}</span>
            <span className="text-teal-400 text-lg flex-shrink-0">
              {open === i ? '−' : '+'}
            </span>
          </button>
          {open === i && (
            <div className="px-5 pb-4 text-slate-300 text-sm leading-relaxed border-t border-slate-700">
              <p className="pt-3">{item.a}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
