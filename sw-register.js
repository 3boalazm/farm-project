'use strict';
// ══════════════════════════════════════════════════════════════
//  sw-register.js — Service Worker registration + recovery tools
//  بيان المزرعة
//
//  This file was missing entirely before this pass — sw.js existed
//  with a complete, correct caching strategy, but nothing anywhere in
//  the project ever called navigator.serviceWorker.register(), so the
//  whole offline/PWA capability was inert in production. This file
//  both registers it and provides two admin-facing recovery tools
//  (settings.html) for when caching causes more harm than good:
//  clearing the cached-data layer, and a full emergency unregister +
//  cache wipe for when the app gets stuck.
// ══════════════════════════════════════════════════════════════

// ── Registration ──────────────────────────────────────────────
// Feature-detected and deferred to 'load' so it never delays first
// paint. Safe to include on every page.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function (err) {
      console.error('SW registration failed:', err);
    });
  });
}

// ── requestClearDataCache(timeoutMs) ────────────────────────────
// Asks the active service worker to clear just the Firebase-data
// cache (CACHE_DATA in sw.js). Has a configurable timeout so a
// service worker that never replies (e.g. stuck mid-update, or no
// controller at all) can never hang the caller forever — it resolves
// false instead of hanging.
//
// IMPLEMENTATION NOTE (found via live testing before shipping this):
// sw.js's existing message handler replies via e.source.postMessage(),
// which delivers to the GLOBAL navigator.serviceWorker 'message'
// event — not to a MessageChannel port, even if one is transferred
// alongside the request. An earlier version of this function used a
// MessageChannel expecting a reply through its own port and never
// received one (verified: real timeout, not a flaky test). Rewritten
// to listen on the same global message event sw.js actually replies
// through, matching its real behavior rather than assuming a
// different (equally valid, but not what's implemented) pattern.
//
// Returns a Promise<boolean>: true if the SW confirmed the cache was
// cleared, false if it timed out, there's no active SW, or the
// browser doesn't support service workers at all.
function requestClearDataCache(timeoutMs) {
  timeoutMs = typeof timeoutMs === 'number' ? timeoutMs : 5000;

  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
    // No supported/active service worker to ask — nothing to clear
    // via messaging, but we can still try clearing Cache Storage
    // directly as a fallback so this call is still useful.
    return _clearDataCacheDirectly();
  }

  return new Promise(function (resolve) {
    var settled = false;

    function cleanup(result) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      navigator.serviceWorker.removeEventListener('message', onMessage);
      resolve(result);
    }

    function onMessage(event) {
      if (event.data && event.data.type === 'DATA_CACHE_CLEARED') cleanup(true);
    }

    var timer = setTimeout(function () { cleanup(false); }, timeoutMs);

    try {
      navigator.serviceWorker.addEventListener('message', onMessage);
      navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_DATA_CACHE' });
    } catch (e) {
      cleanup(false);
    }
  });
}

// Fallback used when there's no controlling service worker to message
// at all (e.g. first load before the SW has taken control yet). Not
// as targeted as the SW's own CLEAR_DATA_CACHE handler (which only
// clears the data cache), but still useful and always available.
async function _clearDataCacheDirectly() {
  if (!('caches' in window)) return false;
  try {
    var deleted = await caches.delete('farm-data-v5');
    return deleted;
  } catch (e) {
    return false;
  }
}

// ── unregisterServiceWorker() ───────────────────────────────────
// The "nuclear option" for when the app is stuck and messaging the
// service worker isn't working (or you don't trust it to). Does NOT
// depend on the SW message channel at all — unregisters every service
// worker registration directly via the Service Worker API, and
// separately clears every Cache Storage bucket directly via the
// Cache API, independent of whether the SW itself is responsive.
// Gracefully does nothing (resolves normally) in browsers that don't
// support one or both APIs, rather than throwing.
//
// Returns a Promise that resolves once both steps have been attempted
// (each step is independently best-effort — a failure in one doesn't
// stop the other from running).
async function unregisterServiceWorker() {
  var results = { unregistered: 0, cachesCleared: 0, errors: [] };

  if ('serviceWorker' in navigator) {
    try {
      var registrations = await navigator.serviceWorker.getRegistrations();
      for (var i = 0; i < registrations.length; i++) {
        try {
          var ok = await registrations[i].unregister();
          if (ok) results.unregistered++;
        } catch (e) {
          results.errors.push('unregister: ' + e.message);
        }
      }
    } catch (e) {
      results.errors.push('getRegistrations: ' + e.message);
    }
  }

  if ('caches' in window) {
    try {
      var keys = await caches.keys();
      for (var j = 0; j < keys.length; j++) {
        try {
          var deleted = await caches.delete(keys[j]);
          if (deleted) results.cachesCleared++;
        } catch (e) {
          results.errors.push('cache delete (' + keys[j] + '): ' + e.message);
        }
      }
    } catch (e) {
      results.errors.push('caches.keys: ' + e.message);
    }
  }

  if (results.errors.length && results.unregistered === 0 && results.cachesCleared === 0) {
    throw new Error(results.errors.join('; '));
  }

  return results;
}
