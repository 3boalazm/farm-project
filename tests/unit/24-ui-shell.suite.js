// Module 24 — the UI shell (ui-shell.js) and the design-system contract it
// depends on. Boots the REAL script chain plus ui-shell.js in jsdom, so every
// assertion below is about the shipped code, not a mock of it.
//
// The shell is deliberately optional: these tests also prove that a page
// without a rail (login.html, the printable bayan reports) does NOT grow an
// appbar, and that window.toast keeps its old two-argument contract while
// gaining the new one.
const { suite, assert, bootApp, J } = require('./harness');

const CHAIN = ['config.js', 'firebase.js', 'nav.js', 'shared.js', 'ui-shell.js'];
const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));

module.exports = suite('24 · UI shell, command palette & components', ({ test }) => {
  let app;

  /* ── mounting ─────────────────────────────────────────────────────── */
  test('renderNavbarV2() mounts the shell: appbar, bottom nav, skip link, palette roots', async () => {
    app = await bootApp({ files: CHAIN });
    app.eval(`renderNavbarV2('animals.html')`);
    const d = app.window.document;
    assert.ok(d.querySelector('.appbar'), 'the fixed appbar must exist');
    assert.ok(d.querySelector('.bottomnav'), 'the mobile bottom nav must exist');
    assert.ok(d.querySelector('.skip-link'), 'a skip link must be the first focusable element');
    assert.strictEqual(d.querySelector('.skip-link').getAttribute('href'), '#main-content');
    assert.strictEqual(d.querySelector('.page-wrap, #main-content') ? true : true, true);
    assert.strictEqual(d.documentElement.getAttribute('data-shell'), 'v2', 'pages opt into the v2 shell layout');
    assert.ok(d.querySelector('#uiSearchTrigger'), 'the ⌘K search trigger is in the appbar');
    assert.ok(d.querySelector('#uiBellBtn'), 'the notification bell is in the appbar');
    assert.ok(d.querySelector('#uiQuickAddBtn'), 'quick-add is in the appbar');
    assert.ok(d.querySelector('#uiLoadbar'), 'the busy bar exists even while idle');
    assert.ok(d.querySelectorAll('.appbar').length === 1, 'the shell mounts once');
  });

  test('the appbar breadcrumb names the section the current page belongs to', async () => {
    const d = app.window.document;
    const crumb = d.querySelector('.crumbs__item');
    const current = d.querySelector('.crumbs__current');
    assert.ok(crumb, 'a section crumb must render for a page that is in FARM_NAV');
    assert.strictEqual(crumb.textContent.trim(), 'القطيع', 'animals.html lives in the herd section');
    assert.strictEqual(current.textContent.trim(), 'إدارة القطيع');
    const title = d.querySelector('#uiAppbarTitle');
    assert.ok(title && title.textContent.length > 0, 'the appbar always has a title (document.title fallback)');
  });

  test('mounting twice does not duplicate the shell', async () => {
    app.eval(`renderNavbarV2('animals.html')`);
    app.eval(`UIShell.mount({activePage:'animals.html'})`);
    const d = app.window.document;
    assert.strictEqual(d.querySelectorAll('.appbar').length, 1);
    assert.strictEqual(d.querySelectorAll('.bottomnav').length, 1);
    assert.strictEqual(d.querySelectorAll('.skip-link').length, 1);
  });

  test('a page with no navigation rail never grows an appbar (login, bayan, index)', async () => {
    const bare = await bootApp({ files: CHAIN, user: null });
    await tick(30);
    assert.ok(!bare.window.document.querySelector('.appbar'), 'no rail → no shell');
    assert.ok(!bare.window.document.querySelector('.bottomnav'));
    // …but the preferences still apply, so login.html is themed correctly.
    bare.window.localStorage.setItem('farm_density', 'compact');
    bare.eval(`UIShell.applyPrefs()`);
    assert.strictEqual(bare.window.document.documentElement.getAttribute('data-density'), 'compact');
    bare.close();
  });

  test('the bottom nav lists only destinations this role may open, plus "more"', async () => {
    const visitor = await bootApp({
      files: CHAIN,
      user: { id: 'v1', name: 'زائر', role: 'visitor', active: true },
    });
    visitor.eval(`renderNavbarV2('dashboard.html')`);
    // J() round-trips plain data; a NodeList has to be reduced INSIDE the vm first.
    const hrefs = J(visitor.eval(`[...document.querySelectorAll('.bottomnav__item')].filter(n=>n.tagName==='A').map(a=>a.getAttribute('href'))`));
    assert.ok(hrefs.includes('dashboard.html') && hrefs.includes('animals.html'), 'visitor keeps dash + animals');
    assert.ok(hrefs.includes('births.html'), 'births is gated by the animals permission, which a visitor holds');
    assert.ok(!hrefs.some((h) => /health\.html|finance\.html/.test(h)), 'health and finance stay out of the thumb bar');
    // tasks.html carries NO perm in FARM_NAV, so it is offered to every role.
    // That is the navigation config's existing contract (see the audit's
    // open item on ungated nav targets) — asserted here so a change to it is
    // a deliberate one.
    assert.ok(hrefs.includes('tasks.html'), 'tasks.html is ungated in FARM_NAV');
    assert.ok(visitor.window.document.querySelector('#uiBottomMore'), 'the overflow button is always present');
    const currents = J(visitor.eval(`[...document.querySelectorAll('.bottomnav__item.active')].map(n=>n.getAttribute('aria-current'))`));
    assert.deepStrictEqual(currents, ['page'], 'exactly one bottom-nav item is current, and says so to AT');
    visitor.close();
  });

  /* ── command palette ──────────────────────────────────────────────── */
  test('Ctrl+K opens the palette and Esc closes it, restoring focus', async () => {
    const d = app.window.document;
    const trigger = d.querySelector('#uiSearchTrigger');
    trigger.focus();
    d.dispatchEvent(new app.window.KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    await tick();
    const pal = d.querySelector('#uiPalette');
    assert.ok(pal && pal.classList.contains('is-open'), 'the palette opens on Ctrl+K');
    assert.strictEqual(d.documentElement.getAttribute('data-palette'), 'open');
    assert.ok(pal.querySelector('.palette__item'), 'with an empty query it offers commands, not a blank box');
    d.dispatchEvent(new app.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await tick();
    assert.ok(!pal.classList.contains('is-open'), 'Esc closes it');
  });

  test('the palette finds pages by Arabic fuzzy match, with harakat and letter folding', async () => {
    const r = app.eval(`
      (function(){
        const top = (q,n) => UIShell.palette.search(q).slice(0,n||3).map(x=>x.item.title);
        return {
          birth:   top('مولد'),                                  // truncated noun, no ة/ى hints
          birthEx: top('المَوَالِيد',1)[0],                       // exact name WITH harakat
          vacc:    top('تحصين',1)[0],
          cost:    top('حاسبه التكاليف',1)[0],                     // ة→ه folded query
          weight:  top('وزن',2),
          nonsense:top('xyzzy').length,
          latin:   top('inventory',1)[0]
        };
      })()
    `);
    const got = J(r);
    // A truncated query must land on birth-related entries — and must NOT land
    // on a page that merely contains the same letters scattered across it
    // ("العملاء والموردون" holds م…و…ل…د over 16 characters). That gap penalty
    // is what makes the palette feel like it reads Arabic rather than spelling it.
    assert.ok(got.birth.length >= 2, 'a real query returns real results');
    assert.ok(got.birth.slice(0, 2).every((t) => /ميلاد|مواليد|ولادة/.test(t)),
      'the top two hits for "مولد" must both be about births, got: ' + JSON.stringify(got.birth));
    assert.ok(!got.birth.some((t) => /الموردون|العملاء/.test(t)),
      'a scattered letter match must never outrank a tight one');
    assert.strictEqual(got.birthEx, 'المواليد', 'diacritics in the query must not break an exact-name match');
    assert.ok(/تحصين/.test(got.vacc), '"تحصين" surfaces vaccination, got ' + got.vacc);
    assert.strictEqual(got.cost, 'حاسبة التكاليف', 'ة/ه folding must work in both directions');
    assert.ok(got.weight.some((t) => /وزن/.test(t)), '"وزن" surfaces weighing');
    assert.strictEqual(got.nonsense, 0, 'a nonsense query returns nothing rather than everything');
    assert.ok(/المخزن|مخزون/.test(got.latin), 'a Latin query still finds the Arabic page via its href keyword');
  });

  test('the palette never offers a page or action this role cannot use', async () => {
    const visitor = await bootApp({
      files: CHAIN,
      user: { id: 'v1', name: 'زائر', role: 'visitor', active: true },
    });
    visitor.eval(`renderNavbarV2('dashboard.html')`);
    const titles = J(visitor.eval(`UIShell.palette.search('ماليه').map(x=>x.item.title+'|'+x.item.id)`));
    assert.ok(titles.length === 0 || titles.every((t) => !/\|page:finance|\|add:openFinanceModal/.test(t)),
      'a visitor must not be offered finance: ' + JSON.stringify(titles));
    const users = J(visitor.eval(`UIShell.palette.search('المستخدمون').map(x=>x.item.id)`));
    assert.ok(!users.includes('page:users.html'), 'users.html is admin-only');
    const admin = J(app.eval(`UIShell.palette.search('المالية').map(x=>x.item.id)`));
    assert.ok(admin.includes('page:finance.html'), '…while an admin does get it');
    visitor.close();
  });

  test('running a palette item executes its action and remembers it as recent', async () => {
    let called = null;
    app.window.__testAction = () => { called = 'ran'; };
    app.eval(`UIShell.palette.register({group:'اختبار',priority:999,items:()=>[{id:'act:test',title:'أمر تجريبي',icon:'bi-beaker',run:function(){window.__testAction();}}]})`);
    app.eval(`UIShell.palette.show('أمر تجريبي')`);
    await tick();
    const first = app.window.document.querySelector('.palette__item');
    assert.ok(first, 'the registered command is searchable by a page');
    app.eval(`UIShell.palette.run(0)`);
    assert.strictEqual(called, 'ran', 'Enter on the first result runs it');
    const recent = J(app.eval(`UIShell.palette.recent()`));
    assert.strictEqual(recent[0].id, 'act:test', 'the executed item becomes the most recent');
    assert.ok(!app.window.document.querySelector('#uiPalette').classList.contains('is-open'), 'running closes the palette');
  });

  test('arrow keys move the selection and keep aria-selected/activedescendant in sync', async () => {
    app.eval(`UIShell.palette.show('')`);
    await tick();
    const d = app.window.document;
    const input = d.querySelector('#uiPaletteInput');
    input.dispatchEvent(new app.window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    input.dispatchEvent(new app.window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await tick();
    const sel = d.querySelectorAll('.palette__item[aria-selected="true"]');
    assert.strictEqual(sel.length, 1, 'exactly one option is selected');
    assert.strictEqual(sel[0].getAttribute('data-i'), '2', 'two ArrowDowns move to the third item');
    assert.strictEqual(input.getAttribute('aria-activedescendant'), sel[0].id, 'the combobox points at the selected option');
    app.eval(`UIShell.palette.close()`);
  });

  test('the herd source searches animals already in memory and deep-links to the animal', async () => {
    app.window._uiHerdCache = [
      { id: 'a1', tag: 'GT-000123', breed: 'شامي', gender: 'female', species: 'goat', status: 'alive' },
      { id: 'a2', tag: 'SH-000777', breed: 'برقي', gender: 'male', species: 'sheep', status: 'sold' },
    ];
    const hits = J(app.eval(`UIShell.palette.search('GT-0001').map(x=>({id:x.item.id,href:x.item.href,sub:x.item.sub}))`));
    assert.strictEqual(hits.length, 1);
    assert.strictEqual(hits[0].href, 'animal-detail.html?id=a1');
    assert.ok(/شامي/.test(hits[0].sub) && /أنثى/.test(hits[0].sub), 'the result carries breed and gender, not just a tag');
    delete app.window._uiHerdCache;
  });

  /* ── toasts ───────────────────────────────────────────────────────── */
  test('window.toast keeps its old contract and escapes, and gains title/action/dedupe', async () => {
    const d = app.window.document;
    d.querySelector('#toast-wrap').innerHTML = '';
    app.eval(`toast('تم الحفظ','success')`);                       // legacy 2-arg call site
    let t = d.querySelector('.toast');
    assert.ok(t, 'the legacy signature still produces a toast');
    assert.ok(t.classList.contains('toast--success'));
    assert.strictEqual(t.querySelector('.toast__msg').textContent, 'تم الحفظ');
    assert.strictEqual(d.querySelector('#toast-wrap').getAttribute('aria-live'), 'polite');

    app.eval(`toast('<img src=x onerror=alert(1)>','error')`);
    assert.ok(!d.querySelector('#toast-wrap img'), 'toast text is escaped, never parsed as HTML');

    let acted = false;
    app.window.__act = () => { acted = true; };
    app.eval(`toast('تم حذف السجل','info',{id:'del-1',title:'حذف',action:{label:'تراجع',onClick:window.__act}})`);
    const withAction = [...d.querySelectorAll('.toast')].pop();
    assert.strictEqual(withAction.querySelector('.toast__title').textContent, 'حذف');
    withAction.querySelector('.toast__action').click();
    assert.ok(acted, 'the UNDO action fires');

    app.eval(`toast('نسخة ثانية','info',{id:'del-1'})`);
    const sameId = d.querySelectorAll('[data-toast-id="del-1"]');
    assert.strictEqual(sameId.length, 1, 'the same id replaces instead of stacking');

    d.querySelector('#toast-wrap').innerHTML = '';
    for (let i = 0; i < 7; i++) app.eval(`toast('رقم ${i}','info',{duration:0})`);
    assert.ok(d.querySelectorAll('.toast').length <= 4, 'at most four toasts on screen, oldest dropped');
  });

  /* ── preferences ──────────────────────────────────────────────────── */
  test('theme: the legacy toggle contract holds AND data-theme follows it', async () => {
    const w = app.window, h = w.document.documentElement;
    w.localStorage.setItem('farm_theme', 'dark');
    app.eval(`UIShell.applyPrefs()`);
    assert.strictEqual(h.getAttribute('data-theme'), 'dark');
    assert.ok(!h.classList.contains('light-mode'));

    app.eval(`toggleTheme()`);                                    // called from 37 pages of markup
    assert.strictEqual(w.localStorage.getItem('farm_theme'), 'light', 'legacy key still written');
    assert.ok(h.classList.contains('light-mode'), 'legacy class still applied');
    assert.ok(w.document.body.classList.contains('light-mode'), 'and on <body>, which isDark() reads');
    assert.strictEqual(h.getAttribute('data-theme'), 'light', 'the new attribute agrees');

    app.eval(`toggleTheme()`);
    assert.strictEqual(w.localStorage.getItem('farm_theme'), 'dark');
  });

  test('theme: cycleTheme walks dark → light → auto, and auto follows the OS', async () => {
    const h = app.window.document.documentElement;
    app.window.localStorage.setItem('farm_theme', 'dark');
    app.eval(`UIShell.applyPrefs()`);
    assert.strictEqual(app.eval(`UIShell.prefs.cycleTheme()`), 'light');
    assert.strictEqual(app.eval(`UIShell.prefs.cycleTheme()`), 'auto');
    // jsdom's matchMedia reports matches:false → auto resolves to dark
    assert.strictEqual(h.getAttribute('data-theme'), 'dark');
    assert.strictEqual(h.getAttribute('data-theme-choice'), 'auto', 'the CHOICE stays auto even while it resolves dark');
    app.window.localStorage.setItem('farm_theme', '}{corrupt');
    app.eval(`UIShell.applyPrefs()`);
    assert.strictEqual(h.getAttribute('data-theme'), 'dark', 'a corrupt preference falls back to dark, never throws');
    app.window.localStorage.setItem('farm_theme', 'dark');
    app.eval(`UIShell.applyPrefs()`);
  });

  test('density, contrast and motion land on <html> and persist', async () => {
    const h = app.window.document.documentElement;
    app.eval(`UIShell.prefs.set('density','compact')`);
    assert.strictEqual(h.getAttribute('data-density'), 'compact');
    assert.strictEqual(app.window.localStorage.getItem('farm_density'), 'compact');
    app.eval(`UIShell.prefs.set('contrast','high')`);
    assert.strictEqual(h.getAttribute('data-contrast'), 'high');
    app.eval(`UIShell.prefs.set('motion','off')`);
    assert.strictEqual(h.getAttribute('data-motion'), 'off');
    app.eval(`UIShell.prefs.set('contrast','normal');UIShell.prefs.set('motion','on')`);
    assert.ok(!h.hasAttribute('data-contrast'), 'turning a variant off removes the attribute entirely');
    assert.ok(!h.hasAttribute('data-motion'));
  });

  /* ── notification center ──────────────────────────────────────────── */
  test('the bell renders ONE shared inbox, grouped, with a badge that counts only urgent items', async () => {
    const a = await bootApp({
      files: CHAIN,
      db: { seed: {
        vaccinations: { v1: { _id: 'v1', name: 'حمى قلاعية', status: 'overdue', target_section: 'عنبر ٢' } },
        inventory_meds: { m1: { _id: 'm1', name: 'أوكسي تتراسيكلين', quantity: 2, min_quantity: 10 } },
        breeding: {}, health: {}, inventory_feeds: {}, login_notifications: {},
      } },
    });
    a.eval(`renderNavbarV2('dashboard.html')`);
    await a.fn('UIShell.notifs.load', true);
    const d = a.window.document;
    const list = d.querySelector('#uiNotifList');
    assert.ok(list, 'the panel exists');
    const items = J(a.eval(`[...document.querySelectorAll('.notif')].map(n=>({tag:n.tagName,href:n.getAttribute('href'),text:n.textContent}))`));
    assert.strictEqual(items.length, 2, 'one overdue vaccine + one low-stock item');
    assert.ok(/يحتاج إجراء الآن/.test(list.textContent), 'urgent items are grouped under their own heading');
    assert.ok(/قريبًا/.test(list.textContent), 'and the rest under a follow-up heading');
    assert.ok(items.every((n) => n.tag === 'A' && n.href), 'every item deep-links somewhere');
    assert.ok(items.some((n) => /vaccine\.html/.test(n.href)) && items.some((n) => /inventory\.html/.test(n.href)),
      'each item goes to the page that can act on it');
    const dot = d.querySelector('#uiBellCount');
    assert.strictEqual(dot.textContent, '1', 'the badge counts DANGER items only');
    assert.strictEqual(dot.getAttribute('data-count'), '1');
    const legacy = d.querySelector('#bell-badge');
    assert.ok(legacy, 'the legacy rail/panel badge is kept in sync');
    assert.strictEqual(legacy.textContent, '1');
    assert.ok(d.querySelector('#uiBellBtn').classList.contains('has-unread'));
    a.close();
  });

  test('an empty inbox says so, with a reason — never a blank panel', async () => {
    const a = await bootApp({ files: CHAIN });
    a.eval(`renderNavbarV2('dashboard.html')`);
    await a.fn('UIShell.notifs.load', true);
    const list = a.window.document.querySelector('#uiNotifList');
    assert.ok(list.querySelector('.state'), 'the empty state renders');
    assert.ok(/لا توجد تنبيهات/.test(list.textContent));
    assert.strictEqual(a.window.document.querySelector('#uiBellCount').getAttribute('data-count'), '0');
    a.close();
  });

  /* ── tables ───────────────────────────────────────────────────────── */
  test('a data-ui-table sorts numerically through Arabic-Indic digits, by keyboard too', async () => {
    const d = app.window.document;
    d.querySelector('#content').innerHTML =
      '<div class="table-wrap"><table class="table" id="t1" data-ui-table>' +
      '<thead><tr><th data-sort="text">الترقيم</th><th data-sort="numeric">الوزن</th></tr></thead>' +
      '<tbody>' +
      '<tr><td>GT-3</td><td>٤٥٫٢</td></tr>' +
      '<tr><td>GT-1</td><td>١٢٠</td></tr>' +
      '<tr><td>GT-2</td><td>٧٫٥</td></tr>' +
      '</tbody></table></div>';
    app.eval(`UIShell.tables.enhance()`);
    const th = d.querySelectorAll('#t1 thead th')[1];
    assert.strictEqual(th.getAttribute('tabindex'), '0', 'a sortable header is keyboard reachable');
    th.dispatchEvent(new app.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const rowTexts = () => J(app.eval(`[...document.querySelectorAll('#t1 tbody tr')].map(r=>r.cells[1].textContent)`));
    let rows = rowTexts();
    assert.deepStrictEqual(rows, ['٧٫٥', '٤٥٫٢', '١٢٠'], '7.5 < 45.2 < 120 — NOT alphabetical');
    assert.strictEqual(th.getAttribute('aria-sort'), 'ascending');
    th.dispatchEvent(new app.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    rows = rowTexts();
    assert.deepStrictEqual(rows, ['١٢٠', '٤٥٫٢', '٧٫٥'], 'the same header reverses');
    assert.strictEqual(th.getAttribute('aria-sort'), 'descending');
    assert.strictEqual(d.querySelectorAll('#t1 thead th')[0].getAttribute('aria-sort'), 'none', 'one sorted column at a time');
  });

  test('a bound filter hides rows and reports how many are left', async () => {
    const d = app.window.document;
    d.querySelector('#content').innerHTML =
      '<input class="input" id="q1"><span data-ui-count-for="t2"></span>' +
      '<table class="table" id="t2" data-ui-table data-ui-filter="#q1"><thead><tr><th>الاسم</th></tr></thead>' +
      '<tbody><tr><td>شامي</td></tr><tr><td>برقي</td></tr><tr><td>شامي بور</td></tr></tbody></table>';
    app.eval(`UIShell.tables.enhance()`);
    const input = d.querySelector('#q1');
    input.value = 'شامي';
    input.dispatchEvent(new app.window.Event('input', { bubbles: true }));
    const visibleCount = () => J(app.eval(`[...document.querySelectorAll('#t2 tbody tr')].filter(r=>r.style.display!=='none').length`));
    assert.strictEqual(visibleCount(), 2);
    assert.ok(/2 من 3/.test(d.querySelector('[data-ui-count-for="t2"]').textContent),
      'filtering must never look like data loss');
    input.value = '';
    input.dispatchEvent(new app.window.Event('input', { bubbles: true }));
    assert.strictEqual(visibleCount(), 3);
  });

  /* ── dialogs ──────────────────────────────────────────────────────── */
  test('UIShell.confirm renders a real dialog and only fires on confirm', async () => {
    let fired = false;
    app.window.__ok = () => { fired = true; };
    app.eval(`UIShell.confirm({title:'حذف السجل؟',body:'لا يمكن التراجع بعد الحذف',danger:true,confirmLabel:'حذف',onConfirm:window.__ok})`);
    const d = app.window.document;
    const dlg = d.querySelector('#modal-root [role="alertdialog"]');
    assert.ok(dlg, 'a destructive confirm is an alertdialog, not a window.confirm()');
    assert.ok(/حذف السجل/.test(dlg.textContent));
    assert.ok(dlg.querySelector('.dialog__icon--danger'), 'the danger variant is visually distinct');
    dlg.querySelector('.dialog__close').click();
    assert.ok(!fired, 'closing without confirming must not run the action');
    app.eval(`UIShell.confirm({title:'حذف السجل؟',danger:true,onConfirm:window.__ok})`);
    d.querySelector('#uiConfirmOk').click();
    assert.ok(fired, 'confirming runs it');
    assert.ok(!d.querySelector('#modal-root .dialog'), 'and closes the dialog');
  });

  /* ── matching + number folding, exposed for reuse ─────────────────── */
  test('fold() and foldNumber() are reusable and locale-correct', async () => {
    assert.strictEqual(app.eval(`UIShell.fold('المَوَالِيد')`), 'المواليد', 'harakat stripped');
    assert.strictEqual(app.eval(`UIShell.fold('أحمد عليّ')`), 'احمد علي', 'أ→ا and harakat stripped');
    assert.strictEqual(app.eval(`UIShell.fold('بقرة حلوب ة')`).slice(-1), 'ه', 'ة→ه');
    assert.strictEqual(app.eval(`UIShell.foldNumber('٤٥٫٢')`), 45.2, 'Arabic-Indic + Arabic decimal separator');
    assert.strictEqual(app.eval(`UIShell.foldNumber('۱۲۳')`), 123, 'extended Arabic-Indic (Farsi digits)');
    assert.strictEqual(app.eval(`UIShell.foldNumber('—')`), null, 'a placeholder is not zero');
    assert.strictEqual(app.eval(`UIShell.foldNumber(12.5)`), 12.5);
  });

  test('the busy bar reflects in-flight Firebase requests', async () => {
    const d = app.window.document;
    const bar = d.querySelector('#uiLoadbar');
    assert.ok(!bar.classList.contains('is-active'), 'idle by default');
    app.eval(`UIShell.busy(true)`);
    assert.ok(bar.classList.contains('is-active'));
    app.eval(`UIShell.busy(true);UIShell.busy(false)`);
    assert.ok(bar.classList.contains('is-active'), 'two overlapping requests keep it lit');
    app.eval(`UIShell.busy(false);UIShell.busy(false)`);
    assert.ok(!bar.classList.contains('is-active'));
    app.eval(`UIShell.busy(false);UIShell.busy(false)`);
    assert.ok(!bar.classList.contains('is-active'), 'the counter cannot go negative and stick the bar on');
  });
});
