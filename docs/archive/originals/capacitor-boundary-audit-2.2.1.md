# Sprint 2 — Task 2.2.1: Capacitor Boundary Audit (Investigation Only)
**Status: No files modified, synced, or registered. Investigation only, per task rules.**

---

## PHASE 1 — Capacitor Configuration Audit

| Question | Finding | Evidence |
|---|---|---|
| Does Android load a remote `server.url`, or local bundled assets? | **Local bundled assets — confirmed definitively.** | `farm-apk/capacitor.config.json` has `"webDir": "www"` and **no `server` key contains a `url` field at all** (`server` only has `androidScheme` and `cleartext`, both standard WebView security settings, not a remote-loading directive). Capacitor's documented behavior when no `server.url` is set is to package `webDir`'s contents into the native app bundle and load them from local storage on-device. |
| Is `farm-apk/www` generated or manually maintained? | **Manually maintained — confirmed by the build pipeline (Phase 2) containing no generation/copy step.** | See Phase 2 |
| Is it copied from the web root automatically? | **No automatic copy mechanism exists anywhere in this repository.** | No `.sh` scripts found project-wide; no copy/sync command in any `package.json` (root, `farm-apk/`, or `farm-apk/www/`); the CI workflow (Phase 2) never touches the root web files at all |
| What is the runtime entry point? | `farm-apk/www/index.html`, per Capacitor's standard `webDir`-root convention (same redirect-to-`dashboard.html`/`login.html` logic as the root site's `index.html`) | Confirmed both files exist and follow the same pattern |

**This directly contradicts a previously-documented project assumption** ("Capacitor's `server.url` mirrors the live site so web updates reflect in the APK without rebuilding"). The actual `capacitor.config.json` on disk has no such configuration. This is stated as a factual correction, not a criticism — configurations can change over time, and the documentation may simply be out of date relative to the current file.

---

## PHASE 2 — Build Pipeline Audit

**Found:** `farm-apk/.github/workflows/build-apk.yml` — a GitHub Actions workflow, triggered on push to `main`/`master` or version tags, or manual dispatch.

**Exact steps, in order:**
1. `actions/checkout@v4` — checks out **the repository this workflow lives in**, i.e. the `farm-apk` project (per its own file path, `farm-apk/.github/workflows/`), not the main website repository.
2. Setup Java 17, Setup Node 18.
3. `npm ci` — installs dependencies from `farm-apk/package.json` (Capacitor CLI packages only).
4. `npx cap sync android` — this is the **only** "sync" step in the entire pipeline. Capacitor's `sync` command copies `webDir` (`www/`, whatever is currently committed in the checked-out repo) into the native Android project (`android/app/src/main/assets/public/`) — it does **not** fetch anything from an external source; it operates purely on what's already in the repo at checkout time.
5. `./gradlew assembleDebug` — builds the APK from the native project (which now contains a copy of whatever was in `www/` at checkout).
6. Rename, upload as artifact, and (on version tags) build a signed release APK the same way.

**Answering the diagram directly:**
```
Source: farm-apk/www (as committed to the farm-apk repository)
      |
      ↓
android/app/src/main/assets/public  (via `cap sync`)
      |
      ↓
Built APK
```
There is **no** `root web files → farm-apk/www` step anywhere in this pipeline. `farm-apk/www/` must be updated by hand (a manual copy-and-commit) whenever the maintainer wants the Android app to reflect changes made to the main website.

---

## PHASE 3 — File Ownership Matrix

