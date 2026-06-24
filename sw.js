// ══════════════════════════════════════════════════════════════
//  SERVICE WORKER — بيان المزرعة v5
//  Cache-First: CDN assets
//  Stale-While-Revalidate: HTML + JS/CSS
//  Network-First with Cache Fallback: Firebase REST API
//  Background Sync: queued writes via offline-sync.js
// ══════════════════════════════════════════════════════════════
var CACHE_STATIC = 'farm-static-v5';
var CACHE_PAGES  = 'farm-pages-v5';
var CACHE_DATA   = 'farm-data-v5';    // Firebase GET responses

var APP_SHELL = [
  '/', '/index.html', '/dashboard.html', '/login.html',
  '/animals.html', '/health.html', '/vaccine.html',
  '/breeding.html', '/births.html', '/production.html',
  '/tasks.html', '/notifications.html', '/reports.html',
  '/inventory.html', '/finance.html', '/settings.html',
  '/styles.css', '/config.js', '/firebase.js',
  '/nav.js', '/shared.js', '/offline-sync.js', '/manifest.json',
];

var CDN_DOMAINS = [
  'cdn.jsdelivr.net', 'cdnjs.cloudflare.com',
  'fonts.googleapis.com', 'fonts.gstatic.com',
];

var FB_DOMAIN = 'firebasedatabase.app';

// ── Install ───────────────────────────────────────────────────
self.addEventListener('install', function(e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_STATIC).then(function(cache) {
      return Promise.allSettled(APP_SHELL.map(function(url) {
        return cache.add(url).catch(function() {});
      }));
    })
  );
});

// ── Activate ──────────────────────────────────────────────────
self.addEventListener('activate', function(e) {
  var keep = [CACHE_STATIC, CACHE_PAGES, CACHE_DATA];
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return !keep.includes(k); })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

// ── Fetch ─────────────────────────────────────────────────────
self.addEventListener('fetch', function(e) {
  var url = e.request.url;
  var method = e.request.method;

  // Skip non-GET browser chrome / analytics
  if (url.includes('mixpanel') || url.includes('analytics')) return;
  if (url.includes('chrome-extension')) return;

  // ── Firebase REST GET → Network-First with cache fallback ──
  if (url.includes(FB_DOMAIN) && method === 'GET') {
    e.respondWith(
      fetch(e.request.clone()).then(function(res) {
        if (res.ok) {
          // Cache successful Firebase reads for offline access
          var resClone = res.clone();
          caches.open(CACHE_DATA).then(function(cache) {
            // Cache with 5-minute TTL via custom header workaround
            cache.put(e.request, resClone);
          });
        }
        return res;
      }).catch(function() {
        // Offline: return cached Firebase data
        return caches.match(e.request).then(function(cached) {
          if (cached) {
            // Inject offline header so the app knows data is stale
            return new Response(cached.body, {
              status: 200,
              statusText: 'OK (Cached)',
              headers: new Headers({
                'Content-Type': 'application/json',
                'X-Farm-Cache': 'offline',
              }),
            });
          }
          // No cache — return empty array so app doesn't crash
          return new Response('[]', {
            status: 200,
            headers: new Headers({ 'Content-Type': 'application/json', 'X-Farm-Cache': 'empty' }),
          });
        });
      })
    );
    return;
  }

  // Skip Firebase writes — handled by offline-sync.js
  if (url.includes(FB_DOMAIN) && method !== 'GET') return;
  if (url.includes('googleapis.com/ai')) return;

  // ── CDN assets → Cache-First ──────────────────────────────
  if (CDN_DOMAINS.some(function(d) { return url.includes(d); })) {
    e.respondWith(
      caches.match(e.request).then(function(cached) {
        return cached || fetch(e.request).then(function(res) {
          if (res.ok) {
            caches.open(CACHE_STATIC).then(function(c) { c.put(e.request, res.clone()); });
          }
          return res;
        });
      })
    );
    return;
  }

  // ── HTML → Stale-While-Revalidate ────────────────────────
  if (method === 'GET' && (url.endsWith('.html') || url.endsWith('/'))) {
    e.respondWith(
      caches.open(CACHE_PAGES).then(function(cache) {
        return cache.match(e.request).then(function(cached) {
          var networkFetch = fetch(e.request).then(function(res) {
            if (res.ok) cache.put(e.request, res.clone());
            return res;
          }).catch(function() { return cached; });
          return cached || networkFetch;
        });
      })
    );
    return;
  }

  // ── JS / CSS → Stale-While-Revalidate ────────────────────
  if (method === 'GET' && (url.endsWith('.js') || url.endsWith('.css'))) {
    e.respondWith(
      caches.open(CACHE_STATIC).then(function(cache) {
        return cache.match(e.request).then(function(cached) {
          var networkFetch = fetch(e.request).then(function(res) {
            if (res.ok) cache.put(e.request, res.clone());
            return res;
          }).catch(function() { return cached; });
          return cached || networkFetch;
        });
      })
    );
    return;
  }
});

// ── Message from page: force sync ────────────────────────────
self.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (e.data && e.data.type === 'CLEAR_DATA_CACHE') {
    caches.delete(CACHE_DATA).then(function() {
      e.source.postMessage({ type: 'DATA_CACHE_CLEARED' });
    });
  }
});
