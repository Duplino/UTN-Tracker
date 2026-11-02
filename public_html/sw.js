// Service worker de UTN Tracker. Hace dos cosas, nada más:
//
// 1. Que la app sea instalable (Chrome/Android piden un service worker con `fetch`).
// 2. Que abra sin conexión (el modo invitado funciona entero sin red; con sesión se
//    ve la última copia del tablero, ver bootCache.js):
//    - Páginas: primero la red; si no hay, la última copia guardada.
//    - Assets versionados (`?v=<hash>`, ver docker/version-assets.php): de la caché
//      si ya están, porque esa URL nunca cambia de contenido.
//    - Assets sin versión (fuentes que pide el CSS, o todo en desarrollo con
//      `php -S`): primero la red; la caché solo si no hay conexión.
//
// La API (/api/) y todo lo que no sea GET del mismo origen no se toca: va directo a
// la red como si no hubiera service worker.
//
// Para invalidar todo (por ejemplo si cambia esta lógica), subí la versión de CACHE.

const CACHE = 'utn-tracker-v1';
const OFFLINE_PAGES = ['/']; // share.html necesita la API: offline no sirve de nada

self.addEventListener('install', (event) => {
  // Precarga las páginas y los assets versionados que referencian, para poder abrir
  // la app offline desde la primera visita.
  event.waitUntil(precache().catch(() => { /* sin red: se completa navegando */ }).then(() => self.skipWaiting()));
});

async function precache() {
  const cache = await caches.open(CACHE);
  const assets = new Set();
  for (const page of OFFLINE_PAGES) {
    const res = await fetch(page, { cache: 'no-cache' });
    if (!res.ok || res.redirected) continue;
    const html = await res.clone().text();
    for (const m of html.matchAll(/(?:href|src)="(assets\/[^"]+\?v=[^"]+)"/g)) assets.add('/' + m[1]);
    await cache.put(page, res);
  }
  await cache.addAll([...assets]);
}

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (req.mode === 'navigate') {
    event.respondWith(networkFirstPage(req, url));
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(url.searchParams.has('v') ? cacheFirstVersioned(req, url) : networkFirst(req));
  }
});

// Las páginas se guardan sin query string (`/?carrera=x` y `/` son la misma app).
function pageKey(url) {
  return url.pathname === '/index.html' ? '/' : url.pathname;
}

async function networkFirstPage(req, url) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok && !res.redirected && OFFLINE_PAGES.includes(pageKey(url))) {
      await cache.put(pageKey(url), res.clone());
    }
    return res;
  } catch (err) {
    const cached = await cache.match(pageKey(url));
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirstVersioned(req, url) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;

  const res = await fetch(req);
  if (res.ok) {
    // Borra las versiones anteriores del mismo archivo para que la caché no crezca
    // con cada deploy.
    const old = await cache.keys();
    await Promise.all(old
      .filter((k) => { const u = new URL(k.url); return u.pathname === url.pathname && u.search !== url.search; })
      .map((k) => cache.delete(k)));
    await cache.put(req, res.clone());
  }
  return res;
}

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) await cache.put(req, res.clone());
    return res;
  } catch (err) {
    const cached = await cache.match(req);
    if (cached) return cached;
    throw err;
  }
}
