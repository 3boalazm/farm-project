# LOCAL-DEVELOPMENT.md

## First Run
Follow `docs/deployment/INSTALL.md`. Once `npm run serve` is running, `index.html` redirects to `login.html` (no `localStorage['farm_user']` yet) or `dashboard.html` (if already logged in on that browser).

## Making Changes
This is a **buildless, vanilla-JS multi-page app** -- there is no compile step. Edit any `.html`/`.js` file directly, save, and refresh the browser. Changes are visible immediately.

- New feature with real business logic touching a domain that has a `pages/*.js` file (breeding, finance, health, inventory, production, reports, tasks, vaccine, pedigree, farm_profile) -> edit that file.
- New shared UI component or utility used by 2+ pages -> add a new function to `shared.js` (additive only -- see `ARCHITECTURE-REFERENCE.md`'s Engineering Rules).
- New page -> follow the delegated pattern (`pages/<name>.js` + a thin HTML shell) unless genuinely simple.

## Running Tests
```
npm test                    # full suite
npm run test:permissions    # just tests/permissions
npm run test:ssot           # just tests/ssot
npm run test:smoke          # just tests/smoke
npm run scan                # static safety scanner (permission + SSOT regression checks)
```
Tests require `npx playwright install chromium` once, the first time (a one-time browser download for the test runner -- not required to run the application itself).

## Environment Variables
None required for local development. The Firebase client config is already committed in `config.js`/`firebase.js` (standard practice for Firebase web apps -- see `docs/deployment/FIREBASE-SETUP.md`). The only environment variable this project uses at all is `ANTHROPIC_API_KEY`, and only if you deploy `api/claude.js` as a Vercel serverless function -- irrelevant to local static-file development.

## Before Committing
1. `npm run scan` -- must show 0 CRITICAL.
2. `npm test` -- must pass in full, not just the tests you think are related to your change.
3. If you touched `nav.js` or added a `can()` check, update `docs/audit/PERMISSION-MATRIX.md` in the same change.
4. One atomic change per commit -- see `docs/development/ENGINEERING-RULES.md`.

## Troubleshooting
See `docs/deployment/TROUBLESHOOTING.md`.
