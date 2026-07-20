# ANALYTICS-DISCOVERY.md

## What Already Exists (Confirmed by Direct Source Read)

**KPIs/Charts (reports.js, 6 existing tabs):** Herd (population, death rate, fertility rate, breed/barn distribution), Finance (income/expense, 6-month rolling monthly chart via buildMonthlyFin), Health (diagnosis/medication frequency, vaccination status), Breeding (fertility by breed, 6-month monthly births via buildMonthlyBreeding), Intelligence (Sprint 8: reuses evaluateOperationalPriority), Forecast (v1.2: reuses forecastWeight/forecastProduction/forecastHealthRisk/forecastTaskWorkload).

**Dashboard (Sprint 6):** a "today" focused Analytics Grid -- 14-day production trend, herd population trend, health status distribution -- all short-window, current-state oriented, distinct in purpose from what this sprint builds.

**Existing period-bucketing patterns:** buildMonthlyFin(fin)/buildMonthlyBreeding(br) (pages/reports.js) -- both hand-written, 6-month rolling windows, single-purpose. Zero quarterly aggregation exists anywhere -- confirmed via exhaustive search.

**Chart infrastructure:** mkChart(id, cfg) (pages/reports.js) -- a thin wrapper around new Chart(ctx, cfg), destroying any prior instance on the same element id first. Accepts any valid Chart.js config -- line/bar/pie/radar/area are all already supported by construction, no new initialization pattern needed.

## The Critical Design Constraint This Discovery Surfaced
Every certified intelligence engine (evaluateHealthRisk, evaluateProductionKPIs, evaluateOperationalPriority, evaluateWeightAlert) computes CURRENT state from CURRENT data -- none of them can be asked "what would this have scored on a past date." Attempting to retroactively run these engines against historical data would mean either duplicating their internal logic with a new as-of-date parameter (a second implementation of certified logic, explicitly forbidden) or fabricating a result (explicitly forbidden by Phase 7's "no hallucinated insights" rule, which this project applies as a general principle, not just to Phase 7).

Resolution: this sprint's analytics are built entirely from real, already-timestamped historical records -- when an alert was detected (weight_alerts.detected_at, production_alerts.detected_at), when a task was created or completed (daily_tasks.created_at/completed_at), when a vaccination was done (vaccinations.done_date), when a birth or death actually occurred (breeding.actual_birth, animals.died_at -- confirmed a real, structured field, already used for a similar chronological-event purpose in animals.html). A "Herd Health Trend" here means "how many health-related events happened per period," not a fabricated retroactive risk score.

## Confirmed SSOT Per Domain (Read-Only for This Sprint)
Weight: weight_alerts (Sprint 2). Health: health, vaccinations (pre-existing + Sprint 3). Production: production_log, production_alerts (Sprint 4). Priority: composed live via evaluateOperationalPriority (Sprint 5), never persisted, so trend analysis here uses the alert/notification records its constituent engines already write, not the composite score itself. Tasks: daily_tasks (Sprint 1). Birth: breeding. Mortality: animals.died_at.

## What computeMetrics() Already Provides (Not Duplicated)
pages/reports.js's computeMetrics() already computes current-snapshot herd/finance/health/breeding numbers reused directly by this sprint's Executive Summary where applicable (e.g., current herd size) -- never recalculated a second way.
