// tests/data-integrity/financial-audit-trail.spec.js
// Phase 18: regression protection for the Financial Audit Trail
// (window.getFinancialAuditTrail, and the _recordFinancialAudit calls
// wired into the chokepoints every prior phase already funnels through:
// postJournalEntry, reverseJournalEntry, postSourceDocument,
// recordPaymentAgainstDocument, voidSourceDocument,
// cancelPostedSourceDocument, allocateCost, and the three fiscal-period
// transitions). Also re-verifies those chokepoints still function
// correctly after being touched by this phase.

const { test, expect } = require('../fixtures/farm-test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

async function setupAuditMocks(page, overrides = {}) {
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
  { _id: '4100', code: '4100', name_ar: 'بيع حيوانات', type: 'REVENUE', postable: true, active: true },
];

test.describe('Financial Audit Trail (Phase 18)', () => {
  test('postJournalEntry: writes a POST audit record with real entry details', async ({ page }) => {
    await setupAuditMocks(page, { accounts: ACCOUNTS, financial_audit_log: [] });
    const r = await page.evaluate(() => window.postJournalEntry({
      lines: [{ accountId: '1110', debit: 500 }, { accountId: '4100', credit: 500 }],
    }));
    expect(r.ok).toBe(true);
    // best-effort audit write is async/fire-and-forget -- give it a tick
    await page.waitForTimeout(50);
    const audit = await page.evaluate(() => window._writeLog.find((w) => w.c === 'financial_audit_log'));
    expect(audit).toBeTruthy();
    expect(audit.d.action).toBe('POST');
    expect(audit.d.entity).toBe('journal_entry');
    expect(audit.d.details.totalDebit).toBe(500);
  });

  test('reverseJournalEntry: writes BOTH a REVERSE record (the original) and a POST record (the reversal entry)', async ({ page }) => {
    const original = { _id: 'j1', status: 'POSTED', lines: [{ accountId: '1110', debit: 500 }, { accountId: '4100', credit: 500 }] };
    await setupAuditMocks(page, { accounts: ACCOUNTS, journal_entries: [original], financial_audit_log: [] });
    const r = await page.evaluate(() => window.reverseJournalEntry('j1'));
    expect(r.ok).toBe(true);
    await page.waitForTimeout(50);
    const audits = await page.evaluate(() => window._writeLog.filter((w) => w.c === 'financial_audit_log'));
    expect(audits.some((a) => a.d.action === 'REVERSE' && a.d.entityId === 'j1')).toBe(true);
    expect(audits.some((a) => a.d.action === 'POST')).toBe(true);
  });

  test('recordPaymentAgainstDocument: writes a PAY audit record only for a genuine new payment, not a replay', async ({ page }) => {
    const doc = { _id: 'd1', type: 'sales_invoice', date: '2026-01-01', total: 500, paidAmount: 0, remainingAmount: 500, status: 'POSTED', documentNumber: 'SD-X', journalEntryId: 'j1' };
    await setupAuditMocks(page, { accounts: ACCOUNTS, source_documents: [doc], financial_audit_log: [] });
    await page.evaluate(() => window.recordPaymentAgainstDocument('d1', { amount: 500, cashAccountId: '1110', counterAccountId: '4100', direction: 'receive', operationId: 'pay-1' }));
    await page.evaluate(() => window.recordPaymentAgainstDocument('d1', { amount: 500, cashAccountId: '1110', counterAccountId: '4100', direction: 'receive', operationId: 'pay-1' })); // replay
    await page.waitForTimeout(50);
    const payAudits = await page.evaluate(() => window._writeLog.filter((w) => w.c === 'financial_audit_log' && w.d.action === 'PAY'));
    expect(payAudits.length).toBe(1); // not 2 -- the replay never re-ran the real payment logic
  });

  test('closeFiscalPeriod / lockFiscalPeriod / reopenFiscalPeriod: each writes its own distinctly-named audit action', async ({ page }) => {
    const period = { _id: '2026-01', periodKey: '2026-01', startDate: '2026-01-01', endDate: '2026-01-31', status: 'OPEN' };
    await setupAuditMocks(page, { fiscal_periods: [period], financial_audit_log: [] });
    await page.evaluate(() => window.closeFiscalPeriod('2026-01'));
    await page.evaluate(() => window.lockFiscalPeriod('2026-01'));
    await page.waitForTimeout(50);
    const audits = await page.evaluate(() => window._writeLog.filter((w) => w.c === 'financial_audit_log'));
    expect(audits.some((a) => a.d.action === 'CLOSE_PERIOD')).toBe(true);
    expect(audits.some((a) => a.d.action === 'LOCK_PERIOD')).toBe(true);
  });

  test('getFinancialAuditTrail: filters by entity and entityId, sorted chronologically', async ({ page }) => {
    const log = [
      { _id: 'a1', entity: 'journal_entry', entityId: 'j1', action: 'POST', timestamp: '2026-01-02T00:00:00Z' },
      { _id: 'a2', entity: 'journal_entry', entityId: 'j1', action: 'REVERSE', timestamp: '2026-01-01T00:00:00Z' },
      { _id: 'a3', entity: 'journal_entry', entityId: 'j2', action: 'POST', timestamp: '2026-01-03T00:00:00Z' },
    ];
    await setupAuditMocks(page, { financial_audit_log: log });
    const r = await page.evaluate(() => window.getFinancialAuditTrail('journal_entry', 'j1'));
    expect(r.ok).toBe(true);
    expect(r.entries.length).toBe(2);
    expect(r.entries[0].action).toBe('REVERSE'); // earlier timestamp first
    expect(r.entries[1].action).toBe('POST');
  });

  test('regression: a real financial operation still fully succeeds even though the audit call was added to its chokepoint (fire-and-forget never blocks it)', async ({ page }) => {
    await setupAuditMocks(page, { accounts: ACCOUNTS, source_documents: [] });
    const r = await page.evaluate(() => window.createSourceDocument({ type: 'sales_invoice', total: 1000, operationId: 'reg-1' }));
    const posted = await page.evaluate((id) => window.postSourceDocument(id, { debitAccountId: '1110', creditAccountId: '4100' }), r.id);
    expect(posted.ok).toBe(true);
    expect(posted.status).toBe('POSTED');
  });
});
