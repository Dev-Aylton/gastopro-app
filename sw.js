/* ================================================================
   GastoPro - Service Worker (PWA)
   Network First para recursos locais; stale-while-revalidate apenas
   para fontes e folha de estilos do Font Awesome.
   ================================================================ */

const CACHE_NAME = 'gastopro-v4.5';
const ESSENTIAL_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/theme.js',
  './js/supabase.js',
  './js/data.js',
  './js/categories.js',
  './js/importer.js',
  './js/onboarding.js',
  './js/app.js',
  './js/a11y.js',
  './js/report.js',
  './manifest.json'
];
const OPTIONAL_ASSETS = [
  './js/vendor/chart.umd.js',
  './js/vendor/supabase.umd.js',
  './js/vendor/jspdf.umd.min.js',
  './js/vendor/jspdf.plugin.autotable.min.js',
  './js/vendor/pdf.mjs',
  './js/vendor/pdf.worker.mjs',
  './js/vendor/LICENSE.pdfjs.txt',
  './assets/logo-symbol.png',
  './assets/default_avatar.jpg',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-maskable-512.png',
  './assets/apple-touch-icon.png',
  './assets/statement-guide-step-1.svg',
  './assets/statement-guide-step-2.svg',
  './assets/statement-guide-step-3.svg'
];
const LOCAL_ASSETS = [...ESSENTIAL_ASSETS, ...OPTIONAL_ASSETS];
const EXTERNAL_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css'
];
const CDN_ORIGINS = new Set([
  'https://cdnjs.cloudflare.com',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com'
]);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(ESSENTIAL_ASSETS.map(url => new Request(url, { cache: 'reload' })));
    await Promise.all([
      ...LOCAL_ASSETS.slice(ESSENTIAL_ASSETS.length).map(url => cache.add(url).catch(error => {
        console.warn('[GastoPro SW] Recurso local opcional não armazenado:', url, error);
      })),
      ...EXTERNAL_ASSETS.map(url => cache.add(url).catch(error => {
        console.warn('[GastoPro SW] Recurso externo não armazenado:', url, error);
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

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.hostname === 'supabase.co' || requestUrl.hostname.endsWith('.supabase.co')) return;

  if (CDN_ORIGINS.has(requestUrl.origin)) {
    const cachePromise = caches.open(CACHE_NAME);
    const networkPromise = fetch(event.request).then(async response => {
      if (response.ok || response.type === 'opaque') {
        const cache = await cachePromise;
        await cache.put(event.request, response.clone());
      }
      return response;
    });
    event.waitUntil(networkPromise.catch(() => undefined));
    event.respondWith(cachePromise.then(async cache => {
      const cachedResponse = await cache.match(event.request);
      if (cachedResponse) return cachedResponse;
      try {
        return await networkPromise;
      } catch {
        return new Response('Offline - conteúdo não disponível.', { status: 503, statusText: 'Offline' });
      }
    }));
    return;
  }

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
