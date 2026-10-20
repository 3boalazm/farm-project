# AUTH-MODEL.md — how a session is established and proved (2026-10)

> Living document. It describes what the code does **today**; the audit that
> forced most of it is `docs/audit/FULL-AUDIT-2026-10.md` (items O-01, O-18,
> O-21, F-29). Rules deployment is covered in
> `docs/deployment/RULES-AND-DEPLOY.md`.

## 1. Why this exists

The app is a public repository whose `config.js` contains a live Firebase
project id (`farm-mz99`). A Firebase RTDB URL is **not** a secret: anyone who
reads the repo can call the REST API. Until 2026-10 the only thing standing
between that fact and the whole herd/finance/users dataset was a 4-digit PIN
hashed with a single round of SHA-256 and a rules file that let *any*
authenticated caller read `users` — and the client minted Anonymous Auth
tokens on demand, so "any authenticated caller" meant "anyone with curl".

The model below closes that chain. It is layered, and each layer has a
distinct job:

| Layer | Job | Failure mode if absent |
|---|---|---|
| `database.rules.json` | Server-side authorization: *who may read/write what* | Data is world-readable (the pre-2026-10 state) |
| PIN v2 (`pin_vault`) | Proves the human knows their PIN, strongly | A 4-digit PIN falls to offline hashing in minutes |
| Firebase Auth bridge | Gives the rules a real `auth.uid` to key on | Rules cannot distinguish users, so they must stay open |
| `verifySession()` (O-01) | Re-checks a stored session against the server on every boot | A stale/forged `farm_user` in localStorage is trusted forever |
| `ROLE_PERMS` + `can()`/`canWrite()` | In-app UX gating | Users see actions the server will refuse |
| API guard (O-21) | Stops `api/*.js` from being an open AI relay | Anyone on the internet spends the project's AI quota |

**The rules are the security boundary.** Everything client-side is UX and
defence in depth: a visitor's browser can always be patched, so no client-side
check may be the only thing protecting data.

## 2. Credential storage

* `users/{userId}/pin_hash` — legacy `SHA-256('bayan-farm-pin-salt:' + userId + ':' + pin)`.
  Kept only so an existing account can be matched **once** during login and
  then upgraded. Never written by new code.
* `pin_vault/{userId}/pin_hash_v2` — `PBKDF2-SHA256`, 120 000 iterations,
  16-byte per-user random salt, stored as 64 hex chars
  (`hashPinV2()` / `verifyPinV2()` in `firebase.js`). The vault is a separate
  collection so that `users` can be made unreadable to normal clients without
  hiding the thing login has to check.
* Plaintext `pin` is never written. `settings.html`'s reset-all excludes both
  collections.

Rules for the vault: `.read: false` for everyone, `.write` only for the user
themself or an admin, and a `newData.isString() && newData.val().length == 64`
validation so a malformed hash cannot be stored.

## 3. The Firebase Auth bridge

The rules need `auth.uid`. App user ids are not Firebase uids, so each app
user gets a **synthetic Firebase account**:

```
email:    u_{appUserId}@bayan-farm.internal
password: bfarm-pin-{pin}-v1
uid_lookup/{firebaseUid} = {appUserId}      (write-only map, admin/self write)
```

Login order (`attemptLogin()` in `login.html`):

1. Read the **public** directory (`user_directory`, falling back to `users`
   only if the vault-era projection is missing) to list who can sign in.
2. Read that user's own record (`users/{id}` is self-or-admin readable).
3. `signInBestSlot()` — try the stored auth slots newest-first
   (`users/{id}/auth_slots`, at most 4) against Identity Toolkit
   `accounts:signInWithPassword`. A slot is a `{firebaseUid, email, pinVersion}`
   triple created when a PIN is proven, so a re-login does not need to re-derive
   anything.
4. If Firebase answers `INVALID_LOGIN_CREDENTIALS` but the **hash** matches
   (PIN changed elsewhere, or the slot predates a rotation), the app repairs
   the slot: `provisionAuthSlot({forceSignUp:true})` then a PATCH of the last 4
   chars. This is the only path that creates a Firebase account, and it runs
   only *after* a PIN has been proven locally — F-29's bug was falling through
   to `signUp` on any failed sign-in, which let an attacker overwrite the
   bridge password without knowing the PIN.
5. Only if all of that fails does `verifyPinAgainstRecord()` accept the hash
   directly, record `verifiedBy: 'pin-hash:v2'` (or `:legacy`), and lazily
   write the v2 hash + provision a slot.
6. First run: no users at all + PIN `1234` ⇒ bootstrap `admin1`. The guard is
   `FIRST_RUN` (directory empty **and** `users` unreadable/empty), never
   `pin === '1234'` alone.

