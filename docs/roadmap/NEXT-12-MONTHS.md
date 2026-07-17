# NEXT-12-MONTHS.md

**Prioritized by Impact × Risk Reduction, not by what's most interesting to build.**

## Immediate (0-30 Days)
1. **Add free-tier error tracking.** Highest value-to-effort ratio identified this phase — see `docs/reliability/OBSERVABILITY-PLAN.md`. Turns "unknown production bugs" into "visible production bugs."
2. **Resolve `bayan.html`'s permission-enforcement status.** Confirm its actual init pattern (unconfirmed this session, see `docs/audit/PERMISSION-MATRIX.md`) and add the same guard the other 10 pages received, if warranted.
3. **Decide `activity.html`'s fate** — either rebuild it as real feature work, or formally remove the dead nav link. Currently a broken, user-visible navigation target; either resolution is better than the current silent gap.

## Short Term (1-3 Months)
4. **Consolidate `dashboard.html`'s 3 separate `animals` fetches** into one, cached read — a small, low-risk cleanup with real (if modest) performance benefit.
5. **Add a dev/staging Firebase environment.** Currently zero environment separation exists — the single highest-value operational-risk reduction that doesn't touch production code at all.
6. **Institutionalize the Playwright suite in real developer workflow** — pre-commit or pre-push hook running `npm run scan` at minimum, so the safety net built this phase doesn't silently go stale from disuse.

## Medium Term (3-6 Months)
7. **Migrate the weather API key to a server-side proxy**, mirroring the existing `api/claude.js` pattern — cheap once scoped as its own task, currently correctly deferred.
8. **Make a deliberate, evidence-based decision on Service Worker activation** — either commit to finishing and activating it, or formally retire the dormant code. The current "built but never wired up" state is the worst of both options long-term.
9. **Add `orderByChild`/pagination support to `fbGet()`** as an opt-in, backward-compatible enhancement — before any single collection's growth makes it urgent, not after.

## Long Term (6-12 Months)
10. **Make the "Farm as a first-class entity" decision.** Not urgent at today's single-farm scale — but per `docs/architecture/SCALABILITY-REVIEW.md`, this is the actual blocker for any real multi-farm ambition, and the cost of deciding late compounds. This is a decision to make deliberately, not a task to execute speculatively.
11. **Revisit the client-trusted permission model** as its own dedicated security initiative, if and when the user base grows to include lower-trust roles (external parties, not just farm staff) — the single largest structural constraint identified in `docs/architecture/PRODUCTION-ARCHITECTURE-REVIEW.md`, correctly not something to change reactively or incrementally.

## What's Deliberately Not On This Roadmap
Speculative multi-tenancy implementation, a rewrite of the permission model, or adopting a framework — all would be solving problems this system does not yet evidence having, at real cost to the buildless architecture's proven strengths.
