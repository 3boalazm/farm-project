# AUTHENTICATION-DEEP-AUDIT (embedded — see also THREAT-MODEL.md)

## PIN / Password
- **Hashing:** `hashPin()` confirmed present, SHA-256 via Web Crypto, salted by user id.
- **Migration:** legacy plaintext accounts matched once, then silently upgraded — no forced reset, no lockout during migration.
- **Bootstrap guard:** admin PIN fallback correctly scoped to `users.length===0` (confirmed, `login.html`).

## Session
- **Logout:** `logout()` (`firebase.js:131`) clears `farm_user` and `_farm_auth_refresh` from `localStorage` — clean, confirmed complete for what it clears.
- **Expiration:** no time-based session expiration found — a session persists indefinitely until explicit logout or manual storage clearing. Not a proven active exploit, but a real gap relative to typical session-security expectations.
- **Stale sessions:** a role change made server-side (e.g., demoting a user) would not take effect until that user's next login — confirmed as an accepted, known limitation, not newly discovered.

## Recovery
- **Corrupted storage:** `getUser()` wraps its `JSON.parse` in a try/catch (confirmed pattern used at `index.html`'s own redirect logic) — corrupted `localStorage` fails safe to the login page, not a crash.
- **Offline login:** not verified this session — would require live network-disconnected testing, outside this sandbox's capability.

## Authentication Maturity: 6/10
Solid fundamentals (hashing, salting, safe-migration, bootstrap guard) undermined by two structural gaps: no session expiration, and a purely client-trusted role value (`localStorage`) with no server-side verification — the latter being the direct enabler of this session's main Elevation-of-Privilege finding.
