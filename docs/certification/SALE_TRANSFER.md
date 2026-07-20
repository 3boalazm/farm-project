# Certification: Sale & Transfer

**Status: CERTIFIED. Both closed under Repository 4's continuation (Priority 1, BL-01).**

## Sale
**Invariant:** a Sale is never a subtype of Death. `status:'sold'` is the sole canonical convention.
**Writers, converged:** `submitSold()`, `performBulkSell()`, `submitRemoveAnimal()`'s sale branch — all three emit `{status:'sold', sold_date, sold_price, sold_to}`.
**Prior defect (fixed):** the bulk path previously wrote `status:'dead', removal_reason:'sale'` — a data-model conflict with the individual path's own convention. Resolved by converging on the individual path's shape.

## Transfer
**Canonical implementation:** `barns.html`'s `submitTransfer()` — proven correct first; `animals.html`'s `performBulkTransfer()` was fixed to match it (BL-01), not the reverse.
**Invariant:** a completed transfer updates `animals.barn` to the real, user-selected value, via `commitBulkPatch()` for the bulk path.

## Root Cause Both Shared
Reading a modal's own form fields *after* `closeModal()` had already removed them from the DOM — the same root cause independently found and fixed in BL-01 (Transfer) and BL-02 (Death's bulk path), later found again in Wave E for `submitReset`/`_ddSubmit`. See `docs/certification/MODAL_LIFECYCLE.md`.

## Full History
`repo4-final-architecture-audit.md`, `domain-freeze-and-duplication-report.md` (original findings and Product Decision framing) → this project's Priority 1/BL-01 (implementation and live verification).
