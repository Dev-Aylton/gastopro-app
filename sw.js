/* ================================================================
   GastoPro — Service Worker (PWA)
   Autor: Aylton Alberto | ADS
   
   Estratégia: Network First para documentos e scripts locais
   (garante atualizações instantâneas de código sem cache preso)
   com fallback automático para Cache Offline.
   ================================================================ */

const CACHE_NAME = 'gastopro-v2.5';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './css/style.css',
  './js/supabase.js',
  './js/data.js',
  './js/importer.js',
  './js/app.js',
  './assets/logo.jpg',
  './assets/default_avatar.jpg',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js'
];

// INSTALL: armazena os assets no cache inicial
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[GastoPro SW v3.0] Cache inicial criado');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// ACTIVATE: remove caches antigos de versões anteriores
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[GastoPro SW] Removendo cache antigo:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// FETCH: Network First para scripts e arquivos locais
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Se a rede falhar ou estiver offline, busca do cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return new Response('Offline — conteúdo não disponível.', {
            status: 503,
            statusText: 'Offline'
          });
        });
      })
  );
});
