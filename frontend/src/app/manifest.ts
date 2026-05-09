import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ReelGet - Video Downloader',
    short_name: 'ReelGet',
    description: 'Download Instagram, TikTok, Facebook & YouTube videos for free. No login required.',
    start_url: '/',
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
      },
      {
        src: '/icon',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}
