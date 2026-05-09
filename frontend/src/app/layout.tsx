import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import Script from 'next/script';
import { Analytics } from '@vercel/analytics/next';
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
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2308669348522445"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
