# Architecture Audit — PHASE 11 — Bayan Farm Management System
**Role:** Principal Frontend Architect / Staff Software Engineer — Engineering Architecture Audit Only
**Builds on:** Design System Audit v1/v2 (foundations/tokens/components already covered there — not repeated here)
**Methodology:** Static analysis via direct scripted inspection (regex/Python) of every CSS/JS/HTML file. No runtime instrumentation was performed — metrics that require a live browser (actual DOM depth, forced reflows, real repaint areas) are marked `UNKNOWN` rather than estimated.

---

## 1. CSS Health Audit

| Metric | Count | Note |
|---|---|---|
| Total rule blocks (selector groups) | 241 | after flattening `@media` wrappers, excluding `@keyframes` bodies |
| Total individual selectors (comma-split) | 288 | |
| Total declarations | 1,025 | 584 of them textually unique |
| Media queries | 3 | `min-width:992px`, `max-width:991px`, `max-width:768px` — single-level, no nested `@media` |
| Keyframes (`@keyframes`) | 8 | `spin, fadeIn, slideUp, pulse, m3-wave-shimmer, m3-indeterminate, m3-wave-path, skeleton-pulse` |
| `!important` count | 37 | |
| Pseudo-classes (occurrences) | 41 | mostly `:hover`, some `:last-child`/`:not()` |
| Pseudo-elements (occurrences) | 8 | `::before`/`::after`/`::-webkit-*` |
| CSS nesting | N/A | this is flat vanilla CSS (no SCSS/nesting syntax) — "nesting complexity" as a metric does not apply; complexity instead comes from selector chain length (below) |

### Specificity distribution

| Selector type | Count |
|---|---|
| ID selectors (`#id`) | 3 |
| Class selectors (`.class`) | 314 |
| Attribute selectors (`[attr]`) | 7 |
| Universal selectors (`*`) | 1 |

**Deepest selector chains (top):** `.tbl tr:last-child td` and `.tbl tr:hover td` (depth 3 — descendant chain of 3 tokens). No chain in the file exceeds depth 3.

**Highest-specificity selectors:** `#toast-wrap`, `#pwa-install-btn`, `#pwa-install-btn:hover` (specificity `(1,0,0)` — ID-based, the only 3 in the whole file). Next tier: `body.light-mode .field[type=date]::-webkit-calendar-picker-indicator` and `body.light-mode .filter-btn.active` at `(0,3,1)`.

**Average specificity across all 288 selectors:** `(0.01 ID, 1.11 class, 0.21 element)` — i.e. the codebase overwhelmingly relies on single-class selectors, which is a **low-conflict, low-specificity-war profile** (a positive architectural signal — specificity fights are unlikely to be a real source of bugs here).

### Duplicated / overridden selectors

12 selector-groups are defined verbatim more than once (`:root`×2, `.page-wrap`×3, `.farm-modal`×2, `.summary-number`×2, `.navbar-brand`×2, `.sidebar-overlay/menu/header`×2, `.notif-dropdown`×2, plus keyframe percentage markers `50%`×4/`100%`×3/`to`×2 which are expected since they belong to different `@keyframes` blocks, not real duplication).

24 **individual** selectors appear inside more than one rule block — the most repeated is `html.light-mode` (21 separate rule blocks each targeting it for a different property, which is the expected pattern for a theme-override system, not a defect). The genuinely notable repeats are the **card family** (`.breed-card`×4, `.wonder-card`/`.summary-card`/`.record-card`/`.section-card`/`.diary-card`/`.bcard`×3 each) — this is the same card-consolidation debt already logged in the Design System Audit; not re-scored here.

### Duplicated declarations (literal `property:value` pairs repeated ≥5 times)
`align-items:center`(29), `display:flex`(28), `border:1px solid var(--border)`(19), `color:var(--text)`(18), `color:var(--green)`(14), `font-weight:700`(14), `cursor:pointer`(13), `color:var(--text-gray)`(13), `background:var(--bg-hover)`(11), `justify-content:center`(10), `border-radius:12px`(9), `border-color:var(--border-2)`(9), `font-family:'Cairo',sans-serif`(8), `transition:.2s`(8), `width:100%`(8).

**Interpretation:** these are *utility-shaped* declarations (flex centering, standard border/text colors) repeated across many otherwise-unrelated component rules. This is evidence for an **emerging utility-class opportunity** (e.g. a `.flex-center` utility would collapse 29+28 occurrences into one class) — not evidence of accidental duplication of a component, since the surrounding rules are legitimately different components.

