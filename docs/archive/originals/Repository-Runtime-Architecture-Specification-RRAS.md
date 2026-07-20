# Repository Runtime Architecture Specification (RRAS)
**Companion to RSOT. Builds on its closed baseline without re-investigating settled facts. Every claim: FACT (Level A–E) / INFERENCE / UNKNOWN.**

---

## Correction to an RSOT Inference (not a contradiction of a Fact)

RSOT Section 1 stated, explicitly labeled **INFERENCE (Level D)**: "The same load order applies to the other 30 pages... Not individually live-verified." Fresh Repository-level evidence this phase **disproves that specific inference** for at least two pages:

- **FACT (C):** `settings.html` loads only `config.js`, `firebase.js`, `nav.js`, `shared.js` — no `offline-sync.js`, no `pages/datepicker.js`, no `pages/tour.js`.
- **FACT (C):** `login.html` loads only `config.js`, `firebase.js` — no `nav.js`, no `pages/datepicker.js`, no `pages/tour.js` (consistent with being the pre-authentication entry point).

This does not undermine any Level-A FACT in RSOT — it corrects a D-level inference that was already explicitly flagged as unverified. **Continuing per the stated rule: this is a refinement, not a contradiction requiring a full stop.**

---

## Phase 1 — Runtime Entry Points (Repository-Level Evidence, C unless stated)

| Page | Scripts Loaded | Logic Location | Firebase Collections (direct) | Shared Components Used |
|---|---|---|---|---|
| `animals.html` | config, firebase, nav, shared, datepicker, tour (+ own inline) | **Inline** | `animals` extensively | `renderFarmModal`, `commitBulkPatch`, `refreshAnimalsAfterBulk` (Level A, RSOT) |
| `animal-detail.html` | Same set (+ own inline) | **Inline** | `animals`, `animals/{id}/weights`, `animals/{id}/offspring`, `animals/{id}/vaccinations`, `animals/{id}/medications`, `health`, `breeding` | `renderFarmModal` (Level A, this and prior sessions) |
| `breeding.html` | Same set + `pages/breeding.js` | **`pages/breeding.js`** | `breeding` | `renderFarmModal` (Level A) |
| `barns.html` | config, firebase, nav, shared, datepicker, tour (no page-specific `.js`) | **Inline** | `animals` only | `renderFarmModal` (Level A, BL-01 cross-reference) |
| `assistant.html` | Same generic set | **Inline** (multi-intent dispatcher) | `animals`, `breeding`, `finance`, `health`, `inventory_feeds`, `inventory_meds`, `vaccinations`, `weight_log` — the widest collection footprint of any single page found | Unknown which shared components it reuses vs. duplicates — **not individually checked this phase** |
| `settings.html` | config, firebase, nav, shared **only** (no offline-sync, datepicker, tour) | **Inline** | `animals`, `production_log` (direct); also hosts the admin reset-tool family (`resetAnimals`, `resetFinance`, `resetHealth`, `resetActivity`, `resetNotifications`, `resetEverything`) and PWA/APK functions (`triggerPWAInstall`, `showPWAInstructions`, `downloadAPKProject`) | Not checked |
| `production.html` | Same generic set + `pages/production.js` | **`pages/production.js`** | `animals` (read+patch), `production_log` (full CRUD) | Not checked |
| `reports.html` | Same generic set + `pages/reports.js` | **`pages/reports.js`** | `animals`, `breeding`, `finance`, `health`, `inventory_feeds`, `inventory_meds`, `vaccinations` — **read-only, zero writes found** | Not checked |
| `health.html`, `vaccine.html`, `inventory.html`, `finance.html`, `tasks.html`, `farm-profile.html`, `pedigree.html` | Generic set + matching `pages/*.js` | **`pages/*.js`** (page HTML itself shows zero direct collection references) | Delegated entirely to companion file — collections not individually re-extracted this phase | Not checked |
| `import.html` | Generic set, no page-specific `.js` | **Inline** | `animals`, `breeding`, `finance`, `health`, `inventory_feeds`, `inventory_meds`, `vaccinations` | Not checked |
| `login.html` | **Only** config, firebase | **Inline** | `activity_log`, `login_notifications` | None (pre-auth, no navbar) |
| `notifications.html` | Generic set | **Inline** | `notifications` | Not checked |
| `dead.html` | Generic set | **Inline** | `animals`, `finance` | Not checked |
| `diary.html` | Generic set | **Inline** | `animals`, `diary_snapshot` | Not checked |
| `cost.html` | Generic set | **Inline** | `animals`, `breeding`, `finance`, `inventory_feeds`, `inventory_meds`, `vaccinations` | Not checked |
| `births.html` | config, firebase, nav, shared (no datepicker/tour) | **Inline** | `animals` | Not checked |
| `fix-births.html` | config, firebase, datepicker, tour (**no `nav.js`**) | **Inline** | `animals` | Not checked |
| `users.html` | Generic set | **Inline** | None found via literal-string collection search this phase | Not checked |

