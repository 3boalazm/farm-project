# Repository Runtime Refactoring Master Plan (RRMP)
**Fourth and final architecture document, following RSOT, RRAS, RRCS. No implementation. No code. No patches. Contradiction check performed before proceeding — none found; see note below.**

**Contradiction Check (required before Phase 1):** Re-reading RSOT/RRAS/RRCS for internal consistency found no contradictions between the three. RRAS's correction of RSOT's "universal load order" inference was already reconciled at the time it was made (explicitly reasoned as a D-level inference refinement, not an A-level fact reversal). **Proceeding.**

---

## Phase 1 — Evidence Consumption & Classification

| Finding (source doc) | Classification | Basis |
|---|---|---|
| Sale convention conflict (individual vs. bulk vs. remove-animal) | **Already Solved** | Priority 1, Level A, all 3 writers converged |
| Bulk Transfer `closeModal` timing | **Already Solved** | BL-01, Level A |
| Bulk Death `closeModal` timing | **Already Solved** | BL-02, Level A |
| Direct Birth crash (`submitBirthDirect`) | **Already Solved** | BL-03, Level A |
| Birth-weight orphaned write (`weights`→`weight_log` redirect) | **Superseded** | Priority 2's fix is technically applied, but the Weight Reality Audit proved its *goal* (reaching a real reader) was not achieved — the fix needs to be re-targeted, not re-done from scratch |
| `markBorn()` creates no animals | **Requires Product Decision** | RSOT/BL-04, blocked |
| AI Birth (`add_birth`) incomplete | **Requires Product Decision** | Backlog BL-05 |
| Birth has zero rollback | **Requires Engineering Refactor** | The gap's existence is proven (Level A); the repair strategy is an engineering choice, not a product one |
| Undo infrastructure disconnected | **Requires Product Decision** | Is this feature wanted at all? |
| `current_weight` fan-out (as BL-09 originally scoped) | **False Alarm, as originally written; Superseded by real finding** | The targeted function (`pages/animal_detail.js`) has no execution path (Level B/C) — the *real* gap (in `submitAddWeight`) is a new, distinct, unscoped finding |
| Farm Settings not synced | **Requires Product Decision** | Should this move to Firebase? |
| Notifications no producer | **Requires Product Decision** | Build one, or accept live-only design? |
| `activity.html` empty | **Requires Engineering Refactor** | Content recoverability itself is **Requires Runtime Verification** (Unknown whether restorable from any source) |
| `feed_consumption` fragile name-based FK | **Requires Engineering Refactor + Data Migration** | Confirmed real risk (feed names are editable) |
| Mixed ID/name attribution across entities | **Requires Engineering Refactor** | Broad, low urgency |
| Vaccination `progress`/`status` calc site untraced | **Requires Runtime Verification** | Investigation, not yet a classified issue |
| Two Animal Export implementations, undiffed | **Requires Runtime Verification** | Same reasoning |
| `pages/animal_detail.js`, `pages/births.js`, `pages/notifications.js` unreachable | **Historical Only** | No execution path found, multi-angle audit (RSOT Section 6) |
| `weight_log`, top-level `weights` collections | **Historical Only** | Confirmed inert/write-only-unread |
| "Universal script load order" assumption break (`settings.html`/`login.html`) | **False Alarm** | Was always an explicitly-labeled D-level inference, corrected, never an actual system defect |
| Weight system split 3 ways | **Requires Product Decision + Engineering Refactor (combined)** | This is RRAS's own "Phase A" — the foundational item everything else in the Weight domain depends on |
| Death's non-bulk implementations undiffed | **Requires Runtime Verification** | |
| Sale/Death/Transfer failure behavior beyond Birth | **Requires Runtime Verification** | Only Birth was failure-injection-tested |

---

## Phase 2 — Architectural Debt Graph

