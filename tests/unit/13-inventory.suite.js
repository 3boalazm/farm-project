// Module 13 — Inventory: transaction ledger + named operations + the
// inventory accounting layer (weighted-average cost, purchase/consumption).
const { bootApp, suite, assert, J } = require('./harness');

const CASH = '1110', AP = '2100', FEED_INV = '1410', MED_INV = '1420', FEED_EXP = '6100';

module.exports = suite('13 · Inventory ledger & costing', ({ test }) => {
  let app, db;
  const reset = async (over = {}) => {
    db.reset(Object.assign({
      users: db.data.users,
      inventory_feeds: { f1: { name: 'علف مركز', quantity: 100, cost_per_unit: 5, unit: 'شيكارة', min_quantity: 20 } },
      inventory_meds: { m1: { name: 'مضاد حيوي', quantity: 10, cost_per_unit: 30, min_quantity: 2 } },
      finance: {},
    }, over));
    app.eval(`fbCacheInvalidate()`);
  };
  const seedChart = async () => { await app.eval(`(async()=>await seedDefaultChartOfAccounts())()`); app.eval(`fbCacheInvalidate()`); };
  const feedQty = () => db.data.inventory_feeds.f1.quantity;
  const txns = () => J(db.collection('inventory_transactions'));

  test('boots', async () => { app = await bootApp(); db = app.db; });

  test('recordInventoryTransaction() moves stock and writes a full audit row', async () => {
    await reset();
    const r = J(await app.eval(`(async()=>await recordInventoryTransaction('feeds','علف مركز',25,'purchase','src-1'))()`));
    assert.strictEqual(r.matched, true);
    assert.strictEqual(r.before, 100);
    assert.strictEqual(r.after, 125);
    assert.strictEqual(r.actualDelta, 25);
    assert.strictEqual(r.clamped, false);
    assert.strictEqual(feedQty(), 125);
    const t = txns()[0];
    assert.strictEqual(t.item_name, 'علف مركز');
    assert.strictEqual(t.requested_delta, 25);
    assert.strictEqual(t.quantity_before, 100);
    assert.strictEqual(t.quantity_after, 125);
    assert.strictEqual(t.reason, 'purchase');
    assert.strictEqual(t.source_id, 'src-1');
    assert.strictEqual(t.actor, 'مدير المزرعة');
    assert.strictEqual(db.data.inventory_feeds.f1.last_purchase, app.eval(`todayStr()`), 'a purchase stamps last_purchase');
  });

  test('stock can never go negative: the move is clamped and the clamp is REPORTED', async () => {
    await reset();
    const r = J(await app.eval(`(async()=>await recordInventoryTransaction('feeds','علف مركز',-999,'feeding'))()`));
    assert.strictEqual(r.after, 0);
    assert.strictEqual(r.actualDelta, -100, 'only what was really there moved');
    assert.strictEqual(r.clamped, true);
    assert.strictEqual(feedQty(), 0);
    const t = txns()[0];
    assert.strictEqual(t.requested_delta, -999, 'the request is recorded as asked...');
    assert.strictEqual(t.actual_delta, -100, '...and what actually happened alongside it');
  });

  test('an unknown item is a structured non-match, not an error and not a silent write', async () => {
    await reset();
    const r = J(await app.eval(`(async()=>await recordInventoryTransaction('feeds','علف غير موجود',5,'purchase'))()`));
    assert.strictEqual(r.matched, false);
    assert.strictEqual(r.itemName, 'علف غير موجود');
    assert.deepStrictEqual(txns(), []);
  });

  test('an invalid item type or a zero delta returns null and writes nothing', async () => {
    await reset();
    assert.strictEqual(await app.eval(`(async()=>await recordInventoryTransaction('widgets','x',5,'purchase'))()`), null);
    assert.strictEqual(await app.eval(`(async()=>await recordInventoryTransaction('feeds','علف مركز',0,'purchase'))()`), null);
    assert.strictEqual(await app.eval(`(async()=>await recordInventoryTransaction('feeds','',5,'purchase'))()`), null);
    assert.deepStrictEqual(txns(), []);
  });

  test('purchaseFeed()/consumeFeed() are thin, symmetric wrappers over the ledger', async () => {
    await reset({ finance: {} });
    const p = J(await app.eval(`(async()=>await purchaseFeed({itemName:'علف مركز',quantity:10,totalCost:120,date:'2026-05-01'}))()`));
    assert.strictEqual(p.ok, true, JSON.stringify(p));
    assert.strictEqual(p.after, 110);
    const c = J(await app.eval(`(async()=>await consumeFeed({itemName:'علف مركز',quantity:30,reason:'feeding'}))()`));
    assert.strictEqual(c.ok, true);
    assert.strictEqual(c.after, 80);
    const fin = J(db.collection('finance'));
    assert.strictEqual(fin.length, 1, 'the purchase records its cost, consumption does not double-charge');
    assert.strictEqual(fin[0].amount, 120);
    assert.strictEqual(fin[0].related_inventory_item, 'علف مركز');
    assert.strictEqual(txns().length, 2);
  });

  test('a negative quantity passed to consume/purchase is normalised, never double-negative', async () => {
    await reset();
    const p = J(await app.eval(`(async()=>await purchaseFeed({itemName:'علف مركز',quantity:-15}))()`));
    assert.strictEqual(p.after, 115, 'purchase always adds');
    const c = J(await app.eval(`(async()=>await consumeFeed({itemName:'علف مركز',quantity:-40}))()`));
    assert.strictEqual(c.after, 75, 'consumption always subtracts');
  });

  test('inventoryCorrection() targets a TRUE quantity, computing the delta itself', async () => {
    await reset();
    const up = J(await app.eval(`(async()=>await inventoryCorrection({itemType:'feeds',itemName:'علف مركز',newQuantity:130}))()`));
    assert.strictEqual(up.ok, true);
    assert.strictEqual(up.before, 100);
    assert.strictEqual(up.after, 130);
    assert.strictEqual(txns()[0].reason, 'correction');
    const same = J(await app.eval(`(async()=>await inventoryCorrection({itemType:'feeds',itemName:'علف مركز',newQuantity:130}))()`));
    assert.strictEqual(same.unchanged, true, 'a no-op correction writes no ledger row');
    assert.strictEqual(txns().length, 1);
    const down = J(await app.eval(`(async()=>await inventoryCorrection({itemType:'feeds',itemName:'علف مركز',newQuantity:12}))()`));
    assert.strictEqual(down.after, 12);
  });

  test('expireStock()/returnStock()/stockAdjustment() keep their own reason codes', async () => {
    await reset();
    await app.eval(`(async()=>await expireStock({itemType:'meds',itemName:'مضاد حيوي',quantity:2}))()`);
    await app.eval(`(async()=>await returnStock({itemType:'meds',itemName:'مضاد حيوي',quantity:1}))()`);
    await app.eval(`(async()=>await stockAdjustment({itemType:'meds',itemName:'مضاد حيوي',deltaQty:-3}))()`);
    assert.deepStrictEqual(txns().map((t) => t.reason), ['expiry', 'return', 'adjustment']);
    assert.strictEqual(db.data.inventory_meds.m1.quantity, 6, '10 -2 +1 -3');
  });

  test('transferStock() moves the storage location only — this model has no per-location quantities', async () => {
    await reset();
    const r = J(await app.eval(`(async()=>await transferStock({itemType:'feeds',itemName:'علف مركز',toBarn:'ج٢ع١'}))()`));
    assert.strictEqual(r.ok, true);
    assert.strictEqual(db.data.inventory_feeds.f1.barn, 'ج٢ع١');
    assert.strictEqual(feedQty(), 100, 'the quantity is untouched by a location move');
    assert.deepStrictEqual(txns(), [], 'and it is not a ledger transaction');
  });

  test('initialStock() creates the item at zero then establishes the opening quantity through the ledger', async () => {
    await reset();
    const r = J(await app.eval(`(async()=>await initialStock({itemType:'feeds',name:'نخالة',quantity:40,fields:{unit:'كجم',min_quantity:5}}))()`));
    assert.strictEqual(r.ok, true, JSON.stringify(r));
    const created = J(db.collection('inventory_feeds')).find((i) => i.name === 'نخالة');
    assert.strictEqual(created.quantity, 40);
    assert.strictEqual(created.unit, 'كجم');
    assert.strictEqual(txns().filter((t) => t.reason === 'initial').length, 1, 'the opening quantity is a real ledger entry');
    const zero = J(await app.eval(`(async()=>await initialStock({itemType:'feeds',name:'فارغ',quantity:0}))()`));
    assert.strictEqual(zero.ok, true);
    assert.strictEqual(txns().filter((t) => t.item_name === 'فارغ').length, 0, 'no movement for a zero opening');
  });

  test('bulkImportInventory() reports per-item success/failure counts', async () => {
    await reset();
    const r = J(await app.eval(`(async()=>await bulkImportInventory({itemType:'meds',items:[{name:'دواء أ',quantity:5},{name:'دواء ب',quantity:0},{name:'',quantity:3}]}))()`));
    assert.strictEqual(r.succeeded, 2);
    assert.strictEqual(r.failed, 1);
    assert.strictEqual(r.ok, false, 'ok is only true when nothing failed');
  });

  test('_weightedAverageCost() is the real weighted average, and falls back sanely at/below zero stock', () => {
    assert.strictEqual(app.eval(`_weightedAverageCost(100,5,100,7)`), 6);
    assert.strictEqual(app.eval(`_weightedAverageCost(0,0,50,8)`), 8);
    assert.strictEqual(app.eval(`_weightedAverageCost(-10,5,10,4)`), 4, 'negative stock → the new cost is the only evidence');
    assert.strictEqual(app.eval(`_weightedAverageCost(3,10,1,20)`), 12.5);
  });

  test('postInventoryPurchase() debits inventory at cost, credits AP on credit terms, and updates the average cost', async () => {
    await reset(); await seedChart();
    const sup = J(await app.eval(`(async()=>await createSupplier({name:'مورد أعلاف'}))()`));
    const r = J(await app.eval(`(async()=>await postInventoryPurchase({operationId:'ip-1',itemType:'feeds',itemName:'علف مركز',quantity:100,unitCost:8,paymentMode:'credit',supplierId:${JSON.stringify(sup.id)},supplierName:'مورد أعلاف',date:'2026-05-01',dueDate:'2026-06-01'}))()`));
    assert.strictEqual(r.ok, true, JSON.stringify(r));
    assert.strictEqual(feedQty(), 200);
    assert.strictEqual(r.newAvgCost, 6.5, '(100×5 + 100×8) / 200');
    assert.strictEqual(db.data.inventory_feeds.f1.cost_per_unit, 6.5);
    const e = J(db.collection('journal_entries'))[0];
    assert.ok(e.lines.some((l) => l.accountId === FEED_INV && l.debit === 800));
    assert.ok(e.lines.some((l) => l.accountId === AP && l.credit === 800));
    const ap = J(await app.eval(`(async()=>await getSupplierBalance(${JSON.stringify(sup.id)}))()`));
    assert.strictEqual(ap.balance, 800, 'a real open payable is left behind');
  });

  test('postInventoryPurchase() in cash mode settles in the SAME posting (no phantom payable)', async () => {
    await reset(); await seedChart();
    const r = J(await app.eval(`(async()=>await postInventoryPurchase({operationId:'ip-2',itemType:'feeds',itemName:'علف مركز',quantity:50,unitCost:10,paymentMode:'cash',cashAccountId:${JSON.stringify(CASH)},date:'2026-05-01'}))()`));
    assert.strictEqual(r.ok, true, JSON.stringify(r));
    const doc = J(db.collection('source_documents'))[0];
    assert.strictEqual(doc.status, 'PAID');
    assert.strictEqual(doc.remainingAmount, 0);
    const e = J(db.collection('journal_entries'))[0];
    assert.ok(e.lines.some((l) => l.accountId === CASH && l.credit === 500));
    assert.ok(!e.lines.some((l) => l.accountId === AP), 'no AP leg at all for a cash purchase');
  });

  test('postInventoryPurchase() replays are idempotent and move no stock twice', async () => {
    await reset(); await seedChart();
    const call = `(async()=>await postInventoryPurchase({operationId:'ip-3',itemType:'feeds',itemName:'علف مركز',quantity:10,unitCost:6,paymentMode:'cash',cashAccountId:${JSON.stringify(CASH)}}))()`;
    const a = J(await app.eval(call));
    const qtyAfterFirst = feedQty();
    const b = J(await app.eval(call));
    assert.strictEqual(b.idempotent, true);
    assert.strictEqual(feedQty(), qtyAfterFirst, 'a replay must not move stock a second time');
  });

  test('postInventoryPurchase() validates type, quantity, unit cost and payment mode before touching stock', async () => {
    await reset(); await seedChart();
    assert.strictEqual((J(await app.eval(`(async()=>await postInventoryPurchase({operationId:'x0',itemType:'feeds',itemName:'علف مركز',quantity:10,unitCost:5,paymentMode:'wire'}))()`))).ok, false, 'payment mode must be cash or credit');
    assert.strictEqual((J(await app.eval(`(async()=>await postInventoryPurchase({itemType:'feeds',itemName:'علف مركز',quantity:10,unitCost:5,paymentMode:'cash',cashAccountId:${JSON.stringify(CASH)}}))()`))).ok, false, 'operationId is mandatory');
    const base = `itemType:'feeds',itemName:'علف مركز',quantity:10,unitCost:5,paymentMode:'cash',cashAccountId:${JSON.stringify(CASH)}`;
    assert.strictEqual((J(await app.eval(`(async()=>await postInventoryPurchase({operationId:'x1',itemType:'steel',itemName:'علف مركز',quantity:10,unitCost:5,paymentMode:'cash',cashAccountId:${JSON.stringify(CASH)}}))()`))).ok, false);
    assert.strictEqual((J(await app.eval(`(async()=>await postInventoryPurchase({operationId:'x2',${base.replace('quantity:10', 'quantity:0')}}))()`))).ok, false);
    assert.strictEqual((J(await app.eval(`(async()=>await postInventoryPurchase({operationId:'x3',${base.replace('unitCost:5', 'unitCost:-1')}}))()`))).ok, false);
    assert.strictEqual((J(await app.eval(`(async()=>await postInventoryPurchase({operationId:'x4',itemType:'feeds',itemName:'علف مركز',quantity:10,unitCost:5,paymentMode:'cash'}))()`))).ok, false, 'cash mode needs a cash account');
    assert.strictEqual((J(await app.eval(`(async()=>await postInventoryPurchase({operationId:'x5',itemType:'feeds',itemName:'علف غير موجود',quantity:10,unitCost:5,paymentMode:'credit'}))()`))).ok, false);
    assert.strictEqual(feedQty(), 100, 'no rejected call moved any stock');
  });

  test('a purchase whose stock move fails voids its own draft document instead of leaving a phantom bill', async () => {
    await reset(); await seedChart();
    const r = J(await app.eval(`(async()=>await postInventoryPurchase({operationId:'ip-9',itemType:'feeds',itemName:'صنف غير موجود',quantity:10,unitCost:5,paymentMode:'credit'}))()`));
    assert.strictEqual(r.ok, false);
    const doc = J(db.collection('source_documents'))[0];
    assert.strictEqual(doc.status, 'VOID', 'the draft is voided, not left looking like a real pending purchase');
    assert.deepStrictEqual(J(db.collection('journal_entries')), []);
  });

  test('postInventoryConsumption() expenses the item at its CURRENT weighted-average cost', async () => {
    await reset(); await seedChart();
    const r = J(await app.eval(`(async()=>await postInventoryConsumption({operationId:'ic-1',itemType:'feeds',itemName:'علف مركز',quantity:20,reason:'feeding'}))()`));
    assert.strictEqual(r.ok, true, JSON.stringify(r));
    assert.strictEqual(feedQty(), 80);
    const e = J(db.collection('journal_entries'))[0];
    assert.ok(e.lines.some((l) => l.accountId === FEED_EXP && l.debit === 100), '20 × 5 = 100 expensed');
    assert.ok(e.lines.some((l) => l.accountId === FEED_INV && l.credit === 100));
    const replay = J(await app.eval(`(async()=>await postInventoryConsumption({operationId:'ic-1',itemType:'feeds',itemName:'علف مركز',quantity:20,reason:'feeding'}))()`));
    assert.strictEqual(replay.idempotent, true);
    assert.strictEqual(feedQty(), 80, 'the replay moved nothing');
  });

  test('inventory writes require the inventory permission at the item-creation entry point', async () => {
    await reset();
    app.eval(`setUser({id:'v1',role:'visitor',name:'زائر'})`);
    assert.strictEqual((J(await app.eval(`(async()=>await initialStock({itemType:'feeds',name:'x',quantity:1}))()`))).ok, false);
    app.eval(`setUser({id:'admin1',role:'admin',name:'مدير المزرعة'})`);
  });
});
