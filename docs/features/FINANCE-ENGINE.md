# FINANCE-ENGINE.md

**2 functions, shared.js. 100% read-only, verified live by a dedicated test intercepting every fbGet call. Zero new collections -- both read the certified, pre-existing finance and animals collections exclusively.**

## computeFinanceKPIs(startDate, endDate)
One Promise.all([fbGet('finance'), fbGet('animals')]) -- confirmed by a dedicated test to call exactly these two collections, nothing else. Filters finance records into the requested date range (or all records if both bounds are omitted), sums by type, and derives every KPI from those two sums plus a live animals alive-count. No KPI is ever pre-computed or cached -- every call re-reads and re-sums from scratch, matching this sprint's own explicit "no stored KPIs" rule.

## computeFinanceTrend(granularity, periodCount)
A thin, finance-specific caller of window.bucketByPeriod() (Sprint 10, extended in this sprint with a 'year' option) -- reads finance once, buckets it by the requested granularity, and sums type==='income'/'expense' per bucket. No second bucketing algorithm; the exact same function every other Analytics trend in this app already uses.

## Category Reuse, Not Reinvention
Both functions reference 'أعلاف ومواد تغذية' and 'أدوية وتحصينات' -- the literal, pre-existing values from pages/finance.js's own EXPENSE_CATS array (docs/features/FINANCE-DISCOVERY.md). No new category enum, no English-named parallel scheme.

## Division-by-Zero Discipline
Every ratio (profitMargin, roi, feedCostPct, medicineCostPct, avgCostPerAnimal, avgRevenuePerAnimal) checks its own denominator and returns null when it is genuinely zero -- confirmed by a dedicated test with an empty finance/animals dataset. The UI layer renders null as an em-dash, never a misleading 0 or a runtime Infinity/NaN.

## The Real Bug This Sprint Fixed
animal-detail.html's sale flow previously had no structured price input and created no finance record at all -- confirmed absent, not assumed, via an exhaustive search before this sprint began. Fixed with a real price field (shown only when "بيع" is selected, matching pages/finance.js's own updateFinCats() show/hide pattern) and a fbPost('finance', {...}) call using the exact shape animals.html's already-working sale flows use. The animal record's own pre-existing sold_price field, previously always hardcoded null, is now populated with the real entered value.
