# Component Library Reference — Phase 2

All functions live in `shared.js` (loaded on every page already). **Purely additive** — nothing existing was modified or removed, so no page can break from this change. Each one returns an HTML string (or, for the two `render*` header/state functions, injects directly into an element) — call it, drop the result wherever you're building `innerHTML`.

---

## 1. `renderPageHeaderV2(opts)`

Enhanced header with breadcrumb + description, on top of (not replacing) the original `renderPageHeader`.

```js
renderPageHeaderV2({
  title: 'القطيع',
  description: 'كل الحيوانات المسجلة في المزرعة',
  breadcrumb: [{ label:'الرئيسية', href:'dashboard.html' }, { label:'القطيع' }],
  primaryAction: '<button class="action-btn primary">إضافة حيوان</button>',
  secondaryActions: '<button class="action-btn">تصدير</button>'
});
```

`renderPageHeader(title, subtitle, actions)` still exists unchanged — every current page keeps working exactly as before. Use V2 only where you actually want a breadcrumb.

---

## 2. `renderSectionContainer(opts)`

Wraps any content in a titled card. `variant`: `default` | `highlighted` | `warning` | `compact`.

```js
container.innerHTML = renderSectionContainer({
  title: 'نظرة عامة',
  description: 'ملخص سريع',
  actionHtml: '<button class="action-btn sm">تحديث</button>',
  contentHtml: '<p>أي HTML هنا</p>',
  variant: 'highlighted'
});
```

---

## 3. `renderKPICard(opts)`

```js
renderKPICard({
  label: 'إجمالي القطيع',
  value: ar(1240),
  trend: 2.1, trendDir: 'up',
  comparisonPeriod: 'آخر 30 يوم',
  status: 'normal',                 // normal | watch | alert
  sparklineData: [1180,1200,1210,1225,1240],  // optional
  href: 'animals.html'               // optional, makes the whole card a link
});
```

States: pass `loading:true` for a skeleton placeholder, or `value:null` for the "no data" state. No separate functions needed — same call, different args.

---

## 4. `renderAlertCard(opts)`

One alert = one card. `severity`: `info` | `watch` | `critical`.

```js
renderAlertCard({
  severity: 'critical',
  icon: 'bi-heartbreak',
  title: 'نفوق اليوم',
  message: 'حالة نفوق واحدة مسجّلة',
  source: 'القطيع',
  deadline: 'اليوم',
  actionLabel: 'عرض', actionHref: 'animals.html'
});
```

For a list, `.map(renderAlertCard).join('')`.

---

## 5. `renderChartContainer(opts)`

Wraps a chart (any chart — SVG string, canvas placeholder, whatever) with a consistent title/subtitle/filter/state shell.

```js
renderChartContainer({
  title: 'اتجاه القطيع', subtitle: 'آخر 6 أشهر',
  filterHtml: '<select class="field" style="width:auto">...</select>',
  chartHtml: mySvgString,
  state: 'ready'   // ready | loading | empty | error
});
```

---

## 6. `renderDataTableWrapper(opts)`

```js
renderDataTableWrapper({
  title: 'السجلات الأخيرة',
  filterHtml: '<input class="field" placeholder="بحث...">',
  headers: ['التاريخ','النوع','الحالة'],
  rowsHtml: rows.map(r => `<tr><td>${r.date}</td><td>${r.type}</td><td>${r.status}</td></tr>`).join(''),
  state: 'ready',   // ready | loading | empty
  paginationHtml: '<button class="action-btn sm">التالي</button>'
});
```

---

## 7. `renderTimelineItem(opts)` + `renderTimeline(itemsArray)`

```js
const items = [
  renderTimelineItem({ time:'10:20', eventType:'تسجيل مولود', entity:'حظيرة أ', statusBadgeHtml:'<span class="type-badge badge-tarbiya">جديد</span>' }),
  renderTimelineItem({ time:'11:15', eventType:'بيع رأس' }),
];
container.innerHTML = renderTimeline(items);
```

---

## 8. `renderErrorState(el, msg)`

Small addition alongside the existing `renderLoading(el)` / `renderEmpty(el, icon, msg, btnHtml)`, for symmetry — same pattern, one more state.

```js
renderErrorState(document.getElementById('content'), 'تعذر تحميل البيانات');
```

---

## 9. `renderAnimalCard(opts)`

Block-style card (distinct from the existing `.animal-row` flex-row list item, which stays available for its own use).

```js
renderAnimalCard({
  tag: 'A-102', breed: 'بلدي', species: 'goat',
  status: 'treatment',   // alive | dead | sold | treatment | quarantine
  barn: 'حظيرة أ',
  href: 'animal-detail.html?id=1'
});
```

---

## 10. `renderProductionWidget(opts)`

