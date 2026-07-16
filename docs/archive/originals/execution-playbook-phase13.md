# Engineering Execution Playbook — PHASE 13
**Role:** Principal Staff Engineer / Lead Refactoring Engineer / Release Manager
**Status:** Implementation manual. Every finding and every sprint from the Design System Audit, Architecture Audit, and Engineering Refactoring Blueprint (Phase 12) is accepted as fact and reused directly — nothing here re-analyzes, re-scores, or re-plans at the roadmap level. This document answers one question only: *how does an engineer actually execute Sprint 1 through Sprint 6, commit by commit, PR by PR, with zero downtime.*

---

# 1. Sprint Backlog

## Sprint 1 — Investigation & Decisions

| Task | Objective | Files Touched | Prerequisite | Order | Expected Commits | Est. LOC Affected | Rollback Point | Verification Checklist |
|---|---|---|---|---|---|---|---|---|
| 1.1 | Diff `pages/animal_detail.js` against `animal-detail.html`'s inline `<script>` logic | `pages/animal_detail.js`, `animal-detail.html` (read-only) | None | 1st | `docs(audit): record animal_detail.js investigation findings` | 0 (docs only) | N/A (no code change) | Written decision doc exists: delete/merge/reconnect/archive |
| 1.2 | Diff `pages/births.js` against live births flow in `animals.html`/`births.html` | `pages/births.js` (read-only) | None | 2nd | `docs(audit): record births.js investigation findings` | 0 | N/A | Written decision doc exists |
| 1.3 | Confirm `pages/notifications.js` is superseded by `notifications-service.js` | `pages/notifications.js`, `notifications-service.js` (read-only) | None | 3rd | `docs(audit): record notifications.js investigation findings` | 0 | N/A | Written decision doc exists |
| 1.4 | Diff `chat.js` against `assistant.html` chat implementation | `chat.js`, `assistant.html` (read-only) | None | 4th | `docs(audit): record chat.js investigation findings` | 0 | N/A | Written decision doc exists |
| 1.5 | Diff `sync-to-excel.js` and `sync.js` against `offline-sync.js` | 3 files (read-only) | None | 5th | `docs(audit): record sync file investigation findings` | 0 | N/A | Written decision doc exists |
| 1.6 | Confirm whether `sw.js` is registered anywhere via a mechanism outside static `<script src>` scanning (manual grep of every HTML `<script>` body, not just tags) | `sw.js`, all 31 HTML files (read-only) | None | 6th | `docs(audit): confirm sw.js registration status` | 0 | N/A | Registration status confirmed either way, in writing |
| 1.7 | Confirm `farm-react.js` usage inside `reports.html`/`settings.html` (which DOM elements/features actually call into it) | `farm-react.js`, `reports.html`, `settings.html` (read-only) | None | 7th | `docs(audit): confirm farm-react.js usage scope` | 0 | N/A | Usage scope documented: full/partial/unused |

**Sprint 1 produces zero production code changes.** Every commit is a `docs(audit):` commit adding a decision record to `/docs/refactor-decisions/`. This is deliberate: Sprint 2 cannot safely begin execution on the 6 orphaned files until every decision is written down and reviewed.

---

## Sprint 2 — Dead Code Execution + CSS Token Wiring (Step A)

