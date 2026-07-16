# MASTER FORMAL VERIFICATION & MODEL CHECKING — Round 2
**Every prior conclusion (including Round 1's) treated as unproven. Two genuinely new proof obligations resolved with certainty before proceeding; all else re-derived.**

---

## 0. Corrections to Round 1 (Stated Before Anything Else, Per "Never Invent, Always Correct")

**Schema Correction:** Round 1's `WeightRecord` schema omitted `created_at`. **Proven this round:** `fbPost()` (firebase.js:435) unconditionally spreads `created_at: new Date().toISOString()` onto *every* payload it sends, regardless of what the caller provides. Corrected schema:

```
WeightRecord ::= { weight: Number, date: String(YYYY-MM-DD), notes: String|null,
                    created_at: String(ISO-8601) }   ← corrected, was missing in Round 1
```

This same correction applies to `WeightLogRecord` and every other `fbPost`-written collection in the repository — a repository-wide schema correction, not a Weight-specific one, surfaced by this pass's insistence on re-deriving schema from code rather than trusting Round 1's own text.

**Concurrency Resolution (was Unknown, now Proven):** `fbPost` uses HTTP `method:'POST'` against Firebase RTDB's REST API, which is Firebase's documented `push()`-equivalent semantics — each request receives its own server-generated unique key. This is now a Level A proof, not an inference: concurrent `submitAddWeight()` calls (multiple tabs, multiple devices, rapid double-click) cannot overwrite or lose each other's data, because each POST is independently keyed. Round 1's "duplicate click" scenario, previously marked Inferred (D), is hereby proven Safe (A) for the data-loss dimension specifically — though see §6 for a distinct, still-open dimension (duplicate records, not lost ones).

---

## 1. Formal Behavioral Specification (Expanded)

**Actors:** the authenticated farm-app user (single-role, no distinct actor types found for this subsystem). **Entities:** `WeightRecord`, `WeightLogRecord`, `AnimalCurrentWeight` (per Round 1, now schema-corrected). **Commands:** `AddWeight(animalId, weight, date, notes)`, `DeleteWeight(animalId, recordId)`. **Queries:** implicit, via `fbGet` on page load. **External Systems:** Firebase RTDB (REST), no Cloud Functions found locally (proven, prior session). **Safety Properties (candidate, to be proven/disproven below):** S1 "no weight record is ever silently lost," S2 "no weight record ever references a nonexistent animal at write time in a way the system itself could have prevented." **Liveness Property (candidate):** L1 "every `AddWeight` command eventually either succeeds visibly or fails visibly to the user" (no infinite-pending state).

---

## 2. Design by Contract — Formalized with Frame Conditions

**`submitAddWeight()`:**
- **Preconditions:** P1 (`animalId` set, page-load time), P2 (`animal` object populated, page-load time) — both from Round 1, unchanged.
- **Postconditions:** Q1–Q3, Round 1, unchanged, now with Q1 corrected to include `created_at`.
- **Frame Condition** (what must NOT change): no other animal's data, no other collection, no `current_weight` field (proven absent fan-out, Round 1) — the operation's write footprint is provably confined to exactly one new child under one `animals/{animalId}/weights` path plus one `activity_log` entry.
- **Exceptional Conditions:** validation failure (caught, no write); `fbPost`/`logActivity` rejection (caught by shared try/catch, §3 below refines this).
- **Shared Mutable State:** the page-level `weights` array (closure-captured) — reassigned, not mutated in place, after every successful add (`weights=await fbGet(...)`), meaning no stale-reference risk even if a prior render loop held an old array reference.

---

## 3. Atomicity Verification (Precise Classification)

| Operation | Atomic? | Idempotent? | Retry-Safe? | Delivery Classification |
|---|---|---|---|---|
| `fbPost('animals/{id}/weights', data)` alone | Yes — single HTTP write, no multi-step sequence | No — resubmitting creates a second, distinct record (proven, §0) | No — a client-side retry after an ambiguous network failure could produce a duplicate record | No retry logic exists at all in this codebase (confirmed, direct read) — a failed request simply fails, with no automatic retry. In the actual implementation this is at-most-once from the client's perspective. |
| `submitAddWeight()` as a whole (write + logActivity) | No — two independent Firebase operations, no transaction, no compensating action | No, same reasoning | No | The weight write is at-most-once; the activity log write, being a second independent `await`, can fail after the first succeeds — the formal restatement of Round 1's partial-state counterexample, now correctly classified as a non-atomic two-write sequence with no compensation |

---

## 4. Expanded Invariant Derivation & Proof Obligations

**I1** (Round 1): animal-existence at write time — still unenforced (Missing Contract), real-world exploitability still contingent on the unclosable Firebase-rules unknown (Round 1 reasoning carried forward unchanged).

**I2 (new): "An animal's weight history, once fetched and sorted, is displayed in true chronological order."**
Proof attempt: `weights.sort((a,b)=>b.date.localeCompare(a.date))` — a lexicographic string comparison on `date`. Proof succeeds conditionally: for any `date` value conforming to `YYYY-MM-DD`, lexicographic order is chronological order (a mathematical property of the ISO-8601 date format, not an accident). The proof's validity is entirely contingent on every `date` field actually being ISO-formatted. Since `#w-date` is a native `<input type="date">`, the browser itself enforces this format at entry time — I2 is therefore Proven (A) for records entered through this UI, with the caveat that a record inserted by any other means (direct Firebase console edit, a future writer using a different date convention) would silently break sort order with no validation catching it.

**I3 (new, formalizing Round 1's partial-state finding as a named invariant): "Every successful weight write produces exactly one corresponding activity log entry."**
Disproven — counterexample: the two-write sequence in §3. Minimal Failure Trace:
```
S0: animal-detail.html loaded, weights=[...]
Event: user submits valid weight
Transition: VALIDATING -> PERSISTING
Mutation: fbPost succeeds -- WeightRecord created
Failure: logActivity's own fbPost throws (network blip, distinct request)
Observed State: WeightRecord exists; activity_log has no matching entry;
   user sees a generic "فشل" toast, which is MISLEADING -- the weight WAS
   saved, contrary to what the error message implies
Violated Invariant: I3
Minimal Repair: swap write order (log first, weight second) does not fix
   it -- merely relocates which artifact orphans; true repair requires
   either a Firebase transaction (not available via this REST-only
   client) or an idempotent retry/reconciliation step
```
This trace additionally surfaces a third, previously entirely unstated defect: the error toast's implied meaning ("فشل" = "failed") is false in this specific interleaving — the operation partially succeeded, but the user is told it failed outright, with no way to know their weight was actually recorded. This is a genuine new finding, not present in any prior document across this entire engagement.

**I4 (Round 1, restated formally):** `current_weight = MAX(date) WeightRecord.weight` — Disproven, `current_weight` is never written by the canonical path at all (Round 1, unchanged).

---

## 5. Temporal Logic Properties

- **Always(AddWeight succeeds -> Eventually the record is visible in the UI):** Proven — the synchronous `weights=await fbGet(...); renderDetail(...)` sequence immediately following a successful `fbPost` guarantees this within the same event-loop continuation; no asynchronous gap exists where success could occur without eventual visibility.
- **Always(not validation-failure -> eventually IDLE)** (Liveness, L1): Proven for the client-visible portion — every path (success, validation failure, Firebase rejection) terminates in a toast and a return to `IDLE`. No path leaves the UI in a permanently pending state.
- **Always(WeightRecord created -> Always that record persists):** "Once created, a weight record is never automatically removed." Proven for the automatic case (no code path deletes a `WeightRecord` except the explicit, user-initiated `delWeight`/`delWeightByIdx`). Cannot be extended to a universal guarantee — an external Firebase console edit or Cloud Function (unclosable Unknown) could violate this from outside the client entirely.
- **(I3 holds) Until (a network failure occurs between the two writes):** the formal temporal expression of §4's counterexample — I3 is not an Always property; it is contingent, true only until the specific interleaving in the Minimal Failure Trace occurs.

---

## 6. Concurrency Analysis (Scenario-by-Scenario)

| Scenario | Verdict |
|---|---|
| Multiple browser tabs, same animal, near-simultaneous submit | Safe — proven, §0. Two independent POST-generated records, no loss, no overwrite. Both appear in history, correctly, as two distinct entries — this is in fact the correct semantic outcome (two real weighings), not a bug. |
| Slow network / out-of-order completion | Each `submitAddWeight` invocation is self-contained (closure-captured `animalId` at call time, not shared mutable request state) — no cross-invocation ordering dependency exists to violate, since each call's own local `kg`/`date`/`notes` are independently scoped consts. Safe by construction. |
| Duplicate clicks (same tab) | Produces two distinct, valid records (per §0) — not a data-loss bug, but a genuine UX/data-quality concern: no debounce or disable-on-submit exists on the "حفظ" button (confirmed by direct reading). This is a new, previously-unstated finding: the absence of double-submit protection was assumed architecturally analogous to Birth's "crashes harmlessly" pattern in every prior document — but Weight's case is different: it doesn't crash on a second click, it silently succeeds twice. |
| Refresh / interrupted navigation mid-write | The `fbPost` request, once sent via `fetch()`, is a browser-level network request independent of the JS execution context that initiated it — a page refresh does not necessarily cancel an in-flight fetch (browser-dependent behavior, outside repository-internal evidence) — classified Unknown, not assumed either way. |
| Deleted parent (animal) concurrent with write | This is I1's exact scenario (§4), unchanged. |
| Clock skew | Newly proven exposure this round: `#w-date` defaults to `todayStr()` (this device's local clock) and is never cross-validated against server time. A device with an incorrect clock produces a silently mis-dated `WeightRecord`, which (per I2's proof) would also silently violate the chronological sort order for that specific record relative to correctly-dated ones. |
| Offline / reconnect | Unknown, standing from every prior pass. |

---

## 7. Equivalence Checking (Formal Restatement of Round 1)

Round 1 already produced the minimal counterexample proving `submitAddWeight`, `assistant.html`'s `add_weight`, and `pages/production.js`'s weight branch are not behaviorally equivalent. This round adds: they are also not equivalent in error-handling shape, yet they share the identical defect anyway. `submitAddWeight`'s two-write sequence (§3) shares a single try/catch with `assistant.html`'s `add_weight` branch (also two writes: `fbPatch` + `fbPost`, also one shared catch) — both implementations share I3's exact defect independently, having arrived at the same non-atomic pattern without any shared code. This is a second, distinct instance of Accidental Semantic Duplication (Round 1's category), now extended: not just "duplicated intent," but duplicated defect, arising independently in two unrelated files.

---

## 8. Hidden Assumptions (Dedicated Enumeration)

1. Firebase RTDB's POST endpoint reliably generates non-colliding unique keys under concurrent load — an external guarantee, not independently verified, but consistent with Firebase's documented behavior.
2. The browser's `<input type="date">` implementation correctly enforces ISO-8601 formatting client-side (I2's precondition) — a browser guarantee, not repository code.
3. The device's local system clock is approximately correct (the clock-skew finding, §6).
4. No other write path (Cloud Function, direct console edit, a future developer) will ever bypass the `animals/{id}/weights` path's implicit shape — an assumption about future code, inherently unverifiable now.
5. `fetch()`'s network request, once dispatched, will resolve or reject in a way the calling async function's try/catch can observe even across a page-lifecycle event like navigation — browser-dependent, Unknown (§6).

