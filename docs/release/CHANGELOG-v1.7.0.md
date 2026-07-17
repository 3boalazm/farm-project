# CHANGELOG-v1.7.0.md

**From v1.0.0-rc1 to v1.7.0. Every entry traces to a real commit in this repository's own history -- nothing listed here was not actually built and tested.**

## v1.1 -- Reports Intelligence + Notification Center (commits 429ea15, 7abe56a)
- Reports gained a 5th tab, "الذكاء التشغيلي", reusing Sprint 1-5's engines verbatim.
- Full notification-system discovery resolved a long-standing, documented contradiction about whether a persisted producer existed (it did -- notifications-service.js).
- Unified notification center: read/unread state, dismiss, categories, priority, expiration, deep-linking, Reports/Dashboard/Animal-Detail integration.

## v1.2 -- Predictive Intelligence (commit 6b9b32a)
- forecastWeight/forecastProduction/forecastHealthRisk/forecastTaskWorkload/forecastFarmSummary -- statistical/rule-based only, no machine learning, 100% read-only.
- Dashboard Farm Forecast Summary, Animal Detail forecast section, Reports Forecast tab.

## Hotfix -- Sidebar Contrast (commit 51fb4e1)
- Fixed a light-mode WCAG contrast failure on the active sidebar item (measured ~1.98:1, fixed to ~7.88:1) -- one CSS rule, zero architecture change.

## v1.3 -- Farm Analytics (commit 80dd894)
- computeFarmAnalytics()/bucketByPeriod() -- historical trend engine (Productivity Index, Herd Health Trend, Production Trend, Operational Efficiency, Risk Trend), week/month/quarter granularity.
- New analytics.html page. Chart.js wrapper relocated from pages/reports.js to shared.js so both pages could share one implementation.

## v1.4 -- Workflow Orchestration (commit 9548bbc)
- completeWorkflow() -- closes reminder tasks that used to go stale (birth, vaccination, medication) and, for sale/death, resolves every open reminder tied to an animal (previously zero automation existed for either).
- Operational History tab in Reports.

## v1.5 -- Farm Insights (commit 2369813)
- predictWeightRisk/predictMilkTrend/predictTaskLoad (aliases to the existing v1.2 forecast layer, avoiding duplication), plus 3 genuinely new functions: predictTreatmentOverload, predictVaccinationPressure, predictBreedingWindow.
- generateFarmInsights() -- structured, evidence-cited insights. Analytics forecast-chart extension. One confidence-gated notification trigger.

## v1.6 -- Farm Finance (commit 8cfff5a)
- Discovered and extended a real, pre-existing financial system rather than rebuilding one.
- Fixed a confirmed bug: selling an animal from its own detail page created no revenue record.
- computeFinanceKPIs()/computeFinanceTrend() -- profit margin, ROI, cost/revenue per animal, feed/medicine cost %. Dashboard Executive Finance Card, Reports KPI row, Analytics Financial Trends chart, Animal Detail Financial History.

## v1.7 -- Inventory & Feed Management (commit 7ce5a54)
- Discovered and extended a real, pre-existing inventory system (inventory_meds/inventory_feeds, a working page, CSV export, low-stock/expiring-soon notifications already in place).
- New: inventory_transactions log, automatic stock deduction on treatment/vaccination/feeding (previously zero effect on stock), negative-quantity prevention by clamping, a caught-and-fixed unit-conversion bug (kg vs. stock-unit bags), Purchase-to-Finance linking, Out-of-Stock/Expired notification triggers alongside the existing ones, Dashboard/Reports/Analytics/Animal-Detail integration.

## v1.7.0 Release Certification (this document's own release)
- Repository-wide discovery audit: two real issues found and fixed -- production.html/tasks.html were unreachable through any real navigation (fixed, two nav.js entries), and import.html had a genuine, page-breaking JavaScript syntax error (fixed).
- Architecture re-verification: every domain confirmed to have exactly one authoritative engine.
- Performance measured at realistic-to-large data scales -- no slowdown found.
- Security re-audited -- no new regression.
- 116-point UI/UX sweep (29 pages x 2 viewports x 2 themes) -- 116/116 clean after the import.html fix.
- Full regression: 189/189 tests passing.
