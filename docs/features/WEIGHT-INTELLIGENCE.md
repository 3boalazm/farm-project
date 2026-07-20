# WEIGHT-INTELLIGENCE.md

## Architecture

```
Weight Event (a new record added via any of the 3 existing writers)
        |
        v
window.evaluateWeightAlert(animalId, animalTag, barn)   <- shared.js, one function
        |
        v
WEIGHT_ALERT_RULES  (weight_loss, no_growth -- event-driven)
        |
        v
Alert (weight_alerts collection, deterministic dedup on animalId+ruleType)
        |
   +----+-----------------------+
   |                            |
 new finding                existing active alert
   |                            |
 create alert              update in place (if changed)
   |                       or auto-resolve (if condition cleared)
   v
Optional Task -> window.autoGenerateTask('weight_alert', ...)   <- Sprint 1's engine, reused, not duplicated
   |
   v
Notification -> toast() on new alerts (existing UI feedback mechanism, no new channel)
```

**A separate, read-time path exists for staleness** (`window.evaluateMissingWeightAlerts(animalsList, maxDays)`), called once per dashboard load rather than per weight-write event -- correct by construction, since "no weight was recorded" cannot be detected by a write-event hook.

## Rule Engine
Two event-driven rules implemented: **Weight Loss** (>5% drop between the two most recent records) and **No Growth** (<1% change across a >=14-day window). One read-time rule: **Missing Weight** (no record in 30+ days). Two rules -- Sudden Gain and Underweight -- are fully specified in `docs/features/WEIGHT-ALERT-RULES.md` but deliberately not implemented this sprint, each for a stated, evidence-based reason (not a vague "later").

## Integration Points (All Three Existing Weight Writers, Unmodified)
`animal-detail.html`'s `submitAddWeight()`, `pages/production.js`'s weight branch, `assistant.html`'s `add_weight` handler -- each calls `window.evaluateWeightAlert(...)` as a fire-and-forget call immediately after its existing write succeeds. None of the three writers' own logic changed.

## Dashboard Integration
Weight alerts join the dashboard's **existing** `priorityAlerts` array and render through the **existing**, shared `renderAlertCard()` -- no new, competing alert-display pattern was introduced. A second, small `wonder-card` panel (matching the existing Health-Score/Today-Summary visual style exactly) shows active-alert count, high-risk count, and a real week-over-week trend (alerts detected in the last 7 days vs. the 7 days before that).

## Full Alert Detail (Per-Animal, on `animal-detail.html`)
Every field the spec requires -- animal, current weight, previous weight, detected issue, severity, recommended action, timestamp, resolved/active status -- renders in a dedicated section next to the existing weight-history table, fetched and rendered independently so it never blocks the page's own synchronous render flow. Active alerts show a "Close" button gated by `can('animals')`, reusing the exact same permission vocabulary already established for editing tasks in Sprint 1.

## Examples

**Weight loss:** an animal's weight drops from 35kg to 30kg (-14%) -> a high-severity alert appears with both weights, "فحص بيطري" (veterinary examination) as the recommended action, and a corresponding high-priority task is auto-created.

**Recovery:** the same animal's next weigh-in shows 39kg -> the existing alert is automatically marked resolved (not deleted -- the history remains visible), no new alert or duplicate task is created.

**Missing weight:** an animal hasn't been weighed in 35 days -> a medium-severity alert appears on next dashboard load, recommending "إعادة الوزن" (re-weigh).

## Testing
`tests/data-integrity/weight-intelligence.spec.js` -- 8 tests: correct detection, no false positives on normal variation, no-duplicate-on-repeat, auto-resolution when the issue clears, task-generation traceability through Sprint 1's engine, manual resolution, a genuine (not assumed) permission-gate proof using `vet` -- a role explicitly excluded from `animals` in the real `ROLE_PERMS` table -- and dashboard-rendering safety.

## Future Extension Points
Adding Sudden Gain or Underweight (or any new rule) once their open questions are resolved is additive: one new entry in `WEIGHT_ALERT_RULES`, following the exact `evaluate(sortedHistory)` contract already established by the two implemented rules. No change to the dedup logic, task integration, or dashboard rendering is needed -- exactly the same extension guarantee Sprint 1's task engine already provides.
