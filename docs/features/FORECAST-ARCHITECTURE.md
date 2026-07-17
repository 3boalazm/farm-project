# FORECAST-ARCHITECTURE.md

## The Core Decision: Aliases Where Duplication Would Otherwise Occur
Per docs/features/PREDICTIVE-DISCOVERY.md's findings, 3 of the 6 requested predict* functions map almost exactly onto an existing, certified, read-only forecast* function. Building a second, separately-named implementation of the same calculation would be exactly the "duplicated engine" this sprint's own rules forbid. The resolution:

```
predictWeightRisk(animalId, animalTag)        = thin call to window.forecastWeight()      [ALIAS]
predictMilkTrend(animalId, animalTag)         = thin call to window.forecastProduction()  [ALIAS]
predictTaskLoad(windowDays)                   = thin call to window.forecastTaskWorkload() [ALIAS]

predictTreatmentOverload(windowDays)          = NEW -- herd-wide, baseline-compared
predictVaccinationPressure(windowDays)        = NEW -- herd-wide, baseline-compared
predictBreedingWindow(animals, breeding)      = NEW -- genuinely absent from the existing layer

generateFarmInsights()                        = NEW -- structured composition layer
```

An "alias" here is not a rename in place (the original forecast* names stay exactly as they are, since Sprint 10/11 code and tests already depend on them) -- it is a new, additional, one-line function that calls the existing one and returns its result unmodified. This satisfies Sprint 12's naming request without introducing a second calculation.

## The Two Genuinely New Herd-Wide Functions, Precisely
predictTreatmentOverload()/predictVaccinationPressure() answer a question the existing per-animal/count-only functions don't: not just "how many," but "is that number unusually high." Both:
1. Count the real, already-scheduled upcoming events within the window (reusing forecastTaskWorkload()'s own counting, never re-implementing it).
2. Compare that count against a real historical baseline -- the same-length window's average from the past, computed via window.computeFarmAnalytics() (Sprint 10), never a second bucketing implementation.
3. Report pressure: 'normal'|'elevated'|'high' based on how far above the historical average the upcoming count sits -- a named, fixed threshold (>50% above average = elevated, >100% = high), not an invented per-call heuristic.

## predictBreedingWindow(), the One Genuinely New Prediction
Reads breeding records with status==='born' to find each dam's historical inter-birth interval (time between consecutive births for the same mother_tag), then, for does not currently pregnant, projects a plausible next-breeding window from her own last birth date plus her own historical average interval -- entirely from her own real history, never a species-wide assumption invented for this feature. Animals with fewer than 2 historical births return no prediction (insufficient basis), exactly the same honesty standard forecastWeight() already applies to insufficient weight history.

## generateFarmInsights(): Composition, Not Calculation
Calls forecastFarmSummary(), predictTreatmentOverload(), predictVaccinationPressure(), and predictBreedingWindow() -- reads their outputs, and for each one that crosses a real, named threshold, composes one insight object: {text, evidence, confidence, impactedAnimals, suggestedAction}. No new number is computed inside this function; every field traces to one of the four calls above.

## Analytics Forecast Charts (Phase 6)
Extends analytics.html's existing charts (not a new chart, not a new page) -- the same mkChart() call, same canvas, with a second dataset appended showing the last 2-3 historical points plus 1-2 projected points, styled with borderDash (Chart.js's own dashed-line option, no new charting capability needed). The projected points come from forecastProduction()'s own real projections, applied at the herd-aggregate level where the existing chart is herd-aggregate.

## Notification Integration (Phase 9), Confidence-Gated
One new trigger inside notifications-service.js's existing NS.checkAll() (the same integration point Sprint 9 already used for the Unified Priority trigger) -- fires only when generateFarmInsights() produces an insight with confidence==='high'. Uses the exact same NS.save()/dedup mechanism every other trigger already uses; no second notification pathway.

## Read-Only Guarantee, Structural
Every new function in this sprint is async function(...){ ... return {...}; } with no fbPost/fbPatch/fbDelete call anywhere in its body -- verified directly, not just by convention, via a dedicated test that intercepts every write call during a full generateFarmInsights() run and asserts the intercepted list is empty.
