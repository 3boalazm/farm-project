// tests/data-integrity/accounts-receivable.spec.js
// Phase 4: regression protection for Accounts Receivable
// (window.createCustomer / createSalesInvoice / recordCustomerPayment /
// getCustomerBalance / getCustomerStatement / getARAging /
// refreshOverdueInvoiceStatuses). Sales invoices are Phase 2 source
// documents under the hood -- posting/idempotency/immutability are not
// re-tested here, only the AR-specific recipe and reporting.

const { test, expect } = require('../fixtures/farm-test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

async function setupARMocks(page, overrides = {}) {
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
  { _id: '1300', code: '1300', name_ar: 'ذمم مدينة', type: 'ASSET', postable: true, active: true },
  { _id: '4100', code: '4100', name_ar: 'بيع حيوانات', type: 'REVENUE', postable: true, active: true },
];

test.describe('Accounts Receivable (Phase 4)', () => {
  test('createCustomer: creates a customer record', async ({ page }) => {
    await setupARMocks(page, { customers: [] });
    const r = await page.evaluate(() => window.createCustomer({ name: 'أحمد', phone: '0100' }));
    expect(r.ok).toBe(true);
  });

  test('createSalesInvoice: posts Debit AR / Credit the given revenue account', async ({ page }) => {
    await setupARMocks(page, { accounts: ACCOUNTS, source_documents: [] });
    const r = await page.evaluate(() => window.createSalesInvoice({
      customerId: 'c1', total: 1000, dueDate: '2026-02-01', revenueAccountId: '4100', operationId: 'inv-1',
    }));
    expect(r.ok).toBe(true);
    expect(r.status).toBe('POSTED');
    const jeWrite = await page.evaluate(() => window._writeLog.find((w) => w.c === 'journal_entries'));
    const arLine = jeWrite.d.lines.find((l) => l.accountId === '1300');
    const revLine = jeWrite.d.lines.find((l) => l.accountId === '4100');
    expect(arLine.debit).toBe(1000);
    expect(revLine.credit).toBe(1000);
  });

  test('recordCustomerPayment: Debit Cash, Credit AR, moves the invoice toward PAID', async ({ page }) => {
    const invoice = { _id: 'd1', type: 'sales_invoice', date: '2026-01-01', total: 1000, paidAmount: 0, remainingAmount: 1000, status: 'POSTED', documentNumber: 'SD-X', journalEntryId: 'j1', counterpartyId: 'c1' };
    await setupARMocks(page, { accounts: ACCOUNTS, source_documents: [invoice] });
    const r = await page.evaluate(() => window.recordCustomerPayment('d1', { amount: 1000, cashAccountId: '1110', operationId: 'pay-1' }));
    expect(r.ok).toBe(true);
    expect(r.status).toBe('PAID');
    const jeWrite = await page.evaluate(() => window._writeLog.find((w) => w.c === 'journal_entries'));
    const cashLine = jeWrite.d.lines.find((l) => l.accountId === '1110');
    const arLine = jeWrite.d.lines.find((l) => l.accountId === '1300');
    expect(cashLine.debit).toBe(1000);
    expect(arLine.credit).toBe(1000);
  });

  test('getCustomerBalance: sums remainingAmount across this customer\'s open invoices only', async ({ page }) => {
    const docs = [
      { _id: 'd1', type: 'sales_invoice', status: 'POSTED', remainingAmount: 400, counterpartyId: 'c1' },
      { _id: 'd2', type: 'sales_invoice', status: 'PARTIALLY_PAID', remainingAmount: 200, counterpartyId: 'c1' },
      { _id: 'd3', type: 'sales_invoice', status: 'PAID', remainingAmount: 0, counterpartyId: 'c1' },
      { _id: 'd4', type: 'sales_invoice', status: 'POSTED', remainingAmount: 999, counterpartyId: 'c2' },
    ];
    await setupARMocks(page, { source_documents: docs });
    const r = await page.evaluate(() => window.getCustomerBalance('c1'));
    expect(r.ok).toBe(true);
    expect(r.balance).toBe(600);
    expect(r.openInvoiceCount).toBe(2);
  });

  test('getCustomerStatement: returns only this customer\'s sales invoices, sorted by date', async ({ page }) => {
    const docs = [
      { _id: 'd1', type: 'sales_invoice', date: '2026-02-01', counterpartyId: 'c1' },
      { _id: 'd2', type: 'sales_invoice', date: '2026-01-01', counterpartyId: 'c1' },
      { _id: 'd3', type: 'purchase_invoice', date: '2026-01-15', counterpartyId: 'c1' },
    ];
    await setupARMocks(page, { source_documents: docs });
    const r = await page.evaluate(() => window.getCustomerStatement('c1'));
    expect(r.ok).toBe(true);
    expect(r.invoices.length).toBe(2);
    expect(r.invoices[0]._id).toBe('d2');
    expect(r.invoices[1]._id).toBe('d1');
  });

  test('getARAging: buckets open invoices by days past due, and never treats a missing due date as overdue', async ({ page }) => {
    const docs = [
      { _id: 'd1', type: 'sales_invoice', status: 'POSTED', remainingAmount: 100, dueDate: '2026-01-25' }, // 5 days late as of 01-30
      { _id: 'd2', type: 'sales_invoice', status: 'POSTED', remainingAmount: 200, dueDate: '2025-10-01' }, // >90 days late
      { _id: 'd3', type: 'sales_invoice', status: 'POSTED', remainingAmount: 50, dueDate: null },          // no due date
      { _id: 'd4', type: 'sales_invoice', status: 'POSTED', remainingAmount: 999, dueDate: '2026-02-15' }, // not yet due
    ];
    await setupARMocks(page, { source_documents: docs });
    const r = await page.evaluate(() => window.getARAging('2026-01-30'));
    expect(r.ok).toBe(true);
    expect(r.totals.d1_30).toBe(100);
    expect(r.totals.d90_plus).toBe(200);
    expect(r.totals.noDueDate).toBe(50);
    expect(r.totals.current).toBe(999);
  });

  test('refreshOverdueInvoiceStatuses: flags only POSTED/PARTIALLY_PAID invoices whose due date has passed, leaves type/date/total untouched', async ({ page }) => {
    const docs = [
      { _id: 'd1', type: 'sales_invoice', date: '2026-01-01', total: 100, status: 'POSTED', dueDate: '2026-01-10' },
      { _id: 'd2', type: 'sales_invoice', date: '2026-01-01', total: 200, status: 'POSTED', dueDate: '2026-02-10' }, // not due yet
      { _id: 'd3', type: 'sales_invoice', date: '2026-01-01', total: 300, status: 'PAID', dueDate: '2026-01-05' },   // already settled
    ];
    await setupARMocks(page, { source_documents: docs });
    const r = await page.evaluate(() => window.refreshOverdueInvoiceStatuses('2026-01-30'));
    expect(r.ok).toBe(true);
    expect(r.flagged).toBe(1);
    const patch = await page.evaluate(() => window._writeLog.find((w) => w.c === 'source_documents' && w.id === 'd1'));
    expect(patch.d.status).toBe('OVERDUE');
    expect(patch.d.type).toBeUndefined();
    expect(patch.d.total).toBeUndefined();
  });

  test('permission: a role without can("finance") cannot create a customer, invoice, or payment', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'S', role: 'supervisor' })));
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForTimeout(600);
    await page.evaluate((ov) => {
      window._store = JSON.parse(JSON.stringify(ov));
      window._writeLog = [];
      window.fbGet = async (c) => (window._store[c] !== undefined ? window._store[c] : []);
      window.fbGetSafe = window.fbGet;   // O-19: reads moved onto fbGetSafe() in the 2026-10 audit; a mock that patches only fbGet leaves it reading the fake database
      window.fbPost = async (c, d) => { window._writeLog.push({ op: 'post', c, d }); return 'id'; };
      window.fbPatch = async (c, id, d) => { window._writeLog.push({ op: 'patch', c, id, d }); };
    }, { accounts: ACCOUNTS, source_documents: [{ _id: 'd1', type: 'sales_invoice', status: 'POSTED', total: 100, remainingAmount: 100 }] });
    const customer = await page.evaluate(() => window.createCustomer({ name: 'x' }));
    const invoice = await page.evaluate(() => window.createSalesInvoice({ total: 100, revenueAccountId: '4100', operationId: 'x' }));
    const payment = await page.evaluate(() => window.recordCustomerPayment('d1', { amount: 100, cashAccountId: '1110', operationId: 'y' }));
    expect(customer.ok).toBe(false);
    expect(invoice.ok).toBe(false);
    expect(payment.ok).toBe(false);
    const writes = await page.evaluate(() => window._writeLog);
    expect(writes).toEqual([]);
  });

  test('permission: a role without can("finance") cannot read a customer balance or AR aging either', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'S', role: 'supervisor' })));
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForTimeout(600);
    await page.evaluate((ov) => { window.fbGet = async (c) => (ov[c] !== undefined ? ov[c] : []); }, { accounts: ACCOUNTS, source_documents: [] });
    const balance = await page.evaluate(() => window.getCustomerBalance('c1'));
    const aging = await page.evaluate(() => window.getARAging());
    expect(balance.ok).toBe(false);
    expect(aging.ok).toBe(false);
  });
});
