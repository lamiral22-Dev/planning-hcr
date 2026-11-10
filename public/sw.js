// Service Worker minimaliste pour PWA mobile (enregistrement du cache et compatibilité Chrome Android)
const CACHE_NAME = "hcr-planning-cache-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Pass-through standard pour les requêtes dynamiques
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
