# Repository 4 — System Integrity & Single Source of Truth Audit
## Phase 1: Domain Mapping
**Status: Documentation only. No code touched. This is the foundational phase — everything in Phases 2–8 builds on what's verified here.**

**Methodology note:** every entity below was identified by grepping actual `fbGet`/`fbPost`/`fbPatch`/`fbDelete` calls across every `.html` and `.js` file in the project — not assumed from naming conventions or prior familiarity with the codebase. Where a name looked ambiguous or potentially duplicated, I traced its actual read/write sites individually before drawing a conclusion.

---

## Confirmed Business Entities (18 real Firebase collections + 2 non-Firebase entities)

| Entity (collection) | Primary owning page(s) | Also touched by | Nature |
|---|---|---|---|
| **`animals`** | `animals.html` | 20 other files (widest surface area in the project — `animal-detail.html`, `assistant.html`, `barns.html`, `births.html`, `cost.html`, `dashboard.html`, `dead.html`, `diary.html`, `fix-births.html`, `goats.html`, `import.html`, `reports.html`, `settings.html`, `sheep.html`, `users.html`, and 8 `pages/*.js` files) | Core entity — every animal record |
| **`breeding`** | `animals.html` (via `pages/breeding.js`) | `animal-detail.html`, `assistant.html`, `cost.html`, `dashboard.html`, `import.html`, `settings.html`, `users.html`, `pages/pedigree.js`, `pages/reports.js`, `pages/notifications.js` | Breeding/mating records |
| **`health`** | `animals.html` (via `pages/health.js`) | `animal-detail.html`, `assistant.html`, `cost.html`, `dashboard.html`, `import.html`, `settings.html`, `users.html`, `pages/vaccine.js`, `pages/tour.js`, `pages/reports.js`, `pages/notifications.js` | Health/treatment records |
| **`vaccinations`** | `pages/vaccine.js` | `animals.html`, `assistant.html`, `cost.html`, `import.html`, `settings.html`, `pages/reports.js`, `pages/notifications.js` | Actual vaccination *events* (administered doses) |
| **`vaccination_templates`** | `pages/vaccine.js` | (none else found) | Reusable vaccination *schedules/types* — a distinct, legitimate parent entity to `vaccinations`, not a duplicate of it |
| **`weight_log`** | `pages/animal_detail.js` | `assistant.html` | Individual animal weight records — confirmed the sole active read/write site (full CRUD: `fbGet`/`fbPatch`/`fbPost`, plus `logActivity` and `fbCacheInvalidate` calls) |
| **`production_log`** | `pages/production.js` | `dashboard.html`, `reports.html`, `settings.html` | Milk/meat/output records |
| **`finance`** | `pages/finance.js` | `animals.html`, `assistant.html`, `cost.html`, `dashboard.html`, `dead.html`, `goats.html`, `import.html`, `settings.html`, `sheep.html`, `pages/reports.js` | Financial transactions (also written into by `animals.html`'s bulk/individual sell and death-with-loss flows — confirmed in the prior refactor's own audit) |
| **`inventory_feeds`** | `pages/inventory.js` | `animals.html`, `assistant.html`, `cost.html`, `dashboard.html`, `import.html`, `settings.html`, `pages/reports.js`, `pages/notifications.js` | Feed stock |
| **`inventory_meds`** | `pages/inventory.js` | Same set as `inventory_feeds` | Medicine stock |
| **`inventory_equipment`** | `pages/inventory.js` | `animals.html`, `dashboard.html`, `settings.html` | Equipment stock — notably *not* referenced by `cost.html`/`import.html`/`reports.js`, unlike its two sibling inventory types |
| **`feed_consumption`** | `pages/inventory.js` | (none else found) | Feed usage records, distinct from `inventory_feeds` (stock levels) — a legitimate consumption-vs-stock split, not a duplicate |
| **`daily_tasks`** | `pages/tasks.js` | (none else found) | Task/to-do records — single-owner, narrowest surface area of any entity found |
| **`diary_snapshot`** | `diary.html` | `dashboard.html` | **Name suggests a derived/cached view, not raw source data — flagged for closer inspection in Phase 4 (is this a snapshot *of* something else, kept in sync, or an independent write target?)** |
| **`users`** | `users.html` | `pages/farm_profile.js`, `pages/tasks.js` | User accounts (role, PIN hash, active status — the same entity involved in the login-security work earlier in this engagement) |
| **`notifications`** | `notifications.html` (via `pages/notifications.js`) | `settings.html` | In-app notification records |
| **`login_notifications`** | `login.html` | `settings.html`, `pages/notifications.js` | A *separate* entity from `notifications` — specifically login-event notices, confirmed distinct by name and by `login.html`'s own write pattern (throttled, once per 5 minutes per user) |
| **`activity_log`** | Written from many places | `animals.html`, `dashboard.html`, `login.html`, `settings.html`, `pages/inventory.js`, and implicitly every `logActivity()` call project-wide | The universal audit trail — by design, the one entity *meant* to have many writers; read primarily by `activity.html` (currently a 0-byte file — see existing technical debt) and `settings.html`'s admin tools |
| **`weights`** *(collection name)* | **None** — zero live read/write sites found anywhere | Referenced only inside `settings.html`'s admin "reset/delete all data" tool's list of collection names to wipe | **Not an active entity.** Confirmed via exhaustive grep: the only occurrence project-wide is as a string in a deletion-target array (`[...,'activity_log','login_notifications','notifications','weights']`). Most likely a legacy collection name kept in the reset tool so any lingering old-schema data (from before a rename to `weight_log`) still gets cleaned up — not a second live source of weight data. |

