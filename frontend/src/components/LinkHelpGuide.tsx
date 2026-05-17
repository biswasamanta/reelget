'use client';

import { useState } from 'react';

const PLATFORMS = [
  {
    name: 'Instagram',
    emoji: '📸',
    color: 'from-pink-500 to-purple-500',
    bg: 'bg-pink-500/10',
    border: 'border-pink-500/30',
    text: 'text-pink-400',
    steps: [
      { icon: '📱', text: 'Open the Instagram app and find the Reel, post or Story' },
      { icon: '⋯', text: 'Tap the three-dot menu (⋯) on the post' },
      { icon: '🔗', text: 'Tap "Copy link"' },
      { icon: '📋', text: 'Paste into the box above and tap Download' },
    ],
    tip: 'Works for Reels (/reel/), video posts (/p/), and public Stories.',
    example: 'instagram.com/reel/ABC123...',
    desktopNote: 'On desktop: right-click the post date/time → "Copy link"',
  },
  {
    name: 'TikTok',
    emoji: '🎵',
    color: 'from-slate-500 to-slate-800',
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/30',
    text: 'text-slate-300',
    steps: [
      { icon: '📱', text: 'Open TikTok and find the video you want to save' },
      { icon: '➜', text: 'Tap the Share arrow on the right side of the screen' },
      { icon: '🔗', text: 'Tap "Copy link" from the share sheet' },
      { icon: '📋', text: 'Paste into the box above and tap Download' },
    ],
    tip: 'Short vm.tiktok.com links work too — no need to convert them.',
    example: 'tiktok.com/@user/video/123... or vm.tiktok.com/ABC...',
    desktopNote: 'On desktop: click Share → Copy link from the video page.',
  },
  {
    name: 'YouTube',
    emoji: '▶️',
    color: 'from-red-500 to-red-700',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
    steps: [
      { icon: '📱', text: 'Open the YouTube app or website and find the video or Short' },
      { icon: '↗', text: 'Tap the Share button below the video' },
      { icon: '🔗', text: 'Tap "Copy link"' },
      { icon: '📋', text: 'Paste into the box above and tap Download' },
    ],
    tip: 'Only public, non-age-restricted videos work. Shorts use youtube.com/shorts/ URLs.',
    example: 'youtube.com/watch?v=ABC... or youtu.be/ABC...',
    desktopNote: 'On desktop: copy the URL directly from the browser address bar.',
  },
  {
    name: 'Facebook',
    emoji: '👍',
    color: 'from-blue-600 to-blue-800',
    bg: 'bg-blue-600/10',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    steps: [
      { icon: '📱', text: 'Open Facebook and find the video or Reel' },
      { icon: '⋯', text: 'Tap the three-dot menu (⋯) on the post' },
      { icon: '🔗', text: 'Tap "Copy link"' },
      { icon: '📋', text: 'Paste into the box above and tap Download' },
    ],
    tip: 'Short fb.watch links also work — paste them directly.',
    example: 'facebook.com/reel/123... or fb.watch/ABC...',
    desktopNote: 'On desktop: right-click on the video timestamp and select "Copy link".',
  },
  {
    name: 'Twitter / X',
    emoji: '🐦',
    color: 'from-sky-500 to-blue-600',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/30',
    text: 'text-sky-400',
    steps: [
      { icon: '📱', text: 'Open Twitter/X and find the tweet with the video or GIF' },
      { icon: '↗', text: 'Tap the Share icon (↗) on the tweet' },
      { icon: '🔗', text: 'Select "Copy link to Tweet"' },
      { icon: '📋', text: 'Paste into the box above and tap Download' },
    ],
    tip: 'Copy the tweet URL — not the video embed URL. Both twitter.com and x.com links work.',
    example: 'twitter.com/user/status/123... or x.com/user/status/123...',
    desktopNote: 'On desktop: right-click the tweet timestamp → "Copy link to Tweet".',
  },
  {
    name: 'Pinterest',
    emoji: '📌',
    color: 'from-red-500 to-rose-700',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-rose-400',
    steps: [
      { icon: '📱', text: 'Open Pinterest and find the video pin' },
      { icon: '↗', text: 'Tap the Share icon on the pin' },
      { icon: '🔗', text: 'Select "Copy link"' },
      { icon: '📋', text: 'Paste into the box above and tap Download' },
    ],
    tip: 'Only video pins work. Image-only pins cannot be downloaded.',
    example: 'pinterest.com/pin/123... or pin.it/ABC...',
    desktopNote: 'On desktop: copy the URL from the browser address bar on the pin page.',
  },
  {
    name: 'Snapchat',
    emoji: '👻',
    color: 'from-yellow-400 to-amber-500',
    bg: 'bg-yellow-400/10',
    border: 'border-yellow-400/30',
    text: 'text-yellow-400',
    steps: [
      { icon: '📱', text: 'Open a public Spotlight video or Story on Snapchat' },
      { icon: '↗', text: 'Tap the Share button' },
      { icon: '🔗', text: 'Select "Copy link"' },
      { icon: '📋', text: 'Paste into the box above and tap Download' },
    ],
    tip: 'Only public Spotlight videos and publicly shared Stories work.',
    example: 'snapchat.com/spotlight/... or story.snapchat.com/...',
    desktopNote: 'On desktop: copy the URL from the browser address bar.',
  },
  {
    name: 'LinkedIn',
    emoji: '💼',
    color: 'from-blue-600 to-blue-800',
    bg: 'bg-blue-600/10',
    border: 'border-blue-500/30',
    text: 'text-blue-300',
    steps: [
      { icon: '📱', text: 'Open LinkedIn and find the post with the video' },
      { icon: '⋯', text: 'Tap the three-dot menu (⋯) on the post' },
      { icon: '🔗', text: 'Tap "Copy link to post"' },
      { icon: '📋', text: 'Paste into the box above and tap Download' },
    ],
    tip: 'Only native LinkedIn video posts work. LinkedIn Learning videos are not supported.',
    example: 'linkedin.com/posts/username_activity-123...',
    desktopNote: 'On desktop: click ⋯ on the post → "Copy link to post".',
  },
  {
    name: 'Reddit',
    emoji: '🤖',
    color: 'from-orange-500 to-red-600',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    text: 'text-orange-400',
    steps: [
      { icon: '📱', text: 'Open Reddit and find the post with the video' },
      { icon: '↗', text: 'Tap the Share button below the post' },
      { icon: '🔗', text: 'Select "Copy link"' },
      { icon: '📋', text: 'Paste into the box above and tap Download' },
    ],
    tip: 'ReelGet merges Reddit\'s audio + video streams automatically — no silent downloads.',
    example: 'reddit.com/r/sub/comments/abc/... or redd.it/ABC...',
    desktopNote: 'On desktop: click Share → Copy link below the post.',
  },
  {
    name: 'Twitch',
    emoji: '🎮',
    color: 'from-purple-600 to-violet-700',
    bg: 'bg-purple-600/10',
    border: 'border-purple-500/30',
    text: 'text-purple-400',
    steps: [
      { icon: '💻', text: 'Open the Twitch Clip in your browser' },
      { icon: '🔗', text: 'Copy the URL from the browser address bar' },
      { icon: '✅', text: 'Make sure it says clips.twitch.tv/... or twitch.tv/.../clip/...' },
      { icon: '📋', text: 'Paste into the box above and tap Download' },
    ],
    tip: 'Only Clips work — not live streams or full VODs.',
    example: 'clips.twitch.tv/ClipName or twitch.tv/user/clip/ClipName',
    desktopNote: 'Twitch Clips are desktop-first — just copy from the address bar.',
  },
] as const;

