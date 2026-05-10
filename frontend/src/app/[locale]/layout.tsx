import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/../i18n/routing';

import en from '../../../messages/en.json';
import hi from '../../../messages/hi.json';
import bn from '../../../messages/bn.json';
import id from '../../../messages/id.json';
import ur from '../../../messages/ur.json';
import pt from '../../../messages/pt.json';
import ta from '../../../messages/ta.json';
import te from '../../../messages/te.json';
import ar from '../../../messages/ar.json';
import vi from '../../../messages/vi.json';
import or from '../../../messages/or.json';
import fr from '../../../messages/fr.json';
import sw from '../../../messages/sw.json';

const MESSAGE_MAP: Record<string, object> = { en, hi, bn, id, ur, pt, ta, te, ar, vi, or, fr, sw };

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://reelget.com';
const LOCALES = ['en', 'hi', 'bn', 'id', 'ur', 'pt', 'ta', 'te', 'ar', 'vi', 'or', 'fr', 'sw'];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: `${BASE_URL}/${locale}`,
      languages: {
        'x-default': `${BASE_URL}/en`,
        ...Object.fromEntries(LOCALES.map((l) => [l, `${BASE_URL}/${l}`])),
      },
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as never)) notFound();

  const messages = MESSAGE_MAP[locale] ?? MESSAGE_MAP['en'];

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
