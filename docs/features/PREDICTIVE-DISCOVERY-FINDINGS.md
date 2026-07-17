# PREDICTIVE-DISCOVERY-FINDINGS.md

**What each existing engine already exposes, checked directly in source before any forecasting code was written.**

## Critical Finding: Production Already Has a Forecast
`evaluateProductionKPIs()` (`shared.js`) already computes `trend: 'rising'|'stable'|'declining'` and `trendPct` -- a recent-vs-prior-week comparison. This is, functionally, already the "Stable/Improving/Declining" classification this initiative's Production Forecast requirement asks for. **The Production Forecast does not need a new calculation -- it reuses this field directly**, reframed for a forecast context rather than recomputed.

## Weight: Raw History Exists, No Existing Forecast
`evaluateWeightAlert()` reads `fbGet('animals/{id}/weights')`, sorted newest-first -- confirmed the exact access pattern. No trend *projection* exists yet, only current-state alert detection (loss/no-growth/missing). A weight forecast is new work, but reads the exact same certified SSOT, no new data source.

## Health: A Current Score Exists, Not a Trajectory
`evaluateHealthRisk()` returns a real, current `score` (0-100) and `level`, but is a snapshot -- it does not project forward. However, its own inputs include fields with known future dates already in the data: `vaccinations.scheduled_date` (a pending vaccination that will become overdue if unaddressed) and `health.withdrawal_end` (an active treatment-effect period with a known end date). A defensible, rule-based forecast is possible: project the CURRENT score forward by accounting for what will change if these already-scheduled dates pass -- not by inventing a new risk model.

## Tasks: Future-Dated Fields Already Exist
`daily_tasks.date`, `vaccinations.scheduled_date`, `breeding.expected_birth` are all real, existing fields with future dates already populated by normal use of the app. A task/workload forecast is a window-count aggregation of what's already scheduled -- not a new prediction model.

## What This Means for Scope
Every forecast in this initiative is either (a) direct reuse of an existing computed value (Production), (b) simple linear extrapolation from existing historical data (Weight), or (c) rule-based projection from already-known future dates (Health, Tasks) -- consistent with the explicit "no machine learning, only statistical and rule-based forecasting" mandate. Nothing here requires a new data source or a new intelligence engine architecture.
