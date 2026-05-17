import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import DownloaderForm from '@/components/DownloaderForm';
import Tracker from '@/components/Tracker';
import { routing } from '@/../i18n/routing';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://reelget.com';
const LOCALES = ['en', 'hi', 'bn', 'id', 'ur', 'pt', 'ta', 'te', 'ar', 'vi', 'or', 'fr', 'sw', 'tl', 'ha', 'am', 'es', 'ru', 'tr', 'th', 'ko'];
const PLATFORMS = ['instagram', 'tiktok', 'facebook', 'youtube', 'twitter', 'pinterest', 'snapchat', 'linkedin', 'reddit', 'vimeo', 'dailymotion', 'twitch'] as const;
type Platform = (typeof PLATFORMS)[number];

// ─── Landing page slugs (English-only targeted keyword pages) ─────────────────
const LANDING_SLUGS = [
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
] as const;
type LandingSlug = (typeof LANDING_SLUGS)[number];

// ─── Locale-specific keyword-rich title templates ────────────────────────────
const LOCALE_TITLES: Record<string, (name: string) => string> = {
  en:  (n) => `${n} Video Downloader Free — No Watermark, No Login | ReelGet`,
  hi:  (n) => `${n} Video Download Kare Bina Watermark Aur Login Ke | ReelGet`,
  bn:  (n) => `${n} ভিডিও ডাউনলোড করুন বিনামূল্যে ওয়াটারমার্ক ছাড়া | ReelGet`,
  id:  (n) => `Cara Download Video ${n} Tanpa Watermark Gratis | ReelGet`,
  ur:  (n) => `${n} ویڈیو مفت ڈاؤنلوڈ کریں بغیر واٹر مارک | ReelGet`,
  pt:  (n) => `Baixar Vídeos do ${n} Grátis Sem Marca d'Água | ReelGet`,
  ta:  (n) => `${n} வீடியோ இலவசமாக வாட்டர்மார்க் இல்லாமல் பதிவிறக்கம் | ReelGet`,
  te:  (n) => `${n} వీడియో వాటర్‌మార్క్ లేకుండా ఉచితంగా డౌన్‌లోడ్ | ReelGet`,
  ar:  (n) => `تحميل مقاطع ${n} مجاناً بدون علامة مائية بدون تسجيل | ReelGet`,
  vi:  (n) => `Tải Video ${n} Miễn Phí Không Watermark Không Đăng Nhập | ReelGet`,
  or:  (n) => `${n} ଭିଡିଓ ୱାଟରରମାର୍କ ବିନା ମାଗଣାରେ ଡାଉନଲୋଡ | ReelGet`,
  fr:  (n) => `Télécharger des Vidéos ${n} Gratuitement Sans Filigrane | ReelGet`,
  sw:  (n) => `Pakua Video za ${n} Bila Alama ya Maji Bure | ReelGet`,
  tl:  (n) => `Mag-download ng ${n} Videos Libre Walang Watermark | ReelGet`,
  ha:  (n) => `Sauke Bidiyo na ${n} Kyauta Babu Watermark | ReelGet`,
  am:  (n) => `${n} ቪዲዮ ያውርዱ ነፃ ያለ ዋተርማርክ | ReelGet`,
  es:  (n) => `Descargador de Videos ${n} Gratis — Sin Marca de Agua, Sin Login | ReelGet`,
  ru:  (n) => `Скачать видео ${n} бесплатно — без водяного знака, без входа | ReelGet`,
  tr:  (n) => `${n} Video İndirici Ücretsiz — Filigran Yok, Giriş Yok | ReelGet`,
  th:  (n) => `ดาวน์โหลดวิดีโอ ${n} ฟรี — ไม่มีลายน้ำ ไม่ต้องเข้าสู่ระบบ | ReelGet`,
  ko:  (n) => `${n} 동영상 무료 다운로드 — 워터마크 없음, 로그인 불필요 | ReelGet`,
};

const LOCALE_DESCS: Record<string, (name: string, types: string) => string> = {
  en:  (n, t) => `Download ${n} ${t} for free — no watermark, no login, no app needed. Fast HD downloads with ReelGet.`,
  hi:  (n, t) => `${n} ${t} मुफ्त में डाउनलोड करें। कोई वॉटरमार्क नहीं, कोई लॉगिन नहीं। ReelGet के साथ तेज और आसान।`,
  bn:  (n, t) => `${n} ${t} বিনামূল্যে ডাউনলোড করুন। কোনো ওয়াটারমার্ক নেই, কোনো লগইন লাগবে না। ReelGet দিয়ে দ্রুত ও সহজ।`,
  id:  (n, t) => `Download ${n} ${t} gratis tanpa watermark dan tanpa login. Cepat dan mudah dengan ReelGet.`,
  ur:  (n, t) => `${n} ${t} مفت میں ڈاؤنلوڈ کریں۔ کوئی واٹر مارک نہیں، کوئی لاگ ان نہیں۔ ReelGet کے ساتھ تیز اور آسان۔`,
  pt:  (n, t) => `Baixe ${n} ${t} de graça sem marca d'água e sem login. Rápido e fácil com ReelGet.`,
  ta:  (n, t) => `${n} ${t} இலவசமாக பதிவிறக்கம் செய்யுங்கள். வாட்டர்மார்க் இல்லை, லாகின் இல்லை. ReelGet உடன் வேகமாக மற்றும் எளிதாக.`,
  te:  (n, t) => `${n} ${t} ఉచితంగా డౌన్‌లోడ్ చేయండి. వాటర్‌మార్క్ లేదు, లాగిన్ లేదు. ReelGet తో వేగంగా మరియు సులభంగా.`,
  ar:  (n, t) => `تحميل ${n} ${t} مجاناً بدون علامة مائية وبدون تسجيل دخول. سريع وسهل مع ReelGet.`,
  vi:  (n, t) => `Tải ${n} ${t} miễn phí không watermark, không đăng nhập. Nhanh và dễ dàng với ReelGet.`,
  or:  (n, t) => `${n} ${t} ବିନା ମୂଲ୍ୟରେ ଡାଉନଲୋଡ କରନ୍ତୁ। କୌଣସି ୱାଟରରମାର୍କ ନଥାଏ, ଲୋଗଇନ ଆବଶ୍ୟକ ନାହିଁ। ReelGet ସହ ଦ୍ରୁତ ଏବଂ ସହଜ।`,
  fr:  (n, t) => `Téléchargez des ${n} ${t} gratuitement sans filigrane et sans connexion. Rapide et facile avec ReelGet.`,
  sw:  (n, t) => `Pakua ${n} ${t} bure bila alama ya maji na bila kuingia. Haraka na rahisi na ReelGet.`,
  tl:  (n, t) => `Mag-download ng ${n} ${t} nang libre, walang watermark at walang login. Mabilis at madali gamit ang ReelGet.`,
  ha:  (n, t) => `Sauke ${n} ${t} kyauta babu watermark da babu shiga. Da sauri kuma cikin sauƙi tare da ReelGet.`,
  am:  (n, t) => `${n} ${t} ያለ ዋተርማርክ እና ያለ ሎጊን ነፃ ያውርዱ። ReelGet ጋር ፈጣን እና ቀላል።`,
  es:  (n, t) => `Descarga ${n} ${t} gratis sin marca de agua y sin iniciar sesión. Rápido y fácil con ReelGet.`,
  ru:  (n, t) => `Скачайте ${n} ${t} бесплатно — без водяного знака, без входа. Быстро и легко с ReelGet.`,
  tr:  (n, t) => `${n} ${t} ücretsiz indirin — filigran yok, giriş yok. ReelGet ile hızlı ve kolay.`,
  th:  (n, t) => `ดาวน์โหลด ${n} ${t} ฟรี — ไม่มีลายน้ำ ไม่ต้องเข้าสู่ระบบ ง่ายและรวดเร็วด้วย ReelGet`,
  ko:  (n, t) => `${n} ${t}을(를) 무료로 다운로드하세요 — 워터마크 없음, 로그인 불필요. ReelGet으로 빠르고 쉽게.`,
};

