# Sprint 2 — Task 2.2.3: Sync Boundary Definition (Investigation Only)
**Status: No scripts, no copies, no repository or CI changes.**

---

## PHASE 1 — File Classification (every root file)

### A) Must sync to `farm-apk/www`

| File | Reason |
|---|---|
| All 29 shared HTML pages (`index.html`, `login.html`, `dashboard.html`, `animals.html`, `animal-detail.html`, `sheep.html`, `goats.html`, `births.html`, `dead.html`, `breeding.html`, `health.html`, `vaccine.html`, `production.html`, `inventory.html`, `finance.html`, `cost.html`, `diary.html`, `tasks.html`, `notifications.html`, `reports.html`, `import.html`, `users.html`, `settings.html`, `assistant.html`, `farm-profile.html`, `barns.html`, `pedigree.html`, `fix-births.html`, `activity.html`) | Platform-agnostic UI, directly affects what Android users see; already the file type found diverged (`activity.html` was 285 lines out of sync until Task 2.1) |
| `styles.css` | Single shared stylesheet — confirmed 163-line drift |
| `shared.js` | Central shared logic — confirmed 585-line drift, the largest of any file |
| `firebase.js` | Core data gateway — confirmed 63-line drift |
| `nav.js` | Shared navigation rendering — confirmed 15-line drift |
| `config.js` | Currently in sync (0-line drift) — proves sync *can* work when maintained |
| `notifications-service.js` | Currently in sync (0-line drift) |
| `offline-sync.js` | **Currently missing from www entirely** — required by `sw.js`'s own `APP_SHELL` (see Phase 2) |
| All of `pages/*.js` | Feature-specific logic, platform-agnostic — several have open live/dead questions from the earlier dead-code audit (see "D" below), which affects *when* to sync them, not *whether* |
| `manifest.json` | Currently in sync (0-line drift); harmless to keep syncing even though currently unlinked from any HTML |

### B) Must never sync

| File | Reason |
|---|---|
| `farm-apk/capacitor.config.json` | Android-only configuration; has no root-web equivalent and shouldn't |
| `vercel.json` | Vercel hosting configuration — confirmed present in `www` today as a byte-identical leftover from an earlier wholesale copy; has zero function inside a Capacitor-built app and should not have been there in the first place |
| `database.rules.json` | Firebase **backend** security rules — deployed directly to Firebase via CLI/console, never served to any client, web or Android |
| `FIREBASE_RULES_SETUP.md` | Project documentation, not a served asset |
| `package.json` (root) | Describes the root Node project itself (engine version, metadata) — not a runtime dependency of any page |
| `farm-apk.zip` | A packaged archive sitting in root — almost certainly a distribution artifact of `farm-apk/` itself; including it inside `farm-apk/www/` would be circular (a zip of the app bundled inside the app) |
| `api/claude.js` | **A Vercel Serverless Function**, not a static asset — confirmed by its own code (`process.env.ANTHROPIC_API_KEY`, `module.exports = async function handler(req, res)`, standard Vercel function signature). This cannot run inside a Capacitor WebView at all; there is no Node.js server runtime on-device. This is not a sync candidate — it's a category error to even consider it one. **Important related finding, flagged but not resolved here:** `farm-react.js` (loaded on `reports.html`/`settings.html`, present in both root and www) contains a theme-designer feature that calls `fetch('/api/claude', ...)`. On the web (Vercel), that relative path resolves correctly to the live serverless function. **Inside the Android app, that same relative fetch has no equivalent backend to reach** — this is a pre-existing, platform-specific functional gap, not something a sync mechanism can fix, since the "fix" (if one is wanted) would require the app to call an absolute production URL instead of a relative one. Noted here because it directly affects Phase 2's dependency-closure question for `farm-react.js`, but resolving it is out of this task's scope. |
| `FETCH_HEAD`, `git` (both empty files found at root) | Not real project files — most likely artifacts of however this project's archive/checkout was produced, not part of the actual application. Irrelevant to classify as sync candidates either way; worth a separate, unrelated cleanup note |

### C) Conditional sync

| File | Condition |
|---|---|
| `sw.js` | Sync only after the registration decision from Task 2.2 is made **and** after confirming `offline-sync.js` (a hard dependency of its `APP_SHELL`) is synced first — syncing `sw.js` alone would introduce a new 404-on-precache bug that doesn't exist today in either version |
| `import-data.js` | One-time data-seeding utility, not part of the running app's request path — whether the Android app needs its own copy is a product question (does anyone run first-time data seeding *from* the APK?) rather than a technical one |
| `sync-to-excel.js` | Its own live/dead status is still an open question from the earlier Sprint 2 dead-code audit; sync should wait on that resolution rather than propagate an unresolved file |
| `media/logo.png` | **Currently unused by any code, root or www** (confirmed by an exhaustive grep — zero references). Syncing an already-dead asset costs nothing but also fixes nothing; low priority either way |

### D) Needs manual review (blocks classification until resolved)

