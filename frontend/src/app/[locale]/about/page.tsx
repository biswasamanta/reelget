import type { Metadata } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://reelget.com';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: 'About ReelGet — Free Video Downloader',
    description: 'Learn about ReelGet — the free, no-login video downloader for Instagram, TikTok, YouTube, Facebook, and more.',
    alternates: { canonical: `${BASE_URL}/${locale}/about` },
  };
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Nav */}
      <nav className="bg-white sticky top-0 z-50 border-b border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <a href={`/${locale}`} className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-teal-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">V</span>
            </div>
            <span className="font-bold text-slate-800 text-lg">ReelGet</span>
          </a>
          <a href={`/${locale}`} className="text-sm text-slate-500 hover:text-teal-600 font-medium transition">
            ← Home
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative bg-slate-900 text-white py-20 px-4 text-center overflow-hidden">
        <div className="absolute top-10 left-10 w-72 h-72 bg-cyan-500 rounded-full mix-blend-screen filter blur-3xl opacity-10" />
        <div className="absolute top-20 right-10 w-72 h-72 bg-violet-600 rounded-full mix-blend-screen filter blur-3xl opacity-10" />
        <div className="relative max-w-2xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-black mb-4">
            About{' '}
            <span className="bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">
              ReelGet
            </span>
          </h1>
          <p className="text-slate-300 text-lg">
            A free, fast, and privacy-friendly video downloader built for everyone.
          </p>
        </div>
      </section>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 py-16 text-slate-300">
        <section className="space-y-12 text-sm leading-relaxed">
          <div>
            <h2 className="text-xl font-bold text-white mb-4">What is ReelGet?</h2>
            <p className="mb-3">ReelGet is a free online video downloader that lets you save public videos from Instagram, TikTok, Facebook, YouTube, Twitter/X, Pinterest, and Snapchat — directly to your phone or computer, with no app installation and no account required.</p>
            <p>We built ReelGet because downloading a video you want to watch offline, share with family, or save as a memory shouldn't require installing sketchy apps, signing up for services, or navigating confusing menus. Just paste a link and download.</p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-white mb-4">Our Mission</h2>
            <p>We believe access to simple, reliable tools should be free and universally available. ReelGet is available in 16 languages and designed to work equally well on a low-end Android phone in rural India as it does on a desktop in Europe. Speed, simplicity, and privacy are our core priorities.</p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-white mb-4">What Makes ReelGet Different</h2>
            <div className="grid sm:grid-cols-2 gap-4 mt-2">
              {[
                { icon: '🔒', title: 'No login required', desc: 'You never need to create an account or connect your social media profiles.' },
                { icon: '💧', title: 'No watermarks', desc: 'Videos are downloaded from the original source — no branding overlaid.' },
                { icon: '🌍', title: '16 languages', desc: 'Available in English, Hindi, Bengali, Indonesian, Arabic, and 11 more languages.' },
                { icon: '⚡', title: 'Fast & server-side', desc: 'Downloads are processed on our servers and streamed directly — no waiting.' },
                { icon: '🆓', title: 'Always free', desc: 'No premium tier, no download limits, no subscription. Free forever.' },
                { icon: '🛡️', title: 'Privacy first', desc: 'We don\'t store your URLs or videos. Each request is processed and discarded.' },
              ].map((item) => (
                <div key={item.title} className="bg-slate-800 rounded-xl p-4">
                  <div className="text-2xl mb-2">{item.icon}</div>
                  <h3 className="text-white font-semibold mb-1">{item.title}</h3>
                  <p className="text-slate-400 text-xs">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold text-white mb-4">Supported Platforms</h2>
            <div className="flex flex-wrap gap-2">
              {[
                { emoji: '📸', name: 'Instagram', path: 'instagram' },
                { emoji: '🎵', name: 'TikTok', path: 'tiktok' },
                { emoji: '👍', name: 'Facebook', path: 'facebook' },
                { emoji: '▶️', name: 'YouTube', path: 'youtube' },
                { emoji: '🐦', name: 'Twitter / X', path: 'twitter' },
                { emoji: '📌', name: 'Pinterest', path: 'pinterest' },
                { emoji: '👻', name: 'Snapchat', path: 'snapchat' },
              ].map((p) => (
                <a
                  key={p.path}
                  href={`/${locale}/${p.path}`}
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-teal-500 text-slate-300 hover:text-white rounded-full px-4 py-2 text-sm font-medium transition"
                >
                  <span>{p.emoji}</span>
                  <span>{p.name}</span>
                </a>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold text-white mb-4">Responsible Use</h2>
            <p className="mb-3">ReelGet is intended for personal, non-commercial use only. We strongly encourage all users to respect copyright laws and the Terms of Service of the platforms they download from. Please only download content you have the right to save, and do not redistribute downloaded videos without the original creator's permission.</p>
            <p>If you are a content creator and believe your content is being accessed improperly through our Service, please contact us at <span className="text-teal-400">legal@reelget.com</span>.</p>
          </div>

          <div>
            <h2 id="contact" className="text-xl font-bold text-white mb-4">Contact Us</h2>
            <p className="mb-4">We'd love to hear from you — whether it's a bug report, a feature request, or a general question.</p>
            <div className="space-y-2">
              <p>📧 General: <span className="text-teal-400">hello@reelget.com</span></p>
              <p>🔒 Privacy: <span className="text-teal-400">privacy@reelget.com</span></p>
              <p>⚖️ Legal / DMCA: <span className="text-teal-400">legal@reelget.com</span></p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-500 text-center py-10 px-4 text-sm border-t border-slate-800 mt-8">
        <div className="flex justify-center mb-3">
          <a href={`/${locale}`} className="bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent font-black text-xl">ReelGet</a>
        </div>
        <div className="flex justify-center gap-4 text-xs text-slate-500 mt-2">
          <a href={`/${locale}/privacy`} className="hover:text-teal-400 transition">Privacy Policy</a>
          <a href={`/${locale}/terms`} className="hover:text-teal-400 transition">Terms of Service</a>
          <a href={`/${locale}/about`} className="hover:text-teal-400 transition">About</a>
        </div>
      </footer>
    </div>
  );
}