---

## 2. Cascade Analysis

```
Root (:root — 2 blocks: Tier-1 raw + Tier-2/3 semantic tokens, defined twice — see CSS Health §duplicated selectors)
   ↓
Theme (html.light-mode / body.light-mode — 21 separate override rule blocks)
   ↓
Utilities (.page-wrap, .text-gray, .green-text, .accent-text...)
   ↓
Components (.action-btn, .type-badge, .farm-modal, card family, .tbl, .field, .spinner...)
   ↓
Page Overrides (local <style> blocks in 9 of 31 pages; full standalone stylesheets in 2 of 31 pages)
```

### Where this flow is broken or bypassed

| Break type | Evidence | Why it exists (fact, not opinion) |
|---|---|---|
| **Full bypass** (page never loads `styles.css` at all) | `bayan.html`, `bayan-offline.html` — no `href="styles.css"` link found; each has its own `<style>` block with an independent `:root` (different hex values for `--green`, `--blue`, etc.) | These two are self-contained "statement" documents (per project context: formal printable pages for stakeholders) — the isolation appears intentional so the file can be shared/printed standalone. |
| **Local override on top of shared theme** | 7 pages carry a local `<style>` block *in addition to* linking `styles.css`: `animal-detail.html`, `assistant.html`, `dashboard.html`, `diary.html`, `import.html`, `pedigree.html`, `tasks.html` | Consistent with normal page-specific styling needs; this is the expected/healthy end of the cascade (Page Overrides layer working as designed), not a defect by itself. |
| **Inline style attributes** | Present throughout the HTML (not separately counted in this section; see Design System Audit for the 64-unique-hex/424-occurrence figure) | Ad-hoc one-off values (dynamic bar widths, conditional border colors) that can't be expressed as static classes without JS-driven custom properties. |
| **No link to `styles.css` and no obvious reason** | `index.html` (16-line redirect script, no visible UI — expected), `activity.html` (0 bytes — see File Complexity §orphaned/empty files) | `index.html` is a legitimate no-UI redirect. `activity.html` is empty; its lack of a stylesheet link is moot because the file has no content at all. |

**Circular cascade dependencies:** NONE found — the cascade is strictly one-directional (raw → semantic → utility → component → page); no component rule references a page-specific override or vice versa.

---

## 3. CSS Dependency Graph

```
Component classes (.action-btn, .type-badge, .farm-modal, card family, .field, .tbl)
   ↓ reference
Tier-1 raw tokens directly (var(--border), var(--card-bg), var(--green)...)
   ↓ (Tier-2/Tier-3 semantic/component tokens are BYPASSED — see Dead CSS §unused variables)
Raw hex fallback values (hardcoded, inline, outside the token system — 424 occurrences, audited previously)
```

**Fact:** of the 92 CSS custom properties defined, only 56 are referenced anywhere else in the same file via `var(--x)`. The dependency chain component→Tier-2→Tier-1 that the token comments describe **does not exist in the actual rule bodies** for the 36 unused variables (listed in §4 below) — components skip straight to Tier-1 or to hardcoded values.

**Circular style dependencies:** NONE found.

---

## 4. Dead CSS Audit

