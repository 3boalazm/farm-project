// Module 01 — Core utilities (firebase.js: ar/pad2/todayStr/genId/escape*,
// shared.js: todayAr/timeAr/breedStats)
const { bootApp, suite, assert } = require('./harness');

module.exports = suite('01 · Core utilities', ({ test }) => {
  let app;

  test('boots the real script chain without errors', async () => {
    app = await bootApp();
    assert.deepStrictEqual(
      app.consoleErrors.filter((e) => !/Firebase Auth unavailable|Failed to fetch/.test(e)),
      []
    );
  });

  test('ar() converts every ASCII digit to its Arabic-Indic glyph', () => {
    assert.strictEqual(app.eval(`ar('0123456789')`), '٠١٢٣٤٥٦٧٨٩');
  });

  test('ar() leaves non-digits, null and undefined untouched', () => {
    assert.strictEqual(app.eval(`ar('abc-12.5')`), 'abc-١٢.٥');
    assert.strictEqual(app.eval(`ar(null)`), '');
    assert.strictEqual(app.eval(`ar(undefined)`), '');
    assert.strictEqual(app.eval(`ar(42)`), '٤٢');
  });

  test('pad2() zero-pads to two Arabic-Indic digits', () => {
    assert.strictEqual(app.eval(`pad2(3)`), '٠٣');
    assert.strictEqual(app.eval(`pad2(11)`), '١١');
    assert.strictEqual(app.eval(`pad2(0)`), '٠٠');
  });

  test('todayStr() is local YYYY-MM-DD (never UTC-shifted)', () => {
    const s = app.eval(`todayStr()`);
    assert.match(s, /^\d{4}-\d{2}-\d{2}$/);
    const d = new Date();
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    assert.strictEqual(s, expected, 'todayStr must match the LOCAL calendar date');
  });

  test('genId() is collision-free across 5,000 same-millisecond calls', () => {
    // genId() is the operationId idempotency key for every financial
    // posting, so a collision silently drops a real transaction. The old
    // 3-random-character form produced duplicates here.
    const ids = app.eval(`(function(){var o=[];for(var i=0;i<5000;i++)o.push(genId());return o;})()`);
    assert.strictEqual(new Set(ids).size, ids.length, 'duplicate id generated');
    ids.forEach((id) => assert.match(id, /^[a-z0-9]+$/));
  });

  test('escapeHtml() neutralises all five HTML metacharacters', () => {
    assert.strictEqual(
      app.eval(`escapeHtml('<img src=x onerror="alert(1)">\\'&')`),
      '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&#39;&amp;'
    );
  });

  test('escapeHtml() is idempotent-safe on null/undefined/numbers', () => {
    assert.strictEqual(app.eval(`escapeHtml(null)`), '');
    assert.strictEqual(app.eval(`escapeHtml(undefined)`), '');
    assert.strictEqual(app.eval(`escapeHtml(0)`), '0');
  });

  test('escapeJsAttr() survives the HTML-decode → JS-parse double layer', () => {
    // The browser decodes entities BEFORE the onclick JS runs, so the
    // value must be escaped for the JS string context first.
    const out = app.eval(`escapeJsAttr("a');alert(1);//")`);
    assert.ok(!/[^\\]'/.test(out.replace(/&#39;/g, '')), 'unescaped single quote leaked');
    // Simulate: HTML-decode, then evaluate as a JS string literal.
    const decoded = out
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
    const evaluated = app.eval(`(function(){ var v='${decoded}'; return v; })()`);
    assert.strictEqual(evaluated, "a');alert(1);//");
  });

  test('todayAr()/timeAr() render Arabic-Indic dates and tolerate empty input', () => {
    assert.match(app.eval(`todayAr()`), /^[٠-٩]{4}\/[٠-٩]{2}\/[٠-٩]{2}$/);
    assert.strictEqual(app.eval(`timeAr(null)`), '—');
    assert.strictEqual(app.eval(`timeAr('')`), '—');
    assert.match(app.eval(`timeAr('2026-03-04T05:06:07')`), /[٠-٩]{4}\/[٠-٩]{2}\/[٠-٩]{2} [٠-٩]{2}:[٠-٩]{2}/);
  });

  test('breedStats() counts alive/dead/births per breed without mutating input', () => {
    const animals = [
      { species: 'goat', breed: 'شامي', gender: 'female', status: 'alive' },
      { species: 'goat', breed: 'شامي', gender: 'male', status: 'alive' },
      { species: 'goat', breed: 'شامي', gender: 'female', status: 'dead' },
      { species: 'sheep', breed: 'برقي', gender: 'female', status: 'alive' },
    ];
    app.db.data.animals = {};
    const before = JSON.stringify(animals);
    const stats = app.eval(`(function(){ window.__a=${JSON.stringify(animals)}; return breedStats(window.__a,'goat','شامي'); })()`);
    assert.strictEqual(JSON.stringify(animals), before, 'input array must not be mutated');
    assert.strictEqual(typeof stats, 'object');
  });

  test('getSettings() merges config.js defaults with localStorage overrides field-by-field', async () => {
    app.window.localStorage.setItem('farm_settings', JSON.stringify({ lifecycle: { adult_months: 24 } }));
    const s = app.eval(`getSettings()`);
    assert.strictEqual(s.lifecycle.adult_months, 24, 'the overridden field wins');
    assert.strictEqual(s.lifecycle.newborn_months, 2, 'untouched siblings still fall back to config.js');
    assert.strictEqual(s.lifecycle.weaning_months, 3);
    assert.strictEqual(s.currency, 'ج.م');
    app.window.localStorage.removeItem('farm_settings');
  });

  test('saveSettings() round-trips through getSettings()', () => {
    app.eval(`saveSettings({farmName:'مزرعة الاختبار'})`);
    assert.strictEqual(app.eval(`getSettings().farmName`), 'مزرعة الاختبار');
    app.window.localStorage.removeItem('farm_settings');
  });
});
