// Module 29 — Demo mode (demo-data.js · docs/design/DEMO-MODE.md · 2026-10-20)
//
// The owner asked for fake data in every section of the app. The way it is
// built matters more than the data itself:
//
//   · it intercepts the TRANSPORT (fetch to the RTDB / Google auth hosts), not
//     the fb* functions, so the real parsers in firebase.js build the return
//     shapes — cache, retry, undo, activity log and every page keep behaving
//     exactly as they do against the live database;
//   · therefore NOT ONE BYTE may reach `farm-mz99` while it is on, which is
//     assertable here because the harness' fake database records every call in
//     `db.log` — demo mode must leave it empty;
//   · the base dataset is generated deterministically from a seed, so reports
//     agree across pages and screenshots reproduce; only what the operator
//     writes is persisted (an ops overlay in localStorage), because this is a
//     multi-page app and a full 300-animal/year dataset would not fit the
//     ~5 MB quota;
//   · it is a DEMO, so it must be impossible to mistake for real data
//     (a persistent bar, hidden in print) and it must carry no personal names
//     (the rule suite 28 enforces for the app applies to generated data too).
const fs = require('fs');
const path = require('path');
const { suite, assert, bootApp, ROOT, J } = require('./harness');

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const FILES = ['config.js', 'firebase.js', 'demo-data.js'];
const ADMIN = { id: 'admin1', name: 'T', role: 'admin', active: true };

// Every section the nav exposes, mapped to the collection that feeds it.
const SECTIONS = [
  'animals', 'production_log', 'feed_consumption', 'health', 'vaccinations', 'vaccination_templates',
  'breeding', 'inventory_meds', 'inventory_feeds', 'inventory_equipment', 'inventory_transactions',
  'finance', 'journal_entries', 'fiscal_periods', 'cash_bank_accounts', 'customers', 'suppliers',
  'budgets', 'cost_centers', 'animal_cost_ledger', 'bank_reconciliations', 'fixed_assets', 'loans',
  'daily_tasks', 'task_templates', 'diary_snapshots', 'notifications', 'login_notifications',
  'activity_log', 'weight_alerts', 'production_alerts', 'forecasts', 'source_documents',
  'users', 'user_directory', 'pin_vault', 'settings',
];

async function bootDemo(sz = 'medium') {
  const app = await bootApp({
    files: FILES, user: ADMIN, settleMs: 20,
    // a real record in the fake database: if demo mode leaked, we would see it
    db: { seed: { animals: { real1: { tag: 'REAL-1', species: 'goat', status: 'alive' } } } },
  });
  app.eval(`localStorage.setItem('farm_demo','1');
            localStorage.setItem('farm_demo_size', ${JSON.stringify(sz)});
            FarmDemo.reset(); FarmDemo.attach();`);
  // bootApp's own boot read `users` before demo mode was switched on; from
  // here on, anything in this log is a leak.
  app.db.log.length = 0;
  return app;
}
const get = async (app, expr) => J(await app.eval(`(async () => await (${expr}))()`));