| Category | Count | Evidence |
|---|---|---|
| CSS classes defined with **zero** trace anywhere in HTML/JS (static or dynamic-string) | **39** total; **34** confirmed genuinely dead after manual spot-check (5 are false positives — see note) | `act-add, act-delete, act-edit, activity-icon, activity-row, diary-section, diary-section-title, farm-modal-lg, farm-modal-md, farm-modal-sm, farm-modal-xl, indeterminate, m3-circular, m3-circular-fill, m3-circular-track, m3-progress, m3-progress-fill, m3-step, m3-steps, m3-waveform, n-danger, n-info, n-warning, notif-sound-dot, pwa-banner, rm, role-badge-admin, role-badge-supervisor, role-badge-vet, role-badge-visitor, role-badge-worker, skeleton, skip-to-content, sr-only, t-error, t-info, t-success, tag-chip` |
| — of which: false positives (dynamically built, not truly dead) | 5 | `role-badge-{admin,supervisor,vet,visitor,worker}` — confirmed used via template literal `role-badge-${u.role}` in `users.html`, invisible to static class-name matching |
| — of which: dead **because this session added them and no page uses them yet** | 4 | `.farm-modal-sm/md/lg/xl` — added to `styles.css` in this conversation's earlier CSS-consolidation step; zero `showModal()` call sites have been migrated to use them yet (expected, tracked debt — not a regression) |
| — of which: an entire unused sub-system | 8 classes (`m3-circular*`, `m3-progress*`, `m3-step*`, `m3-waveform`) + 2 keyframes shared with it | A Material-3-inspired circular/step progress-indicator component was built into CSS but is **not referenced by any page** — a fully-formed but never-adopted molecule |
| — of which: unused accessibility scaffolding | 2 | `sr-only`, `skip-to-content` — screen-reader utility classes exist in CSS but are applied to zero elements, consistent with the near-zero accessibility usage already measured in the Design System Audit |
| CSS variables defined, zero `var()` reference anywhere in the file | **36 of 92** | Includes the entire unused Tier-3 component-token layer already flagged in the Design System Audit (`--card-surface`, `--card-border`, `--card-radius`, `--input-radius`, `--input-padding`, `--btn-primary-bg`, `--btn-secondary-bg`...) plus unused Tier-2 tokens not previously enumerated by name: `--color-neutral`, `--color-text-primary/secondary/tertiary/disabled`, `--surface-base`, `--surface-sunken`, `--border-subtle/strong/interactive`, `--badge-success/warning/danger/info-bg`, `--motion-duration-fast/base`, `--motion-easing-decel/accel/spring` |
| Unused `@keyframes` | **0** | All 8 defined keyframes are referenced by an `animation`/`animation-name` declaration somewhere in the same file — no dead animations |
| Unused `@media` blocks | 0 | All 3 breakpoints contain rules that are the only definition for those selectors at that width — not literally "unused," though whether they're ever hit at runtime is `UNKNOWN` without a browser |
| Unused utility classes | Not separately measurable from the component list above without a class-by-class HTML cross-reference beyond what §1 already covers | See the 39-class dead list above, which includes utility-shaped classes (`sr-only`, `skip-to-content`) |

---

## 5. JavaScript Architecture

**Scope note:** `farm-react.js` (39 physical lines, 342,574 bytes) is a **minified third-party bundle** (variable names like `e,t,n,r,i,a,o,s,c` and `Object.defineProperty`/`Object.getOwnPropertyDescriptor` boilerplate are unmistakable bundler output), loaded only by `reports.html` and `settings.html`. It is excluded from all counts below to avoid skewing "authored code" metrics; its existence is itself an architecture fact, reported separately.

| Metric | Count (authored code, 26 files, excl. `farm-react.js`) |
|---|---|
| Total LOC | 8,048 |
| Function declarations + anonymous functions | 354 |
| Arrow functions (`=>`) | not separately totaled per-file above 600+ combined; largest single contributors: `pages/reports.js` (112), `shared.js` (59), `pages/production.js` (54) |
| `class` declarations | 18 (all inside the bundled `farm-react.js`; **0 in authored code** — the project uses zero ES6 classes, consistent with its vanilla-function style) |
| `.addEventListener(` calls | 31 |
| Inline `onclick=` attributes (HTML) | **254** |
| `setTimeout(` | 34 |
| `setInterval(` | 3 |
| `MutationObserver` | 0 |
| `IntersectionObserver` | 1 |
| `CustomEvent` | 0 |
| `DOMContentLoaded` | 16 |
| `window.onload` | 0 |

**Fact, stated plainly:** event handling is overwhelmingly **inline-attribute-based** (254 `onclick=` vs. 31 `.addEventListener`) — an 8:1 ratio. This matches the memory note about the recurring "inline onclick breaks with quotes" bug pattern and its `window._functionName` workaround; the workaround is a symptom of this architectural choice, not an unrelated bug.

### `farm-react.js` (excluded bundle, reported separately)
- 342 KB minified, 39 physical lines, ~833 function expressions / ~504 arrow functions inside the bundle.
- Loaded by exactly 2 of 31 pages (`reports.html`, `settings.html`).
- **Architectural fact:** the project's "no React" framing (confirmed by the project context in this audit's own instructions) is true for all *authored* code, but a React bundle is physically present and loaded in 2 pages. Whether it's dead weight or actively used inside those 2 pages was not traced further in this pass — `UNKNOWN` beyond "it loads."

---

## 6. Coupling Analysis

