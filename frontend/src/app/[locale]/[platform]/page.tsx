import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import DownloaderForm from '@/components/DownloaderForm';
import { routing } from '@/../i18n/routing';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://reelget.com';
const LOCALES = ['en', 'hi', 'bn', 'id', 'ur', 'pt', 'ta', 'te', 'ar', 'vi', 'or', 'fr', 'sw', 'tl', 'ha', 'am'];
const PLATFORMS = ['instagram', 'tiktok', 'facebook', 'youtube', 'twitter', 'pinterest', 'snapchat'] as const;
type Platform = (typeof PLATFORMS)[number];

// Locale-specific keyword-rich title templates (name = capitalised platform name)
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
};

const PLATFORM_META: Record<Platform, {
  emoji: string;
  gradient: string;
  types: string;
  faq: { q: string; a: string }[];
  features: string[];
  tips: string[];
}> = {
  instagram: {
    emoji: '📸',
    gradient: 'from-pink-500 to-purple-600',
    types: 'Reels, Posts & Stories',
    faq: [
      { q: 'Can I download Instagram Reels without watermark?', a: 'Yes! ReelGet downloads Instagram Reels directly from Instagram\'s servers — no watermark is added.' },
      { q: 'Can I download Instagram Stories?', a: 'Yes — Stories from public accounts can be downloaded as MP4 files.' },
      { q: 'Can I download Instagram photos?', a: 'Currently video content (Reels, video posts, Stories) is supported. Image-only posts are not yet supported.' },
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
    faq: [
      { q: 'Can I download TikTok videos without watermark?', a: 'Yes — ReelGet removes the TikTok watermark by fetching the original CDN source directly.' },
      { q: 'Does it work on TikTok Reels?', a: 'Yes, all public TikTok videos and Reels are supported.' },
      { q: 'Can I save TikTok videos to my phone?', a: 'Yes! The downloaded MP4 saves directly to your device.' },
      { q: 'Do I need a TikTok account?', a: 'No — no account or app required.' },
    ],
    features: [
      'Download TikTok videos without watermark in HD',
      'Save TikTok Reels as MP4 directly to your device',
      'Supports short TikTok share links (vm.tiktok.com)',
      'Server-side download — works even when the TikTok app blocks saves',
      'Works on all devices: iPhone, Android, laptop, and desktop',
    ],
    tips: [
      'Open the TikTok video you want to save and tap "Share", then "Copy link."',
      'On desktop, right-click the video URL in the address bar and copy it.',
      'Paste the link into ReelGet and hit Download — the watermark-free MP4 is served directly.',
      'Short vm.tiktok.com links work exactly the same as full URLs.',
    ],
  },
  facebook: {
    emoji: '👍',
    gradient: 'from-blue-600 to-blue-800',
    types: 'Videos & Reels',
    faq: [
      { q: 'Can I download Facebook Reels?', a: 'Yes! Paste any public Facebook Reel or video URL and click Download.' },
      { q: 'What about Facebook Watch videos?', a: 'Public Facebook Watch videos are fully supported.' },
      { q: 'Can I download private Facebook videos?', a: 'No — only publicly shared videos can be downloaded.' },
      { q: 'Do I need to log in?', a: 'No login needed for public videos.' },
    ],
    features: [
      'Download Facebook Reels in HD without login',
      'Save Facebook Watch videos to your device',
      'Supports fb.watch short links and full facebook.com URLs',
      'Download public Facebook group and page videos',
      'Works instantly — no browser extension required',
    ],
    tips: [
      'Click the three-dot menu on a Facebook video and select "Copy link to video."',
      'For Facebook Reels, tap "Share" and copy the link.',
      'Paste the link into ReelGet and select the quality you want.',
      'FB Watch short links (fb.watch/…) are fully supported.',
    ],
  },
  youtube: {
    emoji: '▶️',
    gradient: 'from-red-600 to-red-700',
    types: 'Videos & Shorts',
    faq: [
      { q: 'Can I download YouTube Shorts?', a: 'Yes, YouTube Shorts are fully supported at HD quality.' },
      { q: 'Can I extract MP3 audio from YouTube?', a: 'Yes! Use the "Extract MP3 / Audio" button to get audio only.' },
      { q: 'Can I download YouTube playlists?', a: 'Currently individual video and Shorts URLs are supported, not full playlists.' },
      { q: 'Why do some videos fail to download?', a: 'Only public, non-DRM videos can be downloaded. Age-restricted, private, or membership-only content is not supported.' },
    ],
    features: [
      'Download YouTube videos in HD and SD quality',
      'Save YouTube Shorts as MP4 to your phone or PC',
      'Extract MP3 audio from any YouTube video for free',
      'Supports youtu.be short links and full youtube.com URLs',
      'No account, no Chrome extension, no software needed',
    ],
    tips: [
      'Click "Share" beneath a YouTube video and copy the link.',
      'For Shorts, tap "Share → Copy link" in the YouTube app.',
      'Use the Audio Only option to get podcast-quality MP3 downloads.',
      'Only public videos work — private and age-restricted videos cannot be downloaded.',
    ],
  },
  twitter: {
    emoji: '🐦',
    gradient: 'from-sky-500 to-blue-600',
    types: 'Videos & GIFs',
    faq: [
      { q: 'Can I download Twitter / X videos?', a: 'Yes! Paste any public tweet URL that contains a video or GIF.' },
      { q: 'What about GIFs posted on X?', a: 'Twitter/X GIFs are downloaded as MP4 video files.' },
      { q: 'Can I download videos from protected X accounts?', a: 'No — only public tweets can be downloaded.' },
      { q: 'Do I need to log in?', a: 'No login required for public tweets.' },
    ],
    features: [
      'Download Twitter / X videos in HD as MP4',
      'Save Twitter GIFs as video files to your device',
      'Supports both twitter.com and x.com URLs',
      'Works on videos embedded in tweet threads',
      'No login or X Premium account required',
    ],
    tips: [
      'Click the share icon on a tweet and select "Copy link to Tweet."',
      'Paste the tweet URL (not the video URL) into ReelGet.',
      'Both twitter.com and x.com links work identically.',
      'GIFs are saved as MP4 — the most universally supported format.',
    ],
  },
  pinterest: {
    emoji: '📌',
    gradient: 'from-red-500 to-rose-700',
    types: 'Videos & Pins',
    faq: [
      { q: 'Can I download Pinterest videos?', a: 'Yes! Paste any Pinterest pin URL that contains a video and click Download.' },
      { q: 'What types of Pinterest content are supported?', a: 'Video pins are fully supported. Image-only pins cannot be downloaded.' },
      { q: 'Does it work with pin.it short links?', a: 'Yes, pin.it short links are automatically resolved.' },
      { q: 'Do I need to log in?', a: 'No — no account or app required for public pins.' },
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
      'Only pins with video content can be downloaded — image pins are not supported.',
      'ReelGet fetches the original video quality, not a compressed preview.',
    ],
  },
  snapchat: {
    emoji: '👻',
    gradient: 'from-yellow-400 to-amber-500',
    types: 'Spotlight & Stories',
    faq: [
      { q: 'Can I download Snapchat Spotlight videos?', a: 'Yes! Paste any public Snapchat Spotlight URL and click Download.' },
      { q: 'Can I download Snapchat Stories?', a: 'Public Snapchat Stories shared via a web link can be downloaded.' },
      { q: 'Do I need a Snapchat account?', a: 'No account or app required for public Spotlight videos.' },
      { q: 'Why can\'t I download a Snap?', a: 'Only public Spotlight videos and Story links shared via URL can be downloaded. Private snaps cannot be accessed.' },
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
};

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    PLATFORMS.map((platform) => ({ locale, platform }))
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; platform: string }>;
}): Promise<Metadata> {
  const { locale, platform } = await params;
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
    openGraph: {
      title,
      description,
      url,
      siteName: 'ReelGet',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      site: '@reelget',
    },
  };
}

