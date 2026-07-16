# Repository Charter — بيان المزرعة (Bayan Farm)

**Status: Permanent reference. Consolidated from ~85 architecture/audit/certification documents spanning three parallel engineering threads. See `docs/archive/ARTIFACT_MAPPING.md` for full source traceability.**

## What This Project Is

A production PWA for livestock management at Al-Ameria Model Farm (goat/sheep herds), Arabic-first, built on vanilla JS/HTML/Bootstrap 5.3.3/Firebase RTDB (REST)/Vercel, with a Capacitor Android wrapper (`farm-apk/`, separate repo). Actively used with real farm data — every change requires production-grade caution.

## Three Engineering Threads (Distinct, Not Sequential)

This repository's history is **not one linear thread**. Three genuinely separate efforts exist, at different levels of completion:

1. **Core Business-Logic / SSOT Thread — CERTIFIED, LARGELY IMPLEMENTED.** Security stabilization → Repository 3 (UI/module migration) → Repository 4 (SSOT audit) → `architecture-freeze.md` (binding contract + roadmap) → this thread's own continuation (Priority 1/2, BL-01–09, Wave A/Weight, Wave B/Birth). This is the only thread with live-verified, production-relevant certification. See `docs/architecture/SSOT.md` and `docs/certification/`.
2. **Design System / UI Redesign Thread ("Branch A") — PROPOSED, NOT MERGED.** An extensive, well-reasoned visual/component redesign specification (Future UI Architecture → UX Constitution → Design Execution Blueprint → Component Catalog → Architecture/Refactoring/Execution playbooks). **Confirmed via direct repository inspection: the proposed file structure (`/js/shared/modal.js`, `gateway-writes.js`, etc.) does not exist in the live repo.** Only the CSS design-token layer (`--space-*`, `--text-*` in `styles.css`) is confirmed merged. Treat everything else in this thread as a specification for possible future work, not current state. See `docs/design/DESIGN_SYSTEM.md`.
3. **Service Worker / Offline / APK-Sync Thread ("Branch B") — EXTENSIVELY TESTED, NOT PRODUCTION-ACTIVATED.** Sprint 2's own final validation pass explicitly concluded **"NOT READY... no production activation, no public deployment"**, with confirmed open bugs (`registerServiceWorker()` never invoked on `login.html`/`settings.html` despite the script being loaded; `sw-register.js` missing from the sync manifest). **A real, unresolved conflict exists**: this project's own persistent memory (from a different session) states this exact bug was "found and fixed," while this artifact set's own latest validation says it was "not actually closed." This charter does not resolve that conflict — it is recorded here for a human to check directly against the live repo. `sw-register.js` and `tools/sync-apk/` do not exist in the current repo root as inspected. See `docs/backlog/OPEN_DECISIONS.md`.

## Canonical vs. Proposed — How to Tell Them Apart

- **Canonical (safe to build on):** anything in `docs/certification/` — Weight, Birth, Sale/Transfer, Modal Lifecycle. These were live-tested against the actual repository, repeatedly, adversarially.
- **Proposed (do not assume implemented):** everything under `docs/design/DESIGN_SYSTEM.md` and the SW/Sync findings in `docs/backlog/OPEN_DECISIONS.md`.
- **When in doubt:** check the live repository directly. This charter is a map, not a substitute for reading the code.

## Reading Order for a New Engineer

1. This file.
2. `docs/architecture/SSOT.md` — what the SSOT principle means here and where it's been applied.
3. `docs/certification/` — the four certified subsystems, in depth.
4. `docs/decisions/INDEX.md` — every approved architectural decision and its current implementation state.
5. `docs/backlog/VERIFIED_BACKLOG.md` and `OPEN_DECISIONS.md` — what's left, evidence-backed only.
6. `docs/repository/WORKING_CONTRACT.md` before touching any code.
