# VERSION-MARKER.md

```
Repository:  farm-bayan (بيان المزرعة)
Commit:      4b1e8cf16712a746fd3e26b3e33c24a92f2d0b05
Branch:      main
Date:        Thu Jul 16 17:01:00 2026 +0000 (commit date)
Export date: 2026-07-16 (this package's actual creation time)
Phase:       7.5 — Source Export & Local Release Package
Status:      Working tree NOT clean at export time -- see below
```

## Important — Read Before Relying On This Package

**The exported `source/` reflects the live working directory, not a clean checkout of `4b1e8cf` alone.** At export time, the following were real, uncommitted changes sitting on top of that commit:

- **All 10 Phase 6 permission-guard fixes** (`animals.html`, `barns.html`, `births.html`, `dashboard.html`, `dead.html`, `diary.html`, `goats.html`, `sheep.html`, `pages/health.js`, `pages/vaccine.js`) — modified, not committed.
- **`package.json`** — modified (added `scripts`/`devDependencies` for the test/scan tooling).
- **Everything from Phase 7**, entirely untracked: `.github/workflows/quality.yml`, `docs/audit/` (Phase 6 reports), `docs/development/`, `docs/testing/`, `docs/release/` (this directory), `package-lock.json`, `playwright.config.js`, `scripts/`, `tests/`.

**This is not a defect in the export — it is an accurate snapshot of real, verified work.** Every one of these changes was live-tested this session (10/10 permission fixes verified positive and negative; 32/32 automated tests passing). But **whoever receives this package should commit these changes** (or be told explicitly they're uncommitted) before treating `4b1e8cf` as the full story — the git history and the file contents are currently out of sync, and this package preserves the *files*, not a matching *commit*.

## Recommendation
Commit the Phase 6 + Phase 7 work as its own atomic commit before or immediately after distributing this package, so a future `git log` accurately reflects what's actually in the tree. Not done automatically here, consistent with this session's standing practice of only committing when explicitly requested.
