// Module 28 — the 2026-10-20 owner report:
//
//   «شيل اي ذكر لاي اسماء جوا التطبيق»
//   «وفي اليوزرز لما احتاج احذف يوزر مش بيتحذف وكذلك حذف البيانات في جميع
//     الاعدادات بتاع التطبيق مش شغالة»
//
// Three defects, all reproducible without a browser:
//
//   1 · `UIShell.confirm` was callback-only and returned undefined, while
//       users.html did `const ok = await UIShell.confirm({...}); if(!ok) return;`
//       — so the trash button cancelled itself every single time, silently.
//       settings.html went further and called `.then()` on that undefined,
//       which threw. It also passed `message:` to a dialog that only read
//       `body:`, so even when it did open it showed a title and no explanation.
//   2 · Every destructive action in the app guarded itself with the native
//       `window.confirm()` / `window.prompt()`. Neither is bridged in the
//       Capacitor WebView: confirm() returns false and prompt() returns null,
//       so on a phone "مسح كل البيانات" answered "تم الإلغاء" and deleted
//       nothing, and 23 other delete/bulk guards did the same.
//   3 · `_deleteTable()` in settings.html used a raw `fetch` and returned a
//       bare boolean, so a rules denial and a dropped packet both produced
//       "تحقق من الاتصال" — the owner checked his network while the deployed
//       rules were what refused him. And a personal-name credit line was
//       rendered in the footer of all 32 app pages.
//
// These tests pin the fixes: farmConfirm() is a promise in all three
// environments, Users.del() cannot be aborted by one denied collection and
// reports why, the wipes classify their failures, and no name and no native
// dialog remain anywhere in the app.
const fs = require('fs');
const path = require('path');
const { suite, assert, bootApp, ROOT, J } = require('./harness');

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const APP_FILES = ['config.js', 'firebase.js', 'nav.js', 'shared.js', 'ui-shell.js'];
const ADMIN = { id: 'admin1', name: 'T', role: 'admin', active: true };

// Every page and page module that ships inside the app (the APK copy is a
// mirror and is checked for drift by suite 22).
const APP_SOURCES = () => [
  ...fs.readdirSync(ROOT).filter((f) => f.endsWith('.html') && !/^index\.html$/.test(f)),
  ...fs.readdirSync(path.join(ROOT, 'pages')).filter((f) => f.endsWith('.js')).map((f) => 'pages/' + f),
  'shared.js', 'firebase.js', 'ui-shell.js', 'nav.js', 'ui.css',
];

const settle = (ms = 40) => new Promise((r) => setTimeout(r, ms));

// Static assertions below read the CODE. Both fixed functions carry comments
// that quote the old broken call (`UIShell.confirm({...})`, `window.prompt()`),
// so strip line comments first or the test fails on its own explanation.
const code = (src) => src.split('\n')
  .map((l) => (l.trim().startsWith('//') || l.trim().startsWith('*') ? '' : l))
  .join('\n');

async function bootShell(seed = {}) {
  return bootApp({ files: APP_FILES, user: ADMIN, db: { seed }, settleMs: 30 });
}

// Ask for a confirmation and hand back the promise's eventual value.
function ask(app, opts) {
  app.eval(`window.__answer = 'pending';
    farmConfirm(${JSON.stringify(opts)}).then(function (v) { window.__answer = v; });`);
}
const answer = (app) => app.window.__answer;

