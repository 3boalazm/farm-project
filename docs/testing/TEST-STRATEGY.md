# TEST-STRATEGY.md

**Realistic, not over-engineered — this project has no build step and no existing test runner; any strategy must work within that constraint, not fight it.**

## Priority Order (Must Never Break)
1. Weight SSOT (`animals/{id}/weights`, `current_weight` sync)
2. Birth SSOT (`createOffspringAnimal()`, all 3 canonical callers)
3. Permissions (`can()`, now covering all 17 truly-fixable pages per this session's matrix)
4. Firebase writes (no silent data loss)
5. Offline behavior (`FarmOfflineSync` queue integrity)

## Unit Tests
Not currently practical without introducing a build/bundler step — explicitly out of scope per this mission's own rules ("no unnecessary dependencies"). Recommend deferring true unit tests until/unless a build step is separately approved.

## Integration Tests
The proven, already-working approach this entire engagement has used: **Playwright against the real static server**, exactly as demonstrated in this session's own permission-fix verification. This should become a standing, reusable script rather than ad hoc per-session — a concrete, low-cost next step.

## Regression Tests
For Weight/Birth specifically: the exact scenarios already proven in `docs/certification/WEIGHT.md`/`BIRTH.md` (single/multiple offspring, missing weight, animal-not-found, failure-mid-loop) should be captured as a repeatable script, not re-derived from scratch each time a change is made nearby.

## Manual QA Checklist (Minimum, Every Release)
- [ ] Log in as each of the 5 roles; confirm each can/cannot reach the pages `PERMISSION-MATRIX.md` specifies.
- [ ] Add one weight entry from each of the 3 non-canonical writers (Production, AI Assistant, Birth); confirm it appears in the animal's real history.
- [ ] Register one birth via each of the 3 converged entry points; confirm a `breeding` record and correct offspring count result.
- [ ] Confirm `logout()` clears session and returns to `login.html`.
