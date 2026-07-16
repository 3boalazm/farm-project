# Farm OS Design Execution Blueprint (Visual & Interaction Masterplan)
**Status:** Implementation-oriented execution document. Every rule here traces back to the *Farm OS UX Constitution v1* and the *Farm OS Future UI Architecture* document — this blueprint does not introduce new philosophy, it converts approved philosophy into buildable instructions.

**Note on referenced prior deliverables:** this brief references three approved documents — *Future UI Architecture*, *Visual Prototype Specification*, and *UX Constitution*. Two of these (*Future UI Architecture*, *UX Constitution*) have been produced in this working session and are used directly below. **A *Visual Prototype Specification* has not yet been produced in this session** — this blueprint proceeds using the two documents that do exist, and flags every point where a prototype-level visual decision (exact hex values, exact px values) would normally be pinned down by that missing document. Where this blueprint states a concrete value, it is derived from the existing, already-implemented Farm OS design tokens (verified against the live codebase), not invented.

---

## Section 1 — Visual Philosophy

Farm OS should feel: **Enterprise, Data-first, Calm, Operational, Human.**

| Quality | Why | What it rules out |
|---|---|---|
| **Enterprise** | This is a professional tool used daily for real operational decisions on livestock worth real money — it must read as trustworthy infrastructure, not a hobby app | Playful illustration, gamified UI, consumer-app visual tropes |
| **Data-first** | Per the UX Constitution's "data before visuals" principle — every screen's job is to make correct information fast to read | Charts or visuals that exist before the data need is established |
| **Calm** | An operator checking this system is often already under time pressure (an animal is sick, an alert fired) — the interface must not add visual noise to an already-stressful moment | Bright, high-saturation accents used for anything other than a genuine status signal; busy backgrounds; competing focal points |
| **Operational** | Every element should look like it exists to be *used*, not admired — buttons look clickable, tables look scannable, status is legible at a glance | Decorative dividers, ornamental icons, illustration for its own sake |
| **Human** | This is Arabic-first, built for a real farm's real staff — warmth in tone (already present in the product's existing Arabic copy) should be preserved in the visual language, not stripped out in the name of "enterprise" coldness | Sterile, generic SaaS visual language with no cultural or linguistic character |

**Explicitly not:** "premium" in the sense of luxury-brand visual excess, and not "modern SaaS" as a generic Silicon-Valley aesthetic disconnected from the agriculture domain — Farm OS's visual identity is enterprise *and* agricultural, not enterprise instead of agricultural.

---

## Section 2 — Visual Hierarchy

```
Level 1 — Global Navigation        (always visible, always same position — sidebar)
   ↓
Level 2 — Page Header              (title + primary action + breadcrumb)
   ↓
Level 3 — Primary KPI / Farm Score (the one thing this screen most wants you to see)
   ↓
Level 4 — Alerts                   (anything requiring attention, ranked above routine data)
   ↓
Level 5 — Analytics                (charts — only where Constitution Section 6 justifies them)
   ↓
Level 6 — Content                  (tables, listings, timelines — the operational substance)
   ↓
Level 7 — Secondary Actions        (bulk actions, export, filters — supporting, not competing)
   ↓
Level 8 — Footer                   (farm name, year — Background priority per Constitution §5)
```

**Visual priority rule:** each level down this list must be visually *quieter* than the one above it — smaller type, lower-contrast color, or simply less surface area — never louder. A Level 6 table row must never visually compete with a Level 4 alert. This is the direct, enforceable expression of the Constitution's priority levels (Critical/Important/Informational/Background) applied to every screen, not just the Dashboard.

---

## Section 3 — Layout Rules

