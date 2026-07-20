# Risk Register

**Consolidated from every risk finding across all three engineering threads. Classified by evidence, not impression.**

| Risk | Thread | Classification | Evidence |
|---|---|---|---|
| `submitBirthDirect()` diverges from canonical Birth shape (missing `birth_weight`/`notes`) | Core/SSOT | Medium | Confirmed live, Wave B final certification |
| `todayStr()` returns UTC date, not local calendar date — misdates entries during a fixed daily window for non-UTC-0 users | Core/SSOT | Medium (deterministic, repository-wide) | Numerically proven, Formal Verification Round 3 |
| Historical `weight_log` data never migrated to real production Firebase | Core/SSOT | Medium | Migration utility proven correct against simulated data only; no Firebase network access from any verification sandbox used |
| `import.html` has a pre-existing syntax error | Core/SSOT | Medium — blocks verifying that page's real-world behavior at all | `repo4-checkpoint-report.md`; **not independently re-confirmed against the current live repo this pass** |
| Farm Settings has no Firebase-backed source (localStorage-only, per-device) | Core/SSOT | High, confirmed real (multi-device usage is part of this project's actual context) | `ssot-dependency-graph-final.md`, restated in `architecture-freeze.md` as an open Product Decision (D-04) |
| `activity_log` has a writer but the intended viewer page has historically been reported empty/broken | Core/SSOT | Medium-High | Multiple independent artifacts; `dead-code-audit-sprint2.md` specifically corrects an earlier "just delete it" assumption — it's a live nav target with real APK-bundle relevance |
| Cache-invalidation granularity (`fbCacheInvalidate()` per-collection keys) never fully audited | Core/SSOT | Unknown, explicitly | `ssot-tightened-audit.md`, `ssot-confidence-report.md` — flagged, never closed |
| `notifications` collection schema/producer status | Core/SSOT | Low-severity, explicitly deferred (D-06) | RDR; no evidenced user need for a persisted producer |
| SW registration not actually invoked on `login.html`/`settings.html` despite script being loaded | SW/Sync | **Conflicting evidence — see below** | `real-environment-validation-2.4.7.md` says unresolved; separate session memory says fixed. Not resolved here. |
| `sw-register.js` missing from `sync-manifest.json`'s `always_sync` list | SW/Sync | Medium, if this tooling is ever activated | Same artifact, direct manifest check |
| Android/real-device SW behavior entirely unverified | SW/Sync | Unknown | No Android SDK/emulator available in any sandbox used across this artifact set |
| Real offline-fallback behavior inconclusive | SW/Sync | Unknown | Testing-tool limitation, not a pass/fail result |
| Design System proposal's file-structure changes not reflected in live repo | Design | N/A — not a risk, a status fact | Direct repository inspection this pass |
| Chart.js vs. SVG chart inconsistency across pages | Repository 3 | Low-Medium, explicitly flagged as the largest remaining item in that thread | `repository3-final-deliverable.md` |
| Repository 3's module migrations verified only against empty/sandbox-unreachable data | Repository 3 | Medium — real-data verification pass explicitly recommended, not yet performed | Same document |
| Firebase security rules content | All threads | **Unknown, structurally unclosable** | No sandbox used across any thread had access to deployed Firebase rules |
| Cloud Function existence outside this repository | All threads | **Unknown, structurally unclosable** | Confirmed no local Cloud Functions directory exists; cannot rule out externally-deployed functions |

**Every "Unknown, structurally unclosable" entry is not a gap in this consolidation — it is a genuine limit of what any repository-internal investigation can determine.**
