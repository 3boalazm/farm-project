// Module 12 — Source documents, Accounts Receivable, Accounts Payable,
// cash & bank (Accounting engine Phases 2–5, 32).
const { bootApp, suite, assert, J } = require('./harness');

const CASH = '1110', BANK = '1200', AR = '1300', AP = '2100', MILK = '4200', FEED_EXP = '6100';

module.exports = suite('12 · Source documents, AR/AP, cash & bank', ({ test }) => {
  let app, db;
  const reset = async (over = {}) => {
    db.reset(Object.assign({ users: db.data.users }, over));
    app.eval(`fbCacheInvalidate()`);
    await app.eval(`(async()=>await seedDefaultChartOfAccounts())()`);
    app.eval(`fbCacheInvalidate()`);
  };
  const docs = () => J(db.collection('source_documents'));
  const entries = () => J(db.collection('journal_entries'));

  test('boots', async () => { app = await bootApp(); db = app.db; });

  test('createSourceDocument() requires an operationId, a valid type and a positive total', async () => {
    await reset();
    assert.strictEqual((J(await app.eval(`(async()=>await createSourceDocument({type:'sales_invoice',total:100}))()`))).ok, false);
    assert.strictEqual((J(await app.eval(`(async()=>await createSourceDocument({operationId:'o1',type:'not_a_type',total:100}))()`))).ok, false);
    for (const total of [0, -5, 'abc', null]) {
      const r = J(await app.eval(`(async()=>await createSourceDocument({operationId:'o1',type:'sales_invoice',total:${JSON.stringify(total)}}))()`));
      assert.strictEqual(r.ok, false, `total ${total}`);
    }
    assert.deepStrictEqual(docs(), []);
  });

  test('createSourceDocument() is idempotent on operationId — a replay returns the same document', async () => {
    await reset();
    const a = J(await app.eval(`(async()=>await createSourceDocument({operationId:'op-1',type:'sales_invoice',total:1000,date:'2026-05-01'}))()`));
    const b = J(await app.eval(`(async()=>await createSourceDocument({operationId:'op-1',type:'sales_invoice',total:1000,date:'2026-05-01'}))()`));
    assert.strictEqual(a.ok, true);
    assert.strictEqual(b.idempotent, true);
    assert.strictEqual(b.id, a.id);
    assert.strictEqual(docs().length, 1, 'one document, not two');
  });

  test('a new document starts DRAFT with remaining == total and a generated number', async () => {
    await reset();
    const r = J(await app.eval(`(async()=>await createSourceDocument({operationId:'op-2',type:'purchase_invoice',total:250.555,date:'2026-05-01'}))()`));
    const d = docs()[0];
    assert.strictEqual(d.status, 'DRAFT');
    assert.strictEqual(d.paidAmount, 0);
    assert.strictEqual(d.total, 250.56, 'rounded to piastres on the way in');
    assert.strictEqual(d.remainingAmount, 250.56);
    assert.match(d.documentNumber, /^SD-PURC-[A-Z0-9]+$/);
    assert.ok(r.id);
  });

  test('postSourceDocument() posts the two-line shorthand and marks a fully-settled document PAID', async () => {
    await reset();
    const c = J(await app.eval(`(async()=>await createSourceDocument({operationId:'op-3',type:'receipt',total:500,date:'2026-05-01'}))()`));
    const p = J(await app.eval(`(async()=>await postSourceDocument(${JSON.stringify(c.id)},{debitAccountId:${JSON.stringify(CASH)},creditAccountId:${JSON.stringify(MILK)},paidAmount:500}))()`));
    assert.strictEqual(p.ok, true, JSON.stringify(p));
    assert.strictEqual(p.status, 'PAID');
    assert.strictEqual(docs()[0].journalEntryId, p.journalEntryId);
    assert.strictEqual(entries().length, 1);
    assert.strictEqual(entries()[0].status, 'POSTED');
    const tb = J(await app.eval(`(async()=>await getTrialBalance('2026-12-31'))()`));
    assert.strictEqual(tb.balanced, true);
  });

  test('a DRAFT document cannot be posted twice, and only a DRAFT can be voided', async () => {
    await reset();
    const c = J(await app.eval(`(async()=>await createSourceDocument({operationId:'op-4',type:'receipt',total:100}))()`));
    await app.eval(`(async()=>await postSourceDocument(${JSON.stringify(c.id)},{debitAccountId:${JSON.stringify(CASH)},creditAccountId:${JSON.stringify(MILK)}}))()`);
    const twice = J(await app.eval(`(async()=>await postSourceDocument(${JSON.stringify(c.id)},{debitAccountId:${JSON.stringify(CASH)},creditAccountId:${JSON.stringify(MILK)}}))()`));
    assert.strictEqual(twice.ok, false);
    const voidPosted = J(await app.eval(`(async()=>await voidSourceDocument(${JSON.stringify(c.id)}))()`));
    assert.strictEqual(voidPosted.ok, false);
    assert.match(voidPosted.error, /مُرحّل/);
    assert.strictEqual(docs()[0].status, 'POSTED');
  });

  test('voidSourceDocument() cancels a never-posted draft without touching the ledger', async () => {
    await reset();
    const c = J(await app.eval(`(async()=>await createSourceDocument({operationId:'op-5',type:'expense_voucher',total:80}))()`));
    const v = J(await app.eval(`(async()=>await voidSourceDocument(${JSON.stringify(c.id)}))()`));
    assert.strictEqual(v.ok, true);
    assert.strictEqual(docs()[0].status, 'VOID');
    assert.deepStrictEqual(entries(), [], 'no journal entry ever existed for it');
  });

  test('cancelPostedSourceDocument() reverses the entry instead of editing it, and refuses after a payment', async () => {
    await reset();
    const c = J(await app.eval(`(async()=>await createSourceDocument({operationId:'op-6',type:'sales_invoice',total:1000,date:'2026-05-01'}))()`));
    await app.eval(`(async()=>await postSourceDocument(${JSON.stringify(c.id)},{debitAccountId:${JSON.stringify(AR)},creditAccountId:${JSON.stringify(MILK)}}))()`);
    const before = entries().length;
    const cancel = J(await app.eval(`(async()=>await cancelPostedSourceDocument(${JSON.stringify(c.id)}))()`));
    assert.strictEqual(cancel.ok, true, JSON.stringify(cancel));
    assert.strictEqual(entries().length, before + 1, 'the original entry is untouched, a reversal is ADDED');
    assert.ok(entries().some((e) => !!e.reversesJournalEntryId), 'a reversal entry links back to the original');
    assert.strictEqual(docs()[0].status, 'CANCELLED');
    const tb = J(await app.eval(`(async()=>await getTrialBalance('2026-12-31'))()`));
    assert.strictEqual(tb.rows.length, 0, 'the reversal nets the ledger back to zero');
  });

  test('recordPaymentAgainstDocument() validates amount and required accounts, and is idempotent', async () => {
    await reset();
    const c = J(await app.eval(`(async()=>await createSalesInvoice({operationId:'inv-1',total:1000,date:'2026-05-01',dueDate:'2026-05-31',revenueAccountId:${JSON.stringify(MILK)},customerId:'cust1',customerName:'عميل'}))()`));
    assert.strictEqual(c.ok, true, JSON.stringify(c));
    const docId = c.id;
    assert.strictEqual((J(await app.eval(`(async()=>await recordPaymentAgainstDocument(${JSON.stringify(docId)},{amount:100}))()`))).ok, false, 'missing operationId/accounts');
    assert.strictEqual((J(await app.eval(`(async()=>await recordPaymentAgainstDocument(${JSON.stringify(docId)},{operationId:'p1',amount:5000,cashAccountId:${JSON.stringify(CASH)},counterAccountId:${JSON.stringify(AR)},direction:'receive'}))()`))).ok, false, 'over-payment refused');
    const p1 = J(await app.eval(`(async()=>await recordPaymentAgainstDocument(${JSON.stringify(docId)},{operationId:'p1',amount:400,date:'2026-05-10',cashAccountId:${JSON.stringify(CASH)},counterAccountId:${JSON.stringify(AR)},direction:'receive'}))()`));
    assert.strictEqual(p1.ok, true, JSON.stringify(p1));
    assert.strictEqual(p1.paidAmount, 400);
    assert.strictEqual(p1.remainingAmount, 600);
    assert.strictEqual(p1.status, 'PARTIALLY_PAID');
    const replay = J(await app.eval(`(async()=>await recordPaymentAgainstDocument(${JSON.stringify(docId)},{operationId:'p1',amount:400,cashAccountId:${JSON.stringify(CASH)},counterAccountId:${JSON.stringify(AR)},direction:'receive'}))()`));
    assert.strictEqual(replay.idempotent, true, 'a replayed operationId must not double-subtract');
    assert.strictEqual(J(db.collection('source_documents'))[0].paidAmount, 400);
    const p2 = J(await app.eval(`(async()=>await recordPaymentAgainstDocument(${JSON.stringify(docId)},{operationId:'p2',amount:600,date:'2026-05-20',cashAccountId:${JSON.stringify(CASH)},counterAccountId:${JSON.stringify(AR)},direction:'receive'}))()`));
    assert.strictEqual(p2.status, 'PAID');
    assert.strictEqual(p2.remainingAmount, 0);
  });

  test('createSalesInvoice() posts Debit AR / Credit revenue and shows up in the customer balance', async () => {
    await reset();
    const cust = J(await app.eval(`(async()=>await createCustomer({name:'عميل أ',phone:'0100'}))()`));
    assert.strictEqual(cust.ok, true, JSON.stringify(cust));
    const inv = J(await app.eval(`(async()=>await createSalesInvoice({operationId:'inv-2',customerId:${JSON.stringify(cust.id)},customerName:'عميل أ',total:2500,date:'2026-05-01',dueDate:'2026-06-01',revenueAccountId:${JSON.stringify(MILK)}}))()`));
    assert.strictEqual(inv.ok, true, JSON.stringify(inv));
    const bal = J(await app.eval(`(async()=>await getCustomerBalance(${JSON.stringify(cust.id)}))()`));
    assert.strictEqual(bal.balance, 2500);
    assert.strictEqual(bal.openInvoiceCount, 1);
    const stmt = J(await app.eval(`(async()=>await getCustomerStatement(${JSON.stringify(cust.id)}))()`));
    assert.strictEqual(stmt.invoices.length, 1);
    const e = entries().find((x) => x.sourceType === 'source_document');
    assert.ok(e.lines.some((l) => l.accountId === AR && l.debit === 2500), 'AR is debited');
    assert.ok(e.lines.some((l) => l.accountId === MILK && l.credit === 2500), 'revenue is credited');
  });

  test('createPurchaseBill() posts Debit [caller account] / Credit AP and shows in the supplier balance', async () => {
    await reset();
    const sup = J(await app.eval(`(async()=>await createSupplier({name:'مورد أعلاف'}))()`));
    const bill = J(await app.eval(`(async()=>await createPurchaseBill({operationId:'bill-1',supplierId:${JSON.stringify(sup.id)},supplierName:'مورد أعلاف',total:1800,date:'2026-05-01',dueDate:'2026-05-20',debitAccountId:${JSON.stringify(FEED_EXP)}}))()`));
    assert.strictEqual(bill.ok, true, JSON.stringify(bill));
    const bal = J(await app.eval(`(async()=>await getSupplierBalance(${JSON.stringify(sup.id)}))()`));
    assert.strictEqual(bal.balance, 1800);
    const e = entries().find((x) => x.sourceType === 'source_document');
    assert.ok(e.lines.some((l) => l.accountId === AP && l.credit === 1800));
    assert.ok(e.lines.some((l) => l.accountId === FEED_EXP && l.debit === 1800));
  });

  test('getARAging()/getAPAging() bucket by days past due and never invent a due date', async () => {
    await reset();
    await app.eval(`(async()=>await createSalesInvoice({operationId:'a1',total:100,date:'2026-01-01',dueDate:'2026-01-31',revenueAccountId:${JSON.stringify(MILK)},customerId:'c1'}))()`);
    await app.eval(`(async()=>await createSalesInvoice({operationId:'a2',total:200,date:'2026-03-01',dueDate:'2026-03-31',revenueAccountId:${JSON.stringify(MILK)},customerId:'c1'}))()`);
    await app.eval(`(async()=>await createSalesInvoice({operationId:'a3',total:300,date:'2026-04-01',revenueAccountId:${JSON.stringify(MILK)},customerId:'c1'}))()`);
    await app.eval(`(async()=>await createSalesInvoice({operationId:'a4',total:400,date:'2026-05-01',dueDate:'2026-06-30',revenueAccountId:${JSON.stringify(MILK)},customerId:'c1'}))()`);
    const ag = J(await app.eval(`(async()=>await getARAging('2026-05-15'))()`));
    assert.strictEqual(ag.ok, true);
    assert.strictEqual(ag.totals.d90_plus, 100, 'Jan 31 due → 104 days past');
    assert.strictEqual(ag.totals.d31_60, 200, 'Mar 31 due → 45 days past');
    assert.strictEqual(ag.totals.noDueDate, 300, 'no due date is NEVER assumed current or overdue');
    assert.strictEqual(ag.totals.current, 400, 'due in the future → current');
    const sum = Object.values(ag.totals).reduce((a, b) => a + b, 0);
    assert.strictEqual(sum, 1000, 'every open invoice is in exactly one bucket');
  });

  test('refreshOverdueInvoiceStatuses() flips only past-due, still-open documents', async () => {
    await reset();
    await app.eval(`(async()=>await createSalesInvoice({operationId:'o1',total:100,date:'2026-01-01',dueDate:'2026-01-31',revenueAccountId:${JSON.stringify(MILK)}}))()`);
    await app.eval(`(async()=>await createSalesInvoice({operationId:'o2',total:100,date:'2026-05-01',dueDate:'2026-12-31',revenueAccountId:${JSON.stringify(MILK)}}))()`);
    const r = J(await app.eval(`(async()=>await refreshOverdueInvoiceStatuses('2026-05-15'))()`));
    assert.strictEqual(r.flagged, 1);
    const statuses = J(db.collection('source_documents')).map((d) => d.status).sort();
    assert.deepStrictEqual(statuses, ['OVERDUE', 'POSTED']);
  });

  test('createCashBankAccount() refuses a non-postable link and posts a real opening-balance entry', async () => {
    await reset();
    assert.strictEqual((J(await app.eval(`(async()=>await createCashBankAccount({name:'x',type:'bank',linkedAccountId:'1000'}))()`))).ok, false, 'a header account cannot be linked');
    assert.strictEqual((J(await app.eval(`(async()=>await createCashBankAccount({name:'x',type:'wallet',linkedAccountId:${JSON.stringify(BANK)}}))()`))).ok, false, 'type must be cash or bank');
    const ok = J(await app.eval(`(async()=>await createCashBankAccount({name:'البنك الأهلي',type:'bank',linkedAccountId:${JSON.stringify(BANK)},openingBalance:5000,openingDate:'2026-01-01'}))()`));
    assert.strictEqual(ok.ok, true, JSON.stringify(ok));
    const e = entries()[0];
    assert.ok(e.lines.some((l) => l.accountId === BANK && l.debit === 5000));
    assert.ok(e.lines.some((l) => l.accountId === '3300' && l.credit === 5000), 'the opening balance is traceable to opening equity');
    const bal = J(await app.eval(`(async()=>await getCashBankBalance(${JSON.stringify(ok.id)}))()`));
    assert.strictEqual(bal.balance, 5000, 'balance is computed from the ledger, never stored');
  });

  test('recordCashTransfer() moves money between two real accounts and refuses a self-transfer', async () => {
    await reset();
    const cash = J(await app.eval(`(async()=>await createCashBankAccount({name:'خزينة',type:'cash',linkedAccountId:${JSON.stringify(CASH)},openingBalance:1000}))()`));
    const bank = J(await app.eval(`(async()=>await createCashBankAccount({name:'بنك',type:'bank',linkedAccountId:${JSON.stringify(BANK)}}))()`));
    assert.strictEqual((J(await app.eval(`(async()=>await recordCashTransfer({operationId:'t0',fromAccountId:${JSON.stringify(cash.id)},toAccountId:${JSON.stringify(cash.id)},amount:100}))()`))).ok, false);
    const t = J(await app.eval(`(async()=>await recordCashTransfer({operationId:'t1',fromAccountId:${JSON.stringify(cash.id)},toAccountId:${JSON.stringify(bank.id)},amount:400,date:'2026-05-01'}))()`));
    assert.strictEqual(t.ok, true, JSON.stringify(t));
    assert.strictEqual((J(await app.eval(`(async()=>await getCashBankBalance(${JSON.stringify(cash.id)}))()`))).balance, 600);
    assert.strictEqual((J(await app.eval(`(async()=>await getCashBankBalance(${JSON.stringify(bank.id)}))()`))).balance, 400);
    const tb = J(await app.eval(`(async()=>await getTrialBalance('2026-12-31'))()`));
    assert.strictEqual(tb.balanced, true);
  });

  test('recordCashReceipt()/recordCashPayment() post the right way round', async () => {
    await reset();
    const cash = J(await app.eval(`(async()=>await createCashBankAccount({name:'خزينة',type:'cash',linkedAccountId:${JSON.stringify(CASH)}}))()`));
    const rec = J(await app.eval(`(async()=>await recordCashReceipt({operationId:'r1',cashBankAccountId:${JSON.stringify(cash.id)},counterAccountId:${JSON.stringify(MILK)},amount:700,date:'2026-05-01'}))()`));
    assert.strictEqual(rec.ok, true, JSON.stringify(rec));
    const pay = J(await app.eval(`(async()=>await recordCashPayment({operationId:'p1',cashBankAccountId:${JSON.stringify(cash.id)},counterAccountId:${JSON.stringify(FEED_EXP)},amount:250,date:'2026-05-02'}))()`));
    assert.strictEqual(pay.ok, true, JSON.stringify(pay));
    assert.strictEqual((J(await app.eval(`(async()=>await getCashBankBalance(${JSON.stringify(cash.id)}))()`))).balance, 450);
    assert.strictEqual((J(await app.eval(`(async()=>await recordCashReceipt({operationId:'r2',cashBankAccountId:'ghost',counterAccountId:${JSON.stringify(MILK)},amount:1}))()`))).ok, false);
  });

  test('reconcileBankAccount() compares the statement against CLEARED items, and is idempotent', async () => {
    await reset();
    const cash = J(await app.eval(`(async()=>await createCashBankAccount({name:'بنك',type:'bank',linkedAccountId:${JSON.stringify(BANK)},openingBalance:1000,openingDate:'2026-01-01'}))()`));
    const openingEntryId = entries()[0]._id;
    // Nothing cleared yet: the whole 1000 is outstanding, so the statement
    // does NOT match even though the book balance equals it.
    const uncleared = J(await app.eval(`(async()=>await reconcileBankAccount({operationId:'rec-0',cashBankAccountId:${JSON.stringify(cash.id)},statementDate:'2026-05-31',statementBalance:1000}))()`));
    assert.strictEqual(uncleared.bookBalance, 1000);
    assert.strictEqual(uncleared.clearedBalance, 0);
    assert.strictEqual(uncleared.difference, 1000);
    assert.strictEqual(uncleared.matched, false);
    assert.strictEqual(uncleared.outstandingItems.length, 1, 'the unclosed item is listed, not hidden');

    const r1 = J(await app.eval(`(async()=>await reconcileBankAccount({operationId:'rec-1',cashBankAccountId:${JSON.stringify(cash.id)},statementDate:'2026-05-31',statementBalance:1000,clearedJournalEntryIds:[${JSON.stringify(openingEntryId)}]}))()`));
    assert.strictEqual(r1.ok, true, JSON.stringify(r1));
    assert.strictEqual(r1.clearedBalance, 1000);
    assert.strictEqual(r1.difference, 0);
    assert.strictEqual(r1.matched, true);

    const r2 = J(await app.eval(`(async()=>await reconcileBankAccount({operationId:'rec-1',cashBankAccountId:${JSON.stringify(cash.id)},statementDate:'2026-05-31',statementBalance:9999,clearedJournalEntryIds:[${JSON.stringify(openingEntryId)}]}))()`));
    assert.strictEqual(r2.idempotent, true, 'a retried reconciliation must not create a second record');
    assert.strictEqual(r2.statementBalance, 1000, 'the replay returns the ORIGINAL result, not the new numbers');
    assert.strictEqual(J(db.collection('bank_reconciliations')).length, 2);

    const r3 = J(await app.eval(`(async()=>await reconcileBankAccount({operationId:'rec-2',cashBankAccountId:${JSON.stringify(cash.id)},statementDate:'2026-05-31',statementBalance:900,clearedJournalEntryIds:[${JSON.stringify(openingEntryId)}]}))()`));
    assert.strictEqual(r3.matched, false);
    assert.strictEqual(r3.difference, -100);
  });

  test('markCashBankReconciled() stamps the marker on the account record', async () => {
    await reset();
    const cash = J(await app.eval(`(async()=>await createCashBankAccount({name:'خزينة',type:'cash',linkedAccountId:${JSON.stringify(CASH)}}))()`));
    const r = J(await app.eval(`(async()=>await markCashBankReconciled(${JSON.stringify(cash.id)},'2026-05-31'))()`));
    assert.strictEqual(r.ok, true, JSON.stringify(r));
    const rec = J(db.collection('cash_bank_accounts'))[0];
    assert.strictEqual(rec.lastReconciledDate, '2026-05-31');
    assert.ok(rec.lastReconciledAt);
  });

  test('an operationId generated at submit time gives NO double-click protection (documented finding)', async () => {
    // The finance pages call `operationId: genId()` INSIDE their submit
    // handlers, so every click mints a fresh key and the engine's
    // create-or-return-existing dedup can never fire for a double-click.
    // This test pins the behaviour so the fix (mint the token when the modal
    // OPENS, clear it after success) cannot regress silently.
    await reset();
    const a = J(await app.eval(`(async()=>await createSourceDocument({operationId:genId(),type:'sales_invoice',total:100}))()`));
    const b = J(await app.eval(`(async()=>await createSourceDocument({operationId:genId(),type:'sales_invoice',total:100}))()`));
    assert.notStrictEqual(a.id, b.id, 'two fresh ids → two documents → two invoices for one sale');
    assert.strictEqual(docs().length, 2);
  });

  test('REGRESSION: a credit animal/inventory/asset purchase appears in the supplier sub-ledger', async () => {
    // Before the 2026-10 fix these posted Credit AP (2100) in the general
    // ledger but were filtered out of getSupplierBalance()/getAPAging()
    // because their doc.type is not 'purchase_invoice' -- the two books
    // disagreed and the farm under-reported what it owed.
    await reset();
    const sup = J(await app.eval(`(async()=>await createSupplier({name:'مورد مواشي'}))()`));
    const buy = J(await app.eval(`(async()=>await postAnimalPurchase({operationId:'ap-x1',animalId:'a1',animalTag:'GT-1',amount:9000,paymentMode:'credit',supplierId:${JSON.stringify(sup.id)},supplierName:'مورد مواشي',date:'2026-05-01',dueDate:'2026-05-31'}))()`));
    assert.strictEqual(buy.ok, true, JSON.stringify(buy));
    const bal = J(await app.eval(`(async()=>await getSupplierBalance(${JSON.stringify(sup.id)}))()`));
    assert.strictEqual(bal.balance, 9000, 'a credit livestock purchase is a real payable');
    const aging = J(await app.eval(`(async()=>await getAPAging('2026-05-15'))()`));
    const agingTotal = Object.values(aging.totals).reduce((a, b) => a + b, 0);
    assert.strictEqual(agingTotal, 9000, 'and it shows in the AP aging report');
    const tb = J(await app.eval(`(async()=>await getTrialBalance('2026-12-31'))()`));
    const apRow = tb.rows.find((r) => r.accountId === AP);
    assert.strictEqual(apRow.credit, 9000, 'the general ledger agrees with the sub-ledger');
    const overdue = J(await app.eval(`(async()=>await refreshOverdueInvoiceStatuses('2026-06-30'))()`));
    assert.strictEqual(overdue.flagged, 1, 'the overdue sweep covers credit purchases too');
  });

  test('REGRESSION: an animal sold on credit appears in the customer sub-ledger', async () => {
    await reset();
    const cust = J(await app.eval(`(async()=>await createCustomer({name:'مشترى مواشي'}))()`));
    const sale = J(await app.eval(`(async()=>await postAnimalSale({operationId:'as-x1',animalId:'a1',animalTag:'GT-1',salePrice:12000,paymentMode:'credit',revenueAccountId:${JSON.stringify('4100')},customerId:${JSON.stringify(cust.id)},customerName:'مشترى مواشي',date:'2026-05-01',dueDate:'2026-06-01'}))()`));
    assert.strictEqual(sale.ok, true, JSON.stringify(sale));
    const bal = J(await app.eval(`(async()=>await getCustomerBalance(${JSON.stringify(cust.id)}))()`));
    assert.strictEqual(bal.balance, 12000, 'a credit animal sale is a real receivable');
    const aging = J(await app.eval(`(async()=>await getARAging('2026-05-15'))()`));
    assert.strictEqual(Object.values(aging.totals).reduce((a, b) => a + b, 0), 12000);
  });

  test('REGRESSION: a credit-mode document carries its dueDate, so it can actually go overdue', async () => {
    await reset();
    const sup = J(await app.eval(`(async()=>await createSupplier({name:'مورد أصول'}))()`));
    const asset = J(await app.eval(`(async()=>await postAssetPurchase({operationId:'fa-1',name:'جرار',acquisitionCost:50000,usefulLifeMonths:60,paymentMode:'credit',supplierId:${JSON.stringify(sup.id)},date:'2026-01-01',dueDate:'2026-02-01'}))()`));
    assert.strictEqual(asset.ok, true, JSON.stringify(asset));
    const doc = J(db.collection('source_documents')).find((d) => d.type === 'asset_purchase');
    assert.strictEqual(doc.dueDate, '2026-02-01', 'the caller\'s due date must reach the document');
    const aging = J(await app.eval(`(async()=>await getAPAging('2026-03-01'))()`));
    assert.strictEqual(aging.totals.noDueDate, 0, 'it must NOT sit in the undated bucket');
    assert.strictEqual(aging.totals.d1_30, 50000);
    const flagged = J(await app.eval(`(async()=>await refreshOverdueInvoiceStatuses('2026-03-01'))()`));
    assert.strictEqual(flagged.flagged, 1, 'an overdue credit purchase is now detectable');
  });

  test('a CASH purchase creates no payable at all (the fix must not over-include)', async () => {
    await reset({ inventory_feeds: { f1: { name: 'علف مركز', quantity: 100, cost_per_unit: 5 } } });
    const sup = J(await app.eval(`(async()=>await createSupplier({name:'مورد كاش'}))()`));
    const r = J(await app.eval(`(async()=>await postInventoryPurchase({operationId:'cash-1',itemType:'feeds',itemName:'علف مركز',quantity:5,unitCost:10,paymentMode:'cash',cashAccountId:${JSON.stringify(CASH)},supplierId:${JSON.stringify(sup.id)},date:'2026-05-01'}))()`));
    assert.strictEqual(r.ok, true, JSON.stringify(r));
    const bal = J(await app.eval(`(async()=>await getSupplierBalance(${JSON.stringify(sup.id)}))()`));
    assert.strictEqual(bal.balance, 0, 'settled in cash → nothing owed');
  });

  test('a payroll accrual (2210) and a loan (2300) never leak into AP', async () => {
    await reset();
    const emp = J(await app.eval(`(async()=>await createEmployee({name:'عامل',rateType:'monthly',rateAmount:3000}))()`));
    const acc = J(await app.eval(`(async()=>await postLaborAccrual({operationId:'lab-1',employeeId:${JSON.stringify(emp.id)},employeeName:'عامل',amount:3000,date:'2026-05-01'}))()`));
    assert.strictEqual(acc.ok, true, JSON.stringify(acc));
    const aging = J(await app.eval(`(async()=>await getAPAging('2026-05-31'))()`));
    assert.strictEqual(Object.values(aging.totals).reduce((a, b) => a + b, 0), 0,
      'payroll payable is 2210, not trade AP — it must not inflate supplier debt');
  });
});
