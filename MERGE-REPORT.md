# MERGE-REPORT.md — Engineering Baseline Merge

**Commit:** `e655e2b` — "Engineering Baseline Merge"
**Base:** Uploaded (target) repository, preserving its git identity as the continuing repository.
**Sources merged in:** Temporary repository (this session's Wave A/B/RIB work, plus inherited Repository 3/4 and Security Hardening layers), `docs/` knowledge base, `MIGRATION-CHECKLIST.md`, Decision Register, both `CLAUDE.md` versions.

## Files Changed (12, All Confirmed Strict Supersets)

| File | Layers Merged | Merge Strategy |
|---|---|---|
| `animal-detail.html` | Wave A Commit 4 | Direct replace — target's pre-fix version fully superseded, no unique target content lost (verified: the destructive-action warning text is present in both, reworded not removed) |
| `animals.html` | Repository 4 (bulk decomposition) + BL-01/BL-02 | Direct replace — target's pre-refactor button handlers and inline `execBulk` fully superseded |
| `assistant.html` | Wave A Commit 2B/6 + Wave B Commit 2 | Direct replace — target's pre-convergence `add_birth`/`add_weight` logic fully superseded |
| `dashboard.html` | RIB-08 Commits 1–4 (Quick Death parity) | Direct replace — clean, single-layer change, no other layer intermixed |
| `pages/breeding.js` | Security (`can('breeding')`) + BL-03 + D-02 | Direct replace — three-layer change, all three confirmed present post-merge |
| `pages/finance.js` | Repository 3 (Monthly Trend chart) | Direct replace — not touched by this session; inherited improvement |
| `pages/health.js` | Repository 3 Phase 2 (Treatment Trend) | Direct replace — inherited improvement |
| `pages/inventory.js` | Security + Repository 3 (Activity/Table Governance) + RIB-07 | Direct replace — three-layer change |
| `pages/production.js` | Wave A Commit 1 | Direct replace |
| `pages/reports.js` | Security (`can('reports')`) | Direct replace — inherited fix |
| `shared.js` | Wave A Commits 3/5/6 + Wave B Commit 1 (`createOffspringAnimal` extraction) + dark-mode logo enhancement | Direct replace |
| `styles.css` | Dark-mode theme tokens | Direct replace |

**Why direct replacement was safe, not a shortcut:** every one of the 12 files was individually diffed before merge; every line unique to the target version was confirmed to be an older iteration of the same logic later improved in the temp repository, not an independent, un-migrated feature. Two borderline cases (an animal-detail.html warning message, shared.js's logo-rendering logic) were individually verified rather than assumed safe.

## Files Added

- `docs/` (complete tree, 20 consolidated documents + 63 preserved originals) — Documentation.
- `CLAUDE.md` — replaced with a new canonical version combining both prior versions (see below); both originals were reviewed and are fully represented in the new file's content before being removed as temporary backups.
- `MIGRATION-CHECKLIST.md` — preserved as-is; a genuine historical artifact from an earlier, separate reconciliation effort, now git-tracked for the first time.
- `sw-register.js` — preserved as-is; confirmed present but **not loaded by any HTML page** — an inherited, real file whose activation status remains exactly as documented (not production-active).
- `media/logo-dark.svg`, `media/logo-icon-dark.svg` — dark-mode theme assets.

## Files Removed

- `pages/animal_detail.js`, `pages/births.js`, `pages/notifications.js` — **re-verified against the fully merged file set** (not removed solely because absent from the temp repository) — confirmed zero references across every HTML page in the merged repository, using the same multi-angle evidence standard (DOM/network/source/deployment) that originally justified their retirement.

## CLAUDE.md — Special Handling

Neither original was deleted outright without review. The target's version (technically precise: `can()` permissions, `chat.js`/`api/claude.js` relationship, `farm-react.js`, exact SW caching strategy) and the temp repository's version (a short pointer into `/docs/`) were both read in full and combined into one new canonical file containing: the target's architectural depth, the temp repository's `/docs` map and context-loading instructions, and explicit cross-references reconciling points where the two disagreed (e.g., the `database.rules.secure.json` existence question, the SW-registration-bug conflict) rather than silently picking one claim.

## Independent Changes That Coexist Without Conflict

Repository 3's chart/table work (finance.js, health.js, inventory.js) and this session's Wave A/B work touch entirely disjoint functions within shared files — confirmed via per-function diff inspection, not file-level assumption.
