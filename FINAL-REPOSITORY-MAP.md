# FINAL-REPOSITORY-MAP.md

**The merged, canonical repository as of commit `e655e2b`.**

## Root — Pages (31 HTML files, unchanged in count)
Same 31 pages as before the merge; 4 carry this merge's changes (`animal-detail.html`, `animals.html`, `assistant.html`, `dashboard.html`), the rest are byte-identical to the target's pre-merge state.

## Root — Shared Runtime
`shared.js` (now includes `createOffspringAnimal()`, Wave A's weight-writer additions, and dark-mode logo rendering), `firebase.js` (unchanged this merge — already had the security-hardened functions), `nav.js`, `config.js`, `offline-sync.js`, `sw.js`, `notifications-service.js`, `sync.js`, `sync-to-excel.js`, `import-data.js`, `farm-react.js`, `chat.js`, `sw-register.js` (present, confirmed not loaded by any page), `styles.css` (now includes dark-mode tokens).

## `pages/` — Page-Specific Logic (12 files, down from 15)
`breeding.js`, `finance.js`, `health.js`, `inventory.js`, `production.js`, `reports.js`, `tasks.js`, `vaccine.js`, `pedigree.js`, `farm_profile.js`, `datepicker.js`, `tour.js`. **Removed this merge, re-verified unreferenced:** `animal_detail.js`, `births.js`, `notifications.js`.

## `api/`
`claude.js` — Anthropic proxy, unchanged.

## `docs/` — New This Merge
```
docs/
  repository/    (CHARTER, WORKING_CONTRACT, RISK_REGISTER, HEALTH_SCORE)
  architecture/  (ARCHITECTURE, SSOT, DATA_FLOW, SHARED_HELPERS)
  certification/ (WEIGHT, BIRTH, SALE_TRANSFER, MODAL_LIFECYCLE)
  decisions/     (INDEX, D-01, D-02, D-03)
  backlog/       (VERIFIED_BACKLOG, OPEN_DECISIONS)
  design/        (DESIGN_SYSTEM)
  archive/       (INVENTORY, ARTIFACT_MAPPING, originals/ [63 source documents])
```

## Root — Documentation
`CLAUDE.md` (new canonical merged version), `MIGRATION-CHECKLIST.md` (now git-tracked), `COMPONENTS.md`, `DESIGN-TOKENS.md`, `FIREBASE_RULES_SETUP.md`, `MERGE-REPORT.md`, `BASELINE-VERIFICATION.md`, this file.

## Root — Config
`manifest.json`, `vercel.json`, `package.json`, `database.rules.json`.

## `farm-apk/`, `media/`, `.claude/`
Unchanged, except `media/` gains `logo-dark.svg` and `logo-icon-dark.svg`.

## Where New Features Belong (Unchanged From Prior Documentation)
See `docs/architecture/ARCHITECTURE.md` and `docs/repository/WORKING_CONTRACT.md` — this merge did not alter these conventions, only made the repository they describe actually match them.

## Total File Count
90 top-2-level files/directories (root + one level deep), down from the target's pre-merge count by 3 (dead file retirement) and up by the `docs/` tree and a handful of newly-tracked loose files.
