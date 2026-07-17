# REPORTS-INTELLIGENCE-TAB.md

**Sprint 8 (v1.1), first post-release feature. Pure composition -- zero new intelligence, zero new scoring logic.**

## What This Adds
A 5th tab, "الذكاء التشغيلي" (Operational Intelligence), on `reports.html`, alongside the existing Herd/Finance/Health/Breeding tabs. Surfaces the Sprint 1-5 intelligence engines' output in the formal reports system for the first time -- previously, this data only existed as live dashboard widgets, with no printable/exportable report equivalent.

## Discovery Findings (Before Any Code Was Written)
- `pages/reports.js`'s `_data` object had zero fields for `production_log`, `weight_alerts`, `production_alerts`, or `daily_tasks` -- confirmed via direct read of the file, not assumed.
- `reports.html` is already correctly gated by `can('reports')` at the page level -- no new permission logic was needed for the new tab.
- The existing tab-switching (`switchTab`/`renderTab`), KPI-card (`renderKPICard`), table (`renderDataTableWrapper`), and chart (`mkChart`) mechanisms were all directly reusable without modification.

## What Was Reused, Explicitly
- **`window.evaluateOperationalPriority()`** (Sprint 5) -- called per-candidate-animal, exactly as `dashboard.html`'s own ranking does. Zero scoring logic duplicated.
- **`window.rankOperationalPriorities()`** (Sprint 5) -- the exact same tie-breaking rules apply here as on the dashboard.
- **`renderDataTableWrapper`**, **`renderKPICard`** -- the same shared components every other tab already uses.
- **`can('reports')`** -- the existing page-level permission gate, unmodified, correctly covers the new tab.

## What's Genuinely New
- 4 new `fbGet` reads added to the page's existing `Promise.all` batch (`production_log`, `weight_alerts`, `production_alerts`, `daily_tasks`) -- additive, no existing read touched.
- `renderIntelligenceTab()` + `renderIntelligenceRanking()` -- page-local presentation functions (candidate selection + rendering), following this project's own established convention that this kind of page-specific orchestration lives in the page's own script, not in `shared.js` (matching `dashboard.html`'s own `renderUnifiedPriorities`).
- A 7th Excel export sheet ("الذكاء التشغيلي"), built from the same `evaluateOperationalPriority()` calls.
- One additional line in the WhatsApp summary (a simple synchronous count, not the full async ranking -- kept proportionate to a brief share-message format).

## A Real Bug Caught During This Sprint's Own Testing
The KPI-count test initially failed -- not because the feature was broken, but because the test itself queried for a `<small>` element, a pattern that worked for `dashboard.html`'s own hand-written inline markup in Sprint 6 but does not match `renderKPICard`'s actual DOM structure (`<span class="kpi-label">` / `<div class="kpi-value">`), which `reports.js` uses instead. Found by reading `renderKPICard`'s real source, not by guessing a second time.

## Testing
`tests/data-integrity/reports-intelligence-tab.spec.js` -- 7 tests: tab rendering, real-candidate ranking, empty-state safety, KPI-count accuracy (including a resolved alert correctly NOT counting), regression safety on the four pre-existing tabs, Excel export execution, and permission gating (using `worker`, a role confirmed via direct source read to lack `reports`).

## Future Extension
Any future intelligence engine (e.g., a hypothetical Breeding Intelligence) would extend this tab the same way Sprint 5 was designed to extend: add its read-only evaluate call inside the candidate loop, no change to the ranking, rendering, or export logic required.
