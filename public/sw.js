/* Recorte Studio: instalação e uso offline dos arquivos do aplicativo.
   Os projetos continuam salvos no IndexedDB do navegador. */
const CACHE_PREFIX = 'recorte-studio-pwa-';
// Substituído no build por um ID do conteúdo (vite.config.ts → pwaCacheVersion).
const CACHE_NAME = CACHE_PREFIX + 'dev';
const APP_ROOT = new URL(self.registration.scope);
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.svg',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(SHELL);

    // O Vite gera um nome com hash para o JavaScript. Descobri-lo no HTML
    // garante que a primeira instalação já tenha a interface disponível offline.
    const page = await cache.match('./index.html');
    if (page) {
      const html = await page.text();
      const resources = [...html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/g)]
        .map((match) => new URL(match[1], APP_ROOT))
        .filter((url) => url.origin === APP_ROOT.origin
          && url.pathname.startsWith(APP_ROOT.pathname)
          && /\.(?:js|css|woff2?)$/i.test(url.pathname))
        .map((url) => url.href);
      await Promise.allSettled(resources.map((url) => cache.add(url)));
    }

    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== APP_ROOT.origin || !url.pathname.startsWith(APP_ROOT.pathname)) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        // Prioriza a versão mais recente quando há conexão.
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put('./index.html', response.clone());
        }
        return response;
      } catch {
        return (await caches.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  const path = url.pathname.slice(APP_ROOT.pathname.length);
  const isAppAsset = path.startsWith('assets/') || path.startsWith('vendor/')
    || /^(?:manifest\.webmanifest|favicon\.svg|icon-(?:192|512)\.png)$/.test(path);
  if (!isAppAsset) return; // Não guardar respostas de APIs e serviços externos.

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  })());
});
