// tests/data-integrity/bank-reconciliation.spec.js
// Phase 23: regression protection for Bank Reconciliation
// (window.reconcileBankAccount / getBankReconciliationHistory).

const { test, expect } = require('../fixtures/farm-test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

async function setupReconMocks(page, overrides = {}) {
  await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
  await page.goto(`${BASE_URL}/dashboard.html`);
  await page.waitForTimeout(600);
  await page.evaluate((ov) => {
    window._store = JSON.parse(JSON.stringify(ov));
    window._writeLog = [];
    window.fbGet = async (c) => (window._store[c] !== undefined ? window._store[c] : []);
    window.fbGetSafe = window.fbGet;   // O-19: reads moved onto fbGetSafe() in the 2026-10 audit; a mock that patches only fbGet leaves it reading the fake database
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

const CBA = [{ _id: 'cba1', name: 'بنك', linkedAccountId: '1200' }];

test.describe('Bank Reconciliation (Phase 23)', () => {
  test('a clean reconciliation (all transactions cleared, statement matches) reports difference 0 and matched:true', async ({ page }) => {
    const entries = [
      { _id: 'j1', date: '2026-01-05', lines: [{ accountId: '1200', debit: 1000 }] },
      { _id: 'j2', date: '2026-01-10', lines: [{ accountId: '1200', credit: 200 }] },
    ];
    await setupReconMocks(page, { cash_bank_accounts: CBA, journal_entries: entries, bank_reconciliations: [] });
    const r = await page.evaluate(() => window.reconcileBankAccount({
      operationId: 'op1', cashBankAccountId: 'cba1', statementDate: '2026-01-31', statementBalance: 800,
      clearedJournalEntryIds: ['j1', 'j2'],
    }));
    expect(r.ok).toBe(true);
    expect(r.bookBalance).toBe(800);
    expect(r.clearedBalance).toBe(800);
    expect(r.difference).toBe(0);
    expect(r.matched).toBe(true);
    expect(r.outstandingItems).toEqual([]);
    const patch = await page.evaluate(() => window._writeLog.find((w) => w.op === 'patch' && w.c === 'cash_bank_accounts'));
    expect(patch.d.lastReconciledDate).toBe('2026-01-31');
  });

  test('an uncleared outstanding item (e.g. a check not yet cashed) is reported, not silently dropped, and a real discrepancy shows a non-zero difference', async ({ page }) => {
    const entries = [
      { _id: 'j1', date: '2026-01-05', lines: [{ accountId: '1200', debit: 1000 }] },
      { _id: 'j2', date: '2026-01-20', lines: [{ accountId: '1200', credit: 300 }] }, // not yet cleared by the bank
    ];
    await setupReconMocks(page, { cash_bank_accounts: CBA, journal_entries: entries, bank_reconciliations: [] });
    const r = await page.evaluate(() => window.reconcileBankAccount({
      operationId: 'op1', cashBankAccountId: 'cba1', statementDate: '2026-01-31', statementBalance: 1000,
      clearedJournalEntryIds: ['j1'],
    }));
    expect(r.ok).toBe(true);
    expect(r.bookBalance).toBe(700); // 1000 - 300, full book balance regardless of clearance
    expect(r.clearedBalance).toBe(1000); // only j1
    expect(r.difference).toBe(0); // statement 1000 == cleared 1000 -- the bank hasn't seen j2 yet, which is correct
    expect(r.outstandingItems.length).toBe(1);
    expect(r.outstandingItems[0].journalEntryId).toBe('j2');
  });

  test('a genuine discrepancy (statement does not match cleared transactions) is reported plainly, never forced to zero', async ({ page }) => {
    const entries = [{ _id: 'j1', date: '2026-01-05', lines: [{ accountId: '1200', debit: 1000 }] }];
    await setupReconMocks(page, { cash_bank_accounts: CBA, journal_entries: entries, bank_reconciliations: [] });
    const r = await page.evaluate(() => window.reconcileBankAccount({
      operationId: 'op1', cashBankAccountId: 'cba1', statementDate: '2026-01-31', statementBalance: 950, // bank says 950, books say 1000
      clearedJournalEntryIds: ['j1'],
    }));
    expect(r.ok).toBe(true);
    expect(r.clearedBalance).toBe(1000);
    expect(r.difference).toBe(-50);
    expect(r.matched).toBe(false);
  });

  test('transactions dated after the statement date are excluded entirely from bookBalance', async ({ page }) => {
    const entries = [
      { _id: 'j1', date: '2026-01-05', lines: [{ accountId: '1200', debit: 500 }] },
      { _id: 'j2', date: '2026-02-05', lines: [{ accountId: '1200', debit: 5000 }] }, // future, out of scope
    ];
    await setupReconMocks(page, { cash_bank_accounts: CBA, journal_entries: entries, bank_reconciliations: [] });
    const r = await page.evaluate(() => window.reconcileBankAccount({
      operationId: 'op1', cashBankAccountId: 'cba1', statementDate: '2026-01-31', statementBalance: 500, clearedJournalEntryIds: ['j1'],
    }));
    expect(r.bookBalance).toBe(500);
  });

  test('rejects with no operationId', async ({ page }) => {
    await setupReconMocks(page, { cash_bank_accounts: CBA, journal_entries: [], bank_reconciliations: [] });
    const r = await page.evaluate(() => window.reconcileBankAccount({ cashBankAccountId: 'cba1', statementDate: '2026-01-31', statementBalance: 0, clearedJournalEntryIds: [] }));
    expect(r.ok).toBe(false);
  });

  test('idempotent: a retried call with the same operationId returns the existing reconciliation, no duplicate created or double-patch of the account', async ({ page }) => {
    const entries = [{ _id: 'j1', date: '2026-01-05', lines: [{ accountId: '1200', debit: 300 }] }];
    await setupReconMocks(page, { cash_bank_accounts: CBA, journal_entries: entries, bank_reconciliations: [] });
    const opts = { operationId: 'op-retry', cashBankAccountId: 'cba1', statementDate: '2026-01-31', statementBalance: 300, clearedJournalEntryIds: ['j1'] };
    const r1 = await page.evaluate((o) => window.reconcileBankAccount(o), opts);
    const r2 = await page.evaluate((o) => window.reconcileBankAccount(o), opts);
    expect(r2.idempotent).toBe(true);
    expect(r2.id).toBe(r1.id);
    const posts = await page.evaluate(() => window._writeLog.filter((w) => w.op === 'post' && w.c === 'bank_reconciliations'));
    const patches = await page.evaluate(() => window._writeLog.filter((w) => w.op === 'patch' && w.c === 'cash_bank_accounts'));
    expect(posts.length).toBe(1);
    expect(patches.length).toBe(1);
  });

  test('getBankReconciliationHistory: returns only this account\'s reconciliations, newest statementDate first', async ({ page }) => {
    const recs = [
      { _id: 'r1', cashBankAccountId: 'cba1', statementDate: '2026-01-31' },
      { _id: 'r2', cashBankAccountId: 'cba1', statementDate: '2026-02-28' },
      { _id: 'r3', cashBankAccountId: 'cbaOther', statementDate: '2026-03-31' },
    ];
    await setupReconMocks(page, { bank_reconciliations: recs });
    const r = await page.evaluate(() => window.getBankReconciliationHistory('cba1'));
    expect(r.length).toBe(2);
    expect(r[0]._id).toBe('r2');
    expect(r[1]._id).toBe('r1');
  });

  test('permission: a role without can("finance") cannot reconcile', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'S', role: 'supervisor' })));
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForTimeout(600);
    await page.evaluate((ov) => {
      window._writeLog = [];
      window.fbGet = async (c) => (ov[c] !== undefined ? ov[c] : []);
      window.fbGetSafe = window.fbGet;   // O-19: reads moved onto fbGetSafe() in the 2026-10 audit; a mock that patches only fbGet leaves it reading the fake database
      window.fbPost = async (c, d) => { window._writeLog.push({ op: 'post', c, d }); return 'id'; };
      window.fbPatch = async (c, id, d) => { window._writeLog.push({ op: 'patch', c, id, d }); };
    }, { cash_bank_accounts: CBA, journal_entries: [] });
    const r = await page.evaluate(() => window.reconcileBankAccount({
      operationId: 'op1', cashBankAccountId: 'cba1', statementDate: '2026-01-31', statementBalance: 0, clearedJournalEntryIds: [],
    }));
    expect(r.ok).toBe(false);
    const writes = await page.evaluate(() => window._writeLog);
    expect(writes).toEqual([]);
  });

  test('permission: a role without can("finance") gets an empty array from getBankReconciliationHistory, not real data (preserves the function\'s plain-array contract -- ok:false would break every caller\'s .length/.map usage)', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'S', role: 'supervisor' })));
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForTimeout(600);
    await page.evaluate((ov) => { window.fbGet = async (c) => (ov[c] !== undefined ? ov[c] : []); }, { bank_reconciliations: [{ _id: 'r1', cashBankAccountId: 'cba1', statementDate: '2026-01-31' }] });
    const r = await page.evaluate(() => window.getBankReconciliationHistory('cba1'));
    expect(r).toEqual([]);
  });
});
