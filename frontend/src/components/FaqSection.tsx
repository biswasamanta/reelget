'use client';
import { useState } from 'react';

type Category = 'all' | 'general' | 'downloads' | 'privacy' | 'technical';

const FAQS: { q: string; a: string; cat: Category }[] = [
  {
    cat: 'general',
    q: 'Is ReelGet free to use?',
    a: 'Yes — completely free. No account, no subscription, no hidden fees. ReelGet is supported by ads and will always have a free tier.',
  },
  {
    cat: 'general',
    q: 'Which platforms does ReelGet support?',
    a: 'Instagram (Reels, Posts, Stories), TikTok, Facebook (Videos, Reels), YouTube (Videos, Shorts), Twitter/X, Pinterest, Snapchat, LinkedIn, Reddit, Vimeo, Dailymotion, and Twitch Clips.',
  },
  {
    cat: 'general',
    q: 'Do I need to install an app or extension?',
    a: 'No — ReelGet works entirely in your browser. Just paste the link and download. No Chrome extension, no desktop software, no app required.',
  },
  {
    cat: 'downloads',
    q: 'Can I download videos without a watermark?',
    a: 'Yes. TikTok videos are fetched from the original CDN before the watermark is applied, so downloads are completely clean. Other platforms deliver their original source files with no additional branding.',
  },
  {
    cat: 'downloads',
    q: 'What video quality can I download?',
    a: 'ReelGet automatically selects the highest available quality — up to 1080p HD for most platforms. An SD option (480p) is also available when you need smaller file sizes.',
  },
  {
    cat: 'downloads',
    q: 'Can I extract MP3 audio from YouTube?',
    a: 'Yes — use the "Extract MP3 / Audio" button that appears after processing a YouTube link. The file is saved as M4A (AAC), the native YouTube audio format, with no re-encoding or quality loss.',
  },
  {
    cat: 'downloads',
    q: 'Can I download private or age-restricted videos?',
    a: 'No. ReelGet can only download publicly accessible content. Private, age-restricted, or members-only videos cannot be accessed without the creator\'s credentials.',
  },
  {
    cat: 'downloads',
    q: 'Why did my download fail?',
    a: 'Common causes: the video is private or deleted, the URL was copied incorrectly, or the platform temporarily blocked the request. Try copying the link again directly from the app. If the problem persists, the content may be restricted.',
  },
  {
    cat: 'privacy',
    q: 'Is it safe to use ReelGet?',
    a: 'Yes. We do not store your URLs, download history, or any personal data on our servers. Everything is processed in real time and discarded immediately after delivery.',
  },
  {
    cat: 'privacy',
    q: 'Does ReelGet store my downloaded videos?',
    a: 'No. Videos are streamed directly from the source platform to your device via our proxy. We never write the video file to disk on our servers.',
  },
  {
    cat: 'technical',
    q: 'Why does the counter show K+ downloads?',
    a: 'The counter tracks real downloads processed through ReelGet. It persists across server restarts and updates in real time on every successful download.',
  },
  {
    cat: 'technical',
    q: 'Can I use ReelGet on iPhone or Android?',
    a: 'Yes — ReelGet is a mobile-first web app. Open reelget.com in Safari (iPhone) or Chrome (Android), paste the link, and download. You can also install it as a PWA from your browser\'s "Add to Home Screen" option for faster access.',
  },
];

const CATS: { key: Category; label: string }[] = [
  { key: 'all', label: '✦ All' },
  { key: 'general', label: '💬 General' },
  { key: 'downloads', label: '⬇ Downloads' },
  { key: 'privacy', label: '🔒 Privacy' },
  { key: 'technical', label: '⚙️ Technical' },
];

export default function FaqSection() {
  const [open, setOpen] = useState<number | null>(null);
  const [cat, setCat] = useState<Category>('all');
  const [search, setSearch] = useState('');

  const filtered = FAQS.filter((f) => {
    const matchCat = cat === 'all' || f.cat === cat;
    const q = search.toLowerCase();
    const matchSearch = !q || f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  return (
    <section className="py-16 px-4 bg-gradient-to-b from-slate-900 to-slate-950">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <span className="inline-block bg-violet-500/10 text-violet-400 text-xs font-bold px-4 py-1.5 rounded-full border border-violet-500/20 mb-4 tracking-widest uppercase">
            FAQ
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-2">Frequently Asked Questions</h2>
          <p className="text-slate-400 text-sm">Everything you need to know about ReelGet</p>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
          <input
            type="text"
            placeholder="Search questions..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOpen(null); }}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-500 transition"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition text-xs">✕</button>
          )}
        </div>

        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto pb-1 mb-6 scrollbar-hide">
          {CATS.map((c) => (
            <button
              key={c.key}
              onClick={() => { setCat(c.key); setOpen(null); }}
              className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition ${
                cat === c.key
                  ? 'bg-cyan-500 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* FAQ list */}
        {filtered.length === 0 ? (
          <p className="text-center text-slate-500 py-8 text-sm">No results found. Try a different search.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((faq, i) => (
              <div
                key={i}
                className={`border rounded-xl overflow-hidden transition-all ${
                  open === i ? 'border-cyan-500/40 bg-slate-800' : 'border-slate-700 bg-slate-800/60 hover:border-slate-600'
                }`}
              >
                <button
                  className="w-full flex justify-between items-center px-5 py-4 text-left text-white font-semibold hover:bg-slate-700/30 transition"
                  onClick={() => setOpen(open === i ? null : i)}
                >
                  <span className="flex items-center gap-3 pr-4">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0 ${
                      open === i ? 'bg-cyan-500' : 'bg-slate-700'
                    }`}>
                      {i + 1}
                    </span>
                    <span className="text-sm leading-snug">{faq.q}</span>
                  </span>
                  <span className={`text-cyan-400 transition-transform duration-300 shrink-0 ${open === i ? 'rotate-180' : ''}`}>▾</span>
                </button>
                {open === i && (
                  <div className="px-5 pb-5 pt-1 text-slate-300 text-sm leading-relaxed border-t border-slate-700/50">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Count */}
        <p className="text-center text-slate-600 text-xs mt-6">
          Showing {filtered.length} of {FAQS.length} questions
        </p>
      </div>
    </section>
  );
}
