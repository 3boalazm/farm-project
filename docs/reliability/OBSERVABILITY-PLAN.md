# OBSERVABILITY-PLAN.md

## Current State
107 `try/catch` blocks and 14 `console.error` calls exist across the codebase (confirmed count, this session) — genuine, real error handling exists at the code level. `logActivity()` (`shared.js`/`firebase.js`) writes a real, persistent audit trail for business actions. **None of this is visible outside a developer's own open DevTools console.** There is no external error tracking, no aggregated logging, no alerting.

## Can Production Problems Be Diagnosed Today?
**Only reactively, and only if a user happens to describe the problem accurately enough to reproduce.** If a write silently fails for a user (network blip, malformed data, a bug), the only trace is whatever `console.error` logged to a console nobody is watching. This is the single biggest observability gap: the app *has* error handling, but that handling terminates at "don't crash," not "surface this to someone who can fix it."

## Recommendations, Prioritized by Cost-to-Value

1. **Free-tier error tracking (e.g., a Sentry-class tool's free plan)** — lowest effort, highest immediate value. A single script tag plus wrapping the existing `console.error` call sites (not rewriting them) would surface every one of the 14 existing error-logging points to an actual dashboard. This is additive, non-breaking, and does not touch business logic.
2. **Make `logActivity()`'s viewer status unambiguous.** `activity.html` is a confirmed 0-byte file (this engagement's own finding) — the audit trail is being *written* but has no working *viewer*. This is arguably a bigger near-term observability win than external error tracking, since the data already exists.
3. **A lightweight, periodic "is the app reachable" check** (even a simple uptime-monitor pinging the deployed URL) would catch total outages faster than waiting for a user report.

## What NOT to Do (Explicitly, Per This Phase's Own Constraints)
Do not introduce a heavy, self-hosted logging stack (ELK, etc.) — wildly disproportionate to this app's actual scale and would violate "no unnecessary dependencies." A free-tier SaaS error tracker is the correctly-scoped answer, not enterprise observability infrastructure for a single-farm app.

## Not Executed This Pass
No error-tracking script was actually added in this audit — "add monitoring hooks" was permitted by this phase's rules, but doing so responsibly requires choosing a specific provider and obtaining an API key/DSN, which is a decision for the repository owner, not something to pick unilaterally during a read-mostly audit.
