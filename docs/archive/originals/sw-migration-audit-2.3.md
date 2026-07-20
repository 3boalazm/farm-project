# Sprint 2 — Task 2.3: Service Worker Migration Audit (Investigation Only)
**Status: No sw.js sync, no code changes, no registration, no cache-version changes, no manifest changes.**

---

## PHASE 1 — sw.js Diff Analysis

| Aspect | Root (`sw.js`, "v5") | `farm-apk/www/sw.js` ("v4") | Assessment |
|---|---|---|---|
| **Cache names** | `farm-static-v5`, `farm-pages-v5`, `farm-data-v5` (three separate named caches) | `farm-bayan-v4`, `farm-pages-v4` (two caches, different naming scheme entirely — `farm-bayan-*` vs `farm-static-*`) | **Changed** — not just a version bump, the static-cache name itself was renamed between versions |
| **APP_SHELL entries** | 22 entries: `/`, `/index.html`, `/dashboard.html`, `/login.html`, `/animals.html`, `/health.html`, `/vaccine.html`, `/breeding.html`, `/births.html`, `/production.html`, `/tasks.html`, `/notifications.html`, `/reports.html`, `/inventory.html`, `/finance.html`, `/settings.html`, `/styles.css`, `/config.js`, `/firebase.js`, `/nav.js`, `/shared.js`, `/offline-sync.js`, `/manifest.json` | 10 entries: `/`, `/index.html`, `/dashboard.html`, `/login.html`, `/styles.css`, `/config.js`, `/firebase.js`, `/nav.js`, `/shared.js`, `/manifest.json` | **Added** — root added 12 more HTML pages plus `/offline-sync.js` to the precache list; www's list represents an earlier, much smaller app shell |
| **Added logic (root only)** | Dedicated `CACHE_DATA` cache for Firebase GET responses; Network-First-with-offline-fallback strategy specifically for `*.firebasedatabase.app` GET requests, including a synthetic `X-Farm-Cache: offline` response header and an empty-array `[]` fallback so the app doesn't crash with nothing cached; a `message` event listener supporting `SKIP_WAITING` and `CLEAR_DATA_CACHE` commands from the page | None of this exists in www's version | **Substantial behavioral addition** |
| **Removed logic (relative to www)** | www's CDN/JS-CSS caching includes an explicit `url.includes(self.location.origin)` origin guard on the JS/CSS Stale-While-Revalidate branch; root's equivalent branch has no such guard | Root doesn't have this specific check | **Regression, minor** — already flagged in the earlier Task 2.2 report; root is very slightly less defensive on this one point even though it's newer overall |
| **Install robustness** | `Promise.allSettled(...)` per-URL, wrapped in an individual `.catch(()=>{})` — one bad precache URL doesn't fail the whole install | `cache.addAll(...)` — a single failed URL fails the entire `install` step (masked by an outer `.catch(()=>{})` that silently swallows the failure) | **Root is safer** |
| **Firebase GET handling** | Network-First with cached/offline fallback (see "Added logic" above) | Explicitly excluded from caching — always network, no offline capability for data reads | **Root is materially more capable** — this is the single biggest functional difference between the two files |
| **Overall behavioral difference** | Root implements a more complete offline-first design across data, pages, and static assets, with safer install semantics and a page-to-SW messaging channel | www implements a simpler, page/static-asset-only caching layer with no data offline story and a fragile install step | Root is the clear, substantial upgrade — this is not a trivial version bump, it's a meaningfully different implementation |

---

## PHASE 2 — Dependency Closure

| File referenced by root `sw.js`'s `APP_SHELL` | Exists in root? | Exists in `farm-apk/www`? | Should sync? |
|---|---|---|---|
| `/`, `/index.html` | Yes | Yes | Already in sync (per Task 2.2.4 execution) |
| `/dashboard.html`, `/login.html` | Yes | Yes | Already in sync |
| `/animals.html`, `/health.html`, `/vaccine.html`, `/breeding.html`, `/births.html`, `/production.html`, `/tasks.html`, `/notifications.html`, `/reports.html`, `/inventory.html`, `/finance.html`, `/settings.html` | Yes | Yes | Already in sync |
| `/styles.css` | Yes | Yes | Already in sync |
| `/config.js`, `/firebase.js`, `/nav.js`, `/shared.js` | Yes | Yes | Already in sync |
| **`/offline-sync.js`** | Yes | **Yes — confirmed present, byte-identical, since Task 2.2.4's execution** | **Already in sync — this was the one closure gap identified in Task 2.2/2.2.3, and it is now closed as a side effect of prior, unrelated sync work** |
| `/manifest.json` | Yes | Yes | Already in sync (0-diff since before this investigation chain began) |

