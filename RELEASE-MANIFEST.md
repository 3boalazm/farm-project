# RELEASE-MANIFEST.md

```
Version:              v1.0.0-rc1
Commit:                33aaa72e91895bee6f81dac1d2eaef28b586eda6
Tag:                   v1.0.0-rc1
Date:                  2026-07-17
```

## Verified Counts (Playwright's own --list, not a text-pattern estimate)
```
Test files:            13
Total tests:           81 (all passing, verified live this session)
```

## Documentation
```
Markdown files in docs/:   153
Feature-specific docs:     18 (docs/features/)
Release docs (this cycle): 4 new (docs/release/) + 4 new (docs/deployment/) + 2 root-level (PROJECT-STRUCTURE.md, ARCHITECTURE-REFERENCE.md) + 2 new (DEPENDENCY-MAP.md, this manifest)
```

## Feature Count
```
User-facing HTML pages:        31
Delegated page-logic modules:  12 (pages/*.js)
Intelligence/automation engines: 5 (shared.js -- Automation, Weight,
                                  Health, Production, Unified Decision)
Product Epics delivered (Sprints 1-6): 6
```

## Known Limitations
Full detail in `docs/release/KNOWN-LIMITATIONS.md`. Summary: client-trusted permission model (structural, accepted), no automated Firebase backup, `fbGet()` has no pagination, Chart.js referenced at two different CDN paths (found during this handoff's own dependency audit), `media/logo.png` is larger than typical for a web logo. None are release blockers for this application's current single-farm deployment context.

## Production Readiness
**GO**, per `docs/release/VERSION-CERTIFICATION-v1.0.0-rc1.md` -- overall score 84/100. 0 CRITICAL findings from the static safety scanner (1 REVIEW: an expected, legitimate finding). 81/81 tests passing, verified live immediately before this manifest was written, not carried forward from memory.

## What Makes This Package Complete
Every file in this export is present because `git archive` at the `v1.0.0-rc1` tag produced it directly -- there is no manual file-selection step that could have missed something. The one exclusion (`farm-apk/www/animal-detail.html.bak`, a stray backup file discovered during this handoff's own repository audit) is documented, not silently dropped.
