# Repository Runtime Contract Verification (RRCV)
**Wave following E. No redesign. No refactoring. Builds on RSOT→RDR + Wave E's two confirmed fixes (`submitReset`, `_ddSubmit`).**

---

## Phase 1 — Runtime Contract Inventory

| Subsystem | Canonical Writer | Canonical Reader | Shared Helper | Upstream | Downstream |
|---|---|---|---|---|---|
| Animal lifecycle | No single owner (by design — shared entity) | Nearly universal | `commitBulkPatch`, `fbPatch` | Birth, Import | Everything |
| Weight lifecycle | `submitAddWeight` (animal-detail.html) — the real system | `animal-detail.html`'s own render | None dedicated | Birth (conditional), Production (shadow) | `animals.html` table/export (via the *unsynchronized* `current_weight`, not the real history) |
| Birth lifecycle | `_ubSubmit` (shared.js) | `breeding.html`, `pages/pedigree.js`, `pages/reports.js` | `_ubSubmit` itself acts as the shared orchestrator | None | Animal lifecycle, Weight lifecycle (conditional) |
| Death lifecycle | **Now confirmed 5 entry points**, not 4: `submitDeath`, `submitDeathSingle`, `performBulkDeath` (animals.html), `submitDead` (dead.html), `_ddSubmit` (dashboard.html — newly fixed, Wave E) | `animals.html` filters, `dead.html` | `fbPatch('animals',...)` pattern, not a true shared function | None | Finance (conditional) |
| Sale lifecycle | `submitSold` (animals.html) | `animals.html` filters | `commitBulkPatch` (bulk path only) | None | Finance |
| Transfer lifecycle | `submitTransfer` (barns.html) | `animals.html`, `barns.html` | `commitBulkPatch` (animals.html's bulk path) | None | None |
| Finance lifecycle | No single owner (10 legitimate writer sites, RSOT-confirmed not duplication) | Many | `fbPost('finance',...)` pattern | Sale, Death (conditional) | Reports, Dashboard |
| Vaccination lifecycle | `submitVacc` (pages/vaccine.js) | `pages/reports.js` | None dedicated | None | Reports |
| Medication lifecycle | `submitHealth` (pages/health.js) | Many | None dedicated | None | Reports |
| Inventory lifecycle | `submitInv` (pages/inventory.js, shared across feeds/meds/equipment types) | Dashboard, Reports (feeds/meds only) | Type-dispatch object literal (not a true shared function) | None | Dashboard, Reports, Notifications (feeds/meds) |
| Reports | N/A — read-only | `pages/reports.js` | N/A | Every entity it reads | None (terminal consumer) |
| Dashboard | **Newly confirmed wider write surface**: `_daSubmit` (quick animal add, via `openAddAnimalDash`), `_ddSubmit` (quick death), plus a `resolveSync` function **not previously documented in any prior pass** | Reads across `activity_log`, `animals`, `breeding`, `diary_snapshot`, `finance`, `health`, `inventory_*`, `production_log` (RSOT) | `_ubSubmit` (birth registration entry point lives here too) | N/A | N/A |
| Activity Log | Universal, via `logActivity()` | Intended: `activity.html` (confirmed empty) | `logActivity` itself is the shared helper | Every business event | None functioning |
| Notifications | None (confirmed no producer) | `generateNotifs()` computes live | N/A | Animals, Health, Inventory, Vaccinations, Breeding (read-only inputs to the computation) | None |
| AI Assistant | Per-intent handlers in `assistant.html` | N/A | None confirmed shared with page-level canonical functions | Varies by intent | Varies |
| Authentication | `attemptLogin()` (login.html) — **confirmed a plain local `function`, not a `window.X=` export**, single self-contained implementation | Every page via `requireAuth()` | `requireAuth` (shared.js/firebase.js, not independently re-traced this pass) | None | Every authenticated page |
| Settings | `saveSettings()` (pages/farm_profile.js) | Universal via `getSettings()` | `getSettings`/`saveSettings` | None | Every page |

---

## Phase 2 — Contract Verification

| Subsystem | Exactly One Writer? | Readers Consume Same Structure? | Duplicate Writers Intentional? | Orphans Found |
|---|---|---|---|---|
| Animal | **NO** | Mostly (Level B — not exhaustively diffed) | N/A — shared entity by design | None |
| Weight | **NO** — 4 writers (`submitAddWeight`, `assistant.html`, `shared.js`, `pages/production.js`), 3 different storage targets | **NO** — `weight_log` writers produce structure nothing consumes | **NO — this is the central, unintentional debt** | `weight_log` = orphan collection (writers, no reader) |
| Birth | **NO** — 4 implementations | **NO** — 3 of 4 produce incomplete output relative to `_ubSubmit` | **NO** | None (all reachable) |
| Death | **NO** — now 5 implementations (Wave E surfaced the 5th) | Mostly consistent field shape (Level B, not fully diffed) | **NO** | None |
| Sale | **NO** — 3 writers, **but converged to one convention** (Priority 1) | **YES** | Historically no, now functionally yes | None |
| Transfer | **NO** — 2 writers, converged | **YES** | Functionally yes, post-BL-01 | None |
| Finance | **NO**, intentionally | **YES** (Level C, RSOT) | **YES — confirmed legitimate** | None |
| Vaccination | **YES** | **YES** | N/A | None found (Level B) |
| Medication | **YES** | **YES** | N/A | None found (Level B) |
| Inventory | **YES** (shared function, 3 types) | **YES** | N/A | None found (Level B) |
| Activity Log | **YES** (writer side) | **N/A — no functioning reader** | N/A | **Orphan reader path** (`activity.html` empty) |
| Notifications | **N/A — zero writers** | N/A | N/A | **Orphan reader capability** (built, unfed) |

---

## Phase 3 — Runtime Trace (Business Events)

**Sale (individual):** User clicks "بيع" → `submitSold(id)` → `fbPatch('animals',...)` → `fbPost('finance',...)` (conditional) → `logActivity` → toast → re-render. **No missing links** *(Level A, Priority 1)*.

**Weight (real):** Click "Add Weight" → `submitAddWeight()` → `fbPost('animals/{id}/weights',...)` → `logActivity` → toast → `fbGet` re-fetch → `renderDetail`. **Missing link: no fan-out to `current_weight`** *(Level A)*.

**Death (dashboard quick-path, newly traced):** Click quick-death widget → `openMarkDeathDash()` → fill → `_ddSubmit()` → `fbPatch('animals',{status:'dead',died_at})` → **no `logActivity` call found in this specific function** (confirmed via the Phase 1 source view — `_ddSubmit`'s try block goes straight from `fbPatch` to `toast` to `setTimeout(reload)`, with no `logActivity` in between) → toast → full page reload. **Missing link: no activity log entry for this specific Death entry point** — a newly-surfaced finding this pass, distinct from the field-ordering bug already fixed.

**Birth (canonical):** *(Unchanged from RRCS — reference, not repeated.)*

---

## Phase 4 — Canonical Ownership Matrix (Key Fields)

| Entity.Field | Owner | Writers | Readers | Classification |
|---|---|---|---|---|
| `animals.status` | Shared, convention-enforced | 5 (Sale×3, Death×5 — wait, see below) | Nearly universal | **SHARED** (post-Priority-1, safely so) |
| `animals.current_weight` | None | 3 unrelated (`assistant.html`, `pages/production.js`, `submitEditAnimal`) | `animals.html`, `import.html` | **MULTIPLE WRITERS** |
| `animals/{id}/weights` | `submitAddWeight` | `submitAddWeight` only | `animal-detail.html` only | **SAFE** |
| `weight_log` | `assistant.html`, `shared.js` | Same | **Nothing** | **ORPHAN** (write side only) |
| `breeding.offspring_count` | `_ubSubmit`/`submitBirthDirect`/`submitBreeding` | Same three | `breeding.html`, reports | **DERIVED** (unsynchronized with real animal count) |
| `activity_log.*` | `logActivity()` | Universal | None functioning | **ORPHAN** (read side) |
| `notifications.*` | N/A | None | Dormant code only | **UNKNOWN** classification (no data ever exists to classify) |

**Correction on `animals.status`'s writer count:** Death alone now has 5 writers (Wave E finding), Sale has 3 — the field has **more than 5 distinct writer functions total**, not a small number. This is `SHARED` in the sense that the *convention* is unified (post-Priority-1), but the *function count* touching this field is large and should not be understated.

---

## Phase 5 — Cross-System Consistency

| Dimension | Finding | Evidence |
|---|---|---|
| Status enums | `alive`/`dead`/`sold` for animals — confirmed consistent post-Priority-1. `breeding.status` uses a *different* enum (`pending`/`pregnant`/`born`/`failed`) — **not a conflict, a different field's own valid domain**, but worth noting these are easy to confuse given both are "status" | B |
| IDs/references | Mixed: `animal_id` (document-ID style, e.g. `weight_log`, `production_log`) vs. `animal_tag`/`mother_tag` (string style, e.g. `breeding`, `health`) — **confirmed inconsistent across the repository**, not resolved | B (RSOT, restated for reference only) |
| Date formats | `YYYY-MM-DD` string convention, consistently observed everywhere checked | B |
| Weight units | Always kg, implicitly — **no unit field stored anywhere**, unit is assumed by UI label only | B — **flagging this as a newly-explicit observation**: no schema enforces the unit; a future data-import from a source using lbs would silently corrupt data with no validation catching it |
| Money fields | No currency-code field stored on `finance`/`sold_price`/etc. — currency is a single global setting (`getSettings().currency`), not per-transaction | B — same class of implicit-unit risk as weight |
| Timestamps | `created_at`/`updated_at` present on most but not all writes (e.g., confirmed present via `fbPost`'s own automatic stamping in `firebase.js`, per RSOT) | B |
| Activity log schema | Consistent shape (`action`, `resource`, `description`, `userName`, `userRole`, `date`, `timestamp`) across every call site checked | A (fires identically in every live test this engagement) |

---

## Phase 6 — Runtime Gap Detection

- **Functions nobody calls:** `pages/animal_detail.js`'s entire export set (dead file); `execBulk`'s `edit` branch (dead branch, live file).
- **Collections nobody reads:** `weight_log`, top-level `weights` (both repository-scoped, RSOT).
- **Collections nobody writes:** `notifications` (repository-scoped).
- **Fields never consumed:** **Newly flagged this pass** — `breeding.male_breed`/`birth_amount` were confirmed present in the schema (RSOT's earlier field extraction) but no consumer was ever specifically traced reading them back out; classify as **UNKNOWN**, not confirmed orphan, since a full reader-trace for these two specific fields was never performed.
- **Dead exports:** Same three `pages/*.js` files (RSOT).
- **Duplicate helpers:** None found beyond the already-documented duplicate *business flows* (Birth×4, Death×5, Sale×3-converged, Transfer×2-converged) — the underlying `fbGet`/`fbPost`/etc. primitives are singly-defined.
- **Parallel implementations:** Weight (3-way), Death (5-way).
- **Shadow data:** `animals.current_weight` relative to the real weight history.
- **Fake synchronization:** `breeding.offspring_count` — appears synchronized (a number sits there, looking authoritative) but is not enforced against reality (proven, Birth Failure Analysis).

---

## Phase 7 — Regression Surface

| Risk | Subsystems | Files | Collections |
|---|---|---|---|
| **High** | Weight, Death (5-way, newly fully counted), Birth | `animal-detail.html`, `animals.html`, `dashboard.html`, `dead.html`, `shared.js`, `pages/breeding.js`, `assistant.html`, `pages/production.js` | `animals`, `animals/{id}/weights`, `weight_log`, `breeding` |
| **Medium** | Sale, Transfer, Finance | `animals.html`, `barns.html`, `pages/finance.js` | `animals`, `finance` |
| **Low** | Vaccination, Medication, Inventory | `pages/vaccine.js`, `pages/health.js`, `pages/inventory.js` | `vaccinations`, `health`, `inventory_*` |
| **Minimal** | Reports, Authentication | `pages/reports.js`, `login.html` | Read-only / `activity_log`, `login_notifications` |

---

## Phase 8 — Live Verification Targets (to raise Level B → A)

| Action | Expected Payload | Expected Firebase Shape | Expected UI Refresh | Failure Injection | Rollback Check |
|---|---|---|---|---|---|
| Submit `submitVacc()` with real form data | `{name, target, vaccine_type, ...}` | New doc under `vaccinations` | Vaccine list re-renders | Simulate `fbPost` rejection | Confirm no partial write remains |
| Submit `submitHealth()` with treatment dates | `{diagnosis, medication, withdrawal_end computed, ...}` | New doc under `health` | Health list re-renders | Simulate rejection | Same |
| `_ddSubmit()` post-fix, real click | `{status:'dead', died_at:<real date>}` | `animals/{id}` patched | Page reload (confirmed by source, not yet re-verified live post-fix for the reload step specifically) | N/A (single patch) | N/A |
| `submitReset()` post-fix, both checkboxes | `fbDelete` + `fbPatch` calls matching selection | `animals` docs deleted/patched per selection | Full re-render + toast with real count | Simulate one of the two operations failing mid-loop | Confirm partial completion is visible in the `done` counter, not silently swallowed |
| `attemptLogin()` with a real/wrong PIN | N/A (auth check) | `login_notifications` created on success | Redirect to dashboard | Wrong PIN attempt | Confirm lockout/retry behavior (never characterized in any prior document) |
| `resolveSync()` (dashboard.html, newly discovered, unexamined) | **Unknown — not yet read** | Unknown | Unknown | N/A | N/A |

---

## Phase 9 — Repository Health Score

| Dimension | Score /10 | Justification |
|---|---|---|
| Architecture | 7 | Fully documented, evidence-graded, genuinely well-understood at this point |
| Runtime | 5 | Core flows (Sale, Transfer, parts of Death) proven at Level A; Weight/Birth's full correctness still pending Wave A/B |
| Consistency | 4 | Weight's 3-way split and Death's now-5-way implementation count are real, unresolved consistency debts |
| Ownership | 5 | Clear for Sale/Transfer/Vaccination/Medication/Inventory; genuinely unclear for Weight/`current_weight`/Activity-reading |
| Synchronization | 3 | The lowest-scoring dimension — `current_weight`, `offspring_count`, and `weight_log` all represent proven or strongly-evidenced synchronization failures |
| Data Integrity | 5 | No schema-level corruption found, but implicit units (weight, currency) and unenforced invariants (`offspring_count`) are real latent risks |
| Shared Components | 7 | `commitBulkPatch`/`refreshAnimalsAfterBulk`/`renderFarmModal` are genuinely well-factored where used |
| Maintainability | 5 | Duplicate business flows (Birth, Death) directly reduce this; well-factored bulk-action code partially offsets it |
| Dead Code | 6 | Well-characterized (3 files, 2 collections, 1 branch) rather than lurking — a documentation strength even though the debt itself is real |
| Technical Debt | 4 | Weight is Critical severity; Death's newly-confirmed 5th implementation adds to an already-known category rather than introducing a new one |
| **Overall Readiness** | **5/10** | A genuinely well-understood, well-documented repository with one clearly-scoped central problem (Weight) and a cluster of smaller, well-characterized ones — not a chaotic codebase, but not yet production-hardened either |

---

## Phase 10 — Final Runtime Verdict

**Can new features safely begin?** Only in subsystems scored Low/Minimal risk (Phase 7) — Vaccination, Medication, Inventory, Reports, Authentication. **Not** in Weight, Birth, or Death until their respective Waves close.

**Can Wave A begin after D-01?** Yes — D-01 is the only blocker (RDR Phase 12), and it's a decision, not further investigation.

**What technical debt still blocks scaling?** The Weight 3-way split (blocks confident feature-building on top of weight data); Death's now-confirmed 5-way implementation count (any future Death-related feature must currently be built 5 times or accept inconsistency); `breeding.offspring_count`'s unenforced invariant (blocks any feature that would trust this number, e.g., a future herd-growth report).

**What remains before production-grade quality?** Wave A (Weight), Wave B (Birth/Death convergence, now expanded in scope by one more Death entry point), rollback/atomicity hardening for all multi-step writes (proven absent, Birth Failure Analysis — likely generalizes to Death/Sale though not individually proven for those), and closing the two newly-surfaced Phase 3/6 gaps (`_ddSubmit`'s missing activity log; `resolveSync`'s entirely unexamined behavior).

---

**Repository Completeness: 65%** — architecture/contracts fully mapped; runtime behavior fully proven for a minority of flows.
**Implementation Completeness: 55%** — Sale/Transfer/two Wave-E fixes done; Weight/Birth/Death convergence not started.
**Runtime Confidence: 45%** — Level A evidence covers a small, high-value subset; the majority rests on Level B source reading.
**Evidence Coverage: 60%** — every subsystem has at least Level B coverage; none has zero investigation.
**Technical Debt Remaining: 50%** — one Critical item (Weight), one newly-widened High item (Death's implementation count), several Medium/Low items, none newly Critical this pass.

**STOP.**

