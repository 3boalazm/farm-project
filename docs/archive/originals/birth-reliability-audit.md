# Repository 5 — Birth Reliability Audit

## Step 1 — Evidence

**Repository-wide search, exact terms requested:**

| Term | Result |
|---|---|
| `cleanup` | Only in `pages/tour.js` (an onboarding-tour feature, unrelated to data operations) |
| `undo` | **Real hits in `shared.js`/`firebase.js` — a genuine, fully-built undo system exists.** Investigated fully below. |
| `rollback` | Zero matches, anywhere |
| `revert` | Zero matches, anywhere |
| `transaction` | Zero matches, anywhere |
| `.batch(` | Zero matches, anywhere |
| `compensat` | Zero matches, anywhere |
| `fbDelete` near Birth's collections | Two matches, both confirmed to be **manual, user-triggered deletes** (`delBreeding()` in `pages/breeding.js`, `deleteWeight()` in `pages/animal_detail.js`) — not automatic compensation for a failed write sequence |

**The undo system, fully investigated — a critical, precise finding:** `firebase.js` contains a complete, working `undoLast()` mechanism — a `sessionStorage`-backed stack (`_UNDO_MAX=5`), a visible UI button that shows the pending-undo count, and correct reversal logic for `post`/`patch`/`delete` operations. **However, a full repository-wide search for `_pushUndo(` — the only function that adds anything to this stack — found exactly one match: its own definition.** It is never called from `fbPost`, `fbPatch`, `fbDelete`, `_ubSubmit()`, or anywhere else in the entire codebase. **The undo stack is permanently, structurally empty. The visible undo button will always report "no operations to undo," for Birth or any other event.** This is not a partial rollback capability for Birth specifically — it is unused, disconnected infrastructure project-wide, discovered via the exact search this phase demanded.

---

## Step 2 — Runtime Timeline (live-executed this pass and the prior pass, consolidated)

```
t=0    User submits Unified Birth modal (fields already read, synchronously, before this point)
t=0    closeModal() — modal and its DOM fields are gone
t=0    "جاري الحفظ..." toast shown
t=0+ε  await fbPost('breeding', {...})        — breeding record created
t=1+ε  await fbPost('animals', {...})  #1      — animal #1 created
t=1+ε  await fbPost('weight_log', {...}) #1    — weight #1 created (if weight given)
t=2+ε  await fbPost('animals', {...})  #2      — animal #2 created (or FAILS here, live-tested)
t=2+ε  await fbPost('weight_log', {...}) #2
   ... repeated for qty ...
t=N    await logActivity(...)
t=N    Success toast
t=N+1200ms   location.reload() — CONFIRMED this pass, on pages where neither
             loadPageData() nor renderBreedingPage() exist (e.g., dashboard.html).
             Attempted to override this for testing purposes; the override did
             not prevent the navigation — confirmed via a real 'framenavigated'
             event firing exactly on schedule. This is a genuine, hard page
             reload, not a soft UI refresh.
```

---

## Step 3 — Failure Matrix

| Failure Point | Survives | Lost | Inconsistent? |
|---|---|---|---|
| After breeding written, before animal #1 | `breeding` record, `offspring_count` correct-looking but zero animals exist yet | Everything after | **Yes** — a `breeding` record with `status='born'` and a claimed count, zero linked animals |
| After animal #1 written | Breeding + animal #1 | Animal #2..N, all weight_log, activity log | **Yes** |
| **After animal #2 written (live-tested this pass, repeated from prior pass for consolidation)** | Breeding, animal #1, animal #2, weight_log #1, weight_log #2 (if weights given) | Remaining animals/weight_log, activity log | **Yes — directly observed live** |
| After the final weight_log written, before activity log | Everything data-wise is complete and correct | Only the audit-trail entry | **Arguably no**, business data is fully correct |

---

## Step 4 — Consistency Matrix (specific fields, per Phase 5's request)

