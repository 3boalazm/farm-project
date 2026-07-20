# PERFORMANCE-INVESTIGATION.md

| Finding | Classification | Evidence |
|---|---|---|
| `farm-react.js` — 342KB pre-bundled React blob | Medium | Loaded only by `reports.html`/`settings.html`, confirmed lazy per `CLAUDE.md` — appropriately scoped, not loaded app-wide. Not a regression, already a known, accepted tradeoff for advanced charting. |
| `bayan-offline.html` — 235KB, bundles Chart.js inline as raw text | Medium | Confirmed this session (Phase 5 audit) — inflates this one page's load size; page is a special offline/print fallback, not part of the normal navigation flow, so the practical impact is limited to its own specific use case. |
| No confirmed memory leaks | — | Not independently re-verified this session (would require live, extended-session browser profiling, outside this sandbox) — carried forward as Unknown, not asserted clean. |
| Repeated Firebase reads across pages | Low | `fbGet`'s ~45s cache mitigates this for same-session navigation; no evidence of pathological repeated-read patterns found in this session's searches. |

**No Critical-classification performance issues found.**
