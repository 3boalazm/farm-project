# Sprint 2 — Task 2.4.4: Pre-Activation Production Review (Investigation Only)
**Status: No deployment, no rollout enabled, no code modified (registration code, sw.js, or cache versions).**

**Important framing for this review:** as of Task 2.4.3, a real `navigator.serviceWorker.register('/sw.js')` call now exists in the codebase (in `sw-register.js`, invoked from `shared.js` and 2 direct includes) — this is the first point in this entire Sprint 2 investigation chain where registration code actually exists locally. It has not been deployed. This review treats "first activation" as "what would happen the moment this code reaches production," not as something already live.

---

## PHASE 1 — First Activation Simulation

**Step-by-step, based on the actual code as it exists today:**

1. User visits any of the 28 covered pages → `shared.js`'s `window.load` listener fires (or the direct include on `login.html`/`settings.html`) → `registerServiceWorker()` runs.
2. Guards pass (assuming a supporting browser + secure context — both true for the Vercel HTTPS deployment and the Capacitor WebView's `androidScheme: "https"`) → `navigator.serviceWorker.register('/sw.js')` is called.
3. Browser fetches `/sw.js` → **install** event fires in the new worker → `self.skipWaiting()` runs immediately → the browser opens `CACHE_STATIC` and attempts `cache.add()` for all 34 `APP_SHELL` entries via `Promise.allSettled` (each individually wrapped in `.catch(()=>{})`) → install completes regardless of any individual failed entry.
4. **activate** event fires → deletes any cache name not in `[CACHE_STATIC, CACHE_PAGES, CACHE_DATA]` (on a genuine first install, there are no pre-existing caches under any name, so this is a no-op) → `self.clients.claim()` runs.
5. **Corrected finding from this review, refining Task 2.4/2.3.2's earlier characterization:** because `clients.claim()` is called, the service worker begins controlling **the very page that triggered registration**, immediately, for that page's *subsequent* requests (e.g. its next `fetch()`/XHR call to Firebase, its next navigation). The initial HTML/CSS/JS that already loaded via ordinary network requests before the SW existed is *not* retroactively intercepted — but anything that page requests *after* `activate` completes *is*, including within the same page view. This is a more immediate effect than "only future page loads," and is worth stating precisely rather than the looser description given in earlier tasks.

**Possible failures identified in this simulation:**
- **Network failure fetching `/sw.js` itself** → the `register()` promise rejects → caught by `sw-register.js`'s `.catch()` → `console.warn` only, page continues completely normally, unregistered. Low severity, graceful.
- **Content-Type header for `/sw.js`** — browsers require the file be served with a JavaScript-compatible MIME type for registration to succeed at all. This cannot be verified from within this sandboxed review (it depends on Vercel's live static-file-serving configuration, not on anything in this codebase) — **flagged as an unverified, environment-dependent assumption that should be confirmed against the actual production deployment before relying on this working**, not something this code review can settle on its own.
- **Some `APP_SHELL` entries failing to precache** — already handled gracefully by the existing `Promise.allSettled` pattern; confirmed in Task 2.3.2 that all 34 entries currently exist on disk, so this is a low-probability failure mode assuming the production deployment matches the local file tree exactly.
- **Very old Android WebView versions** (pre-dating Service Worker API support) — handled gracefully by `sw-register.js`'s own `'serviceWorker' in navigator` guard; the app continues functioning exactly as it does today (unregistered) on such devices.

---

## PHASE 2 — Update Lifecycle Review

- **New `sw.js` deployment without a cache-version bump:** the browser's standard update-check mechanism will still re-fetch and byte-compare `/sw.js` periodically; if the file content changed but the `CACHE_STATIC`/`CACHE_PAGES`/`CACHE_DATA` version-suffixed names did **not** change, the new `install`/`activate` logic takes effect, but previously-cached individual assets under the *same* cache names are not wholesale invalidated — they continue being refreshed only opportunistically via the existing Stale-While-Revalidate pattern on each individual request, not all at once. **Operational rule worth stating plainly for whoever manages future `sw.js` changes:** any change to caching *behavior* should be paired with a version-string bump to guarantee a clean, complete cache reset; changes to logic *outside* the caching strategy (e.g., adjusting the `message` handler) do not strictly require one, but bumping on every change is the simpler, safer default.
- **Old worker behavior:** with `skipWaiting`+`clients.claim` unchanged (confirmed, per this task's constraints), an old worker is superseded promptly on every future deploy — this project's design does not have a "old worker lingers for open tabs" failure mode by construction.
- **Stale tabs:** a tab left open across a deploy can experience a brief window where its already-executing JavaScript is old while its next network request is served under new caching rules — an accepted, known tradeoff of this lifecycle pattern (already flagged in Task 2.4), not new information from this review.
- **Update conflicts:** none identified — a single service worker per origin, standard browser-managed activation sequencing, no custom multi-worker coordination logic exists that could conflict with itself.

---

## PHASE 3 — Rollback Readiness

- **Can users recover?** Partially. If a future `sw.js` version is shipped correcting a problem, `skipWaiting`+`clients.claim` mean it takes effect promptly for all users without requiring them to manually clear anything — this is a genuine strength of the current design.
- **Is unregister possible?** Technically yes via the standard `navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()))` browser API, or manually via browser DevTools — **but confirmed in this review: no such call exists anywhere in the codebase today.** If a full unregistration were ever needed (not just an updated version), there is currently no built-in, deployable code path to trigger it; it would need to be written first, or performed manually per-device via DevTools, which does not scale to real users.
- **Can caches be cleared?** Only `CACHE_DATA` (Firebase GET response cache) is clearable on demand, via the `CLEAR_DATA_CACHE` message. `CACHE_STATIC`/`CACHE_PAGES` have no on-demand clearing mechanism — they are only replaced as a side effect of a full version-bumped `activate` cycle.
- **Is `CLEAR_DATA_CACHE` actually usable?** The underlying `sw.js` message handler is proven and unchanged. The page-side caller (`requestClearDataCache()`, added in Task 2.4.3) **exists as a callable function but has no UI trigger** — confirmed again in this review: zero references to `requestClearDataCache` in any HTML file. It is currently only invokable manually via a browser console, not by any real user or admin through the app's interface.
- **Missing rollback steps, identified concretely:**
  1. No page-side unregister capability exists at all — a genuine gap if a full rollback (not just a version update) is ever needed.
  2. No on-demand way to clear `CACHE_STATIC`/`CACHE_PAGES` outside a full version-bump cycle.
  3. `requestClearDataCache()` has no UI — it exists in code but is not usable by an actual admin today.

---

## PHASE 4 — Real Device Matrix

| Platform | First install | Offline | Update |
|---|---|---|---|
| **Desktop Chrome** | Verify via DevTools → Application → Service Workers that registration/activation succeeds; verify all 3 named caches populate per `APP_SHELL` | Verify previously-visited and precached pages load with network disabled; verify a genuinely uncached, never-visited page falls back to `/offline.html` rather than Chrome's native error | Verify a version-bumped redeploy activates promptly and the `activate` handler's cleanup removes only the superseded cache names |
| **Mobile Browser (Chrome for Android, at minimum)** | Same checks as desktop, plus confirm behavior is unaffected by backgrounding/resuming the tab | Same as desktop | Same as desktop |
| **Android WebView / Capacitor (the actual built APK)** | Verify via remote debugging (`chrome://inspect` against the device) that registration succeeds specifically inside the WebView, not just in a mobile browser tab — this is the one environment not yet directly exercised anywhere in this Sprint's work; confirm `farm-apk/www/sw.js` (byte-identical to root since Task 2.3.1) behaves identically once actually registered on-device | Verify offline navigation and the `/offline.html` fallback work identically inside the WebView shell | Verify that updating the APK's bundled `www/` content (per the sync-tool workflow established earlier this Sprint) and rebuilding correctly triggers a fresh `install`/`activate` cycle on next app launch |

**None of these tests have been executed as part of this review** — this is the test matrix to run before considering activation complete, not a report of results.

---

## PHASE 5 — Activation Decision

**1. Ready / Not ready: Not fully ready for an unconditional, full-rollout activation (Option A from Task 2.4).** The core registration and caching infrastructure is sound and low-risk on its own — but this review surfaced concrete, unresolved gaps in the *recovery* story specifically (no unregister path, no UI for the one recovery tool that does exist) that should be closed, or at minimum consciously accepted, before exposing this to all real users at once.

**2. Remaining blockers:**
   - No page-side service-worker **unregister** capability exists — a real gap if a full rollback beyond "ship a corrected version" is ever needed.
   - `requestClearDataCache()` has no UI — the one built recovery tool is currently unusable by an actual admin.
   - The `/sw.js` Content-Type / static-serving behavior on the live Vercel deployment has not been verified in this review (environment-dependent, outside this codebase).
   - The Android WebView environment specifically has not been directly tested anywhere in this Sprint's work — every finding so far is based on code review and confirmed cross-platform file parity (Task 2.3.5), not on-device verification.

**3. Recommended rollout strategy:** **Option B from Task 2.4 (controlled/staged activation)** remains the better fit given these findings — specifically, consider limiting initial activation to a small, monitored subset (e.g., the development team's own devices/sessions) specifically to exercise the Phase 4 device matrix in practice before any broader rollout, rather than proceeding straight to Option A.

**4. Exact deployment steps (if and when approved — not performed here):**
   1. Verify `/sw.js`'s Content-Type header on the actual Vercel deployment (a live, environment-specific check, not a code change).
   2. Deploy the current `sw-register.js`/`shared.js`/28-page changes to a preview/staging environment first.
   3. Manually execute the Phase 4 device matrix (Chrome desktop, mobile browser, and — critically — the actual built APK via remote debugging) against that staging deployment.
   4. Only after the matrix passes, promote to production, ideally to a limited/staged audience per Option B rather than all users simultaneously.
   5. Monitor for the first deploy cycle specifically watching for the "old worker superseded, brief version-mismatch window" behavior described in Phase 2.

**5. Rollback procedure (as it stands today, gaps included):**
   - **If a bad `sw.js` version is ever shipped:** ship a new, corrected version with a bumped cache-version string — `skipWaiting`+`clients.claim` ensure it takes effect promptly for all already-registered clients, which is a genuine strength.
   - **If a full unregistration is ever needed:** **not currently possible through any built app code** — would require writing and shipping new unregister-capable code first, or manually walking affected users through browser DevTools, which does not scale. This is the single most important gap this review surfaces.
   - **If only stale Firebase data needs clearing for a specific user:** currently only possible via manually invoking `requestClearDataCache()` in a browser console — not through any UI a real admin could use today.

**Waiting for approval. No deployment, no activation, no code changes were made in this review.**
