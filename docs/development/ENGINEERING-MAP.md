# ENGINEERING-MAP.md

## Runtime
Node v22+ available for tooling only (tests, scripts) — the application itself ships as static files, zero runtime dependency on Node in production.

## Browser Targets
Modern evergreen browsers implied by usage of native `<input type="date">`, `fetch`, IndexedDB, Service Worker APIs — no explicit browserslist/polyfill config found; not independently re-verified this session.

## Build Process
**None.** Confirmed: no bundler, no transpiler, no `npm run build` script prior to this session. Files ship as authored. This is a deliberate project characteristic (`CLAUDE.md`: "no bundler, no framework, no npm install for the main app") — Phase 7's tooling additions (Playwright, a scanner script) must not violate this for the *application* itself; they are dev-time-only.

## Deployment Flow
Push to Vercel-connected branch → static hosting, `vercel.json` sets CORS for `/api/*` only. Android APK is a separate Capacitor project pulling from the same deployed URL.

## Code Organization
31 HTML pages at root; `pages/*.js` for 12 delegated pages; `shared.js`/`firebase.js`/`nav.js`/`config.js` as core shared runtime, loaded on every page in that order.

## Entry Points
`index.html` (redirect based on `localStorage['farm_user']`), then `login.html` or `dashboard.html`.

## Shared Modules
`firebase.js` (data layer, auth, permissions — `can()`, `ROLE_PERMS`), `shared.js` (UI, `createOffspringAnimal()`), `nav.js` (`FARM_NAV`, the single declared source of per-page permission requirements).

## Page Ownership
Documented exhaustively in `docs/architecture/REPOSITORY_MAP.md` (prior session) — unchanged this session except for the 10 files receiving permission-guard additions in Phase 6.

## Quality System — Before This Phase
**No automated tests existed.** Every verification across this entire multi-session engagement was ad hoc — a real Playwright browser launched, exercised, and torn down per task, never saved as a reusable asset. This phase's core contribution is converting that proven *methodology* into a persistent *asset*.

## Missing Protections (Before This Phase)
No CI, no pre-merge checks, no automated permission-regression detection — confirmed by the absence of `.github/` and any `tests/` directory prior to this session.