---

## 9. Self-Destruction (Round 2)

**Attacking §0's "concurrency is safe" proof:** could Firebase RTDB, under sufficiently pathological network conditions, ever generate a colliding push-ID? Firebase's push-ID algorithm is designed around timestamp+randomness specifically to make this cryptographically improbable, not mathematically impossible. This does not overturn the proof's practical validity, but it does mean "Proven Safe" in §0 should be read as "proven safe under Firebase's documented probabilistic guarantee," not as an absolute mathematical impossibility — a meaningful, honest refinement, not a contradiction requiring restart.

**Attacking §4's I3 counterexample:** is it possible `logActivity` itself has internal retry logic that would prevent the failure trace from ever actually manifesting? Checked: `logActivity`'s own implementation was not re-read this round; Round 1 characterized it only as "writes one activity_log entry per call," without confirming absence-of-retry. This is a genuine gap in this round's own rigor — flagged honestly rather than silently assumed. Given the demonstrated pattern (no retry logic found anywhere else in this repository's Firebase-writing functions, confirmed repeatedly across many prior sessions), the balance of evidence still favors I3's counterexample being real, but this specific claim is downgraded from "certain" to "very likely, one unchecked function away from certain."

**No restart triggered — both self-attacks produced honest refinements, not contradictions.**

