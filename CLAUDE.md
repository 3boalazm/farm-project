# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**This is the canonical, merged version — combining a pre-existing technical architecture overview with this repository's later `/docs` knowledge base (architecture certifications, decision records, backlog). If you need depth beyond this file, `docs/repository/REPOSITORY_CHARTER.md` is the next stop.**

## What This Is

**بيان المزرعة (Bayan Farm)** — an Arabic (RTL), offline-capable farm/livestock management PWA for goats and sheep. It is a **vanilla, buildless multi-page app**: plain HTML + global-scoped JavaScript loaded via `<script src>` tags, talking to Firebase Realtime Database over its REST API. There is **no bundler, no framework, no npm install** for the main app, and no build step — you edit files and they ship as-is. Deployed on Vercel.

All UI text, comments, and many identifiers are in Arabic. Preserve Arabic strings exactly.

## Commands

There is no build/lint/test tooling for the main web app. To work on it:

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
- `getUser()/setUser()/logout()/requireAuth()` — auth state lives in `localStorage['farm_user']`.
- `can(perm)` — permission check used throughout nav and pages. Roles and their allowed perms are `ROLES` + `ROLE_PERMS`; a user may also carry `custom_perms`. Admin bypasses all checks. **Not every page enforces this consistently — several pages (`cost.html` confirmed, as of this merge) grant a nav permission without an actual `can()` gate. Verify per-page before assuming enforcement.**
- `logActivity(action, resource, description)` — audit log; call after meaningful writes (existing pages do). Writes universally; the intended viewer page's own status is documented in `docs/repository/RISK_REGISTER.md`.
- Arabic helpers: `ar(n)` (Western→Arabic-Indic digits), `todayStr()` (returns **UTC**, not local date — a confirmed, proven bug affecting a fixed daily window for non-UTC-0 users, see `docs/certification/WEIGHT.md`), `genId()`.

### Auth is layered and deliberately best-effort
Primary auth is a **custom PIN pad**, not Firebase Auth. On top of it two migrations coexist (both documented inline in [firebase.js](firebase.js)):
1. **PIN hashing** — `hashPin()` (SHA-256, salted by user id) replaces plaintext PIN storage. Legacy plaintext accounts are matched the old way once, then silently upgraded — no manual migration step.
2. **Firebase Auth bridge** — `signInWithFirebaseAuth()` silently signs each app user into a synthetic email/password Firebase account (`u_<id>@bayan-farm.internal`) to get a real `auth.uid` and server-side rate limiting. It is **fail-safe**: if email/password sign-in isn't enabled in the Firebase Console, every call fails quietly and the app keeps working on PIN-hash auth alone. Do not turn these into hard dependencies.
3. **Admin PIN bootstrap:** a fallback (`lPin==='1234'`) is correctly scoped to `users.length===0` (empty-database bootstrap only) — verify this guard is present before assuming it's safe; a version without the guard is a confirmed, real backdoor (see `MIGRATION-CHECKLIST.md` for the exact historical regression this was recovered from).

Because primary auth isn't Firebase Auth, [database.rules.json](database.rules.json) enforces **data validation only** (types, required fields), not per-user access control — the security model relies on the database URL not being public (a Vercel environment variable) rather than rule-based enforcement. A stricter `database.rules.secure.json` may exist as a drafted-but-not-deployed alternative — confirm its presence directly, don't assume either way (see `docs/backlog/OPEN_DECISIONS.md`).

