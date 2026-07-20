# UNIFIED-PRIORITY-MODEL.md

## The Central Design Tension, Stated Directly
The mission's own example formula names Weight, Health, Production, and Tasks as four separate additive terms. But `docs/features/INTELLIGENCE-CONTRACTS.md` confirms, directly from source, that **Health Intelligence already incorporates Weight Intelligence's signals as three of its own nine scoring factors.** Treating "Weight Alert" as a fifth, independent additive term would double-count the same underlying fact -- an animal with an active weight-loss alert would have that single fact inflate the score twice: once through Health's own +25, and again through a separate Weight term.

**Resolution:** Weight's contribution reaches the unified score *through* Health Intelligence's existing incorporation, not as a second, parallel term. This is composition, not omission -- Weight Intelligence is not ignored, it is correctly counted exactly once, at the layer that already owns combining it with other health-adjacent signals.

## Priority Score Formula
A weighted average (coefficients sum to 1.0, so the result never needs an artificial cap):

```
Operational Priority Score =
    0.6 x HealthRiskScore        (0-100, from evaluateHealthRisk() -- already weight-inclusive)
  + 0.3 x ProductionSeverity     (0-100, scaled from an active drop's dropPct, 0 if no active drop)
  + 0.1 x TaskUrgencyBonus       (0-100, scaled from this animal's pending task count/priority)
```

**Why these weights:** Health (which already subsumes Weight) carries the majority share deliberately -- it is the signal most directly tied to animal welfare. Production is a real, independent operational concern, weighted meaningfully but below health. Outstanding tasks are the smallest term by design: an unaddressed task compounds urgency (an animal already flagged and not yet attended to is more urgent than one flagged for the first time) but should never, by itself, make a healthy, well-producing animal look like a priority.

## Priority Levels
Reuses Health Intelligence's exact boundaries, deliberately, so the whole application speaks one consistent scale rather than forcing users to learn a second one: **Low (0-24) / Medium (25-49) / High (50-74) / Critical (75-100)**.

## Tie-Breaking Rules
When two animals land on the same score: (1) an animal with an active-illness contributor from Health Intelligence ranks first (a currently-unresolved medical situation outranks a purely statistical signal), (2) more total corroborating contributors/signals ranks next (more independent evidence pointing the same direction is more actionable), (3) alphabetical by tag as a final, deterministic fallback so the ordering is always stable and reproducible, not incidentally dependent on object-iteration order.

## Evidence Model
Every unified priority result carries an `evidence` array assembled from -- never recomputed from -- each contributing engine's own already-cited evidence: Health Intelligence's `contributors`/`recommendations` (evidence strings reused verbatim), one production-specific line if a drop is active (citing the drop percentage and baseline, exactly as Sprint 4's own alert already states them), and one task-load line if pending tasks exist (citing the count and priorities). No evidence line is ever synthesized without a traceable source.

## Recommendation Confidence
Not an arbitrary number -- grounded in genuine cross-engine corroboration: **High confidence** when 2 or more of {Health, Production, Tasks} independently show a signal for the same animal (multiple independent engines agreeing is a stronger basis for confidence than any one alone). **Medium confidence** when exactly one engine shows a signal. **Low confidence** is not a real state in this model -- if zero engines show a signal, the animal simply does not appear as an operational priority at all, rather than appearing with a hedge.
