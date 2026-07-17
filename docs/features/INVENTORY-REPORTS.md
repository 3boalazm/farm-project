# INVENTORY-REPORTS.md

## The Inventory Report Tab
reports.js's 8th tab, "المخزون" -- follows the exact registration pattern Sprint 8-13 already established (button array, labels object, renderTab dispatch, page-level can('reports') gate, no new permission logic).

## What It Shows
- Stock Levels: two tables (meds, feeds), each row's status badge (نافد/منخفض/جيد) computed live from the same quantity/min_quantity comparison the existing notification triggers already use -- not a second threshold definition.
- Consumption: the last 15 feed_consumption records, most recent first.
- Transactions: the last 15 inventory_transactions records -- date, item, reason, actual delta, before/after quantity. The one genuinely new data source this sprint introduces.
- Costs: feed inventory value (quantity * cost_per_unit, summed) as a KPI card.

## Excel Export
A 10th sheet, "المخزون" -- direct rows from inventory_meds/inventory_feeds, no calculation. Appended to exportAllExcel()'s existing sheet sequence, following Sprint 8-13's own established pattern exactly.

## CSV Export
Already existed (window.exportInvCSV(), pages/inventory.js) before this sprint -- confirmed in discovery, not rebuilt or duplicated.

## WhatsApp Summary
One proportionate line -- a count of low-stock/out-of-stock items -- added to the existing summary text, matching Sprint 8-13's own restraint (a full stock table does not belong in a WhatsApp message).

## Analytics: Consumption Trend
A 7th chart, reusing window.bucketByPeriod() (Sprint 10) directly on feed_consumption, at whatever granularity the Analytics page is currently showing (week/month/quarter/year). No second bucketing implementation.

## What This Report Does Not Claim
No per-animal feed cost, no genuine feed-efficiency ratio -- both would require an attribution feed_consumption's barn-only linking cannot honestly support (docs/features/FEED-MANAGEMENT.md). The report shows what the data can actually prove.
