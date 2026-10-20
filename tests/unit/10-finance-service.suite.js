// Module 10 — Finance Service (the simple `finance` collection) + KPIs
const { bootApp, suite, assert, J } = require('./harness');

module.exports = suite('10 · Finance service & KPIs', ({ test }) => {
  let app, db;
  const reset = (over = {}) => { db.reset(Object.assign({ users: db.data.users, finance: {} }, over)); app.eval(`fbCacheInvalidate()`); };
  const rows = () => J(Object.values(db.data.finance || {}));

  test('boots', async () => { app = await bootApp(); db = app.db; });

  test('recordIncome() writes a complete, typed transaction', async () => {
    reset();
    const r = J(await app.eval(`(async()=>await recordIncome({amount:1200.5,category:'بيع ألبان',date:'2026-05-04',description:'حليب مايو',barn:'ج١ع١'}))()`));
    assert.strictEqual(r.ok, true, JSON.stringify(r));
    const f = rows()[0];
    assert.strictEqual(f.type, 'income');
    assert.strictEqual(f.amount, 1200.5);
    assert.strictEqual(f.category, 'بيع ألبان');
    assert.strictEqual(f.date, '2026-05-04');
    assert.strictEqual(f.barn, 'ج١ع١');
    assert.strictEqual(f.operator, 'مدير المزرعة', 'the acting user is stamped');
    assert.ok(f.created_at);
  });

  test('recordExpense()/recordLoss()/manualEntry() set their own type and module', async () => {
    reset();
    await app.eval(`(async()=>await recordExpense({amount:50,category:'أعلاف ومواد تغذية'}))()`);
    await app.eval(`(async()=>await recordLoss({amount:75,category:'نفوق',reason:'مرض'}))()`);
    await app.eval(`(async()=>await manualEntry({type:'income',amount:10,category:'إيراد آخر'}))()`);
    const f = rows();
    assert.deepStrictEqual(f.map((r) => r.type).sort(), ['expense', 'income', 'loss']);
    assert.strictEqual(f.find((r) => r.type === 'loss').reason, 'مرض');
    assert.strictEqual(f.find((r) => r.related_module === 'manual').type, 'income');
  });

  test('every writer rejects a non-positive or non-numeric amount', async () => {
    reset();
    for (const amount of [0, -10, 'abc', null, NaN]) {
      const r = J(await app.eval(`(async()=>await recordIncome({amount:${amount === undefined ? 'undefined' : JSON.stringify(amount) ?? 'NaN'},category:'x'}))()`));
      assert.strictEqual(r.ok, false, `amount ${amount}`);
      assert.match(r.error, /مبلغ صحيح/);
    }
    assert.deepStrictEqual(rows(), [], 'nothing written');
  });

  test('an invalid transaction type is rejected', async () => {
    reset();
    const r = J(await app.eval(`(async()=>await _writeFinanceTransaction({type:'transfer',amount:10}))()`));
    assert.strictEqual(r.ok, false);
    assert.match(r.error, /نوع معاملة غير صالح/);
  });

  test('a role without finance permission cannot write (worker/vet/visitor)', async () => {
    reset();
    for (const role of ['worker', 'vet', 'visitor', 'supervisor']) {
      app.eval(`setUser({id:'u1',role:${JSON.stringify(role)},name:'x'})`);
      const r = J(await app.eval(`(async()=>await recordIncome({amount:10,category:'x'}))()`));
      assert.strictEqual(r.ok, false, role);
      assert.match(r.error, /صلاحية/);
    }
    assert.deepStrictEqual(rows(), []);
    app.eval(`setUser({id:'admin1',role:'admin',name:'مدير المزرعة'})`);
  });

  test('cross-domain helpers tag their module and related entity, and never touch animals/inventory', async () => {
    reset({ animals: { a1: { tag: 'GT-1', status: 'alive' } }, inventory_feeds: { f1: { name: 'علف', quantity: 100 } } });
    await app.eval(`(async()=>await animalSale({amount:5000,animalId:'a1',date:'2026-05-01'}))()`);
    await app.eval(`(async()=>await feedPurchase({amount:800,itemName:'علف',date:'2026-05-02'}))()`);
    await app.eval(`(async()=>await medicinePurchase({amount:120,itemName:'دواء'}))()`);
    const f = rows();
    const sale = f.find((r) => r.category === 'بيع');
    assert.strictEqual(sale.related_animal, 'a1');
    assert.strictEqual(sale.related_module, 'animals');
    assert.strictEqual(sale.type, 'income');
    const feed = f.find((r) => r.category === 'أعلاف ومواد تغذية');
    assert.strictEqual(feed.related_inventory_item, 'علف');
    assert.strictEqual(feed.related_module, 'inventory');
    assert.strictEqual(feed.type, 'expense');
    assert.strictEqual(db.data.animals.a1.status, 'alive', 'a financial record must never change an animal');
    assert.strictEqual(db.data.inventory_feeds.f1.quantity, 100, 'nor inventory');
  });

  test('refund() links back to the original reference', async () => {
    reset();
    await app.eval(`(async()=>await refund({amount:300,originalReference:'INV-1',category:'استرجاع'}))()`);
    assert.strictEqual(rows()[0].reference, 'INV-1');
    assert.strictEqual(rows()[0].type, 'expense');
  });

  test('computeFinanceKPIs() totals income/expense/net over a date range only', async () => {
    const d = (date, type, amount) => ({ date, type, amount, category: 'x' });
    reset({
      finance: {
        r1: d('2026-05-01', 'income', 1000), r2: d('2026-05-20', 'expense', 300),
        r3: d('2026-06-01', 'income', 999), r4: d('2026-04-01', 'income', 555),
      },
    });
    const k = J(await app.eval(`(async()=>await computeFinanceKPIs('2026-05-01','2026-05-31'))()`));
    assert.strictEqual(k.revenue, 1000, 'only May income counts');
    assert.strictEqual(k.expenses, 300);
    assert.strictEqual(k.netProfit, 700);
    assert.strictEqual(k.profitMargin, 0.7);
    assert.strictEqual(k.recordCount, 2, 'the two out-of-range records are excluded');
    assert.deepStrictEqual(J(k.categoryBreakdown), { x: 300 });
  });

  test('computeFinanceKPIs() with no dates is open-ended (both bounds optional)', async () => {
    reset({ finance: { r1: { date: '2020-01-01', type: 'income', amount: 5, category: 'x' } } });
    const k = J(await app.eval(`(async()=>await computeFinanceKPIs())()`));
    assert.strictEqual(k.revenue, 5);
    assert.strictEqual(k.recordCount, 1);
  });

  test('computeFinanceKPIs() returns nulls (never Infinity/NaN) on an empty ledger', async () => {
    reset({ finance: {}, animals: {} });
    const k = J(await app.eval(`(async()=>await computeFinanceKPIs('2026-01-01','2026-12-31'))()`));
    assert.strictEqual(k.revenue, 0);
    assert.strictEqual(k.expenses, 0);
    assert.strictEqual(k.netProfit, 0);
    assert.strictEqual(k.profitMargin, null, 'no revenue → no margin, not a division by zero');
    assert.strictEqual(k.roi, null);
    assert.strictEqual(k.avgCostPerAnimal, null, 'no live animals → no per-head figure invented');
    for (const [key, v] of Object.entries(k)) {
      if (typeof v === 'number') assert.ok(Number.isFinite(v), `${key} is not finite: ${v}`);
    }
  });

  test('computeFinanceKPIs() spreads costs per head over LIVE animals only', async () => {
    reset({
      finance: { r1: { date: '2026-05-01', type: 'expense', amount: 1000, category: 'أعلاف ومواد تغذية' } },
      animals: { a1: { status: 'alive' }, a2: { status: 'alive' }, a3: { status: 'dead' }, a4: { status: 'sold' } },
    });
    const k = J(await app.eval(`(async()=>await computeFinanceKPIs('2026-05-01','2026-05-31'))()`));
    assert.strictEqual(k.avgCostPerAnimal, 500, '1000 over the 2 living animals');
    assert.ok(k.feedCostPct > 0.99, 'the feed category is recognised');
  });

  test('computeFinanceTrend() returns one bucket per requested period', async () => {
    reset({ finance: { r1: { date: app.eval(`todayStr()`), type: 'income', amount: 10, category: 'x' } } });
    const t = J(await app.eval(`(async()=>await computeFinanceTrend('month',6))()`));
    assert.ok(Array.isArray(t), 'the trend is a plain array of period buckets');
    assert.strictEqual(t.length, 6);
    t.forEach((b) => {
      assert.ok(b.label && typeof b.revenue === 'number' && typeof b.expenses === 'number');
      assert.strictEqual(b.profit, Math.round((b.revenue - b.expenses) * 100) / 100);
    });
    const totalRevenue = t.reduce((s, b) => s + b.revenue, 0);
    assert.strictEqual(totalRevenue, 10, "today's record lands in the current month's bucket");
  });

  test('O-06 CLOSED: a "loss" record counts as an expense in the P&L, and stays separately visible', async () => {
    // This test used to pin the opposite: type:'loss' was excluded from the
    // buckets, so computeFinanceKPIs() reported a farm that had written off
    // 4,000 EGP of dead stock as breaking even. A loss is money out; it now
    // lands in `expenses` (and therefore netProfit, roi, margin and
    // avgCostPerAnimal) while `losses` keeps it visible on its own line.
    // Dated inside the CURRENT month: computeFinanceTrend() buckets the last N
    // periods from today, so a hardcoded 2026-05 fixture would fall outside
    // every bucket it returns (and would start silently passing for the wrong
    // reason once the calendar moved on).
    const today = app.eval(`todayStr()`);
    const from = today.slice(0, 8) + '01', to = today.slice(0, 8) + '28';
    reset({ finance: {
      l1: { date: today.slice(0, 8) + '02', type: 'loss', amount: 4000, category: 'نفوق' },
      e1: { date: today.slice(0, 8) + '03', type: 'expense', amount: 1000, category: 'أعلاف ومواد تغذية' },
      i1: { date: today.slice(0, 8) + '04', type: 'income', amount: 9000, category: 'بيع حيوانات' },
    } });
    const k = J(await app.eval(`(async()=>await computeFinanceKPIs(${JSON.stringify(from)},${JSON.stringify(to)}))()`));
    assert.strictEqual(k.revenue, 9000);
    assert.strictEqual(k.operatingExpenses, 1000, 'operating expenses are still reported on their own');
    assert.strictEqual(k.losses, 4000, 'and so are the write-offs');
    assert.strictEqual(k.lossCount, 1);
    assert.strictEqual(k.expenses, 5000, 'a loss is money out: it belongs in the expense total');
    assert.strictEqual(k.netProfit, 4000, 'profit may no longer ignore what the farm lost');
    assert.strictEqual(k.recordCount, 3);

    const trend = J(await app.eval(`(async()=>await computeFinanceTrend('month',3))()`));
    const month = trend[trend.length - 1];      // the current month is always last
    assert.ok(month, 'the trend returns buckets: ' + JSON.stringify(trend));
    assert.strictEqual(month.expenses, 5000, 'the chart and the KPI row cannot disagree about the same month');
    assert.strictEqual(month.losses, 4000);
    assert.strictEqual(month.profit, 4000);
  });
});
