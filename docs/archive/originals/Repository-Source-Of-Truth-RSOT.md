# Repository Source Of Truth (RSOT)
**Status: Permanent engineering reference. No code modified to produce this document. Every claim is classified FACT (with Evidence Level A–E) / INFERENCE / UNKNOWN.**

---

## Section 1 — Repository Architecture

**FACT (C):** 31 HTML pages exist at the project root, plus `pages/` (15 `.js` files), `shared.js`, `firebase.js`, `nav.js`, `config.js`, `offline-sync.js`, `sw.js`, `manifest.json`.

**FACT (C):** There is no build step. `package.json` has no `scripts` field; no bundler config (webpack/vite/rollup/parcel/esbuild) exists anywhere in the repository; `vercel.json` contains only a CORS-headers rule.

**FACT (B/C):** Every page follows the same load pattern: `config.js` → `firebase.js` → `nav.js` → `shared.js` → `offline-sync.js` (deferred) → zero-or-one page-specific `pages/*.js` (deferred) → `pages/datepicker.js` + `pages/tour.js` (deferred, present on every page checked) → an inline `<script>` block containing the page's own logic → Bootstrap bundle (CDN).

**FACT (A, this page only):** For `animal-detail.html` specifically, this load order was confirmed via live `document.scripts` inspection and real network-request monitoring, not just source reading.

**INFERENCE (D):** The same load order applies to the other 30 pages, based on identical `<script>` tag structure found via source reading. **Not individually live-verified** for pages other than `animal-detail.html`, `animals.html`, `breeding.html`, and `dashboard.html` (the four pages given real Playwright-instrumented testing across this engagement).

**FACT (C):** `shared.js` is the single largest shared library, containing `renderNavbar`, `renderFarmModal`, `commitBulkPatch`, `refreshAnimalsAfterBulk`, `_ubSubmit`, `showModal`/`closeModal`, `toast`, the (disconnected) undo system, and dozens of formatting/utility functions.

---

## Section 2 — Runtime Entry Points

| Page | Page-Specific `pages/*.js` | Evidence Level | Dynamic Loading Found? | Late Injection Found? |
|---|---|---|---|---|
| `animal-detail.html` | none (all logic inline) | **A** — live DOM + network inspected | No (A) | No, within 2.5s observation window (A) |
| `animals.html` | none (all logic inline) | **A** — extensively live-tested across BL-01/02/03 and the entire Repository 4 refactor | No (B, source-checked) | Not independently re-checked via live DOM in this exact session |
| `breeding.html` | `pages/breeding.js` | **A** — live-tested (BL-03, BL-04) | No (B) | Not independently re-checked |
| `dashboard.html` | none (all logic inline) | **A** — live-tested (Priority 2, birth registration, failure-injection tests) | No (B) | Not independently re-checked |
| `finance.html` | `pages/finance.js` | **B** — source read only | Not checked | Not checked |
| `health.html` | `pages/health.js` | **B** | Not checked | Not checked |
| `inventory.html` | `pages/inventory.js` | **B** | Not checked | Not checked |
| `vaccine.html` | `pages/vaccine.js` | **B** | Not checked | Not checked |
| `production.html` | `pages/production.js` | **B** | Not checked | Not checked |
| `tasks.html` | `pages/tasks.js` | **B** | Not checked | Not checked |
| `reports.html` | `pages/reports.js` | **B** | Not checked | Not checked |
| `pedigree.html` | `pages/pedigree.js` | **B** | Not checked | Not checked |
| `farm-profile.html` | `pages/farm_profile.js` | **B** | Not checked | Not checked |
| All remaining pages (barns, cost, dead, diary, import, notifications, users, login, settings, etc.) | none or as listed | **C** (source-confirmed to exist; load order inferred by pattern, not individually verified) | Not checked | Not checked |

**UNKNOWN:** Whether any page beyond the four given live Playwright testing has late-injected scripts, dynamic imports, or a different real execution order than its source suggests. **Not checked.**

---

## Section 3 — Canonical Data Flows

