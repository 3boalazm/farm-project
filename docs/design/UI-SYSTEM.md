# UI-SYSTEM.md — نظام الواجهة (Design System v2 · "Farm OS")

**Added by the 2026-10 UI/UX pass.** This is the reference for how the product looks and
behaves. `ui.css` is the implementation of §1–§10 of this document; `ui-shell.js` is the
implementation of §11–§16. Everything here is **additive**: no page was rewritten to adopt
it, the shell mounts on top of the markup that already exists.

> **2026-10-20 addendum — read [`UX-RESEARCH-2026-10.md`](UX-RESEARCH-2026-10.md) first.**
> A research pass (livestock dashboard playbooks, PIN-pad/kiosk accessibility, the 2026-27
> SaaS shell benchmark, and login-privacy guidance) rebuilt three things this document did
> not cover: the login screen (identifier-first, nobody named before the PIN is verified),
> the keypad (a strict 3-column grid), and the dashboard's reading order
> (status → context → work list). It also found and fixed the defect that had been
> cancelling most of this system's visual effect — see the Bootstrap bullet below.

> **Load order (all 34 app pages):**
> `styles.css` → **`ui.css`** … `config.js` → `firebase.js` → `nav.js` → `shared.js` → **`ui-shell.js`**
> `ui.css` must come *after* `styles.css` (it wins the cascade), and `ui-shell.js` must come
> *after* `shared.js` (it upgrades `window.toast`). `tests/unit/23` enforces both.

---

## 1. What this pass changed, in one paragraph

The app had good bones (a token layer, a navigation rail, a component library in
`shared.js`) and three structural problems: the tokens stopped at colour (no focus ring,
density, z-index or motion contract), the shell had no **topbar** — so there was nowhere to
put search, notifications or the user menu — and every list page re-invented its own table,
empty state and toast. This pass adds a complete token system, one app shell that all 34
pages share, a command palette, and a component set with all five states each. Dark and
light are both first-class, both checked against WCAG AA by a test.

---

## 2. Design principles (the rules that decide arguments)

1. **الأرقام أولًا — Numbers first.** This is an operations console, not a brochure. Every
   number uses `--font-num` (Lexend) with `tabular-nums`, so columns align while data streams
   in and a weight of `٤٥٫٢` never jitters into `٤٥٫٢٠`.
2. **حالة واحدة = لون واحد.** Status colours are reserved for *state*. `--brand` (emerald) is
   the only decorative accent. A red badge therefore always means "act now" — which is why
   the action queue (§14) can be read at a glance.
3. **Keyboard-first.** Anything reachable by mouse is reachable by keyboard: ⌘K for
   everything, `g`+letter for the nine hottest pages, `?` for the map, `Esc` for out.
4. **لا يوجد صندوق فاضي.** No blank boxes. Every async surface has a skeleton that matches
   the shape it stands in for, an empty state with a verb, and an error state with a retry.
5. **RTL is the default, not a mirror.** All spacing uses logical properties
   (`inline-start/end`, `block-start/end`). `tests/unit/23` fails the build if a physical
   `left`/`right` appears in `ui.css`.
6. **التفضيلات تُحترم.** Theme, density, contrast and motion are user settings, persisted per
   device, applied *before first paint* (inline head script), and honoured again via
   `prefers-color-scheme`, `prefers-reduced-motion` and `prefers-reduced-transparency`.
7. **Additive or nothing.** A page that does not load `ui-shell.js` renders exactly as it did
   before. The shell never owns data, only chrome.

---

## 3. Tokens (`ui.css` §1–§4)

| Layer | Examples | Rule |
|---|---|---|
| **Primitive** | `--brand-400`, `--slate-900`, `--sp-4`, `--r-lg`, `--fs-md` | Raw scales. Never used by a component. |
| **Semantic** | `--surface-base`, `--surface-raised`, `--text-primary`, `--text-tertiary`, `--danger-surface`, `--border-default` | Role → primitive. Components use *only* these. |
| **Component** | `--btn-primary-bg`, `--card-radius`, `--row-pad-y`, `--field-pad-x` | One component's knobs; density changes these. |

