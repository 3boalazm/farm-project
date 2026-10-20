// Module 30 — PAGE STREAM V3, the shared builders every page composes.
//
//   «عاوزك بردو تمشي عالبرنامج كله صفحة صفحة وتعمل ابجريد مشابه لنفس اللي
//     عملته للهوم»  — the owner, 2026-10-21
//
// Upgrading 37 pages by hand would have produced 37 dialects of the same
// idea, which is exactly what made the app feel like a pile of screens. So
// the home's language was lifted into shared.js as builders — daybar, focus,
// pulse, quick, attention, timeline — and the home itself was rebuilt on top
// of them (dashboard.html now contains no hand-rolled stream markup at all).
// This suite is the contract for that language: order, states, escaping,
// permission gating, empty states, and the rule that a class the builders
// emit must be a class ui.css actually styles.
const fs = require('fs');
const path = require('path');
const { suite, assert, bootApp, createFakeAuth, ROOT, J } = require('./harness');

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const SHARED = read('shared.js');
const UICSS = read('ui.css');
const DASH = read('dashboard.html');

async function boot(role) {
  return bootApp({
    files: ['config.js', 'firebase.js', 'shared.js'],
    user: { id: role === 'worker' ? 'w1' : 'admin1', name: 'T', role: role || 'admin', active: true },
    db: { seed: {} }, settleMs: 20,
  });
}

// One config with every part present: the reference the order/escaping tests
// render into a host element.
const FULL = `{
  id: 'x-stream', state: 'watch', day: '٢٠٢٦-١٠-٢٠', clockText: 'آخر تحديث ٠٩:٠٥',
  pill: { value: '٨٠', max: '/١٠٠', label: 'جيد', title: 'حالة الصفحة' },
  chips: [{ icon: 'bi-heart-pulse', text: '٥ حيّ' }, { icon: 'bi-exclamation-triangle', text: '٢ يحتاج انتباه', alert: true }],
  focus: { state: 'act', eyebrow: 'قرار اليوم', title: '٣ أولويات تحتاج قرارًا', why: 'أول سبب',
           cta: { href: 'health.html', label: 'افتح السجل', icon: 'bi-heart-pulse' },
           next: [{ href: 'a.html', label: 'أ' }, { href: 'b.html', label: 'ب' }, { href: 'c.html', label: 'ج' }] },
  pulse: [{ label: 'مواليد', value: '٢', foot: 'اليوم', state: 'good', icon: 'bi-stars' },
          { label: 'نفوق', value: '٠', foot: 'اليوم', state: 'flat', icon: 'bi-droplet' }],
  pulseAria: 'نبض الصفحة',
  trend: { label: 'لبن — ٧ أيام', series: [12, 14, 9, 18, 20, 17, 22],
           emptyText: 'لا يوجد إنتاج مسجّل', emptyHref: 'production.html', emptyLabel: 'سجّل الإنتاج' },
  quick: [{ label: 'إضافة حيوان', icon: 'bi-plus-lg', onclick: 'openAdd()' },
          { label: 'إيراد / مصروف', icon: 'bi-cash-coin', href: 'finance-entry.html', gate: 'finance' }],
  att: { title: 'يحتاج انتباه', aria: 'حيوانات تحتاج انتباه',
         items: [{ href: 'animal-detail.html?id=1', kind: 'health', av: '🐐', tag: 'G-1', why: 'حالة صحية نشطة' }] },
}`;

const renderInto = (app, cfgSrc) => app.eval(
  `document.body.innerHTML = '<div id="host"></div>';
   document.getElementById('host').innerHTML = renderStream(${cfgSrc}); 'ok'`);

const classesOf = (app, sel) => J(app.eval(
  `[...document.querySelectorAll(${JSON.stringify(sel)})].map(e => (e.className||'').toString().split(' ')[0])`));

