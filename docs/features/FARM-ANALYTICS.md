# FARM-ANALYTICS.md

## Dashboard vs. Analytics, Stated Precisely
dashboard.html answers "what does today look like" -- live-computed, current-state widgets. analytics.html (v1.3) answers "how has the farm changed over time" -- week/month/quarter aggregates of real, timestamped historical events. Neither recomputes the other; they read overlapping SSOT but ask different questions, exactly the same distinction this project already drew between Dashboard and Reports (Sprint 6/8).

## The 5 Categories, What Each Actually Measures
1. Productivity Index -- 0.6 * min(100, totalMilkInPeriod) + 0.4 * (taskCompletionRate * 100), a real weighted average, not a fabricated composite.
2. Herd Health Trend -- health record count, recovery rate (completed vs. active health records), vaccination completions, per period. Never a re-run of evaluateHealthRisk().
3. Production Trend -- milk/wool totals, births, deaths, weigh-ins recorded, consistency (coefficient of variation) -- all real counts/sums over production_log/breeding/animals.died_at.
4. Operational Efficiency -- task completion rate, real average response time (completed_at - created_at), automation rate, per period, from daily_tasks.
5. Risk Trend -- counts of when weight_alerts/production_alerts were actually detected, per period. The highest-risk period is whichever period had the most alert-detection events -- a real historical fact, not a projection.

## Why No Category Re-Runs a Certified Engine
Every certified engine (evaluateHealthRisk, evaluateProductionKPIs, evaluateOperationalPriority, evaluateWeightAlert) computes current state from current data. None can answer "what would this have scored last month" without either a second, parallel implementation (forbidden duplication) or a fabricated number (forbidden by this project's own "no hallucinated insights" principle, applied here as a general rule, not just to the AI-insights feature specifically). This sprint's analytics are built entirely from real, already-timestamped event records instead -- full reasoning in docs/features/ANALYTICS-DISCOVERY.md.

## A Real Refactor Made During This Sprint (Not a New Duplicate)
loadChartJS/mkChart/CHART_COLORS/textClr/gridClr were relocated from pages/reports.js to shared.js, byte-identical logic, so the new analytics.html page could reuse the exact same Chart.js wrapper instead of a second copy -- directly required by this sprint's own "never initialize Chart.js differently" mandate. Verified live, before and after: reports.html's existing charts render identically; a dedicated regression test locks this in.

## AI Insights, Concretely
Every insight is a template sentence gated on a real, computed period-over-period comparison -- if two periods aren't different enough to matter (or there isn't enough data), no sentence is generated for that category. A dedicated test confirms zero data produces zero insights, never a fabricated "nothing to report" filler line pretending to be data-backed.

## Exports
Excel (5 sheets, one per category) and WhatsApp (a proportionate summary + top 3 insights) extend the exact library/pattern reports.js already established. PDF is explicitly not built -- confirmed via exhaustive search, zero PDF infrastructure exists anywhere in this application; building one from scratch for this single feature would be new, unrequested infrastructure. exportAnalyticsExcel()'s existing _analyticsData reference is structured so a future PDF export, if that infrastructure is ever added elsewhere, could reuse it without any recalculation.

## Performance and Scalability
One Promise.all fetch per analytics computation, regardless of period count -- bucketing happens in-memory afterward. A dedicated performance test confirms 500 production records bucketed across 6 months complete well within a reasonable bound. Not engineered for a data volume this project has no evidence of needing yet, consistent with this project's own repeated scaling precedent.

## Testing
tests/data-integrity/farm-analytics.spec.js -- 14 tests: bucketing correctness, productivity-index math (hand-verified), risk-trend event-counting (not re-scoring), health recovery-rate accuracy, real response-time computation, insight-generation honesty (zero data -> zero insights), determinism, full page rendering with real chart counts, permission gating, dark/light mode, mobile, a 500-record performance bound, both exports, and a dedicated non-regression check confirming the Chart.js wrapper relocation did not break reports.js's existing charts.
