# Sprint 2 — Task 2.2.5: Conditional Sync Review (Investigation Only)
**Status: No manifest changes, no execute sync, no file copies, no code changes.**

---

## PHASE 1 — Conditional Files Audit

### `sw.js`
- **Purpose:** Offline caching / PWA service worker (already extensively audited in Tasks 2.2/2.2.1).
- **Runtime environment:** Both platforms, if ever registered — confirmed still unregistered anywhere.
- **Android dependency:** None currently activates it; www's copy (v4) is what would ship if it were ever registered as-is.
- **Web dependency:** Root's copy (v5) is more capable but also unregistered.
- **Belongs in `farm-apk/www`?** Yes, conceptually — but sync should remain blocked until the registration decision (Task 2.2) is made, exactly as already classified.
- **Classification: NEEDS DECISION** (unchanged from prior tasks — nothing new resolves this here).

### `import-data.js` — **reclassification required**
- **Purpose:** One-time Firebase data-seeding script matching a specific farm-inventory statement (per its own header comment).
- **Runtime environment:** Browser, loaded directly by a page.
- **Android dependency: CONFIRMED — `farm-apk/www/import.html:52` loads it via `<script src="import-data.js">`.**
- **Web dependency: CONFIRMED — root `import.html:52` loads it identically.**
- **This file is NOT dead or optional — it is live on both platforms.** My own earlier classification of it as merely "conditional" was too cautious; it should have been `always_sync` from the start.
- **Critical finding:** the two copies encode **different actual farm data**. Root's header: *"بيان ٢٠٢٦/٠٤/٢٤ — الإجمالي: 440 رأس"*. www's header: *"بيان ٢٠٢٦/٠٤/٠٤ — Total: 462 animals"*. This is not code drift — it's **business-data drift**. Anyone using the Import feature inside the Android app today would seed the *previous, superseded* farm inventory statement (462 animals) instead of the current one (440 animals) that root already reflects.
- **Belongs in `farm-apk/www`?** Yes, unambiguously, and urgently.
- **Classification: APPROVE SYNC** (reclassify from `conditional` to `always_sync`).

### `sync-to-excel.js` — **reclassification required**
- **Purpose:** Per its own header comment, this is **not a page script at all** — it's a standalone snippet meant to be manually pasted into a browser's DevTools console ("افتح أي صفحة... افتح DevTools → Console والصق هذا الكود كله مرة واحدة"). It performs a one-time console-driven data-reconciliation task against a specific Excel export target.
- **Runtime environment:** Developer's browser console, on-demand, never loaded by any page.
- **Android dependency:** None — confirmed absent from www, and correctly so, since it was never meant to be a page dependency anywhere.
- **Web dependency:** Same — present at root but not loaded by any `<script src>`, by design.
- **Belongs in `farm-apk/www`?** No — it doesn't belong in *either* platform's page-load path; its presence in the root repo at all is more of a "developer utility kept for reference" than an application file.
- **Classification: REJECT SYNC** (this isn't really a "conditional" file — it's categorically not a sync candidate, similar in spirit to `api/**`, just not backend code specifically. Recommend moving it to `EXCLUDE` rather than leaving it in `conditional` limbo).

### `media/logo.png`
- **Purpose:** Unknown/unrealized — an image asset with zero references anywhere (confirmed by exhaustive grep across all HTML/JS in both root and www, repeated in this pass with the same result as the earlier audit).
- **Runtime environment:** N/A — never requested by any page.
- **Android dependency / Web dependency:** None.
- **Belongs in `farm-apk/www`?** Harmless either way since nothing references it, but syncing a confirmed-dead asset accomplishes nothing.
- **Classification: NEEDS DECISION** — not a technical question but a product one: is this logo meant to replace the current inline-SVG manifest icons at some point? If yes, it's a future `always_sync` candidate once wired up. If it's simply an abandoned asset, it belongs in `EXCLUDE`. Cannot resolve this without asking the project owner directly.

---

## PHASE 2 — Manual Review Files Audit

