# AUTO-TASK-EVENTS.md

**All 10 requested events, fully specified. Marked IMPLEMENTED (this sprint) or DESIGNED (future sprint, with the reason it's deferred stated honestly).**

| Event | Trigger | Priority | Role | Due Date | Title | Category | Status |
|---|---|---|---|---|---|---|---|
| Vaccination scheduled | `vaccinations` record created/edited with `status==='pending'` and `scheduled_date` set (either writer: `submitVacc` or `submitTpl`) | high | vet | `scheduled_date` | "تحصين: {name} -- {target_section or animal}" | medical | **IMPLEMENTED** |
| Vaccination overdue | *Not a separate event* -- the task created above naturally becomes visually "overdue" via `tasks.html`'s own existing `overdue` filter once its due date passes. Creating a second task would duplicate, not complement, the first. | -- | -- | -- | -- | -- | **BY DESIGN, not separately implemented** |
| Pregnancy confirmed | `breeding` record transitions to `status==='pregnant'` | medium | vet | +3 days (confirmation checkup) | "متابعة حمل: {female_tag}" | inspection | DESIGNED -- deferred; no confirmed evidence of a distinct farm workflow need beyond what "Expected birth approaching" already covers |
| Expected birth approaching | `breeding` record has `status==='pregnant'` and `expected_birth` set | high | supervisor | `expected_birth` | "ولادة متوقعة: {female_tag}" | breeding | **IMPLEMENTED** |
| Birth completed | `breeding` record transitions to `status==='born'` | medium | vet | +1 day (post-birth check) | "فحص ما بعد الولادة: {mother_tag}" | inspection | DESIGNED -- deferred; reasonable but not evidenced as a current pain point, unlike vaccination/birth-window tracking which the backlog specifically named |
| Animal marked sick | No clean trigger exists in the current data model -- `health.js` records diagnoses/treatments, there is no boolean "sick" status field | -- | -- | -- | -- | -- | **DESIGNED, blocked** -- would require a new field on the Animal or Health entity, a data-model decision outside this sprint's scope |
| Medication follow-up | `health` record created with `withdrawal_end` set (a real, confirmed field -- the date after which the animal's milk/meat is safe) | high | vet | `withdrawal_end` | "انتهاء فترة السحب: {animal_tag}" | medical | **IMPLEMENTED** |
| Weight anomaly | No weight record added in 30+ days for an actively-tracked animal, or two consecutive records show a decline | medium | supervisor | today | "تحقق من وزن: {animal_tag}" | inspection | DESIGNED -- deferred; this is Epic 2's own scope (Weight-Trend Alerting), not Epic 1's -- correctly not duplicated into this sprint |
| Death recorded | `animals.status==='dead'` | -- | -- | -- | -- | -- | DESIGNED, likely unnecessary -- a death is terminal; no clear follow-up task need was evidenced |
| Breeding retry needed | `breeding` record transitions to `status==='failed'` | medium | supervisor | +7 days | "إعادة محاولة تقريع: {female_tag}" | breeding | DESIGNED -- deferred; clean trigger exists (`status==='failed'`), reasonable next-sprint candidate given how little new logic it requires |

## Why Only 3 of 10 Are Implemented This Sprint
The three implemented events span three different domains (Vaccination, Breeding, Health) exactly as Phase 4 requires, each has a clean, already-existing trigger field (no new data-model decisions needed), and each was either explicitly named in the certified backlog (`docs/product/PRODUCT-BACKLOG.md`'s Epic 1) or a direct, low-risk extension of it (`withdrawal_end`). The remaining 7 are honestly specified for future sprints rather than built shallowly and unverified -- several are legitimately blocked on data-model decisions this sprint has no mandate to make.
