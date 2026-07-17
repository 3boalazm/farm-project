# FINANCE-DISCOVERY.md

**The single most important finding this discovery produced: a real, working, multi-writer financial system already exists in this repository. This sprint does not build a financial layer from scratch -- the mission's own fallback instruction ("if no financial system exists, build one") does not apply. What follows is what exists, what is genuinely missing, and one confirmed real bug this discovery found.**

## What Already Exists (Confirmed by Direct Source Read)

- finance collection: a real, multi-writer SSOT (10+ confirmed writer sites across the codebase from earlier sessions' own audits, reconfirmed here).
- finance.html + pages/finance.js: a dedicated page, with a real add/edit form.
- cost.html: a separate cost-calculator page.
- Structured categories, already exactly matching this sprint's request: INCOME_CATS = ['بيع حيوانات','بيع ألبان','بيع صوف','بيع سماد','إيراد آخر'] and EXPENSE_CATS = ['أعلاف ومواد تغذية','أدوية وتحصينات','عمالة','كهرباء ومياه','صيانة معدات','نقل وشحن','إيجار','مصروف آخر'] (pages/finance.js). This is, in Arabic, almost exactly the Feed/Medicine+Vaccination/Labor/Utilities/Maintenance/Fuel(as شحن)/Misc breakdown this sprint's own brief lists -- not a coincidence to rebuild in English under new names.
- A distinct, restrictive permission: can('finance') -- confirmed only admin has it; supervisor is explicitly excluded (p=>!['users','finance','activity'].includes(p)), vet/worker/visitor never had it. This is already the most restricted permission in the system besides users/activity.
- Dashboard: "Today Summary" already computes today's income/expense (todaySummary.income/.expense) and a monthly income/expense comparison, both from direct finance reads.
- Reports: renderFinanceTab() (pages/reports.js) already exists -- income/expense totals, a 6-month monthly chart (buildMonthlyFin).
- Sale -> Revenue linking: confirmed already working -- animals.html's bulk-sell and individual-sell flows already call fbPost('finance', {type:'income', category:'بيع حيوانات', ...}) at 5 separate write sites.

## Confirmed Genuinely Absent

- Analytics: computeFarmAnalytics() (Sprint 10) has zero financial dimension -- no revenue/expense/profit bucketing anywhere in it. This sprint's Phase 5 request is real, new work.
- Sophisticated KPIs: cost/revenue-per-animal, feed-cost-%, medicine-cost-%, profit margin, ROI -- none of these are computed anywhere. finance.js/reports.js only ever sum income and expense.
- Animal Detail Financial History: no per-animal financial view exists anywhere.
- Finance-specific notifications: zero finance-related triggers in notifications-service.js.
- Executive Finance Card (Dashboard): the existing Today Summary shows income/expense but not an explicit profit/cash-flow framing as its own card.

## A Real, Confirmed Bug This Discovery Found (Not Invented For This Sprint)
Selling an animal from its own detail page (animal-detail.html's submitRemoveAnimal()) creates NO finance record at all -- confirmed by an exhaustive search for fbPost('finance' in that file (zero matches). The form's own "notes" field is literally labeled "ملاحظات (سعر البيع مثلاً)" ("notes (sale price, for example)") -- the price, if a user types it at all, lands as unstructured free text, never becomes a real number. This directly contradicts animals.html's own sale flows, which correctly create the revenue record from a real, structured price field. This is exactly the "existing SSOT gap" Sprint 13's own Phase 9 (auto-link sale to revenue) exists to close -- not a new feature, a real inconsistency between two existing sale paths.

## Purchase Cost, Honestly Assessed
No structured "purchase cost" field exists for an animal added by purchase or import -- only a generic "birth amount" field tied specifically to breeding/birth records, described in its own tooltip as potentially covering "mother's purchase price, vet cost, or the estimated value of the newborn," an intentionally loose, non-itemized figure. "Average Cost per Animal" in this sprint's KPIs is therefore computed as total recorded expenses divided by animal count over a period -- an honest operational-cost average, not a claim of per-animal purchase-price tracking this repository does not have.

## Design Consequence
Per this sprint's own explicit rule ("if you discover part of what's required already exists, reuse it instead of rebuilding it"): no new expense/revenue category scheme, no new finance page, no new permission, no new SSOT collection. New work is: (1) fixing the confirmed sale-from-detail-page gap, (2) the KPI formulas genuinely absent today, (3) Analytics/Dashboard/Animal-Detail/Notification/Reports integration of those KPIs, all reading the existing finance collection directly, never a new one.
