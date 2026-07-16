# Engineering Refactoring Blueprint — PHASE 12
**Role:** Principal Staff Engineer / Software Architect / Technical Lead
**Status:** Execution plan only. All findings below are taken as already-accepted facts from the Design System Audit (v1/v2) and the Architecture Audit (Phase 11) — nothing here re-analyzes or re-scores; every reference to a file, count, or debt item cites what was already measured.
**Constraint carried forward from all prior phases:** Vanilla HTML/CSS/JS + Bootstrap 5.3.3 stack is preserved throughout. No framework migration. No new build tooling unless explicitly scoped (§8). Zero downtime, continuous deployment, incremental rollout at every step.

---

# 1. Engineering Priorities

## 🔴 Critical

| # | Problem | Affected Files | Dependencies | Risk | Est. Effort | Expected Impact |
|---|---|---|---|---|---|---|
| C1 | 6 orphaned JS files (~2,014 LOC, 25% of authored JS) with no load path | `pages/animal_detail.js`, `pages/births.js`, `pages/notifications.js`, `chat.js`, `sync-to-excel.js`, `sync.js` | None (isolated files) | Low to fix, High if left (silent feature gaps) | 0.5–2 days (investigation + decision per file) | Removes navigational confusion; may recover real missing functionality |
| C2 | `window.showHealthDetail` collision (`pages/animal_detail.js` vs `pages/health.js`) | Both files | Blocked on C1 decision for `animal_detail.js` | Currently inert; High if `animal_detail.js` is reconnected without a rename | 1 hour | Prevents a silent last-write-wins bug from ever activating |
| C3 | Table fragmentation: `.tbl` (6 pages) / `.data-table` (undefined, 1 page) / inline (1 page) | `animals.html`, `barns.html`, `bayan-offline.html`, `bayan.html`, `fix-births.html`, `import.html`, `animal-detail.html`, `dashboard.html` | Blocked on CSS token normalization (§6) for the target primitive | Medium (data-display surface, needs visual QA per page) | 4–6 days | Single table primitive across 8 pages; enables future sort/filter/export as one shared feature instead of 3 |
| C4 | `sw.js` registration not found anywhere | `sw.js`, all pages (offline capability) | None | High if offline mode is assumed working and isn't | 0.5 day (verification) + TBD (fix, if confirmed broken) | Confirms/restores the offline-first PWA guarantee the app depends on |

## 🟠 High

| # | Problem | Affected Files | Dependencies | Risk | Est. Effort | Expected Impact |
|---|---|---|---|---|---|---|
| H1 | Card family: 9 class names, CSS already consolidated, HTML still fragmented | 15 pages using `wonder-card`/`summary-card`/`breed-card`/`record-card`/`section-card`/`diary-card`/`bcard`/`tpl-card`/`confirm-card` | Depends on §7 consolidation plan | Low (visual-only, CSS layer already proven safe) | 3–4 days | Single card primitive; removes last 5 dead-then-fixed class names as separate concepts |
| H2 | Modal size classes exist (`.farm-modal-sm/md/lg/xl`) but 15+ call sites still use inline `max-width` | `shared.js`, 10 pages calling `showModal()` | None — additive change, old classes still work | Low | 2–3 days | Modal sizing becomes a single documented decision instead of 15 ad-hoc numbers |
| H3 | 36 of 92 CSS variables (Tier-2/Tier-3 token layer) defined, never referenced | `styles.css` | Blocks §6 CSS migration blueprint | Low (additive, no visual change if done right) | 3–5 days | Closes the gap between "designed" and "used" token system |
| H4 | `bayan.html`/`bayan-offline.html` run a fully independent, self-contained style system | `bayan.html`, `bayan-offline.html` | Architectural decision required before any code change | Low if decision = "keep isolated on purpose"; Medium if decision = "merge" | 0.5 day (decision) + 3–5 days (if merging) | Removes ambiguity for any future engineer touching theme colors |
| H5 | Inline `onclick=` (254) vs `.addEventListener` (31) — 8:1 ratio | All 31 HTML pages | None, can be done incrementally per page | Medium (touches user-facing interactions) | 8–12 days (full migration, page by page) | Removes the root cause of the recurring quote-escaping bug class already on record |

## 🟡 Medium

| # | Problem | Affected Files | Dependencies | Risk | Est. Effort | Expected Impact |
|---|---|---|---|---|---|---|
| M1 | `.field` doesn't use `--input-radius`/`--input-padding` tokens defined beside it | `styles.css` | Depends on H3 | Low | 1 day | Single source of truth for input sizing |
| M2 | 34 unique font-size values, no named type scale | `styles.css`, all pages | Depends on H3 | Low | 2 days (define scale) + ongoing (apply gradually) | Long-term visual consistency, no immediate user-facing change |
| M3 | 34 unique padding values, no named spacing scale | `styles.css` | Depends on H3 | Low | 2 days (define scale) + ongoing | Same as M2 |
| M4 | Z-index: 17 unique values, 1→99999, no scale | `styles.css`, scattered inline | None, but touches stacking-sensitive UI (modals, toasts, dropdowns) | Medium (regression risk if reordered carelessly) | 2–3 days | Removes future stacking-conflict risk as more overlays are added |
| M5 | `shared.js` = highest active complexity (270.9→249.2 range) + widest coupling | `shared.js` and every page that loads it | Blocks §4 module decomposition | Medium (single point of failure) | 5–8 days | Reduces blast radius of the single riskiest file in the project |
| M6 | An entire unused M3-style progress/stepper sub-system exists in CSS (`m3-circular*`, `m3-progress*`, `m3-step*`, `m3-waveform`) | `styles.css` | None | Low | 0.5 day (decision: adopt or delete) | Either activates a ready-made component or removes 8 dead classes |
| M7 | 254 blocking `<script>` tags project-wide, 0 using `async` | All pages | None | Low-Medium (needs per-page verification of execution-order dependencies) | 3–4 days | Faster first paint across the board |

