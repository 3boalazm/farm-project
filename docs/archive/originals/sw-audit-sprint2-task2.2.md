# Sprint 2 — Task 2.2: Service Worker Audit (Investigation Only)
**Status: No files modified. No cache versions changed. No SW logic touched.**

---

## PHASE 1 — Service Worker Discovery

| Item | Root | `farm-apk/www/` |
|---|---|---|
| `sw.js` | Present, 161 lines, header comment says **"v5"** | Present, but a **different file**, 108 lines, header comment says nothing about version but its cache constants say **"v4"** |
| `service-worker.js` / Workbox files | Not found anywhere in the project | Not found |
| Registration script (`navigator.serviceWorker.register(...)`) | **Not found in any `.html` or `.js` file** | **Not found in any `.html` or `.js` file either** |
| `manifest.json` | Present at root, fully-formed (name, icons as inline SVG data-URIs, `start_url: "./dashboard.html"`, `display: "standalone"`) | Present, separate copy |
| `<link rel="manifest">` reference | **Not found in any of the 31 root HTML pages** | **Not found in any www HTML page either** |
| `offline-sync.js` (background-sync queue, referenced by root `sw.js`'s comments) | Present at root | Not part of this specific audit's scope, noted only because root `sw.js`'s `APP_SHELL` explicitly includes it |

**Execution flow / update lifecycle, as written in the code (whether or not it ever runs — see registration finding above):**
```
install  → skipWaiting() immediately + populate CACHE_STATIC with APP_SHELL (root v5)
              (www v4: same idea, but uses cache.addAll() instead of allSettled-wrapped
               cache.add() per-URL — a meaningful behavioral difference, see Phase 2)
activate → delete any cache NOT in the current version's keep-list, then clients.claim()
fetch    → route by URL pattern (Firebase GET / CDN / HTML / JS-CSS), see Phase 2 for
              the actual strategy per route
message  → root v5 only: listens for {type:'SKIP_WAITING'} and {type:'CLEAR_DATA_CACHE'}
              from the page — www v4 has no message listener at all
```
**Critical finding common to both versions: none of this code path ever executes in a browser today, because no page anywhere in the project calls `navigator.serviceWorker.register()`.** Everything below analyzes what the code *would* do if registered, since that's the only way to evaluate it meaningfully.

---

## PHASE 2 — Cache Strategy Audit

| Asset / Route | Current caching behavior (as coded) | Expected behavior | Status |
|---|---|---|---|
| Firebase REST GET (`*.firebasedatabase.app`) | **Root v5 only:** Network-First, falls back to cached response with an injected `X-Farm-Cache: offline` header, or an empty-array `[]` fallback if nothing cached. **www v4:** explicitly excluded from caching entirely (`if (url.includes('firebasedatabase.app'))... return` — always network, no offline fallback) | Network-First with offline fallback (root v5's behavior) — matches the project's documented offline-first goal | Root: **Correct**. www: **Outdated/Missing** — no offline Firebase data at all in that version |
| Firebase writes (non-GET) | Both versions: skipped, left to `offline-sync.js`'s IndexedDB queue | Correct — writes shouldn't be cached by the SW itself | **Correct** (both versions) |
| CDN assets (`cdn.jsdelivr.net`, `cdnjs.cloudflare.com`, fonts) | Both versions: Cache-First | Correct for immutable, versioned CDN URLs | **Correct** (both versions) |
| Local HTML pages | Both versions: Stale-While-Revalidate | Reasonable for an app that updates via redeploy, not app-store review | **Correct** in strategy, but see Route Coverage (Phase 3) for precache gaps |
| Local JS/CSS | Both versions: Stale-While-Revalidate. **www v4** additionally restricts this branch to `url.includes(self.location.origin)` — root v5 does not have this origin check | www's origin check is arguably *safer* (prevents accidentally SWR-caching a same-extension third-party JS/CSS file that isn't actually same-origin) | Root: **Risky** (minor) — lacks an origin guard www already has. www: **Correct** on this specific point, despite being the older/simpler file overall |
| `manifest.json` | Both versions: included in `APP_SHELL`, so precached | Matches intent | **Correct**, but moot — see Phase 1, nothing links to it, so the browser never requests it via a normal page load in the first place |
| Cache naming/versioning | Root: `farm-static-v5`, `farm-pages-v5`, `farm-data-v5` (three separate named caches). www: `farm-bayan-v4`, `farm-pages-v4` (two caches, no separate data cache) | A single, consistent versioning scheme across whichever file is actually deployed | **Conflicting** — two different versioning schemes exist in the same repository for the same purpose |
| Install robustness | Root: `Promise.allSettled(...).catch(()=>{})` per-URL — one failed precache URL does not fail the whole install. www: `cache.addAll(...)` — **a single failed URL fails the entire install**, though there's an outer `.catch(()=>{})` on the whole chain that swallows the failure silently | Root's per-URL resilience is the safer pattern | Root: **Correct**. www: **Risky** — a single missing/renamed asset in `APP_SHELL` silently aborts precaching for everything, with no visible error |

---

## PHASE 3 — Route Coverage Audit

| Route/asset | Handled? | Evidence |
|---|---|---|
| `/` and `/index.html` | Yes, in both versions' `APP_SHELL` | — |
| `activity.html` | **No, in either version's `APP_SHELL`** | Root `sw.js` was last edited (per its "v5" label) before `activity.html` had real content; www `sw.js` (v4) never included it either, even though `farm-apk/www/activity.html` has always had real content. **This means even the "working" Android version's service worker was never precaching its own activity page.** |
| All 31 existing HTML pages | **No — only 15 of 31 are listed in root's `APP_SHELL`.** Missing: `activity.html`, `animal-detail.html`, `assistant.html`, `barns.html`, `bayan.html`, `bayan-offline.html`, `cost.html`, `dead.html`, `diary.html`, `farm-profile.html`, `fix-births.html`, `goats.html`, `import.html`, `pedigree.html`, `sheep.html`, `users.html` | Precaching gap — but **not fatal**, because the HTML route handler (Stale-While-Revalidate, matches any `.html` URL) still works for *any* page on first online visit, populating `CACHE_PAGES` on the fly. The `APP_SHELL` list only affects what's available **immediately on install**, before the user has ever visited a given page. |
| JS files | Handled generically by the JS/CSS Stale-While-Revalidate rule for any same-origin `.js` request, regardless of `APP_SHELL` membership | **Correct** by pattern-match, not by an explicit list |
| CSS files (`styles.css`) | Same — generic pattern match, also explicitly listed in `APP_SHELL` | **Correct** |
| Firebase resources | See Phase 2 | Root: correct with fallback. www: network-only, no fallback |
| Images/icons | **Manifest icons are inline base64 SVG data-URIs** (not separate files) — nothing to cache or miss here | **N/A / Correct by construction** |
| `manifest.json` | Precached but never requested by the browser in normal operation, since no page links it | **Moot**, see Phase 1 |
| Offline fallback (a dedicated `offline.html` shown when nothing is cached and network fails) | **Not implemented in either version.** The HTML route handler falls back to `cached || networkFetch`, and if neither exists, the fetch simply rejects — there's no explicit "offline fallback page" response | **Missing** — a genuinely offline-and-uncached page load would show the browser's native offline error, not an app-branded fallback |

**Specific questions asked, answered directly:**
- **Can `activity.html` load offline?** Only if the user has visited it at least once while online (populates `CACHE_PAGES` via the generic HTML handler). It is not precached on install in either SW version, so a brand-new install/first-run offline would not have it.
- **Can navigation recover after refresh?** Yes, in principle — Stale-While-Revalidate serves the cached HTML immediately on refresh regardless of network state, assuming the page was cached at all (see above).
- **Are old cached HTML files possible (stale content shown)?** Yes, by design — Stale-While-Revalidate means the *first* load after a deploy always shows the previous cached version while the network fetch updates the cache in the background for *next* time. This is a known, accepted tradeoff of this strategy, not a bug — but worth stating plainly since a user could see one-version-behind content for a moment after every deploy.
- **Are there stale references to removed files?** None found — every file listed in root `APP_SHELL` still exists in the current project. (www's `APP_SHELL` also has no dangling references, it's just a smaller/older list.)

---

## PHASE 4 — Update & Versioning Analysis

**Current update flow:** There isn't one in practice — because the service worker is never registered, users always get the live network response for every request (subject only to ordinary HTTP/browser caching, not this SW's caching). In effect, today's real "update flow" is: every page load fetches fresh from Vercel, always current, no service-worker-mediated staleness possible — **but also no offline support possible**, since none of this caching logic ever activates.

