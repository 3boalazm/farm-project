// tests/rules/accounting-rules.test.js
//
// REAL Firebase Realtime Database Rules tests, using @firebase/rules-unit-testing
// against the actual Firebase RTDB Emulator. Unlike every other test in this
// repo (tests/data-integrity/*.spec.js), these do NOT mock fbGet/fbPost -- they
// load the real database.rules.json into a real emulator and exercise it
// through the real RTDB client SDK, proving the RULES themselves (not just
// application logic sitting on top of a mock) behave as intended. This is
// the missing evidence layer Phase A's review found: the mocked test suite
// proves the JS is correct but says nothing about real Firebase enforcement,
// which is exactly the gap that let the 401-on-every-accounting-collection
// production issue go undetected until a live production audit found it.
//
// ══════════════════════════════════════════════════════════════════════
//  STATUS AS OF THIS COMMIT: written, but NEVER EXECUTED.
//
//  This requires Java (the RTDB emulator is a JVM process) and the Firebase
//  CLI. This development environment has no Java installed -- confirmed via
//  the Firebase CLI's own error when actually attempting to start the
//  emulator here:
//
//    Error: Could not spawn `java -version`. Please make sure Java is
//    installed and on your system PATH.
//
//  `firebase-tools` and `@firebase/rules-unit-testing` themselves installed
//  successfully (see package.json devDependencies) -- only the emulator's
//  own JVM dependency is missing, and installing a system-wide JDK is a
//  separate, explicit decision outside this task's scope.
//
//  DO NOT treat these as passing tests. They are untested code, exactly as
//  unverified as any other code nobody has run, until someone with Java
//  installed actually executes them. Run with:
//
//    firebase emulators:exec --only database "node tests/rules/accounting-rules.test.js"
//
//  (uses the firebase.json in the repo root, which points at the real
//  database.rules.json -- no project ID is bound anywhere in this repo,
//  so this can never accidentally touch a real Firebase project; the
//  emulator only ever runs against an in-memory, ephemeral instance).
// ══════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require('@firebase/rules-unit-testing');

// "demo-*" per the library's own documented recommendation for unit testing
// -- never a real project id, and the emulator refuses to talk to production
// regardless of what's passed here.
const PROJECT_ID = 'demo-bayan-farm-rules-test';

// ── Hard safety assertion: this file must NEVER be able to reach the real
// farm-mz99 project. @firebase/rules-unit-testing structurally only ever
// resolves the RTDB emulator via the FIREBASE_DATABASE_EMULATOR_HOST env var
// (or a 127.0.0.1 fallback) -- verified by reading its bundled source
// (node_modules/@firebase/rules-unit-testing/dist/index.cjs.js), which
// contains zero references to *.firebasedatabase.app or *.firebaseio.com.
// This assertion is redundant defense-in-depth on top of that structural
// guarantee, not the only thing standing between this test and production.
function assertNeverProduction() {
  const forbidden = ['farm-mz99', 'firebasedatabase.app', 'firebaseio.com'];
  const emuHost = process.env.FIREBASE_DATABASE_EMULATOR_HOST || '';
  for (const needle of forbidden) {
    if (PROJECT_ID.includes(needle)) {
      throw new Error(`SAFETY ABORT: PROJECT_ID ("${PROJECT_ID}") contains "${needle}" -- refusing to run.`);
    }
    if (emuHost.includes(needle)) {
      throw new Error(`SAFETY ABORT: FIREBASE_DATABASE_EMULATOR_HOST ("${emuHost}") contains "${needle}" -- refusing to run.`);
    }
  }
  if (emuHost && !/^(127\.0\.0\.1|localhost|\[::1\])[:]/.test(emuHost)) {
    throw new Error(`SAFETY ABORT: FIREBASE_DATABASE_EMULATOR_HOST ("${emuHost}") is not a loopback address -- refusing to run.`);
  }
}

