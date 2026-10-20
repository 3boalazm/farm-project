// tests/data-integrity/general-ledger.spec.js
// Phase 25: regression protection for the General Ledger
// (window.getAccountLedger). Generalizes the Phase 3 cash/bank
// transaction-history pattern to any account, signed in the
// account's own normal-balance direction.

const { test, expect } = require('../fixtures/farm-test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

async function setupLedgerMocks(page, overrides = {}) {
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
  { _id: '2100', code: '2100', name_ar: 'ذمم دائنة', type: 'LIABILITY' },
];

test.describe('General Ledger (Phase 25)', () => {
  test('an ASSET account (debit-normal): opening balance carries forward, running balance accumulates debit-positive', async ({ page }) => {
    const entries = [
      { _id: 'j0', date: '2025-12-15', lines: [{ accountId: '1200', debit: 1000 }] }, // before window -- opening only
      { _id: 'j1', date: '2026-01-05', lines: [{ accountId: '1200', debit: 500 }] },
      { _id: 'j2', date: '2026-01-10', lines: [{ accountId: '1200', credit: 200 }] },
    ];
    await setupLedgerMocks(page, { accounts: ACCOUNTS, journal_entries: entries });
    const r = await page.evaluate(() => window.getAccountLedger('1200', '2026-01-01', '2026-01-31'));
    expect(r.ok).toBe(true);
    expect(r.normalBalance).toBe('debit');
    expect(r.openingBalance).toBe(1000);
    expect(r.rows.length).toBe(2);
    expect(r.rows[0].runningBalance).toBe(1500);
    expect(r.rows[1].runningBalance).toBe(1300);
    expect(r.closingBalance).toBe(1300);
  });

  test('a LIABILITY account (credit-normal): a credit increases the displayed running balance, a debit decreases it', async ({ page }) => {
    const entries = [
      { _id: 'j1', date: '2026-01-05', lines: [{ accountId: '2100', credit: 800 }] }, // owed more -- should INCREASE displayed balance
      { _id: 'j2', date: '2026-01-10', lines: [{ accountId: '2100', debit: 300 }] }, // paid down -- should DECREASE it
    ];
    await setupLedgerMocks(page, { accounts: ACCOUNTS, journal_entries: entries });
    const r = await page.evaluate(() => window.getAccountLedger('2100', '2026-01-01', '2026-01-31'));
    expect(r.normalBalance).toBe('credit');
    expect(r.openingBalance).toBe(0);
    expect(r.rows[0].runningBalance).toBe(800);
    expect(r.rows[1].runningBalance).toBe(500);
    expect(r.closingBalance).toBe(500);
  });

  test('an unknown accountId is rejected', async ({ page }) => {
    await setupLedgerMocks(page, { accounts: ACCOUNTS, journal_entries: [] });
    const r = await page.evaluate(() => window.getAccountLedger('9999', '2026-01-01', '2026-01-31'));
    expect(r.ok).toBe(false);
  });

  test('permission: a role without can("finance") is refused', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'S', role: 'supervisor' })));
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForTimeout(600);
    await page.evaluate((ov) => { window.fbGet = async (c) => (ov[c] !== undefined ? ov[c] : []); }, { accounts: ACCOUNTS, journal_entries: [] });
    const r = await page.evaluate(() => window.getAccountLedger('1200', '2026-01-01', '2026-01-31'));
    expect(r.ok).toBe(false);
  });
});
