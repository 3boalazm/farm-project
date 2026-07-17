# TROUBLESHOOTING.md

## "npm install" fails
Confirm Node/npm are actually installed and on `PATH` (`node --version`, `npm --version`). If a specific error mentions network access, this project's only dependency (`@playwright/test`) needs npm registry access.

## "npm run serve" starts but the page is blank / shows errors
Open the browser's DevTools console. If you see `Failed to fetch` errors, this is very likely the app trying to reach Firebase and being unable to (no network, or the `databaseURL` in `config.js`/`firebase.js` doesn't point at a real, reachable project) -- expected in a fully offline/sandboxed environment, not expected in a normal network. See `docs/deployment/FIREBASE-SETUP.md`.

## Login doesn't work
This project uses a **custom PIN system**, not email/password. If this is a genuinely empty database (no users yet), a bootstrap admin PIN (`1234`) is available, correctly scoped to only work when zero users exist -- see `firebase.js`'s login logic and `ARCHITECTURE-REFERENCE.md`'s Authentication section. Once any user exists, this fallback no longer applies.

## Tests fail with a browser-launch error
Run `npx playwright install chromium` once -- the test runner needs its own browser binary, separate from any browser already on your system.

## Tests fail with `window.fbGet is not a function` or similar
Confirm you're testing against a running local server (`npm run serve` in one terminal, tests in another) -- the test suite expects `http://localhost:8080` by default (configurable via the `BASE_URL` environment variable, see `playwright.config.js`).

## A permission I expect to be blocked isn't being blocked (or vice versa)
Check `docs/audit/PERMISSION-MATRIX.md` for the current, verified expectation per role/page. If it doesn't match what you're seeing, that's worth investigating as a real regression -- `npm run scan` should catch a declared-but-unenforced permission automatically.

## Something in Weight/Birth/Production/Health intelligence seems wrong
Start with `docs/features/INTELLIGENCE-CONTRACTS.md` for each engine's exact input/output shape, then the specific `*-ANALYSIS.md` or `*-INTELLIGENCE.md` document for that domain. Every engine is read-only except where explicitly documented to write (see `ARCHITECTURE-REFERENCE.md`).

## Still Stuck
Check `docs/repository/RISK_REGISTER.md` and `docs/release/KNOWN-LIMITATIONS.md` -- the issue may be an already-documented, known limitation rather than a new bug.
