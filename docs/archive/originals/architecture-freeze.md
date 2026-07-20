# Repository 5 — Architecture Freeze
**Status: Documentation only. No code modified. No unification performed. This document is the binding architectural contract for all subsequent Repository 5 work.**

---

## 1. Canonical Workflow Specification

### Birth
- **Canonical entry point:** `shared.js`'s `_ubSubmit()`
- **Canonical workflow:** validate mother tag/breed → create/locate `breeding` record → create one `animals` record per offspring → if weight given, create one `weight_log` entry per offspring (linked by real `animal_id`) → activity log → cache invalidation (`animals`, `breeding`, `weight_log`) → UI refresh
- **Canonical Firebase writes:** `breeding` (create), `animals` (create ×N), `weight_log` (create ×N, conditional)
- **Canonical propagation:** none currently reaches Dashboard/Reports/Statistics (confirmed, neither touches these three fields) — this is the current, evidenced state, not a target to expand under this freeze
- **Canonical logging:** one `logActivity('add','animals', ...)` call describing the whole birth event
- **Canonical notifications:** none (Notifications has no live producer at all, project-wide — Not Applicable here specifically)
- **Canonical cache invalidation:** implicit via `fbPost`'s own unconditional invalidation (confirmed in `firebase.js`)
- **Canonical UI refresh:** page reload of the birth-registering context (dashboard/animals list, depending on where triggered)
- **Canonical statistics updates:** none direct — any birth-derived statistic (e.g., Breeding's fertility report) recomputes on demand from the raw `breeding`/`animals` collections, not from a cached statistic

### Death
- **Canonical entry point:** `dead.html`'s `submitDead()` (tied structurally with `animals.html`'s `submitDeath()`/`submitDeathSingle()` — all three confirmed near-identical; `dead.html`'s version is named canonical here because the Death Records page is the domain-appropriate home for this action, per this project's own page-per-concern convention)
- **Canonical workflow:** read all fields *before* closing the modal → `animals.status='dead'` + full death-detail fields → conditional `finance` loss record → activity log → refresh
- **Canonical Firebase writes:** `animals` (patch), `finance` (conditional create)
- **Canonical logging:** `logActivity('edit'/'remove','animals', ...)`
- **Canonical cache invalidation / UI refresh:** standard, as above

### Sale
- **Canonical entry point:** `animals.html`'s `submitSold()`
- **Canonical workflow:** `animals.status='sold'` + `sold_date`/`sold_price`/`sold_to`/`sold_notes` → `finance` income record → activity log → refresh
- **Status:** Already fully unified (Priority 1 + follow-up) — restated here for completeness of this contract, not newly decided

### Transfer
- **Canonical entry point:** `barns.html`'s `submitTransfer()`
- **Canonical workflow:** read all fields *before* closing the modal → `animals.barn` patched per selected animal → activity log → refresh
- **Canonical Firebase writes:** `animals` (patch, barn field only)

### Weight Recording
- **Canonical entry point:** `pages/animal_detail.js`'s `submitWeight()`
- **Canonical workflow:** validate weight > 0 → create `weight_log` entry (full schema: `animal_id, animal_tag, animal_breed, weight, date, notes, recorded_by`) → fan-out patch `animals.current_weight` → activity log → refresh
- **Canonical Firebase writes:** `weight_log` (create), `animals` (patch, `current_weight`/`weight_updated`)

### Vaccination
- **Canonical entry point:** `pages/vaccine.js`'s `submitVacc()` (sole implementation — restated for contract completeness)

### Treatment / Medication
- **Canonical entry point:** `pages/health.js`'s `submitHealth()` (sole implementation)

### Breeding (record lifecycle, excluding the birth-creation step)
- **Canonical entry point:** `pages/breeding.js`'s `submitBreeding()`
- **Canonical workflow (current, evidenced):** create/edit a `breeding` record's status/dates/offspring-count fields
- **Note:** this function's use via `markBorn()` to represent an actual birth is flagged as a Product Decision (Section 5) — the canonical *record-editing* workflow is frozen as-is; whether it should *also* trigger animal creation is explicitly not decided here

