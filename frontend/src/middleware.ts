import createMiddleware from 'next-intl/middleware';
import { routing } from '../i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Match all paths except Next.js internals and static files.
  // /admin lives under [locale] (e.g. /en/admin), so it's intentionally matched.
  matcher: ['/((?!_next|_vercel|.*\\..*).*)'],
};
