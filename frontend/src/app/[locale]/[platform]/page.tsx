import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import DownloaderForm from '@/components/DownloaderForm';
import { routing } from '@/../i18n/routing';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://reelget.com';
const LOCALES = ['en', 'hi', 'bn', 'id', 'ur', 'pt', 'ta', 'te', 'ar', 'vi', 'or', 'fr', 'sw', 'tl', 'ha', 'am'];
const PLATFORMS = ['instagram', 'tiktok', 'facebook', 'youtube', 'twitter', 'pinterest', 'snapchat'] as const;
type Platform = (typeof PLATFORMS)[number];

const PLATFORM_META: Record<Platform, {
  emoji: string;
  gradient: string;
  types: string;
  faq: { q: string; a: string }[];
}> = {
  instagram: {
    emoji: '📸',
    gradient: 'from-pink-500 to-purple-600',
    types: 'Reels, Posts & Stories',
    faq: [
      { q: 'Can I download Instagram Reels?', a: 'Yes! Paste any public Instagram Reel URL and click Download.' },
      { q: 'Can I download Instagram Stories?', a: 'Yes — Stories from public accounts can be downloaded.' },
      { q: 'Do I need to log in?', a: 'No login required for public content.' },
    ],
  },
  tiktok: {
    emoji: '🎵',
    gradient: 'from-slate-700 to-slate-900',
    types: 'Videos & Reels',
    faq: [
      { q: 'Can I download TikTok videos?', a: 'Yes! Paste any public TikTok video URL and click Download.' },
      { q: 'Does it work on TikTok Reels?', a: 'Yes, all public TikTok videos and Reels are supported.' },
      { q: 'Do I need to log in?', a: 'No — no account or app required.' },
    ],
  },
  facebook: {
    emoji: '👍',
    gradient: 'from-blue-600 to-blue-800',
    types: 'Videos & Reels',
    faq: [
      { q: 'Can I download Facebook Reels?', a: 'Yes! Paste any public Facebook Reel or video URL.' },
      { q: 'What about Facebook Watch videos?', a: 'Public Facebook Watch videos are fully supported.' },
      { q: 'Do I need to log in?', a: 'No login needed for public videos.' },
    ],
  },
  youtube: {
    emoji: '▶️',
    gradient: 'from-red-600 to-red-700',
    types: 'Videos & Shorts',
    faq: [
      { q: 'Can I download YouTube Shorts?', a: 'Yes, YouTube Shorts are fully supported.' },
      { q: 'Can I extract MP3 audio?', a: 'Yes! Use the "Extract MP3 / Audio" button to get audio only.' },
      { q: 'Why do some videos fail?', a: 'Only public videos can be downloaded. Age-restricted or private videos are not supported.' },
    ],
  },
  twitter: {
    emoji: '🐦',
    gradient: 'from-sky-500 to-blue-600',
    types: 'Videos & GIFs',
    faq: [
      { q: 'Can I download Twitter / X videos?', a: 'Yes! Paste any public tweet with a video or GIF.' },
      { q: 'What about GIFs posted on X?', a: 'Twitter/X GIFs are downloaded as MP4 video files.' },
      { q: 'Do I need to log in?', a: 'No login required for public tweets.' },
    ],
  },
  pinterest: {
    emoji: '📌',
    gradient: 'from-red-500 to-rose-700',
    types: 'Videos & Pins',
    faq: [
      { q: 'Can I download Pinterest videos?', a: 'Yes! Paste any Pinterest pin URL that contains a video.' },
      { q: 'What types of Pinterest content are supported?', a: 'Video pins are fully supported. Image-only pins cannot be downloaded.' },
      { q: 'Do I need to log in?', a: 'No — no account or app required for public pins.' },
    ],
  },
  snapchat: {
    emoji: '👻',
    gradient: 'from-yellow-400 to-amber-500',
    types: 'Spotlight & Stories',
    faq: [
      { q: 'Can I download Snapchat Spotlight videos?', a: 'Yes! Paste any public Snapchat Spotlight URL and click Download.' },
      { q: 'Can I download Snapchat Stories?', a: 'Public Snapchat Stories shared via web link can be downloaded.' },
      { q: 'Do I need a Snapchat account?', a: 'No account or app required for public Spotlight videos.' },
    ],
  },
};

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    PLATFORMS.map((platform) => ({ locale, platform }))
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; platform: string }>;
}): Promise<Metadata> {
  const { platform } = await params;
  if (!PLATFORMS.includes(platform as Platform)) return {};
  const p = PLATFORM_META[platform as Platform];
  const name = platform.charAt(0).toUpperCase() + platform.slice(1);
  const title = `${name} Video Downloader — Free ${p.types} | ReelGet`;
  const description = `Download ${name} ${p.types} for free. No app or login required. Fast and easy with ReelGet.`;
  const url = `${BASE_URL}/${locale}/${platform}`;
  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: {
        'x-default': `${BASE_URL}/en/${platform}`,
        ...Object.fromEntries(LOCALES.map((l) => [l, `${BASE_URL}/${l}/${platform}`])),
      },
    },
    openGraph: {
      title,
      description,
      url,
      siteName: 'ReelGet',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      site: '@reelget',
    },
  };
}

