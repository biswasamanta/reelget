'use client';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';

type Platform = {
  key: string;
  emoji: string;
  label: string;
  desc: string;
  badge: string;
  badgeColor: string;
  gradient: string;
  shadow: string;
  links: { label: string; slug: string }[];
};

const PLATFORMS: Platform[] = [
  {
    key: 'instagram',
    emoji: '📸',
    label: 'Instagram',
    desc: 'Reels, Posts & Stories',
    badge: '✓ BEST',
    badgeColor: 'bg-pink-500/20 text-pink-300 border-pink-400/30',
    gradient: 'from-pink-500 via-rose-500 to-orange-400',
    shadow: 'shadow-pink-500/40',
    links: [
      { label: 'Reels downloader', slug: 'instagram-reels-downloader' },
      { label: 'Story downloader', slug: 'instagram-story-downloader' },
    ],
  },
  {
    key: 'tiktok',
    emoji: '🎵',
    label: 'TikTok',
    desc: 'Videos without watermark',
    badge: '✓ BEST',
    badgeColor: 'bg-pink-500/20 text-pink-300 border-pink-400/30',
    gradient: 'from-slate-700 via-pink-600 to-cyan-500',
    shadow: 'shadow-pink-500/30',
    links: [
      { label: 'No watermark', slug: 'tiktok-downloader-no-watermark' },
    ],
  },
  {
    key: 'facebook',
    emoji: '👍',
    label: 'Facebook',
    desc: 'Videos & Reels',
    badge: '✓ BEST',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-400/30',
    gradient: 'from-blue-600 via-blue-500 to-cyan-400',
    shadow: 'shadow-blue-500/40',
    links: [
      { label: 'Reels downloader', slug: 'facebook-reels-downloader' },
    ],
  },
  {
    key: 'twitter',
    emoji: '🐦',
    label: 'Twitter / X',
    desc: 'Videos & GIFs',
    badge: '✓ NEW',
    badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-400/30',
    gradient: 'from-sky-500 via-blue-500 to-cyan-400',
    shadow: 'shadow-sky-500/30',
    links: [
      { label: 'Video downloader', slug: 'twitter-video-downloader' },
    ],
  },
  {
    key: 'pinterest',
    emoji: '📌',
    label: 'Pinterest',
    desc: 'Videos & Pins',
    badge: '✓ NEW',
    badgeColor: 'bg-red-500/20 text-red-300 border-red-400/30',
    gradient: 'from-red-500 via-rose-600 to-red-700',
    shadow: 'shadow-red-500/30',
    links: [],
  },
  {
    key: 'snapchat',
    emoji: '👻',
    label: 'Snapchat',
    desc: 'Spotlight & Stories',
    badge: '✓ NEW',
    badgeColor: 'bg-yellow-400/20 text-yellow-300 border-yellow-400/30',
    gradient: 'from-yellow-400 via-yellow-300 to-amber-400',
    shadow: 'shadow-yellow-400/30',
    links: [],
  },
  {
    key: 'reddit',
    emoji: '🤖',
    label: 'Reddit',
    desc: 'Videos & GIFs',
    badge: '✓ NEW',
    badgeColor: 'bg-orange-500/20 text-orange-300 border-orange-400/30',
    gradient: 'from-orange-500 via-red-500 to-orange-600',
    shadow: 'shadow-orange-500/30',
    links: [
      { label: 'Video downloader', slug: 'reddit-video-downloader' },
    ],
  },
  {
    key: 'linkedin',
    emoji: '💼',
    label: 'LinkedIn',
    desc: 'Videos & Posts',
    badge: '✓ NEW',
    badgeColor: 'bg-blue-600/20 text-blue-300 border-blue-500/30',
    gradient: 'from-blue-700 via-blue-600 to-sky-500',
    shadow: 'shadow-blue-600/30',
    links: [
      { label: 'Video downloader', slug: 'linkedin-video-downloader' },
    ],
  },
  {
    key: 'vimeo',
    emoji: '🎬',
    label: 'Vimeo',
    desc: 'HD Videos',
    badge: '✓ NEW',
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/30',
    gradient: 'from-cyan-500 via-teal-500 to-cyan-600',
    shadow: 'shadow-cyan-500/30',
    links: [
      { label: 'HD downloader', slug: 'vimeo-downloader' },
    ],
  },
  {
    key: 'dailymotion',
    emoji: '📺',
    label: 'Dailymotion',
    desc: 'Videos & Clips',
    badge: '✓ NEW',
    badgeColor: 'bg-blue-400/20 text-blue-300 border-blue-300/30',
    gradient: 'from-blue-500 via-indigo-500 to-blue-600',
    shadow: 'shadow-blue-500/30',
    links: [
      { label: 'Video downloader', slug: 'dailymotion-downloader' },
    ],
  },
  {
    key: 'twitch',
    emoji: '🎮',
    label: 'Twitch',
    desc: 'Clips & VODs',
    badge: '✓ NEW',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-400/30',
    gradient: 'from-purple-600 via-violet-600 to-purple-700',
    shadow: 'shadow-purple-500/30',
    links: [
      { label: 'Clips downloader', slug: 'twitch-clips-downloader' },
    ],
  },
  {
    key: 'youtube',
    emoji: '▶️',
    label: 'YouTube',
    desc: 'Videos & Shorts — public only',
    badge: 'PUBLIC ONLY',
    badgeColor: 'bg-slate-700 text-slate-400 border-transparent',
    gradient: 'from-red-600 via-red-500 to-orange-500',
    shadow: 'shadow-red-500/30',
    links: [
      { label: 'Shorts downloader', slug: 'youtube-shorts-downloader' },
      { label: 'YouTube to MP3', slug: 'youtube-to-mp3' },
    ],
  },
];

