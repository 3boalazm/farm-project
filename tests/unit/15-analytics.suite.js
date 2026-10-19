// Module 15 — Farm Analytics engine (bucketByPeriod, computeFarmAnalytics,
// generateAnalyticsInsights)
const { bootApp, suite, assert, J } = require('./harness');

module.exports = suite('15 · Analytics engine', ({ test }) => {
  let app, db;
  const reset = (over = {}) => { db.reset(Object.assign({ users: db.data.users }, over)); app.eval(`fbCacheInvalidate()`); };
  const thisMonth = () => app.eval(`toLocalMonthKey(new Date())`) + '-15';
  const lastMonth = () => app.eval(`toLocalMonthKey(monthStartLocal(-1))`) + '-10';

  test('boots', async () => { app = await bootApp(); db = app.db; });

  test('bucketByPeriod() creates exactly periodCount chronological month buckets', () => {
    const b = J(app.eval(`bucketByPeriod([], 'date', 'month', 6)`));
    assert.strictEqual(b.length, 6);
    b.forEach((x) => assert.deepStrictEqual(J(x.records), []));
    const starts = b.map((x) => new Date(x.start).getTime());
    assert.deepStrictEqual(starts, [...starts].sort((a, c) => a - c), 'oldest first');
  });

  test('bucketByPeriod() places a record in its own LOCAL month (the UTC bug class)', () => {
    const key = app.eval(`toLocalMonthKey(new Date())`);
    const dateStr = `${key}-01`; // the 1st of the current month, the exact case the UTC key missed
    const out = app.eval(`(function(){
      var b=bucketByPeriod([{date:${JSON.stringify(dateStr)}}],'date','month',6);
      return b[b.length-1].records.length + '|' + b.map(function(x){return x.records.length;}).join(',');
    })()`);
    assert.strictEqual(out.split('|')[0], '1', 'a record dated the 1st of this month lands in the last bucket');
    assert.strictEqual(out.split('|')[1], '0,0,0,0,0,1');
  });

  test('bucketByPeriod() supports week/quarter/year granularities and ignores junk dates', () => {
    for (const g of ['week', 'quarter', 'year']) {
      const b = J(app.eval(`bucketByPeriod([{date:'not-a-date'},{date:null},{}], 'date', ${JSON.stringify(g)}, 4)`));
      assert.strictEqual(b.length, 4, g);
      assert.strictEqual(b.reduce((s, x) => s + x.records.length, 0), 0, `${g}: junk dates are dropped, not bucketed`);
      b.forEach((x) => assert.ok(x.label, `${g}: every bucket has a label`));
    }
  });

  test('bucketByPeriod() honours a custom date field and an empty/absent record list', () => {
    const b = J(app.eval(`bucketByPeriod([{actual_birth:${JSON.stringify(thisMonth())}}], 'actual_birth', 'month', 3)`));
    assert.strictEqual(b[2].records.length, 1);
    assert.strictEqual(J(app.eval(`bucketByPeriod(null,'date','month',3)`)).length, 3);
    assert.strictEqual(J(app.eval(`bucketByPeriod(undefined,'date','month',2)`)).length, 2);
  });

  test('computeFarmAnalytics() returns all five categories over real records', async () => {
    reset({
      animals: { a1: { tag: 'GT-1', species: 'goat', status: 'dead', died_at: thisMonth() }, a2: { tag: 'GT-2', status: 'alive' } },
      health: { h1: { animal_tag: 'GT-2', status: 'active', date: thisMonth() }, h2: { animal_tag: 'GT-2', status: 'cured', date: lastMonth() } },
      vaccinations: { v1: { name: 'حمى', status: 'done', done_date: thisMonth() }, v2: { name: 'x', status: 'pending' } },
      production_log: { p1: { type: 'milk', quantity: 12, date: thisMonth() }, p2: { type: 'milk', quantity: 8, date: lastMonth() }, p3: { type: 'wool', quantity: 3, date: thisMonth() } },
      weight_alerts: { w1: { animal_id: 'a2', status: 'active', detected_at: new Date().toISOString() } },
      production_alerts: {},
      daily_tasks: { t1: { title: 'x', status: 'done', created_at: new Date().toISOString(), completed_at: new Date().toISOString(), auto_generated: true } },
      breeding: { b1: { status: 'born', actual_birth: thisMonth(), offspring_count: 2 } },
    });
    const a = J(await app.eval(`(async()=>await computeFarmAnalytics('month',6))()`));
    assert.ok(a, 'analytics computed');
    ['productivityIndex', 'herdHealthTrend', 'productionTrend', 'operationalEfficiency', 'riskTrend'].forEach((k) => {
      assert.ok(Array.isArray(a[k]), `${k} is an array`);
      assert.strictEqual(a[k].length, 6, `${k} has one entry per period`);
    });
    assert.strictEqual(a.granularity, 'month');
    assert.strictEqual(a.periodCount, 6);
    const lastProd = a.productionTrend[5];
    assert.strictEqual(lastProd.milkTotal, 12, 'this month’s milk, from the real log');
    assert.strictEqual(lastProd.woolTotal, 3);
    assert.strictEqual(lastProd.births, 2);
    assert.strictEqual(lastProd.deaths, 1);
    assert.strictEqual(a.riskTrend.reduce((s, x) => s + x.weightAlerts, 0), 1);
    assert.strictEqual(a.highestRiskPeriod && a.highestRiskPeriod.weightAlerts, 1);
    // No NaN anywhere in a computed report.
    const flat = JSON.stringify(a);
    assert.ok(!/NaN|Infinity/.test(flat), 'a report must never contain NaN/Infinity: ' + flat.slice(0, 200));
  });

  test('computeFarmAnalytics() on an empty farm returns zeros and nulls, never NaN', async () => {
    reset({});
    const a = J(await app.eval(`(async()=>await computeFarmAnalytics('month',3))()`));
    assert.ok(a);
    assert.strictEqual(a.highestRiskPeriod, null, 'no alerts → no "highest risk period" invented');
    a.productivityIndex.forEach((p) => assert.ok(Number.isFinite(p.index) && p.index >= 0 && p.index <= 100));
    a.productionTrend.forEach((p) => assert.ok(Number.isFinite(p.milkTotal)));
    a.operationalEfficiency.forEach((o) => assert.ok(o.completionRate === null || Number.isFinite(o.completionRate)));
    assert.ok(!/NaN/.test(JSON.stringify(a)));
  });

  test('generateAnalyticsInsights() only ever emits a sentence backed by its own evidence string', async () => {
    reset({
      production_log: { p1: { type: 'milk', quantity: 100, date: lastMonth() }, p2: { type: 'milk', quantity: 200, date: thisMonth() } },
      health: { h1: { status: 'cured', date: lastMonth() }, h2: { status: 'active', date: thisMonth() } },
      daily_tasks: {}, vaccinations: {}, animals: {}, breeding: {}, weight_alerts: {}, production_alerts: {},
    });
    const a = await app.eval(`(async()=>await computeFarmAnalytics('month',6))()`);
    const insights = J(await app.eval(`generateAnalyticsInsights(${JSON.stringify(J(a))})`));
    assert.ok(Array.isArray(insights));
    insights.forEach((i) => {
      assert.ok(i.text && i.text.length > 5, 'every insight has a sentence');
      assert.ok(i.evidence && i.evidence.length, 'every insight carries its evidence: ' + JSON.stringify(i));
      assert.match(i.text, /[٠-٩]/, 'the numbers appear in the sentence itself');
    });
    assert.ok(insights.some((i) => /الحليب/.test(i.text)), 'the doubled milk production is reported');
    assert.deepStrictEqual(J(app.eval(`generateAnalyticsInsights(null)`)), []);
  });

  test('generateAnalyticsInsights() stays silent when there is nothing to compare', async () => {
    reset({});
    const a = J(await app.eval(`(async()=>await computeFarmAnalytics('month',6))()`));
    const insights = J(app.eval(`generateAnalyticsInsights(${JSON.stringify(a)})`));
    assert.deepStrictEqual(insights.filter((i) => /تراجع|تحسّن/.test(i.text)), [], 'no trend sentence without two real periods');
  });

  test('analytics is strictly READ-ONLY: it writes nothing to any collection', async () => {
    reset({ production_log: { p1: { type: 'milk', quantity: 5, date: thisMonth() } } });
    const before = JSON.stringify(db.data);
    await app.eval(`(async()=>{ await computeFarmAnalytics('month',6); await computeFarmAnalytics('week',4); })()`);
    // Exclude the anonymous Firebase Auth sign-in (v1/accounts:signUp,
    // securetoken) which firebase.js performs on its own behalf — that is
    // not a data write to any collection.
    const writes = db.log.filter((c) => c.method !== 'GET' && !/accounts:signUp|securetoken/.test(c.parts));
    assert.deepStrictEqual(J(writes), [], 'analytics must never write to a collection');
    assert.strictEqual(JSON.stringify(db.data), before);
  });
});