| Task | Objective | Files Touched | Prerequisite | Order | Expected Commits | Est. LOC Affected | Rollback Point | Verification Checklist |
|---|---|---|---|---|---|---|---|---|
| 2.1 | Delete `activity.html` | `activity.html` | None | 1st | `chore(cleanup): remove empty activity.html` | -0 (0-byte file) | Revert commit | Confirm no link anywhere in the app points to `activity.html` (already confirmed in audit) |
| 2.2 | Execute Task 1.6 decision on `sw.js` | `sw.js`, the page(s) chosen to host `serviceWorker.register()` | 1.6 decision doc | 2nd | `fix(pwa): register service worker in <chosen entry point>` | ~5–10 | Revert commit | Load app, confirm `navigator.serviceWorker.controller` is non-null after first load; confirm offline mode functions per project's documented offline-sync behavior |
| 2.3 | Execute Task 1.3 decision — archive `pages/notifications.js` | `pages/notifications.js` → moved to `/archive/pages/notifications.js` | 1.3 decision doc | 3rd | `chore(cleanup): archive superseded pages/notifications.js` | ~363 (moved, not deleted) | Move back (git mv reversible) | Confirm `notifications.html` still works unaffected (it never loaded this file) |
| 2.4 | Execute Task 1.4 decision on `chat.js` | `chat.js` (delete or merge into `assistant.html`'s inline script, per decision) | 1.4 decision doc | 4th | `refactor(chat): <merge chat.js into assistant.html>` OR `chore(cleanup): remove superseded chat.js` | ~55 | Revert commit | Full click-through of `assistant.html` chat flow |
| 2.5 | Execute Task 1.5 decision on `sync.js`/`sync-to-excel.js` | Both files + `offline-sync.js` if merging | 1.5 decision doc | 5th | `refactor(sync): consolidate sync.js into offline-sync.js` OR equivalent per decision | ~312 combined | Revert commit | Manually trigger an offline→online sync cycle; manually trigger an Excel export |
| 2.6 | Resolve `window.showHealthDetail` collision (C2) — rename or remove the copy in whichever of `pages/animal_detail.js`/`pages/health.js` is not the surviving canonical implementation | Both files | 1.1 decision doc | 6th (must happen before 2.7 if reconnecting `animal_detail.js`) | `fix(globals): resolve window.showHealthDetail naming collision` | ~5 | Revert commit | Confirm `health.html`'s health-detail view still opens correctly after the rename |
| 2.7 | Execute Task 1.1 decision on `pages/animal_detail.js` | `pages/animal_detail.js`, `animal-detail.html` | 2.6 must be done first if reconnecting | 7th | `refactor(animal-detail): <reconnect/delete/merge> pages/animal_detail.js` | up to 802 | Revert commit | Full click-through of `animal-detail.html`: view, edit, mark-dead, health record actions |
| 2.8 | Execute Task 1.2 decision on `pages/births.js` | `pages/births.js`, `animals.html`, `births.html` | None | 8th | `refactor(births): <reconnect/delete/merge> pages/births.js` | up to 482 | Revert commit | Full click-through of birth registration flow |
| 2.9 | Wire the 36 unused CSS variables using additive fallback syntax `var(--token, existing-value)` | `styles.css` only | Sprint 1 not required (independent) | Can run in parallel with 2.1–2.8 | One commit **per component family**: `refactor(css): wire semantic tokens into buttons`, `refactor(css): wire component tokens into badges`, `refactor(css): wire component tokens into cards`, `refactor(css): wire input tokens into .field`, `refactor(css): wire modal tokens`, `refactor(css): wire remaining unused tokens` | ~1 line per token touched, ~36 lines total across all commits | Revert per-commit (each is one component family) | Visual diff of every page using that component family, both themes |
| 2.10 | Confirm `farm-react.js` decision from Task 1.7 | `reports.html`, `settings.html`, `farm-react.js` | 1.7 decision doc | Last in sprint (highest uncertainty item) | `perf(bundle): <lazy-load/remove/keep> farm-react.js` | Up to 342 KB removed, or 0 if kept | Revert commit | Full click-through of every feature on `reports.html` and `settings.html` |

---

## Sprint 3 — Card & Modal Consolidation

| Task | Objective | Files Touched | Prerequisite | Order | Expected Commits | Est. LOC Affected | Rollback Point | Verification Checklist |
|---|---|---|---|---|---|---|---|---|
| 3.1 | Introduce `.card` primitive + `.card--sm/md/lg/xl` in CSS, alongside (not replacing) the 9 existing classes | `styles.css` | Sprint 2.9 complete (token wiring) | 1st | `feat(css): introduce unified .card primitive with size modifiers` | ~40 | Revert commit | Confirm 0 visual change on any page (new classes not yet applied anywhere) |
| 3.2 | Alias all 9 legacy card classes to the new primitive via CSS (`wonder-card` → same declarations as `.card--xl`, etc.) | `styles.css` | 3.1 | 2nd | `refactor(css): alias legacy card classes to unified primitive` | ~30 | Revert commit | Full visual diff of all 15 card-using pages, both themes — must show zero change |
| 3.3–3.17 | Migrate each of the 15 card-using pages' HTML to use `.card`/`.card--*` directly (one page = one commit) | One page per commit | 3.2 | Sequential, lowest-traffic pages first | `refactor(cards): migrate <page>.html to unified card primitive` × 15 | ~5–20 per page | Revert per-page commit | Visual diff of that single page only |
| 3.18 | Apply `.farm-modal-sm/md/lg/xl` classes at all remaining inline-`max-width` call sites | `shared.js` + 10 modal-using pages | None (classes already exist from prior session) | Can run parallel to 3.3–3.17 | One commit per page: `refactor(modals): replace inline max-width with .farm-modal-<size> in <page>` × 10 | ~2–4 per page | Revert per-page commit | Open every modal on that page, confirm size matches previous inline value |

---

## Sprint 4 — Table Consolidation + Z-index Scale

| Task | Objective | Files Touched | Prerequisite | Order | Expected Commits | Est. LOC Affected | Rollback Point | Verification Checklist |
|---|---|---|---|---|---|---|---|---|
| 4.1 | Introduce `.data-grid` primitive in CSS consuming Tier-3 tokens | `styles.css` | Sprint 2.9 | 1st | `feat(css): introduce .data-grid primitive` | ~35 | Revert commit | 0 visual change (unused so far) |
| 4.2 | Alias `.tbl` to `.data-grid` | `styles.css` | 4.1 | 2nd | `refactor(css): alias .tbl to .data-grid` | ~5 | Revert commit | Visual diff of the 6 `.tbl`-using pages — must show zero change |
| 4.3 | Give `.data-table` (currently undefined) real markup migrated to `.data-grid` | `animal-detail.html` | 4.1 | 3rd | `fix(tables): give animal-detail.html data-table a real implementation via .data-grid` | ~20 | Revert commit | Visual QA — this page's table previously had no defined style; confirm the new appearance is intentional and approved, not just "no longer broken by accident" |
| 4.4 | Migrate `dashboard.html`'s fully inline table to `.data-grid` | `dashboard.html` | 4.1 | 4th | `refactor(dashboard): migrate inline table to .data-grid` | ~30 | Revert commit | Visual diff of dashboard, both themes |
| 4.5–4.9 | Migrate remaining `.tbl`-aliased pages to the `.data-grid` class name directly (optional cleanup, low urgency since alias already makes them functionally identical) | `animals.html`, `barns.html`, `bayan-offline.html`, `bayan.html`, `fix-births.html`, `import.html` | 4.2 | Can be deferred past this sprint if time-constrained | `refactor(tables): rename .tbl to .data-grid in <page>` × 6 | ~1–3 per page | Revert per-page | Visual diff per page |
| 4.10 | Define named z-index scale in CSS (`--z-dropdown`, `--z-navbar`, `--z-modal`, `--z-toast`, etc.) mapped from the 17 existing raw values | `styles.css` | None | Can run parallel to 4.1–4.9 | `feat(css): define named z-index scale` | ~10 | Revert commit | 0 visual change (definitions only) |
| 4.11 | Apply the new z-index tokens across all CSS/inline occurrences, replacing raw numbers | `styles.css` + any inline `z-index` in HTML/JS | 4.10 | After 4.10 | One commit per overlay type: `refactor(css): apply z-index scale to modals`, `...to toasts`, `...to dropdowns`, `...to navbar` | ~1 line per occurrence, ~17 total | Revert per-commit | Manual stacking QA per §11 |

---

## Sprint 5 — Event Delegation Migration (Part 1 of 2)

| Task | Objective | Files Touched | Prerequisite | Order | Expected Commits | Est. LOC Affected | Rollback Point | Verification Checklist |
|---|---|---|---|---|---|---|---|---|
| 5.1 | Migrate `animals.html` (1,500 LOC, highest-traffic page) inline `onclick` to delegated `.addEventListener` | `animals.html` | Sprint 3 & 4 complete for this page (cards/tables already stable) | 1st | `refactor(events): migrate animals.html to delegated event handling` | ~80–120 (largest single-page migration in the roadmap) | Revert commit | Full smoke test per §11 Animals Page script |
| 5.2 | Migrate `dashboard.html` | `dashboard.html` | Sprint 4.4 complete | 2nd | `refactor(events): migrate dashboard.html to delegated event handling` | ~30–40 | Revert commit | Smoke test per §11 |
| 5.3 | Migrate `animal-detail.html` | `animal-detail.html` | Sprint 2.7/4.3 complete | 3rd | `refactor(events): migrate animal-detail.html to delegated event handling` | ~40–60 | Revert commit | Smoke test per §11 |
| 5.4–5.15 | Migrate remaining ~13 pages by descending traffic/complexity priority (`import.html`, `production.html`, `reports.html`, `animal-detail.html` group, `births.html`, `breeding.html`, `health.html`, `vaccine.html`, `inventory.html`, `finance.html`, `tasks.html`, `notifications.html`, `pedigree.html`) | One page per commit | Each page's Sprint 3/4 work complete | Sequential | `refactor(events): migrate <page>.html to delegated event handling` × 12 | ~10–40 per page | Revert per-page | Smoke test per §11 for that page |
| 5.16 | Remove now-dead `window._x` wrapper functions for every page migrated in this sprint | Same pages' JS | Corresponding page's event migration commit | After each page's migration commit | `chore(cleanup): remove obsolete window._x wrappers from <page>` × (as applicable) | ~2–10 per page | Revert commit | Confirm no remaining reference to the removed wrapper anywhere (grep) |

---

## Sprint 6 — Event Delegation Migration (Part 2) + `shared.js` Decomposition Kickoff

| Task | Objective | Files Touched | Prerequisite | Order | Expected Commits | Est. LOC Affected | Rollback Point | Verification Checklist |
|---|---|---|---|---|---|---|---|---|
| 6.1–6.15 | Migrate the remaining ~15 pages (`sheep.html`, `goats.html`, `dead.html`, `barns.html`, `diary.html`, `import.html`, `users.html`, `settings.html`, `assistant.html`, `farm-profile.html`, `cost.html`, `fix-births.html`, `bayan.html`, `bayan-offline.html`, `login.html`) | One page per commit | Each page's Sprint 3/4 work complete | Sequential | `refactor(events): migrate <page>.html to delegated event handling` × 15 | ~10–40 per page | Revert per-page | Smoke test per §11 for that page. **Note:** `bayan.html`/`bayan-offline.html` are isolated per the H4 decision — confirm this migration doesn't require touching their independent `<style>` system |
| 6.16 | Create `/js/shared/` folder with `modal.js`, `theme.js`, `ui-helpers.js`, `gateway-writes.js`, `utils.js` — each a straight extraction of the corresponding logic from `shared.js`, unchanged | New files under `/js/shared/` | All of Sprint 5–6 event migration complete (shared.js should not be a moving target during page-level migrations) | 1st in this sub-effort | `refactor(shared): extract modal.js from shared.js` → `refactor(shared): extract theme.js` → `refactor(shared): extract ui-helpers.js` → `refactor(shared): extract gateway-writes.js` → `refactor(shared): extract utils.js` (5 separate commits) | ~560 total, redistributed not reduced | Revert per-commit | Each extraction commit must leave `shared.js` still fully functional as a shim (see §6 below) |
| 6.17 | Convert `shared.js` into a compatibility shim that re-exports from the 5 new files | `shared.js` | 6.16 | After all 5 extractions | `refactor(shared): convert shared.js into compatibility shim` | ~564 → ~30 | Revert commit | Every one of the 31 pages loads and functions identically with the shim in place |
| 6.18 | Update 3–5 pilot pages' `<script src>` tags to load the new `/js/shared/*.js` files directly instead of the shim | Pilot pages (recommend: `login.html`, `settings.html`, 1–2 low-traffic pages) | 6.17 | Last | `refactor(shared): migrate pilot pages to direct module imports` | ~5–10 per pilot page | Revert per-page | Pilot pages function identically; remaining ~26 pages continue using the shim unchanged, scheduled for a follow-up sprint beyond this playbook's scope |

---

# 2. Commit Plan (illustrative full sequence)

```
Sprint 1
  docs(audit): record animal_detail.js investigation findings
  docs(audit): record births.js investigation findings
  docs(audit): record notifications.js investigation findings
  docs(audit): record chat.js investigation findings
  docs(audit): record sync file investigation findings
  docs(audit): confirm sw.js registration status
  docs(audit): confirm farm-react.js usage scope

Sprint 2
  chore(cleanup): remove empty activity.html
  fix(pwa): register service worker in shared.js bootstrap
  chore(cleanup): archive superseded pages/notifications.js
  refactor(chat): remove superseded chat.js
  refactor(sync): consolidate sync.js into offline-sync.js
  fix(globals): resolve window.showHealthDetail naming collision
  refactor(animal-detail): reconnect pages/animal_detail.js
  refactor(births): merge pages/births.js logic into animals.html
  refactor(css): wire semantic tokens into buttons
  refactor(css): wire component tokens into badges
  refactor(css): wire component tokens into cards
  refactor(css): wire input tokens into .field
  refactor(css): wire modal tokens
  refactor(css): wire remaining unused tokens
  perf(bundle): lazy-load farm-react.js on demand

Sprint 3
  feat(css): introduce unified .card primitive with size modifiers
  refactor(css): alias legacy card classes to unified primitive
  refactor(cards): migrate animal-detail.html to unified card primitive
  refactor(cards): migrate goats.html to unified card primitive
  refactor(cards): migrate sheep.html to unified card primitive
  ... (12 more per-page card migration commits)
  refactor(modals): replace inline max-width with .farm-modal-<size> in animals.html
  ... (9 more per-page modal-size commits)

Sprint 4
  feat(css): introduce .data-grid primitive
  refactor(css): alias .tbl to .data-grid
  fix(tables): give animal-detail.html data-table a real implementation via .data-grid
  refactor(dashboard): migrate inline table to .data-grid
  refactor(tables): rename .tbl to .data-grid in animals.html
  ... (5 more per-page table rename commits)
  feat(css): define named z-index scale
  refactor(css): apply z-index scale to modals
  refactor(css): apply z-index scale to toasts
  refactor(css): apply z-index scale to dropdowns
  refactor(css): apply z-index scale to navbar

Sprint 5
  refactor(events): migrate animals.html to delegated event handling
  chore(cleanup): remove obsolete window._x wrappers from animals.html
  refactor(events): migrate dashboard.html to delegated event handling
  chore(cleanup): remove obsolete window._x wrappers from dashboard.html
  refactor(events): migrate animal-detail.html to delegated event handling
  chore(cleanup): remove obsolete window._x wrappers from animal-detail.html
  ... (12 more page-migration + cleanup commit pairs)

Sprint 6
  refactor(events): migrate sheep.html to delegated event handling
  ... (14 more page-migration commits + cleanup pairs)
  refactor(shared): extract modal.js from shared.js
  refactor(shared): extract theme.js from shared.js
  refactor(shared): extract ui-helpers.js from shared.js
  refactor(shared): extract gateway-writes.js from shared.js
  refactor(shared): extract utils.js from shared.js
  refactor(shared): convert shared.js into compatibility shim
  refactor(shared): migrate pilot pages to direct module imports
```

**Every commit above is:** atomic (touches one concern), independently reversible (`git revert <sha>` leaves the app in a working state), and deployable (the app builds and runs after any single commit in this sequence — there is no "broken intermediate state" commit anywhere in this plan, consistent with the zero-downtime/continuous-deployment constraint).

---

# 3. Branch Strategy

```
main
  ├── always deployable, always matches production (Vercel production domain)
  │
develop
  ├── integration branch for the entire 6-sprint refactor
  ├── merges from main at the start of the effort, never diverges from main's deploy config
  │
  ├── refactor/sprint-1-investigation      (Sprint 1, docs-only — can merge to develop quickly, low risk)
  ├── refactor/sprint-2-deadcode-tokens    (Sprint 2)
  ├── refactor/sprint-3-cards-modals       (Sprint 3)
  ├── refactor/sprint-4-tables-zindex      (Sprint 4)
  ├── refactor/sprint-5-events-part1       (Sprint 5)
  ├── refactor/sprint-6-events-part2-shared (Sprint 6)
  │
  ├── feature/<ticket>   (any unrelated new product feature work continues in parallel, per normal flow — this playbook doesn't freeze feature development)
  │
  └── hotfix/<issue>     (branches directly from main, merges to both main and develop immediately — used if a production bug is found during the refactor window)
```

**Merge order:** each `refactor/sprint-N-*` branch merges into `develop` only after its own sprint's Sprint Backlog (§1) tasks are all complete and its Regression Matrix (§8) row is fully green. `develop` merges into `main` at the end of each sprint (not continuously mid-sprint) — this gives one clean, tested deployment per sprint rather than 6 sprints' worth of partial states reaching production simultaneously.

**Why no separate "release" branch per sprint:** given the zero-downtime/continuous-deployment constraint and Vercel's preview-deployment model, `develop` itself serves as the pre-production release candidate; a dedicated `release/*` branch would add process overhead without a corresponding safety benefit for a project of this size (an explicit deviation from generic playbook boilerplate, made because it fits this specific project's actual deployment model rather than a hypothetical large team).

