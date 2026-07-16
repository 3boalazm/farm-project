# LOCAL-SETUP.md

## Runtime
- **Node:** `package.json` declares `24.x` under `engines`. **Discrepancy, stated plainly, not silently resolved:** this session's own environment runs Node `v22.22.2`, and everything (tests, scanner) was verified successfully against that version. Either the `engines` field is aspirational/for a different target, or it should be revisited — this is a product decision, not something changed here.
- **npm:** `10.9.7`, confirmed working this session.
- **Browser requirements:** any modern evergreen browser (native `<input type="date">`, `fetch`, IndexedDB, Service Worker APIs are all relied upon — see `CLAUDE.md`).
- **Firebase requirements:** a Firebase Realtime Database instance reachable over REST; no Firebase SDK/npm package required (this app talks to the REST API directly). See `docs/release/CONFIGURATION-REQUIREMENTS.md` for exactly what needs to be supplied.

## Dependencies
`package.json`/`package-lock.json` exported alongside this documentation. **The application itself has zero npm dependencies** — `devDependencies` (`@playwright/test`) exist solely for the Phase 7 test/scan tooling, never loaded by the shipped app.

## Commands
| Purpose | Command |
|---|---|
| Install (dev tooling only) | `npm install` |
| Run locally | `npm run serve` (equivalent to `python3 -m http.server 8080`, matching `CLAUDE.md`'s own documented instructions) |
| Build | **None** — this project has no build step, by design. Files ship as authored. |
| Run tests | `npm test` (all), or `npm run test:permissions` / `test:ssot` / `test:smoke` for a subset |
| Run the static safety scanner | `npm run scan` |

## First Local Verification After Setup
1. `npm install`
2. `npx playwright install chromium` (one-time browser download for testing — not required to run the app itself, only to run its tests)
3. `npm run serve` in one terminal
4. `npm test` in another, with `BASE_URL=http://localhost:8080` (already the default in `playwright.config.js`)
