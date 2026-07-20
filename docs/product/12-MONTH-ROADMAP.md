# 12-MONTH-ROADMAP.md

## Quarter 1
**Features:** Epic 1 (Automated Task Generation) + Epic 2 (Weight-Trend Alerting) — both Critical, both low-dependency, both deliverable without new infrastructure.
**Infrastructure:** Free-tier error tracking (from `docs/reliability/OBSERVABILITY-PLAN.md`); resolve `bayan.html`/`activity.html` permission status (mandatory items from the certification).
**Testing:** Extend the regression suite to cover the two new Q1 features; add the offline-scenario tests flagged as missing in `docs/reliability/OFFLINE-RELIABILITY-REVIEW.md`.
**Documentation:** Update `docs/architecture/DATA_MODEL.md`-equivalent for the new task-generation event hooks.
**Technical debt:** Consolidate `dashboard.html`'s 3 redundant `animals` fetches (small, safe, deferred from the certification pass).

## Quarter 2
**Features:** Begin Epic 3 (Genetic/Pedigree Analytics) *if and only if* the Research module's blocking architectural decisions are resolved by end of Q1 — otherwise substitute Feed Conversion Analytics (High priority, no blocking dependency) from the gap analysis.
**Infrastructure:** Establish a dev/staging Firebase environment (flagged as a real operational gap, not yet closed).
**Testing:** Add pedigree-traversal edge-case tests (self-referential loops, missing parent records) if Epic 3 proceeds.
**Documentation:** `docs/product/CAPABILITY-MAP.md` refresh reflecting Q1 deliveries.
**Technical debt:** Formal Service Worker activation decision (activate fully or retire — no longer leave dormant).

## Quarter 3
**Features:** Financial Forecasting (High priority) — budgeting/projected-vs-actual on top of the existing finance ledger, no new SSOT.
**Infrastructure:** Automated Firebase backup mechanism — the single most consequential gap named at certification, addressed here rather than deferred indefinitely.
**Testing:** Backup/restore drill as a real, executed test, not just a written plan.
**Documentation:** `docs/release/ROLLBACK-PLAN.md` updated once backups exist (currently documents their absence).
**Technical debt:** `.indexOn` rules added for any query patterns introduced by Q1-Q2 features, before they're needed under load rather than after.

## Quarter 4
**Features:** Multi-farm architectural groundwork begins *only if* real evidence of need has emerged by this point (per `docs/architecture/SCALABILITY-REVIEW.md`'s own recommendation not to build this speculatively) — otherwise this quarter absorbs whichever Medium-priority gap-analysis item has become highest-value based on actual usage patterns observed through Q1-Q3.
**Infrastructure:** Push/email notification channel for time-sensitive events (currently in-app only).
**Testing:** Full-suite performance benchmarking against a year of accumulated real data — the first point where `fbGet()`'s full-collection-fetch pattern can be measured against real numbers instead of projected.
**Documentation:** Annual `docs/architecture/FIVE-YEAR-RISK-ANALYSIS.md` refresh — re-forecast with a year of real evidence instead of Year-0 projection.
**Technical debt:** Retrospective — formally close or re-scope any item from this roadmap that didn't ship, rather than letting it silently vanish.