**Expected update flow (per the code's own design intent):** On deploy, a new page load registers/updates the SW → `install` event fires for the new SW version (if `CACHE_STATIC`/`CACHE_PAGES`/`CACHE_DATA` version strings changed) → `activate` deletes caches not matching the new version list → `skipWaiting()`/`clients.claim()` ensure the new SW takes over without waiting for all tabs to close.

**Gap:** The entire update mechanism described above is inert. There is no registration call, so:
- Old caches are never created, so "deleted" is moot — but also never populated, so offline never works.
- Cache invalidation logic is well-designed (version-string-based, matches modern practice) but exercises no effect on any real user session.
- **Users cannot currently get "stuck on old UI" via this service worker, because it never engages** — ironically, the one risk this audit was asked to check for is *not* currently present, specifically because the feature meant to enable offline support was never turned on. Turning it on (Phase 6 discussion) would introduce this risk for the first time, which needs to be weighed, not just accepted as a pure win.

---

## PHASE 5 — Risk Analysis

| # | Issue | Severity | Affected Users | Possible Side Effects | Recommended Fix (not applied — investigation only) | Rollback Strategy |
|---|---|---|---|---|---|---|
| 1 | Service worker never registered (root and www both) | **High** | All users — no offline support exists despite substantial code written for it | None currently — the risk is a missing *feature*, not an active bug | Add a single `navigator.serviceWorker.register('/sw.js')` call, gated so it only runs in production and only once | Simply don't add the call / remove it if added — zero currently-running behavior depends on it |
| 2 | Two divergent `sw.js` implementations exist (root v5 vs. www v4) for what should be one feature | **High** | Depends entirely on resolving the `capacitor.config.json`/`server.url` question flagged in the prior Task 2.1 report — if the APK actually bundles `www/sw.js`, Android users would get the *older, weaker* version (no offline Firebase fallback) while any future web registration would get the newer one | Confusion for future maintainers about which file is "the real one"; risk of editing one and forgetting the other (already happened — they've diverged) | Establish a single source of truth once the APK bundling question is answered; do not fix by guessing | N/A — this is a decide-then-sync situation, not a revertible code change |
| 3 | `manifest.json` not linked from any HTML page | **Medium** | All users — "Add to Home Screen"/installability prompts likely don't fire correctly without the manifest being discoverable via `<link rel="manifest">` | None currently active; this is a missing capability, not a bug | Add `<link rel="manifest" href="manifest.json">` to the shared page template/`nav.js`-rendered head, once confirmed desired | Remove the link tag |
| 4 | 16 of 31 HTML pages missing from root `APP_SHELL` (including the just-restored `activity.html`) | **Low-Medium** | Only affects first-run-offline scenarios (a user who has never visited a given page and is offline on their very first visit to it) — normal online-then-offline usage is unaffected because the generic HTML handler caches on first *online* visit regardless of `APP_SHELL` | None currently active, since the SW doesn't run at all yet (see #1) | If/when registration is added, update `APP_SHELL` to include all current pages, or accept the smaller precache list as intentional (some pages, like `bayan.html`/`bayan-offline.html`, are already self-contained/offline-oriented by design per the project's own architecture and may not need to be in this list) | Revert the `APP_SHELL` array edit |
| 5 | No dedicated offline-fallback page for uncached, offline, first-visit routes | **Low** | Rare edge case — only hit if a user is offline AND visiting a page they've never loaded before AND it's not in `APP_SHELL` | Native browser "no internet" error instead of an app-branded message | Add a small `offline.html` and a catch-all fallback in the fetch handler | Remove the added file/fallback branch |
| 6 | Cache version label mismatch: code comment says "v5" but a separate project note (outside this codebase) previously referenced "v6" | **Low** | No functional impact — this is a documentation/communication mismatch, not a code defect | Confusion about which version is actually deployed | Reconcile the version number referenced in project notes with the actual code | N/A, documentation-only |
| 7 | www `sw.js`'s `cache.addAll()` install strategy fails the whole install silently if any one URL 404s | **Medium** (specific to the www version, if that's the one actually shipped in the APK) | Android app users, if www's SW were ever registered as-is | Complete absence of any offline caching for that install, with no visible error to diagnose why | Switch to the root version's per-URL `allSettled` pattern before ever enabling registration | N/A — not yet active |

