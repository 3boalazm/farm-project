// tests/data-integrity/report-validation.spec.js
// Phase 37: regression protection for Report Validation
// (window.validateFinancialReportsCrossConsistency). Cross-checks
// figures computed via genuinely independent code paths.

const { test, expect } = require('../fixtures/farm-test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

async function setupValidationMocks(page, overrides = {}) {
  await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
  await page.goto(`${BASE_URL}/dashboard.html`);
  await page.waitForTimeout(600);
  await page.evaluate((ov) => {
    window.fbGet = async (c) => (ov[c] !== undefined ? ov[c] : []);
    window.fbGetSafe = window.fbGet;   // O-19: reads moved onto fbGetSafe() in the 2026-10 audit; a mock that patches only fbGet leaves it reading the fake database
    window.getUser = () => ({ name: 'T', role: 'admin' });
  }, overrides);
}

const ACCOUNTS = [
  { _id: '1200', code: '1200', name_ar: 'البنك', type: 'ASSET', postable: true },
  { _id: '3100', code: '3100', name_ar: 'رأس مال المالك', type: 'EQUITY', postable: true },
  { _id: '4100', code: '4100', name_ar: 'بيع حيوانات', type: 'REVENUE', postable: true },
  { _id: '6100', code: '6100', name_ar: 'مصروف الأعلاف', type: 'EXPENSE', postable: true },
];

test.describe('Report Validation (Phase 37)', () => {
  test('a consistent ledger passes every cross-check', async ({ page }) => {
    const entries = [
      { _id: 'j1', date: '2026-01-01', lines: [{ accountId: '1200', debit: 10000 }, { accountId: '3100', credit: 10000 }] },
      { _id: 'j2', date: '2026-01-10', lines: [{ accountId: '1200', debit: 4000 }, { accountId: '4100', credit: 4000 }] },
      { _id: 'j3', date: '2026-01-15', lines: [{ accountId: '6100', debit: 1000 }, { accountId: '1200', credit: 1000 }] },
    ];
    await setupValidationMocks(page, { accounts: ACCOUNTS, journal_entries: entries, cash_bank_accounts: [{ _id: 'cba1', linkedAccountId: '1200' }] });
    const r = await page.evaluate(() => window.validateFinancialReportsCrossConsistency('2026-01-31'));
    expect(r.ok).toBe(true);
    expect(r.allPass).toBe(true);
    expect(r.checks.every((c) => c.pass)).toBe(true);
    const earningsCheck = r.checks.find((c) => c.name === 'BALANCE_SHEET_EARNINGS_MATCHES_INCOME_STATEMENT');
    expect(earningsCheck.balanceSheetValue).toBe(3000);
    expect(earningsCheck.incomeStatementValue).toBe(3000);
    const cashCheck = r.checks.find((c) => c.name === 'CASH_FLOW_CLOSING_CASH_MATCHES_BALANCE_SHEET_CASH_ACCOUNTS');
    expect(cashCheck.cashFlowValue).toBe(13000);
    expect(cashCheck.balanceSheetValue).toBe(13000);
  });

  test('skips the cash-flow cross-check gracefully when no cash/bank accounts are defined, without failing the other checks', async ({ page }) => {
    const entries = [{ _id: 'j1', date: '2026-01-01', lines: [{ accountId: '1200', debit: 500 }, { accountId: '3100', credit: 500 }] }];
    await setupValidationMocks(page, { accounts: ACCOUNTS, journal_entries: entries, cash_bank_accounts: [] });
    const r = await page.evaluate(() => window.validateFinancialReportsCrossConsistency('2026-01-31'));
    expect(r.ok).toBe(true);
    expect(r.checks.some((c) => c.name === 'CASH_FLOW_CLOSING_CASH_MATCHES_BALANCE_SHEET_CASH_ACCOUNTS')).toBe(false);
    expect(r.checks.length).toBe(2);
    expect(r.allPass).toBe(true);
  });

  test('missing asOfDate is rejected', async ({ page }) => {
    await setupValidationMocks(page, { accounts: ACCOUNTS, journal_entries: [] });
    const r = await page.evaluate(() => window.validateFinancialReportsCrossConsistency());
    expect(r.ok).toBe(false);
  });

  test('permission: a role without can("finance") is refused', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'S', role: 'supervisor' })));
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForTimeout(600);
    await page.evaluate((ov) => { window.fbGet = async (c) => (ov[c] !== undefined ? ov[c] : []); }, { accounts: ACCOUNTS, journal_entries: [] });
    const r = await page.evaluate(() => window.validateFinancialReportsCrossConsistency('2026-01-31'));
    expect(r.ok).toBe(false);
  });
});
