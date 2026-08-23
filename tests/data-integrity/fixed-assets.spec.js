// tests/data-integrity/fixed-assets.spec.js
// Phase 14: regression protection for Fixed Assets & Depreciation
// (window.postAssetPurchase / postDepreciation /
// getAssetAccumulatedDepreciation / getAssetBookValue).

const { test, expect } = require('@playwright/test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

async function setupAssetMocks(page, overrides = {}) {
  await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
  await page.goto(`${BASE_URL}/dashboard.html`);
  await page.waitForTimeout(600);
  await page.evaluate((ov) => {
    window._store = JSON.parse(JSON.stringify(ov));
    window._writeLog = [];
    window.fbGet = async (c) => (window._store[c] !== undefined ? window._store[c] : []);
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
  { _id: '1600', code: '1600', name_ar: 'الأصول الثابتة', type: 'ASSET', postable: true, active: true },
  { _id: '2100', code: '2100', name_ar: 'ذمم دائنة', type: 'LIABILITY', postable: true, active: true },
  { _id: '6800', code: '6800', name_ar: 'إهلاك', type: 'EXPENSE', postable: true, active: true },
  { _id: '1690', code: '1690', name_ar: 'مجمّع الإهلاك', type: 'ASSET', postable: true, active: true },
];

test.describe('Fixed Assets & Depreciation (Phase 14)', () => {
  test('postAssetPurchase (cash): creates the asset record and posts Debit Fixed Assets / Credit Cash', async ({ page }) => {
    await setupAssetMocks(page, { accounts: ACCOUNTS, source_documents: [], fixed_assets: [] });
    const r = await page.evaluate(() => window.postAssetPurchase({
      name: 'جرار زراعي', category: 'equipment', acquisitionCost: 120000, usefulLifeMonths: 120, residualValue: 0,
      paymentMode: 'cash', cashAccountId: '1110', operationId: 'fa-1',
    }));
    expect(r.ok).toBe(true);
    expect(r.status).toBe('PAID');
    const jeWrite = await page.evaluate(() => window._writeLog.find((w) => w.c === 'journal_entries'));
    const assetLine = jeWrite.d.lines.find((l) => l.accountId === '1600');
    const cashLine = jeWrite.d.lines.find((l) => l.accountId === '1110');
    expect(assetLine.debit).toBe(120000);
    expect(cashLine.credit).toBe(120000);
    const assetRecord = await page.evaluate(() => window._store.fixed_assets[0]);
    expect(assetRecord.acquisitionCost).toBe(120000);
    expect(assetRecord.usefulLifeMonths).toBe(120);
  });

  test('postAssetPurchase: rejects a residual value >= acquisition cost', async ({ page }) => {
    await setupAssetMocks(page, { accounts: ACCOUNTS, source_documents: [], fixed_assets: [] });
    const r = await page.evaluate(() => window.postAssetPurchase({
      name: 'x', acquisitionCost: 1000, usefulLifeMonths: 12, residualValue: 1000, paymentMode: 'cash', cashAccountId: '1110', operationId: 'fa-2',
    }));
    expect(r.ok).toBe(false);
  });

  test('postDepreciation: posts exactly one straight-line period, Debit Depreciation Expense / Credit Accumulated Depreciation', async ({ page }) => {
    const asset = { _id: 'as1', name: 'جرار', acquisitionCost: 120000, usefulLifeMonths: 120, residualValue: 0 };
    await setupAssetMocks(page, { accounts: ACCOUNTS, fixed_assets: [asset], journal_entries: [] });
    const r = await page.evaluate(() => window.postDepreciation({ assetId: 'as1', periodOperationId: '2026-01', periodLabel: 'يناير 2026' }));
    expect(r.ok).toBe(true);
    expect(r.amount).toBe(1000); // 120000/120
    const jeWrite = await page.evaluate(() => window._writeLog.find((w) => w.c === 'journal_entries'));
    const expLine = jeWrite.d.lines.find((l) => l.accountId === '6800');
    const accumLine = jeWrite.d.lines.find((l) => l.accountId === '1690');
    expect(expLine.debit).toBe(1000);
    expect(accumLine.credit).toBe(1000);
  });

  test('postDepreciation: idempotent -- re-running the SAME period does not double-depreciate', async ({ page }) => {
    const asset = { _id: 'as1', name: 'جرار', acquisitionCost: 120000, usefulLifeMonths: 120, residualValue: 0 };
    await setupAssetMocks(page, { accounts: ACCOUNTS, fixed_assets: [asset], journal_entries: [] });
    await page.evaluate(() => window.postDepreciation({ assetId: 'as1', periodOperationId: '2026-01' }));
    const r2 = await page.evaluate(() => window.postDepreciation({ assetId: 'as1', periodOperationId: '2026-01' }));
    expect(r2.idempotent).toBe(true);
    const jeWrites = await page.evaluate(() => window._writeLog.filter((w) => w.c === 'journal_entries'));
    expect(jeWrites.length).toBe(1);
  });

  test('postDepreciation: a DIFFERENT period for the same asset posts a second, real entry and accumulates correctly', async ({ page }) => {
    const asset = { _id: 'as1', name: 'جرار', acquisitionCost: 120000, usefulLifeMonths: 120, residualValue: 0 };
    await setupAssetMocks(page, { accounts: ACCOUNTS, fixed_assets: [asset], journal_entries: [] });
    await page.evaluate(() => window.postDepreciation({ assetId: 'as1', periodOperationId: '2026-01' }));
    await page.evaluate(() => window.postDepreciation({ assetId: 'as1', periodOperationId: '2026-02' }));
    const accumulated = await page.evaluate(() => window.getAssetAccumulatedDepreciation('as1'));
    expect(accumulated).toBe(2000);
    const bookValue = await page.evaluate(() => window.getAssetBookValue('as1'));
    expect(bookValue.bookValue).toBe(118000);
  });

  test('postDepreciation: a cleanly-divisible asset fully depreciates in exactly usefulLifeMonths calls, then refuses further posting', async ({ page }) => {
    const asset = { _id: 'as1', name: 'أداة', acquisitionCost: 999, usefulLifeMonths: 3, residualValue: 0 }; // 999/3 = 333 exactly, no rounding remainder
    await setupAssetMocks(page, { accounts: ACCOUNTS, fixed_assets: [asset], journal_entries: [] });
    await page.evaluate(() => window.postDepreciation({ assetId: 'as1', periodOperationId: 'p1' }));
    await page.evaluate(() => window.postDepreciation({ assetId: 'as1', periodOperationId: 'p2' }));
    await page.evaluate(() => window.postDepreciation({ assetId: 'as1', periodOperationId: 'p3' }));
    const accumulated = await page.evaluate(() => window.getAssetAccumulatedDepreciation('as1'));
    expect(accumulated).toBe(999);
    const r4 = await page.evaluate(() => window.postDepreciation({ assetId: 'as1', periodOperationId: 'p4' }));
    expect(r4.posted).toBe(false); // fully depreciated, nothing left to post
  });

  test('postDepreciation: never overshoots the depreciable value -- a non-evenly-divisible schedule clamps its final real period to exactly what remains', async ({ page }) => {
    // acquisitionCost 100, residual 0, usefulLife 3 months -> periodAmount 33.33,
    // 3 regular periods sum to 99.99, leaving a real 0.01 remainder that a 4th
    // call must post EXACTLY (never more, never rounded away) -- accumulated
    // depreciation must never exceed the asset's own depreciable value (100).
    const asset = { _id: 'as1', name: 'أداة صغيرة', acquisitionCost: 100, usefulLifeMonths: 3, residualValue: 0 };
    await setupAssetMocks(page, { accounts: ACCOUNTS, fixed_assets: [asset], journal_entries: [] });
    await page.evaluate(() => window.postDepreciation({ assetId: 'as1', periodOperationId: 'p1' }));
    await page.evaluate(() => window.postDepreciation({ assetId: 'as1', periodOperationId: 'p2' }));
    const r3 = await page.evaluate(() => window.postDepreciation({ assetId: 'as1', periodOperationId: 'p3' }));
    expect(r3.amount).toBe(33.33);
    const afterThree = await page.evaluate(() => window.getAssetAccumulatedDepreciation('as1'));
    expect(afterThree).toBe(99.99);
    const r4 = await page.evaluate(() => window.postDepreciation({ assetId: 'as1', periodOperationId: 'p4' }));
    expect(r4.amount).toBe(0.01); // the real remainder -- clamped, not the full 33.33 period amount
    const afterFour = await page.evaluate(() => window.getAssetAccumulatedDepreciation('as1'));
    expect(afterFour).toBe(100); // exactly the depreciable value -- never overshoots
    const r5 = await page.evaluate(() => window.postDepreciation({ assetId: 'as1', periodOperationId: 'p5' }));
    expect(r5.posted).toBe(false);
  });

  test('getAssetBookValue: with zero depreciation posted, book value equals acquisition cost', async ({ page }) => {
    const asset = { _id: 'as1', name: 'جرار', acquisitionCost: 50000, usefulLifeMonths: 60, residualValue: 5000 };
    await setupAssetMocks(page, { fixed_assets: [asset], journal_entries: [] });
    const r = await page.evaluate(() => window.getAssetBookValue('as1'));
    expect(r.ok).toBe(true);
    expect(r.accumulatedDepreciation).toBe(0);
    expect(r.bookValue).toBe(50000);
  });

  test('permission: a role without can("finance") cannot purchase an asset or post depreciation', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'S', role: 'supervisor' })));
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForTimeout(600);
    await page.evaluate((ov) => {
      window._store = JSON.parse(JSON.stringify(ov));
      window._writeLog = [];
      window.fbGet = async (c) => (window._store[c] !== undefined ? window._store[c] : []);
      window.fbPost = async (c, d) => { window._writeLog.push({ op: 'post', c, d }); return 'id'; };
    }, { accounts: ACCOUNTS, fixed_assets: [{ _id: 'as1', name: 'x', acquisitionCost: 1000, usefulLifeMonths: 12, residualValue: 0 }] });
    const purchase = await page.evaluate(() => window.postAssetPurchase({ name: 'x', acquisitionCost: 1000, usefulLifeMonths: 12, paymentMode: 'cash', cashAccountId: '1110', operationId: 'x1' }));
    const dep = await page.evaluate(() => window.postDepreciation({ assetId: 'as1', periodOperationId: '2026-01' }));
    expect(purchase.ok).toBe(false);
    expect(dep.ok).toBe(false);
    const writes = await page.evaluate(() => window._writeLog);
    expect(writes).toEqual([]);
  });
});
