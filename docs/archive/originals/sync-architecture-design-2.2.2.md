# Sprint 2 — Task 2.2.2: Web → APK Sync Architecture Design (Investigation & Design Only)
**Status: No scripts created, no workflows modified, no files copied, no CI changed.**

---

## PHASE 1 — Repository Structure Analysis

```
root web source (Vercel-deployed, 31 HTML pages + shared JS/CSS)
        |
        ?  ← NO AUTOMATIC LINK EXISTS (confirmed in Task 2.2.1: no server.url,
        |     no copy script, no CI step bridging these two trees)
        |
farm-apk/www  (manually-maintained snapshot, last fully copied at an
        |      unknown earlier point — evidenced by files like vercel.json
        |      and manifest.json being byte-identical to root while most
        |      active-development files have since diverged)
        |
        ↓  `npx cap sync android`  (confirmed real, automatic, and correct —
        |   this is the one link in the chain that genuinely works)
        |
android build (native Gradle project under farm-apk/android/, entirely
               Capacitor-generated — confirmed zero manual edits expected
               or found in this structure)
```

### File classification

| Category | Files | Evidence |
|---|---|---|
| **Source files** (authored, platform-agnostic, should exist once conceptually) | All 29–31 HTML pages, `styles.css`, `shared.js`, `firebase.js`, `nav.js`, `config.js`, `sw.js`, `manifest.json`, `offline-sync.js`, `notifications-service.js`, `import-data.js`, all of `pages/*.js` | Zero Capacitor-specific API calls (`Capacitor.*`, `@capacitor/*`, `window.Capacitor`) found anywhere in `farm-apk/www/`'s HTML/JS — confirmed by an exhaustive grep. This is strong evidence the entire web codebase is already 100% platform-agnostic; nothing here was ever written specifically "for Android." |
| **Generated files** (must never be hand-maintained, produced entirely by tooling) | Everything under `farm-apk/android/` (`app/`, `build.gradle`, `gradle/`, `gradle.properties`, `settings.gradle`, `variables.gradle`) | Standard Capacitor native-project layout; `cap sync` regenerates the web-asset portion of this on every run |
| **Native-only files** (make sense only in the Android context, not shared with web) | None found among the JS/HTML/CSS layer — the Android-specific surface is entirely confined to `farm-apk/android/` and `farm-apk/capacitor.config.json` | Confirmed by the same platform-API grep above |
| **Files present in www that make no sense there** (evidence of a wholesale, non-curated original copy) | `farm-apk/www/vercel.json` (byte-identical to root's — a Vercel hosting config, meaningless inside an Android app bundle) | This is not harmful, but it's a clear signal: whoever first populated `farm-apk/www/` copied the *entire* root directory indiscriminately rather than a curated subset — useful context for Phase 2's classification below |
| **Files requiring a transformation before sync** (cannot be a byte-for-byte copy) | `farm-apk/capacitor.config.json` itself; potentially `manifest.json` if any Android-specific manifest fields are ever needed (none currently exist — today's copy is byte-identical to root's) | `capacitor.config.json` has no root-web equivalent at all; it's Android-only configuration, correctly not something to sync |

---

## PHASE 2 — Sync Candidate Analysis

| File / category | Classification | Reasoning | Current drift (from Task 2.2.1/prior audits) |
|---|---|---|---|
| All 29 shared HTML pages (excluding `bayan.html`/`bayan-offline.html`) | **Must sync** | Platform-agnostic, actively developed at root, directly affects what Android users see | Not individually diffed this pass, but `activity.html` alone was 285 lines out of sync until Task 2.1 |
| `bayan.html`, `bayan-offline.html` | **Must NOT sync** | Root-only by design — self-contained "official statement" documents; already absent from `farm-apk/www/` with no apparent negative effect, suggesting deliberate scoping | Confirmed absent from www; no evidence this was accidental |
| `styles.css` | **Must sync** | Single shared stylesheet, directly affects visual output on both platforms | 163-line drift (this session's entire Sprint 2 CSS work absent from www) |
| `shared.js` | **Must sync** | Central shared logic (modal system, theme, etc. per this project's own architecture docs) | **585-line drift — the largest of any file audited**, meaning www's copy predates a substantial portion of this app's current functionality, not just this session's work |
| `firebase.js` | **Must sync** | Core data-gateway file | 63-line drift |
| `nav.js` | **Must sync** | Shared navigation rendering | 15-line drift |
| `config.js` | **Must sync** (currently the one file that's actually in sync) | Confirms sync *can* stay clean when nothing has changed — this is the control case proving the other files' drift is a real maintenance gap, not an inherent impossibility | 0-line drift today |
| `notifications-service.js` | **Must sync** | Currently in sync, same reasoning as `config.js` | 0-line drift today |
| `sw.js` | **Conditional sync** | Only sync once the root-vs-www divergence question from Task 2.2.1 is resolved and a registration decision is made — blindly overwriting www's v4 with root's v5 before deciding *whether service workers should even be registered* would be premature | 178-line drift |
| `offline-sync.js` | **Requires a decision before it can even be classified** | **Does not exist in www at all.** Root's `sw.js` (v5) references it in both its header comment and its `APP_SHELL` list — if `sw.js` is ever synced to www without this file, the Android service worker would 404 on one of its own precache entries during `install` | Currently absent, not merely stale |
| `sync-to-excel.js` | **Requires manual review first** (per the earlier Sprint 2 dead-code audit) | Its live/dead status is still an open question from Task 2.2's predecessor investigation — sync should wait for that resolution | Absent from www |
| `import-data.js` | **Conditional sync** | This is a one-time data-seeding utility, not part of the running app's normal request path; whether Android needs its own copy at all is a product question, not purely technical | 127-line drift |
| `manifest.json` | **Must sync, but currently moot** | Confirmed identical today; low risk either way since neither copy is linked via `<link rel="manifest">` on either platform yet (per the prior Service Worker audit) | 0-line drift |
| `vercel.json` | **Must NOT sync** | Vercel-specific hosting configuration; has zero function inside a Capacitor-built native app | Present in www only as leftover evidence of a wholesale original copy, not because it does anything there |
| `pages/*.js` (feature scripts) | **Must sync**, individually, once each file's live/dead status is resolved (several are still open questions from the Sprint 2 dead-code audit — `pages/animal_detail.js`, `pages/notifications.js`, `pages/births.js`) | These are exactly the files whose orphaned/active status depends on *which* HTML actually loads them, which itself depends on which copy (root or www) is authoritative | `pages/births.js`: identical content, but only *used* by www's `births.html`. `pages/notifications.js`: 75-line drift between the two copies, on top of being unreferenced in both |

---

## PHASE 3 — Migration Options

### Option A — Manual controlled sync (a documented checklist, human-executed before each APK build)
- **Implementation complexity:** Very low — no tooling to build, just a written procedure (e.g. "before running `cap sync`, manually copy these N files from root to `farm-apk/www/`, excluding these M files").
- **Maintenance cost:** Ongoing and recurring — every future sprint's changes require someone to remember to run the checklist. This is exactly the process that already produced today's drift (585 lines out of sync in `shared.js` alone), so its historical failure mode is well-documented by this project's own current state.
- **Failure modes:** Forgetting a file; copying a file that shouldn't be copied (like `vercel.json` apparently was, historically); copying at the wrong time relative to other in-progress root changes, capturing a half-finished state.
- **Rollback strategy:** Trivial — `farm-apk/www/` is just files in a repo; reverting a bad manual copy is a normal file-level revert, no different from any other change.

### Option B — Local sync script (a script a developer runs manually, e.g. `npm run sync-apk`, not wired into CI)
- **Implementation complexity:** Low-medium — a script encoding the same include/exclude rules as Option A, but executed by tooling instead of human memory for the *mechanics* of copying (though a human still decides *when* to run it).
- **Maintenance cost:** Lower than Option A for the copying itself, but the include/exclude list still needs updating whenever a new root-only or www-only file appears (e.g. if a second `bayan*`-style root-only page is added later, the script's exclude list needs a matching update).
- **Failure modes:** The script's exclude/include list going stale is now the single point of failure, replacing "a human forgot" with "the list wasn't updated" — a narrower, more diagnosable failure than Option A's, but not eliminated.
- **Rollback strategy:** Same as Option A — file-level revert; additionally, since the script's logic is itself version-controlled, a bad script change can also be reverted independently of any specific sync run it caused.

### Option C — CI automated sync (the GitHub Actions workflow itself gains a "copy root web files into www" step, run automatically on every build)
- **Implementation complexity:** Medium — requires the workflow to have access to the root website's files, which is a real architectural question given `farm-apk/.github/workflows/build-apk.yml` currently only checks out the `farm-apk` repository itself (per Task 2.2.1's finding). If the root website lives in a *separate* repository (as this project's documentation describes: "two repos"), this option requires either (a) the workflow checking out a second repository as an additional step, or (b) restructuring so both live in one repository. This is a bigger architectural decision than Options A/B, not just a bigger script.
- **Maintenance cost:** Lowest ongoing cost once correctly set up — the human-memory failure mode is removed entirely, replaced by a mechanical, version-controlled step that runs identically every time.
- **Failure modes:** A misconfigured include/exclude list would now affect *every single build* automatically rather than one manual copy at a time — meaning a mistake here has broader, more immediate reach (for better or worse: bugs are caught faster because every build is affected identically and visibly, but a bad config also can't be "just this once" contained to a single manual mistake).
- **Rollback strategy:** Revert the workflow-file change; because the sync step is now code, this is a normal, auditable git revert on the CI configuration itself, arguably the cleanest rollback story of the three options.

---

## PHASE 4 — Recommended Architecture

**Source of truth:** Root web repository. This is the only conclusion consistent with the evidence across every task in this Sprint 2 investigation chain — root is newer on every drifted file found (`sw.js`, `styles.css`, `firebase.js`, `nav.js`, `shared.js`, `import-data.js`), and it's where all current and prior development effort has concretely happened.

**Sync direction:** One-way, root → `farm-apk/www/`, always. Never the reverse. `farm-apk/www/` should be treated as a **build artifact of root**, not an independently-editable location — any change made directly inside `farm-apk/www/` (as apparently happened at least once historically, given the divergence) is exactly the failure mode to design against.

**Ownership model:** Root files are owned and edited by whoever is doing web/app development (i.e., this entire Sprint 2 effort's audience). `farm-apk/www/` should have no independent owner at all — it should be regenerated, not edited, every time an Android build is needed. The only genuinely Android-owned artifacts are `farm-apk/capacitor.config.json` and everything under `farm-apk/android/`.

**Validation strategy (to catch drift going forward, regardless of which sync option is eventually chosen):**
- A simple, periodic diff-based check (could be as lightweight as re-running the same `diff` commands used throughout this investigation chain) comparing root vs. `farm-apk/www/` for the "must sync" file list from Phase 2, to catch drift *before* it accumulates to 585 lines again.
- Any file newly added to root that logically belongs in the "must sync" category (a new shared HTML page, a new shared JS module) should trigger an explicit decision (sync / don't sync / conditional) at the time it's created, rather than being discovered as drift months later — this is a process recommendation, not a technical one.
- Given `offline-sync.js`'s complete absence from www is a real functional gap (not just staleness) tied directly to `sw.js`'s own `APP_SHELL` list, any future `sw.js` sync must be validated against "does every file this service worker references actually exist on the target platform" — a very cheap, mechanical check that would have caught this specific gap immediately.

---

## Output Summary

**1. Current architecture diagram:** See Phase 1 — root and `farm-apk/www/` are two independently-edited trees connected only by an unreliable, undocumented human-copy step; the only automatic, trustworthy link in the whole chain is `cap sync`'s `www/ → android/` step, which works exactly as designed.

**2. Drift causes:** No automated or enforced synchronization mechanism has ever existed between root and `farm-apk/www/`. The presence of byte-identical control files (`config.js`, `notifications-service.js`, `manifest.json`, and even the irrelevant `vercel.json`) alongside heavily-diverged active-development files (`shared.js` at 585 lines, `sw.js` at 178, `styles.css` at 163) is consistent with a single full copy at project setup time, followed by zero systematic re-synchronization since — individual files only stayed in sync by coincidence (not having been touched at root since that initial copy), not by process.

**3. Recommended sync model:** Root as sole source of truth, one-way sync to `farm-apk/www/`, with `farm-apk/www/` treated purely as a regenerable build artifact rather than an editable location. Of the three options, **Option C (CI-automated) is the strongest long-term fit** given it directly eliminates the human-memory failure mode that produced today's drift — but it also requires resolving a real cross-repository architecture question first (per Task 2.2.1: the project is documented as "two repos," which Option C's workflow would need to bridge). **Option B is the pragmatic middle step** if a cross-repo CI change is out of scope for now — it at least converts "remember to copy N files" into "run one command," directly reducing (though not eliminating) the failure mode.

**4. Migration steps (proposed only, not executed):**
   1. Resolve the `sw.js` registration and offline-sync.js gap questions from Tasks 2.2/2.2.1 first — syncing a service worker that references a nonexistent file would introduce a new, worse bug.
   2. Decide on Option A/B/C.
   3. Define the definitive include/exclude file list (Phase 2's table is a first draft).
   4. Perform one full, careful, manually-reviewed catch-up sync to bring `farm-apk/www/` current with root.
   5. Put the chosen ongoing mechanism (checklist, script, or CI step) in place so the catch-up in step 4 doesn't silently become "the last time this ever happened," repeating today's history.

**5. Files affected (if this design is later approved and executed):** `shared.js`, `firebase.js`, `nav.js`, `styles.css`, `sw.js` (conditional), `offline-sync.js` (net-new to www), `import-data.js` (conditional), all `pages/*.js` files pending their individual live/dead resolution, and potentially `farm-apk/.github/workflows/build-apk.yml` if Option C is chosen.

**6. Risk assessment:** The *design* in this report carries no risk (nothing was changed). Of the three options: **A = Medium ongoing risk** (recurrence of today's exact problem), **B = Low-Medium** (narrower, more diagnosable failure surface), **C = Low ongoing risk, Medium one-time setup risk** (getting the include/exclude list and cross-repo access right at the start).

**7. Waiting for approval before any script, workflow change, or file copy is made.**