export default function PlatformBadges() {
  const t = useTranslations('platforms');
  const locale = useLocale();

  return (
    <section className="py-12 px-4 bg-gradient-to-b from-slate-800 to-slate-900">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-center text-xl font-bold text-white mb-2">{t('title')}</h2>
        <p className="text-center text-slate-400 text-sm mb-8">
          12 platforms supported — click any to get a dedicated downloader page
        </p>

        {/* Featured 3 — Instagram, TikTok, Facebook */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          {PLATFORMS.slice(0, 3).map((p) => (
            <PlatformCard key={p.key} p={p} locale={locale} featured />
          ))}
        </div>

        {/* Second row — Twitter, Pinterest, Snapchat */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          {PLATFORMS.slice(3, 6).map((p) => (
            <PlatformCard key={p.key} p={p} locale={locale} />
          ))}
        </div>

        {/* Third row — Reddit, LinkedIn, Vimeo */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          {PLATFORMS.slice(6, 9).map((p) => (
            <PlatformCard key={p.key} p={p} locale={locale} />
          ))}
        </div>

        {/* Fourth row — Dailymotion, Twitch, YouTube */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PLATFORMS.slice(9, 12).map((p) => (
            <PlatformCard key={p.key} p={p} locale={locale} />
          ))}
        </div>

        {/* Browse all landing pages CTA */}
        <div className="mt-8 text-center">
          <p className="text-slate-500 text-xs mb-3">Looking for something specific?</p>
          <div className="flex flex-wrap justify-center gap-2">
            {[
              { label: 'Instagram Reels', slug: 'instagram-reels-downloader' },
              { label: 'Instagram Stories', slug: 'instagram-story-downloader' },
              { label: 'TikTok no watermark', slug: 'tiktok-downloader-no-watermark' },
              { label: 'YouTube Shorts', slug: 'youtube-shorts-downloader' },
              { label: 'YouTube to MP3', slug: 'youtube-to-mp3' },
              { label: 'Facebook Reels', slug: 'facebook-reels-downloader' },
              { label: 'Twitter videos', slug: 'twitter-video-downloader' },
              { label: 'Reddit videos', slug: 'reddit-video-downloader' },
              { label: 'LinkedIn videos', slug: 'linkedin-video-downloader' },
              { label: 'Vimeo HD', slug: 'vimeo-downloader' },
              { label: 'Dailymotion', slug: 'dailymotion-downloader' },
              { label: 'Twitch clips', slug: 'twitch-clips-downloader' },
            ].map(({ label, slug }) => (
              <Link
                key={slug}
                href={`/${locale}/${slug}`}
                className="text-xs bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-600/50 hover:border-slate-500 px-3 py-1.5 rounded-full transition"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function PlatformCard({ p, locale, featured = false }: { p: Platform; locale: string; featured?: boolean }) {
  return (
    <div className={`relative bg-gradient-to-br ${p.gradient} p-px rounded-2xl shadow-xl ${p.shadow}`}>
      <div className="bg-slate-900 rounded-2xl overflow-hidden hover:bg-slate-800 transition">
        {/* Main platform link */}
        <Link
          href={`/${locale}/${p.key}`}
          className={`flex items-center gap-3 px-4 ${featured ? 'py-5' : 'py-4'}`}
        >
          <div className={`${featured ? 'w-12 h-12' : 'w-10 h-10'} rounded-xl bg-gradient-to-br ${p.gradient} flex items-center justify-center text-xl shadow-lg flex-shrink-0`}>
            {p.emoji}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-white font-bold text-sm">{p.label}</span>
              <span className={`${p.badgeColor} text-[9px] font-bold px-1.5 py-0.5 rounded-full border`}>{p.badge}</span>
            </div>
            <p className="text-slate-400 text-xs leading-tight truncate">{p.desc}</p>
          </div>
        </Link>

        {/* Sub-links to landing pages */}
        {p.links.length > 0 && (
          <div className="border-t border-slate-700/60 px-4 py-2 flex flex-wrap gap-x-3 gap-y-1">
            {p.links.map(({ label, slug }) => (
              <Link
                key={slug}
                href={`/${locale}/${slug}`}
                className="text-[10px] text-slate-400 hover:text-teal-400 transition flex items-center gap-1"
              >
                <span className="text-teal-500">↗</span> {label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
