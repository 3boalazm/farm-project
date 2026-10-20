// tests/data-integrity/labor-costing.spec.js
// Phase 12: regression protection for Labor Costing
// (window.createEmployee / postLaborAccrual / postLaborPayment /
// getEmployeeBalance). Mirrors Accounts Payable (Phase 5) exactly --
// accrual/payment are Phase 2 source documents under the hood.

const { test, expect } = require('../fixtures/farm-test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

async function setupLaborMocks(page, overrides = {}) {
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
  { _id: '6300', code: '6300', name_ar: 'مصروف عمالة', type: 'EXPENSE', postable: true, active: true },
  { _id: '2210', code: '2210', name_ar: 'أجور مستحقة', type: 'LIABILITY', postable: true, active: true },
];

test.describe('Labor Costing (Phase 12)', () => {
  test('createEmployee: creates a record and validates rateType', async ({ page }) => {
    await setupLaborMocks(page, { employees: [] });
    const ok = await page.evaluate(() => window.createEmployee({ name: 'محمد', role: 'راعي', rateType: 'daily', rateAmount: 200 }));
    const bad = await page.evaluate(() => window.createEmployee({ name: 'x', rateType: 'not_a_type' }));
    expect(ok.ok).toBe(true);
    expect(bad.ok).toBe(false);
  });

  test('postLaborAccrual: Debit Labor Expense / Credit Payroll Payable, leaves a real open payable', async ({ page }) => {
    await setupLaborMocks(page, { accounts: ACCOUNTS, source_documents: [] });
    const r = await page.evaluate(() => window.postLaborAccrual({
      employeeId: 'e1', employeeName: 'محمد', amount: 1400, workPeriodStart: '2026-01-01', workPeriodEnd: '2026-01-07',
      costCenterId: 'cc1', operationId: 'acc-1',
    }));
    expect(r.ok).toBe(true);
    expect(r.status).toBe('POSTED'); // accrued, not yet paid
    const jeWrite = await page.evaluate(() => window._writeLog.find((w) => w.c === 'journal_entries'));
    const expLine = jeWrite.d.lines.find((l) => l.accountId === '6300');
    const payableLine = jeWrite.d.lines.find((l) => l.accountId === '2210');
    expect(expLine.debit).toBe(1400);
    expect(expLine.costCenterId).toBe('cc1');
    expect(payableLine.credit).toBe(1400);
  });

  test('postLaborPayment: Debit Payroll Payable / Credit Cash, settles the accrual to PAID', async ({ page }) => {
    const doc = { _id: 'd1', type: 'labor_payment', date: '2026-01-07', total: 1400, paidAmount: 0, remainingAmount: 1400, status: 'POSTED', documentNumber: 'SD-X', journalEntryId: 'j1', counterpartyId: 'e1' };
    await setupLaborMocks(page, { accounts: ACCOUNTS, source_documents: [doc] });
    const r = await page.evaluate(() => window.postLaborPayment('d1', { amount: 1400, cashAccountId: '1110', operationId: 'pay-1' }));
    expect(r.ok).toBe(true);
    expect(r.status).toBe('PAID');
    const jeWrite = await page.evaluate(() => window._writeLog.find((w) => w.c === 'journal_entries'));
    const payableLine = jeWrite.d.lines.find((l) => l.accountId === '2210');
    const cashLine = jeWrite.d.lines.find((l) => l.accountId === '1110');
    expect(payableLine.debit).toBe(1400);
    expect(cashLine.credit).toBe(1400);
  });

  test('postLaborAccrual: idempotent -- replaying the same operationId posts no second journal entry', async ({ page }) => {
    await setupLaborMocks(page, { accounts: ACCOUNTS, source_documents: [] });
    await page.evaluate(() => window.postLaborAccrual({ employeeId: 'e1', amount: 1400, operationId: 'acc-1' }));
    const r2 = await page.evaluate(() => window.postLaborAccrual({ employeeId: 'e1', amount: 1400, operationId: 'acc-1' }));
    expect(r2.idempotent).toBe(true);
    const jeWrites = await page.evaluate(() => window._writeLog.filter((w) => w.c === 'journal_entries'));
    expect(jeWrites.length).toBe(1);
  });

  test('getEmployeeBalance: sums remainingAmount across this employee\'s open accruals only', async ({ page }) => {
    const docs = [
      { _id: 'd1', type: 'labor_payment', status: 'POSTED', remainingAmount: 500, counterpartyId: 'e1' },
      { _id: 'd2', type: 'labor_payment', status: 'PAID', remainingAmount: 0, counterpartyId: 'e1' },
      { _id: 'd3', type: 'labor_payment', status: 'POSTED', remainingAmount: 999, counterpartyId: 'e2' },
    ];
    await setupLaborMocks(page, { source_documents: docs });
    const r = await page.evaluate(() => window.getEmployeeBalance('e1'));
    expect(r.ok).toBe(true);
    expect(r.balance).toBe(500);
    expect(r.openAccrualCount).toBe(1);
  });

  test('permission: a role without can("finance") cannot create an employee, accrue, or pay', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'S', role: 'supervisor' })));
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForTimeout(600);
    await page.evaluate((ov) => {
      window._store = JSON.parse(JSON.stringify(ov));
      window._writeLog = [];
      window.fbGet = async (c) => (window._store[c] !== undefined ? window._store[c] : []);
      window.fbPost = async (c, d) => { window._writeLog.push({ op: 'post', c, d }); return 'id'; };
      window.fbPatch = async (c, id, d) => { window._writeLog.push({ op: 'patch', c, id, d }); };
    }, { accounts: ACCOUNTS, source_documents: [{ _id: 'd1', type: 'labor_payment', status: 'POSTED', total: 100, remainingAmount: 100 }] });
    const employee = await page.evaluate(() => window.createEmployee({ name: 'x' }));
    const accrual = await page.evaluate(() => window.postLaborAccrual({ employeeId: 'e1', amount: 100, operationId: 'x1' }));
    const payment = await page.evaluate(() => window.postLaborPayment('d1', { amount: 100, cashAccountId: '1110', operationId: 'x2' }));
    expect(employee.ok).toBe(false);
    expect(accrual.ok).toBe(false);
    expect(payment.ok).toBe(false);
    const writes = await page.evaluate(() => window._writeLog);
    expect(writes).toEqual([]);
  });
});
