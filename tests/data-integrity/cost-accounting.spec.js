// tests/data-integrity/cost-accounting.spec.js
// Phase 8: regression protection for Farm Cost Accounting
// (window.createCostCenter / allocateCost / getCostByCenter /
// getUnallocatedCosts). Management-reporting attribution over already-
// posted journal entries -- never modifies the underlying ledger.

const { test, expect } = require('@playwright/test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

async function setupCostMocks(page, overrides = {}) {
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
    window.getUser = () => ({ name: 'T', role: 'admin' });
  }, overrides);
}

const ACCOUNTS = [
  { _id: '6100', code: '6100', name_ar: 'مصروف الأعلاف', type: 'EXPENSE' },
  { _id: '1110', code: '1110', name_ar: 'نقدية المزرعة', type: 'ASSET' },
];

test.describe('Farm Cost Accounting (Phase 8)', () => {
  test('createCostCenter: creates a record with a valid type', async ({ page }) => {
    await setupCostMocks(page, { cost_centers: [] });
    const r = await page.evaluate(() => window.createCostCenter({ name: 'حظيرة أ', type: 'barn' }));
    expect(r.ok).toBe(true);
  });

  test('createCostCenter: rejects an invalid type', async ({ page }) => {
    await setupCostMocks(page, { cost_centers: [] });
    const r = await page.evaluate(() => window.createCostCenter({ name: 'x', type: 'not_a_type' }));
    expect(r.ok).toBe(false);
  });

  test('allocateCost: splits a posted expense across cost centers by stated method, never touching the source entry', async ({ page }) => {
    const je = { _id: 'j1', date: '2026-01-10', lines: [{ accountId: '6100', debit: 1000 }, { accountId: '1110', credit: 1000 }] };
    const centers = [{ _id: 'cc1', name: 'حظيرة أ', type: 'barn' }, { _id: 'cc2', name: 'حظيرة ب', type: 'barn' }];
    await setupCostMocks(page, { journal_entries: [je], cost_centers: centers, cost_allocations: [] });
    const r = await page.evaluate(() => window.allocateCost({
      sourceJournalEntryId: 'j1', totalAmount: 1000, operationId: 'alloc-1',
      allocations: [{ costCenterId: 'cc1', method: 'BY_QUANTITY', amount: 600 }, { costCenterId: 'cc2', method: 'BY_QUANTITY', amount: 400 }],
    }));
    expect(r.ok).toBe(true);
    const write = await page.evaluate(() => window._writeLog.find((w) => w.c === 'cost_allocations'));
    expect(write.d.allocations.length).toBe(2);
    const jeWrites = await page.evaluate(() => window._writeLog.filter((w) => w.c === 'journal_entries'));
    expect(jeWrites).toEqual([]); // the original entry was never touched
  });

  test('allocateCost: rejects when allocation amounts do not sum to the total (never silently absorbs the remainder)', async ({ page }) => {
    const je = { _id: 'j1', date: '2026-01-10', lines: [{ accountId: '6100', debit: 1000 }] };
    const centers = [{ _id: 'cc1', name: 'حظيرة أ', type: 'barn' }];
    await setupCostMocks(page, { journal_entries: [je], cost_centers: centers, cost_allocations: [] });
    const r = await page.evaluate(() => window.allocateCost({
      sourceJournalEntryId: 'j1', totalAmount: 1000, operationId: 'alloc-1',
      allocations: [{ costCenterId: 'cc1', method: 'MANUAL', amount: 700 }], // 700 != 1000
    }));
    expect(r.ok).toBe(false);
  });

  test('allocateCost: rejects an invalid method and a non-existent cost center', async ({ page }) => {
    const je = { _id: 'j1', date: '2026-01-10', lines: [{ accountId: '6100', debit: 1000 }] };
    const centers = [{ _id: 'cc1', name: 'حظيرة أ', type: 'barn' }];
    await setupCostMocks(page, { journal_entries: [je], cost_centers: centers, cost_allocations: [] });
    const badMethod = await page.evaluate(() => window.allocateCost({
      sourceJournalEntryId: 'j1', totalAmount: 1000, operationId: 'alloc-1',
      allocations: [{ costCenterId: 'cc1', method: 'NOT_A_METHOD', amount: 1000 }],
    }));
    const badCenter = await page.evaluate(() => window.allocateCost({
      sourceJournalEntryId: 'j1', totalAmount: 1000, operationId: 'alloc-2',
      allocations: [{ costCenterId: 'nope', method: 'MANUAL', amount: 1000 }],
    }));
    expect(badMethod.ok).toBe(false);
    expect(badCenter.ok).toBe(false);
  });

  test('allocateCost: idempotent -- replaying the same operationId returns the existing allocation, no duplicate', async ({ page }) => {
    const existing = { _id: 'al1', sourceJournalEntryId: 'j1', totalAmount: 1000, operationId: 'alloc-1', allocations: [] };
    await setupCostMocks(page, { journal_entries: [], cost_centers: [], cost_allocations: [existing] });
    const r = await page.evaluate(() => window.allocateCost({
      sourceJournalEntryId: 'j1', totalAmount: 1000, operationId: 'alloc-1', allocations: [{ costCenterId: 'cc1', method: 'MANUAL', amount: 1000 }],
    }));
    expect(r.ok).toBe(true);
    expect(r.idempotent).toBe(true);
    const writes = await page.evaluate(() => window._writeLog.filter((w) => w.c === 'cost_allocations'));
    expect(writes).toEqual([]);
  });

  test('getCostByCenter: sums allocated amounts for one center, date-filtered by the SOURCE entry date', async ({ page }) => {
    const allocs = [
      { _id: 'a1', sourceJournalEntryId: 'j1', sourceDate: '2026-01-10', allocations: [{ costCenterId: 'cc1', amount: 600, method: 'BY_QUANTITY' }, { costCenterId: 'cc2', amount: 400, method: 'BY_QUANTITY' }] },
      { _id: 'a2', sourceJournalEntryId: 'j2', sourceDate: '2026-03-01', allocations: [{ costCenterId: 'cc1', amount: 999, method: 'MANUAL' }] }, // out of range
    ];
    await setupCostMocks(page, { cost_allocations: allocs });
    const r = await page.evaluate(() => window.getCostByCenter('cc1', '2026-01-01', '2026-01-31'));
    expect(r.ok).toBe(true);
    expect(r.total).toBe(600);
    expect(r.entries.length).toBe(1);
  });

  test('getUnallocatedCosts: surfaces expense-account journal entries with no allocation record, resolved via the Chart of Accounts (not the description text)', async ({ page }) => {
    const entries = [
      { _id: 'j1', date: '2026-01-05', description: 'مصروف غير موزّع', lines: [{ accountId: '6100', debit: 500 }, { accountId: '1110', credit: 500 }] },
      { _id: 'j2', date: '2026-01-06', description: 'مصروف موزّع بالفعل', lines: [{ accountId: '6100', debit: 300 }, { accountId: '1110', credit: 300 }] },
      { _id: 'j3', date: '2026-01-07', description: 'ليس مصروفًا', lines: [{ accountId: '1110', debit: 200 }, { accountId: '1110', credit: 200 }] },
    ];
    const allocs = [{ _id: 'a1', sourceJournalEntryId: 'j2', allocations: [] }];
    await setupCostMocks(page, { journal_entries: entries, accounts: ACCOUNTS, cost_allocations: allocs });
    const r = await page.evaluate(() => window.getUnallocatedCosts(null, null));
    expect(r.ok).toBe(true);
    expect(r.entries.length).toBe(1);
    expect(r.entries[0].journalEntryId).toBe('j1');
    expect(r.total).toBe(500);
  });

  test('permission: a role without can("finance") cannot create a cost center or allocate a cost', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'S', role: 'supervisor' })));
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForTimeout(600);
    await page.evaluate((ov) => {
      window._store = JSON.parse(JSON.stringify(ov));
      window._writeLog = [];
      window.fbGet = async (c) => (window._store[c] !== undefined ? window._store[c] : []);
      window.fbPost = async (c, d) => { window._writeLog.push({ op: 'post', c, d }); return 'id'; };
    }, { journal_entries: [{ _id: 'j1', date: '2026-01-10', lines: [] }], cost_centers: [] });
    const center = await page.evaluate(() => window.createCostCenter({ name: 'x', type: 'barn' }));
    const alloc = await page.evaluate(() => window.allocateCost({ sourceJournalEntryId: 'j1', totalAmount: 100, operationId: 'x1', allocations: [{ costCenterId: 'cc1', method: 'MANUAL', amount: 100 }] }));
    expect(center.ok).toBe(false);
    expect(alloc.ok).toBe(false);
    const writes = await page.evaluate(() => window._writeLog);
    expect(writes).toEqual([]);
  });
});
