# Sprint 2 — Task 2.3.2: Service Worker Activation Readiness Audit (Investigation Only)
**Status: No registration code, no sw.js edits, no cache-version changes, no manifest/config changes.**

---

## PHASE 1 — Registration Readiness

| Question | Finding |
|---|---|
| **Current registration points** | **None.** Re-confirmed by exhaustive `serviceWorker` string search across every `.html`/`.js` file, root and www. (`farm-react.js` contains the string `postMessage`, but this is unrelated internal library plumbing — not an integration with `sw.js`'s message channel.) |
| **Recommended registration location** | `shared.js` — already loaded by effectively every page in the project (established throughout this Sprint's architecture audits), so a single registration call there would cover the app universally without per-page duplication. This is an observation, not a proposal to implement. |
| **Browser compatibility** | The Cache API and Service Worker API used by `sw.js` are supported in all evergreen browsers (Chrome, Firefox, Safari, Edge) for the web deployment. |
| **Capacitor/WebView behavior** | Android's Capacitor WebView is backed by the system WebView component (Chromium-based on modern Android), which supports the Service Worker and Cache APIs from Android 5.0+ (WebView versions bundled with any currently-supported Android release). No compatibility blocker identified for the APK context specifically. |
| **Current state** | Fully-written, fully-synced (`sw.js` now identical root/www per Task 2.3.1), zero-registration, zero real-world execution on any device. |
| **Expected state (if activated)** | `sw.js` installed and controlling all matching fetches on both platforms, per the lifecycle already coded (install → precache → activate → clean old caches → intercept fetches → optional message-driven cache clearing). |

---

## PHASE 2 — Cache Safety Audit

| Aspect | Finding |
|---|---|
| **Cache version strategy** | Version suffix embedded directly in each cache name (`farm-static-v5`, `farm-pages-v5`, `farm-data-v5`) — a standard, sound pattern: bumping the suffix on a future change automatically orphans the old-named caches for cleanup. |
| **Old cache cleanup** | Handled in `activate`: `caches.keys()` → delete any cache name not in the current version's `keep` list → `clients.claim()`. This is correctly implemented and would run the very first time any version of this SW is ever activated (including this hypothetical first activation) — meaning any stray caches from, e.g., ad-hoc developer testing in a browser devtools session would be cleaned up automatically on first real activation, not left behind. |
| **Activation lifecycle** | `self.skipWaiting()` is called unconditionally in `install`, and `clients.claim()` in `activate` — this is the "take over immediately" pattern rather than the more conservative "wait for all tabs to close" default. This means: the very first time this SW is registered, it will begin controlling requests **immediately**, without requiring a page refresh first. |
| **Install failure handling** | `Promise.allSettled(...)` per `APP_SHELL` URL, each wrapped in its own `.catch(()=>{})` — a single failed precache entry does not fail the whole install. This is a safe, resilient design already confirmed in Task 2.3. |
| **Update behavior (Stale-While-Revalidate for HTML/JS/CSS)** | Serves cached content immediately if present, updates the cache in the background for the *next* load. This means: after any future deploy, the very first page load post-deploy for a given user may show the previous version's content once, before the background update catches the cache up. This is a known, accepted tradeoff of this strategy — not a defect, but worth stating plainly since it will be a new experience for real users the first time it happens. |

**Can users get stuck?**
Not on old *content*, in the way "stuck" usually implies for a broken update mechanism — the version-string cache-busting and `skipWaiting`/`clients.claim()` combination means each new deploy (with a bumped version string) will replace the old caches and take over immediately, not linger indefinitely. The one legitimate "stuck for one load" moment is the Stale-While-Revalidate tradeoff described above — a single-load staleness, not a persistent one.

**Can rollback happen? How?**
Yes, but not via a simple file revert once live — as already established in Task 2.2.3/2.3, rolling back a *registered* service worker requires shipping a **new** SW version (a further version-string bump) that either reverts the caching logic or explicitly clears caches via the existing `CLEAR_DATA_CACHE` message handler. Reverting the `sw.js` file in git alone does not un-register an already-installed worker on a user's device — the new (reverted) file still needs to be served and re-activated through the same install/activate lifecycle to actually take effect.

---

## PHASE 3 — APP_SHELL Validation

- **Every file in the current `APP_SHELL` list exists, in both root and `farm-apk/www`** — verified directly in this pass (22 entries: `index.html`, `dashboard.html`, `login.html`, 12 more HTML pages, `styles.css`, `config.js`, `firebase.js`, `nav.js`, `shared.js`, `offline-sync.js`, `manifest.json`). **Zero missing files.**
- **Every route referenced resolves to a real page** — no dangling references to removed/renamed files (consistent with every prior audit in this chain).
- **Every static dependency exists** — the one previously-open gap (`offline-sync.js` missing from www) was closed in Task 2.2.4/2.2.7 and re-confirmed present and identical in Task 2.3.1.
- **Missing critical pages from precache (non-blocking, but real):** 16 HTML pages are not in `APP_SHELL` and would only be cached opportunistically on first online visit rather than being available offline immediately after install — this list is unchanged from the original Task 2.2 audit: `activity.html`, `animal-detail.html`, `assistant.html`, `barns.html`, `bayan.html`, `bayan-offline.html`, `cost.html`, `dead.html`, `diary.html`, `farm-profile.html`, `fix-births.html`, `goats.html`, `import.html`, `pedigree.html`, `sheep.html`, `users.html`. Whether `bayan.html`/`bayan-offline.html` *should* be added is a genuine open question given their self-contained, print-oriented nature (they don't even load `styles.css`, per earlier findings) — they may not benefit from this caching layer the same way the rest of the app does.

---

## PHASE 4 — Offline Experience

| Concern | Current behavior if activated |
|---|---|
| **Offline fallback (uncached page, no network)** | **Missing in both `sw.js` versions**, confirmed again in this pass — no dedicated `offline.html` exists anywhere in the project (a search for "offline" only turns up `bayan-offline.html`, an unrelated printable statement page, and `offline-sync.js`, the write-queue module — neither is a fetch-fallback page). A user offline, on a page never previously cached and not in `APP_SHELL`, would see the browser's native "no internet" error rather than an app-branded message. |
| **Navigation requests (HTML)** | Stale-While-Revalidate — works offline for any previously-visited or precached page; fails to the browser's native error only for genuinely never-seen, non-precached pages while offline. |
| **Firebase offline behavior** | Network-First with cached-data fallback, including a synthetic `X-Farm-Cache: offline` response header so the app can detect stale data, and an empty-array `[]` fallback if nothing was ever cached for that specific request — this is a well-designed, already-complete answer to "what happens to data reads when offline." |
| **API/serverless requests (`/api/claude`, and the misplaced `chat.js` if it were ever moved to `/api/`)** | `sw.js`'s fetch handler has no explicit branch for `/api/` paths — such requests fall through every specific rule (not a Firebase domain, not a CDN domain, not `.html`, not `.js`/`.css`) and receive **no `e.respondWith()` at all**, meaning the browser's default network-only behavior applies. This is actually the *correct* passive behavior for a request that can never be meaningfully cached (a live AI completion call) — offline, it will simply fail naturally, exactly as it does today with no service worker at all. No change in risk profile here from activation. |
| **CDN assets (fonts, Bootstrap, Bootstrap Icons)** | Cache-First — works fully offline once cached once, appropriate for versioned/immutable CDN URLs. |
| **Local JS/CSS assets** | Stale-While-Revalidate — same offline behavior as HTML pages. |

---

## PHASE 5 — Activation Options

### Option A — Enable registration now
- **Benefits:** Immediately delivers the offline-first experience this project's own APK release-notes template already advertises ("📱 يعمل Offline مع مزامنة تلقائية") but which, per every audit in this Sprint, has never actually been true until registration happens.
- **Risks:** The `skipWaiting`/`clients.claim()` immediate-takeover pattern means the very first activation happens without a page-refresh grace period — combined with Stale-While-Revalidate, some users may see one moment of "was this always like this?" content staleness on their very next navigation after the SW first installs. No offline-fallback page exists yet, so a genuinely offline, never-visited, non-precached page still shows a raw browser error rather than a branded message. 16 pages remain outside the initial precache list, meaning first-run-offline access to those specific pages before ever visiting them online would fail (falls back to the missing-fallback-page situation above).
- **Migration effort:** None — the code is already written and already synced to both platforms; "enabling" is purely a matter of adding the registration call.
- **Rollback strategy:** Not a simple revert (per Phase 2) — requires a follow-up SW version that clears/reverts, shipped through the same lifecycle.

### Option B — Fix readiness gaps first, then enable
- **Benefits:** Closes the two concrete, non-blocking-but-real gaps identified in Phases 3–4 (missing offline-fallback page; 16 pages absent from `APP_SHELL`) before any real user ever depends on this feature — meaning the *first* real-world activation is already the more complete, considered version rather than a "v1 with known gaps."
- **Risks:** Continues the delay already in place since this capability was apparently built. No new risk introduced by waiting.
- **Migration effort:** Two additive, low-complexity changes (an `offline.html` file plus one new fetch-handler branch to serve it as a fallback; expanding the `APP_SHELL` array) — small in scope, though implementing them is explicitly outside this investigation-only task.
- **Rollback strategy:** N/A until activation actually happens — these are pre-activation improvements, not live changes with users depending on them yet.

### Option C — Keep disabled until more PWA work is done
- **Benefits:** No risk of any kind — the current, long-standing status quo (fully-built but inert code) continues.
- **Risks:** The offline capability continues to not exist for any real user, indefinitely, with no defined endpoint for when it will.
- **Migration effort:** None (nothing changes).
- **Rollback strategy:** N/A — nothing was activated to roll back.

---

## Output Summary

**1. Readiness score: ~70/100.** The hard blockers that existed earlier in this investigation chain (missing `offline-sync.js` dependency, unsynced `sw.js` versions) are now fully resolved. What remains are two known, well-understood, non-blocking gaps (offline-fallback page; partial `APP_SHELL` coverage) rather than any unknown or structurally unsound issue.

**2. Blocking issues: None currently open.** Every previously-identified hard blocker (dependency closure, version mismatch) has been resolved by this Sprint's earlier tasks.

**3. Non-blocking issues:**
   - No dedicated offline-fallback page for genuinely uncached, offline, never-visited routes.
   - 16 of 31 HTML pages absent from `APP_SHELL` (first-run-offline access to those specific pages would fail before any online visit ever occurs).
   - No page-side integration with the `SKIP_WAITING`/`CLEAR_DATA_CACHE` message channel — the capability exists in `sw.js` but nothing currently calls it, meaning the operator has no in-app "force refresh" affordance yet if one is ever wanted.
   - `manifest.json` still not linked via `<link rel="manifest">` on any page — unrelated to the fetch/cache behavior itself, but relevant to the broader "PWA-ness" of the app (installability prompts).

**4. Recommended option: Option B (fix the two known gaps first), then Option A.** Given the hard blockers are already cleared and the remaining gaps are small, well-scoped, and additive (not requiring any redesign of the already-solid caching strategy), closing them before the very first real activation is the more conservative and complete path — but this is a recommendation for future work, not a claim that Option A is unsafe in an absolute sense.

**5. Required changes (if Option B is pursued, not performed in this task):** an `offline.html` fallback page plus one new fetch-handler branch to serve it; an expanded `APP_SHELL` array covering the 16 currently-absent pages (or an explicit, documented decision to exclude specific ones, e.g. `bayan*.html`, consistent with their already-established self-contained nature).

**6. Risk level:** **Low-Medium for Option A as-is** (no structural blocker remains, but two known UX rough edges would ship on day one). **Low for Option B's preparatory work** (additive, no live users affected until activation). **None for Option C** (status quo).

**7. Waiting for approval. No registration code was written. No sw.js changes were made. No activation occurred.**
