# PRODUCTION-KPIS.md

**Scope, stated once: every KPI below operates on `production_log` records where `type` is `'milk'` or `'wool'` only. `type==='weight'` is Sprint 2's domain and is never read by this engine.**

**Honest consolidation, not an inflated list:** the mission names 9 possible KPIs. Several of them (Daily/Weekly/Monthly trend) are the same underlying comparison at different time windows, and two more (Consistency, Stability) are the same statistical concept under two names. Rather than implement near-duplicate calculations to hit a count, this sprint implements **6 genuinely distinct KPIs**, with the windowed-trend concept parameterized rather than triplicated.

| KPI | Purpose | Formula | Inputs | Output | Business Meaning |
|---|---|---|---|---|---|
| Recent Average | The building block every other KPI compares against | Sum of quantities in the last N days / N | This animal's `production_log` entries, `windowDays` (default 14) | A number (liters/kg per day) | "What is this animal producing right now, on average" |
| Trend Direction | Consolidates Daily/Weekly/Monthly trend into one parameterized comparison | Recent-average (last 7 days) vs. prior-average (the 7 days before that) -- percentage change | Same records, two adjacent 7-day windows | `rising` / `stable` / `declining` + percentage | "Is this animal's output moving, and which way, right now" |
| Drop Detection | Flags a real, meaningful decline -- not daily noise | Recent-average (last 7 days) is >15% below this animal's own 30-day-prior baseline | 7-day and 30-day-prior windows | Boolean + percentage drop | Mirrors Sprint 2's weight-loss design intentionally: a real decline relative to the animal's *own* history, not an absolute threshold |
| Recovery Trend | Distinguishes "still declining" from "was declining, now recovering" | Only evaluated when a Drop was previously flagged: is the most recent 7-day average higher than the 7-day average at the time the drop was first detected? | Requires the animal to already have an active production alert | Boolean | Prevents a recovering animal from continuing to look like an active problem |
| Consistency / Stability | One metric, not two -- both requested terms describe the same statistical property | Coefficient of variation (standard deviation / mean) across the last 14 days of recorded values | Same 14-day window | A 0-1+ ratio, labeled Low/Medium/High variability | A consistently-low producer is a different problem than an erratic one; this KPI distinguishes them |
| Top / Lowest Producers | Herd-wide ranking, not a per-animal signal | Sort all actively-producing animals by Recent Average, descending/ascending | Every animal's Recent Average | Two ranked lists | Surfaces both ends for different operational reasons (top producers to protect/replicate conditions for, lowest to investigate) |

## Configurable Thresholds
`windowDays` (14), the two 7-day trend windows, the 30-day drop-baseline window, and the 15% drop threshold are named constants in the engine, not inline literals -- adjustable in one place, matching every prior sprint's convention.

## What This Deliberately Does Not Do
No KPI here infers a biological cause (illness, poor nutrition, stress) -- that inference, where evidence supports it, is Health Intelligence's job (Sprint 3), which this engine's recommendations reference rather than duplicate. A KPI reports what the numbers show; it does not explain why.
