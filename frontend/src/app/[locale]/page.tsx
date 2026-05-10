import { getTranslations } from 'next-intl/server';
import DownloaderForm from '@/components/DownloaderForm';
import HowToSection from '@/components/HowToSection';
import FaqSection from '@/components/FaqSection';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import PlatformBadges from '@/components/PlatformBadges';
import TrendingSection from '@/components/TrendingSection';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Nav */}
      <nav className="bg-white sticky top-0 z-50 border-b border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-teal-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">V</span>
            </div>
            <span className="font-bold text-slate-800 text-lg">ReelGet</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex gap-4 text-sm">
              <a href="https://www.instagram.com" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-pink-500 font-medium transition">{t('nav.instagram')}</a>
              <a href="https://www.tiktok.com" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-white font-medium transition">{t('nav.tiktok')}</a>
              <a href="https://www.facebook.com" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-blue-500 font-medium transition">{t('nav.facebook')}</a>
              <a href="https://x.com" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-sky-500 font-medium transition">{t('nav.twitter')}</a>
              <a href="https://www.pinterest.com" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-red-500 font-medium transition">{t('nav.pinterest')}</a>
              <a href="https://www.youtube.com" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-red-500 font-medium transition">{t('nav.youtube')}</a>
            </div>
            <LanguageSwitcher currentLocale={locale} />
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative bg-slate-900 text-white py-20 px-4 overflow-hidden">
        {/* Animated background blobs */}
        <div className="absolute top-10 left-10 w-72 h-72 bg-cyan-500 rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-blob" />
        <div className="absolute top-20 right-10 w-72 h-72 bg-violet-600 rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-blob animation-delay-2" />
        <div className="absolute bottom-0 left-1/2 w-80 h-80 bg-teal-400 rounded-full mix-blend-screen filter blur-3xl opacity-15 animate-blob animation-delay-4" />

        <div className="relative max-w-3xl mx-auto text-center">
          {/* Badge */}
          <span className="inline-flex items-center gap-1 bg-gradient-to-r from-cyan-500/20 to-violet-500/20 text-cyan-300 border border-cyan-400/40 text-xs font-bold px-4 py-1.5 rounded-full mb-5 tracking-wide uppercase">
            ✦ {t('hero.badge')} ✦
          </span>

          {/* Gradient title */}
          <h1 className="text-4xl sm:text-6xl font-black mb-4 leading-tight">
            <span className="bg-gradient-to-r from-cyan-400 via-white to-violet-400 bg-clip-text text-transparent">
              {t('hero.title')}
            </span>
          </h1>

          <p className="text-slate-300 text-base sm:text-lg mb-8 max-w-xl mx-auto leading-relaxed">
            {t('hero.subtitle')}
          </p>

          <DownloaderForm locale={locale} />

          {/* Language quick-switch */}
          {(() => {
            const langs = [
              { code: 'en', label: 'English' },
              { code: 'hi', label: 'हिन्दी' },
              { code: 'bn', label: 'বাংলা' },
              { code: 'ta', label: 'தமிழ்' },
              { code: 'te', label: 'తెలుగు' },
              { code: 'id', label: 'Indonesia' },
              { code: 'pt', label: 'Português' },
              { code: 'ar', label: 'العربية' },
              { code: 'fr', label: 'Français' },
              { code: 'sw', label: 'Kiswahili' },
            ].filter(l => l.code !== locale);
            return (
              <div className="mt-5 flex flex-wrap justify-center items-center gap-x-1 gap-y-2">
                <span className="text-slate-500 text-xs mr-1">🌐</span>
                {langs.map((lang, i) => (
                  <span key={lang.code} className="flex items-center gap-1">
                    <a
                      href={`/${lang.code}`}
                      className="text-xs text-cyan-400/80 hover:text-cyan-300 hover:underline transition-colors"
                    >
                      {lang.label}
                    </a>
                    {i < langs.length - 1 && <span className="text-slate-700 text-xs">·</span>}
                  </span>
                ))}
              </div>
            );
          })()}

          {/* Trust bar */}
          <div className="flex justify-center gap-6 mt-8 text-slate-400 text-xs">
            <span className="flex items-center gap-1">⚡ {t('hero.badge').split('•')[0]?.trim()}</span>
            <span className="flex items-center gap-1">🔒 Private</span>
            <span className="flex items-center gap-1">🌍 13 Languages</span>
          </div>
        </div>
      </section>

      {/* Trending videos */}
      <TrendingSection locale={locale} />

      {/* Platform badges */}
      <PlatformBadges />

      {/* How to */}
      <HowToSection />

      {/* FAQ */}
      <FaqSection />

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-500 text-center py-10 px-4 text-sm border-t border-slate-800">
        <div className="flex justify-center mb-3">
          <span className="bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent font-black text-xl">ReelGet</span>
        </div>
        <p className="mb-1 text-slate-400">{t('footer.tagline')}</p>
        <p className="text-xs text-slate-600 mt-3">{t('footer.disclaimer')}</p>
      </footer>
    </div>
  );
}
