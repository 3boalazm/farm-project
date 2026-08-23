'use strict';
// ══════════════════════════════════════════════════════════════
//  OFFLINE SYNC ENGINE — بيان المزرعة
//  يخزن العمليات في IndexedDB لما تكون offline
//  ويرسلها تلقائياً لما يرجع الاتصال
// ══════════════════════════════════════════════════════════════

var FarmOfflineSync = (function() {

  var DB_NAME    = 'farm-offline-queue';
  var DB_VERSION = 1;
  var STORE_NAME = 'pending-ops';
  var _db        = null;
  var _syncing   = false;
  var _listeners = [];

  // ── Open IndexedDB ─────────────────────────────────────────
  function openDB() {
    if (_db) return Promise.resolve(_db);
    return new Promise(function(resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function(e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          var store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
          store.createIndex('timestamp', 'timestamp');
          store.createIndex('collection', 'collection');
        }
      };
      req.onsuccess = function(e) { _db = e.target.result; resolve(_db); };
      req.onerror   = function(e) { reject(e.target.error); };
    });
  }

  // ── Queue a write operation ─────────────────────────────────
  function enqueue(method, collection, docId, data) {
    return openDB().then(function(db) {
      return new Promise(function(resolve, reject) {
        var op = {
          method:     method,        // POST | PATCH | PUT | DELETE
          collection: collection,
          docId:      docId || null,
          data:       data || null,
          timestamp:  Date.now(),
          retries:    0,
        };
        var tx    = db.transaction(STORE_NAME, 'readwrite');
        var store = tx.objectStore(STORE_NAME);
        var req   = store.add(op);
        req.onsuccess = function() {
          console.log('[OfflineSync] Queued:', method, collection);
          notifyListeners();
          resolve(req.result);
        };
        req.onerror = function() { reject(req.error); };
      });
    });
  }

  // ── Get all pending ops ─────────────────────────────────────
  function getPending() {
    return openDB().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx    = db.transaction(STORE_NAME, 'readonly');
        var store = tx.objectStore(STORE_NAME);
        var index = store.index('timestamp');
        var req   = index.getAll();
        req.onsuccess = function() { resolve(req.result || []); };
        req.onerror   = function() { reject(req.error); };
      });
    });
  }

  // ── Count pending ───────────────────────────────────────────
  function countPending() {
    return openDB().then(function(db) {
      return new Promise(function(resolve) {
        var tx  = db.transaction(STORE_NAME, 'readonly');
        var req = tx.objectStore(STORE_NAME).count();
        req.onsuccess = function() { resolve(req.result); };
        req.onerror   = function() { resolve(0); };
      });
    });
  }

  // ── Delete one op after success ─────────────────────────────
  function dequeue(id) {
    return openDB().then(function(db) {
      return new Promise(function(resolve) {
        var tx  = db.transaction(STORE_NAME, 'readwrite');
        var req = tx.objectStore(STORE_NAME).delete(id);
        req.onsuccess = function() { resolve(); };
        req.onerror   = function() { resolve(); };
      });
    });
  }

  // ── Execute one op against Firebase ────────────────────────
  // BUG FIX: this used to look for a global getAuthToken() function that
  // is never defined anywhere in the codebase (typeof check always false),
  // and even if it existed, attached the result as an Authorization:
  // Bearer header -- but this app's real Firebase REST auth (fbUrl() in
  // firebase.js) is the legacy `?auth=<token>` query-string style, not a
  // header. Net effect: every replayed op went out with no valid auth at
  // all against rules that require auth != null on almost every
  // collection -- guaranteed 401, silently retried 5 times, then dropped
  // forever with no user-facing notice. Confirmed live: a queued op
  // synced 0/1, 401'd, and never reached Firebase. Now reuses
  // _getValidAuthToken() (firebase.js, globally available since it's
  // loaded before this script), the same token every other real request
  // in the app already uses, attached the same way.
  function executeOp(op) {
    // Second bug fixed alongside the auth one above: FB_URL is declared
    // `let` in firebase.js, so it never attaches to `window` -- reading
    // window.FB_URL was always undefined, meaning this function rejected
    // with "Firebase URL not configured" before ever reaching the fetch,
    // regardless of the auth issue. `let`/`const` top-level bindings ARE
    // shared across separate <script> tags in the same document (unlike
    // modules), so referencing the bare FB_URL here resolves correctly
    // since firebase.js loads before this script on every page.
    var baseUrl = (typeof FB_URL !== 'undefined' ? FB_URL : '').replace(/\/$/, '');
    if (!baseUrl) return Promise.reject(new Error('Firebase URL not configured'));

    return Promise.resolve(typeof _getValidAuthToken === 'function' ? _getValidAuthToken() : null)
      .then(function(token) {
        var qs = token ? '?auth=' + token : '';
        var url  = baseUrl + '/' + op.collection;
        var method = op.method;
        var body;

        if (method === 'POST') {
          url += '.json' + qs;
          body = JSON.stringify(Object.assign({}, op.data, { synced_at: new Date().toISOString() }));
        } else if (method === 'PATCH' || method === 'PUT') {
          url += '/' + op.docId + '.json' + qs;
          body = JSON.stringify(Object.assign({}, op.data, { synced_at: new Date().toISOString() }));
        } else if (method === 'DELETE') {
          url += '/' + op.docId + '.json' + qs;
          body = null;
        }

        return fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: body });
      })
      .then(function(res) {
        if (!res.ok) throw new Error(method_label(op) + ': ' + res.status);
        return res;
      });
  }
  function method_label(op) { return op.method + ' ' + op.collection; }

  // ── Sync all pending ops ────────────────────────────────────
  function syncNow() {
    if (_syncing || !navigator.onLine) return Promise.resolve(0);
    _syncing = true;

    return getPending().then(function(ops) {
      if (!ops.length) { _syncing = false; return 0; }

      console.log('[OfflineSync] Syncing', ops.length, 'pending operations...');
      notifyListeners('syncing', ops.length);

      var synced = 0;
      var failed = 0;

      // Execute ops sequentially to preserve order
      return ops.reduce(function(chain, op) {
        return chain.then(function() {
          return executeOp(op)
            .then(function() {
              return dequeue(op.id).then(function() { synced++; });
            })
            .catch(function(err) {
              console.warn('[OfflineSync] Op failed:', err.message, '— will retry');
              failed++;
              // Increment retry counter
              return openDB().then(function(db) {
                return new Promise(function(resolve) {
                  var tx  = db.transaction(STORE_NAME, 'readwrite');
                  var req = tx.objectStore(STORE_NAME).get(op.id);
                  req.onsuccess = function() {
                    if (req.result) {
                      req.result.retries = (req.result.retries || 0) + 1;
                      // Remove after 5 failed retries
                      if (req.result.retries >= 5) {
                        tx.objectStore(STORE_NAME).delete(op.id);
                        console.error('[OfflineSync] Dropped op after 5 retries:', op);
                      } else {
                        tx.objectStore(STORE_NAME).put(req.result);
                      }
                    }
                    resolve();
                  };
                  req.onerror = function() { resolve(); };
                });
              });
            });
        });
      }, Promise.resolve())
      .then(function() {
        _syncing = false;
        notifyListeners('done', { synced: synced, failed: failed });
        if (synced > 0) {
          console.log('[OfflineSync] ✅ Synced:', synced, 'ops. Failed:', failed);
          // Reload page data after sync
          if (window.toast) toast('✅ تم مزامنة ' + synced + ' عملية محفوظة offline');
          // Invalidate all Firebase caches
          if (window.fbCacheInvalidate) {
            ['animals','health','breeding','finance','production_log','daily_tasks'].forEach(function(c) {
              fbCacheInvalidate(c);
            });
          }
        }
        return synced;
      });
    }).catch(function(err) {
      _syncing = false;
      console.error('[OfflineSync] Sync error:', err);
      return 0;
    });
  }

  // ── Listeners ───────────────────────────────────────────────
  function notifyListeners(event, data) {
    _listeners.forEach(function(fn) {
      try { fn(event, data); } catch(e) {}
    });
    updateBadge();
  }

  function onSync(fn) { _listeners.push(fn); }

  // ── UI Badge ────────────────────────────────────────────────
  function updateBadge() {
    countPending().then(function(count) {
      var badge = document.getElementById('offline-sync-badge');
      if (!badge) {
        badge = document.createElement('div');
        badge.id = 'offline-sync-badge';
        badge.style.cssText = [
          'position:fixed', 'bottom:16px', 'right:16px', 'z-index:8999',
          'background:var(--orange,#ff6b35)', 'color:#fff',
          'border-radius:20px', 'padding:6px 14px',
          'font-family:Cairo,sans-serif', 'font-size:.78rem', 'font-weight:700',
          'box-shadow:0 4px 12px rgba(255,107,53,.4)',
          'display:none', 'align-items:center', 'gap:6px',
          'cursor:pointer', 'transition:.2s',
        ].join(';');
        badge.onclick = function() { syncNow(); };
        document.body.appendChild(badge);
      }

      if (count > 0) {
        badge.style.display = 'flex';
        badge.innerHTML = '<i class="bi bi-arrow-repeat"></i> ' + count + ' عملية في الانتظار (offline)';
      } else {
        badge.style.display = 'none';
      }
    });
  }

  // ── Auto-sync on reconnect ───────────────────────────────────
  window.addEventListener('online', function() {
    console.log('[OfflineSync] Back online — syncing...');
    setTimeout(syncNow, 1500);  // small delay to let connection stabilize
  });

  // ── Periodic check (every 30s when online) ───────────────────
  setInterval(function() {
    if (navigator.onLine) syncNow();
  }, 30000);

  // ── Init ────────────────────────────────────────────────────
  openDB().then(function() {
    console.log('[OfflineSync] IndexedDB ready');
    updateBadge();
    if (navigator.onLine) syncNow();
  }).catch(function(e) {
    console.warn('[OfflineSync] IndexedDB not available:', e.message);
  });

  // ── Public API ──────────────────────────────────────────────
  return {
    enqueue:      enqueue,
    getPending:   getPending,
    countPending: countPending,
    syncNow:      syncNow,
    onSync:       onSync,
    updateBadge:  updateBadge,
  };

})();
