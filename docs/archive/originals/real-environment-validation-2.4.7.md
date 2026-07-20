# Sprint 2 — Task 2.4.7: Real Environment Validation
**Status: Testing only. No rollout enabled, no public deployment, no sw.js/cache-strategy changes.**

**Methodology note, stated upfront for full transparency:** This sandbox has genuine tooling available — Playwright with a real headless Chromium browser (`/opt/pw-browsers`) — so Phase 1 below reflects **actual browser execution against a local HTTP server serving this project's real files**, not static code inspection. Network egress in this sandbox is restricted to a fixed allow-list of domains (npm, GitHub, PyPI, etc.); it does **not** include `cdn.jsdelivr.net`, `fonts.googleapis.com`, or `*.firebasedatabase.app`. This means CDN assets and Firebase calls fail in every test below — that failure is a **sandbox networking constraint, not a finding about the app**, and is called out explicitly wherever it appears. Phase 2 (Android WebView/Capacitor) **cannot be executed at all in this environment** — there is no Android SDK, no emulator, and no `adb` available here. That limitation is reported honestly below rather than simulated.

---

## PHASE 1 — Browser Validation (Real, executed in headless Chromium)

**Setup:** `python3 -m http.server` serving the project root at `http://localhost:8877`; Playwright/Chromium navigated to it directly (localhost is treated as a secure context, satisfying the Service Worker API's requirement without needing real TLS).

### Test 1 — First visit, registration, install, cache creation
Ran against `dashboard.html` with a pre-seeded `localStorage['farm_user']` (to get past `requireAuth()`, since real Firebase auth isn't reachable from this sandbox).

**Actual result (real, not simulated):**
```json
{
  "registrationCount": 1,
  "scopes": ["http://localhost:8877/"],
  "hasController": true,
  "cacheNames": ["farm-static-v5"],
  "entryCounts": { "farm-static-v5": 34 }
}
```
- ✅ Registration succeeded, correct root scope.
- ✅ `hasController: true` — **confirms, empirically, the exact behavior predicted analytically in Task 2.4.4**: `clients.claim()` puts the very page that triggered registration under SW control immediately, not just future page loads.
- ✅ All 34 `APP_SHELL` entries landed in `farm-static-v5` (matches the count set in Task 2.3.4/2.3.5).
- `farm-pages-v5`/`farm-data-v5` did not yet exist — correct and expected, since those are populated lazily on the first matching HTML navigation / Firebase GET respectively, neither of which had happened yet at this point in the test.

### Test 2 — A confirmed bug found by this test, not present in any prior code review
Re-ran the same registration check directly against `login.html` in isolation (no redirect).

**Actual result:**
```json
{ "registrationCount": 0, "scopes": [], "hasController": false, "swRegisterFnExists": true }
```
`swRegisterFnExists: true` confirms `sw-register.js` loads correctly and defines the function — but registration never happens. **Root cause, confirmed by direct code inspection immediately after this result:** `registerServiceWorker()` is only ever *called* via the `window.load` listener added to `shared.js` in Task 2.4.3. **`login.html` and `settings.html` do not load `shared.js`** (confirmed in Task 2.4.2/2.4.3) — they only got the `<script src="sw-register.js">` *include*, never an actual call site invoking the function. A direct search confirms zero occurrences of `registerServiceWorker(` in either file.

**This means the entire point of Task 2.4.2's coverage-gap analysis — closing registration coverage on exactly these two pages — was not actually completed in Task 2.4.3's implementation.** The script tag was added; the invocation was not. This is a genuine, confirmed bug, found specifically because this task tested a real browser instead of relying on code review alone.

### Test 3 — Offline navigation (inconclusive — testing-tool limitation, reported honestly)
After registering and precaching via `dashboard.html`, set `context.setOffline(true)` and:
- Revisited `dashboard.html` (precached): loaded successfully, status 200 — as expected.
- Visited `bayan.html` (deliberately excluded from `APP_SHELL` and from the caching system entirely, and never previously visited): **also loaded successfully with status 200 and its own real title**, rather than falling back to `/offline.html`.

**This result should not be read as "the offline fallback is broken."** Investigating further: Playwright/Chromium's `context.setOffline()` emulates offline conditions at the page's network layer, but there is a known limitation in browser-automation tooling where **Service-Worker-initiated fetches (the `fetch()` call made *inside* `sw.js`'s own fetch handler) do not always honor the same emulated-offline condition** as ordinary page-level requests, particularly in headless mode. The most likely explanation is that the SW's own internal `fetch()` call to `bayan.html` still reached the local Python server despite the emulated offline condition, because that emulation didn't propagate into the SW's separate execution context.
**Honest conclusion: this specific test is inconclusive in this harness, not a pass or a fail.** The reliable way to verify this specific behavior is a real offline test on an actual device/browser (physically disabling network, not tool-emulated) — flagged as a required manual check before rollout, not something this automated pass can certify either way.

### Test 4 — Recovery: `unregisterServiceWorker()` (Real, confirmed working)
```json
{
  "before": { "regs": 1, "caches": ["farm-static-v5"] },
  "unregResult": { "unregistered": 1, "cachesDeleted": 1, "errors": [] },
  "after": { "regs": 0, "caches": [] }
}
```
✅ **Confirmed, real, working end-to-end:** the function correctly removed the registration and purged every cache, with zero errors, and the before/after state proves it took effect.

**Recovery: `requestClearDataCache()`'s timeout path was not separately exercised in this pass** (it requires a controller already present *and* the SW to intentionally not respond, which isn't something this test setup induced) — noted as a remaining specific test to run, not claimed as verified here.

---

## PHASE 2 — Android WebView / Capacitor Validation

**This phase cannot be executed in this environment, and no result is reported as if it had been.** Checked directly: no Android SDK, no `adb`, no emulator, and no APK-building toolchain are available in this sandbox. Building the actual `farm-apk` project and running it — the only way to genuinely test the WebView-specific behavior this phase asks for — requires a real Android device or emulator, neither of which exists here. Every prior task in this Sprint that touched Android-specific behavior (e.g., Task 2.2.1's `capacitor.config.json` analysis) was based on static file/config inspection, not on-device execution, and this task does not change that — it is called out explicitly here rather than glossed over. **This entire phase remains an outstanding, unperformed test**, and should be treated as a hard prerequisite before any real rollout to Android users specifically.

---

## PHASE 3 — APK Sync Decision

Ran the sync tool's dry-run exactly as instructed, **before** any sync execution:

```
Files changed (29):
  activity.html, animal-detail.html, animals.html, assistant.html, barns.html,
  births.html, breeding.html, cost.html, dashboard.html, dead.html, diary.html,
  farm-profile.html, finance.html, fix-births.html, goats.html, health.html,
  import.html, inventory.html, login.html, notifications.html, pedigree.html,
  production.html, reports.html, settings.html, sheep.html, tasks.html,
  users.html, vaccine.html, shared.js
```

**This is 29 files, not the 2 files ("sw-register.js and settings.html only") the task expected.** Per the explicit instruction — *"If unexpected files appear: STOP"* — **this task stops here and does not proceed to any sync execution.**

**Why the mismatch, explained precisely:**
- Every one of the 28 HTML pages genuinely changed in Task 2.4.3/2.4.6 (the new `<script src="sw-register.js">` tag was added to each), so they correctly show as needing an update — this is expected drift given what was actually implemented, not a tooling bug.
- `shared.js` genuinely changed (the `window.load` listener added in Task 2.4.3).
- **`sw-register.js` itself — the new file created in Task 2.4.3 — does not appear in this list at all.** Checked the manifest directly: `sync-manifest.json`'s `always_sync` patterns have no entry matching `sw-register.js` (it was never added when the file was created). **This is a second, separate gap**: even setting aside the 29-vs-2 mismatch, the new file wouldn't be picked up by a sync run today regardless, since it's unclassified — invisible to the whitelist, per the tool's own by-design behavior (Task 2.2.4).

**No sync was executed.** Both issues (the broader-than-expected file set, and `sw-register.js` missing from the manifest entirely) need a decision before any sync proceeds.

---

## PHASE 4 — Rollout Readiness

**1. Browser test results:** Mixed — registration, caching, and the emergency unregister/purge function all **confirmed working via real headless-browser execution** on the primary (`shared.js`-covered) page path. **A real, confirmed bug** found on `login.html`/`settings.html`: `registerServiceWorker()` is never actually invoked on either page, despite the script being loaded — meaning the Task 2.4.2 coverage gap is **not actually closed** in the current implementation. The offline-fallback test produced an inconclusive result due to a testing-tool limitation, not a pass or fail.

**2. Android test results:** Not performed — no Android SDK/emulator/adb available in this environment. This remains a fully outstanding prerequisite, not a "likely fine" assumption.

**3. Sync dry-run result:** **29 files would change, not the expected 2** — stopped per instructions. Additionally, `sw-register.js` is missing from `sync-manifest.json`'s `always_sync` list entirely and would not sync even if a run proceeded.

**4. Remaining blockers:**
   - **Fix the confirmed `login.html`/`settings.html` registration-invocation bug** (add the actual `registerServiceWorker()` call to both pages, not just the script include).
   - **Add `sw-register.js` to `sync-manifest.json`'s `always_sync` list** — a manifest gap unrelated to the code itself.
   - **Resolve the sync-scope question** — confirm whether syncing all 29 genuinely-changed files (the honest, complete picture) is the intended action, since "2 files only" was based on an incomplete accounting of Task 2.4.3/2.4.6's actual footprint.
   - **Perform the offline-fallback test on a real device/browser** (not tool-emulated) to get a conclusive answer this sandbox couldn't provide.
   - **Perform all of Phase 2 on a real Android device or emulator** — entirely outstanding.
   - Verify `requestClearDataCache()`'s timeout path specifically (not exercised in this pass).

**5. Ready / Not Ready decision: NOT READY.** The core registration/caching/recovery mechanics are now proven to work correctly where they're actually wired up — but this validation pass found a real, confirmed gap in that wiring (login/settings pages), a real gap in the sync manifest, and two categories of testing (real offline behavior, any Android-specific behavior) that remain completely unverified. None of this is a fundamental design problem — the underlying mechanisms just demonstrated they work — but the specific, concrete items above should be resolved before even the controlled/team rollout (Option B) proceeds.

**Waiting for approval. No production activation. No public deployment.**