---

## PHASE 6 — Migration Plan (proposed only — not applied)

Given the risk table above, the **smallest possible migration**, if and when approved, would be:

1. **Decide, don't guess, on the root-vs-www `sw.js` divergence** (Risk #2) — this blocks every other decision, since fixing/registering the wrong file would be worse than the current inert state.
2. **If root `sw.js` (v5) is confirmed as the intended single source of truth:** register it via one `navigator.serviceWorker.register('/sw.js')` call, placed once in a shared, already-loaded file (e.g. `shared.js`, which every page already loads) rather than duplicated per-page.
3. **Bump the cache version strings** (`farm-static-v5` → `v6`, etc.) at the moment registration is first turned on, so any stray cache from a prior manual/dev-tools test doesn't linger under the same name.
4. **Add the missing `<link rel="manifest">` tag** to the shared page template.
5. **Update `APP_SHELL`** to include the 16 currently-missing pages, or explicitly document why a subset is intentionally excluded.
6. **Leave the offline-fallback-page gap and the www-version's install-robustness issue as separate, lower-priority follow-ups** — not required for a first safe activation.

**This plan is not being executed now.** Per the task's explicit stop condition, everything above is a proposal only.

---

## Output Summary

**1. Service worker architecture summary:** Two independent, diverged service worker files exist (`sw.js` root = "v5", `farm-apk/www/sw.js` = "v4"), both well-constructed but **neither is ever registered anywhere in the project** — confirmed by an exhaustive string search for `serviceWorker` across every HTML and JS file in both locations. The entire offline-caching design is currently inert.

