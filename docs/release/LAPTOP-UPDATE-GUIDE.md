# LAPTOP-UPDATE-GUIDE.md

## First-Time Setup
1. Copy `release/source/` to your chosen project location.
2. `cd` into it, run `npm install` (dev tooling only — see `docs/release/LOCAL-SETUP.md`).
3. Confirm Firebase connectivity is reachable (the app talks to it directly over REST — no separate SDK setup needed).
4. `npm run serve`, open `http://localhost:8080`.
5. Log in and confirm the app behaves as expected before making any changes.

## Updating an Existing Laptop Copy

1. **Backup current version.** Copy the existing project folder somewhere safe (a dated folder, or `git stash`/branch if it's already a git repo) before overwriting anything.
2. **Replace source.** Copy this package's `release/source/` over the existing folder — **except** `node_modules/` (regenerate, don't overwrite) and any local `.env`/config the existing copy may have that isn't part of this export.
3. **Update dependencies.** `npm install` again, in case `package.json`'s `devDependencies` changed.
4. **Verify.** Since this project has no build step, "verify build" means: `node --check` on every `.js` file (or just open a couple of pages in a browser and confirm no console errors) — see `scripts/safety-scan.js` for an automated version of the permission/SSOT half of this check.
5. **Run smoke tests.** `npm run test:smoke` at minimum; `npm test` for the full regression suite if time allows. See `docs/testing/TEST-STRATEGY.md`.
6. **Check `docs/release/VERSION-MARKER.md`** in the new package for anything flagged as uncommitted/in-progress before assuming the update is "final."
