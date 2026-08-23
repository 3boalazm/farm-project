// tests/data-integrity/budgeting.spec.js
// Phase 20: regression protection for Budgeting
// (window.createBudgetLine / approveBudgetLine / lockBudgetLine /
// getBudgetVsActual).

const { test, expect } = require('@playwright/test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

async function setupBudgetMocks(page, overrides = {}) {
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
    window.fbPatch = async (c, id, d) => {
      window._writeLog.push({ op: 'patch', c, id, d });
      window._store[c] = (window._store[c] || []).map((r) => (r._id === id ? { ...r, ...d } : r));
    };
    window.getUser = () => ({ name: 'T', role: 'admin' });
  }, overrides);
}

const ACCOUNTS = [
  { _id: '6100', code: '6100', name_ar: 'مصروف الأعلاف', type: 'EXPENSE', normalBalance: 'debit' },
  { _id: '4100', code: '4100', name_ar: 'بيع حيوانات', type: 'REVENUE', normalBalance: 'credit' },
];

test.describe('Budgeting (Phase 20)', () => {
  test('createBudgetLine: creates a DRAFT line, rejects an unknown account', async ({ page }) => {
    await setupBudgetMocks(page, { accounts: ACCOUNTS, budgets: [] });
    const r = await page.evaluate(() => window.createBudgetLine({ periodKey: '2026-01', accountId: '6100', amount: 1000 }));
    expect(r.ok).toBe(true);
    const bad = await page.evaluate(() => window.createBudgetLine({ periodKey: '2026-01', accountId: 'nope', amount: 100 }));
    expect(bad.ok).toBe(false);
  });

  test('approveBudgetLine: DRAFT -> APPROVED; refuses on a non-DRAFT line', async ({ page }) => {
    const line = { _id: 'b1', periodKey: '2026-01', accountId: '6100', amount: 1000, status: 'DRAFT' };
    await setupBudgetMocks(page, { budgets: [line] });
    const r = await page.evaluate(() => window.approveBudgetLine('b1'));
    expect(r.ok).toBe(true);
    const r2 = await page.evaluate(() => window.approveBudgetLine('b1')); // already approved now
    expect(r2.ok).toBe(false);
  });

  test('lockBudgetLine: requires APPROVED first', async ({ page }) => {
    const draft = { _id: 'b1', periodKey: '2026-01', accountId: '6100', amount: 1000, status: 'DRAFT' };
    await setupBudgetMocks(page, { budgets: [draft] });
    const r = await page.evaluate(() => window.lockBudgetLine('b1'));
    expect(r.ok).toBe(false);
  });

  test('getBudgetVsActual: only counts APPROVED/LOCKED budget lines, computes real actual and variance for an EXPENSE account', async ({ page }) => {
    const budgets = [
      { _id: 'b1', periodKey: '2026-01', accountId: '6100', amount: 1000, status: 'APPROVED' },
      { _id: 'b2', periodKey: '2026-01', accountId: '6100', amount: 500, status: 'DRAFT' }, // must be excluded
    ];
    const entries = [
      { _id: 'j1', date: '2026-01-10', lines: [{ accountId: '6100', debit: 1200 }, { accountId: '1110', credit: 1200 }] },
    ];
    await setupBudgetMocks(page, { accounts: ACCOUNTS, budgets: budgets, journal_entries: entries });
    const r = await page.evaluate(() => window.getBudgetVsActual({ periodKey: '2026-01', accountId: '6100', startDate: '2026-01-01', endDate: '2026-01-31' }));
    expect(r.ok).toBe(true);
    expect(r.budget).toBe(1000); // only the APPROVED 1000, not 1500
    expect(r.actual).toBe(1200);
    expect(r.variance).toBe(200); // expense account: actual - budget = over budget
    expect(r.variancePercent).toBe(20); // 200/1000 * 100
  });

  test('getBudgetVsActual: a REVENUE account computes variance as budget - actual (positive = under target)', async ({ page }) => {
    const budgets = [{ _id: 'b1', periodKey: '2026-01', accountId: '4100', amount: 5000, status: 'LOCKED' }];
    const entries = [{ _id: 'j1', date: '2026-01-10', lines: [{ accountId: '4100', credit: 4000 }, { accountId: '1110', debit: 4000 }] }];
    await setupBudgetMocks(page, { accounts: ACCOUNTS, budgets: budgets, journal_entries: entries });
    const r = await page.evaluate(() => window.getBudgetVsActual({ periodKey: '2026-01', accountId: '4100', startDate: '2026-01-01', endDate: '2026-01-31' }));
    expect(r.budget).toBe(5000);
    expect(r.actual).toBe(4000);
    expect(r.variance).toBe(1000); // budget - actual = under target
  });

  test('getBudgetVsActual: a zero budget returns variancePercent null, never a fabricated number or Infinity', async ({ page }) => {
    const entries = [{ _id: 'j1', date: '2026-01-10', lines: [{ accountId: '6100', debit: 300 }] }];
    await setupBudgetMocks(page, { accounts: ACCOUNTS, budgets: [], journal_entries: entries });
    const r = await page.evaluate(() => window.getBudgetVsActual({ periodKey: '2026-01', accountId: '6100', startDate: '2026-01-01', endDate: '2026-01-31' }));
    expect(r.budget).toBe(0);
    expect(r.variancePercent).toBeNull();
  });

  test('permission: a role without can("finance") cannot create, approve, or lock a budget line', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'S', role: 'supervisor' })));
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForTimeout(600);
    await page.evaluate((ov) => {
      window._store = JSON.parse(JSON.stringify(ov));
      window._writeLog = [];
      window.fbGet = async (c) => (window._store[c] !== undefined ? window._store[c] : []);
      window.fbPost = async (c, d) => { window._writeLog.push({ op: 'post', c, d }); return 'id'; };
      window.fbPatch = async (c, id, d) => { window._writeLog.push({ op: 'patch', c, id, d }); };
    }, { accounts: ACCOUNTS, budgets: [{ _id: 'b1', periodKey: '2026-01', accountId: '6100', amount: 1000, status: 'APPROVED' }] });
    const create = await page.evaluate(() => window.createBudgetLine({ periodKey: '2026-01', accountId: '6100', amount: 100 }));
    const approve = await page.evaluate(() => window.approveBudgetLine('b1'));
    const lock = await page.evaluate(() => window.lockBudgetLine('b1'));
    expect(create.ok).toBe(false);
    expect(approve.ok).toBe(false);
    expect(lock.ok).toBe(false);
    const writes = await page.evaluate(() => window._writeLog);
    expect(writes).toEqual([]);
  });
});
