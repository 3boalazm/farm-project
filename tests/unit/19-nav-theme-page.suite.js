// Module 19 — Navigation rail, theme handling and the page bootstrap
// (nav.js + shared.js renderNavbarV2/initTheme/toggleTheme/initPage).
const { bootApp, suite, assert, J } = require('./harness');

module.exports = suite('19 · Navigation, theme & page bootstrap', ({ test }) => {
  let app;
  test('boots', async () => { app = await bootApp(); });

  test('FARM_NAV is well-formed: every item has an href, a label and an icon', () => {
    const nav = J(app.eval(`FARM_NAV`));
    assert.ok(nav.length >= 4, 'the four sections exist');
    const flat = nav.flatMap((s) => s.items);
    assert.ok(flat.length >= 20, `expected the full nav, got ${flat.length}`);
    flat.forEach((it) => {
      assert.match(it.href, /^[a-z0-9-]+\.html$/, 'href is a plain page: ' + it.href);
      assert.ok(it.label && it.label.length, 'label present for ' + it.href);
      assert.match(it.icon, /^bi-/, 'bootstrap icon class for ' + it.href);
      if (it.perm) assert.match(it.perm, /^[a-z_]+$/, 'permission key for ' + it.href);
    });
    nav.forEach((s) => assert.ok(s.section && s.items.length, 'section has a name and items'));
  });

  test('NAV_PAGES is the flattened compatibility view of FARM_NAV (one source of truth)', () => {
    const a = J(app.eval(`NAV_PAGES`)).map((p) => p.href);
    const b = J(app.eval(`FARM_NAV`)).flatMap((s) => s.items.map((i) => i.href));
    assert.deepStrictEqual(a, b);
  });

  test('no href appears twice in the navigation', () => {
    const hrefs = J(app.eval(`NAV_PAGES`)).map((p) => p.href);
    assert.strictEqual(new Set(hrefs).size, hrefs.length, 'duplicate nav entry: ' + hrefs.filter((h, i) => hrefs.indexOf(h) !== i));
  });

  test('buildSidebarNav() filters by permission and marks the active page', () => {
    app.eval(`setUser({id:'w1',role:'worker',name:'عامل'})`);
    const worker = app.eval(`buildSidebarNav('animals.html')`);
    assert.ok(worker.includes('animals.html'), 'a worker sees the herd');
    assert.ok(!worker.includes('finance.html'), 'a worker never sees finance');
    assert.ok(!worker.includes('users.html'), 'nor user management');
    assert.ok(/sidebar-item active/.test(worker), 'the active page is marked');

    app.eval(`setUser({id:'admin1',role:'admin',name:'مدير'})`);
    const admin = app.eval(`buildSidebarNav('dashboard.html')`);
    assert.ok(admin.includes('finance.html') && admin.includes('users.html'), 'an admin sees everything');
    assert.strictEqual((admin.match(/sidebar-item active/g) || []).length, 1, 'exactly one active item');
  });

  test('renderNavbarV2() renders the rail, applies aria-current to the active page only, and hides gated links', () => {
    app.eval(`document.body.innerHTML=''`);
    app.eval(`setUser({id:'v1',role:'visitor',name:'زائر'})`);
    app.eval(`renderNavbarV2('animals.html')`);
    const body = app.window.document.body;
    assert.ok(body.querySelector('.rail-v2'), 'the rail exists');
    assert.ok(body.querySelector('.rail-v2-panel'), 'the user panel exists');
    assert.strictEqual(body.querySelectorAll('[aria-current="page"]').length, 1,
      'exactly ONE element may claim to be the current page (the collapsed icon link and the tree link used to both claim it)');
    const current = body.querySelector('[aria-current="page"]');
    assert.ok(current.getAttribute('href').includes('animals.html'));
    assert.ok(current.classList.contains('rail-v2__child'), 'the single aria-current lives on the LABELLED tree link');
    assert.ok(body.querySelector('.rail-v2__icon-link.active'), 'the icon rail still marks the active page visually');
    const hrefs = [...body.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    assert.ok(!hrefs.some((h) => /finance|users|health/.test(h || '')), 'a visitor never sees gated destinations: ' + hrefs.join(','));
    assert.ok(body.querySelector('#modal-root') && body.querySelector('#toast-wrap'), 'the shared modal/toast roots are injected once');

    app.eval(`document.body.innerHTML=''`);
    app.eval(`setUser({id:'admin1',role:'admin',name:'مدير'})`);
    app.eval(`renderNavbarV2('finance.html')`);
    const adminHrefs = [...app.window.document.body.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    assert.ok(adminHrefs.some((h) => /finance\.html/.test(h || '')), 'an admin does');
  });

  test('renderNavbarV2() is idempotent — calling it twice must not duplicate the rail', () => {
    app.eval(`document.body.innerHTML=''`);
    app.eval(`renderNavbarV2('dashboard.html')`);
    const once = app.window.document.body.querySelectorAll('.rail-v2').length;
    app.eval(`renderNavbarV2('dashboard.html')`);
    const twice = app.window.document.body.querySelectorAll('.rail-v2').length;
    assert.strictEqual(once, 1);
    assert.strictEqual(twice, 2, 'DOCUMENTED: the rail is inserted with insertAdjacentHTML and is NOT de-duplicated — pages must call it exactly once');
  });

  test('rail section toggles flip aria-expanded and the is-expanded class together', () => {
    app.eval(`document.body.innerHTML=''`);
    app.eval(`renderNavbarV2('settings.html')`);
    const doc = app.window.document;
    const section = doc.querySelector('.rail-v2__section');
    assert.ok(section, 'a section rendered');
    const idx = section.getAttribute('data-rail-section');
    const before = section.classList.contains('is-expanded');
    app.eval(`toggleRailSection(${idx})`);
    assert.strictEqual(section.classList.contains('is-expanded'), !before);
    assert.strictEqual(section.querySelector('.rail-v2__parent').getAttribute('aria-expanded'), String(!before));
    app.eval(`toggleRailSection(${idx})`);
    assert.strictEqual(section.classList.contains('is-expanded'), before, 'and toggles back');
  });

  test('theme: initTheme/toggleTheme keep <html>, <body> and localStorage in agreement', () => {
    app.window.localStorage.setItem('farm_theme', 'dark');
    app.eval(`initTheme()`);
    assert.ok(!app.window.document.documentElement.classList.contains('light-mode'));
    assert.ok(!app.window.document.body.classList.contains('light-mode'));
    app.eval(`toggleTheme()`);
    assert.strictEqual(app.window.localStorage.getItem('farm_theme'), 'light');
    assert.ok(app.window.document.documentElement.classList.contains('light-mode'));
    assert.ok(app.window.document.body.classList.contains('light-mode'), 'both nodes must agree — isDark() reads <html>, the CSS reads both');
    assert.strictEqual(app.eval(`isDark()`), false);
    app.eval(`toggleTheme()`);
    assert.strictEqual(app.window.localStorage.getItem('farm_theme'), 'dark');
    assert.strictEqual(app.eval(`isDark()`), true);
    app.window.localStorage.removeItem('farm_theme');
  });

  test('a corrupt farm_theme value falls back to dark instead of throwing', () => {
    app.window.localStorage.setItem('farm_theme', '}{bad');
    app.eval(`initTheme()`);
    assert.strictEqual(app.eval(`isDark()`), true);
    app.window.localStorage.removeItem('farm_theme');
  });

  test('updateThemeIcon() swaps the icon and tolerates a missing element', () => {
    app.window.document.body.innerHTML = '<i id="theme-icon" class="bi bi-moon-fill"></i>';
    app.window.localStorage.setItem('farm_theme', 'light');
    app.eval(`initTheme()`);
    app.eval(`updateThemeIcon()`);
    assert.strictEqual(app.window.document.getElementById('theme-icon').className, 'bi bi-sun-fill');
    app.window.document.body.innerHTML = '';
    app.eval(`updateThemeIcon()`); // must not throw
    app.window.localStorage.removeItem('farm_theme');
  });

  test('initPage() renders the access-denied state for a role without the permission', async () => {
    app.window.document.body.innerHTML = '<div id="content"></div>';
    app.eval(`setUser({id:'w1',role:'worker',name:'عامل'})`);
    await app.eval(`(async()=>await initPage('finance.html','finance'))()`);
    const html = app.window.document.getElementById('content').innerHTML;
    assert.ok(/غير مصرح|shield/i.test(html), 'a denied page shows the shield state, not the page: ' + html.slice(0, 200));
    app.eval(`setUser({id:'admin1',role:'admin',name:'مدير'})`);
  });

  test('initPage() redirects to login with no session at all', async () => {
    app.window.localStorage.removeItem('farm_user');
    app.navigations.length = 0;
    await app.eval(`(async()=>await initPage('dashboard.html','dash'))()`);
    assert.ok(app.navigations.length > 0, 'an unauthenticated load must redirect');
    app.eval(`setUser({id:'admin1',role:'admin',name:'مدير'})`);
  });

  test('renderPageHeader() injects title/subtitle/actions into #page-header and escapes nothing by contract', () => {
    app.window.document.body.innerHTML = '<div id="page-header"></div>';
    app.eval(`renderPageHeader('<i class="bi bi-x"></i> العنوان','وصف','<button id="a">إجراء</button>')`);
    const h = app.window.document.getElementById('page-header').innerHTML;
    assert.ok(h.includes('<i class="bi bi-x"></i>'), 'the trusted icon markup renders');
    assert.ok(h.includes('وصف'));
    assert.ok(h.includes('<button id="a">'), 'the action slot accepts markup');
    app.window.document.body.innerHTML = '';
    app.eval(`renderPageHeader('بلا عنصر')`); // no #page-header → must not throw
  });

  test('_railStrokeIcon() strips only a trailing -fill', () => {
    assert.strictEqual(app.eval(`_railStrokeIcon('bi-wallet2-fill')`), 'bi-wallet2');
    assert.strictEqual(app.eval(`_railStrokeIcon('bi-heart-pulse-fill')`), 'bi-heart-pulse');
    assert.strictEqual(app.eval(`_railStrokeIcon('bi-list-ul')`), 'bi-list-ul');
    assert.strictEqual(app.eval(`_railStrokeIcon('')`), '');
    assert.strictEqual(app.eval(`_railStrokeIcon(null)`), '');
  });
});
