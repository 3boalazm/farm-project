// Module 27 — the 2026-10 login & layout rebuild, requested by the owner:
//
//   «النم باد عمودين ارقام بس والمفترض في أي تطبيق في الكوكب كله بتكون ٣ أعمدة»
//   «مش عاوزهم يظهروا وقت الدخول للخصوصية»
//
// Those two sentences turned out to have one root cause and one design
// decision behind them, and both are pinned here so they cannot regress:
//
//   1 · PRIVACY AT THE DOOR. The login screen used to render the whole staff
//       directory — names, photos, roles — before anybody had proved who they
//       were. On a tablet bolted to a barn wall that is a staff list for
//       anyone walking past, and it turns the page into a username-
//       enumeration oracle. It is now identifier-first: you type a code, the
//       page matches it against the same public projection it always read,
//       and it renders nothing. Every failure says the same sentence, whether
//       the code exists or not.
//   2 · THE KEYPAD IS A KEYPAD. 3 columns × 4 rows, 1-9 then [C][0][⌫],
//       dir="ltr" inside an RTL page, real <button>s, ≥56px, masked dots and
//       an sr-only "٣ من ٤" progress line.
//   3 · THE COLLISION THAT MADE IT TWO COLUMNS. ui.css §9 defined its own
//       `.row` flex utility — `display:flex; gap:12px` — on the same class
//       name Bootstrap uses for its grid. 435 `class="row"` elements in this
//       app are Bootstrap grid rows, so every `.col-4` triple became
//       3×33.33% + 2×12px > 100% and wrapped to TWO columns, and every
//       `.col-6` pair collapsed to one. That single declaration is why the
//       previous UI pass "changed nothing visible": it was fighting the grid
//       on every page at once. The v2 row is now modifier-only (`.row--*`).
//   4 · THE DASHBOARD READS STATUS → CONTEXT → WORK LIST, in that order,
//       with the north-star number in the top-RIGHT quadrant (the F-pattern
//       mirrors in RTL).
const fs = require('fs');
const path = require('path');
const csstree = require('css-tree');
const { suite, assert, bootApp, createFakeAuth, ROOT, J } = require('./harness');

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const LOGIN = read('login.html');
const UICSS = read('ui.css');
const DASH = read('dashboard.html');

// login.html's own body markup and its own inline bootstrap, run inside the
// harness window — the harness builds a bare DOM, so a page's markup has to
// be injected by hand. Scripts are stripped from the body and evaluated
// separately so a throw is captured instead of becoming an unhandled
// rejection nobody notices.
const LOGIN_BODY = LOGIN.split('<body>')[1].split('</body>')[0].replace(/<script[\s\S]*?<\/script>/g, '');
const LOGIN_MAIN = [...LOGIN.matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .map((m) => m[1]).sort((a, b) => b.length - a.length)[0];

const DIRECTORY_SEED = {
  user_directory: {
    u1: { id: 'u1', name: 'سارة محمد', role: 'admin', active: true },
    u2: { id: 'u2', name: 'عمرو علي', role: 'worker', active: true },
  },
};

async function bootLogin(seed = DIRECTORY_SEED, settleMs = 500) {
  // A scripted auth fake, not the harness default: the default answers every
  // identitytoolkit call with a permissive `localId:'uid-test'`, which would
  // let the bridge "succeed" for an account that does not exist and hide the
  // hash-verification path this screen actually depends on.
  const auth = createFakeAuth();
  const app = await bootApp({
    files: ['config.js', 'firebase.js', 'ui-shell.js'],
    user: null, seedUsers: false, auth, db: { seed }, settleMs: 20,
  });
  app.auth = auth;
  app.eval(`document.body.innerHTML = ${JSON.stringify(LOGIN_BODY)};`);
  app.eval(`window.__bootError = null;
    Promise.resolve().then(() => { ${LOGIN_MAIN} })
      .catch((e) => { window.__bootError = String((e && e.message) || e); });`);
  await new Promise((r) => setTimeout(r, settleMs));
  assert.strictEqual(app.window.__bootError, null, 'the login script threw: ' + app.window.__bootError);
  return app;
}

// Type a code, press digits, then wait for the verdict. Polling rather than
// a fixed sleep: the verify path costs a 120k-round PBKDF2 in jsdom, and the
// failure message is cleared again after 2.2s, so both a short and a long
// fixed wait are wrong on some machines.
const VERIFYING = 'جارٍ التحقق…';
async function tryLogin(app, code, pin, timeoutMs = 8000) {
  app.eval(`document.getElementById('login-id').value = ${JSON.stringify(code)};`);
  for (const d of pin) app.eval(`window.pinPress(${JSON.stringify(d)});`);
  const t0 = Date.now();
  for (;;) {
    const msg = app.window.document.getElementById('pin-message').textContent || '';
    if (msg && msg !== VERIFYING) return msg;
    if (Date.now() - t0 > timeoutMs) return msg || '(no verdict within ' + timeoutMs + 'ms)';
    await new Promise((r) => setTimeout(r, 60));
  }
}

// Render dashboard.html's own inline script the way scripts/debug-dashboard-render.js does.
async function bootDashboard() {
  const app = await bootApp({
    files: ['config.js', 'firebase.js', 'nav.js', 'shared.js', 'ui-shell.js'],
    user: { id: 'admin1', name: 'T', role: 'admin', active: true },
    db: { seed: {} }, settleMs: 30,
  });
  const main = [...DASH.matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1]).sort((a, b) => b.length - a.length)[0];
  await app.eval(main);
  return app;
}

