// Service Worker de nettoyage et d'auto-désinscription ArtisanPro
// Supprime tous les caches, se désinscrit immédiatement et force le rechargement sans cache

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // 1. Suppression intégrale de tous les caches du navigateur (CacheStorage)
      if ('caches' in self) {
        try {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        } catch (_) {}
      }

      // 2. Prise de contrôle immédiate de tous les onglets/clients
      try {
        await self.clients.claim();
      } catch (_) {}

      // 3. Désinscription complète du Service Worker
      try {
        if (self.registration) {
          await self.registration.unregister();
        }
      } catch (_) {}

      // 4. Notification à tous les clients/onglets pour rechargement direct depuis le réseau
      try {
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of clients) {
          if (client.url && typeof client.navigate === 'function') {
            client.navigate(client.url);
          }
        }
      } catch (_) {}
    })()
  );
});

// Aucun blocage de requêtes : retransmission directe au réseau sans interception
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
