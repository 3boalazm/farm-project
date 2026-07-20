# Birth Event — Canonical Architectural Specification
**Status: Documentation only. No code modified. This document is the permanent contract for the Birth business event.**

---

## Section 1 — Business Event Definition

**Why it exists:** A livestock farm's core asset is its animal population. Birth is the primary mechanism by which that population grows from within the farm (as opposed to Import, which brings in animals the farm did not raise). Without a correctly-functioning Birth event, the herd registry (`animals`) drifts from reality — the farm's actual, physical flock — which undermines every other business capability that assumes `animals` is an accurate census (Health, Vaccination, Finance-on-sale, Weight tracking, and Reports all implicitly trust that every real animal has a corresponding record).

**Business problem it solves:** Converting a real-world event (an animal giving birth) into: (a) a lineage record connecting offspring to their mother, (b) individually trackable animal records for each offspring, and (c) an optional starting weight history point for each.

**Entities that participate:** `breeding` (the lineage/pregnancy record), `animals` (one new record per offspring), `weight_log` (optional, one entry per offspring if a birth weight is recorded).

**Entities that must never participate (evidenced by their total absence from every Birth entry point's write set, across all four implementations):** `finance` (birth itself has no direct financial transaction — a sale or purchase does, but birth alone does not), `inventory_feeds`/`inventory_meds`/`inventory_equipment` (no inventory is consumed by the act of birth-registration itself), `notifications` (confirmed, no live producer exists for any event), `daily_tasks`, `vaccinations`, `health`. **If a future implementation of Birth writes to any of these, that is itself a violation of this specification.**

---

## Section 2 — State Machine

```
[No record exists]
        ↓ (submitBreeding, status='pending' or 'pregnant')
[Breeding: pending/pregnant]
        ↓ (Birth Requested — user submits a birth-registration action)
[Validation: mother tag + mother breed required — confirmed, _ubSubmit's own guard clause]
        ↓
[Breeding Record Created/Updated: status → 'born', offspring_count set]
        ↓
[Animal Records Created: one per offspring — CONFIRMED only in _ubSubmit; CONFIRMED ABSENT in markBorn/submitBreeding; CONFIRMED BROKEN (throws) in submitBirthDirect]
        ↓
[Weight History Created: one per offspring, conditional on weight being provided — CONFIRMED only in _ubSubmit]
        ↓
[Activity Logged: one entry per birth event — CONFIRMED in _ubSubmit and markBorn/submitBreeding; NEVER REACHED in submitBirthDirect due to the exception; Cannot Be Proven for add_birth]
        ↓
[Propagation Complete: page-local refresh only — CONFIRMED, no Dashboard/Reports/Notifications consumer exists]
```

**Every transition above is justified by the live-executed code reviewed in the prior Phase 0 report and re-confirmed this pass.** No transition in this diagram is aspirational — each reflects what `_ubSubmit()`, the canonical path, actually does.

---

## Section 3 — Event Atomicity

| Step | Required | Can Fail | Rollback Exists | Current Runtime Behavior |
|---|---|---|---|---|
| Validate mother tag/breed | Yes | Yes (empty fields) | N/A — fails before any write occurs | Clean failure, toast shown, nothing written |
| Create `breeding` record | Yes | Yes (network) | **No** | If this specific write fails, the whole function's `catch` fires immediately — no animals or weight_log attempted at all. Clean in the sense that nothing partial is left behind *for this specific failure point* |
| Create `animals` record (per offspring, in a loop) | Yes | Yes (network, per iteration) | **No — confirmed by direct code reading** | If offspring #2 of 3 fails, the `breeding` record (already written, claiming `offspring_count:3`) and offspring #1's `animals` record (already written) are **left in place, permanently inconsistent with each other**. The loop does not retry, does not roll back, does not flag the record as incomplete in any way |
| Create `weight_log` entry (per offspring, conditional) | No (optional) | Yes | **No** | Same shape of risk as above, but lower stakes since this is explicitly optional data |
| Log activity | Yes | Yes (though `logActivity`'s own internal error handling is not itself scoped to this analysis) | No | If this specific call fails, the entire birth event succeeds with no audit trail entry — silent from a logging perspective, though the actual data (breeding+animals+weight_log) is unaffected since this step runs last |

**Summary: zero rollback exists at any step.** This is the single most significant atomicity finding — a partial failure midway through offspring creation leaves the `breeding` record's stated `offspring_count` permanently disagreeing with the actual number of `animals` records that exist for it, with no mechanism to detect or repair this automatically.

---

## Section 4 — Idempotency

**Evidence-based answer, not assumed:** `_ubSubmit()` calls `closeModal()` as its first action after validation passes — synchronously, before any `await`. This means the button that triggered the submission is removed from the DOM immediately, which **incidentally** prevents a literal repeated click on the same button from firing the function twice in the overwhelmingly common case.

**However, no explicit idempotency mechanism exists** — no submission-in-progress flag, no disabling of the trigger before the async work begins, no check against an existing record with matching mother-tag/date/quantity before writing. Every write in the function is an unconditional `fbPost` (a Firebase push-create, which always creates a new document — there is no "create if not exists" semantics available in this call pattern at all).

**Therefore, if `_ubSubmit()` were executed twice** (through any means other than a normal single click — e.g., a double-invocation via keyboard/script, or a race condition this analysis has not attempted to construct) **the confirmed outcome would be full duplication**: a second, independent `breeding` record, a second complete set of `animals` records, and a second complete set of `weight_log` entries. **Nothing merges. Nothing is ignored. Nothing is rejected as a duplicate.** This is stated as the mechanical consequence of the code's structure, not as an observed live double-submission (constructing a genuine race condition was not attempted this pass; the conclusion follows directly from the absence of any de-duplication logic, which is a stronger and more general form of evidence).

---

## Section 5 — Canonical Invariants

| Invariant | Currently True? | Evidence |
|---|---|---|
| Every birth creates exactly one breeding record | **True for `_ubSubmit`**, true for `markBorn` (which updates the existing one rather than creating a redundant second) | Confirmed, both live-tested |
| Quantity equals number of created animals | **True for `_ubSubmit` only when no mid-loop failure occurs** (Section 3); **false by design for `markBorn`** (creates zero regardless of quantity); **false for `submitBirthDirect`** (crashes before creating any) | Confirmed, live-tested for all three |
| Every newborn owns exactly one animal record | Same caveats as above | Same evidence |
| Every newborn weight belongs to one animal | **True for `_ubSubmit`**, confirmed via real generated `animal_id` linkage (Priority 2's own live test) | Confirmed |
| Every newborn references its mother | **True for `_ubSubmit`** (`mother_tag`, `mother_breed` set on every animal record) | Confirmed, direct code reading |
| Every birth creates one activity log entry | **True for `_ubSubmit` and `markBorn`**; **never reached for `submitBirthDirect`** (exception occurs first); Cannot Be Proven for `add_birth` | Confirmed via live test for the first two |
| No orphan records are allowed | **False, currently** — Section 3 proves a mid-loop failure produces exactly this orphan condition, with no detection or repair | Confirmed by code reading (absence of rollback) |
| Birth never modifies unrelated collections | **True for `_ubSubmit`** — confirmed, only `breeding`/`animals`/`weight_log` are touched, nothing else | Confirmed, direct code reading |
| **New, evidenced this pass: A birth event's completion (activity log entry, success toast) implies all required writes succeeded** | **False** — `markBorn` produces a successful-looking completion (toast, activity log) while never creating the animals the offspring_count claims exist | Confirmed via live test — this is a genuine, additional invariant violation worth naming explicitly, since it means the *absence* of an error is not proof of correctness for this event |

---

## Section 6 — Complete Propagation Matrix

| Subsystem | Reads | Writes | Triggered | Evidence |
|---|---|---|---|---|
| Animals | — | ✅ (canonical path) | ✅ | `_ubSubmit`'s loop |
| Breeding | — | ✅ | ✅ | `_ubSubmit`'s first write |
| Weight Log | — | ✅ (conditional) | ✅ | `_ubSubmit`'s per-offspring write |
| Finance | ❌ | ❌ | ❌ | Confirmed absent — Section 1 |
| Inventory | ❌ | ❌ | ❌ | Confirmed absent |
| Dashboard | ❌ | ❌ | ❌ | Confirmed, direct search (Priority 2.5) — Dashboard never reads any Birth-related field |
| Reports | ❌ | ❌ | ❌ | Confirmed, direct search (Priority 2.5) |
| Activity | — | ✅ | ✅ | One entry per successful event |
| Notifications | ❌ | ❌ | ❌ | Confirmed, no live producer exists for anything |
| Export | ✅ (indirectly, via `animals.birth_weight`/`current_weight` fields) | ❌ | Passive | `animals.html`/`import.html`'s existing export logic, unchanged by Birth itself |
| Search | ✅ (indirectly, new animals appear in standard filters) | ❌ | Passive | Standard `animals.html` filter/list logic |
| Filters | Same as Search | ❌ | Passive | Same |
| Offline | — | Generic | Generic | No Birth-specific offline handling found or required |
| Cache | — | ✅ (generic invalidation) | ✅ | `fbPost`'s own unconditional invalidation, confirmed in `firebase.js` |
| Statistics | ❌ (no cached statistic depends on Birth) | ❌ | ❌ | Breeding's own fertility report recomputes on demand from raw data — not a "Birth propagation," a separate on-demand calculation |

---

## Section 7 — Dependency Graph (honest termination)

```
User Action (Unified Birth modal submit)
   ↓
Birth Event (_ubSubmit)
   ↓
Validation (mother tag + breed)
   ↓
Breeding (write) — NO ROLLBACK if anything downstream fails
   ↓
Animals (write, ×qty) — NO ROLLBACK, confirmed orphan risk if partial
   ↓
Weight Log (write, ×qty, conditional) — correctly linked by real animal_id
   ↓
Activity (write)
   ↓
Readers: pages/animal_detail.js (weight_log only, per-animal, on-demand visit)
   ↓
Dashboard: ✗ TERMINATES HERE — confirmed no consumer
   ↓
Reports: ✗ TERMINATES HERE — confirmed no consumer
   ↓
Export: animals.html/import.html read the animal's own stored fields, whenever a user next exports — not a push, a passive pull
   ↓
Search/Filters: same passive-pull relationship
   ↓
Cache: generic invalidation only, no Birth-specific cache entity exists
   ↓
Offline: no Birth-specific handling found
   ↓
End
```

---

## Section 8 — Divergence Analysis (every gap, named precisely, not summarized as "Partial")

**`submitBirthDirect()` [pages/breeding.js]:**
- Reads DOM fields (`#nb-sp`, `#nb-breed`, `#nb-gender`, `#nb-date`, `#nb-tag`, `#nb-barn`, `#nb-pur`, `#nb-father-tag`) *after* `closeModal()` has already removed them from the document — confirmed live, this throws `TypeError: Cannot read properties of null` on the very first such read
- Missing animal creation entirely, as a *consequence* of the above, not as a separate design gap
- Missing weight_log entirely — this form has no weight input field at all, so even if the crash were fixed, no weight capability exists here
- Missing activity log — never reached due to the exception
- Missing final toast/UI refresh confirmation of success — the user sees only an error toast, despite the breeding record having actually been created

**`markBorn()`/`submitBreeding()` [pages/breeding.js]:**
- Missing breeding-to-animals write entirely — by design, not by error (confirmed, completes without exception)
- Missing weight_log entirely — no such write exists in this code path at all
- Missing `current_weight`/`birth_weight` propagation — there being no animal records, there is nothing to set these fields on
- Activity log is present but describes an event ("birth registered") that did not actually populate the herd registry — a misleading-but-technically-accurate log entry

**`add_birth` [assistant.html]:**
- Missing breeding record write entirely
- Missing weight_log entirely
- Missing quantity/multi-offspring support — creates exactly one animal record, no loop construct found
- Activity logging and every downstream dimension: **Cannot Be Proven** — no reachable live-test path for this AI action was available this pass

---

## Section 9 — Canonical Contract

| Aspect | Specification |
|---|---|
| **Inputs** | Mother tag (required), mother breed (required), species, gender, purpose, birth date, quantity (default 1), optional: father tag, tag prefix, birth weight, barn, added-by, notes |
| **Outputs** | Success: toast + page refresh. Failure: error toast, console log, **no partial-state indication to the user** |
| **Required writes** | `breeding` (1), `animals` (1 per offspring) |
| **Optional writes** | `weight_log` (1 per offspring, only if weight provided) |
| **Derived fields** | None currently computed by this event |
| **Activity** | Exactly one `logActivity('add','animals', <summary>)` call per successful event |
| **Cache** | Generic, automatic via `fbPost` |
| **Offline** | No special handling; standard write-queue behavior applies (per the project's existing `offline-sync.js` infrastructure — not independently re-verified this pass for this specific event) |
| **Statistics** | None computed or cached by this event itself |
| **Notifications** | None — confirmed, must remain none unless a separate, explicit Product Decision changes Notifications' architecture project-wide |
| **Search / Filters** | No action required — new records surface automatically via existing, unrelated `animals.html` list/filter logic |
| **Export** | No action required — same reasoning |
| **Dashboard** | No action required under the current, evidenced architecture — **explicitly not a requirement of this contract**, since expanding Dashboard's scope would be a separate, larger decision outside Birth's own specification |

---

## Section 10 — Risk Analysis

- **Current Risks:** Three of four live entry points do not fulfill this contract (Section 8). Zero rollback exists anywhere (Section 3) — a network hiccup mid-birth-registration, even via the canonical path, can silently desynchronize `breeding.offspring_count` from the real number of `animals` records.
- **Historical Risks:** Every pre-existing `breeding` record with `status='born'` created via `markBorn()` has **no corresponding animal records** — a real, unquantified backfill problem (this analysis has not attempted to estimate how many such records exist in any real production database, which this sandbox has no access to).
- **Migration Risks:** Consolidating the four paths onto one canonical implementation is additive for three of them (nothing currently-working would stop working) but requires the still-unresolved Product Decision (Architecture Freeze, Section 4) on whether `markBorn` and `add_birth` are *supposed* to create full animal records or remain intentionally lighter.
- **Data Integrity Risks:** The Section 3 partial-failure scenario and the Section 5 "successful completion doesn't imply correctness" finding are the two most severe, both specific to the canonical path itself, not just the broken alternates.
- **Consistency Risks:** `submitBirthDirect`'s crash means its actual production behavior (silent breeding-only record creation) likely does not match what any user of that button believes is happening — the UI shows an error, but a `breeding` record was, in fact, already created before the crash.
- **Future Maintenance Risks:** Four independent implementations means any future business-rule change to Birth (e.g., adding a required field) must currently be applied in up to four places, with three of them already evidenced as inconsistent even before such a change.

---

## Section 11 — Future Canonical API (documentation only, no code)

```
BirthService.registerBirth(input) → result
```

**Inputs:** `{motherTag, motherBreed, species, gender, purpose, birthDate, quantity, fatherTag?, tagPrefix?, birthWeight?, barn?, addedBy?, notes?}`

**Outputs:** A result indicating overall success/failure, the created `breedingId`, the list of created `animalIds`, and — critically, addressing Section 3's finding — an explicit indication of **partial success** if some but not all offspring were created, rather than the current binary success/error toast.

**Responsibilities the service owns (that no caller should ever do itself):**
- Validating required fields before any write begins.
- Creating the breeding record.
- Creating exactly `quantity` animal records, each correctly linked to the mother.
- Creating weight_log entries when a weight is provided, correctly linked by real animal ID.
- Writing the single activity log entry.
- Deciding what "quantity" means and enforcing that the created-animal count matches it (or clearly reporting a mismatch) — **this is the direct answer to Section 3's rollback gap**: callers should never need to know or handle partial-loop failure themselves.

**What callers (UI modals, the AI assistant, the breeding page's "mark as born" action) should never do themselves:** construct the `breeding`/`animals`/`weight_log` write payloads directly, decide field-naming conventions, or read DOM fields after closing their own modal — every current divergence in Section 8 stems from a caller doing at least one of these things itself instead of delegating.

---

**No implementation performed. No code modified. This specification is complete. Waiting for approval before any implementation begins.**
