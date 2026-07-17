# SCALABILITY-REVIEW.md

## At 10 Farms
**Verdict: Survives easily, with caveats.** If each farm is a separate Firebase project (the only way the current flat, non-farm-scoped data structure could support multiple farms without data bleeding between them), 10 independent deployments of the current architecture would each perform exactly as well as the single farm does today. The real cost is operational (10 separate Firebase projects, 10 separate deployments to manage), not architectural.

## At 100 Farms
**Verdict: Survives, but the operational cost becomes the dominant problem.** Managing 100 separate Firebase projects/deployments by hand is not sustainable — this is where the deferred "Farm as a first-class entity" decision (per project memory) stops being a nice-to-have and becomes the actual blocker. Multi-tenancy within a single Firebase project would require: farm-scoped collection paths (e.g., `farms/{farmId}/animals` instead of flat `animals`), farm-aware `database.rules.json` (currently `.read:true,.write:true` globally — confirmed, would need per-farm scoping), and a farm-selection step in the auth flow. None of this exists today; all of it is a genuine architecture project, correctly out of this review's scope to execute, but this is the point at which it becomes necessary rather than optional.

## At 1000 Farms
**Verdict: Current architecture does not survive without the multi-tenancy work above, full stop.** At this scale, the missing `.indexOn` rules and full-collection-fetch pattern in `fbGet()` (both already flagged as forward-looking risks even at single-farm scale) would compound with per-farm data volume into real, severe performance problems — every dashboard load would be fetching and filtering unindexed data client-side.

## Indexes — Concrete, Evidence-Based Recommendation (Not Executed This Pass)
Fields actually used in `orderByChild`-style filtering, if any exist, should get `.indexOn` entries first. **Confirmed this session: no `orderByChild` calls were found anywhere in the codebase** — the app currently fetches full collections and filters/sorts client-side in JavaScript, not via Firebase query operators. This actually changes the recommendation: the missing indexes are not yet causing a *query performance* problem (since no indexed queries are made), but the full-collection-fetch pattern itself is the real bottleneck at scale — indexes alone would not fix it without also adopting `orderByChild`/`limitToFirst` query patterns in `fbGet()` callers, which is a genuine code change, not a rules-file change.

## Backups / Exports
**No automated backup mechanism found.** `sync-to-excel.js` is a manual, DevTools-console export utility (confirmed, this engagement's earlier Phase 6/7 work) — not a scheduled backup. At any farm count, this remains a real, standing risk: total data loss from a Firebase-side incident has no automated recovery path today. This is independent of farm count — it's already a risk at 1 farm, just as much as at 1000.

## Can Current Architecture Survive?
**Yes at today's scale (1 farm). Yes, operationally strained, at 10. No, without dedicated multi-tenancy work, at 100+.** This is not a criticism of the current build — it was correctly built for its actual, current use case (one working farm), not speculatively over-engineered for a scale that was never evidenced as needed. The recommendation is to treat multi-farm support as its own future initiative when/if the need is real, not to build it preemptively now.
