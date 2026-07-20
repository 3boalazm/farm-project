# Sprint 2 — Task 2.4.5: Rollback & Recovery Preparation (Design Only)
**Status: No implementation, no deployment, no sw.js lifecycle or cache-strategy changes.**

---

## PHASE 1 — Unregister Design

**Location:** Extend `sw-register.js` (the existing, isolated registration module) with a sibling function, `unregisterServiceWorker()` — same file, same single-responsibility category, no new file needed.

**Design detail worth deciding now, before implementation:** a genuinely robust emergency-recovery function should **not** depend on the service worker itself being healthy or responsive. Two independent actions, both performed directly from the page (not routed through the SW's message channel):
1. `navigator.serviceWorker.getRegistrations().then(regs => Promise.all(regs.map(r => r.unregister())))` — removes the SW registration itself.
2. A **direct** Cache Storage purge from the page context: `caches.keys().then(names => Promise.all(names.map(n => caches.delete(n))))`. This is deliberately **not** routed through the existing `CLEAR_DATA_CACHE` message (which requires an active, responsive `navigator.serviceWorker.controller` to answer) — the Cache Storage API is directly accessible from any page context, independent of whether a service worker is currently working correctly. This makes the emergency path resilient even in the specific scenario where the SW itself is the thing malfunctioning and might not respond to messages reliably.

**Access method:** A button in the same `settings.html` admin section already established for `requestClearDataCache()` (Task 2.4.3), reusing the page's existing `u.role === 'admin'` check (Task 2.4.2's finding — no `shared.js`/`can()` dependency needed).

**Browser compatibility:** Guard with `'serviceWorker' in navigator` (already the standard guard in `sw-register.js`) plus `'caches' in window` before attempting the direct purge — graceful no-op on unsupported browsers, consistent with every other guard in this codebase.

**Capacitor/WebView compatibility:** No special-casing required — same reasoning as registration itself (Task 2.4.1/2.4.3): both APIs (`serviceWorker`, `caches`) are standard and available identically under the WebView's `https://` origin.

**Security considerations:** Same framing as the existing recovery function — this is an operational-control gate (prevents an ordinary user from accidentally disabling their own offline capability), not a security boundary. Unregistering is inherently scoped to the calling origin only; there is no cross-origin risk.

---

## PHASE 2 — Recovery Design

**Current state:** `requestClearDataCache()` exists in `sw-register.js` (Task 2.4.3) but has zero UI callers anywhere — confirmed again in Task 2.4.4.