// ─── Platform metadata ────────────────────────────────────────────────────────
const PLATFORM_META: Record<Platform, {
  emoji: string;
  gradient: string;
  types: string;
  body: string[];
  faq: { q: string; a: string }[];
  features: string[];
  tips: string[];
}> = {
  instagram: {
    emoji: '📸',
    gradient: 'from-pink-500 to-purple-600',
    types: 'Reels, Posts & Stories',
    body: [
      'Instagram is one of the world\'s most popular short-video platforms, with billions of Reels watched every day. ReelGet\'s Instagram video downloader lets you save any public Reel, video post, or Story to your device in seconds — without installing the Instagram app or creating an account.',
      'Unlike screen-recording workarounds, ReelGet fetches the original video stream from Instagram\'s CDN, so you get the full HD quality without watermarks, blurry previews, or re-encoded compression. The downloaded MP4 plays on any device and can be re-shared or edited freely.',
      'ReelGet supports every Instagram video format: /reel/ links, /p/ video posts, and /stories/ URLs from public accounts. Whether you\'re on an iPhone, an Android phone, or a desktop browser, no app or extension is needed — just paste the link and click Download.',
    ],
    faq: [
      { q: 'Can I download Instagram Reels without watermark?', a: 'Yes! ReelGet downloads Instagram Reels directly from Instagram\'s CDN servers — no watermark is added to the file.' },
      { q: 'Can I download Instagram Stories?', a: 'Yes — Stories from public accounts can be downloaded as MP4 files before they expire.' },
      { q: 'Can I download Instagram photos?', a: 'Currently video content (Reels, video posts, Stories) is supported. Image-only posts are not yet supported.' },
      { q: 'Does it work on iPhone and Android?', a: 'Yes — ReelGet is a web app that works in any mobile browser on iPhone and Android, no app required.' },
      { q: 'Do I need to log in?', a: 'No login required. Only public Instagram videos can be downloaded.' },
    ],
    features: [
      'Download Instagram Reels in HD quality without watermark',
      'Save Instagram video posts to your camera roll',
      'Download public Instagram Stories before they expire',
      'Supports both instagram.com/reel/ and instagram.com/p/ URLs',
      'Works on iPhone, Android, PC, and Mac — no app needed',
    ],
    tips: [
      'Open the Instagram post or Reel, tap the three-dot menu (⋯), and select "Copy link."',
      'For Stories, open the Story, tap the share icon, and copy the link.',
      'Paste the copied link into ReelGet\'s input box and click Download.',
      'Choose HD for the best quality or SD to save storage space.',
    ],
  },
  tiktok: {
    emoji: '🎵',
    gradient: 'from-slate-700 to-slate-900',
    types: 'Videos & Reels',
    body: [
      'TikTok\'s in-app save feature adds a visible watermark to every downloaded video. ReelGet bypasses this by downloading directly from TikTok\'s original CDN stream, giving you a clean, watermark-free MP4 you can re-share, edit, or archive without any branding overlaid.',
      'The TikTok downloader works with every type of public TikTok content: standard feed videos, TikTok Reels, Duets, and Stitches. It also handles both the full tiktok.com URL and short vm.tiktok.com share links — just copy and paste, no conversion needed.',
      'Because the download is processed server-side by ReelGet, it works even on devices where TikTok restricts saves. No TikTok account, no VPN, and no desktop software is required.',
    ],
    faq: [
      { q: 'Can I download TikTok videos without watermark?', a: 'Yes — ReelGet removes the TikTok watermark by fetching the original CDN source directly.' },
      { q: 'Does it work on TikTok Reels?', a: 'Yes, all public TikTok videos and Reels are supported, including Duets and Stitches.' },
      { q: 'Can I save TikTok videos to my phone?', a: 'Yes! The downloaded MP4 saves directly to your camera roll or Downloads folder.' },
      { q: 'Do short vm.tiktok.com links work?', a: 'Yes — short share links are automatically resolved. Paste them directly.' },
      { q: 'Do I need a TikTok account?', a: 'No — no account, no TikTok app, and no login of any kind is required.' },
    ],
    features: [
      'Download TikTok videos without watermark in HD',
      'Save TikTok Reels as MP4 directly to your device',
      'Supports short TikTok share links (vm.tiktok.com)',
      'Server-side download — works even when the TikTok app blocks saves',
      'Works on all devices: iPhone, Android, laptop, and desktop',
    ],
    tips: [
      'Open the TikTok video and tap "Share", then "Copy link."',
      'On desktop, right-click the video URL in the address bar and copy it.',
      'Paste the link into ReelGet and hit Download — the watermark-free MP4 is served directly.',
      'Short vm.tiktok.com links work exactly the same as full URLs.',
    ],
  },
  facebook: {
    emoji: '👍',
    gradient: 'from-blue-600 to-blue-800',
    types: 'Videos & Reels',
    body: [
      'Facebook hosts hundreds of millions of public videos — news clips, tutorials, comedy Reels, live-stream recordings, and more. ReelGet\'s Facebook video downloader lets you save any publicly shared Facebook video or Reel in HD or SD quality, without needing a Facebook account.',
      'The downloader supports every public Facebook video format: videos in your feed, Facebook Reels, Facebook Watch content, and videos posted to public groups or pages. Both full facebook.com URLs and short fb.watch share links are accepted.',
      'All downloads are processed instantly on ReelGet\'s servers and streamed directly to your browser. No browser extension, no third-party desktop software, and no Facebook login is needed — just the public video link.',
    ],
    faq: [
      { q: 'Can I download Facebook Reels?', a: 'Yes! Paste any public Facebook Reel URL and ReelGet will fetch it at the highest available quality.' },
      { q: 'What about Facebook Watch videos?', a: 'Public Facebook Watch videos are fully supported. Paste the URL and click Download.' },
      { q: 'Can I download private Facebook videos?', a: 'No — only publicly shared videos can be downloaded.' },
      { q: 'Do fb.watch short links work?', a: 'Yes, fb.watch short links are automatically resolved to the full video URL.' },
      { q: 'Do I need to log in?', a: 'No Facebook account or login is needed for public videos.' },
    ],
    features: [
      'Download Facebook Reels in HD without login',
      'Save Facebook Watch videos to your device',
      'Supports fb.watch short links and full facebook.com URLs',
      'Download public Facebook group and page videos',
      'Works instantly — no browser extension required',
    ],
    tips: [
      'Click the three-dot menu (⋯) on a Facebook video and select "Copy link to video."',
      'For Facebook Reels, tap "Share" → "Copy link."',
      'Paste the link into ReelGet and select the quality you want.',
      'FB Watch short links (fb.watch/…) are fully supported.',
    ],
  },
  youtube: {
    emoji: '▶️',
    gradient: 'from-red-600 to-red-700',
    types: 'Videos & Shorts',
    body: [
      'YouTube is the world\'s largest video platform, but downloading videos for offline viewing isn\'t built into the free tier. ReelGet gives you a fast, free YouTube video downloader that works on any device — no YouTube Premium, no browser extension, and no desktop software required.',
      'You can download full YouTube videos in HD (1080p, 720p) or SD (480p, 360p), save YouTube Shorts as MP4, or extract just the audio as an M4A file — ideal for podcasts, music, lectures, and language-learning content.',
      'Only public, non-DRM videos can be downloaded. Age-restricted, private, or membership-only content is not supported. Please use ReelGet for personal, offline use only.',
    ],
    faq: [
      { q: 'Can I download YouTube Shorts?', a: 'Yes, YouTube Shorts are fully supported at HD quality.' },
      { q: 'Can I extract MP3 audio from YouTube?', a: 'Yes! Use the "Extract MP3 / Audio" button to save just the audio track as an M4A file.' },
      { q: 'Can I download YouTube playlists?', a: 'Currently individual video and Shorts URLs are supported, not full playlist URLs.' },
      { q: 'Does it support 1080p HD?', a: 'Yes — ReelGet selects the best available quality automatically, up to 1080p.' },
      { q: 'Why do some videos fail to download?', a: 'Only public, non-DRM videos can be downloaded. Age-restricted or private content is not supported.' },
    ],
    features: [
      'Download YouTube videos in HD (1080p, 720p) and SD quality',
      'Save YouTube Shorts as MP4 to your phone or PC',
      'Extract MP3 / M4A audio from any YouTube video for free',
      'Supports youtu.be short links and full youtube.com URLs',
      'No account, no Chrome extension, no software needed',
    ],
    tips: [
      'Click "Share" beneath a YouTube video and copy the link.',
      'For Shorts, tap "Share → Copy link" in the YouTube app.',
      'Use the Audio Only option to get a high-quality audio file — great for podcasts and music.',
      'Only public videos work — private and age-restricted videos cannot be downloaded.',
    ],
  },
  twitter: {
    emoji: '🐦',
    gradient: 'from-sky-500 to-blue-600',
    types: 'Videos & GIFs',
    body: [
      'Videos on Twitter / X play inline but can\'t be saved directly from the app. ReelGet\'s Twitter video downloader solves that — paste any public tweet URL containing a video or GIF and download it as a clean MP4 file in seconds, with no login and no browser extension needed.',
      'Twitter GIFs are actually looping MP4 files, and ReelGet downloads them as such, giving you a universally compatible video file. Both twitter.com and x.com URLs are supported, so links from either version of the platform work identically.',
      'Protected or private account tweets cannot be downloaded. For public tweets — news clips, sports highlights, viral moments, and memes — ReelGet fetches the highest available resolution.',
    ],
    faq: [
      { q: 'Can I download Twitter / X videos?', a: 'Yes! Paste any public tweet URL that contains a video or GIF and click Download.' },
      { q: 'What about GIFs posted on X?', a: 'Twitter/X GIFs are downloaded as MP4 video files for maximum compatibility.' },
      { q: 'Do both twitter.com and x.com links work?', a: 'Yes — both domain formats are supported identically.' },
      { q: 'Can I download videos from protected X accounts?', a: 'No — only public tweets are accessible.' },
      { q: 'Do I need to log in?', a: 'No login required for public tweets.' },
    ],
    features: [
      'Download Twitter / X videos in HD as MP4',
      'Save Twitter GIFs as clean MP4 video files',
      'Supports both twitter.com and x.com URLs',
      'Works on videos embedded in tweet threads',
      'No login or X Premium account required',
    ],
    tips: [
      'Click the share icon (↗) on a tweet and select "Copy link to Tweet."',
      'Paste the tweet URL (not the video embed URL) into ReelGet.',
      'Both twitter.com and x.com links work identically.',
      'GIFs are saved as MP4 for maximum compatibility across devices.',
    ],
  },
  pinterest: {
    emoji: '📌',
    gradient: 'from-red-500 to-rose-700',
    types: 'Videos & Pins',
    body: [
      'Pinterest has grown beyond static images — video pins now appear throughout feeds, boards, and search results, covering DIY tutorials, cooking recipes, fashion lookbooks, and home decor ideas. ReelGet lets you save any public video pin as an MP4 in seconds.',
      'The downloader supports both full pinterest.com/pin/ URLs and short pin.it share links, resolving redirects automatically. The video is fetched at its original quality — not the compressed preview thumbnail.',
      'Image-only Pinterest pins cannot be downloaded, as they contain no video content. No Pinterest account is required, and the tool works on any device including iPhone, Android, and desktop browsers.',
    ],
    faq: [
      { q: 'Can I download Pinterest videos?', a: 'Yes! Paste any Pinterest pin URL that contains a video and click Download to save it as MP4.' },
      { q: 'What types of Pinterest content are supported?', a: 'Video pins are fully supported. Image-only pins cannot be downloaded.' },
      { q: 'Does it work with pin.it short links?', a: 'Yes, pin.it short links are automatically resolved.' },
      { q: 'What quality will the video be?', a: 'ReelGet fetches the original source video, not a compressed preview.' },
      { q: 'Do I need to log in?', a: 'No — no Pinterest account or app is required for public pins.' },
    ],
    features: [
      'Download Pinterest video pins in HD quality',
      'Supports pin.it short links and full pinterest.com URLs',
      'Saves video pins as MP4 to any device',
      'Works without a Pinterest account',
      'No browser extension or app required',
    ],
    tips: [
      'Open a video pin on Pinterest and tap "Share → Copy link."',
      'Short pin.it links work just like full pinterest.com URLs.',
      'Only pins with video content can be downloaded.',
      'ReelGet fetches the original video quality, not the compressed preview.',
    ],
  },
  linkedin: {
    emoji: '💼',
    gradient: 'from-blue-600 to-blue-800',
    types: 'Videos & Posts',
    body: [
      'LinkedIn has evolved from a text-based professional network into a rich video platform, with creators sharing industry insights, tutorials, conference talks, and career advice. ReelGet\'s LinkedIn video downloader lets you save any public LinkedIn video post as an MP4 file — no LinkedIn Premium, no app, and no login required.',
      'Simply copy the URL of any public LinkedIn post that contains a video and paste it into ReelGet. The downloader fetches the video at its original quality from LinkedIn\'s CDN and streams it directly to your browser or device.',
      'Downloaded LinkedIn videos are great for offline reference, sharing with colleagues who aren\'t on LinkedIn, or archiving content from your industry leaders. Works on any device — phone, tablet, or desktop.',
    ],
    faq: [
      { q: 'Can I download LinkedIn videos without an account?', a: 'Yes — only a public LinkedIn post URL is needed. No LinkedIn login or Premium subscription is required.' },
      { q: 'What types of LinkedIn videos are supported?', a: 'Public LinkedIn video posts, native uploads, and shared video content are all supported.' },
      { q: 'Can I download LinkedIn Learning videos?', a: 'LinkedIn Learning videos are behind a paywall and are not publicly accessible — only public post videos can be downloaded.' },
      { q: 'What quality are the downloads?', a: 'ReelGet fetches the original video quality as uploaded by the creator on LinkedIn\'s CDN.' },
      { q: 'Do I need to install anything?', a: 'No — ReelGet is a web app that works entirely in your browser on any device.' },
    ],
    features: [
      'Download LinkedIn video posts as MP4',
      'No LinkedIn account or Premium required',
      'Fetches original quality from LinkedIn\'s CDN',
      'Works on iPhone, Android, PC, and Mac',
      'No browser extension or app installation needed',
    ],
    tips: [
      'Open the LinkedIn post containing the video.',
      'Click the three-dot menu (⋯) on the post and select "Copy link to post."',
      'Paste the link into ReelGet\'s input box and click Download.',
      'The video saves as MP4 to your device.',
    ],
  },
  reddit: {
    emoji: '🤖',
    gradient: 'from-orange-500 to-red-600',
    types: 'Videos & GIFs',
    body: [
      'Reddit hosts millions of video posts across thousands of subreddits — funny clips, gaming highlights, news footage, sports moments, and viral content. ReelGet\'s Reddit video downloader lets you save any public Reddit video post as a clean MP4 with audio, fixing the common problem where Reddit\'s native player separates video and audio streams.',
      'Reddit videos are notoriously difficult to download because the platform splits audio and video into separate streams. ReelGet merges them server-side before delivering the file to you, so you get a complete video with sound — not a silent clip.',
      'Both old-style reddit.com links and short redd.it share links are supported. Works on all devices without any app or browser extension.',
    ],
    faq: [
      { q: 'Why do Reddit videos often have no sound when downloaded elsewhere?', a: 'Reddit stores audio and video as separate streams. ReelGet merges them server-side before download so you always get a complete video with audio.' },
      { q: 'Do redd.it short links work?', a: 'Yes — short redd.it share links are automatically resolved.' },
      { q: 'Can I download from any subreddit?', a: 'Yes — any public subreddit video post can be downloaded. Private or restricted subreddits are not accessible.' },
      { q: 'What about Reddit GIFs?', a: 'Reddit GIFs are served as video files (MP4) and are fully supported.' },
      { q: 'Do I need a Reddit account?', a: 'No — only a public Reddit post URL is needed.' },
    ],
    features: [
      'Download Reddit videos with audio (merged automatically)',
      'Supports redd.it short links and full reddit.com URLs',
      'Works across all public subreddits',
      'Reddit GIFs downloaded as MP4 with full quality',
      'No Reddit account required',
    ],
    tips: [
      'Open the Reddit post with the video and tap "Share" → "Copy link."',
      'Paste the post URL (not the video direct URL) into ReelGet.',
      'Click Download — audio and video are merged automatically.',
      'Both redd.it and reddit.com links work identically.',
    ],
  },
  vimeo: {
    emoji: '🎬',
    gradient: 'from-cyan-500 to-blue-600',
    types: 'Videos & Showcases',
    body: [
      'Vimeo is the go-to platform for high-quality creative video — filmmakers, designers, animators, and agencies use it to showcase their best work. ReelGet\'s Vimeo downloader lets you save any public Vimeo video as an HD MP4 file, preserving the quality that creators upload at.',
      'Unlike YouTube, Vimeo often hosts original creative projects, short films, and portfolio reels that aren\'t available anywhere else. ReelGet lets you archive these for offline viewing or reference, fetching the highest available quality from Vimeo\'s CDN.',
      'Simply paste any public vimeo.com video URL into ReelGet. Password-protected or private Vimeo videos cannot be downloaded. Works on all devices without any Vimeo account.',
    ],
    faq: [
      { q: 'Can I download private Vimeo videos?', a: 'No — only publicly accessible Vimeo videos can be downloaded. Password-protected or private videos are not supported.' },
      { q: 'What quality are Vimeo downloads?', a: 'ReelGet selects the highest available quality from Vimeo\'s CDN, which can be up to 4K for some videos.' },
      { q: 'Do I need a Vimeo account?', a: 'No — only a public Vimeo video URL is needed.' },
      { q: 'Can I download Vimeo showcases?', a: 'Individual videos within a public showcase can be downloaded one at a time.' },
      { q: 'What format are downloaded Vimeo videos?', a: 'Videos are downloaded as MP4 files, compatible with all devices and video players.' },
    ],
    features: [
      'Download Vimeo videos in HD quality up to 4K',
      'Saves original quality as uploaded by the creator',
      'No Vimeo account or Vimeo Pro required',
      'Works on iPhone, Android, PC, and Mac',
      'No browser extension needed',
    ],
    tips: [
      'Open the Vimeo video and copy the URL from your browser\'s address bar.',
      'Alternatively, click "Share" on the video and copy the link.',
      'Paste the URL into ReelGet and click Download.',
      'Password-protected or private videos cannot be downloaded.',
    ],
  },
  dailymotion: {
    emoji: '📺',
    gradient: 'from-blue-500 to-indigo-600',
    types: 'Videos & Channels',
    body: [
      'Dailymotion is one of the world\'s largest video platforms, hosting news clips, entertainment content, sports highlights, and creator videos across dozens of countries. ReelGet\'s Dailymotion downloader lets you save any public Dailymotion video as an MP4 in HD quality.',
      'Dailymotion is especially popular in France, the Middle East, and Southeast Asia — and ReelGet supports it fully alongside other major platforms. Both full dailymotion.com URLs and short dai.ly share links are accepted.',
      'No Dailymotion account is required, and the tool works on any device. Simply paste the video URL and click Download to save the MP4 to your device.',
    ],
    faq: [
      { q: 'Can I download Dailymotion videos for free?', a: 'Yes — ReelGet is completely free with no download limits for public Dailymotion videos.' },
      { q: 'Do dai.ly short links work?', a: 'Yes — dai.ly short links are automatically resolved to the full video.' },
      { q: 'What quality are Dailymotion downloads?', a: 'ReelGet selects the highest available quality, typically up to 1080p HD.' },
      { q: 'Can I download age-restricted Dailymotion videos?', a: 'Age-restricted or private content cannot be downloaded without authentication.' },
      { q: 'Do I need a Dailymotion account?', a: 'No account required for publicly accessible videos.' },
    ],
    features: [
      'Download Dailymotion videos in HD MP4',
      'Supports dai.ly short links and full dailymotion.com URLs',
      'No Dailymotion account required',
      'Works on all devices and browsers',
      'Free with no download limits',
    ],
    tips: [
      'Open the Dailymotion video and copy the URL from your browser.',
      'Short dai.ly links work just as well as full URLs.',
      'Paste the URL into ReelGet and click Download.',
      'Only public, non-restricted videos can be downloaded.',
    ],
  },
  snapchat: {
    emoji: '👻',
    gradient: 'from-yellow-400 to-amber-500',
    types: 'Spotlight & Stories',
    body: [
      'Snapchat Spotlight is the platform\'s public short-video feed. Public Spotlight videos are accessible via shareable links, and ReelGet lets you save them as MP4 files without needing a Snapchat account or the app installed.',
      'Public Snapchat Stories shared via a web URL can also be downloaded. When a creator or brand shares their Story publicly, Snapchat generates a story.snapchat.com link — paste that into ReelGet to save the video.',
      'Private Snaps sent directly between users cannot be downloaded, as that content is not publicly accessible. ReelGet only works with public Spotlight videos and publicly shared Story links.',
    ],
    faq: [
      { q: 'Can I download Snapchat Spotlight videos?', a: 'Yes! Paste any public Snapchat Spotlight URL and click Download.' },
      { q: 'Can I download Snapchat Stories?', a: 'Public Snapchat Stories shared via a story.snapchat.com web link can be downloaded.' },
      { q: 'Do I need a Snapchat account?', a: 'No account or app required. Only a public shareable URL is needed.' },
      { q: 'Why can\'t I download a specific Snap?', a: 'Only public Spotlight videos and Story links shared via URL can be downloaded.' },
      { q: 'What URL formats are supported?', a: 'Both snapchat.com/spotlight/... and story.snapchat.com/... links are supported.' },
    ],
    features: [
      'Download public Snapchat Spotlight videos as MP4',
      'Save Snapchat Stories shared via web links',
      'Works without a Snapchat account',
      'Supports story.snapchat.com and snapchat.com/spotlight URLs',
      'No browser extension or desktop software needed',
    ],
    tips: [
      'Open a public Spotlight video or Story on Snapchat and tap "Share → Copy link."',
      'Paste the snapchat.com or story.snapchat.com link into ReelGet.',
      'Only publicly shared content with a shareable URL can be downloaded.',
      'Private account snaps sent directly cannot be downloaded.',
    ],
  },
  twitch: {
    emoji: '🎮',
    gradient: 'from-purple-600 to-violet-700',
    types: 'Clips & VODs',
    body: [
      'Twitch is the world\'s leading live streaming platform for gaming, esports, and creative content. While live streams can\'t be saved directly, Twitch Clips — short highlights created from broadcasts — are fully downloadable with ReelGet. Save any public Twitch Clip as an MP4 in seconds.',
      'Twitch Clips are automatically generated 30–60 second highlights that streamers and viewers create from VODs and live streams. They\'re great for sharing big moments: clutch plays, funny reactions, world-record runs, and viral gaming moments. ReelGet fetches them at their original 1080p60 quality.',
      'Both clips.twitch.tv and twitch.tv/clip/ URL formats are supported. No Twitch account is required. Simply paste the Clip URL into ReelGet and download.',
    ],
    faq: [
      { q: 'Can I download Twitch live streams?', a: 'Live streams cannot be downloaded in real time. Only Twitch Clips (short highlights) are supported.' },
      { q: 'Can I download full Twitch VODs?', a: 'Twitch VODs that are publicly available may be supported. Subscriber-only or expired VODs cannot be accessed.' },
      { q: 'What quality are Twitch Clip downloads?', a: 'ReelGet downloads Twitch Clips at the highest available quality, typically 1080p60.' },
      { q: 'Do I need a Twitch account?', a: 'No — only a public Clip URL is needed. No Twitch account or subscription required.' },
      { q: 'What URL formats are supported?', a: 'Both clips.twitch.tv/ClipName and twitch.tv/username/clip/ClipName formats are supported.' },
    ],
    features: [
      'Download Twitch Clips in HD at up to 1080p60',
      'Supports clips.twitch.tv and twitch.tv/clip/ URL formats',
      'No Twitch account or subscription required',
      'Save gaming highlights, esports moments, and viral clips',
      'Works on iPhone, Android, PC, and Mac',
    ],
    tips: [
      'Open the Twitch Clip you want to save.',
      'Copy the URL from your browser\'s address bar (clips.twitch.tv/... or twitch.tv/.../clip/...).',
      'Paste the URL into ReelGet and click Download.',
      'Live streams cannot be saved — only Clips and public VODs.',
    ],
  },
};

