# Sprint 3 — Task 3.2: Design Tokens Extraction & Standardization Plan
**Status: Extraction and specification only. No CSS modified, no classes renamed, no code written.**

---

# 1. Typography Audit

### Font-family
| Value | Occurrences |
|---|---|
| `'Cairo', sans-serif` | 7 declarations |
| `'Lexend', sans-serif` | 6 declarations |

Two families only — body/UI text (Cairo) and numeric/display text (Lexend). This is already a clean, minimal set; **no inconsistency found here.**

### Font-weight
| Value | Occurrences |
|---|---|
| `700` | 13 |
| `600` | 7 |
| `800` | 3 |

Three weights only — also already clean and consistent.

### Line-height
| Value | Occurrences |
|---|---|
| `1.1` | 2 |
| `1` | 1 |
| `1.5` | 1 |

Barely used at all as an explicit property (most rules rely on the browser default) — too sparse to reveal a pattern either way.

### Letter-spacing
| Value | Occurrences |
|---|---|
| `.08em` | 1 |
| `.5em` | 1 |

Two isolated uses — not a pattern, just two one-off decorative choices (likely uppercase-label styling).

### Font-size — the real inconsistency
**32 distinct values across 44 declarations.** Grouped by frequency:

| Value | Count | Value | Count | Value | Count |
|---|---|---|---|---|---|
| `1.1rem` | 3 | `.78rem` | 2 | `.9rem` | 1 |
| `.92rem` | 3 | `1.35rem` | 2 | `1.8rem` | 1 |
| `.76rem` | 3 | `.72rem` | 2 | `20px` | 1 |
| `.86rem` | 2 | `.73rem` | 2 | `.83rem` / `.95rem` / `.75rem` / `1rem` | 1 each |
| `.82rem` | 2 | `.58rem` | 1 | `.81rem` / `.71rem` / `.93rem` | 1 each |
| `19px` | 1 | `16px` | 1 | `1.45rem` / `.88rem` / `1.75rem` | 1 each |
| `.63rem` | 1 | | | `1.2rem` / `2.6rem` / `.66rem` | 1 each |
| | | | | `.85rem` / `1.5rem` / `.98rem` | 1 each |

**Duplicates found:** several near-identical values that likely represent the *same* intended size, written slightly differently over time — e.g. `.72rem`/`.73rem`, `.81rem`/`.82rem`/`.83rem`, `.85rem`/`.86rem`/`.88rem`. These clusters are the clearest sign of organic drift (no scale to snap to, so each new rule picked "something close").

