# INVENTORY-DISCOVERY.md

**A real, working inventory system already exists. This sprint extends it -- it does not build one from scratch. The mission's own fallback instruction does not apply.**

## What Already Exists (Confirmed by Direct Source Read)

- 3 collections: inventory_meds, inventory_feeds, inventory_equipment -- a real, dedicated page (inventory.html + pages/inventory.js), one shared submitInv(type) writer across all three.
- Real fields already present: inventory_meds = {name, quantity, unit, min_quantity, expiry, barn, purpose, notes}. inventory_feeds = {name, quantity, unit, unit_weight, min_quantity, cost_per_unit, barn, purpose}. min_quantity is functionally the reorder-level concept this sprint's brief asks for -- already there, just not labeled "reorder level."
- CSV export already exists: window.exportInvCSV(), confirmed working for all three sub-types. Phase 11's CSV request is already satisfied.
- Low-stock notifications already exist, for both meds and feeds -- confirmed in notifications-service.js, comparing quantity <= min_quantity.
- Expiring-soon notifications already exist for medicine (expiry within 30 days) -- confirmed in notifications-service.js.
- feed_consumption already exists: a real collection with a real logging UI (pages/inventory.js), recording {date, barn, feed_name, quantity_kg, recorded_by, notes} per consumption event.

## A Documented, Deliberate Prior Decision (Not This Sprint's to Reverse)
feed_consumption.feed_name links to inventory_feeds by name, a string, not by document ID -- confirmed by the engineering comment already in the code: "Migration to an ID-based reference is intentionally deferred (RSOT/RDR) -- no functional change made here." This sprint's new deduction logic must work with this existing, documented linking convention, not silently redesign it -- an ID migration is explicitly out of this sprint's scope.

## Confirmed Genuinely Absent (What This Sprint Actually Builds)
- inventory_transactions: zero transaction log anywhere -- quantity changes only via direct fbPatch edits to the item's own quantity field in pages/inventory.js. No history of why a quantity changed.
- Automatic deduction on treatment/vaccination/feed use: confirmed absent -- pages/health.js and pages/vaccine.js never reference inventory_meds; feed_consumption's own submit function never touches inventory_feeds.quantity. Recording a treatment or a feeding today has zero effect on stock levels.
- Negative-quantity prevention: since deduction doesn't exist, neither does any guard against it going negative.
- Out of Stock vs. Low Stock: only one threshold (<=min_quantity) exists; a distinct "quantity is exactly/below zero" state is not separately notified.
- Expired vs. Expiring Soon: only the forward-looking case (0 <= daysUntil <= 30) is covered; an item whose expiry date has already passed is not distinctly flagged.
- Supplier, reorder_quantity, last_purchase, active: none of these fields exist on either collection today.
- Purchase-to-Finance linking: adding inventory never creates a finance expense record, despite inventory_feeds already carrying cost_per_unit.
- Dashboard/Reports/Analytics/Animal-Detail integration: zero inventory-specific KPIs, charts, or per-animal consumption view exist anywhere outside inventory.html itself.

## Design Consequence
Per this sprint's own explicit rule (reuse instead of rebuild): no new medicine/feed/equipment collection, no new inventory page, no new low-stock or expiring-soon trigger (both already exist and are reused, not duplicated). New work: inventory_transactions (additive), deduction hooks wired into the existing health/vaccination/feed-consumption write paths, a small set of additive fields (supplier, reorder_quantity, last_purchase, active) on the existing two collections, an "Out of Stock"/"Expired" distinction alongside (not replacing) the existing "Low Stock"/"Expiring Soon" triggers, and the Dashboard/Reports/Analytics/Animal-Detail/Finance integration this sprint's brief asks for.
