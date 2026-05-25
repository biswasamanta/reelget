// ReelGet background service worker
// Handles context-menu "Download with ReelGet" for right-clicked links/pages.

const SITE = 'https://reelget.com';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id:       'reelget-download',
    title:    '⬇ Download with ReelGet',
    contexts: ['page', 'link', 'video'],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const target = info.linkUrl || info.pageUrl || tab?.url || '';
  if (!target) return;
  chrome.tabs.create({
    url: `${SITE}/en?url=${encodeURIComponent(target)}`,
  });
});
