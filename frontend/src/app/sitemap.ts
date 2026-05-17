import { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://reelget.com';
const LOCALES = ['en', 'hi', 'bn', 'id', 'ur', 'pt', 'ta', 'te', 'ar', 'vi', 'or', 'fr', 'sw', 'tl', 'ha', 'am', 'es', 'ru', 'tr', 'th', 'ko', 'yo', 'ig', 'zu', 'so', 'om', 'rw'];
const PLATFORMS = ['instagram', 'tiktok', 'facebook', 'youtube', 'twitter', 'pinterest', 'snapchat', 'linkedin', 'reddit', 'vimeo', 'dailymotion', 'twitch'];
const BLOG_SLUGS = [
  'how-to-download-instagram-reels-iphone',
  'tiktok-downloader-without-watermark-guide',
  'how-to-save-youtube-videos-free',
  'how-to-download-facebook-videos',
  'best-video-downloader-2025',
];

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
    'reddit-video-downloader',
    'linkedin-video-downloader',
    'vimeo-downloader',
    'dailymotion-downloader',
    'twitch-clips-downloader',
    'save-instagram-reels-iphone',
    'instagram-reel-downloader-android',
    'instagram-video-downloader-online',
    'download-tiktok-without-app',
    'save-tiktok-video-android',
    'tiktok-video-saver-online',
    'facebook-video-downloader-hd',
    'youtube-video-downloader-mp4',
    'youtube-shorts-to-mp4',
    'download-twitter-video-online',
    'pinterest-video-downloader-free',
    'snapchat-story-saver',
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

  // Blog index pages (all locales)
  const blogIndexPages: MetadataRoute.Sitemap = LOCALES.map((locale) => ({
    url: `${BASE_URL}/${locale}/blog`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  // Blog post pages (English only — canonical)
  const blogPostPages: MetadataRoute.Sitemap = BLOG_SLUGS.map((slug) => ({
    url: `${BASE_URL}/en/blog/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));

  return [...localePages, ...platformPages, ...landingPages, ...staticPages, ...blogIndexPages, ...blogPostPages];
}
