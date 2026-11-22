/**
 * Madhav Finance Manager - Progressive Web App Service Worker
 *
 * Implements offline asset caching, cache version management, safe precaching,
 * and seamless offline navigation fallback.
 *
 * All financial records remain stored on the client device in LocalStorage;
 * no financial or user data is cached or transmitted by this worker.
 */

const CACHE_NAME = 'madhav-finance-v1';

/**
 * Static application shell assets to precache during installation.
 * Relative paths are strictly used to guarantee compatibility with
 * both domain roots (http://localhost:3000/) and GitHub Pages repository
 * subpaths (https://username.github.io/repo-name/).
 */
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/apple-touch-icon.png',
  './assets/vendor/chart.umd.min.js',
  './js/app.js',
  './js/constants.js',
  './js/utils.js',
  './js/storage.js',
  './js/finance.js',
  './js/transactions.js',
  './js/budgets.js',
  './js/goals.js',
  './js/backup.js',
  './js/charts.js'
];

/**
 * Service Worker Installation: Pre-caches application shell assets.
 * Does not call skipWaiting() unconditionally to guarantee that active user
 * transactions and form inputs are never silently interrupted.
 * Updates are applied only when confirmed by the user.
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).catch((err) => {
      console.warn('Service worker installation precache failure:', err);
    })
  );
});

/**
 * Service Worker Activation: Purges obsolete caches while preserving
 * all local client databases and user financial records.
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((obsoleteName) => caches.delete(obsoleteName))
      );
    }).then(() => {
      // Immediately take control of all open client tabs/windows
      return self.clients.claim();
    })
  );
});

/**
 * Service Worker Fetch Interception:
 * - Cache-First strategy for static application assets.
 * - Dynamic network fallback with safe caching of successful 200 responses.
 * - Resilient offline navigation fallback to index.html.
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Only handle HTTP and HTTPS requests (ignore browser extensions, chrome-extension://, etc.)
  const url = new URL(request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      // Not in cache: fetch from network
      return fetch(request).then((networkResponse) => {
        // Only cache successful basic responses (status 200, non-opaque, same-origin or explicit assets)
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          (networkResponse.type === 'basic' || networkResponse.type === 'cors')
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          }).catch((err) => {
            console.warn('Failed to cache dynamically fetched resource:', err);
          });
        }

        return networkResponse;
      }).catch((fetchErr) => {
        // Network failed (device is offline)
        // If navigation request or HTML requested, return cached index.html
        if (
          request.mode === 'navigate' ||
          (request.headers.get('accept') && request.headers.get('accept').includes('text/html'))
        ) {
          return caches.match('./index.html').then((fallback) => {
            return fallback || caches.match('./');
          });
        }

        // Rethrow fetch error for non-navigation assets that were not precached
        throw fetchErr;
      });
    })
  );
});

/**
 * Listen for update commands from the client application.
 */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING' || event.data?.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
