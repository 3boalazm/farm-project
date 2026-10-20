// tests/data-integrity/animal-accounting.spec.js
// Phase 7: regression protection for Animal Accounting
// (window.recordAnimalCost / getAnimalCostBasis / postAnimalPurchase /
// postAnimalSale / postAnimalDeath). Purchase/sale are Phase 2 source
// documents under the hood; only the animal-specific recipe and the
// cost-basis-gated COGS/write-off logic are tested here.

const { test, expect } = require('../fixtures/farm-test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

async function setupAnimalMocks(page, overrides = {}) {
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
  { _id: '1500', code: '1500', name_ar: 'الأصول الحيوانية', type: 'ASSET', postable: true, active: true },
  { _id: '2100', code: '2100', name_ar: 'ذمم دائنة', type: 'LIABILITY', postable: true, active: true },
  { _id: '4100', code: '4100', name_ar: 'بيع حيوانات', type: 'REVENUE', postable: true, active: true },
  { _id: '5100', code: '5100', name_ar: 'تكلفة بيع الحيوانات', type: 'EXPENSE', postable: true, active: true },
  { _id: '5150', code: '5150', name_ar: 'خسارة نفوق المواشي', type: 'EXPENSE', postable: true, active: true },
];

test.describe('Animal Accounting (Phase 7)', () => {
  test('postAnimalPurchase (cash): Debit Livestock Asset / Credit Cash, and records the purchase as a cost-ledger entry', async ({ page }) => {
    await setupAnimalMocks(page, { accounts: ACCOUNTS, source_documents: [], animal_cost_ledger: [] });
    const r = await page.evaluate(() => window.postAnimalPurchase({
      animalId: 'a1', animalTag: 'G-1', amount: 2000, paymentMode: 'cash', cashAccountId: '1110', operationId: 'ap-1',
    }));
    expect(r.ok).toBe(true);
    expect(r.status).toBe('PAID');
    const jeWrite = await page.evaluate(() => window._writeLog.find((w) => w.c === 'journal_entries'));
    const assetLine = jeWrite.d.lines.find((l) => l.accountId === '1500');
    const cashLine = jeWrite.d.lines.find((l) => l.accountId === '1110');
    expect(assetLine.debit).toBe(2000);
    expect(cashLine.credit).toBe(2000);
    const costBasis = await page.evaluate(() => window.getAnimalCostBasis('a1'));
    expect(costBasis.knownCost).toBe(2000);
    expect(costBasis.hasCostBasis).toBe(true);
  });

  test('postAnimalSale: with a known cost basis, posts BOTH the revenue leg AND a separate Cost of Animal Sales leg', async ({ page }) => {
    const costLedger = [{ _id: 'c1', animalId: 'a1', costType: 'purchase', amount: 2000, operationId: 'seed-cost' }];
    await setupAnimalMocks(page, { accounts: ACCOUNTS, source_documents: [], animal_cost_ledger: costLedger });
    const r = await page.evaluate(() => window.postAnimalSale({
      animalId: 'a1', animalTag: 'G-1', salePrice: 3500, paymentMode: 'cash', cashAccountId: '1110', revenueAccountId: '4100', operationId: 'as-1',
    }));
    expect(r.ok).toBe(true);
    expect(r.costBasisKnown).toBe(true);
    expect(r.knownCost).toBe(2000);
    expect(r.cogsJournalEntryId).toBeTruthy();
    const jeWrites = await page.evaluate(() => window._writeLog.filter((w) => w.c === 'journal_entries'));
    expect(jeWrites.length).toBe(2);
    const revenueEntry = jeWrites.find((w) => w.d.sourceType === 'source_document');
    const cogsEntry = jeWrites.find((w) => w.d.sourceType === 'animal_sale_cogs');
    const revLine = revenueEntry.d.lines.find((l) => l.accountId === '4100');
    const cashLine = revenueEntry.d.lines.find((l) => l.accountId === '1110');
    expect(revLine.credit).toBe(3500);
    expect(cashLine.debit).toBe(3500);
    const cogsExpLine = cogsEntry.d.lines.find((l) => l.accountId === '5100');
    const cogsAssetLine = cogsEntry.d.lines.find((l) => l.accountId === '1500');
    expect(cogsExpLine.debit).toBe(2000);
    expect(cogsAssetLine.credit).toBe(2000);
  });

  test('postAnimalSale: with NO known cost basis, posts only the revenue leg -- never fabricates a cost', async ({ page }) => {
    await setupAnimalMocks(page, { accounts: ACCOUNTS, source_documents: [], animal_cost_ledger: [] });
    const r = await page.evaluate(() => window.postAnimalSale({
      animalId: 'a2', animalTag: 'G-2', salePrice: 3500, paymentMode: 'cash', cashAccountId: '1110', revenueAccountId: '4100', operationId: 'as-2',
    }));
    expect(r.ok).toBe(true);
    expect(r.costBasisKnown).toBe(false);
    expect(r.knownCost).toBe(0);
    expect(r.cogsJournalEntryId).toBeNull();
    const jeWrites = await page.evaluate(() => window._writeLog.filter((w) => w.c === 'journal_entries'));
    expect(jeWrites.length).toBe(1); // only the revenue entry, no COGS entry
  });

  test('postAnimalSale: idempotent replay posts nothing a second time (neither leg)', async ({ page }) => {
    const costLedger = [{ _id: 'c1', animalId: 'a1', costType: 'purchase', amount: 2000, operationId: 'seed-cost' }];
    await setupAnimalMocks(page, { accounts: ACCOUNTS, source_documents: [], animal_cost_ledger: costLedger });
    await page.evaluate(() => window.postAnimalSale({ animalId: 'a1', salePrice: 3500, paymentMode: 'cash', cashAccountId: '1110', revenueAccountId: '4100', operationId: 'as-1' }));
    const r2 = await page.evaluate(() => window.postAnimalSale({ animalId: 'a1', salePrice: 3500, paymentMode: 'cash', cashAccountId: '1110', revenueAccountId: '4100', operationId: 'as-1' }));
    expect(r2.idempotent).toBe(true);
    const jeWrites = await page.evaluate(() => window._writeLog.filter((w) => w.c === 'journal_entries'));
    expect(jeWrites.length).toBe(2); // from the first call only
  });

  test('postAnimalDeath: with a known cost basis, writes off Debit Loss on Livestock / Credit Livestock Asset', async ({ page }) => {
    const costLedger = [{ _id: 'c1', animalId: 'a1', costType: 'purchase', amount: 1200, operationId: 'seed-cost' }];
    await setupAnimalMocks(page, { accounts: ACCOUNTS, animal_cost_ledger: costLedger, journal_entries: [] });
    const r = await page.evaluate(() => window.postAnimalDeath({ animalId: 'a1', animalTag: 'G-1', operationId: 'ad-1' }));
    expect(r.ok).toBe(true);
    expect(r.costBasisKnown).toBe(true);
    expect(r.amount).toBe(1200);
    const jeWrite = await page.evaluate(() => window._writeLog.find((w) => w.c === 'journal_entries'));
    const lossLine = jeWrite.d.lines.find((l) => l.accountId === '5150');
    const assetLine = jeWrite.d.lines.find((l) => l.accountId === '1500');
    expect(lossLine.debit).toBe(1200);
    expect(assetLine.credit).toBe(1200);
  });

  test('postAnimalDeath: with NO known cost basis, posts nothing -- never invents a write-off value', async ({ page }) => {
    await setupAnimalMocks(page, { accounts: ACCOUNTS, animal_cost_ledger: [], journal_entries: [] });
    const r = await page.evaluate(() => window.postAnimalDeath({ animalId: 'a3', operationId: 'ad-2' }));
    expect(r.ok).toBe(true);
    expect(r.posted).toBe(false);
    expect(r.costBasisKnown).toBe(false);
    const jeWrites = await page.evaluate(() => window._writeLog.filter((w) => w.c === 'journal_entries'));
    expect(jeWrites).toEqual([]);
  });

  test('postAnimalDeath: idempotent -- replaying the same operationId does not post a second write-off', async ({ page }) => {
    const costLedger = [{ _id: 'c1', animalId: 'a1', costType: 'purchase', amount: 1200, operationId: 'seed-cost' }];
    await setupAnimalMocks(page, { accounts: ACCOUNTS, animal_cost_ledger: costLedger, journal_entries: [] });
    await page.evaluate(() => window.postAnimalDeath({ animalId: 'a1', operationId: 'ad-1' }));
    const r2 = await page.evaluate(() => window.postAnimalDeath({ animalId: 'a1', operationId: 'ad-1' }));
    expect(r2.idempotent).toBe(true);
    const jeWrites = await page.evaluate(() => window._writeLog.filter((w) => w.c === 'journal_entries'));
    expect(jeWrites.length).toBe(1);
  });

  test('getAnimalCostBasis: sums entries by type without claiming completeness', async ({ page }) => {
    const costLedger = [
      { _id: 'c1', animalId: 'a1', costType: 'purchase', amount: 1000 },
      { _id: 'c2', animalId: 'a1', costType: 'feed', amount: 150 },
      { _id: 'c3', animalId: 'a2', costType: 'purchase', amount: 999 },
    ];
    await setupAnimalMocks(page, { animal_cost_ledger: costLedger });
    const r = await page.evaluate(() => window.getAnimalCostBasis('a1'));
    expect(r.knownCost).toBe(1150);
    expect(r.byType.purchase).toBe(1000);
    expect(r.byType.feed).toBe(150);
    expect(r.entryCount).toBe(2);
  });

  test('recordAnimalCost: idempotent on operationId', async ({ page }) => {
    await setupAnimalMocks(page, { animal_cost_ledger: [] });
    await page.evaluate(() => window.recordAnimalCost({ animalId: 'a1', costType: 'feed', amount: 50, operationId: 'rc-1' }));
    const r2 = await page.evaluate(() => window.recordAnimalCost({ animalId: 'a1', costType: 'feed', amount: 50, operationId: 'rc-1' }));
    expect(r2.idempotent).toBe(true);
    const writes = await page.evaluate(() => window._writeLog.filter((w) => w.c === 'animal_cost_ledger'));
    expect(writes.length).toBe(1);
  });

  test('permission: a role without can("finance") cannot purchase, sell, or write off an animal', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'S', role: 'supervisor' })));
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForTimeout(600);
    await page.evaluate((ov) => {
      window._store = JSON.parse(JSON.stringify(ov));
      window._writeLog = [];
      window.fbGet = async (c) => (window._store[c] !== undefined ? window._store[c] : []);
      window.fbGetSafe = window.fbGet;   // O-19: reads moved onto fbGetSafe() in the 2026-10 audit; a mock that patches only fbGet leaves it reading the fake database
      window.fbPost = async (c, d) => { window._writeLog.push({ op: 'post', c, d }); return 'id'; };
      window.fbPatch = async (c, id, d) => { window._writeLog.push({ op: 'patch', c, id, d }); };
    }, { accounts: ACCOUNTS, animal_cost_ledger: [{ _id: 'c1', animalId: 'a1', costType: 'purchase', amount: 1000 }] });
    const purchase = await page.evaluate(() => window.postAnimalPurchase({ animalId: 'a1', amount: 100, paymentMode: 'cash', cashAccountId: '1110', operationId: 'x1' }));
    const sale = await page.evaluate(() => window.postAnimalSale({ animalId: 'a1', salePrice: 100, paymentMode: 'cash', cashAccountId: '1110', revenueAccountId: '4100', operationId: 'x2' }));
    const death = await page.evaluate(() => window.postAnimalDeath({ animalId: 'a1', operationId: 'x3' }));
    expect(purchase.ok).toBe(false);
    expect(sale.ok).toBe(false);
    expect(death.ok).toBe(false);
    const writes = await page.evaluate(() => window._writeLog);
    expect(writes).toEqual([]);
  });

  test('permission: a role without can("finance") cannot read an animal\'s cost basis either', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'S', role: 'supervisor' })));
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForTimeout(600);
    await page.evaluate((ov) => { window.fbGet = async (c) => (ov[c] !== undefined ? ov[c] : []); }, { animal_cost_ledger: [{ _id: 'c1', animalId: 'a1', costType: 'purchase', amount: 1000 }] });
    const r = await page.evaluate(() => window.getAnimalCostBasis('a1'));
    expect(r.ok).toBe(false);
  });
});
