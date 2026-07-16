# Repository 5 — Priority 2.75: Business Entry Point Census
**Status: Architectural investigation only. No code modified. No merging performed.**

---

## 1. Business Entry Point Catalog

| Business Event | File | Function | Trigger | Runtime Path Confirmed? |
|---|---|---|---|---|
| **Birth** | `shared.js` | `_ubSubmit()` | "Unified Birth" modal, main flow | ✅ Creates breeding record + animals + weight_log (fixed, Priority 2) |
| **Birth** | `pages/breeding.js` | `submitBirthDirect()` | "Quick/Direct Birth" modal | ✅ Creates breeding record + animals — **no weight_log write at all, no weight field in its form** |
| **Birth** | `assistant.html` | `add_birth` action handler | AI assistant natural-language command | ✅ Creates animal record only, `birth_weight` field set, **no breeding record, no weight_log write** |
| **Birth (mark existing pregnancy as born)** | `pages/breeding.js` | `markBorn(id)` → `openBModal(...,true)` → `submitBreeding()` | "Mark as Born" button on a pregnant breeding record | ✅ **Confirmed, critical: updates the breeding record's `status`/`offspring_count` fields only — does NOT create any `animals` documents for the offspring.** (`fbPost('animals',...)` count in `submitBreeding()`'s own body: zero, confirmed by direct grep) |
| **Death (individual)** | `animals.html` | `submitDeath()` | "Death" modal (main button) | ✅ |
| **Death (individual, row menu)** | `animals.html` | `submitDeathSingle(id)` | Per-row context menu action | ✅ |
| **Death (bulk)** | `animals.html` | `performBulkDeath(ids)` (via `execBulk`) | Bulk-select → Death | ✅ |
| **Death (individual, dedicated page)** | `dead.html` | `submitDead()` | The Death Records page's own form | ✅ |
| **Sale (individual)** | `animals.html` | `submitSold(id)` | Per-row "Sold" action | ✅ Canonical, `status:'sold'` |
| **Sale (bulk)** | `animals.html` | `performBulkSell(ids)` | Bulk-select → Sell | ✅ Fixed, Priority 1 |
| **Sale (via Remove Animal)** | `animal-detail.html` | `submitRemoveAnimal()`, `reason==='sale'` branch | "Remove Animal" modal | ✅ Fixed, Priority 1 follow-up |
| **Transfer (bulk, Animals page)** | `animals.html` | `performBulkTransfer(ids)` | Bulk-select → Transfer | ✅ Confirmed still affected by the `closeModal()`-timing bug (separate, not-yet-repaired violation) |
| **Transfer (bulk, Barns page)** | `barns.html` | `submitTransfer()` | Barns page's own transfer tool | ✅ Confirmed correct (reads fields before `closeModal()`) |
| **Weight Recording** | `pages/animal_detail.js` | `submitWeight(editId)` | Animal Detail's "Add/Edit Weight" modal | ✅ Canonical — writes `weight_log` + fans out to `current_weight` on create only |
| **Weight Recording** | `assistant.html` | weight-update action | AI assistant command | ✅ Writes both `weight_log` and `current_weight` together, correctly, but omits `animal_id` |
| **Weight Recording (side effect only)** | `pages/production.js` | `submitProd()`, `type==='weight'` branch | Production-log entry with type=weight | ✅ Confirmed: writes `current_weight` only, **no `weight_log` entry** |
| **Vaccination** | `pages/vaccine.js` | `submitVacc()` | Vaccine page's add/edit form | ✅ Single implementation found — no duplicate |
| **Treatment / Medication** | `pages/health.js` | `submitHealth()` | Health page's add/edit form | ✅ Single implementation found — no duplicate |
| **Pregnancy** | *(not a distinct entry point)* | — | — | **Not Applicable** — pregnancy is a `status` value (`'pregnant'`) on the same `breeding` record created/edited by `submitBreeding()`, not a separate business event with its own entry point |
| **Breeding (record creation/edit)** | `pages/breeding.js` | `submitBreeding()` | Breeding page's add/edit form | ✅ Single implementation — used for pending/pregnant/failed status transitions and (per the finding above) also mis-used for "born" without creating animals |
| **Milk/Meat Production** | `pages/production.js` | `submitProd()` | Production page's add/edit form | ✅ Single implementation found — no duplicate |
| **Inventory Movement** | `pages/inventory.js` | `submitInv(type)` | Inventory page's add/edit form, dispatches internally by `type` (feeds/meds/equipment) | ✅ Single implementation, shared across all three inventory types — no duplicate |
| **Purchase** | *(not a distinct entry point)* | — | — | **Cannot Be Proven as a separate event** — no dedicated "purchase" workflow found; purchases of feed/meds/equipment appear to be represented simply as `inventory` quantity increases via the same `submitInv()`, and animal purchases were not found as a distinct flow anywhere (only birth/import bring new animals into the herd) |
| **Finance Transaction** | 6 files, 10 confirmed call sites | (see prior Dependency Graph phase for full list) | Various — manual entry, auto-generated from sale/death/loss events | ✅ Already investigated in depth (Repository 4): confirmed **not** duplicated business logic — genuinely different transaction types sharing one collection |
| **Daily Task (manual)** | `pages/tasks.js` | `submitTask(editId)` | Tasks page's add/edit form | ✅ Single implementation |
| **Daily Task (auto-generated)** | `pages/tasks.js` | `generateRecurringTasks()` | Background process, runs on page load | ✅ Confirmed distinct from manual creation — a system automation, not a user entry point, but a real second *writer* of the same collection |
| **Notification** | *(no live writer)* | — | — | **Confirmed Reserved** (per Priority-2-era audit) — `generateNotifs()` computes live, ephemeral notifications; no `fbPost('notifications',...)` exists anywhere |
| **Activity Log** | Universal | `logActivity()` | Called from nearly every other entry point in this catalog | ✅ By design, the one entity meant to have many writers — not itself a duplication risk |
| **Authentication** | `login.html` | `attemptLogin()` | Login screen | ✅ Single implementation, confirmed — no second login path found anywhere |
| **Farm Settings** | `pages/farm_profile.js` (+ implicitly every page via `getSettings()`) | `saveSettings()` writer; `getSettings()` reader everywhere | Farm Profile page's save action | ✅ Single writer function, but **`localStorage`-only, no Firebase persistence** (already documented, Repository 4) |
| **Animal Edit (individual)** | `animal-detail.html` | `submitEditAnimal()` | Animal Detail's edit form | ✅ |
| **Animal Edit (bulk)** | `animals.html` | `execBulk()`'s `edit` branch | Bulk-select → Edit | ✅ **Confirmed unreachable from any UI button** (dead code, per Repository 4's original audit — restated here since this census explicitly asked for every entry point, live or not) |
| **Animal Delete (individual)** | `animals.html` | `deleteAnimalFull(id, labelEnc)` | Per-row "Delete" action | ✅ |
| **Animal Delete (bulk)** | `animals.html` | `performBulkDelete(ids)` (via `execBulkDo`) | Bulk-select → Delete | ✅ |
| **Animal Import** | `import.html` | its own import/parse/write flow | CSV/Excel file upload | ✅ Single implementation |
| **Animal Export** | `animals.html` | `exportExcel()`/`exportCSV()` | Export buttons | ✅ |
| **Animal Export** | `import.html` | its own export function | Export button on the same page | ✅ **A second, independent export implementation** — not yet compared field-for-field against `animals.html`'s version |