### Non-Firebase entities (confirmed by direct code inspection, not assumption)

| Entity | Real storage mechanism | Evidence |
|---|---|---|
| **Farm Settings / Profile** (farm name, currency, breeds list, pregnancy/vaccination/weaning day thresholds, logo URL, address) | **`localStorage` only — no Firebase persistence at all.** `getSettings()` reads `window.FARM_CONFIG` (a static, deploy-time object from `config.js`) merged with `localStorage.getItem('farm_settings')`; `saveSettings()` writes only to `localStorage.setItem('farm_settings', ...)`. | Read directly from `firebase.js` lines 598–621, in this session |
| **Farm Health Score** (shown on Dashboard) | **Computed inline, on every page load, from other entities — never persisted anywhere.** | Confirmed in this Sprint's own prior dashboard audit: a weighted formula (deaths, low stock, overdue maintenance, expiring meds, active-treatment ratio) computed fresh in `dashboard.html`'s own script, with no write-back to any collection |

**A significant, evidence-based finding worth flagging prominently here, ahead of the formal Phase 4/5 analysis it belongs to:** Farm Settings has **no single authoritative source at all** — each browser/device maintains its own independent `localStorage` copy. If the farm name, currency, or breed list is changed on one device, no other device or session will ever see that change; there is no synchronization mechanism whatsoever. This is a direct, structural violation of this audit's own stated Core Principle ("every business entity must have one authoritative source... every screen must read from it") — worth carrying forward as the leading candidate finding for Phase 4's Single Source of Truth Validation.

---

## Entities not yet fully mapped (flagged for Phase 2, not resolved here)

- **Statistics/counts shown on Dashboard, Reports, and various KPI cards** — these are almost certainly *computed*, not stored, but Phase 1's scope is identifying entities, not yet tracing every computation's inputs. Phase 7 (Statistics Audit) is where this gets resolved properly; flagging here only so it isn't forgotten.
- **Barn assignments** — `barn` is a *field* on the `animals` entity (confirmed via the bulk-transfer work earlier in this engagement — `{barn:barn}` patches directly onto an animal record), not a separate entity with its own collection. Worth stating explicitly: **there is no independent `barns` collection** — `barns.html` almost certainly derives barn listings/capacity by aggregating the `animals` collection's `barn` field, not from its own authoritative source. This needs direct confirmation in Phase 2, not assumed here.
- **Search/Filters** — not entities themselves, but read-paths over the entities above; relevant to Phase 5 (Consistency Audit), not Phase 1.

---

## Summary for Phase 1

**18 Firebase-backed entities confirmed**, each with its real primary owner and full cross-reference list, gathered from actual code, not inferred from names. **2 non-Firebase entities confirmed** (Settings — localStorage-only, no sync; Farm Health Score — computed, never persisted). **One collection name (`weights`) confirmed inactive** — present only in an administrative deletion list, not a genuine second source of weight data. **Two items flagged for direct confirmation in Phase 2**: whether `barns.html` has any authoritative storage of its own versus being a pure aggregation view over `animals.barn`, and the full extent of what `diary_snapshot` is a snapshot *of*.

**This is the end of Phase 1.** Per the audit's own stated principle ("document all entities before touching code") and this engagement's established rhythm of one thorough phase at a time, I'm stopping here rather than proceeding into Phase 2's Input Mapping in the same pass — that phase requires tracing every write path (manual forms, bulk actions, imports, migrations) for each of the 20 entities above in comparable depth, which deserves its own dedicated pass rather than being rushed alongside this one.

**Waiting for confirmation before beginning Phase 2 — Input Mapping.**
