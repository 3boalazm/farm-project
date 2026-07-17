# INVENTORY-ENGINE.md

**One function, shared.js: window.recordInventoryTransaction(itemType, itemName, deltaQty, reason, sourceId). Name-based item linking (matches feed_consumption's own established, documented convention -- not a new ID-based scheme).**

## Lifecycle
1. Read the matching item from inventory_meds/inventory_feeds by name.
2. No match -> return {matched:false}, zero writes -- confirmed by a dedicated test.
3. Compute newQty = max(0, currentQty + deltaQty) -- negative prevented by clamping, never by rejecting the caller's action.
4. fbPatch the item's quantity (and last_purchase, only for reason:'purchase' with a positive delta).
5. Write one inventory_transactions record with both requested_delta and actual_delta -- honest about clamping when it occurs, confirmed by a dedicated test (-7 requested against 5 available correctly logs actual_delta:-5).
6. For feeds + purchase + a positive delta + a real cost_per_unit, also write a real finance expense record using the exact category constant pages/finance.js already defines.

## Why Deduction Never Blocks the Medical or Feeding Action
The health/vaccination/feed-consumption record is always written first; inventory deduction runs after, fire-and-forget, exactly like every other non-critical enrichment Sprint 11's workflow lifecycle already established. A vet is never prevented from treating an animal because stock bookkeeping came up short.

## The Unit Conversion, and Why It Matters
inventory_feeds.quantity is tracked in whole stock units (bags/sacks; unit_weight defaults to 50kg per unit, confirmed by reading the item form itself). feed_consumption.quantity_kg is raw kilograms. Deducting raw kg directly against a unit-count quantity would silently misstate stock by the unit_weight factor -- caught during this sprint's own implementation, before it shipped, and fixed by converting through the item's own unit_weight at the call site. Verified live: 100kg consumed at 50kg/unit correctly deducts exactly 2 units, not 100.

## Reused, Not Reinvented
The name-based item lookup mirrors feed_consumption's own pre-existing, documented linking convention (docs/features/INVENTORY-DISCOVERY.md) -- this sprint did not introduce ID-based linking, which remains a deliberately deferred, pre-existing decision this sprint had no mandate to reverse.
