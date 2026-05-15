import { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://reelget.com';
const LOCALES = ['en', 'hi', 'bn', 'id', 'ur', 'pt', 'ta', 'te', 'ar', 'vi', 'or', 'fr', 'sw', 'tl', 'ha', 'am', 'es', 'ru', 'tr', 'th', 'ko'];
const PLATFORMS = ['instagram', 'tiktok', 'facebook', 'youtube', 'twitter', 'pinterest', 'snapchat'];

export default function sitemap(): MetadataRoute.Sitemap {
  const localePages: MetadataRoute.Sitemap = LOCALES.map((locale) => ({
    url: `${BASE_URL}/${locale}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: locale === 'hi' || locale === 'bn' ? 1.0 : 0.8,
    alternates: {
      languages: Object.fromEntries(
        LOCALES.map((l) => [l, `${BASE_URL}/${l}`])
      ),
    },
  }));

  const platformPages: MetadataRoute.Sitemap = LOCALES.flatMap((locale) =>
    PLATFORMS.map((platform) => ({
      url: `${BASE_URL}/${locale}/${platform}`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    }))
  );

  const landingPages: MetadataRoute.Sitemap = [
    'instagram-reels-downloader',
    'instagram-story-downloader',
    'tiktok-downloader-no-watermark',
    'youtube-shorts-downloader',
    'youtube-to-mp3',
    'facebook-reels-downloader',
    'twitter-video-downloader',
  ].map((slug) => ({
    url: `${BASE_URL}/en/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));

  const staticPages: MetadataRoute.Sitemap = ['about', 'privacy', 'terms'].map((slug) => ({
    url: `${BASE_URL}/en/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'yearly' as const,
    priority: 0.4,
  }));

  return [...localePages, ...platformPages, ...landingPages, ...staticPages];
}
