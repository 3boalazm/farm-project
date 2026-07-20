# INSTALL.md

## Prerequisites (Verified This Session)
- **Node.js**: `v22.22.2` verified working. `package.json` declares `engines.node: "24.x"` -- a pre-existing discrepancy, stated honestly, not resolved here (this is a product/tooling decision, not a defect). Either version range should work for this project's purposes (Node is only used for dev tooling -- tests and the static scanner -- never by the shipped application itself).
- **npm**: `10.9.7` verified working.
- **Python 3**: required only if using `npm run serve` (which wraps `python3 -m http.server`) -- any other static file server works equally well.

## Steps
1. Clone or unzip the source package.
2. `cd` into the project root.
3. `npm install` -- installs `@playwright/test`, the only dependency, used exclusively for the test suite. **The application itself has zero runtime npm dependencies** -- confirmed via `docs/deployment/DEPENDENCY-MAP.md`.
4. `npm run serve` -- starts a local static server on port 8080.
5. Open `http://localhost:8080` in a browser.

## Verified This Session
`npm install` and `npm run serve` were both run against a freshly-exported copy of this exact source tree (not the working development copy) and confirmed working: the server responds with HTTP 200, and `login.html` loads correctly in a real browser with the correct Arabic title and zero console errors.

## Next Steps
See `docs/deployment/LOCAL-DEVELOPMENT.md` for day-to-day development workflow, or `docs/deployment/FIREBASE-SETUP.md` if you need to point this at your own Firebase project rather than the one already configured in source.
