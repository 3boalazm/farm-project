// tests/data-integrity/financial-statements.spec.js
// Phase 24: regression protection for the Income Statement and
// Balance Sheet (window.getIncomeStatement / getBalanceSheet). Both
// are purely computed from accounts + journal_entries -- no storage,
// no invented numbers.

const { test, expect } = require('@playwright/test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

async function setupFsMocks(page, overrides = {}) {
  await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
  await page.goto(`${BASE_URL}/dashboard.html`);
  await page.waitForTimeout(600);
  await page.evaluate((ov) => {
    window.fbGet = async (c) => (ov[c] !== undefined ? ov[c] : []);
    window.getUser = () => ({ name: 'T', role: 'admin' });
  }, overrides);
}

const ACCOUNTS = [
  { _id: '1200', code: '1200', name_ar: 'البنك', type: 'ASSET' },
  { _id: '1300', code: '1300', name_ar: 'ذمم مدينة', type: 'ASSET' },
  { _id: '2100', code: '2100', name_ar: 'ذمم دائنة', type: 'LIABILITY' },
  { _id: '3100', code: '3100', name_ar: 'رأس مال المالك', type: 'EQUITY' },
  { _id: '4100', code: '4100', name_ar: 'بيع حيوانات', type: 'REVENUE' },
  { _id: '6100', code: '6100', name_ar: 'مصروف الأعلاف', type: 'EXPENSE' },
];

test.describe('Financial Statements (Phase 24)', () => {
  test('getIncomeStatement: sums revenue and expense within the period only, computes real net income', async ({ page }) => {
    const entries = [
      { _id: 'j1', date: '2026-01-10', lines: [{ accountId: '1200', debit: 1000 }, { accountId: '4100', credit: 1000 }] },
      { _id: 'j2', date: '2026-01-15', lines: [{ accountId: '6100', debit: 300 }, { accountId: '1200', credit: 300 }] },
      { _id: 'j3', date: '2025-12-31', lines: [{ accountId: '4100', credit: 5000 }, { accountId: '1200', debit: 5000 }] }, // out of period
    ];
    await setupFsMocks(page, { accounts: ACCOUNTS, journal_entries: entries });
    const r = await page.evaluate(() => window.getIncomeStatement('2026-01-01', '2026-01-31'));
    expect(r.ok).toBe(true);
    expect(r.totalRevenue).toBe(1000);
    expect(r.totalExpense).toBe(300);
    expect(r.netIncome).toBe(700);
    expect(r.revenue.length).toBe(1);
    expect(r.expense.length).toBe(1);
  });

  test('getBalanceSheet: Assets = Liabilities + Equity always holds, folding in unclosed current-period earnings', async ({ page }) => {
    const entries = [
      { _id: 'j1', date: '2026-01-01', lines: [{ accountId: '1200', debit: 5000 }, { accountId: '3100', credit: 5000 }] }, // owner capital
      { _id: 'j2', date: '2026-01-05', lines: [{ accountId: '1300', debit: 2000 }, { accountId: '4100', credit: 2000 }] }, // sale on credit
      { _id: 'j3', date: '2026-01-10', lines: [{ accountId: '6100', debit: 800 }, { accountId: '2100', credit: 800 }] }, // expense on credit
    ];
    await setupFsMocks(page, { accounts: ACCOUNTS, journal_entries: entries });
    const r = await page.evaluate(() => window.getBalanceSheet('2026-01-31'));
    expect(r.ok).toBe(true);
    expect(r.totalAssets).toBe(7000); // 5000 bank + 2000 AR
    expect(r.totalLiabilities).toBe(800); // AP
    // equity = 5000 capital + (2000 revenue - 800 expense) unclosed earnings = 6200
    expect(r.totalEquity).toBe(6200);
    expect(r.balanced).toBe(true);
    const earningsLine = r.equity.find((e) => e.accountId === null);
    expect(earningsLine.balance).toBe(1200);
  });

  test('getBalanceSheet: transactions after asOfDate are excluded entirely', async ({ page }) => {
    const entries = [
      { _id: 'j1', date: '2026-01-01', lines: [{ accountId: '1200', debit: 1000 }, { accountId: '3100', credit: 1000 }] },
      { _id: 'j2', date: '2026-02-01', lines: [{ accountId: '1200', debit: 9000 }, { accountId: '3100', credit: 9000 }] }, // future
    ];
    await setupFsMocks(page, { accounts: ACCOUNTS, journal_entries: entries });
    const r = await page.evaluate(() => window.getBalanceSheet('2026-01-31'));
    expect(r.totalAssets).toBe(1000);
  });

  test('getIncomeStatement/getBalanceSheet: missing required params are rejected', async ({ page }) => {
    await setupFsMocks(page, { accounts: ACCOUNTS, journal_entries: [] });
    const r1 = await page.evaluate(() => window.getIncomeStatement('2026-01-01'));
    const r2 = await page.evaluate(() => window.getBalanceSheet());
    expect(r1.ok).toBe(false);
    expect(r2.ok).toBe(false);
  });

  test('permission: a role without can("finance") is refused for both statements', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'S', role: 'supervisor' })));
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForTimeout(600);
    await page.evaluate((ov) => { window.fbGet = async (c) => (ov[c] !== undefined ? ov[c] : []); }, { accounts: ACCOUNTS, journal_entries: [] });
    const r1 = await page.evaluate(() => window.getIncomeStatement('2026-01-01', '2026-01-31'));
    const r2 = await page.evaluate(() => window.getBalanceSheet('2026-01-31'));
    expect(r1.ok).toBe(false);
    expect(r2.ok).toBe(false);
  });
});