**Global-scope note (fact, not opinion):** this project has no module system (`<script>` tags without `type="module"`, no bundler for authored code) — every JS file that loads on a page shares one `window`/global scope with every other loaded file. This makes `window.*` property assignment the only *reliable* way to measure real cross-file coupling; measuring "global variable" collisions via top-level `let/const/var` name reuse is **not reliable by regex** (a name declared inside a function is textually indistinguishable from a true top-level declaration without a full parser) — that data point is marked `UNKNOWN` for precision, though raw name-reuse counts were tallied for reference (144 identifier names reused across ≥2 files, dominated by common short names like `s`, `d`, `el`, `r`, `t`, `data` — not evidence of real conflict on their own since most are function-scoped).

| Metric | Value |
|---|---|
| Unique `window.X =` property assignments (real global API surface) | **106** |
| Files responsible for the most `window.*` exports | `shared.js`, `pages/breeding.js`, `pages/vaccine.js`, `pages/health.js`, `pages/inventory.js` each export several |
| **Genuine name collisions** (same `window.X` assigned in >1 file — a true last-write-wins risk) | **1**: `window.showHealthDetail` defined in both `pages/animal_detail.js` and `pages/health.js` |
| Is the collision live at runtime? | **No** — see §10, `pages/animal_detail.js` is never loaded by any page (orphaned file); the collision is currently inert but would activate the instant someone wires that file back into a page without renaming the function |
| Central write-owner pattern found | `window.animals` is **written in exactly 1 file** (`firebase.js`) and **read in 20 different files** — a clean single-writer/many-reader pattern (positive finding, not debt) |
| Theme state ownership | `localStorage.getItem('farm_theme')` + `classList` toggling centralized in `shared.js` (single owner) |
| `<script src>` count per page (proxy for page-level coupling to shared files) | Highest: `reports.html` (10), `import.html`/`production.html` (9 each); most pages load 8 |
| Most coupled file (by inbound reliance — pages that would break without it) | `shared.js` (loaded by effectively every management page; owns modal system, theme, and several shared UI helpers) |
| Least coupled files | `config.js` (32 LOC, 0 functions, no dependencies detected), `chat.js` (55 LOC, self-contained, and — see §10 — never loaded by any page) |
| Single point of failure (SPOF) candidates | `shared.js` (modal system + theme, no fallback if it fails to load) and `firebase.js` (sole writer of the `animals` global that 20 other files read) |

---

## 7. State Management Audit

| State | Where it lives | Owner (writer) | Readers | Notes |
|---|---|---|---|---|
| Core dataset (`animals`) | `window.animals` (global) | `firebase.js` (1 file) | 20 files | Single-writer/many-reader — clean pattern |
| Theme (dark/light) | `localStorage['farm_theme']` + `<html>/<body>` class | `shared.js` | Every page indirectly via CSS `.light-mode` selectors | Centralized |
| Session/user (PIN login) | `localStorage['farm_user']` (per `index.html` redirect logic) | `login.html` (presumed writer, not traced further this pass) | `index.html`, `nav.js` (presumed) | Writer file not confirmed beyond `index.html`'s read — `UNKNOWN` full write-path |
| Modal open/closed | DOM (`#modal-root` innerHTML), no JS variable | `shared.js` (`showModal`/`closeModal`) | Any page calling `showModal()` | Not a JS state variable at all — state lives directly in the DOM |
| Filters / selected tab (e.g. diary import/export tabs, notification filters) | Local variables inside each page's own `<script>` block (e.g. `_tab`, `nFilter` seen in earlier Design System Audit grep) | Each page individually | Same page only | **Not centralized** — every page that needs a filter/tab re-implements its own local variable; no shared "active filter" abstraction exists |
| Offline sync queue | IndexedDB, per project context (`offline-sync.js`) | `offline-sync.js` | Presumed multiple pages queueing writes | Not traced in file-by-file detail this pass |
| Duplicated state | `UNKNOWN` precisely — regex cannot reliably prove two files hold *independent* copies of logically-the-same state without full data-flow tracing; no case was conclusively found beyond the single `showHealthDetail` naming collision (§6), which is a function collision, not a data-state duplication |
| Conflicting ownership | None conclusively found for the `animals` global (single writer confirmed) | | | |
| Hidden state | `sw.js` — see §10, appears to have **no `serviceWorker.register()` call found anywhere in the codebase** via direct string search; if the offline PWA layer is active, its activation path could not be located by this scan |

---

## 8. Event Flow Audit