const FLOW_STEPS = ['Open App', 'Find Video', 'Tap Share', 'Copy Link', 'Paste & Download'];

export default function LinkHelpGuide() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const platform = PLATFORMS[active];

  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition mx-auto"
      >
        <span>❓ How do I copy the link?</span>
        <span className="text-[10px] transition-transform" style={{ display: 'inline-block', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
      </button>

      {open && (
        <div className="mt-3 bg-white/5 border border-white/10 rounded-2xl overflow-hidden">

          {/* Mini flow diagram */}
          <div className="flex items-center justify-center gap-0 px-4 pt-4 pb-2 overflow-x-auto">
            {FLOW_STEPS.map((step, i) => (
              <div key={i} className="flex items-center shrink-0">
                <div className={`text-[10px] font-semibold px-2 py-1 rounded-lg ${i === 3 ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30' : 'text-white/40'}`}>
                  {step}
                </div>
                {i < FLOW_STEPS.length - 1 && (
                  <span className="text-white/20 text-[10px] mx-0.5">→</span>
                )}
              </div>
            ))}
          </div>

          {/* Platform tabs */}
          <div className="flex gap-1.5 overflow-x-auto px-3 py-2 scrollbar-hide">
            {PLATFORMS.map((p, i) => (
              <button
                key={p.name}
                onClick={() => setActive(i)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition flex-shrink-0 ${
                  active === i ? 'bg-white text-slate-800' : 'text-white/50 hover:text-white/80 hover:bg-white/10'
                }`}
              >
                <span>{p.emoji}</span>
                <span className="hidden sm:inline">{p.name}</span>
              </button>
            ))}
          </div>

          {/* Active platform card */}
          <div className={`mx-3 mb-3 rounded-xl border ${platform.border} ${platform.bg} p-4`}>
            {/* Platform header */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">{platform.emoji}</span>
              <div>
                <p className={`font-bold text-sm bg-gradient-to-r ${platform.color} bg-clip-text text-transparent`}>
                  {platform.name}
                </p>
                <p className="text-[10px] text-white/40">Copy link in 4 steps</p>
              </div>
            </div>

            {/* Steps */}
            <ol className="space-y-2.5 mb-4">
              {platform.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${platform.color} flex items-center justify-center text-white text-xs font-black shrink-0`}>
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <span className="text-xs text-white/80">{step.text}</span>
                  </div>
                </li>
              ))}
            </ol>

            {/* Example URL */}
            <div className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-2 mb-3">
              <span className="text-[10px] text-white/30 shrink-0">URL looks like:</span>
              <span className="font-mono text-[10px] text-cyan-400 truncate">{platform.example}</span>
            </div>

            {/* Pro tip */}
            <div className="flex gap-2 items-start bg-white/5 rounded-lg p-3 mb-2">
              <span className="text-sm shrink-0">💡</span>
              <p className="text-[11px] text-white/60 leading-relaxed">{platform.tip}</p>
            </div>

            {/* Desktop note */}
            <div className="flex gap-2 items-start">
              <span className="text-sm shrink-0">🖥️</span>
              <p className="text-[11px] text-white/40 leading-relaxed">{platform.desktopNote}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
