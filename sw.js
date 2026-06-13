/* GOAT PACE — Service Worker
   Estrategia conservadora pensada para una app que depende de Firebase:
   - El HTML y los iconos se cachean, pero el HTML va "network-first"
     (siempre intenta la versión más reciente; usa caché solo sin conexión).
   - Las peticiones a Firebase y a la CDN de Google (gstatic) NUNCA se interceptan:
     van siempre directas a la red, para no romper login ni sincronización.
   - Sube CACHE_VERSION cuando cambie el HTML para forzar refresco. */

const CACHE_VERSION = "goat-pace-v2";
const CORE_ASSETS = [
  "./plan-media-maraton.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Nunca interceptar tráfico de red de Firebase / Google / APIs externas:
  // deben ir siempre directos para que login y sincronización funcionen.
  const passthroughHosts = [
    "gstatic.com",
    "googleapis.com",
    "firebaseio.com",
    "firebasedatabase.app",
    "firebaseapp.com",
    "google.com",
  ];
  if (passthroughHosts.some((h) => url.hostname.includes(h))) {
    return; // deja que el navegador lo gestione normalmente
  }

  // Solo gestionamos peticiones GET del mismo origen
  if (event.request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  // HTML: network-first (versión fresca siempre que haya red)
  if (event.request.mode === "navigate" || url.pathname.endsWith(".html")) {
    event.respondWith(
      fetch(event.request)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(event.request, copy)).catch(() => {});
          return resp;
        })
        .catch(() => caches.match(event.request).then((r) => r || caches.match("./plan-media-maraton.html")))
    );
    return;
  }

  // Resto de assets del mismo origen (iconos, etc.): cache-first
  event.respondWith(
    caches.match(event.request).then((cached) =>
      cached ||
      fetch(event.request).then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE_VERSION).then((c) => c.put(event.request, copy)).catch(() => {});
        return resp;
      })
    )
  );
});
