// tests/data-integrity/dashboard-kpis.spec.js
// Phase 28: regression protection for the Management Dashboard KPIs
// (window.getFinancialDashboardKPIs). Pure composition over Phases
// 22/24/26 -- never recalculates their outputs itself.

const { test, expect } = require('@playwright/test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

async function setupKpiMocks(page, overrides = {}) {
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
  { _id: '3100', code: '3100', name_ar: 'رأس مال المالك', type: 'EQUITY' },
  { _id: '4100', code: '4100', name_ar: 'بيع حيوانات', type: 'REVENUE' },
  { _id: '6100', code: '6100', name_ar: 'مصروف الأعلاف', type: 'EXPENSE' },
];

test.describe('Management Dashboard KPIs (Phase 28)', () => {
  test('composes revenue/expense/netIncome (from Income Statement) with assets/liabilities/equity (from Balance Sheet) and real ratios', async ({ page }) => {
    const entries = [
      { _id: 'j1', date: '2026-01-01', lines: [{ accountId: '1200', debit: 10000 }, { accountId: '3100', credit: 10000 }] },
      { _id: 'j2', date: '2026-01-10', lines: [{ accountId: '1200', debit: 4000 }, { accountId: '4100', credit: 4000 }] },
      { _id: 'j3', date: '2026-01-15', lines: [{ accountId: '6100', debit: 1000 }, { accountId: '1200', credit: 1000 }] },
    ];
    await setupKpiMocks(page, { accounts: ACCOUNTS, journal_entries: entries, cash_bank_accounts: [{ _id: 'cba1', linkedAccountId: '1200' }] });
    const r = await page.evaluate(() => window.getFinancialDashboardKPIs('2026-01-01', '2026-01-31'));
    expect(r.ok).toBe(true);
    expect(r.revenue).toBe(4000);
    expect(r.expense).toBe(1000);
    expect(r.netIncome).toBe(3000);
    expect(r.totalAssets).toBe(13000); // 10000 + 4000 - 1000
    expect(r.netProfitMarginPercent).toBe(75); // 3000/4000 * 100
    expect(r.ledgerBalanced).toBe(true);
    // netCashFlow includes ALL real cash movement in the period, not just
    // net income -- the 10000 owner-capital injection (j1) is a real
    // financing inflow too: 10000 + 4000 - 1000 = 13000.
    expect(r.netCashFlow).toBe(13000);
    expect(r.debtToEquityRatio).toBe(0);
    expect(r.returnOnAssetsPercent).toBe(23.08); // 3000/13000 * 100, rounded
  });

  test('a zero-revenue period returns netProfitMarginPercent null, never a fabricated number or Infinity', async ({ page }) => {
    const entries = [{ _id: 'j1', date: '2026-01-10', lines: [{ accountId: '6100', debit: 300 }, { accountId: '1200', credit: 300 }] }];
    await setupKpiMocks(page, { accounts: ACCOUNTS, journal_entries: entries, cash_bank_accounts: [] });
    const r = await page.evaluate(() => window.getFinancialDashboardKPIs('2026-01-01', '2026-01-31'));
    expect(r.revenue).toBe(0);
    expect(r.netProfitMarginPercent).toBeNull();
  });

  test('missing cash/bank accounts does not fail the whole dashboard -- netCashFlow/closingCash are just null', async ({ page }) => {
    await setupKpiMocks(page, { accounts: ACCOUNTS, journal_entries: [], cash_bank_accounts: [] });
    const r = await page.evaluate(() => window.getFinancialDashboardKPIs('2026-01-01', '2026-01-31'));
    expect(r.ok).toBe(true);
    expect(r.netCashFlow).toBeNull();
    expect(r.closingCash).toBeNull();
  });

  test('missing required params is rejected', async ({ page }) => {
    await setupKpiMocks(page, { accounts: ACCOUNTS, journal_entries: [] });
    const r = await page.evaluate(() => window.getFinancialDashboardKPIs('2026-01-01'));
    expect(r.ok).toBe(false);
  });

  test('permission: a role without can("finance") is refused', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'S', role: 'supervisor' })));
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForTimeout(600);
    await page.evaluate((ov) => { window.fbGet = async (c) => (ov[c] !== undefined ? ov[c] : []); }, { accounts: ACCOUNTS, journal_entries: [] });
    const r = await page.evaluate(() => window.getFinancialDashboardKPIs('2026-01-01', '2026-01-31'));
    expect(r.ok).toBe(false);
  });
});
