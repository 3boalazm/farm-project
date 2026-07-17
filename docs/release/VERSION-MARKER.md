# VERSION-MARKER.md

```
Repository:  farm-bayan (بيان المزرعة)
Version:     v1.0.0-rc1
Commit:      d19aa06 (chore(release): prepare v1.0.0-rc1)
Tag:         v1.0.0-rc1
Date:        2026-07-17
Status:      Release Candidate
```

## What This Checkpoint Represents
The first official Release Candidate, per `docs/release/VERSION-CERTIFICATION-v1.0.0-rc1.md`. Built on the certified engineering baseline (`baseline-v2-production-candidate`) plus six product sprints (Task Automation, Weight/Health/Production Intelligence, the Unified Decision Engine, and the Executive Dashboard consolidation) and this release-hardening cycle (Sprint 7).

## Predecessor Chain
`e655e2b` (Engineering Baseline Merge) -> `4b1e8cf`/`8be77dd` (Baseline Hardening, tagged `baseline-v2-production-candidate`) -> `33e42e3`...`aa04674` (Sprints 1-6) -> this release-hardening commit -> `v1.0.0-rc1`.

## Known Items Carried Forward Honestly
See `docs/release/KNOWN-LIMITATIONS.md` for the complete, current list -- client-trusted permissions, no automated Firebase backup, `fbGet()` pagination, and a handful of smaller, explicitly-deferred items. None are release blockers for this application's current deployment context.

## Status Going Forward
This tag is the safe rollback point for any future work. `docs/release/ROLLBACK-PLAN.md` (from the original certification) remains the correct mechanism -- unchanged by six sprints of purely additive functionality.
