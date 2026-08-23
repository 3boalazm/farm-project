// tests/data-integrity/feed-costing.spec.js
// Phase 10: regression protection for Feed Costing
// (window.getFeedCostSummary / getFeedCostPerAnimal / getFeedCostPerDay).
// Pure reporting over journal_entries lines already posted against 6100
// (Feed Expense) by Phase 6's postInventoryConsumption -- no writes, no
// new collection.

const { test, expect } = require('@playwright/test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

async function setupFeedMocks(page, overrides = {}) {
  await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
  await page.goto(`${BASE_URL}/dashboard.html`);
  await page.waitForTimeout(600);
  await page.evaluate((ov) => {
    window.fbGet = async (c) => (ov[c] !== undefined ? ov[c] : []);
  }, overrides);
}

test.describe('Feed Costing (Phase 10)', () => {
  test('getFeedCostSummary: totals feed-expense lines, splitting attributed (per-animal) from unattributed', async ({ page }) => {
    const entries = [
      { _id: 'j1', date: '2026-01-05', lines: [{ accountId: '6100', debit: 120, relatedAnimalId: 'a1' }, { accountId: '1410', credit: 120 }] },
      { _id: 'j2', date: '2026-01-06', lines: [{ accountId: '6100', debit: 80, relatedAnimalId: 'a1' }, { accountId: '1410', credit: 80 }] },
      { _id: 'j3', date: '2026-01-07', lines: [{ accountId: '6100', debit: 200 }, { accountId: '1410', credit: 200 }] }, // barn-level, no animal
      { _id: 'j4', date: '2026-01-07', lines: [{ accountId: '6200', debit: 999 }, { accountId: '1420', credit: 999 }] }, // medicine, not feed
    ];
    await setupFeedMocks(page, { journal_entries: entries });
    const r = await page.evaluate(() => window.getFeedCostSummary(null, null));
    expect(r.ok).toBe(true);
    expect(r.total).toBe(400); // 120+80+200, excludes the medicine line
    expect(r.byAnimal.a1).toBe(200);
    expect(r.unattributed).toBe(200);
    expect(r.recordCount).toBe(3);
  });

  test('getFeedCostSummary: respects a date range', async ({ page }) => {
    const entries = [
      { _id: 'j1', date: '2026-01-05', lines: [{ accountId: '6100', debit: 100 }] },
      { _id: 'j2', date: '2026-02-05', lines: [{ accountId: '6100', debit: 999 }] }, // out of range
    ];
    await setupFeedMocks(page, { journal_entries: entries });
    const r = await page.evaluate(() => window.getFeedCostSummary('2026-01-01', '2026-01-31'));
    expect(r.total).toBe(100);
  });

  test('getFeedCostPerAnimal: sums only lines attributed to that specific animal', async ({ page }) => {
    const entries = [
      { _id: 'j1', date: '2026-01-05', lines: [{ accountId: '6100', debit: 150, relatedAnimalId: 'a1' }] },
      { _id: 'j2', date: '2026-01-06', lines: [{ accountId: '6100', debit: 250, relatedAnimalId: 'a2' }] },
    ];
    await setupFeedMocks(page, { journal_entries: entries });
    const r = await page.evaluate(() => window.getFeedCostPerAnimal('a1', null, null));
    expect(r.ok).toBe(true);
    expect(r.total).toBe(150);
    expect(r.entries.length).toBe(1);
  });

  test('getFeedCostPerDay: buckets and sorts by date', async ({ page }) => {
    const entries = [
      { _id: 'j1', date: '2026-01-06', lines: [{ accountId: '6100', debit: 50 }] },
      { _id: 'j2', date: '2026-01-05', lines: [{ accountId: '6100', debit: 30 }] },
      { _id: 'j3', date: '2026-01-05', lines: [{ accountId: '6100', debit: 20 }] },
    ];
    await setupFeedMocks(page, { journal_entries: entries });
    const r = await page.evaluate(() => window.getFeedCostPerDay(null, null));
    expect(r.ok).toBe(true);
    expect(r.days).toEqual([{ date: '2026-01-05', total: 50 }, { date: '2026-01-06', total: 50 }]);
  });

  test('no feed data: returns real zeros, not an error', async ({ page }) => {
    await setupFeedMocks(page, { journal_entries: [] });
    const r = await page.evaluate(() => window.getFeedCostSummary(null, null));
    expect(r.ok).toBe(true);
    expect(r.total).toBe(0);
    expect(r.byAnimal).toEqual({});
  });
});