### Milk/Meat Production, Inventory Movement, Daily Task (manual), Authentication, Animal Import, Animal Edit (individual), Animal Delete
- Each has exactly one confirmed implementation (`submitProd()`, `submitInv(type)`, `submitTask()`, `attemptLogin()`, `import.html`'s flow, `submitEditAnimal()`, `deleteAnimalFull()`/`performBulkDelete()` — the latter two confirmed structurally consistent this session). **Canonical by default, nothing to freeze a *choice* between.**

### Farm Settings
- **Canonical entry point:** `pages/farm_profile.js`'s `saveSettings()` call, reading everywhere via `getSettings()`
- **Canonical workflow (current, evidenced):** `localStorage`-only, no Firebase persistence
- **Note:** whether this remains canonical or should change is a Product Decision (Section 5) — the *current* mechanism is frozen as the documented status quo, not endorsed as the permanent target

### Notifications
- **Canonical entry point:** none — `generateNotifs()` computes live, ephemeral notifications each page load; no persisted producer exists
- **Status:** Reserved (frozen as-is pending a Product Decision)

---

## 2. Entry Point Classification Matrix

| Entry Point | File / Function | Classification | Justification |
|---|---|---|---|
| Birth — `_ubSubmit()` | `shared.js` | **Canonical** | Most complete workflow (breeding+animals+weight_log), only path already fixed for correctness this Sprint |
| Birth — `submitBirthDirect()` | `pages/breeding.js` | **Requires Product Decision** | Creates breeding+animals but never weight_log by design (no weight field in its own form) — may be an intentionally lighter "quick entry" path, not necessarily a bug |
| Birth — `add_birth` (AI) | `assistant.html` | **Requires Product Decision** | Creates only an animal record, no breeding record, no weight_log — whether the AI path should match the full canonical shape or remain a lightweight shortcut is a product question |
| Birth — `markBorn()`/`submitBreeding()` | `pages/breeding.js` | **Requires Product Decision** | Confirmed to create zero animal records — the most severe gap found this engagement; whether this is a bug or an intentional "just update the count" tool is unresolved |
| Death — `submitDeath()`, `submitDeathSingle()` | `animals.html` | **Thin Wrapper candidates** | Field sets match `dead.html`'s canonical version closely; no confirmed behavioral divergence found |
| Death — `submitDead()` | `dead.html` | **Canonical** | Named canonical per Section 1 |
| Death — `performBulkDeath()` | `animals.html` | **Legacy** | Confirmed structurally sound aside from the known, separately-scoped `closeModal` timing defect |
| Sale — all three | `animals.html` ×2, `animal-detail.html` | **Canonical** (all three, post-unification) | Confirmed identical convention, verified live |
| Transfer — `submitTransfer()` | `barns.html` | **Canonical** | Confirmed correct field-read ordering |
| Transfer — `performBulkTransfer()` | `animals.html` | **Legacy** | Confirmed broken by the `closeModal` timing defect — same root cause as bulk Death |
| Weight — `submitWeight()` | `pages/animal_detail.js` | **Canonical** | Most complete (full fan-out, full schema) |
| Weight — `assistant.html`'s action | `assistant.html` | **Thin Wrapper candidate** | Correct shape, smaller schema (missing `animal_id`) — a narrowing, not a divergent behavior |
| Weight — `_ubSubmit`'s weight portion | `shared.js` | **Thin Wrapper candidate** | Correct target collection (post-Priority-2), but doesn't fan out to `current_weight` |
| Weight — `pages/production.js`'s type='weight' | `pages/production.js` | **Requires Product Decision** | Confirmed to skip `weight_log` entirely |
| Vaccination — `submitVacc()` | `pages/vaccine.js` | **Canonical** | Sole implementation |
| Treatment — `submitHealth()` | `pages/health.js` | **Canonical** | Sole implementation |
| Breeding — `submitBreeding()` | `pages/breeding.js` | **Canonical** (for record-editing only) | Sole implementation for its actual scope |
| Production — `submitProd()` | `pages/production.js` | **Canonical** | Sole implementation |
| Inventory — `submitInv()` | `pages/inventory.js` | **Canonical** | Sole implementation, shared correctly across all three inventory types |
| Finance — all 10 sites | 6 files | **Canonical** (each, for its own distinct transaction type) | Confirmed (Repository 4) legitimately different event types, not duplicated logic |
| Daily Task — `submitTask()` | `pages/tasks.js` | **Canonical** | Sole manual-entry implementation |
| Daily Task — `generateRecurringTasks()` | `pages/tasks.js` | **Canonical** (distinct automation) | A genuine background process, not competing with manual entry |
| Notifications — (no writer) | — | **Reserved** | Confirmed, no live producer exists |
| Activity Log — `logActivity()` | universal | **Canonical** | By design, intentionally called from everywhere |
| Authentication — `attemptLogin()` | `login.html` | **Canonical** | Sole implementation |
| Farm Settings — `saveSettings()` | `pages/farm_profile.js` | **Canonical** (as currently implemented) | Sole implementation |
| Animal Edit — `submitEditAnimal()` | `animal-detail.html` | **Canonical** | Sole *reachable* implementation |
| Animal Edit — `execBulk()`'s `edit` branch | `animals.html` | **Dead Code** | Confirmed unreachable from any UI button, every prior audit this engagement |
| Animal Delete — `deleteAnimalFull()`, `performBulkDelete()` | `animals.html` | **Canonical** (both) | Confirmed structurally consistent this session — no divergence found |
| Animal Import — its own flow | `import.html` | **Canonical** | Sole implementation |
| Animal Export — `exportExcel()`/`exportCSV()` | `animals.html` | **Canonical** (quick export) | Positioned by the app's own UI as the fast path |
| Animal Export — its own flow | `import.html` | **Canonical** (comprehensive export) | Confirmed this session: `animals.html`'s own UI links to `import.html` labeled "محرك البيانات الكامل" (the full data engine) — evidence of intentional, non-competing design, not an accidental duplicate |

---

## 3. Architectural Invariants Register (evidence-supported only)

1. **A Sale is never a subtype of Death.** (Established, Priority 1 — enforced at all 3 current writers.)
2. **A weight record is never orphaned from its animal** — every `weight_log` entry must carry a real `animal_id`. (Established, Priority 2 — true for the two live writers that set it; `assistant.html`'s writer is a documented, smaller exception, not a violation of intent.)
3. **Every birth that creates offspring must create corresponding animal records.** (New — directly evidenced by the `markBorn()` gap being the clearest, most severe counter-example found this engagement; stated here as the target invariant, **not yet true today**.)
4. **A business event's canonical implementation is the one with the most complete, correctly-ordered field reads and writes** — not the oldest, not the most recently written, not the one in the "obvious" file. (Methodological invariant, evidenced by `barns.html`'s Transfer implementation being canonical despite `animals.html`'s version living in the more "central" file.)
5. **Reading a modal's own form fields must happen before that modal is closed.** (New, general invariant — directly derived from the shared root cause behind both the bulk Death and bulk Transfer defects.)

**Not yet established as invariants (explicitly excluded, pending Section 5's decisions):** "every business event has exactly one canonical implementation" and "every business event must fully propagate to all required downstream consumers" — both are aspirational per the original Repository 5 mission, but are **not yet true** of this codebase and are not stated here as already-enforced rules, to avoid the contract asserting something the evidence contradicts.

---

## 4. Product Decision Register

| Decision Required | Why It Blocks Implementation | Workflows Affected | Recommended Default (evidence-based) |
|---|---|---|---|
| Should `markBorn()` create real `animals` records, or is "just update the count" its intentional, lighter-weight purpose? | Cannot safely unify Birth's five entry points without knowing whether this is a bug or a distinct, intentional tool | Birth | **Recommend: it should create animal records.** A farm-management system's core purpose is tracking individual animals; a "birth" that produces no trackable animal contradicts the domain's own stated purpose |
| Should `submitBirthDirect()` and the AI's `add_birth` action be expected to create `weight_log` entries, matching `_ubSubmit`? | Determines whether these are "thin wrappers to fix" or "intentionally lighter alternatives to leave alone" | Birth, Weight Recording | **Recommend: yes, for consistency** — but lower urgency than the `markBorn` gap |
| Should Production-page weight entries create `weight_log` history, or are they intentionally a lightweight "just update the number" tool? | Determines whether `pages/production.js`'s weight branch needs a fix or is a deliberate design choice | Weight Recording | **Recommend: yes, create history** — the entire reason `weight_log` exists is to answer "how has this animal's weight changed," and a silently-excluded data point undermines that |
| Should Farm Settings move to Firebase-backed sync? | Determines whether Settings is in scope for a "single source of truth" fix, or accepted as intentionally per-device | Farm Settings | **Recommend: move to Firebase** — confirmed real multi-device inconsistency exists; the project already has the offline-write-queue infrastructure this would need |
| Should Notifications gain a real, persisted producer? | Determines whether the empty "stored" bucket is finished infrastructure awaiting a feature, or should be removed | Notifications | **No default recommended** — evidence shows the live-only path already fully serves today's UI; this is a new-feature decision, not a bug fix |

---

## 5. Business Rule Migration Roadmap (ordered by business risk, not code complexity)

| Order | Business Event | Canonical Target | Entry Points to Migrate | Expected Risk | Regression Surface | Verification Checklist |
|---|---|---|---|---|---|---|
| 1 | **Death** | `dead.html`'s field-read-before-close pattern applied to `performBulkDeath()` | `animals.html`'s bulk death | Low — same fix shape already proven twice | `animals.html`'s bulk-death modal only | Payload spy showing real field values reach the write; individual paths unaffected |
| 2 | **Transfer** | `barns.html`'s field-read-before-close pattern applied to `performBulkTransfer()` | `animals.html`'s bulk transfer | Low — identical fix shape to #1 | `animals.html`'s bulk-transfer modal only | Same methodology as Priority 1's transfer verification |
| 3 | **Birth — `markBorn()`** | Extend `submitBreeding()`'s born-status branch to also create `animals` records (pending Product Decision) | `pages/breeding.js`'s `markBorn` path | **Medium-High** — a genuine behavior *addition*, risks double-creating animals if not carefully scoped | Breeding page's status workflow, Animals list, existing pregnant-record data | Verify a pregnancy marked "born" produces exactly the stated `offspring_count` of new animals, exactly once |
| 4 | **Weight Recording — Production path** | Add the missing `weight_log` creation step (pending Product Decision) | `pages/production.js` | Medium — must not double-count against other weight entries for the same day | Production page, Animal Detail's weight history | Confirm a production-logged weight appears on that animal's history chart exactly once |
| 5 | **Birth — `submitBirthDirect()` / AI `add_birth`** | Extend both to match `_ubSubmit`'s full shape (pending Product Decision) | `pages/breeding.js`, `assistant.html` | Medium — two separate small additions | Quick-birth modal, AI assistant birth command | Confirm both create weight_log entries when a weight is provided |
| 6 | **Farm Settings** (if decided to migrate) | New Firebase-backed `saveSettings()`/`getSettings()` | Every page calling `getSettings()` | **High** — broadest blast radius of any item | Every page in the application | Full-app smoke test; explicit multi-device consistency test |
| 7 | **Notifications** (if decided to build a producer) | New feature | N/A — greenfield | Low (additive) | Notifications page only | New feature's own test plan |

**Ranking rationale:** items 1–2 rank first as pure technical migrations with zero open product questions and an already-proven fix shape. Items 3–5 require Product Decisions first and involve genuine new behavior. Item 6 ranks last among approved items due to its unmatched blast radius. Item 7 is a feature decision, not a migration.

---

**This document is now the binding architectural contract. No code was modified. No unification was performed.**
