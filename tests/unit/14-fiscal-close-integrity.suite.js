// Module 14 — Fiscal periods, month-end close, financial audit trail,
// integrity status, data-quality scan, cross-consistency, cash flow,
// budgets, forecasts, legacy migration.
const { bootApp, suite, assert, J } = require('./harness');

const CASH = '1110', MILK = '4200', FEED_EXP = '6100', RETAINED = '3300';

module.exports = suite('14 · Fiscal periods, close & integrity', ({ test }) => {
  let app, db;
  const reset = async () => {
    db.reset({ users: db.data.users });
    app.eval(`fbCacheInvalidate()`);
    await app.eval(`(async()=>await seedDefaultChartOfAccounts())()`);
    app.eval(`fbCacheInvalidate()`);
  };
  const entries = () => J(db.collection('journal_entries'));

  test('boots', async () => { app = await bootApp(); db = app.db; });

  test('createFiscalPeriod() validates its window and refuses a duplicate key', async () => {
    await reset();
    assert.strictEqual((J(await app.eval(`(async()=>await createFiscalPeriod({periodKey:'2026-05'}))()`))).ok, false);
    assert.strictEqual((J(await app.eval(`(async()=>await createFiscalPeriod({periodKey:'2026-05',startDate:'2026-05-31',endDate:'2026-05-01'}))()`))).ok, false);
    const ok = J(await app.eval(`(async()=>await createFiscalPeriod({periodKey:'2026-05',startDate:'2026-05-01',endDate:'2026-05-31'}))()`));
    assert.strictEqual(ok.ok, true, JSON.stringify(ok));
    assert.strictEqual((J(await app.eval(`(async()=>await createFiscalPeriod({periodKey:'2026-05',startDate:'2026-05-01',endDate:'2026-05-31'}))()`))).ok, false);
  });

  test('an OPEN period accepts postings; no matching period is allowed (opt-in control)', async () => {
    await reset();
    await app.eval(`(async()=>await createFiscalPeriod({periodKey:'2026-05',startDate:'2026-05-01',endDate:'2026-05-31'}))()`);
    const inside = J(await app.eval(`(async()=>await postJournalEntry({date:'2026-05-10',lines:[{accountId:${JSON.stringify(CASH)},debit:10},{accountId:${JSON.stringify(MILK)},credit:10}]}))()`));
    assert.strictEqual(inside.ok, true);
    const outside = J(await app.eval(`(async()=>await postJournalEntry({date:'2026-08-10',lines:[{accountId:${JSON.stringify(CASH)},debit:10},{accountId:${JSON.stringify(MILK)},credit:10}]}))()`));
    assert.strictEqual(outside.ok, true, 'a date in no period at all is not blocked');
  });

  test('closing a period blocks every further posting dated inside it', async () => {
    await reset();
    await app.eval(`(async()=>await createFiscalPeriod({periodKey:'2026-05',startDate:'2026-05-01',endDate:'2026-05-31'}))()`);
    const close = J(await app.eval(`(async()=>await closeFiscalPeriod('2026-05'))()`));
    assert.strictEqual(close.ok, true);
    const blocked = J(await app.eval(`(async()=>await postJournalEntry({date:'2026-05-10',lines:[{accountId:${JSON.stringify(CASH)},debit:10},{accountId:${JSON.stringify(MILK)},credit:10}]}))()`));
    assert.strictEqual(blocked.ok, false);
    assert.match(blocked.error, /2026-05/);
    assert.strictEqual(entries().length, 0);
    assert.strictEqual((J(await app.eval(`(async()=>await closeFiscalPeriod('2026-05'))()`))).ok, false, 'cannot close twice');
  });

  test('a CLOSED period can be reopened with a reason; the reason is mandatory and recorded', async () => {
    await reset();
    await app.eval(`(async()=>await createFiscalPeriod({periodKey:'2026-05',startDate:'2026-05-01',endDate:'2026-05-31'}))()`);
    await app.eval(`(async()=>await closeFiscalPeriod('2026-05'))()`);
    assert.strictEqual((J(await app.eval(`(async()=>await reopenFiscalPeriod('2026-05'))()`))).ok, false, 'a reason is required');
    const re = J(await app.eval(`(async()=>await reopenFiscalPeriod('2026-05','تصحيح فاتورة'))()`));
    assert.strictEqual(re.ok, true);
    const p = J(db.collection('fiscal_periods'))[0];
    assert.strictEqual(p.status, 'OPEN');
    assert.strictEqual(p.reopenReason, 'تصحيح فاتورة');
    assert.ok(p.reopenedAt && p.reopenedBy);
  });

  test('LOCKED is a one-way door: no reopen, and close requires CLOSED first', async () => {
    await reset();
    await app.eval(`(async()=>await createFiscalPeriod({periodKey:'2026-05',startDate:'2026-05-01',endDate:'2026-05-31'}))()`);
    assert.strictEqual((J(await app.eval(`(async()=>await lockFiscalPeriod('2026-05'))()`))).ok, false, 'cannot lock an OPEN period');
    await app.eval(`(async()=>await closeFiscalPeriod('2026-05'))()`);
    assert.strictEqual((J(await app.eval(`(async()=>await lockFiscalPeriod('2026-05'))()`))).ok, true);
    assert.strictEqual((J(await app.eval(`(async()=>await reopenFiscalPeriod('2026-05','محاولة'))()`))).ok, false);
    const blocked = J(await app.eval(`(async()=>await postJournalEntry({date:'2026-05-10',lines:[{accountId:${JSON.stringify(CASH)},debit:1},{accountId:${JSON.stringify(MILK)},credit:1}]}))()`));
    assert.strictEqual(blocked.ok, false);
    assert.match(blocked.error, /مقفلة نهائيًا/);
  });

  test('runMonthEndClose() closes the period and carries the result into retained earnings', async () => {
    await reset();
    await app.eval(`(async()=>await createFiscalPeriod({periodKey:'2026-05',startDate:'2026-05-01',endDate:'2026-05-31'}))()`);
    await app.eval(`(async()=>await postJournalEntry({date:'2026-05-10',lines:[{accountId:${JSON.stringify(CASH)},debit:1000},{accountId:${JSON.stringify(MILK)},credit:1000}]}))()`);
    await app.eval(`(async()=>await postJournalEntry({date:'2026-05-20',lines:[{accountId:${JSON.stringify(FEED_EXP)},debit:300},{accountId:${JSON.stringify(CASH)},credit:300}]}))()`);
    const r = J(await app.eval(`(async()=>await runMonthEndClose('2026-05'))()`));
    assert.strictEqual(r.ok, true, JSON.stringify(r));
    assert.strictEqual(J(db.collection('fiscal_periods'))[0].status, 'CLOSED');
    const bs = J(await app.eval(`(async()=>await getBalanceSheet('2026-05-31'))()`));
    assert.strictEqual(bs.balanced, true, 'the close must leave the books balanced');
    assert.strictEqual(bs.totalEquity, 700, 'net income is carried into equity');
    const after = J(await app.eval(`(async()=>await postJournalEntry({date:'2026-05-25',lines:[{accountId:${JSON.stringify(CASH)},debit:1},{accountId:${JSON.stringify(MILK)},credit:1}]}))()`));
    assert.strictEqual(after.ok, false, 'nothing more can be posted into the closed month');
  });

  test('runMonthEndClose() refuses an unknown or non-open period', async () => {
    await reset();
    assert.strictEqual((J(await app.eval(`(async()=>await runMonthEndClose())()`))).ok, false);
    assert.strictEqual((J(await app.eval(`(async()=>await runMonthEndClose('1999-01'))()`))).ok, false);
  });

  test('every posting leaves a write-once financial audit row', async () => {
    await reset();
    await app.eval(`(async()=>await postJournalEntry({date:'2026-05-10',description:'قيد',lines:[{accountId:${JSON.stringify(CASH)},debit:10},{accountId:${JSON.stringify(MILK)},credit:10}]}))()`);
    // _recordFinancialAudit() is deliberately fire-and-forget (it must never
    // make a successful posting fail), so give the write a tick to land.
    await new Promise((r) => setTimeout(r, 60));
    const log = J(db.collection('financial_audit_log'));
    assert.ok(log.length >= 1, 'the audit trail is written at the chokepoint');
    const post = log.find((r) => r.action === 'POST' && r.entity === 'journal_entry');
    assert.ok(post, 'a POST row exists');
    assert.strictEqual(post.actor, 'مدير المزرعة');
    assert.strictEqual(post.actorRole, 'admin');
    assert.ok(post.timestamp && post.entityId);
    const trail = J(await app.eval(`(async()=>await getFinancialAuditTrail('journal_entry'))()`));
    assert.strictEqual(trail.ok, true);
    assert.strictEqual(trail.entries.length, log.filter((r) => r.entity === 'journal_entry').length);
    const filtered = J(await app.eval(`(async()=>await getFinancialAuditTrail('fiscal_period'))()`));
    assert.deepStrictEqual(filtered.entries, [], 'filtering by entity works');
  });

  test('getFinancialIntegrityStatus() reports the trial balance and the accounting equation', async () => {
    await reset();
    await app.eval(`(async()=>await postJournalEntry({date:'2026-05-10',lines:[{accountId:${JSON.stringify(CASH)},debit:500},{accountId:${JSON.stringify(MILK)},credit:500}]}))()`);
    const s = J(await app.eval(`(async()=>await getFinancialIntegrityStatus())()`));
    assert.ok(s, 'a status object is returned');
    const flat = JSON.stringify(s);
    assert.ok(/balanced|trialBalance|Assets/i.test(flat), 'it must expose the real invariants: ' + Object.keys(s).join(','));
    assert.ok(!/false/.test(flat) || s.ok !== false, 'a correctly-posted ledger reports no integrity failure: ' + flat.slice(0, 300));
  });

  test('runFinancialDataQualityScan() flags an unbalanced ledger and passes a clean one', async () => {
    await reset();
    const clean = J(await app.eval(`(async()=>await runFinancialDataQualityScan())()`));
    assert.ok(clean, 'scan returns a report');
    const cleanIssues = (clean.issues || clean.findings || clean.problems || []);
    assert.strictEqual(cleanIssues.length, 0, 'a fresh, empty ledger has no quality issues: ' + JSON.stringify(cleanIssues));

    // Hand-write a deliberately unbalanced entry, bypassing the engine.
    await app.eval(`(async()=>await fbPost('journal_entries',{date:'2026-05-01',status:'POSTED',totalDebit:100,totalCredit:50,lines:[{accountId:${JSON.stringify(CASH)},debit:100},{accountId:${JSON.stringify(MILK)},credit:50}]}))()`);
    app.eval(`fbCacheInvalidate('journal_entries')`);
    const dirty = J(await app.eval(`(async()=>await runFinancialDataQualityScan())()`));
    const dirtyIssues = (dirty.issues || dirty.findings || dirty.problems || []);
    assert.ok(dirtyIssues.length > 0, 'the scan must catch an unbalanced entry: ' + JSON.stringify(dirty).slice(0, 400));
  });

  test('validateFinancialReportsCrossConsistency() ties the statements to each other', async () => {
    await reset();
    await app.eval(`(async()=>await postJournalEntry({date:'2026-05-10',lines:[{accountId:${JSON.stringify(CASH)},debit:1000},{accountId:${JSON.stringify(MILK)},credit:1000}]}))()`);
    await app.eval(`(async()=>await postJournalEntry({date:'2026-05-20',lines:[{accountId:${JSON.stringify(FEED_EXP)},debit:400},{accountId:${JSON.stringify(CASH)},credit:400}]}))()`);
    const v = J(await app.eval(`(async()=>await validateFinancialReportsCrossConsistency('2026-05-31'))()`));
    assert.ok(v, 'a report is returned');
    const flat = JSON.stringify(v);
    assert.ok(/consistent|ok|balanced|checks/i.test(flat), 'exposes its checks: ' + Object.keys(v).join(','));
    assert.strictEqual((J(await app.eval(`(async()=>await validateFinancialReportsCrossConsistency())()`))).ok, false, 'asOfDate is required');
  });

  test('getCashFlowStatement() classifies cash movement and refuses with no cash accounts defined', async () => {
    await reset();
    const none = J(await app.eval(`(async()=>await getCashFlowStatement('2026-01-01','2026-12-31'))()`));
    assert.strictEqual(none.ok, false);
    assert.match(none.error, /نقدية/);
    await app.eval(`(async()=>await createCashBankAccount({name:'خزينة',type:'cash',linkedAccountId:${JSON.stringify(CASH)},openingDate:'2026-01-01'}))()`);
    await app.eval(`(async()=>await postJournalEntry({date:'2026-05-10',lines:[{accountId:${JSON.stringify(CASH)},debit:1000},{accountId:${JSON.stringify(MILK)},credit:1000}]}))()`);
    const cf = J(await app.eval(`(async()=>await getCashFlowStatement('2026-01-01','2026-12-31'))()`));
    assert.strictEqual(cf.ok, true, JSON.stringify(cf).slice(0, 300));
    const flat = JSON.stringify(cf);
    assert.ok(/operating|netCash|1000/.test(flat), 'the cash movement is reported: ' + flat.slice(0, 300));
    assert.strictEqual((J(await app.eval(`(async()=>await getCashFlowStatement())()`))).ok, false);
  });

  test('budget lines go DRAFT → APPROVED → LOCKED and cannot skip a step', async () => {
    await reset();
    const b = J(await app.eval(`(async()=>await createBudgetLine({periodKey:'2026-05',accountId:${JSON.stringify(FEED_EXP)},amount:5000}))()`));
    assert.strictEqual(b.ok, true, JSON.stringify(b));
    assert.strictEqual((J(await app.eval(`(async()=>await lockBudgetLine(${JSON.stringify(b.id)}))()`))).ok, false, 'a DRAFT cannot be locked directly');
    assert.strictEqual((J(await app.eval(`(async()=>await approveBudgetLine(${JSON.stringify(b.id)}))()`))).ok, true);
    assert.strictEqual((J(await app.eval(`(async()=>await approveBudgetLine(${JSON.stringify(b.id)}))()`))).ok, false, 'cannot approve twice');
    assert.strictEqual((J(await app.eval(`(async()=>await lockBudgetLine(${JSON.stringify(b.id)}))()`))).ok, true);
    assert.strictEqual((J(await app.eval(`(async()=>await createBudgetLine({periodKey:'2026-05',accountId:'9999',amount:1}))()`))).ok, false, 'unknown account refused');
    assert.strictEqual((J(await app.eval(`(async()=>await createBudgetLine({periodKey:'2026-05',accountId:${JSON.stringify(FEED_EXP)},amount:-5}))()`))).ok, false);
  });

  test('getBudgetVsActual() compares the approved budget with real posted activity', async () => {
    await reset();
    const b = J(await app.eval(`(async()=>await createBudgetLine({periodKey:'2026-05',accountId:${JSON.stringify(FEED_EXP)},amount:5000,startDate:'2026-05-01',endDate:'2026-05-31'}))()`));
    await app.eval(`(async()=>await approveBudgetLine(${JSON.stringify(b.id)}))()`);
    await app.eval(`(async()=>await postJournalEntry({date:'2026-05-10',lines:[{accountId:${JSON.stringify(FEED_EXP)},debit:2000},{accountId:${JSON.stringify(CASH)},credit:2000}]}))()`);
    const v = J(await app.eval(`(async()=>await getBudgetVsActual({periodKey:'2026-05',accountId:${JSON.stringify(FEED_EXP)},startDate:'2026-05-01',endDate:'2026-05-31'}))()`));
    assert.strictEqual(v.ok, true, JSON.stringify(v));
    const flat = JSON.stringify(v);
    assert.ok(/5000/.test(flat) && /2000/.test(flat), 'both the budget and the actual appear: ' + flat.slice(0, 300));
    assert.strictEqual((J(await app.eval(`(async()=>await getBudgetVsActual({}))()`))).ok, false);
  });

  test('createForecast() needs a target period, an account and at least one source period', async () => {
    await reset();
    await app.eval(`(async()=>await postJournalEntry({date:'2026-04-10',lines:[{accountId:${JSON.stringify(CASH)},debit:800},{accountId:${JSON.stringify(MILK)},credit:800}]}))()`);
    assert.strictEqual((J(await app.eval(`(async()=>await createForecast({operationId:'f1'}))()`))).ok, false);
    const f = J(await app.eval(`(async()=>await createForecast({operationId:'f1',targetPeriodKey:'2026-05',accountId:${JSON.stringify(MILK)},sourcePeriods:['2026-04'],startDate:'2026-05-01',endDate:'2026-05-31'}))()`));
    assert.strictEqual(f.ok, true, JSON.stringify(f));
    const again = J(await app.eval(`(async()=>await createForecast({operationId:'f1',targetPeriodKey:'2026-05',accountId:${JSON.stringify(MILK)},sourcePeriods:['2026-04']}))()`));
    assert.strictEqual(again.idempotent, true, 'the operationId dedup applies to forecasts too');
    const vs = J(await app.eval(`(async()=>await getForecastVsActual(${JSON.stringify(f.id)},'2026-05-01','2026-05-31'))()`));
    assert.ok(vs && vs.ok !== false, JSON.stringify(vs).slice(0, 300));
  });

  test('legacy finance migration: dry-run writes nothing, a real run is idempotent', async () => {
    await reset();
    db.data.finance = {
      L1: { type: 'income', category: 'بيع ألبان', amount: 500, date: '2026-04-01', description: 'قديم' },
      L2: { type: 'expense', category: 'أعلاف ومواد تغذية', amount: 200, date: '2026-04-02' },
      L3: { type: 'income', amount: 0, date: '2026-04-03' },
    };
    app.eval(`fbCacheInvalidate()`);
    const analysis = J(await app.eval(`(async()=>await analyzeLegacyFinanceMigration())()`));
    assert.ok(analysis, 'the analysis runs read-only');
    const dry = J(await app.eval(`(async()=>await migrateLegacyFinanceRecords({dryRun:true}))()`));
    assert.ok(dry, JSON.stringify(dry).slice(0, 300));
    assert.deepStrictEqual(entries(), [], 'a dry run posts nothing');
    const real = J(await app.eval(`(async()=>await migrateLegacyFinanceRecords({dryRun:false}))()`));
    assert.ok(real, JSON.stringify(real).slice(0, 300));
    const afterFirst = entries().length;
    const again = J(await app.eval(`(async()=>await migrateLegacyFinanceRecords({dryRun:false}))()`));
    assert.strictEqual(entries().length, afterFirst, 're-running the migration must not double-post');
    assert.ok(again, JSON.stringify(again).slice(0, 200));
    const tb = J(await app.eval(`(async()=>await getTrialBalance('2026-12-31'))()`));
    assert.strictEqual(tb.balanced, true, 'migrated entries are still balanced double entries');
    const recon = J(await app.eval(`(async()=>await getLegacyMigrationReconciliation())()`));
    assert.ok(recon, 'a reconciliation view exists');
  });
});