export default async function PlatformPage({
  params,
}: {
  params: Promise<{ locale: string; platform: string }>;
}) {
  const { locale, platform } = await params;
  if (!PLATFORMS.includes(platform as Platform)) notFound();

  const p = PLATFORM_META[platform as Platform];
  const name = platform.charAt(0).toUpperCase() + platform.slice(1);
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
          <a href={`/${locale}`} className="text-sm text-slate-500 hover:text-teal-600 font-medium transition">
            ← All Platforms
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative bg-slate-900 text-white py-20 px-4 overflow-hidden">
        <div className="absolute top-10 left-10 w-72 h-72 bg-cyan-500 rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-blob" />
        <div className="absolute top-20 right-10 w-72 h-72 bg-violet-600 rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-blob animation-delay-2" />

        <div className="relative max-w-3xl mx-auto text-center">
          <span className="text-5xl mb-4 block">{p.emoji}</span>
          <h1 className="text-4xl sm:text-5xl font-black mb-4 leading-tight">
            <span className={`bg-gradient-to-r ${p.gradient} bg-clip-text text-transparent`}>
              {name}
            </span>{' '}
            <span className="text-white">Downloader</span>
          </h1>
          <p className="text-slate-300 text-base sm:text-lg mb-8 max-w-xl mx-auto">
            Download {name} {p.types} free. No login, no app needed.
          </p>

          <DownloaderForm locale={locale} />
        </div>
      </section>

      {/* Platform FAQ */}
      <section className="max-w-3xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-white text-center mb-8">{name} Downloader FAQ</h2>
        <div className="space-y-4">
          {p.faq.map((item, i) => (
            <div key={i} className="bg-slate-800 rounded-xl p-5">
              <h3 className="text-white font-semibold mb-2">{item.q}</h3>
              <p className="text-slate-400 text-sm">{item.a}</p>
            </div>
          ))}
          <div className="bg-slate-800 rounded-xl p-5">
            <h3 className="text-white font-semibold mb-2">{t('faq.q1')}</h3>
            <p className="text-slate-400 text-sm">{t('faq.a1')}</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-5">
            <h3 className="text-white font-semibold mb-2">{t('faq.q3')}</h3>
            <p className="text-slate-400 text-sm">{t('faq.a3')}</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-500 text-center py-10 px-4 text-sm border-t border-slate-800">
        <div className="flex justify-center mb-3">
          <a href={`/${locale}`} className="bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent font-black text-xl">
            ReelGet
          </a>
        </div>
        <p className="mb-1 text-slate-400">{t('footer.tagline')}</p>
        <p className="text-xs text-slate-600 mt-3">{t('footer.disclaimer')}</p>
      </footer>
    </div>
  );
}
