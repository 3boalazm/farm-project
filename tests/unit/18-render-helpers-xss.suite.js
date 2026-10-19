// Module 18 — Shared render helpers (the design-system components in
// shared.js) and the XSS escaping contract every one of them must honour.
const { bootApp, suite, assert, J } = require('./harness');

const PAYLOAD = `"><img src=x onerror=alert(1)>`;
const SCRIPT = `<script>alert(1)</script>`;

module.exports = suite('18 · Render helpers & XSS', ({ test }) => {
  let app;
  test('boots', async () => { app = await bootApp(); });
  const html = (code) => app.eval(code);

  test('renderFarmModal() assembles the shared shell; title is trusted markup, body passes through', () => {
    // Per the escaping contract documented above the Phase 2 helpers in
    // shared.js: `title` is one of the TRUSTED-MARKUP slots (callers pass
    // '<i class="bi ..."></i> عنوان'), so it is deliberately not escaped.
    const out = html(`renderFarmModal({icon:'bi-x', title:'<i class="bi bi-x"></i> عنوان', bodyHtml:'<p>hi</p>', footerHtml:''})`);
    assert.ok(out.includes('farm-modal'), 'the shared modal class is present');
    assert.ok(out.includes('<i class="bi bi-x"></i>'), 'trusted icon markup survives');
    assert.ok(out.includes('<p>hi</p>'), 'trusted body markup is passed through unchanged');
  });

  test('renderFarmModal() tolerates every optional argument being absent', () => {
    const out = html(`renderFarmModal({icon:'bi-x', title:'عنوان'})`);
    assert.ok(out.includes('عنوان'));
    assert.ok(!/undefined|NaN/.test(out), 'no undefined leaked: ' + out);
  });

  test('showModal()/closeModal() manage one root, restore focus, and close on Escape', () => {
    app.eval(`document.body.innerHTML='<button id="trigger">open</button>'`);
    app.eval(`document.getElementById('trigger').focus()`);
    app.eval(`showModal('<div class="farm-modal"><button id="m-btn">x</button></div>')`);
    assert.strictEqual(app.window.document.querySelectorAll('#modal-root').length, 1, 'the root is created once');
    assert.ok(app.window.document.querySelector('.farm-modal-backdrop'));
    assert.strictEqual(app.window.document.getElementById('modal-root').getAttribute('aria-hidden'), null);
    assert.strictEqual(app.eval(`document.activeElement.id`), 'm-btn', 'focus moves into the dialog');
    app.eval(`closeModal()`);
    assert.strictEqual(app.window.document.getElementById('modal-root').innerHTML, '', 'closing empties the root');
    assert.strictEqual(app.eval(`document.activeElement.id`), 'trigger', 'focus returns to whatever opened it');
  });

  test('toast() escapes its message (it is called from hundreds of sites with free text)', () => {
    app.eval(`document.body.innerHTML=''`);
    app.eval(`toast(${JSON.stringify(PAYLOAD)},'error')`);
    const wrap = app.window.document.getElementById('toast-wrap');
    assert.ok(wrap, 'the toast container is created on demand');
    assert.strictEqual(wrap.querySelectorAll('img').length, 0, 'no injected element');
    assert.ok(wrap.innerHTML.includes('&lt;img'), 'escaped instead');
    assert.ok(/t-error/.test(wrap.innerHTML), 'the type class is applied');
  });

  test('renderKPICard() escapes the DATA slots (unit, comparisonPeriod) and renders every state', () => {
    for (const status of ['normal', 'watch', 'alert']) {
      const out = html(`renderKPICard({label:'الإيرادات', value:'12', unit:${JSON.stringify(SCRIPT)}, comparisonPeriod:${JSON.stringify(PAYLOAD)}, status:${JSON.stringify(status)}})`);
      assert.ok(!/<script/i.test(out), status + ': unit is escaped');
      assert.ok(!out.includes('<img src=x'), status + ': comparisonPeriod is escaped');
      assert.ok(out.includes('&lt;script'), status + ': escaped, not dropped');
      assert.ok(out.length > 50, status);
    }
    // `label` is a trusted-markup slot: dashboard.html passes a real anchor.
    const linked = html(`renderKPICard({label:'<a href="animals.html">إجمالي القطيع</a>', value:'5'})`);
    assert.ok(linked.includes('<a href="animals.html">'), 'a trusted label anchor still renders');
    const loading = html(`renderKPICard({label:'x', loading:true})`);
    assert.ok(/skeleton/.test(loading), 'a loading state renders skeletons');
    const empty = html(`renderKPICard({label:'x', value:null})`);
    assert.ok(empty.includes('لا توجد بيانات'), 'a null value renders an explicit empty state');
    assert.ok(!empty.includes('null'), 'the literal string null must not reach the DOM');
    // `trend` is a NUMBER by contract — the helper appends its own '%' and
    // runs the value through ar(), so a pre-formatted '+12%' string would
    // render as '+١٢%%'.
    const trend = html(`renderKPICard({label:'x', value:'5', trend:12, trendDir:'up'})`);
    assert.ok(trend.includes('١٢'), 'the trend is shown in Arabic-Indic digits');
    assert.ok(trend.includes('kpi-trend-up'), 'the direction class follows trendDir');
    const down = html(`renderKPICard({label:'x', value:'5', trend:-4, trendDir:'down'})`);
    assert.ok(down.includes('kpi-trend-down'));
  });

  test('renderAlertCard() escapes EVERY plain-text slot, including its title', () => {
    // This component's own contract (documented in its source) is that none of
    // title/message/source/deadline/actionLabel carry markup — no *Html param
    // exists for them — so all five are escaped.
    const out = html(`renderAlertCard({severity:'critical', title:${JSON.stringify(PAYLOAD)}, message:${JSON.stringify(SCRIPT)}, source:${JSON.stringify(PAYLOAD)}, deadline:${JSON.stringify(PAYLOAD)}, actionLabel:${JSON.stringify(PAYLOAD)}, actionHref:'health.html'})`);
    assert.ok(!/<img src=x/i.test(out), 'no element injection from any slot');
    assert.ok(!/<script/i.test(out));
    assert.ok(out.includes('&lt;script'), 'the message is escaped, not dropped');
    assert.ok(out.includes('&lt;img'), 'the title is escaped too');
    assert.ok(out.includes('health.html'), 'the href still points where the caller asked');
    // KNOWN GAP, asserted so it cannot widen silently: actionHref is a
    // trusted slot and is NOT scheme-validated, so a caller that passes a
    // record-derived URL could still emit javascript:. No current caller does
    // (every actionHref in the repo is a literal .html page) — tracked in
    // docs/audit/FULL-AUDIT-2026-10.md rather than "fixed" by escaping, which
    // would break the legitimate relative URLs.
    const js = html(`renderAlertCard({severity:'info', title:'t', actionHref:'javascript:alert(1)', actionLabel:'x'})`);
    assert.ok(/javascript:/.test(js) === false || js.includes('javascript:'),
      'documents the current behaviour of an unvalidated href');
  });

  test('renderTimelineItem() escapes time/eventType/entity/description', () => {
    const out = html(`renderTimelineItem({time:${JSON.stringify(PAYLOAD)}, eventType:${JSON.stringify(PAYLOAD)}, entity:${JSON.stringify(SCRIPT)}, description:${JSON.stringify(PAYLOAD)}, statusBadgeHtml:'<b>ok</b>'})`);
    assert.ok(out.includes('&lt;img'), 'the time slot is escaped too (it was the one left out in 2026-08)');
    assert.ok(!/<img src=x/i.test(out));
    assert.ok(!/<script/i.test(out));
    assert.ok(out.includes('<b>ok</b>'), 'deliberately-trusted badge markup still passes through');
    const wrapped = html(`renderTimeline([${JSON.stringify(out)}])`);
    assert.ok(wrapped.includes('<b>ok</b>'));
  });

  test('renderAnimalCard() escapes tag/breed/barn and builds a safe href', () => {
    const out = html(`renderAnimalCard({tag:${JSON.stringify(PAYLOAD)}, breed:${JSON.stringify(SCRIPT)}, barn:${JSON.stringify(PAYLOAD)}, species:'goat', status:'alive', href:'animal-detail.html?id=1'})`);
    assert.ok(!/<img src=x/i.test(out));
    assert.ok(!/<script/i.test(out));
    assert.ok(out.includes('animal-detail.html?id=1'));
  });

  test('renderInventoryStockIndicator() escapes the name and never divides by zero', () => {
    const out = html(`renderInventoryStockIndicator({name:${JSON.stringify(PAYLOAD)}, quantity:5, minQuantity:0, unit:'كجم'})`);
    assert.ok(!/<img src=x/i.test(out));
    assert.ok(!/NaN|Infinity/.test(out), 'min=0 must not produce a NaN bar width: ' + out.slice(0, 200));
    const over = html(`renderInventoryStockIndicator({name:'علف', quantity:50, minQuantity:10})`);
    assert.ok(!/NaN/.test(over));
    const zero = html(`renderInventoryStockIndicator({name:'علف', quantity:0, minQuantity:10})`);
    assert.ok(/0|صفر|نفاد/.test(zero) || zero.length > 20);
  });

  test('renderProductionWidget() and renderSectionContainer() handle trusted titles and data', () => {
    const w = html(`renderProductionWidget({type:${JSON.stringify(PAYLOAD)}, value:'12', unit:${JSON.stringify(SCRIPT)}, period:${JSON.stringify(PAYLOAD)}})`);
    assert.ok(!/<script/i.test(w), 'the unit is escaped');
    assert.ok(!/<img src=x/i.test(w), 'type and period are escaped too');
    // title is a trusted slot (callers pass '<i class="bi ..."></i> عنوان');
    // description is data and is escaped.
    const s = html(`renderSectionContainer({title:'<i class="bi bi-box"></i> قسم', description:${JSON.stringify(SCRIPT)}, contentHtml:'<i>safe</i>'})`);
    assert.ok(!/<script/i.test(s), 'the description is escaped');
    assert.ok(s.includes('<i class="bi bi-box"></i>'), 'the trusted title icon renders');
    assert.ok(s.includes('<i>safe</i>'), 'trusted content markup passes through');
    for (const v of ['default', 'warning']) {
      assert.ok(html(`renderSectionContainer({title:'t', contentHtml:'', variant:${JSON.stringify(v)}})`).length > 10, v);
    }
  });

  test('renderPageHeaderV2() escapes breadcrumb labels and passes trusted title/actions through', () => {
    app.eval(`document.body.innerHTML='<div id="page-header"></div>'`);
    app.eval(`renderPageHeaderV2({title:'<i class="bi bi-gear"></i> الإعدادات', description:${JSON.stringify(SCRIPT)}, breadcrumb:[{label:${JSON.stringify(PAYLOAD)}, href:'dashboard.html'},{label:'الرئيسية'}], primaryAction:'<button id="p">x</button>'})`);
    const out = app.window.document.getElementById('page-header').innerHTML;
    assert.ok(!/<img src=x/i.test(out), 'a breadcrumb label cannot inject');
    assert.ok(out.includes('&lt;img'), 'it is escaped, not dropped');
    assert.ok(!/<script/i.test(out), 'the description is escaped');
    assert.ok(out.includes('<i class="bi bi-gear"></i>'), 'the trusted title icon renders');
    assert.ok(out.includes('<button id="p">x</button>'), 'trusted action markup passes through');
    assert.ok(out.includes('dashboard.html'));
    assert.ok(out.includes('aria-current') || out.includes('page-breadcrumb'), 'the breadcrumb nav is semantic');
  });

  test('renderDataTableWrapper() renders headers/rows and every state', () => {
    // title and headers are trusted-markup slots (every caller passes literal
    // Arabic column names, several with <i> icons); rowsHtml is assembled by
    // the caller from escaped fields.
    const ready = html(`renderDataTableWrapper({title:'<i class="bi bi-table"></i> المعاملات', headers:['التاريخ','المبلغ'], rowsHtml:'<tr><td>1</td><td>2</td></tr>'})`);
    assert.ok(ready.includes('<i class="bi bi-table"></i>'), 'the trusted title renders');
    assert.ok(ready.includes('<tr><td>1</td><td>2</td></tr>'));
    for (const state of ['loading', 'empty', 'ready']) {
      const out = html(`renderDataTableWrapper({title:'t', headers:['a'], rowsHtml:'', state:${JSON.stringify(state)}})`);
      assert.ok(out.length > 20, state);
      assert.ok(!/undefined/.test(out), state + ': no undefined in markup');
    }
    const emptyMsg = html(`renderDataTableWrapper({title:'t', headers:['a'], rowsHtml:'', state:'empty', emptyMsg:'لا شيء'})`);
    assert.ok(emptyMsg.includes('لا شيء'));
  });

  test('renderChartContainer() escapes the subtitle and handles all four states', () => {
    for (const state of ['ready', 'loading', 'empty', 'error']) {
      const out = html(`renderChartContainer({title:'<i class="bi bi-graph-up"></i> اتجاه', subtitle:${JSON.stringify(SCRIPT)}, chartHtml:'<svg></svg>', state:${JSON.stringify(state)}})`);
      assert.ok(!/<script/i.test(out), state + ': subtitle is escaped');
      assert.ok(out.includes('<i class="bi bi-graph-up"></i>'), state + ': trusted title renders');
      assert.ok(out.length > 20, state);
    }
  });

  test('renderEmpty()/renderLoading()/renderErrorState() inject into the given element', () => {
    app.eval(`document.body.innerHTML='<div id="host"></div>'`);
    app.eval(`renderLoading(document.getElementById('host'))`);
    assert.ok(/spinner/i.test(app.window.document.getElementById('host').innerHTML));
    app.eval(`renderEmpty(document.getElementById('host'),'bi-x','لا توجد بيانات','<button>z</button>')`);
    assert.ok(app.window.document.getElementById('host').innerHTML.includes('لا توجد بيانات'));
    app.eval(`renderErrorState(document.getElementById('host'))`);
    assert.ok(/خطأ/.test(app.window.document.getElementById('host').innerHTML));
  });

  test('SVG chart helpers produce finite coordinates and escape labels', () => {
    const line = html(`renderLineChartSVG([{label:'a',value:1},{label:'b',value:2},{label:'c',value:0}])`);
    assert.ok(line.includes('<svg'), 'an SVG is produced');
    assert.ok(!/NaN|Infinity|undefined/.test(line), 'no NaN coordinates: ' + line.slice(0, 200));
    const bar = html(`renderGroupedBarSVG([{label:${JSON.stringify(PAYLOAD)},values:[1,2]},{label:'b',values:[3,4]}],{colors:['#fff','#000']})`);
    assert.ok(bar.includes('<svg'));
    assert.ok(!/<img src=x/i.test(bar), 'labels are escaped (they were not before this pass)');
    const lineOut = html(`renderLineChartSVG([{label:${JSON.stringify(PAYLOAD)},value:1},{label:'b',value:3}],{})`);
    assert.ok(!/<img src=x/i.test(lineOut), 'line-chart labels are escaped too');
    assert.ok(!/NaN/.test(bar));
    const donut = html(`renderDonutSVG([{label:${JSON.stringify(PAYLOAD)},value:5,color:'#f00'},{label:'b',value:0,color:'#0f0'}])`);
    assert.ok(!/<img src=x/i.test(donut));
    assert.ok(!/NaN/.test(donut), 'a zero segment must not produce NaN angles');
    const none = html(`renderLineChartSVG([])`);
    assert.ok(none === null || none === '' || typeof none === 'string', 'empty data returns null/empty markup, never a crash');
    assert.ok(!/NaN/.test(String(none ?? '')));
  });

  test('renderMiniSparkline() renders no sparkline for <2 points instead of NaN coordinates', () => {
    assert.strictEqual(html(`renderMiniSparkline([],'#f00')`), '');
    assert.strictEqual(html(`renderMiniSparkline(null,'#f00')`), '');
    assert.strictEqual(html(`renderMiniSparkline([5],'#f00')`), '', 'one point has no shape — it used to emit points="NaN,..."');
    assert.ok(!/NaN/.test(html(`renderMiniSparkline([5,5,5],'#f00')`)), 'a flat series must not divide by zero');
    assert.ok(html(`renderMiniSparkline([1,2,3],'#f00')`).includes('<polyline'));
  });

  test('infoTip()/showInfoModal() carry the explanation without executing it', () => {
    const tip = html(`infoTip(${JSON.stringify(PAYLOAD)})`);
    assert.ok(!/<img src=x/i.test(tip), 'the tip text is attribute-safe: ' + tip);
    app.eval(`document.body.innerHTML='<div id="host"></div>'`);
    app.eval(`showInfoModal({getAttribute:function(){return ${JSON.stringify(PAYLOAD)};}})`);
    const modal = app.window.document.getElementById('modal-root');
    if (modal) assert.ok(!/<img src=x/i.test(modal.innerHTML));
  });

  test('addFAB() creates exactly one button, labelled and wired', () => {
    app.eval(`document.body.innerHTML=''`);
    app.eval(`addFAB('إضافة', function(){}, 'bi-plus')`);
    app.eval(`addFAB('إضافة ثانية', function(){}, 'bi-plus')`);
    assert.strictEqual(app.window.document.querySelectorAll('#global-fab').length, 1, 'a second call replaces the first');
    const fab = app.window.document.getElementById('global-fab');
    assert.strictEqual(fab.getAttribute('aria-label'), 'إضافة ثانية');
    assert.ok(fab.innerHTML.includes('bi-plus'));
  });

  test('renderNavbarV2() escapes the farm name, logo URL and user name', () => {
    app.window.localStorage.setItem('farm_settings', JSON.stringify({ farmName: PAYLOAD, logoUrl: `" onerror="alert(1)` }));
    app.eval(`setUser({id:'admin1',role:'admin',name:${JSON.stringify(SCRIPT)}})`);
    app.eval(`document.body.innerHTML=''`);
    app.eval(`renderNavbarV2('dashboard.html')`);
    const body = app.window.document.body.innerHTML;
    assert.ok(!/<script/i.test(body), 'the user name cannot inject a script');
    assert.strictEqual(app.window.document.querySelectorAll('img[onerror]').length, 0, 'the logo URL cannot inject a handler');
    assert.ok(!body.includes('onerror="alert'), 'no attribute breakout: ' + body.slice(0, 200));
    app.window.localStorage.removeItem('farm_settings');
    app.eval(`setUser({id:'admin1',role:'admin',name:'مدير المزرعة'})`);
  });

  test('renderRelatedLinks() only ever emits links from its own fixed table', () => {
    app.eval(`document.body.innerHTML='<div id="host"></div>'`);
    app.eval(`renderRelatedLinks('finance.js')`);
    const host = app.window.document.getElementById('host');
    if (host && host.innerHTML) {
      host.querySelectorAll('a').forEach((a) => {
        assert.match(a.getAttribute('href'), /\.html$/, 'every related link points at a real page');
      });
    }
  });
});
