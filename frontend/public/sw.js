const CACHE = 'reelget-v2';
const PRECACHE = ['/en', '/offline'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  // Skip non-GET, API calls, and cross-origin
  if (request.method !== 'GET') return;
  if (request.url.includes('/api/')) return;
  if (!request.url.startsWith(self.location.origin)) return;

  e.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((res) => {
        if (res.ok) {
          caches.open(CACHE).then((c) => c.put(request, res.clone()));
        }
        return res;
      });
      // Serve cache immediately, update in background (stale-while-revalidate)
      return cached || network.catch(() =>
        caches.match('/offline').then((off) => off || new Response('Offline', { status: 503 }))
      );
    })
  );
});