---

## 2. Runtime Flow Diagrams (for events with genuine duplication or newly-discovered gaps)

### Birth — five entry points, three distinct shapes
```
_ubSubmit() [canonical, post-Priority-2]
   ↓
breeding (created) → animals (created, ×qty) → weight_log (created, ×qty, if weight given)
   ↓
activity_log → toast → page refresh

submitBirthDirect() [pages/breeding.js]
   ↓
breeding (created) → animals (created, ×qty) → [NO weight_log write — no weight field exists in this form at all]
   ↓
activity_log (Cannot Be Proven — not individually re-verified this pass whether this path logs activity)

add_birth [assistant.html, AI action]
   ↓
animals (created, ONE record, birth_weight field set) → [NO breeding record created] → [NO weight_log write]
   ↓
Cannot Be Proven whether activity_log fires — not re-verified this pass

markBorn() → submitBreeding() [pages/breeding.js]
   ↓
breeding (status updated to 'born', offspring_count set) → [NO animals created at all]
   ↓
activity_log fires (confirmed, submitBreeding's own logActivity call) — but describes an event that produced zero new animal records
```

### Death — four entry points, high structural similarity
```
submitDeath() / submitDeathSingle() / submitDead() [dead.html]
   ↓  (all three confirmed to read their fields BEFORE closeModal — correct)
animals.status='dead' + death_* fields → finance (conditional, if loss>0) → activity_log → refresh

performBulkDeath(ids) [animals.html, via execBulk]
   ↓  (confirmed still affected by the closeModal-before-read bug — separate, undocumented-as-fixed violation)
animals.status='dead' + death_* fields (per-animal, dynamic ID) → finance (conditional) → activity_log → refresh
```

