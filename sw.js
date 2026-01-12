self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open('talknative-store').then((cache) => cache.addAll([
      '/',
      '/index.html',
      '/index.tsx',
    ])),
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request)),
  );
});