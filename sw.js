/* ================================================================
   GastoPro - Service Worker (PWA)
   Network First para recursos locais e precache de fontes/ícones.
   ================================================================ */

importScripts('./js/cache-assets.js');

const CACHE_NAME = 'gastopro-v4.76';
const ESSENTIAL_ASSETS = self.GastoProCacheAssets.essential;
const OPTIONAL_ASSETS = self.GastoProCacheAssets.optional;
const LOCAL_ASSETS = [...ESSENTIAL_ASSETS, ...OPTIONAL_ASSETS];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(ESSENTIAL_ASSETS.map(url => new Request(url, { cache: 'reload' })));
    await Promise.all([
      ...LOCAL_ASSETS.slice(ESSENTIAL_ASSETS.length).map(url => cache.add(url).catch(error => {
        console.warn('[GastoPro SW] Recurso local opcional não armazenado:', url, error);
      }))
    ]);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames
      .filter(name => name.startsWith('gastopro-') && name !== CACHE_NAME)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (!event.data || event.data.type !== 'GASTOPRO_GET_CACHE_NAME') return;
  const port = event.ports && event.ports[0];
  if (port) port.postMessage({ cacheName: CACHE_NAME });
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.hostname === 'supabase.co' || requestUrl.hostname.endsWith('.supabase.co')) return;

  if (requestUrl.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const controller = new AbortController();
    let timeoutId;
    try {
      const timeout = new Promise((resolve, reject) => {
        timeoutId = setTimeout(() => {
          controller.abort();
          reject(new Error('Network timeout'));
        }, 4000);
      });
      const network = fetch(event.request, {
        cache: 'no-cache',
        signal: controller.signal
      });
      const response = await Promise.race([network, timeout]);
      clearTimeout(timeoutId);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(event.request, response.clone());
      }
      return response;
    } catch {
      clearTimeout(timeoutId);
      if (event.request.mode === 'navigate') {
        const cachedIndex = await caches.match('./index.html');
        if (cachedIndex) return cachedIndex;
      } else {
        const cachedResponse = await caches.match(event.request, { ignoreSearch: true });
        if (cachedResponse) return cachedResponse;
      }
      return new Response('Offline - conteúdo não disponível.', { status: 503, statusText: 'Offline' });
    }
  })());
});