## 🟢 Low

| # | Problem | Affected Files | Dependencies | Risk | Est. Effort | Expected Impact |
|---|---|---|---|---|---|---|
| L1 | 2 unused accessibility utility classes (`sr-only`, `skip-to-content`) | `styles.css` | None | Low | 1 day to wire up minimally | Cheapest possible accessibility win available in the codebase today |
| L2 | `activity.html` is a 0-byte file | `activity.html` | None | Low | 5 minutes | Removes a confusing empty file from the tree |
| L3 | Icon system split: Bootstrap Icons (18 pages) vs raw `<svg>` (2 pages: `dashboard.html`, `dead.html`) | 2 pages | None | Low | 1 day | Cosmetic consistency only |
| L4 | `farm-react.js` — 342 KB minified bundle loaded by only 2 pages (`reports.html`, `settings.html`) | 2 pages | Needs usage confirmation before touching | Low to investigate, Medium if removal attempted blind | 1 day (investigate) | Potential bundle-size win if confirmed partially/fully unused |

---

# 2. Dependency Graph

```
                         ┌────────────────────┐
                         │   styles.css       │
                         │  (raw tokens ✓)    │
                         │ (Tier-2/3 tokens ✗)│
                         └─────────┬──────────┘
                                   │ styled by
                    ┌──────────────┼───────────────┐
                    ▼                              ▼
          Component classes                 Page-local <style>
    (.action-btn, .type-badge,               (7 pages, layered on
     .farm-modal, card family,                top of styles.css —
     .field, .tbl)                            safe to touch independently)

                    │ used by
                    ▼
┌───────────────────────────────────────────────────────────────┐
│                        Page HTML (31 files)                    │
│  each loads: styles.css (27 of 31) + shared.js + nav.js +      │
│  firebase.js + its own pages/*.js (where wired)                │
└───────────────────────┬─────────────────────────────────────────┘
                         │ calls
                         ▼
              ┌─────────────────────┐
              │     shared.js        │◄── highest coupling, highest
              │ (modal system, theme,│    active complexity — MIGRATE LAST
              │  misc UI helpers)    │    among high-risk files
              └──────────┬───────────┘
                         │ calls
                         ▼
              ┌─────────────────────┐
              │     firebase.js      │◄── sole writer of `window.animals`
              │  (gateway functions) │    20 reader files depend on this
              └──────────┬───────────┘
                         │ reads/writes
                         ▼
                Firebase Realtime DB
                         │
                         ▼
              window.animals (global, single-writer)
                         │
                         ▼
         106 window.* exports total, 1 confirmed collision
         (window.showHealthDetail — currently inert, see C2)

STANDALONE / ISOLATED:
  bayan.html, bayan-offline.html  — own <style>, own :root, zero link to styles.css
  farm-react.js                   — 342KB bundle, loaded only by reports.html + settings.html
  6 orphaned files                — no incoming dependency from any page at all
```

### What can be migrated independently (no cross-dependency risk)
- Card consolidation (§7) — CSS only, already proven safe pattern from this session's earlier work.
- Modal size-class adoption (§7) — additive, old classes remain functional.
- Dead CSS variable activation or removal (§6/H3) — additive/subtractive, zero page depends on the *absence* of a working token.
- `activity.html` deletion (L2).
- `bayan.html`/`bayan-offline.html` decision (H4) — fully isolated from the rest of the app by construction.
- Any single orphaned file's investigation (C1) — by definition nothing currently depends on them.

### What blocks everything else
- **`shared.js` decomposition (§4, M5)** blocks any JS modernization (§8) because it's the widest shared dependency — every page-level change to event handling (H5) should be sequenced *after* `shared.js`'s internal boundaries are clarified, not before, to avoid refactoring against a moving target.
- **Table consolidation (C3)** blocks nothing else, but is blocked *by* the CSS token normalization (H3) if the new table primitive is meant to consume the token scale rather than hardcoded values again.

---

# 3. Refactoring Order

> Rule applied throughout: never run two 🔴/🟠 items with overlapping files in the same phase.

