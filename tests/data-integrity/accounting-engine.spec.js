// tests/data-integrity/accounting-engine.spec.js
// Phase 1: regression protection for the new Accounting Engine
// (window.seedDefaultChartOfAccounts / createAccount / postJournalEntry /
// reverseJournalEntry, shared.js). Purely additive per docs/finance-audit
// -- the existing `finance` collection and computeFinanceKPIs/Trend are
// completely untouched by this engine and are not re-tested here.

const { test, expect } = require('@playwright/test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

async function setupAccountingMocks(page, overrides = {}) {
  await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
  await page.goto(`${BASE_URL}/dashboard.html`);
  await page.waitForTimeout(600); // let the real page's own initial load settle first (firebase.js's own fbGet declaration overwrites any addInitScript mock)
  await page.evaluate((ov) => {
    window._writeLog = [];
    window.fbGet = async (c) => (ov[c] !== undefined ? ov[c] : []);
    window.fbPost = async (c, d) => { window._writeLog.push({ op: 'post', c, d }); return 'id_' + window._writeLog.length; };
    window.fbPut = async (c, id, d) => { window._writeLog.push({ op: 'put', c, id, d }); };
    window.fbPatch = async (c, id, d) => { window._writeLog.push({ op: 'patch', c, id, d }); };
    window.getUser = () => ({ name: 'T', role: 'admin' });
  }, overrides);
}

const TWO_ACCOUNTS = [
  { _id: '1110', code: '1110', name_ar: 'نقدية المزرعة', type: 'ASSET', postable: true, active: true },
  { _id: '4100', code: '4100', name_ar: 'بيع حيوانات', type: 'REVENUE', postable: true, active: true },
];

test.describe('Accounting Engine (Phase 1)', () => {
  test('seedDefaultChartOfAccounts: writes accounts only when the collection is empty (idempotent)', async ({ page }) => {
    await setupAccountingMocks(page, { accounts: [] });
    const r = await page.evaluate(() => window.seedDefaultChartOfAccounts());
    expect(r.ok).toBe(true);
    expect(r.seeded).toBeGreaterThan(30);
    const writes = await page.evaluate(() => window._writeLog);
    expect(writes.every((w) => w.op === 'put' && w.c === 'accounts')).toBe(true);
  });

  test('seedDefaultChartOfAccounts: does nothing if accounts already exist', async ({ page }) => {
    await setupAccountingMocks(page, { accounts: [TWO_ACCOUNTS[0]] });
    const r = await page.evaluate(() => window.seedDefaultChartOfAccounts());
    expect(r.ok).toBe(true);
    expect(r.skipped).toBe(true);
    const writes = await page.evaluate(() => window._writeLog);
    expect(writes).toEqual([]);
  });

  test('createAccount: rejects a duplicate code', async ({ page }) => {
    await setupAccountingMocks(page, { accounts: [TWO_ACCOUNTS[0]] });
    const r = await page.evaluate(() => window.createAccount({ code: '1110', name_ar: 'تكرار', type: 'ASSET' }));
    expect(r.ok).toBe(false);
  });

  test('postJournalEntry: a balanced two-line entry is accepted and posted', async ({ page }) => {
    await setupAccountingMocks(page, { accounts: TWO_ACCOUNTS });
    const r = await page.evaluate(() => window.postJournalEntry({
      description: 'بيع حيوان نقدًا',
      lines: [
        { accountId: '1110', debit: 1000 },
        { accountId: '4100', credit: 1000 },
      ],
    }));
    expect(r.ok).toBe(true);
    expect(r.entry.status).toBe('POSTED');
    expect(r.entry.totalDebit).toBe(1000);
    expect(r.entry.totalCredit).toBe(1000);
  });

  test('postJournalEntry: rejects an unbalanced entry (debit != credit)', async ({ page }) => {
    await setupAccountingMocks(page, { accounts: TWO_ACCOUNTS });
    const r = await page.evaluate(() => window.postJournalEntry({
      lines: [
        { accountId: '1110', debit: 1000 },
        { accountId: '4100', credit: 900 },
      ],
    }));
    expect(r.ok).toBe(false);
    const writes = await page.evaluate(() => window._writeLog);
    expect(writes.filter((w) => w.c === 'journal_entries')).toEqual([]);
  });

  test('postJournalEntry: rejects a negative amount', async ({ page }) => {
    await setupAccountingMocks(page, { accounts: TWO_ACCOUNTS });
    const r = await page.evaluate(() => window.postJournalEntry({
      lines: [
        { accountId: '1110', debit: -100 },
        { accountId: '4100', credit: 100 },
      ],
    }));
    expect(r.ok).toBe(false);
  });

  test('postJournalEntry: rejects a line with both debit and credit set', async ({ page }) => {
    await setupAccountingMocks(page, { accounts: TWO_ACCOUNTS });
    const r = await page.evaluate(() => window.postJournalEntry({
      lines: [
        { accountId: '1110', debit: 100, credit: 100 },
        { accountId: '4100', credit: 100 },
      ],
    }));
    expect(r.ok).toBe(false);
  });

  test('postJournalEntry: rejects a line with neither debit nor credit set', async ({ page }) => {
    await setupAccountingMocks(page, { accounts: TWO_ACCOUNTS });
    const r = await page.evaluate(() => window.postJournalEntry({
      lines: [
        { accountId: '1110' },
        { accountId: '4100', credit: 100 },
      ],
    }));
    expect(r.ok).toBe(false);
  });

  test('postJournalEntry: rejects fewer than 2 lines', async ({ page }) => {
    await setupAccountingMocks(page, { accounts: TWO_ACCOUNTS });
    const r = await page.evaluate(() => window.postJournalEntry({ lines: [{ accountId: '1110', debit: 100 }] }));
    expect(r.ok).toBe(false);
  });

  test('postJournalEntry: rejects posting directly to a non-postable header account', async ({ page }) => {
    await setupAccountingMocks(page, { accounts: [{ _id: '1000', code: '1000', name_ar: 'الأصول', type: 'ASSET', postable: false }, TWO_ACCOUNTS[1]] });
    const r = await page.evaluate(() => window.postJournalEntry({
      lines: [
        { accountId: '1000', debit: 100 },
        { accountId: '4100', credit: 100 },
      ],
    }));
    expect(r.ok).toBe(false);
  });

  test('postJournalEntry: rejects an unknown account id', async ({ page }) => {
    await setupAccountingMocks(page, { accounts: TWO_ACCOUNTS });
    const r = await page.evaluate(() => window.postJournalEntry({
      lines: [
        { accountId: 'nope', debit: 100 },
        { accountId: '4100', credit: 100 },
      ],
    }));
    expect(r.ok).toBe(false);
  });

  test('reverseJournalEntry: produces a new balanced entry with swapped debit/credit, linked to the original', async ({ page }) => {
    const original = {
      _id: 'j1', status: 'POSTED', description: 'بيع حيوان نقدًا',
      lines: [{ accountId: '1110', debit: 1000 }, { accountId: '4100', credit: 1000 }],
    };
    await setupAccountingMocks(page, { accounts: TWO_ACCOUNTS, journal_entries: [original] });
    const r = await page.evaluate(() => window.reverseJournalEntry('j1'));
    expect(r.ok).toBe(true);
    expect(r.entry.reversesJournalEntryId).toBe('j1');
    const line1110 = r.entry.lines.find((l) => l.accountId === '1110');
    const line4100 = r.entry.lines.find((l) => l.accountId === '4100');
    expect(line1110.credit).toBe(1000);
    expect(line4100.debit).toBe(1000);
    expect(r.entry.totalDebit).toBe(1000);
    expect(r.entry.totalCredit).toBe(1000);
  });

  test('reverseJournalEntry: refuses to reverse the same entry twice', async ({ page }) => {
    const original = { _id: 'j1', status: 'POSTED', lines: [{ accountId: '1110', debit: 1000 }, { accountId: '4100', credit: 1000 }] };
    const priorReversal = { _id: 'j2', status: 'POSTED', reversesJournalEntryId: 'j1', lines: [{ accountId: '1110', credit: 1000 }, { accountId: '4100', debit: 1000 }] };
    await setupAccountingMocks(page, { accounts: TWO_ACCOUNTS, journal_entries: [original, priorReversal] });
    const r = await page.evaluate(() => window.reverseJournalEntry('j1'));
    expect(r.ok).toBe(false);
  });

  test('reverseJournalEntry: refuses to reverse a non-existent entry', async ({ page }) => {
    await setupAccountingMocks(page, { accounts: TWO_ACCOUNTS, journal_entries: [] });
    const r = await page.evaluate(() => window.reverseJournalEntry('nope'));
    expect(r.ok).toBe(false);
  });

  test('permission: a role without can("finance") cannot post, seed, or create accounts', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'S', role: 'supervisor' })));
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForTimeout(600);
    await page.evaluate((ov) => {
      window._writeLog = [];
      window.fbGet = async (c) => (ov[c] !== undefined ? ov[c] : []);
      window.fbPost = async (c, d) => { window._writeLog.push({ op: 'post', c, d }); return 'id'; };
      window.fbPut = async (c, id, d) => { window._writeLog.push({ op: 'put', c, id, d }); };
    }, { accounts: TWO_ACCOUNTS });
    const seedResult = await page.evaluate(() => window.seedDefaultChartOfAccounts());
    const createResult = await page.evaluate(() => window.createAccount({ code: '9999', name_ar: 'x', type: 'ASSET' }));
    const postResult = await page.evaluate(() => window.postJournalEntry({ lines: [{ accountId: '1110', debit: 100 }, { accountId: '4100', credit: 100 }] }));
    expect(seedResult.ok).toBe(false);
    expect(createResult.ok).toBe(false);
    expect(postResult.ok).toBe(false);
    const writes = await page.evaluate(() => window._writeLog);
    expect(writes).toEqual([]);
  });

  test('100% additive: existing finance engine functions still exist and are unaffected', async ({ page }) => {
    await setupAccountingMocks(page, { finance: [{ type: 'income', amount: 500, date: '2026-01-01' }] });
    const hasComputeFinanceKPIs = await page.evaluate(() => typeof window.computeFinanceKPIs === 'function');
    const k = await page.evaluate(() => window.computeFinanceKPIs(null, null));
    expect(hasComputeFinanceKPIs).toBe(true);
    expect(k.revenue).toBe(500);
  });
});
