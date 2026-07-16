# Sprint 2 — Task 2.4.1: Service Worker Activation Preparation (Planning Only)
**Status: No code written. No registration added. No production activation. No sw.js lifecycle or cache-version changes.**

---

## PHASE 1 — Registration Wrapper Design

**File location:** `sw-register.js`, at project root — consistent with this project's flat-file convention (no subfolder precedent for any other page-level script).

**Function name:** `registerServiceWorker()` (a single, clearly-named export with no ambiguity about its purpose).

**Invocation point — a real gap found during this investigation:**
The approved chain (`shared.js → sw-register.js → navigator.serviceWorker.register()`) assumes `shared.js` is loaded everywhere. **It is not.** Checked directly: **26 of 31 pages** load `shared.js`; the 5 that don't are `bayan.html`, `bayan-offline.html`, `index.html`, `login.html`, and (the just-created) `offline.html`. Two of these five are notable:
- `login.html` — **the first page in almost every real session** (per `manifest.json`'s own `start_url` pointing at `dashboard.html`, but any unauthenticated visit still routes through `login.html` per `index.html`'s redirect logic). If registration only fires from `shared.js`, the earliest and arguably best opportunity to register (right at login) is missed entirely.
- `settings.html` — confirmed, directly, to load **no** shared project script at all (`shared.js`, `firebase.js`, `nav.js`, `config.js` are all absent from its `<script>` list) — it runs on its own inline scripts plus `farm-react.js`. This is a pre-existing architectural oddity unrelated to this task, but it means "register via `shared.js`" would silently skip this page too.
- `bayan.html`/`bayan-offline.html` — already established, repeatedly, as self-contained pages outside the shared dependency chain by design; skipping registration here is consistent with every prior decision in this Sprint.
- `offline.html` — the fallback page itself; it has no need to register anything (it's what a user sees *after* something else has already failed).

**Recommendation:** keep the approved `shared.js → sw-register.js` chain as the primary path (covers 26 of 31 pages with zero additional per-page edits), but explicitly decide, before implementation, whether `login.html` and `settings.html` should each independently include a `<script src="sw-register.js">` tag plus the same invocation, to close this specific coverage gap. `bayan.html`/`bayan-offline.html`/`offline.html` are recommended to remain excluded, consistent with every prior decision this Sprint has made about those specific pages.

**Browser guards (inside `registerServiceWorker()`):**
- `if (!('serviceWorker' in navigator)) return;` — mandatory feature detection; must not throw or log an error for browsers that simply don't support the API, since that's a normal, expected condition, not a failure.
- No additional secure-context check is needed as a *separate* guard — browsers do not expose `navigator.serviceWorker` at all in insecure contexts, so the feature-detection check above already implicitly covers this.

**Capacitor/WebView handling:** No special-casing required. `farm-apk/capacitor.config.json` specifies `"androidScheme": "https"`, meaning the WebView serves the app under an `https://` origin — satisfying the Service Worker API's secure-context requirement the same way the web deployment does. This was verified directly, not assumed. No Capacitor-specific API calls exist anywhere in this codebase (confirmed repeatedly throughout this Sprint), and none are needed here either — the same guard and the same registration call work identically on both platforms, consistent with this Sprint's overall direction of keeping web and APK code unified rather than diverging.

**Failure handling:** `navigator.serviceWorker.register('/sw.js').catch(err => { /* log only, never throw */ })`. Given the Architecture Audit's earlier finding that no centralized logging wrapper or global error handler exists yet in this project, the safe default is a plain `console.warn` (consistent with the one existing precedent already in the codebase — `pages/reports.js`'s Chart.js failure handling uses `console.warn`), not a new logging mechanism invented specifically for this feature.

---

## PHASE 2 — Recovery Mechanism Design

**Current `CLEAR_DATA_CACHE` implementation (as it exists today, unchanged by this task):** `sw.js`'s `message` event listener responds to `{type: 'CLEAR_DATA_CACHE'}` by deleting the `CACHE_DATA` cache (Firebase GET response cache only — **not** `CACHE_STATIC` or `CACHE_PAGES`) and posting back `{type: 'DATA_CACHE_CLEARED'}` to the requesting client. This is a narrow, specific tool — it forces fresh Firebase reads on next fetch; it is **not** a general "undo this deployment" or full-rollback mechanism, and should not be described or exposed to users as one.

**How it should be triggered:** A page-side function (not yet built) that calls `navigator.serviceWorker.controller.postMessage({type: 'CLEAR_DATA_CACHE'})`, paired with a `navigator.serviceWorker.addEventListener('message', ...)` listener to catch the `DATA_CACHE_CLEARED` confirmation and surface it to the user (e.g., via the existing `toast()` function already used project-wide for this kind of feedback).

**Who can access it:** Recommend gating this behind an admin-only check, placed in `settings.html` (the natural home for this kind of operational control) as a labeled action (e.g., "تحديث البيانات المخزّنة" / "Refresh cached data"). **Caveat found during this investigation:** `settings.html` does not currently use the `can('admin')` permission-check pattern found elsewhere in the project (e.g., `activity.html`'s backup/clear-period actions) — in fact, it doesn't load `shared.js` at all (see Phase 1), so it doesn't have access to `can()` today without also resolving the same script-loading gap. This recovery-mechanism UI and the registration-coverage gap in Phase 1 are therefore linked: fixing one (giving `settings.html` access to shared project functions) would likely be needed to properly implement the other.

**Security concerns:** `postMessage` to a service worker is inherently same-origin — there is no cross-origin injection risk in the browser-security sense. The real concern is purely operational: exposing this trigger to *all* users rather than admins only would let any user degrade their own offline data freshness unnecessarily (a low-severity, self-inflicted inconvenience, not a security vulnerability), which is why admin-gating is recommended — for intentional operational control, not because of an actual security exposure.

**Rollback workflow:** This mechanism, once wired up, becomes useful for exactly one specific incident type: "a user is seeing stale cached Firebase data and needs a forced refresh." It is explicitly **not** a substitute for the broader rollback approach already established across this Sprint's prior tasks — reverting a problematic `sw.js` *version* still requires shipping a new, superseding version with bumped cache names (per Task 2.3/2.4's repeated findings), regardless of whether this message-based tool exists. Building this recovery mechanism makes one specific, narrower failure mode actionable; it does not remove the need for the broader version-based rollback plan for anything beyond stale Firebase data specifically.

