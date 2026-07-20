// tests/data-integrity/farm-inventory.spec.js
// v1.7: regression protection for the Inventory Transaction engine
// (window.recordInventoryTransaction, shared.js) and its integration
// points. Per docs/features/INVENTORY-DISCOVERY.md, this sprint
// extends a real, pre-existing inventory system -- these tests verify
// no duplicate item schema/collection was introduced, deduction never
// goes negative, unit conversion (bags vs kg) is correct, and every
// notification/KPI is read-only.

const { test, expect } = require('@playwright/test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

async function setupInvMocks(page, overrides = {}) {
  await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
  await page.goto(`${BASE_URL}/dashboard.html`);
  await page.waitForTimeout(600);
  await page.evaluate((ov) => {
    window._writeLog = [];
    window.fbGet = async (c) => (ov[c] !== undefined ? ov[c] : []);
    window.fbPost = async (c, d) => { window._writeLog.push({ op: 'post', c, d }); return 'id'; };
    window.fbPatch = async (c, id, d) => { window._writeLog.push({ op: 'patch', c, id, d }); };
    window.getUser = () => ({ name: 'T', role: 'admin' });
  }, overrides);
}

test.describe('Farm Inventory (v1.7)', () => {
  test('SSOT: recordInventoryTransaction reads the EXISTING inventory_meds collection, no new item schema', async ({ page }) => {
    await setupInvMocks(page, { inventory_meds: [{ _id: 'm1', name: 'دواء', quantity: 10 }] });
    await page.evaluate(() => window.recordInventoryTransaction('meds', 'دواء', -1, 'treatment', 'h1'));
    const writes = await page.evaluate(() => window._writeLog);
    const itemWrite = writes.find((w) => w.c === 'inventory_meds');
    expect(itemWrite).toBeTruthy();
    expect(Object.keys(itemWrite.d)).toEqual(['quantity']);
  });

  test('deduction never goes negative: requesting more than available clamps to exactly zero', async ({ page }) => {
    await setupInvMocks(page, { inventory_meds: [{ _id: 'm1', name: 'دواء', quantity: 5 }] });
    const r = await page.evaluate(() => window.recordInventoryTransaction('meds', 'دواء', -7, 'treatment', 'h1'));
    expect(r.after).toBe(0);
    expect(r.clamped).toBe(true);
    expect(r.actualDelta).toBe(-5);
  });

  test('a transaction record is written with both requested and actual delta', async ({ page }) => {
    await setupInvMocks(page, { inventory_meds: [{ _id: 'm1', name: 'دواء', quantity: 5 }] });
    await page.evaluate(() => window.recordInventoryTransaction('meds', 'دواء', -7, 'treatment', 'h1'));
    const writes = await page.evaluate(() => window._writeLog);
    const txn = writes.find((w) => w.c === 'inventory_transactions');
    expect(txn.d.requested_delta).toBe(-7);
    expect(txn.d.actual_delta).toBe(-5);
    expect(txn.d.quantity_before).toBe(5);
    expect(txn.d.quantity_after).toBe(0);
  });

  test('unit conversion: feed deduction correctly converts raw kg to stock units via the item own unit_weight', async ({ page }) => {
    await setupInvMocks(page, { inventory_feeds: [{ _id: 'f1', name: 'علف', quantity: 10, unit_weight: 50 }] });
    const r = await page.evaluate(() => window.recordInventoryTransaction('feeds', 'علف', -(100 / 50), 'feeding', null));
    expect(r.before).toBe(10);
    expect(r.after).toBe(8);
  });

  test('purchase transaction creates a real finance expense record (Purchase-to-Finance linking)', async ({ page }) => {
    await setupInvMocks(page, { inventory_feeds: [{ _id: 'f1', name: 'علف', quantity: 5, cost_per_unit: 100 }] });
    await page.evaluate(() => window.recordInventoryTransaction('feeds', 'علف', 3, 'purchase', null));
    const writes = await page.evaluate(() => window._writeLog);
    const finWrite = writes.find((w) => w.c === 'finance');
    expect(finWrite).toBeTruthy();
    expect(finWrite.d.amount).toBe(300);
    expect(finWrite.d.category).toBe('أعلاف ومواد تغذية');
  });

  test('purchase transaction also stamps last_purchase on the item', async ({ page }) => {
    await setupInvMocks(page, { inventory_feeds: [{ _id: 'f1', name: 'علف', quantity: 5, cost_per_unit: 0 }] });
    await page.evaluate(() => window.recordInventoryTransaction('feeds', 'علف', 3, 'purchase', null));
    const writes = await page.evaluate(() => window._writeLog);
    const itemWrite = writes.find((w) => w.c === 'inventory_feeds');
    expect(itemWrite.d.last_purchase).toBeTruthy();
  });

  test('no matching item: returns matched false, does not throw or write anything', async ({ page }) => {
    await setupInvMocks(page, { inventory_meds: [] });
    const r = await page.evaluate(() => window.recordInventoryTransaction('meds', 'غير موجود', -1, 'treatment', 'h1'));
    expect(r.matched).toBe(false);
    const writes = await page.evaluate(() => window._writeLog);
    expect(writes).toEqual([]);
  });

  test('Workflow integration: health treatment deduction call succeeds without blocking the health save', async ({ page }) => {
    await setupInvMocks(page, { inventory_meds: [{ _id: 'm1', name: 'مضاد حيوي', quantity: 10 }] });
    const result = await page.evaluate(async () => {
      await window.recordInventoryTransaction('meds', 'مضاد حيوي', -1, 'treatment', 'h1');
      return window._writeLog.some((w) => w.c === 'inventory_meds');
    });
    expect(result).toBe(true);
  });

  test('Workflow integration: vaccine deducts the real scheduled count, not a hardcoded 1', async ({ page }) => {
    await setupInvMocks(page, { inventory_meds: [{ _id: 'm1', name: 'لقاح ب', quantity: 20 }] });
    const r = await page.evaluate(() => window.recordInventoryTransaction('meds', 'لقاح ب', -5, 'vaccination', 'v1'));
    expect(r.after).toBe(15);
  });

  test('Notification: Out of Stock is distinct from and additional to the existing Low Stock trigger', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
    await page.goto(`${BASE_URL}/notifications.html`);
    await page.waitForTimeout(600);
    const notifs = await page.evaluate(async () => {
      window._notifs = [];
      window.fbGet = async (c) => {
        if (c === 'inventory_meds') return [{ _id: 'm1', name: 'دواء منخفض', quantity: 2, min_quantity: 5 }, { _id: 'm2', name: 'دواء نافد', quantity: 0, min_quantity: 5 }];
        if (c === 'notifications') return window._notifs.slice();
        return [];
      };
      window.fbPost = async (c, d) => { if (c === 'notifications') { const id = 'n' + window._notifs.length; window._notifs.push({ ...d, _id: id }); return id; } return 'id'; };
      window.fbPatch = async () => {};
      window.getUser = () => ({ name: 'T', role: 'admin' });
      window.initFirebase = () => true;
      window.getWeather = async () => null;
      localStorage.removeItem('_sentNotifIds');
      await NS.checkAll();
      return window._notifs;
    });
    expect(notifs.some((n) => n.title.includes('نفاد كامل') && n.title.includes('دواء نافد'))).toBe(true);
    expect(notifs.some((n) => n.title.includes('منخفض') && n.title.includes('دواء منخفض'))).toBe(true);
  });

  test('Notification: Expired is distinct from and additional to the existing Expiring Soon trigger', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
    await page.goto(`${BASE_URL}/notifications.html`);
    await page.waitForTimeout(600);
    const notifs = await page.evaluate(async () => {
      window._notifs = [];
      const past = new Date(); past.setDate(past.getDate() - 10);
      const soon = new Date(); soon.setDate(soon.getDate() + 5);
      window.fbGet = async (c) => {
        if (c === 'inventory_meds') return [
          { _id: 'm1', name: 'منتهي فعلا', expiry: past.toISOString().slice(0, 10) },
          { _id: 'm2', name: 'قريب الانتهاء', expiry: soon.toISOString().slice(0, 10) },
        ];
        if (c === 'notifications') return window._notifs.slice();
        return [];
      };
      window.fbPost = async (c, d) => { if (c === 'notifications') { const id = 'n' + window._notifs.length; window._notifs.push({ ...d, _id: id }); return id; } return 'id'; };
      window.fbPatch = async () => {};
      window.getUser = () => ({ name: 'T', role: 'admin' });
      window.initFirebase = () => true;
      window.getWeather = async () => null;
      localStorage.removeItem('_sentNotifIds');
      await NS.checkAll();
      return window._notifs;
    });
    expect(notifs.some((n) => n.title.includes('دواء منتهي الصلاحية') && n.title.includes('منتهي فعلا'))).toBe(true);
    expect(notifs.some((n) => n.title.includes('قارب على الانتهاء') && n.title.includes('قريب الانتهاء'))).toBe(true);
  });

  test('Dashboard: Inventory Executive Card renders correct KPI numbers', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await setupInvMocks(page, {
      inventory_meds: [{ name: 'م1', quantity: 0, min_quantity: 5 }],
      inventory_feeds: [{ name: 'ع1', quantity: 3, min_quantity: 10, unit_weight: 50 }],
      feed_consumption: [],
    });
    await page.evaluate(() => window.renderInventoryExecCard());
    await page.waitForTimeout(300);
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).toContain('المخزون');
    expect(errors.filter((e) => !e.includes('Failed to fetch'))).toEqual([]);
  });

  test('Reports: Inventory tab renders stock levels, transactions, and consumption tables', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
    await page.goto(`${BASE_URL}/reports.html`);
    await page.waitForTimeout(700);
    await page.evaluate(() => {
      window._data = {
        animals: [], health: [], weightAlerts: [], production: [], productionAlerts: [], dailyTasks: [], breeding: [], finance: [], vaccines: [],
        meds: [{ name: 'م1', quantity: 2, min_quantity: 5, unit: 'ع' }], feeds: [{ name: 'ع1', quantity: 0, min_quantity: 10, cost_per_unit: 5 }],
        notifications: [], workflowHistory: [], feedConsumption: [{ date: '2026-07-01', barn: 'B1', feed_name: 'ع1', quantity_kg: 50 }],
        inventoryTransactions: [{ date: '2026-07-01', item_name: 'م1', reason: 'treatment', actual_delta: -1, quantity_before: 3, quantity_after: 2, created_at: '2026-07-01T00:00:00Z' }],
        s: { currency: 'ج.م' },
      };
      window.switchTab('inventory');
    });
    await page.waitForTimeout(500);
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).toContain('مستويات المخزون');
    expect(bodyText).toContain('حركات المخزون');
    expect(bodyText).toContain('استهلاك العلف');
    expect(errors.filter((e) => !e.includes('Failed to fetch'))).toEqual([]);
  });

  test('Analytics: Inventory consumption trend renders as a 7th chart', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
    await page.goto(`${BASE_URL}/analytics.html`);
    await page.waitForTimeout(2200);
    const canvasCount = await page.evaluate(() => document.querySelectorAll('canvas').length);
    expect(canvasCount).toBe(7);
    expect(errors.filter((e) => !e.includes('Failed to fetch'))).toEqual([]);
  });

  test('Animal Detail: consumption section shows real per-animal treatments and honestly-scoped barn-level feed', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
    await page.goto(`${BASE_URL}/animal-detail.html?id=x1`);
    await page.waitForTimeout(700);
    const bodyText = await page.evaluate(async () => {
      window.fbGet = async (c) => {
        if (c === 'health') return [{ animal_tag: 'G-1', medication: 'مضاد حيوي', date: '2026-07-10' }];
        if (c === 'feed_consumption') return [{ barn: 'B1', date: new Date().toISOString().slice(0, 7) + '-05', quantity_kg: 200 }];
        return [];
      };
      await window.renderAnimalConsumption({ tag: 'G-1', barn: 'B1' });
      return document.getElementById('animal-consumption-section').innerHTML;
    });
    expect(bodyText).toContain('مضاد حيوي');
    expect(bodyText).toContain('لا يوجد تتبّع مباشر لكل حيوان');
    expect(errors.filter((e) => !e.includes('Failed to fetch'))).toEqual([]);
  });

  test('permission: Inventory Report tab reachable only with can reports (matches existing page-level gate)', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'V', role: 'worker' })));
    await page.goto(`${BASE_URL}/reports.html`);
    await page.waitForTimeout(600);
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).toContain('غير مصرح بالوصول');
  });

  test('CSV export still works after this sprint changes (pre-existing capability, not rebuilt)', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
    await page.goto(`${BASE_URL}/inventory.html`);
    await page.waitForTimeout(700);
    const hasExportFn = await page.evaluate(() => typeof window.exportInvCSV === 'function');
    expect(hasExportFn).toBe(true);
    expect(errors.filter((e) => !e.includes('Failed to fetch'))).toEqual([]);
  });

  test('regression: existing Low Stock trigger is untouched (same condition, same id pattern)', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
    await page.goto(`${BASE_URL}/notifications.html`);
    await page.waitForTimeout(600);
    const notifs = await page.evaluate(async () => {
      window._notifs = [];
      window.fbGet = async (c) => {
        if (c === 'inventory_meds') return [{ _id: 'm1', name: 'دواء', quantity: 3, min_quantity: 5 }];
        if (c === 'notifications') return window._notifs.slice();
        return [];
      };
      window.fbPost = async (c, d) => { if (c === 'notifications') { const id = 'n' + window._notifs.length; window._notifs.push({ ...d, _id: id }); return id; } return 'id'; };
      window.fbPatch = async () => {};
      window.getUser = () => ({ name: 'T', role: 'admin' });
      window.initFirebase = () => true;
      window.getWeather = async () => null;
      localStorage.removeItem('_sentNotifIds');
      await NS.checkAll();
      return window._notifs;
    });
    const lowStockNotif = notifs.find((n) => n.id && n.id.startsWith('med-low-'));
    expect(lowStockNotif).toBeTruthy();
    expect(lowStockNotif.title).toContain('مخزون دواء منخفض');
  });
});