| File | Location(s) | Owner/Source | Used by | Status |
|---|---|---|---|---|
| `index.html` | Root + `farm-apk/www/` | Manually maintained in each location separately | Root: Vercel web visitors. www: `cap sync` → APK's bundled assets | Present in both; not diffed line-by-line in this pass, but both follow the same redirect pattern |
| `sw.js` | Root (v5) + `farm-apk/www/` (v4) | Manually maintained separately — **confirmed diverged**, see prior Task 2.2 report | Root: would affect web visitors *if* ever registered. www: would affect APK users *if* ever registered — and per Phase 1/2, **www's copy is what genuinely ships inside the built APK**, not root's | **Diverged, and now confirmably "live" for Android specifically** (contingent only on whether/when registration is ever added — see below) |
| `manifest.json` | Root + `farm-apk/www/` | Manually maintained separately, not diffed line-by-line this pass | Neither is linked via `<link rel="manifest">` anywhere (per prior audit) — moot for now in both locations | Present in both, unlinked in both |
| `styles.css` | Root + `farm-apk/www/` | Manually maintained separately | Root: web. www: APK, **as it existed at the time www was last manually updated** — confirmed stale relative to root by 163 diff-lines in the prior Task 2.1 investigation (all of this session's Sprint 2 CSS work is absent from www's copy) | **Diverged — www is behind root** |
| `firebase.js` | Root + `farm-apk/www/` | Manually maintained separately | Same pattern | **Diverged — 63 lines different**, not yet characterized further in this pass (which side has which logic was not analyzed here; flagged for a dedicated diff if this file's behavior ever needs to be reconciled) |
| `config.js` | Root + `farm-apk/www/` | Manually maintained separately | Same pattern | **Identical — 0 lines different.** The one file checked in this pass with no drift |
| `nav.js` | Root + `farm-apk/www/` | Manually maintained separately | Same pattern | **Diverged — 15 lines different** |
| `bayan.html` / `bayan-offline.html` | Root only | Root-only by design (not present anywhere under `farm-apk/www/`) | Web only | **Intentionally absent from the APK**, not drift — these are the self-contained "official statement" documents; their exclusion from the Android bundle looks like a deliberate scoping choice rather than an oversight, though this wasn't confirmed with the project owner |
| `pages/births.js` | Root + `farm-apk/www/pages/` | Manually maintained separately, byte-identical (0-line diff, confirmed in the prior Task 2.1 investigation) | **www: actively loaded via `<script src>` in `farm-apk/www/births.html`. Root: not loaded by root's `births.html`.** Given Phase 1/2's finding, this means the file is genuinely executing for real Android users today | Diverged in *usage* (not content) between the two platforms |
| `activity.html` | Root (just restored, Task 2.1) + `farm-apk/www/` | www was the source used to restore root, per Task 2.1 | Both now functionally equivalent, since root was copied from www verbatim | **Now in sync** (as of Task 2.1) — the one file in this table with confirmed, recent, deliberate synchronization |

---

## PHASE 4 — Drift Analysis

**Why v5 and v4 (and the broader root/www split) diverged:** the build pipeline (Phase 2) proves there is no automatic synchronization mechanism between the root website and `farm-apk/www/`. Every file that exists in both locations is, by construction, two independent copies that only stay identical if a human manually re-copies one over the other after every meaningful change. Given `config.js` is the only 0-diff file found in this pass, and every other cross-referenced file (`styles.css`, `firebase.js`, `nav.js`, `sw.js`) shows real divergence, the evidence points to `farm-apk/www/` having been updated only occasionally — likely at the time the Android project was first set up or at isolated later points — rather than kept continuously in sync with root.

**Which one is newer:** **Root, on every file checked in this pass and the prior two reports** (`styles.css`, `sw.js`, and by strong inference `firebase.js`/`nav.js` given the same pattern, though their specific content differences weren't characterized line-by-line here). Root is where this session's active development work has been happening; `farm-apk/www/` reflects an earlier snapshot.

**Which one should become authoritative:** This is a judgment call the task explicitly reserves for a decision, not this investigation — but the evidence leans toward **root should become the authoritative source going forward**, given it is confirmed newer across every compared file, and is where ongoing work (this entire Sprint 2 effort) is happening. The complication is Phase 1/2's finding: **`farm-apk/www/` is what actually ships to Android users today**, regardless of which one is conceptually "more correct" — so becoming authoritative in practice requires a sync step to exist, not just a decision on paper.

**What users are affected:**
- **Web users (Vercel):** affected only by root's state — already receiving this session's Sprint 2 work (card/modal/token unification, dead-code cleanup, the restored `activity.html`).
- **Android/APK users:** affected only by whatever was last manually copied into `farm-apk/www/` and subsequently built via the GitHub Actions workflow — meaning they do **not** have this session's Sprint 2 CSS work, do **not** have the restored `activity.html` fix (their copy already worked, so this is moot for them specifically), and **do** have the older `sw.js` (v4) and older `firebase.js`/`nav.js` logic.

---

## PHASE 5 — Recommendation

### Option A — Keep root as source of truth (require an explicit sync-to-www step before each APK build)
- **Pros:** Matches where active development already happens; requires no change to the CI workflow's build logic, only an added "copy web files into www/ before `cap sync`" step; keeps a single mental model ("root is truth, www is a build artifact of root").
- **Cons:** Requires someone to actually add and maintain that copy step (currently doesn't exist anywhere, per Phase 2); until it's added, the manual-copy discipline that already produced today's drift would need to continue or be automated.
- **Risk:** **Low**, if a copy step is added to the CI workflow itself (so it happens automatically on every push, removing the human-memory dependency that caused today's drift). **Medium**, if the intent is to keep manually copying by hand — the same failure mode that created the current divergence would likely recur.

### Option B — Keep `farm-apk/www` as source of truth (treat it as the "stable/released" branch, root as "in-development")
- **Pros:** No change needed to the existing build pipeline at all; matches a "release branch" mental model some teams intentionally use.
- **Cons:** Directly contradicts where all actual development effort (including this entire multi-session refactor) has been happening; would mean deliberately shipping older, less-maintained code to Android users indefinitely unless changes are backported from root to www — the reverse of the natural direction of work.
- **Risk:** **High** — freezing progress at an already-stale snapshot while continuing to develop root would only widen the gap over time, and the Android app would fall further behind with every future sprint.

### Option C — Generate `www` automatically (build step copies root → www before `cap sync`)
- **Pros:** Removes the human-memory dependency entirely — the exact failure mode that produced today's drift (`config.js` synced once and left alone; `styles.css`/`firebase.js`/`nav.js`/`sw.js` diverged over time) cannot recur once copying is automatic; root remains the single conceptual source of truth *and* the CI enforces it mechanically.
- **Cons:** Requires updating the GitHub Actions workflow (an actual pipeline change, not just a file edit — bigger than this task's current investigation-only scope); needs a decision on *which* root files are eligible for the Android build (e.g. `bayan.html`/`bayan-offline.html` appear intentionally excluded today — an automatic blanket copy would need an explicit exclude-list to preserve that, or it would change from "not yet a problem" to "a real regression the moment automation is added carelessly).
- **Risk:** **Low-Medium** — the risk is concentrated entirely in getting the exclude-list right once, not in the ongoing operation of an automated copy step, which is inherently more reliable than manual copying once correctly configured.

---

## Output Summary

**1. Architecture finding:** `farm-apk/www/` is a manually-maintained, statically-committed snapshot of the web app — **not** auto-generated, and **not** loaded via a remote `server.url` (contradicting a prior project-documentation assumption). The GitHub Actions build pipeline (`farm-apk/.github/workflows/build-apk.yml`) builds the APK entirely from whatever is currently committed under `farm-apk/www/`, with zero step that pulls from the root website repository.

**2. Source of truth recommendation:** Root is the de facto newer, more actively maintained copy across every file checked (`styles.css`, `sw.js`, `nav.js`; `config.js` is the sole exception, currently identical). Root should become the *authoritative* source, but doing so meaningfully requires a real sync mechanism (Option A or C) — declaring root "authoritative" without one would leave today's exact problem unchanged for the next sprint.

**3. Migration options:** A (manual/CI-scripted copy step, root→www, before each build), B (freeze on www as-is, not recommended — see risk), C (fully automated copy step in CI, with an explicit exclude-list for root-only files like `bayan*.html`).

**4. Risk analysis:** Option A: Low if automated, Medium if left manual. Option B: High (widens drift over time). Option C: Low-Medium (one-time exclude-list correctness is the only real risk).

**5. Files potentially affected** (if any option is later approved and executed): every file shown as "Diverged" in the Phase 3 matrix — `sw.js`, `styles.css`, `firebase.js`, `nav.js` — plus, if Option C is chosen, the `farm-apk/.github/workflows/build-apk.yml` pipeline itself would need a new step added.

**6. Waiting for approval. No files were modified, synced, or registered in this investigation.**
