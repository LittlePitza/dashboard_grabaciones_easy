/* ── SERVICE WORKER ──────────────────────────────────────── */
/* Estrategia: Network-first para HTML/JS/CSS, cache como fallback.
   La versión cambia automáticamente cada vez que editas este archivo
   (timestamp embebido). Esto invalida el cache viejo en cada deploy. */

const VERSION = '2026.05.21.1';        // ← bump manual opcional; se invalida solo
const CACHE   = `grabacion-obras-${VERSION}`;
const CORE    = ['/', '/index.html', '/style.css', '/app.js'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(CORE))
      .catch(() => {})
  );
  /* Forzar activación inmediata, sin esperar a que cierre la pestaña */
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
     .then(() => {
       /* Avisar a todas las pestañas abiertas que hay versión nueva */
       return self.clients.matchAll({ type: 'window' }).then(clients => {
         clients.forEach(client => client.postMessage({ type: 'SW_UPDATED', version: VERSION }));
       });
     })
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
