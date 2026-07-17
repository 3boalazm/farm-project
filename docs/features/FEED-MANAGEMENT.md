# FEED-MANAGEMENT.md

## What Existed Before This Sprint
feed_consumption -- a real collection with a real logging form (pages/inventory.js), recording {date, barn, feed_name, quantity_kg, recorded_by, notes} per feeding event. Zero effect on inventory_feeds.quantity -- confirmed absent before this sprint.

## What This Sprint Added
One deduction call, wired into the existing consumption-logging function, converting kilograms to stock units via the item's own unit_weight before calling window.recordInventoryTransaction('feeds', feed_name, -units, 'feeding', null).

## Daily / Monthly Consumption
Not a new calculation -- both the Dashboard Inventory Card and the Reports Inventory tab sum feed_consumption.quantity_kg directly, filtered by date prefix (today's date for daily, current month for monthly). The exact same collection, read fresh on every render, never cached or stored.

## Feed Remaining
sum(inventory_feeds.quantity * inventory_feeds.unit_weight) across all feed items -- converts stock units back to kilograms for a herd-wide "how much feed is physically left" figure, using each item's own real unit_weight, not an assumed constant.

## Feed Cost
inventory_feeds.cost_per_unit (already existed) multiplied by the quantity consumed in a purchase transaction -- this is what feeds the Purchase-to-Finance link (docs/features/INVENTORY-ENGINE.md). Feed value on hand (Reports' "قيمة مخزون العلف" KPI) is quantity * cost_per_unit, summed across all feed items, computed fresh on every load.

## Feed Efficiency
Not implemented as a distinct KPI this sprint. Computing genuine feed efficiency (feed input per unit of real output -- milk yield, weight gain) would require attributing barn-level feed consumption to specific animals or cohorts, which feed_consumption's own name/barn-only linking cannot support today (docs/features/INVENTORY-DISCOVERY.md). Rather than publish a misleading efficiency number built on an attribution the data doesn't support, this is named here as an honest, deferred gap -- not silently skipped.
