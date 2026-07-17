# PRODUCTION-SYSTEM-ANALYSIS.md

## Production Lifecycle (Confirmed, Single Writer)
`pages/production.js`, one writer, `fbPost('production_log', data)`. Fields: `{type: 'milk'|'wool'|'weight', date, animal_id, animal_tag, animal_breed, animal_species, animal_gender, quantity, unit, recorded_by, notes, created_at}`. **`animal_id` is carried directly** (unlike `health` records, which only carry `animal_tag`) -- no tag-to-id resolution is needed for this sprint's hooks.

## Critical Scope Boundary, Confirmed by Direct Inspection
`type==='weight'` records are **already fully owned by Sprint 2's Weight Intelligence** (the same writer already calls `window.evaluateWeightAlert()` after a weight-type entry, confirmed at `pages/production.js`'s existing code). **This sprint's KPI engine operates only on `type==='milk'` and `type==='wool'` records** -- including weight here would directly duplicate Sprint 2's trend/loss analysis, which the mission's own "no duplicated calculations" rule forbids.

## Existing Calculations (Confirmed, Distinct Granularity -- Not Duplicated)
`dashboard.html` already computes a **herd-wide, day-by-day milk total for the last 14 days** ("Phase 3: Analytics Grid," `prodTrend`) -- a single aggregate number per day across the entire herd, answering "how much milk did the farm produce each day." **This sprint's engine answers a genuinely different question at a genuinely different granularity: per-animal production trend** ("is *this specific animal's* output declining relative to its own recent baseline"). The two are complementary, not overlapping -- this sprint does not touch or recompute the existing herd-wide chart.

## Existing KPIs
None at the per-animal level -- confirmed via direct search of `pages/reports.js` (zero production-specific logic found) and `pages/production.js` itself (a write-only form, no aggregation). This sprint introduces the first per-animal production signal in the codebase, exactly mirroring how Sprint 3 introduced the first per-animal health signal.

## Existing Reports
`pages/reports.js` has zero production-log-specific aggregation of any kind, confirmed via direct search.

## AI Assistant
Confirmed via direct search: **no `add_milk`/`add_wool`/production-related action exists** in `assistant.html`'s 7 confirmed actions (`add_animal`, `add_birth`, `add_breeding`, `add_finance`, `add_health`, `add_vaccine`, `add_weight`). `pages/production.js`'s own form is the sole entry point for milk/wool records -- one integration hook, not several, unlike Sprint 1/2's multi-writer domains.

## Data Flow Into This Sprint
`production_log` (milk/wool only) is the primary input. Weight Intelligence (Sprint 2) and Health Intelligence (Sprint 3) are reused where they add genuine signal (e.g., a declining producer that also has an active weight-loss alert is a stronger, more explainable signal than either alone) -- read directly, never recomputed.
