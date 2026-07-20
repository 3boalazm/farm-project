# FINANCE-KPIS.md

## Formulas, Exact
```
revenue        = sum(finance.amount where type='income', in range)
expenses       = sum(finance.amount where type='expense', in range)
netProfit      = revenue - expenses
profitMargin   = revenue > 0 ? netProfit / revenue : null
roi            = expenses > 0 ? netProfit / expenses : null
avgCostPerAnimal    = expenses / count(animals where status='alive')      (or null if zero alive)
avgRevenuePerAnimal = revenue / count(animals where status='alive')       (or null if zero alive)
feedCostPct     = expenses > 0 ? sum(expense where category='أعلاف ومواد تغذية') / expenses : null
medicineCostPct = expenses > 0 ? sum(expense where category='أدوية وتحصينات') / expenses : null
```

## Where Each KPI Appears
| KPI | Dashboard | Reports (Finance tab) | Analytics |
|---|---|---|---|
| Revenue / Expenses / Net Profit | Executive Finance Card (today only) | existing KPI cards (unchanged) | Financial Trends chart, per period |
| Profit Margin, ROI | -- | advanced KPI row (new) | -- |
| Avg Cost/Revenue per Animal | -- | advanced KPI row (new) | -- |
| Feed %, Medicine % | -- | advanced KPI row (new) | -- |

## Average Cost Per Animal, Honestly Scoped
This is total recorded operational expenses divided by the current alive-animal count -- not a per-animal cost-of-goods figure. No structured purchase-price field exists for animals added by purchase (docs/features/FINANCE-DISCOVERY.md), so a true per-animal COGS is not something this repository's data can support today. The KPI name in the UI and this document both say "average," not "exact" or "per-animal actual."

## Profit Margin and ROI, the Difference
profitMargin answers "of every unit of revenue, how much is profit" (a revenue-relative measure). roi answers "of every unit spent, how much came back as profit" (an expense-relative measure). Both can be negative (a loss); both are null, never 0, when their denominator is genuinely zero -- a farm with zero recorded expenses has an undefined ROI, not a 0% one.

## Nothing Here Is Ever Stored
Every KPI is computed fresh on every call to computeFinanceKPIs()/computeFinanceTrend() -- no Firebase write of a KPI value exists anywhere in this sprint's code, matching the mission's own explicit "no stored KPIs" rule and verified by a dedicated read-only test.
