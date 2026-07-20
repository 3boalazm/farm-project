# Working Contract

**This governs every future engineering task on this repository, regardless of which thread it touches.**

## The Proven Rhythm (Do Not Deviate)

One atomic task → one reversible commit → live runtime verification → completion report → **stop**. This exact discipline produced every certified subsystem in this repository (see `docs/certification/`) and every artifact consolidated into this documentation set independently converged on it. It is not a suggestion.

## Rules

1. **Never duplicate business logic.** Extract, reuse, converge — never reimplement something a canonical helper already does (`createOffspringAnimal()`, `commitBulkPatch()`, `renderFarmModal()`, etc.).
2. **Never introduce a second source of truth.** If you're about to store the same fact in two places, stop and check `docs/architecture/SSOT.md`.
3. **Every new write needs one canonical owner** before it's written, not decided retroactively.
4. **Smallest possible diff.** One logical problem, one commit.
5. **Repository evidence overrides assumptions**, including this documentation's own claims where they haven't been personally re-verified this session — re-check live code before trusting a written summary for anything load-bearing.
6. **No speculative cleanup, no opportunistic refactoring, no renaming for prettiness.** Behavior preservation is mandatory unless the task explicitly authorizes a change.
7. **Every architectural deviation requires evidence**, cited exactly (file + function + reason).

## Verification Requirements

- Real runtime execution (Playwright or equivalent) for every affected path, including at least one edge case and one failure path.
- Source-reading alone is never sufficient for a "Verified" status — this project has repeatedly found code that compiles cleanly but is structurally unreachable, or reads a variable that resolves to something other than what its name implies.
- Every commit independently revertible via a single `git revert` — no commit may depend on a later one to be safely reversible.

## Mandatory STOP Conditions

Stop immediately, without silently continuing, if:
- A second source of truth appears.
- A duplicate implementation appears.
- Repository evidence contradicts this documentation.
- Blast radius expands beyond the current task's stated scope.
- Implementation requires a product decision not yet recorded in `docs/decisions/`.

## Before Touching a Certified Subsystem

Read its full certification document in `docs/certification/` first. These were reached through multiple adversarial verification rounds, including real self-corrections along the way (documented, not hidden). Do not "improve" them without new evidence that specifically contradicts the certification.

## Before Touching the Design System or SW/Sync Threads

Confirm current live-repo state directly — do not assume the proposed documents in `docs/design/` or the SW/Sync findings describe what's actually deployed. See `docs/repository/REPOSITORY_CHARTER.md`'s explicit warning on this.
