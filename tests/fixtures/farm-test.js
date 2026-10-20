// tests/fixtures/farm-test.js
//
// O-19 (docs/audit/FULL-AUDIT-2026-10.md) — THE BROWSER SUITE HAS NEVER BEEN
// HERMETIC. All 55 specs imported @playwright/test directly and served the app
// from a static server, which means every page that ran `initApp()`,
// `Users.init()` or the anonymous-auth bootstrap in `firebase.js` opened a real
// socket to `farm-mz99-default-rtdb.europe-west1.firebasedatabase.app` and to
// `identitytoolkit.googleapis.com`. The specs mostly survive that because they
// monkey-patch `window.fbGet/fbPost/...` inside `page.evaluate()` — but the
// patches land *after* boot, so the boot traffic still goes out: the suite
// reads (and writes: the anonymous `accounts:signUp`, the `Users.init()` GET)
// the production project, and it fails outright whenever CI has no route to
// Google. A green run therefore proved "the app works against the live
// database", which is exactly the thing a regression suite should not depend
// on.
//
// This fixture makes the whole suite hermetic without rewriting it:
//
//   const { test, expect } = require('../fixtures/farm-test');   // was '@playwright/test'
//
// Every request the app makes to the RTDB REST endpoint or to Google's auth
// APIs is intercepted at the browser-context level and served by the SAME
// in-memory fake that the unit layer uses (tests/unit/harness.js), so a spec
// that asserts on `fbGet('animals')` and a unit test that asserts on
// `fbGet('animals')` cannot disagree about what the backend does. Nothing else
// changes: existing monkey-patches keep working (they replace the functions
// after load), static assets and CDNs are untouched, and `page`/`context`/
// `request` fixtures behave normally.
//
// Extra fixtures available to any spec that wants them:
//   farm      the fake backend (farm.db.data, farm.db.collection('animals'),
//             farm.db.log, farm.db.reset(seed), farm.auth)
//   farmPage  a page whose localStorage already holds a session, so a spec can
//             start logged in as a specific role without hand-rolling JSON
const { test: base, expect } = require('@playwright/test');
const { createFakeDb, createFakeAuth } = require('../unit/harness');

// Anything the app talks to on the backend. Deliberately host-suffix based so
// a future region or a second Firebase project is still intercepted.
const BACKEND = /(firebasedatabase\.app|firebaseio\.com|googleapis\.com)/;

/** A farm with a few animals, one user per role and a settings record. */
function defaultSeed() {
  return {
    settings: { farmName: 'مزرعة الاختبار', ownerName: 'QA', currency: 'ج.م', fiscalYearStartMonth: 1 },
    users: {
      admin1: { id: 'admin1', name: 'مدير', role: 'admin', active: true },
      sup1: { id: 'sup1', name: 'مشرف', role: 'supervisor', active: true },
      vet1: { id: 'vet1', name: 'طبيب', role: 'vet', active: true },
      w1: { id: 'w1', name: 'عامل', role: 'worker', active: true },
      v1: { id: 'v1', name: 'زائر', role: 'visitor', active: true },
    },
    user_directory: {
      admin1: { id: 'admin1', name: 'مدير', role: 'admin', active: true, has_pin: true, photo: '' },
    },
    animals: {
      a1: { id: 'a1', type: 'cows', breed: 'هولشتاين', tag: 'GT-1', status: 'active', birthDate: '2024-01-10', barnId: 'b1' },
      a2: { id: 'a2', type: 'goats', breed: 'شامي', tag: 'GT-2', status: 'active', birthDate: '2024-03-02', barnId: 'b1' },
    },
    barns: { b1: { id: 'b1', name: 'حظيرة ١', type: 'cows' } },
  };
}

/** Build a fake backend: in-memory RTDB + fake Identity Toolkit. */
function makeFarm(options = {}) {
  const auth = createFakeAuth(options.auth || {});
  const db = createFakeDb({
    seed: options.seed ? JSON.parse(JSON.stringify(options.seed)) : defaultSeed(),
    authApi: auth.handler,
  });
  return {
    db, auth,
    get data() { return db.data; },
    collection: (n) => db.collection(n),
    /** Every backend call a spec's page made, in order. */
    requests: () => db.log.map((l) => `${l.method} ${l.parts}`),
  };
}

/**
 * Serve every backend request from `farm`. Attached to the browser *context*,
 * so pages opened later (window.open, <a target=_blank>) are covered too.
 */
async function interceptBackend(context, farm) {
  await context.route(BACKEND, async (route) => {
    const req = route.request();
    let status = 200;
    let body = 'null';
    try {
      const res = await farm.db.fetch(req.url(), { method: req.method(), body: req.postData() || undefined });
      status = res.status;
      body = await res.text();
    } catch (e) {
      status = 500;
      body = JSON.stringify({ error: { message: String((e && e.message) || e) } });
    }
    try { await route.fulfill({ status, contentType: 'application/json', body }); } catch (e) { /* route already closed */ }
  });
  return farm;
}

const test = base.extend({
  farm: async ({}, use) => { await use(makeFarm()); },

  // Overriding `context` (not `page`) is what makes this automatic: Playwright
  // builds its `page` fixture from `context`, so every spec that asks for
  // `page` — which is all of them — gets an intercepted backend.
  context: async ({ context, farm }, use) => { await interceptBackend(context, farm); await use(context); },

  /** A page with a session already in localStorage. Usage:
   *    const page = await farmPage({ role: 'vet' });  */
  farmPage: async ({ page, farm }, use) => {
    await use(async (opts = {}) => {
      const role = opts.role || 'admin';
      const id = opts.id || (role === 'admin' ? 'admin1' : role.slice(0, 1) + '1');
      const rec = (farm.db.data.users && farm.db.data.users[id]) || { id, name: role, role, active: true };
      await page.evaluate((u) => {
        localStorage.setItem('farm_user', JSON.stringify(u));
      }, rec);
      return page;
    });
  },
});

module.exports = { test, expect, makeFarm, interceptBackend, defaultSeed, BACKEND };
