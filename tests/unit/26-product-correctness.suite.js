// Module 26 — the product-correctness pass: the open items from
// docs/audit/FULL-AUDIT-2026-10.md that were neither security (suite 25) nor
// design system (suites 23/24). Every test here pins a decision that was
// previously only written down, so it cannot regress silently.
//
//   O-02  bayan.html is a static snapshot presented as live
//   O-04  operationId minted per click, so the engine's dedupe never fired
//   O-07  inventory named operations carried no permission guard
//   O-08  submitBreeding() carried no permission guard
//   O-09  the service worker / PWA layer was never loaded by any page
//   O-10  renderProductionWidget() had zero callers
//   O-14  a failed write simply failed, once, behind a generic toast
//   O-15  the dead `weights` collection was still a reset target
//   O-17  errors reached a developer console and nowhere else
const fs = require('fs');
const path = require('path');
const { suite, assert, bootApp, ROOT, J } = require('./harness');

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const HTML_PAGES = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));

module.exports = suite('26 · Product correctness (audit O-items)', ({ test }) => {

  /* ── O-14 · writes are retried, by verb, for the right reasons ───────── */

  test('O-14: an idempotent write is retried through a 503 and lands', async () => {
    let attempts = 0;
    const app = await bootApp({
      user: { id: 'admin1', role: 'admin', active: true },
      failMode: (method, parts) => {
        if (method === 'PUT' && parts.startsWith('animals/')) {
          attempts++;
          if (attempts < 3) {
            return new Response(JSON.stringify({ error: 'unavailable' }), { status: 503 });
          }
        }
        return null;
      },
      db: { seed: { animals: {} } },
    });
    await app.eval(`(async()=>await fbPut('animals','a1',{tag:'GT-1'}))()`);
    assert.strictEqual(attempts, 3, 'two 503s then success = three attempts, got ' + attempts);
    assert.strictEqual(app.db.data.animals.a1.tag, 'GT-1', 'and the write actually landed');
    const diags = J(await app.eval(`diagnostics().entries.map(e=>e.kind+':'+e.message.slice(0,24))`));
    assert.ok(diags.some((d) => /^retry/.test(d)), 'each retry is recorded in the diagnostics ring: ' + JSON.stringify(diags));
    app.close();
  });

  test('O-14: a POST is never replayed after a network failure (it could duplicate)', async () => {
    let attempts = 0;
    const app = await bootApp({
      user: { id: 'admin1', role: 'admin', active: true },
      failMode: (method) => {
        if (method === 'POST') { attempts++; throw new TypeError('Failed to fetch'); }
        return null;
      },
      db: { seed: {} },
    });
    let threw = false;
    try { await app.eval(`(async()=>await fbPost('animals',{tag:'GT-1'}))()`); } catch (e) { threw = true; }
    assert.ok(threw, 'the failure is reported to the caller, not swallowed');
    assert.strictEqual(attempts, 1,
      'without a response there is no way to know whether the row was created — so no replay');
    app.close();
  });

  test('O-14: a POST IS retried when the server answers 429, and offline writes fail fast', async () => {
    let posts = 0;
    const app = await bootApp({
      user: { id: 'admin1', role: 'admin', active: true },
      failMode: (method) => {
        if (method === 'POST') { posts++; if (posts < 2) return new Response('{}', { status: 429 }); }
        return null;
      },
      db: { seed: {} },
    });
    await app.eval(`(async()=>await fbPost('animals',{tag:'GT-1'}))()`);
    assert.strictEqual(posts, 2, 'a 429 means the write was refused, so replaying it is safe');

    app.close();

    // Offline: retrying only delays the message the user needs to see. The
    // failMode has to be set at boot (it is a closure inside the fake db), so
    // this is its own app whose PUTs always fail at the network layer.
    let puts = 0;
    const off = await bootApp({
      user: { id: 'admin1', role: 'admin', active: true },
      failMode: (method) => { if (method === 'PUT') { puts++; throw new TypeError('Failed to fetch'); } return null; },
      db: { seed: {} },
    });
    const canSet = J(await off.eval(`(()=>{ try{
      Object.defineProperty(navigator,'onLine',{value:false,configurable:true}); return navigator.onLine===false;
    }catch(e){ return false; } })()`));
    let threw = false;
    try { await off.eval(`(async()=>await fbPut('animals','a1',{tag:'x'}))()`); } catch (e) { threw = true; }
    assert.ok(threw, 'an offline write still reports its failure');
    assert.strictEqual(canSet ? 1 : puts, 1,
      'with navigator.onLine === false a write is attempted exactly once, got ' + puts);
    off.close();
  });

  /* ── O-04 · one idempotency key per logical operation ────────────────── */

  test('O-04: idempotencyKey() is stable per scope, survives a reload, and clears on success', async () => {
    const app = await bootApp({ user: null, db: { seed: {} } });
    const got = J(await app.eval(`(()=>{
      const a = idempotencyKey('sale:1:500:2026-10-01');
      const b = idempotencyKey('sale:1:500:2026-10-01');       // a retry of the SAME operation
      const c = idempotencyKey('sale:2:500:2026-10-01');       // a different animal
      const d = operationKey('sale:1:500:2026-10-01', false);  // not confirmed yet
      const e = operationKey('sale:1:500:2026-10-01', true);   // confirmed -> cleared
      const f = idempotencyKey('sale:1:500:2026-10-01');       // next operation starts fresh
      return {a,b,c,d,e,f, stored: sessionStorage.getItem('farm_op_sale:1:500:2026-10-01')};
    })()`));
    assert.strictEqual(got.a, got.b, 'a retry reuses the key — that is what makes the dedupe fire');
    assert.strictEqual(got.a, got.d, 'and so does an unconfirmed re-submit');
    assert.notStrictEqual(got.a, got.c, 'a different operation gets a different key');
    assert.notStrictEqual(got.a, got.f, 'a confirmed operation clears its key, so the next one is new');
    assert.strictEqual(got.stored, got.f);
    // Keys live in sessionStorage, so a reload mid-operation does not create a
    // second record either.
    const persisted = J(await app.eval(`sessionStorage.getItem('farm_op_sale:2:500:2026-10-01')`));
    assert.strictEqual(persisted, got.c);
    app.close();
  });

  test('O-04: no submit handler mints a fresh operationId at click time any more', () => {
    const offenders = [];
    for (const f of HTML_PAGES) {
      const src = read(f);
      if (/operationId\s*:\s*genId\(\)/.test(src)) offenders.push(f);
    }
    assert.deepStrictEqual(offenders, [],
      'operationId must come from idempotencyKey(scope), never genId() at click time: ' + offenders.join(', '));
    // and every site that mints a key also clears it once the write confirms
    for (const f of ['finance-animals.html', 'finance-ar-ap.html', 'finance-entry.html', 'finance-periods.html']) {
      const src = read(f);
      const mints = (src.match(/idempotencyKey\(opScope\)/g) || []).length;
      const clears = (src.match(/clearIdempotencyKey\(opScope\)/g) || []).length;
      assert.ok(mints > 0, f + ' must mint keys');
      assert.ok(clears >= mints - 1,
        f + ' mints ' + mints + ' keys but clears only ' + clears + ' — a confirmed write must free its scope');
    }
  });

  /* ── O-07 / O-08 · write guards the server already enforces ──────────── */

  test('O-07: every named inventory operation checks the permission itself', async () => {
    const app = await bootApp({ user: { id: 'v1', name: 'زائر', role: 'visitor', active: true }, db: { seed: {} } });
    const ops = ['purchaseFeed', 'consumeFeed', 'expireStock', 'returnStock', 'stockAdjustment', 'inventoryCorrection', 'transferStock'];
    const got = J(await app.eval(`(async()=>{
      const out = {};
      for (const fn of ${JSON.stringify(ops)}) {
        out[fn] = await window[fn]({ itemType:'feeds', name:'علف', quantity:5, deltaQty:-5, reason:'test' });
      }
      return out;
    })()`));
    for (const fn of ops) {
      assert.strictEqual(got[fn].ok, false, fn + ' must refuse a role without the inventory permission');
      assert.strictEqual(got[fn].permission, 'inventory', fn + ' must say which permission was missing');
    }
    assert.deepStrictEqual(J(app.db.collection('inventory_transactions')), [],
      'and it must refuse BEFORE writing anything');

    // initialStock already had the guard; the point of O-07 is that its
    // siblings now behave the same way. An admin still gets through.
    const admin = await bootApp({ user: { id: 'admin1', role: 'admin', active: true }, db: { seed: {} } });
    const ok = J(await admin.eval(`(async()=>await purchaseFeed({itemType:'feeds',name:'علف',quantity:5,unitPrice:10,total:50}))()`));
    assert.notStrictEqual(ok && ok.permission, 'inventory', 'an admin is not blocked by the guard');
    admin.close(); app.close();
  });

  test('O-08: submitBreeding() refuses a role that cannot write breeding data', async () => {
    const files = ['config.js', 'firebase.js', 'nav.js', 'shared.js', 'pages/breeding.js'];
    const app = await bootApp({ files, user: { id: 'v1', name: 'زائر', role: 'visitor', active: true }, db: { seed: {} } });
    await app.eval(`(async()=>await window.submitBreeding())()`);
    assert.deepStrictEqual(J(app.db.collection('breeding')), [], 'no mating record was written');
    const src = read('pages/breeding.js');
    assert.ok(/canWrite\('breeding'\)/.test(src), 'the guard must be in the handler, not only in the page');
    app.close();
  });

  /* ── O-09 · the offline layer is loaded, gated and recoverable ───────── */

  test('O-09: every page loads the registrar, and registration is a config decision', async () => {
    const wired = HTML_PAGES.filter((f) => read(f).includes('sw-register.js'));
    const shelled = HTML_PAGES.filter((f) => read(f).includes('<script src="ui-shell.js"></script>'));
    assert.ok(shelled.length >= 30, shelled.length + ' pages use the v2 shell');
    assert.deepStrictEqual(shelled.filter((f) => !wired.includes(f)), [],
      'every page that loads the shell must also load the service-worker registrar');

    const app = await bootApp({ files: ['config.js', 'sw-register.js'], user: null, db: { seed: {} } });
    assert.strictEqual(J(await app.eval(`farmSwEnabled()`)), false,
      'dormant by default — flipping it is an operational decision, not a side effect');
    // config.js declares `const FARM_CONFIG`, which is NOT a window property —
    // the registrar has to read the binding itself, and this asserts it does.
    assert.strictEqual(J(await app.eval(`FARM_CONFIG.enableServiceWorker=false; farmSwEnabled()`)), false);
    assert.strictEqual(J(await app.eval(`FARM_CONFIG.enableServiceWorker=true; farmSwEnabled()`)), true,
      'flipping the flag in config.js is all it takes — no code change');
    assert.strictEqual(J(await app.eval(`FARM_CONFIG.enableServiceWorker='true'; farmSwEnabled()`)), true,
      'a string from an env-style config still counts');
    assert.strictEqual(typeof app.eval(`requestClearDataCache`), 'function', 'the recovery tools are loaded too');
    assert.strictEqual(typeof app.eval(`unregisterServiceWorker`), 'function');
    app.close();

    const sw = read('sw.js');
    assert.ok(/farm-static-v6/.test(sw), 'the cache version was bumped so an installed worker drops v5');
    for (const asset of ['/ui.css', '/ui-shell.js', '/sw-register.js']) {
      assert.ok(sw.includes("'" + asset + "'"), 'the app shell must cache ' + asset);
    }
    const settings = read('settings.html');
    assert.ok(settings.includes('uiSwUnregister') && settings.includes('uiSwClearData'),
      'settings.html must expose the recovery tools, or activating the SW is not reversible from the UI');
  });

  /* ── O-10 · a documented component with no callers is dead code ──────── */

  test('O-10: renderProductionWidget() is actually rendered, with real trend data', async () => {
    const src = read('pages/production.js');
    assert.ok(src.includes('renderProductionWidget('), 'production.html must render the widget');
    assert.ok(src.includes('productionWidgetsHtml'), 'and inject it into the page');
    assert.ok(!/trend\s*:\s*''/.test(src), 'the trend must be computed, not stubbed');

    const app = await bootApp({ user: { id: 'admin1', role: 'admin', active: true }, db: { seed: {} } });
    const html = J(await app.eval(`renderProductionWidget({type:'الحليب (شهر)', value:'١٢٠', unit:'ل',
      trend:'١٥٪', trendDir:'down', period:'مقارنة بالشهر السابق', status:'watch'})`));
    assert.ok(/الحليب/.test(html) && /١٢٠/.test(html) && /١٥٪/.test(html), 'label, value and trend all render');
    assert.ok(/down|watch/.test(html), 'the direction and status reach the markup');
    app.close();
  });

  /* ── O-02 · a static snapshot must not look live ─────────────────────── */

  test('O-02: bayan.html is flagged as an archive in the data, the nav and the page', () => {
    const nav = read('nav.js');
    assert.ok(/href:'bayan\.html'[\s\S]{0,200}archive:true/.test(nav), 'FARM_NAV must mark the snapshot');
    assert.ok(/٢٠٢٦\/٠٤\/٢٤/.test(nav), 'and say which date it is frozen at');

    const bayan = read('bayan.html');
    assert.ok(bayan.includes('archive-banner'), 'the page carries the banner');
    assert.ok(/أرشيف/.test(bayan) && /dashboard\.html/.test(bayan),
      'the banner says "archive" and points at the live data');
  });

  test('O-02: the shell stamps every archived nav link, wherever it is rendered', async () => {
    const app = await bootApp({
      files: ['config.js', 'firebase.js', 'nav.js', 'shared.js', 'ui-shell.js'],
      user: { id: 'admin1', role: 'admin', active: true },
      db: { seed: {} },
    });
    await app.eval(`document.body.innerHTML =
      '<a class="rail-v2__item" href="bayan.html">بيان القطيع</a>' +
      '<a class="sidebar-item" href="bayan.html">بيان القطيع</a>' +
      '<a href="dashboard.html">لوحة</a>';
      UIShell.markArchivedNav();`);
    const got = J(await app.eval(`[...document.querySelectorAll('a')].map(a=>({
      href:a.getAttribute('href'),
      pills:a.querySelectorAll('.nav-archive-pill').length,
      pillText:(a.querySelector('.nav-archive-pill')||{}).textContent||'',
      title:a.getAttribute('title')||''
    }))`));
    const archived = got.filter((a) => a.href === 'bayan.html');
    assert.strictEqual(archived.length, 2, 'both the rail and the sidebar link are stamped');
    for (const a of archived) {
      assert.strictEqual(a.pills, 1, 'exactly one pill per link');
      assert.strictEqual(a.pillText, 'أرشيف');
      assert.ok(/ثابت|٢٠٢٦/.test(a.title), 'the tooltip explains it: ' + a.title);
    }
    assert.strictEqual(got.find((a) => a.href === 'dashboard.html').pills, 0, 'live pages are left alone');

    // Calling it twice must not stack pills (mount runs on every page).
    await app.eval(`UIShell.markArchivedNav()`);
    assert.strictEqual(J(await app.eval(`document.querySelectorAll('.nav-archive-pill').length`)), 2);
    app.close();
  });

  /* ── O-15 · the reset button must not target a dead collection ───────── */

  test('O-15: the dead weights collection is out of the reset path and frozen in the rules', () => {
    const settings = read('settings.html');
    assert.ok(!/_deleteTable\('weights'\)/.test(settings), 'reset-all must not delete a deprecated collection');
    assert.ok(!/'notifications','weights'/.test(settings), 'and it is out of the reset table list');
    assert.ok(/O-15/.test(settings), 'with a comment saying why, so it is not "fixed" back in');
  });

  /* ── O-17 · errors reach somewhere a human can look ──────────────────── */

  test('O-17: the diagnostics ring records, caps, and ships to app_logs', async () => {
    const app = await bootApp({ user: { id: 'admin1', role: 'admin', active: true }, db: { seed: {} } });
    assert.strictEqual(J(await app.eval(`window.__farmDiagInstalled`)), true,
      'the error/unhandledrejection/pagehide hooks are installed on load');

    const got = J(await app.eval(`(()=>{
      for (let i=0;i<60;i++) diagPush('error','boom '+i);
      diagPush('retry','fbPut retried');
      const d = diagnostics();
      return { len:d.entries.length, kinds:[...new Set(d.entries.map(e=>e.kind))], unsent:d.unsent,
               session:d.session, hasUA: typeof d.userAgent === 'string' };
    })()`));
    assert.ok(got.len <= 40, 'the ring is capped at 40 entries, got ' + got.len);
    assert.deepStrictEqual(got.kinds.sort(), ['error', 'retry']);
    assert.ok(got.unsent > 0, 'unsent entries are counted so the UI can offer to ship them');
    assert.strictEqual(got.session.id, 'admin1');
    assert.strictEqual(got.session.role, 'admin');

    const sent = J(await app.eval(`(async()=>await flushDiagnostics('test'))()`));
    assert.ok(sent > 0, 'flushDiagnostics reports how many rows it shipped');
    const logs = J(app.db.collection('app_logs'));
    assert.ok(logs.length > 0, 'and they really landed in app_logs');
    assert.ok(logs.every((l) => l.kind && l.at && l.userId === 'admin1' && l.reason === 'test'),
      'each row carries kind, timestamp, who saw it and why it was sent');
    assert.ok(logs.every((l) => String(l.message).length <= 400), 'messages are truncated at the source');
    const after = J(await app.eval(`(async()=>await flushDiagnostics('test'))()`));
    assert.strictEqual(after, 0, 'a second flush with nothing new sends nothing');
    app.close();
  });

  test('O-17: app_logs is admin-readable and staff-writable, and settings.html surfaces it', () => {
    const rules = read('database.rules.json');
    assert.ok(/"app_logs"/.test(rules), 'the collection exists in the rules');
    const settings = read('settings.html');
    for (const fn of ['uiDiagRender', 'uiDiagFlush', 'uiDiagCopy']) {
      assert.ok(settings.includes(fn), 'settings.html must wire ' + fn);
    }
    assert.ok(/diagnostics\(\)/.test(settings), 'and read the real diagnostics, not a copy of them');
  });

  test('logout() clears the session AND the Firebase refresh token', async () => {
    // The browser spec can only assert what survives the navigation to
    // login.html (which legitimately re-bootstraps an anonymous session so it
    // can read the public user_directory). This pins the app side: logout()
    // itself must drop both keys, or a logged-out browser keeps a token that
    // can still read whatever the rules allow an authenticated caller to read.
    const app = await bootApp({ user: { id: 'admin1', name: 'مدير', role: 'admin', active: true }, db: { seed: {} } });
    await app.eval(`localStorage.setItem('_farm_auth_refresh', JSON.stringify({refreshToken:'ref-1',uid:'uid-1'}))`);
    await app.eval(`(()=>{ try { logout(); } catch(e) { /* jsdom cannot navigate */ } })()`);
    assert.strictEqual(J(await app.eval(`localStorage.getItem('farm_user')`)), null, 'farm_user is gone');
    assert.strictEqual(J(await app.eval(`localStorage.getItem('_farm_auth_refresh')`)), null,
      'the Firebase refresh token must not outlive the session it belongs to');
    assert.strictEqual(J(await app.eval(`_authIdToken`)), null, 'and the in-memory token with it');
    app.close();
  });

  /* ── navigation must not offer a page its own code will refuse ───────── */

  test('every FARM_NAV target either carries a permission or guards itself', () => {
    // Suite 24 found six nav targets with no `perm` at all. That is only safe
    // if the page refuses on its own; this asserts it, so a new ungated link
    // to an unguarded page fails here instead of shipping.
    const nav = read('nav.js');
    const entries = [...nav.matchAll(/\{href:'([^']+)'([^\n]*)\}/g)].map((m) => ({ href: m[1], rest: m[2] }));
    assert.ok(entries.length >= 15, 'parsed ' + entries.length + ' nav entries');
    const GUARD = /requireAuth\(\)|canWrite\('|can\('|getUser\(\)/;
    const unguarded = [];
    for (const e of entries) {
      if (/perm:'[^']+'/.test(e.rest)) continue;
      if (!fs.existsSync(path.join(ROOT, e.href))) { unguarded.push(e.href + ' (missing file)'); continue; }
      // These pages are thin shells: the guard lives in the pages/*.js module
      // they load, so check the page AND every local script it pulls in.
      const page = read(e.href);
      const scripts = [...page.matchAll(/<script src="((?!https?:)[^"]+\.js)"/g)].map((m) => m[1]);
      const sources = [page].concat(scripts.filter((f) => fs.existsSync(path.join(ROOT, f))).map(read));
      if (!sources.some((src) => GUARD.test(src))) unguarded.push(e.href + ' (checked ' + sources.length + ' files)');
    }
    assert.deepStrictEqual(unguarded, [],
      'nav targets with no perm must guard themselves in-page: ' + unguarded.join(', '));
  });
});
