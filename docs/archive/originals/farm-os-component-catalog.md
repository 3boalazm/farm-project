# Farm OS Component Catalog & Design System Reference
**Status:** The single source of truth for every UI component in Farm OS. Built strictly on top of *Future UI Architecture*, *UX Constitution*, and *Design Execution Blueprint* — no new design decisions are introduced here; this document specifies, in implementation-ready detail, components those three documents already require.

**Grounding note:** Wherever a component already exists in the live codebase (verified directly, not assumed), this document says so and formalizes it. Wherever a component is new — required by the prior documents but not yet built — this document says that explicitly. Nothing here is presented as "already built" unless it is.

---

# SECTION 1 — Design System Overview

**Component Philosophy:** A component exists only if an existing one cannot serve the need (UX Constitution §2, Principle 2). Every component in this catalog is either (a) a formalization of something already implemented and working in Farm OS, or (b) a genuinely new requirement traced directly to a rule in the three prior documents.

**Reuse Rules:** Before any new component is built, the Component Dependency Graph (Section 18) must be checked — if the need can be met by composing existing components differently, that is always preferred over creating a new one.

**Composition Rules:** Complex components are built from simpler ones (a KPI Card is a Section Container + a Metric + a Badge, not an independent build). No component duplicates the internal logic of another; it composes it.

**Inheritance Rules:** All components inherit spacing, typography, and color exclusively from the token layer (Sections 12–14) — no component defines its own one-off value for any of these.

**Naming Convention:** `[Category]-[Component]-[Variant]`, e.g., `Data-KPICard-Alert`, `Farm-StatusBadge-Quarantine`, `Button-Primary-Small`. Matches this project's existing CSS class conventions (`action-btn primary`, `type-badge`) rather than inventing a new naming scheme.

