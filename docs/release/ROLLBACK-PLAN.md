# ROLLBACK-PLAN.md

## Restore Previous Version
`baseline-v2-production-candidate` (commit `8be77dd`, plus `6f96d2d`) is a tagged, known-good checkpoint. To roll back: `git revert` the offending commit(s) if the history is linear past this point, or redeploy from the tag directly (`git checkout baseline-v2-production-candidate`) if a clean revert isn't possible. Every commit in this project's disciplined history is meant to be independently revertible (`CLAUDE_CODE_GUIDE.md`'s own stated rule) — a rollback should not require reverting multiple entangled commits.

## Restore Data If Needed
**Honest gap, not glossed over:** no automated Firebase backup/restore mechanism exists (confirmed, `docs/architecture/SCALABILITY-REVIEW.md`). `sync-to-excel.js` is a manual export tool, not a restore path. If data-level rollback is ever needed, it currently depends entirely on Firebase's own project-level backup features (if enabled at the Firebase Console level) — this repository's own tooling provides no help here. This is the single most consequential gap this certification pass surfaces.

## Communicate Failure
No formal incident-communication process exists (expected and reasonable at this project's current scale — a small farm operation, not a large team). If a rollback happens, the practical step is: notify whoever is actively using the app (the farm staff) directly, since there's no status-page or automated-notification mechanism to do it for you.