### Weight Recording — three writers, two shapes
```
submitWeight() [pages/animal_detail.js, canonical]
   ↓
weight_log (created) → animals.current_weight (fan-out, create only) → activity_log → refresh

_ubSubmit()'s birth-weight portion [shared.js, post-Priority-2]
   ↓
weight_log (created, per-animal) → [does NOT also set animals.current_weight]

assistant.html's weight-update action
   ↓
weight_log (created) → animals.current_weight (fan-out) → [omits animal_id]

pages/production.js's type='weight' branch
   ↓
animals.current_weight (patched) → [NO weight_log entry created at all]
```

---

## 3. Duplicate Business Rule Report (evidence-based comparison)

| Event | Comparison Result | Evidence |
|---|---|---|
| **Birth** | **Completely independent logic**, four distinct shapes for what should be one business meaning | `_ubSubmit` creates breeding+animals+weight_log; `submitBirthDirect` creates breeding+animals only; `add_birth` creates animals only; `markBorn`/`submitBreeding` creates neither animals nor weight_log, only updates a count |
| **Death** | **Mostly identical logic**, one confirmed divergence (`performBulkDeath`'s field-read timing bug already tracked separately) | Field sets match closely across all four; only the bulk path currently mis-executes due to the pre-existing, separately-tracked `execBulk`/`closeModal` ordering issue |
| **Sale** | **Now identical** (Priority 1 + follow-up closed this) | Confirmed, prior report |
| **Transfer** | **Partially overlapping logic, one confirmed divergent** | `barns.html` reads fields correctly; `animals.html`'s bulk path does not (same root cause as Death's bulk divergence — the shared `execBulk` dispatcher) |
| **Weight Recording** | **Partially overlapping**, three different completeness levels | Only `submitWeight` does the full fan-out (`weight_log` + `current_weight`); assistant.html does the same fan-out but with a smaller schema; production.js and (pre-fix) `_ubSubmit` each did only half the job, in opposite directions |
| **Vaccination, Treatment, Milk Production, Inventory Movement, Daily Task (manual), Authentication, Animal Import, Animal Edit (individual), Animal Delete** | **Single implementation each — no duplication to compare** | Confirmed by exhaustive search; nothing to unify |
| **Animal Export** | **Two independent implementations, not yet compared field-for-field** | `animals.html` and `import.html` each have their own export function; whether they produce identical output was not verified this pass — marked **Cannot Be Proven** rather than assumed |

---

## 4. Canonical Workflow Specification (documentation only)

### Birth (target shape)
```
Validate (mother tag + breed required)
   ↓
Create/locate breeding record (status transitions: pending → pregnant → born)
   ↓
Create one animals record per offspring
   ↓
If a weight was provided: create one weight_log entry per offspring, linked by real animal_id
   ↓
Activity log
   ↓
Cache invalidation (animals, breeding, weight_log)
   ↓
UI refresh
```
**Every one of the five confirmed birth entry points should converge on this shape.** `markBorn()` specifically must gain the "create animals + weight_log" steps it currently entirely lacks — the largest single gap found in this census.

### Weight Recording (target shape)
```
Validate (weight > 0)
   ↓
Create weight_log entry, linked by animal_id
   ↓
Fan-out: update animals.current_weight (on every new entry — not just from certain entry points)
   ↓
Activity log → cache invalidation → UI refresh
```
**`pages/production.js`'s weight-type branch and (post-Priority-2) `_ubSubmit`'s weight portion should both gain the step they're each individually missing**, per the Priority 2.5 findings.

---

## 5. Repository-Wide Matrix