module.exports = suite('29 · Demo mode: every section populated, zero bytes to the live database', ({ test }) => {

  test('off by default: nothing is intercepted and the real data layer is untouched', async () => {
    const app = await bootApp({
      files: FILES, user: ADMIN, settleMs: 20,
      db: { seed: { animals: { real1: { tag: 'REAL-1', species: 'goat', status: 'alive' } } } },
    });
    assert.strictEqual(J(app.eval('FarmDemo.isEnabled()')), false, 'no flag → no demo');
    const rows = await get(app, "fbGet('animals')");
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].tag, 'REAL-1', 'the seeded record is what the page sees');
    assert.ok(app.db.log.some((l) => l.parts === 'animals'),
      'and the request really went to the data layer: ' + JSON.stringify(app.db.log.map((l) => l.parts)));
    app.close();
  });

  test('on: every RTDB and auth call is served locally — db.log stays empty', async () => {
    const app = await bootDemo();
    const animals = await get(app, "fbGet('animals')");
    assert.ok(animals.length > 50, 'the demo herd is generated');
    assert.ok(!animals.some((a) => a.tag === 'REAL-1'), 'the real record is not visible any more');
    await get(app, "fbGet('finance')");
    await get(app, "fbGet('health')");
    await app.eval(`(async () => { await fbPost('activity_log', { action: 'demo', resource: 'test' }); })()`);
    assert.deepStrictEqual(app.db.log, [],
      'demo mode must not let a single request reach the data layer — got: '
      + JSON.stringify(app.db.log.slice(0, 4)));
    const stats = J(app.eval('FarmDemo.stats()'));
    assert.ok(stats.blocked >= 4 && stats.writes >= 1, JSON.stringify(stats));
    app.close();
  });

  test('Google auth is answered locally too, so no anonymous session is minted against production', async () => {
    const app = await bootDemo();
    const res = await app.eval(`(async () => {
      const base = (typeof FB_URL !== 'undefined' ? 'https://identitytoolkit.googleapis.com' : 'x');
      const r = await fetch(base + '/v1/accounts:signUp?key=demo', { method: 'POST', body: '{}' });
      return await r.json();
    })()`);
    const body = J(res);
    assert.strictEqual(body.localId, 'uid-demo-admin', 'a demo uid, not a real Firebase user');
    assert.ok(body.idToken && body.refreshToken, 'so _getValidAuthToken() succeeds without a network');
    assert.deepStrictEqual(app.db.log, []);
    app.close();
  });

  test('the herd uses the field names the pages actually read', async () => {
    const app = await bootDemo();
    const rows = await get(app, "fbGet('animals')");
    const a = rows[0];
    ['tag', 'species', 'breed', 'gender', 'purpose', 'status', 'birth_date', 'barn', 'created_at']
      .forEach((f) => assert.ok(Object.prototype.hasOwnProperty.call(a, f), `animals[].${f} is required by the pages`));
    assert.ok(['goat', 'sheep'].includes(a.species), `species must be goat|sheep, got ${a.species}`);
    assert.ok(['male', 'female'].includes(a.gender));
    assert.ok(['alive', 'dead', 'sold'].includes(a.status));
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(a.birth_date), `birth_date must be a real ISO day, got ${a.birth_date}`);
    const alive = rows.filter((r) => r.status === 'alive');
    assert.ok(alive.length && alive[0].current_weight > 0, 'a live animal carries its current weight');
    // the weight SSOT lives inside the animal record (O-15), read by path
    const weights = await get(app, `fbGet('animals/' + ${JSON.stringify(alive[0]._id || 'a1')} + '/weights', true)`);
    assert.ok(Array.isArray(weights) && weights.length >= 4, 'and its weight history is a list of {date, weight}');
    assert.ok(weights.every((w) => /^\d{4}-\d{2}-\d{2}$/.test(w.date) && typeof w.weight === 'number'));
    app.close();
  });

  test('every section has data — none of them renders an empty state', async () => {
    const app = await bootDemo();
    const empty = SECTIONS.filter((c) => J(app.eval(`FarmDemo.collection(${JSON.stringify(c)}).length`)) === 0);
    assert.deepStrictEqual(empty, [], 'these sections would still look broken in a demo: ' + empty.join(', '));
    // `accounts` is deliberately left empty for the app's own chart-of-accounts
    // seeder, so the finance pages show the canonical tree rather than ours.
    app.close();
  });

  test('the size switch really changes the dataset', async () => {
    const counts = {};
    for (const sz of ['small', 'medium', 'large']) {
      const app = await bootDemo(sz);
      counts[sz] = {
        animals: J(app.eval("FarmDemo.collection('animals').length")),
        production: J(app.eval("FarmDemo.collection('production_log').length")),
        finance: J(app.eval("FarmDemo.collection('finance').length")),
      };
      app.close();
    }
    assert.strictEqual(counts.small.animals, 20);
    assert.strictEqual(counts.medium.animals, 120);
    assert.strictEqual(counts.large.animals, 300);
    assert.ok(counts.small.production < counts.medium.production && counts.medium.production < counts.large.production,
      'series scale with the size too: ' + JSON.stringify(counts));
    assert.ok(counts.medium.finance > counts.small.finance);
  });

  test('generation is deterministic — the same seed gives the same farm', async () => {
    const app = await bootDemo('medium');
    const first = app.eval(`(function(){ FarmDemo.reset();
      return JSON.stringify(FarmDemo.collection('animals').slice(0,5).map(function(a){return [a.tag,a.breed,a.birth_date,a.current_weight];})); })()`);
    const second = app.eval(`(function(){ FarmDemo.reset();
      return JSON.stringify(FarmDemo.collection('animals').slice(0,5).map(function(a){return [a.tag,a.breed,a.birth_date,a.current_weight];})); })()`);
    assert.strictEqual(first, second, 'two loads of the same page must show the same numbers');
    app.eval(`localStorage.setItem('farm_demo_seed','7'); FarmDemo.reset();`);
    const third = app.eval(`JSON.stringify(FarmDemo.collection('animals').slice(0,5).map(function(a){return a.tag;}))`);
    assert.notStrictEqual(first, third, 'and «توليد جديد» (a new seed) gives a different farm');
    app.close();
  });

  test('what the operator writes survives navigation, because this is a multi-page app', async () => {
    const app = await bootDemo('small');
    const id = await app.eval(`(async () => await fbPost('animals', { tag: 'GT-NEW', species: 'goat', breed: 'شامي',
      gender: 'female', purpose: 'production', status: 'alive', barn: 'عنبر ١', birth_date: '2025-01-01' }))()`);
    assert.ok(id && typeof J(id) === 'string', 'fbPost still returns the new key');
    assert.ok(J(app.eval('localStorage.getItem("farm_demo_ops")')).includes('GT-NEW'), 'and the write is in the overlay');

    // simulate the next page load: fresh base from the seed + replayed overlay
    app.eval('FarmDemo.reloadStore(); fbCacheInvalidate();');
    let rows = await get(app, "fbGet('animals')");
    assert.ok(rows.some((r) => r.tag === 'GT-NEW'), 'the added animal is still there after a page change');

    const key = J(id);
    await app.eval(`(async () => { await fbPatch('animals', ${JSON.stringify(key)}, { status: 'sold', sale_price: 4200 }); })()`);
    app.eval('FarmDemo.reloadStore(); fbCacheInvalidate();');
    rows = await get(app, "fbGet('animals')");
    const edited = rows.filter((r) => r._id === key)[0];
    assert.strictEqual(edited.status, 'sold', 'edits persist');
    assert.strictEqual(edited.sale_price, 4200);

    await app.eval(`(async () => { await fbDelete('animals', ${JSON.stringify(key)}); })()`);
    app.eval('FarmDemo.reloadStore(); fbCacheInvalidate();');
    rows = await get(app, "fbGet('animals')");
    assert.ok(!rows.some((r) => r._id === key), 'and so do deletes — a demo delete must not come back');
    app.close();
  });

  test('RTDB queries keep working (tag generation and the diary readers depend on them)', async () => {
    const app = await bootDemo('small');
    const two = await app.eval(`(async () => {
      const base = FB_URL.replace(/\\/$/, '');
      const r = await fetch(base + '/animals.json?orderBy="tag"&limitToFirst=2');
      return Object.keys(await r.json() || {}).length;
    })()`);
    assert.strictEqual(J(two), 2, 'orderBy + limitToFirst');
    const eq = await app.eval(`(async () => {
      const base = FB_URL.replace(/\\/$/, '');
      const r = await fetch(base + '/animals.json?orderBy="tag"&equalTo="GT-0001"');
      const j = await r.json();
      return j ? Object.keys(j).length : 0;
    })()`);
    assert.ok(J(eq) <= 1, 'equalTo filters to at most the one animal with that tag');
    app.close();
  });

  test('the generated ledger is internally consistent: every entry balances and points at real accounts', async () => {
    const app = await bootDemo('medium');
    const res = await app.eval(`(function(){
      FarmDemo.collection('journal_entries');                 // forces the chart to exist
      var acc = FarmDemo.collection('accounts').map(function(a){return a._id;});
      var bad = [], unbalanced = 0;
      FarmDemo.collection('journal_entries').forEach(function(e){
        if (Math.round((e.totalDebit - e.totalCredit) * 100) !== 0) unbalanced++;
        (e.lines || []).forEach(function(l){ if (acc.indexOf(l.accountId) < 0) bad.push(l.accountId); });
      });
      return { entries: FarmDemo.collection('journal_entries').length, accounts: acc.length,
               unbalanced: unbalanced, unknown: bad.slice(0, 5) };
    })()`);
    const r = J(res);
    assert.ok(r.entries > 10, `journal entries must exist, got ${r.entries}`);
    assert.ok(r.accounts > 0, 'and a chart of accounts to post them to');
    assert.strictEqual(r.unbalanced, 0, 'debits must equal credits on every entry');
    assert.deepStrictEqual(r.unknown, [], 'every line must reference an account that exists');
    app.close();
  });

  test('demo accounts are roles, not people, and never touch the real PIN vault', async () => {
    const app = await bootDemo();
    const users = await get(app, "fbGet('users')");
    const roles = users.map((u) => u.role).sort();
    assert.deepStrictEqual(roles, ['admin', 'supervisor', 'worker']);
    assert.ok(users.every((u) => u.demo === true), 'every demo account is marked as demo');
    assert.ok(users.every((u) => !/^مصطفى|أحمد|رجب/.test(u.name || '')), 'no personal names');
    const dir = await get(app, "fbGet('user_directory')");
    assert.strictEqual(dir.length, users.length, 'the projection the lists read matches');
    const vault = await get(app, "fbGet('pin_vault')");
    assert.ok(vault.every((v) => v.demo === true && /^demo-/.test(v.pin_hash_v2)),
      'the vault holds obviously fake hashes — no real PBKDF2 digest is invented or read');
    app.close();
  });

  test('generated data carries no personal name either', async () => {
    const app = await bootDemo('small');
    const names = ['أحمد رجب', 'رجب نوح', 'مصطفى محمد', 'محمد إبراهيم', 'لواء أحمد', 'جندي مصطفى', 'aboalazm', 'mustafa'];
    const hits = app.eval(`(function(){
      var names = ${JSON.stringify(names)}, out = [];
      ${JSON.stringify(SECTIONS)}.forEach(function (c) {
        var s = JSON.stringify(FarmDemo.collection(c) || []);
        names.forEach(function (n) { if (s.indexOf(n) >= 0) out.push(c + ':' + n); });
      });
      return out;
    })()`);
    assert.deepStrictEqual(J(hits), [], 'demo data is generated — it must not smuggle names back in: ' + J(hits));
    app.close();
  });

  test('the bar says this is not real data, offers the sizes, and exit clears everything', async () => {
    const app = await bootDemo();
    app.eval('FarmDemo.renderBar()');
    const d = app.window.document;
    const bar = d.getElementById('farm-demo-bar');
    assert.ok(bar, 'the bar renders while demo mode is on');
    assert.ok(/بيانات تجريبية/.test(bar.textContent), 'and says the data is not real');
    assert.ok(/لا تُحفظ في قاعدة البيانات/.test(bar.textContent), 'and says it is not saved to the database');
    const opts = Array.from(d.querySelectorAll('#farm-demo-size option')).map((o) => o.value);
    assert.deepStrictEqual(opts, ['small', 'medium', 'large'], 'the size switch offers the three sizes');
    assert.strictEqual(d.querySelector('#farm-demo-size').value, 'medium', 'with the active one selected');
    assert.ok(d.body.classList.contains('demo-mode'), 'body gets the padding class so the bar covers nothing');
    assert.ok(bar.getAttribute('dir') === 'rtl');

    d.getElementById('farm-demo-exit').click();
    assert.strictEqual(J(app.eval('localStorage.getItem("farm_demo")')), null, 'the flag is gone');
    assert.strictEqual(J(app.eval('localStorage.getItem("farm_demo_ops")')), null, 'and so is the overlay');
    assert.strictEqual(J(app.eval('localStorage.getItem("farm_user")')), null, 'the demo session is over');
    assert.ok(app.navigations.length >= 1, 'and it sends the operator back to login.html');
    app.close();
  });

  test('login.html offers it without listing anybody, and every app page loads the layer', () => {
    const login = read('login.html');
    assert.ok(login.includes('id="demo-entry"'), 'the login screen has the demo button');
    assert.ok(login.includes('تصفح ببيانات تجريبية'), 'labelled as browsing demo data');
    assert.ok(login.includes("FarmDemo.enter('demo-admin')"), 'one click enters — no PIN, no directory read');
    // login.html reads user_directory only to MATCH a typed identifier (see its
    // own comment at the top of the file, pinned by suite 27: nothing is
    // rendered before authentication). The demo entry must read nothing at all.
    const demoFn = login.slice(login.indexOf('wireDemoEntry'));
    const demoBlock = demoFn.slice(0, demoFn.indexOf('})();'));
    assert.ok(!/fbGet|fbGetSafe|fetch\(/.test(demoBlock),
      'the demo button performs no read — no directory, no vault, no network');
    // the layer must load right after firebase.js on every page that has it
    const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));
    const missing = [], misplaced = [];
    pages.forEach((f) => {
      const src = read(f);
      const hasFb = /<script src=["']firebase\.js["']><\/script>/.test(src);
      const hasDemo = /<script src=["']demo-data\.js["']><\/script>/.test(src);
      if (hasFb && !hasDemo) missing.push(f);
      // compare the TAG positions: login.html mentions demo-data.js in prose
      // above its script block, which is not a load-order problem.
      const fbTag = src.search(/<script src=["']firebase\.js["']/);
      const demoTag = src.search(/<script src=["']demo-data\.js["']/);
      if (hasFb && hasDemo && demoTag < fbTag) misplaced.push(f);
    });
    assert.deepStrictEqual(missing, [], 'these pages would run against the live database in demo mode: ' + missing.join(', '));
    assert.deepStrictEqual(misplaced, [], 'demo-data.js must come after firebase.js: ' + misplaced.join(', '));
    assert.ok(!read('bayan.html').includes('demo-data.js'), 'bayan.html loads no data layer at all — leave it alone');
    const css = read('ui.css');
    assert.ok(css.includes('§16 · DEMO MODE'), 'ui.css §16 documents the bar');
    assert.ok(/\.demo-bar\{/.test(css) && /body\.demo-mode\{/.test(css));
    assert.ok(/@media print\{\s*\.demo-bar\{display:none/.test(css), 'a printed demo report must not carry the bar');
  });
});