// ─── Landing page metadata ────────────────────────────────────────────────────
interface LandingMeta {
  platform: Platform;
  emoji: string;
  gradient: string;
  h1colored: string;
  h1white: string;
  titleTag: string;
  metaDesc: string;
  subtitle: string;
  body: string[];
  features: string[];
  tips: string[];
  faq: { q: string; a: string }[];
}

const LANDING_META: Record<LandingSlug, LandingMeta> = {
  'instagram-reels-downloader': {
    platform: 'instagram',
    emoji: '🎬',
    gradient: 'from-pink-500 to-purple-600',
    h1colored: 'Instagram Reels',
    h1white: 'Downloader',
    titleTag: 'Instagram Reels Downloader — Save Reels Without Watermark Free | ReelGet',
    metaDesc: 'Download Instagram Reels without watermark in HD — free, no login, no app. Paste the Reel link and save it to your phone or PC instantly.',
    subtitle: 'Save any public Instagram Reel as MP4 — no watermark, no login, works on iPhone & Android.',
    body: [
      'Instagram Reels are short-form videos up to 90 seconds long — but Instagram\'s own save feature either watermarks the download or only saves to your drafts. ReelGet\'s Instagram Reels downloader fetches Reels directly from Instagram\'s CDN, giving you the original HD file with no watermark and no quality loss.',
      'The downloader works with every Reel URL format: the full https://www.instagram.com/reel/ABC123/ link, short links, and even links copied from the Instagram mobile app\'s share sheet. There\'s no need to use a browser extension, install software, or create an account — it works entirely in your browser on any device.',
      'Downloaded Reels are saved as standard MP4 files, compatible with every phone, tablet, and desktop. You can watch them offline, share them on WhatsApp, import them into video editors, or archive them for later — all without any ReelGet branding added.',
    ],
    features: [
      'Download Instagram Reels in original HD quality without watermark',
      'Works on iPhone, Android, Windows, and Mac — no app needed',
      'Supports all Reel URL formats including short share links',
      'Saves as clean MP4 — no ReelGet branding added',
      'No Instagram account or login required',
    ],
    tips: [
      'Open the Instagram Reel you want to save, tap the three-dot menu (⋯), and select "Copy link."',
      'Paste the copied link into ReelGet\'s input box above.',
      'Click the Download button and wait 2–3 seconds for processing.',
      'Choose HD for best quality — the Reel saves to your device as a clean MP4.',
    ],
    faq: [
      { q: 'Does the downloaded Reel have a watermark?', a: 'No — ReelGet fetches the original Reel from Instagram\'s servers. No watermark is added by us, and Instagram\'s watermark is not present in the source file.' },
      { q: 'Can I download Reels on iPhone?', a: 'Yes. Open reelget.com in Safari on iPhone, paste the Reel link, and tap Download. The MP4 saves to your Files app or Photos.' },
      { q: 'Can I download private Reels?', a: 'No — only Reels from public accounts can be downloaded. Private account content is not accessible.' },
      { q: 'How long can a Reel be?', a: 'Instagram Reels can be up to 90 seconds. ReelGet supports all lengths up to the maximum.' },
      { q: 'Is there a download limit?', a: 'No — ReelGet is completely free with no download limits or daily caps.' },
    ],
  },

  'instagram-story-downloader': {
    platform: 'instagram',
    emoji: '⏳',
    gradient: 'from-orange-400 to-pink-500',
    h1colored: 'Instagram Story',
    h1white: 'Downloader',
    titleTag: 'Instagram Story Downloader — Save Stories Before They Expire | ReelGet',
    metaDesc: 'Download Instagram Stories before they disappear — save any public Story as MP4 or image for free. No login, no app required.',
    subtitle: 'Save Instagram Stories before the 24-hour timer runs out — free, no login, any device.',
    body: [
      'Instagram Stories disappear after 24 hours — which means a video you wanted to save is gone before you get the chance. ReelGet\'s Instagram Story downloader lets you save public Stories as MP4 files while they\'re still live, so you never miss a moment.',
      'To download a Story, you need the direct link to it. On Instagram, tap the share icon on the Story, select "Copy link," and paste it into ReelGet. This works for Stories from public accounts — any account whose profile is visible without following them.',
      'Downloaded Stories save as MP4 video files (or still images for photo Stories). No ReelGet watermark is added, and the file is the original quality as uploaded by the creator. Works on iPhone, Android, and desktop browsers without any app installation.',
    ],
    features: [
      'Save Instagram Stories as MP4 before they expire in 24 hours',
      'Download photo Stories as image files',
      'No watermark added to downloaded Stories',
      'Works on iPhone, Android, and desktop',
      'No Instagram account or login required for public Stories',
    ],
    tips: [
      'Open the Instagram Story you want to save and tap the share icon (paper plane).',
      'Select "Copy link" from the share options.',
      'Paste the link into ReelGet and click Download.',
      'Act quickly — Stories expire after 24 hours and can\'t be downloaded once gone.',
    ],
    faq: [
      { q: 'Can I download Instagram Stories without them knowing?', a: 'ReelGet downloads the video file — Instagram does not notify the account owner when you use a third-party downloader.' },
      { q: 'Can I download Stories from private accounts?', a: 'No — only Stories from public accounts with a shareable link can be downloaded.' },
      { q: 'What happens if a Story has expired?', a: 'Expired Stories cannot be downloaded. Make sure to save them while they are still live within the 24-hour window.' },
      { q: 'Can I download Highlights?', a: 'Instagram Highlights use the same URL format and are supported — they don\'t expire, so you can download them anytime.' },
      { q: 'Is it free?', a: 'Yes — completely free, with no account, no subscription, and no download limit.' },
    ],
  },

  'tiktok-downloader-no-watermark': {
    platform: 'tiktok',
    emoji: '💧',
    gradient: 'from-cyan-500 to-slate-700',
    h1colored: 'TikTok Downloader',
    h1white: 'Without Watermark',
    titleTag: 'TikTok Downloader Without Watermark — Save TikTok Videos Free | ReelGet',
    metaDesc: 'Download TikTok videos without watermark in HD — free, no login, no app. Remove the TikTok @username overlay and save a clean MP4.',
    subtitle: 'Remove the TikTok watermark and save any public video as a clean HD MP4 — free, instant, no app.',
    body: [
      'When you save a TikTok video using the app\'s built-in button, it adds a large watermark with the creator\'s @username and the TikTok logo. ReelGet\'s TikTok downloader bypasses this by fetching the video directly from TikTok\'s CDN before the watermark overlay is applied, giving you a completely clean file.',
      'The watermark-free download works for all public TikTok videos — standard feed videos, TikToks with music, Duets, Stitches, and Slideshows (where applicable). Both full tiktok.com links and short vm.tiktok.com share links are supported, so you can paste whatever link the app gives you.',
      'Because ReelGet processes the download on its own servers, the clean video is then streamed directly to your browser. This approach works even on devices or regions where TikTok restricts in-app saves. No TikTok account, no VPN, and no desktop software is needed.',
    ],
    features: [
      'Removes TikTok watermark — download a clean, unbranded MP4',
      'Fetches original video quality from TikTok\'s CDN directly',
      'Supports all TikTok content: feed videos, Duets, Stitches',
      'Works with vm.tiktok.com short links and full URLs',
      'No TikTok account or app installation required',
    ],
    tips: [
      'Open the TikTok video and tap the Share button (arrow icon), then "Copy link."',
      'Paste the link (full or short vm.tiktok.com) into ReelGet\'s input box.',
      'Click Download — the watermark-free MP4 is fetched and saved to your device.',
      'If the video has no sound, try the HD download option which includes the audio track.',
    ],
    faq: [
      { q: 'Why does TikTok add a watermark to saved videos?', a: 'TikTok adds a branded watermark to videos saved via the app to promote the platform. ReelGet downloads from the raw source before the watermark is applied.' },
      { q: 'Is downloading TikTok videos without watermark legal?', a: 'Downloading public content for personal use is generally permitted. Redistributing or claiming someone else\'s content as your own may violate copyright law and TikTok\'s terms.' },
      { q: 'Does the watermark-free download include the audio?', a: 'Yes — the HD download includes the original audio track from TikTok\'s CDN.' },
      { q: 'Can I download TikTok Live recordings?', a: 'TikTok Live streams are not supported. Only pre-recorded public videos can be downloaded.' },
      { q: 'Will TikTok know I downloaded the video?', a: 'ReelGet makes a server-side request — TikTok sees a standard content request, not a notification of a download.' },
    ],
  },

  'youtube-shorts-downloader': {
    platform: 'youtube',
    emoji: '⚡',
    gradient: 'from-red-500 to-red-700',
    h1colored: 'YouTube Shorts',
    h1white: 'Downloader',
    titleTag: 'YouTube Shorts Downloader — Save Shorts as MP4 Free | ReelGet',
    metaDesc: 'Download YouTube Shorts as MP4 for free — HD quality, no login, no browser extension. Paste the Shorts link and save it to your phone or PC.',
    subtitle: 'Save any YouTube Short as a clean HD MP4 — free, no login, no Chrome extension needed.',
    body: [
      'YouTube Shorts are vertical short-form videos up to 60 seconds — but YouTube doesn\'t offer a built-in download button for them. ReelGet\'s YouTube Shorts downloader fills that gap, letting you save any public Short as a high-quality MP4 in seconds, directly from your browser.',
      'The downloader supports all YouTube Shorts URL formats: the /shorts/ path on desktop, the share link from the YouTube app, and short youtu.be links. You don\'t need a YouTube account, a Chrome extension, or a desktop app — just paste the URL and download.',
      'Downloaded Shorts save as standard MP4 files that play on any device. They\'re great for watching offline during commutes, sharing on WhatsApp or Telegram, or archiving content from your favourite creators before it\'s removed.',
    ],
    features: [
      'Download YouTube Shorts in HD as MP4',
      'Supports /shorts/ URLs, youtu.be links, and share links from the app',
      'No YouTube account or YouTube Premium required',
      'Works in any browser on iPhone, Android, Windows, and Mac',
      'No browser extension or desktop software needed',
    ],
    tips: [
      'Tap the Share button on a YouTube Short and select "Copy link."',
      'On desktop, copy the URL from the address bar (it will contain /shorts/).',
      'Paste the link into ReelGet\'s input box and click Download.',
      'The Short saves as MP4 — compatible with WhatsApp, Telegram, and all video players.',
    ],
    faq: [
      { q: 'Can I download YouTube Shorts on iPhone?', a: 'Yes — open reelget.com in Safari, paste the Shorts link, and download. The MP4 saves to your Files or Photos app.' },
      { q: 'What quality are downloaded Shorts?', a: 'ReelGet downloads the highest available quality, typically 1080p vertical HD for most Shorts.' },
      { q: 'Can I download Shorts from any channel?', a: 'Only Shorts from public channels can be downloaded. Private or members-only Shorts are not supported.' },
      { q: 'Is there a length limit?', a: 'YouTube Shorts are up to 60 seconds by default, though some older Shorts run up to 3 minutes. All lengths are supported.' },
      { q: 'Does it work for regular YouTube videos too?', a: 'Yes — ReelGet also downloads full-length YouTube videos in HD, SD, and audio-only formats.' },
    ],
  },

  'youtube-to-mp3': {
    platform: 'youtube',
    emoji: '🎵',
    gradient: 'from-red-600 to-rose-500',
    h1colored: 'YouTube to MP3',
    h1white: 'Converter',
    titleTag: 'YouTube to MP3 Converter — Free Audio Download, No Software | ReelGet',
    metaDesc: 'Convert YouTube videos to MP3 / M4A audio for free — no software, no login, works on phone and PC. Extract audio from any public YouTube video instantly.',
    subtitle: 'Extract high-quality audio from any YouTube video — free, instant, works on any device.',
    body: [
      'ReelGet\'s YouTube to MP3 converter lets you extract the audio track from any public YouTube video and save it as an M4A audio file — the highest-quality format available from YouTube\'s servers. It\'s perfect for saving podcast episodes, music performances, lectures, language lessons, or any audio content you want to listen to offline.',
      'Unlike many converters that re-encode audio (losing quality in the process), ReelGet extracts the audio stream that YouTube already provides — meaning you get the native quality without any additional compression. The output is a standard M4A (AAC) file that plays in Apple Music, VLC, Spotify import, and every major audio player.',
      'No software installation, no Chrome extension, and no YouTube account is required. Simply paste any public YouTube video URL or youtu.be short link, click the "Audio Only" download button, and the file is saved directly to your device.',
    ],
    features: [
      'Extract audio from any public YouTube video as M4A (AAC)',
      'Native quality — no re-encoding or additional compression',
      'Works with youtube.com and youtu.be links',
      'Compatible with all audio players and podcast apps',
      'Free, no account required, works on phone and PC',
    ],
    tips: [
      'Copy the YouTube video URL from the address bar or the Share → Copy link option.',
      'Paste the URL into ReelGet\'s input box and click Download.',
      'When the results appear, select the "Audio Only (M4A)" option.',
      'The audio file saves to your device — import it to Apple Music, VLC, or any player.',
    ],
    faq: [
      { q: 'What format is the audio saved in?', a: 'Audio is saved as M4A (AAC), which is the native format YouTube uses. It plays on all modern devices and apps.' },
      { q: 'Is the audio quality good?', a: 'Yes — ReelGet extracts the audio stream YouTube provides without re-encoding, so quality is as high as the original upload.' },
      { q: 'Can I convert YouTube Music tracks?', a: 'YouTube Music tracks may be restricted. Standard YouTube videos with music content (live performances, covers, etc.) work fine.' },
      { q: 'Is it legal to convert YouTube to MP3?', a: 'Downloading for personal offline listening is generally considered fair use, but redistributing or using copyrighted audio commercially is not permitted.' },
      { q: 'Can I download the video and audio separately?', a: 'Yes — ReelGet offers HD video, SD video, and Audio Only options for most YouTube videos.' },
    ],
  },

  'facebook-reels-downloader': {
    platform: 'facebook',
    emoji: '🎞️',
    gradient: 'from-blue-500 to-blue-800',
    h1colored: 'Facebook Reels',
    h1white: 'Downloader',
    titleTag: 'Facebook Reels Downloader — Save Facebook Reels in HD Free | ReelGet',
    metaDesc: 'Download Facebook Reels in HD for free — no login, no app, no watermark. Paste any Facebook Reel link and save it to your device instantly.',
    subtitle: 'Save any public Facebook Reel as HD MP4 — free, no login, works on all devices.',
    body: [
      'Facebook Reels are short vertical videos that appear throughout the Facebook feed and on creator profiles. Unlike Instagram, Facebook doesn\'t watermark downloaded Reels — but it also doesn\'t offer a built-in save button for them. ReelGet fills that gap, letting you download any public Facebook Reel as an MP4 in HD quality without needing a Facebook account.',
      'The Facebook Reels downloader works with all public Reel URL formats: links copied from the Facebook mobile app, links from facebook.com in a desktop browser, and short fb.watch share links. Just copy the link from the Reel\'s share menu and paste it into ReelGet.',
      'Downloads are processed on ReelGet\'s servers and the video is streamed directly to your browser — no extension, no third-party desktop app, and no Facebook login required. Works on iPhone, Android, Windows, and Mac.',
    ],
    features: [
      'Download Facebook Reels in HD MP4 without login',
      'Supports full facebook.com Reel URLs and fb.watch short links',
      'No Facebook account or app required',
      'Works on iPhone, Android, Windows, and Mac',
      'No browser extension or desktop software needed',
    ],
    tips: [
      'Open the Facebook Reel and tap the three-dot menu (⋯) or the Share button.',
      'Select "Copy link" to copy the Reel URL.',
      'Paste the link into ReelGet\'s input box and click Download.',
      'fb.watch short links work identically — paste either format.',
    ],
    faq: [
      { q: 'Can I download Facebook Reels without a Facebook account?', a: 'Yes — ReelGet only needs the public Reel URL. No Facebook login is required.' },
      { q: 'Do fb.watch short links work?', a: 'Yes — fb.watch short links are automatically resolved. Paste them directly into ReelGet.' },
      { q: 'Can I download Reels from private profiles?', a: 'No — only Reels from public profiles or public groups can be downloaded.' },
      { q: 'What quality are the downloaded Reels?', a: 'ReelGet selects the highest available quality from Facebook\'s CDN, typically 720p or 1080p HD.' },
      { q: 'Can I also download regular Facebook videos (not Reels)?', a: 'Yes — standard Facebook videos, Watch videos, and Reels are all supported.' },
    ],
  },

  'reddit-video-downloader': {
    platform: 'reddit',
    emoji: '🤖',
    gradient: 'from-orange-500 to-red-600',
    h1colored: 'Reddit Video',
    h1white: 'Downloader',
    titleTag: 'Reddit Video Downloader — Save Reddit Videos with Audio Free | ReelGet',
    metaDesc: 'Download Reddit videos with audio for free — no login, no app. Fixes the missing audio problem. Save any public Reddit video as MP4 instantly.',
    subtitle: 'Save Reddit videos as MP4 with audio — fixes the silent download problem, free & instant.',
    body: [
      'Reddit videos are notoriously tricky to download because the platform splits audio and video into separate streams. Most tools give you a silent clip. ReelGet solves this by merging both streams server-side before delivering a complete MP4 with full audio to your device.',
      'Works with any public Reddit post containing a video — from any subreddit. Both full reddit.com URLs and short redd.it share links are supported. No Reddit account, no app, and no browser extension needed.',
      'Perfect for saving funny clips, news footage, gaming highlights, and viral moments from Reddit before they get removed.',
    ],
    features: [
      'Downloads Reddit videos with audio — no more silent clips',
      'Merges audio and video streams automatically server-side',
      'Supports redd.it short links and full reddit.com URLs',
      'Works across all public subreddits',
      'No Reddit account required',
    ],
    tips: [
      'Open the Reddit post with the video and tap Share → Copy link.',
      'Paste the post URL (not the video direct URL) into ReelGet.',
      'Click Download — audio and video are merged automatically.',
      'Both redd.it and reddit.com links work identically.',
    ],
    faq: [
      { q: 'Why do Reddit videos have no sound when downloaded elsewhere?', a: 'Reddit stores audio and video as separate streams. Most tools only grab the video. ReelGet merges both server-side so you always get a complete video with sound.' },
      { q: 'Do redd.it short links work?', a: 'Yes — short redd.it share links are automatically resolved.' },
      { q: 'Can I download from any subreddit?', a: 'Yes — any public subreddit video post can be downloaded. Private or restricted subreddits are not accessible.' },
      { q: 'What about Reddit GIFs?', a: 'Reddit GIFs are served as MP4 video files and are fully supported with audio where applicable.' },
      { q: 'Is it free?', a: 'Yes — completely free with no download limits.' },
    ],
  },

  'linkedin-video-downloader': {
    platform: 'linkedin',
    emoji: '💼',
    gradient: 'from-blue-600 to-blue-800',
    h1colored: 'LinkedIn Video',
    h1white: 'Downloader',
    titleTag: 'LinkedIn Video Downloader — Save LinkedIn Videos Free | ReelGet',
    metaDesc: 'Download LinkedIn videos for free — no login, no app required. Save any public LinkedIn video post as MP4 instantly with ReelGet.',
    subtitle: 'Save any public LinkedIn video post as MP4 — free, no login, works on all devices.',
    body: [
      'LinkedIn has grown into a rich video platform where professionals share industry insights, tutorials, conference talks, and career advice. ReelGet lets you save any public LinkedIn video post as an MP4 file — no LinkedIn Premium, no app, and no login required.',
      'Simply copy the URL of any public LinkedIn post containing a video and paste it into ReelGet. The downloader fetches the video at its original quality from LinkedIn\'s CDN and streams it directly to your browser.',
      'Great for saving content from thought leaders, archiving webinar clips, or sharing videos with colleagues who aren\'t on LinkedIn.',
    ],
    features: [
      'Download LinkedIn video posts as MP4',
      'No LinkedIn account or Premium required',
      'Fetches original quality from LinkedIn\'s CDN',
      'Works on iPhone, Android, PC, and Mac',
      'No browser extension or app installation needed',
    ],
    tips: [
      'Open the LinkedIn post containing the video.',
      'Click the three-dot menu (⋯) on the post and select "Copy link to post."',
      'Paste the link into ReelGet\'s input box and click Download.',
      'The video saves as MP4 to your device.',
    ],
    faq: [
      { q: 'Can I download LinkedIn videos without a LinkedIn account?', a: 'Yes — ReelGet only needs the public post URL. No LinkedIn login or Premium subscription is required.' },
      { q: 'What types of LinkedIn videos are supported?', a: 'Public LinkedIn video posts and native uploads are supported. LinkedIn Learning videos are behind a paywall and cannot be accessed.' },
      { q: 'What quality are the downloads?', a: 'ReelGet fetches the original video quality as uploaded by the creator on LinkedIn\'s CDN.' },
      { q: 'Can I download LinkedIn Live recordings?', a: 'LinkedIn Live recordings that are publicly shared on a profile or page can be downloaded after the broadcast ends.' },
      { q: 'Is it free?', a: 'Yes — completely free with no download limits.' },
    ],
  },

  'vimeo-downloader': {
    platform: 'vimeo',
    emoji: '🎬',
    gradient: 'from-cyan-500 to-blue-600',
    h1colored: 'Vimeo',
    h1white: 'Downloader',
    titleTag: 'Vimeo Downloader — Download Vimeo Videos Free in HD | ReelGet',
    metaDesc: 'Download Vimeo videos for free in HD — no login, no app. Save any public Vimeo video as MP4 instantly with ReelGet.',
    subtitle: 'Save any public Vimeo video as HD MP4 — free, no Vimeo account needed.',
    body: [
      'Vimeo is the go-to platform for high-quality creative video — filmmakers, designers, animators, and agencies use it to showcase their best work. ReelGet\'s Vimeo downloader lets you save any public Vimeo video as an HD MP4, preserving the quality that creators worked hard to achieve.',
      'Unlike YouTube, Vimeo often hosts original short films, portfolio reels, and creative projects that aren\'t available anywhere else. ReelGet lets you archive them for offline reference or presentation, fetching the highest available quality from Vimeo\'s CDN.',
      'Simply paste any public vimeo.com URL into ReelGet and click Download. Password-protected or private Vimeo videos cannot be downloaded.',
    ],
    features: [
      'Download Vimeo videos in HD quality up to 4K',
      'Saves original quality as uploaded by the creator',
      'No Vimeo account or Vimeo Pro required',
      'Works on iPhone, Android, PC, and Mac',
      'No browser extension needed',
    ],
    tips: [
      'Open the Vimeo video and copy the URL from your browser\'s address bar.',
      'Alternatively, click Share on the video and copy the link.',
      'Paste the URL into ReelGet and click Download.',
      'Password-protected or private videos cannot be downloaded.',
    ],
    faq: [
      { q: 'Can I download private Vimeo videos?', a: 'No — only publicly accessible Vimeo videos can be downloaded. Password-protected or private videos are not supported.' },
      { q: 'What quality are Vimeo downloads?', a: 'ReelGet selects the highest available quality from Vimeo\'s CDN, which can be up to 4K for some videos.' },
      { q: 'Do I need a Vimeo account?', a: 'No — only a public Vimeo video URL is needed.' },
      { q: 'What format are downloaded Vimeo videos?', a: 'Videos are downloaded as MP4 files, compatible with all devices and video players.' },
      { q: 'Is it free?', a: 'Yes — completely free with no download limits.' },
    ],
  },

  'dailymotion-downloader': {
    platform: 'dailymotion',
    emoji: '📺',
    gradient: 'from-blue-500 to-indigo-600',
    h1colored: 'Dailymotion',
    h1white: 'Downloader',
    titleTag: 'Dailymotion Downloader — Save Dailymotion Videos Free in HD | ReelGet',
    metaDesc: 'Download Dailymotion videos for free in HD — no login, no app. Save any public Dailymotion video as MP4 instantly with ReelGet.',
    subtitle: 'Save any public Dailymotion video as HD MP4 — free, no account needed.',
    body: [
      'Dailymotion is one of the world\'s largest video platforms, hosting news clips, entertainment content, sports highlights, and creator videos across dozens of countries. ReelGet lets you save any public Dailymotion video as MP4 in HD quality in seconds.',
      'Both full dailymotion.com URLs and short dai.ly share links are accepted — no URL conversion needed. Just copy and paste directly into ReelGet.',
      'Dailymotion is particularly popular in France, the Middle East, and Southeast Asia, and ReelGet supports it fully alongside all other major platforms.',
    ],
    features: [
      'Download Dailymotion videos in HD MP4',
      'Supports dai.ly short links and full dailymotion.com URLs',
      'No Dailymotion account required',
      'Works on all devices and browsers',
      'Free with no download limits',
    ],
    tips: [
      'Open the Dailymotion video and copy the URL from your browser.',
      'Short dai.ly links work just as well as full URLs.',
      'Paste the URL into ReelGet and click Download.',
      'Only public, non-restricted videos can be downloaded.',
    ],
    faq: [
      { q: 'Can I download Dailymotion videos for free?', a: 'Yes — ReelGet is completely free with no download limits for public Dailymotion videos.' },
      { q: 'Do dai.ly short links work?', a: 'Yes — dai.ly short links are automatically resolved to the full video.' },
      { q: 'What quality are Dailymotion downloads?', a: 'ReelGet selects the highest available quality, typically up to 1080p HD.' },
      { q: 'Do I need a Dailymotion account?', a: 'No account required for publicly accessible videos.' },
      { q: 'What format are the downloads?', a: 'Videos are saved as MP4 files compatible with all devices.' },
    ],
  },

  'twitch-clips-downloader': {
    platform: 'twitch',
    emoji: '🎮',
    gradient: 'from-purple-600 to-violet-700',
    h1colored: 'Twitch Clips',
    h1white: 'Downloader',
    titleTag: 'Twitch Clips Downloader — Save Twitch Clips in HD Free | ReelGet',
    metaDesc: 'Download Twitch Clips for free in HD — no login, no app. Save any public Twitch Clip as MP4 instantly with ReelGet.',
    subtitle: 'Save any Twitch Clip as HD MP4 at 1080p60 — free, no Twitch account needed.',
    body: [
      'Twitch Clips are short, shareable highlights created from live streams and VODs — the perfect way to capture clutch plays, funny reactions, world-record runs, and viral gaming moments. ReelGet lets you save any public Twitch Clip as an MP4 at its original quality, typically 1080p60.',
      'Both clips.twitch.tv and twitch.tv/clip/ URL formats are fully supported. No Twitch account, no subscription, and no browser extension needed — just paste the Clip URL and download.',
      'Downloaded Clips save as standard MP4 files you can share on Discord, Twitter, YouTube, or anywhere else without losing quality.',
    ],
    features: [
      'Download Twitch Clips in HD at up to 1080p60',
      'Supports clips.twitch.tv and twitch.tv/clip/ URL formats',
      'No Twitch account or subscription required',
      'Save gaming highlights, esports moments, and viral clips',
      'Works on iPhone, Android, PC, and Mac',
    ],
    tips: [
      'Open the Twitch Clip you want to save in your browser.',
      'Copy the URL from the address bar (clips.twitch.tv/... or twitch.tv/.../clip/...).',
      'Paste the URL into ReelGet and click Download.',
      'Live streams cannot be saved — only Clips work.',
    ],
    faq: [
      { q: 'Can I download Twitch live streams?', a: 'Live streams cannot be downloaded in real time. Only Twitch Clips (short highlights) are supported.' },
      { q: 'What quality are Twitch Clip downloads?', a: 'ReelGet downloads Twitch Clips at the highest available quality, typically 1080p60.' },
      { q: 'Do I need a Twitch account?', a: 'No — only a public Clip URL is needed. No Twitch account or subscription required.' },
      { q: 'What URL formats are supported?', a: 'Both clips.twitch.tv/ClipName and twitch.tv/username/clip/ClipName formats are supported.' },
      { q: 'Is it free?', a: 'Yes — completely free with no download limits.' },
    ],
  },

  'twitter-video-downloader': {
    platform: 'twitter',
    emoji: '🐦',
    gradient: 'from-sky-400 to-blue-600',
    h1colored: 'Twitter Video',
    h1white: 'Downloader',
    titleTag: 'Twitter Video Downloader — Download X Videos & GIFs Free | ReelGet',
    metaDesc: 'Download Twitter and X videos as MP4 for free — no login, no app. Save any public tweet video or GIF instantly with ReelGet.',
    subtitle: 'Save any public Twitter / X video or GIF as MP4 — free, instant, no login.',
    body: [
      'Twitter (now X) hosts millions of videos and GIFs shared by news organisations, sports teams, content creators, and everyday users — but the platform doesn\'t offer a built-in download option. ReelGet\'s Twitter video downloader lets you save any public tweet video as an HD MP4 file in seconds, with no login and no browser extension.',
      'Twitter GIFs appear to be animated images, but they\'re actually looping MP4 videos. ReelGet downloads them in the MP4 format, which is higher quality and more universally compatible than the GIF format itself. Both twitter.com and x.com URL formats are fully supported — whichever link you copy from the app or browser will work.',
      'Simply copy the link to the tweet (not the individual video URL — the full tweet URL), paste it into ReelGet, and click Download. The video is fetched from Twitter\'s CDN at the highest available resolution and delivered directly to your browser.',
    ],
    features: [
      'Download Twitter and X videos in HD as MP4',
      'Save Twitter GIFs as high-quality MP4 video files',
      'Supports both twitter.com and x.com URL formats',
      'Works on videos embedded in replies and tweet threads',
      'No Twitter account or X Premium required',
    ],
    tips: [
      'Click the share icon on a tweet and select "Copy link to Tweet."',
      'Make sure you copy the tweet URL (e.g. twitter.com/user/status/123), not the video embed URL.',
      'Paste the link into ReelGet and click Download.',
      'Both twitter.com and x.com links work identically — no conversion needed.',
    ],
    faq: [
      { q: 'Why can\'t I right-click and save Twitter videos directly?', a: 'Twitter serves videos through a streaming CDN that prevents direct right-click saves. ReelGet handles the CDN extraction server-side.' },
      { q: 'Can I download videos from protected Twitter accounts?', a: 'No — only public tweets are accessible. Protected accounts require a logged-in follower session.' },
      { q: 'What quality are downloaded Twitter videos?', a: 'ReelGet selects the highest quality variant available, which is typically 720p or 1080p depending on how the video was uploaded.' },
      { q: 'Can I download Twitter Spaces audio?', a: 'Twitter Spaces recordings are not currently supported. Only tweet-embedded videos and GIFs are supported.' },
      { q: 'Do I need a Twitter / X account?', a: 'No — ReelGet only needs the public tweet URL. No account or login is required.' },
    ],
  },
};