| Business Event | Entry Points | Canonical Candidate | Duplicate Logic | Missing Logic | Ready for Unification |
|---|---|---|---|---|---|
| Birth | 5 | `_ubSubmit()` | Yes, severe | 3 of 5 paths miss weight_log or animal creation entirely | ⚠ Needs Product Decision (is `markBorn` even supposed to create animals, or is that intentionally a separate step?) |
| Death | 4 | `submitDeath()`/`dead.html`'s `submitDead()` (tied — nearly identical) | Yes, one confirmed divergence | Bulk path's field-timing bug (already tracked) | ✅ Ready for Unification |
| Sale | 3 | `submitSold()` | **Resolved** (Priority 1) | None remaining | ✅ Already Unified |
| Transfer | 2 | `barns.html`'s `submitTransfer()` (the correct one) | Yes, one confirmed divergence | Bulk path's field-timing bug | ✅ Ready for Unification |
| Weight Recording | 3 (+1 already-fixed) | `submitWeight()` | Yes | Two different missing pieces on two different paths | ⚠ Needs Product Decision (should production-logged weight always create history, or is that intentionally lightweight?) |
| Vaccination | 1 | — | No | None found | Not Applicable (nothing to unify) |
| Treatment/Medication | 1 | — | No | None found | Not Applicable |
| Milk Production | 1 | — | No | None found | Not Applicable |
| Inventory Movement | 1 | — | No | None found | Not Applicable |
| Finance | 10 sites, legitimately varied | N/A — not a duplication | No (confirmed, Repository 4) | None | Not Applicable |
| Daily Task | 2 (manual + auto-generated) | `submitTask()` for manual; `generateRecurringTasks()` is a distinct, legitimate automation, not a duplicate | No | None found | Not Applicable |
| Notification | 0 live writers | — | No | Reserved capability, no producer | ⚠ Needs Product Decision (already documented, Repository 4) |
| Activity Log | Universal (by design) | — | No (intentional) | `activity.html` viewer is empty (separate, known issue) | ⚠ Requires Separate Investigation (unrelated to unification) |
| Authentication | 1 | — | No | None found | Not Applicable |
| Farm Settings | 1 writer, localStorage-only | — | No | Firebase sync (already documented, Repository 4) | ⚠ Needs Product Decision |
| Animal Edit | 2 (1 dead) | `submitEditAnimal()` | No (bulk path unreachable) | N/A | ⚠ Hidden Dependency (dead code shouldn't drive unification per this project's own standing rule) |
| Animal Delete | 2 | Both appear structurally sound | **Cannot Be Proven** — not individually re-diffed this pass | Unknown | ⚠ Requires Separate Investigation |
| Animal Import | 1 | — | No | None found | Not Applicable |
| Animal Export | 2 | **Cannot Be Proven** which is more complete | Unknown — not compared field-for-field | Unknown | ⚠ Missing Runtime Evidence |

---

## 6. Readiness Assessment

**Ready for Priority 3 (Business Rule Unification), event by event:**
- ✅ **Death, Transfer** — genuinely ready: exactly one known divergence each, already precisely characterized (the shared `closeModal`-before-read bug), canonical candidate obvious and uncontested.
- ✅ **Sale** — already unified, nothing further needed.
- ⚠ **Birth, Weight Recording, Farm Settings, Notifications** — real product decisions needed before unification can proceed (what *should* `markBorn` do; should production-logged weight always create history; should Settings move to Firebase; should Notifications get a real producer). Unifying code before these decisions would mean guessing at intended behavior, which this entire engagement's methodology exists to avoid.
- ⚠ **Animal Delete, Animal Export** — **not enough evidence gathered yet** to even classify a canonical candidate; both entry points exist and appear reasonable, but weren't diffed against each other this pass. This is explicitly a "Missing Runtime Evidence" / "Requires Separate Investigation" state, not a false "ready."
- **Not Applicable to unification:** Vaccination, Treatment, Milk Production, Inventory Movement, Finance, Authentication, Animal Import, Daily Task — each confirmed to have either exactly one implementation or, for Finance, multiple legitimately-different transaction types sharing one collection. Nothing to unify.

**Overall repository readiness for Priority 3:** **Partial.** Two business events (Death, Transfer) are genuinely, immediately ready. The rest either need a product decision first, or need one more focused evidence-gathering pass (Animal Delete, Animal Export specifically) before a canonical candidate can be named with the same confidence this engagement has required at every prior step.

---

**No source file was modified. No merging performed. No refactor begun. Stopping here, per instructions.**
