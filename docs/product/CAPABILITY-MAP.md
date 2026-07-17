# CAPABILITY-MAP.md

**What this product already does, as of `baseline-v2-production-candidate`. Grouped by domain, not by file.**

## Animal Management
Full lifecycle: create (manual, import, birth), update, transfer between barns, sale, death — each a certified or well-understood single source of truth. Species-specific views (`goats.html`, `sheep.html`) alongside the general `animals.html`. Pedigree tracking via `mother_tag`/`father_tag` string references. Bulk actions (transfer, sell) with per-item failure isolation.

## Breeding
Full breeding-record lifecycle (`pending → pregnant → born/failed`). Certified Birth SSOT: one `breeding` record + one `animals` document per offspring via `createOffspringAnimal()`, with duplicate-prevention on re-edit.

## Production
Weight tracking with certified SSOT (`animals/{id}/weights`) and automatic `current_weight` synchronization. General production log (milk, wool, other outputs — `production_log`) alongside weight.

## Health
Health records and vaccination records with their own templates (`vaccination_templates`), single writers each.

## Vaccination
Covered above — a first-class, separate module from general health, with its own permission (`health`) and page.

## Cost Management
Dedicated cost-analysis page distinct from general finance; finance ledger supports 10+ legitimately different transaction types on one collection.

## Authentication
Custom PIN-pad login (not Firebase Auth), SHA-256-hashed with salt, a fail-safe Firebase Auth bridge for server-side rate limiting, and a correctly-guarded empty-database bootstrap path.

## Reporting
Dedicated `reports.html`, delegated to `pages/reports.js`, including a finance sub-section with its own permission gate. Chart rendering via a lazy-loaded React bundle (`farm-react.js`) for advanced visualizations.

## Offline
Two independent, real mechanisms: an IndexedDB write-queue (`offline-sync.js`) for replaying writes made while disconnected, and a complete-but-dormant Service Worker (`sw.js`/`sw-register.js`) for byte-level asset/read caching.

## AI Assistant
A natural-language Arabic assistant (Google Gemini-backed) supporting 7 confirmed structured actions: `add_animal`, `add_birth`, `add_breeding`, `add_finance`, `add_health`, `add_vaccine`, `add_weight` — each converging onto the same canonical write paths the manual UI uses, not a separate code path.

## Cross-Cutting Capabilities
- Role-based permissions (5 roles: admin, supervisor, vet, worker, visitor), now enforced on 17 of 19 gated pages.
- A formal, printable Modern-Standard-Arabic herd statement (`bayan.html`) for official/military presentation contexts.
- Inventory management across 3 sub-types (feeds, meds, equipment) through one shared function.
- A diary/reconciliation feature comparing computed stats against a manually-maintained snapshot.
- **Task/reminder management** (`tasks.html`/`pages/tasks.js`) — a real, filterable system (today/week/overdue/done/by-me), not a stub. Standalone, not yet auto-generated from domain events (e.g., a vaccination due date does not automatically create a task).
- Automated regression testing (32 tests) and a static permission/SSOT safety scanner — capabilities of the *engineering process* itself, not the product surface, but real and load-bearing.
