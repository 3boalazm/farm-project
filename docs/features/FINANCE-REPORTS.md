# FINANCE-REPORTS.md

## The Financial Report Tab
reports.js's pre-existing renderFinanceTab() -- not a new tab. This sprint adds one new row, "المؤشرات المتقدمة" (finance-advanced-kpis), populated asynchronously by renderFinanceAdvancedKPIs(), which calls window.computeFinanceKPIs() verbatim. Everything else on the tab (income/expense/net-profit KPI cards, the 6-month monthly chart, category breakdown bars, the recent-transactions table) is unchanged.

## Excel Export and WhatsApp Summary
Both already existed for the Finance tab before this sprint (part of reports.js's existing exportAllExcel()/shareWhatsApp()) -- confirmed in discovery, not rebuilt. This sprint did not need to touch either, since neither was missing any capability this sprint's brief asked for.

## Analytics: Financial Trends
A 6th chart on analytics.html, "الاتجاه المالي" -- revenue, expenses, and profit lines, one mkChart() call, reusing window.computeFinanceTrend() with whatever granularity (week/month/quarter/year) the page's existing selector is already set to. The 'year' option itself is new to the page's granularity switcher in this sprint, added as one more button matching the existing three exactly.

## Dashboard: Executive Finance Card
A new card on dashboard.html, visible only to can('finance') (the same restrictive, admin-only permission the rest of finance already uses). Computes nothing new -- reuses todaySummary.income/.expense, numbers the existing "ملخص اليوم" card right above it already shows, reframed as "Profit Today."

## Animal Detail: Financial History
A new section, admin-only. Shows one real, direct number (sold_price, if the animal was sold) and two clearly-labeled estimates (barn-average feed/medicine cost, since finance expense records carry no animal-level link -- only barn, confirmed in discovery). The section's own caption states this limitation explicitly, in the UI itself, not only in this document.

## What This Sprint Did Not Rebuild
No new Finance page, no new expense/revenue form, no new permission, no new export mechanism, no new chart-loading library. Every one of those already existed and worked; this sprint's job was closing the specific analytical and cross-page-integration gaps discovery confirmed were real.
