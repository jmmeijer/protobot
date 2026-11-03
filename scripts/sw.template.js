const prefix = 'protobot:' + self.registration.scope + ':';
const cacheName = prefix + '__VERSION__';
const files = __FILES__;
const urls = new Set(files.map(file => new URL(file, self.registration.scope).href));
const shell = new URL('index.html', self.registration.scope).href;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache =>
    cache.addAll([...urls].map(url => new Request(url, {cache:'reload'})))));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(prefix) && name !== cacheName) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const isHome = request.mode === 'navigate' &&
    (url.origin + url.pathname === self.registration.scope || url.origin + url.pathname === shell);
  const key = isHome ? shell : url.href;
  if (!urls.has(key)) return;
  event.respondWith(caches.open(cacheName).then(async cache =>
    (await cache.match(key)) || fetch(request)));
});
