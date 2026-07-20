# Migration Checklist — Previous Session Recovery
*Phase 1 deliverable, before any code changes. Every item below was verified directly against the newly uploaded archive, not assumed.*

**Important finding up front:** this uploaded archive is **not** the state I left off at — it matches the *original, pre-security-work* state of the project (confirmed by the admin PIN backdoor, plaintext PINs, synchronous `fbUrl`, and unregistered service worker all being present exactly as they were before any of my previous fixes). One exception was found already correct — see below. Nothing here is assumed; every line was grep/read-verified against these actual files.

| Item | Status | Evidence |
|---|---|---|
| Admin PIN fallback scoped to empty DB only | ❌ MISSING | `login.html:84` — `if(!user&&lRole==='admin'&&lPin==='1234')`, no `users.length===0` guard. Permanent backdoor is back. |
| Plaintext PIN removed / SHA-256 hashing | ❌ MISSING | No `hashPin` function anywhere in `firebase.js`. `login.html:85` and `firebase.js:468` both still write/compare literal `pin:'1234'`. |
| Legacy PIN migration behavior | ❌ MISSING | Depends on hashing existing first — N/A until hashing exists. |
| Firebase Auth bridge (`signInWithFirebaseAuth`, `uid_lookup`) | ❌ MISSING | No occurrences of either name anywhere in the project. |
| No `users/{id}` → `users/{uid}` rekey performed | ✅ N/A — correctly absent | Confirmed no rekey exists, which is correct (it was never supposed to be done automatically). |
| `Users.init()` plaintext PIN write | ❌ MISSING FIX | Still writes `pin:'1234'` (`firebase.js:468`). |
| `fbUrl` is async, all 7 functions + undo-history use `await fbUrl(...)` | ❌ MISSING | `fbUrl` is still a plain synchronous function; every call site still calls it unawaited. |
| Cache invalidation on successful write (`fbPost`/`fbPut`/`fbPatch`) | ❌ MISSING | All three still only call `fbCacheInvalidate` inside the `if(!r.ok)` failure branch. |
| Undo-delete double-`.json` URL bug | ❌ MISSING FIX | `firebase.js:217` — still `fbUrl(op.table)+'/'+op.id+'.json'`, the malformed pattern. |
| `settings.html` missing auth gate | ❌ MISSING FIX | No `requireAuth()`/`renderNavbar()` call anywhere in the file. |
| `settings.html` missing script dependencies | ❌ MISSING FIX | Only `farm-react.js` is loaded; `config.js`/`firebase.js`/`nav.js`/`shared.js` are absent. |
| Admin reset section content | ❌ CONFIRMED MISSING | `<!-- RESET SECTION (Admin Only) -->` is followed by blank lines — no `<div id="admin-reset-section">` exists anywhere, yet JS at line ~222 already tries to `getElementById('admin-reset-section')` and toggle its display. This is a genuine dangling reference. |
| `cost.html` / `breeding.js` / `inventory.js` missing `can()` permission checks | ❌ MISSING FIX | None of the three have their matching `can('finance')`/`can('breeding')`/`can('inventory')` check. |
| `addFAB` undefined (previously found as a critical crash) | ✅ **ALREADY CORRECT — genuinely implemented**, not missing | `shared.js:566` has a complete, working `addFAB()` that builds a real floating button element with the mobile media-query show/hide logic. This is **not** my old no-op stub — it's a real implementation. **No action taken here — already fine.** |
| Service Worker registration (`navigator.serviceWorker.register`) | ❌ MISSING | Zero occurrences anywhere in the project. `sw.js` itself exists and is well-built, but nothing calls it. |
| `sw-register.js` | ❌ DOES NOT EXIST | New file, per Phase 4 — not recovered from a previous session, genuinely new work this round. |
| `database.rules.secure.json` / rules deployment | ⏸️ Correctly not present | Per Phase 5, this should stay pending — confirmed absent, correctly so. |

## What this means for scope
Given the above, this session needs to (re)implement essentially all of Sprints G/H/H.1's code-level fixes from scratch on this copy, **plus** build the genuinely new Phase 4 PWA recovery tools. `addFAB` is excluded from the work list since it's already correct. Proceeding to implementation now, in the same order as the task's phases.
