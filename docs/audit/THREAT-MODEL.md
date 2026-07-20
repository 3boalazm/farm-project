# THREAT-MODEL.md (STRIDE)

## Spoofing
Auth is PIN-based, not session-token-based in the cryptographic sense — `localStorage['farm_user']` holds the trusted client state. **Anyone with browser DevTools access to a logged-in device can edit `localStorage['farm_user']` directly to claim any role, including admin**, since `can()` trusts this value without server-side verification (confirmed: `firebase.js`'s `can()` reads `getUser()`, which reads `localStorage` directly, no signature/token check). This is a real, structural limitation of the client-only permission model — not fixable without a genuine server-side auth layer, which is explicitly out of this mission's scope (architecture change).

## Tampering
Firebase writes are validated by `database.rules.json` for **shape** (required fields, types) but not **authorization** — any client can write to any collection with a well-formed payload, confirmed by this project's own prior certification work (Weight/Birth). This is a known, accepted tradeoff of the URL-obscurity security model, not new.

## Repudiation
`logActivity()` is called after most meaningful writes (confirmed near-universal in `GATEWAY_REFERENCE.md`). **`activity.html`, the intended viewer for this audit trail, is a genuine 0-byte empty file** (confirmed this session, traced to before this project's visible history — not introduced by any merge). This means audit data is being *written* but has no working *viewer* in this repository — a real repudiation-protection gap in practice, even though the underlying log data exists.

## Information Disclosure
Firebase client config is committed in `config.js`/`firebase.js` — expected and standard for a Firebase web app (client keys are not secrets by design). `ANTHROPIC_API_KEY` is correctly kept server-side (Vercel env var, `api/claude.js`). No evidence of secret leakage found this session.

## Denial of Service
No rate limiting on writes beyond Firebase's own (unverified) quota behavior. Bulk imports (`import.html`) have no confirmed upper bound on payload size — a plausible, unverified DoS vector via a very large CSV, not confirmed exploitable this session (would require live testing against real Firebase, unavailable in this sandbox).

## Elevation of Privilege
**The single most significant finding of this audit.** 10 of 19 permission-gated pages had zero `can()` enforcement — any authenticated user, regardless of role, could reach `health.html`/`vaccine.html` (explicitly excluded for `worker`/`visitor` in `ROLE_PERMS`) via direct URL navigation. **Fixed this session** — see `PERMISSION-MATRIX.md` for the complete before/after picture. This was a real, exploitable elevation-of-privilege path, not theoretical.
