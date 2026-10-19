# UNIT-LAYER.md — the module-by-module unit test layer

Added by the 2026-10 comprehensive audit (`docs/audit/FULL-AUDIT-2026-10.md`). This is the layer **underneath** the Playwright browser suites: it boots the *real* application scripts and exercises each domain module directly, in Node, with no browser binary and no network.

```bash
npm run test:unit                 # all 22 modules (~5s)
node tests/unit/run.js 12         # one module (substring match on the suite name)
FARM_TZ=UTC npm run test:unit     # the same suite from the other side of the timezone bug
npm run test:all                  # unit layer, then the Playwright browser suites
```

## Why it exists

The browser suites in `tests/smoke`, `tests/ssot`, `tests/permissions`, `tests/data-integrity` and `tests/regression` are the integration layer, and they are the right layer for "does the page work". They cannot run at all without a downloaded Chromium, and they cannot reach the ~120 service functions in `shared.js` that no page exercises directly (the accounting engine, the forecasting engines, the inventory costing layer). Every one of the 27 findings in the 2026-10 audit was found or proven by this layer.

## How it works

`tests/unit/harness.js` builds a jsdom window and runs the app's own scripts into it with `vm.runInContext`, in the real load order:

```
config.js → firebase.js → nav.js → shared.js   (+ notifications-service.js where a suite asks for it)
```

Nothing is stubbed except the outside world:

* **`window.fetch`** is an in-memory Firebase Realtime Database implementing the REST contract the app actually uses — `GET` (object-map → array with `_id`), `POST` (returns `{name}`), `PUT`, `PATCH`, `DELETE`, nested paths (`animals/{id}/weights`), and the **query** parameters the app depends on (`orderBy="tag"&equalTo=…` for tag generation, `orderBy="$key"` with `limitToLast`/`startAt`/`endAt` for the diary snapshots). Google auth endpoints are answered as auth, so they never pollute the data tree.
* **Failure injection:** `bootApp({db:{failMode:'network'}})` makes every request throw (offline), `'offline'` fails writes only, and a function form can return any `Response` (401/403/500) per method and path. This is how the audit proved the admin-reset and login-backdoor bugs.
* **`crypto.subtle`** comes from Node's WebCrypto so `hashPin()` really hashes.
* **Navigation** is not possible in jsdom; attempts are captured (`app.navigations`) so `requireAuth()`/`logout()` redirects are still assertable.
* **`J(value)`** round-trips a value out of the vm so `assert.deepStrictEqual` compares data, not cross-realm prototypes.

Every suite gets a fresh app; `db.reset(seed)` reseeds and `app.eval('fbCacheInvalidate()')` drops the 45-second read cache (which lives in `sessionStorage` and otherwise survives between tests in one booted app).

## Timezone

`tests/unit/run.js` sets `process.env.TZ = process.env.FARM_TZ || 'Africa/Cairo'` **before** anything loads. This is not cosmetic: the largest single finding of the audit was ~36 sites deriving local calendar keys from `toISOString()` (UTC), which is silently correct at TZ=UTC and silently wrong at UTC+3 — `new Date(2026,9,1).toISOString().slice(0,7)` is `'2026-09'` in Cairo. Running the suite in the farm's real timezone is what makes `tests/unit/05` meaningful; `FARM_TZ=UTC` shows the other side.

## The modules

| Suite | Module under test |
|---|---|
| 01 | core utilities — `ar`, `pad2`, `todayStr`, `genId`, `escapeHtml`, `escapeJsAttr`, `getSettings` |
| 02 | auth & permissions — `can`, `canWrite`, `ROLE_PERMS`, `hashPin`, `requireAuth`, `logout`, `Users.init` |
| 03 | data layer — `fbGet/One/Single/Safe`, cache TTL & invalidation, `fbPost/Put/Patch/Delete`, `logActivity`, 401 handling |
| 04 | undo history — capture policy, reversal of create/edit/delete, stack cap, machine-write exclusions |
| 05 | local-calendar date helpers — the UTC bug class, end to end |
| 06 | livestock lifecycle — age in months, life stage, production purpose, mortality-correction markers, breed aliases |
| 07 | weight service (SSOT) — the `current_weight == newest record` invariant, validation, migration |
| 08 | animal status service — the state machine, bulk operations, finance side-effects |
| 09 | birth SSOT — tag generation & uniqueness, `createOffspringAnimal`, `_ubSubmit` |
| 10 | finance service & KPIs |
| 11 | accounting core — chart of accounts, journal validation, reversal, trial balance, P&L, balance sheet, ledger |
| 12 | source documents, AR/AP, cash & bank, reconciliation |
| 13 | inventory ledger, named operations, weighted-average cost, inventory accounting |
| 14 | fiscal periods, month-end close, audit trail, integrity, data quality, cash flow, budgets, forecasts, legacy migration |
| 15 | analytics engine (incl. a proof that it never writes) |
| 16 | weight/health/production alerts, task automation, forecasting, insights |
| 17 | notifications — bell badge, dropdown, popup, and the standalone service |
| 18 | render helpers & the escaping contract (trusted markup vs. data) |
| 19 | navigation rail, theme, page bootstrap |
| 20 | genealogy & herd integrity tools, diary snapshots |
| 21 | costing, fixed assets, loans, owner equity, profitability |
| 22 | repository invariants — nav targets exist and are gated, every collection is declared in `database.rules.json`, no UTC date keys, script-chain order, HTML balance, no duplicate object keys, no `eval`, no committed secrets, APK copy in sync, CI wiring, safety scan green |

## Adding a test

1. Create `tests/unit/NN-your-module.suite.js` exporting `suite('NN · Name', ({test}) => { … })`.
2. Boot once in the first test (`app = await bootApp()`), reseed per test, and call into the app with `app.eval('(async()=>await someService(…))()')`.
3. Wrap cross-realm results in `J(...)` before `deepStrictEqual`.
4. If the module writes, assert **what was written** (`db.data`, `db.collection('x')`) and not just the return value — and assert that a rejected call wrote nothing.

Two conventions this layer holds itself to, because both were needed to find real bugs:

* A test that asserts on a *filtered* read must say so — `db.log` records every request, which is how "analytics never writes" and "no `PUT users/admin1` while offline" are proven.
* Fire-and-forget writes (`_recordFinancialAudit`, `NS.save`, `autoGenerateTask` from an alert evaluation) need a tick (`await new Promise(r=>setTimeout(r,60))`) before asserting; they are deliberately not awaited by the app.
