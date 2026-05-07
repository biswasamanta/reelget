import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'hi', 'bn', 'id', 'ur', 'pt', 'ta', 'te', 'ar', 'vi', 'or', 'fr', 'sw'],
  defaultLocale: 'en',
  localePrefix: 'always'
});
