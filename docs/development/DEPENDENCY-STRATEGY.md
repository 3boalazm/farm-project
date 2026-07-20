# DEPENDENCY-STRATEGY.md

## Current Dependency Surface
The **shipped application has zero npm dependencies** — confirmed, `package.json` lists exactly one `devDependency`: `@playwright/test@^1.56.0`, used only for the test suite added this engagement, never loaded by any page a user visits.

## Outdated Packages
Not applicable in the traditional sense — there is exactly one dependency to track. `@playwright/test`'s own release cadence is fast (Playwright ships frequently); staying within a few minor versions of current is low-effort and low-risk, since it never touches production.

## Security Risks
**Effectively none from npm.** The application's real external-code surface is the handful of CDN-loaded libraries referenced directly in HTML (Bootstrap 5.3.3, per project documentation, plus whatever `farm-react.js`'s pre-bundled React build pulls in) — these are not managed by `package.json` at all, and this session did not audit their specific versions for known CVEs (out of this pass's scope; worth a dedicated, separate pass if not already done).

## Unnecessary Dependencies
None found. The one dependency that exists is directly justified by this engagement's own test infrastructure — not speculative tooling added "just in case."

## Upgrade Risk Assessment
**Low, deliberately.** Because the shipped app has no dependencies, there is no dependency-upgrade risk to production ever, structurally — a five-year-old version of this codebase will not suddenly break because some transitive dependency deprecated an API, the single most common cause of "this old project won't build anymore" in dependency-heavy projects.

## Recommendation
**Do not add dependencies speculatively.** The buildless architecture's biggest long-term strength is precisely this: nothing to upgrade, nothing to go stale. Any future dependency addition should clear a high bar — genuinely can't be done reasonably in vanilla JS — not be added for convenience. This recommendation is itself the strategy; there is no upgrade backlog to work through because there is almost nothing to upgrade.