| Feature | Entry Point(s) | Canonical | Firebase Writes | Activity Log | Fan-outs | Deprecated/Parallel Implementations | Evidence |
|---|---|---|---|---|---|---|---|
| **Birth** | `_ubSubmit()` (shared.js), `submitBirthDirect()` (breeding.js), `markBorn→submitBreeding()` (breeding.js), `add_birth` (assistant.html) | `_ubSubmit()` | `breeding`(1), `animals`(×N), `weight_log`(×N, conditional) | 1 entry | None to Dashboard/Reports (confirmed absent) | **4 confirmed implementations, only 1 complete** (BL-03 fixed a crash in the direct path; `markBorn`'s zero-animal gap remains, blocked on Product Decision) | A (this session, multiple live tests) |
| **Weight (real)** | `openAddWeight()`→`submitAddWeight()` (animal-detail.html) | This IS canonical | `animals/{id}/weights`(1) | 1 entry | **None** — no `current_weight` fan-out confirmed | `pages/animal_detail.js`'s `submitWeight()` is **not executed** (Section 6); `weight_log` writers (`assistant.html`, `shared.js`) target a collection this real feature never reads | **A** (this session) |
| **Sale** | `submitSold()`, `performBulkSell()`, `submitRemoveAnimal()`'s sale branch (animal-detail.html) | `submitSold()` | `animals.status='sold'`+fields, `finance`(conditional) | 1 entry each | None found | **Closed** — all 3 confirmed converged on one convention (Priority 1) | A (Priority 1 live verification) |
| **Death** | `submitDeath()`, `submitDeathSingle()`, `performBulkDeath()` (animals.html), `submitDead()` (dead.html) | `dead.html`'s `submitDead()` (by domain-page convention; not proven functionally superior to the animals.html individual variants) | `animals.status='dead'`+fields, `finance`(conditional) | 1 entry | None found | 4 implementations; bulk path fixed (BL-02); the other 3 not diffed against each other field-for-field | A (BL-02 live verification) |
| **Transfer** | `performBulkTransfer()` (animals.html), `submitTransfer()` (barns.html) | `barns.html`'s version (proven correct field-read order; `animals.html`'s fixed to match, BL-01) | `animals.barn` | 1 entry | None | 2 implementations, now both confirmed correct | A (BL-01 live verification) |
| **Breeding** (record CRUD, excluding birth-creation) | `submitBreeding()` (breeding.js) | Sole implementation | `breeding` create/patch | 1 entry | None | None found | A (this session's markBorn testing exercised this same function) |
| **Vaccination** | `submitVacc()` (vaccine.js) | Sole implementation | `vaccinations` | Not independently re-verified this pass | — | None found in prior audits | B |
| **Medication/Treatment** | `submitHealth()` (health.js) | Sole implementation | `health` | Not independently re-verified this pass | Computes `withdrawal_end` (duplicated formula, confirmed identical in both copies) | None found | B |
| **Pregnancy** | Not a distinct entry point — a `status` value on `breeding` | N/A | N/A | N/A | N/A | N/A | B |
| **AI Assistant** | `assistant.html`'s per-intent handlers (`add_birth`, weight-update, others not audited this engagement) | N/A — a dispatcher, not itself canonical for any one business event | Varies by intent | Varies | Weight-update intent confirmed to fan out correctly to both `weight_log`(wrong collection) and `current_weight` | Every AI intent is its own independent implementation, none verified to delegate to any page's canonical function | B (source read only; no AI intent live-tested this engagement) |
| **Import** | `import.html`'s own flow | Sole implementation | `animals` (bulk create), can set `current_weight` directly | Not independently re-verified this pass | None to `weight_log`/nested weights | None found | B |
| **Export** | `animals.html`'s `exportExcel`/`exportCSV`, `import.html`'s own export | Both — confirmed complementary (fast export vs. "full data engine"), not competing | Read-only | N/A | N/A | Field-for-field output never diffed between the two (BL-18, unresolved) | B |

---

## Section 4 — Firebase Source of Truth Matrix

| Collection/Path | Readers | Writers | Runtime Verified? | Repository Verified? | Status |
|---|---|---|---|---|---|
| `animals` | Nearly every page (26 files, Repository 4 audit) | Nearly every page | **A** (animals.html, animal-detail.html extensively) | C | Active, core |
| `animals/{id}/weights` | `animal-detail.html` | `animal-detail.html` | **A** (this session) | C | **Active — the real weight-history source** |
| `weight_log` | **None found** | `assistant.html`, `shared.js` | Writers: B (not live-tested). Readers: **no reader found at any evidence level** | C | Write-only from the repository's own perspective |
| `weights` (top-level) | None | None (post-Priority-2) | — | C | Inert — referenced only in an admin reset-tool's deletion list |
| `breeding` | `breeding.html`, `pages/pedigree.js`, `pages/reports.js`, `dashboard.html` | `pages/breeding.js`, `shared.js` | A (breeding.js writes, this session) | C | Active |
| `health` | Many (Repository 4 audit) | `pages/health.js` | B | C | Active |
| `vaccinations`/`vaccination_templates` | `pages/vaccine.js`, `pages/reports.js` | `pages/vaccine.js` | B | C | Active, legitimate template/instance pair |
| `finance` | Many | 6 files, 10 sites (Repository 4 audit — confirmed legitimately varied, not duplicated logic) | A (Priority 1/BL-02 exercised finance writes) | C | Active |
| `inventory_feeds`/`meds`/`equipment` | Dashboard, Reports (feeds/meds only) | `pages/inventory.js` | B | C | Active |
| `feed_consumption` | None found | `pages/inventory.js` | B | C | Active, single-owner, fragile name-based FK (BL-15) |
| `daily_tasks` | `pages/tasks.js` only | `pages/tasks.js` (manual + `generateRecurringTasks` automation) | B | C | Active |
| `notifications` | `pages/notifications.js`'s stored-merge path (itself unreachable, Section 6) | **None** | — | C | Reserved, no live producer |
| `login_notifications` | `settings.html`, `pages/notifications.js` (unreachable) | `login.html` | B | C | Active writer, unreachable-reader caveat |
| `activity_log` | Intended: `activity.html` (0 bytes, confirmed pre-existing, unrelated to this engagement) | Universal (`logActivity()`) | A (fires correctly in every live test this engagement) | C | Writer fully active; reader broken |
| `uid_lookup` | Firebase security rules (server-side, unverifiable from here) | `firebase.js`'s Auth bridge | B | C | Narrow, correctly scoped |
| `diary_snapshot` | `dashboard.html` | `diary.html`, `dashboard.html` | B | C | Intentional manual-reconciliation feature, confirmed via code comments |

---

## Section 5 — Ownership Matrix (key fields)

| Field | Owner Function | Secondary Writers | Secondary Readers | Fan-outs | Single Source of Truth? |
|---|---|---|---|---|---|
| `animals.status` | Varies by transition (`submitSold`, `submitDeath`, `submitDead`, `performBulk*`) | `submitRemoveAnimal` | Nearly every page | None | **Yes, as of Priority 1** — one convention (`'sold'`/`'dead'`/`'alive'`) confirmed enforced at all 3 sale writers |
| `animals.current_weight` | **No single owner confirmed** | `assistant.html`, `pages/production.js`, `submitEditAnimal()` (animal-detail.html, general edit form) | `animals.html`, `import.html` | None into it (it IS the fan-out target for the writers listed, but the real weight-history feature doesn't write it at all) | **No** |
| `animals.barn` | `performBulkTransfer`/`submitTransfer` | Individual animal edit, `barns.html`'s own reassignment | `animals.html`, `barns.html` | None | Yes, as of BL-01 |
| `breeding.offspring_count` | `_ubSubmit`, `submitBirthDirect`, `submitBreeding` | None | `breeding.html`, reports | **Not guaranteed to match real `animals` count** — proven false invariant under partial failure (Birth Failure Analysis) | **No** |
| `weight_log.animal_id` | `pages/animal_detail.js` (unreachable), `shared.js`'s `_ubSubmit` | — | Nothing (Section 4) | — | N/A — collection has no real reader |

---

## Section 6 — Dead / Dormant / Deprecated Code

| File/Feature | Classification | Why | Evidence |
|---|---|---|---|
| `pages/animal_detail.js` | **No execution path found** (not asserted as "dead" per the corrected standard) | Not referenced by any `<script src>` (C), zero DOM script elements after live load (A), zero network requests for it (A), zero dynamic-execution patterns across all files actually loaded (B), no build/deploy transform in this repo (C) | A/B/C combined; Vercel dashboard config and stale-SW-in-real-browser remain genuinely unchecked (E) |
| `pages/births.js` | **No execution path found** | Confirmed via the same script-src audit this session — not loaded by any HTML page | C |
| `pages/notifications.js` | **No execution path found** | Same audit method | C |
| `weights` (top-level collection) | **Dormant** (referenced, not executed) | Present only in `settings.html`'s admin reset-tool deletion list; zero active read/write path | C |
| Undo system (`undoLast`/`_pushUndo`) | **Dormant** | Fully built, `_pushUndo` never called from anywhere, confirmed by exhaustive grep | C |
| `notifications`'s stored-record path | **Dormant** | Read/merge code exists and would function if a document existed; zero producer found anywhere | C |
| `activity.html` | **Deprecated/Broken** (distinct from the above — this is missing content, not unreachable code) | Confirmed 0 bytes, pre-existing, unrelated to this engagement's own work | C |
| `execBulk()`'s `edit` branch (animals.html) | **Repository Reachable, Runtime Unreachable** | The code executes correctly if called directly (proven in Repository 4's own audit), but no UI button calls it | B (code works) + C (no caller found) |

---

## Section 7 — Canonical Call Graphs (Facts Only)

**Birth (`_ubSubmit`):** `openUnifiedBirthModal()` → user submits → `_ubSubmit()` → `fbPost('breeding',rec)` → loop: `fbPost('animals',...)` → `fbPost('weight_log',...)` (conditional) → `logActivity` → toast → refresh. *(Level A)*

**Weight (real):** `openAddWeight()` → user submits → `submitAddWeight()` → `fbPost('animals/{id}/weights', data)` → `logActivity` → toast → `fbGet('animals/{id}/weights')` → `renderDetail()`. *(Level A)*

**Sale:** `submitSold()`/`performBulkSell()`/`submitRemoveAnimal()` → `fbPatch('animals', id, {status:'sold',...})` → `finance` write (conditional) → `logActivity` → toast → refresh. *(Level A)*

**Death:** Modal confirm → `submitDeath`/`submitDeathSingle`/`performBulkDeath`/`submitDead` → `fbPatch('animals', id, {status:'dead',...})` → `finance` write (conditional) → `logActivity` → toast → refresh. *(Level A)*

**Transfer:** Modal confirm → `performBulkTransfer`/`submitTransfer` → `fbPatch('animals', id, {barn})` → `logActivity` → toast → refresh. *(Level A)*

**Breeding (record CRUD):** Modal confirm → `submitBreeding()` → `fbPost`/`fbPatch('breeding', ...)` → `logActivity` → toast → refresh. *(Level A, this session)*

**AI Assistant:** Natural-language input → intent classification (mechanism not audited this engagement) → per-intent handler → varies. *(Level B only — no live execution of any AI intent this engagement)*

---

## Section 8 — Storage Matrix

*(Consolidates Sections 4/5; see those for full detail. Summary confidence ratings:)*

| Collection | Confidence | Basis |
|---|---|---|
| `animals` | Very High | Extensively live-tested across the entire engagement |
| `animals/{id}/weights` | High | Live-tested this session, but only Add/Delete, not a full multi-scenario sweep |
| `breeding` | High | Live-tested this and prior sessions |
| `weight_log` | Medium | Writers source-confirmed; "no reader" is repository-scoped, not absolute |
| `weights` | High (for inertness) | Fully audited, zero ambiguity remaining |
| `finance`/`health`/`vaccinations`/inventory collections | Medium | Source-proven, not live-tested this engagement's weight/birth-focused sessions |
| `notifications`/`login_notifications` | Medium-High | Repository-proven producer/consumer mismatch |

---

## Section 9 — Architectural Invariants (Proven Only)

1. **A Sale is never a subtype of Death.** *(A — Priority 1, live-verified at all 3 writers.)*
2. **A `weight_log` entry, where one exists, carries a real `animal_id`.** *(A — Priority 2 live test; caveat: `assistant.html`'s writer omits it, B-level finding.)* — **Note: this invariant governs a collection with no confirmed reader (Section 4), limiting its practical significance.**
3. **Reading a modal's own form fields must happen before that modal is closed, for correct data capture.** *(A — proven true in the failure direction 3 times: BL-01, BL-02, BL-03, all live-reproduced.)*
4. **`breeding.offspring_count` is NOT guaranteed to equal the real linked-animal count.** *(A — proven false via live failure injection, Birth Failure Analysis.)* Stated as an invariant of what currently *is*, not what should be.
5. **Every successful individual Death/Sale/Transfer action produces exactly one `activity_log` entry.** *(A — confirmed in every live test this engagement; no counter-example found.)*
6. **The real weight-history feature (`animal-detail.html`) never writes `animals.current_weight`.** *(A, this session.)*

---

## Section 10 — Known Architectural Debt (Confirmed Only, No Fixes Proposed)

- **Duplicate implementations:** Birth (4-5 implementations depending on counting convention), Death (4), Transfer (2), Export (2, confirmed complementary not competing).
- **Parallel flows:** Weight tracking exists as (a) the real `animals/{id}/weights` system, and (b) the never-consumed `weight_log` top-level collection with two real writers.
- **Abandoned code:** `pages/animal_detail.js`, `pages/births.js`, `pages/notifications.js` (no execution path found, any of them); the entire Undo subsystem.
- **Partial migrations:** `weights`→`weight_log` (Priority 2's fix moved a write target without confirming a real reader existed for the new target).
- **Orphaned files:** Same three `pages/*.js` files as above.
- **Split ownership:** `current_weight` (3 unrelated writers, 0 of which is the dedicated weight feature); `breeding.offspring_count` vs. real `animals` records.
- **Inconsistent storage:** vaccination/medication/offspring data appears to ALSO exist under nested `animals/{id}/...` paths in `animal-detail.html`, parallel to the top-level `health`/`vaccinations`/`breeding` collections extensively documented elsewhere — **flagged, not investigated this engagement** (Weight Reality Audit, Phase 7 note).

---

## Section 11 — Repository Confidence Map

| Area | Confidence | Why |
|---|---|---|
| `animals.html` bulk actions | **High** | Every fix this engagement live-verified with real payload capture |
| Birth event (canonical path) | **High** | Extensively live-tested, including failure injection |
| Weight system (real, nested-path implementation) | **High** | Freshly live-verified this session |
| Sale/Death/Transfer conventions | **High** | Priority 1/BL-01/BL-02 all live-verified |
| `pages/animal_detail.js` and siblings' unreachability | **High** (not absolute) | Multi-angle audit (DOM, network, source, deployment) |
| Vaccination, Medication, Production, Inventory business logic | **Medium** | Source-proven only; no live execution this engagement |
| AI Assistant | **Low** | Zero live execution of any AI intent, ever, this engagement |
| Vercel/deployment live configuration | **Unknown** | No access to dashboard settings from this sandbox |
| Nested `animals/{id}/vaccinations`/`medications`/`offspring` paths' relationship to top-level collections | **Unknown** | Discovered but not investigated (Section 10) |

---

## Section 12 — Engineering Glossary

- **Birth:** The business event of a real-world animal giving birth, correctly represented as: one `breeding` record + one `animals` record per offspring + optional weight history.
- **Breeding:** The lineage/pregnancy-tracking record (`breeding` collection) — a distinct concept from Birth; a breeding record can exist for months before (or without) an actual birth.
- **Mark Born:** The specific UI action (`markBorn()`) that transitions a `breeding` record's status to `'born'` — **currently does not create animal records** (a confirmed gap, Product Decision pending).
- **Weight:** Ambiguous term in this codebase without qualification — see Weight History vs. Current Weight.
- **Weight History:** The real, live feature is `animals/{id}/weights`. The top-level `weight_log` collection is written to by two real code paths but has no confirmed reader, so it is **not** "the" weight history from a practical standpoint despite superficially matching the name.
- **Current Weight:** `animals.{id}.current_weight` — a cached field with three unrelated writers and no single owner; **not** synchronized with the real weight-history feature.
- **Birth Weight:** `animals.{id}.birth_weight` — set once at animal creation, distinct from ongoing weight history.
- **Activity:** The universal audit-trail write (`logActivity()` → `activity_log` collection). The intended viewer (`activity.html`) is confirmed empty.
- **Transfer:** Reassigning an animal's `barn` field.
- **Batch:** A bulk operation applied to multiple selected animals at once (`execBulk`/`execBulkDo` family).
- **Undo:** A fully-built but entirely disconnected capability — exists in code, never actually usable.
- **Fan-out:** A single user action writing to more than one location to keep related data in sync (e.g., weight creation updating both a history collection and a cached summary field) — **confirmed inconsistently applied across this codebase.**
- **Modal:** The `farm-modal` UI pattern, unified via `renderFarmModal()` (Repository 4's own refactor work).
- **Shared Flow:** A business operation intended to have one implementation reused across contexts — **an aspiration, not yet a consistent reality**, per Section 10.
- **Canonical Path:** The implementation of a business event judged, by evidence, most complete and correct — not necessarily the oldest, newest, or most centrally-located file.
- **Dead Code:** **Avoid this term without qualification.** Prefer "No execution path found," specifying exactly which mechanisms were checked (DOM, network, source, deployment) and which were not.
- **Dormant Code:** Code that is reachable/callable and would function correctly, but has no current caller or producer feeding it (e.g., the Undo system, `notifications`' stored path).
- **Source Of Truth:** A storage location with exactly one confirmed owner-writer and behavior that all real consumers agree on. **Confirmed to exist for:** `animals.status` (post-Priority-1). **Confirmed NOT to exist for:** `current_weight`, weight history as a concept generally.

---

## Section 13 — Evidence Ledger (Major Conclusions)

| Conclusion | Evidence | Level | Confidence | Remaining Unknowns | Upgrade Path |
|---|---|---|---|---|---|
| `pages/animal_detail.js` has no execution path | DOM+network (A) + source (B) + deployment config (C) | **B/C** | 90% | Vercel dashboard, stale SW | Inspect live deployment directly |
| Real weight system uses `animals/{id}/weights` | Live instrumented execution, real call stack | **A** | ~99% | Firebase security rules' effect (untestable here) | Already near-maximal |
| Sale convention unified | Live payload capture, all 3 writers | **A** | ~99% | Historical pre-fix records still exist under old convention (data migration question) | N/A — this is the ceiling |
| `breeding.offspring_count` can exceed real animal count | Live failure injection | **A** | ~99% | Frequency in real production data (no access) | N/A — mechanism is proven; only real-world incidence is unknown |
| `weight_log` has no reader | Repository-wide search | **C** | 75% | Cloud Functions, external tooling | Access Firebase Functions console (out of scope) |
| Vaccination/Medication logic is single-implementation, no duplication | Source search, prior audits | **B/C** | 80% | Never live-tested this engagement | Live-test `pages/vaccine.js`/`pages/health.js` directly |
| Nested `animals/{id}/vaccinations`/`medications` parallel the top-level collections | Source read, this session | **B** | 60% | Whether this represents real divergent data or intentional design | Dedicated reality-audit, same methodology as Weight |

---

## Section 14 — Future Engineering Rules (Evidence-Backed)

1. **Never classify a file as "dead code" from a grep alone.** This engagement proved that claim wrong once (implicitly, via the adversarial-audit process) and required DOM, network, source, and deployment-config checks to reach defensible confidence — still short of absolute proof.
2. **Never introduce a second writer to a field without first identifying its current single owner.** `current_weight`'s three-writer, zero-coordination state (Section 5) is the direct, evidenced cost of not following this.
3. **Never assume a collection name implies its logical counterpart is the one in use.** `weight_log` sounds authoritative; it is not the real system. Verify via live execution, not naming convention.
4. **Always verify a "Save" button's field-read timing relative to any `closeModal()` call in its execution path.** Three confirmed, independently-discovered bugs (BL-01/02/03) shared this exact root cause.
5. **Never trust a success toast or absence of an error as proof a multi-step operation fully completed.** Proven false twice this engagement (`markBorn`'s silent partial completion; the Birth Failure Analysis's proven partial-write scenario).
6. **When duplicating a business flow across multiple entry points, do so consciously and document the divergence immediately** — every duplicate-implementation debt item in Section 10 arose from flows built independently, at different times, without cross-referencing an existing implementation.
7. **Before marking any backlog item "Implemented," confirm the file you modified is the one that actually executes at runtime.** This exact failure occurred with BL-09 this engagement and was caught only because live verification was attempted rather than skipped.

---

**This document consolidates the evidence gathered across Repository 4 and Repository 5. It does not propose fixes, redesigns, or refactors. Every claim above carries its evidence level; claims without a stated level should be treated as INFERENCE, not FACT.**