Compact row widget — smaller than KPI Card, meant for detail pages (animal profile, health/production/finance detail).

```js
renderProductionWidget({ type:'إنتاج الحليب', value: ar(380), unit:'لتر', trend:3, trendDir:'down', period:'اليوم', status:'watch' });
```

---

## 11. `renderInventoryStockIndicator(opts)`

Progress bar, not a chart — matches the report's explicit instruction. Reuses the existing `.m3-progress` Material-Design-3 progress bar CSS (already in `styles.css`) rather than inventing new bar styling.

```js
renderInventoryStockIndicator({ name:'مضاد حيوي', quantity:2, minQuantity:5, unit:'عبوة' });
// status (حرج/يحتاج متابعة/جيد) and color are computed automatically from quantity vs minQuantity
```

---

## Now actually wired into a real page

`dashboard.html`'s KPI row (total herd, pregnant, goats/sheep breakdown, revenue/expense/margin), Priority Alerts, and the pie chart card now call `renderKPICard` / `renderAlertCard` / `renderChartContainer` directly — verified end-to-end with a Node test harness that loads `shared.js` + `dashboard.html` together and checks the real output (not just each function in isolation). The pre-existing sync-conflict mechanism (`checkSync`/`showConflict`/`resolveSync`) still works — its `id="sync-*"` elements are passed in via each KPI card's new `footerHtml` option.

**One small trade-off from this conversion:** the KPI cards used to be *entirely* clickable (the whole card was a link). Making the whole card a link would have nested the sync-conflict resolution buttons inside an `<a>`, which is invalid HTML with unpredictable click behavior — so instead, only the label text within each card is now a link. Slightly smaller click target, but avoids a real bug.

---

## 12–14. Chart generators (`renderLineChartSVG`, `renderGroupedBarSVG`, `renderDonutSVG`)