// ─── Schema builder ───────────────────────────────────────────────────────────
function buildSchema(
  name: string,
  tips: string[],
  faq: { q: string; a: string }[],
  pageUrl: string,
  description: string,
) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: `ReelGet — ${name}`,
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Any',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        url: pageUrl,
        description,
      },
      {
        '@type': 'HowTo',
        name: `How to use ReelGet: ${name}`,
        step: tips.map((text, i) => ({
          '@type': 'HowToStep',
          position: i + 1,
          text,
        })),
      },
      {
        '@type': 'FAQPage',
        mainEntity: faq.map((item) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
      },
    ],
  };
}

// ─── Static params ────────────────────────────────────────────────────────────
export function generateStaticParams() {
  return routing.locales.flatMap((locale) => [
    ...PLATFORMS.map((platform) => ({ locale, platform })),
    // Landing pages — English only
    ...(locale === 'en' ? LANDING_SLUGS.map((slug) => ({ locale, platform: slug })) : []),
  ]);
}

// ─── Metadata ─────────────────────────────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; platform: string }>;
}): Promise<Metadata> {
  const { locale, platform } = await params;

  // Landing page metadata
  if (LANDING_SLUGS.includes(platform as LandingSlug)) {
    const lp = LANDING_META[platform as LandingSlug];
    const url = `${BASE_URL}/en/${platform}`;
    return {
      title: lp.titleTag,
      description: lp.metaDesc,
      alternates: { canonical: url },
      openGraph: { title: lp.titleTag, description: lp.metaDesc, url, siteName: 'ReelGet', type: 'website' },
      twitter: { card: 'summary_large_image', title: lp.titleTag, description: lp.metaDesc, site: '@reelget' },
    };
  }

  // Platform page metadata
  if (!PLATFORMS.includes(platform as Platform)) return {};
  const p = PLATFORM_META[platform as Platform];
  const name = platform.charAt(0).toUpperCase() + platform.slice(1);
  const titleFn = LOCALE_TITLES[locale] ?? LOCALE_TITLES['en'];
  const descFn = LOCALE_DESCS[locale] ?? LOCALE_DESCS['en'];
  const title = titleFn(name);
  const description = descFn(name, p.types);
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
    openGraph: { title, description, url, siteName: 'ReelGet', type: 'website' },
    twitter: { card: 'summary_large_image', title, description, site: '@reelget' },
  };
}