### `pages/animal_detail.js`
- **Diff root vs. www:** Byte-identical (0-line diff, confirmed in Task 2.2.1) — both copies are equally stale/unused.
- **Feature ownership:** Compared its function names (`renderAnimalDetail`, `renderBreedingSection`, `renderHealthSection`, `renderWeightSection`, `loadAll`, `emptyState`) against `animal-detail.html`'s current inline script (`renderDetail`, `renderWeightTable`, `openAddMedication`, `openAddVaccination`, `openAddOffspring`, `openUpdatePregnancy`, `openEditAnimal`, `openRemoveAnimal`, `getPregnancyLabel`, `calcAge`). **Only `calcAge` is shared by name; every other function is entirely different.** This is strong evidence of a complete rewrite, not a partial subset — the live page was rebuilt from scratch under a different internal structure, and this file is what it replaced.
- **Dependencies:** Same shared globals (`requireAuth`, `initFirebase`, `getSettings`) as the live implementation — structurally compatible with the app, just an earlier full implementation.
- **User impact of syncing:** None either way — it's not loaded by any page on either platform, so syncing changes nothing observable.
- **Risk of syncing:** Low (it wouldn't execute), but syncing dead weight for no reason adds confusion for future maintainers.
- **Classification: SHOULD REMAIN SEPARATE** — specifically, recommend **archiving** (not syncing, not deleting outright) given its size and the possibility — not confirmed, but not ruled out — that some specific calculation inside it was never ported to the rewrite. A full line-by-line business-logic diff (not just function-name comparison) is the appropriate next step, but that's beyond this investigation-only task.

### `pages/notifications.js`
- **Diff root vs. www:** 75 lines different between the two copies (confirmed in Task 2.2.1) — meaning even this orphaned file kept being edited in at least one location after the fork, without ever being wired into a live page in either.
- **Feature ownership:** Function names (`generateNotifs`, `renderNotifPage`, `catIcon`, `linkFor`, `twoWeeksAgo`, plus `window.clearAllNotifs`/`deleteOneNotif`/`filterBy`/`goTo`/`markAllRead`/`markOneRead`/`toggleRead`) show no overlap at all with the live `notifications-service.js` (which uses a different internal style entirely, not matched by simple `function name(` pattern-matching — likely a more modern object/class or arrow-function structure).
- **Dependencies:** Not individually traced further in this pass — the naming mismatch alone is strong enough evidence of "different implementation," not "missing piece."
- **User impact of syncing:** None currently (unloaded on both platforms).
- **Risk of syncing:** Low, same reasoning as `pages/animal_detail.js`.
- **Classification: SHOULD REMAIN SEPARATE** (archive candidate) — and specifically, **do not use www's copy as any kind of reference for "the real Android behavior,"** since it was never live there either; the 75-line divergence between two equally-dead copies is not meaningful drift to resolve, just accumulated abandoned edits.

### `pages/births.js` — **most consequential finding in this phase**
- **Diff root vs. www:** Byte-identical (0-line diff, confirmed in Task 2.2.1).
- **Feature ownership:** This file implements a rich, distinct **births-analytics view** — pattern-based SVG/canvas chart rendering (`makePattern`, `drawCharts`), age-group breakdowns (`renderAgeGroups`, `ageGroup`, `calcAgeDays`), breed-card summaries (`renderBreedCards`), a weaning alert (`renderWeaningAlert`), and KPIs (`renderKPIs`) — none of which exist under these names in the current root `births.html`, which instead has its own simpler `getBirths`/`isBirth` helpers and relies on `openUnifiedBirthModal` (defined centrally in `shared.js`) for the actual birth-registration workflow.
- **Confirmed live usage: `farm-apk/www/births.html` loads this file via `<script src="pages/births.js">`.** Root's `births.html` does not.
- **User impact of syncing (or rather, of the *current*, unsynced state):** **This is the one file in this entire review where "impact" is not hypothetical — it is happening right now.** Android users viewing the Births page today are seeing a visually and functionally different feature (chart-driven analytics with pattern-fill visualizations) than web users see on the same nominal page. This isn't a sync gap to close by copying a file — copying *nothing* here is correct, because the two `births.html` files are **intentionally or unintentionally divergent UIs**, and "syncing" would mean deciding which UI wins, not just moving a file.
- **Risk of syncing this file to make root match www:** Would require also porting root's `births.html` markup/structure to call this file's functions instead of its current inline logic — a real feature-parity decision, not a mechanical sync.
- **Risk of *not* addressing this:** The web/Android births experience will keep silently diverging with every future change to either implementation.
- **Classification: REQUIRES MERGE** — but "merge" here means a **product decision** (which births-page design should be canonical) before any technical sync work, not a file-copy operation. This is fundamentally different from the other three manual-review files, which are simply dead on both platforms.

### `chat.js` — **reclassification required, different category entirely**
- **Diff root vs. www:** Byte-identical (0-line diff).
- **Feature ownership:** This is **not a client-side page script at all.** Its own header comment: *"Vercel Serverless Function — Anthropic API Proxy, Path: /api/chat.js"*, and its code uses `export default async function handler(req, res)` — the exact same Vercel serverless-function signature as the confirmed `api/claude.js`. **This file is sitting in the wrong location** (project root) rather than under `/api/` where Vercel would actually recognize and deploy it as a serverless endpoint.
- **Dependencies:** `process.env.ANTHROPIC_API_KEY` — a Vercel-only server-side environment variable, meaningless in a static file context.
- **User impact of syncing:** None — like `api/claude.js`, this cannot execute inside a Capacitor WebView or as a plain static asset in `farm-apk/www` regardless of location.
- **Risk of syncing:** Same category-error risk already flagged for `api/claude.js` in Task 2.2.3 — it would sit there inertly, potentially misleading a future maintainer into thinking some chat-proxy capability exists on-device when it cannot.
- **Classification: SHOULD REMAIN SEPARATE**, but more precisely: **this shouldn't be classified as a "manual review" web-vs-Android file at all — it's a misplaced serverless function**, the same category as `api/claude.js` and belongs with that group in `EXCLUDE`, not in the web-vs-APK feature-parity conversation this phase was designed for. (Separately, and outside this task's scope: whether this file should be *moved* to `api/chat.js` to actually function, or whether it's a fully superseded predecessor of `api/claude.js`, is a real open question for the project owner — the two files serve suspiciously similar purposes.)

---

## PHASE 3 — Unknown Files Analysis

### `sync.js`
- **Origin:** A self-contained, purpose-built diagnostic widget — renders a "sync status" indicator (`#sync-widget`) comparing cached vs. live Firebase counts across categories (goats, sheep, goat births, sheep births, dead animals), with a manual re-check button.
- **Purpose:** Confirmed distinct from `offline-sync.js` (which handles IndexedDB write-queueing) — this is a **read-side data-freshness indicator**, an entirely different concern that happens to have a superficially similar filename.
- **Whether it should exist:** The code itself is coherent and complete — it's not broken or half-written. But **its target DOM element, `#sync-widget`, does not exist in any HTML page, root or www** (confirmed by an exhaustive grep). This means the file is a fully-built feature that was never actually placed on any page.
- **Should it be ignored permanently?** Not necessarily "permanently" — it looks like a small, ready-to-use widget someone built and then never inserted a `<div id="sync-widget">` for. Recommend flagging this specifically for the project owner as "a built feature that's one `<div>` away from being live" rather than writing it off as dead weight.

### `animal-detail.html.bak`
- **Origin:** A `.bak` extension strongly indicates an editor- or developer-created backup, most likely saved manually before an edit to `farm-apk/www/animal-detail.html` at some point.
- **Purpose:** Confirmed to differ from the current `farm-apk/www/animal-detail.html` by 223 lines — a real, substantial earlier snapshot, not a trivial or automatic artifact.
- **Whether it should exist:** No — a `.bak` file has no runtime purpose (never requested by any page, never referenced anywhere) and its historical value is fully superseded by git's own version history (assuming this project is normally tracked in git, per the earlier finding that this specific extracted copy simply lacks a `.git` folder).
- **Should it be ignored permanently?** Yes — recommend this be a straightforward deletion candidate, separate from the sync-contract question entirely (it's not a "should this sync" question, it's a "should this exist in the repo at all" question).

---

## PHASE 4 — Updated Sync Contract Proposal

```
ALWAYS_SYNC:
  (unchanged from the current manifest, plus:)
  + import-data.js        ← RECLASSIFIED from conditional. Confirmed live on both
                             platforms via <script src>, and currently encodes
                             materially different farm data between the two —
                             this is now the single highest-priority sync item
                             of everything reviewed in this task.

CONDITIONAL:
  - sw.js                 ← unchanged, still blocked on the registration decision
  - media/logo.png        ← unchanged, still blocked on a product decision
                             (revive vs. abandon), technically harmless either way

MANUAL_REVIEW:
  - pages/animal_detail.js   ← unchanged classification, archive recommended
  - pages/notifications.js   ← unchanged classification, archive recommended
  - pages/births.js          ← unchanged tier name, but reclassified in spirit:
                                this is NOT a stale-file problem, it's a live
                                feature-parity gap between platforms requiring
                                a product decision, not a sync operation
  - chat.js                  ← RECLASSIFIED — moving out of this tier entirely,
                                see EXCLUDE below

EXCLUDE:
  (unchanged from the current manifest, plus:)
  + sync-to-excel.js      ← RECLASSIFIED from conditional. Confirmed to be a
                             manually-pasted console utility, never a page
                             dependency on either platform — doesn't belong
                             in the web-vs-APK sync conversation at all
  + chat.js                ← RECLASSIFIED from manual_review. Confirmed to be
                              a misplaced Vercel serverless function (same
                              category as api/claude.js), not a client page
                              script — cannot execute in farm-apk/www regardless
  + animal-detail.html.bak ← New: not a sync candidate at all, a deletion
                              candidate (separate from this contract's scope)
  + sync.js                ← New: while not harmful to leave alone, its true
                              status ("dead" vs. "one <div> away from live")
                              is a product question, not resolved by inclusion
                              in any sync tier — recommend excluding from the
                              sync contract and flagging separately for a
                              product decision on whether to wire it up
```

---

## PHASE 5 — Risk Assessment

| Proposed change | Affected users | Possible regression | Rollback method |
|---|---|---|---|
| Move `import-data.js` to `ALWAYS_SYNC` | Anyone using the Import feature inside the Android app | None expected — this closes a real data-accuracy gap (462 vs. 440 animals) rather than introducing one; the only "regression" would be if Android's older 462-animal dataset was somehow intentionally preserved for a reason not evidenced anywhere in this investigation | Standard file revert via the sync tool's own git-tracked destination changes (per Task 2.2.4's rollback model) |
| Move `sync-to-excel.js` to `EXCLUDE` | None — it was never loaded by any page on either platform | None — this is a classification correction, not a behavior change | N/A, no file movement involved, purely a manifest-tier relabeling |
| Move `chat.js` to `EXCLUDE` | None currently — confirmed inert on both platforms | None | Same as above |
| Leave `pages/births.js` in `MANUAL_REVIEW` pending a product decision | **Android users specifically** — they are the ones currently experiencing the divergent chart-based births view | Risk is not from this recommendation but from the *status quo continuing indefinitely* without a decision — every sprint that passes without resolving which births UI is canonical widens the platform gap further | N/A — this recommendation changes no code; rollback is not applicable because nothing is being executed |
| Leave `sw.js` and `media/logo.png` in `CONDITIONAL` | No change from current state | None — purely maintains the existing, already-approved holding pattern from prior tasks | N/A |
| Flag `sync.js` and `animal-detail.html.bak` outside the sync contract entirely | No change from current state (both already unsynced and inert) | None | N/A |

---

## Output Summary

**1. File classification report:** See Phases 1–3 in full above. Two files required outright reclassification (`import-data.js` → approve/always-sync; `sync-to-excel.js` and `chat.js` → reject/exclude, revealed to be a developer console utility and a misplaced serverless function respectively, not genuine web-vs-APK sync questions at all). `pages/births.js` was found to be the one file in this entire review representing a **live, user-facing feature divergence** rather than dead code.

**2. Recommended sync contract update:** See Phase 4 — one file added to `always_sync` (high priority: real data drift), two files moved out of the sync conversation entirely into `exclude` (they were never real candidates), and two newly-discovered files (`sync.js`, `animal-detail.html.bak`) added as explicitly-excluded/flagged-for-separate-decision items.

**3. Risks:** Concentrated almost entirely in `import-data.js` (positive risk reduction — closes a real data-accuracy gap) and `pages/births.js` (an open product-decision risk that this task can surface but not resolve).

**4. Waiting for approval before any manifest edit, sync execution, or file change.**
