# PREDICTIVE-ENGINE.md

**5 functions, shared.js. No new architecture -- every function is either a thin wrapper reusing an existing engine, or a small, explainable statistical/rule-based calculation over data the certified SSOT already owns.**

## Architecture

```
Weight SSOT (animals/{id}/weights)
        |
        v
window.forecastWeight(animalId, animalTag)     <- NEW: linear extrapolation

Production Intelligence (Sprint 4)
        |
        v
window.forecastProduction(animalId, animalTag, type)  <- REUSES evaluateProductionKPIs() verbatim

Health Intelligence (Sprint 3) + vaccinations SSOT
        |
        v
window.forecastHealthRisk(animalId, animalTag, barn, windowDays)  <- baseline REUSED, projection is rule-based

daily_tasks + vaccinations + breeding SSOT
        |
        v
window.forecastTaskWorkload(windowDays)        <- NEW: window-count aggregation

        all four above
              |
              v
window.forecastFarmSummary(animals, health, weightAlerts, production)  <- pure composition
```

## Why This Is Not Machine Learning
No model is trained. No weights are learned from data. Every number in every forecast can be traced to a specific, named arithmetic operation over specific, named fields -- confirmed live for all 5 functions before any test was written (docs/features/PREDICTIVE-DISCOVERY-FINDINGS.md). Calling the same function twice with the same input data always produces the exact same output -- verified directly by a dedicated test (predictive-intelligence.spec.js, "weight forecast is deterministic").

## Reuse, Explicitly
- forecastProduction() performs zero new calculation -- it calls evaluateProductionKPIs() and relabels the result. A dedicated test confirms forecast.trendPct equals kpi.trendPct exactly, proving no divergent recalculation exists.
- forecastHealthRisk()'s baseline is evaluateHealthRisk()'s own real score -- never recomputed. Only the projected addition (a pending vaccination becoming overdue) is new logic, and it reuses HEALTH_RISK_WEIGHTS.missedVaccination -- the exact same constant Health Intelligence itself uses for the same fact, not a second, forecast-only weight invented separately.
- All candidate-selection logic (which animals to evaluate) reuses the exact pattern established in Sprint 5/8/9 -- animals already showing a real signal, never the full herd.

## Honesty Constraints, Enforced in Code
- Fewer than 2 weight records -> forecastWeight() returns confidence:'low', trend:null -- never a guessed number.
- No scheduled future event within the health-risk window -> forecastHealthRisk() returns the current score unchanged, confidence:'low' -- never an invented trend.
- Every forecast's evidence array cites the specific data (record count, date span, vaccination name) that produced the number -- nothing is asserted without a traceable basis.

## Performance
No new Firebase collection is introduced. forecastFarmSummary() evaluates only candidate animals (already-signaled, per the established pattern), not the full herd -- a dedicated performance test confirms 10 candidates complete well within a reasonable bound.
