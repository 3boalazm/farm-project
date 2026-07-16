# Certification: Modal Lifecycle

**Status: CERTIFIED. Repository-wide exhaustive audit performed (Wave E), 55 candidate functions discovered and classified.**

## The Invariant
**Every modal-driven write must read its own form fields before calling `closeModal()`.** Once a modal closes, its DOM elements are removed; reading them afterward returns `null`/`undefined` silently in most cases, or throws in others.

## Confirmed Instances of This Bug Class (All Fixed)
1. `performBulkTransfer()` (BL-01)
2. `performBulkDeath()` (BL-02)
3. `submitBirthDirect()` (BL-03)
4. `animals.html`'s `submitReset()` — reset-tool checkboxes (`reset-dead`/`reset-births`) always read as unchecked regardless of user selection; both admin tools were completely non-functional. Found and fixed during Wave E's exhaustive audit.
5. `dashboard.html`'s `_ddSubmit()` — `died_at` read after close, threw an uncaught exception, silently producing zero writes despite the death form appearing to submit.

## Audit Method
Automated discovery (every `window.X` function containing both `closeModal()` and a DOM read) found 55 candidates; each was manually verified against false positives (opener functions reading in-memory state, not stale DOM; display-only modals with no write). Full false-positive analysis preserved in the original Wave E report.

## Residual, Explicitly Acknowledged Risk
The discovery method's own blind spot: it cannot find a submit function that calls `closeModal()` indirectly through another function, or one not assigned via `window.X =`. Classified as an open, low-probability risk, not silently assumed closed.

## Full History
Wave E (`Sprint 1 — RIB Execution` series) — exhaustive modal audit and the two commits above.