```
Weight Source of Truth Decision (Product Decision — Phase A, foundational)
   ↓
current_weight (derived field, 3 uncoordinated writers)
   ↓
   ├── pages/production.js (writer — must be re-pointed once SoT decided)
   ├── assistant.html (writer — must be re-pointed)
   ├── animal-detail.html's submitEditAnimal (writer — must be re-pointed)
   ↓
weight_log (orphaned collection — retirement depends on the SoT decision)
   ↓
   ├── shared.js's _ubSubmit (Birth's weight write — must be re-pointed)
   ↓
Birth System (4 divergent implementations — Wave B)
   ↓
   ├── markBorn (Product Decision blocking — Wave B cannot fully close without it)
   ├── submitBirthDirect (already fixed, BL-03 — no further action)
   ├── add_birth/AI (Product Decision blocking)
   ↓
animal-detail.html (owns the real weight feature AND the real birth-adjacent display)
   ↓
reports.html / dashboard.html (passive readers — affected only if Birth/Weight's
   output shape changes, otherwise untouched)
```

**Required Order, evidenced:** The Weight Source-of-Truth decision must precede any code change to `pages/production.js`, `assistant.html`, or `shared.js`'s birth-weight write, because all three currently target locations whose long-term validity depends on that single decision. This is the one hard, evidence-based sequencing constraint in this entire plan.

---

## Phase 3 — Single Source of Truth Map

| Entity | Canonical Storage | Canonical Writer | Canonical Reader | Shadow Writers | Shadow Readers | Deprecated/Unused Paths | Merge Candidate? |
|---|---|---|---|---|---|---|---|
| Animals | `animals` | Many (no single owner — by design, a shared entity) | Nearly universal | N/A | N/A | None | N/A |
| Breeding | `breeding` | `submitBreeding()` | `breeding.html`, `pages/pedigree.js`, `pages/reports.js` | `_ubSubmit`, `submitBirthDirect` (create breeding records too) | N/A | None | Birth-creation paths could delegate to one shared breeding-record-writer, but this is Wave B's concern, not a storage-merge |
| Weight | **Contested** — `animals/{id}/weights` is the real, live one | `submitAddWeight()` | `animal-detail.html` | `assistant.html`, `shared.js`, `pages/production.js` (all target `weight_log` or `current_weight` instead) | None (for `weight_log`) | `weight_log`, top-level `weights` | **Yes — the central merge candidate of this entire plan** |
| Birth | Split: `breeding` + `animals` | `_ubSubmit` (most complete) | Same as Breeding + Animals | `submitBirthDirect`, `submitBreeding`(markBorn), `add_birth` | N/A | None (all 4 are live-reachable) | Convergence candidate, Wave B |
| Production | `production_log` | `submitProd()` | `settings.html`, `reports.html`, `dashboard.html` | None for `production_log` itself; its weight-type entries are a *shadow writer of `current_weight`* | N/A | None | N/A |
| Vaccination | `vaccinations`/`vaccination_templates` | `submitVacc()` | `pages/reports.js` | None found | N/A | None | N/A |
| Medication | `health` | `submitHealth()` | Many | None found | N/A | None | N/A |
| Finance | `finance` | None single (10 legitimate writer sites) | Many | N/A (by design) | N/A | None | N/A |
| Inventory | `inventory_feeds`/`meds`/`equipment` | `submitInv()` | Dashboard, Reports (feeds/meds only) | None found | N/A | None | N/A |
| Notifications | N/A — computed, not stored | `generateNotifs()` (computation, not persistence) | Every page showing notifications | None (confirmed no persisted writer) | Dormant reader code exists (`pages/notifications.js`, itself unreachable) | The entire stored-notification bucket | Retirement or feature-build — Product Decision |
| Undo | N/A — infrastructure only | `_pushUndo()` (never called) | `undoLast()` (never fed) | None | None | The entire subsystem | Retirement or connection — Product Decision |
| Activity | `activity_log` | `logActivity()` (universal, by design) | Intended: `activity.html` (empty) | N/A | N/A | The viewer page's content | N/A — this is a restoration question, not a merge |
| Reports | N/A — read-only aggregation | N/A | `pages/reports.js` | N/A | N/A | None | N/A |

---

## Phase 4 — Runtime Refactor Waves

