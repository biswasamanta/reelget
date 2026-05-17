import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import FaqAccordion from './FaqAccordion';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://reelget.com';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Step {
  title: string;
  body: string;
}
interface FaqItem {
  q: string;
  a: string;
}
interface BlogPost {
  slug: string;
  title: string;
  description: string;
  emoji: string;
  date: string;
  readTime: string;
  category: string;
  intro: string;
  steps: Step[];
  body: string[];
  faq: FaqItem[];
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------
const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'how-to-download-instagram-reels-iphone',
    title: 'How to Download Instagram Reels on iPhone (2025)',
    description:
      'Step-by-step guide to saving Instagram Reels to your Camera Roll on iPhone — no app, no jailbreak needed.',
    emoji: '📸',
    date: '2025-05-10',
    readTime: '3 min',
    category: 'Instagram',
    intro:
      'Saving an Instagram Reel to your iPhone used to require a third-party app download, a convoluted shortcut, or even a jailbreak. In 2025, all you need is a browser. ReelGet lets you paste any public Instagram Reel URL and download the video file directly to your Camera Roll in seconds — no account, no app, no jailbreak required.',
    steps: [
      {
        title: 'Copy the Reel link',
        body: 'Open Instagram and find the Reel you want to save. Tap the three-dot menu (⋯) on the post and select "Copy link". The URL is now in your clipboard.',
      },
      {
        title: 'Open ReelGet in Safari',
        body: "On your iPhone, open Safari (or any browser) and go to reelget.com. You'll see a single input box in the centre of the page.",
      },
      {
        title: 'Paste the link and tap Download',
        body: "Tap inside the input box, paste the copied Instagram URL, then tap the \"Download\" button. ReelGet will fetch the video from Instagram's servers.",
      },
      {
        title: 'Save the video to your Camera Roll',
        body: 'A download link will appear within a few seconds. Tap and hold the video thumbnail, then select "Save to Photos". The Reel is now saved to your iPhone Camera Roll.',
      },
      {
        title: 'Share or edit as you like',
        body: 'The saved video is a standard .mp4 file. You can share it via iMessage, WhatsApp, edit it in iMovie, or re-post it — exactly like any other video on your phone.',
      },
    ],
    body: [
      'Instagram Reels downloaded via ReelGet retain their original quality. We fetch the highest-resolution version available for the public URL you provide — typically 1080p for most modern Reels.',
      "One important note: ReelGet can only download public content. If the account is set to private or the Reel has been deleted, the download will not work. Always make sure the content you download is something you have a right to save, and respect the original creator's copyright.",
      'Looking to download Instagram Stories instead? ReelGet supports those too — just paste the Story URL (available by tapping the share icon on a Story) and follow the same steps above.',
    ],
    faq: [
      {
        q: 'Is it safe to use ReelGet to download Instagram Reels on iPhone?',
        a: 'Yes. ReelGet does not request your Instagram credentials, does not store your URLs, and does not install anything on your device. All processing happens on our servers and the result is a direct video file download.',
      },
      {
        q: 'Why is the video saved as a file instead of going straight to Camera Roll?',
        a: 'Safari on iOS downloads files to the Files app by default. To move it to your Camera Roll, open the Files app, locate the downloaded .mp4, tap and hold, then choose "Save to Photos".',
      },
      {
        q: 'Can I download Instagram Reels on iPhone without any app?',
        a: "Yes — that's exactly what ReelGet is for. You use it entirely in your browser with no installation step.",
      },
      {
        q: 'Does ReelGet work for Instagram Stories and Posts too?',
        a: 'Yes. ReelGet supports Instagram Reels, Posts (images and videos), and Stories. Just paste the URL of any public Instagram content.',
      },
    ],
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
    intro:
      "Every TikTok video carries a watermark — the creator's username and the TikTok logo — when you save it natively through the app. If you want a clean version to edit, re-post on another platform, or simply archive without the overlay, ReelGet lets you download TikTok videos without a watermark in a few simple steps, completely free.",
    steps: [
      {
        title: 'Find the TikTok video you want to save',
        body: 'Open TikTok on your phone or visit tiktok.com on desktop. Navigate to the video you want to download.',
      },
      {
        title: 'Copy the video link',
        body: 'On mobile: tap the Share icon (arrow pointing right) and then tap "Copy link". On desktop: click the Share button and select "Copy link". The URL is now in your clipboard.',
      },
      {
        title: 'Go to ReelGet',
        body: 'Open a new browser tab and visit reelget.com. You can use any browser — Chrome, Safari, Firefox — on any device.',
      },
      {
        title: 'Paste the link and click Download',
        body: "Tap the input box on ReelGet, paste your TikTok URL, and press the Download button. ReelGet will process the request and retrieve the watermark-free version directly from TikTok's content delivery network.",
      },
      {
        title: 'Choose your download option',
        body: 'ReelGet typically offers the HD (1080p) and SD (720p) versions of the video. Tap your preferred option and the file will download to your device.',
      },
      {
        title: 'Save to your gallery',
        body: 'On Android the file goes straight to your Downloads folder. On iPhone, move it from Files to Camera Roll by tapping and holding the file and selecting "Save to Photos".',
      },
    ],
    body: [
      "Why does TikTok add watermarks in the first place? The watermark serves two purposes: branding for TikTok, and attribution for the creator. When you download through the TikTok app, the watermark is baked into the video. ReelGet bypasses this by fetching the original source file before the watermark overlay is applied.",
      "Note that some TikTok creators have disabled downloads on their videos. If the video cannot be downloaded, ReelGet will display an error. In those cases, the creator has intentionally restricted access and you should respect that choice.",
      'ReelGet also works for TikTok Slideshows (photo posts with music). You can download each image individually, or download the video version of the Slideshow as a standard .mp4 file.',
    ],
    faq: [
      {
        q: 'Is downloading TikTok videos without watermark legal?',
        a: "This depends on your jurisdiction and how you intend to use the video. Downloading for personal, offline viewing is generally acceptable. Redistributing or monetising a creator's content without permission is a violation of copyright law. Always credit original creators when sharing their work.",
      },
      {
        q: 'Why does the downloaded TikTok video still have a watermark?',
        a: 'Make sure you are using the Share → Copy Link method in TikTok, not saving the video natively through TikTok (which embeds the watermark). ReelGet can only remove the watermark from the original source file; if you saved the video from within TikTok first, the watermark is already burned in.',
      },
      {
        q: 'Can I download TikTok videos on an iPhone without watermark?',
        a: 'Yes. Open Safari, go to reelget.com, paste your TikTok link, and download. The video file lands in your Files app; move it to Camera Roll by saving it to Photos.',
      },
      {
        q: 'Does ReelGet work for TikTok Live replays?',
        a: "TikTok Live replays are not always publicly accessible after the stream ends. ReelGet can attempt to download them if the URL is public and still active, but availability depends on TikTok's own policies.",
      },
    ],
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
    intro:
      'Downloading YouTube videos used to mean installing browser extensions, desktop software, or paying for premium services. In 2025 you can save any public YouTube video — including Shorts — directly to your device as an MP4 video or MP3 audio file using just your browser and ReelGet. No extension, no signup, no cost.',
    steps: [
      {
        title: 'Open the YouTube video',
        body: 'Go to youtube.com and find the video or Short you want to save. Click or tap on it to open the video player.',
      },
      {
        title: 'Copy the video URL',
        body: "On desktop: copy the URL from your browser's address bar. On mobile: tap the Share button under the video and select \"Copy link\".",
      },
      {
        title: 'Visit ReelGet',
        body: 'Open a new tab and navigate to reelget.com. The downloader input box is front and centre on the page.',
      },
      {
        title: 'Paste the link and tap Download',
        body: 'Paste your YouTube URL into the input box and press the Download button. ReelGet will process the video and present available download options.',
      },
      {
        title: 'Select your preferred format and quality',
        body: 'ReelGet offers multiple quality options (up to 4K when available) and both MP4 video and MP3 audio formats. Select your preferred option and the download will begin.',
      },
    ],
    body: [
      'YouTube videos downloaded via ReelGet are saved in the original quality offered by the platform. For most videos you can choose 720p, 1080p, or in some cases 4K. YouTube Shorts are typically available at up to 1080p.',
      "Extracting audio as MP3 is a popular use case — great for podcast-style content, lectures, music mixes, or workout playlists you want to listen to offline. ReelGet handles the audio extraction server-side so you get a clean .mp3 file without needing any software.",
      "Please note that downloading YouTube videos may violate YouTube's Terms of Service for some content types. ReelGet is designed for personal, offline use of publicly available content. Do not use downloaded videos for commercial purposes or redistribution without proper licensing.",
    ],
    faq: [
      {
        q: 'Can I download YouTube Shorts with ReelGet?',
        a: 'Yes. YouTube Shorts use the same URL format (youtube.com/shorts/...) and ReelGet handles them just like regular YouTube videos. Simply copy the Shorts URL and paste it into ReelGet.',
      },
      {
        q: 'Can I extract just the audio from a YouTube video?',
        a: 'Yes. After pasting your YouTube URL in ReelGet, you will see an MP3 option alongside the video quality options. Select MP3 to download audio only.',
      },
      {
        q: 'Why is the maximum quality lower than what I see on YouTube?',
        a: 'YouTube serves very high resolutions (1440p, 4K) with separate audio and video streams. ReelGet merges the best available streams, but the maximum quality depends on the original upload resolution and what YouTube makes available via its CDN.',
      },
      {
        q: 'Can I download YouTube playlists?',
        a: 'Currently ReelGet downloads individual videos, not entire playlists. For playlists, download each video separately by copying the individual video URL.',
      },
    ],
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
    intro:
      "Facebook doesn't provide a native \"save video\" option for most content, which can be frustrating when you want to watch a video offline or share it on another platform. ReelGet makes it easy to download any public Facebook video or Reel to your Android or iPhone in HD quality — with no login, no app installation, and no charge.",
    steps: [
      {
        title: 'Find the Facebook video',
        body: 'Open Facebook in your browser or app and navigate to the video or Reel you want to download. Make sure the video is from a public post.',
      },
      {
        title: 'Copy the video link',
        body: 'Tap the three-dot menu (⋯) on the post and select "Copy link". On desktop you can also right-click the video and choose "Copy video address". The URL should start with facebook.com or fb.com.',
      },
      {
        title: 'Open ReelGet',
        body: 'Open a browser tab and go to reelget.com. The downloader is ready on the home page.',
      },
      {
        title: 'Paste the link and press Download',
        body: "Paste the Facebook URL into the input box and press the Download button. ReelGet will retrieve the video from Facebook's servers.",
      },
      {
        title: 'Download in HD or SD',
        body: 'ReelGet will present HD and SD quality options where available. Select HD for the best quality. The file will download to your device in .mp4 format.',
      },
    ],
    body: [
      "Facebook Reels, Watch videos, and feed videos are all supported by ReelGet. Group videos may or may not be accessible depending on the group's privacy settings — only videos from public groups or public profiles can be downloaded.",
      'On Android, the downloaded file will appear in your Downloads folder and automatically be added to your Gallery app. On iPhone, the file downloads to the Files app; open Files, tap and hold the video, and choose "Save to Photos" to add it to your Camera Roll.',
      "If you encounter an error downloading a Facebook video, double-check that the post is public and that the URL you copied is the direct post URL (not a short redirect). Some Facebook videos are hosted on third-party sites embedded in Facebook — in those cases you may need to find the original source URL.",
    ],
    faq: [
      {
        q: 'Can I download Facebook Reels with ReelGet?',
        a: 'Yes. Facebook Reels are supported. Copy the Reel link from the share menu and paste it into ReelGet just as you would for a regular Facebook video.',
      },
      {
        q: "Why can't I download a Facebook video from a private profile?",
        a: "ReelGet can only access publicly available content. Videos from private profiles, private groups, or content restricted to \"Friends only\" cannot be fetched.",
      },
      {
        q: 'Does ReelGet require me to log in to Facebook?',
        a: 'No. ReelGet does not ask for your Facebook credentials and does not connect to your account in any way. It only needs the public URL of the video.',
      },
      {
        q: 'The Facebook video downloaded without sound. What happened?',
        a: 'Some Facebook videos use separate audio and video streams. If the audio is missing, try refreshing the page and downloading again. If the issue persists, the video may have been uploaded without audio or with restricted audio.',
      },
    ],
  },
  {
    slug: 'best-video-downloader-2025',
    title: 'Best Free Online Video Downloader Tools in 2025',
    description:
      "We compared the top free video downloader tools. Here's what works best for Instagram, TikTok, YouTube, and more.",
    emoji: '🏆',
    date: '2025-04-28',
    readTime: '5 min',
    category: 'Guide',
    intro:
      "There are dozens of free online video downloader tools competing for your attention in 2025, but most of them fall short in one way or another — riddled with ads, limited to one platform, slow, or simply unreliable. We tested the leading options across Instagram, TikTok, YouTube, Facebook, Twitter, and Pinterest to find out which tools actually deliver. Here's our honest comparison.",
    steps: [
      {
        title: 'ReelGet (reelget.com) — Best overall',
        body: "ReelGet supports the widest range of platforms: Instagram (Reels, Posts, Stories), TikTok (no watermark), YouTube (MP4 + MP3 up to 4K), Facebook (Videos + Reels), Twitter/X, Pinterest, and Snapchat. It's fast, has no download limits, requires no login, and works flawlessly on both mobile and desktop.",
      },
      {
        title: 'SaveFrom.net — Best for YouTube',
        body: "SaveFrom has been around for years and remains one of the most reliable YouTube downloaders. It handles most YouTube URLs quickly. However, it's heavily ad-supported and less reliable for Instagram and TikTok.",
      },
      {
        title: 'SnapTik.app — Good TikTok-only option',
        body: "SnapTik specialises exclusively in TikTok watermark removal and works well for that use case. The trade-off is that it only does TikTok, so you'll need a separate tool for every other platform.",
      },
      {
        title: 'Y2mate — Popular but ad-heavy',
        body: "Y2mate is one of the most-searched video downloader tools globally. It handles YouTube and Facebook reasonably well, but the user experience is poor on mobile due to aggressive pop-up ads, and it frequently redirects to unrelated pages.",
      },
      {
        title: 'SSYouTube / SSstagram — Platform-specific',
        body: 'These "SS" tools work by prepending "ss" to a YouTube or Instagram URL. They\'re quick hacks that work for their specific platforms but offer no support beyond them and their designs haven\'t been updated in years.',
      },
    ],
    body: [
      "Our testing criteria included: platform coverage, download speed, video quality (maximum resolution offered), ease of use on mobile, number of ads/redirects, and watermark removal for TikTok. ReelGet came out on top largely because of its breadth — you don't need to remember a different tool for each platform.",
      'If you\'re a heavy YouTube user who wants playlist support and desktop software integration, a tool like yt-dlp (command-line) or 4K Video Downloader (desktop app) may be worth considering. For casual, occasional downloads on a phone, browser-based tools like ReelGet are by far the most convenient.',
      'The landscape of video downloader tools changes frequently as platforms update their APIs and CDNs. Always verify that the tool you\'re using still works before relying on it, and favour tools with active maintenance records. ReelGet is actively maintained and updated to stay compatible with platform changes.',
    ],
    faq: [
      {
        q: 'Which free video downloader supports the most platforms in 2025?',
        a: 'Based on our testing, ReelGet supports the most platforms: Instagram, TikTok, YouTube, Facebook, Twitter/X, Pinterest, and Snapchat — all from a single tool with no login required.',
      },
      {
        q: 'Are free online video downloaders safe to use?',
        a: 'Reputable tools like ReelGet are safe — they don\'t require software installation, don\'t ask for your social media credentials, and don\'t store your data. Be cautious of tools that redirect you through multiple ad pages, as those may expose you to malicious ads or phishing attempts.',
      },
      {
        q: 'Do these tools work on mobile (iPhone and Android)?',
        a: 'Yes. All browser-based tools in this comparison work on both iPhone and Android through the device\'s browser. ReelGet is specifically optimised for mobile use.',
      },
      {
        q: "What's the best tool for downloading TikTok videos without a watermark?",
        a: 'Both ReelGet and SnapTik reliably remove TikTok watermarks. ReelGet has the advantage of also handling all other major platforms, so it\'s the more versatile choice.',
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// generateStaticParams — server-only, must NOT be in a 'use client' file
// ---------------------------------------------------------------------------
export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

// ---------------------------------------------------------------------------
// generateMetadata
// ---------------------------------------------------------------------------
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = BLOG_POSTS.find((p) => p.slug === slug);
  if (!post) return {};
  return {
    title: `${post.title} | ReelGet Blog`,
    description: post.description,
    alternates: { canonical: `${BASE_URL}/en/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      url: `${BASE_URL}/en/blog/${post.slug}`,
      type: 'article',
      publishedTime: post.date,
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

const CATEGORY_COLORS: Record<string, string> = {
  Instagram: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  TikTok: 'bg-slate-700/60 text-slate-200 border-slate-600',
  YouTube: 'bg-red-500/20 text-red-300 border-red-500/30',
  Facebook: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  Guide: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
};

// ---------------------------------------------------------------------------
// Page (Server Component)
// ---------------------------------------------------------------------------
export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const post = BLOG_POSTS.find((p) => p.slug === slug);
  if (!post) notFound();

  const related = BLOG_POSTS.filter((p) => p.slug !== slug).slice(0, 3);
  const canonicalUrl = `${BASE_URL}/en/blog/${post.slug}`;

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    author: { '@type': 'Organization', name: 'ReelGet', url: BASE_URL },
    publisher: {
      '@type': 'Organization',
      name: 'ReelGet',
      url: BASE_URL,
      logo: { '@type': 'ImageObject', url: `${BASE_URL}/icon.png` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl },
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: post.faq.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      {/* Nav */}
      <nav className="bg-white sticky top-0 z-50 border-b border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <a href={`/${locale}`} className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-teal-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">V</span>
            </div>
            <span className="font-bold text-slate-800 text-lg">ReelGet</span>
          </a>
          <a href={`/${locale}/blog`} className="text-sm text-slate-500 hover:text-teal-600 font-medium transition">
            ← Blog
          </a>
        </div>
      </nav>

      {/* Breadcrumb */}
      <div className="bg-slate-900 border-b border-slate-800">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-2 text-xs text-slate-500">
          <a href={`/${locale}`} className="hover:text-teal-400 transition">Home</a>
          <span>›</span>
          <a href={`/${locale}/blog`} className="hover:text-teal-400 transition">Blog</a>
          <span>›</span>
          <span className="text-slate-300 truncate max-w-xs">{post.title}</span>
        </div>
      </div>

      {/* Hero */}
      <section className="relative bg-slate-900 text-white py-16 px-4 overflow-hidden">
        <div className="absolute top-10 left-10 w-72 h-72 bg-cyan-500 rounded-full mix-blend-screen filter blur-3xl opacity-10" />
        <div className="absolute top-20 right-10 w-72 h-72 bg-violet-600 rounded-full mix-blend-screen filter blur-3xl opacity-10" />
        <div className="relative max-w-3xl mx-auto">
          <div className="text-5xl mb-4">{post.emoji}</div>
          <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full border mb-4 ${CATEGORY_COLORS[post.category] ?? 'bg-slate-700/60 text-slate-300 border-slate-600'}`}>
            {post.category}
          </span>
          <h1 className="text-3xl sm:text-4xl font-black leading-tight mb-4">{post.title}</h1>
          <p className="text-slate-300 text-base sm:text-lg mb-6">{post.description}</p>
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <span>{formatDate(post.date)}</span>
            <span className="text-slate-700">·</span>
            <span>{post.readTime} read</span>
          </div>
        </div>
      </section>

      {/* Article body */}
      <main className="max-w-3xl mx-auto px-4 py-12 text-slate-300 text-sm leading-relaxed">
        <p className="text-base leading-relaxed mb-10 text-slate-200">{post.intro}</p>

        <h2 className="text-xl font-bold text-white mb-6">Step-by-Step Guide</h2>
        <ol className="space-y-4 mb-10">
          {post.steps.map((step, i) => (
            <li key={i} className="flex gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-cyan-400 to-teal-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                {i + 1}
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">{step.title}</h3>
                <p className="text-slate-400">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="space-y-4 mb-12">
          {post.body.map((para, i) => <p key={i}>{para}</p>)}
        </div>

        {/* CTA */}
        <div className="bg-gradient-to-r from-cyan-900/40 to-teal-900/40 border border-teal-500/30 rounded-2xl p-6 mb-12 text-center">
          <p className="text-white font-bold text-lg mb-1">Ready to try it yourself?</p>
          <p className="text-slate-300 text-sm mb-4">Paste any video URL into ReelGet and download in seconds.</p>
          <a
            href={`/${locale}`}
            className="inline-block bg-gradient-to-r from-cyan-400 to-teal-500 text-slate-950 font-bold px-6 py-2.5 rounded-full text-sm hover:opacity-90 transition"
          >
            Go to ReelGet →
          </a>
        </div>

        {/* FAQ — client component */}
        <h2 className="text-xl font-bold text-white mb-6">Frequently Asked Questions</h2>
        <FaqAccordion items={post.faq} />

        {/* Related posts */}
        <div className="mt-16">
          <h2 className="text-xl font-bold text-white mb-6">Related Articles</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {related.map((rel) => (
              <a
                key={rel.slug}
                href={`/${locale}/blog/${rel.slug}`}
                className="group flex flex-col bg-slate-900 border border-slate-800 hover:border-teal-500/60 rounded-2xl p-4 transition-all hover:shadow-md hover:shadow-teal-900/20"
              >
                <span className="text-2xl mb-2">{rel.emoji}</span>
                <span className={`inline-block self-start text-xs font-semibold px-2 py-0.5 rounded-full border mb-2 ${CATEGORY_COLORS[rel.category] ?? 'bg-slate-700/60 text-slate-300 border-slate-600'}`}>
                  {rel.category}
                </span>
                <h3 className="text-white text-xs font-semibold leading-snug group-hover:text-teal-300 transition-colors mb-1">
                  {rel.title}
                </h3>
                <span className="text-teal-400 text-xs mt-auto pt-2">Read more →</span>
              </a>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-500 text-center py-10 px-4 text-sm border-t border-slate-800 mt-8">
        <div className="flex justify-center mb-3">
          <a href={`/${locale}`} className="bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent font-black text-xl">
            ReelGet
          </a>
        </div>
        <div className="flex justify-center gap-4 text-xs text-slate-600 mt-2">
          <a href={`/${locale}/privacy`} className="hover:text-teal-400 transition">Privacy Policy</a>
          <a href={`/${locale}/terms`} className="hover:text-teal-400 transition">Terms of Service</a>
          <a href={`/${locale}/about`} className="hover:text-teal-400 transition">About</a>
          <a href={`/${locale}/blog`} className="hover:text-teal-400 transition">Blog</a>
        </div>
      </footer>
    </div>
  );
}
