# DEPLOY.md

## Deployment Target
Vercel, static hosting. `vercel.json` only sets CORS headers for `/api/*` -- no build command is configured or needed, since the app ships as-is.

## Steps
1. Connect the repository to a Vercel project (one-time setup, outside this document's scope -- see Vercel's own documentation for connecting a Git provider).
2. Push to the connected branch. Vercel deploys automatically -- no manual build trigger needed.
3. If deploying `api/claude.js` (the Anthropic proxy serverless function): set `ANTHROPIC_API_KEY` in the Vercel project's Environment Variables dashboard. Never commit this key to source.

## Pre-Deploy Checklist
See `docs/release/DEPLOYMENT-CHECKLIST.md` for the full, current pre-deploy checklist (verified as of `v1.0.0-rc1`).

## Post-Deploy Validation
See `docs/release/POST-DEPLOYMENT-VALIDATION.md` -- a real-Firebase checklist covering everything the automated test suite cannot verify against mocked data.

## Rollback
See `docs/release/ROLLBACK-PLAN.md`. In short: `git revert` or redeploy from a previous tag (e.g., `baseline-v2-production-candidate` or an earlier `v1.0.0-rc*`) -- every commit in this project's history is meant to be independently revertible.

## What Does NOT Need Redeploying
Firebase data changes take effect immediately for all users (it's a live database, not a static asset) -- no redeploy needed for data-only changes. Only code changes require a new deployment.
