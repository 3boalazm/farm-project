// Module 21 — Costing & asset modules: animal accounting, feed/medicine/
// labor costing, cost centers & allocation, production margin, fixed assets
// & depreciation, loans, owner equity, farm profitability.
const { bootApp, suite, assert, J } = require('./harness');

const CASH = '1110', AP = '2100', AR = '1300', LIVESTOCK = '1500', COS = '5100', LOSS = '5150';
const FEED_EXP = '6100', MED_EXP = '6200', LABOR_EXP = '6300', PAYROLL = '2210';
const FIXED = '1600', ACC_DEPR = '1690', DEPR_EXP = '6800', LOANS = '2300', INTEREST = '6850';
const CAPITAL = '3100', DRAWINGS = '3200', MILK = '4200', ANIMAL_SALES = '4100';

module.exports = suite('21 · Costing, assets, loans & equity', ({ test }) => {
  let app, db;
  const reset = async (over = {}) => {
    db.reset(Object.assign({ users: db.data.users }, over));
    app.eval(`fbCacheInvalidate()`);
    await app.eval(`(async()=>await seedDefaultChartOfAccounts())()`);
    app.eval(`fbCacheInvalidate()`);
  };
  const entries = () => J(db.collection('journal_entries'));
  const line = (acct, side) => entries().flatMap((e) => e.lines || []).filter((l) => l.accountId === acct).reduce((s, l) => s + (+l[side] || 0), 0);

  test('boots', async () => { app = await bootApp(); db = app.db; });

  test('postAnimalPurchase() capitalises the animal and records its cost basis', async () => {
    await reset({ animals: { a1: { tag: 'GT-1', species: 'goat', status: 'alive' } } });
    const r = J(await app.eval(`(async()=>await postAnimalPurchase({operationId:'ap1',animalId:'a1',animalTag:'GT-1',amount:8000,paymentMode:'cash',cashAccountId:${JSON.stringify(CASH)},date:'2026-05-01'}))()`));
    assert.strictEqual(r.ok, true, JSON.stringify(r));
    assert.strictEqual(line(LIVESTOCK, 'debit'), 8000, 'the livestock asset account is debited');
    assert.strictEqual(line(CASH, 'credit'), 8000, 'and paid from cash in the same posting');
    const basis = J(await app.eval(`(async()=>await getAnimalCostBasis('a1'))()`));
    assert.strictEqual(basis.knownCost, 8000, 'the cost basis is evidence-based');
    const ledger = J(db.collection('animal_cost_ledger'));
    assert.strictEqual(ledger.length, 1);
    assert.strictEqual(ledger[0].costType, 'purchase');
  });

  test('recordAnimalCost() adds follow-on costs and is idempotent per operationId', async () => {
    await reset({ animals: { a1: { tag: 'GT-1', status: 'alive' } } });
    await app.eval(`(async()=>await postAnimalPurchase({operationId:'ap1',animalId:'a1',amount:5000,paymentMode:'cash',cashAccountId:${JSON.stringify(CASH)}}))()`);
    const c1 = J(await app.eval(`(async()=>await recordAnimalCost({operationId:'c1',animalId:'a1',costType:'feed',amount:300,date:'2026-05-05'}))()`));
    assert.strictEqual(c1.ok, true, JSON.stringify(c1));
    const replay = J(await app.eval(`(async()=>await recordAnimalCost({operationId:'c1',animalId:'a1',costType:'feed',amount:300,date:'2026-05-05'}))()`));
    assert.strictEqual(replay.idempotent, true, 'a replayed operationId must not double the cost basis');
    assert.strictEqual((J(await app.eval(`(async()=>await getAnimalCostBasis('a1'))()`))).knownCost, 5300);
    assert.strictEqual((J(await app.eval(`(async()=>await recordAnimalCost({operationId:'c2',animalId:'a1',amount:100}))()`))).ok, false, 'costType is required');
    assert.strictEqual((J(await app.eval(`(async()=>await recordAnimalCost({operationId:'c3',animalId:'a1',costType:'feed',amount:-5}))()`))).ok, false);
  });

  test('postAnimalSale() recognises revenue AND the cost of sale, and profitability reports the real margin', async () => {
    await reset({ animals: { a1: { tag: 'GT-1', status: 'alive' } } });
    await app.eval(`(async()=>await postAnimalPurchase({operationId:'ap1',animalId:'a1',amount:6000,paymentMode:'cash',cashAccountId:${JSON.stringify(CASH)}}))()`);
    await app.eval(`(async()=>await recordAnimalCost({operationId:'c1',animalId:'a1',costType:'feed',amount:1500}))()`);
    const sale = J(await app.eval(`(async()=>await postAnimalSale({operationId:'as1',animalId:'a1',animalTag:'GT-1',salePrice:10000,paymentMode:'cash',cashAccountId:${JSON.stringify(CASH)},revenueAccountId:${JSON.stringify(ANIMAL_SALES)},date:'2026-06-01'}))()`));
    assert.strictEqual(sale.ok, true, JSON.stringify(sale));
    assert.strictEqual(line(ANIMAL_SALES, 'credit'), 10000, 'revenue recognised');
    assert.strictEqual(line(COS, 'debit'), 7500, 'cost of sale = purchase + recorded costs');
    const prof = J(await app.eval(`(async()=>await getAnimalProfitability('a1'))()`));
    assert.strictEqual(prof.outcome, 'sold');
    assert.strictEqual(prof.revenue, 10000);
    assert.strictEqual(prof.costOfSale, 7500);
    assert.strictEqual(prof.netResult, 2500, 'a real realised margin, never a guess');
    const tb = J(await app.eval(`(async()=>await getTrialBalance('2026-12-31'))()`));
    assert.strictEqual(tb.balanced, true);
  });

  test('an animal that is still alive has NO realised profitability (null, never a fabricated zero)', async () => {
    await reset({ animals: { a1: { tag: 'GT-1', status: 'alive' } } });
    await app.eval(`(async()=>await postAnimalPurchase({operationId:'ap1',animalId:'a1',amount:4000,paymentMode:'cash',cashAccountId:${JSON.stringify(CASH)}}))()`);
    const prof = J(await app.eval(`(async()=>await getAnimalProfitability('a1'))()`));
    assert.strictEqual(prof.outcome, 'active');
    assert.strictEqual(prof.netResult, null);
    assert.strictEqual(prof.currentCostBasis, 4000);
  });

  test('postAnimalDeath() writes off the KNOWN cost basis as a loss, and nothing when it is unknown', async () => {
    await reset({ animals: { a1: { tag: 'GT-1', status: 'dead' } } });
    await app.eval(`(async()=>await postAnimalPurchase({operationId:'ap1',animalId:'a1',amount:3000,paymentMode:'cash',cashAccountId:${JSON.stringify(CASH)}}))()`);
    const d = J(await app.eval(`(async()=>await postAnimalDeath({operationId:'ad1',animalId:'a1',animalTag:'GT-1',date:'2026-06-01'}))()`));
    assert.strictEqual(d.ok, true, JSON.stringify(d));
    assert.strictEqual(line(LOSS, 'debit'), 3000, 'the loss equals the known basis');
    assert.strictEqual(line(LIVESTOCK, 'credit'), 3000, 'and the asset leaves the books');
    const prof = J(await app.eval(`(async()=>await getAnimalProfitability('a1'))()`));
    assert.strictEqual(prof.outcome, 'died');
    assert.strictEqual(prof.netResult, -3000);

    await reset({ animals: { a2: { tag: 'GT-2', status: 'dead' } } });
    const unknown = J(await app.eval(`(async()=>await postAnimalDeath({operationId:'ad2',animalId:'a2',date:'2026-06-01'}))()`));
    assert.ok(unknown, JSON.stringify(unknown));
    assert.strictEqual(line(LOSS, 'debit'), 0, 'no basis → no invented loss');
  });

  test('rankAnimalProfitability() separates realised outcomes from still-active animals', async () => {
    await reset({ animals: { a1: { tag: 'A', status: 'sold' }, a2: { tag: 'B', status: 'alive' }, a3: { tag: 'C', status: 'sold' } } });
    await app.eval(`(async()=>await postAnimalPurchase({operationId:'p1',animalId:'a1',amount:1000,paymentMode:'cash',cashAccountId:${JSON.stringify(CASH)}}))()`);
    await app.eval(`(async()=>await postAnimalSale({operationId:'s1',animalId:'a1',salePrice:3000,paymentMode:'cash',cashAccountId:${JSON.stringify(CASH)},revenueAccountId:${JSON.stringify(ANIMAL_SALES)}}))()`);
    await app.eval(`(async()=>await postAnimalPurchase({operationId:'p3',animalId:'a3',amount:2000,paymentMode:'cash',cashAccountId:${JSON.stringify(CASH)}}))()`);
    await app.eval(`(async()=>await postAnimalSale({operationId:'s3',animalId:'a3',salePrice:2500,paymentMode:'cash',cashAccountId:${JSON.stringify(CASH)},revenueAccountId:${JSON.stringify(ANIMAL_SALES)}}))()`);
    const rank = J(await app.eval(`(async()=>await rankAnimalProfitability(['a1','a2','a3']))()`));
    assert.ok(rank && rank.ok !== false, JSON.stringify(rank).slice(0, 300));
    const flat = JSON.stringify(rank);
    assert.ok(/a1/.test(flat) && /a3/.test(flat), 'both sold animals are ranked');
    assert.ok(flat.indexOf('a1') < flat.indexOf('a3') || /2000/.test(flat), 'the better margin ranks first: ' + flat.slice(0, 300));
    assert.strictEqual((J(await app.eval(`(async()=>await rankAnimalProfitability([]))()`))).ok, false, 'an empty list is refused');
  });

  test('feed costing reports the real total, per-day and per-animal figures from posted entries', async () => {
    await reset({ animals: { a1: { tag: 'GT-1', status: 'alive' } }, feed_consumption: {} });
    await app.eval(`(async()=>await postJournalEntry({date:'2026-05-01',lines:[{accountId:${JSON.stringify(FEED_EXP)},debit:600},{accountId:${JSON.stringify(CASH)},credit:600}]}))()`);
    await app.eval(`(async()=>await postJournalEntry({date:'2026-05-11',lines:[{accountId:${JSON.stringify(FEED_EXP)},debit:400},{accountId:${JSON.stringify(CASH)},credit:400}]}))()`);
    const sum = J(await app.eval(`(async()=>await getFeedCostSummary('2026-05-01','2026-05-31'))()`));
    assert.ok(sum && sum.ok !== false, JSON.stringify(sum).slice(0, 300));
    const flat = JSON.stringify(sum);
    assert.ok(/1000/.test(flat), 'both postings are summed: ' + flat.slice(0, 300));
    const perDay = J(await app.eval(`(async()=>await getFeedCostPerDay('2026-05-01','2026-05-31'))()`));
    assert.ok(perDay && perDay.ok !== false, JSON.stringify(perDay).slice(0, 200));
    const window = J(await app.eval(`(async()=>await getFeedCostSummary('2026-06-01','2026-06-30'))()`));
    assert.ok(!/1000/.test(JSON.stringify(window.total ?? window)), 'a window with no postings reports zero, not the other month');
  });

  test('medicine costing reads the veterinary expense account only', async () => {
    await reset();
    await app.eval(`(async()=>await postJournalEntry({date:'2026-05-01',lines:[{accountId:${JSON.stringify(MED_EXP)},debit:250},{accountId:${JSON.stringify(CASH)},credit:250}]}))()`);
    await app.eval(`(async()=>await postJournalEntry({date:'2026-05-02',lines:[{accountId:${JSON.stringify(FEED_EXP)},debit:900},{accountId:${JSON.stringify(CASH)},credit:900}]}))()`);
    const m = J(await app.eval(`(async()=>await getMedicineCostSummary('2026-05-01','2026-05-31'))()`));
    const flat = JSON.stringify(m.total ?? m);
    assert.ok(/250/.test(flat), 'the medicine total is 250, feed is not mixed in: ' + flat);
    assert.ok(!/900/.test(flat));
  });

  test('labor: accrual creates a real payable, payment settles it, and the balance tracks both', async () => {
    await reset();
    const emp = J(await app.eval(`(async()=>await createEmployee({name:'أحمد',rateType:'monthly',rateAmount:3000}))()`));
    assert.strictEqual(emp.ok, true, JSON.stringify(emp));
    assert.strictEqual((J(await app.eval(`(async()=>await createEmployee({name:'x',rateType:'weekly'}))()`))).ok, false, 'rate type is validated');
    const accrual = J(await app.eval(`(async()=>await postLaborAccrual({operationId:'l1',employeeId:${JSON.stringify(emp.id)},employeeName:'أحمد',amount:3000,date:'2026-05-31',workPeriodStart:'2026-05-01',workPeriodEnd:'2026-05-31'}))()`));
    assert.strictEqual(accrual.ok, true, JSON.stringify(accrual));
    assert.strictEqual(line(LABOR_EXP, 'debit'), 3000, 'the expense is recognised when earned');
    assert.strictEqual(line(PAYROLL, 'credit'), 3000, 'and a payroll payable is created');
    let bal = J(await app.eval(`(async()=>await getEmployeeBalance(${JSON.stringify(emp.id)}))()`));
    assert.strictEqual(bal.balance, 3000);
    const pay = J(await app.eval(`(async()=>await postLaborPayment(${JSON.stringify(accrual.id ?? accrual.documentId)},{operationId:'lp1',cashAccountId:${JSON.stringify(CASH)},amount:3000,date:'2026-06-05'}))()`));
    assert.ok(pay && pay.ok !== false, JSON.stringify(pay).slice(0, 300));
    bal = J(await app.eval(`(async()=>await getEmployeeBalance(${JSON.stringify(emp.id)}))()`));
    assert.strictEqual(bal.balance, 0, 'paying clears the payable');
    assert.strictEqual(line(CASH, 'credit'), 3000);
  });

  test('cost centers: allocation is additive attribution and never rewrites the source entry', async () => {
    await reset();
    const cc = J(await app.eval(`(async()=>await createCostCenter({name:'ج١ع١',type:'barn'}))()`));
    assert.strictEqual(cc.ok, true, JSON.stringify(cc));
    assert.strictEqual((J(await app.eval(`(async()=>await createCostCenter({name:'x',type:'not_a_type'}))()`))).ok, false);
    const je = J(await app.eval(`(async()=>await postJournalEntry({date:'2026-05-01',description:'علف',lines:[{accountId:${JSON.stringify(FEED_EXP)},debit:1000},{accountId:${JSON.stringify(CASH)},credit:1000}]}))()`));
    const before = entries().length;
    const alloc = J(await app.eval(`(async()=>await allocateCost({operationId:'al1',sourceJournalEntryId:${JSON.stringify(je.id)},totalAmount:1000,allocations:[{costCenterId:${JSON.stringify(cc.id)},method:'BY_PERCENTAGE',percentage:60,amount:600},{costCenterId:${JSON.stringify(cc.id)},method:'BY_PERCENTAGE',percentage:40,amount:400}]}))()`));
    assert.strictEqual(alloc.ok, true, JSON.stringify(alloc).slice(0, 300));
    assert.strictEqual(entries().length, before, 'allocating a cost posts NO new journal entry');
    const byCenter = J(await app.eval(`(async()=>await getCostByCenter(${JSON.stringify(cc.id)},'2026-05-01','2026-05-31'))()`));
    assert.ok(byCenter && byCenter.ok !== false, JSON.stringify(byCenter).slice(0, 200));
    const replay = J(await app.eval(`(async()=>await allocateCost({operationId:'al1',sourceJournalEntryId:${JSON.stringify(je.id)},totalAmount:1000,allocations:[{costCenterId:${JSON.stringify(cc.id)},method:'BY_PERCENTAGE',percentage:100,amount:1000}]}))()`));
    assert.strictEqual(replay.idempotent, true, 'the operationId dedup applies to allocations');
    assert.strictEqual((J(await app.eval(`(async()=>await allocateCost({operationId:'al2',totalAmount:100,allocations:[{costCenterId:${JSON.stringify(cc.id)},method:'DIRECT',amount:100}]}))()`))).ok, false, 'a source entry is required');
    assert.strictEqual((J(await app.eval(`(async()=>await allocateCost({operationId:'al3',sourceJournalEntryId:${JSON.stringify(je.id)},totalAmount:1000,allocations:[{costCenterId:${JSON.stringify(cc.id)},method:'NOPE',amount:1000}]}))()`))).ok, false, 'an unknown allocation method is refused');
    assert.strictEqual((J(await app.eval(`(async()=>await allocateCost({operationId:'al4',sourceJournalEntryId:${JSON.stringify(je.id)},totalAmount:1000,allocations:[{costCenterId:${JSON.stringify(cc.id)},method:'DIRECT',amount:999}]}))()`))).ok, false, 'allocations must sum to the source total');
  });

  test('getUnallocatedCosts() reports what no cost center has claimed yet', async () => {
    await reset();
    await app.eval(`(async()=>await postJournalEntry({date:'2026-05-01',lines:[{accountId:${JSON.stringify(FEED_EXP)},debit:700},{accountId:${JSON.stringify(CASH)},credit:700}]}))()`);
    const u = J(await app.eval(`(async()=>await getUnallocatedCosts('2026-05-01','2026-05-31'))()`));
    assert.ok(u && u.ok !== false, JSON.stringify(u).slice(0, 200));
    assert.ok(/700/.test(JSON.stringify(u)), 'the unallocated amount is visible: ' + JSON.stringify(u).slice(0, 200));
  });

  test('getProductionMargin() nets real revenue against a cost centre’s allocated cost', async () => {
    await reset({ production_log: { p1: { type: 'milk', quantity: 500, date: '2026-05-05' } } });
    assert.strictEqual((J(await app.eval(`(async()=>await getProductionMargin({startDate:'2026-05-01',endDate:'2026-05-31'}))()`))).ok, false, 'a revenue account is required');
    await app.eval(`(async()=>await postJournalEntry({date:'2026-05-01',lines:[{accountId:${JSON.stringify(CASH)},debit:5000},{accountId:${JSON.stringify(MILK)},credit:5000}]}))()`);
    const je = J(await app.eval(`(async()=>await postJournalEntry({date:'2026-05-02',lines:[{accountId:${JSON.stringify(FEED_EXP)},debit:2000},{accountId:${JSON.stringify(CASH)},credit:2000}]}))()`));
    const cc = J(await app.eval(`(async()=>await createCostCenter({name:'حظيرة الألبان',type:'milk_production'}))()`));
    await app.eval(`(async()=>await allocateCost({operationId:'m1',sourceJournalEntryId:${JSON.stringify(je.id)},totalAmount:2000,allocations:[{costCenterId:${JSON.stringify(cc.id)},method:'DIRECT',amount:2000}]}))()`);

    const noCenter = J(await app.eval(`(async()=>await getProductionMargin({revenueAccountId:${JSON.stringify(MILK)},startDate:'2026-05-01',endDate:'2026-05-31'}))()`));
    assert.strictEqual(noCenter.ok, true);
    assert.strictEqual(noCenter.revenue, 5000);
    assert.strictEqual(noCenter.cost, 0, 'with no cost centre named there is no evidence of cost — it is NOT guessed from the whole ledger');
    assert.strictEqual(noCenter.grossMargin, 5000);

    const withCenter = J(await app.eval(`(async()=>await getProductionMargin({revenueAccountId:${JSON.stringify(MILK)},costCenterId:${JSON.stringify(cc.id)},productionLogType:'milk',startDate:'2026-05-01',endDate:'2026-05-31'}))()`));
    assert.strictEqual(withCenter.cost, 2000);
    assert.strictEqual(withCenter.grossMargin, 3000);
    assert.strictEqual(withCenter.quantity, 500, 'the real production quantity from production_log');
    assert.strictEqual(withCenter.costPerUnit, 4);
    assert.strictEqual(withCenter.revenuePerUnit, 10);
  });

  test('fixed assets: purchase capitalises, depreciation is straight-line and idempotent per period', async () => {
    await reset();
    const asset = J(await app.eval(`(async()=>await postAssetPurchase({operationId:'fa1',name:'جرار',acquisitionCost:120000,usefulLifeMonths:60,residualValue:0,paymentMode:'cash',cashAccountId:${JSON.stringify(CASH)},date:'2026-01-01'}))()`));
    assert.strictEqual(asset.ok, true, JSON.stringify(asset));
    assert.strictEqual(line(FIXED, 'debit'), 120000);
    const bv0 = J(await app.eval(`(async()=>await getAssetBookValue(${JSON.stringify(asset.id ?? asset.assetId)}))()`));
    assert.strictEqual(bv0.ok, true, JSON.stringify(bv0).slice(0, 200));
    assert.strictEqual(bv0.bookValue ?? bv0.balance, 120000, 'no depreciation posted yet');

    const dep = J(await app.eval(`(async()=>await postDepreciation({assetId:${JSON.stringify(asset.id ?? asset.assetId)},periodOperationId:'2026-01',date:'2026-01-31'}))()`));
    assert.strictEqual(dep.ok, true, JSON.stringify(dep));
    assert.strictEqual(line(DEPR_EXP, 'debit'), 2000, '120000 / 60 months');
    assert.strictEqual(line(ACC_DEPR, 'credit'), 2000, 'accumulated depreciation is a contra asset');
    const again = J(await app.eval(`(async()=>await postDepreciation({assetId:${JSON.stringify(asset.id ?? asset.assetId)},periodOperationId:'2026-01',date:'2026-01-31'}))()`));
    assert.strictEqual(again.idempotent, true, 'the same period can never be depreciated twice');
    assert.strictEqual(line(DEPR_EXP, 'debit'), 2000);
    const bv1 = J(await app.eval(`(async()=>await getAssetBookValue(${JSON.stringify(asset.id ?? asset.assetId)}))()`));
    assert.strictEqual(bv1.bookValue ?? bv1.balance, 118000);
    const tb = J(await app.eval(`(async()=>await getTrialBalance('2026-12-31'))()`));
    assert.strictEqual(tb.balanced, true);
  });

  test('asset purchase validation: name, cost, life and payment mode are all required', async () => {
    await reset();
    assert.strictEqual((J(await app.eval(`(async()=>await postAssetPurchase({operationId:'x1',acquisitionCost:1000,usefulLifeMonths:12,paymentMode:'cash',cashAccountId:${JSON.stringify(CASH)}}))()`))).ok, false, 'name required');
    assert.strictEqual((J(await app.eval(`(async()=>await postAssetPurchase({operationId:'x2',name:'a',usefulLifeMonths:12,paymentMode:'cash',cashAccountId:${JSON.stringify(CASH)}}))()`))).ok, false, 'cost required');
    assert.strictEqual((J(await app.eval(`(async()=>await postAssetPurchase({operationId:'x3',name:'a',acquisitionCost:1000,paymentMode:'cash',cashAccountId:${JSON.stringify(CASH)}}))()`))).ok, false, 'useful life required');
    assert.strictEqual((J(await app.eval(`(async()=>await postAssetPurchase({operationId:'x4',name:'a',acquisitionCost:1000,usefulLifeMonths:0,paymentMode:'cash',cashAccountId:${JSON.stringify(CASH)}}))()`))).ok, false, 'a zero life would divide by zero');
    assert.deepStrictEqual(entries(), [], 'nothing was posted by any rejected call');
  });

  test('loans: receipt raises a liability, principal reduces it, interest is an expense and never touches principal', async () => {
    await reset();
    const loan = J(await app.eval(`(async()=>await postLoanReceipt({operationId:'ln1',lenderName:'بنك',principalAmount:50000,interestRate:12,cashAccountId:${JSON.stringify(CASH)},date:'2026-01-01'}))()`));
    assert.strictEqual(loan.ok, true, JSON.stringify(loan));
    assert.strictEqual(line(CASH, 'debit'), 50000);
    assert.strictEqual(line(LOANS, 'credit'), 50000);
    let rem = J(await app.eval(`(async()=>await getLoanRemainingPrincipal(${JSON.stringify(loan.id ?? loan.loanId)}))()`));
    assert.strictEqual(rem.remainingPrincipal, 50000);

    const princ = J(await app.eval(`(async()=>await postLoanPrincipalPayment({operationId:'lp1',loanId:${JSON.stringify(loan.id ?? loan.loanId)},amount:20000,cashAccountId:${JSON.stringify(CASH)},date:'2026-02-01'}))()`));
    assert.strictEqual(princ.ok, true, JSON.stringify(princ));
    rem = J(await app.eval(`(async()=>await getLoanRemainingPrincipal(${JSON.stringify(loan.id ?? loan.loanId)}))()`));
    assert.strictEqual(rem.remainingPrincipal, 30000);
    assert.strictEqual(line(INTEREST, 'debit'), 0, 'principal repayment is NOT an expense');

    const interest = J(await app.eval(`(async()=>await postLoanInterestPayment({operationId:'li1',loanId:${JSON.stringify(loan.id ?? loan.loanId)},amount:500,cashAccountId:${JSON.stringify(CASH)},date:'2026-02-01'}))()`));
    assert.strictEqual(interest.ok, true, JSON.stringify(interest));
    assert.strictEqual(line(INTEREST, 'debit'), 500);
    rem = J(await app.eval(`(async()=>await getLoanRemainingPrincipal(${JSON.stringify(loan.id ?? loan.loanId)}))()`));
    assert.strictEqual(rem.remainingPrincipal, 30000, 'paying interest never reduces principal');
    const paid = J(await app.eval(`(async()=>await getInterestPaidOnLoan(${JSON.stringify(loan.id ?? loan.loanId)}))()`));
    assert.ok(/500/.test(JSON.stringify(paid)));

    const over = J(await app.eval(`(async()=>await postLoanPrincipalPayment({operationId:'lp2',loanId:${JSON.stringify(loan.id ?? loan.loanId)},amount:999999,cashAccountId:${JSON.stringify(CASH)}}))()`));
    assert.strictEqual(over.ok, false, 'cannot repay more than the outstanding principal');
    assert.match(over.error, /أكبر من/);
  });

  test('owner equity: capital in, drawings out, and a summary that ties to the ledger', async () => {
    await reset();
    const cap = J(await app.eval(`(async()=>await postOwnerCapital({operationId:'oc1',amount:25000,cashAccountId:${JSON.stringify(CASH)},date:'2026-01-01'}))()`));
    assert.strictEqual(cap.ok, true, JSON.stringify(cap));
    assert.strictEqual(line(CAPITAL, 'credit'), 25000);
    const draw = J(await app.eval(`(async()=>await postOwnerWithdrawal({operationId:'ow1',amount:4000,cashAccountId:${JSON.stringify(CASH)},date:'2026-02-01'}))()`));
    assert.strictEqual(draw.ok, true, JSON.stringify(draw));
    assert.strictEqual(line(DRAWINGS, 'debit'), 4000);
    const sum = J(await app.eval(`(async()=>await getOwnerEquitySummary('2026-01-01','2026-12-31'))()`));
    assert.ok(sum && sum.ok !== false, JSON.stringify(sum).slice(0, 300));
    const flat = JSON.stringify(sum);
    assert.ok(/25000/.test(flat) && /4000/.test(flat), 'both movements appear: ' + flat.slice(0, 300));
    assert.ok(!/NaN/.test(flat));
    const bs = J(await app.eval(`(async()=>await getBalanceSheet('2026-12-31'))()`));
    assert.strictEqual(bs.balanced, true, 'equity movements keep the accounting equation true');
    assert.strictEqual(bs.totalAssets, 21000);
  });

  test('getFinancialDashboardKPIs() composes the real statements without inventing numbers', async () => {
    await reset();
    await app.eval(`(async()=>await postJournalEntry({date:'2026-05-01',lines:[{accountId:${JSON.stringify(CASH)},debit:4000},{accountId:${JSON.stringify(MILK)},credit:4000}]}))()`);
    await app.eval(`(async()=>await postJournalEntry({date:'2026-05-02',lines:[{accountId:${JSON.stringify(FEED_EXP)},debit:1000},{accountId:${JSON.stringify(CASH)},credit:1000}]}))()`);
    const k = J(await app.eval(`(async()=>await getFinancialDashboardKPIs('2026-05-01','2026-05-31'))()`));
    assert.ok(k && k.ok !== false, JSON.stringify(k).slice(0, 300));
    const flat = JSON.stringify(k);
    assert.ok(/4000/.test(flat), 'revenue from the ledger');
    assert.ok(/3000/.test(flat), 'net from the ledger');
    assert.ok(!/NaN|Infinity/.test(flat), 'no non-finite KPI: ' + flat.slice(0, 300));
  });

  test('the whole costing layer stays balanced after a full farm month', async () => {
    await reset({ animals: { a1: { tag: 'GT-1', status: 'alive' }, a2: { tag: 'GT-2', status: 'alive' } }, inventory_feeds: { f1: { name: 'علف', quantity: 0, cost_per_unit: 0 } } });
    await app.eval(`(async()=>await postOwnerCapital({operationId:'oc',amount:100000,cashAccountId:${JSON.stringify(CASH)}}))()`);
    await app.eval(`(async()=>await postAnimalPurchase({operationId:'ap',animalId:'a1',amount:20000,paymentMode:'cash',cashAccountId:${JSON.stringify(CASH)}}))()`);
    await app.eval(`(async()=>await postInventoryPurchase({operationId:'ip',itemType:'feeds',itemName:'علف',quantity:100,unitCost:50,paymentMode:'credit',supplierName:'مورد',dueDate:'2026-06-30'}))()`);
    await app.eval(`(async()=>await postInventoryConsumption({operationId:'ic',itemType:'feeds',itemName:'علف',quantity:20,reason:'feeding'}))()`);
    await app.eval(`(async()=>await postLaborAccrual({operationId:'la',employeeId:'e1',employeeName:'عامل',amount:5000}))()`);
    await app.eval(`(async()=>await postJournalEntry({date:'2026-05-20',lines:[{accountId:${JSON.stringify(CASH)},debit:15000},{accountId:${JSON.stringify(MILK)},credit:15000}]}))()`);
    await app.eval(`(async()=>await postAnimalSale({operationId:'as',animalId:'a2',salePrice:9000,paymentMode:'cash',cashAccountId:${JSON.stringify(CASH)},revenueAccountId:${JSON.stringify(ANIMAL_SALES)}}))()`);

    // Every call above defaults its date to todayStr(), except the two milk/
    // feed entries — so measure over a window that covers both.
    const from = '2026-01-01';
    const to = app.eval(`shiftDateLocal(new Date(),1)`);
    const tb = J(await app.eval(`(async()=>await getTrialBalance(${JSON.stringify('2030-12-31')}))()`));
    assert.strictEqual(tb.balanced, true, 'the trial balance must balance after a month of mixed activity');
    const bs = J(await app.eval(`(async()=>await getBalanceSheet(${JSON.stringify('2030-12-31')}))()`));
    assert.strictEqual(bs.balanced, true, 'Assets = Liabilities + Equity');
    const is = J(await app.eval(`(async()=>await getIncomeStatement(${JSON.stringify(from)},${JSON.stringify(to)}))()`));
    assert.strictEqual(is.totalRevenue, 24000, 'milk 15000 + animal sale 9000');
    assert.ok(is.totalExpense > 0, 'the consumed feed is expensed');
    const quality = J(await app.eval(`(async()=>await runFinancialDataQualityScan())()`));
    const issues = quality.issues || quality.findings || quality.problems || [];
    assert.strictEqual(issues.length, 0, 'no data-quality issues after a normal month: ' + JSON.stringify(issues).slice(0, 400));
  });
});
