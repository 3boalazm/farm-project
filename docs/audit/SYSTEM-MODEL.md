# SYSTEM-MODEL.md

## Frontend Architecture
Vanilla, buildless multi-page app. 31 HTML pages, no client-side router, no bundler. Common script chain: `config.js → firebase.js → nav.js → shared.js → offline-sync.js → pages/<feature>.js` (delegated pages) or fully inline (16 pages). Entry point `index.html` redirects based on `localStorage['farm_user']` presence.

## Data Architecture
Firebase RTDB over REST, no SDK. `firebase.js` is the sole data layer (`fbGet/fbPost/fbPatch/fbPut/fbDelete`), ~45s in-memory cache, invalidated on write. Weight (`animals/{id}/weights`) and Birth (`breeding`+`animals` via `createOffspringAnimal()`) are certified SSOT. `genId()` (timestamp+random) produces human-readable reference codes, not primary keys — Firebase's own auto-generated `_id` is the real document identifier everywhere.

## Security Architecture
Custom PIN auth (not Firebase Auth), `hashPin()` (SHA-256, salted), `signInWithFirebaseAuth()` as a fail-safe secondary bridge for `auth.uid`/rate-limiting. `database.rules.json` enforces data validation only, not access control — access control lives entirely client-side via `can(perm)`, checked against `ROLE_PERMS`. **This session's audit found and fixed 10 pages missing this check entirely** (see `PERMISSION-MATRIX.md`).

## Offline Architecture
Two independent mechanisms: `sw.js` (byte-level HTTP caching, complete but not registered anywhere) and `offline-sync.js`/`FarmOfflineSync` (IndexedDB write queue, genuinely independent of the service worker). `sw-register.js` exists, is correct, but is not loaded by any page — the entire SW/PWA layer is built and dormant, a deliberate, documented state.

## Deployment Architecture
Vercel static hosting + two serverless functions (`api/claude.js`, unused by the client; `chat.js` was a misplaced duplicate, removed at commit `4b1e8cf`). Android APK is a separate Capacitor project (`farm-apk/`), pulling from the same Vercel-deployed web app.
