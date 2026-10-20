// tests/data-integrity/loans.spec.js
// Phase 15: regression protection for Loans
// (window.postLoanReceipt / postLoanPrincipalPayment /
// postLoanInterestPayment / getLoanRemainingPrincipal /
// getInterestPaidOnLoan).

const { test, expect } = require('../fixtures/farm-test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

async function setupLoanMocks(page, overrides = {}) {
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
  { _id: '2300', code: '2300', name_ar: 'قروض وتمويل', type: 'LIABILITY', postable: true, active: true },
  { _id: '6850', code: '6850', name_ar: 'فوائد قروض', type: 'EXPENSE', postable: true, active: true },
];

test.describe('Loans (Phase 15)', () => {
  test('postLoanReceipt: Debit Cash / Credit Loans-and-Financing (2300), never revenue', async ({ page }) => {
    await setupLoanMocks(page, { accounts: ACCOUNTS, source_documents: [], loans: [] });
    const r = await page.evaluate(() => window.postLoanReceipt({
      lenderName: 'بنك التنمية الزراعية', principalAmount: 50000, cashAccountId: '1110', operationId: 'ln-1',
    }));
    expect(r.ok).toBe(true);
    const jeWrite = await page.evaluate(() => window._writeLog.find((w) => w.c === 'journal_entries'));
    const cashLine = jeWrite.d.lines.find((l) => l.accountId === '1110');
    const loanLine = jeWrite.d.lines.find((l) => l.accountId === '2300');
    expect(cashLine.debit).toBe(50000);
    expect(loanLine.credit).toBe(50000);
    // Confirm no revenue account (4xxx) is touched anywhere in this entry.
    expect(jeWrite.d.lines.every((l) => !l.accountId.startsWith('4'))).toBe(true);
  });

  test('postLoanPrincipalPayment: Debit 2300 / Credit Cash, reduces remaining principal, never touches 6850', async ({ page }) => {
    const loan = { _id: 'ln1', lenderName: 'x', principalAmount: 50000, status: 'active' };
    await setupLoanMocks(page, { accounts: ACCOUNTS, loans: [loan], journal_entries: [] });
    const r = await page.evaluate(() => window.postLoanPrincipalPayment({ loanId: 'ln1', amount: 10000, cashAccountId: '1110', operationId: 'pp-1' }));
    expect(r.ok).toBe(true);
    expect(r.remainingAfter).toBe(40000);
    const jeWrite = await page.evaluate(() => window._writeLog.find((w) => w.c === 'journal_entries'));
    const loanLine = jeWrite.d.lines.find((l) => l.accountId === '2300');
    const cashLine = jeWrite.d.lines.find((l) => l.accountId === '1110');
    expect(loanLine.debit).toBe(10000);
    expect(cashLine.credit).toBe(10000);
    expect(jeWrite.d.lines.some((l) => l.accountId === '6850')).toBe(false);
    const balance = await page.evaluate(() => window.getLoanRemainingPrincipal('ln1'));
    expect(balance.remainingPrincipal).toBe(40000);
  });

  test('postLoanPrincipalPayment: paying off the full remaining balance marks the loan paid_off', async ({ page }) => {
    const loan = { _id: 'ln1', lenderName: 'x', principalAmount: 5000, status: 'active' };
    await setupLoanMocks(page, { accounts: ACCOUNTS, loans: [loan], journal_entries: [] });
    await page.evaluate(() => window.postLoanPrincipalPayment({ loanId: 'ln1', amount: 5000, cashAccountId: '1110', operationId: 'pp-1' }));
    const loanAfter = await page.evaluate(() => window._store.loans.find((l) => l._id === 'ln1'));
    expect(loanAfter.status).toBe('paid_off');
  });

  test('postLoanPrincipalPayment: refuses to pay more than the real remaining principal', async ({ page }) => {
    const loan = { _id: 'ln1', lenderName: 'x', principalAmount: 5000, status: 'active' };
    await setupLoanMocks(page, { accounts: ACCOUNTS, loans: [loan], journal_entries: [] });
    const r = await page.evaluate(() => window.postLoanPrincipalPayment({ loanId: 'ln1', amount: 6000, cashAccountId: '1110', operationId: 'pp-1' }));
    expect(r.ok).toBe(false);
  });

  test('postLoanPrincipalPayment: idempotent -- replaying the same operationId does not reduce the balance twice', async ({ page }) => {
    const loan = { _id: 'ln1', lenderName: 'x', principalAmount: 50000, status: 'active' };
    await setupLoanMocks(page, { accounts: ACCOUNTS, loans: [loan], journal_entries: [] });
    await page.evaluate(() => window.postLoanPrincipalPayment({ loanId: 'ln1', amount: 10000, cashAccountId: '1110', operationId: 'pp-1' }));
    const r2 = await page.evaluate(() => window.postLoanPrincipalPayment({ loanId: 'ln1', amount: 10000, cashAccountId: '1110', operationId: 'pp-1' }));
    expect(r2.idempotent).toBe(true);
    const balance = await page.evaluate(() => window.getLoanRemainingPrincipal('ln1'));
    expect(balance.remainingPrincipal).toBe(40000); // NOT 30000
  });

  test('postLoanInterestPayment: Debit 6850 / Credit Cash, never touches 2300 or the principal balance', async ({ page }) => {
    const loan = { _id: 'ln1', lenderName: 'x', principalAmount: 50000, status: 'active' };
    await setupLoanMocks(page, { accounts: ACCOUNTS, loans: [loan], journal_entries: [] });
    const r = await page.evaluate(() => window.postLoanInterestPayment({ loanId: 'ln1', amount: 300, cashAccountId: '1110', operationId: 'ip-1' }));
    expect(r.ok).toBe(true);
    const jeWrite = await page.evaluate(() => window._writeLog.find((w) => w.c === 'journal_entries'));
    const intLine = jeWrite.d.lines.find((l) => l.accountId === '6850');
    const cashLine = jeWrite.d.lines.find((l) => l.accountId === '1110');
    expect(intLine.debit).toBe(300);
    expect(cashLine.credit).toBe(300);
    expect(jeWrite.d.lines.some((l) => l.accountId === '2300')).toBe(false);
    const principal = await page.evaluate(() => window.getLoanRemainingPrincipal('ln1'));
    expect(principal.remainingPrincipal).toBe(50000); // completely unaffected by interest
    const interestTotal = await page.evaluate(() => window.getInterestPaidOnLoan('ln1'));
    expect(interestTotal.totalInterestPaid).toBe(300);
  });

  test('postLoanInterestPayment: idempotent', async ({ page }) => {
    const loan = { _id: 'ln1', lenderName: 'x', principalAmount: 50000, status: 'active' };
    await setupLoanMocks(page, { accounts: ACCOUNTS, loans: [loan], journal_entries: [] });
    await page.evaluate(() => window.postLoanInterestPayment({ loanId: 'ln1', amount: 300, cashAccountId: '1110', operationId: 'ip-1' }));
    const r2 = await page.evaluate(() => window.postLoanInterestPayment({ loanId: 'ln1', amount: 300, cashAccountId: '1110', operationId: 'ip-1' }));
    expect(r2.idempotent).toBe(true);
    const interestTotal = await page.evaluate(() => window.getInterestPaidOnLoan('ln1'));
    expect(interestTotal.totalInterestPaid).toBe(300); // NOT 600
  });

  test('permission: a role without can("finance") cannot receive a loan or make either kind of payment', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'S', role: 'supervisor' })));
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForTimeout(600);
    await page.evaluate((ov) => {
      window._store = JSON.parse(JSON.stringify(ov));
      window._writeLog = [];
      window.fbGet = async (c) => (window._store[c] !== undefined ? window._store[c] : []);
      window.fbPost = async (c, d) => { window._writeLog.push({ op: 'post', c, d }); return 'id'; };
      window.fbPatch = async (c, id, d) => { window._writeLog.push({ op: 'patch', c, id, d }); };
    }, { accounts: ACCOUNTS, loans: [{ _id: 'ln1', lenderName: 'x', principalAmount: 1000 }] });
    const receipt = await page.evaluate(() => window.postLoanReceipt({ lenderName: 'x', principalAmount: 1000, cashAccountId: '1110', operationId: 'x1' }));
    const principal = await page.evaluate(() => window.postLoanPrincipalPayment({ loanId: 'ln1', amount: 100, cashAccountId: '1110', operationId: 'x2' }));
    const interest = await page.evaluate(() => window.postLoanInterestPayment({ loanId: 'ln1', amount: 10, cashAccountId: '1110', operationId: 'x3' }));
    expect(receipt.ok).toBe(false);
    expect(principal.ok).toBe(false);
    expect(interest.ok).toBe(false);
    const writes = await page.evaluate(() => window._writeLog);
    expect(writes).toEqual([]);
  });
});