**How to expose it safely:** A button inside `settings.html`'s existing admin-only section (the same `if (u.role === 'admin') { ...reveal... }` block already rendering the current "admin reset" content), calling `requestClearDataCache()` and handling its promise:
- **Pending state:** disable the button and show a small inline "جاري التحديث..." indicator while the promise is outstanding.
- **Timeout consideration (new design detail, not in the original function):** `requestClearDataCache()` as currently written waits indefinitely for a `DATA_CACHE_CLEARED` message that may never arrive if the service worker is unresponsive. A production-safe version should race it against a short timeout (e.g., `Promise.race([requestClearDataCache(), timeoutPromise(5000)])`) so the admin always gets a definitive result rather than a UI stuck "pending" forever.
- **Success/failure feedback:** a small local success/error message element (since `settings.html` doesn't load `shared.js`'s `toast()` helper, per Task 2.4.2's finding — a lightweight, page-local equivalent is appropriate here, not a new shared dependency).

**Is `settings.html`'s admin section appropriate?** Yes — already established and justified in Task 2.4.2; this task adds the *unregister* button to the same section rather than introducing a new location, keeping every SW-related admin control in one place.

**Required permission checks:** Reuse the exact existing `u.role === 'admin'` pattern — no new permission mechanism needed.

**User experience:** Both buttons (existing `requestClearDataCache` trigger, new `unregisterServiceWorker` trigger) should sit together under a clearly-labeled section (e.g., "أدوات الصيانة" / "Maintenance tools") with brief, honest descriptions distinguishing them: the cache-clear button as "force-refresh cached data" (narrow, safe, reversible by just reloading), and the unregister button as a more consequential "fully disable offline mode on this device" action — worded to make the difference in severity obvious to the admin using it, consistent with this whole Sprint's emphasis on not overstating what a narrow tool actually does.

---

## PHASE 3 — Rollback Procedure

### Scenario A — Bad SW deployment
- **User impact:** Users who have already activated the faulty version experience whatever the bug causes (incorrect caching, broken offline behavior, etc.) until corrected.
- **Developer steps:**
  1. Identify the fault in the deployed `sw.js`.
  2. Prepare a corrected version — either reverting to the last known-good file or fixing forward.
  3. **Bump all three cache-version strings** (`CACHE_STATIC`/`CACHE_PAGES`/`CACHE_DATA` suffixes) regardless of whether the fix strictly requires it — this guarantees the `activate` handler's existing cleanup logic fully replaces every cache from the faulty version, rather than leaving any of its cached entries lingering under an unchanged name.
  4. Deploy the corrected version.
  5. Because `skipWaiting`+`clients.claim` are unchanged (per this task's constraints), already-affected clients receive and activate the fix automatically on their next visit/update-check — no user action required for the common case.
  6. For severely affected users who can't get a working page to load at all (rare, but possible if the bug affects page load itself): direct them to the Phase 1 unregister button if they can reach `settings.html`, or fall back to Scenario C's kill-switch approach if not.
- **Recovery time:** Bounded by (a) how fast the corrected version is deployed, and (b) the browser's own SW update-check timing — typically triggered on navigation, but browsers may also defer checks up to roughly 24 hours in some circumstances per the relevant web platform behavior. This latency is a real, honest constraint to plan around, not something this project's code can shorten on its own.

### Scenario B — Corrupted cache
- **User impact:** Stale or incorrect cached data/assets served despite the underlying `sw.js` logic being correct.
- **Developer steps:**
  1. Diagnose which cache is implicated: `CACHE_DATA` (cached Firebase reads) versus `CACHE_STATIC`/`CACHE_PAGES` (static assets/pages).
  2. **If `CACHE_DATA`:** direct the affected admin to the existing `requestClearDataCache()` button (Task 2.4.3, given a UI per Phase 2 above) — narrow, fast, no redeploy needed.
  3. **If `CACHE_STATIC`/`CACHE_PAGES`:** no on-demand clear exists today for these two caches specifically (a real limitation, already flagged in Task 2.4.4) — the practical remedies are either (a) a full version bump per Scenario A's procedure, or (b) using the new Phase 1 unregister-and-purge function as a blunt manual reset for that specific device (unregister → both caches cleared as part of the same action → the next page load re-registers fresh, per the existing registration flow already in place).
- **Recovery time:** Near-immediate (seconds) if using either the data-cache-clear button or the unregister button on the affected device directly; bounded by a full redeploy cycle (as in Scenario A) if the fix needs to reach every user simultaneously rather than one device at a time.

### Scenario C — Need emergency disable (all users, urgently)
- **User impact:** Potentially every active user; this is the highest-urgency scenario.
- **Developer steps:**
  1. Recognize that a page-side unregister **button** only helps users who can already load a working page to click it — insufficient on its own if the fault is severe enough to break page loads broadly.
  2. Given this project has no server-side feature-flag or remote-kill infrastructure (confirmed absent throughout this Sprint's investigation), the most reliable emergency path is a **"kill-switch" service worker version**: a new, minimal `sw.js` deployed under the existing version-bump mechanism, whose `install`/`activate` handlers immediately call `self.registration.unregister()` (or equivalently stop intercepting fetches entirely) rather than performing any caching — a well-established pattern for exactly this situation, deployed through the same update mechanism every other `sw.js` change already uses, so it reaches all clients via their normal, automatic update-check process rather than requiring any per-user manual action.
  3. This is a **documented emergency procedure for a future incident, not code to build now** — consistent with this task's investigation/design-only scope.
- **Recovery time:** Bounded by deploy speed plus the same browser update-check latency noted in Scenario A — but with a stronger guarantee of eventually reaching every affected client automatically, since it relies on the browser's own update mechanism rather than requiring users to take any action themselves.

**Relationship between the two recovery tools, stated plainly:** the Phase 1 unregister **button** is the right tool for **individual, known-device recovery** during the controlled/team rollout this task's context describes (Option B) — exactly the phase this project is in. The **kill-switch version** approach is the right tool for a **broad, urgent, all-users** emergency, which is a different scale of problem than what a per-device button can solve, and is documented here as a procedure to have ready, not something to build preemptively for a rollout that's intentionally limited to a small team right now.

---

## PHASE 4 — Testing Plan

| Test | What to verify |
|---|---|
| **Register** | On a device with no prior registration, confirm `sw-register.js`'s guards pass, `register('/sw.js')` succeeds, and `install`/`activate` complete with all three caches populated |
| **Unregister** | After a successful registration, trigger the new `unregisterServiceWorker()` function and confirm: the registration is removed (`navigator.serviceWorker.getRegistrations()` returns empty), all cache names are gone (`caches.keys()` returns empty), and the app continues functioning normally on ordinary network requests afterward (no hidden dependency on the SW being present) |
| **Cache clear** | With an active registration, trigger `requestClearDataCache()` (via its new UI) and confirm only `CACHE_DATA` is removed, `CACHE_STATIC`/`CACHE_PAGES` remain intact, and the confirmation message appears within the new timeout window rather than hanging indefinitely |
| **Reinstall** | After a full unregister, reload the page and confirm registration re-occurs cleanly (fresh `install`/`activate`, caches repopulate from scratch) — validates that unregistering doesn't leave the app in a state where it can no longer re-register |
| **Android WebView recovery** | Specifically inside the built APK (via remote debugging, per Task 2.4.4's still-outstanding device-matrix item): confirm both the unregister button and the cache-clear button function identically to the web/desktop case — this environment has not been directly exercised anywhere in this Sprint yet, and recovery-mechanism behavior inside a WebView specifically (versus a full browser) is worth confirming rather than assuming |

**None of these tests have been executed as part of this design task.**

---

## Output Summary

**1. Recommended rollback architecture:** A page-side `unregisterServiceWorker()` function added to `sw-register.js`, performing both SW unregistration *and* a direct (SW-independent) Cache Storage purge — deliberately not routed through the existing message channel, so it remains usable even if the service worker itself is malfunctioning.

**2. Recovery architecture:** Both `requestClearDataCache()` (existing, Task 2.4.3) and the new `unregisterServiceWorker()` get real UI in `settings.html`'s existing admin section, with a timeout added to the cache-clear flow so the admin never sees an indefinitely-pending state. The unregister button serves individual-device recovery during the current controlled-rollout phase; a separately-documented "kill-switch SW version" procedure (not built now) serves the broader, urgent, all-users emergency case.

**3. Files affected (for a future implementation task — not built here):** `sw-register.js` (new function, ~15–20 lines), `settings.html` (two buttons + handlers + local success/error UI, ~30–40 lines, extending the existing admin section).

**4. LOC estimate:** ~45–60 lines total, entirely additive.

**5. Risks:** Low for the unregister function itself (guarded, same pattern as existing code). Low-Medium for the `settings.html` UI work specifically, given it's the same page already flagged in Task 2.4.2 for its architectural distinctness — worth its own focused review, not because this task introduces new risk, but because that page continues to be the one place accumulating the most SW-related surface area in the project.

**6. Approval required before any of this is implemented, deployed, or activated.**
