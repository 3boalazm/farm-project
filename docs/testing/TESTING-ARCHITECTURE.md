# TESTING-ARCHITECTURE.md

## Decision: Playwright

## Why Not the Alternatives
- **Vitest/Jest:** both assume a module system (ESM/CommonJS) and typically a bundler-adjacent workflow. This project is deliberately buildless, global-scope JS (`CLAUDE.md`: "don't introduce imports/modules/bundling"). Forcing Jest/Vitest to test `shared.js`/`firebase.js` as-authored would require either rewriting them as modules (an architecture change, explicitly forbidden) or extensive mocking of `window`/`document`/`localStorage`/Firebase REST calls — high maintenance cost for low fidelity.
- **Node native test runner:** same fundamental mismatch — this application's logic is inseparable from real DOM/browser APIs (`document.getElementById`, native `<input type="date">` validation, `localStorage`, IndexedDB for `offline-sync.js`). Testing without a real browser would test a fiction, not the app.
- **Custom scripts:** viable for the static-scanner piece (Phase 5), not for behavioral/permission testing, which genuinely needs a real browser to be meaningful.

## Why Playwright
1. **Already proven correct for this exact codebase** — every certification this entire engagement produced (Weight SSOT, Birth SSOT, the Phase 6 permission fixes) was verified this way, live, repeatedly, successfully.
2. **Zero build step required** — Playwright drives a real browser against the app's real static files, served exactly as production serves them (`python3 -m http.server`, matching `CLAUDE.md`'s own documented local-dev instructions).
3. **Tests the real thing** — native input validation, real `localStorage`, real DOM timing (the exact class of bug — `closeModal()` timing — this project's own history repeatedly found) are only catchable this way.
4. **Scales without architecture change** — adding a new test is adding a new `.spec.js` file; no build config, no module boundary decisions.

## Maintenance Cost
Requires a running local static server during test execution (`npm run serve` in one process, `npm test` in another, or CI orchestration handles both — see `.github/workflows/quality.yml`). This is the same requirement `CLAUDE.md` already documents for manual local development — no new operational burden introduced.
