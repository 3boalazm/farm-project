# Architecture

**Consolidated architectural picture — supersedes reading the individual RSOT/RRAS/RRMP/RRCV series and the Repository 4 `ssot-*`/`repo4-*`/`architecture-freeze` series directly, except where this document points back to one of them for depth.**

## Stack

Vanilla HTML/CSS/JS, Bootstrap 5.3.3, Firebase Realtime Database (REST, no Firebase Auth SDK — a synthesized email/password Auth bridge exists for real `auth != null` rules without changing the PIN-pad UI), Vercel deployment, Capacitor-wrapped Android APK in `farm-apk/` (separate repo, `github.com/3boalazm/bayan-farm-apk`).

## Page/File Inventory (Current, ~31 HTML pages)

Each page loads a common chain (`config.js` → `firebase.js` → `nav.js`/`shared.js`, with confirmed exceptions: `login.html` skips `nav.js` entirely; `settings.html` skips `offline-sync.js`/datepicker/tour) followed by page-specific `pages/*.js` for pages that delegate their logic (breeding, production, reports, health, vaccine, inventory, finance, tasks, farm_profile, pedigree) — versus pages that keep all logic inline (animals, animal-detail, barns, assistant, settings, import, login, notifications, dead, diary, cost, births, users, fix-births).

## Gateway/Shared-Helper Architecture

All Weight and Birth writes now converge through shared functions rather than per-page duplication:
- **Weight:** `submitAddWeight()`/`delWeight()`/`delWeightByIdx()` in `animal-detail.html` are canonical; `pages/production.js`, `assistant.html`, and `shared.js`'s `_ubSubmit()` all write to the same `animals/{animalId}/weights` path.
- **Birth:** `createOffspringAnimal()` in `shared.js` is the single per-offspring creation helper, called by `_ubSubmit()`, `submitBreeding()` (markBorn), and AI `add_birth`. `submitBirthDirect()` remains a separate, deliberately-deferred fourth implementation (see `docs/certification/BIRTH.md`).
- **Bulk actions on `animals.html`:** unified through `performBulkX(ids, fields)` functions and `commitBulkPatch()`/`refreshAnimalsAfterBulk()`.

## Known Architectural Debt (Not Yet Converged)

- Vaccination, Medication, Finance, Diary, Inventory: never subjected to the same SSOT-convergence depth as Weight/Birth. Individually-owned, not confirmed duplicated, but not certified either.
- Farm Settings: `localStorage`-only, no Firebase-backed sync (open Product Decision, D-04).
- `activity_log`: universally written, viewer status disputed across artifacts (see `docs/repository/RISK_REGISTER.md`).

## Full Detail

For the complete, evidence-graded architectural record this document summarizes, the original series remains available (not deleted, see `docs/archive/ARTIFACT_MAPPING.md`): Repository Source of Truth (RSOT), Repository Runtime Architecture Specification (RRAS), Repository Runtime Refactoring Master Plan (RRMP), Repository Runtime Contract Verification (RRCV), and the Repository 4 SSOT series (`ssot-phase1-domain-mapping.md` through `ssot-confidence-report.md`) plus `architecture-freeze.md`, the binding contract that bridges Repository 4's findings into this project's continued execution.
