# Certification: Weight Subsystem

**Status: CERTIFIED SSOT. Three adversarial formal verification rounds, live-tested repeatedly. Safe to build on without re-verification for routine work.**

## Canonical Model
`animals/{animalId}/weights` — real, live, single source of truth. Schema: `{weight, date, notes, created_at (auto-stamped by fbPost)}`.

## All Writers (Converged)
`submitAddWeight()` (animal-detail.html, canonical), `pages/production.js`'s weight-type branch, AI assistant's `add_weight`, `createOffspringAnimal()`'s birth-weight block — all four write to the same path with the same schema.

**UPDATED 2026-08-23:** the first three now converge through a single validated service, `recordAnimalWeight()` (shared.js) — permission check, structural validation, per-animal in-flight duplicate guard, animal-existence check, alive-status check, weight-range check (0–500kg), date-format/no-future-date check — rather than calling `fbPost` directly. This resolves the "No animal-existence check at write time" defect below. **`createOffspringAnimal()`'s birth-weight write was not migrated to this service** — it still calls `fbPost('animals/'+newAnimalId+'/weights', ...)` directly (shared.js, near the animal-creation call). Not fixed here: `createOffspringAnimal()` is itself the certified Birth SSOT, and routing its weight write through a service built for editing an *existing* animal's weight (which assumes the animal record is already readable, and duplicates work already done by the birth flow, e.g. re-checking alive-status on a record just created as alive) needs the same evidentiary rigor as any other change to either certified subsystem — not something to fold into a routine pass. Tracked as an open item, not a silent gap.

## `current_weight` Field
Derived, synchronized after every add/delete to the newest remaining record; clears to `null` when none remain (a deliberate design choice, not inherited behavior — no prior fan-out existed to preserve).

## Proven Invariants
- Concurrent writes (multiple tabs, rapid clicks) are safe by construction (Firebase POST semantics) — never lose data, though duplicate *records* from accidental double-submit are possible (no debounce exists).
- Weight history sort order is chronologically correct for any ISO-8601 date, which the native `<input type="date">` enforces at entry.

## Known, Bounded Defects (Not Fixed — Documented)
- **Misleading error toast on partial failure:** if the weight write succeeds but the subsequent activity-log write fails, the user sees a generic "failed" message despite the weight being saved. Root cause: two independent Firebase calls, no transaction available via this REST-only client.
- ~~**`todayStr()` UTC/local-date bug**~~ **RESOLVED 2026-08-23** — proven to misdate entries during a fixed ~2-hour daily window for Egypt (UTC+2), repository-wide, not Weight-specific. The canonical `todayStr()` helper (`firebase.js`) was already fixed to use local time in an earlier commit (`5b52250`), but ~11 call sites across `login.html`, `animal-detail.html`, and `shared.js` independently called `new Date().toISOString().slice(0,10)` instead of the helper, keeping the exact same bug live at each of them. Confirmed via direct `git log -S` inspection that the helper fix predates this pass; all remaining direct call sites switched to `todayStr()` and verified none remain (`grep` across every `.html`/`.js` file, root-level).
- ~~**No animal-existence check at write time**~~ **RESOLVED 2026-08-23** for the three writers now going through `recordAnimalWeight()` (see "All Writers" above) — confirmed by direct code inspection and by `tests/ssot/weight.spec.js` (a placeholder animal id is now correctly refused, `{ok:false, error:'الحيوان غير موجود'}`, before any write). Still open for `createOffspringAnimal()`'s birth-weight write, which by construction targets an animal ID it just created in the same operation — the RTDB-referential-integrity gap this defect describes doesn't apply there the same way (the animal always exists by the time the weight write runs), but it's worth stating precisely rather than marking this item closed for all four writers when it's really closed for three.

## Retired
`weight_log` and top-level `weights` collections — both confirmed inert as of Wave A Commit 6. `weight_log` retains one reader: the historical migration utility (`migrateWeightLogToWeights()`), proven correct against simulated data, never executed against real production data (no Firebase network access from any verification environment used).

## Full History
Wave A (6 commits) + `E1-Weight-System-Investigation.md` + `Formal-Verification-Weight-Subsystem.md`/`Round2`/`Round3` + `Weight-Subsystem-Certification.md`.
