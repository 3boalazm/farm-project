# FINANCE-ARCHITECTURE.md

## Reuse Map, Explicit
| This sprint needs... | Reuses |
|---|---|
| Expense/revenue categories | INCOME_CATS/EXPENSE_CATS (pages/finance.js) -- unchanged |
| The finance collection itself | Unchanged, no new fields required for KPI computation |
| Permission | can('finance') -- unchanged, same restrictive admin-only gate |
| Dashboard architecture | The existing Today Summary panel's own container/render pattern |
| Reports architecture | renderFinanceTab()'s existing tab, extended with KPI cards |
| Analytics architecture | bucketByPeriod()/computeFarmAnalytics() (Sprint 10) -- extended with a 'year' granularity option and a finance dimension, not a second bucketing engine |
| Notification architecture | notifications-service.js's existing NS.checkAll()/NS.save() dedup mechanism |
| Workflow architecture | window.completeWorkflow('sale', ...) (Sprint 11) -- extended to create the revenue record it was missing, not a new workflow type |
| Timeline | Dashboard's existing recentRecords merge (already includes finance records via the pre-existing "مالية" event type) |
| Export | reports.js's existing exportAllExcel()/shareWhatsApp() pattern |

## The One New Engine: Two Functions, Both Read-Only
```
window.computeFinanceKPIs(startDate, endDate)
  reads: finance, animals (count only)
  returns: { revenue, expenses, netProfit, profitMargin, roi,
             avgCostPerAnimal, avgRevenuePerAnimal,
             feedCostPct, medicineCostPct, categoryBreakdown }

window.computeFinanceTrend(granularity, periodCount)
  reuses: window.bucketByPeriod() (Sprint 10) -- extended with 'year'
  returns: [{ label, revenue, expenses, profit }, ...]
```
Neither function introduces a second bucketing or aggregation technique -- computeFinanceTrend is a thin domain-specific caller of the exact same bucketByPeriod() every other Analytics trend already uses.

## KPI Formulas, Precisely (No Invented Metric)
```
revenue        = sum(finance.amount where type='income' in range)
expenses       = sum(finance.amount where type='expense' in range)
netProfit      = revenue - expenses
profitMargin   = revenue > 0 ? netProfit / revenue : null
roi            = expenses > 0 ? netProfit / expenses : null
avgCostPerAnimal    = expenses / aliveAnimalCount        (honest operational-cost average -- see FINANCE-DISCOVERY.md)
avgRevenuePerAnimal = revenue / aliveAnimalCount
feedCostPct     = expenses > 0 ? sum(expense where category='أعلاف ومواد تغذية') / expenses : null
medicineCostPct = expenses > 0 ? sum(expense where category='أدوية وتحصينات') / expenses : null
```
Every formula guards its own division by zero, returning null (not 0, not Infinity, not a fabricated fallback number) when the denominator is genuinely zero -- the UI displays em-dash for null, never a misleading zero.

## The Real Bug This Sprint Fixes
animal-detail.html's sale flow gains a real, structured price input (previously only a free-text notes field), and its submitRemoveAnimal() now calls fbPost('finance', {type:'income', category:'بيع حيوانات', ...}) -- the exact same shape animals.html's already-working sale flows use, when (and only when) a price is entered. window.completeWorkflow('sale', ...)'s own recommendation is extended to confirm the revenue was recorded, reusing the workflow engine's existing structure, not a new one.

## SSOT, Reconfirmed
Zero new collections. Every KPI is computed live from finance (already-certified SSOT, 10+ existing writers, none touched) plus a .length count of animals. No KPI value is ever written back to Firebase -- confirmed structurally and by a dedicated test, matching the same discipline the Sprint 12 predictive layer already established.
