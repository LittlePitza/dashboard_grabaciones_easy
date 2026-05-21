/* ── SERVICE WORKER v1.4 ─────────────────────────────────── */
/* Estrategia: Network-first para HTML/JS/CSS, cache como fallback.
   Así siempre se sirve la versión más nueva si hay red,
   y funciona offline con la última versión descargada. */

const CACHE = 'grabacion-obras-v1.4';
const CORE  = ['/', '/index.html', '/style.css', '/app.js'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(CORE))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('supabase.co')) return;
  if (e.request.url.includes('googleapis.com')) return;
  if (e.request.url.includes('jsdelivr.net')) return;

  const isCore = CORE.some(p => e.request.url.endsWith(p) || e.request.url === self.location.origin + p);

  if (isCore) {
    /* Network-first: intenta red, guarda en cache, cae al cache si falla */
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
  } else {
    /* Cache-first para el resto (fuentes, imágenes, etc.) */
    e.respondWith(
      caches.match(e.request).then(cached =>
        cached || fetch(e.request).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        })
      )
    );
  }
});

self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
