# CONTRIBUTING.md

## Branch Naming
`feature/<short-description>`, `fix/<short-description>`, `docs/<short-description>` — mirrors the commit-type convention below. Branch from `main`, always.

## Commit Convention
Conventional-commit style, matching what this baseline itself already established: `feat: ...`, `fix: ...`, `docs: ...`, `test: ...`, `chore: ...`. Body explains *why*, not just *what* — see `8be77dd`'s own commit message for the standard this project holds itself to.

## Pull Request Checklist
- [ ] Follows every rule in `docs/development/ENGINEERING-RULES.md`
- [ ] `npx playwright test` passes locally
- [ ] `node scripts/safety-scan.js` reports 0 CRITICAL
- [ ] Documentation updated in the same PR if `nav.js`, a certified subsystem, or the permission model changed
- [ ] One atomic change — if the diff touches two unrelated things, it's two PRs

## Review Checklist
- [ ] Confirm the PR's own checklist claims are true, don't just trust them — re-run CI, don't rely on the author's local run
- [ ] Check for a new SSOT violation specifically (the highest-cost mistake this project's history has repeatedly found)
- [ ] Check for a new declared-but-unenforced permission specifically (the second-highest-cost mistake)
- [ ] Confirm the commit is independently revertible

## Release Flow
See `docs/release/RELEASE-PROCESS.md` — unchanged by this phase, reused directly.

## Semantic Versioning
`MAJOR.MINOR.PATCH` in `package.json`. MAJOR: a breaking data-model or permission-model change (should be rare, per Rule 8). MINOR: a new feature (most roadmap items). PATCH: a bug fix or documentation-only change. Given this application has no external API consumers today, semver's practical audience is internal (the team itself, tracking what shipped when) rather than external compatibility guarantees — don't over-formalize it beyond that real purpose.
