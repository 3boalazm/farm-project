// ══════════════════════════════════════════════════════════════
//  SERVICE WORKER — Farm Management System
//  Strategy: Cache-First for static assets, Network-First for data
// ══════════════════════════════════════════════════════════════
const CACHE_NAME  = 'farm-bayan-v4';
const CACHE_PAGES = 'farm-pages-v4';

// Static assets cached forever (immutable CDN)
const STATIC_CACHE = [
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Lexend:wght@400;600;700&display=swap',
];

// App shell — always cache these local files
const APP_SHELL = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/login.html',
  '/styles.css',
  '/config.js',
  '/firebase.js',
  '/nav.js',
  '/shared.js',
  '/manifest.json',
];

// ── Install: cache app shell ───────────────────────────────────
self.addEventListener('install', function(e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(APP_SHELL.concat(STATIC_CACHE));
    }).catch(function() {})  // Don't fail install if some resources are unavailable
  );
});

// ── Activate: clean old caches ────────────────────────────────
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME && k !== CACHE_PAGES; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

// ── Fetch: smart caching strategy ────────────────────────────
self.addEventListener('fetch', function(e) {
  var url = e.request.url;

  // Skip non-GET and Firebase API calls (always network)
  if (e.request.method !== 'GET') return;
  if (url.includes('firebasedatabase.app') || url.includes('googleapis.com/ai')) return;
  if (url.includes('mixpanel') || url.includes('analytics')) return;

  // CDN static assets → Cache First (they have content hash in URL)
  if (url.includes('cdn.jsdelivr.net') || url.includes('cdnjs.cloudflare.com') ||
      url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.match(e.request).then(function(cached) {
        if (cached) return cached;
        return fetch(e.request).then(function(res) {
          if (res.ok) {
            var clone = res.clone();
            caches.open(CACHE_NAME).then(function(c) { c.put(e.request, clone); });
          }
          return res;
        });
      })
    );
    return;
  }

  // HTML pages → Stale-While-Revalidate (show cached, update in background)
  if (url.endsWith('.html') || url.endsWith('/')) {
    e.respondWith(
      caches.open(CACHE_PAGES).then(function(cache) {
        return cache.match(e.request).then(function(cached) {
          var networkFetch = fetch(e.request).then(function(res) {
            if (res.ok) cache.put(e.request, res.clone());
            return res;
          }).catch(function() { return cached; });
          // Return cached immediately, update in background
          return cached || networkFetch;
        });
      })
    );
    return;
  }

  // JS/CSS local files → Stale-While-Revalidate
  if (url.includes(self.location.origin) && (url.endsWith('.js') || url.endsWith('.css'))) {
    e.respondWith(
      caches.open(CACHE_NAME).then(function(cache) {
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