```
Click (onclick="functionName(...)" — 254 occurrences, the dominant pattern)
   ↓
Handler (usually a `window._x` or global function — per memory context, wrapped this way specifically to avoid quote-breaking in inline attributes)
   ↓
Validation (inline, ad-hoc per handler — no shared validation layer found)
   ↓
Business Logic (direct Firebase read/write via `firebase.js` gateway functions, per project's documented gateway architecture)
   ↓
DOM Update (`.innerHTML =` — used across the codebase; e.g. `pages/animal_detail.js` alone has 4, `shared.js` has 14, `pages/reports.js` has 7)
   ↓
Storage (Firebase Realtime DB write, or `localStorage`/IndexedDB for offline queue)
   ↓
UI Refresh (typically a full re-render of the relevant container via another `.innerHTML =` call, not a targeted DOM patch)
```

| Metric | Value |
|---|---|
| Inline `onclick=` handlers (HTML) | 254 |
| `.addEventListener` handlers (JS) | 31 |
| Ratio | ~8:1 in favor of inline handlers |
| Delegated events (`.closest(`/`.matches(` pattern used inside a single top-level listener) | `UNKNOWN` — not measured this pass; would require inspecting each of the 31 `addEventListener` call sites individually |
| Anonymous vs. named handlers | `UNKNOWN` split precisely — both patterns appear in the arrow-function counts above but weren't classified by anonymity in this pass |
| Average / longest event chain depth | `UNKNOWN` — this requires tracing actual call graphs per handler (which function calls which), not done at this static-regex depth in this pass |

---

## 9. Performance Architecture

