import type { Metadata } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://reelget.com';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: 'Terms of Service | ReelGet',
    description: 'ReelGet Terms of Service — rules and guidelines for using our free video downloader.',
    alternates: { canonical: `${BASE_URL}/${locale}/terms` },
  };
}

export default async function TermsPage({
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
        <h1 className="text-3xl font-black text-white mb-2">Terms of Service</h1>
        <p className="text-slate-500 text-sm mb-10">Last updated: May 2025</p>

        <section className="space-y-8 text-sm leading-relaxed">
          <div>
            <h2 className="text-lg font-bold text-white mb-3">1. Acceptance of Terms</h2>
            <p>By accessing or using ReelGet ("the Service") at reelget.com, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service. We reserve the right to update these terms at any time, and continued use of the Service constitutes acceptance of the updated terms.</p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-white mb-3">2. Description of Service</h2>
            <p>ReelGet is a free online tool that allows users to download publicly accessible videos from supported third-party platforms including Instagram, TikTok, Facebook, YouTube, Twitter/X, Pinterest, and Snapchat. The Service is provided "as is" and is intended for personal, non-commercial use only.</p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-white mb-3">3. Permitted Use</h2>
            <p className="mb-3">You may use ReelGet only for lawful purposes. Permitted uses include:</p>
            <ul className="list-disc list-inside space-y-2 text-slate-400">
              <li>Downloading publicly available videos for personal offline viewing</li>
              <li>Saving videos you have the right to download (e.g. your own content)</li>
              <li>Educational or research purposes in accordance with applicable fair use laws</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-bold text-white mb-3">4. Prohibited Uses</h2>
            <p className="mb-3">You agree NOT to use ReelGet to:</p>
            <ul className="list-disc list-inside space-y-2 text-slate-400">
              <li>Download, reproduce, or distribute content that infringes copyright or other intellectual property rights</li>
              <li>Download private, restricted, or unauthorised content</li>
              <li>Use the Service for commercial redistribution of downloaded videos without the rights holder's permission</li>
              <li>Attempt to overload, hack, or disrupt the Service or its infrastructure</li>
              <li>Use automated tools, bots, or scrapers to make bulk requests to the Service</li>
              <li>Violate any applicable local, national, or international law or regulation</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-bold text-white mb-3">5. Copyright and Intellectual Property</h2>
            <p className="mb-3">ReelGet respects intellectual property rights. All videos downloaded through the Service remain the property of their original creators and rights holders. By using this Service, you acknowledge that:</p>
            <ul className="list-disc list-inside space-y-2 text-slate-400">
              <li>Downloading copyrighted content without the rights holder's permission may violate copyright law in your jurisdiction.</li>
              <li>ReelGet is a technical tool and does not encourage or condone copyright infringement.</li>
              <li>You are solely responsible for ensuring that your use of downloaded content complies with applicable copyright laws and the Terms of Service of the originating platform.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-bold text-white mb-3">6. DMCA Compliance</h2>
            <p>If you believe that content accessible through our Service infringes your copyright, please send a DMCA takedown notice to <span className="text-teal-400">legal@reelget.com</span> including: (a) identification of the copyrighted work; (b) the URL of the alleged infringing content; (c) your contact information; and (d) a statement of good faith belief that the use is not authorised. We will respond to valid notices promptly.</p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-white mb-3">7. Third-Party Platforms</h2>
            <p>ReelGet accesses publicly available content from third-party platforms. The availability of content depends entirely on those platforms' APIs and terms. We are not affiliated with, endorsed by, or responsible for the content of Instagram, TikTok, Facebook, YouTube, Twitter/X, Pinterest, Snapchat, or any other third-party platform. Each platform's Terms of Service govern what content may be downloaded from their platform.</p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-white mb-3">8. Disclaimer of Warranties</h2>
            <p>The Service is provided on an "as is" and "as available" basis without warranties of any kind, either express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement. We do not warrant that the Service will be uninterrupted, error-free, or free of viruses or other harmful components.</p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-white mb-3">9. Limitation of Liability</h2>
            <p>To the maximum extent permitted by applicable law, ReelGet and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of data, loss of profits, or loss of goodwill, arising out of or in connection with your use of the Service, even if we have been advised of the possibility of such damages.</p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-white mb-3">10. Termination</h2>
            <p>We reserve the right to terminate or restrict your access to the Service at any time, without notice, for any reason including but not limited to violation of these Terms of Service.</p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-white mb-3">11. Governing Law</h2>
            <p>These Terms shall be governed by and construed in accordance with applicable law. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of the competent courts.</p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-white mb-3">12. Contact</h2>
            <p>For questions about these Terms of Service, please contact us at:</p>
            <p className="mt-2 text-teal-400">legal@reelget.com</p>
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