// ─── Page component ───────────────────────────────────────────────────────────
export default async function PlatformPage({
  params,
}: {
  params: Promise<{ locale: string; platform: string }>;
}) {
  const { locale, platform } = await params;
  const t = await getTranslations({ locale });

  // ── Landing page render ──────────────────────────────────────────────────
  if (LANDING_SLUGS.includes(platform as LandingSlug)) {
    const lp = LANDING_META[platform as LandingSlug];
    const pageUrl = `${BASE_URL}/en/${platform}`;
    const schema = buildSchema(lp.titleTag, lp.tips, lp.faq, pageUrl, lp.metaDesc);

    return (
      <div className="min-h-screen bg-slate-950">
        <Tracker page={`landing:${platform}`} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />

        <nav className="bg-white sticky top-0 z-50 border-b border-slate-200 shadow-sm">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <a href={`/${locale}`} className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-teal-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">V</span>
              </div>
              <span className="font-bold text-slate-800 text-lg">ReelGet</span>
            </a>
            <a href={`/${locale}/${lp.platform}`} className="text-sm text-slate-500 hover:text-teal-600 font-medium transition">
              ← {lp.platform.charAt(0).toUpperCase() + lp.platform.slice(1)} Downloader
            </a>
          </div>
        </nav>

        <section className="relative bg-slate-900 text-white py-20 px-4 overflow-hidden">
          <div className="absolute top-10 left-10 w-72 h-72 bg-cyan-500 rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-blob" />
          <div className="absolute top-20 right-10 w-72 h-72 bg-violet-600 rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-blob animation-delay-2" />
          <div className="relative max-w-3xl mx-auto text-center">
            <span className="text-5xl mb-4 block">{lp.emoji}</span>
            <h1 className="text-4xl sm:text-5xl font-black mb-4 leading-tight">
              <span className={`bg-gradient-to-r ${lp.gradient} bg-clip-text text-transparent`}>{lp.h1colored}</span>{' '}
              <span className="text-white">{lp.h1white}</span>
            </h1>
            <p className="text-slate-300 text-base sm:text-lg mb-8 max-w-xl mx-auto">{lp.subtitle}</p>
            <DownloaderForm locale={locale} />
          </div>
        </section>

        <section className="max-w-3xl mx-auto px-4 pt-16 pb-8">
          <h2 className="text-xl font-bold text-white mb-5">Why use ReelGet?</h2>
          <ul className="space-y-3">
            {lp.features.map((feat, i) => (
              <li key={i} className="flex items-start gap-3 text-slate-300 text-sm">
                <span className="text-teal-400 mt-0.5 shrink-0">✓</span>
                <span>{feat}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="max-w-3xl mx-auto px-4 py-8">
          <h2 className="text-xl font-bold text-white mb-5">How to use</h2>
          <ol className="space-y-3">
            {lp.tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-3 text-slate-300 text-sm">
                <span className="w-6 h-6 rounded-full bg-teal-500/20 text-teal-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                <span>{tip}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="max-w-3xl mx-auto px-4 py-8">
          <h2 className="text-xl font-bold text-white mb-5">About</h2>
          <div className="space-y-4">
            {lp.body.map((para, i) => (
              <p key={i} className="text-slate-400 text-sm leading-relaxed">{para}</p>
            ))}
          </div>
        </section>

        <section className="max-w-3xl mx-auto px-4 py-8">
          <h2 className="text-2xl font-bold text-white text-center mb-8">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {lp.faq.map((item, i) => (
              <div key={i} className="bg-slate-800 rounded-xl p-5">
                <h3 className="text-white font-semibold mb-2">{item.q}</h3>
                <p className="text-slate-400 text-sm">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-3xl mx-auto px-4 py-8 pb-16">
          <h2 className="text-lg font-semibold text-slate-400 mb-4 text-center">Also download from</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {PLATFORMS.map((pl) => {
              const meta = PLATFORM_META[pl];
              return (
                <a key={pl} href={`/${locale}/${pl}`}
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-teal-500 text-slate-300 hover:text-white rounded-full px-4 py-2 text-sm font-medium transition">
                  <span>{meta.emoji}</span>
                  <span>{pl.charAt(0).toUpperCase() + pl.slice(1)}</span>
                </a>
              );
            })}
          </div>
        </section>

        <footer className="bg-slate-950 text-slate-500 text-center py-10 px-4 text-sm border-t border-slate-800">
          <div className="flex justify-center mb-3">
            <a href={`/${locale}`} className="bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent font-black text-xl">ReelGet</a>
          </div>
          <p className="mb-1 text-slate-400">{t('footer.tagline')}</p>
          <p className="text-xs text-slate-600 mt-3">{t('footer.disclaimer')}</p>
          <div className="flex justify-center gap-4 text-xs text-slate-600 mt-4">
            <a href={`/${locale}/privacy`} className="hover:text-teal-400 transition">Privacy Policy</a>
            <a href={`/${locale}/terms`} className="hover:text-teal-400 transition">Terms of Service</a>
            <a href={`/${locale}/about`} className="hover:text-teal-400 transition">About</a>
          </div>
        </footer>
      </div>
    );
  }

  // ── Platform page render ─────────────────────────────────────────────────
  if (!PLATFORMS.includes(platform as Platform)) notFound();

  const p = PLATFORM_META[platform as Platform];
  const name = platform.charAt(0).toUpperCase() + platform.slice(1);
  const otherPlatforms = PLATFORMS.filter((pl) => pl !== platform);
  const pageUrl = `${BASE_URL}/${locale}/${platform}`;
  const descFn = LOCALE_DESCS[locale] ?? LOCALE_DESCS['en'];
  const schema = buildSchema(
    `${name} Video Downloader`,
    p.tips,
    p.faq,
    pageUrl,
    descFn(name, p.types),
  );

  return (
    <div className="min-h-screen bg-slate-950">
      <Tracker page={`platform:${locale}:${platform}`} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />

      <nav className="bg-white sticky top-0 z-50 border-b border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <a href={`/${locale}`} className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-teal-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">V</span>
            </div>
            <span className="font-bold text-slate-800 text-lg">ReelGet</span>
          </a>
          <a href={`/${locale}`} className="text-sm text-slate-500 hover:text-teal-600 font-medium transition">← All Platforms</a>
        </div>
      </nav>

      <section className="relative bg-slate-900 text-white py-20 px-4 overflow-hidden">
        <div className="absolute top-10 left-10 w-72 h-72 bg-cyan-500 rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-blob" />
        <div className="absolute top-20 right-10 w-72 h-72 bg-violet-600 rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-blob animation-delay-2" />
        <div className="relative max-w-3xl mx-auto text-center">
          <span className="text-5xl mb-4 block">{p.emoji}</span>
          <h1 className="text-4xl sm:text-5xl font-black mb-4 leading-tight">
            <span className={`bg-gradient-to-r ${p.gradient} bg-clip-text text-transparent`}>{name}</span>{' '}
            <span className="text-white">Downloader</span>
          </h1>
          <p className="text-slate-300 text-base sm:text-lg mb-8 max-w-xl mx-auto">
            Download {name} {p.types} free — no watermark, no login, no app.
          </p>
          <DownloaderForm locale={locale} />
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 pt-16 pb-8">
        <h2 className="text-xl font-bold text-white mb-5">Why use ReelGet for {name}?</h2>
        <ul className="space-y-3">
          {p.features.map((feat, i) => (
            <li key={i} className="flex items-start gap-3 text-slate-300 text-sm">
              <span className="text-teal-400 mt-0.5 shrink-0">✓</span>
              <span>{feat}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="max-w-3xl mx-auto px-4 py-8">
        <h2 className="text-xl font-bold text-white mb-5">How to download {name} videos</h2>
        <ol className="space-y-3">
          {p.tips.map((tip, i) => (
            <li key={i} className="flex items-start gap-3 text-slate-300 text-sm">
              <span className="w-6 h-6 rounded-full bg-teal-500/20 text-teal-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
              <span>{tip}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="max-w-3xl mx-auto px-4 py-8">
        <h2 className="text-xl font-bold text-white mb-5">About the {name} Downloader</h2>
        <div className="space-y-4">
          {p.body.map((para, i) => (
            <p key={i} className="text-slate-400 text-sm leading-relaxed">{para}</p>
          ))}
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 py-8">
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

      <section className="max-w-3xl mx-auto px-4 py-8 pb-16">
        <h2 className="text-lg font-semibold text-slate-400 mb-4 text-center">Also download from</h2>
        <div className="flex flex-wrap justify-center gap-3">
          {otherPlatforms.map((pl) => {
            const meta = PLATFORM_META[pl];
            return (
              <a key={pl} href={`/${locale}/${pl}`}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-teal-500 text-slate-300 hover:text-white rounded-full px-4 py-2 text-sm font-medium transition">
                <span>{meta.emoji}</span>
                <span>{pl.charAt(0).toUpperCase() + pl.slice(1)}</span>
              </a>
            );
          })}
        </div>
      </section>

      <footer className="bg-slate-950 text-slate-500 text-center py-10 px-4 text-sm border-t border-slate-800">
        <div className="flex justify-center mb-3">
          <a href={`/${locale}`} className="bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent font-black text-xl">ReelGet</a>
        </div>
        <p className="mb-1 text-slate-400">{t('footer.tagline')}</p>
        <p className="text-xs text-slate-600 mt-3">{t('footer.disclaimer')}</p>
        <div className="flex justify-center gap-4 text-xs text-slate-600 mt-4">
          <a href={`/${locale}/privacy`} className="hover:text-teal-400 transition">Privacy Policy</a>
          <a href={`/${locale}/terms`} className="hover:text-teal-400 transition">Terms of Service</a>
          <a href={`/${locale}/about`} className="hover:text-teal-400 transition">About</a>
        </div>
      </footer>
    </div>
  );
}
