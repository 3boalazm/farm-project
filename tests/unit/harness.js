// tests/unit/harness.js
//
// Node + jsdom harness that boots the REAL application scripts
// (config.js -> firebase.js -> nav.js -> shared.js) inside a DOM, with
// an in-memory Firebase RTDB standing in for the network. This lets the
// domain modules be unit-tested one-by-one without a browser.
//
// Playwright's browser binaries cannot be downloaded in this sandbox, so
// the existing browser suites (tests/smoke, tests/ssot, ...) stay as the
// integration layer; this harness is the unit layer underneath them.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.resolve(__dirname, '..', '..');

// ── In-memory Firebase RTDB (REST semantics) ───────────────────
// Mirrors the real REST contract used by firebase.js:
//   GET  /{path}.json          -> object map | null
//   POST /{path}.json          -> { name: <newKey> }
//   PUT  /{path}/{id}.json     -> replaces
//   PATCH /{path}/{id}.json    -> shallow-merges
//   DELETE /{path}/{id}.json   -> null
function createFakeDb({ failMode = null, seed = {}, authApi = null } = {}) {
  let data = JSON.parse(JSON.stringify(seed));
  const log = [];
  let counter = 0;

  const deep = (obj, parts) => {
    let cur = obj;
    for (const p of parts) {
      if (cur == null) return undefined;
      cur = cur[p];
    }
    return cur;
  };
  const ensure = (obj, parts) => {
    let cur = obj;
    for (const p of parts) {
      if (typeof cur[p] !== 'object' || cur[p] === null) cur[p] = {};
      cur = cur[p];
    }
    return cur;
  };

  function parseUrl(url) {
    const u = new URL(url);
    const parts = u.pathname.replace(/^\/+|\/+$/g, '').replace(/\.json$/, '').split('/').filter(Boolean);
    return { parts, query: u.searchParams };
  }

  async function fetchImpl(url, opts = {}) {
    const method = (opts.method || 'GET').toUpperCase();
    // Firebase Auth REST endpoints (identitytoolkit / securetoken) are NOT
    // database paths — answering them from the data tree would both fail the
    // app's auth bootstrap and pollute the fake database with a bogus
    // "v1/accounts:signUp" node.
    if (/googleapis\.com/.test(url)) {
      // A test may script the auth endpoints (see createFakeAuth below); the
      // default answer stays "everything succeeds" so older suites that only
      // care about the data plane are unaffected.
      if (typeof authApi === 'function') {
        const scripted = await authApi(url, opts);
        if (scripted) return scripted;
      }
      return new Response(JSON.stringify({
        idToken: 'fake-id-token', refreshToken: 'fake-refresh-token', localId: 'uid-test',
        expiresIn: '3600', access_token: 'fake-id-token', user: { localId: 'uid-test' },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    const { parts } = parseUrl(url);
    log.push({ method, parts: parts.join('/'), body: opts.body ? JSON.parse(opts.body) : null });

    if (failMode === 'network') throw new TypeError('Failed to fetch');
    if (failMode === 'offline' && method !== 'GET') throw new TypeError('Failed to fetch');
    if (typeof failMode === 'function') {
      const r = failMode(method, parts.join('/'), opts.body);
      if (r) return r;
    }

    const json = (v, status = 200) => new Response(JSON.stringify(v), {
      status, headers: { 'Content-Type': 'application/json' },
    });

    if (method === 'GET') {
      const v = deep(data, parts);
      if (v === undefined || v === null) return json(null);
      // Real Firebase REST query support -- the app depends on it:
      // generateAnimalTag()/isTagTaken() query animals.json?orderBy="tag"&equalTo=...,
      // and the diary snapshot readers use orderBy="$key" with limitToLast/startAt/endAt.
      const q = parseUrl(url).query;
      if (!q.has('orderBy') && !q.has('startAt') && !q.has('endAt') && !q.has('equalTo')) return json(v);
      let out = Object.assign({}, v);
      const orderRaw = q.get('orderBy');
      const orderField = orderRaw ? orderRaw.replace(/^"|"$/g, '') : null;
      const valOf = (key, node) => (orderField === '$key' ? key : (orderField === '$value' ? node : (node && node[orderField])));
      let keys = Object.keys(out);
      if (orderField) {
        keys.sort((a, b) => {
          const va = valOf(a, out[a]), vb = valOf(b, out[b]);
          if (va === vb) return a < b ? -1 : 1;
          if (va === undefined || va === null) return -1;
          if (vb === undefined || vb === null) return 1;
          return va < vb ? -1 : 1;
        });
      }
      if (q.has('equalTo')) {
        const want = JSON.parse(q.get('equalTo'));
        keys = keys.filter((k) => valOf(k, out[k]) === want);
      }
      if (q.has('startAt')) {
        const from = JSON.parse(q.get('startAt'));
        keys = keys.filter((k) => valOf(k, out[k]) !== undefined && valOf(k, out[k]) !== null && valOf(k, out[k]) >= from);
      }
      if (q.has('endAt')) {
        const to = JSON.parse(q.get('endAt'));
        keys = keys.filter((k) => valOf(k, out[k]) !== undefined && valOf(k, out[k]) !== null && valOf(k, out[k]) <= to);
      }
      if (q.has('limitToLast')) keys = keys.slice(-parseInt(q.get('limitToLast'), 10));
      if (q.has('limitToFirst')) keys = keys.slice(0, parseInt(q.get('limitToFirst'), 10));
      const filtered = {};
      keys.forEach((k) => { filtered[k] = out[k]; });
      return json(Object.keys(filtered).length ? filtered : null);
    }
    if (method === 'POST') {
      const parent = ensure(data, parts);
      const key = 'k' + (++counter) + Date.now().toString(36).slice(-3);
      parent[key] = opts.body ? JSON.parse(opts.body) : null;
      return json({ name: key });
    }
    if (method === 'PUT') {
      const parent = ensure(data, parts.slice(0, -1));
      parent[parts[parts.length - 1]] = opts.body ? JSON.parse(opts.body) : null;
      return json(parent[parts[parts.length - 1]]);
    }
    if (method === 'PATCH') {
      const parent = ensure(data, parts.slice(0, -1));
      const key = parts[parts.length - 1];
      parent[key] = Object.assign({}, parent[key] || {}, opts.body ? JSON.parse(opts.body) : {});
      return json(parent[key]);
    }
    if (method === 'DELETE') {
      const parent = deep(data, parts.slice(0, -1));
      if (parent) delete parent[parts[parts.length - 1]];
      return json(null);
    }
    return json(null, 405);
  }

  return {
    fetch: fetchImpl,
    log,
    get data() { return data; },
    set data(v) { data = v; },
    collection(name) { return Object.entries(data[name] || {}).map(([id, v]) => ({ ...v, _id: id })); },
    node(parts) { return deep(data, String(parts).split('/').filter(Boolean)); },
    reset(seed2 = {}) { data = JSON.parse(JSON.stringify(seed2)); log.length = 0; },
  };
}

// ── In-memory Firebase Auth (Identity Toolkit REST) ────────────
// firebase.js talks to accounts:signInWithPassword / accounts:signUp and to
// securetoken. The auth surface is now security-critical (the bridge is what
// proves who a session is), so tests need to script it: a disabled provider,
// an unknown account, a wrong password, an existing account. This is a small
// but faithful fake — same endpoint names, same error strings Firebase uses.
function createFakeAuth(options = {}) {
  const state = {
    providerEnabled: options.providerEnabled !== false,
    accounts: Object.assign({}, options.accounts || {}),   // email -> { password, localId }
    calls: [],
    anon: 0,
  };
  const json = (v, status = 200) =>
    new Response(JSON.stringify(v), { status, headers: { 'Content-Type': 'application/json' } });
  const fail = (message, status = 400) =>
    json({ error: { code: status, message, status: 'INVALID_ARGUMENT' } }, status);
  const uidFor = (email) => 'uid-' + String(email).replace(/[^a-z0-9]+/gi, '-');

  async function handler(url, opts = {}) {
    let body = {};
    try { body = opts.body ? JSON.parse(opts.body) : {}; } catch (e) { body = {}; }
    const m = /accounts:(\w+)/.exec(url);
    const name = m ? m[1] : (/securetoken/.test(url) ? 'refresh' : 'unknown');
    state.calls.push({ name, email: body.email || null, password: body.password || null, url });

    if (name === 'refresh') {
      const rt = String(body.refresh_token || '');
      const localId = rt.replace(/^ref-/, '') || 'uid-test';
      return json({ id_token: 'tok-' + localId, refresh_token: rt, user_id: localId, expires_in: '3600' });
    }
    if (!state.providerEnabled) {
      return fail('OPERATION_NOT_ALLOWED : Password sign-in is disabled for this project.');
    }
    if (name === 'signUp') {
      if (!body.email) {                                     // anonymous sign-in
        const localId = 'anon-' + (++state.anon);
        return json({ idToken: 'tok-' + localId, refreshToken: 'ref-' + localId, localId, expiresIn: '3600' });
      }
      if (state.accounts[body.email]) return fail('EMAIL_EXISTS : The email address is already in use.');
      const localId = uidFor(body.email);
      state.accounts[body.email] = { password: body.password, localId };
      return json({ idToken: 'tok-' + localId, refreshToken: 'ref-' + localId, localId, email: body.email, expiresIn: '3600' });
    }
    if (name === 'signInWithPassword') {
      const acc = body.email && state.accounts[body.email];
      if (!acc) return fail('EMAIL_NOT_FOUND : There is no user record corresponding to this identifier.');
      if (acc.password !== body.password) {
        return fail('INVALID_LOGIN_CREDENTIALS : The supplied credential is incorrect.');
      }
      return json({ idToken: 'tok-' + acc.localId, refreshToken: 'ref-' + acc.localId, localId: acc.localId, email: body.email, expiresIn: '3600' });
    }
    return json({ idToken: 'fake-id-token', refreshToken: 'fake-refresh-token', localId: 'uid-test', expiresIn: '3600' });
  }

  return { handler, state, uidFor };
}

// ── Boot the real app scripts into a jsdom window ──────────────
async function bootApp(options = {}) {
  const db = createFakeDb(Object.assign({}, options.db || {}, {
    failMode: options.failMode !== undefined ? options.failMode : (options.db || {}).failMode,
    authApi: options.auth ? options.auth.handler : (options.db || {}).authApi,
  }));
  if (options.seedUsers !== false) {
    db.data.users = db.data.users || {
      admin1: { id: 'admin1', name: 'مدير المزرعة', role: 'admin', pin_hash: 'x', active: true, created: '2026-01-01' },
    };
  }
  // jsdom cannot navigate; it reports the attempt as a jsdomError. Capturing
  // those lets the auth tests assert "redirected to login.html" without a
  // real browser (window.location is non-configurable in jsdom).
  const navigations = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (e) => {
    if (/navigation/i.test(e.message)) navigations.push(e.message);
  });

  const dom = new JSDOM(
    `<!DOCTYPE html><html lang="ar" dir="rtl"><head></head>
     <body><div id="content"></div><div id="page-header"></div></body></html>`,
    { url: 'http://localhost:8080/dashboard.html', pretendToBeVisual: true, runScripts: 'outside-only', virtualConsole }
  );
  const { window } = dom;

  // Browser APIs the app touches that jsdom lacks / we want silent.
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
  window.AbortSignal = window.AbortSignal || { timeout: () => ({}) };
  window.Response = Response;
  window.Headers = Headers;
  window.Request = Request;
  window.fetch = db.fetch;
  window.navigator.sendBeacon = () => true;
  window.confirm = () => true;
  window.alert = () => {};
  window.print = () => {};
  window.scrollTo = () => {};
  window.indexedDB = undefined; // offline-sync is not loaded by this harness
  const consoleErrors = [];
  window.console = Object.assign({}, console, {
    error: (...a) => consoleErrors.push(a.map(String).join(' ')),
    warn: (...a) => consoleErrors.push('WARN ' + a.map(String).join(' ')),
  });

  // A real, working Web Crypto (jsdom has none) — firebase.js's hashPin
  // depends on crypto.subtle.
  const nodeCrypto = require('crypto');
  Object.defineProperty(window, 'crypto', {
    value: { subtle: nodeCrypto.webcrypto.subtle, getRandomValues: (b) => nodeCrypto.webcrypto.getRandomValues(b) },
    configurable: true,
  });

  // Seed the client-side session BEFORE any app script runs (the app
  // reads localStorage['farm_user'] at load time).
  if (options.user !== null) {
    window.localStorage.setItem('farm_user', JSON.stringify(
      options.user || { id: 'admin1', name: 'مدير المزرعة', role: 'admin', active: true }
    ));
  }
  if (options.settings) window.localStorage.setItem('farm_settings', JSON.stringify(options.settings));

  const ctx = vm.createContext(window);
  const files = options.files || ['config.js', 'firebase.js', 'nav.js', 'shared.js'];
  for (const rel of files) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    try {
      vm.runInContext(src, ctx, { filename: rel });
    } catch (e) {
      throw new Error(`Loading ${rel} threw: ${e.message}\n${e.stack}`);
    }
  }

  // Let the fire-and-forget initApp()/auth bootstrap settle.
  await new Promise((r) => setTimeout(r, options.settleMs ?? 30));

  return {
    window,
    db,
    consoleErrors,
    navigations,
    eval: (code) => vm.runInContext(code, ctx),
    async fn(name, ...args) { return vm.runInContext(`(async()=>await ${name}(...${JSON.stringify(args)}))()`, ctx); },
    close: () => dom.window.close(),
  };
}

// ── Tiny assertion helpers (dependency-free, node:assert based) ──
const assert = require('assert');

function suite(name, fn) {
  const tests = [];
  const test = (title, body) => tests.push({ title, body });
  fn({ test });
  return { name, tests };
}

async function runSuites(suites, { filter = '' } = {}) {
  let pass = 0, fail = 0;
  const failures = [];
  for (const s of suites) {
    if (filter && !s.name.includes(filter)) continue;
    process.stdout.write(`\n▌ ${s.name}\n`);
    for (const t of s.tests) {
      try {
        await t.body();
        pass++;
        process.stdout.write(`  ✓ ${t.title}\n`);
      } catch (e) {
        fail++;
        failures.push({ suite: s.name, title: t.title, error: e });
        process.stdout.write(`  ✗ ${t.title}\n      ${String(e.message).split('\n').slice(0, 6).join('\n      ')}\n`);
      }
    }
  }
  process.stdout.write(`\n${pass} passed, ${fail} failed\n`);
  if (fail) {
    process.stdout.write('\nFailures:\n');
    for (const f of failures) process.stdout.write(`  • [${f.suite}] ${f.title}\n`);
  }
  return { pass, fail, failures };
}

// Cross-realm normaliser: values returned from the vm are arrays/objects
// whose prototype lives in the OTHER realm, so assert.deepStrictEqual
// against a Node-realm literal fails on the prototype check even when the
// contents are identical. Round-tripping through JSON compares pure data.
const J = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v === null ? null : v)));

module.exports = { bootApp, createFakeDb, createFakeAuth, suite, runSuites, assert, ROOT, J };
