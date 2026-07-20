# CONFIGURATION-SECURITY-REVIEW.md

## The Known Finding — `firebase.js:399` (relocated to `config.js` in the Phase 2 hygiene pass)

```
const WEATHER_API_KEY='...' (redacted in this document; present in source as of this checkpoint)
```

Used for two third-party calls: `weatherapi.com` and `openweathermap.org` (`firebase.js:405-406`), for the in-app weather display.

**Update (Phase 2 quick win):** the literal key no longer lives inline in `firebase.js`. It has been moved into `FARM_CONFIG.weatherApiKey` in `config.js` (and its `farm-apk/www/config.js` mirror) — the same existing configuration mechanism already used for Firebase config, farm name, and breed lists. `firebase.js` now reads `WEATHER_API_KEY=FARM_CONFIG.weatherApiKey`. This is the "single configuration location" quick win, not the server-side proxy migration described below — that remains future work.

### Decision: **SAFE NOW**

**Reasoning, not just a verdict:**
- Both `weatherapi.com` and `openweathermap.org` free-tier keys are designed to be used from client-side code by their own providers' documentation — unlike a database admin key or a payment processor secret, a weather API key's blast radius if exposed is quota exhaustion or misuse of a free service, not data breach or financial loss.
- It is **already** publicly present in every browser that loads the app — it has been client-visible since before this engagement began. Nothing about *this* review changes its exposure; the key was never actually secret in practice, regardless of where it sits in source.
- Rotating it **would change application behavior** (a live key swap, requiring a new account/key from the provider) — explicitly forbidden by this phase's own rules without a separate, deliberate task.

**NEEDS MIGRATION, for the next dedicated pass, not this one:** moving it to a server-side proxy (mirroring the `api/claude.js` pattern already established for the Anthropic key) would be the correct long-term fix — it costs nothing today, but is the textbook right answer once someone is doing scoped security work rather than a read-only audit. Flagged in the roadmap, not executed here.

## Environment Separation

**No `.env` files exist** (confirmed, `find` swept this session). **No development-vs-production config split exists at all** — `config.js`/`firebase.js` point at one Firebase project regardless of environment. This is a genuine, real gap: there is currently no way to test against a non-production database without editing source directly. Not a secret-exposure risk, but a real operational risk (a bug introduced while "testing" writes directly to production data).

## Firebase Client Config

`apiKey`/`databaseURL` committed in both `config.js` and `firebase.js` — standard, expected practice for a Firebase web app (Firebase's own security model relies on database rules, not key secrecy; see Google's own public documentation on this exact point). Not a finding.

## `ANTHROPIC_API_KEY`

Correctly server-side only, via Vercel environment variables, never committed — confirmed absent from every file swept this session (again, this pass, not assumed from memory).

## Recommendation Summary

| Item | Status | Action This Phase |
|---|---|---|
| Weather API key | SAFE NOW | None — documented, flagged for future proxy migration |
| Environment separation | Real gap | Documented in roadmap — not a secret leak, an operational risk |
| Firebase client config | Not a finding | None needed |
| Anthropic key | Correctly handled | None needed |
