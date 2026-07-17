# RELEASE-v1.7.0.md

## بيان المزرعة (Bayan Farm) -- v1.7.0 Production Release

This release certifies the repository after Sprint 14 (Inventory & Feed Management), consolidating everything built since the v1.0.0-rc1 baseline: Notifications, Predictive Intelligence, Analytics, Workflow Orchestration, Farm Insights, Finance, and Inventory -- seven major capability layers, each verified to reuse rather than duplicate the certified engines beneath it.

## What's Actually New Since v1.0.0-rc1
See CHANGELOG-v1.7.0.md for the full, commit-by-commit history. In summary: this application evolved from an operational record-keeping system into one with active notifications, statistical forecasting, historical analytics, cross-domain workflow automation, evidence-based farm insights, a fully analyzed financial layer, and an inventory system with real stock deduction -- while every single one of these additions was preceded by a mandatory discovery phase specifically checking whether the capability already existed, and in three cases (Notifications' producer, Finance's category system, Inventory's stock fields), it substantially did, and was extended rather than rebuilt.

## What This Release Fixed
Two real, independently discovered production blockers, both fixed and verified live in this same certification pass:
1. production.html and tasks.html -- two major feature pages -- had no reachable navigation link anywhere in the application.
2. import.html had a genuine JavaScript syntax error breaking the entire page, on every load.

Full detail in docs/release/REPOSITORY-DISCOVERY-v1.7.0.md and UI-UX-CERTIFICATION-v1.7.0.md.

## Certification Summary
- Architecture: every domain (Weight, Health, Production, Tasks, Notifications, Workflow, Analytics, Forecasting, Finance, Inventory) confirmed to have exactly one authoritative engine.
- Performance: measured, not estimated, at data volumes exceeding this application's realistic current scale -- no slowdown found.
- Security: re-audited against every dimension this project's own certification history established -- no new regression.
- UI/UX: 116/116 clean across a 29-page x 2-viewport x 2-theme automated sweep.
- Regression: 189/189 tests passing on a clean run.
- Safety scanner: 0 CRITICAL.

## Where to Go From Here
docs/release/PRODUCTION-CERTIFICATION-v1.7.0.md for the full scored assessment. docs/release/KNOWN-LIMITATIONS.md for every honestly-remaining gap. docs/release/DEPLOYMENT-CHECKLIST.md and UPGRADE-GUIDE-v1.7.0.md for actually shipping this.
