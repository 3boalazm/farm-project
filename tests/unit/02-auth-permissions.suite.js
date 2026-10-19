// Module 02 — Authentication & permission model (firebase.js)
const { bootApp, suite, assert } = require('./harness');

module.exports = suite('02 · Auth & permissions', ({ test }) => {
  let app;

  test('boots', async () => { app = await bootApp(); });

  test('getUser() returns null for missing AND for corrupt localStorage', () => {
    app.window.localStorage.removeItem('farm_user');
    assert.strictEqual(app.eval(`getUser()`), null);
    app.window.localStorage.setItem('farm_user', '{not json');
    assert.strictEqual(app.eval(`getUser()`), null, 'corrupt JSON must fail safe, not throw');
    app.window.localStorage.setItem('farm_user', JSON.stringify({ id: 'admin1', role: 'admin', name: 'م' }));
  });

  test('setUser()/getUser() round-trip', () => {
    app.eval(`setUser({id:'u9',name:'عامل',role:'worker',active:true})`);
    assert.strictEqual(app.eval(`getUser().role`), 'worker');
  });

  test('can() denies everything for an anonymous visitor (no session)', () => {
    app.window.localStorage.removeItem('farm_user');
    for (const p of ['dash', 'animals', 'health', 'finance', 'users', 'reports', 'bayan']) {
      assert.strictEqual(app.eval(`can(${JSON.stringify(p)})`), false, `${p} must be denied`);
    }
    app.window.localStorage.setItem('farm_user', JSON.stringify({ id: 'u9', role: 'worker' }));
  });

  test('admin role passes every permission', () => {
    app.eval(`setUser({id:'admin1',name:'مدير',role:'admin'})`);
    for (const p of ['dash', 'animals', 'health', 'vaccine', 'breeding', 'inventory', 'finance', 'reports', 'users', 'activity', 'bayan']) {
      assert.strictEqual(app.eval(`can(${JSON.stringify(p)})`), true, p);
    }
  });

  test('worker is blocked from health, vaccine, finance and users', () => {
    app.eval(`setUser({id:'w1',role:'worker'})`);
    assert.strictEqual(app.eval(`can('dash')`), true);
    assert.strictEqual(app.eval(`can('animals')`), true);
    assert.strictEqual(app.eval(`can('health')`), false);
    assert.strictEqual(app.eval(`can('vaccine')`), false);
    assert.strictEqual(app.eval(`can('finance')`), false);
    assert.strictEqual(app.eval(`can('users')`), false);
  });

  test('visitor is the narrowest role (dash, animals, bayan only)', () => {
    app.eval(`setUser({id:'v1',role:'visitor'})`);
    assert.deepStrictEqual(
      ['dash', 'animals', 'bayan', 'health', 'breeding', 'inventory', 'finance', 'reports', 'users', 'notifications']
        .map((p) => app.eval(`can(${JSON.stringify(p)})`)),
      [true, true, true, false, false, false, false, false, false, false]
    );
  });

  test('vet keeps health/breeding but never finance or inventory', () => {
    app.eval(`setUser({id:'vet1',role:'vet'})`);
    assert.strictEqual(app.eval(`can('health')`), true);
    assert.strictEqual(app.eval(`can('breeding')`), true);
    assert.strictEqual(app.eval(`can('finance')`), false);
    assert.strictEqual(app.eval(`can('inventory')`), false);
    assert.strictEqual(app.eval(`can('users')`), false);
  });

  test('supervisor is denied users/finance/activity only', () => {
    app.eval(`setUser({id:'s1',role:'supervisor'})`);
    assert.strictEqual(app.eval(`can('animals')`), true);
    assert.strictEqual(app.eval(`can('inventory')`), true);
    assert.strictEqual(app.eval(`can('finance')`), false);
    assert.strictEqual(app.eval(`can('users')`), false);
    assert.strictEqual(app.eval(`can('activity')`), false);
  });

  test('an unknown role is denied everything (fail-closed)', () => {
    app.eval(`setUser({id:'x1',role:'hacker'})`);
    assert.strictEqual(app.eval(`can('dash')`), false);
    assert.strictEqual(app.eval(`can('animals')`), false);
  });

  test("can('admin') is an ADMIN-ONLY guard for every non-admin role", () => {
    // Twenty call sites use can('admin') to gate destructive, admin-only
    // tools (mortality reset, bulk delete, record deletion, the audit log,
    // repairGenealogy). 'admin' is a ROLE, not a permission key, so it used
    // to fall through to the role predicate — and supervisor's predicate
    // ("everything except users/finance/activity") returned TRUE for it.
    for (const role of ['supervisor', 'vet', 'worker', 'visitor']) {
      app.eval(`setUser({id:'u1',role:${JSON.stringify(role)}})`);
      assert.strictEqual(app.eval(`can('admin')`), false, role + ' must not pass the admin-only guard');
    }
    app.eval(`setUser({id:'admin1',role:'admin'})`);
    assert.strictEqual(app.eval(`can('admin')`), true);
  });

  test("custom_perms can never mint an admin", () => {
    app.eval(`setUser({id:'c9',role:'supervisor',custom_perms:['admin','finance','users']})`);
    assert.strictEqual(app.eval(`can('admin')`), false, "an explicit 'admin' grant in custom_perms must be ignored");
    assert.strictEqual(app.eval(`can('finance')`), true, 'ordinary page grants still work');
    app.eval(`setUser({id:'admin1',role:'admin'})`);
  });

  test('custom_perms REPLACE the role defaults, they do not extend them', () => {
    app.eval(`setUser({id:'c1',role:'worker',custom_perms:['reports']})`);
    assert.strictEqual(app.eval(`can('reports')`), true, 'granted perm allowed');
    assert.strictEqual(app.eval(`can('dash')`), false, 'role default no longer applies once custom_perms is set');
  });

  test('admin bypasses custom_perms entirely', () => {
    app.eval(`setUser({id:'admin1',role:'admin',custom_perms:['reports']})`);
    assert.strictEqual(app.eval(`can('finance')`), true);
  });

  test('an empty custom_perms array denies everything for that user', () => {
    app.eval(`setUser({id:'c2',role:'admin',custom_perms:[]})`);
    // admin short-circuits before custom_perms — documents the real precedence
    assert.strictEqual(app.eval(`can('dash')`), true);
    app.eval(`setUser({id:'c3',role:'supervisor',custom_perms:[]})`);
    assert.strictEqual(app.eval(`can('dash')`), false);
  });

  test('hashPin() is salted per user and stable per (pin,user)', async () => {
    app.eval(`setUser({id:'admin1',role:'admin'})`);
    const h1 = await app.eval(`(async()=>await hashPin('1234','admin1'))()`);
    const h2 = await app.eval(`(async()=>await hashPin('1234','admin1'))()`);
    const h3 = await app.eval(`(async()=>await hashPin('1234','worker7'))()`);
    const h4 = await app.eval(`(async()=>await hashPin('4321','admin1'))()`);
    assert.strictEqual(h1, h2, 'same input → same hash');
    assert.notStrictEqual(h1, h3, 'salt is the user id');
    assert.notStrictEqual(h1, h4, 'different pin → different hash');
    assert.match(h1, /^[0-9a-f]{64}$/, 'SHA-256 hex');
  });

  test('requireAuth() redirects to login.html when there is no session', () => {
    app.window.localStorage.removeItem('farm_user');
    app.navigations.length = 0;
    assert.strictEqual(app.eval(`requireAuth()`), false);
    assert.ok(app.navigations.length > 0, 'a redirect to login.html must be attempted');
    app.window.localStorage.setItem('farm_user', JSON.stringify({ id: 'admin1', role: 'admin' }));
    app.navigations.length = 0;
    assert.strictEqual(app.eval(`requireAuth()`), true);
    assert.strictEqual(app.navigations.length, 0, 'an authenticated user must NOT be redirected');
  });

  test('logout() clears the session AND the Firebase auth refresh token', () => {
    app.eval(`setUser({id:'admin1',role:'admin'})`);
    app.window.localStorage.setItem('_farm_auth_refresh', '{"refreshToken":"abc"}');
    app.navigations.length = 0;
    app.eval(`logout()`);
    assert.strictEqual(app.window.localStorage.getItem('farm_user'), null);
    assert.strictEqual(app.window.localStorage.getItem('_farm_auth_refresh'), null, 'refresh token must not survive logout');
    assert.strictEqual(app.eval(`getUser()`), null);
    assert.ok(app.navigations.length > 0, 'logout must redirect to login.html');
  });

  test('ROLES/ROLE_PERMS cover exactly the five documented roles', () => {
    assert.deepStrictEqual(Object.keys(app.eval(`ROLES`)).sort(), ['admin', 'supervisor', 'vet', 'visitor', 'worker']);
    assert.deepStrictEqual(Object.keys(app.eval(`ROLE_PERMS`)).sort(), ['admin', 'supervisor', 'vet', 'visitor', 'worker']);
  });

  test('Users.init() does NOT resurrect a default admin when the read fails', async () => {
    // Regression: fbGet() returns [] on a network failure, which is
    // indistinguishable from "collection is empty" — the bootstrap then
    // PUT users/admin1 with PIN 1234, silently resetting a real admin.
    const offline = await bootApp({ db: { failMode: 'network' }, seedUsers: false });
    offline.db.data.users = { admin1: { id: 'admin1', role: 'admin', pin_hash: 'REAL', active: true } };
    offline.db.log.length = 0; // ignore whatever initApp() did during boot
    await offline.eval(`(async()=>{ try{ await Users.init(); }catch(e){} })()`);
    const stored = offline.db.data.users || {};
    const writeAttempted = offline.db.log.some((c) => c.method === 'PUT' && c.parts === 'users/admin1');
    assert.strictEqual(writeAttempted, false, 'a failed read must never trigger the bootstrap write');
    assert.strictEqual(stored.admin1 && stored.admin1.pin_hash, 'REAL');
    offline.close();
  });

  test('Users.init() still bootstraps admin1 on a genuinely empty database', async () => {
    const fresh = await bootApp({ db: { seed: {} }, seedUsers: false });
    fresh.db.reset({}); // boot's own initApp() already ran once; start clean
    await fresh.eval(`(async()=>await Users.init())()`);
    const admin = fresh.db.data.users && fresh.db.data.users.admin1;
    assert.ok(admin, 'first-run bootstrap must create the admin');
    assert.strictEqual(admin.role, 'admin');
    assert.ok(admin.pin_hash && !admin.pin, 'bootstrap must store a hash, never a plaintext pin');
    fresh.close();
  });

  test('Users.init() is idempotent (never overwrites an existing roster)', async () => {
    const fresh = await bootApp({ db: { seed: { users: { boss: { id: 'boss', role: 'admin', pin_hash: 'KEEP', active: true } } } }, seedUsers: false });
    await fresh.eval(`(async()=>await Users.init())()`);
    assert.strictEqual(fresh.db.data.users.boss.pin_hash, 'KEEP');
    assert.strictEqual(fresh.db.data.users.admin1, undefined, 'must not add a second admin alongside a real one');
    fresh.close();
  });
});
