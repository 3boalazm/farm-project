# PERFORMANCE-AUDIT.md

## Frontend

| Finding | Classification | Evidence |
|---|---|---|
| `farm-react.js` — 342KB pre-bundled | Medium | Confirmed lazy-loaded, only `reports.html`/`settings.html`. Already correctly scoped — not a current problem, flagged only because it's the single largest asset in the repo |
| `bayan-offline.html` — 235KB, Chart.js bundled inline | Medium | Confirmed this session; scoped to one special-purpose offline/print page, not the main navigation flow |
| `dashboard.html` fetches `'animals'` 3 separate times (lines 65, 443, 545) | Low | Real, confirmed redundancy — mitigated in practice by `fbGet()`'s ~45s cache, but a genuine code-clarity issue worth consolidating next time the file is touched |
| No confirmed memory leaks | Unknown, not Clear | Would require live, extended-session browser profiling — outside this static sandbox's capability; not claimed clean, correctly left Unknown |

## Firebase

| Finding | Classification | Evidence |
|---|---|---|
| Zero `.indexOn` rules | **High** | Confirmed 0 occurrences in `database.rules.json`. Currently harmless at today's data volume; becomes a real, user-visible slowdown as any collection grows — see `SCALABILITY-REVIEW.md` |
| No pagination in `fbGet()` | **High** (forward-looking) | Confirmed, `firebase.js:339` — every read is a full-collection fetch. Not a current problem; a structural constraint on future data growth |
| No real-time listeners (`.on('value')`) anywhere | Not a finding | Confirmed via direct search — the app is fetch-and-cache by design, a valid, simpler pattern for this app's actual concurrency needs (single farm, small staff) |
| `fbGet()`'s ~45s cache | Positive finding | Genuinely mitigates the redundant-fetch pattern above; a real, working optimization already in place |

## Assets

| Finding | Classification | Evidence |
|---|---|---|
| `media/` — 10 files, logos/favicons/icons | Low | Reasonable size for a PWA icon set; not audited for individual file optimization (e.g., PNG compression) this pass — a genuinely low-priority item |
| No duplicated image assets found | Not a finding | — |

## Overall Verdict

**No Critical-classification performance issues exist today.** The two High-classification items (missing indexes, no pagination) are correctly forward-looking — they describe what breaks under growth, not what's broken now, which is the right framing for a 5-year audit rather than triggering unnecessary present-day changes.