**Variant Strategy:** A variant changes visual treatment without changing behavior (e.g., KPI Card's normal/watch/alert coloring). A new *component* is required, not a variant, only when behavior itself differs.

**State Strategy:** Every interactive or data-driven component defines, at minimum: default, loading, empty, error. Components with user interaction additionally define hover/focus/active/disabled. No component ships without these defined (Design Execution Blueprint §8).

**Component Hierarchy:**
```
Tokens → Layout Components → Navigation Components → Data Components →
Farm Components → Forms → Buttons → Feedback Components → Charts → Tables → Cards
```

---

# SECTION 2 — Layout Components

| Component | Purpose | Hierarchy | Usage | Variants | States | Spacing | Allowed children | Forbidden usage | Example |
|---|---|---|---|---|---|---|---|---|---|
| **App Shell** | The one structural frame every page renders inside | Level 1 (outermost) | Every page, no exception | None — exactly one shell exists | default; sidebar-collapsed (mobile) | Fixed sidebar width (desktop); off-canvas overlay (mobile) | Sidebar, Header, one page's content region | A page rendering its own header/nav outside the shell | Every current page already uses this pattern via `nav.js`; formalized here |
| **Sidebar** | Global navigation, always present | Inside App Shell | Every page | Expanded (desktop), off-canvas drawer (mobile) | default, item-active, item-hover | Existing sidebar item spacing, retained | Sidebar Group, Sidebar Item | A second, competing navigation element anywhere on a page | Already exists (`nav.js`); reorganized per Design Execution Blueprint §10's grouped hierarchy |
| **Top Navigation** | N/A as a separate component | — | Farm OS uses a Sidebar, not a top nav bar, as its primary navigation | — | — | — | — | Introducing a top nav bar in addition to the Sidebar (violates "never invent navigation," Blueprint §12) | Explicitly excluded from this system |
| **Header** | Global, page-independent actions | Inside App Shell, above content | Every page | None | default | Fixed height, sticky on scroll (desktop/tablet) | Global Search, Notification Bell, User Menu | Module-specific actions living here instead of in Page Header | Formalizes the existing header pattern |
| **Page Header** | Page title, primary action, breadcrumb | Level 2 | Every page | with-breadcrumb (Listing/Detail), without (Dashboard/Settings) | default | Sticky on Listing/Detail templates per Blueprint §3 | Breadcrumb, one Primary Button | More than one visually-primary action | Already partially exists (`renderPageHeader()`); formalized and made universal (currently inconsistent — `settings.html` doesn't use it) |
| **Breadcrumb** | Show module context | Inside Page Header | Listing, Detail | None | default | Inline with Page Header title | Text links only | Present on Dashboard or Settings | New requirement — not consistently implemented today |
| **Section Container** | Titled, bounded content grouping | Level 3+ | Any page needing grouped content | default, highlighted (warning-tinted border, existing pattern) | default | Section-to-section spacing per Section 13 | Any Data/Farm/Form component | Nesting a Section Container inside another Section Container | Formalizes the project's existing card-family consolidation work |
| **Content Grid** | The underlying grid all page content sits in | Level 3 | Every page | 12-col (desktop), 8-col (tablet), 1-col (mobile) | — | Per Blueprint §3 | Any layout/data component | A page-specific custom grid | Bootstrap's existing grid, retained exactly |
| **Responsive Grid** | Same as Content Grid — the responsive behavior of the same system, not a separate component | — | — | — | — | — | — | Treating this as a second, different grid system | Clarification only — one grid, responsive by definition |
| **Sticky Header** | Keep Header reachable while scrolling | Behavior of Header | Desktop/tablet | — | — | — | — | Sticky behavior on mobile (off-canvas instead) | Per Blueprint §3 |
| **Sticky Sidebar** | Keep Sidebar reachable while scrolling | Behavior of Sidebar | Desktop/tablet only | — | — | — | — | Sticky on mobile (drawer instead) | Per Blueprint §3 |
| **Page Footer** | Farm name, year — Background priority | Level 8 (lowest) | Every page | None | default | Minimal, never competes visually with any content above | Text only | Any action or navigation element (footer is informational only) | Already exists; formalized as Background-tier per UX Constitution §5 |

---

# SECTION 3 — Navigation Components

| Component | Purpose | Usage | Variants | States | Notes |
|---|---|---|---|---|---|
| **Sidebar Item** | One navigable destination | Inside Sidebar Group | icon+label (default), icon-only (collapsed) | default, hover, active, disabled (permission-gated) | Already exists; each item's `href` already comes from a single source (`nav.js`) |
| **Sidebar Group** | A labeled cluster of related destinations | Inside Sidebar | Overview / Herd / Operations / Finance / Reports / Administration (per Blueprint §10) | expanded, collapsed | New — today's sidebar is a flat list; grouping is a required, not optional, change |
| **Expandable Menu** | A Sidebar Group that can collapse to save space | Same as Sidebar Group | expanded, collapsed | default, hover | Same component as Sidebar Group — "expandable" describes its behavior, not a separate component |
| **Search / Global Search** | One product-wide search entry point | Header, always present | Compact (collapsed icon) / expanded (active input) | idle, typing, results, no-results | New — no cross-module search exists today; results grouped by type per Blueprint §10 |
| **Notification Bell** | Entry point to the existing notification system | Header, always present | default, unread-badge | default, has-unread, open (dropdown) | Already exists (`notifications-service.js`); formalized as universally present, not page-dependent |
| **User Menu** | Role/name display + quick settings access | Header, always present | default | default, open | New requirement for full consistency — today inconsistent across pages |
| **Breadcrumb** | See Section 2 | — | — | — | — |
| **Quick Actions** | Not part of this system | — | — | — | Explicitly excluded — Blueprint §10 defers "shortcuts" to a future phase; a design AI must not invent this |
| **Favorites** | Not part of this system | — | — | — | Explicitly excluded per Blueprint §10 — reserved for future consideration only |
| **Recent Pages** | Not part of this system | — | — | — | Same — explicitly excluded from this phase |

---

# SECTION 4 — Data Components

| Component | Purpose | Anatomy | Variants | States | Max count | Notes |
|---|---|---|---|---|---|---|
| **KPI Card** | One metric, current value + trend, dashboard/overview significance | Label, value, trend indicator, status color | normal/watch/alert | default, loading (skeleton), empty | 4/row, 8 total (Dashboard); 4 total (Module Overview) | Formalizes existing `summary-card` pattern into one governed component |
| **Metric Card** | A lighter-weight KPI Card for Detail-template contexts | Label + value only, no trend | None | default | No hard cap (contextual, e.g. one animal's current weight) | New — distinct from KPI Card specifically so Detail pages don't visually claim dashboard-level significance (Constitution §4) |
| **Analytics Card** | A Section Container specifically wrapping one Chart Container + its title/filter | Title, filter control, Chart Container | None | Inherits Chart Container's states | Governed by Section 7 chart-count limits | Formalizes the "every chart lives inside a titled container" rule |
| **Chart Container** | Wraps any chart with consistent header/states | Title, optional filter, chart area, legend (if applicable) | Per chart type (Section 9) | loading, populated, empty, error (mandatory text/table fallback) | — | The single mandatory wrapper for every chart in the product, no exceptions |
| **Progress Widget** | Threshold/stock-level indicator (not a chart) | Label, bar, current/threshold values | default, warning (near threshold), critical (over/under threshold) | default, loading | Used exclusively for Inventory per Constitution §6 | New — inventory currently has no visual stock-level indicator |
| **Data Table** | Structured, sortable, filterable record browsing | Header row, sortable columns, row actions, pagination | Canonical / Compact / Analytics / Grouped / Expandable (Section 10) | loading (skeleton), empty, populated, error | One primary table per Listing screen | Formalizes and unifies this project's previously-fragmented `.tbl`/`.data-table`/inline-table implementations into one component |
| **Timeline** | Chronological, heterogeneous event history for one record | Ordered event list, date markers, event-type icons | None | populated, empty ("no recorded history yet") | Every Detail template | New, universal component — today only some pages have anything resembling this |
| **Activity Feed** | Farm-wide (not record-specific) recent-actions log | Same visual language as Timeline, but cross-record | None | populated, empty | Dashboard only (Tier 3) | Distinct from Timeline by scope (farm-wide vs. one record), not by visual treatment |
| **Statistic Block** | A single, isolated number with a label — no trend, no chart | Label + value | None | default | Used inline within other components (e.g., inside a Section Container header) | The simplest data component — a building block for others, not typically used standalone |
| **Score Card** | Specifically the Farm Health Score display | Composite 0–100 value, radial/gauge treatment | None — exactly one instance in the product | default, loading | Exactly one, Dashboard only | New — this is the single new visual element introduced by the redesign (Future UI Architecture §4) |
| **Summary Card** | General grouped-content card (formalization of the existing `summary-card`) | Title, grouped content | default | default | Governed by Section 11 card rules | Retained from the existing codebase, now governed by this catalog rather than ad hoc |

---

# SECTION 5 — Farm Components

| Component | Purpose | Anatomy | Variants (states) | Notes |
|---|---|---|---|---|
| **Animal Card** | Compact animal representation for grid/card views | Photo/placeholder, tag, breed, Status Badge, quick-action icons | Per `ANIMAL_STATUS` (alive/healthy/under_treatment/quarantine/sold/dead) | Alternative to a Data Table row on Animals Listing (per UX Constitution §4's Card rule — used when browsing benefits from a card grid over a dense table) |
| **Animal Summary** | A compact, non-card inline animal reference (e.g., inside a Timeline entry: "→ Tag #2481") | Tag + small Status Badge | Same status set | New — needed anywhere an animal is referenced outside its own Detail page |
| **Status Badge** | Compact status communication for any record type | Icon + short label, semantic color | One per defined status value in the relevant status set | Already exists (`statusBadge()`) — formalized and extended to non-animal record types (task status, transaction status) under the same component, not a new one per domain |
| **Breed Badge** | Compact breed identifier | Short label only, neutral color (breed is identity, not status — never uses semantic/status color) | One per breed in the farm's records | New, distinct from Status Badge specifically because breed is not a status |
| **Health Badge** | Same component as Status Badge, applied to health-specific statuses (active treatment, resolved) | — | — | Not a separate component — a Status Badge instance, documented separately here only because Health is a distinct domain in the IA |
| **Alert Card** | Attention-requiring item outside routine flow | Severity icon, message, source link, dismiss action | info / watch / critical (exactly three, per UX Constitution §4) | New universal component — today, alerting exists only informally |
| **Production Widget** | Compact metric + trend for one production line | Label, value, small trend indicator | milk / meat / growth (data-driven, not visual variants) | A Metric Card specialization for Production data specifically |
| **Farm Score Indicator** | Same as Score Card (Section 4) — documented here as the Farm-specific instance of that general component | — | — | One component, cross-referenced, not duplicated |
| **Barn Card** | Compact barn/location representation | Name, capacity indicator, quick link to animals in that barn | default | New — supports the Barns module's existing but under-designed page |
| **Inventory Card** | Compact stock item representation | Name, Progress Widget (stock level), quick-adjust action | default, low-stock (triggers Alert Card elsewhere) | Composes Progress Widget rather than duplicating its logic |
| **Finance Card** | Compact transaction/category representation | Label, amount, category icon | income / expense (color-coded via semantic success/danger, not a new palette) | New, for Finance Listing's card-view alternative to its table |
| **Task Card** | Compact task representation | Label, due date, status | due / overdue / done (overdue maps to Alert-worthy priority per UX Constitution §5) | New, supports Dashboard's Tasks block and the Tasks module |
| **Notification Card** | One notification's compact representation inside the Notification Bell dropdown | Icon, message, timestamp, read/unread indicator | read / unread | Already partially exists (`notifications-service.js`'s rendering) — formalized here |

---

# SECTION 6 — Forms

| Component | Purpose | Variants | States |
|---|---|---|---|
| **Text Field** | Single-line text input | default | default, focus, error (inline, field-level per Constitution §7), disabled, readonly |
| **Search Field** | Text Field specialized for search context | Header (Global Search) / inline (table filter) | Same as Text Field, plus "has-results"/"no-results" |
| **Number Field** | Numeric input (weights, quantities, amounts) | default | Same as Text Field |
| **Date Picker** | Date selection | Already exists (`pages/datepicker.js`) — retained, formalized | Same as Text Field |
| **Dropdown** | Single-selection from a defined list | default | default, open, selected, disabled |
| **Checkbox** | Multi-select / boolean toggle | default | default, checked, disabled |
| **Radio** | Single-select from a small visible set | default | default, selected, disabled |
| **Switch** | Boolean toggle, specifically for settings-style on/off | default | on, off, disabled |
| **Textarea** | Multi-line text input | default | Same as Text Field |
| **Modal Form** | Any create/edit form, always inside the existing centralized modal system | sm/md/lg/xl (existing tiers only, per Blueprint §11) | default, validating, submitting, success |
| **Wizard** | Multi-step form | Not currently required by any known Farm OS flow | Explicitly not built until a real multi-step need is identified — inventing one now would violate "never invent" (Blueprint §12) |
| **Validation / Errors** | Field-level, inline messaging | — | Shown only on the specific invalid field, never a generic top-of-form banner alone |
| **Success** | Confirmation after a successful submit | — | Toast (Section 8), not an inline form state that lingers |
| **Disabled** | Non-interactive field state | — | Applies uniformly across all form components above |
| **Readonly** | Viewable but non-editable field state | — | Distinct from Disabled — used for Detail-template fields shown for reference, not editing |

---

# SECTION 7 — Buttons

| Component | Purpose | Usage rule |
|---|---|---|
| **Primary** | The one dominant action on any screen (`action-btn primary`, existing) | Exactly one visually-dominant primary button per screen — never two competing |
| **Secondary** | Supporting actions (`action-btn`, existing default) | Any number, always visually subordinate to Primary |
| **Ghost** | Not currently a distinct existing style — equivalent to Secondary's low-emphasis treatment | Documented for completeness; do not introduce a new visual treatment beyond existing Secondary unless a real need is identified |
| **Danger** | Destructive actions (`action-btn danger`, existing) | Always paired with a confirmation step (Constitution §2, Principle 13) |
| **Warning** | Not a distinct existing button style | Use Secondary + a warning-semantic icon rather than inventing a new button color tier |
| **Success** | Not a distinct existing button style | Confirmation of a positive action is communicated via Toast, not a permanently-success-colored button |
| **Icon Button** | Compact, icon-only action (existing `icon-btn` pattern) | Must always have an accessible label (Constitution §10, Question 46) |
| **Floating Button / FAB** | Persistent primary action, mobile-oriented | Already exists (`addFAB()`) — retained and formalized, shown only on mobile per its existing media-query behavior |
| **Button Groups** | Related actions clustered (e.g., view toggles: table/card) | New pattern, needed for Listing templates' table/card view switch |
| **Toolbar Buttons** | Secondary actions above a Data Table (filter, export, bulk action trigger) | Always Tier-appropriate (Blueprint §4) — never visually competing with the Page Header's Primary action |

---

# SECTION 8 — Feedback Components

| Component | Purpose | States | Notes |
|---|---|---|---|
| **Toast** | Immediate, transient feedback after an action | appear, auto-dismiss | Already exists (`toast()`) — the primary feedback mechanism for the whole product, retained exactly |
| **Snackbar** | Same purpose as Toast | — | Not a separate component — "Toast" is Farm OS's name for this pattern; do not introduce a second, differently-named equivalent |
| **Modal** | Focused single-task interaction | open, closing | Already exists (`showModal()`/`closeModal()`) — the product's strongest existing pattern, retained exactly |
| **Dialog** | Same purpose as Modal | — | Not a separate component — "Modal" is Farm OS's name; avoid introducing a second name/pattern for the same concept |
| **Bottom Sheet** | Not currently used anywhere in Farm OS | — | Mobile forms use the existing Modal system (which already adapts responsively); a Bottom Sheet is not introduced unless a specific need is identified that Modal cannot serve |
| **Tooltip** | Brief contextual info on hover | appear, dismiss | New, standardized — used for chart hover detail (Section 9) and truncated-text reveals |
| **Popover** | Larger contextual content than a Tooltip, dismissible | open, closed | New — used sparingly, e.g. a filter's detail panel |
| **Skeleton** | Loading placeholder matching final content's shape | — | Already exists in the codebase (built but underused) — formalized as the mandatory loading state for every Data Table and Chart Container |
| **Loading** | General loading indicator (spinner) | — | Already exists (`.spinner`) — retained |
| **Progress** | Determinate progress indication | — | Distinct from Progress Widget (Section 4), which is domain-specific (inventory stock); this is a generic loading-progress indicator if ever needed for a long-running action (e.g., large import) |
| **Empty State** | "Nothing here yet," with a next action | — | Consistent icon+message+action treatment across every component type that can be empty (Constitution §8) |
| **Error State** | Something failed to load or save | — | Specific, actionable messaging (Constitution §7) — never a generic "an error occurred" |
| **Offline State** | Network unavailable | — | Already exists at the infrastructure level (service worker, offline fallback page) — this is the UI-level companion: a small, calm indicator (not an alarming red banner) reflecting the product's "calm" visual philosophy even when reporting a real limitation |

---

# SECTION 9 — Charts

Every chart specification below follows the mandatory Design Execution Blueprint §8 fields.

| Chart | Purpose | Allowed data | Wrong usage | Filters | Legend | Tooltip/Hover | Loading/Empty/Error |
|---|---|---|---|---|---|---|---|
| **Line** | Trend over time | Population, Production | Single-value snapshots (use KPI Card instead) | Date range | If multi-series | Exact value + date on hover | Skeleton line shape; "no data for this period" empty text; text-fallback table on error |
| **Bar** | Categorical comparison | Breed/status distribution, treatment frequency | Continuous time trend (use Line instead) | Category subset | If multi-series | Exact value per bar | Same pattern as Line |
| **Stacked Bar** | Categorical comparison with a compositional dimension | e.g., health status distribution broken down by species | Simple single-category comparison (use plain Bar) | Category subset | Always (multi-segment by definition) | Value per segment + total | Same pattern |
| **Area** | Same use as Line, with emphasis on volume/magnitude | Only where magnitude-under-the-curve is meaningful (e.g., cumulative production) | Any comparison better served by a plain Line (Area implies volume, which most Farm OS trends don't need) | Date range | If multi-series | Same as Line | Same pattern |
| **Donut** | Share-of-whole for a small, fixed category set | Health status distribution (alternative to Bar) | Any trend or single-value metric | None typically | Always | Value + percentage per segment | Same pattern |
| **Gauge** | Single composite value against a defined range | Reserved specifically for the Farm Health Score, if a gauge visual (vs. radial Score Card) is chosen at build time | Anything with more than one value to show | None | None | Current value | Same pattern |
| **Progress Ring** | Same use as Gauge, ring-styled | Same as Gauge — a visual choice between the two, not two different use cases | Same as Gauge | None | None | Current value | Same pattern |
| **Heatmap** | Two-dimensional pattern (e.g., seasonal-by-category) | Reports module only, per UX Constitution §6 | Any single-dimension data, any non-Reports screen | Both axes' ranges | Color-scale key | Value per cell | Same pattern |
| **Sparkline** | Miniature inline trend, no axes/labels | Inside a KPI Card, optional, only where a real trend exists (Blueprint §5) | Standalone use outside a KPI Card; used decoratively where no real trend exists | None | None | None (too small to support interaction meaningfully) | No dedicated empty/error state — simply omitted from the KPI Card if data is insufficient |

**Absolute rule, restated:** no chart above is instantiated on any screen without first completing Design Execution Blueprint §8's full definition table for that specific instance — this specification defines what each chart type *can* do, not a standing permission to add one anywhere.

---

# SECTION 10 — Tables

| Variant | Purpose | Usage |
|---|---|---|
| **Canonical Table** | The default Data Table (Section 4) | Every standard Listing screen |
| **Compact Table** | Denser row height, fewer visible columns | Used inside a Detail template's related-records section, where space is more constrained than a full Listing |
| **Analytics Table** | A table specifically presenting aggregated/computed values (not raw records) | Reports module only |
| **Grouped Table** | Rows clustered under category headers | Where a Listing benefits from grouping (e.g., Health records grouped by animal) — used only when genuinely clearer than a flat sortable table |
| **Expandable Table** | Rows that reveal additional detail inline on click, without navigating to a Detail page | Used sparingly — if expansion reveals substantial content, that content likely belongs on a real Detail page instead |

**Shared behavior across all variants:**
- **Selection:** Checkbox column, enabling Bulk Actions — appears only on tables where bulk actions are meaningful.
- **Bulk Actions:** Require explicit selection first, always confirm before executing (Constitution §7).
- **Pagination:** Standard, appears once row count exceeds a single comfortable screen.
- **Sorting:** Every column that represents an orderable value is sortable; sort direction always visually indicated.
- **Filtering:** Via the Filter component (UX Constitution §4) positioned above the table, never hiding/replacing table content.
- **Search:** Table-scoped search is a Search Field variant, distinct from Global Search.
- **Export:** A Toolbar Button, present on tables where exporting is a real, stated need (Finance, Reports) — not added reflexively to every table.

---

# SECTION 11 — Cards

**Card Anatomy:** optional header (title + optional action), body (the card's actual content), optional footer (secondary actions/metadata).

| Aspect | Rule |
|---|---|
| **Spacing** | Internal padding per the existing unified card-padding scale (sm/md/lg/xl, already implemented) |
| **Elevation** | One shadow token (`--card-shadow`, existing) applied uniformly |
| **Padding** | Governed by the same scale as Spacing above — no card defines a one-off padding value |
| **Actions** | Live in the header (primary, e.g., "view all") or footer (secondary) — never floating unlabeled inside the body |
| **Header** | Title + optional single action; never more than one header-level action (matches the "one primary action" principle at the card scale) |
| **Footer** | Metadata (timestamp, count) or secondary actions — never a second primary action |
| **Media** | Used only where a real image exists (e.g., an animal's photo) — never a placeholder illustration used decoratively |
| **Metrics** | A card containing a Statistic Block or Metric Card composes that component; it does not reimplement metric display logic |
| **Expandable Cards** | Used sparingly, same caution as Expandable Table — substantial hidden content likely belongs on a Detail page |
| **Interactive Cards** | Entire card is clickable (e.g., Animal Card → Animal Detail) — the whole card must show a clear hover/focus state, not just an inner link |

---

# SECTION 12 — Typography Rules

| Token | Purpose | Usage | Allowed components | Forbidden components |
|---|---|---|---|---|
| **Page Title** | Identify the current page | Page Header only | Page Header | Anywhere else — a second "page title"-styled element on the same page is a hierarchy violation |
| **Section Title** | Identify a Section Container's content | Section Container header | Section Container, Analytics Card | Card-level headers (use Card Title instead — one level down) |
| **Card Title** | Identify one card's content | Card header | Any Card variant | Page or Section level (too small to serve that role) |
| **Body** | Standard readable content | Everywhere descriptive text appears | All components | KPI values (use the numeric/Lexend treatment instead) |
| **Caption** | Metadata, timestamps, secondary labels | Card footers, table secondary columns | All components | Primary content (Caption is deliberately low-emphasis; using it for primary content undermines hierarchy) |
| **Numeric/KPI emphasis (Lexend)** | All quantitative values | KPI Card, Metric Card, Statistic Block, table numeric columns | Any component displaying a number the user should register quickly | Descriptive/body text (Cairo is used there, without exception) |

---

# SECTION 13 — Spacing Rules

- **8pt grid:** Base unit 8px; all spacing values are multiples of this unit (already the direction of this project's own prior CSS-token cleanup work).
- **Margins:** 24px desktop / 20px tablet / 16px mobile outer margins (Blueprint §3).
- **Internal padding:** Card padding scale sm/md/lg/xl (already implemented as `--card-pad-*` tokens) — reused, not reinvented, for every card-like component.
- **Section rhythm:** 32px between Section Containers (desktop), reducing to 24px (tablet)/20px (mobile).
- **Card rhythm:** 16px between cards within the same row/section (desktop), reducing proportionally on smaller breakpoints.
- **Table rhythm:** Row height consistent within a table variant; Compact Table rows are visibly, deliberately shorter than Canonical Table rows — never the same height with a "compact" label doing no visual work.
- **Form rhythm:** Consistent vertical spacing between fields inside any Modal Form — matches this project's existing `.field` spacing convention.
- **Dashboard rhythm:** Follows Section rhythm exactly — the Dashboard is not a special case with its own spacing scale.

---

# SECTION 14 — Color Rules

| Category | Rule |
|---|---|
| **Primary** | The existing brand green — used for primary buttons, primary status (healthy/alive), and brand identity elements only |
| **Secondary** | Existing brand orange — used for secondary emphasis (e.g., FAB, warning-adjacent but non-critical accents) |
| **Semantic** | Success/warning/danger/info — the *only* colors permitted to carry status meaning anywhere in the product |
| **Neutral** | Grays for text, borders, backgrounds — carry no meaning, used purely for structure/hierarchy |
| **Status** | Maps 1:1 onto the existing `ANIMAL_STATUS` and equivalent status models for other record types — no new status-color mapping invented per module |
| **Charts** | One consistent series-to-color mapping across every chart in the product (e.g., "Herd" is always the same green across every chart that shows herd data) — a legend in one chart must mean the same color everywhere else |
| **Alerts** | info/watch/critical map directly to info/warning/danger semantic tokens — no separate alert-specific palette |
| **Badges** | Colored exclusively by the status/category they represent, via semantic tokens |
| **Buttons** | Primary (brand green), Danger (semantic red) — the only two color-carrying button treatments; all others are neutral |
| **Tables** | Row/column structure uses neutral colors only; any color inside a table cell (e.g., a status column) is a Badge component, not a table-specific color rule |
| **Dark Mode** | Existing, fully implemented — every rule above applies identically in dark mode via the existing token-swap mechanism, never a separately-designed dark palette |
| **Light Mode** | Same statement, inverse — one token system, two resolved value sets, never two designed systems |

---

# SECTION 15 — Motion Rules

(Full detail already specified in Design Execution Blueprint §9 — restated here in compact reference form, not redesigned.)

| Trigger | Duration token | Behavior |
|---|---|---|
| Hover | Fast | Border/shadow shift only |
| Focus | Fast | Visible focus ring, immediate (no easing delay) |
| Loading | — | Skeleton pulse, continuous, subtle |
| Cards | Fast | Same as hover |
| Navigation (Sidebar) | Base | Slide, not fade |
| Dialogs (Modal) | Base (open) / Fast (close) | Existing slide-up-and-fade, retained |
| Charts | Base | Initial render only, no refresh animation |
| Transitions (general) | Fast (reversible) / Base (screen-changing) | Never slow |
| Micro Interactions | Immediate | No easing delay on direct-manipulation feedback |

---

# SECTION 16 — Responsive Rules

| Breakpoint | Sidebar | Content Grid | Cards | Tables | Charts |
|---|---|---|---|---|---|
| **Desktop** (>1024px) | Expanded, sticky | 12-col | 4-up KPI row | Full Canonical Table | Full Chart Container, side-by-side if 2 in a row |
| **Tablet** (768–1024px) | Expanded, sticky | 8-col collapse | 2-up KPI row | Canonical Table, horizontally scrollable if needed | Stacked, full width |
| **Mobile** (<768px) | Off-canvas drawer, not sticky | Single column | 1-up KPI row | Compact Table, or Card-list alternative view | Stacked, full width, simplified interactions (tap instead of hover for tooltip) |

**Component adaptation rule:** no component is hidden on a smaller breakpoint without an explicit progressive-disclosure decision (UX Constitution §10) — "it doesn't fit" is not sufficient justification without that decision being made deliberately.

---

# SECTION 17 — Accessibility

| Requirement | Rule |
|---|---|
| **Contrast** | All text and status indicators meet minimum contrast against their background, in both themes |
| **Keyboard** | Every interactive component (buttons, form fields, table sort headers, modal close) is reachable and operable via keyboard alone |
| **ARIA** | Icon-only buttons and status-only-by-color elements carry appropriate labels/roles |
| **Focus** | Visible focus indicator on every interactive element, immediate per Section 15 |
| **Screen Readers** | Status conveyed by color (Badge, Alert Card) always has a text equivalent read by assistive technology |
| **RTL** | Every component is authored RTL-first (UX Constitution §2, Principle 7) — mirrored icon direction where directionality matters (e.g., breadcrumb chevrons) |
| **Large Text** | Layouts tolerate user-level font-size increases without breaking (no fixed-height text containers that clip content) |
| **Touch Targets** | Minimum comfortable tap size on mobile for every interactive element, including table row actions and icon buttons |

---

# SECTION 18 — Component Relationships (Dependency Graph)

```
Dashboard (Template)
 └── Section Container
      ├── Farm Score Indicator (= Score Card)
      ├── Alert Card
      │    └── Status/severity color (token)
      ├── KPI Card
      │    ├── Statistic Block
      │    ├── Sparkline (optional)
      │    └── Status Badge (status color)
      ├── Analytics Card
      │    └── Chart Container
      │         └── Line / Bar / Donut (chart primitive)
      ├── Timeline / Activity Feed
      └── Task Card

Listing (Template)
 └── Page Header (+ Breadcrumb)
      └── Filter → Data Table (or Animal/Finance/Task Card grid, alternative view)
           ├── Status Badge
           └── Toolbar Buttons (bulk actions, export)

Detail (Template)
 └── Page Header (+ Breadcrumb)
      ├── Metric Card (×N)
      └── Timeline
           └── Animal Summary / Status Badge (inline references)
```

**Reading the graph:** every leaf node (Status Badge, chart primitive, Statistic Block) is a small, single-purpose component; every node above it composes leaves rather than reimplementing their logic — this is the literal mechanism by which "never duplicate functionality" (Section 20) is enforced structurally, not just by convention.

---

# SECTION 19 — Do & Don't

| Component | ✅ Correct usage | ❌ Wrong usage | Common mistake |
|---|---|---|---|
| **KPI Card** | Dashboard/Overview, max 4/row | On a Detail page (use Metric Card) | Treating KPI Card and Metric Card as interchangeable |
| **Chart Container** | Wraps every chart, defines all 3 required states | A bare `<canvas>` with no title/states | Skipping the empty/error state because "there's always data in testing" |
| **Alert Card** | Genuinely attention-requiring items only | A routine, on-time task shown as an "alert" | Alert fatigue from over-using this component for non-urgent information |
| **Status Badge** | One per defined, finite status value | Free-text labels styled to look like a badge | Inventing a new color for a status that should map to an existing semantic token |
| **Data Table** | One per Listing screen | Two tables on one Listing (should be two Listings) | Trying to show two unrelated record types on one screen "for convenience" |
| **Modal** | Every create/edit form | A full-page navigation for a simple edit | Breaking flow by leaving the Listing/Detail context for a simple field change |
| **Sparkline** | Inside a KPI Card, only where a real trend exists | Added to every KPI Card regardless of whether trend data is meaningful | Decorative use where the "trend" is statistical noise, not a real signal |
| **Heatmap** | Reports module only | A Module Overview screen | Using an analytically-deep chart type on a daily-glance screen, contradicting Blueprint §7 density rules |
| **Danger Button** | Destructive action + confirmation | Destructive action with no confirmation step | Skipping the confirmation "because the user will figure it out" |
| **Section Container** | One level of nesting | Section Container nested inside another Section Container | Building deeply nested layouts instead of flatter, template-driven structure |

---

# SECTION 20 — AI Rules

Explicit, binding instructions for Lovable, Figma AI, Framer AI, v0, or any equivalent design-generation tool executing against this catalog:

- **Never invent components.** Every screen must be built from the components documented in Sections 2–11. If a genuine gap is found, stop and flag it — do not improvise a substitute.
- **Never invent layouts.** Every screen maps to exactly one of the six templates (Design Execution Blueprint §6).
- **Never invent colors.** Use only the tokens in Section 14.
- **Never invent spacing.** Use only the 8pt-grid scale in Section 13.
- **Always reuse existing components.** The default assumption is that any new need is already served by something in this catalog.
- **Prefer composition over creation.** Build new screens by combining existing components (per Section 18's dependency graph), never by writing a new one-off element.
- **Never duplicate functionality.** If two components seem to do almost the same thing, that is a signal to add a variant to the existing one, not to create a second component.
- **Always follow the Design System** (this document) for every visual and structural decision.
- **Always respect the UX Constitution** — no component or screen may violate any of its 15 principles.
- **Always follow the Design Execution Blueprint** — density limits, motion timing, and template assignments are binding, not suggestions.
- **When in doubt, choose the plainer, more consistent option** over the more novel one — matching the "calm, data-first" visual philosophy established from the first document in this series onward.

---

## Final Deliverables

### 1. Complete Component Inventory
Layout (12) · Navigation (6 active + 3 explicitly deferred) · Data (11) · Farm (13, several cross-referenced) · Forms (12 + 4 states) · Buttons (7 named, 2 documented as "use existing equivalent, don't invent") · Feedback (10 active + 2 explicitly not separate from existing ones) · Charts (9 primitives) · Tables (5 variants + shared behaviors) · Cards (1 anatomy, governing all card-family components).

### 2. Component Dependency Map
See Section 18 in full.

### 3. Component Priority Matrix
Directly inherited from Design Execution Blueprint §4 (Tier 1: Navigation/Header/Primary Action/Farm Score; Tier 2: KPI/Charts/Tables; Tier 3: Cards/Activity/Timeline; Tier 4: Supporting UI) — not redefined here, only referenced, per this document's own instruction never to alter prior decisions.

### 4. Variant Matrix
| Component | Variants |
|---|---|
| KPI Card | normal / watch / alert |
| Alert Card | info / watch / critical |
| Status Badge | one per finite status value, per record type |
| Button | primary / secondary / danger / icon / FAB |
| Modal | sm / md / lg / xl |
| Data Table | canonical / compact / analytics / grouped / expandable |
| Chart Container | line / bar / stacked bar / area / donut / gauge / progress ring / heatmap / sparkline |

### 5. State Matrix
| Component category | Required states |
|---|---|
| Data-driven (Table, Chart, KPI Card, Timeline) | loading, empty, populated, error |
| Interactive (Button, Field, Sidebar Item) | default, hover, focus, active, disabled |
| Form-specific | validating, error (inline), submitting, success |
| Modal/Dialog | open, closing |

### 6. Responsive Matrix
See Section 16 in full.

### 7. Accessibility Matrix
See Section 17 in full.

### 8. Reuse Matrix
| If you need... | Reuse... |
|---|---|
| A number with a trend | KPI Card (dashboard-level) or Metric Card (detail-level) — never a new component |
| A status indicator for any record type | Status Badge with a new status-set definition, not a new badge component |
| A destructive action | Danger Button + existing confirmation pattern |
| A create/edit interaction | Modal Form at an existing size tier |
| A trend visualization | Line Chart inside Chart Container — never a bespoke visualization |
| A "nothing here yet" moment | The one Empty State pattern, everywhere |

### 9. Future Component Roadmap
Explicitly deferred, not built now, and not to be improvised by an executing AI without a separate brief: **Quick Actions, Favorites, Recent Pages, Wizard (multi-step form), Bottom Sheet.** Each is deferred because no current Farm OS flow has demonstrated a real need for it yet — per this catalog's own "a component exists only if it's needed" philosophy (Section 1).

### 10. Final Design System Checklist
1. Does every component used trace to Sections 2–11?
2. Does every chart trace to Section 9's primitive list and satisfy the mandatory state/definition fields?
3. Does every color used trace to Section 14?
4. Does every spacing value trace to Section 13's 8pt grid?
5. Does every typography usage match Section 12's allowed-components column?
6. Is every interactive component's full state set (Section 1) defined?
7. Does the screen's template assignment match Design Execution Blueprint §6?
8. Is the Component Dependency Graph (Section 18) respected — no component reimplementing another's logic?
9. Has "Future Component Roadmap" (Deliverable 9) been checked to confirm no deferred component was used prematurely?
10. Does the screen pass every applicable question from the UX Constitution's 50-question checklist and the Design Execution Blueprint's 50-question checklist, in addition to this one?

---

*This document is the permanent component reference for Farm OS. It does not alter any decision made in Future UI Architecture, UX Constitution, or Design Execution Blueprint — it specifies, at implementation-ready detail, the components those three documents already require.*