* **Type** is fluid: `--fs-sm: clamp(.79rem, .77rem + .14vw, .86rem)`. Eight steps, no media
  queries, legible from a 320 px phone to a 1920 px office screen. The legacy names
  (`--text-sm`, `--text-lg`…) are aliases, so 700 lines of `styles.css` inherit the fix.
* **Surfaces** are four ranks of "closeness to the user": `--surface-base` (the page),
  `--surface-raised` (a card), `--surface-overlay` (a popover), `--surface-sunken` (an inset).
  Text has four matching ranks — `--text-primary`, `--text-secondary`, `--text-tertiary`,
  `--text-quaternary` — each AA-checked against the surface it normally sits on.
* **Space** is a strict 4 px grid (`--sp-1`…`--sp-24`).
* **Elevation** is five tiers (`--elev-1`…`--elev-5`) built from one theme-aware
  `--shadow-rgb`, so light mode is not muddy and dark mode is not flat.
* **Motion**: four durations × five easings. `--ease-emph` (`cubic-bezier(.2,0,0,1)`) is the
  one used for anything that travels (sheets, bars); `--ease-spring` only for small, joyful
  things (a tab indicator, a bottom-nav icon).
* **Z-index** is a single ladder: rail 900 < topbar 950 < dropdown 1000 < drawer 1100 <
  modal 1200 < toast 1300 < palette 1400 < tooltip 1500. No more ad-hoc `2001`.
* **Legacy compatibility:** `--orange` and `--green` (which were both green — the documented
  Phase-1 trade-off) are now aliases of `--brand`, and the whole old token vocabulary
  (`--bg`, `--bg-2`, `--text-sub`, `--card-bg`, `--sb-bg`, `--input-bg`…) resolves to the new
  semantic tokens, so no page or `<style>` block had to be touched.

### Themes
`data-theme="dark" | "light"` on `<html>`, plus the legacy `.light-mode` class kept in
lockstep. `auto` follows the OS and updates live (`matchMedia` change listener). A
`data-contrast="high"` variant lifts every border and text rank without changing layout, and
`data-motion="off"` kills transitions for vestibular-sensitive users.

### Density
`data-density="compact" | "cozy" | "comfortable"` changes **only metrics** (`--row-pad-y`,
`--card-pad`, `--field-pad-y`, `--topbar-h`, `--gutter`) — never colour or type, so a density
cannot break a layout. `compact` is the field/phone setting: ~40 % more herd rows per screen.

---

## 4. Accessibility contract

| Requirement | Implementation | Checked by |
|---|---|---|
| Contrast AA (4.5:1 body, 3:1 large/UI) in **both** themes | 16 core pairs + 6 badge pairs computed from the tokens | `tests/unit/23` |
| Focus always visible | `:focus-visible` + `--ring`/`--ring-soft`, never `outline:none` alone | ui.css §5 |
| One `aria-current` per nav | rail tree link only (F-24 in the audit) | `tests/unit/19` |
| Live regions | toast wrapper `aria-live=polite`, errors `role=alert` | `tests/unit/24` |
| Dialogs | `role=dialog`, `aria-modal`, focus trap, `Esc`, focus restored to the trigger | `tests/unit/24` |
| Tables | `th` sortable via keyboard (`Enter`/`Space`), `aria-sort` maintained, sticky headers announced once | `tests/unit/24` |
| Hit areas | `--tap-min: 44px` (WCAG 2.5.5), `--tap-compact: 36px` for dense toolbars | ui.css §1 |
| Reduced motion / transparency | media-query overrides, plus explicit user toggles | ui.css §5 |
| Skip link | first focusable element on every page → `#main-content` | `tests/unit/24` |
| Colour is never the only channel | status pills carry a dot **and** a word; deltas carry an arrow **and** a sign; the active rail item carries a bar | ui.css §7.3, §7.5 |

---

## 5. App shell (`ui.css` §6, `ui-shell.js` §10)

