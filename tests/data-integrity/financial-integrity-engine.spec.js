// tests/data-integrity/financial-integrity-engine.spec.js
// Phase 33: regression protection for the Financial Integrity Engine
// (window.getFinancialIntegrityStatus). Pure composition over Phases
// 24/26/29 -- never recalculates their outputs itself.

const { test, expect } = require('../fixtures/farm-test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

async function setupIntegrityMocks(page, overrides = {}) {
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
];

test.describe('Financial Integrity Engine (Phase 33)', () => {
  test('a clean, consistent ledger reports healthy:true with zero issues and both balanced flags true', async ({ page }) => {
    const entries = [{ _id: 'j1', date: '2020-01-01', lines: [{ accountId: '1200', debit: 1000 }, { accountId: '3100', credit: 1000 }] }];
    const docs = [{ _id: 'd1', status: 'POSTED', journalEntryId: 'j1', operationId: 'op1' }];
    await setupIntegrityMocks(page, { accounts: ACCOUNTS, journal_entries: entries, source_documents: docs });
    const r = await page.evaluate(() => window.getFinancialIntegrityStatus());
    expect(r.ok).toBe(true);
    expect(r.healthy).toBe(true);
    expect(r.dataQualityIssueCount).toBe(0);
    expect(r.trialBalanceBalanced).toBe(true);
    expect(r.balanceSheetBalanced).toBe(true);
  });

  test('a data-quality issue (unknown account referenced) flips healthy to false and surfaces the real issue list', async ({ page }) => {
    const entries = [{ _id: 'j1', date: '2020-01-01', lines: [{ accountId: '9999', debit: 100 }, { accountId: '3100', credit: 100 }] }];
    await setupIntegrityMocks(page, { accounts: ACCOUNTS, journal_entries: entries, source_documents: [] });
    const r = await page.evaluate(() => window.getFinancialIntegrityStatus());
    expect(r.healthy).toBe(false);
    expect(r.dataQualityIssueCount).toBeGreaterThan(0);
    expect(r.dataQualityIssues.some((i) => i.type === 'UNKNOWN_ACCOUNT')).toBe(true);
  });

  test('permission: a role without can("finance") is refused', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'S', role: 'supervisor' })));
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForTimeout(600);
    await page.evaluate((ov) => { window.fbGet = async (c) => (ov[c] !== undefined ? ov[c] : []); }, { accounts: ACCOUNTS, journal_entries: [], source_documents: [] });
    const r = await page.evaluate(() => window.getFinancialIntegrityStatus());
    expect(r.ok).toBe(false);
  });
});
