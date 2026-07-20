# Sprint 2 — Task 2.1: activity.html Investigation & Migration Plan
**Status: Investigation and planning only. No code has been written or applied.**

---

## PHASE 1 — Full Diff

| Aspect | Root `/activity.html` | `farm-apk/www/activity.html` |
|---|---|---|
| File size | 0 bytes | 285 lines |
| `<head>` | none | Standard head: preconnect hints, theme-color meta, early dark/light-mode script, Bootstrap 5.3.3 + Bootstrap Icons 1.11.3 CDN, Google Fonts (Cairo/Lexend), `<link rel="stylesheet" href="styles.css">` — **identical pattern to every other page in the project** |
| Body structure | none | `.page-wrap` > `#page-header` (empty div, filled by `renderPageHeader()`) + `#content` (spinner placeholder, filled by `renderActivityPage()`) + footer with `#footer-year`/`#footer-farm` |
| Script includes | none | `config.js`, `firebase.js`, `nav.js`, `shared.js`, `pages/datepicker.js` (defer), `pages/tour.js` (defer), then one large inline `<script>` block |
| Inline script | none | ~250 lines: constants (`ACTION_CFG`, `RESOURCE_LABELS`), module-level filter state (`allLogs`, `filterUser`, `filterAction`, `filterResource`, `filterDate`), a `DOMContentLoaded` init handler, `renderActivityPage()`, and 5 `window.*`-exported handlers |
| IDs used | none | `page-header`, `content`, `footer-year`, `footer-farm` — all standard, match the pattern every other page in this project already uses |
| Event handlers | none | All inline `onclick=` (consistent with the project-wide pattern already documented: `onclick="backupActivity()"`, `onclick="clearByPeriod(1)"`, `onclick="deleteAllActivity()"`, `onclick="filterUser='...';renderActivityPage()"`, `onchange="filterAction=this.value;renderActivityPage()"`, etc.) — no `.addEventListener` calls |
| Dependencies (functions called) | none | `requireAuth()`, `can()`, `initFirebase()`, `getSettings()`, `renderNavbar()`, `renderPageHeader()`, `renderLoading()`, `fbGet()`, `fbDelete()`, `toast()`, `ar()`, `timeAr()`, `todayStr()`, `ROLES` (global object) |
| Initialization flow | none | `DOMContentLoaded` → `requireAuth()` guard → permission check (`can('admin')` or `can('activity')`) → `initFirebase()` → populate footer → `renderNavbar()` → `renderPageHeader()` (with conditional admin-only backup/clear buttons) → `renderLoading()` placeholder → `fbGet('activity_log')` → sort by timestamp descending → `renderActivityPage()` |

**Missing HTML:** 100% of it — the root file is empty.
**Missing JS includes:** all 6 `<script src>` tags, plus the inline script block.
**Missing CSS:** see Phase 2 — the *files* are present, but **6 specific class definitions this page depends on were removed from root `styles.css` during this session's earlier cleanup pass**, before this page's dependency on them was known.
**Missing inline scripts:** the entire ~250-line block described above.

---

## PHASE 2 — Dependency Audit

