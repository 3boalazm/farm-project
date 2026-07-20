# INTELLIGENCE-CONTRACTS.md

**Every function signature and output shape below is copied from the actual, currently-committed source -- not recalled from memory. This document exists so Sprint 5 can compose these engines without guessing at their shapes.**

## Automation Engine (Sprint 1)
**Entry point:** `window.autoGenerateTask(eventType, payload)` -- `payload` requires `sourceId`; optional `priorityOverride`. Returns the task's `_id` (new or pre-existing) or `null`.
**Registered event types (as of this baseline):** `vaccination_scheduled`, `expected_birth_approaching`, `medication_followup`, `weight_alert`, `health_risk_alert`, `production_alert`.
**Read surface:** `fbGet('daily_tasks')` -- array of `{title, category, priority:'high'|'medium'|'low', date, assigned_to, barn, status:'pending'|'in_progress'|'done', auto_generated, auto_source_type, auto_source_id, auto_dedup_key, related_tag, created_at, completed_at}`.
**Sprint 5 usage:** read-only, via `fbGet('daily_tasks')`, to compute outstanding-task load per animal. Never calls `autoGenerateTask` itself for a *new* event type -- Sprint 5 does not introduce new task-generating events, only reads what already exists.

## Weight Intelligence (Sprint 2)
**Entry points:** `window.evaluateWeightAlert(animalId, animalTag, barn)`, `window.evaluateMissingWeightAlerts(animalsList, maxDays)`. Both write to `weight_alerts` and may call `autoGenerateTask('weight_alert', ...)`.
**Output collection (`weight_alerts`):** `{animal_id, animal_tag, barn, rule_type:'weight_loss'|'no_growth'|'missing_weight', severity:'high'|'medium', action, current_weight, previous_weight, detail, status:'active'|'resolved', detected_at, resolved_at}`.
**Sprint 5 usage:** **read-only, indirectly** -- Sprint 5 does not call `evaluateWeightAlert` itself, and does not read `weight_alerts` directly for scoring purposes either (see the critical finding below).

## Health Intelligence (Sprint 3)
**Entry point:** `window.evaluateHealthRisk(animalId, animalTag, barn)` -- pure, read-only (writes nothing except an optional deduplicated task for High/Critical results).
**Output shape:** `{animalId, animalTag, barn, score:0-100, level:'low'|'medium'|'high'|'critical', contributors:[{factor, points, evidence}], recommendations:[{factor, label, taskPriority, evidence}], recentTimeline, evaluatedAt}`.
**CRITICAL FINDING, CONFIRMED DIRECTLY IN SOURCE (`shared.js:1299`):** this engine **already reads `weight_alerts` internally** as three of its nine contributing factors (`weight_weight_loss` +25, `weight_no_growth` +10, `weight_missing_weight` +5). **This means Weight Intelligence's signal already flows into `score`.** Sprint 5's priority model must not add weight severity a second time, or the same underlying fact would be double-counted -- see `docs/features/UNIFIED-PRIORITY-MODEL.md` for how this is resolved.
**Sprint 5 usage:** the primary read-only input to the unified score.

## Production Intelligence (Sprint 4)
**Entry points:** `window.evaluateProductionKPIs(animalId, animalTag, type)` (pure, read-only), `window.evaluateProductionAlert(...)` (wraps it with persistence).
**KPI output shape:** `{animalId, animalTag, type, recentAverage, priorAverage, baselineAverage, trend:'rising'|'stable'|'declining', trendPct, dropDetected, dropPct, consistency, consistencyLabel}`.
**Confirmed independent of Weight/Health:** operates exclusively on `production_log` where `type` is `'milk'`/`'wool'` -- never reads `weight_alerts` or `health` records. No double-counting risk with this engine.
**Sprint 5 usage:** read-only, via `evaluateProductionKPIs` for both `'milk'` and `'wool'`, taking whichever shows an active drop (if any).

## Summary Table

| Engine | Sprint 5 reads | Sprint 5 recomputes | Double-count risk |
|---|---|---|---|
| Automation (tasks) | `fbGet('daily_tasks')` | Nothing | None -- task counting is a new, distinct computation over existing data |
| Weight | Nothing directly | Nothing | N/A -- reached only through Health's own incorporation |
| Health | `evaluateHealthRisk()` output | Nothing | This IS the weight-inclusive signal |
| Production | `evaluateProductionKPIs()` output | Nothing | None -- fully independent domain |