**INFERENCE (D):** `fix-births.html`'s missing `nav.js` suggests it may be a standalone/diagnostic tool rather than a normal navigable page — **not confirmed**, purpose not investigated this phase.

**Runtime Dependency Graph (Repository-level, C):**
```
config.js, firebase.js  ← loaded by every page, including login.html
        ↓
nav.js, shared.js  ← loaded by every page EXCEPT login.html
        ↓
offline-sync.js, pages/datepicker.js, pages/tour.js  ← loaded by most pages,
        confirmed ABSENT from settings.html and login.html (datepicker/tour also
        absent from login.html; nav.js absent from fix-births.html)
        ↓
page-specific pages/*.js  ← present for: breeding, production, reports, health,
        vaccine, inventory, finance, tasks, farm_profile, pedigree
        ABSENT (all logic inline) for: animals, animal-detail, barns, assistant,
        settings, import, login, notifications, dead, diary, cost, births,
        users, fix-births
```

---

## Phase 2 — Call Graphs (User Action → UI Update)

**Sell (individual, `animals.html`):**
```
User clicks "بيع" → submitSold(id)
  ↓
validate price
  ↓
fbPatch('animals', id, {status:'sold', sold_date, sold_price, sold_to, sold_notes})
  ↓
fbPost('finance', {...}) [confirmed present in current code, per BL-01/Priority-1 session]
  ↓
logActivity
  ↓
toast
  ↓
refresh/re-render
```
*(Level A — Priority 1 live verification)*