---

## PHASE 3 — Testing Plan

| Scenario | What to verify |
|---|---|
| **First registration** | `registerServiceWorker()` runs without throwing on a browser with no prior SW for this origin; `install` → `activate` complete; Cache Storage shows all three expected named caches (`farm-static-v5`, `farm-pages-v5`, `farm-data-v5`) populated per `APP_SHELL`; the page that triggered registration continues functioning normally throughout (per Task 2.4's lifecycle analysis, that specific page load is not retroactively intercepted) |
| **Update flow** | Bump cache-version strings in a test copy of `sw.js`; confirm the new worker installs, activates immediately (`skipWaiting`+`clients.claim`, unchanged per this task's constraints), and that the `activate` handler's cleanup correctly deletes the previous version's three caches, not just some of them |
| **Failed install** | Deliberately reference a nonexistent URL in a test `APP_SHELL` copy; confirm the `Promise.allSettled` wrapper (already present, unmodified) allows install to complete despite that one failure, and that every *other* `APP_SHELL` entry is still successfully cached |
| **Cache corruption recovery** | Manually trigger the `CLEAR_DATA_CACHE` message (once Phase 2's page-side trigger exists) and confirm only `CACHE_DATA` is removed, `CACHE_STATIC`/`CACHE_PAGES` remain untouched, and the next Firebase read repopulates `CACHE_DATA` correctly rather than leaving the app in a broken state |
| **Unregister flow** | Manually call `navigator.serviceWorker.getRegistrations()` → `.unregister()` in a test session; confirm the app continues functioning normally with the SW gone (falls back to ordinary network requests), and that a subsequent fresh registration re-establishes the same behavior cleanly — this validates there's no hidden dependency on the SW being present for basic app function, which matters given the SW has been fully inert until now |

**None of these tests have been executed as part of this task** — this is a test plan for a future implementation/QA task, not a report of testing already performed.

---

## PHASE 4 — Implementation Scope (for a future task — not built here)

| Item | Detail |
|---|---|
| **Files to create** | `sw-register.js` (~20–25 lines: the guard, the registration call, the failure handler) |
| **Files to modify** | `shared.js` (~5 lines: a `window.addEventListener('load', ...)` block calling `registerServiceWorker()` if it's defined — deferred to `load` specifically so script tag order between `sw-register.js` and `shared.js` doesn't matter); **pending the Phase 1 coverage decision:** possibly `login.html` and `settings.html` individually (+1 `<script src="sw-register.js">` tag each, if the coverage gap found in Phase 1 is to be closed); `settings.html` additionally for the Phase 2 recovery-mechanism UI (~15–20 lines: a button, a click handler calling the not-yet-built page-side trigger function, a `toast()` call on confirmation) — this second change is itself blocked on first resolving `settings.html`'s missing access to shared project functions, per Phase 2's finding |
| **Estimated LOC** | ~40–50 lines total if the coverage gap is closed for `login.html`/`settings.html`; ~25–30 lines if the `shared.js`-only chain is accepted as-is with the known 5-page gap |
| **Risk level** | **Low** for `sw-register.js` itself and the `shared.js` invocation hook (purely additive, guarded, fails silently). **Low-Medium** for the `settings.html` changes specifically, since they interact with that page's already-unusual lack of shared-script dependencies — worth its own small, isolated review rather than treating it as a routine addition like the other files |

**Nothing in this scope includes actually registering the service worker in a live/production sense** — per this task's explicit constraints, this remains preparation for a still-separate, still-unapproved activation decision.

---

## Output Summary

**1. Architecture plan:** `sw-register.js` as an isolated registration module, invoked from `shared.js` via a `window.load` listener (removing script-order fragility) — with an explicit, newly-found coverage gap (`login.html`, `settings.html`, and 3 already-intentionally-excluded pages don't load `shared.js` at all) that needs a decision before implementation, not just an assumption that "loaded by shared.js" means "loaded everywhere."

**2. Recovery plan:** `CLEAR_DATA_CACHE` becomes actionable via a new page-side trigger (recommended home: `settings.html`, admin-gated) — but this is narrowly scoped to stale-Firebase-data recovery specifically, not a general rollback substitute, and its implementation is entangled with `settings.html`'s pre-existing, unrelated lack of shared-script access.

**3. Test plan:** Five scenarios defined (first registration, update flow, failed install, cache-corruption recovery, unregister flow) — none executed yet.

**4. File changes (future task, not this one):** 1 new file, 2–4 modified files depending on the coverage-gap decision, ~25–50 LOC total.

**5. Risks:** Low for the core registration wrapper; Low-Medium specifically for the `settings.html`-related work, given that page's pre-existing architectural quirk surfaced during this investigation.

**6. Waiting for approval — specifically including a decision on the `login.html`/`settings.html` coverage gap — before any of this is implemented.**
