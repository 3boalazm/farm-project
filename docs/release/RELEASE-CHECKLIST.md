# RELEASE-CHECKLIST.md

## Before Release
- [ ] `npx playwright test` — all tests passing (32/32 as of `baseline-v2-production-candidate`)
- [ ] `node scripts/safety-scan.js` — 0 CRITICAL findings
- [ ] `docs/audit/PERMISSION-MATRIX.md` reviewed if `nav.js`/`can()` changed
- [ ] Firebase reachable — confirm `config.js`/`firebase.js`'s `databaseURL` is live (no automated check exists for this; manual confirmation)
- [ ] Backup confirmed — **no automated backup mechanism exists** (see `docs/architecture/SCALABILITY-REVIEW.md`); if this checklist item can't be checked, that is itself the honest status, not something to skip past silently
- [ ] `package.json` version bumped
- [ ] `CLAUDE.md` and any touched `docs/` file still match the code (spot-check, not exhaustive)

## After Release
- [ ] Smoke-test the live deployed URL directly (login, one read, one write) — CI tests the local static server, not the actual Vercel deployment
- [ ] Confirm no console errors on the 3-4 most-used pages (dashboard, animals, breeding)
