# Certification: Weight Subsystem

**Status: CERTIFIED SSOT. Three adversarial formal verification rounds, live-tested repeatedly. Safe to build on without re-verification for routine work.**

## Canonical Model
`animals/{animalId}/weights` — real, live, single source of truth. Schema: `{weight, date, notes, created_at (auto-stamped by fbPost)}`.

## All Writers (Converged)
`submitAddWeight()` (animal-detail.html, canonical), `pages/production.js`'s weight-type branch, AI assistant's `add_weight`, `_ubSubmit()`'s birth-weight block — all four write to the same path with the same schema.

## `current_weight` Field
Derived, synchronized after every add/delete to the newest remaining record; clears to `null` when none remain (a deliberate design choice, not inherited behavior — no prior fan-out existed to preserve).

## Proven Invariants
- Concurrent writes (multiple tabs, rapid clicks) are safe by construction (Firebase POST semantics) — never lose data, though duplicate *records* from accidental double-submit are possible (no debounce exists).
- Weight history sort order is chronologically correct for any ISO-8601 date, which the native `<input type="date">` enforces at entry.

## Known, Bounded Defects (Not Fixed — Documented)
- **Misleading error toast on partial failure:** if the weight write succeeds but the subsequent activity-log write fails, the user sees a generic "failed" message despite the weight being saved. Root cause: two independent Firebase calls, no transaction available via this REST-only client.
- **`todayStr()` UTC/local-date bug:** the default date field uses UTC, not local time — proven to misdate entries during a fixed ~2-hour daily window for Egypt (UTC+2). Repository-wide, not Weight-specific.
- **No animal-existence check at write time:** a weight can be written under a deleted animal's ID; Firebase RTDB has no referential integrity to prevent this.

## Retired
`weight_log` and top-level `weights` collections — both confirmed inert as of Wave A Commit 6. `weight_log` retains one reader: the historical migration utility (`migrateWeightLogToWeights()`), proven correct against simulated data, never executed against real production data (no Firebase network access from any verification environment used).

## Full History
Wave A (6 commits) + `E1-Weight-System-Investigation.md` + `Formal-Verification-Weight-Subsystem.md`/`Round2`/`Round3` + `Weight-Subsystem-Certification.md`.
