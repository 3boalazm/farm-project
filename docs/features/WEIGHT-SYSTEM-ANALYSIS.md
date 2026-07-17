# WEIGHT-SYSTEM-ANALYSIS.md

## Weight Lifecycle (Certified SSOT, Confirmed Unchanged)
Storage: `animals/{animalId}/weights` (nested collection, `{weight, date, notes}` per record). `animals.current_weight`/`weight_updated` are synchronized to the newest remaining record after every add/delete. This sprint reads this data; it does not alter its shape, storage location, or synchronization logic in any way.

## Current Update Path -- Three Independent Writers (Confirmed, Pre-Existing)
1. `animal-detail.html`'s `submitAddWeight()` -- the primary manual-entry path.
2. `pages/production.js` (lines 584-585) -- weight entries logged via the general production form.
3. `assistant.html` (lines 539-540) -- the AI assistant's `add_weight` action.

**All three independently perform `fbPost('animals/{id}/weights', ...)` then `fbPatch('animals', id, {current_weight, weight_updated})` -- there is no single shared writer function they funnel through (unlike Birth's `createOffspringAnimal()`).** This is a pre-existing architectural fact, not something this sprint changes. Consequently, the Weight Intelligence Engine's evaluation hook must be attached at all three call sites individually, exactly as Sprint 1's task automation was attached at multiple vaccination/breeding/health call sites -- the same integration pattern, applied to a new domain.

## Current Calculations
`current_weight` = the most recent weight record's value (by date), already computed and stored -- this sprint reuses this field directly rather than re-deriving it from the full history array wherever a "latest weight" is needed.

## Dashboard (Confirmed, Existing Pattern to Follow)
`dashboard.html` already computes a composite "Farm Health Score" (weighted deductions from 100, capped 0-100) and a "Phase 3: Analytics Grid" of real-data-only computed panels, with explicit comments distinguishing real computed data from anything that would require inventing a data source. **This is the established pattern this sprint's dashboard panels follow** -- but with one architectural difference: the Health Score's composite math lives inline in `dashboard.html` itself (page-specific presentation logic), whereas this sprint's rule *evaluation* must live in one centralized, reusable, testable engine (`shared.js`), per this sprint's own Phase 3 mandate -- `dashboard.html` becomes a *consumer* of that engine's output, not a second place where weight rules are evaluated.

## Reports
`pages/reports.js` currently has zero weight-specific logic -- confirmed via direct search. This sprint introduces the first weight-analysis surface in this codebase beyond raw history display; there is no existing reports-side calculation to avoid duplicating.

## What This Confirms for the Engine Design
No new weight data source is needed. Every alert rule this sprint implements reads only `animals/{id}/weights` and `animals.current_weight`/`weight_updated` -- the certified SSOT, unchanged and unduplicated.
