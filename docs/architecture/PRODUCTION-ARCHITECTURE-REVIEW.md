# PRODUCTION-ARCHITECTURE-REVIEW.md

## Current Architecture

A vanilla, buildless, multi-page PWA (31 HTML pages, ~13 root-level JS modules, 12 delegated `pages/*.js` files) talking directly to Firebase RTDB over REST, with a client-only permission model and a custom PIN auth layer. As of `baseline-v2-production-candidate`: a 32-test Playwright regression suite, a dependency-free static safety scanner, and a GitHub Actions quality gate now sit on top of this, none of which existed before this engagement.

## Strengths (Evidence-Backed)

- **Zero build step, zero framework lock-in for the main app.** `package.json` has exactly one `devDependency` (`@playwright/test`). Five years from now, nothing here will be blocked by a dead bundler config or an abandoned framework major version — the entire application surface is plain HTML/CSS/JS, which ages far better than any specific framework choice would.
- **SSOT discipline is real and enforced, not aspirational.** `createOffspringAnimal()` (`shared.js:858`) and the Weight subsystem (`animal-detail.html:487-512`) are both certified single sources of truth with automated regression tests (`tests/ssot/`) now protecting them — a five-year-old codebase's biggest risk is usually silent SSOT erosion, and this is the one area actively defended against it.
- **A working, if young, safety net.** `scripts/safety-scan.js` catches the exact bug class (declared-but-unenforced permissions) that was this project's most serious, longest-standing real vulnerability, automatically, on every future change.

## Weaknesses (Evidence-Backed)

- **The permission model is fundamentally client-trusted.** `can()` (`firebase.js`) reads `localStorage['farm_user']` directly — confirmed exploitable via DevTools (see `docs/audit/THREAT-MODEL.md`, Spoofing section). This is not a bug to fix incrementally; it's a structural property of not using Firebase Auth, and five years of feature growth will keep building on top of this same trust boundary unless it's deliberately re-architected — which is explicitly out of this review's scope, but must be named as the single largest architectural constraint.
- **`fbGet()` has no pagination.** Confirmed (`firebase.js:339`) — every read fetches an entire collection. Fine at today's single-farm data volume; a real five-year risk as any one farm's `animals`/`finance`/`health` history accumulates (see `docs/architecture/SCALABILITY-REVIEW.md`).
- **Zero Firebase `.indexOn` rules exist** (`database.rules.json` — confirmed 0 occurrences of `indexOn`). Any `orderByChild`/`equalTo` query will degrade as collections grow, and Firebase will silently fall back to client-side filtering of the entire dataset.
- **No external error tracking.** 107 `try/catch` blocks and 14 `console.error` calls exist, but all of it is invisible once the browser DevTools console is closed — a production bug today has no way to surface itself to whoever maintains this system unless a user happens to report it.

## Future Constraints (What This Architecture Makes Hard, Not Impossible)

- **Multi-farm/multi-tenant growth** is not structurally supported today — `Farm` is not a first-class entity (confirmed still an open decision per project memory), and Firebase collections are flat, not farm-scoped. This is the single biggest constraint on the "100 farms, 1000 farms" scenarios in `SCALABILITY-REVIEW.md`.
- **Real server-side authorization** would require either adopting Firebase Auth properly or introducing a backend — either is a genuine architecture change, correctly out of this review's scope, but the cost of *not* eventually doing it compounds every year new features are added on the current trust model.

## Recommended Evolution Path (Sequenced, Not Prescriptive)

1. Keep the buildless approach — it is a genuine, proven strength, not technical debt.
2. Add Firebase `.indexOn` rules for the fields actually queried by `orderByChild` (a safe, additive change — see `SCALABILITY-REVIEW.md` for specifics).
3. Introduce pagination/limit support in `fbGet()` as an opt-in parameter (backward-compatible, non-breaking) before any single collection becomes large enough to matter.
4. Treat the client-trust permission model as a named, accepted risk (already true) and revisit only as part of a deliberate, separately-scoped security initiative — not incrementally.
5. Add lightweight, free-tier error tracking (see `docs/reliability/OBSERVABILITY-PLAN.md`) before the next major feature push, not after the first unreproducible production bug report.
