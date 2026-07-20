# EPIC E1 — Weight System Convergence: Definitive Engineering Specification
**Repository re-verified via two independent search strategies (broad term sweep; per-file manual hit inspection), which converged on the same model. New finding this session: `cost.html`'s manual profit calculator — confirmed zero Firebase interaction, not a storage concern.**

---

## Phase 2 — Weight Inventory

| Location | Classification | Role |
|---|---|---|
| `animal-detail.html`'s `animals/{id}/weights` | Persistent storage, Canonical | Real weight history — writer + reader |
| `animal-detail.html`'s displayed "last weight" | Displayed value | Computed live from the above, not stored separately |
| `weight_log` (top-level) | Persistent storage, Orphaned | Written by `assistant.html`, `shared.js`; read by nothing |
| `weights` (top-level) | Persistent storage, Dead | Referenced only in `settings.html`'s reset-tool array |
| `animals.current_weight` | Persistent storage, Derived/Cached | Written by `assistant.html`, `pages/production.js`, `submitEditAnimal`; read by `animals.html`, `import.html` |
| `animals.birth_weight` | Persistent storage, Distinct concept | Set once at animal creation by `_ubSubmit`/`submitBirthDirect`; not part of ongoing history |
| `pages/production.js`'s weight-type entries | Indirect writer | Writes `production_log` + fans out to `current_weight`; never touches `animals/{id}/weights` |
| `cost.html`'s `sell-weight` field | **Temporary variable, this session's finding** | Client-side-only input for a what-if profit calculation; never persisted |
| Dashboard, Reports, AI (beyond the one confirmed `assistant.html` action) | Not found as consumers | Confirmed absent, this and prior sessions |

---

## Phase 3 — Firebase Schema Audit

| Collection/Path | Canonical? | Writers | Readers | Can Be Deleted? | Can Be Merged? |
|---|---|---|---|---|---|
| `animals/{id}/weights` | **Yes** | `submitAddWeight` | `animal-detail.html`'s own render | No — this is the live system | N/A — this is the target |
| `weight_log` | No — Legacy/Orphan | `assistant.html`, `shared.js` | None found (repository-scoped) | Only after confirming no external/Cloud Function consumer (Unknown, unverifiable from here) | Yes, into `animals/{id}/weights`, pending the SoT decision |
| `weights` | No — Dead | None (post-Priority-2) | None | Yes, low risk — already inert | N/A — nothing to merge, just remove the stale reference |
| `animals.current_weight` (field, not a collection) | No — Derived, but with no consistent owner | 3 unrelated functions | 2 pages | N/A — a field, not a collection | Should become a true fan-out target once Weight SoT is decided |

---

## Phase 4 — Execution Graph

**Writer (`submitAddWeight`):**
```
Click "Add Weight" → openAddWeight() → fill form
   ↓ validation (weight 0<w≤500, date required)
   ↓ payload {weight, date, notes}
fbPost('animals/{id}/weights', payload)
   ↓
logActivity
   ↓
re-fetch animals/{id}/weights
   ↓
renderDetail() → renderWeightTable()
   ↓
[NO Dashboard/Analytics/Reports/AI refresh — confirmed absent]
```

**Writer (`pages/production.js`, weight-type entry):**
```
Submit production entry, type='weight'
   ↓
fbPost('production_log', {...})
   ↓
fbPatch('animals', animal._id, {current_weight, weight_updated})
   ↓
[NO animals/{id}/weights entry — the real history is bypassed]
```