**Safe candidates for tokenization** (values used ≥2 times, and thus already establishing an implicit convention): `1.1rem`, `.92rem`, `.76rem`, `.78rem`, `1.35rem`, `.72rem`, `.73rem`, `.86rem`, `.82rem` — 9 values covering the majority of actual repeated usage. The remaining 23 single-use values are candidates for **snapping to the nearest safe candidate** during migration, not for becoming tokens themselves (a scale with 32 steps isn't a scale).

**Two non-rem outliers** (`19px`, `16px`, `20px`) — all in contexts using pixel-based sizing rather than rem, worth normalizing to rem during migration for consistency, though this is a unit-convention question, not a value question.

---

# 2. Spacing Audit

### Padding — 32 distinct values, 44 total declarations
| Value | Count | Value | Count |
|---|---|---|---|
| `5px 11px` | 3 | `9px` | 1 |
| `12px 16px` | 3 | `11px` | 1 |
| `14px` | 3 | `9px 11px` | 1 |
| `10px` | 2 | `32px` | 1 |
| `10px 8px` | 2 | `40px 20px` | 1 |
| `20px` | 2 | `6px` | 1 |
| `12px` | 2 | `8px 14px` | 1 |
| `18px` | 2 | `14px 12px` | 1 |
| `8px` | 2 | `6px 10px` | 1 |
| `5px 8px` / `18px 18px` / `11px 18px` / `8px 18px` / `14px 16px` / `24px 16px` / `10px 6px` / `7px 14px` / `4px 9px` / `5px 7px` / `3px 10px` / `24px` / `10px 16px` / `6px 14px` | 1 each | | |

### Margin — 11 distinct values, 23 total declarations
| Value | Count |
|---|---|
| `8px` | 4 |
| `10px` | 3 |
| `14px` | 3 |
| `3px` | 3 |
| `16px` | 2 |
| `4px` | 2 |
| `12px` | 2 |
| `8px 18px` / `6px` / `5px` / `280px` | 1 each |

*(`280px` is the one clear outlier — checked in context: it's the sidebar's fixed width value written as a `margin` shorthand component in one rule, not a spacing-scale candidate at all; it should be excluded from any spacing-scale discussion.)*

### Gap — 9 distinct values, 16 total declarations
| Value | Count |
|---|---|
| `10px` | 3 |
| `12px` | 3 |
| `8px` | 2 |
| `5px` | 2 |
| `7px` | 2 |
| `11px` / `6px` / `9px` / `4px` | 1 each |

### Safe scale proposal — built only from values that already exist
Combining all three categories, the values that recur across **multiple** categories and cleanly fit a 4px-based progression are: **4, 8, 12, 16, 20, 24, 32, 40** — every one of these numbers already appears somewhere in the current CSS (confirmed directly above, not invented). This becomes the proposed scale.

**Values that do NOT cleanly fit this progression** (and would need a judgment call during migration, not an automatic snap): `3px`, `5px`, `6px`, `7px`, `9px`, `10px`, `11px`, `14px`, `18px`. These are all "off by a couple pixels" from a clean 4-multiple — likely candidates to round to the nearest scale step (e.g. `3px`→`4px`, `6px`/`7px`→`8px`, `9px`/`10px`/`11px`→`8px` or `12px` depending on visual context, `14px`→`12px` or `16px`, `18px`→`16px` or `20px`) — **but rounding any of these is a visual-risk decision requiring a case-by-case check, not a blind mechanical replace**, since even a 1–2px change can be visible in tight UI like button padding.

---

# 3. Z-index Audit

| Value | Selector / usage | File | Overlapping dependency? |
|---|---|---|---|
| `1050` | `.navbar-wonder` (sticky top navbar) | `styles.css` | None — highest among "always visible" chrome, correctly below overlays |
| `2000` | `.sidebar-overlay` (mobile sidebar backdrop) | `styles.css` | Must stay below `2001` (its own panel) — currently correct |
| `2001` | `.sidebar-menu` (mobile sidebar panel) | `styles.css` | Correctly 1 above its own overlay (`2000`) |
| `200` | `.sidebar-menu` (desktop/tablet `@media` override — a *second*, lower value for the same selector at a different breakpoint) | `styles.css` | **Same selector, two very different z-index values depending on breakpoint** — not a bug (different layout contexts), but worth naming distinctly rather than assuming one name covers both |
| `200` | `#data-menu` inline dropdown | `animals.html` | Coincidentally the same numeric value as the sidebar's breakpoint override above — almost certainly unrelated in intent, just a coincidence worth flagging so a future "clean up z-index" pass doesn't assume these two are meant to be linked |
| `3000` | `.farm-modal-backdrop` (modal backdrop) | `styles.css` | **Shares its exact value with `.notif-dropdown` below** |
| `3000` | `.notif-dropdown` (notification dropdown panel) | `styles.css` | **Real overlap: if a notification dropdown is open and a modal opens at the same time, their relative stacking is decided by DOM paint order, not z-index priority, since both request the same layer.** This is the single most concrete "overlapping dependency" this audit found. |
| `9999` | `#toast-wrap` (toast container) | `styles.css` | **Shares its exact value with the tooltip rule and the tour overlay below** |
| `9999` | `[data-hint]:hover::after` (tooltip) | `styles.css` | Same overlap category as above |
| `9999` | Tour overlay (`FarmTour`, built inline) | `pages/tour.js` | Same overlap category — three independent features all claim the same top-of-stack value |
| `9500` | Datepicker overlay | `pages/datepicker.js` | Sits just below the toast/tooltip/tour tier — no direct conflict found, but close enough that any future addition near this value should be deliberate |
| `8999` | Sync-status widget | `offline-sync.js` | Isolated, single use, no conflict found |
| `1000` | `.fab-btn-tasks` (floating action button) | `tasks.html` | |
| `1000` | Inline FAB (same pattern) | `pages/production.js` | Same value, same *kind* of element (a FAB) — this one is a **consistent, intentional reuse**, not a conflict |
| `50` | `.shortcuts` (sticky shortcut bar) | `bayan.html`, `bayan-offline.html` | Isolated to the self-contained `bayan*` pages (confirmed elsewhere in this project's history to be an independent styling system) — no interaction with the rest of the app's stacking context |
| `1`, `2`, `3` | Tour step backdrop/highlight/tooltip layering | `pages/tour.js` | These are deliberately small, *local* values — the tour widget creates its own nested stacking context, so `1`/`2`/`3` only need to out-rank each other *within* that context, not the whole page. Not directly comparable to the global-scope values above; worth naming separately to avoid confusing them with the page-level scale. |

**Semantic names proposed (mapping only — no numeric value changes, per instructions):**

| Proposed token | Numeric value | Maps to |
|---|---|---|
| `--z-sidebar-mobile-alt` | 200 | `.sidebar-menu`'s breakpoint override, and (separately documented as coincidental) `#data-menu` |
| `--z-fab` | 1000 | Floating action buttons (`tasks.html`, `pages/production.js`) |
| `--z-navbar` | 1050 | `.navbar-wonder` |
| `--z-sidebar-overlay` | 2000 | `.sidebar-overlay` |
| `--z-sidebar-panel` | 2001 | `.sidebar-menu` (default) |
| `--z-modal-backdrop` | 3000 | `.farm-modal-backdrop` |
| `--z-notif-dropdown` | 3000 | `.notif-dropdown` *(documented as sharing a tier with modals — a flagged overlap, not silently resolved)* |
| `--z-datepicker` | 9500 | `pages/datepicker.js`'s overlay |
| `--z-sync-widget` | 8999 | `offline-sync.js`'s status widget |
| `--z-toast` | 9999 | `#toast-wrap` |
| `--z-tooltip` | 9999 | `[data-hint]:hover::after` *(flagged overlap with toast)* |
| `--z-tour-overlay` | 9999 | `pages/tour.js`'s top-level overlay *(flagged overlap with toast/tooltip)* |
| `--z-tour-local-1/2/3` | 1 / 2 / 3 | `pages/tour.js`'s internal nested layers (documented as local-scope, not page-scale) |
| `--z-bayan-shortcuts` | 50 | `bayan.html`/`bayan-offline.html`'s sticky bar (isolated page system) |

---

# 4. Token Specification — Farm Design System, Design Tokens v1

### Colors *(already implemented, documented here for completeness)*
`--color-success/warning/danger/info/neutral`, `--color-interactive(-hover)`, `--color-text-primary/secondary/tertiary/disabled`, `--surface-base/raised/overlay/sunken`, `--border-subtle/default/strong/interactive` — all Tier-2 semantic tokens, all already in production use.

### Typography *(new — proposed)*
```
--text-2xs:  .58rem   /* smallest badge/label text */
--text-xs:   .72rem   /* covers .72/.73rem cluster */
--text-sm:   .82rem   /* covers .82/.83/.86rem cluster */
--text-base: .92rem   /* covers .9/.92/.93rem cluster */
--text-md:   1rem
--text-lg:   1.1rem
--text-xl:   1.35rem
--text-2xl:  1.8rem
```
*(8 steps, every step's value already exists in the current CSS — no invented numbers.)*

### Spacing *(new — proposed)*
```
--space-1: 4px
--space-2: 8px
--space-3: 12px
--space-4: 16px
--space-5: 20px
--space-6: 24px
--space-7: 32px
--space-8: 40px
```
*(8 steps, matching Phase 2's "safe scale proposal" exactly.)*

### Radius *(already implemented for cards/inputs, documented here)*
`--card-radius-sm/md/lg/xl` (12/14/16/18px), `--input-radius` (10px).

### Shadow *(already implemented)*
`--card-shadow` (single themed token).

### Opacity *(new — proposed, minimal)*
No dedicated tokens exist today; given the sparse, ad-hoc use of alpha values (mostly inside `color-mix()`/`rgba()` calls already tied to specific components), **no generic opacity scale is proposed** — inventing one wouldn't map to anything real in the current codebase, which the instructions explicitly rule out.

### Motion *(already implemented)*
`--motion-duration-fast/base/slow` (150/250/400ms), `--motion-easing-standard/decel/accel/spring`.

### Z-index *(new — proposed, per Phase 3's table above)*
`--z-sidebar-mobile-alt`, `--z-fab`, `--z-navbar`, `--z-sidebar-overlay`, `--z-sidebar-panel`, `--z-modal-backdrop`, `--z-notif-dropdown`, `--z-datepicker`, `--z-sync-widget`, `--z-toast`, `--z-tooltip`, `--z-tour-overlay`, `--z-tour-local-1/2/3`, `--z-bayan-shortcuts`.

### Naming convention
`--{category}-{role}` for semantic tokens (`--color-success`, `--z-navbar`), `--{category}-{scale-step}` for scale tokens (`--text-sm`, `--space-3`) — consistent with the naming already used for the existing card/modal scales (`--card-radius-md`, `--modal-width-lg`).

---

# 5. Migration Plan (estimates only — no code written)

| Token category | Files affected | Est. LOC | Risk | Rollback |
|---|---|---|---|---|
| Typography scale definition | `styles.css` (new `:root` block only) | ~10 | Low — purely additive, nothing consumes it yet at definition time | Delete the new block |
| Typography scale *application* (retrofitting the 44 existing declarations) | `styles.css` | ~44 (one line touched per declaration, though many can share a single find/replace per exact value) | Medium — the 23 single-use "snap to nearest" values each need a visual check, not a blind replace | Per-declaration revert; safest done in small batches (e.g. one component family at a time) |
| Spacing scale definition | `styles.css` | ~8 | Low — additive only | Delete the new block |
| Spacing scale *application* | `styles.css` | ~83 (44 padding + 23 margin + 16 gap declarations, though the 9 already-clean 4-multiples need no visual check, only the 9 off-scale values do) | Medium — same reasoning as typography: most of this is safe exact-value substitution, but the rounding decisions for off-scale values carry real (if small) visual risk | Per-declaration revert, same batching approach |
| Z-index semantic naming | `styles.css` (definitions) + `styles.css`/`tasks.html`/`animals.html` (consumption, 6 rules) + `offline-sync.js`, `pages/datepicker.js`, `pages/tour.js` (consumption, 4 more locations) | ~20 (definitions) + ~10 (consumption sites, since numeric values don't change, only the property value swaps from a literal number to `var(--z-x)`) | **Low for the swap itself** (values are unchanged, per instructions) — but this category carries the project's only real *pre-existing* risk regardless of this task: the two confirmed overlaps (`modal-backdrop`/`notif-dropdown` both at 3000; `toast`/`tooltip`/`tour-overlay` all at 9999) are not fixed by naming alone, and naming them clearly is likely to make a future engineer *want* to fix the overlap — which would be a real numeric change, out of this task's scope | Per-file revert |
| Documentation (this specification, formalized) | New file only | ~0 (already produced in this report) | None | Delete the file |

---

# 6. Estimated LOC
**~175 lines total** across all categories: ~18 for new token *definitions* (typography + spacing, additive), ~127 for *retrofitting* existing declarations to reference those tokens (typography + spacing application), ~30 for z-index (definitions + consumption-site swaps). The bulk of the effort is in careful, incremental *application* to existing rules, not in defining the tokens themselves, which is small and low-risk.

# 7. Risk Assessment
**Overall: Low-Medium**, consistent with Task 3.1's roadmap-level estimate for this same work. **Typography and spacing application carry Medium risk specifically because of the "off-scale value" rounding decisions** (9 spacing values, several font-size clusters) — these are visual judgment calls, not mechanical substitutions, and should be done in small, individually-reviewable batches rather than one large sweep. **Z-index carries the project's one standing structural risk** (the two confirmed value-overlaps) — naming them doesn't fix them, but doing so is expected to surface the question of whether to fix them, which this task deliberately does not decide, per its own "do not change numeric values" instruction.

# 8. Wait for approval
**No CSS was modified. No classes were renamed. No token was implemented.** This specification is ready for a decision on which category (typography, spacing, or z-index naming) to implement first, and whether the two identified z-index overlaps should be addressed now or left as a documented, known characteristic of the current design.
