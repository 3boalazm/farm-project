# PREDICTIVE-DISCOVERY.md

**The most consequential finding this discovery produced: a complete, certified, read-only predictive layer already exists in this repository, confirmed by direct source inspection before any Sprint 12 code was written. This document exists specifically to prevent duplicating it.**

## What Already Exists (Confirmed, Not Assumed)

shared.js already contains a "Predictive Intelligence Engine" section with 5 functions, all confirmed read-only (zero fbPost/fbPatch calls anywhere in that code region):

| Existing function | What it does | Overlaps with Sprint 12's request for... |
|---|---|---|
| window.forecastWeight(animalId, animalTag) | Linear extrapolation from real weight history (7/14/30-day projection, confidence from data-point count) | predictWeightRisk() -- near-total overlap |
| window.forecastProduction(animalId, animalTag, type) | Direct reuse of evaluateProductionKPIs()'s own trend field, relabeled | predictMilkTrend() -- near-total overlap |
| window.forecastHealthRisk(animalId, animalTag, barn, windowDays) | Projects evaluateHealthRisk()'s current score forward using known scheduled vaccination dates | Partially overlaps predictTreatmentOverload() (per-animal, not herd-wide) |
| window.forecastTaskWorkload(windowDays) | Window-count of scheduled daily_tasks/vaccinations/breeding events | Substantially overlaps predictTaskLoad() and predictVaccinationPressure() |
| window.forecastFarmSummary(...) | Composes the above across candidate animals into a farm-wide summary | Substantially overlaps generateFarmInsights()'s intended role |

Integration already exists, confirmed live in source, not assumed:
- Dashboard: window.renderFarmForecastSummary() -- a "Farm Forecast Summary" panel already renders on dashboard.html, populated from forecastFarmSummary().
- Animal Detail: window.renderAnimalForecast() -- a forecast section already renders on animal-detail.html, showing weight and health-risk projections for that specific animal.
- Reports: renderForecastTab() -- a 6th tab, "التوقعات", already exists on reports.html, showing the farm summary, a declining-weight table, and a rising-health-risk table.

Confirmed genuinely absent (real gaps, not duplicated by anything above):
- Notifications: zero forecast/prediction-related code anywhere in notifications-service.js -- every existing trigger fires on a current state (overdue, active, low-stock), never a projected future one. This is a real, new capability Phase 9 asks for.
- Analytics: computeFarmAnalytics() (Sprint 10) is exhaustively historical -- confirmed via its own architecture doc ("Analytics = historical insight"). No chart anywhere extends a historical line into a predicted, dashed continuation. This is a real, new capability Phase 6 asks for.
- predictBreedingWindow(): nothing in the existing forecast layer projects upcoming breeding-relevant timing from historical cycle patterns. Genuinely new.
- Structured, evidence+confidence+impacted-animals+suggested-action insights: forecastFarmSummary() returns raw counts, not composed sentences with this specific structure. generateFarmInsights(), as Phase 4 specifies it, is a genuinely new presentation/composition layer over the existing forecast functions' outputs -- not a new calculation engine.

## The Central Design Decision This Discovery Forces
Given "never duplicate any engine" is one of this sprint's own explicit, named rules, and given the overlap table above is not partial but near-total for 4 of the 6 requested predict* functions: this sprint's predict* functions are thin, directly-delegating aliases to the existing forecast* functions wherever the underlying calculation already exists. New logic is written only for what is confirmed genuinely absent: predictBreedingWindow(), a real historical-baseline comparison for "pressure"/"overload" framing (reusing Sprint 10's computeFarmAnalytics() for the baseline, never recalculating it), generateFarmInsights()'s structured composition, the Analytics forecast-chart extension, and the Notification integration.

## SSOT and Write Boundary, Reconfirmed
No new collection is needed -- every existing forecast* function already reads only certified SSOT (animals/{id}/weights, production_log, weight_alerts, health, vaccinations, daily_tasks, breeding). This sprint's genuinely new functions read the exact same collections, plus computeFarmAnalytics()'s own output (itself read-only) for historical baselines. Zero writes anywhere in this sprint, confirmed by design before implementation, not audited after.
