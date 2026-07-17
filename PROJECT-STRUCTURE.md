# PROJECT-STRUCTURE.md

## Folder Tree (Real, Git-Tracked Structure)

```
/
├── *.html                  31 pages -- every user-facing feature
├── shared.js                Core reusable UI + the 5 intelligence engines
├── firebase.js               All Firebase REST calls + auth (fbGet/fbPost/fbPatch/fbDelete, hashPin, can())
├── nav.js                    Sidebar navigation config (FARM_NAV) + permission-filtered rendering
├── config.js                 Static, deploy-time config (Firebase client keys)
├── offline-sync.js           IndexedDB write-queue for offline use
├── sw.js / sw-register.js    Service Worker -- complete, deliberately NOT activated (see ARCHITECTURE-REFERENCE.md)
├── styles.css                Single global stylesheet, 3-tier CSS-variable token system
├── pages/                    Page-specific logic for the 12 "delegated pattern" pages
├── api/                      Anthropic proxy (claude.js), the only server-side code
├── scripts/                  safety-scan.js -- static permission/SSOT regression scanner
├── tests/                    Playwright regression suite (auth, permissions, ssot, data-integrity, smoke, regression)
├── media/                    Logos, favicons, PWA icons
├── farm-apk/                 Separate Capacitor Android project (own build cycle, see BUILD.md)
├── docs/                     97+ files -- see below
├── manifest.json             PWA manifest
├── database.rules.json       Firebase validation rules (not access-control -- see ARCHITECTURE-REFERENCE.md)
├── package.json               One devDependency (@playwright/test); app itself has zero runtime deps
└── CLAUDE.md                  Primary entry-point document -- read this first, always
```

## `docs/` Subdirectory Responsibilities
| Directory | Contains |
|---|---|
| `docs/repository/` | Charter, working contract, risk register |
| `docs/architecture/` | Full architecture, SSOT, data flow, scalability review |
| `docs/certification/` | Weight/Birth/Sale/Transfer/Modal-lifecycle certification evidence |
| `docs/decisions/` | Formal decision records (D-01 through D-06+) |
| `docs/backlog/` | Verified, evidence-backed backlog |
| `docs/audit/` | Every audit pass's findings (permission matrix, production readiness, etc.) |
| `docs/security/` | Configuration/secret-handling review |
| `docs/performance/` | Performance audit findings |
| `docs/reliability/` | Offline reliability, observability plan |
| `docs/development/` | Engineering rules, contribution workflow, dependency strategy |
| `docs/testing/` | Testing architecture, critical-path definitions |
| `docs/features/` | 18+ files -- full design/architecture for every Sprint 1-6 feature |
| `docs/product/` | Capability map, gap analysis, backlog, roadmap, technical vision |
| `docs/roadmap/` | 12-month forward plan |
| `docs/release/` | Every release's process, checklist, notes, certification |
| `docs/deployment/` | This document and its siblings -- the handoff package's own docs |
| `docs/archive/` | 63 preserved original source documents, for full traceability |

## Entry Points
`index.html` -> redirects based on `localStorage['farm_user']` -> `login.html` (unauthenticated) or `dashboard.html` (authenticated). Every other page assumes authentication and calls `requireAuth()` on load.

## Shared Engines (in `shared.js`)
Five, added across Sprints 1-6, all pure-composition or clearly-scoped read/write functions -- full detail in `ARCHITECTURE-REFERENCE.md`:
1. `autoGenerateTask()` -- Automation Engine
2. `evaluateWeightAlert()` / `evaluateMissingWeightAlerts()` -- Weight Intelligence
3. `evaluateHealthRisk()` -- Health Intelligence
4. `evaluateProductionKPIs()` / `evaluateProductionAlert()` -- Production Intelligence
5. `evaluateOperationalPriority()` / `rankOperationalPriorities()` -- Unified Decision Engine

## Dashboard Flow
`dashboard.html`'s `DOMContentLoaded` -> `requireAuth()` + `can('dash')` -> one `Promise.all` batch fetching 13 collections -> `renderDashboard(...)` (synchronous, builds the full page from already-fetched data) -> three independent, fire-and-forget async calls for missing-weight staleness checks and the unified-priority ranking, which populate their own placeholder containers without blocking the synchronous render.

## Authentication Flow
`login.html` (skips `nav.js` entirely) -> PIN entry -> login logic in `firebase.js` checks the hashed PIN against `users`, silently upgrading any legacy plaintext match -> on success, `localStorage['farm_user']` is set and `signInWithFirebaseAuth()` fires as a fail-safe, non-blocking Firebase Auth bridge -> redirect to `dashboard.html`.

## Automation Flow
A domain write (vaccination scheduled, weight recorded showing a drop, a health risk crossing High/Critical, a production drop) -> the relevant intelligence engine evaluates -> if a follow-up action is warranted, `autoGenerateTask(eventType, payload)` is called -> deterministic dedup against existing tasks -> a `daily_tasks` record is created or updated, visible on `tasks.html` and the dashboard's Upcoming Tasks section.

## Intelligence Flow
Weight/Health/Production Intelligence each evaluate independently, read-only, from already-certified or already-existing data. The Unified Decision Engine composes their outputs (never recalculating them) into one explainable operational priority score, surfaced on the dashboard and each animal's detail page. Full contracts: `docs/features/INTELLIGENCE-CONTRACTS.md`.