### Wave A — Weight System Consolidation
- **Purpose:** Resolve the central architectural debt of this entire engagement.
- **Scope:** Decide and (pending decision) implement a single canonical weight-storage target; re-point `pages/production.js`, `assistant.html`, `shared.js`'s birth-weight write to it; retire `weight_log`/`weights`.
- **Files:** `pages/production.js`, `assistant.html`, `shared.js`, `animal-detail.html` (verification only, not modification, since it's already correct).
- **Collections:** `animals/{id}/weights`, `weight_log`, `weights`, `animals.current_weight`.
- **Risk:** High (touches 3 independent files' write paths).
- **Regression Surface:** Every weight-recording entry point, plus anything reading `current_weight`.
- **Rollback Complexity:** Medium — each re-pointed writer is an isolated, single-function change, individually revertible.
- **Estimated Difficulty:** High (the decision itself, not the code, is the hard part).
- **Estimated Test Cost:** High — requires live verification of all 4 writers post-change.
- **Dependencies:** **Blocks Wave B and Wave C.** Depends on nothing else.
- **Exit Criteria:** All weight-writing paths target one storage location; live-verified via the same instrumented-execution methodology already proven this engagement.

### Wave B — Birth System Convergence
- **Purpose:** Bring all 4 Birth entry points to the same completeness standard.
- **Scope:** `markBorn` (pending Product Decision), `add_birth` (pending Product Decision), consolidate weight-writing once Wave A settles the target.
- **Files:** `pages/breeding.js`, `assistant.html`, `shared.js`.
- **Collections:** `breeding`, `animals`, whatever Wave A designates for weight.
- **Risk:** Medium-High (behavior *additions*, not just reordering).
- **Regression Surface:** Breeding page, AI assistant, dashboard birth registration.
- **Rollback Complexity:** Medium.
- **Dependencies:** **Blocked by Wave A** (for the weight-writing portion only; the `markBorn`/animal-creation portion is independent and could proceed in parallel once its Product Decision resolves).
- **Exit Criteria:** Live-verified: every Birth entry point that's approved to create animals does so correctly; every one approved to write weight history writes to the Wave-A-designated location.

### Wave C — Current Weight Synchronization
- **Purpose:** Restore a real, working fan-out from the canonical weight source to `animals.current_weight`, since the real feature (`submitAddWeight`/`delWeight`) currently has none.
- **Scope:** Add create/edit/delete fan-out to whichever function Wave A designates as canonical.
- **Files:** `animal-detail.html` (if `animals/{id}/weights` remains canonical) — **cannot be finalized before Wave A**.
- **Risk:** Low-Medium once Wave A is settled.
- **Dependencies:** **Blocked by Wave A entirely.**
- **Exit Criteria:** `current_weight` reflects the newest entry in the canonical weight store after every create/edit/delete.

### Wave D — Notification & Undo Resolution
- **Purpose:** Resolve two independent Product Decisions (build a producer / connect Undo, or formally retire both).
- **Scope:** Entirely dependent on the decisions themselves — no code scope until then.
- **Risk:** Low (additive if built; zero-risk if retired, since neither currently affects any live user-facing behavior).
- **Dependencies:** None — can proceed at any time, fully in parallel with Waves A/B/C.
- **Exit Criteria:** A decision is recorded either way; if "build," live-verified; if "retire," the retirement plan (Phase 5) executed.

### Wave E — Shared Runtime Cleanup
- **Purpose:** Address the `closeModal`-timing pattern class-wide (beyond the 3 already-fixed instances) and any remaining modal-lifecycle risks.
- **Scope:** Audit every remaining modal-driven entry point not yet individually verified (Death's 3 non-bulk paths, Sale beyond what Priority 1 covered, any modal in `pages/*.js` files not yet checked).
- **Risk:** Low per-instance (proven fix shape), but breadth is unknown until audited.
- **Dependencies:** None — fully independent of Waves A–D.
- **Exit Criteria:** Every modal-driven write in the repository confirmed to read its fields before `closeModal()`, or confirmed already correct.

### Wave F — Dead Runtime Retirement
- **Purpose:** Formally retire (per Phase 5 below) the confirmed-inert files and collections.
- **Scope:** `pages/animal_detail.js`, `pages/births.js`, `pages/notifications.js`, top-level `weights`, and `weight_log` (**only after Wave A confirms it's safe to retire**).
- **Risk:** Low for the 3 files (zero confirmed callers); **the two collections cannot be retired until Wave A completes**, since Wave A's writers currently still target them.
- **Dependencies:** **Partially blocked by Wave A** (collection retirement only; file retirement is independent).
- **Exit Criteria:** Files removed with a final pre-removal re-verification (per Phase 5's evidence standard); collections' `settings.html` reset-tool reference updated only after confirming zero remaining writers.

---

## Phase 5 — Dead Runtime Retirement Plan

| Item | Classification | Evidence | Retirement Readiness |
|---|---|---|---|
| `pages/animal_detail.js` | **Confirmed Unused** (to the standard this engagement's multi-angle audit could reach — DOM, network, source, deployment config all checked) | RSOT Section 6, Adversarial Audit, Evidence Closure Audit | Ready, pending final sign-off — the residual unknowns (Vercel dashboard, stale SW) are not realistically actionable risks for a static file with zero committed-config reference |
| `pages/births.js` | **Confirmed Unused** | Same script-src audit method, this engagement | Ready |
| `pages/notifications.js` | **Confirmed Unused** | Same | Ready |
| `weights` (top-level collection) | **Confirmed Unused** | Zero writers (post-Priority-2), zero readers, only referenced in an admin reset-tool's deletion array | Ready — but the reset-tool reference should be reviewed for whether removing it or leaving it (harmless) is preferred, a trivial decision not requiring this plan's full rigor |
| `weight_log` | **Probably Unused** (repository-scoped only — Cloud Functions/external tooling not checkable from this sandbox) | RSOT/Weight Reality Audit | **Requires Runtime Verification** before retirement — specifically, confirming no Firebase Cloud Function or external process reads it, which is outside this engagement's visibility |
| Undo subsystem | **Historical Compatibility Layer candidate**, pending Product Decision | `_pushUndo` never called, confirmed | Not ready for retirement — awaiting the Wave D decision |
| `notifications`'s stored-record path | Same as above | Confirmed no producer | Not ready — awaiting Wave D decision |

---

## Phase 6 — Shared Helper Consolidation

| Helper | Category | Owner | Callers | Can Move? | Can Split? | Should Stay? |
|---|---|---|---|---|---|---|
| `fbGet`/`fbPost`/`fbPatch`/`fbDelete`/`fbPut` | Firebase Runtime | `firebase.js` | Universal | No — already maximally central | No | Yes |
| `showModal`/`closeModal` | UI Runtime | `shared.js` | Universal | No | No | Yes, **but its lifecycle contract (Phase 3, RRCS) should be documented inline as a code comment in a future task**, given it's the root cause of 3 confirmed bugs |
| `renderFarmModal` | UI Runtime | `shared.js` | 9 confirmed call sites (Repository 4 work) | No | No | Yes |
| `commitBulkPatch` | Bulk Runtime | `shared.js` | `performBulkTransfer`, `performBulkSell` | No | No | Yes |
| `refreshAnimalsAfterBulk` | Bulk Runtime | `shared.js` | `execBulk`, `execBulkDo` | No | No | Yes |
| `logActivity` | Activity | `shared.js` (or `firebase.js` — not independently re-confirmed which file this pass) | Universal | No | No | Yes |
| `_pushUndo`/`undoLast` | Undo Runtime | `firebase.js` | **None** (the entire point of Wave D) | N/A until decided | N/A | **Decision pending** |
| `_ubSubmit` | Core Runtime (Birth) | `shared.js` | `openUnifiedBirthModal`'s confirm button | No | **Possibly** — Wave B may split its weight-writing portion into a reusable piece other Birth paths call | Yes, as the orchestrator |
| `getSettings`/`saveSettings` | Core Runtime | `firebase.js` | Universal | No | No | Yes — but its `localStorage`-only nature is a separate, already-documented Product Decision (Farm Settings), not a helper-consolidation concern |

---

## Phase 7 — Data Model Consolidation

| Item | Nature | Recommendation |
|---|---|---|
| `animals/{id}/weights` vs. `weight_log` | Duplicate storage for the same concept | **Migration Needed** (pending Wave A's decision on which survives) |
| `animals.current_weight` | Derived field, currently unsynchronized | **Migration Needed** — requires a real, confirmed fan-out once Wave A/C complete |
| `breeding.offspring_count` vs. real `animals` count | Derived field, unenforced | **Product Decision** (does `markBorn` get fixed, making this enforceable, or does the field's meaning change?) |
| `weight_log` (if retired) | Orphan collection | **Safe to Merge/Retire** pending Wave A + the Cloud-Function verification noted in Phase 5 |
| `weights` (top-level) | Redundant, confirmed inert | **Safe to Merge/Retire** |
| `vaccinations.from_template` → `vaccination_templates` | Legitimate parent/child, not a duplicate | **Leave As-Is** |
| `production_log` vs. `animals.current_weight` (weight-type entries) | Fan-out, currently partial | **Migration Needed** (Wave C) |
| `finance`'s 10 writer sites | Legitimately varied transaction types sharing one ledger | **Leave As-Is** — confirmed not duplication (prior engagement finding) |
| `feed_consumption.feed_name` (string) vs. `inventory_feeds._id` | Fragile FK style | **Migration Needed** |
| Mixed name-based vs. ID-based attribution (`added_by`/`recorded_by` vs. `assigned_to`) | Inconsistent convention, not broken data | **Leave As-Is short-term; Migration Needed if ever prioritized** — explicitly low urgency per RSOT |

---

## Phase 8 — Refactoring Risk Matrix (Every File, Exactly Once)

**Low Risk (isolated, self-contained, or read-only):**
`pages/datepicker.js`, `pages/tour.js`, `pages/reports.js` (read-only, confirmed), `pages/pedigree.js`, `pages/finance.js`, `pages/farm_profile.js`, `pages/tasks.js`, `pages/vaccine.js`, `pages/inventory.js`, `pages/health.js`, `barns.html`, `users.html`, `login.html`, `notifications.html`, `cost.html`, `diary.html`, `dead.html`, `pedigree.html`, `farm-profile.html`, `health.html`, `vaccine.html`, `inventory.html`, `finance.html`, `tasks.html`, `reports.html`, `users.html` *(each appears once — this list intentionally groups by risk tier, not by file-type)*

**Medium Risk (touches shared entities but has a bounded, well-understood scope):**
`animal-detail.html` (Wave A/C's central file), `pages/production.js` (Wave A/C), `pages/breeding.js` (Wave B), `settings.html` (contains destructive reset tools — risk is concentrated, not diffuse), `import.html`, `births.html`, `fix-births.html`, `dead.html` *(moved here specifically for its legacy `sold_at` fallback display tied to Priority 1's convention)*

**High Risk (wide cross-file reach or unverified real-world behavior):**
`assistant.html` (widest collection footprint, zero live-tested AI intents), `dashboard.html` (Birth's canonical entry point, extensively tested but high domain centrality), `nav.js` (loaded nearly everywhere)

**Critical (application-wide blast radius):**
`animals.html` (widest cross-file surface, 26 files reference `animals`), `shared.js` (loaded nearly everywhere, houses the majority of shared helpers including the modal lifecycle root-cause), `firebase.js` (every Firebase operation in the entire application flows through it)

**Historical/Retirement-track (not classified by refactoring risk — classified by retirement readiness instead, per Phase 5):**
`pages/animal_detail.js`, `pages/births.js`, `pages/notifications.js`

**Not independently classified (config/infrastructure, not application logic):**
`config.js`, `offline-sync.js`, `sw.js`, `manifest.json`

*(Total: 31 HTML + 15 `pages/*.js` + `shared.js` + `firebase.js` + `nav.js` + `config.js` + `offline-sync.js` + `sw.js` = 52 files, every one appearing in exactly one category above.)*

---

## Phase 9 — Runtime Test Matrix

| Wave | Unit | Integration | Runtime Browser | Failure Injection | Regression | Data Validation | Recovery Validation |
|---|---|---|---|---|---|---|---|
| A (Weight) | N/A (no unit-test framework exists in this repo) | Verify each re-pointed writer's payload shape | Live click-through of every weight-writing entry point (repeat this engagement's instrumented-execution method) | Simulate a mid-write failure for each writer | Re-verify `animal-detail.html`'s own history display unaffected | Confirm no duplicate weight entries after the migration | Confirm a failed write leaves no orphaned partial state |
| B (Birth) | N/A | Verify `markBorn`/`add_birth`'s new animal-creation calls match `_ubSubmit`'s payload shape | Repeat this engagement's twin-birth/qty-variation live tests for every entry point | Repeat the exact mid-loop failure injection already proven for `_ubSubmit`, extended to the other 3 paths | Re-verify `_ubSubmit` and `submitBirthDirect` (already fixed) remain correct | Confirm `offspring_count` now matches real animal count post-fix | Define what "partial birth" recovery should look like (currently none exists) |
| C (Current Weight Sync) | N/A | Verify fan-out fires on create/edit/delete | Live-edit the most-recent vs. a non-recent weight entry, confirm correct/incorrect current_weight update respectively | N/A (single-field patch, low failure-mode complexity) | Confirm `animals.html`'s table/export now show correct values | Spot-check several animals' current_weight against their real latest entry | N/A |
| D (Notification/Undo) | N/A | If built: verify producer→reader round-trip | Live-test the actual UI button/flow, whichever direction is chosen | N/A until scope is decided | Confirm no existing live-notification behavior regresses | N/A until scope decided | N/A until scope decided |
| E (Modal Cleanup) | N/A | N/A | Live-test every remaining modal-driven write with a payload spy, same methodology as BL-01/02/03 | N/A | Confirm every already-fixed modal remains correct | N/A | N/A |
| F (Retirement) | N/A | N/A | Confirm the application still loads and functions with the 3 files physically removed | N/A | Full-application smoke test post-removal | Confirm no console error references the removed files | N/A |

---

## Phase 10 — Master Execution Order

**Sequential (hard dependency):** Wave A → Wave B (weight-writing portion only) → Wave C.

**Parallelizable (no evidenced dependency on Wave A/B/C or each other):** Wave D, Wave E — both can begin immediately and proceed independently of everything else.

**Partially parallel:** Wave F — the 3-file retirement can proceed immediately (independent); the 2-collection retirement is blocked by Wave A's completion.

**Recommended overall order:** Wave A first (unblocks the most downstream work) → Waves D/E/F(files) in parallel with Wave A if engineering capacity allows, since none of them touch Wave A's files → Wave B → Wave C → Wave F(collections) last.

**Why this order minimizes regression:** Wave A is the only true bottleneck; everything else either has zero dependency on it or depends on it completing first. Running D/E/F(files) in parallel with A is safe because they touch entirely disjoint files (confirmed via Phase 8's risk matrix — no file appears in both Wave A's scope and D/E/F's scope).

---

## Phase 11 — Architecture Freeze Checklist

Before any Wave begins implementation, confirm:

- [ ] Single Source of Truth preserved or explicitly, consciously changed with migration plan (not silently duplicated further)
- [ ] No duplicate writer introduced without an explicit, documented reason
- [ ] No hidden reader assumption — every consumer of a changed field identified before the change (per Constraint #1, RRCS)
- [ ] No modal lifecycle violation — every field read happens before its own `closeModal()` call
- [ ] No orphan collection created — every new write target has a confirmed reader before being called "canonical"
- [ ] No undocumented runtime path — any new entry point added to this document's Phase 1/3 tables before merge
- [ ] No dead-code assumption made without the multi-angle audit standard this engagement established (DOM + network + source + deployment)
- [ ] Evidence level documented for every claim in the wave's own completion report
- [ ] Regression scope identified and tested per Phase 9's matrix
- [ ] Rollback identified — each wave's changes should remain revertible per-function, as every fix this engagement has produced so far

---

## Phase 12 — Final Note

This document, together with RSOT, RRAS, and RRCS, is the complete architectural and planning reference for Repository 4/5/6. **No code was modified. No implementation was performed. No patches were written.**

Per your own stated intent: the next phase of work executes these Waves one at a time, each with its own audit → implementation → live verification → completion report cycle, exactly matching the discipline already proven across every fix this engagement has produced (Priority 1/2, BL-01 through BL-09). **Wave A is the recommended starting point**, given its position as the sole hard dependency blocking the largest share of remaining work.
