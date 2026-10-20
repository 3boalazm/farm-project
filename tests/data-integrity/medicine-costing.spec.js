// tests/data-integrity/medicine-costing.spec.js
// Phase 11: regression protection for Health & Medicine Costing
// (window.getMedicineCostSummary / getMedicineCostPerAnimal). Mirrors
// feed-costing.spec.js exactly, over the Medicine Expense account (6200)
// instead of Feed Expense (6100) -- pure reporting, no writes.

const { test, expect } = require('../fixtures/farm-test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

async function setupMedMocks(page, overrides = {}) {
  await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
  await page.goto(`${BASE_URL}/dashboard.html`);
  await page.waitForTimeout(600);
  await page.evaluate((ov) => {
    window.fbGet = async (c) => (ov[c] !== undefined ? ov[c] : []);
    window.fbGetSafe = window.fbGet;   // O-19: reads moved onto fbGetSafe() in the 2026-10 audit; a mock that patches only fbGet leaves it reading the fake database
  }, overrides);
}

test.describe('Health & Medicine Costing (Phase 11)', () => {
  test('getMedicineCostSummary: totals only 6200 lines, split attributed vs. unattributed', async ({ page }) => {
    const entries = [
      { _id: 'j1', date: '2026-01-05', lines: [{ accountId: '6200', debit: 90, relatedAnimalId: 'a1' }] },
      { _id: 'j2', date: '2026-01-06', lines: [{ accountId: '6200', debit: 60 }] }, // barn-wide vaccination, no animal
      { _id: 'j3', date: '2026-01-06', lines: [{ accountId: '6100', debit: 500 }] }, // feed, not medicine
    ];
    await setupMedMocks(page, { journal_entries: entries });
    const r = await page.evaluate(() => window.getMedicineCostSummary(null, null));
    expect(r.ok).toBe(true);
    expect(r.total).toBe(150);
    expect(r.byAnimal.a1).toBe(90);
    expect(r.unattributed).toBe(60);
  });

  test('getMedicineCostPerAnimal: sums only this animal\'s lines, date-filtered', async ({ page }) => {
    const entries = [
      { _id: 'j1', date: '2026-01-05', lines: [{ accountId: '6200', debit: 90, relatedAnimalId: 'a1' }] },
      { _id: 'j2', date: '2026-02-05', lines: [{ accountId: '6200', debit: 999, relatedAnimalId: 'a1' }] }, // out of range
    ];
    await setupMedMocks(page, { journal_entries: entries });
    const r = await page.evaluate(() => window.getMedicineCostPerAnimal('a1', '2026-01-01', '2026-01-31'));
    expect(r.ok).toBe(true);
    expect(r.total).toBe(90);
    expect(r.entries.length).toBe(1);
  });

  test('no medicine data: returns real zeros, not an error', async ({ page }) => {
    await setupMedMocks(page, { journal_entries: [] });
    const r = await page.evaluate(() => window.getMedicineCostSummary(null, null));
    expect(r.ok).toBe(true);
    expect(r.total).toBe(0);
  });
});
