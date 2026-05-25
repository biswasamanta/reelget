/**
 * ReelGet content script — injects a ⬇ Download button on supported pages.
 * The button opens the ReelGet popup pre-filled with the current page URL.
 */

const API_BASE = 'https://api.reelget.com'; // Change to your Railway URL if different
const SITE_URL = 'https://reelget.com';

// Platform detection ─────────────────────────────────────────────────────────

function getPlatform() {
  const h = location.hostname;
  if (h.includes('youtube.com'))   return 'youtube';
  if (h.includes('instagram.com')) return 'instagram';
  if (h.includes('tiktok.com'))    return 'tiktok';
  if (h.includes('facebook.com'))  return 'facebook';
  if (h.includes('twitter.com') || h.includes('x.com')) return 'twitter';
  return null;
}

function isVideoPage() {
  const platform = getPlatform();
  const p = location.pathname;
  const s = location.search;
  if (platform === 'youtube')   return s.includes('v=') || p.startsWith('/shorts/');
  if (platform === 'instagram') return p.includes('/p/') || p.includes('/reel/') || p.includes('/tv/');
  if (platform === 'tiktok')    return p.includes('/video/');
  if (platform === 'facebook')  return p.includes('/videos/') || p.includes('/watch/') || p.includes('/reel/');
  if (platform === 'twitter')   return p.match(/\/status\/\d+/);
  return false;
}

// Button injection ────────────────────────────────────────────────────────────

let _btn = null;
let _lastUrl = '';

function injectButton() {
  if (!isVideoPage()) { removeButton(); return; }
  if (_btn) return; // already injected

  _btn = document.createElement('div');
  _btn.id = 'reelget-btn';
  _btn.title = 'Download with ReelGet';
  _btn.innerHTML = `
    <span class="rg-icon">⬇</span>
    <span class="rg-label">Download</span>
  `;
  _btn.addEventListener('click', () => {
    const target = `${SITE_URL}/en?url=${encodeURIComponent(location.href)}`;
    window.open(target, '_blank', 'noopener');
  });
  document.body.appendChild(_btn);
}

function removeButton() {
  if (_btn) { _btn.remove(); _btn = null; }
}

// Observe navigation (YouTube is a SPA) ──────────────────────────────────────

const observer = new MutationObserver(() => {
  if (location.href !== _lastUrl) {
    _lastUrl = location.href;
    removeButton();
    setTimeout(injectButton, 800); // wait for SPA render
  }
});

observer.observe(document.documentElement, { childList: true, subtree: true });

// Initial injection
setTimeout(injectButton, 1000);