**CI expectations (per PR into `develop`):**
- No CI test suite currently exists (vanilla JS, no test framework — see §10 for future opportunities). Until automated tests exist, CI gate = **mandatory manual QA checklist completion** (§9) attached to the PR, verified by a second reviewer, before merge.
- Vercel automatically builds a preview deployment for every PR — the review checklist (§4) requires the reviewer to test against that live preview URL, not just read the diff.

**Deployment order:** Sprint branches merge to `develop` → `develop` deploys to a Vercel preview environment for final sign-off → `develop` merges to `main` → `main` auto-deploys to production via Vercel's existing pipeline (per project context, no change to the deployment mechanism itself).

---

# 4. Pull Request Strategy

### Standard PR template (applies to every PR in this playbook)

```markdown
## Title
<type>(<scope>): <imperative summary>   e.g. "refactor(events): migrate animals.html to delegated event handling"

## Description
- What changed and why (reference the Sprint Backlog task ID, e.g. "Sprint 5, Task 5.1")
- What did NOT change (explicitly state if a compatibility shim/alias is intentionally left in place)

## Affected Files
<exact file list — never more than what the Sprint Backlog task specifies>

## Risk Level
🔴 Critical / 🟠 High / 🟡 Medium / 🟢 Low   (inherited directly from the Blueprint's §1 priority for this item)

## Review Checklist
- [ ] Diff touches only the files listed above
- [ ] No unrelated formatting/whitespace changes bundled in
- [ ] Commit is atomic and independently revertible
- [ ] Compatibility layer (if applicable) is still in place and untouched
- [ ] Manual QA checklist (below) executed against the Vercel preview URL

## Visual QA Checklist
- [ ] Dark mode screenshot compared before/after
- [ ] Light mode screenshot compared before/after
- [ ] RTL layout confirmed unaffected

## Rollback Instructions
`git revert <this-PR's-squash-commit-sha>` — confirmed safe because [state why: alias still present / shim still present / no dependent page yet migrated]

