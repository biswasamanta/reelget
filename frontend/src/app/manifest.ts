import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ReelGet — Video Downloader',
    short_name: 'ReelGet',
    description: 'Download videos from Instagram, TikTok, YouTube, Facebook & more — free, no login.',
    start_url: '/en',
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#22d3ee',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
    // Web Share Target API — lets Android users share URLs directly from
    // other apps (TikTok, Instagram, YouTube) into ReelGet via the share sheet.
    share_target: {
      action: '/en/share-target',
      method: 'GET',
      params: {
        title: 'title',
        text: 'text',
        url: 'url',
      },
    },
  };
}
