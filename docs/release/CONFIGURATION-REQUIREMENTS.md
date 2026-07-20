# CONFIGURATION-REQUIREMENTS.md

**No secret values are reproduced in this document, even though some are already present in the exported source (see note below) — this describes what's *needed*, not the live values themselves.**

## Firebase Configuration
- **Already committed in `config.js`/`firebase.js`:** the Firebase client config object (`apiKey`, `databaseURL`, etc.). This is expected, standard practice for a Firebase web app — client keys are not secret by design (Firebase's own security model relies on database rules, not key secrecy). **This project's specific security model additionally relies on the database URL not being widely publicized** (per `CLAUDE.md`) — treat the exported `source/` as sensitive on that basis alone, even though nothing in it is a traditional "secret."
- **Firebase security rules:** `database.rules.json` is included in the export as-is (validation-only, not access-control — see `CLAUDE.md`'s Auth section for why).

## Environment Variables (Not Included — Must Be Configured Per-Deployment)
- **`ANTHROPIC_API_KEY`** — required only for `api/claude.js` (the Anthropic proxy serverless function). Set in Vercel's own environment variable dashboard, never committed to source. Confirmed absent from every file in this export.

## API Keys
- **Google Gemini key:** used by `assistant.html`, but supplied per-user at runtime via `localStorage['farm_gemini_key']` — not a repository-level secret at all, nothing to configure at the source level.

## Deployment Secrets
None found committed in this export beyond the Firebase client config already discussed above. Vercel deployment itself requires the project to be connected to a Vercel account/team — an account-level configuration step, not a file.

## What a New Environment Needs, Concretely
1. This exported `source/` (or `release/source/`) as the file tree.
2. A reachable Firebase RTDB instance — either the existing one (URL already in the exported config) or a new one, with `database.rules.json` applied.
3. If using the Anthropic proxy: an `ANTHROPIC_API_KEY` set in that deployment's environment.
4. Nothing else — no other external service is required for the core application to function.