| Dependency | Type | Exists on web (root)? | Classification |
|---|---|---|---|
| `config.js` | script | Yes, identical path | **Identical** |
| `firebase.js` | script | Yes | **Identical** |
| `nav.js` | script | Yes | **Identical** |
| `shared.js` | script | Yes, but root's `shared.js` has since evolved with this session's token/motion-variable work (unrelated to this page's needs) | **Newer on web** (superset — no functions this page needs were removed) |
| `pages/datepicker.js` | script | Yes | **Identical** |
| `pages/tour.js` | script | Yes | **Identical** |
| `styles.css` | stylesheet | Yes, but root's copy is **behind** www's copy by this session's Sprint 2 CSS work in most respects (tokens, motion, card unification) — **except** for 6 classes that root's copy actively *removed* and www's copy still has | **Conflicting** — root is newer overall, but has a real regression relative to www for this one page's needs |
| `requireAuth()`, `can()`, `initFirebase()`, `getSettings()`, `renderNavbar()`, `renderPageHeader()`, `renderLoading()`, `fbGet()`, `fbDelete()`, `toast()`, `ar()`, `timeAr()`, `todayStr()`, `ROLES` | JS functions/globals | All confirmed present in root `shared.js`/`firebase.js`/`nav.js` | **Identical** |
| `.activity-row` | CSS class | **No** — removed from root `styles.css` in this session's dead-code cleanup commit | **Missing (regression)** |
| `.activity-icon` | CSS class | **No** — same commit | **Missing (regression)** |
| `.act-add` | CSS class | **No** — same commit | **Missing (regression)** |
| `.act-edit` | CSS class | **No** — same commit | **Missing (regression)** |
| `.act-delete` | CSS class | **No** — same commit | **Missing (regression)** |
| `.act-login` | CSS class | **No** — same commit | **Missing (regression)** |
| `.dropdown-menu`, `.dropdown-item`, `.wonder-card`, `.stat-mini`, `.user-avatar`, `.type-badge`, `.role-badge-*`, `.empty-state`, `.field`, `.action-btn`, `.spinner`, `.page-wrap`, `.accent-text`, `.green-text`, `.blue-text`, `.red-text`, `.text-gray` | CSS classes | Yes, all confirmed present and untouched | **Identical** |

**Direct finding worth stating plainly:** the 6 "missing" CSS classes above are not a pre-existing gap — they were removed from root `styles.css` **during this session's own Sprint 2 dead-code cleanup**, before this page's dependency on them was discovered. At the time of that cleanup, the evidence available (root-repo-only scan) genuinely showed zero references anywhere. This later, wider scan (including `farm-apk/www/`) is what surfaced the dependency. This is stated as fact, not blame — it is exactly the kind of thing a second, deeper pass is supposed to catch before deletion becomes permanent.

---

## PHASE 3 — Migration Plan (smallest possible, zero behavior change)

**Goal:** make root `/activity.html` behave identically to `farm-apk/www/activity.html`, using content already proven to work in production (the Android app), with no redesign, no refactor, no cleanup.

| Step | Action | File(s) |
|---|---|---|
| 1 | Restore the 6 CSS class definitions (`.activity-row`, `.activity-icon`, `.act-add`, `.act-edit`, `.act-delete`, `.act-login`) to root `styles.css` — verbatim, as they existed before this session's cleanup commit | `styles.css` |
| 2 | Copy `farm-apk/www/activity.html`'s content into root `/activity.html` verbatim | `activity.html` |
| 3 | No other file needs to change — all script dependencies (`config.js`, `firebase.js`, `nav.js`, `shared.js`, `pages/datepicker.js`, `pages/tour.js`) already exist at the same relative paths in root, and all JS functions/globals the page calls are already present in root's current `shared.js`/`firebase.js`/`nav.js` | none |

**What this plan explicitly preserves, per the task's rules:**
- **URL:** stays `/activity.html`, unchanged.
- **Navigation:** `nav.js`'s existing sidebar link (`href:'activity.html'`) and every notification href pointing at it already work correctly once the page has real content — no navigation code needs to change.
- **History:** no routing mechanism exists in this project beyond plain page loads; nothing to preserve beyond the URL itself, which is unchanged.
- **Existing JS API:** every `window.*` export this page defines (`backupActivity`, `deleteAllActivity`, `clearByPeriod`, `clearOldLogs`, `exportActivityCSV`) is copied verbatim — no renaming.
- **DOM IDs:** `page-header`, `content`, `footer-year`, `footer-farm` copied verbatim.
- **CSS class names:** all copied verbatim, including the 6 being restored — no renaming, no consolidation into the newer unified-card system, even though `.wonder-card` (already unified this session) is used elsewhere in this same page. Mixing "restore old dead classes verbatim" with "adopt new primitives" in the same change would violate the no-redesign constraint; that consolidation (if wanted) is separate follow-up work, not part of this migration.

**Explicitly out of scope for this migration (per the task's rules):** renaming the 6 restored classes to fit the new card/token system, converting inline `onclick=` to delegated events, splitting the large inline script into a separate file, or any other improvement — even ones this project's own Blueprint would otherwise recommend. This migration's only job is to make the page work exactly as it already works in the Android app.

---

## PHASE 4 — Risk Analysis

| Change | Risk | Side Effects | Rollback Method | Affected Files |
|---|---|---|---|---|
| Restore 6 CSS classes to `styles.css` | **Very Low** | None expected — these are additive re-insertions of rules that existed in this exact file earlier in this same session; no other rule currently depends on their absence | `git revert` the specific insertion commit | `styles.css` |
| Copy www's `activity.html` content to root | **Low-Medium** | (a) The copied inline script references `ROLES`, `can()`, etc. — all confirmed present, so no runtime error expected; (b) the page will now appear in navigation as a working destination instead of blank, which is the intended fix, not a side effect; (c) **worth flagging:** this page's `deleteAllActivity()`/`clearByPeriod()` functions perform real, irreversible Firebase deletions (`fbDelete('activity_log', ...)`) gated behind `admin`-only permission and a manual backup-first check — this is existing, already-designed behavior being restored, not new risk introduced by this migration, but it's the highest-consequence functionality on the page and worth a manual smoke test specifically on the destructive actions (in a non-production Firebase environment if one exists) before considering this done | `git revert` the content-copy commit; page returns to its current empty state (no worse than today) | `activity.html` |
| No other files touched | None | None | N/A | — |

**Overall risk level for this migration: Low.** The two changes are small, additive, independently revertible, and restore behavior that already exists and already works in a shipped context (the Android app) rather than introducing anything new or untested.

---

## PHASE 5 — Output Summary

**1. Investigation summary:** Root `activity.html` is empty; `farm-apk/www/activity.html` (285 lines) is the real, working implementation — an admin-only activity log with filtering, CSV export, and period-based deletion, built entirely on functions/globals that already exist in root's current `shared.js`/`firebase.js`/`nav.js`. The only genuine gap is 6 CSS classes that this session's own earlier cleanup pass removed from root `styles.css` before this page's dependency on them was known.

**2. Exact migration plan:** (1) Restore the 6 CSS class definitions to `styles.css`. (2) Copy `farm-apk/www/activity.html`'s full content into root `/activity.html`, verbatim, no renaming, no refactor.

**3. Files that will change:** `styles.css` (additive only), `activity.html` (0 → 285 lines, copied verbatim from the working Android version).

**4. Estimated LOC:** ~6 lines added to `styles.css`; ~285 lines added to `activity.html`. Total ≈291 LOC, all additive — zero lines removed from any currently-working file.

**5. Risk level:** Low overall; the single item warranting a manual smoke test before sign-off is the page's destructive admin actions (`deleteAllActivity`, `clearByPeriod`), which are pre-existing designed behavior, not new risk from this migration.

**6. Waiting for approval before applying anything.**