```
 ≥1200px                      992–1199px                   <992px
┌────┬──────────────┬────┐   ┌────┬───────────────────┐   ┌───────────────────┐
│    │ APPBAR       │    │   │    │ APPBAR            │   │ APPBAR (compact)  │
│RAIL├──────────────┤PANL│   │RAIL├───────────────────┤   ├───────────────────┤
│    │ content      │    │   │(ic)│ content           │   │ content           │
│    │              │    │   │    │                   │   ├───────────────────┤
└────┴──────────────┴────┘   └────┴───────────────────┘   │ BOTTOM NAV (5+⋯)  │
  rail = tree + icons          rail = icons only           └───────────────────┘
  panel = user, prefs           panel = drawer              rail/panel = drawers
```

* **Appbar** (fixed, blurred, `--topbar-h`): menu button (mobile) · breadcrumb
  (`section › page`) · page title · **search trigger** · quick-add · bell · theme · user menu,
  plus a 2 px **load bar** that appears whenever a Firebase request is in flight (a
  pass-through `fetch` wrapper counts them; no page has to opt in).
* The appbar earns `box-shadow` only after the page has scrolled (`.is-stuck`), which is the
  cheapest possible "you are not at the top" signal.
* **Bottom nav** below 992 px: the five destinations that carry the daily traffic
  (`dashboard`, `animals`, `births`, `health`, `tasks`) + "المزيد" which opens the rail
  drawer. Permission-filtered, M3-style active indicator, respects `safe-area-inset-bottom`.
* The page title is watched with a `MutationObserver`, because pages render their header
  asynchronously — the appbar never shows a stale title.

---

## 6. Command palette — ⌘K (`ui-shell.js` §4)

The single most borrowed pattern from Linear / Vercel / Notion, and the highest-leverage one
here: 37 pages, five roles, and a herd of thousands make navigation the product's main cost.

* **Sources are pluggable** — `UIShell.palette.register({group, priority, items()})`. Four ship
  by default: **إضافة سريعة** (9 record-creating actions), **إجراءات** (theme, density,
  notifications, print, undo, contrast, logout…), **القطيع** (animals already in memory on this
  page — the palette never triggers its own fetch, so it opens instantly on a farm connection),
  and **الصفحات** (from `FARM_NAV`, permission-filtered).
* **Arabic-aware fuzzy matching.** Queries are folded first: harakat/tatweel removed,
  `أإآٱ→ا`, `ى→ي`, `ؤ→و`, `ئ→ي`, `ة→ه`. So `مولد` finds **المواليد**, `تحصين` finds
  **التحصين**, `hsab` finds **حاسبة التكاليف**. Scoring rewards consecutive hits and
  word-initial hits, which is what keeps the right result first without a search index.
* **Matches are highlighted** with `<mark>` (styled as brand-coloured bold, no background —
  backgrounds in a list read as "selected").
* **Recent items** (7, in `localStorage['farm_ui_recent']`) appear when the query is empty, so
  the second trip to a page is one keystroke.
* Keyboard: `↑ ↓` move, `PageUp/Down` jump six, `Home/End`, `Enter` run, `Esc` close, `?`
  opens the shortcut map, `Tab` is trapped inside the panel. Mouse hover and click behave
  identically. Focus returns to whatever opened it.
* `Ctrl+K` works *inside* text fields too; `/` works only outside them (so typing a slash in a
  note never steals the keyboard).

---

## 7. Toasts v2 (`ui-shell.js` §2)

`window.toast(msg, type)` is replaced — same signature, so ~140 existing call sites upgrade
with no edit — by a version that adds:

* an optional **title**, an **action button**, an explicit **duration** and an **id**;
* **undo**: `UIShell.toast.undo(msg, fn)` — the visible home for the Undo feature the audit
  found dead (F-06);
* **dedupe by id** (a polling page shows one evolving toast, not four identical ones);
* **max 4** on screen, oldest dropped;
* **hover pauses** the countdown and its draining progress bar, so a toast you are reading
  cannot vanish mid-sentence;
* `role="alert"` for errors, `role="status"` otherwise, inside one `aria-live="polite"` region.

---

## 8. Tables (`ui.css` §7.6, `ui-shell.js` §12)

The pattern every list page converges on:

```
.table-toolbar   search · filters · density · export
.table-wrap      scrollable region, sticky <thead>, rounded shell, tabindex=0
.table           rows with hover/selection, tabular numbers, row actions revealed on hover
.table-foot      "‏12 من 340 سجل" + pagination
```