## Expected Screenshots
<attach: before/after pair for each affected page, both themes>
```

### Example — filled PR for Sprint 4, Task 4.3

```markdown
## Title
fix(tables): give animal-detail.html data-table a real implementation via .data-grid

## Description
`.data-table` (used only in animal-detail.html) was confirmed in the Design System Audit
to have zero CSS definition — this PR gives it a real, styled implementation using the
new .data-grid primitive introduced in Sprint 4, Task 4.1. Sprint 4, Task 4.3.

## Affected Files
- animal-detail.html

## Risk Level
🟡 Medium — visual-only change, but this is the first time this element has ever
had a defined appearance, so the "before" state is effectively "unstyled," making
before/after comparison less meaningful than usual; sign-off should focus on whether
the NEW appearance is correct, not just "did it change."

## Review Checklist
- [x] Diff touches only animal-detail.html
- [x] No unrelated changes bundled
- [x] Commit is atomic
- [x] N/A — no compatibility layer needed, this class was never functional before
- [x] Manual QA checklist executed against Vercel preview

## Visual QA Checklist
- [x] Dark mode screenshot (new, no prior baseline)
- [x] Light mode screenshot (new, no prior baseline)
- [x] RTL layout confirmed correct

## Rollback Instructions
git revert <sha> — safe, reverts to previously-unstyled (but functionally harmless) state

## Expected Screenshots
[animal-detail.html health/records table, dark + light]
```

---

# 5. File Migration Guide

### `shared.js` (564 LOC → 5 modules + shim)
```
BEFORE:                          AFTER (Sprint 6):
shared.js (564 LOC,              /js/shared/modal.js        (~80 LOC)
  monolithic: modal system +     /js/shared/theme.js         (~40 LOC)
  theme + ui helpers + gateway)  /js/shared/ui-helpers.js    (~120 LOC)
                                  /js/shared/gateway-writes.js (~280 LOC)
                                  /js/shared/utils.js         (~40 LOC)
                                  shared.js (SHIM, ~30 LOC — re-exports the above)
```
**Migration steps:** (1) extract `modal.js` verbatim, have `shared.js` `import` it and re-assign `window.showModal`/`window.closeModal` from the import — zero behavior change; (2) repeat for `theme.js`, `ui-helpers.js`, `gateway-writes.js`, `utils.js` one at a time, each its own commit; (3) once all 5 are extracted and `shared.js` is purely re-exporting, convert remaining pages one-by-one (starting with pilot pages) to load the new files directly and drop the `shared.js` `<script>` tag for that page only.
**Temporary compatibility layer:** `shared.js` itself, kept as a working shim for as long as any page still references it — removal is explicitly out of scope for this playbook (scheduled for a follow-up sprint per Blueprint §3 Phase 10 note).
**Final cleanup (future, beyond Sprint 6):** once all 31 pages load the 5 module files directly, delete `shared.js` entirely in one final commit.

### `firebase.js` (474 LOC → 3 modules)
```
BEFORE:                     AFTER:
firebase.js                 /js/firebase/connection.js    (~40 LOC)
                             /js/firebase/animals-read.js   (~220 LOC)
                             /js/firebase/animals-write.js  (~200 LOC)
