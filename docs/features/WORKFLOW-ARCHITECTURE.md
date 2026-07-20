# WORKFLOW-ARCHITECTURE.md

## What a "Workflow" Actually Is Here
Given the discovery finding that most domain writes are already wired to autoGenerateTask(), a certified intelligence engine, or both, this sprint's workflow engine is not a new execution path -- it is a thin orchestration layer that runs immediately after an existing write completes, doing exactly two new things neither existing system currently does: (1) resolving the specific reminder task that write makes moot, and (2) producing one rule-based "what's next" recommendation from data an existing engine already computed. Everything else -- the actual write, the actual scoring, the actual notification -- is untouched, called exactly as it already is.

## Architecture

```
User Action (existing page, existing form, existing write -- UNCHANGED)
        |
        v
window.completeWorkflow(workflowType, sourceId, context)     <- NEW, shared.js
        |
        +--> Step 1: validate (sourceId present, workflowType recognized)
        |
        +--> Step 2: resolve stale reminder, if this workflow type has one
        |            (WORKFLOW_RULES[type].resolvesEvent -- reuses the EXACT
        |             SAME dedup key pattern autoGenerateTask() already uses:
        |             fbGet('daily_tasks'), find eventType+':'+sourceId, fbPatch status:'done')
        |
        +--> Step 3: call the existing certified engine this workflow type
        |            maps to (WORKFLOW_RULES[type].engine), if any -- e.g.
        |            evaluateWeightAlert(), evaluateProductionAlert() -- NEVER
        |            reimplemented, always the same function call already used elsewhere
        |
        +--> Step 4: generate one recommendation (WORKFLOW_RULES[type].recommend),
        |            a small rule reading the Step 3 engine's own real output --
        |            never inventing a number the engine didn't produce
        |
        +--> Step 5: log to workflow_history (NEW collection, purely additive,
        |            read-only from every other system's perspective)
        |
        v
Returns a summary object -- the calling page decides how to display it
(this sprint adds a small, reusable summary widget, not a new one per page)
```

## The One New Table: WORKFLOW_RULES
Mirrors AUTO_TASK_RULES's (Sprint 1) own established pattern exactly -- a lookup table keyed by workflow type, each entry naming which task-event to resolve (if any) and which existing engine to consult for a recommendation (if any). Adding a 9th workflow type later means adding one table entry, not new orchestration code.

## Why This Is Not a Second Task Engine
completeWorkflow() never calls fbPost('daily_tasks', ...) directly with a hand-built record -- when a workflow's recommendation warrants a new follow-up task, it calls window.autoGenerateTask(), the exact same Sprint 1 function every other trigger already uses, with the exact same dedup guarantee. The only task-table operation this sprint adds that Sprint 1 didn't already have is resolving an existing task (a single fbPatch to status:'done') -- Sprint 1 could create and update-in-place, but nothing before this sprint could close a reminder because its own triggering condition had passed.

## Why This Is Not a Second Notification Engine
No workflow calls fbPost('notifications', ...). Where a workflow's outcome is notification-worthy, it is the exact same certified engines (evaluateWeightAlert/evaluateProductionAlert) already being consulted in Step 3 that, through their own existing logic, may lead to a notification via notifications-service.js's own polling -- untouched, unduplicated.

## Why This Is Not a Second Intelligence Engine
Every recommendation is a small, named if on a real field an existing engine already returned (e.g., "if evaluateWeightAlert()'s result shows an active weight_loss rule, recommend a follow-up weigh-in in 7 days") -- never a new score, never a new classification, never a new threshold invented for this sprint specifically that doesn't already exist in the engine it reads from.

## SSOT: One New, Purely Additive Collection
workflow_history -- write-once per workflow completion, never mutated afterward, read by nothing except the new Operational History view this sprint adds (Phase 7). No existing collection's writer changes.

## Performance
One workflow completion is at most: 1 fbGet('daily_tasks') (to find the stale reminder) + 1 fbPatch (to resolve it, only if found) + 1 existing-engine call (already O(1) per animal, established in Sprint 2-5) + 1 fbPost('workflow_history', ...). Bounded, small, no loop over the herd.

## Future Extension
A 9th workflow type is one new WORKFLOW_RULES entry -- no change to completeWorkflow()'s own logic, no new architecture.