| Rule | Desktop | Tablet | Mobile |
|---|---|---|---|
| **Grid** | 12-column (Bootstrap's existing grid, retained) | 8-column collapse | Single column |
| **Margins** | 24px outer | 20px outer | 16px outer |
| **Spacing rhythm** | 8px base unit; sections separated by 32px, cards within a section by 16px | Same base unit, section spacing reduced to 24px | Section spacing reduced to 20px, card spacing to 12px |
| **Container widths** | Max content width 1280px, centered | Fluid to viewport | Fluid to viewport |
| **Maximum content width** | 1280px — beyond this, dense operational tables become harder to scan, not easier | N/A (fluid) | N/A (fluid) |
| **Sticky regions** | Sidebar always sticky; Page Header sticky on scroll for Listing/Detail templates (so the primary action stays reachable) | Same as desktop | Header collapses to a compact sticky bar; sidebar becomes an off-canvas drawer, not sticky |
| **Scroll behavior** | Content area scrolls independently of the sidebar | Same | Single-column natural page scroll; no independently-scrolling inner regions (avoids the "scroll trap" problem on touch) |

**KPI grid rule:** 4-up on desktop, 2-up on tablet, 1-up on mobile — a direct, literal implementation of the Constitution's KPI Card density rule across breakpoints, not a new decision per screen.

---

## Section 4 — Component Priority

| Tier | Components | Why this tier |
|---|---|---|
| **Tier 1** | Global Navigation, Page Header, Primary Action, Farm Score | These orient the operator before anything else can be understood — if any of these fail visually, the whole screen fails |
| **Tier 2** | KPI Cards, Charts, Tables | The operational substance — what the operator came to the page to see |
| **Tier 3** | Cards (general), Activity Feed, Timeline | Supporting context — valuable, but the page still functions if the operator never scrolls to these |
| **Tier 4** | Supporting UI (footer, secondary links, minor labels) | Present for completeness; never competes for attention with any tier above it |

**Enforcement rule:** in any layout conflict (not enough vertical space, competing visual weight), Tier 1 always wins, then Tier 2, then Tier 3, then Tier 4 — this ordering resolves every future "what should be bigger" argument without a new decision each time.

---

## Section 5 — Dashboard Blueprint

```
HEADER  (farm name, date, global search, notifications, user menu)
   ↓
Farm Score  (single composite indicator, top-left/right per RTL, largest single element on the page)
   ↓
Alert Row  (horizontal, ranked Critical → Important; empty state: "no active alerts" — a genuinely calm, positive empty state, not a gap)
   ↓
KPI Grid  (4-up desktop: Population, Health Status, Production Trend, Financial Snapshot)
   ↓
Analytics Row  (max 2 charts: Population Trend line, Health Status distribution — per Constitution §6, no more without a stated new decision)
   ↓
Timeline  (recent cross-module activity — not a single animal's timeline; that lives on Detail pages)
   ↓
Tasks  (today's due/overdue tasks — compact list, not a full Task Listing)
   ↓
Recent Activity  (lower-priority log — collapsible/secondary, Tier 3)
   ↓
FOOTER  (farm name, year — Background priority)
```

**Block-by-block explanation:**
- **Header:** Always present, identical across every page in the product — the Dashboard does not get a special header treatment.
- **Farm Score:** The single visual anchor of the entire page — if an operator looks at nothing else, this is what they should see.
- **Alert Row:** Positioned above the KPI Grid deliberately — an active Critical alert is more important than any routine KPI, regardless of how the grid would otherwise flow.
- **KPI Grid:** Exactly 4 cards, matching Constitution §4's maximum-per-row rule — this is not a placeholder count, it is the ceiling.
- **Analytics Row:** The only place charts appear on the Dashboard — Reports remains the home for anything deeper.
- **Timeline / Tasks / Recent Activity:** Descending priority, in that order — this is Tier 3 content and must never be allowed to visually outweigh the Alert Row or KPI Grid above it.

---

## Section 6 — Module Blueprint

For each module: Overview / Listing / Detail / Analytics / Forms / Actions / Navigation / Expected flow.

### Animals
- **Overview:** Population summary, breed distribution, status distribution — new, since today's `animals.html` has no Overview framing at all, only a direct list.
- **Listing:** Full table/grid with filter bar (breed, status, barn) — the existing, high-traffic core of this module, restructured under the Listing template rather than replaced.
- **Detail:** Animal profile — status badge, lineage, Timeline of all events (health, breeding, weight).
- **Analytics:** Age distribution, breed performance — lives on the Overview, not a separate page.
- **Forms:** Add/edit animal, record birth/death — via the existing centralized modal system.
- **Actions:** Add animal (Tier 1 primary action on Listing); bulk import; export.
- **Navigation:** Sidebar → Herd → Animals; Detail reached only by clicking a Listing row, never directly linked from elsewhere without that context.
- **Expected flow:** Overview (orient) → Listing (find) → Detail (act/review) → back to Listing.

### Health
- **Overview:** Active treatments count, upcoming vaccinations, withdrawal-period alerts — new; today's `health.html` is a thin shell with no overview at all.
- **Listing:** Health records table, filterable by type/status.
- **Detail:** Individual record detail, linked from both the Health Listing and the relevant Animal's Detail Timeline.
- **Analytics:** Treatment-frequency bar chart (per Constitution §6).
- **Forms:** Log treatment, log vaccination.
- **Actions:** Mark treatment resolved (Tier 1 on relevant records).
- **Navigation:** Sidebar → Operations → Health.
- **Expected flow:** Overview (spot what needs attention) → act directly from an alert, or → Listing (browse) → Detail.

### Finance
- **Overview:** Revenue/expense/margin KPIs, revenue-vs-expense chart.
- **Listing:** Transaction table, filterable by category/period.
- **Detail:** Transaction detail (may be lightweight given the data's simplicity — Detail template still applies for consistency, even if sparse).
- **Analytics:** Lives on the Overview.
- **Forms:** Add transaction.
- **Actions:** Add transaction (Tier 1); export.
- **Navigation:** Sidebar → Finance.
- **Expected flow:** Overview (understand profitability) → Listing (verify specific transactions) → Detail (rare, for correction/audit).

### Production
- **Overview:** Production trend line, current-period total — new; today's `production.html` is a bare shell.
- **Listing:** Production record table.
- **Detail:** Individual record detail.
- **Analytics:** Trend line lives on the Overview — the single highest-value new chart in the whole redesign, since production trend currently has zero visualization anywhere.
- **Forms:** Log production entry.
- **Actions:** Log entry (Tier 1).
- **Navigation:** Sidebar → Operations → Production.
- **Expected flow:** Overview (see the trend) → Listing/Forms (log new data) — a short, frequent-use flow.

### Inventory
- **Overview:** Stock-level summary with threshold indicators (not charts, per Constitution §6).
- **Listing:** Item table with per-item stock-level progress indicator.
- **Detail:** Item detail (usage history as a Timeline).
- **Analytics:** None — deliberately excluded per the Constitution's inventory rule.
- **Forms:** Add/adjust stock.
- **Actions:** Add item, adjust stock, low-stock alert dismissal.
- **Navigation:** Sidebar → Operations → Inventory.
- **Expected flow:** Overview (spot low stock) → Listing (locate item) → Forms (adjust).

### Reports
- **Overview:** N/A — Reports *is* the deep-analysis template, it has no separate Overview layer above itself.
- **Listing:** N/A — Reports presents analysis, not a browsable record list.
- **Detail:** N/A.
- **Analytics:** The module's entire purpose — heatmaps, multi-series comparisons, cross-module trends, per Constitution §6's Reports allowance.
- **Forms:** None (export configuration only, not data entry).
- **Actions:** Export, change date range/comparison period.
- **Navigation:** Sidebar → Reports (top-level, not nested under Operations).
- **Expected flow:** Arrive with a specific analytical question → configure the view → export or screenshot for external use.

### Settings
- **Overview/Listing/Detail:** N/A — pure configuration template, no analytics or record browsing.
- **Forms:** Farm profile fields, preference toggles.
- **Actions:** Save changes; admin-only maintenance tools (existing Service Worker recovery tools live here).
- **Navigation:** Sidebar → Administration → Settings.
- **Expected flow:** Infrequent, deliberate visits — never part of a daily operational flow.

### Users
- **Overview:** N/A.
- **Listing:** User table with role badges.
- **Detail:** Individual user's role/permission detail.
- **Forms:** Add user, edit role.
- **Actions:** Add user (Tier 1, admin-only), deactivate user.
- **Navigation:** Sidebar → Administration → Users.
- **Expected flow:** Admin-only, infrequent.

---

## Section 7 — Screen Density Rules

| Element | Maximum per screen | Rule for exceeding it |
|---|---|---|
| KPI cards | 4 per row, 8 total (Dashboard); 4 total (Module Overview) | Never exceeded — additional metrics move to Reports |
| Charts | 2 (Dashboard, Module Overview); no hard cap on Reports | A third chart request on a non-Reports screen is a signal that content belongs in Reports instead |
| Tables | 1 primary table per Listing screen | A second table means the screen is trying to be two Listings — split it |
| Alerts | No hard cap, but >10 regularly visible signals threshold logic needs revisiting (per Constitution §5) | Investigate the alert-generation logic, not the display component |
| Colors (non-semantic) | Brand palette only (2 primary + neutrals) | Any additional color must map to an existing semantic status, never a new decorative hue |
| Widgets (general) | Governed by Tier system (Section 4) — Tier 3/4 items are the first cut if a screen feels crowded | Remove Tier 3/4 elements before ever reducing Tier 1/2 |

**When information should be hidden:** anything Tier 3 or below, on first view of a Listing/Detail screen, is a candidate for progressive disclosure (an expandable section, a "show more" action) rather than always-visible — especially on mobile, where vertical space is the scarcest resource.

**When progressive disclosure should be used:** any Detail template's less-frequently-needed record history (e.g., older Timeline entries beyond the most recent ~5) collapses behind a "show more" rather than rendering in full by default.

---

## Section 8 — Data Visualization Rules

For every chart, the following must be defined *before* implementation — no chart proceeds to build without all seven:

| Field | Requirement |
|---|---|
| **Purpose** | One sentence, stated plainly |
| **Decision** | The specific operational decision this chart supports (Constitution §6's governing test) |
| **Chart type** | Selected from the domain-appropriate list already defined in the UX Constitution — never a novel chart type introduced ad hoc |
| **Interactions** | Defined explicitly (e.g., "hover shows exact value + date," "click a bar to filter the table below") — never left implicit |
| **Filters** | Which period/category filters apply, if any |
| **Hover** | Exact content of the hover tooltip, specified in advance |
| **Empty state** | What renders when there's no data yet (never a blank canvas) |
| **Loading state** | Skeleton treatment, matching the existing project-wide skeleton pattern |
| **Error state** | The mandatory text/table fallback if the charting library fails to load — carried forward as an absolute requirement from the existing `bayan.html` precedent, now mandatory everywhere |

**Absolute rule, restated for an executing design AI:** a chart with no stated decision in the "Decision" field above is not built, regardless of how compelling it looks in isolation.

---

## Section 9 — Motion System

**Philosophy:** motion exists to help the operator track what changed, never to impress. Every animation in this system is subtle enough to go unnoticed by someone not paying attention to it, and clear enough to be tracked by someone who is.

| Element | Timing | Behavior |
|---|---|---|
| **Hover** | Fast (existing `--motion-duration-fast` token, ~150ms) | Subtle elevation/border-color shift only — never a scale or position change large enough to shift surrounding layout |
| **Cards** | Fast on hover; base duration on any content transition | Border/shadow change only, consistent with the existing unified card system |
| **Sidebar** | Base duration (~250ms) for expand/collapse | Slide, not fade — a spatial metaphor matches how the operator understands "the menu is still there, just hidden" |
| **Modal** | Base duration for open; fast for close | Existing slide-up-and-fade pattern, retained exactly as implemented today — this is already correct and needs no redesign |
| **Navigation (page transitions)** | No custom transition | Given the underlying stack is server-rendered pages (not an SPA), page-to-page navigation uses the browser's natural load — no fake transition is invented to simulate SPA behavior |
| **Charts** | Base duration for initial render (a brief draw-in); no animation on data refresh | Repeated refresh animations on live/polling data become distracting rather than helpful over time |
| **Skeleton** | Continuous subtle pulse, existing pattern | Retained as-is; this is a solved problem in the current codebase |
| **Transitions (general)** | Fast for anything reversible (hover, focus), base for anything that changes what's on screen (modal, sidebar) | Never slow — an operator under time pressure should never feel the interface is making them wait for an animation to finish |
| **Micro-interactions** | Button press states, form field focus rings | Immediate (no easing delay) — these must feel like direct manipulation, not an animated response |

---

## Section 10 — Navigation Architecture

- **Sidebar hierarchy:** Overview → Herd (Animals, Health, Production) → Operations (Inventory, Tasks, Diary) → Finance → Reports → Administration (Settings, Users, Farm Profile, Activity) — a grouped structure, replacing today's flat list, directly implementing the Future UI Architecture's navigation redesign.
- **Header actions:** Global search, notifications bell, user menu — present identically on every page, never module-specific.
- **Breadcrumb rules:** Shown on every Listing and Detail page (module → current location); never shown on Dashboard (it has no parent) or Settings (a single-level destination).
- **Search behavior:** One global entry point; results grouped by type (animal, task, record) rather than a single undifferentiated list.
- **Global filters:** Date-range selection, where relevant, persists across a session within the same module (an operator adjusting the Finance date range shouldn't have to reset it navigating between Finance Overview and Finance Listing).
- **Notifications:** Existing centralized system, surfaced via the header bell everywhere — not reinvented per page.
- **Shortcuts:** Reserved for a future phase — not part of this blueprint's initial scope; flagged here so a design AI does not invent one unprompted.
- **Recent pages / Favorites:** Same — reserved for future consideration, explicitly not part of this blueprint. **A design AI must not invent either of these without a separate, explicit brief.**

---

## Section 11 — Visual Consistency Rules

One language, applied everywhere, no exceptions:

- **Spacing:** The single scale defined in Section 3 — no component or page introduces its own spacing value.
- **Typography:** The five-level hierarchy from the UX Constitution (page/section/card/body/caption), Lexend for numeric emphasis, Cairo for descriptive text.
- **Buttons:** The existing `action-btn` system and its modifiers — no new button visual treatment is created for any reason.
- **Cards:** The existing unified card system (already consolidated in this project's prior CSS work) — no page-specific card variant.
- **Tables:** One table component, one visual treatment, used identically across every Listing.
- **Forms:** One field style, one validation-error style, used inside the one centralized modal system.
- **Dialogs:** The existing sm/md/lg/xl modal size tiers — no new size invented.
- **Badges:** One badge component, colored exclusively by semantic status.
- **Icons:** Bootstrap Icons exclusively — no second icon library introduced.
- **Charts:** One charting library (Chart.js, already a proven dependency), one consistent color-to-series mapping across every chart in the product.

---

## Section 12 — AI Design Constraints

Explicit, non-negotiable instructions for any design-generation AI (Lovable, Framer AI, v0, Figma AI, or equivalent) executing against this blueprint:

- **DO NOT invent colors.** Use only the existing brand and semantic color tokens.
- **DO NOT invent spacing.** Use only the scale defined in Section 3.
- **DO NOT invent layouts.** Every screen must map to one of the six templates (Dashboard, Module Overview, Listing, Detail, Settings, Form) — no seventh, bespoke layout is created.
- **DO NOT invent navigation.** The sidebar hierarchy in Section 10 is fixed; no new top-level section is added without an explicit, separate brief.
- **Always follow the Design System.** Every component used must already exist in Section 4/11's component inventory — if it doesn't exist there, stop and ask, don't invent a substitute.
- **Never create decorative UI.** Every element must trace to a stated purpose (Constitution §2, Principle 2).
- **Never duplicate components.** If two screens seem to need "almost the same but slightly different" component, that's a signal to generalize the existing component with a variant/state, not to create a second one.
- **Never create isolated page styles.** No `<style>` block or page-specific CSS override outside the shared design-token system.
- **Never change component behavior** (a Modal that behaves differently on one page than another is a defect, not a feature).
- **Always reuse.** The default assumption for any new screen is "this is built entirely from existing components and templates" — a request to build something new should be treated as suspicious until proven necessary.
- **Never exceed the density limits in Section 7** regardless of how much content stakeholders want visible on one screen.
- **Never introduce a chart without completing every field in Section 8's table first.**
- **When uncertain, prefer the plainer, less decorated option** — consistent with Section 1's "calm" and "data-first" philosophy.

---

## Section 13 — Redesign Priorities

| Rank | Screen | Why this rank |
|---|---|---|
| 1 | **Dashboard** | Highest-visibility screen, every session starts here, and it currently has the largest gap between what exists and what the Constitution requires (zero charts today) |
| 2 | **Animals** | Highest-traffic operational screen; also the module with the most existing complexity to preserve carefully during migration (1,499 lines today) |
| 3 | **Animal Detail** | Directly downstream of #2; establishes the Detail template pattern every other module's Detail screen will then follow |
| 4 | **Health** | High operational importance (withdrawal periods are a real compliance/safety concern) and currently the thinnest module relative to its real-world importance |
| 5 | **Production** | The single clearest "zero visualization exists today" gap with an obvious, high-value fix (a trend line) |
| 6 | **Finance** | Important but lower daily-use frequency than Health/Production |
| 7 | **Inventory** | Lower visual complexity needed (no charts, per Constitution) — a comparatively quick, low-risk redesign once the Listing/Detail pattern is established from earlier ranks |
| 8 | **Reports** | Benefits from every other module's Overview/Analytics pattern being finalized first, since Reports aggregates across them |
| 9 | **Settings** | Pure configuration, lowest daily-use frequency, safe to defer |
| 10 | **Users** | Admin-only, lowest frequency of all, safest to defer to last |

**Rationale for the overall order:** establish the Dashboard and Animals/Animal-Detail pattern first (the highest-traffic, highest-risk pages, done carefully once), then apply the now-proven Overview/Listing/Detail pattern to progressively lower-traffic modules — directly mirroring the phased migration strategy already established in the Future UI Architecture document, not a new sequencing logic invented here.

---

## Section 14 — Acceptance Criteria

Every new screen is evaluated against this checklist before it is considered complete. (This extends, and does not replace, the UX Constitution's own 50-question Design Review Checklist — the questions below are the execution-specific complement to it.)

**Template & Structure**
1. Does the screen map to exactly one of the six defined templates?
2. Does it match that template's Section 5/6 blueprint exactly, not a variation of it?
3. Does the visual hierarchy follow Section 2's level order without exception?
4. Is the Page Header present and identical in structure to every other page's header?
5. Is the sidebar present, in its correct grouped state, with the current page correctly highlighted?

**Density & Overload**
6. Does it respect the maximum KPI card count for its template?
7. Does it respect the maximum chart count for its template?
8. Does it contain only one primary table (if a Listing)?
9. Does it avoid overloading the user with more than the defined density limits?
10. Is any Tier 3/4 content collapsed or deferred where the screen would otherwise feel crowded?

**Data Visualization**
11. Does every chart have a completed Section 8 definition (purpose, decision, type, interactions, filters, hover, three states)?
12. Does every chart answer a real, stated operational decision?
13. Is the chart type appropriate for its data domain per the UX Constitution's table?
14. Does every chart have a defined empty/loading/error state?
15. Is there a text/table fallback if the charting library fails?

**Component Reuse**
16. Are all components drawn from the existing inventory (Section 4/11), with no new one-off component introduced?
17. Are buttons using the existing `action-btn` system exclusively?
18. Are cards using the existing unified card system exclusively?
19. Are modals using an existing size tier exclusively?
20. Are badges mapped to defined, finite status values only?

**Spacing & Typography**
21. Does all spacing use the defined scale, with zero one-off values?
22. Does typography follow the five-level hierarchy?
23. Is Lexend used for numeric emphasis and Cairo for descriptive text, without exception?
24. Is the maximum content width respected on desktop?
25. Is section/card spacing consistent with Section 3's rhythm?

**Color**
26. Is color used only for brand identity or semantic status, never decoration?
27. Does every status indicator use the correct, existing semantic color mapping?
28. Is contrast sufficient for all text and status indicators?
29. Is status never communicated by color alone (an icon/label backup exists)?

**Navigation**
30. Is the breadcrumb present where required (Listing/Detail) and absent where it shouldn't be (Dashboard/Settings)?
31. Does the primary action match Tier 1 visual priority?
32. Is global search accessible identically to every other page?
33. Are notifications accessible identically to every other page?

**Motion**
34. Do hover states use the fast-duration token exclusively?
35. Do modal/sidebar transitions use the base-duration token exclusively?
36. Is any animation present only where it aids comprehension, per Section 9?
37. Is there zero purely decorative motion anywhere on the screen?

**Responsiveness & RTL**
38. Does the KPI grid correctly reflow (4/2/1) across desktop/tablet/mobile?
39. Was the layout designed RTL-first, not mirrored?
40. Do all interactive elements meet minimum touch-target size on mobile?
41. Does the sidebar correctly become an off-canvas drawer on mobile?

**Consistency**
42. Does this screen's visual treatment match the depth/maturity of comparable screens in other modules?
43. Does it avoid introducing any pattern not already present in Section 11's consistency rules?
44. Would a design review by someone unfamiliar with this specific screen still recognize every component's behavior from having used the rest of the product?

**Governance**
45. Does the screen trace every non-obvious decision back to a specific section of this blueprint, the UX Constitution, or the Future UI Architecture document?
46. If any rule was deviated from, is that deviation explicitly documented as a proposed amendment rather than a silent exception?
47. Was the screen checked against the UX Constitution's own 50-question checklist in addition to this one?
48. Does the screen avoid any AI Design Constraint violation from Section 12?
49. Is the screen's redesign priority rank (Section 13) consistent with when it was actually built?
50. Is this screen implementable using only Vanilla JS / Bootstrap 5.3.3 / the existing CSS token system — with zero new framework or library dependency introduced?

---

## Section 15 — Deliverables

**Visual Hierarchy Map:** Section 2's 8-level diagram, applied per-template — every template's specific screens (Section 5/6) are an instantiation of that same 8-level order.

**Navigation Tree:**
```
Overview (Dashboard)
Herd
 ├── Animals (Overview → Listing → Detail)
 ├── Health (Overview → Listing → Detail)
 └── Production (Overview → Listing → Detail)
Operations
 ├── Inventory (Overview → Listing → Detail)
 ├── Tasks
 └── Diary
Finance (Overview → Listing → Detail)
Reports (Analytics only)
Administration
 ├── Settings
 ├── Users (Listing → Detail)
 ├── Farm Profile
 └── Activity
```

**Screen Flow:** Login → Dashboard → [Module Overview → Listing → Detail → (action) → back to Listing] → Dashboard, with Reports and Settings/Users reachable directly from Sidebar at any point without disrupting an in-progress operational flow.

**Component Dependency Graph:**
```
Design Tokens (color/spacing/typography)
   ↓
Layout Components (Shell, Header, Section Container, Grid)
   ↓
Data Components (KPI Card, Chart Container, Table, Timeline, Activity Feed)
   ↓
Farm-Specific Components (Animal Card, Status Badge, Alert Card, Farm Score)
   ↓
Templates (Dashboard, Module Overview, Listing, Detail, Settings, Form)
   ↓
Pages (every screen in the product, each an instance of exactly one template)
```

**Template Matrix:** the six templates × modules table already given in Section 6, restated as the single source of truth for "which template does page X use."

**Priority Matrix:** Section 13's ranked table.

**Migration Order:** Dashboard → Animals/Animal Detail → Health → Production → Finance → Inventory → Reports → Settings → Users, matching Section 13 exactly, and matching the phased approach already defined in the Future UI Architecture document's Migration Strategy.

**Implementation Roadmap:** Foundation tokens (already exist, verified in codebase) → Layout/Data/Farm-Specific components (build once, per Section 4's tier order) → Templates (build once each) → Pages (apply templates in Migration Order) — never pages built ahead of their template being finalized.

**AI Design Rules:** Section 12, in full — the literal instruction set for any executing design AI.

**Review Checklist:** Section 14, in full, used alongside (not instead of) the UX Constitution's own Section 10 checklist.

**Important Rules, restated:** never redesign randomly, never optimize on taste alone — every decision in this document traces to the Future UI Architecture or UX Constitution. Where those two documents could be read as being in tension (they are not found to conflict anywhere in this pass), the resolution approach is: state the reason, state the trade-off, state a recommendation — never silently pick one. **No conflicts were found between the two source documents during this blueprint's construction.**

**This is a blueprint, not a design and not code.** No UI has been generated. No implementation has been written. This document exists solely to give an executing design AI (or a human designer) an unambiguous, enforceable specification to build against.
