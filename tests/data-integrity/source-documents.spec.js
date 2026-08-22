// tests/data-integrity/source-documents.spec.js
// Phase 2: regression protection for the Source Documents layer
// (window.createSourceDocument / postSourceDocument /
// recordPaymentAgainstDocument / voidSourceDocument /
// cancelPostedSourceDocument, shared.js). Builds on Phase 1's journal
// engine (postJournalEntry/reverseJournalEntry) -- does not re-test those
// directly, see accounting-engine.spec.js for that coverage.

const { test, expect } = require('@playwright/test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

async function setupDocMocks(page, overrides = {}) {
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
  { _id: '1300', code: '1300', name_ar: 'ذمم مدينة', type: 'ASSET', postable: true, active: true },
  { _id: '4100', code: '4100', name_ar: 'بيع حيوانات', type: 'REVENUE', postable: true, active: true },
];

test.describe('Source Documents (Phase 2)', () => {
  test('createSourceDocument: creates a DRAFT document with a generated number', async ({ page }) => {
    await setupDocMocks(page, { accounts: ACCOUNTS, source_documents: [] });
    const r = await page.evaluate(() => window.createSourceDocument({ type: 'sales_invoice', total: 1000, operationId: 'op-1' }));
    expect(r.ok).toBe(true);
    expect(r.document.status).toBe('DRAFT');
    expect(r.document.remainingAmount).toBe(1000);
    expect(r.document.documentNumber).toMatch(/^SD-/);
  });

  test('createSourceDocument: idempotent -- replaying the same operationId returns the existing document, no duplicate', async ({ page }) => {
    const existing = { _id: 'd1', type: 'sales_invoice', total: 1000, operationId: 'op-1', status: 'DRAFT', documentNumber: 'SD-SALE-X' };
    await setupDocMocks(page, { accounts: ACCOUNTS, source_documents: [existing] });
    const r = await page.evaluate(() => window.createSourceDocument({ type: 'sales_invoice', total: 1000, operationId: 'op-1' }));
    expect(r.ok).toBe(true);
    expect(r.idempotent).toBe(true);
    expect(r.id).toBe('d1');
    const writes = await page.evaluate(() => window._writeLog);
    expect(writes.filter((w) => w.c === 'source_documents')).toEqual([]);
  });

  test('createSourceDocument: rejects an invalid type and a non-positive total', async ({ page }) => {
    await setupDocMocks(page, { accounts: ACCOUNTS, source_documents: [] });
    const badType = await page.evaluate(() => window.createSourceDocument({ type: 'not_a_type', total: 100, operationId: 'op-1' }));
    const badTotal = await page.evaluate(() => window.createSourceDocument({ type: 'sales_invoice', total: 0, operationId: 'op-2' }));
    expect(badType.ok).toBe(false);
    expect(badTotal.ok).toBe(false);
  });

  test('postSourceDocument: posts a balanced journal entry via the debit/credit shorthand and moves status to POSTED', async ({ page }) => {
    const doc = { _id: 'd1', type: 'sales_invoice', date: '2026-01-01', total: 1000, paidAmount: 0, remainingAmount: 1000, status: 'DRAFT', documentNumber: 'SD-SALE-X' };
    await setupDocMocks(page, { accounts: ACCOUNTS, source_documents: [doc] });
    const r = await page.evaluate(() => window.postSourceDocument('d1', { debitAccountId: '1300', creditAccountId: '4100' }));
    expect(r.ok).toBe(true);
    expect(r.status).toBe('POSTED');
    const jeWrite = await page.evaluate(() => window._writeLog.find((w) => w.c === 'journal_entries'));
    expect(jeWrite.d.totalDebit).toBe(1000);
    expect(jeWrite.d.totalCredit).toBe(1000);
  });

  test('postSourceDocument: refuses to post a document that is not DRAFT', async ({ page }) => {
    const doc = { _id: 'd1', type: 'sales_invoice', date: '2026-01-01', total: 1000, status: 'POSTED', documentNumber: 'SD-SALE-X' };
    await setupDocMocks(page, { accounts: ACCOUNTS, source_documents: [doc] });
    const r = await page.evaluate(() => window.postSourceDocument('d1', { debitAccountId: '1300', creditAccountId: '4100' }));
    expect(r.ok).toBe(false);
  });

  test('recordPaymentAgainstDocument: full payment moves the document to PAID and posts Debit Cash / Credit AR', async ({ page }) => {
    const doc = { _id: 'd1', type: 'sales_invoice', date: '2026-01-01', total: 1000, paidAmount: 0, remainingAmount: 1000, status: 'POSTED', documentNumber: 'SD-SALE-X', journalEntryId: 'j1' };
    await setupDocMocks(page, { accounts: ACCOUNTS, source_documents: [doc] });
    const r = await page.evaluate(() => window.recordPaymentAgainstDocument('d1', {
      amount: 1000, cashAccountId: '1110', counterAccountId: '1300', direction: 'receive', operationId: 'pay-1',
    }));
    expect(r.ok).toBe(true);
    expect(r.status).toBe('PAID');
    expect(r.remainingAmount).toBe(0);
    const jeWrite = await page.evaluate(() => window._writeLog.find((w) => w.c === 'journal_entries'));
    const cashLine = jeWrite.d.lines.find((l) => l.accountId === '1110');
    const arLine = jeWrite.d.lines.find((l) => l.accountId === '1300');
    expect(cashLine.debit).toBe(1000);
    expect(arLine.credit).toBe(1000);
  });

  test('recordPaymentAgainstDocument: partial payment moves status to PARTIALLY_PAID with correct remaining balance', async ({ page }) => {
    const doc = { _id: 'd1', type: 'sales_invoice', date: '2026-01-01', total: 1000, paidAmount: 0, remainingAmount: 1000, status: 'POSTED', documentNumber: 'SD-SALE-X', journalEntryId: 'j1' };
    await setupDocMocks(page, { accounts: ACCOUNTS, source_documents: [doc] });
    const r = await page.evaluate(() => window.recordPaymentAgainstDocument('d1', {
      amount: 400, cashAccountId: '1110', counterAccountId: '1300', direction: 'receive', operationId: 'pay-1',
    }));
    expect(r.ok).toBe(true);
    expect(r.status).toBe('PARTIALLY_PAID');
    expect(r.remainingAmount).toBe(600);
  });

  test('recordPaymentAgainstDocument: idempotent -- replaying the same payment operationId does not double-apply', async ({ page }) => {
    const doc = {
      _id: 'd1', type: 'sales_invoice', date: '2026-01-01', total: 1000, paidAmount: 400, remainingAmount: 600,
      status: 'PARTIALLY_PAID', documentNumber: 'SD-SALE-X', journalEntryId: 'j1',
      appliedPayments: { 'pay-1': { amount: 400, date: '2026-01-01', journalEntryId: 'j2' } },
    };
    await setupDocMocks(page, { accounts: ACCOUNTS, source_documents: [doc] });
    const r = await page.evaluate(() => window.recordPaymentAgainstDocument('d1', {
      amount: 400, cashAccountId: '1110', counterAccountId: '1300', direction: 'receive', operationId: 'pay-1',
    }));
    expect(r.ok).toBe(true);
    expect(r.idempotent).toBe(true);
    const writes = await page.evaluate(() => window._writeLog);
    expect(writes.filter((w) => w.c === 'journal_entries')).toEqual([]);
  });

  test('recordPaymentAgainstDocument: rejects an amount larger than the remaining balance', async ({ page }) => {
    const doc = { _id: 'd1', type: 'sales_invoice', date: '2026-01-01', total: 1000, paidAmount: 0, remainingAmount: 1000, status: 'POSTED', documentNumber: 'SD-SALE-X', journalEntryId: 'j1' };
    await setupDocMocks(page, { accounts: ACCOUNTS, source_documents: [doc] });
    const r = await page.evaluate(() => window.recordPaymentAgainstDocument('d1', {
      amount: 1500, cashAccountId: '1110', counterAccountId: '1300', direction: 'receive', operationId: 'pay-1',
    }));
    expect(r.ok).toBe(false);
  });

  test('voidSourceDocument: voids a DRAFT document; refuses a POSTED one', async ({ page }) => {
    const draft = { _id: 'd1', type: 'sales_invoice', total: 1000, status: 'DRAFT', documentNumber: 'SD-SALE-X' };
    const posted = { _id: 'd2', type: 'sales_invoice', total: 1000, status: 'POSTED', documentNumber: 'SD-SALE-Y', journalEntryId: 'j1' };
    await setupDocMocks(page, { accounts: ACCOUNTS, source_documents: [draft, posted] });
    const rDraft = await page.evaluate(() => window.voidSourceDocument('d1'));
    const rPosted = await page.evaluate(() => window.voidSourceDocument('d2'));
    expect(rDraft.ok).toBe(true);
    expect(rPosted.ok).toBe(false);
  });

  test('cancelPostedSourceDocument: reverses the linked journal entry and marks the document CANCELLED', async ({ page }) => {
    const doc = { _id: 'd1', type: 'sales_invoice', total: 1000, paidAmount: 0, status: 'POSTED', documentNumber: 'SD-SALE-X', journalEntryId: 'j1' };
    const je = { _id: 'j1', status: 'POSTED', lines: [{ accountId: '1300', debit: 1000 }, { accountId: '4100', credit: 1000 }] };
    await setupDocMocks(page, { accounts: ACCOUNTS, source_documents: [doc], journal_entries: [je] });
    const r = await page.evaluate(() => window.cancelPostedSourceDocument('d1'));
    expect(r.ok).toBe(true);
    const reversalWrite = await page.evaluate(() => window._writeLog.find((w) => w.c === 'journal_entries' && w.d.reversesJournalEntryId === 'j1'));
    expect(reversalWrite).toBeTruthy();
  });

  test('cancelPostedSourceDocument: refuses when a payment has already been applied', async ({ page }) => {
    const doc = { _id: 'd1', type: 'sales_invoice', total: 1000, paidAmount: 400, status: 'PARTIALLY_PAID', documentNumber: 'SD-SALE-X', journalEntryId: 'j1' };
    await setupDocMocks(page, { accounts: ACCOUNTS, source_documents: [doc] });
    const r = await page.evaluate(() => window.cancelPostedSourceDocument('d1'));
    expect(r.ok).toBe(false);
  });

  test('permission: a role without can("finance") cannot create, post, pay, void, or cancel', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'S', role: 'supervisor' })));
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForTimeout(600);
    await page.evaluate((ov) => {
      window._store = JSON.parse(JSON.stringify(ov));
      window._writeLog = [];
      window.fbGet = async (c) => (window._store[c] !== undefined ? window._store[c] : []);
      window.fbPost = async (c, d) => { window._writeLog.push({ op: 'post', c, d }); return 'id'; };
      window.fbPut = async (c, id, d) => { window._writeLog.push({ op: 'put', c, id, d }); };
      window.fbPatch = async (c, id, d) => { window._writeLog.push({ op: 'patch', c, id, d }); };
    }, { accounts: ACCOUNTS, source_documents: [{ _id: 'd1', type: 'sales_invoice', total: 1000, status: 'DRAFT', documentNumber: 'SD-X' }] });
    const create = await page.evaluate(() => window.createSourceDocument({ type: 'sales_invoice', total: 100, operationId: 'op-1' }));
    const post = await page.evaluate(() => window.postSourceDocument('d1', { debitAccountId: '1300', creditAccountId: '4100' }));
    const pay = await page.evaluate(() => window.recordPaymentAgainstDocument('d1', { amount: 100, cashAccountId: '1110', counterAccountId: '1300', direction: 'receive', operationId: 'pay-1' }));
    const voidR = await page.evaluate(() => window.voidSourceDocument('d1'));
    expect(create.ok).toBe(false);
    expect(post.ok).toBe(false);
    expect(pay.ok).toBe(false);
    expect(voidR.ok).toBe(false);
    const writes = await page.evaluate(() => window._writeLog);
    expect(writes).toEqual([]);
  });
});
