# ANALYTICS-ARCHITECTURE.md

## One Engine, Read-Only, Consumer Only
window.computeFarmAnalytics(granularity, periodCount) (shared.js) is the single analytics engine. It introduces exactly one new primitive -- period bucketing -- and otherwise only aggregates counts/rates over already-existing, already-timestamped records. It computes zero risk scores, zero priority levels, zero health/production classifications -- those remain the certified engines' exclusive responsibility.

## The One New Primitive: Period Bucketing
window.bucketByPeriod(records, dateField, granularity, periodCount) -- groups any array of timestamped records into week/month/quarter buckets. This generalizes the pattern buildMonthlyFin/buildMonthlyBreeding (pages/reports.js) already established for two specific domains, into one reusable utility any domain can use. It does not replace those two functions (out of scope, no behavior change requested) -- it is what every new trend calculation in this sprint uses instead of writing a sixth bespoke bucketing function.

## Composition, Not Recalculation

```
weight_alerts (Sprint 2)         -----\
health, vaccinations (Sprint 3)  ------\
production_log, production_alerts------> bucketByPeriod() -----> per-period counts/rates
  (Sprint 4)                     ------/         |
daily_tasks (Sprint 1)           -----/          v
breeding, animals.died_at        ----/    computeFarmAnalytics()
                                                   |
                                                   v
                                    5 analytics categories (all counts/
                                    rates over real historical records --
                                    never a re-run of a current-state engine)
                                                   |
                                                   v
                              generateAnalyticsInsights()  <- template
                              sentences, each gated on a real computed
                              number, exactly Sprint 6's Daily Briefing
                              pattern
```

## Productivity Index Formula, Stated Precisely
`0.6 * min(100, totalMilkInPeriod) + 0.4 * (taskCompletionRate * 100)`, rounded, capped at 100. A weighted average (coefficients sum to 1.0, same methodology precedent as Sprint 5's Unified Decision Engine) -- not a fabricated composite, every term traces to a real, counted number.

## Why "Risk Trend" Doesn't Re-Run the Risk Engines
evaluateHealthRisk()/evaluateOperationalPriority() compute a score from current data -- they have no concept of "as of last month." Asking them to retroactively score a past period would require either a second, parallel scoring implementation with a historical-data parameter (duplicated logic) or synthesizing a plausible-looking number (fabrication). Neither is acceptable. Instead, Risk Trend counts real, already-timestamped alert-detection events (weight_alerts.detected_at, production_alerts.detected_at) per period -- a genuine historical record of when the certified engines did flag something, not a guess at what they would flag in the past.

## SSOT Boundaries (Unchanged)
This sprint introduces no new collection and no new writer. Every read is against a collection an existing engine already owns and already writes to. docs/features/ANALYTICS-DISCOVERY.md lists every domain's owner explicitly.

## Performance
One Promise.all batch per analytics computation (matching every prior sprint's dashboard/reports pattern), not one fetch per period -- bucketing happens in-memory after a single fetch per collection, regardless of how many periods are requested.

## Scalability
Bucketing is O(records x periods) in the worst case -- acceptable at this project's current, single-farm data volume (already the same asymptotic behavior as the existing buildMonthlyFin/buildMonthlyBreeding functions this sprint's utility generalizes). Not re-engineered for a scale this application does not yet have evidence of needing, consistent with this project's own repeated "don't build for hypothetical scale" precedent.

## Future Extension
Any new domain wanting a trend chart calls bucketByPeriod() with its own collection and date field -- no change to the bucketing utility itself, no new intelligence engine, no new architecture.
