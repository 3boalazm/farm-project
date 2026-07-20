# Sprint 2 — Task 2.5.1: Production Environment Validation (No Activation)
**Status: Validation only. No Service Worker activation, no deployment, no code changes.**

**Methodology note, stated upfront:** I attempted to reach the project's live production URL (`farm-project-puce.vercel.app`, per project context) to genuinely check its real HTTP headers — the same rigor applied to the Playwright browser tests in Tasks 2.4.7–2.4.9. **This was not possible in this session**: my web-fetch tool requires a URL to first appear in a web search result, and a search for this specific domain returned no matching results — it is a private, likely non-indexed application, not a publicly discoverable page. **Phase 1 below is therefore based on direct inspection of this project's own configuration files (which I can verify with certainty) plus well-established, current knowledge of Vercel's documented default behavior (clearly labeled as such, not as a live-confirmed fact)** — not a live fetch. This distinction is maintained throughout, consistent with this Sprint's standing practice of never reporting an untested claim as a confirmed result.

---

## PHASE 1 — Hosting Validation

| Item | Finding | Source of confidence |
|---|---|---|
| **`sw.js` availability** | The file exists at the project root and would be served at `/sw.js` under Vercel's standard static-file routing (no custom routing rule redirects or blocks it — confirmed by reading `vercel.json` directly, see below) | Verified from repo (config file), not a live fetch |
| **Correct MIME type** | Vercel's static file server infers Content-Type from file extension by default, and serves `.js` files as `application/javascript` (or `text/javascript`) without any project-specific configuration needed for the common case | Based on Vercel's documented default behavior — **not independently confirmed against this specific live deployment in this session** |
| **HTTPS requirement** | Satisfied by Vercel's platform (all Vercel deployments are served over HTTPS by default, with no HTTP-only option) and by the Capacitor WebView's `androidScheme: "https"` (confirmed directly in `farm-apk/capacitor.config.json`, verified repeatedly across this Sprint) | Verified from repo config for the APK side; platform-default for the web side |
| **Cache headers — real, evidence-based concern** | **`vercel.json`, read directly, contains exactly one `headers` rule, scoped only to `/api/(.*)` (CORS headers for the serverless functions). There is no explicit header rule anywhere for `/sw.js`, `/manifest.json`, or `/offline.html`.** This means all three are served under Vercel's undifferentiated default static-asset behavior, whatever that currently is — this project has never specifically decided or configured how these three specific files should be cached. | **Confirmed directly from the repo's own `vercel.json`** — this is not a guess |
| **`manifest.json` serving** | Same situation as above — no custom header rule; served under Vercel's default static handling | Verified from repo config |
| **`offline.html` availability** | Same — no custom rule; relies entirely on default static serving plus this Sprint's own `sw.js` precache/fallback logic to be reachable when needed | Verified from repo config |

**Specific risks to check for, addressed:**
- **Wrong Content-Type:** Not confirmable from this session without a live request; flagged as the single most important manual check to perform before any activation (a `curl -I` or browser DevTools Network-tab check against the real production URL, which only the project owner can run from outside this sandbox).
- **Aggressive CDN caching of `sw.js` specifically:** **This is the one finding in this phase worth treating as a genuine, non-hypothetical risk rather than a routine unknown.** Because `vercel.json` has zero explicit cache-control policy for `/sw.js`, whatever caching behavior currently applies is whatever Vercel's platform defaults to for a plain static `.js` file — which, depending on current platform behavior, could set a cache lifetime long enough to meaningfully delay how quickly a browser notices a new `sw.js` version. Most browsers already apply their own SW-specific cap (commonly around 24 hours) regardless of HTTP cache headers, which mitigates but does not eliminate this — an explicit `Cache-Control: max-age=0, must-revalidate` (or equivalent) rule specifically for `/sw.js` would remove the ambiguity entirely rather than relying on browser-side mitigation alone. **This is a concrete, actionable recommendation, not a speculative worry** — it costs nothing to add and directly closes a real gap this session found in the actual configuration file.
- **Missing headers / routing problems:** No routing rules anywhere in `vercel.json` redirect or rewrite `/sw.js`, `/manifest.json`, or `/offline.html` to anything else — confirmed directly, no routing-collision risk identified.

---

## PHASE 2 — Browser Compatibility Audit

| Platform | `navigator.serviceWorker` | Cache Storage API | Secure context |
|---|---|---|---|
| **Chrome Desktop** | Supported in all currently-shipping versions | Supported | Satisfied — Vercel serves over HTTPS |
| **Chrome for Android** | Supported in all currently-shipping versions | Supported | Same as above |
| **Android WebView / Capacitor** | Supported since the Android System WebView versions bundled with Android 5.0+ (effectively universal on any Android version this project would realistically target today) | Supported alongside Service Worker support | Satisfied — confirmed via `androidScheme: "https"` in `capacitor.config.json`, verified directly and repeatedly this Sprint |

