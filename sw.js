// Service worker: cache everything on first visit so the game works fully offline.
const VERSION = 'orbi-v1.2.5';
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/engine/rng.js', 'js/engine/spaceweather.js', 'js/engine/sim.js',
  'js/ui/app.js', 'js/ui/i18n.js', 'js/ui/scene.js', 'js/ui/chart.js', 'js/ui/audio.js', 'js/ui/speech.js', 'js/ui/store.js', 'js/ui/data.js',
  'i18n/en.json', 'i18n/pt.json',
  'data/balance.json', 'data/donki_events.json', 'data/osdr_facts.json', 'data/radlab_iss.json', 'data/sites.json',
  'data/csa_food.json', 'data/imagery.json', 'data/meta.json', 'data/config.json',
  'fonts/lilita-one-latin-400.woff2', 'fonts/atkinson-latin-400.woff2', 'fonts/atkinson-latin-700.woff2',
  'img/icon.svg', 'img/icon-192.png', 'img/icon-512.png', 'img/jezero.jpg', 'img/moon-south-pole.jpg'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(ASSETS.map(a => c.add(a).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.includes('/api/')) return; // optional live proxy: never cache here
  // Network-first for HTML/JSON (so updates arrive), cache fallback for offline. Cache-first for the rest.
  const fresh = e.request.mode === 'navigate' || url.pathname.endsWith('.json');
  if (fresh) {
    e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); if (r.ok) caches.open(VERSION).then(c => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
  } else {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { const copy = res.clone(); if (res.ok) caches.open(VERSION).then(c => c.put(e.request, copy)); return res; })));
  }
});
