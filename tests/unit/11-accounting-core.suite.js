// Module 11 — Accounting engine core: chart of accounts, journal entries,
// trial balance, income statement, balance sheet, general ledger.
const { bootApp, suite, assert, J } = require('./harness');

const CASH = '1110', BANK = '1200', AR = '1300', AP = '2100';
const CAPITAL = '3100', RETAINED = '3300';
const ANIMAL_SALES = '4100', MILK = '4200', FEED_EXP = '6100';

module.exports = suite('11 · Accounting engine core', ({ test }) => {
  let app, db;
  const reset = async () => {
    db.reset({ users: db.data.users });
    app.eval(`fbCacheInvalidate()`);
    const seeded = J(await app.eval(`(async()=>await seedDefaultChartOfAccounts())()`));
    assert.strictEqual(seeded.ok, true, JSON.stringify(seeded));
    app.eval(`fbCacheInvalidate()`);
  };

  test('boots', async () => { app = await bootApp(); db = app.db; });

  test('seedDefaultChartOfAccounts() creates the full chart with correct normal balances', async () => {
    await reset();
    const accounts = J(db.collection('accounts'));
    assert.ok(accounts.length >= 40, `expected the full default chart, got ${accounts.length}`);
    const byCode = Object.fromEntries(accounts.map((a) => [a._id, a]));
    assert.strictEqual(byCode[CASH].type, 'ASSET');
    assert.strictEqual(byCode[CASH].normalBalance, 'debit');
    assert.strictEqual(byCode[AP].normalBalance, 'credit');
    assert.strictEqual(byCode[ANIMAL_SALES].normalBalance, 'credit');
    assert.strictEqual(byCode['1690'].normalBalance, 'credit', 'accumulated depreciation is a CONTRA asset → credit');
    assert.strictEqual(byCode['3200'].normalBalance, 'debit', 'owner drawings is a CONTRA equity account → debit');
    assert.strictEqual(byCode['1000'].postable, false, 'round-number headers are not postable');
    assert.strictEqual(byCode[CASH].postable !== false, true);
  });

  test('seeding is idempotent and never overwrites an existing chart', async () => {
    await reset();
    const before = J(db.collection('accounts')).length;
    const again = J(await app.eval(`(async()=>await seedDefaultChartOfAccounts())()`));
    assert.strictEqual(again.skipped, true);
    assert.strictEqual(again.seeded, 0);
    assert.strictEqual(J(db.collection('accounts')).length, before);
  });

  test('a failed read refuses to re-seed the chart (never clobbers a live one)', async () => {
    await reset();
    const edited = db.data.accounts[CASH];
    edited.name_ar = 'اسم معدل يدويًا';
    // Simulate the read failing on the next call.
    const origFetch = app.window.fetch;
    app.window.fetch = async (url, opts) => {
      if (!opts || (opts.method || 'GET') === 'GET') throw new TypeError('Failed to fetch');
      return origFetch(url, opts);
    };
    app.eval(`fbCacheInvalidate()`);
    const r = J(await app.eval(`(async()=>await seedDefaultChartOfAccounts())()`));
    app.window.fetch = origFetch;
    assert.strictEqual(r.ok, false, 'must refuse rather than guess');
    assert.strictEqual(db.data.accounts[CASH].name_ar, 'اسم معدل يدويًا', 'the live chart is untouched');
  });

  test('createAccount() validates code/name/type and refuses a duplicate code', async () => {
    await reset();
    assert.strictEqual((J(await app.eval(`(async()=>await createAccount({code:'7000',name_ar:'x'}))()`))).ok, false, 'missing type');
    assert.strictEqual((J(await app.eval(`(async()=>await createAccount({code:'7000',type:'ASSET'}))()`))).ok, false, 'missing name');
    assert.strictEqual((J(await app.eval(`(async()=>await createAccount({name_ar:'x',type:'ASSET'}))()`))).ok, false, 'missing code');
    assert.strictEqual((J(await app.eval(`(async()=>await createAccount({code:'7000',name_ar:'x',type:'NOPE'}))()`))).ok, false, 'bad type');
    const ok = J(await app.eval(`(async()=>await createAccount({code:'7000',name_ar:'حساب جديد',type:'EXPENSE'}))()`));
    assert.strictEqual(ok.ok, true, JSON.stringify(ok));
    const dupe = J(await app.eval(`(async()=>await createAccount({code:'7000',name_ar:'مكرر',type:'EXPENSE'}))()`));
    assert.strictEqual(dupe.ok, false);
    assert.match(dupe.error, /مستخدم بالفعل/);
  });

  test('postJournalEntry() refuses an unbalanced entry and never writes it', async () => {
    await reset();
    const r = J(await app.eval(`(async()=>await postJournalEntry({date:'2026-05-01',lines:[{accountId:${JSON.stringify(CASH)},debit:100},{accountId:${JSON.stringify(ANIMAL_SALES)},credit:99.99}]}))()`));
    assert.strictEqual(r.ok, false);
    assert.match(r.error, /غير متزن/);
    assert.deepStrictEqual(J(db.collection('journal_entries')), []);
  });

  test('postJournalEntry() refuses one line, both-sided lines, zero lines and negatives', async () => {
    await reset();
    const cases = [
      { lines: [{ accountId: CASH, debit: 100 }] },
      { lines: [{ accountId: CASH, debit: 100, credit: 100 }, { accountId: ANIMAL_SALES, credit: 0 }] },
      { lines: [{ accountId: CASH, debit: -100 }, { accountId: ANIMAL_SALES, credit: -100 }] },
      { lines: [{ debit: 100 }, { credit: 100 }] },
      { lines: [] },
    ];
    for (const c of cases) {
      const r = J(await app.eval(`(async()=>await postJournalEntry(${JSON.stringify(c)}))()`));
      assert.strictEqual(r.ok, false, JSON.stringify(c));
      assert.ok(r.error && r.error.length);
    }
    assert.deepStrictEqual(J(db.collection('journal_entries')), []);
  });

  test('postJournalEntry() refuses a non-existent, inactive or non-postable account', async () => {
    await reset();
    const ghost = J(await app.eval(`(async()=>await postJournalEntry({lines:[{accountId:'9999',debit:10},{accountId:${JSON.stringify(CASH)},credit:10}]}))()`));
    assert.strictEqual(ghost.ok, false);
    assert.match(ghost.error, /حساب غير موجود/);
    const header = J(await app.eval(`(async()=>await postJournalEntry({lines:[{accountId:'1000',debit:10},{accountId:${JSON.stringify(CASH)},credit:10}]}))()`));
    assert.strictEqual(header.ok, false);
    assert.match(header.error, /حساب رئيسي/);
    await app.eval(`(async()=>await fbPatch('accounts',${JSON.stringify(CASH)},{active:false}))()`);
    const inactive = J(await app.eval(`(async()=>await postJournalEntry({lines:[{accountId:${JSON.stringify(CASH)},debit:10},{accountId:${JSON.stringify(ANIMAL_SALES)},credit:10}]}))()`));
    assert.strictEqual(inactive.ok, false);
    assert.match(inactive.error, /غير نشط/);
  });

  test('a posted entry is stamped POSTED, totals both sides, and records who posted it', async () => {
    await reset();
    const r = J(await app.eval(`(async()=>await postJournalEntry({date:'2026-05-01',description:'بيع حليب',sourceType:'manual',lines:[{accountId:${JSON.stringify(CASH)},debit:1500},{accountId:${JSON.stringify(MILK)},credit:1500}]}))()`));
    assert.strictEqual(r.ok, true, JSON.stringify(r));
    const e = J(db.collection('journal_entries'))[0];
    assert.strictEqual(e.status, 'POSTED');
    assert.strictEqual(e.totalDebit, 1500);
    assert.strictEqual(e.totalCredit, 1500);
    assert.strictEqual(e.postedBy, 'مدير المزرعة');
    assert.ok(e.postedAt);
  });

  test('reverseJournalEntry() posts a swapped copy and refuses a double reversal', async () => {
    await reset();
    const first = J(await app.eval(`(async()=>await postJournalEntry({date:'2026-05-01',description:'خطأ',lines:[{accountId:${JSON.stringify(CASH)},debit:500},{accountId:${JSON.stringify(FEED_EXP)},credit:500}]}))()`));
    const rev = J(await app.eval(`(async()=>await reverseJournalEntry(${JSON.stringify(first.id)}))()`));
    assert.strictEqual(rev.ok, true, JSON.stringify(rev));
    const entries = J(db.collection('journal_entries'));
    assert.strictEqual(entries.length, 2);
    const reversal = entries.find((e) => e.sourceType === 'reversal');
    assert.strictEqual(reversal.reversesJournalEntryId, first.id);
    assert.strictEqual(reversal.lines[0].credit, 500, 'debit and credit are swapped');
    const again = J(await app.eval(`(async()=>await reverseJournalEntry(${JSON.stringify(first.id)}))()`));
    assert.strictEqual(again.ok, false);
    assert.match(again.error, /بالفعل/);
    const ghost = J(await app.eval(`(async()=>await reverseJournalEntry('nope'))()`));
    assert.strictEqual(ghost.ok, false);
    // Net effect on the ledger must be zero.
    const tb = J(await app.eval(`(async()=>await getTrialBalance('2026-12-31'))()`));
    assert.strictEqual(tb.totalDebit, tb.totalCredit);
    assert.strictEqual(tb.rows.length, 0, 'a posted entry and its reversal leave no balance behind');
  });

  test('getTrialBalance() balances by construction and lists net sides correctly', async () => {
    await reset();
    await app.eval(`(async()=>await postJournalEntry({date:'2026-05-01',lines:[{accountId:${JSON.stringify(CASH)},debit:1000},{accountId:${JSON.stringify(MILK)},credit:1000}]}))()`);
    await app.eval(`(async()=>await postJournalEntry({date:'2026-05-02',lines:[{accountId:${JSON.stringify(FEED_EXP)},debit:250.5},{accountId:${JSON.stringify(CASH)},credit:250.5}]}))()`);
    const tb = J(await app.eval(`(async()=>await getTrialBalance('2026-05-31'))()`));
    assert.strictEqual(tb.ok, true);
    assert.strictEqual(tb.balanced, true);
    assert.strictEqual(tb.totalDebit, tb.totalCredit);
    const cash = tb.rows.find((r) => r.accountId === CASH);
    assert.strictEqual(cash.debit, 749.5, 'cash nets to a DEBIT column entry');
    assert.strictEqual(cash.credit, 0);
    const milk = tb.rows.find((r) => r.accountId === MILK);
    assert.strictEqual(milk.credit, 1000, 'revenue nets to the CREDIT column');
    assert.strictEqual(milk.debit, 0);
  });

  test('getTrialBalance() excludes entries dated after asOfDate', async () => {
    await reset();
    await app.eval(`(async()=>await postJournalEntry({date:'2026-05-01',lines:[{accountId:${JSON.stringify(CASH)},debit:100},{accountId:${JSON.stringify(MILK)},credit:100}]}))()`);
    await app.eval(`(async()=>await postJournalEntry({date:'2026-07-01',lines:[{accountId:${JSON.stringify(CASH)},debit:900},{accountId:${JSON.stringify(MILK)},credit:900}]}))()`);
    const tb = J(await app.eval(`(async()=>await getTrialBalance('2026-05-31'))()`));
    assert.strictEqual(tb.totalDebit, 100);
  });

  test('getIncomeStatement() reports revenue, expense and net income for the period only', async () => {
    await reset();
    await app.eval(`(async()=>await postJournalEntry({date:'2026-05-10',lines:[{accountId:${JSON.stringify(CASH)},debit:2000},{accountId:${JSON.stringify(MILK)},credit:2000}]}))()`);
    await app.eval(`(async()=>await postJournalEntry({date:'2026-05-20',lines:[{accountId:${JSON.stringify(FEED_EXP)},debit:500},{accountId:${JSON.stringify(CASH)},credit:500}]}))()`);
    await app.eval(`(async()=>await postJournalEntry({date:'2026-06-01',lines:[{accountId:${JSON.stringify(CASH)},debit:7000},{accountId:${JSON.stringify(MILK)},credit:7000}]}))()`);
    const is = J(await app.eval(`(async()=>await getIncomeStatement('2026-05-01','2026-05-31'))()`));
    assert.strictEqual(is.ok, true);
    assert.strictEqual(is.totalRevenue, 2000);
    assert.strictEqual(is.totalExpense, 500);
    assert.strictEqual(is.netIncome, 1500);
    assert.strictEqual(is.revenue.length, 1);
    assert.strictEqual(is.revenue[0].name, 'بيع ألبان');
  });

  test('getBalanceSheet() satisfies Assets = Liabilities + Equity, incl. current earnings', async () => {
    await reset();
    // owner capital in cash
    await app.eval(`(async()=>await postJournalEntry({date:'2026-01-01',lines:[{accountId:${JSON.stringify(CASH)},debit:10000},{accountId:${JSON.stringify(CAPITAL)},credit:10000}]}))()`);
    // milk sale on credit (AR / revenue)
    await app.eval(`(async()=>await postJournalEntry({date:'2026-05-01',lines:[{accountId:${JSON.stringify(AR)},debit:3000},{accountId:${JSON.stringify(MILK)},credit:3000}]}))()`);
    // feed bought on credit (expense / AP)
    await app.eval(`(async()=>await postJournalEntry({date:'2026-05-02',lines:[{accountId:${JSON.stringify(FEED_EXP)},debit:800},{accountId:${JSON.stringify(AP)},credit:800}]}))()`);
    const bs = J(await app.eval(`(async()=>await getBalanceSheet('2026-05-31'))()`));
    assert.strictEqual(bs.ok, true, JSON.stringify(bs));
    assert.strictEqual(bs.totalAssets, 13000);
    assert.strictEqual(bs.totalLiabilities, 800);
    assert.strictEqual(bs.totalEquity, 12200, '10000 capital + 2200 current earnings');
    assert.strictEqual(bs.balanced, true, 'the accounting equation must hold');
    assert.ok(bs.equity.some((e) => /أرباح الفترة الحالية/.test(e.name)), 'unposted earnings are shown as their own line');
  });

  test('getAccountLedger() shows an opening balance then a chronological running balance', async () => {
    await reset();
    await app.eval(`(async()=>await postJournalEntry({date:'2026-01-01',lines:[{accountId:${JSON.stringify(CASH)},debit:1000},{accountId:${JSON.stringify(CAPITAL)},credit:1000}]}))()`);
    await app.eval(`(async()=>await postJournalEntry({date:'2026-05-01',lines:[{accountId:${JSON.stringify(CASH)},debit:400},{accountId:${JSON.stringify(MILK)},credit:400}]}))()`);
    await app.eval(`(async()=>await postJournalEntry({date:'2026-05-20',lines:[{accountId:${JSON.stringify(FEED_EXP)},debit:150},{accountId:${JSON.stringify(CASH)},credit:150}]}))()`);
    const led = J(await app.eval(`(async()=>await getAccountLedger(${JSON.stringify(CASH)},'2026-05-01','2026-05-31'))()`));
    assert.strictEqual(led.ok, true, JSON.stringify(led));
    assert.strictEqual(led.openingBalance, 1000);
    assert.strictEqual(led.rows.length, 2);
    assert.strictEqual(led.rows[0].runningBalance, 1400);
    assert.strictEqual(led.rows[1].runningBalance, 1250);
    assert.strictEqual(led.closingBalance, 1250);
  });

  test('every accounting entry point returns a structured error for a missing permission', async () => {
    await reset();
    app.eval(`setUser({id:'w1',role:'worker',name:'عامل'})`);
    for (const call of [
      `seedDefaultChartOfAccounts()`, `createAccount({code:'7001',name_ar:'x',type:'ASSET'})`,
      `postJournalEntry({lines:[{accountId:'1110',debit:1},{accountId:'4200',credit:1}]})`,
      `reverseJournalEntry('x')`, `getTrialBalance('2026-05-31')`, `getIncomeStatement('2026-01-01','2026-12-31')`,
      `getBalanceSheet('2026-12-31')`, `getAccountLedger('1110')`,
    ]) {
      const r = J(await app.eval(`(async()=>await ${call})()`));
      assert.strictEqual(r.ok, false, call);
      assert.match(r.error, /صلاحية/, call);
    }
    app.eval(`setUser({id:'admin1',role:'admin',name:'مدير المزرعة'})`);
  });

  test('the engine never throws: garbage input comes back as {ok:false}', async () => {
    await reset();
    for (const call of [`postJournalEntry()`, `postJournalEntry(null)`, `postJournalEntry({})`,
      `reverseJournalEntry()`, `getTrialBalance()`, `getIncomeStatement()`, `getBalanceSheet()`, `getAccountLedger()`,
      `createAccount()`, `seedDefaultChartOfAccounts()`]) {
      const r = await app.eval(`(async()=>{try{var x=await ${call};return x&&typeof x==='object'?{ok:!!x.ok}:{ok:true};}catch(e){return {threw:String(e.message)};}})()`);
      assert.strictEqual(J(r).threw, undefined, `${call} threw: ${J(r).threw}`);
    }
  });
});