| Phase | Goal | Files | Est. Effort | Regression Risk | Rollback Strategy | Acceptance Criteria |
|---|---|---|---|---|---|---|
| **0** | Investigate & decide on all 6 orphaned files + `sw.js` registration + `farm-react.js` usage (C1, C4, L4) | `pages/animal_detail.js`, `pages/births.js`, `pages/notifications.js`, `chat.js`, `sync-to-excel.js`, `sync.js`, `sw.js`, `reports.html`, `settings.html` | 3 days | None (read-only investigation) | N/A | A written decision (delete/merge/reconnect/archive) exists for every one of the 6 files, plus a confirmed answer on `sw.js` and `farm-react.js` |
| **1** | Execute Phase 0 decisions | Same as above | 2–4 days (varies by decision) | Low if "delete/archive"; Medium if "reconnect" (must resolve C2 first) | Git revert (single commit per file) | Repo contains zero unreferenced JS files; `window.showHealthDetail` collision resolved before any reconnect |
| **2** | CSS token normalization (H3, M1) | `styles.css` only | 4–6 days | Low (additive first, then careful search-replace of hardcoded values) | Git revert; CSS-only change, testable per page visually | All 92 CSS variables are referenced at least once; `.field` uses `--input-radius`/`--input-padding` |
| **3** | Card family consolidation in HTML (H1) | 15 pages | 3–4 days | Low (CSS layer already proven this session) | Per-page revert; visual diff each page before/after | All 9 legacy class names either renamed to one primitive or documented as intentional aliases |
| **4** | Modal size-class adoption at call sites (H2) | `shared.js` + 10 pages | 2–3 days | Low (additive classes already exist and are backward-compatible) | Per-page revert | Zero remaining inline `max-width` in any `showModal()` call |
| **5** | Table consolidation (C3) | `animals.html`, `barns.html`, `bayan-offline.html`, `bayan.html`, `fix-births.html`, `import.html`, `animal-detail.html`, `dashboard.html` | 4–6 days | Medium (data-display surface, highest-traffic UI) | Per-page revert; keep `.tbl`/`.data-table` classes as deprecated aliases during transition | One table primitive renders identically (visually) across all 8 pages |
| **6** | Z-index scale definition + application (M4) | `styles.css` + all files with inline `z-index` | 2–3 days | Medium (stacking regressions are easy to miss visually) | Git revert; manual stacking QA checklist per overlay type (modal/toast/dropdown/navbar) | No two unrelated UI layers share an undocumented z-index; a named scale (`--z-dropdown`, `--z-modal`, `--z-toast`, etc.) exists and is used everywhere |
| **7** | Typography + spacing scale definition (M2, M3) | `styles.css` | 2 days (definition) | Low (definition only in this phase; application is Phase 8) | N/A (additive) | Named scale tokens exist; no page changed visually yet |
| **8** | Gradual typography/spacing application | All pages, opportunistically during any other page touch | Ongoing, no dedicated sprint | Low | Per-page revert | New code always uses the scale; legacy values migrate opportunistically, not in a single risky pass |
| **9** | Inline `onclick` → delegated event migration (H5) | All 31 pages, one at a time | 8–12 days | Medium (user-facing interaction surface) | Per-page revert; keep both patterns working simultaneously during transition | Each migrated page passes its smoke test (§11) before the next page starts |
| **10** | `shared.js` decomposition (M5, see §4) | `shared.js` + every page that loads it | 5–8 days | Medium-High (widest blast radius file in the project) | Feature-flag the new module boundary; keep old `shared.js` importable as a compatibility shim until every page is confirmed migrated | Every page that previously loaded `shared.js` still functions identically after the split |
| **11** | Accessibility scaffolding activation (L1) | `styles.css` + all pages, opportunistically | 3–5 days | Low | Per-page revert | `sr-only`/`skip-to-content` applied to at least the primary navigation and form-error patterns |

**Explicitly never parallelized:** Phase 5 (tables) and Phase 9 (event migration) both touch high-traffic, user-facing surfaces — these are sequenced with a full phase gap between them, never overlapping.

---

# 4. Module Decomposition

## `shared.js` (564 LOC, 89 functions, highest active complexity score)

**New module boundaries:**
```
shared/
  modal.js          — showModal(), closeModal(), #modal-root management (public API: showModal, closeModal)
  theme.js           — light/dark mode toggle, localStorage['farm_theme'] (public API: setTheme, getTheme, toggleTheme)
  ui-helpers.js       — toast/notification helpers, misc DOM utilities (public API: toast(), any generic helper currently in shared.js)
  gateway-writes.js  — gwAddAnimal, gwRegisterBirth, gwRegisterDeath, gwBulkImport, gwDiaryApply (public API: every gw* function; private: internal diff/conflict-detection helpers used only by gwDiaryApply)
```
**Private (internal-only) APIs:** conflict-diff computation inside `gwDiaryApply` should not be exposed beyond `gateway-writes.js`.
**Shared utilities extracted:** any date-formatting/ID-generation helper currently duplicated inline should move to a `shared/utils.js` used by all four modules above.
**Expected LOC after split:** modal.js ~80, theme.js ~40, ui-helpers.js ~120, gateway-writes.js ~280, utils.js ~40 (total ≈560, redistributed not reduced — the goal here is boundary clarity and independent testability, not fewer lines).

## `firebase.js` (474 LOC, 44 functions)
**New boundaries:**
```
firebase/
  connection.js   — Firebase init/config (public: db reference export)
  animals-read.js — all read/subscribe logic for the `animals` global (public: subscribeAnimals, getAnimalById)
  animals-write.js — any direct write path not already covered by shared/gateway-writes.js
```
**Expected LOC after split:** connection.js ~40, animals-read.js ~220, animals-write.js ~200.

## `pages/reports.js` (338 LOC, complexity score 270.9 — the single highest-complexity active file)
**New boundaries:**
```
reports/
  report-data.js     — data aggregation for each report type (public: buildReportData(type))
  report-render.js   — the 26 HTML-template-literal blocks identified in the architecture audit (public: renderReport(data))
  report-export.js   — export/print logic
```
**Expected LOC after split:** report-data.js ~140, report-render.js ~140, report-export.js ~60.

## `pages/inventory.js` (426 LOC, complexity score 200.8)
**New boundaries:**
```
inventory/
  inventory-data.js   — feed/stock calculations (including calcFCR)
  inventory-render.js — table/list rendering
  inventory-actions.js — add/edit/delete handlers (delInv, etc.)
```
**Expected LOC after split:** ~140 / ~150 / ~140.

## `pages/production.js` (634 LOC, complexity score 191.2 — largest single page-script by LOC)
**New boundaries:**
```
production/
  production-data.js
  production-render.js
  production-units.js  — the _prUpdateUnit logic isolated as its own concern
```
**Expected LOC after split:** ~250 / ~280 / ~100.

