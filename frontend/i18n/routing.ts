import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'hi', 'bn', 'id', 'ur', 'pt', 'ta', 'te', 'ar', 'vi', 'or', 'fr', 'sw', 'tl', 'ha', 'am', 'es', 'ru', 'tr', 'th', 'ko', 'yo', 'ig', 'zu', 'so', 'om', 'rw', 'af', 'xh', 'mg', 'ny', 'sn', 'st', 'tn', 'ln', 'wo', 'ff', 'ti', 'ak'],
  defaultLocale: 'en',
  localePrefix: 'always'
});
