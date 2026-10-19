// Module 03 — Firebase REST data layer (firebase.js)
const { bootApp, suite, assert, J } = require('./harness');

module.exports = suite('03 · Data layer (fbGet/fbPost/fbPatch/fbPut/fbDelete)', ({ test }) => {
  let app, db;
  // fbGet() caches in sessionStorage, which outlives an individual test in
  // one booted app — every test that reseeds the database must also drop the
  // cache, or it asserts against the previous test's snapshot.
  const reset = (seed) => { db.reset(seed); app.eval(`fbCacheInvalidate()`); };

  test('boots', async () => { app = await bootApp(); db = app.db; });

  test('fbGet() maps a Firebase object-map into an array carrying _id', async () => {
    reset({ animals: { a1: { tag: 'GT-1', species: 'goat' }, a2: { tag: 'GT-2' } } });
    const list = await app.eval(`(async()=>await fbGet('animals'))()`);
    assert.strictEqual(list.length, 2);
    assert.deepStrictEqual(J(list.map((a) => a._id).sort()), ['a1', 'a2']);
    assert.strictEqual(list.find((a) => a._id === 'a1').tag, 'GT-1');
  });

  test('fbGet() returns [] for a missing collection and never throws', async () => {
    const list = await app.eval(`(async()=>await fbGet('does_not_exist'))()`);
    assert.deepStrictEqual(J(list), []);
  });

  test('fbGet() returns [] (not a crash) when the network fails', async () => {
    const offline = await bootApp({ db: { failMode: 'network' } });
    assert.deepStrictEqual(J(await offline.eval(`(async()=>await fbGet('animals'))()`)), []);
    offline.close();
  });

  test('fbGet() caches for ~45s and skipCache bypasses it', async () => {
    reset({ animals: { a1: { tag: 'ONE' } } });
    const first = await app.eval(`(async()=>await fbGet('animals'))()`);
    assert.strictEqual(first[0].tag, 'ONE');
    db.data.animals.a1.tag = 'TWO'; // changed behind the cache
    const cached = await app.eval(`(async()=>await fbGet('animals'))()`);
    assert.strictEqual(cached[0].tag, 'ONE', 'second read must come from the sessionStorage cache');
    const fresh = await app.eval(`(async()=>await fbGet('animals', true))()`);
    assert.strictEqual(fresh[0].tag, 'TWO', 'skipCache:true must bypass it');
  });

  test('fbCacheInvalidate(path) drops only that path; no-arg drops everything', async () => {
    reset({ animals: { a1: { tag: 'X' } }, health: { h1: { diagnosis: 'd' } } });
    await app.eval(`(async()=>{await fbGet('animals');await fbGet('health');})()`);
    db.data.animals.a1.tag = 'Y'; db.data.health.h1.diagnosis = 'e';
    app.eval(`fbCacheInvalidate('animals')`);
    assert.strictEqual((await app.eval(`(async()=>await fbGet('animals'))()`))[0].tag, 'Y');
    assert.strictEqual((await app.eval(`(async()=>await fbGet('health'))()`))[0].diagnosis, 'd', 'other paths stay cached');
    app.eval(`fbCacheInvalidate()`);
    assert.strictEqual((await app.eval(`(async()=>await fbGet('health'))()`))[0].diagnosis, 'e');
  });

  test('fbPost() returns the new key, stamps created_at, and invalidates the cache', async () => {
    reset({ animals: { a1: { tag: 'OLD' } } });
    await app.eval(`(async()=>await fbGet('animals'))()`);
    const id = await app.eval(`(async()=>await fbPost('animals',{tag:'NEW',species:'goat',breed:'شامي',gender:'female'}))()`);
    assert.ok(id, 'a new key must be returned');
    assert.strictEqual(db.data.animals[id].tag, 'NEW');
    assert.ok(db.data.animals[id].created_at, 'created_at must be stamped');
    const after = await app.eval(`(async()=>await fbGet('animals'))()`);
    assert.strictEqual(after.length, 2, 'the cache must not serve the pre-create snapshot');
  });

  test('fbPost() throws a descriptive error on a failed write', async () => {
    const failing = await bootApp({ db: { failMode: (m) => (m === 'POST' ? new Response('denied', { status: 403 }) : null) } });
    await assert.rejects(
      () => failing.eval(`(async()=>await fbPost('animals',{tag:'x'}))()`),
      /POST animals: 403/
    );
    failing.close();
  });

  test('fbPatch() shallow-merges and leaves untouched fields alone', async () => {
    reset({ animals: { a1: { tag: 'GT-1', breed: 'شامي', status: 'alive' } } });
    await app.eval(`(async()=>await fbPatch('animals','a1',{status:'sold'}))()`);
    assert.deepStrictEqual(
      { tag: db.data.animals.a1.tag, breed: db.data.animals.a1.breed, status: db.data.animals.a1.status },
      { tag: 'GT-1', breed: 'شامي', status: 'sold' }
    );
    assert.ok(db.data.animals.a1.updated_at, 'updated_at must be stamped');
  });

  test('fbPut() replaces the whole node', async () => {
    reset({ animals: { a1: { tag: 'GT-1', breed: 'شامي' } } });
    await app.eval(`(async()=>await fbPut('animals','a1',{tag:'REPLACED'}))()`);
    assert.strictEqual(db.data.animals.a1.tag, 'REPLACED');
    assert.strictEqual(db.data.animals.a1.breed, undefined, 'PUT must not merge');
  });

  test('fbDelete() removes the node and throws on failure', async () => {
    reset({ animals: { a1: { tag: 'GT-1' }, a2: { tag: 'GT-2' } } });
    await app.eval(`(async()=>await fbDelete('animals','a1'))()`);
    assert.strictEqual(db.data.animals.a1, undefined);
    assert.ok(db.data.animals.a2);
  });

  test('fbGetOne() returns a single record with _id, and throws (does not fake null) on HTTP failure', async () => {
    reset({ animals: { a1: { tag: 'GT-1' } } });
    const one = await app.eval(`(async()=>await fbGetOne('animals','a1'))()`);
    assert.strictEqual(one.tag, 'GT-1');
    assert.strictEqual(one._id, 'a1');
    assert.strictEqual(await app.eval(`(async()=>await fbGetOne('animals','nope'))()`), null);
  });

  test('fbGetSingle() returns the raw node for object-valued paths', async () => {
    reset({ settings_node: { a: 1, b: { c: 2 } } });
    const single = await app.eval(`(async()=>await fbGetSingle('settings_node'))()`);
    assert.deepStrictEqual(J(single), { a: 1, b: { c: 2 } });
    assert.strictEqual(await app.eval(`(async()=>await fbGetSingle('missing_node'))()`), null);
  });

  test('fbGetSafe() distinguishes an empty collection from a failed read', async () => {
    reset({});
    assert.deepStrictEqual(J(await app.eval(`(async()=>await fbGetSafe('animals'))()`)), [], 'truly empty → []');
    const offline = await bootApp({ db: { failMode: 'network' } });
    assert.strictEqual(await offline.eval(`(async()=>await fbGetSafe('animals'))()`), null, 'failed read → null');
    offline.close();
  });

  test('fbGetSafe() returns [] for a 404 and null for a 403', async () => {
    const http = await bootApp({
      db: { failMode: (m, p) => (p === 'animals' ? new Response('no', { status: 403 }) : (p === 'empty' ? new Response('', { status: 404 }) : null)) },
    });
    assert.strictEqual(await http.eval(`(async()=>await fbGetSafe('animals'))()`), null);
    assert.deepStrictEqual(J(await http.eval(`(async()=>await fbGetSafe('empty'))()`)), []);
    http.close();
  });

  test('nested paths work for sub-collections (animals/{id}/weights)', async () => {
    reset({ animals: { a1: { tag: 'GT-1', weights: { w1: { weight: 40, date: '2026-01-01' } } } } });
    const w = await app.eval(`(async()=>await fbGet('animals/a1/weights'))()`);
    assert.strictEqual(w.length, 1);
    assert.strictEqual(w[0].weight, 40);
    const newId = await app.eval(`(async()=>await fbPost('animals/a1/weights',{weight:44,date:'2026-02-01'}))()`);
    assert.strictEqual(db.data.animals.a1.weights[newId].weight, 44);
  });

  test('logActivity() writes an audit row and never throws when the user is unknown', async () => {
    reset({});
    await app.eval(`(async()=>await logActivity('add','animals','اختبار'))()`);
    const rows = Object.values(db.data.activity_log || {});
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].action, 'add');
    assert.strictEqual(rows[0].resource, 'animals');
    assert.ok(rows[0].timestamp);
  });

  test('logActivity() silently no-ops without a session or a configured database', async () => {
    app.window.localStorage.removeItem('farm_user');
    reset({});
    await app.eval(`(async()=>await logActivity('add','animals','x'))()`);
    assert.strictEqual(db.data.activity_log, undefined, 'no session → no audit row, no throw');
    app.eval(`setUser({id:'admin1',role:'admin',name:'مدير'})`);
  });

  test('a 401 on any read surfaces ONE user-visible auth warning, not one per call', async () => {
    const unauth = await bootApp({ db: { failMode: () => new Response('auth required', { status: 401 }) } });
    unauth.eval(`window.__toasts=[]; window.toast=function(m,t){window.__toasts.push([m,t]);};`);
    // _authFailureShown is a module-level latch with a 30s reset; boot's own
    // requests already tripped it, so clear it to observe a fresh batch.
    unauth.eval(`_authFailureShown=false`);
    unauth.eval(`window.__toasts=[]`);
    await unauth.eval(`(async()=>{await Promise.all([fbGet('animals'),fbGet('health'),fbGet('finance')]);})()`);
    const authToasts = J(unauth.eval(`window.__toasts`)).filter((t) => /الهوية/.test(t[0]));
    assert.strictEqual(authToasts.length, 1, 'exactly one auth-failure toast for a batch of failures');
    unauth.close();
  });
});
