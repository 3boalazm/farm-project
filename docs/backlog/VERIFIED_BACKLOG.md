# Verified Backlog

**Every item below is directly supported by repository evidence from the consolidated artifact set — nothing speculative.**

| ID | Reason | Required Decision | Blast Radius | Priority |
|---|---|---|---|---|
| BL-BirthDirect | `submitBirthDirect()` independently creates animals, missing `birth_weight`/`notes` vs. canonical shape | New decision record needed | `pages/breeding.js` only | Medium |
| BL-TodayStrUTC | `todayStr()` returns UTC date, misdating entries during a fixed daily window for non-UTC-0 users | None — a bug fix, not a decision | `firebase.js` (1 function) + every caller's displayed default | Medium |
| BL-MigrationExec | Historical `weight_log` migration utility exists, proven correct against simulated data, never run against real data | None — blocked by environment, not decision | N/A (already built, read-only) | Medium |
| BL-ImportSyntaxError | `import.html` has a pre-existing syntax error blocking verification of that page's real-world behavior | None — a bug, needs re-confirmation against current repo first | `import.html` | Medium — re-verify before prioritizing |
| BL-ChartMigration | Chart.js → SVG migration flagged as the largest remaining inconsistency from Repository 3 | Scoping decision on which interactive features to preserve | Reports/Production/Health pages using Chart.js | Low-Medium |
| BL-RealDataVerification | Repository 3's module migrations verified only against empty/sandbox-unreachable data | None — a verification task | Read-only verification, no code change | Medium |
| BL-CacheInvalidation | `fbCacheInvalidate()` granularity never fully audited — potential stale-read window after a write invalidates a different cache key | None — an investigation task | Unknown until investigated | Low (flagged, not proven to cause a real incident) |

**Items intentionally excluded from this list:** anything from the Design System or SW/Sync threads whose production status is disputed or unconfirmed — see `docs/backlog/OPEN_DECISIONS.md` instead, since those require a status-resolution step before they're even "backlog-ready."