Session record: `localStorage.farm_user` plus
`localStorage._farm_auth_refresh` (Firebase refresh token). The session carries
`verifiedBy: 'firebase-auth' | 'pin-hash:v2' | 'pin-hash:legacy' | 'first-run'`,
which `diagnostics()` reports and the settings page displays — a session that
could not be proved server-side is visible, not silent.

**Console prerequisite:** Email/Password must be enabled in the Firebase
Console *before* the hardened rules are deployed, or every client will be
anonymous and the rules will (correctly) deny almost all reads. The client
degrades safely (`probeAuthProvider()` detects
`OPERATION_NOT_ALLOWED` and stops retrying), but the app becomes read-denied —
that is the intended behaviour of a closed rules file, not a bug.

## 4. Session verification on boot (O-01)

`verifySession({force})` runs from `initApp()` on every page:

* reads `users/{session.id}` through `fbGetSafe()` (which distinguishes
  *denied* from *absent* using `lastFbStatus()`),
* `ok:true, reason:'verified'` — record exists, `active !== false`, and the
  server role either matches the session or is written back into it,
* `ok:false, reason:'role-mismatch' | 'deactivated' | 'no-session'` — the
  session is cleared and the user is sent to `login.html`,
* `ok:true, reason:'unverifiable'` — the read was **denied or the network
  failed**. The session is kept: an outage must not log a whole farm out, and
  the rules (not the client) still decide what that session can read.

A deactivated user therefore loses access on their next page load even though
their PIN never changed.

## 5. Roles and permissions

`ROLE_PERMS` (`firebase.js`) is the single definition; `can(page)` /
`canWrite(area)` read it, `nav.js` filters the menu with it, and the rules
express the same shape server-side.

| Role | Sees | Writes |
|---|---|---|
| admin | everything | everything |
| supervisor | everything except `users`, `finance`, `activity` | operational areas |
| vet | health, breeding, dash, notifications, bayan | health, breeding |
| worker | dash, animals, notifications, bayan | operational areas |
| visitor | dash, animals, bayan | nothing (except explicit `custom_perms`) |

`custom_perms` grants are **UI-only**: RTDB rules cannot test membership of an
array, so a per-user extra permission can widen the interface but never the
data. This is recorded here because it is the one place where the client and
the server intentionally disagree.

## 6. The AI relay guard (O-21)

`api/groq.js` and `api/claude.js` both delegate to `server/api-guard.js`:

```js
const verdict = guard.authorize(req, { serverKey: process.env.FARM_API_TOKEN,
                                       headerKey: 'x-user-key' });
```

* With `FARM_API_TOKEN` set: a matching `Authorization: Bearer` is accepted
  (`mode:'server'`).
* Without it: **only** a bring-your-own key in `x-user-key` is accepted
  (`mode:'byo'`). If neither is configured the endpoint answers
  `403 open relay` — it refuses to become a free proxy.
* Origin allowlist, per-IP 30 requests/minute (module-level state ⇒ `429`),
  200 KB body cap, `max_tokens` clamped to 4096, inbound `Authorization`
  never forwarded upstream, specific-origin CORS with `Vary: Origin`.

`vercel.json` protects both routes; the guard is plain Node so it also runs
under `node server/…` locally.

## 7. What is *not* solved here

* **Slot revocation.** A rotated PIN leaves the old slot's Firebase password
  valid for that slot (there is no server to call `delete` on). Rotation
  overwrites the newest 4 slots; a paranoid reset means deleting the user's
  `auth_slots` node, which forces re-provisioning on next login.
* **Deployed rules are unverifiable from this repo's CI** without the Firebase
  emulator (Java) — see `docs/deployment/RULES-AND-DEPLOY.md` §4 and audit
  item O-12.
* **Public client config.** `config.js` ships the Firebase *client* config and
  a weather API key in a public repo. The client config is designed to be
  public (that is why the rules matter); the weather key is not, and remains a
  known, documented exposure (`docs/security/CONFIGURATION-SECURITY-REVIEW.md`)
  that only a server-side proxy can fix.

## 8. Tests that pin this model

* `tests/unit/25-security-auth.suite.js` — 22 tests: PIN v2 hashing, the
  bridge contract, slot repair, `verifySession` outcomes, the guard's relay
  refusal and rate limit, and `scripts/apply-access-policy.js --check`
  (rules drift fails the build).
* `tests/unit/26-product-correctness.suite.js` — write-permission guards
  (O-07/O-08), idempotency keys (O-04), diagnostics (O-17).
* `tests/security/hermetic.spec.js` — the browser suite no longer talks to the
  production project (O-19).
* `tests/rules/accounting-rules.test.js` — the emulator rules suite; not run by
  Playwright (see `playwright.config.js` `testIgnore`).