module.exports = suite('28 · Destructive actions actually work (confirm contract, wipes, no names)', ({ test }) => {

  /* ── 1 · the confirm contract ─────────────────────────────────────── */

  test('farmConfirm is a promise: true on confirm, and it renders `message` (the alias callers actually pass)', async () => {
    const app = await bootShell();
    ask(app, { title: 'حذف مستخدم', message: 'حذف سارة؟ لا يمكن التراجع.', confirmLabel: 'حذف', danger: true });
    const d = app.window.document;
    const dlg = d.querySelector('#modal-root [role="alertdialog"]');
    assert.ok(dlg, 'the shell dialog must open');
    assert.ok(dlg.textContent.includes('سارة'),
      'the explanation must render — callers pass `message`, the dialog used to read only `body`');
    assert.ok(dlg.querySelector('.dialog__icon--danger'), 'and it is visually a destructive action');
    assert.strictEqual(answer(app), 'pending', 'the promise must not settle before the operator answers');
    d.querySelector('#uiConfirmOk').click();
    await settle();
    assert.strictEqual(answer(app), true, 'confirming resolves true — awaiting it must not read as a cancel');
    assert.ok(!d.querySelector('#modal-root .dialog'), 'and the dialog closes');
    app.close();
  });

  test('cancelling, closing and pressing Escape all resolve false — never a hang', async () => {
    const app = await bootShell();
    const d = app.window.document;

    ask(app, { title: 'حذف', message: '؟', danger: true });
    d.querySelector('#uiConfirmCancel').click();
    await settle();
    assert.strictEqual(answer(app), false, 'the cancel button resolves false');

    ask(app, { title: 'حذف', message: '؟', danger: true });
    d.querySelector('#uiConfirmX').click();
    await settle();
    assert.strictEqual(answer(app), false, 'the × button resolves false');

    ask(app, { title: 'حذف', message: '؟', danger: true });
    d.dispatchEvent(new app.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle(80);
    assert.strictEqual(answer(app), false,
      'shared.js closes the modal on Escape without touching our buttons — the promise must still settle');
    app.close();
  });

  test('the callback contract still works, so the shell\'s own logout dialog did not regress', async () => {
    const app = await bootShell();
    let fired = false;
    app.window.__ok = () => { fired = true; };
    app.eval(`UIShell.confirm({title:'تسجيل الخروج؟',body:'سيتم إنهاء الجلسة',danger:true,onConfirm:window.__ok})`);
    app.window.document.querySelector('#uiConfirmOk').click();
    await settle();
    assert.ok(fired, 'onConfirm still fires for the two callers inside ui-shell.js');
    app.close();
  });

  test('with no shell modal it falls back to window.confirm, and with neither it builds a real panel', async () => {
    const app = await bootShell();
    const w = app.window;
    // Tier 2 — a plain browser without shared.js showModal().
    w.__showModal = w.showModal; w.__confirm = w.confirm;
    w.eval('window.showModal = undefined; window.confirm = function () { return true; };');
    ask(app, { title: 'حذف', message: '؟', danger: true });
    await settle();
    assert.strictEqual(answer(app), true, 'window.confirm is honoured when the shell dialog is unavailable');

    // Tier 3 — a Capacitor WebView: no showModal, and confirm()/prompt() are
    // not bridged at all. This is the case where every destructive action in
    // the app used to cancel itself silently.
    w.eval('window.confirm = undefined;');
    ask(app, { title: 'مسح كل البيانات', message: 'لا يمكن التراجع.', confirmLabel: 'امسح', danger: true });
    const panel = w.document.querySelector('.farm-confirm-fallback');
    assert.ok(panel, 'an inline panel must appear — a missing browser feature must not cancel the action');
    assert.ok(panel.textContent.includes('لا يمكن التراجع'), 'and it must say what it is about to do');
    assert.strictEqual(answer(app), 'pending');
    panel.querySelector('#uiConfirmOk').click();
    await settle();
    assert.strictEqual(answer(app), true, 'the fallback panel confirms');
    assert.ok(!w.document.querySelector('.farm-confirm-fallback'), 'and removes itself');
    w.eval('window.showModal = window.__showModal; window.confirm = window.__confirm;');
    app.close();
  });

  test('typeToConfirm replaces window.prompt(): the destructive button stays disabled until the phrase matches', async () => {
    const app = await bootShell();
    const d = app.window.document;
    ask(app, { title: 'مسح كل البيانات', message: '؟', typeToConfirm: 'تأكيد', confirmLabel: 'امسح', danger: true });
    const ok = d.querySelector('#uiConfirmOk');
    const input = d.querySelector('#uiConfirmType');
    assert.ok(input, 'the phrase is typed inside the dialog, not through window.prompt()');
    assert.strictEqual(ok.disabled, true, 'disabled until the operator types the phrase');
    ok.click();
    await settle();
    assert.strictEqual(answer(app), 'pending', 'a click while disabled must not wipe anything');
    input.value = 'تأك';
    input.dispatchEvent(new app.window.Event('input', { bubbles: true }));
    assert.strictEqual(ok.disabled, true, 'a partial phrase is not a confirmation');
    input.value = 'تأكيد';
    input.dispatchEvent(new app.window.Event('input', { bubbles: true }));
    assert.strictEqual(ok.disabled, false);
    ok.click();
    await settle();
    assert.strictEqual(answer(app), true);
    app.close();
  });

  test('no app page guards a destructive action with the native confirm()/prompt() any more', () => {
    const offenders = [];
    for (const rel of APP_SOURCES()) {
      if (!/\.(html|js)$/.test(rel)) continue;
      // Comments explain the old broken call by name (that is the point of a
      // bug doc), so strip them first and scan only code.
      const lines = read(rel).replace(/\/\*[\s\S]*?\*\//g, '').split('\n');
      lines.forEach((l, i) => {
        const t = l.trim();
        if (t.startsWith('//') || t.startsWith('*')) return;
        // a bare confirm( / prompt( that is not ours and not a property access
        if (/(^|[^\w.$])(confirm|prompt)\s*\(/.test(l)
          && !/farmConfirm|farmPrompt|UIShell\.confirm|root\.confirm|root\.prompt|uiConfirm|uiPrompt|onConfirm|window\.__confirm/.test(l)) {
          offenders.push(`${rel}:${i + 1} ${t.slice(0, 90)}`);
        }
      });
    }
    assert.deepStrictEqual(offenders, [],
      'window.confirm()/prompt() are not bridged in the Capacitor WebView — they return false/null and silently cancel:\n'
      + offenders.join('\n'));
  });

  /* ── 2 · deleting a user ──────────────────────────────────────────── */

  const USER_SEED = {
    users: { u2: { id: 'u2', name: 'عامل', role: 'worker', active: true, pin_hash_v2: 'a'.repeat(64) } },
    user_directory: { u2: { id: 'u2', name: 'عامل', role: 'worker', active: true } },
    pin_vault: { u2: { pin_hash_v2: 'a'.repeat(64) } },
  };

  test('Users.del removes the person from all three places they live', async () => {
    const app = await bootApp({ files: ['config.js', 'firebase.js'], user: ADMIN, db: { seed: USER_SEED }, settleMs: 20 });
    const res = J(await app.eval(`(async () => await Users.del('u2'))()`));
    assert.strictEqual(res.ok, true, JSON.stringify(res));
    assert.deepStrictEqual(res.deleted.slice().sort(), ['pin_vault', 'user_directory', 'users']);
    assert.deepStrictEqual(res.failed, []);
    assert.ok(!app.db.data.users.u2, 'the record is gone');
    assert.ok(!app.db.data.user_directory.u2, 'the projection is gone — this is what every list on screen reads');
    assert.ok(!app.db.data.pin_vault.u2, 'and so is the hash');
    app.close();
  });

  test('one denied collection does not abort the delete, and the failure is reported with its reason', async () => {
    const app = await bootApp({
      files: ['config.js', 'firebase.js'], user: ADMIN,
      db: {
        seed: USER_SEED,
        // exactly what the deployed rules look like from an anonymous or
        // stale session: the projection write is allowed, the record is not.
        failMode: (method, p) => (method === 'DELETE' && /^users\//.test(p)
          ? new Response('permission_denied', { status: 403 }) : null),
      },
      settleMs: 20,
    });
    const res = J(await app.eval(`(async () => await Users.del('u2'))()`));
    assert.strictEqual(res.ok, false, 'it must not claim success');
    assert.strictEqual(res.partial, true);
    assert.ok(res.deleted.includes('user_directory'),
      'the projection still goes first, so the row leaves the screen instead of looking un-deletable');
    const failure = res.failed.find((f) => f.collection === 'users');
    assert.ok(failure, 'and the denied collection is named');
    assert.ok(/403|denied|permission/i.test(failure.reason), `the reason must say why, got: ${failure.reason}`);
    app.close();
  });

  test('users.html awaits the promise, tells the truth about a partial delete, and always re-renders', () => {
    const src = read('users.html');
    const fn = code(src).slice(code(src).indexOf('window.delUser=async function'));
    const body = fn.slice(0, fn.indexOf('\n};'));
    assert.ok(/await farmConfirm\(/.test(body), 'it must await the app-wide confirm, not the old callback dialog');
    assert.ok(!/UIShell\.confirm\(/.test(body), 'the old call returned undefined and cancelled every delete');
    assert.ok(/res\.ok/.test(body) && /res\.partial/.test(body) && /res\.failed/.test(body),
      'every outcome is reported: success, partial, failure');
    assert.ok(/رفضتها قواعد الأمان/.test(body), 'a denial says it is a rules problem, not a connection problem');
    const renders = (body.match(/await renderUsers\(\)/g) || []).length;
    assert.ok(renders >= 2, `the list must be re-rendered on every branch, found ${renders} calls`);
    assert.ok(!/toast\('تم الحذف'\)/.test(body), 'and it must not cheer before it knows the answer');
  });

  /* ── 3 · the settings wipes ───────────────────────────────────────── */

  test('settings.html wipes through fbDelete (auth + retry + cache), not a raw fetch', () => {
    const src = read('settings.html');
    const fn = code(src).slice(code(src).indexOf('async function _deleteTable'));
    const body = fn.slice(0, fn.indexOf('\n}'));
    assert.ok(/await fbDelete\(table\)/.test(body), 'fbDelete attaches the token, retries an idempotent DELETE and invalidates the cache');
    assert.ok(!/=\s*await fetch\(/.test(body), 'a raw fetch bypassed the auth token and the retry policy');
    assert.ok(/reason:denied\?'denied':'error'|reason:\s*denied/.test(body) || /denied/.test(body),
      'the result carries a reason, not a bare boolean');
    assert.ok(/diagPush/.test(body), 'and a failed wipe leaves a diagnostics entry');
  });

  test('every reset is async, confirms through farmConfirm, and reports which collections failed and why', () => {
    const src = read('settings.html');
    const names = ['resetAnimals', 'resetFinance', 'resetHealth', 'resetActivity', 'resetNotifications', 'resetEverything'];
    for (const n of names) {
      const i = src.indexOf('window.' + n + '=async function');
      assert.ok(i > 0, `${n} must exist and be async (it awaits the dialog)`);
      const body = src.slice(i, src.indexOf('\n};', i));
      assert.ok(/await farmConfirm\(\{/.test(body), `${n} must confirm through farmConfirm — window.confirm() returns false in a WebView`);
      assert.ok(/_requireAdminForReset\(\)/.test(body), `${n} keeps its admin gate`);
      assert.ok(/_deleteTable\(/.test(body), `${n} deletes through the shared helper`);
      assert.ok(/_reportWipe\(/.test(body), `${n} reports through the shared, honest reporter`);
    }
    // The full wipe used to ask for a typed phrase with window.prompt(), which
    // returns null in a WebView — so it always answered "تم الإلغاء".
    const csrc = code(src);
    const full = csrc.slice(csrc.indexOf('window.resetEverything=async function'));
    const fullBody = full.slice(0, full.indexOf('\n};'));
    assert.ok(/typeToConfirm:'تأكيد'/.test(fullBody), 'the typed confirmation lives inside the dialog now');
    assert.ok(!/prompt\(/.test(fullBody), 'and never in window.prompt()');
    for (const c of ['animals', 'health', 'breeding', 'vaccinations', 'finance', 'inventory_meds', 'inventory_feeds',
      'inventory_equipment', 'activity_log', 'login_notifications', 'notifications', 'production_log',
      'weight_log', 'inventory_transactions', 'feed_consumption', 'daily_tasks', 'workflow_history']) {
      assert.ok(fullBody.includes(`'${c}'`), `a button labelled "مسح كل البيانات" must actually wipe ${c}`);
    }
    for (const keep of ['users', 'user_directory', 'pin_vault', 'uid_lookup', 'settings']) {
      assert.ok(!new RegExp(`'${keep}'`).test(fullBody), `${keep} is identity/configuration — a data wipe must not touch it`);
    }
    // …and the report distinguishes the three reasons.
    const report = csrc.slice(csrc.indexOf('function _reportWipe'));
    const reportBody = report.slice(0, report.indexOf('\n}'));
    assert.ok(/denied/.test(reportBody) && /no-firebase/.test(reportBody) && /تحقق من الاتصال/.test(reportBody),
      'rules denial, no Firebase, and a network problem are three different messages');
    assert.ok(/firebase deploy --only database/.test(reportBody), 'the denial message says what to do about it');
  });

  /* ── 4 · no names in the product ──────────────────────────────────── */

  test('no personal name is rendered anywhere in the app', () => {
    const names = ['أحمد رجب', 'رجب نوح', 'مصطفى محمد', 'محمد إبراهيم', 'لواء أحمد', 'جندي مصطفى', 'إشراف:', 'تطوير:'];
    const hits = [];
    for (const rel of APP_SOURCES()) {
      const src = read(rel);
      names.forEach((n) => { if (src.includes(n)) hits.push(`${rel}: ${n}`); });
    }
    assert.deepStrictEqual(hits, [], 'the owner asked for every name mention to go:\n' + hits.join('\n'));
    // The footer keeps the farm's own name, which is data, not a person.
    const dash = read('dashboard.html');
    assert.ok(dash.includes('id="footer-farm"'), 'the farm-name footer stays');
    assert.ok(!/<small[^>]*>[^<]*(إشراف|تطوير)/.test(dash), 'and carries no credit line');
  });

  test('farmPrompt is a promise for a string, refuses an empty required answer, and survives a WebView', async () => {
    const app = await bootShell();
    const d = app.window.document;
    app.eval(`window.__text = 'pending';
      farmPrompt({ title: 'إعادة فتح الفترة', label: 'سبب إعادة الفتح (مطلوب)', required: true })
        .then(function (v) { window.__text = v; });`);
    const ok = d.querySelector('#uiPromptOk');
    const input = d.querySelector('#uiPromptInput');
    assert.ok(input, 'the reason is typed in the dialog, not in window.prompt()');
    ok.click();
    await settle();
    assert.strictEqual(app.window.__text, 'pending', 'an empty required answer must not resolve');
    input.value = '  تصحيح قيد خاطئ  ';
    input.dispatchEvent(new app.window.Event('input', { bubbles: true }));
    ok.click();
    await settle();
    assert.strictEqual(app.window.__text, 'تصحيح قيد خاطئ', 'and it resolves with the trimmed reason');

    // Escape closes it with null, so `if(!reason) return;` still means cancel.
    app.eval(`window.__text = 'pending'; farmPrompt({ title: 'x', label: 'y' }).then(function (v) { window.__text = v; });`);
    d.dispatchEvent(new app.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle(80);
    assert.strictEqual(app.window.__text, null, 'dismissing a prompt is a cancel, not an empty string');

    // WebView tier: no showModal, no window.prompt.
    const w = app.window;
    w.eval('window.__sm = window.showModal; window.__pr = window.prompt; window.showModal = undefined; window.prompt = undefined;');
    app.eval(`window.__text = 'pending'; farmPrompt({ title: 'سبب', label: 'مطلوب', required: true }).then(function (v) { window.__text = v; });`);
    const panel = d.querySelector('.farm-confirm-fallback');
    assert.ok(panel, 'the inline panel appears where window.prompt() would have returned null');
    const pInput = panel.querySelector('#uiPromptInput');
    panel.querySelector('#uiPromptOk').click();
    await settle();
    assert.strictEqual(app.window.__text, 'pending', 'still refuses an empty required answer');
    pInput.value = 'سبب';
    panel.querySelector('#uiPromptOk').click();
    await settle();
    assert.strictEqual(app.window.__text, 'سبب');
    assert.ok(!d.querySelector('.farm-confirm-fallback'), 'and cleans itself up');
    w.eval('window.showModal = window.__sm; window.prompt = window.__pr;');
    app.close();
  });

  test('the two remaining window.prompt() call sites are gone', () => {
    const animals = code(read('animals.html'));
    const wipe = animals.slice(animals.indexOf('window.submitReset=async function'));
    const wipeBody = wipe.slice(0, wipe.indexOf('\n};'));
    assert.ok(!/prompt\s*\(/.test(wipeBody), 'the full wipe must not ask through window.prompt()');
    assert.ok(/typeToConfirm:'تأكيد'/.test(wipeBody), 'the typed phrase lives inside the dialog');
    assert.ok(/await fbDelete\(/.test(wipeBody), 'and it deletes through fbDelete, not a second hand-rolled fetch');
    assert.ok(/رفضتها قواعد الأمان/.test(wipeBody), 'a denial is named as a rules problem');

    const fp = code(read('finance-periods.html'));
    const reopen = fp.slice(fp.indexOf('window.fpReopenPeriod=async function'));
    const reopenBody = reopen.slice(0, reopen.indexOf('\n};'));
    assert.ok(/await farmPrompt\(/.test(reopenBody), 'an audited reason is collected through farmPrompt');
    assert.ok(/required:true/.test(reopenBody), 'and it is still required');
    assert.ok(!/prompt\s*\(/.test(reopenBody.replace(/farmPrompt\s*\(/g, '')), 'never through window.prompt()');
  });

  test('sample and placeholder text carries no personal name either', () => {
    assert.ok(!read('import.html').includes('د. أحمد'), 'the import sample row used a real-looking vet name');
    assert.ok(!read('pages/health.js').includes('د. أحمد'), 'nor the health form placeholder');
    assert.ok(read('pages/health.js').includes('اكتب اسم الطبيب'), 'the placeholder describes the field instead');
  });
});
