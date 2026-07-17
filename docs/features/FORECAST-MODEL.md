# FORECAST-MODEL.md

**Every formula below is statistical or rule-based, using only data already in the certified SSOT. Nothing is machine-learned; nothing invents a new data source.**

## 1. Weight Forecast
**Method:** Linear extrapolation from observed rate of change. `dailyRate = (latestWeight - oldestWeightInWindow) / daysBetween`. Projected weight at N days = `latestWeight + dailyRate * N`, for N in {7, 14, 30}.
**Trend label:** `stable` if the 30-day projected change is within 3% of current weight, else `rising`/`declining` by sign.
**Confidence:** `high` with 4+ weight records, `medium` with 2-3, and no forecast at all (`null`) with fewer than 2 -- a single data point cannot support any rate calculation.
**Explicitly not done:** no seasonality, no non-linear curve fitting -- a simple, explainable rate, matching this project's own "explainable, not a black box" precedent from every prior intelligence engine.

## 2. Production Forecast
**Method: direct reuse, not recalculation.** `window.evaluateProductionKPIs()`'s existing `trend`/`trendPct` fields ARE the forecast -- `rising` maps to `improving`, `declining` stays `declining`, `stable` stays `stable`. This is the one forecast in this initiative that required zero new statistical logic, only relabeling an already-computed classification for a forecast-facing UI.
**Confidence:** derived from the engine's own existing `consistency` value -- low coefficient-of-variation (<0.3) means `high` confidence in the trend holding; otherwise `medium`.

## 3. Health Risk Forecast
**Method:** Start from `evaluateHealthRisk()`'s current, real score. Adjust forward ONLY for changes that are already scheduled and knowable: a `pending` vaccination whose `scheduled_date` falls within the forecast window and is not yet overdue will, if unaddressed, become overdue -- contributing the exact same +20 (`HEALTH_RISK_WEIGHTS.missedVaccination`) Health Intelligence already assigns to a missed vaccination, applied here as a projected addition, not a new weight invented for forecasting.
**Explicitly not done:** no projection for hypothetical future illness, no assumption that an active treatment's withdrawal period ending changes the score -- Health Intelligence's own model does not score withdrawal periods as a distinct factor, so this forecast does not fabricate one. If no scheduled event falls in the window, the forecast is simply "no known change" at low confidence, not a guessed trend.
**Level thresholds:** identical to Health Intelligence's own (Low 0-24 / Medium 25-49 / High 50-74 / Critical 75-100) -- one consistent scale, not a second one.

## 4. Task / Workload Forecast
**Method:** A window-count aggregation, not a model. Counts existing `daily_tasks` (not done, due within the window), `vaccinations` (pending, `scheduled_date` within the window), and `breeding` (pregnant, `expected_birth` within the window). All three are real, already-scheduled fields -- this forecast counts what is already known to be coming, it does not predict new, unscheduled work.

## 5. Farm Forecast Summary
Composes the above across candidate animals (same candidate-selection pattern established in Sprint 5/8/9 -- animals already showing a real signal) plus the herd-wide task forecast -- pure aggregation, no new calculation of its own.

## Confidence Model, Stated Once
Three tiers only: high (enough data points / low variance), medium (some data, some uncertainty), low or null (not enough basis to forecast at all -- explicitly returned rather than guessed). No forecast in this system ever asserts confidence it cannot support with the underlying data's own volume or consistency.