| File | Why classification is blocked |
|---|---|
| `pages/animal_detail.js` | Orphaned in both root and www; needs the diff-against-inline-script review flagged in the original dead-code audit before deciding if it's even a "file" that should exist going forward, let alone sync |
| `pages/notifications.js` | Orphaned in both, **and diverged 75 lines between root and www on top of that** — needs review against the live `notifications-service.js` first |
| `pages/births.js` | Content is identical between root and www, but **usage differs**: only www's `births.html` loads it via `<script src>`. Sync classification here isn't about the file's content (already identical) — it's a question of whether root's `births.html` should also load it, which is a product/architecture decision, not a sync-mechanism one |
| `chat.js` | Orphaned in both, byte-identical between root and www — lower-risk than the above, but still pending the "diff against assistant.html's inline chat" review from the earlier audit |

---

## PHASE 2 — Dependency Closure

**Method:** for each file classified "must sync" or "conditional sync" above, verify every file *it* references (via `<script src>`, `fetch`, or explicit list like `APP_SHELL`) is itself also synced.

| Parent file | Declares dependency on | Currently present in www? | Closure status |
|---|---|---|---|
| `sw.js` (root, v5) `APP_SHELL` | `/`, `/index.html`, `/dashboard.html`, `/login.html`, `/animals.html`, `/health.html`, `/vaccine.html`, `/breeding.html`, `/births.html`, `/production.html`, `/tasks.html`, `/notifications.html`, `/reports.html`, `/inventory.html`, `/finance.html`, `/settings.html`, `/styles.css`, `/config.js`, `/firebase.js`, `/nav.js`, `/shared.js`, `/offline-sync.js`, `/manifest.json` | All HTML pages present ✅. `styles.css`/`config.js`/`firebase.js`/`nav.js`/`shared.js`/`manifest.json` present (though stale) ✅. **`/offline-sync.js` — NOT present ❌** | **BROKEN CLOSURE.** If root's `sw.js` were synced to www as-is today, its own `install` event would attempt to precache `/offline-sync.js` and fail that one entry (the `Promise.allSettled` wrapper means this wouldn't crash the whole install, but that specific offline capability — background sync of queued writes — would silently never be available on Android even after "fixing" the sync) |
| Every HTML page's shared `<script>` includes | `config.js`, `firebase.js`, `nav.js`, `shared.js` | All present in www | **Closed** — no missing files, only staleness (already covered in Phase 1/A) |
| `activity.html` (just migrated, Task 2.1) | `config.js`, `firebase.js`, `nav.js`, `shared.js`, `pages/datepicker.js`, `pages/tour.js`, plus the 6 CSS classes restored in the same task | All confirmed present at root after Task 2.1; www already had all of these (it was the source) | **Closed, both directions**, as verified during Task 2.1 |
| `farm-react.js` (`reports.html`, `settings.html`) | `fetch('/api/claude', ...)` | **Not applicable to file-sync at all** — this is a network call to serverless infrastructure, not a local file dependency. See Phase 1/B for why this can't be "closed" by syncing files | **Not a sync-closable dependency** — flagged as a standing platform gap, not a missing-file problem |
| `pages/notifications.js` (if ever un-orphaned) | Would need `ROLES`, `fbGet`, etc. from `shared.js`/`firebase.js` | Present in both, but recall these are themselves stale in www | Dependent on resolving Phase 1/A's `shared.js`/`firebase.js` sync first |

**Summary finding:** the sync boundary cannot simply be "copy every must-sync file independently" — `sw.js` specifically has a closure requirement (`offline-sync.js`) that is currently unmet, and would need to be part of the *same* sync operation, not a follow-up. This is the one concrete, provable dependency-chain gap found in this phase.

---

## PHASE 3 — Proposed Sync Contract

```
Source:        Root web repository (project root, as it exists at the time of sync)
Destination:   farm-apk/www/
Direction:     One-way only (root → www). farm-apk/www/ is never edited directly;
               any direct edit found there in the future should be treated as a
               process violation to investigate, not a legitimate parallel change.

Allowed paths (synced):
  /*.html                     (except the excluded list below)
  /styles.css
  /shared.js
  /firebase.js
  /nav.js
  /config.js
  /notifications-service.js
  /offline-sync.js            (currently missing from www — must be included
                                 the first time sw.js is ever synced)
  /manifest.json
  /pages/*.js                 (excluding files still under manual review — see
                                 Phase 1/D — until each is individually resolved)
  /sw.js                      (CONDITIONAL — see Failure Conditions below;
                                 not part of a default/automatic sync pass until
                                 the registration decision from Task 2.2 is made)

Excluded paths (never synced):
  /bayan.html, /bayan-offline.html   (root-only by design)
  /vercel.json
  /database.rules.json
  /FIREBASE_RULES_SETUP.md
  /package.json                     (root's own metadata, not a runtime file)
  /farm-apk.zip
  /api/**                          (serverless functions — categorically
                                     cannot be synced as static files)
  /FETCH_HEAD, /git                (non-project artifact files)
  /media/logo.png                  (currently dead/unused — excluded until
                                     something actually references it)

Validation rules:
  1. Before any sync completes, verify every file referenced inside sw.js's
     APP_SHELL array is also present in the destination — this is the one
     concrete closure gap already found (offline-sync.js) and the exact
     kind of check that would have caught it automatically.
  2. After sync, the set of "must sync" files (Phase 1/A) should be
     byte-identical between source and destination — any remaining diff
     indicates either a sync-tooling bug or an out-of-band edit to www.
  3. Files under manual review (Phase 1/D) are explicitly skipped by any
     sync pass until individually reclassified — a sync tool should log
     these as "skipped, pending review," not silently ignore them.

Failure conditions (should abort or explicitly flag, not silently proceed):
  - Any "must sync" file missing from source at sync time (indicates a
    root-repo problem, not a www problem).
  - sw.js selected for sync while offline-sync.js is not part of the same
    pass (the exact closure gap from Phase 2).
  - Any file in the Excluded list found already present in the destination
    from a prior non-compliant copy (e.g. today's vercel.json) — should be
    flagged for manual removal, not silently left in place indefinitely.
```