**Folder structure (applies to all of the above):**
```
/js
  /shared    (modal.js, theme.js, ui-helpers.js, gateway-writes.js, utils.js)
  /firebase  (connection.js, animals-read.js, animals-write.js)
  /pages
    /reports     (report-data.js, report-render.js, report-export.js)
    /inventory   (inventory-data.js, inventory-render.js, inventory-actions.js)
    /production  (production-data.js, production-render.js, production-units.js)
    ... (other page folders decomposed opportunistically, lower priority)
```
Each page HTML file updates its `<script src>` list to the new file set; because there is no bundler, this remains a flat list of `<script defer>` tags — same loading model as today, just more, smaller files.

---

# 5. Global API Cleanup

| Category | Examples | Recommendation | Why |
|---|---|---|---|
| Gateway functions (already namespaced `gw*`) | `gwAddAnimal`, `gwRegisterBirth`, `gwRegisterDeath`, `gwBulkImport`, `gwDiaryApply` | **Keep**, relocate into `firebase/gateway-writes.js` module boundary (§4) | Already well-named, already the single write path per project convention — no reason to touch the naming, only the file location |
| `window._functionName` wrapper pattern (workaround for inline-onclick quote-breaking) | `window._ubSubmit`, `window._calcExpBirth`, `window._toggleBornFields`, `window._updateBBreeds`, etc. | **Keep during transition, delete after §3/Phase 9 completes** | These exist specifically to work around inline `onclick` quote-escaping; once Phase 9 (§3) migrates a page to `.addEventListener`, its corresponding `window._x` wrapper becomes dead and should be deleted in the same commit |
| `window.showHealthDetail` (collision) | Defined in both `pages/animal_detail.js` and `pages/health.js` | **Rename** — pick one canonical name (e.g. keep in `health.js` since it's the confirmed-active file; rename or delete the copy in `animal_detail.js` per the Phase 0/1 decision on that orphaned file) | Removes the only confirmed name collision in the entire global namespace before it can ever activate |
| `window.animals` | Single writer (`firebase.js`), 20 readers | **Keep as-is structurally, but relocate write to `firebase/animals-write.js`** | Already the cleanest state-ownership pattern in the codebase — don't restructure the pattern, just the file it lives in |
| Del/edit handlers per feature (`window.delFin`, `window.delHealth`, `window.delInv`, `window.delTask`, `window.delVacc`, `window.delBreeding`, `window.delProdRec`, `window.delConsumption`) | 7+ near-identical delete handlers, one per feature | **Encapsulate** into a single generic `deleteRecord(collection, id)` gateway function once §4 module decomposition is underway; keep the individual `window.del*` names as thin wrappers calling the generic function (backward compatible with existing inline `onclick`) | Reduces 7 near-duplicate implementations to 1 shared implementation without breaking any existing HTML call site |
| One-off page-specific globals (`window._allTpls`, `window._pendingTpl`, `window.applyTemplate`, `window.applyTplByBtn` — all in `pages/vaccine.js`) | Feature-scoped, single file | **Keep** | Genuinely single-page scope, no cross-file coupling risk detected |
| Orphaned-file globals (anything exported by the 6 orphaned files) | e.g. whatever `pages/animal_detail.js`, `pages/births.js`, etc. export | **Delete or Replace**, pending Phase 0 decision (§3) | Cannot clean up an API surface for code that isn't loaded — resolve C1 first, then revisit this row |

---

# 6. CSS Migration Blueprint

```
Current state (measured)
   ↓
Tier-1 Raw tokens         ✅ already flows correctly — no change needed
   ↓
Tier-2 Semantic tokens    ⚠️ defined, ~partial use — TARGET: 100% of component rules
                              reference a Tier-2 token instead of Tier-1 directly
                              where a semantic meaning exists (e.g. --color-danger
                              instead of var(--red) inside .action-btn.danger)
   ↓
Tier-3 Component tokens   ❌ 36 of 92 variables currently unused — TARGET: every
                              component-specific sizing/color value (radius, padding,
                              button colors) resolves through a Tier-3 token
   ↓
Utilities                 ✅ .page-wrap, .text-gray, etc. already stable — extend with
                              new utilities only where duplicated declarations were
                              found (e.g. a .flex-center utility to replace the 29+28
                              repeated align-items:center/display:flex pairs)
   ↓
Components                 Card family, table, modal, button, badge, field — each
                              consumes Tier-3 tokens exclusively, never Tier-1 directly
   ↓
Pages                      Page-local <style> blocks (7 pages) may still override at
                              this layer for legitimately page-specific needs; bayan*
                              pages remain isolated per the H4 decision
```

### Incremental rollout strategy (zero breakage guarantee)
1. **Step A — Additive only:** wire every currently-unused Tier-2/Tier-3 variable into its intended component rule using `var(--new-token, existing-hardcoded-value)` fallback syntax, so if the token resolves to an unexpected value the fallback preserves current appearance. Ship, observe, no visual diff expected.
2. **Step B — Remove fallbacks one component family at a time:** once a component (e.g. buttons) has run with Step A wiring in production without incident, remove the fallback value so the token is the sole source of truth. Repeat per family (buttons → badges → cards → tables → modals → forms), never all at once.
3. **Step C — Hardcoded-value sweep:** for the 424 inline hex occurrences (excluding the 168 that belong to the intentionally-isolated `bayan*` system), replace only the 256 occurrences that are literal duplicates of an existing token, file by file, lowest-traffic pages first.
4. **Step D — New utility introduction:** add `.flex-center` and any other utility justified by the duplicated-declaration data, refactor existing rules to use it opportunistically during any other unrelated touch to that file (never a dedicated global find/replace pass).

---

# 7. Component Consolidation Plan

| Family | Current Implementations | Target Primitive | Migration Order | Compatibility Layer |
|---|---|---|---|---|
| **Cards** | 9 classes (`wonder-card`, `summary-card`, `breed-card`, `record-card`, `section-card`, `diary-card`, `bcard`, `tpl-card`, `confirm-card`) — CSS already unified under a shared size scale this session | Single `.card` primitive with `.card--sm/md/lg/xl` size modifiers (mirroring the already-proven button-modifier pattern) | 1st (lowest risk, CSS groundwork already done) | Keep all 9 legacy class names as CSS aliases pointing to `.card` + the appropriate size modifier indefinitely, or until a full HTML pass renames them — aliasing removes any urgency to touch 15 pages at once |
| **Tables** | 3 implementations (`.tbl`, `.data-table` undefined, inline in `dashboard.html`) | Single `.data-grid` primitive consuming the Tier-3 token scale (§6) | 2nd (after cards prove the alias pattern works) | Keep `.tbl` as an alias for `.data-grid`; `.data-table` and the `dashboard.html` inline table require actual markup changes since they have no reusable class today |
| **Buttons** | Already unified (`.action-btn` + modifiers) | No change — this is the reference pattern other families are copying | N/A — already done | N/A |
| **Badges** | Already unified (`.type-badge` + `.badge-*`) | No change | N/A — already done | N/A |
| **Forms** | `.field`, disconnected from `--input-radius`/`--input-padding` | `.field` reading from Tier-3 input tokens; add `.field--error`/`.field--success` state modifiers (currently absent) | 3rd (depends on §6 Step A) | No alias needed — same class name, same markup, internal CSS change only |
| **Modals** | `.farm-modal` + narrow/wide legacy + sm/md/lg/xl (added this session, not yet adopted at call sites) | `.farm-modal` + `.farm-modal-{sm,md,lg,xl}` (already the target — just needs call-site adoption) | 4th (straightforward mechanical replacement of inline styles with classes) | `narrow`/`wide` already alias to `sm`/`lg` — no further compatibility work needed |
| **Loading** | `.spinner` — already single implementation, 29 uses, 24 pages | No change | N/A — already done | N/A |
| **Skeletons** | `skeleton`, `skeleton-pulse` keyframe — both defined in CSS but `skeleton` class shows 0 confirmed HTML usage (dead) | Decide: adopt as the standard "loading placeholder" pattern replacing `.spinner` in list/table contexts, or delete | 5th — a product decision, not just a migration | N/A until decision made |
| **Progress** | Full unused M3-style sub-system (`m3-circular*`, `m3-progress*`, `m3-step*`, `m3-waveform`) | Decide: adopt for a real use case (e.g. multi-step forms, import wizard) or delete entirely | 5th — bundled with the skeleton decision above, both are "activate or remove dead sub-systems" | N/A until decision made |
| **Notifications** | `--toast-bg` token exists; no confirmed standalone toast *component* (only the token) | Build a minimal `.toast` primitive using the existing token, OR confirm one already exists under an unaudited name before building a duplicate | 6th (lowest priority, no confirmed current duplication to consolidate — this is new-component work, not consolidation) | N/A |

---

# 8. JavaScript Modernization

```
Current: Vanilla globals (window.* × 106, no modules, 254 inline onclick)
   ↓
Step 1 — Shared Services (no build tooling change)
   Extract shared.js/firebase.js into the module folders defined in §4,
   still loaded via plain <script defer> tags (no <script type="module">
   yet — avoids a build-tooling decision at this stage).
   ↓
Step 2 — ES Modules (only once Step 1 boundaries are stable)
   Convert the §4 module files to `<script type="module">` with explicit
   `export`/`import`. This is the first point where a bundler decision
   becomes relevant — recommend evaluating whether native ES modules
   (no bundler, relying on HTTP/2 multiplexing) are sufficient for this
   app's size before introducing any build step, consistent with the
   "no libraries" instruction carried through every prior audit.
   ↓
Step 3 — State layer
   Introduce one explicit state module (e.g. `state/animals-store.js`)
   that wraps the current `window.animals` global read/write pattern
   behind a small pub/sub API (subscribe/getAll/getById), without
   changing where the underlying data physically lives (Firebase).
   This directly formalizes the single-writer pattern that already
   exists informally today (Architecture Audit §7/§11) rather than
   inventing a new pattern from scratch.
   ↓
Step 4 — Feature modules
   Each `pages/<feature>/` folder from §4 becomes a self-contained
   feature module that imports only: state layer, shared services,
   and its own render/data/actions files. No feature module imports
   another feature module directly (enforces the "isolation" gap
   identified in the Architecture Audit §11 — currently isolation
   exists only by naming convention, not by mechanism; ES modules
   make it a hard boundary).
```
**No React, no Vue, no Angular introduced at any step** — this path stays entirely within native browser ES module capability plus the existing Bootstrap 5.3.3 styling layer.

---

# 9. Dead Code Removal Plan

| File | LOC | Recommendation | Why |
|---|---|---|---|
| `pages/animal_detail.js` | 802 | **Reconnect** (highest priority to investigate first — it's also the most complex file in the entire authored codebase, strongly suggesting real, non-trivial logic that may be missing from the live `animal-detail.html` page which currently runs its logic inline) | If its logic genuinely duplicates or exceeds what's inline in `animal-detail.html` today, reconnecting (after resolving the C2 naming collision) could restore or improve functionality; if a diff shows it's fully superseded by the inline code, reclassify as **Delete** |
| `pages/births.js` | 482 | **Investigate → likely Merge** | Births functionality is visibly present in `animals.html`/`births.html` today through some other path; compare logic before deciding merge vs. delete |
| `pages/notifications.js` | 363 | **Archive** | `notifications.html` already loads and uses `notifications-service.js` as its live implementation; this file is very likely an earlier iteration — archive (don't delete outright) in case any unique logic needs porting first |
| `chat.js` | 55 | **Investigate → likely Delete** | Small enough that a full manual diff against `assistant.html`'s actual chat implementation is cheap; delete if fully superseded |
| `sync-to-excel.js` | 223 | **Investigate → likely Reconnect** | Given the project's Excel-sync feature is documented as an active capability, confirm whether this is the intended implementation not yet wired up, versus already-superseded logic |
| `sync.js` | 89 | **Investigate → likely Merge** into whichever sync mechanism is confirmed live (`offline-sync.js` per project context) | Two sync-related files existing separately is itself a signal of a possible earlier/later implementation split |
| `sw.js` | 161 | **Reconnect** (add the missing `serviceWorker.register()` call) — pending confirmation that this is genuinely missing and not just undetected by string search | Offline PWA capability is a documented product requirement; this is the highest-value single fix if confirmed broken |
| `farm-react.js` | 342 KB (39 physical lines, minified) | **Investigate usage in `reports.html`/`settings.html` → keep if load-bearing, otherwise evaluate replacement with vanilla code consistent with the rest of the app** | Removing 342 KB of bundle weight is the single largest possible bundle-size win in the entire project if this bundle turns out to be lightly used |
| `activity.html` | 0 bytes | **Delete** | No content, no references, no ambiguity |

**Estimated bundle/repo reduction if all "Delete/Archive" recommendations above are executed:** roughly 1,300–1,900 LOC of JS removed from the active tree (depending on which of the "likely Delete" investigations confirm), plus the 0-byte HTML file — a meaningful reduction in surface area for any new engineer to have to read before they understand what's actually running.

---

# 10. Performance Refactor

| Area | Current State (measured) | Refactor Priority | Action |
|---|---|---|---|
| Script loading | 119 blocking, 65 deferred, 0 async, across all pages | 1st | Convert scripts with no execution-order dependency on `shared.js`/`firebase.js` (e.g. page-specific render helpers) to `defer`; reserve blocking load only for the true dependency chain (`firebase.js` → `shared.js` → page script) |
| Lazy loading | Chart.js and SheetJS already lazy-load dynamically via `createElement('script')` in `bayan.html`, `pages/production.js`, `pages/reports.js` (confirmed pattern already in use) | 2nd | Extend the same proven pattern to `farm-react.js` if §9 investigation confirms it's only needed for specific in-page actions on `reports.html`/`settings.html`, not on initial load |
| DOM rendering | Full-container `.innerHTML =` re-renders confirmed as the dominant update pattern (`shared.js` 14 occurrences, `pages/reports.js` 7, `pages/inventory.js` 5) | 3rd | For the highest-traffic pages (`animals.html` at 1,500 LOC), evaluate targeted DOM patching (update only the changed row/card) instead of full-container re-render, starting with whichever page shows the most frequent re-render calls in practice |
| Event delegation | 254 inline `onclick` vs. 31 `.addEventListener` | 4th | Directly follows from §3 Phase 9 — delegate list/table-row click handling to a single container-level listener per page instead of one inline handler per row |
| Template rendering | 26+ template-literal HTML blocks in `pages/reports.js` alone (highest of any file) | 5th | Once `pages/reports.js` is decomposed (§4), its `report-render.js` module becomes the natural place to introduce a tiny shared template-interpolation helper, reducing repeated string-concatenation patterns |
| Caching | Offline sync queue via IndexedDB already exists (`offline-sync.js`, per project context); `sw.js` caching layer status unconfirmed (§9) | 6th | Depends entirely on the §9 `sw.js` investigation outcome |
| CSS loading | Single `styles.css` file, no splitting; 2 pages (`bayan*`) load none of it | 7th | No urgent action — file size is small enough (460 lines) that splitting would add complexity without a measured performance problem; revisit only if `styles.css` grows substantially larger during the CSS migration (§6) |
| Bundle strategy | No bundler for authored code; one 342 KB minified third-party bundle (`farm-react.js`) present | 8th | Depends on §9 `farm-react.js` investigation; no bundler introduction recommended for the vanilla codebase itself, consistent with the stack-preservation constraint |

---

# 11. Testing Strategy

| Migration Phase (from §3) | Smoke Tests | Regression Tests | Visual Tests | Accessibility Tests | Manual QA | Rollback Checkpoint |
|---|---|---|---|---|---|---|
| Phase 0/1 — Orphaned files | Page loads without console errors after each file's decision is executed | Confirm the feature area (e.g. births, notifications) still works exactly as before | N/A unless a file is reconnected (then compare before/after) | N/A | Full click-through of the affected feature after each individual file decision | One commit per file — revert individually if any regression appears |
| Phase 2 — CSS tokens | All pages render without visibly broken styling | Diff computed CSS values before/after for every component touched | Full-page screenshot diff, both themes (dark/light), for every page that uses the touched component | Confirm no color-contrast regression introduced by token changes | Spot-check 3–5 representative pages per component family | Revert the single CSS commit; additive fallback pattern (§6 Step A) means this should rarely be needed |
| Phase 3 — Card consolidation | Every page with a card renders without layout breakage | Confirm card click/hover behavior unchanged | Screenshot diff per page, both themes | Confirm `sr-only` labels (if added) don't disrupt existing screen-reader flow | Click through all 15 affected pages | Per-page revert; legacy class aliases mean partial rollback is trivial |
| Phase 4 — Modal sizing | Every `showModal()` call site opens at the expected size | Confirm modal content still scrolls/closes correctly | Screenshot diff of each modal, both themes | Confirm modal focus behavior unchanged (note: focus-trap was already flagged as unconfirmed in the Architecture Audit — this phase should not silently assume it exists) | Open every modal call site once | Per-page revert |
| Phase 5 — Tables | Every table page loads and displays data correctly | Confirm sort/filter/pagination (where present) still functions identically | Screenshot diff of all 8 affected pages, both themes | Confirm table headers retain any existing semantic markup | Full data walkthrough on `animals.html` specifically (highest-traffic table) | Per-page revert; keep `.tbl` alias live during the entire phase |
| Phase 6 — Z-index scale | Every overlay (modal, toast, dropdown, navbar) still appears above/below the correct sibling elements | N/A (no logic change) | Manual stacking-order screenshot checklist per overlay type | N/A | Deliberately trigger every overlay type simultaneously at least once (e.g. open a modal while a toast is visible) | Full revert of the z-index commit if any stacking break is found |
| Phase 9 — Event delegation | Every migrated page's interactive elements still respond to clicks | Confirm no double-firing of handlers during the transition period (both `onclick` and `addEventListener` present simultaneously is the highest-risk moment) | N/A | Confirm keyboard-only interaction still works (this phase is the natural point to also verify no `aria-label`/`alt` regression, tying back to the accessibility findings) | Full click-through per migrated page before removing its inline `onclick` attributes | Per-page revert; never remove inline handlers until `.addEventListener` equivalents are confirmed working in production for that page |
| Phase 10 — `shared.js` decomposition | Every page that loads `shared.js` still initializes without console errors | Full regression pass across all 31 pages (this is the single highest-blast-radius phase in the entire roadmap) | Screenshot diff of a representative page per feature area | Re-run the accessibility spot-check from earlier phases to confirm no regression from the restructuring | Full manual walkthrough of the entire app, not just a sample | Keep the old monolithic `shared.js` as a compatibility shim (re-exporting from the new modules) until every page is confirmed working, then remove it in a separate, final commit |

---

# 12. Migration Roadmap

## Sprint 1 — Investigation & Decisions
- **Objectives:** Resolve all Phase 0 unknowns (§3) — the 6 orphaned files, `sw.js` registration, `farm-react.js` usage.
- **Files:** `pages/animal_detail.js`, `pages/births.js`, `pages/notifications.js`, `chat.js`, `sync-to-excel.js`, `sync.js`, `sw.js`, `reports.html`, `settings.html`.
- **Deliverables:** A written decision (delete/merge/reconnect/archive) for every file; confirmed `sw.js` registration status; confirmed `farm-react.js` necessity.
- **Risks:** None (read-only sprint).
- **Definition of Done:** Zero open questions remain from the Architecture Audit's "Unknown areas" list for these specific items.

## Sprint 2 — Dead Code Execution + CSS Token Wiring (Step A)
- **Objectives:** Execute Sprint 1 decisions; wire all 36 unused CSS variables using the additive fallback pattern (§6 Step A).
- **Files:** The 6 investigated files + `activity.html` (delete) + `styles.css`.
- **Deliverables:** Clean, fully-referenced JS file tree; every CSS variable has at least one live consumer with a safe fallback.
- **Risks:** Low; C2 collision must be resolved before any reconnect action.
- **Definition of Done:** No orphaned files remain (or remaining ones are explicitly archived with a documented reason); no CSS variable shows zero references in a fresh audit re-run.

## Sprint 3 — Card & Modal Consolidation
- **Objectives:** Execute §3 Phases 3–4 (card primitive + modal size-class adoption).
- **Files:** `styles.css` + 15 card-using pages + `shared.js` + 10 modal-using pages.
- **Deliverables:** Single `.card` primitive live with legacy aliases; zero inline `max-width` remaining on any `showModal()` call.
- **Risks:** Low (proven-safe pattern from prior session work).
- **Definition of Done:** Visual diff shows no unintended layout change on any of the 15+10 affected pages.

## Sprint 4 — Table Consolidation + Z-index Scale
- **Objectives:** Execute §3 Phases 5–6.
- **Files:** 8 table-using pages + `styles.css` (z-index scale) + all z-index-bearing files.
- **Deliverables:** Single `.data-grid` primitive across all 8 pages; named z-index scale applied everywhere.
- **Risks:** Medium (highest-traffic data surface + stacking-sensitive UI in the same sprint — sequenced tables first, z-index second within the sprint, never simultaneously touching the same file).
- **Definition of Done:** Full manual QA checklist (§11) passed for both areas independently.

## Sprint 5 — Event Delegation Migration (Part 1 of 2)
- **Objectives:** Migrate the first half of the 31 pages (by traffic priority) from inline `onclick` to `.addEventListener`.
- **Files:** ~15–16 highest-priority pages (start with `animals.html`, `dashboard.html`, `animal-detail.html` given their size/complexity ranking).
- **Deliverables:** ~127 of 254 inline `onclick` attributes converted; corresponding dead `window._x` wrappers removed per page as it completes.
- **Risks:** Medium (user-facing interaction surface, largest single sprint in the roadmap).
- **Definition of Done:** Each migrated page passes its Phase 9 smoke test (§11) before the next page begins; both old and new handler patterns never coexist on the same element past the same commit.

## Sprint 6 — Event Delegation Migration (Part 2 of 2) + `shared.js` Decomposition Kickoff
- **Objectives:** Complete the remaining ~15 pages' event migration; begin `shared.js` module decomposition (§4) using the compatibility-shim strategy.
- **Files:** Remaining pages + `shared.js` + its 4 new module files.
- **Deliverables:** 254/254 inline `onclick` attributes converted (or explicitly deferred with a documented reason); `shared.js` split into `modal.js`/`theme.js`/`ui-helpers.js`/`gateway-writes.js` with the old file retained as a re-exporting shim.
- **Risks:** Medium-High (the shim strategy is what keeps this safe — no page should break even mid-decomposition).
- **Definition of Done:** All 31 pages function identically with the new module files loaded instead of the monolithic `shared.js`; only then is the shim scheduled for removal in a follow-up sprint beyond this roadmap's 6-sprint scope.

---

# 13. Final Target Architecture

```
/                                (project root — unchanged deployment model: Vercel + Firebase)
├── index.html, login.html, dashboard.html, ... (31 pages, same flat structure)
├── bayan.html, bayan-offline.html              (remain self-contained per H4 decision)
├── styles.css                                   (fully-referenced token system: Tier-1→2→3→Utilities→Components)
├── /js
│   ├── /shared
│   │   ├── modal.js
│   │   ├── theme.js
│   │   ├── ui-helpers.js
│   │   ├── gateway-writes.js
│   │   └── utils.js
│   ├── /firebase
│   │   ├── connection.js
│   │   ├── animals-read.js
│   │   └── animals-write.js
│   ├── /state
│   │   └── animals-store.js       (thin pub/sub wrapper over the existing single-writer pattern)
│   ├── /pages
│   │   ├── /reports    (report-data.js, report-render.js, report-export.js)
│   │   ├── /inventory  (inventory-data.js, inventory-render.js, inventory-actions.js)
│   │   ├── /production (production-data.js, production-render.js, production-units.js)
│   │   └── ... (remaining pages decomposed opportunistically, lower priority)
│   └── nav.js, config.js, offline-sync.js, sw.js  (unchanged locations, sw.js registration fixed per §9)
├── /farm-apk                                     (unchanged — Capacitor wrapper, per existing architecture)
└── sw.js                                         (registration confirmed/fixed)
```

**Ownership:** each `/js/pages/<feature>/` folder is owned entirely by its corresponding page(s); `/js/shared` and `/js/firebase` are shared infrastructure with no feature-specific logic permitted inside them (enforced by code review, not tooling, consistent with the vanilla/no-bundler constraint).

**Dependency flow:** Pages → Feature modules → State layer → Shared services → Firebase → Firebase Realtime DB. Strictly one-directional; no feature module imports another feature module.

**Rendering flow:** Feature `*-render.js` files own all `.innerHTML` writes for their feature; no other file touches another feature's DOM subtree.

**Data flow:** Firebase Realtime DB → `firebase/animals-read.js` → `state/animals-store.js` (single source of truth, pub/sub) → feature `*-data.js` files → feature `*-render.js` files.

**Styling flow:** `styles.css` Tier-1 → Tier-2 → Tier-3 → Utilities → Components → optional page-local `<style>` overrides (7 pages) → `bayan*` remains fully isolated.

**State flow:** `animals-store.js` is the only code that reads/writes `window.animals` directly going forward; every feature module consumes it through the pub/sub API, never the raw global.

**Event flow:** Container-level `.addEventListener` with delegation replaces the current 254 inline `onclick` attributes; `window._x` wrapper functions are retired feature-by-feature as their page completes migration.

---

# 14. Technical Debt Burn-down (estimated, based on measured baseline)

| Metric | Baseline (measured) | Target after this roadmap | Estimated Reduction |
|---|---|---|---|
| Orphaned/dead JS LOC | ~2,014 LOC across 6 files | 0 (each resolved to delete/merge/reconnect/archive) | 100% of currently-orphaned code accounted for |
| Unused CSS variables | 36 of 92 | 0 (every token either wired up or removed) | 100% |
| Dead CSS classes | 34 confirmed (+4 this-session additions pending adoption) | 0 | 100% |
| Card class fragmentation | 9 class names for 1 concept | 1 primitive + documented aliases | 89% nominal reduction (9→1), zero breaking change via aliases |
| Table implementations | 3 for 1 concept | 1 primitive | 67% reduction |
| Inline `onclick` count | 254 | 0 (fully delegated) | 100% |
| Global name collisions | 1 confirmed (`window.showHealthDetail`) | 0 | 100% |
| `shared.js` complexity concentration | Single 564-LOC file, complexity score 249.2, widest coupling in the project | Split across 5 focused modules, no single file exceeding ~280 LOC | Coupling blast-radius reduced from "every page" to "only pages using that specific module" |
| Blocking (non-deferred, non-async) scripts | 119 | Reduced to only the true `firebase.js`→`shared.js`→page dependency chain per page (estimate: 40–60 remaining blocking scripts project-wide) | ~50–65% reduction |
| Bundle weight (`farm-react.js`) | 342 KB minified, 2 pages | 0 KB if confirmed removable, or lazy-loaded only on the specific interaction that needs it | Up to 342 KB removed from initial page load on `reports.html`/`settings.html` |
| Maintainability (qualitative, tied to file complexity concentration) | Single highest-complexity file (`pages/reports.js`, score 270.9) monolithic | Split into 3 focused modules, no single file exceeding ~140 | Directly addresses the highest-complexity file identified in the Architecture Audit |
| Scalability gain (qualitative) | New pages currently default to inventing new card/table/filter patterns per the Architecture Audit's own findings | New pages have one documented card primitive, one table primitive, and a formal state-layer API to build against | Removes the root cause of the 9-card/3-table fragmentation from recurring in future pages |
| Coupling reduction (qualitative) | `shared.js` widest-coupling file; no enforced module isolation (106 global exports, convention-only) | ES-module boundaries (per §8) make cross-feature imports an explicit, reviewable line of code instead of an implicit global | Isolation moves from "convention" to "mechanism" |

**Net effect of the full 6-sprint roadmap:** every 🔴 Critical and 🟠 High item from §1 is either fully resolved or has its blocking unknown resolved; 🟡 Medium items are substantially underway (tokens, z-index, `shared.js` decomposition kickoff); 🟢 Low items are folded into other sprints opportunistically rather than requiring dedicated time. No item in this roadmap requires downtime, a framework change, or abandoning the vanilla HTML/CSS/JS + Bootstrap stack established across all prior audit phases.