export default async function PlatformPage({
  params,
}: {
  params: Promise<{ locale: string; platform: string }>;
}) {
  const { locale, platform } = await params;
  if (!PLATFORMS.includes(platform as Platform)) notFound();

  const p = PLATFORM_META[platform as Platform];
  const name = platform.charAt(0).toUpperCase() + platform.slice(1);
  const t = await getTranslations({ locale });
  const otherPlatforms = PLATFORMS.filter((pl) => pl !== platform);

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Nav */}
      <nav className="bg-white sticky top-0 z-50 border-b border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <a href={`/${locale}`} className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-teal-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">V</span>
            </div>
            <span className="font-bold text-slate-800 text-lg">ReelGet</span>
          </a>
          <a href={`/${locale}`} className="text-sm text-slate-500 hover:text-teal-600 font-medium transition">
            ← All Platforms
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative bg-slate-900 text-white py-20 px-4 overflow-hidden">
        <div className="absolute top-10 left-10 w-72 h-72 bg-cyan-500 rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-blob" />
        <div className="absolute top-20 right-10 w-72 h-72 bg-violet-600 rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-blob animation-delay-2" />

        <div className="relative max-w-3xl mx-auto text-center">
          <span className="text-5xl mb-4 block">{p.emoji}</span>
          <h1 className="text-4xl sm:text-5xl font-black mb-4 leading-tight">
            <span className={`bg-gradient-to-r ${p.gradient} bg-clip-text text-transparent`}>
              {name}
            </span>{' '}
            <span className="text-white">Downloader</span>
          </h1>
          <p className="text-slate-300 text-base sm:text-lg mb-8 max-w-xl mx-auto">
            Download {name} {p.types} free — no watermark, no login, no app.
          </p>

          <DownloaderForm locale={locale} />
        </div>
      </section>

      {/* Features */}
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

      {/* How-to tips */}
      <section className="max-w-3xl mx-auto px-4 py-8">
        <h2 className="text-xl font-bold text-white mb-5">How to download {name} videos</h2>
        <ol className="space-y-3">
          {p.tips.map((tip, i) => (
            <li key={i} className="flex items-start gap-3 text-slate-300 text-sm">
              <span className="w-6 h-6 rounded-full bg-teal-500/20 text-teal-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </span>
              <span>{tip}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Platform FAQ */}
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

      {/* Also try — internal links */}
      <section className="max-w-3xl mx-auto px-4 py-8 pb-16">
        <h2 className="text-lg font-semibold text-slate-400 mb-4 text-center">Also download from</h2>
        <div className="flex flex-wrap justify-center gap-3">
          {otherPlatforms.map((pl) => {
            const meta = PLATFORM_META[pl];
            const plName = pl.charAt(0).toUpperCase() + pl.slice(1);
            return (
              <a
                key={pl}
                href={`/${locale}/${pl}`}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-teal-500 text-slate-300 hover:text-white rounded-full px-4 py-2 text-sm font-medium transition"
              >
                <span>{meta.emoji}</span>
                <span>{plName}</span>
              </a>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-500 text-center py-10 px-4 text-sm border-t border-slate-800">
        <div className="flex justify-center mb-3">
          <a href={`/${locale}`} className="bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent font-black text-xl">
            ReelGet
          </a>
        </div>
        <p className="mb-1 text-slate-400">{t('footer.tagline')}</p>
        <p className="text-xs text-slate-600 mt-3">{t('footer.disclaimer')}</p>
      </footer>
    </div>
  );
}
