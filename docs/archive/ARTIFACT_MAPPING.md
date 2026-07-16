# Artifact Mapping — Full Traceability

**Every one of the 134 original artifacts from the consolidated archive, mapped. No file is silently dropped.**

## Category Legend
Repository Architecture (RA) · Decision Record (DR) · Certification (CT) · SSOT Investigation (SI) · Design System (DS) · Service Worker (SW) · Sync (SY) · Security (SC) · Refactoring (RF) · Migration (MG) · Backlog (BL) · Historical Report (HR) · Duplicate (DUP) · Obsolete (OBS) · Live Repository File (LRF, not a documentation artifact) · Binary Archive (BIN, not a documentation artifact)

## Core Business-Logic / SSOT Thread

| Original File | Category | Knowledge Extracted? | Destination | Archived? | Obsolete? | Duplicate? |
|---|---|---|---|---|---|---|
| security-stabilization-report.md | SC | Yes — 8-file security pass, PIN hashing | ARCHITECTURE.md (referenced) | Yes | No | No |
| animals-migration-report.md | RF | Yes — Repository 3 start, Animals/Detail migration | HEALTH_SCORE.md | Yes | No | No |
| phase2-module-migration-report.md | RF | Yes — Health/Production/Finance/Inventory/Reports migration | HEALTH_SCORE.md | Yes | No | No |
| phase3-finance-report.md | RF | Yes | HEALTH_SCORE.md | Yes | No | No |
| phase3-production-report.md | RF | Yes | HEALTH_SCORE.md | Yes | No | No |
| repository3-final-deliverable.md | RF | Yes — Repository 3 completion statement, Chart.js debt flagged | HEALTH_SCORE.md, VERIFIED_BACKLOG.md | Yes | No | No |
| ssot-phase1-domain-mapping.md | SI | Yes — 20-entity inventory foundation | SSOT.md | Yes | Superseded by later passes in same thread | No |
| ssot-dependency-graph-final.md | SI | Yes — ranked integrity violations | SSOT.md, RISK_REGISTER.md | Yes | No | No |
| ssot-remaining-entities.md | SI | Yes — 13 additional entities | SSOT.md | Yes | Superseded by ssot-tightened-audit for overlapping entities | No |
| ssot-tightened-audit.md | SI | Yes — deep-dive corrections (`weights`/`weight_log` FK style) | SSOT.md, WEIGHT.md | Yes | No | No |
| ssot-confidence-report.md | SI | Yes — final gate, 18/20 fully verified | SSOT.md, RISK_REGISTER.md | Yes | No | No |
| domain-freeze-and-duplication-report.md | DR | Yes — Decision 1/2 framing, migration order | DECISIONS/INDEX.md | Yes | No | No |
| repo4-checkpoint-report.md | HR | Yes — import.html syntax error flagged | VERIFIED_BACKLOG.md | Yes | No | No |
| repo4-final-architecture-audit.md | RA | Yes — closeModal timing, sold/dead conflict pre-diagnosis | SALE_TRANSFER.md, MODAL_LIFECYCLE.md | Yes | No | No |
| repo4-phase2-bulk-actions-architecture-report.md | RA | Yes — bulk action unification plan | ARCHITECTURE.md (referenced) | Yes | No | No |
| priority-2-75-entry-point-census.md | SI | Yes — Death/Transfer readiness confirmed | Fed into BL-01/BL-02 (pre-dates this doc set) | Yes | No | No |
| priority-2-5-downstream-verification.md | SI | Yes — 4 invariant disproofs, weight_log orphan confirmed | WEIGHT.md, SSOT.md | Yes | No | No |
| birth-canonical-specification.md | RA | Yes — canonical Birth contract definition | BIRTH.md | Yes | No | No |
| birth-failure-analysis.md | RA | Yes — Best Effort classification, no-rollback finding | BIRTH.md | Yes | No | No |
| birth-reliability-audit.md | CT | Yes — Best Effort reconfirmed with stronger evidence | BIRTH.md | Yes | No | No |
| architecture-freeze.md | RA/DR | Yes — **the binding contract bridging Repo 4 into this project's own continuation; direct source of D-02/D-04/D-06 framing** | ARCHITECTURE.md, DECISIONS/INDEX.md | Yes | No | No |
| repository-5-engineering-backlog.md | BL | Yes — official backlog, one-item-one-commit discipline | WORKING_CONTRACT.md | Yes | No | No |
| Repository-Source-Of-Truth-RSOT.md | RA | Yes — full evidence-graded architecture | ARCHITECTURE.md | Yes | No | No |
| Repository-Runtime-Architecture-Specification-RRAS.md | RA | Yes | ARCHITECTURE.md | Yes | No | No |
| Repository-Runtime-Refactoring-Master-Plan-RRMP.md | RA | Yes | ARCHITECTURE.md | Yes | No | No |
| Repository-Runtime-Contract-Verification-RRCV.md | CT | Yes — Death 5th implementation discovery | BIRTH.md (referenced) | Yes | No | No |
| E1-Weight-System-Investigation.md | SI | Yes — foundational Weight investigation, D-01 groundwork | WEIGHT.md | Yes | No | No |
| Weight-Subsystem-Certification.md | CT | Yes | WEIGHT.md | Yes | No | No |
| Formal-Verification-Weight-Subsystem.md | CT | Yes — Round 1, orphaned-write proof | WEIGHT.md | Yes | No | No |
| Formal-Verification-Weight-Round2.md | CT | Yes — Round 2, misleading-toast defect | WEIGHT.md | Yes | No | No |
| Formal-Verification-Weight-Round3.md | CT | Yes — Round 3, `todayStr()` UTC bug, self-correction demonstrated | WEIGHT.md, RISK_REGISTER.md | Yes | No | No |
| full_mutation_matrix.csv | SI | Yes — 270-row Firebase call-site data underlying the SSOT audits | SSOT.md (referenced) | Yes | No | No |

