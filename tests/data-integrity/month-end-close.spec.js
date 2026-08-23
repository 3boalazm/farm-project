// tests/data-integrity/month-end-close.spec.js
// Phase 30: regression protection for Month-End Close
// (window.runMonthEndClose). Posts a real closing entry (revenue/
// expense -> Retained Earnings 3300) dated the day AFTER the period,
// then locks the period via the existing Phase 17 closeFiscalPeriod.

const { test, expect } = require('@playwright/test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

async function setupCloseMocks(page, overrides = {}) {
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
      return id;
    };
    window.fbPatch = async (c, id, d) => {
      window._writeLog.push({ op: 'patch', c, id, d });
      window._store[c] = (window._store[c] || []).map((r) => (r._id === id ? { ...r, ...d } : r));
    };
    window.getUser = () => ({ name: 'T', role: 'admin' });
  }, overrides);
}

const ACCOUNTS = [
  { _id: '4100', code: '4100', name_ar: 'بيع حيوانات', type: 'REVENUE', postable: true },
  { _id: '6100', code: '6100', name_ar: 'مصروف الأعلاف', type: 'EXPENSE', postable: true },
  { _id: '3300', code: '3300', name_ar: 'أرباح مرحّلة', type: 'EQUITY', postable: true },
];

test.describe('Month-End Close (Phase 30)', () => {
  test('closes a profitable period: posts a real closing entry crediting 3300 with net income, dated the day AFTER endDate, then locks the period', async ({ page }) => {
    const period = { _id: '2026-01', periodKey: '2026-01', startDate: '2026-01-01', endDate: '2026-01-31', status: 'OPEN' };
    const entries = [
      { _id: 'j1', date: '2026-01-10', lines: [{ accountId: '4100', credit: 1000 }] },
      { _id: 'j2', date: '2026-01-15', lines: [{ accountId: '6100', debit: 400 }] },
    ];
    await setupCloseMocks(page, { accounts: ACCOUNTS, journal_entries: entries, fiscal_periods: [period] });
    const r = await page.evaluate(() => window.runMonthEndClose('2026-01'));
    expect(r.ok).toBe(true);
    expect(r.netIncome).toBe(600);
    expect(r.closed).toBe(true);
    const postWrite = await page.evaluate(() => window._writeLog.find((w) => w.op === 'post' && w.c === 'journal_entries'));
    expect(postWrite.d.date).toBe('2026-02-01'); // day AFTER 2026-01-31, not on it
    const closingLine3300 = postWrite.d.lines.find((l) => l.accountId === '3300');
    expect(closingLine3300.credit).toBe(600);
    const revenueLine = postWrite.d.lines.find((l) => l.accountId === '4100');
    expect(revenueLine.debit).toBe(1000); // zeroed out
    const patchWrite = await page.evaluate(() => window._writeLog.find((w) => w.op === 'patch' && w.c === 'fiscal_periods'));
    expect(patchWrite.d.status).toBe('CLOSED');
  });

  test('closing a period does NOT corrupt that same period\'s own Income Statement when re-run afterward', async ({ page }) => {
    const period = { _id: '2026-01', periodKey: '2026-01', startDate: '2026-01-01', endDate: '2026-01-31', status: 'OPEN' };
    const entries = [{ _id: 'j1', date: '2026-01-10', lines: [{ accountId: '4100', credit: 1000 }] }];
    await setupCloseMocks(page, { accounts: ACCOUNTS, journal_entries: entries, fiscal_periods: [period] });
    await page.evaluate(() => window.runMonthEndClose('2026-01'));
    const r = await page.evaluate(() => window.getIncomeStatement('2026-01-01', '2026-01-31'));
    expect(r.totalRevenue).toBe(1000); // still the real original figure, not zeroed by the closing entry
  });

  test('a period with no revenue/expense activity locks with no journal entry posted', async ({ page }) => {
    const period = { _id: '2026-01', periodKey: '2026-01', startDate: '2026-01-01', endDate: '2026-01-31', status: 'OPEN' };
    await setupCloseMocks(page, { accounts: ACCOUNTS, journal_entries: [], fiscal_periods: [period] });
    const r = await page.evaluate(() => window.runMonthEndClose('2026-01'));
    expect(r.ok).toBe(true);
    expect(r.journalEntryId).toBeNull();
    expect(r.closed).toBe(true);
  });

  test('a normal re-run on an already-closed period is refused (not idempotent) -- consistent with closeFiscalPeriod\'s own "must be OPEN" rule, and a real second post never happens', async ({ page }) => {
    const period = { _id: '2026-01', periodKey: '2026-01', startDate: '2026-01-01', endDate: '2026-01-31', status: 'OPEN' };
    const entries = [{ _id: 'j1', date: '2026-01-10', lines: [{ accountId: '4100', credit: 500 }] }];
    await setupCloseMocks(page, { accounts: ACCOUNTS, journal_entries: entries, fiscal_periods: [period] });
    const r1 = await page.evaluate(() => window.runMonthEndClose('2026-01'));
    const r2 = await page.evaluate(() => window.runMonthEndClose('2026-01'));
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(false);
    const closingPosts = await page.evaluate(() => window._writeLog.filter((w) => w.op === 'post' && w.c === 'journal_entries'));
    expect(closingPosts.length).toBe(1);
  });

  test('idempotency guard: if a period_close entry already exists while the period is STILL open (a partial prior failure -- entry posted but the lock patch never completed), re-running detects it, posts no duplicate, and still locks the period', async ({ page }) => {
    const period = { _id: '2026-01', periodKey: '2026-01', startDate: '2026-01-01', endDate: '2026-01-31', status: 'OPEN' };
    const priorClose = { _id: 'jclose', sourceType: 'period_close', sourceId: '2026-01', date: '2026-02-01', lines: [] };
    await setupCloseMocks(page, { accounts: ACCOUNTS, journal_entries: [priorClose], fiscal_periods: [period] });
    const r = await page.evaluate(() => window.runMonthEndClose('2026-01'));
    expect(r.ok).toBe(true);
    expect(r.idempotent).toBe(true);
    expect(r.journalEntryId).toBe('jclose');
    const closingPosts = await page.evaluate(() => window._writeLog.filter((w) => w.op === 'post' && w.c === 'journal_entries'));
    expect(closingPosts.length).toBe(0);
  });

  test('an already-CLOSED period is refused', async ({ page }) => {
    const period = { _id: '2026-01', periodKey: '2026-01', startDate: '2026-01-01', endDate: '2026-01-31', status: 'CLOSED' };
    await setupCloseMocks(page, { accounts: ACCOUNTS, journal_entries: [], fiscal_periods: [period] });
    const r = await page.evaluate(() => window.runMonthEndClose('2026-01'));
    expect(r.ok).toBe(false);
  });

  test('permission: a role without can("finance") is refused', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'S', role: 'supervisor' })));
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForTimeout(600);
    await page.evaluate((ov) => {
      window._writeLog = [];
      window.fbGet = async (c) => (ov[c] !== undefined ? ov[c] : []);
    }, { accounts: ACCOUNTS, journal_entries: [], fiscal_periods: [{ _id: '2026-01', startDate: '2026-01-01', endDate: '2026-01-31', status: 'OPEN' }] });
    const r = await page.evaluate(() => window.runMonthEndClose('2026-01'));
    expect(r.ok).toBe(false);
  });
});