Opt in with `<table class="table" data-ui-table>`; columns with `data-sort="numeric|text|date|none"`
(auto-detection samples eight cells). Features that matter on a farm:

* **Sticky headers** that clear the fixed appbar (`--table-sticky-offset`).
* **Arabic-Indic-aware sorting**: `٤٥٫٢` sorts as 45.2 — `num()` folds `٠-٩` and `۰-۹` and the
  Arabic decimal separator before comparing, so a weight column sorts numerically instead of
  alphabetically.
* **Keyboard sorting**: `th` is focusable, `Enter`/`Space` toggles, `aria-sort` is maintained
  on exactly one column.
* **Row actions** are dimmed until hover — but on touch (`@media (hover:none)`) they are always
  full opacity, because there is no hover to reveal them.
* **Filter binding** via `data-ui-filter="#myInput"`, and a result counter that reads
  "12 من 340 سجل" so filtering never looks like data loss.
* `.bulk-bar` — a floating pill that rises when rows are selected, anchored above the bottom
  nav on phones.

---

## 9. Cards, KPIs and the metric hero (`ui.css` §7.4–§7.5)

* **KPI card**: label with an icon → value + unit → **delta chip** → sparkline → footer slot.
  The delta chip carries an arrow *and* a word *and* a colour (`▲ ١٢٪ عن الشهر الماضي`), so the
  direction survives greyscale printing and colour-vision deficiency.
* KPI numbers are solid ink now. The legacy gradient text-clip (`background-clip:text`) was
  pinned to the dark palette and turned unreadable in light mode — repaired in §11 of ui.css.
* Status variants (`kpi--status-danger` etc.) put a 3 px coloured edge on the card, which reads
  in peripheral vision without competing with the number.
* `.metric-hero` is the one oversized metric (Farm Health Score) with a progress ring.

---

## 10. Async states (`ui.css` §7.9)

`skeleton` variants match real shapes (`--text`, `--title`, `--circle`, `--row`, `--card`,
`--chart`) and shimmer in the correct direction for RTL. `.state` is the shared empty/error
shell: icon slot, one line of meaning, one verb. The rule: **an empty list must say what would
be here and how to add it** — "لا توجد سجلات" alone is a dead end.

---

## 11. Dialogs, sheets and menus (`ui.css` §7.11–§7.12)

One markup, two shapes: a centred dialog on desktop, a **bottom sheet** below 768 px (thumb
reach, never covers the status bar, with a grab handle). `Confirm.open()` replaces
`window.confirm()` — which cannot be styled, blocks the thread, and reads "example.com says"
in an Arabic UI. Menus (quick-add, user) are one-at-a-time, close on `Esc` and outside click,
and move focus to their first item on open.

---

### 11.1 · عقد التأكيد والإدخال — ‏`farmConfirm` / `farmPrompt` (‏2026-10-20)

كل إجراء تخريبى فى التطبيق يُؤكَّد عبر هاتين الدالتين، لا عبر `window.confirm()` / `window.prompt()` — فالاثنان **بلا جسر فى WebView الخاص بـCapacitor** (يرجعان `false` / `null`)، وقد تسبّبا فى أن كل حذف ومسح على الهاتف كان يلغى نفسه بصمت. التفاصيل الكاملة: `docs/bugs/DESTRUCTIVE-ACTIONS-2026-10.md`.

| الدالة | الخيارات | الإرجاع |
|---|---|---|
| `farmConfirm(message \| opts)` | `title, message\|body, confirmLabel, cancelLabel, danger, icon, typeToConfirm, onConfirm, onCancel` | ‏`Promise<boolean>` |
| `farmPrompt(message \| opts)` | `title, label, placeholder, confirmLabel, cancelLabel, required, onConfirm, onCancel` | ‏`Promise<string \| null>` |