## Design System Thread

| Original File | Category | Knowledge Extracted? | Destination | Archived? | Obsolete? | Duplicate? |
|---|---|---|---|---|---|---|
| design-system-audit.md | DS | Yes | DESIGN_SYSTEM.md | Yes | Superseded by v2 | Partial — see v2 |
| design-system-audit-v2.md | DS | Yes — latest of the two | DESIGN_SYSTEM.md | Yes | No | Supersedes v1 |
| farm-design-system-audit-3.1.md | DS | Yes — Sprint 3 re-verification, states plainly what Sprint 2 already resolved | DESIGN_SYSTEM.md | Yes | No | No |
| design-tokens-spec-3.2.md | DS | Yes — token extraction plan, matches confirmed-merged CSS tokens | DESIGN_SYSTEM.md | Yes | No | No |
| architecture-audit-phase11.md | DS | Yes — builds on Design System Audit v1/v2 | DESIGN_SYSTEM.md | Yes | No | No |
| refactoring-blueprint-phase12.md | DS | Yes — execution plan for Phase 11's findings | DESIGN_SYSTEM.md | Yes | No | No |
| execution-playbook-phase13.md | DS | Yes — 6-sprint plan, explicitly conditional language throughout | DESIGN_SYSTEM.md | Yes | **Proposed file structure confirmed not merged** | No |
| farm-os-future-ui-architecture.md | DS | Yes — redesign scope statement | DESIGN_SYSTEM.md | Yes | No | No |
| farm-os-ux-constitution-v1.md | DS | Yes — governing principles | DESIGN_SYSTEM.md | Yes | No | No |
| farm-os-design-execution-blueprint.md | DS | Yes | DESIGN_SYSTEM.md | Yes | No | No |
| farm-os-component-catalog.md | DS | Yes — explicit about built-vs-new components | DESIGN_SYSTEM.md | Yes | No | No |
| BranchA-clean-final.zip | BIN | No — binary, not read | Archived as-is | Yes | Status unconfirmed vs. live repo | No |
| BranchA-real-changes.patch | BIN | No — binary/diff, not read | Archived as-is | Yes | Status unconfirmed vs. live repo | No |
| Patch-A-Sprint-3.8-Backup.zip | BIN | No | Archived as-is | Yes | Status unconfirmed | No |

## Service Worker / Sync ("Branch B") Thread