async function main() {
  assertNeverProduction();
  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    database: {
      rules: fs.readFileSync(path.join(__dirname, '..', '..', 'database.rules.json'), 'utf8'),
    },
  });

  let passed = 0, failed = 0;
  async function test(name, fn) {
    try { await fn(); console.log('  PASS - ' + name); passed++; }
    catch (e) { console.log('  FAIL - ' + name + ' -- ' + e.message); failed++; }
  }

  // ── Fixtures ─────────────────────────────────────────────────────────
  // One real admin (PIN-verified -> signInWithFirebaseAuth -> uid_lookup
  // written), one real non-finance user (worker) the same way, and one
  // "anonymous Firebase Auth" session that -- exactly like the real app's
  // automatic Anonymous Auth safety net -- has a valid auth.uid but NO
  // uid_lookup entry, because only the real per-user sign-in path ever
  // writes one.
  const ADMIN_UID = 'real-admin-uid';
  const ADMIN_APP_ID = 'u_admin1';
  const WORKER_UID = 'real-worker-uid';
  const WORKER_APP_ID = 'u_worker1';
  const ANON_UID = 'anonymous-session-uid';

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.database();
    await db.ref('uid_lookup/' + ADMIN_UID).set({ appUserId: ADMIN_APP_ID });
    await db.ref('users/' + ADMIN_APP_ID).set({ name: 'Admin', role: 'admin' });
    await db.ref('uid_lookup/' + WORKER_UID).set({ appUserId: WORKER_APP_ID });
    await db.ref('users/' + WORKER_APP_ID).set({ name: 'Worker', role: 'worker' });
    await db.ref('accounts/1200').set({ code: '1200', name_ar: 'البنك', type: 'ASSET' });
    await db.ref('customers/c1').set({ name: 'Test Customer' });
  });

  const anon = testEnv.unauthenticatedContext();
  const anonAuthed = testEnv.authenticatedContext(ANON_UID, {
    provider_id: 'anonymous',
    firebase: { sign_in_provider: 'anonymous' },
  });
  const worker = testEnv.authenticatedContext(WORKER_UID);
  const admin = testEnv.authenticatedContext(ADMIN_UID);

  // 1. Anonymous user (no Firebase Auth at all) cannot read accounts.
  await test('unauthenticated (no Firebase Auth) cannot read accounts', async () => {
    await assertFails(anon.database().ref('accounts/1200').get());
  });

  // 2. Anonymous user cannot read customers.
  await test('unauthenticated cannot read customers', async () => {
    await assertFails(anon.database().ref('customers/c1').get());
  });

  // 3. Anonymous FIREBASE AUTH SESSION (auth != null, no uid_lookup entry --
  //    the real production scenario this whole phase exists to close)
  //    cannot read journal_entries.
  await test('anonymous Firebase Auth session (auth != null, no uid_lookup) cannot read journal_entries', async () => {
    await assertFails(anonAuthed.database().ref('journal_entries').get());
  });
  await test('anonymous Firebase Auth session cannot read accounts either', async () => {
    await assertFails(anonAuthed.database().ref('accounts/1200').get());
  });
  await test('anonymous Firebase Auth session cannot read customers either', async () => {
    await assertFails(anonAuthed.database().ref('customers/c1').get());
  });

  // 4. Non-finance authenticated user (real PIN-verified worker) cannot
  //    read accounting.
  await test('non-finance real user (worker) cannot read accounts', async () => {
    await assertFails(worker.database().ref('accounts/1200').get());
  });
  await test('non-finance real user (worker) cannot read customers', async () => {
    await assertFails(worker.database().ref('customers/c1').get());
  });

  // 5. Non-finance authenticated user cannot write accounting.
  await test('non-finance real user (worker) cannot write accounts', async () => {
    await assertFails(worker.database().ref('accounts/9999').set({ code: '9999', name_ar: 'x', type: 'ASSET' }));
  });

  // 6. Authorized (admin) user can read accounting.
  await test('admin can read accounts', async () => {
    await assertSucceeds(admin.database().ref('accounts/1200').get());
  });
  await test('admin can read customers', async () => {
    await assertSucceeds(admin.database().ref('customers/c1').get());
  });

  // 7. Authorized (admin) user can perform a permitted write.
  await test('admin can create a new account', async () => {
    await assertSucceeds(admin.database().ref('accounts/6999').set({ code: '6999', name_ar: 'حساب اختبار', type: 'EXPENSE' }));
  });

  // 8. Admin can perform an admin-only operation.
  await test('admin can create a fiscal period', async () => {
    await assertSucceeds(admin.database().ref('fiscal_periods/2026-01').set({
      periodKey: '2026-01', startDate: '2026-01-01', endDate: '2026-01-31', status: 'OPEN',
    }));
  });

  // 9. Posted journal entries cannot be mutated -- not even by admin.
  await test('a POSTED journal entry cannot be modified, even by admin', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.database().ref('journal_entries/j1').set({
        date: '2026-01-01', status: 'POSTED',
        lines: { 0: { accountId: '1200', debit: 100 }, 1: { accountId: '3300', credit: 100 } },
        totalDebit: 100, totalCredit: 100,
      });
    });
    await assertFails(admin.database().ref('journal_entries/j1/description').set('tampered'));
  });

  // 10. Financial audit log cannot be modified after creation -- not even
  //     by admin (write-once, matching animal_cost_ledger/forecasts/etc.).
  await test('financial_audit_log entry cannot be modified after creation, even by admin', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.database().ref('financial_audit_log/a1').set({ action: 'POST', entity: 'journal_entry' });
    });
    await assertFails(admin.database().ref('financial_audit_log/a1/action').set('EDITED'));
  });

  // 11. Write validation still rejects malformed accounting records -- not
  //     even admin can bypass structural validation or the balanced-entry
  //     invariant.
  await test('a journal entry missing required fields is rejected even for admin', async () => {
    await assertFails(admin.database().ref('journal_entries/bad1').set({ date: '2026-01-01' }));
  });
  await test('an unbalanced journal entry (totalDebit != totalCredit) is rejected even for admin', async () => {
    await assertFails(admin.database().ref('journal_entries/bad2').set({
      date: '2026-01-01', status: 'POSTED',
      lines: { 0: { accountId: '1200', debit: 100 } },
      totalDebit: 100, totalCredit: 50,
    }));
  });

  // 12. Existing non-accounting collections continue to behave exactly as
  //     before -- this phase touched ONLY the 17 accounting collections;
  //     everything else must be unchanged. This is the direct evidence
  //     that the anonymous-auth-satisfies-auth!=null characteristic still
  //     holds for pre-existing collections (a deliberate, separate,
  //     out-of-scope-for-this-phase fact, not a regression this phase
  //     introduced).
  await test('anonymous Firebase Auth session CAN still read animals (unchanged, pre-existing behavior)', async () => {
    await assertSucceeds(anonAuthed.database().ref('animals').get());
  });
  await test('non-finance real user (worker) CAN still write animals (unchanged, pre-existing behavior)', async () => {
    await assertSucceeds(worker.database().ref('animals/a1').set({ species: 'goat', breed: 'test', gender: 'male' }));
  });
  await test('non-finance real user (worker) CAN still read the old finance collection (unchanged, pre-existing behavior)', async () => {
    await assertSucceeds(worker.database().ref('finance').get());
  });
  await test('non-finance real user (worker) still CANNOT write the old finance collection (unchanged, pre-existing behavior)', async () => {
    await assertFails(worker.database().ref('finance/f1').set({ type: 'income', amount: 100, date: '2026-01-01' }));
  });

  // ══════════════════════════════════════════════════════════════════
  // Full 17-collection matrix -- Phase 5D requires proving every one of
  // the accounting collections, not a handful of representatives. Each
  // entry supplies a minimal VALID record shape (satisfying that
  // collection's own .validate rule, read directly from
  // database.rules.json) so "admin write allowed" exercises a write that
  // would actually be accepted, not one that fails validation and gives
  // a false negative for the wrong reason.
  // ══════════════════════════════════════════════════════════════════
  const ACCOUNTING_COLLECTIONS = [
    { name: 'accounts', valid: () => ({ code: '9001', name_ar: 'حساب اختبار', type: 'ASSET' }) },
    { name: 'journal_entries', valid: () => ({
        date: '2026-02-01', status: 'DRAFT',
        lines: { 0: { accountId: '1200', debit: 50 }, 1: { accountId: '3300', credit: 50 } },
        totalDebit: 50, totalCredit: 50,
      }) },
    { name: 'source_documents', valid: () => ({
        type: 'receipt', date: '2026-02-01', total: 100, operationId: 'op-' + Math.random(), status: 'DRAFT',
      }) },
    { name: 'cash_bank_accounts', valid: () => ({ name: 'خزينة اختبار', type: 'cash', linkedAccountId: '1100' }) },
    { name: 'customers', valid: () => ({ name: 'عميل اختبار' }) },
    { name: 'suppliers', valid: () => ({ name: 'مورّد اختبار' }) },
    { name: 'animal_cost_ledger', valid: () => ({ animalId: 'a1', costType: 'feed', amount: 10 }), writeOnce: true },
    { name: 'cost_centers', valid: () => ({ name: 'مركز تكلفة اختبار', type: 'production' }) },
    { name: 'cost_allocations', valid: () => ({ sourceJournalEntryId: 'j1', totalAmount: 100, allocations: { 0: { costCenterId: 'c1', amount: 100 } } }), writeOnce: true },
    { name: 'employees', valid: () => ({ name: 'موظف اختبار' }) },
    { name: 'fixed_assets', valid: () => ({ name: 'أصل اختبار', acquisitionCost: 1000, usefulLifeMonths: 60 }) },
    { name: 'loans', valid: () => ({ lenderName: 'بنك اختبار', principalAmount: 5000 }) },
    { name: 'fiscal_periods', valid: () => ({ periodKey: '2026-02', startDate: '2026-02-01', endDate: '2026-02-28', status: 'OPEN' }) },
    { name: 'financial_audit_log', valid: () => ({ action: 'TEST', entity: 'unit_test' }), writeOnce: true },
    { name: 'budgets', valid: () => ({ periodKey: '2026-02', accountId: '5100', amount: 200, status: 'DRAFT' }) },
    { name: 'forecasts', valid: () => ({ targetPeriodKey: '2026-03', accountId: '4100', forecastValue: 500, operationId: 'op-' + Math.random() }), writeOnce: true },
    { name: 'bank_reconciliations', valid: () => ({ cashBankAccountId: 'cb1', statementDate: '2026-02-01', statementBalance: 1000, operationId: 'op-' + Math.random() }), writeOnce: true },
  ];

  console.log('\n-- Full 17-collection read/write matrix --');
  let seq = 0;
  for (const col of ACCOUNTING_COLLECTIONS) {
    const seedId = 'seed-' + col.name;
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.database().ref(col.name + '/' + seedId).set(col.valid());
    });

    await test(`[${col.name}] anonymous (no Firebase Auth) read denied`, async () => {
      await assertFails(anon.database().ref(col.name + '/' + seedId).get());
    });
    await test(`[${col.name}] anonymous Firebase Auth session (no uid_lookup) read denied`, async () => {
      await assertFails(anonAuthed.database().ref(col.name + '/' + seedId).get());
    });
    await test(`[${col.name}] non-admin real user (worker) read denied`, async () => {
      await assertFails(worker.database().ref(col.name + '/' + seedId).get());
    });
    await test(`[${col.name}] admin read allowed`, async () => {
      await assertSucceeds(admin.database().ref(col.name + '/' + seedId).get());
    });

    await test(`[${col.name}] anonymous (no Firebase Auth) write denied`, async () => {
      await assertFails(anon.database().ref(col.name + '/write-anon-' + (seq++)).set(col.valid()));
    });
    await test(`[${col.name}] anonymous Firebase Auth session write denied`, async () => {
      await assertFails(anonAuthed.database().ref(col.name + '/write-anonauth-' + (seq++)).set(col.valid()));
    });
    await test(`[${col.name}] non-admin real user (worker) write denied`, async () => {
      await assertFails(worker.database().ref(col.name + '/write-worker-' + (seq++)).set(col.valid()));
    });
    await test(`[${col.name}] admin valid write allowed (new record)`, async () => {
      await assertSucceeds(admin.database().ref(col.name + '/write-admin-' + (seq++)).set(col.valid()));
    });

    if (col.writeOnce) {
      await test(`[${col.name}] write-once: admin second write to the SAME id fails`, async () => {
        await assertFails(admin.database().ref(col.name + '/' + seedId).set(col.valid()));
      });
      await test(`[${col.name}] write-once: admin CANNOT delete an existing record`, async () => {
        await assertFails(admin.database().ref(col.name + '/' + seedId).set(null));
      });
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // Delete semantics -- Phase 5E. A prior, source-reading-only review
  // hypothesized these plain-hasChild()-validated master-data collections
  // would be UNDELETABLE (a delete writes null, and hasChild(null) is
  // false, so the reasoning went ".validate would reject it"). Running
  // this against the real emulator proved that hypothesis WRONG:
  // Firebase does not apply ".validate" to a delete, so all 8 of these
  // ARE deletable today. Repo-wide grep confirms zero fbDelete() calls
  // against any of them anywhere in the app -- deletion is unreachable
  // through the UI, but nothing in the rules actively prevents it via
  // direct admin-credential API/console access either.
  //
  // Whether that should be blocked (matching the write-once collections'
  // now-fixed guard above) is a genuine, undecided PRODUCT question --
  // does an admin ever legitimately need to delete a customer/supplier/
  // employee/loan/account/cash-bank-account/fixed-asset/cost-center? --
  // not a security bug the way journal_entries/source_documents'
  // immutability-bypass and the write-once collections' delete-bypass
  // were (both directly contradicted this file's own stated design
  // intent; this one has no stated intent either way). Left undecided
  // deliberately: these tests assert the CURRENT, confirmed-by-execution
  // behavior (deletion currently succeeds) rather than a desired one, so
  // this stays a documented, honest fact instead of a permanently-red
  // assertion for a decision nobody has actually made. See
  // docs/repository/FIREBASE-RULES-EXECUTION-2026-08-24.md.
  // ══════════════════════════════════════════════════════════════════
  // ══════════════════════════════════════════════════════════════════
  // source_documents: the status-rollback two-step bypass (found by an
  // independent adversarial re-scan after the journal_entries/
  // source_documents scoping fix above, execution-verified, then fixed
  // in the SAME pass). The scoping fix only corrected WHERE data/newData
  // resolve to -- it did not stop the rule's third clause from allowing
  // status to move to ANY value (including back to 'DRAFT') as long as
  // type/date/total stayed put in that one write. That let an admin:
  // (1) set status:'DRAFT' on a POSTED document -- allowed, since
  //     financial fields were untouched in that write; then
  // (2) with status now reading 'DRAFT', freely rewrite total/type/date
  //     in a second write -- allowed, since the second clause
  //     ("status === 'DRAFT'") now applied.
  // Fixed by also requiring newData's status not be 'DRAFT' in the third
  // clause -- once a document leaves DRAFT, nothing can move it back.
  // ══════════════════════════════════════════════════════════════════
  console.log('\n-- source_documents: status-rollback two-step bypass (fixed) --');
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.database().ref('source_documents/sd-bypass-check').set({
      type: 'sales_invoice', date: '2026-01-01', total: 100, operationId: 'op-sd-bypass-check', status: 'POSTED',
    });
  });
  await test('[source_documents] step 1 of the bypass: rolling status back to DRAFT on a POSTED document is rejected', async () => {
    await assertFails(admin.database().ref('source_documents/sd-bypass-check/status').set('DRAFT'));
  });
  await test('[source_documents] step 2 of the bypass: total is still frozen (the real status never changed)', async () => {
    await assertFails(admin.database().ref('source_documents/sd-bypass-check/total').set(99999));
  });
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.database().ref('source_documents/sd-legit-transition').set({
      type: 'sales_invoice', date: '2026-01-01', total: 100, operationId: 'op-sd-legit-transition', status: 'POSTED',
    });
  });
  await test('[source_documents] a real status transition (POSTED -> PARTIALLY_PAID) still works', async () => {
    await assertSucceeds(admin.database().ref('source_documents/sd-legit-transition').update({ status: 'PARTIALLY_PAID', paidAmount: 50, remainingAmount: 50 }));
  });

  console.log('\n-- Delete semantics (execution-verified; product decision pending, not a fixed bug) --');
  const HASCHILD_ONLY_COLLECTIONS = ['customers', 'suppliers', 'employees', 'loans', 'accounts', 'cash_bank_accounts', 'fixed_assets', 'cost_centers'];
  for (const name of HASCHILD_ONLY_COLLECTIONS) {
    const col = ACCOUNTING_COLLECTIONS.find((c) => c.name === name);
    const delId = 'del-test-' + name;
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.database().ref(name + '/' + delId).set(col.valid());
    });
    await test(`[${name}] admin CAN currently delete an existing record (unreachable via app UI; undecided whether this should be blocked -- not yet a guard, not a confirmed bug)`, async () => {
      await assertSucceeds(admin.database().ref(name + '/' + delId).set(null));
    });
  }

  await testEnv.cleanup();

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exitCode = failed ? 1 : 0;
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exitCode = 1;
});
