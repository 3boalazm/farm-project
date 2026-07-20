# TASK-SYSTEM-ANALYSIS.md

## Task Model (Confirmed From `pages/tasks.js`)
**Storage collection: `daily_tasks`** (not `tasks` — a name mismatch worth stating precisely since it's easy to assume wrong).

```
{
  title: string,
  category: 'cleaning'|'feeding'|'medical'|'spraying'|'inspection'|'maintenance'|'breeding'|'other',
  priority: 'high'|'medium'|'low',
  date: string (ISO date -- the due date),
  assigned_to: userId | null,
  assigned_to_name: string,
  barn: string | null,
  notes: string | null,
  recurring: boolean,
  recurring_days: number | null,
  is_template: boolean,
  status: 'pending'|'in_progress'|'done',
  created_at: ISO timestamp,
  created_by: string,
  completed_at: ISO timestamp | null,
  completed_by: string | null,
}
```

**No `source_type`/`source_id`/`auto_generated` fields exist today** -- the current system has zero concept of event-traceability. This sprint adds these as new, additive fields; it does not modify the existing shape.

## Identifiers
Firebase auto-key (`fbPost('daily_tasks', data)`), consistent with every other collection in this project -- no custom ID scheme.

## Due Dates
A plain ISO date string (`date` field), compared against "today" via a `daysUntil(dateStr)` helper. **This helper already exists, independently, in both `pages/breeding.js:122` and `pages/vaccine.js:105`** -- identical logic, pre-existing duplication, not introduced by this sprint. Not fixed here (out of this sprint's scope); the new automation engine adds one shared copy in `shared.js` for its own use rather than a third duplicate.

## Priorities
Three-tier (`high`/`medium`/`low`), each with a defined color -- reused directly, not redefined.

## Completion Workflow
`toggleTaskDone(id)` flips `pending <-> done`, stamping `completed_at`/`completed_by`. `setTaskStatus(id, status)` supports the intermediate `in_progress` state. Both write via `fbPatch('daily_tasks', ...)`.

## Permission Model (Confirmed From `renderTaskCard`)
- **Completing** a task (the checkbox): no explicit `can()` gate found -- any authenticated user can toggle done/pending.
- **Editing / starting** a task: gated by `can('animals')`.
- **Deleting** a task: gated by `can('admin')` -- the strictest gate in the whole task UI.

Auto-generated tasks inherit these exact same gates automatically, simply by being stored in the same `daily_tasks` collection and rendered by the same `renderTaskCard()` -- no new permission logic is introduced by this sprint.

## Integration Points Confirmed in Source Domains
- **Vaccination:** two independent writers reach `fbPost('vaccinations', ...)` -- the main manual-add path (`pages/vaccine.js:179`) and a template-based scheduling path (`submitTpl`, `pages/vaccine.js:295`). Both must trigger automation identically; this is exactly why a single centralized engine is required rather than two separate hooks.
- **Breeding:** `expected_birth` is a **manually-entered** field on the breeding record (`document.getElementById('b-ed').value`), not computed from a gestation-length lookup. This simplifies Feature 1.2 versus the original backlog estimate -- no new gestation-length logic is needed; the field already exists and is already populated by farm staff at breeding-record entry time.
- **Health:** not yet inspected in this pass -- deferred to Phase 4 integration, where it's actually wired.

## Notifications
`notifications-service.js` is a real, active, polling producer (confirmed in this engagement's own certification work), scoped to `notifications.html`. Out of scope for this sprint's automation engine -- task creation and notification delivery are two different systems; this sprint does not merge them.
