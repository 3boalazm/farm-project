# AUTO-TASK-GENERATION.md

## Architecture

```
Domain Event (vaccination saved, breeding record set to pregnant,
              health record with a withdrawal date)
        |
        v
window.autoGenerateTask(eventType, payload)   <- shared.js, one function
        |
        v
AUTO_TASK_RULES[eventType]                    <- title/dueDate/relatedTag per event
        |
        v
Deduplication check (fbGet 'daily_tasks',
  match on auto_dedup_key = eventType + sourceId)
        |
   +----+----+
   |         |
 exists   doesn't exist
   |         |
update    create
 date      task
(if        (fbPost
changed)   'daily_tasks')
```

**Single entry point, confirmed:** every integration call site (`pages/vaccine.js` x2, `pages/breeding.js` x1, `pages/health.js` x1) calls the exact same `window.autoGenerateTask()` function in `shared.js` -- no task-creation logic is duplicated across domains.

## Flow, Concretely

1. A vet adds/edits a vaccination record via `submitVacc()` or schedules one via `submitTpl()`.
2. Immediately after the existing `fbPost`/`fbPatch` succeeds (the vaccination write itself is unchanged), the page calls `window.autoGenerateTask('vaccination_scheduled', {...})`.
3. The engine checks `daily_tasks` for an existing task with the same `auto_dedup_key`. If found, it updates the date only if it changed. If not found, it creates a new task with full traceability fields.
4. The call is fire-and-forget (`.catch(function(){})`) -- a failure in task automation can never block or fail the vaccination save itself.

## New Fields on `daily_tasks` (Additive Only)
`auto_generated: true`, `auto_source_type` (event type string), `auto_source_id` (the source record's Firebase key), `auto_dedup_key` (the deterministic dedup identifier), `related_tag` (the animal/section the task concerns, shown explicitly in the UI). Every existing field on `daily_tasks` is untouched; manually-created tasks simply don't have these fields set, and render exactly as they did before this sprint.

## Examples

**Vaccination scheduled:** vet enters a vaccination for "حظيرة 1" due 2026-09-01 -> a task appears: "تحصين: اللقاح -- حظيرة 1", category medical, priority high, due 2026-09-01, tagged "مولّدة تلقائيًا -- تحصين مجدول".

**Rescheduled:** the same vaccination's date is edited to 2026-09-20 -> the *same* task's due date updates to 2026-09-20. No second task appears.

**Expected birth:** a breeding record moves to `pregnant` with `expected_birth` set -> a task appears on that date, category breeding, tagged with the female's tag.

## Testing
`tests/data-integrity/auto-task-generation.spec.js` -- 7 tests, all passing: correct field shape, no-duplicate-on-repeat, update-on-reschedule, no-collision-across-sources, no-task-without-a-date, correct shape for all 3 implemented event types, and confirmation that existing permission gating (`can('animals')`/`can('admin')` on edit/delete) is unaffected.

## Future Extension Points
Adding a new event type is additive: add one entry to `AUTO_TASK_RULES` in `shared.js` (title/dueDate/relatedTag functions), then call `window.autoGenerateTask('new_event_type', {...})` from wherever that domain event occurs. No changes to the engine itself, the deduplication logic, or the UI rendering are needed -- this is the exact design goal of "every event passes through exactly one path." `docs/features/AUTO-TASK-EVENTS.md` specifies 7 additional events already designed and ready for this extension pattern in future sprints.
