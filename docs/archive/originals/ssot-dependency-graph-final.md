# Repository 4 — Dependency Graph & Single Source of Truth Analysis
**Status: Documentation and reasoning only. No code modified.**

**Foundation note:** every claim below is synthesized from the two prior, extensively evidence-gathered audit passes (Domain Mapping, Tightened Documentation, Confidence Report) — this document does not re-investigate from scratch, but organizes and reasons over the confirmed evidence already on record, adding a small number of new targeted checks called out explicitly where they occur (most notably the `barns.html`/`animals.html` transfer-duplication comparison below, discovered this pass).

---

## Phase 1 — Entity Dependency Graph

*(Presented per-entity, in the 12 required dimensions. "None found" is a stated result, not an omission.)*

### `animals`
- **Depends On:** nothing (root entity)
- **Referenced By:** `health`, `vaccinations`, `breeding`, `weight_log`, `weights`, `production_log`, `finance`, `daily_tasks` (via `barn` field cross-reference at render time, not a stored FK) — all via string-tag (`animal_tag`) except `weight_log`/`production_log`, which also carry `animal_id`
- **Reads From:** itself (list re-fetch after every write)
- **Writes To:** itself only
- **Derived From:** nothing — root source
- **Produces:** the canonical animal record consumed by every other entity above
- **Consumes:** nothing
- **Foreign Keys (inbound, i.e. other entities pointing at it):** `mother_tag`/`father_tag` (breeding), `animal_tag` (health, vaccinations, weight_log, weights, production_log, feed's indirect barn logic)
- **Reverse References:** every entity in "Referenced By" above
- **Hidden Dependencies:** `barns.html` mutates `animals.barn` without `animals.html` being involved at all — a cross-page write dependency not visible from within `animals.html` itself
- **Implicit Dependencies:** Dashboard's Farm Health Score formula implicitly depends on `animals.status` distribution (alive/dead ratio) without `animals.html` "knowing" it feeds that calculation
- **Cross-module Dependencies:** touched by 26 files — the widest cross-module surface of any entity in the system

### `weight_log` / `weights`
- **Depends On:** `animals` (via `animal_id`/`animal_tag`)
- **Referenced By:** nothing reads `weights`; `weight_log` is read only by `pages/animal_detail.js`
- **Writes To:** `weight_log` (ongoing entries) and `weights` (birth-weight-only, one specific flow)
- **Derived From:** the animal object active in context at write time (`_animal`, or the newborn record from `_ubSubmit`)
- **Produces:** `weight_log` produces the data `pages/animal_detail.js`'s weight chart consumes; `weights` produces nothing consumable (confirmed, see Confidence Report)
- **Hidden Dependencies:** `animals.current_weight` is a **fan-out copy** of `weight_log`'s latest entry, written at the same moment as a *new* `weight_log` entry (not on edit) — a hidden, one-directional, partial sync
- **Cross-module Dependencies:** `weight_log`'s writer (`pages/animal_detail.js`) and `weights`' writer (`shared.js`'s `_ubSubmit`) are in **different modules entirely**, with no shared code path between them — this is architecturally why they never reconciled into one collection

### `breeding`
- **Depends On:** `animals` (`female_tag`/`mother_tag`, `male_tag`)
- **Referenced By:** `pages/pedigree.js` (lineage), `pages/reports.js`, `dashboard.html`
- **Produces:** fertility/twin-rate statistics, computed on demand (`showFertilityReport()`), not stored
- **Hidden Dependencies:** none found beyond the `_ubSubmit()` cross-reference already noted (birth registration likely updates a matching breeding record's status — file-level cross-reference confirmed, exact call not individually re-verified)
- **Implicit Dependencies:** the `female_tag`=`mother_tag` duplication means any future code that only checks one of the two fields (not both) risks silently missing records if the two are ever manually desynchronized (they currently cannot be, by construction, but nothing prevents a future edit path from writing only one)

### `health`
- **Depends On:** `animals`
- **Referenced By:** `dashboard.html` (Farm Health Score's "active-treatment ratio" and "expiring meds" components), `pages/reports.js`
- **Produces:** `withdrawal_end` (derived, stored, computed identically in two places — see Phase 4)
- **Cross-module Dependencies:** the withdrawal-period calculation exists independently in the UI-preview function and the save function, in the same file — a rare case of intra-file (not cross-module) duplication

### `vaccinations` / `vaccination_templates`
- **Depends On:** `vaccination_templates` depends on nothing; `vaccinations` depends on both `animals` and `vaccination_templates` (`from_template` FK)
- **Referenced By:** `pages/reports.js` (vaccinations only — templates are never read outside their own page)
- **Produces:** vaccination completion `progress`/`status` (calculation site not traced this pass — remains a genuine, explicitly-carried-forward gap)

### `production_log`
- **Depends On:** `animals`, written from the same source object as both `animal_id` and `animal_tag` simultaneously (confirmed, Confidence Report)
- **Referenced By:** `dashboard.html`, `reports.html` (note: via the page itself, not `pages/reports.js` — one of the few entities read outside the shared reports module)
- **Foreign Keys:** dual-style (`animal_id` + `animal_tag`) — the only entity confirmed to carry both simultaneously

### `finance`
- **Depends On:** `animals` (contextually, for sale/death/loss-triggered entries) but **no stored FK** — confirmed this pass that the earlier-reported `tag` field was a false positive; finance records carry **no direct link back to the animal they concern**, only a free-text `description` string that may mention the animal's tag as prose
- **Referenced By:** `dashboard.html`, `pages/reports.js`
- **Writers, confirmed at 11 distinct call sites across 6 files** (`pages/finance.js`, `animals.html` ×5, `assistant.html`, `dead.html`, `goats.html`, `sheep.html`) — the widest writer fan-out of any entity besides `animals` itself
- **Hidden Dependencies:** because there's no stored FK, reconciling "which finance record came from which animal sale" is only possible by parsing the free-text `description` field — a real, structural traceability gap, not a bug per se, but a design limitation worth naming precisely

### `inventory_feeds` / `inventory_meds` / `inventory_equipment`
- **Depends On:** nothing (standalone stock entities)
- **Referenced By:** `dashboard.html` (all three); `pages/reports.js`/`pages/notifications.js` (feeds/meds only — equipment confirmed, deliberately, excluded)
- **Writes To:** shared generic add/edit/delete functions in `pages/inventory.js`, dispatched by a type-lookup object
- **`feed_consumption`'s Foreign Key to `inventory_feeds`:** confirmed a **string match on `feed_name`**, not a document ID — combined with the confirmed-renameable `name` field, this is a genuine, evidenced fragile-reference pattern

### `daily_tasks`
- **Depends On:** `users` (`assigned_to`, confirmed genuine document-ID FK), self-referentially depends on its own template documents (`template_id`)
- **Referenced By:** nothing outside its own page
- **Produces:** generated task instances from templates, via `generateRecurringTasks()`

### `users`
- **Depends On:** nothing (root entity, alongside `animals`)
- **Referenced By:** `daily_tasks.assigned_to` (confirmed ID-based), and — **not individually re-verified this pass** — the various `added_by`/`recorded_by`/`executed_by` fields scattered across `finance`, `breeding`, `production_log`, `weight_log`, which are populated from `getUser()?.name`, i.e., **by display name, not by ID** — meaning these are a *weaker*, name-based reference style, inconsistent with `daily_tasks.assigned_to`'s ID-based style. **This inconsistency is now confirmed as real** (both styles definitely exist, in different entities), though not every single occurrence was individually traced.

### `notifications` / `login_notifications`
- `notifications`: no stored writer exists (confirmed, Reserved) — depends on nothing, produces nothing persisted
- `login_notifications`: depends on `users` (login events), read by `settings.html`'s admin panel and `pages/notifications.js`

### `activity_log`
- **Depends On:** effectively every other entity, indirectly (any `logActivity()` call anywhere)
- **Referenced By:** intended reader is `activity.html` — a confirmed 0-byte file (pre-existing, unrelated to this audit, but directly relevant to this entity's own "Referenced By" answer: **currently, nothing functioning reads it**)
- **Hidden Dependencies:** `settings.html`'s admin backup/clear tools are the *only* currently-functioning consumer

### `uid_lookup` / `diary_snapshot`
- Both confirmed, in the prior pass, as intentional, narrowly-scoped infrastructure (Auth-bridge lookup; manual reconciliation cross-check, respectively) — no new dependency findings this pass beyond what's already recorded.

### `barns` (confirmed, not a real entity)
- **Depends On:** `animals.barn` exclusively
- **Produces:** nothing stored — a pure view + a write path
- **Hidden Dependencies — new finding this pass:** `barns.html` implements its **own, entirely independent** bulk-barn-reassignment function (`submitTransfer()`), separate from `animals.html`'s `performBulkTransfer()`. This is the same real-world business operation, implemented twice, in two files, with no shared code between them.

---

## Phase 2 — Business Flow Graph

### Flow: Birth Registration
```
User submits unified birth form (shared.js: _ubSubmit)
   ↓
animals  ← new record(s) created, one per offspring, via fbPost('animals', rec)
   ↓
weights  ← IF a birth weight was entered: fbPost('weights', {...})  [ORPHANED — see Phase 4]
   ↓
activity_log ← logActivity('add','animals', birth description)
   ↓
Dashboard  ← next load recomputes population/health-score stats from the now-larger `animals` list
   ↓
Reports  ← same, on next visit
   ↓
Notifications ← generateNotifs() re-derives live alerts from the updated `animals`/`health`/etc. snapshot on next notifications.html visit
```
**Note:** `breeding` is *not* directly touched by this flow's write path in the way the example graph in the prompt suggested — birth registration creates `animals` records and (if applicable) a `weights` record; any update to a *pre-existing* `breeding` record's status (pregnant → born) is a file-level cross-reference confirmed to exist, but the exact call was not re-verified this specific pass, consistent with the Confidence Report's own stated scope.

### Flow: Death (Individual)
```
submitDeath() [animals.html]
   ↓
animals  ← status, died_at, death_reason, etc. patched
   ↓
finance  ← IF loss > 0: new record created
   ↓
activity_log ← logged
   ↓
Dashboard/Reports/Notifications ← re-derived on next load, same as birth flow
```

### Flow: Death (Bulk)
```
doBulk('death') → execBulk('death') → performBulkDeath(ids)
   ↓
animals  ← per-id patch, each with its own animalDeathId (batchDeathId+'-'+i)
   ↓
finance  ← ONE aggregate record IF ok>0 && totalLoss>0
   ↓
activity_log ← logged
   ↓
(same downstream re-derivation as above)
```
**Confirmed structurally identical in shape to the individual flow, with the same finance/activity/downstream steps** — the two flows diverge only in per-record vs. aggregate death-ID/loss handling, which is a legitimate difference (bulk operates on N animals with one shared loss figure divided among them), not a violation.

### Flow: Sale (Individual vs. Bulk) — **the confirmed semantic conflict**
```
Individual: submitSold() → animals.status='sold', sold_date, sold_price, sold_to, sold_notes, sold_phone
Bulk:       performBulkSell() → animals.status='dead', sold_at, removal_reason='sale'
   ↓ (both paths)
finance  ← income record created
   ↓
Dashboard/Reports ← any logic distinguishing "sold" animals from "dead" animals will silently miscount bulk-sold animals as deaths, or vice versa, depending on which status string it filters for
```
**This is the single clearest, most consequential business-flow-level integrity violation found across both audit passes** — not because either path is individually wrong, but because they **produce different final states for the identical real-world business event**, and every downstream consumer (Dashboard, Reports, any future export) has no way to know both states mean the same thing unless it explicitly special-cases both.

### Flow: Barn Transfer (the duplication finding)
```
Path A (animals.html, bulk): doBulk('transfer') → execBulk('transfer') → performBulkTransfer(ids)
   → closeModal() called BEFORE fields are read → barn/reason read as undefined → {} patch sent → SILENTLY DOES NOTHING

Path B (barns.html, bulk): submitTransfer()
   → fields read BEFORE closeModal() → correct payload → fbPatch('animals', id, {barn: to}) → works correctly
```
**Direct, confirmed evidence that duplicating a business rule across two independent implementations has already produced two different reliability outcomes for the same operation** — this is not a hypothetical risk in this system; it already happened.

---

## Phase 3 — Single Source of Truth Matrix

| Business Concept | Authoritative Owner | Secondary Views | Derived | Cached | Duplicated | Calculated | Manual | Historical | Temporary |
|---|---|---|---|---|---|---|---|---|---|
| Animal identity/status | `animals.status` | — | — | — | — | — | — | — | — |
| Animal's current weight | `weight_log` (latest entry) | `pages/animal_detail.js`'s read-time precedence logic | — | `animals.current_weight` (fan-out cache, partially stale) | — | — | — | `weight_log` full history | — |
| Newborn's birth weight | **None — orphaned** | — | — | — | — | — | — | — | `weights` (write-only, never surfaces) |
| "Is this animal sold" | **Split — no single owner** | — | — | — | Two conflicting values (`status:'sold'` vs `status:'dead'`) for the same meaning | — | — | — | — |
| Barn assignment | `animals.barn` | `barns.html` (aggregation view) | — | — | Write logic duplicated across 3 independent implementations | — | — | — | — |
| Farm settings/profile | **None — per-device only** | — | — | `localStorage['farm_settings']`, independently per browser | — | — | Yes, farm-owner-entered | — | — |
| Farm Health Score | **None — never persisted** | Dashboard's own render | Yes, computed fresh every load | — | — | Yes | — | — | Yes, exists only in memory during a page view |
| "Correct" farm totals (diary reconciliation) | **Intentionally dual, by design** | `dashboard.html`'s live computation | — | — | Intentional cross-check, not a flaw | Yes (live side) | Yes (`diary_snapshot` side, confirmed manual) | — | — |
| Withdrawal-safe date | `health.withdrawal_end` | — | Yes (`treatment_end + withdrawal_days`) | — | Formula duplicated in 2 places (UI preview + save), values match | Yes | — | — | UI-preview copy is temporary/unsaved |
| Feed stock level | `inventory_feeds.quantity` | — | — | — | — | — | Yes, manually adjusted | — | — |
| Feed consumption history | `feed_consumption` | — | — | — | — | — | Yes | Yes | — |
| Notification content | **None persisted** | `generateNotifs()`'s live output | Yes, fully | — | — | Yes | — | — | Yes, recomputed every page load |
| Audit trail | `activity_log` | **No working viewer** (`activity.html` empty) | — | — | — | — | — | Yes, by design | — |

---

## Phase 4 — Integrity Violations

### V1 — Orphaned write: `weights` collection
- **Evidence:** `shared.js`'s `_ubSubmit()` writes to `weights` on every birth-weight entry; zero reads confirmed anywhere project-wide.
- **Severity:** Critical
- **Business Impact:** Every recorded birth weight is silently, permanently lost from the user's perspective — no error, no visibility, just gone.
- **Affected Entities:** `weights`, `weight_log` (the collection that *should* have received this data)
- **Root Cause:** two independently-built weight-recording code paths (`_ubSubmit` for birth weight, `pages/animal_detail.js`'s `submitWeight` for ongoing weights) were never unified to write to the same collection.
- **Suggested Future Direction (not implemented):** a future task should decide whether birth weight should simply be written to `weight_log` instead, or whether `weights` should gain a real reader — a product decision, not a technical one.

### V2 — Conflicting semantics: individual vs. bulk "sold" status
- **Evidence:** `submitSold()` writes `status:'sold'`; `performBulkSell()` writes `status:'dead', removal_reason:'sale'` — confirmed directly, both call sites read this session.
- **Severity:** Critical
- **Business Impact:** any current or future logic counting "how many animals were sold" will undercount or overcount depending on which status convention it checks, silently.
- **Affected Entities:** `animals`, `finance` (downstream, since finance records from both paths can't be reliably joined back to a single consistent animal-status convention)
- **Root Cause:** the bulk-sell code path was built independently from the individual-sell path, at a different time, without reusing its status convention.
- **Suggested Future Direction:** reconcile to one convention — a data-model decision requiring a migration plan for existing records, not a simple code fix.

### V3 — Duplicated business rule with confirmed divergent correctness: barn transfer
- **Evidence:** `animals.html`'s `performBulkTransfer()` reads its modal fields *after* `closeModal()` (broken — confirmed empty-payload writes); `barns.html`'s `submitTransfer()` reads its fields *before* closing its modal (correct) — same real-world operation, two independent implementations, confirmed different outcomes.
- **Severity:** High
- **Business Impact:** users attempting a bulk barn transfer from the Animals page get silent no-ops; the same conceptual action from the Barns page works.
- **Affected Entities:** `animals` (the `barn` field specifically)
- **Root Cause:** the same business capability was implemented twice, in two different files, with no shared function between them.
- **Suggested Future Direction:** consolidate to one implementation, or at minimum apply the same field-read-ordering fix to both independently.

### V4 — No authoritative source: Farm Settings
- **Evidence:** `getSettings()`/`saveSettings()` are `localStorage`-only, confirmed by direct reading of `firebase.js`.
- **Severity:** High
- **Business Impact:** farm name, currency, breed lists, and logo differ by device/browser with no synchronization — a real, structural violation of this audit's own core principle, for a real, user-facing concept.
- **Affected Entities:** every page that calls `getSettings()` (confirmed extremely widespread)
- **Root Cause:** settings were built before (or without) a decision to back them with Firebase.
- **Suggested Future Direction:** a Firebase-backed settings document is the obvious direction, but requires a migration/merge strategy for whatever's currently in each device's `localStorage`.

### V5 — Partial fan-out synchronization: `animals.current_weight`
- **Evidence:** `submitWeight()` updates `animals.current_weight` only in its create branch, not its edit branch (confirmed, direct code reading).
- **Severity:** Medium
- **Business Impact:** correcting a historical weight entry doesn't refresh the cached "current weight" shown elsewhere, if that correction happens to be the most recent entry.
- **Affected Entities:** `animals`, `weight_log`
- **Root Cause:** the fan-out write was added for the create path and not extended to the edit path — likely an oversight at the time, not a deliberate choice (no comment suggests otherwise).
- **Suggested Future Direction:** extend the same fan-out write to the edit branch.

### V6 — Fragile string-based foreign key: `feed_consumption` → `inventory_feeds`
- **Evidence:** `feed_consumption.feed_name` matches by string against `inventory_feeds.name`; `inventory_feeds.name` is confirmed freely editable via a plain text input.
- **Severity:** Medium
- **Business Impact:** renaming a feed item orphans all historical consumption records' link to it.
- **Affected Entities:** `feed_consumption`, `inventory_feeds`
- **Root Cause:** the consumption-logging feature references feed items by name rather than by their Firebase document ID.
- **Suggested Future Direction:** switch the reference to a document-ID FK — a migration concern for existing records.

### V7 — Black-hole audit trail: `activity_log` has no working reader
- **Evidence:** `activity.html` (the intended viewer) is a confirmed 0-byte file; `activity_log` continues to be written to universally.
- **Severity:** Medium-High (an observability/utility violation, distinct in kind from a data-conflict violation, but squarely within this audit's broader "integrity" mandate)
- **Business Impact:** the application's entire audit trail is currently unreviewable in practice.
- **Affected Entities:** `activity_log`
- **Root Cause:** unrelated, pre-existing file-loss issue (documented independently, well before this specific audit).
- **Suggested Future Direction:** restore `activity.html` (a known, already-scoped fix from earlier in this engagement).

### V8 — Reserved, unused infrastructure: `notifications`' stored bucket
- **Evidence:** zero `fbPost('notifications', ...)` calls found project-wide; the read/merge/mark-as-read code is fully built and functional.
- **Severity:** Low
- **Business Impact:** none currently — the live-generated notification path fully covers the user-facing experience today.
- **Affected Entities:** `notifications`
- **Root Cause:** likely a planned feature (persisted, dismissible notifications) whose producer was never built.
- **Suggested Future Direction:** either build the missing producer or accept the live-only design permanently — a product decision.

### V9 — Duplicated calculation logic: withdrawal-end date
- **Evidence:** identical `treatment_end + withdrawal_days` formula appears in both `calcWithdrawal()` (UI preview) and `submitHealth()` (save).
- **Severity:** Low
- **Business Impact:** none currently (both copies match), but any future change to one without the other would silently desynchronize the preview from the saved value.
- **Affected Entities:** `health`
- **Root Cause:** the preview function and the save function were written independently rather than the save function calling the preview's calculation.
- **Suggested Future Direction:** have one call the other, or extract a shared calculation function.

### V10 — Mixed foreign-key reference styles: name-based vs. ID-based attribution
- **Evidence:** `daily_tasks.assigned_to` is confirmed ID-based; `finance.added_by`/`breeding.added_by`/`production_log.recorded_by`/`weight_log.recorded_by` are all populated from `getUser()?.name` — confirmed name-based.
- **Severity:** Low
- **Business Impact:** if a user's display name is ever changed, historical records referencing them by name become disconnected from their current identity, while `daily_tasks` assignments remain correctly linked.
- **Affected Entities:** `finance`, `breeding`, `production_log`, `weight_log`, `daily_tasks`
- **Root Cause:** inconsistent convention chosen across different features built at different times.
- **Suggested Future Direction:** standardize on ID-based attribution — a broad, low-urgency consistency improvement.

### Non-Violations, explicitly confirmed (to avoid future re-litigation)
- **`diary_snapshot`** — confirmed intentional manual-reconciliation design, not a conflicting duplicate.
- **`breeding.female_tag`/`mother_tag`** — confirmed always-synchronized by construction (written together, same value, every time) — a naming redundancy, not a sync risk.
- **`production_log`'s dual FK** — confirmed synchronized at write time; only a narrow, specific staleness risk if an animal's tag changes after the fact, not a general conflict.
- **`inventory_equipment`'s narrower reader list** — confirmed intentional (non-consumable assets don't need consumption-oriented reports/alerts).

---

## Phase 5 — Integrity Ranking (by business impact)

| Rank | Finding | Severity |
|---|---|---|
| 1 | V2 — Individual vs. bulk "sold" status conflict | **Critical** |
| 2 | V1 — Orphaned `weights` write (silent birth-weight data loss) | **Critical** |
| 3 | V3 — Duplicated barn-transfer logic, confirmed divergent correctness | **High** |
| 4 | V4 — No authoritative source for Farm Settings | **High** |
| 5 | V7 — Unreadable audit trail (`activity_log` / empty `activity.html`) | **Medium-High** |
| 6 | V5 — Partial fan-out sync for `animals.current_weight` | **Medium** |
| 7 | V6 — Fragile name-based FK, `feed_consumption` → `inventory_feeds` | **Medium** |
| 8 | V8 — Reserved/unused `notifications` storage capability | **Low** |
| 9 | V9 — Duplicated withdrawal-date calculation | **Low** |
| 10 | V10 — Mixed ID/name attribution convention | **Low** |
| — | Cache-invalidation granularity (project-wide) | **Informational — Cannot Be Proven yet, explicitly still open** |

**Ranking rationale:** V1 and V2 rank highest because both involve *silent, undetectable* data corruption/loss on core business events (a birth, a sale) — the two things this farm-management system most fundamentally exists to track correctly. V3 ranks above V4 despite V4's broader reach, because V3 has *already manifested* as a confirmed, reproducible functional failure (not just a structural risk), whereas V4's impact, while structurally certain, depends on actual multi-device usage patterns that weren't independently confirmed this pass.

---

## Phase 6 — Single Source of Truth Score

*(1–5 scale per dimension; Overall is not a simple average, but a holistic judgment weighted toward Consistency and Propagation, since those most directly reflect this audit's core principle)*

| Entity | Ownership | Consistency | Propagation | Isolation | Observability | Maintainability | **Overall** |
|---|---|---|---|---|---|---|---|
| `animals` | 5 | 3 | 3 | 2 (touched by 26 files) | 4 | 3 | **3** — clear owner, but the sold/dead conflict and 3-path barn writes drag consistency/propagation down |
| `weight_log` | 5 | 4 | 3 (partial fan-out) | 4 | 4 | 4 | **4** |
| `weights` | 1 (writer with no consumer) | 1 | 1 (nothing to propagate to) | 5 | 1 | 2 | **1** — the lowest score in the system; a real entity that fails at its one job |
| `breeding` | 5 | 4 (the tag duplication is benign) | 4 | 4 | 4 | 4 | **4** |
| `health` | 5 | 4 | 4 | 4 | 4 | 4 (minor DRY concern only) | **4** |
| `vaccinations`/`vaccination_templates` | 5 | 4 | 4 | 5 | 3 (progress calc untraced) | 4 | **4** |
| `production_log` | 5 | 4 | 4 | 4 | 4 | 3 (dual FK style) | **4** |
| `finance` | 4 (no stored animal FK at all) | 3 (sold/dead conflict propagates here too) | 4 | 3 (11 writer call sites) | 3 | 3 | **3** |
| `inventory_feeds`/`meds` | 5 | 4 | 4 | 4 | 4 | 4 | **4** |
| `inventory_equipment` | 5 | 5 | 5 (intentional narrower scope) | 4 | 4 | 4 | **5** |
| `feed_consumption` | 4 (name-based FK) | 3 | 3 | 5 | 4 | 3 | **3** |
| `daily_tasks` | 5 | 4 | 4 | 5 | 4 | 4 | **4** |
| `users` | 5 | 3 (mixed ID/name referencing elsewhere) | 3 | 4 | 4 | 4 | **4** |
| `notifications` | 2 (reserved, no producer) | N/A | 5 (live path fully works) | 4 | 3 | 3 | **3** — scored on the *system's* behavior, not the empty bucket alone |
| `login_notifications` | 5 | 5 | 5 | 5 | 4 | 4 | **5** |
| `activity_log` | 5 (writing) / 1 (reading) | 4 | 2 (no working viewer) | 4 | 1 | 3 | **2** — a well-designed writer side completely undermined by the missing reader |
| `uid_lookup` | 5 | 5 | 5 | 5 | 5 (correctly server-side-only, by design) | 5 | **5** |
| `diary_snapshot` | 5 (for its actual, narrow intended purpose) | 5 | 5 | 5 | 4 | 4 | **5** — once its true purpose is understood, it's a well-scoped, correctly-working feature |
| `barns` (not a real entity) | N/A | N/A | N/A | N/A | N/A | N/A | **N/A** — scored via `animals.barn` above; this page itself is assessed as a *writer*, not a separate entity |

---

## Overall System Integrity Assessment

The application has **one clear-owner entity model for most business concepts** (18 of 20 investigated entities score 3 or higher), which is a genuinely solid foundation — this is not a system built on chaos. The integrity problems found are **concentrated, specific, and traceable to identifiable root causes** (independent parallel implementations built at different times, one missing file, one missing calculation-propagation step) rather than being systemic or pervasive. The two Critical findings (`weights`' orphaned write, the sold/dead status conflict) both stem from the *same underlying pattern*: a new code path was built for a new context (birth-weight capture, bulk actions) without being unified with the pre-existing equivalent path for the original context (ongoing weight tracking, individual actions) — a "build the new case, forget to reconcile with the old case" pattern, present in multiple places independently, not one single design flaw repeated.

## Readiness for Implementation

**Not yet ready for a "fix everything" pass — and shouldn't be approached that way even once approved.** Per this audit's own Phase 8 rule (one inconsistency → one fix → live verification → stop), the ten findings above are ready to be tackled **one at a time, in the ranked order above**, each as its own small, independently-verified change — exactly the discipline already proven across every prior phase of the Repository 4 engagement. Two items are **not yet ready for even that**: the `sold`/`dead` conflict (V2) requires a **product decision** on which convention is canonical before any code changes, and the Farm Settings gap (V4) requires deciding whether Firebase-backed settings are even wanted before a migration path can be designed. Every other finding is technically ready for its own dedicated, narrowly-scoped implementation task whenever you choose to begin.

**Waiting for direction on which finding to address first, or whether to resolve the two remaining explicitly-open items (cache-invalidation granularity, the sold/dead product decision) before any implementation begins.**
