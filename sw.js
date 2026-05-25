'use strict';
const CACHE_NAME = 'farm-mz-v1';
const ASSETS = [
  './dashboard.html','./animals.html','./goats.html','./sheep.html',
  './diary.html','./barns.html','./breeding.html','./health.html',
  './vaccine.html','./finance.html','./inventory.html','./reports.html',
  './notifications.html','./settings.html','./cost.html',
  './styles.css','./shared.js','./firebase.js','./config.js','./notifications-service.js',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(ASSETS).catch(() => {})).then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      if (res && res.status === 200 && e.request.url.startsWith(self.location.origin)) {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
      }
      return res;
    }).catch(() => caches.match('./dashboard.html')))
  );
});
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : { title: 'بيان المزرعة', body: 'لديك إشعار جديد' };
  e.waitUntil(
    self.registration.showNotification(data.title || 'بيان المزرعة', {
      body: data.body || '',
      icon: './favicon.ico',
      dir: 'rtl', lang: 'ar',
      vibrate: [200, 100, 200],
      data: { url: data.url || './dashboard.html' }
    })
  );
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(cs => {
      const c = cs.find(x => x.focused);
      if (c) c.focus();
      else clients.openWindow(e.notification.data?.url || './dashboard.html');
    })
  );
});
