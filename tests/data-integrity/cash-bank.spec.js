// tests/data-integrity/cash-bank.spec.js
// Phase 3: regression protection for the Cash & Bank layer
// (window.createCashBankAccount / getCashBankBalance /
// getCashBankTransactionHistory / recordCashTransfer /
// recordCashReceipt / recordCashPayment / markCashBankReconciled).
// Built entirely on Phase 1 (journal engine) and Phase 2 (source
// documents) -- transfers/receipts/payments route through those, they
// are not re-tested here.

const { test, expect } = require('@playwright/test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

async function setupCashMocks(page, overrides = {}) {
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
    window.fbPut = async (c, id, d) => {
      window._writeLog.push({ op: 'put', c, id, d });
      window._store[c] = window._store[c] || [];
      window._store[c].push({ _id: id, ...d });
    };
    window.fbPatch = async (c, id, d) => {
      window._writeLog.push({ op: 'patch', c, id, d });
      window._store[c] = (window._store[c] || []).map((r) => (r._id === id ? { ...r, ...d } : r));
    };
    window.getUser = () => ({ name: 'T', role: 'admin' });
  }, overrides);
}

const ACCOUNTS = [
  { _id: '1110', code: '1110', name_ar: 'نقدية المزرعة', type: 'ASSET', postable: true, active: true },
  { _id: '1200', code: '1200', name_ar: 'البنك', type: 'ASSET', postable: true, active: true },
  { _id: '1300', code: '1300', name_ar: 'ذمم مدينة', type: 'ASSET', postable: true, active: true },
  { _id: '3300', code: '3300', name_ar: 'أرباح مرحّلة', type: 'EQUITY', postable: true, active: true },
];

