# HEALTH-INTELLIGENCE.md

**Decision support, not diagnosis. This system never asserts what condition an animal has -- it surfaces observable signals already present in certified data and recommends human review, always with cited evidence.**

## Architecture

```
Health Events (a health record saved, or an animal-detail/dashboard view)
        |
        v
window.evaluateHealthRisk(animalId, animalTag, barn)   <- shared.js, one function
        |
        v
Risk Evaluation  (9 factors: illness, weight signals x3, vaccination,
                  medication, treatment frequency, staleness, BCS)
        |
        v
Risk Score (0-100, NOT persisted -- always recomputed from live
            health/vaccinations/weight_alerts data, avoiding a second,
            potentially-stale source of truth for the same underlying facts)
        |
        v
Recommendations (evidence-cited, ordered by actionability not raw points)
        |
        v
Automation Engine (Sprint 1, reused directly) -- one task, only for
  high/critical, only the single top recommendation, deduplicated
  exactly as every other Sprint 1/2 event type
```

## Risk Model
Full detail in `docs/features/HEALTH-RISK-MODEL.md`. Summary: 9 weighted factors sum to a 0-100 score; Low (0-24) / Medium (25-49) / High (50-74) / Critical (75-100). Every factor reuses an existing, already-certified or already-Sprint-1/2-verified field -- no new data source.

## Decision Flow
An evaluation never writes anything by default -- it is a pure computation over existing data. The **only** write this engine ever performs is an optional, deduplicated follow-up task via `window.autoGenerateTask('health_risk_alert', ...)`, and only when the computed level is High or Critical. A Low or Medium result changes nothing in storage.

## Reuse, Explicitly
- **Weight signals** are read directly from Sprint 2's `weight_alerts` collection -- not recomputed. A weight-loss alert contributes to health risk with the exact detail string Sprint 2 already generated.
- **Task generation** goes through Sprint 1's `window.autoGenerateTask()` -- a third event type (`health_risk_alert`) added to its existing rule table, following the identical pattern Sprint 2 already established for `weight_alert`. No second task-creation path exists anywhere in the codebase.
- **Vaccination compliance** reads the existing `vaccinations` collection, reconciling `target_section` with the animal's own `barn` field -- confirmed to be the same concept, differently named, during Phase 1 discovery.

## Examples

**Multiple real signals:** an animal with an active illness, an active weight-loss alert, and an overdue vaccination scores 30+25+20=75 -- Critical. A single high-priority task is created: "مراجعة بيطرية" (veterinary review), citing the active illness as the lead evidence, since illness outranks the other factors in recommendation order even though weight loss and vaccination together outweigh it in points.

**Clean animal:** zero contributing factors -- score 0, no recommendations, nothing rendered on the animal-detail page (the section hides itself rather than showing an empty "0 risk" card, keeping the page uncluttered for the common case).

## Dashboard Integration
Herd-wide aggregates (active-illness count, vaccination compliance percentage, overdue count, in-withdrawal count) are computed synchronously from data the dashboard already fetches -- zero extra network calls beyond one new `vaccinations` read. The "highest risk animals" ranking evaluates only animals already showing at least one real signal (an active health record or active weight alert), not the full herd -- avoiding wasted computation on animals that will score 0 regardless.

## Testing
`tests/data-integrity/health-intelligence.spec.js` -- 9 tests: zero-signal baseline, single-factor scoring correctness, multi-factor summation and capping, recommendation-priority ordering (distinct from point-value ordering), evidence-citation completeness, task generation gated correctly to high/critical only, deduplication, permission-safe page loads, and dashboard rendering safety.

## Future Extension Points
Adding a 10th risk factor is additive: extend the scoring block in `window.evaluateHealthRisk` with one new check, add its weight to `HEALTH_RISK_WEIGHTS`, its recommendation to `HEALTH_RECOMMENDATIONS`, and its position in `HEALTH_FACTOR_PRIORITY_ORDER`. No change to the dedup logic, task integration, or rendering functions is needed.
