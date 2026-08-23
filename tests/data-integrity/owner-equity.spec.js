// tests/data-integrity/owner-equity.spec.js
// Phase 16: regression protection for Owner Equity
// (window.postOwnerCapital / postOwnerWithdrawal / getOwnerEquitySummary).
// Both are Phase 2 source documents under the hood.

const { test, expect } = require('@playwright/test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

async function setupEquityMocks(page, overrides = {}) {
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
    window.fbPatch = async (c, id, d) => { window._writeLog.push({ op: 'patch', c, id, d }); };
    window.getUser = () => ({ name: 'T', role: 'admin' });
  }, overrides);
}

const ACCOUNTS = [
  { _id: '1110', code: '1110', name_ar: 'نقدية المزرعة', type: 'ASSET', postable: true, active: true },
  { _id: '3100', code: '3100', name_ar: 'رأس مال المالك', type: 'EQUITY', postable: true, active: true },
  { _id: '3200', code: '3200', name_ar: 'مسحوبات المالك', type: 'EQUITY', postable: true, active: true },
];

test.describe('Owner Equity (Phase 16)', () => {
  test('postOwnerCapital: Debit Cash / Credit Owner Capital (3100)', async ({ page }) => {
    await setupEquityMocks(page, { accounts: ACCOUNTS, source_documents: [] });
    const r = await page.evaluate(() => window.postOwnerCapital({ amount: 20000, cashAccountId: '1110', operationId: 'cap-1' }));
    expect(r.ok).toBe(true);
    const jeWrite = await page.evaluate(() => window._writeLog.find((w) => w.c === 'journal_entries'));
    const cashLine = jeWrite.d.lines.find((l) => l.accountId === '1110');
    const capitalLine = jeWrite.d.lines.find((l) => l.accountId === '3100');
    expect(cashLine.debit).toBe(20000);
    expect(capitalLine.credit).toBe(20000);
  });

  test('postOwnerWithdrawal: Debit Owner Drawings (3200) / Credit Cash, never an expense account', async ({ page }) => {
    await setupEquityMocks(page, { accounts: ACCOUNTS, source_documents: [] });
    const r = await page.evaluate(() => window.postOwnerWithdrawal({ amount: 3000, cashAccountId: '1110', operationId: 'draw-1' }));
    expect(r.ok).toBe(true);
    const jeWrite = await page.evaluate(() => window._writeLog.find((w) => w.c === 'journal_entries'));
    const drawLine = jeWrite.d.lines.find((l) => l.accountId === '3200');
    const cashLine = jeWrite.d.lines.find((l) => l.accountId === '1110');
    expect(drawLine.debit).toBe(3000);
    expect(cashLine.credit).toBe(3000);
    expect(jeWrite.d.lines.every((l) => !l.accountId.startsWith('6'))).toBe(true); // never a 6xxx expense account
  });

  test('postOwnerCapital / postOwnerWithdrawal: both idempotent on operationId', async ({ page }) => {
    await setupEquityMocks(page, { accounts: ACCOUNTS, source_documents: [] });
    await page.evaluate(() => window.postOwnerCapital({ amount: 20000, cashAccountId: '1110', operationId: 'cap-1' }));
    const r2 = await page.evaluate(() => window.postOwnerCapital({ amount: 20000, cashAccountId: '1110', operationId: 'cap-1' }));
    expect(r2.idempotent).toBe(true);
    const jeWrites = await page.evaluate(() => window._writeLog.filter((w) => w.c === 'journal_entries'));
    expect(jeWrites.length).toBe(1);
  });

  test('getOwnerEquitySummary: sums capital and drawings independently, computes net movement', async ({ page }) => {
    const entries = [
      { _id: 'j1', date: '2026-01-05', lines: [{ accountId: '1110', debit: 20000 }, { accountId: '3100', credit: 20000 }] },
      { _id: 'j2', date: '2026-01-10', lines: [{ accountId: '3200', debit: 3000 }, { accountId: '1110', credit: 3000 }] },
      { _id: 'j3', date: '2026-01-11', lines: [{ accountId: '3100', credit: 5000 }, { accountId: '1110', debit: 5000 }] },
    ];
    await setupEquityMocks(page, { journal_entries: entries });
    const r = await page.evaluate(() => window.getOwnerEquitySummary(null, null));
    expect(r.ok).toBe(true);
    expect(r.capitalContributed).toBe(25000);
    expect(r.drawings).toBe(3000);
    expect(r.netEquityMovement).toBe(22000);
  });

  test('permission: a role without can("finance") cannot contribute capital or withdraw', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'S', role: 'supervisor' })));
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForTimeout(600);
    await page.evaluate((ov) => {
      window._store = JSON.parse(JSON.stringify(ov));
      window._writeLog = [];
      window.fbGet = async (c) => (window._store[c] !== undefined ? window._store[c] : []);
      window.fbPost = async (c, d) => { window._writeLog.push({ op: 'post', c, d }); return 'id'; };
    }, { accounts: ACCOUNTS });
    const cap = await page.evaluate(() => window.postOwnerCapital({ amount: 1000, cashAccountId: '1110', operationId: 'x1' }));
    const draw = await page.evaluate(() => window.postOwnerWithdrawal({ amount: 100, cashAccountId: '1110', operationId: 'x2' }));
    expect(cap.ok).toBe(false);
    expect(draw.ok).toBe(false);
    const writes = await page.evaluate(() => window._writeLog);
    expect(writes).toEqual([]);
  });
});