| Field | State after a mid-loop failure (e.g., animal #2 of 3) |
|---|---|
| `animals` count | 2 real records exist (of the 3 implied) |
| `breeding.offspring_count` | 3 (unconditionally set before the loop even begins) — **permanently disagrees with the real count** |
| Weight history (`weight_log`) | Correctly reflects only the animals actually created — internally consistent with itself, just incomplete relative to the intended total |
| Activity log | Absent entirely for this event |
| `current_weight` | Not set by this event for any animal, successful or not (a separate, already-documented characteristic, not new to this failure scenario) |
| `birth_weight` | Correctly set on whichever animals were actually created |

**Does the database reach an impossible state?** Not "impossible" in the sense of violating a hard schema constraint (Firebase RTDB enforces none) — but **impossible relative to the domain's own stated meaning**: a `breeding` record asserting 3 offspring with only 2 traceable animals is a state no correct birth event should ever produce, and nothing in the schema prevents or flags it.

---

## Step 5 — Rollback Matrix

| Mechanism Searched For | Exists? | Applies to Birth? |
|---|---|---|
| Explicit rollback/revert/transaction/batch | No — zero matches, repository-wide | N/A |
| Generic undo system (`undoLast`) | Yes, fully built | **No — confirmed disconnected, `_pushUndo` never called by anything, including `_ubSubmit`** |
| Manual delete functions | Yes (`delBreeding`, `deleteWeight`) | Only as a manual, human-operated cleanup tool — not automatic, not triggered by Birth's own failure path |

**Conclusion, directly proven: no rollback of any kind — automatic or semi-automatic — currently protects the Birth event.**

---

## Step 6 — Idempotency Matrix

| Scenario | Live-Tested? | Result |
|---|---|---|
| Near-simultaneous double-invocation | **Yes, this pass and the prior pass** | Exactly one complete write set produced. The second invocation crashes with an unhandled promise rejection (`Cannot read properties of null`) because the first invocation's `closeModal()` already removed the shared DOM fields before the second invocation's synchronous prefix runs. **This is an accidental side effect of DOM-removal timing, not a designed safeguard.** |
| Separated-in-time double-submission (open→submit→wait for completion→open again→submit again) | **Attempted this pass; not cleanly completed.** Discovered, in the process, that a successful submission schedules a genuine `location.reload()` (Step 2) which could not be suppressed in the test harness, wiping test instrumentation before results could be read | **Reasoned with high confidence, not directly proven**: since no deduplication check of any kind exists anywhere in the write path (confirmed by the same repository-wide search in Step 1), two genuinely separate, sequential submissions have no mechanism preventing both from succeeding fully and independently. Marked explicitly as reasoned-not-executed, per Rule #2's own standard, rather than overstating this as directly proven |

---

## Step 7 — Architectural Contract (Birth, formalized)

- **Required writes:** `breeding` (1), `animals` (1 per offspring)
- **Optional writes:** `weight_log` (1 per offspring, if weight given)
- **Write ordering:** breeding → animals+weight_log (interleaved per offspring) → activity log
- **Required invariants:** every invariant listed in the prior specification (Section 5), restated as still valid
- **Forbidden states:** `breeding.offspring_count` disagreeing with the real linked-animal count (**currently reachable, per Step 3 — a forbidden state the current implementation does not prevent**)
- **Recovery expectations (current, not aspirational):** none automatic; manual reconciliation only, and only if an operator happens to notice
- **Failure expectations:** an error toast is shown, but **carries no information about what was already permanently written** before the failure
- **Consistency guarantees:** none beyond "each individual write, if it happens, is well-formed" — no guarantee about the *set* of writes as a whole
- **Idempotency guarantees:** none by design; one specific timing scenario is accidentally safe (Step 6)
- **Atomicity guarantees:** none
- **Rollback guarantees:** none — confirmed by exhaustive, targeted repository search (Step 1), including ruling out the one plausible-looking candidate mechanism (`undoLast`)

---

## Step 8 — Risk Assessment

| Dimension | Score | Justification |
|---|---|---|
| Consistency | 4/10 | Correct on the full happy path; proven broken on partial failure with no detection |
| Reliability | 4/10 | Works every time nothing goes wrong; live-proven to degrade ungracefully the moment something does |
| Recoverability | 2/10 | No automatic path; manual recovery requires an operator to first notice a discrepancy nothing surfaces |
| Observability | 2/10 | The error toast that does appear gives no indication of what was already committed — confirmed live, this pass and the prior pass |
| Maintainability | 3/10 | Four independent Birth implementations exist project-wide (per the Entry Point Census); this audit covers only the canonical one in this depth |
| Atomicity | 1/10 | Confirmed, repeatedly, zero atomicity of any kind |

---

## Step 9 — Final Verdict

**Formal classification: Best Effort.**

This is unchanged from the prior report's conclusion — reality did not contradict it, and it is restated here with additional, stronger evidence (the repository-wide rollback search, the disconnected undo-system discovery, and the confirmed `location.reload()` side effect) rather than defended reflexively. One prior conclusion *was* refined, not contradicted: the earlier specification's assumption that double-submission would produce straightforward "full duplication" is now known, from direct live testing, to be more nuanced — true only for genuinely separated submissions (reasoned, not directly proven this pass), and **not** true for near-simultaneous double-invocation, which instead fails safely by accident.

**No code was modified. No fixes were applied. No refactoring was proposed. Stopping here, per instructions. Not continuing to another business event.**
