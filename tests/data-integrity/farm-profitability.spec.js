// tests/data-integrity/farm-profitability.spec.js
// Phase 27: regression protection for Farm Profitability
// (window.getAnimalProfitability / rankAnimalProfitability). Realized
// P&L built entirely from Phase 2/7 evidence -- no new storage.

const { test, expect } = require('@playwright/test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

async function setupProfitMocks(page, overrides = {}) {
  await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
  await page.goto(`${BASE_URL}/dashboard.html`);
  await page.waitForTimeout(600);
  await page.evaluate((ov) => {
    window.fbGet = async (c) => (ov[c] !== undefined ? ov[c] : []);
    window.getUser = () => ({ name: 'T', role: 'admin' });
  }, overrides);
}

test.describe('Farm Profitability (Phase 27)', () => {
  test('a sold animal: netResult = revenue - real cost of sale', async ({ page }) => {
    const docs = [{ _id: 'd1', type: 'animal_sale', sourceType: 'animal', sourceId: 'a1', journalEntryId: 'j1', total: 1500 }];
    const entries = [
      { _id: 'j2', sourceType: 'animal_sale_cogs', lines: [{ accountId: '5100', debit: 900, relatedAnimalId: 'a1' }, { accountId: '1500', credit: 900, relatedAnimalId: 'a1' }] },
    ];
    await setupProfitMocks(page, { source_documents: docs, journal_entries: entries, animal_cost_ledger: [{ animalId: 'a1', costType: 'purchase', amount: 900 }] });
    const r = await page.evaluate(() => window.getAnimalProfitability('a1'));
    expect(r.ok).toBe(true);
    expect(r.outcome).toBe('sold');
    expect(r.revenue).toBe(1500);
    expect(r.costOfSale).toBe(900);
    expect(r.netResult).toBe(600);
  });

  test('a dead animal with a known cost basis: netResult is the negative write-off loss, no revenue', async ({ page }) => {
    const entries = [
      { _id: 'j1', sourceType: 'animal_death_writeoff', lines: [{ accountId: '5150', debit: 400, relatedAnimalId: 'a2' }, { accountId: '1500', credit: 400, relatedAnimalId: 'a2' }] },
    ];
    await setupProfitMocks(page, { source_documents: [], journal_entries: entries, animal_cost_ledger: [{ animalId: 'a2', costType: 'purchase', amount: 400 }] });
    const r = await page.evaluate(() => window.getAnimalProfitability('a2'));
    expect(r.outcome).toBe('died');
    expect(r.revenue).toBe(0);
    expect(r.writeOffLoss).toBe(400);
    expect(r.netResult).toBe(-400);
  });

  test('an animal still alive (neither sold nor died): netResult is null, never a fabricated zero', async ({ page }) => {
    await setupProfitMocks(page, { source_documents: [], journal_entries: [], animal_cost_ledger: [{ animalId: 'a3', costType: 'purchase', amount: 250 }] });
    const r = await page.evaluate(() => window.getAnimalProfitability('a3'));
    expect(r.outcome).toBe('active');
    expect(r.netResult).toBeNull();
    expect(r.currentCostBasis).toBe(250);
  });

  test('rankAnimalProfitability: sorts realized outcomes descending and separates still-active animals', async ({ page }) => {
    const docs = [{ _id: 'd1', type: 'animal_sale', sourceType: 'animal', sourceId: 'a1', journalEntryId: 'j1', total: 1000 }];
    const entries = [
      { _id: 'j2', sourceType: 'animal_sale_cogs', lines: [{ accountId: '5100', debit: 600, relatedAnimalId: 'a1' }] },
      { _id: 'j3', sourceType: 'animal_death_writeoff', lines: [{ accountId: '5150', debit: 200, relatedAnimalId: 'a2' }] },
    ];
    await setupProfitMocks(page, { source_documents: docs, journal_entries: entries, animal_cost_ledger: [] });
    const r = await page.evaluate(() => window.rankAnimalProfitability(['a1', 'a2', 'a3']));
    expect(r.ok).toBe(true);
    expect(r.realized.length).toBe(2);
    expect(r.realized[0].animalId).toBe('a1'); // 400 > -200
    expect(r.realized[1].animalId).toBe('a2');
    expect(r.stillActive.length).toBe(1);
    expect(r.stillActive[0].animalId).toBe('a3');
  });

  test('permission: a role without can("finance") is refused for both functions', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'S', role: 'supervisor' })));
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForTimeout(600);
    await page.evaluate((ov) => { window.fbGet = async (c) => (ov[c] !== undefined ? ov[c] : []); }, { source_documents: [], journal_entries: [], animal_cost_ledger: [] });
    const r1 = await page.evaluate(() => window.getAnimalProfitability('a1'));
    const r2 = await page.evaluate(() => window.rankAnimalProfitability(['a1']));
    expect(r1.ok).toBe(false);
    expect(r2.ok).toBe(false);
  });
});