Hand-rolled SVG — this project has no charting library loaded, same approach the existing `renderPieChart` already uses. **All three return `null` on insufficient data** (per the report's "charts must degrade gracefully" rule) — callers must check and pass the result into `renderChartContainer`'s `state` accordingly:

```js
const svg = renderLineChartSVG(herdTrend, { color:'#10b981' }); // null if fewer than 2 points
renderChartContainer({ title:'اتجاه القطيع', chartHtml: svg||'', state: svg?'ready':'empty' });
```

`renderLineChartSVG(data, {color, height, width, showArea})` — `data: [{label, value}]`
`renderGroupedBarSVG(data, {colors, height, width})` — `data: [{label, values:[v1,v2,...]}]`
`renderDonutSVG(segments, {size, strokeWidth})` — `segments: [{label, value, color}]`, returns `null` if all values are 0.

**Wired into `dashboard.html`'s new Analytics Grid**, all four charts specified for Phase 3, all real data:

- **Herd Population Trend** — reconstructed from `animals.birth_date`/`died_at` over the last 6 months (there's no population-snapshot history collection, so this is derived rather than stored — worth knowing if the numbers ever look surprising for old records missing `birth_date`).
- **Health Status Distribution** — real categories only: سليم / تحت العلاج (from `health.status==='active'`) / نافق. **Did not invent** "Quarantine" or "Sold" categories the report's generic template suggested — verified this app's actual `animals.status` values are only `alive`/`dead`, nothing else.
- **Production Trend** — real `production_log` (`type:'milk'`) quantities, last 14 days, same field names `production.html` already uses.
- **Revenue vs Expense** — real `finance` records grouped by month, last 6 months.

## Recent Records + Recent Activity

- **Recent Records**: `renderDataTableWrapper` fed by a unified list merged from `animals`/`health`/`finance` (real dates), sorted, top 8.
- **Recent Activity Timeline**: `renderTimeline` + `renderTimelineItem` fed by the real `activity_log` collection (the same one `logActivity()` already writes to across the whole app) — this dashboard is the first page to ever *read* it.
- **Design note**: the report suggested Alerts and Activity as one left/right split section near the bottom. I kept Priority Alerts at the *top* (already built in the earlier dashboard pass) and Activity as its own section near the bottom instead — still satisfies the report's real rule ("alerts and activity should not be merged"), just arranged differently.

## Not done yet

- No other page besides `dashboard.html` uses any of these components yet. That's the natural next step (Phase 4 proper): pick a module (Health, Production, Finance, Inventory, or Animals — the report suggests that order) and rebuild its listing/detail page on top of this library instead of its current hand-written markup.

---

## Phase 4 progress

**`health.html` / `pages/health.js` — done.** Rebuilt `renderHealthPage()` to use `renderPageHeaderV2` (breadcrumb), `renderKPICard` (the 4 stat cards), `renderChartContainer` + `renderDonutSVG` (status distribution — new), and `renderAlertCard` (withdrawal warnings — was one grouped banner, now one card per animal). Every underlying function (`completeHealth`, `delHealth`, `showHealthDetail`, `openHealthModal`, `submitHealth`, `exportHealthCSV`) is untouched.

**Deliberately kept the record list as `.record-card`s, not a literal `renderDataTableWrapper` table.** Health records carry rich per-record detail (diagnosis, medication, dosage, withdrawal countdown, BCS) that compresses badly into table columns — forcing every module into an identical table just for consistency would hurt this one. Applying templates where they fit > applying them everywhere uniformly.

Verified with the same combined-eval Node test harness as the dashboard — real mock data (active/completed/withdrawal-period records), checked KPI counts compute correctly, alert cards render real per-animal withdrawal content, and nothing from the original page (filter bar, all 3 record diagnoses, BCS display) was lost.

---

**`production.html` / `pages/production.js` — KPI row + header done; Milk tab done as the template for the other 3.**

`production.html` already loads **Chart.js** (real canvas-based charts, not hand-rolled SVG) — much more capable than what `dashboard.html`/`health.html` have, so the right move here was *not* replacing it with `renderChartContainer`'s SVG generators. Instead:

- `renderPageHeaderV2` (breadcrumb) + `renderKPICard` for all 6 stat cards (شared across all 4 tabs).
- The **Milk tab** specifically: wrapped the existing `<canvas>`+Chart.js chart inside `renderChartContainer` (title/subtitle/empty-state shell), while the actual Chart.js drawing code — colors, dataset, `setTimeout` render — is 100% untouched. Also converted its data table to `renderDataTableWrapper`.
- Bumped the chart's line color from the old `#2196f3` to the new `#3b82f6` token, matching Phase 1's palette.

**Wool / Weight / Summary tabs — also done** (finished in the same pass as Milk, same exact pattern: canvas chart → `renderChartContainer` shell, table → `renderDataTableWrapper` or `renderSectionContainer` for the leaderboard). Also aligned every Chart.js color in all 4 tabs to the Phase 1 palette (`#2196f3`→`#3b82f6`, `#ffc107`→`#f59e0b`, `#00e676`-family→`#34d399`/`#10b981`). Verified by looping all 4 tabs through the same combined-eval harness with mock data spanning milk/wool/weight records — no NaN/undefined in any tab.

---

**`finance.html` / `pages/finance.js` — done.** Header → V2 (breadcrumb). The 3 summary cards (income/expense/net) → `renderKPICard`. Expense-by-category breakdown (the `.finance-bar-wrap` list) wrapped in `renderChartContainer` for a consistent title/subtitle shell — the bars themselves are untouched, they're already a reasonable pattern for a per-category breakdown. Transactions table → `renderDataTableWrapper`, with the totals row moved into the wrapper's `paginationHtml` slot instead of a `<tfoot>` (same information, fits the component's shape better). All CRUD (`openFinModal`, `submitFin`, `delFin`, `showCostPerHead`, `exportFinCSV`) untouched.

---

**`inventory.html` / `pages/inventory.js` — done.** Header → V2. The 3 tab-selector cards (meds/feeds/equipment counts) → `renderKPICard`, with the label itself carrying the tab-switch `onclick` (same trick used on the dashboard for sync-safe clickable KPI cards). The old single grouped alert banner → individual `renderAlertCard`s, one per real signal (expiring meds / low meds / low feed). **New section added**: "أصناف تحتاج انتباه" using `renderInventoryStockIndicator` (the component built specifically for this in Phase 2, finally wired to real data) — a quick visual scan of everything at or below minimum stock, sitting above the full detail tables rather than replacing them. Meds/Feeds/Equipment tables → `renderDataTableWrapper`. `showFCR`, `openAddInv`, `openEditInv`, `delInv`, `openUseModal`, `exportInvCSV` all untouched.

---

**`animals.html` — partial, scoped deliberately.** This is the module the report explicitly warned is "the deepest and most complex" and should go last — 1,499 lines, self-contained (no separate `pages/animals.js`), with bulk-select, complex multi-field filtering, and a derived health-status computation (`getAnimalStatus()`) layered on top of the raw `alive`/`dead` field. Converting its full list-rendering and filter bar to the new component set in the same pass as four other modules was a real risk of a careless mistake in code I hadn't fully read.

What I did instead: added the **KPI Summary row that this page was completely missing** (`renderKPICard` — total herd / goats / sheep / under-treatment, computed from the same real `animals` + `health` data), and the breadcrumb header — as a genuinely new, additive `<div id="animals-kpi-row">` block with its own render function, called once after data loads. Did not touch `renderFilters()`, `renderAnimals()` (the 150+ line filter/sort/render function), or any of the bulk-selection/import-export logic.

**Not done**: converting the animal list itself to `renderDataTableWrapper` (it's currently `.animal-row` cards, similar reasoning to Health — worth a dedicated look at whether a table or card grid fits better, not a mechanical swap), and `animal-detail.html` (579 lines, the report's "Detail Template" target) wasn't touched at all this round.

---

## Phase 4 status: Health, Production, Finance, Inventory done. Animals partial (KPI summary added; full listing + detail template conversion still open).

Every file was syntax-checked (`node --check`) after editing, and every module except Animals' full page was exercised end-to-end with a combined-eval Node harness against realistic mock data (not just each function read for correctness) — checked for thrown errors, NaN, and undefined in the actual rendered output.

---

## Phase 5 — Reports & Advanced Analytics

**`reports.html` / `pages/reports.js` — KPI rows + header + one comparison feature done.**

This page was already substantially an Analytics Template before this pass — real Chart.js charts across 4 tabs (herd/finance/health/breeding), Excel export, WhatsApp sharing — genuinely more depth than the dashboard's charts already, so the report's "don't duplicate the dashboard, add more depth" rule was mostly already satisfied by the existing page.

What changed:
- Header → `renderPageHeaderV2` (breadcrumb).
- **All 4 KPI rows** converted to `renderKPICard` — the main overview row plus each of the finance/health/breeding tabs' own row (herd tab has no separate KPI row, only the main one applies there).
- **New: real "Comparison controls"** (the one Phase 5 addition the report explicitly asks for and this page didn't have) — the Finance tab's Income/Expense KPI cards now show an actual month-over-month trend, computed from `monthlyFin` data that was already being fetched and built for the monthly chart, just never surfaced as a comparison before.

**Not done**: the Chart.js charts themselves (9 canvases across 4 tabs) weren't wrapped in `renderChartContainer` — the sheer number made it a lower-value, higher-risk use of the remaining time this round versus the KPI conversions and the new comparison feature. "Seasonal analysis" and "cross-module trends" beyond the one added aren't built.

Verified the same way as Phase 4 — combined-eval harness, mock data covering all 4 collections, looped through all 4 tabs, checked for thrown errors/NaN/undefined in each tab's actual rendered output.

---

## Phase 6 — Admin & Settings Consistency

**`settings.html` — found and fixed a real, pre-existing bug, not just a styling pass.**

This page was missing `config.js`, `firebase.js`, `nav.js`, and `shared.js` entirely — only `farm-react.js` was loaded. It called `getUser()`, `getSettings()`, and `fbGet()` with no source for any of them, had **zero** `DOMContentLoaded` listener anywhere in the file (so no `requireAuth()` gate, no `renderNavbar()`), and — this is the one from the earlier security audit — `<div id="admin-reset-section">` genuinely did not exist anywhere in the markup despite JS trying to `getElementById` it and toggle its display. The six `resetAnimals`/`resetFinance`/`resetHealth`/`resetActivity`/`resetNotifications`/`resetEverything` functions were fully implemented but **completely unreachable** from the UI.

Fixed all of it:
- Added the 4 missing script tags.
- Added a proper `DOMContentLoaded` init: `requireAuth()` gate, `renderNavbar()`, `renderPageHeaderV2` (breadcrumb).
- Built the actual `admin-reset-section` content — `renderSectionContainer` with `variant:'warning'`, six real buttons wired to the six already-existing (and already confirm()-gated) reset functions, only rendered/shown for `role==='admin'`.
- Removed the old dangling IIFE that tried to do this at parse-time instead of after auth/DOM were ready.

Verified with two runs of the same harness pattern — one as an admin (section becomes visible, all six buttons present), one as a non-admin (section stays hidden, no content rendered at all).

**`users.html` / `barns.html` / `pages/farm_profile.js` — header consistency only.** All three already had correct script dependencies and auth gates (settings.html's bug was isolated, not systemic — checked this explicitly before assuming otherwise). Converted each header to `renderPageHeaderV2` with a breadcrumb. Did not touch the user list, barn/transfer logic, or farm-profile form fields — Settings Template's "Section Containers, Forms, Save/cancel row" wasn't applied to the deeper content of these three, given time spent on the settings.html bug fix.

**Not done**: `activity.html` (still the 0-byte file found at the very start of this project) and `import.html` (642 lines, more of a specialized wizard than a Settings-Template fit) weren't touched this round.

---

## Overall status after this session
Phase 1: 100%. Phase 2: 100%. Phase 3: 100%. Phase 4: ~85% (Animals partial). Phase 5: ~60%. Phase 6: ~55% (settings.html's real bug fixed; users/barns/farm-profile headers only; activity.html and import.html untouched).

