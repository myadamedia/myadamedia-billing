const CACHE_NAME = 'sso-pwa-v1';
const PRECACHE_URLS = [
  '/',
  '/img/logo.png',
  '/img/pwa-icon-192.png',
  '/img/pwa-icon-512.png',
  '/img/pwa-icon.svg',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))))
      ),
      self.clients.claim()
    ])
  );
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res && res.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, res.clone()).catch(() => {});
    }
    return res;
  } catch (e) {
    return new Response('Offline', { status: 408 });
  }
}

async function networkFirst(request, fallbackUrl) {
  try {
    const res = await fetch(request);
    if (res && res.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, res.clone()).catch(() => {});
    }
    return res;
  } catch (e) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = await caches.match(fallbackUrl);
      if (fallback) return fallback;
    }
    return new Response('Offline', {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const path = url.pathname;

  // Handle navigate request for the root SSO page
  if (req.mode === 'navigate' && (path === '/' || path === '/sso')) {
    event.respondWith(networkFirst(req, '/'));
    return;
  }

  // Cache static assets (images, CSS, fonts, etc.)
  if (
    path.startsWith('/img/') ||
    url.hostname.includes('cdn.jsdelivr.net') ||
    path.endsWith('.woff2') ||
    path.endsWith('.woff') ||
    path.endsWith('.ttf')
  ) {
    event.respondWith(cacheFirst(req));
    return;
  }

  event.respondWith(networkFirst(req));
});
