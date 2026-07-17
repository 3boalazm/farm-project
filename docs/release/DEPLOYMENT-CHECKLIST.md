# DEPLOYMENT-CHECKLIST.md — v1.0.0-rc1

## Before Deploying
- [ ] `npm install` succeeds (verified this cycle, exit code 0)
- [ ] `npx playwright test` -- all passing (81/81 verified this cycle)
- [ ] `node scripts/safety-scan.js` -- 0 CRITICAL (verified this cycle, 1 REVIEW: the expected `firebase.js` `farm_user` write)
- [ ] Confirm `config.js`/`firebase.js`'s `databaseURL` points at the intended production Firebase project
- [ ] Confirm `database.rules.json` is applied to that Firebase project (validation-only rules, not access-control -- by design)
- [ ] If deploying `api/claude.js`: confirm `ANTHROPIC_API_KEY` is set in Vercel's environment variables, not committed to source
- [ ] Bump `package.json` version if this deploy represents a new tagged release beyond `1.0.0`

## Deploy
- [ ] Push to the Vercel-connected branch -- no manual build step, static files serve as-is (`vercel.json` only sets CORS headers for `/api/*`)
- [ ] If the Android APK also needs updating: `cd farm-apk && npm run sync && npm run build` (separate project, separate release cycle)

## Immediately After Deploy
- [ ] Open the live URL, confirm `index.html` correctly redirects to `login.html` (logged out) or `dashboard.html` (logged in)
- [ ] Log in with each of the 5 roles at least once; confirm `docs/audit/PERMISSION-MATRIX.md`'s expectations still hold live (not just in the test suite)
- [ ] Confirm the new Executive Dashboard (Sprint 6) renders without console errors on a real device/browser, not just the sandboxed test environment
- [ ] Confirm at least one write in each of the three new intelligence domains (add a weight, a health record, a production entry) correctly triggers its corresponding alert/task, live against the real Firebase project -- see `docs/release/POST-DEPLOYMENT-VALIDATION.md` for the full checklist

## Rollback, If Needed
See `docs/release/ROLLBACK-PLAN.md` (from the original engineering certification) -- unchanged by this release cycle. `git revert`/`git checkout` the previous tag (`baseline-v2-production-candidate` or the prior working state) remains the correct mechanism; no new rollback complexity was introduced by any of the six product sprints, since every new collection is additive and independent.
