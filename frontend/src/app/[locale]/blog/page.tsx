import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://reelget.com';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: 'Blog — ReelGet Video Downloader Tips & Guides',
    description:
      'Step-by-step guides and tips on how to download videos from Instagram, TikTok, YouTube, Facebook and more — free, fast, and without watermarks.',
    alternates: { canonical: `${BASE_URL}/${locale}/blog` },
    openGraph: {
      title: 'Blog — ReelGet Video Downloader Tips & Guides',
      description:
        'Step-by-step guides and tips on how to download videos from Instagram, TikTok, YouTube, Facebook and more.',
      url: `${BASE_URL}/${locale}/blog`,
      siteName: 'ReelGet',
      type: 'website',
    },
  };
}

interface BlogPost {
  slug: string;
  title: string;
  description: string;
  emoji: string;
  date: string;
  readTime: string;
  category: string;
}

const POSTS: BlogPost[] = [
  {
    slug: 'how-to-download-instagram-reels-iphone',
    title: 'How to Download Instagram Reels on iPhone (2025)',
    description:
      'Step-by-step guide to saving Instagram Reels to your Camera Roll on iPhone — no app, no jailbreak needed.',
    emoji: '📸',
    date: '2025-05-10',
    readTime: '3 min',
    category: 'Instagram',
  },
  {
    slug: 'tiktok-downloader-without-watermark-guide',
    title: 'How to Download TikTok Videos Without Watermark',
    description:
      'The complete guide to saving clean, watermark-free TikTok videos to your phone or PC in seconds.',
    emoji: '🎵',
    date: '2025-05-08',
    readTime: '4 min',
    category: 'TikTok',
  },
  {
    slug: 'how-to-save-youtube-videos-free',
    title: 'How to Download YouTube Videos for Free (No Software)',
    description:
      'Save any public YouTube video or Short as MP4 or extract audio as MP3 — completely free, no Chrome extension.',
    emoji: '▶️',
    date: '2025-05-05',
    readTime: '3 min',
    category: 'YouTube',
  },
  {
    slug: 'how-to-download-facebook-videos',
    title: 'How to Save Facebook Videos to Your Phone',
    description:
      'Download Facebook videos and Reels to Android or iPhone in HD quality — no login, no app required.',
    emoji: '👍',
    date: '2025-05-01',
    readTime: '3 min',
    category: 'Facebook',
  },
  {
    slug: 'best-video-downloader-2025',
    title: 'Best Free Online Video Downloader Tools in 2025',
    description:
      'We compared the top free video downloader tools. Here\'s what works best for Instagram, TikTok, YouTube, and more.',
    emoji: '🏆',
    date: '2025-04-28',
    readTime: '5 min',
    category: 'Guide',
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  Instagram: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  TikTok: 'bg-slate-700/60 text-slate-200 border-slate-600',
  YouTube: 'bg-red-500/20 text-red-300 border-red-500/30',
  Facebook: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  Guide: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default async function BlogIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale });

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
          <a
            href={`/${locale}`}
            className="text-sm text-slate-500 hover:text-teal-600 font-medium transition"
          >
            ← Home
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative bg-slate-900 text-white py-20 px-4 text-center overflow-hidden">
        <div className="absolute top-10 left-10 w-72 h-72 bg-cyan-500 rounded-full mix-blend-screen filter blur-3xl opacity-10" />
        <div className="absolute top-20 right-10 w-72 h-72 bg-violet-600 rounded-full mix-blend-screen filter blur-3xl opacity-10" />
        <div className="relative max-w-2xl mx-auto">
          <span className="inline-flex items-center gap-1 bg-gradient-to-r from-cyan-500/20 to-violet-500/20 text-cyan-300 border border-cyan-400/40 text-xs font-bold px-4 py-1.5 rounded-full mb-5 tracking-wide uppercase">
            Tips &amp; Guides
          </span>
          <h1 className="text-4xl sm:text-5xl font-black mb-4">
            ReelGet{' '}
            <span className="bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">
              Blog
            </span>
          </h1>
          <p className="text-slate-300 text-lg max-w-xl mx-auto">
            How-to guides, tips, and tricks for downloading videos from every
            major platform — free, fast, and without watermarks.
          </p>
        </div>
      </section>

      {/* Post grid */}
      <main className="max-w-5xl mx-auto px-4 py-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {POSTS.map((post) => (
            <a
              key={post.slug}
              href={`/${locale}/blog/${post.slug}`}
              className="group flex flex-col bg-slate-900 border border-slate-800 hover:border-teal-500/60 rounded-2xl p-6 transition-all duration-200 hover:shadow-lg hover:shadow-teal-900/20 hover:-translate-y-0.5"
            >
              {/* Emoji */}
              <div className="text-4xl mb-4">{post.emoji}</div>

              {/* Category badge */}
              <span
                className={`inline-block self-start text-xs font-semibold px-2.5 py-0.5 rounded-full border mb-3 ${
                  CATEGORY_COLORS[post.category] ??
                  'bg-slate-700/60 text-slate-300 border-slate-600'
                }`}
              >
                {post.category}
              </span>

              {/* Title */}
              <h2 className="text-white font-bold text-base leading-snug mb-2 group-hover:text-teal-300 transition-colors">
                {post.title}
              </h2>

              {/* Description */}
              <p className="text-slate-400 text-sm leading-relaxed flex-1 mb-4">
                {post.description}
              </p>

              {/* Meta + CTA */}
              <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-800">
                <div className="text-xs text-slate-500 flex items-center gap-2">
                  <span>{formatDate(post.date)}</span>
                  <span className="text-slate-700">·</span>
                  <span>{post.readTime} read</span>
                </div>
                <span className="text-teal-400 text-xs font-semibold group-hover:translate-x-0.5 transition-transform">
                  Read more →
                </span>
              </div>
            </a>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-500 text-center py-10 px-4 text-sm border-t border-slate-800 mt-8">
        <div className="flex justify-center mb-3">
          <a
            href={`/${locale}`}
            className="bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent font-black text-xl"
          >
            ReelGet
          </a>
        </div>
        <p className="mb-1 text-slate-400">{t('footer.tagline')}</p>
        <p className="text-xs text-slate-600 mt-3">{t('footer.disclaimer')}</p>
        <div className="flex justify-center gap-4 text-xs text-slate-600 mt-4">
          <a href={`/${locale}/privacy`} className="hover:text-teal-400 transition">
            Privacy Policy
          </a>
          <a href={`/${locale}/terms`} className="hover:text-teal-400 transition">
            Terms of Service
          </a>
          <a href={`/${locale}/about`} className="hover:text-teal-400 transition">
            About
          </a>
        </div>
      </footer>
    </div>
  );
}