**Add Weight (real, `animal-detail.html`):**
```
Click "Add Weight" → openAddWeight() → fill form → submitAddWeight()
  ↓
fbPost('animals/{id}/weights', {weight, date, notes})
  ↓
logActivity
  ↓
toast
  ↓
fbGet('animals/{id}/weights') [re-fetch]
  ↓
renderDetail() → renderWeightTable()
```
*(Level A — this engagement's Weight Reality Audit)*

**Bulk Transfer (`animals.html`):**
```
Select animals → doBulk('transfer') → fill modal → click confirm
  ↓
execBulk('transfer', {barn, reason})  [field-read-before-close, BL-01 fix]
  ↓
performBulkTransfer(ids, fields) → commitBulkPatch(ids, {barn})
  ↓
fbPatch('animals', id, {barn}) × N
  ↓
logActivity
  ↓
toast
  ↓
refreshAnimalsAfterBulk()
```
*(Level A — BL-01 live verification)*

**Birth (canonical, `_ubSubmit`):**
```
Fill Unified Birth modal → submit
  ↓
fbPost('breeding', rec)
  ↓
loop ×qty: fbPost('animals', {...}) → fbPost('weight_log', {...}) [conditional]
  ↓
logActivity
  ↓
toast → refresh
```
*(Level A — Priority 2, Birth Failure Analysis)*

**Mark Born (`breeding.html`):** *(Level A, this engagement)*
```
Click "ولادة" on a pregnant record → openBModal(id,...,jumpToBorn=true) → fill → submitBreeding()
  ↓
fbPost/fbPatch('breeding', data)  [status→'born', offspring_count set]
  ↓
logActivity
  ↓
toast
  ↓
[NO animals write — confirmed, this is the terminal step]
```

**Production weight-type entry (`pages/production.js`):**
```
Submit production entry, type='weight'
  ↓
fbPost('production_log', {...})
  ↓
fbPatch('animals', animal._id, {current_weight, weight_updated})  [confirmed, this phase's collection extraction]
  ↓
[no animals/{id}/weights write — the real weight-history path is untouched]
```
*(Level B/C this phase — collection usage confirmed via extraction; full call sequence not independently re-traced live)*

---

## Phase 3 — Source of Truth per Entity

| Entity | Writer(s) | Readers | Storage | Derived Data | Fan-out | Sync Status |
|---|---|---|---|---|---|---|
| **Animal** | Many (26 files, RSOT) | Nearly universal | `animals` | None confirmed | N/A | Single collection, many writers — coordinated via shared `commitBulkPatch`/individual patches, no central arbiter |
| **Birth** | `_ubSubmit`, `submitBirthDirect`, `submitBreeding`(via markBorn), `add_birth`(assistant) | `breeding.html`, `pages/pedigree.js`, `pages/reports.js` | `breeding` + `animals` | `offspring_count` (not synchronized with real count, RSOT Invariant 4) | Partial, one-directional (breeding→animals, not reverse) | **Not synchronized** — 4 divergent implementations |
| **Weight** | `submitAddWeight` (real), `assistant.html`, `shared.js`'s `_ubSubmit`, `pages/production.js` | `animal-detail.html` reads `animals/{id}/weights` only | Split across `animals/{id}/weights` (real, read), `weight_log` (written, unread), `animals.current_weight` (written by 3 unrelated paths, read by 2 other pages) | `current_weight` is itself a derived-but-stale value relative to the real history | Confirmed one-directional and **partial** — see Phase 4 | **Not synchronized** — the flagship finding of this engagement |
| **Vaccination** | `pages/vaccine.js` | `pages/vaccine.js`, `pages/reports.js`, `import.html`, `cost.html` | `vaccinations`, `vaccination_templates` | `progress`/`status` fields — computation site **not traced** (RSOT gap, BL-17) | Unknown | Not re-audited this phase |
| **Medication/Treatment** | `pages/health.js` | Many | `health` | `withdrawal_end` (duplicated formula, confirmed identical) | One formula, two call sites, no data risk confirmed | Not re-audited this phase |
| **Production** | `pages/production.js` | `settings.html`, `reports.html`, `dashboard.html` (RSOT) | `production_log` | None confirmed | Weight-type entries fan out to `animals.current_weight` (confirmed this phase) | Partial (see Phase 4) |
| **Pregnancy** | Not a distinct entity — a `breeding.status` value | Same as Breeding | `breeding` | None | N/A | N/A |
| **Sale** | `submitSold`, `performBulkSell`, `submitRemoveAnimal` | `animals.html` filters, `dead.html`(legacy fallback) | `animals.status`/`sold_*` fields, `finance` | None | `finance` record creation, confirmed | **Synchronized** — Priority 1's closed finding |
| **Death** | `submitDeath`, `submitDeathSingle`, `performBulkDeath`, `submitDead` | Same | `animals.status`/`death_*` fields, `finance` | Per-animal `death_id` from a shared `batchDeathId` | `finance` conditional, confirmed | Field-level consistent (BL-02); 4 implementations not diffed against each other beyond the bulk path |
| **Transfer** | `performBulkTransfer`, `submitTransfer` | `animals.html`, `barns.html` | `animals.barn` | None | None | **Synchronized** — BL-01's closed finding |
| **Inventory** | `pages/inventory.js` | Dashboard, Reports, Notifications (feeds/meds only) | `inventory_feeds`/`meds`/`equipment` | Low-stock status — computed at render time, not stored (inference from prior engagement work, not re-verified this phase) | None confirmed | Not re-audited this phase |
| **Notifications** | None (confirmed, RSOT) | Read/merge path exists, unreachable in practice | `notifications` | Live-computed via `generateNotifs()` | N/A | Dormant, not synchronized because there's nothing to synchronize |

---

## Phase 4 — Fan-Out Operations

| Fan-Out | Direction | Completeness | Manual/Automatic |
|---|---|---|---|
| Weight → `animals.current_weight` (from `submitAddWeight`, the REAL feature) | N/A | **Absent entirely** — confirmed, this fan-out does not exist in the real code path | N/A |
| Weight → `animals.current_weight` (from `pages/production.js`'s weight-type entries) | One-directional | **Partial** — updates `current_weight`, never touches the real `animals/{id}/weights` history | Automatic (happens every time, no user choice) |
| Weight → `animals.current_weight` (from `assistant.html`'s AI weight action) | One-directional | **Partial in a different way** — updates `current_weight` AND `weight_log` (the unread collection), never the real `animals/{id}/weights` path | Automatic |
| Sale → `finance` | One-directional | **Complete**, confirmed at all 3 sale writers (Priority 1) | Automatic, conditional on price>0 |
| Death → `finance` | One-directional | **Complete** where present, confirmed at BL-02's fixed path | Automatic, conditional on loss>0 |
| Birth → `weight_log` (from `_ubSubmit`) | One-directional | **Complete for its own target**, but that target has no reader (RSOT) — a fan-out that terminates in a dead end | Automatic, conditional on weight given |
| Breeding.offspring_count → Animals (expected, per the domain's own apparent intent) | **N/A — does not exist** | **Absent entirely** for the `markBorn` path | N/A |

**No bidirectional fan-out was found anywhere in this investigation.** Every confirmed fan-out is one-directional; several are confirmed partial or entirely absent where a complete version would be expected by domain logic.

---

## Phase 5 — Architectural Smells (Documentation Only)

- **Duplicate Runtime:** Birth (4 implementations), Death (4), Transfer (2) — all previously evidenced, RSOT/Backlog.
- **Ghost Files:** `pages/animal_detail.js`, `pages/births.js`, `pages/notifications.js` — no execution path found (RSOT Section 6).
- **Dead References:** The `weights` (top-level) collection reference inside `settings.html`'s reset-tool array — refers to a collection with no active writer or reader.
- **Partial Fan-out:** Every weight-related fan-out documented in Phase 4 above.
- **Parallel Implementations:** `weight_log` (top-level) vs. `animals/{id}/weights` (real) — two structurally different storage models for the same concept, built independently.
- **Repository Drift:** RSOT's own "universal load order" inference, disproven for `settings.html`/`login.html` this phase — a real, small instance of documentation lagging actual page-to-page variation.
- **Shared Logic Violations:** Sale/Death/Transfer's multiple independent implementations, each re-deriving the same business rule rather than calling one shared function (per this engagement's own Repository 5 mission statement).
- **Orphan Collections:** `weights` (top-level, confirmed inert).
- **Hidden Dependencies:** `settings.html`'s PWA/APK-download functions (`triggerPWAInstall`, `downloadAPKProject`) — a functional area coupling farm-management settings with app-distribution concerns, discovered this phase, not previously documented anywhere in this engagement.
- **Circular Dependencies:** **None found** — the load order (config→firebase→nav/shared→page-specific) is strictly linear in every page checked; no evidence of any file loading something that loads it back.

---

## Phase 6 — Technical Debt (Evidence-Linked)

| Item | Severity | Evidence |
|---|---|---|
| Weight system split across 3 storage locations with no synchronization | **High** | Phase 3/4, this document; RSOT Weight Reality Audit |
| Birth has 4 divergent implementations, one with zero animal-creation capability | **High** | RSOT Section 3, Birth Failure Analysis |
| `breeding.offspring_count` can diverge from real animal count with no detection | **High** | Live failure-injection proof, RSOT Invariant 4 |
| `pages/production.js`'s weight fan-out bypasses the real weight-history feature | **Medium** | Phase 1/4, this document (collection-extraction evidence, not independently live-traced) |
| Three ghost files present in the repository | **Medium** | RSOT Section 6, this phase's independent re-confirmation |
| Death/Transfer's non-bulk implementations not diffed against each other beyond the one shared root-cause bug already fixed | **Medium** | BL-02's own stated scope limits |
| `settings.html`'s load-order deviation from the (now-corrected) assumed universal pattern | **Low** | This phase, Repository-level |
| Vaccination `progress` calculation site untraced | **Low** (severity of the debt itself unknown pending investigation) | RSOT/Backlog BL-17, unresolved |

---

## Phase 7 — Architecture Roadmap (Not a Backlog)

**Phase A — Consolidate Weight Truth.** Before any further weight-related fix, a Product Decision is needed on whether `animals/{id}/weights` (the real, live implementation) becomes the sole target for every writer (`assistant.html`, `pages/production.js`, and any future Birth-weight capture), retiring `weight_log` and top-level `weights` entirely. This phase is foundational — every other weight-related architectural improvement depends on this decision being made first.

**Phase B — Unify Business-Event Entry Points.** Once Phase A's data-model question is settled, converge Birth's 4 implementations, and audit Death's non-bulk paths against each other with the same rigor already applied to the bulk path. This phase can proceed independently of Phase A for the *non-weight* aspects of Birth (e.g., `markBorn`'s missing animal creation).

**Phase C — Restore Observability.** `activity.html`'s empty-file state and the disconnected Undo system are both independent of the data-model questions above and can be addressed in parallel with Phases A/B without risk of rework.

**Phase D — Broad Consistency Pass.** Lower-severity items (attribution-style standardization, `feed_consumption`'s FK style, the vaccination-progress trace) — deliberately sequenced last, since none of them block or are blocked by anything else in this roadmap.

**Ordering rationale:** A precedes B because B's Birth-unification work would need to duplicate itself if the underlying weight storage model changes mid-way. C is independent and can run in parallel with either. D has no dependencies and no urgency, hence last.

---

## Stop-Rule Assessment

No fact discovered this phase contradicts a Level-A FACT from RSOT. One Level-D INFERENCE (universal page load order) was disproven for two pages and is corrected above, per the explicit "this is not RSOT-undermining" carve-out reasoned through at the top of this document. **No ENGINEERING STOP triggered. Document completed through Phase 7 as instructed.**

---

**This document, together with RSOT, is the permanent architectural reference for Repository 4/5. No code was modified. No fixes were proposed.**
