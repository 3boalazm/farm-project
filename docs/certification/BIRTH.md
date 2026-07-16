# Certification: Birth Subsystem

**Status: CERTIFIED WITH DEFERRED ITEM. Three of four entry points converged onto a shared canonical helper; the fourth is a known, bounded, deliberately-deferred exception.**

## Canonical Model
A birth event = one `breeding` record + one `animals` document per offspring (via `createOffspringAnimal()`), plus a weight-history entry when weight is provided.

## Entry Points

| Entry Point | Breeding Record | Uses `createOffspringAnimal()` | Weight History | Status |
|---|---|---|---|---|
| `_ubSubmit()` (Unified Birth modal) | ✅ | ✅ | ✅ | Canonical reference implementation |
| `submitBreeding()` (markBorn) | ✅ | ✅ (duplicate-safe — only fires on genuine transition into `born`) | ✅ | Converged, D-02 |
| AI `add_birth` | ✅ | ✅ | ✅ | Converged, D-03 |
| `submitBirthDirect()` | ✅ (pre-existing) | ❌ — independent `fbPost('animals',...)` | ❌ | **Deferred — do not "fix" without a new decision record** |

## Genealogy
Confirmed working for all four entry points — `pedigree.js` depends only on `mother_tag`/`father_tag` on real animal documents, which every path (including `submitBirthDirect`) sets correctly.

## Duplicate-Prevention Design
`submitBreeding()`'s animal-creation only fires on a genuine transition into `status='born'` — checked against the pre-edit in-memory record. Editing an already-`born` record (e.g., fixing a typo) never re-creates animals. Live-proven via real create-then-edit sequences, not source-reading alone.

## Failure Behavior
All three converged paths are "Best Effort" — no transaction available via this REST-only client. A mid-loop failure leaves the `breeding` record and any already-created animals in place; nothing rolls back. This matches the pre-existing, already-documented pattern from the original Birth Failure Analysis, not a new defect introduced by convergence.

## Deferred Items (Repository-Evidence-Backed, Not Speculative)
- `submitBirthDirect()`'s convergence onto `createOffspringAnimal()` — no decision record authorizes this yet.
- AI `add_birth`'s `father_tag`/`tag` support — explicitly deferred by D-03; the AI's own payload schema has no source for either field.
- Historical `markBorn` and AI-birth records created before convergence remain animal-less/incomplete by design (D-02/D-03's approved strategy: perfect reconstruction is impossible, so none was attempted).

## Full History
Wave B (2 commits) + D-02/D-03 decision records + `birth-canonical-specification.md`, `birth-failure-analysis.md`, `birth-reliability-audit.md` (the pre-Wave-B investigation this convergence was built on).
