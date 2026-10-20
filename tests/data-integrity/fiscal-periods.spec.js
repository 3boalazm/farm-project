// tests/data-integrity/fiscal-periods.spec.js
// Phase 17: regression protection for Fiscal Periods
// (window.createFiscalPeriod / closeFiscalPeriod / lockFiscalPeriod /
// reopenFiscalPeriod / _checkFiscalPeriodOpen). Critically, this also
// verifies postJournalEntry (Phase 1) itself now refuses to post into a
// closed/locked period -- the one place this phase reaches back into
// prior, already-shipped code.

const { test, expect } = require('../fixtures/farm-test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

async function setupPeriodMocks(page, overrides = {}) {
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
  { _id: '4100', code: '4100', name_ar: 'بيع حيوانات', type: 'REVENUE', postable: true, active: true },
];

test.describe('Fiscal Periods (Phase 17)', () => {
  test('createFiscalPeriod: creates an OPEN period, rejects a duplicate key and endDate before startDate', async ({ page }) => {
    await setupPeriodMocks(page, { fiscal_periods: [] });
    const r = await page.evaluate(() => window.createFiscalPeriod({ periodKey: '2026-01', startDate: '2026-01-01', endDate: '2026-01-31' }));
    expect(r.ok).toBe(true);
    const dupe = await page.evaluate(() => window.createFiscalPeriod({ periodKey: '2026-01', startDate: '2026-01-01', endDate: '2026-01-31' }));
    expect(dupe.ok).toBe(false);
    const badRange = await page.evaluate(() => window.createFiscalPeriod({ periodKey: '2026-02', startDate: '2026-02-28', endDate: '2026-02-01' }));
    expect(badRange.ok).toBe(false);
  });

  test('a date with NO matching fiscal period posts exactly as before this phase existed (opt-in control)', async ({ page }) => {
    await setupPeriodMocks(page, { accounts: ACCOUNTS, fiscal_periods: [] });
    const r = await page.evaluate(() => window.postJournalEntry({
      date: '2026-05-15', lines: [{ accountId: '1110', debit: 100 }, { accountId: '4100', credit: 100 }],
    }));
    expect(r.ok).toBe(true);
  });

  test('an OPEN period allows posting inside its date range', async ({ page }) => {
    const period = { _id: '2026-01', periodKey: '2026-01', startDate: '2026-01-01', endDate: '2026-01-31', status: 'OPEN' };
    await setupPeriodMocks(page, { accounts: ACCOUNTS, fiscal_periods: [period] });
    const r = await page.evaluate(() => window.postJournalEntry({
      date: '2026-01-15', lines: [{ accountId: '1110', debit: 100 }, { accountId: '4100', credit: 100 }],
    }));
    expect(r.ok).toBe(true);
  });

  test('a CLOSED period refuses ANY new posting with a date inside it -- this is postJournalEntry itself refusing, not a separate check', async ({ page }) => {
    const period = { _id: '2026-01', periodKey: '2026-01', startDate: '2026-01-01', endDate: '2026-01-31', status: 'CLOSED' };
    await setupPeriodMocks(page, { accounts: ACCOUNTS, fiscal_periods: [period] });
    const r = await page.evaluate(() => window.postJournalEntry({
      date: '2026-01-15', lines: [{ accountId: '1110', debit: 100 }, { accountId: '4100', credit: 100 }],
    }));
    expect(r.ok).toBe(false);
    const jeWrites = await page.evaluate(() => window._writeLog.filter((w) => w.c === 'journal_entries'));
    expect(jeWrites).toEqual([]);
  });

  test('a LOCKED period also refuses posting, and a date OUTSIDE the locked range is unaffected', async ({ page }) => {
    const period = { _id: '2026-01', periodKey: '2026-01', startDate: '2026-01-01', endDate: '2026-01-31', status: 'LOCKED' };
    await setupPeriodMocks(page, { accounts: ACCOUNTS, fiscal_periods: [period] });
    const inside = await page.evaluate(() => window.postJournalEntry({
      date: '2026-01-20', lines: [{ accountId: '1110', debit: 100 }, { accountId: '4100', credit: 100 }],
    }));
    const outside = await page.evaluate(() => window.postJournalEntry({
      date: '2026-02-01', lines: [{ accountId: '1110', debit: 100 }, { accountId: '4100', credit: 100 }],
    }));
    expect(inside.ok).toBe(false);
    expect(outside.ok).toBe(true);
  });

  test('closeFiscalPeriod: OPEN -> CLOSED, then immediately blocks new postings into that period', async ({ page }) => {
    const period = { _id: '2026-01', periodKey: '2026-01', startDate: '2026-01-01', endDate: '2026-01-31', status: 'OPEN' };
    await setupPeriodMocks(page, { accounts: ACCOUNTS, fiscal_periods: [period] });
    const close = await page.evaluate(() => window.closeFiscalPeriod('2026-01'));
    expect(close.ok).toBe(true);
    const r = await page.evaluate(() => window.postJournalEntry({
      date: '2026-01-10', lines: [{ accountId: '1110', debit: 100 }, { accountId: '4100', credit: 100 }],
    }));
    expect(r.ok).toBe(false);
  });

  test('lockFiscalPeriod: refuses to lock an OPEN period (must be CLOSED first)', async ({ page }) => {
    const period = { _id: '2026-01', periodKey: '2026-01', startDate: '2026-01-01', endDate: '2026-01-31', status: 'OPEN' };
    await setupPeriodMocks(page, { fiscal_periods: [period] });
    const r = await page.evaluate(() => window.lockFiscalPeriod('2026-01'));
    expect(r.ok).toBe(false);
  });

  test('lockFiscalPeriod: locks a CLOSED period', async ({ page }) => {
    const period = { _id: '2026-01', periodKey: '2026-01', startDate: '2026-01-01', endDate: '2026-01-31', status: 'CLOSED' };
    await setupPeriodMocks(page, { fiscal_periods: [period] });
    const r = await page.evaluate(() => window.lockFiscalPeriod('2026-01'));
    expect(r.ok).toBe(true);
  });

  test('reopenFiscalPeriod: CLOSED -> OPEN with a required reason, restoring posting ability', async ({ page }) => {
    const period = { _id: '2026-01', periodKey: '2026-01', startDate: '2026-01-01', endDate: '2026-01-31', status: 'CLOSED' };
    await setupPeriodMocks(page, { accounts: ACCOUNTS, fiscal_periods: [period] });
    const noReason = await page.evaluate(() => window.reopenFiscalPeriod('2026-01'));
    expect(noReason.ok).toBe(false);
    const r = await page.evaluate(() => window.reopenFiscalPeriod('2026-01', 'تصحيح خطأ مكتشف بعد الإغلاق'));
    expect(r.ok).toBe(true);
    const posting = await page.evaluate(() => window.postJournalEntry({
      date: '2026-01-10', lines: [{ accountId: '1110', debit: 100 }, { accountId: '4100', credit: 100 }],
    }));
    expect(posting.ok).toBe(true);
  });

  test('reopenFiscalPeriod: refuses to reopen a LOCKED period -- a one-way door', async ({ page }) => {
    const period = { _id: '2026-01', periodKey: '2026-01', startDate: '2026-01-01', endDate: '2026-01-31', status: 'LOCKED' };
    await setupPeriodMocks(page, { fiscal_periods: [period] });
    const r = await page.evaluate(() => window.reopenFiscalPeriod('2026-01', 'محاولة'));
    expect(r.ok).toBe(false);
  });

  test('permission: a role without can("finance") cannot create, close, lock, or reopen a period', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'S', role: 'supervisor' })));
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForTimeout(600);
    await page.evaluate((ov) => {
      window._store = JSON.parse(JSON.stringify(ov));
      window._writeLog = [];
      window.fbGet = async (c) => (window._store[c] !== undefined ? window._store[c] : []);
      window.fbPut = async (c, id, d) => { window._writeLog.push({ op: 'put', c, id, d }); };
      window.fbPatch = async (c, id, d) => { window._writeLog.push({ op: 'patch', c, id, d }); };
    }, { fiscal_periods: [{ _id: '2026-01', periodKey: '2026-01', startDate: '2026-01-01', endDate: '2026-01-31', status: 'CLOSED' }] });
    const create = await page.evaluate(() => window.createFiscalPeriod({ periodKey: '2026-02', startDate: '2026-02-01', endDate: '2026-02-28' }));
    const close = await page.evaluate(() => window.closeFiscalPeriod('2026-01'));
    const lock = await page.evaluate(() => window.lockFiscalPeriod('2026-01'));
    const reopen = await page.evaluate(() => window.reopenFiscalPeriod('2026-01', 'x'));
    expect(create.ok).toBe(false);
    expect(close.ok).toBe(false);
    expect(lock.ok).toBe(false);
    expect(reopen.ok).toBe(false);
    const writes = await page.evaluate(() => window._writeLog);
    expect(writes).toEqual([]);
  });
});
