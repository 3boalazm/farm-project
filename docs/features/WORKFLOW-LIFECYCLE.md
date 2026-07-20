# WORKFLOW-LIFECYCLE.md

## The Lifecycle
validate -> resolve -> consult+recommend -> log -> finish, always in this order, always inside one try/catch, always producing a result object even on failure.

1. Validate: workflowType must exist in WORKFLOW_RULES; ctx.sourceId must be present. Fails immediately, no reads or writes, if either is missing.
2. Resolve: if this type has a resolvesEvent, read daily_tasks once, find the matching stale reminder (by auto_dedup_key, the exact same key autoGenerateTask() would have used) or, for sale/death, every open task tied to the animal's tag -- patch each found task to status:'done'.
3. Consult + Recommend: call the type's own small rule, which may read an existing certified engine's live output (never recomputing it) or a raw collection, and returns one {text, evidence, actionable} object or null.
4. Log: write one record to workflow_history -- started_at, completed_at, duration_ms, actor (the current user's name), resolved_task_count, the recommendation's text/evidence, and outcome.
5. Finish: return {workflowType, sourceId, resolvedTaskCount, recommendation, durationMs, outcome} to the caller, which decides how (or whether) to display it -- a toast for the recommendation, nothing more.

## Started / Completed / Duration
started_at is stamped at function entry, before any async work. completed_at is stamped right before the workflow_history write. duration_ms is the real, measured difference (Date.now() at entry vs. at the log point) -- not an estimate, not a fixed placeholder.

## Actor
getUser().name at the moment of execution -- the person whose action (recording a birth, completing a vaccination, selling an animal) triggered this workflow. Never inferred, never defaulted to a generic "system" label if a real user is logged in.

## Generated Entities
Recorded as resolved_task_count (how many reminder tasks this workflow closed) -- the workflow itself does not create new entities in this release (see WORKFLOW-ENGINE.md's note on why completeWorkflow() never posts to daily_tasks), so there is nothing else to name here honestly. A future workflow type that does create a follow-up task via autoGenerateTask() would extend this field, not require a new one.

## Outcome and Errors
outcome is 'success', 'error', or 'invalid' (the validation-failure case, which never reaches the try block's error handler because it returns before entering it). On 'error', error_message holds the actual caught exception's message -- never a generic "something went wrong" string, so the Operational History view (Phase 7, reports.js's "سجل العمليات" tab) can show the real cause on hover.

## Read-Only From Every Other System's Perspective
workflow_history is written exclusively by completeWorkflow() and read only by the new Operational History tab. No other engine, page, or report queries it -- Reports/Analytics/Dashboard reflect workflow outcomes by reading the underlying domain data directly (a vaccination's own status, a task's own status), confirmed live in docs/features/WORKFLOW-DISCOVERY.md's flow map, not by reading this log.
