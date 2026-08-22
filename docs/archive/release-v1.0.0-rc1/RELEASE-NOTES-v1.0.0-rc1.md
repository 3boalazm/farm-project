# RELEASE-NOTES-v1.0.0-rc1.md

**First official Release Candidate.** Built on the certified engineering baseline (`baseline-v2-production-candidate`) plus six product sprints of decision-support intelligence and one dashboard consolidation sprint.

## What's In This Release

**Certified Foundation** (pre-existing, unchanged this cycle): Weight SSOT, Birth SSOT, 17-of-19-page permission enforcement, PIN-hashed authentication with a Firebase Auth fail-safe bridge, a growing regression suite, and a dependency-free static safety scanner.

**Sprint 1 -- Intelligent Task Automation:** a single centralized engine (`autoGenerateTask`) that creates deduplicated, traceable operational tasks from domain events (vaccination scheduling, expected births, medication follow-up).

**Sprint 2 -- Weight Intelligence:** per-animal weight-loss, no-growth, and missing-weight detection against each animal's own history, with automatic alert resolution on recovery.

**Sprint 3 -- Health Intelligence:** a 9-factor, decision-support-only risk score (0-100, Low/Medium/High/Critical) combining active illness, weight signals, vaccination status, medication frequency, and body condition -- every factor cites its evidence.

**Sprint 4 -- Production Intelligence:** per-animal milk/wool trend, drop detection against personal baseline, and recovery tracking -- deliberately scoped away from weight data to avoid double-counting Sprint 2's domain.

**Sprint 5 -- Unified Decision Engine:** pure composition over Sprints 1-4 into one explainable operational priority score. Proven, not assumed, to never double-count Weight's contribution (it already flows through Health Intelligence).

**Sprint 6 -- Executive Dashboard:** consolidated the accumulated per-sprint dashboard panels into one coherent hierarchy (Daily Briefing, Critical Alerts, Farm Status, Executive KPI Strip, Operational Priorities, Trends, Upcoming Tasks, Operational Timeline), removing one genuine duplication found during the sprint's own audit.

## Upgrade Notes
No data migration required -- every new collection (`daily_tasks`, `weight_alerts`, `production_alerts`) is additive; no existing collection's schema changed. Existing certified subsystems (Weight/Birth SSOT, permissions) are untouched by any of the six product sprints.

## Fixed This Release Cycle (Sprint 7)
- `CLAUDE.md` updated to document the five intelligence engines added across Sprints 1-6 (a genuine documentation gap -- the entry-point file had zero mention of them).
- `scripts/safety-scan.js` now correctly excludes the `release/` export directory from its own scan, preventing duplicate/confusing findings when a local export happens to be present.

## Known Limitations
See `docs/release/KNOWN-LIMITATIONS.md`.
