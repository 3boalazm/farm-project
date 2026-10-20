// tests/data-integrity/inventory-accounting.spec.js
// Phase 6: regression protection for Inventory Accounting
// (window.postInventoryPurchase / postInventoryConsumption /
// postInventoryAdjustment). Wraps the EXISTING recordInventoryTransaction
// / inventoryCorrection engine (v1.7, pre-dates the accounting rebuild)
// -- stock-quantity behavior itself is not re-tested here, only that
// this phase calls it correctly and posts the right financial entries
// alongside it.

const { test, expect } = require('../fixtures/farm-test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

async function setupInvAcctMocks(page, overrides = {}) {
  await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
  await page.goto(`${BASE_URL}/dashboard.html`);
  await page.waitForTimeout(600);
  await page.evaluate((ov) => {
    window._store = JSON.parse(JSON.stringify(ov));
    window._writeLog = [];
    window.fbGet = async (c) => (window._store[c] !== undefined ? window._store[c] : []);
    window.fbGetSafe = window.fbGet;   // O-19: reads moved onto fbGetSafe() in the 2026-10 audit; a mock that patches only fbGet leaves it reading the fake database
    window.fbPost = async (c, d) => {
      const id = 'id_' + (window._writeLog.length + 1);
      window._writeLog.push({ op: 'post', c, id, d });
      window._store[c] = window._store[c] || [];
      window._store[c].push({ _id: id, ...d });
      return id;
    };
    window.fbPut = async (c, id, d) => {
      window._writeLog.push({ op: 'put', c, id, d });
      window._store[c] = window._store[c] || [];
      window._store[c].push({ _id: id, ...d });
    };
    window.fbPatch = async (c, id, d) => {
      window._writeLog.push({ op: 'patch', c, id, d });
      window._store[c] = (window._store[c] || []).map((r) => (r._id === id ? { ...r, ...d } : r));
    };
    window.getUser = () => ({ name: 'T', role: 'admin' });
  }, overrides);
}

const ACCOUNTS = [
  { _id: '1110', code: '1110', name_ar: 'نقدية المزرعة', type: 'ASSET', postable: true, active: true },
  { _id: '1410', code: '1410', name_ar: 'مخزون الأعلاف', type: 'ASSET', postable: true, active: true },
  { _id: '2100', code: '2100', name_ar: 'ذمم دائنة', type: 'LIABILITY', postable: true, active: true },
  { _id: '6100', code: '6100', name_ar: 'مصروف الأعلاف', type: 'EXPENSE', postable: true, active: true },
  { _id: '6950', code: '6950', name_ar: 'فروقات جرد المخزون', type: 'EXPENSE', postable: true, active: true },
];

test.describe('Inventory Accounting (Phase 6)', () => {
  test('postInventoryPurchase (cash): moves real stock, updates weighted-average cost, posts Debit Inventory / Credit Cash, and settles to PAID in one posting (no second entry)', async ({ page }) => {
    const feed = { _id: 'f1', name: 'علف', quantity: 10, cost_per_unit: 20 };
    await setupInvAcctMocks(page, { accounts: ACCOUNTS, inventory_feeds: [feed], source_documents: [] });
    const r = await page.evaluate(() => window.postInventoryPurchase({
      itemType: 'feeds', itemName: 'علف', quantity: 10, unitCost: 30, paymentMode: 'cash', cashAccountId: '1110', operationId: 'ip-1',
    }));
    expect(r.ok).toBe(true);
    expect(r.status).toBe('PAID');
    expect(r.newAvgCost).toBe(25); // (10*20 + 10*30) / 20 = 25
    const itemPatch = await page.evaluate(() => window._store.inventory_feeds.find((i) => i._id === 'f1'));
    expect(itemPatch.quantity).toBe(20);
    expect(itemPatch.cost_per_unit).toBe(25);
    const jeWrites = await page.evaluate(() => window._writeLog.filter((w) => w.c === 'journal_entries'));
    expect(jeWrites.length).toBe(1);
    const invLine = jeWrites[0].d.lines.find((l) => l.accountId === '1410');
    const cashLine = jeWrites[0].d.lines.find((l) => l.accountId === '1110');
    expect(invLine.debit).toBe(300);
    expect(cashLine.credit).toBe(300);
  });

  test('postInventoryPurchase (credit): leaves a real open payable, no cash journal line', async ({ page }) => {
    const feed = { _id: 'f1', name: 'علف', quantity: 0, cost_per_unit: 0 };
    await setupInvAcctMocks(page, { accounts: ACCOUNTS, inventory_feeds: [feed], source_documents: [] });
    const r = await page.evaluate(() => window.postInventoryPurchase({
      itemType: 'feeds', itemName: 'علف', quantity: 5, unitCost: 40, paymentMode: 'credit', supplierId: 's1', operationId: 'ip-2',
    }));
    expect(r.ok).toBe(true);
    expect(r.status).toBe('POSTED'); // not PAID -- still owed
    const jeWrite = await page.evaluate(() => window._writeLog.find((w) => w.c === 'journal_entries'));
    const apLine = jeWrite.d.lines.find((l) => l.accountId === '2100');
    expect(apLine.credit).toBe(200);
  });

  test('postInventoryPurchase: idempotent -- replaying the same operationId moves NO additional stock and posts no second journal entry', async ({ page }) => {
    const feed = { _id: 'f1', name: 'علف', quantity: 10, cost_per_unit: 20 };
    await setupInvAcctMocks(page, { accounts: ACCOUNTS, inventory_feeds: [feed], source_documents: [] });
    await page.evaluate(() => window.postInventoryPurchase({ itemType: 'feeds', itemName: 'علف', quantity: 10, unitCost: 30, paymentMode: 'cash', cashAccountId: '1110', operationId: 'ip-1' }));
    const r2 = await page.evaluate(() => window.postInventoryPurchase({ itemType: 'feeds', itemName: 'علف', quantity: 10, unitCost: 30, paymentMode: 'cash', cashAccountId: '1110', operationId: 'ip-1' }));
    // createSourceDocument's operationId check runs BEFORE
    // recordInventoryTransaction is ever called on a replay -- stock only
    // moves once, not twice, even though recordInventoryTransaction
    // itself has no idempotency notion of its own.
    expect(r2.idempotent).toBe(true);
    const jeWrites = await page.evaluate(() => window._writeLog.filter((w) => w.c === 'journal_entries'));
    expect(jeWrites.length).toBe(1);
    const itemAfter = await page.evaluate(() => window._store.inventory_feeds.find((i) => i._id === 'f1'));
    expect(itemAfter.quantity).toBe(20); // 10 + 10, NOT 10 + 10 + 10
  });

  test('postInventoryPurchase: rejects an unknown item (recordInventoryTransaction returns matched:false)', async ({ page }) => {
    await setupInvAcctMocks(page, { accounts: ACCOUNTS, inventory_feeds: [], source_documents: [] });
    const r = await page.evaluate(() => window.postInventoryPurchase({ itemType: 'feeds', itemName: 'غير موجود', quantity: 5, unitCost: 10, paymentMode: 'cash', cashAccountId: '1110', operationId: 'ip-3' }));
    expect(r.ok).toBe(false);
  });

  test('postInventoryConsumption: Debit Feed Expense / Credit Inventory at the item\'s current weighted-average cost', async ({ page }) => {
    const feed = { _id: 'f1', name: 'علف', quantity: 50, cost_per_unit: 12 };
    await setupInvAcctMocks(page, { accounts: ACCOUNTS, inventory_feeds: [feed] });
    const r = await page.evaluate(() => window.postInventoryConsumption({ itemType: 'feeds', itemName: 'علف', quantity: 10, reason: 'feeding', operationId: 'ic-1' }));
    expect(r.ok).toBe(true);
    expect(r.amount).toBe(120);
    const itemAfter = await page.evaluate(() => window._store.inventory_feeds.find((i) => i._id === 'f1'));
    expect(itemAfter.quantity).toBe(40);
    const jeWrite = await page.evaluate(() => window._writeLog.find((w) => w.c === 'journal_entries'));
    const expLine = jeWrite.d.lines.find((l) => l.accountId === '6100');
    const invLine = jeWrite.d.lines.find((l) => l.accountId === '1410');
    expect(expLine.debit).toBe(120);
    expect(invLine.credit).toBe(120);
  });

  test('postInventoryConsumption: a zero-cost item moves stock but posts no journal entry (never fabricates a cost)', async ({ page }) => {
    const feed = { _id: 'f1', name: 'علف', quantity: 50, cost_per_unit: 0 };
    await setupInvAcctMocks(page, { accounts: ACCOUNTS, inventory_feeds: [feed] });
    const r = await page.evaluate(() => window.postInventoryConsumption({ itemType: 'feeds', itemName: 'علف', quantity: 10, operationId: 'ic-2' }));
    expect(r.ok).toBe(true);
    expect(r.posted).toBe(false);
    const itemAfter = await page.evaluate(() => window._store.inventory_feeds.find((i) => i._id === 'f1'));
    expect(itemAfter.quantity).toBe(40);
    const jeWrites = await page.evaluate(() => window._writeLog.filter((w) => w.c === 'journal_entries'));
    expect(jeWrites).toEqual([]);
  });

  test('postInventoryAdjustment: a shrinkage (found LESS than recorded) debits 6950, credits Inventory', async ({ page }) => {
    const feed = { _id: 'f1', name: 'علف', quantity: 50, cost_per_unit: 10 };
    await setupInvAcctMocks(page, { accounts: ACCOUNTS, inventory_feeds: [feed] });
    const r = await page.evaluate(() => window.postInventoryAdjustment({ itemType: 'feeds', itemName: 'علف', newQuantity: 45, operationId: 'adj-1' }));
    expect(r.ok).toBe(true);
    expect(r.direction).toBe('shrinkage');
    expect(r.amount).toBe(50);
    const jeWrite = await page.evaluate(() => window._writeLog.find((w) => w.c === 'journal_entries'));
    const adjLine = jeWrite.d.lines.find((l) => l.accountId === '6950');
    const invLine = jeWrite.d.lines.find((l) => l.accountId === '1410');
    expect(adjLine.debit).toBe(50);
    expect(invLine.credit).toBe(50);
  });

  test('postInventoryAdjustment: a gain (found MORE than recorded) debits Inventory, credits 6950', async ({ page }) => {
    const feed = { _id: 'f1', name: 'علف', quantity: 50, cost_per_unit: 10 };
    await setupInvAcctMocks(page, { accounts: ACCOUNTS, inventory_feeds: [feed] });
    const r = await page.evaluate(() => window.postInventoryAdjustment({ itemType: 'feeds', itemName: 'علف', newQuantity: 55, operationId: 'adj-2' }));
    expect(r.ok).toBe(true);
    expect(r.direction).toBe('gain');
    const jeWrite = await page.evaluate(() => window._writeLog.find((w) => w.c === 'journal_entries'));
    const adjLine = jeWrite.d.lines.find((l) => l.accountId === '6950');
    const invLine = jeWrite.d.lines.find((l) => l.accountId === '1410');
    expect(invLine.debit).toBe(50);
    expect(adjLine.credit).toBe(50);
  });

  test('postInventoryConsumption: idempotent -- replaying the same operationId moves NO additional stock and posts no second journal entry', async ({ page }) => {
    const feed = { _id: 'f1', name: 'علف', quantity: 50, cost_per_unit: 12 };
    await setupInvAcctMocks(page, { accounts: ACCOUNTS, inventory_feeds: [feed] });
    await page.evaluate(() => window.postInventoryConsumption({ itemType: 'feeds', itemName: 'علف', quantity: 10, operationId: 'ic-3' }));
    const r2 = await page.evaluate(() => window.postInventoryConsumption({ itemType: 'feeds', itemName: 'علف', quantity: 10, operationId: 'ic-3' }));
    expect(r2.idempotent).toBe(true);
    const jeWrites = await page.evaluate(() => window._writeLog.filter((w) => w.c === 'journal_entries'));
    expect(jeWrites.length).toBe(1);
    const itemAfter = await page.evaluate(() => window._store.inventory_feeds.find((i) => i._id === 'f1'));
    expect(itemAfter.quantity).toBe(40); // 50 - 10, NOT 50 - 10 - 10
  });

  test('postInventoryAdjustment: idempotent -- replaying the same operationId does not re-apply the correction or post a second journal entry', async ({ page }) => {
    const feed = { _id: 'f1', name: 'علف', quantity: 50, cost_per_unit: 10 };
    await setupInvAcctMocks(page, { accounts: ACCOUNTS, inventory_feeds: [feed] });
    await page.evaluate(() => window.postInventoryAdjustment({ itemType: 'feeds', itemName: 'علف', newQuantity: 45, operationId: 'adj-4' }));
    const r2 = await page.evaluate(() => window.postInventoryAdjustment({ itemType: 'feeds', itemName: 'علف', newQuantity: 45, operationId: 'adj-4' }));
    expect(r2.idempotent).toBe(true);
    const jeWrites = await page.evaluate(() => window._writeLog.filter((w) => w.c === 'journal_entries'));
    expect(jeWrites.length).toBe(1);
    const itemAfter = await page.evaluate(() => window._store.inventory_feeds.find((i) => i._id === 'f1'));
    expect(itemAfter.quantity).toBe(45); // corrected once, not re-applied
  });

  test('postInventoryAdjustment: no real quantity difference posts nothing', async ({ page }) => {
    const feed = { _id: 'f1', name: 'علف', quantity: 50, cost_per_unit: 10 };
    await setupInvAcctMocks(page, { accounts: ACCOUNTS, inventory_feeds: [feed] });
    const r = await page.evaluate(() => window.postInventoryAdjustment({ itemType: 'feeds', itemName: 'علف', newQuantity: 50, operationId: 'adj-3' }));
    expect(r.ok).toBe(true);
    expect(r.posted).toBe(false);
    const jeWrites = await page.evaluate(() => window._writeLog.filter((w) => w.c === 'journal_entries'));
    expect(jeWrites).toEqual([]);
  });

  test('permission: a role without can("finance") cannot post a purchase, consumption, or adjustment', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'S', role: 'supervisor' })));
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForTimeout(600);
    await page.evaluate((ov) => {
      window._store = JSON.parse(JSON.stringify(ov));
      window._writeLog = [];
      window.fbGet = async (c) => (window._store[c] !== undefined ? window._store[c] : []);
      window.fbGetSafe = window.fbGet;   // O-19: reads moved onto fbGetSafe() in the 2026-10 audit; a mock that patches only fbGet leaves it reading the fake database
      window.fbPost = async (c, d) => { window._writeLog.push({ op: 'post', c, d }); return 'id'; };
      window.fbPatch = async (c, id, d) => { window._writeLog.push({ op: 'patch', c, id, d }); };
    }, { accounts: ACCOUNTS, inventory_feeds: [{ _id: 'f1', name: 'علف', quantity: 10, cost_per_unit: 10 }] });
    const purchase = await page.evaluate(() => window.postInventoryPurchase({ itemType: 'feeds', itemName: 'علف', quantity: 5, unitCost: 10, paymentMode: 'cash', cashAccountId: '1110', operationId: 'x1' }));
    const consumption = await page.evaluate(() => window.postInventoryConsumption({ itemType: 'feeds', itemName: 'علف', quantity: 5, operationId: 'x2' }));
    const adjustment = await page.evaluate(() => window.postInventoryAdjustment({ itemType: 'feeds', itemName: 'علف', newQuantity: 8, operationId: 'x3' }));
    expect(purchase.ok).toBe(false);
    expect(consumption.ok).toBe(false);
    expect(adjustment.ok).toBe(false);
    const writes = await page.evaluate(() => window._writeLog);
    expect(writes).toEqual([]);
  });
});
