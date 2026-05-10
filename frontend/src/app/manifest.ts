import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ReelGet - Video Downloader',
    short_name: 'ReelGet',
    description: 'Download Instagram, TikTok, Facebook, Pinterest & YouTube videos free. No login required.',
    start_url: '/en',
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#22d3ee',
    orientation: 'portrait-primary',
    categories: ['utilities', 'entertainment'],
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Instagram Downloader',
        url: '/en/instagram',
        description: 'Download Instagram Reels & Stories',
      },
      {
        name: 'TikTok Downloader',
        url: '/en/tiktok',
        description: 'Download TikTok videos',
      },
      {
        name: 'YouTube Downloader',
        url: '/en/youtube',
        description: 'Download YouTube videos & Shorts',
      },
    ],
  };
}
