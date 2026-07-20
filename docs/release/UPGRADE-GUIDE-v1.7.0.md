# UPGRADE-GUIDE-v1.7.0.md

## From v1.0.0-rc1 (or any earlier commit in this history) to v1.7.0

### No Database Migration Required
Every collection this release reads or writes already existed, or is purely additive (workflow_history, inventory_transactions). No existing collection's schema was changed in a breaking way -- every new field (supplier, reorder_quantity, active, last_purchase on inventory items; priorityLevel, read_at on notifications; sold_price now genuinely populated instead of always-null) is optional and additive. Existing records without these fields continue to work exactly as before; code reading them treats their absence as a normal, expected case, not an error.

### No Firebase Rules Change Required
database.rules.json was not modified by this release.

### No New Environment Variable or Config Required
No new API key, no new service, no new external dependency was introduced. The only new CDN reference across this entire release cycle is Chart.js (already in use since Sprint 8/10, unchanged version).

### What Actually Changes for an Existing User
1. The sidebar now shows two links it did not before: "الإنتاج" (Production) and "المهام" (Tasks) -- both pages already existed and worked; they simply were not linkable before this release.
2. A new "التحليلات" (Analytics) page appears in navigation for anyone with the existing reports permission.
3. reports.html now has 8 tabs instead of the original 4 -- all additive, nothing removed.
4. Selling an animal from its own detail page now asks for a real price and records real revenue -- previously it silently did not.
5. Recording a treatment, completing a vaccination, or logging feed consumption now visibly affects the corresponding inventory item's quantity -- previously it did not.

### Recommended Upgrade Steps
1. Pull/deploy this commit (see VERSION-MARKER.md for the exact hash).
2. No build step is required (this remains a vanilla-JS, no-bundler application, per this project's own established architecture).
3. Clear any CDN cache if one is in front of the deployment, so the updated shared.js/nav.js/notifications-service.js are served.
4. No user action is required -- existing sessions will pick up the new sidebar links and pages on their next full page load.

### Rollback
See ROLLBACK-GUIDE.md -- every commit in this history remains independently revertible via a single git revert, per this project's own long-standing rollback discipline.
