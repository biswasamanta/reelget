# ReelGet Browser Extension

Download videos from YouTube, Instagram, TikTok, Facebook, and Twitter/X directly from your browser.

## Install (unpacked / developer mode)

1. Go to `chrome://extensions` (or `edge://extensions`)
2. Enable **Developer mode** (toggle, top right)
3. Click **Load unpacked**
4. Select the `browser-extension/` folder
5. The ReelGet icon appears in your toolbar

## What it does

- **Floating button** — on YouTube, Instagram, TikTok, Facebook, Twitter pages a teal ⬇ button appears. Click it to open ReelGet pre-filled with the video URL.
- **Popup** — click the extension icon for a quality picker (HD / SD / Audio) and instant download.
- **Context menu** — right-click any page or link → *Download with ReelGet*.

## Configuration

If you self-host the backend, update `API_BASE` in `popup.js` and `content.js`:

```js
const API_BASE = 'https://YOUR-RAILWAY-APP.up.railway.app';
```

## Build for production

No build step needed — plain HTML/JS/CSS. For Firefox, change `manifest_version` to 2 and adjust `action` → `browser_action`, `service_worker` → `scripts`.

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | Extension config (Manifest V3) |
| `content.js` | Injects floating download button on video pages |
| `content.css` | Styles for the floating button |
| `background.js` | Service worker — adds right-click context menu |
| `popup.html` | Toolbar popup UI |
| `popup.js` | Popup logic — quality picker + download + open-in-site |
| `icons/` | 16×16, 48×48, 128×128 PNG icons (add yours here) |
