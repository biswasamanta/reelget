import { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://reelget.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // General crawlers
      { userAgent: '*', allow: '/' },
      // Bing (powers ChatGPT Search)
      { userAgent: 'Bingbot', allow: '/' },
      // ChatGPT / OpenAI crawlers
      { userAgent: 'GPTBot', allow: '/' },
      { userAgent: 'OAI-SearchBot', allow: '/' },
      { userAgent: 'ChatGPT-User', allow: '/' },
      // Anthropic / Claude
      { userAgent: 'anthropic-ai', allow: '/' },
      { userAgent: 'Claude-Web', allow: '/' },
      { userAgent: 'ClaudeBot', allow: '/' },
      // Perplexity
      { userAgent: 'PerplexityBot', allow: '/' },
      // Google (Gemini)
      { userAgent: 'Googlebot', allow: '/' },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    // Point AI crawlers to the plain-text site description
    host: BASE_URL,
  };
}
