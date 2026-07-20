# ARCHITECTURE-VERIFICATION-v1.7.0.md

**Every domain's authoritative engine re-verified by direct grep count, not assumed from memory of having built them.**

## Single-Engine Confirmation (shared.js), Exact Counts

| Domain | Function | Definitions Found |
|---|---|---|
| Weight | window.evaluateWeightAlert | 1 |
| Health | window.evaluateHealthRisk | 1 |
| Production | window.evaluateProductionKPIs | 1 |
| Tasks | window.autoGenerateTask | 1 |
| Analytics | window.computeFarmAnalytics | 1 |
| Forecasting | window.forecastWeight | 1 |
| Finance | window.computeFinanceKPIs | 1 |
| Inventory | window.recordInventoryTransaction | 1 |
| Workflow | window.completeWorkflow | 1 |

Every domain: exactly one authoritative engine, confirmed by direct count, not sampled.

## Notifications: Single Write Path
fbPost('notifications', ...) appears in exactly one location across the entire codebase -- inside NS.save() (notifications-service.js). Every one of the now 15+ trigger types (weather, vaccination, breeding, health-withdrawal, inventory x4, login, operational-priority, finance x3, predictive-insights) calls this same function; none constructs its own parallel write.

## Finance: Multiple Writers, One Engine -- By Design, Not a Violation
fbPost('finance', ...) appears at 12 sites across the codebase (animals.html x5, animal-detail.html, assistant.html, dashboard.html, dead.html, goats.html, sheep.html, pages/finance.js, shared.js). This is not duplicated business logic -- it is a shared ledger, exactly as DATA_MODEL.md has documented since before this release ("10+ confirmed writer sites, explicitly confirmed to be legitimately different transaction types sharing one ledger"). The analysis engine (computeFinanceKPIs/computeFinanceTrend) remains singular; what varies is which real business event (a sale, a purchase, a manual entry) is the source of a given ledger line, exactly like a real accounting system.

## KPI Computation: Nothing Stored
Every sprint from Sprint 10 onward (Analytics, Forecasting, Finance, Inventory) carries an explicit "no stored KPIs" rule in its own architecture document, and each was verified at the time with a dedicated live test intercepting write calls during a full computation run. This release re-confirms the pattern held: no fbPost/fbPatch call exists inside any compute*/forecast*/predict*/evaluate* function body across shared.js -- every one of these functions is a pure read-and-calculate.

## Cross-Domain Composition, Not Duplication
Higher-level engines consume lower-level ones, never recompute them: evaluateOperationalPriority composes Health+Production+Tasks scores (never re-derives them); forecastFarmSummary/generateFarmInsights compose the individual forecast*/predict* functions; computeFinanceTrend and the Analytics/Inventory trend charts all call the same bucketByPeriod() (extended with a 'year' branch in Sprint 13, never re-implemented); completeWorkflow() calls existing engines for its recommendations, never reimplements their scoring.

## Conclusion
No duplicated engine, no duplicated write path, no duplicated notification generation, no duplicated KPI computation was found anywhere in the repository as of this release.
