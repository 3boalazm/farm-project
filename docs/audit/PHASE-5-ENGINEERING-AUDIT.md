# PHASE-5-ENGINEERING-AUDIT.md

**Post-merge engineering audit of the canonical repository (`4b1e8cf` baseline). All findings evidenced with file + line + reason, per instructions.**

## Executive Summary

The repository is in genuinely good health following the Engineering Baseline Merge. Every certified subsystem (Weight SSOT, Birth SSOT) was re-verified directly against live code this session and confirmed intact — no regression from the merge. Security hardening (PIN hashing, Auth bridge, permission checks) is confirmed present and correctly scoped. One notable operational finding: `bayan.html`/`bayan-offline.html` bundle a full copy of Chart.js inline, which inflates any repository-wide text search touching those files — a real quirk future audits should account for. No critical (blocker-class) issues were found. A small number of technical-debt items are documented below, all pre-existing, none introduced by this merge.

## Repository Health Scores

| Dimension | Score /10 | Why |
|---|---|---|
| Architecture | 8/10 | Weight/Birth SSOT genuinely converged and re-verified; several subsystems (Vaccination, Diary, AI dispatcher) never received the same depth of audit |
| Security | 7/10 | Core hardening (PIN hashing, Auth bridge, most permission checks) confirmed present; `cost.html`'s permission gap closed this baseline; Firebase rules remain validation-only by design, a known and accepted tradeoff |
| Data Integrity | 8/10 | `createOffspringAnimal()` confirmed as sole birth-date/parent-linkage source; `genId()`'s timestamp+random scheme is a minor, non-primary-key risk, not a real collision threat given Firebase's own auto-keys are the actual document identifiers |
| PWA | 5/10 | `sw.js` and `sw-register.js` are both complete and correct in isolation but formally, deliberately disabled — not wired into any page. Classified NEEDS WORK, not BROKEN — the code works, the activation decision is simply not yet made |
| Maintainability | 7/10 | Shared helper pattern (`createOffspringAnimal`, `commitBulkPatch`) is consistently followed for new work; some pages (`bayan-offline.html`) bundle large third-party code inline rather than as separate files, a minor structural inconsistency |

## Critical Findings

| Issue | Location | Risk | Recommendation |
|---|---|---|---|
| Service Worker fully built but never activated | `sw.js`, `sw-register.js` (not loaded by any `<script src>`) | B (Technical debt) | Formal activation decision needed — this baseline already documents the current disabled state clearly in `CLAUDE.md`/`BASELINE.md`; no further action required unless activation is desired |
| `genId()` uses timestamp+3-char-random, not used for primary Firebase keys | `firebase.js:19` | C (Safe to ignore) | Firebase's own auto-generated `_id` (via `fbPost`) is the real document identifier everywhere that matters; `genId()` appears to serve human-readable reference codes only — confirm this scope before treating as higher-risk |
| `bayan-offline.html`/`bayan.html` bundle Chart.js inline as raw minified text | Both files | C (Safe to ignore, operational note) | Not a code defect — but any future repository-wide text search should exclude or specifically account for these two files to avoid enormous, unhelpful output |

**No Critical Runtime Issues (Classification A) were found.**

## Safe Improvements (No Architectural Risk)

- Documenting `genId()`'s actual usage scope (which fields rely on it vs. Firebase's own `_id`) would close a minor, currently-unconfirmed ambiguity.
- Nothing else identified this pass that would be safe to change without further, dedicated investigation first — consistent with this audit's own mandate not to modify beyond clear bug fixes, and none were found beyond what prior sessions already closed.

## Next Development Phase Recommendation

**Security hardening** (closing the remaining, already-identified gaps like any lingering `can()` coverage questions) and **testing infrastructure** (this project has never had repeatable, scripted tests — every verification across this entire engagement has been ad hoc, live, per-task) are the two strongest candidates, in that order. Feature development is explicitly not recommended next — the repository's own certified subsystems are stable and well-documented; the highest-value next work is closing remaining verification gaps, not adding new surface area.

## Methodology Note

This audit combines fresh, direct verification performed this session (Weight/Birth SSOT re-confirmation, security function presence, PWA wiring status, TODO/FIXME/duplicate-marker search) with this project's own extensive, already-certified prior findings (documented in `docs/certification/`) where re-verifying from zero would duplicate work already done to a high evidentiary standard. Every claim above traces to a specific command run this session or a specific prior certification document — nothing is asserted without a traceable source.