- **ثلاثة مستويات** بالترتيب: حوار الـshell (`showModal` من `shared.js`) ← `window.confirm`/`window.prompt` ← لوحة inline تُضاف إلى `<body>` (‏`.farm-confirm-fallback`, ‏`ui.css` §15). مستوى مفقود لا يجوز أن يُلغى الإجراء.
- ‏`typeToConfirm:'عبارة'` و`required:true` يضعان الحقل **داخل الحوار** بدل `prompt()`، ويبقى زر التأكيد `:disabled` حتى تُكتب العبارة/الإجابة.
- الإغلاق بـEscape أو بالضغط على الخلفية يمرّ عبر `closeModal()` دون لمس أزرارنا، فـ`MutationObserver` على `#modal-root` يحسم الوعد بـ`false`/`null` — لا تعليق.
- عقد الـcallback (`onConfirm`) **ما زال مدعومًا** (يستخدمه إجراءَا تسجيل الخروج داخل `ui-shell.js`).
- ‏`UIShell.confirm` / `UIShell.prompt` نفس الدالتين على سطح الـshell، والتعريف في `ui-shell.js` §6 (‏`CONFIRM dialog`) — `Confirm`/`Prompt` و`farmConfirm`/`farmPrompt`.

## 12. Notification center (`ui.css` §8.2, `ui-shell.js` §9)

The bell opens a **panel**, not a page: grouped into "يحتاج إجراء الآن" / "قريبًا / متابعة" /
"معلومات", each item an anchor that deep-links, unread items carrying a leading bar. It renders
`computeInboxNotifications()` — a function **extracted from `loadNotifDropdown()`** so the legacy
dropdown in the user panel and the new center can never disagree about what is urgent. The
badge count refreshes every two minutes, and only while the tab is visible.

---

## 13. Quick-add (`ui.css` §8.4)

One `+` button in the appbar with the six things a farm records several times a day: وزن،
ميلاد، حركة مالية، مهمة، تحصين، علاج. Each entry **prefers the in-page modal when the current
page already has it** (no reload, no lost filters) and otherwise navigates with `?quick=<fn>`,
which the shell executes on arrival. Permission-filtered, so a visitor never sees an action
they cannot perform.

---

## 14. Action queue (`ui.css` §8.3)

The dashboard's answer to "what do I do first": a ranked list where each row is
`priority · title · why · when · one verb`. Overdue items get `--danger` and a bold relative
date. It is a *list of links*, not a widget — clicking goes straight to the record.

---

## 15. Print (`ui.css` §10)

Reports and `bayan` are printed daily in a farm office. The print sheet strips all chrome
(appbar, rail, panel, bottom nav, toasts, palette, toolbars, pagination), forces black on
white, repeats `<thead>` on every page (`display:table-header-group`), forbids rows from
splitting across pages, expands URLs after external links, and provides `.print-header` /
`.print-footer` for the office letterhead. Badges print as outlines so they survive a
monochrome laser printer.

---

## 16. Bugs this pass repaired in the existing CSS

| # | Bug | Effect | Repair |
|---|---|---|---|
| U-01 | A comment in `styles.css` ended with `.sidebar-*` — the star+slash **closed the comment eight lines early** | ~600 characters of prose were parsed as CSS; the next rule (`.rail-v2-mobile-bar{display:none}`) risked being invalidated, and any CSS tooling reported a syntax error | Comment reworded; `tests/unit/23` now fails on any self-terminating comment and on unbalanced `/* */` |
| U-02 | `html.light-mode, body.light-mode .badge-x{…}` (7 rules) | The comma group styled the **root element** with badge colours: light mode inherited `color:#475569` from the last rule in the group, and light-mode badges themselves were never styled | Selectors rewritten at the source, plus a regression test that rejects the pattern |
| U-03 | Light-mode sidebar used a **yellow** gradient (`#fffde7 → #fff9c4`) | Unrelated to the brand and the lowest-contrast surface in the product | Rail is neutral in both themes; brand is reserved for the active item |
| U-04 | Active rail items hard-coded `#34d399` on `#022c22` | The documented THEME-SWITCH-SIDEBAR-ACTIVE bug class, reintroduced by a token rename | Both sides come from `--rail-item-active-*`, which keep ≥4.5:1 per theme (AA-tested) |
| U-05 | `html,body{overflow-x:hidden}` | Turns both into scroll containers and silently defeats `position:sticky` for every descendant (the legacy sticky navbar never stuck) | `overflow-x:clip` + the new shell is `position:fixed` |
| U-06 | KPI numbers used a gradient `background-clip:text` pinned to the dark palette | Unreadable in light mode | Solid themed ink |
| U-07 | `#ffffff` on `--brand-600` in light mode | 3.77:1 — **below AA** for a button label | Light-theme brand fills darkened to `--brand-700` (5.3:1) |
| U-08 | `.page-wrap{max-width:1200px}` | Wasted a 1440p screen and forced tables to scroll sideways | `--content-max:1440px` with a fluid gutter |

