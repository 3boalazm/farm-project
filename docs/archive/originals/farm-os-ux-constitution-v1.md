# Farm OS UX Constitution v1
**Status:** Governing document. Every future screen, component, workflow, and feature must be evaluated against this constitution before implementation.
**Scope:** Experience and information-architecture redesign only — the existing Vanilla JS / Bootstrap 5.3.3 / Firebase / PWA / offline-support stack is preserved unchanged.

---

# 1. Design Philosophy

Farm OS exists to help a farm operator make correct decisions quickly, under real operational pressure — not to look impressive in a screenshot. Every philosophical commitment below exists to prevent the specific failure mode this project has already lived through: features added wherever space existed, until the Animals module became deep and everything else stayed shallow, and the Dashboard stopped supporting any decision at all.

- **Decision-first design.** Every screen exists to help answer a specific question the operator actually has ("is anything wrong right now," "what does this animal need," "are we profitable this month"). If a screen or element doesn't serve a decision, it doesn't belong.
- **Enterprise usability.** Farm OS is used daily, by the same people, under time pressure. It is optimized for repeated, fast, confident use by a trained operator — not for a first-time visitor's impression.
- **Operational efficiency.** The fastest path to completing a real task (recording a birth, logging a treatment, checking today's tasks) is the correct design, even when a more elaborate alternative would look more sophisticated.
- **Simplicity over decoration.** Nothing is added because it is possible to add. Every visual element must justify its presence in terms of the operator's task, not the designer's ambition.
- **Trustworthy information.** Data shown must be accurate, current, and clearly sourced (cached vs. live, per this project's existing offline-data model). An operator who cannot trust what they see will stop trusting the system entirely — this is a harder failure to recover from than any visual imperfection.
- **Data before visuals.** A correct number in a table beats a beautiful chart of the wrong or unclear number. Visualization is a tool for faster comprehension of data that is already correct — never a substitute for correctness.
- **Consistency before creativity.** A farm operator should never have to re-learn how a pattern works because a different designer touched a different page. Novelty is a cost to be justified, not a default to be assumed.

---

# 2. Core Design Principles

These are immutable. A design that violates one of these must be revised, not approved with an exception, unless this constitution itself is formally amended.

1. **Every page answers exactly one primary user question.** If a page tries to answer two unrelated questions, it must be split into two pages or two clearly separated regions of the same template.
2. **Every component must have a reason to exist.** A component is added to the system only when an existing component genuinely cannot serve the need — not because a new visual treatment seems nicer.
3. **Every visualization supports a real operational decision.** No chart, graph, or gauge exists without a stated decision it supports (see Section 6).
4. **No decorative widgets.** Anything that exists only to fill visual space is removed, not tolerated.
5. **No duplicated workflows.** There is exactly one way to record a birth, one way to log a treatment, one way to add an animal — never a second, slightly-different path invented for a new page.
6. **Consistency beats originality.** When a new page needs a pattern, the first question is "which existing template/component already does this," not "what's a fresh way to present this."
7. **RTL is first-class, not adapted.** Every layout, icon direction, and interaction is designed for Arabic RTL from the start — RTL is never a mirrored afterthought of an LTR design.
8. **Mobile-first.** Every screen is designed for the smallest realistic operating context first (a phone in a barn), then enhanced for desktop — not the reverse.
9. **Accessibility by default.** Sufficient color contrast, keyboard/touch target sizing, and non-color-only status signaling are baseline requirements for every component, not a later pass.
10. **Information density without clutter.** Farm OS is a data-heavy operational tool, not a consumer app — density is appropriate and expected, but every dense screen must still have a clear entry point and hierarchy (see Section 3).
11. **Progressive disclosure.** Detail is available on demand (drill-in, expand) rather than shown all at once by default — the Listing → Detail relationship (Section 3) is the primary mechanism for this.
12. **Fast recognition over memorization.** An operator should recognize what a screen or component means on sight, using consistent color/icon/position conventions — never need to remember a page-specific convention.
13. **Never surprise the operator.** An action's outcome must match what the interface implied it would do. Destructive or consequential actions always confirm before executing (already this project's own established pattern for delete/reset actions).
14. **Every module gets the same depth of experience.** The Animals-deep/others-shallow imbalance that created today's inconsistency may never be reintroduced — every module receives an Overview, a Listing (where applicable), and a Detail experience of comparable design maturity, regardless of how much code that module happens to have accumulated historically.
15. **Preserve what already works.** Where an existing pattern (the centralized modal system, the button system, the Firebase gateway architecture) already serves these principles, it is retained and formalized — never replaced merely to demonstrate a new approach.

---

# 3. Information Architecture Rules

| Template | Purpose | Rule |
|---|---|---|
| **Dashboard** | Overview | Exactly one instance in the whole product. Surfaces status and alerts across all modules; never contains module-specific management actions. |
| **Module Overview** | Analytics | One per module (Herd, Health, Production, Finance, Inventory, Reports). Answers "how is this module doing," never "let me manage individual records here." |
| **Listing** | Management | Where records are found, filtered, and created. Never contains deep analytics — that belongs to the module's Overview. |
| **Detail** | History + actions | Shows one record's full history and the actions available on it. Never used to browse or compare multiple records — that's the Listing's job. |
| **Settings** | Configuration only | No analytics, no charts, no operational data. Pure configuration. |
| **Reports** | Deep analysis only | The only place cross-module, heatmap-depth, or export-oriented analytics belong. Never duplicated on a Module Overview. |

**Enforceable rules:**
- **Every page belongs to exactly one template.** A page that seems to need two templates must be split into two pages.
- **No module may grow independently.** Any new module (a future addition beyond Herd/Health/Production/Finance/Inventory/Reports) must be assigned Overview + Listing + Detail templates at the time it is proposed — never allowed to start as "just a list" and grow ad hoc.
- **Navigation structure mirrors this hierarchy exactly.** The sidebar's grouping (Overview / Herd / Operations / Finance / Reports / Administration) is the literal, enforced expression of this IA — not a separate, looser organizational scheme.
- **Depth parity is a design-review gate.** A module whose Overview is visibly less developed than another module's Overview fails design review, regardless of how much underlying code exists for that module.

---

# 4. Component Rules

### KPI Cards
- **Purpose:** Communicate one metric's current value and trend at a glance.
- **When to use:** Dashboard, Module Overview screens.
- **When NOT to use:** Listing or Detail templates (use Metric Widget there instead — a KPI Card implies dashboard-level significance).
- **Maximum recommended count:** 4 per row; never more than 8 total on a single screen.
- **Required states:** normal, watch, alert (mapped to semantic color, never ad-hoc color).
- **Spacing rules:** Equal-width grid, consistent gutter matching the platform spacing scale (Section 8).
- **Hierarchy rules:** The single most operationally important KPI is always positioned first (top-left in LTR reading order, top-right in RTL).

### Charts
- **Purpose:** Make a trend or comparison faster to grasp than the same data in a table.
- **When to use:** Only when Section 6's test ("what decision does this help the farmer make") produces a real, stated answer.
- **When NOT to use:** Inventory stock levels (use a threshold/progress indicator), any single-value metric (use a KPI Card), any heterogeneous event history (use a Timeline).
- **Maximum recommended count:** 2 per Module Overview screen; Reports may exceed this since deep analysis is its explicit purpose.
- **Required states:** loading, populated, empty, and **failed-to-render fallback** (Farm OS already requires every chart to degrade to a readable text/table equivalent if the charting library fails to load — this requirement is retained and now mandatory for every chart in the system, not just the original statement pages).
- **Spacing/hierarchy rules:** Every chart lives inside a Chart Container component with a title and, where relevant, a period/filter control — never a bare canvas dropped into a page.

### Tables
- **Purpose:** Structured browsing, sorting, and filtering of many records.
- **When to use:** Every Listing template.
- **When NOT to use:** Summarizing fewer than ~5 items (use Cards instead — a table implies a browsing task, not a quick glance).
- **Maximum recommended count:** One primary table per Listing screen.
- **Required states:** loading (skeleton), empty (with a clear call-to-action to create the first record), populated, error.
- **Spacing/hierarchy rules:** Row actions are always right-aligned in LTR / left-aligned in RTL, and always icon+label on hover/focus for clarity, never icon-only with no accessible label.

### Forms
- **Purpose:** Create or edit exactly one record.
- **When to use:** Inside the centralized modal system (retained — this is already Farm OS's strongest existing pattern).
- **When NOT to use:** Never as a full-page navigation away from context — a form that requires leaving the Listing/Detail entirely breaks the operator's flow and is disallowed.
- **Required states:** default, validating, error (inline, field-level — never a single generic error banner), submitting, success.
- **Hierarchy rules:** Required fields are visually distinguished from optional ones; the primary submit action is always the visually dominant button, secondary/cancel is always visually subordinate (formalizing the existing `action-btn`/`action-btn primary` distinction).

### Filters
- **Purpose:** Narrow a Listing or Analytics view to a relevant subset.
- **When to use:** Any Listing with realistically more than ~20 records, or any Module Overview with a meaningful time dimension.
- **When NOT to use:** Screens with inherently small, fixed datasets (e.g., Settings) — a filter bar with nothing meaningful to filter is clutter, not a feature.
- **Required states:** default (no filter applied), active (with a visible, removable indication of which filters are applied), no-results.
- **Hierarchy rules:** Filters never hide or replace the primary content — they sit above it, always visibly distinct from the data they affect.

### Modals
- **Purpose:** Focused, single-task interaction (form, confirmation) without losing the underlying page's context.
- **When to use:** All create/edit actions (via Form components above); all destructive-action confirmations.
- **When NOT to use:** Any content the operator needs to reference *while* doing something else — that belongs in a Section Container on the page itself, not a modal.
- **Required states:** open, closing (matching existing motion tokens), and a mandatory confirmation step for any destructive action (already Farm OS's established pattern — retained as a hard rule, never optional).
- **Sizing rule:** Reuse the existing sm/md/lg/xl size tiers — a new one-off modal size is a component-rule violation, not a design choice.

### Alerts
- **Purpose:** Surface something requiring the operator's attention that isn't part of the routine flow.
- **When to use:** Dashboard's alert list, Health module's withdrawal-period warnings, Inventory's low-stock warnings.
- **When NOT to use:** Routine, expected information (e.g., a normal task due today is not an "alert" — only an *overdue* one is).
- **Maximum recommended count:** No hard cap, but if an Alert list regularly exceeds ~10 items, the underlying threshold logic (not the component) needs review — that's a sign of alert fatigue building, which defeats the component's purpose.
- **Required states:** info, watch, critical (three severities only — a fourth severity level is a sign the underlying logic needs simplifying, not that the component needs a new visual tier).

### Badges
- **Purpose:** Compact, at-a-glance status communication (already Farm OS's existing `statusBadge()` pattern).
- **When to use:** Any list row or card representing a record with a defined status (animal health status, task status, transaction status).
- **When NOT to use:** Free-form labeling — a badge always maps to one value in a defined, finite status set, never arbitrary text.
- **Required states:** one visual treatment per defined status value, using semantic color exclusively.

### Timelines
- **Purpose:** Chronological, heterogeneous event history for one record.
- **When to use:** Every Detail template.
- **When NOT to use:** Comparing multiple records (that's a Table's job) or showing a single metric's trend (that's a Chart's job).
- **Required states:** populated, empty ("no recorded history yet" — never a blank void with no explanation).

### Cards
- **Purpose:** A titled, bounded content grouping — the general-purpose container this project's own prior work already unified into one system.
- **When to use:** Grouping related content that doesn't fit KPI Card, Chart Container, or Table.
- **When NOT to use:** As a substitute for a Table when the content is genuinely tabular/list-like data with more than a handful of items.
- **Maximum recommended count:** Governed by the template it appears in, not by an independent rule — a Listing template's card-grid view (an alternative to its table view) follows the same density rules as the KPI Card row.

---

# 5. Dashboard Rules

**What belongs on the Dashboard:**
- Farm Health Score (one composite indicator).
- Important, ranked alerts (not a full alert log).
- Today's operational summary (births, deaths, tasks due).
- A small number of cross-module KPIs (population, health status distribution, production trend, financial snapshot) — never module-specific management detail.

**What never belongs on the Dashboard:**
- Any record-level create/edit action (that belongs to a Listing).
- Any single-animal or single-transaction detail (that belongs to a Detail template).
- Deep, multi-chart analytics (that belongs to Reports).
- Configuration or settings of any kind.
- More than 8 KPI cards or more than 2 charts, regardless of how many metrics stakeholders eventually want visible — this is the direct, enforceable mechanism preventing "dashboard overload" from recurring.

**Priority levels (every Dashboard element must be assigned one):**
| Level | Definition | Example |
|---|---|---|
| **Critical** | Requires action today | Overdue task, active withdrawal-period conflict |
| **Important** | Worth checking today, not yet urgent | Upcoming vaccination due this week |
| **Informational** | Useful context, no action implied | Current herd population count |
| **Background** | Present but never demands attention | Farm profile name in the header |

Critical items are always visually first and most prominent; Background items never compete visually with Critical ones, regardless of how the page's grid naturally lays out.

---

# 6. Data Visualization Rules

**The governing test, with no exceptions:** *"What decision does this help the farmer make?"* If a chart's designer cannot answer this in one sentence, the chart is not built — this is evaluated at design-review time (Section 10), not left to implementation discretion.

| Domain | Appropriate visualization | Explicitly inappropriate |
|---|---|---|
| **Population** | Line (trend over time), bar (breed/status distribution) | Heatmap (population doesn't have the two-dimensional seasonal structure a heatmap requires) |
| **Production** | Line (trend is the entire point) | Donut/pie (a single trending value has no meaningful "share of whole" to show) |
| **Finance** | Grouped bar (revenue vs. expense by period) | Line alone, without the comparison dimension — profitability is inherently a comparison, not a single trend |
| **Health** | Bar (treatment frequency), badge/alert (individual status) — **not** a chart for individual case tracking | A trend line for an individual animal's health status (status is categorical, not continuous — a Timeline is correct here, not a chart) |
| **Inventory** | Progress/threshold indicator | Any chart type — inventory levels are a threshold check, never a trend worth charting on an operational screen |
| **Tasks** | None (Table is correct) | Any chart — tasks are discrete, actionable items, not aggregate data |
| **Reports** | Any of the above, plus heatmap (seasonal/cross-module patterns) and multi-series line (cross-module trend comparison) | Nothing is categorically excluded here, since Reports is explicitly the deep-analysis template — but the governing test still applies to every individual chart |

---

# 7. Interaction Principles

- **Buttons:** One visual system (existing `action-btn` + `primary`/`danger`/`sm` modifiers) used everywhere; the primary action on any screen is always visually singular — never two equally-weighted "primary-looking" buttons competing for attention.
- **Navigation:** Sidebar is always present and always reflects the current location; no page-specific navigation pattern is invented.
- **Filters:** Applied filters are always visibly indicated and always individually removable — never an all-or-nothing "clear all" as the only option.
- **Searching:** A single, global search entry point (per the IA already established) rather than a per-page search reinvented independently.
- **Bulk actions:** Available only on Listing templates, always require an explicit selection step before the action is available, and always confirm before executing.
- **Tables:** Sortable columns indicate sort direction visually; row-level actions never require a hover-only reveal on touch devices (mobile-first, Principle 8).
- **Forms:** Validate inline, at the field level, as the operator moves between fields — never only on submit.
- **Feedback:** Every action that changes data gives immediate, visible confirmation (toast or inline state change) — silence after an action is never acceptable.
- **Loading:** Skeleton states for anything that takes more than a brief moment to load — a blank screen is never an acceptable loading state.
- **Empty states:** Always explain what's missing and offer the relevant next action — never a bare "no data" message.
- **Errors:** Always specific and actionable ("could not save — check your connection," not "an error occurred") — matching this project's existing pattern of specific toast messages.
- **Animations:** Reserved for state transitions that aid comprehension (modal open/close, content update) — never purely decorative motion.
- **Notifications:** One centralized system (existing `notifications-service.js`), surfaced consistently across every page — never a page-specific notification mechanism.

---

# 8. Visual Language

- **Typography hierarchy:** Page title → section title → card title → body → caption (5 levels), using the existing Lexend/Cairo pairing — Lexend for numeric/heading emphasis, Cairo for descriptive text, applied without exception.
- **Spacing philosophy:** A single named scale governs all spacing decisions — no page introduces its own spacing value outside this scale.
- **Color philosophy:** Brand colors identify the product; semantic colors (success/warning/danger/info) exclusively communicate status; no other use of color carries meaning anywhere in the system.
- **Elevation:** One shadow token for all card-level surfaces; modals use a distinct, slightly heavier elevation to communicate their focused, temporary nature.
- **Borders/Radius:** One radius scale (small/medium/large/pill), applied consistently by component type, never chosen per-page by preference.
- **Motion:** Existing duration tokens (fast/base) govern all transitions; nothing animates without a stated comprehension purpose (Section 7).
- **Icons:** One icon set (the existing Bootstrap Icons library) used everywhere — no second icon system is introduced for any reason.
- **Illustrations:** Used sparingly, only for genuine empty states or onboarding moments — never as generic decoration.
- **Empty states:** Consistent visual treatment (icon + message + action) across every component type that can be empty.
- **Dark mode:** A first-class, fully-supported mode (already implemented) — every new component must be designed and verified in both themes before approval, never dark-mode-as-an-afterthought.
- **RTL:** Every layout is authored RTL-first; LTR is never assumed as the default that RTL is adapted from.
- **Responsive behavior:** Every component has a defined mobile behavior stated at the time it's added to the system — "we'll figure out mobile later" is not an acceptable design-review answer.

---

# 9. Growth Rules

- **New features** are added to an existing module's Listing/Detail/Overview structure wherever they naturally belong — a new feature is never given its own standalone page unless it genuinely represents a new module.
- **New pages** require an explicit template assignment (Section 3) *before* any screen is designed — a page proposal without a stated template is incomplete and returned for revision.
- **New components** are approved only after confirming no existing component (Section 4) can serve the need — the default answer to "should we build a new component" is no, until proven otherwise.
- **New modules** must be proposed with Overview + Listing + Detail templates simultaneously, at the same design maturity as every existing module — a module is never allowed to launch as "just a list" with the intent to "add the rest later."
- **Every growth decision is checked against this constitution's principles (Section 2) before implementation begins**, not reviewed for consistency only after the fact.
- **This constitution is amended, not overridden.** If a genuinely new situation isn't covered by an existing rule, the resolution is a proposed amendment to this document — not a one-off exception that quietly becomes precedent.

---

# 10. Design Review Checklist

Every new page must pass this checklist before implementation. A "no" on any question requires either a design revision or an explicit, documented amendment to this constitution — never a silent exception.

**Purpose & Clarity**
1. Does this page answer exactly one primary question?
2. Can an operator understand its purpose in under 5 seconds?
3. Is there a single, clear primary action on this page?
4. Does the page title accurately describe what's shown?
5. Would removing any single element change what question the page answers? (If not, that element may be unnecessary.)

**Template & IA Compliance**
6. Which of the six templates does this page use?
7. Does it strictly follow that template's structure (Section 3)?
8. Does it avoid mixing Overview-level analytics with Listing-level management?
9. Is this page reachable from exactly the navigation location its module hierarchy implies?
10. Does it avoid duplicating a workflow that exists elsewhere in the product?
11. If this is a new module, are Overview, Listing, and Detail all being designed together?

**Components**
12. Does it reuse existing components rather than inventing new ones?
13. If a new component is proposed, has "can an existing component serve this" been explicitly ruled out?
14. Does every card on this page have a stated purpose?
15. Does every KPI Card map to a real, defined metric?
16. Is the KPI Card count within the recommended maximum?
17. Does every table have defined loading/empty/error states?
18. Does every modal use an existing size tier?
19. Does every badge map to a defined, finite status value?
20. Does every alert have a defined severity level?

**Data Visualization**
21. Does every chart on this page have a stated decision it supports?
22. Is the chart type appropriate for the data domain (Section 6)?
23. Does every chart have a defined failure/fallback state?
24. Is the number of charts within the recommended maximum for this template?
25. Has a table or card been ruled out as a simpler, equally effective alternative to any proposed chart?

**Visual Hierarchy & Density**
26. Is the most important information visually first?
27. Is critical information distinguishable from background information at a glance?
28. Is information density appropriate without feeling cluttered?
29. Does the page use the established typography hierarchy correctly?
30. Does the page use the established spacing scale exclusively?
31. Is color used only for semantic/status meaning, never decoratively?

**RTL & Responsiveness**
32. Was this page designed RTL-first, not mirrored from an LTR draft?
33. Do icons and directional elements correctly reverse for RTL?
34. Does the page work correctly on a mobile viewport?
35. Was mobile behavior explicitly designed, not deferred?
36. Do touch targets meet minimum size requirements?

**Interaction & Feedback**
37. Does every data-changing action provide immediate feedback?
38. Are destructive actions gated behind a confirmation step?
39. Are form errors shown inline, at the field level?
40. Does the page have a defined loading state?
41. Does the page have a defined empty state with a next action?
42. Are error messages specific and actionable, not generic?

**Accessibility**
43. Is color contrast sufficient for all text and status indicators?
44. Is status ever communicated by color alone, without an icon or label backup?
45. Are all interactive elements keyboard-navigable?
46. Do icon-only actions have accessible labels?

**Consistency & Governance**
47. Does this page match the visual treatment of comparable pages in other modules (depth parity, Principle 14)?
48. Does it avoid introducing a new pattern that a future page will need to match?
49. Has this design been checked against every principle in Section 2?
50. If this page deviates from any rule in this constitution, is that deviation documented as a proposed amendment rather than a silent exception?

---

*This document is the permanent design authority for Farm OS. Every subsequent design deliverable — Dashboard, Animals, Health, Finance, Inventory, Reports, and every component or template built after this point — must be evaluated against it before approval.*
