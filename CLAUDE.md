# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**This is the canonical, merged version — combining a pre-existing technical architecture overview with this repository's later `/docs` knowledge base (architecture certifications, decision records, backlog). If you need depth beyond this file, `docs/repository/REPOSITORY_CHARTER.md` is the next stop.**

## What This Is

**بيان المزرعة (Bayan Farm)** — an Arabic (RTL), offline-capable farm/livestock management PWA for goats and sheep. It is a **vanilla, buildless multi-page app**: plain HTML + global-scoped JavaScript loaded via `<script src>` tags, talking to Firebase Realtime Database over its REST API. There is **no bundler, no framework, no npm install** for the main app, and no build step — you edit files and they ship as-is. Deployed on Vercel.

All UI text, comments, and many identifiers are in Arabic. Preserve Arabic strings exactly.

## Commands

There is still **no build step** for the app itself, but there is now a real
test toolchain (added 2026-10; `npm install` pulls three devDependencies —
`@playwright/test`, `jsdom`, `css-tree` — and nothing else):

```bash
npm run test:unit     # 26 jsdom suites, ~12 s, no browser, no network  ← run this first
npm run scan          # static safety scan (permission + SSOT regressions)
npx playwright test --list    # browser suite inventory (428 tests / 56 files)
npx playwright test   # browser suite; needs `npx playwright install chromium`
npm run test:all      # unit + browser
node scripts/apply-access-policy.js --check   # rules drift (also asserted in suite 25)
node scripts/sync-apk-www.js  # refresh farm-apk/www after ANY page/script/style change
```

To work on the app itself:

- **Run locally:** serve the repo root over HTTP (a service worker + REST fetches require `http://`, not `file://`). Any static server works, e.g. `npx serve` or `python -m http.server`. Entry point is [index.html](index.html), which redirects to `dashboard.html` or `login.html`.
- **Deploy:** push to the Vercel-connected branch. [vercel.json](vercel.json) only sets CORS headers for `/api/*`; static files serve from root.
- **Android APK** (separate Capacitor project in [farm-apk/](farm-apk/)): `cd farm-apk && npm run sync && npm run build` (or `npm run open` for Android Studio). The APK wraps a copy of the web app under `farm-apk/www/`.

## Architecture

### Page model
Every feature is a top-level `*.html` page in the repo root (dashboard, animals, health, vaccine, births, finance, reports, etc.), navigated by plain links. There is no client-side router. Each page includes the same core scripts in this order, then its own page script from [pages/](pages/):

```
config.js → firebase.js → nav.js → shared.js → offline-sync.js → pages/<feature>.js
```

**Confirmed exceptions, not assumptions:** `login.html` skips `nav.js` entirely (pre-authentication). `settings.html` skips `offline-sync.js`. Globals defined earlier are available to everything after — this is the entire "module system." A page script typically bootstraps with `DOMContentLoaded → requireAuth() → fbGet(...) → render`.