**This is the single most important finding of this phase: the dependency-closure blocker that previously stood between "root `sw.js` is newer" and "root `sw.js` can be safely synced" no longer exists.** Every file root's `sw.js` would try to precache is already present and current in `farm-apk/www` as of Task 2.2.4/2.2.7. This does **not** mean syncing `sw.js` is risk-free (see Phase 4) — it means the specific, previously-identified *file-availability* risk is resolved; remaining risk is behavioral (registering a previously-inert feature for the first time), not a missing-file problem.

**Assets/CSS/JS modules not in `APP_SHELL` but reachable via the generic fetch handlers:** the fetch handler's Stale-While-Revalidate rules match any `.html`/`.js`/`.css` request by pattern, so the 16 HTML pages currently absent from `APP_SHELL` (per the earlier Task 2.2 report — `activity.html`, `animal-detail.html`, `assistant.html`, etc.) would still get cached the first time a user visits them online, even without being explicitly precached on install. This is unchanged from the earlier audit and remains a "first-visit-offline" edge case only, not a hard dependency gap.

---

## PHASE 3 — Registration Analysis

- **Is a service worker currently registered anywhere?** **No.** Re-confirmed in this pass by an exhaustive string search for `serviceWorker` across every `.html` and `.js` file in both the root project and `farm-apk/www/` — zero matches, consistent with every prior audit in this investigation chain.
- **If not, where should registration happen?** The natural candidate is `shared.js`, since it is already loaded by effectively every page in the project (confirmed throughout this Sprint's earlier architecture audits) — a single registration call there would cover the whole app without needing to touch each page individually. This is a design observation only; no code is being proposed or written here.
- **What pages are candidates?** All pages currently load `shared.js`, so registering there would apply universally. Alternatively, a narrower rollout could register only from `dashboard.html` (the app's post-login landing page) as a more conservative first step — a design choice, not a decision made by this investigation.
- **What is the expected lifecycle?** Per the code already written in root `sw.js`: `install` (skip-waiting, precache `APP_SHELL`) → `activate` (delete any cache not matching the current version names, claim clients) → ongoing `fetch` interception per the strategies in Phase 1 → optional `message`-driven `SKIP_WAITING`/`CLEAR_DATA_CACHE` from the page. This lifecycle is fully implemented and ready to run — it simply has never been invoked by a `register()` call anywhere.

---

## PHASE 4 — Migration Options

### Option A — Sync current root `sw.js` to APK only
- **Benefits:** Simplest possible change; brings www's service worker file up to the same version as root; the dependency-closure blocker that used to make this risky (missing `offline-sync.js`) is now resolved, so this option is safer today than it would have been earlier in this investigation chain.
- **Risks:** Syncing the file alone still does **not** register it — so on its own, this option changes nothing observable for any user; it only sets up a *future* registration to use the newer code. If registration were bundled into the same change (not part of this option as strictly stated, but a natural next step someone might be tempted to combine it with), that's a materially bigger and separate risk — see Option B/C's framing below.
- **Affected users:** None immediately (file-only change, unregistered either way).
- **Rollback:** Trivial — revert the single file via the sync tool's own git-tracked destination changes, exactly like every other file this Sprint has synced.

### Option B — Sync `sw.js` + full dependency closure, and *also* enable registration in the same effort
- **Benefits:** Delivers the actual, user-facing offline capability this whole investigation chain has been building toward — root's more complete Firebase-offline-fallback behavior would finally take effect for real users, on both platforms.
- **Risks:** This is the first time a service worker would ever run for real users on either platform. Every prior audit in this chain has noted the *code* is well-constructed, but "well-constructed and never executed" and "well-constructed and now controlling every network request for real users" are very different risk profiles. Specific concrete risks: (1) the Stale-While-Revalidate strategy means the *first* page load after this change activates could show cached-then-updated content in a way users have never experienced before; (2) the cache-name change (`farm-bayan-v4`/`farm-pages-v4` → `farm-static-v5`/`farm-pages-v5`/`farm-data-v5`) means any device that somehow already has a service worker registered under the old names (unlikely given the "never registered" finding, but not something this investigation can rule out with 100% certainty for every possible installed copy of the Android app in the wild) would go through a real cache migration, not a clean first install.
- **Affected users:** Both web and Android users, immediately and directly.
- **Rollback:** Not a simple file revert once registered — per the earlier Task 2.2.3 finding, "rolling back" a live, registered service worker requires shipping a new version that unregisters/clears caches (the `CLEAR_DATA_CACHE` message handler already exists in root's code for exactly this purpose), not just reverting the file in the repository.

### Option C — Redesign the SW strategy before enabling anything
- **Benefits:** An opportunity to resolve the smaller, lower-priority gaps already on record before ever going live — e.g., adding the 16 missing pages to `APP_SHELL`, adding the origin-guard www's older version has but root's doesn't, adding a dedicated offline-fallback page (confirmed missing in both versions per Task 2.2's original audit), and reconciling the `manifest.json` link-tag gap (also confirmed missing from every page in Task 2.2).
- **Risks:** Pure delay risk — the offline capability this project apparently wants (per its own product description referenced in the earlier audits: "يعمل Offline مع مزامنة تلقائية" in the APK build's own release notes template) continues to not exist for any real user for however long this redesign takes. No new technical risk beyond continued absence of the feature.
- **Affected users:** None, in either direction — status quo continues.
- **Rollback:** Not applicable — nothing would be shipped under this option until redesign work concludes.

---

## PHASE 5 — Recommendation

**Recommended approach: Option A now, as a standalone, low-risk step — explicitly *not* bundled with registration.**

Reasoning: the dependency-closure blocker that made syncing `sw.js` risky is now resolved (Phase 2), so bringing `farm-apk/www/sw.js` up to date with root's file is a safe, mechanical, easily-reversible action on its own — consistent with every other file this Sprint has already synced under the same tool and process. **Registration (Option B) is a separate, larger decision that should not piggyback on this file-sync step**, given the very different risk profile of "a file exists" versus "a file is actively controlling every network request for real users." Option C's redesign items (missing `APP_SHELL` pages, origin guard, offline-fallback page, manifest `<link>` tag) are legitimate but lower-priority than simply closing the version gap between the two `sw.js` copies — they can be addressed either before or after registration, independently of this specific recommendation.

**Files involved (if Option A is later approved and executed):** `farm-apk/www/sw.js` only, via the existing sync tool's `conditional` tier (already correctly gating this file, per the manifest as it stands after Task 2.2.6).

**Estimated LOC:** No new code — a straight file sync of the already-written 161-line `sw.js`, replacing www's 108-line older version.

**Risk level:** **Low**, specifically for the sync-only action described here. **Registration itself, whenever it is separately decided, remains a Medium-to-High-risk action** per the reasoning in Option B above, and is explicitly not part of this recommendation.

---

## Output Summary

**1. sw.js diff report:** Root is a substantial upgrade over www — added Firebase-offline-fallback caching, a dedicated data cache, safer per-URL install resilience, and a message-based cache-clearing channel; www retains one minor safety feature (an origin guard on JS/CSS caching) that root lacks.

**2. Dependency report:** The previously-identified gap (`offline-sync.js` missing from www) **is now closed**, resolved as a side effect of this Sprint's earlier, unrelated sync work (Tasks 2.2.4/2.2.7). No remaining file-availability blockers exist for syncing `sw.js` itself.

**3. Registration status:** Confirmed, once again, unregistered anywhere on either platform. `shared.js` is the natural future registration point given its universal load coverage, but no registration is proposed or performed here.

**4. Migration options:** A (sync file only) / B (sync + register together) / C (redesign first) — compared in full above.

**5. Recommendation:** Option A — sync `sw.js` alone, now, as a low-risk step, with registration treated as an explicitly separate future decision.

**6. Waiting for approval. No sw.js sync was executed. No manifest was modified. No registration was added.**
