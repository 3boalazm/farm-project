# DASHBOARD-INVENTORY.md

**Every finding below is from direct inspection of the current `dashboard.html` (784 lines, after 5 sprints of additive work), not assumed.**

## Genuine Duplication Found (The Real Finding This Sprint Exists to Catch)
**`priorityAlerts`'s high-risk-weight-alert entry directly overlaps with Sprint 5's Unified Priorities panel.** `priorityAlerts` (rendered at the very top of the page via `renderAlertCard()`) pushes a `'حالة وزن عالية الخطورة'` entry summarizing high-severity weight alerts -- the exact same underlying `weight_alerts` data that Sprint 5's panel immediately below it already surfaces (both in its aggregate count and, through Health Intelligence, in its per-animal ranking). A user sees the same fact twice, in two different visual formats, one screen-scroll apart. **This is the one genuine overlap this audit found -- fixed in Phase 3.**

## Confirmed NOT Duplicates (Checked Directly, Not Assumed)
- **"Health Status Distribution"** (herd census: healthy/under-treatment/dead counts) vs. Sprint 5's priority panel (per-animal operational ranking): different questions -- "what does the whole herd look like" vs. "which specific animals need attention right now." Legitimately complementary, confirmed by reading both computations directly.
- **"Production Trend"** (herd-wide daily milk total, last 14 days) vs. Production Intelligence (per-animal drop detection): different granularity, already established and confirmed during Sprint 4's own discovery phase -- re-confirmed here, not re-litigated.
- **Inventory/maintenance entries in `priorityAlerts`** (low meds, overdue maintenance, expiring meds): entirely outside any Sprint 2-5 intelligence engine's domain -- genuinely unique signals, not overlapping with anything.

## Dead/Unused UI Found
**`window.renderTopHealthRiskAnimals` and `window.renderProductionIntelligence`** (Sprint 3 and Sprint 4's own per-domain ranking functions) are still defined in `dashboard.html` but have not been called from the main render flow since Sprint 5 replaced them with the unified ranking. Confirmed via direct search: zero call sites remain. **Removed in Phase 3** -- not left as silent dead code, per this sprint's own "eliminate duplicated UI" mandate. (Their logic is not lost: `window.evaluateHealthRisk`/`window.evaluateProductionKPIs`, the actual engines, are untouched and remain fully callable from anywhere.)

## Confirmed Working, Kept As-Is
Hero KPI (herd total), Row 2 KPIs (goats/sheep/births by species), Farm Health Score (composite, herd-level), Today Summary (births/deaths/income/expense), Analytics Grid (Herd Population Trend, Health Status Distribution, Production Trend, Revenue vs. Expense), Recent Records, Recent Activity Timeline. None of these overlap with each other or with the intelligence panels -- each answers a distinct, real question.

## What Phase 3 Will Do About This
1. Remove the duplicated weight-alert entry from `priorityAlerts` (Sprint 5's panel already covers it, with more context -- evidence, confidence, cross-engine ranking).
2. Delete the two confirmed-dead ranking functions.
3. Reorganize the page into the explicit hierarchy in `docs/features/EXECUTIVE-DASHBOARD.md`, without touching any of the "confirmed working" sections' underlying computations.
