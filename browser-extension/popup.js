const API_BASE  = 'https://api.reelget.com'; // your Railway backend URL
const SITE_URL  = 'https://reelget.com';

let quality = 'hd';

// Auto-fill current tab URL
chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  if (tab?.url) document.getElementById('url-input').value = tab.url;
});

// Quality buttons
document.querySelectorAll('.quality-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.quality-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    quality = btn.dataset.q;
  });
});

// Download button
document.getElementById('dl-btn').addEventListener('click', async () => {
  const url = document.getElementById('url-input').value.trim();
  if (!url) return;

  const statusEl = document.getElementById('status');
  const dlBtn    = document.getElementById('dl-btn');
  statusEl.textContent = '';
  statusEl.className   = '';
  dlBtn.disabled = true;
  dlBtn.textContent = '⏳ Fetching…';

  const isYT = /youtube\.com|youtu\.be/.test(url);

  try {
    if (isYT) {
      // For YouTube, open the download directly (streams via backend)
      const dlUrl = `${API_BASE}/api/download-youtube?url=${encodeURIComponent(url)}&quality=${quality}`;
      chrome.tabs.create({ url: dlUrl });
      statusEl.textContent = '✅ Download started in new tab';
    } else {
      // For other platforms, fetch format metadata then open proxy URL
      const res  = await fetch(`${API_BASE}/api/download`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed');
      const fmt = data.formats?.[0];
      if (!fmt) throw new Error('No formats found');
      const proxyUrl = `${API_BASE}/api/proxy?url=${encodeURIComponent(fmt.url)}&filename=${encodeURIComponent(data.title)}&ext=${fmt.ext}`;
      chrome.tabs.create({ url: proxyUrl });
      statusEl.textContent = '✅ Download started in new tab';
    }
  } catch (e) {
    statusEl.textContent = e.message || 'Download failed';
    statusEl.className   = 'err';
  } finally {
    dlBtn.disabled = false;
    dlBtn.textContent = '⬇ Download';
  }
});

// Open in ReelGet button
document.getElementById('open-btn').addEventListener('click', () => {
  const url = document.getElementById('url-input').value.trim();
  const target = url
    ? `${SITE_URL}/en?url=${encodeURIComponent(url)}`
    : SITE_URL;
  chrome.tabs.create({ url: target });
});
