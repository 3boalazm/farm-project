# PRODUCTION-INTELLIGENCE.md

**Decision support only. This engine reports what production numbers show; it never infers a biological cause -- that inference, where evidence supports it, belongs to Health Intelligence (Sprint 3), which this engine's recommendations point to rather than duplicate.**

## Architecture

```
Production Records (production_log, type='milk'|'wool' ONLY --
                     type='weight' is Sprint 2's exclusive domain)
        |
        v
window.evaluateProductionKPIs(animalId, animalTag, type)   <- pure, read-only, shared.js
        |
        v
Trend Analysis (recent-vs-prior week, drop-vs-baseline, consistency)
        |
        v
window.evaluateProductionAlert(...) wraps the above with:
  Alert persistence (production_alerts, deterministic dedup)
        |
        v
Recommendation (evidence-cited)
        |
        v
Automation Engine (Sprint 1, reused) -- one deduplicated task, only on a real drop
```

## KPIs
Full detail in `docs/features/PRODUCTION-KPIS.md`. Six genuinely distinct KPIs, consolidated from the 9 possibilities named in the brief (Daily/Weekly/Monthly trend collapsed into one parameterized Trend Direction; Consistency/Stability recognized as the same statistic, not duplicated): Recent Average, Trend Direction, Drop Detection, Recovery Trend, Consistency, Top/Lowest Producers.

## A Real Design Bug Found and Fixed During This Sprint
The dashboard panel's initial visibility logic hid the entire top/lowest-producer ranking whenever there were zero active alerts -- meaning a fully healthy herd, with perfectly good ranking data to show, would never see it. Caught by running the live check, not by inspection; fixed by separating "does this panel have anything to show" (now: alerts OR raw production data) from "are there active problems" (still just alerts). `tests/data-integrity/production-intelligence.spec.js` encodes this exact scenario as a named regression guard.

## Reuse, Explicitly
- **Task generation** goes through Sprint 1's `window.autoGenerateTask()` -- a fourth event type (`production_alert`), following the identical registration pattern as `weight_alert` and `health_risk_alert`.
- **Weight and Health Intelligence are read, never recomputed**, wherever their signals would add real context (not built this sprint, since no specific requirement named a concrete combined check yet -- the reuse hooks exist in the engine's design and are ready for a future sprint to combine, e.g., "declining producer + active weight-loss alert" as a compound signal).
- **The scope boundary against Sprint 2 is enforced in code, not just documentation**: `evaluateProductionKPIs` explicitly rejects any `type` other than `'milk'`/`'wool'`, confirmed by a dedicated test.

## Examples

**Sustained decline:** an animal producing ~5L/day for weeks drops to ~2L/day over the most recent week -- a 55% deviation from its own baseline, well past the 15% threshold. An active alert is created, a medium-priority task ("متابعة انخفاض إنتاج") is generated once, and the animal-detail page shows the drop percentage alongside its baseline for context.

**Recovery:** the same animal's output climbs back to ~5.5L/day -- the existing alert is automatically marked resolved with `recovered: true`, distinguishing a genuine recovery from a problem that simply stopped being tracked.

**Healthy herd, zero alerts:** the dashboard still shows top and lowest producers by recent average, separately for milk and wool (never mixed -- different units), because ranking is useful information regardless of whether anything is currently wrong.

## Testing
`tests/data-integrity/production-intelligence.spec.js` -- 7 tests: the `weight`-type scope boundary enforced in code, real drop detection against personal baseline, no false positives on normal variation, deduplicated alert + traceable task creation, auto-resolution with recovery tracking, the dashboard-visibility regression guard described above, and permission-safe page loads.

## Future Extension Points
A compound "declining producer with an active weight-loss or high health-risk signal" recommendation is the natural next step, combining three engines' outputs without recomputing any of them -- each engine's read-only evaluate function is already safe to call from anywhere, including from within another engine's evaluation.
