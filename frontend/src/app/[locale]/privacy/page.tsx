import type { Metadata } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://reelget.com';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: 'Privacy Policy | ReelGet',
    description: 'ReelGet Privacy Policy — how we handle your data when you use our free video downloader.',
    alternates: { canonical: `${BASE_URL}/${locale}/privacy` },
  };
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

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
            ← Home
          </a>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 py-16 text-slate-300">
        <h1 className="text-3xl font-black text-white mb-2">Privacy Policy</h1>
        <p className="text-slate-500 text-sm mb-10">Last updated: May 2025</p>

        <section className="space-y-8 text-sm leading-relaxed">
          <div>
            <h2 className="text-lg font-bold text-white mb-3">1. Overview</h2>
            <p>ReelGet ("we", "us", or "our") operates the website reelget.com (the "Service"). This Privacy Policy explains what information we collect, how we use it, and your rights regarding that information. We are committed to protecting your privacy and handling your data in an open and transparent manner.</p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-white mb-3">2. Information We Collect</h2>
            <p className="mb-3">ReelGet is designed to collect as little data as possible. Specifically:</p>
            <ul className="list-disc list-inside space-y-2 text-slate-400">
              <li><strong className="text-slate-300">Video URLs you submit</strong> — The link you paste is sent to our server solely to process your download request. We do not store, log, or share these URLs after the request is complete.</li>
              <li><strong className="text-slate-300">Downloaded videos</strong> — Videos are fetched from third-party platforms and streamed directly to your browser. We do not save any video files on our servers.</li>
              <li><strong className="text-slate-300">Server logs</strong> — Our hosting providers (Vercel and Railway) automatically record standard server log data, including IP addresses, request timestamps, and HTTP status codes, for security and operational purposes. These logs are retained for up to 30 days.</li>
              <li><strong className="text-slate-300">Aggregate usage statistics</strong> — We maintain an anonymous counter of total download requests to display on the site. No personally identifiable information is linked to this counter.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-bold text-white mb-3">3. Cookies</h2>
            <p className="mb-3">ReelGet itself does not set any first-party cookies. However, the following third-party services may set cookies when you use our site:</p>
            <ul className="list-disc list-inside space-y-2 text-slate-400">
              <li><strong className="text-slate-300">Google AdSense</strong> — If ads are displayed, Google may use cookies to serve personalised advertisements. You can opt out via <a href="https://adssettings.google.com" className="text-teal-400 hover:underline" target="_blank" rel="noopener noreferrer">Google Ad Settings</a>.</li>
              <li><strong className="text-slate-300">Vercel Analytics</strong> — We use Vercel's privacy-friendly analytics to understand aggregate traffic patterns. No personally identifiable data is collected.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-bold text-white mb-3">4. How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-2 text-slate-400">
              <li>To process your video download request</li>
              <li>To maintain the security and performance of our Service</li>
              <li>To display anonymous aggregate statistics on the site</li>
              <li>To comply with applicable laws and regulations</li>
            </ul>
            <p className="mt-3">We do not sell, trade, or rent your personal information to third parties.</p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-white mb-3">5. Third-Party Services</h2>
            <p>When you submit a video URL, our server makes a request to the relevant third-party platform (e.g., Instagram, YouTube, TikTok) to retrieve publicly available video content. These platforms have their own Privacy Policies, which govern how they handle requests made to their servers. We recommend reviewing the privacy policies of those platforms directly.</p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-white mb-3">6. Data Retention</h2>
            <p>We do not retain video URLs or downloaded content beyond the duration of a single request. Server log data is retained for up to 30 days by our infrastructure providers before automatic deletion.</p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-white mb-3">7. Your Rights</h2>
            <p className="mb-3">Depending on your location, you may have the following rights regarding your personal data:</p>
            <ul className="list-disc list-inside space-y-2 text-slate-400">
              <li>The right to access personal data we hold about you</li>
              <li>The right to request deletion of your personal data</li>
              <li>The right to object to or restrict processing of your data</li>
              <li>The right to data portability</li>
            </ul>
            <p className="mt-3">Since we do not store personally identifiable information beyond server logs, most requests can be addressed by contacting our infrastructure providers (Vercel and Railway) directly. For any other requests, please contact us at the address below.</p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-white mb-3">8. Children's Privacy</h2>
            <p>ReelGet is not directed at children under the age of 13. We do not knowingly collect personal information from children. If you believe we have inadvertently collected such information, please contact us immediately.</p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-white mb-3">9. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated "Last updated" date. Continued use of the Service after changes are posted constitutes your acceptance of the updated policy.</p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-white mb-3">10. Contact Us</h2>
            <p>If you have questions or concerns about this Privacy Policy, please contact us at:</p>
            <p className="mt-2 text-teal-400">privacy@reelget.com</p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-500 text-center py-10 px-4 text-sm border-t border-slate-800 mt-8">
        <div className="flex justify-center mb-3">
          <a href={`/${locale}`} className="bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent font-black text-xl">ReelGet</a>
        </div>
        <div className="flex justify-center gap-4 text-xs text-slate-500 mt-2">
          <a href={`/${locale}/privacy`} className="hover:text-teal-400 transition">Privacy Policy</a>
          <a href={`/${locale}/terms`} className="hover:text-teal-400 transition">Terms of Service</a>
          <a href={`/${locale}/about`} className="hover:text-teal-400 transition">About</a>
        </div>
      </footer>
    </div>
  );
}