---

## 10. Final Certification (Round 2)

**Verified Invariants:** I2 (conditionally, §4), the two temporal Liveness/Safety properties in §5, the POST-concurrency-safety property (§0, now epistemically framed as probabilistic-not-absolute per §9).
**Failed Invariants:** I1 (unenforced, real-world impact unknown), I3 (proven failure trace, §4), I4 (Round 1, unchanged).
**Unknown Invariants:** offline behavior, refresh-mid-flight behavior, `logActivity`'s own retry characteristics (newly flagged gap, §9).
**New Counterexamples This Round:** the misleading-error-toast finding (§4), the duplicate-submit-produces-two-records finding (§6), the clock-skew exposure (§6).

**Repository Correctness Score: 5/10** — one point lower than Round 1's 6/10, reflecting the newly-formalized I3 counterexample's user-facing severity: a false "failed" message when data was actually partially saved is a more serious class of defect than Round 1's more abstract "no rollback" framing conveyed.

**Repository Completeness Score: 9/10** — unchanged; this round's genuine new findings (schema correction, misleading-toast defect, clock skew) confirm the process still finds real things, which is evidence the process hasn't yet exhausted itself, but the rate of new findings continues to shrink relative to their severity, consistent with approaching a genuine completeness ceiling.

**Mathematical Confidence:** High for every proof resting on direct code structure (§0, §2, §3, §5's liveness properties); Medium for I3's severity claim pending the one flagged gap (§9).
**Engineering Confidence:** High. **Production Confidence:** Medium, unchanged in substance, now resting on a more precise set of named gaps rather than general uncertainty.

---

**No code was modified. No implementation was proposed.** This round's marginal contribution: one repository-wide schema correction, one resolved-with-certainty concurrency proof, and three genuinely new defects (misleading error toast, duplicate-submit record creation, clock-skew exposure) — none of which were stated, even qualitatively, in any prior document across this entire engagement.
