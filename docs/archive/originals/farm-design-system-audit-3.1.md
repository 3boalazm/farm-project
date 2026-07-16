# Sprint 3 — Task 3.1: Farm Design System Audit
**Status: Investigation and proposal only. No code written, no files modified.**
**Note on scope:** This audit reflects the project's **current** state — after Sprint 2's CSS token wiring, card/modal unification, dead-code cleanup, and Service Worker/sync-tooling work. Where Sprint 2 already resolved something (cards, buttons, badges), this report states that plainly rather than re-flagging it as open. Where nothing has changed (tables, typography scale, spacing scale, z-index scale), this report says so with fresh, re-verified numbers, not stale ones.

---

# 1. UI Audit

| Category | Current state |
|---|---|
| **Colors** | 3-tier token system exists (Tier-1 raw → Tier-2 semantic → Tier-3 component), defined once in `:root`, themed via `html.light-mode`/`body.light-mode` overrides. Consistent mechanism; the gap is coverage (see Tokens, below). |
| **Typography** | Single font stack: `Cairo` (body/UI text), `Lexend` (numeric displays/headings), `monospace` (rare). No named type scale — **32 distinct font-size values** in raw px/rem, unchanged in kind since Sprint 2's cleanup (a few were incidentally removed as part of dead-code deletion, not a deliberate scale reduction). |
| **Spacing** | No named spacing scale — **32 distinct padding values** in `styles.css` alone (not counting inline). |
| **Border radius** | Partially scaled: cards now use `--card-radius-sm/md/lg/xl` (Sprint 2). Everything else (buttons, inputs, badges, tables) still uses ad-hoc literal values. |
| **Shadows** | One shared token, `--card-shadow` (themed light/dark), used consistently for cards; modals and a few other surfaces still hardcode their own `box-shadow` values. |
| **Borders** | Fully tokenized and consistent — `--border`, `--border-2`, `--border-3` used throughout, themed correctly. This is one of the project's more mature areas. |
| **Transitions** | Motion tokens exist (`--motion-duration-fast/base/slow`, easing curves) — wired into a handful of rules during Sprint 2's cleanup pass, but most `transition:` declarations in the file still use raw values that don't happen to exactly match a token (e.g. `.2s`, `.3s` — only exact matches to `150ms`/`250ms` were converted, by design, to avoid any visual change). |
| **Animations** | 8 `@keyframes` defined, all confirmed used (no dead animations, verified in Sprint 2's cleanup). |
| **Icons** | Two parallel systems: Bootstrap Icons (`bi-*`, 19 pages) and raw inline `<svg>` (2 pages: `dashboard.html`, `dead.html`). Minor, contained inconsistency. |
| **Buttons** | ✅ **Resolved.** Single `.action-btn` + modifiers (`.primary`, `.danger`, `.sm`) system, used across 17 pages, ~189 occurrences, fully tokenized (Sprint 2, Task 2.9). |
| **Inputs** | Single `.field` class, now wired to `--input-radius`/`--input-padding` tokens (Sprint 2 cleanup). No documented state variants (error/success/disabled) exist yet. |
| **Selects** | Native `<select>` elements styled implicitly via `.field` where applied — no dedicated select-specific styling found. |
| **Cards** | ✅ **Resolved.** Formerly 9 separate class names with 4 near-duplicate and 5 completely unstyled definitions; now one shared base rule + size-scale modifiers (`--card-radius-*`/`--card-pad-*`), all 9 legacy class names aliased to it (Sprint 2). |
| **Tables** | ❌ **Still unresolved.** Three separate implementations: `.tbl` (defined, used on 6 pages), `.data-table` (used on 1 page, **zero CSS definition**, confirmed again in this pass), and a fully inline-styled table in `dashboard.html` with no shared class at all. |
| **Badges** | ✅ Already solid — `type-badge` + `badge-{color}` modifier system, ~30 occurrences across 11 pages, tokenized via `--badge-*-bg` (Sprint 2). |
| **Alerts** | No dedicated `.alert` component found distinct from toasts/badges — feedback is currently handled via the toast system and inline colored text, not a discrete alert component. |
| **Navbar** | `.navbar-wonder` + `.navbar-brand`, single implementation, consistent across pages that include it. |
| **Sidebar** | Rendered via `nav.js` (`renderNavbar()`), single shared implementation. |
| **Dialogs/Modals** | ✅ **Resolved.** `.farm-modal` + size classes (`.farm-modal-sm/md/lg/xl`, aliased from legacy `.narrow`/`.wide`) via the shared `showModal()`/`closeModal()` mechanism in `shared.js` (Sprint 2). |
| **Dropdowns** | `.dropdown-menu`/`.dropdown-item` — Bootstrap's own dropdown classes, used as-is, no custom override layer. |
| **Empty states** | `.empty-state`, single implementation, 13 occurrences across 10 pages — consistent. |
| **Loading states** | `.spinner`, single implementation, 29 occurrences across 24 pages — consistent. |
| **Skeleton loading** | A `skeleton`/`skeleton-pulse` keyframe pair exists in CSS but has **zero confirmed HTML usage anywhere** — a built-but-never-adopted pattern (flagged originally in Sprint 2's dead-code audit, status unchanged). |
| **Charts** | Chart.js-based, per project context; not independently re-audited in this pass (out of CSS-token scope). |
| **Statistics cards** | Covered by the now-unified card system (`summary-card` family) — no separate treatment needed. |

---

# 2. Design Tokens (extracted directly from the current `:root`, nothing invented)

### Colors
| Role | Token | Resolves to (dark) |
|---|---|---|
| Success | `--color-success` | `--green` (`#00e676`) |
| Warning | `--color-warning` | `--yellow` (`#ffc107`) |
| Danger | `--color-danger` | `--red` (`#f44336`) |
| Info | `--color-info` | `--blue` (`#2196f3`) |
| Neutral | `--color-neutral` | `--gray` |
| Interactive (primary-ish) | `--color-interactive` | `--orange` (`#ff6b35`) |
| Text primary/secondary/tertiary/disabled | `--color-text-primary/secondary/tertiary/disabled` | `--text`/`--text-sub`/`--text-gray`/`--text-muted` |
| Surface base/raised/overlay/sunken | `--surface-base/raised/overlay/sunken` | `--bg`/`--bg-2`/`--bg-3`/`--bg-4` |
| Border subtle/default/strong/interactive | `--border-subtle/default/strong/interactive` | `--border-3`/`--border`/`--border-2`/`--color-interactive` |

### Typography
- Font families: `Cairo` (body), `Lexend` (numeric/headings), `monospace` (rare)
- Font sizes: 32 distinct raw values — **no named scale exists**
- Font weights: 600 / 700 / 800 only (a genuinely small, consistent set)
- Line heights: not centrally tokenized; used ad hoc per rule

### Spacing
- 32 distinct padding values in `styles.css` — **no named scale exists**
- Card family is the one exception, using `--card-pad-sm/md/lg/xl` (12/16/18/20px)

### Radius
- Card family: `--card-radius-sm/md/lg/xl` (12/14/16/18px)
- Input: `--input-radius` (10px)
- Everything else: raw literals, no shared scale

### Elevation
- `--card-shadow` (single token, themed) — the only shadow token in the project
- Modals and a few other surfaces use their own hardcoded `box-shadow` values

### Motion
- Durations: `--motion-duration-fast` (150ms), `--motion-duration-base` (250ms), `--motion-duration-slow` (400ms)
- Easing: `--motion-easing-standard/decel/accel/spring` (all defined, M3-inspired)
- Hover states: handled per-component (e.g. `.action-btn:hover`, `.summary-card:hover`) — no shared "hover token," which is normal/expected since hover effects are inherently component-specific

### Opacity
- No dedicated opacity tokens — alpha values appear only inline within `rgba()`/`color-mix()` calls, on a per-declaration basis

### Z-index
- **13 distinct raw values today** (1, 2, 3, 50, 200, 1000, 1050, 2000, 2001, 3000, 8999, 9500, 9999) — **no named scale exists**, unchanged in kind from the original Architecture Audit's finding (the exact value set has shifted slightly as new UI — modals, notifications — was added, but the underlying gap is identical)

### Breakpoints
- 3, unnamed: `max-width:768px`, `max-width:991px`, `min-width:992px`

---

# 3. Component Inventory

| Component | Usage count | Files | Variations | Inconsistencies |
|---|---|---|---|---|
| **Buttons** (`.action-btn`) | ~189 occurrences | 17 pages | primary / danger / sm (+combinations) | None — this is the project's reference-quality component |
| **Cards** (unified family) | 15 pages use at least one card variant | 15 pages | 9 legacy class *names* still exist in HTML (aliased to one CSS system) | Naming only, not visual — a future cleanup task, not a live bug |
| **Tables** | 8 pages use some form of table | `.tbl` (6 pages), `.data-table` (1 page, unstyled), inline (1 page: `dashboard.html`) | 3 structurally different implementations | The project's single largest remaining component-level inconsistency |
| **Badges** (`type-badge`) | ~30 occurrences | 11 pages | gray/tarbiya/tasmeen/danger/blue/yellow/purple | Naming of `badge-tarbiya`/`badge-tasmeen` is domain-specific rather than semantic (minor, cosmetic) |
| **Forms/Inputs** (`.field`) | Used across most data-entry pages (exact count not separately tallied this pass) | Most pages with forms | None documented | No error/success/disabled state variants exist yet |
| **Modals** (`.farm-modal`) | ~30+ `showModal()` calls | 10 pages | sm/md/lg/xl (+legacy narrow/wide aliases) | Sizing is now systematic; some call sites likely still pass inline styles rather than the size classes (not re-audited line-by-line this pass) |
| **Navbar** | Universal (rendered via shared mechanism) | All pages with a navbar | Single implementation | None |
| **Sidebar** | Universal | All pages with navigation | Single implementation | None |
| **Dropdowns** | Present wherever a Bootstrap dropdown is used | Multiple pages | Bootstrap default, no override layer | None found — low customization also means low risk |
| **Toasts** | `--toast-bg` token exists | Unconfirmed whether a full toast *component* (vs. just the color token) exists independently — not re-verified line-by-line this pass | — | Worth a dedicated, narrow follow-up check |
| **Empty states** (`.empty-state`) | 13 occurrences | 10 pages | None | Consistent |
| **Loading/Spinner** (`.spinner`) | 29 occurrences | 24 pages | None | Consistent |
| **Skeleton** | 0 confirmed uses | None | Defined, unused | A ready-but-dormant component |

---

# 4. Consistency Report

| Finding | Classification |
|---|---|
| 9 card class names still present in HTML despite unified CSS | **Safe to unify** — purely a rename/cleanup exercise on already-proven-safe CSS; no visual risk |
| 3 table implementations | **Needs review** — the CSS-only aliasing pattern used for cards would work here too, but `.data-table`'s complete absence of prior styling means "unify" here also means "decide what it should look like for the first time," which benefits from a quick visual sign-off, not just a mechanical merge |
| Typography scale absent (32 values) | **Needs review** — defining a scale is easy; retrofitting 32 existing values into it safely, without any visual drift, needs a careful mapping pass |
| Spacing scale absent (32 values) | **Needs review** — same reasoning as typography |
| Z-index scale absent (13 values) | **Risky** — of everything in this list, this is the one area where a careless "cleanup" could introduce a real, hard-to-spot stacking-order regression (a toast hidden behind a modal, etc.); requires deliberate, tested reordering, not a blind token swap |
| Icon system split (Bootstrap Icons vs. raw SVG, 2 pages) | **Safe to unify** — small, contained, low-traffic pages (`dashboard.html`, `dead.html`) |
| Skeleton loading pattern built but unused | **Product decision** — adopt it somewhere real, or remove the dead CSS; not a technical unification question |
| `badge-tarbiya`/`badge-tasmeen` naming | **Product decision** — whether to rename toward a more generic semantic naming convention is a product/domain-language choice, not a technical fix |
| Duplicate inline styles (e.g. repeated `align-items:center;display:flex` pairs, ~29+28 occurrences per the original CSS Health audit) | **Safe to unify** — classic utility-class extraction candidate (e.g. a `.flex-center` class), zero behavioral risk |

---

# 5. Design System Proposal — **Farm Design System v1**

**Guiding principle, stated once and applied throughout:** this system codifies what already works (buttons, badges, cards, modals) and defines a clear path for what doesn't yet (tables, typography, spacing, z-index) — it does not propose replacing any working part of the current UI.

### Design Tokens
Adopt the existing 3-tier structure as the permanent, documented standard (Tier-1 raw → Tier-2 semantic → Tier-3 component). **New addition proposed:** two missing tiers of tokens, defined the same way the card/modal scales were —
- `--text-xs/sm/md/lg/xl/2xl` (a proposed typography scale, mapped from the existing 32 values during implementation, not invented from nothing)
- `--space-1` through `--space-8` (a proposed 4px/8px-based spacing scale, same mapping approach)
- `--z-dropdown/navbar/modal/toast` (a named z-index scale, replacing the 13 raw values with meaningful names)

### Component Library
Documented as a living reference of what already exists and is approved for reuse: `.action-btn` (+ modifiers), `.type-badge` (+ modifiers), the unified card primitive, `.farm-modal` (+ size classes), `.field`, `.spinner`, `.empty-state`. **New, to be added:** a single `.data-grid` table primitive (replacing the 3 current implementations), following the exact same base-rule-plus-alias pattern already proven safe for cards.

### Layout Rules
`.page-wrap` (max-width: 1200px) remains the single page-container standard, already applied consistently. No change proposed here — it already works.

### Motion Rules
The existing motion tokens (`--motion-duration-fast/base/slow`, easing curves) become the mandatory reference for any *new* transition/animation written going forward; existing exact-value matches were already converted (Sprint 2), and remaining non-matching values are left as-is rather than force-fit to avoid visual drift.

### Accessibility Rules
Preserve current RTL correctness (already strong — 29 of 31 pages confirmed correct in earlier audits) and dark/light theme parity. **Flagged gap, carried forward from the Architecture Audit, not newly discovered:** near-zero use of `aria-*`/`alt` attributes project-wide — a real accessibility gap this design system should establish conventions for going forward (e.g., requiring `aria-label` on icon-only buttons as new components are built), rather than retrofitting all 31 pages at once.

### Naming Convention
Adopt a consistent, documented pattern for all *future* component work: `.component`, `.component--variant`, `.component--size` (double-hyphen BEM-style modifiers), matching the pattern already implicitly used by `.action-btn.primary`/`.action-btn.sm` conceptually, made explicit and consistent going forward. Existing single-hyphen or bare-modifier classes (`.action-btn.primary` itself) are **not** proposed to be renamed — this convention applies to new work, avoiding unnecessary churn on components that already work.

### CSS Variable Strategy
Continue the existing pattern exactly: Tier-1 (raw, theme-dependent) → Tier-2 (semantic, role-based) → Tier-3 (component-specific, referencing Tier-2). All new component work must resolve through Tier-3, never skip straight to Tier-1 — the one architectural rule this whole design system asks future work to actually follow consistently (the original audit's biggest finding was that this rule existed on paper but was frequently bypassed in practice).

### Bootstrap Override Strategy
Bootstrap remains the structural/utility base (grid, dropdowns, form layout primitives) exactly as today. This design system's CSS variables and component classes layer *on top of* Bootstrap's own classes, never replacing Bootstrap's own component CSS wholesale (e.g., `.dropdown-menu` stays Bootstrap's own implementation, unstyled by this system, exactly as it is now) — this preserves the "no rewrite" constraint by construction, not just by intention.

---

# 6. Implementation Roadmap

| Task | Scope | Est. LOC | Affected files | Risk | Rollback |
|---|---|---|---|---|---|
| **3.2 — Design Tokens** | Define the typography scale, spacing scale, and named z-index scale as new CSS variables (additive, `var(--x, fallback)` pattern) | ~40–60 | `styles.css` only | Low | Revert the token-definition commit; nothing consumes the new tokens yet at this stage |
| **3.3 — Buttons** | Documentation only — the component is already done; this task is writing down the existing pattern as the reference standard | ~0 code, a few paragraphs of docs | None (docs only) | None | N/A |
| **3.4 — Cards** | Rename the 9 legacy class names in HTML to the unified primitive's real name (`.card`/`.card--size`), page by page | ~5–20 lines per page × 15 pages | 15 HTML pages | Low (CSS already proven identical under the aliases) | Per-page revert |
| **3.5 — Forms** | Add `.field--error`/`.field--success` state variants; wire `.field` fully to the typography/spacing scale from 3.2 | ~20–30 | `styles.css` | Low | Revert commit |
| **3.6 — Tables** | Introduce `.data-grid` primitive; alias `.tbl`; give `.data-table` and the `dashboard.html` inline table real, reviewed styling | ~60–80 | `styles.css` + 8 HTML pages | Medium (highest-traffic data-display surface; needs visual sign-off for the previously-unstyled `.data-table`) | Per-page revert; keep `.tbl` alias live during transition |
| **3.7 — Navigation** | Apply the new z-index scale (from 3.2) to navbar/sidebar/dropdown stacking specifically | ~10–15 | `styles.css` | Medium (z-index changes are the one category with real regression risk, per Phase 4) | Full revert if any stacking-order break is found in manual QA |
| **3.8 — Feedback Components** | Apply the z-index scale to modals/toasts; resolve the skeleton-loading product decision (adopt or remove); confirm/build a proper toast component if the audit gap in Phase 3 turns out to be real | ~20–40 (more if toast needs building from scratch) | `styles.css`, possibly `shared.js` | Low-Medium | Per-change revert |
| **3.9 — Accessibility** | Establish `aria-label` conventions for new icon-only buttons/components going forward; audit the 2 SVG-icon pages for basic accessibility parity with the Bootstrap Icons pages | ~10–20 | `dashboard.html`, `dead.html`, plus a documentation addition | Low | Per-page revert |
| **3.10 — Documentation** | Consolidate everything above into a single, versioned `design-system.md` reference — the artifact that prevents this exact kind of multi-task audit from being needed again in the future | 0 code, 1 new doc file | New file only | None | Delete the file |

---

# 7. Estimated Project Size
**~160–250 LOC total across Tasks 3.2–3.9**, plus one documentation file (3.10) — smaller than it might first appear, because Buttons/Cards/Modals/Badges are already done and Tasks 3.3–3.4 are mostly renaming/documentation rather than new CSS. The two tasks carrying real implementation weight are **3.6 (Tables)** and **3.2 (Tokens)** — consistent with Phase 4's finding that tables and the missing scales are the project's actual remaining gaps, not a broad rewrite.

# 8. Risk Assessment
**Overall: Low-Medium.** Every task builds on a pattern (base-rule-plus-alias, additive tokens with fallbacks) already proven safe in Sprint 2's card/modal work — this is not new methodology, it's the same approach applied to the remaining gaps. **The one task warranting real caution is 3.7 (z-index applied to navigation)**, flagged consistently as "Risky" in Phase 4 and "Medium" here — stacking-order regressions are the single failure mode in this entire roadmap that's genuinely easy to miss in casual testing and needs a deliberate manual QA pass (open a modal while a toast is visible, etc.), not just a visual diff.

# 9. Wait for approval
**No code was written. No files were modified. No CSS was created.** This is a proposal and roadmap only, awaiting a decision on which task (if any) to begin with.