**2. Cache audit table:** See Phase 2. Root v5 is functionally the stronger implementation (Firebase offline fallback, safer install, dedicated data cache, message-based cache clearing); www v4 is simpler and missing several of these, plus has a fragile install step (`cache.addAll` with no per-URL resilience).

**3. Route coverage report:** 15 of 31 HTML pages are in root's precache list; the rest (including the just-restored `activity.html`) rely on being cached opportunistically on first online visit. No dedicated offline-fallback page exists. No stale references to removed files were found.

**4. Issues discovered:** 7, ranked High→Low in Phase 5. The two most consequential are (a) the feature being entirely unregistered, and (b) the unresolved question of which `sw.js` the Android app actually ships — the same open question flagged in the prior Task 2.1 report regarding `capacitor.config.json`.

**5. Recommended minimal migration:** 6 steps, listed in Phase 6, gated on resolving the root/www divergence question first.

**6. Files that would change (if this migration is approved):** `sw.js` (cache-version bump only, if root is chosen as-is), `shared.js` (one new registration call), the shared page-head template or `nav.js` (one manifest `<link>` tag). Possibly `farm-apk/www/sw.js` if the divergence resolution requires syncing it to match root.

**7. Estimated LOC:** ~10–15 lines total across the files above, if approved — this is a small, additive change once the divergence question is answered.

**8. Risk level:** **Medium overall for the full migration** (registering a previously-inert service worker for the first time always carries some risk of surprising caching behavior for real users) — but **the investigation itself, as performed here, carries zero risk**, since nothing was changed.

**9. Waiting for approval before any of Phase 6 is applied — and specifically waiting for a decision on the root-vs-www `sw.js` divergence before anything else proceeds.**
