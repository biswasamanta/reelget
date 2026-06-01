import createMiddleware from 'next-intl/middleware';
import { routing } from '../i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Match all paths except Next.js internals, static files, and the (non-localized)
  // /admin dashboard — otherwise i18n would redirect /admin → /en/admin (404).
  matcher: ['/((?!_next|_vercel|admin|.*\\..*).*)'],
};