| Original File | Category | Knowledge Extracted? | Destination | Archived? | Obsolete? | Duplicate? |
|---|---|---|---|---|---|---|
| sw-audit-sprint2-task2.2.md | SW | Yes — initial investigation | OPEN_DECISIONS.md (summarized) | Yes | Superseded by later Sprint 2 passes | No |
| sw-migration-audit-2.3.md | SW | Yes | OPEN_DECISIONS.md | Yes | No | No |
| sw-readiness-fix-plan-2.3.3.md | SW | Yes | OPEN_DECISIONS.md | Yes | No | No |
| sw-activation-readiness-2.3.2.md | SW | Yes | OPEN_DECISIONS.md | Yes | No | No |
| sw-activation-prep-2.4.1.md | SW | Yes | OPEN_DECISIONS.md | Yes | No | No |
| sw-bootstrap-coverage-2.4.2.md | SW | Yes | OPEN_DECISIONS.md | Yes | No | No |
| sw-activation-strategy-2.4.md | SW | Yes | OPEN_DECISIONS.md | Yes | No | No |
| rollback-recovery-design-2.4.5.md | SW | Yes — design only, never implemented | OPEN_DECISIONS.md | Yes | No | No |
| pre-activation-review-2.4.4.md | SW | Yes | OPEN_DECISIONS.md | Yes | No | No |
| production-env-validation-2.5.1.md | SW | Yes | OPEN_DECISIONS.md | Yes | No | No |
| hosting-hardening-design-2.5.2.md | SW | Yes — design only | OPEN_DECISIONS.md | Yes | No | No |
| real-environment-validation-2.4.7.md | SW | Yes — **final status: NOT READY, confirmed open bugs, conflict with separate-session memory flagged** | RISK_REGISTER.md, OPEN_DECISIONS.md | Yes | No | No |
| capacitor-boundary-audit-2.2.1.md | SY | Yes | OPEN_DECISIONS.md | Yes | No | No |
| sync-architecture-design-2.2.2.md | SY | Yes | OPEN_DECISIONS.md | Yes | No | No |
| sync-boundary-definition-2.2.3.md | SY | Yes | OPEN_DECISIONS.md | Yes | No | No |
| sync-script-design-2.2.4.md | SY | Yes — design/pseudocode only | OPEN_DECISIONS.md | Yes | No | No |
| conditional-sync-review-2.2.5.md | SY | Yes | OPEN_DECISIONS.md | Yes | No | No |
| sync-manifest.json | SY | Yes — tool config, referenced not fully parsed | OPEN_DECISIONS.md | Yes | Tool not found in live repo | No |
| README.md (sync-apk) | SY | Yes — tool usage/safety guarantees | OPEN_DECISIONS.md | Yes | Tool not found in live repo | No |
| dead-code-audit-sprint2.md | HR | Yes — **corrects earlier assumption about `activity.html`/`pages/births.js`**, farm-apk/www scope | RISK_REGISTER.md | Yes | No | No |
| task-2.2.7-report.json | HR | Minimal — status log | Archived only | Yes | Yes — progress log, no durable knowledge | No |
| task-2.3.1-report.json | HR | Minimal | Archived only | Yes | Yes | No |
| task-2.3.5-report.json | HR | Minimal | Archived only | Yes | Yes | No |
| task-2.4.9-report.json | HR | Minimal | Archived only | Yes | Yes | No |
| last-sync-report.json | HR | Minimal | Archived only | Yes | Yes | No |
| patch-a-inventory.json | HR | Minimal — file listing | Archived only | Yes | Yes | No |
| BranchA-clean-final.zip, repo4-frozen-source.zip, farm-project-merge-ready.zip | BIN | No | Archived as-is | Yes | Status unconfirmed | No |

## Uncategorized / Standalone

| Original File | Category | Knowledge Extracted? | Destination | Archived? | Obsolete? | Duplicate? |
|---|---|---|---|---|---|---|

*(No files fell into this category — every artifact was placed in one of the three threads above.)*

## Live Repository Files (Not Documentation Artifacts — Not Consolidated)
`index.html`, `activity.html`, `offline.html`, `users.html`, `login.html`, `settings.html`, `animals.html`, `animal-detail.html`, `dashboard-sample.html`, `shared.js`, `firebase.js`, `breeding.js`, `inventory.js`, `reports.js`, `health.js`, `finance.js`, `production.js`, `sync-apk.js`, `sw.js`, `sw-register.js`, `styles.css`, `logo.svg`, `logo-icon.svg`, `logo-dark-full.svg`, `logo-icon-dark.svg`, `favicon-16/32/192/512.png`, `apple-touch-icon.png` — these are code/asset files included in the archive, not knowledge documents. **Not modified or consolidated by this pass** — their relationship to the live repository (are they the current versions, proposed replacements, or a snapshot?) is unconfirmed and belongs in `OPEN_DECISIONS.md`'s "files referenced but not found" section where relevant.

## Nested Historical Code Snapshots (`mnt/user-data/outputs/...`, 22 files)
`animals-migration/`, `bl-01/`, `bl-02/`, `bl-03/`, `phase3-inventory-reports/`, `repo4-checkpoint/`, `repo4-phase1a/`, `repo4-phase1b/`, `repo4-phase2a/`, `repo4-phase2b/`, `repo4-phase2c/`, `repo4-phase2c-iter2/`, `repo4-phase2c-iter3/`, `repo4-phase2d/`, `repo5-priority1/`, `repo5-priority2/`, `theme-logo-update/`, `updated-files/`, `updated-pages/` — each a point-in-time snapshot of `animals.html`/`shared.js`/`styles.css`/`login.html`/`settings.html`/`breeding.js`/`inventory.js`/`reports.js`/`offline.html`/`sw.js` from a specific implementation phase.
**Category: Obsolete (all).** Every one of these is superseded by whatever the current live repository actually contains at the corresponding path — none were read in full or diffed against current state; they are preserved as historical checkpoints only, per this project's own established "one atomic commit" discipline of tagging pre/post state at every phase.
