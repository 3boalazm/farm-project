// tests/data-integrity/financial-data-quality.spec.js
// Phase 29: regression protection for the Financial Data Quality scan
// (window.runFinancialDataQualityScan). Read-only -- reports real
// issues, never auto-fixes.

const { test, expect } = require('@playwright/test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

async function setupScanMocks(page, overrides = {}) {
  await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
  await page.goto(`${BASE_URL}/dashboard.html`);
  await page.waitForTimeout(600);
  await page.evaluate((ov) => {
    window.fbGet = async (c) => (ov[c] !== undefined ? ov[c] : []);
    window.getUser = () => ({ name: 'T', role: 'admin' });
  }, overrides);
}

const ACCOUNTS = [
  { _id: '1200', code: '1200', name_ar: 'البنك', type: 'ASSET', postable: true },
  { _id: '1000', code: '1000', name_ar: 'الأصول', type: 'ASSET', postable: false },
  { _id: '4100', code: '4100', name_ar: 'بيع حيوانات', type: 'REVENUE', postable: true },
];

test.describe('Financial Data Quality Scan (Phase 29)', () => {
  test('a clean dataset reports zero issues', async ({ page }) => {
    const entries = [{ _id: 'j1', lines: [{ accountId: '1200', debit: 100 }, { accountId: '4100', credit: 100 }] }];
    const docs = [{ _id: 'd1', status: 'POSTED', journalEntryId: 'j1', operationId: 'op1' }];
    await setupScanMocks(page, { accounts: ACCOUNTS, journal_entries: entries, source_documents: docs });
    const r = await page.evaluate(() => window.runFinancialDataQualityScan());
    expect(r.ok).toBe(true);
    expect(r.issueCount).toBe(0);
    expect(r.scannedEntries).toBe(1);
  });

  test('flags a line referencing an account that does not exist in the chart of accounts', async ({ page }) => {
    const entries = [{ _id: 'j1', lines: [{ accountId: '9999', debit: 100 }, { accountId: '4100', credit: 100 }] }];
    await setupScanMocks(page, { accounts: ACCOUNTS, journal_entries: entries, source_documents: [] });
    const r = await page.evaluate(() => window.runFinancialDataQualityScan());
    expect(r.issues.some((i) => i.type === 'UNKNOWN_ACCOUNT' && i.accountId === '9999')).toBe(true);
  });

  test('flags a posting to a non-postable header account', async ({ page }) => {
    const entries = [{ _id: 'j1', lines: [{ accountId: '1000', debit: 100 }, { accountId: '4100', credit: 100 }] }];
    await setupScanMocks(page, { accounts: ACCOUNTS, journal_entries: entries, source_documents: [] });
    const r = await page.evaluate(() => window.runFinancialDataQualityScan());
    expect(r.issues.some((i) => i.type === 'POSTED_TO_NON_POSTABLE_ACCOUNT' && i.accountId === '1000')).toBe(true);
  });

  test('flags a genuinely unbalanced entry (data written outside the normal engine path)', async ({ page }) => {
    const entries = [{ _id: 'j1', lines: [{ accountId: '1200', debit: 150 }, { accountId: '4100', credit: 100 }] }];
    await setupScanMocks(page, { accounts: ACCOUNTS, journal_entries: entries, source_documents: [] });
    const r = await page.evaluate(() => window.runFinancialDataQualityScan());
    const issue = r.issues.find((i) => i.type === 'UNBALANCED_ENTRY');
    expect(issue.totalDebit).toBe(150);
    expect(issue.totalCredit).toBe(100);
  });

  test('flags a non-DRAFT document with no linked journal entry, and a duplicate operationId', async ({ page }) => {
    const docs = [
      { _id: 'd1', status: 'POSTED', journalEntryId: null, operationId: 'op1' },
      { _id: 'd2', status: 'DRAFT', journalEntryId: null, operationId: 'op2' }, // DRAFT is fine without a journal entry
      { _id: 'd3', status: 'POSTED', journalEntryId: 'j1', operationId: 'op1' }, // duplicate of d1's operationId
    ];
    await setupScanMocks(page, { accounts: ACCOUNTS, journal_entries: [], source_documents: docs });
    const r = await page.evaluate(() => window.runFinancialDataQualityScan());
    expect(r.issues.some((i) => i.type === 'POSTED_DOCUMENT_MISSING_JOURNAL_ENTRY' && i.documentId === 'd1')).toBe(true);
    expect(r.issues.some((i) => i.type === 'POSTED_DOCUMENT_MISSING_JOURNAL_ENTRY' && i.documentId === 'd2')).toBe(false);
    expect(r.issues.some((i) => i.type === 'DUPLICATE_OPERATION_ID' && i.documentId === 'd3')).toBe(true);
  });

  test('permission: a role without can("finance") is refused', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'S', role: 'supervisor' })));
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForTimeout(600);
    await page.evaluate((ov) => { window.fbGet = async (c) => (ov[c] !== undefined ? ov[c] : []); }, { accounts: ACCOUNTS, journal_entries: [], source_documents: [] });
    const r = await page.evaluate(() => window.runFinancialDataQualityScan());
    expect(r.ok).toBe(false);
  });
});
