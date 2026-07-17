# RELEASE-PROCESS.md

1. All changes land via PR against `main`; `.github/workflows/quality.yml` must pass (syntax check, `scripts/safety-scan.js` with 0 CRITICAL, full `npx playwright test` suite).
2. If the change touches `nav.js` or any `can()` call site, confirm `docs/audit/PERMISSION-MATRIX.md` still matches reality — re-run `npm run scan` explicitly.
3. If the change touches `shared.js`, `firebase.js`, or any Weight/Birth writer, re-run `npm run test:ssot` explicitly, not just the general suite.
4. Bump `package.json` `version`.
5. Merge to `main`; Vercel deploys automatically from the connected branch (no manual deploy step — confirmed, `CLAUDE.md`).
6. For a checkpoint worth marking permanently (not every merge), tag it: `git tag -a <name> -m "<what this represents>"`.