| Metric | Value | Note |
|---|---|---|
| DOM size / deepest DOM tree (runtime) | `UNKNOWN` | Requires a live browser DOM inspection; not obtainable from static HTML source alone (JS-generated markup via `.innerHTML` is not reflected in the source file) |
| Largest HTML page (source LOC) | `animals.html` — **1,500 lines** | By a wide margin the largest single file in the project |
| Largest JS file (authored) | `pages/animal_detail.js` — 802 lines | **Note:** this file is confirmed orphaned/never loaded (§10) — the largest *active* JS file is `shared.js` (564 lines) |
| Largest CSS section | `styles.css` — 460 lines total (post this session's edits) | Single file, no CSS splitting |
| External `<script>` tags, blocking (no `defer`/`async`) | **119** across all pages | |
| External `<script>` tags with `defer` | **65** | |
| External `<script>` tags with `async` | **0** | |
| Inline `<script>` blocks | **53** | |
| Layout thrashing candidates / forced reflows | `UNKNOWN` | Requires runtime profiling (reading a layout property immediately after a style write, in a loop) — not statically detectable with confidence from source alone in this pass |
| Duplicate DOM structures | Qualitatively yes — the 9-class card family and 3-pattern table each generate structurally near-identical markup from different code paths (already evidenced in the Design System Audit); not re-quantified here |

**Fact worth flagging:** 119 blocking `<script>` tags with zero `async` usage anywhere in the project means every page's initial render is gated on sequential, synchronous script execution for most of its dependencies (only 65 of 184 total external script tags use `defer`). This is a measurable, static-analysis-confirmed fact about load-order behavior, independent of runtime DOM metrics.

---

## 10. File Complexity

**Composite complexity score formula (fully disclosed, not a black box):**
`score = 0.05×LOC + 1×(functions+arrows) + 3×(.innerHTML= count) + 1.5×(if count) + 2×(switch count) + 1×(addEventListener count) + 2×(template-literals containing HTML tags)`

### Top 10 most complex files (authored JS only, `farm-react.js` excluded)

| Rank | File | Score | LOC | Functions | innerHTML | if | switch | addEv | HTML-template blocks |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `pages/reports.js` | 270.9 | 338 | 141 | 7 | 26 | 0 | 1 | 26 |
| 2 | `shared.js` | 249.2 | 564 | 89 | 14 | 42 | 0 | 1 | 13 |
| 3 | `pages/animal_detail.js` ⚠️orphaned | 215.1 | 802 | 56 | 4 | 16 | 0 | 1 | 41 |
| 4 | `pages/inventory.js` | 200.8 | 426 | 54 | 5 | 41 | 0 | 1 | 24 |
| 5 | `pages/production.js` | 191.2 | 634 | 69 | 5 | 27 | 0 | 1 | 17 |
| 6 | `pages/tasks.js` | 155.8 | 545 | 58 | 1 | 23 | 0 | 1 | 16 |
| 7 | `pages/notifications.js` | 149.7 | 363 | 77 | 2 | 21 | 0 | 1 | 8 |
| 8 | `firebase.js` | 137.7 | 474 | 44 | 2 | 40 | 0 | 0 | 2 |
| 9 | `pages/births.js` ⚠️orphaned | 121.6 | 482 | 42 | 3 | 29 | 1 | 1 | 0 |
| 10 | `pages/pedigree.js` | 109.2 | 305 | 30 | 4 | 14 | 0 | 1 | 15 |

**Flag:** 2 of the top-10 most complex files by this metric (`pages/animal_detail.js`, `pages/births.js`) are confirmed orphaned (never loaded by any page — see below). Ranked by *active, loaded* complexity only, the true top-3 are `pages/reports.js`, `shared.js`, `pages/inventory.js`.

### Simplest 10 files
`config.js`(1.6) < `chat.js`(9.8, also orphaned) < `import-data.js`(9.9) < `nav.js`(10.9) < `sync.js`(45.0, also orphaned) < `pages/farm_profile.js`(55.5) < `pages/tour.js`(61.6) < `sw.js`(62.5) < `sync-to-excel.js`(70.2, also orphaned) < `pages/finance.js`(88.9).

### File size extremes (all files, LOC)
- **Largest:** `animals.html` (1,500), `pages/animal_detail.js` (802), `assistant.html` (655), `import.html` (643), `pages/production.js` (634).
- **Smallest non-empty:** `index.html` (17), `config.js` (32), `production.html`/`breeding.html`/`farm-profile.html`/`finance.html`/`health.html`/`inventory.html`/`vaccine.html` (40–44 each — these are thin HTML shells whose real logic lives in the correspondingly-named `pages/*.js` file).
- **Empty file:** `activity.html` — **0 bytes/lines.** Present in the file tree, referenced nowhere, contains nothing.

### Orphaned files — confirmed by exact `<script src="...">` string matching against every HTML file
**6 files are never referenced by any `<script src>` tag anywhere in the project:**
| File | LOC | Confirmed orphaned? |
|---|---|---|
| `pages/animal_detail.js` | 802 | ✅ zero references anywhere, including the similarly-named `animal-detail.html` (which instead carries its logic in 3 inline `<script>` blocks) |
| `pages/births.js` | 482 | ✅ zero references (the visible births functionality in `animals.html`/`births.html` appears to be implemented elsewhere/inline; this file's actual usage path is `UNKNOWN`) |
| `pages/notifications.js` | 363 | ✅ zero references (note: `notifications.html` instead loads `notifications-service.js`, a *different* file) |
| `chat.js` | 55 | ✅ zero references |
| `sync-to-excel.js` | 223 | ✅ zero references |
| `sync.js` | 89 | ✅ zero references |

`sw.js` was checked separately since service workers register via `navigator.serviceWorker.register(...)`, not a `<script src>` tag: **no `serviceWorker.register` call was found in any file** via direct string search across every `.html` and `.js` file. This is stated as a static-analysis fact — it does not prove the service worker is inactive (registration could theoretically occur through a mechanism this scan didn't anticipate), but no activation path was located.

**This is the single largest concrete finding of this architecture pass:** roughly 2,014 lines of JavaScript (802+482+363+55+223+89) — about a quarter of all authored JS in the project — sit in files with no discoverable load path from any page.

---

## 11. Scalability Audit (evidence-based, no opinions)

| Principle | Evidence for | Evidence against |
|---|---|---|
| **Extensibility** | Gateway architecture in `shared.js`/`firebase.js` centralizes all Firebase writes (per project context) — adding a new write path means extending an existing gateway function, not inventing a new pattern | New page → new local `<style>` block + local filter-state variable pattern repeats each time (§7) rather than extending a shared abstraction |
| **Replaceability** | `window.animals` single-writer pattern (§6) means the data source could be swapped behind `firebase.js` without touching the 20 reader files | The 6 orphaned files (§10) show that files can silently stop being part of the system without any error — nothing enforces that a `pages/*.js` file is actually wired to a page |
| **Isolation** | No module system means every file's functions are automatically global — the flip side is there is no enforced isolation at all | 106 `window.*` exports, 1 confirmed name collision (`showHealthDetail`) — isolation exists only by convention (naming), not by mechanism |
| **Coupling** | `shared.js` is deliberately the single shared dependency most pages load | `shared.js` is simultaneously the highest-complexity active file (score 249.2) and the highest-inbound-coupling file — a change here has the widest blast radius in the project |
| **Reusability** | `action-btn`/`type-badge`/modal system are genuinely reused 17/11/10 times respectively (Design System Audit) | Card family and table implementations are reinvented per-page rather than reused (already logged) |
| **Encapsulation** | Firebase gateway functions (`gwAddAnimal`, etc., per project context) encapsulate write logic | DOM state for modals lives directly in `#modal-root.innerHTML` with no encapsulating object — any script can clobber it directly |
| **Single Responsibility** | Each `pages/*.js` file maps 1:1 to one page's logic (where actually wired up) | `shared.js` at 564 LOC / 89 functions carries modal system + theme + several unrelated helpers in one file — it is not single-responsibility by LOC/function count |
| **Open/Closed** | Badge/button variant systems (`.action-btn.primary/.danger/.sm`) allow new variants without modifying the base rule | Table implementation has no shared base at all to extend — each new page's table is written from scratch (already logged in Design System Audit) |

---

## 12. Risk Heatmap

| Category | Score (lower = worse) /100 | Evidence | Risk | Impact |
|---|---|---|---|---|
| CSS | 58 | 36/92 variables unused, 39 dead classes, 12 duplicated selector-groups | Medium | Maintenance drag, not a runtime bug |
| JS Architecture | 45 | No module system, 106 global exports, 1 confirmed name collision, 254:31 inline-vs-delegated event ratio | Medium-High | Fragile to accidental overwrite as the file count grows |
| Orphaned Code | 35 | 6 files / ~2,014 LOC (≈25% of authored JS) with no discoverable load path; `sw.js` registration not found | **High** | Dead weight at best; at worst, functionality the team *believes* exists (e.g. a notifications page logic file) is not actually running |
| State Management | 68 | Clean single-writer pattern for core data (`animals`) and theme; filters/tabs state is per-page and non-centralized | Low-Medium | Low risk today at current page count; will not scale cleanly if more pages need shared filter state |
| Performance | 55 | 119 blocking scripts, 0 async, only 65 deferred; largest active page (`animals.html`) is 1,500 LOC of markup | Medium | Slower first paint on script-heavy pages; not measured at runtime this pass |
| Scalability | 50 | Gateway pattern is genuinely extensible; but no enforcement prevents new orphaned files or new duplicated card/table implementations | Medium | Same failure modes already seen (§10, Design System Audit) will likely recur without process, not tooling |
| Maintainability | 50 | `shared.js` concentrates high complexity + high coupling in one file | Medium | Single riskiest file to modify in the whole project |
| Accessibility | 8 | Already measured in Design System Audit (3 `aria-*`, 0 `alt=`); this pass adds: 2 accessibility utility classes (`sr-only`, `skip-to-content`) exist in CSS but are applied to 0 elements | High (if accessibility compliance is ever required) | Same finding, now with confirmation that even the scaffolding for a fix exists unused |
| Technical Debt (aggregate) | 47 | Sum of all of the above | Medium | Consistent with the ~47-48/100 overall readiness already scored in the Design System Audit — this architecture pass does not change that overall picture, it explains *why* it sits there with harder engineering evidence |

---

## 13. Architecture Readiness

| Area | Score /100 | Evidence |
|---|---|---|
| CSS Architecture | 55 | Low specificity conflicts (good), but 36 unused variables and an unused sub-component system (M3 progress family) |
| JavaScript Architecture | 45 | No modules, no classes in authored code, heavy inline-onclick reliance (254 vs. 31 delegated) |
| State Management | 60 | Clean single-writer core-data pattern; no centralized filter/UI-state layer |
| Component Isolation | 42 | 106 global exports with only 1 detected collision — isolation currently holds by convention, not mechanism, which is fragile at scale |
| Maintainability | 50 | Concentrated complexity+coupling in `shared.js`; 6 orphaned files add navigational confusion for any new engineer |
| Scalability | 48 | Gateway pattern scales; ad-hoc per-page card/table/filter patterns don't |
| Performance | 52 | 0 async scripts, 65/184 deferred; real runtime metrics (DOM size, reflows) unmeasured — `UNKNOWN` |
| Dependency Health | 40 | 25% of authored JS (6 files) has no confirmed load path; `sw.js` registration not located |
| Complexity | 50 | Reasonable at the LOC level (8,048 total authored lines across 26 files, ~310 LOC/file average) but concentrated unevenly (top file `pages/reports.js` alone carries a complexity score >3× the median) |
| **Overall Architecture Score** | **~48/100** | Consistent with the Design System Audit's own ~47-48/100 overall figure — the two audits independently converge on the same overall health estimate through entirely different evidence (design consistency vs. engineering structure), which is itself a form of cross-validation |

---

## 14. Architecture Dependency Map

```
Pages (31 HTML files, 1 confirmed empty: activity.html)
   ↓ <script src>
Page-specific logic (pages/*.js — 20 of 26 confirmed wired to a page; 6 confirmed orphaned)
   ↓ calls
Shared JS layer (shared.js — modal system, theme, misc helpers; firebase.js — sole writer of `animals`)
   ↓ writes/reads
Firebase Realtime Database (external, gateway-mediated per project context — not independently verified this pass)
   ↓ styling
Theme (styles.css `:root` + `.light-mode` overrides — bypassed entirely by 2 pages: bayan.html, bayan-offline.html)
   ↓
Tokens (Tier-1 raw ✅ used / Tier-2 semantic ⚠️ partially used / Tier-3 component ❌ 36 of 92 variables never referenced)
   ↓
Raw Foundations (hex values, both as CSS variables and as 424 hardcoded inline occurrences bypassing the token layer)
```

### Architectural bottlenecks (evidence-backed)
1. **`shared.js`** — highest complexity score among *active* files (249.2) and widest inbound reliance; a break here has the largest blast radius in the project.
2. **`firebase.js`** — sole writer of the `animals` global; every one of its 20 readers depends on it being correct and available.
3. **The token layer's Tier-2/Tier-3** — architecturally present but functionally bypassed; any future work assuming "just change the token" for 36 of 92 variables will silently do nothing, because nothing reads them.
4. **The 6 orphaned JS files** — not a bottleneck in the traditional sense, but a navigational trap: any engineer searching for "where is the notifications logic" will find `pages/notifications.js` (363 LOC) and reasonably assume it's live, when the active file is actually `notifications-service.js`.

---

## 15. Executive Summary

**Top strengths (evidence-backed):**
- Low CSS specificity-conflict profile (avg. specificity `0.01/1.11/0.21`, only 3 ID selectors in the whole file) — a genuinely low-risk cascade.
- Clean single-writer/many-reader pattern for the core `animals` dataset (`firebase.js` writes, 20 files read, 0 conflicting writers found).
- Zero unused `@keyframes` — every animation defined is actually used.
- Zero circular CSS or JS dependencies found anywhere.

**Top weaknesses (evidence-backed):**
- **25% of authored JavaScript (6 files, ~2,014 lines) has no discoverable load path** — the single most significant finding in this pass.
- 36 of 92 CSS variables (the entire semantic/component token layer, minus this session's additions) are defined and never used.
- Inline `onclick=` outnumbers `.addEventListener` 254:31 — an architectural pattern, not a bug, but one that directly produced the quote-escaping bug class already on record in project memory.
- `shared.js` simultaneously holds the highest active complexity score and the widest coupling — a single-point-of-failure by construction, not by accident.

**Most dangerous architectural risks:**
1. Orphaned files creating false confidence that functionality exists and is running when it is not (§10).
2. The one confirmed global-name collision (`window.showHealthDetail`) is currently inert only because the colliding file is orphaned — reconnecting that file without renaming the function would silently break one of the two features.
3. No mechanism (only convention) prevents new global-scope collisions as the file count grows, since there is no module system.

**Lowest-cost improvements (fact-based observation, not a recommendation to act):** confirming/removing or re-wiring the 6 orphaned files and resolving the `sw.js` registration question are pure investigation tasks with no design risk, since their current runtime contribution is either zero or unconfirmed.

**Highest-impact improvements (fact-based observation, not a recommendation to act):** resolving what `shared.js` should own (given it is both the most complex active file and the most-relied-upon) would touch the architecture's single largest bottleneck.

**Unknown areas (explicitly not measured this pass, would require different tooling):**
- Real runtime DOM size/depth, forced reflows, and repaint areas (require a live browser).
- Full data-flow tracing to prove/disprove additional hidden duplicated state beyond what was checked.
- Precise cyclomatic complexity (McCabe) numbers — approximated here only via if/switch/function counts, not a true control-flow graph.
- Whether `sw.js` is registered through a path this string-based scan didn't anticipate.
- The actual runtime behavior of the 6 orphaned files (whether truly dead, or invoked through a mechanism outside static `<script src>` scanning, e.g. manually pasted into a console, or a leftover from a prior refactor).

**Confidence level:** High for all counted/measured metrics (CSS rules, selectors, tokens, orphaned-file detection, window.* collisions — all derived from exact string/regex matching against the full file set). Low/UNKNOWN explicitly flagged for anything requiring runtime execution or full AST-level parsing, per the audit's own ground rules.