**This phase's conclusions are based on well-established, current (as of this model's knowledge) platform capability facts, not a live device test** — genuine on-device confirmation remains Phase 2 of Task 2.4.7's still-outstanding Android validation, not something this environment-validation task can substitute for. What *is* newly confirmed here, directly from this project's own guard code: `sw-register.js`'s `'serviceWorker' in navigator` and `window.isSecureContext` checks (verified present and correctly implemented across Tasks 2.4.3–2.4.6) mean that on any platform where support is genuinely absent, the app degrades silently and safely rather than throwing — so even an unexpectedly-old device encountering this code would not break, per the design already validated.

---

## PHASE 3 — Recovery Path Review

**Reviewed via code inspection only — no destructive action executed, per this task's explicit constraint.**

| Function | Timeout behavior | Failure handling | User feedback path |
|---|---|---|---|
| `requestClearDataCache(timeoutMs)` | Races the SW's `DATA_CACHE_CLEARED` response against a `setTimeout` (default 5000ms, confirmed in the current `sw-register.js` source) — rejects with a descriptive `Error` if the timeout fires first | Guarded: rejects immediately (no hang) if `navigator.serviceWorker.controller` doesn't exist at call time; the `settled` flag prevents a late message from resolving after a timeout has already fired (and vice versa) | `settings.html`'s `_handleClearDataCache()` catches both the guard-rejection and the timeout-rejection identically, displaying the error message inline (confirmed present in the current file, added in Task 2.4.6) |
| `unregisterServiceWorker()` | No timeout needed by design — both of its actions (`getRegistrations()`/`unregister()` and the direct `caches.keys()`/`caches.delete()` purge) are plain Promises with no dependency on the SW responding to anything, so there is no "waiting for a reply that might never come" scenario to guard against in the first place | Each individual `unregister()`/`delete()` call has its own `.catch()` pushing a message into `result.errors` rather than rejecting the whole operation — a single failed cache deletion doesn't prevent the others from completing | `settings.html`'s `_handleUnregisterSW()` displays the returned counts (`unregistered`, `cachesDeleted`) and any `errors` length, plus requires an explicit `confirm()` dialog before calling it at all (confirmed present, Task 2.4.6) |

**What this review confirms as already correct (re-verified by reading the current source, not re-run):** the timeout logic added in Task 2.4.6 is present and structurally sound. **What remains unverified specifically:** Task 2.4.7's real Playwright test confirmed `unregisterServiceWorker()` end-to-end, but **did not specifically exercise `requestClearDataCache()`'s timeout path** (that would require inducing a scenario where the SW receives the message but never responds, which the prior test didn't set up) — this remains an open, specific test to run, not something this code-review pass can substitute for since this task explicitly disallows executing destructive/live actions.

---

## PHASE 4 — Risk Report

**1. Environment status:** Core client-side mechanics (registration, caching, recovery) are proven working via real browser execution (Tasks 2.4.7–2.4.9). Production hosting behavior (headers, MIME type, live CDN caching) is **not independently confirmed** in this session — verified only against this project's own configuration files, which reveal a real, specific gap (no explicit cache-control policy for `/sw.js`) rather than a clean bill of health.

**2. Blocking issues:**
   - **No explicit `Cache-Control` rule for `/sw.js` in `vercel.json`** — confirmed directly from the repo. Should be added before activation to remove reliance on an unconfirmed platform default for a file whose update-detection speed matters.
   - **Live hosting headers (Content-Type, actual cache behavior) remain unconfirmed** — requires a check against the real production URL, which is outside this sandbox's reach.
   - **`requestClearDataCache()`'s timeout path specifically has never been exercised**, live or otherwise.
   - Android on-device testing (Task 2.4.7's Phase 2) remains entirely outstanding — unrelated to this task's findings, but still a live blocker for rollout.

**3. Non-blocking issues:**
   - No routing/redirect conflicts found for any SW-related file — a clean result, not a risk.
   - Browser/WebView API support is effectively universal for any realistically-targeted device — a low-concern item, not zero-risk (very old devices), but already handled gracefully by existing guard code.

**4. Production activation readiness score: ~65/100.** Meaningfully improved from Task 2.4.4's original review (client-side mechanics now proven, not just designed) — but held back specifically by the newly-confirmed hosting-configuration gap and the still-unverified live headers, neither of which existed as concrete, named items before this task.

**5. Required fixes before pilot rollout:**
   - Add an explicit `Cache-Control` header rule for `/sw.js` in `vercel.json` (a small, low-risk, purely additive configuration change — not code logic).
   - Manually verify the live production headers for `/sw.js`, `/manifest.json`, and `/offline.html` (a `curl -I` or browser DevTools check against the real deployed URL — something only the project owner can run from outside this sandbox).
   - Exercise `requestClearDataCache()`'s timeout path specifically, live.
   - Complete Android on-device testing (carried forward from Task 2.4.7, still outstanding).

**Waiting for approval. Service Worker remains unactivated.**
