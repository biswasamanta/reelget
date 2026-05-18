import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import Script from 'next/script';
import { Analytics } from '@vercel/analytics/next';
import PWAManager from '@/components/PWAManager';
import "./globals.css";

export const metadata: Metadata = {
  other: {
    'google-adsense-account': 'ca-pub-2308669348522445',
    'google-site-verification': 'Lpygbm0p0QCOxQEXXDDehWNTCwJkvRh4FdsDCbc8dqI',
  },
  themeColor: '#22d3ee',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ReelGet',
  },
  formatDetection: { telephone: false },
};

const RTL_LOCALES = ['ar', 'ur'];

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const dir = RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr';
  return (
    <html lang={locale} dir={dir}>
      <head>
        {/* Prevent Android PWA viewport shift when keyboard opens */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, interactive-widget=resizes-visual"
        />
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2308669348522445"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </head>
      <body>
        {children}
        <PWAManager />
        <Analytics />
      </body>
    </html>
  );
}
