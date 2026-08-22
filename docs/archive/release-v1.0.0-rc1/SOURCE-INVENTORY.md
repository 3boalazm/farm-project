# SOURCE-INVENTORY.md

**Complete inventory of the canonical repository at commit `4b1e8cf` + Phase 6/7 work. 258 files total, ~6.4MB excluding `node_modules`/`.git`/test-run artifacts.**

## Source Files
| Category | Count | Location |
|---|---|---|
| HTML pages | 31 | Repository root |
| Root-level JS (shared runtime) | 13 | `shared.js`, `firebase.js`, `nav.js`, `config.js`, `offline-sync.js`, `sw.js`, `sw-register.js`, `sync.js`, `sync-to-excel.js`, `import-data.js`, `notifications-service.js`, `farm-react.js`, `api/claude.js` |
| Delegated page logic | 12 | `pages/*.js` |
| Test suite | 7 | `tests/**/*.spec.js` |
| Scanner script | 1 | `scripts/safety-scan.js` |

## Configuration Files
`package.json`, `package-lock.json` (generated on next `npm install`), `manifest.json` (PWA), `vercel.json` (deployment), `database.rules.json` (Firebase security rules), `playwright.config.js` (test runner), `.github/workflows/quality.yml` (CI).

## Assets
`media/` — 10 files (logos, favicons, both light and dark variants).

## Documentation
97 files under `docs/` — architecture, certification, decisions, backlog, design, archive (63 preserved originals), audit (Phase 5/6 reports), testing, development, release (this document's own directory). Plus root-level: `CLAUDE.md`, `COMPONENTS.md`, `DESIGN-TOKENS.md`, `FIREBASE_RULES_SETUP.md`, `MIGRATION-CHECKLIST.md`, `BASELINE.md`, `MERGE-REPORT.md`, `BASELINE-VERIFICATION.md`, `FINAL-REPOSITORY-MAP.md`.

## Scripts
`scripts/safety-scan.js` (static permission/SSOT regression scanner).

## Deployment Files
`vercel.json`, `.github/workflows/quality.yml`, `farm-apk/` (separate Capacitor Android project — `capacitor.config.json`, `package.json`, build docs — present as a subdirectory reference, not the canonical location for that project's own history).

## Explicitly Excluded From This Inventory (and From the Release Package)
`node_modules/` (regenerated via `npm install`), `.git/` (this repository's own history — see `VERSION-MARKER.md` for the commit this package represents instead), `test-results/`, `playwright-report/` (transient test-run output), any `.log` file.
