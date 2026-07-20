# PREDICTION-ENGINE.md

**8 functions total: 3 direct aliases, 3 genuinely new, 1 composition layer, 1 herd-wide breeding predictor. 100% read-only, verified by a dedicated test that intercepts every write call.**

## The 3 Aliases (Zero New Calculation)
```js
window.predictWeightRisk = (animalId, animalTag) => window.forecastWeight(animalId, animalTag);
window.predictMilkTrend = (animalId, animalTag) => window.forecastProduction(animalId, animalTag, 'milk');
window.predictTaskLoad = (windowDays) => window.forecastTaskWorkload(windowDays);
```
Each is verified, by a dedicated test, to return an object toEqual() (deep-equal) what calling the original forecast* function directly returns -- proving these are genuinely the same computation, not a look-alike reimplementation that could silently drift from the original.

## predictTreatmentOverload() / predictVaccinationPressure()
Both call a shared internal helper, _predictPressure(), which: (1) gets the real upcoming count from forecastTaskWorkload() (never re-counted), (2) gets a real historical baseline from window.computeFarmAnalytics('week', 8) (Sprint 10's own engine, 8 real past weeks, never re-bucketed), (3) compares the two with two named, fixed thresholds (50% above average = elevated, 100% above = high). Verified live: a mocked 8-week history averaging ~0.9 vaccinations/week against 6 scheduled this week correctly reports pressure:'high'; a week matching the baseline correctly reports 'normal'.

## predictBreedingWindow(animals, breedingRaw)
The one function in this sprint with no existing counterpart. For each dam with 2+ recorded births (breeding.status==='born'), computes her own average inter-birth interval from her own real dates, and projects her next window from her last birth plus that interval. A dam with only 1 recorded birth is excluded entirely -- not given a fabricated interval from a species average. A dam currently marked 'pregnant' is excluded (Sprint 1's expected_birth_approaching already covers her). Confidence is 'medium' at 3+ births, 'low' at exactly 2 -- never 'high', since even 3 data points is a thin basis for a biological interval.

## generateFarmInsights(animals, health, weightAlertsRaw, productionRaw)
Calls forecastFarmSummary(), predictVaccinationPressure(), predictTreatmentOverload(), and predictBreedingWindow() -- four calls, zero new arithmetic. Each produces at most one insight, gated on a real threshold already established by the function it calls (a non-zero expectedRisks count, a non-'normal' pressure level, a breeding window within 14 days). Every insight is {text, evidence, confidence, impactedAnimals, suggestedAction} -- verified by a dedicated test that every returned insight has all five fields.

## Read-Only Guarantee
Confirmed structurally (no fbPost/fbPatch/fbDelete call appears anywhere in this section of shared.js) and confirmed live (a dedicated test wraps every write function, runs a full generateFarmInsights() call including all four sub-calls, and asserts the intercepted write log is empty).

## Determinism
Two consecutive calls with identical mocked input data produce toEqual()-identical output -- confirmed by a dedicated test. No randomness, no machine learning, no external API call anywhere in this layer.