**Two structural patterns:** delegated (HTML is a shell, logic in a matching `pages/*.js` file — breeding, finance, health, inventory, production, reports, tasks, vaccine, pedigree, farm_profile) and inline (all logic in the page's own `<script>` block — animals, animal-detail, barns, assistant, settings, import, login, notifications, dead, diary, cost, births, users, fix-births).

### Data layer — [firebase.js](firebase.js)
The heart of the app. Talks to Firebase RTDB **directly over REST** (no Firebase SDK). Core functions everything else builds on:
- `fbGet(path, skipCache)` — returns an **array**, each item shaped `{...fields, _id: firebaseKey}`. Has a ~45s in-memory cache; pass `skipCache` to bypass.
- `fbGetOne`, `fbGetSingle`, `fbPost`, `fbPut`, `fbPatch`, `fbDelete` — writes invalidate the path cache. `fbPost` returns the new key and auto-stamps `created_at`; uses HTTP POST (Firebase auto-key semantics — concurrency-safe by construction, proven via live testing).
- `getUser()/setUser()/logout()/requireAuth()` — auth state lives in `localStorage['farm_user']`; `verifySession()` re-checks it against the server on every boot (audit O-01) and distinguishes *denied* from *absent* via `fbGetSafe()`/`lastFbStatus()`.
- **Writes go through `_writeFetch()` (audit O-14).** PUT/PATCH/DELETE are idempotent, so they retry a network failure *and* 429/5xx with jittered backoff (350 ms × 2.2, capped 8 s, `Retry-After` honoured, 3 attempts). POST retries a retryable *status* but never a no-response network failure — without a response the row's fate is unknown and a duplicate is worse than a visible error. Nothing retries while `navigator.onLine === false`.
- **Diagnostics (audit O-17).** `diagPush(kind,msg,meta)` feeds a 40-entry ring; `diagnostics()` returns it plus session/auth/`lastStatus` context; `flushDiagnostics(reason)` POSTs the unsent `error|retry|write-failed` entries to `app_logs` (admin-readable, staff-writable) and marks them shipped. Error/unhandledrejection/pagehide listeners install themselves; `settings.html` has the panel.
- `can(perm)` — permission check used throughout nav and pages. Roles and their allowed perms are `ROLES` + `ROLE_PERMS`; a user may also carry `custom_perms`. Admin bypasses all checks. `cost.html`, once cited here as an example of a page granting a nav permission without an actual `can()` gate, has since been fixed (confirmed 2026-08-23: `if(!can('finance'))` is present). `scripts/safety-scan.js`'s Check 1 now verifies every `nav.js` page with a declared `perm` has real enforcement (inline or via its delegated `pages/*.js`) and currently reports 0 CRITICAL across all of them — still worth re-running after touching `nav.js` or a page's own guard, since this is exactly the bug class that regressed silently before.
- `logActivity(action, resource, description)` — audit log; call after meaningful writes (existing pages do). Writes universally; the intended viewer page's own status is documented in `docs/repository/RISK_REGISTER.md`.
- Arabic helpers: `ar(n)` (Western→Arabic-Indic digits), `todayStr()` (`firebase.js`; returns the **local** calendar date — the UTC/local-date bug once documented here was fixed for this canonical helper in commit `5b52250`, but ~11 call sites across `login.html`, `animal-detail.html`, and `shared.js` independently called `new Date().toISOString().slice(0,10)` instead of using it, keeping the same bug alive at each of them; fixed to call `todayStr()` instead, confirmed 2026-08-23 — see `docs/certification/WEIGHT.md`), `genId()`.

### Auth is layered and deliberately best-effort
Primary auth is a **custom PIN pad**, not Firebase Auth. On top of it two migrations coexist (both documented inline in [firebase.js](firebase.js)):
1. **PIN hashing** — `hashPinV2()` (PBKDF2-SHA256, 120 000 iterations, per-user random salt) is the current scheme, stored in a separate write-only `pin_vault` collection. `hashPin()` (single-round SHA-256) survives only as a legacy matcher: a legacy account is verified once and upgraded in place, and plaintext is never written. A 4-digit PIN under one SHA-256 round is brute-forceable offline in minutes, which is why the scheme changed — do not "simplify" it back. Full model: `docs/security/AUTH-MODEL.md`.
2. **Firebase Auth bridge** — each app user gets a synthetic email/password Firebase account (`u_<id>@bayan-farm.internal`, password derived from the proven PIN) so the rules have a real `auth.uid` to key on. Since 2026-10 the bridge is **slot-based** (`users/{id}/auth_slots`, max 4, newest first via `signInBestSlot()`), provisioning is explicit (`provisionAuthSlot({forceSignUp:true})`) and only ever runs *after* a PIN has been proven — the old fall-through to `signUp` on any failed sign-in let an attacker overwrite the bridge password without knowing the PIN (audit F-29). It remains **fail-safe for login**: if email/password is not enabled in the Console, `probeAuthProvider()` detects `OPERATION_NOT_ALLOWED`, the client stops retrying, and the user still gets in on the PIN hash (`verifiedBy: 'pin-hash:v2'`). It is **not** fail-safe for *data access*: with the hardened rules deployed, an unbridged (anonymous) session is denied most reads by design. Enable the provider before deploying rules — `docs/deployment/RULES-AND-DEPLOY.md` §3.
3. **Admin PIN bootstrap:** a fallback (`lPin==='1234'`) is correctly scoped to `users.length===0` (empty-database bootstrap only) — verify this guard is present before assuming it's safe; a version without the guard is a confirmed, real backdoor (see `MIGRATION-CHECKLIST.md` for the exact historical regression this was recovered from).

**This changed in 2026-10 (audit O-18).** [database.rules.json](database.rules.json) now enforces **per-role access control as well as validation**: 43 of 48 collections have their `.read`/`.write` expressions generated by [scripts/apply-access-policy.js](scripts/apply-access-policy.js), which resolves every caller through `uid_lookup/{auth.uid}` → `users/{appUserId}` → `role`/`active`. `users` is not readable as a collection at all (self-or-admin per record), login lists users from a public `user_directory` projection, money is admin-only, and no expression anywhere grants a visitor — or a bare `auth != null` — write access. The old statement that "the security model relies on the database URL not being public" is obsolete and was the vulnerability: the URL is in `config.js` in a public repo, and the client mints Anonymous Auth for every visitor. Hand-edit the *policy script*, not the rules file; `--check` (asserted by unit suite 25) fails the build on drift. There is no `database.rules.secure.json`.

### Offline / PWA
- [sw.js](sw.js) (service worker) uses per-resource caching strategies: cache-first for CDN assets, stale-while-revalidate for HTML/JS/CSS, and network-first-with-cache-fallback for Firebase GETs (offline reads return cached data tagged with an `X-Farm-Cache` header, or `[]` if nothing cached). **Since 2026-10 (audit O-09) `sw-register.js` is loaded by all 34 app pages, but registration is gated on `FARM_CONFIG.enableServiceWorker` in [config.js](config.js), which ships `false`.** So the wiring exists and the behaviour is still off: flipping that one flag activates it, and `settings.html` exposes the recovery tools (`requestClearDataCache`, `unregisterServiceWorker`) that make activation reversible from the UI. Cache names are versioned (`farm-static-v6` / `farm-pages-v6` / `farm-data-v6`) and the app shell includes `ui.css`, `ui-shell.js` and `sw-register.js`; bump the version whenever a cached asset changes or installed clients keep the old copy.
- [offline-sync.js](offline-sync.js) (`FarmOfflineSync`) queues writes in **IndexedDB** while offline and replays them (POST/PATCH/PUT/DELETE) when the connection returns. This is a real, distinct mechanism from the APK file-sync tooling (`tools/sync-apk/`, referenced in archived documentation, not confirmed present in this repository) and from `sync.js` (a species/breed reconciliation utility, likely related to the `diary_snapshot` feature — not independently confirmed as the same mechanism).

### Shared UI — [shared.js](shared.js), [nav.js](nav.js)
- [shared.js](shared.js) holds all reusable UI: `toast()`, `showModal()/closeModal()`, `renderFarmModal()`, KPI/section/header components (see [COMPONENTS.md](COMPONENTS.md)), status badges, and Arabic date/number formatting. It is loaded on every page. It also houses the canonical Birth helper, `createOffspringAnimal()` (see Engineering Rules below), and five decision-support engines added across Sprints 1-6 -- `autoGenerateTask()` (automation), `evaluateWeightAlert()`, `evaluateHealthRisk()`, `evaluateProductionKPIs()`, and `evaluateOperationalPriority()` (a pure composition layer over the other four, never recalculating their outputs). Full architecture, contracts, and design rationale for all five are in `docs/features/` -- start with `docs/features/UNIFIED-DECISION-ENGINE.md` for the composition layer, or `docs/features/INTELLIGENCE-CONTRACTS.md` for every engine's exact input/output shape.
- [nav.js](nav.js) defines the sidebar as the `FARM_NAV` data structure; `buildSidebarNav()` renders it, filtering each item by its `perm` through `can()`. Edit `FARM_NAV` to change the menu.
- [styles.css](styles.css) is the original global stylesheet, built on a 3-tier CSS-variable token system (raw → semantic → component). See [DESIGN-TOKENS.md](DESIGN-TOKENS.md) for the scales — reuse tokens rather than adding new hardcoded values.
- **[ui.css](ui.css) + [ui-shell.js](ui-shell.js) are the v2 design system (2026-10)** and load *after* `styles.css` on all 34 pages: tokens, surfaces, buttons/fields/badges/tables, the app bar, bottom nav, ⌘K command palette (Arabic fuzzy match), notifications inbox, toast v2, confirm dialogs, and preference keys (`farm_theme|farm_density|farm_contrast|farm_motion`). The public surface is `window.UIShell` (`Shell2` in source); pages opt in through `renderNavbarV2()` and `data-ui-table`/`data-ui-filter` attributes. Contracts, palette scoring and the shell's literal dimensions are specified in `docs/design/UI-SYSTEM.md` and asserted by unit suites 23/24 — change the doc and the test together, or the build goes red. Inside `ui-shell.js`, `doc` is a **function** (`doc()` returns `document`).

### AI assistant — two independent paths
- [assistant.html](assistant.html) calls **Google Gemini** directly from the browser, using a user-supplied key in `localStorage['farm_gemini_key']`. Its actual write logic lives in `executeAction()`, not the similarly-named `showConfirmation()` (which only builds the confirmation UI) — a documented, easy-to-repeat mistake if you test the wrong one.
- [api/claude.js](api/claude.js) proxies to the **Anthropic API** via a Vercel serverless function, keeping `ANTHROPIC_API_KEY` server-side (set in Vercel env vars). This is the only server-side code in the main app. A duplicate, misplaced copy (`chat.js`) previously sat at the repository root — it was outside `/api/` so Vercel would never have deployed it and nothing referenced it; it has since been deleted as part of the 2026-08-23 structure cleanup. A separate copy still exists inside `farm-apk/www/`, a distinct deployment context not covered by this note.

### farm-react.js (isolated exception)
[farm-react.js](farm-react.js) is a large **pre-bundled, minified** React blob loaded lazily by only `reports.html` and `settings.html` for advanced charts, exposed as `window.FarmReact`. It is the one non-vanilla island — do not hand-edit the minified output; the rest of the app is framework-free and should stay that way.

## Engineering Rules (This Repository's Certified Discipline)

- **SSOT:** Weight (`animals/{animalId}/weights`) and Birth (`breeding` + `animals` via `createOffspringAnimal()`) are certified single-sources-of-truth — see `docs/certification/`. Do not modify without the same evidentiary rigor that produced them.
- **Modal lifecycle:** every modal-driven write must read its own form fields *before* calling `closeModal()` — the confirmed root cause of at least 5 independent historical bugs.
- **One atomic task, one reversible commit, real runtime verification, then stop.** This discipline produced every certified subsystem in this repository.
- **Never assume validation exists** where you haven't confirmed it by reading the actual function — native HTML input types (`type="date"`, `type="number"`) are relied on for real validation in several places, deliberately, not by omission.
- **Always go through the `fb*` helpers** for data access so caching, cache-invalidation, and offline queuing stay consistent — don't `fetch` the RTDB URL directly.
- **Firebase config is committed** in both [config.js](config.js) and [firebase.js](firebase.js) (client keys, expected for a Firebase web app). If you change one, keep them in sync.
- **RTL + Arabic first.** Render numbers through `ar()` where existing pages do; keep the RTL layout intact.
- **After destructive/meaningful writes, call `logActivity(...)`** to keep the activity log complete.

## Documentation Map

| Need | Read |
|---|---|
| First orientation, any session | This file, then `docs/repository/REPOSITORY_CHARTER.md` |
| Full architecture, all three engineering threads | `docs/architecture/` |
| Weight or Birth subsystem specifics | `docs/certification/WEIGHT.md` / `BIRTH.md` |
| Modal-lifecycle rules | `docs/certification/MODAL_LIFECYCLE.md` |
| Double-entry accounting engine (journal entries, financial statements, reconciliation, etc. — separate from the simple `finance` collection covered under Finance docs above) | `docs/certification/ACCOUNTING-ENGINE.md` |
| Task automation, Weight/Health/Production Intelligence, or the Unified Decision Engine (Sprints 1-6) | `docs/features/` -- start with `docs/features/EXECUTIVE-DASHBOARD.md` for how they surface, or the specific `*-ANALYSIS.md`/`*-INTELLIGENCE.md` pair for the domain you're touching |
| What's decided vs. still open | `docs/decisions/INDEX.md`, `docs/backlog/OPEN_DECISIONS.md` |
| What's safe to work on next | `docs/backlog/VERIFIED_BACKLOG.md` |
| Every known conflict/limitation | `docs/repository/RISK_REGISTER.md` |
| Historical security regression context | `MIGRATION-CHECKLIST.md` (repo root) |
| Full source-document traceability | `docs/archive/ARTIFACT_MAPPING.md` |

## Context Loading Instructions

For a focused task, read only: this file, `docs/repository/REPOSITORY_CHARTER.md`, and whichever single certification/decision document matches the subsystem you're touching. Do not read the entire `docs/` tree for a small task — it's organized so you don't have to.
