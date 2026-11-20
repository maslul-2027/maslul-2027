const CACHE_PREFIX = 'maslul-demo-';
const CACHE = CACHE_PREFIX + 'v12';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon.svg', './capabilities.json', './design.css', './course-design.css', './mobile-shell.css'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => {
    return cache.addAll(FILES.map(file => new Request(file, { cache: 'reload' })));
  }).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || !request.url.startsWith(self.registration.scope)) return;

  const cacheURL = new URL(request.url);
  if (request.mode === 'navigate') cacheURL.searchParams.delete('refresh');

  const cacheWrite = fetch(request, { cache: 'no-cache' }).then(response => {
    if (!response.ok) return { response };
    const copy = response.clone();
    return { response, stored: caches.open(CACHE).then(cache => cache.put(cacheURL.href, copy)) };
  });
  event.waitUntil(cacheWrite.then(result => result.stored).catch(() => {}));
  event.respondWith(cacheWrite.then(result => result.response).catch(async () => {
    const cache = await caches.open(CACHE);
    return (await cache.match(cacheURL.href)) ||
      (request.mode === 'navigate' && await cache.match('./index.html')) ||
      Response.error();
  }));
});
