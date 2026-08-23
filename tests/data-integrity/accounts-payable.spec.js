// tests/data-integrity/accounts-payable.spec.js
// Phase 5: regression protection for Accounts Payable
// (window.createSupplier / createPurchaseBill / recordSupplierPayment /
// getSupplierBalance / getSupplierStatement / getAPAging). Mirrors
// accounts-receivable.spec.js exactly, in the opposite direction --
// purchase bills are Phase 2 source documents under the hood.

const { test, expect } = require('@playwright/test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

async function setupAPMocks(page, overrides = {}) {
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
  { _id: '1410', code: '1410', name_ar: 'مخزون الأعلاف', type: 'ASSET', postable: true, active: true },
  { _id: '2100', code: '2100', name_ar: 'ذمم دائنة', type: 'LIABILITY', postable: true, active: true },
];

test.describe('Accounts Payable (Phase 5)', () => {
  test('createSupplier: creates a supplier record', async ({ page }) => {
    await setupAPMocks(page, { suppliers: [] });
    const r = await page.evaluate(() => window.createSupplier({ name: 'مورد الأعلاف' }));
    expect(r.ok).toBe(true);
  });

  test('createPurchaseBill: posts Debit [caller account] / Credit AP', async ({ page }) => {
    await setupAPMocks(page, { accounts: ACCOUNTS, source_documents: [] });
    const r = await page.evaluate(() => window.createPurchaseBill({
      supplierId: 's1', total: 700, dueDate: '2026-02-01', debitAccountId: '1410', operationId: 'bill-1',
    }));
    expect(r.ok).toBe(true);
    const jeWrite = await page.evaluate(() => window._writeLog.find((w) => w.c === 'journal_entries'));
    const invLine = jeWrite.d.lines.find((l) => l.accountId === '1410');
    const apLine = jeWrite.d.lines.find((l) => l.accountId === '2100');
    expect(invLine.debit).toBe(700);
    expect(apLine.credit).toBe(700);
  });

  test('createPurchaseBill: rejects when no debit account is given (never guesses what a bill is for)', async ({ page }) => {
    await setupAPMocks(page, { accounts: ACCOUNTS, source_documents: [] });
    const r = await page.evaluate(() => window.createPurchaseBill({ supplierId: 's1', total: 700, operationId: 'bill-1' }));
    expect(r.ok).toBe(false);
  });

  test('recordSupplierPayment: Debit AP, Credit Cash -- the opposite direction from a customer payment', async ({ page }) => {
    const bill = { _id: 'd1', type: 'purchase_invoice', date: '2026-01-01', total: 700, paidAmount: 0, remainingAmount: 700, status: 'POSTED', documentNumber: 'SD-X', journalEntryId: 'j1', counterpartyId: 's1' };
    await setupAPMocks(page, { accounts: ACCOUNTS, source_documents: [bill] });
    const r = await page.evaluate(() => window.recordSupplierPayment('d1', { amount: 700, cashAccountId: '1110', operationId: 'pay-1' }));
    expect(r.ok).toBe(true);
    expect(r.status).toBe('PAID');
    const jeWrite = await page.evaluate(() => window._writeLog.find((w) => w.c === 'journal_entries'));
    const apLine = jeWrite.d.lines.find((l) => l.accountId === '2100');
    const cashLine = jeWrite.d.lines.find((l) => l.accountId === '1110');
    expect(apLine.debit).toBe(700);
    expect(cashLine.credit).toBe(700);
  });

  test('getSupplierBalance: sums remainingAmount across this supplier\'s open bills only', async ({ page }) => {
    const docs = [
      { _id: 'd1', type: 'purchase_invoice', status: 'POSTED', remainingAmount: 300, counterpartyId: 's1' },
      { _id: 'd2', type: 'purchase_invoice', status: 'PAID', remainingAmount: 0, counterpartyId: 's1' },
      { _id: 'd3', type: 'purchase_invoice', status: 'POSTED', remainingAmount: 999, counterpartyId: 's2' },
    ];
    await setupAPMocks(page, { source_documents: docs });
    const r = await page.evaluate(() => window.getSupplierBalance('s1'));
    expect(r.ok).toBe(true);
    expect(r.balance).toBe(300);
    expect(r.openBillCount).toBe(1);
  });

  test('getAPAging: buckets open bills by days past due (mirrors AR aging)', async ({ page }) => {
    const docs = [
      { _id: 'd1', type: 'purchase_invoice', status: 'POSTED', remainingAmount: 150, dueDate: '2026-01-25' }, // 5 days late
      { _id: 'd2', type: 'purchase_invoice', status: 'POSTED', remainingAmount: 250, dueDate: '2025-10-01' }, // >90 days late
    ];
    await setupAPMocks(page, { source_documents: docs });
    const r = await page.evaluate(() => window.getAPAging('2026-01-30'));
    expect(r.ok).toBe(true);
    expect(r.totals.d1_30).toBe(150);
    expect(r.totals.d90_plus).toBe(250);
  });

  test('refreshOverdueInvoiceStatuses (shared with AR) also flags overdue purchase bills', async ({ page }) => {
    const docs = [{ _id: 'd1', type: 'purchase_invoice', date: '2026-01-01', total: 100, status: 'POSTED', dueDate: '2026-01-10' }];
    await setupAPMocks(page, { source_documents: docs });
    const r = await page.evaluate(() => window.refreshOverdueInvoiceStatuses('2026-01-30'));
    expect(r.ok).toBe(true);
    expect(r.flagged).toBe(1);
  });

  test('permission: a role without can("finance") cannot create a supplier, bill, or payment', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'S', role: 'supervisor' })));
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForTimeout(600);
    await page.evaluate((ov) => {
      window._store = JSON.parse(JSON.stringify(ov));
      window._writeLog = [];
      window.fbGet = async (c) => (window._store[c] !== undefined ? window._store[c] : []);
      window.fbPost = async (c, d) => { window._writeLog.push({ op: 'post', c, d }); return 'id'; };
      window.fbPatch = async (c, id, d) => { window._writeLog.push({ op: 'patch', c, id, d }); };
    }, { accounts: ACCOUNTS, source_documents: [{ _id: 'd1', type: 'purchase_invoice', status: 'POSTED', total: 100, remainingAmount: 100 }] });
    const supplier = await page.evaluate(() => window.createSupplier({ name: 'x' }));
    const bill = await page.evaluate(() => window.createPurchaseBill({ total: 100, debitAccountId: '1410', operationId: 'x' }));
    const payment = await page.evaluate(() => window.recordSupplierPayment('d1', { amount: 100, cashAccountId: '1110', operationId: 'y' }));
    expect(supplier.ok).toBe(false);
    expect(bill.ok).toBe(false);
    expect(payment.ok).toBe(false);
    const writes = await page.evaluate(() => window._writeLog);
    expect(writes).toEqual([]);
  });

  test('permission: a role without can("finance") cannot read a supplier balance or AP aging either', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'S', role: 'supervisor' })));
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForTimeout(600);
    await page.evaluate((ov) => { window.fbGet = async (c) => (ov[c] !== undefined ? ov[c] : []); }, { accounts: ACCOUNTS, source_documents: [] });
    const balance = await page.evaluate(() => window.getSupplierBalance('s1'));
    const aging = await page.evaluate(() => window.getAPAging());
    expect(balance.ok).toBe(false);
    expect(aging.ok).toBe(false);
  });
});
