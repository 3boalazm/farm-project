// tests/data-integrity/real-world-scenario.spec.js
// Phase 43: Real-World Scenario Test. Unlike every other spec file in
// this suite (which resets a fresh mock store per test and exercises
// ONE function in isolation), this test chains a realistic farm
// bookkeeping month end-to-end -- seed chart of accounts, open a
// fiscal period, open a bank account, buy an animal, sell it at a
// profit, pay a cash expense, reconcile the bank, close the month, and
// pull every report -- with real data flowing between every step, the
// same way an actual farm's month would unfold. It proves the phases
// compose correctly together, not just individually.

const { test, expect } = require('../fixtures/farm-test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

test('a full realistic farm accounting month, end-to-end, stays internally consistent at every stage', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'مدير النظام', role: 'admin' })));
  await page.goto(`${BASE_URL}/dashboard.html`);
  await page.waitForTimeout(600);

  await page.evaluate(() => {
    window._store = {};
    window.fbGet = async (c) => (window._store[c] !== undefined ? window._store[c] : []);
    window.fbPost = async (c, d) => {
      const id = c + '_' + Math.floor(Math.random() * 1e9);
      window._store[c] = window._store[c] || [];
      window._store[c].push({ _id: id, ...d });
      return id;
    };
    window.fbPut = async (c, id, d) => {
      window._store[c] = window._store[c] || [];
      const existing = window._store[c].find((r) => r._id === id);
      if (existing) Object.assign(existing, d); else window._store[c].push({ _id: id, ...d });
      return id;
    };
    window.fbPatch = async (c, id, d) => {
      window._store[c] = (window._store[c] || []).map((r) => (r._id === id ? { ...r, ...d } : r));
    };
    window.fbCacheInvalidate = () => {};
    window.getUser = () => ({ name: 'مدير النظام', role: 'admin' });
  });

  // 1. Seed the chart of accounts
  const seed = await page.evaluate(() => window.seedDefaultChartOfAccounts());
  expect(seed.ok).toBe(true);

  // 2. Open the fiscal period
  const period = await page.evaluate(() => window.createFiscalPeriod({ periodKey: '2026-01', startDate: '2026-01-01', endDate: '2026-01-31' }));
  expect(period.ok).toBe(true);

  // 3. Open a bank account with a 5000 opening balance
  const cba = await page.evaluate(() => window.createCashBankAccount({ name: 'بنك المزرعة', type: 'bank', linkedAccountId: '1200', openingBalance: 5000, openingDate: '2026-01-01' }));
  expect(cba.ok).toBe(true);
  const cbaId = cba.id;

  // 4. Buy an animal for 1000 cash
  const purchase = await page.evaluate(() => window.postAnimalPurchase({
    animalId: 'animal1', operationId: 'op-purchase-1', amount: 1000, date: '2026-01-02',
    paymentMode: 'cash', cashAccountId: '1200', animalTag: 'G-001',
  }));
  expect(purchase.ok).toBe(true);

  // 5. Sell it for 1800 cash -- real cost basis (1000) flows into COGS automatically
  const sale = await page.evaluate(() => window.postAnimalSale({
    animalId: 'animal1', operationId: 'op-sale-1', salePrice: 1800, date: '2026-01-20',
    paymentMode: 'cash', cashAccountId: '1200', revenueAccountId: '4100', animalTag: 'G-001',
  }));
  expect(sale.ok).toBe(true);
  expect(sale.costBasisKnown).toBe(true);
  expect(sale.knownCost).toBe(1000);

  // 6. Pay a 300 feed expense in cash
  const expense = await page.evaluate(() => window.postJournalEntry({
    date: '2026-01-10', description: 'شراء أعلاف نقدًا', sourceType: 'manual',
    lines: [{ accountId: '6100', debit: 300 }, { accountId: '1200', credit: 300 }],
  }));
  expect(expense.ok).toBe(true);

  // Bank balance must be exactly 5000 - 1000 - 300 + 1800 = 5500
  const balance = await page.evaluate((id) => window.getCashBankBalance(id), cbaId);
  expect(balance.balance).toBe(5500);

  // 7. Reconcile the bank against the real statement balance
  const recon = await page.evaluate(({ cbaId }) => {
    const allEntries = window._store.journal_entries.map((e) => e._id);
    return window.reconcileBankAccount({ operationId: 'op-recon-1', cashBankAccountId: cbaId, statementDate: '2026-01-31', statementBalance: 5500, clearedJournalEntryIds: allEntries });
  }, { cbaId });
  expect(recon.ok).toBe(true);
  expect(recon.difference).toBe(0);
  expect(recon.matched).toBe(true);

  // Income Statement and Balance Sheet BEFORE month-end close
  const before = await page.evaluate(() => Promise.all([
    window.getIncomeStatement('2026-01-01', '2026-01-31'),
    window.getBalanceSheet('2026-01-31'),
  ]));
  const [isBefore, bsBefore] = before;
  expect(isBefore.totalRevenue).toBe(1800);
  expect(isBefore.totalExpense).toBe(1300); // 1000 COGS + 300 feed
  expect(isBefore.netIncome).toBe(500);
  expect(bsBefore.totalAssets).toBe(5500);
  expect(bsBefore.totalEquity).toBe(5500);
  expect(bsBefore.balanced).toBe(true);
  const unclosedLine = bsBefore.equity.find((e) => e.accountId === null);
  expect(unclosedLine.balance).toBe(500);

  // 8. Run month-end close
  const close = await page.evaluate(() => window.runMonthEndClose('2026-01'));
  expect(close.ok).toBe(true);
  expect(close.netIncome).toBe(500);
  expect(close.closed).toBe(true);

  // Critical: re-running the Income Statement for the SAME closed period afterward
  // must still show the real, un-corrupted figures.
  const after = await page.evaluate(() => Promise.all([
    window.getIncomeStatement('2026-01-01', '2026-01-31'),
    window.getBalanceSheet('2026-01-31'), // still shows unclosed-earnings line (closing entry is dated the NEXT day)
    window.getBalanceSheet('2026-02-01'), // now includes the closing entry -- earnings rolled into 3300 directly
  ]));
  const [isAfter, bsStillBefore, bsAfterClose] = after;
  expect(isAfter.totalRevenue).toBe(1800);
  expect(isAfter.totalExpense).toBe(1300);
  expect(isAfter.netIncome).toBe(500);
  expect(bsStillBefore.equity.find((e) => e.accountId === null).balance).toBe(500);
  expect(bsAfterClose.equity.find((e) => e.accountId === null)).toBeUndefined(); // rolled into 3300, no more separate line
  expect(bsAfterClose.equity.find((e) => e.accountId === '3300').balance).toBe(5500);
  expect(bsAfterClose.totalEquity).toBe(5500);
  expect(bsAfterClose.balanced).toBe(true);

  // Final cross-cutting checks: integrity, cross-consistency, profitability, data quality
  const final = await page.evaluate(({ cbaId }) => Promise.all([
    window.getFinancialIntegrityStatus(),
    window.validateFinancialReportsCrossConsistency('2026-01-31'),
    window.getBankReconciliationHistory(cbaId),
    window.getTrialBalance('2026-01-31'),
    window.getAnimalProfitability('animal1'),
    window.runFinancialDataQualityScan(),
  ]), { cbaId });
  const [integrity, crossCheck, reconHistory, trialBalance, profitability, scan] = final;

  expect(integrity.healthy).toBe(true);
  expect(crossCheck.allPass).toBe(true);
  expect(reconHistory.length).toBe(1);
  expect(trialBalance.balanced).toBe(true);
  expect(profitability.outcome).toBe('sold');
  expect(profitability.netResult).toBe(800); // 1800 sale - 1000 cost basis
  expect(scan.issueCount).toBe(0);
});
