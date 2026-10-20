// tests/data-integrity/cash-flow.spec.js
// Phase 22: regression protection for the Cash Flow Statement
// (window.getCashFlowStatement). Direct-method, evidence-only --
// classifies real cash/bank journal lines by their real counter-account,
// never a derived indirect-method reconciliation.

const { test, expect } = require('../fixtures/farm-test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

async function setupCashFlowMocks(page, overrides = {}) {
  await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
  await page.goto(`${BASE_URL}/dashboard.html`);
  await page.waitForTimeout(600);
  await page.evaluate((ov) => {
    window._store = JSON.parse(JSON.stringify(ov));
    window.fbGet = async (c) => (window._store[c] !== undefined ? window._store[c] : []);
    window.getUser = () => ({ name: 'T', role: 'admin' });
  }, overrides);
}

const CBA = [{ _id: 'cba1', name: 'بنك', linkedAccountId: '1200' }];

test.describe('Cash Flow Statement (Phase 22)', () => {
  test('classifies a revenue receipt as operating and a fixed-asset purchase as investing', async ({ page }) => {
    const entries = [
      // opening balance before the window -- included in openingCash only
      { _id: 'j0', date: '2025-12-01', lines: [{ accountId: '1200', debit: 500 }, { accountId: '3300', credit: 500 }] },
      // real operating inflow: animal sale collected into bank
      { _id: 'j1', date: '2026-01-05', lines: [{ accountId: '1200', debit: 1000 }, { accountId: '4100', credit: 1000 }] },
      // real investing outflow: buying a fixed asset with cash
      { _id: 'j2', date: '2026-01-10', lines: [{ accountId: '1600', debit: 400 }, { accountId: '1200', credit: 400 }] },
    ];
    await setupCashFlowMocks(page, { cash_bank_accounts: CBA, journal_entries: entries });
    const r = await page.evaluate(() => window.getCashFlowStatement('2026-01-01', '2026-01-31'));
    expect(r.ok).toBe(true);
    expect(r.openingCash).toBe(500);
    expect(r.operating).toBe(1000);
    expect(r.investing).toBe(-400);
    expect(r.financing).toBe(0);
    expect(r.netCashFlow).toBe(600);
    expect(r.closingCash).toBe(1100); // 500 + 600
  });

  test('a pure cash-to-cash transfer between two cash/bank accounts nets to zero and is excluded entirely', async ({ page }) => {
    const cbas = [{ _id: 'cba1', name: 'بنك', linkedAccountId: '1200' }, { _id: 'cba2', name: 'نقدية', linkedAccountId: '1110' }];
    const entries = [
      { _id: 'j1', date: '2026-01-05', lines: [{ accountId: '1110', debit: 200 }, { accountId: '1200', credit: 200 }] },
    ];
    await setupCashFlowMocks(page, { cash_bank_accounts: cbas, journal_entries: entries });
    const r = await page.evaluate(() => window.getCashFlowStatement('2026-01-01', '2026-01-31'));
    expect(r.ok).toBe(true);
    expect(r.movements.length).toBe(0);
    expect(r.netCashFlow).toBe(0);
  });

  test('a loan principal repayment is classified as financing, a loan receipt as financing inflow', async ({ page }) => {
    const entries = [
      { _id: 'j1', date: '2026-01-05', lines: [{ accountId: '1200', debit: 5000 }, { accountId: '2300', credit: 5000 }] }, // loan received
      { _id: 'j2', date: '2026-01-15', lines: [{ accountId: '2300', debit: 800 }, { accountId: '1200', credit: 800 }] }, // principal repaid
    ];
    await setupCashFlowMocks(page, { cash_bank_accounts: CBA, journal_entries: entries });
    const r = await page.evaluate(() => window.getCashFlowStatement('2026-01-01', '2026-01-31'));
    expect(r.financing).toBe(4200); // 5000 - 800
    expect(r.operating).toBe(0);
    expect(r.investing).toBe(0);
  });

  test('a mixed entry (cash offset by both an operating and an investing counter-line) splits proportionally by real weight and still reconciles exactly', async ({ page }) => {
    const entries = [
      // one payment covering both a feed expense (600) and a fixed-asset purchase (400) -- 1000 cash out
      { _id: 'j1', date: '2026-01-05', lines: [{ accountId: '6100', debit: 600 }, { accountId: '1600', debit: 400 }, { accountId: '1200', credit: 1000 }] },
    ];
    await setupCashFlowMocks(page, { cash_bank_accounts: CBA, journal_entries: entries });
    const r = await page.evaluate(() => window.getCashFlowStatement('2026-01-01', '2026-01-31'));
    expect(r.operating).toBe(-600);
    expect(r.investing).toBe(-400);
    expect(r.operating + r.investing + r.financing).toBe(r.netCashFlow);
    expect(r.netCashFlow).toBe(-1000);
  });

  test('with no cash/bank accounts defined, returns an explicit error rather than a silent zero report', async ({ page }) => {
    await setupCashFlowMocks(page, { cash_bank_accounts: [], journal_entries: [] });
    const r = await page.evaluate(() => window.getCashFlowStatement('2026-01-01', '2026-01-31'));
    expect(r.ok).toBe(false);
  });

  test('permission: a role without can("finance") is refused', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'S', role: 'supervisor' })));
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForTimeout(600);
    await page.evaluate((ov) => {
      window.fbGet = async (c) => (ov[c] !== undefined ? ov[c] : []);
    }, { cash_bank_accounts: CBA, journal_entries: [] });
    const r = await page.evaluate(() => window.getCashFlowStatement('2026-01-01', '2026-01-31'));
    expect(r.ok).toBe(false);
  });
});
