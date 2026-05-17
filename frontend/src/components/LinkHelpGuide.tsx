'use client';

import { useState } from 'react';

const PLATFORMS = [
  {
    name: 'Instagram',
    emoji: '📸',
    color: 'from-pink-500 to-purple-500',
    steps: [
      'Open the Reel, post or Story in the Instagram app',
      'Tap the ⋯ (three dots) menu on the post',
      'Tap "Copy link"',
      'Paste it into the box above and hit Download',
    ],
  },
  {
    name: 'TikTok',
    emoji: '🎵',
    color: 'from-slate-600 to-slate-800',
    steps: [
      'Open the TikTok video you want to save',
      'Tap the Share arrow (➜) on the right side',
      'Tap "Copy link"',
      'Paste it into the box above and hit Download',
    ],
  },
  {
    name: 'YouTube',
    emoji: '▶️',
    color: 'from-red-500 to-red-700',
    steps: [
      'Open the YouTube video or Short',
      'Tap "Share" below the video',
      'Tap "Copy link"',
      'Paste it into the box above and hit Download',
    ],
  },
  {
    name: 'Facebook',
    emoji: '👍',
    color: 'from-blue-600 to-blue-800',
    steps: [
      'Open the Facebook video or Reel',
      'Tap the ⋯ (three dots) or Share button',
      'Select "Copy link"',
      'Paste it into the box above and hit Download',
    ],
  },
  {
    name: 'Twitter / X',
    emoji: '🐦',
    color: 'from-sky-500 to-blue-600',
    steps: [
      'Open the tweet containing the video',
      'Tap the Share icon (↗) on the tweet',
      'Select "Copy link to Tweet"',
      'Paste it into the box above and hit Download',
    ],
  },
  {
    name: 'Pinterest',
    emoji: '📌',
    color: 'from-red-500 to-rose-700',
    steps: [
      'Open the Pinterest pin with the video',
      'Tap the Share icon or ⋯ menu',
      'Select "Copy link"',
      'Paste it into the box above and hit Download',
    ],
  },
  {
    name: 'Snapchat',
    emoji: '👻',
    color: 'from-yellow-400 to-amber-500',
    steps: [
      'Open the public Spotlight video or Story',
      'Tap the Share button',
      'Select "Copy link"',
      'Paste it into the box above and hit Download',
    ],
  },
  {
    name: 'LinkedIn',
    emoji: '💼',
    color: 'from-blue-600 to-blue-800',
    steps: [
      'Open the LinkedIn post with the video',
      'Tap the ⋯ (three dots) on the post',
      'Select "Copy link to post"',
      'Paste it into the box above and hit Download',
    ],
  },
  {
    name: 'Reddit',
    emoji: '🤖',
    color: 'from-orange-500 to-red-600',
    steps: [
      'Open the Reddit post with the video',
      'Tap "Share" below the post',
      'Select "Copy link"',
      'Paste it into the box above and hit Download',
    ],
  },
  {
    name: 'Twitch',
    emoji: '🎮',
    color: 'from-purple-600 to-violet-700',
    steps: [
      'Open the Twitch Clip you want to save',
      'Copy the URL from your browser address bar',
      '(clips.twitch.tv/... or twitch.tv/.../clip/...)',
      'Paste it into the box above and hit Download',
    ],
  },
] as const;

export default function LinkHelpGuide() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition mx-auto"
      >
        <span>❓ How do I copy the link?</span>
        <span className="text-[10px]">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-3 bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          {/* Platform tabs — scrollable row */}
          <div className="flex gap-1.5 overflow-x-auto p-3 pb-0 scrollbar-hide">
            {PLATFORMS.map((p, i) => (
              <button
                key={p.name}
                onClick={() => setActive(i)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition flex-shrink-0 ${
                  active === i
                    ? 'bg-white text-slate-800'
                    : 'text-white/50 hover:text-white/80 hover:bg-white/10'
                }`}
              >
                <span>{p.emoji}</span>
                <span>{p.name}</span>
              </button>
            ))}
          </div>

          {/* Steps for active platform */}
          <div className="p-4">
            <div className={`text-xs font-bold bg-gradient-to-r ${PLATFORMS[active].color} bg-clip-text text-transparent mb-3`}>
              {PLATFORMS[active].emoji} How to copy a {PLATFORMS[active].name} link
            </div>
            <ol className="space-y-2">
              {PLATFORMS[active].steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2.5 text-xs text-white/70">
                  <span className="w-5 h-5 rounded-full bg-white/10 text-white/60 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
