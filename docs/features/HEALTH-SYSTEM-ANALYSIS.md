# HEALTH-SYSTEM-ANALYSIS.md

## Health Record Lifecycle (Confirmed, Single Writer)
`pages/health.js`'s `submitHealth()` -- one writer, `fbPost('health', data)`. Fields: `{animal_tag, animal_breed, animal_species, barn, date, vet_name, diagnosis, medication, dosage, withdrawal_days, treatment_end, withdrawal_end, bcs, status, notes}`. **`status` is a 2-value system**: `'active'` (قيد العلاج -- under treatment) vs. anything else, treated as complete (مكتمل). `completeHealth()` (gated by `can('health')`) transitions a record out of `active`. **BCS (Body Condition Score) is a real, standardized veterinary metric already captured**, 1-5 scale in 0.5 increments -- unused by any calculation anywhere in the app until this sprint.

## Vaccination Lifecycle (Confirmed, Two Writers -- Reused From Sprint 1)
`status` is a genuine **3-value stored field**: `'pending'` / `'done'` / `'overdue'` -- `'overdue'` is explicitly settable via the form's own `<select>`, not merely a computed display label (confirmed via direct search across `pages/vaccine.js` and `pages/reports.js`). `target_section` is drawn from the same `barns` list used elsewhere in the app -- it is the same concept as `animals.barn`, named differently in this collection, which is how this sprint reconciles a vaccination record to the individual animals it concerns.

## Medication (Not a Separate Entity -- Confirmed)
"Medication" is not its own collection; it is a subset of `health` records that carry a non-empty `medication` field (plus `dosage`/`withdrawal_end`, already the exact fields Sprint 1's `medication_followup` automation reads). This sprint does not introduce a second medication concept -- it reads the same `health` collection Sprint 1 already integrated with.

## Existing Health Calculations (All Confirmed, Reused Not Duplicated)
- `dashboard.html`'s Farm Health Score already deducts for `activeTreatRatio` (active health records / total animals) -- a herd-level, not animal-level, signal. This sprint's per-animal risk score is a genuinely different computation at a different granularity; it does not replace or duplicate the herd-level score.
- Sprint 2's Weight Intelligence (`weight_alerts` collection) is a real, existing per-animal signal this sprint reuses directly, not recomputes.
- Sprint 1's Automation Engine (`daily_tasks`, `window.autoGenerateTask`) is the only task-creation path in the app -- reused, not forked.

## Existing Alerts
`dashboard.html`'s `priorityAlerts` array (already extended once, in Sprint 2) is the established, shared alert-surfacing pattern this sprint extends again, not replaces.

## Existing Reports
`pages/reports.js` has real vaccination-status aggregation (`vacOver`, done/pending counts) but zero per-animal risk computation of any kind -- confirmed via direct search. This sprint introduces the first per-animal composite signal in the codebase.

## What This Confirms for the Engine Design
Every risk factor this sprint's model uses reads an already-existing, already-certified or already-Sprint-1/2-verified field. No new collection is required for input data (only for the risk score's own output, mirroring `weight_alerts`' precedent from Sprint 2).
