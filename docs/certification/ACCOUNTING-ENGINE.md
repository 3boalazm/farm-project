# Certification: Double-Entry Accounting Engine

**Status: Built and live-verified across 43 phases (Phase 1 through Phase 43 of the Master Implementation Prompt), all committed and pushed. Not yet certified to the same bar as WEIGHT.md/BIRTH.md — those went through adversarial multi-round formal verification; this went through single-pass build-then-live-verify per function, which is real evidence but a lighter process. Treat as "strongly tested, not yet adversarially attacked."**

This is a complete parallel financial system layered on top of the app's pre-existing simple `finance` collection (still documented separately in `docs/features/FINANCE-ENGINE.md`, `FINANCE-KPIS.md`, etc. — that system is untouched and still live). The two coexist; Phase 19 (Legacy Migration) is the only bridge between them, and it has never been run against real production data (see Limitations).

## Canonical Model

Double-entry bookkeeping: every financial event is a `journal_entries` record with 2+ `lines`, each carrying an `accountId` and either a `debit` or `credit` (never both), always summing to equal totals. `postJournalEntry()` (shared.js) is the **only** way an entry is ever created — it validates balance, account existence/postability, and (if a `fiscal_periods` record covers the date) that the period is still `OPEN`. Entries are immutable once posted, both at the engine level (nothing ever `fbPatch`'s a `journal_entries` record) and at the `database.rules.json` level (`data.child('status').val() !== 'POSTED'` gates any further write to that key).

Almost everything else in the engine is either (a) a thin, validated wrapper that ends up calling `postJournalEntry`, or (b) a pure read/report function that sums `journal_entries` in some shape — never a second source of truth for a number `postJournalEntry` already owns.

## Collections

`accounts` (chart of accounts, seeded once via `seedDefaultChartOfAccounts()`, 45 entries as of Phase 43), `journal_entries`, `source_documents` (Phase 2 — invoices/receipts/payments with a status lifecycle DRAFT→POSTED→PAID, one journal entry each), `cash_bank_accounts`, `customers`, `suppliers`, `animal_cost_ledger` (write-once), `cost_centers`, `cost_allocations` (write-once), `employees`, `fixed_assets`, `loans`, `fiscal_periods`, `financial_audit_log` (write-once), `budgets`, `forecasts` (write-once, `operationId`-guarded), `bank_reconciliations` (write-once, `operationId`-guarded).

## Function Inventory (by phase)

1. **Core Engine** — `postJournalEntry`, `_validateJournalLines`, `postCorrectionEntry` (reversal-only corrections).
2. **Source Documents** — `createSourceDocument`, `postSourceDocument`, `applyPayment`.
3. **Cash & Bank** — `createCashBankAccount`, `getCashBankBalance`, `getCashBankTransactionHistory`.
4. **AR** — `getCustomerBalance`, `getARAging`.
5. **AP** — `getSupplierBalance`, `getAPAging`.
6. **Inventory Accounting** — `postInventoryPurchase`, `postInventoryConsumption`, `postInventoryAdjustment` (weighted-average cost).
7. **Animal Accounting** — `postAnimalPurchase`, `postAnimalSale`, `postAnimalDeath`, `recordAnimalCost`, `getAnimalCostBasis`.
8. **Farm Cost Accounting** — `createCostCenter`, `allocateCost`, `getCostByCenter`.
10-13. **Feed/Medicine/Labor/Production Costing** — cost-center-tagged expense postings on top of Phase 6-8.
14. **Fixed Assets** — `postDepreciation` (composite `sourceId` avoids ever patching a POSTED entry).
15. **Loans** — `postLoanReceipt`, `postLoanPrincipalPayment`, `postLoanInterestPayment`.
16. **Owner Equity** — capital/drawing postings.
17. **Fiscal Periods** — `createFiscalPeriod`, `closeFiscalPeriod`, `lockFiscalPeriod`, `reopenFiscalPeriod`, `_checkFiscalPeriodOpen` (called from every `postJournalEntry`).
18. **Audit Trail** — `_recordFinancialAudit`, write-once `financial_audit_log`.
19. **Legacy Migration** — `analyzeLegacyFinanceMigration`, `migrateLegacyFinanceRecords`, `getLegacyMigrationReconciliation`. **Never executed against real data** (see Limitations).
20. **Budgeting** — `createBudgetLine`, `approveBudgetLine`, `lockBudgetLine`, `getBudgetVsActual`.
21. **Forecasting** — `createForecast` (`operationId`-guarded since Phase 32), `getForecastVsActual`.
22. **Cash Flow Statement** — `getCashFlowStatement` (direct method, proportional split for mixed entries, exact reconciliation by construction).
23. **Bank Reconciliation** — `reconcileBankAccount` (`operationId`-guarded since Phase 32), `getBankReconciliationHistory`.
24. **Financial Statements** — `getIncomeStatement`, `getBalanceSheet` (computes unclosed current-period earnings live).
25. **General Ledger** — `getAccountLedger` (running balance, signed by normal-balance direction).
26. **Trial Balance** — `getTrialBalance`.
27. **Farm Profitability** — `getAnimalProfitability`, `rankAnimalProfitability` (O(entries) single-pass as of Phase 38, not O(animals×entries)).
28. **Dashboard KPIs** — `getFinancialDashboardKPIs` (pure composition, parallelized fetches as of Phase 38).
29. **Data Quality Scan** — `runFinancialDataQualityScan` (read-only audit: unknown accounts, non-postable postings, unbalanced entries, orphaned documents, duplicate `operationId`s).
30. **Month-End Close** — `runMonthEndClose` (closing entry dated the day *after* period end — critical, see Invariants).
31. **Security Hardening** — `journal_entries` rule now enforces `totalDebit === totalCredit` and non-empty `lines`, not just the engine.
32. **Idempotency Hardening** — `createForecast`/`reconcileBankAccount` gained `operationId` dedup (createCashBankAccount deliberately still lacks it — stated gap, see Limitations).
33. **Financial Integrity Engine** — `getFinancialIntegrityStatus` (composed health signal over 24/26/29).
37. **Report Validation** — `validateFinancialReportsCrossConsistency` (cross-checks figures computed via genuinely independent code paths).
38. **Performance** — fixed `rankAnimalProfitability`'s O(animals×entries) scan; parallelized independent awaits in the three composition functions above.

## Proven Invariants

- **Balanced by construction.** `_validateJournalLines` rejects any unbalanced entry before it's ever written; `database.rules.json` enforces the same invariant server-side (Phase 31). `getTrialBalance().balanced` and `getBalanceSheet().balanced` are live self-checks of this on real data, not assumptions.
- **Never invent a number.** Every ratio function (profit margin, ROI, debt-to-equity, budget variance, forecast variance) returns `null` on a zero/undefined denominator, never a fabricated `0` or `Infinity`. An animal with no realized sale or death has `netResult: null`, never a guessed unrealized gain.
- **Month-end close never corrupts the period it closes.** The closing entry is dated the day *after* `period.endDate` — proven live (Phase 30, re-proven end-to-end in Phase 43) that re-running `getIncomeStatement` for the just-closed period afterward still returns the original, real figures.
- **Idempotency.** Every mutating function that represents a real-world event the user might retry (offline retry, double-tap) takes a caller-supplied `operationId` and returns `{idempotent:true}` on replay without re-executing side effects — confirmed for `createSourceDocument`, `allocateCost`, `postAnimalPurchase/Sale/Death`, `migrateLegacyFinanceRecords`, `createForecast`, `reconcileBankAccount`. **Exception, stated deliberately:** `createCashBankAccount` (Phase 3) still lacks this guard.
- **Cross-report consistency.** `validateFinancialReportsCrossConsistency` proves, on real data, that `getBalanceSheet`'s unclosed-earnings line matches an independently-computed `getIncomeStatement`, that `getTrialBalance` and `getBalanceSheet` agree on asset totals, and that `getCashFlowStatement`'s closing cash matches the balance sheet's cash accounts — three genuinely separate computation paths cross-checked, not the same check repeated.

## Known, Bounded Limitations (Not Fixed — Documented)

- **Fiscal-period lock is engine-level only, not rules-level.** `postJournalEntry` refuses a posting into a `CLOSED`/`LOCKED` period; `database.rules.json` cannot yet express "which fiscal period does this date fall in" safely without a live Firebase project to test against (stated explicitly in Phase 17's own code comments and reaffirmed in Phase 31 — this session declined to write that rule blind, after an earlier untested-rules-change outage this same session).
- **`createCashBankAccount` has no `operationId` dedup** (Phase 32 scope decision — account creation is a rare, deliberate admin action, judged lower-risk than the two gaps that were fixed).
- **Legacy migration (`migrateLegacyFinanceRecords`) has never run against real production data** — only against simulated data in live-browser tests. Executing it for real remains a separate, human-triggered decision.
- **`database.rules.json` changes made this session are committed to git only, never published to the live Firebase console** by this engine's author — publishing remains a separate, human-reviewed step, per an earlier lesson this same session where an untested rules+config change caused a full production outage.
- **No full data-entry UI.** `finance-reports.html` (Phase 35) is a read-only reporting surface over the engine (KPIs, Income Statement, Balance Sheet, Trial Balance). Data-entry forms for journal entries, source documents, AR/AP, budgets, forecasts, and reconciliation do not exist yet — every function in this engine is currently callable only from `window.*` (console, another script, or a future UI), not from any page's UI. Building that UI to the same live-verified rigor as the engine itself is a distinct, comparably-sized effort.
- **No automated backup/recovery tooling was built** for this engine specifically (Phase 39 of the master prompt) — this environment has no Firebase Admin SDK / export access from the browser-only tooling available; general RTDB backup remains whatever the project already has (see `docs/repository/RISK_REGISTER.md`).
- **`offline-sync.js` wiring is a different, concurrently-active effort** by another session throughout this work — this engine's own idempotency (above) makes its writes safe to retry/replay if that queue is ever wired to route through it, but this session did not touch that file.

## Evidence

45 files in `tests/data-integrity/*.spec.js`, one per phase, each following an identical `setup*Mocks(page, overrides)` pattern intercepting `fbGet`/`fbPost`/`fbPut`/`fbPatch`. Every scenario in every file was also independently verified live against the real `shared.js` via browser automation before being written into its spec file (see individual commit messages, Phase 1 through 43, for the exact live-verified scenarios per phase). `tests/data-integrity/real-world-scenario.spec.js` (Phase 43) is the one integration-level test chaining ~15 functions across 13 phases into a single realistic month, proving composition, not just isolation. `node scripts/safety-scan.js` has reported 0 CRITICAL after every single commit in this series.

## Full History

47 commits, `Phase 21: Forecasting` (`a60394b`) through `Phase 43: Real-World Scenario Test` (`f2a9a4b`), each an atomic, independently-reversible commit with a `Co-Authored-By: Claude Sonnet 5` trailer. Phases 1-20 (the foundational engine through Legacy Migration) were built and committed earlier in the same continuous session; their commit messages carry the same live-verification discipline.
