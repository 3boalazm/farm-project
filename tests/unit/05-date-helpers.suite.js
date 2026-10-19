// Module 05 — Local-calendar date helpers (firebase.js) — regression cover
// for the systemic UTC/local date bug class found by the 2026-10 audit.
const { bootApp, suite, assert, J } = require('./harness');

module.exports = suite('05 · Local-calendar date helpers', ({ test }) => {
  let app;

  test('boots', async () => { app = await bootApp(); });

  test('this suite really runs in a non-UTC zone (otherwise it proves nothing)', () => {
    const offsetMin = -new Date().getTimezoneOffset();
    assert.notStrictEqual(offsetMin, 0, 'run with FARM_TZ unset (default Africa/Cairo) to exercise the real bug');
    // In a UTC+3 zone, local midnight on the 1st is 21:00 UTC the day before.
    const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    assert.notStrictEqual(firstOfMonth.toISOString().slice(0, 7),
      `${firstOfMonth.getFullYear()}-${String(firstOfMonth.getMonth() + 1).padStart(2, '0')}`,
      'precondition: toISOString() must demonstrably disagree with the local month here');
  });

  test('toLocalDateStr() agrees with todayStr() for "now"', () => {
    assert.strictEqual(app.eval(`toLocalDateStr(new Date())`), app.eval(`todayStr()`));
  });

  test('toLocalDateStr() round-trips a stored date string exactly (no day drift)', () => {
    for (const d of ['2026-01-01', '2026-03-31', '2026-12-31', '2024-02-29']) {
      assert.strictEqual(app.eval(`toLocalDateStr(${JSON.stringify(d)})`), d);
    }
  });

  test('toLocalDateStr() never emits the previous day for local midnight', () => {
    // `new Date(y,m,d)` is LOCAL midnight; the old `.toISOString().slice(0,10)`
    // returned the previous calendar day in every zone east of Greenwich.
    const out = app.eval(`(function(){
      var bad=[];
      for(var m=0;m<12;m++){
        for(var d=1;d<=28;d++){
          var dt=new Date(2026,m,d);
          var want=2026+'-'+String(m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
          if(toLocalDateStr(dt)!==want) bad.push(want+' -> '+toLocalDateStr(dt));
        }
      }
      return bad;
    })()`);
    assert.deepStrictEqual(J(out), [], 'local midnight must map to its own calendar day');
  });

  test('toLocalDateStr() rejects garbage instead of returning "NaN-aN-aN"', () => {
    assert.strictEqual(app.eval(`toLocalDateStr('not a date')`), '');
    assert.strictEqual(app.eval(`toLocalDateStr(null)`), '');
    assert.strictEqual(app.eval(`toLocalDateStr(undefined)`), '');
    assert.strictEqual(app.eval(`toLocalDateStr('')`), '');
  });

  test('toLocalMonthKey() gives the LOCAL month for the 1st of every month', () => {
    const out = app.eval(`(function(){
      var bad=[];
      for(var m=0;m<12;m++){
        var dt=new Date(2026,m,1);
        var want='2026-'+String(m+1).padStart(2,'0');
        if(toLocalMonthKey(dt)!==want) bad.push(want+' -> '+toLocalMonthKey(dt));
      }
      return bad;
    })()`);
    assert.deepStrictEqual(J(out), [],
      'the old toISOString().slice(0,7) shifted EVERY 6-month trend chart back one month');
  });

  test('monthStartLocal(-i) walks backwards through local months, wrapping years', () => {
    const keys = app.eval(`(function(){var o=[];for(var i=0;i<14;i++)o.push(toLocalMonthKey(monthStartLocal(-i)));return o;})()`);
    assert.strictEqual(keys.length, 14);
    assert.strictEqual(new Set(keys).size, 14, 'no duplicated month buckets');
    const now = new Date();
    assert.strictEqual(keys[0], `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      'bucket 0 is the CURRENT local month');
    keys.forEach((k) => assert.match(k, /^\d{4}-(0[1-9]|1[0-2])$/));
  });

  test('monthEndLocal() returns the true last day (incl. leap years)', () => {
    assert.strictEqual(app.eval(`monthEndLocal('2026-02-10')`), '2026-02-28');
    assert.strictEqual(app.eval(`monthEndLocal('2024-02-10')`), '2024-02-29');
    assert.strictEqual(app.eval(`monthEndLocal('2026-01-01')`), '2026-01-31');
    assert.strictEqual(app.eval(`monthEndLocal('2026-12-31')`), '2026-12-31');
  });

  test('shiftDateLocal() adds/subtracts whole days without leaving the local calendar', () => {
    assert.strictEqual(app.eval(`shiftDateLocal('2026-03-01', -1)`), '2026-02-28');
    assert.strictEqual(app.eval(`shiftDateLocal('2024-03-01', -1)`), '2024-02-29');
    assert.strictEqual(app.eval(`shiftDateLocal('2026-12-31', 1)`), '2027-01-01');
    assert.strictEqual(app.eval(`shiftDateLocal('2026-05-10', 0)`), '2026-05-10');
  });

  test('shiftDateLocal() computes a pregnancy due date exactly pregnancyDays later', () => {
    const days = app.eval(`getSettings().pregnancyDays`);
    assert.strictEqual(days, 150);
    const due = app.eval(`shiftDateLocal('2026-01-01', getSettings().pregnancyDays)`);
    assert.strictEqual(due, '2026-05-31');
    // The old UTC path drifted a day in UTC+3 for any date whose local
    // midnight fell before 03:00 UTC — assert the local answer explicitly.
    const naive = app.eval(`(function(){var d=new Date('2026-01-01');d.setDate(d.getDate()+150);return d.toISOString().slice(0,10);})()`);
    assert.strictEqual(naive, '2026-05-30', 'documents the off-by-one the helper replaces');
  });

  test('shiftDateLocal() tolerates Date input and bad input', () => {
    assert.strictEqual(app.eval(`shiftDateLocal(new Date(2026,0,1), 10)`), '2026-01-11');
    assert.strictEqual(app.eval(`shiftDateLocal('garbage', 1)`), '');
    assert.strictEqual(app.eval(`shiftDateLocal(null, 1)`), '');
  });

  test('_autoTaskDaysFromToday() agrees with the local calendar', () => {
    assert.strictEqual(app.eval(`_autoTaskDaysFromToday(0)`), app.eval(`todayStr()`));
    assert.strictEqual(app.eval(`_autoTaskDaysFromToday(1)`), app.eval(`shiftDateLocal(new Date(),1)`));
    assert.strictEqual(app.eval(`_autoTaskDaysFromToday(-7)`), app.eval(`shiftDateLocal(new Date(),-7)`));
  });

  test('a 6-month finance trend bucket now matches records dated in the current month', async () => {
    // This is the end-to-end shape of the bug: build the same month keys the
    // dashboard/finance/reports pages build, then filter real records the
    // same way. Before the fix, current-month records matched NO bucket.
    const today = app.eval(`todayStr()`);
    const matched = app.eval(`(function(){
      var rec=[{date:${JSON.stringify(today)}, type:'income', amount:100}];
      var hit=0;
      for(var i=5;i>=0;i--){ var k=toLocalMonthKey(monthStartLocal(-i)); if((rec[0].date||'').startsWith(k)) hit++; }
      return hit;
    })()`);
    assert.strictEqual(matched, 1, "today's record must fall in the current month's bucket");
    const matchedOldWay = app.eval(`(function(){
      var rec=[{date:${JSON.stringify(today)}}];
      var hit=0;
      for(var i=5;i>=0;i--){ var d=new Date(new Date().getFullYear(), new Date().getMonth()-i, 1);
        if((rec[0].date||'').startsWith(d.toISOString().slice(0,7))) hit++; }
      return hit;
    })()`);
    assert.strictEqual(matchedOldWay, 0, 'the old UTC keys dropped the current month entirely');
  });

  test('forecastTaskWorkload() no longer shadows the global todayStr()', async () => {
    // The function used to declare `var todayStr = <utc string>` inside its
    // own scope, shadowing the global helper for the whole function body.
    const raw = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'shared.js'), 'utf8');
    const src = raw.split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n'); // ignore prose in comments
    assert.ok(!/(var|let|const)\s+todayStr\s*=/.test(src), 'no local variable may shadow the global todayStr()');
    const out = await app.eval(`(async()=>await forecastTaskWorkload(7))()`);
    assert.strictEqual(out.windowDays, 7);
    assert.strictEqual(typeof out.totalExpectedWorkload, 'number');
  });
});