**Reader (`animal-detail.html`'s own page load):**
```
Data source: fbGet('animals/{id}/weights')
   ↓
Transformation: sort by date, compute last/first/highest bar-chart scale
   ↓
Display: renderWeightTable()
   ↓
Refresh trigger: page load, or after this page's own add/delete
```

**Reader (`animals.html`'s table/export):**
```
Data source: animal.current_weight (read directly from the animals collection)
   ↓
No transformation
   ↓
Display: table cell / CSV export column
   ↓
Refresh trigger: standard animals list refresh — NOT tied to any weight-specific event
```

---

## Phase 5 — Dependency Graph

- **Single Source of Truth (as currently used by the real feature):** `animals/{id}/weights`.
- **Multiple Sources (for the broader concept "an animal's weight"):** `animals/{id}/weights`, `weight_log`, `animals.current_weight`, `animals.birth_weight` — four distinct storage locations for overlapping meanings, confirmed.
- **Fan-out Writes:** `assistant.html`'s weight action (correctly fans to `weight_log`+`current_weight` together); `pages/production.js` (fans to `current_weight` only, no history); `submitAddWeight` (fans to nothing beyond its own collection).
- **Fan-in Reads:** None found — no single reader consumes more than one of these four locations at once.
- **Cyclic Dependencies:** None found.
- **Hidden Dependencies:** `cost.html`'s calculator reads no stored weight at all — confirmed independent, not a hidden dependency on any of the above.
- **Shared Helpers:** None specific to weight — each writer builds its own payload independently.
- **Duplicated Helpers:** None found (unlike `genDeathId()`'s confirmed 2-file duplication for Death — no equivalent exists for Weight).
- **Dead Dependencies:** `weight_log`'s two writers, from the perspective of the real feature.

---

## Phase 6 — Runtime Risk Analysis (Attempting to Break the System)

| Risk | Attempted Finding |
|---|---|
| Double write | `submitAddWeight` has no idempotency guard — a rapid double-submit would create two entries. Not independently re-tested this session (consistent with Birth's already-characterized "accidental safety via closeModal DOM removal" pattern, Inference D, not proven specifically here). |
| Partial write | Single-collection write (`animals/{id}/weights` only) — no multi-step sequence to leave partially complete. Lower risk than Birth/Death by construction. |
| Missing write | Confirmed, structurally: `pages/production.js`'s weight-type entries never reach `animals/{id}/weights` — not a bug, a confirmed architectural gap. |
| Stale cache | `animal-detail.html` re-fetches after every write — no caching layer found for this specific data. |
| History mismatch | **Confirmed, directly**: an animal weighed via Production shows a current-weight number that its own history chart will never display. |
| Dashboard/Analytics/Reports mismatch | Cannot mismatch — confirmed non-consumers (nothing to compare against). |
| Birth mismatch | Confirmed (Priority 2/RSOT): birth weight goes to `weight_log`, which the real display never reads — the newborn's birth weight is invisible on its own history chart. |
| AI mismatch | `assistant.html`'s weight action writes correctly to `weight_log` (still the wrong collection relative to the real feature) — same class of mismatch as Birth's. |
| Chart/sorting/filter mismatch | Not evaluated — `animals.html`'s table sorts/filters on `current_weight` directly; given that field's own unreliability, any sort-by-weight feature would inherit the same staleness. Not independently tested this session. |

---

## Phase 7 — Historical Data Audit

- **Records affected:** Unknown count — no access to the real production Firebase database from this sandbox. Any `weight_log` entries created since Priority 2's fix (birth weights) and any pre-existing `weight_log` entries from `assistant.html`'s AI action are candidates for migration.
- **Collections affected:** `weight_log` → `animals/{id}/weights` (if D-01 selects the real system as canonical).
- **Fields affected:** `weight_log`'s schema (`animal_id`/`animal_tag`, `weight`, `date`, `notes`, `recorded_by`) would need mapping to `animals/{id}/weights`'s schema (`weight`, `date`, `notes` — no `recorded_by` field confirmed present in the real system's writes).
- **Backfill requirement:** A one-time migration script reading `weight_log`, grouping by animal, and writing corresponding entries into each animal's `animals/{id}/weights` path.
- **Rollback complexity:** Medium — a migration script's effects are reversible only if the original `weight_log` data is preserved (not deleted) until the migration is confirmed correct.
- **Integrity risk:** Potential duplicate entries if a birth weight was ALSO somehow manually re-entered via `submitAddWeight` after the fact — not confirmed to have happened, but a real risk category for any backfill.

---

## Phase 8 — Decision Matrix (No Recommendation, Per Instructions — Comparison Only)

| | Option A: `animals/{id}/weights` becomes sole canonical | Option B: `weight_log` becomes sole canonical | Option C: Maintain both with explicit sync |
|---|---|---|---|
| **Pros** | Zero change to the real, already-working feature; lowest total migration (only 2 writers re-pointed, not the reader) | N/A — would require migrating the one thing that currently works | Preserves both code paths untouched |
| **Cons** | `weight_log`'s 2 writers need code changes; historical `weight_log` data needs backfill | Discards the proven, live system in favor of the unread one; `animal-detail.html` would need rewriting | Perpetuates the exact debt this investigation exists to resolve; adds real synchronization complexity with no evidenced benefit |
| **Migration effort** | Medium (2 writers + 1 backfill) | High (rewrite the real feature + backfill in the other direction) | None initially, but ongoing sync-logic cost forever |
| **Rollback effort** | Low (each writer independently revertible) | High (touches the live feature) | N/A (nothing changes) |
| **Performance** | No change (nested-path reads are already how the real feature works) | Would require restructuring `animal-detail.html`'s query pattern | Doubled write cost per weight event |
| **Maintainability** | High (single source going forward) | High (single source, but the wrong one relative to current usage) | Low (two sources to keep in sync forever) |
| **Blast radius** | Confirmed: `pages/production.js`, `assistant.html`, `shared.js` (3 files) | Would additionally include `animal-detail.html` itself | All of the above, plus new sync code |
| **Future compatibility** | Aligns with the nested-path pattern already used for `offspring`/`vaccinations`/`medications` in `animal-detail.html` (RRAS finding) | Misaligned with that same pattern | Neither aligned nor simplified |

---

## Phase 9 — Adversarial Review

- **Missing caller?** Re-checked via the second search strategy this session — no new caller of any weight-writing function found beyond the 4 already documented (`submitAddWeight`, `assistant.html`'s action, `shared.js`'s `_ubSubmit`, `pages/production.js`).
- **Missing writer?** None found this session beyond the 4 already known.
- **Missing reader?** None found — `animal-detail.html` remains the sole confirmed reader of any persistent weight-history storage.
- **Hidden collection?** None found — the two-strategy sweep this session did not surface any new Firebase path.
- **Forgotten Cloud Function?** **Cannot be ruled out** — this sandbox has no visibility into the live Firebase project's Cloud Functions, if any exist. Stated as a standing, unclosable Unknown, not silently assumed away.
- **Dead runtime?** `pages/animal_detail.js`'s own `submitWeight()` (confirmed dead file, RSOT) reinforces that the *only* live weight-writing UI is in `animal-detail.html` itself, not the separately-named dead file — no new dead runtime found this session.
- **Legacy dependency?** `weight_log`'s continued use by `assistant.html`/`shared.js` is the confirmed legacy dependency — nothing new found.
- **Orphan payload/schema drift?** Confirmed: `weight_log`'s payload shape (includes `animal_breed`, `recorded_by`) differs from `animals/{id}/weights`'s shape (does not include these) — a real schema drift to account for in any migration.

**No new phase-restart triggered — all adversarial checks converge with the already-established model.**

---

## Phase 10 — Engineering Decision Proposal
**Withheld, per this task's own instruction that Phase 8 (Decision Matrix) must not recommend, and per the standing Decision Register (RDR) protocol: D-01 is a Product Decision, to be recorded there, not decided unilaterally in an investigation document.** This specification exists to make that decision informed, not to make it.

---

## Phase 11 — Atomic Backlog (Contingent on D-01's Outcome — Option A Assumed, Since RRMP Already Recorded a Recommendation There)

| Commit | Purpose | Rollback | Runtime Validation |
|---|---|---|---|
| 1 | Re-point `pages/production.js`'s weight-type branch to also write `animals/{id}/weights` | Single revert | Live payload-spy, confirm both `current_weight` and history entry created |
| 2 | Re-point `assistant.html`'s weight action from `weight_log` to `animals/{id}/weights` | Single revert | Live-verify the AI action's write target changes, `current_weight` fan-out preserved |
| 3 | Re-point `shared.js`'s `_ubSubmit` birth-weight write (already targets `weight_log` per Priority 2 — re-target to `animals/{id}/weights`) | Single revert | Repeat Priority 2's own twin-birth live test, confirm correct per-animal linkage in the new location |
| 4 | Add `current_weight` fan-out to `submitAddWeight`/`delWeight` (the real system currently has none) | Single revert | Edit-newest vs. edit-non-newest scenarios, per BL-09's original (misapplied) test design — now correctly targeted |
| 5 | Historical data migration script (`weight_log` → `animals/{id}/weights`) | Preserve source data until confirmed | Dry-run against a copy; verify record counts match pre/post |
| 6 | Retire `weight_log` references (code) | Single revert | Confirm zero remaining writers via repository search |

---

## Phase 12 — Runtime Validation Plan (Pre-Implementation Design)

| Scenario | Test |
|---|---|
| Normal | Add a weight via `submitAddWeight`, confirm it appears in history and `current_weight` |
| Zero | Weight = 0 → validation should reject (already confirmed present, `submitAddWeight`'s own `w<=0` check) |
| Negative | Weight negative → same validation path, `type="number"` `min="0"` at the browser level (confirmed pattern from Commit 3's Death work applies here structurally) |
| Large | Weight = 500 (the confirmed upper bound) and 501 (should reject) |
| Rapid | Two rapid submissions — determine whether the same accidental-safety pattern as Birth applies (not yet tested for this specific function) |
| Historical record | Migrate a `weight_log` entry, confirm it appears correctly in the target animal's history |
| Migration validation | Record count in target matches source count, per animal |
| Dashboard/Reports/AI validation | Confirmed N/A — these are non-consumers; no test needed, a stated fact not an oversight |

---

## Phase 13 — Executive Engineering Report

**Repository map:** 4 real writers, 1 real reader, 4 storage locations for overlapping meaning, 1 confirmed-irrelevant client-side calculator (`cost.html`).
**Execution/Dependency/Schema graphs:** Documented above, Phases 4/5/3.
**Risk matrix:** Phase 6 — highest-confidence risk is the confirmed History Mismatch (Production-entered weights invisible to history).
**Migration plan:** Phase 11, Commits 5–6.
**Rollback plan:** Every commit independently revertible, per this engagement's standing practice.
**Unknowns:** Cloud Function consumption of `weight_log` (unclosable from this sandbox); real-world record counts (no production DB access).
**Open questions:** D-01 itself remains the Decision Register's responsibility.
**Confidence score:** High for the technical picture (two converging search strategies, extensive prior live-testing of the real feature); Medium for the migration's real-world scale (genuinely unknown record counts).
**Engineering readiness:** Ready to execute Phase 11's commit sequence the moment D-01 is recorded.
**Estimated implementation waves:** 1 (Wave A, per RRMP) — all 6 commits belong to a single wave.
**Estimated atomic commits:** 6, as enumerated.
**Estimated runtime validations:** 8, per Phase 12's matrix.

---

**This is the definitive engineering specification for Weight System Convergence. No code was modified. No architecture decision was made — D-01 remains open in the Decision Register, now fully informed by this document.**
