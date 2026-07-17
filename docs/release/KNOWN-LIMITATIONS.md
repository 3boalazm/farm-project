# KNOWN-LIMITATIONS.md — v1.0.0-rc1

**Every item below is a genuine, evidence-backed, carried-forward limitation -- none are new to this release cycle unless stated.**

## Structural (Pre-Existing, Accepted)
- **Client-trusted permission model.** `can()` reads `localStorage` directly; there is no server-side authorization layer. This is the single largest architectural constraint in the codebase, by design (custom PIN auth, not Firebase Auth). Documented extensively in `docs/architecture/PRODUCTION-ARCHITECTURE-REVIEW.md`.
- **No automated Firebase backup mechanism.** `sync-to-excel.js` is a manual, DevTools-console export tool, not a scheduled backup. Named as the most consequential open item at the original engineering certification; still open.
- **Service Worker is built but deliberately inactive.** `sw.js`/`sw-register.js` are complete and correct but never registered -- a formal, documented decision, not an oversight.
- **`bayan.html` and `activity.html`** remain outside the page-level permission-enforcement pass (the former has an unconfirmed init pattern; the latter is a confirmed pre-existing 0-byte file).

## New This Release Cycle (Sprints 1-6)
- **`fbGet()` has no pagination.** Every read fetches an entire collection. Harmless at current data volume; a real constraint if any single farm's history grows substantially over years (see `docs/architecture/SCALABILITY-REVIEW.md`).
- **No compound cross-engine recommendations yet.** The Unified Decision Engine composes Health/Production/Task signals into one score, but does not yet generate a single narrative recommendation combining multiple engines' specific findings (e.g., "declining producer with an active weight-loss alert") -- each engine's evidence is listed separately, not synthesized into one sentence. Noted as a natural next step in `docs/features/UNIFIED-DECISION-ENGINE.md`.
- **Ranking loops (dashboard "highest priority" lists) iterate over candidate animals sequentially**, not in parallel, and are only bounded by how many animals currently show a real signal (not the full herd) -- acceptable at current scale, worth revisiting if a farm's active-issue count grows into the hundreds.
- **`media/logo.png` is 1.5MB**, unusually large for a web logo. Not fixed this cycle (image optimization was judged speculative cleanup, outside this release-hardening sprint's narrow mandate) -- flagged for a future, dedicated pass.

## Testing
No automated tests exist for genuinely offline browser scenarios (network loss mid-write, browser restart with pending IndexedDB writes) -- these require live browser observation this sandboxed environment cannot provide, a limitation stated as far back as the original certification and still true.

## Recommendation
None of the above are release blockers for the current single-farm, staff-operated deployment context this application was built for. Each is either a deliberate, reasoned tradeoff or a genuinely low-current-impact item with a clear, already-documented path forward.
