# PREDICTIVE-MODEL.md

**No machine learning, no AI API, anywhere in this sprint. Every formula below is arithmetic over real, historical, already-owned data.**

## Pressure Comparison (predictTreatmentOverload / predictVaccinationPressure)
```
upcoming = forecastTaskWorkload(windowDays).{existingTasks | expectedVaccinations}
baseline = average(last 8 real weeks' equivalent count, via computeFarmAnalytics('week', 8))
ratio = baseline > 0 ? (upcoming - baseline) / baseline : (upcoming > 0 ? 1 : 0)
pressure = ratio >= 1.0 ? 'high' : ratio >= 0.5 ? 'elevated' : 'normal'
```
Both thresholds (0.5, 1.0) are named constants (PREDICTION_PRESSURE_THRESHOLDS), not inline magic numbers, and are not recalibrated per call.

## Breeding Window (predictBreedingWindow)
```
for each dam with births B = [d1, d2, ..., dn] sorted ascending, n >= 2:
  intervals = [d(i+1) - d(i) for i in 1..n-1]   (in days)
  avgInterval = mean(intervals)
  predictedNextBirth = d(n) + avgInterval
  daysUntil = predictedNextBirth - today
confidence = n >= 3 ? 'medium' : 'low'   (n == 1 => no prediction at all)
```
Entirely per-dam -- no herd-wide or species-wide average is ever substituted for a dam's own history, even when her own history is thin.

## Farm Insights Thresholds
| Insight | Fires when... |
|---|---|
| Rising health risk | forecastFarmSummary().expectedRisks > 0 |
| Declining weight | forecastFarmSummary().expectedDecliningWeight > 0 |
| Vaccination pressure | predictVaccinationPressure(7).pressure not 'normal' |
| Task/treatment pressure | predictTreatmentOverload(7).pressure not 'normal' |
| Breeding window | at least one predictBreedingWindow() result with 0 <= daysUntil <= 14 |

## Confidence Assignment, Consolidated
| Source | high | medium | low |
|---|---|---|---|
| Health risk insight | 2+ animals in riskDetail | 1 animal | -- |
| Weight decline insight | -- | always (per-animal confidence already folded into candidate selection) | -- |
| Vaccination/task pressure | pressure is 'high' | pressure is 'elevated' | not shown if 'normal' |
| Breeding window | -- | any impacted dam has 3+ births | all impacted dams have exactly 2 births |

## What This Model Deliberately Does Not Do
No seasonality adjustment, no multi-variable regression, no confidence interval computed from a statistical distribution -- every method here is a simple, named, hand-checkable comparison, matching this project's own established precedent (forecastWeight()'s own 2-point linear extrapolation, evaluateProductionKPIs()'s own week-over-week comparison) rather than introducing a new class of technique for this sprint alone.