---

## 17. How to add a page or a component

1. **Page**: copy any existing page's `<head>` (it already contains the preferences script,
   `styles.css`, `ui.css`) and its script chain (`config → firebase → nav → shared →
   ui-shell`). Render `renderNavbarV2('<yourpage>.html')` and put content in
   `.page-wrap.rail-v2-content`. The appbar, bottom nav, palette, toasts and shortcuts arrive
   by themselves.
2. **Component**: add tokens to §2 of `ui.css` (semantic, both themes), styles to §7, and a
   test to `tests/unit/23` or `24`. Never hard-code a colour or a `px` spacing value in a
   component rule — that is how the 30 duplicate font sizes and 13 duplicate radii happened.
3. **Palette command**: `UIShell.palette.register({group:'أدوات', priority:40, items:()=>[…]})`
   from the page's own script. Nothing in the shell needs to know about it.

---

## 18. Known limits (deliberate, not forgotten)

* `ui.css` is ~2 520 lines in one file (§12 login and §14 dashboard overview were added by
  the 2026-10-20 research pass). The app has **no build step** by design (it must run
  from a `file://` copy on a farm laptop and inside the Capacitor APK), so splitting it would
  mean either a bundler or 34 more `<link>` tags. Sections are banner-commented and ordered so
  the file can be read top to bottom; gzipped it is ~16 KB.
* The palette's herd source only searches animals **already in memory on the current page**.
  Fetching the herd on ⌘K would make the first keystroke wait on the network, which is exactly
  what the palette exists to avoid. A dedicated search page with server-side queries is the
  right next step, not a lazy fetch here.
* Bootstrap 5.3 is still loaded from a CDN and still provides the grid some pages use. §9.1 of
  `ui.css` carries a handful of parity rules (`mb-3`, `fw-bold`, `d-flex`…) so a blocked or
  slow CDN degrades the spacing instead of collapsing the layout.
* **Never style `.row`, `.col` or `.container` from `ui.css`.** Bootstrap owns those class
  names, and 435 elements in this app are written `class="row"` with `.col-*` children. The
  v2 utility layer used to declare `.row{display:flex;gap:var(--sp-3);align-items:center}`,
  which added 12px of gap on top of Bootstrap's own gutters: a `.col-4` triple became
  100% + 24px and wrapped to **two** columns, and a `.col-6` pair collapsed to one. That is
  why the first UI pass looked like it changed nothing — every stat row, form row and card
  grid in the product was being re-flowed against its own design. Since 2026-10-20 the v2
  row is modifier-only (`.row--wrap`, `.row--between`, …) and `.col` became `.u-col`;
  `tests/unit/27` walks every selector in `ui.css` with css-tree and fails if a bare
  Bootstrap grid class is styled again.
* `farm-apk/www` must be re-synced after any change here: `node scripts/sync-apk-www.js`
  (`tests/unit/22` fails on drift).


## 19 · وضع العرض — ‏`ui.css` §16 (‏2026-10-20)

`.demo-bar` شريط ثابت أسفل الشاشة يعلن أن البيانات تجريبية وأنها لا تُحفظ في القاعدة، ويحمل مبدّل الحجم (صغير/متوسط/كبير) و«توليد جديد» و«إنهاء العرض». ‏`body.demo-mode` يعطي `padding-bottom` حتى لا يغطي الشريط آخر صف في جدول أو أزرار حوار، و`@media print` يخفيه فتخرج نسخة العرض المطبوعة نظيفة. نقطة الدخول في شاشة الدخول `.login-demo__btn` — زر واحد لا يعرض أي اسم (قيد الخصوصية قبل التحقق ثابت). المنطق كله في `demo-data.js` والعقد الكامل في `docs/design/DEMO-MODE.md`.
