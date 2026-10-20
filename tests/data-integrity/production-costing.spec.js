// tests/data-integrity/production-costing.spec.js
// Phase 13: regression protection for Production Costing
// (window.getProductionMargin). Ties together journal_entries (revenue),
// Phase 8's cost-center allocations (cost), and the pre-existing
// production_log collection (quantity) -- pure reporting, no writes.
// Milk/wool/manure SALES themselves are Phase 4's createSalesInvoice,
// not re-tested here.

const { test, expect } = require('../fixtures/farm-test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

async function setupProdMocks(page, overrides = {}) {
  await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
  await page.goto(`${BASE_URL}/dashboard.html`);
  await page.waitForTimeout(600);
  await page.evaluate((ov) => {
    window.fbGet = async (c) => (ov[c] !== undefined ? ov[c] : []);
    window.fbGetSafe = window.fbGet;   // O-19: reads moved onto fbGetSafe() in the 2026-10 audit; a mock that patches only fbGet leaves it reading the fake database
  }, overrides);
}

test.describe('Production Costing (Phase 13)', () => {
  test('getProductionMargin: computes revenue, cost, gross margin, and per-unit figures from three real sources', async ({ page }) => {
    const entries = [
      { _id: 'j1', date: '2026-01-10', lines: [{ accountId: '1110', debit: 500 }, { accountId: '4200', credit: 500 }] }, // milk revenue
      { _id: 'j2', date: '2026-01-11', lines: [{ accountId: '1110', debit: 300 }, { accountId: '4200', credit: 300 }] }, // milk revenue
      { _id: 'j3', date: '2026-01-11', lines: [{ accountId: '1110', debit: 999 }, { accountId: '4300', credit: 999 }] }, // wool revenue -- must be excluded
    ];
    const allocs = [{ _id: 'a1', sourceJournalEntryId: 'jx', sourceDate: '2026-01-10', allocations: [{ costCenterId: 'cc-milk', amount: 200, method: 'MANUAL' }] }];
    const productionLog = [
      { type: 'milk', date: '2026-01-10', quantity: 40 },
      { type: 'milk', date: '2026-01-11', quantity: 30 },
      { type: 'wool', date: '2026-01-11', quantity: 999 }, // must be excluded (different productionLogType)
    ];
    await setupProdMocks(page, { journal_entries: entries, cost_allocations: allocs, production_log: productionLog });
    const r = await page.evaluate(() => window.getProductionMargin({
      revenueAccountId: '4200', costCenterId: 'cc-milk', productionLogType: 'milk', startDate: '2026-01-01', endDate: '2026-01-31',
    }));
    expect(r.ok).toBe(true);
    expect(r.revenue).toBe(800); // 500 + 300, excludes wool's 999
    expect(r.cost).toBe(200);
    expect(r.grossMargin).toBe(600);
    expect(r.quantity).toBe(70); // 40 + 30, excludes wool's 999
    expect(r.costPerUnit).toBe(200 / 70);
    expect(r.revenuePerUnit).toBe(800 / 70);
  });

  test('getProductionMargin: zero quantity returns null per-unit figures, never a fabricated number or divide-by-zero', async ({ page }) => {
    const entries = [{ _id: 'j1', date: '2026-01-10', lines: [{ accountId: '4200', credit: 500 }] }];
    await setupProdMocks(page, { journal_entries: entries, cost_allocations: [], production_log: [] });
    const r = await page.evaluate(() => window.getProductionMargin({ revenueAccountId: '4200', productionLogType: 'milk' }));
    expect(r.ok).toBe(true);
    expect(r.revenue).toBe(500);
    expect(r.quantity).toBe(0);
    expect(r.costPerUnit).toBeNull();
    expect(r.revenuePerUnit).toBeNull();
  });

  test('getProductionMargin: no costCenterId means zero cost reported (not an error, not fabricated)', async ({ page }) => {
    const entries = [{ _id: 'j1', date: '2026-01-10', lines: [{ accountId: '4200', credit: 500 }] }];
    await setupProdMocks(page, { journal_entries: entries });
    const r = await page.evaluate(() => window.getProductionMargin({ revenueAccountId: '4200' }));
    expect(r.ok).toBe(true);
    expect(r.cost).toBe(0);
    expect(r.grossMargin).toBe(500);
  });

  test('rejects a call with no revenueAccountId', async ({ page }) => {
    await setupProdMocks(page, {});
    const r = await page.evaluate(() => window.getProductionMargin({}));
    expect(r.ok).toBe(false);
  });
});
