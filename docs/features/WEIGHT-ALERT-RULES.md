# WEIGHT-ALERT-RULES.md

**5 rules specified. 3 implemented this sprint (event-driven, evaluated on new weight records). 2 designed and deliberately deferred, with honest reasoning.**

| Rule | Trigger | Severity | Recommended Action | Default Task Priority | Status |
|---|---|---|---|---|---|
| Weight Loss | Newest weight record is lower than the previous record by more than a configurable threshold (default 5%) | High | Veterinary examination | high | **IMPLEMENTED** |
| No Growth | Newest weight record is within +/-1% of the record from >= 14 days ago (i.e., no meaningful gain across a real elapsed window) | Medium | Nutrition review | medium | **IMPLEMENTED** |
| Missing Weight | No weight record exists within the last 30 days (configurable) for an animal that has been weighed before -- a read-time staleness check, not triggered by a write event, since by definition nothing was written | Medium | Re-weigh animal | medium | **IMPLEMENTED** |
| Sudden Gain | Newest weight record exceeds the previous by more than a configurable threshold (e.g., 25%) in a short window | Medium | Re-weigh animal (rule out data-entry error before assuming a real health issue) | low | DESIGNED -- deferred. A real, useful rule, but the right threshold depends on species/age growth-rate norms this app doesn't currently model; a guessed flat threshold risks false alarms on legitimately fast-growing young animals more than it risks missing real problems. Worth a dedicated pass with farm input on real thresholds, not a guess this sprint. |
| Underweight | `current_weight` below a configurable absolute threshold | High | Veterinary examination + nutrition review | high | DESIGNED -- deferred. Genuinely blocked, not just deprioritized: a single flat threshold is not meaningful across a mixed herd of adult goats, adult sheep, and young kids/lambs of both -- doing this correctly requires a species/age-appropriate reference table, which is a real data-model decision (does the Animal entity need an `age_category`, or does this need a breed-standard reference collection?) outside this sprint's "reuse existing data, invent nothing new" mandate. |

## Deduplication Strategy (Applies to All Implemented Rules)
One active (unresolved) alert per `(animalId, ruleType)` at a time -- deterministic, mirroring Sprint 1's `eventType+sourceId` pattern exactly. If a new evaluation re-detects the same issue while an alert is still active, the existing alert's details (current weight, detected-at timestamp) are updated in place, not duplicated. If a later evaluation finds the issue no longer holds (e.g., weight recovered), the existing alert is marked `resolved` automatically -- it is not deleted, preserving a real history of what was flagged and when.

## Storage
A new collection, `weight_alerts` -- not a Weight SSOT violation, since an alert is a distinct concept (a derived operational finding *about* weight data) from the weight data itself, exactly as `daily_tasks` is a distinct concept from the domain events that generate tasks in Sprint 1.
