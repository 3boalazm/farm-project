# WORKFLOW-ENGINE.md

**One function, shared.js: window.completeWorkflow(workflowType, ctx). 8 supported types, one lookup table, zero new execution paths for anything a certified engine already does.**

## API
```js
const result = await window.completeWorkflow('birth', { sourceId: breedingId, animalTag: 'G-1' });
// result: { workflowType, sourceId, resolvedTaskCount, recommendation, durationMs, outcome }
```
ctx fields used depend on type: sourceId (always required -- the dedup key an existing autoGenerateTask() call would have used), animalId/animalTag/barn (for engine-consulting types), targetSection (vaccination), productionType (production).

## The 8 Types, What Each Actually Does

| Type | Resolves | Consults | Real gap closed? |
|---|---|---|---|
| birth | expected_birth_approaching:{sourceId} | none | Yes -- confirmed, previously nothing closed this |
| vaccination | vaccination_scheduled:{sourceId} | vaccinations (read) | Yes |
| medication | medication_followup:{sourceId} | evaluateHealthRisk() | Yes |
| weight | none (self-resolving already) | evaluateWeightAlert() | No -- recommendation only |
| production | none (self-resolving already) | evaluateProductionKPIs() | No -- recommendation only |
| health | none (new record, nothing prior) | evaluateHealthRisk() | No -- recommendation only |
| sale | ALL open tasks tied to animalTag | none | Yes -- confirmed, zero automation existed before |
| death | ALL open tasks tied to animalTag | none | Yes -- confirmed, zero automation existed before |

## Idempotency, Proven Not Assumed
Calling completeWorkflow() twice with the same sourceId is safe: the first call resolves the stale task (if any) and marks it done; the second call's own fbGet('daily_tasks') read will no longer find it in a non-done state, so resolvedTaskCount is correctly 0 the second time -- verified directly by a dedicated test, not assumed from the dedup logic's design alone.

## Retry Safety
An unrecognized workflowType or a missing sourceId returns { outcome: 'invalid' } immediately, before any read or write -- confirmed by a dedicated test. A thrown error mid-execution (from any fbGet/fbPatch/fbPost call, or from an engine consultation) is caught, logged to workflow_history with outcome:'error' and the actual error message, and returned to the caller -- never left unhandled, never silently swallowed without a trace.

## actionable, and Why It Exists
Recommendations for weight/production/health/vaccination-with-nothing-pending include actionable:false for their "everything is fine" branch. Every integration point's toast-display code checks recommendation.actionable!==false before showing anything -- without this, a routine, healthy weight entry would produce a toast every single time, which is noise, not a smart recommendation. Birth/sale/death/vaccination-with-something-pending/medication-with-elevated-risk are always actionable:true (or omit the field, treated as true for backward compatibility).

## Why completeWorkflow() Itself Never Writes to daily_tasks on Creation
Confirmed by a dedicated test that logs every fbPost call during a full workflow execution: daily_tasks never appears as a POST target. Any new follow-up task a recommendation might eventually warrant would go through window.autoGenerateTask() -- this sprint did not add a case that creates one (every current recommendation is advisory, surfaced as a toast, not a task), but the architecture supports it without any change to completeWorkflow() itself.