---

## PHASE 4 — Migration Safety

**What breaks if a file is missed?**
- Missing an HTML page: that specific page simply doesn't update for Android users — a stale-content problem (like `activity.html` was), not a crash. Low-to-medium severity, contained to one page.
- Missing `shared.js`/`firebase.js`/`nav.js`/`styles.css`: broad, app-wide staleness — every page that loads the missed file keeps running old logic/styling, effectively freezing large parts of the Android experience at an old version. This is the current, already-existing state for these exact files, so "breaking" here really means "continuing today's already-present condition."
- Missing `offline-sync.js` while syncing `sw.js`: the specific, provable Phase 2 finding — one precache entry silently fails, one feature (background sync of queued writes) never works on Android even after otherwise "fixing" the service worker.

**What breaks if extra files are copied?**
- Copying `vercel.json`/`database.rules.json`/`FIREBASE_RULES_SETUP.md`/`api/**` etc. into www: no runtime breakage (they're inert inside a Capacitor bundle — a WebView doesn't execute a Vercel serverless function file or read a Vercel routing config), but it does perpetuate the exact "wholesale copy" confusion already evidenced by today's stray `vercel.json` — a maintainability/clarity cost, not a functional one.
- Copying `api/claude.js` specifically would be actively misleading (it looks like it should work, but can never execute in this context) — worth explicit exclusion rather than "harmless clutter," since a future maintainer might reasonably but incorrectly assume its presence means the AI theme-designer feature works offline/on-device.

**How rollback works:**
- Since the proposed contract is file-copy-based (whichever mechanism eventually implements it — manual, script, or CI, per the prior Task 2.2.2 report), rollback is always a plain file-level `git revert` on `farm-apk/www/`'s changes — no database migrations, no build-state to unwind, no irreversible step anywhere in this contract as designed.
- The one place rollback needs extra care: if `sw.js` is ever synced and *registered* for the first time (a separate, larger decision than this task's scope), rolling back the registration itself would need the cache-clearing message handler (`CLEAR_DATA_CACHE`) already built into root's `sw.js` — meaning "roll back" in that specific case means "ship a new SW version that unregisters/clears," not just "revert the file," since service workers persist client-side until explicitly superseded. This nuance is flagged for whenever that separate decision is made, not addressed by this file-classification task.

---

## Output Summary

**1. Sync boundary map:** Root is the sole source; `farm-apk/www/` is the sole destination; direction is strictly one-way; `farm-apk/android/` remains entirely downstream of `www/` via the already-working `cap sync` mechanism (untouched by this proposal).

**2. File classification table:** See Phase 1 — categorized into Must Sync (≈40 files: all shared HTML + core JS/CSS/manifest), Must Never Sync (9 items: Vercel/Firebase-backend/packaging/documentation/serverless-function files, plus 2 stray non-project artifact files), Conditional (4 files pending product or prior-audit decisions), and Manual Review (4 files whose orphan/live status must be resolved before they can even be classified).

**3. Dependency requirements:** One confirmed, concrete closure gap — `sw.js`'s `APP_SHELL` requires `offline-sync.js`, which does not currently exist in `www` at all. Any future sync of `sw.js` must include this file in the same pass or the gap persists in a new form.

**4. Recommended sync contract:** Defined in full in Phase 3 — explicit allow-list, explicit exclude-list, three validation rules, three failure conditions.

**5. Risk assessment:** Classification itself carries no risk (nothing changed). The contract's *future execution* risk is concentrated in exactly one place: forgetting `offline-sync.js` when `sw.js` is eventually synced — every other risk in this analysis is either already-present staleness (not a new risk introduced by syncing) or inert clutter (excluded files causing confusion, not breakage).

**6. Waiting for approval. No files copied, no scripts created, no repositories or CI modified.**
