/* Versioned service worker. __BUILD_ID__ and the precache list are stamped at build time. */
const VERSION = '__BUILD_ID__';
const CACHE = 'vros-' + VERSION;
const PRECACHE = "__PRECACHE__";

self.addEventListener('install', (e) => {
  const list = Array.isArray(PRECACHE) ? PRECACHE : ['./', './index.html'];
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(list)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('vros-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  if (r.mode === 'navigate') { // network-first so updates arrive; cache fallback = offline
    e.respondWith(fetch(r).then((res) => {
      const cp = res.clone();
      caches.open(CACHE).then((c) => c.put('./index.html', cp));
      return res;
    }).catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(r).then((hit) => hit || fetch(r).then((res) => {
    const cp = res.clone();
    caches.open(CACHE).then((c) => c.put(r, cp));
    return res;
  })));
});