```
**Migration steps:** same extract-then-shim pattern as `shared.js`, deferred to a follow-up sprint beyond this playbook's 6-sprint scope per the Blueprint's own sequencing (§3 lists this as lower priority than the `shared.js` kickoff).
**Compatibility layer:** `firebase.js` remains the live, unmodified file through the end of Sprint 6; this migration is explicitly not started in this playbook.

### `pages/reports.js`, `pages/inventory.js`, `pages/production.js`
Same extract-then-shim pattern; per the Blueprint (§3), these are scheduled **after** Sprint 6, not within it. This playbook's Sprint 1–6 scope covers the `shared.js` kickoff only, as specified.

**Rule enforced throughout every migration above:** at no point does any page's `<script src>` list reference a file that doesn't exist yet, and at no point is an old file deleted while any page still has an active `<script src>` reference to it. The shim pattern exists specifically to make this guarantee possible without a big-bang cutover.

---

# 6. Compatibility Strategy

| Mechanism | What it covers | How it works | Removal Timeline |
|---|---|---|---|
| **CSS class aliases** | 9 legacy card classes → `.card--*`; `.tbl` → `.data-grid`; `narrow`/`wide` modal classes → `sm`/`lg` | Plain CSS: `.wonder-card { /* same declarations as .card--xl */ }` — no JS involved, zero runtime cost | Aliases are **never required to be removed** — they can remain indefinitely as documented shorthand, or be cleaned up opportunistically per-page during Sprint 3/4 (Tasks 3.3–3.17, 4.5–4.9). Not a hard deadline. |
| **`window._x` wrapper functions** | Every inline-`onclick`-compatible global function | Kept as-is until the specific page using that `onclick` attribute is migrated to `.addEventListener` (Sprint 5/6) | Removed **in the same commit** as the page's event-delegation migration (§1, Task 5.16/6.1-15) — never left dangling after its last caller is gone |
| **`shared.js` shim** | Every page not yet migrated to `/js/shared/*.js` directly | Re-exports from the 5 new module files, assigns the same `window.*` globals the old monolith did | Removed only after all 31 pages are confirmed migrated to direct module loading — explicitly **beyond this playbook's Sprint 6 scope**, scheduled as a follow-up |
| **Feature flags** | Any migration step judged risky enough to want a kill-switch (primarily: Sprint 2's `sw.js` registration fix, and Sprint 6's `shared.js` shim cutover for pilot pages) | Given no build tooling, implemented as a plain global config object checked at runtime, e.g. `window.FARM_FLAGS = { newSharedModules: false }` set in a single small `<script>` tag included before all other scripts; flip to `true` per-page as each page is confirmed ready | Flags are deleted (not just set to `true`) once every page they gated is confirmed stable for at least one full deployment cycle with no rollback needed |
| **Deprecated function names** | None currently planned to be renamed outright in this playbook's scope — the only true rename is `window.showHealthDetail`'s collision resolution (Sprint 2, Task 2.6) | The non-surviving copy is deleted, not aliased, because it was never live (its host file was orphaned) — no compatibility layer is needed for a function nobody could have been calling in production | N/A — resolved in a single commit, no timeline needed |

---

# 7. Risk Register

| Task | Failure Scenario | Probability | Impact | Detection Method | Rollback | Owner | Priority |
|---|---|---|---|---|---|---|---|
| 2.2 (sw.js registration fix) | Registering the service worker exposes a caching bug that serves stale content | Medium | High (users see outdated data) | Manual QA: hard-refresh test, check `Application > Service Workers` in devtools before/after | Immediate revert commit + manual `unregister()` broadcast if already deployed | Lead engineer executing Sprint 2 | 🔴 Critical |
| 2.6/2.7 (showHealthDetail collision + animal_detail.js reconnect) | Reconnecting the file surfaces a second, subtler bug the file always had (since it was never tested live) | Medium | Medium (one feature area affected) | Full manual click-through per §9 Animal Page script, specifically the health-record sub-flow | Revert the reconnect commit; `animal-detail.html` reverts to its previous inline-script-only behavior | Engineer assigned Task 2.7 | 🟠 High |
| 3.2 (card alias introduction) | Alias declarations don't perfectly match the original 4-near-duplicate card rules, causing a subtle visual shift | Low (CSS-only, directly diffable) | Low (cosmetic) | Screenshot diff, both themes, all 15 pages | Revert single commit | Engineer assigned Sprint 3 | 🟡 Medium |
| 4.3 (data-table real implementation) | The "correct" appearance was never defined by a designer/stakeholder — engineer's visual choice may not match expectations | Medium | Low (cosmetic, single page) | Stakeholder sign-off requested explicitly in the PR before merge (see §4 example) | Revert commit | Engineer + product owner sign-off | 🟡 Medium |
| 4.10/4.11 (z-index scale) | Reordering z-index values changes which overlay wins when two are shown simultaneously | Medium | Medium (confusing UI state, e.g. a toast hidden behind a modal) | Manual stacking QA — deliberately trigger 2+ overlays at once per §11 | Revert commit | Engineer assigned Sprint 4 | 🟠 High |
| 5.1 (animals.html event migration) | Highest-traffic, highest-LOC page in the project — a missed click handler silently breaks a common action (add/edit/delete) | Medium-High | High (core workflow broken on the busiest page) | Full manual QA script per §9, executed by a second person, not just the author | Revert commit immediately; this page's migration is explicitly first in Sprint 5 specifically so any systemic issue with the migration *pattern itself* is caught here before 27 more pages repeat it | Lead engineer + 1 reviewer minimum | 🔴 Critical |
| 6.16–6.17 (shared.js decomposition + shim) | Any of the 31 pages relies on an implicit side-effect of `shared.js`'s current load order that the shim doesn't preserve | Medium | High (widest blast radius in the entire playbook — every page loads this file) | Full regression pass across all 31 pages, not a sample — explicitly called out in Blueprint §11 as the one phase requiring exhaustive rather than spot-check QA | Keep shim live; revert the shim-conversion commit specifically (extractions themselves are lower-risk and don't need reverting) | Lead engineer, full team QA pass | 🔴 Critical |
| 6.18 (pilot page direct module migration) | Pilot page breaks after dropping the shim | Low (only 2–3 pages affected, chosen specifically for low traffic) | Low | Manual QA on the specific pilot pages | Revert that page's `<script src>` change back to loading the shim | Engineer assigned Task 6.18 | 🟢 Low |

---

# 8. Regression Matrix

Rows = features/pages; columns = system areas that must be re-verified after **any** migration touching that feature. `✔` = must be tested every time that feature's row is touched by any sprint task; `–` = not applicable to that feature.

| Feature | UI | Firebase | Offline | Forms | Tables | Modals | Routing | Theme | Performance | Accessibility |
|---|---|---|---|---|---|---|---|---|---|---|
| Animals (list/add/edit/delete) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Animal Detail | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | – | ✔ |
| Births | ✔ | ✔ | ✔ | ✔ | – | ✔ | – | ✔ | – | – |
| Deaths | ✔ | ✔ | ✔ | ✔ | – | ✔ | – | ✔ | – | – |
| Breeding | ✔ | ✔ | ✔ | ✔ | – | ✔ | – | ✔ | – | – |
| Health/Vaccine | ✔ | ✔ | ✔ | ✔ | – | ✔ | – | ✔ | – | – |
| Production | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | – | ✔ | ✔ | – |
| Inventory | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | – | ✔ | – | – |
| Finance/Cost | ✔ | ✔ | ✔ | ✔ | – | ✔ | – | ✔ | – | – |
| Diary | ✔ | ✔ | ✔ | – | – | ✔ | – | ✔ | – | – |
| Tasks | ✔ | ✔ | ✔ | ✔ | – | ✔ | – | ✔ | – | – |
| Notifications | ✔ | ✔ | – | – | – | – | – | ✔ | – | – |
| Reports | ✔ | ✔ | – | – | ✔ | – | – | ✔ | ✔ | – |
| Import | ✔ | ✔ | – | ✔ | ✔ | ✔ | – | ✔ | – | – |
| Bayan / Bayan-offline (statement pages) | ✔ | – (self-contained) | ✔ (offline variant specifically) | – | ✔ | – | – | – (own isolated theme, per H4) | ✔ (print/export) | – |
| Users/Settings | ✔ | ✔ | – | ✔ | ✔ | ✔ | – | ✔ | – | – |
| Assistant (AI chat) | ✔ | – | – | ✔ | – | – | – | ✔ | – | – |
| Login (PIN) | ✔ | ✔ | – | ✔ | – | – | ✔ | ✔ | – | – |
| Dashboard | ✔ | ✔ | ✔ | – | ✔ | – | – | ✔ | ✔ | – |

**How to use this matrix during the roadmap:** before merging any Sprint N PR, cross-reference which feature row(s) the touched files belong to, then execute every `✔` column's corresponding check from §9/§11 for that row — not the whole matrix, only the intersecting cells.

---

# 9. Manual QA Playbook

### Animals Page (`animals.html`) — highest priority, most detailed script
1. Open page → confirm list renders, summary cards show correct counts.
2. Add a new animal → confirm it appears in the list without a full page reload.
3. Edit an existing animal → confirm the change persists after a manual refresh.
4. Delete an animal → confirm confirmation modal appears, deletion removes it from the list.
5. Refresh the page → confirm state (filters, scroll position if applicable) behaves as before the migration.
6. Go offline (devtools network throttling → Offline) → attempt add/edit → confirm the offline-sync queue accepts the action (per `offline-sync.js` behavior) and shows the pending-count badge.
7. Reconnect → confirm the queued action syncs automatically and the badge clears.
8. **Expected result at every step:** identical behavior to the pre-migration baseline; zero new console errors.

### Animal Detail Page (`animal-detail.html`)
1. Open from an animal list link → confirm all sections (breed info, records table, health records) render.
2. Edit a field → save → refresh → confirm persistence.
3. Trigger "mark as dead" flow → confirm modal → confirm status updates.
4. Complete a health record action (ties to the `window.showHealthDetail` collision resolution, Task 2.6) → confirm the correct implementation runs, not a stale/duplicate one.
5. **Expected result:** no dead-code path is silently invoked; only the resolved, canonical function fires.

### Births / Deaths / Breeding / Health / Vaccine (repeat pattern per page)
1. Open page → confirm list/table renders.
2. Add a record → confirm it appears and totals update where applicable (e.g. birth counts affecting breed totals per the documented `purpose='birth'` counting logic).
3. Edit → confirm persistence.
4. Delete → confirm removal + any dependent count updates (e.g. dashboard summary).
5. Offline → reconnect → confirm sync.

### Production / Inventory / Finance
1. Open page → confirm table + summary figures render.
2. Add a transaction/record → confirm totals recalculate correctly (e.g. FCR calculation in Inventory, income-over-feed-style figures in Production).
3. Edit/delete → confirm recalculation again.
4. Export (if applicable, e.g. Excel export in Production) → confirm file downloads and contains expected data.

### Diary
1. Open page → confirm diary entries render.
2. Trigger `gwDiaryApply()` conflict-detection flow deliberately (edit a record elsewhere, then apply a diary change that conflicts) → confirm the conflict modal appears and logs to `animal_conflicts` exactly as documented in project context — this is the single most business-logic-sensitive flow in the app and must be re-verified after any `shared.js`/`gateway-writes.js` change.

### Reports
1. Open page → confirm Chart.js-based charts render.
2. **Force Chart.js to fail loading** (block the CDN URL in devtools) → confirm the mandatory CSS/text fallback renders instead of a blank page (per documented project requirement).
3. Confirm every report's filters/export options function.

### Import
1. Open page → confirm template list (`tpl-card` family) renders correctly under the new card primitive.
2. Trigger an import → confirm data lands in Firebase correctly via the gateway (`gwBulkImport`).
3. Confirm the `import-data.js` seed/verification logic (if re-run) still totals correctly against the documented farm inventory statement figures.

### Bayan / Bayan-Offline (statement pages)
1. Open both pages independently → confirm their **isolated** color system (per H4) still renders correctly and is untouched by any `styles.css` change made elsewhere in the roadmap.
2. Confirm print/export functionality.
3. Confirm the offline variant works with no network connection at all (this is its specific purpose).

### Users / Settings / Notifications / Tasks / Assistant / Login / Dashboard
1. Standard CRUD walkthrough per page as applicable (per the Regression Matrix row for that feature).
2. Login specifically: confirm PIN entry, confirm `localStorage['farm_user']` is set correctly, confirm redirect to `dashboard.html` matches `index.html`'s existing redirect logic (unchanged by this roadmap).
3. Dashboard specifically: confirm the newly-migrated `.data-grid` table (Sprint 4, Task 4.4) shows identical data to before.

---

# 10. Automated Test Opportunities (identification only — no framework introduced)

| Category | Candidate | Why it's a good candidate |
|---|---|---|
| **Unit-test candidates** | `firebase/animals-read.js` and `animals-write.js` functions once extracted (Sprint 6+ follow-up) — pure data-transformation logic (e.g. birth-count-by-breed calculations) is testable without a DOM | Once functions are isolated from DOM manipulation (a direct benefit of the §4/§5 module decomposition), they become naturally unit-testable with zero framework beyond plain `assert` calls in a `.js` file run via Node |
| **Unit-test candidates** | `pages/inventory.js`'s `calcFCR` (Feed Conversion Ratio calculation) | Pure numeric function, high business value, currently untested |
| **Integration-test candidates** | The `gwDiaryApply()` conflict-detection flow | Multi-step (diff computation → conflict modal → `animal_conflicts` log → `diary_snapshot` update) — a strong candidate for a Firebase-emulator-backed integration test once the team is ready to introduce a test runner |
| **Smoke-test candidates** | "Does every page load without a console error" — every one of the 31 pages | Cheapest possible automated check; could be scripted today with a headless-browser tool (e.g. Playwright) without touching the app's own vanilla-JS nature at all, since the test lives outside the app |
| **DOM snapshot candidates** | The 15 card-family pages (Sprint 3) and 8 table pages (Sprint 4) — exactly the pages this playbook's own visual-QA checklists manually screenshot | These manual screenshot comparisons (§4/§9) are the natural seed for an automated visual-regression suite later — the manual process this playbook defines effectively **is** the test spec, just not yet automated |
| **Firebase mock candidates** | Any test touching `firebase/animals-read.js`/`animals-write.js` | The Firebase emulator suite (an official Firebase tool, not a new framework/library dependency in the React/Vue sense) would let these run without touching production data |

**Explicitly not recommended in this playbook:** introducing Jest/Vitest/Playwright/Cypress as a dependency is a decision for the team to make separately, outside this refactor's scope — this section only identifies *where* such tools would have the highest leverage if and when that separate decision is made.

---

# 11. Release Strategy

| Concern | Strategy |
|---|---|
| **Incremental deployment** | Each sprint's `develop → main` merge is one deployment (§3); within a sprint, individual commits reach `develop`'s preview environment continuously but production only receives the sprint's final, fully-QA'd state |
| **Canary deployment** | No user-segmentation infrastructure exists (no auth-based rollout mechanism beyond the PIN login). Canary is approximated via the feature-flag mechanism (§6): flip `window.FARM_FLAGS.x` to `true` for a single page first (e.g. one low-traffic page gets the new `shared.js` module loading before the rest), observe in production for a full day, then proceed |
| **Rollback deployment** | Vercel's instant-rollback-to-previous-deployment feature is the primary mechanism — since every commit is independently deployable (§2), reverting to the immediately-prior `main` deployment is always safe |
| **Emergency rollback** | If a production issue is detected mid-sprint after a `main` merge: (1) Vercel rollback to the prior deployment immediately, (2) `git revert` the specific offending commit on `develop` so the next scheduled merge doesn't reintroduce it, (3) do not attempt a forward-fix under pressure — always roll back first, diagnose second |
| **Database compatibility** | No schema migrations are part of this playbook — every change is CSS/JS/HTML only; Firebase Realtime Database structure is untouched throughout all 6 sprints |
| **Firebase compatibility** | The gateway-function architecture (`gw*` functions, per project context) is preserved exactly; no write path changes shape, only file location (§5) |
| **Offline cache compatibility** | Sprint 2's `sw.js` registration fix (Task 2.2) is the only change touching caching behavior — bump the service worker's cache version string (already documented as versioned, "v6" per project context) to force old caches to invalidate cleanly the moment registration is fixed, avoiding a mixed old-cache/new-code state |
| **Browser cache invalidation** | Standard cache-busting via the existing Vercel deployment (new deployment = new asset hashes, per Vercel's default static-asset behavior) — no additional mechanism needed |
| **Service Worker versioning** | Increment the cache-version constant inside `sw.js` in the **same commit** as Task 2.2 (registration fix), so the very first time the SW activates, it starts from a clean, versioned cache rather than inheriting any stale state from before it was ever properly registered |

---

# 12. Observability

| Area | Strategy (no new external services introduced unless justified) |
|---|---|
| **Logging strategy** | Adopt a single `log(level, message, context)` wrapper function in `js/shared/utils.js` (Sprint 6) that gates all `console.*` calls behind one place — currently, per the Architecture Audit, logging is ad-hoc (`console.warn` appears at least once in `pages/reports.js`'s Chart.js failure handler); centralizing costs nothing and pays off the moment the team wants to add a real error-reporting backend later |
| **Error reporting** | No external error-reporting service (e.g. Sentry) is introduced in this playbook — not justified by the current project scale. The `log()` wrapper above is structured so that plugging in such a service later is a one-line change inside `utils.js`, not a codebase-wide refactor |
| **Performance monitoring** | No new tooling introduced. Recommend manually re-running the Architecture Audit's static script-loading measurement (§10 of that audit) after Sprint 4's z-index/table work and again after Sprint 6's `shared.js` split, to confirm the blocking-script-count reduction predicted in the Blueprint's §14 burn-down actually materializes |
| **Console policy** | Production commits must not introduce new bare `console.log` calls for debugging — route through the `log()` wrapper (once it exists, Sprint 6+) or remove before commit. This is a review-checklist item (§4), not a tooling-enforced rule, since no linter is currently part of the build |
| **Feature flags** | `window.FARM_FLAGS` object (§6) doubles as the observability surface — logging which flags are active on a given page load is a 1-line addition to the `log()` wrapper once it exists |
| **Crash reporting** | Not applicable in the traditional native-app sense; the closest equivalent is a global `window.onerror`/`window.addEventListener('error', ...)` handler, which the Architecture Audit confirmed does **not currently exist anywhere** (`window.onload` count was 0, and no global error handler was found in the JS architecture scan) — adding one is a genuine, low-cost improvement candidate, recommended as a Sprint 6 addition inside `ui-helpers.js` |
| **User telemetry** | None currently exists; none is introduced by this playbook. If desired later, the centralized `log()` wrapper is the natural integration point |

---

# 13. Definition of Done

| Sprint | Engineering DoD | QA DoD | Architecture DoD | Performance DoD | Accessibility DoD | Documentation DoD |
|---|---|---|---|---|---|---|
| 1 | All 7 investigation tasks have a written decision doc | N/A (no code shipped) | N/A | N/A | N/A | `/docs/refactor-decisions/` populated for all 6 orphaned files + sw.js + farm-react.js |
| 2 | All Sprint 1 decisions executed; 0 orphaned files remain (or explicitly archived); all 36 CSS variables referenced at least once | Every affected feature's Regression Matrix (§8) row passes manual QA (§9) | `window.showHealthDetail` collision resolved; no new global collisions introduced | `farm-react.js` decision executed (lazy-loaded, removed, or confirmed necessary) | N/A this sprint (no a11y-specific work scheduled yet) | Decision docs updated with final outcome per file |
| 3 | `.card` primitive + aliases live; all 15 pages migrated or explicitly deferred with reason; modal size classes applied at all 10 call sites | Visual diff (dark+light) passed for all 15+10 pages | 9→1 card class consolidation complete per Blueprint §7 target | No regression in page load time from the additive alias approach | No regression in existing screen-reader-visible structure | PR descriptions reference Blueprint §7 target primitive explicitly |
| 4 | `.data-grid` primitive live; `.data-table` given real styling; dashboard inline table migrated; z-index scale defined and applied | Full manual stacking QA passed (§11); table visual diff passed for all 8 pages | 3→1 table implementation consolidation complete per Blueprint §7 target | N/A specific target, but no new blocking scripts introduced | `.data-table`'s new implementation reviewed for basic table semantics (headers, etc.) | Z-index scale documented in a CSS comment block at the top of the token section |
| 5 | ~15 of 31 pages migrated to delegated events; corresponding `window._x` wrappers removed per page | Full manual smoke test (§9) passed per migrated page, executed by a second person for `animals.html` specifically | No page has both `onclick` and `.addEventListener` on the same element simultaneously past its own commit | Delegated events reduce total attached-listener count vs. per-row inline handlers (qualitative, not separately benchmarked this sprint) | Keyboard-only interaction re-confirmed per migrated page | Sprint 5 completion note added to `/docs/refactor-decisions/` summarizing pages done vs. remaining |
| 6 | Remaining ~15 pages migrated; `shared.js` split into 5 modules + shim; 2–3 pilot pages on direct module loading | **Exhaustive** (not sample) regression pass across all 31 pages specifically for the `shared.js` shim conversion, per Blueprint §11's own instruction | `shared.js` no longer the single highest-complexity active file (redistributed across 5 modules per Blueprint §4 target); global `window.onerror` handler added (Observability §12) | Blocking-script count re-measured and compared to the Blueprint §14 burn-down estimate | Global error handler doesn't swallow/hide any existing accessibility-relevant console warnings | Final repository tree (§14 below) matches what's actually in the repo; `/docs/refactor-decisions/` finalized for the whole 6-sprint effort |

---

# 14. Final Repository State (after Sprint 6)

```
/                                          (Vercel + GitHub, unchanged deployment model)
├── index.html                             (unchanged — redirect logic)
├── login.html, dashboard.html,
│   animals.html, animal-detail.html,
│   sheep.html, goats.html, births.html,
│   dead.html, breeding.html, health.html,
│   vaccine.html, production.html,
│   inventory.html, finance.html, cost.html,
│   diary.html, tasks.html, notifications.html,
│   reports.html, import.html, users.html,
│   settings.html, assistant.html,
│   farm-profile.html, barns.html,
│   pedigree.html, fix-births.html          (31 pages, minus activity.html — deleted Sprint 2)
├── bayan.html, bayan-offline.html          (unchanged — self-contained per H4 decision, own <style>)
│
├── styles.css                              (fully-referenced Tier-1→2→3→Utilities→Components;
│                                             .card / .card--sm/md/lg/xl primitive + 9 legacy aliases;
│                                             .data-grid primitive + .tbl alias;
│                                             named z-index scale; 0 unused variables)
│
├── /js
│   ├── /shared
│   │   ├── modal.js
│   │   ├── theme.js
│   │   ├── ui-helpers.js        (includes new global window.onerror handler, §12)
│   │   ├── gateway-writes.js
│   │   └── utils.js             (includes new log() wrapper, §12)
│   ├── shared.js                 (compatibility SHIM — re-exports /js/shared/*, still loaded
│   │                              by ~28 of 31 pages; scheduled for full removal beyond Sprint 6)
│   ├── firebase.js               (unchanged this playbook — decomposition deferred beyond Sprint 6)
│   ├── nav.js, config.js         (unchanged)
│   ├── offline-sync.js           (unchanged; absorbed sync.js's logic per Sprint 2 decision, if that
│   │                              was the chosen outcome — exact content depends on Sprint 1 findings)
│   ├── sw.js                     (registration now confirmed live; cache version bumped alongside
│   │                              the fix, per §11)
│   ├── notifications-service.js  (unchanged — confirmed as the live implementation)
│   └── /pages
│       ├── animal_detail.js      (either reconnected with the naming collision resolved, or removed —
│       │                          per Sprint 1/2 decision; if reconnected, still a flat file, not yet
│       │                          decomposed per Blueprint §4 — that split is beyond Sprint 6)
│       ├── breeding.js, finance.js, health.js, inventory.js, pedigree.js,
│       │   production.js, reports.js, tasks.js, tour.js, vaccine.js,
│       │   farm_profile.js, datepicker.js                (unchanged this playbook; each remains a
│       │                                                  flat file — the reports/inventory/production
│       │                                                  module splits from Blueprint §4 are scoped
│       │                                                  beyond this 6-sprint playbook)
│       └── births.js             (per Sprint 1/2 decision: merged into animals.html, or removed)
│
├── /archive
│   └── pages/notifications.js    (archived, not deleted, per Sprint 2 Task 2.3 — retained in case
│                                   any unique logic needs porting later)
│
├── import-data.js, sync-to-excel.js*      (*present only if Sprint 1/2 decision was "keep/reconnect";
│                                            removed if decision was "delete")
│
├── /docs
│   └── /refactor-decisions/               (new — one file per Sprint 1 investigation task, finalized
│                                            with outcomes through Sprint 6, per §13 Documentation DoD)
│
├── farm-react.js                          (present only if Sprint 2 Task 2.10 decision was "keep";
│                                            lazy-loaded on-demand if "lazy-load"; absent if "remove")
│
├── /farm-apk                              (unchanged — Capacitor Android wrapper, server.url still
│                                            points at the same Vercel production domain)
│
├── manifest.json (or equivalent PWA manifest, unchanged)
└── vercel.json                            (unchanged deployment config)
```

**What explicitly did NOT change in this 6-sprint playbook (by design, deferred to future work per the Blueprint's own sequencing):** `firebase.js` decomposition, `pages/reports.js`/`inventory.js`/`production.js` module splits, full `shared.js` shim removal, typography/spacing scale application beyond definition, accessibility scaffolding beyond the one new global error handler, and any test-automation tooling (§10 candidates remain candidates, not implementations).