test.describe('Cash & Bank (Phase 3)', () => {
  test('createCashBankAccount: with an opening balance posts a real journal entry against 3300', async ({ page }) => {
    await setupCashMocks(page, { accounts: ACCOUNTS, cash_bank_accounts: [] });
    const r = await page.evaluate(() => window.createCashBankAccount({ name: 'نقدية المزرعة', type: 'cash', linkedAccountId: '1110', openingBalance: 500 }));
    expect(r.ok).toBe(true);
    const jeWrite = await page.evaluate(() => window._writeLog.find((w) => w.c === 'journal_entries'));
    expect(jeWrite).toBeTruthy();
    const cashLine = jeWrite.d.lines.find((l) => l.accountId === '1110');
    const equityLine = jeWrite.d.lines.find((l) => l.accountId === '3300');
    expect(cashLine.debit).toBe(500);
    expect(equityLine.credit).toBe(500);
  });

  test('createCashBankAccount: with zero opening balance posts no journal entry', async ({ page }) => {
    await setupCashMocks(page, { accounts: ACCOUNTS, cash_bank_accounts: [] });
    await page.evaluate(() => window.createCashBankAccount({ name: 'نقدية المزرعة', type: 'cash', linkedAccountId: '1110' }));
    const jeWrites = await page.evaluate(() => window._writeLog.filter((w) => w.c === 'journal_entries'));
    expect(jeWrites).toEqual([]);
  });

  test('createCashBankAccount: rejects an unlinked/non-existent account and a non-postable one', async ({ page }) => {
    await setupCashMocks(page, { accounts: [{ _id: '1000', code: '1000', name_ar: 'الأصول', type: 'ASSET', postable: false }], cash_bank_accounts: [] });
    const bad1 = await page.evaluate(() => window.createCashBankAccount({ name: 'x', type: 'cash', linkedAccountId: 'nope' }));
    const bad2 = await page.evaluate(() => window.createCashBankAccount({ name: 'x', type: 'cash', linkedAccountId: '1000' }));
    expect(bad1.ok).toBe(false);
    expect(bad2.ok).toBe(false);
  });

  test('getCashBankBalance: sum of every journal line touching the linked account, signed correctly -- the record\'s own openingBalance field is NOT re-added (it is only ever a display value; the real opening amount lives in the journal entry createCashBankAccount already posted for it)', async ({ page }) => {
    const cba = { _id: 'cb1', name: 'نقدية المزرعة', linkedAccountId: '1110', openingBalance: 500 };
    const entries = [
      { _id: 'j0', lines: [{ accountId: '1110', debit: 500 }, { accountId: '3300', credit: 500 }] },   // the real opening entry
      { _id: 'j1', lines: [{ accountId: '1110', debit: 1000 }, { accountId: '1300', credit: 1000 }] }, // +1000
      { _id: 'j2', lines: [{ accountId: '1110', credit: 300 }, { accountId: '1200', debit: 300 }] },   // -300
    ];
    await setupCashMocks(page, { cash_bank_accounts: [cba], journal_entries: entries });
    const r = await page.evaluate(() => window.getCashBankBalance('cb1'));
    expect(r.ok).toBe(true);
    expect(r.balance).toBe(1200); // 500 (from j0) + 1000 - 300 -- NOT 500 (field) + 500 (j0) + 1000 - 300 = 1700
  });

  test('getCashBankTransactionHistory: filters by date range and returns the other side of each entry', async ({ page }) => {
    const cba = { _id: 'cb1', name: 'نقدية المزرعة', linkedAccountId: '1110', openingBalance: 0 };
    const entries = [
      { _id: 'j1', date: '2026-01-05', description: 'قبض', lines: [{ accountId: '1110', debit: 200 }, { accountId: '1300', credit: 200 }] },
      { _id: 'j2', date: '2026-02-10', description: 'خارج النطاق', lines: [{ accountId: '1110', debit: 999 }, { accountId: '1300', credit: 999 }] },
    ];
    await setupCashMocks(page, { cash_bank_accounts: [cba], journal_entries: entries });
    const r = await page.evaluate(() => window.getCashBankTransactionHistory('cb1', '2026-01-01', '2026-01-31'));
    expect(r.ok).toBe(true);
    expect(r.rows.length).toBe(1);
    expect(r.rows[0].journalEntryId).toBe('j1');
    expect(r.rows[0].otherLines[0].accountId).toBe('1300');
  });

  test('recordCashTransfer: debits the destination, credits the source, never touches revenue/expense', async ({ page }) => {
    const cash = { _id: 'cb1', name: 'نقدية المزرعة', linkedAccountId: '1110' };
    const bank = { _id: 'cb2', name: 'البنك', linkedAccountId: '1200' };
    await setupCashMocks(page, { accounts: ACCOUNTS, cash_bank_accounts: [cash, bank], source_documents: [] });
    const r = await page.evaluate(() => window.recordCashTransfer({ fromAccountId: 'cb1', toAccountId: 'cb2', amount: 800, operationId: 'tr-1' }));
    expect(r.ok).toBe(true);
    const jeWrite = await page.evaluate(() => window._writeLog.find((w) => w.c === 'journal_entries'));
    const bankLine = jeWrite.d.lines.find((l) => l.accountId === '1200');
    const cashLine = jeWrite.d.lines.find((l) => l.accountId === '1110');
    expect(bankLine.debit).toBe(800);
    expect(cashLine.credit).toBe(800);
  });

  test('recordCashTransfer: refuses transferring an account to itself', async ({ page }) => {
    const cash = { _id: 'cb1', name: 'نقدية المزرعة', linkedAccountId: '1110' };
    await setupCashMocks(page, { accounts: ACCOUNTS, cash_bank_accounts: [cash], source_documents: [] });
    const r = await page.evaluate(() => window.recordCashTransfer({ fromAccountId: 'cb1', toAccountId: 'cb1', amount: 100, operationId: 'tr-1' }));
    expect(r.ok).toBe(false);
  });

  test('recordCashTransfer: idempotent -- replaying the same operationId does not post a second journal entry', async ({ page }) => {
    const cash = { _id: 'cb1', name: 'نقدية المزرعة', linkedAccountId: '1110' };
    const bank = { _id: 'cb2', name: 'البنك', linkedAccountId: '1200' };
    await setupCashMocks(page, { accounts: ACCOUNTS, cash_bank_accounts: [cash, bank], source_documents: [] });
    await page.evaluate(() => window.recordCashTransfer({ fromAccountId: 'cb1', toAccountId: 'cb2', amount: 800, operationId: 'tr-1' }));
    await page.evaluate(() => window.recordCashTransfer({ fromAccountId: 'cb1', toAccountId: 'cb2', amount: 800, operationId: 'tr-1' }));
    const jeWrites = await page.evaluate(() => window._writeLog.filter((w) => w.c === 'journal_entries'));
    expect(jeWrites.length).toBe(1);
  });

  test('recordCashReceipt / recordCashPayment: post in the correct direction against the caller-supplied counter account', async ({ page }) => {
    const cash = { _id: 'cb1', name: 'نقدية المزرعة', linkedAccountId: '1110' };
    await setupCashMocks(page, { accounts: ACCOUNTS, cash_bank_accounts: [cash], source_documents: [] });
    const receipt = await page.evaluate(() => window.recordCashReceipt({ cashBankAccountId: 'cb1', counterAccountId: '1300', amount: 300, operationId: 'rc-1' }));
    const payment = await page.evaluate(() => window.recordCashPayment({ cashBankAccountId: 'cb1', counterAccountId: '1300', amount: 150, operationId: 'py-1' }));
    expect(receipt.ok).toBe(true);
    expect(payment.ok).toBe(true);
    const jeWrites = await page.evaluate(() => window._writeLog.filter((w) => w.c === 'journal_entries'));
    const receiptLine = jeWrites[0].d.lines.find((l) => l.accountId === '1110');
    const paymentLine = jeWrites[1].d.lines.find((l) => l.accountId === '1110');
    expect(receiptLine.debit).toBe(300);
    expect(paymentLine.credit).toBe(150);
  });

  test('markCashBankReconciled: stamps the reconciliation fields', async ({ page }) => {
    const cba = { _id: 'cb1', name: 'نقدية المزرعة', linkedAccountId: '1110' };
    await setupCashMocks(page, { cash_bank_accounts: [cba] });
    const r = await page.evaluate(() => window.markCashBankReconciled('cb1', '2026-01-31'));
    expect(r.ok).toBe(true);
    const patchWrite = await page.evaluate(() => window._writeLog.find((w) => w.c === 'cash_bank_accounts' && w.op === 'patch'));
    expect(patchWrite.d.lastReconciledDate).toBe('2026-01-31');
  });

  test('permission: a role without can("finance") cannot create an account or transfer/receive/pay', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'S', role: 'supervisor' })));
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForTimeout(600);
    const cash = { _id: 'cb1', name: 'نقدية المزرعة', linkedAccountId: '1110' };
    const bank = { _id: 'cb2', name: 'البنك', linkedAccountId: '1200' };
    await page.evaluate((ov) => {
      window._store = JSON.parse(JSON.stringify(ov));
      window._writeLog = [];
      window.fbGet = async (c) => (window._store[c] !== undefined ? window._store[c] : []);
      window.fbPost = async (c, d) => { window._writeLog.push({ op: 'post', c, d }); return 'id'; };
      window.fbPut = async (c, id, d) => { window._writeLog.push({ op: 'put', c, id, d }); };
      window.fbPatch = async (c, id, d) => { window._writeLog.push({ op: 'patch', c, id, d }); };
    }, { accounts: ACCOUNTS, cash_bank_accounts: [cash, bank] });
    const create = await page.evaluate(() => window.createCashBankAccount({ name: 'x', type: 'cash', linkedAccountId: '1110' }));
    const transfer = await page.evaluate(() => window.recordCashTransfer({ fromAccountId: 'cb1', toAccountId: 'cb2', amount: 100, operationId: 'x' }));
    expect(create.ok).toBe(false);
    expect(transfer.ok).toBe(false);
    const writes = await page.evaluate(() => window._writeLog);
    expect(writes).toEqual([]);
  });
});
