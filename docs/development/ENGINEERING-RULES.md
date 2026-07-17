# ENGINEERING-RULES.md

**Every future feature, without exception, must satisfy all of the following before merge.**

## 1. Must Not Violate SSOT
No new feature may write animal-creation data outside `createOffspringAnimal()`, weight data outside `animals/{id}/weights`, or otherwise duplicate a fact already owned by an existing collection. If a new field seems to duplicate existing information, check `docs/architecture/` (from the certified baseline) before writing it — this is not a suggestion, it's the rule that produced every certified subsystem this project has.

## 2. Must Pass the Regression Suite
`npx playwright test` must pass in full before merge, not just the tests judged "related" to the change. `node scripts/safety-scan.js` must report 0 CRITICAL findings. Both are enforced by `.github/workflows/quality.yml` — a red CI check is a hard stop, not a judgment call.

## 3. Must Update Documentation in the Same Change
If a feature changes `nav.js`, `docs/audit/PERMISSION-MATRIX.md` must be updated in the same PR. If it changes a certified subsystem, the relevant `docs/certification/` file must be updated in the same PR. Documentation drift is treated as a bug, not a follow-up task.

## 4. Must Preserve the Permission Model
Every new page requiring restricted access must have both a `perm:` declaration in `nav.js` AND a runtime `can()` check — the exact gap this project's own history found and fixed at real cost. `scripts/safety-scan.js` enforces this automatically; a feature that makes the scanner fail cannot merge.

## 5. Must Include Tests for New Write Paths
Any new Firebase write path needs a corresponding test under `tests/` — following the existing `tests/ssot/`, `tests/data-integrity/`, or `tests/permissions/` pattern, whichever fits. A feature with zero test coverage is not "done," regardless of how well it demos.

## 6. Must Be One Atomic Change
One feature, one reviewable diff, one commit message that explains what changed and why — the discipline already proven across this project's own history (`CLAUDE_CODE_GUIDE.md`'s "one atomic task" rule), carried forward unchanged into product development.

## 7. Must Not Introduce Unnecessary Dependencies
The application itself remains zero-runtime-dependency by design (`docs/development/DEPENDENCY-STRATEGY.md`). A new feature reaching for an npm package should first ask whether it's genuinely infeasible in vanilla JS — the buildless architecture is a proven strength, not an accident to quietly erode.

## 8. Must Not Silently Expand the Trust Model
Any feature that touches authentication, roles, or `localStorage['farm_user']` handling must explicitly flag the change for review against `docs/architecture/PRODUCTION-ARCHITECTURE-REVIEW.md`'s named client-trust constraint — this is the single most sensitive boundary in the system, and it does not get incrementally reshaped by accident.

## 9. Must Preserve Rollback Safety
Every commit must be independently revertible via a single `git revert`, per the project's own long-standing rule. A feature split across multiple entangled commits that can't be cleanly reverted individually is not acceptable, regardless of feature quality.

## 10. Evidence Over Assertion
"I tested it and it works" is not evidence. "I ran X, observed Y" is. This applies to feature PRs exactly as it applied to every certification pass this baseline was built on.