const iso = (offsetDays) => {
  const d = new Date(); d.setDate(d.getDate() - offsetDays);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

// 14 positional args: animals, breeding, health, finance, meds, feeds,
// equipment, production, activity, weightAlerts, vaccinations,
// productionAlerts, dailyTasks, workflowHistory.
function renderCall(app, { animals = [], health = [], production = [], weightAlerts = [], dailyTasks = [], activity = [], finance = [] } = {}) {
  const args = [animals, [], health, finance, [], [], [], production, activity, weightAlerts, [], [], dailyTasks, []];
  return app.eval(`(() => { try { renderDashboard(${JSON.stringify(args[0])},${JSON.stringify(args[1])},${JSON.stringify(args[2])},${JSON.stringify(args[3])},${JSON.stringify(args[4])},${JSON.stringify(args[5])},${JSON.stringify(args[6])},${JSON.stringify(args[7])},${JSON.stringify(args[8])},${JSON.stringify(args[9])},${JSON.stringify(args[10])},${JSON.stringify(args[11])},${JSON.stringify(args[12])},${JSON.stringify(args[13])}); return 'ok'; } catch (e) { return 'THREW: ' + e.message; } })()`);
}

// Declarations of one exact selector, from ui.css.
function declarationsOf(selector) {
  const out = [];
  const ast = csstree.parse(UICSS);
  csstree.walk(ast, {
    visit: 'Rule',
    enter(rule) {
      if (!rule.prelude || rule.prelude.type !== 'SelectorList') return;
      const sels = rule.prelude.children.toArray().map((n) => csstree.generate(n).trim());
      if (!sels.some((s) => s === selector)) return;
      rule.block.children.toArray().forEach((d) => {
        if (d.type === 'Declaration') out.push([d.property, csstree.generate(d.value)]);
      });
    },
  });
  return out;
}
const decl = (selector, property) => {
  const hit = declarationsOf(selector).find(([p]) => p === property);
  return hit ? hit[1] : null;
};

module.exports = suite('27 · Login privacy, keypad geometry & the Bootstrap-grid collision', ({ test }) => {

  /* ── 1 · nobody is named before the credential is verified ─────────── */

  test('the login screen renders no name, no photo and no role from the directory it reads', async () => {
    const app = await bootLogin();
    const body = app.window.document.body.textContent || '';
    assert.ok(!body.includes('سارة'), 'a directory name must never reach the pre-auth screen');
    assert.ok(!body.includes('عمرو'), 'nor any other one');
    assert.strictEqual(app.window.document.querySelectorAll('#user-picker, #role-btns, .user-chip, .role-chip').length, 0,
      'the picker and the role filter are gone, not merely hidden');
    // …but the identifier field is there, labelled, and autocomplete-friendly.
    const input = app.window.document.getElementById('login-id');
    assert.ok(input, 'identifier-first needs an identifier field');
    assert.strictEqual(input.getAttribute('autocomplete'), 'username');
    assert.ok(app.window.document.querySelector('label[for="login-id"]'), 'a label, not a placeholder pretending to be one');
    assert.strictEqual(app.window.document.querySelectorAll('datalist').length, 0, 'no suggestion list either');
    app.close();
  });

  test('login.html keeps the directory read (it must still map a typed name to an id) but paints none of it', () => {
    assert.ok(LOGIN.includes('fbGetSafe('), 'suite 22 depends on this: a failed read must stay distinguishable from an empty one');
    assert.ok(LOGIN.includes('user_directory'), 'the projection is still the identity source');
    assert.ok(!LOGIN.includes('renderUsers') && !LOGIN.includes('renderRoles'), 'the renderers are deleted, not dormant');
    assert.ok(!LOGIN.includes('innerHTML=DIRECTORY') && !/DIRECTORY\.map\(/.test(LOGIN), 'nothing iterates the directory into markup');
  });

  /* ── 2 · the keypad ────────────────────────────────────────────────── */

  test('the pad is 12 real buttons in phone order: 1-2-3 / 4-5-6 / 7-8-9 / C-0-⌫', async () => {
    const app = await bootLogin();
    const keys = J(app.eval(`[...document.querySelectorAll('#pin-pad .pin-key')].map((b) => ({
      k: b.dataset.key, tag: b.tagName, type: b.type,
      aria: b.getAttribute('aria-label') || '', txt: b.textContent.trim()
    }))`));
    assert.strictEqual(keys.length, 12, 'a phone keypad has 12 cells');
    assert.deepStrictEqual(keys.map((k) => k.k), ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'],
      'phone order — 0 stays under 8, muscle memory depends on it');
    assert.ok(keys.every((k) => k.tag === 'BUTTON' && k.type === 'button'),
      'real buttons: tabbable, clickable, and they announce themselves');
    const fn = keys.filter((k) => k.k === 'C' || k.k === '⌫');
    assert.ok(fn.every((k) => k.aria.length > 4), 'a bare ⌫ announces as nothing — it needs an aria-label');
    assert.ok(keys.filter((k) => /^\d$/.test(k.k)).every((k) => k.txt === k.k), 'digits show their digit');
    assert.strictEqual(app.window.document.getElementById('pin-pad').getAttribute('dir'), 'ltr',
      'the pad stays LTR inside this RTL page: a mirrored keypad is how staff mistype');
    app.close();
  });

  test('.pin-pad is a strict 3-column CSS grid — never Bootstrap row/col, which is what wrapped it to two', () => {
    const cols = decl('.pin-pad', 'grid-template-columns');
    assert.ok(cols, '.pin-pad must exist in ui.css');
    assert.ok(/repeat\(\s*3/.test(cols), `expected repeat(3, …), got: ${cols}`);
    assert.strictEqual(decl('.pin-pad', 'display'), 'grid');
    // The markup must not depend on a CSS framework loading first.
    assert.ok(!LOGIN.includes('col-4'), 'no Bootstrap column classes in the pad');
    assert.ok(!/class="row[^"]*"[^>]*id="pin-pad"/.test(LOGIN), 'and no Bootstrap .row');
    // Touch targets: kiosk guidance asks for 44px, gloved hands ask for more.
    const h = decl('.pin-key', 'min-height');
    assert.ok(h && parseInt(h, 10) >= 56, `keys must be at least 56px tall, got ${h}`);
    assert.ok(/repeat\(\s*3/.test(cols) && !/auto-fit|auto-fill/.test(cols),
      'a fixed 3, not an auto-fit that reflows to 2 or 4 on a narrow phone');
  });

  test('digits fill the dots, ⌫ removes one, C clears, and progress is announced without speaking the PIN', async () => {
    const app = await bootLogin();
    const dots = () => app.window.document.querySelectorAll('#pin-dots .pin-dot.is-on').length;
    const live = () => app.window.document.getElementById('pin-live').textContent;
    app.eval(`window.pinPress('1'); window.pinPress('2'); window.pinPress('3');`);
    assert.strictEqual(dots(), 3, 'three digits, three filled dots');
    assert.ok(/٣ من ٤/.test(live()), `the live region counts in Arabic-Indic, got: ${live()}`);
    assert.ok(!/123/.test(live()), 'the digits themselves are never announced — shoulder-surfing applies to audio too');
    app.eval(`window.pinPress('⌫');`);
    assert.strictEqual(dots(), 2, '⌫ removes exactly one');
    app.eval(`window.pinPress('C');`);
    assert.strictEqual(dots(), 0, 'C clears the whole code');
    // Escape clears too, for a keyboard-only operator.
    app.eval(`window.pinPress('7'); window.pinPress('7');`);
    app.eval(`document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));`);
    assert.strictEqual(dots(), 0, 'Escape clears');
    app.close();
  });

  /* ── 3 · one answer for every failure ─────────────────────────────── */

  test('an unknown code and a wrong PIN give the identical message — the page cannot be used to enumerate staff', async () => {
    const app = await bootLogin();
    const wrongPin = await tryLogin(app, 'سارة محمد', '1111');   // a real code, a wrong PIN
    const noSuchUser = await tryLogin(app, 'لا أحد هنا', '1111'); // a code that does not exist
    assert.strictEqual(wrongPin, noSuchUser, 'identical wording, or the difference is the oracle');
    assert.ok(/غير صحيح/.test(wrongPin), `expected the generic failure, got: ${wrongPin}`);
    assert.ok(!wrongPin.includes('سارة') && !noSuchUser.includes('لا أحد'),
      'neither message may echo the identifier back');
    assert.ok(!/غير موجود|لا يوجد مستخدم|not found|no such/i.test(wrongPin + noSuchUser),
      'no "that user does not exist" phrasing anywhere in the failure path');
    // The uniform delay is what keeps the *timing* from leaking the same fact.
    assert.ok(/setTimeout\(r=>setTimeout|setTimeout\(r, *4\d\d\)|await new Promise\(r=>setTimeout\(r,4\d\d\)\)/.test(LOGIN),
      'the no-match path must wait as long as the verify path');
    app.close();
  });

  test('a normalised identifier plus the right PIN signs the user in — ة/ه, أ/ا and spacing all match', async () => {
    const app = await bootLogin();
    const hash = await app.eval(`(async () => await hashPinV2('2468', 'u1'))()`);
    await app.eval(`(async () => { await fbPut('users', 'u1', { id: 'u1', name: 'سارة محمد', role: 'admin', active: true, pin_hash_v2: ${JSON.stringify(hash)} }); })()`);
    // typed the way people actually type it: no diacritics, ه for ة
    await tryLogin(app, 'ساره محمد', '2468');
    const raw = app.window.localStorage.getItem('farm_user');
    assert.ok(raw, 'a correct code + PIN must produce a session');
    const u = JSON.parse(raw);
    assert.strictEqual(u.id, 'u1', 'the typed name resolved to the right account');
    assert.strictEqual(u.verifiedBy, 'pin-hash:v2', 'and it was verified with the strong scheme');
    assert.ok(app.navigations.length >= 1, 'then it redirects (jsdom reports the navigation as an error)');
    app.close();
  });

  /* ── 4 · the collision that broke 435 layouts ─────────────────────── */

  test('ui.css never restyles a Bootstrap grid class — the gap on .row is what wrapped every 3-column row to 2', () => {
    const ast = csstree.parse(UICSS);
    const offenders = [];
    const GRID = /^(row|col|container|container-fluid)$/;
    csstree.walk(ast, {
      visit: 'Rule',
      enter(rule) {
        if (!rule.prelude || rule.prelude.type !== 'SelectorList') return;
        rule.prelude.children.toArray().forEach((n) => {
          const sel = csstree.generate(n).trim();
          // any compound whose class is exactly a Bootstrap grid class
          sel.split(/[\s>+~]+/).forEach((part) => {
            const m = part.match(/^\.([a-z-]+)$/);
            if (m && GRID.test(m[1])) offenders.push(sel);
          });
        });
      },
    });
    assert.deepStrictEqual(offenders, [],
      'Bootstrap owns .row/.col/.container: styling them from the v2 layer silently reflows the whole app.\n' +
      [...new Set(offenders)].join('\n'));
    // The v2 utility survives under its own modifiers, so nothing is lost.
    assert.ok(/\.row--wrap/.test(UICSS) && /\.row--between/.test(UICSS), 'the v2 row is modifier-only now');
    assert.ok(!/^\.row\{/m.test(UICSS) && !/^\.col\{/m.test(UICSS), 'and the bare grid classes are untouched');
    // Why this matters, counted:
    const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));
    const pageMods = fs.readdirSync(path.join(ROOT, 'pages')).filter((f) => f.endsWith('.js'));
    let rows = 0;
    [...pages.map((f) => read(f)), ...pageMods.map((f) => read('pages/' + f))].forEach((src) => {
      rows += (src.match(/class="row[\s"]/g) || []).length;
    });
    assert.ok(rows > 200, `expected the app's Bootstrap grid rows to be numerous, counted ${rows}`);
  });

  test('the PIN pad itself no longer uses the grid it was colliding with', () => {
    const from = LOGIN.indexOf('const PAD_KEYS');
    const to = LOGIN.indexOf('function renderPin');
    assert.ok(from > 0 && to > from, 'the pad builder must sit between PAD_KEYS and renderPin');
    const padBlock = LOGIN.slice(from, to);
    assert.ok(padBlock.includes('pin-key'), 'the pad is built from .pin-key buttons');
    assert.ok(!padBlock.includes('col-') && !padBlock.includes('row g-2'), 'inside a plain CSS grid');
  });

  /* ── 5 · the home page (HOME v3, 2026-10-20) ────────────────────────
     The page stopped being "five tabs of cards": above the tab navigator
     there is now one decision stream — daybar (what day / should I worry),
     focus (the ONE decision + a verb), pulse (today's six numbers as an
     instrument strip + the real sparkline), quick (glove-sized actions),
     attention (the animals that need a human) — and panel 0 opens with the
     day's timeline, which the old page never showed. The invariants the old
     tests protected are all still asserted, against the new structure. */

  const MILK7 = [6, 5, 7, 4, 8, 6, 9].map((q, i) => ({ type: 'milk', date: iso(6 - i), quantity: q }));
  const HERD = [
    { _id: 'a1', tag: 'G-1', status: 'alive', species: 'goat', breed: 'بلدى' },
    { _id: 'a2', tag: 'G-2', status: 'alive', species: 'sheep', breed: 'رحمانى' },
    { _id: 'a3', tag: 'G-3', status: 'alive', species: 'goat', breed: 'شامي' },
  ];

  test('the home reads day → decision → pulse → actions → attention, above the tab navigator', async () => {
    const app = await bootDashboard();
    const health = [{ animal_tag: 'G-1', status: 'active', type: 'treatment', date: iso(1) }];
    const activity = [{ action: 'add', resource: 'production_log', description: 'تسجيل إنتاج: ٢٤ لتر', userName: 'عامل', timestamp: new Date().toISOString() }];
    assert.strictEqual(renderCall(app, { animals: HERD, health, production: MILK7, activity }), 'ok');
    const got = J(app.eval(`(() => {
      const kids = [...document.getElementById('content').children];
      const home = document.getElementById('dash-home');
      const nav = document.querySelector('.dash-nav');
      const p0 = [...document.getElementById('dash-panel-0').children];
      const at = (needle) => p0.findIndex((k) => (k.textContent || '').includes(needle));
      return {
        homeIndex: kids.indexOf(home), navIndex: kids.indexOf(nav),
        homeKids: [...home.children].map((k) => (k.className || '').toString().split(' ')[0]),
        timeline: at('الحركة'), briefing: at('موجز اليوم'),
        alerts: p0.findIndex((k) => k.querySelector('#dash-alerts') || k.id === 'dash-alerts'),
        finance: at('المالية التنفيذية اليوم'),
        quick: [...document.querySelectorAll('.quick__btn')].map((b) => b.textContent.trim()),
        quickOnclick: [...document.querySelectorAll('.quick__btn[onclick]')].length,
        headerBtns: document.querySelectorAll('#page-header .action-btn').length,
        tabs: [...document.querySelectorAll('.dash-tab')].map((t) => t.id),
        panels: [...document.querySelectorAll('.dash-tab-panel')].map((p) => p.id),
      };
    })()`));
    assert.strictEqual(got.homeIndex, 0, 'the stream is the first thing on the page');
    assert.ok(got.navIndex > got.homeIndex, 'the tab navigator sits under it, not above it');
    assert.deepStrictEqual(got.homeKids.slice(0, 4), ['daybar', 'focus', 'pulse', 'quick'],
      `day → decision → pulse → actions, got ${JSON.stringify(got.homeKids)}`);
    assert.ok(got.homeKids.includes('att'), 'and the attention strip renders when animals need a human');
    assert.ok(got.timeline === 0, `panel 0 opens with what already happened today, got index ${got.timeline}`);
    assert.ok(got.briefing > got.timeline, 'then the context sentences');
    assert.ok(got.alerts > got.briefing, 'then the work list');
    assert.ok(got.finance > got.alerts, 'and the money detail is last');
    // one place for actions: the strip, not the header (which keeps the diary
    // and the assistant only) — an admin sees the three herd modals too
    assert.ok(got.quick.includes('إضافة حيوان') && got.quick.includes('مولود جديد') && got.quick.includes('تسجيل نفوق'),
      `the herd actions live in the strip: ${JSON.stringify(got.quick)}`);
    assert.ok(got.quick.includes('تسجيل إنتاج') && got.quick.includes('حالة صحية') && got.quick.includes('المهام'));
    assert.strictEqual(got.quickOnclick, 3, 'exactly the three modal actions are buttons; the rest are links');
    assert.ok(got.headerBtns <= 2, `the header must not duplicate the strip, found ${got.headerBtns} buttons`);
    // the four specs that open panels by id must keep working
    assert.deepStrictEqual(got.tabs, ['dash-tab-0', 'dash-tab-1', 'dash-tab-2', 'dash-tab-3', 'dash-tab-4']);
    assert.deepStrictEqual(got.panels, ['dash-panel-0', 'dash-panel-1', 'dash-panel-2', 'dash-panel-3', 'dash-panel-4']);
    app.close();
  });

  test('the daybar carries the north-star score with a word, an icon and a timestamp — never colour alone', async () => {
    const app = await bootDashboard();
    const health = [{ animal_tag: 'G-1', status: 'active', type: 'treatment', date: iso(1) }];
    assert.strictEqual(renderCall(app, { animals: HERD, health }), 'ok');
    const got = J(app.eval(`(() => {
      const bar = document.querySelector('#dash-home .daybar');
      const pill = bar.querySelector('.statepill');
      return {
        state: bar.getAttribute('data-state'),
        pillState: pill.getAttribute('data-state'),
        value: pill.querySelector('b').textContent.trim(),
        max: pill.querySelector('.statepill__max').textContent.trim(),
        word: pill.querySelector('em').textContent.trim(),
        icon: !!pill.querySelector('i'),
        clock: bar.querySelector('.daybar__clock').textContent,
        herd: [...bar.querySelectorAll('.herdchip')].map((c) => c.textContent.trim()),
        cells: [...document.querySelectorAll('.pulse__cell')].map((c) => c.getAttribute('data-state')),
        labels: [...document.querySelectorAll('.pulse__label')].map((l) => l.textContent.trim()),
        values: [...document.querySelectorAll('.pulse__value')].map((v) => v.textContent.trim()),
      };
    })()`));
    assert.ok(['ok', 'watch', 'act'].includes(got.state), `the daybar must declare a machine-readable state, got ${got.state}`);
    assert.strictEqual(got.pillState, got.state, 'and the pill agrees with it');
    assert.ok(/\d/.test(got.value.replace(/[٠-٩]/g, '0')), `a big number, not a label: ${got.value}`);
    assert.strictEqual(got.max, '/١٠٠');
    assert.ok(got.word.length > 1, 'plus the state as a word: ممتاز / جيد / يحتاج انتباه / حرج');
    assert.ok(got.icon, 'plus an icon, so greyscale and colour-blindness still read it');
    assert.ok(/آخر تحديث/.test(got.clock), 'a dashboard without a timestamp is a rumour');
    assert.ok(got.herd.length >= 2, `the herd chips say how many animals this is about: ${JSON.stringify(got.herd)}`);
    assert.strictEqual(got.cells.length, 6, 'six numbers in the strip, not four cards');
    assert.ok(got.cells.every((s) => ['good', 'watch', 'bad', 'flat'].includes(s)), 'each with its own state attribute');
    assert.deepStrictEqual(got.labels, ['مواليد', 'نفوق', 'لبن', 'إيرادات', 'مصروفات', 'مهام مفتوحة']);
    assert.ok(got.values.every((v) => v.length > 0 && !/undefined|NaN/.test(v)), `no placeholder junk: ${JSON.stringify(got.values)}`);
    app.close();
  });

  test('the focus card names ONE decision with a verb, and never links to an empty list', async () => {
    const app = await bootDashboard();
    const health = [{ animal_tag: 'G-1', status: 'active', type: 'treatment', date: iso(1) }];
    const weightAlerts = [{ _id: 'w1', animal_id: 'a2', animal_tag: 'G-2', status: 'active', severity: 'danger' }];
    assert.strictEqual(renderCall(app, { animals: HERD, health, weightAlerts }), 'ok');
    const got = J(app.eval(`(() => {
      const f = document.querySelector('#dash-home .focus');
      const cta = f.querySelector('.focus__cta');
      return {
        state: f.getAttribute('data-state'),
        eyebrow: f.querySelector('.focus__eyebrow').textContent.trim(),
        title: f.querySelector('.focus__title').textContent.trim(),
        why: (f.querySelector('.focus__why') || {}).textContent || '',
        cta: cta ? cta.getAttribute('href') : null,
        ctaText: cta ? cta.textContent.trim() : '',
        chips: [...document.querySelectorAll('.attchip')].map((c) => ({
          href: c.getAttribute('href'), kind: c.getAttribute('data-kind'), text: c.textContent.trim(),
        })),
      };
    })()`));
    assert.ok(['act', 'watch', 'ok', 'calm'].includes(got.state), `the decision states its urgency, got ${got.state}`);
    assert.strictEqual(got.eyebrow, 'قرار اليوم');
    assert.ok(got.title.length > 5, `it says what needs deciding: ${got.title}`);
    assert.ok(/\d|[٠-٩]/.test(got.title), 'and how many');
    assert.ok(got.cta && got.ctaText.length > 2, 'every decision carries a verb, not just a number');
    if (got.cta === '#dash-alerts') {
      assert.ok(app.window.document.querySelectorAll('#dash-alerts .alert-card, #dash-alerts > *:not(.fw-bold)').length > 0,
        'the decision linked to the work list, so the work list must not be the empty-state badge');
    }
    assert.strictEqual(got.chips.length, 2, 'G-1 (health) and G-2 (weight) need a human');
    assert.ok(got.chips.every((c) => /^animal-detail\.html\?id=/.test(c.href)), 'each chip opens that animal');
    assert.deepStrictEqual(got.chips.map((c) => c.kind).sort(), ['health', 'weight'], 'and says why');
    app.close();
  });

  test('an all-clear day says so, with a way into the day\'s work instead of a red box', async () => {
    const app = await bootDashboard();
    assert.strictEqual(renderCall(app, { animals: HERD }), 'ok');
    const got = J(app.eval(`(() => {
      const f = document.querySelector('#dash-home .focus');
      return { state: f.getAttribute('data-state'), title: f.querySelector('.focus__title').textContent.trim(),
               cta: f.querySelector('.focus__cta').getAttribute('href'),
               cls: f.querySelector('.focus__cta').className,
               chips: document.querySelectorAll('.attchip').length };
    })()`));
    assert.strictEqual(got.state, 'calm');
    assert.ok(/لا شيء يحتاج قرارًا/.test(got.title), `an all-clear must say so, got: ${got.title}`);
    assert.ok(/calm/.test(got.cls), 'and read as calm, not as an alarm');
    assert.strictEqual(got.cta, 'diary.html', 'the way forward on a quiet day is the farm diary');
    assert.strictEqual(got.chips, 0, 'no attention strip when nothing needs attention');
    app.close();
  });

  test('the trend is a real 7-point inline SVG in the strip, and its empty state says what to do next', async () => {
    const app = await bootDashboard();
    assert.strictEqual(renderCall(app, { animals: HERD, production: MILK7 }), 'ok');
    const withData = J(app.eval(`(() => {
      const s = document.querySelector('#dash-home .pulse__trend .dash-spark');
      const pts = (s.querySelector('polyline').getAttribute('points') || '').trim().split(/\\s+/);
      return { svg: !!s, points: pts.length, delta: (document.querySelector('.pulse__delta') || {}).textContent || '',
               dir: document.querySelector('.pulse__delta').getAttribute('data-dir'),
               empty: !!document.querySelector('.pulse__empty') };
    })()`));
    assert.ok(withData.svg, 'a sparkline must render when there is milk data');
    assert.strictEqual(withData.points, 7, 'seven days, seven points');
    assert.ok(/٪/.test(withData.delta), `the strip states its change, got "${withData.delta}"`);
    assert.ok(['up', 'down'].includes(withData.dir), 'and the direction is an attribute, not colour alone');
    assert.ok(!withData.empty, 'and no empty state while there is data');

    const app2 = await bootDashboard();
    assert.strictEqual(renderCall(app2, { animals: HERD }), 'ok');
    const empty = J(app2.eval(`(() => {
      const e = document.querySelector('#dash-home .pulse__empty');
      return { text: e ? e.textContent.trim() : '', href: e && e.querySelector('a') ? e.querySelector('a').getAttribute('href') : null,
               svg: !!document.querySelector('#dash-home .dash-spark') };
    })()`));
    assert.ok(!empty.svg, 'no fake flat line when nothing was recorded');
    assert.ok(/سجّل/.test(empty.text) && empty.href === 'production.html',
      `an empty state must say what to do next, got: ${empty.text} → ${empty.href}`);
    app.close(); app2.close();
  });

  test('the timeline shows what already happened today, and says so when nothing did', async () => {
    const app = await bootDashboard();
    const activity = [
      { action: 'add', resource: 'production_log', description: 'تسجيل إنتاج: ٢٤ لتر', userName: 'عامل', timestamp: new Date(Date.now() - 3600e3).toISOString() },
      { action: 'delete', resource: 'inventory_feeds', description: 'حذف صنف منتهي', userName: 'مدير', timestamp: new Date(Date.now() - 7200e3).toISOString() },
    ];
    assert.strictEqual(renderCall(app, { animals: HERD, activity }), 'ok');
    const got = J(app.eval(`(() => {
      const rows = [...document.querySelectorAll('#dash-panel-0 .tl__item')];
      return {
        count: rows.length,
        times: rows.map((r) => r.querySelector('.tl__time').textContent.trim()),
        kinds: rows.map((r) => r.getAttribute('data-kind')),
        first: rows[0].querySelector('.tl__body b').textContent.trim(),
        meta: rows[0].querySelector('.tl__body small').textContent.trim(),
        empty: !!document.querySelector('#dash-panel-0 .tl--empty'),
      };
    })()`));
    assert.strictEqual(got.count, 2, 'one row per logged action');
    assert.ok(got.times.every((t) => /^\d{1,2}:\d{2}$/.test(t.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)))),
      `each row carries its clock time, got ${JSON.stringify(got.times)}`);
    assert.deepStrictEqual(got.kinds, ['good', 'bad'], 'an add reads as good and a delete as bad — shape, not colour');
    assert.strictEqual(got.first, 'تسجيل إنتاج: ٢٤ لتر');
    assert.ok(/عامل/.test(got.meta) && /production_log/.test(got.meta), 'and who did it, where');
    assert.ok(!got.empty, 'no empty state while there is activity');

    const app2 = await bootDashboard();
    assert.strictEqual(renderCall(app2, { animals: HERD }), 'ok');
    const empty = J(app2.eval(`(() => {
      const e = document.querySelector('#dash-panel-0 .tl--empty');
      return { text: e ? e.textContent.trim() : '', href: e && e.querySelector('a') ? e.querySelector('a').getAttribute('href') : null,
               rows: document.querySelectorAll('#dash-panel-0 .tl__item').length };
    })()`));
    assert.strictEqual(empty.rows, 0, 'no invented history');
    assert.ok(/لا حركة مسجّلة/.test(empty.text) && empty.href === 'reports.html',
      `the empty state says what it is and where the full history lives, got: ${empty.text} → ${empty.href}`);
    app.close(); app2.close();
  });

  test('the sparkline keys its days with ISO dates, not the Arabic-Indic display helper', () => {
    // pad2() renders ٠١٢٣ for the screen; production rows store 2026-10-20.
    // Using pad2 to build the day keys silently produced an empty trend band.
    // HOME v3 moved the sparkline into the pulse strip, and PAGE STREAM V3
    // moved the drawing into shared.js's sparkSVG(); what the page still owns
    // is the day KEYS, so the rule is asserted on the keys it builds.
    const band = DASH.slice(DASH.indexOf('HOME v3'), DASH.indexOf('<nav class="dash-nav"'));
    assert.ok(band.length > 500, 'the home stream block must be found in dashboard.html');
    assert.ok(/isoDays\(7\)/.test(band), 'the home takes its day keys from the shared ISO helper');
    assert.ok(!/daysH\.push\([^)]*pad2/.test(band) && !/seriesH[\s\S]{0,200}pad2/.test(band),
      'and never builds a storage key with pad2()');
    assert.ok(/seriesH\s*=/.test(band) && /series:\s*seriesH/.test(band), 'the series it computes is the series it draws');
  });
});
