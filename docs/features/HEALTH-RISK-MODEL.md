# HEALTH-RISK-MODEL.md

**This model produces an operational risk indicator for farm staff to prioritize attention. It is decision support, not a diagnosis -- it never asserts what condition an animal has, only that certain observable signals warrant a closer look, and by whom.**

## Scoring Methodology
A weighted point system, 0-100, starting from 0 (no signal) and adding points per contributing factor found -- the inverse convention of the dashboard's existing Farm Health Score (which starts at 100 and subtracts), chosen deliberately: that score describes herd-level wellness, this one describes individual-animal risk, and the two should not be visually or conceptually confusable.

## Contributing Factors (All Configurable Constants, Not Hardcoded Magic Numbers)

| Factor | Trigger | Points | Evidence Cited to Farm Staff |
|---|---|---|---|
| Active illness | A `health` record for this animal has `status==='active'` | +30 | The specific diagnosis/date of the active record |
| Weight loss (active) | An active `weight_alerts` record, `rule_type==='weight_loss'` | +25 | Reused directly from Sprint 2 -- current/previous weight, detected date |
| No growth (active) | An active `weight_alerts` record, `rule_type==='no_growth'` | +10 | Reused directly from Sprint 2 |
| Missing weight (active) | An active `weight_alerts` record, `rule_type==='missing_weight'` | +5 | Reused directly from Sprint 2 |
| Missed/overdue vaccination | A `vaccinations` record whose `target_section` matches this animal's `barn`, with `status==='overdue'`, or `status==='pending'` with `scheduled_date` in the past | +20 | The vaccination name and how overdue it is |
| Repeated medication | 2+ `health` records with a non-empty `medication` field for this animal within the last 30 days | +15 | The medication names and dates |
| Repeated treatment (short period) | 3+ `health` records of any status for this animal within the last 14 days | +20 | The record count and date range -- a distinct signal from "repeated medication": this catches repeated *visits*, not just repeated *drugs* |
| No recent health check | This animal has at least one prior `health` record, but none in the last 180 days | +5 | Date of the last record. Low weight deliberately: many healthy animals legitimately go long stretches without needing one; this is a mild staleness nudge, not a real concern by itself |
| Low body condition | The most recent `health` record's `bcs` field is below 2.5 (a recognized veterinary threshold for poor body condition on the standard 1-5 scale) | +15 | The BCS value and its date |

## Risk Levels

| Level | Score Range | Meaning to Farm Staff |
|---|---|---|
| Low | 0-24 | No significant signal; routine monitoring |
| Medium | 25-49 | Worth a closer look at the next routine check |
| High | 50-74 | Recommend scheduling a review soon |
| Critical | 75-100 | Recommend immediate veterinary attention |

## Rule Priorities (For Recommendation Ordering, Not Scoring)
When multiple factors contribute, recommendations are surfaced in this order: Active illness and Repeated treatment first (both point at a currently-unresolved medical situation), then Weight signals, then Vaccination/BCS, then staleness last -- so the single most actionable thing appears first, not just the highest-point item.

## Configurable Thresholds
All point values, the 180-day/30-day/14-day windows, and the 2.5 BCS cutoff are named constants in the engine (`shared.js`), not inline literals scattered through logic -- adjustable in one place if farm experience suggests different values are more useful, without touching the evaluation logic itself.

## What This Model Deliberately Does Not Do
It does not attempt to name a likely condition, does not replace a vet's judgment, and does not factor in anything not already a real, existing field in this application -- consistent with this sprint's "reuse existing data, invent nothing new" mandate.
