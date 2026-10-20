// tests/data-integrity/trial-balance.spec.js
// Phase 26: regression protection for the Trial Balance
// (window.getTrialBalance). Literal debit/credit-column format, proves
// totalDebit === totalCredit by construction.

const { test, expect } = require('../fixtures/farm-test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

async function setupTbMocks(page, overrides = {}) {
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
  { _id: '1200', code: '1200', name_ar: 'البنك', type: 'ASSET' },
  { _id: '2100', code: '2100', name_ar: 'ذمم دائنة', type: 'LIABILITY' },
  { _id: '3100', code: '3100', name_ar: 'رأس مال المالك', type: 'EQUITY' },
  { _id: '4100', code: '4100', name_ar: 'بيع حيوانات', type: 'REVENUE' },
  { _id: '6100', code: '6100', name_ar: 'مصروف الأعلاف', type: 'EXPENSE' },
];

test.describe('Trial Balance (Phase 26)', () => {
  test('lists each account under its net debit or credit column, and totalDebit equals totalCredit', async ({ page }) => {
    const entries = [
      { _id: 'j1', date: '2026-01-01', lines: [{ accountId: '1200', debit: 5000 }, { accountId: '3100', credit: 5000 }] },
      { _id: 'j2', date: '2026-01-05', lines: [{ accountId: '1200', debit: 2000 }, { accountId: '4100', credit: 2000 }] },
      { _id: 'j3', date: '2026-01-10', lines: [{ accountId: '6100', debit: 800 }, { accountId: '2100', credit: 800 }] },
    ];
    await setupTbMocks(page, { accounts: ACCOUNTS, journal_entries: entries });
    const r = await page.evaluate(() => window.getTrialBalance('2026-01-31'));
    expect(r.ok).toBe(true);
    const bank = r.rows.find((x) => x.accountId === '1200');
    expect(bank.debit).toBe(7000);
    expect(bank.credit).toBe(0);
    const ap = r.rows.find((x) => x.accountId === '2100');
    expect(ap.debit).toBe(0);
    expect(ap.credit).toBe(800);
    expect(r.totalDebit).toBe(r.totalCredit);
    expect(r.balanced).toBe(true);
  });

  test('a zero-net account is omitted from the rows entirely', async ({ page }) => {
    const entries = [
      { _id: 'j1', date: '2026-01-01', lines: [{ accountId: '1200', debit: 500 }, { accountId: '3100', credit: 500 }] },
      { _id: 'j2', date: '2026-01-05', lines: [{ accountId: '1200', credit: 500 }, { accountId: '3100', debit: 500 }] }, // fully reversed
    ];
    await setupTbMocks(page, { accounts: ACCOUNTS, journal_entries: entries });
    const r = await page.evaluate(() => window.getTrialBalance('2026-01-31'));
    expect(r.rows.find((x) => x.accountId === '1200')).toBeUndefined();
  });

  test('transactions after asOfDate are excluded', async ({ page }) => {
    const entries = [
      { _id: 'j1', date: '2026-01-01', lines: [{ accountId: '1200', debit: 100 }, { accountId: '3100', credit: 100 }] },
      { _id: 'j2', date: '2026-02-01', lines: [{ accountId: '1200', debit: 9000 }, { accountId: '3100', credit: 9000 }] },
    ];
    await setupTbMocks(page, { accounts: ACCOUNTS, journal_entries: entries });
    const r = await page.evaluate(() => window.getTrialBalance('2026-01-31'));
    expect(r.rows.find((x) => x.accountId === '1200').debit).toBe(100);
  });

  test('missing asOfDate is rejected', async ({ page }) => {
    await setupTbMocks(page, { accounts: ACCOUNTS, journal_entries: [] });
    const r = await page.evaluate(() => window.getTrialBalance());
    expect(r.ok).toBe(false);
  });

  test('permission: a role without can("finance") is refused', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'S', role: 'supervisor' })));
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForTimeout(600);
    await page.evaluate((ov) => { window.fbGet = async (c) => (ov[c] !== undefined ? ov[c] : []); }, { accounts: ACCOUNTS, journal_entries: [] });
    const r = await page.evaluate(() => window.getTrialBalance('2026-01-31'));
    expect(r.ok).toBe(false);
  });
});
