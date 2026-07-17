# INVENTORY-ARCHITECTURE.md

## Reuse Map, Explicit
| This sprint needs... | Reuses |
|---|---|
| Item fields (quantity, min_quantity, unit, expiry, cost) | inventory_meds/inventory_feeds (pages/inventory.js) -- unchanged, only additively extended |
| Feed consumption events | feed_consumption (existing collection, existing UI) -- unchanged linking convention (by name, a documented, deliberate prior decision) |
| Low Stock / Expiring Soon notifications | notifications-service.js's existing triggers -- unchanged, kept exactly as they are |
| CSV export | window.exportInvCSV() -- unchanged |
| Dashboard architecture | The existing card-container pattern every other Sprint 9-13 panel already uses |
| Reports architecture | reports.js's tab-registration pattern (Sprint 8-13's own precedent) |
| Analytics architecture | bucketByPeriod()/computeFarmAnalytics() (Sprint 10) |
| Finance | a purchase transaction creates a real finance expense record, the exact shape pages/finance.js already uses |
| Workflow | window.completeWorkflow() (Sprint 11) -- medication/vaccination workflow types extended with inventory deduction, not duplicated as new types |

## The One New Engine: A Single Transaction Function
```
window.recordInventoryTransaction(itemType, itemName, deltaQty, reason, sourceId)
  itemType: 'meds' | 'feeds'
  itemName: matched against the item's own name field -- the SAME
            name-based linking feed_consumption already established,
            not a new ID-based scheme (see docs/features/
            INVENTORY-DISCOVERY.md)
  deltaQty: negative to deduct, positive to add
  reason:   'treatment' | 'vaccination' | 'feeding' | 'purchase' | 'manual_adjustment'

  1. Reads the matching item by name.
  2. Computes newQty = max(0, currentQty + deltaQty) -- NEGATIVE
     PREVENTED BY CLAMPING, never by rejecting the underlying medical/
     feeding action. A vet does not get blocked from treating an
     animal because inventory bookkeeping is imperfect -- matching this
     project's own established "Best Effort" precedent for birth
     records (BUSINESS_RULES.md).
  3. fbPatch's the item's quantity to newQty.
  4. Writes ONE inventory_transactions record: {item_type, item_name,
     delta, actual_delta (may differ from requested if clamped),
     reason, source_id, quantity_before, quantity_after, date, actor}.
  5. If item_type is 'feeds' and reason is 'purchase' with a real
     cost_per_unit, ALSO writes a real finance expense record --
     Purchase-to-Finance linking, closing a confirmed gap.
```

## Why Deduction Never Blocks the Medical Action
Confirmed design decision, not an oversight: completeWorkflow('medication'/'vaccination', ...) already runs after the health/vaccination record is written (Sprint 11's own established lifecycle: validate -> resolve -> consult -> log -> finish). Inventory deduction is one more consult-adjacent side effect inside that same lifecycle, fire-and-forget, exactly like every other non-critical enrichment this engine already performs.

## Out of Stock vs. Low Stock, Expired vs. Expiring Soon
Both existing notification triggers are left completely untouched. Two new, additional triggers are added alongside them: quantity<=0 (Out of Stock, danger severity, distinct from the existing Low Stock warning) and expiry < today (Expired, distinct from the existing 30-day-ahead Expiring Soon).

## SSOT, Reconfirmed
Two collections read by every new KPI/chart: inventory_transactions (new, purely additive, write-once) and the pre-existing inventory_meds/inventory_feeds/feed_consumption. No KPI value is ever written back -- every Dashboard/Reports/Analytics number is computed fresh on read, matching this sprint's own explicit "no stored KPIs" rule.