### Offline / PWA
- [sw.js](sw.js) (service worker) uses per-resource caching strategies: cache-first for CDN assets, stale-while-revalidate for HTML/JS/CSS, and network-first-with-cache-fallback for Firebase GETs (offline reads return cached data tagged with an `X-Farm-Cache` header, or `[]` if nothing cached). **Formally determined Experimental/Disabled as of baseline hardening: the implementation is complete and correct, and `sw-register.js` (a complete, correct registration + admin recovery-tools implementation) exists, but neither is wired into any live page — `navigator.serviceWorker.register()` is never called anywhere in the current baseline. This is a deliberate, documented state, not an oversight; activating it is a feature decision outside this baseline's scope.**
- [offline-sync.js](offline-sync.js) (`FarmOfflineSync`) queues writes in **IndexedDB** while offline and replays them (POST/PATCH/PUT/DELETE) when the connection returns. This is a real, distinct mechanism from the APK file-sync tooling (`tools/sync-apk/`, referenced in archived documentation, not confirmed present in this repository) and from `sync.js` (a species/breed reconciliation utility, likely related to the `diary_snapshot` feature — not independently confirmed as the same mechanism).

### Shared UI — [shared.js](shared.js), [nav.js](nav.js)
- [shared.js](shared.js) holds all reusable UI: `toast()`, `showModal()/closeModal()`, `renderFarmModal()`, KPI/section/header components (see [COMPONENTS.md](COMPONENTS.md)), status badges, and Arabic date/number formatting. It is loaded on every page. It also houses the canonical Birth helper, `createOffspringAnimal()` (see Engineering Rules below), and five decision-support engines added across Sprints 1-6 -- `autoGenerateTask()` (automation), `evaluateWeightAlert()`, `evaluateHealthRisk()`, `evaluateProductionKPIs()`, and `evaluateOperationalPriority()` (a pure composition layer over the other four, never recalculating their outputs). Full architecture, contracts, and design rationale for all five are in `docs/features/` -- start with `docs/features/UNIFIED-DECISION-ENGINE.md` for the composition layer, or `docs/features/INTELLIGENCE-CONTRACTS.md` for every engine's exact input/output shape.
- [nav.js](nav.js) defines the sidebar as the `FARM_NAV` data structure; `buildSidebarNav()` renders it, filtering each item by its `perm` through `can()`. Edit `FARM_NAV` to change the menu.
- [styles.css](styles.css) is a single global stylesheet built on a 3-tier CSS-variable token system (raw → semantic → component). See [DESIGN-TOKENS.md](DESIGN-TOKENS.md) for the type/spacing/radius/color scales — reuse tokens rather than adding new hardcoded values.

### AI assistant — two independent paths
- [assistant.html](assistant.html) calls **Google Gemini** directly from the browser, using a user-supplied key in `localStorage['farm_gemini_key']`. Its actual write logic lives in `executeAction()`, not the similarly-named `showConfirmation()` (which only builds the confirmation UI) — a documented, easy-to-repeat mistake if you test the wrong one.
- [api/claude.js](api/claude.js) proxies to the **Anthropic API** via a Vercel serverless function, keeping `ANTHROPIC_API_KEY` server-side (set in Vercel env vars). This is the only server-side code in the main app. **A duplicate, misplaced copy (`chat.js`) previously sat at the repository root — removed during baseline hardening; it was outside `/api/` so Vercel would never have deployed it, and nothing referenced it. A separate copy still exists inside `farm-apk/www/`, a distinct deployment context not covered by this note.**

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
| Task automation, Weight/Health/Production Intelligence, or the Unified Decision Engine (Sprints 1-6) | `docs/features/` -- start with `docs/features/EXECUTIVE-DASHBOARD.md` for how they surface, or the specific `*-ANALYSIS.md`/`*-INTELLIGENCE.md` pair for the domain you're touching |
| What's decided vs. still open | `docs/decisions/INDEX.md`, `docs/backlog/OPEN_DECISIONS.md` |
| What's safe to work on next | `docs/backlog/VERIFIED_BACKLOG.md` |
| Every known conflict/limitation | `docs/repository/RISK_REGISTER.md` |
| Historical security regression context | `MIGRATION-CHECKLIST.md` (repo root) |
| Full source-document traceability | `docs/archive/ARTIFACT_MAPPING.md` |

## Context Loading Instructions

For a focused task, read only: this file, `docs/repository/REPOSITORY_CHARTER.md`, and whichever single certification/decision document matches the subsystem you're touching. Do not read the entire `docs/` tree for a small task — it's organized so you don't have to.