module.exports = suite('30 · PAGE STREAM V3 — the shared language every page composes', ({ test }) => {

  /* ── 1 · order, and the refusal to render an empty box ──────────────── */

  test('the stream reads daybar → focus → pulse → quick → attention, and omits what a page has nothing to say about', async () => {
    const app = await boot();
    assert.strictEqual(await renderInto(app, FULL), 'ok');
    assert.deepStrictEqual(classesOf(app, '#x-stream > *'), ['daybar', 'focus', 'pulse', 'quick', 'att'],
      'the five parts, in the order the eye reads them');
    // a page with only a state pill: no focus, no strip, no empty boxes
    assert.strictEqual(await renderInto(app, `{ id: 'bare', state: 'ok', day: 'يوم' }`), 'ok');
    assert.deepStrictEqual(classesOf(app, '#bare > *'), ['daybar']);
    assert.strictEqual(app.window.document.querySelectorAll('.focus, .pulse, .quick, .att').length, 0,
      'an absent part is absent — never a card with an em dash in it');
    app.close();
  });

  test('renderStreamHead() is the same language without the numbers, for form and table pages', async () => {
    const app = await boot();
    assert.strictEqual(await app.eval(
      `document.body.innerHTML = '<div id="host"></div>';
       document.getElementById('host').innerHTML = renderStreamHead(${FULL}); 'ok'`), 'ok');
    assert.deepStrictEqual(classesOf(app, '#x-stream > *'), ['daybar', 'focus', 'quick'],
      'identity, decision and actions — the strip and the chips stay on pages that have numbers');
    app.close();
  });

  /* ── 2 · the two clocks: storage keys vs screen digits ─────────────── */

  test('pageNow() keeps storage keys ISO and screen digits Arabic-Indic — the mix that once emptied the trend', async () => {
    const app = await boot();
    const got = J(app.eval(`(() => {
      const n = pageNow(new Date('2026-10-20T09:05:00'));
      return { isoDay: n.isoDay, clock: n.clock, days: n.isoDays(7) };
    })()`));
    assert.strictEqual(got.isoDay, '2026-10-20');
    assert.ok(!/[\u0660-\u0669]/.test(got.isoDay), 'a storage key never carries Arabic-Indic digits');
    assert.ok(/[\u0660-\u0669]/.test(got.clock) && got.clock.includes(':'), 'and the screen does: ٠٩:٠٥');
    assert.strictEqual(got.days.length, 7);
    assert.strictEqual(got.days[6], '2026-10-20', 'the series ends today');
    assert.deepStrictEqual([...got.days].sort(), got.days, 'and runs oldest → newest');
    app.close();
  });

  /* ── 3 · the trend is real or it is absent ─────────────────────────── */

  test('sparkSVG draws one point per day, and refuses to draw a flat lie', async () => {
    const app = await boot();
    const got = J(app.eval(`(() => {
      const svg = sparkSVG([1, 2, 3, 4, 5, 6, 7], { label: 'لبن — ٧ أيام' });
      const doc = new DOMParser().parseFromString('<div id="w">' + svg + '</div>', 'text/html');
      const s = doc.getElementById('w').querySelector('svg');
      return { points: s.querySelector('polyline').getAttribute('points').trim().split(/\\s+/).length,
               role: s.getAttribute('role'), label: s.getAttribute('aria-label'),
               zero: sparkSVG([0, 0, 0, 0, 0, 0, 0]), short: sparkSVG([5]),
               junk: sparkSVG([null, undefined, 3, 4, '', 6, 7]).length > 0 };
    })()`));
    assert.strictEqual(got.points, 7, 'seven days, seven points');
    assert.strictEqual(got.role, 'img');
    assert.ok(/لبن/.test(got.label), 'a sparkline without a name is decoration');
    assert.strictEqual(got.zero, '', 'no data → no line, and the caller shows the empty state');
    assert.strictEqual(got.short, '', 'one point is not a trend');
    assert.ok(got.junk, 'and a series with holes still draws its real points');
    app.close();
  });

  test('the change is an attribute plus an arrow plus digits — never colour alone', async () => {
    const app = await boot();
    const got = J(app.eval(`(() => {
      const up = sparkDelta([1, 1, 1, 4, 4, 4]), down = sparkDelta([4, 4, 4, 1, 1, 1]);
      return { upDir: up.dir, upVal: up.value, downDir: down.dir, downVal: down.value,
               flat: sparkDelta([0, 0, 0, 0]), short: sparkDelta([7]),
               zeroBase: sparkDelta([0, 0, 0, 5, 5, 5]) };
    })()`));
    assert.strictEqual(got.upDir, 'up'); assert.ok(got.upVal > 0);
    assert.strictEqual(got.downDir, 'down'); assert.ok(got.downVal > 0);
    assert.strictEqual(got.flat, null, 'all-zero has no basis to compare');
    assert.strictEqual(got.short, null);
    assert.strictEqual(got.zeroBase, null, 'and neither does a rise from nothing — that is not +∞%');
    assert.strictEqual(await renderInto(app, FULL), 'ok');
    const dom = J(app.eval(`(() => {
      const d = document.querySelector('.pulse__delta');
      return { dir: d.getAttribute('data-dir'), text: d.textContent.trim() };
    })()`));
    assert.ok(['up', 'down'].includes(dom.dir));
    assert.ok(/[▲▼]/.test(dom.text) && /٪/.test(dom.text), `arrow + percentage, got "${dom.text}"`);
    app.close();
  });

  test('a trend with no data says what to do next instead of drawing a line', async () => {
    const app = await boot();
    assert.strictEqual(await renderInto(app, `{ id: 'e', pulse: [{ label: 'لبن', value: '—', foot: 'اليوم', state: 'flat' }],
      trend: { label: 'لبن — ٧ أيام', series: [0, 0, 0, 0, 0, 0, 0], emptyText: 'لا يوجد إنتاج مسجّل',
               emptyHref: 'production.html', emptyLabel: 'سجّل الإنتاج' } }`), 'ok');
    const got = J(app.eval(`(() => {
      const e = document.querySelector('.pulse__empty');
      return { svg: !!document.querySelector('.dash-spark'), text: e.textContent.trim(),
               href: e.querySelector('a').getAttribute('href'),
               delta: document.querySelector('.pulse__delta').getAttribute('data-dir') };
    })()`));
    assert.ok(!got.svg, 'no fake flat line');
    assert.ok(/لا يوجد إنتاج مسجّل/.test(got.text) && /سجّل الإنتاج/.test(got.text));
    assert.strictEqual(got.href, 'production.html', 'the empty state carries the next step');
    assert.strictEqual(got.delta, 'flat', 'and the delta reads as "nothing to compare", not as 0%');
    app.close();
  });

  /* ── 4 · state is a whitelisted attribute ─────────────────────────── */

  test('an unknown state falls back to a valid one — data-state can never read "undefined"', async () => {
    const app = await boot();
    assert.strictEqual(await renderInto(app, `{ id: 's', state: 'wat',
      focus: { state: 'nope', title: 'عنوان' },
      pulse: [{ label: 'لبن', value: '١', foot: 'اليوم', state: 'zzz' }],
      att: { items: [{ href: 'a.html', kind: 'weird', tag: 'G-1', why: 'سبب' }] },
      tl: { items: [{ time: '٠٩:٠٥', text: 'حدث', meta: 'مدير', kind: 'zzz' }] } }`), 'ok');
    const got = J(app.eval(`(() => ({
      day: document.querySelector('.daybar').getAttribute('data-state'),
      pill: document.querySelectorAll('.statepill').length,
      focus: document.querySelector('.focus').getAttribute('data-state'),
      cell: document.querySelector('.pulse__cell').getAttribute('data-state'),
      tl: document.querySelector('.tl__item').getAttribute('data-kind'),
      anyUndefined: /data-(state|kind|dir)="undefined"/.test(document.getElementById('host').innerHTML),
    }))()`));
    assert.strictEqual(got.day, 'ok'); assert.strictEqual(got.focus, 'ok');
    assert.strictEqual(got.cell, 'flat'); assert.strictEqual(got.tl, 'flat');
    assert.strictEqual(got.pill, 0, 'no pill was configured, so no pill renders');
    assert.ok(!got.anyUndefined, 'a leaked undefined would style as nothing and read as nothing');
    app.close();
  });

  /* ── 5 · the builders take data, not markup ───────────────────────── */

  test('every free-text field is escaped: a page can hand the stream database text safely', async () => {
    const app = await boot();
    const EVIL = `<img src=x onerror="window.__pwn=1">\"><b>break</b>`;
    assert.strictEqual(await renderInto(app, `{ id: 'x', day: ${JSON.stringify(EVIL)},
      pill: { value: ${JSON.stringify(EVIL)}, label: ${JSON.stringify(EVIL)} },
      chips: [{ text: ${JSON.stringify(EVIL)} }],
      focus: { state: 'act', title: ${JSON.stringify(EVIL)}, why: ${JSON.stringify(EVIL)},
               cta: { href: ${JSON.stringify('health.html" onclick="window.__pwn=2')}, label: ${JSON.stringify(EVIL)} },
               next: [{ href: 'a.html', label: ${JSON.stringify(EVIL)} }] },
      pulse: [{ label: ${JSON.stringify(EVIL)}, value: ${JSON.stringify(EVIL)}, foot: ${JSON.stringify(EVIL)} }],
      quick: [{ label: ${JSON.stringify(EVIL)}, href: ${JSON.stringify('tasks.html" onclick="window.__pwn=3')} }],
      att: { title: ${JSON.stringify(EVIL)}, items: [{ href: 'animal-detail.html?id=1', tag: ${JSON.stringify(EVIL)}, why: ${JSON.stringify(EVIL)} }] },
      tl: { items: [{ time: '٠٩:٠٥', text: ${JSON.stringify(EVIL)}, meta: ${JSON.stringify(EVIL)} }] } }`), 'ok');
    const got = J(app.eval(`(() => ({
      imgs: document.querySelectorAll('#host img').length,
      bolds: document.querySelectorAll('#host .focus__title b, #host .pulse__value b, #host .tl__body b b').length,
      pwn: window.__pwn || 0,
      onclicks: [...document.querySelectorAll('#host a[href]')].filter(a => a.getAttribute('onclick')).length,
      escaped: /&lt;img/.test(document.getElementById('host').innerHTML),
      title: document.querySelector('.focus__title').textContent.trim(),
    }))()`));
    assert.strictEqual(got.imgs, 0, 'no injected element anywhere in the stream');
    assert.strictEqual(got.bolds, 0, 'the payload\'s own <b> never became markup');
    assert.strictEqual(got.pwn, 0);
    assert.strictEqual(got.onclicks, 0, 'and a poisoned href cannot smuggle a handler');
    assert.ok(got.escaped && got.title.startsWith('<img src=x'), 'the text is shown, literally, as data');
    app.close();
  });

  test('a handler interpolating a database value keeps that value a string, not code', async () => {
    const app = await boot();
    const payload = `x'); document.title='pwned'; ('`;
    assert.strictEqual(await app.eval(
      `window.__got = []; window.rec = function (v) { window.__got.push(v); };
       document.body.innerHTML = '<div id="host"></div>';
       window.__p = ${JSON.stringify(payload)};
       document.getElementById('host').innerHTML =
         streamQuick([{ label: 'a', fn: 'rec', arg: window.__p },
                      { label: 'b', onclick: "openUnifiedBirthModal('goat')" }]); 'ok'`), 'ok');
    const got = J(app.eval(`(() => {
      // payload lives as window.__p from the outer eval
      const b = [...document.querySelectorAll('.quick__btn')];
      const src = b[0].getAttribute('onclick');
      // jsdom does not execute inline onclick on click(); verify the
      // handler string is syntactically one call with the payload as its
      // sole argument by compiling it: the function receives the payload
      // as a string and no other code runs.
      let received = null; let threw = null;
      try { const fn = new Function('rec', src); fn(v => { received = v; }); } catch (e) { threw = e.message; }
      return { attrs: [...b[0].attributes].map(a => a.name),
               trusted: b[1].getAttribute('onclick'),
               received, threw, title: document.title,
               raw: /&#39;/.test(streamHandler({ fn: 'rec', arg: window.__p })) , p: window.__p };
    })()`));
    assert.deepStrictEqual(got.attrs.sort(), ['class', 'onclick', 'type'], 'no attribute was smuggled in');
    assert.strictEqual(got.threw, null, got.threw);
    assert.strictEqual(got.received, got.p, 'the hostile record arrived as one string argument, and nothing else ran');
    assert.notStrictEqual(got.title, 'pwned');
    assert.strictEqual(got.trusted, "openUnifiedBirthModal('goat')", 'a handler the page wrote keeps its own quotes');
    assert.ok(got.raw, 'the interpolated quote is escaped for HTML too, so it cannot end the attribute');
    app.close();
  });

  test('an icon name is a class token, never an injection point', async () => {
    const app = await boot();
    const got = J(app.eval(`(() => ({
      good: streamIcon('bi-heart-pulse'), empty: streamIcon(''),
      evil: streamIcon('bi-x" onload="window.__pwn=1'), slash: streamIcon('bi-a b'),
    }))()`));
    assert.strictEqual(got.good, 'bi-heart-pulse');
    assert.strictEqual(got.empty, 'bi-circle'); assert.strictEqual(got.evil, 'bi-circle');
    assert.strictEqual(got.slash, 'bi-circle');
    assert.strictEqual(await renderInto(app, `{ id: 'i', focus: { state: 'ok', title: 'ع', cta: { href: 'a.html', label: 'ل', icon: 'bi-x" onload="window.__pwn=1' } } }`), 'ok');
    const dom = J(app.eval(`(() => { const i = document.querySelector('.focus__cta i'); return { attrs: [...i.attributes].map(a => a.name), cls: i.getAttribute('class'), pwn: window.__pwn || 0 }; })()`));
    assert.deepStrictEqual(dom.attrs, ['class']);
    assert.ok(/\bbi-circle\b/.test(dom.cls) && !/onload/.test(dom.cls), `the payload became a fallback icon, got "${dom.cls}"`);
    assert.strictEqual(dom.pwn, 0);
    app.close();
  });

  /* ── 6 · the decision card stays a decision ───────────────────────── */

  test('the focus card names ONE decision and caps the queue at two', async () => {
    const app = await boot();
    assert.strictEqual(await renderInto(app, FULL), 'ok');
    const got = J(app.eval(`(() => ({
      eyebrow: document.querySelector('.focus__eyebrow').textContent.trim(),
      title: document.querySelector('.focus__title').textContent.trim(),
      why: document.querySelector('.focus__why').textContent.trim(),
      cta: document.querySelector('.focus__cta').getAttribute('href'),
      ctaText: document.querySelector('.focus__cta').textContent.trim(),
      next: document.querySelectorAll('.focus__next li').length,
      aria: document.querySelector('.focus').getAttribute('aria-label'),
      state: document.querySelector('.focus').getAttribute('data-state'),
    }))()`));
    assert.strictEqual(got.eyebrow, 'قرار اليوم');
    assert.ok(got.title.length > 5 && got.why.length > 1, 'what, and why');
    assert.strictEqual(got.cta, 'health.html');
    assert.ok(got.ctaText.length > 2, 'a verb, not just a number');
    assert.strictEqual(got.next, 2, 'a third item would make it a queue again');
    assert.ok(got.aria && got.state === 'act');
    app.close();
  });

  test('a calm day reads as calm, and the calm CTA is not styled like an alarm', async () => {
    const app = await boot();
    assert.strictEqual(await renderInto(app, `{ id: 'c', focus: { state: 'calm', title: 'لا شيء يحتاج قرارًا اليوم',
      cta: { href: 'diary.html', label: 'افتح يومية المزرعة', icon: 'bi-journal-text' } } }`), 'ok');
    const got = J(app.eval(`(() => { const c = document.querySelector('.focus__cta');
      return { cls: c.className, state: document.querySelector('.focus').getAttribute('data-state') }; })()`));
    assert.strictEqual(got.state, 'calm');
    assert.ok(/focus__cta--calm/.test(got.cls), 'the modifier is what keeps it quiet');
    app.close();
  });

  /* ── 7 · the timeline ─────────────────────────────────────────────── */

  test('the timeline shows what happened, and says so when nothing did — unless the page has no history', async () => {
    const app = await boot();
    assert.strictEqual(await app.eval(
      `document.body.innerHTML = '<div id="host"></div>';
       document.getElementById('host').innerHTML = streamTimeline({ className: 'mb-4', title: 'الحركة',
         items: [{ kind: 'good', time: '٠٩:٠٥', icon: 'bi-plus-circle', text: 'تسجيل إنتاج', meta: 'عامل · production_log' },
                 { kind: 'bad', time: '٠٨:٠٠', icon: 'bi-trash3', text: 'حذف صنف', meta: 'مدير · inventory' }],
         empty: { text: 'لا حركة مسجّلة بعد اليوم', href: 'reports.html', label: 'التقارير' } }); 'ok'`), 'ok');
    let got = J(app.eval(`(() => { const r = [...document.querySelectorAll('.tl__item')];
      return { count: r.length, kinds: r.map(x => x.getAttribute('data-kind')),
               times: r.map(x => x.querySelector('.tl__time').textContent.trim()),
               dots: r.map(x => x.querySelector('.tl__dot i').getAttribute('class')),
               text: r[0].querySelector('.tl__body b').textContent.trim(),
               meta: r[0].querySelector('.tl__body small').textContent.trim(),
               cls: document.querySelector('.tl').className }; })()`));
    assert.strictEqual(got.count, 2);
    assert.deepStrictEqual(got.kinds, ['good', 'bad'], 'an add and a delete differ in greyscale');
    assert.deepStrictEqual(got.times, ['٠٩:٠٥', '٠٨:٠٠']);
    assert.ok(got.dots[0].includes('bi-plus-circle') && got.dots[1].includes('bi-trash3'));
    assert.strictEqual(got.text, 'تسجيل إنتاج');
    assert.ok(/عامل/.test(got.meta) && /production_log/.test(got.meta), 'who did it, and where');
    assert.ok(/mb-4/.test(got.cls), 'the caller keeps its spacing utility');

    assert.strictEqual(await app.eval(`document.getElementById('host').innerHTML = streamTimeline({ items: [],
      empty: { text: 'لا حركة مسجّلة بعد اليوم', small: 'يظهر هنا تلقائيًا', href: 'reports.html', label: 'التقارير' } }); 'ok'`), 'ok');
    got = J(app.eval(`(() => { const e = document.querySelector('.tl--empty');
      return { rows: document.querySelectorAll('.tl__item').length, text: e.textContent.trim(),
               href: e.querySelector('a').getAttribute('href') }; })()`));
    assert.strictEqual(got.rows, 0, 'no invented history');
    assert.ok(/لا حركة مسجّلة/.test(got.text) && got.href === 'reports.html');

    await app.eval(`document.getElementById('host').innerHTML = streamTimeline({ items: [], empty: false }); 'ok'`);
    assert.strictEqual(await app.eval(`document.getElementById('host').innerHTML.length`), 0,
      'a page with no concept of history renders nothing at all');
    app.close();
  });

  /* ── 8 · permission gating ────────────────────────────────────────── */

  test('an action gated by can() is absent for the role that cannot run it — not disabled, absent', async () => {
    const worker = await boot('worker');
    assert.strictEqual(await renderInto(worker, FULL), 'ok');
    let got = J(worker.eval(`[...document.querySelectorAll('.quick__btn')].map(b => b.textContent.trim())`));
    assert.deepStrictEqual(got, ['إضافة حيوان'], 'finance is not in ROLE_PERMS.worker');
    assert.strictEqual(worker.window.document.querySelectorAll('.quick__btn[disabled]').length, 0,
      'a button that only fails on click is worse than no button');
    worker.close();

    const admin = await boot('admin');
    assert.strictEqual(await renderInto(admin, FULL), 'ok');
    got = J(admin.eval(`[...document.querySelectorAll('.quick__btn')].map(b => b.textContent.trim())`));
    assert.deepStrictEqual(got, ['إضافة حيوان', 'إيراد / مصروف']);
    admin.close();
  });

  /* ── 9 · the language cannot drift from its stylesheet ────────────── */

  test('every class the builders emit is a class ui.css actually styles', async () => {
    const app = await boot();
    assert.strictEqual(await renderInto(app, FULL), 'ok');
    await app.eval(`document.getElementById('host').innerHTML += streamTimeline({ className: 'mb-4', items: [{ kind: 'good', time: '٠٩:٠٥', text: 'حدث', meta: 'مدير' }] }); 'ok'`);
    const tokens = J(app.eval(`(() => {
      const skip = /^(me-|ms-|mt-|mb-|fw-|text-|bi$|bi-)/;
      const out = new Set();
      document.querySelectorAll('#host *').forEach(e => {
        const cls = (e.getAttribute('class') || '').toString();
        cls.split(/\\s+/).forEach(c => { if (c && !skip.test(c)) out.add(c); });
      });
      return [...out];
    })()`));
    assert.ok(tokens.length > 20, `the stream must be exercised, saw ${tokens.length} classes`);
    const unstyled = tokens.filter(t => !new RegExp('\\.' + t.replace(/[-]/g, '\\-') + '[\\s,{:.\\[]').test(UICSS));
    assert.deepStrictEqual(unstyled, [], 'a class nobody styles renders as browser default — that is how the home looked before §17');
    app.close();
  });

  test('dashboard.html consumes the builders instead of hand-rolling a second copy', () => {
    assert.ok(/renderStream\(\{/.test(DASH), 'the home stream is built by the shared builder');
    assert.ok(/streamTimeline\(\{/.test(DASH), 'and so is its timeline');
    assert.ok(!/<div class="daybar"/.test(DASH) && !/class="pulse__cell"/.test(DASH) && !/class="tl__item"/.test(DASH),
      'no markup copy of the language is left in the page — two copies is how dialects start');
    assert.ok(/function renderStream\(/.test(SHARED) && /function streamDaybar\(/.test(SHARED) && /function streamFocus\(/.test(SHARED)
      && /function streamPulse\(/.test(SHARED) && /function streamQuick\(/.test(SHARED) && /function streamAttention\(/.test(SHARED)
      && /function streamTimeline\(/.test(SHARED) && /function sparkSVG\(/.test(SHARED) && /function pageNow\(/.test(SHARED));
  });
});
